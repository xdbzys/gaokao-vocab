// 纯 WebView 原生桥接层（替代 @capacitor/core 与 @capacitor/filesystem 运行时）
// 目的：移除 Capacitor 运行时依赖，兼容 Android 5.0.2 (API 21) 翻译笔
// 原生侧通过 WebView.addJavascriptInterface(window.NativeFS) 暴露文件读写接口

const NativeFS = (typeof window !== 'undefined') ? window.NativeFS : null;

export const Directory = { Documents: 'DOCUMENTS', Downloads: 'DOWNLOADS', Data: 'DATA' };
export const Encoding = { UTF8: 'utf8' };

// Capacitor 兼容对象：供现有 window.Capacitor.Plugins.* 引用
export const Capacitor = {
  isNativePlatform: () => !!NativeFS,
  getPlatform: () => (NativeFS ? 'android' : 'web'),
  convertFileSrc: (filePath) => filePath,
  Plugins: NativeFS ? {
    Filesystem: null, // 由下方 Filesystem 实现承载
    Browser: {
      open: async ({ url }) => {
        if (typeof window !== 'undefined') window.open(url, '_blank');
        return { completed: true };
      }
    }
  } : {}
};

// Filesystem 实现：有原生桥接则走 NativeFS，否则返回 null（由调用方 try/catch 回退到浏览器下载）
export const Filesystem = NativeFS ? {
  mkdir: async (opts) => {
    const path = (opts && opts.path) || '';
    try { NativeFS.mkdir(path); return { success: true }; }
    catch (e) { throw e; }
  },
  writeFile: async (opts) => {
    const path = (opts && opts.path) || '';
    const data = (opts && opts.data != null) ? String(opts.data) : '';
    const ok = NativeFS.writeFile(path, data);
    if (!ok) throw new Error('写入文件失败');
    return { uri: 'file:///Documents/' + path };
  },
  readFile: async (opts) => {
    const path = (opts && opts.path) || '';
    const content = NativeFS.readFile(path);
    if (content === null || content === undefined || content === '') {
      // 区分"空文件"与"读取失败"：原生侧对失败返回 null，对空文件返回 ""
      if (content === null || content === undefined) throw new Error('读取文件失败');
    }
    return { data: content };
  },
  readdir: async (opts) => {
    const path = (opts && opts.path) || '';
    const dir = (opts && opts.directory) || Directory.Documents;
    let files = [];
    try {
      const json = (dir === Directory.Downloads)
        ? NativeFS.readdirDownloads(path)
        : NativeFS.readdir(path);
      files = json ? JSON.parse(json) : [];
    } catch (e) { files = []; }
    return { files };
  },
  deleteFile: async (opts) => {
    const path = (opts && opts.path) || '';
    return { success: NativeFS.delete(path) };
  }
} : null;

if (typeof window !== 'undefined' && NativeFS && !window.Capacitor) {
  window.Capacitor = Capacitor;
}
