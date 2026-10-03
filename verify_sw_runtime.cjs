// 从 dist/index.html 提取两段 SW 清理脚本，模拟 Android WebView 各种异常场景，
// 验证绝不产生 unhandledrejection
// 用法: node verify_sw_runtime.cjs [html路径]
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const html = fs.readFileSync(process.argv[2] || path.join(__dirname, 'dist/index.html'), 'utf8');

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
const headScript = blocks.find(b => b.includes('pRegs'));
if (!headScript) { console.error('FATAL: head SW 清理脚本未找到'); process.exit(1); }
const bundleBlock = blocks.find(b => b.includes('getRegistrations') && !b.includes('pRegs'));
if (!bundleBlock) { console.error('FATAL: bundle 主脚本未找到'); process.exit(1); }
const marker = '"serviceWorker" in navigator';
const mIdx = bundleBlock.indexOf(marker);
if (mIdx === -1) { console.error('FATAL: bundle 中 SW 段标记未找到'); process.exit(1); }
const iifeStart = bundleBlock.lastIndexOf('(function () {', mIdx);
const iifeEnd = bundleBlock.indexOf('})();', mIdx);
if (iifeStart === -1 || iifeEnd === -1) { console.error('FATAL: bundle SW IIFE 边界未找到'); process.exit(1); }
const bundleScript = bundleBlock.slice(iifeStart, iifeEnd + 5);
console.log(`提取: head 脚本 ${headScript.length} 字符; bundle SW IIFE ${bundleScript.length} 字符`);
if (!bundleScript.includes('catch')) { console.error('FATAL: bundle SW IIFE 不含 catch 防护!'); process.exit(1); }

const INVALID_STATE_MSG = 'Failed to get ServiceWorkerRegistration objects: The document is in an invalid state.';
function rejectedP(msg) { return Promise.reject(new TypeError(msg || INVALID_STATE_MSG)); }

function makeSandbox(opts) {
  const calls = { unregister: 0, cacheDelete: 0 };
  const nav = {};
  if (opts.hasSW !== false) {
    const origGetRegs = opts.getRegs || (() => Promise.resolve([]));
    nav.serviceWorker = {
      getRegistrations: function () {
        const p = origGetRegs();
        if (p && p.then) {
          return p.then(function (regs) {
            return (regs || []).map(function (r) {
              const origUn = r.unregister.bind(r);
              return { unregister: function () { calls.unregister++; return origUn(); } };
            });
          });
        }
        return p;
      }
    };
  }
  const sandbox = {
    console: { log() {}, warn() {}, error() {} },
    navigator: nav, Promise, TypeError, Error, setTimeout: () => 0
  };
  sandbox.window = sandbox;
  if (opts.hasCaches !== false) {
    sandbox.caches = {
      keys: opts.keys || (() => Promise.resolve([])),
      delete: (k) => { calls.cacheDelete++; return opts.delete ? opts.delete(k) : Promise.resolve(true); }
    };
  }
  return { sandbox, calls };
}

const scenarios = [
  ['A: Chromium 37 (Android 5.0.2) — 无 serviceWorker API', { hasSW: false, hasCaches: false }],
  ['B: WebView invalid state — getRegistrations() reject', { getRegs: () => rejectedP() }],
  ['C: getRegistrations() 成功返回1个注册, unregister() reject', { getRegs: () => Promise.resolve([{ unregister: () => rejectedP('unregister failed') }]) }],
  ['D: getRegistrations() 同步 throw', { getRegs: () => { throw new Error('sync throw'); } }],
  ['E: caches.keys() reject', { keys: () => rejectedP('storage failed') }],
  ['F: caches.keys() 成功, caches.delete() reject', { keys: () => Promise.resolve(['cache-1', 'cache-2']), delete: () => rejectedP('delete failed') }],
  ['G: 正常 web 环境 — 全部成功', { getRegs: () => Promise.resolve([{ unregister: () => Promise.resolve(true) }]), keys: () => Promise.resolve(['old-cache']), delete: () => Promise.resolve(true) }],
];

(async () => {
  let totalFail = 0;
  for (const [name, code] of [['head 脚本', headScript], ['bundle 末尾段', bundleScript]]) {
    console.log(`\n===== 测试 ${name} (${code.length} 字符) =====`);
    for (const [sname, opts] of scenarios) {
      const rejections = [];
      const handler = (r) => rejections.push(r);
      process.on('unhandledRejection', handler);
      const { sandbox, calls } = makeSandbox(opts);
      let syncThrow = null;
      try {
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox, { timeout: 5000 });
      } catch (e) { syncThrow = e; }
      await new Promise(res => setTimeout(res, 50));
      process.off('unhandledRejection', handler);
      const ok = rejections.length === 0 && !syncThrow;
      if (!ok) totalFail++;
      console.log(`${ok ? '[PASS]' : '[FAIL]'} ${sname}` +
        (syncThrow ? ` — 同步异常: ${syncThrow.message}` : '') +
        (rejections.length ? ` — unhandledRejection x${rejections.length}: ${rejections[0] && rejections[0].message}` : ''));
      if (sname.startsWith('G')) {
        console.log(`        (正常环境行为: unregister/delete 调用 ${calls.unregister + calls.cacheDelete} 次 — 清理逻辑生效)`);
      }
    }
  }
  console.log('');
  if (totalFail === 0) { console.log('全部场景通过: 任何 WebView 异常场景下都不会产生 unhandledRejection'); process.exit(0); }
  console.log(`${totalFail} 个场景失败!`);
  process.exit(1);
})();
