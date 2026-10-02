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

    // ===== 云端热更新配置 =====
    // 云端 index.html 地址（多源容灾：Gitee raw → jsDelivr CDN → GitHub Pages）
    private static final String[] CLOUD_INDEX_URLS = {
        "https://gitee.com/xdbzys/app/raw/master/web/index.html",
        "https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/web/index.html",
        "https://xdbzys.github.io/gaokao-vocab/web/index.html"
    };
    private static final String CACHE_FILE = "cloud_index.html";
    // 超时时间（毫秒）：翻译笔网络可能较慢
    private static final int DOWNLOAD_TIMEOUT = 8000;

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
     * 后台检查云端是否有新版 index.html
     * 如有更新则下载到缓存，并在下次启动时生效
     */
    private void checkCloudUpdate() {
        new Thread(new Runnable() {
            @Override
            public void run() {
                for (String cloudUrl : CLOUD_INDEX_URLS) {
                    try {
                        Log.i("GaokaoVocab", "Checking cloud: " + cloudUrl);
                        HttpURLConnection conn = (HttpURLConnection) new URL(cloudUrl).openConnection();
                        conn.setConnectTimeout(DOWNLOAD_TIMEOUT);
                        conn.setReadTimeout(DOWNLOAD_TIMEOUT);
                        conn.setRequestMethod("GET");
                        conn.setRequestProperty("Cache-Control", "no-cache");
                        conn.setUseCaches(false);
                        int code = conn.getResponseCode();
                        if (code != 200) {
                            conn.disconnect();
                            continue;
                        }
                        InputStream is = conn.getInputStream();
                        // 读取全部内容
                        java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
                        byte[] buf = new byte[8192];
                        int n;
                        while ((n = is.read(buf)) != -1) {
                            baos.write(buf, 0, n);
                        }
                        is.close();
                        conn.disconnect();
                        byte[] data = baos.toByteArray();
                        if (data.length < 1000) continue; // 内容太短，跳过

                        String content = new String(data, "UTF-8");
                        // 简单校验：必须包含 createRoot 才认为是有效内容
                        if (!content.contains("createRoot")) {
                            Log.w("GaokaoVocab", "Cloud content invalid (no createRoot), skip");
                            continue;
                        }
                        // v2.55.7: 必须含安全标记，防止坏版本再次污染缓存
                        if (!isSafeContent(content)) {
                            Log.w("GaokaoVocab", "Cloud content unsafe (no __SW_GUARD__), skip");
                            continue;
                        }

                        File cacheFile = new File(getFilesDir(), CACHE_FILE);
                        // 比对缓存：如果内容相同则不更新
                        if (cacheFile.exists()) {
                            byte[] oldData = new byte[(int) cacheFile.length()];
                            FileInputStream fis = new FileInputStream(cacheFile);
                            fis.read(oldData);
                            fis.close();
                            String oldContent = new String(oldData, "UTF-8");
                            if (oldContent.equals(content)) {
                                Log.i("GaokaoVocab", "Cloud content same as cache, no update");
                                return; // 内容相同，无需更新
                            }
                        }

                        // 写入缓存
                        FileOutputStream fos = openFileOutput(CACHE_FILE, MODE_PRIVATE);
                        fos.write(data);
                        fos.close();
                        Log.i("GaokaoVocab", "Cloud content cached (" + data.length + " bytes), reloading");

                        // 刷新 WebView（切回主线程）
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
                        return; // 成功，退出循环
                    } catch (Throwable e) {
                        Log.w("GaokaoVocab", "Cloud check failed for " + cloudUrl + ": " + e.getMessage());
                    }
                }
                Log.w("GaokaoVocab", "All cloud URLs failed, using local/cached version");
            }
        }).start();
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
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
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
