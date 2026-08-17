package com.gaokao.vocab;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Base64;
import android.webkit.MimeTypeMap;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Capacitor plugin for in-app APK download and installation.
 * Downloads the APK to app cache, then triggers the system installer via FileProvider URI.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private static final String APK_CACHE_DIR = "apk_updates";
    private Thread downloadThread;

    /**
     * Download APK from the given URL and install it.
     * Reports progress via "apkDownloadProgress" events.
     * Returns the file path on success.
     */
    @PluginMethod
    public void downloadAndInstall(JSObject options, PluginCall call) {
        String apkUrl = options.getString("url");
        if (apkUrl == null || apkUrl.isEmpty()) {
            call.reject("url is required");
            return;
        }

        final String finalUrl = apkUrl;
        final Context ctx = getContext();
        final PluginCall finalCall = call;

        // Cancel any existing download
        if (downloadThread != null && downloadThread.isAlive()) {
            downloadThread.interrupt();
        }

        downloadThread = new Thread(() -> {
            HttpURLConnection conn = null;
            InputStream input = null;
            FileOutputStream output = null;
            File apkFile = null;

            try {
                // Clean old APKs from cache
                File cacheDir = new File(ctx.getCacheDir(), APK_CACHE_DIR);
                if (cacheDir.exists()) {
                    File[] oldFiles = cacheDir.listFiles();
                    if (oldFiles != null) {
                        for (File f : oldFiles) {
                            if (f.getName().endsWith(".apk")) {
                                //noinspection ResultOfMethodCallIgnored
                                f.delete();
                            }
                        }
                    }
                } else {
                    //noinspection ResultOfMethodCallIgnored
                    cacheDir.mkdirs();
                }

                // Download APK
                URL url = new URL(finalUrl);
                conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(30000);
                conn.setReadTimeout(60000);
                conn.setRequestProperty("Accept", "application/vnd.android.package-archive, application/octet-stream, */*");
                conn.setRequestProperty("User-Agent", "Mozilla/5.0 (Linux; Android) AppleWebKit/537.36");
                conn.setInstanceFollowRedirects(true);
                conn.connect();

                int responseCode = conn.getResponseCode();
                if (responseCode != HttpURLConnection.HTTP_OK) {
                    throw new Exception("HTTP " + responseCode);
                }

                int fileSize = conn.getContentLength();
                String fileName = "update_" + System.currentTimeMillis() + ".apk";
                apkFile = new File(cacheDir, fileName);

                input = conn.getInputStream();
                output = new FileOutputStream(apkFile);

                byte[] buffer = new byte[8192];
                int bytesRead;
                long totalRead = 0;
                int lastProgress = -1;

                while ((bytesRead = input.read(buffer)) != -1) {
                    if (Thread.currentThread().isInterrupted()) {
                        throw new InterruptedException("Download cancelled");
                    }
                    output.write(buffer, 0, bytesRead);
                    totalRead += bytesRead;

                    if (fileSize > 0) {
                        int progress = (int) (totalRead * 100 / fileSize);
                        if (progress != lastProgress) {
                            lastProgress = progress;
                            JSObject progressObj = new JSObject();
                            progressObj.put("progress", progress);
                            progressObj.put("downloaded", totalRead);
                            progressObj.put("total", fileSize);
                            notifyListeners("apkDownloadProgress", progressObj);
                        }
                    }
                }

                output.flush();
                output.close();
                input.close();

                // Notify download complete
                JSObject completeObj = new JSObject();
                completeObj.put("progress", 100);
                completeObj.put("path", apkFile.getAbsolutePath());
                notifyListeners("apkDownloadProgress", completeObj);

                // Install APK
                installApk(ctx, apkFile);

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("path", apkFile.getAbsolutePath());
                finalCall.resolve(result);

            } catch (InterruptedException e) {
                // Download was cancelled
                finalCall.reject("Download cancelled");
            } catch (Exception e) {
                finalCall.reject("Download failed: " + e.getMessage());
            } finally {
                try { if (output != null) output.close(); } catch (Exception ignored) {}
                try { if (input != null) input.close(); } catch (Exception ignored) {}
                if (conn != null) conn.disconnect();
            }
        });

        downloadThread.start();
    }

    /**
     * Trigger the system APK installer via Intent.
     */
    private void installApk(Context ctx, File apkFile) {
        Intent intent = new Intent(Intent.ACTION_VIEW);
        String mimeType = "application/vnd.android.package-archive";

        Uri uri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", apkFile);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        } else {
            uri = Uri.fromFile(apkFile);
        }

        intent.setDataAndType(uri, mimeType);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);

        ctx.startActivity(intent);
    }
}
