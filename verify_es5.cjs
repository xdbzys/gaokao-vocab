// 验证 dist/index.html 中所有 inline script 的 ES5 兼容性（模拟 Chromium 37 解析器）
// 用法: node verify_es5.cjs [html路径]
const fs = require('fs');
const path = require('path');
const acorn = require(path.join(__dirname, 'node_modules/acorn'));

const htmlPath = process.argv[2] || path.join(__dirname, 'dist/index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

// 状态机提取 script 块
const scripts = [];
let i = 0;
while (true) {
  const open = html.indexOf('<script', i);
  if (open === -1) break;
  const gt = html.indexOf('>', open);
  if (gt === -1) break;
  const attrs = html.slice(open, gt + 1);
  if (/\ssrc\s*=/.test(attrs) || /type\s*=\s*["']application\/json/.test(attrs)) {
    i = html.indexOf('</script>', gt);
    if (i === -1) break;
    i += 9;
    continue;
  }
  const close = html.indexOf('</script>', gt);
  if (close === -1) break;
  const code = html.slice(gt + 1, close);
  scripts.push({ attrs, code, line: html.slice(0, gt).split('\n').length });
  i = close + 9;
}

console.log(`共提取 ${scripts.length} 个内联 script 块\n`);
let failed = 0;
scripts.forEach((s, idx) => {
  try {
    acorn.parse(s.code, { ecmaVersion: 5, allowReturnOutsideFunction: true });
    console.log(`[PASS] script #${idx} (第${s.line}行起, ${s.code.length} 字符) ES5 语法验证通过`);
  } catch (e) {
    failed++;
    const lines = s.code.split('\n');
    const errLine = (e.loc && e.loc.line) ? lines[e.loc.line - 1] : '';
    console.log(`[FAIL] script #${idx} (第${s.line}行起): ${e.message}`);
    if (e.loc) console.log(`       错误位置: 块内第 ${e.loc.line} 行, 第 ${e.loc.column} 列`);
    if (errLine) console.log(`       内容: ${errLine.slice(Math.max(0, e.loc.column - 60), e.loc.column + 60)}`);
  }
});
console.log('');
if (failed > 0) {
  console.log(`结果: ${failed}/${scripts.length} 个脚本块包含 ES5 不兼容语法 → 会导致 Chromium 37 白屏!`);
  process.exit(1);
}
console.log(`结果: 全部 ${scripts.length} 个脚本块均为合法 ES5 → Chromium 37 可正常解析`);
