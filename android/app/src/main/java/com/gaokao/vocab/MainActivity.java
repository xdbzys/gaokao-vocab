package com.gaokao.vocab;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.DocumentsContract;
import android.content.SharedPreferences;
import android.util.Log;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.security.MessageDigest;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * 纯原生 WebView 容器（不依赖 Capacitor 运行时）
 *
 * 目的：兼容 Android 5.0.2 (API 21) 翻译笔，避免 Capacitor 8
 * 编译产物（要求 API 24+）在低版本系统启动崩溃。
 *
 * - 云端优先加载：每次启动先从云端拉取最新 index.html，缓存到本地后加载
 * - 离线兜底：无网络时加载上次缓存的云端版本，再不行用 APK 内置版本
 * - 通过 NativeFS JavascriptInterface 提供文件读写（备份/恢复）
 * - 外链与"立即更新"在浏览器打开
 * - 音量键导航
 */
public class MainActivity extends Activity {

    private WebView webView;
    private static boolean volumeKeyNavEnabled = false;
    // 听读模式后台播放开关：开启时 onPause 不暂停 WebView，让 JS 音频继续播放
    private static boolean backgroundPlaybackEnabled = false;

    /* v2.76.0 自定义保存目录：SAF（存储访问框架）授权的一个文件夹。
       一旦选中，MP3 / 压缩包 / 备份 JSON 优先写到该目录，用户可自己指定到内存卡或任意文件夹；
       未选择时保持原行为（下载/背群英、音乐/背群英）。 */
    private static final int REQ_SAVE_DIR = 1003;
    private static final String PREF_SAVE_DIR_URI = "save_dir_uri";
    private static final String PREF_SAVE_DIR_LABEL = "save_dir_label";
    private static final String SAVE_PREFS = "gaokao_save";
    private static String sSaveDirUri = "";
    private static String sSaveDirLabel = "";

    // v2.63.0：最近一次 setMeta 的媒体信息（服务未运行时也记住，启动播放时随 ACTION_PLAY 带给服务）
    private static volatile String sLastTitle = null;
    private static volatile String sLastArtist = null;
    private static volatile String sLastAlbum = null;

    // ===== 云端热更新配置 =====
    // v2.59.0 主流更新方案：① 先拉约 300 字节的版本清单秒级比对 → ② 仅必要时才下载正文（优先 gzip）
    // 第一步：版本清单地址（多源容灾：jsDelivr → GitHub Pages → raw）
    private static final String[] CLOUD_VERSION_URLS = {
        // v2.73.0：Gitee 每次构建同步 app-update.json，国内直连最快 → 首选；
        // 其余为兜底。所有源都会读到「取最大版本号」，单个源滞后不会导致永不更新。
        "https://gitee.com/xdbzys/app/raw/master/app-update.json",
        "https://xdbzys.github.io/gaokao-vocab/app-update.json",
        "https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/version.json",
        "https://xdbzys.github.io/gaokao-vocab/version.json",
        "https://raw.githubusercontent.com/xdbzys/gaokao-vocab/master/version.json"
    };
    // 第二步：正文地址（v2.71.0 改为 jsDelivr 优先——CI 每次构建把最新 index.html 回写 master，国内最快最稳；
    //  GitHub Pages / GitHub Release 作为兜底）
    private static final String[] CLOUD_INDEX_URLS = {
        // v2.72.1：Gitee 镜像随每次构建更新且国内直连实测约 3 秒 → 首选
        // （jsDelivr 对 @master 有最长 12 小时缓存，实测曾下发上一版页面）
        "https://gitee.com/xdbzys/app/raw/master/web/index.html",
        "https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/web/index.html",
        "https://xdbzys.github.io/gaokao-vocab/web/index.html",
        "https://github.com/xdbzys/gaokao-vocab/releases/latest/download/index.html"
    };
    private static final String CACHE_FILE = "cloud_index.html";
    private static final String PREF_NAME = "cloud_update";
    private static final String PREF_KEY_VER = "cached_version_code";
    // v2.73.0：记录「装过的最新 versionCode」，APK 一变就丢弃热更新缓存；同时记住缓存页面对应版本名
    private static final String PREF_KEY_LAST_INSTALL = "last_installed_code";
    private static final String PREF_KEY_CACHE_NAME = "cached_version_name";
    // 超时：清单极小用短超时快速切换源；正文较大，读取超时放宽，慢网络也不会被中断
    private static final int MANIFEST_TIMEOUT = 6000;
    private static final int CONNECT_TIMEOUT = 8000;
    private static final int READ_TIMEOUT = 60000;
    private static final int DOWNLOAD_TIMEOUT = 60000;

    /**
     * v2.55.7: 内容安全校验
     * 云端/缓存内容必须包含 __SW_GUARD__ 标记（v2.55.7 构建产物自带）。
     * 不含标记的旧版本（如带未捕获 ServiceWorker rejection 的 v2.55.6 云端缓存）
     * 在 file:// 协议下会触发 UnhandledRejection 红屏，必须拒绝加载。
     */
    private boolean isSafeContent(String content) {
        return content != null && content.contains("__SW_GUARD__");
    }

    /** 读取文本文件（UTF-8），失败返回 null */
    private String readFileText(File file) {
        try {
            byte[] data = new byte[(int) file.length()];
            FileInputStream fis = new FileInputStream(file);
            fis.read(data);
            fis.close();
            return new String(data, "UTF-8");
        } catch (Throwable e) {
            return null;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        loadSaveDir();   // v2.76.0：恢复上次选定的保存目录

        // API 23+ 动态申请存储权限（备份到公共 Documents 需要）
        // API 21（翻译笔）为安装时授予，无需运行时请求
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                if (checkSelfPermission(android.Manifest.permission.WRITE_EXTERNAL_STORAGE)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{android.Manifest.permission.WRITE_EXTERNAL_STORAGE}, 1001);
                }
            } catch (Throwable ignored) {}
        }

        // API 33+ 通知权限：听读后台播放的控制卡片需要，缺失时通知栏不可见（播放仍正常）
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1002);
                }
            } catch (Throwable ignored) {}
        }

        webView = new WebView(this);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setSupportZoom(true);
        s.setBuiltInZoomControls(true);
        s.setDisplayZoomControls(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        s.setDefaultTextEncodingName("UTF-8");

        // 允许无用户手势自动播放音频（自动发音功能必需，API 17+）
        // 不设置时 WebView 默认要求手势，切换单词的自动发音会被静默拒绝
        try { s.setMediaPlaybackRequiresUserGesture(false); } catch (Throwable ignored) {}

        // v2.55.9: 允许 file:// 页面跨域访问 https 资源（有道词典发音音频等）
        // 页面以 file:// 协议加载（本地 assets / 云端缓存），API 16+ 默认关闭跨域，
        // 部分 WebView 版本会拦截 file:// 发起的媒体/网络请求，导致自动发音无声
        try { s.setAllowUniversalAccessFromFileURLs(true); } catch (Throwable ignored) {}

        // User-Agent 改为标准浏览器，避免 CDN 拦截 WebView 请求
        try {
            String ua = s.getUserAgentString();
            if (ua != null) {
                ua = ua.replace(" wv", "")
                        .replaceAll(";\\s*;", ";")
                        .replaceAll("\\s+", " ")
                        .trim();
                s.setUserAgentString(ua);
            }
        } catch (Throwable ignored) {}

        // 原生文件桥接：供 JS 侧 window.NativeFS 调用
        webView.addJavascriptInterface(new NativeFS(this), "NativeFS");

        // 音量键导航开关：供 JS 侧 window.VolumeKeyNative.setVolumeKeyNavEnabled(bool) 调用
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setVolumeKeyNavEnabled(boolean enabled) {
                volumeKeyNavEnabled = enabled;
            }
        }, "VolumeKeyNative");

        // 听读模式音频桥接：供 JS 侧 window.NativeAudio 调用
        // - setBackgroundPlayback(true)：App 退到后台时不暂停 WebView，音频继续播放
        // - setKeepScreenOn(true)：听读播放期间保持屏幕常亮
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void setBackgroundPlayback(boolean enabled) {
                backgroundPlaybackEnabled = enabled;
            }

            @JavascriptInterface
            public void setKeepScreenOn(final boolean enabled) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            if (webView != null) webView.setKeepScreenOn(enabled);
                        } catch (Throwable ignored) {}
                    }
                });
            }

            /** v2.74.0：直接跳到本应用的通知设置页（vivo 上媒体卡片不显示多半是通知被关） */
            @JavascriptInterface
            public void openNotificationSettings() {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        try {
                            android.content.Intent i = new android.content.Intent();
                            if (Build.VERSION.SDK_INT >= 26) {
                                i.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                                i.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, getPackageName());
                            } else {
                                i.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                                i.setData(android.net.Uri.parse("package:" + getPackageName()));
                            }
                            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(i);
                        } catch (Throwable ignored) {}
                    }
                });
            }

            /** v2.74.0：跳转到本应用详情页，便于设置「自启动 / 后台高耗电 / 锁屏显示」 */
            @JavascriptInterface
            public void openAppSettings() {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        try {
                            android.content.Intent i = new android.content.Intent(
                                    android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                            i.setData(android.net.Uri.parse("package:" + getPackageName()));
                            i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(i);
                        } catch (Throwable ignored) {}
                    }
                });
            }
        }, "NativeAudio");

        // v2.75.0 高清中文语音包桥接：供 JS 侧 window.NativeVoice 调用
        // 语音包随 APK 内置（assets/zhvoice.zip），首启解压到 filesDir/zhvoice，
        // 播放优先使用本地 22.05kHz 神经语音，物理上消除网络合成带来的「机器味」。
        webView.addJavascriptInterface(new Object() {
            /** 按朗读文本返回本地高清音频的绝对路径，未命中返回空串 */
            @JavascriptInterface
            public String localZh(String text) {
                try { return PlayerService.localZhPath(text); } catch (Throwable e) { return ""; }
            }

            /** 已解压的语音条数（0 = 尚未就绪） */
            @JavascriptInterface
            public int count() {
                try { return PlayerService.zhPackCount(); } catch (Throwable e) { return 0; }
            }

            /* ===== v2.77.0 离线语音包改为可选：默认不下载，用户主动开启才占空间 ===== */

            /** 是否已开启离线语音 */
            @JavascriptInterface
            public boolean offlineEnabled() {
                try { return PlayerService.zhOfflineEnabled(MainActivity.this); } catch (Throwable e) { return false; }
            }

            /** 开启/关闭离线语音；关闭会立即删除已解压的包释放空间。返回最终状态 */
            @JavascriptInterface
            public boolean setOffline(boolean on) {
                try { PlayerService.setZhOfflineEnabled(MainActivity.this, on); return on; } catch (Throwable e) { return false; }
            }

            /** 语音包当前占用字节数（含未删除的 zip 缓存） */
            @JavascriptInterface
            public long offlineBytes() {
                try { return PlayerService.zhPackBytes(MainActivity.this); } catch (Throwable e) { return 0L; }
            }

            /** 立即开始准备（服务在跑时马上下载；否则等下次播放自动准备）。返回是否已排队 */
            @JavascriptInterface
            public boolean requestOffline() {
                try { return PlayerService.requestZhPack(); } catch (Throwable e) { return false; }
            }

            /** 删除已下载的离线语音 */
            @JavascriptInterface
            public void clearOffline() {
                try { PlayerService.clearZhPack(MainActivity.this); } catch (Throwable e) {}
            }
        }, "NativeVoice");

        // v2.62.0 系统播放器桥接：供 JS 侧 window.NativePlayer 调用
        // 音频改由原生 MediaPlayer 前台服务输出（系统媒体通道）：
        // 退出应用 / 锁屏 / 息屏后继续播放，通知栏与耳机线控可直接控制
        // v2.62.0：音频先下载为本地 MP3 文件再播放 —— 时长精确、进度可拖动、断网也能播
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public boolean isAvailable() {
                return true;
            }

            /** 播放：优先本地 MP3 缓存文件；未缓存则先下载再播；下载失败直接播网络地址 */
            @JavascriptInterface
            public void playUrl(final String url, final String id, final float rate) {
                if (url == null || url.length() == 0) return;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        File f = ttsCacheFile(url);
                        if (f != null && f.exists() && f.length() > 256) {
                            startPlay(null, f.getAbsolutePath(), id, rate);
                            return;
                        }
                        if (f != null && downloadToFile(url, f, 12000)) {
                            startPlay(null, f.getAbsolutePath(), id, rate);
                            return;
                        }
                        startPlay(url, null, id, rate);
                    }
                }).start();
            }

            /** 直接播放本地 MP3 文件（离线听读） */
            @JavascriptInterface
            public void playFile(final String path, final String id, final float rate) {
                if (path == null || path.length() == 0) return;
                startPlay(null, path, id, rate);
            }

            /** 判断某音频是否已在本地缓存（用于 UI 显示"已缓存"） */
            @JavascriptInterface
            public boolean isCached(String url) {
                File f = ttsCacheFile(url);
                return f != null && f.exists() && f.length() > 256;
            }

            @JavascriptInterface
            public void pause() { sendPlayerAction(PlayerService.ACTION_PAUSE); }

            @JavascriptInterface
            public void resume() { sendPlayerAction(PlayerService.ACTION_RESUME); }

            @JavascriptInterface
            public void stop() { sendPlayerAction(PlayerService.ACTION_STOP); }

            @JavascriptInterface
            public void setRate(float rate) {
                if (!PlayerService.sRunning) return;
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_RATE);
                    i.putExtra(PlayerService.EXTRA_RATE, rate);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            @JavascriptInterface
            public void setTitle(String title) {
                sendPlayerMeta(title, null, null);
            }

            /** 同步单词 / 释义 / 词库名到锁屏与通知栏（与音乐播放器一致的卡片信息） */
            @JavascriptInterface
            public void setMeta(String title, String artist, String album) {
                sendPlayerMeta(title, artist, album);
            }

            /** 拖动进度（毫秒） */
            @JavascriptInterface
            public void seek(int ms) {
                if (!PlayerService.sRunning) return;
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_SEEK);
                    i.putExtra(PlayerService.EXTRA_SEEK, ms);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            /** v2.63.0：TTS 伴侣模式 —— 系统语音朗读期间保持媒体卡片可见可控 */
            @JavascriptInterface
            public void ttsState(boolean playing, int durationMs) {
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_TTS);
                    i.putExtra(PlayerService.EXTRA_TTS_PLAYING, playing);
                    i.putExtra(PlayerService.EXTRA_TTS_DURATION, durationMs);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            /** v2.64.0：整库连续播放（Album 模式）
             * JS 把选中的整库 words JSON 交给原生，原生像专辑一样连续播放整库，
             * 锁屏 / 控制中心 / 耳机线控完整可控，无需逐词切换。 */
            @JavascriptInterface
            public void playAlbum(final String json) {
                if (json == null || json.length() == 0) return;
                try {
                    // v2.64.0：整库可能数百词，JSON 超过 Intent Binder 事务上限，故先写缓存文件再传路径
                    File f = new File(getCacheDir(), "album_req.json");
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
                    fos.write(json.getBytes("UTF-8"));
                    fos.close();
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_ALBUM);
                    i.putExtra(PlayerService.EXTRA_ALBUM_PATH, f.getAbsolutePath());
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            /** v2.64.0：整库进度跳转（跳到第 index 个词，0-based） */
            @JavascriptInterface
            public void seekAlbum(int index) {
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_ALBUM_SEEK);
                    i.putExtra(PlayerService.EXTRA_ALBUM_INDEX, index);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            /**
             * v2.65.0：整库合成单一音频文件后播放。
             * 把整库（英文 mp3 + 中文 TTS + 词间静音）合成为一个 WAV 文件，
             * 用单个 MediaPlayer 播放 —— MediaSession 拥有真实时长，锁屏 /
             * 控制中心 / 耳机线控像控制一首完整音乐一样控制整库，可拖动进度。
             * JSON 契约与 playAlbum 相同（写缓存文件传路径，规避 Binder 上限）。
             */
            @JavascriptInterface
            public void playAlbumFile(final String json) {
                if (json == null || json.length() == 0) return;
                try {
                    File f = new File(getCacheDir(), "album_req.json");
                    java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
                    fos.write(json.getBytes("UTF-8"));
                    fos.close();
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_ALBUM_FILE);
                    i.putExtra(PlayerService.EXTRA_ALBUM_PATH, f.getAbsolutePath());
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            @JavascriptInterface
            public int getPosition() {
                try { return PlayerService.peekPosition(); } catch (Throwable ignored) { return 0; }
            }

            @JavascriptInterface
            public int getDuration() {
                try { return PlayerService.peekDuration(); } catch (Throwable ignored) { return 0; }
            }

            /** 下载单个 MP3 到手机「下载」目录（异步，结果回调 window.__mp3Saved(path)） */
            @JavascriptInterface
            public void downloadMp3(final String url, final String fileName) {
                if (url == null || url.length() == 0) return;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        File cached = ttsCacheFile(url);
                        File src = null;
                        if (cached != null && cached.exists() && cached.length() > 256) {
                            src = cached;
                        } else {
                            File tmp = new File(getCacheDir(), "mp3_out_" + System.currentTimeMillis() + ".mp3");
                            if (downloadToFile(url, tmp, 30000)) src = tmp;
                        }
                        if (src == null) {
                            notifyJs("window.__mp3Saved && window.__mp3Saved('')");
                            return;
                        }
                        String name = fileName;
                        if (name == null || name.length() == 0) name = "audio.mp3";
                        if (!name.toLowerCase().endsWith(".mp3")) name += ".mp3";
                        String path = saveAudioToMusic(src, name);
                        notifyJs("window.__mp3Saved && window.__mp3Saved('" + jsEscape(path) + "')");
                    }
                }).start();
            }
        }, "NativePlayer");

        // v2.62.0 批量 MP3 下载：JS 传入 [{url,name}]，原生下载并打包成 zip 存到「下载」目录
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void downloadZip(final String json, final String zipName) {
                if (json == null || json.length() == 0) return;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        String zname = (zipName == null || zipName.length() == 0) ? "背群英听读MP3.zip" : zipName;
                        if (!zname.toLowerCase().endsWith(".zip")) zname += ".zip";
                        File out = new File(getCacheDir(), "zip_" + System.currentTimeMillis() + ".zip");
                        ZipOutputStream zos = null;
                        try {
                            JSONArray arr = new JSONArray(json);
                            int total = arr.length();
                            zos = new ZipOutputStream(new FileOutputStream(out));
                            byte[] buf = new byte[8192];
                            for (int i = 0; i < total; i++) {
                                JSONObject o = arr.optJSONObject(i);
                                if (o == null) continue;
                                String url = o.optString("url", "");
                                String name = o.optString("name", (i + 1) + ".mp3");
                                if (url.length() == 0) continue;
                                notifyJs("window.__mp3Progress && window.__mp3Progress(" + i + "," + total + ")");
                                File f = ttsCacheFile(url);
                                if (f == null || (!f.exists() && !downloadToFile(url, f, 30000))) continue;
                                FileInputStream fis = null;
                                try {
                                    zos.putNextEntry(new ZipEntry(name));
                                    fis = new FileInputStream(f);
                                    int n;
                                    while ((n = fis.read(buf)) != -1) zos.write(buf, 0, n);
                                    zos.closeEntry();
                                } catch (Throwable e) {
                                    Log.w("GaokaoVocab", "zip entry failed: " + name);
                                } finally {
                                    if (fis != null) { try { fis.close(); } catch (Throwable ignored) {} }
                                }
                            }
                            notifyJs("window.__mp3Progress && window.__mp3Progress(" + total + "," + total + ")");
                        } catch (Throwable e) {
                            Log.e("GaokaoVocab", "downloadZip failed", e);
                        } finally {
                            if (zos != null) { try { zos.close(); } catch (Throwable ignored) {} }
                        }
                        if (!out.exists() || out.length() < 100) {
                            notifyJs("window.__mp3ZipDone && window.__mp3ZipDone('')");
                            return;
                        }
                        String path = saveToDownloads(out, zname, "application/zip");
                        notifyJs("window.__mp3ZipDone && window.__mp3ZipDone('" + jsEscape(path) + "')");
                    }
                }).start();
            }
        }, "NativeMp3");

        /* v2.76.0 保存位置：让用户自己选目录（SAF），选完后 MP3 / 压缩包 / 备份都写到这里。
           label() 返回当前目录显示名，pickDir() 唤起系统目录选择器，clearDir() 恢复默认。 */
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String label() {
                return sSaveDirLabel == null ? "" : sSaveDirLabel;
            }

            @JavascriptInterface
            public void pickDir() {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION
                                    | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                                    | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
                            startActivityForResult(i, REQ_SAVE_DIR);
                        } catch (Throwable e) {
                            Log.w("GaokaoVocab", "pickDir failed: " + e.getMessage());
                            notifyJs("window.__saveDirChanged && window.__saveDirChanged('')");
                        }
                    }
                });
            }

            @JavascriptInterface
            public void clearDir() {
                sSaveDirUri = "";
                sSaveDirLabel = "";
                try { savePrefs().edit().remove(PREF_SAVE_DIR_URI).remove(PREF_SAVE_DIR_LABEL).apply(); } catch (Throwable ignored) {}
                notifyJs("window.__saveDirChanged && window.__saveDirChanged('')");
            }

            /** 保存一段文本（备份 JSON）；成功返回保存位置描述，失败返回空 */
            @JavascriptInterface
            public String saveText(final String text, final String fileName) {
                if (text == null || text.length() == 0) return "";
                String name = (fileName == null || fileName.length() == 0) ? "backup.json" : fileName;
                String p = saveToCustomDirText(text, name);
                return p == null ? "" : p;
            }

            /** 当前是否有自定义目录（false 时页面按原逻辑保存） */
            @JavascriptInterface
            public boolean hasDir() {
                return sSaveDirUri != null && sSaveDirUri.length() > 0;
            }
        }, "NativeSaver");

        // 剪贴板桥接：导出词库时一键复制（file:// 下 navigator.clipboard 常不可用）
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public boolean copy(String text) {
                try {
                    android.content.ClipboardManager cm = (android.content.ClipboardManager)
                            getSystemService(android.content.Context.CLIPBOARD_SERVICE);
                    if (cm == null) return false;
                    cm.setPrimaryClip(android.content.ClipData.newPlainText("背群英词库", text == null ? "" : text));
                    return true;
                } catch (Throwable e) {
                    return false;
                }
            }
        }, "NativeClipboard");

        // v2.63.0 文本保存桥接：词库导出 txt 直接写入「下载/背群英」
        // （WebView 的 blob 链接 <a download> 不生效，旧版「下载 txt」点了没反应）
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public String saveText(String text, String fileName) {
                try {
                    if (text == null) return "";
                    File tmp = new File(getCacheDir(), "txt_" + System.currentTimeMillis() + ".txt");
                    FileOutputStream fos = new FileOutputStream(tmp);
                    fos.write(text.getBytes("UTF-8"));
                    fos.close();
                    String name = (fileName == null || fileName.length() == 0) ? "export.txt" : fileName;
                    if (!name.toLowerCase().endsWith(".txt")) name += ".txt";
                    String p = saveToDownloads(tmp, name, "text/plain");
                    tmp.delete();
                    return p == null ? "" : p;
                } catch (Throwable e) {
                    return "";
                }
            }
        }, "NativeFile");

        // 播放服务 → JS 回调（播放结束 / 出错 / 通知栏与线控按键）
        try {
            PlayerService.setCallback(new PlayerService.PlayerCallback() {
                @Override
                public void onEvent(String id, String type) {
                    // v2.62.0：进度上报（progress:当前位置:总时长），用于 App 内进度条与界面同步
                    if (type != null && type.startsWith("progress:")) {
                        String[] p = type.substring(9).split(":");
                        if (p.length >= 2) {
                            notifyJs("window.__nativeProgress && window.__nativeProgress("
                                    + p[0] + "," + p[1] + ")");
                        }
                        return;
                    }
                    notifyJs("window.__nativeAudioEvent && window.__nativeAudioEvent('"
                            + String.valueOf(id) + "','" + String.valueOf(type) + "')");
                }
            });
        } catch (Throwable ignored) {}

        // 外链打开桥接：供 JS 侧 window.NativeShell.openExternal(url) 调用
        // 直接走 ACTION_VIEW Intent，避免 window.open 在 onCreateWindow 中无法可靠取到目标 URL
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void openExternal(String url) {
                try {
                    if (url == null || url.isEmpty()) return;
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Throwable ignored) {}
            }
        }, "NativeShell");

        // 应用内 APK 下载安装桥接：供 JS 侧 window.NativeApkInstaller.downloadAndInstall(url) 调用
        // 不跳转浏览器，直接下载并弹出系统安装界面
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void downloadAndInstall(final String url) {
                // v2.73.0：旧实现自行下载到固定文件名 update.apk 且不做任何校验，
                // 与「立即更新」的可靠更新器是两套逻辑，一旦走到这条路径就会出现
                // 「下载的其实是旧包 / 残片覆盖 / 重复点击互相写坏」。
                // 现在统一委派给 installUpdateInBackground（单源），共享全部校验与安装结果判定。
                if (url == null || url.length() < 8) return;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        installUpdateInBackground("[\"" + url.replace("\\", "\\\\").replace("\"", "") + "\"]", 0, "");
                    }
                }).start();
            }
        }, "NativeApkInstaller");

        // v2.67.0 安装包版本桥接：把 PackageManager 读到的「本机真实安装包版本」暴露给页面。
        // 页面版本号会被云端热更新抬高，但原生代码只随 APK 更新，两者不一致时功能就不生效。
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public int versionCode() { return installedVersionCode(); }

            @JavascriptInterface
            public String versionName() {
                try {
                    android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
                    return pi.versionName == null ? "" : pi.versionName;
                } catch (Throwable e) { return ""; }
            }
        }, "NativeVersion");

        // v2.67.0 可靠更新器：多源下载 + APK 版本校验 + 未知来源授权引导。
        // 修复「点了更新、装完还是旧版本」：下载后先解析包内 versionCode，
        // 只要不高于本机就直接判定该源过期并换下一个源，不再把旧包装进手机。
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public boolean hasUpdater() { return true; }

            /** urlsJson：下载地址数组（按优先级）；minCode：要求的最低 versionCode */
            @JavascriptInterface
            public void install(final String urlsJson, final int minCode) {
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        installUpdateInBackground(urlsJson, minCode, "");
                    }
                }).start();
            }

            /** v2.73.0：带 SHA-256 的版本（清单里有 apkSha256 时使用，可拦住任何损坏/被篡改的包） */
            @JavascriptInterface
            public void installV2(final String urlsJson, final int minCode, final String sha256) {
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        installUpdateInBackground(urlsJson, minCode, sha256 == null ? "" : sha256);
                    }
                }).start();
            }

            /** 本机真实安装包 versionCode（页面用来交叉核对，避免被热更新版本号误导） */
            @JavascriptInterface
            public int installedCode() { return installedVersionCode(); }

            /** 清空已下载的安装包缓存（下载失败/包异常时由页面触发重来） */
            @JavascriptInterface
            public void clearCache() { cleanupApkDir(); }
        }, "NativeUpdater");

        // 启用 WebView 远程调试（Chrome://inspect 可看控制台/网络）
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
                WebView.setWebContentsDebuggingEnabled(true);
            }
        } catch (Throwable ignored) {}

        // 站内导航：保留在 WebView 内；http(s) 外链交给系统浏览器
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, String url) {
                if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                        return true;
                    } catch (Throwable ignored) {}
                }
                return false;
            }

            @Override
            public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
                super.onReceivedError(view, errorCode, description, failingUrl);
                Log.e("GaokaoVocab", "WebView error: " + errorCode + " " + description + " url=" + failingUrl);
            }

            // v2.72.0：双指缩放修复 —— 页面 viewport 若被锁死（部分 ROM / 旧 WebView 默认
            // 不允许缩放），这里在页面加载完成后强制改写为可缩放，配合 WebSettings 的
            // setSupportZoom / setBuiltInZoomControls，双指即可 0.5x~4x 缩放整页
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                try {
                    view.evaluateJavascript(
                        "(function(){try{" +
                        "var c='width=device-width, initial-scale=1, minimum-scale=0.5, maximum-scale=4, user-scalable=yes, viewport-fit=cover';" +
                        "var m=document.querySelector('meta[name=viewport]');" +
                        "if(m){m.setAttribute('content',c);}else{m=document.createElement('meta');m.setAttribute('name','viewport');m.setAttribute('content',c);document.head.appendChild(m);}" +
                        "}catch(e){}})()", null);
                } catch (Throwable ignored) {}
            }
        });

        // 收集 console 输出到 Logcat，便于排查 JS 错误
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) {
                Log.d("GaokaoVocab-JS", cm.message() + " (" + cm.sourceId() + ":" + cm.lineNumber() + ")");
                return super.onConsoleMessage(cm);
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                final WebView hitView = new WebView(MainActivity.this);
                hitView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView v, String url) {
                        if (url != null && (url.startsWith("http://") || url.startsWith("https://"))) {
                            try {
                                Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            } catch (Throwable ignored) {}
                        }
                        return true; // 阻止在临时 WebView 内加载
                    }
                });
                try {
                    WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                    transport.setWebView(hitView);
                    resultMsg.sendToTarget();
                } catch (Throwable ignored) {}
                return true;
            }
        });

        // 恢复状态（旋转等）
        if (savedInstanceState != null) {
            try { webView.restoreState(savedInstanceState); } catch (Throwable ignored) {}
        }

        // ===== 云端优先加载策略 =====
        // 1. 先用缓存或本地 assets 立即加载（用户不等待）
        // 2. 后台从云端拉取最新版本，如有更新则缓存并刷新
        loadContent();
    }

    /**
     * 加载内容：安全缓存 > 本地 assets，同时后台检查云端更新
     * v2.55.7: 缓存内容必须通过 isSafeContent 校验，否则删除缓存回退 APK 内置版本
     */
    private void loadContent() {
        // v2.73.0：安装包刚被替换过时，先丢弃升级前缓存的热更新页面，
        // 否则新原生能力会配上旧界面，「装了新版打开还是老样子」。
        resetWebCacheIfApkChanged();
        File cacheFile = new File(getFilesDir(), CACHE_FILE);
        if (cacheFile.exists() && cacheFile.length() > 1000) {
            String cached = readFileText(cacheFile);
            if (isSafeContent(cached)) {
                // 缓存是安全版本，直接加载（上次拉取的版本，离线可用）
                String cachePath = "file://" + cacheFile.getAbsolutePath();
                Log.i("GaokaoVocab", "Loading from cloud cache: " + cachePath);
                setContentView(webView);
                webView.loadUrl(cachePath);
            } else {
                // 缓存是不安全版本（旧版坏 HTML），删除并回退 APK 内置版本
                Log.w("GaokaoVocab", "Cached content unsafe (no __SW_GUARD__), falling back to assets");
                cacheFile.delete();
                setContentView(webView);
                webView.loadUrl("file:///android_asset/public/index.html");
            }
        } else {
            // 首次启动无缓存，加载本地 assets（APK 内置已修复版本）
            Log.i("GaokaoVocab", "No cache, loading local assets");
            setContentView(webView);
            webView.loadUrl("file:///android_asset/public/index.html");
        }
        // 后台检查云端更新（不阻塞 UI）
        checkCloudUpdate();
    }

    /**
     * 后台检查云端更新（v2.59.0 主流方案：版本清单 + Release CDN + gzip）
     *
     * 旧方案问题：每次启动都全量下载 3.2MB 的 index.html 并与缓存逐字节比对，
     * 且 8 秒超时在慢网络下几乎必然失败 —— 这就是"更新不可用"的根因。
     *
     * 新方案：
     *  ① 先拉取约 300 字节的 version.json，比对 versionCode；
     *  ② 版本号一致 → 直接结束，零大流量、秒级完成（解决每次 3.2MB 的痛点）；
     *  ③ 版本号更新 → 优先拉取 gzip 压缩包（体积约为原始 1/4，下载显著加快）；
     *  ④ 源优先级：GitHub Release（CDN 加速、稳定）→ jsDelivr → GitHub Pages；
     *  ⑤ 读取超时放宽到 60 秒，避免大文件在慢网络下被中断。
     */
    private void checkCloudUpdate() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                // ① 版本清单（多源容灾，取所有源里的【最大】版本号）
                int cachedVer = getCachedVersionCode();
                int installedVer = installedVersionCode();
                int remoteVer = -1;
                String remoteName = "";
                // v2.73.0：不再「第一个连通的源说了算」。旧逻辑一旦首选源（jsDelivr 对 @master
                // 有最长 12 小时缓存）滞后，就会永久判定「已是最新」，用户点检查更新毫无反应。
                int stopAt = Math.max(cachedVer, installedVer);
                for (String u : CLOUD_VERSION_URLS) {
                    String txt = httpGetText(u, MANIFEST_TIMEOUT);
                    if (txt == null) continue;
                    int v = parseVersionCode(txt);
                    if (v <= 0) continue;
                    if (v > remoteVer) {
                        remoteVer = v;
                        remoteName = parseVersionName(txt);
                        Log.i("GaokaoVocab", "Manifest from " + u + " -> v" + v + " (" + remoteName + ")");
                    }
                    if (remoteVer > stopAt) break;   // 已确认有更新版本，不必再问其它源
                }
                if (remoteVer > 0 && cachedVer > 0 && remoteVer <= cachedVer) {
                    Log.i("GaokaoVocab", "Up to date (cached v" + cachedVer + " >= remote v" + remoteVer + "), skip download");
                    if (remoteName.length() > 0) saveCacheVersionName(remoteName);
                    return;
                }
                // ② 需要更新（或首次/未知版本）→ 下载正文
                byte[] data = null;
                for (String u : CLOUD_INDEX_URLS) {
                    byte[] cand = httpGetBytes(u + ".gz", true);
                    if (cand == null || cand.length <= 1000) cand = httpGetBytes(u, false);
                    if (cand == null || cand.length <= 1000) continue;
                    String text;
                    try { text = new String(cand, "UTF-8"); } catch (Throwable e) { continue; }
                    if (!text.contains("createRoot") || !isSafeContent(text)) {
                        Log.w("GaokaoVocab", "Index from " + u + " looks invalid, try next");
                        continue;
                    }
                    // v2.73.0 版本一致性闸门：正文必须含有清单声明的版本号。
                    // 镜像（jsDelivr / Gitee）同步有先后，先连上的源可能还是上一版页面；
                    // 命中这条就继续试下一个源，避免把旧页面缓存成「最新版」。
                    if (remoteName.length() > 0 && !text.contains(remoteName)) {
                        Log.w("GaokaoVocab", "Index from " + u + " is stale (missing " + remoteName + "), try next source");
                        continue;
                    }
                    data = cand;
                    Log.i("GaokaoVocab", "Index downloaded from " + u + ", " + cand.length + " bytes");
                    break;
                }
                if (data == null) {
                    Log.w("GaokaoVocab", "All cloud URLs failed, using local/cached version");
                    return;
                }
                String content;
                try {
                    content = new String(data, "UTF-8");
                } catch (Throwable e) {
                    return;
                }
                if (!content.contains("createRoot")) {
                    Log.w("GaokaoVocab", "Cloud content invalid (no createRoot), skip");
                    return;
                }
                if (!isSafeContent(content)) {
                    Log.w("GaokaoVocab", "Cloud content unsafe (no __SW_GUARD__), skip");
                    return;
                }
                try {
                    FileOutputStream fos = openFileOutput(CACHE_FILE, MODE_PRIVATE);
                    fos.write(data);
                    fos.close();
                    saveCachedVersionCode(remoteVer);
                    saveCacheVersionName(remoteName);
                    Log.i("GaokaoVocab", "Cloud content cached (" + data.length + " bytes), reloading");
                } catch (Throwable e) {
                    Log.e("GaokaoVocab", "Write cache failed", e);
                    return;
                }
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        final File cf = new File(getFilesDir(), CACHE_FILE);
                        final String path = "file://" + cf.getAbsolutePath();
                        // v2.62.0：更新不再打断用户。
                        // 若用户正在听读播放 / 答题，则只写缓存（下次启动自动生效）并提示，
                        // 避免"用着用着页面突然跳回首页"
                        try {
                            if (webView != null) {
                                webView.evaluateJavascript(
                                        "(function(){try{return !!(window.__shouldDeferUpdate && window.__shouldDeferUpdate());}catch(e){return false}})()",
                                        new android.webkit.ValueCallback<String>() {
                                            @Override
                                            public void onReceiveValue(String value) {
                                                boolean defer = value != null && value.contains("true");
                                                if (defer) {
                                                    Log.i("GaokaoVocab", "Update deferred to next launch (busy)");
                                                    notifyJs("window.__onUpdateReady && window.__onUpdateReady()");
                                                    return;
                                                }
                                                doReload(path);
                                            }
                                        });
                                return;
                            }
                        } catch (Throwable e) {
                            Log.w("GaokaoVocab", "defer check failed, reload directly", e);
                        }
                        doReload(path);
                    }
                });
            }
        }).start();
    }

    /** 用刚下载好的云端版本刷新页面（JS 侧会自行恢复上次所在页面，不会跳回首页） */
    private void doReload(String path) {
        try {
            Log.i("GaokaoVocab", "Reloading from cloud cache: " + path);
            if (webView != null) webView.loadUrl(path);
        } catch (Throwable e) {
            Log.e("GaokaoVocab", "Reload failed", e);
        }
    }

    /** 读取远程文本（用于极小的版本清单） */
    private String httpGetText(String urlStr, int timeoutMs) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(timeoutMs);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setUseCaches(false);
            if (conn.getResponseCode() != 200) return null;
            InputStream is = conn.getInputStream();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[4096];
            int n;
            while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
            is.close();
            return new String(baos.toByteArray(), "UTF-8");
        } catch (Throwable e) {
            return null;
        } finally {
            if (conn != null) { try { conn.disconnect(); } catch (Throwable ignored) {} }
        }
    }

    /** 读取远程字节；tryGzip=true 时按 gzip 解压（预压缩的 .gz 静态文件） */
    private byte[] httpGetBytes(String urlStr, boolean tryGzip) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(CONNECT_TIMEOUT);
            conn.setReadTimeout(READ_TIMEOUT);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Cache-Control", "no-cache");
            conn.setUseCaches(false);
            if (tryGzip) conn.setRequestProperty("Accept-Encoding", "gzip");
            if (conn.getResponseCode() != 200) return null;
            InputStream is = conn.getInputStream();
            if (tryGzip) is = new GZIPInputStream(is);
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) baos.write(buf, 0, n);
            is.close();
            return baos.toByteArray();
        } catch (Throwable e) {
            return null;
        } finally {
            if (conn != null) { try { conn.disconnect(); } catch (Throwable ignored) {} }
        }
    }

    /** 从版本清单 JSON 提取 versionCode（不依赖 org.json，兼容低版本系统） */
    private int parseVersionCode(String json) {
        try {
            Matcher m = Pattern.compile("\"versionCode\"\\s*:\\s*(\\d+)").matcher(json);
            if (m.find()) return Integer.parseInt(m.group(1));
        } catch (Throwable ignored) {}
        return -1;
    }

    /** 从版本清单提取 versionName（如 2.73.0），用于校验下发的页面是否与清单同版本 */
    private String parseVersionName(String json) {
        try {
            Matcher m = Pattern.compile("\"version\"\\s*:\\s*\"([0-9]+\\.[0-9]+(?:\\.[0-9]+)?)\"").matcher(json);
            if (m.find()) return m.group(1);
        } catch (Throwable ignored) {}
        return "";
    }

    private String getCacheVersionName() {
        try {
            return getSharedPreferences(PREF_NAME, MODE_PRIVATE).getString(PREF_KEY_CACHE_NAME, "");
        } catch (Throwable e) {
            return "";
        }
    }

    private void saveCacheVersionName(String name) {
        try {
            getSharedPreferences(PREF_NAME, MODE_PRIVATE).edit().putString(PREF_KEY_CACHE_NAME, name).apply();
        } catch (Throwable ignored) {}
    }

    private int getCachedVersionCode() {
        try {
            return getSharedPreferences(PREF_NAME, MODE_PRIVATE).getInt(PREF_KEY_VER, -1);
        } catch (Throwable e) {
            return -1;
        }
    }

    private void saveCachedVersionCode(int code) {
        try {
            getSharedPreferences(PREF_NAME, MODE_PRIVATE).edit().putInt(PREF_KEY_VER, code).apply();
        } catch (Throwable ignored) {}
    }


    /**
     * 在主线程执行 JS（用于从后台线程回调 JS）
     */
    private void notifyJs(final String js) {
        if (webView == null) return;
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                try { webView.evaluateJavascript(js, null); } catch (Throwable ignored) {}
            }
        });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            try { webView.saveState(outState); } catch (Throwable ignored) {}
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        // v2.76.0：单页应用（SPA）没有任何浏览器历史，canGoBack() 恒为 false，
        // 旧逻辑直接 super.onBackPressed() → 用户按一下返回就退出整个应用。
        // 现在先把返回键交给页面：页面按「提示卡 → 弹窗 → 听读面板 → 子页面」的层级自行处理，
        // 只有它明确回 "handled" 时才拦截；返回空表示已在主页面，才继续走退出逻辑。
        if (webView != null) {
            final boolean[] settled = new boolean[]{false};
            final Runnable forceExit = new Runnable() {
                @Override
                public void run() {
                    if (settled[0]) return;
                    settled[0] = true;
                    fallbackBack();
                }
            };
            try {
                // 页面若因主线程繁忙没能及时回调，300ms 后按「未处理」收尾，避免返回键毫无反应
                new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(forceExit, 300);
                webView.evaluateJavascript(
                    "(function(){try{return window.__appBack?String(window.__appBack()||''):''}catch(e){return ''}})()",
                    new android.webkit.ValueCallback<String>() {
                        @Override
                        public void onReceiveValue(String value) {
                            if (settled[0]) return;
                            settled[0] = true;
                            boolean handled = value != null && value.indexOf("handled") >= 0;
                            if (!handled) fallbackBack();
                        }
                    });
                return;
            } catch (Throwable ignored) {}
        }
        fallbackBack();
    }

    /** 页面不再消费返回键时的最终行为（保持旧版语义：播放中退到后台，否则退出） */
    private void fallbackBack() {
        // v2.60.0：听读播放中按返回键 → 退到桌面但保留进程与播放（等同音乐 App 行为）。
        // 音频由 PlayerService 前台服务托管，通知栏仍可暂停 / 上一词 / 下一词；
        // 非播放状态维持原退出逻辑
        if (backgroundPlaybackEnabled) {
            try {
                moveTaskToBack(true);
                return;
            } catch (Throwable ignored) {}
        }
        try { super.onBackPressed(); } catch (Throwable ignored) {}
    }

    // ===== v2.76.0 自定义保存目录（SAF） =====

    private SharedPreferences savePrefs() {
        return getSharedPreferences(SAVE_PREFS, MODE_PRIVATE);
    }

    private void loadSaveDir() {
        try {
            SharedPreferences sp = savePrefs();
            sSaveDirUri = sp.getString(PREF_SAVE_DIR_URI, "");
            sSaveDirLabel = sp.getString(PREF_SAVE_DIR_LABEL, "");
        } catch (Throwable ignored) {}
    }

    /** 从 tree URI 推导一个可读目录名（如「下载/背群英」），取不到时给「已选目录」 */
    private String labelOfTree(Uri tree) {
        try {
            String id = DocumentsContract.getTreeDocumentId(tree);
            if (id != null && id.length() > 0) {
                int c = id.indexOf(':');
                String path = c >= 0 ? id.substring(c + 1) : id;
                if (path == null || path.length() == 0) return "内部存储";
                return path;
            }
        } catch (Throwable ignored) {}
        try {
            String seg = tree.getLastPathSegment();
            if (seg != null && seg.length() > 0) return seg;
        } catch (Throwable ignored) {}
        return "已选目录";
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_SAVE_DIR) {
            if (resultCode == Activity.RESULT_OK && data != null && data.getData() != null) {
                Uri tree = data.getData();
                try {
                    // 持久化授权：重启后仍然可写，否则下次启动会因权限失效退回默认目录
                    getContentResolver().takePersistableUriPermission(tree,
                            Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                } catch (Throwable ignored) {}
                sSaveDirUri = tree.toString();
                sSaveDirLabel = labelOfTree(tree);
                try {
                    savePrefs().edit()
                            .putString(PREF_SAVE_DIR_URI, sSaveDirUri)
                            .putString(PREF_SAVE_DIR_LABEL, sSaveDirLabel)
                            .apply();
                } catch (Throwable ignored) {}
                notifyJs("window.__saveDirChanged && window.__saveDirChanged('" + jsEscape(sSaveDirLabel) + "')");
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    /**
     * 写入用户选定目录。成功返回「目录名/文件名」，未选目录或失败返回 null。
     * 用 DocumentsContract.createDocument 直接建文件，不依赖 androidx.documentfile。
     */
    private String saveToCustomDir(File src, String displayName, String mime) {
        if (sSaveDirUri == null || sSaveDirUri.length() == 0) return null;
        OutputStream os = null;
        try {
            Uri tree = Uri.parse(sSaveDirUri);
            Uri doc = DocumentsContract.createDocument(getContentResolver(), tree, mime, displayName);
            if (doc == null) return null;
            os = getContentResolver().openOutputStream(doc);
            if (os == null) return null;
            copyTo(src, os);
            return (sSaveDirLabel.length() > 0 ? sSaveDirLabel : "已选目录") + "/" + displayName;
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "saveToCustomDir failed: " + e.getMessage());
            return null;
        } finally {
            try { if (os != null) os.close(); } catch (Throwable ignored) {}
        }
    }

    private String saveToCustomDirText(String text, String displayName) {
        if (sSaveDirUri == null || sSaveDirUri.length() == 0) return null;
        OutputStream os = null;
        try {
            Uri tree = Uri.parse(sSaveDirUri);
            Uri doc = DocumentsContract.createDocument(getContentResolver(), tree, "application/json", displayName);
            if (doc == null) return null;
            os = getContentResolver().openOutputStream(doc);
            if (os == null) return null;
            os.write(text.getBytes("UTF-8"));
            return (sSaveDirLabel.length() > 0 ? sSaveDirLabel : "已选目录") + "/" + displayName;
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "saveToCustomDirText failed: " + e.getMessage());
            return null;
        } finally {
            try { if (os != null) os.close(); } catch (Throwable ignored) {}
        }
    }

    /** 启动播放服务（API 26+ 需 startForegroundService，失败回退普通 startService） */
    private void startServiceCompat(Intent i) {
        try {
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i);
            else startService(i);
        } catch (Throwable e) {
            try { startService(i); } catch (Throwable ignored) {}
        }
    }

    private void sendPlayerAction(String action) {
        // v2.63.0：服务未运行时直接忽略控制指令（不再用 startForegroundService 拉起服务，
        // 旧逻辑启动后未调 startForeground 会触发 RemoteServiceException 导致无故闪退）
        if (!PlayerService.sRunning) return;
        try {
            Intent i = new Intent(MainActivity.this, PlayerService.class);
            i.setAction(action);
            startServiceCompat(i);
        } catch (Throwable ignored) {}
    }

    /** 启动播放：path 为本地 MP3 文件路径时优先使用，否则用网络地址 */
    private void startPlay(String url, String path, String id, float rate) {
        try {
            Intent i = new Intent(MainActivity.this, PlayerService.class);
            i.setAction(PlayerService.ACTION_PLAY);
            if (path != null && path.length() > 0) i.putExtra(PlayerService.EXTRA_PATH, path);
            if (url != null && url.length() > 0) i.putExtra(PlayerService.EXTRA_URL, url);
            i.putExtra(PlayerService.EXTRA_ID, id == null ? "" : id);
            i.putExtra(PlayerService.EXTRA_RATE, rate);
            // v2.63.0：带上最近一次 setMeta 的标题/释义，通知栏与媒体卡片立刻显示当前单词
            if (sLastTitle != null && sLastTitle.length() > 0) i.putExtra(PlayerService.EXTRA_TITLE, sLastTitle);
            if (sLastArtist != null && sLastArtist.length() > 0) i.putExtra(PlayerService.EXTRA_ARTIST, sLastArtist);
            if (sLastAlbum != null && sLastAlbum.length() > 0) i.putExtra(PlayerService.EXTRA_ALBUM, sLastAlbum);
            startServiceCompat(i);
        } catch (Throwable ignored) {}
    }

    private void sendPlayerMeta(String title, String artist, String album) {
        // v2.63.0：先记住最近的媒体信息，下次启动播放时随 ACTION_PLAY 一起带给服务
        if (title != null && title.length() > 0) sLastTitle = title;
        if (artist != null && artist.length() > 0) sLastArtist = artist;
        if (album != null && album.length() > 0) sLastAlbum = album;
        // 服务未运行时不再拉起（避免 FGS 未调 startForeground 闪退）
        if (!PlayerService.sRunning) return;
        try {
            Intent i = new Intent(MainActivity.this, PlayerService.class);
            i.setAction(PlayerService.ACTION_META);
            if (title != null) i.putExtra(PlayerService.EXTRA_TITLE, title);
            if (artist != null) i.putExtra(PlayerService.EXTRA_ARTIST, artist);
            if (album != null) i.putExtra(PlayerService.EXTRA_ALBUM, album);
            startServiceCompat(i);
        } catch (Throwable ignored) {}
    }

    // ================= MP3 缓存 / 下载 / 保存到下载目录 =================

    /** 音频缓存文件：getCacheDir()/tts/<md5(url)>.mp3 */
    private File ttsCacheFile(String url) {
        if (url == null || url.length() == 0) return null;
        try {
            File dir = new File(getCacheDir(), "tts");
            if (!dir.exists()) dir.mkdirs();
            return new File(dir, md5(url) + ".mp3");
        } catch (Throwable e) {
            return null;
        }
    }

    private String md5(String s) {
        try {
            MessageDigest d = MessageDigest.getInstance("MD5");
            byte[] b = d.digest(s.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte x : b) sb.append(String.format("%02x", x));
            return sb.toString();
        } catch (Throwable e) {
            return String.valueOf(Math.abs(s.hashCode()));
        }
    }

    /** 下载到指定文件（小文件：版本清单 / 热更新正文），成功返回 true。
     *  v2.71.0：原生层加重试 + HTTP Range 断点续传，单源连接中断只续传剩余部分，不再从头重下。 */
    private boolean downloadToFile(String urlStr, File dst, int timeoutMs) {
        for (int attempt = 0; attempt < 3; attempt++) {
            if (downloadToFileOnce(urlStr, dst, timeoutMs)) return true;
            try { Thread.sleep(400); } catch (Throwable ignored) {}
        }
        return false;
    }

    /** 单次下载尝试（带 Range 续传）：已存在 dst 时请求续传，服务器不支持 Range 则整文件覆盖 */
    private boolean downloadToFileOnce(String urlStr, File dst, int timeoutMs) {
        HttpURLConnection conn = null;
        InputStream is = null;
        FileOutputStream fos = null;
        File tmp = null;
        try {
            tmp = new File(dst.getAbsolutePath() + ".tmp");
            if (tmp.exists()) tmp.delete();
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
            long resume = dst.exists() ? dst.length() : 0;
            boolean append = false;
            if (resume > 0) {
                conn.setRequestProperty("Range", "bytes=" + resume + "-");
                append = true;
            }
            int code = conn.getResponseCode();
            if (code == 200) { append = false; }
            else if (code != 206) return false;
            is = conn.getInputStream();
            fos = new FileOutputStream(tmp, append && dst.exists());
            if (append && dst.exists()) { // 把已下载部分先搬到 tmp
                java.io.FileInputStream fin = new java.io.FileInputStream(dst);
                byte[] bb = new byte[8192];
                int rn;
                while ((rn = fin.read(bb)) != -1) fos.write(bb, 0, rn);
                fin.close();
            }
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) != -1) fos.write(buf, 0, n);
            fos.close();
            fos = null;
            if (tmp.length() < 256) return false;   // 空音频视为失败
            if (dst.exists()) dst.delete();
            return tmp.renameTo(dst);
        } catch (Throwable e) {
            return false;
        } finally {
            if (is != null) { try { is.close(); } catch (Throwable ignored) {} }
            if (fos != null) { try { fos.close(); } catch (Throwable ignored) {} }
            if (conn != null) { try { conn.disconnect(); } catch (Throwable ignored) {} }
            if (tmp != null && tmp.exists() && !dst.exists()) { try { tmp.delete(); } catch (Throwable ignored) {} }
        }
    }

    /** 保存文件到手机「下载」目录：API 29+ 用 MediaStore（免权限），低版本用公共目录，失败回退应用专属目录 */
    private String saveToDownloads(File src, String displayName, String mime) {
        // v2.76.0：用户选过保存目录就按他的来，失败再走默认路径
        String custom = saveToCustomDir(src, displayName, mime);
        if (custom != null && custom.length() > 0) return custom;
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Downloads.DISPLAY_NAME, displayName);
                cv.put(MediaStore.Downloads.MIME_TYPE, mime);
                cv.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/背群英");
                cv.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, cv);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    copyTo(src, os);
                    os.close();
                    cv.clear();
                    cv.put(MediaStore.Downloads.IS_PENDING, 0);
                    getContentResolver().update(uri, cv, null, null);
                    return "下载/背群英/" + displayName;
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_DOWNLOADS), "背群英");
                dir.mkdirs();
                File dst = new File(dir, displayName);
                FileOutputStream fos = new FileOutputStream(dst);
                copyTo(src, fos);
                fos.close();
                return dst.getAbsolutePath();
            }
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "saveToDownloads public failed: " + e.getMessage());
        }
        // 兜底：应用专属下载目录（无需任何权限，一定成功）
        try {
            File dir = getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (dir != null) {
                dir.mkdirs();
                File dst = new File(dir, displayName);
                FileOutputStream fos = new FileOutputStream(dst);
                copyTo(src, fos);
                fos.close();
                return dst.getAbsolutePath();
            }
        } catch (Throwable ignored) {}
        return "";
    }

    /**
     * v2.68.0 保存音频到手机「音乐」库（音乐 App 直接可见、可同步到车机 / 手表）：
     * API 29+ 走 MediaStore.Audio.Media（Music/背群英，免权限）；
     * 低版本写公共 Music 目录后立即触发媒体扫描，系统音乐应用马上能扫到。
     * 失败自动回退到 saveToDownloads（下载/背群英）。
     */
    private String saveAudioToMusic(File src, String displayName) {
        String custom = saveToCustomDir(src, displayName, "audio/mpeg");
        if (custom != null && custom.length() > 0) return custom;
        try {
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues cv = new ContentValues();
                cv.put(MediaStore.Audio.Media.DISPLAY_NAME, displayName);
                cv.put(MediaStore.Audio.Media.MIME_TYPE, "audio/mpeg");
                cv.put(MediaStore.Audio.Media.RELATIVE_PATH, Environment.DIRECTORY_MUSIC + "/背群英");
                cv.put(MediaStore.Audio.Media.IS_PENDING, 1);
                Uri uri = getContentResolver().insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI, cv);
                if (uri != null) {
                    OutputStream os = getContentResolver().openOutputStream(uri);
                    copyTo(src, os);
                    os.close();
                    cv.clear();
                    cv.put(MediaStore.Audio.Media.IS_PENDING, 0);
                    getContentResolver().update(uri, cv, null, null);
                    return "音乐/背群英/" + displayName;
                }
            } else {
                File dir = new File(Environment.getExternalStoragePublicDirectory(
                        Environment.DIRECTORY_MUSIC), "背群英");
                dir.mkdirs();
                File dst = new File(dir, displayName);
                FileOutputStream fos = new FileOutputStream(dst);
                copyTo(src, fos);
                fos.close();
                try {
                    android.media.MediaScannerConnection.scanFile(MainActivity.this,
                            new String[]{dst.getAbsolutePath()}, new String[]{"audio/mpeg"}, null);
                } catch (Throwable ignored) {}
                return dst.getAbsolutePath();
            }
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "saveAudioToMusic failed: " + e.getMessage());
        }
        return saveToDownloads(src, displayName, "audio/mpeg");
    }

    private void copyTo(File src, OutputStream os) throws java.io.IOException {        FileInputStream fis = new FileInputStream(src);
        byte[] buf = new byte[8192];
        int n;
        while ((n = fis.read(buf)) != -1) os.write(buf, 0, n);
        fis.close();
    }

    /** 转义字符串，安全地拼进 JS 单引号字符串 */
    private String jsEscape(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "");
    }

    /* ==================================================================
       v2.67.0 可靠更新：多源下载 + 安装包版本校验 + 未知来源授权引导
       根因：页面可被云端热更新抬高版本号，App 便误以为"已是最新版本"；
       而 CDN 镜像可能尚未同步，点更新下载的仍是旧包 —— 装完版本号纹丝不动。
       ================================================================== */

    /** 已下载且确认比本机新的安装包（授权后再次点击可直接安装，无需重下） */
    private File sPendingUpdateApk = null;

    /* ---------- v2.73.0 更新链路加固所需状态 ---------- */
    // 同一时刻只允许一条更新线程：旧版重复点击会让两条线程同时写同一个 apk 文件，
    // 交叉写入必然产出损坏包（这是「下载失败 / 装完还是旧版本」的高频成因）。
    private static final java.util.concurrent.atomic.AtomicBoolean sUpdateRunning =
            new java.util.concurrent.atomic.AtomicBoolean(false);
    // 安装前后用于判定「这次安装到底有没有生效」的版本基线
    private static int sInstallBaselineCode = -1;
    private static int sInstallTargetCode = -1;
    private static long sInstallStartTs = 0L;
    private static boolean sInstallResultReported = true;
    // 安装包下载参数
    private static final int APK_RETRY = 2;                       // 单源最多尝试次数（源有多个，够了）
    private static final long APK_MIN_BYTES = 1024 * 1024;         // 真实包约 4.3MB，<1MB 必为错误页或截断
    private static final long APK_PART_TTL = 30 * 60 * 1000L;      // 残片超过 30 分钟不再续传，直接重下

    private int installedVersionCode() {
        try {
            android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.versionCode;
        } catch (Throwable e) {
            return -1;
        }
    }

    /** 安装包元信息（下载完成后、安装前用于四重校验） */
    private static final class ApkMeta {
        String pkg = "";
        int code = -1;
        String name = "";
        String sig = null;   // 签名证书 SHA-256，用于判断能否覆盖安装
        boolean valid() { return code > 0 && pkg.length() > 0; }
    }

    private String sigHash(android.content.pm.Signature[] sigs) {
        try {
            if (sigs == null || sigs.length == 0) return null;
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest(sigs[0].toByteArray());
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < d.length; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (Throwable e) {
            return null;
        }
    }

    /** 读取 APK 文件的包名 / versionCode / 签名（无需安装） */
    private ApkMeta readApkMeta(File apk) {
        ApkMeta m = new ApkMeta();
        try {
            android.content.pm.PackageInfo pi = getPackageManager()
                    .getPackageArchiveInfo(apk.getAbsolutePath(), PackageManager.GET_SIGNATURES);
            if (pi == null) return m;
            m.pkg = pi.packageName == null ? "" : pi.packageName;
            m.code = pi.versionCode;
            m.name = pi.versionName == null ? "" : pi.versionName;
            m.sig = sigHash(pi.signatures);
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "readApkMeta failed", e);
        }
        return m;
    }

    /** 本机已安装包的签名指纹 */
    private String installedSignatureHash() {
        try {
            android.content.pm.PackageInfo pi = getPackageManager()
                    .getPackageInfo(getPackageName(), PackageManager.GET_SIGNATURES);
            return sigHash(pi.signatures);
        } catch (Throwable e) {
            return null;
        }
    }

    /** 清空安装包缓存目录（下载前清理防污染、安装成功后回收空间） */
    private void cleanupApkDir() {
        try {
            File dir = new File(getCacheDir(), "apk_updates");
            File[] fs = dir.listFiles();
            if (fs != null) {
                for (int i = 0; i < fs.length; i++) {
                    try { fs[i].delete(); } catch (Throwable ignored) {}
                }
            }
        } catch (Throwable ignored) {}
        sPendingUpdateApk = null;
    }

    /**
     * APK 被替换过（升级成功）时，丢弃云端热更新缓存。
     *
     * 这是「装了新版本、打开还是旧界面」的根因：旧版 loadContent() 只要发现缓存文件存在
     * 就直接加载它，而缓存是升级前从云端拉下来的旧页面 —— 新 APK 的原生能力配上旧页面，
     * 用户看到的就是"什么都没变"。升级后必须先清缓存，让 APK 内置页面（与原生同一次构建）
     * 生效，之后的云端热更再从新版本基线往上走。
     */
    private boolean resetWebCacheIfApkChanged() {
        try {
            int cur = installedVersionCode();
            if (cur <= 0) return false;
            int last = getSharedPreferences(PREF_NAME, MODE_PRIVATE).getInt(PREF_KEY_LAST_INSTALL, -1);
            if (last == cur) return false;
            getSharedPreferences(PREF_NAME, MODE_PRIVATE).edit()
                    .putInt(PREF_KEY_LAST_INSTALL, cur).apply();
            // last 为 -1 有两种可能：真正的首次安装（没有缓存，清了也没影响），
            // 或从「尚未记录该字段」的旧版本（v2.72.2 及更早）升级而来 —— 后者一定带着
            // 升级前缓存的热更新页面，必须清掉，否则新原生还是配旧界面。
            File cf = new File(getFilesDir(), CACHE_FILE);
            boolean had = cf.exists();
            if (had) cf.delete();
            getSharedPreferences(PREF_NAME, MODE_PRIVATE).edit()
                    .remove(PREF_KEY_VER).remove(PREF_KEY_CACHE_NAME).apply();
            Log.i("GaokaoVocab", "APK upgraded " + last + " -> " + cur + ", dropped web cache=" + had);
            return had;
        } catch (Throwable e) {
            return false;
        }
    }

    /** 记录一次"已拉起系统安装界面"，之后靠 onResume 判定是否真的装上了 */
    private void onApkInstallLaunched(int targetCode) {
        sInstallBaselineCode = installedVersionCode();
        sInstallTargetCode = targetCode;
        sInstallStartTs = System.currentTimeMillis();
        sInstallResultReported = false;
    }

    /** 回到前台时判定安装结果：版本号涨了 = 成功；25 秒后仍没变 = 用户取消或系统拦截 */
    private void checkPendingInstallResult() {
        if (sInstallResultReported || sInstallBaselineCode <= 0) return;
        int now = installedVersionCode();
        if (now > sInstallBaselineCode) {
            sInstallResultReported = true;
            int target = sInstallTargetCode;
            Log.i("GaokaoVocab", "Install succeeded: " + sInstallBaselineCode + " -> " + now);
            sInstallBaselineCode = -1;
            cleanupApkDir();
            resetWebCacheIfApkChanged();
            notifyJs("window.__apkInstallResult && window.__apkInstallResult('success'," + now + "," + target + ")");
            final String path = "file:///android_asset/public/index.html";
            // 先让页面把「已升级到 vX」的提示渲染出来，1.2 秒后再切到 APK 内置页面
            // （内置页面与本次原生代码同一次构建，避免继续跑升级前的旧热更页面）
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        if (webView == null) return;
                        webView.postDelayed(new Runnable() {
                            @Override public void run() {
                                try { if (webView != null) webView.loadUrl(path); } catch (Throwable ignored) {}
                            }
                        }, 1200);
                    } catch (Throwable ignored) {}
                }
            });
        } else if (System.currentTimeMillis() - sInstallStartTs > 25000L) {
            sInstallResultReported = true;
            Log.w("GaokaoVocab", "Install not effective, still at " + now);
            notifyJs("window.__apkInstallResult && window.__apkInstallResult('unchanged'," + now + ","
                    + sInstallTargetCode + ")");
        }
    }

    private void apkDetail(String evt, String msg) {
        notifyJs("window.__apkUpdateDetail && window.__apkUpdateDetail('" + evt + "','" + jsEscape(msg) + "')");
    }

    /** 文件 SHA-256（与构建流水线发布到清单里的 apkSha256 对应） */
    private String fileSha256(File f) {
        FileInputStream fis = null;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            fis = new FileInputStream(f);
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = fis.read(buf)) != -1) md.update(buf, 0, n);
            byte[] d = md.digest();
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < d.length; i++) sb.append(String.format("%02x", d[i]));
            return sb.toString();
        } catch (Throwable e) {
            return null;
        } finally {
            if (fis != null) { try { fis.close(); } catch (Throwable ignored) {} }
        }
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        try {
            return getPackageManager().canRequestPackageInstalls();
        } catch (Throwable e) {
            return true;
        }
    }

    /** 打开「允许安装未知应用」授权页（Android 8+ 必须，否则 ACTION_VIEW 会被系统直接丢弃） */
    private void requestInstallPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                Intent it = new Intent(android.provider.Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                it.setData(Uri.parse("package:" + getPackageName()));
                it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(it);
            }
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "open unknown source settings failed", e);
        }
    }

    /** 单源重试：失败后短暂等待再续传（残片保留，不重复下载已完成的字节） */
    private boolean downloadApkFile(String urlStr, File target) {
        for (int attempt = 0; attempt < APK_RETRY; attempt++) {
            if (downloadApkFileOnce(urlStr, target)) return true;
            try { Thread.sleep(500); } catch (Throwable ignored) {}
        }
        // 两次都没成功：删掉残片，避免下个源把「别的包的残片」当断点续传基线
        try { if (target.exists()) target.delete(); } catch (Throwable ignored) {}
        return false;
    }

    /**
     * 单次 APK 下载尝试（v2.73.0 重写）
     *
     * 旧实现有三个会造成「下载失败 / 装完还是旧版本」的缺陷：
     *  ① 只要目标文件非空就发 Range 续传 —— 目标可能是上次残留的【完整旧包】或【别的源的残片】，
     *     续传等于把新包尾部拼在旧包屁股上，产出既不是旧包也不是新包的垃圾文件；
     *  ② 完整性判定留了 16KB 容差，CDN 截断的包会被当成功；
     *  ③ 没请求 identity 编码，服务器回 gzip 时 Content-Length 与落地字节对不上，无法校验。
     * 现在：只对本次会话产生、30 分钟内的 .part 续传，校验 Content-Range 起点一致，
     * 逐字节比对总长，小于 1MB 直接判废。
     */
    private boolean downloadApkFileOnce(String urlStr, File part) {
        HttpURLConnection conn = null;
        FileOutputStream fos = null;
        try {
            long resume = 0;
            if (part.exists()) {
                long age = System.currentTimeMillis() - part.lastModified();
                if (part.length() > 0 && age < APK_PART_TTL) {
                    resume = part.length();
                } else {
                    part.delete();
                }
            }
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(12000);
            conn.setReadTimeout(25000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
            conn.setRequestProperty("Accept", "application/vnd.android.package-archive,*/*");
            conn.setRequestProperty("Accept-Encoding", "identity");
            conn.setRequestProperty("Connection", "close");
            conn.setUseCaches(false);
            if (resume > 0) conn.setRequestProperty("Range", "bytes=" + resume + "-");

            int code = conn.getResponseCode();
            long total;
            boolean append;
            if (code == 206 && resume > 0) {
                String cr = conn.getHeaderField("Content-Range");
                long start = -1, end = -1, len = -1;
                try {
                    String s = cr == null ? "" : cr.trim();       // 形如 bytes 1234-9999/10000
                    int sp = s.indexOf(' ');
                    String body = sp >= 0 ? s.substring(sp + 1) : s;
                    int dash = body.indexOf('-');
                    int slash = body.indexOf('/');
                    start = Long.parseLong(body.substring(0, dash).trim());
                    end = Long.parseLong(body.substring(dash + 1, slash).trim());
                    len = Long.parseLong(body.substring(slash + 1).trim());
                } catch (Throwable ignored) {}
                if (start != resume) {
                    // 服务端给的区间起点与本地残片不匹配 → 残片不是这个包的，整包重下
                    try { part.delete(); } catch (Throwable ignored) {}
                    return false;
                }
                append = true;
                total = len > 0 ? len : (end + 1);
            } else if (code == 200) {
                append = false;          // 服务端忽略 Range，回整包 → 覆盖写
                resume = 0;
                total = conn.getContentLength();
            } else if (code == 416) {
                try { part.delete(); } catch (Throwable ignored) {}
                return false;
            } else {
                Log.w("GaokaoVocab", "APK download HTTP " + code + " from " + urlStr);
                return false;
            }

            InputStream is = new java.io.BufferedInputStream(conn.getInputStream(), 32768);
            fos = new FileOutputStream(part, append);
            byte[] buf = new byte[32768];
            int n;
            long downloaded = resume;
            int lastPct = -1;
            while ((n = is.read(buf)) != -1) {
                fos.write(buf, 0, n);
                downloaded += n;
                if (total > 0) {
                    int pct = (int) (downloaded * 100 / total);
                    if (pct >= lastPct + 4) {
                        lastPct = pct;
                        notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(" + pct
                                + ", '下载中 " + pct + "%')");
                    }
                }
            }
            fos.flush();
            fos.close();
            fos = null;
            is.close();

            if (total > 0 && downloaded != total) {
                Log.w("GaokaoVocab", "APK incomplete " + downloaded + "/" + total + ", drop part");
                try { part.delete(); } catch (Throwable ignored) {}
                return false;
            }
            if (part.length() < APK_MIN_BYTES) {
                Log.w("GaokaoVocab", "APK too small: " + part.length());
                try { part.delete(); } catch (Throwable ignored) {}
                return false;
            }
            return true;
        } catch (Throwable e) {
            Log.w("GaokaoVocab", "APK download exception: " + e);
            return false;
        } finally {
            if (fos != null) { try { fos.close(); } catch (Throwable ignored) {} }
            if (conn != null) { try { conn.disconnect(); } catch (Throwable ignored) {} }
        }
    }

    private void launchInstall(File apk, int targetCode) {
        onApkInstallLaunched(targetCode);
        try {
            Uri apkUri;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                apkUri = androidx.core.content.FileProvider.getUriForFile(
                        MainActivity.this, getPackageName() + ".fileprovider", apk);
            } else {
                apkUri = Uri.fromFile(apk);
            }
            Intent it = new Intent(Intent.ACTION_VIEW);
            it.setDataAndType(apkUri, "application/vnd.android.package-archive");
            it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(it);
            apkDetail("installing", "已打开系统安装界面，请点「安装」；装完返回本应用会自动确认是否生效");
        } catch (Throwable e) {
            Log.e("GaokaoVocab", "launch install failed", e);
            apkDetail("error", "无法打开安装界面：" + e.getMessage());
        }
    }

    /**
     * 统一更新入口（v2.73.0 重写）
     *
     * 加固点：
     *  ① 并发保护：重复点击不会起第二条下载线程（旧版会交叉写同一文件 → 必坏包）；
     *  ② 每个源使用唯一的 .part 文件，下载完成才改名成 .apk，杜绝旧包/残片被当作续传基线；
     *  ③ 安装前四重校验：包名、versionCode（必须 > 本机且 ≥ 清单）、签名指纹（必须与本机一致，否则覆盖安装必失败）；
     *  ④ 拉起安装后记录基线，回前台比对真实 installedVersionCode，把「装了还是旧版本」变成可判定结果。
     */
    private void installUpdateInBackground(String urlsJson, int minCode, String expectSha) {
        if (!sUpdateRunning.compareAndSet(false, true)) {
            apkDetail("busy", "更新正在下载中，请稍候…");
            return;
        }
        String downloadedSigMismatch = "";
        try {
            int cur = installedVersionCode();
            if (cur <= 0) {
                apkDetail("error", "读取本机安装包版本失败，请重启应用后重试");
                return;
            }
            // 已存在且已校验过的安装包：授权后再次点击直接安装，不重复下载
            if (sPendingUpdateApk != null && sPendingUpdateApk.exists()) {
                ApkMeta pm = readApkMeta(sPendingUpdateApk);
                if (pm.valid() && getPackageName().equals(pm.pkg)
                        && pm.code > cur && (minCode <= 0 || pm.code >= minCode)) {
                    if (!canInstallPackages()) {
                        apkDetail("permission", "本机尚未允许安装未知应用，已为你打开授权页，请开启后返回再点「立即更新」");
                        requestInstallPermission();
                        return;
                    }
                    notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(100, '下载完成，准备安装...')");
                    launchInstall(sPendingUpdateApk, pm.code);
                    return;
                }
                try { sPendingUpdateApk.delete(); } catch (Throwable ignored) {}
                sPendingUpdateApk = null;
            }
            java.util.ArrayList<String> urls = new java.util.ArrayList<String>();
            try {
                if (urlsJson != null && urlsJson.trim().startsWith("[")) {
                    JSONArray arr = new JSONArray(urlsJson);
                    for (int i = 0; i < arr.length(); i++) {
                        String u = arr.optString(i, "");
                        if (u != null && u.length() > 8) urls.add(u);
                    }
                } else if (urlsJson != null && urlsJson.length() > 8) {
                    urls.add(urlsJson);
                }
            } catch (Throwable e) {
                if (urlsJson != null && urlsJson.length() > 8) urls.add(urlsJson);
            }
            if (urls.isEmpty()) {
                apkDetail("error", "没有可用的下载地址，请改用浏览器下载安装");
                return;
            }
            // 清空历史缓存：每个源都从零开始，杜绝旧包 / 别的源残片混进来
            cleanupApkDir();
            File dir = new File(getCacheDir(), "apk_updates");
            if (!dir.exists()) dir.mkdirs();
            String installedSig = installedSignatureHash();
            String lastReason = "";
            for (int i = 0; i < urls.size(); i++) {
                String u = urls.get(i);
                String stamp = String.valueOf(System.currentTimeMillis());
                File part = new File(dir, "update_" + minCode + "_" + i + "_" + stamp + ".part");
                File apk = new File(dir, "update_" + minCode + "_" + i + "_" + stamp + ".apk");
                apkDetail("source", "正在尝试下载地址 " + (i + 1) + "/" + urls.size());
                notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(0, '连接下载地址 "
                        + (i + 1) + "/" + urls.size() + "...')");
                if (!downloadApkFile(u, part)) {
                    lastReason = "下载地址 " + (i + 1) + "/" + urls.size() + " 无法下载";
                    apkDetail("fail_source", lastReason);
                    continue;
                }
                if (!part.renameTo(apk)) {
                    try { part.delete(); } catch (Throwable ignored) {}
                    lastReason = "下载文件落盘失败，请检查手机存储空间";
                    apkDetail("fail_source", lastReason);
                    continue;
                }
                // 清单带 SHA-256 时按哈希校验：能拦住任何截断/损坏/被替换的包
                if (expectSha != null && expectSha.length() == 64) {
                    String got = fileSha256(apk);
                    if (got == null || !expectSha.equalsIgnoreCase(got)) {
                        try { apk.delete(); } catch (Throwable ignored) {}
                        lastReason = "下载地址 " + (i + 1) + " 内容校验不通过（SHA-256 不一致），自动换源";
                        apkDetail("fail_source", lastReason);
                        continue;
                    }
                }
                ApkMeta meta = readApkMeta(apk);
                if (!meta.valid()) {
                    try { apk.delete(); } catch (Throwable ignored) {}
                    lastReason = "下载地址 " + (i + 1) + " 返回的不是有效安装包";
                    apkDetail("fail_source", lastReason);
                    continue;
                }
                if (!getPackageName().equals(meta.pkg)) {
                    try { apk.delete(); } catch (Throwable ignored) {}
                    lastReason = "下载地址 " + (i + 1) + " 返回的包不属于本应用（" + meta.pkg + "）";
                    apkDetail("fail_source", lastReason);
                    continue;
                }
                if (meta.code <= cur) {
                    try { apk.delete(); } catch (Throwable ignored) {}
                    lastReason = "下载地址 " + (i + 1) + " 仍是旧版本（" + meta.code + " ≤ 本机 " + cur + "），自动换源";
                    apkDetail("old_source", lastReason);
                    continue;
                }
                if (minCode > 0 && meta.code < minCode) {
                    try { apk.delete(); } catch (Throwable ignored) {}
                    lastReason = "下载地址 " + (i + 1) + " 版本不足（" + meta.code + " < 清单 " + minCode + "），自动换源";
                    apkDetail("old_source", lastReason);
                    continue;
                }
                if (installedSig != null && meta.sig != null && !installedSig.equals(meta.sig)) {
                    try { apk.delete(); } catch (Throwable ignored) {}
                    downloadedSigMismatch = "镜像下发的安装包与本机签名不一致（本机 "
                            + installedSig.substring(0, 8) + "，新包 " + meta.sig.substring(0, 8) + "）";
                    apkDetail("signature", downloadedSigMismatch + "，已跳过该源");
                    continue;
                }
                sPendingUpdateApk = apk;
                apkDetail("found", "已获取新安装包 v" + meta.name + "（" + meta.code + "）");
                notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(100, '下载完成，准备安装...')");
                if (!canInstallPackages()) {
                    apkDetail("permission", "本机尚未允许安装未知应用，已为你打开授权页；开启后返回再点一次「立即更新」即可直接安装");
                    requestInstallPermission();
                    return;
                }
                launchInstall(apk, meta.code);
                return;
            }
            if (downloadedSigMismatch.length() > 0) {
                apkDetail("error", downloadedSigMismatch
                        + "，无法覆盖安装。请先卸载旧版本再安装新包（卸载前先在「我的 → 备份」导出词库）");
            } else {
                apkDetail("error", lastReason.length() > 0 ? lastReason : "所有下载地址均失败，请检查网络后重试");
            }
        } catch (Throwable e) {
            Log.e("GaokaoVocab", "installUpdate failed", e);
            apkDetail("error", "更新失败：" + e.getMessage());
        } finally {
            sUpdateRunning.set(false);
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // 听读模式播放中：不暂停 WebView（否则音频被系统静音），保持后台播放
        if (webView != null && !backgroundPlaybackEnabled) {
            try { webView.onPause(); } catch (Throwable ignored) {}
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            try { webView.onResume(); } catch (Throwable ignored) {}
        }
        // v2.73.0：从系统安装界面返回时，比对真实安装版本，判定这次更新到底有没有生效
        checkPendingInstallResult();
    }

    @Override
    protected void onDestroy() {
        // 应用真正退出（用户划掉卡片 / 系统回收）时停止系统播放器，避免残留通知
        try { stopService(new Intent(this, PlayerService.class)); } catch (Throwable ignored) {}
        try { PlayerService.setCallback(null); } catch (Throwable ignored) {}
        if (webView != null) {
            try {
                webView.stopLoading();
                webView.removeAllViews();
                ((android.view.ViewGroup) webView.getParent()).removeView(webView);
                webView.destroy();
            } catch (Throwable ignored) {}
            webView = null;
        }
        super.onDestroy();
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (volumeKeyNavEnabled && (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            String direction = keyCode == KeyEvent.KEYCODE_VOLUME_UP ? "up" : "down";
            final WebView wv = webView;
            if (wv != null) {
                final String js = "window.__volumeKeyNav && window.__volumeKeyNav('" + direction + "')";
                wv.post(new Runnable() {
                    @Override public void run() {
                        try { wv.evaluateJavascript(js, null); } catch (Throwable ignored) {}
                    }
                });
            }
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public boolean onKeyUp(int keyCode, KeyEvent event) {
        if (volumeKeyNavEnabled && (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
            return true; // 消费事件，防止系统音量变化
        }
        return super.onKeyUp(keyCode, event);
    }
}
