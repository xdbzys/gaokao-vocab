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

      // 0) 转义内联脚本中的 </script>
      //    React DOM 创建 script 元素时用 innerHTML = "<script></script>"，
      //    构建后 \x3c 被还原为 <，导致字符串内含 </script>。
      //    HTML 解析器遇到 </script> 会提前结束脚本标签 → 脚本截断 → SyntaxError → 白屏。
      //    必须把脚本内容里的 </script> 转义为 <\/script>（仅转义内容，不动真实闭合标签）。
      //    用状态机精确定位每个脚本块的真实闭合标签（块内最后一个 </script>）。
      {
        let escaped = 0;
        let result = '';
        let i = 0;
        const lower = html.toLowerCase();
        while (i < html.length) {
          const scriptStart = lower.indexOf('<script', i);
          if (scriptStart === -1) {
            result += html.slice(i);
            break;
          }
          // 把 <script 之前的内容加入
          result += html.slice(i, scriptStart);
          // 找开始标签的闭合 >
          const tagEnd = html.indexOf('>', scriptStart);
          if (tagEnd === -1) { result += html.slice(scriptStart); break; }
          const openTag = html.slice(scriptStart, tagEnd + 1);
          // 脚本内容从 > 后开始
          const contentStart = tagEnd + 1;
          // 找下一个 <script 的位置（作为边界）
          const nextScript = lower.indexOf('<script', contentStart);
          // 真实闭合 </script> 是 [contentStart, nextScript) 区间内最后一个
          const searchEnd = nextScript === -1 ? html.length : nextScript;
          const closeIdx = lower.lastIndexOf('</script>', searchEnd - 1);
          if (closeIdx === -1 || closeIdx < contentStart) {
            // 没有闭合标签，原样输出
            result += html.slice(scriptStart);
            break;
          }
          let content = html.slice(contentStart, closeIdx);
          // 转义内容中的所有 </script>
          const matches = content.match(/<\/script>/gi);
          if (matches) {
            escaped += matches.length;
            content = content.replace(/<\/script>/gi, '<\\/script>');
          }
          result += openTag + content + '</script>';
          i = closeIdx + '</script>'.length;
        }
        html = result;
        if (escaped > 0) {
          console.log(`[post] Escaped ${escaped} </script> occurrences inside inline scripts`);
        }
      }

      // 0.5) 修复 viteSingleFile 误替换 React 内部 script 创建字符串
      //    React DOM 用 e.innerHTML = "<script>\x3c/script>" 创建可执行 script 元素。
      //    viteSingleFile 的正则会把字符串内的 <script></script> 当作真实脚本标签，
      //    用整页 HTML（style/head/body/root）替换掉，导致多行非法字符串 → SyntaxError。
      //    匹配从 e.innerHTML = " 到后面的 removeChild，整体还原为正确字符串。
      {
        const before = html.length;
        // 匹配从 e.innerHTML = " 到 e.removeChild 的整段（含被污染的多行字符串），整体替换
        html = html.replace(
          /e\.innerHTML\s*=\s*"[\s\S]*?e\.removeChild/g,
          'e.innerHTML = "<script>\\x3c/script>", e = e.removeChild'
        );
        if (html.length !== before) {
          console.log('[post] Restored React innerHTML script-creation string (fixed viteSingleFile corruption)');
        }
      }

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

          // ===== Chromium 37 运行时 API polyfill =====
          // Babel preset-env 只转译语法（无 useBuiltIns/core-js），
          // 以下方法在旧 WebView（Chromium <41/42/45）原生缺失 → TypeError：
          //   String.prototype.includes/startsWith/endsWith（41+）
          //   Object.assign（45+）Array.from/of、Array.prototype.find/findIndex/includes/fill（45+）
          //   Number.isInteger 等（ES6）、Math.trunc/sign 等（ES6）
          //   window.fetch（42+）、Element.prototype.closest（41+）
          //   HTMLMediaElement.play() 返回 Promise（50+，37 返回 undefined → .catch 报错）
          // 音标/POS 处理与自动发音链路重度依赖以上 API。
          (function () {
            var Sp = String.prototype;
            if (!Sp.includes) {
              Sp.includes = function (s, p) {
                var t = this;
                if (s instanceof RegExp) throw new TypeError('First argument to String.prototype.includes must not be a regular expression');
                return t.indexOf(s, p) !== -1;
              };
            }
            if (!Sp.startsWith) {
              Sp.startsWith = function (s, p) {
                var t = String(this);
                if (s instanceof RegExp) throw new TypeError('First argument to String.prototype.startsWith must not be a regular expression');
                p = p >>> 0;
                var n = t.slice(p);
                return n.slice(0, s.length) === s;
              };
            }
            if (!Sp.endsWith) {
              Sp.endsWith = function (s, p) {
                var t = String(this);
                if (s instanceof RegExp) throw new TypeError('First argument to String.prototype.endsWith must not be a regular expression');
                if (p === undefined) p = t.length;
                p = p >>> 0;
                var n = t.slice(0, Math.min(p, t.length));
                return n.slice(n.length - s.length) === s;
              };
            }
            if (!Sp.repeat) {
              Sp.repeat = function (n) {
                var t = String(this);
                n = n >>> 0;
                var out = '';
                for (var i = 0; i < n; i++) out += t;
                return out;
              };
            }
            var Ap = Array.prototype;
            var Op = Object.prototype;
            if (!Ap.find) {
              Ap.find = function (fn) {
                if (this == null) throw new TypeError('Array.prototype.find called on null or undefined');
                var o = Object(this), len = o.length >>> 0;
                for (var i = 0; i < len; i++) { if (fn(o[i], i, o)) return o[i]; }
                return undefined;
              };
            }
            if (!Ap.findIndex) {
              Ap.findIndex = function (fn) {
                if (this == null) throw new TypeError('Array.prototype.findIndex called on null or undefined');
                var o = Object(this), len = o.length >>> 0;
                for (var i = 0; i < len; i++) { if (fn(o[i], i, o)) return i; }
                return -1;
              };
            }
            if (!Ap.includes) {
              Ap.includes = function (v) {
                var o = Object(this), len = o.length >>> 0;
                for (var i = 0; i < len; i++) { if (v === o[i] || (v !== v && o[i] !== o[i])) return true; }
                return false;
              };
            }
            if (!Ap.fill) {
              Ap.fill = function (v, s, e) {
                var o = Object(this), len = o.length >>> 0;
                s = s >>> 0; e = (e === undefined) ? len : e >>> 0;
                for (var i = s; i < Math.min(e, len); i++) o[i] = v;
                return o;
              };
            }
            if (typeof Array.from !== 'function') {
              Array.from = function (arrLike, mapFn) {
                var out = [];
                if (arrLike == null) return out;
                var len = arrLike.length >>> 0;
                for (var i = 0; i < len; i++) {
                  var v = arrLike[i];
                  out.push(mapFn ? mapFn(v, i) : v);
                }
                return out;
              };
            }
            if (typeof Array.of !== 'function') {
              Array.of = function () { return Ap.slice.call(arguments); };
            }
            if (typeof Object.assign !== 'function') {
              Object.assign = function (target) {
                if (target == null) throw new TypeError('Cannot convert undefined or null to object');
                var to = Object(target);
                for (var i = 1; i < arguments.length; i++) {
                  var src = arguments[i];
                  if (src != null) {
                    for (var k in src) { if (Op.hasOwnProperty.call(src, k)) to[k] = src[k]; }
                  }
                }
                return to;
              };
            }
            if (!Number.isInteger) Number.isInteger = function (v) { return typeof v === 'number' && isFinite(v) && Math.floor(v) === v; };
            if (!Number.isFinite) Number.isFinite = function (v) { return typeof v === 'number' && isFinite(v); };
            if (!Number.isNaN) Number.isNaN = function (v) { return typeof v === 'number' && isNaN(v); };
            if (!Number.parseFloat) Number.parseFloat = parseFloat;
            if (!Number.parseInt) Number.parseInt = parseInt;
            if (!Number.EPSILON) Number.EPSILON = 2.220446049250313e-16;
            if (!Number.MAX_SAFE_INTEGER) Number.MAX_SAFE_INTEGER = 9007199254740991;
            if (!Number.MIN_SAFE_INTEGER) Number.MIN_SAFE_INTEGER = -9007199254740991;
            if (!Number.isSafeInteger) Number.isSafeInteger = function (v) { return Number.isInteger(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER; };
            if (!Math.trunc) Math.trunc = function (v) { v = +v; return (v < 0 ? Math.ceil(v) : Math.floor(v)); };
            if (!Math.sign) Math.sign = function (v) { v = +v; if (v === 0 || isNaN(v)) return v; return v > 0 ? 1 : -1; };
            if (!Math.log10) Math.log10 = function (v) { return Math.log(v) / Math.LN10; };
            if (!Math.log2) Math.log2 = function (v) { return Math.log(v) / Math.LN2; };
            if (!Math.cbrt) Math.cbrt = function (v) { var n = +v; return n < 0 ? -Math.pow(-n, 1 / 3) : Math.pow(n, 1 / 3); };
            if (!Math.hypot) Math.hypot = function () { var s = 0; for (var i = 0; i < arguments.length; i++) s += arguments[i] * arguments[i]; return Math.sqrt(s); };
            // Element.closest（41+）
            if (typeof Element !== 'undefined' && !Element.prototype.closest) {
              Element.prototype.closest = function (sel) {
                var el = this;
                while (el && el.nodeType === 1) {
                  if (_matches(el, sel)) return el;
                  el = el.parentNode || (el.host || null);
                }
                return null;
              };
            }
            function _matches(el, sel) {
              if (el.matches) return el.matches(sel);
              if (el.msMatchesSelector) return el.msMatchesSelector(sel);
              if (el.webkitMatchesSelector) return el.webkitMatchesSelector(sel);
              var doc = el.ownerDocument;
              var all = doc.querySelectorAll(sel);
              for (var i = 0; i < all.length; i++) { if (all[i] === el) return true; }
              return false;
            }
            // fetch（42+）：基于 XHR 的最小实现（支持 method/headers/body + Response.text/json）
            if (typeof window.fetch !== 'function') {
              window.fetch = function (input, init) {
                init = init || {};
                return new Promise(function (resolve, reject) {
                  try {
                    var url = (typeof input === 'string') ? input : ((input && input.url) || String(input));
                    var method = (init.method || (input && input.method) || 'GET').toUpperCase();
                    var xhr = new XMLHttpRequest();
                    xhr.open(method, url, true);
                    var headers = init.headers || (input && input.headers) || {};
                    for (var k in headers) {
                      if (Op.hasOwnProperty.call(headers, k)) {
                        try { xhr.setRequestHeader(k, headers[k]); } catch (e) {}
                      }
                    }
                    xhr.onreadystatechange = function () {
                      if (xhr.readyState !== 4) return;
                      var resp = {
                        ok: xhr.status >= 200 && xhr.status < 300,
                        status: xhr.status,
                        statusText: xhr.statusText,
                        url: url,
                        text: function () { return Promise.resolve(String(xhr.responseText)); },
                        json: function () {
                          return new Promise(function (res, rej) {
                            try { res(JSON.parse(String(xhr.responseText))); }
                            catch (e) { rej(new SyntaxError('Unexpected token in JSON')); }
                          });
                        }
                      };
                      resolve(resp);
                    };
                    xhr.onerror = function () { reject(new TypeError('Network request failed: ' + url)); };
                    xhr.ontimeout = function () { reject(new TypeError('Network request timed out: ' + url)); };
                    var body = init.body || (input && input.body) || null;
                    if (body && typeof body === 'object') { try { body = JSON.stringify(body); } catch (e) {} }
                    xhr.send(body);
                  } catch (e) { reject(e); }
                });
              };
            }
            // HTMLMediaElement.play() 返回 Promise（50+；Chromium 37 返回 undefined，
            // 业务代码 audio.play().catch(...) 会 TypeError → 自动发音崩）
            (function () {
              var mp = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
              if (!mp || mp.__playPromisePatched) return;
              var origPlay = mp.play;
              mp.__playPromisePatched = true;
              mp.play = function () {
                var self = this;
                try {
                  var r = origPlay.call(self);
                  if (r && typeof r.then === 'function') return r;
                  return Promise.resolve();
                } catch (e) {
                  return Promise.reject(e);
                }
              };
            })();
          })();
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
                // body 可能尚未解析（脚本在 head 中提前执行时），回退到 documentElement
                var host = document.body || document.documentElement;
                if (host) host.appendChild(el);
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
        let scriptIdx = 0;
        html = html.replace(scriptRegex, (match, attrs, code) => {
          if (!code || !code.trim()) return match;
          console.log(`[post] Babel processing script ${scriptIdx}: len=${code.length}, hasCorruptedInnerHTML=${code.includes('e.innerHTML = "\n')}`);
          scriptIdx++;
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
            // Babel 会把字符串里的 \x3c 还原为 <，导致出现 </script>，
            // 必须在放回 HTML 前转义，否则 HTML 解析器会误判脚本结束。
            const safeCode = result.code.replace(/<\/script>/gi, '<\\/script>');
            return `<script${attrs}>${safeCode}</script>`;
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

      // 3) 将主应用脚本从 <head> 移到 </body> 之前
      //    原因：type="module" 已被剥离（兼容 Android 5.0.2 Chromium 37），
      //    经典脚本在 <head> 中会同步执行，此时 <body> 与 <div id="root"> 尚未解析，
      //    document.getElementById('root') 返回 null → createRoot(null) 抛错 → 白屏。
      //    移到 body 末尾可保证 #root 已存在。polyfill/错误捕获脚本仍留在 head。
      //    注意：必须用状态机精确定位脚本块，因为脚本内容字符串里可能含 <script>/</script>。
      try {
        const bodyEndIdx = html.lastIndexOf('</body>');
        if (bodyEndIdx > 0) {
          // 用状态机找出所有脚本块
          const blocks = [];
          {
            let i = 0;
            const lower = html.toLowerCase();
            while (i < html.length) {
              const s = lower.indexOf('<script', i);
              if (s === -1) break;
              const tagEnd = html.indexOf('>', s);
              if (tagEnd === -1) break;
              const contentStart = tagEnd + 1;
              // 查找真实闭合 </script>（跳过字符串内的 <script>）
              let closeIdx = -1;
              let scanFrom = contentStart;
              while (scanFrom < html.length) {
                const nextScript = lower.indexOf('<script', scanFrom);
                const searchEnd = nextScript === -1 ? html.length : nextScript;
                closeIdx = lower.lastIndexOf('</script>', searchEnd - 1);
                if (closeIdx >= contentStart) break;
                if (nextScript === -1) { closeIdx = -1; break; }
                scanFrom = nextScript + 7;
              }
              if (closeIdx === -1 || closeIdx < contentStart) break;
              blocks.push({ start: s, end: closeIdx + '</script>'.length, content: html.slice(contentStart, closeIdx) });
              i = closeIdx + '</script>'.length;
            }
          }
          // 找到主应用脚本（含 createRoot）
          const mainBlock = blocks.find(b => /createRoot/.test(b.content));
          if (mainBlock) {
            const scriptBlock = html.slice(mainBlock.start, mainBlock.end);
            // 从原位置移除
            html = html.slice(0, mainBlock.start) + html.slice(mainBlock.end);
            // 插入到 </body> 之前（移除后重新定位）
            const realBodyEnd = html.lastIndexOf('</body>');
            if (realBodyEnd > 0) {
              html = html.slice(0, realBodyEnd) + scriptBlock + html.slice(realBodyEnd);
              console.log('[post] Moved main app script to end of <body> (after #root)');
            }
          }
        }
      } catch (e) {
        console.warn('[post] Failed to move main script to body:', e.message);
      }

      // 最终兜底：转义所有内联脚本内容中的 </script> 和控制字符
      // Babel 可能把 \x3c/script> 或 <\/script> 还原为 </script>，
      // 也可能把 \xNN 转义还原为字面控制字节（如 ZIP 签名 "PK\x03\x04"），
      // 必须在写入文件前最后做一次转义，确保 HTML 解析器和 JS 引擎不会出错。
      {
        let escaped = 0;
        let result = '';
        let i = 0;
        const lower = html.toLowerCase();
        while (i < html.length) {
          const scriptStart = lower.indexOf('<script', i);
          if (scriptStart === -1) { result += html.slice(i); break; }
          result += html.slice(i, scriptStart);
          const tagEnd = html.indexOf('>', scriptStart);
          if (tagEnd === -1) { result += html.slice(scriptStart); break; }
          const openTag = html.slice(scriptStart, tagEnd + 1);
          const contentStart = tagEnd + 1;
          // 查找真实的闭合 </script>：
          // 脚本内容字符串里可能含 <script>（如 React 的 innerHTML 字符串），
          // 此时 nextScript 指向字符串内的 <script>，前面没有 </script>，
          // 需要跳过它继续找下一个 <script>，直到找到有 </script> 闭合的真实脚本块。
          let closeIdx = -1;
          let scanFrom = contentStart;
          while (scanFrom < html.length) {
            const nextScript = lower.indexOf('<script', scanFrom);
            const searchEnd = nextScript === -1 ? html.length : nextScript;
            closeIdx = lower.lastIndexOf('</script>', searchEnd - 1);
            if (closeIdx >= contentStart) break; // 找到真实闭合
            if (nextScript === -1) { closeIdx = -1; break; }
            scanFrom = nextScript + 7; // 跳过字符串内的 <script>
          }
          if (closeIdx === -1 || closeIdx < contentStart) {
            result += html.slice(scriptStart); break;
          }
          let content = html.slice(contentStart, closeIdx);
          const matches = content.match(/<\/script>/gi);
          if (matches) {
            escaped += matches.length;
            content = content.replace(/<\/script>/gi, '<\\/script>');
          }
          // 转义控制字符（0x00-0x1F，除 \n\r\t）
          content = content.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, function (c) {
            return '\\x' + c.charCodeAt(0).toString(16).padStart(2, '0');
          });
          result += openTag + content + '</script>';
          i = closeIdx + '</script>'.length;
        }
        html = result;
        if (escaped > 0) {
          console.log(`[post] Final escape: ${escaped} </script> inside scripts`);
        }
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
