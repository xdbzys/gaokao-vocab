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
import android.media.MediaPlayer;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

/**
 * 听读模式「系统播放器」服务（v2.60.0）
 *
 * 解决的问题：
 *  1. 网页 Audio 只能在应用内播放，退出 / 锁屏 / 息屏即静音（用户反馈“无法在软件外播放”）
 *  2. 没有系统级播放入口，通知栏 / 锁屏 / 耳机线控都控制不了（用户反馈“无法启动手机内置播放器”）
 *
 * 方案：系统 MediaPlayer + 前台服务 + MediaSession
 *  - 音频由系统媒体通道播放，退出应用回到桌面后继续播放
 *  - 通知栏常驻播放卡片：上一词 / 播放暂停 / 下一词
 *  - 锁屏与耳机线控通过 MediaSession 接管
 *
 * 兼容性：minSdk 21（安卓 5.0.2 翻译笔 / MP5）起可用。
 *  - MediaSession / MediaStyle / PlaybackState：API 21+（minSdk 即 21，无需额外判断）
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
    public static final String ACTION_TITLE = "com.gaokao.vocab.player.TITLE";

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_ID = "id";
    public static final String EXTRA_RATE = "rate";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_MEDIA_ACTION = "media_action";

    private static final String TAG = "GaokaoPlayer";
    private static final String CHANNEL_ID = "gaokao_listen_playback";
    private static final int NOTIFY_ID = 20260101;

    /** JS 回调：播放结束 / 出错 / 媒体按键 */
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

    private MediaPlayer mPlayer;
    private MediaSession mSession;
    private PowerManager.WakeLock mWakeLock;
    private AudioManager mAudioManager;
    private AudioManager.OnAudioFocusChangeListener mFocusListener;
    private Handler mHandler;

    private String mId = "";
    private String mTitle = "背群英 · 听读";
    private float mRate = 1f;
    private boolean mPaused = false;
    private boolean mHasPlayed = false;

    @Override
    public void onCreate() {
        super.onCreate();
        mHandler = new Handler(Looper.getMainLooper());
        try {
            mAudioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        } catch (Throwable ignored) {
        }
        createChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
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
        if (ACTION_MEDIA.equals(action)) {
            String a = intent.getStringExtra(EXTRA_MEDIA_ACTION);
            emit("", a == null ? "playpause" : a);
            return START_STICKY;
        }
        if (ACTION_RATE.equals(action)) {
            mRate = intent.getFloatExtra(EXTRA_RATE, 1f);
            applyRate();
            return START_STICKY;
        }
        if (ACTION_TITLE.equals(action)) {
            String t = intent.getStringExtra(EXTRA_TITLE);
            if (t != null && t.length() > 0) {
                mTitle = t;
                updateNotification();
                updateSessionState(mPaused ? PlaybackState.STATE_PAUSED : PlaybackState.STATE_PLAYING);
            }
            return START_STICKY;
        }
        if (ACTION_PLAY.equals(action)) {
            String url = intent.getStringExtra(EXTRA_URL);
            mId = intent.getStringExtra(EXTRA_ID);
            if (mId == null) mId = "";
            mRate = intent.getFloatExtra(EXTRA_RATE, 1f);
            String title = intent.getStringExtra(EXTRA_TITLE);
            if (title != null && title.length() > 0) mTitle = title;
            mPaused = false;
            startForegroundCompat();
            playUrl(url);
        }
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
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
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(NOTIFY_ID);
        } catch (Throwable ignored) {
        }
        super.onDestroy();
    }

    // ================= 播放控制 =================

    private void playUrl(String url) {
        if (url == null || url.length() == 0) {
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
            mPlayer.setDataSource(url);
            mPlayer.setOnPreparedListener(new MediaPlayer.OnPreparedListener() {
                @Override
                public void onPrepared(MediaPlayer mp) {
                    mHasPlayed = true;
                    applyRate();
                    try {
                        mp.start();
                        mPaused = false;
                        updateSessionState(PlaybackState.STATE_PLAYING);
                        updateNotification();
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
                    updateSessionState(PlaybackState.STATE_PAUSED);
                }
            });
            mPlayer.setOnErrorListener(new MediaPlayer.OnErrorListener() {
                @Override
                public boolean onError(MediaPlayer mp, int what, int extra) {
                    Log.e(TAG, "MediaPlayer error what=" + what + " extra=" + extra);
                    emit(mId, "error");
                    return true;
                }
            });
            mPlayer.prepareAsync();
        } catch (Throwable e) {
            Log.e(TAG, "playUrl failed", e);
            emit(mId, "error");
        }
    }

    private void pauseInternal() {
        mPaused = true;
        try {
            if (mPlayer != null && mPlayer.isPlaying()) mPlayer.pause();
        } catch (Throwable ignored) {
        }
        updateSessionState(PlaybackState.STATE_PAUSED);
        updateNotification();
    }

    private void resumeInternal() {
        if (!mHasPlayed) return;
        mPaused = false;
        try {
            if (mPlayer != null && !mPlayer.isPlaying()) {
                mPlayer.start();
                updateSessionState(PlaybackState.STATE_PLAYING);
            }
        } catch (Throwable ignored) {
        }
        updateNotification();
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
    }

    private void applyRate() {
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
                    emit("", "playpause");
                }

                @Override
                public void onPause() {
                    emit("", "playpause");
                }

                @Override
                public void onSkipToNext() {
                    emit("", "nexttrack");
                }

                @Override
                public void onSkipToPrevious() {
                    emit("", "previoustrack");
                }

                @Override
                public void onStop() {
                    emit("", "stop");
                }
            });
            mSession.setActive(true);
        } catch (Throwable e) {
            Log.w(TAG, "MediaSession unavailable", e);
            mSession = null;
        }
    }

    private void updateSessionState(int state) {
        if (mSession == null) return;
        try {
            PlaybackState.Builder b = new PlaybackState.Builder();
            b.setActions(PlaybackState.ACTION_PLAY
                    | PlaybackState.ACTION_PAUSE
                    | PlaybackState.ACTION_STOP
                    | PlaybackState.ACTION_SKIP_TO_NEXT
                    | PlaybackState.ACTION_SKIP_TO_PREVIOUS);
            b.setState(state, 0, mPaused ? 0f : 1f);
            mSession.setPlaybackState(b.build());
            android.media.MediaMetadata.Builder mb = new android.media.MediaMetadata.Builder();
            mb.putString(android.media.MediaMetadata.METADATA_KEY_TITLE, mTitle);
            mb.putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, "背群英 · 听读");
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
                .setContentText(mPaused ? "已暂停 · 背群英听读" : "正在播放 · 背群英听读")
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

    private void startForegroundCompat() {
        try {
            Notification n = buildNotification();
            if (Build.VERSION.SDK_INT >= 29) {
                startForeground(NOTIFY_ID, n,
                        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFY_ID, n);
            }
        } catch (Throwable e) {
            Log.e(TAG, "startForeground failed", e);
        }
    }
}
