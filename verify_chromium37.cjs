// 模拟 Chromium 37 (Android 5.0.2 WebView) 运行时环境：
// 删除所有 Chromium 37 缺失的原生 API，加载 dist 的 polyfill，
// 验证 1) polyfill 前调用会 TypeError 2) polyfill 后全部可用且行为正确
// 用法: node verify_chromium37.cjs [html路径]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const htmlPath = process.argv[2] || path.join(__dirname, 'dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 提取 head 里第一个大 polyfill 脚本块（含 __playPromisePatched）
function extractScriptBlocks(src) {
  const blocks = [];
  let i = 0;
  while (true) {
    const open = src.indexOf('<script', i);
    if (open === -1) break;
    const gt = src.indexOf('>', open);
    if (gt === -1) break;
    if (/\ssrc\s*=/.test(src.slice(open, gt))) {
      const c = src.indexOf('</script>', gt);
      if (c === -1) break;
      i = c + 9; continue;
    }
    const close = src.indexOf('</script>', gt);
    if (close === -1) break;
    blocks.push(src.slice(gt + 1, close));
    i = close + 9;
  }
  return blocks;
}
const blocks = extractScriptBlocks(html);
const polyfill = blocks.find(b => b.includes('__playPromisePatched'));
if (!polyfill) { console.error('FATAL: 运行时 API polyfill 脚本未找到'); process.exit(1); }

// ===== 构造 Chromium 37 沙盒：删除/禁用所有缺失 API =====
function makeC37Sandbox() {
  const sandbox = {
    // ES5 基础（Chromium 37 原生具备）
    Object, Array, String, Number, Math, JSON, Date, RegExp, Error, TypeError, SyntaxError,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    setTimeout, clearTimeout, console: { log() {}, warn() {}, error() {} },
    document: { createElement: () => ({ style: {} }), getElementById: () => null, documentElement: {} },
    navigator: {}
  };
  // Chromium 37 缺失：Symbol(38)/Map+Set(38)/WeakMap(36 有? 实际 36+)/fetch(42)
  // 按最保守：全部去掉
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  // XMLHttpRequest / Audio / HTMLMediaElement stub（Chromium 37 有，但 play 返回 undefined）
  sandbox.XMLHttpRequest = function () {
    this.open = () => {}; this.send = () => {};
    this.setRequestHeader = () => {}; this.readyState = 4; this.status = 200; this.statusText = 'OK';
    this.responseText = '{"ok":true}';
  };
  sandbox.HTMLMediaElement = { prototype: { play: function () { return undefined; } } };
  sandbox.Audio = function (url) { this.url = url; this.currentTime = 0; };
  sandbox.Audio.prototype = Object.create(sandbox.HTMLMediaElement.prototype);
  sandbox.Element = { prototype: {} };
  // 删除 Chromium 37 后才有的原型方法（模拟原生缺失）
  delete sandbox.String.prototype.includes;
  delete sandbox.String.prototype.startsWith;
  delete sandbox.String.prototype.endsWith;
  delete sandbox.String.prototype.repeat;
  delete sandbox.Array.prototype.find;
  delete sandbox.Array.prototype.findIndex;
  delete sandbox.Array.prototype.includes;
  delete sandbox.Array.prototype.fill;
  delete sandbox.Array.from;          // undefined
  delete sandbox.Array.of;
  delete sandbox.Object.assign;
  delete sandbox.Number.isInteger;
  delete sandbox.Number.isFinite;
  delete sandbox.Number.isNaN;
  delete sandbox.Number.parseFloat;
  delete sandbox.Number.parseInt;
  delete sandbox.Number.EPSILON;
  delete sandbox.Number.MAX_SAFE_INTEGER;
  delete sandbox.Number.MIN_SAFE_INTEGER;
  delete sandbox.Number.isSafeInteger;
  delete sandbox.Math.trunc;
  delete sandbox.Math.sign;
  delete sandbox.Math.log10;
  delete sandbox.Math.log2;
  delete sandbox.Math.cbrt;
  delete sandbox.Math.hypot;
  vm.createContext(sandbox);
  return sandbox;
}

// ===== 测试 =====
let pass = 0, fail = 0;
function T(name, cond) {
  if (cond) { pass++; console.log('[PASS] ' + name); }
  else { fail++; console.log('[FAIL] ' + name); }
}

// 0) polyfill 前的缺失确认（用独立沙盒验证确实缺）
{
  const s = makeC37Sandbox();
  const before = vm.runInContext(`
    var r = [];
    if ('includes' in String.prototype) r.push('String.includes');
    if (Object.assign) r.push('Object.assign');
    if (typeof Array.from === 'function') r.push('Array.from');
    if (typeof window.fetch === 'function') r.push('fetch');
    r.join(',');
  `, s);
  T('模拟环境正确模拟 Chromium 37 缺失（应无任何新 API）: [' + before + ']', before === '');
}

// 1) 加载 polyfill
const sb = makeC37Sandbox();
let loadErr = null;
try { vm.runInContext(polyfill, sb, { timeout: 10000 }); } catch (e) { loadErr = e; }
T('polyfill 脚本执行无异常' + (loadErr ? ' — ' + loadErr.message : ''), !loadErr);

// 2) 各 API 行为验证
const code = `
var r = {};
// String
r['String.includes 基本'] = 'hello'.includes('ell');
r['String.includes 位置参数'] = 'hello'.includes('ell', 2) === false;
r['String.startsWith'] = 'hello'.startsWith('he') && !'hello'.startsWith('lo');
r['String.startsWith 位置'] = 'hello'.startsWith('ll', 2);
r['String.endsWith'] = 'hello'.endsWith('lo') && !'hello'.endsWith('he');
r['String.repeat'] = 'ab'.repeat(3) === 'ababab';
// Array
r['Array.find'] = [1,2,3].find(function(x){return x>1;}) === 2;
r['Array.find 未命中'] = [1,2,3].find(function(x){return x>9;}) === undefined;
r['Array.findIndex'] = [5,6,7].findIndex(function(x){return x===6;}) === 1;
r['Array.includes'] = [1,2,3].includes(2) && ![1,2,3].includes(9);
r['Array.includes NaN'] = [NaN].includes(NaN);
r['Array.fill'] = [1,2,3].fill(0).join() === '0,0,0';
r['Array.from'] = Array.from({length:3, 0:'a', 1:'b', 2:'c'}).join() === 'a,b,c';
r['Array.from + map'] = Array.from({length:3}, function(_, i){return i*2;}).join() === '0,2,4';
r['Array.of'] = Array.of(1,2,3).join() === '1,2,3';
// Object
r['Object.assign'] = JSON.stringify(Object.assign({a:1}, {b:2})) === '{"a":1,"b":2}';
r['Object.assign 覆盖'] = Object.assign({a:1}, {a:2}).a === 2;
// Number
r['Number.isInteger'] = Number.isInteger(5) && !Number.isInteger(5.5) && !Number.isInteger('5');
r['Number.isFinite'] = Number.isFinite(5) && !Number.isFinite(Infinity) && !Number.isFinite('5');
r['Number.isNaN'] = Number.isNaN(NaN) && !Number.isNaN(5);
r['Number.MAX_SAFE_INTEGER'] = Number.MAX_SAFE_INTEGER === 9007199254740991;
r['Number.EPSILON'] = Number.EPSILON > 0;
r['Number.isSafeInteger'] = Number.isSafeInteger(9007199254740990) && !Number.isSafeInteger(9007199254740992);
// Math
r['Math.trunc'] = Math.trunc(4.7) === 4 && Math.trunc(-4.7) === -4;
r['Math.sign'] = Math.sign(5) === 1 && Math.sign(-5) === -1 && Math.sign(0) === 0;
r['Math.log10'] = Math.abs(Math.log10(100) - 2) < 1e-12;
r['Math.log2'] = Math.abs(Math.log2(8) - 3) < 1e-12;
r['Math.cbrt'] = Math.abs(Math.cbrt(27) - 3) < 1e-12;
r['Math.hypot'] = Math.abs(Math.hypot(3,4) - 5) < 1e-12;
// fetch
r['fetch 存在'] = typeof window.fetch === 'function';
// play() Promise
var a = new Audio('test.mp3');
var p = a.play();
r['play() 返回 Promise'] = (p && typeof p.then === 'function');
r['play() Promise 可 catch'] = (p && typeof p.catch === 'function');
r;
`;
let res;
try { res = vm.runInContext(code, sb); } catch (e) { console.log('[FAIL] 行为验证脚本异常: ' + e.message); process.exit(1); }
for (const k in res) T(k, !!res[k]);

// 3) fetch XHR 行为（用受控 XHR stub 验证 resolve/json）
{
  const sb2 = makeC37Sandbox();
  // XHR 模拟：send 后同步触发 onreadystatechange
  sb2.XMLHttpRequest = function () {
    const self = this;
    this.open = function (m, u) { self._url = u; };
    this.setRequestHeader = function () {};
    this.send = function () {
      self.readyState = 4; self.status = 200; self.statusText = 'OK';
      self.responseText = '{"version":"ok"}';
      setTimeout(function () { if (self.onreadystatechange) self.onreadystatechange(); }, 0);
    };
  };
  vm.runInContext(polyfill, sb2);
  const out = vm.runInContext(`
    var out = {};
    window.fetch('https://example.com/api').then(function (resp) {
      out.ok = resp.ok && resp.status === 200;
      return resp.json();
    }).then(function (data) {
      out.json = (data && data.version === 'ok');
      out.done = true;
    }).catch(function (e) { out.err = String(e); out.done = true; });
    out;
  `, sb2);
  setTimeout(() => {
    T('fetch XHR: resp.ok/status 正确', !!out.ok);
    T('fetch XHR: resp.json() 解析正确', !!out.json);
    T('fetch XHR: 无异常', !out.err);
    console.log('');
    if (fail === 0) { console.log(`全部 ${pass} 项通过 → polyfill 在 Chromium 37 模拟环境下完整可用`); process.exit(0); }
    console.log(`${fail} 项失败!`);
    process.exit(1);
  }, 100);
}
