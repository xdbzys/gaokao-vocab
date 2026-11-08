import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor, Filesystem, Directory, Encoding } from './vendor/native-bridge';
import './styles.css';
import { adjToAdverbRules, comparativeRules, pastTenseRules, irregularVerbs, presentParticipleRules, nounPluralRules } from './vendor/wordTransformations';
import { CORE_MEANINGS } from './coreMeanings';
import { SFX_CORRECT, SFX_WRONG } from './sfx';

/* v2.79.0：jszip（96KB）只在导入 pptx/docx 时用到，改为用时再 import，
   首屏不再为它付费。调用点在 extractPptxText / extractDocxText 里。 */

/* ============================
   v2.79.0 首屏瘦身：大体积数据改为「按需加载」
   ---------------------------------------------------------------
   旧版把 8 个词书的种子数据（约 900KB 源码）、wordEnrichment（666KB）、
   gaokaoMasterVocab（490KB）全部内联在单个 HTML 里，网页版产物 3.37MB /
   gzip 1MB，github.io 上光下载+解析就要 40s，用户看到的是白屏。
   现在分成三类：
     ① 每次都要的词库数据 → 独立 chunk，启动后后台并行下载（ensureBookData）
     ② 只有详情页/闪卡才用的 wordEnrichment → 首屏渲染完再拉（loadEnrichment）
     ③ 高考总汇词库的 6500 词 → 同样后台拉，到货后再挂进词库列表
   主包只留 React + 业务代码 + 核心释义，首屏 gzip ≈ 200KB。
   注意：App 的单文件产物（dist/index.html）走 build_html276.js，
   esbuild 会把所有 chunk 内联回单文件，App 行为与体积结构不受影响。
   ============================ */

/* ============================
   低版本 / 多设备兼容加固（Android 10 / MP5 / 翻译扫描笔等老 WebView）
   - localStorage 兜底：受限 WebView / 隐私模式禁用时自动降级为内存存储，避免白屏崩溃
   - 该加固在业务代码前执行，覆盖全文件所有 localStorage 读写
   - 设备能力探测结果挂到 window.__devCaps，供 UI 做友好提示（不影响功能）
   ============================ */
(function () {
  try {
    var ls = window.localStorage;
    if (ls && ls.getItem && ls.setItem) {
      var _g = ls.getItem.bind(ls), _s = ls.setItem.bind(ls), _r = ls.removeItem.bind(ls), _c = ls.clear.bind(ls);
      ls.getItem = function (k) { try { return _g(k); } catch (e) { return null; } };
      ls.setItem = function (k, v) { try { return _s(k, v); } catch (e) {} };
      ls.removeItem = function (k) { try { return _r(k); } catch (e) {} };
      ls.clear = function () { try { return _c(); } catch (e) {} };
    }
  } catch (e) {
    // localStorage 完全不可用：用内存对象兜底，保证应用仍可运行（仅不持久化）
    var _mem = {};
    var _store = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(_mem, k) ? _mem[k] : null; },
      setItem: function (k, v) { _mem[k] = String(v); },
      removeItem: function (k) { delete _mem[k]; },
      clear: function () { _mem = {}; },
      key: function (i) { return Object.keys(_mem)[i] || null; }
    };
    Object.defineProperty(_store, 'length', { get: function () { return Object.keys(_mem).length; } });
    try { Object.defineProperty(window, 'localStorage', { value: _store, configurable: true }); } catch (e2) {}
  }
  try {
    window.__devCaps = {
      tts: ('speechSynthesis' in window) && typeof SpeechSynthesisUtterance !== 'undefined',
      wakeLock: ('wakeLock' in navigator) && !!(navigator.wakeLock && navigator.wakeLock.request),
      mediaSession: 'mediaSession' in navigator,
      localStorage: (function () { try { window.localStorage.setItem('__cap_test__', '1'); window.localStorage.removeItem('__cap_test__'); return true; } catch (e) { return false; } })()
    };
  } catch (e) {}
})();

/* ============================
   CDN 动态加载（避免 pdfjs/tesseract 的 import.meta 语法导致 SyntaxError）
   pdfjs-dist@6.x 和 tesseract.js@7.x 使用 import.meta，在 viteSingleFile
   打包到非 ES module 的 <script> 标签时会报 SyntaxError，导致整个 JS 不执行（蓝屏）。
   改为运行时从 CDN 动态加载，仅在用户使用 PDF/图片导入功能时加载。
   ============================ */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector('script[src="' + src + '"]')) { resolve(); return; }
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = function() { reject(new Error('加载失败: ' + src)); };
    document.head.appendChild(s);
  });
}

var _pdfjsLib = null;
async function getPdfjs() {
  if (_pdfjsLib) return _pdfjsLib;
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
  _pdfjsLib = window.pdfjsLib || window['pdfjs-dist'];
  if (_pdfjsLib && _pdfjsLib.GlobalWorkerOptions) {
    _pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  return _pdfjsLib;
}

var _tesseractCreateWorker = null;
async function getTesseractCreateWorker() {
  if (_tesseractCreateWorker) return _tesseractCreateWorker;
  await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.0.5/dist/tesseract.min.js');
  _tesseractCreateWorker = window.Tesseract ? window.Tesseract.createWorker : null;
  return _tesseractCreateWorker;
}

/* ============================
   APP 版本常量
   ============================ */
const APP_VERSION = '2.81.0';
const APP_VERSION_CODE = 301;
// v2.43.0 更新渠道修复：Gitee raw 大文件经常被 WAF/302 签名拦截导致"无法更新"
// 改为 GitHub Releases 直链优先（CI 每次构建自动上传），Gitee 与 Pages 作后备
// v2.72.1 下载主源修正：实测 jsDelivr 的 @master APK 会滞后（缓存最长 12 小时，
// 曾实测返回旧包 4,376,178 字节，而仓库内为 4,381,067 字节），用户会先白下 4MB 旧包；
// Gitee raw 实测 3 秒返回当前包（4,381,067 字节，与 Release 一致），故置于首位。
const APK_DOWNLOAD_SOURCES = [
  { name: 'Gitee 镜像（国内最快、随构建更新）', url: 'https://gitee.com/xdbzys/app/raw/master/gaokao-vocab.apk' },
  { name: 'jsDelivr CDN', url: 'https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/gaokao-vocab.apk' },
  { name: 'GitHub Releases', url: 'https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-release.apk' },
];
// 内置更新服务器地址
const GITEE_OWNER = 'xdbzys';
const GITEE_REPO = 'app';
const GITEE_BRANCH = 'master';
// 优先使用 Gitee raw 直链获取 JSON
const UPDATE_SERVER_RAW = `https://gitee.com/${GITEE_OWNER}/${GITEE_REPO}/raw/master/app-update.json`;
// 备用：Gitee API 方式
const UPDATE_SERVER_API = `https://gitee.com/api/v5/repos/${GITEE_OWNER}/${GITEE_REPO}/contents/app-update.json?ref=${GITEE_BRANCH}`;
// 添加时间戳防止 CDN 缓存
const UPDATE_SERVER_URL_CACHE = () => `${UPDATE_SERVER_RAW}?_t=${Date.now()}`;
// 正确检测原生APP：
// - 纯 WebView 容器：window.NativeFS 存在即为原生
// - Capacitor 容器（已弃用）：用 isNativePlatform 区分
// - Cordova 容器：window.cordova
const isNativeApp = !!(window.NativeFS)
  || (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform ? Capacitor.isNativePlatform() : false)
  || !!(window.cordova);

/* v2.76.0 第二套网页版（/app/ 子路径）：
   需求是「新网页版跟 App 一样，没有特殊的内容」，同时旧的网页版（根路径）保留不消失。
   两套页面共用同一份构建产物，用访问路径区分能力集合，避免维护两套源码：
   - 根路径 /            → 旧网页版：只保留浏览器可用的部分（历史行为不变）
   - /app/ 子路径        → 新网页版：与 App 一致，展示全部功能入口并给出网页端实现
   - file:// 或 assets   → 原生 App：isNativeApp 为真，与以前完全一致
   判定写成纯函数，便于单测（见 _isFullWebPath）。 */
function _isFullWebPath(pathname) {
  var p = String(pathname || '');
  return /(^|\/)app(\/(index\.html)?)?\/?$/.test(p);
}
const isFullWeb = !isNativeApp && (function () {
  try { return _isFullWebPath(window.location.pathname); } catch (e) { return false; }
})();
// 用 file:// 直接打开本地 HTML 时，fetch 相对路径会被 CORS 挡下；统一在这里判一次，
// 用 window.location（而不是裸 location）以兼容 jsdom 单测环境。
const isFileProtocol = (function () {
  try { return window.location.protocol === 'file:'; } catch (e) { return false; }
})();
// 「功能完整版」= 原生 App 或新网页版；原生专属能力（装 APK、系统通知）仍只用 isNativeApp 判定
const isFullApp = isNativeApp || isFullWeb;

/* 词性标记表（v2.76.0）：内置词库大量释义形如「a. 能干的, 能够的」「n. 能力；[经] 才能」，
   旧白名单漏了 a. 等标记，界面与朗读里就留下无意义的字母 "a"。
   这里集中一份词表，显示清洗、朗读清洗、选项抽取共用；边界锚定到空白或标点，
   不误伤 U.S.A. / e.g. 这类含点缩写。常量必须在词库初始化之前声明（builtInBooks 在模块加载期就会用到）。 */
/* v2.76.0 应用内提示（替代 alert）：
   旧实现用 window.alert，WebView 会给它套一个原生标题「网址为"file:///"的网页显示：」，
   既难看又暴露实现细节，长文本还会被截断（用户截图里的 MP3 保存提示就是这样）。
   这里改成 React 渲染的卡片：标题 + 等宽换行正文 + 关闭按钮，全部走应用主题样式。
   调用方不需要关心是否已挂载：未挂载时退化为控制台输出，不会阻塞流程。 */
let _appTipSink = null;
let _appTipTimer = null;
/* autoCloseMs > 0 时自动消失（用于「音量键开关」这类轻提示，避免挡住背诵页的按钮） */
function appTip(message, title, autoCloseMs) {
  var text = String(message == null ? '' : message);
  try {
    if (_appTipSink) { _appTipSink(text, title || '提示', autoCloseMs || 0); return; }
  } catch (e) {}
  try { console.log('[tip] ' + text); } catch (e) {}
}

const POS_TAG_WORDS = 'vt|vi|v|n|adj|adv|ad|prep|pron|conj|interj|det|art|num|int|aux|modal|abbr|pl|sing|a';
const POS_TAG_RE = new RegExp('(^|[\\s，,；;、。！？：:（(“\"【】])(' + POS_TAG_WORDS + ')\\.\\s*', 'gi');

/* v2.78.0：释义里的三类历史脏数据（来自一部老词典），必须在入库时清掉。
   ① DOS 命令说明：「DOS内部命令:复制文件」  ② 缩略语展开：「计算机辅助教育」「BASIC语言」
   ③ 语法注释：「be 的现在分词」「bite 的过去式和过去分词」
   同样必须在词库初始化（builtInBooks）之前声明，否则 makeItem 取到 undefined。 */
const MEANING_JUNK_RE = /(DOS\s*(内部|外部)命令|计算机(辅助|工艺|生产|印刷|教学|排版|翻译|测试)?|BASIC语言|Internet网|局域网|载波检测|二进制数位|机内测试)/;
const MEANING_GRAMMAR_RE = /^[（(]?\s*[A-Za-z\u4e00-\u9fa5]{0,10}的(过去式|过去分词|现在分词|复数|第三人称单数|比较级|最高级)/;
// 同一部老词典还会把 DOS 时代的工具说明塞进释义末尾（"查看内存实用程序""串行线接口协议"）。
// 判定：以「程序 / 系统 / 协议」结尾的义项一律视为工具描述，只保留下面这几个真正常用的词。
const MEANING_TOOL_TAIL_RE = /(程序|系统|协议)$/;
const MEANING_TECH_RE = /(索引|机构|模块|接口|组件|程序|系统|协议|算法|编码|存储器|处理器|数据库)/;
const MEANING_TOOL_KEEP = { '程序': 1, '系统': 1, '编程序': 1, '应用程序': 1, '驱动程序': 1, '达成协议': 1, '生态系统': 1 };

// v2.67.0：本机「安装包」真实版本（PackageManager 读取）。
// 页面会被云端热更新抬高版本号，但原生功能只随 APK 更新 —— 两者不一致时
// 界面看起来是新的、功能却还是旧的。返回 0 表示该安装包早于 v2.67.0（无此桥接）。
function nativePkgVersionCode() {
  if (!isNativeApp) return -1;
  try {
    if (window.NativeVersion && typeof window.NativeVersion.versionCode === 'function') {
      const c = window.NativeVersion.versionCode();
      if (typeof c === 'number' && c > 0) return c;
    }
  } catch (e) {}
  return 0;
}
function nativePkgVersionName() {
  if (!isNativeApp) return '';
  try {
    if (window.NativeVersion && typeof window.NativeVersion.versionName === 'function') {
      return String(window.NativeVersion.versionName() || '');
    }
  } catch (e) {}
  return '';
}

/* ============================
   一、内置词库数据
   ============================ */





















/* ============================
   二、词根词缀数据
   ============================ */



// 情景记忆单词中文翻译补充（词库中可能缺失的词）
const sceneWordCn = {
  // 环境保护
  environment: '环境', pollution: '污染', sustainable: '可持续的', climate: '气候', carbon: '碳',
  renewable: '可再生的', ecosystem: '生态系统', conservation: '保护', emission: '排放', biodiversity: '生物多样性',
  // 人工智能与科技
  artificial: '人工的', intelligence: '智能', algorithm: '算法', automation: '自动化', innovation: '创新',
  digital: '数字的', robot: '机器人', data: '数据', virtual: '虚拟的', network: '网络',
  // 教育成长
  education: '教育', knowledge: '知识', curriculum: '课程', academic: '学术的', graduate: '毕业',
  scholarship: '奖学金', discipline: '纪律', potential: '潜力', inspire: '激励', achieve: '实现',
  // 传统文化
  traditional: '传统的', culture: '文化', heritage: '遗产', civilization: '文明', ancestor: '祖先',
  festival: '节日', custom: '习俗', ceremony: '仪式', ancient: '古老的', preserve: '保护',
  // 健康生活
  health: '健康', nutrition: '营养', exercise: '锻炼', mental: '心理的', balanced: '均衡的',
  diet: '饮食', psychological: '心理的', physical: '身体的', wellness: '健康', habit: '习惯',
  // 社会热点
  globalization: '全球化', diversity: '多样性', equality: '平等', poverty: '贫困', volunteer: '志愿者',
  community: '社区', justice: '正义', opportunity: '机会', challenge: '挑战', responsibility: '责任',
  // 海洋微塑料
  microplastic: '微塑料', ocean: '海洋', contaminate: '污染', filter: '过滤', solution: '解决方案',
  research: '研究', particle: '颗粒', tap: '自来水', reduce: '减少', chemical: '化学的',
  // 绿色出行
  bicycle: '自行车', commute: '通勤', emission: '排放', sustainable: '可持续的', infrastructure: '基础设施',
  convenient: '方便的', rental: '租赁', guide: '导游', explore: '探索', carbon: '碳',
  // 食物浪费
  waste: '浪费', consume: '消费', portion: '份量', leftover: '剩菜', ingredient: '原料',
  scrape: '刮掉', discard: '丢弃', nutrition: '营养', resource: '资源', awareness: '意识',
  // 中医文化
  traditional: '传统的', acupuncture: '针灸', veterinary: '兽医的', combine: '结合', treatment: '治疗',
  needle: '针', therapy: '疗法', effective: '有效的', recovery: '康复', cultural: '文化的',
  // 纸质阅读
  print: '印刷', digital: '数字的', screen: '屏幕', comprehension: '理解力', retain: '保留',
  focus: '专注', device: '设备', audiobook: '有声书', absorb: '吸收', preference: '偏好',
  // 城市花园
  urban: '城市的', garden: '花园', sprout: '发芽', seed: '种子', cultivate: '种植',
  harvest: '收获', organic: '有机的', community: '社区', volunteer: '志愿者', transform: '改变',
  // 志愿服务
  volunteer: '志愿者', hospital: '医院', tutor: '辅导', patient: '病人', dedicate: '奉献',
  compassion: '同情心', disadvantaged: '弱势的', inspire: '激励', resilience: '韧性', commitment: '承诺',
  // 热带雨林
  rainforest: '雨林', tropical: '热带的', species: '物种', medicine: '药物', deforest: '砍伐森林',
  biodiversity: '生物多样性', habitat: '栖息地', indigenous: '原住民的', conserve: '保护', irreplaceable: '不可替代的',
  // 老年人健康
  elderly: '老年人', aging: '衰老', physical: '身体的', mental: '心理的', companionship: '陪伴',
  isolated: '孤独的', program: '项目', engage: '参与', wellbeing: '福祉', dignity: '尊严',
  // 科学探索
  experiment: '实验', hypothesis: '假说', evidence: '证据', innovative: '创新的', breakthrough: '突破',
  discover: '发现', methodology: '方法论', analyze: '分析', conclusion: '结论', persist: '坚持'
};


// 自定义拼写纠错（localStorage 扩展）
function loadCustomSpelling() {
  try { return JSON.parse(localStorage.getItem('customSpelling') || '[]'); }
  catch { return []; }
}
function saveCustomSpelling(list) {
  localStorage.setItem('customSpelling', JSON.stringify(list));
}


/* ============================
   音标生成函数（基于简单规则）
   ============================ */

function generatePhonetic(term) {
  if (!term || typeof term !== 'string') return '/ə/';
  const w = term.toLowerCase().trim();
  if (!/[a-z]/.test(w)) return '/ə/';
  // 如果包含空格（短语），对每个单词分别生成
  if (w.includes(' ')) {
    return w.split(/\s+/).map(t => generatePhonetic(t)).join(' ');
  }
  const len = w.length;
  let phonemes = [];
  let stressed = false; // 是否已标记重音

  // 辅助：判断字母后是否跟着辅音（闭音节）到词尾
  function isClosedSyllable(idx) {
    for (let i = idx + 1; i < len; i++) {
      if (w[i] === 'e' && i === len - 1) return false; // magic e
      if ('aeiou'.includes(w[i])) return false;
    }
    return true;
  }

  // 辅助：判断是否在词尾
  function isWordEnd(idx) { return idx === len - 1; }

  // 辅助：判断后面是否有元音
  function hasVowelAfter(idx) {
    for (let i = idx + 1; i < len; i++) {
      if ('aeiou'.includes(w[i])) return true;
    }
    return false;
  }

  // 辅助：判断后面是否有辅音+元音（不是词尾e）
  function hasConsThenVowel(idx) {
    for (let i = idx + 1; i < len; i++) {
      if ('aeiou'.includes(w[i])) return true;
      if (w[i] !== 'e' || i !== len - 1) return false;
    }
    return false;
  }

  let i = 0;
  while (i < len) {
    const ch = w[i];

    // 特殊组合处理（优先）
    if (i + 3 < len && w.slice(i, i + 4) === 'tion') {
      phonemes.push('ʃən');
      i += 4; continue;
    }
    if (i + 3 < len && w.slice(i, i + 4) === 'sion') {
      phonemes.push('ʒən');
      i += 4; continue;
    }
    if (i + 3 < len && w.slice(i, i + 4) === 'ture') {
      phonemes.push('tʃər');
      i += 4; continue;
    }

    // 结尾 -ed
    if (ch === 'e' && w[i + 1] === 'd' && i + 1 === len - 1) {
      // 结尾 -ed: t/d 后面 → /ɪd/
      if (i > 0 && (w[i - 1] === 't' || w[i - 1] === 'd')) {
        phonemes.push('ɪd');
      } else if (i > 0 && 'ptkfsʃθ'.includes(w[i - 1])) {
        phonemes.push('t');
      } else {
        phonemes.push('d');
      }
      i += 2; continue;
    }

    // 结尾 -s / -es
    if ((ch === 's' || ch === 'e') && i === len - 1) {
      if (ch === 's' && i > 0) {
        const prev = w[i - 1];
        if ('szʃʒtʃdʒx'.includes(prev)) {
          phonemes.push('ɪz');
        } else if ('ptkfθ'.includes(prev)) {
          phonemes.push('s');
        } else {
          phonemes.push('z');
        }
        i += 1; continue;
      }
      // e at word end (silent)
      if (ch === 'e') { i += 1; continue; }
    }

    // 结尾 -es (如 passes, boxes, matches)
    if (ch === 'e' && w[i + 1] === 's' && i + 1 === len - 1) {
      const prev = i > 0 ? w[i - 1] : '';
      if ('szʃʒtʃdʒx'.includes(prev) || 'szʃʒtʃdʒx'.includes(ch)) {
        phonemes.push('ɪz');
      } else {
        phonemes.push('z');
      }
      i += 2; continue;
    }

    // 多字母组合
    if (ch === 't' && w[i + 1] === 'h') {
      if (!stressed) { phonemes.push('ˈ'); stressed = true; }
      phonemes.push('θ');
      i += 2; continue;
    }
    if (ch === 's' && w[i + 1] === 'h') {
      if (!stressed) { phonemes.push('ˈ'); stressed = true; }
      phonemes.push('ʃ');
      i += 2; continue;
    }
    if (ch === 'c' && w[i + 1] === 'h') {
      if (!stressed) { phonemes.push('ˈ'); stressed = true; }
      phonemes.push('tʃ');
      i += 2; continue;
    }
    if (ch === 'c' && w[i + 1] === 'k') {
      phonemes.push('k');
      i += 2; continue;
    }
    if (ch === 'n' && w[i + 1] === 'g') {
      phonemes.push('ŋ');
      i += 2; continue;
    }
    if (ch === 'w' && w[i + 1] === 'h') {
      phonemes.push('w');
      i += 2; continue;
    }
    if (ch === 'p' && w[i + 1] === 'h') {
      phonemes.push('f');
      i += 2; continue;
    }

    // 双写辅音（只读一次）
    if (i + 1 < len && w[i + 1] === ch && !'aeiou'.includes(ch)) {
      i += 1; // skip duplicate
    }

    // 元音处理
    if ('aeiou'.includes(ch)) {
      // 非重读音节的判断（简化：如果前面已经有元音了，可能是非重读）
      const isUnstressed = stressed && i > 2;

      if (ch === 'a') {
        // ar 组合
        if (w[i + 1] === 'r') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          if (w[i + 2] === 'e') { phonemes.push('eər'); i += 3; }
          else { phonemes.push('ɑːr'); i += 2; }
          continue;
        }
        // ay/ai
        if (w[i + 1] === 'y' || (w[i + 1] === 'i' && !isWordEnd(i + 1))) {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('eɪ');
          i += 2; continue;
        }
        // aw
        if (w[i + 1] === 'w') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('ɔː');
          i += 2; continue;
        }
        // air
        if (w[i + 1] === 'i' && w[i + 2] === 'r') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('eər');
          i += 3; continue;
        }
        // au
        if (w[i + 1] === 'u') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('ɔː');
          i += 2; continue;
        }
        // all
        if (w[i + 1] === 'l' && w[i + 2] === 'l') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('ɔːl');
          i += 3; continue;
        }
        // alk
        if (w[i + 1] === 'l' && w[i + 2] === 'k') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('ɔːk');
          i += 3; continue;
        }
        if (!stressed) {
          phonemes.push('ˈ'); stressed = true;
        }
        if (isWordEnd(i) || (w[i + 1] === 'e' && isWordEnd(i + 1))) {
          // 开音节
          phonemes.push('eɪ');
        } else if (isUnstressed) {
          phonemes.push('ə');
        } else {
          phonemes.push('æ');
        }
        i += 1; continue;
      }

      if (ch === 'e') {
        // er
        if (w[i + 1] === 'r') {
          if (!stressed && !isUnstressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push(isUnstressed ? 'ər' : 'ɜːr');
          i += 2; continue;
        }
        // ea
        if (w[i + 1] === 'a') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('iː');
          i += 2; continue;
        }
        // ee
        if (w[i + 1] === 'e') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('iː');
          i += 2; continue;
        }
        // ei/ey
        if (w[i + 1] === 'i' || w[i + 1] === 'y') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('eɪ');
          i += 2; continue;
        }
        // ew
        if (w[i + 1] === 'w') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('juː');
          i += 2; continue;
        }
        // e at end of word: silent (already handled above)
        if (isWordEnd(i)) { i += 1; continue; }
        // e in closed syllable
        if (!stressed) { phonemes.push('ˈ'); stressed = true; }
        phonemes.push(isUnstressed ? 'ə' : 'e');
        i += 1; continue;
      }

      if (ch === 'i') {
        // ir
        if (w[i + 1] === 'r') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('ɜːr');
          i += 2; continue;
        }
        // ig/igh
        if (w[i + 1] === 'g' && w[i + 2] === 'h') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('aɪ');
          i += 3; continue;
        }
        // ie
        if (w[i + 1] === 'e') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('aɪ');
          i += 2; continue;
        }
        // igh
        if (w[i + 1] === 'g' && w[i + 2] === 'h') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('aɪ');
          i += 3; continue;
        }
        if (!stressed) { phonemes.push('ˈ'); stressed = true; }
        if (isWordEnd(i) || (w[i + 1] === 'e' && isWordEnd(i + 1)) || w[i + 1] === 'y') {
          // 开音节或 i+e
          phonemes.push('aɪ');
        } else if (isUnstressed) {
          phonemes.push('ə');
        } else {
          phonemes.push('ɪ');
        }
        i += 1; continue;
      }

      if (ch === 'o') {
        // or
        if (w[i + 1] === 'r') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push(isUnstressed ? 'ər' : 'ɔːr');
          i += 2; continue;
        }
        // oo
        if (w[i + 1] === 'o') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('uː');
          i += 2; continue;
        }
        // oa
        if (w[i + 1] === 'a') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('oʊ');
          i += 2; continue;
        }
        // oi/oy
        if (w[i + 1] === 'i' || w[i + 1] === 'y') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('ɔɪ');
          i += 2; continue;
        }
        // ou
        if (w[i + 1] === 'u') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          // ould → /ʊd/
          if (w[i + 2] === 'l' && w[i + 3] === 'd') {
            phonemes.push('ʊd');
            i += 4; continue;
          }
          // ous
          if (w[i + 2] === 's' && isWordEnd(i + 2)) {
            phonemes.push('uːs');
            i += 3; continue;
          }
          phonemes.push('aʊ');
          i += 2; continue;
        }
        // ow
        if (w[i + 1] === 'w') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('oʊ');
          i += 2; continue;
        }
        // old/olt
        if ((w[i + 1] === 'l' && (w[i + 2] === 'd' || w[i + 2] === 't'))) {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push('oʊld');
          i += 3; continue;
        }
        // o at end + silent e
        if (!stressed) { phonemes.push('ˈ'); stressed = true; }
        if (isWordEnd(i) || (w[i + 1] === 'e' && isWordEnd(i + 1))) {
          phonemes.push('oʊ');
        } else if (isUnstressed) {
          phonemes.push('ə');
        } else {
          phonemes.push('ɒ');
        }
        i += 1; continue;
      }

      if (ch === 'u') {
        // ur
        if (w[i + 1] === 'r') {
          if (!stressed) { phonemes.push('ˈ'); stressed = true; }
          phonemes.push(isUnstressed ? 'ər' : 'ɜːr');
          i += 2; continue;
        }
        if (!stressed) { phonemes.push('ˈ'); stressed = true; }
        if (isUnstressed) {
          phonemes.push('ə');
        } else if (isWordEnd(i) || (w[i + 1] === 'e' && isWordEnd(i + 1))) {
          phonemes.push('juː');
        } else {
          phonemes.push('ʌ');
        }
        i += 1; continue;
      }

      if (ch === 'y') {
        // y at beginning = /j/
        if (i === 0) {
          phonemes.push('j');
          i += 1; continue;
        }
        // y at end or before consonant
        if (!stressed) { phonemes.push('ˈ'); stressed = true; }
        if (isWordEnd(i) || !hasVowelAfter(i)) {
          phonemes.push('aɪ');
        } else {
          phonemes.push('ɪ');
        }
        i += 1; continue;
      }

      // fallback
      if (!stressed) { phonemes.push('ˈ'); stressed = true; }
      phonemes.push('ə');
      i += 1; continue;
    }

    // 辅音
    const consonantMap = { b: 'b', c: 'k', d: 'd', f: 'f', g: 'ɡ', h: 'h', j: 'dʒ', k: 'k', l: 'l', m: 'm', n: 'n', p: 'p', q: 'kw', r: 'r', s: 's', t: 't', v: 'v', w: 'w', x: 'ks', z: 'z' };
    // c before e/i/y → /s/
    if (ch === 'c' && (w[i + 1] === 'e' || w[i + 1] === 'i' || w[i + 1] === 'y')) {
      phonemes.push('s');
    } else if (ch === 'g' && (w[i + 1] === 'e' || w[i + 1] === 'i' || w[i + 1] === 'y')) {
      phonemes.push('dʒ');
    } else {
      phonemes.push(consonantMap[ch] || ch);
    }
    i += 1;
  }

  const result = phonemes.join('');
  return '/' + (result || 'ə') + '/';
}

/* ============================
   三、内置词库结构
   ============================ */

/* v2.78.0 核心释义：背诵选项、卡片主释义统一用这一份
   来源优先级：① 人工校对的精选词表（src/coreMeanings.js，3852 词）
              ② 从完整释义里取第一个义项
   为什么要单独一份：完整释义常常是「放弃, 抛弃, 遗弃, 使屈从, 沉溺, 放纵」，
   选项里四条都这么长，既看不出重点，也容易和干扰项撞车。 */
function splitTopLevel(text, seps) {
  var out = [], buf = '', depth = 0;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    if (ch === '（' || ch === '(') depth++;
    else if (ch === '）' || ch === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && seps.indexOf(ch) >= 0) { out.push(buf); buf = ''; continue; }
    buf += ch;
  }
  out.push(buf);
  return out;
}

function sanitizeCore(text) {
  var t = String(text || '');
  // 括号里带英文/数字的整段注释（"美分（100cent=1dollar）"）先去掉
  t = t.replace(/[（(][^）)]*[A-Za-z0-9][^）)]*[）)]/g, '');
  t = t.replace(/【[^】]*】/g, '').replace(/…+/g, '');
  t = t.replace(POS_TAG_RE, '$1');   // 「更坏的，ad.更坏」这种词性残留
  // 只在括号外按逗号/分号切义项：「（涂有番茄酱、乳酪等的）意大利馅饼」不能从中间切开
  var parts = splitTopLevel(t, '，,；;、').map(function (x) {
    return x.replace(/^[\s,，、.．]+|[\s,，、.．]+$/g, '').trim();
  }).filter(function (x) {
    if (!x) return false;
    var o = (x.match(/[（(]/g) || []).length;
    var c = (x.match(/[）)]/g) || []).length;
    return o === c;
  });
  t = parts.slice(0, 2).join('，');
  if (t.length > 18) {
    var first = t.split('，')[0];
    t = first.length <= 18 ? first : first.slice(0, 18);
  }
  return t.replace(/^[，,、]+|[，,、]+$/g, '').trim();
}

// 每词只算一次：同一个词在不同词库里 meaning 可能不同，核心释义必须一致
var _coreCache = {};
function coreOf(term, meaning) {
  var key = String(term == null ? '' : term).toLowerCase().trim();
  if (Object.prototype.hasOwnProperty.call(_coreCache, key)) return _coreCache[key];
  var c = key ? CORE_MEANINGS[key] : '';
  var out = c
    ? sanitizeCore(String(c))
    : sanitizeCore(stripPosPrefix(getShortMeaning(cleanMeaning(meaning))));
  if (!out) out = sanitizeCore(cleanMeaning(meaning));
  _coreCache[key] = out;
  return out;
}

function makeItem(row, type, index, source) {
  const [term, pos, meaning, frequency, corePoints, allPoints, examples] = row;
  const core = coreOf(term, meaning);
  // v2.78.0：含 DOS 命令 / 缩略语展开 / 语法注释的释义，清洗后仍是断句残片，
  // 直接用核心释义替换，避免详情页还在显示「计算机辅助教育」这类内容
  const dirty = MEANING_JUNK_RE.test(String(meaning || '')) || /的(过去式|过去分词|现在分词|复数)/.test(String(meaning || ''));
  return {
    id: `${type}-${index}-${term}`,
    type, term, pos,
    // v2.76.0：入库即清洗词性标记（"a. 能干的" → "能干的"），
    // 显示 / 搜索 / 朗读三处共用同一份文本，避免同一条释义在不同页面表现不一致
    meaning: (dirty && core) ? core : cleanMeaning(meaning),
    // v2.78.0：核心释义（高频、1~2 个义项），背诵页选项与卡片主释义使用
    core: core,
    // v2.43.0 修复闪退：4元素精简词条（总汇词库）解构后 corePoints 等为 undefined，
    // 详情页 .map() 直接崩溃；此处统一兜底为空数组
    frequency: frequency || '拓展',
    corePoints: Array.isArray(corePoints) ? corePoints : [],
    allPoints: Array.isArray(allPoints) ? allPoints : [],
    examples: Array.isArray(examples) ? examples : [],
    phonetic: generatePhonetic(term),
    notes: '',
    source: source || '内置高考词库'
  };
}

function makeAllItems(seedArr, type, source) {
  return seedArr.map((row, i) => makeItem(row, type.includes('phrase') || type.includes('词组') || type.includes('易混') || type.includes('同义') || type.includes('反义') || type.includes('逻辑') || type.includes('结论') || type.includes('熟词') || type.includes('生义') || type.includes('褒贬') || type.includes('易错') || type.includes('超纲') || type.includes('必考') || type.includes('真题') || type.includes('主题') ? 'phrase' : type, i, source));
}



// v2.43.0 人工校对词族补充表：算法无法覆盖的真实词族（含词性+中文）
// 不在词库内的关联词会以「单词 词性 中文」形式展示
// （如 picture → depict v. 描绘，彻底解决“图片关联词全是假关联”的问题）
const WORD_FAMILY_SUPPLEMENT_RAW = {
  picture: [['picturesque', 'adj.', '如画的；别致的'], ['depict', 'v.', '描绘；描述'], ['depiction', 'n.', '描写；描绘']],
  see: [['sight', 'n.', '视力；景象'], ['eyesight', 'n.', '视力'], ['insight', 'n.', '洞察力；见识']],
  speak: [['speech', 'n.', '演讲；言语'], ['speechless', 'adj.', '说不出话的']],
  think: [['thought', 'n.', '想法；思想'], ['thoughtful', 'adj.', '深思的；体贴的'], ['thank', 'v.', '感谢']],
  two: [['twice', 'adv.', '两次；两倍'], ['twelve', 'num.', '十二'], ['twenty', 'num.', '二十'], ['between', 'prep.', '在……之间']],
  five: [['fifteen', 'num.', '十五'], ['fifty', 'num.', '五十']],
  die: [['dead', 'adj.', '死的'], ['death', 'n.', '死亡'], ['deadly', 'adj.', '致命的'], ['deadline', 'n.', '截止期限']],
  food: [['feed', 'v.', '喂养；饲养'], ['feedback', 'n.', '反馈']],
  blood: [['bleed', 'v.', '流血'], ['bloody', 'adj.', '血腥的']],
  sell: [['sale', 'n.', '出售；廉价销售'], ['salesman', 'n.', '售货员']],
  lose: [['loss', 'n.', '损失'], ['lost', 'adj.', '迷失的；丢失的']],
  long: [['length', 'n.', '长度'], ['lengthen', 'v.', '加长；延长']],
  broad: [['breadth', 'n.', '宽度'], ['broaden', 'v.', '拓宽']],
  heal: [['health', 'n.', '健康'], ['healthy', 'adj.', '健康的']],
  poor: [['poverty', 'n.', '贫穷；缺乏']],
  rich: [['enrich', 'v.', '使丰富；充实']],
  pride: [['proud', 'adj.', '自豪的'], ['proudly', 'adv.', '自豪地']],
  shame: [['ashamed', 'adj.', '羞愧的'], ['shameful', 'adj.', '可耻的']],
  honor: [['honest', 'adj.', '诚实的'], ['honesty', 'n.', '诚实']],
  joy: [['enjoy', 'v.', '享受；欣赏'], ['enjoyable', 'adj.', '令人愉快的'], ['joyful', 'adj.', '欢喜的']],
  like: [['dislike', 'v.', '不喜欢'], ['unlike', 'prep.', '不像'], ['alike', 'adj.', '相似的']],
  love: [['beloved', 'adj.', '心爱的']],
  sleep: [['asleep', 'adj.', '睡着的'], ['sleepy', 'adj.', '困倦的'], ['sleepless', 'adj.', '失眠的']],
  wake: [['awake', 'adj.', '醒着的'], ['waken', 'v.', '唤醒']],
  stand: [['understand', 'v.', '理解'], ['outstanding', 'adj.', '杰出的'], ['standpoint', 'n.', '立场；观点'], ['withstand', 'v.', '经受；承受']],
  sit: [['seat', 'n./v.', '座位；使坐下']],
  fly: [['flight', 'n.', '航班；飞行']],
  ride: [['road', 'n.', '道路']],
  take: [['mistake', 'n./v.', '错误；误解'], ['overtake', 'v.', '超过；超车'], ['undertake', 'v.', '承担；从事']],
  get: [['forget', 'v.', '忘记'], ['forgetful', 'adj.', '健忘的']],
  put: [['input', 'n./v.', '输入'], ['output', 'n.', '输出']],
  set: [['sunset', 'n.', '日落'], ['outset', 'n.', '开始'], ['upset', 'adj./v.', '心烦的；打翻']],
  do: [['undo', 'v.', '撤销；解开']],
  look: [['outlook', 'n.', '前景；观点'], ['overlook', 'v.', '忽视；俯视'], ['onlooker', 'n.', '旁观者']],
  door: [['indoor', 'adj.', '室内的'], ['outdoor', 'adj.', '户外的'], ['outdoors', 'adv.', '在户外']],
  sheep: [['shepherd', 'n.', '牧羊人']],
  city: [['citizen', 'n.', '市民'], ['citizenship', 'n.', '公民身份']],
  school: [['scholar', 'n.', '学者'], ['scholarship', 'n.', '奖学金；学问']],
  moon: [['month', 'n.', '月份'], ['Monday', 'n.', '星期一']],
  sun: [['Sunday', 'n.', '星期日']],
  head: [['ahead', 'adv.', '在前面'], ['forehead', 'n.', '前额'], ['overhead', 'adv.', '在头顶上'], ['headline', 'n.', '标题']],
  hand: [['handsome', 'adj.', '英俊的'], ['handful', 'n.', '一把；少数']],
  eye: [['eyebrow', 'n.', '眉毛'], ['eyewitness', 'n.', '目击者']],
  arm: [['armchair', 'n.', '扶手椅']],
  way: [['subway', 'n.', '地铁'], ['railway', 'n.', '铁路'], ['highway', 'n.', '公路']],
  work: [['network', 'n.', '网络']],
  house: [['household', 'n.', '家庭；一家人']],
  man: [['chairman', 'n.', '主席'], ['manly', 'adj.', '有男子气概的']],
  self: [['myself', 'pron.', '我自己'], ['yourself', 'pron.', '你自己'], ['himself', 'pron.', '他自己'], ['herself', 'pron.', '她自己'], ['itself', 'pron.', '它自己'], ['ourselves', 'pron.', '我们自己'], ['themselves', 'pron.', '他们自己']],
  old: [['elder', 'n.', '长者'], ['elderly', 'adj.', '年长的']],
  new: [['renew', 'v.', '更新；续借']],
  high: [['height', 'n.', '高度']],
  young: [['youth', 'n.', '青年；青春'], ['youthful', 'adj.', '年轻的']],
  far: [['farther', 'adj./adv.', '更远的'], ['farthest', 'adj./adv.', '最远的']],
  hungry: [['hunger', 'n.', '饥饿']],
  sorry: [['sorrow', 'n.', '悲伤']],
  safe: [['save', 'v.', '拯救；节省']],
  day: [['daily', 'adj./adv.', '每日的'], ['midday', 'n.', '正午']],
  night: [['midnight', 'n.', '午夜'], ['tonight', 'adv.', '今晚'], ['nightmare', 'n.', '噩梦']],
  light: [['enlighten', 'v.', '启发；开导']],
  right: [['copyright', 'n.', '版权']],
  name: [['nickname', 'n.', '昵称；绰号']],
};
// 双向索引：depict → picture 也能找到
const WORD_FAMILY_SUPPLEMENT = {};
for (const [head, list] of Object.entries(WORD_FAMILY_SUPPLEMENT_RAW)) {
  const h = head.toLowerCase();
  for (const [t, p, m] of list) {
    const k = t.toLowerCase();
    if (!WORD_FAMILY_SUPPLEMENT[h]) WORD_FAMILY_SUPPLEMENT[h] = [];
    WORD_FAMILY_SUPPLEMENT[h].push({ term: t, pos: p, meaning: cleanMeaning(m) });
    if (!WORD_FAMILY_SUPPLEMENT[k]) WORD_FAMILY_SUPPLEMENT[k] = [];
    WORD_FAMILY_SUPPLEMENT[k].push({ term: head, pos: '', meaning: '', headOf: h });
  }
}

// 获取词族补充（供 findWordFamily 使用）
function getSupplementFamily(word) {
  return WORD_FAMILY_SUPPLEMENT[word.toLowerCase().trim()] || [];
}


/* v2.43.0 词族补充词并入高考总汇词库：depict/picturesque 等拓展词可搜索、可背诵。
   v2.79.0：源数据（gaokaoMasterVocab）改为动态 import，原模块级 IIFE 改成
   「数据到货后执行」的初始化函数，逻辑逐行保持不变。 */
let MASTER_SUPPLEMENT_TERMS = [];
let MASTER_VOCAB_ALL = [];
/* masterVocabLookup 只做「本地镜像」：调用方（补全释义、搜索联想）读的一直是这个对象，
   数据模块加载完再把内容灌进来，调用方代码一行都不用改。 */
const masterVocabLookup = {};
let _masterVocabReady = false;

/**
 * 把高考总汇词库的数据模块装进运行时的镜像对象。
 * 幂等：重复调用只有第一次生效。
 * @param {{masterVocabSeed: Array, masterVocabLookup: Object}} mod 动态 import 得到的模块
 */
function initMasterVocab(mod) {
  if (_masterVocabReady) return;
  _masterVocabReady = true;
  const seed = (mod && Array.isArray(mod.masterVocabSeed)) ? mod.masterVocabSeed : [];
  const lookup = (mod && mod.masterVocabLookup) ? mod.masterVocabLookup : {};
  const seen = new Set(seed.map(e => String(e[0]).toLowerCase()));
  const out = [];
  for (const [head, list] of Object.entries(WORD_FAMILY_SUPPLEMENT_RAW)) {
    for (const [t, pp, mm] of list) {
      const k = String(t).toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push([t, pp, mm, '词族拓展']); }
    }
  }
  for (const [t, pp, mm] of out) {
    const k = String(t).toLowerCase();
    if (!lookup[k]) lookup[k] = { pos: pp, meaning: cleanMeaning(mm) };
  }
  Object.keys(lookup).forEach(function (k) { masterVocabLookup[k] = lookup[k]; });
  MASTER_SUPPLEMENT_TERMS = out;
  MASTER_VOCAB_ALL = seed.concat(out);
}

/* ---- wordEnrichment（词根词缀/例句拓展，666KB）改为懒加载 ---- */
let _enrichMod = null;
let _enrichLoading = false;

/**
 * 取某个词的拓展信息（词根、词缀、联想）。
 * 数据模块没就绪时返回 null —— 调用方本来就用 `enrichment && ...` 做守卫，
 * 所以首屏几百毫秒内详情页只是少了这一块，不会报错；到货后会触发一次重渲染。
 * @param {string} term 单词
 * @returns {object|null}
 */
function getWordEnrichment(term) {
  if (!_enrichMod || typeof _enrichMod.getWordEnrichment !== 'function') return null;
  try { return _enrichMod.getWordEnrichment(term); } catch (e) { return null; }
}

/** 后台加载 wordEnrichment 数据模块（不阻塞首屏）。 */
function loadEnrichment() {
  if (_enrichMod || _enrichLoading) return;
  _enrichLoading = true;
  import('./vendor/wordEnrichment').then(function (mod) {
    _enrichMod = mod;
    _enrichLoading = false;
    _emitBookData();   // 让详情页 / 闪卡重新渲染，把词根词缀补上
  }).catch(function (e) {
    _enrichLoading = false;
    console.error('[enrichment] 拓展词库加载失败（不影响背诵）', e);
  });
}

/* ---- 工具页纯数据（词根词缀 / 场景 / 易混词 / 数词日期 / 拼写 / 同反义对比，110KB）懒加载 ---- */
let sceneData = [];
let affixData = { prefixes: [], suffixes: [], roots: [] };
let confusingWordsData = [];
let numberDateData = { months: [], weekdays: [], seasons: [], dateWords: [], numbers: [], extraNumbers: [] };
let spellingData = [];
let seedSynonyms = [];
let seedAntonyms = [];
let _toolDataReady = false;
let _toolDataLoading = false;

/**
 * 后台加载工具页数据。加载前用「空结构」占位（不是 undefined），
 * 所以各工具页在数据到货前只是列表为空，不会抛错；到货后触发一次重渲染。
 */
function loadToolData() {
  if (_toolDataReady || _toolDataLoading) return;
  _toolDataLoading = true;
  import('./data/tool-data').then(function (mod) {
    sceneData = mod.sceneData || [];
    affixData = mod.affixData || affixData;
    confusingWordsData = mod.confusingWordsData || [];
    numberDateData = mod.numberDateData || numberDateData;
    spellingData = mod.spellingData || [];
    seedSynonyms = mod.seedSynonyms || [];
    seedAntonyms = mod.seedAntonyms || [];
    _toolDataReady = true;
    _toolDataLoading = false;
    _emitBookData();
  }).catch(function (e) {
    _toolDataLoading = false;
    console.error('[tool-data] 工具页数据加载失败', e);
  });
}

/* ---- 默认头像（base64 JPEG，20KB）也挪出首屏；加载到之前用内置 SVG 占位 ---- */
let DEFAULT_AVATAR = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><circle cx="48" cy="48" r="48" fill="#dbeafe"/><circle cx="48" cy="38" r="16" fill="#93c5fd"/><path d="M16 90c4-18 16-27 32-27s28 9 32 27z" fill="#93c5fd"/></svg>'
);
let _avatarLoading = false;
let _avatarReady = false;

/** 后台加载内置头像图片（我的页用），到货后重渲染替换占位图。 */
function loadDefaultAvatar() {
  if (_avatarReady || _avatarLoading) return;
  _avatarLoading = true;
  import('./avatarData').then(function (mod) {
    if (mod && mod.DEFAULT_AVATAR) DEFAULT_AVATAR = mod.DEFAULT_AVATAR;
    _avatarReady = true;
    _avatarLoading = false;
    _emitBookData();
  }).catch(function (e) {
    _avatarLoading = false;
    console.error('[avatar] 内置头像加载失败', e);
  });
}


/* 内置词库清单（v2.79.0）
   ---------------------------------------------------------------
   词条数据不再在模块加载期就算好，而是「登记 + 按需下载」：
     · BOOK_DEFS        —— 声明式清单：id / 名称 / 类型 / 来源 / 总词数 / 数据加载器
     · builtInBooks     —— 立刻可用的书对象（items 先为空数组），界面渲染不依赖数据
     · ensureBookData() —— 拉数据 + makeAllItems + 原地替换 items + 通知界面重渲染
   items 采用「原地替换」而不是新建书对象，是为了让 loadBooks()/删除词库/已掌握词库
   等已有逻辑（它们持有同一批对象引用）完全不用改。
   total 用来在数据到达前就显示正确词数（`已掌握 0/3599` 而不是 `0/0`）。 */
const BOOK_DEFS = [
  {
    id: 'gaokao-3500',
    name: '高考3500词',
    type: 'word',
    source: '高考3500词',
    total: 3599,
    load: () => import('./data/seeds-3500'),
    pick: (m) => m.seedWords3500,
  },
  {
    // v2.43.0 高考总汇词库：高考3500 + 人教版高中全模块 + CET4/6 拓展（去重）+ 词族拓展词
    // 收录高考考察点全部单词，可用于背诵与全库搜索
    // v2.79.0：名称里的词数由数据决定，数据到货后按真实长度回写（见 after）
    id: 'gaokao-master',
    name: '高考总汇词库',
    type: 'word',
    source: '高考总汇词库',
    total: 6503,
    load: () => import('./vendor/gaokaoMasterVocab'),
    pick: (m) => { initMasterVocab(m); return MASTER_VOCAB_ALL; },
    after: (m, book) => { book.name = `高考总汇词库(${MASTER_VOCAB_ALL.length}词)`; },
  },
  {
    // 688高频词：从高频词文档解析，按高考出现频次排序
    id: 'gaokao-688',
    name: '688高频词',
    type: 'word',
    source: '688高频词',
    total: 687,
    load: () => import('./data/seeds-688'),
    pick: (m) => m.seedWords688,
  },
  {
    id: 'gaokao-985',
    name: '985阅读理解核心词汇',
    type: 'word',
    source: '',
    total: 977,
    load: () => import('./data/seeds-985'),
    pick: (m) => m.seedWords985,
  },
  {
    id: 'gaokao-105',
    name: '105必考核心词(2021-2025)',
    type: 'word',
    source: '',
    total: 93,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedWords105,
  },
  {
    id: 'gaokao-exam',
    name: '近五年真题高频词',
    type: 'word',
    source: '',
    total: 508,
    load: () => import('./data/seeds-exam'),
    pick: (m) => m.seedWordsExam,
  },
  {
    id: 'gaokao-positive',
    name: '褒义词(92个)',
    type: 'word',
    source: '',
    total: 89,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedWordsPositive,
  },
  {
    id: 'gaokao-negative',
    name: '贬义词(83个)',
    type: 'word',
    source: '',
    total: 80,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedWordsNegative,
  },
  {
    id: 'gaokao-super',
    name: '超纲高频词(99个)',
    type: 'word',
    source: '',
    total: 98,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedWordsSuper,
  },
  {
    id: 'gaokao-conclusion',
    name: '逻辑结论词(13个)',
    type: 'phrase',
    source: '',
    total: 13,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedConclusion,
  },
  {
    id: 'gaokao-topic',
    name: '高考高频主题词(30个)',
    type: 'phrase',
    source: '',
    total: 31,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedTopic,
  },
  {
    id: 'gaokao-familiar-new',
    name: '熟词生义(150个)',
    type: 'phrase',
    source: '',
    total: 172,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedFamiliarNew,
  },
  {
    id: 'gaokao-dual-sentiment',
    name: '褒贬双性词(17个)',
    type: 'phrase',
    source: '',
    total: 17,
    load: () => import('./data/seeds-small'),
    pick: (m) => m.seedDualSentiment,
  },
];

const BOOK_DEF_BY_ID = {};
const _bookById = {};

const builtInBooks = BOOK_DEFS.map(function (def) {
  const book = { id: def.id, name: def.name, editable: false, items: [], total: def.total };
  BOOK_DEF_BY_ID[def.id] = def;
  _bookById[def.id] = book;
  return book;
});
// 已掌握词库始终排在最后（内容由 progress 动态计算，见 App 里的 useEffect）
builtInBooks.push({ id: 'mastered-words', name: '已掌握词库', editable: false, items: [], total: 0 });

/* ---- 词库数据加载状态（供 UI 显示「加载中」/「加载失败」与排查用） ---- */
const BOOK_DATA_STATE = {};          // id -> 'loading' | 'ready' | 'error'
const BOOK_DATA_ERRORS = {};         // id -> 面向用户的简短失败原因（成功后清除）
const _bookLoadPromises = {};
const _bookDataSubs = new Set();

/**
 * 把动态 import 的底层异常压成一句人能看懂的短原因。
 * 控制台仍保留完整异常，页面只展示这一句，避免把 URL / 堆栈糊到用户脸上。
 * @param {unknown} e 异常对象
 * @returns {string} 简短中文原因
 */
function briefBookDataError(e) {
  const msg = String((e && (e.message || e)) || '');
  if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(msg)) {
    return '词库分片下载失败，请检查网络后重试';
  }
  if (/Failed to fetch|NetworkError|net::ERR|网络/i.test(msg)) {
    return '网络请求失败，请检查网络后重试';
  }
  if (/timeout|timed out|超时/i.test(msg)) {
    return '下载超时，请重试';
  }
  return '词库数据读取失败，请重试';
}

/**
 * 订阅「词库数据有更新」：每拉到一个词库的数据就会回调一次。
 * @param {Function} cb 回调
 * @returns {Function} 取消订阅
 */
function onBookData(cb) {
  if (typeof cb !== 'function') return function () {};
  _bookDataSubs.add(cb);
  return function () { _bookDataSubs.delete(cb); };
}

function _emitBookData() {
  _bookDataSubs.forEach(function (cb) {
    try { cb(); } catch (e) { console.error('[book-data] 订阅回调异常', e); }
  });
}

/* 浏览器会把「动态 import 失败」记在 module map 里：同一个 URL 再次 import
   会直接复用失败结果，连请求都不发。所以重试必须换一个 URL 才能真的重新下载。
   build-web.js 会在产物里把分片引用包一层 window.__bookChunkUrl()；
   递增 nonce 后 URL 带上 ?r=N。
   单文件产物没有分片（import() 已被静态化），这个函数不会被调用。 */
let _bookChunkNonce = 0;
/**
 * 给分片 URL 附加当前重试代号，绕开浏览器对失败模块的缓存。
 * @param {string} url 原始分片相对路径
 * @returns {string} 可能带 ?r=N 的 URL
 */
function bookChunkUrl(url) {
  return _bookChunkNonce > 0
    ? url + (url.indexOf('?') >= 0 ? '&' : '?') + 'r=' + _bookChunkNonce
    : url;
}
try { window.__bookChunkUrl = bookChunkUrl; } catch (e) {}

/**
 * 确保某个内置词库的数据已就位（幂等，重复调用只下载一次）。
 * @param {string} id 词库 id
 * @returns {Promise<object|null>} 就绪后的书对象，失败返回 null
 */
function ensureBookData(id) {
  if (_bookLoadPromises[id]) return _bookLoadPromises[id];
  const def = BOOK_DEF_BY_ID[id];
  const book = _bookById[id];
  if (!def || !book) return Promise.resolve(null);
  BOOK_DATA_STATE[id] = 'loading';
  delete BOOK_DATA_ERRORS[id];
  _emitBookData();
  _bookLoadPromises[id] = def.load().then(function (mod) {
    const seed = def.pick(mod) || [];
    book.items = makeAllItems(seed, def.type, def.source);
    if (typeof def.after === 'function') {
      try { def.after(mod, book); } catch (e) { console.error('[book-data] after 钩子异常: ' + id, e); }
    }
    BOOK_DATA_STATE[id] = 'ready';
    delete BOOK_DATA_ERRORS[id];
    /* 词数对不上说明「改了 data/seeds-*.js 但没同步 BOOK_DEFS.total」，
       界面上的 (词数) 会显示旧数字，这里留一条明确的告警方便排查。 */
    if (book.total > 0 && book.items.length !== book.total) {
      console.warn('[book-data] 词数与 BOOK_DEFS.total 不一致: ' + id + ' items=' + book.items.length + ' total=' + book.total);
    }
    _emitBookData();
    return book;
  }).catch(function (e) {
    BOOK_DATA_STATE[id] = 'error';
    BOOK_DATA_ERRORS[id] = briefBookDataError(e);
    console.error('[book-data] 词库数据加载失败: ' + id, e);
    _emitBookData();
    return null;
  });
  return _bookLoadPromises[id];
}

/**
 * 重试所有加载失败的内置词库。
 * 失败的 Promise 会被 _bookLoadPromises 缓存，不清掉的话再调 ensureBookData
 * 只会立刻拿到同一个失败结果，所以这里先删缓存 + 清 error 标记，再重新拉取。
 * 一次把所有失败词库都重试，避免用户切一本要点一次、也避免提示重复叠加。
 * @returns {string[]} 本次发起重试的词库 id 列表
 */
function retryBookData() {
  const ids = Object.keys(BOOK_DATA_STATE).filter(function (id) {
    return BOOK_DATA_STATE[id] === 'error';
  });
  if (ids.length === 0) return ids;
  // 换一批 URL：否则浏览器直接复用上次失败的 module map 结果，重试等于没点
  _bookChunkNonce += 1;
  ids.forEach(function (id) {
    delete _bookLoadPromises[id];
    delete BOOK_DATA_ERRORS[id];
    delete BOOK_DATA_STATE[id];
  });
  // 先通知界面「回到加载中」，再发起请求；否则用户点了重试还看着旧的错误文案
  _emitBookData();
  ids.forEach(function (id) { ensureBookData(id); });
  return ids;
}

/**
 * 首屏渲染完成后启动的后台数据加载。
 * 顺序：默认词库（背诵/听读页立即可用）→ 其余词库并行 → 词根词缀拓展。
 */
function loadBookDataInBackground() {
  // 暴露加载状态，便于线上排查「某个词库没出来」（不影响业务逻辑）
  try {
    window.__bookDataState = BOOK_DATA_STATE;
    window.__bookDataErrors = BOOK_DATA_ERRORS;
    window.__retryBookData = retryBookData;
  } catch (e) {}
  // 默认词库最优先：背诵页 / 听读页一进去就要有词
  ensureBookData('gaokao-3500').then(function () {
    /* 其余词库等默认词库就绪后再并行拉：
       小水管（2G/弱 4G）上并发 6 个大 chunk 会互相抢带宽，把「背诵页出第一题」
       拖慢好几秒；串行化这一步之后，首屏词库能独享带宽。 */
    BOOK_DEFS.forEach(function (d) { if (d.id !== 'gaokao-3500') ensureBookData(d.id); });
    setTimeout(loadEnrichment, 1200);
    setTimeout(loadToolData, 1600);
  });
  // 头像只有 21KB，且只在「我的」页用，先挂着下载即可
  try { loadDefaultAvatar(); } catch (e) {}
}

/* ============================
   四、背诵模式配置
   ============================ */

const choiceModes = [
  { id: 'en-to-cn', name: '英文选中文' },
  { id: 'cn-to-en', name: '中文选英文' },
  { id: 'sentence', name: '例句语境' },
  { id: 'flashcard', name: '闪卡模式' }
];


/* ============================
   六、进度追踪和设置
   ============================ */

const PROGRESS_KEY = 'gaokao_progress';
const SETTINGS_KEY = 'gaokao_settings';
const MODE_KEY = 'gaokao_practice_mode';
const STUDYLOG_KEY = 'gaokao_study_log';
const STUDY_WORDS_KEY = 'gaokao_study_words_log';
const WRONG_KEY = 'gaokao_wrong_words';

function loadProgress() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    // 兼容旧数据：旧格式 key 如 "word-0-abandon" 或 "phrase-5-take-off"
    // 注意：不能简单地用 includes('-') 判断，因为合法 term 也可能含连字符（如 pass-by）
    // 旧格式特征：以 "word-" 或 "phrase-" 开头，后跟数字，再跟连字符和 term
    const oldKeyPattern = /^(word|phrase)-\d+-/;
    const hasOldKeys = Object.keys(raw).some(k => oldKeyPattern.test(k));
    // 检查是否有非小写 key 或含空格的 key（旧数据大小写敏感/空格迁移）
    const needsMigration = Object.keys(raw).some(k =>
      k !== k.toLowerCase().trim() || oldKeyPattern.test(k)
    );
    if (needsMigration) {
      const converted = {};
      Object.entries(raw).forEach(([k, v]) => {
        let key = k;
        const oldMatch = k.match(oldKeyPattern);
        if (oldMatch) {
          // 旧格式 key 如 "word-0-abandon"，提取 term（去掉前缀 "word-0-" 部分）
          key = k.slice(oldMatch[0].length);
        }
        // 统一转为小写并去空格，确保大小写/空格不敏感匹配
        key = key.toLowerCase().trim();
        // 如果转换后 key 已存在（如旧数据中 "word-0-pass-by" 和 "pass-by" 同时存在），保留 mastered 状态
        if (converted[key] !== 'mastered' && v === 'mastered') {
          converted[key] = v;
        } else if (!(key in converted)) {
          converted[key] = v;
        }
      });
      // 保存转换后的数据
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(converted));
      return converted;
    }
    return raw;
  } catch { return {}; }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    // v2.50.0 独立存储背诵模式，防止设置对象变化时模式丢失
    const savedMode = localStorage.getItem(MODE_KEY);
    if (savedMode && !saved.mode) saved.mode = savedMode;
    const merged = {
      dailyGoal: 50,
      speakRate: 0.78,
      mode: 'en-to-cn',
      difficulty: 'easy',
      detailMode: 'brief',
      shuffleMode: false,
      autoJump: false,
      autoJumpDelay: 1500,
      showAnnouncement: true,
      autoMaster: false,
      volumeKeyNav: false,
      // v2.80.0：护眼模式（暖色低蓝光单开关）
      eyeCare: false,
      // v2.80.0：艾宾浩斯记忆法（按遗忘曲线安排复习）
      ebbinghaus: false,
      // v2.80.0：答题音效
      soundEnabled: false,
      soundCorrect: 'c1',
      soundWrong: 'w1',
      // v2.55.9: 自动发音开关归一。
      // v2.44.0 已把"背诵新词自动发音"与"跳转自动发音"合并为一个开关，
      // 但老版本保存的设置里没有 autoSpeak 字段，旧默认 false 会导致：
      // 开关显示为"开"（读的是 navAutoSpeak），实际 autoSpeak=false，自动发音永不触发。
      // 迁移规则：saved 无 autoSpeak 字段时从 navAutoSpeak 派生，两者归一为同一值。
      navAutoSpeak: true,
      ...saved
    };
    if (!('autoSpeak' in saved) || typeof saved.autoSpeak !== 'boolean') {
      merged.autoSpeak = merged.navAutoSpeak !== false;
    }
    merged.navAutoSpeak = merged.autoSpeak !== false;
    return merged;
  } catch {
    const savedMode = localStorage.getItem(MODE_KEY);
    return { dailyGoal: 50, speakRate: 0.78, mode: savedMode || 'en-to-cn', difficulty: 'easy', detailMode: 'brief', shuffleMode: false, autoJump: false, autoJumpDelay: 1500, showAnnouncement: true, autoSpeak: true, autoMaster: false, navAutoSpeak: true, volumeKeyNav: false, eyeCare: false, ebbinghaus: false, soundEnabled: false, soundCorrect: 'c1', soundWrong: 'w1' };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  // v2.50.0 独立存储背诵模式，确保永不丢失
  if (settings.mode) localStorage.setItem(MODE_KEY, settings.mode);
}

function loadBooks() {
  try {
    const saved = JSON.parse(localStorage.getItem('customBooks') || '[]');
    return [...builtInBooks, ...saved];
  } catch {
    return [...builtInBooks];
  }
}

function saveCustomBooks(books) {
  localStorage.setItem('customBooks', JSON.stringify(books.filter(b => b.editable)));
}

/* ============================
   v2.80.0：艾宾浩斯记忆法
   ---------------------------------------------------------------
   开启后，每词记录「下次复习时间」，按遗忘曲线间隔递推：
   20分钟 → 1小时 → 9小时 → 1天 → 2天 → 6天 → 15天 → 35天。
   答对：进入下一间隔；答错：回到第 1 间隔（20 分钟后重排）。
   背诵页会把「已到期（含新词）」的词优先排到前面。
   数据存 localStorage，老用户无此字段时自然视为新词。
   ============================ */
const EB_INTERVALS = [
  20 * 60 * 1000,        // 20 分钟
  60 * 60 * 1000,        // 1 小时
  9 * 60 * 60 * 1000,    // 9 小时
  24 * 60 * 60 * 1000,   // 1 天
  2 * 24 * 60 * 60 * 1000,  // 2 天
  6 * 24 * 60 * 60 * 1000,  // 6 天
  15 * 24 * 60 * 60 * 1000, // 15 天
  35 * 24 * 60 * 60 * 1000  // 35 天
];
const EB_KEY = 'gaokao_review_schedule';
function loadReviewSchedule() {
  try { return JSON.parse(localStorage.getItem(EB_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function saveReviewSchedule(s) {
  try { localStorage.setItem(EB_KEY, JSON.stringify(s)); } catch (e) {}
}
const _reviewSchedule = loadReviewSchedule();
function recordEbbinghaus(term, correct) {
  const k = termKey(term);
  const cur = _reviewSchedule[k] || { l: 0, d: 0 };
  if (correct) {
    const l = Math.min((cur.l || 0) + 1, EB_INTERVALS.length - 1);
    cur.l = l;
    cur.d = Date.now() + EB_INTERVALS[l];
  } else {
    cur.l = 0;
    cur.d = Date.now() + EB_INTERVALS[0];
  }
  _reviewSchedule[k] = cur;
  saveReviewSchedule(_reviewSchedule);
}
// 排序键：到期时间越早（含新词 d=0）越靠前
function ebSortKey(item) {
  const e = _reviewSchedule[termKey(item.term)];
  return e ? e.d : 0;
}

/* ============================
   v2.80.0：答题音效（真实 MP3，base64 内嵌，离线可用）
   ================================================================ */
function playAnswerSfx(isCorrect, correctId, wrongId) {
  const list = isCorrect ? SFX_CORRECT : SFX_WRONG;
  const id = isCorrect ? correctId : wrongId;
  const item = list.find(s => s.id === id) || list[0];
  if (!item || !item.data) return;
  try {
    const a = new Audio(item.data);
    a.volume = 1;
    const p = a.play();
    if (p && typeof p.catch === 'function') p.catch(function () {});
  } catch (e) {}
}

function loadStudyLog() {
  try { return JSON.parse(localStorage.getItem(STUDYLOG_KEY) || '{}'); } catch { return {}; }
}

function saveStudyLog(log) {
  localStorage.setItem(STUDYLOG_KEY, JSON.stringify(log));
}

function loadStudyWordsLog() {
  try { return JSON.parse(localStorage.getItem(STUDY_WORDS_KEY) || '{}'); } catch { return {}; }
}

function saveStudyWordsLog(log) {
  localStorage.setItem(STUDY_WORDS_KEY, JSON.stringify(log));
}


function loadWrongWords() {
  try { return JSON.parse(localStorage.getItem(WRONG_KEY) || '[]'); } catch { return []; }
}

function saveWrongWords(words) {
  localStorage.setItem(WRONG_KEY, JSON.stringify(words));
}

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function getStreakDays(log) {
  let streak = 0;
  const d = new Date();
  // 从今天开始往前数连续打卡天数
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (log[key] && log[key] > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

function getStudyDays(log) {
  return Object.keys(log).filter(k => log[k] > 0).length;
}

/* ============================
   七、文本解析工具
   ============================ */

const POS_WORDS = ['modal v', 'phrasal v', 'vt', 'vi', 'n', 'v', 'a', 'ad', 'adj', 'adv', 'prep', 'conj', 'pron', 'num', 'art', 'interj', 'aux', 'pl', 'abbr'];
const POS_ALIASES = { a: 'adj', ad: 'adv' };
const POS_REGEX_SOURCE = '(?:modal\\s*v|phrasal\\s*v|vt|vi|adj|adv|prep|conj|pron|num|art|interj|aux|abbr|pl|ad|a|n|v)';
const POS_REGEX = new RegExp(`(?:^|[\\s,，;；|/])((?:${POS_REGEX_SOURCE})(?:\\s*[/&、]\\s*(?:${POS_REGEX_SOURCE}))*)`, 'i');
const POS_GLOBAL_REGEX = new RegExp(`(?:^|[\\s,，;；|/])(${POS_REGEX_SOURCE})`, 'gi');
const LABEL_REGEX = /(考点|重点|核心|用法|搭配|短语|例句|易错|辨析|派生|同义|反义|词组|固定搭配|语法)\s*[:：]?/g;

/* 词性分类标签 */
const POS_CATEGORIES = [
  { id: '全部', label: '全部' },
  { id: 'n.', label: '名词' },
  { id: 'vt.', label: '动词' },
  { id: 'vi.', label: '动词' },
  { id: 'v.', label: '动词' },
  { id: 'adj.', label: '形容词' },
  { id: 'adv.', label: '副词' },
  { id: 'prep.', label: '介词' },
  { id: 'conj.', label: '连词' },
  { id: 'pron.', label: '代词' },
  { id: '其他', label: '其他' },
];

/* 根据词性pos文本匹配分类 */
function getPosCategory(pos) {
  if (!pos) return '其他';
  const p = pos.toLowerCase();
  if (p.startsWith('n.') || p.startsWith('n/')) return 'n.';
  if (p.startsWith('vt.') || p.startsWith('vi.') || p.startsWith('v.') || p.startsWith('v/')) return 'vt.';
  if (p.startsWith('adj.') || p.startsWith('adj/')) return 'adj.';
  if (p.startsWith('adv.') || p.startsWith('adv/')) return 'adv.';
  if (p.startsWith('prep.') || p.startsWith('prep/')) return 'prep.';
  if (p.startsWith('conj.') || p.startsWith('conj/')) return 'conj.';
  if (p.startsWith('pron.') || p.startsWith('pron/')) return 'pron.';
  return '其他';
}

/* 获取筛选后的词性分类（合并同类） */
function getPosFilterList() {
  return [
    { id: '全部', label: '全部' },
    { id: 'n.', label: '名词' },
    { id: 'vt.', label: '动词' },
    { id: 'adj.', label: '形容词' },
    { id: 'adv.', label: '副词' },
    { id: 'prep.', label: '介词' },
    { id: 'conj.', label: '连词' },
    { id: 'pron.', label: '代词' },
    { id: '其他', label: '其他' },
  ];
}

function normalizePos(posText, isPhrase) {
  if (isPhrase) return '短语';
  if (!posText) return '待标注';
  return posText.toLowerCase().replace(/，/g, '/').replace(/、/g, '/').replace(/&/g, '/').replace(/\s+/g, ' ')
    .split('/').map(p => p.trim().replace(/\.+$/, '')).filter(Boolean)
    .map(p => { const a = POS_ALIASES[p] || p; return (POS_WORDS.includes(p) || POS_WORDS.includes(a)) ? `${a.endsWith('.') ? a : a + '.'}` : p.endsWith('.') ? p : `${p}.`; })
    .filter((v, i, arr) => arr.indexOf(v) === i).join('/') || '待标注';
}

function collectPosText(text) {
  return [...text.matchAll(POS_GLOBAL_REGEX)].map(m => m[1]).filter(Boolean).join('/');
}

function cleanOcrText(text) {
  return (text || '').replace(/\r/g, '\n')
    .replace(/["""]/g, '"').replace(/['']/g, "'")
    .replace(/[—–]/g, '-').replace(/：/g, ':').replace(/；/g, ';')
    .replace(/，/g, ',').replace(/。/g, '.').replace(/[|｜]/g, ' ')
    .replace(/\u00a0/g, ' ').replace(/[\u200b-\u200f]/g, '')
    .replace(/\n{2,}/g, '\n').trim();
}

// 提取词干（去掉常见词性后缀），用于词族关联
function getStem(word) {
  if (!word || word.length < 3) return word;
  // 注意：不包含 'y' 作为独立后缀，因为 rely→rel 会误匹配 relax
  // 不包含 'ation'/'ition'，因为 'tion' 已能处理，避免 creation→cre 过度剥离
  // y→i 的还原在剥离其他后缀时处理（如 happiness→happi→happy）
  // 'sis' 用于 analysis→analy, 'yze'/'yse' 用于 analyze→anal
  // 新增: 'th'(growth/warmth/width), 'dom'(freedom/wisdom), 'ance/ence'(distance/existence),
  // 'ant/ent'(distant/student), 'ure'(mixture/failure), 'age'(storage/marriage),
  // 'ship'(friendship/relationship), 'hood'(childhood/neighborhood)
  const suffixes = ['fully', 'ation', 'ition', 'tion', 'sion', 'ment', 'ness', 'ity', 'ance', 'ence', 'ant', 'ent', 'ure', 'age', 'ship', 'hood', 'dom', 'th', 'ly', 'ful', 'less', 'ous', 'ive', 'able', 'ible', 'al', 'ic', 'er', 'or', 'ist', 'ize', 'ise', 'en', 'ed', 'ing', 'sis', 'yze', 'yse'];
  let result = word.toLowerCase();
  let prev = '';
  let rounds = 0;
  // 最多剥离3轮后缀（如 typically → typic → typ）
  while (prev !== result && rounds < 3) {
    prev = result;
    for (const s of suffixes) {
      if (result.endsWith(s) && result.length > s.length + 2) {
        let stem = result.slice(0, -s.length);
        // 处理双写辅音：如 stopped → stop
        if (/([bcdfghjklmnpqrstvwxz])\1$/.test(stem)) stem = stem.slice(0, -1);
        // 处理 y → i：如 happiness → happy (stem=happi, 还原为 happy)
        if (stem.endsWith('i') && !/^[aeiou]/.test(result)) {
          const withY = stem.slice(0, -1) + 'y';
          if (withY.length >= 2) { result = withY; break; }
        }
        // 处理 e 还原：如 beautiful → beauty (beauti → beauty)
        if (stem.endsWith('i') && result.endsWith('ful')) {
          const withY = stem.slice(0, -1) + 'y';
          if (withY.length >= 2) { result = withY; break; }
        }
        result = stem;
        break;
      }
    }
    rounds++;
  }
  return result;
}

// 辅音交替对：同一词根在不同词性中常见的辅音变化
const CONSONANT_ALT_PAIRS = new Set(['cs', 'fv', 'sz', 'bp', 'dt']);

// 检查两个词干是否仅因辅音交替而不同（如 advise/advice, believe/belief, describe/description）
function isConsonantAltMatch(a, b) {
  if (!a || !b || a.length < 6 || b.length < 6 || a.length !== b.length || a === b) return false;
  const prefix = commonPrefixLen(a, b);
  if (prefix < 5) return false;
  let diffs = 0;
  for (let i = prefix; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const pair = [a[i], b[i]].sort().join('');
    if (CONSONANT_ALT_PAIRS.has(pair)) diffs++;
    else return false;
  }
  return diffs === 1;
}

// 判断字符是否为元音（含y，用于派生词匹配）
function isVowelLike(ch) {
  return 'aeiouy'.includes(ch);
}

// 检查两个词干是否仅因元音变化或元音+辅音交替而不同
// 如 choose/choice (oo→oi + s↔c), strong/strength (o→e)
function isDerivationMatch(a, b) {
  if (!a || !b || a.length < 5 || b.length < 5 || a.length !== b.length || a === b) return false;
  const prefix = commonPrefixLen(a, b);
  if (prefix < 5) return false;
  let vowelDiffs = 0;
  let consonantAltDiffs = 0;
  for (let i = prefix; i < a.length; i++) {
    if (a[i] === b[i]) continue;
    const aVowel = isVowelLike(a[i]);
    const bVowel = isVowelLike(b[i]);
    if (aVowel && bVowel) {
      vowelDiffs++;
    } else {
      const pair = [a[i], b[i]].sort().join('');
      if (CONSONANT_ALT_PAIRS.has(pair)) consonantAltDiffs++;
      else return false;
    }
  }
  return (vowelDiffs + consonantAltDiffs) <= 2 && vowelDiffs <= 1;
}

// 检查两个词干是否仅因减少一个元音而不同
// 如 deep/dep (ee→e), study/stud (y脱落)
function isVowelReductionMatch(a, b) {
  if (!a || !b) return false;
  const longer = a.length >= b.length ? a : b;
  const shorter = a.length >= b.length ? b : a;
  if (longer.length !== shorter.length + 1) return false;
  if (shorter.length < 3) return false;
  const prefix = commonPrefixLen(longer, shorter);
  if (prefix < 3) return false;
  // 多出的字符必须是元音
  if (!isVowelLike(longer[prefix])) return false;
  // 其余部分必须完全匹配
  for (let i = prefix; i < shorter.length; i++) {
    if (longer[i + 1] !== shorter[i]) return false;
  }
  return true;
}

// 假同源词黑名单：拼写相似但词源完全无关的词对
// 这些词对不应被算法匹配为词族（同源词）
// 数据来源：Etymonline 在线词源词典交叉验证
// 涵盖：minority/mine, advance/adventure, career/care, star/start 等常见误匹配
const FALSE_ETYMOLOGY_PAIRS = {
  accuse: ['accustomed'],
  accustomed: ['accuse'],
  advance: ['adventure', 'advise'],
  advantage: ['adventure', 'advise'],
  advantageous: ['adventure', 'advise'],
  adventure: ['advance', 'advantage', 'advantageous', 'advise'],
  advise: ['advance', 'adventure', 'advantage', 'advantageous'],
  alone: ['along'],
  along: ['alone'],
  appeal: ['apple', 'apply', 'applicant', 'application', 'appliance'],
  apple: ['apply', 'applicant', 'application', 'appliance', 'applied'],
  appliance: ['apple'],
  applicant: ['apple'],
  application: ['apple'],
  apply: ['apple'],
  are: ['area'],
  area: ['are'],
  attention: ['attic'],
  attentive: ['attic'],
  attic: ['attention', 'attentive'],
  attire: ['tire'],
  authentic: ['author', 'authority'],
  author: ['authentic'],
  authority: ['authentic'],
  award: ['aware'],
  aware: ['award'],
  ball: ['ballet'],
  ballet: ['ball'],
  bar: ['bare', 'barely'],
  bare: ['bar'],
  barely: ['bar'],
  bear: ['beard'],
  beard: ['bear'],
  bell: ['belly'],
  belly: ['bell'],
  bill: ['billion', 'billionaire'],
  billion: ['bill'],
  billionaire: ['bill'],
  both: ['bother'],
  bother: ['both'],
  bread: ['breath', 'breathless', 'breathe'],
  break: ['breath', 'breathless', 'breathe', 'breed', 'breeding'],
  breast: ['breath', 'breathless', 'breathe', 'breed', 'breeding'],
  breath: ['bread', 'breast', 'breed', 'breeding', 'break'],
  breathe: ['bread', 'breast', 'break'],
  breathless: ['bread', 'breast', 'break'],
  breed: ['breath', 'breathless', 'breathe', 'bread', 'breast'],
  breeding: ['breath', 'breathless', 'breathe', 'bread', 'breast'],
  career: ['care', 'careful', 'careless', 'caring'],
  combine: ['component'],
  comical: ['comment'],
  comment: ['comical'],
  component: ['combine'],
  condition: ['content', 'contentment'],
  conduct: ['contact'],
  conductor: ['contact'],
  conference: ['conventional'],
  contact: ['conduct'],
  content: ['condition'],
  contentment: ['condition'],
  conventional: ['conference'],
  count: ['country', 'county'],
  country: ['count'],
  countryside: ['count'],
  county: ['count'],
  decade: ['decide', 'decision'],
  decent: ['decide', 'decision', 'decoration'],
  decide: ['decade', 'decent', 'decoration'],
  decision: ['decade', 'decent', 'decoration'],
  decoration: ['decent', 'decide', 'decision'],
  empathic: ['emperor'],
  emperor: ['empathic'],
  entire: ['entrance'],
  entrance: ['entire'],
  expert: ['export'],
  export: ['expert'],
  family: ['famous'],
  famous: ['family'],
  female: ['male'],
  former: ['formal', 'format', 'formation'],
  garage: ['garment'],
  garment: ['garage'],
  gradual: ['grateful', 'gratitude'],
  gradually: ['grateful', 'gratitude'],
  graduation: ['grateful', 'gratitude'],
  grateful: ['gradual', 'gradually', 'graduation'],
  gratitude: ['gradual', 'gradually', 'graduation'],
  greatly: ['greeting', 'greet'],
  greet: ['greatly', 'great'],
  greeting: ['greatly'],
  illness: ['illusion'],
  illusion: ['illness'],
  insist: ['insure', 'insurance'],
  insurance: ['insist'],
  insure: ['insist'],
  island: ['isle'],
  isle: ['island'],
  male: ['female'],
  mine: ['minority', 'minor', 'mineral'],
  mineral: ['minority', 'minor', 'mine', 'minister'],
  minister: ['mineral'],
  minor: ['mine', 'mineral'],
  minority: ['mine', 'mineral'],
  muscle: ['mollusk', 'mollusc'],
  off: ['offence', 'officer', 'offer'],
  offence: ['officer', 'offer', 'off'],
  offer: ['offence', 'officer', 'off'],
  officer: ['offence', 'offer', 'off'],
  patent: ['patience', 'patient'],
  patience: ['patent'],
  patient: ['patent'],
  positive: ['postage', 'poster'],
  postage: ['positive'],
  poster: ['positive'],
  praise: ['prayer'],
  prayer: ['praise'],
  precise: ['presence', 'present', 'presentation'],
  prefer: ['prevent'],
  preference: ['prevent'],
  presence: ['precise'],
  present: ['precise'],
  presentation: ['precise'],
  prevent: ['prefer', 'preference'],
  probable: ['proper', 'properly'],
  probably: ['proper', 'properly'],
  product: ['protect'],
  production: ['protect', 'protection'],
  productive: ['protect', 'protection'],
  profit: ['provide', 'provided', 'providing'],
  proper: ['probable', 'probably'],
  properly: ['probable', 'probably'],
  protect: ['product', 'production', 'productive'],
  protection: ['product', 'production', 'productive'],
  provide: ['profit'],
  provided: ['profit'],
  providing: ['profit'],
  relation: ['reliable'],
  relationship: ['reliable'],
  reliable: ['relation', 'relationship'],
  restore: ['store'],
  reveal: ['revise', 'revision'],
  revise: ['reveal'],
  revision: ['reveal'],
  section: ['secure'],
  secure: ['section'],
  senior: ['sense', 'sensation'],
  silence: ['silhouette'],
  silhouette: ['silence'],
  similar: ['simplify', 'simple'],
  simplify: ['similar'],
  star: ['start', 'stare', 'starve', 'starvation'],
  stare: ['star', 'start', 'starve', 'starvation'],
  start: ['star', 'stare', 'starve', 'starvation'],
  starvation: ['star', 'start', 'stare'],
  starve: ['star', 'start', 'stare'],
  store: ['restore'],
  strange: ['strong', 'strength', 'strengthen', 'strongly'],
  stranger: ['strong', 'strength', 'strengthen', 'strongly'],
  strength: ['strange', 'stranger'],
  strengthen: ['strange', 'stranger'],
  strong: ['strange', 'stranger'],
  strongly: ['strange', 'stranger'],
  tire: ['attire'],
};

// 检查两个词是否在假同源词黑名单中
function isFalseEtymology(word1, word2) {
  const w1 = word1.toLowerCase().trim();
  const w2 = word2.toLowerCase().trim();
  const blocked = FALSE_ETYMOLOGY_PAIRS[w1];
  return blocked ? blocked.includes(w2) : false;
}

// v2.43.0 全面审计补充：对全词库1341组关联对逐一人工复核，
// 以下词对拼写相近但词源/词义无关，一律屏蔽（自动双向对称，杜绝方向遗漏）
const EXTRA_FALSE_PAIRS = [
  ['accessible', 'accuse'],
  ['act', 'actual'], ['active', 'actual'], ['actor', 'actual'],
  ['bride', 'bridge'], ['bus', 'business'], ['bus', 'busy'],
  ['candidate', 'candle'], ['cancel', 'cancer'],
  ['candy', 'canteen'], ['car', 'care'], ['car', 'career'], ['car', 'careful'], ['car', 'careless'],
  ['case', 'casual'], ['chaos', 'chase'],
  ['classic', 'clause'], ['classical', 'clause'],
  ['combination', 'component'], ['come', 'comment'],
  ['compete', 'computer'], ['competence', 'computer'], ['competition', 'computer'],
  ['conductor', 'contact'],
  ['conference', 'confuse'], ['conference', 'confident'], ['confident', 'confuse'],
  ['consist', 'consume'], ['consistent', 'consume'],
  ['contain', 'continent'], ['container', 'continent'],
  ['cope', 'copy'], ['cut', 'cute'],
  ['data', 'date'], ['debate', 'debt'],
  ['distance', 'distinction'], ['dive', 'division'], ['diverse', 'divorce'],
  ['explode', 'explorer'],
  ['far', 'fare'], ['fifteen', 'fifty'], ['float', 'flood'], ['food', 'foot'],
  ['grade', 'grateful'], ['grape', 'graph'], ['great', 'greet'], ['great', 'greeting'], ['green', 'grey'],
  ['hat', 'hate'], ['head', 'heat'], ['head', 'heating'],
  ['her', 'here'], ['her', 'hero'], ['here', 'hero'], ['hole', 'holy'], ['hug', 'huge'],
  ['intention', 'into'],
  ['june', 'junior'], ['ladder', 'lady'], ['lamb', 'lamp'], ['leaf', 'leave'],
  ['man', 'many'], ['manage', 'many'], ['manner', 'many'],
  ['mend', 'mental'], ['mention', 'menu'], ['mine', 'minister'],
  ['month', 'monument'], ['moral', 'more'],
  ['not', 'note'], ['plane', 'plant'], ['planet', 'plant'],
  ['polite', 'politics'], ['positive', 'post'], ['praise', 'pray'],
  ['precise', 'pressure'], ['produce', 'protection'], ['promise', 'promote'],
  ['prove', 'provided'], ['prove', 'providing'],
  ['queen', 'queue'], ['quiet', 'quit'], ['quiet', 'quite'],
  ['rat', 'rate'], ['relation', 'rely'], ['relationship', 'rely'],
  ['restore', 'restriction'], ['reveal', 'revenue'], ['rid', 'ride'],
  ['scare', 'scarf'], ['send', 'sentence'],
  ['share', 'shark'], ['share', 'sharp'], ['share', 'sharpen'],
  ['shoot', 'shout'], ['shore', 'short'], ['shore', 'shortly'], ['shore', 'shorts'], ['shot', 'shout'],
  ['sit', 'situation'], ['soccer', 'social'], ['soccer', 'socialist'],
  ['stair', 'star'], ['stair', 'stare'], ['station', 'stay'], ['steep', 'step'],
  ['store', 'storm'], ['store', 'story'], ['strict', 'structure'],
  ['sweat', 'sweet'], ['sweater', 'sweet'],
  ['tap', 'tape'], ['tax', 'taxi'],
  ['peace', 'peasant'],
  ['the', 'they'], ['their', 'there'],
  ['thread', 'threat'], ['thread', 'threaten'], ['thread', 'throat'],
  ['threat', 'throat'], ['threaten', 'throat'],
  ['tin', 'tiny'], ['ton', 'tone'], ['under', 'undo'], ['version', 'very'],
  ['wag', 'wage'], ['wander', 'want'], ['win', 'wine'], ['wind', 'winter'], ['wine', 'winner'],
  // 前缀规则误报（长得像前缀但词源无关）
  ['free', 'freeze'], ['sand', 'sandwich'], ['word', 'world'],
  ['war', 'warm'], ['war', 'ward'], ['war', 'warn'],
  ['pain', 'paint'], ['bull', 'bullet'], ['rest', 'restaurant'], ['iron', 'irony'], ['sand', 'sandal'],
  // v2.44.0 新增：算法收紧后仍可能误匹配的词对
  ['district', 'distract'], ['district', 'distracted'], ['district', 'distraction'],
  ['distract', 'district'], ['distracted', 'district'], ['distraction', 'district'],
  ['indeed', 'index'], ['indeed', 'indication'], ['indeed', 'indoor'], ['indeed', 'indoors'],
  ['index', 'indeed'], ['indication', 'indeed'], ['indoor', 'indeed'], ['indoors', 'indeed'],
  ['shore', 'shortage'], ['shore', 'shorten'], ['shore', 'shortly'],
  ['shortage', 'shore'], ['shorten', 'shore'],
  ['star', 'stare'], ['stare', 'star'],
  ['tone', 'atone'], ['atone', 'tone'],
  ['race', 'races'], ['races', 'race'],
  ['rest', 'restaurant'], ['restaurant', 'rest'],
  ['mine', 'miner'], ['miner', 'mine'],
  ['fine', 'finer'], ['finer', 'fine'],
  ['line', 'linear'], ['linear', 'line'],
  ['care', 'career'], ['career', 'care'],
  ['share', 'sharp'], ['share', 'sharpen'], ['share', 'shark'],
  ['sharp', 'share'], ['sharpen', 'share'], ['shark', 'share'],
  ['more', 'morning'], ['morning', 'more'],
  ['form', 'former'], ['former', 'form'],
  ['part', 'party'], ['party', 'part'],
  ['art', 'article'], ['article', 'art'],
  ['band', 'bandage'], ['bandage', 'band'],
  ['port', 'porter'], ['porter', 'port'],
  ['sort', 'sortie'], ['sortie', 'sort'],
  ['force', 'forceful'], ['forceful', 'force'],
  ['charge', 'charger'], ['charger', 'charge'],
  ['stage', 'stagger'], ['stagger', 'stage'],
  ['rage', 'ragged'], ['ragged', 'rage'],
  ['cage', 'caged'], ['caged', 'cage'],
  ['page', 'pager'], ['pager', 'page'],
  ['age', 'agency'], ['agency', 'age'],
  ['ice', 'icon'], ['icon', 'ice'],
  ['rice', 'price'], ['price', 'rice'],
  ['mice', 'mild'], ['mild', 'mice'],
  ['nice', 'niche'], ['niche', 'nice'],
  ['vice', 'device'], ['device', 'vice'],
  ['face', 'surface'], ['surface', 'face'],
  ['lace', 'palace'], ['palace', 'lace'],
];
for (const [a, b] of EXTRA_FALSE_PAIRS) {
  if (!FALSE_ETYMOLOGY_PAIRS[a]) FALSE_ETYMOLOGY_PAIRS[a] = [];
  if (!FALSE_ETYMOLOGY_PAIRS[a].includes(b)) FALSE_ETYMOLOGY_PAIRS[a].push(b);
  if (!FALSE_ETYMOLOGY_PAIRS[b]) FALSE_ETYMOLOGY_PAIRS[b] = [];
  if (!FALSE_ETYMOLOGY_PAIRS[b].includes(a)) FALSE_ETYMOLOGY_PAIRS[b].push(a);
}
// v2.43.0 基础黑名单对称化：历史表有30组只写了单方向，
// isFalseEtymology 只查 w1→w2 方向，漏配方向会导致假关联漏网
{
  const allKeys = Object.keys(FALSE_ETYMOLOGY_PAIRS);
  for (const a of allKeys) {
    for (const b of [...FALSE_ETYMOLOGY_PAIRS[a]]) {
      if (!FALSE_ETYMOLOGY_PAIRS[b]) FALSE_ETYMOLOGY_PAIRS[b] = [];
      if (!FALSE_ETYMOLOGY_PAIRS[b].includes(a)) FALSE_ETYMOLOGY_PAIRS[b].push(a);
    }
  }
}

// 隐藏同源词映射：词源相同但拼写差异大，算法难以自动检测的词对
// 数据来源：Etymonline 在线词源词典交叉验证
// 涵盖：muscle/mouse, salary/salt, hospital/hotel 等隐藏同源词
const HIDDEN_COGNATES = {
  account: ['count', 'computer', 'counter'],
  accurate: ['curious', 'cure'],
  anniversary: ['annual', 'perennial'],
  annual: ['perennial', 'anniversary'],
  asterisk: ['disaster', 'asteroid'],
  asteroid: ['disaster', 'asterisk', 'astronomy'],
  astronomy: ['disaster', 'asteroid', 'star'],
  aware: ['ware', 'warn', 'wary'],
  betray: ['tradition', 'treason'],
  candid: ['candle', 'candidate'],
  candidate: ['candid', 'candle'],
  candle: ['candid', 'candidate'],
  catch: ['chase'],
  chase: ['catch'],
  chef: ['chief'],
  chief: ['chef'],
  company: ['pantry'],
  computer: ['count', 'account', 'counter'],
  costume: ['custom'],
  count: ['account', 'computer', 'counter'],
  counter: ['count', 'account', 'computer'],
  courage: ['encourage', 'courageous', 'discourage'],
  courageous: ['courage', 'encourage', 'discourage'],
  cure: ['curious', 'accurate'],
  curious: ['cure', 'accurate'],
  custom: ['costume'],
  dainty: ['dignity'],
  dignity: ['dainty'],
  disaster: ['asteroid', 'asterisk', 'astronomy', 'star'],
  discourage: ['courage', 'encourage', 'courageous'],
  encourage: ['courage', 'courageous', 'discourage'],
  ensure: ['sure', 'secure', 'insure', 'insurance'],
  fancy: ['fantasy'],
  fantasy: ['fancy'],
  flour: ['flower'],
  flower: ['flour'],
  glamour: ['grammar'],
  grammar: ['glamour'],
  guarantee: ['guard', 'ward', 'warranty', 'reward'],
  guard: ['ward', 'warranty', 'guarantee', 'reward'],
  history: ['story'],
  hospital: ['hotel', 'host', 'hostess', 'hostile'],
  host: ['hospital', 'hotel', 'hostess', 'hostile'],
  hostess: ['hospital', 'hotel', 'host', 'hostile'],
  hostile: ['hospital', 'hotel', 'host', 'hostess'],
  hotel: ['hospital', 'host', 'hostess', 'hostile'],
  human: ['humble', 'humbleness'],
  humble: ['human'],
  humbleness: ['human'],
  inch: ['ounce'],
  insurance: ['sure', 'secure', 'insure', 'ensure'],
  insure: ['sure', 'secure', 'ensure', 'insurance'],
  major: ['mayor'],
  maneuver: ['manure'],
  manure: ['maneuver'],
  mayor: ['major'],
  merchant: ['mercy'],
  mercy: ['merchant'],
  mouse: ['muscle'],
  muscle: ['mouse'],
  naive: ['native'],
  native: ['naive', 'nature'],
  nature: ['native'],
  naval: ['navigate', 'nausea'],
  navigate: ['nausea', 'naval'],
  ounce: ['inch'],
  pantry: ['company'],
  passion: ['passive', 'patience', 'patient'],
  passive: ['passion', 'patience', 'patient'],
  patience: ['passion', 'passive', 'patient'],
  patient: ['passion', 'passive', 'patience'],
  perennial: ['annual', 'anniversary'],
  phenomenon: ['fantasy', 'fancy'],
  reward: ['guard', 'ward', 'warranty', 'guarantee'],
  salad: ['salary', 'salt', 'sauce', 'sausage'],
  salary: ['salt', 'salty', 'salad', 'sauce', 'sausage'],
  salt: ['salary', 'salad', 'sauce', 'sausage'],
  salty: ['salary'],
  sarcasm: ['sarcophagus'],
  sauce: ['salary', 'salt', 'salad', 'sausage'],
  sausage: ['salary', 'salt', 'salad', 'sauce'],
  secure: ['sure', 'insure', 'ensure', 'insurance'],
  security: ['sure', 'secure'],
  seminar: ['semen', 'seed'],
  shirt: ['skirt'],
  skirt: ['shirt'],
  species: ['spice'],
  spice: ['species'],
  star: ['astronomy', 'disaster', 'asteroid'],
  story: ['history'],
  sure: ['secure', 'insure', 'ensure', 'insurance', 'security'],
  tradition: ['treason', 'betray'],
  treason: ['tradition', 'betray'],
  valid: ['valedictorian', 'valor'],
  valor: ['valid'],
  ward: ['guard', 'warranty', 'guarantee', 'reward'],
  ware: ['aware', 'warn', 'wary'],
  warn: ['aware', 'ware'],
  warranty: ['guard', 'ward', 'reward', 'guarantee'],
  wary: ['aware', 'ware'],
  // 补充：被前缀长度比例过滤掉的真实同源词
  type: ['typewriter', 'typist', 'typical'],
  typewriter: ['type'],
  typist: ['type', 'typical'],
  typical: ['type', 'typist'],
  art: ['article', 'artist', 'artistic'],
  article: ['art', 'artist', 'artistic'],
  artist: ['art', 'article', 'artistic'],
  artistic: ['art', 'article', 'artist'],
  part: ['particle', 'partial', 'partly', 'partner'],
  particle: ['part', 'partial'],
  partial: ['part', 'particle'],
  port: ['portion', 'portfolio', 'portable'],
  portion: ['port', 'portable'],
  portable: ['port', 'portion'],
  rest: ['restaurant', 'restful', 'restless'],
  act: ['action', 'active', 'activity', 'actor', 'react'],
  scene: ['scenery', 'scenic'],
  scenery: ['scene', 'scenic'],
  scenic: ['scene', 'scenery'],
};

// 获取隐藏同源词列表
function getHiddenCognates(word) {
  const w = word.toLowerCase().trim();
  return HIDDEN_COGNATES[w] || [];
}

// 查找词族：与给定单词同一词根的不同形式
// 核心原则：只有真正的词根变形才算关联，单纯长得像不算
// v2.44.0 添加结果缓存，避免低端设备重复计算
const _wordFamilyCache = new Map();
function findWordFamily(term, items) {
  const cacheKey = term.toLowerCase().trim() + '|' + items.length;
  if (_wordFamilyCache.has(cacheKey)) return _wordFamilyCache.get(cacheKey);
  const seen = new Set([term]);
  const related = [];
  const termStem = getStem(term);
  const termLower = term.toLowerCase();
  // 去尾E后的词干（用于匹配 type → typist, nature → natural 等）
  const termNoE = (termLower.endsWith('e') && termLower.length >= 4) ? termLower.slice(0, -1) : null;

  for (const item of items) {
    if (termKey(item.term) === termKey(term) || seen.has(termKey(item.term))) continue;
    const itemLower = item.term.toLowerCase();
    const otherStem = getStem(item.term);
    const otherNoE = (itemLower.endsWith('e') && itemLower.length >= 4) ? itemLower.slice(0, -1) : null;

    // === 匹配规则（从严到宽）===

    // 规则1：直接前缀匹配（至少4字符，且短词≥长词50%，避免 rest→restaurant 等拼写巧合误匹配）
    // 如 success → successful, care → careful；排除 rest→restaurant、port→portion 等假同源
    const _prefixShorter = termLower.length <= itemLower.length ? termLower : itemLower;
    const _prefixLonger = termLower.length <= itemLower.length ? itemLower : termLower;
    const prefixMatch =
      ((termLower.length >= 4 && itemLower.startsWith(termLower)) ||
       (itemLower.length >= 4 && termLower.startsWith(itemLower))) &&
      _prefixShorter.length / _prefixLonger.length >= 0.5;

    // 规则2：词干完全匹配（最可靠）
    // 如 successful 和 successfully 都还原为 success
    // 如 typist 和 typical 都还原为 type (via E-drop + suffix strip)
    const stemExactMatch =
      otherStem === termLower || otherStem === termStem ||
      termStem === itemLower || termStem === otherStem;

    // 规则3：词干前缀匹配（至少5字符重叠，且短词干≥长词干60%）
    // v2.44.0 收紧：4字符→5字符，避免 indeed→index, shore→short 等误匹配
    // 如 create(词干create,6) → creative(词干creat,5)：满足，5/6=83%>60%
    const shorter = termStem.length <= otherStem.length ? termStem : otherStem;
    const longer = termStem.length <= otherStem.length ? otherStem : termStem;
    const stemPrefixMatch =
      shorter.length >= 5 && longer.startsWith(shorter) &&
      shorter.length / longer.length >= 0.6;

    // 规则4：去尾E匹配（去E后至少5字符）
    // v2.44.0 收紧：4字符→5字符，避免 shore→shor(4) 误匹配 short/shortage/shorten
    // 如 nature → natural：去E得 "natur"(5)，匹配词干 "natur"
    // 如 create → creative：去E得 "creat"(5)，匹配词干 "creat"
    const eDropMatch =
      (termNoE && termNoE.length >= 5 &&
       (otherStem === termNoE ||
        (otherStem.length >= 5 && (otherStem.startsWith(termNoE) || termNoE.startsWith(otherStem)) &&
         Math.min(termNoE.length, otherStem.length) / Math.max(termNoE.length, otherStem.length) >= 0.6))) ||
      (otherNoE && otherNoE.length >= 5 &&
       (termStem === otherNoE ||
        (termStem.length >= 5 && (termStem.startsWith(otherNoE) || otherNoE.startsWith(termStem)) &&
         Math.min(termStem.length, otherNoE.length) / Math.max(termStem.length, otherNoE.length) >= 0.6)));

    // type → typist 特殊处理：type去E得"typ"(3字符)，typist去后缀得"typ"(3字符)
    // 这两个3字符词干相等，是真实词根关系
    const shortStemEqual =
      termNoE && otherStem === termNoE && termNoE.length >= 3 ||
      otherNoE && termStem === otherNoE && otherNoE.length >= 3;

    // 规则5：辅音交替匹配（同一词根的辅音变化）
    // 如 advise/advice (s↔c), believe/belief (v↔f), describe/description (b↔p), extend/extent (d↔t)
    const consonantAltMatch =
      isConsonantAltMatch(termStem, otherStem) ||
      (termNoE && isConsonantAltMatch(termNoE, otherStem)) ||
      (otherNoE && isConsonantAltMatch(termStem, otherNoE)) ||
      (termNoE && otherNoE && isConsonantAltMatch(termNoE, otherNoE));

    // 规则6：元音变化+辅音交替混合匹配
    // 如 choose/choice (oo→oi + s↔c), strong/strength (o→e), marry/marriage (y→i)
    const derivationMatch =
      isDerivationMatch(termStem, otherStem) ||
      (termNoE && isDerivationMatch(termNoE, otherStem)) ||
      (otherNoE && isDerivationMatch(termStem, otherNoE)) ||
      (termNoE && otherNoE && isDerivationMatch(termNoE, otherNoE));

    // 规则7：元音增减匹配（同一词根的元音脱落或增加）
    // 如 deep/dep(th), study/stud(ent), party/part
    const vowelReductionMatch =
      isVowelReductionMatch(termStem, otherStem) ||
      (termNoE && isVowelReductionMatch(termNoE, otherStem)) ||
      (otherNoE && isVowelReductionMatch(termStem, otherNoE)) ||
      (termNoE && otherNoE && isVowelReductionMatch(termNoE, otherNoE));

    const isRelated = (prefixMatch || stemExactMatch || stemPrefixMatch || eDropMatch || shortStemEqual || consonantAltMatch || derivationMatch || vowelReductionMatch)
      && !isFalseEtymology(term, item.term);

    if (isRelated) {
      related.push(item);
      seen.add(item.term);
    }
  }

  // 补充：从隐藏同源词映射中查找（算法难以自动检测的同源词）
  const hiddenCognates = getHiddenCognates(term);
  for (const cognate of hiddenCognates) {
    if (seen.has(cognate)) continue;
    const item = items.find(i => i.term.toLowerCase() === cognate.toLowerCase());
    if (item) {
      related.push(item);
      seen.add(item.term);
    }
  }

  // 补充：人工校对词族表（v2.43.0）。词库里有则用真实条目；
  // 没有则生成带词性+中文的拓展条目，保证「不在词库内的关联词」也能显示词性和中文释义
  const supplements = getSupplementFamily(term);
  for (const sup of supplements) {
    const key = sup.term.toLowerCase();
    if (key === term.toLowerCase() || seen.has(key)) continue;
    const real = items.find(i => i.term.toLowerCase() === key);
    if (real) {
      related.push(real);
      seen.add(real.term);
      continue;
    }
    if (!sup.meaning) continue; // 反向映射条目无释义且词库无此词时跳过
    related.push({
      id: `supp-${key}`,
      type: 'word',
      term: sup.term,
      pos: sup.pos || (masterVocabLookup[key] ? masterVocabLookup[key].pos : ''),
      meaning: sup.meaning,
      frequency: '拓展',
      corePoints: [],
      allPoints: [],
      examples: [],
      phonetic: '',
      notes: '',
      source: '高考总汇词库',
    });
    seen.add(key);
  }

  // 按词性分组排序
  const posOrder = { 'n.': 1, 'v.': 2, 'adj.': 3, 'adv.': 4 };
  related.sort((a, b) => {
    const oa = posOrder[a.pos] || 99;
    const ob = posOrder[b.pos] || 99;
    if (oa !== ob) return oa - ob;
    return a.term.localeCompare(b.term);
  });

  const _result = related.slice(0, 15); // 最多显示15个关联词
  _wordFamilyCache.set(cacheKey, _result);
  return _result;
}

/* ============================
   联网关联词检查：导入新单词时自动联网检查词族关系
   ============================ */

const WORD_FAMILY_CACHE_KEY = 'gaokao_word_family_cache';

// 加载本地缓存的AI关联词数据
function loadWordFamilyCache() {
  try { return JSON.parse(localStorage.getItem(WORD_FAMILY_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

// 保存AI关联词数据到本地
function saveWordFamilyCache(cache) {
  try { localStorage.setItem(WORD_FAMILY_CACHE_KEY, JSON.stringify(cache)); }
  catch {}
}

// 获取某个单词的AI缓存关联词
function getCachedFamily(word) {
  const cache = loadWordFamilyCache();
  return cache[word.toLowerCase()] || [];
}

// === 易混词AI缓存 ===
const CONFUSING_CACHE_KEY = 'gaokao_confusing_cache';

function loadConfusingCache() {
  try { return JSON.parse(localStorage.getItem(CONFUSING_CACHE_KEY) || '{}'); }
  catch { return {}; }
}

function saveConfusingCache(cache) {
  try { localStorage.setItem(CONFUSING_CACHE_KEY, JSON.stringify(cache)); }
  catch {}
}

function getCachedConfusing(word) {
  const cache = loadConfusingCache();
  return cache[word.toLowerCase()] || [];
}

// 使用AI大模型检查词族关系和易混词
async function checkWordFamilyWithAI(word, candidateWords, aiConfig) {
  if (!aiConfig.endpoint || !aiConfig.model || !aiConfig.apiKey) return null;
  if (!candidateWords.length) return { related: [], confusing: [] };

  const prompt = `你是英语词汇学专家。请分析单词"${word}"与以下词库中单词的关系。

词库候选词（最多30个）：${candidateWords.slice(0, 30).join(', ')}

请分别找出两类词：

1. 同源词（词根变形）：同一个词根的不同形式变化
   - 词性变化：success(n.) → successful(adj.) → successfully(adv.) → succeed(v.)
   - 派生变化：create(v.) → creation(n.) → creative(adj.) → creativity(n.)
   注意：仅仅拼写相似但词源不同的不算同源词（如 rely 和 relax 无关）

2. 易混词：拼写相似但含义完全不同的词
   - 如 affect(影响) vs effect(效果)
   - 如 adapt(适应) vs adopt(收养)
   - 如 accept(接受) vs except(除了)

只返回JSON格式：
{"related": ["同源词1", "同源词2"], "confusing": ["易混词1", "易混词2"]}
没有则返回空数组：{"related": [], "confusing": []}`;

  const resp = await fetch(aiConfig.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiConfig.apiKey}` },
    body: JSON.stringify({
      model: aiConfig.model,
      temperature: 0.1,
      messages: [
        { role: 'system', content: '只返回JSON，不要其他文字' },
        { role: 'user', content: prompt }
      ]
    })
  });
  if (!resp.ok) throw new Error(`AI请求失败：${resp.status}`);
  const data = await resp.json();
  const json = extractJsonObject(data.choices?.[0]?.message?.content || '');
  return { related: json.related || [], confusing: json.confusing || [] };
}

// 使用免费词典API补充词族信息（不需要API Key）
// 通过获取单词的词源和定义，辅助判断词族关系
async function checkWordFamilyWithDictApi(word) {
  try {
    const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word.toLowerCase())}`);
    if (!resp.ok) return null;
    const data = await resp.json();
    if (!Array.isArray(data) || !data.length) return null;
    const entry = data[0];
    // 提取词源信息（如果有）
    const origin = entry.origin || '';
    // 提取所有词性
    const meanings = entry.meanings || [];
    const posList = meanings.map(m => m.partOfSpeech).join(', ');
    // 提取定义
    const definitions = meanings.flatMap(m => (m.definitions || []).slice(0, 2).map(d => d.definition));
    return { origin, posList, definitions, word: entry.word };
  } catch { return null; }
}

// 批量联网检查词族关系
// newItems: 新导入的单词列表
// allItems: 词库中所有单词
// aiConfig: AI配置
// onProgress: 进度回调 (current, total, word, found)
async function autoTagWordFamily(newItems, allItems, aiConfig, onProgress) {
  const cache = loadWordFamilyCache();
  const confusingCache = loadConfusingCache();
  const hasAi = aiConfig.endpoint && aiConfig.model && aiConfig.apiKey;
  let totalChecked = 0;
  let totalFound = 0;
  let totalConfusing = 0;
  const total = newItems.length;

  for (const item of newItems) {
    const word = item.term.toLowerCase().trim();
    if (!word || word.length < 2) { totalChecked++; continue; }

    // 如果已有缓存，跳过
    if (cache[word]) { totalChecked++; continue; }

    // 获取候选词：词库中所有其他单词（排除自身）
    const candidates = allItems
      .filter(i => i.term.toLowerCase() !== word)
      .map(i => i.term.toLowerCase())
      .filter((v, idx, arr) => arr.indexOf(v) === idx) // 去重
      .slice(0, 100); // 限制候选词数量

    let aiRelated = [];
    let aiConfusing = [];

    if (hasAi) {
      // 使用AI检查词族和易混词
      try {
        const aiResult = await checkWordFamilyWithAI(word, candidates, aiConfig);
        // 只保留词库中存在的词
        aiRelated = (aiResult.related || [])
          .map(w => w.toLowerCase().trim())
          .filter(w => candidates.includes(w));
        aiConfusing = (aiResult.confusing || [])
          .map(w => w.toLowerCase().trim())
          .filter(w => candidates.includes(w));
      } catch (e) {
        // AI失败，使用本地算法
        aiRelated = findWordFamily(item.term, allItems).map(i => i.term.toLowerCase());
      }
    } else {
      // 没有AI配置，使用本地算法 + 词典API补充
      const localFamily = findWordFamily(item.term, allItems).map(i => i.term.toLowerCase());
      aiRelated = localFamily;
      // 本地易混词检查
      aiConfusing = findConfusingWords(item.term, allItems).map(i => i.term.toLowerCase());

      // 尝试用词典API获取额外信息（不阻塞，仅补充）
      try {
        const dictInfo = await checkWordFamilyWithDictApi(word);
        if (dictInfo && dictInfo.origin) {
          // 如果有词源信息，尝试从词源中提取可能的词根
          // 这部分仅作为补充，不覆盖本地算法结果
        }
      } catch {}
    }

    if (aiRelated.length > 0) {
      cache[word] = aiRelated;
      totalFound++;
    } else {
      // 标记为已检查（空数组），避免重复检查
      cache[word] = [];
    }

    // 存储易混词缓存
    if (aiConfusing.length > 0) {
      confusingCache[word] = aiConfusing;
      totalConfusing++;
    } else {
      confusingCache[word] = [];
    }

    totalChecked++;
    if (onProgress) onProgress(totalChecked, total, word, aiRelated.length + aiConfusing.length);
  }

  saveWordFamilyCache(cache);
  saveConfusingCache(confusingCache);
  return { totalChecked, totalFound, totalConfusing, cache };
}


// 编辑距离（Levenshtein distance）
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

// 共同前缀长度
function commonPrefixLen(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// 查找易混词：返回与给定单词拼写相似但含义不同的词
// v2.44.0 添加结果缓存，避免低端设备重复计算
const _confusingCache = new Map();
function findConfusingWords(term, items) {
  const cacheKey = term.toLowerCase().trim() + '|' + items.length;
  if (_confusingCache.has(cacheKey)) return _confusingCache.get(cacheKey);
  const key = term.toLowerCase().trim();
  const result = [];
  const seen = new Set();
  // 0. 排除词族成员（词族归"关联词族"显示，不归"易混词"）
  const familyTerms = new Set(findWordFamily(term, items).map(i => i.term.toLowerCase()));
  // 1. 从静态易混词数据中查找
  const entry = confusingWordsData.find(e => e.word === key);
  if (entry) {
    entry.confuses.forEach(w => {
      const item = items.find(i => i.term.toLowerCase() === w.toLowerCase());
      if (item && !seen.has(item.term.toLowerCase())) {
        result.push(item);
        seen.add(item.term.toLowerCase());
      }
    });
  }
  // 2. 从AI联网检查缓存中查找（补充静态数据未覆盖的）
  const aiConfusing = getCachedConfusing(key);
  aiConfusing.forEach(w => {
    const item = items.find(i => i.term.toLowerCase() === w.toLowerCase());
    if (item && !seen.has(item.term.toLowerCase())) {
      result.push(item);
      seen.add(item.term.toLowerCase());
    }
  });
  // 3. 自动检测拼写相似的词（词库中存在的）
  if (key.length >= 3) {
    const scored = [];
    for (const item of items) {
      const other = item.term.toLowerCase().trim();
      if (other === key || seen.has(other) || other.length < 3) continue;
      // 排除词族成员
      if (familyTerms.has(other)) continue;
      const dist = levenshteinDistance(key, other);
      const prefix = commonPrefixLen(key, other);
      const lenDiff = Math.abs(key.length - other.length);
      // 相似条件：编辑距离≤2且长度差≤2，或共同前缀≥3且编辑距离≤3
      if ((dist <= 2 && lenDiff <= 2) || (prefix >= 3 && dist <= 3 && lenDiff <= 2)) {
        scored.push({ item, dist, prefix });
      }
    }
    // 按编辑距离升序排列，取前12个
    scored.sort((a, b) => a.dist - b.dist || b.prefix - a.prefix);
    for (const { item } of scored.slice(0, 12)) {
      if (!seen.has(item.term.toLowerCase())) {
        result.push(item);
        seen.add(item.term.toLowerCase());
      }
    }
  }
  const _result = result.slice(0, 15);
  _confusingCache.set(cacheKey, _result);
  return _result;
}
function getConfusingNote(term) {
  const key = term.toLowerCase().trim();
  const entry = confusingWordsData.find(e => e.word === key);
  return entry ? entry.note : '';
}

// 判断某个易混词是否来自AI联网标注
function isAiConfusingWord(term, confusingTerm) {
  const aiConfusing = getCachedConfusing(term.toLowerCase().trim());
  return aiConfusing.includes(confusingTerm.toLowerCase().trim());
}

// 支持多种编号格式：1. / 1) / (1) / [1] / ① / 1、/ 第1 / 1.
function stripNumberPrefix(line) {
  return line.replace(/^[\s\d.)、\-\*•·]+/, '').trim();
}

function isEntryStart(line) {
  // 支持英文单词开头、带编号开头、带括号开头
  const safe = stripNumberPrefix(line);
  return /^[A-Za-z][A-Za-z''\-]*(?:\s+[A-Za-z][A-Za-z''\-]*){0,6}(\s|[.\/,:;]|$)/.test(safe)
    || /^\[[A-Za-z][A-Za-z''\-]*\]/.test(safe);
}

// v2.63.0：粘连文本智能断行 —— 「abandon放弃banana香蕉」这类整段粘贴的文本
// 在「中文字符紧跟英文字母」的边界切开；每行出现 ≥2 处边界才启用，避免误切正常释义
function splitSquashedRow(line) {
  try {
    const bounds = line.match(/[\u4e00-\u9fa5][A-Za-z]/g) || [];
    if (!bounds.length) return [line];
    const parts = line.split(/(?<=[\u4e00-\u9fa5])(?=[A-Za-z])/).map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) return [line];
    // 只有当每个分段都像完整词条（既含英文又含中文）时才确认切分；
    // 否则视为正常释义/例句（如 "abandon v.放弃abandon doing" 的英文尾段），保持原行
    const hasCjk = q => /[\u4e00-\u9fa5]/.test(q);
    const hasEn = q => /[A-Za-z]/.test(q);
    if (!parts.every(q => hasEn(q) && hasCjk(q))) return [line];
    return parts;
  } catch (e) { return [line]; }
}

function splitImportRecords(text) {
  const cleaned = cleanOcrText(text);
  const rows = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const records = [];
  rows.forEach(line => {
    // v2.63.0：先做粘连断行，再按原逻辑合并续行
    splitSquashedRow(line).forEach(piece => {
      const safe = stripNumberPrefix(piece);
      if (!safe) return;
      if (isEntryStart(safe) || !records.length) records.push(safe);
      else records[records.length - 1] = `${records[records.length - 1]} ${safe}`;
    });
  });
  return records;
}

function extractMeaning(text) {
  const w = text.replace(/^(中文|释义|意思|含义)\s*[:：]?\s*/i, '').trim();
  const fi = w.search(LABEL_REGEX);
  const head = fi >= 0 ? w.slice(0, fi) : w;
  // 更宽松的中文匹配：至少包含一个中文字符的词组
  const chunks = head.match(/[\u4e00-\u9fa5][\u4e00-\u9fa5、,，;；\s（）()《》""\-—\/\.a-zA-Z]*/g) || [];
  const meaning = chunks.join('；').replace(/\s+/g, '').replace(/^[;；,，\s]+|[;；,，\s]+$/g, '');
  return meaning || '请补充中文意思';
}

function extractPoints(text, meaning) {
  const points = [];
  const matches = [...text.matchAll(LABEL_REGEX)];
  matches.forEach((match, i) => {
    const s = match.index + match[0].length;
    const e = matches[i + 1]?.index ?? text.length;
    const v = text.slice(s, e).trim().replace(/[;,，；]+$/g, '');
    if (v) points.push(`${match[1]}：${v}`);
  });
  const mi = text.indexOf(meaning.replace(/；/g, ''));
  const tail = mi >= 0 ? text.slice(mi + meaning.length) : text;
  tail.split(/[;；]/).map(p => p.trim()).filter(p => p && !p.includes(meaning) && p.length > 3 && /[A-Za-z\u4e00-\u9fa5]/.test(p)).forEach(p => { if (!points.includes(p)) points.push(p); });
  return points;
}

/* 从释义中去除词性标记前缀，只保留中文释义部分（用于选项显示）
   v2.76.0 修复：旧版词性白名单漏了 a. / num. / aux. / modal. / abbr. 等，
   导致「a. 能干的, 能够的」这类释义把 a. 原样留在界面上并被 TTS 念成字母 "a"。
   现改为统一词表 + 边界锚定（前一个字符必须是空白或中英文标点），
   避免误伤 U.S.A.、e.g. 这类含点的缩写。 */
function stripPosPrefix(text) {
  if (!text) return '';
  return String(text)
    .replace(POS_TAG_RE, '$1')
    .replace(/^[,，；;\s.]+|[,，；;\s.]+$/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* 释义规范化（v2.76.0）：在内置词库入库前统一清洗，界面显示 / 搜索 / 朗读共用同一份文本。
   规则（确定性纯函数，无网络、无随机）：
   1) 全角分号统一为 ；，按 ； 切成义项组
   2) 每组去掉词性标记（a. adj. n. vt. …）与领域标签（[经] [医] [计] …）
   3) 丢掉清洗后为空的组；与前面完全相同的组去重（如「删除；[计] 删除」→「删除」）
   4) 全部丢失时回退为原文本，保证不出现空释义 */
/* v2.78.0：释义里的三类历史脏数据（来自一部老词典），必须在入库时清掉
   ① DOS 命令说明：「DOS内部命令:复制文件」「DOS外部命令:格式化磁盘」
   ② 缩略语展开：「计算机辅助教育」「BASIC语言」「美国北卡罗来纳州Internet网」
   ③ 语法注释：「be 的现在分词」「bite 的过去式和过去分词」
   这些内容与高考无关，出现在选项里会让人以为释义错了。规则常量见文件顶部。 */
function cleanMeaning(text) {
  var raw = String(text || '').trim();
  if (!raw) return '';
  var groups = raw.replace(/[;；]/g, '；').split('；');
  var out = [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    if (MEANING_GRAMMAR_RE.test(g.trim())) continue;      // 纯语法注释组直接丢
    var junkAt = g.search(MEANING_JUNK_RE);
    if (junkAt >= 0) g = g.slice(0, junkAt);              // 脏内容之后的一律截断
    // 组内嵌在末尾的语法注释（"存在, 性质, 生物, be的现在分词"）按子句剔除
    g = g.replace(/[,，、\s]*[A-Za-z\u4e00-\u9fa5]{0,12}的(过去式|过去分词|现在分词|复数|第三人称单数|比较级|最高级)[^,，；;]*/g, '');
    // 同一组里混着的工具说明（"远程, 远程访问实用程序"）只去掉那一段，保留正常义项
    var segs = g.split(/[,，、]/);
    var kept = [];
    var techCount = 0;
    for (var si = 0; si < segs.length; si++) {
      var seg = segs[si].trim();
      if (!seg) continue;
      if (seg.length >= 3 && MEANING_TOOL_TAIL_RE.test(seg) && !MEANING_TOOL_KEEP[seg]) continue;
      if (MEANING_TECH_RE.test(seg)) techCount++;
      kept.push(seg);
    }
    // 整组都是缩略语展开（"医学文摘索引, 存取隔离机构, 高级信息管理程序…"）→ 整组丢弃
    if (segs.length >= 3 && techCount >= 2 && techCount * 2 >= segs.length) continue;
    g = kept.join(', ');
    g = g
      .replace(/【[^】]{1,8}】/g, ' ')
      .replace(/\[[^\]]{1,8}\]/g, ' ')
      .replace(/[（(][^）)]*(的复数形式|的过去式|的过去分词|的现在分词|缩写)[^）)]*[）)]/g, '')
      .replace(POS_TAG_RE, '$1')
      .replace(/^[\s,，、.．\-—/\\]+|[\s,，、.．\-—/\\]+$/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (!g) continue;
    if (/^[.\-—…]+$/.test(g)) continue;
    if (out.indexOf(g) >= 0) continue;
    out.push(g);
  }
  return out.length ? out.join('；') : stripPosPrefix(raw);
}

// 提取词性标记前缀（如 "n." "vt." "adj." 等）
function extractPosPrefix(text) {
  if (!text) return '';
  const m = String(text).match(/^(n\.|vt\.|vi\.|v\.|a\.|adj\.|adv\.|prep\.|pron\.|conj\.|interj\.|det\.|art\.|num\.|aux\.|modal\.|abbr\.)/);
  return m ? m[1] : '';
}

// 获取简短释义（用于背诵页选项），保留词性标记
function getShortMeaning(text) {
  if (!text) return '';
  // 按中文分号/逗号分割，取第一个义项（保留词性标记）
  const segments = String(text).split(/[，；;]/);
  const firstSeg = segments[0] ? segments[0].trim() : '';
  // 如果第一个义项很长，去除词性标记只保留中文
  if (firstSeg.length > 14) {
    const stripped = stripPosPrefix(firstSeg);
    if (stripped && stripped.length >= 2) return stripped;
  }
  // 否则保留词性标记（如 "n.塑料"）
  if (firstSeg && firstSeg.length >= 2) return firstSeg;
  // 回退：返回去除词性的完整释义
  return stripPosPrefix(text);
}

// 判断两个释义是否共享中文实义字符（用于检测近义词）
function meaningsShareChars(meaning1, meaning2) {
  const m1 = stripPosPrefix(meaning1);
  const m2 = stripPosPrefix(meaning2);
  if (!m1 || !m2 || m1.length < 2 || m2.length < 2) return false;
  // 常见虚词/功能字，不算近义
  const ignoreChars = new Set('的了吗呢吧在是有了和与及或人事物地得');
  const chars1 = new Set();
  for (const c of m1) {
    if (/[\u4e00-\u9fa5]/.test(c) && !ignoreChars.has(c)) chars1.add(c);
  }
  if (chars1.size === 0) return false;
  for (const c of m2) {
    if (/[\u4e00-\u9fa5]/.test(c) && !ignoreChars.has(c) && chars1.has(c)) return true;
  }
  return false;
}

/* v2.78.0 选项去重：判断两条中文释义是不是「同一个意思」
   旧版只用「完全相同」排除，结果困难模式里同时出现「放弃」与「放弃，遗弃」，
   用户看到两个几乎一样的选项，怎么选都像错的。这里用三条确定性规则：
   ① 去掉标点后相同 → 视为同一个
   ② 包含关系（短的被长的完全包含）→ 视为同一个
   ③ 汉字重合度 ≥ 0.6，或 4 字以内编辑距离 ≤ 1 → 视为同一个 */
function meaningKey(s) {
  return String(s == null ? '' : s).replace(/[\s，,。；;、：:（）()【】\[\]…·.．!！?？~～-]/g, '');
}

function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function meaningsTooClose(a, b) {
  const A = meaningKey(a), B = meaningKey(b);
  if (!A || !B) return true;
  if (A === B) return true;
  if (A.indexOf(B) >= 0 || B.indexOf(A) >= 0) return true;
  const sa = new Set(Array.from(A)), sb = new Set(Array.from(B));
  let inter = 0;
  sa.forEach((c) => { if (sb.has(c)) inter++; });
  const union = sa.size + sb.size - inter;
  if (union > 0 && inter / union >= 0.6) return true;
  if (A.length <= 4 && B.length <= 4 && editDistance(A, B) <= 1) return true;
  return false;
}

function extractExamples(text) {
  const m = text.match(/(?:例句|example)\s*[:：]\s*(.+)$/i);
  if (!m) return [];
  return m[1].split(/(?<=[.!?。！？])\s+/).map(i => i.trim()).filter(i => i.length > 6);
}

function parseOneRecord(line, index, defaultType) {
  const frequency = /(高频|中频|低频)/.exec(line)?.[1] || '自定义';

  // 尝试匹配词性
  const posMatch = line.match(POS_REGEX);
  let term = '', pos = '', rest = line;

  if (posMatch) {
    // 有词性标注：term 在词性之前
    term = line.slice(0, posMatch.index).replace(/^[\d.)、\s\-\\*•·]+/, '').trim();
    pos = collectPosText(line.slice(posMatch.index)) || posMatch[1];
    rest = line.slice(posMatch.index + posMatch[0].length).trim();
  } else {
    // 无词性标注：尝试多种格式
    // 格式1: 纯英文单词开头
    const tm = line.match(/^[\d.)、\s\-\\*•·]*([A-Za-z][A-Za-z''\-]*(?:\s+[A-Za-z][A-Za-z''\-]*){0,6})/);
    if (tm) {
      term = tm[1].trim();
      rest = line.slice(line.indexOf(term) + term.length).trim();
    } else {
      // 格式2: 第一个空格分隔的词
      const parts = line.split(/\s+/);
      term = parts[0] || `未命名-${index + 1}`;
      rest = parts.slice(1).join(' ');
    }
  }

  // 清理 term：保留字母、数字、撇号、连字符和空格
  term = term.replace(/[^A-Za-z0-9''\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const isPhrase = term.includes(' ') || defaultType === 'phrase';

  // 如果 rest 为空，尝试从原始行重新提取
  if (!rest && line.includes(term)) {
    rest = line.slice(line.indexOf(term) + term.length).trim();
  }

  const meaning = extractMeaning(rest);
  const points = extractPoints(rest, meaning);
  const examples = extractExamples(rest);

  return {
    id: `custom-${Date.now()}-${index}-${term}`,
    type: isPhrase ? 'phrase' : 'word',
    term,
    pos: normalizePos(pos, isPhrase),
    meaning,
    frequency,
    corePoints: points.slice(0, 2),
    allPoints: points.length ? points : ['已自动导入，建议补充完整用法'],
    examples,
    phonetic: generatePhonetic(term),
    notes: '',
    source: '自定义导入'
  };
}

// v2.63.0：常见表头 / 页眉噪音行（无中文释义时直接跳过）
const IMPORT_NOISE_TERMS = /^(word|words|vocab|vocabulary|list|unit|units|page|pages|day|date|name|answers?|key|exercise|test)$/i;

function parseImportedText(text, defaultType = 'word') {
  const parsed = splitImportRecords(text).map((line, i) => parseOneRecord(line, i, defaultType)).filter(item => {
    const t = item.term.trim();
    if (!/[A-Za-z]/.test(t) || /^[A-Z]$/i.test(t) || t.length <= 1) return false;
    if (IMPORT_NOISE_TERMS.test(t) && (!item.meaning || item.meaning === '请补充中文意思')) return false;
    return true;
  });
  // v2.63.0：本地去重合并 —— 同一单词多次出现时合并释义与考点，不再产生重复词条
  const merged = [];
  const seen = {};
  let dupCount = 0;
  parsed.forEach(it => {
    const k = it.term.toLowerCase();
    if (!seen[k]) { seen[k] = it; merged.push(it); return; }
    dupCount++;
    const prev = seen[k];
    const m = it.meaning;
    if (m && m !== '请补充中文意思' && (!prev.meaning || prev.meaning === '请补充中文意思')) prev.meaning = m;
    else if (m && m !== '请补充中文意思' && prev.meaning.indexOf(m) === -1) prev.meaning += '；' + m;
    (it.allPoints || []).forEach(p => {
      if (p && p !== '已自动导入，建议补充完整用法' && prev.allPoints.indexOf(p) === -1) prev.allPoints.push(p);
    });
  });
  parseImportedText.lastDupCount = dupCount;
  return merged;
}

/* ============================
   八、AI识别功能
   ============================ */

// 内置AI服务商预设
const AI_PROVIDERS = [
  { id: 'siliconflow', name: '硅基流动（国内，推荐）', endpoint: 'https://api.siliconflow.cn/v1/chat/completions', model: 'deepseek-ai/DeepSeek-V2.5', keyUrl: 'https://cloud.siliconflow.cn' },
  { id: 'openai', name: 'OpenAI（需VPN）', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com' },
  { id: 'zhipu', name: '智谱AI（国内）', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash', keyUrl: 'https://open.bigmodel.cn' },
  { id: 'aliyun', name: '阿里云百炼（国内）', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model: 'qwen-turbo', keyUrl: 'https://bailian.console.aliyun.com' },
  { id: 'baidu', name: '百度千帆（国内）', endpoint: 'https://qianfan.baidubce.com/v2/chat/completions', model: 'ernie-speed', keyUrl: 'https://qianfan.cloud.baidu.com' },
  { id: 'custom', name: '自定义', endpoint: '', model: '', keyUrl: '' },
];

const AI_CONFIG_KEY = 'aiImportConfig';

function loadAiConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem(AI_CONFIG_KEY) || '{}');
    const defaults = { provider: 'siliconflow', apiKey: '' };
    const config = { ...defaults, ...saved };
    // 如果provider不是custom，自动填充endpoint和model
    const provider = AI_PROVIDERS.find(p => p.id === config.provider);
    if (provider && config.provider !== 'custom') {
      config.endpoint = provider.endpoint;
      config.model = provider.model;
    }
    return config;
  } catch { return { provider: 'siliconflow', apiKey: '', endpoint: AI_PROVIDERS[0].endpoint, model: AI_PROVIDERS[0].model }; }
}

function saveAiConfig(c) { localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(c)); }

function fileToDataUrl(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}

function getAiPrompt(defaultType, sourceText = '') {
  return `你是高中高考英语词库整理助手。请从用户给出的词表中提取高考英语单词和短语。要求：1.只输出JSON。2.格式{"items":[...]}。3.每个item包含：term,type,pos,meaning,frequency,corePoints,allPoints,examples。4.type为word或phrase。5.词性规范化。6.meaning用中文。7.忽略标题和无关文字。原始文本：${sourceText.slice(0, 12000)}`;
}

function extractJsonObject(text) {
  const c = String(text || '').replace(/```json|```/g, '').trim();
  const s = c.indexOf('{'), e = c.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('AI没有返回有效JSON');
  return JSON.parse(c.slice(s, e + 1));
}

function normalizeAiItems(items, defaultType) {
  return (items || []).map((item, i) => {
    const term = String(item.term || '').trim();
    const isPhrase = item.type === 'phrase' || term.includes(' ') || defaultType === 'phrase';
    const allPoints = Array.isArray(item.allPoints) && item.allPoints.length ? item.allPoints.map(String) : ['AI识别导入，建议检查补充'];
    const corePoints = Array.isArray(item.corePoints) && item.corePoints.length ? item.corePoints.map(String).slice(0, 2) : allPoints.slice(0, 2);
    return {
      id: `ai-${Date.now()}-${i}-${term}`, type: isPhrase ? 'phrase' : 'word', term,
      pos: normalizePos(item.pos || '', isPhrase), meaning: String(item.meaning || '请补充中文意思').trim(),
      frequency: item.frequency || '自定义', corePoints, allPoints,
      examples: Array.isArray(item.examples) ? item.examples.map(String) : [],
      notes: '', source: 'AI大模型识别'
    };
  }).filter(item => item.term && /[A-Za-z]/.test(item.term));
}

async function readFileText(file) {
  if (!file) return '';
  const ext = file.name.split('.').pop().toLowerCase();
  try {
    if (ext === 'txt' || ext === 'csv') return await file.text();
    if (ext === 'pptx') return await extractPptxText(file);
    if (ext === 'pdf') return await extractPdfText(file);
    if (ext === 'docx') return await extractDocxText(file);
    if (ext === 'doc') throw new Error('不支持旧版 .doc 格式，请用 Word 另存为 .docx 或将内容复制为文本后粘贴导入');
    if (['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif'].includes(ext)) return await extractImageText(file);
    return await file.text();
  } catch (e) {
    throw new Error(`解析文件失败：${e.message}。建议将文件内容复制后粘贴到文本框中导入。`);
  }
}

/* jszip 懒加载（v2.79.0）：只有导入 pptx / docx 才需要，首屏不必下载 96KB */
let _jszipMod = null;
/**
 * 按需加载 jszip（只在解压 pptx/docx 时调用）。
 * @returns {Promise<any>} JSZip 构造函数
 */
function loadJSZip() {
  if (_jszipMod) return Promise.resolve(_jszipMod);
  return import('jszip').then(function (mod) {
    _jszipMod = (mod && mod.default) ? mod.default : mod;
    return _jszipMod;
  });
}

async function extractPptxText(file) {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const slides = Object.keys(zip.files).filter(n => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'));
    const chunks = [];
    for (const name of slides) {
      const xml = await zip.files[name].async('text');
      chunks.push([...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).join(' '));
    }
    return cleanOcrText(chunks.join('\n'));
  } catch (e) { throw new Error('PPTX 解析失败: ' + e.message); }
}

async function extractPdfText(file) {
  try {
    const pdfjs = await getPdfjs();
    if (!pdfjs) throw new Error('PDF 解析库加载失败，请检查网络');
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const rows = new Map();
      content.items.forEach(item => { const y = Math.round(item.transform[5] / 4) * 4; const r = rows.get(y) || []; r.push({ x: item.transform[4], text: item.str }); rows.set(y, r); });
      pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(p => p.text).join(' ').trim()).filter(Boolean).join('\n'));
    }
    return cleanOcrText(pages.join('\n'));
  } catch (e) { throw new Error('PDF 解析失败: ' + e.message); }
}

async function extractDocxText(file) {
  try {
    const JSZip = await loadJSZip();
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.files['word/document.xml']?.async('text');
    if (!xml) throw new Error('DOCX 文件结构异常');
    return cleanOcrText(xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  } catch (e) { throw new Error('DOCX 解析失败: ' + e.message); }
}

async function extractImageText(file) {
  try {
    setImportStatus('正在识别图片文字，可能需要十几秒...');
    const createWorker = await getTesseractCreateWorker();
    if (!createWorker) throw new Error('OCR 库加载失败，请检查网络');
    const worker = await createWorker('eng+chi_sim', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
      langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-lang@5',
    });
    await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
    const result = await worker.recognize(file);
    await worker.terminate();
    return cleanOcrText(result.data.text);
  } catch (e) { throw new Error('图片识别失败: ' + e.message + '。建议手动输入或使用AI识别。'); }
}

/* ============================
   九、发音功能
   ============================ */

// 从"英文 中文"混合字符串中提取英文部分用于发音
function extractEnglish(text) {
  if (!text) return '';
  const m = String(text).match(/^([a-zA-Z][a-zA-Z\s''\-\.]*?)(?:\s+[\u4e00-\u9fff]|$)/);
  return m ? m[1].trim() : String(text).trim();
}

const _audioCache = {};
const _audioCacheKeys = []; // 插入顺序（LRU 淘汰用）
const _AUDIO_CACHE_MAX = 60; // 低内存设备（翻译笔）防内存溢出上限
let _lastAudio = null; // 当前在播的网络发音（切换单词时暂停，避免重叠）
let _voicesWarmed = false;
function _warmupVoices() {
  if (_voicesWarmed || !('speechSynthesis' in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.rate = 1;
    window.speechSynthesis.speak(u);
    _voicesWarmed = true;
  } catch {}
}
// v2.55.9: 超出上限时淘汰最旧的缓存 Audio 并释放资源
function _evictAudioCacheIfNeeded() {
  while (_audioCacheKeys.length > _AUDIO_CACHE_MAX) {
    const key = _audioCacheKeys.shift();
    const old = _audioCache[key];
    delete _audioCache[key];
    if (old) {
      try { if (_lastAudio === old) _lastAudio = null; old.pause(); } catch (e) {}
      try { old.src = ''; } catch (e) {}
    }
  }
}
/* ---- v2.60.0 发音引擎：中文真人音 + 多源回退 ---- */

// 中文朗读文本清洗：去掉词性前缀/括号/特殊符号，并限制长度
// 实测：TTS 接口对超长文本会返回空音频（120 字节），需截断
function _zhSpeechText(text) {
  var t = _meaningForSpeech(text);
  t = t.replace(/[（(][^）)(]*[）)]/g, ' ')
       .replace(/[<>《》「」【】\[\]{}]/g, ' ')
       .replace(/[·、]/g, '，')
       .replace(/\s+/g, ' ')
       .trim();
  if (t.length > 40) {
    var cut = t.slice(0, 40);
    var p = Math.max(cut.lastIndexOf('，'), cut.lastIndexOf(','));
    t = (p > 12 ? cut.slice(0, p) : cut).trim();
  }
  return t;
}

/* v2.65.0 听读专用中文精简：只读高考高频核心释义（前 1~2 个），大幅缩短整库音频时长。
   规则（确定性纯函数）：
   1) 丢弃 [计] [医] [经] 等领域标签释义组（词典噪音，与高考无关）
   2) 取第一个义项组（词典按词频排序，第一个即最高频释义）
   3) 逗号分隔的多个释义只取前 2 个
   4) 去词性前缀 / 括号补充说明，总长限 16 字 */
function _zhAlbumText(text) {
  var t = String(text || '');
  // 去掉领域标签释义组：如 "；[经] 能力, 才能" 整段移除
  t = t.replace(/[；;]\s*\[[^\]]{1,6}\][^；;]*/g, '');
  // 段首就是领域标签的（如 "[医] 失神"）
  t = t.replace(/\[[^\]]{1,6}\][^；;]*/g, '');
  // 取第一义项组
  var seg = (t.split(/[；;\n]/)[0] || t);
  // 去词性前缀（可能多个，如 "prep. adv." / "n. & vt."）
  seg = seg.replace(/^((vt|vi|n|v|a|adj|adv|prep|conj|pron|art|num|int|aux|modal|abbr)\.\s*(&\s*(vt|vi|n|v|a|adj|adv|prep|conj|pron|art|num|int|aux|modal|abbr)\.\s*)?)+/i, '');
  // 去括号补充说明
  seg = seg.replace(/[（(][^）)]*[）)]/g, ' ');
  // 逗号分义，取前 2 个（高频优先）
  var parts = seg.split(/[，,、]/).map(function (s) { return s.trim(); }).filter(Boolean);
  // 去掉截断残句（"的/了/在..." 单字虚词）与省略号
  parts = parts.filter(function (s) { return s.length > 0 && !/^[的了吗呢吧在…\.]+$/.test(s); });
  var out = parts.slice(0, 2).join('，').replace(/\s+/g, ' ').trim();
  if (out.length > 16) out = out.slice(0, 16).replace(/[，,\s]+$/, '');
  return out;
}

// 中文发音候选源（按可靠性排序）
// 实测结论（v2.60.0）：
//  - 百度翻译 gettts：支持整句、标点、长文本，作主源
//  - 有道 dictvoice le=zh：仅 2~6 字短词可靠，含空格/标点的释义会返回 120 字节空音频
//  - 旧实现用 dictvoice?type=2 读中文 → 只返回约 0.1 秒静音，这是“听不到中文”的根因
// v2.75.0 高清中文语音包状态文案（原生回传 zhpack:ready:N / zhpack:downloading:i/n / zhpack:failed）
function zhPackText(s) {
  var v = String(s || '');
  if (v.indexOf('ready:') === 0) return '已就绪 · ' + v.slice(6) + ' 条离线语音';
  if (v.indexOf('downloading:') === 0) return '下载中（约 16MB，仅首次）';
  if (v === 'queued') return '已排队 · 开始播放后自动下载';
  if (v === 'failed') return '下载失败 · 中文继续从云端获取，可稍后重试';
  var c = 0;
  try { if (window.NativeVoice && typeof window.NativeVoice.count === 'function') c = window.NativeVoice.count() | 0; } catch (e) { c = 0; }
  return c > 0 ? ('已就绪 · ' + c + ' 条离线语音') : '未开启 · 中文从云端获取（更省空间）';
}

// 文件大小友好显示（KB / MB）
function fmtFileSize(bytes) {
  var n = Number(bytes) || 0;
  if (n <= 0) return '0 MB';
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  return Math.max(1, Math.round(n / 1024)) + ' KB';
}

// v2.77.0 中文朗读链路重排：云端优先 → 有道高清短词 → 本地包兜底
// 背景（实测）：英文有道真人音是 48kHz/64kbps，听着清亮；中文旧的离线包只有 16kbps，
// 频带被压得很窄，这就是「中文明显不如英文好听」的物理原因。云端配音是 64kbps，
// 先云端、把 15.7MB 的离线包降级成「可选兜底」，既好听又不占空间。
function _zhOnlineUrls(t, rate) {
  // 语速映射：百度 spd 1~9，5 为常速。旧实现 rate*3 让 1.0x 只到 3（比正常明显慢），
  // 慢速 16kHz 合成音会更闷，这里改成 rate*5，1.0x 正好常速。
  var spd = Math.max(1, Math.min(9, Math.round((rate || 1) * 5)));
  return ['https://fanyi.baidu.com/gettts?lan=zh&text=' + encodeURIComponent(t) + '&spd=' + spd + '&source=web'];
}

function zhAudioUrls(text, rate) {
  var t = String(text || '').trim();
  if (!t) return [];
  var urls = [];
  var localPath = '';
  try {
    if (window.NativeVoice && typeof window.NativeVoice.localZh === 'function') {
      localPath = window.NativeVoice.localZh(t) || '';
    }
  } catch (e) { localPath = ''; }
  var offline = false;
  try { offline = (typeof navigator !== 'undefined' && navigator.onLine === false); } catch (e) { offline = false; }

  // 断网：本地包优先，保证一定有声音
  if (offline && localPath) urls.push(localPath);
  // 短词走有道 24kHz 高清音色（只覆盖词典词条，未命中会 500，链式播放自动落到下一源）
  if (t.length <= 6 && !/[\s，,、；;]/.test(t)) {
    urls.push('https://dict.youdao.com/dictvoice?audio=' + encodeURIComponent(t) + '&le=zh');
  }
  // 云端整句配音（主源）
  urls = urls.concat(_zhOnlineUrls(t, rate));
  // 在线但云端失败时，本地包垫底（不再作为首选）
  if (!offline && localPath) urls.push(localPath);
  return urls;
}

// 把释义拆成 1~3 个义项，逐段朗读：段间有自然停顿，比一口气念完更像词条
function _zhSegments(text, max) {
  var t = String(text || '').trim();
  if (!t) return [];
  var parts = t.split(/[；;]/).map(function (s) { return s.trim(); }).filter(function (s) { return !!s; });
  if (!parts.length) parts = [t];
  var out = [];
  for (var i = 0; i < parts.length && out.length < (max || 3); i++) out.push(parts[i]);
  return out;
}

// 逐段串行朗读（每段先试本地/云端链，段间停 180ms）
function speakZhSegmentsAsync(text, rate, useNative) {
  var segs = _zhSegments(text, 3);
  if (!segs.length) return Promise.resolve();
  var i = 0;
  function step() {
    if (i >= segs.length) return Promise.resolve();
    var seg = segs[i++];
    return speakChainAsync(zhAudioUrls(seg, rate), seg, 'zh-CN', rate || 1, useNative)
      .then(function () {
        if (i >= segs.length) return null;
        return new Promise(function (r) { setTimeout(r, 180); });
      })
      .then(function () { return step(); });
  }
  return step();
}

// ===== v2.62.0：剪贴板 / 文件保存 / ZIP 打包 / MP3 下载 工具 =====

// 复制文本到剪贴板：原生桥接 → 浏览器 API → execCommand 三级回退
// file:// 协议不是安全上下文，navigator.clipboard 在旧 WebView 常不可用，因此必须做回退
function copyTextToClipboard(text) {
  try {
    if (window.NativeClipboard && typeof window.NativeClipboard.copy === 'function') {
      if (window.NativeClipboard.copy(text)) return true;
    }
  } catch (e) {}
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
      return true;
    }
  } catch (e) {}
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    ta.style.top = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(ta);
    return !!ok;
  } catch (e) { return false; }
}

// 触发浏览器 / 系统下载
function saveBlobAs(blob, filename) {
  try {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 3000);
    return true;
  } catch (e) { return false; }
}

// 文本存成文件：原生优先写入 Documents，失败回退浏览器下载
async function saveTextFile(text, fileName) {
  // v2.63.0：原生桥接优先，直接写入「下载/背群英」
  // （WebView 里 <a download> 对 blob 链接无效，旧版点「下载 txt」没有任何反应）
  try {
    if (window.NativeFile && window.NativeFile.saveText) {
      var _np = window.NativeFile.saveText(text, fileName);
      if (_np) return _np;
    }
  } catch (e) {}
  try {
    if (typeof isNativeApp !== 'undefined' && isNativeApp && typeof Filesystem !== 'undefined' && Filesystem) {
      var dirName = '背群英导出';
      try { await Filesystem.mkdir({ path: dirName, directory: Directory.Documents }); } catch (e) {}
      await Filesystem.writeFile({
        path: dirName + '/' + fileName,
        data: text,
        directory: Directory.Documents,
        encoding: Encoding.UTF8
      });
      return 'Documents/' + dirName + '/' + fileName;
    }
  } catch (e) {}
  try {
    saveBlobAs(new Blob([text], { type: 'text/plain;charset=utf-8' }), fileName);
  } catch (e) {}
  return '';
}

// CRC32（ZIP 必需）
var _crcTable = (function () {
  var t = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  var c = 0xFFFFFFFF;
  for (var i = 0; i < buf.length; i++) c = _crcTable[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

// 纯 JS ZIP 打包（store 模式：MP3 本身已压缩，不再二次压缩，速度最快）
function zipStore(files) {
  var chunks = [], central = [], offset = 0;
  var enc = (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null;
  function strBytes(str) {
    if (enc) return enc.encode(str);
    var a = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) a.push(c);
      else if (c < 0x800) a.push(0xC0 | (c >> 6), 0x80 | (c & 63));
      else a.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(a);
  }
  function u16(v) { return [v & 255, (v >> 8) & 255]; }
  function u32(v) { return [v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >>> 24) & 255]; }
  for (var i = 0; i < files.length; i++) {
    var name = strBytes(files[i].name);
    var data = files[i].data;
    var crc = crc32(data);
    var lh = new Uint8Array([].concat(
      [80, 75, 3, 4], u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0)));
    chunks.push(lh, name, data);
    var ch = new Uint8Array([].concat(
      [80, 75, 1, 2], u16(20), u16(20), u16(0x0800), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset)));
    central.push(ch, name);
    offset += lh.length + name.length + data.length;
  }
  var centralSize = 0;
  for (var j = 0; j < central.length; j++) centralSize += central[j].length;
  var end = new Uint8Array([].concat(
    [80, 75, 5, 6], u16(0), u16(0), u16(files.length), u16(files.length),
    u32(centralSize), u32(offset), u16(0)));
  return new Blob(chunks.concat(central, [end]), { type: 'application/zip' });
}

// 下载单个 MP3：原生保存到「下载/背群英」，网页触发下载
function downloadMp3File(url, filename) {
  if (!url) return Promise.resolve(false);
  try {
    if (window.NativePlayer && window.NativePlayer.downloadMp3) {
      window.NativePlayer.downloadMp3(url, filename);
      return Promise.resolve(true);
    }
  } catch (e) {}
  return fetch(url).then(function (r) { return r.blob(); }).then(function (b) {
    if (!b || b.size < 256) return false;
    return saveBlobAs(b, filename);
  }).catch(function () { return false; });
}

// 批量下载 MP3 并打包：原生用 Java 层打包（快、省内存），网页端用 JS zip
// onProgress(done, total, path)；done < 0 表示结束，path 为保存路径（网页端为空）
function downloadMp3Zip(tasks, zipName, onProgress) {
  if (!tasks || !tasks.length) { if (onProgress) onProgress(-1, 0, ''); return; }
  try {
    if (window.NativeMp3 && window.NativeMp3.downloadZip) {
      window.__mp3Progress = function (d, t) { if (onProgress) onProgress(d, t, ''); };
      window.__mp3ZipDone = function (p) { if (onProgress) onProgress(-1, tasks.length, p || ''); };
      window.NativeMp3.downloadZip(JSON.stringify(tasks), zipName);
      return;
    }
  } catch (e) {}
  (async function () {
    var files = [];
    for (var i = 0; i < tasks.length; i++) {
      try {
        var r = await fetch(tasks[i].url);
        var b = await r.blob();
        if (b && b.size > 256) {
          var ab = await b.arrayBuffer();
          files.push({ name: tasks[i].name, data: new Uint8Array(ab) });
        }
      } catch (e) {}
      if (onProgress) onProgress(i + 1, tasks.length, '');
    }
    try {
      var zip = zipStore(files);
      saveBlobAs(zip, zipName);
    } catch (e) {}
    if (onProgress) onProgress(-1, tasks.length, '');
  })();
}

// 毫秒转 mm:ss
function fmtDuration(ms) {
  var t = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  var m = Math.floor(t / 60);
  var sec = t % 60;
  return m + ':' + (sec < 10 ? '0' + sec : sec);
}

// v2.62.0：热更新不再打断用户。听读播放 / 答题中返回 true → 原生把新版本留到下次启动生效
try {
  window.__shouldDeferUpdate = function () {
    try { return !!(window.__listenBusy && window.__listenBusy()); } catch (e) { return false; }
  };
  window.__onUpdateReady = function () {
    try { if (window.__onUpdateReadyCb) window.__onUpdateReadyCb(); } catch (e) {}
  };
} catch (e) {}

// 英文发音候选源：有道美音 → 有道英音 → 百度英文 → 系统 TTS
/* v2.76.0：把「听读队列 + 下载参数」折算成待下载任务列表（确定性纯函数，无副作用）。
   入参：
     queue      当前听读队列（[{term, meaning}]）
     opts.start 起始序号（1 基，越界自动夹到 1..n）
     opts.count 自定义条数（优先于预设档位）
     opts.preset 预设档位（20/50/100/300，0 表示全部）
     opts.rate  导出语速（null 时取 listenRate）
     opts.scope both | en | zh
   出参：{ tasks:[{url,name}], start, end, rate }
   规则：end 不超过队列长度；命名 = 三位序号 + 词 + _英/_中，便于按播放顺序排序。 */
function buildMp3Tasks(queue, opts) {
  var q = queue || [];
  var n = q.length;
  var o = opts || {};
  var rate = Number(o.rate || o.listenRate || 1);
  if (!(rate > 0.3)) rate = 1;
  if (!n) return { tasks: [], start: 0, end: 0, rate: rate };
  var start = parseInt(o.start, 10);
  if (!(start > 0)) start = 1;
  if (start > n) start = n;
  var count = parseInt(o.count, 10);
  if (!(count > 0)) count = Number(o.preset) > 0 ? Number(o.preset) : (n - start + 1);
  var end = Math.min(n, start - 1 + count);
  if (end < start) end = start;
  var scope = o.scope === 'en' ? 'en' : (o.scope === 'zh' ? 'zh' : 'both');
  var tasks = [];
  for (var i = start - 1; i < end; i++) {
    var item = q[i] || {};
    var num = ('000' + (i + 1)).slice(-3);
    var term = String(item.term || '');
    var base = num + '_' + (term.replace(/[^0-9a-zA-Z\-]/g, '_') || 'word');
    if (scope !== 'zh') {
      var enUrl = (enAudioUrls(term, rate) || [])[0];
      if (enUrl) tasks.push({ url: enUrl, name: base + '_英.mp3' });
    }
    if (scope !== 'en') {
      var zh = _zhAlbumText(item.meaning) || _zhSpeechText(item.meaning);
      if (zh) {
        var zhUrl = (zhAudioUrls(zh, rate) || [])[0];
        if (zhUrl) tasks.push({ url: zhUrl, name: base + '_中.mp3' });
      }
    }
  }
  return { tasks: tasks, start: start, end: end, rate: rate };
}

function enAudioUrls(text, rate) {
  var t = String(text || '').trim();
  if (!t) return [];
  // v2.76.0：语速参数只对能变速的源生效（百度 gettts 的 spd 为 1~9，3 ≈ 1.0x）
  var spd = Math.max(1, Math.min(9, Math.round((Number(rate) || 1) * 3)));
  return [
    'https://dict.youdao.com/dictvoice?type=2&audio=' + encodeURIComponent(t),
    'https://dict.youdao.com/dictvoice?type=1&audio=' + encodeURIComponent(t),
    'https://fanyi.baidu.com/gettts?lan=en&text=' + encodeURIComponent(t) + '&spd=' + spd + '&source=web'
  ];
}

// ===== v2.61.0：暂停 / 继续闸门 =====
// 目标：像音乐 App 一样，通知栏、锁屏、耳机线控、App 内按钮都能真正「暂停」再「继续」，
// 而不是一点暂停就把整条播放链取消（旧行为会导致继续时从头重读当前词）
var _listenPausedFlag = false;
var _listenResumeWaiters = [];
// v2.72.0：Android WebView 的 speechSynthesis.pause() 是空操作（声音不会停），
// 暂停时必须用 cancel() 立即打断；被打断的当前词在恢复后整词重播
var _listenTtsCutByPause = false;
function listenIsPaused() { return _listenPausedFlag; }
function listenSetPaused(v) {
  _listenPausedFlag = !!v;
  if (!_listenPausedFlag) {
    var ws = _listenResumeWaiters.slice();
    _listenResumeWaiters.length = 0;
    for (var i = 0; i < ws.length; i++) { try { ws[i](); } catch (e) {} }
  }
}
// 暂停中挂起，恢复后立即继续
function listenPauseGate() {
  if (!_listenPausedFlag) return Promise.resolve();
  return new Promise(function (res) { _listenResumeWaiters.push(res); });
}

// ===== v2.61.0：中文发音源偏好 =====
// system = 设备系统语音引擎（国产机多为讯飞/百度离线引擎，自然度好、零延迟）
// net    = 网络语音（通用兜底，任何设备都能出声，但音色偏机械）
function _listenZhSourcePref() {
  try {
    var s = JSON.parse(localStorage.getItem(LISTEN_CFG_KEY) || '{}') || {};
    return (s.zhSource === 'net' || s.zhSource === 'system') ? s.zhSource : 'auto';
  } catch (e) { return 'system'; }
}

// 系统是否存在可用中文语音（无中文引擎时 speak() 不报错但无声，必须探测）
var _zhVoiceCache = null;
var _zhVoiceChecked = false;
function getZhTtsVoice() {
  try {
    if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return null;
    if (_zhVoiceCache) return _zhVoiceCache;
    var vs = [];
    try { vs = window.speechSynthesis.getVoices() || []; } catch (e) { vs = []; }
    for (var i = 0; i < vs.length; i++) {
      var l = String(vs[i].lang || '').toLowerCase();
      if (l.indexOf('zh') === 0 || l.indexOf('cmn') === 0) { _zhVoiceCache = vs[i]; return _zhVoiceCache; }
    }
  } catch (e) {}
  return null;
}
// 语音列表可能异步就绪，变化后刷新缓存
try {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    if (window.speechSynthesis.addEventListener) {
      window.speechSynthesis.addEventListener('voiceschanged', function () { _zhVoiceCache = null; });
    }
    window.speechSynthesis.onvoiceschanged = function () { _zhVoiceCache = null; };
  }
} catch (e) {}

// 系统播放器：原生 MediaPlayer 前台服务，退出应用/锁屏/息屏后仍可播放
var _nativeAudioSeq = 0;
var _nativeAudioCbs = {};
function nativeAudioAvailable() {
  try { return !!(window.NativePlayer && typeof window.NativePlayer.playUrl === 'function'); } catch (e) { return false; }
}
try {
  window.__nativeAudioEvent = function (id, type) {
    try {
      if (!id) {
        if (window.__nativeMediaAction) window.__nativeMediaAction(type);
        return;
      }
      var cb = _nativeAudioCbs[id];
      if (cb) cb(type);
    } catch (e) {}
  };
} catch (e) {}

function nativePlayUrlAsync(url, rate) {
  return new Promise(function (resolve) {
    var id = String(++_nativeAudioSeq);
    var settled = false;
    var started = false;
    var timer = null;
    function clearT() { if (timer) { clearTimeout(timer); timer = null; } }
    function armTimer(ms) {
      clearT();
      timer = setTimeout(function () {
        // 暂停中不断续期，避免恢复后立刻跳到下一个词
        if (listenIsPaused()) { armTimer(ms); return; }
        finish(started);
      }, ms);
    }
    function finish(ok) {
      if (settled) return;
      settled = true;
      clearT();
      delete _nativeAudioCbs[id];
      // 暂停中先挂起，恢复后再收尾
      listenPauseGate().then(function () { resolve(!!ok); });
    }
    _nativeAudioCbs[id] = function (type) {
      if (type === 'start') { started = true; armTimer(60000); return; }
      if (type === 'error') { finish(false); return; }
      finish(true);
    };
    try {
      window.NativePlayer.playUrl(url, id, rate || 1);
    } catch (e) { finish(false); return; }
    // 15 秒仍未真正起播 → 判定该源失败（加载失败 / 空音频）
    armTimer(15000);
  });
}

function nativePlayFileAsync(path, rate) {
  return new Promise(function (resolve) {
    var id = String(++_nativeAudioSeq);
    var settled = false;
    var started = false;
    var timer = null;
    function clearT() { if (timer) { clearTimeout(timer); timer = null; } }
    function armTimer(ms) {
      clearT();
      timer = setTimeout(function () {
        if (listenIsPaused()) { armTimer(ms); return; }
        finish(started);
      }, ms);
    }
    function finish(ok) {
      if (settled) return;
      settled = true;
      clearT();
      delete _nativeAudioCbs[id];
      listenPauseGate().then(function () { resolve(!!ok); });
    }
    _nativeAudioCbs[id] = function (type) {
      if (type === 'start') { started = true; armTimer(60000); return; }
      if (type === 'error') { finish(false); return; }
      finish(true);
    };
    try {
      if (window.NativePlayer && typeof window.NativePlayer.playFile === 'function') {
        window.NativePlayer.playFile(path, id, rate || 1);
      } else {
        finish(false); return;
      }
    } catch (e) { finish(false); return; }
    armTimer(15000);
  });
}

function speak(text, rate) {
  if (!text) return;
  var normalized = String(text).trim();
  if (!normalized) return;
  var r = rate || 0.78;
  var isEnglish = /^[a-zA-Z\s''.,!?-]+$/.test(normalized);
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
  if (_lastAudio) { try { _lastAudio.pause(); } catch (e) {} _lastAudio = null; }
  try { if (window.NativePlayer && window.NativePlayer.stop) window.NativePlayer.stop(); } catch (e) {}
  // 背诵页单次发音走应用内音频（不启动系统播放器，避免每次点小喇叭都弹通知栏）
  if (isEnglish) {
    speakChainAsync(enAudioUrls(normalized), normalized, 'en-US', r, false);
  } else {
    var zh = _zhAlbumText(normalized) || _zhSpeechText(normalized);
    speakZhSegmentsAsync(zh, r, false);
  }
}


/* ============================
   听读模式（音乐播放器式背单词）
   调研结论（百词斩/墨墨/不背单词/Vocafy 等主流做法）：
   - 英文默认 2 遍、中文 1 遍，英→中顺序（先回忆再给答案）
   - 同语言重复间隔 ~0.6s，词间间隔默认 2s（可调 0.5~9s）
   ============================ */
const LISTEN_CFG_KEY = 'gaokao_listen_settings';
const LISTEN_BOOKS_KEY = 'gaokao_listen_books';
const LISTEN_FILTER_KEY = 'gaokao_listen_filter';

function _clampNum(v, min, max, dflt) {
  var n = Number(v);
  if (!isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}
function _clampInt(v, min, max, dflt) {
  var n = Math.round(Number(v));
  if (!isFinite(n)) return dflt;
  return Math.max(min, Math.min(max, n));
}

function loadListenCfg() {
  try {
    var s = JSON.parse(localStorage.getItem(LISTEN_CFG_KEY) || '{}') || {};
    return {
      enRepeat: _clampInt(s.enRepeat, 1, 5, 2),
      zhRepeat: _clampInt(s.zhRepeat, 0, 3, 1),
      order: (s.order === 'zh-en' || s.order === 'en') ? s.order : 'en-zh',
      innerGap: _clampNum(s.innerGap, 0, 3, 0.6),
      wordGap: _clampNum(s.wordGap, 0, 10, 2),
      rate: _clampNum(s.rate, 0.5, 2, 1),
      loop: (s.loop === 'one' || s.loop === 'off') ? s.loop : 'list',
      shuffle: !!s.shuffle,
      systemPlayer: s.systemPlayer !== false,
      zhSource: (s.zhSource === 'net' || s.zhSource === 'system') ? s.zhSource : 'auto',
      zhVoice: _clampInt(s.zhVoice, 0, 4, 0)
    };
  } catch (e) {
    return { enRepeat: 2, zhRepeat: 1, order: 'en-zh', innerGap: 0.6, wordGap: 2, rate: 1, loop: 'list', shuffle: false, systemPlayer: true, zhSource: 'auto', zhVoice: 0 };
  }
}

// 释义转朗读文本：去掉词性前缀（避免把 "v." 读成字母），分号转逗号
function _meaningForSpeech(meaning) {
  // v2.76.0：旧实现只剥段首词性，段中「…；a. 往国外的」里的 a. 会被念成字母 "a"。
  // 改为全量剥离（POS_TAG_RE 做过边界锚定），并把残留的孤立字母标记一并清掉。
  return String(meaning || '')
    .replace(/\[[^\]]{1,8}\]/g, ' ')  // [计] [医] 等领域标签念出来是噪音，全部剥掉
    .replace(POS_TAG_RE, '$1')
    .replace(/[;；]/g, '，')
    .replace(/[·、]/g, '，')
    .replace(/[<>《》「」【】]/g, ' ')
    .replace(/(^|[，,\s])([a-z]{1,3})\.(?=[，,\s]|$)/gi, '$1') // 兜底：残余的 xx. 词性残片
    .replace(/\s{2,}/g, ' ')
    .replace(/^[，,\s]+|[，,\s]+$/g, '')
    .trim();
}

// 听读专用音频缓存（与背诵页 speak() 的缓存隔离，避免事件回调互相干扰）
const _listenAudioCache = {};
const _listenAudioKeys = [];
let _listenAudio = null;
let _listenTtsDone = null;
let _listenWakeLock = null;

// v2.60.0：按 URL 缓存音频（与背诵页缓存隔离）；失败过的 URL 记录后不再重试
const _urlAudioCache = {};
const _urlAudioKeys = [];
const _failedAudioUrls = {};
const _URL_AUDIO_CACHE_MAX = 40;

function _getUrlAudio(url) {
  var a = _urlAudioCache[url];
  if (!a) {
    a = new Audio();
    a.preload = 'auto';
    a.src = url;
    _urlAudioCache[url] = a;
    _urlAudioKeys.push(url);
    while (_urlAudioKeys.length > _URL_AUDIO_CACHE_MAX) {
      var k = _urlAudioKeys.shift();
      var old = _urlAudioCache[k];
      delete _urlAudioCache[k];
      if (old) {
        try { old.pause(); } catch (e) {}
        try { old.src = ''; } catch (e) {}
      }
    }
  }
  return a;
}

// 单个 URL 播放：Promise<boolean>，true = 正常播完，false = 需要换下一个源
function playUrlAsync(url, rate) {
  return new Promise(function (resolve) {
    var audio;
    try { audio = _getUrlAudio(url); } catch (e) { resolve(false); return; }
    var settled = false;
    var started = false;
    var timer = null;
    _listenAudio = audio;
    function finish(ok) {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      try { audio.onended = null; audio.onerror = null; audio.onplaying = null; } catch (e) {}
      if (_listenAudio === audio) _listenAudio = null;
      // 收尾时确保停住，避免暂停恢复后与下一个词的声音重叠
      try { audio.pause(); } catch (e) {}
      listenPauseGate().then(function () { resolve(!!ok); });
    }
    audio.onplaying = function () { started = true; };
    audio.onended = function () {
      var dur = 0;
      try { dur = audio.duration; } catch (e) {}
      // 空音频（如 0.1 秒静音 / 120 字节无效文件）判定失败，继续换源
      finish(dur > 0.2);
    };
    audio.onerror = function () { finish(false); };
    try { audio.currentTime = 0; } catch (e) {}
    try { audio.playbackRate = Math.max(0.5, Math.min(2.5, rate || 1)); } catch (e) {}
    try {
      var p = audio.play();
      if (p && p.catch) p.catch(function () { finish(false); });
    } catch (e) { finish(false); return; }
    // 看门狗：6 秒仍无进度 → 换源；已在播放 → 按估算时长做超长保护
    timer = setTimeout(function () {
      var ct = 0, dur = 0;
      try { ct = audio.currentTime; dur = audio.duration; } catch (e) {}
      if (!(started || ct > 0.05)) { finish(false); return; }
      var r = Math.max(0.5, Math.min(2.5, rate || 1));
      var rest = ((dur || 5) - ct) * 1000 / r;
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { finish(true); }, Math.max(5000, rest) + 8000);
    }, 6000);
  });
}

// 依次尝试各发音来源：系统播放器 / 应用内音频 → 网络真人音 → 系统 TTS
function speakChainAsync(urls, ttsText, ttsLang, rate, useNative) {
  return new Promise(function (resolve) {
    var list = urls || [];
    var i = 0;
    var ttsTried = false;
    function tryTts() {
      if (ttsTried) { resolve(); return; }
      ttsTried = true;
      speakTtsAsync(ttsText, ttsLang, rate, useNative).then(function (ok) {
        if (ok) { resolve(); return; }
        // 系统语音不可用（无引擎/被静默）：若还有没试过的网络源，回头再试
        if (i < list.length) next(); else resolve();
      });
    }
    function next() {
      if (i >= list.length) { tryTts(); return; }
      var url = list[i++];
      var failedAt = _failedAudioUrls[url];
      if (failedAt && (Date.now() - failedAt) < 60000) { next(); return; }
      // v2.75.0 内置高清语音包返回的是本地绝对路径：原生解码播放，零网络、音质无损
      if (url.charAt(0) === '/') {
        var lp = (useNative && nativeAudioAvailable())
          ? nativePlayFileAsync(url, rate)
          : playUrlAsync('file://' + url, rate);
        lp.then(function (ok) { if (ok) { resolve(); return; } next(); });
        return;
      }
      var p = (useNative && nativeAudioAvailable()) ? nativePlayUrlAsync(url, rate) : playUrlAsync(url, rate);
      p.then(function (ok) {
        if (ok) { resolve(); return; }
        _failedAudioUrls[url] = Date.now();
        next();
      });
    }
    next();
  });
}


// 停止一切听读声音（含进行中的 Promise 收尾）
function stopListenAudio() {
  if (_listenAudio) {
    var a = _listenAudio;
    _listenAudio = null;
    try { a.pause(); } catch (e) {}
    try { if (a.__done) a.__done(); } catch (e) {}
  }
  if (_listenTtsDone) {
    var d = _listenTtsDone;
    _listenTtsDone = null;
    try { d(); } catch (e) {}
  }
  try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (e) {}
  try { if (window.NativePlayer && window.NativePlayer.stop) window.NativePlayer.stop(); } catch (e) {}
}

// v2.60.0：是否启用原生系统播放器（后台 / 锁屏 / 息屏继续播放）
function listenSystemPlayerOn() {
  try {
    return !!(window.NativePlayer && typeof window.NativePlayer.playUrl === 'function');
  } catch (e) { return false; }
}

// 原生层：后台播放 + 常亮（网页版走 Wake Lock）
function setListenNativePlaying(on) {
  try {
    if (window.NativeAudio && window.NativeAudio.setBackgroundPlayback) window.NativeAudio.setBackgroundPlayback(!!on);
    if (window.NativeAudio && window.NativeAudio.setKeepScreenOn) window.NativeAudio.setKeepScreenOn(!!on);
    // 停止播放时一并停掉系统播放器，撤掉通知栏卡片（避免播完仍残留常驻通知）
    if (!on && window.NativePlayer && window.NativePlayer.stop) window.NativePlayer.stop();
  } catch (e) {}
  try {
    if (on) {
      if (!_listenWakeLock && navigator.wakeLock && navigator.wakeLock.request) {
        try {
          navigator.wakeLock.request('screen').then(function (w) {
            _listenWakeLock = w;
            try { w.addEventListener('release', function () { _listenWakeLock = null; }); } catch (e) {}
          }).catch(function () {});
        } catch (e) {}
      }
    } else if (_listenWakeLock) {
      try { _listenWakeLock.release(); } catch (e) {}
      _listenWakeLock = null;
    }
  } catch (e) {}
}

// 可中断等待（暂停/切词时立即返回，不必等满间隔）
function listenSleep(ms, token, tokenRef) {
  return new Promise(function (resolve) {
    var elapsed = 0;
    var step = 100;
    function tick() {
      if (token !== tokenRef.current || elapsed >= ms) { resolve(); return; }
      // 暂停中不累计间隔，恢复后接着等剩余时间
      if (listenIsPaused()) { setTimeout(tick, step); return; }
      elapsed += step;
      setTimeout(tick, step);
    }
    if (ms <= 0) { resolve(); return; }
    setTimeout(tick, Math.min(step, ms));
  });
}

// 系统语音朗读：返回 Promise<boolean>（true = 确实发声了）
// 修复：部分设备无 TTS 引擎时 speak() 不报错也不触发 onend/onerror，
// 旧实现会静默等待整段超时，表现为"中文没声音"。这里用 onstart 探活：
// 1.8 秒内没有 onstart 即判定该设备发不出声，立即回退网络语音
function speakTtsAsync(text, lang, rate, companion) {
  return new Promise(function (resolve) {
    if (!text || !('speechSynthesis' in window)) { resolve(false); return; }
    var settled = false;
    var started = false;
    var done = function (ok) {
      if (settled) return;
      settled = true;
      // v2.63.0：TTS 结束时让原生媒体卡片退出「播放中」状态
      try { if (companion && window.NativePlayer && window.NativePlayer.ttsState) window.NativePlayer.ttsState(false, 0); } catch (e2) {}
      if (_listenTtsDone === done) _listenTtsDone = null;
      listenPauseGate().then(function () { resolve(ok !== false); });
    };
    _listenTtsDone = done;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      var v = (lang === 'zh-CN') ? getZhTtsVoice() : null;
      if (v) { try { u.voice = v; } catch (e) {} }
      u.rate = Math.max(0.5, Math.min(2, rate));
      u.pitch = 1;
      u.onstart = function () { started = true; };
      u.onend = function () { done(started); };
      u.onerror = function () { done(false); };
      // v2.63.0：TTS 伴侣模式 —— 系统语音朗读期间让原生 PlayerService 保持前台
      // 并上报「播放中」，锁屏 / 控制中心媒体卡片才会显示且可暂停 / 继续 / 切词
      try {
        var estMs = Math.max(1500, Math.min(30000, (lang === 'zh-CN'
          ? 1200 + text.length * 300 / Math.max(0.5, rate)
          : 1500 + text.length * 140 / Math.max(0.5, rate))));
        if (companion && window.NativePlayer && window.NativePlayer.ttsState) window.NativePlayer.ttsState(true, Math.round(estMs));
      } catch (e2) {}
      window.speechSynthesis.speak(u);
    } catch (e) { done(false); return; }
    // 探活：1.8 秒仍无 onstart → 判定无声，回退
    setTimeout(function () {
      if (!settled && !started) {
        try { window.speechSynthesis.cancel(); } catch (e) {}
        done(false);
      }
    }, 1800);
    var ms = lang === 'zh-CN'
      ? 1200 + text.length * 300 / Math.max(0.5, rate)
      : 1500 + text.length * 140 / Math.max(0.5, rate);
    setTimeout(function () { done(started); }, Math.max(1500, Math.min(30000, ms)));
  });
}

// 英文朗读：有道真人音 → 百度英文 → 系统 TTS（优先走原生系统播放器以便后台播放）
function speakEnAsync(text, rate) {
  var t = String(text || '').trim();
  if (!t) return Promise.resolve();
  return speakChainAsync(enAudioUrls(t), t, 'en-US', rate || 1, listenSystemPlayerOn());
}

// 中文朗读（v2.61.0 自然度优先）
// 顺序：设备系统中文语音（讯飞/百度/Google 离线引擎，明显比网页机械音自然、零延迟）
//   → 网络整句语音 → 网络短词语音 → 系统语音兜底
// 旧实现用有道英文接口（type=2）读中文，只返回约 0.1 秒静音，是"中文完全听不到"的根因
function speakZhAsync(text, rate) {
  var t = _zhAlbumText(text) || _zhSpeechText(text);
  if (!t) return Promise.resolve();
  // v2.77.0 按义项分段朗读，段间留自然停顿
  var chain = function () { return speakZhSegmentsAsync(t, rate || 1, listenSystemPlayerOn()); };
  if (_listenZhSourcePref() === 'net') return chain();
  if (!getZhTtsVoice()) return chain();
  // v2.63.0：听读模式中文系统语音 → TTS 伴侣模式，媒体卡片保持可控
  return speakTtsAsync(t, 'zh-CN', rate || 1, true).then(function (ok) {
    if (ok) return;
    return chain();
  });
}


// 按设置生成朗读步骤（英文遍数、中文遍数、顺序）
function buildListenSteps(cfg, enText, zhText) {
  var en = [], zh = [], i;
  for (i = 0; i < cfg.enRepeat; i++) en.push('en');
  if (cfg.zhRepeat > 0 && zhText) for (i = 0; i < cfg.zhRepeat; i++) zh.push('zh');
  if (cfg.order === 'zh-en') return zh.concat(en);
  if (cfg.order === 'en') return en;
  return en.concat(zh);
}

// 播放一个词条：逐遍朗读 + 遍间歇
async function playListenItemAsync(item, cfg, token, tokenRef) {
  var enText = String(item.term || '').trim();
  if (!enText) return;
  var zhText = item.meaning || '';
  try {
    if (window.NativePlayer && window.NativePlayer.setMeta) {
      window.NativePlayer.setMeta(enText, (_zhAlbumText(zhText) || _zhSpeechText(zhText)) || '高考词汇', '背群英 · 听读');
    } else if (window.NativePlayer && window.NativePlayer.setTitle) {
      window.NativePlayer.setTitle(enText + ' · ' + (_zhSpeechText(zhText) || ''));
    }
  } catch (e) {}
  var steps = buildListenSteps(cfg, enText, zhText);
  for (var i = 0; i < steps.length; i++) {
    if (token !== tokenRef.current) return;
    if (steps[i] === 'en') {
      await speakEnAsync(enText, cfg.rate);
    } else {
      // 修复 BUG4：中文不再只依赖系统 TTS（无中文引擎时整句静默），
      // 改为优先有道真人发音，失败/无音再回退系统 TTS
      await speakZhAsync(zhText, cfg.rate * 0.95);
    }
    if (token !== tokenRef.current) return;
    if (i < steps.length - 1) {
      await listenSleep(cfg.innerGap * 1000, token, tokenRef);
    }
  }
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

// 基于种子的稳定洗牌，相同种子产生相同顺序，避免进度更新时顺序跳变
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 标准化 term key（小写+去空格），确保不同词库中大小写/空格变体被视为同一单词
function termKey(term) { return (term || '').toLowerCase().trim(); }

/* ============================
   十、彩色标注工具
   ============================ */

function freqColor(freq) {
  if (freq === '高频' || freq === '985') return '#e11d48';
  if (freq === '必考' || freq === '真题') return '#ea580c';
  if (freq === '话题') return '#7c3aed';
  if (freq === '易错' || freq === '生义' || freq === '易混') return '#2563eb';
  if (freq === '褒贬') return '#0891b2';
  if (freq === '超纲') return '#a16207';
  if (freq === '逻辑' || freq === '主题') return '#4f46e5';
  return '#6b7280';
}

/* 词性颜色 */
function posColor(pos) {
  if (!pos) return '#6b7280';
  const p = pos.toLowerCase();
  if (p.startsWith('n.')) return '#2563eb';
  if (p.startsWith('vt.') || p.startsWith('vi.') || p.startsWith('v.')) return '#16a34a';
  if (p.startsWith('adj.')) return '#7c3aed';
  if (p.startsWith('adv.')) return '#ea580c';
  if (p.startsWith('prep.')) return '#0891b2';
  if (p.startsWith('conj.')) return '#a16207';
  if (p.startsWith('pron.')) return '#e11d48';
  return '#6b7280';
}

/* 单词状态颜色：错词红色，已掌握蓝色，默认不改变 */
function wordStatusColor(item, progress, wrongWords) {
  if (wrongWords.some(w => termKey(w.term) === termKey(item.term))) return '#ef4444';
  if (progress[termKey(item.term)] === 'mastered') return '#2563eb';
  return null; // 返回 null 表示使用默认颜色
}

/* ============================
   十一、主App组件
   ============================ */

/* v2.74.0：全应用统一图标集
   旧界面大量使用 emoji（🔊 📚 🎯 …）当图标：不同手机字体不同、颜色不受控、
   大小基线对不齐，整体看起来像「贴表情包」。这里换成同一套 24×24 线性图标，
   统一描边宽度、圆角端点、currentColor 跟随文字色。 */
const ICON_PATHS = {
  speaker: <><path d="M4 9.8v4.4h3.2L12 18.2V5.8L7.2 9.8H4Z" /><path d="M15 9.6a3.4 3.4 0 0 1 0 4.8" /><path d="M17.6 7.4a7 7 0 0 1 0 9.2" /></>,
  headphones: <><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="2.6" y="13.6" width="4" height="6.4" rx="2" /><rect x="17.4" y="13.6" width="4" height="6.4" rx="2" /></>,
  download: <><path d="M12 4v11" /><path d="m7.6 11.2 4.4 4.4 4.4-4.4" /><path d="M5 20h14" /></>,
  upload: <><path d="M12 20V9" /><path d="m7.6 12.8 4.4-4.4 4.4 4.4" /><path d="M5 4h14" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2.4-5.7" /><path d="M20 4.2V8.4h-4.2" /></>,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.4" /></>,
  note: <><path d="M6 3.5h8.5L19 8v12.5H6V3.5Z" /><path d="M14 3.5V8h5" /><path d="M9 12.2h6M9 15.8h4" /></>,
  link: <><path d="m9.6 14.4 4.8-4.8" /><path d="M8.4 11.6 6.6 13.4a3.6 3.6 0 0 0 5.1 5.1l1.8-1.8" /><path d="M15.6 12.4l1.8-1.8a3.6 3.6 0 0 0-5.1-5.1L10.5 7.3" /></>,
  leaf: <><path d="M20 4c0 9-5 13-11 13a5 5 0 0 1 0-10c4 0 6-3 11-3Z" /><path d="M4 20c2.2-4 5.2-6.2 9-7" /></>,
  pin: <><path d="M12 21v-6.4" /><path d="M8 3.5h8l-1.5 6 3.5 2.9v1.9H6v-1.9L9.5 9.5 8 3.5Z" /></>,
  bolt: <><path d="M13 3 5.5 14H11l-1 7 8-11h-5.5l.5-7Z" /></>,
  warn: <><path d="M12 4 3 20h18L12 4Z" /><path d="M12 10v3.6" /><circle cx="12" cy="16.8" r=".95" fill="currentColor" stroke="none" /></>,
  book: <><path d="M12 6.4C10.4 5 8.2 4.3 5.6 4.3H4.2v13.4h1.4c2.6 0 4.8.7 6.4 2.1 1.6-1.4 3.8-2.1 6.4-2.1h1.4V4.3h-1.4c-2.6 0-4.8.7-6.4 2.1Z" /><path d="M12 6.4v13.4" /></>,
  list: <><path d="M9 6.2h11M9 12h11M9 17.8h11" /><circle cx="4.6" cy="6.2" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.6" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="4.6" cy="17.8" r="1.3" fill="currentColor" stroke="none" /></>,
  phone: <><rect x="7" y="2.6" width="10" height="18.8" rx="2.6" /><path d="M10.8 18.4h2.4" /></>,
  chat: <><path d="M4 6.6A2.6 2.6 0 0 1 6.6 4h10.8A2.6 2.6 0 0 1 20 6.6v6.8a2.6 2.6 0 0 1-2.6 2.6H9.4L4 20V6.6Z" /></>,
  shield: <><path d="M12 3 5 6.2V12c0 4.2 3 7.2 7 9 4-1.8 7-4.8 7-9V6.2L12 3Z" /><path d="m9.2 12.1 2 2 3.6-3.8" /></>,
  globe: <><circle cx="12" cy="12" r="8.6" /><path d="M3.4 12h17.2" /><path d="M12 3.4c2.5 2.5 3.6 5.4 3.6 8.6S14.5 18.1 12 20.6C9.5 18.1 8.4 15.2 8.4 12S9.5 5.9 12 3.4Z" /></>,
  rocket: <><path d="M14.2 4.2c3 1 5.6 3.8 5.6 8.6l-3.6 2.8-5.4-5.4 3.4-6Z" /><path d="M9.6 11.2 5.6 15l3.4 3.4 3.8-4" /><path d="M6.2 18.2c-1 1-1.2 3.2-1.2 3.2s2.2-.2 3.2-1.2" /></>,
  grad: <><path d="M3 9.6 12 5l9 4.6-9 4.6L3 9.6Z" /><path d="M7.2 11.6V17c0 1.4 2.2 2.6 4.8 2.6s4.8-1.2 4.8-2.6v-5.4" /></>,
  fire: <><path d="M12 3.4c2.6 2.9 4.4 5.4 4.4 8.2a4.4 4.4 0 1 1-8.8 0c0-1.3.5-2.5 1.4-3.6.2 1.1.8 1.9 1.7 2.3-.4-2.4.4-4.6 1.3-6.9Z" /></>,
  quote: <><path d="M4.5 5.5h5.5v5.2H6.6c0 2.2 1 3.4 3 4.3" /><path d="M14 5.5h5.5v5.2h-3.4c0 2.2 1 3.4 3 4.3" /></>,
  bulb: <><path d="M9.4 18.2h5.2" /><path d="M10.4 21h3.2" /><path d="M12 3a5.9 5.9 0 0 0-3.5 10.7c.6.5.9 1.2.9 2h5.2c0-.8.3-1.5.9-2A5.9 5.9 0 0 0 12 3Z" /></>,
  check: <><path d="m5.2 12.4 4.6 4.6L18.8 8" /></>,
  chevronLeft: <><path d="m14.4 6.2-5.8 5.8 5.8 5.8" /></>,
  chevronRight: <><path d="m9.6 6.2 5.8 5.8-5.8 5.8" /></>,
  chevronDown: <><path d="m6.2 9.6 5.8 5.8 5.8-5.8" /></>,
  play: <><path d="M8.4 5.4 18.4 12 8.4 18.6V5.4Z" /></>,
  pause: <><rect x="7" y="5" width="3.6" height="14" rx="1.3" /><rect x="13.4" y="5" width="3.6" height="14" rx="1.3" /></>,
  sparkle: <><path d="M12 3.4 13.8 9l5.6 1.8-5.6 1.8L12 18.4l-1.8-5.8L4.6 10.8 10.2 9 12 3.4Z" /><path d="M18.6 15.6l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" /></>,
  trash: <><path d="M5 7.2h14" /><path d="M9.4 7.2V5.2h5.2v2" /><path d="M6.8 7.2 8 20h8l1.2-12.8" /></>,
  close: <><path d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6" /></>,
  sliders: <><path d="M4 7.4h8.6M18 7.4h2M4 16.6h3.4M12.6 16.6H20" /><circle cx="15.2" cy="7.4" r="2.2" /><circle cx="10" cy="16.6" r="2.2" /></>,
  clock: <><circle cx="12" cy="12" r="8.6" /><path d="M12 7v5.4l3.4 2" /></>,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.6" /><circle cx="12" cy="7.9" r=".95" fill="currentColor" stroke="none" /></>,
  folder: <><path d="M3.4 6.8A1.9 1.9 0 0 1 5.3 4.9h3.8l2 2.4h7.6a1.9 1.9 0 0 1 1.9 1.9v7.9a1.9 1.9 0 0 1-1.9 1.9H5.3a1.9 1.9 0 0 1-1.9-1.9V6.8Z" /></>,
  scissors: <><circle cx="6.4" cy="6.4" r="2.3" /><circle cx="6.4" cy="17.6" r="2.3" /><path d="M8.4 7.9 19 17.6M8.4 16.1 19 6.4" /></>,
  music: <><path d="M9 17.4V6l10-2v11.4" /><circle cx="6.6" cy="17.8" r="2.4" /><circle cx="16.6" cy="15.8" r="2.4" /></>,
  shuffle: <><path d="M4 7h3.4l8 10H19" /><path d="m16.6 14 2.6 3-2.6 3" /><path d="M4 17h3.4l2.2-2.8" /><path d="m16.6 4 2.6 3-2.6 3" /></>,
  bell: <><path d="M8.4 17V11a3.6 3.6 0 0 1 7.2 0v6" /><path d="M5.2 17h13.6" /><path d="M10.4 20h3.2" /></>,
  bellOff: <><path d="M8.4 17V11a3.6 3.6 0 0 1 5.4-3.1" /><path d="M5.2 17h13.6" /><path d="M10.4 20h3.2" /><path d="m4 4 16 16" /></>,
  search: <><circle cx="11" cy="11" r="6.6" /><path d="m15.8 15.8 4.4 4.4" /></>,
  folder: <><path d="M3.4 6.6A1.8 1.8 0 0 1 5.2 4.8h4l1.8 2.4h7.8a1.8 1.8 0 0 1 1.8 1.8v9.2a1.8 1.8 0 0 1-1.8 1.8H5.2a1.8 1.8 0 0 1-1.8-1.8V6.6Z" /></>,
  info: <><circle cx="12" cy="12" r="8.6" /><path d="M12 11v5.4" /><circle cx="12" cy="7.8" r=".95" fill="currentColor" stroke="none" /></>,
  prev: <><path d="M18 5.6 8.6 12 18 18.4V5.6Z" /><path d="M5.6 5.6v12.8" /></>,
  next: <><path d="M6 5.6 15.4 12 6 18.4V5.6Z" /><path d="M18.4 5.6v12.8" /></>,
  clipboard: <><rect x="6" y="4.6" width="12" height="16" rx="2.2" /><path d="M9.4 4.6V3.3h5.2v1.3" /><path d="M9 10h6M9 14h4" /></>,
  file: <><path d="M6.6 3.4h6.9L18 8v12.6H6.6V3.4Z" /><path d="M13.2 3.4V8h4.8" /><path d="M9.2 12.6h5M9.2 16h3.4" /></>,
  image: <><rect x="3.6" y="5" width="16.8" height="14" rx="2.4" /><circle cx="8.5" cy="9.7" r="1.5" /><path d="m4.8 17 4.6-4.4 3.3 3.1 2.8-2.5 3.9 3.8" /></>
};

function Icon({ name, size, className, style }) {
  const p = ICON_PATHS[name];
  if (!p) return null;
  const s = size ? { width: size, height: size } : null;
  return (
    <svg viewBox="0 0 24 24" className={'ic' + (className ? ' ' + className : '')}
      style={s ? { ...(style || {}), ...s } : style}
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {p}
    </svg>
  );
}

const LearnIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
);

const WrongIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>
);

const LibraryIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

const ExtendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const ImportIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const MeIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const ListenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

const TABS = [
  { id: 'learn', label: '背诵', icon: LearnIcon },
  { id: 'listen', label: '听读', icon: ListenIcon },
  { id: 'library', label: '词库', icon: LibraryIcon },
  { id: 'wrong', label: '错词本', icon: WrongIcon },
  { id: 'extend', label: '扩展', icon: ExtendIcon },
  { id: 'import', label: '导入', icon: ImportIcon },
  { id: 'me', label: '我的', icon: MeIcon },
];

// v2.69.0 轮盘取值网格（模块级常量，避免每次渲染重建导致滚轮跳动）
const WHEEL_RATE = (function () { const a = []; for (let v = 0.5; v <= 2.001; v += 0.05) a.push(Math.round(v * 100) / 100); return a; })();
const WHEEL_EN_REPEAT = [1, 2, 3, 4, 5];
const WHEEL_ZH_REPEAT = [0, 1, 2, 3];
const WHEEL_WORD_GAP = (function () { const a = []; for (let v = 0; v <= 10.001; v += 0.5) a.push(Math.round(v * 10) / 10); return a; })();
const WHEEL_INNER_GAP = (function () { const a = []; for (let v = 0; v <= 3.001; v += 0.1) a.push(Math.round(v * 10) / 10); return a; })();
const WHEEL_SPEAK_RATE = (function () { const a = []; for (let v = 0.5; v <= 1.501; v += 0.02) a.push(Math.round(v * 100) / 100); return a; })();

/* ============================
   v2.70.0 轮盘选择器（WheelPicker）—— 横向版
   左右滑动 + 自动吸附，用于听读参数等连续数值的自定义调节。
   纯 React + touch 实现，无第三方依赖，旧 WebView 兼容。
   ============================ */
function WheelPicker(props) {
  const ITEM_W = 64;
  const values = props.values || [];
  const value = props.value;
  const onChange = props.onChange || function () {};
  const fmt = props.format || function (v) { return String(v); };
  const idx = Math.max(0, values.indexOf(value));
  const [off, setOff] = React.useState(idx * ITEM_W);
  const [dragging, setDragging] = React.useState(false);
  const drag = React.useRef(null);
  // 容器实测宽度 → 选中项应停留的水平中心
  const boxRef = React.useRef(null);
  const [bw, setBw] = React.useState(0);
  React.useEffect(function () {
    try { setBw(boxRef.current ? boxRef.current.offsetWidth : 0); } catch (_) { setBw(0); }
    function onRz() { try { setBw(boxRef.current ? boxRef.current.offsetWidth : 0); } catch (_) {} }
    window.addEventListener('resize', onRz);
    return function () { window.removeEventListener('resize', onRz); };
  }, []);
  const center = bw > 0 ? (bw - ITEM_W) / 2 : 0;

  // 外部值变化（如重置）时同步滚轮位置
  React.useEffect(function () {
    const i = values.indexOf(value);
    if (i >= 0) setOff(i * ITEM_W);
  }, [value, values]);

  function snapTo(px) {
    const max = (values.length - 1) * ITEM_W;
    let t = Math.round(px / ITEM_W) * ITEM_W;
    t = Math.max(0, Math.min(max, t));
    setOff(t);
    const ni = Math.round(t / ITEM_W);
    const nv = values[ni];
    if (nv !== undefined && nv !== value) onChange(nv);
  }

  function onStart(x) {
    drag.current = { x0: x, off0: off, moved: false };
    setDragging(true);
  }
  function onMove(x) {
    if (!drag.current) return;
    const d = drag.current;
    if (Math.abs(x - d.x0) > 4) d.moved = true;
    const min = -ITEM_W, max = (values.length - 1) * ITEM_W + ITEM_W;
    setOff(Math.max(min, Math.min(max, d.off0 + (d.x0 - x))));
  }
  function onEnd() {
    if (!drag.current) return;
    const cur = drag.current;
    drag.current = null;
    setDragging(false);
    if (cur.moved) snapTo(off);
  }

  return (
    <div
      ref={boxRef}
      className={'wheelPicker' + (props.compact ? ' compact' : '')}
      style={{ width: (typeof props.width === 'number') ? (props.width + 'px') : (props.width || '100%'), visibility: bw > 0 ? 'visible' : 'hidden' }}
      onTouchStart={function (e) { onStart(e.touches[0].clientX); }}
      onTouchMove={function (e) { e.preventDefault(); onMove(e.touches[0].clientX); }}
      onTouchEnd={onEnd}
      onTouchCancel={onEnd}
      onMouseDown={function (e) { onStart(e.clientX); }}
      onMouseMove={function (e) { if (drag.current) onMove(e.clientX); }}
      onMouseUp={onEnd}
      onMouseLeave={onEnd}
    >
      <div className="wheelHighlight" />
      <div
        className="wheelStrip"
        style={{
          transform: 'translateX(' + (center - off) + 'px)',
          transition: dragging ? 'none' : 'transform 0.22s ease-out',
        }}
      >
        {values.map(function (v, i) {
          const dist = Math.abs(off / ITEM_W - i);
          const op = Math.max(0.18, 1 - dist * 0.34);
          const sc = Math.max(0.82, 1 - dist * 0.07);
          return (
            <div
              key={String(v)}
              className={'wheelItem' + (v === value ? ' on' : '')}
              style={{ width: ITEM_W, opacity: op, transform: 'scale(' + sc + ')' }}
              onClick={function () { if (!drag.current || !drag.current.moved) { setOff(i * ITEM_W); if (v !== value) onChange(v); } }}
            >
              {fmt(v)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// v2.70.0 应用内下拉选择器：替代系统 <select> 弹窗（系统弹窗在部分机型上字体巨大、
// 图标遮挡，无法定制样式）。点击展开应用内浮层列表，点遮罩收起，旧 WebView 兼容。
function InlineSelect(props) {
  const [open, setOpen] = React.useState(false);
  const options = props.options || [];
  const value = props.value;
  const onChange = props.onChange || function () {};
  let cur = null;
  for (let i = 0; i < options.length; i++) { if (options[i].value === value) { cur = options[i]; break; } }
  return (
    <span className={'inlineSelect' + (props.block ? ' block' : '')} style={props.style}>
      <button type="button" className="inlineSelectBtn" onClick={function () { setOpen(!open); }}>
        <span className="inlineSelectVal">{cur ? cur.label : (props.placeholder || '请选择')}</span>
        <span className="inlineSelectCaret"><Icon name="chevronDown" className={open ? 'caretUp' : ''} /></span>
      </button>
      {open && (
        <React.Fragment>
          {/* v2.77.0 修复「点空白处关不掉」：
              下拉被包在 <label> 里，点遮罩后 label 的默认行为会把这次点击再转发给
              内部按钮，等于又触发一次 toggle —— 看起来就是关不上。
              必须在遮罩这一层 preventDefault，掐掉 label 的转发。 */}
          <div className="inlineSelectMask" onClick={function (e) {
            if (e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }
            setOpen(false);
          }} />
          <div className="inlineSelectMenu" role="listbox">
            {options.map(function (o) {
              return (
                <button
                  type="button"
                  key={String(o.value)}
                  className={'inlineSelectItem' + (o.value === value ? ' on' : '')}
                  onClick={function (e) {
                    // 同上：选项按钮也在 <label> 内，不掐掉 label 的转发会被再次 toggle 回来
                    if (e) { if (e.preventDefault) e.preventDefault(); if (e.stopPropagation) e.stopPropagation(); }
                    setOpen(false);
                    if (o.value !== value) onChange(o.value);
                  }}
                >
                  <span className="inlineSelectLabel">{o.label}</span>
                  <span className="inlineSelectTick"><span className={'pickDot' + (o.value === value ? ' on' : '')} /></span>
                </button>
              );
            })}
          </div>
        </React.Fragment>
      )}
    </span>
  );
}

// v2.77.0 释义分段显示：多义项之间拉出可见间距
// 旧实现把「放弃，抛弃；放任，无拘束」整串直接铺开，两个义项首尾相接、
// 视觉上连成一句，读起来像漏了标点。这里按 '；' 拆成独立片段，
// 片段之间用 10px 间距，换行时也能自然断开。
function Meanings(props) {
  var text = String(props.text || '');
  if (text.indexOf('；') < 0) return <span className={props.className || ''}>{text}</span>;
  var parts = text.split('；').filter(function (s) { return String(s).trim(); });
  return (
    <span className={'mnList' + (props.className ? ' ' + props.className : '')}>
      {parts.map(function (p, i) {
        return (
          <span className="mnItem" key={i}>
            {String(p).trim()}{i < parts.length - 1 ? '；' : ''}
          </span>
        );
      })}
    </span>
  );
}

// v2.69.0 全局错误边界：任何渲染异常不再白屏，给出错误摘要与一键重载
class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { err: null };
  }
  static getDerivedStateFromError(e) {
    try { window.__lastFatalError = (e && (e.message || String(e))) || 'unknown'; } catch (_) {}
    return { err: e };
  }
  render() {
    if (this.state.err) {
      const msg = (this.state.err && (this.state.err.message || String(this.state.err))) || '未知错误';
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}><Icon name="warn" size={40} /></div>
          <h2 style={{ fontSize: 18, margin: '0 0 8px' }}>界面出现异常</h2>
          <p style={{ fontSize: 13, color: '#6b7280', wordBreak: 'break-all', margin: '0 0 20px' }}>{msg}</p>
          <button className="primary" style={{ padding: '10px 32px' }} onClick={function () { try { localStorage.setItem('gaokao_last_error', msg); } catch (_) {} location.reload(); }}>重载应用</button>
          <div style={{ marginTop: 14 }}>
            <button style={{ padding: '8px 20px', fontSize: 13 }} onClick={function () {
              try {
                localStorage.removeItem(LISTEN_CFG_KEY);
                localStorage.removeItem('gaokao_settings');
                localStorage.setItem('gaokao_last_error', 'cleared: ' + msg);
              } catch (_) {}
              location.reload();
            }}>重置听读与设置后重载</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [books, setBooks] = useState(loadBooks);
  /* v2.79.0：内置词库数据是分片异步到达的（首屏不下载词库）。
     到一片就做两件事：
       ① setBooks(prev => prev.slice()) 顶一下数组引用 —— 让 learnItems / 词库计数
          这些依赖 books 的 useMemo 重算；
       ② bookDataVersion +1 —— 给"只依赖 progress"的 useEffect（已掌握词库重建）
          一个额外的重算理由，否则老用户带着进度进来会看到空的已掌握词库。 */
  const [bookDataVersion, setBookDataVersion] = useState(0);
  useEffect(() => onBookData(() => {
    setBookDataVersion(function (v) { return v + 1; });
    setBooks(prev => prev.slice());
  }), []);
  // 背诵页词库选择（独立）
  const [studyBookIds, setStudyBookIds] = useState(() => {
    try {
      const saved = localStorage.getItem('gaokao_study_books');
      return saved ? saved.split(',') : ['gaokao-3500'];
    }
    catch { return ['gaokao-3500']; }
  });
  // 词库页词库选择（独立）
  const [libraryBookIds, setLibraryBookIds] = useState(() => {
    try {
      const saved = localStorage.getItem('gaokao_library_books');
      return saved ? saved.split(',') : ['gaokao-3500'];
    }
    catch { return ['gaokao-3500']; }
  });
  // v2.62.0：记住上次所在页面，热更新 / 刷新后自动回到原页面，不再"无故跳回首页"
  const [section, setSection] = useState(() => {
    try {
      const v = localStorage.getItem('gaokao_section');
      return (v && TABS.some(t => t.id === v)) ? v : 'learn';
    } catch (e) { return 'learn'; }
  });
  useEffect(() => {
    try { localStorage.setItem('gaokao_section', section); } catch (e) {}
  }, [section]);
  // 供原生判断"是否正忙"：听读播放中时热更新延后到下次启动，避免播放被打断
  useEffect(() => {
    try { window.__listenBusy = function () { return !!listenPlayingRef.current; }; } catch (e) {}
  }, []);
  // v2.76.0 应用内提示卡片（替代 alert，避免 WebView 的「网址为 file://」原生标题）
  const [tipMsg, setTipMsg] = useState(null);
  useEffect(() => {
    _appTipSink = function (text, title, ms) {
      setTipMsg({ text: text, title: title });
      if (_appTipTimer) { clearTimeout(_appTipTimer); _appTipTimer = null; }
      if (ms > 0) { _appTipTimer = setTimeout(function () { setTipMsg(null); }, ms); }
    };
    return function () { _appTipSink = null; };
  }, []);

  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showBookPicker2, setShowBookPicker2] = useState(false);

  // ===== 听读模式（音乐播放器式）状态 =====
  const [listenBookIds, setListenBookIds] = useState(() => {
    try { const s = localStorage.getItem(LISTEN_BOOKS_KEY); return s ? s.split(',') : ['gaokao-3500']; }
    catch { return ['gaokao-3500']; }
  });
  // v2.62.0：真实播放进度（系统播放器模式下有准确时长，可拖动）
  const [listenPos, setListenPos] = useState(0);
  const [listenDur, setListenDur] = useState(0);
  // v2.65.0：整库音频合成进度提示（"合成中 x/y"，完成后清空）
  const [listenBuildInfo, setListenBuildInfo] = useState('');
  // v2.74.0：系统播放状态诊断（通知被关 / 实际使用的中文语音引擎）
  const [mediaBlocked, setMediaBlocked] = useState('');
  const [ttsEngine, setTtsEngine] = useState('');
  // v2.75.0 高清中文语音包状态（原生回传 zhpack:xxx）
  const [zhPack, setZhPack] = useState('');
  // v2.77.0 离线语音改为可选：默认关闭，中文走云端；这里保存开关与占用
  const [zhOffline, setZhOffline] = useState(false);
  const [zhBytes, setZhBytes] = useState(0);
  const [zhCount, setZhCount] = useState(0);
  // v2.62.0：MP3 下载面板
  const [mp3Count, setMp3Count] = useState(50);
  const [mp3WithZh, setMp3WithZh] = useState(true);
  /* v2.76.0 MP3 下载自定义参数：起始序号 / 条数 / 语速 / 文件名 / 保存目录
     旧版只给「20/50/100/300/全部」五档，用户无法只导出第 200~260 词，也无法命名与选目录。 */
  const [mp3Start, setMp3Start] = useState(1);
  const [mp3CustomCount, setMp3CustomCount] = useState('');
  const [mp3Rate, setMp3Rate] = useState(null);          // null = 跟随听读语速
  const [mp3Name, setMp3Name] = useState('');
  const [mp3Dir, setMp3Dir] = useState('');              // 自定义保存目录显示名（空 = 默认）
  const [mp3SaveScope, setMp3SaveScope] = useState('both'); // both | en | zh
  const [mp3Busy, setMp3Busy] = useState(false);
  const [mp3State, setMp3State] = useState(null);

  /* v2.77.0 离线语音：默认关闭，中文朗读走云端；只有用户主动开启才下载离线包。
     这样既避免 16MB 语音包常驻，又能在断网时兜底。 */
  const refreshZhOffline = function () {
    try {
      var nv = window.NativeVoice;
      if (!nv) return;
      if (nv.offlineEnabled) { try { setZhOffline(!!nv.offlineEnabled()); } catch (e) {} }
      if (nv.offlineBytes) { try { setZhBytes(Number(nv.offlineBytes()) || 0); } catch (e) {} }
      if (nv.count) { try { setZhCount(Number(nv.count()) || 0); } catch (e) {} }
    } catch (e) {}
  };
  React.useEffect(function () {
    if (section !== 'me') return;
    refreshZhOffline();
  }, [section, zhPack]);

  function toggleZhOffline() {
    try {
      var nv = window.NativeVoice;
      if (!nv || !nv.setOffline) { appTip('离线语音需要安装版才能使用。', '离线语音'); return; }
      var next = !zhOffline;
      nv.setOffline(next);
      setZhOffline(next);
      if (next) {
        var started = nv.requestOffline ? nv.requestOffline() : false;
        setZhPack(started ? 'downloading:1/3' : 'queued');
        if (!started) appTip('已开启。开始播放后会自动下载离线包（约 16MB，仅首次）。', '离线语音');
      } else {
        setZhPack('');
        setZhBytes(0);
        setZhCount(0);
        appTip('已关闭，离线语音已删除，空间已释放。中文改为从云端获取。', '离线语音');
      }
      refreshZhOffline();
    } catch (e) {}
  }

  function downloadZhOffline() {
    try {
      var nv = window.NativeVoice;
      if (!nv) return;
      if (!zhOffline && nv.setOffline) { nv.setOffline(true); setZhOffline(true); }
      var started = nv.requestOffline ? nv.requestOffline() : false;
      setZhPack(started ? 'downloading:1/3' : 'queued');
      appTip(started ? '已开始下载，进度显示在这里。' : '已排队，开始播放时会自动下载。', '离线语音');
      refreshZhOffline();
    } catch (e) {}
  }

  function clearZhOfflineFiles() {
    try {
      var nv = window.NativeVoice;
      if (nv && nv.setOffline) nv.setOffline(false);
      if (nv && nv.clearOffline) nv.clearOffline();
      setZhOffline(false);
      setZhPack('');
      setZhBytes(0);
      setZhCount(0);
      appTip('离线语音已删除，空间已释放。', '离线语音');
      refreshZhOffline();
    } catch (e) {}
  }
  // v2.62.0：词库导出（txt，供百词斩等 App 导入）
  const [showExport, setShowExport] = useState(false);
  const [exportScope, setExportScope] = useState('book');
  // v2.72.0：分隔方式可选空格 / Tab / 逗号 / 分号 / 自定义 / 仅单词
  const [exportSep, setExportSep] = useState('space');
  const [exportSepCustom, setExportSepCustom] = useState(' | ');
  const [exportMsg, setExportMsg] = useState('');
  // all=全部 hide=隐藏已掌握 only=仅已掌握
  const [listenFilter, setListenFilter] = useState(() => {
    try {
      const v = localStorage.getItem(LISTEN_FILTER_KEY);
      return (v === 'all' || v === 'only') ? v : 'hide';
    } catch { return 'hide'; }
  });
  const [listenCfg, setListenCfg] = useState(loadListenCfg);
  const [listenIndex, setListenIndex] = useState(0);
  const [listenPlaying, setListenPlaying] = useState(false);
  // v2.61.0：真正的「暂停」状态（与 listenPlaying 独立，暂停时仍视为一次播放会话）
  const [listenPaused, setListenPaused] = useState(false);
  /* v2.76.0 听读面板改为互斥单值状态：
     旧实现是 4 个独立布尔，点「参数」再点「列表」会两张面板同时展开、列表被挤到参数下面，
     用户看到的是「列表在参数下面」而不是替换。现在同一时刻只允许一个面板展开，
     点另一个按钮自动关闭前一个，再点同一按钮关闭自己（同时作为退出入口）。 */
  const [listenPanel, setListenPanel] = useState(null); // 'cfg' | 'speed' | 'pl' | 'mp3' | 'books' | null
  const listenShowCfg = listenPanel === 'cfg';
  const listenShowSpeed = listenPanel === 'speed';
  const listenShowPL = listenPanel === 'pl';
  const listenShowMp3 = listenPanel === 'mp3';
  const listenShowBooks = listenPanel === 'books';
  function toggleListenPanel(name) { setListenPanel(function (p) { return p === name ? null : name; }); }
  const listenTokenRef = useRef(0);          // 播放代次：自增即取消旧循环
  const listenCfgRef = useRef(listenCfg);
  const listenQueueRef = useRef([]);         // 当前播放队列快照（播放中不随进度变化跳动）
  const listenIndexRef = useRef(0);
  const listenPlayingRef = useRef(false);
  const listenPlRef = useRef(null);      // v2.66.0：词列表容器
  const listenPlCurRef = useRef(null);   // v2.66.0：列表中的当前词节点（用于居中滚动）
  const listenPausedRef = useRef(false);
  const listenSeedRef = useRef(Date.now());
  // 词性筛选（替代原来的type筛选）
  const [posFilter, setPosFilter] = useState('全部');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [hideMastered, setHideMastered] = useState(() => {
    try { return localStorage.getItem('gaokao_hide_mastered') !== 'false'; }
    catch { return true; }
  });
  // 用户隐藏的词库 ID 列表
  const [hiddenBookIds, setHiddenBookIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gaokao_hidden_books') || '[]'); }
    catch { return []; }
  });
  const [practiceMode, setPracticeMode] = useState(() => loadSettings().mode || 'en-to-cn');
  const [detailMode, setDetailMode] = useState('brief');
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [selected, setSelected] = useState('');
  const [autoJumping, setAutoJumping] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  // v2.68.0 百词斩同步导出（v2.70.0 并入词库导出面板）：按 500 词/批复制为「英文逗号分隔单词串」
  const [bcBatch, setBcBatch] = useState(0);
  // v2.67.0：本机安装包的真实版本（决定是否真的需要装新 APK）
  const [pkgVer, setPkgVer] = useState(() => ({ code: nativePkgVersionCode(), name: nativePkgVersionName() }));
  const refreshPkgVer = () => setPkgVer({ code: nativePkgVersionCode(), name: nativePkgVersionName() });
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showBrowserFallback, setShowBrowserFallback] = useState(false);
  // 静默自动更新相关状态
  const [downloadedApkUrl, setDownloadedApkUrl] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [apkDownloadProgress, setApkDownloadProgress] = useState(0);
  const [inAppDownloading, setInAppDownloading] = useState(false);
  const [inAppDownloadError, setInAppDownloadError] = useState('');
  const [updateChangelog, setUpdateChangelog] = useState('');
  const [updateVersion, setUpdateVersion] = useState('');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementData, setAnnouncementData] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    try { return localStorage.getItem('gaokao_dismissed_version') || ''; }
    catch { return ''; }
  });
  const updateCheckDone = useRef(false);
  // v2.73.0：更新动作互斥锁（原生侧另有原子锁，这里先挡一层，避免连点并发下载写坏临时文件）
  const apkUpdateLockRef = useRef(false);
  const shuffleSeedRef = useRef(Date.now()); // 洗牌种子：仅词库变化时更新，进度变化时保持稳定
  const extendScrollRef = useRef(0); // 拓展页滚动位置记忆
  const prevSectionRef = useRef('learn'); // 记录上一个页面，用于滚动位置恢复
  const [search, setSearch] = useState('');
  // v2.70.0 搜索防抖：输入即时回显，检索按防抖值计算，避免每敲一键全树重渲染导致卡顿
  const [searchDebounced, setSearchDebounced] = useState('');
  React.useEffect(function () {
    const t = setTimeout(function () { setSearchDebounced(search); }, 250);
    return function () { clearTimeout(t); };
  }, [search]);
  const [libraryLimit, setLibraryLimit] = useState(60); // 词库页懒加载条数
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const [importTargetBookId, setImportTargetBookId] = useState(null); // 导入目标词库
  const [aiConfig, setAiConfig] = useState(loadAiConfig);
  const [progress, setProgress] = useState(loadProgress);
  // progress 的 ref，用于在事件处理函数中同步访问最新值
  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);
  const [settings, setSettings] = useState(loadSettings);
  const [studyLog, setStudyLog] = useState(loadStudyLog);
  const [studyWordsLog, setStudyWordsLog] = useState(loadStudyWordsLog);
  const [wrongWords, setWrongWords] = useState(loadWrongWords);
  // 扩展页面的子tab
  const [extendTab, setExtendTab] = useState('affix');
  // 温习功能
  const [showReview, setShowReview] = useState(false);
  const [reviewDate, setReviewDate] = useState(getToday());
  const [reviewMode, setReviewMode] = useState('list'); // 'list' or 'practice'
  const [reviewIndex, setReviewIndex] = useState(0);
  const [reviewShowBack, setReviewShowBack] = useState(false);
  const [reviewSelected, setReviewSelected] = useState('');
  const [affixTab, setAffixTab] = useState('prefix');
  const [showAffixWords, setShowAffixWords] = useState({});
  const [compareTab, setCompareTab] = useState('synonym');
  const [compareIndex, setCompareIndex] = useState(0);
  const [numberDateSubTab, setNumberDateSubTab] = useState('months');
  const [transformTab, setTransformTab] = useState('adjToAdverb');
  const [spellingSearch, setSpellingSearch] = useState('');
  const [scenePage, setScenePage] = useState(0);
  // 词库详情
  const [detailItem, setDetailItem] = useState(null);
  // 详情弹窗导航历史栈（点击关联词跳转后，关闭返回上一个而非全部关闭）
  const [detailHistory, setDetailHistory] = useState([]);
  // 打开详情弹窗（如果当前已有详情，则将当前详情压入历史栈）
  function openDetailItem(item) {
    if (detailItem) {
      const prevItem = detailItem;
      setDetailHistory(h => [...h, prevItem]);
    }
    setDetailItem(item);
  }
  // 关闭详情弹窗（如果有历史记录则返回上一个，否则完全关闭）
  function closeDetailItem() {
    if (detailHistory.length > 0) {
      const prev = detailHistory[detailHistory.length - 1];
      setDetailHistory(h => h.slice(0, -1));
      setDetailItem(prev);
    } else {
      setDetailItem(null);
    }
  }
  // 正确率统计
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  // AI配置折叠
  const [showAiBox, setShowAiBox] = useState(false);
  // 联网关联词检查状态
  const [familyCheckStatus, setFamilyCheckStatus] = useState('');
  const [familyChecking, setFamilyChecking] = useState(false);
  // 反馈弹窗（仅APP使用，网页版不渲染）
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackType, setFeedbackType] = useState('suggest');
  const [feedbackStatus, setFeedbackStatus] = useState('');

  // 自定义头像
  const [avatarUrl, setAvatarUrl] = useState(() => {
    try { return localStorage.getItem('gaokao_avatar') || ''; }
    catch { return ''; }
  });
  // 首次使用日期
  const [firstUseDate] = useState(() => {
    try { return localStorage.getItem('gaokao_first_use') || getToday(); }
    catch { return getToday(); }
  });
  // 确保首次使用日期被记录
  useMemo(() => {
    try { if (!localStorage.getItem('gaokao_first_use')) localStorage.setItem('gaokao_first_use', getToday()); } catch {}
  }, []);

  /* v2.76.0 返回键：原生把返回键交给本函数，返回 'handled' 表示「已处理，别退出」。
     顺序按可视层级从高到低：提示卡 → 弹窗 → 听读面板 → 子页面 → 主页面。
     旧版本没有任何处理，SPA 单页 canGoBack() 恒为 false，于是按一下返回就直接退出应用。 */
  useEffect(() => {
    window.__appBack = function () {
      try {
        if (tipMsg) { setTipMsg(null); return 'handled'; }
        if (showFeedback) { setShowFeedback(false); return 'handled'; }
        if (showExport) { setShowExport(false); return 'handled'; }
        if (showInstallPrompt) { setShowInstallPrompt(false); return 'handled'; }
        if (showBrowserFallback) { setShowBrowserFallback(false); return 'handled'; }
        if (showAnnouncementModal) { setShowAnnouncementModal(false); return 'handled'; }
        if (updateInfo) { setUpdateInfo(null); return 'handled'; }
        if (detailItem) { closeDetailItem(); return 'handled'; }
        if (showBookPicker) { setShowBookPicker(false); return 'handled'; }
        if (showBookPicker2) { setShowBookPicker2(false); return 'handled'; }
        if (showReview) { setShowReview(false); return 'handled'; }
        if (listenPanel) { setListenPanel(null); return 'handled'; }
        if (section !== 'learn') { setSection('learn'); return 'handled'; }
      } catch (e) {}
      return '';
    };
    return function () { window.__appBack = null; };
  }, [tipMsg, showFeedback, showExport, showInstallPrompt, showBrowserFallback,
      showAnnouncementModal, updateInfo, detailItem, showBookPicker, showBookPicker2,
      showReview, listenPanel, section]);

  // v2.76.0 自定义保存目录：原生选择完成后回传显示名
  useEffect(() => {
    try {
      if (window.NativeSaver && typeof window.NativeSaver.label === 'function') {
        var lb = String(window.NativeSaver.label() || '');
        if (lb) setMp3Dir(lb);
      }
    } catch (e) {}
    window.__saveDirChanged = function (label) { try { setMp3Dir(String(label || '')); } catch (e) {} };
    return function () { window.__saveDirChanged = null; };
  }, []);

  // 启动时清理过期的温习记录（保留最近90天）
  useEffect(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    setStudyWordsLog(prev => {
      const next = {};
      let changed = false;
      Object.entries(prev).forEach(([date, words]) => {
        if (date >= cutoffStr) next[date] = words;
        else changed = true;
      });
      if (changed) saveStudyWordsLog(next);
      return changed ? next : prev;
    });
  }, []);

  // 启动时自动清理已删除词库的引用（如旧的 synonym/antonym 词库）
  useEffect(() => {
    const validIds = books.map(b => b.id);
    const removed = ['gaokao-synonym', 'gaokao-antonym'];
    let needClean = false;
    // 清理背诵页
    const newStudy = studyBookIds.filter(id => validIds.includes(id) || id === 'wrong-words' || !removed.includes(id));
    if (newStudy.length !== studyBookIds.length) { setStudyBookIds(newStudy); try { localStorage.setItem('gaokao_study_books', newStudy.join(',')); } catch {} needClean = true; }
    // 清理词库页
    const newLibrary = libraryBookIds.filter(id => validIds.includes(id) || !removed.includes(id));
    if (newLibrary.length !== libraryBookIds.length) { setLibraryBookIds(newLibrary); try { localStorage.setItem('gaokao_library_books', newLibrary.join(',')); } catch {} needClean = true; }
  }, []); // 仅启动时执行一次

  // APP启动时自动检查更新（仅原生APP且仅首次）
  useEffect(() => {
    if (isNativeApp && !updateCheckDone.current) {
      updateCheckDone.current = true;
      // 延迟2秒检查，避免影响启动性能
      const timer = setTimeout(() => {
        checkCloudUpdate(true); // silent = true
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  // 网页版启动时自动检查更新（静默更新HTML内容，保留localStorage）
  useEffect(() => {
    // 用 file:// 直接打开本地单文件时 fetch 会被 CORS 挡下，必然失败还会留下
    // 两条控制台错误；真实 App 走 isNativeApp 分支，本来也不做网页版更新检查。
    if (!isNativeApp && !isFileProtocol && !updateCheckDone.current) {
      updateCheckDone.current = true;
      const timer = setTimeout(async () => {
        try {
          const resp = await fetch('app-update.json?v=' + Date.now());
          if (!resp.ok) return;
          const data = await resp.json();
          if (data.version && data.version !== APP_VERSION && data.webHtmlUrl) {
            console.log('[Web Update] 发现新版本:', data.version, '当前:', APP_VERSION);
            // v2.72.1：Gitee 镜像随构建更新且国内直连（实测 3 秒），置首；
            // 并校验正文里的 APP_VERSION 必须等于清单版本，避免任何 CDN 缓存导致「更新到旧页面」
            const htmlSources = [
              'https://gitee.com/xdbzys/app/raw/master/web/index.html',
              data.webHtmlUrl,
              'https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/web/index.html',
              'https://github.com/xdbzys/gaokao-vocab/releases/latest/download/index.html'
            ].filter(Boolean);
            let newHtml = null;
            for (let si = 0; si < htmlSources.length; si++) {
              try {
                const r = await fetch(htmlSources[si], { cache: 'no-store' });
                if (r.ok) {
                  const t = await r.text();
                  if (!t || !(t.includes('<!doctype') || t.includes('<html'))) continue;
                  // 版本闸门：构建产物会压缩变量名（APP_VERSION → Is），所以两条都试：
                  // ① 能匹配到 APP_VERSION 赋值就严格比对；② 匹配不到则要求正文出现该版本号字面量。
                  // 任一不满足即视为陈旧页面，换下一个源，避免「更新到旧页面」。
                  const vm = /APP_VERSION\s*=\s*['"]([\d.]+)['"]/.exec(t);
                  const want = String(data.version || '');
                  const hasVer = want && (t.indexOf('"' + want + '"') >= 0 || t.indexOf("'" + want + "'") >= 0);
                  if (vm) { if (vm[1] !== want) continue; }
                  else if (want && !hasVer) continue;
                  newHtml = t;
                  break;
                }
              } catch (e) { /* 该源失败，尝试下一个 */ }
            }
            if (newHtml) {
              console.log('[Web Update] 更新成功，替换页面内容');
              document.open();
              document.write(newHtml);
              document.close();
            }
          }
        } catch (e) {
          console.warn('[Web Update] 检查失败:', e);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  // 监听原生ApkUpdater插件的下载进度事件
  useEffect(() => {
    if (!isNativeApp) return;
    let pluginRef = null;
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.ApkUpdater) {
        pluginRef = window.Capacitor.Plugins.ApkUpdater;
        pluginRef.addListener('apkDownloadProgress', (data) => {
          if (data.progress !== undefined) {
            setApkDownloadProgress(data.progress);
            if (data.progress >= 100) {
              setInAppDownloading(false);
            }
          }
        });
      }
    } catch (e) {
      console.warn('[ApkUpdater] Event listener setup failed:', e);
    }
    return () => {
      if (pluginRef && pluginRef.removeAllListeners) {
        try { pluginRef.removeAllListeners('apkDownloadProgress'); } catch {}
      }
    };
  }, []);

  // 已掌握词库：根据 progress 动态更新，按 term 去重
  // 注意：仅在 masteredItems 实际变化时才 setBooks，避免标记掌握后触发 books 变化导致 learnItems 重算
  useEffect(() => {
    const seen = new Set();
    const masteredItems = [];
    const addIfNew = (item) => {
      const key = termKey(item.term);
      if (!seen.has(key)) {
        seen.add(key);
        masteredItems.push(item);
      }
    };
    builtInBooks.forEach(b => {
      if (b.id === 'mastered-words') return;
      b.items.forEach(item => {
        if (progress[termKey(item.term)] === 'mastered') addIfNew(item);
      });
    });
    // 同时检查自定义词库中的已掌握单词
    books.forEach(b => {
      if (b.id === 'mastered-words' || builtInBooks.some(bb => bb.id === b.id)) return;
      b.items.forEach(item => {
        if (progress[termKey(item.term)] === 'mastered') addIfNew(item);
      });
    });
    setBooks(prev => {
      const masteredBook = prev.find(b => b.id === 'mastered-words');
      // 比较新旧 items 的 term 集合，仅在变化时更新
      const oldTerms = (masteredBook?.items || []).map(i => termKey(i.term)).sort().join(',');
      const newTerms = masteredItems.map(i => termKey(i.term)).sort().join(',');
      if (oldTerms === newTerms) return prev; // 无变化，不触发重渲染
      return prev.map(b => b.id === 'mastered-words' ? { ...b, items: masteredItems } : b);
    });
  }, [progress, bookDataVersion]);

  // 背诵页词库（始终用 studyBookIds，不受 section 切换影响）
  const learnActiveBook = useMemo(() => {
    if (studyBookIds.includes('wrong-words')) {
      return {
        id: 'wrong-words',
        name: '错词本',
        items: wrongWords,
        editable: false
      };
    }
    const selected = books.filter(b => studyBookIds.includes(b.id) && !hiddenBookIds.includes(b.id));
    if (selected.length === 0) return books[0] || { id: 'empty', name: '空', items: [], editable: false };
    const seen = new Set();
    const uniqueItems = [];
    selected.forEach(b => {
      b.items.forEach(item => {
        const key = termKey(item.term);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueItems.push(item);
        }
      });
    });
    return {
      id: studyBookIds.join(','),
      name: selected.length === 1 ? selected[0].name : `${selected.length}个词库`,
      items: uniqueItems,
      editable: false
    };
  }, [books, studyBookIds, wrongWords, hiddenBookIds]);

  // 仅在切换词库时更新洗牌种子，避免标记掌握后 books 变化导致重新洗牌
  useEffect(() => {
    shuffleSeedRef.current = Date.now();
  }, [studyBookIds]);

  // 词库页词库（始终用 libraryBookIds，不受 section 切换影响）
  const libraryActiveBook = useMemo(() => {
    if (libraryBookIds.includes('wrong-words')) {
      return {
        id: 'wrong-words',
        name: '错词本',
        items: wrongWords,
        editable: false
      };
    }
    const selected = books.filter(b => libraryBookIds.includes(b.id) && !hiddenBookIds.includes(b.id));
    if (selected.length === 0) return books[0] || { id: 'empty', name: '空', items: [], editable: false };
    const seen = new Set();
    const uniqueItems = [];
    selected.forEach(b => {
      b.items.forEach(item => {
        const key = termKey(item.term);
        if (!seen.has(key)) {
          seen.add(key);
          uniqueItems.push(item);
        }
      });
    });
    return {
      id: libraryBookIds.join(','),
      name: selected.length === 1 ? selected[0].name : `${selected.length}个词库`,
      items: uniqueItems,
      editable: false
    };
  }, [books, libraryBookIds, wrongWords, hiddenBookIds]);

  // 当前页面对应的词库（仅用于 UI 显示标题等，不影响背诵页的词汇列表）
  const currentBookIds = section === 'learn' ? studyBookIds : libraryBookIds;
  const activeBook = section === 'learn' ? learnActiveBook : libraryActiveBook;

  /* ===== 听读模式：词库 / 播放队列 / 播放引擎 ===== */
  const listenActiveBook = useMemo(() => {
    if (listenBookIds.includes('wrong-words')) {
      return { id: 'wrong-words', name: '错词本', items: wrongWords, editable: false };
    }
    const selectedBooks = books.filter(b => listenBookIds.includes(b.id) && !hiddenBookIds.includes(b.id));
    if (selectedBooks.length === 0) return { id: 'empty', name: '未选择词库', items: [], editable: false };
    const seen = new Set();
    const uniqueItems = [];
    selectedBooks.forEach(b => {
      b.items.forEach(item => {
        const key = termKey(item.term);
        if (!seen.has(key)) { seen.add(key); uniqueItems.push(item); }
      });
    });
    return {
      id: listenBookIds.join(','),
      name: selectedBooks.length === 1 ? selectedBooks[0].name : `${selectedBooks.length}个词库`,
      items: uniqueItems,
      editable: false
    };
  }, [books, listenBookIds, wrongWords, hiddenBookIds]);

  // 听读队列：受"全部 / 隐藏已掌握 / 仅已掌握"筛选与随机影响
  const listenQueue = useMemo(() => {
    let items = listenActiveBook.items.slice();
    if (listenFilter === 'hide') {
      items = items.filter(item => progress[termKey(item.term)] !== 'mastered');
    } else if (listenFilter === 'only') {
      items = items.filter(item => progress[termKey(item.term)] === 'mastered');
    }
    if (listenCfg.shuffle) items = seededShuffle(items, listenSeedRef.current);
    return items;
  }, [listenActiveBook, listenFilter, progress, listenCfg.shuffle]);

  // 播放中优先使用队列快照，避免进度变化导致列表/索引跳动
  const listenDisplayQueue = listenPlaying && listenQueueRef.current.length ? listenQueueRef.current : listenQueue;
  const listenCurrent = listenDisplayQueue[listenIndex] || null;

  // 听读统计（当前词库维度）
  const listenStats = useMemo(() => {
    const total = listenActiveBook.items.length;
    let mastered = 0;
    listenActiveBook.items.forEach(item => {
      if (progress[termKey(item.term)] === 'mastered') mastered += 1;
    });
    return { total, mastered, remaining: total - mastered };
  }, [listenActiveBook, progress]);

  useEffect(() => { listenCfgRef.current = listenCfg; }, [listenCfg]);
  useEffect(() => { listenPlayingRef.current = listenPlaying; }, [listenPlaying]);
  useEffect(() => { listenSeedRef.current = Date.now(); }, [listenBookIds, listenFilter, listenCfg.shuffle]);
  // 未播放时同步队列快照；播放中保持快照不变
  useEffect(() => {
    if (!listenPlaying) listenQueueRef.current = listenQueue;
  }, [listenQueue, listenPlaying]);
  useEffect(() => {
    if (listenQueue.length && listenIndexRef.current >= listenQueue.length) {
      listenIndexRef.current = 0;
      setListenIndex(0);
    }
  }, [listenQueue.length]);

  // v2.66.0：改动下列参数会影响整库音频的内容，必须重新下发到原生重新生成
  var _REBUILD_KEYS = { enRepeat: 1, zhRepeat: 1, order: 1, innerGap: 1, wordGap: 1, zhSource: 1, zhVoice: 1, shuffle: 1 };

  /** 重新把当前队列整库下发给原生（参数改动后的实时生效） */
  const restartNativeAlbum = function () {
    if (!listenPlayingRef.current) return;
    if (!listenSystemPlayerOn() || !window.NativePlayer) return;
    if (typeof window.NativePlayer.playAlbumFile !== 'function') return;
    try {
      var q = listenQueueRef.current || [];
      if (!q.length) return;
      var aCfg = listenCfgRef.current;
      var aName = (typeof listenActiveBook !== 'undefined' && listenActiveBook && listenActiveBook.name) ? listenActiveBook.name : '背群英 · 听读词库';
      try { setListenBuildInfo('已应用新设置，正在按新参数播放词库…'); } catch (e) {}
      window.__lastAlbumJson = buildAlbumJson(q, aCfg, aName);
      window.NativePlayer.playAlbumFile(window.__lastAlbumJson);
    } catch (e) {}
  };

  const updateListenCfg = function (patch) {
    setListenCfg(function (prev) {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(LISTEN_CFG_KEY, JSON.stringify(next)); } catch (e) {}
      listenCfgRef.current = next;
      return next;
    });
    // v2.66.0：涉及音频内容的参数 → 播放中立即重新下发；语速走 NativePlayer.setRate 实时变速，无需重建
    try {
      var need = false;
      for (var k in patch) { if (_REBUILD_KEYS[k]) need = true; }
      if (need && listenPlayingRef.current && listenSystemPlayerOn()) {
        setTimeout(restartNativeAlbum, 80);
      }
    } catch (e) {}
  };

  // v2.66.0：词列表自动跟随当前词并居中滚动 —— 修复「播放推进了但列表不动 / 整列乱跳」
  useEffect(() => {
    if (!listenShowPL) return;
    const timer = setTimeout(() => {
      try {
        const el = listenPlCurRef.current;
        const box = listenPlRef.current;
        if (!el || !box) return;
        // 优先按容器内的偏移居中滚动（不会带着整页一起滚）
        const target = el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2;
        if (typeof target === 'number' && isFinite(target) && box.scrollTo) {
          box.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
        } else if (el.scrollIntoView) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
      } catch (e) {}
    }, 80);
    return () => clearTimeout(timer);
  }, [listenIndex, listenShowPL]);

  const changeListenFilter = function (v) {
    if (listenPlayingRef.current) stopListenPlayback();
    setListenFilter(v);
    try { localStorage.setItem(LISTEN_FILTER_KEY, v); } catch (e) {}
  };

  const toggleListenBook = function (id) {
    if (listenPlayingRef.current) stopListenPlayback();
    setListenBookIds(function (prev) {
      let next;
      if (id === 'wrong-words') {
        next = prev.includes('wrong-words') ? prev.filter(x => x !== 'wrong-words') : ['wrong-words'];
      } else {
        const base = prev.filter(x => x !== 'wrong-words');
        next = base.includes(id) ? base.filter(x => x !== id) : base.concat(id);
        if (next.length === 0) next = [id]; // 至少保留一个词库
      }
      try { localStorage.setItem(LISTEN_BOOKS_KEY, next.join(',')); } catch (e) {}
      return next;
    });
  };

  const stopListenPlayback = function () {
    listenTokenRef.current += 1;
    listenPausedRef.current = false;
    listenSetPaused(false);
    setListenPaused(false);
    stopListenAudio();
    listenPlayingRef.current = false;
    setListenPlaying(false);
    setListenNativePlaying(false);
    // v2.62.0：停止后清掉进度条，避免残留上一次的播放时长
    try { setListenPos(0); setListenDur(0); } catch (e) {}
  };

  // v2.72.0：暂停必须「立即无声」——WebView 的 speechSynthesis.pause() 在安卓上是
  // 空操作（声音继续播），改为 cancel() 硬停，并在恢复后重播被切断的当前词
  const pauseListen = function (skipNative) {
    if (!listenPlayingRef.current || listenPausedRef.current) return;
    listenPausedRef.current = true;
    listenSetPaused(true);
    setListenPaused(true);
    if (!skipNative) { try { if (window.NativePlayer && window.NativePlayer.pause) window.NativePlayer.pause(); } catch (e) {} }
    try { if (_listenAudio && _listenAudio.pause) _listenAudio.pause(); } catch (e) {}
    try {
      if ('speechSynthesis' in window) {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) _listenTtsCutByPause = true;
        window.speechSynthesis.cancel();
      }
    } catch (e) {}
    try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'paused'; } catch (e) {}
  };

  const resumeListen = function (skipNative) {
    if (!listenPlayingRef.current || !listenPausedRef.current) return;
    listenPausedRef.current = false;
    listenSetPaused(false);
    setListenPaused(false);
    if (!skipNative) { try { if (window.NativePlayer && window.NativePlayer.resume) window.NativePlayer.resume(); } catch (e) {} }
    try {
      if (_listenAudio && _listenAudio.play) {
        var p = _listenAudio.play();
        if (p && p.catch) p.catch(function () {});
      }
    } catch (e) {}
    try { if ('speechSynthesis' in window && window.speechSynthesis.resume) window.speechSynthesis.resume(); } catch (e) {}
    try { if (navigator.mediaSession) navigator.mediaSession.playbackState = 'playing'; } catch (e) {}
  };

  // v2.65.0：构建「整库专辑」JSON，交给原生合成单一音频文件后连续播放。
  // 与 PlayerService.startAlbumFile 的契约：{ album, rate, loop, words:[{ word, meaning, enUrl, zhText }] }
  // zhText 用 _zhAlbumText 精简为高考高频释义（前 1~2 个），缩短整库时长
  function buildAlbumJson(queue, cfg, albumName) {
    var rate = (cfg && cfg.rate) ? cfg.rate : 1;
    var words = [];
    for (var i = 0; i < queue.length; i++) {
      var it = queue[i] || {};
      var term = it.term || '';
      var meaning = it.meaning || '';
      var enUrls = enAudioUrls(term);
      var zh = (_zhAlbumText(meaning) || _zhSpeechText(meaning) || '').trim();
      words.push({
        word: term,
        meaning: meaning,
        enUrl: (enUrls && enUrls.length) ? enUrls[0] : '',
        zhText: zh
      });
    }
    // v2.66.0：把影响整库音频的全部参数一起下发（之前只传 rate/loop，其余参数改了完全没反应）
    var order = (cfg && (cfg.order === 'zh-en' || cfg.order === 'en')) ? cfg.order : 'en-zh';
    return JSON.stringify({
      album: albumName || '背群英 · 听读词库',
      rate: rate,
      loop: (cfg && cfg.loop === 'off') ? 'off' : 'list',
      enRepeat: Math.max(1, Math.min(5, (cfg && cfg.enRepeat) || 1)),
      zhRepeat: Math.max(0, Math.min(3, (cfg && cfg.zhRepeat === 0) ? 0 : ((cfg && cfg.zhRepeat) || 1))),
      order: order,
      innerGapMs: Math.round((cfg && cfg.innerGap != null ? cfg.innerGap : 0.6) * 1000),
      wordGapMs: Math.round((cfg && cfg.wordGap != null ? cfg.wordGap : 2) * 1000),
      zhSource: (cfg && (cfg.zhSource === 'net' || cfg.zhSource === 'system')) ? cfg.zhSource : 'auto',
      zhVoice: (cfg && cfg.zhVoice != null) ? cfg.zhVoice : 0,
      words: words
    });
  }

  const startListenAt = async function (queue, startIdx) {
    if (!queue || !queue.length) return;
    const token = listenTokenRef.current + 1;
    listenTokenRef.current = token;
    listenQueueRef.current = queue;
    let i = startIdx;
    if (i >= queue.length) i = 0;
    if (i < 0) i = 0;
    listenIndexRef.current = i;
    setListenIndex(i);
    listenPausedRef.current = false;
    listenSetPaused(false);
    setListenPaused(false);
    listenPlayingRef.current = true;
    setListenPlaying(true);
    setListenNativePlaying(true);
    // v2.65.0：APK 环境下把整库交给原生合成「单一音频文件」后连续播放——
    // 选择词库 → 整库英音 + 中文高频释义 → 一个 WAV 文件 → 像一首完整音乐一样
    // 在锁屏 / 控制中心 / 耳机线控 / 蓝牙 / 车机完整可控、可拖动进度，无需逐词切换。
    if (listenSystemPlayerOn() && window.NativePlayer && typeof window.NativePlayer.playAlbumFile === 'function') {
      try {
        var aCfg = listenCfgRef.current;
        var aName = (typeof listenActiveBook !== 'undefined' && listenActiveBook && listenActiveBook.name) ? listenActiveBook.name : '背群英 · 听读词库';
        var albumJson = buildAlbumJson(queue, aCfg, aName);
        window.__lastAlbumJson = albumJson; // 合成失败时供回退 playAlbum 使用
        window.NativePlayer.playAlbumFile(albumJson);
        // 原生接管后续整库播放；JS 不再进入逐词循环（避免与原生双路发声）
        return;
      } catch (e) {
        // 构建 / 下发失败则回退到下方逐词播放
      }
    }
    // 回退 1：v2.64.0 逐词专辑模式（旧 APK 热更新后无 playAlbumFile 桥接时）
    if (listenSystemPlayerOn() && window.NativePlayer && typeof window.NativePlayer.playAlbum === 'function') {
      try {
        var aCfg2 = listenCfgRef.current;
        var aName2 = (typeof listenActiveBook !== 'undefined' && listenActiveBook && listenActiveBook.name) ? listenActiveBook.name : '背群英 · 听读词库';
        window.__lastAlbumJson = buildAlbumJson(queue, aCfg2, aName2);
        window.NativePlayer.playAlbum(window.__lastAlbumJson);
        return;
      } catch (e) {}
    }
    try {
      while (token === listenTokenRef.current) {
        const cfg = listenCfgRef.current;
        if (i >= queue.length) {
          if (cfg.loop === 'list') i = 0; else break;
        }
        listenIndexRef.current = i;
        setListenIndex(i);
        await playListenItemAsync(queue[i], cfg, token, listenTokenRef);
        if (token !== listenTokenRef.current) return;
        // v2.72.0：暂停时语音被 cancel() 切断 → 恢复后重播当前词（不推进）
        if (_listenTtsCutByPause) { _listenTtsCutByPause = false; continue; }
        if (cfg.loop !== 'one') i += 1;
        if (cfg.loop === 'off' && i >= queue.length) break;
        await listenSleep(cfg.wordGap * 1000, token, listenTokenRef);
      }
    } finally {
      if (token === listenTokenRef.current) {
        listenPlayingRef.current = false;
        setListenPlaying(false);
        setListenNativePlaying(false);
      }
    }
  };

  const toggleListenPlay = function () {
    if (listenPlayingRef.current) {
      if (listenPausedRef.current) resumeListen(); else pauseListen();
      return;
    }
    const q = (listenQueueRef.current && listenQueueRef.current.length) ? listenQueueRef.current : listenQueue;
    if (!q.length) return;
    let idx = listenIndexRef.current;
    if (idx >= q.length) idx = 0;
    startListenAt(q, idx);
  };

  const listenNext = function () {
    const q = (listenQueueRef.current && listenQueueRef.current.length) ? listenQueueRef.current : listenQueue;
    if (!q.length) return;
    const wasPlaying = listenPlayingRef.current;
    let idx = listenIndexRef.current + 1;
    if (idx >= q.length) idx = (listenCfgRef.current.loop === 'list') ? 0 : q.length - 1;
    // v2.64.0：专辑模式下直接让原生命中跳到该词，无需重启播放（放在 stopListenAudio 之前，避免误停专辑）
    if (wasPlaying && listenSystemPlayerOn() && window.NativePlayer && typeof window.NativePlayer.seekAlbum === 'function') {
      listenIndexRef.current = idx; setListenIndex(idx);
      try { window.NativePlayer.seekAlbum(idx); } catch (e) {}
      return;
    }
    listenTokenRef.current += 1;
    stopListenAudio();
    listenIndexRef.current = idx;
    setListenIndex(idx);
    setListenPlaying(false);
    listenPlayingRef.current = false;
    if (wasPlaying) startListenAt(q, idx);
  };

  const listenPrev = function () {
    const q = (listenQueueRef.current && listenQueueRef.current.length) ? listenQueueRef.current : listenQueue;
    if (!q.length) return;
    const wasPlaying = listenPlayingRef.current;
    let idx = listenIndexRef.current - 1;
    if (idx < 0) idx = (listenCfgRef.current.loop === 'list') ? q.length - 1 : 0;
    if (wasPlaying && listenSystemPlayerOn() && window.NativePlayer && typeof window.NativePlayer.seekAlbum === 'function') {
      listenIndexRef.current = idx; setListenIndex(idx);
      try { window.NativePlayer.seekAlbum(idx); } catch (e) {}
      return;
    }
    listenTokenRef.current += 1;
    stopListenAudio();
    listenIndexRef.current = idx;
    setListenIndex(idx);
    setListenPlaying(false);
    listenPlayingRef.current = false;
    if (wasPlaying) startListenAt(q, idx);
  };

  const jumpListenTo = function (idx) {
    const q = (listenQueueRef.current && listenQueueRef.current.length) ? listenQueueRef.current : listenQueue;
    if (!q.length || idx < 0 || idx >= q.length) return;
    const wasPlaying = listenPlayingRef.current;
    // v2.64.0：专辑模式下直接让原生命中跳到该词，无需重启播放
    if (wasPlaying && listenSystemPlayerOn() && window.NativePlayer && typeof window.NativePlayer.seekAlbum === 'function') {
      listenIndexRef.current = idx; setListenIndex(idx);
      try { window.NativePlayer.seekAlbum(idx); } catch (e) {}
      return;
    }
    listenTokenRef.current += 1;
    stopListenAudio();
    listenIndexRef.current = idx;
    setListenIndex(idx);
    setListenPlaying(false);
    listenPlayingRef.current = false;
    if (wasPlaying) startListenAt(q, idx);
  };

  // 进入背诵页时暂停听读，避免两路发音叠加
  useEffect(() => {
    if (section === 'learn' && listenPlayingRef.current) stopListenPlayback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // 离开应用/卸载时停止播放并释放常亮
  useEffect(() => {
    return function () {
      listenTokenRef.current += 1;
      stopListenAudio();
      setListenNativePlaying(false);
    };
  }, []);

  // 修复 BUG1：切到后台 / 关闭标签页 / 页面隐藏时停止听读，
  // 解决“退出应用后仍在播放、无法停止”的问题
  useEffect(() => {
    const onHide = function () {
      if (document.visibilityState === 'hidden' || document.hidden) {
        // v2.60.0：启用系统播放器后交由原生前台服务继续播放（退出 / 锁屏 / 息屏不中断）；
        // 未启用（网页版或旧安装包）时保持旧行为，避免退出后无法停止
        const bg = listenCfgRef.current.systemPlayer !== false && listenSystemPlayerOn();
        if (listenPlayingRef.current && !bg) stopListenPlayback();
      }
    };
    const onPageHide = function () {
      const bg = listenCfgRef.current.systemPlayer !== false && listenSystemPlayerOn();
      if (listenPlayingRef.current && !bg) stopListenPlayback();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return function () {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  // 修复 BUG3：播放中实时应用倍速，使参数调整立即生效（不必等到下一词）
  useEffect(() => {
    if (listenPlaying && _listenAudio) {
      try { _listenAudio.playbackRate = Math.max(0.5, Math.min(2, listenCfg.rate)); } catch (e) {}
    }
    try { if (window.NativePlayer && window.NativePlayer.setRate) window.NativePlayer.setRate(listenCfg.rate); } catch (e) {}
  }, [listenCfg.rate, listenPlaying]);

  // 锁屏/通知栏媒体信息（现代浏览器渐进增强，旧 WebView 自动忽略）
  useEffect(() => {
    // v2.74.0 关键修复：原生事件回调必须【无条件】注册。
    // 旧代码把所有逻辑放在「有当前词 + 浏览器支持 mediaSession」的早退之后，
    // 一旦 WebView 不支持 mediaSession（部分国产 ROM）或还没开始播放，
    // window.__nativeMediaAction 就不存在 —— 原生回传的 album_index / paused /
    // resumed / album_end 全部被丢弃，表现就是「播到哪都只显示第一个词」、
    // 「通知栏按暂停，App 界面没反应」、「播完不复位」。
    if (listenCurrent && ('mediaSession' in navigator)) try {
      if (window.MediaMetadata) {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: listenCurrent.term || '背群英 · 听读',
          artist: listenCurrent.meaning || '',
          album: '背群英 · 听读模式'
        });
      }
      navigator.mediaSession.playbackState = listenPausedRef.current ? 'paused' : (listenPlaying ? 'playing' : 'paused');
      // 耳机线控 / 锁屏按钮：播放、暂停、上一首、下一首
      if (navigator.mediaSession.setActionHandler) {
        navigator.mediaSession.setActionHandler('play', function () {
          if (listenPausedRef.current) resumeListen();
          else if (!listenPlayingRef.current) toggleListenPlay();
        });
        navigator.mediaSession.setActionHandler('pause', function () { if (listenPlayingRef.current) pauseListen(); });
        navigator.mediaSession.setActionHandler('stop', function () { stopListenPlayback(); });
        navigator.mediaSession.setActionHandler('nexttrack', function () { listenNext(); });
        navigator.mediaSession.setActionHandler('previoustrack', function () { listenPrev(); });
      }
    } catch (e) {}
    // v2.61.0：原生通知栏 / 锁屏 / 耳机线控按钮回调入口（真正的暂停 / 继续）
    try {
      window.__nativeMediaAction = function (action) {
        // v2.64.0：原生长期整库播放，回传当前词序号 / 播放结束，JS 同步界面
        if (typeof action === 'string' && action.indexOf('album_index:') === 0) {
          const n = parseInt(action.slice('album_index:'.length), 10);
          if (!isNaN(n)) { listenIndexRef.current = n; try { setListenIndex(n); } catch (e) {} }
          return;
        }
        // v2.66.0：整库音频在后台生成（播放照常进行，不阻塞出声）
        // v2.74.0：通知/媒体卡片被系统挡住时给出可执行原因（vivo 常见：通知被关、渠道被禁）
        if (typeof action === 'string' && action.indexOf('media_blocked:') === 0) {
          try { setMediaBlocked(action.slice('media_blocked:'.length)); } catch (e) {}
          return;
        }
        if (typeof action === 'string' && action.indexOf('tts_engine:') === 0) {
          try { setTtsEngine(action.slice('tts_engine:'.length)); } catch (e) {}
          return;
        }
        // v2.75.0：高清中文语音包下载 / 解压进度
        if (typeof action === 'string' && action.indexOf('zhpack:') === 0) {
          try { setZhPack(action.slice('zhpack:'.length)); } catch (e) {}
          return;
        }
        if (action === 'album_build_start') {
          try { setListenBuildInfo('正在后台生成本词库的完整音频（当前播放不受影响），下次播放可精确拖动进度'); } catch (e) {}
          return;
        }
        if (typeof action === 'string' && action.indexOf('album_build:') === 0) {
          const t = action.slice('album_build:'.length);
          try { setListenBuildInfo('后台生成整库音频 ' + t + '（播放照常进行）'); } catch (e) {}
          return;
        }
        if (action === 'album_file_ready') {
          try { setListenBuildInfo(''); } catch (e) {}
          return;
        }
        // v2.70.0 中文发音源统计：让用户知道本次实际用的是神经语音还是回退音
        if (typeof action === 'string' && action.indexOf('album_zh_stats:') === 0) {
          const parts = action.slice('album_zh_stats:'.length).split('/');
          const edgeN = parseInt(parts[0], 10) || 0;
          const fbN = parseInt(parts[1], 10) || 0;
          if (edgeN > 0 || fbN > 0) {
            const msg = fbN === 0
              ? ('本次整库中文发音 ' + edgeN + ' 词全部使用微软 Edge 神经语音（番茄小说级音质）')
              : ('中文发音：Edge 神经语音 ' + edgeN + ' 词，' + fbN + ' 词因接口临时不可用回退网络配音');
            try { setListenBuildInfo(msg); } catch (e) {}
          }
          return;
        }
        // v2.70.0 整库音频已自动同步到手机音乐库
        if (typeof action === 'string' && action.indexOf('album_music_synced:') === 0) {
          const p = action.slice('album_music_synced:'.length);
          try { setListenBuildInfo('整库音频已同步到手机「' + p + '」，音乐 App / 车机可直接播放'); } catch (e) {}
          return;
        }
        if (action === 'album_build_fail') {
          // 合成失败：回退到逐词专辑模式（原生连续播放，锁屏同样可控）
          try { setListenBuildInfo(''); } catch (e) {}
          try {
            if (window.NativePlayer && typeof window.NativePlayer.playAlbum === 'function' && window.__lastAlbumJson) {
              window.NativePlayer.playAlbum(window.__lastAlbumJson);
              return;
            }
          } catch (e) {}
          try { setListenPlaying(false); setListenNativePlaying(false); } catch (e) {}
          return;
        }
        if (action === 'album_end') {
          listenPlayingRef.current = false;
          try { setListenBuildInfo(''); } catch (e) {}
          try { setListenPlaying(false); setListenNativePlaying(false); setListenPos(0); setListenDur(0); } catch (e) {}
          return;
        }
        // 原生层已自行切换播放状态时，JS 只同步状态、不再反向下发指令
        if (action === 'nexttrack') listenNext();
        else if (action === 'previoustrack') listenPrev();
        else if (action === 'paused') pauseListen(true);
        else if (action === 'resumed') resumeListen(true);
        else if (action === 'pause') pauseListen();
        else if (action === 'play' || action === 'resume') {
          if (listenPausedRef.current) resumeListen();
          else if (!listenPlayingRef.current) toggleListenPlay();
        }
        else if (action === 'playpause') {
          if (!listenPlayingRef.current) toggleListenPlay();
          else if (listenPausedRef.current) resumeListen();
          else pauseListen();
        }
        else if (action === 'stop') stopListenPlayback();
      };
    } catch (e) {}
  }, [listenCurrent, listenPlaying, listenPaused]);

  // v2.62.0：接收原生真实播放进度（本地 MP3 文件播放，时长精确），同步 App 进度条与系统媒体卡片
  useEffect(() => {
    try {
      window.__nativeProgress = function (pos, dur) {
        try {
          setListenPos(pos);
          if (dur > 0) setListenDur(dur);
          if (dur > 0 && 'mediaSession' in navigator && navigator.mediaSession.setPositionState) {
            navigator.mediaSession.setPositionState({
              duration: dur / 1000,
              position: Math.min(pos, dur) / 1000,
              playbackRate: listenCfg.rate || 1
            });
          }
        } catch (e) {}
      };
    } catch (e) {}
    return function () { try { window.__nativeProgress = null; } catch (e) {} };
  }, [listenCfg.rate]);

  // v2.62.0：拖动进度（系统播放器模式）
  const seekListen = function (ms) {
    try { setListenPos(ms); } catch (e) {}
    try {
      if (window.NativePlayer && window.NativePlayer.seek) window.NativePlayer.seek(Math.max(0, Math.round(ms)));
    } catch (e) {}
    try {
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState && listenDur > 0) {
        navigator.mediaSession.setPositionState({ duration: listenDur / 1000, position: ms / 1000, playbackRate: listenCfg.rate || 1 });
      }
    } catch (e) {}
  };

  // v2.62.0：下载当前单词 MP3
  const downloadCurrentMp3 = function () {
    if (!listenCurrent) return;
    var term = String(listenCurrent.term || 'word');
    var url = (enAudioUrls(term) || [])[0];
    if (!url) return;
    downloadMp3File(url, term.replace(/[^0-9a-zA-Z\-]/g, '_') + '.mp3');
    setMp3State({ done: 0, total: 1, msg: '已开始下载「' + term + '」' });
  };

  const mp3BuildTasks = function () {
    return buildMp3Tasks(listenDisplayQueue, {
      start: mp3Start,
      count: mp3CustomCount,
      preset: mp3Count,
      rate: mp3Rate,
      listenRate: listenCfg.rate,
      scope: mp3SaveScope
    });
  };

  // 选择 / 查看自定义保存目录（原生走 SAF 目录选择器，网页提示浏览器下载设置）
  const mp3PickDir = function () {
    try {
      if (window.NativeSaver && typeof window.NativeSaver.pickDir === 'function') {
        window.NativeSaver.pickDir();
        return;
      }
    } catch (e) {}
    appTip('网页版由浏览器决定保存位置：可在浏览器「设置 → 下载内容」里修改默认目录。', '保存目录');
  };

  const doDownloadMp3 = function () {
    if (mp3Busy) return;
    var built = mp3BuildTasks();
    var tasks = built.tasks;
    if (!tasks.length) { appTip('当前没有可下载的单词'); return; }
    var zipName = String(mp3Name || '').trim() || '背群英听读MP3';
    zipName = zipName.replace(/[\\/:*?"<>|]/g, '_') + '_' + (built.end - built.start + 1) + '词.zip';
    setMp3Busy(true);
    setMp3State({ done: 0, total: tasks.length, msg: '准备中' });
    downloadMp3Zip(tasks, zipName, function (done, total, path) {
      if (done < 0) {
        setMp3Busy(false);
        setMp3State({ done: total, total: total, msg: path ? ('已保存：' + path) : '已打包下载', path: path || '', zipName: zipName });
        try {
          if (path) {
            appTip('压缩包已保存：\n' + path + '\n\n来源：第 ' + built.start + '~' + built.end + ' 词（共 ' + total + ' 个音频）\n'
              + '语速 ' + built.rate.toFixed(2) + 'x · ' + (mp3SaveScope === 'en' ? '仅英文' : mp3SaveScope === 'zh' ? '仅中文' : '英+中')
              + '\n\n解压后可拷进 MP3 播放器 / 点读笔离线听。', 'MP3 已保存');
          } else {
            appTip('压缩包已生成，请在浏览器下载列表中查看。', 'MP3 已生成');
          }
        } catch (e) {}
        return;
      }
      setMp3State({ done: done, total: total, msg: '下载中 ' + done + '/' + total });
    });
  };

  // v2.62.0：按导出范围取词条源（去重后），导出 txt 与百词斩分批共用
  const exportSrcList = function () {
    var src = [];
    if (exportScope === 'wrong') {
      src = (wrongWords || []).map(function (w) {
        return { term: w.term || w.word || '', meaning: w.meaning || '' };
      });
    } else if (exportScope === 'filtered') {
      src = (filteredItems || []).map(function (it) {
        return { term: it.term || '', meaning: it.meaning || '' };
      });
    } else if (exportScope === 'all') {
      (books || []).forEach(function (b) {
        if (hiddenBookIds.includes(b.id)) return;
        (b.items || []).forEach(function (it) {
          src.push({ term: it.term || '', meaning: it.meaning || '' });
        });
      });
    } else if (exportScope === 'mastered' || exportScope === 'unmastered') {
      var pool = [];
      (books || []).forEach(function (b) {
        if (hiddenBookIds.includes(b.id)) return;
        (b.items || []).forEach(function (it) { pool.push(it); });
      });
      src = pool.filter(function (it) {
        var st = progress[termKey(it.term)];
        return exportScope === 'mastered' ? st === 'mastered' : st !== 'mastered';
      }).map(function (it) { return { term: it.term || '', meaning: it.meaning || '' }; });
    } else {
      src = ((activeBook && activeBook.items) || []).map(function (it) {
        return { term: it.term || '', meaning: it.meaning || '' };
      });
    }
    var seen = {};
    var out = [];
    src.forEach(function (w) {
      var t = String(w.term || '').trim();
      var m = String(w.meaning || '').replace(/\s+/g, ' ').trim();
      if (!t) return;
      var k = t.toLowerCase();
      if (seen[k]) return;
      seen[k] = 1;
      out.push({ term: t, meaning: m });
    });
    return out;
  };

  // v2.72.0：分隔符解析为真实字符（自定义可输入任意内容，\t / \n 会被转义）
  const resolveExportSep = function () {
    if (exportSep === 'tab') return '\t';
    if (exportSep === 'comma') return ', ';
    if (exportSep === 'semi') return '; ';
    if (exportSep === 'custom') {
      var c = String(exportSepCustom || '');
      c = c.replace(/\\t/g, '\t').replace(/\\n/g, '\n');
      return c;
    }
    return ' ';
  };

  const buildExportText = function () {
    var onlyWord = exportSep === 'word';
    var sep = resolveExportSep();
    return exportSrcList().map(function (w) {
      return (onlyWord || !w.meaning) ? w.term : (w.term + sep + w.meaning);
    }).join('\n');
  };

  // 前 2 行的可读预览：切换分隔方式后立刻能看到效果（Tab 显示为 ⇥，避免与空格混淆）
  const exportPreview = function () {
    var lines = buildExportText().split('\n').slice(0, 2);
    return lines.map(function (l) {
      return String(l).replace(/\t/g, '⇥').replace(/ /g, '·');
    }).join('\n');
  };

  const doCopyExport = function () {
    var text = buildExportText();
    if (!text) { setExportMsg('没有可导出的单词'); return; }
    var ok = copyTextToClipboard(text);
    var n = text.split('\n').length;
    var sepName = exportSep === 'word' ? '仅单词' : (exportSep === 'tab' ? 'Tab' : (exportSep === 'comma' ? '逗号' : (exportSep === 'semi' ? '分号' : (exportSep === 'custom' ? '自定义' : '空格'))));
    setExportMsg(ok
      ? ('已复制 ' + n + ' 个单词（' + sepName + '分隔）。\n格式预览：\n' + exportPreview())
      : ('复制失败，请改用「下载 txt」'));
  };

  const doDownloadExport = function () {
    var text = buildExportText();
    if (!text) { setExportMsg('没有可导出的单词'); return; }
    var name = '背群英词库_' + exportScope + '_' + new Date().toISOString().slice(0, 10) + '.txt';
    saveTextFile(text, name).then(function (p) {
      setExportMsg(p ? ('已保存到 ' + p) : ('已下载 ' + name));
    });
  };

  // v2.70.0 百词斩分批复制（并入导出面板）：英文逗号分隔、每批 ≤500 词
  const BC_BATCH_SIZE = 500;
  const getBcBatchText = function (batch) {
    var terms = exportSrcList().map(function (w) { return w.term; });
    var totalBatches = Math.max(1, Math.ceil(terms.length / BC_BATCH_SIZE));
    var b = Math.min(batch, totalBatches - 1);
    return {
      total: terms.length,
      totalBatches: totalBatches,
      batch: b,
      text: terms.slice(b * BC_BATCH_SIZE, b * BC_BATCH_SIZE + BC_BATCH_SIZE).join(', '),
    };
  };
  const doCopyBcBatch = function () {
    var info = getBcBatchText(bcBatch);
    if (!info.text) { setExportMsg('没有可导出的单词'); return; }
    var ok = copyTextToClipboard(info.text);
    setExportMsg(ok
      ? ('已复制百词斩第 ' + (info.batch + 1) + '/' + info.totalBatches + ' 批（' + info.text.split(', ').length + ' 词）。打开百词斩 → 词本 → 添加单词 → 长按粘贴 → 提交即可。')
      : '复制失败，请改用「复制到剪贴板」逐批导出');
    if (ok) setBcBatch(info.batch);
  };

  // 全部词汇合并（词根词缀、对比、易错词基于全量词汇）
  // 词库映射 ref：供详情页和背诵页显示单词所属词库
  // 注意：ref 必须在 allWords 之前声明，否则 useMemo 中访问 wordBookMapRef 会触发 TDZ 错误
  const wordBookMapRef = useRef({});
  // v2.56.0 跨词库考点整合：termKey → { core, all }（该单词在所有词库的考点并集，去重）
  const wordPointsMapRef = useRef({});
  const allWords = useMemo(() => {
    // v2.44.0 构建 wordBookMap：记录每个单词出现在哪些词库
    const map = {};
    const pointsMap = {};
    const items = [];
    for (const b of books) {
      for (const item of b.items) {
        const key = item.term.toLowerCase();
        if (!map[key]) map[key] = [];
        if (!map[key].includes(b.name)) map[key].push(b.name);
        // 保留 sourceBooks 属性（已有则保留）
        if (!item.sourceBooks) item.sourceBooks = [...map[key]];
        else if (!item.sourceBooks.includes(b.name)) item.sourceBooks.push(b.name);
        // v2.56.0 收集该单词在所有词库的考点（corePoints/allPoints 并集，精确去重）
        const pk = termKey(item.term);
        let pm = pointsMap[pk];
        if (!pm) pm = pointsMap[pk] = { core: [], all: [] };
        if (Array.isArray(item.corePoints)) {
          for (const p of item.corePoints) { if (p && pm.core.indexOf(p) === -1) pm.core.push(p); }
        }
        if (Array.isArray(item.allPoints)) {
          for (const p of item.allPoints) { if (p && pm.all.indexOf(p) === -1) pm.all.push(p); }
        }
        items.push(item);
      }
    }
    wordBookMapRef.current = map;
    wordPointsMapRef.current = pointsMap;
    return items;
  }, [books]);

  // v2.56.0 跨词库考点整合：同一单词在多个词库的考点合并展示。
  // 当前词条自身考点在前，其他词库的考点按词库顺序追加（去重）。
  // 注意：仅整合考点展示，各词库的单词条目本身保留、不合并。
  function getMergedPoints(item) {
    const ownCore = Array.isArray(item.corePoints) ? item.corePoints : [];
    const ownAll = Array.isArray(item.allPoints) ? item.allPoints : [];
    const pm = wordPointsMapRef.current[termKey(item.term)];
    if (!pm) return { corePoints: ownCore, allPoints: ownAll };
    const corePoints = ownCore.slice();
    for (const p of pm.core) { if (corePoints.indexOf(p) === -1) corePoints.push(p); }
    const allPoints = ownAll.slice();
    for (const p of pm.all) { if (allPoints.indexOf(p) === -1) allPoints.push(p); }
    return { corePoints, allPoints };
  }

  // 统一处理：点击单词 → 词库存在则跳转详情+发音，不存在则只发音
  function speakOrNavigate(word) {
    const w = String(word || '').trim();
    if (!w) return;
    const found = allWords.find(item => item.term.toLowerCase() === w.toLowerCase());
    if (found) {
      openDetailItem(found);
      if (settings.navAutoSpeak !== false) speak(w, settings.speakRate);
    } else {
      speak(w, settings.speakRate);
    }
  }

  // 在词库中查找单词（用于显示中文释义）
  function findWordInBank(word) {
    const w = String(word || '').trim().toLowerCase();
    return allWords.find(item => item.term.toLowerCase() === w);
  }

  // v2.50.0 判断单词是否只存在于高考总汇词库（用于详情区黄底标记）
  function isMasterOnlyWord(word) {
    const w = String(word || '').trim().toLowerCase();
    if (!w) return false;
    const bookList = wordBookMapRef.current[w];
    if (!bookList || bookList.length === 0) return false;
    // 只属于一个词库，且该词库是高考总汇词库
    if (bookList.length !== 1) return false;
    return bookList[0].startsWith('高考总汇词库');
  }

  // v2.43.0 词库外单词的词性+中文：优先当前词库，其次高考总汇词库
  // 用于关联词/派生词/同反义词不在词库内时显示「词性 中文」
  function extraWordInfo(word) {
    const w = String(word || '').trim();
    if (!w) return null;
    const bank = findWordInBank(w);
    if (bank) return getShortMeaning(bank.meaning);
    const m = masterVocabLookup[w.toLowerCase()];
    if (m && m.meaning) {
      const mm = getShortMeaning(m.meaning) || m.meaning;
      return (m.pos ? `${m.pos.replace(/\.$/, '')} ` : '') + mm;
    }
    return null;
  }

  // 背诵页词汇列表（不受 section 切换影响，始终基于 studyBookIds）
  const learnItems = useMemo(() => {
    let items = learnActiveBook.items.filter(item => {
      const posOk = posFilter === '全部' || getPosCategory(item.pos) === posFilter;
      const typeOk = typeFilter === '全部' || item.type === typeFilter;
      const masteredOk = !hideMastered || progress[termKey(item.term)] !== 'mastered';
      return posOk && typeOk && masteredOk;
    });
    if (settings.shuffleMode) items = seededShuffle(items, shuffleSeedRef.current);
    // v2.80.0：艾宾浩斯开启时，到期（含新词）的词优先排到前面
    if (settings.ebbinghaus) {
      items = items.slice().sort((a, b) => ebSortKey(a) - ebSortKey(b));
    }
    return items;
  }, [learnActiveBook, posFilter, typeFilter, hideMastered, settings.shuffleMode, settings.ebbinghaus, progress]);

  // v2.79.0：所选背诵词库的分片状态。「加载中」与「加载失败」是两条互斥路径，
  // 只盯 items.length === 0 会让分片请求失败时永远停在「词库加载中…」。
  // bookDataVersion 由 onBookData() 递增，是这个 useMemo 能感知状态变化的依赖。
  const bookDataLoad = useMemo(() => {
    if (studyBookIds.includes('wrong-words')) return { status: 'ready', reason: '', failedCount: 0 };
    const sel = books.filter(b => studyBookIds.includes(b.id) && !hiddenBookIds.includes(b.id));
    const failed = sel.filter(function (b) {
      return b.total > 0 && (BOOK_DATA_STATE[b.id] === 'error' || !!BOOK_DATA_ERRORS[b.id]);
    });
    // 多本词书同时失败也只汇总成一条提示，不叠加多条
    if (failed.length > 0) {
      return {
        status: 'error',
        reason: BOOK_DATA_ERRORS[failed[0].id] || '词库数据加载失败，请重试',
        failedCount: failed.length,
      };
    }
    const pending = sel.some(function (b) {
      return b.total > 0 && (BOOK_DATA_STATE[b.id] !== 'ready' || !b.items || b.items.length === 0);
    });
    return { status: pending ? 'loading' : 'ready', reason: '', failedCount: 0 };
  }, [books, studyBookIds, hiddenBookIds, bookDataVersion]);

  // 点「重试」：清掉失败标记重新拉分片，界面立刻回到「加载中」
  function handleRetryBookData() {
    const ids = retryBookData();
    if (ids.length > 0) setBookDataVersion(function (v) { return v + 1; });
  }

  // 词库页词汇列表（用于词库浏览，受搜索影响；v2.70.0 用防抖后的搜索词计算）
  const filteredItems = useMemo(() => {
    const q = searchDebounced.trim().toLowerCase();
    let items = libraryActiveBook.items.filter(item => {
      const posOk = posFilter === '全部' || getPosCategory(item.pos) === posFilter;
      const typeOk = typeFilter === '全部' || item.type === typeFilter;
      const searchOk = !q || `${item.term}${item.meaning}${item.pos}`.toLowerCase().includes(q);
      return posOk && typeOk && searchOk;
    });
    // 有搜索词时按相关度排序：最接近的放最前面
    if (q) {
      // 转义正则特殊字符
      const escQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // 单词边界正则：匹配出现在词首（开头/空格后/连字符后）的搜索词
      const boundaryRe = new RegExp(`(^|\\s|-)${escQ}`, 'i');
      items = items.map(item => {
        const term = (item.term || '').toLowerCase();
        const meaning = (item.meaning || '').toLowerCase();
        let score = 0;

        // === 英文词条匹配（优先级最高）===
        if (term === q) {
          score = 1000; // 完全匹配：搜 abandon → abandon
        } else if (term.startsWith(q)) {
          score = 900;  // 前缀匹配：搜 act → action, active
        } else if (term.includes(q)) {
          // 区分单词边界包含 vs 中间包含
          if (boundaryRe.test(term)) {
            score = 850; // 单词边界包含：搜 care → take care of
          } else {
            score = 800; // 普通包含：搜 act → character
          }
        }

        // === 中文释义匹配 ===
        if (score === 0) {
          // 去除词性前缀(vt./vi./n./v./adj.等)，按分号和逗号拆分义项
          const defs = meaning
            .split(/[;；]/)
            .map(p => p.replace(/^(vt\.|vi\.|n\.|v\.|a\.|adj\.|adv\.|prep\.|conj\.|pron\.|art\.|num\.|int\.|aux\.|modal\.|abbr\.|\[.*?\])\s*/gi, '').trim())
            .flatMap(p => p.split(/[,，、]/).map(d => d.trim()))
            .filter(Boolean);

          if (defs.some(d => d === q)) {
            score = 750; // 义项完全匹配：搜 放弃 → 放弃
          } else if (defs.some(d => d.startsWith(q))) {
            score = 580; // 义项前缀匹配：搜 放 → 放弃
          } else if (meaning.includes(q)) {
            score = 500; // 释义包含（含词性前缀等）
          } else {
            score = 100; // 仅词性/音标等匹配
          }
        }

        // 额外加分：term 越短越优先（更精确匹配）
        if (term === q || term.startsWith(q) || term.includes(q)) {
          score += Math.max(0, 50 - term.length);
        }

        return { item, score };
      }).sort((a, b) => b.score - a.score).map(x => x.item);
    }
    return items;
  }, [libraryActiveBook, posFilter, typeFilter, searchDebounced]);

  // 背诵页当前单词：使用 learnItems 而非 filteredItems
  const current = learnItems[index % Math.max(learnItems.length, 1)];

  // 锁定当前显示的单词，防止 toggleProgress 改变 filteredItems 导致 UI 判断错误
  const lockedCurrent = useRef(null);
  // 临时回退显示的单词（即使被过滤也能回退看到）
  const [forceShowItem, setForceShowItem] = useState(null);
  // 显示用的当前单词：答题后或闪卡展示释义后使用锁定的单词，防止 toggleProgress 改变 current 导致显示不匹配
  const displayCurrent = forceShowItem || ((selected || showBack) && lockedCurrent.current) || current;

  // 问题1：4个选项（1正确+3干扰项）—— 根据难度模式选择干扰项策略
  // v2.56.0 修复：答题前后选项刷新（困难模式"选项词汇"与答题选项不一致）。
  // 原因：答题会触发 progress/wrongWords 变化 → 已掌握词库自动重建(books 引用变化)、
  //       learnItems 重算(current 引用变化)，原 deps [books, displayCurrent, current,...]
  //       任何一项变化都会重新 shuffle，生成一套全新的干扰项。
  // 方案：以"显示单词 + 模式 + 难度 + 词库组合"为缓存键（optionsKey），
  //       同一单词在答题期间（含答题后展示选项词汇）绝不重新生成选项。
  const optionsKey = (displayCurrent ? termKey(displayCurrent.term) : '') + '|' + practiceMode + '|' + (settings.difficulty || 'easy') + '|' + learnActiveBook.id;
  const options = useMemo(() => {
    const item = displayCurrent || current;
    if (!item) return [];
    if (practiceMode === 'flashcard') return [];
    // 从普通词库中抽取干扰项，排除易混/同义/反义/褒贬分类词库
    const normalBooks = books.filter(b =>
      !b.id.includes('synonym') && !b.id.includes('antonym') &&
      !b.id.includes('confused') && !b.id.includes('dual-sentiment') &&
      !b.id.includes('positive') && !b.id.includes('negative')
    );
    const normalWords = normalBooks.flatMap(b => b.items);
    const difficulty = settings.difficulty || 'easy';
    const itemPosCat = getPosCategory(item.pos);

    if (practiceMode === 'cn-to-en') {
      // 中文选英文：用 term 做选项（不存在同义重复的问题）
      const correctTerm = item.term;
      const seenTerms = new Set([correctTerm.toLowerCase()]);
      const pushTerm = (w, out) => {
        if (out.length >= 3) return;
        const t = String(w.term || '').toLowerCase();
        if (!t || t === correctTerm.toLowerCase() || seenTerms.has(t)) return;
        seenTerms.add(t); out.push(w.term);
      };
      let wrong = [];
      if (difficulty === 'hard') {
        const cand = [...findConfusingWords(correctTerm, normalWords), ...findWordFamily(correctTerm, normalWords)]
          .filter(w => w.id !== item.id && w.term);
        for (const w of cand) pushTerm(w, wrong);
        if (wrong.length < 3) for (const w of shuffle(normalWords.filter(w => w.id !== item.id && getPosCategory(w.pos) === itemPosCat))) pushTerm(w, wrong);
      } else {
        const confusingSet = new Set(findConfusingWords(correctTerm, normalWords).map(w => w.term.toLowerCase()));
        const familySet = new Set(findWordFamily(correctTerm, normalWords).map(w => w.term.toLowerCase()));
        const pool = normalWords.filter(w => w.id !== item.id && w.term && !confusingSet.has(w.term.toLowerCase()) && !familySet.has(w.term.toLowerCase()));
        for (const w of shuffle(pool.filter(w => getPosCategory(w.pos) !== itemPosCat))) pushTerm(w, wrong);
        for (const w of shuffle(pool)) pushTerm(w, wrong);
      }
      for (const w of shuffle(normalWords.filter(w => w.id !== item.id))) pushTerm(w, wrong);
      return shuffle([correctTerm, ...wrong]);
    }

    // 英文选中文：选项一律用「核心释义」（短、高频），而不是整条词典释义
    const correctCore = coreOf(item.term, item.meaning);
    const seenCores = [correctCore];
    const picked = [];
    const tryAdd = (w) => {
      if (picked.length >= 3) return;
      if (!w || w.id === item.id) return;
      const c = coreOf(w.term, w.meaning);
      if (!c || c.length < 1) return;
      if (seenCores.some(x => meaningsTooClose(x, c))) return;
      seenCores.push(c);
      picked.push(c);
    };

    // 基础池：有释义、含中文、与正确项不撞
    const basePool = normalWords.filter(w => {
      if (!w.meaning || w.id === item.id || w.term === item.term) return false;
      const c = coreOf(w.term, w.meaning);
      return c && /[\u4e00-\u9fa5]/.test(c) && !meaningsTooClose(correctCore, c);
    });

    if (difficulty === 'hard') {
      // 困难模式：优先同词性、且与正确项共享部分汉字的词（形近义不同），
      // 但必须通过 meaningsTooClose 去重 —— 旧版就是缺这一步，
      // 才出现「放弃」和「放弃，遗弃」同时上屏、两个选项都算对的情况。
      const samePos = basePool.filter(w => getPosCategory(w.pos) === itemPosCat);
      const near = samePos.filter(w => meaningsShareChars(item.meaning, w.meaning));
      for (const w of shuffle(near)) tryAdd(w);
      for (const w of shuffle(samePos)) tryAdd(w);
      for (const w of shuffle(basePool)) tryAdd(w);
    } else {
      // 简单模式：优先不同词性、释义差别大的词
      const far = basePool.filter(w => !meaningsShareChars(item.meaning, w.meaning));
      for (const w of shuffle(far.filter(w => getPosCategory(w.pos) !== itemPosCat))) tryAdd(w);
      for (const w of shuffle(far)) tryAdd(w);
      for (const w of shuffle(basePool)) tryAdd(w);
    }
    // 极端情况（词库很小）仍凑不满 3 个：放宽到「只要字面不同」。
    // 宁可给两条相似的，也不能出现两条一模一样的。
    if (picked.length < 3) {
      for (const w of shuffle(normalWords)) {
        if (picked.length >= 3) break;
        const c = coreOf(w.term, w.meaning);
        if (!c || w.id === item.id) continue;
        if (seenCores.some(x => meaningKey(x) === meaningKey(c))) continue;
        seenCores.push(c);
        picked.push(c);
      }
    }
    return shuffle([correctCore, ...picked]);
  }, [optionsKey]); // v2.56.0: 仅当显示单词/模式/难度/词库变化时重新生成，防止答题后选项刷新

  // 选项 → 单词条目映射（困难模式答题后展示选项词汇，点击跳转该词考点）
  const optionItemMap = useMemo(() => {
    const item = displayCurrent || current;
    if (!item || practiceMode === 'flashcard') return new Map();
    // 从全部词库建索引（普通词库 + 特殊词库都可能有对应词）
    const termIdx = new Map();
    const meaningIdx = new Map();
    books.forEach(b => b.items.forEach(w => {
      if (w.term && !termIdx.has(w.term.toLowerCase())) termIdx.set(w.term.toLowerCase(), w);
      const ck = coreOf(w.term, w.meaning);
      if (ck && !meaningIdx.has(ck)) meaningIdx.set(ck, w);
    }));
    const map = new Map();
    options.forEach(opt => {
      if (practiceMode === 'cn-to-en') {
        if (opt === item.term) { map.set(opt, item); return; }
        const w = termIdx.get(opt.toLowerCase());
        if (w) map.set(opt, w);
      } else {
        if (opt === coreOf(item.term, item.meaning)) { map.set(opt, item); return; }
        const w = meaningIdx.get(opt);
        if (w) map.set(opt, w);
      }
    });
    return map;
  }, [options, books, displayCurrent, current, practiceMode]);

  // 进度统计（按当前词库）
  const progressStats = useMemo(() => {
    const bookItems = activeBook.items;
    const total = bookItems.length;
    const mastered = bookItems.filter(i => progress[termKey(i.term)] === 'mastered').length;
    return { total, mastered, remaining: total - mastered };
  }, [activeBook, progress]);

  // 今日学习统计
  const todayKey = getToday();
  const todayCount = studyLog[todayKey] || 0;
  const streakDays = getStreakDays(studyLog);
  const totalStudyDays = getStudyDays(studyLog);

  function updateBooks(next) { setBooks(next); saveCustomBooks(next); }

  function switchStudyBook(id) {
    // 错词本与普通词库互斥：选中错词本时只保留错词本，选中普通词库时移除错词本
    if (id === 'wrong-words') {
      if (studyBookIds.includes('wrong-words')) {
        setStudyBookIds(['gaokao-3500']);
        try { localStorage.setItem('gaokao_study_books', 'gaokao-3500'); } catch {}
      } else {
        setStudyBookIds(['wrong-words']);
        try { localStorage.setItem('gaokao_study_books', 'wrong-words'); } catch {}
      }
    } else {
      if (studyBookIds.includes(id)) {
        const next = studyBookIds.filter(x => x !== id && x !== 'wrong-words');
        if (next.length === 0) next.push('gaokao-3500');
        setStudyBookIds(next);
        try { localStorage.setItem('gaokao_study_books', next.join(',')); } catch {}
      } else {
        const next = [...studyBookIds.filter(x => x !== 'wrong-words'), id];
        setStudyBookIds(next);
        try { localStorage.setItem('gaokao_study_books', next.join(',')); } catch {}
      }
    }
    setTypeFilter('全部');
    setIndex(0);
    setSessionCorrect(0);
    setSessionTotal(0);
  }
  function selectAllStudyBooks() {
    // 切换全选/全不选：已全选则重置为核心词库，否则全选
    const visibleIds = books.filter(b => !b.id.includes('confused') && !b.id.includes('dual-sentiment') && !hiddenBookIds.includes(b.id)).map(b => b.id);
    const selectableIds = wrongWords.length > 0 ? [...visibleIds, 'wrong-words'] : visibleIds;
    const isAllSelected = selectableIds.length > 0 && selectableIds.every(id => studyBookIds.includes(id));
    if (isAllSelected) {
      setStudyBookIds(['gaokao-3500']);
      try { localStorage.setItem('gaokao_study_books', 'gaokao-3500'); } catch {}
    } else {
      const allIds = books.map(b => b.id);
      setStudyBookIds(allIds);
      try { localStorage.setItem('gaokao_study_books', allIds.join(',')); } catch {}
    }
    setTypeFilter('全部'); setIndex(0); setSessionCorrect(0); setSessionTotal(0);
  }
  function switchLibraryBook(id) {
    if (libraryBookIds.includes(id)) {
      const next = libraryBookIds.filter(x => x !== id);
      if (next.length === 0) next.push('gaokao-3500');
      setLibraryBookIds(next);
      try { localStorage.setItem('gaokao_library_books', next.join(',')); } catch {}
    } else {
      const next = [...libraryBookIds, id];
      setLibraryBookIds(next);
      try { localStorage.setItem('gaokao_library_books', next.join(',')); } catch {}
    }
    setTypeFilter('全部');
    setIndex(0);
  }
  function selectAllLibraryBooks() {
    // 切换全选/全不选：已全选则重置为核心词库，否则全选
    const selectableIds = books.filter(b => !hiddenBookIds.includes(b.id)).map(b => b.id);
    const isAllSelected = selectableIds.length > 0 && selectableIds.every(id => libraryBookIds.includes(id));
    if (isAllSelected) {
      setLibraryBookIds(['gaokao-3500']);
      try { localStorage.setItem('gaokao_library_books', 'gaokao-3500'); } catch {}
    } else {
      const allIds = books.map(b => b.id);
      setLibraryBookIds(allIds);
      try { localStorage.setItem('gaokao_library_books', allIds.join(',')); } catch {}
    }
    setTypeFilter('全部'); setIndex(0);
  }

  function toggleProgress(item) {
    const key = termKey(item.term);
    const next = { ...progressRef.current };
    if (next[key] === 'mastered') delete next[key];
    else next[key] = 'mastered';
    progressRef.current = next;
    saveProgress(next); // 同步保存，防止 app 快速关闭时丢失
    setProgress(next);
  }

  // 仅标记为已掌握（不切换），用于自动标记掌握功能
  function markAsMastered(item) {
    const key = termKey(item.term);
    if (progressRef.current[key] === 'mastered') return; // 已掌握则不重复设置
    const next = { ...progressRef.current, [key]: 'mastered' };
    progressRef.current = next;
    saveProgress(next); // 同步保存
    setProgress(next);
  }

  // 自动保存进度到 localStorage
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  // APP进入后台或关闭时立即保存进度，防止数据丢失
  useEffect(() => {
    const handler = () => { saveProgress(progressRef.current); };
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') handler();
    });
    window.addEventListener('pagehide', handler);
    window.addEventListener('beforeunload', handler);
    return () => {
      window.removeEventListener('pagehide', handler);
      window.removeEventListener('beforeunload', handler);
    };
  }, []);

  // 音量键翻页功能：背诵页音量上/下翻页，闪卡模式先翻中文再翻页
  const volKeyNavRef = useRef(null);
  volKeyNavRef.current = (direction) => {
    if (section !== 'learn') return;
    if (learnItems.length === 0) return;
    if (practiceMode === 'flashcard' && !showBack) {
      // 闪卡模式未翻面时，音量键先显示中文释义
      if (!lockedCurrent.current) lockedCurrent.current = current;
      setShowBack(true);
      recordStudy(displayCurrent);
    } else {
      // 已翻面或非闪卡模式，音量键翻页
      if (direction === 'up') prevCard();
      else nextCard();
    }
  };

  useEffect(() => {
    window.__volumeKeyNav = (dir) => { volKeyNavRef.current && volKeyNavRef.current(dir); };
    return () => { delete window.__volumeKeyNav; };
  }, []);

  // 通知原生层音量键开关状态
  useEffect(() => {
    if (isNativeApp && window.VolumeKeyNative) {
      window.VolumeKeyNative.setVolumeKeyNavEnabled(!!settings.volumeKeyNav);
    }
  }, [settings.volumeKeyNav]);

  // v2.80.0：护眼模式（暖色低蓝光）——切换 body 上的 eye-care 类，由 CSS 覆盖主题色
  useEffect(() => {
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('eye-care', !!settings.eyeCare);
    }
  }, [settings.eyeCare]);

  // 问题5：重置某词库进度
  function resetBookProgress(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    if (!confirm(`确定重置「${book.name}」的背诵进度吗？`)) return;
    const next = { ...progressRef.current };
    book.items.forEach(item => { delete next[termKey(item.term)]; });
    progressRef.current = next;
    saveProgress(next); // 同步保存
    setProgress(next);
  }

  // 清理不存在的词库引用：从 studyBookIds/libraryBookIds 中移除已删除的词库 id
  function cleanDeletedBookRefs() {
    /* v2.79.0 关键保护：词库数据是异步分片加载的，数据没到位时 builtInBooks 的
       items 全是空数组，若照旧执行"清理不属于任何词库的进度"，会把老用户
       积累的全部掌握记录一次性删干净。所以数据没齐时直接跳过清理。 */
    const dataIncomplete = builtInBooks.some(function (b) { return b.total > 0 && (!b.items || b.items.length === 0); });
    if (dataIncomplete) return { study: 0, library: 0, skipped: true };
    const allBookIds = books.map(b => b.id);
    const beforeStudy = studyBookIds.length;
    const beforeLibrary = libraryBookIds.length;
    const newStudyIds = studyBookIds.filter(id => allBookIds.includes(id) || id === 'wrong-words');
    const newLibraryIds = libraryBookIds.filter(id => allBookIds.includes(id));
    if (newStudyIds.length !== beforeStudy) {
      setStudyBookIds(newStudyIds);
      localStorage.setItem('gaokao_study_books', newStudyIds.join(','));
    }
    if (newLibraryIds.length !== beforeLibrary) {
      setLibraryBookIds(newLibraryIds);
      localStorage.setItem('gaokao_library_books', newLibraryIds.join(','));
    }
    // 清理 progress 中不属于任何词库的残留数据
    const allTerms = new Set();
    books.forEach(b => b.items.forEach(item => allTerms.add(termKey(item.term))));
    const cleanedProgress = {};
    Object.entries(progressRef.current).forEach(([term, val]) => {
      if (allTerms.has(termKey(term))) cleanedProgress[term] = val;
    });
    progressRef.current = cleanedProgress;
    saveProgress(cleanedProgress);
    setProgress(cleanedProgress);
    // 清理错词本中不属于任何词库的残留数据
    setWrongWords(prev => {
      const next = prev.filter(w => allTerms.has(termKey(w.term)));
      if (next.length !== prev.length) saveWrongWords(next);
      return next;
    });
    return { study: beforeStudy - newStudyIds.length, library: beforeLibrary - newLibraryIds.length };
  }

  // v2.69.0：启动时自动清理不存在的词库引用与残留进度（不再依赖手动按钮）
  // v2.79.0：词库数据异步到达，数据就绪后再补跑一次（bookDataVersion 变化时）
  React.useEffect(function () {
    try { cleanDeletedBookRefs(); } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookDataVersion]);

  // 记录今日学习（同时记录具体学了哪些单词）
  function recordStudy(item) {
    const today = getToday();
    setStudyLog(prev => {
      const next = { ...prev, [today]: (prev[today] || 0) + 1 };
      saveStudyLog(next);
      return next;
    });
    // 记录具体学的单词（用于温习功能）
    if (item && item.term) {
      setStudyWordsLog(prev => {
        const dayWords = prev[today] || [];
        // 去重：同一天同一个单词只记录一次
        if (dayWords.some(w => termKey(w.term) === termKey(item.term))) return prev;
        const next = { ...prev, [today]: [...dayWords, { term: item.term, meaning: item.meaning, pos: item.pos, phonetic: item.phonetic, examples: item.examples, corePoints: item.corePoints, allPoints: item.allPoints, source: item.source, frequency: item.frequency }] };
        saveStudyWordsLog(next);
        return next;
      });
    }
  }

  // 使用 ref 确保异步回调中总是调用最新的 nextCard/prevCard
  const nextCardRef = useRef(() => {});
  const prevCardRef = useRef(() => {});
  // 记录最近一次回答的单词，用于"上一个"按钮优先回退
  const lastAnsweredRef = useRef(null);
  // 最近答错的单词（term），短时间内不重复出现
  const recentWrongRef = useRef([]);
  const RECENT_WRONG_WINDOW = 20; // 最近20个单词内不重复出现答错的词
  // 最近看到过的单词（term），点击"下一个"/"跳过"后不重复出现
  const recentSeenRef = useRef([]);

  // Bug修复1：切换页面后回来时保持当前单词不变
  const savedLearnTermRef = useRef('');
  // Bug修复2：检测当前单词因 learnItems 重算而意外变化时，重置 showBack/selected
  const prevTermRef = useRef('');

  // 切换词库时清空已看记录
  useEffect(() => {
    recentSeenRef.current = [];
    recentWrongRef.current = [];
  }, [learnActiveBook.id]);

  // Bug修复2：当 current.term 因 learnItems 重算（如标记掌握后）而变化，
  // 但 showBack/selected 仍为 true 时，重置为新单词的初始状态
  // 注意：如果 lockedCurrent 仍有值，说明是 progress 变化导致 learnItems 重算，
  // 而非用户主动切换单词（nextCard/prevCard 会清空 lockedCurrent），此时不应重置
  useEffect(() => {
    const currentTerm = current?.term || '';
    if (prevTermRef.current && prevTermRef.current !== currentTerm) {
      if (!lockedCurrent.current && (showBack || selected)) {
        setShowBack(false);
        setSelected('');
        setForceShowItem(null);
      }
    }
    prevTermRef.current = currentTerm;
  }, [current?.term]);

  // Bug修复1：离开背诵页时保存当前单词，回来时恢复
  useEffect(() => {
    if (section === 'learn' && current?.term) {
      savedLearnTermRef.current = current.term;
    }
  }, [current?.term, section]);

  // 回到背诵页时，如果当前单词不是之前保存的，尝试恢复
  useEffect(() => {
    if (section === 'learn' && savedLearnTermRef.current && learnItems.length > 0) {
      const currentTerm = learnItems[index % Math.max(learnItems.length, 1)]?.term;
      if (currentTerm !== savedLearnTermRef.current) {
        const idx = learnItems.findIndex(it => it.term === savedLearnTermRef.current);
        if (idx !== -1) {
          setIndex(idx);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section]);

  // 自动发音：当当前单词变化时自动朗读（仅在背诵页、未答题时）
  const lastSpokenTermRef = useRef('');
  useEffect(() => {
    if (section !== 'learn') return;
    if (!settings.autoSpeak) return;
    if (!current || !current.term) return;
    if (selected || showBack) return; // 答题中或翻面中不朗读
    const termKey = current.term.toLowerCase();
    if (lastSpokenTermRef.current === termKey) return; // 同一个词不重复朗读
    lastSpokenTermRef.current = termKey;
    speak(current.term, settings.speakRate);
  }, [current, selected, showBack, settings.autoSpeak, section]);

  // 同步 practiceMode 与 settings.mode（设置页修改模式后生效）
  useEffect(() => {
    setPracticeMode(settings.mode || 'en-to-cn');
  }, [settings.mode]);

  // 筛选条件变化时重置词库页显示条数
  useEffect(() => {
    setLibraryLimit(60);
  }, [search, posFilter, typeFilter, libraryActiveBook.id]);

  // 拓展页滚动位置记忆：离开时保存，回来时恢复
  useEffect(() => {
    const prevSection = prevSectionRef.current;
    // 离开拓展页时保存滚动位置
    if (prevSection === 'extend' && section !== 'extend') {
      extendScrollRef.current = window.scrollY;
    }
    // 回到拓展页时恢复滚动位置
    if (prevSection !== 'extend' && section === 'extend') {
      requestAnimationFrame(() => {
        window.scrollTo(0, extendScrollRef.current);
      });
    }
    // 打开温习页时，自动选择最近有学习记录的日期
    if (showReview) {
      const dates = Object.keys(studyWordsLog).filter(d => studyWordsLog[d] && studyWordsLog[d].length > 0).sort().reverse();
      if (dates.length > 0 && !studyWordsLog[reviewDate]) {
        setReviewDate(dates[0]);
        setReviewIndex(0); setReviewShowBack(false); setReviewSelected('');
      }
    }
    prevSectionRef.current = section;
  }, [section, showReview]);

  function nextCard() {
    // 把当前单词加入"已看"记录
    if (learnItems.length > 0) {
      const currentItem = learnItems[index % learnItems.length];
      if (currentItem && currentItem.term) {
        const rs = recentSeenRef.current;
        if (!rs.includes(currentItem.term)) rs.push(currentItem.term);
        // 动态窗口：最多保留词库60%且不超过50个
        const maxSeen = Math.min(50, Math.max(3, Math.floor(learnItems.length * 0.6)));
        while (rs.length > maxSeen) rs.shift();
      }
    }

    let nextIdx = (index + 1) % Math.max(learnItems.length, 1);
    // 跳过最近已看和答错的单词，除非所有单词都被跳过了
    if (learnItems.length > 3) {
      const rs = recentSeenRef.current;
      const rw = recentWrongRef.current;
      let tried = 0;
      while (tried < learnItems.length) {
        const item = learnItems[nextIdx];
        // 检查是否所有单词都在"已看"或"答错"列表中
        const allSeenOrWrong = learnItems.every(it => rs.includes(it.term) || rw.includes(it.term));
        if (allSeenOrWrong) break; // 词库内没有新单词了，允许重复
        if (!rs.includes(item.term) && !rw.includes(item.term)) break;
        nextIdx = (nextIdx + 1) % learnItems.length;
        tried++;
      }
    }
    setIndex(nextIdx);
    setShowBack(false); setSelected('');
    lockedCurrent.current = null;
    setForceShowItem(null);
  }

  function prevCard() {
    // 如果存在最近一次回答的单词，优先跳转回该单词（只生效一次）
    if (lastAnsweredRef.current) {
      const { item } = lastAnsweredRef.current;
      // 先尝试在 learnItems 中找到
      const targetIdx = learnItems.findIndex(it => it.term === item.term);
      if (targetIdx !== -1 && targetIdx !== index) {
        setIndex(targetIdx);
        setShowBack(false); setSelected('');
        lockedCurrent.current = null;
        setForceShowItem(null);
        lastAnsweredRef.current = null;
        return;
      }
      // 如果在 learnItems 中找不到（被隐藏已掌握等过滤掉了），
      // 强制临时显示该单词
      setIndex(0); // index 暂时不重要，用 forceShowItem 覆盖显示
      setShowBack(false); setSelected('');
      lockedCurrent.current = null;
      setForceShowItem(item);
      lastAnsweredRef.current = null;
      return;
    }
    setForceShowItem(null);
    setIndex(i => (i - 1 + learnItems.length) % Math.max(learnItems.length, 1));
    setShowBack(false); setSelected('');
    lockedCurrent.current = null;
  }

  nextCardRef.current = nextCard;
  prevCardRef.current = prevCard;

  // 错词本操作
  function addWrongWord(item) {
    const sourceBook = activeBook.name || '未知词库';
    setWrongWords(prev => {
      const existingIdx = prev.findIndex(w => termKey(w.term) === termKey(item.term));
      if (existingIdx !== -1) {
        // 已存在：追加来源词库（去重）
        const existing = prev[existingIdx];
        const sources = existing.sourceBooks || [];
        if (!sources.includes(sourceBook)) {
          const updated = { ...existing, sourceBooks: [...sources, sourceBook] };
          const next = [...prev];
          next[existingIdx] = updated;
          saveWrongWords(next);
          return next;
        }
        return prev;
      }
      // 新错词：记录来源词库
      const next = [...prev, { ...item, wrongAt: Date.now(), sourceBooks: [sourceBook] }];
      saveWrongWords(next);
      return next;
    });
  }

  function removeWrongWord(itemId) {
    setWrongWords(prev => {
      const next = prev.filter(w => w.id !== itemId);
      saveWrongWords(next);
      return next;
    });
  }

  function clearWrongWords() {
    if (!confirm('确定清空错词本吗？')) return;
    setWrongWords([]);
    saveWrongWords([]);
  }

  // 数据备份：导出所有 localStorage 数据为 JSON 文件
  async function exportData() {
    // v2.48.0: 导出全部 localStorage，不再使用硬编码列表，避免遗漏数据
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    }
    // 写入备份版本标记，恢复时可识别来源版本并做兼容处理
    data._backup_version = APP_VERSION;
    data._backup_app = 'gaokao-vocab';
    const totalKeys = Object.keys(data).length;
    const jsonStr = JSON.stringify(data, null, 2);
    const fileName = `gaokao-backup-${new Date().toISOString().slice(0,10)}.json`;
    const dirName = '高考词汇备份';

    // APP端：保存到 Documents/高考词汇备份/ 目录，方便查找
    if (isNativeApp) {
      // v2.76.0：用户选过自定义保存目录时优先写那里（目录由「听读 → MP3 → 保存目录」设置）
      try {
        if (window.NativeSaver && window.NativeSaver.hasDir && window.NativeSaver.hasDir()) {
          var sp = window.NativeSaver.saveText ? String(window.NativeSaver.saveText(jsonStr, fileName) || '') : '';
          if (sp) {
            appTip('数据已备份（共 ' + totalKeys + ' 项）！\n\n保存位置：' + sp + '\n\n该文件可用来在换设备或重装后恢复全部学习数据。', '备份完成');
            return;
          }
        }
      } catch (e) {}
      try {
        // 先确保目录存在（已存在则忽略错误）
        try { await Filesystem.mkdir({ path: dirName, directory: Directory.Documents }); } catch {}
        const result = await Filesystem.writeFile({
          path: `${dirName}/${fileName}`,
          data: jsonStr,
          directory: Directory.Documents,
          encoding: Encoding.UTF8
        });
        const uri = result.uri || '';
        const msg = `数据已备份（共 ${totalKeys} 项）！\n\n保存位置：Documents/${dirName}/${fileName}\n${uri ? '\n完整路径：' + uri : ''}\n\n打开手机"文件管理器" → "Documents" → "高考词汇备份" 即可找到。`;
        appTip(msg);
        return;
      } catch (e) {
        // Filesystem 失败时回退到浏览器下载
        console.warn('[Backup] Filesystem failed:', e);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        appTip(`数据已备份（文件名：${fileName}）\n\n保存到下载目录。如需指定位置，请授予存储权限后重试。\n失败原因：${e.message}`);
        return;
      }
    }
    // 网页端：浏览器下载
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    appTip(`数据已备份（共 ${totalKeys} 项）！文件名为 ${fileName}\n\n保存位置：浏览器"下载"文件夹\n请将此文件保存到安全位置，换设备或更新时可恢复。`);
  }

  // v2.51.0 统一数据恢复函数：恢复所有 localStorage 键，并统计实际数据条数
  function restoreAllData(data) {
    let count = 0;
    let totalItems = 0;
    let breakdown = [];
    let skipped = [];
    const labels = {
      'gaokao_progress': '学习进度', 'gaokao_wrong_words': '错词本', 'gaokao_study_log': '每日学习记录',
      'gaokao_settings': '应用设置', 'gaokao_study_books': '学习词库', 'gaokao_library_books': '词库选择',
      'gaokao_hide_mastered': '隐藏已掌握', 'gaokao_first_use': '首次使用日期',
      'gaokao_practice_mode': '背诵模式', 'gaokao_hidden_books': '隐藏词库', 'gaokao_study_words_log': '学习单词记录',
      'gaokao_downloaded': '下载缓存', 'gaokao_avatar': '头像', 'customBooks': '自定义词库',
      'customSpelling': '自定义拼写', 'aiImportConfig': 'AI导入配置', 'gaokao_mastered_words': '已掌握单词',
    };
    // 不恢复的键：版本标记、公告等应由当前版本控制，避免旧备份覆盖新版本状态
    const SKIP_KEYS = new Set(['gaokao_dismissed_version', '_backup_version', '_backup_app']);
    Object.entries(data).forEach(([k, v]) => {
      if (SKIP_KEYS.has(k)) { skipped.push(k); return; }
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      // 校验设置类数据必须是合法 JSON 对象，否则跳过避免新版本崩溃
      if (k === 'gaokao_settings') {
        try {
          const p = JSON.parse(val);
          if (!p || typeof p !== 'object') { skipped.push(k); return; }
        } catch { skipped.push(k); return; }
      }
      try {
        localStorage.setItem(k, val);
      } catch (e) {
        skipped.push(k + '(存储失败)');
        return;
      }
      count++;
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed) && parsed.length > 0) {
          totalItems += parsed.length;
          breakdown.push(`  • ${labels[k] || k}：${parsed.length} 条`);
        } else if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
          const n = Object.keys(parsed).length;
          totalItems += n;
          breakdown.push(`  • ${labels[k] || k}：${n} 条`);
        }
      } catch { /* 非JSON值，跳过统计 */ }
    });
    return { count, totalItems, breakdown, skipped };
  }

  // 数据恢复：从 JSON 文件导入所有数据
  async function importData() {
    const dirName = '高考词汇备份';
    // APP端：扫描多个可能的备份目录
    if (isNativeApp) {
      const allFound = []; // { name, path, directory, label }

      // 搜索路径列表：兼容新旧版本的多个可能备份位置
      const searchPaths = [
        { path: dirName, directory: Directory.Documents, label: `Documents/${dirName}` },
        { path: '背群英备份', directory: Directory.Documents, label: 'Documents/背群英备份' },
        { path: '', directory: Directory.Documents, label: 'Documents' },
        { path: '', directory: Directory.Downloads, label: 'Downloads' },
      ];

      for (const sp of searchPaths) {
        try {
          const result = await Filesystem.readdir({ path: sp.path, directory: sp.directory });
          const jsonFiles = (result.files || [])
            .filter(f => f.name.endsWith('.json') && (
              f.name.includes('gaokao') ||
              f.name.includes('backup') ||
              f.name.includes('备份') ||
              f.name.includes('背群英')
            ))
            .map(f => ({
              name: f.name,
              path: sp.path ? `${sp.path}/${f.name}` : f.name,
              directory: sp.directory,
              label: sp.label
            }));
          allFound.push(...jsonFiles);
        } catch (e) {
          // 目录不存在则跳过
        }
      }

      // 去重
      const seen = new Set();
      const uniqueFiles = allFound.filter(f => {
        const key = `${f.directory}/${f.path}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).sort((a, b) => b.name.localeCompare(a.name));

      if (uniqueFiles.length > 0) {
        const list = uniqueFiles.map((f, i) => `${i + 1}. ${f.name}  (${f.label})`).join('\n');
        const choice = prompt(`找到以下备份文件（共 ${uniqueFiles.length} 个）：\n\n${list}\n\n请输入序号选择要恢复的文件：\n  • 输入数字序号 → 从对应文件恢复\n  • 输入 0 → 手动选择其他文件\n  • 留空 → 取消`);
        if (choice === null || choice.trim() === '') return;
        const choiceStr = choice.trim();

        // 输入 0 表示手动选择
        if (choiceStr === '0') {
          // 继续往下走，用文件选择器
        } else {
          const idx = parseInt(choiceStr) - 1;
          if (isNaN(idx) || idx < 0 || idx >= uniqueFiles.length) { appTip('序号无效'); return; }
          try {
            const fileContent = await Filesystem.readFile({
              path: uniqueFiles[idx].path,
              directory: uniqueFiles[idx].directory,
              encoding: Encoding.UTF8
            });
            const data = JSON.parse(fileContent.data);
            if (!data || typeof data !== 'object') throw new Error('文件格式错误');
            const result = restoreAllData(data);
            const skipMsg = result.skipped.length > 0 ? `\n\n已跳过 ${result.skipped.length} 项（版本标记/无效数据）：${result.skipped.join('、')}` : '';
            appTip(`✅ 成功从 ${uniqueFiles[idx].name} 恢复 ${result.count} 个存储项，共 ${result.totalItems} 条数据！\n\n数据明细：\n${result.breakdown.join('\n')}${skipMsg}\n\n页面即将刷新。`);
            window.location.reload();
            return;
          } catch (err) {
            appTip('读取文件失败：' + err.message + '\n\n将切换到手动选择模式。');
            // 失败则回退到手动选择
          }
        }
      } else {
        const goManual = confirm(
          '未自动找到备份文件。\n\n' +
          '可能的原因：\n' +
          '1. 备份文件在其他文件夹中\n' +
          '2. 旧版本备份位置不同\n' +
          '3. 文件被移动或删除\n\n' +
          '是否手动选择备份文件？'
        );
        if (!goManual) return;
      }
    }
    // 网页端 / 手动选择模式：让用户选择文件
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if (!data || typeof data !== 'object') throw new Error('文件格式错误');
          const result = restoreAllData(data);
          const skipMsg = result.skipped.length > 0 ? `\n\n已跳过 ${result.skipped.length} 项（版本标记/无效数据）：${result.skipped.join('、')}` : '';
          appTip(`✅ 成功从「${file.name}」恢复 ${result.count} 个存储项，共 ${result.totalItems} 条数据！\n\n数据明细：\n${result.breakdown.join('\n')}${skipMsg}\n\n页面即将刷新。`);
          window.location.reload();
        } catch (err) {
          appTip('恢复失败：' + err.message + '\n\n请确认选择的是背群英备份文件（.json 格式）。');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function handleSelect(option) {
    if (!lockedCurrent.current) lockedCurrent.current = current;
    const c = lockedCurrent.current;
    setSelected(option);
    setSessionTotal(t => t + 1);
    // 记录最近一次回答的单词（用于"上一个"回退）
    lastAnsweredRef.current = { item: c, index };
    const right = practiceMode === 'cn-to-en' ? c.term : coreOf(c.term, c.meaning);
    const isCorrect = option === right;
    // v2.80.0：答题音效（正确/错误分开，可在设置里开关与切换）
    if (settings.soundEnabled) playAnswerSfx(isCorrect, settings.soundCorrect, settings.soundWrong);
    // v2.80.0：艾宾浩斯记忆法（记录本次作答，更新下次复习时间）
    if (settings.ebbinghaus) recordEbbinghaus(c.term, isCorrect);
    // 错词本模式下，答对不自动掌握也不自动跳转（优先级最高）
    const isWrongWordBook = currentBookIds.includes('wrong-words');
    if (isCorrect) {
      setSessionCorrect(co => co + 1);
      recordStudy(c);
      // 自动标记已掌握（仅非错词本模式，且开关开启且当前未标记）
      if (!isWrongWordBook && settings.autoMaster && progress[termKey(c.term)] !== 'mastered') {
        markAsMastered(c);
      }
      if (!isWrongWordBook && settings.autoJump) {
        setAutoJumping(true);
        setTimeout(() => {
          nextCardRef.current();  // 使用 ref 确保调用最新版本
          setAutoJumping(false);
        }, settings.autoJumpDelay || 1500);
      }
    } else {
      // 答错：加入错词本（错词本模式下不重复添加）
      if (!isWrongWordBook) addWrongWord(c);
      // 记录到最近答错列表，短时间内不重复出现
      const rw = recentWrongRef.current;
      rw.push(c.term);
      if (rw.length > RECENT_WRONG_WINDOW) rw.shift();
    }
  }

  function createBook() {
    const name = prompt('请输入词库名称', '我的高考词库');
    if (!name) return;
    const nb = { id: `book-${Date.now()}`, name, editable: true, items: [] };
    updateBooks([...books, nb]); switchLibraryBook(nb.id); setSection('library');
  }

  function renameBook() {
    if (!activeBook.editable) return appTip('内置词库不可改名');
    const name = prompt('请输入新名称', activeBook.name);
    if (!name) return;
    updateBooks(books.map(b => b.id === activeBook.id ? { ...b, name } : b));
  }

  function deleteBook() {
    if (!activeBook.editable) return appTip('内置词库不能删除');
    if (!confirm(`确定删除词库「${activeBook.name}」？`)) return;
    const next = books.filter(b => b.id !== activeBook.id);
    updateBooks(next);
    setStudyBookIds(['gaokao-3500']); try { localStorage.setItem('gaokao_study_books', 'gaokao-3500'); } catch {}
    setLibraryBookIds(['gaokao-3500']); try { localStorage.setItem('gaokao_library_books', 'gaokao-3500'); } catch {}
  }

  function deleteItem(itemId) {
    if (!activeBook.editable) return;
    if (!confirm('确定删除？')) return;
    updateBooks(books.map(b => b.id === activeBook.id ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b));
    setIndex(0);
  }

  function addImportedItems(items) {
    if (!items.length) { setImportStatus('没有识别到有效词条'); return; }
    // 优先使用用户选择的目标词库，否则用当前词库
    const targetId = importTargetBookId || activeBook.id;
    const targetBook = books.find(b => b.id === targetId);
    if (!targetBook || !targetBook.editable) {
      // 自动创建一个新词库
      const name = `导入词库-${new Date().toLocaleDateString()}`;
      const nb = { id: `book-${Date.now()}`, name, editable: true, items };
      updateBooks([...books, nb]);
      setImportTargetBookId(nb.id);
      setImportStatus(`自动新建"${name}"并导入 ${items.length} 条`);
    } else {
      // v2.63.0：与目标词库已有词条比对，重复单词自动跳过，不再灌入重复项
      const existKeys = {};
      targetBook.items.forEach(it => { existKeys[String(it.term || '').toLowerCase()] = 1; });
      const fresh = [];
      let skipped = 0;
      items.forEach(it => {
        const k = String(it.term || '').toLowerCase();
        if (existKeys[k]) { skipped++; return; }
        existKeys[k] = 1;
        fresh.push(it);
      });
      if (!fresh.length) {
        setImportStatus(`没有新增：${items.length} 条都已存在于「${targetBook.name}」`);
        return;
      }
      updateBooks(books.map(b => b.id === targetId ? { ...b, items: [...b.items, ...fresh] } : b));
      setImportStatus(`导入成功：新增 ${fresh.length} 条 → ${targetBook.name}` + (skipped ? `（已跳过重复 ${skipped} 条）` : ''));
      items = fresh;
    }
    // 导入后自动联网检查关联词（异步，不阻塞）
    autoCheckFamilyAfterImport(items);
  }

  // 导入后自动联网检查关联词
  async function autoCheckFamilyAfterImport(newItems) {
    const hasAi = aiConfig.endpoint && aiConfig.model && aiConfig.apiKey;
    if (!hasAi) {
      // 没有AI配置，使用本地算法快速标注
      setFamilyCheckStatus('正在使用本地算法检查关联词和易混词...');
      setFamilyChecking(true);
      try {
        const allItems = books.flatMap(b => b.items);
        const result = await autoTagWordFamily(newItems, allItems, aiConfig, (cur, total, word, found) => {
          setFamilyCheckStatus(`本地检查中 ${cur}/${total}：${word} ${found > 0 ? `✓${found}个` : ''}`);
        });
        setFamilyCheckStatus(`检查完成：${result.totalChecked}个单词，发现${result.totalFound}个有关联词、${result.totalConfusing}个有易混词`);
      } catch (e) {
        setFamilyCheckStatus('关联词检查失败：' + e.message);
      } finally {
        setFamilyChecking(false);
      }
      return;
    }

    // 有AI配置，使用AI联网检查
    setFamilyChecking(true);
    setFamilyCheckStatus('正在联网检查关联词和易混词（AI）...');
    try {
      const allItems = books.flatMap(b => b.items);
      const result = await autoTagWordFamily(newItems, allItems, aiConfig, (cur, total, word, found) => {
        setFamilyCheckStatus(`联网检查中 ${cur}/${total}：${word} ${found > 0 ? `✓${found}个` : ''}`);
      });
      setFamilyCheckStatus(`联网检查完成：${result.totalChecked}个单词，发现${result.totalFound}个有关联词、${result.totalConfusing}个有易混词`);
    } catch (e) {
      setFamilyCheckStatus('联网检查失败：' + e.message);
    } finally {
      setFamilyChecking(false);
    }
  }

  // 手动触发：检查当前词库所有单词的关联词
  async function runManualFamilyCheck() {
    if (familyChecking) return;
    const hasAi = aiConfig.endpoint && aiConfig.model && aiConfig.apiKey;
    const itemsToCheck = libraryActiveBook.items;
    if (!itemsToCheck.length) { setFamilyCheckStatus('当前词库没有单词'); return; }

    setFamilyChecking(true);
    setFamilyCheckStatus(hasAi ? '正在联网检查关联词和易混词（AI）...' : '正在检查关联词和易混词（本地算法）...');
    try {
      const allItems = books.flatMap(b => b.items);
      const result = await autoTagWordFamily(itemsToCheck, allItems, aiConfig, (cur, total, word, found) => {
        setFamilyCheckStatus(`检查中 ${cur}/${total}：${word} ${found > 0 ? `✓${found}个` : ''}`);
      });
      const method = hasAi ? '联网(AI)' : '本地算法';
      setFamilyCheckStatus(`${method}检查完成：${result.totalChecked}个单词，发现${result.totalFound}个有关联词、${result.totalConfusing}个有易混词${!hasAi ? '（配置AI可获更精准结果）' : ''}`);
    } catch (e) {
      setFamilyCheckStatus('检查失败：' + e.message);
    } finally {
      setFamilyChecking(false);
    }
  }

  async function handleFile(file) {
    try {
      setLastFile(file || null); setImportStatus('正在识别...');
      const text = await readFileText(file); setImportText(text);
      const items = parseImportedText(text, 'word');
      const _dup = parseImportedText.lastDupCount || 0;
      setImportStatus(`识别完成：${items.length} 条` + (_dup ? `（自动合并重复 ${_dup} 条）` : '') + '。请确认后导入。');
    } catch (e) { setImportStatus(`失败：${e.message}`); }
  }

  function updateAiConfig(patch) {
    const next = { ...aiConfig, ...patch }; setAiConfig(next); saveAiConfig(next);
  }

  // 反馈通过 Gitee Issues 提交（仅APP使用）
  async function submitFeedback() {
    if (!feedbackText.trim()) { setFeedbackStatus('请填写反馈内容'); return; }
    setFeedbackStatus('提交中...');
    const title = `[${feedbackType === 'suggest' ? '建议' : 'bug'}] ${feedbackText.slice(0, 30)}...`;
    const body = `反馈类型: ${feedbackType}\n版本: v${APP_VERSION}\n内容: ${feedbackText}\n时间: ${new Date().toLocaleString()}`;

    // 从服务端获取 feedbackToken，然后创建 Gitee Issue
    try {
      let serverData = null;

      // 方式1: jsdelivr CDN（国内最快）
      try {
        const cdnResp = await fetch('https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/app-update.json?_t=' + Date.now());
        if (cdnResp.ok) serverData = await cdnResp.json();
      } catch (e) { /* CDN 失败 */ }

      // 方式2: Gitee raw URL
      if (!serverData || !serverData.feedbackToken) {
        try {
          const rawResp = await fetch(UPDATE_SERVER_RAW + '?_t=' + Date.now());
          if (rawResp.ok) serverData = await rawResp.json();
        } catch (e) { /* raw 失败 */ }
      }

      // 方式3: 尝试 Gitee API（base64 解码）
      if (!serverData || !serverData.feedbackToken) {
        try {
          const apiResp = await fetch(UPDATE_SERVER_API + '&_t=' + Date.now());
          if (apiResp.ok) {
            const apiResult = await apiResp.json();
            if (apiResult.content && apiResult.encoding === 'base64') {
              const decoded = decodeURIComponent(escape(atob(apiResult.content)));
              serverData = JSON.parse(decoded);
            }
          }
        } catch (e) { /* API 失败 */ }
      }

      if (!serverData || !serverData.feedbackToken) {
        setFeedbackStatus('⚠️ 反馈服务暂不可用，请稍后再试');
        return;
      }

      const issueResp = await fetch('https://gitee.com/api/v5/repos/xdbzys/app/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: serverData.feedbackToken, title, body, labels: ['用户反馈'] })
      });

      if (issueResp.ok) {
        setFeedbackStatus('✅ 提交成功！感谢你的反馈');
        setFeedbackText('');
        setTimeout(() => { setShowFeedback(false); setFeedbackStatus(''); }, 1500);
      } else {
        const err = await issueResp.json().catch(() => ({}));
        setFeedbackStatus(`提交失败: ${err.message || issueResp.status}`);
      }
    } catch (e) {
      console.error('[Feedback] Error:', e);
      setFeedbackStatus('网络错误，请检查网络后重试');
    }
  }

  async function callAiModel({ text: t = '', file: f = null }) {
    if (!aiConfig.endpoint || !aiConfig.model || !aiConfig.apiKey) throw new Error('请先配置AI');
    const isImage = f && /\.(png|jpg|jpeg|webp)$/i.test(f.name);
    const content = isImage
      ? [{ type: 'text', text: getAiPrompt('word', t || '请识别图片词表') }, { type: 'image_url', image_url: { url: await fileToDataUrl(f) } }]
      : getAiPrompt('word', t);
    const resp = await fetch(aiConfig.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiConfig.apiKey}` },
      body: JSON.stringify({ model: aiConfig.model, temperature: 0.1, messages: [{ role: 'system', content: '只返回JSON' }, { role: 'user', content }] })
    });
    if (!resp.ok) throw new Error(`AI请求失败：${resp.status}`);
    const data = await resp.json();
    const json = extractJsonObject(data.choices?.[0]?.message?.content || '');
    return normalizeAiItems(json.items, 'word');
  }

  async function runAiOnText() {
    try { setImportStatus('AI整理中...|||AI。'); const items = await callAiModel({ text: importText }); setImportStatus(`AI完成：${items.length} 条`); }
    catch (e) { setImportStatus(`AI失败：${e.message}`); }
  }

  async function runAiOnFile() {
    try { if (!lastFile) { setImportStatus('请先选择文件'); return; } setImportStatus('AI识别中...|||AI。'); const isImage = /\.(png|jpg|jpeg|webp)$/i.test(lastFile.name); const text = isImage ? importText : await readFileText(lastFile); const items = await callAiModel({ text, file: isImage ? lastFile : null }); setImportStatus(`AI完成：${items.length} 条`); }
    catch (e) { setImportStatus(`AI失败：${e.message}`); }
  }


  // 版本更新检查：优先使用 raw 直链，失败则回退到 API
  // silent 模式：静默检查，发现更新后自动下载APK，下载完成后弹出安装提示
  async function checkCloudUpdate(silent = false) {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    if (!silent) setCloudStatus('正在检查更新...');

    async function fetchFromRaw() {
      const url = `${UPDATE_SERVER_RAW}?_t=${Date.now()}`;
      console.log('[Update] Trying raw URL:', url);
      // 使用 redirect: 'follow' 确保 WebView 跟随 302 重定向
      const resp = await fetch(url, { cache: 'no-store', redirect: 'follow', headers: { 'Accept': 'application/json, text/plain, */*' } });
      if (!resp.ok) throw new Error(`raw 连接失败（HTTP ${resp.status}）`);
      return await resp.json();
    }

    async function fetchFromApi() {
      const url = `${UPDATE_SERVER_API}&_t=${Date.now()}`;
      console.log('[Update] Trying API URL:', url);
      // 添加浏览器标准 headers 避免 Gitee WAF 拦截 WebView 请求
      const resp = await fetch(url, {
        cache: 'no-store',
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        }
      });
      if (!resp.ok) throw new Error(`API 连接失败（HTTP ${resp.status}）`);
      const apiData = await resp.json();
      if (apiData.content && apiData.encoding === 'base64') {
        const decoded = decodeURIComponent(escape(atob(apiData.content)));
        return JSON.parse(decoded);
      } else if (apiData.versionCode) {
        return apiData;
      }
      throw new Error('API 数据格式无法识别');
    }

    try {
      let data;
      // v2.73.0：清单同时从三个源取，选 versionCode 最大的那份。
      // 旧逻辑"第一个成功就用"，一旦该源（jsDelivr 对 @master 缓存最长 12 小时）
      // 还停在上一版，就会把「有新版本」判成「已是最新」，更新入口永远点不动。
      const manifestUrls = [
        `https://xdbzys.github.io/gaokao-vocab/app-update.json?_t=${Date.now()}`,
        `${UPDATE_SERVER_RAW}?_t=${Date.now()}`,
        `https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/app-update.json?_t=${Date.now()}`,
      ];
      const fetched = await Promise.all(manifestUrls.map(async (u) => {
        try {
          console.log('[Update] Trying', u);
          const r = await fetch(u, { cache: 'no-store', redirect: 'follow' });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const j = await r.json();
          if (!j || typeof j.versionCode !== 'number') throw new Error('bad manifest');
          return j;
        } catch (e) {
          console.warn('[Update] source failed:', u, e.message);
          return null;
        }
      }));
      const good = fetched.filter(Boolean);
      if (good.length) {
        good.sort((a, b) => b.versionCode - a.versionCode);
        data = good[0];
        console.log('[Update] manifest picked:', data.version, data.versionCode, 'of', good.length, 'sources');
      } else {
        // 三源全失败：最后尝试 Gitee API（base64）
        try {
          data = await fetchFromApi();
          console.log('[Update] API fallback success:', data);
        } catch (apiErr) {
          console.warn('[Update] API failed:', apiErr.message);
          throw new Error('检查更新失败，请检查网络连接后重试');
        }
      }

      if (typeof data.versionCode !== 'number') {
        throw new Error(`versionCode 无效: ${data.versionCode}`);
      }

      console.log('[Update] Local versionCode:', APP_VERSION_CODE, 'Remote:', data.versionCode);
      const nativeCode = nativePkgVersionCode();
      const nativeName = nativePkgVersionName();
      console.log('[Update] Installed package versionCode:', nativeCode, nativeName);
      let hasUpdate = data.versionCode > APP_VERSION_CODE;
      // v2.67.0 关键修复：页面会被云端热更新抬高到最新版本号，App 便误以为"已是最新版本"，
      // 但本机安装的 APK 仍是旧的 —— 所有依赖原生代码的功能都不生效（听读配音 / 参数 / 立即出声）。
      // 所以本机安装包的真实版本必须参与比对：只要比远端旧，就一定提示安装新安装包。
      let pkgOutdated = false;
      if (isNativeApp && data.versionCode > nativeCode) {
        hasUpdate = true;
        pkgOutdated = true;
      }
      // v2.73.0：本机基线取「页面版本」与「安装包真实版本」的较大者。
      // 只认页面版本会漏掉「页面已热更到新号、APK 还是旧的」；只认安装包版本又会让网页版永远不提示。
      const localCode = Math.max(APP_VERSION_CODE, nativeCode > 0 ? nativeCode : 0);
      hasUpdate = data.versionCode > localCode || hasUpdate;
      // v2.60.0：旧安装包没有系统播放器桥接，能力探测兜底
      if (isNativeApp && !(window.NativePlayer && typeof window.NativePlayer.playUrl === 'function')
          && data.versionCode >= 221) {
        hasUpdate = true;
        pkgOutdated = true;
      }
      const changelog = data.changelog || data.updateLog || '';
      let version = data.version || data.versionCode;
      const finalChangelog = hasUpdate ? (data.changelog || data.updateLog || changelog) : changelog;
      const finalVersion = hasUpdate ? (data.version || data.versionCode) : version;

      const apkUrl = data.apkUrl || data.appUrl || '';

      const pkgInfo = {
        pkgOutdated: pkgOutdated,
        nativeCode: nativeCode,
        nativeName: nativeName,
        remoteCode: data.versionCode,
      };
      const pkgHint = pkgOutdated
        ? `本机安装包为 v${nativeName || (nativeCode > 0 ? nativeCode : '2.66.0 以下')}，需安装 v${version} 安装包后听读新功能才生效`
        : '';

      if (data.books && Array.isArray(data.books) && !hasUpdate) {
        setUpdateInfo({
          hasUpdate: true,
          version: finalVersion,
          versionCode: APP_VERSION_CODE,
          updateLog: finalChangelog || `词库更新：共 ${data.books.length} 个词库`,
          changelog: finalChangelog || `词库更新：共 ${data.books.length} 个词库`,
          apkUrl: '',
          appUrl: '',
          booksData: data.books,
          updating: false,
          ...pkgInfo,
          pkgHint: '',
        });
        if (!silent) setCloudStatus('发现词库更新');
      } else {
        setUpdateInfo({
          hasUpdate,
          version: finalVersion,
          versionCode: data.versionCode,
          updateLog: finalChangelog,
          changelog: finalChangelog,
          apkUrl: apkUrl,
          appUrl: apkUrl,
          apkUrlCdn: data.apkUrlCdn || '',
          apkSha256: data.apkSha256 || '',
          apkSize: data.apkSize || 0,
          booksData: data.books || null,
          updating: false,
          ...pkgInfo,
          pkgHint: pkgHint,
        });
        if (!silent) {
          setCloudStatus(hasUpdate
            ? (pkgOutdated ? `需要安装新版安装包 v${version}（${pkgHint}）` : `发现新版本 v${version}`)
            : '已是最新版本');
        }
      }

      // 开屏公告：APP 专属，静默模式下如果用户开启了公告且未关闭过当前版本
      if (isNativeApp && silent && hasUpdate && settings.showAnnouncement) {
        const remoteVersion = String(finalVersion);
        if (remoteVersion !== dismissedVersion) {
          setAnnouncementData({ version: remoteVersion, changelog: finalChangelog });
          setShowAnnouncementModal(true);
        }
      }

      // 静默模式：发现新版本且有APK地址，自动在后台下载
      if (silent && hasUpdate && (data.apkUrl || data.appUrl)) {
        // 网页版：如果有 webHtmlUrl，静默更新页面内容（保留localStorage）
        if (!isNativeApp && data.webHtmlUrl) {
          // v2.62.0：不再 document.write 整页重写 —— 那会把用户踢回首页、打断听读播放。
          // 改为：记录"新版本已就绪"，空闲时刷新（页面位置由 gaokao_section 自动恢复）
          try { localStorage.setItem('gaokao_web_update_ready', String(data.versionCode || 0)); } catch (e) {}
          const busy = (function () { try { return !!(window.__listenBusy && window.__listenBusy()); } catch (e) { return false; } })();
          if (!busy) {
            setTimeout(function () {
              try { window.location.reload(); } catch (e) {}
            }, 1200);
            return;
          }
        }

        setUpdateVersion(version);
        setUpdateChangelog(changelog);

        // v2.55.6: 原生应用支持应用内下载安装（NativeApkInstaller），无需浏览器
        if (isNativeApp) {
          setCloudStatus('发现新版本，点击"立即更新"在应用内下载安装');
        } else {
          if (!silent) {
            setCloudStatus('发现新版本，点击下方按钮前往下载');
          }
        }
      }
    } catch (e) {
      console.error('[Update] Error:', e);
      if (!silent) {
        setCloudStatus(`检查失败：${e.message}`);
        setUpdateInfo(null);
        // 所有线路都失败时，提供浏览器下载回退
        setShowBrowserFallback(true);
      }
    } finally {
      setCheckingUpdate(false);
    }
  }

  // v2.67.0：安装包下载候选源（按优先级排序）。
  // 原生侧会解析每个下载结果里的 versionCode，比本机旧的源自动跳过，避免「装完还是旧版本」。
  const apkCandidates = (info) => {
    const list = [];
    const push = (u) => { if (u && typeof u === 'string' && list.indexOf(u) < 0) list.push(u); };
    // v2.72.1 下载源重排（实测依据）：
    // Gitee 镜像随每次构建更新、国内直连约 3 秒 → 首选；
    // jsDelivr ≈ CDN 缓存 12 小时，实测曾滞后一版 → 次选（到期后会自愈）；
    // GitHub Release / ghproxy / raw 国内常被墙或限速 → 末位兜底。
    // 原生侧仍会解析下载结果的 versionCode，比本机旧就自动换下一个源。
    push('https://gitee.com/xdbzys/app/raw/master/gaokao-vocab.apk');
    push(info && info.apkUrlCdn);     // jsDelivr CDN 镜像
    push('https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/gaokao-vocab.apk');
    push(info && info.apkUrl);        // GitHub Release 官方直链
    push('https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-release.apk');
    push('https://ghproxy.com/https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-release.apk');
    push('https://mirror.ghproxy.com/https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-release.apk');
    push('https://raw.githubusercontent.com/xdbzys/gaokao-vocab/master/gaokao-vocab.apk');
    return list;
  };

  /**
   * v2.67.0 统一的安装包更新入口（「我的 → 立即更新」与开屏公告都走这里）
   * - 新安装包（NativeUpdater）：多源自动重试 + 下载后解析包内版本号 + 未知来源授权引导
   * - 旧安装包（NativeApkInstaller）：依次尝试每个源，失败自动换下一个
   * - 网页 / 无桥接：浏览器打开下载地址
   */
  async function installApk(info) {
    const urls = apkCandidates(info || updateInfo);
    const minCode = (info && info.remoteCode) || APP_VERSION_CODE;

    // v2.73.0：更新动作互斥。旧版连点「立即更新」会同时起多条下载线程写同一个 apk 文件，
    // 交叉写入必然产出损坏包 —— 这是「下载失败」最常见的来源。
    if (apkUpdateLockRef.current) {
      setCloudStatus('⏳ 更新正在下载中，请稍候…');
      return;
    }
    apkUpdateLockRef.current = true;
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      apkUpdateLockRef.current = false;
    };
    // 兜底：原生长时间无任何回调（进程被系统杀掉等）时自动解锁，避免按钮永久卡死
    setTimeout(release, 10 * 60 * 1000);

    const wireCallbacks = () => {
      window.__apkUpdateProgress = (pct, msg) => {
        if (pct < 0) return; // 失败原因统一由 __apkUpdateDetail 展示
        setApkDownloadProgress(pct);
        setCloudStatus(msg || `下载中 ${pct}%`);
        setInAppDownloading(pct < 100);
      };
      window.__apkUpdateDetail = (evt, msg) => {
        const tag = ({ source: '🔎 ', found: '✅ ', old_source: '⚠️ ', fail_source: '⚠️ ',
                       installing: '📲 ', permission: '🔐 ', signature: '🔏 ', busy: '⏳ ',
                       error: '❌ ' })[evt] || '';
        if (msg) setCloudStatus(tag + msg);
        if (evt === 'error' || evt === 'installing' || evt === 'permission' || evt === 'busy') {
          setInAppDownloading(false);
          setUpdateInfo(prev => (prev ? { ...prev, updating: false } : prev));
          release();
        }
      };
      // v2.73.0：安装结果由原生比对「真实 installedVersionCode」后回调。
      // 以前装完没有任何回执，用户只能看到版本号没变却不知道为什么 —— 现在有明确结论。
      window.__apkInstallResult = (result, code, target) => {
        release();
        refreshPkgVer();
        if (result === 'success') {
          setInAppDownloading(false);
          setApkDownloadProgress(100);
          let nm = '';
          try {
            nm = (window.NativeVersion && window.NativeVersion.versionName)
              ? window.NativeVersion.versionName() : '';
          } catch (e) {}
          setCloudStatus(`✅ 已升级到 v${nm || target || code}，页面重新加载中…`);
          setUpdateInfo(null);
          try { localStorage.removeItem('gaokao_dismissed_version'); } catch (e) {}
        } else {
          setInAppDownloading(false);
          setCloudStatus(`⚠️ 安装未生效（本机仍是版本号 ${code}）。通常是取消了系统安装、或被系统安全策略拦截；请再点一次「立即更新」。若每次都这样，先卸载旧版再装新包`);
          setUpdateInfo(prev => (prev ? { ...prev, updating: false } : prev));
        }
      };
    };

    if (isNativeApp && window.NativeUpdater && window.NativeUpdater.install) {
      wireCallbacks();
      setUpdateInfo(prev => ({ ...prev, updating: true }));
      setInAppDownloading(true);
      setApkDownloadProgress(0);
      setCloudStatus('正在下载更新...');
      try {
        const sha = (info && info.apkSha256) || (updateInfo && updateInfo.apkSha256) || '';
        if (typeof window.NativeUpdater.installV2 === 'function') {
          window.NativeUpdater.installV2(JSON.stringify(urls), minCode, sha);
        } else {
          window.NativeUpdater.install(JSON.stringify(urls), minCode);
        }
      } catch (e) {
        release();
        setInAppDownloading(false);
        setCloudStatus('❌ 启动更新失败：' + e.message);
      }
      return;
    }

    if (isNativeApp && window.NativeApkInstaller && window.NativeApkInstaller.downloadAndInstall) {
      // 老安装包（v2.67.0 之前）：只有单地址下载接口，原生侧已统一走同一套校验
      wireCallbacks();
      setUpdateInfo(prev => ({ ...prev, updating: true }));
      setInAppDownloading(true);
      setApkDownloadProgress(0);
      setCloudStatus('🔎 正在下载更新...');
      try {
        window.NativeApkInstaller.downloadAndInstall(urls[0]);
      } catch (e) {
        release();
        setInAppDownloading(false);
        setCloudStatus('❌ 启动更新失败：' + e.message);
      }
      return;
    }

    // 网页 / 无桥接：浏览器打开下载
    setUpdateInfo(prev => ({ ...prev, updating: true }));
    setCloudStatus('正在打开下载页面...');
    try {
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        try { await Capacitor.Plugins.Browser.open({ url: urls[0] }); } catch {}
      } else {
        window.open(urls[0], '_blank');
      }
      setCloudStatus('已打开下载页面，下载完成后安装即可。');
    } catch (e) {
      setCloudStatus(`打开失败：${e.message}`);
    }
    release();
    setUpdateInfo(prev => ({ ...prev, updating: false }));
  }

  // v2.67.0：一键复制更新诊断信息（页面版本 / 安装包版本 / 原生能力是否具备），便于快速定位
  const copyUpdateDiag = () => {
    const lines = [
      '页面版本: v' + APP_VERSION + ' (' + APP_VERSION_CODE + ')',
      '安装包版本: ' + (pkgVer.code > 0 ? ('v' + (pkgVer.name || pkgVer.code) + ' (' + pkgVer.code + ')') : '未知（低于 v2.67.0）'),
      '更新判定基线: ' + Math.max(APP_VERSION_CODE, pkgVer.code > 0 ? pkgVer.code : 0),
      '清单版本: ' + (updateInfo ? ('v' + updateInfo.version + ' / code ' + updateInfo.versionCode) : '未检查到'),
      '清单 APK SHA-256: ' + ((updateInfo && updateInfo.apkSha256) || '无'),
      '可靠更新器 NativeUpdater: ' + (window.NativeUpdater ? '有' : '无'),
      '带哈希校验 installV2: ' + (window.NativeUpdater && typeof window.NativeUpdater.installV2 === 'function' ? '有' : '无'),
      '应用内下载 NativeApkInstaller: ' + (window.NativeApkInstaller ? '有' : '无'),
      '系统播放器 NativePlayer: ' + (window.NativePlayer ? '有' : '无'),
      '整库合成 playAlbumFile: ' + (window.NativePlayer && typeof window.NativePlayer.playAlbumFile === 'function' ? '有' : '无'),
      '更新检查状态: ' + (cloudStatus || '未执行'),
    ];
    try { lines.push('听读设置: ' + JSON.stringify(listenCfgRef.current || {})); } catch (e) {}
    const txt = lines.join('\n');
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt);
    } catch (e) {}
    appTip(txt);
  };

  // 执行APP更新
  async function applyUpdate() {
    if (!updateInfo || !updateInfo.hasUpdate) return;
    await installApk(updateInfo);
  }

  // 对比记忆模块（基于 seed 数据，不依赖词库列表）
  const compareBook = compareTab === 'synonym' ? { items: makeAllItems(seedSynonyms, 'phrase') } :
                     { items: makeAllItems(seedAntonyms, 'phrase') };
  const compareItems = compareBook ? compareBook.items : [];
  const compareCurrent = compareItems[compareIndex % Math.max(compareItems.length, 1)];

  // 词根词缀（问题3：基于全量词汇）
  const affixMatchWords = useMemo(() => {
    if (extendTab !== 'affix') return {};
    const result = {};
    const list = affixTab === 'prefix' ? affixData.prefixes : affixTab === 'suffix' ? affixData.suffixes : affixData.roots;
    if (!list) return result;
    list.forEach(([name]) => {
      // 从allWords中查找包含该词根/词缀的词
      const root = name.replace(/^(un|re|dis|in|im|pre|mis|over|out|sub|trans|super|fore|under|non|anti|auto|co|de|ex|inter|multi|post|semi|tele)-?/i, '').replace(/-(able|ible|ful|less|ous|ive|al|ial|ly|tion|sion|ment|ness|ity|er|or|ist|ism|ize|ise|fy|en|teen|ty|th|ward|wise|like)$/, '');
      const key = name.toLowerCase().replace(/[^a-z]/g, '');
      result[name] = allWords.filter(w => {
        const t = w.term.toLowerCase();
        return t.includes(key) || (root && root.length > 2 && t.includes(root.toLowerCase()));
      }).slice(0, 12);
    });
    return result;
  }, [extendTab, affixTab, allWords]);

  // 词库页面可见的词性筛选列表
  const posFilterList = getPosFilterList();

  // 正确率
  const accuracy = sessionTotal > 0 ? Math.round(sessionCorrect / sessionTotal * 100) : 0;

  return (
    <div className="app">
      {/* ====== 背诵页 ====== */}
      {section === 'learn' && (
        <section>
          {/* 专属标识（仅旧网页版；新网页版 /app/ 与 App 保持一致，不显示） */}
          {!isFullApp && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px', }}>
              <span style={{ color: '#2563eb', fontWeight: 800, fontSize: 20, letterSpacing: 2, textShadow: '0 1px 4px rgba(37,99,235,0.25)' }}><Icon name="sparkle" />李群雁专属<Icon name="sparkle" /></span>
            </div>
          )}
          {/* 顶部栏 */}
          <div className="learnTop">
            <div className="multiBookSelect" style={{ position: 'relative', flex: 1 }}>
              <button className="multiBookBtn" onClick={() => setShowBookPicker(!showBookPicker)}>
                {activeBook.name}<Icon name="chevronDown" />
              </button>
              {showBookPicker && (
                <div className="bookPickerDropdown">
                  <div className="bookPickerActions">
                    <button onClick={selectAllStudyBooks}>{(wrongWords.length > 0 ? [...books.filter(b => !b.id.includes('confused') && !b.id.includes('dual-sentiment') && !hiddenBookIds.includes(b.id)).map(b => b.id), 'wrong-words'] : books.filter(b => !b.id.includes('confused') && !b.id.includes('dual-sentiment') && !hiddenBookIds.includes(b.id)).map(b => b.id)).every(id => studyBookIds.includes(id)) ? '全不选' : '全选'}</button>
                    <button onClick={() => { setStudyBookIds(['gaokao-3500']); try { localStorage.setItem('gaokao_study_books', 'gaokao-3500'); } catch {} }}>重置</button>
                  </div>
                  {/* 错词本（单独复习） */}
                  {wrongWords.length > 0 && (
                    <label key="wrong-words" className="bookPickerItem" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 4 }}>
                      <input type="checkbox" checked={studyBookIds.includes('wrong-words')} onChange={() => switchStudyBook('wrong-words')} />
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>错词本</span>
                      <span className="bookCount">({wrongWords.length})</span>
                    </label>
                  )}
                  {books.filter(b => !b.id.includes('confused') && !b.id.includes('dual-sentiment') && !hiddenBookIds.includes(b.id)).map(b => (
                    <label key={b.id} className="bookPickerItem">
                      <input type="checkbox" checked={studyBookIds.includes(b.id)} onChange={() => switchStudyBook(b.id)} />
                      <span>{b.name}</span>
                      <span className="bookCount">({b.items.length || b.total || 0})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <span className="progressTag">{index + 1}/{learnItems.length}</span>
          </div>

          {/* 背诵模式快捷开关（v2.72.0：去 emoji，统一线性图标 + 状态色） */}
          <div className="quickToggleRow">
            <button
              className="quickToggleBtn modeBtn"
              onClick={() => { const modes = choiceModes.map(m => m.id); const cur = modes.indexOf(practiceMode); const next = modes[(cur + 1) % modes.length]; setPracticeMode(next); setSettings(s => ({ ...s, mode: next })); saveSettings({ ...settings, mode: next }); setSelected(''); setShowBack(false); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.2A2.2 2.2 0 0 1 6.2 4H19v14.5H6.2A2.2 2.2 0 0 0 4 20.7V6.2Z"/><path d="M8 8h7M8 11.2h5"/></svg>
              <span>{choiceModes.find(m => m.id === practiceMode)?.name || '英文选中文'}</span>
            </button>
            {practiceMode !== 'flashcard' && (
              <button
                className={`quickToggleBtn ${settings.difficulty === 'hard' ? 'hardOn' : 'easyOn'}`}
                onClick={() => { const v = settings.difficulty === 'hard' ? 'easy' : 'hard'; setSettings(s => ({ ...s, difficulty: v })); saveSettings({ ...settings, difficulty: v }); setSelected(''); }}
              >
                {settings.difficulty === 'hard'
                  ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3s4.6 3.3 4.6 7.4c0 2-1.1 3.6-2.4 4.6.2-1.6-.6-2.9-1.7-3.6.4 1.9-.7 3-1.6 3.9-.6.6-1 1.4-1 2.3 0 .9.4 1.6 1 2-2.6-.5-4.6-2.8-4.6-5.6C6.3 6.6 12 3 12 3Z"/></svg>
                  : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18"/><circle cx="12" cy="12" r="3.6"/></svg>}
                <span>{settings.difficulty === 'hard' ? '困难模式' : '简单模式'}</span>
              </button>
            )}
            <button
              className={`quickToggleBtn ${settings.shuffleMode ? 'shuffleOn' : 'shuffleOff'}`}
              onClick={() => { setSettings(s => ({ ...s, shuffleMode: !s.shuffleMode })); saveSettings({ ...settings, shuffleMode: !settings.shuffleMode }); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h3.2c1.4 0 2.3.7 3.1 1.9l3.4 5.2c.8 1.2 1.7 1.9 3.1 1.9H20"/><path d="M17.4 4.6 20 7l-2.6 2.4M17.4 14.2 20 16.6l-2.6 2.4M4 17h3.2c1.4 0 2.3-.7 3.1-1.9"/></svg>
              <span>{settings.shuffleMode ? '乱序' : '顺序'}</span>
            </button>
            <button
              className={`quickToggleBtn ${settings.autoMaster ? 'masterOn' : 'masterOff'}`}
              onClick={() => { const v = !settings.autoMaster; setSettings(s => ({ ...s, autoMaster: v })); saveSettings({ ...settings, autoMaster: v }); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.2"/><path d="m8.4 12.2 2.5 2.5 4.7-5"/></svg>
              <span>自动掌握</span>
            </button>
            <button
              className={`quickToggleBtn ${settings.autoJump ? 'jumpOn' : 'jumpOff'}`}
              onClick={() => { const v = !settings.autoJump; setSettings(s => ({ ...s, autoJump: v })); saveSettings({ ...settings, autoJump: v }); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6.5v11l7-5.5-7-5.5Z"/><path d="M17 6.5v11"/></svg>
              <span>自动跳转</span>
            </button>
            {/* v2.81.0：自动发音开关移到背诵页（原来只在「我的」里，做题时想开关还得退出背诵页） */}
            <button
              className={`quickToggleBtn ${settings.autoSpeak !== false ? 'speakOn' : 'speakOff'}`}
              title="开启后背诵页出现新单词时自动发音"
              onClick={() => { const v = settings.autoSpeak === false; setSettings(s => ({ ...s, autoSpeak: v, navAutoSpeak: v })); saveSettings({ ...settings, autoSpeak: v, navAutoSpeak: v }); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 6v12L7.2 14.5H4z" /><path d="M15.5 8.5a4 4 0 0 1 0 7" /><path d="M18 6a7.5 7.5 0 0 1 0 12" /></svg>
              <span>自动发音</span>
            </button>
            {/* v2.78.0 音量键翻页开关放到背诵页：原来只在「我的-设置」里，做题时想开还得退出背诵页 */}
            {isNativeApp && (
              <button
                className={`quickToggleBtn ${settings.volumeKeyNav ? 'volOn' : 'volOff'}`}
                title="开启后按手机音量上/下键翻到上一个/下一个词"
                onClick={() => {
                  const v = !settings.volumeKeyNav;
                  setSettings(s => ({ ...s, volumeKeyNav: v }));
                  saveSettings({ ...settings, volumeKeyNav: v });
                  try { if (window.VolumeKeyNative) window.VolumeKeyNative.setVolumeKeyNavEnabled(v); } catch (e) {}
                  appTip(v ? '音量上键上一个词，音量下键下一个词' : '已关闭，音量键恢复调节音量', '音量键翻页', 1800);
                }}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 6v12L7.2 14.5H4z" /><path d="M16.2 9.2a4 4 0 0 1 0 5.6" /><path d="M18.6 6.6a7.6 7.6 0 0 1 0 10.8" /></svg>
                <span>音量键{settings.volumeKeyNav ? '开' : '关'}</span>
              </button>
            )}
          </div>

          {/* 单词/短语分类 */}
          <div className="typeFilterRow">
            {['全部', 'word', 'phrase'].map(t => (
              <button key={t} className={`typeFilterBtn ${typeFilter === t ? 'active' : ''}`}
                onClick={() => { setTypeFilter(t); setIndex(0); }}>
                {t === 'word' ? '单词' : t === 'phrase' ? '短语' : '全部'}
              </button>
            ))}
          </div>

          {/* 进度条 */}
          <div className="progressBar">
            <div className="progressTrack">
              <div className="progressFill" style={{ width: `${progressStats.total ? (progressStats.mastered / progressStats.total * 100) : 0}%` }} />
            </div>
            <div className="progressInfo">
              <span>已掌握 {progressStats.mastered}/{progressStats.total}</span>
              <span>剩余 {progressStats.remaining}词</span>
              <span>今日 {todayCount}词</span>
              {sessionTotal > 0 && <span>正确率 {accuracy}%</span>}
              <button className="smallBtn" onClick={() => {
                setHideMastered(h => { const v = !h; try { localStorage.setItem('gaokao_hide_mastered', v); } catch {}; return v; });
              }}>
                {hideMastered ? '显示已掌握' : '隐藏已掌握'}
              </button>
            </div>
          </div>

          {/* 答题区 */}
          {current ? (
            <div className="card">
              <div className="cardMeta">
                <span className="freqTag" style={{ color: freqColor(displayCurrent.frequency), borderColor: freqColor(displayCurrent.frequency) }}>{displayCurrent.frequency}</span>
                {displayCurrent.pos && <span className="posTag" style={{ color: posColor(displayCurrent.pos), background: posColor(displayCurrent.pos) + '18' }}>{displayCurrent.pos}</span>}
                {/* v2.44.0 显示单词所属词库 */}
                {(() => {
                  const books = (displayCurrent.sourceBooks && displayCurrent.sourceBooks.length > 0)
                    ? displayCurrent.sourceBooks
                    : (displayCurrent.source ? [displayCurrent.source] : []);
                  if (books.length === 0) return null;
                  const isMulti = books.length > 1;
                  // v2.49.0: 单词只属于一个词库 → 黄底；属于多个词库 → 蓝底
                  const bg = isMulti ? '#dbeafe' : '#fef9c3';
                  const clr = isMulti ? '#1e40af' : '#a16207';
                  return <span style={{ fontSize: 11, background: bg, color: clr, padding: '1px 6px', borderRadius: 6, fontWeight: 500 }}><Icon name="book" />{books.join('/')}</span>;
                })()}
                {progress[termKey(displayCurrent.term)] === 'mastered' && <span className="masteredTag">已掌握</span>}
              </div>

              <div className="questionArea">
                {practiceMode === 'sentence' ? (() => {
                  const enr = getWordEnrichment(displayCurrent.term);
                  const col = enr && enr.collocations && enr.collocations.length ? enr.collocations[0] : null;
                  if (col) {
                    // 只取英文部分作语境（去掉末尾中文释义，避免直接给答案）
                    const eng = String(col).replace(/\s*[一-鿿].*$/, '').trim();
                    const safe = displayCurrent.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const parts = eng.split(new RegExp('(' + safe + ')', 'i'));
                    return (
                      <div className="sentenceCtx">
                        <div className="ctxBadge">语境</div>
                        <p className="ctxSentence">
                          {parts.map((p, i) => (p.toLowerCase() === displayCurrent.term.toLowerCase())
                            ? <b key={i} style={{ color: 'var(--primary-dark)' }}>{p}</b>
                            : <span key={i}>{p}</span>)}
                        </p>
                        <p className="ctxHint">选出「{displayCurrent.term}」在句中的含义</p>
                      </div>
                    );
                  }
                  return <h2 style={{ color: wordStatusColor(displayCurrent, progress, wrongWords) || undefined }}>{displayCurrent.term}</h2>;
                })() : (
                  <h2 style={{ color: wordStatusColor(displayCurrent, progress, wrongWords) || undefined }}>{practiceMode === 'cn-to-en' ? coreOf(displayCurrent.term, displayCurrent.meaning) : displayCurrent.term}</h2>
                )}
                {displayCurrent.pos && <p className="posText" style={{ color: posColor(displayCurrent.pos), fontWeight: 600, fontSize: '1.1em', margin: '4px 0' }}>{displayCurrent.pos}</p>}
                {practiceMode !== 'cn-to-en' && practiceMode !== 'sentence' && displayCurrent.phonetic && <p className="phoneticText">{displayCurrent.phonetic}</p>}
                <button className="sound" onClick={() => speak(displayCurrent.term, settings.speakRate)}><Icon name="speaker" />发音</button>
              </div>

              {/* 问题1：4选项答题 - 未回答时显示选项，回答后隐藏 */}
              {practiceMode !== 'flashcard' && !selected && (
                <div className="options">
                  {options.map(option => {
                    const right = practiceMode === 'cn-to-en' ? current.term : coreOf(current.term, current.meaning);
                    // v2.78.0：选项本身就是核心释义（短、高频），不需要再截断
                    return <button key={option} onClick={() => handleSelect(option)}>{option}</button>;
                  })}
                </div>
              )}

              {/* 闪卡模式 */}
              {practiceMode === 'flashcard' && !showBack && (
                <button className="primary" onClick={() => { if (!lockedCurrent.current) lockedCurrent.current = current; setShowBack(true); recordStudy(displayCurrent); }}>显示释义</button>
              )}

              {/* 答题后选项消失，解释内容顶替选项位置 */}
              {(showBack || selected) && (() => {
                const isFlashcard = practiceMode === 'flashcard';
                const isCorrect = selected && (practiceMode === 'cn-to-en' ? displayCurrent.term : coreOf(displayCurrent.term, displayCurrent.meaning)) === selected;
                const enrichment = (isFlashcard || isCorrect) ? getWordEnrichment(displayCurrent.term) : null;
                const showAll = isFlashcard || detailMode === 'full' || isCorrect;
                const mergedPoints = getMergedPoints(displayCurrent); // v2.56.0 跨词库考点整合
                return (
                <div className="answerBox">
                  {selected && (
                    <p style={{ fontWeight: 600, marginBottom: 8, color: (practiceMode === 'cn-to-en' ? displayCurrent.term : coreOf(displayCurrent.term, displayCurrent.meaning)) === selected ? '#16a34a' : '#dc2626' }}>
                      {selected === (practiceMode === 'cn-to-en' ? displayCurrent.term : coreOf(displayCurrent.term, displayCurrent.meaning)) ? '回答正确' : `回答错误（你选了：${selected}）`}
                    </p>
                  )}
                  {/* 困难模式：答题后展示全部选项词汇（英文+中文），点击跳转该词考点一并掌握 */}
                  {selected && practiceMode !== 'flashcard' && (settings.difficulty === 'hard') && (() => {
                    const right = practiceMode === 'cn-to-en' ? displayCurrent.term : coreOf(displayCurrent.term, displayCurrent.meaning);
                    return (
                      <div className="points" style={{ marginTop: 8, marginBottom: 10 }}>
                        <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 6 }}><Icon name="target" />选项词汇 · 点击查看考点</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {options.map(opt => {
                            const w = optionItemMap.get(opt);
                            const isRight = opt === right;
                            const isPicked = opt === selected;
                            const mainText = opt;
                            return (
                              <div key={opt}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                                  background: isRight ? 'rgba(22,163,74,0.10)' : (isPicked ? 'rgba(220,38,38,0.08)' : 'var(--bg-tertiary)'),
                                  border: `1.5px solid ${isRight ? '#16a34a' : (isPicked ? '#dc2626' : 'var(--border-light)')}`,
                                  borderRadius: 10, padding: '7px 10px',
                                  cursor: w ? 'pointer' : 'default',
                                }}
                                onClick={() => { if (w) { openDetailItem(w); if (settings.navAutoSpeak !== false) speak(w.term, settings.speakRate); } }}
                              >
                                <span style={{ fontSize: 14, fontWeight: 700, color: isRight ? '#16a34a' : (isPicked ? '#dc2626' : 'inherit'), minWidth: 16 }}>
                                  {isRight ? '✓' : (isPicked ? '✗' : '•')}
                                </span>
                                <span style={{ fontSize: 15, fontWeight: 600 }}>
                                  {practiceMode === 'cn-to-en'
                                    ? mainText
                                    : <span style={{ fontWeight: 600 }}>{mainText}</span>}
                                </span>
                                {w && (
                                  <span style={{ fontSize: 13, opacity: 0.8 }}>
                                    {practiceMode === 'cn-to-en'
                                      ? `— ${getShortMeaning(w.meaning)}`
                                      : `— ${w.term}`}
                                    {w.pos ? <small style={{ opacity: 0.7 }}>（{w.pos}）</small> : null}
                                  </span>
                                )}
                                {w && <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>考点 ›</span>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <h3>{displayCurrent.term} &middot; <Meanings text={displayCurrent.meaning} /></h3>
                  <p className="muted">{displayCurrent.pos} &middot; {displayCurrent.source}</p>
                  <div className="points">
                    {/* v2.56.0: 跨词库整合考点——同一单词在所有词库的考点一并展示 */}
                    {(showAll ? mergedPoints.allPoints : mergedPoints.corePoints.slice(0, 2)).map(p => <p key={p}>• {p}</p>)}
                  </div>
                  {/* 闪卡模式或答对时：显示全部考点和增强数据 */}
                  {(isFlashcard || isCorrect) && enrichment && (
                    <>
                      {enrichment.examPoints.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="note" />常考要点</p>
                          {enrichment.examPoints.map((p, i) => <p key={i}>• {p}</p>)}
                        </div>
                      )}
                      {enrichment.collocations.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="link" />词组搭配</p>
                          {enrichment.collocations.map((p, i) => <p key={i} style={{ cursor: 'pointer' }} onClick={() => speak(extractEnglish(p), settings.speakRate)}>• {p}</p>)}
                        </div>
                      )}
                      {enrichment.derivatives.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="leaf" />派生词</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrichment.derivatives.map((d, i) => {
                              const derivWord = d.split(' ')[0];
                              const derivItem = allWords.find(w => w.term.toLowerCase() === derivWord.toLowerCase());
                              const derivExtra = derivItem ? getShortMeaning(derivItem.meaning) : extraWordInfo(derivWord);
                              return <span key={i} style={{ display: 'inline-block', background: derivItem ? 'var(--primary-light)' : 'var(--border-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }} onClick={() => { if (derivItem) { openDetailItem(derivItem); if (settings.navAutoSpeak !== false) speak(derivWord, settings.speakRate); } else { speak(derivWord, settings.speakRate); } }}>{d}{derivExtra && <span style={{ opacity: 0.75, fontSize: 12 }}>（{derivExtra}）</span>}</span>;
                            })}
                          </div>
                        </div>
                      )}
                      {enrichment.synonyms.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="pin" />近义词</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrichment.synonyms.map((s, i) => {
                              const synWord = extractEnglish(s).split(/\s+/)[0];
                              const synItem = allWords.find(w => w.term.toLowerCase() === synWord.toLowerCase());
                              const synExtra = synItem ? '' : extraWordInfo(synWord);
                              return <span key={i} style={{ display: 'inline-block', background: synItem ? 'var(--primary-light)' : 'var(--border-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }} onClick={() => { if (synItem) { openDetailItem(synItem); if (settings.navAutoSpeak !== false) speak(synWord, settings.speakRate); } else { speak(synWord, settings.speakRate); } }}>{s}{synExtra && <span style={{ opacity: 0.75, fontSize: 12 }}>（{synExtra}）</span>}</span>;
                            })}
                          </div>
                        </div>
                      )}
                      {enrichment.antonyms.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="bolt" />反义词</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrichment.antonyms.map((a, i) => {
                              const antWord = extractEnglish(a).split(/\s+/)[0];
                              const antItem = allWords.find(w => w.term.toLowerCase() === antWord.toLowerCase());
                              const antExtra = antItem ? '' : extraWordInfo(antWord);
                              return <span key={i} style={{ display: 'inline-block', background: antItem ? 'var(--danger-light)' : 'var(--border-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }} onClick={() => { if (antItem) { openDetailItem(antItem); if (settings.navAutoSpeak !== false) speak(antWord, settings.speakRate); } else { speak(antWord, settings.speakRate); } }}>{a}{antExtra && <span style={{ opacity: 0.75, fontSize: 12 }}>（{antExtra}）</span>}</span>;
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* 闪卡模式或答对时：显示关联词族和易混词 */}
                  {(isFlashcard || isCorrect) && (() => {
                    const family = findWordFamily(displayCurrent.term, allWords);
                    const aiFamilyTerms = getCachedFamily(displayCurrent.term);
                    const aiFamilyItems = aiFamilyTerms
                      .map(w => allWords.find(i => i.term.toLowerCase() === w.toLowerCase()))
                      .filter(Boolean);
                    const localTerms = new Set(family.map(i => i.term.toLowerCase()));
                    const aiOnlyItems = aiFamilyItems.filter(i => !localTerms.has(i.term.toLowerCase()));
                    const allFamily = [...family, ...aiOnlyItems];
                    const confusing = findConfusingWords(displayCurrent.term, allWords);
                    if (allFamily.length === 0 && confusing.length === 0) return null;
                    return (
                      <>
                        {allFamily.length > 0 && (
                          <div className="points" style={{ marginTop: 8 }}>
                            <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="link" />关联词族</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {allFamily.map(item => {
                                const inBank = !!findWordInBank(item.term);
                                return (
                                <span key={item.id} style={{ display: 'inline-block', background: 'var(--primary-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }}
                                  onClick={() => { if (inBank) openDetailItem(item); }}>
                                  {item.term} <small style={{ opacity: 0.7 }}>{item.pos}</small>
                                  {!inBank && item.meaning && <small style={{ opacity: 0.75 }}>（{getShortMeaning(item.meaning) || item.meaning}）</small>}
                                </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        {confusing.length > 0 && (
                          <div className="points" style={{ marginTop: 8 }}>
                            <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}><Icon name="warn" />易混词</p>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {confusing.map(item => {
                                const inBank = !!findWordInBank(item.term);
                                return (
                                <span key={item.id} style={{ display: 'inline-block', background: inBank ? 'var(--primary-light)' : 'var(--border-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13, cursor: 'pointer', border: '1px solid var(--border-light)' }}
                                  onClick={() => { openDetailItem(item); }}>
                                  {item.term} <small style={{ opacity: 0.7 }}>{item.pos}</small>
                                  {!inBank && <small style={{ opacity: 0.6, fontSize: 11 }}>（非当前词库）</small>}
                                </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {(showAll || isFlashcard) && displayCurrent.examples.length > 0 && (
                    <div className="examples">{displayCurrent.examples.map((e, i) => {
                      const [en, zh] = e.split('|||');
                      return (
                        <div key={i} className="examplePair">
                          <p className="exampleEn">{en}</p>
                          {zh && <p className="exampleZh">{zh}</p>}
                        </div>
                      );
                    })}</div>
                  )}
                  <div className="answerActions">
                    <button className="masterBtn" onClick={() => toggleProgress(displayCurrent)}>
                      {progress[termKey(displayCurrent.term)] === 'mastered' ? '取消掌握' : '标记掌握'}
                    </button>
                  </div>
                </div>
                );
              })()}

              {/* 底部导航按钮 */}
              <div className="navButtons">
                <button className="navBtn" onClick={prevCard}><Icon name="chevronLeft" />上一个</button>
                <button className={`navBtn ${autoJumping ? 'autoJumpBtn' : ''}`} onClick={nextCard}>{autoJumping ? '即将自动跳转...' : <>下一个<Icon name="chevronRight" /></>}</button>
                <button className="navBtn skipBtn" onClick={nextCard}>跳过</button>
              </div>
            </div>
          ) : bookDataLoad.status === 'error' ? (
            /* v2.79.0：分片下载失败要有明确出口，不能让用户对着「加载中」一直等 */
            <div className="empty bookDataFail" style={{ textAlign: 'center', padding: '28px 18px' }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#b91c1c', marginBottom: 8 }}>词库数据加载失败</div>
              <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 16 }}>
                {bookDataLoad.reason}
                {bookDataLoad.failedCount > 1 ? `（共 ${bookDataLoad.failedCount} 本词库未加载）` : ''}
              </div>
              <button
                type="button"
                className="bookDataRetryBtn"
                onClick={handleRetryBookData}
                style={{ padding: '9px 26px', fontSize: 14, fontWeight: 600, color: '#fff', background: '#2563eb', border: 0, borderRadius: 10, cursor: 'pointer' }}
              >重试</button>
            </div>
          ) : bookDataLoad.status === 'loading' ? (
            /* v2.79.0：网页版首屏会先出界面，词库数据在后台下载，这里给个明确的等待提示 */
            <div className="empty">词库加载中…<br />首次打开需要下载词库数据，请稍等 1~2 秒。</div>
          ) : (
            <div className="empty">当前筛选下没有内容，请切换词库或分类。</div>
          )}
        </section>
      )}

      {/* ====== 听读页（音乐播放器式：自动播英文+中文） ====== */}
      {section === 'listen' && (
        <section className="panel listenPage">
          <div className="listenTop">
            <div className="multiBookSelect" style={{ position: 'relative', flex: 1 }}>
              <button className="multiBookBtn" onClick={() => toggleListenPanel('books')}>
                {listenActiveBook.name}<Icon name="chevronDown" />
              </button>
              {listenShowBooks && (
                <div className="bookPickerDropdown">
                  <div className="bookPickerActions">
                    <button onClick={() => { stopListenPlayback(); setListenBookIds(['gaokao-3500']); try { localStorage.setItem(LISTEN_BOOKS_KEY, 'gaokao-3500'); } catch (e) {} }}>重置</button>
                  </div>
                  {wrongWords.length > 0 && (
                    <label className="bookPickerItem">
                      <input type="checkbox" checked={listenBookIds.includes('wrong-words')} onChange={() => toggleListenBook('wrong-words')} />
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>错词本</span>
                      <span className="bookCount">({wrongWords.length})</span>
                    </label>
                  )}
                  {books.filter(b => !b.id.includes('confused') && !b.id.includes('dual-sentiment') && !hiddenBookIds.includes(b.id)).map(b => (
                    <label key={b.id} className="bookPickerItem">
                      <input type="checkbox" checked={listenBookIds.includes(b.id)} onChange={() => toggleListenBook(b.id)} />
                      <span>{b.name}</span>
                      <span className="bookCount">({b.items.length || b.total || 0})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <span className="progressTag">{listenDisplayQueue.length ? (listenIndex + 1) : 0}/{listenDisplayQueue.length}</span>
          </div>

          {/* 是否隐藏已掌握 / 是否只播放已掌握 */}
          <div className="listenFilterRow">
            <button className={listenFilter === 'all' ? 'on' : ''} onClick={() => changeListenFilter('all')}>全部 {listenStats.total}</button>
            <button className={listenFilter === 'hide' ? 'on' : ''} onClick={() => changeListenFilter('hide')}>隐藏已掌握 {listenStats.remaining}</button>
            <button className={listenFilter === 'only' ? 'on' : ''} onClick={() => changeListenFilter('only')}>仅已掌握 {listenStats.mastered}</button>
          </div>
          <div className="listenHint">
            {listenFilter === 'hide' ? '已自动跳过标记为掌握的单词' : listenFilter === 'only' ? '只播放已标记掌握的单词，用于巩固复习' : '播放词库内全部单词'}
          </div>

          {/* 播放器主体（v2.66.0：状态胶囊 + 当前词动效） */}
          <div className={'listenCard' + (listenPlaying ? ' playing' : '')}>
            <div className="listenStatusRow">
              <span className={'listenStatusPill' + (listenPlaying && !listenPaused ? ' live' : '')}>
                {listenBuildInfo ? '音频生成中' : (listenPlaying && !listenPaused ? '正在播放' : listenPlaying ? '已暂停' : '待播放')}
              </span>
              <span className="listenCountPill">
                {listenDisplayQueue.length ? (listenIndex + 1) : 0} / {listenDisplayQueue.length}
              </span>
            </div>
            <div className="listenCoverRow">
              <div className={'listenCoverArt' + (listenPlaying && !listenPaused ? ' spin' : '')}><Icon name="headphones" size={46} /></div>
              <div className="listenCoverMain">
                {listenCurrent ? (
                  <React.Fragment>
                    {/* key 随序号变化触发淡入，换词时视觉明显 */}
                    <div className="listenWord" key={'w_' + listenIndex + '_' + (listenCurrent.term || '')}>{listenCurrent.term}</div>
                    <div className="listenSubRow">
                      {listenCurrent.phonetic ? <span className="listenPhonetic">{listenCurrent.phonetic}</span> : null}
                      {listenCurrent.pos ? <span className="listenPosTag">{listenCurrent.pos}</span> : null}
                    </div>
                    <div className="listenMeaning"><Meanings text={listenCurrent.meaning} /></div>
                  </React.Fragment>
                ) : (
                  <div className="listenEmpty">
                    {listenStats.total === 0 ? '当前词库没有单词' : (listenFilter === 'only' ? '还没有标记为已掌握的单词' : '没有可播放的单词')}
                  </div>
                )}
              </div>
            </div>
            {listenBuildInfo ? <div className="listenBuildTip">{listenBuildInfo}</div> : null}

            {listenSystemPlayerOn() && listenDur > 0 ? (
              <div className="listenSeekRow">
                <input
                  className="listenSeek"
                  type="range"
                  min={0}
                  max={listenDur}
                  step={200}
                  value={Math.min(listenPos, listenDur)}
                  onChange={e => seekListen(Number(e.target.value))}
                />
                <div className="listenTimeRow">
                  <span>{fmtDuration(listenPos)}</span>
                  <span>{fmtDuration(listenDur)}</span>
                </div>
              </div>
            ) : (
              <div className="listenBar">
                <div className="listenBarFill" style={{ width: `${listenDisplayQueue.length ? ((listenIndex + 1) / listenDisplayQueue.length * 100) : 0}%` }} />
              </div>
            )}
            <div className="listenMeta">
              第 {listenDisplayQueue.length ? listenIndex + 1 : 0} / {listenDisplayQueue.length} 词 · 已掌握 {listenStats.mastered} / {listenStats.total}
              {listenSystemPlayerOn() ? ' · 系统播放器（锁屏 / 通知栏 / 耳机线控可用）' : ''}
            </div>
          </div>

          {/* 播放控制 */}
          <div className="listenControls">
            <button className="listenSkipBtn" onClick={listenPrev} disabled={!listenDisplayQueue.length} title="上一个"><Icon name="prev" /></button>
            <button className="listenPlayBtn" onClick={toggleListenPlay} disabled={!listenDisplayQueue.length} title="播放/暂停">
              {listenPlaying && !listenPaused ? <Icon name="pause" /> : <Icon name="play" />}
            </button>
            <button className="listenSkipBtn" onClick={listenNext} disabled={!listenDisplayQueue.length} title="下一个"><Icon name="next" /></button>
            <button className="listenMp3Btn" onClick={downloadCurrentMp3} disabled={!listenCurrent} title="下载本词 MP3"><Icon name="download" /></button>
          </div>

          {/* 快捷开关（v2.68.0：去 emoji 分段控件风格） */}
          <div className="listenChips">
            <button onClick={() => updateListenCfg({ loop: listenCfg.loop === 'list' ? 'one' : (listenCfg.loop === 'one' ? 'off' : 'list') })}>
              {listenCfg.loop === 'list' ? '循环 列表' : listenCfg.loop === 'one' ? '循环 单曲' : '循环 关'}
            </button>
            <button className={listenShowSpeed ? 'on' : ''} onClick={() => toggleListenPanel('speed')}>
              {listenCfg.rate.toFixed(2)}x
            </button>
            <button className={listenCfg.shuffle ? 'on' : ''} onClick={() => updateListenCfg({ shuffle: !listenCfg.shuffle })}>随机</button>
            <button className={listenShowCfg ? 'on' : ''} onClick={() => toggleListenPanel('cfg')}>参数</button>
            <button className={listenShowMp3 ? 'on' : ''} onClick={() => toggleListenPanel('mp3')}>MP3</button>
            <button className={listenShowPL ? 'on' : ''} onClick={() => toggleListenPanel('pl')}>列表</button>
          </div>

          {/* v2.76.0：MP3 下载面板（全参数自定义 + 自定义保存目录 + 面板内关闭） */}
          {listenShowMp3 && (
            <div className="listenSettings">
              <div className="sheetHead">
                <b><Icon name="download" />MP3 下载</b>
                <button className="sheetClose" onClick={() => setListenPanel(null)}>完成</button>
              </div>
              <div className="listenSettingRow">
                <span>范围</span>
                <div className="listenSeg">
                  {[20, 50, 100, 300].map(n => (
                    <button key={n} className={mp3Count === n && !mp3CustomCount ? 'on' : ''} onClick={() => { setMp3Count(n); setMp3CustomCount(''); }}>{n} 词</button>
                  ))}
                  <button className={mp3Count === 0 && !mp3CustomCount ? 'on' : ''} onClick={() => { setMp3Count(0); setMp3CustomCount(''); }}>全部</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>自定义</span>
                <div className="mp3NumRow">
                  <label>从第
                    <input type="number" min="1" inputMode="numeric" value={mp3Start}
                      onChange={(e) => setMp3Start(e.target.value.replace(/[^0-9]/g, ''))} />词
                  </label>
                  <label>取
                    <input type="number" min="1" inputMode="numeric" placeholder={String(mp3Count > 0 ? mp3Count : listenDisplayQueue.length)} value={mp3CustomCount}
                      onChange={(e) => setMp3CustomCount(e.target.value.replace(/[^0-9]/g, ''))} />词
                  </label>
                  <span className="muted">共 {listenDisplayQueue.length} 词</span>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>音频内容</span>
                <div className="listenSeg">
                  <button className={mp3SaveScope === 'both' ? 'on' : ''} onClick={() => setMp3SaveScope('both')}>英+中</button>
                  <button className={mp3SaveScope === 'en' ? 'on' : ''} onClick={() => setMp3SaveScope('en')}>仅英文</button>
                  <button className={mp3SaveScope === 'zh' ? 'on' : ''} onClick={() => setMp3SaveScope('zh')}>仅中文</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>导出语速</span>
                <div className="listenSeg">
                  {[0.75, 1, 1.25, 1.5].map(r => (
                    <button key={r} className={(mp3Rate || listenCfg.rate) === r ? 'on' : ''} onClick={() => setMp3Rate(r)}>{r.toFixed(2)}x</button>
                  ))}
                  <button className={mp3Rate === null ? 'on' : ''} onClick={() => setMp3Rate(null)}>跟随听读</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>文件名</span>
                <input className="mp3NameInput" value={mp3Name} placeholder="背群英听读MP3"
                  onChange={(e) => setMp3Name(e.target.value.slice(0, 40))} />
              </div>
              <div className="listenSettingRow">
                <span>保存目录</span>
                <div className="mp3DirRow">
                  <span className="mp3DirLabel" title={mp3Dir || '下载/背群英'}>
                    <Icon name="folder" />{mp3Dir || '默认：下载/背群英'}
                  </span>
                  <button className="smallBtn" onClick={mp3PickDir}>选择</button>
                </div>
              </div>
              <button className="primary mp3Go" onClick={doDownloadMp3} disabled={mp3Busy}>
                {mp3Busy ? `打包中 ${mp3State ? mp3State.done : 0}/${mp3State ? mp3State.total : 0}` : '开始下载 MP3 压缩包'}
              </button>
              {mp3State && !mp3Busy && (
                <div className="mp3Result">
                  <Icon name="check" />
                  <span>{mp3State.msg}</span>
                </div>
              )}
            </div>
          )}

          {/* v2.69.0 语速快捷轮盘 */}
          {listenShowSpeed && (
            <div className="listenSettings listenSpeedSheet">
              <div className="sheetHead">
                <b><Icon name="bolt" />语速</b>
                <button className="sheetClose" onClick={() => setListenPanel(null)}>完成</button>
              </div>
              <WheelPicker values={WHEEL_RATE} value={listenCfg.rate} onChange={function (v) { updateListenCfg({ rate: v }); }} format={function (v) { return v.toFixed(2) + 'x'; }} width={180} />
            </div>
          )}

          {/* 朗读参数 */}
          {listenShowCfg && (
            <div className="listenSettings">
              <div className="sheetHead">
                <b><Icon name="sliders" />朗读参数</b>
                <button className="sheetClose" onClick={() => setListenPanel(null)}>完成</button>
              </div>
              {/* v2.70.0 数值参数改为横向轮盘：左右滑动选择，精度自定义 */}
              <div className="wheelRow">
                <span className="wheelRowLabel">英文遍数</span>
                <WheelPicker values={WHEEL_EN_REPEAT} value={listenCfg.enRepeat} onChange={function (n) { updateListenCfg({ enRepeat: n }); }} format={function (v) { return v + ' 遍'; }} />
              </div>
              <div className="wheelRow">
                <span className="wheelRowLabel">中文遍数</span>
                <WheelPicker values={WHEEL_ZH_REPEAT} value={listenCfg.zhRepeat} onChange={function (n) { updateListenCfg({ zhRepeat: n }); }} format={function (v) { return v === 0 ? '不读中文' : v + ' 遍'; }} />
              </div>
              <div className="wheelRow">
                <span className="wheelRowLabel">语速</span>
                <WheelPicker values={WHEEL_RATE} value={listenCfg.rate} onChange={function (v) { updateListenCfg({ rate: v }); }} format={function (v) { return v.toFixed(2) + 'x'; }} />
              </div>
              <div className="wheelRow">
                <span className="wheelRowLabel">词间间隔</span>
                <WheelPicker values={WHEEL_WORD_GAP} value={listenCfg.wordGap} onChange={function (v) { updateListenCfg({ wordGap: v }); }} format={function (v) { return v + ' 秒'; }} />
              </div>
              <div className="wheelRow">
                <span className="wheelRowLabel">遍间隔</span>
                <WheelPicker values={WHEEL_INNER_GAP} value={listenCfg.innerGap} onChange={function (v) { updateListenCfg({ innerGap: v }); }} format={function (v) { return v + ' 秒'; }} />
              </div>
              <div className="listenSettingRow">
                <span>朗读顺序</span>
                <div className="listenSeg">
                  <button className={listenCfg.order === 'en-zh' ? 'on' : ''} onClick={() => updateListenCfg({ order: 'en-zh' })}>英→中</button>
                  <button className={listenCfg.order === 'zh-en' ? 'on' : ''} onClick={() => updateListenCfg({ order: 'zh-en' })}>中→英</button>
                  <button className={listenCfg.order === 'en' ? 'on' : ''} onClick={() => updateListenCfg({ order: 'en' })}>仅英文</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>后台播放</span>
                <div className="listenSeg">
                  <button className={listenCfg.systemPlayer !== false ? 'on' : ''} onClick={() => updateListenCfg({ systemPlayer: true })}>系统播放器</button>
                  <button className={listenCfg.systemPlayer === false ? 'on' : ''} onClick={() => updateListenCfg({ systemPlayer: false })}>仅应用内</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>中文发音</span>
                <div className="listenSeg">
                  <button className={listenCfg.zhSource === 'auto' ? 'on' : ''} onClick={() => updateListenCfg({ zhSource: 'auto' })}>自动·推荐</button>
                  <button className={listenCfg.zhSource === 'net' ? 'on' : ''} onClick={() => updateListenCfg({ zhSource: 'net' })}>网络配音</button>
                  <button className={listenCfg.zhSource === 'system' ? 'on' : ''} onClick={() => updateListenCfg({ zhSource: 'system' })}>手机语音</button>
                </div>
              </div>
              {(listenCfg.zhSource === 'net' || listenCfg.zhSource === 'auto') && (
                <React.Fragment>
                  <div className="listenSettingRow">
                    <span>配音音色</span>
                    <div className="listenSeg">
                      {[[0, '晓晓·女'], [3, '云希·男'], [4, '晓伊·活力']].map(function (v) {
                        return <button key={v[0]} className={listenCfg.zhVoice === v[0] ? 'on' : ''} onClick={() => updateListenCfg({ zhVoice: v[0] })}>{v[1]}</button>;
                      })}
                    </div>
                  </div>
                  <div className="listenTip" style={{ fontSize: 12, color: '#64748b' }}>
                    音色切换依赖神经语音通道；该通道不可用时统一使用云端配音（不切换音色）。
                  </div>
                </React.Fragment>
              )}
              {listenBuildInfo && <div className="listenTip" style={{ color: '#2563eb', fontWeight: 600 }}>{listenBuildInfo}</div>}
              {mediaBlocked && (
                <div className="listenTip mediaWarn" onClick={() => {
                  try { window.NativeAudio && window.NativeAudio.openNotificationSettings && window.NativeAudio.openNotificationSettings(); } catch (e) {}
                }}>
                  <Icon name="bellOff" />
                  <span>控制中心看不到播放卡片：{mediaBlocked}。点此处去开启通知</span>
                </div>
              )}
              {ttsEngine && (
                <div className="listenTip" style={{ color: '#64748b' }}>
                  <Icon name="music" />
                  <span>中文语音引擎：{ttsEngine}</span>
                </div>
              )}
            </div>
          )}

          {/* 播放列表（v2.66.0：稳定分块窗口 + 自动滚动跟随当前词） */}
          {listenShowPL && (
            <div className="listenPlaylist" ref={listenPlRef}>
              <div className="sheetHead">
                <b><Icon name="list" />播放列表</b>
                <button className="sheetClose" onClick={() => setListenPanel(null)}>完成</button>
              </div>
              {(() => {
                const total = listenDisplayQueue.length;
                if (!total) return <div className="listenEmpty">暂无单词</div>;
                // 按 30 词一块取窗口：块内序号变化不重建列表（避免整列表跳动），
                // 再由 useEffect 的 scrollIntoView 把当前词稳稳居中。
                const BLOCK = 30;
                const startAt = Math.max(0, Math.floor(listenIndex / BLOCK) * BLOCK - BLOCK);
                const endAt = Math.min(total, startAt + BLOCK * 4);
                const rows = [];
                for (let i2 = startAt; i2 < endAt; i2++) {
                  const it = listenDisplayQueue[i2];
                  const on = i2 === listenIndex;
                  rows.push(
                    <button
                      key={(it.term || '') + '_' + i2}
                      ref={on ? listenPlCurRef : null}
                      className={'listenPLItem' + (on ? ' on' : '')}
                      onClick={() => jumpListenTo(i2)}
                    >
                      <span className="listenPLIdx">{i2 + 1}</span>
                      <span className="listenPLTerm">{it.term}</span>
                      <span className="listenPLMeaning"><Meanings text={it.meaning} /></span>
                      {on && listenPlaying && !listenPaused ? <span className="listenPLWave"><i /><i /><i /></span> : null}
                    </button>
                  );
                }
                return rows;
              })()}
            </div>
          )}
        </section>
      )}

      {/* ====== 错词本页 ====== */}
      {section === 'wrong' && (
        <section className="panel">
          <div className="libraryHeader">
            <h2 className="sectionTitle">错词本</h2>
            {wrongWords.length > 0 && <button className="smallBtn dangerGhost" onClick={clearWrongWords}>清空</button>}
          </div>
          <p className="muted">答错的单词会自动加入这里，方便集中复习。掌握后可移除。</p>
          {wrongWords.length > 0 && (
            <input
              type="text"
              placeholder="搜索错词..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ marginTop: 12 }}
            />
          )}
          {(() => {
            const filteredWrong = wrongWords.filter(item =>
              !search || `${item.term}${item.meaning}${item.pos}`.toLowerCase().includes(search.toLowerCase())
            );
            if (filteredWrong.length === 0) return (
              <div className="empty" style={{ marginTop: 16 }}>
                {search ? '没有找到匹配的错词' : '还没有错词，继续加油！'}
              </div>
            );
            return (
            <div className="list">
              {filteredWrong.map(item => (
                <article key={item.id} className="listItem" onClick={() => openDetailItem(item)}>
                  <div className="listItemMain">
                    <div className="listItemTitle">
                      <h3 style={{ color: '#ef4444' }}>{item.term}</h3>
                      {item.phonetic && <span className="phoneticSmall">{item.phonetic}</span>}
                      {item.pos && <span className="posTag" style={{ color: posColor(item.pos), background: posColor(item.pos) + '18' }}>{item.pos}</span>}
                    </div>
                    <p>{getShortMeaning(item.meaning)}</p>
                    <small>
                      {item.sourceBooks && item.sourceBooks.length > 0
                        ? `词库：${item.sourceBooks.join('、')}`
                        : `来源：${item.source || '未知'}`}
                      · {new Date(item.wrongAt).toLocaleDateString()}
                    </small>
                  </div>
                  <div className="listActions" onClick={e => e.stopPropagation()}>
                    <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}><Icon name="speaker" /></button>
                    <button className="smallBtn masterBtn" onClick={() => { toggleProgress(item); removeWrongWord(item.id); }}>已掌握</button>
                    <button className="smallBtn dangerGhost" onClick={() => removeWrongWord(item.id)}>移除</button>
                  </div>
                </article>
              ))}
            </div>
            );
          })()}
        </section>
      )}

      {/* ====== 词库页 ====== */}
      {section === 'library' && (
        <section className="panel">
          <div className="libraryHeader">
            <div className="multiBookSelect" style={{ position: 'relative', flex: 1 }}>
              <button className="multiBookBtn" onClick={() => setShowBookPicker2(!showBookPicker2)}>
                {activeBook.name}<Icon name="chevronDown" />
              </button>
              {showBookPicker2 && (
                <div className="bookPickerDropdown">
                  <div className="bookPickerActions">
                    <button onClick={selectAllLibraryBooks}>{books.filter(b => !hiddenBookIds.includes(b.id)).every(b => libraryBookIds.includes(b.id)) ? '全不选' : '全选'}</button>
                    <button onClick={() => { setLibraryBookIds(['gaokao-3500']); try { localStorage.setItem('gaokao_library_books', 'gaokao-3500'); } catch {} }}>重置</button>
                  </div>
                  {books.filter(b => !hiddenBookIds.includes(b.id)).map(b => (
                    <label key={b.id} className="bookPickerItem">
                      <input type="checkbox" checked={libraryBookIds.includes(b.id)} onChange={() => switchLibraryBook(b.id)} />
                      <span>{b.name}</span>
                      <span className="bookCount">({b.items.length || b.total || 0})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={createBook}>+ 新建</button>
            <button className="exportVocabBtn" onClick={() => setShowExport(!showExport)}>导出词库</button>
          </div>
          {showExport && (
            <div className="exportPanel">
              <div className="listenSettingRow">
                <span>导出范围</span>
                <div className="listenSeg">
                  <button className={exportScope === 'book' ? 'on' : ''} onClick={() => setExportScope('book')}>当前词库</button>
                  <button className={exportScope === 'filtered' ? 'on' : ''} onClick={() => setExportScope('filtered')}>筛选结果</button>
                  <button className={exportScope === 'all' ? 'on' : ''} onClick={() => setExportScope('all')}>全部词库</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>掌握状态</span>
                <div className="listenSeg">
                  <button className={exportScope === 'mastered' ? 'on' : ''} onClick={() => setExportScope('mastered')}>已掌握</button>
                  <button className={exportScope === 'unmastered' ? 'on' : ''} onClick={() => setExportScope('unmastered')}>未掌握</button>
                  <button className={exportScope === 'wrong' ? 'on' : ''} onClick={() => setExportScope('wrong')}>错词本</button>
                </div>
              </div>
              <div className="listenSettingRow">
                <span>分隔方式</span>
                <InlineSelect
                  value={exportSep}
                  onChange={v => { setExportSep(v); setExportMsg(''); }}
                  options={[
                    { value: 'space', label: '空格（单词 释义）' },
                    { value: 'tab', label: 'Tab（粘进 Excel）' },
                    { value: 'comma', label: '逗号（单词, 释义）' },
                    { value: 'semi', label: '分号（单词; 释义）' },
                    { value: 'word', label: '仅单词（不带释义）' },
                    { value: 'custom', label: '自定义分隔符…' },
                  ]}
                />
              </div>
              {exportSep === 'custom' && (
                <div className="listenSettingRow">
                  <span>自定义</span>
                  <input
                    className="exportSepInput"
                    value={exportSepCustom}
                    placeholder="输入分隔符，如 | 或 —— （可用 \t 表示制表符）"
                    onChange={e => { setExportSepCustom(e.target.value); setExportMsg(''); }}
                  />
                </div>
              )}
              <div className="exportPreview">
                <div className="exportPreviewTitle">格式预览（前 2 行；· = 空格，⇥ = Tab）</div>
                <pre className="exportPreviewBody">{exportPreview()}</pre>
              </div>
              <div className="exportActions">
                <button className="primary" onClick={doCopyExport}>复制到剪贴板</button>
                <button className="primary ghost" onClick={doDownloadExport}>下载 txt</button>
              </div>
              {exportMsg ? <div className="listenTip exportMsgBox">{exportMsg}</div> : null}
              {/* v2.72.0 百词斩直导：固定英文逗号 + 纯单词，粘贴即导入 */}
              {(() => {
                const info = getBcBatchText(bcBatch);
                if (!info.total) return null;
                return (
                  <div className="bcDirectBox">
                    <div className="bcDirectHead">
                      <b>百词斩直导</b>
                      <span>共 {info.total} 词 · {info.totalBatches} 批（每批 ≤500）</span>
                    </div>
                    <p className="bcDirectTip">格式为英文逗号分隔的纯单词，百词斩「词本 → 添加单词」长按粘贴即可直接导入，不需要再改格式。</p>
                    <div className="exportActions">
                      {info.batch > 0 && <button onClick={() => setBcBatch(info.batch - 1)}>上一批</button>}
                      <button className="primary" style={{ flex: 1 }} onClick={doCopyBcBatch}>复制第 {info.batch + 1}/{info.totalBatches} 批</button>
                      {info.batch + 1 < info.totalBatches && <button onClick={() => setBcBatch(info.batch + 1)}>下一批</button>}
                    </div>
                  </div>
                );
              })()}
              <div className="listenTip">「复制到剪贴板」按上面选的分隔方式输出「单词 + 释义」，适合 Excel / 墨墨 / Anki；「百词斩直导」固定英文逗号 + 纯单词，是百词斩能直接吃下的格式。</div>
            </div>
          )}
          <input className="searchInput" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索英文、中文、词性..." />
          {/* 词性分类标签（横向滚动） */}
          <div className="posFilterRow">
            {posFilterList.map(f => (
              <button key={f.id} className={`posFilterBtn ${posFilter === f.id ? 'active' : ''}`} onClick={() => { setPosFilter(f.id); setIndex(0); }}>{f.label}</button>
            ))}
          </div>
          {/* 词条列表 */}
          <div className="list">
            {filteredItems.slice(0, libraryLimit).map(item => (
              <article key={item.id} className="listItem" onClick={() => openDetailItem(item)}>
                <div className="listItemMain">
                  <div className="listItemTitle">
                    <h3 style={{ color: wordStatusColor(item, progress, wrongWords) || freqColor(item.frequency) }}>{item.term}</h3>
                    {item.phonetic && <span className="phoneticSmall">{item.phonetic}</span>}
                    {item.pos && <span className="posTag" style={{ color: posColor(item.pos), background: posColor(item.pos) + '18' }}>{item.pos}</span>}
                    <span className="freqTag" style={{ color: freqColor(item.frequency), borderColor: freqColor(item.frequency) }}>{item.frequency}</span>
                  </div>
                  <p>{getShortMeaning(item.meaning)}</p>
                </div>
                <div className="listActions" onClick={e => e.stopPropagation()}>
                  <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}><Icon name="speaker" /></button>
                  <button className={`smallBtn ${progress[termKey(item.term)] === 'mastered' ? 'masterBtn' : ''}`} onClick={() => toggleProgress(item)}>
                    {progress[termKey(item.term)] === 'mastered' ? '已掌握' : '未掌握'}
                  </button>
                  {activeBook.editable && <button className="smallBtn dangerGhost" onClick={() => deleteItem(item.id)}>删</button>}
                </div>
              </article>
            ))}
          </div>
          {filteredItems.length > libraryLimit && (
            <button className="primary" style={{ width: '100%', marginTop: 8 }} onClick={() => setLibraryLimit(n => n + 60)}>
              加载更多（剩余 {filteredItems.length - libraryLimit} 个）
            </button>
          )}
        </section>
      )}

      {/* ====== 温习页面（全屏覆盖，从"我的"页面打开） ====== */}
      {showReview && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg)', zIndex: 1000,
          overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        }}>
          <div style={{ maxWidth: 600, margin: '0 auto', padding: '16px 16px 80px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <button className="closeBtn" onClick={() => setShowReview(false)} title="返回" style={{ flexShrink: 0 }}><Icon name="chevronLeft" /></button>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>温习</h2>
            </div>
            <div style={{ textAlign: 'center', margin: '0 0 8px', padding: '10px 16px', background: 'linear-gradient(135deg, #f0f7ff 0%, #fff8f0 100%)', borderRadius: 10, border: '1px solid var(--border)' }}>
              <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--primary-dark)', margin: 0, letterSpacing: 2 }}>温故而知新，可以为师矣</p>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0' }}>——《论语·为政》</p>
            </div>
            <p className="muted" style={{ margin: '8px 0' }}>按日期回顾每天学习的单词，支持列表浏览和背诵两种模式。</p>

          {/* 日期选择器：显示有学习记录的日期 */}
          {(() => {
            const studyDates = Object.keys(studyWordsLog).filter(d => studyWordsLog[d] && studyWordsLog[d].length > 0).sort().reverse();
            if (studyDates.length === 0) {
              return <div className="empty" style={{ marginTop: 16 }}>还没有学习记录，去背诵几个单词吧！</div>;
            }
            return (
              <>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                  {studyDates.map(d => {
                    const dateObj = new Date(d);
                    const isToday = d === getToday();
                    const isSelected = d === reviewDate;
                    const count = studyWordsLog[d].length;
                    return (
                      <button key={d} style={{
                        flexShrink: 0, padding: '8px 12px', borderRadius: 8, border: '1px solid',
                        borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                        background: isSelected ? 'var(--primary-light)' : 'transparent',
                        fontWeight: isSelected ? 700 : 400, fontSize: 13, cursor: 'pointer',
                        color: isSelected ? 'var(--primary-dark)' : 'var(--text)',
                      }} onClick={() => { setReviewDate(d); setReviewIndex(0); setReviewShowBack(false); setReviewSelected(''); }}>
                        <div>{isToday ? '今天' : `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`}</div>
                        <small style={{ opacity: 0.7 }}>{count}词</small>
                      </button>
                    );
                  })}
                </div>

                {/* 模式切换 */}
                <div className="segmented" style={{ marginTop: 12 }}>
                  <button className={reviewMode === 'list' ? 'active' : ''} onClick={() => setReviewMode('list')}><Icon name="list" />列表模式</button>
                  <button className={reviewMode === 'practice' ? 'active' : ''} onClick={() => { setReviewMode('practice'); setReviewIndex(0); setReviewShowBack(false); setReviewSelected(''); }}><Icon name="note" />背诵模式</button>
                </div>

                {/* 列表模式 */}
                {reviewMode === 'list' && (() => {
                  const words = studyWordsLog[reviewDate] || [];
                  if (words.length === 0) return <div className="empty" style={{ marginTop: 16 }}>该日期没有学习记录</div>;
                  return (
                    <div className="list" style={{ marginTop: 12 }}>
                      {words.map((item, i) => (
                        <article key={i} className="listItem" onClick={() => openDetailItem(item)}>
                          <div className="listItemMain">
                            <div className="listItemTitle">
                              <h3>{item.term}</h3>
                              {item.phonetic && <span className="phoneticSmall">{item.phonetic}</span>}
                              {item.pos && <span className="posTag" style={{ color: posColor(item.pos), background: posColor(item.pos) + '18' }}>{item.pos}</span>}
                              {progress[termKey(item.term)] === 'mastered' && <span className="masteredTag">已掌握</span>}
                            </div>
                            <p>{getShortMeaning(item.meaning)}</p>
                          </div>
                          <div className="listActions" onClick={e => e.stopPropagation()}>
                            <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}><Icon name="speaker" /></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  );
                })()}

                {/* 背诵模式 */}
                {reviewMode === 'practice' && (() => {
                  const words = studyWordsLog[reviewDate] || [];
                  if (words.length === 0) return <div className="empty" style={{ marginTop: 16 }}>该日期没有学习记录</div>;
                  const reviewItem = words[reviewIndex % words.length];
                  if (!reviewItem) return null;
                  return (
                    <div className="card" style={{ marginTop: 12 }}>
                      <div className="cardMeta">
                        <span className="progressTag">{reviewIndex + 1}/{words.length}</span>
                        {reviewItem.pos && <span className="posTag" style={{ color: posColor(reviewItem.pos), background: posColor(reviewItem.pos) + '18' }}>{reviewItem.pos}</span>}
                        {progress[termKey(reviewItem.term)] === 'mastered' && <span className="masteredTag">已掌握</span>}
                      </div>
                      <div className="questionArea">
                        <h2>{reviewItem.term}</h2>
                        {reviewItem.phonetic && <p className="phoneticText">{reviewItem.phonetic}</p>}
                        <button className="sound" onClick={() => speak(reviewItem.term, settings.speakRate)}><Icon name="speaker" />发音</button>
                      </div>
                      {!reviewShowBack && !reviewSelected && (
                        <button className="primary" onClick={() => setReviewShowBack(true)}>显示释义</button>
                      )}
                      {(reviewShowBack || reviewSelected) && (
                        <div className="answerBox">
                          <h3>{reviewItem.term} &middot; <Meanings text={reviewItem.meaning} /></h3>
                          {reviewItem.pos && <p className="muted">{reviewItem.pos} &middot; {reviewItem.source || ''}</p>}
                          {(() => {
                            const mp = getMergedPoints(reviewItem); // v2.56.0 跨词库考点整合
                            return mp.corePoints.length > 0 ? (
                              <div className="points">
                                {mp.corePoints.map((p, i) => <p key={i}>• {p}</p>)}
                              </div>
                            ) : null;
                          })()}
                          {reviewItem.examples && reviewItem.examples.length > 0 && (
                            <div className="examples" style={{ marginTop: 8 }}>
                              {reviewItem.examples.map((e, i) => {
                                const [en, zh] = e.split('|||');
                                return (
                                  <div key={i} className="examplePair">
                                    <p className="exampleEn" style={{ cursor: 'pointer' }} onClick={() => speak(extractEnglish(en), settings.speakRate)}>{en}</p>
                                    {zh && <p className="exampleZh">{zh}</p>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="answerActions">
                            <button className="masterBtn" onClick={() => toggleProgress(reviewItem)}>
                              {progress[termKey(reviewItem.term)] === 'mastered' ? '取消掌握' : '标记掌握'}
                            </button>
                          </div>
                          <div className="navButtons">
                            <button className="navBtn" onClick={() => { setReviewIndex(i => (i - 1 + words.length) % words.length); setReviewShowBack(false); setReviewSelected(''); }}><Icon name="chevronLeft" />上一个</button>
                            <button className="navBtn" onClick={() => { setReviewIndex(i => (i + 1) % words.length); setReviewShowBack(false); setReviewSelected(''); }}>下一个<Icon name="chevronRight" /></button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            );
          })()}
          </div>
        </div>
      )}

      {/* ====== 扩展页（词根词缀+对比+易错词） ====== */}
      {section === 'extend' && (
        <section className="panel">
          <div className="segmented">
            <button className={extendTab === 'affix' ? 'active' : ''} onClick={() => setExtendTab('affix')}>词根词缀</button>
            <button className={extendTab === 'compare' ? 'active' : ''} onClick={() => setExtendTab('compare')}>对比记忆</button>
            <button className={extendTab === 'errors' ? 'active' : ''} onClick={() => setExtendTab('errors')}>易错词</button>
            <button className={extendTab === 'scene' ? 'active' : ''} onClick={() => setExtendTab('scene')}>情景记忆</button>
            <button className={extendTab === 'spelling' ? 'active' : ''} onClick={() => setExtendTab('spelling')}>拼写纠错</button>
            <button className={extendTab === 'numberdate' ? 'active' : ''} onClick={() => setExtendTab('numberdate')}>数字日期</button>
            <button className={extendTab === 'transform' ? 'active' : ''} onClick={() => setExtendTab('transform')}>变形扩展</button>
          </div>

          {/* 词根词缀 */}
          {extendTab === 'affix' && (
            <>
              <div className="segmented">
                <button className={affixTab === 'prefix' ? 'active' : ''} onClick={() => setAffixTab('prefix')}>前缀</button>
                <button className={affixTab === 'suffix' ? 'active' : ''} onClick={() => setAffixTab('suffix')}>后缀</button>
                <button className={affixTab === 'root' ? 'active' : ''} onClick={() => setAffixTab('root')}>词根</button>
              </div>
              <div className="affixList">
                {(affixTab === 'prefix' ? affixData.prefixes : affixTab === 'suffix' ? affixData.suffixes : affixData.roots).map(([name, meaning, property, examPoint, examples], i) => (
                  <div key={i} className="affixCard">
                    <div className="affixHeader">
                      <span className="affixName" style={{ color: affixTab === 'root' ? '#7c3aed' : '#2563eb' }}>{name}</span>
                      <span className="affixProperty">{property}</span>
                    </div>
                    <div className="affixMeaning">中文意义：{meaning}</div>
                    {examPoint && <div className="affixExamPoint"><Icon name="note" />{examPoint}</div>}
                    <button className="affixToggleBtn" onClick={() => setShowAffixWords(prev => ({ ...prev, [name]: !prev[name] }))}>
                      {showAffixWords[name] ? <>隐藏词库单词<Icon name="chevronDown" className="caretUp" /></> : <>显示词库单词<Icon name="chevronDown" /></>}
                    </button>
                    {showAffixWords[name] && (
                      <div className="affixExamples">
                        {(affixMatchWords[name] || []).length > 0 ? (
                          (affixMatchWords[name] || []).map(w => (
                            <span key={w.id} className="affixExample" onClick={() => speakOrNavigate(w.term)}>{w.term}{getShortMeaning(w.meaning) && <span className="sceneWordMeaning">（{getShortMeaning(w.meaning)}）</span>}</span>
                          ))
                        ) : (
                          <span className="affixNoMatch">词库中暂无含该词根词缀的单词</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 对比记忆 */}
          {extendTab === 'compare' && (
            <>
              <div className="segmented">
                <button className={compareTab === 'synonym' ? 'active' : ''} onClick={() => { setCompareTab('synonym'); setCompareIndex(0); }}>同义词</button>
                <button className={compareTab === 'antonym' ? 'active' : ''} onClick={() => { setCompareTab('antonym'); setCompareIndex(0); }}>反义词</button>
              </div>
              {compareCurrent && (
                <div className="card">
                  <div className="cardMeta">
                    <span>{compareIndex + 1}/{compareItems.length}</span>
                  </div>
                  <h2 className="compareTitle">
                    {compareCurrent.term.split(' / ').map((word, i, arr) => {
                      const wItem = findWordInBank(word);
                      const wMeaning = wItem ? getShortMeaning(wItem.meaning) : '';
                      return (
                        <span key={i}>
                          <span style={{ cursor: 'pointer', color: wItem ? '#2563eb' : 'inherit' }} onClick={() => speakOrNavigate(word)}>{word}</span>
                          {wMeaning && <span className="sceneWordMeaning">（{wMeaning}）</span>}
                          {i < arr.length - 1 && ' / '}
                        </span>
                      );
                    })}
                  </h2>
                  <p className="compareMeaning"><Meanings text={compareCurrent.meaning} /></p>
                  <div className="points">
                    {compareCurrent.allPoints.map(p => <p key={p}>• {p}</p>)}
                  </div>
                  {compareCurrent.examples && compareCurrent.examples.length > 0 && (
                    <div className="points" style={{ marginTop: 8 }}>
                      {compareCurrent.examples.map((ex, i) => {
                        const [en, zh] = ex.split('|||');
                        return (
                          <div key={i} className="examplePair" style={{ padding: '4px 8px', marginBottom: 4 }}>
                            <p style={{ margin: 0, fontSize: '0.85em' }}>• {en}</p>
                            {zh && <p style={{ margin: '0 0 0 10px', fontSize: '0.78em', color: 'var(--text-tertiary)' }}>{zh}</p>}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="compareNav">
                    <button className="primary" onClick={() => setCompareIndex(i => (i - 1 + compareItems.length) % compareItems.length)}><Icon name="chevronLeft" />上一个</button>
                    <button className="primary" onClick={() => setCompareIndex(i => (i + 1) % compareItems.length)}>下一个<Icon name="chevronRight" /></button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 易错词 */}
          {extendTab === 'errors' && (() => {
            const errorBooks = ['gaokao-familiar-new', 'gaokao-dual-sentiment'];
            return (
            <div className="errorBookList">
              {errorBooks.map(bookId => {
                const b = books.find(bk => bk.id === bookId);
                if (!b) return null;
                return (
                  <div key={bookId} className="errorSection">
                    <h3 className="errorSectionTitle">{b.name}</h3>
                    <div className="list">
                      {b.items.map(item => (
                        <article key={item.id} className="listItem" onClick={() => openDetailItem(item)}>
                          <div>
                            <h3 style={{ color: freqColor(item.frequency) }}>{item.term}</h3>
                            <p>{getShortMeaning(item.meaning)}</p>
                          </div>
                          <div className="listActions">
                            <button className="smallBtn" onClick={(e) => { e.stopPropagation(); speak(item.term, settings.speakRate); }}><Icon name="speaker" /></button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            );
          })()}

          {/* 情景记忆 */}
          {extendTab === 'scene' && (() => {
            const SCENE_PAGE_SIZE = 3;
            const totalScenePages = Math.ceil(sceneData.length / SCENE_PAGE_SIZE);
            const safePage = Math.min(scenePage, totalScenePages - 1);
            const startIdx = safePage * SCENE_PAGE_SIZE;
            const currentScenes = sceneData.slice(startIdx, startIdx + SCENE_PAGE_SIZE);
            return (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p className="muted" style={{ margin: 0 }}>高考真题主题文章 · 点击单词查看详情</p>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{startIdx + 1}-{Math.min(startIdx + SCENE_PAGE_SIZE, sceneData.length)} / {sceneData.length}</span>
              </div>
              {currentScenes.map((scene, i) => (
                <div key={startIdx + i} className="sceneCard">
                  <h3>{scene.title}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {scene.words.map((w, j) => {
                      const wordItem = findWordInBank(w);
                      let meaning = wordItem ? getShortMeaning(wordItem.meaning) : '';
                      if (!meaning) meaning = sceneWordCn[w.toLowerCase()] || '';
                      return (
                        <span key={j} className="sceneWord"
                          onClick={() => speakOrNavigate(w)}>
                          {w}{meaning && <span className="sceneWordMeaning">（{meaning}）</span>}
                        </span>
                      );
                    })}
                  </div>
                  <div className="sceneText">
                    {(() => {
                      const words = scene.words.map(w => w.toLowerCase());
                      const tokens = scene.text.split(/(\b[a-zA-Z][a-zA-Z'-]*\b)/g);
                      return tokens.map((tok, i) => {
                        if (words.includes(tok.toLowerCase())) {
                          return <span key={i} style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 600 }} onClick={() => speakOrNavigate(tok)}>{tok}</span>;
                        }
                        return <span key={i}>{tok}</span>;
                      });
                    })()}
                  </div>
                  <div className="sceneTextCn">{scene.textCn}</div>
                </div>
              ))}
              {/* 分页控件 */}
              {totalScenePages > 1 && (
                <div className="scenePagination">
                  <button
                    className="scenePageBtn"
                    disabled={safePage === 0}
                    onClick={() => setScenePage(p => Math.max(0, p - 1))}
                  ><Icon name="chevronLeft" />上一页</button>
                  <div className="scenePageDots">
                    {Array.from({ length: totalScenePages }).map((_, i) => (
                      <span
                        key={i}
                        className={`scenePageDot ${i === safePage ? 'active' : ''}`}
                        onClick={() => setScenePage(i)}
                      />
                    ))}
                  </div>
                  <button
                    className="scenePageBtn"
                    disabled={safePage >= totalScenePages - 1}
                    onClick={() => setScenePage(p => Math.min(totalScenePages - 1, p + 1))}
                  >下一页<Icon name="chevronRight" /></button>
                </div>
              )}
            </div>
            );
          })()}

          {/* 拼写纠错 */}
          {extendTab === 'spelling' && (
            <div className="spellingList">
              <input
                type="text"
                className="searchInput"
                placeholder="搜索拼写单词..."
                value={spellingSearch}
                onChange={e => setSpellingSearch(e.target.value)}
              />
              <p className="muted">以下是高考英语中常见的拼写错误对比，蓝色为正确拼写，红色删除线为常见错误。</p>
              {[...spellingData, ...loadCustomSpelling()]
                .filter(item =>
                  item.correct.toLowerCase().includes(spellingSearch.toLowerCase()) ||
                  item.wrong.toLowerCase().includes(spellingSearch.toLowerCase())
                )
                .map((item, i) => {
                  const wItem = findWordInBank(item.correct);
                  const wMeaning = wItem ? getShortMeaning(wItem.meaning) : '';
                  return (
                  <div key={i} className="spellingCard">
                    <div className="spellingRow">
                      <span className="spellingCorrect" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(item.correct)}>{item.correct}</span>
                      {wMeaning && <span className="sceneWordMeaning">（{wMeaning}）</span>}
                      <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                      <span className="spellingWrong">{item.wrong}</span>
                    </div>
                    <div className="spellingTip">{item.tip}</div>
                  </div>
                  );
                })}
            </div>
          )}

          {/* 数字日期 */}
          {extendTab === 'numberdate' && (
            <div style={{ marginTop: 16 }}>
              <div className="segmented" style={{ marginBottom: 16 }}>
                {[
                  { key: 'months', label: '月份' },
                  { key: 'weekdays', label: '星期' },
                  { key: 'seasons', label: '季节' },
                  { key: 'dateWords', label: '日期词汇' },
                  { key: 'numbers', label: '数字' },
                ].map(t => (
                  <button key={t.key} className={numberDateSubTab === t.key ? 'active' : ''} onClick={() => setNumberDateSubTab(t.key)}>{t.label}</button>
                ))}
              </div>
              {/* 月份 */}
              {numberDateSubTab === 'months' && (
                <div>
                  <p className="muted">点击单词可听发音或查看详情。缩写在日记、书信中常用。</p>
                  <div className="list">
                    {numberDateData.months.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(m.word)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                            <span className="posTag" style={{ color: '#2563eb', background: '#2563eb18' }}>{m.abbr}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#2563eb' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => {
                            const [en, zh] = ex.split('|||');
                            return (
                              <div key={j} className="examplePair" style={{ padding: '4px 8px', marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: '0.85em' }}>• {en}</p>
                                {zh && <p style={{ margin: '0 0 0 10px', fontSize: '0.78em', color: 'var(--text-tertiary)' }}>{zh}</p>}
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 星期 */}
              {numberDateSubTab === 'weekdays' && (
                <div>
                  <p className="muted">星期一到星期日的英文表达，点击可听发音或查看详情。</p>
                  <div className="list">
                    {numberDateData.weekdays.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(m.word)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                            <span className="posTag" style={{ color: '#7c3aed', background: '#7c3aed18' }}>{m.abbr}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#7c3aed' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => {
                            const [en, zh] = ex.split('|||');
                            return (
                              <div key={j} className="examplePair" style={{ padding: '4px 8px', marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: '0.85em' }}>• {en}</p>
                                {zh && <p style={{ margin: '0 0 0 10px', fontSize: '0.78em', color: 'var(--text-tertiary)' }}>{zh}</p>}
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 季节 */}
              {numberDateSubTab === 'seasons' && (
                <div>
                  <p className="muted">四季的英文表达。注意 autumn（英式）和 fall（美式）两种写法。点击可听发音或查看详情。</p>
                  <div className="list">
                    {numberDateData.seasons.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(m.word)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#16a34a' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => {
                            const [en, zh] = ex.split('|||');
                            return (
                              <div key={j} className="examplePair" style={{ padding: '4px 8px', marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: '0.85em' }}>• {en}</p>
                                {zh && <p style={{ margin: '0 0 0 10px', fontSize: '0.78em', color: 'var(--text-tertiary)' }}>{zh}</p>}
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 日期词汇 */}
              {numberDateSubTab === 'dateWords' && (
                <div>
                  <p className="muted">与日期时间相关的高频词汇。点击可听发音或查看详情。</p>
                  <div className="list">
                    {numberDateData.dateWords.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(m.word)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#ea580c' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => {
                            const [en, zh] = ex.split('|||');
                            return (
                              <div key={j} className="examplePair" style={{ padding: '4px 8px', marginBottom: 4 }}>
                                <p style={{ margin: 0, fontSize: '0.85em' }}>• {en}</p>
                                {zh && <p style={{ margin: '0 0 0 10px', fontSize: '0.78em', color: 'var(--text-tertiary)' }}>{zh}</p>}
                              </div>
                            );
                          })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* 数字（基数词+序数词） */}
              {numberDateSubTab === 'numbers' && (
                <div>
                  <p className="muted">基数词（one, two...）用于计数，序数词（first, second...）用于表示顺序和日期。点击可听发音或查看详情。</p>
                  <div className="list">
                    {numberDateData.numbers.map(item => (
                      <div key={item.n} className="listItem" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                        <div style={{ minWidth: 60, fontSize: '1.2em', fontWeight: 700, color: '#2563eb' }}>{item.n}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, color: '#16a34a', marginRight: 12, cursor: 'pointer' }} onClick={() => speakOrNavigate(item.cardinal)}>{item.cardinal}</span>
                          <span style={{ fontWeight: 600, color: '#ea580c', cursor: 'pointer' }} onClick={() => speakOrNavigate(item.ordinal)}>{item.ordinal}</span>
                        </div>
                        <div style={{ fontSize: '0.75em', color: 'var(--text-tertiary)' }}>第{item.n}</div>
                      </div>
                    ))}
                    {/* 整十/百/千/百万/十亿 */}
                    <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: 8 }}>
                      <p style={{ fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>大数字</p>
                      {numberDateData.extraNumbers.map(item => (
                        <div key={item.n} className="listItem" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 6, marginBottom: 4 }}>
                          <div style={{ minWidth: 80, fontSize: '1.1em', fontWeight: 700, color: '#2563eb' }}>{item.n.toLocaleString()}</div>
                          <div>
                            <span style={{ fontWeight: 600, color: '#16a34a', marginRight: 12, cursor: 'pointer' }} onClick={() => speakOrNavigate(item.cardinal)}>{item.cardinal}</span>
                            <span style={{ fontWeight: 600, color: '#ea580c', cursor: 'pointer' }} onClick={() => speakOrNavigate(item.ordinal)}>{item.ordinal}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 变形扩展 */}
          {extendTab === 'transform' && (
            <>
              <div className="segmented">
                <button className={transformTab === 'adjToAdverb' ? 'active' : ''} onClick={() => setTransformTab('adjToAdverb')}>形容词变副词</button>
                <button className={transformTab === 'comparative' ? 'active' : ''} onClick={() => setTransformTab('comparative')}>比较级最高级</button>
                <button className={transformTab === 'pastTense' ? 'active' : ''} onClick={() => setTransformTab('pastTense')}>过去式过去分词</button>
                <button className={transformTab === 'presentParticiple' ? 'active' : ''} onClick={() => setTransformTab('presentParticiple')}>现在分词</button>
                <button className={transformTab === 'nounPlural' ? 'active' : ''} onClick={() => setTransformTab('nounPlural')}>名词复数</button>
                <button className={transformTab === 'irregular' ? 'active' : ''} onClick={() => setTransformTab('irregular')}>不规则动词表</button>
              </div>

              {/* 形容词变副词 */}
              {transformTab === 'adjToAdverb' && (
                <div className="affixList">
                  {adjToAdverbRules.map((ruleData, i) => (
                    <div key={i} className="affixCard">
                      <div className="affixHeader">
                        <span className="affixName" style={{ color: '#2563eb', fontSize: 15 }}>{ruleData.rule}</span>
                      </div>
                      <div className="affixExamples">
                        {ruleData.examples.map((ex, j) => (
                          <span key={j} className="affixExample" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(ex.adj)}>
                            <b>{ex.adj}</b> → {ex.adverb}{ex.meaning && <span className="sceneWordMeaning">（{ex.meaning}）</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 比较级最高级 */}
              {transformTab === 'comparative' && (
                <div className="affixList">
                  {comparativeRules.map((ruleData, i) => (
                    <div key={i} className="affixCard">
                      <div className="affixHeader">
                        <span className="affixName" style={{ color: '#7c3aed', fontSize: 15 }}>{ruleData.rule}</span>
                      </div>
                      <div className="affixExamples">
                        {ruleData.examples.map((ex, j) => (
                          <span key={j} className="affixExample" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(ex.word)}>
                            <b>{ex.word}</b> → 比较级: {ex.comparative} / 最高级: {ex.superlative}{ex.meaning && <span className="sceneWordMeaning">（{ex.meaning}）</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 过去式过去分词 */}
              {transformTab === 'pastTense' && (
                <div className="affixList">
                  {pastTenseRules.map((ruleData, i) => (
                    <div key={i} className="affixCard">
                      <div className="affixHeader">
                        <span className="affixName" style={{ color: '#dc2626', fontSize: 15 }}>{ruleData.rule}</span>
                      </div>
                      <div className="affixExamples">
                        {ruleData.examples.map((ex, j) => (
                          <span key={j} className="affixExample" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(ex.verb)}>
                            <b>{ex.verb}</b> → 过去式: {ex.pastTense} / 过去分词: {ex.pastParticiple}{ex.meaning && <span className="sceneWordMeaning">（{ex.meaning}）</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 现在分词 */}
              {transformTab === 'presentParticiple' && (
                <div className="affixList">
                  {presentParticipleRules.map((ruleData, i) => (
                    <div key={i} className="affixCard">
                      <div className="affixHeader">
                        <span className="affixName" style={{ color: '#059669', fontSize: 15 }}>{ruleData.rule}</span>
                      </div>
                      <div className="affixExamples">
                        {ruleData.examples.map((ex, j) => (
                          <span key={j} className="affixExample" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(ex.verb)}>
                            <b>{ex.verb}</b> → {ex.presentParticiple}{ex.meaning && <span className="sceneWordMeaning">（{ex.meaning}）</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 名词复数 */}
              {transformTab === 'nounPlural' && (
                <div className="affixList">
                  {nounPluralRules.map((ruleData, i) => (
                    <div key={i} className="affixCard">
                      <div className="affixHeader">
                        <span className="affixName" style={{ color: '#d97706', fontSize: 15 }}>{ruleData.rule}</span>
                      </div>
                      <div className="affixExamples">
                        {ruleData.examples.map((ex, j) => (
                          <span key={j} className="affixExample" style={{ cursor: 'pointer' }} onClick={() => speakOrNavigate(ex.singular)}>
                            <b>{ex.singular}</b> → {ex.plural}{ex.meaning && <span className="sceneWordMeaning">（{ex.meaning}）</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 不规则动词表 */}
              {transformTab === 'irregular' && (
                <div className="affixList">
                  {Object.entries(irregularVerbs).map(([type, verbs]) => (
                    <div key={type} className="affixCard">
                      <div className="affixHeader">
                        <span className="affixName" style={{ color: '#dc2626', fontSize: 15 }}>{type}</span>
                        <span className="affixProperty">共 {verbs.length} 个</span>
                      </div>
                      <div style={{ marginTop: 8 }}>
                        {verbs.map((v, i) => (
                          <div key={i} className="affixExample" style={{ display: 'block', marginBottom: 6, cursor: 'pointer' }} onClick={() => speakOrNavigate(v.verb)}>
                            <b>{v.verb}</b> — 过去式: <span style={{ color: '#2563eb' }}>{v.pastTense}</span> — 过去分词: <span style={{ color: '#7c3aed' }}>{v.pastParticiple}</span>
                            {v.meaning && <span className="sceneWordMeaning">（{v.meaning}）</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {/* ====== 导入页 ====== */}
      {section === 'import' && (
        <section className="panel">
          <div className="importBox">
            <h2>导入词库</h2>
            <p className="muted">支持 TXT、复制粘贴、图片、PDF、PPTX、DOCX。配置AI后可使用大模型智能识别。</p>
            {/* v2.70.0 百词斩同步已并入「词库 → 导出词库」面板，导出入口唯一 */}

            {/* 上方4个按钮 */}
            <div className="importBtnRow">
              <button className="fileButton" onClick={() => document.getElementById('paste-btn')?.click()}>
                <Icon name="clipboard" />粘贴
                <textarea id="paste-btn" style={{position:'absolute',opacity:0,width:0,height:0}} autoFocus onChange={e => setImportText(e.target.value)} />
              </button>
              <label className="fileButton">
                <Icon name="file" />TXT
                <input type="file" accept=".txt" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
              </label>
              <label className="fileButton">
                <Icon name="file" />PDF/DOCX
                <input type="file" accept=".pdf,.docx,.pptx" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
              </label>
              <label className="fileButton">
                <Icon name="image" />图片
                <input type="file" accept=".png,.jpg,.jpeg,.webp" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
              </label>
            </div>

            {/* AI配置区（折叠式） */}
            <button className="aiToggle" onClick={() => setShowAiBox(!showAiBox)}>
              <Icon name="chevronDown" className={showAiBox ? 'caretUp' : ''} />AI大模型识别（可选）
            </button>
            {showAiBox && (
              <div className="aiBox">
                <label style={{marginBottom:4,display:'block',fontSize:13,color:'var(--text-secondary)'}}>选择AI服务商
                  <InlineSelect block value={aiConfig.provider || 'siliconflow'} onChange={pid => {
                    const p = AI_PROVIDERS.find(x => x.id === pid);
                    if (p) {
                      if (pid === 'custom') {
                        updateAiConfig({ provider: pid, endpoint: '', model: '' });
                      } else {
                        updateAiConfig({ provider: pid, endpoint: p.endpoint, model: p.model });
                      }
                    }
                  }}
                    options={AI_PROVIDERS.map(p => ({ value: p.id, label: p.name }))} />
                </label>
                {aiConfig.provider === 'custom' && (
                  <>
                    <input value={aiConfig.endpoint} onChange={e => updateAiConfig({ endpoint: e.target.value })} placeholder="AI接口地址" />
                    <input value={aiConfig.model} onChange={e => updateAiConfig({ model: e.target.value })} placeholder="模型名" />
                  </>
                )}
                <input type="password" value={aiConfig.apiKey} onChange={e => updateAiConfig({ apiKey: e.target.value })} placeholder="API Key" />
                {aiConfig.provider !== 'custom' && (
                  <p className="muted" style={{fontSize:11,margin:'4px 0'}}>
                    模型: {AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.model}
                    {' · '}
                    <a href={AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.keyUrl} target="_blank" rel="noopener noreferrer" style={{color:'var(--primary)'}}>获取Key</a>
                  </p>
                )}
                <div className="importActions">
                  <button onClick={runAiOnText}>AI整理文本</button>
                  <button onClick={runAiOnFile}>AI识别文件</button>
                </div>
              </div>
            )}

            <textarea value={importText} onChange={e => setImportText(e.target.value)} placeholder="在此粘贴词表文本..." />
            <div className="importActions">
              <InlineSelect style={{ flex: 1, marginRight: 8 }} value={importTargetBookId || ''} onChange={v => setImportTargetBookId(v || null)}
                options={[{ value: '', label: '自动创建新词库' }].concat(books.filter(b => b.editable).map(b => ({ value: b.id, label: b.name + ' (' + b.items.length + '条)' })))} />
              <button className="primary" onClick={() => addImportedItems(parseImportedText(importText, 'word'))}>导入到词库</button>
            </div>
            <p className="status">{importStatus || '粘贴或上传文件后点击导入，未选词库时自动创建新词库'}</p>

            {/* 联网关联词检查 */}
            <div className="familyCheckBox">
              <div className="familyCheckHeader">
                <span className="familyCheckTitle"><Icon name="link" />联网关联词检查</span>
                <button
                  className={`familyCheckBtn${familyChecking ? ' checking' : ''}`}
                  onClick={runManualFamilyCheck}
                  disabled={familyChecking}
                >
                  {familyChecking ? '检查中...' : '检查当前词库关联词'}
                </button>
              </div>
              <p className="familyCheckDesc">
                导入新单词时自动联网检查词族关系。配置AI大模型可获得更精准的关联词标注。
                {' '}
                {aiConfig.endpoint && aiConfig.apiKey
                  ? <span style={{color: 'var(--primary)'}}><Icon name="check" />AI已配置</span>
                  : <span style={{color: 'var(--text-tertiary)'}}>未配置AI，使用本地算法</span>}
              </p>
              {familyCheckStatus && (
                <p className={`familyCheckStatus${familyChecking ? ' active' : ''}`}>{familyCheckStatus}</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ====== 我的页面（设置+下载+学习统计） ====== */}
      {section === 'me' && (
        <section className="panel mePage">
          {/* 顶部用户信息 */}
          <div className="meHeader">
            <div className="meAvatar" style={isNativeApp ? {} : { cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
              {...(!isNativeApp ? { onClick: () => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = e => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = ev => { const url = ev.target.result; setAvatarUrl(url); try { localStorage.setItem('gaokao_avatar', url); } catch {} }; reader.readAsDataURL(file); }; input.click(); }} : {})}>
              {/* v2.76.0：内置默认头像（用户指定图片），网页端仍可点按更换自己的图 */}
              <img src={avatarUrl || DEFAULT_AVATAR} alt="头像" className="meAvatarImg" />
            </div>
            <div className="meInfo">
              <h2>高考词汇学习</h2>
              <div className="meStats">
                <span>累计学习 {totalStudyDays} 天</span>
                <span className="streakBadge"><Icon name="fire" />连续 {streakDays} 天</span>
              </div>
            </div>
          </div>

          {/* 打卡日历 */}
          <div className="calendarSection">
            <h3>学习日历</h3>
            <div className="calendarGrid">
              {(() => {
                const now = new Date();
                const year = now.getFullYear();
                const month = now.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const dayNames = ['日','一','二','三','四','五','六'];
                const cells = [];
                dayNames.forEach(d => { cells.push(<div key={`h-${d}`} className="calHead">{d}</div>); });
                for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} className="calEmpty" />);
                for (let d = 1; d <= daysInMonth; d++) {
                  const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                  const studied = studyLog[key] && studyLog[key] > 0;
                  const isToday = key === todayKey;
                  cells.push(
                    <div key={key} className={`calDay ${studied ? 'calStudied' : ''} ${isToday ? 'calToday' : ''}`}
                      style={studied ? { cursor: 'pointer' } : {}}
                      onClick={studied ? () => { setReviewDate(key); setReviewMode('list'); setShowReview(true); } : undefined}
                      title={studied ? `点击温习 ${key} 的单词` : ''}>
                      {d}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>

          {/* 今日进度 */}
          <div className="todayProgress">
            <h3>今日学习</h3>
            <div className="ringProgress">
              <svg viewBox="0 0 100 100" className="ringSvg">
                {isNativeApp ? (
                  <>
                    {/* APP: 圆形进度 */}
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#22c55e" strokeWidth="8"
                      strokeDasharray={`${Math.min(todayCount / Math.max(settings.dailyGoal, 1), 1) * 264} 264`}
                      strokeDashoffset="66" strokeLinecap="round" transform="rotate(-90 50 50)" />
                  </>
                ) : (
                  <>
                    {/* 网页版: 爱心形状进度 */}
                    <path d="M50 88 C25 65 8 50 8 33 C8 20 18 12 30 12 C38 12 45 17 50 24 C55 17 62 12 70 12 C82 12 92 20 92 33 C92 50 75 65 50 88Z"
                      fill="none" stroke="#e5e7eb" strokeWidth="5" />
                    <path d="M50 88 C25 65 8 50 8 33 C8 20 18 12 30 12 C38 12 45 17 50 24 C55 17 62 12 70 12 C82 12 92 20 92 33 C92 50 75 65 50 88Z"
                      fill="none" stroke="#ef4444" strokeWidth="5"
                      strokeDasharray="283"
                      strokeDashoffset={283 * (1 - Math.min(todayCount / Math.max(settings.dailyGoal, 1), 1))}
                      strokeLinecap="round" />
                  </>
                )}
                <text x="50" y={isNativeApp ? 50 : 48} textAnchor="middle" dy="6" fontSize="18" fill="#111827" fontWeight="bold">{todayCount}</text>
              </svg>
              <div className="ringLabel">/ {settings.dailyGoal} 词</div>
            </div>
          </div>

          {/* 温习入口 */}
          <div style={{ marginTop: 12 }}>
            <button className="primary" style={{ width: '100%', padding: '12px 0', fontSize: 15 }}
              onClick={() => { setShowReview(true); }}>
              <Icon name="book" />温习历史单词
            </button>
            {(() => {
              const studyDates = Object.keys(studyWordsLog).filter(d => studyWordsLog[d] && studyWordsLog[d].length > 0);
              if (studyDates.length === 0) return null;
              const totalWords = studyDates.reduce((sum, d) => sum + studyWordsLog[d].length, 0);
              return <p className="muted" style={{ textAlign: 'center', marginTop: 6, fontSize: 13 }}>共 {studyDates.length} 天、{totalWords} 词可温习</p>;
            })()}
          </div>

          {/* v2.81.0：自动发音、音量键翻页开关已移至背诵页快捷栏，此处不再重复，避免冗余 */}

          {/* 设置区域（v2.81.0：背诵模式/难度/顺序/自动掌握/自动跳转/自动发音/音量键翻页 已在背诵页快捷栏，此处不再重复） */}
          <div className="settingsGroup">
            <h3>设置</h3>
            <label>每日目标
              <input type="number" value={settings.dailyGoal} min={1} max={500}
                onChange={e => { const v = Number(e.target.value) || 50; setSettings(s => ({ ...s, dailyGoal: v })); saveSettings({ ...settings, dailyGoal: v }); }} />
            </label>
            <label>发音语速（左右滑动调节）
              <WheelPicker
                values={WHEEL_SPEAK_RATE}
                value={WHEEL_SPEAK_RATE.indexOf(settings.speakRate) >= 0 ? settings.speakRate : 0.78}
                onChange={v => { setSettings(s => ({ ...s, speakRate: v })); saveSettings({ ...settings, speakRate: v }); }}
                format={v => v.toFixed(2) + 'x'}
                width={140}
              />
            </label>
            {settings.autoJump && <label>自动跳转延迟
              <InlineSelect block value={settings.autoJumpDelay || 1500} onChange={v => { setSettings(s => ({ ...s, autoJumpDelay: v })); saveSettings({ ...settings, autoJumpDelay: v }); }}
                options={[500, 800, 1000, 1200, 1500, 2000, 2500, 3000, 4000, 5000, 8000].map(n => ({ value: n, label: (n / 1000).toFixed(1) + ' 秒' }))} />
            </label>}
            {isFullApp && (
              <label>开屏更新公告
                <InlineSelect block value={settings.showAnnouncement ? 'on' : 'off'} onChange={v => { const on = v === 'on'; setSettings(s => ({ ...s, showAnnouncement: on })); saveSettings({ ...settings, showAnnouncement: on }); }}
                  options={[{ value: 'on', label: '开启（启动时显示更新公告）' }, { value: 'off', label: '关闭' }]} />
              </label>
            )}
            <div className="settingsInfo">
              <p>首次使用：{firstUseDate}</p>
              <p>今日日期：{todayKey}</p>
              <p>总词库：{books.length} 个</p>
              <p>总词汇量：{books.reduce((s, b) => s + (b.items.length || b.total || 0), 0)} 条</p>
            </div>
          </div>

          {/* v2.80.0：学习辅助与反馈 */}
          <div className="settingsGroup" style={{ marginTop: 16 }}>
            <h3>学习辅助与反馈</h3>

            {/* 护眼模式（暖色低蓝光单开关） */}
            <label>护眼模式（暖色低蓝光）
              <InlineSelect block value={settings.eyeCare ? 'on' : 'off'} onChange={v => { const on = v === 'on'; setSettings(s => ({ ...s, eyeCare: on })); saveSettings({ ...settings, eyeCare: on }); }} options={[{ value: 'off', label: '关闭（默认浅色）' }, { value: 'on', label: '开启' }]} />
            </label>

            {/* 艾宾浩斯记忆法 */}
            <label>艾宾浩斯记忆法
              <InlineSelect block value={settings.ebbinghaus ? 'on' : 'off'} onChange={v => { const on = v === 'on'; setSettings(s => ({ ...s, ebbinghaus: on })); saveSettings({ ...settings, ebbinghaus: on }); }} options={[{ value: 'off', label: '关闭（顺序/乱序背诵）' }, { value: 'on', label: '开启（按遗忘曲线复习）' }]} />
            </label>

            {/* 答题音效总开关 */}
            <label>答题音效
              <InlineSelect block value={settings.soundEnabled ? 'on' : 'off'} onChange={v => { const on = v === 'on'; setSettings(s => ({ ...s, soundEnabled: on })); saveSettings({ ...settings, soundEnabled: on }); }} options={[{ value: 'off', label: '关闭' }, { value: 'on', label: '开启' }]} />
            </label>

            {/* 答对音效切换（多选预设，点一下试听并换下一个） */}
            {settings.soundEnabled && (
              <label>答对音效
                <button className="smallBtn" onClick={() => { const list = SFX_CORRECT; const idx = Math.max(0, list.findIndex(s => s.id === settings.soundCorrect)); const next = list[(idx + 1) % list.length]; setSettings(s => ({ ...s, soundCorrect: next.id })); saveSettings({ ...settings, soundCorrect: next.id }); playAnswerSfx(true, next.id, settings.soundWrong); }}>{SFX_CORRECT.find(s => s.id === settings.soundCorrect)?.name || '清脆叮咚'} · 切换</button>
              </label>
            )}

            {/* 答错音效切换 */}
            {settings.soundEnabled && (
              <label>答错音效
                <button className="smallBtn" onClick={() => { const list = SFX_WRONG; const idx = Math.max(0, list.findIndex(s => s.id === settings.soundWrong)); const next = list[(idx + 1) % list.length]; setSettings(s => ({ ...s, soundWrong: next.id })); saveSettings({ ...settings, soundWrong: next.id }); playAnswerSfx(false, settings.soundCorrect, next.id); }}>{SFX_WRONG.find(s => s.id === settings.soundWrong)?.name || '温柔下降'} · 切换</button>
              </label>
            )}
          </div>

          {/* 数据备份与恢复 */}
          <div className="settingsGroup" style={{ marginTop: 16 }}>
            <h3>数据备份</h3>
            <p className="muted" style={{ marginBottom: 12 }}>{isNativeApp ? '备份保存到 Documents/高考词汇备份/ 目录，恢复时自动读取。' : '备份学习进度、错词本、设置等数据，更新或换设备后可恢复。'}</p>
            <div className="importActions">
              <button className="smallBtn" onClick={exportData}><Icon name="upload" />备份数据</button>
              <button className="smallBtn" onClick={importData}><Icon name="download" />恢复数据</button>
            </div>
            {/* v2.76.0 自定义保存目录：MP3 压缩包与备份文件都落到这里 */}
            <div className="saveDirRow">
              <div className="saveDirInfo">
                <b><Icon name="folder" />保存位置</b>
                <span title={mp3Dir || '下载/背群英'}>{mp3Dir ? mp3Dir : (isNativeApp ? '下载/背群英' : '浏览器下载目录')}</span>
              </div>
              {isNativeApp ? (
                <div className="saveDirBtns">
                  <button className="smallBtn" onClick={mp3PickDir}>更改</button>
                  {mp3Dir ? <button className="smallBtn ghost" onClick={() => { try { window.NativeSaver && window.NativeSaver.clearDir && window.NativeSaver.clearDir(); } catch (e) {} }}>恢复默认</button> : null}
                </div>
              ) : null}
            </div>
          </div>

          {/* v2.77.0 离线语音：默认关闭。中文日常从云端取，不占手机空间 */}
          {isNativeApp ? (
          <div className="cloudUpdateSection">
            <h3><Icon name="speaker" />离线语音</h3>
            <p className="muted">中文朗读默认从云端获取，占用更小、音质更稳。只有需要断网朗读时才下载离线包。</p>
            <p className="muted" style={{ marginTop: -4 }}>听读音频联网时即点即播，不再把每个词的音频存到手机里；只有「导出 MP3」才会写入文件。</p>
            <div className="offlineVoiceBox">
              <div className="offlineVoiceRow">
                <div className="ovText">
                  <b>{zhOffline ? '已开启' : '未开启（推荐）'}</b>
                  <span>{zhPackText(zhPack)}{zhBytes > 0 ? ' · 占用 ' + fmtFileSize(zhBytes) : ''}</span>
                </div>
                <button
                  className={'ovSwitch' + (zhOffline ? ' on' : '')}
                  onClick={toggleZhOffline}
                  aria-label="离线语音开关"
                />
              </div>
              <div className="offlineVoiceBtns">
                <button className="smallBtn" onClick={downloadZhOffline}>
                  <Icon name="download" />{zhCount > 0 ? '重新下载' : '立即下载'}
                </button>
                <button className="smallBtn ghost" onClick={clearZhOfflineFiles}>
                  <Icon name="trash" />清理{zhBytes > 0 ? '（释放 ' + fmtFileSize(zhBytes) + '）' : ''}
                </button>
              </div>
            </div>
          </div>
          ) : null}

          {/* 版本更新中心 - 仅APP端显示 */}
          {isNativeApp ? (
          <div className="cloudUpdateSection">
            <div className="updateHeader">
              <h3><Icon name="refresh" />版本更新</h3>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <span className="versionBadge">页面 v{APP_VERSION}</span>
                <span
                  className="versionBadge pkgVerBadge"
                  style={{
                    background: (pkgVer.code > 0 && pkgVer.code >= APP_VERSION_CODE) ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.14)',
                    color: (pkgVer.code > 0 && pkgVer.code >= APP_VERSION_CODE) ? '#16a34a' : '#ea580c',
                    cursor: 'pointer',
                  }}
                  onClick={refreshPkgVer}
                >安装包 {pkgVer.code > 0 ? ('v' + (pkgVer.name || pkgVer.code)) : 'v2.66.0 或更早'}</span>
              </div>
            </div>
            <p className="muted">点击检查更新，获取最新功能和词库。更新不会丢失任何个人数据。</p>
            {/* v2.74.0：系统播放卡片自检（vivo 控制中心不出卡片时，这里能直接看到原因并跳去开启） */}
            <div className={'mediaDiagCard' + (mediaBlocked ? ' bad' : ' ok')}>
              <div className="mediaDiagRow">
                <Icon name={mediaBlocked ? 'bellOff' : 'bell'} />
                <b>系统播放卡片</b>
                <span>{mediaBlocked ? mediaBlocked : '正常（锁屏 / 控制中心可见）'}</span>
              </div>
              <div className="mediaDiagRow">
                <Icon name="music" />
                <b>中文语音</b>
                <span>{ttsEngine ? (ttsEngine + (listenCfg.zhSource === 'auto' ? '（自动择优）' : '')) : '尚未初始化'}</span>
              </div>
              <div className="mediaDiagRow">
                <Icon name="speaker" />
                <b>高清语音包</b>
                <span>{zhPackText(zhPack)}</span>
              </div>
              <div className="mediaDiagBtns">
                <button className="smallBtn" onClick={() => { try { window.NativeAudio && window.NativeAudio.openNotificationSettings && window.NativeAudio.openNotificationSettings(); } catch (e) {} }}>通知设置</button>
                <button className="smallBtn" onClick={() => { try { window.NativeAudio && window.NativeAudio.openAppSettings && window.NativeAudio.openAppSettings(); } catch (e) {} }}>后台运行设置</button>
              </div>
              <p className="muted" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6 }}>
                vivo 手机请在「i 管家 → 应用管理 → 权限管理 → 自启动 / 后台高耗电」里允许本应用，控制中心的媒体卡片才会常驻。
              </p>
            </div>
            {pkgVer.code > 0 && pkgVer.code < APP_VERSION_CODE && (
              <div style={{
                margin: '10px 0 0 0', padding: '10px 12px', borderRadius: 10,
                background: 'rgba(249,115,22,0.10)', border: '1px solid rgba(249,115,22,0.28)',
                color: '#9a3412', fontSize: 13, lineHeight: 1.65,
              }}>
                ⚠️ <b>本机安装包落后于页面</b>：页面已更新到 v{APP_VERSION}，但安装包还是 v{pkgVer.name || pkgVer.code}。
                听读的真人配音、点击立即出声、朗读参数实时生效都依赖安装包，必须安装新版安装包才会生效。
                点击「检查更新」后按提示安装即可（安装不会丢失数据）。
              </div>
            )}
            <div className="updateActions">
              <button className="primary" onClick={() => { refreshPkgVer(); checkCloudUpdate(false); }} disabled={checkingUpdate}>
                {checkingUpdate ? '检查中...' : '检查更新'}
              </button>
              <button className="smallBtn" onClick={copyUpdateDiag}><Icon name="shield" />诊断信息</button>
            </div>
            <p className="muted" style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6 }}>
              若点更新后没有弹出安装界面：请在手机「设置 → 搜索「安装未知应用」→ 允许本应用安装」，然后回到这里再点一次。
            </p>
            {updateInfo && (
              <div className="updateInfoBox">
                {updateInfo.hasUpdate ? (
                  <>
                    <p className="updateNewVersion">发现新版本 v{updateInfo.version}</p>
                    <div className="updateLog">
                      {String(updateInfo.changelog || updateInfo.updateLog || '')
                        .split('\n')
                        .map(function (l) { return l.trim(); })
                        .filter(function (l) { return l && !/^【/.test(l); })
                        .map(function (line, i) {
                          var m = /^(新增|优化|修复|调整)\s*[:：]?\s*(.+)$/.exec(line);
                          var cls = !m ? '' : (m[1] === '新增' ? 'is-new' : (m[1] === '修复' ? 'is-fix' : 'is-opt'));
                          return (
                            <div className="updateLogLine" key={i}>
                              {m ? <span className={'updateTag ' + cls}>{m[1]}</span> : null}
                              <span>{m ? m[2] : line}</span>
                            </div>
                          );
                        })}
                    </div>
                    {inAppDownloading && (
                      <div style={{ marginTop: 10, marginBottom: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>下载进度</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--primary)' }}>{apkDownloadProgress}%</span>
                        </div>
                        <div style={{ background: 'var(--bg-tertiary)', borderRadius: 10, height: 8, overflow: 'hidden' }}>
                          <div style={{
                            background: 'linear-gradient(90deg, var(--primary), var(--primary-dark))',
                            height: '100%',
                            width: `${apkDownloadProgress}%`,
                            borderRadius: 10,
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    )}
                    {updateInfo.pkgHint ? (
                      <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#ea580c', lineHeight: 1.6 }}>{updateInfo.pkgHint}</p>
                    ) : null}
                    <button className="primary" onClick={applyUpdate} disabled={updateInfo.updating || inAppDownloading} style={{ marginTop: 8 }}>
                      {inAppDownloading ? `下载中 ${apkDownloadProgress}%` : (updateInfo.updating ? '更新中...' : (updateInfo.pkgOutdated ? `安装新版安装包 v${updateInfo.version}` : '立即更新'))}
                    </button>
                    <button className="smallBtn" style={{ marginTop: 8 }}
                      onClick={() => {
                        // v2.73.0：下载过但没装上（缓存里躺着可疑包）时，一键清空重来
                        try {
                          if (window.NativeUpdater && window.NativeUpdater.clearCache) window.NativeUpdater.clearCache();
                        } catch (e) {}
                        setApkDownloadProgress(0);
                        setInAppDownloading(false);
                        setCloudStatus('已清除下载缓存，重新开始下载...');
                        installApk(updateInfo);
                      }}><Icon name="trash" />清除缓存重新下载</button>
                    <button className="smallBtn" style={{ marginTop: 8 }}
                      onClick={() => window.open(updateInfo.apkUrl || updateInfo.apkUrlCdn || APK_DOWNLOAD_SOURCES[0].url, '_blank')}>
                      <Icon name="globe" />浏览器下载安装包
                    </button>
                  </>
                ) : (
                  <p className="updateLatest">已是最新版本</p>
                )}
              </div>
            )}
            {cloudStatus && <p className="status" style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>{cloudStatus}</p>}
          </div>
          ) : null}

          {/* 浏览器下载回退（更新检查所有线路失败时显示） */}
          {showBrowserFallback && (
            <div className="cloudUpdateSection" style={{ background: '#fef3c7', borderColor: '#fde68a', marginTop: 12 }}>
              <h3 style={{ color: '#92400e' }}><Icon name="phone" />网络修复更新</h3>
              <p className="muted">APP内网络检测失败，点击下方按钮将在浏览器中打开更新页面，下载后安装即可。安装后更新将自动恢复。</p>
              <button className="primary" onClick={() => {
                window.open('https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/update.html', '_blank');
              }} style={{ background: '#f59e0b' }}>在浏览器中更新</button>
            </div>
          )}

          {/* 反馈入口（App 与新网页版） */}
          {isFullApp && (
            <div className="cloudUpdateSection" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
              <h3 style={{ color: '#92400e' }}><Icon name="chat" />反馈建议</h3>
              <p className="muted">有什么建议或遇到问题？欢迎添加QQ好友直接反馈，沟通更高效。</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#92400e' }}>QQ: 3219858871</span>
                <button className="primary" onClick={() => {
                  // 尝试唤起 QQ 添加好友，失败则复制 QQ 号
                  const qqUrl = 'mqqapi://card/show_pslcard?src_type=internal&version=1&uin=3219858871&card_type=person&source=qrcode';
                  window.open(qqUrl, '_blank');
                  // 同时复制 QQ 号到剪贴板
                  try { navigator.clipboard?.writeText('3219858871'); } catch {}
                }} style={{ background: '#f59e0b' }}>添加QQ好友</button>
                <button className="smallBtn" onClick={() => {
                  try { navigator.clipboard?.writeText('3219858871'); appTip('QQ号已复制：3219858871'); } catch { appTip('QQ号：3219858871'); }
                }}>复制QQ号</button>
              </div>
            </div>
          )}

          {/* 隐私政策 */}
          <div className="cloudUpdateSection" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <h3 style={{ color: '#166534' }}><Icon name="shield" />隐私政策</h3>
            <p className="muted">本应用不收集任何用户个人信息，所有数据保存在设备本地。</p>
            <button className="smallBtn" onClick={() => {
              window.open('https://xdbzys.github.io/gaokao-vocab/site/privacy.html', '_blank');
            }}>查看隐私政策</button>
          </div>

          {/* 官网 */}
          <div className="cloudUpdateSection" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginTop: 12 }}>
            <h3 style={{ color: '#1d4ed8' }}><Icon name="globe" />官网</h3>
            <p className="muted">
              <a href="https://xdbzys.github.io/gaokao-vocab/site/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                xdbzys.github.io/gaokao-vocab/site
              </a>
            </p>
            <button className="smallBtn" onClick={() => {
              if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                Capacitor.Plugins.Browser.open({ url: 'https://xdbzys.github.io/gaokao-vocab/site/' });
              } else {
                window.open('https://xdbzys.github.io/gaokao-vocab/site/', '_blank');
              }
            }}>访问官网</button>
          </div>

          {/* v2.69.0：词库下载与网络搜索词库功能已移除（说明性内容统一收进更新公告） */}

          {/* 每个词库的重置进度 */}
          <div className="resetSection">
            <h3>词库管理</h3>
            <button className="smallBtn" style={{ marginBottom: 12, background: '#f59e0b', color: '#fff' }} onClick={() => {
              const result = cleanDeletedBookRefs();
              const msgs = [];
              if (result.study > 0) msgs.push(`背诵页清理 ${result.study} 个`);
              if (result.library > 0) msgs.push(`词库页清理 ${result.library} 个`);
              appTip(msgs.length > 0 ? `已清理不存在的词库引用：\n${msgs.join('\n')}` : '没有发现不存在的词库引用');
            }}>清理不存在的词库</button>
            <div className="list">
              {books.filter(b => b.id !== 'mastered-words' && b.id !== 'wrong-words' && !hiddenBookIds.includes(b.id)).map(b => {
                const mastered = b.items.filter(i => progress[termKey(i.term)] === 'mastered').length;
                const isBuiltIn = builtInBooks.some(bb => bb.id === b.id);
                return (
                  <div key={b.id} className="listItem">
                    <div>
                      <h3>{b.name}</h3>
                      <small>已掌握 {mastered}/{b.items.length || b.total || 0}</small>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="smallBtn dangerGhost" onClick={() => resetBookProgress(b.id)}>重置</button>
                      <button className="smallBtn dangerGhost" style={{ color: '#dc2626' }} onClick={() => {
                        if (!confirm(`确定删除词库「${b.name}」？\n${isBuiltIn ? '内置词库删除后可在下方恢复。' : '自定义词库删除后无法恢复。'}`)) return;
                        if (isBuiltIn) {
                          // 内置词库：加入隐藏列表
                          const next = [...hiddenBookIds, b.id];
                          setHiddenBookIds(next);
                          localStorage.setItem('gaokao_hidden_books', JSON.stringify(next));
                          setStudyBookIds(prev => { const n = prev.filter(x => x !== b.id); localStorage.setItem('gaokao_study_books', n.join(',')); return n; });
                          setLibraryBookIds(prev => { const n = prev.filter(x => x !== b.id); localStorage.setItem('gaokao_library_books', n.join(',')); return n; });
                        } else {
                          // 自定义词库：彻底删除
                          const remaining = books.filter(x => x.id !== b.id);
                          setBooks(remaining);
                          updateBooks(remaining);
                          setStudyBookIds(prev => { const n = prev.filter(x => x !== b.id); localStorage.setItem('gaokao_study_books', n.join(',')); return n; });
                          setLibraryBookIds(prev => { const n = prev.filter(x => x !== b.id); localStorage.setItem('gaokao_library_books', n.join(',')); return n; });
                        }
                      }}>删除词库</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* 已删除的内置词库恢复区 */}
            {books.filter(b => b.id !== 'mastered-words' && b.id !== 'wrong-words' && hiddenBookIds.includes(b.id)).length > 0 && (
              <div style={{ marginTop: 16, padding: 12, borderRadius: 10, background: 'var(--border-light)' }}>
                <h4 style={{ margin: '0 0 8px', color: 'var(--text-secondary)', fontSize: 14 }}>已删除的词库（可恢复）</h4>
                {books.filter(b => hiddenBookIds.includes(b.id)).map(b => (
                  <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' }}>
                    <span style={{ color: 'var(--text-tertiary)' }}>{b.name}</span>
                    <button className="smallBtn" style={{ background: '#2563eb', color: '#fff' }} onClick={() => {
                      const next = hiddenBookIds.filter(x => x !== b.id);
                      setHiddenBookIds(next);
                      localStorage.setItem('gaokao_hidden_books', JSON.stringify(next));
                    }}>恢复</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 开屏公告弹窗 */}
          {showAnnouncementModal && announcementData && (
            <div className="updateOverlay" onClick={e => { if (e.target === e.currentTarget) setShowAnnouncementModal(false); }}>
              <div className="updateModal">
                <div className="updateModalHeader">
                  <div className="updateModalIcon"><Icon name="rocket" size={34} /></div>
                  <p className="updateModalTitle">发现新版本</p>
                  <p className="updateModalSub">快来体验最新功能吧</p>
                  <div className="updateModalVersion">
                    <span>v{announcementData.version}</span>
                    <span className="updateModalBadge">NEW</span>
                  </div>
                </div>
                <div className="updateModalBody">
                  <h4>更新内容</h4>
                  <ul className="updateModalList">
                    {(announcementData.changelog || '').split('\n').filter(l => l.trim() && !l.trim().startsWith('v') && !l.trim().startsWith('【')).map((line, i) => (
                      <li key={i}><span className="updateModalDot" /><span>{line.trim().replace(/^[-\d.]+\s*/, '')}</span></li>
                    ))}
                  </ul>
                  {inAppDownloading && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: 13, color: '#6b7280' }}>正在后台下载...</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>{apkDownloadProgress}%</span>
                      </div>
                      <div style={{ background: '#e5e7eb', borderRadius: 10, height: 6, overflow: 'hidden' }}>
                        <div style={{
                          background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                          height: '100%',
                          width: `${apkDownloadProgress}%`,
                          borderRadius: 10,
                          transition: 'width 0.3s ease',
                        }} />
                      </div>
                    </div>
                  )}
                </div>
                <div className="updateModalFooter">
                  <button className="updateBtnGhost" onClick={() => {
                    localStorage.setItem('gaokao_dismissed_version', announcementData.version);
                    setDismissedVersion(announcementData.version);
                    setShowAnnouncementModal(false);
                  }}>下次再说</button>
                  <button className="updateBtnPrimary" onClick={() => {
                    setShowAnnouncementModal(false);
                    setSection('me'); // v2.65.0 修复：'settings' 不是合法 section，导致跳转空白页；更新入口在「我的」页
                    // 如果静默下载已在进行中，直接跳转到设置页显示进度
                    if (inAppDownloading) return;
                    // v2.67.0：统一走可靠更新入口（多源 + 版本校验 + 授权引导）
                    installApk(updateInfo);
                  }}>立即更新</button>
                </div>
              </div>
            </div>
          )}

          {/* 危险区域 */}
          <div className="dangerSection">
            <button className="dangerGhost fullWidth" onClick={() => {
              if (confirm('确定清除所有自定义词库吗？此操作不可撤销。')) {
                localStorage.removeItem('customBooks');
                setBooks([...builtInBooks]);
                appTip('已清除所有自定义词库');
              }
            }}>清除所有自定义词库</button>
          </div>
        </section>
      )}

      {/* 自动更新安装弹窗 - 固定在tabbar上方 */}
      {showInstallPrompt && downloadedApkUrl && (
        <div style={{
          position: 'fixed',
          bottom: '60px',
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
          color: '#fff',
          padding: '16px 20px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 22 }}>&#128640;</span>
              <span style={{ fontWeight: 'bold', fontSize: 15 }}>新版本 v{updateVersion} 已准备好</span>
            </div>
            <span style={{
              fontSize: 11,
              background: 'rgba(34,197,94,0.2)',
              color: '#4ade80',
              padding: '2px 8px',
              borderRadius: 10,
            }}>
              {apkDownloadProgress === 100 ? '下载完成' : `下载中 ${apkDownloadProgress > 0 ? apkDownloadProgress + '%' : ''}`}
            </span>
          </div>
          {updateChangelog && (
            <pre style={{
              margin: '8px 0 12px 0',
              padding: '10px 12px',
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 8,
              fontSize: 12,
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 150,
              overflowY: 'auto',
              color: '#cbd5e1',
              WebkitOverflowScrolling: 'touch',
            }}>{updateChangelog}</pre>
          )}
          <button
            onClick={() => {
              if (downloadedApkUrl) {
                window.open(downloadedApkUrl, '_blank');
              }
            }}
            style={{
              width: '100%',
              padding: '12px 0',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(34,197,94,0.4)',
            }}
          >
            立即安装
          </button>
        </div>
      )}


          {/* 词条详情弹窗 */}
          {detailItem && (() => {
            const enrichment = getWordEnrichment(detailItem.term);
            const mergedPoints = getMergedPoints(detailItem); // v2.56.0 跨词库考点整合
            return (
            <div className="modal" style={{ zIndex: 1100 }} onClick={() => { setDetailHistory([]); setDetailItem(null); }}>
              <div className="modalContent" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2>{detailItem.term}</h2>
                  {detailItem.phonetic && <p className="phoneticText">{detailItem.phonetic}</p>}
                  <button className="closeBtn" onClick={() => closeDetailItem()} title={detailHistory.length > 0 ? '返回上一个（' + detailHistory.length + '层）' : '关闭'}>{detailHistory.length > 0 ? <Icon name="chevronLeft" /> : <Icon name="close" />}</button>
                </div>
                <div className="detailMetaRow">
                  {detailItem.pos && <span className="detailPosTag" style={{ color: posColor(detailItem.pos), background: posColor(detailItem.pos) + '18' }}>{detailItem.pos}</span>}
                  {detailItem.frequency && <span className="detailFreqTag" style={{ color: freqColor(detailItem.frequency) }}>{detailItem.frequency}</span>}
                  {/* v2.44.0 显示单词所属词库 */}
                  {(() => {
                    const books = (detailItem.sourceBooks && detailItem.sourceBooks.length > 0)
                      ? detailItem.sourceBooks
                      : (wordBookMapRef.current[detailItem.term.toLowerCase()] || (detailItem.source ? [detailItem.source] : []));
                    if (books.length === 0) return null;
                    const isMulti = books.length > 1;
                    // v2.49.0: 单词只属于一个词库 → 黄底；属于多个词库 → 蓝底
                    const bg = isMulti ? '#dbeafe' : '#fef9c3';
                    const clr = isMulti ? '#1e40af' : '#a16207';
                    return <span className="detailSourceTag" style={{ fontSize: 12, background: bg, color: clr, padding: '2px 8px', borderRadius: 8, fontWeight: 500 }}><Icon name="book" />{books.join(' / ')}</span>;
                  })()}
                  {progress[termKey(detailItem.term)] === 'mastered' && <span className="detailMasteredTag"><Icon name="check" />已掌握</span>}
                </div>
                <h3 className="detailMeaning"><Meanings text={detailItem.meaning} /></h3>

                {/* 例句（紧跟释义显示，确保每个单词详情都有例句） */}
                {detailItem.examples && detailItem.examples.length > 0 && (
                  <div className="detailSection">
                    <p className="detailSectionTitle"><Icon name="quote" />例句</p>
                    <div className="examples">{detailItem.examples.map((e, i) => {
                      const [en, zh] = e.split('|||');
                      return (
                        <div key={i} className="examplePair">
                          <p className="exampleEn" style={{ cursor: 'pointer' }} onClick={() => speak(extractEnglish(en), settings.speakRate)}>{en}</p>
                          {zh && <p className="exampleZh">{zh}</p>}
                        </div>
                      );
                    })}</div>
                  </div>
                )}

                {/* 考点提示 */}
                {/* v2.56.0: 跨词库整合——无论从哪个词库点开，都展示该单词在所有词库的考点 */}
                {mergedPoints.corePoints.length > 0 && (
                  <div className="detailSection detailExamPoints">
                    <p className="detailSectionTitle"><Icon name="target" />核心考点{mergedPoints.corePoints.length > (detailItem.corePoints || []).length ? '（含其他词库）' : ''}</p>
                    {mergedPoints.corePoints.map((p, i) => <p key={i} className="detailPointItem">{p}</p>)}
                  </div>
                )}

                {/* 增强数据：考点 */}
                {enrichment && enrichment.examPoints.length > 0 && (
                  <div className="detailSection detailExamPoints">
                    <p className="detailSectionTitle"><Icon name="note" />常考要点</p>
                    {enrichment.examPoints.map((p, i) => <p key={i} className="detailPointItem">{p}</p>)}
                  </div>
                )}

                {/* 知识点 */}
                {/* v2.56.0: 跨词库整合知识点 */}
                {mergedPoints.allPoints.length > 0 && (
                  <div className="detailSection">
                    <p className="detailSectionTitle"><Icon name="bulb" />知识点</p>
                    <div className="points">
                      {mergedPoints.allPoints.map((p, i) => <p key={i}>• {p}</p>)}
                    </div>
                  </div>
                )}

                {/* 词组搭配 */}
                {enrichment && enrichment.collocations.length > 0 && (
                  <div className="detailSection detailCollocations">
                    <p className="detailSectionTitle"><Icon name="link" />词组搭配</p>
                    {enrichment.collocations.map((c, i) => <p key={i} className="detailCollocationItem" style={{ cursor: 'pointer' }} onClick={() => speak(extractEnglish(c), settings.speakRate)}>{c}</p>)}
                  </div>
                )}

                {/* 单词变形 */}
                {enrichment && Object.keys(enrichment.wordForms).length > 0 && (
                  <div className="detailSection detailWordForms">
                    <p className="detailSectionTitle"><Icon name="refresh" />单词变形</p>
                    <div className="detailFormGrid">
                      {(() => {
                        function formStyle(word) {
                          return isMasterOnlyWord(word) ? { cursor: 'pointer', color: '#4a6b5e', background: '#d6e4de', padding: '2px 6px', borderRadius: 6 } : { cursor: 'pointer' };
                        }
                        return (
                          <>
                      {enrichment.wordForms.noun && <div className="detailFormItem"><span className="detailFormLabel">名词</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.noun)} onClick={() => speakOrNavigate(enrichment.wordForms.noun)}>{enrichment.wordForms.noun}{extraWordInfo(enrichment.wordForms.noun) && <span className="exampleZhInline">（{extraWordInfo(enrichment.wordForms.noun)}）</span>}</span></div>}
                      {enrichment.wordForms.adjective && <div className="detailFormItem"><span className="detailFormLabel">形容词</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.adjective)} onClick={() => speakOrNavigate(enrichment.wordForms.adjective)}>{enrichment.wordForms.adjective}{extraWordInfo(enrichment.wordForms.adjective) && <span className="exampleZhInline">（{extraWordInfo(enrichment.wordForms.adjective)}）</span>}</span></div>}
                      {enrichment.wordForms.adverb && <div className="detailFormItem"><span className="detailFormLabel">副词</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.adverb)} onClick={() => speakOrNavigate(enrichment.wordForms.adverb)}>{enrichment.wordForms.adverb}{extraWordInfo(enrichment.wordForms.adverb) && <span className="exampleZhInline">（{extraWordInfo(enrichment.wordForms.adverb)}）</span>}</span></div>}
                      {enrichment.wordForms.pastTense && <div className="detailFormItem"><span className="detailFormLabel">过去式</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.pastTense)} onClick={() => speakOrNavigate(enrichment.wordForms.pastTense)}>{enrichment.wordForms.pastTense}</span></div>}
                      {enrichment.wordForms.pastParticiple && <div className="detailFormItem"><span className="detailFormLabel">过去分词</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.pastParticiple)} onClick={() => speakOrNavigate(enrichment.wordForms.pastParticiple)}>{enrichment.wordForms.pastParticiple}</span></div>}
                      {enrichment.wordForms.presentParticiple && <div className="detailFormItem"><span className="detailFormLabel">现在分词</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.presentParticiple)} onClick={() => speakOrNavigate(enrichment.wordForms.presentParticiple)}>{enrichment.wordForms.presentParticiple}</span></div>}
                      {enrichment.wordForms.comparative && <div className="detailFormItem"><span className="detailFormLabel">比较级</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.comparative)} onClick={() => speakOrNavigate(enrichment.wordForms.comparative)}>{enrichment.wordForms.comparative}</span></div>}
                      {enrichment.wordForms.superlative && <div className="detailFormItem"><span className="detailFormLabel">最高级</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.superlative)} onClick={() => speakOrNavigate(enrichment.wordForms.superlative)}>{enrichment.wordForms.superlative}</span></div>}
                      {enrichment.wordForms.thirdPerson && <div className="detailFormItem"><span className="detailFormLabel">第三人称单数</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.thirdPerson)} onClick={() => speakOrNavigate(enrichment.wordForms.thirdPerson)}>{enrichment.wordForms.thirdPerson}</span></div>}
                      {enrichment.wordForms.plural && <div className="detailFormItem"><span className="detailFormLabel">复数</span><span className="detailFormValue" style={formStyle(enrichment.wordForms.plural)} onClick={() => speakOrNavigate(enrichment.wordForms.plural)}>{enrichment.wordForms.plural}</span></div>}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}

                {/* 派生词 */}
                {enrichment && enrichment.derivatives.length > 0 && (
                  <div className="detailSection detailDerivatives">
                    <p className="detailSectionTitle"><Icon name="leaf" />派生词</p>
                    <div className="detailTagWrap">
                      {enrichment.derivatives.map((d, i) => {
                        const derivWord = d.split(' ')[0];
                        const derivItem = allWords.find(w => w.term.toLowerCase() === derivWord.toLowerCase());
                        const masterOnly = derivItem && isMasterOnlyWord(derivWord);
                        const derivStyle = masterOnly ? { cursor: 'pointer', background: '#d6e4de', color: '#4a6b5e' } : { cursor: 'pointer' };
                        return <span key={i} className="detailDerivTag" style={derivStyle} onClick={() => { if (derivItem) { openDetailItem(derivItem); if (settings.navAutoSpeak !== false) speak(derivWord, settings.speakRate); } else { speak(derivWord, settings.speakRate); } }}>{d}</span>;
                      })}
                    </div>
                  </div>
                )}

                {/* 近义词 / 同义词 */}
                {enrichment && enrichment.synonyms.length > 0 && (
                  <div className="detailSection detailSynonyms">
                    <p className="detailSectionTitle"><Icon name="pin" />近义词</p>
                    <div className="detailTagWrap">
                      {enrichment.synonyms.map((s, i) => {
                        const synWord = extractEnglish(s).split(/\s+/)[0];
                        const synItem = allWords.find(w => w.term.toLowerCase() === synWord.toLowerCase());
                        const masterOnly = synItem && isMasterOnlyWord(synWord);
                        const synStyle = masterOnly ? { cursor: 'pointer', background: '#d6e4de', color: '#4a6b5e' } : { cursor: 'pointer' };
                        return <span key={i} className="detailSynonymTag" style={synStyle} onClick={() => { if (synItem) { openDetailItem(synItem); if (settings.navAutoSpeak !== false) speak(synWord, settings.speakRate); } else { speak(synWord, settings.speakRate); } }}>{s}</span>;
                      })}
                    </div>
                  </div>
                )}

                {/* 反义词 */}
                {enrichment && enrichment.antonyms.length > 0 && (
                  <div className="detailSection detailAntonyms">
                    <p className="detailSectionTitle"><Icon name="bolt" />反义词</p>
                    <div className="detailTagWrap">
                      {enrichment.antonyms.map((a, i) => {
                        const antWord = extractEnglish(a).split(/\s+/)[0];
                        const antItem = allWords.find(w => w.term.toLowerCase() === antWord.toLowerCase());
                        return <span key={i} className="detailAntonymTag" style={{ cursor: 'pointer' }} onClick={() => { if (antItem) { openDetailItem(antItem); if (settings.navAutoSpeak !== false) speak(antWord, settings.speakRate); } else { speak(antWord, settings.speakRate); } }}>{a}</span>;
                      })}
                    </div>
                  </div>
                )}

                {/* 关联词族 */}
                {(() => {
                  const family = findWordFamily(detailItem.term, allWords);
                  // 获取AI联网检查的关联词缓存
                  const aiFamilyTerms = getCachedFamily(detailItem.term);
                  const aiFamilyItems = aiFamilyTerms
                    .map(w => allWords.find(i => i.term.toLowerCase() === w.toLowerCase()))
                    .filter(Boolean);
                  // AI发现但本地算法未发现的关联词
                  const localTerms = new Set(family.map(i => i.term.toLowerCase()));
                  const aiOnlyItems = aiFamilyItems.filter(i => !localTerms.has(i.term.toLowerCase()));
                  // 合并：本地算法结果 + AI额外发现
                  const allFamily = [...family, ...aiOnlyItems];
                  const hasAiTag = aiFamilyTerms.length > 0;
                  if (allFamily.length === 0 && !hasAiTag) return null;
                  return (
                    <div className="detailSection detailWordFamily">
                      <p className="detailSectionTitle">
                        <Icon name="link" />关联词族
                        {hasAiTag && <span className="aiBadge">AI联网标注</span>}
                      </p>
                      <div className="detailTagWrap">
                        {allFamily.map(item => {
                          const isAiTagged = aiFamilyTerms.includes(item.term.toLowerCase());
                          const inBank = !!findWordInBank(item.term);
                          const masterOnly = inBank && isMasterOnlyWord(item.term);
                          const familyBtnStyle = masterOnly ? { background: '#d6e4de', color: '#4a6b5e', borderColor: '#b8ccc3' } : {};
                          return (
                            <button key={item.id} className={`detailFamilyBtn${isAiTagged ? ' aiTagged' : ''}`}
                              style={familyBtnStyle}
                              onClick={() => { if (inBank) openDetailItem(item); }}>
                              {item.term} <small>{item.pos}</small>
                              {!inBank && item.meaning && <small style={{ opacity: 0.8 }}>（{getShortMeaning(item.meaning) || item.meaning}）</small>}
                              {isAiTagged && !localTerms.has(item.term.toLowerCase()) && <span className="aiDot">AI</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {/* 易混词（拼写相似但含义不同） */}
                {(() => {
                  const confusing = findConfusingWords(detailItem.term, allWords);
                  if (confusing.length === 0) return null;
                  const note = getConfusingNote(detailItem.term);
                  const aiConfusingTerms = getCachedConfusing(detailItem.term);
                  const hasAiConfusing = aiConfusingTerms.length > 0;
                  return (
                    <div className="detailSection detailConfusing">
                      <p className="detailSectionTitle">
                        <Icon name="warn" />易混词辨析
                        {hasAiConfusing && <span className="aiBadge">AI联网标注</span>}
                      </p>
                      {note && <p style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 8px' }}>{note}</p>}
                      <div className="detailTagWrap">
                        {confusing.map(item => {
                          const isAiTagged = isAiConfusingWord(detailItem.term, item.term);
                          const masterOnly = isMasterOnlyWord(item.term);
                          const confBtnStyle = masterOnly ? { background: '#d6e4de', color: '#4a6b5e', borderColor: '#b8ccc3' } : {};
                          return (
                            <button key={item.id} className={`detailConfusingBtn${isAiTagged ? ' aiTagged' : ''}`}
                              style={confBtnStyle}
                              onClick={() => openDetailItem(item)}>
                              {item.term} <small>{item.pos}</small>
                              {isAiTagged && <span className="aiDot">AI</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
                <div className="modalActions">
                  <button onClick={() => speak(detailItem.term, settings.speakRate)}><Icon name="speaker" />发音</button>
                  <button className="masterBtn" onClick={() => { toggleProgress(detailItem); setDetailItem({...detailItem}); }}>
                    {progress[termKey(detailItem.term)] === 'mastered' ? '取消掌握' : '标记掌握'}
                  </button>
                </div>
              </div>
            </div>
            );
          })()}

      {/* v2.76.0 应用内提示卡片 */}
      {tipMsg && (
        <div className="tipMask" onClick={() => setTipMsg(null)}>
          <div className="tipCard" onClick={(e) => e.stopPropagation()}>
            <div className="tipHead">
              <Icon name="info" />
              <b>{tipMsg.title}</b>
            </div>
            <pre className="tipBody">{tipMsg.text}</pre>
            <button className="tipOk" onClick={() => setTipMsg(null)}>知道了</button>
          </div>
        </div>
      )}

      {/* 底部Tab栏（5个） */}
      <nav className="tabbar">
        {TABS.map(tab => (
          <button key={tab.id} className={section === tab.id ? 'active' : ''} onClick={() => setSection(tab.id)}>
            <span className="tabIcon"><tab.icon /></span>
            <span className="tabLabel">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// 确保 DOM 就绪后再渲染（兼容内联脚本在解析时执行的场景）
let _mounted = false;
function mountApp() {
  if (_mounted) return;
  const rootEl = document.getElementById('root');
  if (rootEl) {
    _mounted = true;
    createRoot(rootEl).render(
      <AppErrorBoundary>
        <App />
      </AppErrorBoundary>
    );
    // v2.79.0：壳子先上屏，词库数据在后台并行下载（见 loadBookDataInBackground）
    try { loadBookDataInBackground(); } catch (e) { console.error('[book-data] 启动失败', e); }
    // 通知 index.html 里的静态骨架退场（手机端首屏不会白屏）
    try {
      if (typeof window.__removeSkeleton === 'function') window.__removeSkeleton();
    } catch (e) {}
  } else {
    setTimeout(mountApp, 50);
  }
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mountApp);
} else {
  mountApp();
}

// Capacitor 应用不需要 Service Worker（资源从 APK 本地加载）
// 注销已有的 Service Worker 以避免缓存外部 API 请求
// 注意：Android WebView 中 SW API 处于 invalid state，每个 Promise 都必须
//       单独接 catch（外层 catch 兜不住 forEach 内丢弃的 unregister() Promise）
window.__SW_GUARD__ = window.__SW_GUARD__ || 1; // 安全标记（勿删，MainActivity 校验用）
(function () {
  try {
    if ('serviceWorker' in navigator) {
      var pRegs = navigator.serviceWorker.getRegistrations();
      if (pRegs && pRegs.then) {
        pRegs.then(function (regs) {
          (regs || []).forEach(function (r) {
            try {
              var pu = r.unregister();
              if (pu && pu.catch) pu.catch(function () {});
            } catch (e) {}
          });
        }).catch(function () {});
      }
    }
  } catch (e) {}
})();
