/**
 * v2.75.0 官网更新日志自动同步
 *
 * 注意：仓库根 package.json 是 "type": "module"，本文件按 ESM 解析，
 * 必须使用 import（曾用 require 导致 CI 直接 ReferenceError）。
 *
 * 约定（app-update.json 的 changelog 字段）：
 *   第一行为标题，形如 【v2.75.0】一句话概述，不参与列表渲染；
 *   其余每行一条，以「新增 / 优化 / 修复 / 调整」开头，其余文字作为正文。
 *   —— 只写用户能感知的功能变化，内部缺陷修复不必写进 changelog。
 *
 * 脚本做三件事：
 *   1. 读 app-update.json 的 version / changelog（CI 已把 version 同步为本次构建版本）；
 *   2. 若官网 HTML 里没有该版本条目，则按模板插到 .changelog-list 顶部；
 *   3. 已存在则原样跳过，保证重复构建幂等。
 */
import fs from 'node:fs';

const SITE = 'gaokao-vocab-site/gaokao-vocab-site.html';
const UPDATE = 'app-update.json';

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function main() {
  if (!fs.existsSync(SITE) || !fs.existsSync(UPDATE)) {
    console.log('[site-changelog] skip: missing ' + (fs.existsSync(SITE) ? UPDATE : SITE));
    return;
  }
  const upd = JSON.parse(fs.readFileSync(UPDATE, 'utf8'));
  const ver = String(upd.version || '').trim();
  const log = String(upd.changelog || '').trim();
  if (!ver || !log) {
    console.log('[site-changelog] skip: empty version/changelog');
    return;
  }

  let html = fs.readFileSync(SITE, 'utf8');
  if (html.indexOf('data-ver="' + ver + '"') >= 0) {
    console.log('[site-changelog] v' + ver + ' already present, skip');
    return;
  }

  const TAG = { 新增: 'tag-new', 优化: 'tag-opt', 修复: 'tag-fix', 调整: 'tag-opt' };
  const lines = log.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const items = [];
  for (const rawLine of lines) {
    if (/^【/.test(rawLine)) continue; // 标题行
    const line = rawLine.replace(/^[·•\-]\s*/, '');
    const m = /^(新增|优化|修复|调整)\s*[:：]?\s*(.+)$/.exec(line);
    const label = m ? m[1] : '新增';
    const text = m ? m[2] : line;
    items.push(
      '            <li><span class="changelog-tag ' + (TAG[label] || 'tag-opt') + '">' +
      label + '</span>' + escapeHtml(text) + '</li>'
    );
  }
  if (!items.length) {
    console.log('[site-changelog] skip: no item lines in changelog');
    return;
  }

  const d = new Date();
  const dateStr = d.getFullYear() + '年' + (d.getMonth() + 1) + '月';
  const block = [
    '      <div class="changelog-item" data-ver="' + ver + '">',
    '        <div class="changelog-version">v' + ver + '</div>',
    '        <div class="changelog-content">',
    '          <div class="date">' + dateStr + '</div>',
    '          <ul>',
    items.join('\n'),
    '          </ul>',
    '        </div>',
    '      </div>',
    '',
  ].join('\n');

  const anchor = '<div class="changelog-list">';
  const at = html.indexOf(anchor);
  if (at < 0) {
    console.log('[site-changelog] skip: .changelog-list not found');
    return;
  }
  const insertAt = at + anchor.length;
  html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
  fs.writeFileSync(SITE, html);
  console.log('[site-changelog] inserted v' + ver + ' (' + items.length + ' items)');
}

main();
