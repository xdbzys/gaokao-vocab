package com.gaokao.vocab;

import android.content.Context;
import android.os.Environment;
import android.webkit.JavascriptInterface;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.FilenameFilter;

/**
 * 原生文件读写桥接（替代 @capacitor/filesystem 运行时）
 *
 * 提供与 JS 侧 window.NativeFS 同名的方法：
 *  - mkdir(relPath)        创建目录（基于公共 Documents 目录）
 *  - writeFile(relPath, data)  写文本（UTF-8）
 *  - readFile(relPath)     读文本，失败返回 null
 *  - readdir(relPath)     列目录，返回 JSON 数组字符串
 *  - delete(relPath)       删除文件
 *  - exists(relPath)       判断存在
 *  - downloadDocumentsDir(relPath)  供 Downloads 列目录用
 *
 * 路径基准：Environment.getExternalStoragePublicDirectory(DIRECTORY_DOCUMENTS)
 * 与原 Capacitor Filesystem Directory.Documents 行为一致，
 * 用户可在"文件管理器 → Documents"找到备份文件。
 */
public class NativeFS {
    private final Context ctx;

    public NativeFS(Context c) {
        this.ctx = c;
    }

    /** Documents 根目录。 */
    private File documentsRoot() {
        File docs = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
        if (docs == null) {
            docs = new File(Environment.getExternalStorageDirectory(), "Documents");
        }
        try { if (!docs.exists()) docs.mkdirs(); } catch (Throwable ignored) {}
        return docs;
    }

    /** Downloads 根目录。 */
    private File downloadsRoot() {
        File dl = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
        if (dl == null) {
            dl = new File(Environment.getExternalStorageDirectory(), "Download");
        }
        return dl;
    }

    /** 根据目录标识解析根目录。 */
    private File rootFor(String relPath) {
        // 兼容旧版调用：relPath 形如 "高考词汇备份/xxx.json"
        return documentsRoot();
    }

    /** 安全解析：禁止 ../ 越界。 */
    private File resolve(String relPath) {
        if (relPath == null) relPath = "";
        relPath = relPath.trim();
        if (relPath.startsWith("/")) relPath = relPath.substring(1);
        File base = documentsRoot();
        File target = new File(base, relPath);
        try {
            String baseCanonical = base.getCanonicalPath();
            String targetCanonical = target.getCanonicalPath();
            if (!targetCanonical.startsWith(baseCanonical)) {
                // 越界：返回根目录
                return base;
            }
        } catch (Throwable ignored) {}
        return target;
    }

    @JavascriptInterface
    public boolean mkdir(String relPath) {
        try {
            File f = resolve(relPath);
            if (f.exists()) return true;
            return f.mkdirs() || f.exists();
        } catch (Throwable e) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean writeFile(String relPath, String data) {
        try {
            File f = resolve(relPath);
            File parent = f.getParentFile();
            if (parent != null && !parent.exists()) parent.mkdirs();
            FileOutputStream fos = new FileOutputStream(f);
            try {
                fos.write(data != null ? data.getBytes("UTF-8") : new byte[0]);
                fos.flush();
            } finally {
                fos.close();
            }
            return true;
        } catch (Throwable e) {
            return false;
        }
    }

    /** 读文本：失败返回 null（区别于空文件返回空串）。 */
    @JavascriptInterface
    public String readFile(String relPath) {
        try {
            File f = resolve(relPath);
            if (!f.exists() || !f.isFile()) return null;
            long len = f.length();
            if (len <= 0) return "";
            FileInputStream fis = new FileInputStream(f);
            try {
                byte[] buf = new byte[(int) len];
                int off = 0;
                while (off < buf.length) {
                    int read = fis.read(buf, off, buf.length - off);
                    if (read < 0) break;
                    off += read;
                }
                return new String(buf, 0, off, "UTF-8");
            } finally {
                fis.close();
            }
        } catch (Throwable e) {
            return null;
        }
    }

    /** 列目录：返回 JSON 数组字符串，元素含 name/type/size/mtime/uri。 */
    @JavascriptInterface
    public String readdir(String relPath) {
        try {
            File f = resolve(relPath);
            if (!f.exists() || !f.isDirectory()) return "[]";
            File[] files = f.listFiles();
            JSONArray arr = new JSONArray();
            if (files != null) {
                for (File file : files) {
                    try {
                        JSONObject o = new JSONObject();
                        o.put("name", file.getName());
                        o.put("type", file.isDirectory() ? "directory" : "file");
                        o.put("size", file.length());
                        o.put("mtime", file.lastModified());
                        try {
                            o.put("uri", "file://" + file.getAbsolutePath());
                        } catch (Throwable ignored) {}
                        arr.put(o);
                    } catch (Throwable ignored) {}
                }
            }
            return arr.toString();
        } catch (Throwable e) {
            return "[]";
        }
    }

    /** 列 Downloads 目录：与 readdir 同结构，relPath 为相对 Downloads 的子路径。 */
    @JavascriptInterface
    public String readdirDownloads(String relPath) {
        try {
            File base = downloadsRoot();
            File f = (relPath == null || relPath.isEmpty()) ? base : new File(base, relPath);
            if (!f.exists() || !f.isDirectory()) return "[]";
            File[] files = f.listFiles();
            JSONArray arr = new JSONArray();
            if (files != null) {
                for (File file : files) {
                    try {
                        JSONObject o = new JSONObject();
                        o.put("name", file.getName());
                        o.put("type", file.isDirectory() ? "directory" : "file");
                        o.put("size", file.length());
                        o.put("mtime", file.lastModified());
                        try {
                            o.put("uri", "file://" + file.getAbsolutePath());
                        } catch (Throwable ignored) {}
                        arr.put(o);
                    } catch (Throwable ignored) {}
                }
            }
            return arr.toString();
        } catch (Throwable e) {
            return "[]";
        }
    }

    @JavascriptInterface
    public boolean delete(String relPath) {
        try {
            return resolve(relPath).delete();
        } catch (Throwable e) {
            return false;
        }
    }

    @JavascriptInterface
    public boolean exists(String relPath) {
        try {
            return resolve(relPath).exists();
        } catch (Throwable e) {
            return false;
        }
    }
}
