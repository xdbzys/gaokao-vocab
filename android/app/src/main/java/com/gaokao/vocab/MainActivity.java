package com.gaokao.vocab;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebViewClient;
import com.getcapacitor.BridgeActivity;

import java.net.HttpURLConnection;
import java.net.URL;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 修复 WebView 缓存问题：确保 fetch 请求不被缓存
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // 禁用 HTTP 缓存，强制每次请求都走网络
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            // 清除已有的缓存数据
            webView.clearCache(true);
        }
    }
}