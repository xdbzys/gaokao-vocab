import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// 自定义插件：viteSingleFile 之后做两件事：
// 1) 替换 import.meta.* 为安全兜底（非 module 脚本中 import.meta 不可用 → 蓝屏闪退）
// 2) 用 Babel 将内联 JS 转译为 ES5，兼容安卓 5.0.2 (Chromium 37-43)
function postProcessForLegacyWebView() {
  return {
    name: 'post-process-for-legacy-webview',
    enforce: 'post',
    closeBundle() {
      const distDir = path.resolve(__dirname, 'dist');
      const htmlPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(htmlPath)) return;
      let html = fs.readFileSync(htmlPath, 'utf8');

      // 1) 替换 import.meta
      const before = (html.match(/import\.meta/g) || []).length;
      html = html.replace(/import\.meta\.url/g, '""');
      html = html.replace(/import\.meta\.resolve/g, 'undefined');
      html = html.replace(/import\.meta\.env\.[A-Za-z0-9_]+/g, 'undefined');
      html = html.replace(/import\.meta\.env/g, '{}');
      html = html.replace(/import\.meta\.glob[^\n;]*/g, '{}');
      html = html.replace(/import\.meta/g, '{}');
      if (before > 0) {
        console.log(`[post] Replaced ${before} import.meta occurrences`);
      }

      // 1.5) 剥离 <script type="module" ...> 的 module/crossorigin 属性
      // 安卓 5.0.2 WebView (Chromium ~37) 不支持 ES modules (需 Chrome 61+)，
      // 若保留 type="module"，整个内联脚本不会执行 → 白屏。
      // viteSingleFile 已将所有依赖内联进单 <script>，无 import 留存，转经典脚本安全。
      const moduleBefore = (html.match(/<script[^>]*type=["']module["'][^>]*>/gi) || []).length;
      html = html.replace(/(<script\b[^>]*?)\s+type=["']module["']/gi, '$1');
      html = html.replace(/(<script\b[^>]*?)\s+crossorigin(?!["'\w-])/gi, '$1');
      if (moduleBefore > 0) {
        console.log(`[post] Stripped type=module from ${moduleBefore} script tag(s)`);
      }

      // 1.6) 注入 ES6 全局构造器 polyfill（Symbol/Map/Set/WeakMap/WeakSet/Promise）
      // 安卓 5.0.2 WebView (Chromium ~37) 缺失 Map/Set/WeakMap/WeakSet，
      // React 19 重度依赖 new Map()/new Set()，缺失 → ReferenceError → 白屏。
      // 必须在所有业务脚本之前注入。注入到 <head> 第一个 <script> 之前。
      const es6Polyfill = `<script>
        // ===== ES6 全局构造器 polyfill（Chromium 37 兜底）=====
        (function () {
          function def(o, p, v) {
            if (o[p] === undefined) {
              try { Object.defineProperty(o, p, { value: v, writable: true, configurable: true }); }
              catch (e) { o[p] = v; }
            }
          }
          // Symbol（Chrome 38+ 原生；Chromium 37 缺失）
          if (typeof window.Symbol === 'undefined') {
            (function () {
              var counter = 0;
              function Symbol(desc) {
                var s = '@@symbol_' + (desc === undefined ? '' : String(desc)) + '_' + (counter++);
                return s;
              }
              Symbol.iterator = '@@iterator';
              Symbol.for = function (k) { return '@@symbol_' + k; };
              Symbol.keyFor = function () { return undefined; };
              window.Symbol = Symbol;
            })();
          }
          // Promise（Chrome 32+ 原生，Chromium 37 通常已有；缺失则补最小实现）
          if (typeof window.Promise === 'undefined') {
            (function () {
              function Promise(fn) {
                var self = this;
                self.state = 'pending';
                self.value = undefined;
                self.cbs = [];
                function settle(state, val) {
                  if (self.state !== 'pending') return;
                  self.state = state; self.value = val;
                  var cbs = self.cbs; self.cbs = null;
                  for (var i = 0; cbs && i < cbs.length; i++) {
                    try { cbs[i](val); } catch (e) {}
                  }
                }
                try {
                  fn(function (v) { settle('fulfilled', v); },
                     function (e) { settle('rejected', e); });
                } catch (e) { settle('rejected', e); }
              }
              Promise.prototype.then = function (onF, onR) {
                var self = this;
                return new Promise(function (res, rej) {
                  function handle(v) {
                    try {
                      if (self.state === 'fulfilled') { res(onF ? onF(v) : v); }
                      else { rej(onR ? onR(v) : v); }
                    } catch (e) { rej(e); }
                  }
                  if (self.state === 'pending') self.cbs.push(handle);
                  else setTimeout(function () { handle(self.value); }, 0);
                });
              };
              Promise.prototype['catch'] = function (onR) { return this.then(undefined, onR); };
              Promise.resolve = function (v) { return new Promise(function (r) { r(v); }); };
              Promise.reject = function (e) { return new Promise(function (_, r) { r(e); }); };
              Promise.all = function (iter) {
                var arr = [];
                for (var i = 0; i < iter.length; i++) arr.push(iter[i]);
                return new Promise(function (res, rej) {
                  var n = arr.length, out = [];
                  if (n === 0) { res([]); return; }
                  arr.forEach(function (p, idx) {
                    Promise.resolve(p).then(function (v) {
                      out[idx] = v; n--;
                      if (n === 0) res(out);
                    }, rej);
                  });
                });
              };
              Promise.race = function (iter) {
                var arr = [];
                for (var i = 0; i < iter.length; i++) arr.push(iter[i]);
                return new Promise(function (res, rej) {
                  arr.forEach(function (p) { Promise.resolve(p).then(res, rej); });
                });
              };
              window.Promise = Promise;
            })();
          }
          // Map（Chrome 38+ 原生；Chromium 37 缺失）
          if (typeof window.Map === 'undefined') {
            (function () {
              function Map(iter) {
                this._k = []; this._v = [];
                if (iter) {
                  for (var i = 0; i < iter.length; i++) {
                    var e = iter[i];
                    this.set(e[0], e[1]);
                  }
                }
              }
              Map.prototype.set = function (k, v) {
                var i = this._k.indexOf(k);
                if (i < 0) { this._k.push(k); this._v.push(v); }
                else { this._v[i] = v; }
                return this;
              };
              Map.prototype.get = function (k) {
                var i = this._k.indexOf(k);
                return i < 0 ? undefined : this._v[i];
              };
              Map.prototype.has = function (k) { return this._k.indexOf(k) >= 0; };
              Map.prototype['delete'] = function (k) {
                var i = this._k.indexOf(k);
                if (i < 0) return false;
                this._k.splice(i, 1); this._v.splice(i, 1);
                return true;
              };
              Map.prototype.forEach = function (fn, thisArg) {
                for (var i = 0; i < this._k.length; i++) {
                  fn.call(thisArg, this._v[i], this._k[i], this);
                }
              };
              Object.defineProperty(Map.prototype, 'size', { get: function () { return this._k.length; } });
              Map.prototype.clear = function () { this._k = []; this._v = []; };
              Map.prototype.keys = function () { return this._k.slice(); };
              Map.prototype.values = function () { return this._v.slice(); };
              Map.prototype.entries = function () {
                var out = [];
                for (var i = 0; i < this._k.length; i++) out.push([this._k[i], this._v[i]]);
                return out;
              };
              // React 19 用 Symbol.iterator 让 Map 可迭代
              try {
                Object.defineProperty(Map.prototype, (typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator'), {
                  value: function () {
                    var entries = this.entries(); var idx = 0;
                    return { next: function () {
                      return idx < entries.length ? { value: entries[idx++], done: false } : { value: undefined, done: true };
                    }};
                  }
                });
              } catch (e) {}
              window.Map = Map;
            })();
          }
          // Set（Chrome 38+ 原生；Chromium 37 缺失）
          if (typeof window.Set === 'undefined') {
            (function () {
              function Set(iter) { this._a = []; if (iter) { for (var i = 0; i < iter.length; i++) this.add(iter[i]); } }
              Set.prototype.add = function (v) { if (this._a.indexOf(v) < 0) this._a.push(v); return this; };
              Set.prototype.has = function (v) { return this._a.indexOf(v) >= 0; };
              Set.prototype['delete'] = function (v) { var i = this._a.indexOf(v); if (i < 0) return false; this._a.splice(i, 1); return true; };
              Set.prototype.forEach = function (fn, thisArg) { for (var i = 0; i < this._a.length; i++) fn.call(thisArg, this._a[i], this._a[i], this); };
              Object.defineProperty(Set.prototype, 'size', { get: function () { return this._a.length; } });
              Set.prototype.clear = function () { this._a = []; };
              try {
                Object.defineProperty(Set.prototype, (typeof Symbol !== 'undefined' ? Symbol.iterator : '@@iterator'), {
                  value: function () { var a = this._a.slice(); var idx = 0; return { next: function () { return idx < a.length ? { value: a[idx++], done: false } : { value: undefined, done: true }; } }; }
                });
              } catch (e) {}
              window.Set = Set;
            })();
          }
          // WeakMap/WeakSet（Chrome 36+ 原生；缺失则退化为普通 Map/Set 语义）
          if (typeof window.WeakMap === 'undefined') {
            (function () {
              function WeakMap(iter) {
                this._m = new window.Map();
                if (iter) { for (var i = 0; i < iter.length; i++) this._m.set(iter[i][0], iter[i][1]); }
              }
              ['set','get','has','delete'].forEach(function (m) {
                WeakMap.prototype[m] = function () { return this._m[m].apply(this._m, arguments); };
              });
              ['forEach'].forEach(function (m) {
                if (window.Map.prototype[m]) WeakMap.prototype[m] = function () { return this._m[m].apply(this._m, arguments); };
              });
              window.WeakMap = WeakMap;
            })();
          }
          if (typeof window.WeakSet === 'undefined') {
            (function () {
              function WeakSet(iter) {
                this._s = new window.Set();
                if (iter) { for (var i = 0; i < iter.length; i++) this._s.add(iter[i]); }
              }
              ['add','has','delete'].forEach(function (m) {
                WeakSet.prototype[m] = function () { return this._s[m].apply(this._s, arguments); };
              });
              window.WeakSet = WeakSet;
            })();
          }
          // AbortController / AbortSignal（Chrome 66+）—— fetch 取消等场景需要
          if (typeof window.AbortController === 'undefined') {
            (function () {
              function AbortSignal() { this.aborted = false; this._cbs = []; }
              AbortSignal.prototype.addEventListener = function (ev, cb) {
                if (ev === 'abort') { if (this.aborted) { try { cb({ type: 'abort' }); } catch (e) {} } else { this._cbs.push(cb); } }
              };
              AbortSignal.prototype.removeEventListener = function () {};
              AbortSignal.prototype.dispatchEvent = function () {};
              AbortSignal.prototype._fire = function () {
                this.aborted = true;
                var cbs = this._cbs; this._cbs = [];
                for (var i = 0; i < cbs.length; i++) { try { cbs[i]({ type: 'abort' }); } catch (e) {} }
              };
              function AbortController() { this.signal = new AbortSignal(); }
              AbortController.prototype.abort = function () { this.signal._fire(); };
              window.AbortController = AbortController;
              window.AbortSignal = AbortSignal;
            })();
          }
          // TextEncoder / TextDecoder（Chrome 38+）—— React / 部分库可能用到
          if (typeof window.TextEncoder === 'undefined') {
            (function () {
              function TextEncoder() {}
              TextEncoder.prototype.encode = function (str) {
                str = String(str == null ? '' : str);
                var bytes = [];
                for (var i = 0; i < str.length; i++) {
                  var c = str.charCodeAt(i);
                  if (c < 0x80) bytes.push(c);
                  else if (c < 0x800) { bytes.push(0xC0 | (c >> 6)); bytes.push(0x80 | (c & 0x3F)); }
                  else if (c < 0xD800 || c >= 0xE000) { bytes.push(0xE0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3F)); bytes.push(0x80 | (c & 0x3F)); }
                  else {
                    i++; var c2 = str.charCodeAt(i);
                    var cp = 0x10000 + ((c - 0xD800) << 10) + (c2 - 0xDC00);
                    bytes.push(0xF0 | (cp >> 18)); bytes.push(0x80 | ((cp >> 12) & 0x3F));
                    bytes.push(0x80 | ((cp >> 6) & 0x3F)); bytes.push(0x80 | (cp & 0x3F));
                  }
                }
                var u = new Uint8Array(bytes.length);
                for (var j = 0; j < bytes.length; j++) u[j] = bytes[j];
                return u;
              };
              window.TextEncoder = TextEncoder;
            })();
          }
          if (typeof window.TextDecoder === 'undefined') {
            (function () {
              function TextDecoder() {}
              TextDecoder.prototype.decode = function (bytes) {
                var str = '';
                var i = 0;
                while (i < bytes.length) {
                  var b = bytes[i++];
                  if (b < 0x80) str += String.fromCharCode(b);
                  else if (b < 0xE0) { var b2 = bytes[i++]; str += String.fromCharCode(((b & 0x1F) << 6) | (b2 & 0x3F)); }
                  else if (b < 0xF0) { var b2 = bytes[i++]; var b3 = bytes[i++]; str += String.fromCharCode(((b & 0x0F) << 12) | ((b2 & 0x3F) << 6) | (b3 & 0x3F)); }
                  else { var b2 = bytes[i++]; var b3 = bytes[i++]; var b4 = bytes[i++]; var cp = ((b & 0x07) << 18) | ((b2 & 0x3F) << 12) | ((b3 & 0x3F) << 6) | (b4 & 0x3F) - 0x10000; str += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
                }
                return str;
              };
              window.TextDecoder = TextDecoder;
            })();
          }
        })();
      </script>`;
      // 插入到 <head> 之后、第一个 polyfill <script> 之前
      html = html.replace(/<head>([\s\S]*?<script)/, '<head>' + es6Polyfill + '$1');
      console.log('[post] Injected ES6 global constructor polyfill (Symbol/Map/Set/WeakMap/WeakSet/Promise)');

      // 1.7) 注入全局错误捕获脚本：任何 JS 错误都在屏幕上显示（避免白屏看不出原因）
      //      必须在所有业务脚本之前注入。用一个全屏错误层展示错误信息 + 堆栈。
      const errorCaptureScript = `<script>
        (function () {
          function showErr(msg, stack) {
            try {
              var el = document.getElementById('__app_error_overlay__');
              if (!el) {
                el = document.createElement('div');
                el.id = '__app_error_overlay__';
                el.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:2147483647;background:#1a1a2e;color:#f87171;font-family:monospace;font-size:13px;padding:14px;overflow:auto;white-space:pre-wrap;word-break:break-all;line-height:1.5;';
                document.body.appendChild(el);
              }
              var t = (new Date()).toLocaleString();
              el.innerHTML = '<b style="color:#fbbf24">[JS ERROR ' + t + ']</b>\\n' + String(msg).replace(/&/g,'&amp;').replace(/</g,'&lt;') + (stack ? '\\n\\n' + String(stack).replace(/&/g,'&amp;').replace(/</g,'&lt;').slice(0, 2000) : '');
            } catch (e) {}
          }
          window.addEventListener('error', function (e) {
            showErr(e.message + ' (' + (e.filename || '') + ':' + (e.lineno || '') + ')', e.error && e.error.stack);
          }, true);
          window.addEventListener('unhandledrejection', function (e) {
            var r = e.reason;
            showErr('UnhandledRejection: ' + (r && r.message ? r.message : String(r)), r && r.stack);
          }, true);
          // 兜底：脚本块自身 try-catch 也走这里
          window.__showAppError = showErr;
        })();
      </script>`;
      html = html.replace(/(<head>[\s\S]*?<\/script>)/, '$1' + errorCaptureScript);
      console.log('[post] Injected global error capture overlay');

      // 2) 用 Babel 将内联 <script> 转译为 ES5（兼容 Chromium 37+）
      //    注意：必须 modules:'commonjs'，把 ESM 的 import/export 转成 CommonJS。
      //    否则经典脚本里残留 export 语句 → SyntaxError → 整段不执行 → 白屏。
      try {
        const babel = require('@babel/core');
        const scriptRegex = /<script([^>]*)>([\s\S]*?)<\/script>/gi;
        let changed = false;
        html = html.replace(scriptRegex, (match, attrs, code) => {
          if (!code || !code.trim()) return match;
          try {
            const result = babel.transformSync(code, {
              presets: [
                [require('@babel/preset-env'), {
                  targets: { chrome: '37' },
                  loose: true,
                  modules: 'commonjs',
                }],
              ],
              compact: false,
              sourceMaps: false,
            });
            changed = true;
            return `<script${attrs}>${result.code}</script>`;
          } catch (e) {
            console.warn('[post] Babel transform skipped for a script block:', e.message);
            return match;
          }
        });
        if (changed) {
          console.log('[post] Babel ES5 transpile applied to inline scripts');
        }
        // 给每个经典内联脚本块（非 module）注入 CommonJS 兜底：
        // Babel modules:'commonjs' 会把 ESM 顶层 export 转成 exports.default = ...
        // 经典脚本作用域里没有 module/exports → ReferenceError → 整段脚本不执行 → 白屏。
        // 注入：var module = module || {}; var exports = exports || {};
        // 命中既有 exports 时复用（无害），缺失时创建空对象，使赋值不报错。
        html = html.replace(
          /<script((?:(?!type=["']module["'])[^>])*)>([\s\S]*?)<\/script>/gi,
          (m, attrs, code) => {
            if (!code || !code.trim()) return m;
            // 只在脚本确实引用 module/exports 时注入，避免污染纯 IIFE 脚本块
            if (!/\bmodule\b/.test(code) && !/\bexports\b/.test(code)) return m;
            // 注入 module/exports 兜底 + try-catch 包裹：
            // 任何同步错误都调用 window.__showAppError 显示到屏幕，避免白屏看不出原因
            var stub = 'var module=typeof module!=="undefined"&&module||{};var exports=typeof exports!=="undefined"&&exports||{};';
            // 若开头是 "use strict"; 紧跟其后
            var head = code.match(/^(\s*"use strict";\s*)/);
            var body = head ? code.slice(head[1].length) : code;
            var prefix = head ? head[1] + stub : stub;
            var wrapStart = 'try{';
            var wrapEnd = '}catch(__e){try{window.__showAppError(__e&&__e.message?__e.message:String(__e),__e&&__e.stack);}catch(_x){}}';
            return '<script' + attrs + '>' + prefix + wrapStart + body + wrapEnd + '</script>';
          }
        );
      } catch (e) {
        console.warn('[post] Babel not available, skipping ES5 transpile:', e.message);
      }

      fs.writeFileSync(htmlPath, html);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile(), postProcessForLegacyWebView()],
  define: {
    'import.meta.url': JSON.stringify(''),
  },
  build: {
    // es2015：esbuild 可完整支持；后续 Babel 再降级到 ES5
    target: 'es2015',
    cssCodeSplit: false,
  },
});
