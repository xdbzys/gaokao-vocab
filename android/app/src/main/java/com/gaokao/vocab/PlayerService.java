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
            mRate = intent.getFloatExtra(EXTRA_RATE, 1f);
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
                        try { mTts.setSpeechRate(1.0f); } catch (Throwable ignored) {}
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
        playAlbumEn(idx);
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
                        @Override public void run() { playAlbumZh(idx); }
                    });
                } else if (w.enUrl != null && w.enUrl.length() > 0) {
                    playAlbumUrl(w.enUrl, new Runnable() {
                        @Override public void run() { playAlbumZh(idx); }
                    });
                } else {
                    playAlbumZh(idx);
                }
            }
        };
        if (target.exists() && target.length() > 200) play.run();
        else downloadToFile(w.enUrl, target, play);
    }

    private void playAlbumZh(final int idx) {
        if (!mAlbumMode || idx != mAlbumIndex || idx < 0 || idx >= mAlbumWords.size()) return;
        final AlbumWord w = mAlbumWords.get(idx);
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
                                    @Override public void run() { afterAlbumWord(idx); }
                                });
                            } else {
                                playAlbumUrl("https://dict.youdao.com/dictvoice?audio=" + uriEncode(w.zhText) + "&le=zh",
                                        new Runnable() { @Override public void run() { afterAlbumWord(idx); } });
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
        playAlbumUrl("https://dict.youdao.com/dictvoice?audio=" + uriEncode(w.zhText) + "&le=zh",
                new Runnable() { @Override public void run() { afterAlbumWord(idx); } });
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
        long gap = (long) (mAlbumAvgMs * 0.3);
        if (mHandler != null) mHandler.postDelayed(new Runnable() {
            @Override public void run() {
                if (!mAlbumMode || mAlbumIndex != idx) return;
                if (mPaused) { mAlbumPendingNext = next; return; }
                playAlbumWord(next);
            }
        }, gap);
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
            org.json.JSONArray words = root.optJSONArray("words");
            if (words == null || words.length() == 0) return;
            ArrayList<AlbumWord> list = new ArrayList<AlbumWord>();
            StringBuilder keySrc = new StringBuilder();
            keySrc.append(name).append('|').append(rate);
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
            // 停掉旧播放 / 旧合成（旧构建线程检测到 gen 变化会自行退出）
            mBuildGen++;
            stopAlbumWord();
            releasePlayer();
            mAlbumMode = true;
            mFileMode = true;
            mAlbumWords = list;
            mAlbumTotal = list.size();
            mAlbumName = name;
            mAlbumRate = Math.max(0.5f, Math.min(2.5f, rate));
            mFileRate = mAlbumRate;
            mFileLoop = !"off".equals(loop);
            mAlbumIndex = 0;
            mFileIndex = -1;
            mPaused = false;
            mZhPendingUtt = "";
            mFileStarts = new long[list.size()];
            mTitle = name;
            mArtist = "\u6b63\u5728\u5408\u6210\u6574\u5e93\u97f3\u9891\u2026"; // 正在合成整库音频…
            ensureSession();
            updateSessionState(PlaybackState.STATE_PLAYING);
            updateNotification();
            final String key = sha1(keySrc.toString());
            final File fin = new File(mAlbumWavDir, key + ".wav");
            final File idxF = new File(mAlbumWavDir, key + ".idx");
            mFileOut = fin;
            if (fin.exists() && fin.length() > 1000 && idxF.exists() && loadFileStarts(idxF, list.size())) {
                // 已合成过（同词库同语速）：直接播放缓存文件
                playBuiltFile(fin);
                return;
            }
            final ArrayList<AlbumWord> fList = list;
            final int gen = mBuildGen;
            mBuildCancel = false;
            mBuildThread = new Thread(new Runnable() {
                @Override public void run() { buildAlbumWav(gen, fList, fin, idxF); }
            }, "album-build");
            mBuildThread.start();
        } catch (Throwable e) {
            Log.e(TAG, "startAlbumFile failed", e);
        }
    }

    /** 后台合成：英文 mp3 解码 + 中文 TTS + 静音间隔 → 逐段追加到单个 PCM/WAV 文件 */
    private void buildAlbumWav(final int gen, final ArrayList<AlbumWord> list, final File fin, final File idxF) {
        File tmp = new File(mAlbumWavDir, fin.getName() + ".tmp");
        java.io.RandomAccessFile raf = null;
        try {
            raf = new java.io.RandomAccessFile(tmp, "rw");
            raf.setLength(0);
            raf.seek(44); // 先留 44 字节 WAV 头
            int n = list.size();
            for (int i = 0; i < n; i++) {
                if (mBuildCancel || gen != mBuildGen) {
                    try { raf.close(); } catch (Throwable ignored) {}
                    try { tmp.delete(); } catch (Throwable ignored) {}
                    return;
                }
                AlbumWord w = list.get(i);
                mFileStarts[i] = currentOutMs(raf);
                // —— 英文发音（本地缓存 mp3 → 下载 → 解码追加；失败留 0.8s 空白占位）——
                File enF = new File(mAlbumCacheDir, "en_" + w.key + ".mp3");
                boolean enOk = enF.exists() && enF.length() > 200;
                if (!enOk && w.enUrl != null && w.enUrl.length() > 0) enOk = downloadToFileSync(w.enUrl, enF);
                if (enOk) enOk = appendAudioPcm(raf, enF);
                if (!enOk) appendSilence(raf, 800);
                appendSilence(raf, 350);
                // —— 中文释义（TTS 合成 wav → 解码追加；失败回退百度网络语音 mp3）——
                boolean zhOk = false;
                if (w.zhText != null && w.zhText.length() > 0) {
                    File zhWav = new File(mAlbumCacheDir, "zh_" + w.key + ".wav");
                    if (!(zhWav.exists() && zhWav.length() > 44)) synthZhSync(w.zhText, zhWav);
                    if (zhWav.exists() && zhWav.length() > 44) zhOk = appendWavPcm(raf, zhWav);
                    if (!zhOk) {
                        File zhMp3 = new File(mAlbumCacheDir, "zh_" + w.key + ".mp3");
                        boolean dl = zhMp3.exists() && zhMp3.length() > 200;
                        if (!dl) dl = downloadToFileSync("https://fanyi.baidu.com/gettts?lan=zh&text="
                                + URLEncoder.encode(w.zhText, "UTF-8") + "&spd=3&source=web", zhMp3);
                        if (dl) zhOk = appendAudioPcm(raf, zhMp3);
                    }
                }
                if (!zhOk) appendSilence(raf, 600);
                // —— 词间间隔 ——
                appendSilence(raf, 700);
                final int done = i + 1;
                if (mHandler != null) mHandler.post(new Runnable() {
                    @Override public void run() {
                        if (gen != mBuildGen || !mFileMode) return;
                        mArtist = "\u6b63\u5728\u5408\u6210\u6574\u5e93\u97f3\u9891 " + done + "/" + mAlbumTotal;
                        updateNotification();
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
                sb.append(mFileStarts[i]);
            }
            java.io.FileOutputStream fo = new java.io.FileOutputStream(idxF);
            fo.write(sb.toString().getBytes("UTF-8"));
            fo.close();
            if (mHandler != null) mHandler.post(new Runnable() {
                @Override public void run() {
                    if (gen != mBuildGen || !mFileMode) return;
                    mArtist = mAlbumWords.get(0).word;
                    playBuiltFile(fin);
                }
            });
        } catch (Throwable e) {
            Log.e(TAG, "buildAlbumWav failed", e);
            try { if (raf != null) raf.close(); } catch (Throwable ignored) {}
            try { tmp.delete(); } catch (Throwable ignored) {}
            if (mHandler != null) mHandler.post(new Runnable() {
                @Override public void run() {
                    if (gen != mBuildGen || !mFileMode) return;
                    mArtist = "\u5408\u6210\u5931\u8d25"; // 合成失败
                    updateNotification();
                    emit("", "album_build_fail");
                }
            });
        }
    }

    /** 用单个 MediaPlayer 播放整库 WAV（MediaSession 拥有真实时长，可拖动进度） */
    private void playBuiltFile(final File f) {
        releasePlayer();
        requestFocus();
        acquireWakeLock();
        try {
            mPlayer = new MediaPlayer();
            setAudioAttrs(mPlayer);
            mPlayer.setWakeMode(this, PowerManager.PARTIAL_WAKE_LOCK);
            mPlayer.setDataSource(f.getAbsolutePath());
            mPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override public void onPrepared(MediaPlayer mp) {
                    mHasPlayed = true;
                    mPaused = false;
                    mDuration = 0;
                    applyRate(); // v2.65.0：整库文件也支持变速（API 23+）
                    try { mDuration = mp.getDuration(); } catch (Throwable ignored) {}
                    try { mp.start(); } catch (Throwable ignored) {}
                    mFileIndex = 0;
                    mAlbumIndex = 0;
                    try { if (mAlbumWords != null && !mAlbumWords.isEmpty()) mArtist = mAlbumWords.get(0).word; } catch (Throwable ignored) {}
                    emit("", "album_index:0");
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
