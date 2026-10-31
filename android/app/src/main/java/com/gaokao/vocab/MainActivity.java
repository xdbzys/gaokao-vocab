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

    // v2.63.0：最近一次 setMeta 的媒体信息（服务未运行时也记住，启动播放时随 ACTION_PLAY 带给服务）
    private static volatile String sLastTitle = null;
    private static volatile String sLastArtist = null;
    private static volatile String sLastAlbum = null;

    // ===== 云端热更新配置 =====
    // v2.59.0 主流更新方案：① 先拉约 300 字节的版本清单秒级比对 → ② 仅必要时才下载正文（优先 gzip）
    // 第一步：版本清单地址（多源容灾：jsDelivr → GitHub Pages → raw）
    private static final String[] CLOUD_VERSION_URLS = {
        "https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/version.json",
        "https://xdbzys.github.io/gaokao-vocab/version.json",
        "https://raw.githubusercontent.com/xdbzys/gaokao-vocab/master/version.json"
    };
    // 第二步：正文地址（优先 GitHub Release CDN，稳定且加速；jsDelivr / Pages 兜底）
    private static final String[] CLOUD_INDEX_URLS = {
        "https://github.com/xdbzys/gaokao-vocab/releases/latest/download/index.html",
        "https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/web/index.html",
        "https://xdbzys.github.io/gaokao-vocab/web/index.html"
    };
    private static final String CACHE_FILE = "cloud_index.html";
    private static final String PREF_NAME = "cloud_update";
    private static final String PREF_KEY_VER = "cached_version_code";
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
        }, "NativeAudio");

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
                        String path = saveToDownloads(src, name, "audio/mpeg");
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
                if (url == null || url.isEmpty()) return;
                new Thread(new Runnable() {
                    @Override
                    public void run() {
                        try {
                            notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(0, '开始下载...')");
                            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                            conn.setConnectTimeout(15000);
                            conn.setReadTimeout(30000);
                            conn.setRequestMethod("GET");
                            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
                            int code = conn.getResponseCode();
                            if (code != 200) {
                                notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(-1, '下载失败 HTTP " + code + "')");
                                conn.disconnect();
                                return;
                            }
                            int total = conn.getContentLength();
                            InputStream is = conn.getInputStream();
                            File dir = new File(getCacheDir(), "apk_updates");
                            if (!dir.exists()) dir.mkdirs();
                            File apkFile = new File(dir, "update.apk");
                            FileOutputStream fos = new FileOutputStream(apkFile);
                            byte[] buf = new byte[8192];
                            int n, downloaded = 0;
                            while ((n = is.read(buf)) != -1) {
                                fos.write(buf, 0, n);
                                downloaded += n;
                                if (total > 0) {
                                    int pct = downloaded * 100 / total;
                                    notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(" + pct + ", '下载中 " + pct + "%')");
                                }
                            }
                            fos.flush();
                            fos.close();
                            is.close();
                            conn.disconnect();

                            notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(100, '下载完成，准备安装...')");

                            // 触发安装
                            Uri apkUri;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                                apkUri = androidx.core.content.FileProvider.getUriForFile(
                                    MainActivity.this,
                                    getPackageName() + ".fileprovider",
                                    apkFile
                                );
                            } else {
                                apkUri = Uri.fromFile(apkFile);
                            }
                            Intent installIntent = new Intent(Intent.ACTION_VIEW);
                            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                            installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(installIntent);
                        } catch (Throwable e) {
                            Log.e("GaokaoVocab", "APK download/install failed", e);
                            notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(-1, '下载失败: " + e.getMessage() + "')");
                        }
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
                        installUpdateInBackground(urlsJson, minCode);
                    }
                }).start();
            }
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
                // ① 版本清单（多源容灾，取第一个可用）
                int remoteVer = -1;
                for (String u : CLOUD_VERSION_URLS) {
                    String txt = httpGetText(u, MANIFEST_TIMEOUT);
                    if (txt == null) continue;
                    int v = parseVersionCode(txt);
                    if (v > 0) {
                        remoteVer = v;
                        Log.i("GaokaoVocab", "Manifest from " + u + " -> v" + v);
                        break;
                    }
                }
                int cachedVer = getCachedVersionCode();
                if (remoteVer > 0 && cachedVer > 0 && remoteVer <= cachedVer) {
                    Log.i("GaokaoVocab", "Up to date (cached v" + cachedVer + " >= remote v" + remoteVer + "), skip download");
                    return;
                }
                // ② 需要更新（或首次/未知版本）→ 下载正文
                byte[] data = null;
                for (String u : CLOUD_INDEX_URLS) {
                    byte[] gz = httpGetBytes(u + ".gz", true);
                    if (gz != null && gz.length > 1000) {
                        data = gz;
                        Log.i("GaokaoVocab", "Index downloaded (gzip) from " + u + ".gz, " + gz.length + " bytes");
                        break;
                    }
                    byte[] raw = httpGetBytes(u, false);
                    if (raw != null && raw.length > 1000) {
                        data = raw;
                        Log.i("GaokaoVocab", "Index downloaded from " + u + ", " + raw.length + " bytes");
                        break;
                    }
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
        // v2.60.0：听读播放中按返回键 → 退到桌面但保留进程与播放（等同音乐 App 行为）。
        // 音频由 PlayerService 前台服务托管，通知栏仍可暂停 / 上一词 / 下一词；
        // 非播放状态维持原退出逻辑
        if (backgroundPlaybackEnabled) {
            try {
                moveTaskToBack(true);
                return;
            } catch (Throwable ignored) {}
        }
        super.onBackPressed();
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

    /** 下载到指定文件，成功返回 true */
    private boolean downloadToFile(String urlStr, File dst, int timeoutMs) {
        HttpURLConnection conn = null;
        InputStream is = null;
        FileOutputStream fos = null;
        File tmp = null;
        try {
            tmp = new File(dst.getAbsolutePath() + ".tmp");
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(timeoutMs);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
            if (conn.getResponseCode() != 200) return false;
            is = conn.getInputStream();
            fos = new FileOutputStream(tmp);
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

    private void copyTo(File src, OutputStream os) throws java.io.IOException {
        FileInputStream fis = new FileInputStream(src);
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

    private int installedVersionCode() {
        try {
            android.content.pm.PackageInfo pi = getPackageManager().getPackageInfo(getPackageName(), 0);
            return pi.versionCode;
        } catch (Throwable e) {
            return -1;
        }
    }

    /** 解析 APK 文件里的 versionCode（无需安装即可判断新旧） */
    private int archiveVersionCode(File apk) {
        try {
            android.content.pm.PackageInfo pi = getPackageManager()
                    .getPackageArchiveInfo(apk.getAbsolutePath(), 0);
            if (pi == null) return -1;
            return pi.versionCode;
        } catch (Throwable e) {
            return -1;
        }
    }

    private void apkDetail(String evt, String msg) {
        notifyJs("window.__apkUpdateDetail && window.__apkUpdateDetail('" + evt + "','" + jsEscape(msg) + "')");
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

    private boolean downloadApkFile(String urlStr, File target) {
        HttpURLConnection conn = null;
        try {
            URL u = new URL(urlStr);
            conn = (HttpURLConnection) u.openConnection();
            conn.setInstanceFollowRedirects(true);
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
            conn.setRequestProperty("Accept", "application/vnd.android.package-archive,*/*");
            if (conn.getResponseCode() != 200) return false;
            int total = conn.getContentLength();
            InputStream is = new java.io.BufferedInputStream(conn.getInputStream());
            FileOutputStream fos = new FileOutputStream(target);
            byte[] buf = new byte[16384];
            int n, downloaded = 0, lastPct = -1;
            while ((n = is.read(buf)) != -1) {
                fos.write(buf, 0, n);
                downloaded += n;
                if (total > 0) {
                    int pct = downloaded * 100 / total;
                    if (pct != lastPct && pct % 10 == 0) {
                        lastPct = pct;
                        notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(" + pct
                                + ", '下载中 " + pct + "%')");
                    }
                }
            }
            fos.flush();
            fos.close();
            is.close();
            return target.exists() && target.length() > 100000;
        } catch (Throwable e) {
            return false;
        } finally {
            if (conn != null) {
                try { conn.disconnect(); } catch (Throwable ignored) {}
            }
        }
    }

    private void launchInstall(File apk) {
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
            apkDetail("installing", "已打开系统安装界面，请点「安装」。安装完重新打开本应用即为新版本");
        } catch (Throwable e) {
            Log.e("GaokaoVocab", "launch install failed", e);
            apkDetail("error", "无法打开安装界面：" + e.getMessage());
        }
    }

    private void installUpdateInBackground(String urlsJson, int minCode) {
        try {
            int cur = installedVersionCode();
            // 已存在确认更新的安装包：先检查授权，直接安装，避免重复下载
            if (sPendingUpdateApk != null && sPendingUpdateApk.exists()) {
                int pc = archiveVersionCode(sPendingUpdateApk);
                if (pc > cur && (minCode <= 0 || pc >= minCode)) {
                    if (!canInstallPackages()) {
                        apkDetail("permission", "本机尚未允许安装未知应用，已为你打开授权页，请开启后返回再点「立即更新」");
                        requestInstallPermission();
                        return;
                    }
                    notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(100, '下载完成，准备安装...')");
                    launchInstall(sPendingUpdateApk);
                    return;
                }
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
            File dir = new File(getCacheDir(), "apk_updates");
            if (!dir.exists()) dir.mkdirs();
            String lastReason = "";
            for (int i = 0; i < urls.size(); i++) {
                String u = urls.get(i);
                File f = new File(dir, "update_" + i + ".apk");
                try { if (f.exists()) f.delete(); } catch (Throwable ignored) {}
                apkDetail("source", "正在尝试下载地址 " + (i + 1) + "/" + urls.size());
                notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(0, '连接下载地址 "
                        + (i + 1) + "...')");
                if (!downloadApkFile(u, f)) {
                    lastReason = "下载地址 " + (i + 1) + " 无法下载";
                    apkDetail("fail_source", lastReason);
                    continue;
                }
                int pc = archiveVersionCode(f);
                if (pc <= 0) {
                    lastReason = "下载地址 " + (i + 1) + " 返回的不是有效安装包";
                    apkDetail("fail_source", lastReason);
                    continue;
                }
                if (pc <= cur) {
                    lastReason = "下载地址 " + (i + 1) + " 还是旧版本（" + pc + "，本机 " + cur + "），自动换源";
                    apkDetail("old_source", lastReason);
                    continue;
                }
                if (minCode > 0 && pc < minCode) {
                    lastReason = "下载地址 " + (i + 1) + " 版本不足（" + pc + " < " + minCode + "），自动换源";
                    apkDetail("old_source", lastReason);
                    continue;
                }
                sPendingUpdateApk = f;
                apkDetail("found", "已获取新安装包（版本号 " + pc + "）");
                notifyJs("window.__apkUpdateProgress && window.__apkUpdateProgress(100, '下载完成，准备安装...')");
                if (!canInstallPackages()) {
                    apkDetail("permission", "本机尚未允许安装未知应用，已为你打开授权页；请在系统页面开启后返回，再点一次「立即更新」即可直接安装");
                    requestInstallPermission();
                    return;
                }
                launchInstall(f);
                return;
            }
            apkDetail("error", lastReason.length() > 0 ? lastReason : "所有下载地址均失败，请检查网络后重试");
        } catch (Throwable e) {
            Log.e("GaokaoVocab", "installUpdate failed", e);
            apkDetail("error", "更新失败：" + e.getMessage());
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
