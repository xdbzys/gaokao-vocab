package com.gaokao.vocab;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.KeyEvent;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 纯原生 WebView 容器（不依赖 Capacitor 运行时）
 *
 * 目的：兼容 Android 5.0.2 (API 21) 翻译笔，避免 Capacitor 8
 * 编译产物（要求 API 24+）在低版本系统启动崩溃。
 *
 * - 加载本地 assets/public/index.html（离线可用）
 * - 通过 NativeFS JavascriptInterface 提供文件读写（备份/恢复）
 * - 外链与"立即更新"在浏览器打开
 * - 音量键导航
 */
public class MainActivity extends Activity {

    private WebView webView;
    private static boolean volumeKeyNavEnabled = false;

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
        setContentView(webView);

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

        // 站内导航：保留在 WebView 内
        webView.setWebViewClient(new WebViewClient());

        // 外链/新窗口：交给系统浏览器打开（用于"立即更新"下载）
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, android.os.Message resultMsg) {
                try {
                    WebView.HitTestResult result = view.getHitTestResult();
                    String url = (result != null) ? result.getExtra() : null;
                    if (url == null || url.isEmpty()) {
                        // 取不到具体链接时，回退到主 WebView 的当前 URL
                        url = view.getUrl();
                    }
                    if (url != null && !url.isEmpty()) {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(intent);
                    }
                } catch (Throwable ignored) {}
                // 不创建新 WebView 窗口
                if (resultMsg != null) {
                    try {
                        android.os.Message href = (android.os.Message) resultMsg;
                        // 通知浏览器窗口创建中止（发送空 transport）
                        href.sendToTarget();
                    } catch (Throwable ignored) {}
                }
                return false;
            }
        });

        // 恢复状态（旋转等）
        if (savedInstanceState != null) {
            try { webView.restoreState(savedInstanceState); } catch (Throwable ignored) {}
        }

        // 加载本地构建产物（离线可用）
        webView.loadUrl("file:///android_asset/public/index.html");
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
