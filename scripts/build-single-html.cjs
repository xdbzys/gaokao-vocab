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
const FAVICON_DATA_URI = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA2NCA2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiByeD0iMTYiIGZpbGw9IiMyNTYzZWIiLz48dGV4dCB4PSIzMiIgeT0iNDQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJQaW5nRmFuZyBTQyxNaWNyb3NvZnQgWWFIZWksc2Fucy1zZXJpZiIgZm9udC1zaXplPSIzNiIgZm9udC13ZWlnaHQ9IjcwMCIgZmlsbD0iI2ZmZiI+6IuxPC90ZXh0Pjwvc3ZnPg==';

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
  const html = '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">\n'
    + '<title>背群英</title><link rel="icon" type="image/svg+xml" href="' + FAVICON_DATA_URI + '">\n'
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
