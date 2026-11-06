/* 生成核心释义表（v2.78.0）
 *
 * 为什么需要这一步：
 *   内置 3500 词库的释义来自一部老词典，同一词条里混着 DOS 命令、缩略语展开、
 *   语法注释（"be 的现在分词"）和冷僻义项。背诵页把整条释义当选项显示时，
 *   用户看到的是「蒸馏室, 寂静, 剧照」这种和高考无关的第一义项。
 *
 * 做法：
 *   用三份人工校对的词表（高考3500 / 高考真题核心高频 / 牛津3000）挑出
 *   「词性对得上 + 与现有释义有交集」的那一条核心释义，只保留 1~3 个义项。
 *   交集校验用来挡掉精选词表自身的错条（如 sacred → 害怕、statue → 法令）。
 *
 * 用法：
 *   node src/scripts/build-core-meanings.js
 *   输出 src/coreMeanings.js（提交进仓库，运行时直接 import，不联网）
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CURATED = path.join(ROOT, 'data', 'curated');

const POS_TOKEN = /(?<![A-Za-z])(n|vt|vi|v|adj|adv|a|ad|prep|conj|pron|num|art|int|aux|modal|abbr)\s*\.\s*\/?\s*/g;
const POS_MAP = { n: 'n', v: 'v', vt: 'v', vi: 'v', adj: 'adj', a: 'adj', adv: 'adv', ad: 'adv', prep: 'prep', conj: 'conj', pron: 'pron', num: 'num', art: 'art', int: 'int', aux: 'aux', modal: 'modal', abbr: 'abbr' };
const CORE_POS = { n: 'n', v: 'v', adj: 'adj', adv: 'adv' };


/* 人工兜底：精选词表未收录、或收录但与高考常用义不符的词（逐条核对过） */
const MANUAL = {
  'program': '程序，节目',
  'programme': '节目，项目',
  'previously': '以前，先前',
  'shot': '射击，投篮',
  'penalty': '处罚，罚款',
  'pence': '便士',
  'pc': '个人电脑',
  'founding': '创立，成立',
  'foster': '培养，收养',
  'honor': '荣誉，尊敬',
  'honour': '荣誉，尊敬',
  'honourable': '光荣的，可敬的',
  'apparently': '显然，据说',
  'are': '是',
  'ad': '广告',
  'demolition': '拆除，爆破',
  'applause': '鼓掌，掌声',
  'session': '一场，会议',
  'beam': '光束，横梁',
  'sustain': '维持，支撑',
  'scale': '规模，比例',
  'anticipate': '预料，期望',
  'wool': '羊毛',
  'bind': '捆绑，约束',
  'genuine': '真正的，真诚的',
  'hence': '因此，从此',
  'integrity': '正直，完整',
  'literally': '字面上，确实地',
  'logical': '合乎逻辑的',
  'volume': '音量，体积',
  'still': '仍然，还',
  'addicted': '上瘾的，入迷的',
  'considerable': '相当大的',
  'cooperation': '合作，协作',
  'cope': '应对，处理',
  'criticize': '批评，指责',
  'depression': '抑郁，萧条',
  'entitle': '使有权利，命名',
  'café': '咖啡馆',
  'e-mail': '电子邮件',
  'be': '是',
  'dare': '敢，敢于',
  'cage': '笼子，鸟笼',
  'missile': '导弹',
  'ouch': '哎哟',
  'nursing': '护理，保育',
  'whom': '谁',
  'could': '可以，能',
  'poster': '海报，招贴',
  'profession': '职业，专业',
  'teenager': '青少年',
  'karaoke': '卡拉OK',
  'tend': '倾向，趋向',
  'make': '制造，做',
  'set': '设置，放置',
  'leave': '离开，留下',
  'watch': '观看，注视',
  'order': '顺序，命令',
  'point': '点，要点',
  'mean': '意思是，意味着',
};

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(CURATED, name), 'utf8'));
}

/** 把 "a.不动的,平静的ad.仍然,还" 拆成 [{pos:'adj',gloss:'不动的,平静的'},{pos:'adv',gloss:'仍然,还'}] */
function splitGroups(str) {
  const s = String(str || '');
  const marks = [];
  let m;
  POS_TOKEN.lastIndex = 0;
  while ((m = POS_TOKEN.exec(s)) !== null) {
    marks.push({ pos: POS_MAP[m[1]] || m[1], start: m.index, end: m.index + m[0].length });
  }
  if (!marks.length) return [{ pos: '', gloss: s.trim() }];
  const out = [];
  if (marks[0].start > 0) {
    const head = s.slice(0, marks[0].start).replace(/[\s,，、；;/]+$/g, '').trim();
    if (head) out.push({ pos: '', gloss: head });
  }
  for (let i = 0; i < marks.length; i++) {
    const stop = i + 1 < marks.length ? marks[i + 1].start : s.length;
    const gloss = s.slice(marks[i].end, stop).replace(/^[\s,，、；;/]+|[\s,，、；;/]+$/g, '').trim();
    if (gloss) out.push({ pos: marks[i].pos, gloss });
  }
  return out.length ? out : [{ pos: '', gloss: s.trim() }];
}

const cnChars = (s) => new Set(Array.from(String(s)).filter((c) => /[\u4e00-\u9fa5]/.test(c)));

/** 单个义项清洗：去掉复数/缩写等注释、未闭合括号、裸露词性字母 */
function cleanOne(x) {
  let t = String(x)
    .replace(/【[^】]*】/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/[（(][^）)]*(复数|缩写|等于|过去式|过去分词|现在分词|原形)[^）)]*[）)]/g, '')
    .replace(/[（(][^）)]*$/g, '')
    .replace(/[…\.]{2,}/g, '')
    .replace(/^[\s\-—/.．]+|[\s\-—/.．]+$/g, '')
    .replace(/^(&link|[nva]{1,3})(?=[\u4e00-\u9fa5])/, '')
    .replace(/[\s\u3000]+/g, '')
    .trim();
  return t;
}

/** 只留 1~2 个义项，总长 ≤ 18 字 */
function trimGloss(gloss) {
  const parts = String(gloss)
    .split(/[，,；;、]/)
    .map(cleanOne)
    .filter((x) => x && /[\u4e00-\u9fa5]/.test(x));
  const out = [];
  let len = 0;
  for (const p of parts) {
    if (out.length >= 2) break;
    if (len + p.length > 18 && out.length >= 1) break;
    if (out.indexOf(p) >= 0) continue;
    out.push(p);
    len += p.length;
  }
  return out.join('，');
}

function balancedParen(s) {
  const open = (s.match(/[（(]/g) || []).length;
  const close = (s.match(/[）)]/g) || []).length;
  return open === close;
}

function buildIndex(list) {
  const idx = new Map();
  for (const row of list) {
    const name = String(row.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!idx.has(key)) idx.set(key, []);
    // "run ran run" 这类把变形也写进名字的，额外用首词建索引
    const first = key.split(/\s+/)[0];
    if (first && first !== key && !idx.has(first)) idx.set(first, []);
    if (first && first !== key) idx.get(first).push(row.trans || []);
    idx.get(key).push(row.trans || []);
  }
  return idx;
}

function pick(list, term, posList, current) {
  const trans = list.get(String(term).toLowerCase());
  if (!trans || !trans.length) return null;
  const curCn = cnChars(current);
  const want = new Set();
  String(posList || '').toLowerCase().split(/[\s/&,]+/).forEach((p) => {
    const k = p.replace(/\.$/, '');
    if (CORE_POS[k]) want.add(CORE_POS[k]);
  });
  let best = null;
  for (const t of trans) {
    for (const g of splitGroups(t)) {
      const gloss = trimGloss(g.gloss);
      if (!gloss) continue;
      const cn = cnChars(gloss);
      let overlap = 0;
      cn.forEach((c) => { if (curCn.has(c)) overlap++; });
      const posHit = g.pos && want.has(g.pos) ? 1 : 0;
      // 交集为 0 视为不可信：精选词表里确有 sacred→害怕、statue→法令 这类错条
      if (overlap === 0 && !g.pos) continue;
      const score = posHit * 10 + overlap * 2 + (g.pos ? 1 : 0);
      if (!best || score > best.score) best = { gloss, score, overlap, pos: g.pos };
    }
  }
  if (!best) return null;
  if (best.overlap === 0 && best.pos && want.size) {
    // 词性对得上但一个字都不沾，仍可能是错条，交给人工表兜底
    return null;
  }
  return best.gloss;
}

function main() {
  const items = JSON.parse(fs.readFileSync('/tmp/v278/items.json', 'utf8'));
  const g = buildIndex(readJson('GaoKao_3500.json'));
  const z = buildIndex(readJson('GaoKaoZhenTiHeXinGaoPin.json'));
  const o = buildIndex(readJson('Oxford3000.json'));

  const uniq = new Map();
  for (const it of items) {
    const k = String(it.term).toLowerCase();
    if (!uniq.has(k)) uniq.set(k, it);
  }

  const out = {};
  let hit = 0;
  uniq.forEach((it, k) => {
    if (MANUAL[k]) { out[k] = MANUAL[k]; hit++; return; }
    const v =
      pick(z, it.term, it.pos, it.meaning) ||
      pick(g, it.term, it.pos, it.meaning) ||
      pick(o, it.term, it.pos, it.meaning);
    // 还带拉丁字母 / 残括号 / 省略号的，说明这条没洗干净，宁可回退也不要上屏
    if (v && !/[A-Za-z]|…/.test(v) && balancedParen(v)) { out[k] = v; hit++; }
  });

  const lines = Object.keys(out).sort().map((k) => `  ${JSON.stringify(k)}: ${JSON.stringify(out[k])},`);
  const body = `/* 自动生成，请勿手改：node src/scripts/build-core-meanings.js
 * 数据来源：src/data/curated/*.json（高考3500 / 高考真题核心高频 / 牛津3000）
 * 作用：背诵页选项与「核心释义」使用的短释义，覆盖 ${hit}/${uniq.size} 词 */
export const CORE_MEANINGS = {
${lines.join('\n')}
};
`;
  fs.writeFileSync(path.join(ROOT, 'coreMeanings.js'), body);
  console.log('generated', hit, '/', uniq.size, 'bytes', body.length);
}

main();
