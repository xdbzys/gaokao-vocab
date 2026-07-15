import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import './styles.css';

/* ============================
   APP 版本常量
   ============================ */
const APP_VERSION = '2.8.32';
const APP_VERSION_CODE = 81;
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
const isNativeApp = !!(window.Capacitor || window.cordova);

try { pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`; } catch {}

/* ============================
   一、内置词库数据
   ============================ */

// 985高考阅读理解核心词汇
const seedWords985 = [
  ['absence', 'n.', '缺席,不在场,缺乏', '985', ['缺席,不在场,缺乏'], ['缺席,不在场,缺乏'], ['absence is a key word in gaokao.']],
  ['absorb', 'vt.', '吸收,使专心', '985', ['吸收,使专心'], ['吸收,使专心'], ['absorb is a key word in gaokao.']],
  ['abstract', 'adj.', '抽象的n.摘要', '985', ['抽象的n.摘要'], ['抽象的n.摘要'], ['abstract is a key word in gaokao.']],
  ['academic', 'adj.', '学院的,学术的', '985', ['学院的,学术的'], ['学院的,学术的'], ['academic is a key word in gaokao.']],
  ['access', 'n.', '进入，使用权，通路', '985', ['进入，使用权，通路'], ['进入，使用权，通路'], ['access is a key word in gaokao.']],
  ['accordingly', 'adv.', '因此,依照', '985', ['因此,依照'], ['因此,依照'], ['accordingly is a key word in gaokao.']],
  ['account', 'n.', '账户；解释；理由', '985', ['账户；解释；理由'], ['账户；解释；理由'], ['account is a key word in gaokao.']],
  ['accurate', 'adj.', '精确的,准确的', '985', ['精确的,准确的'], ['精确的,准确的'], ['accurate is a key word in gaokao.']],
  ['accuse', 'vt.', '指责,归咎于', '985', ['指责,归咎于'], ['指责,归咎于'], ['accuse is a key word in gaokao.']],
  ['actor', 'n.', '男演员', '985', ['男演员'], ['男演员'], ['actor is a key word in gaokao.']],
  ['actress', 'n.', '女演员', '985', ['女演员'], ['女演员'], ['actress is a key word in gaokao.']],
  ['actual', 'adj.', '实际的,现行的', '985', ['实际的,现行的'], ['实际的,现行的'], ['actual is a key word in gaokao.']],
  ['adapt', 'vt.', '使适应,改编', '985', ['使适应,改编'], ['使适应,改编'], ['adapt is a key word in gaokao.']],
  ['admire', 'vt.', '钦佩,羡慕,赞赏', '985', ['钦佩,羡慕,赞赏'], ['钦佩,羡慕,赞赏'], ['admire is a key word in gaokao.']],
  ['admit', 'vt.', '承认,准许…进入', '985', ['承认,准许…进入'], ['承认,准许…进入'], ['admit is a key word in gaokao.']],
  ['adopt', 'vt.', '收养,采用,采取', '985', ['收养,采用,采取'], ['收养,采用,采取'], ['adopt is a key word in gaokao.']],
  ['adult', 'n.', '成年人a.成年的', '985', ['成年人a.成年的'], ['成年人a.成年的'], ['adult is a key word in gaokao.']],
  ['advance', 'vi.', '前进,提高n.进展', '985', ['前进,提高n.进展'], ['前进,提高n.进展'], ['advance is a key word in gaokao.']],
  ['adventure', 'n.', '冒险,惊险活动', '985', ['冒险,惊险活动'], ['冒险,惊险活动'], ['adventure is a key word in gaokao.']],
  ['affair', 'n.', '事情,事件,事务', '985', ['事情,事件,事务'], ['事情,事件,事务'], ['affair is a key word in gaokao.']],
  ['affect', 'vt.', '影响,感动', '985', ['影响,感动'], ['影响,感动'], ['affect is a key word in gaokao.']],
  ['afterward', '待标注', '(s)ad.后来,以后,随后', '985', ['(s)ad.后来,以'], ['(s)ad.后来,以后,随后'], ['afterward is a key word in gaokao.']],
  ['agent', 'n.', '代理人,代理商', '985', ['代理人,代理商'], ['代理人,代理商'], ['agent is a key word in gaokao.']],
  ['agriculture', 'n.', '农业,农艺,农学', '985', ['农业,农艺,农学'], ['农业,农艺,农学'], ['agriculture is a key word in gaokao.']],
  ['ahead', 'adv.', '在前,向前,提前', '985', ['在前,向前,提前'], ['在前,向前,提前'], ['ahead is a key word in gaokao.']],
  ['aid', 'n.', '帮助,救护,助手', '985', ['帮助,救护,助手'], ['帮助,救护,助手'], ['aid is a key word in gaokao.']],
  ['aim', 'n.', '目的，目标，对准v.目的在于，使…对准', '985', ['目的，目标，对准v.'], ['目的，目标，对准v.目的在于，使…对准'], ['aim is a key word in gaokao.']],
  ['aircraft', 'n.', '飞机,飞行器', '985', ['飞机,飞行器'], ['飞机,飞行器'], ['aircraft is a key word in gaokao.']],
  ['alarm', 'n.', '警报，警告器，惊慌v.警告，使惊恐', '985', ['警报，警告器，惊慌v'], ['警报，警告器，惊慌v.警告，使惊恐'], ['alarm is a key word in gaokao.']],
  ['album', 'n.', '集邮本,照相簿,唱片', '985', ['集邮本,照相簿,唱片'], ['集邮本,照相簿,唱片'], ['album is a key word in gaokao.']],
  ['alcohol', 'n.', '酒精,乙醇', '985', ['酒精,乙醇'], ['酒精,乙醇'], ['alcohol is a key word in gaokao.']],
  ['altogether', 'adv.', '完全地,总共', '985', ['完全地,总共'], ['完全地,总共'], ['altogether is a key word in gaokao.']],
  ['amaze', 'vt.', '使惊异', '985', ['使惊异'], ['使惊异'], ['amaze is a key word in gaokao.']],
  ['ambition', 'n.', '雄心,抱负,野心', '985', ['雄心,抱负,野心'], ['雄心,抱负,野心'], ['ambition is a key word in gaokao.']],
  ['amount', 'n.', '总数,数量', '985', ['总数,数量'], ['总数,数量'], ['amount is a key word in gaokao.']],
  ['amuse', 'vt.', '逗…乐,给…娱乐', '985', ['逗…乐,给…娱乐'], ['逗…乐,给…娱乐'], ['amuse is a key word in gaokao.']],
  ['analyze', 'vt.', '分析,分解,解析', '985', ['分析,分解,解析'], ['分析,分解,解析'], ['analyze is a key word in gaokao.']],
  ['ancestor', 'n.', '祖宗,祖先', '985', ['祖宗,祖先'], ['祖宗,祖先'], ['ancestor is a key word in gaokao.']],
  ['anger', 'n.', '怒,愤怒vt.使发怒', '985', ['怒,愤怒vt.使发怒'], ['怒,愤怒vt.使发怒'], ['anger is a key word in gaokao.']],
  ['angle', 'n.', '角,角度', '985', ['角,角度'], ['角,角度'], ['angle is a key word in gaokao.']],
  ['anniversary', 'n.', '周年纪念日', '985', ['周年纪念日'], ['周年纪念日'], ['anniversary is a key word in gaokao.']],
  ['announce', 'vt.', '宣布,发表', '985', ['宣布,发表'], ['宣布,发表'], ['announce is a key word in gaokao.']],
  ['annoy', 'vt.', '使恼怒,打搅', '985', ['使恼怒,打搅'], ['使恼怒,打搅'], ['annoy is a key word in gaokao.']],
  ['anxious', 'adj.', '忧虑的,渴望的', '985', ['忧虑的,渴望的'], ['忧虑的,渴望的'], ['anxious is a key word in gaokao.']],
  ['anyhow', 'adv.', '无论如何', '985', ['无论如何'], ['无论如何'], ['anyhow is a key word in gaokao.']],
  ['apart', 'adv.', '相隔,分开,除去', '985', ['相隔,分开,除去'], ['相隔,分开,除去'], ['apart is a key word in gaokao.']],
  ['apartment', 'n.', '一套公寓房间', '985', ['一套公寓房间'], ['一套公寓房间'], ['apartment is a key word in gaokao.']],
  ['apologize', 'vi.', '道歉,谢罪,认错', '985', ['道歉,谢罪,认错'], ['道歉,谢罪,认错'], ['apologize is a key word in gaokao.']],
  ['appearance', 'n.', '出现,来到,外观', '985', ['出现,来到,外观'], ['出现,来到,外观'], ['appearance is a key word in gaokao.']],
  ['apply', 'vt.', '申请，应用', '985', ['申请，应用'], ['申请，应用'], ['apply is a key word in gaokao.']],
  ['appointment', 'n.', '任命,预约', '985', ['任命,预约'], ['任命,预约'], ['appointment is a key word in gaokao.']],
  ['appreciate', 'vt.', '欣赏,感谢', '985', ['欣赏,感谢'], ['欣赏,感谢'], ['appreciate is a key word in gaokao.']],
  ['approach', 'vt.', '靠近，接近，着手处理n.靠近，接近，方法', '985', ['靠近，接近，着手处理'], ['靠近，接近，着手处理n.靠近，接近，方法'], ['approach is a key word in gaokao.']],
  ['architecture', 'n.', '建筑学,建筑式样', '985', ['建筑学,建筑式样'], ['建筑学,建筑式样'], ['architecture is a key word in gaokao.']],
  ['argue', 'vi.', '争论,争辩,辩论', '985', ['争论,争辩,辩论'], ['争论,争辩,辩论'], ['argue is a key word in gaokao.']],
  ['arrange', 'vt.', '筹备,整理', '985', ['筹备,整理'], ['筹备,整理'], ['arrange is a key word in gaokao.']],
  ['arrest', 'vt.', '逮捕,拘留', '985', ['逮捕,拘留'], ['逮捕,拘留'], ['arrest is a key word in gaokao.']],
  ['arrival', 'n.', '到达,到达者', '985', ['到达,到达者'], ['到达,到达者'], ['arrival is a key word in gaokao.']],
  ['artist', 'n.', '艺术家,美术家', '985', ['艺术家,美术家'], ['艺术家,美术家'], ['artist is a key word in gaokao.']],
  ['ash', 'n.', '灰,灰末,骨灰', '985', ['灰,灰末,骨灰'], ['灰,灰末,骨灰'], ['ash is a key word in gaokao.']],
  ['ashamed', 'adj.', '惭愧(的),羞耻(的)', '985', ['惭愧(的),羞耻(的'], ['惭愧(的),羞耻(的)'], ['ashamed is a key word in gaokao.']],
  ['aside', 'adv.', '在旁边,到旁边', '985', ['在旁边,到旁边'], ['在旁边,到旁边'], ['aside is a key word in gaokao.']],
  ['aspect', 'n.', '方面,样子,外表', '985', ['方面,样子,外表'], ['方面,样子,外表'], ['aspect is a key word in gaokao.']],
  ['assistant', 'n.', '助手,助教', '985', ['助手,助教'], ['助手,助教'], ['assistant is a key word in gaokao.']],
  ['assume', 'vt.', '假定,承担,呈现', '985', ['假定,承担,呈现'], ['假定,承担,呈现'], ['assume is a key word in gaokao.']],
  ['astonish', 'vt.', '使惊讶,使吃惊', '985', ['使惊讶,使吃惊'], ['使惊讶,使吃惊'], ['astonish is a key word in gaokao.']],
  ['athlete', 'n.', '运动员', '985', ['运动员'], ['运动员'], ['athlete is a key word in gaokao.']],
  ['atmosphere', 'n.', '大气,气氛', '985', ['大气,气氛'], ['大气,气氛'], ['atmosphere is a key word in gaokao.']],
  ['attach', 'vt.', '缚,系,贴,附加', '985', ['缚,系,贴,附加'], ['缚,系,贴,附加'], ['attach is a key word in gaokao.']],
  ['attack', 'vt.', 'vi.n.攻击,进攻', '985', ['vi.n.攻击,进攻'], ['vi.n.攻击,进攻'], ['attack is a key word in gaokao.']],
  ['attempt', 'vt.', '尝试,试图n.企图', '985', ['尝试,试图n.企图'], ['尝试,试图n.企图'], ['attempt is a key word in gaokao.']],
  ['attend', 'vt.', '出席,照顾,护理', '985', ['出席,照顾,护理'], ['出席,照顾,护理'], ['attend is a key word in gaokao.']],
  ['attitude', 'n.', '态度', '985', ['态度'], ['态度'], ['attitude is a key word in gaokao.']],
  ['attract', 'vt.', '吸引', '985', ['吸引'], ['吸引'], ['attract is a key word in gaokao.']],
  ['audience', 'n.', '听众,观众', '985', ['听众,观众'], ['听众,观众'], ['audience is a key word in gaokao.']],
  ['author', 'n.', '作者,作家', '985', ['作者,作家'], ['作者,作家'], ['author is a key word in gaokao.']],
  ['available', 'adj.', '可利用的,可得到的', '985', ['可利用的,可得到的'], ['可利用的,可得到的'], ['available is a key word in gaokao.']],
  ['average', 'n.', '平均数a.平均的', '985', ['平均数a.平均的'], ['平均数a.平均的'], ['average is a key word in gaokao.']],
  ['award', 'n.', '奖,奖品v.授予', '985', ['奖,奖品v.授予'], ['奖,奖品v.授予'], ['award is a key word in gaokao.']],
  ['aware', 'adj.', '知道的,意识到的', '985', ['知道的,意识到的'], ['知道的,意识到的'], ['aware is a key word in gaokao.']],
  ['awful', 'adj.', '可怕的，令人不愉快的', '985', ['可怕的，令人不愉快的'], ['可怕的，令人不愉快的'], ['awful is a key word in gaokao.']],
  ['badly', 'adv.', '坏,差,严重地', '985', ['坏,差,严重地'], ['坏,差,严重地'], ['badly is a key word in gaokao.']],
  ['badminton', 'n.', '羽毛球', '985', ['羽毛球'], ['羽毛球'], ['badminton is a key word in gaokao.']],
  ['baggage', 'n.', '行李', '985', ['行李'], ['行李'], ['baggage is a key word in gaokao.']],
  ['bake', 'vt.', '烤,烘,烧硬', '985', ['烤,烘,烧硬'], ['烤,烘,烧硬'], ['bake is a key word in gaokao.']],
  ['balance', 'vt.', '使平衡,称n.天平', '985', ['使平衡,称n.天平'], ['使平衡,称n.天平'], ['balance is a key word in gaokao.']],
  ['ban', 'n.', '禁令vt.禁止,取缔', '985', ['禁令vt.禁止,取缔'], ['禁令vt.禁止,取缔'], ['ban is a key word in gaokao.']],
  ['band', 'n.', '乐队,带,波段', '985', ['乐队,带,波段'], ['乐队,带,波段'], ['band is a key word in gaokao.']],
  ['bar', 'n.', '酒吧间,条,杆', '985', ['酒吧间,条,杆'], ['酒吧间,条,杆'], ['bar is a key word in gaokao.']],
  ['bare', 'adj.', '赤裸的,仅仅的', '985', ['赤裸的,仅仅的'], ['赤裸的,仅仅的'], ['bare is a key word in gaokao.']],
  ['bargain', 'n.', '便宜货，交易vi.讨价还价,成交', '985', ['便宜货，交易vi.讨'], ['便宜货，交易vi.讨价还价,成交'], ['bargain is a key word in gaokao.']],
  ['base', 'n.', '基础,底层,基地', '985', ['基础,底层,基地'], ['基础,底层,基地'], ['base is a key word in gaokao.']],
  ['basin', 'n.', '盆子,盆地', '985', ['盆子,盆地'], ['盆子,盆地'], ['basin is a key word in gaokao.']],
  ['basis', 'n.', '基础,根据', '985', ['基础,根据'], ['基础,根据'], ['basis is a key word in gaokao.']],
  ['bath', 'n.', '洗澡,浴缸', '985', ['洗澡,浴缸'], ['洗澡,浴缸'], ['bath is a key word in gaokao.']],
  ['bathe', 'vt.', '给…洗澡', '985', ['给…洗澡'], ['给…洗澡'], ['bathe is a key word in gaokao.']],
  ['battery', 'n.', '电池', '985', ['电池'], ['电池'], ['battery is a key word in gaokao.']],
  ['battle', 'n.', '战役,斗争vi.作战', '985', ['战役,斗争vi.作战'], ['战役,斗争vi.作战'], ['battle is a key word in gaokao.']],
  ['beard', 'n.', '胡须,络腮胡子', '985', ['胡须,络腮胡子'], ['胡须,络腮胡子'], ['beard is a key word in gaokao.']],
  ['beauty', 'n.', '美,美丽,美人', '985', ['美,美丽,美人'], ['美,美丽,美人'], ['beauty is a key word in gaokao.']],
  ['beer', 'n.', '啤酒', '985', ['啤酒'], ['啤酒'], ['beer is a key word in gaokao.']],
  ['beg', 'vt.', 'vi.乞求,请求', '985', ['vi.乞求,请求'], ['vi.乞求,请求'], ['beg is a key word in gaokao.']],
  ['beginning', 'n.', '开始,开端,起源', '985', ['开始,开端,起源'], ['开始,开端,起源'], ['beginning is a key word in gaokao.']],
  ['behave', 'vi.', '表现,举止', '985', ['表现,举止'], ['表现,举止'], ['behave is a key word in gaokao.']],
  ['belly', 'n.', '腹部,胃', '985', ['腹部,胃'], ['腹部,胃'], ['belly is a key word in gaokao.']],
  ['belong', 'vi.', '属于,附属', '985', ['属于,附属'], ['属于,附属'], ['belong is a key word in gaokao.']],
  ['belt', 'n.', '带,腰带,区', '985', ['带,腰带,区'], ['带,腰带,区'], ['belt is a key word in gaokao.']],
  ['bench', 'n.', '长凳,条凳,工作台', '985', ['长凳,条凳,工作台'], ['长凳,条凳,工作台'], ['bench is a key word in gaokao.']],
  ['bend', 'vt.', '使弯曲vi.弯曲', '985', ['使弯曲vi.弯曲'], ['使弯曲vi.弯曲'], ['bend is a key word in gaokao.']],
  ['benefit', 'n.', '利益,恩惠,津贴', '985', ['利益,恩惠,津贴'], ['利益,恩惠,津贴'], ['benefit is a key word in gaokao.']],
  ['best', 'adj.', '最好的', '985', ['最好的'], ['最好的'], ['best is a key word in gaokao.']],
  ['better', 'adj.', '较好的ad.更好地', '985', ['较好的ad.更好地'], ['较好的ad.更好地'], ['better is a key word in gaokao.']],
  ['billion', '待标注', 'num.十亿', '985', ['num.十亿'], ['num.十亿'], ['billion is a key word in gaokao.']],
  ['biology', 'n.', '生物学,生态学', '985', ['生物学,生态学'], ['生物学,生态学'], ['biology is a key word in gaokao.']],
  ['birthplace', 'n.', '出生地', '985', ['出生地'], ['出生地'], ['birthplace is a key word in gaokao.']],
  ['bite', 'vt.', '咬,叮,螫', '985', ['咬,叮,螫'], ['咬,叮,螫'], ['bite is a key word in gaokao.']],
  ['blame', 'vt.', '责备,把…归咎于', '985', ['责备,把…归咎于'], ['责备,把…归咎于'], ['blame is a key word in gaokao.']],
  ['blank', 'adj.', '空白的n.空白', '985', ['空白的n.空白'], ['空白的n.空白'], ['blank is a key word in gaokao.']],
  ['blanket', 'n.', '毯子', '985', ['毯子'], ['毯子'], ['blanket is a key word in gaokao.']],
  ['bleed', 'vi.', '流血', '985', ['流血'], ['流血'], ['bleed is a key word in gaokao.']],
  ['block', 'n.', '街区，块，大厦vt.堵塞,拦阻', '985', ['街区，块，大厦vt.'], ['街区，块，大厦vt.堵塞,拦阻'], ['block is a key word in gaokao.']],
  ['blouse', 'n.', '宽松的上衣', '985', ['宽松的上衣'], ['宽松的上衣'], ['blouse is a key word in gaokao.']],
  ['boil', 'vi.', '沸腾,汽化vt.煮沸', '985', ['沸腾,汽化vt.煮沸'], ['沸腾,汽化vt.煮沸'], ['boil is a key word in gaokao.']],
  ['bomb', 'n.', '炸弹vt.轰炸', '985', ['炸弹vt.轰炸'], ['炸弹vt.轰炸'], ['bomb is a key word in gaokao.']],
  ['bone', 'n.', '骨,骨骼', '985', ['骨,骨骼'], ['骨,骨骼'], ['bone is a key word in gaokao.']],
  ['border', 'n.', '边缘,边界', '985', ['边缘,边界'], ['边缘,边界'], ['border is a key word in gaokao.']],
  ['bother', 'vt.', '烦扰,打扰n.麻烦，烦恼', '985', ['烦扰,打扰n.麻烦，'], ['烦扰,打扰n.麻烦，烦恼'], ['bother is a key word in gaokao.']],
  ['brake', 'n.', '闸,刹车vi.刹车', '985', ['闸,刹车vi.刹车'], ['闸,刹车vi.刹车'], ['brake is a key word in gaokao.']],
  ['branch', 'n.', '树枝,分部,分支，支流', '985', ['树枝,分部,分支，支'], ['树枝,分部,分支，支流'], ['branch is a key word in gaokao.']],
  ['brand', 'n.', '商标，牌子，烙印vt.印商标于，打烙印于，铭刻于', '985', ['商标，牌子，烙印vt'], ['商标，牌子，烙印vt.印商标于，打烙印于，铭刻于'], ['brand is a key word in gaokao.']],
  ['brick', 'n.', '砖块', '985', ['砖块'], ['砖块'], ['brick is a key word in gaokao.']],
  ['brief', 'adj.', '简短的vt.作简报', '985', ['简短的vt.作简报'], ['简短的vt.作简报'], ['brief is a key word in gaokao.']],
  ['broad', 'adj.', '宽阔的,广泛的', '985', ['宽阔的,广泛的'], ['宽阔的,广泛的'], ['broad is a key word in gaokao.']],
  ['broadcast', 'v/', 'n.广播,播撒，播音', '985', ['n.广播,播撒，播音'], ['n.广播,播撒，播音'], ['broadcast is a key word in gaokao.']],
  ['broom', 'n.', '扫帚', '985', ['扫帚'], ['扫帚'], ['broom is a key word in gaokao.']],
  ['bucket', 'n.', '水桶,吊桶', '985', ['水桶,吊桶'], ['水桶,吊桶'], ['bucket is a key word in gaokao.']],
  ['budget', 'v/', 'n.预算', '985', ['n.预算'], ['n.预算'], ['budget is a key word in gaokao.']],
  ['burden', 'n.', '负担,责任，装载量vt.使负担，装货于', '985', ['负担,责任，装载量v'], ['负担,责任，装载量vt.使负担，装货于'], ['burden is a key word in gaokao.']],
  ['burst', 'v/', 'n.爆发，突发，爆炸', '985', ['n.爆发，突发，爆炸'], ['n.爆发，突发，爆炸'], ['burst is a key word in gaokao.']],
  ['bury', 'vt.', '埋葬,埋藏', '985', ['埋葬,埋藏'], ['埋葬,埋藏'], ['bury is a key word in gaokao.']],
  ['bush', 'n.', '灌木', '985', ['灌木'], ['灌木'], ['bush is a key word in gaokao.']],
  ['butcher', 'n.', '屠夫,屠户', '985', ['屠夫,屠户'], ['屠夫,屠户'], ['butcher is a key word in gaokao.']],
  ['button', 'n.', '扣子,按钮vt.扣紧', '985', ['扣子,按钮vt.扣紧'], ['扣子,按钮vt.扣紧'], ['button is a key word in gaokao.']],
  ['café', 'n.', '咖啡馆,小餐厅', '985', ['咖啡馆,小餐厅'], ['咖啡馆,小餐厅'], ['café is a key word in gaokao.']],
  ['cage', 'n.', '笼,鸟笼,囚笼', '985', ['笼,鸟笼,囚笼'], ['笼,鸟笼,囚笼'], ['cage is a key word in gaokao.']],
  ['calculate', 'vt.', '计算,打算，认为', '985', ['计算,打算，认为'], ['计算,打算，认为'], ['calculate is a key word in gaokao.']],
  ['calm', 'adj.', '平静的，沉着的v(使)平静，(使)镇定', '985', ['平静的，沉着的v(使'], ['平静的，沉着的v(使)平静，(使)镇定'], ['calm is a key word in gaokao.']],
  ['candidate', 'n.', '候选人,应考者', '985', ['候选人,应考者'], ['候选人,应考者'], ['candidate is a key word in gaokao.']],
  ['carpet', 'n.', '地毯', '985', ['地毯'], ['地毯'], ['carpet is a key word in gaokao.']],
  ['carrot', 'n.', '胡萝卜', '985', ['胡萝卜'], ['胡萝卜'], ['carrot is a key word in gaokao.']],
  ['cart', 'n.', '二轮运货马车', '985', ['二轮运货马车'], ['二轮运货马车'], ['cart is a key word in gaokao.']],
  ['case', 'n.', '情况,案例,病例，箱', '985', ['情况,案例,病例，箱'], ['情况,案例,病例，箱'], ['case is a key word in gaokao.']],
  ['cash', 'n.', '现金', '985', ['现金'], ['现金'], ['cash is a key word in gaokao.']],
  ['castle', 'n.', '城堡', '985', ['城堡'], ['城堡'], ['castle is a key word in gaokao.']],
  ['casual', 'adj.', '偶然的,随便的，非正式的', '985', ['偶然的,随便的，非正'], ['偶然的,随便的，非正式的'], ['casual is a key word in gaokao.']],
  ['cattle', 'n.', '牛,牲口,家畜', '985', ['牛,牲口,家畜'], ['牛,牲口,家畜'], ['cattle is a key word in gaokao.']],
  ['cave', 'n.', '山洞,洞穴,窑洞', '985', ['山洞,洞穴,窑洞'], ['山洞,洞穴,窑洞'], ['cave is a key word in gaokao.']],
  ['centimeter', 'n.', '厘米', '985', ['厘米'], ['厘米'], ['centimeter is a key word in gaokao.']],
  ['central', 'adj.', '中心的,主要的', '985', ['中心的,主要的'], ['中心的,主要的'], ['central is a key word in gaokao.']],
  ['ceremony', 'n.', '典礼,仪式', '985', ['典礼,仪式'], ['典礼,仪式'], ['ceremony is a key word in gaokao.']],
  ['certainly', 'adv.', '一定,必定,当然', '985', ['一定,必定,当然'], ['一定,必定,当然'], ['certainly is a key word in gaokao.']],
  ['chain', 'n.', '链,链条,项圈', '985', ['链,链条,项圈'], ['链,链条,项圈'], ['chain is a key word in gaokao.']],
  ['challenge', 'v/', 'n.挑战', '985', ['n.挑战'], ['n.挑战'], ['challenge is a key word in gaokao.']],
  ['champion', 'n.', '冠军,拥护者vt.支持，拥护', '985', ['冠军,拥护者vt.支'], ['冠军,拥护者vt.支持，拥护'], ['champion is a key word in gaokao.']],
  ['channel', 'n.', '海峡,渠道,频道', '985', ['海峡,渠道,频道'], ['海峡,渠道,频道'], ['channel is a key word in gaokao.']],
  ['chapter', 'n.', '章,回', '985', ['章,回'], ['章,回'], ['chapter is a key word in gaokao.']],
  ['character', 'n.', '性格,品质，特性,角色，汉字', '985', ['性格,品质，特性,角'], ['性格,品质，特性,角色，汉字'], ['character is a key word in gaokao.']],
  ['characteristic', 'adj.', '特有的n.特性', '985', ['特有的n.特性'], ['特有的n.特性'], ['characteristic is a key word in gaokao.']],
  ['charge', 'vt.', '索价,控告，充电，使承担n.费用，控告，电荷，掌管', '985', ['索价,控告，充电，使'], ['索价,控告，充电，使承担n.费用，控告，电荷，掌管'], ['charge is a key word in gaokao.']],
  ['chat', 'vi.', 'n.闲谈,聊天', '985', ['n.闲谈,聊天'], ['n.闲谈,聊天'], ['chat is a key word in gaokao.']],
  ['cheek', 'n.', '面颊,脸蛋', '985', ['面颊,脸蛋'], ['面颊,脸蛋'], ['cheek is a key word in gaokao.']],
  ['chief', 'adj.', '主要的,首席的', '985', ['主要的,首席的'], ['主要的,首席的'], ['chief is a key word in gaokao.']],
  ['chimney', 'n.', '烟囱', '985', ['烟囱'], ['烟囱'], ['chimney is a key word in gaokao.']],
  ['cigar', 'n.', '雪茄', '985', ['雪茄'], ['雪茄'], ['cigar is a key word in gaokao.']],
  ['cigarette', 'n.', '香烟', '985', ['香烟'], ['香烟'], ['cigarette is a key word in gaokao.']],
  ['citizen', 'n.', '公民,市民,居民', '985', ['公民,市民,居民'], ['公民,市民,居民'], ['citizen is a key word in gaokao.']],
  ['civil', 'adj.', '公民的,文职的', '985', ['公民的,文职的'], ['公民的,文职的'], ['civil is a key word in gaokao.']],
  ['clerk', 'n.', '店员,办事员,职员', '985', ['店员,办事员,职员'], ['店员,办事员,职员'], ['clerk is a key word in gaokao.']],
  ['climate', 'n.', '气候', '985', ['气候'], ['气候'], ['climate is a key word in gaokao.']],
  ['clinic', 'n.', '诊所,医务室,会诊', '985', ['诊所,医务室,会诊'], ['诊所,医务室,会诊'], ['clinic is a key word in gaokao.']],
  ['clothing', 'n.', '衣服', '985', ['衣服'], ['衣服'], ['clothing is a key word in gaokao.']],
  ['cock', 'n.', '公鸡,龙头', '985', ['公鸡,龙头'], ['公鸡,龙头'], ['cock is a key word in gaokao.']],
  ['collar', 'n.', '衣领', '985', ['衣领'], ['衣领'], ['collar is a key word in gaokao.']],
  ['comb', 'n.', '梳子vt.梳理', '985', ['梳子vt.梳理'], ['梳子vt.梳理'], ['comb is a key word in gaokao.']],
  ['combine', 'vt.', '使联合', '985', ['使联合'], ['使联合'], ['combine is a key word in gaokao.']],
  ['comedy', 'n.', '喜剧', '985', ['喜剧'], ['喜剧'], ['comedy is a key word in gaokao.']],
  ['comfort', 'n.', '舒适,安慰vt.安慰', '985', ['舒适,安慰vt.安慰'], ['舒适,安慰vt.安慰'], ['comfort is a key word in gaokao.']],
  ['comment', 'n.', '评论,意见,注释', '985', ['评论,意见,注释'], ['评论,意见,注释'], ['comment is a key word in gaokao.']],
  ['commercial', 'adj.', '商业的n.商业广告', '985', ['商业的n.商业广告'], ['商业的n.商业广告'], ['commercial is a key word in gaokao.']],
  ['committee', 'n.', '委员会', '985', ['委员会'], ['委员会'], ['committee is a key word in gaokao.']],
  ['communism', 'n.', '共产主义', '985', ['共产主义'], ['共产主义'], ['communism is a key word in gaokao.']],
  ['communist', 'n.', '共产党员', '985', ['共产党员'], ['共产党员'], ['communist is a key word in gaokao.']],
  ['companion', 'n.', '同伴vt.陪伴', '985', ['同伴vt.陪伴'], ['同伴vt.陪伴'], ['companion is a key word in gaokao.']],
  ['compete', 'vi.', '比赛,竞争', '985', ['比赛,竞争'], ['比赛,竞争'], ['compete is a key word in gaokao.']],
  ['complex', 'adj.', '综合的,复杂的', '985', ['综合的,复杂的'], ['综合的,复杂的'], ['complex is a key word in gaokao.']],
  ['comrade', 'n.', '同志', '985', ['同志'], ['同志'], ['comrade is a key word in gaokao.']],
  ['concentrate', 'v.', '集中,聚集', '985', ['集中,聚集'], ['集中,聚集'], ['concentrate is a key word in gaokao.']],
  ['concern', 'n.', '关心(的事)，关系vt.使担心，关系到', '985', ['关心(的事)，关系v'], ['关心(的事)，关系vt.使担心，关系到'], ['concern is a key word in gaokao.']],
  ['conclusion', 'n.', '结论,推论,结局', '985', ['结论,推论,结局'], ['结论,推论,结局'], ['conclusion is a key word in gaokao.']],
  ['concrete', 'n.', '混凝土a.具体的', '985', ['混凝土a.具体的'], ['混凝土a.具体的'], ['concrete is a key word in gaokao.']],
  ['conduct', 'n.', '举止,行为,指导v.指导，进行', '985', ['举止,行为,指导v.'], ['举止,行为,指导v.指导，进行'], ['conduct is a key word in gaokao.']],
  ['conductor', 'n.', '售票员,(乐队)指挥', '985', ['售票员,(乐队)指挥'], ['售票员,(乐队)指挥'], ['conductor is a key word in gaokao.']],
  ['confident', 'n.', '确信的,自信的', '985', ['确信的,自信的'], ['确信的,自信的'], ['confident is a key word in gaokao.']],
  ['confirm', 'vt.', '证实,批准', '985', ['证实,批准'], ['证实,批准'], ['confirm is a key word in gaokao.']],
  ['conflict', 'n.', '冲突', '985', ['冲突'], ['冲突'], ['conflict is a key word in gaokao.']],
  ['confuse', 'vt.', '使混乱,混淆', '985', ['使混乱,混淆'], ['使混乱,混淆'], ['confuse is a key word in gaokao.']],
  ['congratulation', 'n.', '祝词,贺辞', '985', ['祝词,贺辞'], ['祝词,贺辞'], ['congratulation is a key word in gaokao.']],
  ['consist', 'vi.', '由…组成', '985', ['由…组成'], ['由…组成'], ['consist is a key word in gaokao.']],
  ['constant', 'adj.', '经常的,恒定的，不变的n.(数)常数，恒量', '985', ['经常的,恒定的，不变'], ['经常的,恒定的，不变的n.(数)常数，恒量'], ['constant is a key word in gaokao.']],
  ['construction', 'n.', '建造,建筑物', '985', ['建造,建筑物'], ['建造,建筑物'], ['construction is a key word in gaokao.']],
  ['consume', 'vt.', '消耗,消费', '985', ['消耗,消费'], ['消耗,消费'], ['consume is a key word in gaokao.']],
  ['contain', 'vt.', '包含,容纳', '985', ['包含,容纳'], ['包含,容纳'], ['contain is a key word in gaokao.']],
  ['content', 'adj.', '满意的,满足的', '985', ['满意的,满足的'], ['满意的,满足的'], ['content is a key word in gaokao.']],
  ['continent', 'n.', '大陆,洲', '985', ['大陆,洲'], ['大陆,洲'], ['continent is a key word in gaokao.']],
  ['contribute', 'vt.', '捐献,捐助,投稿', '985', ['捐献,捐助,投稿'], ['捐献,捐助,投稿'], ['contribute is a key word in gaokao.']],
  ['convenient', 'adj.', '便利的,方便的', '985', ['便利的,方便的'], ['便利的,方便的'], ['convenient is a key word in gaokao.']],
  ['convince', 'vt.', '使确信,使信服', '985', ['使确信,使信服'], ['使确信,使信服'], ['convince is a key word in gaokao.']],
  ['corn', 'n.', '谷物,玉米', '985', ['谷物,玉米'], ['谷物,玉米'], ['corn is a key word in gaokao.']],
  ['cottage', 'n.', '村舍,小屋', '985', ['村舍,小屋'], ['村舍,小屋'], ['cottage is a key word in gaokao.']],
  ['counter', 'n.', '柜台,计数器', '985', ['柜台,计数器'], ['柜台,计数器'], ['counter is a key word in gaokao.']],
  ['court', 'n.', '法庭，球场，朝廷', '985', ['法庭，球场，朝廷'], ['法庭，球场，朝廷'], ['court is a key word in gaokao.']],
  ['courtyard', 'n.', '庭院,院子', '985', ['庭院,院子'], ['庭院,院子'], ['courtyard is a key word in gaokao.']],
  ['crash', 'vi.', '碰撞,坠落n.碰撞，坠毁，破产', '985', ['碰撞,坠落n.碰撞，'], ['碰撞,坠落n.碰撞，坠毁，破产'], ['crash is a key word in gaokao.']],
  ['cream', 'n.', '奶油', '985', ['奶油'], ['奶油'], ['cream is a key word in gaokao.']],
  ['creature', 'n.', '生物,创造物', '985', ['生物,创造物'], ['生物,创造物'], ['creature is a key word in gaokao.']],
  ['credit', 'n.', '信用,信任，分数vt.信任', '985', ['信用,信任，分数vt'], ['信用,信任，分数vt.信任'], ['credit is a key word in gaokao.']],
  ['crew', 'n.', '全体船员', '985', ['全体船员'], ['全体船员'], ['crew is a key word in gaokao.']],
  ['crime', 'n.', '罪,罪行,犯罪', '985', ['罪,罪行,犯罪'], ['罪,罪行,犯罪'], ['crime is a key word in gaokao.']],
  ['crop', 'n.', '农作物,庄稼', '985', ['农作物,庄稼'], ['农作物,庄稼'], ['crop is a key word in gaokao.']],
  ['crossing', 'n.', '十字路口', '985', ['十字路口'], ['十字路口'], ['crossing is a key word in gaokao.']],
  ['crowd', 'n.', '群,大众,一伙人', '985', ['群,大众,一伙人'], ['群,大众,一伙人'], ['crowd is a key word in gaokao.']],
  ['cupboard', 'n.', '碗柜', '985', ['碗柜'], ['碗柜'], ['cupboard is a key word in gaokao.']],
  ['cure', 'vt.', 'n.治疗，治愈', '985', ['n.治疗，治愈'], ['n.治疗，治愈'], ['cure is a key word in gaokao.']],
  ['curious', 'adj.', '好奇的', '985', ['好奇的'], ['好奇的'], ['curious is a key word in gaokao.']],
  ['curtain', 'n.', '帘,窗帘,幕(布)', '985', ['帘,窗帘,幕(布)'], ['帘,窗帘,幕(布)'], ['curtain is a key word in gaokao.']],
  ['cushion', 'n.', '垫子,坐垫,靠垫', '985', ['垫子,坐垫,靠垫'], ['垫子,坐垫,靠垫'], ['cushion is a key word in gaokao.']],
  ['custom', 'n.', '习惯,风俗,海关', '985', ['习惯,风俗,海关'], ['习惯,风俗,海关'], ['custom is a key word in gaokao.']],
  ['customer', 'n.', '顾客', '985', ['顾客'], ['顾客'], ['customer is a key word in gaokao.']],
  ['cycle', 'n.', '循环，自行车v.(使)循环，骑自行车', '985', ['循环，自行车v.(使'], ['循环，自行车v.(使)循环，骑自行车'], ['cycle is a key word in gaokao.']],
  ['damage', 'vt.', '损害,毁坏n.损害', '985', ['损害,毁坏n.损害'], ['损害,毁坏n.损害'], ['damage is a key word in gaokao.']],
  ['damp', 'adj.', '潮湿的', '985', ['潮湿的'], ['潮湿的'], ['damp is a key word in gaokao.']],
  ['darkness', 'n.', '黑暗', '985', ['黑暗'], ['黑暗'], ['darkness is a key word in gaokao.']],
  ['dawn', 'n.', '黎明,开端', '985', ['黎明,开端'], ['黎明,开端'], ['dawn is a key word in gaokao.']],
  ['deadline', 'n.', '最终期限', '985', ['最终期限'], ['最终期限'], ['deadline is a key word in gaokao.']],
  ['debate', 'n.', 'vi.争论,辩论', '985', ['vi.争论,辩论'], ['vi.争论,辩论'], ['debate is a key word in gaokao.']],
  ['debt', 'n.', '债务,欠债', '985', ['债务,欠债'], ['债务,欠债'], ['debt is a key word in gaokao.']],
  ['declare', 'vt.', '断言,声明', '985', ['断言,声明'], ['断言,声明'], ['declare is a key word in gaokao.']],
  ['decorate', 'vt.', '装饰', '985', ['装饰'], ['装饰'], ['decorate is a key word in gaokao.']],
  ['decrease', 'vi.', 'n.减少', '985', ['n.减少'], ['n.减少'], ['decrease is a key word in gaokao.']],
  ['deed', 'n.', '行为,功绩,契约', '985', ['行为,功绩,契约'], ['行为,功绩,契约'], ['deed is a key word in gaokao.']],
  ['defeat', 'vt.', '战胜,击败', '985', ['战胜,击败'], ['战胜,击败'], ['defeat is a key word in gaokao.']],
  ['defence', 'n.', '防御,辩护', '985', ['防御,辩护'], ['防御,辩护'], ['defence is a key word in gaokao.']],
  ['defend', 'vt.', '保卫,防守，辩护', '985', ['保卫,防守，辩护'], ['保卫,防守，辩护'], ['defend is a key word in gaokao.']],
  ['degree', 'n.', '程度,度,学位', '985', ['程度,度,学位'], ['程度,度,学位'], ['degree is a key word in gaokao.']],
  ['delay', 'vt.', '推迟,耽搁,延误', '985', ['推迟,耽搁,延误'], ['推迟,耽搁,延误'], ['delay is a key word in gaokao.']],
  ['delete', 'vt.', '删除,擦掉', '985', ['删除,擦掉'], ['删除,擦掉'], ['delete is a key word in gaokao.']],
  ['delight', 'n.', '快乐vt.使高兴', '985', ['快乐vt.使高兴'], ['快乐vt.使高兴'], ['delight is a key word in gaokao.']],
  ['deliver', 'vt.', '投递,送交', '985', ['投递,送交'], ['投递,送交'], ['deliver is a key word in gaokao.']],
  ['demand', 'vt.', '要求,需要', '985', ['要求,需要'], ['要求,需要'], ['demand is a key word in gaokao.']],
  ['department', 'n.', '部,司,局,处,系', '985', ['部,司,局,处,系'], ['部,司,局,处,系'], ['department is a key word in gaokao.']],
  ['depth', 'n.', '深度,深处', '985', ['深度,深处'], ['深度,深处'], ['depth is a key word in gaokao.']],
  ['desert', 'n.', '沙漠，荒原vt.遗弃，放弃', '985', ['沙漠，荒原vt.遗弃'], ['沙漠，荒原vt.遗弃，放弃'], ['desert is a key word in gaokao.']],
  ['deserve', 'vt.', '应受,值得', '985', ['应受,值得'], ['应受,值得'], ['deserve is a key word in gaokao.']],
  ['design', 'vt.', '设计n.设计', '985', ['设计n.设计'], ['设计n.设计'], ['design is a key word in gaokao.']],
  ['desire', 'vt.', '想要,要求n.愿望，要求', '985', ['想要,要求n.愿望，'], ['想要,要求n.愿望，要求'], ['desire is a key word in gaokao.']],
  ['destination', 'n.', '目的地,终点', '985', ['目的地,终点'], ['目的地,终点'], ['destination is a key word in gaokao.']],
  ['destroy', 'vt.', '破坏,消灭', '985', ['破坏,消灭'], ['破坏,消灭'], ['destroy is a key word in gaokao.']],
  ['detect', 'vt.', '察觉,发觉,侦察', '985', ['察觉,发觉,侦察'], ['察觉,发觉,侦察'], ['detect is a key word in gaokao.']],
  ['determine', 'vt.', '决定,决心', '985', ['决定,决心'], ['决定,决心'], ['determine is a key word in gaokao.']],
  ['devote', 'vt.', '将…奉献,致力于', '985', ['将…奉献,致力于'], ['将…奉献,致力于'], ['devote is a key word in gaokao.']],
  ['diagram', 'n.', '图解,图表', '985', ['图解,图表'], ['图解,图表'], ['diagram is a key word in gaokao.']],
  ['dial', 'n.', '钟面,拨号盘，刻度盘vt.拨号', '985', ['钟面,拨号盘，刻度盘'], ['钟面,拨号盘，刻度盘vt.拨号'], ['dial is a key word in gaokao.']],
  ['diamond', 'n.', '钻石,菱形', '985', ['钻石,菱形'], ['钻石,菱形'], ['diamond is a key word in gaokao.']],
  ['dictation', 'n.', '听写，口述', '985', ['听写，口述'], ['听写，口述'], ['dictation is a key word in gaokao.']],
  ['diet', 'n.', '饮食,食物v.节食', '985', ['饮食,食物v.节食'], ['饮食,食物v.节食'], ['diet is a key word in gaokao.']],
  ['differ', 'vi.', '不同,相异', '985', ['不同,相异'], ['不同,相异'], ['differ is a key word in gaokao.']],
  ['digest', 'vt.', '消化,领会n.文摘', '985', ['消化,领会n.文摘'], ['消化,领会n.文摘'], ['digest is a key word in gaokao.']],
  ['digital', 'adj.', '数字的，数码的', '985', ['数字的，数码的'], ['数字的，数码的'], ['digital is a key word in gaokao.']],
  ['dirt', 'n.', '泥土，灰尘,污垢', '985', ['泥土，灰尘,污垢'], ['泥土，灰尘,污垢'], ['dirt is a key word in gaokao.']],
  ['disadvantage', 'n.', '缺点，不利条件', '985', ['缺点，不利条件'], ['缺点，不利条件'], ['disadvantage is a key word in gaokao.']],
  ['disagree', 'vi.', '不同意;不一致', '985', ['不同意;不一致'], ['不同意;不一致'], ['disagree is a key word in gaokao.']],
  ['disappear', 'vi.', '不见,失踪,消失', '985', ['不见,失踪,消失'], ['不见,失踪,消失'], ['disappear is a key word in gaokao.']],
  ['disappoint', 'vt.', '使失望', '985', ['使失望'], ['使失望'], ['disappoint is a key word in gaokao.']],
  ['disaster', 'n.', '灾难', '985', ['灾难'], ['灾难'], ['disaster is a key word in gaokao.']],
  ['discount', 'n.', '折扣v.打折', '985', ['折扣v.打折'], ['折扣v.打折'], ['discount is a key word in gaokao.']],
  ['discriminate', 'vt.', 'vi.区别对待,歧视', '985', ['vi.区别对待,歧视'], ['vi.区别对待,歧视'], ['discriminate is a key word in gaokao.']],
  ['dislike', 'vt.', 'n.不喜爱,厌恶', '985', ['n.不喜爱,厌恶'], ['n.不喜爱,厌恶'], ['dislike is a key word in gaokao.']],
  ['distance', 'n.', '距离,远处', '985', ['距离,远处'], ['距离,远处'], ['distance is a key word in gaokao.']],
  ['distant', 'adj.', '在远处的,疏远的，冷漠的', '985', ['在远处的,疏远的，冷'], ['在远处的,疏远的，冷漠的'], ['distant is a key word in gaokao.']],
  ['distinguish', 'vt.', '区别,辨别', '985', ['区别,辨别'], ['区别,辨别'], ['distinguish is a key word in gaokao.']],
  ['district', 'n.', '地区,区域', '985', ['地区,区域'], ['地区,区域'], ['district is a key word in gaokao.']],
  ['document', 'n.', '文件，公文vt.用文件证明', '985', ['文件，公文vt.用文'], ['文件，公文vt.用文件证明'], ['document is a key word in gaokao.']],
  ['donate', 'vt.', 'vi.捐赠', '985', ['vi.捐赠'], ['vi.捐赠'], ['donate is a key word in gaokao.']],
  ['dormitory', 'n.', '集体寝室,宿舍', '985', ['集体寝室,宿舍'], ['集体寝室,宿舍'], ['dormitory is a key word in gaokao.']],
  ['dot', 'n.', '点,圆点vt.打点于', '985', ['点,圆点vt.打点于'], ['点,圆点vt.打点于'], ['dot is a key word in gaokao.']],
  ['download', 'n.', '下装,卸载', '985', ['下装,卸载'], ['下装,卸载'], ['download is a key word in gaokao.']],
  ['downtown', 'adv.', '在市区,往市区', '985', ['在市区,往市区'], ['在市区,往市区'], ['downtown is a key word in gaokao.']],
  ['drawing', 'n.', '绘画', '985', ['绘画'], ['绘画'], ['drawing is a key word in gaokao.']],
  ['drill', 'n.', '钻孔机，训练vi.钻孔，训练', '985', ['钻孔机，训练vi.钻'], ['钻孔机，训练vi.钻孔，训练'], ['drill is a key word in gaokao.']],
  ['drown', 'v.', '淹没，溺死', '985', ['淹没，溺死'], ['淹没，溺死'], ['drown is a key word in gaokao.']],
  ['drunk', 'adj.', '醉的,陶醉的', '985', ['醉的,陶醉的'], ['醉的,陶醉的'], ['drunk is a key word in gaokao.']],
  ['due', 'adj.', '预期的,到期的，应付的', '985', ['预期的,到期的，应付'], ['预期的,到期的，应付的'], ['due is a key word in gaokao.']],
  ['dull', 'adj.', '枯燥的,阴暗的', '985', ['枯燥的,阴暗的'], ['枯燥的,阴暗的'], ['dull is a key word in gaokao.']],
  ['dust', 'n.', '灰尘', '985', ['灰尘'], ['灰尘'], ['dust is a key word in gaokao.']],
  ['dusty', 'adj.', '落满灰尘的，灰蒙蒙的', '985', ['落满灰尘的，灰蒙蒙的'], ['落满灰尘的，灰蒙蒙的'], ['dusty is a key word in gaokao.']],
  ['eager', 'adj.', '渴望的,热切的', '985', ['渴望的,热切的'], ['渴望的,热切的'], ['eager is a key word in gaokao.']],
  ['earn', 'vt.', '挣得,获得', '985', ['挣得,获得'], ['挣得,获得'], ['earn is a key word in gaokao.']],
  ['earthquake', 'n.', '地震', '985', ['地震'], ['地震'], ['earthquake is a key word in gaokao.']],
  ['eastern', 'adj.', '东方的,朝东的', '985', ['东方的,朝东的'], ['东方的,朝东的'], ['eastern is a key word in gaokao.']],
  ['edit', 'vt.', '编辑,编纂,校订', '985', ['编辑,编纂,校订'], ['编辑,编纂,校订'], ['edit is a key word in gaokao.']],
  ['effect', 'n.', '影响，效果,作用', '985', ['影响，效果,作用'], ['影响，效果,作用'], ['effect is a key word in gaokao.']],
  ['elect', 'vt.', '选举,推选', '985', ['选举,推选'], ['选举,推选'], ['elect is a key word in gaokao.']],
  ['electricity', 'n.', '电,电流', '985', ['电,电流'], ['电,电流'], ['electricity is a key word in gaokao.']],
  ['electronic', 'adj.', '电子的', '985', ['电子的'], ['电子的'], ['electronic is a key word in gaokao.']],
  ['embarrass', 'vt.', '使窘迫,使为难', '985', ['使窘迫,使为难'], ['使窘迫,使为难'], ['embarrass is a key word in gaokao.']],
  ['emergency', 'n.', '紧急情况,突然事件', '985', ['紧急情况,突然事件'], ['紧急情况,突然事件'], ['emergency is a key word in gaokao.']],
  ['employ', 'vt.', '雇用', '985', ['雇用'], ['雇用'], ['employ is a key word in gaokao.']],
  ['endless', 'adj.', '无止境的', '985', ['无止境的'], ['无止境的'], ['endless is a key word in gaokao.']],
  ['engine', 'n.', '发动机,引擎', '985', ['发动机,引擎'], ['发动机,引擎'], ['engine is a key word in gaokao.']],
  ['enjoyable', 'adj.', '使人快乐的，有乐趣的', '985', ['使人快乐的，有乐趣的'], ['使人快乐的，有乐趣的'], ['enjoyable is a key word in gaokao.']],
  ['entertainment', 'n.', '娱乐,款待,娱乐表演', '985', ['娱乐,款待,娱乐表演'], ['娱乐,款待,娱乐表演'], ['entertainment is a key word in gaokao.']],
  ['entire', 'adj.', '全部的,彻底的', '985', ['全部的,彻底的'], ['全部的,彻底的'], ['entire is a key word in gaokao.']],
  ['entrance', 'n.', '入口,进入', '985', ['入口,进入'], ['入口,进入'], ['entrance is a key word in gaokao.']],
  ['envelope', 'n.', '信封,封皮', '985', ['信封,封皮'], ['信封,封皮'], ['envelope is a key word in gaokao.']],
  ['envy', 'vt.', 'n.妒忌,羡慕', '985', ['n.妒忌,羡慕'], ['n.妒忌,羡慕'], ['envy is a key word in gaokao.']],
  ['equal', 'adj.', '相等的,平等的', '985', ['相等的,平等的'], ['相等的,平等的'], ['equal is a key word in gaokao.']],
  ['equipment', 'n.', '装备,设备,配备', '985', ['装备,设备,配备'], ['装备,设备,配备'], ['equipment is a key word in gaokao.']],
  ['error', 'n.', '错误,误差，过失', '985', ['错误,误差，过失'], ['错误,误差，过失'], ['error is a key word in gaokao.']],
  ['escape', 'vi.', '逃脱，逃避n.逃跑，逃亡', '985', ['逃脱，逃避n.逃跑，'], ['逃脱，逃避n.逃跑，逃亡'], ['escape is a key word in gaokao.']],
  ['especially', 'adv.', '特别,尤其,格外', '985', ['特别,尤其,格外'], ['特别,尤其,格外'], ['especially is a key word in gaokao.']],
  ['essay', 'n.', '散文,文章，随笔', '985', ['散文,文章，随笔'], ['散文,文章，随笔'], ['essay is a key word in gaokao.']],
  ['evaluate', 'vt.', '评价,估价', '985', ['评价,估价'], ['评价,估价'], ['evaluate is a key word in gaokao.']],
  ['event', 'n.', '事件,大事', '985', ['事件,大事'], ['事件,大事'], ['event is a key word in gaokao.']],
  ['evidence', 'n.', '根据,依据', '985', ['根据,依据'], ['根据,依据'], ['evidence is a key word in gaokao.']],
  ['exact', 'adj.', '确切的,精确的', '985', ['确切的,精确的'], ['确切的,精确的'], ['exact is a key word in gaokao.']],
  ['exactly', 'adv.', '恰好是，准确地', '985', ['恰好是，准确地'], ['恰好是，准确地'], ['exactly is a key word in gaokao.']],
  ['exchange', 'vt.', 'n.交换,交流，交易，兑换', '985', ['n.交换,交流，交易'], ['n.交换,交流，交易，兑换'], ['exchange is a key word in gaokao.']],
  ['exciting', 'adj.', '令人兴奋的', '985', ['令人兴奋的'], ['令人兴奋的'], ['exciting is a key word in gaokao.']],
  ['exhibition', 'n.', '展览,陈列,展览会', '985', ['展览,陈列,展览会'], ['展览,陈列,展览会'], ['exhibition is a key word in gaokao.']],
  ['exist', 'vi.', '存在,生存', '985', ['存在,生存'], ['存在,生存'], ['exist is a key word in gaokao.']],
  ['exit', 'n.', '出口,退场vi.退出', '985', ['出口,退场vi.退出'], ['出口,退场vi.退出'], ['exit is a key word in gaokao.']],
  ['expand', 'vt.', '扩大,使膨胀,发展', '985', ['扩大,使膨胀,发展'], ['扩大,使膨胀,发展'], ['expand is a key word in gaokao.']],
  ['expense', 'n.', '花费,消费,费用', '985', ['花费,消费,费用'], ['花费,消费,费用'], ['expense is a key word in gaokao.']],
  ['expert', 'n.', '专家a.熟练的', '985', ['专家a.熟练的'], ['专家a.熟练的'], ['expert is a key word in gaokao.']],
  ['explanation', 'n.', '解释,说明,辩解', '985', ['解释,说明,辩解'], ['解释,说明,辩解'], ['explanation is a key word in gaokao.']],
  ['explode', 'vt.', '使爆炸vi.爆炸', '985', ['使爆炸vi.爆炸'], ['使爆炸vi.爆炸'], ['explode is a key word in gaokao.']],
  ['exploit', 'vt.', '剥削,开发，开采', '985', ['剥削,开发，开采'], ['剥削,开发，开采'], ['exploit is a key word in gaokao.']],
  ['explore', 'vt.', 'vi.探险,探索', '985', ['vi.探险,探索'], ['vi.探险,探索'], ['explore is a key word in gaokao.']],
  ['export', 'vt.', '输出,出口', '985', ['输出,出口'], ['输出,出口'], ['export is a key word in gaokao.']],
  ['expression', 'n.', '措辞,词句，表达,表情', '985', ['措辞,词句，表达,表'], ['措辞,词句，表达,表情'], ['expression is a key word in gaokao.']],
  ['extra', 'adj.', '额外的ad.另外', '985', ['额外的ad.另外'], ['额外的ad.另外'], ['extra is a key word in gaokao.']],
  ['extraordinary', 'adj.', '非同寻常的,非凡的，特别的', '985', ['非同寻常的,非凡的，'], ['非同寻常的,非凡的，特别的'], ['extraordinary is a key word in gaokao.']],
  ['extremely', 'adv.', '极其，极端地', '985', ['极其，极端地'], ['极其，极端地'], ['extremely is a key word in gaokao.']],
  ['fade', 'vi.', '褪色,逐渐消失', '985', ['褪色,逐渐消失'], ['褪色,逐渐消失'], ['fade is a key word in gaokao.']],
  ['failure', 'n.', '失败,失败的人/事', '985', ['失败,失败的人/事'], ['失败,失败的人/事'], ['failure is a key word in gaokao.']],
  ['fairly', 'adv.', '相当,公平地', '985', ['相当,公平地'], ['相当,公平地'], ['fairly is a key word in gaokao.']],
  ['faith', 'n.', '信任,信心,信仰', '985', ['信任,信心,信仰'], ['信任,信心,信仰'], ['faith is a key word in gaokao.']],
  ['false', 'adj.', '不真实的,伪造的', '985', ['不真实的,伪造的'], ['不真实的,伪造的'], ['false is a key word in gaokao.']],
  ['familiar', 'adj.', '熟悉的', '985', ['熟悉的'], ['熟悉的'], ['familiar is a key word in gaokao.']],
  ['farther', 'adv.', '更远地a.更远的', '985', ['更远地a.更远的'], ['更远地a.更远的'], ['farther is a key word in gaokao.']],
  ['fasten', 'vt.', '扎牢,使固定', '985', ['扎牢,使固定'], ['扎牢,使固定'], ['fasten is a key word in gaokao.']],
  ['fault', 'n.', '错误，缺点,毛病,故障', '985', ['错误，缺点,毛病,故'], ['错误，缺点,毛病,故障'], ['fault is a key word in gaokao.']],
  ['favor', 'n.', '好感,赞同,恩惠', '985', ['好感,赞同,恩惠'], ['好感,赞同,恩惠'], ['favor is a key word in gaokao.']],
  ['fax', 'n.', 'vt.传真', '985', ['vt.传真'], ['vt.传真'], ['fax is a key word in gaokao.']],
  ['feather', 'n.', '羽毛,翎毛,羽状物', '985', ['羽毛,翎毛,羽状物'], ['羽毛,翎毛,羽状物'], ['feather is a key word in gaokao.']],
  ['federal', 'adj.', '联邦的,联盟的', '985', ['联邦的,联盟的'], ['联邦的,联盟的'], ['federal is a key word in gaokao.']],
  ['fee', 'n.', '费用，酬金，小费v.付费给', '985', ['费用，酬金，小费v.'], ['费用，酬金，小费v.付费给'], ['fee is a key word in gaokao.']],
  ['fellow', 'n.', '家伙,伙伴', '985', ['家伙,伙伴'], ['家伙,伙伴'], ['fellow is a key word in gaokao.']],
  ['female', 'n.', 'a.女性的,雌性的', '985', ['a.女性的,雌性的'], ['a.女性的,雌性的'], ['female is a key word in gaokao.']],
  ['fence', 'n.', '栅栏v.围以栅栏', '985', ['栅栏v.围以栅栏'], ['栅栏v.围以栅栏'], ['fence is a key word in gaokao.']],
  ['fiction', 'n.', '小说,虚构,谎言', '985', ['小说,虚构,谎言'], ['小说,虚构,谎言'], ['fiction is a key word in gaokao.']],
  ['fierce', 'adj.', '凶猛的,猛烈的', '985', ['凶猛的,猛烈的'], ['凶猛的,猛烈的'], ['fierce is a key word in gaokao.']],
  ['figure', 'n.', '数字,人物，体形，画像，图形v.计算，认为', '985', ['数字,人物，体形，画'], ['数字,人物，体形，画像，图形v.计算，认为'], ['figure is a key word in gaokao.']],
  ['file', 'n.', '文件，档案，文件夹vt.把…归档', '985', ['文件，档案，文件夹v'], ['文件，档案，文件夹vt.把…归档'], ['file is a key word in gaokao.']],
  ['finance', 'n.', '财政,金融', '985', ['财政,金融'], ['财政,金融'], ['finance is a key word in gaokao.']],
  ['fireworks', 'n.', '[pl.]爆竹,烟花', '985', ['[pl.]爆竹,烟花'], ['[pl.]爆竹,烟花'], ['fireworks is a key word in gaokao.']],
  ['firm', 'adj.', '坚定的n.公司,商号', '985', ['坚定的n.公司,商号'], ['坚定的n.公司,商号'], ['firm is a key word in gaokao.']],
  ['fist', 'n.', '拳头', '985', ['拳头'], ['拳头'], ['fist is a key word in gaokao.']],
  ['flame', 'n.', '火焰,光辉,热情', '985', ['火焰,光辉,热情'], ['火焰,光辉,热情'], ['flame is a key word in gaokao.']],
  ['flash', 'n.', '闪光vi.闪,闪烁', '985', ['闪光vi.闪,闪烁'], ['闪光vi.闪,闪烁'], ['flash is a key word in gaokao.']],
  ['flesh', 'n.', '肉,肌肉,肉体', '985', ['肉,肌肉,肉体'], ['肉,肌肉,肉体'], ['flesh is a key word in gaokao.']],
  ['flight', 'n.', '航班,飞行,逃跑', '985', ['航班,飞行,逃跑'], ['航班,飞行,逃跑'], ['flight is a key word in gaokao.']],
  ['float', 'vi.', '漂浮vt.使漂浮', '985', ['漂浮vt.使漂浮'], ['漂浮vt.使漂浮'], ['float is a key word in gaokao.']],
  ['flood', 'n.', '洪水', '985', ['洪水'], ['洪水'], ['flood is a key word in gaokao.']],
  ['flour', 'n.', '面粉,粉状物质', '985', ['面粉,粉状物质'], ['面粉,粉状物质'], ['flour is a key word in gaokao.']],
  ['flow', 'vi.', '流动n.流动，流量', '985', ['流动n.流动，流量'], ['流动n.流动，流量'], ['flow is a key word in gaokao.']],
  ['fluent', 'adj.', '流利的,流畅的', '985', ['流利的,流畅的'], ['流利的,流畅的'], ['fluent is a key word in gaokao.']],
  ['focus', 'vi.', '聚焦,注视n.焦点', '985', ['聚焦,注视n.焦点'], ['聚焦,注视n.焦点'], ['focus is a key word in gaokao.']],
  ['foggy', 'adj.', '有雾的，朦胧的', '985', ['有雾的，朦胧的'], ['有雾的，朦胧的'], ['foggy is a key word in gaokao.']],
  ['fold', 'vt.', '折叠,合拢n.褶', '985', ['折叠,合拢n.褶'], ['折叠,合拢n.褶'], ['fold is a key word in gaokao.']],
  ['folk', 'adj.', '民间的n.百姓', '985', ['民间的n.百姓'], ['民间的n.百姓'], ['folk is a key word in gaokao.']],
  ['fond', 'adj.', '喜爱的，宠爱的', '985', ['喜爱的，宠爱的'], ['喜爱的，宠爱的'], ['fond is a key word in gaokao.']],
  ['fool', 'n.', '傻子vt.欺骗,愚弄', '985', ['傻子vt.欺骗,愚弄'], ['傻子vt.欺骗,愚弄'], ['fool is a key word in gaokao.']],
  ['foolish', 'adj.', '愚蠢的', '985', ['愚蠢的'], ['愚蠢的'], ['foolish is a key word in gaokao.']],
  ['forbid', 'vt.', '禁止', '985', ['禁止'], ['禁止'], ['forbid is a key word in gaokao.']],
  ['forecast', 'n.', 'v.预测,预报,预示', '985', ['v.预测,预报,预示'], ['v.预测,预报,预示'], ['forecast is a key word in gaokao.']],
  ['forever', 'adv.', '永远,不断地，常常', '985', ['永远,不断地，常常'], ['永远,不断地，常常'], ['forever is a key word in gaokao.']],
  ['forgive', 'vt.', '原谅,宽恕', '985', ['原谅,宽恕'], ['原谅,宽恕'], ['forgive is a key word in gaokao.']],
  ['former', 'adj.', '前者的n.前者', '985', ['前者的n.前者'], ['前者的n.前者'], ['former is a key word in gaokao.']],
  ['fortnight', 'n.', '两星期,十四天', '985', ['两星期,十四天'], ['两星期,十四天'], ['fortnight is a key word in gaokao.']],
  ['fortunate', 'adj.', '幸运的', '985', ['幸运的'], ['幸运的'], ['fortunate is a key word in gaokao.']],
  ['fortunately', 'adv.', '幸运地,', '985', ['幸运地,'], ['幸运地,'], ['fortunately is a key word in gaokao.']],
  ['fortune', 'n.', '命运,运气,财富', '985', ['命运,运气,财富'], ['命运,运气,财富'], ['fortune is a key word in gaokao.']],
  ['found', 'vt.', '创立,创办', '985', ['创立,创办'], ['创立,创办'], ['found is a key word in gaokao.']],
  ['fountain', 'n.', '泉水,喷泉，源泉', '985', ['泉水,喷泉，源泉'], ['泉水,喷泉，源泉'], ['fountain is a key word in gaokao.']],
  ['freedom', 'n.', '自由', '985', ['自由'], ['自由'], ['freedom is a key word in gaokao.']],
  ['frequent', 'adj.', '频繁的', '985', ['频繁的'], ['频繁的'], ['frequent is a key word in gaokao.']],
  ['frequently', 'adv.', '频繁地', '985', ['频繁地'], ['频繁地'], ['frequently is a key word in gaokao.']],
  ['frighten', 'vt.', '使惊恐,吓唬', '985', ['使惊恐,吓唬'], ['使惊恐,吓唬'], ['frighten is a key word in gaokao.']],
  ['fry', 'vt.', '油煎,油炸,油炒', '985', ['油煎,油炸,油炒'], ['油煎,油炸,油炒'], ['fry is a key word in gaokao.']],
  ['fuel', 'n.', '燃料vt.给…加燃料', '985', ['燃料vt.给…加燃料'], ['燃料vt.给…加燃料'], ['fuel is a key word in gaokao.']],
  ['function', 'n.', '功能,职务,函数v.运行，行使职责', '985', ['功能,职务,函数v.'], ['功能,职务,函数v.运行，行使职责'], ['function is a key word in gaokao.']],
  ['fur', 'n.', '皮，毛皮', '985', ['皮，毛皮'], ['皮，毛皮'], ['fur is a key word in gaokao.']],
  ['further', 'adv.', '进一步地', '985', ['进一步地'], ['进一步地'], ['further is a key word in gaokao.']],
  ['gain', 'vt.', '获得,增加，赚到n.增加，利润，收获', '985', ['获得,增加，赚到n.'], ['获得,增加，赚到n.增加，利润，收获'], ['gain is a key word in gaokao.']],
  ['garbage', 'n.', '垃圾,废物', '985', ['垃圾,废物'], ['垃圾,废物'], ['garbage is a key word in gaokao.']],
  ['gas', 'n.', '煤气,气体', '985', ['煤气,气体'], ['煤气,气体'], ['gas is a key word in gaokao.']],
  ['gather', 'vi.', '聚集,集合vt.收集', '985', ['聚集,集合vt.收集'], ['聚集,集合vt.收集'], ['gather is a key word in gaokao.']],
  ['gay', 'adj.', '快乐的,艳丽的n.同性恋者', '985', ['快乐的,艳丽的n.同'], ['快乐的,艳丽的n.同性恋者'], ['gay is a key word in gaokao.']],
  ['generally', 'adv.', '一般地,通常地，普遍地', '985', ['一般地,通常地，普遍'], ['一般地,通常地，普遍地'], ['generally is a key word in gaokao.']],
  ['generation', 'n.', '一代,一代人,产生', '985', ['一代,一代人,产生'], ['一代,一代人,产生'], ['generation is a key word in gaokao.']],
  ['generous', 'adj.', '慷慨的,宽宏大量的', '985', ['慷慨的,宽宏大量的'], ['慷慨的,宽宏大量的'], ['generous is a key word in gaokao.']],
  ['gentle', 'adj.', '温和的，文雅的', '985', ['温和的，文雅的'], ['温和的，文雅的'], ['gentle is a key word in gaokao.']],
  ['glance', 'v.', '瞥见n.一瞥', '985', ['瞥见n.一瞥'], ['瞥见n.一瞥'], ['glance is a key word in gaokao.']],
  ['globe', 'n.', '地球,地球仪，球体', '985', ['地球,地球仪，球体'], ['地球,地球仪，球体'], ['globe is a key word in gaokao.']],
  ['goal', 'n.', '球门,得分数,目标', '985', ['球门,得分数,目标'], ['球门,得分数,目标'], ['goal is a key word in gaokao.']],
  ['goods', 'n.', '货物,商品', '985', ['货物,商品'], ['货物,商品'], ['goods is a key word in gaokao.']],
  ['gradual', 'adj.', '逐渐的,渐进的', '985', ['逐渐的,渐进的'], ['逐渐的,渐进的'], ['gradual is a key word in gaokao.']],
  ['gradually', 'adv.', '逐渐地，逐步地', '985', ['逐渐地，逐步地'], ['逐渐地，逐步地'], ['gradually is a key word in gaokao.']],
  ['graduate', 'n.', '大学毕业生vi.毕业', '985', ['大学毕业生vi.毕业'], ['大学毕业生vi.毕业'], ['graduate is a key word in gaokao.']],
  ['graduation', 'n.', '毕业', '985', ['毕业'], ['毕业'], ['graduation is a key word in gaokao.']],
  ['grain', 'n.', '谷物,颗粒', '985', ['谷物,颗粒'], ['谷物,颗粒'], ['grain is a key word in gaokao.']],
  ['grand', 'adj.', '宏伟的,豪华的，极重要的', '985', ['宏伟的,豪华的，极重'], ['宏伟的,豪华的，极重要的'], ['grand is a key word in gaokao.']],
  ['grasp', 'vt.', 'n.抓住，领会', '985', ['n.抓住，领会'], ['n.抓住，领会'], ['grasp is a key word in gaokao.']],
  ['gravity', 'n.', '重力,地心引力,严重性，庄严', '985', ['重力,地心引力,严重'], ['重力,地心引力,严重性，庄严'], ['gravity is a key word in gaokao.']],
  ['greatly', 'adv.', '很，大大地，非常地', '985', ['很，大大地，非常地'], ['很，大大地，非常地'], ['greatly is a key word in gaokao.']],
  ['greet', 'vt.', '问候,欢迎', '985', ['问候,欢迎'], ['问候,欢迎'], ['greet is a key word in gaokao.']],
  ['grey', 'n.', '/a.灰色(的)', '985', ['/a.灰色(的)'], ['/a.灰色(的)'], ['grey is a key word in gaokao.']],
  ['grocer', 'n.', '杂货店，食品商', '985', ['杂货店，食品商'], ['杂货店，食品商'], ['grocer is a key word in gaokao.']],
  ['grocery', 'n.', '食品杂货店，食品杂货', '985', ['食品杂货店，食品杂货'], ['食品杂货店，食品杂货'], ['grocery is a key word in gaokao.']],
  ['guide', 'n.', '导游vt.指导', '985', ['导游vt.指导'], ['导游vt.指导'], ['guide is a key word in gaokao.']],
  ['guilty', 'adj.', '内疚的,有罪的', '985', ['内疚的,有罪的'], ['内疚的,有罪的'], ['guilty is a key word in gaokao.']],
  ['haircut', 'n.', '理发;发型，发式', '985', ['理发;发型，发式'], ['理发;发型，发式'], ['haircut is a key word in gaokao.']],
  ['hammer', 'n.', '锤子vt.锤击', '985', ['锤子vt.锤击'], ['锤子vt.锤击'], ['hammer is a key word in gaokao.']],
  ['handkerchief', 'n.', '手帕', '985', ['手帕'], ['手帕'], ['handkerchief is a key word in gaokao.']],
  ['handle', 'n.', '柄,把手vt.处理', '985', ['柄,把手vt.处理'], ['柄,把手vt.处理'], ['handle is a key word in gaokao.']],
  ['happiness', 'n.', '幸福;满足', '985', ['幸福;满足'], ['幸福;满足'], ['happiness is a key word in gaokao.']],
  ['harbour', 'n.', '港', '985', ['港'], ['港'], ['harbour is a key word in gaokao.']],
  ['hard-working', 'adj.', '勤劳', '985', ['勤劳'], ['勤劳'], ['hard-working is a key word in gaokao.']],
  ['hardship', 'n.', '艰难,困苦', '985', ['艰难,困苦'], ['艰难,困苦'], ['hardship is a key word in gaokao.']],
  ['harm', 'n.', '伤害,损害vt.损害', '985', ['伤害,损害vt.损害'], ['伤害,损害vt.损害'], ['harm is a key word in gaokao.']],
  ['harmony', 'n.', '协调,和谐', '985', ['协调,和谐'], ['协调,和谐'], ['harmony is a key word in gaokao.']],
  ['harvest', 'n.', '收获,收成vt.收割', '985', ['收获,收成vt.收割'], ['收获,收成vt.收割'], ['harvest is a key word in gaokao.']],
  ['headmaster', 'n.', '英国中小学校长', '985', ['英国中小学校长'], ['英国中小学校长'], ['headmaster is a key word in gaokao.']],
  ['hesitate', 'vi.', '犹豫,踌躇', '985', ['犹豫,踌躇'], ['犹豫,踌躇'], ['hesitate is a key word in gaokao.']],
  ['highway', 'n.', '公路,大路', '985', ['公路,大路'], ['公路,大路'], ['highway is a key word in gaokao.']],
  ['hire', 'vt.', '雇用，租用，出租', '985', ['雇用，租用，出租'], ['雇用，租用，出租'], ['hire is a key word in gaokao.']],
  ['honey', 'n.', '蜜,蜂蜜,甜,甜蜜', '985', ['蜜,蜂蜜,甜,甜蜜'], ['蜜,蜂蜜,甜,甜蜜'], ['honey is a key word in gaokao.']],
  ['hopeless', 'adj.', '没有希望的,绝望的', '985', ['没有希望的,绝望的'], ['没有希望的,绝望的'], ['hopeless is a key word in gaokao.']],
  ['horrible', 'adj.', '可怕的,极可厌的', '985', ['可怕的,极可厌的'], ['可怕的,极可厌的'], ['horrible is a key word in gaokao.']],
  ['host', 'n.', '主人,主持人v.主持，做主人', '985', ['主人,主持人v.主持'], ['主人,主持人v.主持，做主人'], ['host is a key word in gaokao.']],
  ['housewife', 'n.', '家庭主妇', '985', ['家庭主妇'], ['家庭主妇'], ['housewife is a key word in gaokao.']],
  ['humour', 'n.', '幽默，诙谐v.迁就?', '985', ['幽默，诙谐v.迁就?'], ['幽默，诙谐v.迁就?'], ['humour is a key word in gaokao.']],
  ['hunger', 'n.', '饥饿,渴望', '985', ['饥饿,渴望'], ['饥饿,渴望'], ['hunger is a key word in gaokao.']],
  ['hunt', 'n.', 'vt.打猎,搜寻', '985', ['vt.打猎,搜寻'], ['vt.打猎,搜寻'], ['hunt is a key word in gaokao.']],
  ['identity', 'n.', '身份,一致vt.确定身份', '985', ['身份,一致vt.确定'], ['身份,一致vt.确定身份'], ['identity is a key word in gaokao.']],
  ['ignore', 'vt.', '不理睬,忽视', '985', ['不理睬,忽视'], ['不理睬,忽视'], ['ignore is a key word in gaokao.']],
  ['illegal', 'adj.', '非法的', '985', ['非法的'], ['非法的'], ['illegal is a key word in gaokao.']],
  ['immediate', 'adj.', '立即的,直接的', '985', ['立即的,直接的'], ['立即的,直接的'], ['immediate is a key word in gaokao.']],
  ['immigrate', 'v.', '移民', '985', ['移民'], ['移民'], ['immigrate is a key word in gaokao.']],
  ['import', 'vt.', 'n.输入,进口', '985', ['n.输入,进口'], ['n.输入,进口'], ['import is a key word in gaokao.']],
  ['importance', 'n.', '重要性', '985', ['重要性'], ['重要性'], ['importance is a key word in gaokao.']],
  ['impress', 'vt.', '给…深刻印象', '985', ['给…深刻印象'], ['给…深刻印象'], ['impress is a key word in gaokao.']],
  ['income', 'n.', '收入,收益', '985', ['收入,收益'], ['收入,收益'], ['income is a key word in gaokao.']],
  ['indeed', 'adv.', '真正地,确实', '985', ['真正地,确实'], ['真正地,确实'], ['indeed is a key word in gaokao.']],
  ['independent', 'adj.', '独立的,自主的', '985', ['独立的,自主的'], ['独立的,自主的'], ['independent is a key word in gaokao.']],
  ['indicate', 'vt.', '暗示,表明', '985', ['暗示,表明'], ['暗示,表明'], ['indicate is a key word in gaokao.']],
  ['infer', 'vt.', '推论,推断', '985', ['推论,推断'], ['推论,推断'], ['infer is a key word in gaokao.']],
  ['inform', 'vt.', '通知,告知', '985', ['通知,告知'], ['通知,告知'], ['inform is a key word in gaokao.']],
  ['innocent', 'adj.', '清白的,无辜的，天真的', '985', ['清白的,无辜的，天真'], ['清白的,无辜的，天真的'], ['innocent is a key word in gaokao.']],
  ['insect', 'n.', '昆虫', '985', ['昆虫'], ['昆虫'], ['insect is a key word in gaokao.']],
  ['insert', 'vt.', '插入,嵌入', '985', ['插入,嵌入'], ['插入,嵌入'], ['insert is a key word in gaokao.']],
  ['inspire', 'vt.', '鼓舞,给…以灵感', '985', ['鼓舞,给…以灵感'], ['鼓舞,给…以灵感'], ['inspire is a key word in gaokao.']],
  ['instant', 'n.', '瞬间a.立即的', '985', ['瞬间a.立即的'], ['瞬间a.立即的'], ['instant is a key word in gaokao.']],
  ['institute', 'n.', '研究所,学院', '985', ['研究所,学院'], ['研究所,学院'], ['institute is a key word in gaokao.']],
  ['instrument', 'n.', '工具,乐器', '985', ['工具,乐器'], ['工具,乐器'], ['instrument is a key word in gaokao.']],
  ['insurance', 'n.', '保险,保险费', '985', ['保险,保险费'], ['保险,保险费'], ['insurance is a key word in gaokao.']],
  ['intelligence', 'n.', '智力,理解力,情报工作，情报机关', '985', ['智力,理解力,情报工'], ['智力,理解力,情报工作，情报机关'], ['intelligence is a key word in gaokao.']],
  ['intend', 'vt.', '想要,打算,意指', '985', ['想要,打算,意指'], ['想要,打算,意指'], ['intend is a key word in gaokao.']],
  ['interpret', 'vt.', '说明,口译，解释', '985', ['说明,口译，解释'], ['说明,口译，解释'], ['interpret is a key word in gaokao.']],
  ['interpreter', 'n.', '解释者，口译者，注释器', '985', ['解释者，口译者，注释'], ['解释者，口译者，注释器'], ['interpreter is a key word in gaokao.']],
  ['interrupt', 'vt.', '打断,中止', '985', ['打断,中止'], ['打断,中止'], ['interrupt is a key word in gaokao.']],
  ['jam', 'n.', '果酱，拥挤，困境', '985', ['果酱，拥挤，困境'], ['果酱，拥挤，困境'], ['jam is a key word in gaokao.']],
  ['jar', 'n.', '罐子,坛子,广口瓶', '985', ['罐子,坛子,广口瓶'], ['罐子,坛子,广口瓶'], ['jar is a key word in gaokao.']],
  ['jazz', 'n.', '爵士音乐,爵士舞曲', '985', ['爵士音乐,爵士舞曲'], ['爵士音乐,爵士舞曲'], ['jazz is a key word in gaokao.']],
  ['journalist', 'n.', '记者,新闻工作者', '985', ['记者,新闻工作者'], ['记者,新闻工作者'], ['journalist is a key word in gaokao.']],
  ['journey', 'n.', '旅行,旅程', '985', ['旅行,旅程'], ['旅行,旅程'], ['journey is a key word in gaokao.']],
  ['judge', 'n.', '法官,裁判员v.审判，判断', '985', ['法官,裁判员v.审判'], ['法官,裁判员v.审判，判断'], ['judge is a key word in gaokao.']],
  ['jungle', 'n.', '丛林,密林', '985', ['丛林,密林'], ['丛林,密林'], ['jungle is a key word in gaokao.']],
  ['junior', 'adj.', '年少的,下级的n.年少者，晚辈，地位较低者', '985', ['年少的,下级的n.年'], ['年少的,下级的n.年少者，晚辈，地位较低者'], ['junior is a key word in gaokao.']],
  ['justice', 'n.', '正义,公正,司法', '985', ['正义,公正,司法'], ['正义,公正,司法'], ['justice is a key word in gaokao.']],
  ['kindergarten', 'n.', '幼儿园', '985', ['幼儿园'], ['幼儿园'], ['kindergarten is a key word in gaokao.']],
  ['lack', 'vt.', '缺乏,不足n.短缺的东西', '985', ['缺乏,不足n.短缺的'], ['缺乏,不足n.短缺的东西'], ['lack is a key word in gaokao.']],
  ['ladder', 'n.', '梯子', '985', ['梯子'], ['梯子'], ['ladder is a key word in gaokao.']],
  ['lately', 'adv.', '最近', '985', ['最近'], ['最近'], ['lately is a key word in gaokao.']],
  ['later', 'adv.', '后来', '985', ['后来'], ['后来'], ['later is a key word in gaokao.']],
  ['latter', 'adj.', '(两者中)后者的', '985', ['(两者中)后者的'], ['(两者中)后者的'], ['latter is a key word in gaokao.']],
  ['lawyer', 'n.', '律师', '985', ['律师'], ['律师'], ['lawyer is a key word in gaokao.']],
  ['league', 'n.', '同盟,联盟', '985', ['同盟,联盟'], ['同盟,联盟'], ['league is a key word in gaokao.']],
  ['leak', 'vi.', '漏;泄露n.漏洞', '985', ['漏;泄露n.漏洞'], ['漏;泄露n.漏洞'], ['leak is a key word in gaokao.']],
  ['lecture', 'vi.', '演讲;讲课n.演讲;讲课', '985', ['演讲;讲课n.演讲;'], ['演讲;讲课n.演讲;讲课'], ['lecture is a key word in gaokao.']],
  ['legal', 'adj.', '合法的', '985', ['合法的'], ['合法的'], ['legal is a key word in gaokao.']],
  ['length', 'n.', '长度', '985', ['长度'], ['长度'], ['length is a key word in gaokao.']],
  ['less', 'adj.', '更少的ad.更少地', '985', ['更少的ad.更少地'], ['更少的ad.更少地'], ['less is a key word in gaokao.']],
  ['liberate', 'vt.', '解放,释放', '985', ['解放,释放'], ['解放,释放'], ['liberate is a key word in gaokao.']],
  ['librarian', 'n.', '图书馆馆员', '985', ['图书馆馆员'], ['图书馆馆员'], ['librarian is a key word in gaokao.']],
  ['lifetime', 'n.', '终身', '985', ['终身'], ['终身'], ['lifetime is a key word in gaokao.']],
  ['lightning', 'n.', '闪电', '985', ['闪电'], ['闪电'], ['lightning is a key word in gaokao.']],
  ['likely', 'adj.', '可能的ad.很可能', '985', ['可能的ad.很可能'], ['可能的ad.很可能'], ['likely is a key word in gaokao.']],
  ['limit', 'vt.', '限制,限定n.限度,限制', '985', ['限制,限定n.限度,'], ['限制,限定n.限度,限制'], ['limit is a key word in gaokao.']],
  ['link', 'vt.', '连接，联系n.联系', '985', ['连接，联系n.联系'], ['连接，联系n.联系'], ['link is a key word in gaokao.']],
  ['lip', 'n.', '嘴唇', '985', ['嘴唇'], ['嘴唇'], ['lip is a key word in gaokao.']],
  ['liquid', 'n.', '液体a.液体的,流动的', '985', ['液体a.液体的,流动'], ['液体a.液体的,流动的'], ['liquid is a key word in gaokao.']],
  ['literature', 'n.', '文学(作品)', '985', ['文学(作品)'], ['文学(作品)'], ['literature is a key word in gaokao.']],
  ['litre', 'n.', '公升', '985', ['公升'], ['公升'], ['litre is a key word in gaokao.']],
  ['living-room', 'n.', '起居室', '985', ['起居室'], ['起居室'], ['living-room is a key word in gaokao.']],
  ['load', 'vt.', '装,装满n.负载;负担', '985', ['装,装满n.负载;负'], ['装,装满n.负载;负担'], ['load is a key word in gaokao.']],
  ['loaf', 'n.', '一条面包', '985', ['一条面包'], ['一条面包'], ['loaf is a key word in gaokao.']],
  ['local', 'adj.', '当地的，局部的n.当地居民，局部', '985', ['当地的，局部的n.当'], ['当地的，局部的n.当地居民，局部'], ['local is a key word in gaokao.']],
  ['loose', 'adj.', '宽松的;自由的', '985', ['宽松的;自由的'], ['宽松的;自由的'], ['loose is a key word in gaokao.']],
  ['lorry', 'n.', '卡车', '985', ['卡车'], ['卡车'], ['lorry is a key word in gaokao.']],
  ['loss', 'n.', '遗失;失败，损失', '985', ['遗失;失败，损失'], ['遗失;失败，损失'], ['loss is a key word in gaokao.']],
  ['luggage', 'n.', '行李,皮箱', '985', ['行李,皮箱'], ['行李,皮箱'], ['luggage is a key word in gaokao.']],
  ['lung', 'n.', '肺', '985', ['肺'], ['肺'], ['lung is a key word in gaokao.']],
  ['mailbox', 'n.', '邮箱', '985', ['邮箱'], ['邮箱'], ['mailbox is a key word in gaokao.']],
  ['major', 'vi.', '主修，专攻a.主要的,多数的，主要的n.主修', '985', ['主修，专攻a.主要的'], ['主修，专攻a.主要的,多数的，主要的n.主修'], ['major is a key word in gaokao.']],
  ['majority', 'n.', '多数', '985', ['多数'], ['多数'], ['majority is a key word in gaokao.']],
  ['male', 'adj.', '男的,雄的n.男人，雄性动物', '985', ['男的,雄的n.男人，'], ['男的,雄的n.男人，雄性动物'], ['male is a key word in gaokao.']],
  ['mankind', 'n.', '人类', '985', ['人类'], ['人类'], ['mankind is a key word in gaokao.']],
  ['manner', 'n.', '方式,态度;礼貌', '985', ['方式,态度;礼貌'], ['方式,态度;礼貌'], ['manner is a key word in gaokao.']],
  ['march', 'n.', '三月', '985', ['三月'], ['三月'], ['march is a key word in gaokao.']],
  ['mass', 'n.', '大量，群众，块，团', '985', ['大量，群众，块，团'], ['大量，群众，块，团'], ['mass is a key word in gaokao.']],
  ['material', 'n.', '材料,原料;素材a.物质的', '985', ['材料,原料;素材a.'], ['材料,原料;素材a.物质的'], ['material is a key word in gaokao.']],
  ['mathematics', 'n.', '数学', '985', ['数学'], ['数学'], ['mathematics is a key word in gaokao.']],
  ['matter', 'n.', '事情;物质vi.要紧，有关系', '985', ['事情;物质vi.要紧'], ['事情;物质vi.要紧，有关系'], ['matter is a key word in gaokao.']],
  ['maximum', 'n.', '最大量a.最大的', '985', ['最大量a.最大的'], ['最大量a.最大的'], ['maximum is a key word in gaokao.']],
  ['means', 'n.', '方法,手段', '985', ['方法,手段'], ['方法,手段'], ['means is a key word in gaokao.']],
  ['meanwhile', 'adv.', '与此同时', '985', ['与此同时'], ['与此同时'], ['meanwhile is a key word in gaokao.']],
  ['measure', 'vt.', '测量n.测量，尺寸，措施，程度', '985', ['测量n.测量，尺寸，'], ['测量n.测量，尺寸，措施，程度'], ['measure is a key word in gaokao.']],
  ['medal', 'n.', '奖章,纪念章', '985', ['奖章,纪念章'], ['奖章,纪念章'], ['medal is a key word in gaokao.']],
  ['media', 'n.', '媒体', '985', ['媒体'], ['媒体'], ['media is a key word in gaokao.']],
  ['mental', 'adj.', '智力的;精神的', '985', ['智力的;精神的'], ['智力的;精神的'], ['mental is a key word in gaokao.']],
  ['menu', 'n.', '菜单', '985', ['菜单'], ['菜单'], ['menu is a key word in gaokao.']],
  ['merchant', 'n.', '商人', '985', ['商人'], ['商人'], ['merchant is a key word in gaokao.']],
  ['mercy', 'n.', '仁慈', '985', ['仁慈'], ['仁慈'], ['mercy is a key word in gaokao.']],
  ['merely', 'adv.', '仅仅,只不过', '985', ['仅仅,只不过'], ['仅仅,只不过'], ['merely is a key word in gaokao.']],
  ['merry', 'adj.', '欢乐的,愉快的', '985', ['欢乐的,愉快的'], ['欢乐的,愉快的'], ['merry is a key word in gaokao.']],
  ['midday', 'n.', '中午', '985', ['中午'], ['中午'], ['midday is a key word in gaokao.']],
  ['midnight', 'n.', '午夜', '985', ['午夜'], ['午夜'], ['midnight is a key word in gaokao.']],
  ['mild', 'adj.', '温和的，文雅的', '985', ['温和的，文雅的'], ['温和的，文雅的'], ['mild is a key word in gaokao.']],
  ['million', '待标注', 'num.百万', '985', ['num.百万'], ['num.百万'], ['million is a key word in gaokao.']],
  ['mine', 'pron.', '我的n.矿，矿山;地雷，水雷vt.开采', '985', ['我的n.矿，矿山;地'], ['我的n.矿，矿山;地雷，水雷vt.开采'], ['mine is a key word in gaokao.']],
  ['mineral', 'n.', '矿物a.矿物的', '985', ['矿物a.矿物的'], ['矿物a.矿物的'], ['mineral is a key word in gaokao.']],
  ['minimum', 'n.', '最小量a.最小的', '985', ['最小量a.最小的'], ['最小量a.最小的'], ['minimum is a key word in gaokao.']],
  ['minister', 'n.', '部长,大臣', '985', ['部长,大臣'], ['部长,大臣'], ['minister is a key word in gaokao.']],
  ['minority', 'n.', '少数派;少数民族', '985', ['少数派;少数民族'], ['少数派;少数民族'], ['minority is a key word in gaokao.']],
  ['miserable', 'adj.', '痛苦的,悲惨的', '985', ['痛苦的,悲惨的'], ['痛苦的,悲惨的'], ['miserable is a key word in gaokao.']],
  ['misunderstand', 'vt.', '误解,误会', '985', ['误解,误会'], ['误解,误会'], ['misunderstand is a key word in gaokao.']],
  ['mix', 'vt.', '使混合;混淆', '985', ['使混合;混淆'], ['使混合;混淆'], ['mix is a key word in gaokao.']],
  ['mobile', 'adj.', '运动的,移动的', '985', ['运动的,移动的'], ['运动的,移动的'], ['mobile is a key word in gaokao.']],
  ['modest', 'adj.', '谦虚的', '985', ['谦虚的'], ['谦虚的'], ['modest is a key word in gaokao.']],
  ['moral', 'adj.', '合乎道德的n.道德,品行', '985', ['合乎道德的n.道德,'], ['合乎道德的n.道德,品行'], ['moral is a key word in gaokao.']],
  ['motor', 'n.', '发动机,机动车', '985', ['发动机,机动车'], ['发动机,机动车'], ['motor is a key word in gaokao.']],
  ['mountainous', 'adj.', '多山的', '985', ['多山的'], ['多山的'], ['mountainous is a key word in gaokao.']],
  ['mourn', 'vi.', '哀痛,哀悼', '985', ['哀痛,哀悼'], ['哀痛,哀悼'], ['mourn is a key word in gaokao.']],
  ['movement', 'n.', '动作;活动;移动', '985', ['动作;活动;移动'], ['动作;活动;移动'], ['movement is a key word in gaokao.']],
  ['multiply', 'vt.', '增加，繁殖，乘', '985', ['增加，繁殖，乘'], ['增加，繁殖，乘'], ['multiply is a key word in gaokao.']],
  ['musical', 'adj.', '音乐的', '985', ['音乐的'], ['音乐的'], ['musical is a key word in gaokao.']],
  ['nail', 'n.', '钉子;指甲vt.钉', '985', ['钉子;指甲vt.钉'], ['钉子;指甲vt.钉'], ['nail is a key word in gaokao.']],
  ['nation', 'n.', '民族,国家', '985', ['民族,国家'], ['民族,国家'], ['nation is a key word in gaokao.']],
  ['nationality', 'n.', '国籍，民族', '985', ['国籍，民族'], ['国籍，民族'], ['nationality is a key word in gaokao.']],
  ['native', 'adj.', '本土的n.本地人', '985', ['本土的n.本地人'], ['本土的n.本地人'], ['native is a key word in gaokao.']],
  ['navy', 'n.', '海军', '985', ['海军'], ['海军'], ['navy is a key word in gaokao.']],
  ['neat', 'adj.', '整洁的;简洁的', '985', ['整洁的;简洁的'], ['整洁的;简洁的'], ['neat is a key word in gaokao.']],
  ['needle', 'n.', '针vt.缝补,编织', '985', ['针vt.缝补,编织'], ['针vt.缝补,编织'], ['needle is a key word in gaokao.']],
  ['nephew', 'n.', '侄子,外甥', '985', ['侄子,外甥'], ['侄子,外甥'], ['nephew is a key word in gaokao.']],
  ['nest', 'n.', '巢,窝', '985', ['巢,窝'], ['巢,窝'], ['nest is a key word in gaokao.']],
  ['niece', 'n.', '侄女,外甥女', '985', ['侄女,外甥女'], ['侄女,外甥女'], ['niece is a key word in gaokao.']],
  ['noble', 'adj.', '高尚的n.贵族', '985', ['高尚的n.贵族'], ['高尚的n.贵族'], ['noble is a key word in gaokao.']],
  ['noisy', 'adj.', '嘈杂的,喧闹的', '985', ['嘈杂的,喧闹的'], ['嘈杂的,喧闹的'], ['noisy is a key word in gaokao.']],
  ['novel', 'n.', '小说a.新奇的，新颖的', '985', ['小说a.新奇的，新颖'], ['小说a.新奇的，新颖的'], ['novel is a key word in gaokao.']],
  ['nowadays', 'adv.', '现今,现在n.现今，当今', '985', ['现今,现在n.现今，'], ['现今,现在n.现今，当今'], ['nowadays is a key word in gaokao.']],
  ['nowhere', 'adv.', '任何地方都不', '985', ['任何地方都不'], ['任何地方都不'], ['nowhere is a key word in gaokao.']],
  ['nuclear', 'adj.', '原子核的;核心的', '985', ['原子核的;核心的'], ['原子核的;核心的'], ['nuclear is a key word in gaokao.']],
  ['nut', 'n.', '坚果', '985', ['坚果'], ['坚果'], ['nut is a key word in gaokao.']],
  ['nutrition', 'n.', '营养', '985', ['营养'], ['营养'], ['nutrition is a key word in gaokao.']],
  ['obey', 'vt.', '顺从vi.服从', '985', ['顺从vi.服从'], ['顺从vi.服从'], ['obey is a key word in gaokao.']],
  ['observe', 'vt.', '观察,遵守', '985', ['观察,遵守'], ['观察,遵守'], ['observe is a key word in gaokao.']],
  ['obtain', 'vt.', '获得', '985', ['获得'], ['获得'], ['obtain is a key word in gaokao.']],
  ['obvious', 'adj.', '显而易见的', '985', ['显而易见的'], ['显而易见的'], ['obvious is a key word in gaokao.']],
  ['occupation', 'n.', '占领,占据;职业，工作', '985', ['占领,占据;职业，工'], ['占领,占据;职业，工作'], ['occupation is a key word in gaokao.']],
  ['occupy', 'vt.', '占领,占有;使忙碌', '985', ['占领,占有;使忙碌'], ['占领,占有;使忙碌'], ['occupy is a key word in gaokao.']],
  ['occur', 'vi.', '发生，突然想起', '985', ['发生，突然想起'], ['发生，突然想起'], ['occur is a key word in gaokao.']],
  ['official', 'adj.', '官方的，正式的n.官员，行政人员', '985', ['官方的，正式的n.官'], ['官方的，正式的n.官员，行政人员'], ['official is a key word in gaokao.']],
  ['onto', 'prep.', '到…上', '985', ['到…上'], ['到…上'], ['onto is a key word in gaokao.']],
  ['opera', 'n.', '歌剧，歌剧团，歌剧院', '985', ['歌剧，歌剧团，歌剧院'], ['歌剧，歌剧团，歌剧院'], ['opera is a key word in gaokao.']],
  ['operate', 'vi.', '操作;施行手术', '985', ['操作;施行手术'], ['操作;施行手术'], ['operate is a key word in gaokao.']],
  ['opinion', 'n.', '意见,看法', '985', ['意见,看法'], ['意见,看法'], ['opinion is a key word in gaokao.']],
  ['oppose', 'vt.', '反对,反抗', '985', ['反对,反抗'], ['反对,反抗'], ['oppose is a key word in gaokao.']],
  ['opposite', 'adj.', '对面的，相反的，对立的n.对立面，反义词', '985', ['对面的，相反的，对立'], ['对面的，相反的，对立的n.对立面，反义词'], ['opposite is a key word in gaokao.']],
  ['optimistic', 'adj.', '乐观的', '985', ['乐观的'], ['乐观的'], ['optimistic is a key word in gaokao.']],
  ['oral', 'adj.', '口头的', '985', ['口头的'], ['口头的'], ['oral is a key word in gaokao.']],
  ['orbit', 'n.', '运行轨道vt.环绕', '985', ['运行轨道vt.环绕'], ['运行轨道vt.环绕'], ['orbit is a key word in gaokao.']],
  ['ordinary', 'adj.', '普通的,平凡的', '985', ['普通的,平凡的'], ['普通的,平凡的'], ['ordinary is a key word in gaokao.']],
  ['organize', 'vt.', '组织，安排;筹办', '985', ['组织，安排;筹办'], ['组织，安排;筹办'], ['organize is a key word in gaokao.']],
  ['original', 'adj.', '最初的;新颖的n.创新', '985', ['最初的;新颖的n.创'], ['最初的;新颖的n.创新'], ['original is a key word in gaokao.']],
  ['otherwise', 'adv.', '另外,要不然', '985', ['另外,要不然'], ['另外,要不然'], ['otherwise is a key word in gaokao.']],
  ['ought', '待标注', 'aux.应该', '985', ['aux.应该'], ['aux.应该'], ['ought is a key word in gaokao.']],
  ['outdoor', 'adj.', '/ad.户外的，野外的', '985', ['/ad.户外的，野外'], ['/ad.户外的，野外的'], ['outdoor is a key word in gaokao.']],
  ['outdoors', 'adv.', '在户外n.户外', '985', ['在户外n.户外'], ['在户外n.户外'], ['outdoors is a key word in gaokao.']],
  ['outer', 'adj.', '外部的,外面的', '985', ['外部的,外面的'], ['外部的,外面的'], ['outer is a key word in gaokao.']],
  ['outline', 'n.', '轮廓;大纲', '985', ['轮廓;大纲'], ['轮廓;大纲'], ['outline is a key word in gaokao.']],
  ['outstanding', 'adj.', '突出的,杰出的', '985', ['突出的,杰出的'], ['突出的,杰出的'], ['outstanding is a key word in gaokao.']],
  ['overcome', 'vt.', '战胜,克服', '985', ['战胜,克服'], ['战胜,克服'], ['overcome is a key word in gaokao.']],
  ['owe', 'vt.', '欠，归功于', '985', ['欠，归功于'], ['欠，归功于'], ['owe is a key word in gaokao.']],
  ['ox', 'n.', '公牛', '985', ['公牛'], ['公牛'], ['ox is a key word in gaokao.']],
  ['oxygen', 'n.', '氧，氧气', '985', ['氧，氧气'], ['氧，氧气'], ['oxygen is a key word in gaokao.']],
  ['pack', 'vt.', '捆扎，打包;挤满n.包裹，背包', '985', ['捆扎，打包;挤满n.'], ['捆扎，打包;挤满n.包裹，背包'], ['pack is a key word in gaokao.']],
  ['packet', 'n.', '小包，口袋', '985', ['小包，口袋'], ['小包，口袋'], ['packet is a key word in gaokao.']],
  ['pain', 'n.', '痛苦，疼痛，努力', '985', ['痛苦，疼痛，努力'], ['痛苦，疼痛，努力'], ['pain is a key word in gaokao.']],
  ['painful', 'adj.', '痛苦的', '985', ['痛苦的'], ['痛苦的'], ['painful is a key word in gaokao.']],
  ['painting', 'n.', '油画;绘画', '985', ['油画;绘画'], ['油画;绘画'], ['painting is a key word in gaokao.']],
  ['pan', 'n.', '平底锅', '985', ['平底锅'], ['平底锅'], ['pan is a key word in gaokao.']],
  ['panic', 'n.', '恐慌,惊慌', '985', ['恐慌,惊慌'], ['恐慌,惊慌'], ['panic is a key word in gaokao.']],
  ['paragraph', 'n.', '(文章的)段,节', '985', ['(文章的)段,节'], ['(文章的)段,节'], ['paragraph is a key word in gaokao.']],
  ['parcel', 'n.', '包裹,邮包', '985', ['包裹,邮包'], ['包裹,邮包'], ['parcel is a key word in gaokao.']],
  ['parrot', 'n.', '鹦鹉', '985', ['鹦鹉'], ['鹦鹉'], ['parrot is a key word in gaokao.']],
  ['participate', 'vi.', '参与,参加', '985', ['参与,参加'], ['参与,参加'], ['participate is a key word in gaokao.']],
  ['particular', 'adj.', '特殊的,特定的', '985', ['特殊的,特定的'], ['特殊的,特定的'], ['particular is a key word in gaokao.']],
  ['partly', 'adv.', '部分地', '985', ['部分地'], ['部分地'], ['partly is a key word in gaokao.']],
  ['partner', 'n.', '伙伴,搭挡，合伙人;配偶', '985', ['伙伴,搭挡，合伙人;'], ['伙伴,搭挡，合伙人;配偶'], ['partner is a key word in gaokao.']],
  ['passer-by', 'n.', '过路人', '985', ['过路人'], ['过路人'], ['passer-by is a key word in gaokao.']],
  ['passive', 'adj.', '被动的,消极的', '985', ['被动的,消极的'], ['被动的,消极的'], ['passive is a key word in gaokao.']],
  ['pattern', 'n.', '式样,模型，图案', '985', ['式样,模型，图案'], ['式样,模型，图案'], ['pattern is a key word in gaokao.']],
  ['pause', 'n.', '中止vi.中止,暂停', '985', ['中止vi.中止,暂停'], ['中止vi.中止,暂停'], ['pause is a key word in gaokao.']],
  ['peaceful', 'adj.', '和平的;平静的', '985', ['和平的;平静的'], ['和平的;平静的'], ['peaceful is a key word in gaokao.']],
  ['pence', 'n.', '便士；penny的复数', '985', ['便士；penny的复数'], ['便士；penny的复数'], ['pence is a key word in gaokao.']],
  ['per', 'prep.', '每，每一', '985', ['每，每一'], ['每，每一'], ['per is a key word in gaokao.']],
  ['perform', 'vt.', '执行，表演，表现', '985', ['执行，表演，表现'], ['执行，表演，表现'], ['perform is a key word in gaokao.']],
  ['performance', 'n.', '履行;表演;表现', '985', ['履行;表演;表现'], ['履行;表演;表现'], ['performance is a key word in gaokao.']],
  ['permit', 'vt.', '允许n.执照，许可证', '985', ['允许n.执照，许可证'], ['允许n.执照，许可证'], ['permit is a key word in gaokao.']],
  ['persuade', 'vt.', '说服', '985', ['说服'], ['说服'], ['persuade is a key word in gaokao.']],
  ['petrol', 'n.', '汽油', '985', ['汽油'], ['汽油'], ['petrol is a key word in gaokao.']],
  ['phenomenon', 'n.', '现象', '985', ['现象'], ['现象'], ['phenomenon is a key word in gaokao.']],
  ['phrase', 'n.', '短语,习惯用语', '985', ['短语,习惯用语'], ['短语,习惯用语'], ['phrase is a key word in gaokao.']],
  ['pile', 'n.', '堆vt.堆积', '985', ['堆vt.堆积'], ['堆vt.堆积'], ['pile is a key word in gaokao.']],
  ['pill', 'n.', '药丸', '985', ['药丸'], ['药丸'], ['pill is a key word in gaokao.']],
  ['pillow', 'n.', '枕头', '985', ['枕头'], ['枕头'], ['pillow is a key word in gaokao.']],
  ['pin', 'n.', '别针，钉子vt.钉住', '985', ['别针，钉子vt.钉住'], ['别针，钉子vt.钉住'], ['pin is a key word in gaokao.']],
  ['pipe', 'vt.', '用管道输送n.管子,导管;烟斗', '985', ['用管道输送n.管子,'], ['用管道输送n.管子,导管;烟斗'], ['pipe is a key word in gaokao.']],
  ['platform', 'n.', '站台,讲台，平台', '985', ['站台,讲台，平台'], ['站台,讲台，平台'], ['platform is a key word in gaokao.']],
  ['player', 'n.', '表演者,运动员，比赛者，游戏者', '985', ['表演者,运动员，比赛'], ['表演者,运动员，比赛者，游戏者'], ['player is a key word in gaokao.']],
  ['playmate', 'n.', '玩伴,游伴', '985', ['玩伴,游伴'], ['玩伴,游伴'], ['playmate is a key word in gaokao.']],
  ['pleased', 'adj.', '高兴的', '985', ['高兴的'], ['高兴的'], ['pleased is a key word in gaokao.']],
  ['plough', 'n.', '犁vt.犁,耕', '985', ['犁vt.犁,耕'], ['犁vt.犁,耕'], ['plough is a key word in gaokao.']],
  ['poet', 'n.', '诗人', '985', ['诗人'], ['诗人'], ['poet is a key word in gaokao.']],
  ['poison', 'n.', '毒药vt.毒害;投毒', '985', ['毒药vt.毒害;投毒'], ['毒药vt.毒害;投毒'], ['poison is a key word in gaokao.']],
  ['pole', 'n.', '杆,柱', '985', ['杆,柱'], ['杆,柱'], ['pole is a key word in gaokao.']],
  ['policy', 'n.', '政策,方针', '985', ['政策,方针'], ['政策,方针'], ['policy is a key word in gaokao.']],
  ['political', 'adj.', '政治上的', '985', ['政治上的'], ['政治上的'], ['political is a key word in gaokao.']],
  ['politics', 'n.', '政治', '985', ['政治'], ['政治'], ['politics is a key word in gaokao.']],
  ['pollution', 'n.', '污染', '985', ['污染'], ['污染'], ['pollution is a key word in gaokao.']],
  ['port', 'n.', '港口', '985', ['港口'], ['港口'], ['port is a key word in gaokao.']],
  ['positive', 'adj.', '积极的，肯定的，阳性的', '985', ['积极的，肯定的，阳性'], ['积极的，肯定的，阳性的'], ['positive is a key word in gaokao.']],
  ['possession', 'n.', '拥有，财产', '985', ['拥有，财产'], ['拥有，财产'], ['possession is a key word in gaokao.']],
  ['possibly', 'adv.', '可能地,也许', '985', ['可能地,也许'], ['可能地,也许'], ['possibly is a key word in gaokao.']],
  ['postcode', 'n.', '邮递区号', '985', ['邮递区号'], ['邮递区号'], ['postcode is a key word in gaokao.']],
  ['pot', 'n.', '锅，壶，罐', '985', ['锅，壶，罐'], ['锅，壶，罐'], ['pot is a key word in gaokao.']],
  ['potential', 'adj.', '潜在的n.潜能', '985', ['潜在的n.潜能'], ['潜在的n.潜能'], ['potential is a key word in gaokao.']],
  ['pour', 'vt.', '倾泻，倒，灌，注，倾吐vi.倾泻，流出，骤雨', '985', ['倾泻，倒，灌，注，倾'], ['倾泻，倒，灌，注，倾吐vi.倾泻，流出，骤雨'], ['pour is a key word in gaokao.']],
  ['powder', 'n.', '粉，粉末，火药', '985', ['粉，粉末，火药'], ['粉，粉末，火药'], ['powder is a key word in gaokao.']],
  ['power', 'n.', '能力，电力;权力', '985', ['能力，电力;权力'], ['能力，电力;权力'], ['power is a key word in gaokao.']],
  ['powerful', 'adj.', '强有力的', '985', ['强有力的'], ['强有力的'], ['powerful is a key word in gaokao.']],
  ['practical', 'adj.', '实际的，实用性的', '985', ['实际的，实用性的'], ['实际的，实用性的'], ['practical is a key word in gaokao.']],
  ['pray', 'vt.', '请求;祈祷', '985', ['请求;祈祷'], ['请求;祈祷'], ['pray is a key word in gaokao.']],
  ['precious', 'adj.', '珍贵的,宝贵的', '985', ['珍贵的,宝贵的'], ['珍贵的,宝贵的'], ['precious is a key word in gaokao.']],
  ['predict', 'vt.', '预言,预测', '985', ['预言,预测'], ['预言,预测'], ['predict is a key word in gaokao.']],
  ['prefer', 'vt.', '更喜欢，宁愿', '985', ['更喜欢，宁愿'], ['更喜欢，宁愿'], ['prefer is a key word in gaokao.']],
  ['press', 'vi.', '压,按vt.压;压榨n.印刷;新闻，报刊;出版社', '985', ['压,按vt.压;压榨'], ['压,按vt.压;压榨n.印刷;新闻，报刊;出版社'], ['press is a key word in gaokao.']],
  ['pretend', 'vt.', '假装，装作vi.假装', '985', ['假装，装作vi.假装'], ['假装，装作vi.假装'], ['pretend is a key word in gaokao.']],
  ['principle', 'n.', '原则,原理', '985', ['原则,原理'], ['原则,原理'], ['principle is a key word in gaokao.']],
  ['process', 'n.', '过程vt.处理', '985', ['过程vt.处理'], ['过程vt.处理'], ['process is a key word in gaokao.']],
  ['production', 'n.', '生产，产品，成果，作品', '985', ['生产，产品，成果，作'], ['生产，产品，成果，作品'], ['production is a key word in gaokao.']],
  ['profession', 'n.', '职业，专业', '985', ['职业，专业'], ['职业，专业'], ['profession is a key word in gaokao.']],
  ['professor', 'n.', '教授', '985', ['教授'], ['教授'], ['professor is a key word in gaokao.']],
  ['profit', 'n.', '利润vi.得益', '985', ['利润vi.得益'], ['利润vi.得益'], ['profit is a key word in gaokao.']],
  ['project', 'n.', '计划;工程;项目vt.设计，规划', '985', ['计划;工程;项目vt'], ['计划;工程;项目vt.设计，规划'], ['project is a key word in gaokao.']],
  ['promote', 'vt.', '促进,提升;推销', '985', ['促进,提升;推销'], ['促进,提升;推销'], ['promote is a key word in gaokao.']],
  ['province', 'n.', '省', '985', ['省'], ['省'], ['province is a key word in gaokao.']],
  ['publish', 'vt.', '公布,发表;出版，刊印', '985', ['公布,发表;出版，刊'], ['公布,发表;出版，刊印'], ['publish is a key word in gaokao.']],
  ['pump', 'n.', '泵vt.用泵抽，打气', '985', ['泵vt.用泵抽，打气'], ['泵vt.用泵抽，打气'], ['pump is a key word in gaokao.']],
  ['punishment', 'n.', '惩罚', '985', ['惩罚'], ['惩罚'], ['punishment is a key word in gaokao.']],
  ['purchase', 'vt.', '购买n.购买;赃物', '985', ['购买n.购买;赃物'], ['购买n.购买;赃物'], ['purchase is a key word in gaokao.']],
  ['pure', 'adj.', '纯洁的', '985', ['纯洁的'], ['纯洁的'], ['pure is a key word in gaokao.']],
  ['puzzle', 'n.', '难题;谜vi.使迷惑', '985', ['难题;谜vi.使迷惑'], ['难题;谜vi.使迷惑'], ['puzzle is a key word in gaokao.']],
  ['quality', 'n.', '质量，品质，特性', '985', ['质量，品质，特性'], ['质量，品质，特性'], ['quality is a key word in gaokao.']],
  ['quantity', 'n.', '数量，大量', '985', ['数量，大量'], ['数量，大量'], ['quantity is a key word in gaokao.']],
  ['quarrel', 'vi.', '争吵n.争吵,吵架', '985', ['争吵n.争吵,吵架'], ['争吵n.争吵,吵架'], ['quarrel is a key word in gaokao.']],
  ['queue', 'n.', '队列vi.排队，将…梳成辫子', '985', ['队列vi.排队，将…'], ['队列vi.排队，将…梳成辫子'], ['queue is a key word in gaokao.']],
  ['quit', 'vt.', '离开,停止;辞职', '985', ['离开,停止;辞职'], ['离开,停止;辞职'], ['quit is a key word in gaokao.']],
  ['range', 'vi.', '变动，变化n.范围，幅度，', '985', ['变动，变化n.范围，'], ['变动，变化n.范围，幅度，'], ['range is a key word in gaokao.']],
  ['rank', 'n.', '等级，军衔，队列vt.排列，把…分等', '985', ['等级，军衔，队列vt'], ['等级，军衔，队列vt.排列，把…分等'], ['rank is a key word in gaokao.']],
  ['rate', 'n.', '比率;速度;价格vt.评价，估价', '985', ['比率;速度;价格vt'], ['比率;速度;价格vt.评价，估价'], ['rate is a key word in gaokao.']],
  ['ray', 'n.', '光线;射线', '985', ['光线;射线'], ['光线;射线'], ['ray is a key word in gaokao.']],
  ['react', 'vi.', '反应', '985', ['反应'], ['反应'], ['react is a key word in gaokao.']],
  ['reading', 'n.', '阅读;读物', '985', ['阅读;读物'], ['阅读;读物'], ['reading is a key word in gaokao.']],
  ['reality', 'n.', '现实;真实', '985', ['现实;真实'], ['现实;真实'], ['reality is a key word in gaokao.']],
  ['reception', 'adj.', '接待，接收，接待处', '985', ['接待，接收，接待处'], ['接待，接收，接待处'], ['reception is a key word in gaokao.']],
  ['recognize', 'vt.', '认出,识别，承认，认可', '985', ['认出,识别，承认，认'], ['认出,识别，承认，认可'], ['recognize is a key word in gaokao.']],
  ['recommend', 'vt.', '推荐，建议', '985', ['推荐，建议'], ['推荐，建议'], ['recommend is a key word in gaokao.']],
  ['recover', 'vt.', '恢复，痊愈', '985', ['恢复，痊愈'], ['恢复，痊愈'], ['recover is a key word in gaokao.']],
  ['recycle', 'vt.', '重复利用', '985', ['重复利用'], ['重复利用'], ['recycle is a key word in gaokao.']],
  ['reduce', 'vt.', '减少,减小', '985', ['减少,减小'], ['减少,减小'], ['reduce is a key word in gaokao.']],
  ['refer', 'v.', '提到，涉及，参考，查阅', '985', ['提到，涉及，参考，查'], ['提到，涉及，参考，查阅'], ['refer is a key word in gaokao.']],
  ['reflect', 'vt.', '反射,反映;思考', '985', ['反射,反映;思考'], ['反射,反映;思考'], ['reflect is a key word in gaokao.']],
  ['reform', 'n.', '改革,改良vt.改革,革新', '985', ['改革,改良vt.改革'], ['改革,改良vt.改革,革新'], ['reform is a key word in gaokao.']],
  ['register', 'vt.', '登记,注册n.登记,注册', '985', ['登记,注册n.登记,'], ['登记,注册n.登记,注册'], ['register is a key word in gaokao.']],
  ['regular', 'adj.', '规则的,整齐的;定期的，常规的', '985', ['规则的,整齐的;定期'], ['规则的,整齐的;定期的，常规的'], ['regular is a key word in gaokao.']],
  ['reject', 'vt.', '拒绝;丢掉;驳回', '985', ['拒绝;丢掉;驳回'], ['拒绝;丢掉;驳回'], ['reject is a key word in gaokao.']],
  ['relate', 'vt.', '联系', '985', ['联系'], ['联系'], ['relate is a key word in gaokao.']],
  ['relative', 'adj.', '有关系的;相对的n.亲戚，亲属', '985', ['有关系的;相对的n.'], ['有关系的;相对的n.亲戚，亲属'], ['relative is a key word in gaokao.']],
  ['relevant', 'adj.', '有关的;中肯的', '985', ['有关的;中肯的'], ['有关的;中肯的'], ['relevant is a key word in gaokao.']],
  ['reliable', 'adj.', '可靠的', '985', ['可靠的'], ['可靠的'], ['reliable is a key word in gaokao.']],
  ['religion', 'n.', '宗教，宗教信仰', '985', ['宗教，宗教信仰'], ['宗教，宗教信仰'], ['religion is a key word in gaokao.']],
  ['rely', 'vi.', '依赖,依靠;信赖', '985', ['依赖,依靠;信赖'], ['依赖,依靠;信赖'], ['rely is a key word in gaokao.']],
  ['remark', 'vi.', '评论n.评论;谈话', '985', ['评论n.评论;谈话'], ['评论n.评论;谈话'], ['remark is a key word in gaokao.']],
  ['remind', 'vt.', '提醒', '985', ['提醒'], ['提醒'], ['remind is a key word in gaokao.']],
  ['remote', 'adj.', '遥远的，偏僻的', '985', ['遥远的，偏僻的'], ['遥远的，偏僻的'], ['remote is a key word in gaokao.']],
  ['remove', 'vt.', '移动，调动，迁移', '985', ['移动，调动，迁移'], ['移动，调动，迁移'], ['remove is a key word in gaokao.']],
  ['rent', 'n.', '租金,租vi.出租，租用，租借', '985', ['租金,租vi.出租，'], ['租金,租vi.出租，租用，租借'], ['rent is a key word in gaokao.']],
  ['repair', 'vt.', '修理,修补n.修理', '985', ['修理,修补n.修理'], ['修理,修补n.修理'], ['repair is a key word in gaokao.']],
  ['repeat', 'vt.', '重说,重做n.重复', '985', ['重说,重做n.重复'], ['重说,重做n.重复'], ['repeat is a key word in gaokao.']],
  ['reply', 'vi.', '回答,答复n.答复', '985', ['回答,答复n.答复'], ['回答,答复n.答复'], ['reply is a key word in gaokao.']],
  ['represent', 'vt.', '描绘;代表,象征', '985', ['描绘;代表,象征'], ['描绘;代表,象征'], ['represent is a key word in gaokao.']],
  ['republic', 'n.', '共和国，共和政体', '985', ['共和国，共和政体'], ['共和国，共和政体'], ['republic is a key word in gaokao.']],
  ['reputation', 'n.', '名誉,声望', '985', ['名誉,声望'], ['名誉,声望'], ['reputation is a key word in gaokao.']],
  ['request', 'n.', '请求,要求vt.请求,要求', '985', ['请求,要求vt.请求'], ['请求,要求vt.请求,要求'], ['request is a key word in gaokao.']],
  ['rescue', 'vt.', '援救,营救', '985', ['援救,营救'], ['援救,营救'], ['rescue is a key word in gaokao.']],
  ['reserve', 'vt.', '储备,保留;预订', '985', ['储备,保留;预订'], ['储备,保留;预订'], ['reserve is a key word in gaokao.']],
  ['resist', 'vt.', '抵抗,抗拒', '985', ['抵抗,抗拒'], ['抵抗,抗拒'], ['resist is a key word in gaokao.']],
  ['respect', 'vt.', '尊敬,尊重n.尊敬', '985', ['尊敬,尊重n.尊敬'], ['尊敬,尊重n.尊敬'], ['respect is a key word in gaokao.']],
  ['respond', 'vi.', '回答;响应', '985', ['回答;响应'], ['回答;响应'], ['respond is a key word in gaokao.']],
  ['responsible', 'adj.', '有责任的;尽责的', '985', ['有责任的;尽责的'], ['有责任的;尽责的'], ['responsible is a key word in gaokao.']],
  ['retire', 'vi.', '退休', '985', ['退休'], ['退休'], ['retire is a key word in gaokao.']],
  ['revise', 'vt.', '校订,修改', '985', ['校订,修改'], ['校订,修改'], ['revise is a key word in gaokao.']],
  ['revolution', 'n.', '革命;旋转', '985', ['革命;旋转'], ['革命;旋转'], ['revolution is a key word in gaokao.']],
  ['reward', 'n.', '报答;报酬vt.奖赏，奖励', '985', ['报答;报酬vt.奖赏'], ['报答;报酬vt.奖赏，奖励'], ['reward is a key word in gaokao.']],
  ['ripe', 'adj.', '成熟的;时机成熟的', '985', ['成熟的;时机成熟的'], ['成熟的;时机成熟的'], ['ripe is a key word in gaokao.']],
  ['risk', 'n.', '风险,危险vt.冒险', '985', ['风险,危险vt.冒险'], ['风险,危险vt.冒险'], ['risk is a key word in gaokao.']],
  ['rob', 'vt.', '抢劫,劫掠vi.抢劫,劫掠', '985', ['抢劫,劫掠vi.抢劫'], ['抢劫,劫掠vi.抢劫,劫掠'], ['rob is a key word in gaokao.']],
  ['rocket', 'n.', '火箭', '985', ['火箭'], ['火箭'], ['rocket is a key word in gaokao.']],
  ['roll', 'vi.', '滚动,转动n.一卷;名册', '985', ['滚动,转动n.一卷;'], ['滚动,转动n.一卷;名册'], ['roll is a key word in gaokao.']],
  ['roof', 'n.', '屋顶', '985', ['屋顶'], ['屋顶'], ['roof is a key word in gaokao.']],
  ['root', 'n.', '根(部);根源vi.生根，扎根', '985', ['根(部);根源vi.'], ['根(部);根源vi.生根，扎根'], ['root is a key word in gaokao.']],
  ['rough', 'adj.', '表面不平的;粗略的;大致的', '985', ['表面不平的;粗略的;'], ['表面不平的;粗略的;大致的'], ['rough is a key word in gaokao.']],
  ['rude', 'adj.', '粗野的,残暴的', '985', ['粗野的,残暴的'], ['粗野的,残暴的'], ['rude is a key word in gaokao.']],
  ['ruin', 'n.', '毁灭;废墟vt.毁坏', '985', ['毁灭;废墟vt.毁坏'], ['毁灭;废墟vt.毁坏'], ['ruin is a key word in gaokao.']],
  ['sacrifice', 'vt.', '牺牲,献祭n.牺牲，祭品，供奉', '985', ['牺牲,献祭n.牺牲，'], ['牺牲,献祭n.牺牲，祭品，供奉'], ['sacrifice is a key word in gaokao.']],
  ['sailor', 'n.', '海员,水手', '985', ['海员,水手'], ['海员,水手'], ['sailor is a key word in gaokao.']],
  ['salary', 'n.', '薪水', '985', ['薪水'], ['薪水'], ['salary is a key word in gaokao.']],
  ['satellite', 'n.', '卫星', '985', ['卫星'], ['卫星'], ['satellite is a key word in gaokao.']],
  ['satisfaction', 'n.', '满意', '985', ['满意'], ['满意'], ['satisfaction is a key word in gaokao.']],
  ['scan', 'vt.', '浏览;扫描', '985', ['浏览;扫描'], ['浏览;扫描'], ['scan is a key word in gaokao.']],
  ['scare', 'vt.', '惊吓vi.受惊', '985', ['惊吓vi.受惊'], ['惊吓vi.受惊'], ['scare is a key word in gaokao.']],
  ['scene', 'n.', '情景;景色', '985', ['情景;景色'], ['情景;景色'], ['scene is a key word in gaokao.']],
  ['schedule', 'vt.', '安排n.时间表,计划表', '985', ['安排n.时间表,计划'], ['安排n.时间表,计划表'], ['schedule is a key word in gaokao.']],
  ['scholarship', 'n.', '奖学金', '985', ['奖学金'], ['奖学金'], ['scholarship is a key word in gaokao.']],
  ['scientific', 'adj.', '科学的', '985', ['科学的'], ['科学的'], ['scientific is a key word in gaokao.']],
  ['scold', 'vt.', '责骂', '985', ['责骂'], ['责骂'], ['scold is a key word in gaokao.']],
  ['scream', 'vi.', '尖叫n.尖叫声', '985', ['尖叫n.尖叫声'], ['尖叫n.尖叫声'], ['scream is a key word in gaokao.']],
  ['seaside', 'n.', '海边', '985', ['海边'], ['海边'], ['seaside is a key word in gaokao.']],
  ['section', 'n.', '切片;部门;章节', '985', ['切片;部门;章节'], ['切片;部门;章节'], ['section is a key word in gaokao.']],
  ['secure', 'adj.', '安全的', '985', ['安全的'], ['安全的'], ['secure is a key word in gaokao.']],
  ['seed', 'n.', '种(子),籽', '985', ['种(子),籽'], ['种(子),籽'], ['seed is a key word in gaokao.']],
  ['seek', 'vt.', '寻找,探索', '985', ['寻找,探索'], ['寻找,探索'], ['seek is a key word in gaokao.']],
  ['seize', 'vt.', '抓住;夺取，占据', '985', ['抓住;夺取，占据'], ['抓住;夺取，占据'], ['seize is a key word in gaokao.']],
  ['select', 'vt.', '选择vi.挑选', '985', ['选择vi.挑选'], ['选择vi.挑选'], ['select is a key word in gaokao.']],
  ['self', 'n.', '自我,自己', '985', ['自我,自己'], ['自我,自己'], ['self is a key word in gaokao.']],
  ['selfish', 'adj.', '自私的,利己的', '985', ['自私的,利己的'], ['自私的,利己的'], ['selfish is a key word in gaokao.']],
  ['senior', 'adj.', '年长者;资格老的', '985', ['年长者;资格老的'], ['年长者;资格老的'], ['senior is a key word in gaokao.']],
  ['sensitive', 'adj.', '敏感的,灵敏的', '985', ['敏感的,灵敏的'], ['敏感的,灵敏的'], ['sensitive is a key word in gaokao.']],
  ['settle', 'vt.', '安排,安放;解决vi.定居', '985', ['安排,安放;解决vi'], ['安排,安放;解决vi.定居'], ['settle is a key word in gaokao.']],
  ['sew', 'vt.', '缝制', '985', ['缝制'], ['缝制'], ['sew is a key word in gaokao.']],
  ['sex', 'n.', '性别,性', '985', ['性别,性'], ['性别,性'], ['sex is a key word in gaokao.']],
  ['shade', 'n.', '树荫，阴影，阴凉处，遮光物vi.荫蔽', '985', ['树荫，阴影，阴凉处，'], ['树荫，阴影，阴凉处，遮光物vi.荫蔽'], ['shade is a key word in gaokao.']],
  ['shadow', 'n.', '阴影,影子', '985', ['阴影,影子'], ['阴影,影子'], ['shadow is a key word in gaokao.']],
  ['shallow', 'adj.', '浅的,浅薄的n.浅滩', '985', ['浅的,浅薄的n.浅滩'], ['浅的,浅薄的n.浅滩'], ['shallow is a key word in gaokao.']],
  ['sharp', 'adj.', '锋利的，急剧的，敏锐的;刺耳的', '985', ['锋利的，急剧的，敏锐'], ['锋利的，急剧的，敏锐的;刺耳的'], ['sharp is a key word in gaokao.']],
  ['shave', 'vt.', '剃,刮vi.修面n.刮脸', '985', ['剃,刮vi.修面n.'], ['剃,刮vi.修面n.刮脸'], ['shave is a key word in gaokao.']],
  ['sheet', 'n.', '被单;纸张，薄片', '985', ['被单;纸张，薄片'], ['被单;纸张，薄片'], ['sheet is a key word in gaokao.']],
  ['shelter', 'n.', '掩蔽处vt.遮蔽，掩护', '985', ['掩蔽处vt.遮蔽，掩'], ['掩蔽处vt.遮蔽，掩护'], ['shelter is a key word in gaokao.']],
  ['shock', 'n.', '冲击;震惊;电击vi.震动', '985', ['冲击;震惊;电击vi'], ['冲击;震惊;电击vi.震动'], ['shock is a key word in gaokao.']],
  ['shoot', 'vt.', '射击，射中，拍摄，发芽n.射击，摄影', '985', ['射击，射中，拍摄，发'], ['射击，射中，拍摄，发芽n.射击，摄影'], ['shoot is a key word in gaokao.']],
  ['shopping', 'n.', '购物', '985', ['购物'], ['购物'], ['shopping is a key word in gaokao.']],
  ['shore', 'n.', '滨,岸', '985', ['滨,岸'], ['滨,岸'], ['shore is a key word in gaokao.']],
  ['shortcoming', 'n.', '短处,缺点', '985', ['短处,缺点'], ['短处,缺点'], ['shortcoming is a key word in gaokao.']],
  ['shot', 'n.', '射击，发射;投篮', '985', ['射击，发射;投篮'], ['射击，发射;投篮'], ['shot is a key word in gaokao.']],
  ['sigh', 'vi.', '叹气,叹息n.叹息', '985', ['叹气,叹息n.叹息'], ['叹气,叹息n.叹息'], ['sigh is a key word in gaokao.']],
  ['sign', 'n.', '符号;征兆vt.签名', '985', ['符号;征兆vt.签名'], ['符号;征兆vt.签名'], ['sign is a key word in gaokao.']],
  ['signal', 'n.', '信号vi.发信号', '985', ['信号vi.发信号'], ['信号vi.发信号'], ['signal is a key word in gaokao.']],
  ['significance', 'n.', '意义,重要性', '985', ['意义,重要性'], ['意义,重要性'], ['significance is a key word in gaokao.']],
  ['simply', 'adv.', '简单地;朴素地;仅仅，只不过', '985', ['简单地;朴素地;仅仅'], ['简单地;朴素地;仅仅，只不过'], ['simply is a key word in gaokao.']],
  ['sincere', 'adj.', '真诚的,真挚的', '985', ['真诚的,真挚的'], ['真诚的,真挚的'], ['sincere is a key word in gaokao.']],
  ['sincerely', 'adv.', '真诚地', '985', ['真诚地'], ['真诚地'], ['sincerely is a key word in gaokao.']],
  ['sink', 'vi.', '下沉,消沉，渗透n.水槽,水池', '985', ['下沉,消沉，渗透n.'], ['下沉,消沉，渗透n.水槽,水池'], ['sink is a key word in gaokao.']],
  ['skin', 'vt.', '剥皮n.皮,皮肤;兽皮', '985', ['剥皮n.皮,皮肤;兽'], ['剥皮n.皮,皮肤;兽皮'], ['skin is a key word in gaokao.']],
  ['skyscraper', 'n.', '摩天大楼', '985', ['摩天大楼'], ['摩天大楼'], ['skyscraper is a key word in gaokao.']],
  ['slave', 'n.', '奴隶,苦工', '985', ['奴隶,苦工'], ['奴隶,苦工'], ['slave is a key word in gaokao.']],
  ['slight', 'adj.', '细长的;轻微的，少量的，不重要的', '985', ['细长的;轻微的，少量'], ['细长的;轻微的，少量的，不重要的'], ['slight is a key word in gaokao.']],
  ['slightly', 'adv.', '轻微地', '985', ['轻微地'], ['轻微地'], ['slightly is a key word in gaokao.']],
  ['slim', 'adj.', '苗条的，修长的', '985', ['苗条的，修长的'], ['苗条的，修长的'], ['slim is a key word in gaokao.']],
  ['smooth', 'adj.', '光滑的，平稳的，顺利的', '985', ['光滑的，平稳的，顺利'], ['光滑的，平稳的，顺利的'], ['smooth is a key word in gaokao.']],
  ['sneaker', 'n.', '鬼鬼祟祟做事的人,卑鄙者,运动鞋', '985', ['鬼鬼祟祟做事的人,卑'], ['鬼鬼祟祟做事的人,卑鄙者,运动鞋'], ['sneaker is a key word in gaokao.']],
  ['soccer', 'n.', '英式足球', '985', ['英式足球'], ['英式足球'], ['soccer is a key word in gaokao.']],
  ['socialism', 'n.', '社会主义', '985', ['社会主义'], ['社会主义'], ['socialism is a key word in gaokao.']],
  ['socialist', 'adj.', '社会主义的', '985', ['社会主义的'], ['社会主义的'], ['socialist is a key word in gaokao.']],
  ['software', 'n.', '软件', '985', ['软件'], ['软件'], ['software is a key word in gaokao.']],
  ['soil', 'n.', '土壤;土地', '985', ['土壤;土地'], ['土壤;土地'], ['soil is a key word in gaokao.']],
  ['solar', 'adj.', '太阳的,日光的', '985', ['太阳的,日光的'], ['太阳的,日光的'], ['solar is a key word in gaokao.']],
  ['soul', 'n.', '灵魂,精神;人', '985', ['灵魂,精神;人'], ['灵魂,精神;人'], ['soul is a key word in gaokao.']],
  ['specific', 'adj.', '特定的，明确的，具体的', '985', ['特定的，明确的，具体'], ['特定的，明确的，具体的'], ['specific is a key word in gaokao.']],
  ['spit', 'vi.', '吐唾沫', '985', ['吐唾沫'], ['吐唾沫'], ['spit is a key word in gaokao.']],
  ['splendid', 'adj.', '壮丽的,显著的', '985', ['壮丽的,显著的'], ['壮丽的,显著的'], ['splendid is a key word in gaokao.']],
  ['split', 'vt.', '劈开', '985', ['劈开'], ['劈开'], ['split is a key word in gaokao.']],
  ['spoken', 'adj.', '口头讲的,口语的', '985', ['口头讲的,口语的'], ['口头讲的,口语的'], ['spoken is a key word in gaokao.']],
  ['speak', 'v.', '说；讲；发言', '985', ['说；讲；发言'], ['说；讲；发言'], ['speak is a key word in gaokao.']],
  ['sponsor', 'n.', '发起者vt.发起', '985', ['发起者vt.发起'], ['发起者vt.发起'], ['sponsor is a key word in gaokao.']],
  ['spot', 'vt.', '认出，发现n.点,斑点;地点', '985', ['认出，发现n.点,斑'], ['认出，发现n.点,斑点;地点'], ['spot is a key word in gaokao.']],
  ['spy', 'n.', '间谍,特务vt.侦察，监视', '985', ['间谍,特务vt.侦察'], ['间谍,特务vt.侦察，监视'], ['spy is a key word in gaokao.']],
  ['stable', 'adj.', '稳定的，安定的n.马厩,马棚', '985', ['稳定的，安定的n.马'], ['稳定的，安定的n.马厩,马棚'], ['stable is a key word in gaokao.']],
  ['stadium', 'n.', '露天大型运动场', '985', ['露天大型运动场'], ['露天大型运动场'], ['stadium is a key word in gaokao.']],
  ['staff', 'n.', '全体工作人员', '985', ['全体工作人员'], ['全体工作人员'], ['staff is a key word in gaokao.']],
  ['stage', 'n.', '舞台;阶段，时期', '985', ['舞台;阶段，时期'], ['舞台;阶段，时期'], ['stage is a key word in gaokao.']],
  ['stair', 'n.', '楼梯', '985', ['楼梯'], ['楼梯'], ['stair is a key word in gaokao.']],
  ['stare', 'vi.', '凝视', '985', ['凝视'], ['凝视'], ['stare is a key word in gaokao.']],
  ['starve', 'vi.', '饿死vt.使饿死', '985', ['饿死vt.使饿死'], ['饿死vt.使饿死'], ['starve is a key word in gaokao.']],
  ['steady', 'adj.', '稳固的vt.使稳定', '985', ['稳固的vt.使稳定'], ['稳固的vt.使稳定'], ['steady is a key word in gaokao.']],
  ['steam', 'n.', '蒸汽vi.蒸发vt.蒸煮', '985', ['蒸汽vi.蒸发vt.'], ['蒸汽vi.蒸发vt.蒸煮'], ['steam is a key word in gaokao.']],
  ['steel', 'n.', '钢', '985', ['钢'], ['钢'], ['steel is a key word in gaokao.']],
  ['straight', 'adj.', '直的;正直的ad.直接地', '985', ['直的;正直的ad.直'], ['直的;正直的ad.直接地'], ['straight is a key word in gaokao.']],
  ['strength', 'n.', '力量,力气', '985', ['力量,力气'], ['力量,力气'], ['strength is a key word in gaokao.']],
  ['stress', 'n.', '强调，重要性，压力，重音vt.强调，使紧张，用重音读', '985', ['强调，重要性，压力，'], ['强调，重要性，压力，重音vt.强调，使紧张，用重音读'], ['stress is a key word in gaokao.']],
  ['strike', 'vt.', '打,击;罢工n.罢工;打击;殴打', '985', ['打,击;罢工n.罢工'], ['打,击;罢工n.罢工;打击;殴打'], ['strike is a key word in gaokao.']],
  ['struggle', 'n.', '奋斗，努力，挣扎vi.奋斗，努力，挣扎', '985', ['奋斗，努力，挣扎vi'], ['奋斗，努力，挣扎vi.奋斗，努力，挣扎'], ['struggle is a key word in gaokao.']],
  ['studio', 'n.', '工作室,播音室', '985', ['工作室,播音室'], ['工作室,播音室'], ['studio is a key word in gaokao.']],
  ['style', 'n.', '风格,式样', '985', ['风格,式样'], ['风格,式样'], ['style is a key word in gaokao.']],
  ['suck', 'vt.', '吸,吮', '985', ['吸,吮'], ['吸,吮'], ['suck is a key word in gaokao.']],
  ['suddenly', 'adv.', '突然', '985', ['突然'], ['突然'], ['suddenly is a key word in gaokao.']],
  ['suffer', 'v.', '遭受,忍受', '985', ['遭受,忍受'], ['遭受,忍受'], ['suffer is a key word in gaokao.']],
  ['suit', 'n.', '套装，诉讼vt.适合，使适应', '985', ['套装，诉讼vt.适合'], ['套装，诉讼vt.适合，使适应'], ['suit is a key word in gaokao.']],
  ['suitable', 'adj.', '适宜的;恰当的', '985', ['适宜的;恰当的'], ['适宜的;恰当的'], ['suitable is a key word in gaokao.']],
  ['sum', 'n.', '总数;金额vi.共计', '985', ['总数;金额vi.共计'], ['总数;金额vi.共计'], ['sum is a key word in gaokao.']],
  ['summary', 'adj.', '简短的，扼要的n.摘要,总结', '985', ['简短的，扼要的n.摘'], ['简短的，扼要的n.摘要,总结'], ['summary is a key word in gaokao.']],
  ['sunset', 'n.', '日落', '985', ['日落'], ['日落'], ['sunset is a key word in gaokao.']],
  ['sunshine', 'n.', '阳光', '985', ['阳光'], ['阳光'], ['sunshine is a key word in gaokao.']],
  ['support', 'vt.', '支持;供养', '985', ['支持;供养'], ['支持;供养'], ['support is a key word in gaokao.']],
  ['surround', 'vt.', '包围，环绕', '985', ['包围，环绕'], ['包围，环绕'], ['surround is a key word in gaokao.']],
  ['survive', 'vt.', '幸免于vi.活下来', '985', ['幸免于vi.活下来'], ['幸免于vi.活下来'], ['survive is a key word in gaokao.']],
  ['swallow', 'vt.', '吞，咽vi.吞，咽n.燕子', '985', ['吞，咽vi.吞，咽n'], ['吞，咽vi.吞，咽n.燕子'], ['swallow is a key word in gaokao.']],
  ['switch', 'n.', '开关;转换vt.转换', '985', ['开关;转换vt.转换'], ['开关;转换vt.转换'], ['switch is a key word in gaokao.']],
  ['symbol', 'n.', '象征;符号', '985', ['象征;符号'], ['象征;符号'], ['symbol is a key word in gaokao.']],
  ['sympathy', 'n.', '同情，同情心', '985', ['同情，同情心'], ['同情，同情心'], ['sympathy is a key word in gaokao.']],
  ['system', 'n.', '系统;制度', '985', ['系统;制度'], ['系统;制度'], ['system is a key word in gaokao.']],
  ['tailor', 'n.', '裁缝vt.裁制衣服', '985', ['裁缝vt.裁制衣服'], ['裁缝vt.裁制衣服'], ['tailor is a key word in gaokao.']],
  ['talent', 'n.', '天才，才能', '985', ['天才，才能'], ['天才，才能'], ['talent is a key word in gaokao.']],
  ['tank', 'n.', '坦克；大容器', '985', ['坦克；大容器'], ['坦克；大容器'], ['tank is a key word in gaokao.']],
  ['tap', 'vt.', '轻打，轻敲n.塞子，龙头；轻叩，轻拍', '985', ['轻打，轻敲n.塞子，'], ['轻打，轻敲n.塞子，龙头；轻叩，轻拍'], ['tap is a key word in gaokao.']],
  ['target', 'n.', '靶；目标', '985', ['靶；目标'], ['靶；目标'], ['target is a key word in gaokao.']],
  ['tax', 'n.', '税(款)vt.征税', '985', ['税(款)vt.征税'], ['税(款)vt.征税'], ['tax is a key word in gaokao.']],
  ['tear', 'n.', '泪滴，眼泪vt.撕开，撕裂', '985', ['泪滴，眼泪vt.撕开'], ['泪滴，眼泪vt.撕开，撕裂'], ['tear is a key word in gaokao.']],
  ['technical', 'adj.', '技术的，工艺的', '985', ['技术的，工艺的'], ['技术的，工艺的'], ['technical is a key word in gaokao.']],
  ['technique', 'n.', '技巧，技能', '985', ['技巧，技能'], ['技巧，技能'], ['technique is a key word in gaokao.']],
  ['teenager', 'n.', '青少年', '985', ['青少年'], ['青少年'], ['teenager is a key word in gaokao.']],
  ['telegram', 'n.', '电报', '985', ['电报'], ['电报'], ['telegram is a key word in gaokao.']],
  ['telegraph', 'n.', '电报(机)v.发电报', '985', ['电报(机)v.发电报'], ['电报(机)v.发电报'], ['telegraph is a key word in gaokao.']],
  ['telescope', 'n.', '望远镜', '985', ['望远镜'], ['望远镜'], ['telescope is a key word in gaokao.']],
  ['television', 'n.', '电视，电视机', '985', ['电视，电视机'], ['电视，电视机'], ['television is a key word in gaokao.']],
  ['temple', 'n.', '神殿，庙宇；太阳穴', '985', ['神殿，庙宇；太阳穴'], ['神殿，庙宇；太阳穴'], ['temple is a key word in gaokao.']],
  ['temporary', 'adj.', '暂时的，临时的', '985', ['暂时的，临时的'], ['暂时的，临时的'], ['temporary is a key word in gaokao.']],
  ['tend', 'vi.', '走向，趋向', '985', ['走向，趋向'], ['走向，趋向'], ['tend is a key word in gaokao.']],
  ['tendency', 'n.', '趋向，趋势', '985', ['趋向，趋势'], ['趋向，趋势'], ['tendency is a key word in gaokao.']],
  ['tense', 'adj.', '紧张的；拉紧的n.时态', '985', ['紧张的；拉紧的n.时'], ['紧张的；拉紧的n.时态'], ['tense is a key word in gaokao.']],
  ['theme', 'n.', '题目；词干；主旋律', '985', ['题目；词干；主旋律'], ['题目；词干；主旋律'], ['theme is a key word in gaokao.']],
  ['theory', 'n.', '理论，学说', '985', ['理论，学说'], ['理论，学说'], ['theory is a key word in gaokao.']],
  ['therefore', 'adv.', '因此，所以', '985', ['因此，所以'], ['因此，所以'], ['therefore is a key word in gaokao.']],
  ['thief', 'n.', '窃贼，偷窃犯', '985', ['窃贼，偷窃犯'], ['窃贼，偷窃犯'], ['thief is a key word in gaokao.']],
  ['thinking', 'n.', '思考；想法，见解', '985', ['思考；想法，见解'], ['思考；想法，见解'], ['thinking is a key word in gaokao.']],
  ['throat', 'n.', '咽喉', '985', ['咽喉'], ['咽喉'], ['throat is a key word in gaokao.']],
  ['throughout', 'prep.', '遍及ad.到处', '985', ['遍及ad.到处'], ['遍及ad.到处'], ['throughout is a key word in gaokao.']],
  ['thus', 'adv.', '如此，这样；因而', '985', ['如此，这样；因而'], ['如此，这样；因而'], ['thus is a key word in gaokao.']],
  ['tick', 'n.', '滴答声；记号vi.发出滴答声', '985', ['滴答声；记号vi.发'], ['滴答声；记号vi.发出滴答声'], ['tick is a key word in gaokao.']],
  ['tight', 'adj.', '紧的；紧身的ad.紧紧地', '985', ['紧的；紧身的ad.紧'], ['紧的；紧身的ad.紧紧地'], ['tight is a key word in gaokao.']],
  ['timetable', 'n.', '时间表；时刻表', '985', ['时间表；时刻表'], ['时间表；时刻表'], ['timetable is a key word in gaokao.']],
  ['tin', 'n.', '锡；罐头', '985', ['锡；罐头'], ['锡；罐头'], ['tin is a key word in gaokao.']],
  ['tip', 'vt.', '轻击vi.给小费n.小费', '985', ['轻击vi.给小费n.'], ['轻击vi.给小费n.小费'], ['tip is a key word in gaokao.']],
  ['tire', 'vi.', '疲劳；厌倦n.轮胎', '985', ['疲劳；厌倦n.轮胎'], ['疲劳；厌倦n.轮胎'], ['tire is a key word in gaokao.']],
  ['title', 'n.', '标题，题目；称号，头衔', '985', ['标题，题目；称号，头'], ['标题，题目；称号，头衔'], ['title is a key word in gaokao.']],
  ['tobacco', 'n.', '烟草，烟叶', '985', ['烟草，烟叶'], ['烟草，烟叶'], ['tobacco is a key word in gaokao.']],
  ['tolerate', 'vt.', '忍受，容忍', '985', ['忍受，容忍'], ['忍受，容忍'], ['tolerate is a key word in gaokao.']],
  ['topic', 'n.', '题目；论题，话题', '985', ['题目；论题，话题'], ['题目；论题，话题'], ['topic is a key word in gaokao.']],
  ['tough', 'adj.', '坚韧的；健壮的', '985', ['坚韧的；健壮的'], ['坚韧的；健壮的'], ['tough is a key word in gaokao.']],
  ['track', 'n.', '行踪，路径；轨道', '985', ['行踪，路径；轨道'], ['行踪，路径；轨道'], ['track is a key word in gaokao.']],
  ['tractor', 'n.', '拖拉机', '985', ['拖拉机'], ['拖拉机'], ['tractor is a key word in gaokao.']],
  ['tradition', 'n.', '传统，惯例', '985', ['传统，惯例'], ['传统，惯例'], ['tradition is a key word in gaokao.']],
  ['transport', 'n.', '运输vt.运输', '985', ['运输vt.运输'], ['运输vt.运输'], ['transport is a key word in gaokao.']],
  ['trap', 'n.', '陷阱；诡计vt.诱骗', '985', ['陷阱；诡计vt.诱骗'], ['陷阱；诡计vt.诱骗'], ['trap is a key word in gaokao.']],
  ['trend', 'vi.', '伸向；倾向n.倾向', '985', ['伸向；倾向n.倾向'], ['伸向；倾向n.倾向'], ['trend is a key word in gaokao.']],
  ['trial', 'n.', '试验；审判', '985', ['试验；审判'], ['试验；审判'], ['trial is a key word in gaokao.']],
  ['trick', 'n.', '诡计；窍门vt.哄骗', '985', ['诡计；窍门vt.哄骗'], ['诡计；窍门vt.哄骗'], ['trick is a key word in gaokao.']],
  ['type', 'n.', '类型vi.打字', '985', ['类型vi.打字'], ['类型vi.打字'], ['type is a key word in gaokao.']],
  ['typewriter', 'n.', '打字机', '985', ['打字机'], ['打字机'], ['typewriter is a key word in gaokao.']],
  ['typical', 'adj.', '典型的，代表性的', '985', ['典型的，代表性的'], ['典型的，代表性的'], ['typical is a key word in gaokao.']],
  ['typist', 'n.', '打字员', '985', ['打字员'], ['打字员'], ['typist is a key word in gaokao.']],
  ['tyre', 'n.', '轮胎', '985', ['轮胎'], ['轮胎'], ['tyre is a key word in gaokao.']],
  ['underline', 'vt.', '在…下划线；强调', '985', ['在…下划线；强调'], ['在…下划线；强调'], ['underline is a key word in gaokao.']],
  ['understanding', 'n.', '理解，理解力', '985', ['理解，理解力'], ['理解，理解力'], ['understanding is a key word in gaokao.']],
  ['unfair', 'adj.', '不公平的', '985', ['不公平的'], ['不公平的'], ['unfair is a key word in gaokao.']],
  ['uniform', 'adj.', '一样的n.制服', '985', ['一样的n.制服'], ['一样的n.制服'], ['uniform is a key word in gaokao.']],
  ['unique', 'adj.', '唯一的', '985', ['唯一的'], ['唯一的'], ['unique is a key word in gaokao.']],
  ['unite', 'vi.', '联合vt.使联合', '985', ['联合vt.使联合'], ['联合vt.使联合'], ['unite is a key word in gaokao.']],
  ['united', 'adj.', '一致的；联合的', '985', ['一致的；联合的'], ['一致的；联合的'], ['united is a key word in gaokao.']],
  ['universe', 'n.', '宇宙，世界', '985', ['宇宙，世界'], ['宇宙，世界'], ['universe is a key word in gaokao.']],
  ['unknown', 'adj.', '未知的，不知名的', '985', ['未知的，不知名的'], ['未知的，不知名的'], ['unknown is a key word in gaokao.']],
  ['unusual', 'adj.', '不平常的，独特的', '985', ['不平常的，独特的'], ['不平常的，独特的'], ['unusual is a key word in gaokao.']],
  ['update', 'vt.', '更新，使现代化n.现代化，更新', '985', ['更新，使现代化n.现'], ['更新，使现代化n.现代化，更新'], ['update is a key word in gaokao.']],
  ['upset', 'vt.', '使不适，使心烦n.混乱', '985', ['使不适，使心烦n.混'], ['使不适，使心烦n.混乱'], ['upset is a key word in gaokao.']],
  ['upward', 'adj.', '向上的，上升的ad.向上，往上', '985', ['向上的，上升的ad.'], ['向上的，上升的ad.向上，往上'], ['upward is a key word in gaokao.']],
  ['urban', 'adj.', '都市的', '985', ['都市的'], ['都市的'], ['urban is a key word in gaokao.']],
  ['urgent', 'adj.', '紧急的', '985', ['紧急的'], ['紧急的'], ['urgent is a key word in gaokao.']],
  ['usually', 'adv.', '通常', '985', ['通常'], ['通常'], ['usually is a key word in gaokao.']],
  ['valley', 'n.', '山谷，流域', '985', ['山谷，流域'], ['山谷，流域'], ['valley is a key word in gaokao.']],
  ['valuable', 'adj.', '值钱的，有价值的n.贵重物品', '985', ['值钱的，有价值的n.'], ['值钱的，有价值的n.贵重物品'], ['valuable is a key word in gaokao.']],
  ['variety', 'n.', '多样化，种类', '985', ['多样化，种类'], ['多样化，种类'], ['variety is a key word in gaokao.']],
  ['various', 'adj.', '各种各样的', '985', ['各种各样的'], ['各种各样的'], ['various is a key word in gaokao.']],
  ['vast', 'adj.', '巨大的，广阔的', '985', ['巨大的，广阔的'], ['巨大的，广阔的'], ['vast is a key word in gaokao.']],
  ['vehicle', 'n.', '车辆', '985', ['车辆'], ['车辆'], ['vehicle is a key word in gaokao.']],
  ['victim', 'n.', '牺牲者，受害者', '985', ['牺牲者，受害者'], ['牺牲者，受害者'], ['victim is a key word in gaokao.']],
  ['view', 'vt.', '看待；看n.见解；风景', '985', ['看待；看n.见解；风'], ['看待；看n.见解；风景'], ['view is a key word in gaokao.']],
  ['violent', 'adj.', '猛烈的，狂暴的', '985', ['猛烈的，狂暴的'], ['猛烈的，狂暴的'], ['violent is a key word in gaokao.']],
  ['virus', 'n.', '病毒', '985', ['病毒'], ['病毒'], ['virus is a key word in gaokao.']],
  ['visa', 'n.', '签证；信用卡', '985', ['签证；信用卡'], ['签证；信用卡'], ['visa is a key word in gaokao.']],
  ['volunteer', 'n.', '志愿者vt.志愿', '985', ['志愿者vt.志愿'], ['志愿者vt.志愿'], ['volunteer is a key word in gaokao.']],
  ['vote', 'n.', '选举，投票', '985', ['选举，投票'], ['选举，投票'], ['vote is a key word in gaokao.']],
  ['voyage', 'n.', '航海vi.航海，航空', '985', ['航海vi.航海，航空'], ['航海vi.航海，航空'], ['voyage is a key word in gaokao.']],
  ['wage', 'n.', '工资，报酬', '985', ['工资，报酬'], ['工资，报酬'], ['wage is a key word in gaokao.']],
  ['waiter', 'n.', '侍者，服务员', '985', ['侍者，服务员'], ['侍者，服务员'], ['waiter is a key word in gaokao.']],
  ['waitress', 'n.', '女侍者，女服务员', '985', ['女侍者，女服务员'], ['女侍者，女服务员'], ['waitress is a key word in gaokao.']],
  ['wave', 'n.', '波，波涛；起伏vi.波动；挥手', '985', ['波，波涛；起伏vi.'], ['波，波涛；起伏vi.波动；挥手'], ['wave is a key word in gaokao.']],
  ['weakness', 'n.', '弱点', '985', ['弱点'], ['弱点'], ['weakness is a key word in gaokao.']],
  ['web', 'n.', '(蜘蛛)网，网状物；网络', '985', ['(蜘蛛)网，网状物；'], ['(蜘蛛)网，网状物；网络'], ['web is a key word in gaokao.']],
  ['website', '待标注', 'WWW(环球网)的站点', '985', ['WWW(环球网)的站'], ['WWW(环球网)的站点'], ['website is a key word in gaokao.']],
  ['wedding', 'n.', '婚礼', '985', ['婚礼'], ['婚礼'], ['wedding is a key word in gaokao.']],
  ['weed', 'n.', '杂草，野草vi.除草', '985', ['杂草，野草vi.除草'], ['杂草，野草vi.除草'], ['weed is a key word in gaokao.']],
  ['well-known', 'adj.', '众所周知的', '985', ['众所周知的'], ['众所周知的'], ['well-known is a key word in gaokao.']],
  ['whisper', 'vt.', '低声地讲vi.低语n.语，私语', '985', ['低声地讲vi.低语n'], ['低声地讲vi.低语n.语，私语'], ['whisper is a key word in gaokao.']],
  ['whistle', 'n.', '口哨vi.吹口哨wilda.野生的；野蛮的n.荒地', '985', ['口哨vi.吹口哨wi'], ['口哨vi.吹口哨wilda.野生的；野蛮的n.荒地'], ['whistle is a key word in gaokao.']],
  ['willing', 'adj.', '心甘情愿', '985', ['心甘情愿'], ['心甘情愿'], ['willing is a key word in gaokao.']],
  ['wind', 'n.', '风wipevt.揩，擦n.揩，擦', '985', ['风wipevt.揩，'], ['风wipevt.揩，擦n.揩，擦'], ['wind is a key word in gaokao.']],
  ['wire', 'n.', '金属线，电缆', '985', ['金属线，电缆'], ['金属线，电缆'], ['wire is a key word in gaokao.']],
  ['within', 'prep.', '在…里面；不超过', '985', ['在…里面；不超过'], ['在…里面；不超过'], ['within is a key word in gaokao.']],
  ['witness', 'n.', '证据；证人vt.目击', '985', ['证据；证人vt.目击'], ['证据；证人vt.目击'], ['witness is a key word in gaokao.']],
  ['wooden', 'adj.', '木制的；呆板的wooln.羊毛，毛线', '985', ['木制的；呆板的woo'], ['木制的；呆板的wooln.羊毛，毛线'], ['wooden is a key word in gaokao.']],
  ['worse', 'adj.', '更坏的ad.更坏', '985', ['更坏的ad.更坏'], ['更坏的ad.更坏'], ['worse is a key word in gaokao.']],
  ['worst', 'adj.', '最坏的ad.最坏地', '985', ['最坏的ad.最坏地'], ['最坏的ad.最坏地'], ['worst is a key word in gaokao.']],
  ['worthwhile', 'adj.', '值得的', '985', ['值得的'], ['值得的'], ['worthwhile is a key word in gaokao.']],
  ['would', '待标注', 'aux.将；愿意', '985', ['aux.将；愿意'], ['aux.将；愿意'], ['would is a key word in gaokao.']],
  ['youth', 'n.', '青春；青年', '985', ['青春；青年'], ['青春；青年'], ['youth is a key word in gaokao.']]
];

// 536话题词汇 - 科技创新
const seedWords536_科技创新 = [
  ['abandoned', 'adj.', '废弃的', '话题', ['科技创新话题词'], ['废弃的'], ['abandoned is common in 科技创新 topics.']],
  ['accessible', 'adj.', '可进入/使用的', '话题', ['科技创新话题词'], ['可进入/使用的'], ['accessible is common in 科技创新 topics.']],
  ['assign', 'v.', '分配，指派，赋值', '话题', ['科技创新话题词'], ['分配，指派，赋值'], ['assign is common in 科技创新 topics.']],
  ['biology', 'n.', '生物学', '话题', ['科技创新话题词'], ['生物学'], ['biology is common in 科技创新 topics.']],
  ['carbon', 'n.', '碳，灯芯，复写纸', '话题', ['科技创新话题词'], ['碳，灯芯，复写纸'], ['carbon is common in 科技创新 topics.']],
  ['circumstance', 'n.', '条件，环境', '话题', ['科技创新话题词'], ['条件，环境'], ['circumstance is common in 科技创新 topics.']],
  ['chemicals', 'n.', '化学药品', '话题', ['科技创新话题词'], ['化学药品'], ['chemicals is common in 科技创新 topics.']],
  ['complicated', 'adj.', '复杂的；难处理的', '话题', ['科技创新话题词'], ['复杂的；难处理的'], ['complicated is common in 科技创新 topics.']],
  ['dispose of', 'phr.', '丢弃', '话题', ['科技创新话题词'], ['丢弃'], ['dispose of is common in 科技创新 topics.']],
  ['essential', 'adj./n.', '基本的；根本的；必需品；基本知识', '话题', ['科技创新话题词'], ['基本的；根本的；必需品；基本知识'], ['essential is common in 科技创新 topics.']],
  ['digital', 'adj.', '数字的，电子的', '话题', ['科技创新话题词'], ['数字的，电子的'], ['digital is common in 科技创新 topics.']],
  ['dimension', 'n.', '容积，范围；方面', '话题', ['科技创新话题词'], ['容积，范围；方面'], ['dimension is common in 科技创新 topics.']],
  ['electrical', 'adj.', '电的，电气科学的', '话题', ['科技创新话题词'], ['电的，电气科学的'], ['electrical is common in 科技创新 topics.']],
  ['electronic', 'adj.', '电子的；电子操纵的', '话题', ['科技创新话题词'], ['电子的；电子操纵的'], ['electronic is common in 科技创新 topics.']],
  ['element', 'n.', '成分，元素，基本原理', '话题', ['科技创新话题词'], ['成分，元素，基本原理'], ['element is common in 科技创新 topics.']],
  ['evolution', 'n.', '进化，发展，进展', '话题', ['科技创新话题词'], ['进化，发展，进展'], ['evolution is common in 科技创新 topics.']],
  ['emission', 'n.', '发出；排放(物)', '话题', ['科技创新话题词'], ['发出；排放(物)'], ['emission is common in 科技创新 topics.']],
  ['forthcoming', 'adj.', '即将到来的', '话题', ['科技创新话题词'], ['即将到来的'], ['forthcoming is common in 科技创新 topics.']],
  ['graph', 'n./v.', '图表；用图表表示', '话题', ['科技创新话题词'], ['图表；用图表表示'], ['graph is common in 科技创新 topics.']],
  ['intelligence', 'n.', '理解力，智力，情报', '话题', ['科技创新话题词'], ['理解力，智力，情报'], ['intelligence is common in 科技创新 topics.']],
  ['infinite', 'adj./n.', '无限的，无穷的；无限', '话题', ['科技创新话题词'], ['无限的，无穷的；无限'], ['infinite is common in 科技创新 topics.']],
  ['informative', 'adj.', '提供信息的', '话题', ['科技创新话题词'], ['提供信息的'], ['informative is common in 科技创新 topics.']],
  ['logical', 'adj.', '符合逻辑的', '话题', ['科技创新话题词'], ['符合逻辑的'], ['logical is common in 科技创新 topics.']],
  ['mechanical', 'adj.', '机械的，呆板的', '话题', ['科技创新话题词'], ['机械的，呆板的'], ['mechanical is common in 科技创新 topics.']],
  ['mathematics', 'n.', '数学', '话题', ['科技创新话题词'], ['数学'], ['mathematics is common in 科技创新 topics.']],
  ['statistic', 'n.', '统计数值', '话题', ['科技创新话题词'], ['统计数值'], ['statistic is common in 科技创新 topics.']],
  ['measurement', 'n.', '测量，衡量，尺寸，大小', '话题', ['科技创新话题词'], ['测量，衡量，尺寸，大小'], ['measurement is common in 科技创新 topics.']],
  ['monitor', 'v./n.', '监控；监测仪器', '话题', ['科技创新话题词'], ['监控；监测仪器'], ['monitor is common in 科技创新 topics.']],
  ['navigation', 'n.', '航行，航海，导航', '话题', ['科技创新话题词'], ['航行，航海，导航'], ['navigation is common in 科技创新 topics.']],
  ['optical', 'adj.', '视觉的，光学的', '话题', ['科技创新话题词'], ['视觉的，光学的'], ['optical is common in 科技创新 topics.']],
  ['pesticide', 'n.', '杀虫剂，农药', '话题', ['科技创新话题词'], ['杀虫剂，农药'], ['pesticide is common in 科技创新 topics.']],
  ['precise', 'adj.', '精确的，准确的，认真的', '话题', ['科技创新话题词'], ['精确的，准确的，认真的'], ['precise is common in 科技创新 topics.']],
  ['psychological', 'adj.', '心理(学)的', '话题', ['科技创新话题词'], ['心理(学)的'], ['psychological is common in 科技创新 topics.']],
  ['phenomenon', 'n.', '现象，非凡的人或事物', '话题', ['科技创新话题词'], ['现象，非凡的人或事物'], ['phenomenon is common in 科技创新 topics.']],
  ['revolution', 'n.', '革命；变革', '话题', ['科技创新话题词'], ['革命；变革'], ['revolution is common in 科技创新 topics.']],
  ['solar', 'adj.', '太阳的，太阳能的', '话题', ['科技创新话题词'], ['太阳的，太阳能的'], ['solar is common in 科技创新 topics.']],
  ['solid', 'adj./n.', '固体的；固体，实心', '话题', ['科技创新话题词'], ['固体的；固体，实心'], ['solid is common in 科技创新 topics.']],
  ['sustainability', 'n.', '持续性，永续性', '话题', ['科技创新话题词'], ['持续性，永续性'], ['sustainability is common in 科技创新 topics.']],
  ['sustainable', 'adj.', '可持续的', '话题', ['科技创新话题词'], ['可持续的'], ['sustainable is common in 科技创新 topics.']],
  ['transform', 'v.', '使改变形态', '话题', ['科技创新话题词'], ['使改变形态'], ['transform is common in 科技创新 topics.']],
  ['universal', 'adj./n.', '通用的，宇宙的；通用', '话题', ['科技创新话题词'], ['通用的，宇宙的；通用'], ['universal is common in 科技创新 topics.']],
  ['understandable', 'adj.', '能懂的，可理解的', '话题', ['科技创新话题词'], ['能懂的，可理解的'], ['understandable is common in 科技创新 topics.']],
  ['visual', 'adj./n.', '视觉的；可视化', '话题', ['科技创新话题词'], ['视觉的；可视化'], ['visual is common in 科技创新 topics.']],
  ['algorithm', 'n.', '算法', '话题', ['科技创新话题词'], ['算法'], ['algorithm is common in 科技创新 topics.']],
  ['big data', 'n.', '大数据', '话题', ['科技创新话题词'], ['大数据'], ['big data is common in 科技创新 topics.']],
  ['cloud computing', 'n.', '云计算', '话题', ['科技创新话题词'], ['云计算'], ['cloud computing is common in 科技创新 topics.']],
  ['deep learning', 'n.', '深度学习', '话题', ['科技创新话题词'], ['深度学习'], ['deep learning is common in 科技创新 topics.']],
  ['facial recognition', 'n.', '面部识别', '话题', ['科技创新话题词'], ['面部识别'], ['facial recognition is common in 科技创新 topics.']],
  ['intelligent device', 'n.', '智能设备', '话题', ['科技创新话题词'], ['智能设备'], ['intelligent device is common in 科技创新 topics.']],
  ['machine learning', 'n.', '机器学习', '话题', ['科技创新话题词'], ['机器学习'], ['machine learning is common in 科技创新 topics.']],
  ['neural network', 'n.', '神经网络', '话题', ['科技创新话题词'], ['神经网络'], ['neural network is common in 科技创新 topics.']],
  ['augmented', 'n.', '增强现实', '话题', ['科技创新话题词'], ['增强现实'], ['augmented is common in 科技创新 topics.']],
  ['cybersecurity', 'n.', '网络安全', '话题', ['科技创新话题词'], ['网络安全'], ['cybersecurity is common in 科技创新 topics.']],
  ['data privacy', 'n.', '数据隐私', '话题', ['科技创新话题词'], ['数据隐私'], ['data privacy is common in 科技创新 topics.']],
  ['drone', 'n.', '无人机', '话题', ['科技创新话题词'], ['无人机'], ['drone is common in 科技创新 topics.']],
  ['nanotechnology', 'n.', '纳米技术', '话题', ['科技创新话题词'], ['纳米技术'], ['nanotechnology is common in 科技创新 topics.']],
  ['biometrics', 'n.', '生物识别技术', '话题', ['科技创新话题词'], ['生物识别技术'], ['biometrics is common in 科技创新 topics.']],
  ['blockchain', 'n.', '区块链', '话题', ['科技创新话题词'], ['区块链'], ['blockchain is common in 科技创新 topics.']],
  ['smart home', 'n.', '智能家居', '话题', ['科技创新话题词'], ['智能家居'], ['smart home is common in 科技创新 topics.']]
];

// 536话题词汇 - 情感社科
const seedWords536_情感社科 = [
  ['aggressive', 'adj.', '挑衅的；积极进取的', '话题', ['情感社科话题词'], ['挑衅的；积极进取的'], ['aggressive is common in 情感社科 topics.']],
  ['assertiveness', 'n.', '魄力；自信', '话题', ['情感社科话题词'], ['魄力；自信'], ['assertiveness is common in 情感社科 topics.']],
  ['anxiety', 'n.', '忧虑，焦虑；渴望', '话题', ['情感社科话题词'], ['忧虑，焦虑；渴望'], ['anxiety is common in 情感社科 topics.']],
  ['bully', 'v.', '恐吓，威逼', '话题', ['情感社科话题词'], ['恐吓，威逼'], ['bully is common in 情感社科 topics.']],
  ['competitive', 'adj.', '竞争的；有竞争力的', '话题', ['情感社科话题词'], ['竞争的；有竞争力的'], ['competitive is common in 情感社科 topics.']],
  ['complex', 'adj./n.', '复杂的；复合体', '话题', ['情感社科话题词'], ['复杂的；复合体'], ['complex is common in 情感社科 topics.']],
  ['conceited', 'adj.', '自负的，傲慢的', '话题', ['情感社科话题词'], ['自负的，傲慢的'], ['conceited is common in 情感社科 topics.']],
  ['cyberbullying', 'n.', '网上欺凌', '话题', ['情感社科话题词'], ['网上欺凌'], ['cyberbullying is common in 情感社科 topics.']],
  ['deprivation', 'n.', '剥夺；丧失；匮乏', '话题', ['情感社科话题词'], ['剥夺；丧失；匮乏'], ['deprivation is common in 情感社科 topics.']],
  ['emotional intelligence', 'n.', '情绪智力', '话题', ['情感社科话题词'], ['情绪智力'], ['emotional intelligence is common in 情感社科 topics.']],
  ['empathy', 'n.', '〈心〉移情作用；同感', '话题', ['情感社科话题词'], ['〈心〉移情作用；同感'], ['empathy is common in 情感社科 topics.']],
  ['extracurricular', 'adj.', '课外的', '话题', ['情感社科话题词'], ['课外的'], ['extracurricular is common in 情感社科 topics.']],
  ['intolerable', 'adj.', '无法容忍的；难堪的', '话题', ['情感社科话题词'], ['无法容忍的；难堪的'], ['intolerable is common in 情感社科 topics.']],
  ['lonely', 'adj.', '孤独的；寂寞的；偏僻的', '话题', ['情感社科话题词'], ['孤独的；寂寞的；偏僻的'], ['lonely is common in 情感社科 topics.']],
  ['mental health', 'n.', '心理健康', '话题', ['情感社科话题词'], ['心理健康'], ['mental health is common in 情感社科 topics.']],
  ['misunderstand', 'v.', '误解', '话题', ['情感社科话题词'], ['误解'], ['misunderstand is common in 情感社科 topics.']],
  ['motivation', 'n.', '动力；积极性', '话题', ['情感社科话题词'], ['动力；积极性'], ['motivation is common in 情感社科 topics.']],
  ['overwhelming', 'adj.', '势不可挡的', '话题', ['情感社科话题词'], ['势不可挡的'], ['overwhelming is common in 情感社科 topics.']],
  ['popularization', 'n.', '普及', '话题', ['情感社科话题词'], ['普及'], ['popularization is common in 情感社科 topics.']],
  ['neglect', 'v./n.', '疏忽；忽略；怠慢', '话题', ['情感社科话题词'], ['疏忽；忽略；怠慢'], ['neglect is common in 情感社科 topics.']],
  ['psychology', 'n.', '心理(学)；思想', '话题', ['情感社科话题词'], ['心理(学)；思想'], ['psychology is common in 情感社科 topics.']],
  ['psychologist', 'n.', '心理学家', '话题', ['情感社科话题词'], ['心理学家'], ['psychologist is common in 情感社科 topics.']],
  ['psychological problem', 'n.', '心理问题', '话题', ['情感社科话题词'], ['心理问题'], ['psychological problem is common in 情感社科 topics.']],
  ['respect', 'n./v.', '尊敬；遵守', '话题', ['情感社科话题词'], ['尊敬；遵守'], ['respect is common in 情感社科 topics.']],
  ['solitude', 'n.', '单独，孤独', '话题', ['情感社科话题词'], ['单独，孤独'], ['solitude is common in 情感社科 topics.']],
  ['stress', 'n./v.', '压力；强调；紧张', '话题', ['情感社科话题词'], ['压力；强调；紧张'], ['stress is common in 情感社科 topics.']],
  ['suspect', 'v.', '猜想，觉得；怀疑', '话题', ['情感社科话题词'], ['猜想，觉得；怀疑'], ['suspect is common in 情感社科 topics.']],
  ['self-esteem', 'n.', '自尊；自大；傲骨', '话题', ['情感社科话题词'], ['自尊；自大；傲骨'], ['self-esteem is common in 情感社科 topics.']],
  ['suicidal thoughts', 'n.', '自杀念头', '话题', ['情感社科话题词'], ['自杀念头'], ['suicidal thoughts is common in 情感社科 topics.']],
  ['sympathetic', 'adj.', '同情的；赞同的', '话题', ['情感社科话题词'], ['同情的；赞同的'], ['sympathetic is common in 情感社科 topics.']],
  ['supportive', 'adj.', '支持的，拥护的，赞助的', '话题', ['情感社科话题词'], ['支持的，拥护的，赞助的'], ['supportive is common in 情感社科 topics.']],
  ['social exclusion', 'n.', '社会排斥', '话题', ['情感社科话题词'], ['社会排斥'], ['social exclusion is common in 情感社科 topics.']],
  ['societal expectations', 'n.', '社会期望', '话题', ['情感社科话题词'], ['社会期望'], ['societal expectations is common in 情感社科 topics.']],
  ['stability', 'n.', '稳定；坚定，恒心', '话题', ['情感社科话题词'], ['稳定；坚定，恒心'], ['stability is common in 情感社科 topics.']],
  ['verbal abuse', 'n.', '言语虐待', '话题', ['情感社科话题词'], ['言语虐待'], ['verbal abuse is common in 情感社科 topics.']],
  ['victim', 'n.', '受害者；牺牲品', '话题', ['情感社科话题词'], ['受害者；牺牲品'], ['victim is common in 情感社科 topics.']],
  ['grief', 'n.', '悲伤，悲痛', '话题', ['情感社科话题词'], ['悲伤，悲痛'], ['grief is common in 情感社科 topics.']],
  ['jealousy', 'n.', '嫉妒，妒忌', '话题', ['情感社科话题词'], ['嫉妒，妒忌'], ['jealousy is common in 情感社科 topics.']],
  ['contentment', 'n.', '满足，满意', '话题', ['情感社科话题词'], ['满足，满意'], ['contentment is common in 情感社科 topics.']],
  ['enthusiasm', 'n.', '热情，热忱', '话题', ['情感社科话题词'], ['热情，热忱'], ['enthusiasm is common in 情感社科 topics.']],
  ['despair', 'n.', '绝望', '话题', ['情感社科话题词'], ['绝望'], ['despair is common in 情感社科 topics.']],
  ['affection', 'n.', '喜爱，爱慕', '话题', ['情感社科话题词'], ['喜爱，爱慕'], ['affection is common in 情感社科 topics.']],
  ['frustration', 'n.', '沮丧，受挫', '话题', ['情感社科话题词'], ['沮丧，受挫'], ['frustration is common in 情感社科 topics.']],
  ['optimism', 'n.', '乐观，乐观主义', '话题', ['情感社科话题词'], ['乐观，乐观主义'], ['optimism is common in 情感社科 topics.']],
  ['pessimism', 'n.', '悲观，悲观主义', '话题', ['情感社科话题词'], ['悲观，悲观主义'], ['pessimism is common in 情感社科 topics.']],
  ['acclaim', 'v./n.', '赞同，称赞', '话题', ['情感社科话题词'], ['赞同，称赞'], ['acclaim is common in 情感社科 topics.']],
  ['admiring', 'adj.', '赞赏的', '话题', ['情感社科话题词'], ['赞赏的'], ['admiring is common in 情感社科 topics.']],
  ['appreciation', 'n.', '欣赏，感激', '话题', ['情感社科话题词'], ['欣赏，感激'], ['appreciation is common in 情感社科 topics.']],
  ['appreciative', 'adj.', '感激的，欣赏的', '话题', ['情感社科话题词'], ['感激的，欣赏的'], ['appreciative is common in 情感社科 topics.']],
  ['approval', 'n.', '赞成，承认，正式批准', '话题', ['情感社科话题词'], ['赞成，承认，正式批准'], ['approval is common in 情感社科 topics.']],
  ['approving', 'adj.', '赞成的', '话题', ['情感社科话题词'], ['赞成的'], ['approving is common in 情感社科 topics.']],
  ['concerned', 'adj.', '关心的', '话题', ['情感社科话题词'], ['关心的'], ['concerned is common in 情感社科 topics.']],
  ['compensatory', 'adj.', '补偿的，赔偿的', '话题', ['情感社科话题词'], ['补偿的，赔偿的'], ['compensatory is common in 情感社科 topics.']],
  ['consent', 'v./n.', '同意', '话题', ['情感社科话题词'], ['同意'], ['consent is common in 情感社科 topics.']],
  ['confident', 'adj.', '自信的，有信心的', '话题', ['情感社科话题词'], ['自信的，有信心的'], ['confident is common in 情感社科 topics.']],
  ['defensive', 'adj.', '为…而辩护', '话题', ['情感社科话题词'], ['为…而辩护'], ['defensive is common in 情感社科 topics.']],
  ['desirable', 'adj.', '值得拥有的，令人满意的', '话题', ['情感社科话题词'], ['值得拥有的，令人满意的'], ['desirable is common in 情感社科 topics.']],
  ['enthusiastic', 'adj.', '热情的，积极性的，狂热的', '话题', ['情感社科话题词'], ['热情的，积极性的，狂热的'], ['enthusiastic is common in 情感社科 topics.']],
  ['favorable', 'adj.', '赞成的，有利的，赞许的', '话题', ['情感社科话题词'], ['赞成的，有利的，赞许的'], ['favorable is common in 情感社科 topics.']],
  ['frank', 'adj.', '坦白的，真诚的，直率的', '话题', ['情感社科话题词'], ['坦白的，真诚的，直率的'], ['frank is common in 情感社科 topics.']],
  ['humorous', 'adj.', '幽默的', '话题', ['情感社科话题词'], ['幽默的'], ['humorous is common in 情感社科 topics.']],
  ['instructive', 'adj.', '有教育意义的', '话题', ['情感社科话题词'], ['有教育意义的'], ['instructive is common in 情感社科 topics.']],
  ['influential', 'adj.', '有影响的', '话题', ['情感社科话题词'], ['有影响的'], ['influential is common in 情感社科 topics.']],
  ['modest', 'adj.', '谦虚的，适度的', '话题', ['情感社科话题词'], ['谦虚的，适度的'], ['modest is common in 情感社科 topics.']],
  ['positive', 'adj.', '肯定的，积极的，实际的', '话题', ['情感社科话题词'], ['肯定的，积极的，实际的'], ['positive is common in 情感社科 topics.']],
  ['profound', 'adj.', '意义深远的', '话题', ['情感社科话题词'], ['意义深远的'], ['profound is common in 情感社科 topics.']],
  ['rewarding', 'adj.', '有回报的', '话题', ['情感社科话题词'], ['有回报的'], ['rewarding is common in 情感社科 topics.']],
  ['respectable', 'adj.', '可敬的，可观的，体面的', '话题', ['情感社科话题词'], ['可敬的，可观的，体面的'], ['respectable is common in 情感社科 topics.']],
  ['satisfaction', 'n.', '满意，满足', '话题', ['情感社科话题词'], ['满意，满足'], ['satisfaction is common in 情感社科 topics.']],
  ['soothing', 'adj.', '镇静的，慰藉的', '话题', ['情感社科话题词'], ['镇静的，慰藉的'], ['soothing is common in 情感社科 topics.']],
  ['sympathy', 'n.', '同情，同情心，同感，赞同', '话题', ['情感社科话题词'], ['同情，同情心，同感，赞同'], ['sympathy is common in 情感社科 topics.']],
  ['talented', 'adj.', '有才能的，有天赋的', '话题', ['情感社科话题词'], ['有才能的，有天赋的'], ['talented is common in 情感社科 topics.']],
  ['tolerance', 'n.', '宽容，容忍', '话题', ['情感社科话题词'], ['宽容，容忍'], ['tolerance is common in 情感社科 topics.']],
  ['tolerant', 'adj.', '宽容的，容忍的', '话题', ['情感社科话题词'], ['宽容的，容忍的'], ['tolerant is common in 情感社科 topics.']],
  ['understanding', 'n.', '了解，认识，谅解', '话题', ['情感社科话题词'], ['了解，认识，谅解'], ['understanding is common in 情感社科 topics.']],
  ['ambiguous', 'adj.', '模棱两可的', '话题', ['情感社科话题词'], ['模棱两可的'], ['ambiguous is common in 情感社科 topics.']],
  ['arbitrary', 'adj.', '武断的', '话题', ['情感社科话题词'], ['武断的'], ['arbitrary is common in 情感社科 topics.']],
  ['arrogant', 'adj.', '傲慢的，自大的', '话题', ['情感社科话题词'], ['傲慢的，自大的'], ['arrogant is common in 情感社科 topics.']],
  ['biased', 'adj.', '有偏见的', '话题', ['情感社科话题词'], ['有偏见的'], ['biased is common in 情感社科 topics.']],
  ['contempt', 'n.', '轻视，耻辱', '话题', ['情感社科话题词'], ['轻视，耻辱'], ['contempt is common in 情感社科 topics.']],
  ['contemptuous', 'adj.', '轻视的', '话题', ['情感社科话题词'], ['轻视的'], ['contemptuous is common in 情感社科 topics.']],
  ['cynical', 'adj.', '愤世嫉俗的', '话题', ['情感社科话题词'], ['愤世嫉俗的'], ['cynical is common in 情感社科 topics.']],
  ['disgust', 'n./v.', '厌恶，反感', '话题', ['情感社科话题词'], ['厌恶，反感'], ['disgust is common in 情感社科 topics.']],
  ['disappointed', 'adj.', '失望的', '话题', ['情感社科话题词'], ['失望的'], ['disappointed is common in 情感社科 topics.']],
  ['detestation', 'n.', '憎恶，厌恶', '话题', ['情感社科话题词'], ['憎恶，厌恶'], ['detestation is common in 情感社科 topics.']],
  ['disapproval', 'n.', '不赞成', '话题', ['情感社科话题词'], ['不赞成'], ['disapproval is common in 情感社科 topics.']],
  ['doubtful', 'adj.', '可疑的，怀疑的', '话题', ['情感社科话题词'], ['可疑的，怀疑的'], ['doubtful is common in 情感社科 topics.']],
  ['enraged', 'adj.', '激怒的', '话题', ['情感社科话题词'], ['激怒的'], ['enraged is common in 情感社科 topics.']],
  ['guilty', 'adj.', '有罪的，内疚的', '话题', ['情感社科话题词'], ['有罪的，内疚的'], ['guilty is common in 情感社科 topics.']],
  ['hesitancy', 'n.', '犹豫', '话题', ['情感社科话题词'], ['犹豫'], ['hesitancy is common in 情感社科 topics.']],
  ['hesitant', 'adj.', '犹豫的，不愿的', '话题', ['情感社科话题词'], ['犹豫的，不愿的'], ['hesitant is common in 情感社科 topics.']],
  ['harmful', 'adj.', '有害的', '话题', ['情感社科话题词'], ['有害的'], ['harmful is common in 情感社科 topics.']],
  ['hostile', 'adj.', '有敌意的', '话题', ['情感社科话题词'], ['有敌意的'], ['hostile is common in 情感社科 topics.']],
  ['impulsive', 'adj.', '冲动的，任性的', '话题', ['情感社科话题词'], ['冲动的，任性的'], ['impulsive is common in 情感社科 topics.']],
  ['indignation', 'n.', '愤慨', '话题', ['情感社科话题词'], ['愤慨'], ['indignation is common in 情感社科 topics.']],
  ['indulgence', 'n.', '沉溺，放纵', '话题', ['情感社科话题词'], ['沉溺，放纵'], ['indulgence is common in 情感社科 topics.']],
  ['insulted', 'adj.', '受辱的，辱骂的', '话题', ['情感社科话题词'], ['受辱的，辱骂的'], ['insulted is common in 情感社科 topics.']],
  ['ironic', 'adj.', '讽刺的', '话题', ['情感社科话题词'], ['讽刺的'], ['ironic is common in 情感社科 topics.']],
  ['misleading', 'adj.', '令人误解的', '话题', ['情感社科话题词'], ['令人误解的'], ['misleading is common in 情感社科 topics.']],
  ['negative', 'adj.', '否定的，消极的，阴性的', '话题', ['情感社科话题词'], ['否定的，消极的，阴性的'], ['negative is common in 情感社科 topics.']],
  ['objection', 'n.', '异议', '话题', ['情感社科话题词'], ['异议'], ['objection is common in 情感社科 topics.']],
  ['opposition', 'n.', '反对', '话题', ['情感社科话题词'], ['反对'], ['opposition is common in 情感社科 topics.']],
  ['opposed', 'adj.', '反对的', '话题', ['情感社科话题词'], ['反对的'], ['opposed is common in 情感社科 topics.']],
  ['depressed', 'adj.', '沮丧的', '话题', ['情感社科话题词'], ['沮丧的'], ['depressed is common in 情感社科 topics.']],
  ['pessimistic', 'adj.', '悲观的', '话题', ['情感社科话题词'], ['悲观的'], ['pessimistic is common in 情感社科 topics.']],
  ['reluctant', 'adj.', '不情愿的', '话题', ['情感社科话题词'], ['不情愿的'], ['reluctant is common in 情感社科 topics.']],
  ['radical', 'adj.', '激进的', '话题', ['情感社科话题词'], ['激进的'], ['radical is common in 情感社科 topics.']],
  ['self-centered', 'adj.', '以自我为中心的，自私的', '话题', ['情感社科话题词'], ['以自我为中心的，自私的'], ['self-centered is common in 情感社科 topics.']],
  ['unwilling', 'adj.', '不情愿的', '话题', ['情感社科话题词'], ['不情愿的'], ['unwilling is common in 情感社科 topics.']],
  ['undesirable', 'adj.', '不受欢迎的，不合意的', '话题', ['情感社科话题词'], ['不受欢迎的，不合意的'], ['undesirable is common in 情感社科 topics.']],
  ['uneasy', 'adj.', '心神不安的', '话题', ['情感社科话题词'], ['心神不安的'], ['uneasy is common in 情感社科 topics.']],
  ['unworthy', 'adj.', '不值得的，无价值的', '话题', ['情感社科话题词'], ['不值得的，无价值的'], ['unworthy is common in 情感社科 topics.']],
  ['worried', 'adj.', '闷闷不乐的，焦虑的', '话题', ['情感社科话题词'], ['闷闷不乐的，焦虑的'], ['worried is common in 情感社科 topics.']],
  ['warning', 'adj.', '警告的，引以为戒的', '话题', ['情感社科话题词'], ['警告的，引以为戒的'], ['warning is common in 情感社科 topics.']],
  ['conservative', 'adj.', '保守的', '话题', ['情感社科话题词'], ['保守的'], ['conservative is common in 情感社科 topics.']],
  ['disinterested', 'adj.', '无私的', '话题', ['情感社科话题词'], ['无私的'], ['disinterested is common in 情感社科 topics.']],
  ['factual', 'adj.', '事实的', '话题', ['情感社科话题词'], ['事实的'], ['factual is common in 情感社科 topics.']],
  ['impartial', 'adj.', '公平的，不偏不倚的', '话题', ['情感社科话题词'], ['公平的，不偏不倚的'], ['impartial is common in 情感社科 topics.']],
  ['objective', 'adj./n.', '客观的；目标', '话题', ['情感社科话题词'], ['客观的；目标'], ['objective is common in 情感社科 topics.']],
  ['objectiveness', 'n.', '客观性', '话题', ['情感社科话题词'], ['客观性'], ['objectiveness is common in 情感社科 topics.']],
  ['unbiased', 'adj.', '没有偏见的', '话题', ['情感社科话题词'], ['没有偏见的'], ['unbiased is common in 情感社科 topics.']],
  ['unprejudiced', 'adj.', '公平的，无偏见的，没有成见的', '话题', ['情感社科话题词'], ['公平的，无偏见的，没有成见的'], ['unprejudiced is common in 情感社科 topics.']],
  ['apprehensive', 'adj.', '担心的', '话题', ['情感社科话题词'], ['担心的'], ['apprehensive is common in 情感社科 topics.']],
  ['critical', 'adj.', '批评的，挑剔的，决定性的', '话题', ['情感社科话题词'], ['批评的，挑剔的，决定性的'], ['critical is common in 情感社科 topics.']],
  ['criticism', 'n.', '批评', '话题', ['情感社科话题词'], ['批评'], ['criticism is common in 情感社科 topics.']],
  ['cautious', 'adj.', '谨慎的', '话题', ['情感社科话题词'], ['谨慎的'], ['cautious is common in 情感社科 topics.']],
  ['cautiousness', 'n.', '谨慎，小心', '话题', ['情感社科话题词'], ['谨慎，小心'], ['cautiousness is common in 情感社科 topics.']],
  ['curiosity', 'n.', '好奇，好奇心', '话题', ['情感社科话题词'], ['好奇，好奇心'], ['curiosity is common in 情感社科 topics.']],
  ['compromising', 'adj.', '妥协的', '话题', ['情感社科话题词'], ['妥协的'], ['compromising is common in 情感社科 topics.']],
  ['dissatisfied', 'adj.', '不满意的', '话题', ['情感社科话题词'], ['不满意的'], ['dissatisfied is common in 情感社科 topics.']],
  ['discontent', 'adj./n.', '不满的；不满', '话题', ['情感社科话题词'], ['不满的；不满'], ['discontent is common in 情感社科 topics.']],
  ['formal', 'adj.', '正式的', '话题', ['情感社科话题词'], ['正式的'], ['formal is common in 情感社科 topics.']],
  ['informative', 'adj.', '提供资讯的', '话题', ['情感社科话题词'], ['提供资讯的'], ['informative is common in 情感社科 topics.']],
  ['informal', 'adj.', '非正式的', '话题', ['情感社科话题词'], ['非正式的'], ['informal is common in 情感社科 topics.']],
  ['intolerant', 'adj.', '不能容忍的，偏执的', '话题', ['情感社科话题词'], ['不能容忍的，偏执的'], ['intolerant is common in 情感社科 topics.']],
  ['puzzled', 'adj.', '困惑的，迷惑的', '话题', ['情感社科话题词'], ['困惑的，迷惑的'], ['puzzled is common in 情感社科 topics.']],
  ['subjective', 'adj.', '主观的', '话题', ['情感社科话题词'], ['主观的'], ['subjective is common in 情感社科 topics.']],
  ['sensitive', 'adj.', '敏感的', '话题', ['情感社科话题词'], ['敏感的'], ['sensitive is common in 情感社科 topics.']],
  ['dubious', 'adj.', '怀疑的', '话题', ['情感社科话题词'], ['怀疑的'], ['dubious is common in 情感社科 topics.']],
  ['questioning', 'adj.', '质疑的', '话题', ['情感社科话题词'], ['质疑的'], ['questioning is common in 情感社科 topics.']],
  ['questionable', 'adj.', '可疑的', '话题', ['情感社科话题词'], ['可疑的'], ['questionable is common in 情感社科 topics.']],
  ['skeptical', 'adj.', '怀疑的', '话题', ['情感社科话题词'], ['怀疑的'], ['skeptical is common in 情感社科 topics.']],
  ['skepticism', 'n.', '怀疑', '话题', ['情感社科话题词'], ['怀疑'], ['skepticism is common in 情感社科 topics.']],
  ['suspicion', 'n.', '怀疑，猜疑', '话题', ['情感社科话题词'], ['怀疑，猜疑'], ['suspicion is common in 情感社科 topics.']],
  ['uncertain', 'adj.', '态度不明的', '话题', ['情感社科话题词'], ['态度不明的'], ['uncertain is common in 情感社科 topics.']],
  ['unclear', 'adj.', '不确定的', '话题', ['情感社科话题词'], ['不确定的'], ['unclear is common in 情感社科 topics.']],
  ['discrimination', 'n.', '歧视', '话题', ['情感社科话题词'], ['歧视'], ['discrimination is common in 情感社科 topics.']],
  ['discriminated', 'adj.', '歧视的', '话题', ['情感社科话题词'], ['歧视的'], ['discriminated is common in 情感社科 topics.']],
  ['prejudiced', 'adj.', '偏见的', '话题', ['情感社科话题词'], ['偏见的'], ['prejudiced is common in 情感社科 topics.']],
  ['bias', 'n.', '偏见', '话题', ['情感社科话题词'], ['偏见'], ['bias is common in 情感社科 topics.']],
  ['unfair', 'adj.', '不公平的，不公正的', '话题', ['情感社科话题词'], ['不公平的，不公正的'], ['unfair is common in 情感社科 topics.']],
  ['scornful', 'adj.', '轻蔑的，鄙视的', '话题', ['情感社科话题词'], ['轻蔑的，鄙视的'], ['scornful is common in 情感社科 topics.']],
  ['inequality', 'n.', '不平等', '话题', ['情感社科话题词'], ['不平等'], ['inequality is common in 情感社科 topics.']],
  ['indifference', 'n.', '漠不关心', '话题', ['情感社科话题词'], ['漠不关心'], ['indifference is common in 情感社科 topics.']],
  ['indifferent', 'adj.', '漠不关心的', '话题', ['情感社科话题词'], ['漠不关心的'], ['indifferent is common in 情感社科 topics.']],
  ['uninterested', 'adj.', '不感兴趣的', '话题', ['情感社科话题词'], ['不感兴趣的'], ['uninterested is common in 情感社科 topics.']],
  ['unconcerned', 'adj.', '不关心的', '话题', ['情感社科话题词'], ['不关心的'], ['unconcerned is common in 情感社科 topics.']],
  ['carefree', 'adj.', '不关心的', '话题', ['情感社科话题词'], ['不关心的'], ['carefree is common in 情感社科 topics.']],
  ['uncertainty', 'n.', '不确定', '话题', ['情感社科话题词'], ['不确定'], ['uncertainty is common in 情感社科 topics.']],
  ['confused', 'adj.', '困惑的', '话题', ['情感社科话题词'], ['困惑的'], ['confused is common in 情感社科 topics.']],
  ['permissive', 'adj.', '放纵的', '话题', ['情感社科话题词'], ['放纵的'], ['permissive is common in 情感社科 topics.']],
  ['desperate', 'adj.', '绝望的', '话题', ['情感社科话题词'], ['绝望的'], ['desperate is common in 情感社科 topics.']],
  ['destructive', 'adj.', '破坏性的，毁灭性的', '话题', ['情感社科话题词'], ['破坏性的，毁灭性的'], ['destructive is common in 情感社科 topics.']],
  ['mocking', 'adj.', '嘲讽的', '话题', ['情感社科话题词'], ['嘲讽的'], ['mocking is common in 情感社科 topics.']],
  ['strongly', 'adv.', '强烈地，强有力的', '话题', ['情感社科话题词'], ['强烈地，强有力的'], ['strongly is common in 情感社科 topics.']],
  ['sacrifice', 'v./n.', '牺牲；献祭', '话题', ['情感社科话题词'], ['牺牲；献祭'], ['sacrifice is common in 情感社科 topics.']],
  ['sacrificial', 'adj.', '牺牲的', '话题', ['情感社科话题词'], ['牺牲的'], ['sacrificial is common in 情感社科 topics.']],
  ['accompany', 'v.', '陪同，陪伴；伴随', '话题', ['情感社科话题词'], ['陪同，陪伴；伴随'], ['accompany is common in 情感社科 topics.']],
  ['advantageous', 'adj.', '有利的；有好处的', '话题', ['情感社科话题词'], ['有利的；有好处的'], ['advantageous is common in 情感社科 topics.']],
  ['assess', 'v.', '评估；估算', '话题', ['情感社科话题词'], ['评估；估算'], ['assess is common in 情感社科 topics.']],
  ['bankrupt', 'adj.', '破产的', '话题', ['情感社科话题词'], ['破产的'], ['bankrupt is common in 情感社科 topics.']],
  ['behavioural patterns', 'n.', '行为模式', '话题', ['情感社科话题词'], ['行为模式'], ['behavioural patterns is common in 情感社科 topics.']],
  ['biography', 'n.', '传记', '话题', ['情感社科话题词'], ['传记'], ['biography is common in 情感社科 topics.']],
  ['boost', 'v.', '提高；推动；使增长', '话题', ['情感社科话题词'], ['提高；推动；使增长'], ['boost is common in 情感社科 topics.']],
  ['chaos', 'n.', '混乱，杂乱', '话题', ['情感社科话题词'], ['混乱，杂乱'], ['chaos is common in 情感社科 topics.']],
  ['civilize', 'v.', '使文明，开化', '话题', ['情感社科话题词'], ['使文明，开化'], ['civilize is common in 情感社科 topics.']],
  ['cruelty', 'n.', '残酷，虐待；不公', '话题', ['情感社科话题词'], ['残酷，虐待；不公'], ['cruelty is common in 情感社科 topics.']],
  ['comprehension', 'n.', '理解', '话题', ['情感社科话题词'], ['理解'], ['comprehension is common in 情感社科 topics.']],
  ['consciousness', 'n.', '意识；观念', '话题', ['情感社科话题词'], ['意识；观念'], ['consciousness is common in 情感社科 topics.']],
  ['coordination', 'n.', '协调', '话题', ['情感社科话题词'], ['协调'], ['coordination is common in 情感社科 topics.']],
  ['community', 'n.', '社会(团体)', '话题', ['情感社科话题词'], ['社会(团体)'], ['community is common in 情感社科 topics.']],
  ['celebrity', 'n.', '名人', '话题', ['情感社科话题词'], ['名人'], ['celebrity is common in 情感社科 topics.']],
  ['critically', 'adv.', '批判性地', '话题', ['情感社科话题词'], ['批判性地'], ['critically is common in 情感社科 topics.']],
  ['depressed', 'adj.', '萧条的', '话题', ['情感社科话题词'], ['萧条的'], ['depressed is common in 情感社科 topics.']],
  ['discipline', 'n.', '纪律', '话题', ['情感社科话题词'], ['纪律'], ['discipline is common in 情感社科 topics.']],
  ['dishonest', 'adj.', '不诚实的', '话题', ['情感社科话题词'], ['不诚实的'], ['dishonest is common in 情感社科 topics.']],
  ['efficient', 'adj.', '效率高的', '话题', ['情感社科话题词'], ['效率高的'], ['efficient is common in 情感社科 topics.']],
  ['emergence', 'n.', '兴起', '话题', ['情感社科话题词'], ['兴起'], ['emergence is common in 情感社科 topics.']],
  ['financial squeeze', 'n.', '财政困难', '话题', ['情感社科话题词'], ['财政困难'], ['financial squeeze is common in 情感社科 topics.']],
  ['flourish', 'v.', '繁荣', '话题', ['情感社科话题词'], ['繁荣'], ['flourish is common in 情感社科 topics.']],
  ['genuine', 'adj.', '真的；真诚的', '话题', ['情感社科话题词'], ['真的；真诚的'], ['genuine is common in 情感社科 topics.']],
  ['humbleness', 'n.', '谦逊，粗鄙', '话题', ['情感社科话题词'], ['谦逊，粗鄙'], ['humbleness is common in 情感社科 topics.']],
  ['initiative', 'n.', '倡议，新方案', '话题', ['情感社科话题词'], ['倡议，新方案'], ['initiative is common in 情感社科 topics.']],
  ['modify', 'v.', '调整；修饰', '话题', ['情感社科话题词'], ['调整；修饰'], ['modify is common in 情感社科 topics.']],
  ['minimalism', 'n.', '最低纲领，极保守行动', '话题', ['情感社科话题词'], ['最低纲领，极保守行动'], ['minimalism is common in 情感社科 topics.']],
  ['morality', 'n.', '道德；道德观', '话题', ['情感社科话题词'], ['道德；道德观'], ['morality is common in 情感社科 topics.']],
  ['moral virtues', 'n.', '道德美德', '话题', ['情感社科话题词'], ['道德美德'], ['moral virtues is common in 情感社科 topics.']],
  ['philosophy', 'n.', '哲学；哲学思想；生活信条', '话题', ['情感社科话题词'], ['哲学；哲学思想；生活信条'], ['philosophy is common in 情感社科 topics.']],
  ['pursuit', 'n.', '追求；消遣', '话题', ['情感社科话题词'], ['追求；消遣'], ['pursuit is common in 情感社科 topics.']],
  ['religion', 'n.', '宗教；教派；心爱的事物', '话题', ['情感社科话题词'], ['宗教；教派；心爱的事物'], ['religion is common in 情感社科 topics.']],
  ['sponsor', 'n./v.', '赞助者；赞助', '话题', ['情感社科话题词'], ['赞助者；赞助'], ['sponsor is common in 情感社科 topics.']],
  ['social instincts', 'n.', '社会本能', '话题', ['情感社科话题词'], ['社会本能'], ['social instincts is common in 情感社科 topics.']],
  ['self-discipline', 'n.', '自我修养，自律', '话题', ['情感社科话题词'], ['自我修养，自律'], ['self-discipline is common in 情感社科 topics.']],
  ['strengthen', 'v.', '巩固；加强；增强', '话题', ['情感社科话题词'], ['巩固；加强；增强'], ['strengthen is common in 情感社科 topics.']],
  ['self-control', 'n.', '自控；自我克制', '话题', ['情感社科话题词'], ['自控；自我克制'], ['self-control is common in 情感社科 topics.']],
  ['tragedy', 'n.', '悲剧', '话题', ['情感社科话题词'], ['悲剧'], ['tragedy is common in 情感社科 topics.']],
  ['thrive', 'v.', '旺盛，繁荣', '话题', ['情感社科话题词'], ['旺盛，繁荣'], ['thrive is common in 情感社科 topics.']],
  ['tend', 'v.', '倾向', '话题', ['情感社科话题词'], ['倾向'], ['tend is common in 情感社科 topics.']],
  ['violent behaviours', 'n.', '暴力行为', '话题', ['情感社科话题词'], ['暴力行为'], ['violent behaviours is common in 情感社科 topics.']],
  ['social welfare', 'n.', '社会福利', '话题', ['情感社科话题词'], ['社会福利'], ['social welfare is common in 情感社科 topics.']],
  ['urbanization', 'n.', '城市化', '话题', ['情感社科话题词'], ['城市化'], ['urbanization is common in 情感社科 topics.']],
  ['population aging', 'n.', '人口老龄化', '话题', ['情感社科话题词'], ['人口老龄化'], ['population aging is common in 情感社科 topics.']],
  ['gender equality', 'n.', '性别平等', '话题', ['情感社科话题词'], ['性别平等'], ['gender equality is common in 情感社科 topics.']],
  ['poverty alleviation', 'n.', '扶贫，脱贫', '话题', ['情感社科话题词'], ['扶贫，脱贫'], ['poverty alleviation is common in 情感社科 topics.']],
  ['public service', 'n.', '公共服务', '话题', ['情感社科话题词'], ['公共服务'], ['public service is common in 情感社科 topics.']],
  ['social security', 'n.', '社会保障', '话题', ['情感社科话题词'], ['社会保障'], ['social security is common in 情感社科 topics.']],
  ['cultural integration', 'n.', '文化融合', '话题', ['情感社科话题词'], ['文化融合'], ['cultural integration is common in 情感社科 topics.']],
  ['community development', 'n.', '社区发展', '话题', ['情感社科话题词'], ['社区发展'], ['community development is common in 情感社科 topics.']],
  ['social harmony', 'n.', '社会和谐', '话题', ['情感社科话题词'], ['社会和谐'], ['social harmony is common in 情感社科 topics.']]
];

// 536话题词汇 - 医药卫生
const seedWords536_医药卫生 = [
  ['absent-minded', 'adj.', '心不在焉的，恍惚的', '话题', ['医药卫生话题词'], ['心不在焉的，恍惚的'], ['absent-minded is common in 医药卫生 topics.']],
  ['bacteria', 'n.', '（复数）细菌', '话题', ['医药卫生话题词'], ['（复数）细菌'], ['bacteria is common in 医药卫生 topics.']],
  ['bandage', 'n.', '绷带', '话题', ['医药卫生话题词'], ['绷带'], ['bandage is common in 医药卫生 topics.']],
  ['cardiovascular', 'adj.', '心血管的', '话题', ['医药卫生话题词'], ['心血管的'], ['cardiovascular is common in 医药卫生 topics.']],
  ['chronic', 'adj.', '长期的，慢性的，惯常的', '话题', ['医药卫生话题词'], ['长期的，慢性的，惯常的'], ['chronic is common in 医药卫生 topics.']],
  ['disable', 'v.', '使...失去能力', '话题', ['医药卫生话题词'], ['使...失去能力'], ['disable is common in 医药卫生 topics.']],
  ['diagnose', 'v.', '诊断；判断，诊断', '话题', ['医药卫生话题词'], ['诊断；判断，诊断'], ['diagnose is common in 医药卫生 topics.']],
  ['vitamin', 'n.', '维生素', '话题', ['医药卫生话题词'], ['维生素'], ['vitamin is common in 医药卫生 topics.']],
  ['immune', 'adj./n.', '免除的，免疫的；免疫者', '话题', ['医药卫生话题词'], ['免除的，免疫的；免疫者'], ['immune is common in 医药卫生 topics.']],
  ['oxygen', 'n.', '氧，氧气', '话题', ['医药卫生话题词'], ['氧，氧气'], ['oxygen is common in 医药卫生 topics.']],
  ['protein', 'adj./n.', '蛋白质的；蛋白质', '话题', ['医药卫生话题词'], ['蛋白质的；蛋白质'], ['protein is common in 医药卫生 topics.']],
  ['physician', 'n.', '内科医生', '话题', ['医药卫生话题词'], ['内科医生'], ['physician is common in 医药卫生 topics.']],
  ['pregnancy', 'n.', '怀孕', '话题', ['医药卫生话题词'], ['怀孕'], ['pregnancy is common in 医药卫生 topics.']],
  ['resistant', 'adj./n.', '抵抗的；抵抗者', '话题', ['医药卫生话题词'], ['抵抗的；抵抗者'], ['resistant is common in 医药卫生 topics.']],
  ['surgeon', 'n.', '外科医生', '话题', ['医药卫生话题词'], ['外科医生'], ['surgeon is common in 医药卫生 topics.']],
  ['stress', 'n./v.', '压力；强调；紧张', '话题', ['医药卫生话题词'], ['压力；强调；紧张'], ['stress is common in 医药卫生 topics.']],
  ['soothe', 'v.', '缓和，使..安静，安慰', '话题', ['医药卫生话题词'], ['缓和，使..安静，安慰'], ['soothe is common in 医药卫生 topics.']],
  ['syndrome', 'n.', '综合征；典型表现，典型行为', '话题', ['医药卫生话题词'], ['综合征；典型表现，典型行为'], ['syndrome is common in 医药卫生 topics.']],
  ['tablet', 'n.', '药片，片状物', '话题', ['医药卫生话题词'], ['药片，片状物'], ['tablet is common in 医药卫生 topics.']],
  ['vaccine', 'n.', '疫苗', '话题', ['医药卫生话题词'], ['疫苗'], ['vaccine is common in 医药卫生 topics.']],
  ['quarantine', 'n./v.', '隔离（期）；检疫', '话题', ['医药卫生话题词'], ['隔离（期）；检疫'], ['quarantine is common in 医药卫生 topics.']],
  ['epidemic prevention', 'n.', '防疫', '话题', ['医药卫生话题词'], ['防疫'], ['epidemic prevention is common in 医药卫生 topics.']],
  ['respiratory disease', 'n.', '呼吸道疾病', '话题', ['医药卫生话题词'], ['呼吸道疾病'], ['respiratory disease is common in 医药卫生 topics.']],
  ['infectious disease', 'n.', '传染病', '话题', ['医药卫生话题词'], ['传染病'], ['infectious disease is common in 医药卫生 topics.']],
  ['non - infectious disease', 'n.', '非传染病', '话题', ['医药卫生话题词'], ['非传染病'], ['non - infectious disease is common in 医药卫生 topics.']],
  ['medical care', 'n.', '医疗护理', '话题', ['医药卫生话题词'], ['医疗护理'], ['medical care is common in 医药卫生 topics.']],
  ['healthcare system', 'n.', '医疗体系', '话题', ['医药卫生话题词'], ['医疗体系'], ['healthcare system is common in 医药卫生 topics.']],
  ['diagnostic tool', 'n.', '诊断工具', '话题', ['医药卫生话题词'], ['诊断工具'], ['diagnostic tool is common in 医药卫生 topics.']],
  ['treatment plan', 'n.', '治疗方案', '话题', ['医药卫生话题词'], ['治疗方案'], ['treatment plan is common in 医药卫生 topics.']],
  ['immune system', 'n.', '免疫系统', '话题', ['医药卫生话题词'], ['免疫系统'], ['immune system is common in 医药卫生 topics.']],
  ['pathogen', 'n.', '病原体', '话题', ['医药卫生话题词'], ['病原体'], ['pathogen is common in 医药卫生 topics.']],
  ['symptom', 'n.', '症状', '话题', ['医药卫生话题词'], ['症状'], ['symptom is common in 医药卫生 topics.']],
  ['therapy', 'n.', '疗法，治疗', '话题', ['医药卫生话题词'], ['疗法，治疗'], ['therapy is common in 医药卫生 topics.']],
  ['rehabilitation', 'n.', '康复，复原', '话题', ['医药卫生话题词'], ['康复，复原'], ['rehabilitation is common in 医药卫生 topics.']]
];

// 536话题词汇 - 经济环保
const seedWords536_经济环保 = [
  ['economic recovery', 'n.', '经济复苏', '话题', ['经济环保话题词'], ['经济复苏'], ['economic recovery is common in 经济环保 topics.']],
  ['digital economy', 'n.', '数字经济', '话题', ['经济环保话题词'], ['数字经济'], ['digital economy is common in 经济环保 topics.']],
  ['supply chain', 'n.', '供应链', '话题', ['经济环保话题词'], ['供应链'], ['supply chain is common in 经济环保 topics.']],
  ['inflation', 'n.', '通货膨胀', '话题', ['经济环保话题词'], ['通货膨胀'], ['inflation is common in 经济环保 topics.']],
  ['deflation', 'n.', '通货紧缩', '话题', ['经济环保话题词'], ['通货紧缩'], ['deflation is common in 经济环保 topics.']],
  ['entrepreneurship', 'n.', '创业精神；创业', '话题', ['经济环保话题词'], ['创业精神；创业'], ['entrepreneurship is common in 经济环保 topics.']],
  ['e - commerce', 'n.', '电子商务', '话题', ['经济环保话题词'], ['电子商务'], ['e - commerce is common in 经济环保 topics.']],
  ['financial crisis', 'n.', '金融危机', '话题', ['经济环保话题词'], ['金融危机'], ['financial crisis is common in 经济环保 topics.']],
  ['economic growth', 'n.', '经济增长', '话题', ['经济环保话题词'], ['经济增长'], ['economic growth is common in 经济环保 topics.']],
  ['trade deficit', 'n.', '贸易逆差', '话题', ['经济环保话题词'], ['贸易逆差'], ['trade deficit is common in 经济环保 topics.']],
  ['trade surplus', 'n.', '贸易顺差', '话题', ['经济环保话题词'], ['贸易顺差'], ['trade surplus is common in 经济环保 topics.']],
  ['investment', 'n.', '投资', '话题', ['经济环保话题词'], ['投资'], ['investment is common in 经济环保 topics.']],
  ['consumption', 'n.', '消费', '话题', ['经济环保话题词'], ['消费'], ['consumption is common in 经济环保 topics.']],
  ['employment rate', 'n.', '就业率', '话题', ['经济环保话题词'], ['就业率'], ['employment rate is common in 经济环保 topics.']],
  ['unemployment rate', 'n.', '失业率', '话题', ['经济环保话题词'], ['失业率'], ['unemployment rate is common in 经济环保 topics.']],
  ['wetland', 'n.', '沼泽地；湿地', '话题', ['经济环保话题词'], ['沼泽地；湿地'], ['wetland is common in 经济环保 topics.']],
  ['grassland', 'n.', '草原；草地；草场', '话题', ['经济环保话题词'], ['草原；草地；草场'], ['grassland is common in 经济环保 topics.']],
  ['jungle', 'n.', '（热带）丛林，密林', '话题', ['经济环保话题词'], ['（热带）丛林，密林'], ['jungle is common in 经济环保 topics.']],
  ['soil', 'n.', '土壤；国土；领土；温床', '话题', ['经济环保话题词'], ['土壤；国土；领土；温床'], ['soil is common in 经济环保 topics.']],
  ['continent', 'n.', '大陆；陆地；洲', '话题', ['经济环保话题词'], ['大陆；陆地；洲'], ['continent is common in 经济环保 topics.']],
  ['wildlife', 'n.', '野生动植物，野生生物', '话题', ['经济环保话题词'], ['野生动植物，野生生物'], ['wildlife is common in 经济环保 topics.']],
  ['insect', 'n.', '昆虫', '话题', ['经济环保话题词'], ['昆虫'], ['insect is common in 经济环保 topics.']],
  ['microorganism', 'n.', '微生物', '话题', ['经济环保话题词'], ['微生物'], ['microorganism is common in 经济环保 topics.']],
  ['break down', 'phr.', '（使）分解', '话题', ['经济环保话题词'], ['（使）分解'], ['break down is common in 经济环保 topics.']],
  ['carbon', 'n.', '（化学元素）碳', '话题', ['经济环保话题词'], ['（化学元素）碳'], ['carbon is common in 经济环保 topics.']],
  ['oxygen', 'n.', '氧；氧气', '话题', ['经济环保话题词'], ['氧；氧气'], ['oxygen is common in 经济环保 topics.']],
  ['agriculture', 'n.', '农业；农学', '话题', ['经济环保话题词'], ['农业；农学'], ['agriculture is common in 经济环保 topics.']],
  ['climate', 'n.', '气候；倾向；思潮；风气；环境气氛', '话题', ['经济环保话题词'], ['气候；倾向；思潮；风气；环境气氛'], ['climate is common in 经济环保 topics.']],
  ['global', 'adj.', '全球的；整体的；全面的；总括的', '话题', ['经济环保话题词'], ['全球的；整体的；全面的；总括的'], ['global is common in 经济环保 topics.']],
  ['belt', 'n.', '地带；地区；腰带；传送带', '话题', ['经济环保话题词'], ['地带；地区；腰带；传送带'], ['belt is common in 经济环保 topics.']],
  ['habitat', 'n.', '（动植物的）生境，栖息地，生长地', '话题', ['经济环保话题词'], ['（动植物的）生境，栖息地，生长地'], ['habitat is common in 经济环保 topics.']],
  ['resident', 'n.', '居民；住户', '话题', ['经济环保话题词'], ['居民；住户'], ['resident is common in 经济环保 topics.']],
  ['dam', 'n.', '水坝；堤坝', '话题', ['经济环保话题词'], ['水坝；堤坝'], ['dam is common in 经济环保 topics.']],
  ['Tibetan', 'adj.', '西藏的', '话题', ['经济环保话题词'], ['西藏的'], ['Tibetan is common in 经济环保 topics.']],
  ['antelope', 'n.', '羚羊', '话题', ['经济环保话题词'], ['羚羊'], ['antelope is common in 经济环保 topics.']],
  ['ecosystem', 'n.', '生态系统', '话题', ['经济环保话题词'], ['生态系统'], ['ecosystem is common in 经济环保 topics.']],
  ['biodiversity', 'n.', '生物多样性', '话题', ['经济环保话题词'], ['生物多样性'], ['biodiversity is common in 经济环保 topics.']],
  ['hardwood', 'n.', '硬材（阔叶树的木材）', '话题', ['经济环保话题词'], ['硬材（阔叶树的木材）'], ['hardwood is common in 经济环保 topics.']],
  ['mammal', 'n.', '哺乳动物', '话题', ['经济环保话题词'], ['哺乳动物'], ['mammal is common in 经济环保 topics.']],
  ['jaguar', 'n.', '美洲豹；美洲虎', '话题', ['经济环保话题词'], ['美洲豹；美洲虎'], ['jaguar is common in 经济环保 topics.']],
  ['conservation', 'n.', '（对历史或艺术建筑的）保护；保存', '话题', ['经济环保话题词'], ['（对历史或艺术建筑的）保护；保存'], ['conservation is common in 经济环保 topics.']],
  ['canal', 'n.', '运河；灌溉渠', '话题', ['经济环保话题词'], ['运河；灌溉渠'], ['canal is common in 经济环保 topics.']],
  ['migration', 'n.', '迁移；移居；迁徙', '话题', ['经济环保话题词'], ['迁移；移居；迁徙'], ['migration is common in 经济环保 topics.']],
  ['legacy', 'n.', '遗产', '话题', ['经济环保话题词'], ['遗产'], ['legacy is common in 经济环保 topics.']],
  ['splendour', 'n.', '壮丽；美景；壮丽景色；让人印象深刻', '话题', ['经济环保话题词'], ['壮丽；美景；壮丽景色；让人印象深刻'], ['splendour is common in 经济环保 topics.']],
  ['memorable', 'adj.', '值得纪念的；难忘的', '话题', ['经济环保话题词'], ['值得纪念的；难忘的'], ['memorable is common in 经济环保 topics.']],
  ['geographical', 'adj.', '地理的', '话题', ['经济环保话题词'], ['地理的'], ['geographical is common in 经济环保 topics.']],
  ['breeze', 'n.', '微风；轻风', '话题', ['经济环保话题词'], ['微风；轻风'], ['breeze is common in 经济环保 topics.']],
  ['botanical', 'adj.', '植物的；植物学的', '话题', ['经济环保话题词'], ['植物的；植物学的'], ['botanical is common in 经济环保 topics.']],
  ['clay', 'n.', '黏土；陶土', '话题', ['经济环保话题词'], ['黏土；陶土'], ['clay is common in 经济环保 topics.']],
  ['milestone', 'n.', '重要事件；重要阶段；里程碑', '话题', ['经济环保话题词'], ['重要事件；重要阶段；里程碑'], ['milestone is common in 经济环保 topics.']],
  ['motion', 'n.', '运动；移动；动；动议；提议', '话题', ['经济环保话题词'], ['运动；移动；动；动议；提议'], ['motion is common in 经济环保 topics.']],
  ['Buddhism', 'n.', '佛教', '话题', ['经济环保话题词'], ['佛教'], ['Buddhism is common in 经济环保 topics.']],
  ['carbon neutrality', 'n.', '碳中和', '话题', ['经济环保话题词'], ['碳中和'], ['carbon neutrality is common in 经济环保 topics.']],
  ['carbon emission', 'n.', '碳排放', '话题', ['经济环保话题词'], ['碳排放'], ['carbon emission is common in 经济环保 topics.']],
  ['solar energy', 'n.', '太阳能', '话题', ['经济环保话题词'], ['太阳能'], ['solar energy is common in 经济环保 topics.']],
  ['wind energy', 'n.', '风能', '话题', ['经济环保话题词'], ['风能'], ['wind energy is common in 经济环保 topics.']],
  ['hydropower', 'n.', '水能，水力发电', '话题', ['经济环保话题词'], ['水能，水力发电'], ['hydropower is common in 经济环保 topics.']],
  ['deforestation', 'n.', '森林砍伐', '话题', ['经济环保话题词'], ['森林砍伐'], ['deforestation is common in 经济环保 topics.']],
  ['desertification', 'n.', '沙漠化', '话题', ['经济环保话题词'], ['沙漠化'], ['desertification is common in 经济环保 topics.']],
  ['water pollution', 'n.', '水污染', '话题', ['经济环保话题词'], ['水污染'], ['water pollution is common in 经济环保 topics.']],
  ['air pollution', 'n.', '空气污染', '话题', ['经济环保话题词'], ['空气污染'], ['air pollution is common in 经济环保 topics.']],
  ['soil erosion', 'n.', '土壤侵蚀', '话题', ['经济环保话题词'], ['土壤侵蚀'], ['soil erosion is common in 经济环保 topics.']],
  ['green', 'n.', '绿色发展', '话题', ['经济环保话题词'], ['绿色发展'], ['green is common in 经济环保 topics.']],
  ['waste recycling', 'n.', '废物回收', '话题', ['经济环保话题词'], ['废物回收'], ['waste recycling is common in 经济环保 topics.']]
];

// 536话题词汇 - 人物描述
const seedWords536_人物描述 = [
  ['able', 'adj.', '有才干的，能干的', '话题', ['人物描述话题词'], ['有才干的，能干的'], ['able is common in 人物描述 topics.']],
  ['active', 'adj.', '主动的，活跃的', '话题', ['人物描述话题词'], ['主动的，活跃的'], ['active is common in 人物描述 topics.']],
  ['adaptable', 'adj.', '适应性强的', '话题', ['人物描述话题词'], ['适应性强的'], ['adaptable is common in 人物描述 topics.']],
  ['aggressive', 'adj.', '有进取心的', '话题', ['人物描述话题词'], ['有进取心的'], ['aggressive is common in 人物描述 topics.']],
  ['alert', 'adj.', '机灵的', '话题', ['人物描述话题词'], ['机灵的'], ['alert is common in 人物描述 topics.']],
  ['ambitious', 'adj.', '有雄心壮志的', '话题', ['人物描述话题词'], ['有雄心壮志的'], ['ambitious is common in 人物描述 topics.']],
  ['analytical', 'adj.', '善于分析的', '话题', ['人物描述话题词'], ['善于分析的'], ['analytical is common in 人物描述 topics.']],
  ['apprehensive', 'adj.', '有理解力的', '话题', ['人物描述话题词'], ['有理解力的'], ['apprehensive is common in 人物描述 topics.']],
  ['argumentative', 'adj.', '好争辩的', '话题', ['人物描述话题词'], ['好争辩的'], ['argumentative is common in 人物描述 topics.']],
  ['aspiring', 'adj.', '有志气的，有抱负的', '话题', ['人物描述话题词'], ['有志气的，有抱负的'], ['aspiring is common in 人物描述 topics.']],
  ['attractive', 'adj.', '有魅力的，有吸引力的', '话题', ['人物描述话题词'], ['有魅力的，有吸引力的'], ['attractive is common in 人物描述 topics.']],
  ['bad-tempered', 'adj.', '脾气暴的', '话题', ['人物描述话题词'], ['脾气暴的'], ['bad-tempered is common in 人物描述 topics.']],
  ['bigmouth', 'adj.', '多嘴多舌的', '话题', ['人物描述话题词'], ['多嘴多舌的'], ['bigmouth is common in 人物描述 topics.']],
  ['bland', 'adj.', '冷漠的', '话题', ['人物描述话题词'], ['冷漠的'], ['bland is common in 人物描述 topics.']],
  ['bossy', 'adj.', '专横跋扈的', '话题', ['人物描述话题词'], ['专横跋扈的'], ['bossy is common in 人物描述 topics.']],
  ['brave', 'adj.', '勇敢的', '话题', ['人物描述话题词'], ['勇敢的'], ['brave is common in 人物描述 topics.']],
  ['brilliant', 'adj.', '有才气的，聪颖的', '话题', ['人物描述话题词'], ['有才气的，聪颖的'], ['brilliant is common in 人物描述 topics.']],
  ['capable', 'adj.', '有才能的', '话题', ['人物描述话题词'], ['有才能的'], ['capable is common in 人物描述 topics.']],
  ['caring', 'adj.', '体贴的，有同情心的', '话题', ['人物描述话题词'], ['体贴的，有同情心的'], ['caring is common in 人物描述 topics.']],
  ['cheerful', 'adj.', '开朗的', '话题', ['人物描述话题词'], ['开朗的'], ['cheerful is common in 人物描述 topics.']],
  ['childish', 'adj.', '幼稚的', '话题', ['人物描述话题词'], ['幼稚的'], ['childish is common in 人物描述 topics.']],
  ['comical', 'adj.', '滑稽的', '话题', ['人物描述话题词'], ['滑稽的'], ['comical is common in 人物描述 topics.']],
  ['competent', 'adj.', '能胜任的', '话题', ['人物描述话题词'], ['能胜任的'], ['competent is common in 人物描述 topics.']],
  ['confident', 'adj.', '有信心的', '话题', ['人物描述话题词'], ['有信心的'], ['confident is common in 人物描述 topics.']],
  ['considerate', 'adj.', '体贴的', '话题', ['人物描述话题词'], ['体贴的'], ['considerate is common in 人物描述 topics.']],
  ['constructive', 'adj.', '建设性的', '话题', ['人物描述话题词'], ['建设性的'], ['constructive is common in 人物描述 topics.']],
  ['cooperative', 'adj.', '有合作精神的', '话题', ['人物描述话题词'], ['有合作精神的'], ['cooperative is common in 人物描述 topics.']],
  ['courageous', 'adj.', '勇敢的，有胆量的', '话题', ['人物描述话题词'], ['勇敢的，有胆量的'], ['courageous is common in 人物描述 topics.']],
  ['creative', 'adj.', '富有创造力的', '话题', ['人物描述话题词'], ['富有创造力的'], ['creative is common in 人物描述 topics.']],
  ['cultured', 'adj.', '有教养的', '话题', ['人物描述话题词'], ['有教养的'], ['cultured is common in 人物描述 topics.']],
  ['dashing', 'adj.', '有一股子冲劲的', '话题', ['人物描述话题词'], ['有一股子冲劲的'], ['dashing is common in 人物描述 topics.']],
  ['demanding', 'adj.', '苛刻的', '话题', ['人物描述话题词'], ['苛刻的'], ['demanding is common in 人物描述 topics.']],
  ['determined', 'adj.', '坚决的', '话题', ['人物描述话题词'], ['坚决的'], ['determined is common in 人物描述 topics.']],
  ['devoted', 'adj.', '有献身精神的', '话题', ['人物描述话题词'], ['有献身精神的'], ['devoted is common in 人物描述 topics.']],
  ['dependable', 'adj.', '可靠的', '话题', ['人物描述话题词'], ['可靠的'], ['dependable is common in 人物描述 topics.']],
  ['depressing', 'adj.', '沉闷的', '话题', ['人物描述话题词'], ['沉闷的'], ['depressing is common in 人物描述 topics.']],
  ['disciplined', 'adj.', '守纪律的', '话题', ['人物描述话题词'], ['守纪律的'], ['disciplined is common in 人物描述 topics.']],
  ['dishonest', 'adj.', '不诚实的', '话题', ['人物描述话题词'], ['不诚实的'], ['dishonest is common in 人物描述 topics.']],
  ['disorganized', 'adj.', '无组织的', '话题', ['人物描述话题词'], ['无组织的'], ['disorganized is common in 人物描述 topics.']],
  ['dutiful', 'adj.', '尽职的', '话题', ['人物描述话题词'], ['尽职的'], ['dutiful is common in 人物描述 topics.']],
  ['easy-going', 'adj.', '随和的', '话题', ['人物描述话题词'], ['随和的'], ['easy-going is common in 人物描述 topics.']],
  ['efficient', 'adj.', '有效率的', '话题', ['人物描述话题词'], ['有效率的'], ['efficient is common in 人物描述 topics.']],
  ['energetic', 'adj.', '精力充沛的', '话题', ['人物描述话题词'], ['精力充沛的'], ['energetic is common in 人物描述 topics.']],
  ['enthusiastic', 'adj.', '充满热情的', '话题', ['人物描述话题词'], ['充满热情的'], ['enthusiastic is common in 人物描述 topics.']],
  ['expressive', 'adj.', '善于表达的', '话题', ['人物描述话题词'], ['善于表达的'], ['expressive is common in 人物描述 topics.']],
  ['faithful', 'adj.', '守信的，忠诚的', '话题', ['人物描述话题词'], ['守信的，忠诚的'], ['faithful is common in 人物描述 topics.']],
  ['forceful', 'adj.', '性格坚强的', '话题', ['人物描述话题词'], ['性格坚强的'], ['forceful is common in 人物描述 topics.']],
  ['forgetful', 'adj.', '健忘的', '话题', ['人物描述话题词'], ['健忘的'], ['forgetful is common in 人物描述 topics.']],
  ['frank', 'adj.', '直率的，真诚的', '话题', ['人物描述话题词'], ['直率的，真诚的'], ['frank is common in 人物描述 topics.']],
  ['friendly', 'adj.', '友好的', '话题', ['人物描述话题词'], ['友好的'], ['friendly is common in 人物描述 topics.']],
  ['funny', 'adj.', '有趣的，古怪的', '话题', ['人物描述话题词'], ['有趣的，古怪的'], ['funny is common in 人物描述 topics.']],
  ['generous', 'adj.', '慷慨大方的，宽宏大量的', '话题', ['人物描述话题词'], ['慷慨大方的，宽宏大量的'], ['generous is common in 人物描述 topics.']],
  ['gentle', 'adj.', '有礼貌的，绅士般的', '话题', ['人物描述话题词'], ['有礼貌的，绅士般的'], ['gentle is common in 人物描述 topics.']],
  ['greedy', 'adj.', '贪婪的', '话题', ['人物描述话题词'], ['贪婪的'], ['greedy is common in 人物描述 topics.']],
  ['hard-working', 'adj.', '勤劳的', '话题', ['人物描述话题词'], ['勤劳的'], ['hard-working is common in 人物描述 topics.']],
  ['helpful', 'adj.', '助人的，有益的', '话题', ['人物描述话题词'], ['助人的，有益的'], ['helpful is common in 人物描述 topics.']],
  ['helpless', 'adj.', '无助的，没用的', '话题', ['人物描述话题词'], ['无助的，没用的'], ['helpless is common in 人物描述 topics.']],
  ['honest', 'adj.', '诚实的', '话题', ['人物描述话题词'], ['诚实的'], ['honest is common in 人物描述 topics.']],
  ['humorous', 'adj.', '幽默的', '话题', ['人物描述话题词'], ['幽默的'], ['humorous is common in 人物描述 topics.']],
  ['inconsiderate', 'adj.', '轻率的', '话题', ['人物描述话题词'], ['轻率的'], ['inconsiderate is common in 人物描述 topics.']],
  ['independent', 'adj.', '有主见的', '话题', ['人物描述话题词'], ['有主见的'], ['independent is common in 人物描述 topics.']],
  ['initiative', 'adj.', '有首创精神的', '话题', ['人物描述话题词'], ['有首创精神的'], ['initiative is common in 人物描述 topics.']],
  ['intellective', 'adj.', '有智力的', '话题', ['人物描述话题词'], ['有智力的'], ['intellective is common in 人物描述 topics.']],
  ['inventive', 'adj.', '有发明才能的', '话题', ['人物描述话题词'], ['有发明才能的'], ['inventive is common in 人物描述 topics.']],
  ['just', 'adj.', '正直的', '话题', ['人物描述话题词'], ['正直的'], ['just is common in 人物描述 topics.']],
  ['kind-hearted', 'adj.', '好心的', '话题', ['人物描述话题词'], ['好心的'], ['kind-hearted is common in 人物描述 topics.']],
  ['knowledgeable', 'adj.', '有见识的', '话题', ['人物描述话题词'], ['有见识的'], ['knowledgeable is common in 人物描述 topics.']],
  ['learned', 'adj.', '精通某学问的', '话题', ['人物描述话题词'], ['精通某学问的'], ['learned is common in 人物描述 topics.']],
  ['loyal', 'adj.', '忠心耿耿的', '话题', ['人物描述话题词'], ['忠心耿耿的'], ['loyal is common in 人物描述 topics.']],
  ['mean', 'adj.', '吝啬的', '话题', ['人物描述话题词'], ['吝啬的'], ['mean is common in 人物描述 topics.']],
  ['methodical', 'adj.', '有方法的', '话题', ['人物描述话题词'], ['有方法的'], ['methodical is common in 人物描述 topics.']],
  ['modest', 'adj.', '谦虚的', '话题', ['人物描述话题词'], ['谦虚的'], ['modest is common in 人物描述 topics.']],
  ['moody', 'adj.', '情绪化的', '话题', ['人物描述话题词'], ['情绪化的'], ['moody is common in 人物描述 topics.']],
  ['motivated', 'adj.', '目标明确的', '话题', ['人物描述话题词'], ['目标明确的'], ['motivated is common in 人物描述 topics.']],
  ['narrow-minded', 'adj.', '心胸狭窄的', '话题', ['人物描述话题词'], ['心胸狭窄的'], ['narrow-minded is common in 人物描述 topics.']],
  ['noisy', 'adj.', '聒噪的', '话题', ['人物描述话题词'], ['聒噪的'], ['noisy is common in 人物描述 topics.']],
  ['objective', 'adj.', '客观的', '话题', ['人物描述话题词'], ['客观的'], ['objective is common in 人物描述 topics.']],
  ['open-minded', 'adj.', '虚心的', '话题', ['人物描述话题词'], ['虚心的'], ['open-minded is common in 人物描述 topics.']],
  ['optimistic', 'adj.', '乐观的', '话题', ['人物描述话题词'], ['乐观的'], ['optimistic is common in 人物描述 topics.']],
  ['orderly', 'adj.', '守纪律的', '话题', ['人物描述话题词'], ['守纪律的'], ['orderly is common in 人物描述 topics.']],
  ['original', 'adj.', '有独创性的', '话题', ['人物描述话题词'], ['有独创性的'], ['original is common in 人物描述 topics.']],
  ['outgoing', 'adj.', '外向友好的', '话题', ['人物描述话题词'], ['外向友好的'], ['outgoing is common in 人物描述 topics.']],
  ['painstaking', 'adj.', '辛勤的，苦干的，刻苦的', '话题', ['人物描述话题词'], ['辛勤的，苦干的，刻苦的'], ['painstaking is common in 人物描述 topics.']],
  ['passionate', 'adj.', '充满热情的', '话题', ['人物描述话题词'], ['充满热情的'], ['passionate is common in 人物描述 topics.']],
  ['pessimistic', 'adj.', '悲观的', '话题', ['人物描述话题词'], ['悲观的'], ['pessimistic is common in 人物描述 topics.']],
  ['polite', 'adj.', '有礼貌的', '话题', ['人物描述话题词'], ['有礼貌的'], ['polite is common in 人物描述 topics.']],
  ['popular', 'adj.', '受欢迎的', '话题', ['人物描述话题词'], ['受欢迎的'], ['popular is common in 人物描述 topics.']],
  ['practical', 'adj.', '实际的', '话题', ['人物描述话题词'], ['实际的'], ['practical is common in 人物描述 topics.']],
  ['purposeful', 'adj.', '意志坚强的', '话题', ['人物描述话题词'], ['意志坚强的'], ['purposeful is common in 人物描述 topics.']],
  ['pushy', 'adj.', '有进取心的', '话题', ['人物描述话题词'], ['有进取心的'], ['pushy is common in 人物描述 topics.']],
  ['personality', 'n.', '有个性的人', '话题', ['人物描述话题词'], ['有个性的人'], ['personality is common in 人物描述 topics.']],
  ['qualified', 'adj.', '合格的', '话题', ['人物描述话题词'], ['合格的'], ['qualified is common in 人物描述 topics.']],
  ['realistic', 'adj.', '实事求是的', '话题', ['人物描述话题词'], ['实事求是的'], ['realistic is common in 人物描述 topics.']],
  ['reasonable', 'adj.', '讲道理的', '话题', ['人物描述话题词'], ['讲道理的'], ['reasonable is common in 人物描述 topics.']],
  ['reliable', 'adj.', '可信赖的', '话题', ['人物描述话题词'], ['可信赖的'], ['reliable is common in 人物描述 topics.']],
  ['responsible', 'adj.', '负责的', '话题', ['人物描述话题词'], ['负责的'], ['responsible is common in 人物描述 topics.']],
  ['romantic', 'adj.', '浪漫的，空想的', '话题', ['人物描述话题词'], ['浪漫的，空想的'], ['romantic is common in 人物描述 topics.']],
  ['self-conscious', 'adj.', '自觉的', '话题', ['人物描述话题词'], ['自觉的'], ['self-conscious is common in 人物描述 topics.']],
  ['selfish', 'adj.', '自私的', '话题', ['人物描述话题词'], ['自私的'], ['selfish is common in 人物描述 topics.']],
  ['sensible', 'adj.', '明白事理的', '话题', ['人物描述话题词'], ['明白事理的'], ['sensible is common in 人物描述 topics.']],
  ['sensitive', 'adj.', '敏感的', '话题', ['人物描述话题词'], ['敏感的'], ['sensitive is common in 人物描述 topics.']],
  ['sincere', 'adj.', '真诚的', '话题', ['人物描述话题词'], ['真诚的'], ['sincere is common in 人物描述 topics.']],
  ['skeptical', 'adj.', '多疑的', '话题', ['人物描述话题词'], ['多疑的'], ['skeptical is common in 人物描述 topics.']],
  ['smart', 'adj.', '精明的', '话题', ['人物描述话题词'], ['精明的'], ['smart is common in 人物描述 topics.']],
  ['sociable', 'adj.', '好交际的', '话题', ['人物描述话题词'], ['好交际的'], ['sociable is common in 人物描述 topics.']],
  ['spirited', 'adj.', '生气勃勃的', '话题', ['人物描述话题词'], ['生气勃勃的'], ['spirited is common in 人物描述 topics.']],
  ['steady', 'adj.', '踏实的，稳定的', '话题', ['人物描述话题词'], ['踏实的，稳定的'], ['steady is common in 人物描述 topics.']],
  ['straightforward', 'adj.', '老实的', '话题', ['人物描述话题词'], ['老实的'], ['straightforward is common in 人物描述 topics.']],
  ['strict', 'adj.', '严格的', '话题', ['人物描述话题词'], ['严格的'], ['strict is common in 人物描述 topics.']],
  ['supportive', 'adj.', '助人的', '话题', ['人物描述话题词'], ['助人的'], ['supportive is common in 人物描述 topics.']],
  ['strong-willed', 'adj.', '意志坚强的', '话题', ['人物描述话题词'], ['意志坚强的'], ['strong-willed is common in 人物描述 topics.']],
  ['sympathetic', 'adj.', '有同情心的', '话题', ['人物描述话题词'], ['有同情心的'], ['sympathetic is common in 人物描述 topics.']],
  ['thoughtful', 'adj.', '体贴人的', '话题', ['人物描述话题词'], ['体贴人的'], ['thoughtful is common in 人物描述 topics.']],
  ['talented', 'adj.', '有才能的，有天赋的', '话题', ['人物描述话题词'], ['有才能的，有天赋的'], ['talented is common in 人物描述 topics.']],
  ['tireless', 'adj.', '孜孜不倦的', '话题', ['人物描述话题词'], ['孜孜不倦的'], ['tireless is common in 人物描述 topics.']],
  ['tolerant', 'adj.', '容忍的', '话题', ['人物描述话题词'], ['容忍的'], ['tolerant is common in 人物描述 topics.']],
  ['virtuous', 'adj.', '善良的，道德高尚的', '话题', ['人物描述话题词'], ['善良的，道德高尚的'], ['virtuous is common in 人物描述 topics.']],
  ['trustful', 'adj.', '容易相信人的', '话题', ['人物描述话题词'], ['容易相信人的'], ['trustful is common in 人物描述 topics.']],
  ['trustworthy', 'adj.', '值得信任的', '话题', ['人物描述话题词'], ['值得信任的'], ['trustworthy is common in 人物描述 topics.']],
  ['understanding', 'adj.', '理解人的', '话题', ['人物描述话题词'], ['理解人的'], ['understanding is common in 人物描述 topics.']],
  ['ungrateful', 'adj.', '不领情的', '话题', ['人物描述话题词'], ['不领情的'], ['ungrateful is common in 人物描述 topics.']],
  ['upright', 'adj.', '正直的', '话题', ['人物描述话题词'], ['正直的'], ['upright is common in 人物描述 topics.']],
  ['sweet-tempered', 'adj.', '性情温和的', '话题', ['人物描述话题词'], ['性情温和的'], ['sweet-tempered is common in 人物描述 topics.']]
];

// 536话题词汇 - 文化交流
const seedWords536_文化交流 = [
  ['cultural heritage', 'n.', '文化遗产', '话题', ['文化交流话题词'], ['文化遗产'], ['cultural heritage is common in 文化交流 topics.']],
  ['cultural exchange', 'n.', '文化交流', '话题', ['文化交流话题词'], ['文化交流'], ['cultural exchange is common in 文化交流 topics.']],
  ['cross-cultural', 'adj.', '跨文化的', '话题', ['文化交流话题词'], ['跨文化的'], ['cross-cultural is common in 文化交流 topics.']],
  ['cultural diversity', 'n.', '文化多样性', '话题', ['文化交流话题词'], ['文化多样性'], ['cultural diversity is common in 文化交流 topics.']],
  ['cultural identity', 'n.', '文化身份', '话题', ['文化交流话题词'], ['文化身份'], ['cultural identity is common in 文化交流 topics.']],
  ['intangible heritage', 'n.', '非物质文化遗产', '话题', ['文化交流话题词'], ['非物质文化遗产'], ['intangible heritage is common in 文化交流 topics.']],
  ['folk art', 'n.', '民间艺术', '话题', ['文化交流话题词'], ['民间艺术'], ['folk art is common in 文化交流 topics.']],
  ['traditional craft', 'n.', '传统手工艺', '话题', ['文化交流话题词'], ['传统手工艺'], ['traditional craft is common in 文化交流 topics.']],
  ['cultural fusion', 'n.', '文化融合', '话题', ['文化交流话题词'], ['文化融合'], ['cultural fusion is common in 文化交流 topics.']],
  ['cultural conflict', 'n.', '文化冲突', '话题', ['文化交流话题词'], ['文化冲突'], ['cultural conflict is common in 文化交流 topics.']],
  ['heritage protection', 'n.', '遗产保护', '话题', ['文化交流话题词'], ['遗产保护'], ['heritage protection is common in 文化交流 topics.']],
  ['cultural confidence', 'n.', '文化自信', '话题', ['文化交流话题词'], ['文化自信'], ['cultural confidence is common in 文化交流 topics.']],
  ['world heritage site', 'n.', '世界遗产地', '话题', ['文化交流话题词'], ['世界遗产地'], ['world heritage site is common in 文化交流 topics.']],
  ['traditional festival', 'n.', '传统节日', '话题', ['文化交流话题词'], ['传统节日'], ['traditional festival is common in 文化交流 topics.']],
  ['cultural symbol', 'n.', '文化符号', '话题', ['文化交流话题词'], ['文化符号'], ['cultural symbol is common in 文化交流 topics.']],
  ['local custom', 'n.', '地方习俗', '话题', ['文化交流话题词'], ['地方习俗'], ['local custom is common in 文化交流 topics.']],
  ['foreign culture', 'n.', '外来文化', '话题', ['文化交流话题词'], ['外来文化'], ['foreign culture is common in 文化交流 topics.']],
  ['cultural transmission', 'n.', '文化传播', '话题', ['文化交流话题词'], ['文化传播'], ['cultural transmission is common in 文化交流 topics.']],
  ['cultural innovation', 'n.', '文化创新', '话题', ['文化交流话题词'], ['文化创新'], ['cultural innovation is common in 文化交流 topics.']],
  ['heritage inheritor', 'n.', '遗产传承人', '话题', ['文化交流话题词'], ['遗产传承人'], ['heritage inheritor is common in 文化交流 topics.']],
  ['multicultural', 'adj.', '多元文化的', '话题', ['文化交流话题词'], ['多元文化的'], ['multicultural is common in 文化交流 topics.']],
  ['cultural etiquette', 'n.', '文化礼仪', '话题', ['文化交流话题词'], ['文化礼仪'], ['cultural etiquette is common in 文化交流 topics.']],
  ['language barrier', 'n.', '语言障碍', '话题', ['文化交流话题词'], ['语言障碍'], ['language barrier is common in 文化交流 topics.']],
  ['cultural adaptation', 'n.', '文化适应', '话题', ['文化交流话题词'], ['文化适应'], ['cultural adaptation is common in 文化交流 topics.']],
  ['traditional music', 'n.', '传统音乐', '话题', ['文化交流话题词'], ['传统音乐'], ['traditional music is common in 文化交流 topics.']],
  ['ancient architecture', 'n.', '古建筑', '话题', ['文化交流话题词'], ['古建筑'], ['ancient architecture is common in 文化交流 topics.']],
  ['cultural exhibition', 'n.', '文化展览', '话题', ['文化交流话题词'], ['文化展览'], ['cultural exhibition is common in 文化交流 topics.']],
  ['heritage education', 'n.', '遗产教育', '话题', ['文化交流话题词'], ['遗产教育'], ['heritage education is common in 文化交流 topics.']],
  ['cultural volunteer', 'n.', '文化志愿者', '话题', ['文化交流话题词'], ['文化志愿者'], ['cultural volunteer is common in 文化交流 topics.']],
  ['traditional costume', 'n.', '传统服饰', '话题', ['文化交流话题词'], ['传统服饰'], ['traditional costume is common in 文化交流 topics.']]
];

// 536话题词汇 - 社会热点
const seedWords536_社会热点 = [
  ['social issue', 'n.', '社会问题', '话题', ['社会热点话题词'], ['社会问题'], ['social issue is common in 社会热点 topics.']],
  ['youth responsibility', 'n.', '青年责任', '话题', ['社会热点话题词'], ['青年责任'], ['youth responsibility is common in 社会热点 topics.']],
  ['employment concept', 'n.', '就业观念', '话题', ['社会热点话题词'], ['就业观念'], ['employment concept is common in 社会热点 topics.']],
  ['self-employment', 'n.', '自主创业', '话题', ['社会热点话题词'], ['自主创业'], ['self-employment is common in 社会热点 topics.']],
  ['grassroots employment', 'n.', '基层就业', '话题', ['社会热点话题词'], ['基层就业'], ['grassroots employment is common in 社会热点 topics.']],
  ['social justice', 'n.', '社会公平', '话题', ['社会热点话题词'], ['社会公平'], ['social justice is common in 社会热点 topics.']],
  ['public welfare', 'n.', '公益事业', '话题', ['社会热点话题词'], ['公益事业'], ['public welfare is common in 社会热点 topics.']],
  ['volunteer service', 'n.', '志愿服务', '话题', ['社会热点话题词'], ['志愿服务'], ['volunteer service is common in 社会热点 topics.']],
  ['community construction', 'n.', '社区建设', '话题', ['社会热点话题词'], ['社区建设'], ['community construction is common in 社会热点 topics.']],
  ['charity activity', 'n.', '慈善活动', '话题', ['社会热点话题词'], ['慈善活动'], ['charity activity is common in 社会热点 topics.']],
  ['social participation', 'n.', '社会参与', '话题', ['社会热点话题词'], ['社会参与'], ['social participation is common in 社会热点 topics.']],
  ['youth initiative', 'n.', '青年倡议', '话题', ['社会热点话题词'], ['青年倡议'], ['youth initiative is common in 社会热点 topics.']],
  ['public safety', 'n.', '公共安全', '话题', ['社会热点话题词'], ['公共安全'], ['public safety is common in 社会热点 topics.']],
  ['ethical responsibility', 'n.', '伦理责任', '话题', ['社会热点话题词'], ['伦理责任'], ['ethical responsibility is common in 社会热点 topics.']],
  ['social concern', 'n.', '社会关注', '话题', ['社会热点话题词'], ['社会关注'], ['social concern is common in 社会热点 topics.']],
  ['youth development', 'n.', '青年发展', '话题', ['社会热点话题词'], ['青年发展'], ['youth development is common in 社会热点 topics.']],
  ['career choice', 'n.', '职业选择', '话题', ['社会热点话题词'], ['职业选择'], ['career choice is common in 社会热点 topics.']],
  ['social contribution', 'n.', '社会贡献', '话题', ['社会热点话题词'], ['社会贡献'], ['social contribution is common in 社会热点 topics.']],
  ['youth innovation', 'n.', '青年创新', '话题', ['社会热点话题词'], ['青年创新'], ['youth innovation is common in 社会热点 topics.']],
  ['public opinion', 'n.', '公众舆论', '话题', ['社会热点话题词'], ['公众舆论'], ['public opinion is common in 社会热点 topics.']],
  ['social harmony', 'n.', '社会和谐', '话题', ['社会热点话题词'], ['社会和谐'], ['social harmony is common in 社会热点 topics.']],
  ['youth league', 'n.', '青年团体', '话题', ['社会热点话题词'], ['青年团体'], ['youth league is common in 社会热点 topics.']],
  ['problem-solving', 'n.', '问题解决', '话题', ['社会热点话题词'], ['问题解决'], ['problem-solving is common in 社会热点 topics.']],
  ['social practice', 'n.', '社会实践', '话题', ['社会热点话题词'], ['社会实践'], ['social practice is common in 社会热点 topics.']],
  ['responsibility awareness', 'n.', '责任意识', '话题', ['社会热点话题词'], ['责任意识'], ['responsibility awareness is common in 社会热点 topics.']],
  ['youth leader', 'n.', '青年领袖', '话题', ['社会热点话题词'], ['青年领袖'], ['youth leader is common in 社会热点 topics.']],
  ['public service', 'n.', '公共服务', '话题', ['社会热点话题词'], ['公共服务'], ['public service is common in 社会热点 topics.']],
  ['social progress', 'n.', '社会进步', '话题', ['社会热点话题词'], ['社会进步'], ['social progress is common in 社会热点 topics.']],
  ['youth voice', 'n.', '青年声音', '话题', ['社会热点话题词'], ['青年声音'], ['youth voice is common in 社会热点 topics.']]
];

// 105个必考核心词汇（2021-2025年真题）
const seedWords105 = [
  ['anniversary', 'n.', '周年纪念', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['周年纪念', '高考真题高频出现'], ['anniversary frequently appears in gaokao exams.']],
  ['demonstrate', 'v.', '展示；证明', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['展示；证明', '高考真题高频出现'], ['demonstrate frequently appears in gaokao exams.']],
  ['inspirational', 'adj.', '鼓舞人心的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['鼓舞人心的', '高考真题高频出现'], ['inspirational frequently appears in gaokao exams.']],
  ['round-the-clock', 'adj.', '全天候的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['全天候的', '高考真题高频出现'], ['round-the-clock frequently appears in gaokao exams.']],
  ['mobile', 'adj./n.', '可移动的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['可移动的', '高考真题高频出现'], ['mobile frequently appears in gaokao exams.']],
  ['revolution', 'n.', '革命', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['革命', '高考真题高频出现'], ['revolution frequently appears in gaokao exams.']],
  ['downgraded', 'adj.', '降级的；被轻视的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['降级的；被轻视的', '高考真题高频出现'], ['downgraded frequently appears in gaokao exams.']],
  ['grazing', 'adj./n.', '放牧的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['放牧的', '高考真题高频出现'], ['grazing frequently appears in gaokao exams.']],
  ['monitor', 'v./n.', '监测；监控', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['监测；监控', '高考真题高频出现'], ['monitor frequently appears in gaokao exams.']],
  ['texture', 'n.', '质地；纹理', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['质地；纹理', '高考真题高频出现'], ['texture frequently appears in gaokao exams.']],
  ['nutrition', 'n.', '营养', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['营养', '高考真题高频出现'], ['nutrition frequently appears in gaokao exams.']],
  ['disguise', 'v./n.', '伪装；假扮', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['伪装；假扮', '高考真题高频出现'], ['disguise frequently appears in gaokao exams.']],
  ['dialect', 'n.', '方言', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['方言', '高考真题高频出现'], ['dialect frequently appears in gaokao exams.']],
  ['criminal', 'adj./n.', '罪犯', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['罪犯', '高考真题高频出现'], ['criminal frequently appears in gaokao exams.']],
  ['breeding', 'n.', '繁殖；培育', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['繁殖；培育', '高考真题高频出现'], ['breeding frequently appears in gaokao exams.']],
  ['endangered', 'adj.', '濒危的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['濒危的', '高考真题高频出现'], ['endangered frequently appears in gaokao exams.']],
  ['conservation', 'n.', '保护', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['保护', '高考真题高频出现'], ['conservation frequently appears in gaokao exams.']],
  ['migratory', 'adj.', '迁徙的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['迁徙的', '高考真题高频出现'], ['migratory frequently appears in gaokao exams.']],
  ['emotional', 'adj.', '情感的', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['情感的', '高考真题高频出现'], ['emotional frequently appears in gaokao exams.']],
  ['multimedia', 'adj./n.', '多媒体的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['多媒体的', '高考真题高频出现'], ['multimedia frequently appears in gaokao exams.']],
  ['integration', 'n.', '融合；整合', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['融合；整合', '高考真题高频出现'], ['integration frequently appears in gaokao exams.']],
  ['distracted', 'adj.', '分心的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['分心的', '高考真题高频出现'], ['distracted frequently appears in gaokao exams.']],
  ['efficient', 'adj.', '高效的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['高效的', '高考真题高频出现'], ['efficient frequently appears in gaokao exams.']],
  ['aerobic', 'adj.', '有氧的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['有氧的', '高考真题高频出现'], ['aerobic frequently appears in gaokao exams.']],
  ['flexibility', 'n.', '灵活性', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['灵活性', '高考真题高频出现'], ['flexibility frequently appears in gaokao exams.']],
  ['affordable', 'adj.', '负担得起的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['负担得起的', '高考真题高频出现'], ['affordable frequently appears in gaokao exams.']],
  ['schedule', 'n./v.', '安排；计划', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['安排；计划', '高考真题高频出现'], ['schedule frequently appears in gaokao exams.']],
  ['agricultural', 'adj.', '农业的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['农业的', '高考真题高频出现'], ['agricultural frequently appears in gaokao exams.']],
  ['evolution', 'n.', '进化', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['进化', '高考真题高频出现'], ['evolution frequently appears in gaokao exams.']],
  ['maintenance', 'n.', '维护；维修', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['维护；维修', '高考真题高频出现'], ['maintenance frequently appears in gaokao exams.']],
  ['infrastructure', 'n.', '基础设施', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['基础设施', '高考真题高频出现'], ['infrastructure frequently appears in gaokao exams.']],
  ['obesity', 'n.', '肥胖症', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['肥胖症', '高考真题高频出现'], ['obesity frequently appears in gaokao exams.']],
  ['manufacturer', 'n.', '制造商', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['制造商', '高考真题高频出现'], ['manufacturer frequently appears in gaokao exams.']],
  ['psychology', 'n.', '心理学', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['心理学', '高考真题高频出现'], ['psychology frequently appears in gaokao exams.']],
  ['mutual', 'adj.', '相互的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['相互的', '高考真题高频出现'], ['mutual frequently appears in gaokao exams.']],
  ['symmetrical', 'adj.', '对称的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['对称的', '高考真题高频出现'], ['symmetrical frequently appears in gaokao exams.']],
  ['precious', 'adj.', '珍贵的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['珍贵的', '高考真题高频出现'], ['precious frequently appears in gaokao exams.']],
  ['diverse', 'adj.', '多样的', '必考', ['真题必考词', '二、2022 年高考英语真题'], ['多样的', '高考真题高频出现'], ['diverse frequently appears in gaokao exams.']],
  ['sustainable', 'adj.', '可持续的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['可持续的', '高考真题高频出现'], ['sustainable frequently appears in gaokao exams.']],
  ['economical', 'adj.', '经济的；实惠的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['经济的；实惠的', '高考真题高频出现'], ['economical frequently appears in gaokao exams.']],
  ['minimalism', 'n.', '极简主义', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['极简主义', '高考真题高频出现'], ['minimalism frequently appears in gaokao exams.']],
  ['correlation', 'n.', '关联；相关性', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['关联；相关性', '高考真题高频出现'], ['correlation frequently appears in gaokao exams.']],
  ['independent', 'adj.', '独立的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['独立的', '高考真题高频出现'], ['independent frequently appears in gaokao exams.']],
  ['initial', 'adj./n.', '最初的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['最初的', '高考真题高频出现'], ['initial frequently appears in gaokao exams.']],
  ['interactive', 'adj.', '互动的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['互动的', '高考真题高频出现'], ['interactive frequently appears in gaokao exams.']],
  ['domestic', 'adj.', '家庭的；国内的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['家庭的；国内的', '高考真题高频出现'], ['domestic frequently appears in gaokao exams.']],
  ['category', 'n.', '类别', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['类别', '高考真题高频出现'], ['category frequently appears in gaokao exams.']],
  ['physician', 'n.', '医生；内科医生', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['医生；内科医生', '高考真题高频出现'], ['physician frequently appears in gaokao exams.']],
  ['cuisine', 'n.', '烹饪；菜肴', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['烹饪；菜肴', '高考真题高频出现'], ['cuisine frequently appears in gaokao exams.']],
  ['ingredient', 'n.', '原料；配料', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['原料；配料', '高考真题高频出现'], ['ingredient frequently appears in gaokao exams.']],
  ['reconstruct', 'v.', '重建；复原', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['重建；复原', '高考真题高频出现'], ['reconstruct frequently appears in gaokao exams.']],
  ['interpret', 'v.', '解释；诠释', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['解释；诠释', '高考真题高频出现'], ['interpret frequently appears in gaokao exams.']],
  ['culinary', 'adj.', '烹饪的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['烹饪的', '高考真题高频出现'], ['culinary frequently appears in gaokao exams.']],
  ['colonial', 'adj.', '殖民的', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['殖民的', '高考真题高频出现'], ['colonial frequently appears in gaokao exams.']],
  ['philosophy', 'n.', '哲学', '必考', ['真题必考词', '三、2023 年高考英语真题'], ['哲学', '高考真题高频出现'], ['philosophy frequently appears in gaokao exams.']],
  ['informative', 'adj.', '增长知识的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['增长知识的', '高考真题高频出现'], ['informative frequently appears in gaokao exams.']],
  ['essential', 'adj./n.', '必要的；至关重要的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['必要的；至关重要的', '高考真题高频出现'], ['essential frequently appears in gaokao exams.']],
  ['innovative', 'adj.', '创新的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['创新的', '高考真题高频出现'], ['innovative frequently appears in gaokao exams.']],
  ['automated', 'adj.', '自动化的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['自动化的', '高考真题高频出现'], ['automated frequently appears in gaokao exams.']],
  ['sustainability', 'n.', '可持续性', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['可持续性', '高考真题高频出现'], ['sustainability frequently appears in gaokao exams.']],
  ['forthcoming', 'adj.', '即将到来的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['即将到来的', '高考真题高频出现'], ['forthcoming frequently appears in gaokao exams.']],
  ['accessible', 'adj.', '易懂的；可得到的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['易懂的；可得到的', '高考真题高频出现'], ['accessible frequently appears in gaokao exams.']],
  ['holistic', 'adj.', '整体的；全面的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['整体的；全面的', '高考真题高频出现'], ['holistic frequently appears in gaokao exams.']],
  ['conventional', 'adj.', '传统的；常规的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['传统的；常规的', '高考真题高频出现'], ['conventional frequently appears in gaokao exams.']],
  ['abstraction', 'n.', '抽象概念', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['抽象概念', '高考真题高频出现'], ['abstraction frequently appears in gaokao exams.']],
  ['identical', 'adj.', '完全相同的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['完全相同的', '高考真题高频出现'], ['identical frequently appears in gaokao exams.']],
  ['biodiversity', 'n.', '生物多样性', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['生物多样性', '高考真题高频出现'], ['biodiversity frequently appears in gaokao exams.']],
  ['specimen', 'n.', '标本', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['标本', '高考真题高频出现'], ['specimen frequently appears in gaokao exams.']],
  ['bias', 'n./v.', '偏见；使偏向', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['偏见；使偏向', '高考真题高频出现'], ['bias frequently appears in gaokao exams.']],
  ['contemporary', 'adj./n.', '当代的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['当代的', '高考真题高频出现'], ['contemporary frequently appears in gaokao exams.']],
  ['commemorate', 'v.', '纪念', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['纪念', '高考真题高频出现'], ['commemorate frequently appears in gaokao exams.']],
  ['recreational', 'adj.', '娱乐的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['娱乐的', '高考真题高频出现'], ['recreational frequently appears in gaokao exams.']],
  ['invertebrate', 'n./adj.', '无脊椎动物', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['无脊椎动物', '高考真题高频出现'], ['invertebrate frequently appears in gaokao exams.']],
  ['rural', 'adj.', '乡村的；偏远的', '必考', ['真题必考词', '四、2024 年高考英语真题'], ['乡村的；偏远的', '高考真题高频出现'], ['rural frequently appears in gaokao exams.']],
  ['decarbonize', 'v.', '脱碳', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['脱碳', '高考真题高频出现'], ['decarbonize frequently appears in gaokao exams.']],
  ['emission', 'n.', '排放', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['排放', '高考真题高频出现'], ['emission frequently appears in gaokao exams.']],
  ['synthetic', 'adj.', '合成的', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['合成的', '高考真题高频出现'], ['synthetic frequently appears in gaokao exams.']],
  ['hydrocarbon', 'n.', '碳氢化合物', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['碳氢化合物', '高考真题高频出现'], ['hydrocarbon frequently appears in gaokao exams.']],
  ['transition', 'n./v.', '变革', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['变革', '高考真题高频出现'], ['transition frequently appears in gaokao exams.']],
  ['staggering', 'adj.', '令人震惊的', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['令人震惊的', '高考真题高频出现'], ['staggering frequently appears in gaokao exams.']],
  ['persuasive', 'adj.', '有说服力的', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['有说服力的', '高考真题高频出现'], ['persuasive frequently appears in gaokao exams.']],
  ['pedestrian', 'n./adj.', '行人', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['行人', '高考真题高频出现'], ['pedestrian frequently appears in gaokao exams.']],
  ['champion', 'v./n.', '支持，拥护', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['支持，拥护', '高考真题高频出现'], ['champion frequently appears in gaokao exams.']],
  ['microplastic', 'n.', '微塑料', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['微塑料', '高考真题高频出现'], ['microplastic frequently appears in gaokao exams.']],
  ['filter', 'n./v.', '过滤', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['过滤', '高考真题高频出现'], ['filter frequently appears in gaokao exams.']],
  ['calcium carbonate', 'n.', '碳酸钙', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['碳酸钙', '高考真题高频出现'], ['calcium carbonate frequently appears in gaokao exams.']],
  ['polystyrene', 'n.', '聚苯乙烯', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['聚苯乙烯', '高考真题高频出现'], ['polystyrene frequently appears in gaokao exams.']],
  ['polyethylene', 'n.', '聚乙烯', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['聚乙烯', '高考真题高频出现'], ['polyethylene frequently appears in gaokao exams.']],
  ['medieval', 'adj.', '中世纪的', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['中世纪的', '高考真题高频出现'], ['medieval frequently appears in gaokao exams.']],
  ['exclusively', 'adv.', '专门地', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['专门地', '高考真题高频出现'], ['exclusively frequently appears in gaokao exams.']],
  ['psychological', 'adj.', '心理的', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['心理的', '高考真题高频出现'], ['psychological frequently appears in gaokao exams.']],
  ['weightlifting', 'n.', '举重', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['举重', '高考真题高频出现'], ['weightlifting frequently appears in gaokao exams.']],
  ['identity', 'n.', '身份', '必考', ['真题必考词', '五、2025 年高考英语真题'], ['身份', '高考真题高频出现'], ['identity frequently appears in gaokao exams.']]
];

// 近五年真题高频词
const seedWordsExam = [
  ['paragraph', 'n.', '文章段落', '真题', ['真题词频66次'], ['文章段落'], ['paragraph appears in recent gaokao exams.']],
  ['still', 'adj./adv./n./v.', 'adj.静止的；平静的；adv.仍然；依旧；还；n.剧照；（电影的）定格画面；v.使静止；使平静下来', '真题', ['真题词频54次'], ['adj.静止的；平静的；adv.仍然；依旧；还；n.剧照；（电影的）定格画面；v.使静止；使平静下来'], ['still appears in recent gaokao exams.']],
  ['plastic', 'n./adj.', 'n.塑料；adj.可塑的', '真题', ['真题词频30次'], ['n.塑料；adj.可塑的'], ['plastic appears in recent gaokao exams.']],
  ['improve', 'v.', '改善；改进；提高；变得更好', '真题', ['真题词频28次'], ['改善；改进；提高；变得更好'], ['improve appears in recent gaokao exams.']],
  ['species', 'n.', '物种；种类', '真题', ['真题词频25次'], ['物种；种类'], ['species appears in recent gaokao exams.']],
  ['creative', 'adj.', '创造性的，指具有创新或原创性的', '真题', ['真题词频24次'], ['创造性的，指具有创新或原创性的'], ['creative appears in recent gaokao exams.']],
  ['wild', 'adj.', '野生的，指自然生长而非人工培育的', '真题', ['真题词频19次'], ['野生的，指自然生长而非人工培育的'], ['wild appears in recent gaokao exams.']],
  ['state', 'n./v.', 'n.状态；状况；国家；州；v.陈述；说明；声明', '真题', ['真题词频17次'], ['n.状态；状况；国家；州；v.陈述；说明；声明'], ['state appears in recent gaokao exams.']],
  ['consider', 'v.', '仔细考虑；细想；认为；以为；体谅；考虑到', '真题', ['真题词频17次'], ['仔细考虑；细想；认为；以为；体谅；考虑到'], ['consider appears in recent gaokao exams.']],
  ['require', 'v.', '要求，指需要或命令某人做某事', '真题', ['真题词频16次'], ['要求，指需要或命令某人做某事'], ['require appears in recent gaokao exams.']],
  ['focus', 'n./v.', 'n.焦点；v.聚焦（on）', '真题', ['真题词频16次'], ['n.焦点；v.聚焦（on）'], ['focus appears in recent gaokao exams.']],
  ['positive', 'adj.', '积极的；正面的', '真题', ['真题词频16次'], ['积极的；正面的'], ['positive appears in recent gaokao exams.']],
  ['concept', 'n.', '概念', '真题', ['真题词频16次'], ['概念'], ['concept appears in recent gaokao exams.']],
  ['personal', 'adj.', '私人的；个人的；亲自的', '真题', ['真题词频15次'], ['私人的；个人的；亲自的'], ['personal appears in recent gaokao exams.']],
  ['support', 'v./n.', 'v.支持；拥护；鼓励；帮助；支撑；供养；n.支持；拥护；鼓励；帮助；支撑物；支柱', '真题', ['真题词频15次'], ['v.支持；拥护；鼓励；帮助；支撑；供养；n.支持；拥护；鼓励；帮助；支撑物；支柱'], ['support appears in recent gaokao exams.']],
  ['store', 'v./n.', 'v.储存；n.商店', '真题', ['真题词频15次'], ['v.储存；n.商店'], ['store appears in recent gaokao exams.']],
  ['respect', 'v./n.', 'v./n.尊敬；尊重', '真题', ['真题词频15次'], ['v./n.尊敬；尊重'], ['respect appears in recent gaokao exams.']],
  ['promote', 'v.', '促进，推动某事的发展', '真题', ['真题词频15次'], ['促进，推动某事的发展'], ['promote appears in recent gaokao exams.']],
  ['ancient', 'adj.', '古老的', '真题', ['真题词频15次'], ['古老的'], ['ancient appears in recent gaokao exams.']],
  ['habitat', 'n.', '（动植物的）栖息地；生活环境', '真题', ['真题词频15次'], ['（动植物的）栖息地；生活环境'], ['habitat appears in recent gaokao exams.']],
  ['physical', 'adj.', '物质的；身体的，指与物质或身体相关的', '真题', ['真题词频14次'], ['物质的；身体的，指与物质或身体相关的'], ['physical appears in recent gaokao exams.']],
  ['average', 'adj.', '平均的', '真题', ['真题词频14次'], ['平均的'], ['average appears in recent gaokao exams.']],
  ['protect', 'v.', '保护；防护；（制定法律）保护；（通过征关税）保护（国内企业）', '真题', ['真题词频13次'], ['保护；防护；（制定法律）保护；（通过征关税）保护（国内企业）'], ['protect appears in recent gaokao exams.']],
  ['percent', 'n.', '百分比，表示比例或比率', '真题', ['真题词频13次'], ['百分比，表示比例或比率'], ['percent appears in recent gaokao exams.']],
  ['tax', 'v./n.', 'v.对……征税；使负重担；n.税；税款', '真题', ['真题词频13次'], ['v.对……征税；使负重担；n.税；税款'], ['tax appears in recent gaokao exams.']],
  ['offer', 'v./n.', 'v.出价；n.提议；出价；主动提议', '真题', ['真题词频12次'], ['v.出价；n.提议；出价；主动提议'], ['offer appears in recent gaokao exams.']],
  ['produce', 'v./n.', 'v.生产；制造；产生；引起；创作；n.农产品', '真题', ['真题词频12次'], ['v.生产；制造；产生；引起；创作；n.农产品'], ['produce appears in recent gaokao exams.']],
  ['lead', 'v./n.', 'v.带路；引领；领导；导致；通向；n.铅；（戏剧、电影等的）主角；领先地位', '真题', ['真题词频12次'], ['v.带路；引领；领导；导致；通向；n.铅；（戏剧、电影等的）主角；领先地位'], ['lead appears in recent gaokao exams.']],
  ['check', 'n./v.', 'n.支票；检查；v.核对', '真题', ['真题词频12次'], ['n.支票；检查；v.核对'], ['check appears in recent gaokao exams.']],
  ['communicate', 'v.', '交流，通过言语、文字等方式传递信息', '真题', ['真题词频12次'], ['交流，通过言语、文字等方式传递信息'], ['communicate appears in recent gaokao exams.']],
  ['spot', 'n.', '地点，指特定的位置或场所', '真题', ['真题词频12次'], ['地点，指特定的位置或场所'], ['spot appears in recent gaokao exams.']],
  ['success', 'n.', '成功；成就；成功的人（或事物）', '真题', ['真题词频11次'], ['成功；成就；成功的人（或事物）'], ['success appears in recent gaokao exams.']],
  ['deal', 'v./n.', 'v.处理；交易；n.处理；交易', '真题', ['真题词频11次'], ['v.处理；交易；n.处理；交易'], ['deal appears in recent gaokao exams.']],
  ['refer', 'v.', '涉及；提到；查阅', '真题', ['真题词频11次'], ['涉及；提到；查阅'], ['refer appears in recent gaokao exams.']],
  ['compare', 'v.', '比较（with）；比喻（to）', '真题', ['真题词频11次'], ['比较（with）；比喻（to）'], ['compare appears in recent gaokao exams.']],
  ['avoid', 'v.', '避免，设法不使某事发生', '真题', ['真题词频11次'], ['避免，设法不使某事发生'], ['avoid appears in recent gaokao exams.']],
  ['content', 'n./adj.', 'n.内容；目录；adj.满意的（with）', '真题', ['真题词频11次'], ['n.内容；目录；adj.满意的（with）'], ['content appears in recent gaokao exams.']],
  ['background', 'n.', '背景；出身', '真题', ['真题词频11次'], ['背景；出身'], ['background appears in recent gaokao exams.']],
  ['urban', 'adj.', '城市的；都市的', '真题', ['真题词频11次'], ['城市的；都市的'], ['urban appears in recent gaokao exams.']],
  ['complete', 'v./adj.', 'v.完成；结束；使完整；使完美；adj.完整的；完全的；彻底的；完成的', '真题', ['真题词频10次'], ['v.完成；结束；使完整；使完美；adj.完整的；完全的；彻底的；完成的'], ['complete appears in recent gaokao exams.']],
  ['tend', 'v.', '往往会；常常就；趋向；倾向；照顾；照料', '真题', ['真题词频10次'], ['往往会；常常就；趋向；倾向；照顾；照料'], ['tend appears in recent gaokao exams.']],
  ['fit', 'v./adj./n.', 'v.适合；合身；（使）适应；安装；adj.健康的；合适的；恰当的；n.（癫痫等的）突发；一阵（咳嗽、打喷嚏等）', '真题', ['真题词频10次'], ['v.适合；合身；（使）适应；安装；adj.健康的；合适的；恰当的；n.（癫痫等的）突发；一阵（咳嗽、打喷嚏等）'], ['fit appears in recent gaokao exams.']],
  ['professional', 'adj./n.', 'adj.专业的；职业的；n.具有某种专业技能或从事某种专业工作的人', '真题', ['真题词频10次'], ['adj.专业的；职业的；n.具有某种专业技能或从事某种专业工作的人'], ['professional appears in recent gaokao exams.']],
  ['speech', 'n.', '演讲，指公开发表的讲话或演说', '真题', ['真题词频10次'], ['演讲，指公开发表的讲话或演说'], ['speech appears in recent gaokao exams.']],
  ['regular', 'adj.', '有规律的；定期的，指按照固定模式或时间间隔进行的', '真题', ['真题词频10次'], ['有规律的；定期的，指按照固定模式或时间间隔进行的'], ['regular appears in recent gaokao exams.']],
  ['range', 'n.', '范围，表示一系列事物的界限', '真题', ['真题词频10次'], ['范围，表示一系列事物的界限'], ['range appears in recent gaokao exams.']],
  ['opportunity', 'n.', '机会，有利的时机', '真题', ['真题词频10次'], ['机会，有利的时机'], ['opportunity appears in recent gaokao exams.']],
  ['potential', 'adj./n.', 'adj.潜在的；n.潜力，可能性或潜力', '真题', ['真题词频10次'], ['adj.潜在的；n.潜力，可能性或潜力'], ['potential appears in recent gaokao exams.']],
  ['available', 'adj.', '可利用的，指某物或某人可被使用', '真题', ['真题词频10次'], ['可利用的，指某物或某人可被使用'], ['available appears in recent gaokao exams.']],
  ['remove', 'v.', '移除；去掉', '真题', ['真题词频10次'], ['移除；去掉'], ['remove appears in recent gaokao exams.']],
  ['unique', 'adj.', '唯一的；独一无二的', '真题', ['真题词频10次'], ['唯一的；独一无二的'], ['unique appears in recent gaokao exams.']],
  ['reserve', 'v./n.', 'v.预订；保留；储备；n.储备；保护区；矜持', '真题', ['真题词频10次'], ['v.预订；保留；储备；n.储备；保护区；矜持'], ['reserve appears in recent gaokao exams.']],
  ['distinguish', 'v.', '区分；辨别；使杰出', '真题', ['真题词频10次'], ['区分；辨别；使杰出'], ['distinguish appears in recent gaokao exams.']],
  ['former', 'adj.', '以前的、前者', '真题', ['真题词频10次'], ['以前的、前者'], ['former appears in recent gaokao exams.']],
  ['volunteer', 'n./v.', 'n.志愿者；v.（自愿）做', '真题', ['真题词频9次'], ['n.志愿者；v.（自愿）做'], ['volunteer appears in recent gaokao exams.']],
  ['review', 'v./n.', 'v./n.复习；回顾；评估', '真题', ['真题词频9次'], ['v./n.复习；回顾；评估'], ['review appears in recent gaokao exams.']],
  ['official', 'adj./n.', 'adj.正式的，指符合规定或程序的；n.官员', '真题', ['真题词频9次'], ['adj.正式的，指符合规定或程序的；n.官员'], ['official appears in recent gaokao exams.']],
  ['approach', 'v./n.', 'v.靠近；n.途径；方法（to）', '真题', ['真题词频9次'], ['v.靠近；n.途径；方法（to）'], ['approach appears in recent gaokao exams.']],
  ['entire', 'adj.', '全部的；整个的', '真题', ['真题词频9次'], ['全部的；整个的'], ['entire appears in recent gaokao exams.']],
  ['specific', 'adj.', '明确的；具体的', '真题', ['真题词频9次'], ['明确的；具体的'], ['specific appears in recent gaokao exams.']],
  ['complex', 'adj./n.', 'adj.复杂的；难懂的；n.建筑群；综合设施', '真题', ['真题词频9次'], ['adj.复杂的；难懂的；n.建筑群；综合设施'], ['complex appears in recent gaokao exams.']],
  ['impact', 'n./v.', 'n.影响；冲击力；v.影响；冲击', '真题', ['真题词频9次'], ['n.影响；冲击力；v.影响；冲击'], ['impact appears in recent gaokao exams.']],
  ['industry', 'n.', '工业、产业', '真题', ['真题词频9次'], ['工业、产业'], ['industry appears in recent gaokao exams.']],
  ['wonder', 'v./n.', 'v.想知道；琢磨；感到诧异；惊叹；n.惊奇；惊讶；奇迹；奇观', '真题', ['真题词频8次'], ['v.想知道；琢磨；感到诧异；惊叹；n.惊奇；惊讶；奇迹；奇观'], ['wonder appears in recent gaokao exams.']],
  ['matter', 'n./v.', 'n.事情；事态；问题；物质；v.要紧；有关系', '真题', ['真题词频8次'], ['n.事情；事态；问题；物质；v.要紧；有关系'], ['matter appears in recent gaokao exams.']],
  ['popularity', 'n.', '普及；流行，指某物被广泛接受或喜爱的程度', '真题', ['真题词频8次'], ['普及；流行，指某物被广泛接受或喜爱的程度'], ['popularity appears in recent gaokao exams.']],
  ['pressure', 'n.', '压力；压强', '真题', ['真题词频8次'], ['压力；压强'], ['pressure appears in recent gaokao exams.']],
  ['replace', 'v.', '取代，用新的代替旧的', '真题', ['真题词频8次'], ['取代，用新的代替旧的'], ['replace appears in recent gaokao exams.']],
  ['stick', 'v.', 'v.粘住；坚持（to）', '真题', ['真题词频8次'], ['v.粘住；坚持（to）'], ['stick appears in recent gaokao exams.']],
  ['response', 'n.', '反应；响应（to）', '真题', ['真题词频8次'], ['反应；响应（to）'], ['response appears in recent gaokao exams.']],
  ['significant', 'adj.', '重要的；有意义的；显著的', '真题', ['真题词频8次'], ['重要的；有意义的；显著的'], ['significant appears in recent gaokao exams.']],
  ['transform', 'v.', '使改变形态；使改观；使转化', '真题', ['真题词频8次'], ['使改变形态；使改观；使转化'], ['transform appears in recent gaokao exams.']],
  ['artificial', 'adj.', '人造的；人工的；人为的；虚假的', '真题', ['真题词频8次'], ['人造的；人工的；人为的；虚假的'], ['artificial appears in recent gaokao exams.']],
  ['awkward', 'adj.', '令人尴尬的；难对付的；笨拙的；不灵活的', '真题', ['真题词频8次'], ['令人尴尬的；难对付的；笨拙的；不灵活的'], ['awkward appears in recent gaokao exams.']],
  ['addition', 'n.', '增加；加法；添加物', '真题', ['真题词频7次'], ['增加；加法；添加物'], ['addition appears in recent gaokao exams.']],
  ['cause', 'v./n.', 'v.引起；使发生；造成；导致；n.原因；起因；理由；事业', '真题', ['真题词频7次'], ['v.引起；使发生；造成；导致；n.原因；起因；理由；事业'], ['cause appears in recent gaokao exams.']],
  ['perform', 'v.', '执行；表演，指完成任务或进行艺术表演', '真题', ['真题词频7次'], ['执行；表演，指完成任务或进行艺术表演'], ['perform appears in recent gaokao exams.']],
  ['connect', 'v.', '连接；联系，指将两个或多个事物连接起来或建立联系', '真题', ['真题词频7次'], ['连接；联系，指将两个或多个事物连接起来或建立联系'], ['connect appears in recent gaokao exams.']],
  ['lack', 'n./v.', 'n.缺乏（of/in）；v.缺乏', '真题', ['真题词频7次'], ['n.缺乏（of/in）；v.缺乏'], ['lack appears in recent gaokao exams.']],
  ['original', 'adj.', '原始的；最初的，指最初的状态或版本', '真题', ['真题词频7次'], ['原始的；最初的，指最初的状态或版本'], ['original appears in recent gaokao exams.']],
  ['account', 'n.', '账户，指记录财务收支的账目', '真题', ['真题词频7次'], ['账户，指记录财务收支的账目'], ['account appears in recent gaokao exams.']],
  ['figure', 'n.', '人物，指特定的人或形象', '真题', ['真题词频7次'], ['人物，指特定的人或形象'], ['figure appears in recent gaokao exams.']],
  ['risk', 'n./v.', 'n.危险；风险；v.冒……的危险', '真题', ['真题词频7次'], ['n.危险；风险；v.冒……的危险'], ['risk appears in recent gaokao exams.']],
  ['collection', 'n.', '收集', '真题', ['真题词频7次'], ['收集'], ['collection appears in recent gaokao exams.']],
  ['moral', 'adj./n.', 'adj.道德的；道义上的；n.品行；道德规范', '真题', ['真题词频7次'], ['adj.道德的；道义上的；n.品行；道德规范'], ['moral appears in recent gaokao exams.']],
  ['ensure', 'v.', '确保；保证', '真题', ['真题词频7次'], ['确保；保证'], ['ensure appears in recent gaokao exams.']],
  ['register', 'v./n.', 'v.登记；注册；记录；n.登记；注册；登记簿', '真题', ['真题词频7次'], ['v.登记；注册；记录；n.登记；注册；登记簿'], ['register appears in recent gaokao exams.']],
  ['frequently', 'adv.', '频繁地；经常', '真题', ['真题词频7次'], ['频繁地；经常'], ['frequently appears in recent gaokao exams.']],
  ['session', 'n.', '一场、一段时间、会议', '真题', ['真题词频7次'], ['一场、一段时间、会议'], ['session appears in recent gaokao exams.']],
  ['present', 'adj./n./v.', 'adj.现存的；当前的；出席的；到场的；n.礼物；目前；现在；v.把……交给；颁发；授予；提出', '真题', ['真题词频6次'], ['adj.现存的；当前的；出席的；到场的；n.礼物；目前；现在；v.把……交给；颁发；授予；提出'], ['present appears in recent gaokao exams.']],
  ['prefer', 'v.', '更喜欢，指对某物或某人比对其他有更强烈的喜好', '真题', ['真题词频6次'], ['更喜欢，指对某物或某人比对其他有更强烈的喜好'], ['prefer appears in recent gaokao exams.']],
  ['raise', 'v.', '举起；筹集；提出', '真题', ['真题词频6次'], ['举起；筹集；提出'], ['raise appears in recent gaokao exams.']],
  ['particular', 'adj.', '特别的，指与众不同的或特定的', '真题', ['真题词频6次'], ['特别的，指与众不同的或特定的'], ['particular appears in recent gaokao exams.']],
  ['subject', 'n./adj.', 'n.主题；实验对象；adj.服从的', '真题', ['真题词频6次'], ['n.主题；实验对象；adj.服从的'], ['subject appears in recent gaokao exams.']],
  ['charge', 'n./v.', 'n.费用；指控；v.要价（for）；管理；充电', '真题', ['真题词频6次'], ['n.费用；指控；v.要价（for）；管理；充电'], ['charge appears in recent gaokao exams.']],
  ['contain', 'v.', '包含，容纳某物在内', '真题', ['真题词频6次'], ['包含，容纳某物在内'], ['contain appears in recent gaokao exams.']],
  ['labor', 'n.', '劳力，指体力工作或劳动者', '真题', ['真题词频6次'], ['劳力，指体力工作或劳动者'], ['labor appears in recent gaokao exams.']],
  ['pollution', 'n.', '污染', '真题', ['真题词频6次'], ['污染'], ['pollution appears in recent gaokao exams.']],
  ['hire', 'v.', '雇请', '真题', ['真题词频6次'], ['雇请'], ['hire appears in recent gaokao exams.']],
  ['aspect', 'n.', '方面；外观', '真题', ['真题词频6次'], ['方面；外观'], ['aspect appears in recent gaokao exams.']],
  ['convenient', 'adj.', '方便的；便利的', '真题', ['真题词频6次'], ['方便的；便利的'], ['convenient appears in recent gaokao exams.']],
  ['decline', 'v./n.', 'v.下降；衰退；谢绝；n.下降；衰退', '真题', ['真题词频6次'], ['v.下降；衰退；谢绝；n.下降；衰退'], ['decline appears in recent gaokao exams.']],
  ['evaluate', 'v.', '评估；评价', '真题', ['真题词频6次'], ['评估；评价'], ['evaluate appears in recent gaokao exams.']],
  ['unexpected', 'adj.', '出乎意料的；意外的', '真题', ['真题词频6次'], ['出乎意料的；意外的'], ['unexpected appears in recent gaokao exams.']],
  ['vital', 'adj.', '至关重要的；生死攸关的；充满生机的', '真题', ['真题词频6次'], ['至关重要的；生死攸关的；充满生机的'], ['vital appears in recent gaokao exams.']],
  ['annual', 'adj./n.', 'adj.每年的；一年一次的；年度的；n.年刊；年鉴', '真题', ['真题词频6次'], ['adj.每年的；一年一次的；年度的；n.年刊；年鉴'], ['annual appears in recent gaokao exams.']],
  ['giant', 'n./adj.', 'n.巨人；巨兽；大公司；adj.巨大的；伟大的', '真题', ['真题词频6次'], ['n.巨人；巨兽；大公司；adj.巨大的；伟大的'], ['giant appears in recent gaokao exams.']],
  ['visual', 'adj.', '视力的、视觉的', '真题', ['真题词频6次'], ['视力的、视觉的'], ['visual appears in recent gaokao exams.']],
  ['promise', 'n./v.', 'n.诺言；允诺；v.许诺；承诺', '真题', ['真题词频5次'], ['n.诺言；允诺；v.许诺；承诺'], ['promise appears in recent gaokao exams.']],
  ['general', 'adj.', '普遍的；通用的', '真题', ['真题词频5次'], ['普遍的；通用的'], ['general appears in recent gaokao exams.']],
  ['condition', 'n.', 'n.情况；条件', '真题', ['真题词频5次'], ['n.情况；条件'], ['condition appears in recent gaokao exams.']],
  ['affect', 'v.', '影响', '真题', ['真题词频5次'], ['影响'], ['affect appears in recent gaokao exams.']],
  ['feed', 'v.', '喂养（on）', '真题', ['真题词频5次'], ['喂养（on）'], ['feed appears in recent gaokao exams.']],
  ['strength', 'n.', '力量', '真题', ['真题词频5次'], ['力量'], ['strength appears in recent gaokao exams.']],
  ['determine', 'v.', '下决心', '真题', ['真题词频5次'], ['下决心'], ['determine appears in recent gaokao exams.']],
  ['equipment', 'n.', '设备', '真题', ['真题词频5次'], ['设备'], ['equipment appears in recent gaokao exams.']],
  ['desire', 'n./v.', 'n.渴望；v.渴望，强烈的愿望或需求', '真题', ['真题词频5次'], ['n.渴望；v.渴望，强烈的愿望或需求'], ['desire appears in recent gaokao exams.']],
  ['advance', 'v./adj./n.', 'v.前进；adj.提前的；n.前进；提前', '真题', ['真题词频5次'], ['v.前进；adj.提前的；n.前进；提前'], ['advance appears in recent gaokao exams.']],
  ['character', 'n.', '个性，指人的性格特征', '真题', ['真题词频5次'], ['个性，指人的性格特征'], ['character appears in recent gaokao exams.']],
  ['private', 'adj.', '私人的，指个人的、非公开的', '真题', ['真题词频5次'], ['私人的，指个人的、非公开的'], ['private appears in recent gaokao exams.']],
  ['persuade', 'v.', '说服，指通过言语或行动使他人信服', '真题', ['真题词频5次'], ['说服，指通过言语或行动使他人信服'], ['persuade appears in recent gaokao exams.']],
  ['security', 'n.', '安全；保障', '真题', ['真题词频5次'], ['安全；保障'], ['security appears in recent gaokao exams.']],
  ['host', 'n./v.', 'n.主人；主持人；v.主办；主持', '真题', ['真题词频5次'], ['n.主人；主持人；v.主办；主持'], ['host appears in recent gaokao exams.']],
  ['version', 'n.', '版本', '真题', ['真题词频5次'], ['版本'], ['version appears in recent gaokao exams.']],
  ['chemical', 'adj./n.', 'adj.化学的；n.药品', '真题', ['真题词频5次'], ['adj.化学的；n.药品'], ['chemical appears in recent gaokao exams.']],
  ['straight', 'adj.', 'adj.直的；直接的', '真题', ['真题词频5次'], ['adj.直的；直接的'], ['straight appears in recent gaokao exams.']],
  ['treatment', 'n.', '对待；治疗', '真题', ['真题词频5次'], ['对待；治疗'], ['treatment appears in recent gaokao exams.']],
  ['contribute', 'v.', '贡献；致力于（to）', '真题', ['真题词频5次'], ['贡献；致力于（to）'], ['contribute appears in recent gaokao exams.']],
  ['constant', 'adj.', '持续不断的', '真题', ['真题词频5次'], ['持续不断的'], ['constant appears in recent gaokao exams.']],
  ['delay', 'v./n.', 'v./n.推迟；耽搁', '真题', ['真题词频5次'], ['v./n.推迟；耽搁'], ['delay appears in recent gaokao exams.']],
  ['sympathy', 'n.', '同情；同情心', '真题', ['真题词频5次'], ['同情；同情心'], ['sympathy appears in recent gaokao exams.']],
  ['accurate', 'adj.', '准确的；精确的', '真题', ['真题词频5次'], ['准确的；精确的'], ['accurate appears in recent gaokao exams.']],
  ['assess', 'v.', '评估；评定', '真题', ['真题词频5次'], ['评估；评定'], ['assess appears in recent gaokao exams.']],
  ['current', 'adj./n.', 'adj.当前的；现在的；流行的；n.水流；气流；电流；潮流', '真题', ['真题词频5次'], ['adj.当前的；现在的；流行的；n.水流；气流；电流；潮流'], ['current appears in recent gaokao exams.']],
  ['household', 'n./adj.', 'n.家庭；一家人；adj.家庭的；家用的', '真题', ['真题词频5次'], ['n.家庭；一家人；adj.家庭的；家用的'], ['household appears in recent gaokao exams.']],
  ['tough', 'adj.', '艰苦的；困难的；坚强的；坚韧的', '真题', ['真题词频5次'], ['艰苦的；困难的；坚强的；坚韧的'], ['tough appears in recent gaokao exams.']],
  ['confirm', 'v.', '证实；确认；批准', '真题', ['真题词频5次'], ['证实；确认；批准'], ['confirm appears in recent gaokao exams.']],
  ['witness', 'v./n.', 'v.目击；见证；n.目击者；证人', '真题', ['真题词频5次'], ['v.目击；见证；n.目击者；证人'], ['witness appears in recent gaokao exams.']],
  ['restore', 'v.', '恢复；修复；归还', '真题', ['真题词频5次'], ['恢复；修复；归还'], ['restore appears in recent gaokao exams.']],
  ['multiple', 'adj./n.', 'adj.数量多的；多种多样的；n.倍数', '真题', ['真题词频5次'], ['adj.数量多的；多种多样的；n.倍数'], ['multiple appears in recent gaokao exams.']],
  ['random', 'adj./n.', 'adj.随机的；随意的；n.随机；随意', '真题', ['真题词频5次'], ['adj.随机的；随意的；n.随机；随意'], ['random appears in recent gaokao exams.']],
  ['phrase', 'n.', '短语、词组', '真题', ['真题词频5次'], ['短语、词组'], ['phrase appears in recent gaokao exams.']],
  ['section', 'n.', '一段、部分', '真题', ['真题词频5次'], ['一段、部分'], ['section appears in recent gaokao exams.']],
  ['string', 'n.', '细线、琴弦、一连串', '真题', ['真题词频5次'], ['细线、琴弦、一连串'], ['string appears in recent gaokao exams.']],
  ['swap', 'v.', '交换', '真题', ['真题词频5次'], ['交换'], ['swap appears in recent gaokao exams.']],
  ['directly', 'adv.', '直接地；径直地；坦率地；正好；立即', '真题', ['真题词频4次'], ['直接地；径直地；坦率地；正好；立即'], ['directly appears in recent gaokao exams.']],
  ['valuable', 'adj./n.', 'adj.很有用的；宝贵的；很值钱的；贵重的；n.贵重物品（尤指珠宝）', '真题', ['真题词频4次'], ['adj.很有用的；宝贵的；很值钱的；贵重的；n.贵重物品（尤指珠宝）'], ['valuable appears in recent gaokao exams.']],
  ['necessarily', 'adv.', '必然地，指某事发生是不可避免的', '真题', ['真题词频4次'], ['必然地，指某事发生是不可避免的'], ['necessarily appears in recent gaokao exams.']],
  ['achievement', 'n.', '成就，指通过努力获得的成功或结果', '真题', ['真题词频4次'], ['成就，指通过努力获得的成功或结果'], ['achievement appears in recent gaokao exams.']],
  ['prevent', 'v.', '阻止，指防止某事发生或进行', '真题', ['真题词频4次'], ['阻止，指防止某事发生或进行'], ['prevent appears in recent gaokao exams.']],
  ['relate', 'v.', '有关联（to）；陈述', '真题', ['真题词频4次'], ['有关联（to）；陈述'], ['relate appears in recent gaokao exams.']],
  ['attack', 'n./v.', 'n./v.攻击', '真题', ['真题词频4次'], ['n./v.攻击'], ['attack appears in recent gaokao exams.']],
  ['gather', 'v.', '聚集，使人或物集合在一起', '真题', ['真题词频4次'], ['聚集，使人或物集合在一起'], ['gather appears in recent gaokao exams.']],
  ['praise', 'v./n.', 'v./n.称赞，表示对某人或某事的赞扬', '真题', ['真题词频4次'], ['v./n.称赞，表示对某人或某事的赞扬'], ['praise appears in recent gaokao exams.']],
  ['recover', 'v.', '恢复，指从疾病、损失等中恢复过来', '真题', ['真题词频4次'], ['恢复，指从疾病、损失等中恢复过来'], ['recover appears in recent gaokao exams.']],
  ['exchange', 'v./n.', 'v./n.交换，指互相给予或接受某物', '真题', ['真题词频4次'], ['v./n.交换，指互相给予或接受某物'], ['exchange appears in recent gaokao exams.']],
  ['eager', 'adj.', '渴望的，指对某事物有强烈的愿望', '真题', ['真题词频4次'], ['渴望的，指对某事物有强烈的愿望'], ['eager appears in recent gaokao exams.']],
  ['apply', 'v.', '应用（to）；申请（for）', '真题', ['真题词频4次'], ['应用（to）；申请（for）'], ['apply appears in recent gaokao exams.']],
  ['select', 'v.', '挑选；选择', '真题', ['真题词频4次'], ['挑选；选择'], ['select appears in recent gaokao exams.']],
  ['urgent', 'adj.', '紧急的；迫切的', '真题', ['真题词频4次'], ['紧急的；迫切的'], ['urgent appears in recent gaokao exams.']],
  ['track', 'v./n.', 'v.跟踪；n.小路；轨迹', '真题', ['真题词频4次'], ['v.跟踪；n.小路；轨迹'], ['track appears in recent gaokao exams.']],
  ['reflect', 'v.', '反射；反映；思考', '真题', ['真题词频4次'], ['反射；反映；思考'], ['reflect appears in recent gaokao exams.']],
  ['contact', 'v./n.', 'v./n.联系（with）；接触', '真题', ['真题词频4次'], ['v./n.联系（with）；接触'], ['contact appears in recent gaokao exams.']],
  ['represent', 'v.', '展示；代表', '真题', ['真题词频4次'], ['展示；代表'], ['represent appears in recent gaokao exams.']],
  ['purchase', 'v./n.', 'v./n.购买', '真题', ['真题词频4次'], ['v./n.购买'], ['purchase appears in recent gaokao exams.']],
  ['conflict', 'n.', '冲突', '真题', ['真题词频4次'], ['冲突'], ['conflict appears in recent gaokao exams.']],
  ['grateful', 'adj.', '感激的（to）', '真题', ['真题词频4次'], ['感激的（to）'], ['grateful appears in recent gaokao exams.']],
  ['celebrate', 'v.', '庆祝', '真题', ['真题词频4次'], ['庆祝'], ['celebrate appears in recent gaokao exams.']],
  ['previous', 'adj.', '先前的；以前的', '真题', ['真题词频4次'], ['先前的；以前的'], ['previous appears in recent gaokao exams.']],
  ['reliable', 'adj.', '可靠的；可信赖的', '真题', ['真题词频4次'], ['可靠的；可信赖的'], ['reliable appears in recent gaokao exams.']],
  ['trap', 'v./n.', 'v.使陷入困境；诱捕；n.陷阱', '真题', ['真题词频4次'], ['v.使陷入困境；诱捕；n.陷阱'], ['trap appears in recent gaokao exams.']],
  ['citizen', 'n.', '公民；市民', '真题', ['真题词频4次'], ['公民；市民'], ['citizen appears in recent gaokao exams.']],
  ['cautious', 'adj.', '小心的；谨慎的', '真题', ['真题词频4次'], ['小心的；谨慎的'], ['cautious appears in recent gaokao exams.']],
  ['federal', 'adj.', '联邦制的；联邦政府的', '真题', ['真题词频4次'], ['联邦制的；联邦政府的'], ['federal appears in recent gaokao exams.']],
  ['chief', 'adj./n.', 'adj.主要的；首要的；n.首领；酋长', '真题', ['真题词频4次'], ['adj.主要的；首要的；n.首领；酋长'], ['chief appears in recent gaokao exams.']],
  ['remote', 'adj.', '遥远的；偏僻的；疏远的；遥控的', '真题', ['真题词频4次'], ['遥远的；偏僻的；疏远的；遥控的'], ['remote appears in recent gaokao exams.']],
  ['appeal', 'v./n.', 'v.呼吁；上诉；有吸引力；n.呼吁；上诉；吸引力', '真题', ['真题词频4次'], ['v.呼吁；上诉；有吸引力；n.呼吁；上诉；吸引力'], ['appeal appears in recent gaokao exams.']],
  ['trend', 'n./v.', 'n.趋势；潮流；v.趋向；倾向', '真题', ['真题词频4次'], ['n.趋势；潮流；v.趋向；倾向'], ['trend appears in recent gaokao exams.']],
  ['adopt', 'v.', '收养；采取；采纳', '真题', ['真题词频4次'], ['收养；采取；采纳'], ['adopt appears in recent gaokao exams.']],
  ['assume', 'v.', '假定；假设；认为；承担（责任等）', '真题', ['真题词频4次'], ['假定；假设；认为；承担（责任等）'], ['assume appears in recent gaokao exams.']],
  ['cancel', 'v.', '取消；撤销；废除', '真题', ['真题词频4次'], ['取消；撤销；废除'], ['cancel appears in recent gaokao exams.']],
  ['advocate', 'v./n.', 'v.提倡；拥护；主张；n.提倡者；拥护者', '真题', ['真题词频4次'], ['v.提倡；拥护；主张；n.提倡者；拥护者'], ['advocate appears in recent gaokao exams.']],
  ['brilliant', 'adj.', '明亮的；闪耀的；杰出的；精彩的', '真题', ['真题词频4次'], ['明亮的；闪耀的；杰出的；精彩的'], ['brilliant appears in recent gaokao exams.']],
  ['opponent', 'n.', '对手；敌手；反对者', '真题', ['真题词频4次'], ['对手；敌手；反对者'], ['opponent appears in recent gaokao exams.']],
  ['awful', 'adj.', '很坏的；极讨厌的；非常的；可怕的', '真题', ['真题词频4次'], ['很坏的；极讨厌的；非常的；可怕的'], ['awful appears in recent gaokao exams.']],
  ['minimize', 'v.', '使减少到最低限度；降低；贬低；使显得不重要', '真题', ['真题词频4次'], ['使减少到最低限度；降低；贬低；使显得不重要'], ['minimize appears in recent gaokao exams.']],
  ['beam', 'n.', '光束', '真题', ['真题词频4次'], ['光束'], ['beam appears in recent gaokao exams.']],
  ['phenomenon', 'n.', '现象', '真题', ['真题词频4次'], ['现象'], ['phenomenon appears in recent gaokao exams.']],
  ['expect', 'v.', '预料；预期；期待；指望', '真题', ['真题词频3次'], ['预料；预期；期待；指望'], ['expect appears in recent gaokao exams.']],
  ['manage', 'v.', '管理；经营；设法做到', '真题', ['真题词频3次'], ['管理；经营；设法做到'], ['manage appears in recent gaokao exams.']],
  ['sensitive', 'adj.', '敏感的；灵敏的；善解人意的；易生气的；神经过敏的', '真题', ['真题词频3次'], ['敏感的；灵敏的；善解人意的；易生气的；神经过敏的'], ['sensitive appears in recent gaokao exams.']],
  ['attend', 'v.', 'v.出席；关心；处理', '真题', ['真题词频3次'], ['v.出席；关心；处理'], ['attend appears in recent gaokao exams.']],
  ['concern', 'v.', '关心（about）；涉及', '真题', ['真题词频3次'], ['关心（about）；涉及'], ['concern appears in recent gaokao exams.']],
  ['stress', 'v./n.', 'v.强调；n.压力；强调', '真题', ['真题词频3次'], ['v.强调；n.压力；强调'], ['stress appears in recent gaokao exams.']],
  ['seek', 'v.', '寻找，试图找到某物或某人', '真题', ['真题词频3次'], ['寻找，试图找到某物或某人'], ['seek appears in recent gaokao exams.']],
  ['equal', 'adj.', '相等的，表示数量、质量等相同', '真题', ['真题词频3次'], ['相等的，表示数量、质量等相同'], ['equal appears in recent gaokao exams.']],
  ['destruction', 'n.', '破坏，指对某物的毁坏', '真题', ['真题词频3次'], ['破坏，指对某物的毁坏'], ['destruction appears in recent gaokao exams.']],
  ['function', 'n./v.', 'n.功能，指某物或某系统的用途或作用；v.运行，起作用', '真题', ['真题词频3次'], ['n.功能，指某物或某系统的用途或作用；v.运行，起作用'], ['function appears in recent gaokao exams.']],
  ['repeat', 'v./n.', 'v./n.重复，指再做一次或多次做某事', '真题', ['真题词频3次'], ['v./n.重复，指再做一次或多次做某事'], ['repeat appears in recent gaokao exams.']],
  ['strict', 'adj.', '严格的，指对规则、纪律等要求严格', '真题', ['真题词频3次'], ['严格的，指对规则、纪律等要求严格'], ['strict appears in recent gaokao exams.']],
  ['gradually', 'adv.', '逐渐地，指慢慢地、一步一步地', '真题', ['真题词频3次'], ['逐渐地，指慢慢地、一步一步地'], ['gradually appears in recent gaokao exams.']],
  ['belief', 'n.', '信念，指对某事的坚定信仰', '真题', ['真题词频3次'], ['信念，指对某事的坚定信仰'], ['belief appears in recent gaokao exams.']],
  ['imagination', 'n.', '想象力，指创造或构思新事物的能力', '真题', ['真题词频3次'], ['想象力，指创造或构思新事物的能力'], ['imagination appears in recent gaokao exams.']],
  ['recommend', 'v.', '推荐，指向他人介绍或提议某物', '真题', ['真题词频3次'], ['推荐，指向他人介绍或提议某物'], ['recommend appears in recent gaokao exams.']],
  ['literature', 'n.', '文学', '真题', ['真题词频3次'], ['文学'], ['literature appears in recent gaokao exams.']],
  ['object', 'v./n.', 'v.反对（to）；n.目标；物体', '真题', ['真题词频3次'], ['v.反对（to）；n.目标；物体'], ['object appears in recent gaokao exams.']],
  ['solution', 'n.', '解决办法；解答', '真题', ['真题词频3次'], ['解决办法；解答'], ['solution appears in recent gaokao exams.']],
  ['wealth', 'n.', '财富；财产', '真题', ['真题词频3次'], ['财富；财产'], ['wealth appears in recent gaokao exams.']],
  ['appreciate', 'v.', '欣赏；感激', '真题', ['真题词频3次'], ['欣赏；感激'], ['appreciate appears in recent gaokao exams.']],
  ['historical', 'adj.', '历史的', '真题', ['真题词频3次'], ['历史的'], ['historical appears in recent gaokao exams.']],
  ['primary', 'adj.', '主要的；首要的；初级的', '真题', ['真题词频3次'], ['主要的；首要的；初级的'], ['primary appears in recent gaokao exams.']],
  ['concert', 'n.', '音乐会', '真题', ['真题词频3次'], ['音乐会'], ['concert appears in recent gaokao exams.']],
  ['decade', 'n.', '十年', '真题', ['真题词频3次'], ['十年'], ['decade appears in recent gaokao exams.']],
  ['symbol', 'n.', '象征；符号', '真题', ['真题词频3次'], ['象征；符号'], ['symbol appears in recent gaokao exams.']],
  ['ceremony', 'n.', '仪式；典礼', '真题', ['真题词频3次'], ['仪式；典礼'], ['ceremony appears in recent gaokao exams.']],
  ['typical', 'adj.', '典型的；有代表性的', '真题', ['真题词频3次'], ['典型的；有代表性的'], ['typical appears in recent gaokao exams.']],
  ['negative', 'adj./n.', 'adj.消极的；负面的；否定的；n.否定；负数', '真题', ['真题词频3次'], ['adj.消极的；负面的；否定的；n.否定；负数'], ['negative appears in recent gaokao exams.']],
  ['combine', 'v.', '使结合；使联合；（使）混合', '真题', ['真题词频3次'], ['使结合；使联合；（使）混合'], ['combine appears in recent gaokao exams.']],
  ['remark', 'v./n.', 'v.评论；说起；n.评论；言论', '真题', ['真题词频3次'], ['v.评论；说起；n.评论；言论'], ['remark appears in recent gaokao exams.']],
  ['curiosity', 'n.', '好奇心；求知欲', '真题', ['真题词频3次'], ['好奇心；求知欲'], ['curiosity appears in recent gaokao exams.']],
  ['atmosphere', 'n.', '大气；气氛；氛围', '真题', ['真题词频3次'], ['大气；气氛；氛围'], ['atmosphere appears in recent gaokao exams.']],
  ['recall', 'v./n.', 'v.回忆起；召回；收回；n.回忆；记忆力', '真题', ['真题词频3次'], ['v.回忆起；召回；收回；n.回忆；记忆力'], ['recall appears in recent gaokao exams.']],
  ['resist', 'v.', '抵抗；抵制；忍住', '真题', ['真题词频3次'], ['抵抗；抵制；忍住'], ['resist appears in recent gaokao exams.']],
  ['ambition', 'n.', '雄心；野心；抱负', '真题', ['真题词频3次'], ['雄心；野心；抱负'], ['ambition appears in recent gaokao exams.']],
  ['assistant', 'n./adj.', 'n.助手；助理；adj.辅助的；助理的', '真题', ['真题词频3次'], ['n.助手；助理；adj.辅助的；助理的'], ['assistant appears in recent gaokao exams.']],
  ['destination', 'n.', '目的地；终点', '真题', ['真题词频3次'], ['目的地；终点'], ['destination appears in recent gaokao exams.']],
  ['peak', 'n./adj./v.', 'n.山峰；高峰；顶点；adj.最高的；高峰的；v.达到高峰；达到最大值', '真题', ['真题词频3次'], ['n.山峰；高峰；顶点；adj.最高的；高峰的；v.达到高峰；达到最大值'], ['peak appears in recent gaokao exams.']],
  ['harmony', 'n.', '和谐；融洽；和声', '真题', ['真题词频3次'], ['和谐；融洽；和声'], ['harmony appears in recent gaokao exams.']],
  ['distinct', 'adj.', '清晰的；明显的；截然不同的', '真题', ['真题词频3次'], ['清晰的；明显的；截然不同的'], ['distinct appears in recent gaokao exams.']],
  ['principle', 'n.', '原则；原理；准则', '真题', ['真题词频3次'], ['原则；原理；准则'], ['principle appears in recent gaokao exams.']],
  ['pure', 'adj.', '纯的；纯净的；纯粹的；纯洁的', '真题', ['真题词频3次'], ['纯的；纯净的；纯粹的；纯洁的'], ['pure appears in recent gaokao exams.']],
  ['clarify', 'v.', '澄清；阐明；使清楚易懂', '真题', ['真题词频3次'], ['澄清；阐明；使清楚易懂'], ['clarify appears in recent gaokao exams.']],
  ['tourism', 'n.', '旅游业；观光业', '真题', ['真题词频3次'], ['旅游业；观光业'], ['tourism appears in recent gaokao exams.']],
  ['deliberately', 'adv.', '故意地；蓄意地；从容不迫地', '真题', ['真题词频3次'], ['故意地；蓄意地；从容不迫地'], ['deliberately appears in recent gaokao exams.']],
  ['sustain', 'v.', '维持；支撑；承受；经受；支持', '真题', ['真题词频3次'], ['维持；支撑；承受；经受；支持'], ['sustain appears in recent gaokao exams.']],
  ['agriculture', 'n.', '农业', '真题', ['真题词频3次'], ['农业'], ['agriculture appears in recent gaokao exams.']],
  ['authority', 'n.', '权力、权威、官方', '真题', ['真题词频3次'], ['权力、权威、官方'], ['authority appears in recent gaokao exams.']],
  ['conference', 'n.', '大型会议', '真题', ['真题词频3次'], ['大型会议'], ['conference appears in recent gaokao exams.']],
  ['context', 'n.', '上下文、语境', '真题', ['真题词频3次'], ['上下文、语境'], ['context appears in recent gaokao exams.']],
  ['estate', 'n.', '私有土地、庄园', '真题', ['真题词频3次'], ['私有土地、庄园'], ['estate appears in recent gaokao exams.']],
  ['hive', 'n.', '蜂箱', '真题', ['真题词频3次'], ['蜂箱'], ['hive appears in recent gaokao exams.']],
  ['maximum', 'adj.', '最大程度的', '真题', ['真题词频3次'], ['最大程度的'], ['maximum appears in recent gaokao exams.']],
  ['minimum', 'adj.', '最小程度的', '真题', ['真题词频3次'], ['最小程度的'], ['minimum appears in recent gaokao exams.']],
  ['personnel', 'n.', '全体人员、职员', '真题', ['真题词频3次'], ['全体人员、职员'], ['personnel appears in recent gaokao exams.']],
  ['scale', 'n.', '大小、规模、刻度', '真题', ['真题词频3次'], ['大小、规模、刻度'], ['scale appears in recent gaokao exams.']],
  ['straw', 'n.', '稻草', '真题', ['真题词频3次'], ['稻草'], ['straw appears in recent gaokao exams.']],
  ['position', 'n./v.', 'n.位置；立场；v.定位；安排', '真题', ['真题词频2次'], ['n.位置；立场；v.定位；安排'], ['position appears in recent gaokao exams.']],
  ['force', 'v./n.', 'v.强迫；n.力量', '真题', ['真题词频2次'], ['v.强迫；n.力量'], ['force appears in recent gaokao exams.']],
  ['satisfy', 'v.', '使满意', '真题', ['真题词频2次'], ['使满意'], ['satisfy appears in recent gaokao exams.']],
  ['organize', 'v.', '组织；安排', '真题', ['真题词频2次'], ['组织；安排'], ['organize appears in recent gaokao exams.']],
  ['favor', 'n./v.', 'n.好意；v.偏爱', '真题', ['真题词频2次'], ['n.好意；v.偏爱'], ['favor appears in recent gaokao exams.']],
  ['publish', 'v.', '出版；发行', '真题', ['真题词频2次'], ['出版；发行'], ['publish appears in recent gaokao exams.']],
  ['weigh', 'v.', '称（重量）；重达', '真题', ['真题词频2次'], ['称（重量）；重达'], ['weigh appears in recent gaokao exams.']],
  ['credit', 'n.', '信用', '真题', ['真题词频2次'], ['信用'], ['credit appears in recent gaokao exams.']],
  ['deliver', 'v.', '递送；发表（演讲）', '真题', ['真题词频2次'], ['递送；发表（演讲）'], ['deliver appears in recent gaokao exams.']],
  ['spread', 'v.', '延伸；传播', '真题', ['真题词频2次'], ['延伸；传播'], ['spread appears in recent gaokao exams.']],
  ['impress', 'v.', '使……有印象；留下深刻印象', '真题', ['真题词频2次'], ['使……有印象；留下深刻印象'], ['impress appears in recent gaokao exams.']],
  ['remind', 'v.', '提醒；使某人想起某事', '真题', ['真题词频2次'], ['提醒；使某人想起某事'], ['remind appears in recent gaokao exams.']],
  ['guidance', 'n.', '指导，给予方向或建议', '真题', ['真题词频2次'], ['指导，给予方向或建议'], ['guidance appears in recent gaokao exams.']],
  ['emotion', 'n.', '情绪，强烈的感情或心情', '真题', ['真题词频2次'], ['情绪，强烈的感情或心情'], ['emotion appears in recent gaokao exams.']],
  ['reward', 'n./v.', '奖赏，给予报酬或奖励', '真题', ['真题词频2次'], ['奖赏，给予报酬或奖励'], ['reward appears in recent gaokao exams.']],
  ['judge', 'v./n.', 'v.判断，对某事做出评价或决定；n.法官，负责审判的人', '真题', ['真题词频2次'], ['v.判断，对某事做出评价或决定；n.法官，负责审判的人'], ['judge appears in recent gaokao exams.']],
  ['spirit', 'n.', '精神，指人的思想、意志或情绪状态', '真题', ['真题词频2次'], ['精神，指人的思想、意志或情绪状态'], ['spirit appears in recent gaokao exams.']],
  ['fairly', 'adv.', '公正地，指公平、不偏不倚地', '真题', ['真题词频2次'], ['公正地，指公平、不偏不倚地'], ['fairly appears in recent gaokao exams.']],
  ['fellow', 'n.', '同事，指一起工作的人', '真题', ['真题词频2次'], ['同事，指一起工作的人'], ['fellow appears in recent gaokao exams.']],
  ['predict', 'v.', '预言；预测', '真题', ['真题词频2次'], ['预言；预测'], ['predict appears in recent gaokao exams.']],
  ['handle', 'v.', '处理；应付', '真题', ['真题词频2次'], ['处理；应付'], ['handle appears in recent gaokao exams.']],
  ['opposite', 'adj.', '相反的；对面的', '真题', ['真题词频2次'], ['相反的；对面的'], ['opposite appears in recent gaokao exams.']],
  ['struggle', 'n./v.', 'n.斗争；挣扎；v.斗争；挣扎（against）', '真题', ['真题词频2次'], ['n.斗争；挣扎；v.斗争；挣扎（against）'], ['struggle appears in recent gaokao exams.']],
  ['delight', 'n.', '高兴；愉快', '真题', ['真题词频2次'], ['高兴；愉快'], ['delight appears in recent gaokao exams.']],
  ['talent', 'n.', '天赋；才华', '真题', ['真题词频2次'], ['天赋；才华'], ['talent appears in recent gaokao exams.']],
  ['permit', 'v.', '允许', '真题', ['真题词频2次'], ['允许'], ['permit appears in recent gaokao exams.']],
  ['rapid', 'adj.', '迅速的', '真题', ['真题词频2次'], ['迅速的'], ['rapid appears in recent gaokao exams.']],
  ['conclude', 'v.', '总结', '真题', ['真题词频2次'], ['总结'], ['conclude appears in recent gaokao exams.']],
  ['possess', 'v.', '拥有', '真题', ['真题词频2次'], ['拥有'], ['possess appears in recent gaokao exams.']],
  ['feature', 'n.', '特征', '真题', ['真题词频2次'], ['特征'], ['feature appears in recent gaokao exams.']],
  ['switch', 'v.', '转换（开/关）', '真题', ['真题词频2次'], ['转换（开/关）'], ['switch appears in recent gaokao exams.']],
  ['fond', 'adj.', '喜欢的（of）', '真题', ['真题词频2次'], ['喜欢的（of）'], ['fond appears in recent gaokao exams.']],
  ['motivate', 'v.', '激发；激励', '真题', ['真题词频2次'], ['激发；激励'], ['motivate appears in recent gaokao exams.']],
  ['trick', 'v./n.', 'v.欺骗；n.诡计', '真题', ['真题词频2次'], ['v.欺骗；n.诡计'], ['trick appears in recent gaokao exams.']],
  ['debate', 'v./n.', 'v./n.辩论；n.辩论会', '真题', ['真题词频2次'], ['v./n.辩论；n.辩论会'], ['debate appears in recent gaokao exams.']],
  ['deserve', 'v.', '应得；值得', '真题', ['真题词频2次'], ['应得；值得'], ['deserve appears in recent gaokao exams.']],
  ['alternative', 'adj./n.', 'adj.可供替代的；n.可供选择的事物', '真题', ['真题词频2次'], ['adj.可供替代的；n.可供选择的事物'], ['alternative appears in recent gaokao exams.']],
  ['analyze', 'v.', '分析', '真题', ['真题词频2次'], ['分析'], ['analyze appears in recent gaokao exams.']],
  ['legal', 'adj.', '法律的；合法的', '真题', ['真题词频2次'], ['法律的；合法的'], ['legal appears in recent gaokao exams.']],
  ['compete', 'v.', '竞争；比赛', '真题', ['真题词频2次'], ['竞争；比赛'], ['compete appears in recent gaokao exams.']],
  ['sharp', 'adj.', 'adj.锋利的；尖锐的；敏锐的', '真题', ['真题词频2次'], ['adj.锋利的；尖锐的；敏锐的'], ['sharp appears in recent gaokao exams.']],
  ['absorb', 'v.', '吸收；理解；使全神贯注', '真题', ['真题词频2次'], ['吸收；理解；使全神贯注'], ['absorb appears in recent gaokao exams.']],
  ['adapt', 'v.', '使适应；改编', '真题', ['真题词频2次'], ['使适应；改编'], ['adapt appears in recent gaokao exams.']],
  ['confidence', 'n.', '信心；信任', '真题', ['真题词频2次'], ['信心；信任'], ['confidence appears in recent gaokao exams.']],
  ['attach', 'v.', '系；贴；附加；使依恋', '真题', ['真题词频2次'], ['系；贴；附加；使依恋'], ['attach appears in recent gaokao exams.']],
  ['engage', 'v.', '吸引；使参与；从事', '真题', ['真题词频2次'], ['吸引；使参与；从事'], ['engage appears in recent gaokao exams.']],
  ['political', 'adj.', '政治的；政党的', '真题', ['真题词频2次'], ['政治的；政党的'], ['political appears in recent gaokao exams.']],
  ['adjust', 'v.', '调整；调节；适应', '真题', ['真题词频2次'], ['调整；调节；适应'], ['adjust appears in recent gaokao exams.']],
  ['capital', 'n.', 'n.首都；资本；大写字母', '真题', ['真题词频2次'], ['n.首都；资本；大写字母'], ['capital appears in recent gaokao exams.']],
  ['sweep', 'v./n.', 'v.打扫；清扫；席卷；迅速传播；n.打扫；挥动', '真题', ['真题词频2次'], ['v.打扫；清扫；席卷；迅速传播；n.打扫；挥动'], ['sweep appears in recent gaokao exams.']],
  ['appointment', 'n.', '约会；预约；任命', '真题', ['真题词频2次'], ['约会；预约；任命'], ['appointment appears in recent gaokao exams.']],
  ['charity', 'n.', '慈善；慈善机构；施舍', '真题', ['真题词频2次'], ['慈善；慈善机构；施舍'], ['charity appears in recent gaokao exams.']],
  ['consult', 'v.', '咨询；请教；查阅', '真题', ['真题词频2次'], ['咨询；请教；查阅'], ['consult appears in recent gaokao exams.']],
  ['participate', 'v.', '参加；参与', '真题', ['真题词频2次'], ['参加；参与'], ['participate appears in recent gaokao exams.']],
  ['explode', 'v.', '爆炸；爆发；激增', '真题', ['真题词频2次'], ['爆炸；爆发；激增'], ['explode appears in recent gaokao exams.']],
  ['theory', 'n.', '理论；学说', '真题', ['真题词频2次'], ['理论；学说'], ['theory appears in recent gaokao exams.']],
  ['minor', 'adj./n.', 'adj.较小的；次要的；轻微的；n.未成年人', '真题', ['真题词频2次'], ['adj.较小的；次要的；轻微的；n.未成年人'], ['minor appears in recent gaokao exams.']],
  ['academic', 'adj./n.', 'adj.学术的；学业的；学院的；n.学者', '真题', ['真题词频2次'], ['adj.学术的；学业的；学院的；n.学者'], ['academic appears in recent gaokao exams.']],
  ['pile', 'v./n.', 'v.堆放；堆积；n.一堆；大量', '真题', ['真题词频2次'], ['v.堆放；堆积；n.一堆；大量'], ['pile appears in recent gaokao exams.']],
  ['contest', 'v./n.', 'v.竞争；质疑；n.比赛；竞赛', '真题', ['真题词频2次'], ['v.竞争；质疑；n.比赛；竞赛'], ['contest appears in recent gaokao exams.']],
  ['comprehension', 'n.', '理解；领悟；理解力', '真题', ['真题词频2次'], ['理解；领悟；理解力'], ['comprehension appears in recent gaokao exams.']],
  ['crisis', 'n.', '危机；危急关头；（病情）危险期', '真题', ['真题词频2次'], ['危机；危急关头；（病情）危险期'], ['crisis appears in recent gaokao exams.']],
  ['routine', 'n./adj.', 'n.常规；例行公事；日常惯例；adj.常规的；例行的', '真题', ['真题词频2次'], ['n.常规；例行公事；日常惯例；adj.常规的；例行的'], ['routine appears in recent gaokao exams.']],
  ['absence', 'n.', '缺席；不在；缺乏', '真题', ['真题词频2次'], ['缺席；不在；缺乏'], ['absence appears in recent gaokao exams.']],
  ['decrease', 'v./n.', 'v.减少；降低；n.减少；降低；减少量', '真题', ['真题词频2次'], ['v.减少；降低；n.减少；降低；减少量'], ['decrease appears in recent gaokao exams.']],
  ['vast', 'adj.', '巨大的；辽阔的；大量的', '真题', ['真题词频2次'], ['巨大的；辽阔的；大量的'], ['vast appears in recent gaokao exams.']],
  ['acquire', 'v.', '获得；取得；学到', '真题', ['真题词频2次'], ['获得；取得；学到'], ['acquire appears in recent gaokao exams.']],
  ['estimate', 'v./n.', 'v.估计；估算；评价；n.估计；估算；评价', '真题', ['真题词频2次'], ['v.估计；估算；评价；n.估计；估算；评价'], ['estimate appears in recent gaokao exams.']],
  ['critical', 'adj.', '关键的；批判性的；危急的', '真题', ['真题词频2次'], ['关键的；批判性的；危急的'], ['critical appears in recent gaokao exams.']],
  ['strike', 'v./n.', 'v.撞击；击打；罢工；突然想到；n.罢工；袭击', '真题', ['真题词频2次'], ['v.撞击；击打；罢工；突然想到；n.罢工；袭击'], ['strike appears in recent gaokao exams.']],
  ['identify', 'v.', '认出；识别；鉴定；认同', '真题', ['真题词频2次'], ['认出；识别；鉴定；认同'], ['identify appears in recent gaokao exams.']],
  ['peer', 'v./n.', 'v.仔细看；端详；n.同龄人；同等地位的人', '真题', ['真题词频2次'], ['v.仔细看；端详；n.同龄人；同等地位的人'], ['peer appears in recent gaokao exams.']],
  ['loose', 'adj.', '宽松的；松散的；不牢固的', '真题', ['真题词频2次'], ['宽松的；松散的；不牢固的'], ['loose appears in recent gaokao exams.']],
  ['rough', 'adj.', '粗糙的；不平滑的；粗略的；艰难的', '真题', ['真题词频2次'], ['粗糙的；不平滑的；粗略的；艰难的'], ['rough appears in recent gaokao exams.']],
  ['negotiate', 'v.', '谈判；协商；洽谈', '真题', ['真题词频2次'], ['谈判；协商；洽谈'], ['negotiate appears in recent gaokao exams.']],
  ['sculpture', 'n./v.', 'n.雕塑；雕刻作品；v.雕刻；雕塑', '真题', ['真题词频2次'], ['n.雕塑；雕刻作品；v.雕刻；雕塑'], ['sculpture appears in recent gaokao exams.']],
  ['unemployment', 'n.', '失业；失业率', '真题', ['真题词频2次'], ['失业；失业率'], ['unemployment appears in recent gaokao exams.']],
  ['seize', 'v.', '抓住；捉住；夺取；攻占；把握（机会等）', '真题', ['真题词频2次'], ['抓住；捉住；夺取；攻占；把握（机会等）'], ['seize appears in recent gaokao exams.']],
  ['cooperate', 'v.', '合作；协作；配合', '真题', ['真题词频2次'], ['合作；协作；配合'], ['cooperate appears in recent gaokao exams.']],
  ['salary', 'n.', '薪水；薪金', '真题', ['真题词频2次'], ['薪水；薪金'], ['salary appears in recent gaokao exams.']],
  ['calculate', 'v.', '计算；核算；预测；推测', '真题', ['真题词频2次'], ['计算；核算；预测；推测'], ['calculate appears in recent gaokao exams.']],
  ['permanent', 'adj.', '永久的；永恒的；长久的', '真题', ['真题词频2次'], ['永久的；永恒的；长久的'], ['permanent appears in recent gaokao exams.']],
  ['pesticide', 'n.', '杀虫剂；农药', '真题', ['真题词频2次'], ['杀虫剂；农药'], ['pesticide appears in recent gaokao exams.']],
  ['surgery', 'n.', '外科手术；外科学；诊所', '真题', ['真题词频2次'], ['外科手术；外科学；诊所'], ['surgery appears in recent gaokao exams.']],
  ['trail', 'v./n.', 'v.跟踪；追踪；拖；拉；（尤指植物）蔓延；n.踪迹；痕迹；小道；小径', '真题', ['真题词频2次'], ['v.跟踪；追踪；拖；拉；（尤指植物）蔓延；n.踪迹；痕迹；小道；小径'], ['trail appears in recent gaokao exams.']],
  ['fundamental', 'adj./n.', 'adj.基础的；根本的；n.基本规律；根本法则；基本原理', '真题', ['真题词频2次'], ['adj.基础的；根本的；n.基本规律；根本法则；基本原理'], ['fundamental appears in recent gaokao exams.']],
  ['moderate', 'adj./n./v.', 'adj.适度的；中等的；温和的；不激烈的；n.持温和观点者；v.缓和；使适中；审核评分（给作业）', '真题', ['真题词频2次'], ['adj.适度的；中等的；温和的；不激烈的；n.持温和观点者；v.缓和；使适中；审核评分（给作业）'], ['moderate appears in recent gaokao exams.']],
  ['delicate', 'adj.', '易损的；易碎的；脆弱的；微妙的；精美的；熟练的', '真题', ['真题词频2次'], ['易损的；易碎的；脆弱的；微妙的；精美的；熟练的'], ['delicate appears in recent gaokao exams.']],
  ['prejudice', 'n./v.', 'n.偏见；成见；v.使怀有（或形成）偏见', '真题', ['真题词频2次'], ['n.偏见；成见；v.使怀有（或形成）偏见'], ['prejudice appears in recent gaokao exams.']],
  ['lean', 'v./adj.', 'v.倾斜；倚靠；靠在；adj.瘦且健康的；贫乏的；歉收的', '真题', ['真题词频2次'], ['v.倾斜；倚靠；靠在；adj.瘦且健康的；贫乏的；歉收的'], ['lean appears in recent gaokao exams.']],
  ['tolerate', 'v.', '容许；允许；忍受；容忍', '真题', ['真题词频2次'], ['容许；允许；忍受；容忍'], ['tolerate appears in recent gaokao exams.']],
  ['approximately', 'adv.', '大约；大概', '真题', ['真题词频2次'], ['大约；大概'], ['approximately appears in recent gaokao exams.']],
  ['abnormal', 'adj.', '不正常的；反常的；变态的', '真题', ['真题词频2次'], ['不正常的；反常的；变态的'], ['abnormal appears in recent gaokao exams.']],
  ['lighten', 'v.', '（使）变亮；（使）减轻；使轻松愉快', '真题', ['真题词频2次'], ['（使）变亮；（使）减轻；使轻松愉快'], ['lighten appears in recent gaokao exams.']],
  ['worthwhile', 'adj.', '值得花时间（或花钱、努力等）的；重要的', '真题', ['真题词频2次'], ['值得花时间（或花钱、努力等）的；重要的'], ['worthwhile appears in recent gaokao exams.']],
  ['anticipate', 'v.', '预期、期待', '真题', ['真题词频2次'], ['预期、期待'], ['anticipate appears in recent gaokao exams.']],
  ['authentic', 'adj.', '真正的、真品的', '真题', ['真题词频2次'], ['真正的、真品的'], ['authentic appears in recent gaokao exams.']],
  ['biography', 'n.', '人物传记', '真题', ['真题词频2次'], ['人物传记'], ['biography appears in recent gaokao exams.']],
  ['botany', 'n.', '植物学', '真题', ['真题词频2次'], ['植物学'], ['botany appears in recent gaokao exams.']],
  ['brewery', 'n.', '酿酒厂', '真题', ['真题词频2次'], ['酿酒厂'], ['brewery appears in recent gaokao exams.']],
  ['bunch', 'n.', '一束、大量', '真题', ['真题词频2次'], ['一束、大量'], ['bunch appears in recent gaokao exams.']],
  ['cathedral', 'n.', '大教堂', '真题', ['真题词频2次'], ['大教堂'], ['cathedral appears in recent gaokao exams.']],
  ['compensate', 'v.', '补偿、弥补', '真题', ['真题词频2次'], ['补偿、弥补'], ['compensate appears in recent gaokao exams.']],
  ['digest', 'v.', '消化、吸收', '真题', ['真题词频2次'], ['消化、吸收'], ['digest appears in recent gaokao exams.']],
  ['geography', 'n.', '地理学', '真题', ['真题词频2次'], ['地理学'], ['geography appears in recent gaokao exams.']],
  ['initiative', 'n.', '倡议', '真题', ['真题词频2次'], ['倡议'], ['initiative appears in recent gaokao exams.']],
  ['mine', 'n.', '矿', '真题', ['真题词频2次'], ['矿'], ['mine appears in recent gaokao exams.']],
  ['profession', 'n.', '职业', '真题', ['真题词频2次'], ['职业'], ['profession appears in recent gaokao exams.']],
  ['vocabulary', 'n.', '词汇', '真题', ['真题词频2次'], ['词汇'], ['vocabulary appears in recent gaokao exams.']],
  ['wool', 'n.', '羊毛、羊绒', '真题', ['真题词频2次'], ['羊毛、羊绒'], ['wool appears in recent gaokao exams.']],
  ['realise', 'v.', '认识到；意识到；实现；了解；将（概念等）变成现实', '真题', ['真题词频1次'], ['认识到；意识到；实现；了解；将（概念等）变成现实'], ['realise appears in recent gaokao exams.']],
  ['hang', 'v.', '悬挂；吊；垂下；（被）绞死；上吊；安装（门、窗等）', '真题', ['真题词频1次'], ['悬挂；吊；垂下；（被）绞死；上吊；安装（门、窗等）'], ['hang appears in recent gaokao exams.']],
  ['vary', 'v.', '改变；不同，指事物之间的差异或变化', '真题', ['真题词频1次'], ['改变；不同，指事物之间的差异或变化'], ['vary appears in recent gaokao exams.']],
  ['suffer', 'v.', '遭受，指经历痛苦、损失或不幸', '真题', ['真题词频1次'], ['遭受，指经历痛苦、损失或不幸'], ['suffer appears in recent gaokao exams.']],
  ['damage', 'v./n.', 'v.损害；n.损害', '真题', ['真题词频1次'], ['v.损害；n.损害'], ['damage appears in recent gaokao exams.']],
  ['visible', 'adj.', '可见的', '真题', ['真题词频1次'], ['可见的'], ['visible appears in recent gaokao exams.']],
  ['operate', 'v.', '操作；经营；动手术', '真题', ['真题词频1次'], ['操作；经营；动手术'], ['operate appears in recent gaokao exams.']],
  ['warn', 'v.', '警告', '真题', ['真题词频1次'], ['警告'], ['warn appears in recent gaokao exams.']],
  ['hardly', 'adv.', '几乎不，表示程度极低', '真题', ['真题词频1次'], ['几乎不，表示程度极低'], ['hardly appears in recent gaokao exams.']],
  ['greedy', 'adj.', '贪婪的，过分渴望或追求某物', '真题', ['真题词频1次'], ['贪婪的，过分渴望或追求某物'], ['greedy appears in recent gaokao exams.']],
  ['confuse', 'v.', '使困惑，让人迷惑不解', '真题', ['真题词频1次'], ['使困惑，让人迷惑不解'], ['confuse appears in recent gaokao exams.']],
  ['attempt', 'v./n.', 'v./n.企图；尝试做某事', '真题', ['真题词频1次'], ['v./n.企图；尝试做某事'], ['attempt appears in recent gaokao exams.']],
  ['argument', 'n.', '观点，指对某事的看法或争论', '真题', ['真题词频1次'], ['观点，指对某事的看法或争论'], ['argument appears in recent gaokao exams.']],
  ['desert', 'n.', '沙漠，指干旱、少雨的地区', '真题', ['真题词频1次'], ['沙漠，指干旱、少雨的地区'], ['desert appears in recent gaokao exams.']],
  ['seldom', 'adv.', '很少，指不常发生或出现的', '真题', ['真题词频1次'], ['很少，指不常发生或出现的'], ['seldom appears in recent gaokao exams.']],
  ['consume', 'v.', '消耗；消费', '真题', ['真题词频1次'], ['消耗；消费'], ['consume appears in recent gaokao exams.']],
  ['devote', 'v.', '致力于（to）；专心于', '真题', ['真题词频1次'], ['致力于（to）；专心于'], ['devote appears in recent gaokao exams.']],
  ['complain', 'v.', '抱怨（to/about）', '真题', ['真题词频1次'], ['抱怨（to/about）'], ['complain appears in recent gaokao exams.']],
  ['annoy', 'v.', '使恼怒；烦扰', '真题', ['真题词频1次'], ['使恼怒；烦扰'], ['annoy appears in recent gaokao exams.']],
  ['arrange', 'v.', '安排；筹划', '真题', ['真题词频1次'], ['安排；筹划'], ['arrange appears in recent gaokao exams.']],
  ['rarely', 'adv.', '很少；不常', '真题', ['真题词频1次'], ['很少；不常'], ['rarely appears in recent gaokao exams.']],
  ['colleague', 'n.', '同事', '真题', ['真题词频1次'], ['同事'], ['colleague appears in recent gaokao exams.']],
  ['survive', 'v.', '幸存', '真题', ['真题词频1次'], ['幸存'], ['survive appears in recent gaokao exams.']],
  ['surround', 'v.', '包围', '真题', ['真题词频1次'], ['包围'], ['surround appears in recent gaokao exams.']],
  ['cast', 'v.', '投射；掷', '真题', ['真题词频1次'], ['投射；掷'], ['cast appears in recent gaokao exams.']],
  ['aware', 'adj.', '意识到的（of）', '真题', ['真题词频1次'], ['意识到的（of）'], ['aware appears in recent gaokao exams.']],
  ['narrow', 'v./adj.', 'v.（使）变窄；adj.狭窄的', '真题', ['真题词频1次'], ['v.（使）变窄；adj.狭窄的'], ['narrow appears in recent gaokao exams.']],
  ['conduct', 'v.', '实施；指挥', '真题', ['真题词频1次'], ['实施；指挥'], ['conduct appears in recent gaokao exams.']],
  ['overcome', 'v.', '战胜；克服', '真题', ['真题词频1次'], ['战胜；克服'], ['overcome appears in recent gaokao exams.']],
  ['translate', 'v.', '翻译', '真题', ['真题词频1次'], ['翻译'], ['translate appears in recent gaokao exams.']],
  ['guard', 'v./n.', 'v.保卫；n.看守人', '真题', ['真题词频1次'], ['v.保卫；n.看守人'], ['guard appears in recent gaokao exams.']],
  ['anxiety', 'n.', '焦虑；不安', '真题', ['真题词频1次'], ['焦虑；不安'], ['anxiety appears in recent gaokao exams.']],
  ['concentrate', 'v.', '集中（注意力等）；专心', '真题', ['真题词频1次'], ['集中（注意力等）；专心'], ['concentrate appears in recent gaokao exams.']],
  ['quit', 'v.', '停止；放弃；离开', '真题', ['真题词频1次'], ['停止；放弃；离开'], ['quit appears in recent gaokao exams.']],
  ['stare', 'v./n.', 'v./n.凝视；盯着看', '真题', ['真题词频1次'], ['v./n.凝视；盯着看'], ['stare appears in recent gaokao exams.']],
  ['admire', 'v.', '钦佩；赞赏；欣赏', '真题', ['真题词频1次'], ['钦佩；赞赏；欣赏'], ['admire appears in recent gaokao exams.']],
  ['apologize', 'v.', '道歉', '真题', ['真题词频1次'], ['道歉'], ['apologize appears in recent gaokao exams.']],
  ['vehicle', 'n.', '车辆；交通工具', '真题', ['真题词频1次'], ['车辆；交通工具'], ['vehicle appears in recent gaokao exams.']],
  ['brief', 'adj./n.', 'adj.简短的；短暂的；n.摘要；概要', '真题', ['真题词频1次'], ['adj.简短的；短暂的；n.摘要；概要'], ['brief appears in recent gaokao exams.']],
  ['consequence', 'n.', '结果；后果', '真题', ['真题词频1次'], ['结果；后果'], ['consequence appears in recent gaokao exams.']],
  ['bitter', 'adj.', 'adj.苦的；痛苦的；充满仇恨的', '真题', ['真题词频1次'], ['adj.苦的；痛苦的；充满仇恨的'], ['bitter appears in recent gaokao exams.']],
  ['shame', 'n./v.', 'n.羞耻；羞愧；憾事；v.使羞愧', '真题', ['真题词频1次'], ['n.羞耻；羞愧；憾事；v.使羞愧'], ['shame appears in recent gaokao exams.']],
  ['regardless', 'adv.', '不顾；不管', '真题', ['真题词频1次'], ['不顾；不管'], ['regardless appears in recent gaokao exams.']],
  ['commercial', 'adj./n.', 'adj.商业的；营利性的；n.商业广告', '真题', ['真题词频1次'], ['adj.商业的；营利性的；n.商业广告'], ['commercial appears in recent gaokao exams.']],
  ['astonish', 'v.', '使惊讶；使震惊', '真题', ['真题词频1次'], ['使惊讶；使震惊'], ['astonish appears in recent gaokao exams.']],
  ['guarantee', 'v./n.', 'v.保证；担保；n.保证；担保；保修单', '真题', ['真题词频1次'], ['v.保证；担保；n.保证；担保；保修单'], ['guarantee appears in recent gaokao exams.']],
  ['block', 'v./n.', 'v.堵塞；阻碍；n.街区；大块；障碍物', '真题', ['真题词频1次'], ['v.堵塞；阻碍；n.街区；大块；障碍物'], ['block appears in recent gaokao exams.']],
  ['emergency', 'n.', '紧急情况；突发事件', '真题', ['真题词频1次'], ['紧急情况；突发事件'], ['emergency appears in recent gaokao exams.']],
  ['sink', 'v./n.', 'v.下沉；沉没；使下降；陷入（困境等）；n.水槽', '真题', ['真题词频1次'], ['v.下沉；沉没；使下降；陷入（困境等）；n.水槽'], ['sink appears in recent gaokao exams.']],
  ['wander', 'v.', '徘徊；漫步；走神', '真题', ['真题词频1次'], ['徘徊；漫步；走神'], ['wander appears in recent gaokao exams.']],
  ['precise', 'adj.', '精确的；准确的；确切的', '真题', ['真题词频1次'], ['精确的；准确的；确切的'], ['precise appears in recent gaokao exams.']],
  ['gap', 'n.', '缺口；差距；间隙', '真题', ['真题词频1次'], ['缺口；差距；间隙'], ['gap appears in recent gaokao exams.']],
  ['apparent', 'adj.', '显而易见的；明显的；表面上的', '真题', ['真题词频1次'], ['显而易见的；明显的；表面上的'], ['apparent appears in recent gaokao exams.']],
  ['withdraw', 'v.', '撤回；撤离；取（款）；退出', '真题', ['真题词频1次'], ['撤回；撤离；取（款）；退出'], ['withdraw appears in recent gaokao exams.']],
  ['enable', 'v.', '使能够；使成为可能', '真题', ['真题词频1次'], ['使能够；使成为可能'], ['enable appears in recent gaokao exams.']],
  ['thick', 'adj.', 'adj.厚的；浓的；茂密的', '真题', ['真题词频1次'], ['adj.厚的；浓的；茂密的'], ['thick appears in recent gaokao exams.']],
  ['optimistic', 'adj.', '乐观的；乐观主义的', '真题', ['真题词频1次'], ['乐观的；乐观主义的'], ['optimistic appears in recent gaokao exams.']],
  ['addiction', 'n.', '上瘾；沉溺；嗜好', '真题', ['真题词频1次'], ['上瘾；沉溺；嗜好'], ['addiction appears in recent gaokao exams.']],
  ['facility', 'n.', '设施；设备；便利；才能', '真题', ['真题词频1次'], ['设施；设备；便利；才能'], ['facility appears in recent gaokao exams.']],
  ['associate', 'v./n.', 'v.联想；联系；交往；n.同事；伙伴', '真题', ['真题词频1次'], ['v.联想；联系；交往；n.同事；伙伴'], ['associate appears in recent gaokao exams.']],
  ['severe', 'adj.', '严峻的；严厉的；严重的', '真题', ['真题词频1次'], ['严峻的；严厉的；严重的'], ['severe appears in recent gaokao exams.']],
  ['chain', 'n./v.', 'n.链子；链条；一连串；连锁店；v.用链子拴住', '真题', ['真题词频1次'], ['n.链子；链条；一连串；连锁店；v.用链子拴住'], ['chain appears in recent gaokao exams.']],
  ['preserve', 'v.', '保护；维护；保存；腌制', '真题', ['真题词频1次'], ['保护；维护；保存；腌制'], ['preserve appears in recent gaokao exams.']],
  ['manufacture', 'v./n.', 'v.（用机器大量）制造，生产；编造；n.制造；制造业', '真题', ['真题词频1次'], ['v.（用机器大量）制造，生产；编造；n.制造；制造业'], ['manufacture appears in recent gaokao exams.']],
  ['foundation', 'n.', '基础；地基；基金会', '真题', ['真题词频1次'], ['基础；地基；基金会'], ['foundation appears in recent gaokao exams.']],
  ['temporary', 'adj.', '暂时的；临时的', '真题', ['真题词频1次'], ['暂时的；临时的'], ['temporary appears in recent gaokao exams.']],
  ['beneficial', 'adj.', '有益的；有利的', '真题', ['真题词频1次'], ['有益的；有利的'], ['beneficial appears in recent gaokao exams.']],
  ['define', 'v.', '给……下定义；界定；明确', '真题', ['真题词频1次'], ['给……下定义；界定；明确'], ['define appears in recent gaokao exams.']],
  ['exhausted', 'adj.', '筋疲力尽的；耗尽的', '真题', ['真题词频1次'], ['筋疲力尽的；耗尽的'], ['exhausted appears in recent gaokao exams.']],
  ['glance', 'v./n.', 'v.瞥一眼；匆匆一看；n.一瞥；匆匆一看', '真题', ['真题词频1次'], ['v.瞥一眼；匆匆一看；n.一瞥；匆匆一看'], ['glance appears in recent gaokao exams.']],
  ['uncertain', 'adj.', '不确定的；无把握的；多变的', '真题', ['真题词频1次'], ['不确定的；无把握的；多变的'], ['uncertain appears in recent gaokao exams.']],
  ['ashamed', 'adj.', '羞愧的；惭愧的', '真题', ['真题词频1次'], ['羞愧的；惭愧的'], ['ashamed appears in recent gaokao exams.']],
  ['illegal', 'adj.', '非法的；违法的', '真题', ['真题词频1次'], ['非法的；违法的'], ['illegal appears in recent gaokao exams.']],
  ['vivid', 'adj.', '生动的；逼真的；鲜明的', '真题', ['真题词频1次'], ['生动的；逼真的；鲜明的'], ['vivid appears in recent gaokao exams.']],
  ['absolute', 'adj.', '绝对的；完全的；十足的', '真题', ['真题词频1次'], ['绝对的；完全的；十足的'], ['absolute appears in recent gaokao exams.']],
  ['administration', 'n.', '管理；行政；管理部门；（尤指美国）政府', '真题', ['真题词频1次'], ['管理；行政；管理部门；（尤指美国）政府'], ['administration appears in recent gaokao exams.']],
  ['treasure', 'n./v.', 'n.金银财宝；财富；珍品；v.珍视；珍爱', '真题', ['真题词频1次'], ['n.金银财宝；财富；珍品；v.珍视；珍爱'], ['treasure appears in recent gaokao exams.']],
  ['foster', 'v./adj.', 'v.促进；培养；收养；adj.寄养的；代养的', '真题', ['真题词频1次'], ['v.促进；培养；收养；adj.寄养的；代养的'], ['foster appears in recent gaokao exams.']],
  ['freezing', 'adj./n.', 'adj.极冷的；冰冻的；n.冰点', '真题', ['真题词频1次'], ['adj.极冷的；冰冻的；n.冰点'], ['freezing appears in recent gaokao exams.']],
  ['antique', 'n./adj.', 'n.古董；古玩；adj.古老的；古董的', '真题', ['真题词频1次'], ['n.古董；古玩；adj.古老的；古董的'], ['antique appears in recent gaokao exams.']],
  ['scare', 'v./n.', 'v.使害怕；惊吓；受惊吓；n.恐慌；惊吓', '真题', ['真题词频1次'], ['v.使害怕；惊吓；受惊吓；n.恐慌；惊吓'], ['scare appears in recent gaokao exams.']],
  ['desperate', 'adj.', '绝望的；不顾一切的；极其需要的', '真题', ['真题词频1次'], ['绝望的；不顾一切的；极其需要的'], ['desperate appears in recent gaokao exams.']],
  ['payment', 'n.', '付款；支付；支付的款项', '真题', ['真题词频1次'], ['付款；支付；支付的款项'], ['payment appears in recent gaokao exams.']],
  ['priority', 'n.', '优先事项；首要事情；优先权', '真题', ['真题词频1次'], ['优先事项；首要事情；优先权'], ['priority appears in recent gaokao exams.']],
  ['procedure', 'n.', '程序；手续；步骤', '真题', ['真题词频1次'], ['程序；手续；步骤'], ['procedure appears in recent gaokao exams.']],
  ['quote', 'v./n.', 'v.引用；引述；报价；n.引文；引语；报价', '真题', ['真题词频1次'], ['v.引用；引述；报价；n.引文；引语；报价'], ['quote appears in recent gaokao exams.']],
  ['tight', 'adj./adv.', 'adj.紧的；牢固的；紧身的；紧密的；（时间）紧的；adv.紧紧地；牢固地', '真题', ['真题词频1次'], ['adj.紧的；牢固的；紧身的；紧密的；（时间）紧的；adv.紧紧地；牢固地'], ['tight appears in recent gaokao exams.']],
  ['flexible', 'adj.', '灵活的；可弯曲的；柔韧的', '真题', ['真题词频1次'], ['灵活的；可弯曲的；柔韧的'], ['flexible appears in recent gaokao exams.']],
  ['barely', 'adv.', '仅仅；几乎不；勉强可能', '真题', ['真题词频1次'], ['仅仅；几乎不；勉强可能'], ['barely appears in recent gaokao exams.']],
  ['optional', 'adj.', '可选择的；非强制的', '真题', ['真题词频1次'], ['可选择的；非强制的'], ['optional appears in recent gaokao exams.']],
  ['emphasis', 'n.', '强调；重视；重要性', '真题', ['真题词频1次'], ['强调；重视；重要性'], ['emphasis appears in recent gaokao exams.']],
  ['legend', 'n.', '传说；传奇故事；传奇人物', '真题', ['真题词频1次'], ['传说；传奇故事；传奇人物'], ['legend appears in recent gaokao exams.']],
  ['swallow', 'v./n.', 'v.吞下；咽下；（因紧张等）做吞咽动作；吞没；淹没；n.吞；咽；燕子', '真题', ['真题词频1次'], ['v.吞下；咽下；（因紧张等）做吞咽动作；吞没；淹没；n.吞；咽；燕子'], ['swallow appears in recent gaokao exams.']],
  ['fulfill', 'v.', '履行（诺言等）；执行（命令等）；实现（梦想等）；满足（需求等）', '真题', ['真题词频1次'], ['履行（诺言等）；执行（命令等）；实现（梦想等）；满足（需求等）'], ['fulfill appears in recent gaokao exams.']],
  ['unforgettable', 'adj.', '难以忘记的；令人难忘的', '真题', ['真题词频1次'], ['难以忘记的；令人难忘的'], ['unforgettable appears in recent gaokao exams.']],
  ['abstract', 'adj./n./v.', 'adj.抽象的；纯理论的；n.摘要；抽象派艺术作品；v.提取；抽取；使抽象化', '真题', ['真题词频1次'], ['adj.抽象的；纯理论的；n.摘要；抽象派艺术作品；v.提取；抽取；使抽象化'], ['abstract appears in recent gaokao exams.']],
  ['appetite', 'n.', '食欲；胃口；强烈欲望', '真题', ['真题词频1次'], ['食欲；胃口；强烈欲望'], ['appetite appears in recent gaokao exams.']],
  ['vain', 'adj.', '徒劳的；无效的；自负的；虚荣的', '真题', ['真题词频1次'], ['徒劳的；无效的；自负的；虚荣的'], ['vain appears in recent gaokao exams.']],
  ['breakthrough', 'n.', '突破；重大进展', '真题', ['真题词频1次'], ['突破；重大进展'], ['breakthrough appears in recent gaokao exams.']],
  ['mature', 'adj./v.', 'adj.成熟的；理智的；成年的；发育完全的；v.成熟；长成；使成熟', '真题', ['真题词频1次'], ['adj.成熟的；理智的；成年的；发育完全的；v.成熟；长成；使成熟'], ['mature appears in recent gaokao exams.']],
  ['latter', 'adj./n.', 'adj.后者的；后半的；（两者中）较后的；n.后者', '真题', ['真题词频1次'], ['adj.后者的；后半的；（两者中）较后的；n.后者'], ['latter appears in recent gaokao exams.']],
  ['damp', 'adj./n./v.', 'adj.潮湿的；n.潮湿；湿气；v.使潮湿；减弱；抑制', '真题', ['真题词频1次'], ['adj.潮湿的；n.潮湿；湿气；v.使潮湿；减弱；抑制'], ['damp appears in recent gaokao exams.']],
  ['neglect', 'v./n.', 'v.忽视；忽略；疏忽；疏漏；n.忽视；疏忽', '真题', ['真题词频1次'], ['v.忽视；忽略；疏忽；疏漏；n.忽视；疏忽'], ['neglect appears in recent gaokao exams.']],
  ['accelerate', 'v.', '（使）加速；加快；促进', '真题', ['真题词频1次'], ['（使）加速；加快；促进'], ['accelerate appears in recent gaokao exams.']],
  ['temptation', 'n.', '引诱；诱惑；煽诱人的事物', '真题', ['真题词频1次'], ['引诱；诱惑；煽诱人的事物'], ['temptation appears in recent gaokao exams.']],
  ['angle', 'n./v.', 'n.角；角度；观点；立场；v.斜移；斜置；从（特定角度）报道', '真题', ['真题词频1次'], ['n.角；角度；观点；立场；v.斜移；斜置；从（特定角度）报道'], ['angle appears in recent gaokao exams.']],
  ['decisive', 'adj.', '决定性的；关键的；坚决的；果断的', '真题', ['真题词频1次'], ['决定性的；关键的；坚决的；果断的'], ['decisive appears in recent gaokao exams.']],
  ['time-consuming', 'adj.', '耗时的；旷日持久的', '真题', ['真题词频1次'], ['耗时的；旷日持久的'], ['time-consuming appears in recent gaokao exams.']],
  ['ambiguous', 'adj.', '模棱两可的；含混不清的', '真题', ['真题词频1次'], ['模棱两可的；含混不清的'], ['ambiguous appears in recent gaokao exams.']],
  ['aluminium', 'n.', '铝', '真题', ['真题词频1次'], ['铝'], ['aluminium appears in recent gaokao exams.']],
  ['bacteria', 'n.', '细菌', '真题', ['真题词频1次'], ['细菌'], ['bacteria appears in recent gaokao exams.']],
  ['behalf', 'n.', '代表某人', '真题', ['真题词频1次'], ['代表某人'], ['behalf appears in recent gaokao exams.']],
  ['bind', 'v.', '捆绑、绑定', '真题', ['真题词频1次'], ['捆绑、绑定'], ['bind appears in recent gaokao exams.']],
  ['butcher', 'n.', '屠夫', '真题', ['真题词频1次'], ['屠夫'], ['butcher appears in recent gaokao exams.']],
  ['circuit', 'n.', '电路、环形路线', '真题', ['真题词频1次'], ['电路、环形路线'], ['circuit appears in recent gaokao exams.']],
  ['component', 'n.', '组成部分、部件', '真题', ['真题词频1次'], ['组成部分、部件'], ['component appears in recent gaokao exams.']],
  ['conscious', 'adj.', '有意识的', '真题', ['真题词频1次'], ['有意识的'], ['conscious appears in recent gaokao exams.']],
  ['cottage', 'n.', '小屋、村舍', '真题', ['真题词频1次'], ['小屋、村舍'], ['cottage appears in recent gaokao exams.']],
  ['dioxide', 'n.', '二氧化物', '真题', ['真题词频1次'], ['二氧化物'], ['dioxide appears in recent gaokao exams.']],
  ['directory', 'n.', '目录、名录', '真题', ['真题词频1次'], ['目录、名录'], ['directory appears in recent gaokao exams.']],
  ['discrimination', 'n.', '歧视', '真题', ['真题词频1次'], ['歧视'], ['discrimination appears in recent gaokao exams.']],
  ['enormous', 'adj.', '巨大的', '真题', ['真题词频1次'], ['巨大的'], ['enormous appears in recent gaokao exams.']],
  ['export', 'v./n.', '出口、输出', '真题', ['真题词频1次'], ['出口、输出'], ['export appears in recent gaokao exams.']],
  ['genuine', 'adj.', '真正的', '真题', ['真题词频1次'], ['真正的'], ['genuine appears in recent gaokao exams.']],
  ['grain', 'n.', '谷物', '真题', ['真题词频1次'], ['谷物'], ['grain appears in recent gaokao exams.']],
  ['hence', 'adv.', '因此', '真题', ['真题词频1次'], ['因此'], ['hence appears in recent gaokao exams.']],
  ['ideal', 'adj.', '理想的、完美的', '真题', ['真题词频1次'], ['理想的、完美的'], ['ideal appears in recent gaokao exams.']],
  ['import', 'v./n.', '进口、输入', '真题', ['真题词频1次'], ['进口、输入'], ['import appears in recent gaokao exams.']],
  ['integrity', 'n.', '诚实、正直', '真题', ['真题词频1次'], ['诚实、正直'], ['integrity appears in recent gaokao exams.']],
  ['literally', 'adv.', '字面意义上、确实', '真题', ['真题词频1次'], ['字面意义上、确实'], ['literally appears in recent gaokao exams.']],
  ['logical', 'adj.', '符合逻辑的', '真题', ['真题词频1次'], ['符合逻辑的'], ['logical appears in recent gaokao exams.']],
  ['mineral', 'n.', '矿物质', '真题', ['真题词频1次'], ['矿物质'], ['mineral appears in recent gaokao exams.']],
  ['monument', 'n.', '纪念碑', '真题', ['真题词频1次'], ['纪念碑'], ['monument appears in recent gaokao exams.']],
  ['nuclear', 'adj.', '核能的', '真题', ['真题词频1次'], ['核能的'], ['nuclear appears in recent gaokao exams.']],
  ['oral', 'adj.', '口头的', '真题', ['真题词频1次'], ['口头的'], ['oral appears in recent gaokao exams.']],
  ['outcome', 'n.', '结果、效果', '真题', ['真题词频1次'], ['结果、效果'], ['outcome appears in recent gaokao exams.']],
  ['paddle', 'n./v.', '船桨、涉水', '真题', ['真题词频1次'], ['船桨、涉水'], ['paddle appears in recent gaokao exams.']],
  ['parallel', 'adj.', '平行的', '真题', ['真题词频1次'], ['平行的'], ['parallel appears in recent gaokao exams.']],
  ['premier', 'n.', '首相、总理', '真题', ['真题词频1次'], ['首相、总理'], ['premier appears in recent gaokao exams.']],
  ['pump', 'n.', '抽水机、水泵', '真题', ['真题词频1次'], ['抽水机、水泵'], ['pump appears in recent gaokao exams.']],
  ['quantity', 'n.', '数量', '真题', ['真题词频1次'], ['数量'], ['quantity appears in recent gaokao exams.']],
  ['smog', 'n.', '烟雾、雾霾', '真题', ['真题词频1次'], ['烟雾、雾霾'], ['smog appears in recent gaokao exams.']],
  ['starvation', 'n.', '饥荒', '真题', ['真题词频1次'], ['饥荒'], ['starvation appears in recent gaokao exams.']],
  ['substitute', 'v.', '代替、取代', '真题', ['真题词频1次'], ['代替、取代'], ['substitute appears in recent gaokao exams.']],
  ['superb', 'adj.', '卓越的', '真题', ['真题词频1次'], ['卓越的'], ['superb appears in recent gaokao exams.']],
  ['telegraph', 'n.', '电报', '真题', ['真题词频1次'], ['电报'], ['telegraph appears in recent gaokao exams.']],
  ['tendency', 'n.', '倾向', '真题', ['真题词频1次'], ['倾向'], ['tendency appears in recent gaokao exams.']],
  ['twist', 'v./n.', '扭曲、转动', '真题', ['真题词频1次'], ['扭曲、转动'], ['twist appears in recent gaokao exams.']],
  ['vice', 'n.', '邪恶、罪行', '真题', ['真题词频1次'], ['邪恶、罪行'], ['vice appears in recent gaokao exams.']],
  ['volume', 'n.', '体积、容量、音量、大量', '真题', ['真题词频1次'], ['体积、容量、音量、大量'], ['volume appears in recent gaokao exams.']],
  ['wage', 'n.', '工资', '真题', ['真题词频1次'], ['工资'], ['wage appears in recent gaokao exams.']],
  ['welfare', 'n.', '幸福、福利', '真题', ['真题词频1次'], ['幸福、福利'], ['welfare appears in recent gaokao exams.']]
];

// 褒义词
const seedWordsPositive = [
  ['aggressive', 'adj.', '褒义（积极态度）—— 有进取心的，敢作敢为的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is aggressive and hardworking.']],
  ['harmonious', 'adj.', '褒义（积极态度）—— 和谐的，和睦的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is harmonious and hardworking.']],
  ['amicable', 'adj.', '褒义（积极态度）—— 友好的，友善的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is amicable and hardworking.']],
  ['prudent', 'adj.', '褒义（积极态度）—— 谨慎的，慎重的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is prudent and hardworking.']],
  ['glamorous', 'adj.', '褒义（积极态度）—— 迷人的，富有魅力的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is glamorous and hardworking.']],
  ['commendable', 'adj.', '褒义（积极态度）—— 值得赞美的，值得表扬的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is commendable and hardworking.']],
  ['bountiful', 'adj.', '褒义（积极态度）—— 慷慨的，丰富的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is bountiful and hardworking.']],
  ['dynamic', 'adj.', '褒义（积极态度）—— 充满活力的，有动力的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is dynamic and hardworking.']],
  ['fearless', 'adj.', '褒义（积极态度）—— 无畏的，勇敢的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is fearless and hardworking.']],
  ['authentic', 'adj.', '褒义（积极态度）—— 真实的，真诚的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is authentic and hardworking.']],
  ['responsible', 'adj.', '褒义（积极态度）—— 有责任感的，负责任的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is responsible and hardworking.']],
  ['compassionate', 'adj.', '褒义（积极态度）—— 有同情心的，怜悯的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is compassionate and hardworking.']],
  ['audacious', 'adj.', '褒义（积极态度）—— 大胆的，敢于冒险的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is audacious and hardworking.']],
  ['astounding', 'adj.', '褒义（积极态度）—— 令人震惊的，惊人的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is astounding and hardworking.']],
  ['orderly', 'adj.', '褒义（积极态度）—— 有秩序的，整齐的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is orderly and hardworking.']],
  ['grateful', 'adj.', '褒义（积极态度）—— 感激的，感恩的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is grateful and hardworking.']],
  ['creative', 'adj.', '褒义（积极态度）—— 有创造力的，富有想象力的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is creative and hardworking.']],
  ['noble', 'adj.', '褒义（积极态度）—— 高尚的，崇高的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is noble and hardworking.']],
  ['caring', 'adj.', '褒义（积极态度）—— 关心的，有爱心的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is caring and hardworking.']],
  ['qualified', 'adj.', '褒义（积极态度）—— 合格的，有资格的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is qualified and hardworking.']],
  ['mature', 'adj.', '褒义（积极态度）—— 成熟的，理智的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is mature and hardworking.']],
  ['glorious', 'adj.', '褒义（积极态度）—— 光荣的，辉煌的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is glorious and hardworking.']],
  ['independent', 'adj.', '褒义（积极态度）—— 独立的，自主的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is independent and hardworking.']],
  ['faithful', 'adj.', '褒义（积极态度）—— 忠诚的，忠实的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is faithful and hardworking.']],
  ['industrious', 'adj.', '褒义（积极态度）—— 勤勉的，勤奋的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is industrious and hardworking.']],
  ['flourishing', 'adj.', '褒义（积极态度）—— 繁荣的，茂盛的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is flourishing and hardworking.']],
  ['punctual', 'adj.', '褒义（积极态度）—— 准时的，守时的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is punctual and hardworking.']],
  ['expressive', 'adj.', '褒义（积极态度）—— 富有表现力的，善于表达的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is expressive and hardworking.']],
  ['frank', 'adj.', '褒义（积极态度）—— 坦诚的，直率的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is frank and hardworking.']],
  ['objective', 'adj.', '褒义（积极态度）—— 客观的，公正的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is objective and hardworking.']],
  ['diplomatic', 'adj.', '褒义（积极态度）—— 外交的，圆滑的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is diplomatic and hardworking.']],
  ['merciful', 'adj.', '褒义（积极态度）—— 仁慈的，宽大的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is merciful and hardworking.']],
  ['understanding', 'adj.', '褒义（积极态度）—— 善解人意的，体谅的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is understanding and hardworking.']],
  ['candid', 'adj.', '褒义（积极态度）—— 坦率的，正直的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is candid and hardworking.']],
  ['ambitious', 'adj.', '褒义（积极态度）—— 有雄心壮志的，有抱负的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is ambitious and hardworking.']],
  ['focused', 'adj.', '褒义（积极态度）—— 专注的，集中的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is focused and hardworking.']],
  ['productive', 'adj.', '褒义（积极态度）—— 高产的，富有成效的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is productive and hardworking.']],
  ['dashing', 'adj.', '褒义（积极态度）—— 帅气的，精神抖擞的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is dashing and hardworking.']],
  ['pleasant', 'adj.', '褒义（积极态度）—— 令人愉快的，舒适的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is pleasant and hardworking.']],
  ['analytical', 'adj.', '褒义（积极态度）—— 善于分析的，理性的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is analytical and hardworking.']],
  ['conscientious', 'adj.', '褒义（积极态度）—— 认真的，尽责的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is conscientious and hardworking.']],
  ['sensible', 'adj.', '褒义（积极态度）—— 明智的，合理的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is sensible and hardworking.']],
  ['intelligent', 'adj.', '褒义（积极态度）—— 聪明的，有才智的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is intelligent and hardworking.']],
  ['exemplary', 'adj.', '褒义（积极态度）—— 堪称楷模的，模范的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is exemplary and hardworking.']],
  ['empathic', 'adj.', '褒义（积极态度）—— 有同理心的，共情的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is empathic and hardworking.']],
  ['decent', 'adj.', '褒义（积极态度）—— 体面的，正派的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is decent and hardworking.']],
  ['motivated', 'adj.', '褒义（积极态度）—— 有积极性的，有动力的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is motivated and hardworking.']],
  ['dazzling', 'adj.', '褒义（积极态度）—— 耀眼的，令人惊叹的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is dazzling and hardworking.']],
  ['generous', 'adj.', '褒义（积极态度）—— 慷慨的，大方的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is generous and hardworking.']],
  ['attentive', 'adj.', '褒义（积极态度）—— 专注的，留心的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is attentive and hardworking.']],
  ['incredible', 'adj.', '褒义（积极态度）—— 难以置信的，了不起的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is incredible and hardworking.']],
  ['loyal', 'adj.', '褒义（积极态度）—— 忠诚的，忠心的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is loyal and hardworking.']],
  ['admirable', 'adj.', '褒义（积极态度）—— 令人钦佩的，值得赞赏的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is admirable and hardworking.']],
  ['virtuous', 'adj.', '褒义（积极态度）—— 品德高尚的，正直的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is virtuous and hardworking.']],
  ['affectionate', 'adj.', '褒义（积极态度）—— 充满深情的，慈爱的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is affectionate and hardworking.']],
  ['endearing', 'adj.', '褒义（积极态度）—— 惹人喜爱的，讨人喜欢的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is endearing and hardworking.']],
  ['benevolent', 'adj.', '褒义（积极态度）—— 仁慈的，慈善的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is benevolent and hardworking.']],
  ['zealous', 'adj.', '褒义（积极态度）—— 热情的，热心的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is zealous and hardworking.']],
  ['exhilarating', 'adj.', '褒义（积极态度）—— 令人兴奋的，令人振奋的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is exhilarating and hardworking.']],
  ['charming', 'adj.', '褒义（积极态度）—— 迷人的，有魅力的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is charming and hardworking.']],
  ['educated', 'adj.', '褒义（积极态度）—— 受过良好教育的，有教养的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is educated and hardworking.']],
  ['modest', 'adj.', '褒义（积极态度）—— 谦虚的，谦逊的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is modest and hardworking.']],
  ['constructive', 'adj.', '褒义（积极态度）—— 建设性的，积极的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is constructive and hardworking.']],
  ['dependable', 'adj.', '褒义（积极态度）—— 可靠的，值得信赖的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is dependable and hardworking.']],
  ['initiative', 'adj.', '褒义（积极态度）—— 首创精神，主动性', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is initiative and hardworking.']],
  ['experienced', 'adj.', '褒义（积极态度）—— 有经验的，老练的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is experienced and hardworking.']],
  ['respectful', 'adj.', '褒义（积极态度）—— 恭敬的，尊重人的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is respectful and hardworking.']],
  ['festive', 'adj.', '褒义（积极态度）—— 节日的，喜庆的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is festive and hardworking.']],
  ['discerning', 'adj.', '褒义（积极态度）—— 有洞察力的，有判断力的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is discerning and hardworking.']],
  ['energetic', 'adj.', '褒义（积极态度）—— 精力充沛的，积极的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is energetic and hardworking.']],
  ['logical', 'adj.', '褒义（积极态度）—— 合乎逻辑的，条理分明的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is logical and hardworking.']],
  ['refined', 'adj.', '褒义（积极态度）—— 优雅的，有教养的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is refined and hardworking.']],
  ['apprehensive', 'adj.', '褒义（积极态度）—— 有预见性的，警觉的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is apprehensive and hardworking.']],
  ['tireless', 'adj.', '褒义（积极态度）—— 不知疲倦的，不懈的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is tireless and hardworking.']],
  ['impressive', 'adj.', '褒义（积极态度）—— 令人印象深刻的，出色的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is impressive and hardworking.']],
  ['dutiful', 'adj.', '褒义（积极态度）—— 尽职的，守本分的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is dutiful and hardworking.']],
  ['steady', 'adj.', '褒义（积极态度）—— 稳定的，平稳的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is steady and hardworking.']],
  ['efficient', 'adj.', '褒义（积极态度）—— 高效的，有效率的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is efficient and hardworking.']],
  ['gifted', 'adj.', '褒义（积极态度）—— 有天赋的，天资聪颖的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is gifted and hardworking.']],
  ['tolerant', 'adj.', '褒义（积极态度）—— 宽容的，容忍的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is tolerant and hardworking.']],
  ['alert', 'adj.', '褒义（积极态度）—— 警觉的，机敏的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is alert and hardworking.']],
  ['outstanding', 'adj.', '褒义（积极态度）—— 杰出的，优秀的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is outstanding and hardworking.']],
  ['earnest', 'adj.', '褒义（积极态度）—— 认真的，诚挚的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is earnest and hardworking.']],
  ['steadfast', 'adj.', '褒义（积极态度）—— 坚定的，忠贞不渝的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is steadfast and hardworking.']],
  ['resourceful', 'adj.', '褒义（积极态度）—— 足智多谋的，机智的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is resourceful and hardworking.']],
  ['balanced', 'adj.', '褒义（积极态度）—— 均衡的，平衡的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is balanced and hardworking.']],
  ['impartial', 'adj.', '褒义（积极态度）—— 公正的，无偏见的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is impartial and hardworking.']],
  ['classy', 'adj.', '褒义（积极态度）—— 优雅的，上档次的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is classy and hardworking.']],
  ['methodical', 'adj.', '褒义（积极态度）—— 有条理的，井然有序的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['He is methodical and hardworking.']]
];

// 贬义词
const seedWordsNegative = [
  ['awkward', 'adj.', '贬义（消极态度）—— 尴尬的，笨拙的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His awkward behavior was criticized.']],
  ['selfish', 'adj.', '贬义（消极态度）—— 自私的，利己的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His selfish behavior was criticized.']],
  ['stubborn', 'adj.', '贬义（消极态度）—— 固执的，倔强的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His stubborn behavior was criticized.']],
  ['mean', 'adj.', '贬义（消极态度）—— 吝啬的，刻薄的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His mean behavior was criticized.']],
  ['cruel', 'adj.', '贬义（消极态度）—— 残忍的，冷酷的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His cruel behavior was criticized.']],
  ['greedy', 'adj.', '贬义（消极态度）—— 贪婪的，贪心的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His greedy behavior was criticized.']],
  ['arrogant', 'adj.', '贬义（消极态度）—— 傲慢的，自大的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His arrogant behavior was criticized.']],
  ['cowardly', 'adj.', '贬义（消极态度）—— 懦弱的，胆小的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His cowardly behavior was criticized.']],
  ['dishonest', 'adj.', '贬义（消极态度）—— 不诚实的，虚伪的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His dishonest behavior was criticized.']],
  ['conceited', 'adj.', '贬义（消极态度）—— 自负的，骄傲的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His conceited behavior was criticized.']],
  ['proud', 'adj.', '贬义（消极态度）—— 骄傲的，自高自大的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His proud behavior was criticized.']],
  ['envious', 'adj.', '贬义（消极态度）—— 嫉妒的，羡慕的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His envious behavior was criticized.']],
  ['jealous', 'adj.', '贬义（消极态度）—— 嫉妒的，吃醋的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His jealous behavior was criticized.']],
  ['spiteful', 'adj.', '贬义（消极态度）—— 怀恨的，恶意的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His spiteful behavior was criticized.']],
  ['malicious', 'adj.', '贬义（消极态度）—— 恶意的，恶毒的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His malicious behavior was criticized.']],
  ['wicked', 'adj.', '贬义（消极态度）—— 邪恶的，缺德的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His wicked behavior was criticized.']],
  ['evil', 'adj.', '贬义（消极态度）—— 邪恶的，罪恶的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His evil behavior was criticized.']],
  ['destructive', 'adj.', '贬义（消极态度）—— 破坏性的，毁灭性的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His destructive behavior was criticized.']],
  ['disastrous', 'adj.', '贬义（消极态度）—— 灾难性的，悲惨的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His disastrous behavior was criticized.']],
  ['negative', 'adj.', '贬义（消极态度）—— 消极的，否定的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His negative behavior was criticized.']],
  ['pessimistic', 'adj.', '贬义（消极态度）—— 悲观的，消极的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His pessimistic behavior was criticized.']],
  ['lazybones', 'n.', '贬义（消极态度）—— 懒汉，懒骨头', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His lazybones behavior was criticized.']],
  ['liar', 'n.', '贬义（消极态度）—— 骗子，说谎者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His liar behavior was criticized.']],
  ['cheater', 'n.', '贬义（消极态度）—— 骗子，作弊者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His cheater behavior was criticized.']],
  ['loser', 'n.', '贬义（消极态度）—— 失败者，输家', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His loser behavior was criticized.']],
  ['failure', 'n.', '贬义（消极态度）—— 失败者，无用之人', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His failure behavior was criticized.']],
  ['slacker', 'n.', '贬义（消极态度）—— 懒散的人，偷懒者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His slacker behavior was criticized.']],
  ['quitter', 'n.', '贬义（消极态度）—— 半途而废的人，轻易放弃者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His quitter behavior was criticized.']],
  ['coward', 'n.', '贬义（消极态度）—— 懦夫，胆小鬼', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His coward behavior was criticized.']],
  ['tyrant', 'n.', '贬义（消极态度）—— 暴君，专制者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His tyrant behavior was criticized.']],
  ['bully', 'n.', '贬义（消极态度）—— 恃强凌弱者，欺凌者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His bully behavior was criticized.']],
  ['criminal', 'n.', '贬义（消极态度）—— 罪犯，犯罪者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His criminal behavior was criticized.']],
  ['vicious', 'adj.', '贬义（消极态度）—— 恶毒的，凶残的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His vicious behavior was criticized.']],
  ['robber', 'n.', '贬义（消极态度）—— 强盗，抢劫者', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His robber behavior was criticized.']],
  ['murderer', 'n.', '贬义（消极态度）—— 杀人犯，凶手', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His murderer behavior was criticized.']],
  ['traitor', 'n.', '贬义（消极态度）—— 叛徒，卖国贼', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His traitor behavior was criticized.']],
  ['gossip', 'n.', '贬义（消极态度）—— 爱传播流言蜚语的人', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His gossip behavior was criticized.']],
  ['busybody', 'n.', '贬义（消极态度）—— 爱管闲事的人', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His busybody behavior was criticized.']],
  ['worthless', 'adj.', '贬义（消极态度）—— 无价值的，没用的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His worthless behavior was criticized.']],
  ['idiot', 'n.', '贬义（消极态度）—— 白痴，蠢人', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His idiot behavior was criticized.']],
  ['moron', 'n.', '贬义（消极态度）—— 傻瓜，笨蛋', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His moron behavior was criticized.']],
  ['reckless', 'adj.', '贬义（消极态度）—— 鲁莽的，不计后果的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His reckless behavior was criticized.']],
  ['hasty', 'adj.', '贬义（消极态度）—— 匆忙的，草率的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His hasty behavior was criticized.']],
  ['thoughtless', 'adj.', '贬义（消极态度）—— 粗心的，不顾及他人的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His thoughtless behavior was criticized.']],
  ['impulsive', 'adj.', '贬义（消极态度）—— 冲动的，感情用事的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His impulsive behavior was criticized.']],
  ['unreliable', 'adj.', '贬义（消极态度）—— 不可靠的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His unreliable behavior was criticized.']],
  ['untrustworthy', 'adj.', '贬义（消极态度）—— 不值得信赖的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His untrustworthy behavior was criticized.']],
  ['ungrateful', 'adj.', '贬义（消极态度）—— 不知感恩的，忘恩负义的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His ungrateful behavior was criticized.']],
  ['unkind', 'adj.', '贬义（消极态度）—— 不友善的，刻薄的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His unkind behavior was criticized.']],
  ['ungenerous', 'adj.', '贬义（消极态度）—— 小气的，不慷慨的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His ungenerous behavior was criticized.']],
  ['unethical', 'adj.', '贬义（消极态度）—— 不道德的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His unethical behavior was criticized.']],
  ['immoral', 'adj.', '贬义（消极态度）—— 不道德的，邪恶的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His immoral behavior was criticized.']],
  ['unfaithful', 'adj.', '贬义（消极态度）—— 不忠实的，背叛的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His unfaithful behavior was criticized.']],
  ['disloyal', 'adj.', '贬义（消极态度）—— 不忠诚的，背叛的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His disloyal behavior was criticized.']],
  ['disgusting', 'adj.', '贬义（消极态度）—— 令人恶心的，令人厌恶的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His disgusting behavior was criticized.']],
  ['horrible', 'adj.', '贬义（消极态度）—— 可怕的，糟糕的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His horrible behavior was criticized.']],
  ['awful', 'adj.', '贬义（消极态度）—— 极坏的，可怕的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His awful behavior was criticized.']],
  ['lousy', 'adj.', '贬义（消极态度）—— 糟糕的，劣质的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His lousy behavior was criticized.']],
  ['naughty', 'adj.', '贬义（消极态度）—— 调皮的，不听话的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His naughty behavior was criticized.']],
  ['mischievous', 'adj.', '贬义（消极态度）—— 淘气的，恶作剧的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His mischievous behavior was criticized.']],
  ['disobedient', 'adj.', '贬义（消极态度）—— 不听话的，违抗的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His disobedient behavior was criticized.']],
  ['rebellious', 'adj.', '贬义（消极态度）—— 叛逆的，反抗的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His rebellious behavior was criticized.']],
  ['argumentative', 'adj.', '贬义（消极态度）—— 好争辩的，爱吵架的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His argumentative behavior was criticized.']],
  ['quarrelsome', 'adj.', '贬义（消极态度）—— 爱争吵的，好吵架的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His quarrelsome behavior was criticized.']],
  ['moody', 'adj.', '贬义（消极态度）—— 喜怒无常的，情绪化的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His moody behavior was criticized.']],
  ['irritable', 'adj.', '贬义（消极态度）—— 易怒的，暴躁的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His irritable behavior was criticized.']],
  ['rigid', 'adj.', '贬义（消极态度）—— 僵硬的，刻板的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His rigid behavior was criticized.']],
  ['narrow-minded', 'adj.', '贬义（消极态度）—— 心胸狭窄的，偏执的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His narrow-minded behavior was criticized.']],
  ['shallow', 'adj.', '贬义（消极态度）—— 浅薄的，肤浅的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His shallow behavior was criticized.']],
  ['vain', 'adj.', '贬义（消极态度）—— 虚荣的，自负的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His vain behavior was criticized.']],
  ['pretentious', 'adj.', '贬义（消极态度）—— 做作的，装腔作势的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His pretentious behavior was criticized.']],
  ['boastful', 'adj.', '贬义（消极态度）—— 好自夸的，吹嘘的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His boastful behavior was criticized.']],
  ['sneaky', 'adj.', '贬义（消极态度）—— 偷偷摸摸的，鬼鬼祟祟的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His sneaky behavior was criticized.']],
  ['sly', 'adj.', '贬义（消极态度）—— 狡猾的，偷偷的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His sly behavior was criticized.']],
  ['crafty', 'adj.', '贬义（消极态度）—— 狡猾的，诡计多端的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His crafty behavior was criticized.']],
  ['tricky', 'adj.', '贬义（消极态度）—— 狡猾的，耍花招的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His tricky behavior was criticized.']],
  ['ignorant', 'adj.', '贬义（消极态度）—— 无知的，愚昧的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His ignorant behavior was criticized.']],
  ['dull', 'adj.', '贬义（消极态度）—— 迟钝的，乏味的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His dull behavior was criticized.']],
  ['slow-witted', 'adj.', '贬义（消极态度）—— 反应迟钝的，脑子慢的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His slow-witted behavior was criticized.']],
  ['clumsy', 'adj.', '贬义（消极态度）—— 笨拙的，不灵活的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['His clumsy behavior was criticized.']]
];

// 超纲高频词
const seedWordsSuper = [
  ['adhere', 'vi.', '黏附，遵守，坚持', '超纲', ['超纲高频词'], ['黏附，遵守，坚持'], ['adhere is beyond the syllabus but frequently tested.']],
  ['adjustable', 'adj.', '可调节的', '超纲', ['超纲高频词'], ['可调节的'], ['adjustable is beyond the syllabus but frequently tested.']],
  ['alert', 'vt.', '警告，使警觉', '超纲', ['超纲高频词'], ['警告，使警觉'], ['alert is beyond the syllabus but frequently tested.']],
  ['appliance', 'n.', '器具，器械', '超纲', ['超纲高频词'], ['器具，器械'], ['appliance is beyond the syllabus but frequently tested.']],
  ['attic', 'n.', '阁楼', '超纲', ['超纲高频词'], ['阁楼'], ['attic is beyond the syllabus but frequently tested.']],
  ['auction', 'vt./n.', '拍卖', '超纲', ['超纲高频词'], ['拍卖'], ['auction is beyond the syllabus but frequently tested.']],
  ['beforehand', 'adv.', '预先，事先', '超纲', ['超纲高频词'], ['预先，事先'], ['beforehand is beyond the syllabus but frequently tested.']],
  ['breed', 'vi.', '繁殖，培育', '超纲', ['超纲高频词'], ['繁殖，培育'], ['breed is beyond the syllabus but frequently tested.']],
  ['burglary', 'n.', '入室盗窃', '超纲', ['超纲高频词'], ['入室盗窃'], ['burglary is beyond the syllabus but frequently tested.']],
  ['capture', 'vt.', '俘虏，捕获', '超纲', ['超纲高频词'], ['俘虏，捕获'], ['capture is beyond the syllabus but frequently tested.']],
  ['chronic', 'adj.', '慢性的，长期的', '超纲', ['超纲高频词'], ['慢性的，长期的'], ['chronic is beyond the syllabus but frequently tested.']],
  ['cliff', 'n.', '悬崖，绝壁', '超纲', ['超纲高频词'], ['悬崖，绝壁'], ['cliff is beyond the syllabus but frequently tested.']],
  ['clue', 'n.', '线索', '超纲', ['超纲高频词'], ['线索'], ['clue is beyond the syllabus but frequently tested.']],
  ['cognitive', 'adj.', '认知的，认识的', '超纲', ['超纲高频词'], ['认知的，认识的'], ['cognitive is beyond the syllabus but frequently tested.']],
  ['coherent', 'adj.', '有条理的，合乎逻辑的', '超纲', ['超纲高频词'], ['有条理的，合乎逻辑的'], ['coherent is beyond the syllabus but frequently tested.']],
  ['community', 'n.', '社区，社会', '超纲', ['超纲高频词'], ['社区，社会'], ['community is beyond the syllabus but frequently tested.']],
  ['complicated', 'adj.', '难懂的，复杂的', '超纲', ['超纲高频词'], ['难懂的，复杂的'], ['complicated is beyond the syllabus but frequently tested.']],
  ['compound', 'vt.', '合成，混合', '超纲', ['超纲高频词'], ['合成，混合'], ['compound is beyond the syllabus but frequently tested.']],
  ['consumer', 'n.', '消费者', '超纲', ['超纲高频词'], ['消费者'], ['consumer is beyond the syllabus but frequently tested.']],
  ['crawl', 'vi.', '爬行，匍匐行进', '超纲', ['超纲高频词'], ['爬行，匍匐行进'], ['crawl is beyond the syllabus but frequently tested.']],
  ['criticize', 'v.', '批评，评论', '超纲', ['超纲高频词'], ['批评，评论'], ['criticize is beyond the syllabus but frequently tested.']],
  ['destructive', 'adj.', '破坏的，毁灭性的', '超纲', ['超纲高频词'], ['破坏的，毁灭性的'], ['destructive is beyond the syllabus but frequently tested.']],
  ['device', 'n.', '装置，设备', '超纲', ['超纲高频词'], ['装置，设备'], ['device is beyond the syllabus but frequently tested.']],
  ['diplomacy', 'n.', '外交', '超纲', ['超纲高频词'], ['外交'], ['diplomacy is beyond the syllabus but frequently tested.']],
  ['dissolve', 'vt.', '使溶解，使分解', '超纲', ['超纲高频词'], ['使溶解，使分解'], ['dissolve is beyond the syllabus but frequently tested.']],
  ['distress', 'n.', '危难，不幸', '超纲', ['超纲高频词'], ['危难，不幸'], ['distress is beyond the syllabus but frequently tested.']],
  ['dominant', 'adj.', '占优势的，支配的', '超纲', ['超纲高频词'], ['占优势的，支配的'], ['dominant is beyond the syllabus but frequently tested.']],
  ['durability', 'n.', '耐久性，坚固', '超纲', ['超纲高频词'], ['耐久性，坚固'], ['durability is beyond the syllabus but frequently tested.']],
  ['earthworm', 'n.', '蚯蚓', '超纲', ['超纲高频词'], ['蚯蚓'], ['earthworm is beyond the syllabus but frequently tested.']],
  ['ecosystem', 'n.', '生态系统', '超纲', ['超纲高频词'], ['生态系统'], ['ecosystem is beyond the syllabus but frequently tested.']],
  ['emotional', 'adj.', '情绪的，易激动的', '超纲', ['超纲高频词'], ['情绪的，易激动的'], ['emotional is beyond the syllabus but frequently tested.']],
  ['encounter', 'vt.', '遭遇，遇到', '超纲', ['超纲高频词'], ['遭遇，遇到'], ['encounter is beyond the syllabus but frequently tested.']],
  ['encyclopedia', 'n.', '百科全书', '超纲', ['超纲高频词'], ['百科全书'], ['encyclopedia is beyond the syllabus but frequently tested.']],
  ['enhance', 'vt.', '提高，加强', '超纲', ['超纲高频词'], ['提高，加强'], ['enhance is beyond the syllabus but frequently tested.']],
  ['entitle', 'vt.', '给...权利', '超纲', ['超纲高频词'], ['给...权利'], ['entitle is beyond the syllabus but frequently tested.']],
  ['equator', 'n.', '赤道', '超纲', ['超纲高频词'], ['赤道'], ['equator is beyond the syllabus but frequently tested.']],
  ['exclude', 'vt.', '把...排除在外', '超纲', ['超纲高频词'], ['把...排除在外'], ['exclude is beyond the syllabus but frequently tested.']],
  ['extinguish', 'vt.', '熄灭，压制', '超纲', ['超纲高频词'], ['熄灭，压制'], ['extinguish is beyond the syllabus but frequently tested.']],
  ['facility', 'n.', '设施，设备', '超纲', ['超纲高频词'], ['设施，设备'], ['facility is beyond the syllabus but frequently tested.']],
  ['fatigue', 'n.', '疲劳，劳累', '超纲', ['超纲高频词'], ['疲劳，劳累'], ['fatigue is beyond the syllabus but frequently tested.']],
  ['fermentation', 'n.', '发酵', '超纲', ['超纲高频词'], ['发酵'], ['fermentation is beyond the syllabus but frequently tested.']],
  ['financial', 'adj.', '金融的，财政的', '超纲', ['超纲高频词'], ['金融的，财政的'], ['financial is beyond the syllabus but frequently tested.']],
  ['fossil', 'n.', '化石', '超纲', ['超纲高频词'], ['化石'], ['fossil is beyond the syllabus but frequently tested.']],
  ['foundation', 'n.', '基础，地基，基金会', '超纲', ['超纲高频词'], ['基础，地基，基金会'], ['foundation is beyond the syllabus but frequently tested.']],
  ['fragment', 'n.', '碎片', '超纲', ['超纲高频词'], ['碎片'], ['fragment is beyond the syllabus but frequently tested.']],
  ['generate', 'vt.', '使形成，产生', '超纲', ['超纲高频词'], ['使形成，产生'], ['generate is beyond the syllabus but frequently tested.']],
  ['gorilla', 'n.', '大猩猩', '超纲', ['超纲高频词'], ['大猩猩'], ['gorilla is beyond the syllabus but frequently tested.']],
  ['grave', 'adj.', '重大的，严肃的', '超纲', ['超纲高频词'], ['重大的，严肃的'], ['grave is beyond the syllabus but frequently tested.']],
  ['ignorant', 'adj.', '无知的，愚昧的', '超纲', ['超纲高频词'], ['无知的，愚昧的'], ['ignorant is beyond the syllabus but frequently tested.']],
  ['illusion', 'n.', '幻觉，错觉', '超纲', ['超纲高频词'], ['幻觉，错觉'], ['illusion is beyond the syllabus but frequently tested.']],
  ['immortality', 'n.', '不朽，永生', '超纲', ['超纲高频词'], ['不朽，永生'], ['immortality is beyond the syllabus but frequently tested.']],
  ['inevitable', 'adj.', '必然的，不可避免的', '超纲', ['超纲高频词'], ['必然的，不可避免的'], ['inevitable is beyond the syllabus but frequently tested.']],
  ['inherently', 'adv.', '内在地，固有地', '超纲', ['超纲高频词'], ['内在地，固有地'], ['inherently is beyond the syllabus but frequently tested.']],
  ['innovation', 'n.', '创新，革新', '超纲', ['超纲高频词'], ['创新，革新'], ['innovation is beyond the syllabus but frequently tested.']],
  ['interaction', 'n.', '相互作用', '超纲', ['超纲高频词'], ['相互作用'], ['interaction is beyond the syllabus but frequently tested.']],
  ['irritable', 'adj.', '暴躁的，易怒的', '超纲', ['超纲高频词'], ['暴躁的，易怒的'], ['irritable is beyond the syllabus but frequently tested.']],
  ['isolate', 'vt.', '使隔离，使孤立', '超纲', ['超纲高频词'], ['使隔离，使孤立'], ['isolate is beyond the syllabus but frequently tested.']],
  ['lean', 'vi.', '倾斜，倚靠', '超纲', ['超纲高频词'], ['倾斜，倚靠'], ['lean is beyond the syllabus but frequently tested.']],
  ['likelihood', 'n.', '可能，可能性', '超纲', ['超纲高频词'], ['可能，可能性'], ['likelihood is beyond the syllabus but frequently tested.']],
  ['lobby', 'n.', '大厅，休息室', '超纲', ['超纲高频词'], ['大厅，休息室'], ['lobby is beyond the syllabus but frequently tested.']],
  ['logic', 'n.', '逻辑', '超纲', ['超纲高频词'], ['逻辑'], ['logic is beyond the syllabus but frequently tested.']],
  ['magnetic', 'adj.', '有磁性的，有吸引力的', '超纲', ['超纲高频词'], ['有磁性的，有吸引力的'], ['magnetic is beyond the syllabus but frequently tested.']],
  ['manufacture', 'vt./n.', '大量制造', '超纲', ['超纲高频词'], ['大量制造'], ['manufacture is beyond the syllabus but frequently tested.']],
  ['mortgage', 'vt./n.', '抵押；按揭贷款', '超纲', ['超纲高频词'], ['抵押；按揭贷款'], ['mortgage is beyond the syllabus but frequently tested.']],
  ['mutual', 'adj.', '共同的，相互的', '超纲', ['超纲高频词'], ['共同的，相互的'], ['mutual is beyond the syllabus but frequently tested.']],
  ['nanotechnology', 'n.', '纳米技术', '超纲', ['超纲高频词'], ['纳米技术'], ['nanotechnology is beyond the syllabus but frequently tested.']],
  ['navigation', 'n.', '航行，航海', '超纲', ['超纲高频词'], ['航行，航海'], ['navigation is beyond the syllabus but frequently tested.']],
  ['nickname', 'n./vt.', '绰号；给...起绰号', '超纲', ['超纲高频词'], ['绰号；给...起绰号'], ['nickname is beyond the syllabus but frequently tested.']],
  ['organism', 'n.', '有机体，生物体', '超纲', ['超纲高频词'], ['有机体，生物体'], ['organism is beyond the syllabus but frequently tested.']],
  ['parachute', 'n.', '降落伞', '超纲', ['超纲高频词'], ['降落伞'], ['parachute is beyond the syllabus but frequently tested.']],
  ['parasite', 'n.', '寄生虫', '超纲', ['超纲高频词'], ['寄生虫'], ['parasite is beyond the syllabus but frequently tested.']],
  ['partnership', 'n.', '合伙企业', '超纲', ['超纲高频词'], ['合伙企业'], ['partnership is beyond the syllabus but frequently tested.']],
  ['perspective', 'n.', '观点，远景', '超纲', ['超纲高频词'], ['观点，远景'], ['perspective is beyond the syllabus but frequently tested.']],
  ['pesticide', 'n.', '杀虫剂', '超纲', ['超纲高频词'], ['杀虫剂'], ['pesticide is beyond the syllabus but frequently tested.']],
  ['prior', 'adj.', '先前的，较早的', '超纲', ['超纲高频词'], ['先前的，较早的'], ['prior is beyond the syllabus but frequently tested.']],
  ['prosecute', 'vt.', '检举，起诉', '超纲', ['超纲高频词'], ['检举，起诉'], ['prosecute is beyond the syllabus but frequently tested.']],
  ['rehearsal', 'n.', '排演，预演', '超纲', ['超纲高频词'], ['排演，预演'], ['rehearsal is beyond the syllabus but frequently tested.']],
  ['reinforce', 'vt.', '加强，加固', '超纲', ['超纲高频词'], ['加强，加固'], ['reinforce is beyond the syllabus but frequently tested.']],
  ['resolve', 'vt.', '解决问题、困难', '超纲', ['超纲高频词'], ['解决问题、困难'], ['resolve is beyond the syllabus but frequently tested.']],
  ['retail', 'v./n.', '零售', '超纲', ['超纲高频词'], ['零售'], ['retail is beyond the syllabus but frequently tested.']],
  ['reverse', 'n./vt.', '相反；颠倒', '超纲', ['超纲高频词'], ['相反；颠倒'], ['reverse is beyond the syllabus but frequently tested.']],
  ['salvage', 'n./vt.', '打捞；抢救', '超纲', ['超纲高频词'], ['打捞；抢救'], ['salvage is beyond the syllabus but frequently tested.']],
  ['simulator', 'n.', '模拟装置', '超纲', ['超纲高频词'], ['模拟装置'], ['simulator is beyond the syllabus but frequently tested.']],
  ['source', 'n.', '来源，水源', '超纲', ['超纲高频词'], ['来源，水源'], ['source is beyond the syllabus but frequently tested.']],
  ['spacecraft', 'n.', '宇宙飞船', '超纲', ['超纲高频词'], ['宇宙飞船'], ['spacecraft is beyond the syllabus but frequently tested.']],
  ['span', 'n.', '跨度，范围', '超纲', ['超纲高频词'], ['跨度，范围'], ['span is beyond the syllabus but frequently tested.']],
  ['species', 'n.', '物种，种类', '超纲', ['超纲高频词'], ['物种，种类'], ['species is beyond the syllabus but frequently tested.']],
  ['spectator', 'n.', '观众，旁观者', '超纲', ['超纲高频词'], ['观众，旁观者'], ['spectator is beyond the syllabus but frequently tested.']],
  ['stimulate', 'vt.', '刺激，鼓舞', '超纲', ['超纲高频词'], ['刺激，鼓舞'], ['stimulate is beyond the syllabus but frequently tested.']],
  ['stretch', 'vt.', '伸展；张开', '超纲', ['超纲高频词'], ['伸展；张开'], ['stretch is beyond the syllabus but frequently tested.']],
  ['tame', 'adj.', '驯服的，平淡的', '超纲', ['超纲高频词'], ['驯服的，平淡的'], ['tame is beyond the syllabus but frequently tested.']],
  ['temper', 'n.', '脾气', '超纲', ['超纲高频词'], ['脾气'], ['temper is beyond the syllabus but frequently tested.']],
  ['territory', 'n.', '领土，领域', '超纲', ['超纲高频词'], ['领土，领域'], ['territory is beyond the syllabus but frequently tested.']],
  ['totem', 'n.', '图腾', '超纲', ['超纲高频词'], ['图腾'], ['totem is beyond the syllabus but frequently tested.']],
  ['transfer', 'n./v.', '转让，转移', '超纲', ['超纲高频词'], ['转让，转移'], ['transfer is beyond the syllabus but frequently tested.']],
  ['transplant', 'n./v.', '移植', '超纲', ['超纲高频词'], ['移植'], ['transplant is beyond the syllabus but frequently tested.']],
  ['tuition', 'n.', '学费，讲授', '超纲', ['超纲高频词'], ['学费，讲授'], ['tuition is beyond the syllabus but frequently tested.']],
  ['wreck', 'n.', '失事，残骸', '超纲', ['超纲高频词'], ['失事，残骸'], ['wreck is beyond the syllabus but frequently tested.']]
];

// 同义词对比
const seedSynonyms = [
  ['abandon / give up', '词组', '放弃', '同义', ['同义词对比记忆'], ['abandon和give up可互换使用'], ['Both abandon and give up mean give up.']],
  ['absorb / take in', '词组', '吸收', '同义', ['同义词对比记忆'], ['absorb和take in可互换使用'], ['Both absorb and take in mean take in.']],
  ['affect / have an effect on', '词组', '影响', '同义', ['同义词对比记忆'], ['affect和have an effect on可互换使用'], ['Both affect and have an effect on mean have an effect on.']],
  ['beautiful / pretty', '词组', '漂亮的', '同义', ['同义词对比记忆'], ['beautiful和pretty可互换使用'], ['Both beautiful and pretty mean pretty.']],
  ['big / large', '词组', '大的', '同义', ['同义词对比记忆'], ['big和large可互换使用'], ['Both big and large mean large.']],
  ['brave / courageous', '词组', '勇敢的', '同义', ['同义词对比记忆'], ['brave和courageous可互换使用'], ['Both brave and courageous mean courageous.']],
  ['begin / start', '词组', '开始', '同义', ['同义词对比记忆'], ['begin和start可互换使用'], ['Both begin and start mean start.']],
  ['buy / purchase', '词组', '购买', '同义', ['同义词对比记忆'], ['buy和purchase可互换使用'], ['Both buy and purchase mean purchase.']],
  ['change / alter', '词组', '改变', '同义', ['同义词对比记忆'], ['change和alter可互换使用'], ['Both change and alter mean alter.']],
  ['choose / select', '词组', '选择', '同义', ['同义词对比记忆'], ['choose和select可互换使用'], ['Both choose and select mean select.']],
  ['close / shut', '词组', '关闭', '同义', ['同义词对比记忆'], ['close和shut可互换使用'], ['Both close and shut mean shut.']],
  ['complete / finish', '词组', '完成', '同义', ['同义词对比记忆'], ['complete和finish可互换使用'], ['Both complete and finish mean finish.']],
  ['correct / right', '词组', '正确的', '同义', ['同义词对比记忆'], ['correct和right可互换使用'], ['Both correct and right mean right.']],
  ['dangerous / risky', '词组', '危险的', '同义', ['同义词对比记忆'], ['dangerous和risky可互换使用'], ['Both dangerous and risky mean risky.']],
  ['decide / determine', '词组', '决定', '同义', ['同义词对比记忆'], ['decide和determine可互换使用'], ['Both decide and determine mean determine.']],
  ['decrease / reduce', '词组', '减少', '同义', ['同义词对比记忆'], ['decrease和reduce可互换使用'], ['Both decrease and reduce mean reduce.']],
  ['difficult / hard', '词组', '困难的', '同义', ['同义词对比记忆'], ['difficult和hard可互换使用'], ['Both difficult and hard mean hard.']],
  ['end / finish', '词组', '结束', '同义', ['同义词对比记忆'], ['end和finish可互换使用'], ['Both end and finish mean finish.']],
  ['enough / adequate', '词组', '足够的', '同义', ['同义词对比记忆'], ['enough和adequate可互换使用'], ['Both enough and adequate mean adequate.']],
  ['fast / quick', '词组', '快的', '同义', ['同义词对比记忆'], ['fast和quick可互换使用'], ['Both fast and quick mean quick.']],
  ['fear / be afraid of', '词组', '害怕', '同义', ['同义词对比记忆'], ['fear和be afraid of可互换使用'], ['Both fear and be afraid of mean be afraid of.']],
  ['find / discover', '词组', '发现', '同义', ['同义词对比记忆'], ['find和discover可互换使用'], ['Both find and discover mean discover.']],
  ['get / obtain', '词组', '获得', '同义', ['同义词对比记忆'], ['get和obtain可互换使用'], ['Both get and obtain mean obtain.']],
  ['happy / glad', '词组', '高兴的', '同义', ['同义词对比记忆'], ['happy和glad可互换使用'], ['Both happy and glad mean glad.']],
  ['help / assist', '词组', '帮助', '同义', ['同义词对比记忆'], ['help和assist可互换使用'], ['Both help and assist mean assist.']],
  ['hide / conceal', '词组', '隐藏', '同义', ['同义词对比记忆'], ['hide和conceal可互换使用'], ['Both hide and conceal mean conceal.']],
  ['hope / wish', '词组', '希望', '同义', ['同义词对比记忆'], ['hope和wish可互换使用'], ['Both hope and wish mean wish.']],
  ['important / significant', '词组', '重要的', '同义', ['同义词对比记忆'], ['important和significant可互换使用'], ['Both important and significant mean significant.']],
  ['increase / raise', '词组', '增加', '同义', ['同义词对比记忆'], ['increase和raise可互换使用'], ['Both increase and raise mean raise.']],
  ['job / work', '词组', '工作', '同义', ['同义词对比记忆'], ['job和work可互换使用'], ['Both job and work mean work.']],
  ['keep / preserve', '词组', '保持', '同义', ['同义词对比记忆'], ['keep和preserve可互换使用'], ['Both keep and preserve mean preserve.']],
  ['large / huge', '词组', '巨大的', '同义', ['同义词对比记忆'], ['large和huge可互换使用'], ['Both large and huge mean huge.']],
  ['look / see', '词组', '看', '同义', ['同义词对比记忆'], ['look和see可互换使用'], ['Both look and see mean see.']],
  ['make / create', '词组', '制造', '同义', ['同义词对比记忆'], ['make和create可互换使用'], ['Both make and create mean create.']],
  ['old / ancient', '词组', '古老的', '同义', ['同义词对比记忆'], ['old和ancient可互换使用'], ['Both old and ancient mean ancient.']],
  ['poor / needy', '词组', '贫穷的', '同义', ['同义词对比记忆'], ['poor和needy可互换使用'], ['Both poor and needy mean needy.']],
  ['quick / rapid', '词组', '迅速的', '同义', ['同义词对比记忆'], ['quick和rapid可互换使用'], ['Both quick and rapid mean rapid.']],
  ['quiet / silent', '词组', '安静的', '同义', ['同义词对比记忆'], ['quiet和silent可互换使用'], ['Both quiet and silent mean silent.']],
  ['rich / wealthy', '词组', '富裕的', '同义', ['同义词对比记忆'], ['rich和wealthy可互换使用'], ['Both rich and wealthy mean wealthy.']],
  ['sad / unhappy', '词组', '悲伤的', '同义', ['同义词对比记忆'], ['sad和unhappy可互换使用'], ['Both sad and unhappy mean unhappy.']],
  ['say / state', '词组', '说', '同义', ['同义词对比记忆'], ['say和state可互换使用'], ['Both say and state mean state.']],
  ['show / display', '词组', '展示', '同义', ['同义词对比记忆'], ['show和display可互换使用'], ['Both show and display mean display.']],
  ['small / tiny', '词组', '小的', '同义', ['同义词对比记忆'], ['small和tiny可互换使用'], ['Both small and tiny mean tiny.']],
  ['start / begin', '词组', '开始', '同义', ['同义词对比记忆'], ['start和begin可互换使用'], ['Both start and begin mean begin.']],
  ['stop / halt', '词组', '停止', '同义', ['同义词对比记忆'], ['stop和halt可互换使用'], ['Both stop and halt mean halt.']],
  ['strong / powerful', '词组', '强大的', '同义', ['同义词对比记忆'], ['strong和powerful可互换使用'], ['Both strong and powerful mean powerful.']],
  ['tell / inform', '词组', '告诉', '同义', ['同义词对比记忆'], ['tell和inform可互换使用'], ['Both tell and inform mean inform.']],
  ['think / believe', '词组', '认为', '同义', ['同义词对比记忆'], ['think和believe可互换使用'], ['Both think and believe mean believe.']],
  ['tired / exhausted', '词组', '疲倦的', '同义', ['同义词对比记忆'], ['tired和exhausted可互换使用'], ['Both tired and exhausted mean exhausted.']],
  ['try / attempt', '词组', '尝试', '同义', ['同义词对比记忆'], ['try和attempt可互换使用'], ['Both try and attempt mean attempt.']],
  ['use / employ', '词组', '使用', '同义', ['同义词对比记忆'], ['use和employ可互换使用'], ['Both use and employ mean employ.']],
  ['want / desire', '词组', '想要', '同义', ['同义词对比记忆'], ['want和desire可互换使用'], ['Both want and desire mean desire.']],
  ['work / labor', '词组', '工作', '同义', ['同义词对比记忆'], ['work和labor可互换使用'], ['Both work and labor mean labor.']],
  ['worried / anxious', '词组', '担心的', '同义', ['同义词对比记忆'], ['worried和anxious可互换使用'], ['Both worried and anxious mean anxious.']],
  ['answer / reply', '词组', '回答', '同义', ['同义词对比记忆'], ['answer和reply可互换使用'], ['Both answer and reply mean reply.']],
  ['appear / emerge', '词组', '出现', '同义', ['同义词对比记忆'], ['appear和emerge可互换使用'], ['Both appear and emerge mean emerge.']],
  ['ask / inquire', '词组', '询问', '同义', ['同义词对比记忆'], ['ask和inquire可互换使用'], ['Both ask and inquire mean inquire.']],
  ['attract / draw', '词组', '吸引', '同义', ['同义词对比记忆'], ['attract和draw可互换使用'], ['Both attract and draw mean draw.']],
  ['build / construct', '词组', '建造', '同义', ['同义词对比记忆'], ['build和construct可互换使用'], ['Both build and construct mean construct.']],
  ['carry / bear', '词组', '携带', '同义', ['同义词对比记忆'], ['carry和bear可互换使用'], ['Both carry and bear mean bear.']],
  ['catch / capture', '词组', '抓住', '同义', ['同义词对比记忆'], ['catch和capture可互换使用'], ['Both catch and capture mean capture.']],
  ['cause / lead to', '词组', '导致', '同义', ['同义词对比记忆'], ['cause和lead to可互换使用'], ['Both cause and lead to mean lead to.']],
  ['clever / smart', '词组', '聪明的', '同义', ['同义词对比记忆'], ['clever和smart可互换使用'], ['Both clever and smart mean smart.']],
  ['continue / go on', '词组', '继续', '同义', ['同义词对比记忆'], ['continue和go on可互换使用'], ['Both continue and go on mean go on.']],
  ['copy / duplicate', '词组', '复制', '同义', ['同义词对比记忆'], ['copy和duplicate可互换使用'], ['Both copy and duplicate mean duplicate.']],
  ['cry / weep', '词组', '哭泣', '同义', ['同义词对比记忆'], ['cry和weep可互换使用'], ['Both cry and weep mean weep.']],
  ['damage / harm', '词组', '损害', '同义', ['同义词对比记忆'], ['damage和harm可互换使用'], ['Both damage and harm mean harm.']],
  ['demand / require', '词组', '要求', '同义', ['同义词对比记忆'], ['demand和require可互换使用'], ['Both demand and require mean require.']],
  ['destroy / ruin', '词组', '破坏', '同义', ['同义词对比记忆'], ['destroy和ruin可互换使用'], ['Both destroy and ruin mean ruin.']],
  ['die / pass away', '词组', '死亡', '同义', ['同义词对比记忆'], ['die和pass away可互换使用'], ['Both die and pass away mean pass away.']],
  ['doubt / suspect', '词组', '怀疑', '同义', ['同义词对比记忆'], ['doubt和suspect可互换使用'], ['Both doubt and suspect mean suspect.']],
  ['dream / vision', '词组', '梦想', '同义', ['同义词对比记忆'], ['dream和vision可互换使用'], ['Both dream and vision mean vision.']],
  ['drink / sip', '词组', '喝', '同义', ['同义词对比记忆'], ['drink和sip可互换使用'], ['Both drink and sip mean sip.']],
  ['eat / consume', '词组', '吃', '同义', ['同义词对比记忆'], ['eat和consume可互换使用'], ['Both eat and consume mean consume.']],
  ['enjoy / like', '词组', '喜欢', '同义', ['同义词对比记忆'], ['enjoy和like可互换使用'], ['Both enjoy and like mean like.']],
  ['enter / go into', '词组', '进入', '同义', ['同义词对比记忆'], ['enter和go into可互换使用'], ['Both enter and go into mean go into.']],
  ['explain / clarify', '词组', '解释', '同义', ['同义词对比记忆'], ['explain和clarify可互换使用'], ['Both explain and clarify mean clarify.']],
  ['follow / pursue', '词组', '跟随', '同义', ['同义词对比记忆'], ['follow和pursue可互换使用'], ['Both follow and pursue mean pursue.']],
  ['guess / estimate', '词组', '猜测', '同义', ['同义词对比记忆'], ['guess和estimate可互换使用'], ['Both guess and estimate mean estimate.']],
  ['happen / occur', '词组', '发生', '同义', ['同义词对比记忆'], ['happen和occur可互换使用'], ['Both happen and occur mean occur.']],
  ['hate / dislike', '词组', '讨厌', '同义', ['同义词对比记忆'], ['hate和dislike可互换使用'], ['Both hate and dislike mean dislike.']],
  ['hear / listen', '词组', '听', '同义', ['同义词对比记忆'], ['hear和listen可互换使用'], ['Both hear and listen mean listen.']],
  ['hurry / rush', '词组', '匆忙', '同义', ['同义词对比记忆'], ['hurry和rush可互换使用'], ['Both hurry and rush mean rush.']],
  ['hurt / injure', '词组', '伤害', '同义', ['同义词对比记忆'], ['hurt和injure可互换使用'], ['Both hurt and injure mean injure.']],
  ['improve / better', '词组', '改善', '同义', ['同义词对比记忆'], ['improve和better可互换使用'], ['Both improve and better mean better.']],
  ['join / participate', '词组', '参加', '同义', ['同义词对比记忆'], ['join和participate可互换使用'], ['Both join and participate mean participate.']],
  ['kill / murder', '词组', '杀死', '同义', ['同义词对比记忆'], ['kill和murder可互换使用'], ['Both kill and murder mean murder.']],
  ['know / realize', '词组', '知道', '同义', ['同义词对比记忆'], ['know和realize可互换使用'], ['Both know and realize mean realize.']],
  ['laugh / smile', '词组', '笑', '同义', ['同义词对比记忆'], ['laugh和smile可互换使用'], ['Both laugh and smile mean smile.']],
  ['leave / depart', '词组', '离开', '同义', ['同义词对比记忆'], ['leave和depart可互换使用'], ['Both leave and depart mean depart.']],
  ['lend / loan', '词组', '借出', '同义', ['同义词对比记忆'], ['lend和loan可互换使用'], ['Both lend and loan mean loan.']],
  ['like / enjoy', '词组', '喜欢', '同义', ['同义词对比记忆'], ['like和enjoy可互换使用'], ['Both like and enjoy mean enjoy.']],
  ['live / exist', '词组', '生活', '同义', ['同义词对比记忆'], ['live和exist可互换使用'], ['Both live and exist mean exist.']],
  ['lose / miss', '词组', '丢失', '同义', ['同义词对比记忆'], ['lose和miss可互换使用'], ['Both lose and miss mean miss.']],
  ['love / adore', '词组', '爱', '同义', ['同义词对比记忆'], ['love和adore可互换使用'], ['Both love and adore mean adore.']],
  ['move / shift', '词组', '移动', '同义', ['同义词对比记忆'], ['move和shift可互换使用'], ['Both move and shift mean shift.']],
  ['need / require', '词组', '需要', '同义', ['同义词对比记忆'], ['need和require可互换使用'], ['Both need and require mean require.']],
  ['open / unfold', '词组', '打开', '同义', ['同义词对比记忆'], ['open和unfold可互换使用'], ['Both open and unfold mean unfold.']],
  ['pay / compensate', '词组', '支付', '同义', ['同义词对比记忆'], ['pay和compensate可互换使用'], ['Both pay and compensate mean compensate.']],
  ['pick / choose', '词组', '挑选', '同义', ['同义词对比记忆'], ['pick和choose可互换使用'], ['Both pick and choose mean choose.']],
  ['plan / arrange', '词组', '计划', '同义', ['同义词对比记忆'], ['plan和arrange可互换使用'], ['Both plan and arrange mean arrange.']],
  ['play / perform', '词组', '玩', '同义', ['同义词对比记忆'], ['play和perform可互换使用'], ['Both play and perform mean perform.']],
  ['point / indicate', '词组', '指向', '同义', ['同义词对比记忆'], ['point和indicate可互换使用'], ['Both point and indicate mean indicate.']],
  ['prove / demonstrate', '词组', '证明', '同义', ['同义词对比记忆'], ['prove和demonstrate可互换使用'], ['Both prove and demonstrate mean demonstrate.']],
  ['pull / draw', '词组', '拉', '同义', ['同义词对比记忆'], ['pull和draw可互换使用'], ['Both pull and draw mean draw.']],
  ['push / shove', '词组', '推', '同义', ['同义词对比记忆'], ['push和shove可互换使用'], ['Both push and shove mean shove.']],
  ['put / place', '词组', '放', '同义', ['同义词对比记忆'], ['put和place可互换使用'], ['Both put and place mean place.']],
  ['raise / lift', '词组', '举起', '同义', ['同义词对比记忆'], ['raise和lift可互换使用'], ['Both raise and lift mean lift.']],
  ['reach / arrive', '词组', '到达', '同义', ['同义词对比记忆'], ['reach和arrive可互换使用'], ['Both reach and arrive mean arrive.']],
  ['read / scan', '词组', '阅读', '同义', ['同义词对比记忆'], ['read和scan可互换使用'], ['Both read and scan mean scan.']],
  ['real / actual', '词组', '真实的', '同义', ['同义词对比记忆'], ['real和actual可互换使用'], ['Both real and actual mean actual.']],
  ['receive / accept', '词组', '收到', '同义', ['同义词对比记忆'], ['receive和accept可互换使用'], ['Both receive and accept mean accept.']],
  ['refuse / reject', '词组', '拒绝', '同义', ['同义词对比记忆'], ['refuse和reject可互换使用'], ['Both refuse and reject mean reject.']],
  ['remember / recall', '词组', '记住', '同义', ['同义词对比记忆'], ['remember和recall可互换使用'], ['Both remember and recall mean recall.']],
  ['return / come back', '词组', '返回', '同义', ['同义词对比记忆'], ['return和come back可互换使用'], ['Both return and come back mean come back.']],
  ['run / dash', '词组', '跑', '同义', ['同义词对比记忆'], ['run和dash可互换使用'], ['Both run and dash mean dash.']],
  ['sad / sorrowful', '词组', '悲伤的', '同义', ['同义词对比记忆'], ['sad和sorrowful可互换使用'], ['Both sad and sorrowful mean sorrowful.']],
  ['save / rescue', '词组', '拯救', '同义', ['同义词对比记忆'], ['save和rescue可互换使用'], ['Both save and rescue mean rescue.']],
  ['send / dispatch', '词组', '发送', '同义', ['同义词对比记忆'], ['send和dispatch可互换使用'], ['Both send and dispatch mean dispatch.']],
  ['shut / close', '词组', '关闭', '同义', ['同义词对比记忆'], ['shut和close可互换使用'], ['Both shut and close mean close.']],
  ['sing / chant', '词组', '唱歌', '同义', ['同义词对比记忆'], ['sing和chant可互换使用'], ['Both sing and chant mean chant.']],
  ['sleep / rest', '词组', '睡觉', '同义', ['同义词对比记忆'], ['sleep和rest可互换使用'], ['Both sleep and rest mean rest.']],
  ['speak / talk', '词组', '说话', '同义', ['同义词对比记忆'], ['speak和talk可互换使用'], ['Both speak and talk mean talk.']],
  ['spend / use up', '词组', '花费', '同义', ['同义词对比记忆'], ['spend和use up可互换使用'], ['Both spend and use up mean use up.']],
  ['steal / rob', '词组', '偷', '同义', ['同义词对比记忆'], ['steal和rob可互换使用'], ['Both steal and rob mean rob.']],
  ['study / learn', '词组', '学习', '同义', ['同义词对比记忆'], ['study和learn可互换使用'], ['Both study and learn mean learn.']],
  ['supply / provide', '词组', '供应', '同义', ['同义词对比记忆'], ['supply和provide可互换使用'], ['Both supply and provide mean provide.']],
  ['swim / dive', '词组', '游泳', '同义', ['同义词对比记忆'], ['swim和dive可互换使用'], ['Both swim and dive mean dive.']],
  ['teach / educate', '词组', '教', '同义', ['同义词对比记忆'], ['teach和educate可互换使用'], ['Both teach and educate mean educate.']],
  ['tell / reveal', '词组', '告诉', '同义', ['同义词对比记忆'], ['tell和reveal可互换使用'], ['Both tell and reveal mean reveal.']],
  ['test / examine', '词组', '测试', '同义', ['同义词对比记忆'], ['test和examine可互换使用'], ['Both test and examine mean examine.']],
  ['thank / appreciate', '词组', '感谢', '同义', ['同义词对比记忆'], ['thank和appreciate可互换使用'], ['Both thank and appreciate mean appreciate.']],
  ['throw / toss', '词组', '扔', '同义', ['同义词对比记忆'], ['throw和toss可互换使用'], ['Both throw and toss mean toss.']],
  ['touch / feel', '词组', '触摸', '同义', ['同义词对比记忆'], ['touch和feel可互换使用'], ['Both touch and feel mean feel.']],
  ['turn / rotate', '词组', '转动', '同义', ['同义词对比记忆'], ['turn和rotate可互换使用'], ['Both turn and rotate mean rotate.']],
  ['understand / comprehend', '词组', '理解', '同义', ['同义词对比记忆'], ['understand和comprehend可互换使用'], ['Both understand and comprehend mean comprehend.']],
  ['visit / tour', '词组', '参观', '同义', ['同义词对比记忆'], ['visit和tour可互换使用'], ['Both visit and tour mean tour.']],
  ['wait / stay', '词组', '等待', '同义', ['同义词对比记忆'], ['wait和stay可互换使用'], ['Both wait and stay mean stay.']],
  ['walk / stroll', '词组', '步行', '同义', ['同义词对比记忆'], ['walk和stroll可互换使用'], ['Both walk and stroll mean stroll.']],
  ['watch / observe', '词组', '观察', '同义', ['同义词对比记忆'], ['watch和observe可互换使用'], ['Both watch and observe mean observe.']],
  ['win / gain', '词组', '赢得', '同义', ['同义词对比记忆'], ['win和gain可互换使用'], ['Both win and gain mean gain.']],
  ['worry / care', '词组', '担心', '同义', ['同义词对比记忆'], ['worry和care可互换使用'], ['Both worry and care mean care.']]
];

// 反义词对比
const seedAntonyms = [
  ['advantage / disadvantage', '词组', '优点 / 缺点', '反义', ['反义词对比记忆'], ['advantage和disadvantage互为反义词'], ['advantage is the opposite of disadvantage.']],
  ['agree / disagree', '词组', '同意 / 不同意', '反义', ['反义词对比记忆'], ['agree和disagree互为反义词'], ['agree is the opposite of disagree.']],
  ['appear / disappear', '词组', '出现 / 消失', '反义', ['反义词对比记忆'], ['appear和disappear互为反义词'], ['appear is the opposite of disappear.']],
  ['approach / withdraw', '词组', '接近 / 撤退', '反义', ['反义词对比记忆'], ['approach和withdraw互为反义词'], ['approach is the opposite of withdraw.']],
  ['arrive / depart', '词组', '到达 / 离开', '反义', ['反义词对比记忆'], ['arrive和depart互为反义词'], ['arrive is the opposite of depart.']],
  ['borrow / lend', '词组', '借入 / 借出', '反义', ['反义词对比记忆'], ['borrow和lend互为反义词'], ['borrow is the opposite of lend.']],
  ['build / destroy', '词组', '建设 / 破坏', '反义', ['反义词对比记忆'], ['build和destroy互为反义词'], ['build is the opposite of destroy.']],
  ['buy / sell', '词组', '买 / 卖', '反义', ['反义词对比记忆'], ['buy和sell互为反义词'], ['buy is the opposite of sell.']],
  ['create / destroy', '词组', '创造 / 毁灭', '反义', ['反义词对比记忆'], ['create和destroy互为反义词'], ['create is the opposite of destroy.']],
  ['decrease / increase', '词组', '减少 / 增加', '反义', ['反义词对比记忆'], ['decrease和increase互为反义词'], ['decrease is the opposite of increase.']],
  ['defend / attack', '词组', '防御 / 攻击', '反义', ['反义词对比记忆'], ['defend和attack互为反义词'], ['defend is the opposite of attack.']],
  ['encourage / discourage', '词组', '鼓励 / 气馁', '反义', ['反义词对比记忆'], ['encourage和discourage互为反义词'], ['encourage is the opposite of discourage.']],
  ['enter / exit', '词组', '进入 / 退出', '反义', ['反义词对比记忆'], ['enter和exit互为反义词'], ['enter is the opposite of exit.']],
  ['fail / succeed', '词组', '失败 / 成功', '反义', ['反义词对比记忆'], ['fail和succeed互为反义词'], ['fail is the opposite of succeed.']],
  ['forget / remember', '词组', '忘记 / 记住', '反义', ['反义词对比记忆'], ['forget和remember互为反义词'], ['forget is the opposite of remember.']],
  ['gain / lose', '词组', '获得 / 失去', '反义', ['反义词对比记忆'], ['gain和lose互为反义词'], ['gain is the opposite of lose.']],
  ['gather / scatter', '词组', '聚集 / 散开', '反义', ['反义词对比记忆'], ['gather和scatter互为反义词'], ['gather is the opposite of scatter.']],
  ['hate / love', '词组', '讨厌 / 爱', '反义', ['反义词对比记忆'], ['hate和love互为反义词'], ['hate is the opposite of love.']],
  ['hope / despair', '词组', '希望 / 绝望', '反义', ['反义词对比记忆'], ['hope和despair互为反义词'], ['hope is the opposite of despair.']],
  ['include / exclude', '词组', '包括 / 排除', '反义', ['反义词对比记忆'], ['include和exclude互为反义词'], ['include is the opposite of exclude.']],
  ['joy / sorrow', '词组', '快乐 / 悲伤', '反义', ['反义词对比记忆'], ['joy和sorrow互为反义词'], ['joy is the opposite of sorrow.']],
  ['keep / abandon', '词组', '保持 / 放弃', '反义', ['反义词对比记忆'], ['keep和abandon互为反义词'], ['keep is the opposite of abandon.']],
  ['laugh / cry', '词组', '笑 / 哭', '反义', ['反义词对比记忆'], ['laugh和cry互为反义词'], ['laugh is the opposite of cry.']],
  ['lift / drop', '词组', '举起 / 放下', '反义', ['反义词对比记忆'], ['lift和drop互为反义词'], ['lift is the opposite of drop.']],
  ['open / close', '词组', '打开 / 关闭', '反义', ['反义词对比记忆'], ['open和close互为反义词'], ['open is the opposite of close.']],
  ['pass / fail', '词组', '通过 / 失败', '反义', ['反义词对比记忆'], ['pass和fail互为反义词'], ['pass is the opposite of fail.']],
  ['praise / criticize', '词组', '表扬 / 批评', '反义', ['反义词对比记忆'], ['praise和criticize互为反义词'], ['praise is the opposite of criticize.']],
  ['pull / push', '词组', '拉 / 推', '反义', ['反义词对比记忆'], ['pull和push互为反义词'], ['pull is the opposite of push.']],
  ['raise / lower', '词组', '举起 / 放低', '反义', ['反义词对比记忆'], ['raise和lower互为反义词'], ['raise is the opposite of lower.']],
  ['rich / poor', '词组', '富裕的 / 贫穷的', '反义', ['反义词对比记忆'], ['rich和poor互为反义词'], ['rich is the opposite of poor.']],
  ['safe / dangerous', '词组', '安全的 / 危险的', '反义', ['反义词对比记忆'], ['safe和dangerous互为反义词'], ['safe is the opposite of dangerous.']],
  ['silent / noisy', '词组', '安静的 / 嘈杂的', '反义', ['反义词对比记忆'], ['silent和noisy互为反义词'], ['silent is the opposite of noisy.']],
  ['simple / complex', '词组', '简单的 / 复杂的', '反义', ['反义词对比记忆'], ['simple和complex互为反义词'], ['simple is the opposite of complex.']],
  ['strong / weak', '词组', '强壮的 / 虚弱的', '反义', ['反义词对比记忆'], ['strong和weak互为反义词'], ['strong is the opposite of weak.']],
  ['victory / defeat', '词组', '胜利 / 失败', '反义', ['反义词对比记忆'], ['victory和defeat互为反义词'], ['victory is the opposite of defeat.']],
  ['accept / reject', '词组', '接受 / 拒绝', '反义', ['反义词对比记忆'], ['accept和reject互为反义词'], ['accept is the opposite of reject.']],
  ['ancient / modern', '词组', '古代的 / 现代的', '反义', ['反义词对比记忆'], ['ancient和modern互为反义词'], ['ancient is the opposite of modern.']],
  ['beautiful / ugly', '词组', '美丽的 / 丑陋的', '反义', ['反义词对比记忆'], ['beautiful和ugly互为反义词'], ['beautiful is the opposite of ugly.']],
  ['begin / end', '词组', '开始 / 结束', '反义', ['反义词对比记忆'], ['begin和end互为反义词'], ['begin is the opposite of end.']],
  ['brave / cowardly', '词组', '勇敢的 / 懦弱的', '反义', ['反义词对比记忆'], ['brave和cowardly互为反义词'], ['brave is the opposite of cowardly.']],
  ['calm / anxious', '词组', '平静的 / 焦虑的', '反义', ['反义词对比记忆'], ['calm和anxious互为反义词'], ['calm is the opposite of anxious.']],
  ['cheap / expensive', '词组', '便宜的 / 昂贵的', '反义', ['反义词对比记忆'], ['cheap和expensive互为反义词'], ['cheap is the opposite of expensive.']],
  ['clean / dirty', '词组', '干净的 / 肮脏的', '反义', ['反义词对比记忆'], ['clean和dirty互为反义词'], ['clean is the opposite of dirty.']],
  ['clever / foolish', '词组', '聪明的 / 愚蠢的', '反义', ['反义词对比记忆'], ['clever和foolish互为反义词'], ['clever is the opposite of foolish.']],
  ['cold / hot', '词组', '冷的 / 热的', '反义', ['反义词对比记忆'], ['cold和hot互为反义词'], ['cold is the opposite of hot.']],
  ['comfortable / uncomfortable', '词组', '舒适的 / 不舒适的', '反义', ['反义词对比记忆'], ['comfortable和uncomfortable互为反义词'], ['comfortable is the opposite of uncomfortable.']],
  ['confident / nervous', '词组', '自信的 / 紧张的', '反义', ['反义词对比记忆'], ['confident和nervous互为反义词'], ['confident is the opposite of nervous.']],
  ['connect / disconnect', '词组', '连接 / 断开', '反义', ['反义词对比记忆'], ['connect和disconnect互为反义词'], ['connect is the opposite of disconnect.']],
  ['correct / wrong', '词组', '正确的 / 错误的', '反义', ['反义词对比记忆'], ['correct和wrong互为反义词'], ['correct is the opposite of wrong.']],
  ['curious / indifferent', '词组', '好奇的 / 冷漠的', '反义', ['反义词对比记忆'], ['curious和indifferent互为反义词'], ['curious is the opposite of indifferent.']],
  ['generous / mean', '词组', '慷慨的 / 吝啬的', '反义', ['反义词对比记忆'], ['generous和mean互为反义词'], ['generous is the opposite of mean.']],
  ['guilty / innocent', '词组', '有罪的 / 无辜的', '反义', ['反义词对比记忆'], ['guilty和innocent互为反义词'], ['guilty is the opposite of innocent.']],
  ['honest / dishonest', '词组', '诚实的 / 不诚实的', '反义', ['反义词对比记忆'], ['honest和dishonest互为反义词'], ['honest is the opposite of dishonest.']],
  ['optimistic / pessimistic', '词组', '乐观的 / 悲观的', '反义', ['反义词对比记忆'], ['optimistic和pessimistic互为反义词'], ['optimistic is the opposite of pessimistic.']],
  ['permanent / temporary', '词组', '永久的 / 暂时的', '反义', ['反义词对比记忆'], ['permanent和temporary互为反义词'], ['permanent is the opposite of temporary.']],
  ['polite / rude', '词组', '礼貌的 / 粗鲁的', '反义', ['反义词对比记忆'], ['polite和rude互为反义词'], ['polite is the opposite of rude.']],
  ['positive / negative', '词组', '积极的 / 消极的', '反义', ['反义词对比记忆'], ['positive和negative互为反义词'], ['positive is the opposite of negative.']],
  ['real / fake', '词组', '真实的 / 假的', '反义', ['反义词对比记忆'], ['real和fake互为反义词'], ['real is the opposite of fake.']],
  ['rough / smooth', '词组', '粗糙的 / 光滑的', '反义', ['反义词对比记忆'], ['rough和smooth互为反义词'], ['rough is the opposite of smooth.']],
  ['sharp / blunt', '词组', '锋利的 / 钝的', '反义', ['反义词对比记忆'], ['sharp和blunt互为反义词'], ['sharp is the opposite of blunt.']],
  ['slow / fast', '词组', '慢的 / 快的', '反义', ['反义词对比记忆'], ['slow和fast互为反义词'], ['slow is the opposite of fast.']],
  ['soft / hard', '词组', '柔软的 / 坚硬的', '反义', ['反义词对比记忆'], ['soft和hard互为反义词'], ['soft is the opposite of hard.']],
  ['thick / thin', '词组', '厚的 / 薄的', '反义', ['反义词对比记忆'], ['thick和thin互为反义词'], ['thick is the opposite of thin.']],
  ['wide / narrow', '词组', '宽的 / 窄的', '反义', ['反义词对比记忆'], ['wide和narrow互为反义词'], ['wide is the opposite of narrow.']]
];

// 逻辑连接词（结论词）
const seedConclusion = [
  ['in conclusion', '短语', '总之，总的来说', '逻辑', ['结论词，作文常用'], ['总之，总的来说，常用于段落结尾总结'], ['in conclusion, we should take action.']],
  ['in summary', '短语', '概括地说', '逻辑', ['结论词，作文常用'], ['概括地说，常用于段落结尾总结'], ['in summary, we should take action.']],
  ['to sum up', '短语', '概括起来', '逻辑', ['结论词，作文常用'], ['概括起来，常用于段落结尾总结'], ['to sum up, we should take action.']],
  ['all in all', '短语', '总而言之', '逻辑', ['结论词，作文常用'], ['总而言之，常用于段落结尾总结'], ['all in all, we should take action.']],
  ['in a word', '短语', '简而言之', '逻辑', ['结论词，作文常用'], ['简而言之，常用于段落结尾总结'], ['in a word, we should take action.']],
  ['overall', 'adv.', '总体而言', '逻辑', ['结论词，作文常用'], ['总体而言，常用于段落结尾总结'], ['overall, we should take action.']],
  ['to conclude', '短语', '综上所述', '逻辑', ['结论词，作文常用'], ['综上所述，常用于段落结尾总结'], ['to conclude, we should take action.']],
  ['therefore', 'adv.', '因此，所以', '逻辑', ['结论词，作文常用'], ['因此，所以，常用于段落结尾总结'], ['therefore, we should take action.']],
  ['thus', 'adv.', '因此，从而', '逻辑', ['结论词，作文常用'], ['因此，从而，常用于段落结尾总结'], ['thus, we should take action.']],
  ['hence', 'adv.', '因此，由此', '逻辑', ['结论词，作文常用'], ['因此，由此，常用于段落结尾总结'], ['hence, we should take action.']],
  ['consequently', 'adv.', '所以，结果', '逻辑', ['结论词，作文常用'], ['所以，结果，常用于段落结尾总结'], ['consequently, we should take action.']],
  ['as a result', '短语', '结果，因此', '逻辑', ['结论词，作文常用'], ['结果，因此，常用于段落结尾总结'], ['as a result, we should take action.']],
  ['as a consequence', '短语', '因此，结果', '逻辑', ['结论词，作文常用'], ['因此，结果，常用于段落结尾总结'], ['as a consequence, we should take action.']]
];

// 高考高频主题词汇
const seedTopic = [
  ['national security', '短语', '国家安全', '主题', ['safeguard national security'], ['高考热点主题词汇，safeguard national security'], ['national security is a key topic in gaokao.']],
  ['sovereignty', 'n.', '主权', '主题', ['defend sovereignty'], ['高考热点主题词汇，defend sovereignty'], ['sovereignty is a key topic in gaokao.']],
  ['territorial integrity', '短语', '领土完整', '主题', ['defend territorial integrity'], ['高考热点主题词汇，defend territorial integrity'], ['territorial integrity is a key topic in gaokao.']],
  ['cybersecurity', 'n.', '网络安全', '主题', ['combat cybercrime'], ['高考热点主题词汇，combat cybercrime'], ['cybersecurity is a key topic in gaokao.']],
  ['biological security', '短语', '生物安全', '主题', ['improve biological security'], ['高考热点主题词汇，improve biological security'], ['biological security is a key topic in gaokao.']],
  ['food security', '短语', '粮食安全', '主题', ['ensure food security'], ['高考热点主题词汇，ensure food security'], ['food security is a key topic in gaokao.']],
  ['energy security', '短语', '能源安全', '主题', ['diversify energy supply'], ['高考热点主题词汇，diversify energy supply'], ['energy security is a key topic in gaokao.']],
  ['public health', '短语', '公共卫生', '主题', ['respond to public health emergencies'], ['高考热点主题词汇，respond to public health emergencies'], ['public health is a key topic in gaokao.']],
  ['ecological security', '短语', '生态安全', '主题', ['protect ecological security'], ['高考热点主题词汇，protect ecological security'], ['ecological security is a key topic in gaokao.']],
  ['emergency response', '短语', '应急响应', '主题', ['improve emergency response'], ['高考热点主题词汇，improve emergency response'], ['emergency response is a key topic in gaokao.']],
  ['Rural Revitalization', '短语', '乡村振兴', '主题', ['implement rural revitalization'], ['高考热点主题词汇，implement rural revitalization'], ['Rural Revitalization is a key topic in gaokao.']],
  ['poverty alleviation', '短语', '脱贫攻坚', '主题', ['win the battle against poverty'], ['高考热点主题词汇，win the battle against poverty'], ['poverty alleviation is a key topic in gaokao.']],
  ['common prosperity', '短语', '共同富裕', '主题', ['promote common prosperity'], ['高考热点主题词汇，promote common prosperity'], ['common prosperity is a key topic in gaokao.']],
  ['digital countryside', '短语', '数字乡村', '主题', ['build a digital countryside'], ['高考热点主题词汇，build a digital countryside'], ['digital countryside is a key topic in gaokao.']],
  ['targeted poverty alleviation', '短语', '精准扶贫', '主题', ['implement targeted measures'], ['高考热点主题词汇，implement targeted measures'], ['targeted poverty alleviation is a key topic in gaokao.']],
  ['patriotism', 'n.', '爱国主义', '主题', ['cultivate patriotism'], ['高考热点主题词汇，cultivate patriotism'], ['patriotism is a key topic in gaokao.']],
  ['national pride', '短语', '民族自豪感', '主题', ['arouse national pride'], ['高考热点主题词汇，arouse national pride'], ['national pride is a key topic in gaokao.']],
  ['national spirit', '短语', '民族精神', '主题', ['carry forward national spirit'], ['高考热点主题词汇，carry forward national spirit'], ['national spirit is a key topic in gaokao.']],
  ['Chinese dream', '短语', '中国梦', '主题', ['realize the Chinese dream'], ['高考热点主题词汇，realize the Chinese dream'], ['Chinese dream is a key topic in gaokao.']],
  ['Community with a Shared Future', '短语', '人类命运共同体', '主题', ['build a community with a shared future'], ['高考热点主题词汇，build a community with a shared future'], ['Community with a Shared Future is a key topic in gaokao.']],
  ['global governance', '短语', '全球治理', '主题', ['improve global governance'], ['高考热点主题词汇，improve global governance'], ['global governance is a key topic in gaokao.']],
  ['win-win cooperation', '短语', '合作共赢', '主题', ['promote win-win cooperation'], ['高考热点主题词汇，promote win-win cooperation'], ['win-win cooperation is a key topic in gaokao.']],
  ['cultural exchanges', '短语', '文化交流', '主题', ['promote cultural exchanges'], ['高考热点主题词汇，promote cultural exchanges'], ['cultural exchanges is a key topic in gaokao.']],
  ['artificial intelligence', '短语', '人工智能', '主题', ['the rapid development of AI'], ['高考热点主题词汇，the rapid development of AI'], ['artificial intelligence is a key topic in gaokao.']],
  ['machine learning', '短语', '机器学习', '主题', ['machine learning algorithms'], ['高考热点主题词汇，machine learning algorithms'], ['machine learning is a key topic in gaokao.']],
  ['information security', '短语', '信息安全', '主题', ['protect information security'], ['高考热点主题词汇，protect information security'], ['information security is a key topic in gaokao.']],
  ['data privacy', '短语', '数据隐私', '主题', ['protect data privacy'], ['高考热点主题词汇，protect data privacy'], ['data privacy is a key topic in gaokao.']],
  ['network fraud', '短语', '网络诈骗', '主题', ['combat network fraud'], ['高考热点主题词汇，combat network fraud'], ['network fraud is a key topic in gaokao.']],
  ['AI ethics', '短语', '人工智能伦理', '主题', ['establish AI ethics norms'], ['高考热点主题词汇，establish AI ethics norms'], ['AI ethics is a key topic in gaokao.']],
  ['digital divide', '短语', '数字鸿沟', '主题', ['bridge the digital divide'], ['高考热点主题词汇，bridge the digital divide'], ['digital divide is a key topic in gaokao.']],
  ['technological innovation', '短语', '科技创新', '主题', ['promote technological innovation'], ['高考热点主题词汇，promote technological innovation'], ['technological innovation is a key topic in gaokao.']]
];

// 熟词生义
const seedFamiliarNew = [
  ['address', 'n.', '地址；v. 解决(问题)', '生义', ['熟词生义', 'address the problem'], ['地址；v. 解决(问题)', '注意一词多义'], ['address the problem is a common usage.']],
  ['accommodate', 'v.', '容纳；提供住宿；适应', '生义', ['熟词生义', 'accommodate 500 guests'], ['容纳；提供住宿；适应', '注意一词多义'], ['accommodate 500 guests is a common usage.']],
  ['affect', 'v.', '影响；感动；假装', '生义', ['熟词生义', 'affect an accent'], ['影响；感动；假装', '注意一词多义'], ['affect an accent is a common usage.']],
  ['book', 'v.', '预订', '生义', ['熟词生义', 'book a hotel room'], ['预订', '注意一词多义'], ['book a hotel room is a common usage.']],
  ['cause', 'n.', '事业；目标', '生义', ['熟词生义', 'a worthy cause'], ['事业；目标', '注意一词多义'], ['a worthy cause is a common usage.']],
  ['change', 'n.', '零钱', '生义', ['熟词生义', 'keep the change'], ['零钱', '注意一词多义'], ['keep the change is a common usage.']],
  ['company', 'n.', '公司；陪伴', '生义', ['熟词生义', 'enjoy his company'], ['公司；陪伴', '注意一词多义'], ['enjoy his company is a common usage.']],
  ['conduct', 'v.', '指挥(音乐)；实施', '生义', ['熟词生义', 'conduct an orchestra'], ['指挥(音乐)；实施', '注意一词多义'], ['conduct an orchestra is a common usage.']],
  ['cover', 'v.', '报道；行走(距离)', '生义', ['熟词生义', 'cover 10 kilometers'], ['报道；行走(距离)', '注意一词多义'], ['cover 10 kilometers is a common usage.']],
  ['develop', 'v.', '养成(习惯)；冲洗(照片)', '生义', ['熟词生义', 'develop a habit'], ['养成(习惯)；冲洗(照片)', '注意一词多义'], ['develop a habit is a common usage.']],
  ['draw', 'v.', '拉；得出结论；吸引', '生义', ['熟词生义', 'draw a conclusion'], ['拉；得出结论；吸引', '注意一词多义'], ['draw a conclusion is a common usage.']],
  ['engage', 'v.', '从事；订婚；吸引', '生义', ['熟词生义', 'engage in research'], ['从事；订婚；吸引', '注意一词多义'], ['engage in research is a common usage.']],
  ['express', 'n.', '快车；快递', '生义', ['熟词生义', 'take the express'], ['快车；快递', '注意一词多义'], ['take the express is a common usage.']],
  ['fail', 'v.', '未能(做某事)；使失望', '生义', ['熟词生义', 'fail to pass'], ['未能(做某事)；使失望', '注意一词多义'], ['fail to pass is a common usage.']],
  ['observe', 'v.', '遵守(规则)；庆祝', '生义', ['熟词生义', 'observe the rules'], ['遵守(规则)；庆祝', '注意一词多义'], ['observe the rules is a common usage.']],
  ['owe', 'v.', '欠；把...归功于', '生义', ['熟词生义', 'owe success to'], ['欠；把...归功于', '注意一词多义'], ['owe success to is a common usage.']],
  ['plant', 'n.', '工厂；发电厂', '生义', ['熟词生义', 'a power plant'], ['工厂；发电厂', '注意一词多义'], ['a power plant is a common usage.']],
  ['position', 'n.', '立场；职位', '生义', ['熟词生义', 'take a position'], ['立场；职位', '注意一词多义'], ['take a position is a common usage.']],
  ['purchase', 'v.', '购买(正式)', '生义', ['熟词生义', 'purchase equipment'], ['购买(正式)', '注意一词多义'], ['purchase equipment is a common usage.']],
  ['read', 'v.', '解读；攻读', '生义', ['熟词生义', 'read one\'s mind'], ['解读；攻读', '注意一词多义'], ['read one\'s mind is a common usage.']],
  ['reason', 'v.', '推理；说服', '生义', ['熟词生义', 'reason with someone'], ['推理；说服', '注意一词多义'], ['reason with someone is a common usage.']],
  ['remain', 'v.', '仍然是；留下', '生义', ['熟词生义', 'remain silent'], ['仍然是；留下', '注意一词多义'], ['remain silent is a common usage.']],
  ['observe', 'v.', '庆祝(节日)', '生义', ['熟词生义', 'observe Christmas'], ['庆祝(节日)', '注意一词多义'], ['observe Christmas is a common usage.']],
  ['second', 'v.', '赞成；附议', '生义', ['熟词生义', 'second the motion'], ['赞成；附议', '注意一词多义'], ['second the motion is a common usage.']],
  ['sound', 'adj.', '合理的；完好的', '生义', ['熟词生义', 'a sound argument'], ['合理的；完好的', '注意一词多义'], ['a sound argument is a common usage.']],
  ['stand', 'v.', '忍受；代表', '生义', ['熟词生义', 'can\'t stand the noise'], ['忍受；代表', '注意一词多义'], ['can\'t stand the noise is a common usage.']],
  ['tap', 'v.', '开发；利用', '生义', ['熟词生义', 'tap natural resources'], ['开发；利用', '注意一词多义'], ['tap natural resources is a common usage.']],
  ['term', 'n.', '学期；术语；条款', '生义', ['熟词生义', 'in terms of'], ['学期；术语；条款', '注意一词多义'], ['in terms of is a common usage.']],
  ['walk', 'n.', '职业；阶层', '生义', ['熟词生义', 'people from all walks of life'], ['职业；阶层', '注意一词多义'], ['people from all walks of life is a common usage.']]
];

// 褒贬双性词
const seedDualSentiment = [
  ['aggressive', 'adj.', '褒义：有进取心的；贬义：好斗的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：有进取心的；贬义：好斗的'], ['The word aggressive can be positive or negative depending on context.']],
  ['ambitious', 'adj.', '褒义：有雄心的；贬义：野心勃勃的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：有雄心的；贬义：野心勃勃的'], ['The word ambitious can be positive or negative depending on context.']],
  ['bold', 'adj.', '褒义：勇敢的；贬义：鲁莽的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：勇敢的；贬义：鲁莽的'], ['The word bold can be positive or negative depending on context.']],
  ['complex', 'adj.', '中性偏褒：复杂的精妙；中性偏贬：复杂的麻烦', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['中性偏褒：复杂的精妙；中性偏贬：复杂的麻烦'], ['The word complex can be positive or negative depending on context.']],
  ['conservative', 'adj.', '褒义：保守稳健的；贬义：守旧的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：保守稳健的；贬义：守旧的'], ['The word conservative can be positive or negative depending on context.']],
  ['critical', 'adj.', '褒义：关键的/批判性的；贬义：挑剔的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：关键的/批判性的；贬义：挑剔的'], ['The word critical can be positive or negative depending on context.']],
  ['demanding', 'adj.', '褒义：要求高的(高标准)；贬义：苛求的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：要求高的(高标准)；贬义：苛求的'], ['The word demanding can be positive or negative depending on context.']],
  ['extreme', 'adj.', '褒义：极端的(投入)；贬义：极端的(过分)', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：极端的(投入)；贬义：极端的(过分)'], ['The word extreme can be positive or negative depending on context.']],
  ['firm', 'adj.', '褒义：坚定的；贬义：固执的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：坚定的；贬义：固执的'], ['The word firm can be positive or negative depending on context.']],
  ['independent', 'adj.', '褒义：独立的/自主的；贬义：孤立的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：独立的/自主的；贬义：孤立的'], ['The word independent can be positive or negative depending on context.']],
  ['passionate', 'adj.', '褒义：热情的；贬义：情绪化的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：热情的；贬义：情绪化的'], ['The word passionate can be positive or negative depending on context.']],
  ['proud', 'adj.', '褒义：自豪的；贬义：骄傲的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：自豪的；贬义：骄傲的'], ['The word proud can be positive or negative depending on context.']],
  ['radical', 'adj.', '褒义：彻底的/根本的；贬义：激进的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：彻底的/根本的；贬义：激进的'], ['The word radical can be positive or negative depending on context.']],
  ['sensitive', 'adj.', '褒义：敏感的/善解人意的；贬义：过于敏感的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：敏感的/善解人意的；贬义：过于敏感的'], ['The word sensitive can be positive or negative depending on context.']],
  ['serious', 'adj.', '褒义：认真的/严肃的；贬义：沉重的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：认真的/严肃的；贬义：沉重的'], ['The word serious can be positive or negative depending on context.']],
  ['stubborn', 'adj.', '褒义：坚定的/不屈的；贬义：顽固的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：坚定的/不屈的；贬义：顽固的'], ['The word stubborn can be positive or negative depending on context.']],
  ['strict', 'adj.', '褒义：严格的；贬义：严厉的', '褒贬', ['注意语境判断褒贬', '阅读理解常考'], ['褒义：严格的；贬义：严厉的'], ['The word strict can be positive or negative depending on context.']]
];

// 常见拼写错误词
const seedMisspelled = [
  ['accommodate', 'v.', '常见错拼: acommodate/accomodate', '易错', ['注意拼写', '常见错拼: acommodate/accomodate'], ['常见错拼: acommodate/accomodate'], ['Pay attention to the spelling of accommodate.']],
  ['achieve', 'v.', '常见错拼: acheive', '易错', ['注意拼写', '常见错拼: acheive'], ['常见错拼: acheive'], ['Pay attention to the spelling of achieve.']],
  ['believe', 'v.', '常见错拼: beleive', '易错', ['注意拼写', '常见错拼: beleive'], ['常见错拼: beleive'], ['Pay attention to the spelling of believe.']],
  ['beginning', 'n.', '常见错拼: begining', '易错', ['注意拼写', '常见错拼: begining'], ['常见错拼: begining'], ['Pay attention to the spelling of beginning.']],
  ['calendar', 'n.', '常见错拼: calender', '易错', ['注意拼写', '常见错拼: calender'], ['常见错拼: calender'], ['Pay attention to the spelling of calendar.']],
  ['category', 'n.', '常见错拼: catagory', '易错', ['注意拼写', '常见错拼: catagory'], ['常见错拼: catagory'], ['Pay attention to the spelling of category.']],
  ['committee', 'n.', '常见错拼: commitee', '易错', ['注意拼写', '常见错拼: commitee'], ['常见错拼: commitee'], ['Pay attention to the spelling of committee.']],
  ['conscience', 'n.', '常见错拼: concience', '易错', ['注意拼写', '常见错拼: concience'], ['常见错拼: concience'], ['Pay attention to the spelling of conscience.']],
  ['definitely', 'adv.', '常见错拼: definately/definitley', '易错', ['注意拼写', '常见错拼: definately/definitley'], ['常见错拼: definately/definitley'], ['Pay attention to the spelling of definitely.']],
  ['desperate', 'adj.', '常见错拼: desparate', '易错', ['注意拼写', '常见错拼: desparate'], ['常见错拼: desparate'], ['Pay attention to the spelling of desperate.']],
  ['development', 'n.', '常见错拼: developement', '易错', ['注意拼写', '常见错拼: developement'], ['常见错拼: developement'], ['Pay attention to the spelling of development.']],
  ['environment', 'n.', '常见错拼: enviroment', '易错', ['注意拼写', '常见错拼: enviroment'], ['常见错拼: enviroment'], ['Pay attention to the spelling of environment.']],
  ['exaggerate', 'v.', '常见错拼: exagerate', '易错', ['注意拼写', '常见错拼: exagerate'], ['常见错拼: exagerate'], ['Pay attention to the spelling of exaggerate.']],
  ['existence', 'n.', '常见错拼: existance', '易错', ['注意拼写', '常见错拼: existance'], ['常见错拼: existance'], ['Pay attention to the spelling of existence.']],
  ['foreign', 'adj.', '常见错拼: foriegn', '易错', ['注意拼写', '常见错拼: foriegn'], ['常见错拼: foriegn'], ['Pay attention to the spelling of foreign.']],
  ['government', 'n.', '常见错拼: goverment', '易错', ['注意拼写', '常见错拼: goverment'], ['常见错拼: goverment'], ['Pay attention to the spelling of government.']],
  ['guarantee', 'v./n.', '常见错拼: gaurantee', '易错', ['注意拼写', '常见错拼: gaurantee'], ['常见错拼: gaurantee'], ['Pay attention to the spelling of guarantee.']],
  ['harass', 'v.', '常见错拼: harrass', '易错', ['注意拼写', '常见错拼: harrass'], ['常见错拼: harrass'], ['Pay attention to the spelling of harass.']],
  ['immediately', 'adv.', '常见错拼: imediately', '易错', ['注意拼写', '常见错拼: imediately'], ['常见错拼: imediately'], ['Pay attention to the spelling of immediately.']],
  ['independent', 'adj.', '常见错拼: independant', '易错', ['注意拼写', '常见错拼: independant'], ['常见错拼: independant'], ['Pay attention to the spelling of independent.']],
  ['intelligent', 'adj.', '常见错拼: inteligent', '易错', ['注意拼写', '常见错拼: inteligent'], ['常见错拼: inteligent'], ['Pay attention to the spelling of intelligent.']],
  ['knowledge', 'n.', '常见错拼: knowlege', '易错', ['注意拼写', '常见错拼: knowlege'], ['常见错拼: knowlege'], ['Pay attention to the spelling of knowledge.']],
  ['library', 'n.', '常见错拼: libary', '易错', ['注意拼写', '常见错拼: libary'], ['常见错拼: libary'], ['Pay attention to the spelling of library.']],
  ['necessary', 'adj.', '常见错拼: neccessary/necesary', '易错', ['注意拼写', '常见错拼: neccessary/necesary'], ['常见错拼: neccessary/necesary'], ['Pay attention to the spelling of necessary.']],
  ['occurrence', 'n.', '常见错拼: occurence', '易错', ['注意拼写', '常见错拼: occurence'], ['常见错拼: occurence'], ['Pay attention to the spelling of occurrence.']],
  ['parallel', 'adj./n.', '常见错拼: paralel', '易错', ['注意拼写', '常见错拼: paralel'], ['常见错拼: paralel'], ['Pay attention to the spelling of parallel.']],
  ['privilege', 'n.', '常见错拼: privelege', '易错', ['注意拼写', '常见错拼: privelege'], ['常见错拼: privelege'], ['Pay attention to the spelling of privilege.']],
  ['profession', 'n.', '常见错拼: proffesion', '易错', ['注意拼写', '常见错拼: proffesion'], ['常见错拼: proffesion'], ['Pay attention to the spelling of profession.']],
  ['receive', 'v.', '常见错拼: recieve', '易错', ['注意拼写', '常见错拼: recieve'], ['常见错拼: recieve'], ['Pay attention to the spelling of receive.']],
  ['recommend', 'v.', '常见错拼: recomend', '易错', ['注意拼写', '常见错拼: recomend'], ['常见错拼: recomend'], ['Pay attention to the spelling of recommend.']],
  ['reference', 'n.', '常见错拼: refference', '易错', ['注意拼写', '常见错拼: refference'], ['常见错拼: refference'], ['Pay attention to the spelling of reference.']],
  ['separate', 'v./adj.', '常见错拼: seperate', '易错', ['注意拼写', '常见错拼: seperate'], ['常见错拼: seperate'], ['Pay attention to the spelling of separate.']],
  ['tomorrow', 'n./adv.', '常见错拼: tomarrow', '易错', ['注意拼写', '常见错拼: tomarrow'], ['常见错拼: tomarrow'], ['Pay attention to the spelling of tomorrow.']],
  ['until', 'prep./conj.', '常见错拼: untill', '易错', ['注意拼写', '常见错拼: untill'], ['常见错拼: untill'], ['Pay attention to the spelling of until.']],
  ['weather', 'n.', '常见错拼: wether', '易错', ['注意拼写', '常见错拼: wether'], ['常见错拼: wether'], ['Pay attention to the spelling of weather.']]
];

// 易混词辨析
const seedConfused = [
  ['affect / effect', '词组', 'affect与effect易混辨析', '易混', ['注意词义和用法区别'], ['affect和effect是常考易混词'], ['Be careful to distinguish affect from effect.']],
  ['principal / principle', '词组', 'principal与principle易混辨析', '易混', ['注意词义和用法区别'], ['principal和principle是常考易混词'], ['Be careful to distinguish principal from principle.']],
  ['stationary / stationery', '词组', 'stationary与stationery易混辨析', '易混', ['注意词义和用法区别'], ['stationary和stationery是常考易混词'], ['Be careful to distinguish stationary from stationery.']],
  ['complement / compliment', '词组', 'complement与compliment易混辨析', '易混', ['注意词义和用法区别'], ['complement和compliment是常考易混词'], ['Be careful to distinguish complement from compliment.']],
  ['disinterested / uninterested', '词组', 'disinterested与uninterested易混辨析', '易混', ['注意词义和用法区别'], ['disinterested和uninterested是常考易混词'], ['Be careful to distinguish disinterested from uninterested.']],
  ['besides / except', '词组', 'besides与except易混辨析', '易混', ['注意词义和用法区别'], ['besides和except是常考易混词'], ['Be careful to distinguish besides from except.']],
  ['job / work', '词组', 'job与work易混辨析', '易混', ['注意词义和用法区别'], ['job和work是常考易混词'], ['Be careful to distinguish job from work.']],
  ['cure / treat', '词组', 'cure与treat易混辨析', '易混', ['注意词义和用法区别'], ['cure和treat是常考易混词'], ['Be careful to distinguish cure from treat.']],
  ['damage / destroy', '词组', 'damage与destroy易混辨析', '易混', ['注意词义和用法区别'], ['damage和destroy是常考易混词'], ['Be careful to distinguish damage from destroy.']],
  ['emigrate / immigrate', '词组', 'emigrate与immigrate易混辨析', '易混', ['注意词义和用法区别'], ['emigrate和immigrate是常考易混词'], ['Be careful to distinguish emigrate from immigrate.']],
  ['respectable / respectful', '词组', 'respectable与respectful易混辨析', '易混', ['注意词义和用法区别'], ['respectable和respectful是常考易混词'], ['Be careful to distinguish respectable from respectful.']],
  ['none / one', '词组', 'none与one易混辨析', '易混', ['注意词义和用法区别'], ['none和one是常考易混词'], ['Be careful to distinguish none from one.']],
  ['discreet / discrete', '词组', 'discreet与discrete易混辨析', '易混', ['注意词义和用法区别'], ['discreet和discrete是常考易混词'], ['Be careful to distinguish discreet from discrete.']],
  ['cost / take、cost、pay', '词组', 'cost与take、cost、pay易混辨析', '易混', ['注意词义和用法区别'], ['cost和take、cost、pay是常考易混词'], ['Be careful to distinguish cost from take、cost、pay.']],
  ['pay / take、cost、pay', '词组', 'pay与take、cost、pay易混辨析', '易混', ['注意词义和用法区别'], ['pay和take、cost、pay是常考易混词'], ['Be careful to distinguish pay from take、cost、pay.']],
  ['cost / pay', '词组', 'cost与pay易混辨析', '易混', ['注意词义和用法区别'], ['cost和pay是常考易混词'], ['Be careful to distinguish cost from pay.']],
  ['fit、suit、match / suit', '词组', 'fit、suit、match与suit易混辨析', '易混', ['注意词义和用法区别'], ['fit、suit、match和suit是常考易混词'], ['Be careful to distinguish fit、suit、match from suit.']],
  ['fit、suit、match / match', '词组', 'fit、suit、match与match易混辨析', '易混', ['注意词义和用法区别'], ['fit、suit、match和match是常考易混词'], ['Be careful to distinguish fit、suit、match from match.']],
  ['match / suit', '词组', 'match与suit易混辨析', '易混', ['注意词义和用法区别'], ['match和suit是常考易混词'], ['Be careful to distinguish match from suit.']],
  ['credible、credulous、creditable / credulous', '词组', 'credible、credulous、creditable与credulous易混辨析', '易混', ['注意词义和用法区别'], ['credible、credulous、creditable和credulous是常考易混词'], ['Be careful to distinguish credible、credulous、creditable from credulous.']],
  ['credible、credulous、creditable / creditable', '词组', 'credible、credulous、creditable与creditable易混辨析', '易混', ['注意词义和用法区别'], ['credible、credulous、creditable和creditable是常考易混词'], ['Be careful to distinguish credible、credulous、creditable from creditable.']],
  ['creditable / credulous', '词组', 'creditable与credulous易混辨析', '易混', ['注意词义和用法区别'], ['creditable和credulous是常考易混词'], ['Be careful to distinguish creditable from credulous.']],
  ['assure、ensure、insure / ensure', '词组', 'assure、ensure、insure与ensure易混辨析', '易混', ['注意词义和用法区别'], ['assure、ensure、insure和ensure是常考易混词'], ['Be careful to distinguish assure、ensure、insure from ensure.']],
  ['assure、ensure、insure / insure', '词组', 'assure、ensure、insure与insure易混辨析', '易混', ['注意词义和用法区别'], ['assure、ensure、insure和insure是常考易混词'], ['Be careful to distinguish assure、ensure、insure from insure.']],
  ['ensure / insure', '词组', 'ensure与insure易混辨析', '易混', ['注意词义和用法区别'], ['ensure和insure是常考易混词'], ['Be careful to distinguish ensure from insure.']],
  ['adapt、adjust、adopt / adjust', '词组', 'adapt、adjust、adopt与adjust易混辨析', '易混', ['注意词义和用法区别'], ['adapt、adjust、adopt和adjust是常考易混词'], ['Be careful to distinguish adapt、adjust、adopt from adjust.']],
  ['adapt、adjust、adopt / adopt', '词组', 'adapt、adjust、adopt与adopt易混辨析', '易混', ['注意词义和用法区别'], ['adapt、adjust、adopt和adopt是常考易混词'], ['Be careful to distinguish adapt、adjust、adopt from adopt.']],
  ['adjust / adopt', '词组', 'adjust与adopt易混辨析', '易混', ['注意词义和用法区别'], ['adjust和adopt是常考易混词'], ['Be careful to distinguish adjust from adopt.']],
  ['look、see、watch / see', '词组', 'look、see、watch与see易混辨析', '易混', ['注意词义和用法区别'], ['look、see、watch和see是常考易混词'], ['Be careful to distinguish look、see、watch from see.']],
  ['look、see、watch / watch', '词组', 'look、see、watch与watch易混辨析', '易混', ['注意词义和用法区别'], ['look、see、watch和watch是常考易混词'], ['Be careful to distinguish look、see、watch from watch.']],
  ['see / watch', '词组', 'see与watch易混辨析', '易混', ['注意词义和用法区别'], ['see和watch是常考易混词'], ['Be careful to distinguish see from watch.']],
  ['compose、consist、constitute / consist', '词组', 'compose、consist、constitute与consist易混辨析', '易混', ['注意词义和用法区别'], ['compose、consist、constitute和consist是常考易混词'], ['Be careful to distinguish compose、consist、constitute from consist.']],
  ['compose、consist、constitute / constitute', '词组', 'compose、consist、constitute与constitute易混辨析', '易混', ['注意词义和用法区别'], ['compose、consist、constitute和constitute是常考易混词'], ['Be careful to distinguish compose、consist、constitute from constitute.']],
  ['consist / constitute', '词组', 'consist与constitute易混辨析', '易混', ['注意词义和用法区别'], ['consist和constitute是常考易混词'], ['Be careful to distinguish consist from constitute.']],
  ['continual、continuous、constant / continuous', '词组', 'continual、continuous、constant与continuous易混辨析', '易混', ['注意词义和用法区别'], ['continual、continuous、constant和continuous是常考易混词'], ['Be careful to distinguish continual、continuous、constant from continuous.']],
  ['constant / continual、continuous、constant', '词组', 'constant与continual、continuous、constant易混辨析', '易混', ['注意词义和用法区别'], ['constant和continual、continuous、constant是常考易混词'], ['Be careful to distinguish constant from continual、continuous、constant.']],
  ['constant / continuous', '词组', 'constant与continuous易混辨析', '易混', ['注意词义和用法区别'], ['constant和continuous是常考易混词'], ['Be careful to distinguish constant from continuous.']],
  ['dispel / repel、dispel、expel', '词组', 'dispel与repel、dispel、expel易混辨析', '易混', ['注意词义和用法区别'], ['dispel和repel、dispel、expel是常考易混词'], ['Be careful to distinguish dispel from repel、dispel、expel.']],
  ['expel / repel、dispel、expel', '词组', 'expel与repel、dispel、expel易混辨析', '易混', ['注意词义和用法区别'], ['expel和repel、dispel、expel是常考易混词'], ['Be careful to distinguish expel from repel、dispel、expel.']],
  ['dispel / expel', '词组', 'dispel与expel易混辨析', '易混', ['注意词义和用法区别'], ['dispel和expel是常考易混词'], ['Be careful to distinguish dispel from expel.']]
];

/* ============================
   二、词根词缀数据
   ============================ */
const affixData = {
  prefixes: [
    ['dis-', '否定；相反', 'disable, disagree, disappear, disconnect'],
    ['un-', '否定；解除', 'unlock, unfold, uncover, unconscious'],
    ['re-', '重复；返回', 'rewrite, rebuild, reconsider, restore'],
    ['mis-', '错误；坏', 'misjudge, misplace, misbehave, misinform'],
    ['over-', '过度；超过', 'overload, overreact, oversleep, overcharge'],
    ['under-', '不足；低于', 'underestimate, underdeveloped, underpaid'],
    ['pre-', '在...之前', 'predict, preview, precaution, preschool'],
    ['post-', '在...之后', 'postpone, postgraduate, postwar, postscript'],
  ],
  suffixes: [
    ['-able/-ible', '可...的', 'reliable, affordable, accessible, reversible'],
    ['-tion/-sion', '名词后缀', 'determination, admission, conclusion, pollution'],
    ['-ment', '名词后缀', 'improvement, equipment, agreement, settlement'],
    ['-ful', '充满...的', 'powerful, cheerful, skillful, respectful'],
    ['-less', '无...的', 'careless, fearless, useless, breathless'],
    ['-ify/-ize', '使...化', 'simplify, terrify, modernize, recognize'],
    ['-ence/-ance', '名词后缀', 'confidence, importance, appearance, tolerance'],
    ['-al', '形容词/名词', 'natural, cultural, survival, approval'],
  ],
  roots: [
    ['spect', '看', 'spectator, prospect, aspect, suspect, inspect, respect'],
    ['struct', '建造', 'structure, instruct, reconstruct, construct, obstruct'],
    ['ject', '投掷', 'eject, object, subject, project, inject, reject'],
    ['port', '携带', 'import, export, support, transport, passport, deport'],
    ['bio', '生命', 'biology, biography, biodegradable, biochemistry'],
    ['dict', '说', 'predict, indicate, contradict, dictate, dictionary'],
    ['graph', '写/画', 'photograph, autobiography, geography, telegraph'],
    ['phon', '声音', 'microphone, symphony, telephone, phonetic, megaphone'],
    ['therm', '热', 'thermometer, thermal, thermostat, thermos, geothermal'],
    ['hydr', '水', 'hydrogen, hydrate, dehydrate, hydraulic, hydroelectric'],
    ['ced/ceed/cess', '走', 'precede, proceed, succeed, exceed, access, process'],
    ['fer', '带来/拿', 'transfer, prefer, refer, infer, offer, confer'],
    ['gress', '行走', 'progress, regress, congress, aggressive, digress'],
    ['vis/vid', '看', 'visit, visible, vision, visual, revise, provide'],
    ['clud/clus', '关闭', 'include, exclude, conclude, preclude, exclusive'],
    ['man', '手', 'manage, manual, manufacture, manipulate, manuscript'],
    ['ped', '脚', 'pedal, pedestrian, pedestal, expedition, impediment'],
    ['scrib/script', '写', 'describe, prescribe, subscribe, scribble, script'],
    ['nov', '新', 'novel, innovation, novice, renovate, novelty'],
    ['sol', '单独', 'solo, solitary, isolate, desolate, soluble'],
  ]
};

// 情景记忆数据：高考高频主题词+语境文章
const sceneData = [
  {
    title: '🌍 环境保护',
    words: ['environment', 'pollution', 'sustainable', 'climate', 'carbon', 'renewable', 'ecosystem', 'conservation', 'emission', 'biodiversity'],
    text: 'Environmental protection has become one of the most pressing issues of our time. With climate change accelerating, governments worldwide are implementing policies to reduce carbon emissions and promote renewable energy sources. The Paris Agreement represents a landmark effort to limit global warming to well below 2°C. At the individual level, we can contribute by adopting sustainable lifestyles — reducing waste, recycling, and conserving water. The protection of biodiversity and ecosystems is equally important, as every species plays a vital role in maintaining the balance of nature.',
    textCn: '环境保护已成为我们这个时代最紧迫的问题之一。随着气候变化的加速，各国政府正在实施减少碳排放和推广可再生能源的政策。巴黎协定是一项将全球变暖控制在远低于2°C以下的里程碑式努力。在个人层面，我们可以通过采取可持续的生活方式来做出贡献——减少废物、回收利用和节约用水。保护生物多样性和生态系统同样重要，因为每个物种在维持自然平衡中都发挥着至关重要的作用。'
  },
  {
    title: '🤖 人工智能与科技',
    words: ['artificial', 'intelligence', 'algorithm', 'automation', 'innovation', 'digital', 'robot', 'data', 'virtual', 'network'],
    text: 'Artificial intelligence is transforming every aspect of our lives, from healthcare to education. AI-powered systems can now diagnose diseases with remarkable accuracy, personalize learning experiences, and even create art. However, the rapid advancement of automation also raises concerns about job displacement and ethical issues. As we embrace digital innovation, we must ensure that technology serves humanity rather than the other way around. The key lies in developing responsible AI that respects privacy, promotes fairness, and remains under human control.',
    textCn: '人工智能正在改变我们生活的方方面面，从医疗保健到教育。由人工智能驱动的系统现在已经能够以惊人的精确度诊断疾病、个性化学习体验，甚至创作艺术作品。然而，自动化的快速发展也引发了对就业岗位被取代和伦理问题的担忧。在接受数字化创新的同时，我们必须确保技术服务于人类，而非相反。关键在于开发负责任的人工智能——尊重隐私、促进公平，并始终处于人类的控制之下。'
  },
  {
    title: '📚 教育成长',
    words: ['education', 'knowledge', 'curriculum', 'academic', 'graduate', 'scholarship', 'discipline', 'potential', 'inspire', 'achieve'],
    text: 'Education is not merely the transmission of knowledge but the cultivation of curiosity and critical thinking. A well-rounded curriculum should balance academic rigor with character development. Students who discover their true potential often do so through the guidance of inspiring teachers who go beyond textbooks. The goal of education is not just to help students graduate with good grades, but to equip them with the discipline and resilience needed to navigate life\'s challenges. As Nelson Mandela once said, "Education is the most powerful weapon which you can use to change the world."',
    textCn: '教育不仅是知识的传递，更是好奇心和批判性思维的培养。一个全面的课程体系应该在学术严谨性与品格发展之间取得平衡。那些发现自己真正潜力的学生，往往是在超越课本的启发性教师的引导下做到的。教育的目标不仅仅是帮助学生以优异成绩毕业，更要赋予他们应对人生挑战所需的自律和韧性。正如纳尔逊·曼德拉所说："教育是你可以用来改变世界的最强大的武器。"'
  },
  {
    title: '🏛️ 传统文化',
    words: ['traditional', 'culture', 'heritage', 'civilization', 'ancestor', 'festival', 'custom', 'ceremony', 'ancient', 'preserve'],
    text: 'Traditional culture represents the wisdom and values accumulated over thousands of years of civilization. From the Spring Festival to the Mid-Autumn Festival, Chinese customs and ceremonies reflect our ancestors\' deep understanding of nature and human relationships. However, in an increasingly globalized world, many traditional practices are at risk of being forgotten. It is our responsibility to preserve this cultural heritage while adapting it to modern contexts. By learning about our roots, we gain a stronger sense of identity and belonging.',
    textCn: '传统文化代表了数千年文明积累下来的智慧与价值观。从春节到中秋节，中国的习俗和仪式反映了我们的祖先对自然和人际关系的深刻理解。然而，在日益全球化的世界中，许多传统习俗正面临被遗忘的风险。我们有责任在将这一文化遗产适应现代环境的同时加以保护。通过了解我们的根源，我们获得了更强烈的认同感和归属感。'
  },
  {
    title: '💪 健康生活',
    words: ['health', 'nutrition', 'exercise', 'mental', 'balanced', 'diet', 'psychological', 'physical', 'wellness', 'habit'],
    text: 'A healthy lifestyle is the foundation of happiness and productivity. Regular physical exercise not only strengthens the body but also boosts mental well-being by releasing endorphins. A balanced diet rich in nutrition provides the energy needed for daily activities. Equally important is psychological health — managing stress, maintaining positive relationships, and getting adequate sleep. Developing good habits early in life pays dividends for decades to come. Remember, health is not just the absence of illness, but a state of complete physical, mental, and social wellness.',
    textCn: '健康的生活方式是幸福和高效的基础。规律的身体锻炼不仅能强健体魄，还能通过释放内啡肽来促进心理健康。富含营养的均衡饮食为日常活动提供了所需的能量。同样重要的是心理健康——管理压力、保持积极的人际关系以及获得充足的睡眠。尽早养成良好的习惯，将会在未来的数十年中带来丰厚的回报。记住，健康不仅是没有疾病，而是一种身心和社会福祉完全良好的状态。'
  },
  {
    title: '🌐 社会热点',
    words: ['globalization', 'diversity', 'equality', 'poverty', 'volunteer', 'community', 'justice', 'opportunity', 'challenge', 'responsibility'],
    text: 'In an era of globalization, we are more connected than ever before. Issues such as poverty, inequality, and social justice transcend national borders and require collective action. Volunteering in community service not only helps those in need but also broadens our perspective and cultivates empathy. Every individual has the responsibility to contribute to a more just and compassionate society. While the challenges we face are daunting, they also present opportunities for innovation and positive change. As global citizens, we must embrace diversity and work together toward a sustainable future.',
    textCn: '在全球化的时代，我们比以往任何时候都更加紧密地联系在一起。贫困、不平等和社会正义等问题超越了国界，需要共同应对。参与社区服务的志愿活动不仅帮助有需要的人，还能拓宽我们的视野、培养同理心。每个人都有责任为一个更加公正和富有同情心的社会做出贡献。虽然我们面临的挑战令人畏惧，但它们也为创新和积极变革提供了机遇。作为全球公民，我们必须拥抱多样性，共同努力迈向可持续的未来。'
  }
];

// 拼写纠错数据：常见高考英语拼写错误
const spellingData = [
  { correct: 'receive', wrong: 'recieve', tip: 'i 在 e 前，除了在 c 后：re-cei-ve' },
  { correct: 'necessary', wrong: 'neccessary', tip: '1个c，2个s：ne-ce-ssa-ry' },
  { correct: 'accommodation', wrong: 'accomodation', tip: '双c双m：ac-com-mo-da-tion' },
  { correct: 'embarrass', wrong: 'embarass', tip: '双r双s：em-bar-rass' },
  { correct: 'occasion', wrong: 'ocassion', tip: '双c单s：oc-ca-sion' },
  { correct: 'separate', wrong: 'seperate', tip: '中间是 para：se-pa-rate' },
  { correct: 'definitely', wrong: 'definately', tip: 'finite（有限的）在中间：de-fi-ni-te-ly' },
  { correct: 'grammar', wrong: 'grammer', tip: '以 -ar 结尾，不是 -er' },
  { correct: 'believe', wrong: 'beleive', tip: 'i 在 e 前：be-lieve' },
  { correct: 'occurrence', wrong: 'occurence', tip: 'occur 双写 r 加 -ence' },
  { correct: 'recommend', wrong: 'reccomend', tip: '1个c，2个m：re-com-mend' },
  { correct: 'beautiful', wrong: 'beatiful', tip: 'eau 像水，美丽如水：beau-ti-ful' },
  { correct: 'argument', wrong: 'arguement', tip: 'argue 去 e 加 -ment' },
  { correct: 'desperate', wrong: 'desparate', tip: 'perate 在中间：des-pe-rate' },
  { correct: 'foreign', wrong: 'foriegn', tip: 'for + reign（统治），不是 foriegn' },
  { correct: 'government', wrong: 'goverment', tip: '中间是 govern（治理）：gov-ern-ment' },
  { correct: 'independent', wrong: 'independant', tip: '以 -ent 结尾，不是 -ant' },
  { correct: 'intelligence', wrong: 'inteligence', tip: '双写 l：in-tel-li-gence' },
  { correct: 'library', wrong: 'libary', tip: '中间有 bra：li-bra-ry' },
  { correct: 'millennium', wrong: 'millenium', tip: '双 l 双 n：mil-len-ni-um' },
  { correct: 'occurred', wrong: 'occured', tip: 'occur 双写 r 加 -ed' },
  { correct: 'possession', wrong: 'posession', tip: 'possess 双写 s 加 -ion' },
  { correct: 'precedent', wrong: 'preceedent', tip: 'precede 只有一个 c，去 e 加 -ent' },
  { correct: 'proceed', wrong: 'procede', tip: '双 c 双 e：pro-ceed' },
  { correct: 'privilege', wrong: 'priviledge', tip: '没有 d：pri-vi-lege' },
  { correct: 'publicly', wrong: 'publically', tip: 'public 直接加 -ly，不要加 -al' },
  { correct: 'questionnaire', wrong: 'questionaire', tip: '双写 n：ques-tion-naire' },
  { correct: 'restaurant', wrong: 'restarant', tip: '中间有 aura（气息）：res-tau-rant' },
  { correct: 'rhythm', wrong: 'rythm', tip: '以 rh- 开头，像 rhyme（韵）' },
  { correct: 'schedule', wrong: 'schedual', tip: '以 -ule 结尾，不是 -ual' },
  { correct: 'subtle', wrong: 'subltle', tip: 'b 不发音，不要把 l 放到 b 前面' },
  { correct: 'succeed', wrong: 'suceed', tip: '双 c 双 s：suc-ceed' },
  { correct: 'surprise', wrong: 'suprise', tip: 'sur-prise，不要漏掉第一个 r' },
  { correct: 'threshold', wrong: 'threshhold', tip: '只有一个 h：thresh-old' },
  { correct: 'tomorrow', wrong: 'tommorow', tip: '1个 m，2个 r：to-mor-row' },
  { correct: 'truly', wrong: 'truely', tip: 'true 去 e 加 -ly' },
  { correct: 'until', wrong: 'untill', tip: '只有一个 l' },
  { correct: 'vacuum', wrong: 'vaccum', tip: '以 -uum 结尾，不是 -cum' },
  { correct: 'weird', wrong: 'wierd', tip: 'i 在 e 前（weird 是例外规则中的例外）：wei-rd' },
  { correct: 'writing', wrong: 'writting', tip: 'write 去 e 加 -ing，t 不双写' }
];

// 自定义拼写纠错（localStorage 扩展）
function loadCustomSpelling() {
  try { return JSON.parse(localStorage.getItem('customSpelling') || '[]'); }
  catch { return []; }
}
function saveCustomSpelling(list) {
  localStorage.setItem('customSpelling', JSON.stringify(list));
}

// 原有核心短语库
const seedPhrases = [
  ['as a result', '短语', '结果；因此', '高频', ['常放句首或句中作结果状语'], ['as a result 后接句子；as a result of 后接名词/doing'], ['He worked hard. As a result, he passed the exam.']],
  ['be absorbed in', '短语', '专心于', '高频', ['表示专注状态'], ['同义 be buried in/be devoted to/concentrate on'], ['She is absorbed in preparing for the exam.']],
  ['be concerned about', '短语', '担心；关心', '高频', ['about 表担心对象'], ['as far as... concerned 观点表达'], ['Parents are concerned about children\'s safety.']],
  ['break down', '短语', '出故障；崩溃', '高频', ['机器坏了；情绪崩溃'], ['break up/out/through 区分'], ['The car broke down on the way.']],
  ['carry out', '短语', '执行；开展', '高频', ['carry out a plan/survey'], ['常用于活动、调查、实验'], ['A survey was carried out among students.']],
  ['come up with', '短语', '提出；想出', '高频', ['提出想法/办法'], ['同 think of/put forward'], ['He came up with a good idea.']],
  ['contribute to', '短语', '有助于；导致', '高频', ['to 是介词'], ['make contributions to'], ['Reading contributes to better writing.']],
  ['deal with', '短语', '处理；涉及', '高频', ['how to deal with'], ['deal with 与 do with 疑问词搭配不同'], ['We must learn how to deal with stress.']],
  ['due to', '短语', '由于', '高频', ['后接名词/doing'], ['because of/owing to 同义'], ['The match was canceled due to heavy rain.']],
  ['figure out', '短语', '弄清楚；计算出', '中频', ['figure out the meaning/problem'], ['同 work out'], ['Can you figure out the answer?']],
  ['get along with', '短语', '与……相处', '高频', ['get along well with sb'], ['作文人际关系常用'], ['She gets along well with her classmates.']],
  ['give rise to', '短语', '引起；导致', '中频', ['正式表达 cause'], ['rise/arise/raise 易混'], ['Pollution gives rise to many health problems.']],
  ['in addition', '短语', '此外', '高频', ['句首连接补充信息'], ['besides/furthermore 同义'], ['In addition, students should exercise regularly.']],
  ['in case', '短语', '以防；万一', '高频', ['引导目的或条件状语从句'], ['区别 in that case'], ['Take an umbrella in case it rains.']],
  ['in charge of', '短语', '负责', '高频', ['人 be in charge of 事'], ['charge 搭配辨析常考'], ['She is in charge of the English club.']],
  ['make a difference', '短语', '有影响；起作用', '高频', ['make a difference to'], ['环保/志愿主题常用'], ['Small actions can make a big difference.']],
  ['make full use of', '短语', '充分利用', '高频', ['后接时间/资源/机会'], ['同 take advantage of'], ['We should make full use of our time.']],
  ['on behalf of', '短语', '代表', '中频', ['应用文开头常用'], ['正式表达'], ['On behalf of our class, I welcome you.']],
  ['put forward', '短语', '提出', '中频', ['put forward a suggestion/plan'], ['更正式'], ['A new plan was put forward.']],
  ['refer to', '短语', '提到；查阅', '高频', ['refer to a dictionary'], ['一词多义常考'], ['The word refers to a useful method.']],
  ['set up', '短语', '建立；设立', '高频', ['set up a club/company'], ['同 establish/found'], ['They set up a club to help others.']],
  ['take measures to', '短语', '采取措施做', '高频', ['后接动词原形'], ['同 take steps/action to'], ['We should take measures to protect the environment.']],
];

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

function makeItem(row, type, index) {
  const [term, pos, meaning, frequency, corePoints, allPoints, examples] = row;
  return {
    id: `${type}-${index}-${term}`,
    type, term, pos, meaning, frequency, corePoints, allPoints, examples,
    phonetic: generatePhonetic(term),
    notes: '',
    source: '内置高考词库'
  };
}

function makeAllItems(seedArr, type) {
  return seedArr.map((row, i) => makeItem(row, type.includes('phrase') || type.includes('词组') || type.includes('易混') || type.includes('同义') || type.includes('反义') || type.includes('逻辑') || type.includes('结论') || type.includes('熟词') || type.includes('生义') || type.includes('褒贬') || type.includes('易错') || type.includes('超纲') || type.includes('必考') || type.includes('真题') || type.includes('主题') ? 'phrase' : type, i));
}

const builtInBooks = [
  {
    id: 'gaokao-core',
    name: '高考核心词库(原版48词)',
    editable: false,
    items: [
      ['abandon','v.','放弃；遗弃','高频',['abandon oneself to 沉溺于'],['常考动词搭配'],['He abandoned smoking before the exam.']],
      ['ability','n.','能力；才能','高频',['have the ability to do 有能力做'],['ability 后常接不定式'],['Reading improves our ability to think.']],
      ['absorb','v.','吸收；理解；使专注','高频',['be absorbed in 专心于'],['过去分词 absorbed 作形容词常考'],['She was absorbed in the novel.']],
      ['access','n./v.','通道；机会；访问','高频',['have access to 有机会使用'],['access to 中 to 是介词'],['Students have access to online resources.']],
      ['account','n./v.','账户；解释；认为','高频',['account for 解释；占比'],['account for 高频短语动词'],['Can you account for your absence?']],
      ['achieve','v.','实现；取得','高频',['achieve one\'s goal 实现目标'],['名词 achievement'],['Hard work helps us achieve our dreams.']],
      ['adapt','v.','适应；改编','高频',['adapt to 适应'],['to 为介词'],['We must adapt to changes quickly.']],
      ['admire','v.','钦佩；欣赏','高频',['admire sb for sth'],['for 是固定介词'],['I admire her for her courage.']],
      ['admit','v.','承认；准许进入','高频',['admit doing 承认做过'],['后接 doing 不接 to do'],['He admitted making a mistake.']],
      ['advantage','n.','优点；优势','高频',['take advantage of 利用'],['反义 disadvantage'],['We should take advantage of every chance.']],
      ['affect','v.','影响；感动','高频',['be affected by 受……影响'],['effect 是名词"影响"常混'],['Weather affects our mood.']],
      ['afford','v.','负担得起','高频',['afford to do'],['常与 can/could 连用'],['Many students cannot afford to waste time.']],
      ['aim','n./v.','目标；旨在','高频',['aim to do 打算做'],['aim at doing/sb'],['The activity is aimed at helping students.']],
      ['allow','v.','允许','高频',['allow sb to do'],['注意 doing/to do 区别'],['We are not allowed to use phones in class.']],
      ['anxious','adj.','焦虑的；渴望的','高频',['be anxious about 担心'],['anxiety n.焦虑'],['Parents are anxious about their children.']],
      ['apply','v.','申请；应用','高频',['apply for 申请'],['application/applicant 派生'],['She applied for a scholarship.']],
      ['approach','n./v.','方法；接近','高频',['an approach to doing'],['to 是介词后接 doing'],['This is a new approach to solving the problem.']],
      ['avoid','v.','避免','高频',['avoid doing'],['后接 doing 不接 to do'],['Try to avoid making the same mistake.']],
      ['benefit','n./v.','好处；受益','高频',['benefit from'],['作文高频'],['Students benefit from regular reading.']],
      ['challenge','n./v.','挑战','高频',['face a challenge'],['challenging adj.有挑战性的'],['The task is challenging but meaningful.']],
      ['concern','n./v.','担心；涉及','高频',['be concerned about 担心'],['concerning prep.关于'],['Parents are concerned about safety.']],
      ['contribute','v.','贡献；促成','高频',['contribute to 有助于'],['to 是介词'],['Exercise contributes to good health.']],
      ['convenient','adj.','方便的','高频',['It is convenient for sb to do'],['不能说 sb is convenient'],['It is convenient for us to shop online.']],
      ['determine','v.','决定；确定','高频',['be determined to do 决心做'],['determination n.'],['She is determined to improve English.']],
      ['devote','v.','奉献；投入','高频',['devote oneself to doing'],['to 是介词'],['He devoted his life to education.']],
      ['evidence','n.','证据','高频',['there is evidence that'],['不可数名词常考'],['There is evidence that sleep affects memory.']],
      ['focus','n./v.','焦点；集中','高频',['focus on 集中于'],['作文高频'],['Focus on what you can control.']],
      ['impress','v.','给……留下印象','高频',['be impressed by/with'],['impression n.'],['The speech impressed everyone deeply.']],
      ['influence','n./v.','影响','高频',['have an influence on'],['affect 动词；effect/influence 名词'],['Friends have a strong influence on teenagers.']],
      ['involve','v.','涉及；包含','高频',['be involved in 参与'],['后接 doing'],['The job involves communicating with others.']],
      ['opportunity','n.','机会','高频',['have an opportunity to do'],['chance/opportunity 辨析'],['The contest offers an opportunity to learn.']],
      ['prevent','v.','阻止；预防','高频',['prevent sb from doing'],['被动 from 不可省'],['The rules prevent accidents from happening.']],
      ['recommend','v.','推荐；建议','高频',['recommend doing'],['虚拟语气 should 可省'],['I recommend reading aloud every day.']],
      ['require','v.','要求；需要','高频',['require sb to do'],['requirement n.'],['The flowers require watering every day.']],
      ['responsible','adj.','负责的','高频',['be responsible for'],['responsibility n.'],['Everyone is responsible for protecting nature.']],
      ['significant','adj.','重要的；显著的','高频',['a significant difference'],['significance n.'],['Reading has a significant effect on writing.']],
      ['solution','n.','解决办法','高频',['a solution to'],['to 是介词'],['We need a solution to the problem.']],
    ].map((row, i) => makeItem(row, 'word', i))
  },
  {
    id: 'gaokao-985',
    name: '985阅读理解核心词汇',
    editable: false,
    items: makeAllItems(seedWords985, 'word')
  },
  {
    id: 'gaokao-105',
    name: '105必考核心词(2021-2025)',
    editable: false,
    items: makeAllItems(seedWords105, 'word')
  },
  {
    id: 'gaokao-exam',
    name: '近五年真题高频词',
    editable: false,
    items: makeAllItems(seedWordsExam, 'word')
  },
  {
    id: 'gaokao-positive',
    name: '褒义词(92个)',
    editable: false,
    items: makeAllItems(seedWordsPositive, 'word')
  },
  {
    id: 'gaokao-negative',
    name: '贬义词(83个)',
    editable: false,
    items: makeAllItems(seedWordsNegative, 'word')
  },
  {
    id: 'gaokao-super',
    name: '超纲高频词(99个)',
    editable: false,
    items: makeAllItems(seedWordsSuper, 'word')
  },
  {
    id: 'gaokao-synonym',
    name: '同义词对比(232组)',
    editable: false,
    items: makeAllItems(seedSynonyms, 'phrase')
  },
  {
    id: 'gaokao-antonym',
    name: '反义词对比(70组)',
    editable: false,
    items: makeAllItems(seedAntonyms, 'phrase')
  },
  {
    id: 'gaokao-conclusion',
    name: '逻辑结论词(13个)',
    editable: false,
    items: makeAllItems(seedConclusion, 'phrase')
  },
  {
    id: 'gaokao-topic',
    name: '高考高频主题词(30个)',
    editable: false,
    items: makeAllItems(seedTopic, 'phrase')
  },
  {
    id: 'gaokao-familiar-new',
    name: '熟词生义(30个)',
    editable: false,
    items: makeAllItems(seedFamiliarNew, 'phrase')
  },
  {
    id: 'gaokao-dual-sentiment',
    name: '褒贬双性词(17个)',
    editable: false,
    items: makeAllItems(seedDualSentiment, 'phrase')
  },
  {
    id: 'gaokao-confused',
    name: '易混词辨析',
    editable: false,
    items: makeAllItems(seedConfused, 'phrase')
  },
  {
    id: 'mastered-words',
    name: '已掌握词库',
    editable: false,
    items: []
  },
];

/* ============================
   四、背诵模式配置
   ============================ */

const choiceModes = [
  { id: 'en-to-cn', name: '英文选中文' },
  { id: 'cn-to-en', name: '中文选英文' },
  { id: 'flashcard', name: '闪卡模式' }
];

/* ============================
   五、内置可下载词库数据
   ============================ */

const builtInDownloads = [
  {
    id: 'dl-3500',
    name: '高考3500基础词汇',
    desc: '高考大纲3500核心词汇精选',
    items: [
      ['abandon','v.','放弃；遗弃','高频',['abandon oneself to 沉溺于'],['常考动词搭配'],['He abandoned smoking.']],
      ['ability','n.','能力；才能','高频',['have the ability to do'],['后常接不定式'],['She has the ability to lead.']],
      ['abroad','adv.','在国外；到处','高频',['go abroad 出国'],['study abroad 留学'],['He went abroad last year.']],
      ['absence','n.','缺席；不在','高频',['absence of mind 心不在焉'],['in the absence of 缺乏'],['His absence was noticed.']],
      ['absolute','adj.','绝对的；完全的','高频',['absolute power 绝对权力'],['absolutely adv.'],['It is absolute nonsense.']],
      ['absorb','v.','吸收；使专心','高频',['be absorbed in 专心于'],['absorb knowledge 吸收知识'],['She was absorbed in reading.']],
      ['abstract','adj.','抽象的','高频',['abstract art 抽象艺术'],['abstract noun 抽象名词'],['The concept is too abstract.']],
      ['academic','adj.','学术的','高频',['academic year 学年'],['academic performance 学业表现'],['He has good academic records.']],
      ['accelerate','v.','加速','中频',['accelerate the pace 加速'],['acceleration n.'],['The car accelerated quickly.']],
      ['accept','v.','接受；承认','高频',['accept an offer 接受提议'],['acceptable adj.'],['She accepted the invitation.']],
      ['access','n.','通道；使用权','高频',['have access to 有权使用'],['accessible adj.'],['Students have access to the library.']],
      ['accident','n.','事故；意外','高频',['by accident 偶然'],['accidental adj.'],['He had a car accident.']],
      ['accompany','v.','陪伴；伴随','高频',['accompany sb 陪伴某人'],['accompanying adj.'],['She accompanied her mother.']],
      ['accomplish','v.','完成；实现','中频',['accomplish a task 完成任务'],['accomplishment n.'],['She accomplished her goal.']],
      ['account','n.','账户；描述','高频',['take into account 考虑'],['account for 解释'],['Please give an account of the event.']],
      ['accurate','adj.','精确的','高频',['accurate description 精确描述'],['accuracy n.'],['The information is accurate.']],
      ['accuse','v.','指控','中频',['accuse sb of sth 指控某人'],['accusation n.'],['He was accused of theft.']],
      ['achieve','v.','实现；取得','高频',['achieve success 取得成功'],['achievement n.'],['She achieved great success.']],
      ['acknowledge','v.','承认；感谢','中频',['acknowledge receipt 确认收到'],['acknowledgement n.'],['He acknowledged his mistake.']],
      ['acquire','v.','获得；习得','中频',['acquire knowledge 获取知识'],['acquisition n.'],['She acquired a new skill.']],
      ['adapt','v.','适应；改编','高频',['adapt to 适应'],['adaptation n.'],['We must adapt to changes.']],
    ]
  },
  {
    id: 'dl-phrase500',
    name: '高考核心短语500',
    desc: '高考高频必考短语精选',
    items: [
      ['as a result','短语','结果；因此','高频',['常放句首或句中作结果状语'],['as a result of 后接名词'],['He worked hard. As a result, he passed.']],
      ['be absorbed in','短语','专心于','高频',['表示专注状态'],['同义 be buried in/concentrate on'],['She is absorbed in studying.']],
      ['be concerned about','短语','担心；关心','高频',['about 表担心对象'],['as far as...concerned'],['Parents are concerned about safety.']],
      ['break down','短语','出故障；崩溃','高频',['机器坏了；情绪崩溃'],['break up/out/through 区分'],['The car broke down.']],
      ['carry out','短语','执行；开展','高频',['carry out a plan/survey'],['常用于活动、调查'],['A survey was carried out.']],
      ['come up with','短语','提出；想出','高频',['提出想法/办法'],['同 think of/put forward'],['He came up with a good idea.']],
      ['contribute to','短语','有助于；导致','高频',['to 是介词'],['make contributions to'],['Reading contributes to writing.']],
      ['deal with','短语','处理；涉及','高频',['how to deal with'],['deal with 与 do with 区别'],['We must deal with stress.']],
      ['due to','短语','由于','高频',['后接名词/doing'],['because of/owing to 同义'],['The match was canceled due to rain.']],
      ['figure out','短语','弄清楚；计算出','中频',['figure out the meaning/problem'],['同 work out'],['Can you figure out the answer?']],
      ['get along with','短语','与...相处','高频',['get along well with sb'],['作文人际关系常用'],['She gets along well with classmates.']],
      ['give rise to','短语','引起；导致','中频',['正式表达 cause'],['rise/arise/raise 易混'],['Pollution gives rise to health problems.']],
      ['in addition','短语','此外','高频',['句首连接补充信息'],['besides/furthermore 同义'],['In addition, exercise regularly.']],
      ['in case','短语','以防；万一','高频',['引导目的或条件状语从句'],['区别 in that case'],['Take an umbrella in case it rains.']],
      ['in charge of','短语','负责','高频',['人 be in charge of 事'],['charge 搭配辨析常考'],['She is in charge of the club.']],
      ['make a difference','短语','有影响；起作用','高频',['make a difference to'],['环保/志愿主题常用'],['Small actions make a big difference.']],
      ['make full use of','短语','充分利用','高频',['后接时间/资源/机会'],['同 take advantage of'],['We should make full use of time.']],
      ['on behalf of','短语','代表','中频',['应用文开头常用'],['正式表达'],['On behalf of our class, I welcome you.']],
      ['put forward','短语','提出','中频',['put forward a suggestion/plan'],['更正式'],['A new plan was put forward.']],
      ['refer to','短语','提到；查阅','高频',['refer to a dictionary'],['一词多义常考'],['The word refers to a method.']],
    ]
  },
  {
    id: 'dl-error200',
    name: '高考易错词汇200',
    desc: '常见易混易错词汇精选',
    items: [
      ['affect','v.','影响；感动','易错',['effect 是名词"影响"常混'],['affect/effect 辨析高频'],['Weather affects our mood.']],
      ['principal','n./adj.','校长；主要的','易错',['principle 原则 常拼错'],['principal/principle 辨析'],['The principal is very kind.']],
      ['stationary','adj.','静止的','易错',['stationery 文具 常混'],['stationary/stationery 辨析'],['The car was stationary.']],
      ['desert','n./v.','沙漠；遗弃','易错',['dessert 甜品 常混'],['desert/dessert 辨析'],['The desert is very hot.']],
      ['complement','n./v.','补充；赞美','易错',['compliment 赞美 常混'],['complement/compliment 辨析'],['This wine complements the dish.']],
      ['quite','adv.','相当；十分','易错',['quiet 安静的 常混'],['quite/quiet 辨析'],['She is quite good at math.']],
      ['their','pron.','他们的','易错',['there 那里/they\'re 常混'],['their/there/they\'re 辨析'],['Their house is beautiful.']],
      ['loose','adj.','宽松的','易错',['lose 丢失 常混'],['loose/lose 辨析'],['The rope was loose.']],
      ['adopt','v.','收养；采用','易错',['adapt 适应 常混'],['adopt/adapt 辨析'],['They adopted a child.']],
      ['beside','prep.','在...旁边','易错',['besides 此外 常混'],['beside/besides 辨析'],['She sat beside me.']],
      ['aisle','n.','过道','易错',['isle 岛屿 常混'],['aisle/isle 辨析'],['Walk down the aisle.']],
      ['bare','adj.','赤裸的','易错',['bear 熊/忍受 常混'],['bare/bear 辨析'],['The ground was bare.']],
      ['council','n.','委员会','易错',['counsel 咨询 常混'],['council/counsel 辨析'],['The city council made a decision.']],
      ['dessert','n.','甜点','易错',['desert 沙漠 常混'],['dessert/desert 辨析'],['She ordered dessert.']],
      ['hangar','n.','机库','易错',['hanger 衣架 常混'],['hangar/hanger 辨析'],['The plane was in the hangar.']],
      ['immigrate','v.','移入','易错',['emigrate 移出 常混'],['immigrate/emigrate 辨析'],['He immigrated to the US.']],
      ['personal','adj.','个人的','易错',['personnel 人员 常混'],['personal/personnel 辨析'],['This is my personal opinion.']],
      ['sight','n.','景象；视力','易错',['site 现场/cite 引用 常混'],['sight/site/cite 辨析'],['The sight was amazing.']],
      ['who\'s','abbr.','who is/has','易错',['whose 谁的 常混'],['who\'s/whose 辨析'],['Who\'s coming to dinner?']],
      ['your','pron.','你的','易错',['you\'re you are 常混'],['your/you\'re 辨析'],['What is your name?']],
    ]
  },
  {
    id: 'dl-familiar150',
    name: '高考熟词生义150',
    desc: '常见熟词生义现象精选',
    items: [
      ['accommodate','v.','提供住宿','生义',['常见义：容纳/适应'],['高考常考"提供住宿"义'],['The hotel can accommodate 500 guests.']],
      ['address','v.','处理；解决','生义',['常见义：地址/演讲'],['address a problem 解决问题'],['We must address this issue.']],
      ['appreciate','v.','感激；升值','生义',['常见义：欣赏/感激'],['appreciate in value 升值'],['The house has appreciated.']],
      ['book','v.','预订','生义',['常见义：书/本子'],['book a ticket 预订票'],['I booked a table for two.']],
      ['capitalize','v.','利用','生义',['常见义：大写/资本化'],['capitalize on 利用机会'],['She capitalized on her fame.']],
      ['conduct','n.','行为；举止','生义',['常见义：进行/指挥'],['good conduct 好行为'],['His conduct was excellent.']],
      ['company','n.','陪伴','生义',['常见义：公司'],['keep company 陪伴'],['I enjoy your company.']],
      ['cook','n.','厨师','生义',['常见义：烹饪'],['He is a good cook.'],['The cook prepared a feast.']],
      ['course','n.','课程；一道菜','生义',['常见义：过程/当然'],['of course 当然'],['The main course was delicious.']],
      ['draw','v.','得出；拉','生义',['常见义：画画/拉'],['draw a conclusion 得出结论'],['We can draw a conclusion from this.']],
      ['drive','n.','动力；驱动','生义',['常见义：开车'],['the driving force 驱动力'],['Ambition is his driving force.']],
      ['earn','v.','赢得','生义',['常见义：赚得'],['earn respect 赢得尊重'],['She earned their respect.']],
      ['observe','v.','遵守','生义',['常见义：观察'],['observe the rules 遵守规则'],['We must observe the law.']],
      ['plant','n.','工厂；设备','生义',['常见义：植物'],['a power plant 发电厂'],['The plant was closed.']],
      ['position','v.','定位','生义',['常见义：位置/职位'],['position yourself 定位自己'],['She positioned herself near the door.']],
      ['read','v.','解读；理解','生义',['常见义：阅读'],['read one\'s mind 看出心思'],['I can read your expression.']],
      ['rest','v.','依靠','生义',['常见义：休息'],['rest on 依赖'],['His argument rests on facts.']],
      ['sound','adj.','合理的','生义',['常见义：声音/听起来'],['sound advice 合理的建议'],['That sounds like a good plan.']],
      ['tell','v.','分辨','生义',['常见义：告诉'],['tell the difference 分辨'],['Can you tell them apart?']],
      ['weather','v.','经受住','生义',['常见义：天气'],['weather the storm 渡过难关'],['The company weathered the crisis.']],
    ]
  }
];

/* ============================
   六、进度追踪和设置
   ============================ */

const PROGRESS_KEY = 'gaokao_progress';
const SETTINGS_KEY = 'gaokao_settings';
const STUDYLOG_KEY = 'gaokao_study_log';
const DOWNLOAD_KEY = 'gaokao_downloaded';
const WRONG_KEY = 'gaokao_wrong_words';

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch { return {}; }
}

function saveProgress(progress) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
}

function loadSettings() {
  try {
    return {
      dailyGoal: 50,
      speakRate: 0.78,
      mode: 'en-to-cn',
      detailMode: 'brief',
      shuffleMode: false,
      autoJump: false,
      autoJumpDelay: 1500,
      showAnnouncement: true,
      autoSpeak: false,
      autoMaster: false,
      ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}')
    };
  } catch {
    return { dailyGoal: 50, speakRate: 0.78, mode: 'en-to-cn', detailMode: 'brief', shuffleMode: false, autoJump: false, autoJumpDelay: 1500, showAnnouncement: true, autoSpeak: false, autoMaster: false };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
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

function loadStudyLog() {
  try { return JSON.parse(localStorage.getItem(STUDYLOG_KEY) || '{}'); } catch { return {}; }
}

function saveStudyLog(log) {
  localStorage.setItem(STUDYLOG_KEY, JSON.stringify(log));
}

function loadDownloadedIds() {
  try { return JSON.parse(localStorage.getItem(DOWNLOAD_KEY) || '[]'); } catch { return []; }
}

function saveDownloadedIds(ids) {
  localStorage.setItem(DOWNLOAD_KEY, JSON.stringify(ids));
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

function splitImportRecords(text) {
  const cleaned = cleanOcrText(text);
  const rows = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
  const records = [];
  rows.forEach(line => {
    const safe = stripNumberPrefix(line);
    if (!safe) return;
    if (isEntryStart(safe) || !records.length) records.push(safe);
    else records[records.length - 1] = `${records[records.length - 1]} ${safe}`;
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

/* 从释义中去除词性标记前缀，只保留中文释义部分（用于选项显示） */
function stripPosPrefix(text) {
  if (!text) return '';
  // 去除开头和中间的所有词性标记（如 n. adj. vt. 等）及后续的标点/空格
  // 格式：词性.+中文（包括多词性如 n.塑料；adj.可塑的 → 塑料；可塑的）
  return text
    .replace(/(?:n\.|vt\.|vi\.|v\.|adj\.|adv\.|prep\.|pron\.|conj\.|interj\.|det\.|art\.)[\s.，；;]*/g, '')
    .replace(/^[,，；;\s]+|[,，；;\s]+$/g, '')
    .trim();
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

function parseImportedText(text, defaultType = 'word') {
  return splitImportRecords(text).map((line, i) => parseOneRecord(line, i, defaultType)).filter(item => {
    const t = item.term.trim();
    return /[A-Za-z]/.test(t) && !/^[A-Z]$/i.test(t) && t.length > 1;
  });
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
  if (ext === 'txt') return file.text();
  if (ext === 'pptx') return extractPptxText(file);
  if (ext === 'pdf') return extractPdfText(file);
  if (ext === 'docx') return extractDocxText(file);
  if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return extractImageText(file);
  return file.text();
}

async function extractPptxText(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slides = Object.keys(zip.files).filter(n => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'));
  const chunks = [];
  for (const name of slides) {
    const xml = await zip.files[name].async('text');
    chunks.push([...xml.matchAll(/<a:t>(.*?)<\/a:t>/g)].map(m => m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')).join(' '));
  }
  return cleanOcrText(chunks.join('\n'));
}

async function extractPdfText(file) {
  const doc = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const rows = new Map();
    content.items.forEach(item => { const y = Math.round(item.transform[5] / 4) * 4; const r = rows.get(y) || []; r.push({ x: item.transform[4], text: item.str }); rows.set(y, r); });
    pages.push([...rows.entries()].sort((a, b) => b[0] - a[0]).map(([, r]) => r.sort((a, b) => a.x - b.x).map(p => p.text).join(' ').trim()).filter(Boolean).join('\n'));
  }
  return cleanOcrText(pages.join('\n'));
}

async function extractDocxText(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const xml = await zip.files['word/document.xml']?.async('text');
  if (!xml) return '';
  return cleanOcrText(xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
}

async function extractImageText(file) {
  const worker = await createWorker('eng+chi_sim');
  await worker.setParameters({ tessedit_pageseg_mode: '4', preserve_interword_spaces: '1' });
  const result = await worker.recognize(file);
  await worker.terminate();
  return cleanOcrText(result.data.text);
}

/* ============================
   九、发音功能
   ============================ */

function speak(text, rate) {
  if (!text) return;
  const normalized = String(text).trim();
  const r = rate || 0.78;
  const fallback = () => {
    if (!('speechSynthesis' in window)) { alert('当前设备不支持发音'); return; }
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(normalized);
    u.lang = /^[a-zA-Z\s''-]+$/.test(normalized) ? 'en-US' : 'zh-CN';
    u.rate = r; u.pitch = 1;
    window.speechSynthesis.speak(u);
  };
  if (/^[a-zA-Z\s''-]+$/.test(normalized)) {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?type=2&audio=${encodeURIComponent(normalized)}`);
    audio.preload = 'auto'; audio.play().catch(fallback); return;
  }
  fallback();
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

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
  if (wrongWords.some(w => w.term === item.term)) return '#ef4444';
  if (progress[item.id] === 'mastered') return '#2563eb';
  return null; // 返回 null 表示使用默认颜色
}

/* ============================
   十一、主App组件
   ============================ */

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

const TABS = [
  { id: 'learn', label: '背诵', icon: LearnIcon },
  { id: 'wrong', label: '错词本', icon: WrongIcon },
  { id: 'library', label: '词库', icon: LibraryIcon },
  { id: 'extend', label: '扩展', icon: ExtendIcon },
  { id: 'import', label: '导入', icon: ImportIcon },
  { id: 'me', label: '我的', icon: MeIcon },
];

function App() {
  const [books, setBooks] = useState(loadBooks);
  // 背诵页词库选择（独立）
  const [studyBookIds, setStudyBookIds] = useState(() => {
    try {
      const saved = localStorage.getItem('gaokao_study_books');
      return saved ? saved.split(',') : ['gaokao-core'];
    }
    catch { return ['gaokao-core']; }
  });
  // 词库页词库选择（独立）
  const [libraryBookIds, setLibraryBookIds] = useState(() => {
    try {
      const saved = localStorage.getItem('gaokao_library_books');
      return saved ? saved.split(',') : ['gaokao-core'];
    }
    catch { return ['gaokao-core']; }
  });
  const [section, setSection] = useState('learn');
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [showBookPicker2, setShowBookPicker2] = useState(false);
  // 词性筛选（替代原来的type筛选）
  const [posFilter, setPosFilter] = useState('全部');
  const [typeFilter, setTypeFilter] = useState('全部');
  const [hideMastered, setHideMastered] = useState(() => {
    try { return localStorage.getItem('gaokao_hide_mastered') !== 'false'; }
    catch { return true; }
  });
  const [practiceMode, setPracticeMode] = useState('en-to-cn');
  const [detailMode, setDetailMode] = useState('brief');
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [selected, setSelected] = useState('');
  const [autoJumping, setAutoJumping] = useState(false);
  const [cloudStatus, setCloudStatus] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [showBrowserFallback, setShowBrowserFallback] = useState(false);
  // 静默自动更新相关状态
  const [downloadedApkUrl, setDownloadedApkUrl] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [apkDownloadProgress, setApkDownloadProgress] = useState(0);
  const [updateChangelog, setUpdateChangelog] = useState('');
  const [updateVersion, setUpdateVersion] = useState('');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [announcementData, setAnnouncementData] = useState(null);
  const [dismissedVersion, setDismissedVersion] = useState(() => {
    try { return localStorage.getItem('gaokao_dismissed_version') || ''; }
    catch { return ''; }
  });
  const updateCheckDone = useRef(false);
  const [search, setSearch] = useState('');
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const [aiConfig, setAiConfig] = useState(loadAiConfig);
  const [progress, setProgress] = useState(loadProgress);
  const [settings, setSettings] = useState(loadSettings);
  const [studyLog, setStudyLog] = useState(loadStudyLog);
  const [downloadedIds, setDownloadedIds] = useState(loadDownloadedIds);
  const [wrongWords, setWrongWords] = useState(loadWrongWords);
  // 扩展页面的子tab
  const [extendTab, setExtendTab] = useState('affix');
  const [affixTab, setAffixTab] = useState('prefix');
  const [compareTab, setCompareTab] = useState('synonym');
  const [compareIndex, setCompareIndex] = useState(0);
  const [spellingSearch, setSpellingSearch] = useState('');
  // 词库详情
  const [detailItem, setDetailItem] = useState(null);
  // 正确率统计
  const [sessionCorrect, setSessionCorrect] = useState(0);
  const [sessionTotal, setSessionTotal] = useState(0);
  // AI配置折叠
  const [showAiBox, setShowAiBox] = useState(false);
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

  // 已掌握词库：根据 progress 动态更新，按 term 去重
  useEffect(() => {
    const seen = new Set();
    const masteredItems = [];
    const addIfNew = (item) => {
      if (!seen.has(item.term)) {
        seen.add(item.term);
        masteredItems.push(item);
      }
    };
    builtInBooks.forEach(b => {
      if (b.id === 'mastered-words') return;
      b.items.forEach(item => {
        if (progress[item.id] === 'mastered') addIfNew(item);
      });
    });
    // 同时检查自定义词库中的已掌握单词
    books.forEach(b => {
      if (b.id === 'mastered-words' || builtInBooks.some(bb => bb.id === b.id)) return;
      b.items.forEach(item => {
        if (progress[item.id] === 'mastered') addIfNew(item);
      });
    });
    setBooks(prev => prev.map(b => b.id === 'mastered-words' ? { ...b, items: masteredItems } : b));
  }, [progress]);

  // 当前页面对应的词库选择（背诵页和词库页独立）
  const currentBookIds = section === 'learn' ? studyBookIds : libraryBookIds;
  const activeBook = useMemo(() => {
    const selected = books.filter(b => currentBookIds.includes(b.id));
    if (selected.length === 0) return books[0] || { id: 'empty', name: '空', items: [], editable: false };
    // 多词库合并时按 term 去重，保留第一个出现的
    const seen = new Set();
    const uniqueItems = [];
    selected.forEach(b => {
      b.items.forEach(item => {
        if (!seen.has(item.term)) {
          seen.add(item.term);
          uniqueItems.push(item);
        }
      });
    });
    return {
      id: currentBookIds.join(','),
      name: selected.length === 1 ? selected[0].name : `${selected.length}个词库`,
      items: uniqueItems,
      editable: false
    };
  }, [books, currentBookIds]);

  // 全部词汇合并（词根词缀、对比、易错词基于全量词汇）
  const allWords = useMemo(() => {
    return books.flatMap(b => b.items);
  }, [books]);

  const filteredItems = useMemo(() => {
    let items = activeBook.items.filter(item => {
      const posOk = posFilter === '全部' || getPosCategory(item.pos) === posFilter;
      const typeOk = typeFilter === '全部' || item.type === typeFilter;
      const masteredOk = !hideMastered || progress[item.id] !== 'mastered';
      const searchOk = !search || `${item.term}${item.meaning}${item.pos}`.toLowerCase().includes(search.toLowerCase());
      return posOk && typeOk && masteredOk && searchOk;
    });
    if (settings.shuffleMode) items = shuffle(items);
    return items;
  }, [activeBook, posFilter, typeFilter, hideMastered, search, settings.shuffleMode, progress]);

  const current = filteredItems[index % Math.max(filteredItems.length, 1)];

  // 锁定当前显示的单词，防止 toggleProgress 改变 filteredItems 导致 UI 判断错误
  const lockedCurrent = useRef(null);
  // 显示用的当前单词：答题后使用锁定的单词，防止 toggleProgress 改变 current 导致显示不匹配
  const displayCurrent = (selected && lockedCurrent.current) || current;

  // 问题1：4个选项（1正确+3干扰项）—— 排除易混/同义/反义词干扰
  const options = useMemo(() => {
    if (!current) return [];
    if (practiceMode === 'flashcard') return [];
    // 从普通词库中抽取干扰项，排除易混/同义/反义/褒贬分类词库
    const normalBooks = books.filter(b => 
      !b.id.includes('synonym') && !b.id.includes('antonym') && 
      !b.id.includes('confused') && !b.id.includes('dual-sentiment') &&
      !b.id.includes('positive') && !b.id.includes('negative')
    );
    const normalWords = normalBooks.flatMap(b => b.items);
    const pool = normalWords.filter(item => 
      item.id !== current.id && 
      item.term !== current.term &&
      item.meaning !== current.meaning
    );
    const wrongItems = shuffle(pool).slice(0, 3);
    const values = practiceMode === 'cn-to-en'
      ? [current.term, ...wrongItems.map(i => i.term)]
      : [current.meaning, ...wrongItems.map(i => i.meaning)];
    return shuffle(values);
  }, [books, current, practiceMode]);

  // 进度统计（按当前词库）
  const progressStats = useMemo(() => {
    const bookItems = activeBook.items;
    const total = bookItems.length;
    const mastered = bookItems.filter(i => progress[i.id] === 'mastered').length;
    return { total, mastered, remaining: total - mastered };
  }, [activeBook, progress]);

  // 今日学习统计
  const todayKey = getToday();
  const todayCount = studyLog[todayKey] || 0;
  const streakDays = getStreakDays(studyLog);
  const totalStudyDays = getStudyDays(studyLog);

  function updateBooks(next) { setBooks(next); saveCustomBooks(next); }

  function switchStudyBook(id) {
    if (studyBookIds.includes(id)) {
      const next = studyBookIds.filter(x => x !== id);
      if (next.length === 0) next.push('gaokao-core');
      setStudyBookIds(next);
      try { localStorage.setItem('gaokao_study_books', next.join(',')); } catch {}
    } else {
      const next = [...studyBookIds, id];
      setStudyBookIds(next);
      try { localStorage.setItem('gaokao_study_books', next.join(',')); } catch {}
    }
    setTypeFilter('全部');
    setIndex(0);
    setSessionCorrect(0);
    setSessionTotal(0);
  }
  function selectAllStudyBooks() {
    const allIds = books.map(b => b.id);
    setStudyBookIds(allIds);
    try { localStorage.setItem('gaokao_study_books', allIds.join(',')); } catch {}
    setTypeFilter('全部'); setIndex(0); setSessionCorrect(0); setSessionTotal(0);
  }
  function switchLibraryBook(id) {
    if (libraryBookIds.includes(id)) {
      const next = libraryBookIds.filter(x => x !== id);
      if (next.length === 0) next.push('gaokao-core');
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
    const allIds = books.map(b => b.id);
    setLibraryBookIds(allIds);
    try { localStorage.setItem('gaokao_library_books', allIds.join(',')); } catch {}
    setTypeFilter('全部'); setIndex(0);
  }

  function toggleProgress(itemId) {
    setProgress(prev => {
      const next = { ...prev };
      if (next[itemId] === 'mastered') next[itemId] = 'unmastered';
      else next[itemId] = 'mastered';
      saveProgress(next);
      return next;
    });
  }

  // 问题5：重置某词库进度
  function resetBookProgress(bookId) {
    const book = books.find(b => b.id === bookId);
    if (!book) return;
    if (!confirm(`确定重置「${book.name}」的背诵进度吗？`)) return;
    setProgress(prev => {
      const next = { ...prev };
      book.items.forEach(item => { delete next[item.id]; });
      saveProgress(next);
      return next;
    });
  }

  // 记录今日学习
  function recordStudy() {
    const today = getToday();
    setStudyLog(prev => {
      const next = { ...prev, [today]: (prev[today] || 0) + 1 };
      saveStudyLog(next);
      return next;
    });
  }

  // 使用 ref 确保异步回调中总是调用最新的 nextCard/prevCard
  const nextCardRef = useRef(() => {});
  const prevCardRef = useRef(() => {});
  // 记录最近一次回答的单词，用于"上一个"按钮优先回退
  const lastAnsweredRef = useRef(null);

  function nextCard() {
    const nextIdx = (index + 1) % Math.max(filteredItems.length, 1);
    setIndex(nextIdx);
    setShowBack(false); setSelected('');
    lockedCurrent.current = null;
    // 自动朗读新单词
    if (settings.autoSpeak && filteredItems.length > 0) {
      const nextWord = filteredItems[nextIdx];
      if (nextWord && nextWord.term) {
        setTimeout(() => speak(nextWord.term, settings.speakRate), 100);
      }
    }
  }

  function prevCard() {
    // 如果存在最近一次回答的单词，优先跳转回该单词（只生效一次）
    if (lastAnsweredRef.current) {
      const { item } = lastAnsweredRef.current;
      // 在当前的 filteredItems 中查找该单词的新索引（列表可能已变化）
      const targetIdx = filteredItems.findIndex(it => it.term === item.term);
      if (targetIdx !== -1 && targetIdx !== index) {
        setIndex(targetIdx);
        setShowBack(false); setSelected('');
        lockedCurrent.current = null;
        lastAnsweredRef.current = null; // 用完清空，防止连续回退到更前面的
        return;
      }
      lastAnsweredRef.current = null;
    }
    setIndex(i => (i - 1 + filteredItems.length) % Math.max(filteredItems.length, 1));
    setShowBack(false); setSelected('');
    lockedCurrent.current = null;
  }

  nextCardRef.current = nextCard;
  prevCardRef.current = prevCard;

  // 错词本操作
  function addWrongWord(item) {
    setWrongWords(prev => {
      // 按 term 去重，避免同一单词在不同词库中的不同 id 重复添加
      if (prev.some(w => w.term === item.term)) return prev;
      const next = [...prev, { ...item, wrongAt: Date.now() }];
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

  function handleSelect(option) {
    if (!lockedCurrent.current) lockedCurrent.current = current;
    const c = lockedCurrent.current;
    setSelected(option);
    setSessionTotal(t => t + 1);
    // 记录最近一次回答的单词（用于"上一个"回退）
    lastAnsweredRef.current = { item: c, index };
    const right = practiceMode === 'cn-to-en' ? c.term : c.meaning;
    if (option === right) {
      setSessionCorrect(co => co + 1);
      recordStudy();
      // 自动标记已掌握（如果开关开启且当前未标记）
      if (settings.autoMaster && progress[c.id] !== 'mastered') {
        toggleProgress(c.id);
      }
      if (settings.autoJump) {
        setAutoJumping(true);
        setTimeout(() => {
          nextCardRef.current();  // 使用 ref 确保调用最新版本
          setAutoJumping(false);
        }, settings.autoJumpDelay || 1500);
      }
    } else {
      // 答错：加入错词本
      addWrongWord(c);
    }
  }

  function createBook() {
    const name = prompt('请输入词库名称', '我的高考词库');
    if (!name) return;
    const nb = { id: `book-${Date.now()}`, name, editable: true, items: [] };
    updateBooks([...books, nb]); switchLibraryBook(nb.id); setSection('library');
  }

  function renameBook() {
    if (!activeBook.editable) return alert('内置词库不可改名');
    const name = prompt('请输入新名称', activeBook.name);
    if (!name) return;
    updateBooks(books.map(b => b.id === activeBook.id ? { ...b, name } : b));
  }

  function deleteBook() {
    if (!activeBook.editable) return alert('内置词库不能删除');
    if (!confirm(`确定删除词库「${activeBook.name}」？`)) return;
    const next = books.filter(b => b.id !== activeBook.id);
    updateBooks(next);
    setStudyBookIds(['gaokao-core']); try { localStorage.setItem('gaokao_study_books', 'gaokao-core'); } catch {}
    setLibraryBookIds(['gaokao-core']); try { localStorage.setItem('gaokao_library_books', 'gaokao-core'); } catch {}
  }

  function deleteItem(itemId) {
    if (!activeBook.editable) return;
    if (!confirm('确定删除？')) return;
    updateBooks(books.map(b => b.id === activeBook.id ? { ...b, items: b.items.filter(i => i.id !== itemId) } : b));
    setIndex(0);
  }

  function addImportedItems(items) {
    if (!activeBook.editable) { alert('请先新建自定义词库'); return; }
    if (!items.length) { setImportStatus('没有识别到有效词条'); return; }
    updateBooks(books.map(b => b.id === activeBook.id ? { ...b, items: [...b.items, ...items] } : b));
    setImportStatus(`导入成功：${items.length} 条`);
  }

  // 智能分类导入
  function smartImport() {
    if (!importText.trim()) { setImportStatus('请先输入文本内容'); return; }
    const text = importText.toLowerCase();
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);

    // 拼写纠错识别：检测每行是否为 "correct / wrong : tip" 格式
    const spellingRegex = /(\w+)\s*[\/\-\|,]\s*(\w+)\s*[:：]\s*(.+)/;
    const spellingLines = lines.filter(l => spellingRegex.test(l));
    const hasSpellingKeywords = /tip|记忆技巧|拼写|correct|wrong|易错|混淆/.test(text);
    const hasContrastKeywords = /对比|同义词|反义词|辨析|区别/.test(text);
    const hasRootKeywords = /词根|词缀|前缀|后缀|root|affix/.test(text);
    const hasContextKeywords = /情景|语境|短文|阅读|文章/.test(text);
    const hasPhraseKeywords = /短语|词组|固定搭配|phrasal/.test(text);

    // 优先根据格式判断拼写
    if (spellingLines.length >= Math.max(1, lines.length * 0.5)) {
      const newSpellingItems = [];
      for (const line of lines) {
        const m = line.match(spellingRegex);
        if (m) {
          newSpellingItems.push({ correct: m[1], wrong: m[2], tip: m[3].trim() });
        }
      }
      if (newSpellingItems.length > 0) {
        const existing = loadCustomSpelling();
        saveCustomSpelling([...existing, ...newSpellingItems]);
        setImportStatus(`智能分类：识别为拼写纠错扩展，已导入 ${newSpellingItems.length} 条到拼写纠错`);
        return;
      }
    }

    // 判断导入类型
    let importType = 'word';
    let statusMsg = '';

    if (hasSpellingKeywords && !hasContrastKeywords && !hasRootKeywords && !hasContextKeywords) {
      const newSpellingItems = [];
      for (const line of lines) {
        const m = line.match(spellingRegex);
        if (m) {
          newSpellingItems.push({ correct: m[1], wrong: m[2], tip: m[3].trim() });
        }
      }
      if (newSpellingItems.length > 0) {
        const existing = loadCustomSpelling();
        saveCustomSpelling([...existing, ...newSpellingItems]);
        setImportStatus(`智能分类：识别为拼写纠错扩展，已导入 ${newSpellingItems.length} 条到拼写纠错`);
        return;
      }
    }

    if (hasPhraseKeywords && !hasRootKeywords) {
      importType = 'phrase';
      statusMsg = '识别为短语内容，';
    } else if (hasRootKeywords && !hasSpellingKeywords && !hasContrastKeywords) {
      statusMsg = '识别为词根词缀内容，';
    } else if (hasContextKeywords && !hasSpellingKeywords && !hasContrastKeywords) {
      statusMsg = '识别为情景记忆内容，';
    } else if (hasContrastKeywords && !hasSpellingKeywords) {
      statusMsg = '识别为对比记忆内容，';
    }

    // 按词库导入
    const items = parseImportedText(importText, importType);
    if (items.length > 0) {
      addImportedItems(items);
      setImportStatus(`${statusMsg}已导入 ${items.length} 条到词库`);
    } else {
      setImportStatus(`${statusMsg}未能识别到有效词条，请检查格式`);
    }
  }

  async function handleFile(file) {
    try {
      setLastFile(file || null); setImportStatus('正在识别...');
      const text = await readFileText(file); setImportText(text);
      const items = parseImportedText(text, 'word');
      setImportStatus(`识别完成：${items.length} 条。请确认后导入。`);
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

      // 方式1: 尝试 Gitee raw URL
      try {
        const rawResp = await fetch(UPDATE_SERVER_RAW + '?_t=' + Date.now());
        if (rawResp.ok) serverData = await rawResp.json();
      } catch (e) { /* raw 失败 */ }

      // 方式2: 尝试 Gitee API（base64 解码）
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
    try { setImportStatus('AI整理中...'); const items = await callAiModel({ text: importText }); setImportStatus(`AI完成：${items.length} 条`); }
    catch (e) { setImportStatus(`AI失败：${e.message}`); }
  }

  async function runAiOnFile() {
    try { if (!lastFile) { setImportStatus('请先选择文件'); return; } setImportStatus('AI识别中...'); const isImage = /\.(png|jpg|jpeg|webp)$/i.test(lastFile.name); const text = isImage ? importText : await readFileText(lastFile); const items = await callAiModel({ text, file: isImage ? lastFile : null }); setImportStatus(`AI完成：${items.length} 条`); }
    catch (e) { setImportStatus(`AI失败：${e.message}`); }
  }

  // 问题4：内置词库下载
  function handleDownload(dl) {
    if (downloadedIds.includes(dl.id)) return;
    const items = dl.items.map((row, i) => makeItem(row, row[0].includes(' ') ? 'phrase' : 'word', i));
    const nb = { id: `dl-${Date.now()}`, name: dl.name, editable: true, items };
    updateBooks([...books, nb]);
    const next = [...downloadedIds, dl.id];
    setDownloadedIds(next);
    saveDownloadedIds(next);
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
      try {
        data = await fetchFromRaw();
        console.log('[Update] Raw success:', data);
      } catch (rawErr) {
        console.warn('[Update] Raw failed:', rawErr.message);
        try {
          data = await fetchFromApi();
          console.log('[Update] API fallback success:', data);
        } catch (apiErr) {
          console.warn('[Update] API failed:', apiErr.message);
          // 第三回退：GitHub Pages（国内可能需要代理）
          try {
            const ghUrl = `https://xdbzys.github.io/gaokao-vocab/app-update.json?_t=${Date.now()}`;
            console.log('[Update] Trying GitHub Pages:', ghUrl);
            const ghResp = await fetch(ghUrl, { cache: 'no-store' });
            if (ghResp.ok) { data = await ghResp.json(); console.log('[Update] GitHub Pages success:', data); }
            else throw new Error('GitHub Pages HTTP ' + ghResp.status);
          } catch (ghErr) {
            console.warn('[Update] GitHub Pages failed:', ghErr.message);
            // 第四回退：jsdelivr CDN（国内最快）
            try {
              const cdnUrl = `https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/app-update.json?_t=${Date.now()}`;
              console.log('[Update] Trying jsdelivr CDN:', cdnUrl);
              const cdnResp = await fetch(cdnUrl, { cache: 'no-store' });
              if (cdnResp.ok) { data = await cdnResp.json(); console.log('[Update] jsdelivr CDN success:', data); }
              else throw new Error('jsdelivr HTTP ' + cdnResp.status);
            } catch (cdnErr) {
              console.warn('[Update] All fallbacks failed');
              throw new Error('检查更新失败，请检查网络连接后重试');
            }
          }
        }
      }

      if (typeof data.versionCode !== 'number') {
        throw new Error(`versionCode 无效: ${data.versionCode}`);
      }

      console.log('[Update] Local versionCode:', APP_VERSION_CODE, 'Remote:', data.versionCode);
      let hasUpdate = data.versionCode > APP_VERSION_CODE;
      const changelog = data.changelog || data.updateLog || '';
      let version = data.version || data.versionCode;
      const finalChangelog = hasUpdate ? (data.changelog || data.updateLog || changelog) : changelog;
      const finalVersion = hasUpdate ? (data.version || data.versionCode) : version;

      const apkUrl = data.apkUrl || data.appUrl || '';

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
          booksData: data.books || null,
          updating: false,
        });
        if (!silent) setCloudStatus(hasUpdate ? `发现新版本 v${version}` : '已是最新版本');
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
          try {
            console.log('[Update] 网页版静默更新:', data.webHtmlUrl);
            const resp = await fetch(data.webHtmlUrl);
            if (resp.ok) {
              const newHtml = await resp.text();
              // 验证新HTML包含有效内容
              if (newHtml && newHtml.includes('<!doctype') || newHtml.includes('<html')) {
                console.log('[Update] 网页版更新成功，替换页面内容');
                document.open();
                document.write(newHtml);
                document.close();
                return;
              }
            }
            console.warn('[Update] 网页版更新下载失败');
          } catch (webErr) {
            console.warn('[Update] 网页版更新失败:', webErr);
          }
        }

        const apkUrl = data.apkUrl || data.appUrl;
        setUpdateVersion(version);
        setUpdateChangelog(changelog);
        setApkDownloadProgress(1); // 开始下载

        try {
          console.log('[Update] 开始静默下载APK:', apkUrl);
          const resp = await fetch(apkUrl);
          if (!resp.ok) throw new Error(`下载失败 HTTP ${resp.status}`);

          const contentLength = resp.headers.get('content-length');
          const total = contentLength ? parseInt(contentLength, 10) : 0;
          let received = 0;

          const reader = resp.body.getReader();
          const chunks = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
            if (total > 0) {
              const pct = Math.round(received / total * 100);
              setApkDownloadProgress(pct);
            } else {
              // 无content-length时显示已下载大小
              setApkDownloadProgress(-received);
            }
          }

          const blob = new Blob(chunks, { type: 'application/vnd.android.package-archive' });
          const blobUrl = URL.createObjectURL(blob);
          setDownloadedApkUrl(blobUrl);
          setApkDownloadProgress(100);
          console.log('[Update] APK下载完成，大小:', (blob.size / 1024 / 1024).toFixed(1), 'MB');

          // 下载完成后弹出安装提示
          setShowInstallPrompt(true);
        } catch (dlErr) {
          console.error('[Update] APK下载失败:', dlErr);
          setApkDownloadProgress(0);
          // 下载失败时退回到手动更新方式
          if (!silent) setCloudStatus(`自动下载失败：${dlErr.message}`);
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

  // 执行APP更新：下载APK并安装
  async function applyUpdate() {
    if (!updateInfo || !updateInfo.hasUpdate) return;
    setUpdateInfo(prev => ({ ...prev, updating: true }));
    setCloudStatus('正在打开下载...');

    try {
      const apkUrl = updateInfo.apkUrl || updateInfo.appUrl;
      if (!apkUrl) throw new Error('未找到下载地址');

      // 直接用系统浏览器下载 APK，最可靠的方案
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        await Capacitor.Plugins.Browser.open({ url: apkUrl });
      } else {
        window.open(apkUrl, '_blank');
      }
      setCloudStatus('已打开下载页面，下载完成后请安装');
      setUpdateInfo(prev => ({ ...prev, updating: false }));
    } catch (e) {
      setCloudStatus(`更新失败：${e.message}`);
      setUpdateInfo(prev => ({ ...prev, updating: false }));
    }
  }

  // 对比记忆模块（问题3：基于全量词汇）
  const compareBook = compareTab === 'synonym' ? books.find(b => b.id === 'gaokao-synonym') :
                     compareTab === 'antonym' ? books.find(b => b.id === 'gaokao-antonym') :
                     books.find(b => b.id === 'gaokao-confused') || books[0];
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
          {/* 专属标识（仅网页版） */}
          {!isNativeApp && (
            <div style={{ textAlign: 'center', padding: '8px 0 4px', }}>
              <span style={{ color: '#2563eb', fontWeight: 800, fontSize: 20, letterSpacing: 2, textShadow: '0 1px 4px rgba(37,99,235,0.25)' }}>✦ 李群雁专属 ✦</span>
            </div>
          )}
          {/* 顶部栏 */}
          <div className="learnTop">
            <div className="multiBookSelect" style={{ position: 'relative', flex: 1 }}>
              <button className="multiBookBtn" onClick={() => setShowBookPicker(!showBookPicker)}>
                {activeBook.name} ▼
              </button>
              {showBookPicker && (
                <div className="bookPickerDropdown">
                  <div className="bookPickerActions">
                    <button onClick={selectAllStudyBooks}>全选</button>
                    <button onClick={() => { setStudyBookIds(['gaokao-core']); try { localStorage.setItem('gaokao_study_books', 'gaokao-core'); } catch {} }}>重置</button>
                  </div>
                  {books.filter(b => !b.id.includes('synonym') && !b.id.includes('antonym') && !b.id.includes('confused') && !b.id.includes('dual-sentiment')).map(b => (
                    <label key={b.id} className="bookPickerItem">
                      <input type="checkbox" checked={studyBookIds.includes(b.id)} onChange={() => switchStudyBook(b.id)} />
                      <span>{b.name}</span>
                      <span className="bookCount">({b.items.length})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <span className="progressTag">{index + 1}/{filteredItems.length}</span>
            <button className="iconBtn" onClick={() => { setSettings(s => ({ ...s, shuffleMode: !s.shuffleMode })); saveSettings({ ...settings, shuffleMode: !settings.shuffleMode }); }}>
              {settings.shuffleMode ? '乱序' : '顺序'}
            </button>
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
                {progress[displayCurrent.id] === 'mastered' && <span className="masteredTag">已掌握</span>}
              </div>

              <div className="questionArea">
                <h2 style={{ color: wordStatusColor(displayCurrent, progress, wrongWords) || undefined }}>{practiceMode === 'cn-to-en' ? displayCurrent.meaning : practiceMode === 'flashcard' ? displayCurrent.term : displayCurrent.term}</h2>
                {displayCurrent.pos && <p className="posText" style={{ color: posColor(displayCurrent.pos), fontWeight: 600, fontSize: '1.1em', margin: '4px 0' }}>{displayCurrent.pos}</p>}
                {practiceMode !== 'cn-to-en' && displayCurrent.phonetic && <p className="phoneticText">{displayCurrent.phonetic}</p>}
                <button className="sound" onClick={() => speak(displayCurrent.term, settings.speakRate)}>🔊 发音</button>
              </div>

              {/* 问题1：4选项答题 - 未回答时显示选项，回答后隐藏 */}
              {practiceMode !== 'flashcard' && !selected && (
                <div className="options">
                  {options.map(option => {
                    const right = practiceMode === 'cn-to-en' ? current.term : current.meaning;
                    // en-to-cn 模式下选项只显示中文释义，不显示词性标记
                    const displayOption = practiceMode === 'en-to-cn' ? stripPosPrefix(option) : option;
                    return <button key={option} onClick={() => handleSelect(option)}>{displayOption}</button>;
                  })}
                </div>
              )}

              {/* 闪卡模式 */}
              {practiceMode === 'flashcard' && !showBack && (
                <button className="primary" onClick={() => { setShowBack(true); recordStudy(); }}>显示释义</button>
              )}

              {/* 答题后选项消失，解释内容顶替选项位置 */}
              {(showBack || selected) && (
                <div className="answerBox">
                  {selected && (
                    <p style={{ fontWeight: 600, marginBottom: 8, color: (practiceMode === 'cn-to-en' ? displayCurrent.term : displayCurrent.meaning) === selected ? '#16a34a' : '#dc2626' }}>
                      {selected === (practiceMode === 'cn-to-en' ? displayCurrent.term : displayCurrent.meaning) ? '✅ 回答正确' : `❌ 回答错误（你选了：${selected}）`}
                    </p>
                  )}
                  <h3>{displayCurrent.term} &middot; {stripPosPrefix(displayCurrent.meaning)}</h3>
                  <p className="muted">{displayCurrent.pos} &middot; {displayCurrent.source}</p>
                  <div className="points">
                    {(detailMode === 'brief' ? displayCurrent.corePoints.slice(0, 2) : displayCurrent.allPoints).map(p => <p key={p}>• {p}</p>)}
                  </div>
                  {detailMode === 'full' && displayCurrent.examples.length > 0 && (
                    <div className="examples">{displayCurrent.examples.map(e => <p key={e}>{e}</p>)}</div>
                  )}
                  <div className="answerActions">
                    <button className="masterBtn" onClick={() => toggleProgress(displayCurrent.id)}>
                      {progress[displayCurrent.id] === 'mastered' ? '取消掌握' : '标记掌握'}
                    </button>
                  </div>
                </div>
              )}

              {/* 底部导航按钮 */}
              <div className="navButtons">
                <button className="navBtn" onClick={prevCard}>◀ 上一个</button>
                <button className={`navBtn ${autoJumping ? 'autoJumpBtn' : ''}`} onClick={nextCard}>{autoJumping ? '即将自动跳转...' : '下一个 ▶'}</button>
                <button className="navBtn skipBtn" onClick={nextCard}>跳过</button>
              </div>
            </div>
          ) : (
            <div className="empty">当前筛选下没有内容，请切换词库或分类。</div>
          )}
        </section>
      )}

      {/* ====== 错词本页 ====== */}
      {section === 'wrong' && (
        <section className="panel">
          <div className="libraryHeader">
            <h2 className="sectionTitle">❌ 错词本</h2>
            {wrongWords.length > 0 && <button className="smallBtn dangerGhost" onClick={clearWrongWords}>清空</button>}
          </div>
          <p className="muted">答错的单词会自动加入这里，方便集中复习。掌握后可移除。</p>
          {wrongWords.length === 0 ? (
            <div className="empty" style={{ marginTop: 16 }}>还没有错词，继续加油！</div>
          ) : (
            <div className="list">
              {wrongWords.map(item => (
                <article key={item.id} className="listItem" onClick={() => setDetailItem(item)}>
                  <div className="listItemMain">
                    <div className="listItemTitle">
                      <h3 style={{ color: '#ef4444' }}>{item.term}</h3>
                      {item.phonetic && <span className="phoneticSmall">{item.phonetic}</span>}
                      {item.pos && <span className="posTag" style={{ color: posColor(item.pos), background: posColor(item.pos) + '18' }}>{item.pos}</span>}
                    </div>
                    <p>{item.meaning}</p>
                    <small>来源：{item.source || '未知'} · {new Date(item.wrongAt).toLocaleDateString()}</small>
                  </div>
                  <div className="listActions" onClick={e => e.stopPropagation()}>
                    <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}>🔊</button>
                    <button className="smallBtn masterBtn" onClick={() => { toggleProgress(item.id); removeWrongWord(item.id); }}>已掌握</button>
                    <button className="smallBtn dangerGhost" onClick={() => removeWrongWord(item.id)}>移除</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ====== 词库页 ====== */}
      {section === 'library' && (
        <section className="panel">
          <div className="libraryHeader">
            <div className="multiBookSelect" style={{ position: 'relative', flex: 1 }}>
              <button className="multiBookBtn" onClick={() => setShowBookPicker2(!showBookPicker2)}>
                {activeBook.name} ▼
              </button>
              {showBookPicker2 && (
                <div className="bookPickerDropdown">
                  <div className="bookPickerActions">
                    <button onClick={selectAllLibraryBooks}>全选</button>
                    <button onClick={() => { setLibraryBookIds(['gaokao-core']); try { localStorage.setItem('gaokao_library_books', 'gaokao-core'); } catch {} }}>重置</button>
                  </div>
                  {books.map(b => (
                    <label key={b.id} className="bookPickerItem">
                      <input type="checkbox" checked={libraryBookIds.includes(b.id)} onChange={() => switchLibraryBook(b.id)} />
                      <span>{b.name}</span>
                      <span className="bookCount">({b.items.length})</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button onClick={createBook}>+ 新建</button>
          </div>
          <input className="searchInput" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索英文、中文、词性..." />
          {/* 词性分类标签（横向滚动） */}
          <div className="posFilterRow">
            {posFilterList.map(f => (
              <button key={f.id} className={`posFilterBtn ${posFilter === f.id ? 'active' : ''}`} onClick={() => { setPosFilter(f.id); setIndex(0); }}>{f.label}</button>
            ))}
          </div>
          {/* 词条列表 */}
          <div className="list">
            {filteredItems.map(item => (
              <article key={item.id} className="listItem" onClick={() => setDetailItem(item)}>
                <div className="listItemMain">
                  <div className="listItemTitle">
                    <h3 style={{ color: wordStatusColor(item, progress, wrongWords) || freqColor(item.frequency) }}>{item.term}</h3>
                    {item.phonetic && <span className="phoneticSmall">{item.phonetic}</span>}
                    {item.pos && <span className="posTag" style={{ color: posColor(item.pos), background: posColor(item.pos) + '18' }}>{item.pos}</span>}
                    <span className="freqTag" style={{ color: freqColor(item.frequency), borderColor: freqColor(item.frequency) }}>{item.frequency}</span>
                  </div>
                  <p>{item.meaning}</p>
                </div>
                <div className="listActions" onClick={e => e.stopPropagation()}>
                  <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}>🔊</button>
                  <button className={`smallBtn ${progress[item.id] === 'mastered' ? 'masterBtn' : ''}`} onClick={() => toggleProgress(item.id)}>
                    {progress[item.id] === 'mastered' ? '已掌握' : '未掌握'}
                  </button>
                  {activeBook.editable && <button className="smallBtn dangerGhost" onClick={() => deleteItem(item.id)}>删</button>}
                </div>
              </article>
            ))}
          </div>
          {/* 词条详情弹窗 */}
          {detailItem && (
            <div className="modal" onClick={() => setDetailItem(null)}>
              <div className="modalContent" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2>{detailItem.term}</h2>
                  {detailItem.phonetic && <p className="phoneticText">{detailItem.phonetic}</p>}
                  <button className="closeBtn" onClick={() => setDetailItem(null)}>✕</button>
                </div>
                <p className="muted">{detailItem.pos} &middot; <span style={{ color: freqColor(detailItem.frequency) }}>{detailItem.frequency}</span></p>
                <h3>{detailItem.meaning}</h3>
                <div className="points">
                  {detailItem.allPoints.map(p => <p key={p}>• {p}</p>)}
                </div>
                {detailItem.examples.length > 0 && (
                  <div className="examples">{detailItem.examples.map(e => <p key={e}>{e}</p>)}</div>
                )}
                <div className="modalActions">
                  <button onClick={() => speak(detailItem.term, settings.speakRate)}>🔊 发音</button>
                  <button className="masterBtn" onClick={() => { toggleProgress(detailItem.id); setDetailItem({...detailItem}); }}>
                    {progress[detailItem.id] === 'mastered' ? '取消掌握' : '标记掌握'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
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
                {(affixTab === 'prefix' ? affixData.prefixes : affixTab === 'suffix' ? affixData.suffixes : affixData.roots).map(([name, meaning, examples], i) => (
                  <div key={i} className="affixCard">
                    <div className="affixName" style={{ color: affixTab === 'root' ? '#7c3aed' : '#2563eb' }}>{name}</div>
                    <div className="affixMeaning">{meaning}</div>
                    {/* 问题3：从allWords中查找相关单词 */}
                    <div className="affixExamples">
                      {(affixMatchWords[name] || []).map(w => (
                        <span key={w.id} className="affixExample" onClick={() => speak(w.term, settings.speakRate)}>{w.term}</span>
                      ))}
                    </div>
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
                <button className={compareTab === 'confused' ? 'active' : ''} onClick={() => { setCompareTab('confused'); setCompareIndex(0); }}>易混词</button>
              </div>
              {compareCurrent && (
                <div className="card">
                  <div className="cardMeta">
                    <span>{compareIndex + 1}/{compareItems.length}</span>
                  </div>
                  <h2 className="compareTitle">{compareCurrent.term}</h2>
                  <p className="compareMeaning">{compareCurrent.meaning}</p>
                  <div className="points">
                    {compareCurrent.allPoints.map(p => <p key={p}>• {p}</p>)}
                  </div>
                  <div className="compareNav">
                    <button className="primary" onClick={() => setCompareIndex(i => (i - 1 + compareItems.length) % compareItems.length)}>◀ 上一个</button>
                    <button className="primary" onClick={() => setCompareIndex(i => (i + 1) % compareItems.length)}>下一个 ▶</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 易错词 */}
          {extendTab === 'errors' && (
            <div className="errorBookList">
              {['gaokao-familiar-new', 'gaokao-dual-sentiment'].map(bookId => {
                const b = books.find(bk => bk.id === bookId);
                if (!b) return null;
                return (
                  <div key={bookId} className="errorSection">
                    <h3 className="errorSectionTitle">{b.name}</h3>
                    <div className="list">
                      {b.items.slice(0, 30).map(item => (
                        <article key={item.id} className="listItem">
                          <div>
                            <h3 style={{ color: freqColor(item.frequency) }}>{item.term}</h3>
                            <p>{item.meaning}</p>
                          </div>
                          <div className="listActions">
                            <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}>🔊</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* 情景记忆 */}
          {extendTab === 'scene' && (
            <div style={{ marginTop: 16 }}>
              <p className="muted">通过句子和短文，在真实语境中记忆高考主题词。点击单词可听发音。</p>
              {sceneData.map((scene, i) => (
                <div key={i} className="sceneCard">
                  <h3>{scene.title}</h3>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                    {scene.words.map((w, j) => (
                      <span key={j} className="sceneWord" onClick={() => speak(w, settings.speakRate)}>{w}</span>
                    ))}
                  </div>
                  <div className="sceneText">{scene.text}</div>
                  <div className="sceneTextCn">{scene.textCn}</div>
                </div>
              ))}
            </div>
          )}

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
                .map((item, i) => (
                  <div key={i} className="spellingCard">
                    <div className="spellingRow">
                      <span className="spellingCorrect">{item.correct}</span>
                      <span style={{ color: 'var(--text-tertiary)' }}>/</span>
                      <span className="spellingWrong">{item.wrong}</span>
                    </div>
                    <div className="spellingTip">{item.tip}</div>
                  </div>
                ))}
            </div>
          )}
        </section>
      )}

      {/* ====== 导入页 ====== */}
      {section === 'import' && (
        <section className="panel">
          <div className="importBox">
            <h2>导入词库</h2>
            <p className="muted">支持 TXT、复制粘贴、图片、PDF、PPTX、DOCX。配置AI后可使用大模型智能识别。</p>

            {/* 上方4个按钮 */}
            <div className="importBtnRow">
              <button className="fileButton" onClick={() => document.getElementById('paste-btn')?.click()}>
                📋 粘贴
                <textarea id="paste-btn" style={{position:'absolute',opacity:0,width:0,height:0}} autoFocus onChange={e => setImportText(e.target.value)} />
              </button>
              <label className="fileButton">
                📄 TXT
                <input type="file" accept=".txt" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
              </label>
              <label className="fileButton">
                📱 PDF/DOCX
                <input type="file" accept=".pdf,.docx,.pptx" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
              </label>
              <label className="fileButton">
                🖼 图片
                <input type="file" accept=".png,.jpg,.jpeg,.webp" style={{display:'none'}} onChange={e => handleFile(e.target.files[0])} />
              </label>
            </div>

            {/* AI配置区（折叠式） */}
            <button className="aiToggle" onClick={() => setShowAiBox(!showAiBox)}>
              {showAiBox ? '▼' : '▶'} AI大模型识别（可选）
            </button>
            {showAiBox && (
              <div className="aiBox">
                <label style={{marginBottom:4,display:'block',fontSize:13,color:'var(--text-secondary)'}}>选择AI服务商
                  <select value={aiConfig.provider || 'siliconflow'} onChange={e => {
                    const pid = e.target.value;
                    const p = AI_PROVIDERS.find(x => x.id === pid);
                    if (p) {
                      if (pid === 'custom') {
                        updateAiConfig({ provider: pid, endpoint: '', model: '' });
                      } else {
                        updateAiConfig({ provider: pid, endpoint: p.endpoint, model: p.model });
                      }
                    }
                  }}>
                    {AI_PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
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
              <button className="primary" onClick={() => addImportedItems(parseImportedText(importText, 'word'))}>导入到词库</button>
              <button onClick={smartImport}>智能分类导入</button>
            </div>
            <p className="status">{importStatus || '请先选择或新建自定义词库再导入'}</p>
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
              {!isNativeApp && avatarUrl ? <img src={avatarUrl} alt="头像" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover' }} /> : '🎓'}
            </div>
            <div className="meInfo">
              <h2>高考词汇学习</h2>
              <div className="meStats">
                <span>累计学习 {totalStudyDays} 天</span>
                <span className="streakBadge">🔥 连续 {streakDays} 天</span>
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
                    <div key={key} className={`calDay ${studied ? 'calStudied' : ''} ${isToday ? 'calToday' : ''}`}>
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

          {/* 设置区域 */}
          <div className="settingsGroup">
            <h3>设置</h3>
            <label>每日目标
              <input type="number" value={settings.dailyGoal} min={1} max={500}
                onChange={e => { const v = Number(e.target.value) || 50; setSettings(s => ({ ...s, dailyGoal: v })); saveSettings({ ...settings, dailyGoal: v }); }} />
            </label>
            <label>默认背诵模式
              <select value={settings.mode} onChange={e => { setSettings(s => ({ ...s, mode: e.target.value })); saveSettings({ ...settings, mode: e.target.value }); }}>
                {choiceModes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </label>
            <label>发音语速
              <select value={settings.speakRate} onChange={e => { const v = Number(e.target.value); setSettings(s => ({ ...s, speakRate: v })); saveSettings({ ...settings, speakRate: v }); }}>
                {[0.5, 0.6, 0.78, 0.9, 1.0, 1.2, 1.5].map(r => <option key={r} value={r}>{r}x</option>)}
              </select>
            </label>
            <label>答对后自动标记已掌握
              <select value={settings.autoMaster ? 'on' : 'off'} onChange={e => { const v = e.target.value === 'on'; setSettings(s => ({ ...s, autoMaster: v })); saveSettings({ ...settings, autoMaster: v }); }}>
                <option value="off">关闭（手动标记）</option>
                <option value="on">开启（答对自动标记，不再出现在背诵页）</option>
              </select>
            </label>
            <label>答对后自动跳转下一题
              <select value={settings.autoJump ? 'on' : 'off'} onChange={e => { const v = e.target.value === 'on'; setSettings(s => ({ ...s, autoJump: v })); saveSettings({ ...settings, autoJump: v }); }}>
                <option value="off">关闭（手动点下一个）</option>
                <option value="on">开启</option>
              </select>
            </label>
            {settings.autoJump && <label>自动跳转延迟
              <select value={settings.autoJumpDelay || 1500} onChange={e => { const v = parseInt(e.target.value); setSettings(s => ({ ...s, autoJumpDelay: v })); saveSettings({ ...settings, autoJumpDelay: v }); }}>
                <option value="500">0.5秒</option>
                <option value="800">0.8秒</option>
                <option value="1000">1.0秒</option>
                <option value="1200">1.2秒</option>
                <option value="1500">1.5秒</option>
                <option value="2000">2.0秒</option>
                <option value="2500">2.5秒</option>
                <option value="3000">3.0秒</option>
                <option value="4000">4.0秒</option>
                <option value="5000">5.0秒</option>
                <option value="8000">8.0秒</option>
              </select>
            </label>}
            <label>切换单词自动朗读
              <select value={settings.autoSpeak ? 'on' : 'off'} onChange={e => { const v = e.target.value === 'on'; setSettings(s => ({ ...s, autoSpeak: v })); saveSettings({ ...settings, autoSpeak: v }); }}>
                <option value="on">开启（每个新单词自动发音）</option>
                <option value="off">关闭</option>
              </select>
            </label>
            {isNativeApp && (
              <label>开屏更新公告
                <select value={settings.showAnnouncement ? 'on' : 'off'} onChange={e => { const v = e.target.value === 'on'; setSettings(s => ({ ...s, showAnnouncement: v })); saveSettings({ ...settings, showAnnouncement: v }); }}>
                  <option value="on">开启（启动时显示更新公告）</option>
                  <option value="off">关闭</option>
                </select>
              </label>
            )}
            <div className="settingsInfo">
              <p>首次使用：{firstUseDate}</p>
              <p>今日日期：{todayKey}</p>
              <p>总词库：{books.length} 个</p>
              <p>总词汇量：{books.reduce((s, b) => s + b.items.length, 0)} 条</p>
            </div>
          </div>

          {/* 版本更新中心 - 仅APP端显示 */}
          {isNativeApp ? (
          <div className="cloudUpdateSection">
            <div className="updateHeader">
              <h3>🔄 版本更新</h3>
              <span className="versionBadge">v{APP_VERSION}</span>
            </div>
            <p className="muted">点击检查更新，获取最新功能和词库。更新不会丢失任何个人数据。</p>
            <div className="updateActions">
              <button className="primary" onClick={() => checkCloudUpdate(false)} disabled={checkingUpdate}>
                {checkingUpdate ? '检查中...' : '检查更新'}
              </button>
            </div>
            {updateInfo && (
              <div className="updateInfoBox">
                {updateInfo.hasUpdate ? (
                  <>
                    <p className="updateNewVersion">发现新版本 v{updateInfo.version}</p>
                    <pre className="updateLog">{updateInfo.changelog || updateInfo.updateLog}</pre>
                    <button className="primary" onClick={applyUpdate} disabled={updateInfo.updating} style={{ marginTop: 8 }}>
                      {updateInfo.updating ? '更新中...' : '立即更新'}
                    </button>
                  </>
                ) : (
                  <p className="updateLatest">已是最新版本</p>
                )}
              </div>
            )}
            {cloudStatus && <p className="status" style={{ marginTop: 8 }}>{cloudStatus}</p>}
          </div>
          ) : null}

          {/* 浏览器下载回退（更新检查所有线路失败时显示） */}
          {showBrowserFallback && (
            <div className="cloudUpdateSection" style={{ background: '#fef3c7', borderColor: '#fde68a', marginTop: 12 }}>
              <h3 style={{ color: '#92400e' }}>📱 网络修复更新</h3>
              <p className="muted">APP内网络检测失败，点击下方按钮将在浏览器中打开更新页面，下载后安装即可。安装后更新将自动恢复。</p>
              <button className="primary" onClick={() => {
                window.open('https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/update.html', '_blank');
              }} style={{ background: '#f59e0b' }}>在浏览器中更新</button>
            </div>
          )}

          {/* 反馈入口（仅APP） */}
          {isNativeApp && (
            <div className="cloudUpdateSection" style={{ background: '#fef3c7', borderColor: '#fde68a' }}>
              <h3 style={{ color: '#92400e' }}>💬 反馈建议</h3>
              <p className="muted">有什么建议或遇到问题？告诉我们，帮助产品更好。</p>
              <button className="primary" onClick={() => setShowFeedback(true)} style={{ background: '#f59e0b' }}>提交反馈</button>
            </div>
          )}

          {/* 反馈弹窗（仅APP） */}
          {isNativeApp && showFeedback && (
            <div className="modalOverlay" onClick={e => { if (e.target === e.currentTarget) setShowFeedback(false); }}>
              <div className="modal" style={{ maxWidth: 420 }}>
                <h3>提交反馈</h3>
                <label style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' }}>反馈类型
                  <select value={feedbackType} onChange={e => setFeedbackType(e.target.value)} style={{ marginTop: 4 }}>
                    <option value="suggest">功能建议</option>
                    <option value="bug">Bug反馈</option>
                    <option value="other">其他</option>
                  </select>
                </label>
                <textarea
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="请详细描述你的建议或遇到的问题..."
                  style={{ minHeight: 120, marginTop: 8 }}
                />
                <div className="importActions" style={{ marginTop: 12 }}>
                  <button className="smallBtn" onClick={() => { setShowFeedback(false); setFeedbackStatus(''); }}>取消</button>
                  <button className="primary" onClick={submitFeedback}>提交</button>
                </div>
                {feedbackStatus && <p className="status" style={{ marginTop: 8 }}>{feedbackStatus}</p>}
              </div>
            </div>
          )}

          {/* 词库下载区域 */}
          <div className="downloadSection">
            <h3>词库下载</h3>
            <div className="downloadList">
              {builtInDownloads.map(dl => (
                <div key={dl.id} className="downloadCard">
                  <div>
                    <h3>{dl.name}</h3>
                    <p className="muted">{dl.desc} ({dl.items.length}条)</p>
                  </div>
                  {downloadedIds.includes(dl.id) ? (
                    <span className="downloadedTag">已下载</span>
                  ) : (
                    <button className="downloadBtn" onClick={() => handleDownload(dl)}>下载</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 网络搜索词库 */}
          <div className="cloudUpdateSection" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <h3 style={{ color: '#166534' }}>🌐 搜索网络词库</h3>
            <p className="muted">输入你想找的词库名称，搜索后复制内容回来粘贴即可。</p>
            <div className="netSearchRow">
              <input
                value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="输入关键词搜索，或直接粘贴词库内容..."
                style={{ flex: 1, minHeight: 60 }}
              />
              <button className="downloadBtn" onClick={() => {
                const kw = importText.trim();
                if (!kw) return;
                // 短文本当作搜索关键词，长文本当作词库内容
                if (kw.length < 30 && !kw.includes('\n')) {
                  window.open('https://www.bing.com/search?q=' + encodeURIComponent(kw + ' 英语词汇表 词单'));
                } else {
                  const items = parseImportedText(kw, 'word');
                  if (items.length > 0) {
                    const name = `搜索词库-${new Date().toLocaleDateString()}`;
                    const nb = { id: `net-${Date.now()}`, name, editable: true, items };
                    updateBooks([...books, nb]);
                    switchLibraryBook(nb.id);
                    setImportText('');
                    setImportStatus(`已导入：${name}（${items.length}条），已切换到该词库。`);
                    setSection('learn');
                  } else {
                    setImportStatus('未能识别到有效词条，请检查格式。');
                  }
                }
              }}>搜索/导入</button>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              输入短文本（如"四级词汇"）会打开搜索；粘贴大段词库内容会直接智能解析导入。
            </p>
            {importStatus && <p className="status" style={{ marginTop: 8 }}>{importStatus}</p>}
          </div>

          {/* 每个词库的重置进度 */}
          <div className="resetSection">
            <h3>词库进度管理</h3>
            <div className="list">
              {books.map(b => {
                const mastered = b.items.filter(i => progress[i.id] === 'mastered').length;
                return (
                  <div key={b.id} className="listItem">
                    <div>
                      <h3>{b.name}</h3>
                      <small>已掌握 {mastered}/{b.items.length}</small>
                    </div>
                    <button className="smallBtn dangerGhost" onClick={() => resetBookProgress(b.id)}>重置进度</button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 开屏公告弹窗 */}
          {showAnnouncementModal && announcementData && (
            <div className="updateOverlay" onClick={e => { if (e.target === e.currentTarget) setShowAnnouncementModal(false); }}>
              <div className="updateModal">
                <div className="updateModalHeader">
                  <div className="updateModalIcon">🚀</div>
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
                </div>
                <div className="updateModalFooter">
                  <button className="updateBtnGhost" onClick={() => {
                    localStorage.setItem('gaokao_dismissed_version', announcementData.version);
                    setDismissedVersion(announcementData.version);
                    setShowAnnouncementModal(false);
                  }}>下次再说</button>
                  <button className="updateBtnPrimary" onClick={() => {
                    setShowAnnouncementModal(false);
                    // 在浏览器中打开下载链接（使用 Gitee raw，国内直接访问）
                    const url = 'https://gitee.com/xdbzys/app/raw/master/gaokao-vocab.apk';
                    window.open(url, '_blank');
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
                alert('已清除所有自定义词库');
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

createRoot(document.getElementById('root')).render(<App />);

// Capacitor 应用不需要 Service Worker（资源从 APK 本地加载）
// 注销已有的 Service Worker 以避免缓存外部 API 请求
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(regs => {
    regs.forEach(r => r.unregister());
  });
}
