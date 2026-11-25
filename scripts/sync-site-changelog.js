/**
 * v2.97.0 官网更新日志同步
 *
 * ESM（仓库根 package.json 为 "type": "module"）。
 *
 * 官网「更新日志」区已内联全量历史数据（构建产物自带，离线即显示），本脚本仅做一件事：
 * 把仓库根 changelog.json 的全量 releases 同步进官网 HTML 的内联常量 CHANGELOG_RELEASES，
 * 保证官网展示的版本历史与 App 内更新日志、仓库清单始终同源、一致。
 * 找不到锚点或缺文件时安全跳过，不阻断 CI。
 */
import fs from 'node:fs';

const SITE = 'gaokao-vocab-site/gaokao-vocab-site.html';
const CHANGELOG = 'changelog.json';

function main() {
  if (!fs.existsSync(SITE) || !fs.existsSync(CHANGELOG)) {
    console.log('[site-changelog] skip: missing ' + (fs.existsSync(CHANGELOG) ? SITE : CHANGELOG));
    return;
  }
  const hist = JSON.parse(fs.readFileSync(CHANGELOG, 'utf8'));
  const releases = Array.isArray(hist.releases) ? hist.releases : [];
  if (!releases.length) {
    console.log('[site-changelog] skip: empty releases');
    return;
  }
  const slim = releases.map(function (r) { return { v: r.version, i: r.items || [] }; });
  const data = JSON.stringify(slim);

  let html = fs.readFileSync(SITE, 'utf8');
  const re = /var CHANGELOG_RELEASES = \[[\s\S]*?\];/;
  if (!re.test(html)) {
    console.log('[site-changelog] skip: CHANGELOG_RELEASES anchor not found');
    return;
  }
  html = html.replace(re, 'var CHANGELOG_RELEASES = ' + data + ';');

  // v3.5.1：同步首屏「最新版本」静态文案，避免网络请求失败时官网停留在旧版本号。
  // changelog.json 的 latest 形如 v3.5.0，页面里写的是「v3.5.0」（去掉前缀空白即可）。
  const latest = String(hist.latest || (releases[0] && releases[0].version) || '').replace(/^v/, '');
  if (latest) {
    html = html.replace(/(<span id="heroVersion">[^<]*<\/span>)/,
      '<span id="heroVersion">最新版本 v' + latest + '</span>');
    html = html.replace(/(<p class="version-info" id="latestVersion">[^<]*<\/p>)/,
      '<p class="version-info" id="latestVersion">当前版本 v' + latest + ' | Android 5.0+ | 约 5 MB</p>');
    console.log('[site-changelog] hero version text -> v' + latest);
  }

  fs.writeFileSync(SITE, html);
  console.log('[site-changelog] synced ' + slim.length + ' releases into official site');
}

main();
