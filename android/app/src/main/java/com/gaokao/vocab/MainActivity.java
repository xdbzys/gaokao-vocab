package com.gaokao.vocab;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
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
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.ByteArrayOutputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

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

        // v2.60.0 系统播放器桥接：供 JS 侧 window.NativePlayer 调用
        // 音频改由原生 MediaPlayer 前台服务输出（系统媒体通道）：
        // 退出应用 / 锁屏 / 息屏后继续播放，通知栏与耳机线控可直接控制
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public boolean isAvailable() {
                return true;
            }

            @JavascriptInterface
            public void playUrl(String url, String id, float rate) {
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_PLAY);
                    i.putExtra(PlayerService.EXTRA_URL, url);
                    i.putExtra(PlayerService.EXTRA_ID, id);
                    i.putExtra(PlayerService.EXTRA_RATE, rate);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            @JavascriptInterface
            public void pause() { sendPlayerAction(PlayerService.ACTION_PAUSE); }

            @JavascriptInterface
            public void resume() { sendPlayerAction(PlayerService.ACTION_RESUME); }

            @JavascriptInterface
            public void stop() { sendPlayerAction(PlayerService.ACTION_STOP); }

            @JavascriptInterface
            public void setRate(float rate) {
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_RATE);
                    i.putExtra(PlayerService.EXTRA_RATE, rate);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }

            @JavascriptInterface
            public void setTitle(String title) {
                try {
                    Intent i = new Intent(MainActivity.this, PlayerService.class);
                    i.setAction(PlayerService.ACTION_TITLE);
                    i.putExtra(PlayerService.EXTRA_TITLE, title);
                    startServiceCompat(i);
                } catch (Throwable ignored) {}
            }
        }, "NativePlayer");

        // 播放服务 → JS 回调（播放结束 / 出错 / 通知栏与线控按键）
        try {
            PlayerService.setCallback(new PlayerService.PlayerCallback() {
                @Override
                public void onEvent(String id, String type) {
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
                        try {
                            File cf = new File(getFilesDir(), CACHE_FILE);
                            String path = "file://" + cf.getAbsolutePath();
                            Log.i("GaokaoVocab", "Reloading from cloud cache: " + path);
                            webView.loadUrl(path);
                        } catch (Throwable e) {
                            Log.e("GaokaoVocab", "Reload failed", e);
                        }
                    }
                });
            }
        }).start();
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
        try {
            Intent i = new Intent(MainActivity.this, PlayerService.class);
            i.setAction(action);
            startServiceCompat(i);
        } catch (Throwable ignored) {}
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
