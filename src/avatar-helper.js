/**
 * v3.5.1：可靠的头像更换（懒加载，点击头像时才加载，不占首屏体积）。
 * 旧实现直接把相册原图 readAsDataURL 存 localStorage，手机大图常超 5MB 配额，
 * setItem 静默失败、刷新即丢失，用户感觉「换了没效果」。现在先压到 160×160 JPEG，
 * 体积降到几十 KB，网页端与 App 端都能稳定保存。
 */

/** 把图片文件居中裁剪并压缩成 160×160 的 JPEG dataURL。 */
export function compressAvatarImage(file, cb) {
  try {
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var img = new Image();
        img.onload = function () {
          try {
            var size = 160;
            var canvas = document.createElement('canvas');
            canvas.width = size; canvas.height = size;
            var ctx = canvas.getContext('2d');
            var iw = img.width || size, ih = img.height || size;
            var side = Math.min(iw, ih);
            var sx = (iw - side) / 2, sy = (ih - side) / 2;
            ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
            cb(canvas.toDataURL('image/jpeg', 0.82));
          } catch (e) { cb(String((ev.target && ev.target.result) || '')); }
        };
        img.onerror = function () { cb(String((ev.target && ev.target.result) || '')); };
        img.src = String((ev.target && ev.target.result) || '');
      } catch (e) { cb(''); }
    };
    reader.onerror = function () { cb(''); };
    reader.readAsDataURL(file);
  } catch (e) { cb(''); }
}

/** 落盘头像并广播变更事件。 */
export function applyAvatar(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return;
  try { localStorage.setItem('gaokao_avatar', dataUrl); } catch (e) {}
  try {
    window.dispatchEvent(new CustomEvent('gaokao-avatar-changed', { detail: dataUrl }));
  } catch (e) {}
}

/**
 * 注册头像变更监听 + 原生相册回调。onChange(dataUrl) 由界面层传入用于刷新头像。
 * 返回反注册函数。整段逻辑懒加载，不占首屏体积。
 */
var _bridgeInited = false;
export function initAvatarBridge(onChange, tip) {
  if (_bridgeInited) return function () {};
  _bridgeInited = true;
  var setAv = function (url) {
    if (!url) return;
    try { localStorage.setItem('gaokao_avatar', url); } catch (e) {}
    try { onChange(url); } catch (e) {}
  };
  var onAvatar = function (e) { setAv((e && e.detail) || ''); };
  try { window.addEventListener('gaokao-avatar-changed', onAvatar); } catch (e) {}
  try {
    window.__avatarBridge = function (d) {
      setAv(d);
      try { if (tip) tip('头像已更换。', '已更新'); } catch (e) {}
    };
  } catch (e) {}
  return function () {
    try { window.removeEventListener('gaokao-avatar-changed', onAvatar); } catch (e) {}
  };
}
