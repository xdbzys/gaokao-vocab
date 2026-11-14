/* ============================================================
   v2.92.0 启动自愈守卫（ES5 / 零依赖 / 必须先于任何业务脚本执行）
   ------------------------------------------------------------
   目标：让「闪退 / 打不开」不再变成死锁，也不依赖 React 能否起来。
   ① 上次启动若未完成（OOM / ANR / 被系统杀 / 整页重载中断），
      本次自动记一次异常；连续 2 次即进入安全模式，业务层跳过所有启动期重活。
   ② React 未挂载、入口分片加载失败、模块顶层抛错时，
      用纯 DOM 弹出恢复面板（这段本身不依赖 React，也不依赖任何网络资源）。
   ③ 打不开 App 时用户点不到「检查更新」，恢复面板直接给安装包下载地址，
      形成不依赖坏版本自身的外部救援通道。
   注意：本文件被两个构建脚本内联进 <head>，不要写 import/export/箭头函数。
   ============================================================ */
(function () {
  var KEY = 'gaokao_boot_guard_v1';
  var APK_URL = 'https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/gaokao-vocab.apk';
  var st = { pending: 0, crashes: 0, lastError: '', ts: 0, forced: 0 };
  try {
    var raw = window.localStorage.getItem(KEY);
    if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') st = p; }
  } catch (e) {}

  var now = Date.now();
  // 只累计「近期」的未完成启动，避免几个月前的一次异常让设备永远进安全模式
  if (st.pending && (now - (st.ts || 0)) < 5 * 86400000) {
    st.crashes = (st.crashes || 0) + 1;
  } else {
    st.crashes = 0;
  }
  st.pending = 1;
  st.ts = now;
  var safe = !!st.forced || (st.crashes || 0) >= 2;
  try { window.localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {}
  window.__safeMode = safe;
  window.__bootGuard = {
    crashes: st.crashes || 0,
    safeMode: safe,
    /* 业务挂载成功后调用：清掉「未完成启动」标记与连续异常计数 */
    markReady: function () {
      try {
        var s = JSON.parse(window.localStorage.getItem(KEY) || '{}');
        s.pending = 0; s.crashes = 0; s.ts = Date.now();
        window.localStorage.setItem(KEY, JSON.stringify(s));
      } catch (e) {}
    },
    /* 恢复面板按钮：清本机数据后重启 */
    clearAndReload: function () {
      try {
        var rm = [];
        for (var i = 0; i < window.localStorage.length; i++) {
          var k = window.localStorage.key(i);
          if (k && k.indexOf('gaokao') === 0) rm.push(k);
        }
        for (var j = 0; j < rm.length; j++) window.localStorage.removeItem(rm[j]);
      } catch (e) {}
      try { window.location.reload(); } catch (e) {}
    },
    /* 恢复面板按钮：强制安全模式重启 */
    enterSafe: function () {
      try {
        var s = JSON.parse(window.localStorage.getItem(KEY) || '{}');
        s.forced = 1; s.pending = 0; s.crashes = 0; s.ts = Date.now();
        window.localStorage.setItem(KEY, JSON.stringify(s));
      } catch (e) {}
      try { window.location.reload(); } catch (e) {}
    }
  };

  /* 记录致命错误摘要；同时吞掉 unhandledrejection，避免老 WebView 整页红屏 */
  function note(kind, msg) {
    window.__lastBootError = kind + ': ' + msg;
    try {
      var s = JSON.parse(window.localStorage.getItem(KEY) || '{}');
      s.lastError = String(window.__lastBootError).slice(0, 300);
      window.localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }
  window.addEventListener('error', function (e) {
    try { note('脚本错误', (e && (e.message || (e.error && e.error.message))) || '未知'); } catch (e2) {}
  }, true);
  window.addEventListener('unhandledrejection', function (e) {
    try { e.preventDefault(); } catch (e2) {}
    try {
      var r = e && e.reason;
      note('未处理的 Promise', (r && (r.message || r)) || '未知');
    } catch (e2) {}
  });

  /* 9s（单文件版）/ 16s（多文件版，要等分片）后仍没挂载 → 显示恢复面板 */
  var hasSkeleton = true;
  try { hasSkeleton = !!document.getElementById('appSkeleton'); } catch (e) {}
  var WAIT = hasSkeleton ? 16000 : 9000;
  setTimeout(function () {
    try {
      var root = document.getElementById('root');
      if (root && root.children && root.children.length > 0) return; // 已正常启动
      if (window.__bootPanelShown) return;
      window.__bootPanelShown = 1;
      var sk = document.getElementById('appSkeleton');
      if (sk && sk.parentNode) { try { sk.parentNode.removeChild(sk); } catch (e) {} }
      var box = document.createElement('div');
      box.setAttribute('data-boot-guard', '1');
      box.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:#f5f7fb;color:#1f2937;'
        + 'font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;'
        + 'display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;';
      var card = document.createElement('div');
      card.style.cssText = 'max-width:420px;width:100%;background:#fff;border-radius:18px;padding:26px 22px;'
        + 'box-shadow:0 12px 36px rgba(15,23,42,.12);text-align:center;';
      var h = document.createElement('div');
      h.textContent = '应用没能正常启动';
      h.style.cssText = 'font-size:19px;font-weight:700;margin-bottom:10px;';
      var p = document.createElement('div');
      var reason = window.__safeMode
        ? '检测到连续启动异常，已进入安全模式（跳过后台词库加载与自动更新）。'
        : '首次加载未完成，可能是网络较慢或页面数据损坏。';
      p.textContent = reason;
      p.style.cssText = 'font-size:13px;line-height:1.7;color:#4b5563;margin-bottom:8px;';
      var err = document.createElement('div');
      err.textContent = (window.__lastBootError || (st && st.lastError) || '未捕获到具体错误');
      err.style.cssText = 'font-size:11px;color:#9ca3af;word-break:break-all;margin-bottom:18px;max-height:64px;overflow:hidden;';
      card.appendChild(h); card.appendChild(p); card.appendChild(err);

      function btn(label, primary, fn) {
        var b = document.createElement('button');
        b.type = 'button'; b.textContent = label;
        b.style.cssText = 'display:block;width:100%;margin:8px 0;padding:11px 16px;border-radius:11px;'
          + 'font-size:14px;cursor:pointer;border:1px solid ' + (primary ? '#2563eb' : '#e5e7eb') + ';'
          + 'background:' + (primary ? '#2563eb' : '#fff') + ';color:' + (primary ? '#fff' : '#374151') + ';';
        b.onclick = fn;
        return b;
      }
      card.appendChild(btn('安全模式启动（推荐）', true, function () { window.__bootGuard.enterSafe(); }));
      card.appendChild(btn('清除本机数据并重启', false, function () { window.__bootGuard.clearAndReload(); }));
      card.appendChild(btn('重新加载', false, function () { try { window.location.reload(); } catch (e) {} }));
      card.appendChild(btn('下载最新版安装包（覆盖安装，学习记录保留）', false, function () {
        try { window.location.href = APK_URL; } catch (e) {}
      }));
      var tip = document.createElement('div');
      tip.textContent = '若 App 反复闪退，请直接用手机浏览器打开上面的安装包覆盖安装。';
      tip.style.cssText = 'font-size:11px;color:#9ca3af;margin-top:12px;line-height:1.6;';
      card.appendChild(tip);
      box.appendChild(card);
      document.body.appendChild(box);
    } catch (e) { /* 守卫自身绝不能抛错 */ }
  }, WAIT);
})();
