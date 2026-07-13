package com.gaokao.vocab;

import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import com.getcapacitor.BridgeActivity;

import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.util.Locale;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 修复 WebView 缓存问题
        WebView webView = this.bridge.getWebView();
        if (webView != null) {
            WebSettings settings = webView.getSettings();
            // 禁用 HTTP 缓存
            settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
            // 清除已有缓存
            webView.clearCache(true);

            // 拦截 Gitee API 请求，强制附加缓存破坏参数并设置 no-cache 头
            webView.setWebViewClient(new com.getcapacitor.CapacitorWebViewClient(this.bridge) {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    String url = request.getUrl().toString();
                    // 对 Gitee API 请求强制附加时间戳参数，破坏缓存
                    if (url.contains("gitee.com/api/v5/repos/") && url.contains("contents/app-update")) {
                        try {
                            String separator = url.contains("?") ? "&" : "?";
                            String cacheBustUrl = url + separator + "_nocache=" + System.currentTimeMillis();
                            URL targetUrl = new URL(cacheBustUrl);
                            HttpURLConnection conn = (HttpURLConnection) targetUrl.openConnection();
                            conn.setRequestProperty("Cache-Control", "no-cache, no-store, max-age=0");
                            conn.setRequestProperty("Pragma", "no-cache");
                            conn.setRequestProperty("User-Agent", "CapacitorWebView");
                            conn.setConnectTimeout(10000);
                            conn.setReadTimeout(10000);

                            String contentType = conn.getContentType();
                            String encoding = conn.getContentEncoding();
                            int statusCode = conn.getResponseCode();
                            if (statusCode == 200) {
                                return new WebResourceResponse(
                                    contentType != null ? contentType : "application/json",
                                    encoding,
                                    conn.getInputStream()
                                );
                            }
                        } catch (Exception e) {
                            // 拦截失败，回退到默认行为
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }
            });
        }
    }
}