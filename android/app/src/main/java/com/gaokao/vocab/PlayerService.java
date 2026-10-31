package com.gaokao.vocab;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaMetadata;
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.Locale;

/**
 * 听读模式「系统播放器」服务（v2.62.0）
 *
 * 解决的问题：
 *  1. 网页 Audio 只能在应用内播放，退出 / 锁屏 / 息屏即静音
 *  2. 没有系统级播放入口，通知栏 / 锁屏 / 耳机线控都控制不了
 *  3. v2.61.0 之前通知栏与锁屏看不到进度条，不能拖动，不像音乐播放器
 *
 * v2.62.0 升级：
 *  - 播放本地 MP3 文件（MainActivity 预下载缓存），时长与进度精确
 *    （网络流媒体在很多机型上 getDuration() 返回 0，锁屏就没有进度条）
 *  - MediaSession 上报真实 position / duration / 速度，锁屏、蓝牙耳机、
 *    车机、手表都能显示进度条并拖动
 *  - 支持 onSeekTo（拖动进度）、onPlay / onPause / onSkipToNext / Previous
 *  - metadata 带 title（单词）/ artist（释义）/ album（词库名）
 *
 * 兼容性：minSdk 21（安卓 5.0.2 翻译笔 / MP5）起可用。
 *  - MediaSession / MediaStyle / PlaybackState：API 21+
 *  - 变速 setPlaybackParams：API 23+，低版本忽略变速（仍正常播放）
 *  - 前台服务类型 mediaPlayback：API 29+ 才需要
 *  - 通知渠道：API 26+ 才需要
 */
public class PlayerService extends Service {

    public static final String ACTION_PLAY = "com.gaokao.vocab.player.PLAY";
    public static final String ACTION_PAUSE = "com.gaokao.vocab.player.PAUSE";
    public static final String ACTION_RESUME = "com.gaokao.vocab.player.RESUME";
    public static final String ACTION_STOP = "com.gaokao.vocab.player.STOP";
    public static final String ACTION_MEDIA = "com.gaokao.vocab.player.MEDIA";
    public static final String ACTION_RATE = "com.gaokao.vocab.player.RATE";
    public static final String ACTION_META = "com.gaokao.vocab.player.META";
    public static final String ACTION_SEEK = "com.gaokao.vocab.player.SEEK";
    // v2.63.0：TTS 伴侣模式（系统语音朗读期间保持媒体卡片可见可控）
    public static final String ACTION_TTS = "com.gaokao.vocab.player.TTS";
    public static final String EXTRA_TTS_PLAYING = "tts_playing";
    public static final String EXTRA_TTS_DURATION = "tts_duration";

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_PATH = "path";
    public static final String EXTRA_ID = "id";
    public static final String EXTRA_RATE = "rate";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_ARTIST = "artist";
    public static final String EXTRA_ALBUM = "album";
    public static final String EXTRA_SEEK = "seek";
    public static final String EXTRA_MEDIA_ACTION = "media_action";
    // v2.64.0：整库连续播放（Album 模式）
    public static final String ACTION_ALBUM = "com.gaokao.vocab.player.ALBUM";
    public static final String ACTION_ALBUM_SEEK = "com.gaokao.vocab.player.ALBUM_SEEK";
    public static final String EXTRA_ALBUM_JSON = "album_json";
    public static final String EXTRA_ALBUM_INDEX = "album_index";
    public static final String EXTRA_ALBUM_PATH = "album_path";
    // v2.65.0：整库合成单一音频文件（File Album 模式）——
    // 英文 mp3 解码 + 中文 TTS 合成 + 词间静音 → 一个 WAV 文件 → 单 MediaPlayer 播放
    public static final String ACTION_ALBUM_FILE = "com.gaokao.vocab.player.ALBUM_FILE";


    private static final String TAG = "GaokaoPlayer";
    private static final String CHANNEL_ID = "gaokao_listen_playback";
    private static final int NOTIFY_ID = 20260101;

    /** JS 回调：播放结束 / 出错 / 媒体按键 / 进度 */
    public interface PlayerCallback {
        void onEvent(String id, String type);
    }

    private static volatile PlayerCallback sCallback;

    public static void setCallback(PlayerCallback cb) {
        sCallback = cb;
    }

    private static void emit(String id, String type) {
        if (sCallback == null) return;
        try {
            sCallback.onEvent(id == null ? "" : id, type);
        } catch (Throwable ignored) {
        }
    }

    /** 供 JS 侧 window.NativePlayer.getPosition() / getDuration() 同步读取 */
    private static volatile int sPosition = 0;
    private static volatile int sDuration = 0;

    public static int peekPosition() {
        return sPosition;
    }

    public static int peekDuration() {
        return sDuration;
    }

    /** 服务是否存活：MainActivity 据此决定控制指令是否下发（防 FGS 闪退） */
    public static volatile boolean sRunning = false;

    private MediaPlayer mPlayer;
    private MediaSession mSession;
    private PowerManager.WakeLock mWakeLock;
    private AudioManager mAudioManager;
    private AudioManager.OnAudioFocusChangeListener mFocusListener;
    private Handler mHandler;

    private String mId = "";
    private String mTitle = "背群英 · 听读";
    private String mArtist = "背群英";
    private String mAlbum = "高考词汇听读";
    private float mRate = 1f;
    private boolean mPaused = false;
    private boolean mHasPlayed = false;
    private int mDuration = 0;

    // ===== v2.64.0 Album 整库连续播放 =====
    private static class AlbumWord {
        String word;
        String meaning;
        String enUrl;
        String zhText;
        String key;
        AlbumWord(String w, String m, String e, String z) {
            word = w; meaning = m; enUrl = e; zhText = (z != null && z.length() > 0) ? z : m;
            key = (w == null ? "" : w).toLowerCase().replaceAll("\\s+", "")
                    + "_" + Math.abs((m == null ? "" : m).hashCode());
        }
    }
    private boolean mAlbumMode = false;
    private ArrayList<AlbumWord> mAlbumWords = new ArrayList<AlbumWord>();
    private int mAlbumIndex = 0;
    private String mAlbumName = "高考词汇";
    private float mAlbumRate = 1f;
    private int mAlbumAvgMs = 4500;
    private int mAlbumTotal = 0;
    private int mAlbumBaseMs = 0;
    private int mAlbumPendingNext = -1;
    // v2.66.0：逐词模式也按 JS 下发的「朗读顺序 + 遍数」执行（en-zh / zh-en / en）
    private String[] mAlbumSeq = null;
    private int mAlbumSeqPos = 0;
    private int mAlbumRepCur = 0;
    private TextToSpeech mTts = null;
    private boolean mTtsReady = false;
    private File mAlbumCacheDir = null;

    // ===== v2.65.0 File Album：整库合成单一 WAV 文件 =====
    private boolean mFileMode = false;               // 整库单文件模式（mAlbumMode 同时为 true）
    private float mFileRate = 1f;                    // 语速（setPlaybackParams 应用到整库文件）
    private boolean mFileLoop = true;                // 播完是否循环整库
    private long[] mFileStarts = null;               // 每个词在文件中的起始毫秒
    private int mFileIndex = -1;                     // 当前词序号（按播放位置推算）
    private File mFileOut = null;                    // 当前整库 WAV 文件（播放结束后可重播）
    private volatile int mBuildGen = 0;              // 合成任务代号：新一轮开始使旧构建线程自行退出
    private volatile boolean mBuildCancel = false;   // 取消合成
    private Thread mBuildThread = null;
    private File mAlbumWavDir = null;
    private java.util.HashMap<String, java.util.concurrent.CountDownLatch> mSynthLatches =
            new java.util.HashMap<String, java.util.concurrent.CountDownLatch>();
    private static final int OUT_SR = 16000;         // 输出采样率：16kHz 单声道 16bit（语音足够，控制文件体积）
    private static final int OUT_BYTES_PER_MS = OUT_SR * 2 / 1000; // 32 字节/毫秒

    // ===== v2.66.0：听读参数（由 JS 下发，参与整库音频的实际生成） =====
    private int mCfgEnRepeat = 2;        // 英文朗读遍数（与 JS loadListenCfg 默认值一致）
    private int mCfgZhRepeat = 1;        // 中文朗读遍数（0 = 不读）
    private String mCfgOrder = "en-zh";  // en-zh / zh-en / en
    private int mCfgInnerGapMs = 600;    // 同一遍之间的间隔
    private int mCfgWordGapMs = 2000;    // 词间间隔
    private String mCfgZhSource = "net"; // net = 网络真人配音（拟人）；system = 手机自带语音引擎
    private int mCfgZhVoice = 0;         // 网络配音音色：0 度小娇（女声·推荐）/ 3 度逍遥 / 4 度丫丫
    private java.util.concurrent.ExecutorService mPrefetchPool = null; // 英文/中文音频并发预取
    private volatile int mPrefetchedUpto = -1;  // 已预取到第几个词（避免重复提交任务）


    /** 进度上报（每 500ms 一次，供锁屏 / 蓝牙 / JS 进度条使用） */
    private final Runnable mProgressTask = new Runnable() {
        @Override
        public void run() {
            try {
                if (mFileMode) {
                    // 整库单文件：真实进度 + 按位置推算当前词，序号变化时回传 JS
                    int pos = 0;
                    try { if (mPlayer != null && mHasPlayed) pos = mPlayer.getCurrentPosition(); } catch (Throwable ignored) {}
                    if (mDuration <= 0) { try { if (mPlayer != null) mDuration = mPlayer.getDuration(); } catch (Throwable ignored) {} }
                    int dur = mDuration > 0 ? mDuration : 0;
                    sPosition = pos; sDuration = dur;
                    emit("", "progress:" + pos + ":" + dur);
                    syncFileWordIndex(pos);
                    if (!mPaused) updateSessionState(PlaybackState.STATE_PLAYING);
                } else if (mAlbumMode) {
                    // 整库连续播放：进度 = 当前词起始偏移 + 当前词内部进度（限幅到单词语估算时长）
                    if (!mPaused) {
                        int wordPos = 0;
                        try { if (mPlayer != null && mHasPlayed) wordPos = mPlayer.getCurrentPosition(); } catch (Throwable ignored) {}
                        int pos = mAlbumBaseMs + Math.min(wordPos, mAlbumAvgMs);
                        int dur = (mAlbumTotal > 0 ? mAlbumTotal : 1) * mAlbumAvgMs;
                        sPosition = pos; sDuration = dur;
                        emit("", "progress:" + pos + ":" + dur);
                        updateSessionState(PlaybackState.STATE_PLAYING);
                    }
                } else if (mPlayer != null && mHasPlayed && !mPaused) {
                    int pos = 0;
                    try {
                        pos = mPlayer.getCurrentPosition();
                    } catch (Throwable ignored) {
                    }
                    if (mDuration <= 0) {
                        try {
                            mDuration = mPlayer.getDuration();
                        } catch (Throwable ignored) {
                        }
                    }
                    if (mDuration > 0) {
                        sPosition = pos;
                        sDuration = mDuration;
                        emit("", "progress:" + pos + ":" + mDuration);
                        updateSessionState(PlaybackState.STATE_PLAYING);
                    }
                }
            } catch (Throwable ignored) {
            }
            if (mHandler != null) mHandler.postDelayed(this, 500);
        }
    };

    @Override
    public void onCreate() {
        super.onCreate();
        sRunning = true;
        mHandler = new Handler(Looper.getMainLooper());
        try {
            mAudioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        } catch (Throwable ignored) {
        }
        createChannel();
        mAlbumCacheDir = new File(getCacheDir(), "album_media");
        try { if (mAlbumCacheDir != null && !mAlbumCacheDir.exists()) mAlbumCacheDir.mkdirs(); } catch (Throwable ignored) {}
        mAlbumWavDir = new File(getCacheDir(), "album_wav");
        try { if (mAlbumWavDir != null && !mAlbumWavDir.exists()) mAlbumWavDir.mkdirs(); } catch (Throwable ignored) {}
        initTts();
        if (mHandler != null) mHandler.post(mProgressTask);
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // v2.63.0：任何启动路径都必须先进入前台 —— API 26+ 用 startForegroundService
        // 启动后若不调 startForeground，系统直接抛 RemoteServiceException（无故闪退根源）。
        // 旧版 ACTION_META / ACTION_STOP 等分支不进前台：点「播放」先 setMeta → 必闪退。
        startForegroundCompat();
        if (intent == null) {
            return START_STICKY;
        }
        String action = intent.getAction();
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_PAUSE.equals(action)) {
            pauseInternal();
            return START_STICKY;
        }
        if (ACTION_RESUME.equals(action)) {
            resumeInternal();
            return START_STICKY;
        }
        if (ACTION_SEEK.equals(action)) {
            int pos = intent.getIntExtra(EXTRA_SEEK, 0);
            seekInternal(pos);
            return START_STICKY;
        }
        if (ACTION_MEDIA.equals(action)) {
            String a = intent.getStringExtra(EXTRA_MEDIA_ACTION);
            if (a == null || a.length() == 0) a = "playpause";
            // 先在原生层立即切换播放/暂停（即使 JS 无响应也能马上生效），
            // 再以「已暂停 / 已继续」的状态事件通知 JS 同步界面，
            // 避免 JS 再反向发一次 pause/resume 造成"按播放反而暂停"
            if ("playpause".equals(a)) {
                if (mPaused) resumeInternal();
                else pauseInternal();
                emit("", mPaused ? "paused" : "resumed");
            } else if ("pause".equals(a)) {
                pauseInternal();
                emit("", "paused");
            } else if ("play".equals(a) || "resume".equals(a)) {
                resumeInternal();
                emit("", "resumed");
            } else {
                emit("", a);
            }
            return START_STICKY;
        }
        if (ACTION_RATE.equals(action)) {
            float rr = Math.max(0.5f, Math.min(2.5f, intent.getFloatExtra(EXTRA_RATE, 1f)));
            mRate = rr;
            // v2.66.0：语速实时生效——选中这里可以确保整库模式（单文件 / 逐词）也跟着变，
            // 且语速不参与整库音频合成，所以改语速不需要重新合成。
            if (mAlbumMode) mAlbumRate = rr;
            if (mFileMode) mFileRate = rr;
            applyRate();
            updateSessionState(mPaused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING);
            return START_STICKY;
        }
        if (ACTION_META.equals(action)) {
            String t = intent.getStringExtra(EXTRA_TITLE);
            String ar = intent.getStringExtra(EXTRA_ARTIST);
            String al = intent.getStringExtra(EXTRA_ALBUM);
            if (t != null && t.length() > 0) mTitle = t;
            if (ar != null && ar.length() > 0) mArtist = ar;
            if (al != null && al.length() > 0) mAlbum = al;
            updateNotification();
            updateSessionState(mPaused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING);
            return START_STICKY;
        }
        // v2.63.0：TTS 伴侣模式 —— 系统语音朗读（speechSynthesis）期间，
        // 媒体卡片保持「播放中」，锁屏 / 控制中心 / 耳机线控可暂停、继续、切词。
        // 声音仍由系统 TTS 引擎发出，原生只负责 MediaSession 状态与控制转发。
        if (ACTION_TTS.equals(action)) {
            boolean playing = intent.getBooleanExtra(EXTRA_TTS_PLAYING, false);
            int dur = intent.getIntExtra(EXTRA_TTS_DURATION, 0);
            if (playing) {
                mHasPlayed = true;
                mPaused = false;
                if (dur > 0) {
                    mDuration = dur;
                    sPosition = 0;
                    sDuration = dur;
                }
                updateSessionState(PlaybackState.STATE_PLAYING);
            } else {
                mPaused = true;
                updateSessionState(PlaybackState.STATE_PAUSED);
            }
            updateNotification();
            return START_STICKY;
        }
        // v2.64.0：整库连续播放
        if (ACTION_ALBUM.equals(action)) {
            String aj = intent.getStringExtra(EXTRA_ALBUM_PATH);
            startAlbum(aj);
            return START_STICKY;
        }
        // v2.65.0：整库合成单一音频文件后播放（新优先路径）
        if (ACTION_ALBUM_FILE.equals(action)) {
            String aj = intent.getStringExtra(EXTRA_ALBUM_PATH);
            startAlbumFile(aj);
            return START_STICKY;
        }
        if (ACTION_ALBUM_SEEK.equals(action)) {
            int ai = intent.getIntExtra(EXTRA_ALBUM_INDEX, -1);
            if (mFileMode) {
                seekFileToWord(ai);
                return START_STICKY;
            }
            if (mAlbumMode && ai >= 0 && ai < mAlbumWords.size()) {
                stopAlbumWord();
                playAlbumWord(ai);
            }
            return START_STICKY;
        }
        if (ACTION_PLAY.equals(action)) {
            String url = intent.getStringExtra(EXTRA_URL);
            String path = intent.getStringExtra(EXTRA_PATH);
            mId = intent.getStringExtra(EXTRA_ID);
            if (mId == null) mId = "";
            mRate = intent.getFloatExtra(EXTRA_RATE, 1f);
            String title = intent.getStringExtra(EXTRA_TITLE);
            if (title != null && title.length() > 0) mTitle = title;
            String artist = intent.getStringExtra(EXTRA_ARTIST);
            if (artist != null && artist.length() > 0) mArtist = artist;
            String album = intent.getStringExtra(EXTRA_ALBUM);
            if (album != null && album.length() > 0) mAlbum = album;
            mPaused = false;
            mDuration = 0;
            startForegroundCompat();
            // 优先播放本地 MP3 文件：时长精确、进度可拖动、断网也能播
            if (path != null && path.length() > 0 && new File(path).exists()) {
                playSource(path, true);
            } else {
                playSource(url, false);
            }
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        sRunning = false;
        mAlbumMode = false;
        mFileMode = false;
        mBuildCancel = true; // 中断整库合成线程
        try { if (mPrefetchPool != null) { mPrefetchPool.shutdownNow(); mPrefetchPool = null; } } catch (Throwable ignored) {}
        try { if (mTts != null) { mTts.stop(); mTts.shutdown(); mTts = null; } } catch (Throwable ignored) {}
        mTtsReady = false;
        if (mHandler != null) {
            try {
                mHandler.removeCallbacks(mProgressTask);
            } catch (Throwable ignored) {
            }
        }
        releasePlayer();
        abandonFocus();
        releaseWakeLock();
        if (mSession != null) {
            try {
                mSession.setActive(false);
                mSession.release();
            } catch (Throwable ignored) {
            }
            mSession = null;
        }
        try {
            stopForeground(true);
        } catch (Throwable ignored) {
        }
        mInForeground = false;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIFY_ID);
        } catch (Throwable ignored) {
        }
        super.onDestroy();
    }

    // ================= 播放控制 =================

    /** source：本地文件路径（local=true）或网络 URL（local=false） */
    private void playSource(String source, boolean local) {
        if (source == null || source.length() == 0) {
            emit(mId, "error");
            return;
        }
        releasePlayer();
        requestFocus();
        acquireWakeLock();
        try {
            mPlayer = new MediaPlayer();
            if (Build.VERSION.SDK_INT >= 21) {
                mPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build());
            } else {
                mPlayer.setAudioStreamType(AudioManager.STREAM_MUSIC);
            }
            mPlayer.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            if (local) {
                mPlayer.setDataSource(source);
            } else {
                mPlayer.setDataSource(source);
            }
            mPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override
                public void onPrepared(MediaPlayer mp) {
                    mHasPlayed = true;
                    applyRate();
                    try {
                        mDuration = mp.getDuration();
                    } catch (Throwable ignored) {
                        mDuration = 0;
                    }
                    try {
                        mp.start();
                        mPaused = false;
                        updateSessionState(PlaybackState.STATE_PLAYING);
                        updateNotification();
                        // 通知 JS“真的开始播了”，用于区分「加载中」与「播放中」，避免暂停时被误判为播完
                        emit(mId, "start");
                    } catch (Throwable e) {
                        Log.e(TAG, "start failed", e);
                        emit(mId, "error");
                    }
                }
            });
            mPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override
                public void onCompletion(MediaPlayer mp) {
                    emit(mId, "end");
                    mPaused = true;
                    updateSessionState(PlaybackState.STATE_PAUSED);
                }
            });
            mPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    Log.e(TAG, "MediaPlayer error what=" + what + " extra=" + extra + " local=" + local);
                    // 本地文件损坏时直接上报错误，JS 会回退到应用内音频继续播放
                    emit(mId, "error");
                    return true;
                }
            });
            mPlayer.prepareAsync();
        } catch (Throwable e) {
            Log.e(TAG, "playSource failed", e);
            emit(mId, "error");
        }
    }

    private void pauseInternal() {
        mPaused = true;
        if (mTts != null) { try { mTts.stop(); } catch (Throwable ignored) {} }
        try {
            if (mPlayer != null && mPlayer.isPlaying()) mPlayer.pause();
        } catch (Throwable ignored) {
        }
        updateSessionState(PlaybackState.STATE_PAUSED);
        updateNotification();
    }

    private void resumeInternal() {
        mPaused = false;
        if (mFileMode) {
            // 整库单文件：合成中（播放器未就绪）只需等构建线程播完自动起播
            if (mPlayer != null && mHasPlayed && !mPlayer.isPlaying()) {
                try { mPlayer.start(); updateSessionState(PlaybackState.STATE_PLAYING); } catch (Throwable ignored) {}
            } else if (mPlayer == null && mFileOut != null && mFileOut.exists()) {
                // 已播完一轮：媒体卡片上的播放键 → 从头重播
                playBuiltFile(mFileOut);
                return;
            }
            updateNotification();
            return;
        }
        if (mAlbumMode) {
            if (mAlbumPendingNext >= 0) {
                int n = mAlbumPendingNext; mAlbumPendingNext = -1; playAlbumWord(n); return;
            }
            if (mPlayer != null && mHasPlayed && !mPlayer.isPlaying()) {
                try { mPlayer.start(); updateSessionState(PlaybackState.STATE_PLAYING); } catch (Throwable ignored) {}
            } else {
                // 合成中 / 词间间隔 / 已释放：恢复时重播当前词（类似音乐重播当前曲）
                playAlbumWord(mAlbumIndex);
            }
            updateNotification();
            return;
        }
        if (!mHasPlayed) return;
        try {
            if (mPlayer != null && !mPlayer.isPlaying()) {
                mPlayer.start();
                updateSessionState(PlaybackState.STATE_PLAYING);
            }
        } catch (Throwable ignored) {
        }
        updateNotification();
    }

    private void seekInternal(int pos) {
        try {
            if (mPlayer != null && mHasPlayed) {
                if (Build.VERSION.SDK_INT >= 26) {
                    mPlayer.seekTo(pos, MediaPlayer.SEEK_PREVIOUS_SYNC);
                } else {
                    mPlayer.seekTo(pos);
                }
                updateSessionState(mPaused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING);
            }
        } catch (Throwable ignored) {
        }
    }

    private void releasePlayer() {
        if (mPlayer != null) {
            try {
                if (mPlayer.isPlaying()) mPlayer.stop();
            } catch (Throwable ignored) {
            }
            try {
                mPlayer.release();
            } catch (Throwable ignored) {
            }
            mPlayer = null;
        }
        mHasPlayed = false;
        mDuration = 0;
    }

    private void applyRate() {
        if (mFileMode) mFileRate = Math.max(0.5f, Math.min(2.5f, mRate)); // v2.65.0：整库文件语速同步
        if (mPlayer == null) return;
        if (Build.VERSION.SDK_INT < 23) return; // 变速需 API 23+，低版本直接原速播放
        try {
            float r = Math.max(0.5f, Math.min(2.5f, mRate));
            android.media.PlaybackParams p = new android.media.PlaybackParams();
            p.setSpeed(r);
            mPlayer.setPlaybackParams(p);
        } catch (Throwable ignored) {
        }
    }

    // ================= 音频焦点 / 唤醒锁 =================

    private void requestFocus() {
        if (mAudioManager == null) return;
        try {
            if (mFocusListener == null) {
                mFocusListener = new AudioManager.OnAudioFocusChangeListener() {
                    @Override
                    public void onAudioFocusChange(int focusChange) {
                        if (focusChange == AudioManager.AUDIOFOCUS_LOSS
                                || focusChange == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) {
                            pauseInternal();
                        }
                    }
                };
            }
            mAudioManager.requestAudioFocus(mFocusListener, AudioManager.STREAM_MUSIC,
                    AudioManager.AUDIOFOCUS_GAIN);
        } catch (Throwable ignored) {
        }
    }

    private void abandonFocus() {
        if (mAudioManager == null || mFocusListener == null) return;
        try {
            mAudioManager.abandonAudioFocus(mFocusListener);
        } catch (Throwable ignored) {
        }
    }

    private void acquireWakeLock() {
        try {
            if (mWakeLock == null) {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm == null) return;
                mWakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "GaokaoVocab:ListenPlayback");
                mWakeLock.setReferenceCounted(false);
            }
            if (!mWakeLock.isHeld()) mWakeLock.acquire();
        } catch (Throwable ignored) {
        }
    }

    private void releaseWakeLock() {
        try {
            if (mWakeLock != null && mWakeLock.isHeld()) mWakeLock.release();
        } catch (Throwable ignored) {
        }
        mWakeLock = null;
    }

    // ================= 通知栏 / MediaSession =================

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "听读播放",
                    NotificationManager.IMPORTANCE_LOW);
            ch.setDescription("听读模式后台播放控制");
            ch.setSound(null, null);
            nm.createNotificationChannel(ch);
        } catch (Throwable ignored) {
        }
    }

    private void ensureSession() {
        if (mSession != null) return;
        try {
            mSession = new MediaSession(this, "GaokaoListen");
            mSession.setFlags(MediaSession.FLAG_HANDLES_MEDIA_BUTTONS
                    | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
            mSession.setCallback(new MediaSession.Callback() {
                @Override
                public void onPlay() {
                    resumeInternal();
                    emit("", "resumed");
                }

                @Override
                public void onPause() {
                    pauseInternal();
                    emit("", "paused");
                }

                @Override
                public void onSkipToNext() {
                    if (mFileMode) { seekFileToWord(mFileIndex + 1); return; }
                    if (mAlbumMode) {
                        int n = mAlbumIndex + 1;
                        if (n < mAlbumWords.size()) { stopAlbumWord(); playAlbumWord(n); }
                        return;
                    }
                    emit("", "nexttrack");
                }

                @Override
                public void onSkipToPrevious() {
                    if (mFileMode) { seekFileToWord(mFileIndex - 1); return; }
                    if (mAlbumMode) {
                        int p = mAlbumIndex - 1;
                        if (p >= 0) { stopAlbumWord(); playAlbumWord(p); }
                        return;
                    }
                    emit("", "previoustrack");
                }

                @Override
                public void onStop() {
                    emit("", "stop");
                }

                @Override
                public void onSeekTo(long pos) {
                    if (mFileMode) {
                        // 整库单文件：真实拖动 —— 直接 seek 到文件内位置
                        seekInternal((int) pos);
                        syncFileWordIndex((int) pos);
                        return;
                    }
                    if (mAlbumMode) {
                        int idx = (int) (pos / mAlbumAvgMs);
                        if (idx < 0) idx = 0;
                        if (idx >= mAlbumWords.size()) idx = mAlbumWords.size() - 1;
                        stopAlbumWord();
                        playAlbumWord(idx);
                        return;
                    }
                    seekInternal((int) pos);
                }
            });
            mSession.setActive(true);
        } catch (Throwable e) {
            Log.w(TAG, "MediaSession unavailable", e);
            mSession = null;
        }
    }

    /**
     * 上报播放状态。带真实 position / duration 后，锁屏、蓝牙耳机、车机
     * 才会显示可拖动的进度条（与音乐播放器一致）。
     */
    private void updateSessionState(int state) {
        if (mSession == null) return;
        // v2.64.0：Album 模式用「整库估算进度」上报，锁屏 / 控制中心显示完整时间轴与可拖动进度条
        // （v2.65.0 File 模式除外：它走通用真实进度路径，因为单文件有真实时长）
        if (mAlbumMode && !mFileMode) {
            int dur = (mAlbumTotal > 0 ? mAlbumTotal : 1) * mAlbumAvgMs;
            int wordPos = 0;
            try { if (mPlayer != null && mHasPlayed) wordPos = mPlayer.getCurrentPosition(); } catch (Throwable ignored) {}
            int pos = mAlbumBaseMs + Math.min(wordPos, mAlbumAvgMs);
            updateAlbumState(state, pos, dur);
            return;
        }
        try {
            int pos = 0;
            if (mPlayer != null && mHasPlayed) {
                try {
                    pos = mPlayer.getCurrentPosition();
                } catch (Throwable ignored) {
                }
            }
            PlaybackState.Builder b = new PlaybackState.Builder();
            long actions = PlaybackState.ACTION_PLAY
                    | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_PLAY_PAUSE
                    | PlaybackState.ACTION_STOP
                    | PlaybackState.ACTION_SKIP_TO_NEXT
                    | PlaybackState.ACTION_SKIP_TO_PREVIOUS;
            if (mDuration > 0 && mPlayer != null) actions |= PlaybackState.ACTION_SEEK_TO;
            b.setActions(actions);
            // 4 参数 setState（带速率与时间戳）仅 API 29+ 才有，低版本用 3 参数重载
            if (Build.VERSION.SDK_INT >= 29) {
                b.setState(state, pos, mPaused ? 0f : mRate, System.currentTimeMillis());
            } else {
                b.setState(state, pos, mPaused ? 0f : 1f);
            }
            mSession.setPlaybackState(b.build());

            MediaMetadata.Builder mb = new MediaMetadata.Builder();
            mb.putString(MediaMetadata.METADATA_KEY_TITLE, mTitle);
            mb.putString(MediaMetadata.METADATA_KEY_ARTIST, mArtist);
            mb.putString(MediaMetadata.METADATA_KEY_ALBUM, mAlbum);
            if (mDuration > 0) {
                mb.putLong(MediaMetadata.METADATA_KEY_DURATION, mDuration);
            }
            mSession.setMetadata(mb.build());
        } catch (Throwable ignored) {
        }
    }

    private int getSmallIcon() {
        try {
            int ic = getApplicationInfo().icon;
            if (ic != 0) return ic;
        } catch (Throwable ignored) {
        }
        return android.R.drawable.ic_media_play;
    }

    private PendingIntent mediaPendingIntent(String action, int reqCode) {
        Intent i = new Intent(this, PlayerService.class);
        i.setAction(ACTION_MEDIA);
        i.putExtra(EXTRA_MEDIA_ACTION, action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, reqCode, i, flags);
    }

    private Notification buildNotification() {
        ensureSession();

        Intent contentIntent = new Intent(this, MainActivity.class);
        contentIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= 23) piFlags |= PendingIntent.FLAG_IMMUTABLE;
        PendingIntent pi = PendingIntent.getActivity(this, 10, contentIntent, piFlags);

        Notification.Builder nb;
        if (Build.VERSION.SDK_INT >= 26) {
            nb = new Notification.Builder(this, CHANNEL_ID);
        } else {
            nb = new Notification.Builder(this);
        }
        nb.setContentTitle(mTitle)
                .setContentText(mPaused ? "已暂停 · " + mArtist : "正在播放 · " + mArtist)
                .setSubText(mAlbum)
                .setSmallIcon(getSmallIcon())
                .setContentIntent(pi)
                .setOngoing(true)
                .setOnlyAlertOnce(true);

        try {
            nb.addAction(new Notification.Action(android.R.drawable.ic_media_previous, "上一词",
                    mediaPendingIntent("previoustrack", 11)));
            nb.addAction(new Notification.Action(
                    mPaused ? android.R.drawable.ic_media_play : android.R.drawable.ic_media_pause,
                    mPaused ? "播放" : "暂停",
                    mediaPendingIntent("playpause", 12)));
            nb.addAction(new Notification.Action(android.R.drawable.ic_media_next, "下一词",
                    mediaPendingIntent("nexttrack", 13)));
            Notification.MediaStyle style = new Notification.MediaStyle();
            if (mSession != null) style.setMediaSession(mSession.getSessionToken());
            style.setShowActionsInCompactView(0, 1, 2);
            nb.setStyle(style);
        } catch (Throwable e) {
            Log.w(TAG, "notification actions unavailable", e);
        }
        return nb.build();
    }

    private void updateNotification() {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            nm.notify(NOTIFY_ID, buildNotification());
        } catch (Throwable ignored) {
        }
    }

    private boolean mInForeground = false;

    private void startForegroundCompat() {
        if (mInForeground) return;
        try {
            Notification n = buildNotification();
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFY_ID, n,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFY_ID, n);
            }
            mInForeground = true;
        } catch (Throwable e) {
            Log.e(TAG, "startForeground failed", e);
        }
    }

    // ================= v2.64.0 Album 整库连续播放 =================
    private String mZhPendingUtt = "";   // 中文合成超时去重标记

    private void setAudioAttrs(MediaPlayer mp) {
        if (Build.VERSION.SDK_INT >= 21) {
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                    .build());
        } else {
            mp.setAudioStreamType(AudioManager.STREAM_MUSIC);
        }
    }

    private int safeGetPos() {
        try { if (mPlayer != null && mHasPlayed) return mPlayer.getCurrentPosition(); } catch (Throwable ignored) {}
        return 0;
    }

    private String uriEncode(String v) {
        try { return URLEncoder.encode(v == null ? "" : v, "UTF-8").replace("+", "%20"); }
        catch (Throwable e) { return v == null ? "" : v; }
    }

    private void initTts() {
        try {
            mTts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
                @Override
                public void onInit(int status) {
                    if (status == TextToSpeech.SUCCESS && mTts != null) {
                        int r = mTts.setLanguage(Locale.SIMPLIFIED_CHINESE);
                        mTtsReady = (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED);
                        if (mTtsReady) {
                            // v2.66.0：TTS 拟人化——略慢语速 + 自然音调 + 优先挑选中文女声嗓音
                            try { mTts.setSpeechRate(0.92f); } catch (Throwable ignored) {}
                            try { mTts.setPitch(1.02f); } catch (Throwable ignored) {}
                            try {
                                if (android.os.Build.VERSION.SDK_INT >= 21) {
                                    java.util.Set<android.speech.tts.Voice> vs = mTts.getVoices();
                                    if (vs != null) {
                                        android.speech.tts.Voice best = null;
                                        int bestScore = -1;
                                        for (android.speech.tts.Voice v : vs) {
                                            String nm = v.getName() == null ? "" : v.getName().toLowerCase();
                                            Locale vl = v.getLocale();
                                            if (vl == null || !"zh".equals(vl.getLanguage())) continue;
                                            int score = 0;
                                            if (nm.contains("xiaoxiao") || nm.contains("female") || nm.contains("xiaoyan")
                                                    || nm.contains("xiaoya")) score += 4;
                                            if (nm.contains("huawei") || nm.contains("google") || nm.contains("ifly")
                                                    || nm.contains("xiao") || nm.contains("yun")) score += 2;
                                            int q = 0;
                                            try {
                                                q = v.getQuality();
                                            } catch (Throwable ignored2) {}
                                            score += q;
                                            if (score > bestScore) { bestScore = score; best = v; }
                                        }
                                        if (best != null) mTts.setVoice(best);
                                    }
                                }
                            } catch (Throwable ignored) {}
                        }
                        try {
                            mTts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                                @Override public void onStart(String id) {}
                                @Override public void onDone(String id) {
                                    // v2.65.0：合成到文件的同步等待闩先放行
                                    releaseSynthLatch(id);
                                    onZhSynthesized(id);
                                }
                                @Override public void onError(String id) {
                                    releaseSynthLatch(id);
                                    onZhSynthesized(id);
                                }
                            });
                        } catch (Throwable ignored) {}
                    }
                }
            });
        } catch (Throwable ignored) {}
    }

    private void startAlbum(String json) {
        if (json == null || json.length() == 0) return;
        // v2.64.0：整库可能包含数百词，JSON 直接塞 Intent extra 会触发 Binder 事务上限
        // （TransactionTooLargeException）。因此由 JS 端写入缓存文件，这里按路径读取。
        if (json.startsWith("/") && new File(json).exists()) {
            try {
                java.io.FileInputStream fis = new java.io.FileInputStream(json);
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                byte[] bbuf = new byte[4096];
                int bn;
                while ((bn = fis.read(bbuf)) > 0) bos.write(bbuf, 0, bn);
                fis.close();
                json = new String(bos.toByteArray(), "UTF-8");
            } catch (Throwable e) {
                Log.e(TAG, "read album file failed", e);
                return;
            }
        }
        try {
            org.json.JSONObject root = new org.json.JSONObject(json);
            String name = root.optString("album", "\u9ad8\u8003\u8bcd\u6c47");
            float rate = (float) root.optDouble("rate", 1.0);
            org.json.JSONArray words = root.optJSONArray("words");
            if (words == null || words.length() == 0) return;
            ArrayList<AlbumWord> list = new ArrayList<AlbumWord>();
            for (int i = 0; i < words.length(); i++) {
                org.json.JSONObject o = words.getJSONObject(i);
                String w = o.optString("word", "");
                String m = o.optString("meaning", "");
                String e = o.optString("enUrl", "");
                String z = o.optString("zhText", m);
                if (w == null || w.length() == 0) continue;
                list.add(new AlbumWord(w, m, e, z));
            }
            if (list.isEmpty()) return;
            releasePlayer();
            mAlbumMode = true;
            mAlbumWords = list;
            mAlbumTotal = list.size();
            mAlbumName = name;
            mAlbumRate = Math.max(0.5f, Math.min(2.5f, rate));
            mAlbumIndex = 0;
            mAlbumBaseMs = 0;
            mPaused = false;
            mZhPendingUtt = "";
            mTitle = name;
            mArtist = list.get(0).word;
            ensureSession();
            updateSessionState(PlaybackState.STATE_PLAYING);
            updateNotification();
            // v2.66.0：向后预取音频（并发 6 线程），让后续词的中文也用上拟人配音、不至于边播边卡下载
            mPrefetchedUpto = -1;
            prefetchAhead(list, 0, Math.min(list.size(), 12));
            playAlbumWord(0);
        } catch (Throwable e) {
            Log.e(TAG, "startAlbum failed", e);
        }
    }

    private void playAlbumWord(final int idx) {
        if (!mAlbumMode) return;
        if (idx < 0 || idx >= mAlbumWords.size()) { finishAlbum(); return; }
        mAlbumIndex = idx;
        emit("", "album_index:" + idx);   // 通知 JS 当前词序号（高亮 / 序号显示）
        mAlbumBaseMs = idx * mAlbumAvgMs;
        mAlbumPendingNext = -1;
        AlbumWord w = mAlbumWords.get(idx);
        mArtist = w.word;
        mTitle = mAlbumName;
        updateNotification();
        updateSessionState(mPaused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING);
        // v2.66.0：按「朗读顺序 + 遍数」生成阶段序列并开始第一阶段
        if ("en".equals(mCfgOrder)) mAlbumSeq = new String[]{"en"};
        else if ("zh-en".equals(mCfgOrder)) mAlbumSeq = new String[]{"zh", "en"};
        else mAlbumSeq = new String[]{"en", "zh"};
        mAlbumSeqPos = 0;
        mAlbumRepCur = 0;
        runAlbumStage(idx);
    }

    /** 播放当前阶段（en / zh）的一遍 */
    private void runAlbumStage(final int idx) {
        if (!mAlbumMode || idx != mAlbumIndex || mAlbumSeq == null) return;
        if (mAlbumSeqPos >= mAlbumSeq.length) { afterAlbumWord(idx); return; }
        String st = mAlbumSeq[mAlbumSeqPos];
        if ("zh".equals(st)) {
            if (mCfgZhRepeat <= 0) { // 「中文不读」：跳过该阶段
                mAlbumSeqPos++;
                mAlbumRepCur = 0;
                runAlbumStage(idx);
                return;
            }
            playAlbumZh(idx);
        } else playAlbumEn(idx);
    }

    /** 一遍播完：未满遍数则再读一遍（含遍间隔），否则进入下一阶段 */
    private void onStageItemDone(final int idx) {
        if (!mAlbumMode || mAlbumIndex != idx || mAlbumSeq == null) return;
        mAlbumRepCur++;
        int reps = mAlbumRepCur;
        String st = mAlbumSeqPos < mAlbumSeq.length ? mAlbumSeq[mAlbumSeqPos] : "en";
        int need = "zh".equals(st) ? Math.max(0, mCfgZhRepeat) : Math.max(1, mCfgEnRepeat);
        if (reps < need) {
            gapThen(idx, mCfgInnerGapMs, new Runnable() {
                @Override public void run() { runAlbumStage(idx); }
            });
            return;
        }
        mAlbumSeqPos++;
        mAlbumRepCur = 0;
        if (mAlbumSeqPos >= mAlbumSeq.length) { afterAlbumWord(idx); return; }
        gapThen(idx, mCfgInnerGapMs, new Runnable() {
            @Override public void run() { runAlbumStage(idx); }
        });
    }

    /** 间隔 ms 后执行（暂停时不推进，恢复后继续） */
    private void gapThen(final int idx, int ms, final Runnable r) {
        final Runnable task = new Runnable() {
            @Override public void run() {
                if (!mAlbumMode || mAlbumIndex != idx) return;
                if (mPaused) { mAlbumPendingNext = idx; return; }
                r.run();
            }
        };
        if (ms <= 0) {
            if (mHandler != null) mHandler.post(task); else task.run();
        } else {
            mHandler.postDelayed(task, ms);
        }
    }

    private void playAlbumEn(final int idx) {
        if (!mAlbumMode || idx != mAlbumIndex || idx < 0 || idx >= mAlbumWords.size()) return;
        final AlbumWord w = mAlbumWords.get(idx);
        final File target = new File(mAlbumCacheDir, "en_" + w.key + ".mp3");
        Runnable play = new Runnable() {
            @Override public void run() {
                if (!mAlbumMode || mAlbumIndex != idx) return;
                if (target.exists() && target.length() > 200) {
                    playAlbumFile(target, new Runnable() {
                        @Override public void run() { onStageItemDone(idx); }
                    });
                } else if (w.enUrl != null && w.enUrl.length() > 0) {
                    playAlbumUrl(w.enUrl, new Runnable() {
                        @Override public void run() { onStageItemDone(idx); }
                    });
                } else {
                    onStageItemDone(idx);
                }
            }
        };
        if (target.exists() && target.length() > 200) play.run();
        else downloadToFile(w.enUrl, target, play);
    }

    /**
     * v2.66.0 拟人语音：优先真人配音，失败逐级回退，保证「一定有声音」。
     * 链：本地已缓存的网络配音 → 在线百度配音 → 手机自带语音引擎合成 → 有道网络音。
     */
    private void playAlbumZh(final int idx) {
        if (!mAlbumMode || idx != mAlbumIndex || idx < 0 || idx >= mAlbumWords.size()) return;
        final AlbumWord w = mAlbumWords.get(idx);
        final Runnable afterDone = new Runnable() { @Override public void run() { onStageItemDone(idx); } };
        if (w.zhText == null || w.zhText.length() == 0) { onStageItemDone(idx); return; }
        boolean wantNet = !"system".equals(mCfgZhSource);
        // ① 已预取到本地的神经语音（Edge 神经语音 / 百度配音，与整库合成线程共用缓存目录）→ 直接播，零延迟
        if (wantNet) {
            File edgeF = new File(mAlbumCacheDir, "zh_" + w.key + "_" + zhSuffix() + ".mp3");
            if (edgeF.exists() && edgeF.length() > 400) { playAlbumFile(edgeF, afterDone); return; }
            File netF = new File(mAlbumCacheDir, "zh_" + w.key + "_net.mp3");
            if (!(netF.exists() && netF.length() > 200)) netF = new File(mAlbumCacheDir, "zh_" + w.key + "_net0.mp3");
            if (!(netF.exists() && netF.length() > 200)) netF = new File(mAlbumCacheDir, "zh_" + w.key + "_yd.mp3");
            if (netF.exists() && netF.length() > 200) { playAlbumFile(netF, afterDone); return; }
        }
        // ② 在线 Edge 神经语音：子线程同步合成（约 1 秒），失败自动落到 ③ 百度 / ④ 系统语音
        if (wantNet) {
            new Thread(new Runnable() {
                @Override public void run() {
                    File ef = new File(mAlbumCacheDir, "zh_" + w.key + "_" + zhSuffix() + ".mp3");
                    boolean ok = edgeTtsToFile(w.zhText, edgeVoiceName(), edgeRatePct(), ef);
                    if (ok && mAlbumMode && mAlbumIndex == idx) {
                        mHandler.post(new Runnable() {
                            @Override public void run() {
                                if (!mAlbumMode || mAlbumIndex != idx) return;
                                File f2 = new File(mAlbumCacheDir, "zh_" + w.key + "_" + zhSuffix() + ".mp3");
                                if (f2.exists() && f2.length() > 400) {
                                    playAlbumFile(f2, afterDone);
                                    return;
                                }
                                playAlbumZhSystem(idx);
                            }
                        });
                        return;
                    }
                    // Edge 失败 → 百度在线配音（仍失败则 playAlbumZhSystem）
                    if (mAlbumMode && mAlbumIndex == idx && zhNetUrl(w.zhText) != null) {
                        final String nu = zhNetUrl(w.zhText);
                        mHandler.post(new Runnable() {
                            @Override public void run() {
                                if (!mAlbumMode || mAlbumIndex != idx) return;
                                playAlbumUrl(nu, afterDone, new Runnable() {
                                    @Override public void run() {
                                        if (!mAlbumMode || mAlbumIndex != idx) return;
                                        // 百度也失败 → 有道网络音 → 仍失败才落系统引擎
                                        String yu = youdaoZhUrl(w.zhText);
                                        if (yu != null) {
                                            playAlbumUrl(yu, afterDone, new Runnable() {
                                                @Override public void run() {
                                                    if (!mAlbumMode || mAlbumIndex != idx) return;
                                                    playAlbumZhSystem(idx);
                                                }
                                            });
                                        } else {
                                            playAlbumZhSystem(idx);
                                        }
                                    }
                                });
                            }
                        });
                        return;
                    }
                    if (mAlbumMode && mAlbumIndex == idx) {
                        mHandler.post(new Runnable() {
                            @Override public void run() {
                                if (!mAlbumMode || mAlbumIndex != idx) return;
                                playAlbumZhSystem(idx);
                            }
                        });
                    }
                }
            }, "edge-tts-play").start();
            return;
        }
        playAlbumZhSystem(idx);
    }

    /** ③ 手机自带语音引擎合成（再失败退回有道网络音） */
    private void playAlbumZhSystem(final int idx) {
        if (!mAlbumMode || idx != mAlbumIndex || idx < 0 || idx >= mAlbumWords.size()) return;
        final AlbumWord w = mAlbumWords.get(idx);
        final Runnable afterDone = new Runnable() { @Override public void run() { onStageItemDone(idx); } };
        if (mTtsReady && w.zhText != null && w.zhText.length() > 0) {
            final String utt = "zh_" + w.key;
            final File wav = new File(mAlbumCacheDir, utt + ".wav");
            try { if (wav.exists()) wav.delete(); } catch (Throwable ignored) {}
                releasePlayer();
                mZhPendingUtt = utt;
                try {
                    // synthesizeToFile(CharSequence, Bundle, File, String) 自 API 21 起可用；
                    // 旧的 (String, HashMap, File, String) 重载在 compileSdk 33（API 33）已移除，故统一用新重载。
                    mTts.synthesizeToFile(w.zhText, null, wav, utt);
                // 超时兜底：部分机型不回调 onDone，2.5s 后自行续播
                if (mHandler != null) mHandler.postDelayed(new Runnable() {
                    @Override public void run() {
                        if (!mAlbumMode || mAlbumIndex != idx) return;
                        if (mZhPendingUtt.equals(utt)) {
                            mZhPendingUtt = "";
                            if (wav.exists() && wav.length() > 0) {
                                playAlbumFile(wav, new Runnable() {
                                    @Override public void run() { onStageItemDone(idx); }
                                });
                            } else {
                                playAlbumUrl("https://dict.youdao.com/dictvoice?audio=" + uriEncode(w.zhText) + "&le=zh",
                                        new Runnable() { @Override public void run() { onStageItemDone(idx); } });
                            }
                        }
                    }
                }, 2500);
                return;
            } catch (Throwable e) {
                mZhPendingUtt = "";
            }
        }
        // 回退：网络中文语音（有道 le=zh）经 MediaPlayer 播放
        playAlbumUrl("https://dict.youdao.com/dictvoice?audio=" + uriEncode(w.zhText) + "&le=zh", afterDone);
    }

    private void onZhSynthesized(final String id) {
        if (!mAlbumMode) return;
        if (mHandler != null) {
            mHandler.post(new Runnable() {
                @Override public void run() {
                    if (!mZhPendingUtt.equals(id)) return; // 已被超时逻辑消费
                    mZhPendingUtt = "";
                    File wav = new File(mAlbumCacheDir, id + ".wav");
                    if (wav.exists() && wav.length() > 0) {
                        final int idx = mAlbumIndex;
                        playAlbumFile(wav, new Runnable() {
                            @Override public void run() { afterAlbumWord(idx); }
                        });
                    } else {
                        afterAlbumWord(mAlbumIndex);
                    }
                }
            });
        }
    }

    private void afterAlbumWord(final int idx) {
        if (!mAlbumMode || idx != mAlbumIndex) return;
        final int next = idx + 1;
        if (next >= mAlbumWords.size()) { finishAlbum(); return; }
        // v2.66.0：词间间隔改用 JS 下发的 wordGap（之前写死估算值 → 改词间秒数没反应）
        mHandler.postDelayed(new Runnable() {
            @Override public void run() {
                if (!mAlbumMode || mAlbumIndex != idx) return;
                if (mPaused) { mAlbumPendingNext = next; return; }
                playAlbumWord(next);
            }
        }, mCfgWordGapMs);
        prefetchAhead(mAlbumWords, next, next + 8); // 滚动预取后续词音频
    }

    private void playAlbumFile(final File fx, final Runnable onDone) {
        releasePlayer();
        requestFocus();
        acquireWakeLock();
        try {
            mPlayer = new MediaPlayer();
            setAudioAttrs(mPlayer);
            mPlayer.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mPlayer.setDataSource(fx.getAbsolutePath());
            mPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override public void onPrepared(MediaPlayer mp) {
                    mHasPlayed = true;
                    applyRateAlbum();
                    try { if (!mPaused) mp.start(); } catch (Throwable e) { if (onDone != null) onDone.run(); }
                }
            });
            mPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer mp) { if (onDone != null) onDone.run(); }
            });
            mPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override public boolean onError(MediaPlayer mp, int what, int extra) { if (onDone != null) onDone.run(); return true; }
            });
            mPlayer.prepareAsync();
        } catch (Throwable e) {
            if (onDone != null) onDone.run();
        }
    }

    private void playAlbumUrl(final String url, final Runnable onDone) {
        playAlbumUrl(url, onDone, null);
    }

    /** playAlbumUrl 带失败回调版本（v2.66.0：网络配音失败时用于继续回退，避免整链卡死） */
    private void playAlbumUrl(final String url, final Runnable onDone, final Runnable onFail) {
        if (url == null || url.length() == 0) { if (onDone != null) onDone.run(); return; }
        releasePlayer();
        requestFocus();
        acquireWakeLock();
        try {
            mPlayer = new MediaPlayer();
            setAudioAttrs(mPlayer);
            mPlayer.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mPlayer.setDataSource(url);
            mPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override public void onPrepared(MediaPlayer mp) {
                    mHasPlayed = true;
                    applyRateAlbum();
                    try { if (!mPaused) mp.start(); } catch (Throwable e) {
                        if (onFail != null) onFail.run(); else if (onDone != null) onDone.run();
                    }
                }
            });
            mPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer mp) { if (onDone != null) onDone.run(); }
            });
            mPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override public boolean onError(MediaPlayer mp, int what, int extra) {
                    if (onFail != null) onFail.run(); else if (onDone != null) onDone.run();
                    return true;
                }
            });
            mPlayer.prepareAsync();
        } catch (Throwable e) {
            if (onFail != null) onFail.run(); else if (onDone != null) onDone.run();
        }
    }

    private void downloadToFile(final String url, final File target, final Runnable onDone) {
        if (url == null || url.length() == 0) { if (onDone != null) onDone.run(); return; }
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    URL u = new URL(url);
                    HttpURLConnection c = (HttpURLConnection) u.openConnection();
                    c.setConnectTimeout(15000);
                    c.setReadTimeout(20000);
                    c.setRequestProperty("User-Agent", "Mozilla/5.0");
                    c.connect();
                    InputStream in = new BufferedInputStream(c.getInputStream());
                    FileOutputStream out = new FileOutputStream(target);
                    byte[] buf = new byte[8192];
                    int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    out.close();
                    in.close();
                    c.disconnect();
                } catch (Throwable e) {
                    try { if (target != null && target.exists()) target.delete(); } catch (Throwable ignored) {}
                }
                if (mHandler != null) mHandler.post(onDone);
                else if (onDone != null) onDone.run();
            }
        }).start();
    }

    private void finishAlbum() {
        mAlbumMode = false;
        mPaused = true;
        mZhPendingUtt = "";
        releasePlayer();
        updateSessionState(PlaybackState.STATE_PAUSED);
        updateNotification();
        emit("", "album_end");
    }

    private void stopAlbumWord() {
        mAlbumPendingNext = -1;
        mZhPendingUtt = "";
        releasePlayer();
        if (mTts != null) { try { mTts.stop(); } catch (Throwable ignored) {} }
    }

    private void applyRateAlbum() {
        if (mPlayer == null) return;
        if (Build.VERSION.SDK_INT < 23) return;
        try {
            float r = Math.max(0.5f, Math.min(2.5f, mAlbumRate));
            android.media.PlaybackParams p = new android.media.PlaybackParams();
            p.setSpeed(r);
            mPlayer.setPlaybackParams(p);
        } catch (Throwable ignored) {}
    }

    private void updateAlbumState(int state, int pos, int dur) {
        if (mSession == null) return;
        try {
            PlaybackState.Builder b = new PlaybackState.Builder();
            long actions = PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_PLAY_PAUSE | PlaybackState.ACTION_STOP
                    | PlaybackState.ACTION_SKIP_TO_NEXT | PlaybackState.ACTION_SKIP_TO_PREVIOUS;
            if (dur > 0) actions |= PlaybackState.ACTION_SEEK_TO;
            b.setActions(actions);
            if (Build.VERSION.SDK_INT >= 29) b.setState(state, pos, mPaused ? 0f : mAlbumRate, System.currentTimeMillis());
            else b.setState(state, pos, mPaused ? 0f : 1f);
            mSession.setPlaybackState(b.build());
            MediaMetadata.Builder mb = new MediaMetadata.Builder();
            mb.putString(MediaMetadata.METADATA_KEY_TITLE, mAlbumName);
            mb.putString(MediaMetadata.METADATA_KEY_ARTIST, mArtist);
            mb.putString(MediaMetadata.METADATA_KEY_ALBUM, "\u80cc\u7fa4\u82f1 \u00b7 \u542c\u8bfb");
            mb.putLong(MediaMetadata.METADATA_KEY_DURATION, dur);
            mSession.setMetadata(mb.build());
        } catch (Throwable ignored) {}
    }

    // ================= v2.65.0 File Album：整库合成单一 WAV 文件 =================

    /** 读取整库 JSON（传路径则按路径读文件，规避 Binder 事务上限） */
    private String readAlbumJson(String json) {
        if (json == null || json.length() == 0) return null;
        if (json.startsWith("/") && new File(json).exists()) {
            try {
                java.io.FileInputStream fis = new java.io.FileInputStream(json);
                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
                byte[] bbuf = new byte[4096];
                int bn;
                while ((bn = fis.read(bbuf)) > 0) bos.write(bbuf, 0, bn);
                fis.close();
                return new String(bos.toByteArray(), "UTF-8");
            } catch (Throwable e) {
                Log.e(TAG, "read album file failed", e);
                return null;
            }
        }
        return json;
    }

    /** v2.65.0 入口：解析整库 JSON → 命中缓存直接播 → 否则后台合成单一 WAV */
    private void startAlbumFile(String json) {
        String parsed = readAlbumJson(json);
        if (parsed == null) return;
        try {
            org.json.JSONObject root = new org.json.JSONObject(parsed);
            String name = root.optString("album", "\u9ad8\u8003\u8bcd\u6c47");
            float rate = (float) root.optDouble("rate", 1.0);
            String loop = root.optString("loop", "list");
            // v2.66.0：听读参数全量下发。—— 这是「参数设置无效」的根因修复：
            // 之前 buildAlbumJson 只传 rate/loop，其余一律按写死值生成，用户改了毫无变化。
            mCfgEnRepeat = Math.max(1, Math.min(5, root.optInt("enRepeat", 1)));
            mCfgZhRepeat = Math.max(0, Math.min(3, root.optInt("zhRepeat", 1)));
            mCfgOrder = root.optString("order", "en-zh");
            if (!"zh-en".equals(mCfgOrder) && !"en".equals(mCfgOrder)) mCfgOrder = "en-zh";
            mCfgInnerGapMs = Math.max(0, Math.min(3000, root.optInt("innerGapMs", 600)));
            mCfgWordGapMs = Math.max(0, Math.min(9000, root.optInt("wordGapMs", 2000)));
            mCfgZhSource = "system".equals(root.optString("zhSource", "net")) ? "system" : "net";
            mCfgZhVoice = Math.max(0, Math.min(9, root.optInt("zhVoice", 0)));
            org.json.JSONArray words = root.optJSONArray("words");
            if (words == null || words.length() == 0) return;
            ArrayList<AlbumWord> list = new ArrayList<AlbumWord>();
            StringBuilder keySrc = new StringBuilder();
            // 缓存键 = 词库 + 全部朗读参数（但不含 rate：语速由播放器实时变速，改语速无需重新合成）
            keySrc.append(name)
                    .append('|').append(mCfgEnRepeat)
                    .append('|').append(mCfgZhRepeat)
                    .append('|').append(mCfgOrder)
                    .append('|').append(mCfgInnerGapMs)
                    .append('|').append(mCfgWordGapMs)
                    .append('|').append(mCfgZhSource)
                    .append('|').append(mCfgZhVoice);
            for (int i = 0; i < words.length(); i++) {
                org.json.JSONObject o = words.getJSONObject(i);
                String w = o.optString("word", "");
                String m = o.optString("meaning", "");
                String e = o.optString("enUrl", "");
                String z = o.optString("zhText", m);
                if (w == null || w.length() == 0) continue;
                list.add(new AlbumWord(w, m, e, z));
                keySrc.append('|').append(w).append('/').append(z);
            }
            if (list.isEmpty()) return;
            final String key = sha1(keySrc.toString());
            final File fin = new File(mAlbumWavDir, key + ".wav");
            final File idxF = new File(mAlbumWavDir, key + ".idx");
            // 停掉旧播放 / 旧合成（旧构建线程检测到 gen 变化会自行退出）
            mBuildGen++;
            stopAlbumWord();
            releasePlayer();
            mAlbumWords = list;
            mAlbumTotal = list.size();
            mAlbumName = name;
            mAlbumRate = Math.max(0.5f, Math.min(2.5f, rate));
            mFileRate = mAlbumRate;
            mFileLoop = !"off".equals(loop);
            mFileOut = fin;
            ensureSession();
            // ① 整库音频已存在（同词库 + 同参数）：直接用单个文件播放，真实进度条 / 可拖动 / 可上下首
            if (fin.exists() && fin.length() > 1000 && idxF.exists() && loadFileStarts(idxF, list.size())) {
                mAlbumMode = true;
                mFileMode = true;
                mAlbumIndex = 0;
                mFileIndex = -1;
                mPaused = false;
                mZhPendingUtt = "";
                mTitle = name;
                mArtist = list.get(0).word;
                playBuiltFile(fin);
                return;
            }
            // ② 首次播放该参数组合：先用逐词模式【立即出声】（不再让用户干等整库合成），
            //    同时后台静默合成整库音频，下次进入同一词库即获得单文件播放能力。
            mAlbumMode = true;
            mFileMode = false;
            mAlbumIndex = 0;
            mPaused = false;
            mZhPendingUtt = "";
            mFileStarts = new long[list.size()];
            mBuildCancel = false;
            final ArrayList<AlbumWord> fList = list;
            final int gen = mBuildGen;
            final String jsonToStart = parsed;
            mPrefetchedUpto = -1;
            startAlbum(jsonToStart);
            mBuildThread = new Thread(new Runnable() {
                @Override public void run() { buildAlbumWav(gen, fList, fin, idxF); }
            }, "album-build");
            mBuildThread.start();
            emit("", "album_build_start");
        } catch (Throwable e) {
            Log.e(TAG, "startAlbumFile failed", e);
        }
    }

    /** 中文音频文件名后缀：区分不同发音源 / 音色，避免切源后复用错预取缓存 */
    private String zhSuffix() {
        return ("system".equals(mCfgZhSource) ? "sys" : "e" + mCfgZhVoice);
    }

    /* ==================================================================
       v2.68.0 微软 Edge 神经语音（与 Edge 浏览器朗读同源，番茄小说级音质）
       旧方案 fanyi.baidu.com/gettts 的 per 音色参数实测无效（不同音色返回
       完全相同的音频），这就是「中文听着还是机器味」的根因。
       Edge TTS 是真正的神经网络音色：晓晓 / 云希 / 晓伊，断网或接口失败
       自动回退 百度配音 → 手机自带语音引擎，保证一定有声音。
       ================================================================== */
    private static final String EDGE_HOST = "speech.platform.bing.com";
    private static final String EDGE_PATH = "/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";
    private static final String EDGE_GEC_VERSION = "1-141.0.2279.2";
    private static final String EDGE_ORIGIN = "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold";
    private static final String EDGE_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";

    /** 音色映射：zhVoice 0 晓晓（女·自然·推荐） / 3 云希（男声） / 4 晓伊（女·活力） */
    private String edgeVoiceName() {
        if (mCfgZhVoice == 3) return "zh-CN-YunxiNeural";
        if (mCfgZhVoice == 4) return "zh-CN-XiaoyiNeural";
        return "zh-CN-XiaoxiaoNeural";
    }

    /** 语速 → Edge SSML 的 rate 百分比（例如 1.25x → +25%） */
    private String edgeRatePct() {
        int pct = Math.round((mAlbumRate - 1f) * 100);
        return (pct >= 0 ? "+" : "") + pct + "%";
    }

    private static byte[] edgeRandomBytes(int n) {
        byte[] b = new byte[n];
        new java.util.Random().nextBytes(b);
        return b;
    }

    private static String edgeRandomHex(int n) {
        char[] hex = "0123456789abcdef".toCharArray();
        StringBuilder sb = new StringBuilder(n);
        java.util.Random r = new java.util.Random();
        for (int i = 0; i < n; i++) sb.append(hex[r.nextInt(16)]);
        return sb.toString();
    }

    private static String edgeTimestamp() {
        try {
            return new java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
                    .format(new java.util.Date());
        } catch (Throwable e) {
            return "2026-01-01T00:00:00.000Z";
        }
    }

    private static String edgeReadLine(java.io.InputStream is) throws java.io.IOException {
        StringBuilder sb = new StringBuilder();
        while (true) {
            int c = is.read();
            if (c < 0) return sb.length() == 0 ? null : sb.toString();
            if (c == '\n') return sb.toString().replaceAll("\r$", "");
            sb.append((char) c);
        }
    }

    private static String edgeXmlEscape(String s) {
        if (s == null) return "";
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&apos;");
    }

    /** Edge TTS 鉴权：Sec-MS-GEC = SHA256(向下取整到5分钟的Windows文件时间 + TrustedClientToken) 大写十六进制 */
    private static String edgeSecGec() {
        try {
            long seconds = System.currentTimeMillis() / 1000L + 11644473600L;
            seconds -= seconds % 300;
            String input = (seconds * 10000000L) + "6A5AA1D4EAFF4E9FB37E23D68491D6F4";
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(input.getBytes("US-ASCII"));
            StringBuilder sb = new StringBuilder(d.length * 2);
            for (byte b : d) sb.append(String.format("%02X", b));
            return sb.toString();
        } catch (Throwable e) {
            return "";
        }
    }

    /** 写一帧 WebSocket 文本帧（客户端帧必须带掩码） */
    private static void edgeWsWriteText(java.io.OutputStream os, String text) throws java.io.IOException {
        byte[] data = text.getBytes("UTF-8");
        byte[] mask = edgeRandomBytes(4);
        java.io.ByteArrayOutputStream h = new java.io.ByteArrayOutputStream();
        h.write(0x81); // FIN + text
        int len = data.length;
        if (len < 126) {
            h.write(0x80 | len);
        } else if (len < 65536) {
            h.write(0x80 | 126);
            h.write((len >> 8) & 0xff);
            h.write(len & 0xff);
        } else {
            h.write(0x80 | 127);
            for (int i = 7; i >= 0; i--) h.write((i < 4) ? 0 : 0); // 4GB 内不会走到这里
        }
        h.write(mask, 0, 4);
        for (int i = 0; i < len; i++) data[i] = (byte) (data[i] ^ mask[i & 3]);
        os.write(h.toByteArray());
        os.write(data);
        os.flush();
    }

    /** 读一帧 WebSocket 帧头，返回 [opcode, len]；连接关闭返回 null */
    private static int[] edgeWsReadHeader(java.io.InputStream is) throws java.io.IOException {
        int b1 = is.read();
        if (b1 < 0) return null;
        int b2 = is.read();
        if (b2 < 0) return null;
        int opcode = b1 & 0x0f;
        long len = b2 & 0x7f;
        if (len == 126) {
            int a = is.read(), b = is.read();
            if (a < 0 || b < 0) return null;
            len = ((a & 0xff) << 8) | (b & 0xff);
        } else if (len == 127) {
            len = 0;
            for (int i = 0; i < 8; i++) {
                int c = is.read();
                if (c < 0) return null;
                len = (len << 8) | (c & 0xff);
            }
        }
        if (len > 8 * 1024 * 1024) return null;
        return new int[]{opcode, (int) len};
    }

    /**
     * 微软 Edge 神经语音合成：成功把 MP3 写入 out 并返回 true；失败返回 false。
     * 走 Edge 浏览器同款 WebSocket 接口，24kHz 神经音色，无需任何账号鉴权。
     */
    private boolean edgeTtsToFile(String text, String voice, String ratePct, File out) {
        javax.net.ssl.SSLSocket sock = null;
        try {
            javax.net.ssl.SSLSocketFactory f =
                    (javax.net.ssl.SSLSocketFactory) javax.net.ssl.SSLSocketFactory.getDefault();
            sock = (javax.net.ssl.SSLSocket) f.createSocket(EDGE_HOST, 443);
            sock.setSoTimeout(8000);
            sock.startHandshake();
            java.io.OutputStream os = sock.getOutputStream();
            java.io.InputStream is = new java.io.BufferedInputStream(sock.getInputStream());

            String gec = edgeSecGec();
            String req = "GET " + EDGE_PATH + "&ConnectionId=" + edgeRandomHex(32)
                    + (gec.length() > 0 ? "&Sec-MS-GEC=" + gec + "&Sec-MS-GEC-Version=" + EDGE_GEC_VERSION : "")
                    + " HTTP/1.1\r\n"
                    + "Host: " + EDGE_HOST + "\r\n"
                    + "Connection: Upgrade\r\n"
                    + "Upgrade: websocket\r\n"
                    + "Sec-WebSocket-Key: " + android.util.Base64.encodeToString(edgeRandomBytes(16), android.util.Base64.NO_WRAP)
                    + "\r\n"
                    + "Sec-WebSocket-Version: 13\r\n"
                    + "Origin: " + EDGE_ORIGIN + "\r\n"
                    + "User-Agent: " + EDGE_UA + "\r\n"
                    + "Pragma: no-cache\r\n"
                    + "Cache-Control: no-cache\r\n\r\n";
            os.write(req.getBytes("UTF-8"));
            os.flush();

            String status = edgeReadLine(is);
            if (status == null || !status.contains("101")) return false;
            while (true) {
                String l = edgeReadLine(is);
                if (l == null || l.length() == 0) break;
            }

            String ts = edgeTimestamp();
            String cfg = "X-Timestamp:" + ts + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n"
                    + "{\"context\":{\"synthesis\":{\"audio\":{\"metadataoptions\":"
                    + "{\"sentenceBoundaryEnabled\":\"false\",\"wordBoundaryEnabled\":\"false\"},"
                    + "\"outputFormat\":\"audio-24khz-48kbitrate-mono-mp3\"}}}}";
            edgeWsWriteText(os, cfg);

            String ssml = "X-RequestId:" + edgeRandomHex(16) + "\r\nContent-Type:application/ssml+xml\r\n"
                    + "X-Timestamp:" + ts + "Z\r\nPath:ssml\r\n\r\n"
                    + "<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>"
                    + "<voice name='" + voice + "'>"
                    + "<prosody rate='" + ratePct + "' pitch='+0Hz' volume='+0%'>"
                    + edgeXmlEscape(text)
                    + "</prosody></voice></speak>";
            edgeWsWriteText(os, ssml);

            java.io.FileOutputStream fos = new java.io.FileOutputStream(out);
            boolean gotAudio = false;
            long deadline = System.currentTimeMillis() + 12000;
            while (System.currentTimeMillis() < deadline) {
                int[] hd = edgeWsReadHeader(is);
                if (hd == null) break;
                int opcode = hd[0];
                int len = hd[1];
                byte[] payload = new byte[len];
                int off = 0;
                while (off < len) {
                    int n = is.read(payload, off, len - off);
                    if (n < 0) { off = -1; break; }
                    off += n;
                }
                if (off < len) break;
                if (opcode == 8) break;
                if (opcode == 2 && len > 2) {
                    int hl = ((payload[0] & 0xff) << 8) | (payload[1] & 0xff);
                    String headers = new String(payload, 2, hl, "UTF-8");
                    if (headers.contains("Path:turn.end")) break;
                    if (headers.contains("Path:audio")) {
                        fos.write(payload, 2 + hl, len - 2 - hl);
                        gotAudio = true;
                    }
                }
            }
            fos.flush();
            fos.close();
            return gotAudio && out.exists() && out.length() > 400;
        } catch (Throwable e) {
            try { if (out != null) out.delete(); } catch (Throwable ignored) {}
            return false;
        } finally {
            try { if (sock != null) sock.close(); } catch (Throwable ignored) {}
        }
    }

    /** 网络真人配音 URL（百度翻译 TTS，per 指定音色：0 度小娇女声 / 3 度逍遥 / 4 度丫丫） */
    private String zhNetUrl(String text) {
        try {
            return "https://fanyi.baidu.com/gettts?lan=zh&text=" + URLEncoder.encode(text, "UTF-8")
                    + "&spd=3&per=" + mCfgZhVoice + "&source=web";
        } catch (Throwable e) {
            return null;
        }
    }

    /** 有道中文网络发音（Edge / 百度都失败时的第三级在线兜底） */
    private String youdaoZhUrl(String text) {
        try {
            return "https://dict.youdao.com/dictvoice?audio=" + URLEncoder.encode(text, "UTF-8") + "&le=zh";
        } catch (Throwable e) {
            return null;
        }
    }

    /** 确保英文发音文件就绪（本地已有则秒返回；否则下载） */
    private boolean ensureEnAudio(AlbumWord w) {
        File enF = new File(mAlbumCacheDir, "en_" + w.key + ".mp3");
        if (enF.exists() && enF.length() > 200) return true;
        if (w.enUrl == null || w.enUrl.length() == 0) return false;
        return downloadToFileSync(w.enUrl, enF);
    }

    /** 确保中文发音文件就绪（拟人优先：Edge 神经语音 → 百度配音 → 本地语音引擎） */
    private boolean ensureZhAudio(AlbumWord w) {
        if (w.zhText == null || w.zhText.length() == 0) return false;
        String suf = zhSuffix();
        if (!"system".equals(mCfgZhSource)) {
            File edge = new File(mAlbumCacheDir, "zh_" + w.key + "_" + suf + ".mp3");
            if (edge.exists() && edge.length() > 400) return true;
            if (edgeTtsToFile(w.zhText, edgeVoiceName(), "+0%", edge)) return true;
            File net = new File(mAlbumCacheDir, "zh_" + w.key + "_net.mp3");
            if (net.exists() && net.length() > 200) return true;
            if (zhNetUrl(w.zhText) != null && downloadToFileSync(zhNetUrl(w.zhText), net)) return true;
            File yd = new File(mAlbumCacheDir, "zh_" + w.key + "_yd.mp3");
            if (youdaoZhUrl(w.zhText) != null && downloadToFileSync(youdaoZhUrl(w.zhText), yd)) return true;
        }
        File sys = new File(mAlbumCacheDir, "zh_" + w.key + "_sys.wav");
        if (sys.exists() && sys.length() > 44) return true;
        return synthZhSync(w.zhText, sys);
    }

    /** 把已就绪的中文音频追加到输出流：先试当前发音源，再试另一种 */
    private boolean appendZhAudio(java.io.RandomAccessFile out, AlbumWord w) {
        String suf = zhSuffix();
        File edge = new File(mAlbumCacheDir, "zh_" + w.key + "_" + suf + ".mp3");
        if (edge.exists() && edge.length() > 400 && appendAudioPcm(out, edge)) return true;
        File net = new File(mAlbumCacheDir, "zh_" + w.key + "_net.mp3");
        if (net.exists() && net.length() > 200 && appendAudioPcm(out, net)) return true;
        File anyNet = new File(mAlbumCacheDir, "zh_" + w.key + "_net0.mp3");
        if (anyNet.exists() && anyNet.length() > 200 && appendAudioPcm(out, anyNet)) return true;
        File yd = new File(mAlbumCacheDir, "zh_" + w.key + "_yd.mp3");
        if (yd.exists() && yd.length() > 200 && appendAudioPcm(out, yd)) return true;
        File sys = new File(mAlbumCacheDir, "zh_" + w.key + "_sys.wav");
        if (sys.exists() && sys.length() > 44 && appendWavPcm(out, sys)) return true;
        return false;
    }

    /** 为后续词并发预取音频（6 线程），把整库合成耗时从「串行下载」降到接近纯解码 */
    private void prefetchAhead(final ArrayList<AlbumWord> list, int from, int to) {
        if (list == null || list.isEmpty()) return;
        if (to > list.size()) to = list.size();
        if (from < 0) from = 0;
        if (to <= mPrefetchedUpto) return;           // 这段早就备好了
        if (from <= mPrefetchedUpto) from = mPrefetchedUpto + 1;
        if (from >= to) return;
        mPrefetchedUpto = to - 1;                    // 先占位，避免同一批被重复提交
        if (mPrefetchPool == null) {
            try {
                mPrefetchPool = java.util.concurrent.Executors.newFixedThreadPool(6);
            } catch (Throwable ignored) { mPrefetchedUpto = from - 1; return; }
        }
        for (int i = from; i < to && i < list.size(); i++) {
            final AlbumWord w = list.get(i);
            try {
                mPrefetchPool.submit(new Runnable() {
                    @Override public void run() {
                        try { ensureEnAudio(w); } catch (Throwable ignored) {}
                        try { ensureZhAudio(w); } catch (Throwable ignored) {}
                    }
                });
            } catch (Throwable ignored) {}
        }
    }

    /** 后台合成：按听读参数拼接「英文 × N遍 + 中文 × M遍 + 间隔」→ 单个 PCM/WAV 文件 */
    private void buildAlbumWav(final int gen, final ArrayList<AlbumWord> list, final File fin, final File idxF) {
        File tmp = new File(mAlbumWavDir, fin.getName() + ".tmp");
        java.io.RandomAccessFile raf = null;
        final long[] starts = new long[list.size()];
        try {
            raf = new java.io.RandomAccessFile(tmp, "rw");
            raf.setLength(0);
            raf.seek(44); // 先留 44 字节 WAV 头
            int n = list.size();
            prefetchAhead(list, 0, Math.min(n, 12)); // 先把前面的备好，第一词几乎立刻出声
            for (int i = 0; i < n; i++) {
                if (mBuildCancel || gen != mBuildGen) {
                    try { raf.close(); } catch (Throwable ignored) {}
                    try { tmp.delete(); } catch (Throwable ignored) {}
                    return;
                }
                AlbumWord w = list.get(i);
                prefetchAhead(list, i + 1, i + 9); // 持续向后预取
                starts[i] = currentOutMs(raf);
                // —— 依「朗读顺序」生成本词的音段 ——
                boolean enSilent = false;
                boolean zhSilent = false;
                for (int rep = 0; rep < mCfgEnRepeat; rep++) {
                    File enF = new File(mAlbumCacheDir, "en_" + w.key + ".mp3");
                    boolean ok = (enF.exists() && enF.length() > 200) || ensureEnAudio(w);
                    if (ok) ok = appendAudioPcm(raf, enF);
                    if (!ok) { enSilent = true; appendSilence(raf, 700); }
                    if (rep < mCfgEnRepeat - 1 && mCfgInnerGapMs > 0) appendSilence(raf, mCfgInnerGapMs);
                }
                if (!"en".equals(mCfgOrder) && mCfgZhRepeat > 0) {
                    if (mCfgInnerGapMs > 0 && !enSilent) appendSilence(raf, mCfgInnerGapMs);
                    for (int rep = 0; rep < mCfgZhRepeat; rep++) {
                        boolean ok = appendZhAudio(raf, w) || (ensureZhAudio(w) && appendZhAudio(raf, w));
                        if (!ok) { zhSilent = true; appendSilence(raf, 600); }
                        if (rep < mCfgZhRepeat - 1 && mCfgInnerGapMs > 0) appendSilence(raf, mCfgInnerGapMs);
                    }
                }
                if (enSilent && zhSilent) {
                    // 两端都取不到音频：说明该词发音资源缺失，留足答疑空白避免整段错位
                }
                // —— 词间间隔 ——
                appendSilence(raf, mCfgWordGapMs);
                final int done = i + 1;
                mHandler.post(new Runnable() {
                    @Override public void run() {
                        if (gen != mBuildGen) return;
                        emit("", "album_build:" + done + "/" + mAlbumTotal);
                    }
                });
            }
            writeWavHeader(raf);
            raf.close();
            raf = null;
            if (!fin.exists() || !tmp.renameTo(fin)) {
                // rename 失败（个别机型跨文件系统）→ 复制兜底
                java.io.FileInputStream in = new java.io.FileInputStream(tmp);
                java.io.FileOutputStream out = new java.io.FileOutputStream(fin);
                byte[] b = new byte[16384];
                int nn;
                while ((nn = in.read(b)) > 0) out.write(b, 0, nn);
                in.close();
                out.close();
                tmp.delete();
            }
            // 写词起始毫秒索引（重播 / 跳词用）
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < n; i++) {
                if (i > 0) sb.append(',');
                sb.append(starts[i]);
            }
            java.io.FileOutputStream fo = new java.io.FileOutputStream(idxF);
            fo.write(sb.toString().getBytes("UTF-8"));
            fo.close();
            final File fout = fin;
            final long[] fStarts = starts;
            final ArrayList<AlbumWord> fWords = list;
            mHandler.post(new Runnable() {
                @Override public void run() {
                    if (gen != mBuildGen) return;
                    mFileStarts = fStarts;
                    mFileOut = fout;
                    if (mAlbumWords == fWords || mAlbumWords == null || mAlbumWords.isEmpty()) mAlbumWords = fWords;
                    if (!mAlbumMode) { emit("", "album_file_ready"); return; }
                    if (mFileMode) { playBuiltFile(fout); return; }
                    // 逐词模式正在响：无缝切到整库文件，从当前词所在偏移接续，听众几乎无感
                    int resumeIdx = Math.max(0, Math.min(fStarts.length - 1, mAlbumIndex));
                    stopAlbumWord();
                    mFileMode = true;
                    playBuiltFileAt(fout, resumeIdx);
                }
            });
        } catch (Throwable e) {
            Log.e(TAG, "buildAlbumWav failed", e);
            try { if (raf != null) raf.close(); } catch (Throwable ignored) {}
            try { tmp.delete(); } catch (Throwable ignored) {}
            mHandler.post(new Runnable() {
                @Override public void run() {
                    if (gen != mBuildGen) return;
                    if (mFileMode) {
                        mArtist = "\u5408\u6210\u5931\u8d25"; // 合成失败
                        updateNotification();
                        emit("", "album_build_fail");
                    } else {
                        emit("", "album_file_ready"); // 逐词模式照常在响，不让用户察觉失败
                    }
                }
            });
        }
    }

    /** 用单个 MediaPlayer 播放整库 WAV（MediaSession 拥有真实时长，可拖动进度） */
    private void playBuiltFile(final File f) {
        playBuiltFileAt(f, 0);
    }

    /** 从指定毫秒处起播整库 WAV（合成完成后从当前词无缝接续） */
    private void playBuiltFileAt(final File f, final int startMs) {
        releasePlayer();
        requestFocus();
        acquireWakeLock();
        try {
            mPlayer = new MediaPlayer();
            setAudioAttrs(mPlayer);
            mPlayer.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mPlayer.setDataSource(f.getAbsolutePath());
            final int from = startMs > 0 ? startMs : 0;
            mPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override public void onPrepared(MediaPlayer mp) {
                    mHasPlayed = true;
                    mPaused = false;
                    mDuration = 0;
                    mRate = mAlbumRate; // v2.65.0：整库语速同步到通用字段，变速/暂停恢复一致
                    applyRate(); // 变速需 API 23+，低版本原速播放
                    try { mDuration = mp.getDuration(); } catch (Throwable ignored) {}
                    try { if (from > 0) mp.seekTo(from); } catch (Throwable ignored) {}
                    try { mp.start(); } catch (Throwable ignored) {}
                    mFileIndex = -1;
                    syncFileWordIndex(from);
                    try { int k = Math.max(0, mFileIndex); if (mAlbumWords != null && k < mAlbumWords.size()) mArtist = mAlbumWords.get(k).word; } catch (Throwable ignored) {}
                    emit("", "album_index:" + Math.max(0, mFileIndex));
                    emit("", "album_file_ready");
                    updateNotification();
                    updateSessionState(PlaybackState.STATE_PLAYING);
                }
            });
            mPlayer.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
                @Override public void onCompletion(MediaPlayer mp) {
                    if (mFileLoop && mFileOut != null && mFileOut.exists()) {
                        try { mp.seekTo(0); mp.start(); } catch (Throwable ignored) {}
                        updateSessionState(PlaybackState.STATE_PLAYING);
                    } else {
                        finishAlbumFile();
                    }
                }
            });
            mPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override public boolean onError(MediaPlayer mp, int what, int extra) {
                    Log.e(TAG, "album wav error what=" + what + " extra=" + extra);
                    emit("", "album_end"); // 通知 JS 复位（可回退逐词模式）
                    finishAlbumFile();
                    return true;
                }
            });
            mPlayer.prepareAsync();
        } catch (Throwable e) {
            Log.e(TAG, "playBuiltFile failed", e);
            emit("", "album_end");
        }
    }

    private void finishAlbumFile() {
        mPaused = true;
        releasePlayer();
        updateSessionState(PlaybackState.STATE_PAUSED);
        updateNotification();
        emit("", "album_end");
    }

    /** 跳到第 idx 个词（按词起始毫秒真实 seek） */
    private void seekFileToWord(int idx) {
        if (!mFileMode || mFileStarts == null || mAlbumWords == null || mAlbumWords.isEmpty()) return;
        if (idx < 0) idx = 0;
        if (idx >= mAlbumWords.size()) idx = mAlbumWords.size() - 1;
        if (mPlayer == null || !mHasPlayed) return;
        int ms = (int) mFileStarts[idx];
        seekInternal(ms);
        syncFileWordIndex(ms);
    }

    /** 按播放位置推算当前词；序号变化时更新通知并回传 JS */
    private void syncFileWordIndex(int posMs) {
        if (!mFileMode || mFileStarts == null || mAlbumWords == null || mAlbumWords.isEmpty()) return;
        int n = Math.min(mAlbumWords.size(), mFileStarts.length);
        int idx = 0;
        for (int i = 0; i < n; i++) {
            if (posMs >= mFileStarts[i]) idx = i;
            else break;
        }
        if (idx != mFileIndex) {
            mFileIndex = idx;
            mAlbumIndex = idx;
            try { mArtist = mAlbumWords.get(idx).word; } catch (Throwable ignored) {}
            updateNotification();
            emit("", "album_index:" + idx);
        }
    }

    /** 同步等待 TTS 把中文合成到 wav（6 秒超时兜底，结果由 latch 收口） */
    private boolean synthZhSync(String text, File wav) {
        if (!mTtsReady || mTts == null || text == null || text.length() == 0) return false;
        try { if (wav.exists()) wav.delete(); } catch (Throwable ignored) {}
        String utt = "fs_" + wav.getName();
        java.util.concurrent.CountDownLatch latch = new java.util.concurrent.CountDownLatch(1);
        synchronized (mSynthLatches) { mSynthLatches.put(utt, latch); }
        boolean ok = false;
        try {
            // synthesizeToFile(CharSequence, Bundle, File, String)：API 21+ 重载
            mTts.synthesizeToFile(text, null, wav, utt);
            latch.await(6, java.util.concurrent.TimeUnit.SECONDS);
            ok = wav.exists() && wav.length() > 44;
        } catch (Throwable e) {
            ok = false;
        } finally {
            synchronized (mSynthLatches) { mSynthLatches.remove(utt); }
        }
        return ok;
    }

    private void releaseSynthLatch(String id) {
        if (id == null) return;
        java.util.concurrent.CountDownLatch l;
        synchronized (mSynthLatches) { l = mSynthLatches.remove(id); }
        if (l != null) l.countDown();
    }

    /** 同步下载（构建线程内用） */
    private boolean downloadToFileSync(String url, File target) {
        if (url == null || url.length() == 0) return false;
        try {
            URL u = new URL(url);
            HttpURLConnection c = (HttpURLConnection) u.openConnection();
            c.setConnectTimeout(15000);
            c.setReadTimeout(20000);
            c.setRequestProperty("User-Agent", "Mozilla/5.0");
            c.connect();
            InputStream in = new BufferedInputStream(c.getInputStream());
            FileOutputStream out = new FileOutputStream(target);
            byte[] buf = new byte[8192];
            int nn;
            while ((nn = in.read(buf)) > 0) out.write(buf, 0, nn);
            out.close();
            in.close();
            c.disconnect();
            return target.exists() && target.length() > 200;
        } catch (Throwable e) {
            try { if (target != null && target.exists()) target.delete(); } catch (Throwable ignored) {}
            return false;
        }
    }

    /** 任意音频文件（mp3/m4a/aac…）解码为 PCM，按 16kHz 单声道重采样后追加写出 */
    private boolean appendAudioPcm(java.io.RandomAccessFile out, File src) {
        android.media.MediaExtractor ex = new android.media.MediaExtractor();
        android.media.MediaCodec dec = null;
        try {
            ex.setDataSource(src.getAbsolutePath());
            int ti = -1;
            for (int t = 0; t < ex.getTrackCount(); t++) {
                android.media.MediaFormat tf = ex.getTrackFormat(t);
                String mime = tf.getString(android.media.MediaFormat.KEY_MIME);
                if (mime != null && mime.startsWith("audio/")) { ti = t; break; }
            }
            if (ti < 0) return false;
            ex.selectTrack(ti);
            android.media.MediaFormat f = ex.getTrackFormat(ti);
            String mime = f.getString(android.media.MediaFormat.KEY_MIME);
            int sr = f.containsKey(android.media.MediaFormat.KEY_SAMPLE_RATE)
                    ? f.getInteger(android.media.MediaFormat.KEY_SAMPLE_RATE) : 44100;
            int ch = f.containsKey(android.media.MediaFormat.KEY_CHANNEL_COUNT)
                    ? f.getInteger(android.media.MediaFormat.KEY_CHANNEL_COUNT) : 1;
            dec = android.media.MediaCodec.createDecoderByType(mime);
            dec.configure(f, null, null, 0);
            dec.start();
            android.media.MediaCodec.BufferInfo info = new android.media.MediaCodec.BufferInfo();
            boolean eos = false;
            int guard = 0;
            while (!eos && guard++ < 20000 && !mBuildCancel) {
                int ib = dec.dequeueInputBuffer(10000);
                if (ib >= 0) {
                    java.nio.ByteBuffer bb = dec.getInputBuffer(ib);
                    int sz = (bb != null) ? ex.readSampleData(bb, 0) : -1;
                    if (sz < 0) {
                        dec.queueInputBuffer(ib, 0, 0, 0, android.media.MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                    } else {
                        dec.queueInputBuffer(ib, 0, sz, ex.getSampleTime(), 0);
                        ex.advance();
                    }
                }
                int ob = dec.dequeueOutputBuffer(info, 10000);
                if (ob >= 0) {
                    if (info.size > 1) {
                        java.nio.ByteBuffer pcm = dec.getOutputBuffer(ob);
                        if (pcm != null) {
                            byte[] bytes = new byte[info.size];
                            pcm.position(info.offset);
                            pcm.limit(Math.min(info.offset + info.size, pcm.capacity()));
                            pcm.get(bytes);
                            int cnt = bytes.length / 2;
                            short[] s = new short[cnt];
                            for (int k = 0; k < cnt; k++) {
                                s[k] = (short) ((bytes[2 * k] & 0xff) | (bytes[2 * k + 1] << 8));
                            }
                            appendResampled(out, s, sr, ch);
                        }
                    }
                    boolean end = (info.flags & android.media.MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0;
                    dec.releaseOutputBuffer(ob, false);
                    if (end) eos = true;
                } else if (ob == android.media.MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                    android.media.MediaFormat of = dec.getOutputFormat();
                    if (of.containsKey(android.media.MediaFormat.KEY_SAMPLE_RATE))
                        sr = of.getInteger(android.media.MediaFormat.KEY_SAMPLE_RATE);
                    if (of.containsKey(android.media.MediaFormat.KEY_CHANNEL_COUNT))
                        ch = of.getInteger(android.media.MediaFormat.KEY_CHANNEL_COUNT);
                }
            }
            return true;
        } catch (Throwable e) {
            return false;
        } finally {
            try { if (dec != null) { dec.stop(); dec.release(); } } catch (Throwable ignored) {}
            try { ex.release(); } catch (Throwable ignored) {}
        }
    }

    /** 解析 TTS 合成的 WAV（PCM）并按 16kHz 单声道追加 */
    private boolean appendWavPcm(java.io.RandomAccessFile out, File wav) {
        try {
            long flen = wav.length();
            if (flen < 44 || flen > 64L * 1024 * 1024) return false;
            byte[] all = new byte[(int) flen];
            java.io.FileInputStream fis = new java.io.FileInputStream(wav);
            int got = 0, nn;
            while (got < all.length && (nn = fis.read(all, got, all.length - got)) > 0) got += nn;
            fis.close();
            if (got < 44) return false;
            int sr = 0, ch = 1, bits = 16, dataOff = -1, dataLen = 0;
            int p = 12; // 跳过 RIFF 头
            while (p + 8 <= got) {
                String id = new String(all, p, 4, "ASCII");
                int sz = (all[p + 4] & 0xff) | ((all[p + 5] & 0xff) << 8)
                        | ((all[p + 6] & 0xff) << 16) | ((all[p + 7] & 0xff) << 24);
                if (id.equals("fmt ")) {
                    int q = p + 8;
                    ch = (all[q + 2] & 0xff) | ((all[q + 3] & 0xff) << 8);
                    sr = (all[q + 4] & 0xff) | ((all[q + 5] & 0xff) << 8)
                            | ((all[q + 6] & 0xff) << 16) | ((all[q + 7] & 0xff) << 24);
                    bits = (all[q + 14] & 0xff) | ((all[q + 15] & 0xff) << 8);
                } else if (id.equals("data")) {
                    dataOff = p + 8;
                    dataLen = Math.min(sz, got - dataOff);
                }
                p += 8 + sz + (sz & 1);
            }
            if (dataOff < 0 || sr <= 0 || bits != 16) return false;
            int cnt = dataLen / 2;
            if (cnt <= 0) return false;
            short[] s = new short[cnt];
            for (int k = 0; k < cnt; k++) {
                int o = dataOff + 2 * k;
                s[k] = (short) ((all[o] & 0xff) | ((all[o + 1] & 0xff) << 8));
            }
            appendResampled(out, s, sr, ch);
            return true;
        } catch (Throwable e) {
            return false;
        }
    }

    /** 立体声折叠 + 线性插值重采样到 OUT_SR，然后追加 */
    private void appendResampled(java.io.RandomAccessFile out, short[] in, int sr, int ch) {
        try {
            short[] mono;
            if (ch >= 2 && in.length >= 2) {
                int n = in.length / 2;
                mono = new short[n];
                for (int i = 0; i < n; i++) {
                    mono[i] = (short) (((in[2 * i] & 0xffff) + (in[2 * i + 1] & 0xffff)) >> 1);
                }
            } else {
                mono = in;
            }
            if (mono == null || mono.length == 0) return;
            short[] r;
            if (sr == OUT_SR) {
                r = mono;
            } else {
                int on = (int) (((long) mono.length * OUT_SR) / sr);
                if (on < 1) return;
                r = new short[on];
                for (int i = 0; i < on; i++) {
                    double srcPos = (double) i * sr / OUT_SR;
                    int i0 = (int) srcPos;
                    if (i0 >= mono.length) i0 = mono.length - 1;
                    int i1 = Math.min(i0 + 1, mono.length - 1);
                    double fr = srcPos - i0;
                    r[i] = (short) Math.round(mono[i0] * (1 - fr) + mono[i1] * fr);
                }
            }
            appendShortsLe(out, r);
        } catch (Throwable ignored) {}
    }

    private void appendShortsLe(java.io.RandomAccessFile out, short[] s) {
        try {
            byte[] b = new byte[s.length * 2];
            for (int i = 0; i < s.length; i++) {
                b[2 * i] = (byte) (s[i] & 0xff);
                b[2 * i + 1] = (byte) ((s[i] >> 8) & 0xff);
            }
            out.write(b);
        } catch (Throwable ignored) {}
    }

    private void appendSilence(java.io.RandomAccessFile out, int ms) {
        int samples = ms * (OUT_SR / 1000);
        if (samples <= 0) return;
        appendShortsLe(out, new short[samples]); // 默认全 0
    }

    private int currentOutMs(java.io.RandomAccessFile raf) {
        try {
            return (int) Math.max(0, (raf.length() - 44) / OUT_BYTES_PER_MS);
        } catch (Throwable e) {
            return 0;
        }
    }

    /** 回写 44 字节标准 WAV 头（PCM 16bit 单声道 OUT_SR） */
    private void writeWavHeader(java.io.RandomAccessFile raf) throws Throwable {
        long dataLen = raf.length() - 44;
        byte[] h = new byte[44];
        h[0] = 'R'; h[1] = 'I'; h[2] = 'F'; h[3] = 'F';
        putIntLe(h, 4, (int) (36 + dataLen));
        h[8] = 'W'; h[9] = 'A'; h[10] = 'V'; h[11] = 'E';
        h[12] = 'f'; h[13] = 'm'; h[14] = 't'; h[15] = ' ';
        putIntLe(h, 16, 16);
        h[20] = 1; h[21] = 0;  // PCM
        h[22] = 1; h[23] = 0;  // 单声道
        putIntLe(h, 24, OUT_SR);
        putIntLe(h, 28, OUT_SR * 2);
        h[32] = 2; h[33] = 0;  // block align
        h[34] = 16; h[35] = 0; // 16bit
        h[36] = 'd'; h[37] = 'a'; h[38] = 't'; h[39] = 'a';
        putIntLe(h, 40, (int) dataLen);
        raf.seek(0);
        raf.write(h);
    }

    private void putIntLe(byte[] b, int off, int v) {
        b[off] = (byte) (v & 0xff);
        b[off + 1] = (byte) ((v >> 8) & 0xff);
        b[off + 2] = (byte) ((v >> 16) & 0xff);
        b[off + 3] = (byte) ((v >> 24) & 0xff);
    }

    private String sha1(String v) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-1");
            byte[] d = md.digest(v.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : d) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Throwable e) {
            return "k" + Math.abs(v.hashCode());
        }
    }

    private boolean loadFileStarts(File idxF, int n) {
        try {
            byte[] b = new byte[(int) idxF.length()];
            java.io.FileInputStream fis = new java.io.FileInputStream(idxF);
            int got = 0, nn;
            while (got < b.length && (nn = fis.read(b, got, b.length - got)) > 0) got += nn;
            fis.close();
            String[] parts = new String(b, 0, got, "UTF-8").split(",");
            if (parts.length < n) return false;
            long[] st = new long[n];
            for (int i = 0; i < n; i++) st[i] = Long.parseLong(parts[i].trim());
            mFileStarts = st;
            return true;
        } catch (Throwable e) {
            return false;
        }
    }
}
