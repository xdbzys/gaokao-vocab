#!/usr/bin/env node
/**
 * App 单文件产物构建（dist/index.html）
 * ---------------------------------------------------------------
 * 这是 Android WebView 云端热更用的「一个 HTML 包住全部」格式：
 * CI 把它同时放进 APK assets 和 Release 资产（web/index.html），App 只认单文件。
 * 所以网页版的多文件改造（scripts/build-web.cjs）不能影响这里。
 *
 * v2.79.0 体积回归处理：
 *   改造后本产物一度到 4.60MB / gzip 1.09MB（改造前 3.37MB / gzip 1.02MB）。
 *   esbuild metafile 归因（未压缩基线，各输入在输出中的字节数）：
 *     react-dom-client.development.js 1,144,853
 *     vendor/wordEnrichment.js           773,127   ← v2.78 起新增的例句数据
 *     vendor/gaokaoMasterVocab.js        528,719
 *     main.jsx                           520,602
 *     data/seeds-3500.js                 462,346
 *     jszip.min.js                       155,892   ← v2.78 起新增
 *     coreMeanings.js                    129,668   ← v2.78 起新增
 *     data/tool-data.js                  115,353   ← v2.78 起新增
 *     avatarData.js                      21,683   ← v2.78 起新增
 *   也就是说，涨出来的大头是 v2.78 起陆续加入的数据模块与未压缩的 React dev 源码，
 *   BOOK_DEFS 描述表只有几 KB；动态 import 的 iife 惰性包装与重复 loader 实测
 *   约 128KB raw / 5.6KB gzip（把 16 处 import() 静态化即可消掉）。
 *   本脚本做两件事把体积压回预算：
 *     ① 单文件专用插件把 import() 改写成静态 import + Promise.resolve，
 *        去掉 iife 包装，词库数据在单文件里本就全量内联、不需要分片；
 *     ② 默认开启 esbuild minify（--no-minify 可回到未压缩产物）。
 *   网页版构建不走这里，仍保留真正的按需分片。
 *
 * 用法：node scripts/build-single-html.cjs [--no-minify] [--out dist/index.html]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/**
 * 解析依赖：优先仓库 node_modules，其次 ESB_NODE_MODULES，最后回退 /tmp/esb。
 * @param {string} name 模块名
 * @returns {any}
 */
function requireDep(name) {
  const candidates = [
    path.join(ROOT, 'node_modules', name),
    process.env.ESB_NODE_MODULES ? path.join(process.env.ESB_NODE_MODULES, name) : '',
    path.join('/tmp/esb/node_modules', name),
  ].filter(Boolean);
  try {
    return require(name);
  } catch (e) {
    for (const c of candidates) if (fs.existsSync(c)) return require(c);
    throw e;
  }
}

const esbuild = requireDep('esbuild');

const args = process.argv.slice(2);
// 云端热更包按 gzip 体积计费用户流量：默认压缩；排障时可 --no-minify 看原始产物。
const MINIFY = !args.includes('--no-minify');
const outIdx = args.indexOf('--out');
const OUT = path.resolve(ROOT, outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : 'dist/index.html');
const GZIP_BUDGET = Math.round(1.05 * 1024 * 1024); // 1.05MB
// 与 index.web.html 一致的内联图标：单文件用 http 打开时也不会去请求 /favicon.ico
const FAVICON_DATA_URI = 'data:image/png;base64,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';

// 兼容两种仓库布局：main.jsx 在 src/ 下，或就在 scripts/ 同级
const APP_DIR = fs.existsSync(path.join(ROOT, 'src', 'main.jsx')) ? path.join(ROOT, 'src') : ROOT;

/**
 * 解析依赖目录（esbuild 的 nodePaths）。
 * @returns {string[]}
 */
function nodePaths() {
  const out = [];
  const local = path.join(ROOT, 'node_modules');
  if (fs.existsSync(local)) out.push(local);
  if (process.env.ESB_NODE_MODULES) out.push(process.env.ESB_NODE_MODULES);
  if (fs.existsSync('/tmp/esb/node_modules')) out.push('/tmp/esb/node_modules');
  return out;
}

/**
 * 单文件专用：把入口里的动态 import 改写成「静态 import + Promise.resolve」。
 * esbuild 在 bundle + iife 模式下会把每个 import() 包一层 __esm 惰性初始化，
 * 13 本词库 + 3 个附加模块共 16 处包装；而单文件里数据本来就是全量内联的，
 * 这层包装既增大产物又让词库变成异步到达。静态化后行为不变（load() 仍返回 Promise）。
 * 只对入口文件做文本变换，不改动源码，也不影响网页版构建。
 * @returns {object} esbuild 插件
 */
function singleFileStaticImports() {
  return {
    name: 'single-file-static-imports',
    setup(build) {
      build.onLoad({ filter: /main\.jsx$/ }, function (a) {
        const src = fs.readFileSync(a.path, 'utf8');
        const specs = [];
        const rewritten = src.replace(/import\(\s*(['"])([^'"]+)\1\s*\)/g, function (m, quote, spec) {
          // 注释 / 文档里的示例路径不对应真实模块，原样保留；否则 esbuild 会
          // 试图解析一个并不存在的文件（例如注释里提到的 chunk 名）而构建失败。
          if (spec.charAt(0) === '.') {
            const abs = path.resolve(path.dirname(a.path), spec);
            const resolvable = fs.existsSync(abs)
              || fs.existsSync(abs + '.js') || fs.existsSync(abs + '.jsx')
              || fs.existsSync(path.join(abs, 'index.js'));
            if (!resolvable) return m;
          }
          let i = specs.indexOf(spec);
          if (i < 0) { i = specs.length; specs.push(spec); }
          return 'Promise.resolve(__sfMod' + i + ')';
        });
        const decls = specs.map(function (s, i) {
          return 'import * as __sfMod' + i + ' from ' + JSON.stringify(s) + ';';
        }).join('\n');
        return { contents: decls + '\n' + rewritten, loader: 'jsx', resolveDir: path.dirname(a.path) };
      });
    },
  };
}

esbuild.build({
  entryPoints: [path.join(APP_DIR, 'main.jsx')],
  bundle: true,
  write: false,
  format: 'iife',
  platform: 'browser',
  jsx: 'automatic',
  minify: MINIFY,
  // 中文原样保留（默认 ascii 会把汉字转义成 \uXXXX，体积明显变大）
  charset: 'utf8',
  loader: { '.css': 'empty' },
  nodePaths: nodePaths(),
  plugins: [singleFileStaticImports()],
  logLevel: 'error',
}).then(function (r) {
  const js = r.outputFiles[0].text;
  const css = fs.readFileSync(path.join(APP_DIR, 'styles.css'), 'utf8');
  // v2.92.0：与 Vite 产物一致，内联启动自愈守卫
  const bootGuard = fs.readFileSync(path.join(APP_DIR, 'boot-guard.js'), 'utf8');
  if (bootGuard.indexOf('gaokao_boot_guard_v1') < 0) throw new Error('boot-guard.js 内容异常');
  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">\n'
    + '<script>' + bootGuard + '<\/script>\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">\n'
    + '<title>背群英</title><link rel="icon" type="image/png" href="' + FAVICON_DATA_URI + '">\n'
    + '<style>' + css + '</style></head>\n'
    + '<body><div id="root"></div><script>' + js + '<\/script></body></html>';
  const outDir = path.dirname(OUT);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT, html);
  // 网页版启动时会 fetch('app-update.json?v=...')，单文件产物用 http 打开也需要它，
  // 否则控制台多一条 404。CI 后续会用带 APK 摘要的最终版覆盖这个文件。
  const updateCandidates = [path.join(ROOT, 'app-update.json'), path.resolve(ROOT, '..', 'app-update.json')];
  const updateSrc = updateCandidates.find(function (p) { return fs.existsSync(p); });
  if (updateSrc && path.resolve(updateSrc) !== path.join(outDir, 'app-update.json')) {
    fs.copyFileSync(updateSrc, path.join(outDir, 'app-update.json'));
  }
  const buf = Buffer.from(html, 'utf8');
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  console.log('单文件产物 ' + path.relative(ROOT, OUT)
    + '  raw=' + buf.length + 'B (' + (buf.length / 1048576).toFixed(2) + 'MB)'
    + '  gzip=' + gz + 'B (' + (gz / 1048576).toFixed(3) + 'MB)'
    + (MINIFY ? ' (minified)' : ' (raw)'));
  if (gz > GZIP_BUDGET) {
    console.error('[FAIL] gzip ' + gz + 'B 超出预算 ' + GZIP_BUDGET + 'B (1.05MB)');
    process.exitCode = 1;
  } else {
    console.log('[OK] gzip ≤ 1.05MB 预算（余量 ' + (GZIP_BUDGET - gz) + 'B）');
  }
}).catch(function (e) { console.error('BUILD FAIL', e.message); process.exit(1); });
