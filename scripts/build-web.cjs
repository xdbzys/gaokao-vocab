#!/usr/bin/env node
/**
 * 网页版多文件构建（v2.79.0）
 * ---------------------------------------------------------------
 * 为什么要有这个脚本：
 *   旧流程把 React + 业务代码 + 12.8 万词条数据全部内联成一个 HTML，
 *   产物 3.37MB / gzip 1.02MB。github.io 上仅 TCP 握手就 4.4s，
 *   无头浏览器实测首屏 42s，用户感知就是「网页版打不开」。
 *   本脚本产出「多文件 + 内容哈希 + 动态 import 分片」的网页版：
 *     dist-web/index.html            静态骨架 + 内联关键 CSS（≈15KB gzip）
 *     dist-web/assets/app.<hash>.js  壳（React + 业务代码 + 核心释义）
 *     dist-web/assets/chunk-*.js     词库数据分片，首屏后按需下载
 *   首屏只需 index.html + app.<hash>.js，gzip 合计 ≈ 200KB。
 *
 * 与 App 单文件产物的关系：
 *   App 的云端热更要求「一个 index.html」，那条路径继续由既有单文件构建
 *   （dist/index.html）负责，本脚本不改动它，只额外产出 dist-web/。
 *
 * 用法：node scripts/build-web.cjs [--outdir dist-web]
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ROOT = path.resolve(__dirname, '..');

/**
 * 解析依赖：优先仓库自身的 node_modules（CI 里由 npm ci 安装），
 * 其次 ESB_NODE_MODULES 指定的目录，最后回退到本地临时环境 /tmp/esb。
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
    for (const c of candidates) {
      if (fs.existsSync(c)) return require(c);
    }
    throw e;
  }
}

const esbuild = requireDep('esbuild');

// 兼容两种仓库布局：main.jsx 在 src/ 下，或就在 scripts/ 同级
const APP_DIR = fs.existsSync(path.join(ROOT, 'src', 'main.jsx')) ? path.join(ROOT, 'src') : ROOT;
const ENTRY = path.join(APP_DIR, 'main.jsx');
const STYLE = path.join(APP_DIR, 'styles.css');
const TEMPLATE = path.join(APP_DIR, 'index.web.html');

const args = process.argv.slice(2);
function argOf(name, fallback) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
}
const OUTDIR = path.resolve(ROOT, argOf('--outdir', 'dist-web'));

/** 计算 gzip 体积（-9，与 CDN/Pages 的实际压缩率基本一致） */
function gzSize(buf) {
  return zlib.gzipSync(Buffer.isBuffer(buf) ? buf : Buffer.from(buf), { level: 9 }).length;
}
function kb(n) {
  return (n / 1024).toFixed(1) + 'KB';
}
function pad(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}

/** 依赖查找路径：优先仓库本地 node_modules，其次 /tmp/esb（本地临时环境） */
function nodePaths() {
  const out = [];
  const local = path.join(ROOT, 'node_modules');
  if (fs.existsSync(local)) out.push(local);
  if (process.env.ESB_NODE_MODULES) out.push(process.env.ESB_NODE_MODULES);
  if (fs.existsSync('/tmp/esb/node_modules')) out.push('/tmp/esb/node_modules');
  return out;
}

(async function main() {
  if (!fs.existsSync(ENTRY)) throw new Error('找不到构建入口: ' + ENTRY);
  const t0 = Date.now();

  // 0) 清空输出目录：带 hash 的文件名不会覆盖旧产物，不清理会越积越多
  fs.rmSync(OUTDIR, { recursive: true, force: true });
  fs.mkdirSync(path.join(OUTDIR, 'assets'), { recursive: true });

  // 1) 打包：ESM + 代码分片 + 内容哈希，动态 import 会自然拆成独立 chunk
  const result = await esbuild.build({
    entryPoints: [ENTRY],
    outdir: path.join(OUTDIR, 'assets'),
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: ['es2019'],
    jsx: 'automatic',
    minify: true,
    // 中文原样保留：默认 ascii 会把每个汉字转成 \uXXXX，源码体积翻倍
    charset: 'utf8',
    metafile: true,
    write: true,
    // CSS 走 <style> 内联（首屏省一个往返），这里让 import './styles.css' 变成空
    loader: { '.css': 'empty' },
    nodePaths: nodePaths(),
    logLevel: 'error',
    entryNames: '[name].[hash]',
    chunkNames: 'chunk-[name].[hash]',
    assetNames: 'asset-[name].[hash]',
  });

  // 2) 生成 index.html：静态骨架 + 内联 CSS + 指向带哈希的入口脚本
  const css = fs.readFileSync(STYLE, 'utf8');
  let template = fs.readFileSync(TEMPLATE, 'utf8');

  const entryOutput = (result.metafile.outputs && Object.keys(result.metafile.outputs).filter(function (f) {
    return /assets[\\/]main\.[^\\/]+\.js$/.test(f);
  })[0]) || '';
  if (!entryOutput) throw new Error('未找到入口 chunk（assets/main.*.js）');
  const entryRel = path.relative(OUTDIR, path.resolve(process.cwd(), entryOutput)).split(path.sep).join('/');

  template = template
    .replace('<!--APP_CSS-->', '<style>' + css + '</style>')
    .replace('<!--APP_SCRIPT-->', '<script type="module" src="./' + entryRel + '"></script>');

  fs.writeFileSync(path.join(OUTDIR, 'index.html'), template);

  // 1.1) 让「重试」真的能重新下载分片。
  //      浏览器 module map 会缓存失败的 import()，同一 URL 再 import 连请求都不发；
  //      把入口里的 import("./chunk-xxx.js") 包一层 window.__bookChunkUrl()，
  //      main.jsx 的 retryBookData() 递增 nonce 后 URL 变成 ".../chunk-xxx.js?r=N"，
  //      这才是新请求。只改入口文件，chunk 内部的静态依赖不动。
  const mainAbs = path.join(OUTDIR, entryRel);
  const mainCode = fs.readFileSync(mainAbs, 'utf8');
  const chunkImportRe = /import\((["'])(\.\/chunk-[^"']+\.js)\1\)/g;
  const patchedMain = mainCode.replace(chunkImportRe, 'import(window.__bookChunkUrl($1$2$1))');
  if (patchedMain !== mainCode) {
    fs.writeFileSync(mainAbs, patchedMain);
  } else {
    console.error('[WARN] 入口 chunk 里没找到 import("./chunk-*.js")，重试可能命中失败缓存');
  }

  // 2.1) 复制更新清单：网页版启动时会 fetch('app-update.json?v=...')，
  //       dist-web/ 里缺这个文件会在控制台留下 404。兼容两种仓库布局：
  //       清单与 main.jsx 同级（当前 src/ 布局），或在 src/ 的上一级（CI 扁平布局）。
  const updateCandidates = [
    path.join(ROOT, 'app-update.json'),
    path.resolve(ROOT, '..', 'app-update.json'),
  ];
  const updateSrc = updateCandidates.find(function (p) { return fs.existsSync(p); });
  if (updateSrc) {
    fs.copyFileSync(updateSrc, path.join(OUTDIR, 'app-update.json'));
  } else {
    console.error('[WARN] 未找到 app-update.json，网页版更新检查会 404');
  }

  // 3) 体积报表（原始 / gzip），并把「首屏」与「首屏后按需」分开统计
  const rows = [];
  const walk = function (dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (d) {
      const p = path.join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else rows.push(p);
    });
  };
  walk(OUTDIR);
  rows.sort();

  let firstScreenGz = 0;
  let firstScreenRaw = 0;
  let lazyGz = 0;
  let lazyRaw = 0;
  const lines = [];
  lines.push('');
  lines.push('产物清单（' + path.basename(OUTDIR) + '/）');
  lines.push(pad('文件', 40) + pad('原始', 12) + pad('gzip', 12) + '类型');
  lines.push('-'.repeat(78));
  rows.forEach(function (p) {
    const buf = fs.readFileSync(p);
    const rel = path.relative(OUTDIR, p).split(path.sep).join('/');
    if (rel === 'app-update.json') return; // 更新清单是静态配置，不计入资源预算
    const isFirst = rel === 'index.html' || rel === entryRel;
    if (isFirst) { firstScreenGz += gzSize(buf); firstScreenRaw += buf.length; }
    else { lazyGz += gzSize(buf); lazyRaw += buf.length; }
    lines.push(pad(rel, 40) + pad(kb(buf.length), 12) + pad(kb(gzSize(buf)), 12) + (isFirst ? '首屏' : '按需'));
  });
  lines.push('-'.repeat(78));
  lines.push(pad('首屏合计（index.html + 入口 JS）', 40) + pad(kb(firstScreenRaw), 12) + pad(kb(firstScreenGz), 12));
  lines.push(pad('按需合计（词库数据分片）', 40) + pad(kb(lazyRaw), 12) + pad(kb(lazyGz), 12));
  lines.push(pad('全量合计', 40) + pad(kb(firstScreenRaw + lazyRaw), 12) + pad(kb(firstScreenGz + lazyGz), 12));
  lines.push('');
  lines.push('入口文件: ./' + entryRel);
  lines.push('耗时: ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
  console.log(lines.join('\n'));

  // 4) 写出机器可读的清单，CI 里可以直接断言首屏预算
  const manifest = {
    entry: entryRel,
    firstScreenGzip: firstScreenGz,
    firstScreenRaw: firstScreenRaw,
    lazyGzip: lazyGz,
    lazyRaw: lazyRaw,
    files: rows.map(function (p) {
      const buf = fs.readFileSync(p);
      return {
        path: path.relative(OUTDIR, p).split(path.sep).join('/'),
        raw: buf.length,
        gzip: gzSize(buf),
      };
    }),
  };
  fs.writeFileSync(path.join(OUTDIR, 'build-manifest.json'), JSON.stringify(manifest, null, 2));

  // 首屏预算红线：gzip 250KB
  const BUDGET = 250 * 1024;
  if (firstScreenGz > BUDGET) {
    console.error('\n[WARN] 首屏 gzip ' + kb(firstScreenGz) + ' 超出预算 ' + kb(BUDGET));
    process.exitCode = 1;
  } else {
    console.log('\n[OK] 首屏 gzip ' + kb(firstScreenGz) + ' ≤ 预算 ' + kb(BUDGET));
  }
})().catch(function (e) {
  console.error('BUILD FAIL: ' + e.message);
  process.exit(1);
});
