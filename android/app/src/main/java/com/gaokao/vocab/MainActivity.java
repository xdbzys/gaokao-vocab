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

        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            webView.clearCache(true);

            // 修改 User-Agent 为标准浏览器，避免 Gitee 等 CDN 拦截 WebView 请求
            String originalUA = settings.getUserAgentString();
            String cleanUA = originalUA
                .replace("Capacitor/", "")
                .replace("Capacitor;", ";")
                .replace(" wv", "")
                .replaceAll("\\s+", " ")
                .trim();
            settings.setUserAgentString(cleanUA);
        }
    }
}