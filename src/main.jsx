import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import JSZip from 'jszip';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import './styles.css';
import { getWordEnrichment } from './wordEnrichment';

/* ============================
   APP 版本常量
   ============================ */
const APP_VERSION = '2.18.1';
const APP_VERSION_CODE = 162;
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
  ['absence', 'n.', '缺席,不在场,缺乏', '985', ['缺席,不在场,缺乏'], ['缺席,不在场,缺乏'], ['His absence from the meeting was noticed by everyone.']],
  ['absorb', 'vt.', '吸收,使专心', '985', ['吸收,使专心'], ['吸收,使专心'], ['Plants absorb sunlight to produce energy through photosynthesis.']],
  ['abstract', 'adj.', '抽象的n.摘要', '985', ['抽象的n.摘要'], ['抽象的n.摘要'], ['The concept of justice is too abstract for young children to grasp.']],
  ['academic', 'adj.', '学院的,学术的', '985', ['学院的,学术的'], ['学院的,学术的'], ['Her academic performance has improved significantly this term.']],
  ['access', 'n.', '进入，使用权，通路', '985', ['进入，使用权，通路'], ['进入，使用权，通路'], ['Students have free access to the online library resources.']],
  ['accordingly', 'adv.', '因此,依照', '985', ['因此,依照'], ['因此,依照'], ['The rules have changed; please act accordingly.']],
  ['account', 'n.', '账户；解释；理由', '985', ['账户；解释；理由'], ['账户；解释；理由'], ['She opened a bank account to save money for college.']],
  ['accurate', 'adj.', '精确的,准确的', '985', ['精确的,准确的'], ['精确的,准确的'], ['The clock is not very accurate; it loses a minute each day.']],
  ['accuse', 'vt.', '指责,归咎于', '985', ['指责,归咎于'], ['指责,归咎于'], ['You need to accuse the situation before making a final decision.']],
  ['actor', 'n.', '男演员', '985', ['男演员'], ['男演员'], ['The famous actor won an award for his performance in the film.']],
  ['actress', 'n.', '女演员', '985', ['女演员'], ['女演员'], ['The young actress delivered a stunning performance on stage.']],
  ['actual', 'adj.', '实际的,现行的', '985', ['实际的,现行的'], ['实际的,现行的'], ['The actual cost of the project was much higher than expected.']],
  ['adapt', 'vt.', '使适应,改编', '985', ['使适应,改编'], ['使适应,改编'], ['Animals adapt to their environment over thousands of years.']],
  ['admire', 'vt.', '钦佩,羡慕,赞赏', '985', ['钦佩,羡慕,赞赏'], ['钦佩,羡慕,赞赏'], ['I admire her courage to speak up against injustice.']],
  ['admit', 'vt.', '承认,准许…进入', '985', ['承认,准许…进入'], ['承认,准许…进入'], ['He had to admit that he had made a mistake in the calculation.']],
  ['adopt', 'vt.', '收养,采用,采取', '985', ['收养,采用,采取'], ['收养,采用,采取'], ['The school decided to adopt a new teaching method this semester.']],
  ['adult', 'n.', '成年人a.成年的', '985', ['成年人a.成年的'], ['成年人a.成年的'], ['Adults should set a good example for children to follow.']],
  ['advance', 'vi.', '前进,提高n.进展', '985', ['前进,提高n.进展'], ['前进,提高n.进展'], ['Technology advances at an astonishing pace every year.']],
  ['adventure', 'n.', '冒险,惊险活动', '985', ['冒险,惊险活动'], ['冒险,惊险活动'], ['The young man set out on an adventure across the desert.']],
  ['affair', 'n.', '事情,事件,事务', '985', ['事情,事件,事务'], ['事情,事件,事务'], ['The minister handled the affair with great care and diplomacy.']],
  ['affect', 'vt.', '影响,感动', '985', ['影响,感动'], ['影响,感动'], ['Lack of sleep can seriously affect your academic performance.']],
  ['afterward', '待标注', '(s)ad.后来,以后,随后', '985', ['(s)ad.后来,以'], ['(s)ad.后来,以后,随后'], ['She looked up "afterward" in the dictionary to check its exact usage.']],
  ['agent', 'n.', '代理人,代理商', '985', ['代理人,代理商'], ['代理人,代理商'], ['The travel agent arranged a tour package for the family.']],
  ['agriculture', 'n.', '农业,农艺,农学', '985', ['农业,农艺,农学'], ['农业,农艺,农学'], ['Modern agriculture relies heavily on technology and innovation.']],
  ['ahead', 'adv.', '在前,向前,提前', '985', ['在前,向前,提前'], ['在前,向前,提前'], ['She walked ahead of the group to scout the trail.']],
  ['aid', 'n.', '帮助,救护,助手', '985', ['帮助,救护,助手'], ['帮助,救护,助手'], ['The government provided financial aid to the flood victims.']],
  ['aim', 'n.', '目的，目标，对准v.目的在于，使…对准', '985', ['目的，目标，对准v.'], ['目的，目标，对准v.目的在于，使…对准'], ['Our aim is to improve the quality of education in rural areas.']],
  ['aircraft', 'n.', '飞机,飞行器', '985', ['飞机,飞行器'], ['飞机,飞行器'], ['The aircraft landed safely despite the heavy fog.']],
  ['alarm', 'n.', '警报，警告器，惊慌v.警告，使惊恐', '985', ['警报，警告器，惊慌v'], ['警报，警告器，惊慌v.警告，使惊恐'], ['The fire alarm went off during the exam, causing a brief panic.']],
  ['album', 'n.', '集邮本,照相簿,唱片', '985', ['集邮本,照相簿,唱片'], ['集邮本,照相簿,唱片'], ['She kept a photo album of all her high school memories.']],
  ['alcohol', 'n.', '酒精,乙醇', '985', ['酒精,乙醇'], ['酒精,乙醇'], ['Driving after drinking alcohol is strictly prohibited by law.']],
  ['altogether', 'adv.', '完全地,总共', '985', ['完全地,总共'], ['完全地,总共'], ['That is altogether the wrong approach to solving this problem.']],
  ['amaze', 'vt.', '使惊异', '985', ['使惊异'], ['使惊异'], ['Many readers fail to amaze the hidden message in the passage.']],
  ['ambition', 'n.', '雄心,抱负,野心', '985', ['雄心,抱负,野心'], ['雄心,抱负,野心'], ['His ambition to become a scientist drove him to study hard every day.']],
  ['amount', 'n.', '总数,数量', '985', ['总数,数量'], ['总数,数量'], ['A large amount of money was spent on the research project.']],
  ['amuse', 'vt.', '逗…乐,给…娱乐', '985', ['逗…乐,给…娱乐'], ['逗…乐,给…娱乐'], ['The committee decided to amuse the proposal after careful discussion.']],
  ['analyze', 'vt.', '分析,分解,解析', '985', ['分析,分解,解析'], ['分析,分解,解析'], ['The students were asked to analyze the poem for hidden meanings.']],
  ['ancestor', 'n.', '祖宗,祖先', '985', ['祖宗,祖先'], ['祖宗,祖先'], ['Many people visit their ancestors\' graves during the Qingming Festival.']],
  ['anger', 'n.', '怒,愤怒vt.使发怒', '985', ['怒,愤怒vt.使发怒'], ['怒,愤怒vt.使发怒'], ['The essay examines how anger shapes our decisions.']],
  ['angle', 'n.', '角,角度', '985', ['角,角度'], ['角,角度'], ['The photographer captured the building from a unique angle.']],
  ['anniversary', 'n.', '周年纪念日', '985', ['周年纪念日'], ['周年纪念日'], ['The couple celebrated their 25th wedding anniversary last weekend.']],
  ['announce', 'vt.', '宣布,发表', '985', ['宣布,发表'], ['宣布,发表'], ['The principal will announce the exam results tomorrow morning.']],
  ['annoy', 'vt.', '使恼怒,打搅', '985', ['使恼怒,打搅'], ['使恼怒,打搅'], ['The loud noise from the construction site annoyed the neighbors.']],
  ['anxious', 'adj.', '忧虑的,渴望的', '985', ['忧虑的,渴望的'], ['忧虑的,渴望的'], ['She felt anxious about the upcoming college entrance examination.']],
  ['anyhow', 'adv.', '无论如何', '985', ['无论如何'], ['无论如何'], ['Anyhow, we managed to finish the project before the deadline.']],
  ['apart', 'adv.', '相隔,分开,除去', '985', ['相隔,分开,除去'], ['相隔,分开,除去'], ['The two buildings stood fifty meters apart from each other.']],
  ['apartment', 'n.', '一套公寓房间', '985', ['一套公寓房间'], ['一套公寓房间'], ['Understanding apartment is crucial for grasping the author\'s main message.']],
  ['apologize', 'vi.', '道歉,谢罪,认错', '985', ['道歉,谢罪,认错'], ['道歉,谢罪,认错'], ['He apologized to his teacher for being late to class.']],
  ['appearance', 'n.', '出现,来到,外观', '985', ['出现,来到,外观'], ['出现,来到,外观'], ['Her neat appearance left a good impression on the interviewers.']],
  ['apply', 'vt.', '申请，应用', '985', ['申请，应用'], ['申请，应用'], ['She decided to apply for a part-time job at the bookstore.']],
  ['appointment', 'n.', '任命,预约', '985', ['任命,预约'], ['任命,预约'], ['I made an appointment with the dentist for next Tuesday.']],
  ['appreciate', 'vt.', '欣赏,感谢', '985', ['欣赏,感谢'], ['欣赏,感谢'], ['I really appreciate your help with the research project.']],
  ['approach', 'vt.', '靠近，接近，着手处理n.靠近，接近，方法', '985', ['靠近，接近，着手处理'], ['靠近，接近，着手处理n.靠近，接近，方法'], ['The teacher introduced a new approach to teaching grammar.']],
  ['architecture', 'n.', '建筑学,建筑式样', '985', ['建筑学,建筑式样'], ['建筑学,建筑式样'], ['The city is famous for its ancient architecture and rich history.']],
  ['argue', 'vi.', '争论,争辩,辩论', '985', ['争论,争辩,辩论'], ['争论,争辩,辩论'], ['Some scientists argue that global warming is accelerating.']],
  ['arrange', 'vt.', '筹备,整理', '985', ['筹备,整理'], ['筹备,整理'], ['The school arranged a field trip to the science museum.']],
  ['arrest', 'vt.', '逮捕,拘留', '985', ['逮捕,拘留'], ['逮捕,拘留'], ['The police arrested the suspect after a two-day manhunt.']],
  ['arrival', 'n.', '到达,到达者', '985', ['到达,到达者'], ['到达,到达者'], ['Upon arrival at the hotel, guests are greeted with warm towels.']],
  ['artist', 'n.', '艺术家,美术家', '985', ['艺术家,美术家'], ['艺术家,美术家'], ['The young artist displayed her paintings at the local gallery.']],
  ['ash', 'n.', '灰,灰末,骨灰', '985', ['灰,灰末,骨灰'], ['灰,灰末,骨灰'], ['Researchers have published new findings about ash.']],
  ['ashamed', 'adj.', '惭愧(的),羞耻(的)', '985', ['惭愧(的),羞耻(的'], ['惭愧(的),羞耻(的)'], ['He felt ashamed of himself for cheating on the test.']],
  ['aside', 'adv.', '在旁边,到旁边', '985', ['在旁边,到旁边'], ['在旁边,到旁边'], ['She set aside some money each month for her college fund.']],
  ['aspect', 'n.', '方面,样子,外表', '985', ['方面,样子,外表'], ['方面,样子,外表'], ['We must consider every aspect of the problem before making a decision.']],
  ['assistant', 'n.', '助手,助教', '985', ['助手,助教'], ['助手,助教'], ['The professor\'s assistant helped students with their lab reports.']],
  ['assume', 'vt.', '假定,承担,呈现', '985', ['假定,承担,呈现'], ['假定,承担,呈现'], ['Do not assume that everyone shares your point of view.']],
  ['astonish', 'vt.', '使惊讶,使吃惊', '985', ['使惊讶,使吃惊'], ['使惊讶,使吃惊'], ['The magician\'s performance astonished the entire audience.']],
  ['athlete', 'n.', '运动员', '985', ['运动员'], ['运动员'], ['The athlete trained for years to compete in the Olympics.']],
  ['atmosphere', 'n.', '大气,气氛', '985', ['大气,气氛'], ['大气,气氛'], ['The restaurant has a warm and romantic atmosphere.']],
  ['attach', 'vt.', '缚,系,贴,附加', '985', ['缚,系,贴,附加'], ['缚,系,贴,附加'], ['Please attach your resume to the email before sending it.']],
  ['attack', 'vt.', 'vi.n.攻击,进攻', '985', ['vi.n.攻击,进攻'], ['vi.n.攻击,进攻'], ['The enemy attacked the fortress at dawn without warning.']],
  ['attempt', 'vt.', '尝试,试图n.企图', '985', ['尝试,试图n.企图'], ['尝试,试图n.企图'], ['His attempt to climb Mount Everest inspired many young people.']],
  ['attend', 'vt.', '出席,照顾,护理', '985', ['出席,照顾,护理'], ['出席,照顾,护理'], ['Over five hundred people attended the graduation ceremony.']],
  ['attitude', 'n.', '态度', '985', ['态度'], ['态度'], ['A positive attitude towards failure is essential for success.']],
  ['attract', 'vt.', '吸引', '985', ['吸引'], ['吸引'], ['The flower show attracted thousands of visitors last weekend.']],
  ['audience', 'n.', '听众,观众', '985', ['听众,观众'], ['听众,观众'], ['The speaker captivated the audience with her inspiring story.']],
  ['author', 'n.', '作者,作家', '985', ['作者,作家'], ['作者,作家'], ['The author signed copies of his new novel at the bookstore.']],
  ['available', 'adj.', '可利用的,可得到的', '985', ['可利用的,可得到的'], ['可利用的,可得到的'], ['The book is available in both print and digital editions.']],
  ['average', 'n.', '平均数a.平均的', '985', ['平均数a.平均的'], ['平均数a.平均的'], ['The average temperature in July reaches 35 degrees Celsius.']],
  ['award', 'n.', '奖,奖品v.授予', '985', ['奖,奖品v.授予'], ['奖,奖品v.授予'], ['The committee awarded her the first prize for her essay.']],
  ['aware', 'adj.', '知道的,意识到的', '985', ['知道的,意识到的'], ['知道的,意识到的'], ['Most people are not aware of the dangers of secondhand smoke.']],
  ['awful', 'adj.', '可怕的，令人不愉快的', '985', ['可怕的，令人不愉快的'], ['可怕的，令人不愉快的'], ['The weather was awful during our entire vacation in Hawaii.']],
  ['badly', 'adv.', '坏,差,严重地', '985', ['坏,差,严重地'], ['坏,差,严重地'], ['The team played badly and lost the match by a wide margin.']],
  ['badminton', 'n.', '羽毛球', '985', ['羽毛球'], ['羽毛球'], ['The textbook defines badminton clearly in chapter three.']],
  ['baggage', 'n.', '行李', '985', ['行李'], ['行李'], ['The documentary explores the history of baggage in China.']],
  ['bake', 'vt.', '烤,烘,烧硬', '985', ['烤,烘,烧硬'], ['烤,烘,烧硬'], ['My grandmother baked fresh bread every Sunday morning.']],
  ['balance', 'vt.', '使平衡,称n.天平', '985', ['使平衡,称n.天平'], ['使平衡,称n.天平'], ['It is important to keep a balance between work and rest.']],
  ['ban', 'n.', '禁令vt.禁止,取缔', '985', ['禁令vt.禁止,取缔'], ['禁令vt.禁止,取缔'], ['The city imposed a ban on plastic bags to protect the environment.']],
  ['band', 'n.', '乐队,带,波段', '985', ['乐队,带,波段'], ['乐队,带,波段'], ['The school band performed at the annual music festival.']],
  ['bar', 'n.', '酒吧间,条,杆', '985', ['酒吧间,条,杆'], ['酒吧间,条,杆'], ['The documentary explores the history of bar in China.']],
  ['bare', 'adj.', '赤裸的,仅仅的', '985', ['赤裸的,仅仅的'], ['赤裸的,仅仅的'], ['The trees were bare after all the leaves had fallen in autumn.']],
  ['bargain', 'n.', '便宜货，交易vi.讨价还价,成交', '985', ['便宜货，交易vi.讨'], ['便宜货，交易vi.讨价还价,成交'], ['She found a great bargain at the weekend flea market.']],
  ['base', 'n.', '基础,底层,基地', '985', ['基础,底层,基地'], ['基础,底层,基地'], ['The military base was located near the coastal city.']],
  ['basin', 'n.', '盆子,盆地', '985', ['盆子,盆地'], ['盆子,盆地'], ['The article discusses the impact of basin on modern society.']],
  ['basis', 'n.', '基础,根据', '985', ['基础,根据'], ['基础,根据'], ['Trust is the basis of any good and lasting relationship.']],
  ['bath', 'n.', '洗澡,浴缸', '985', ['洗澡,浴缸'], ['洗澡,浴缸'], ['After a long day, a hot bath helps you relax completely.']],
  ['bathe', 'vt.', '给…洗澡', '985', ['给…洗澡'], ['给…洗澡'], ['The mother bathed the baby in warm water before bedtime.']],
  ['battery', 'n.', '电池', '985', ['电池'], ['电池'], ['My phone battery runs out quickly when I play games.']],
  ['battle', 'n.', '战役,斗争vi.作战', '985', ['战役,斗争vi.作战'], ['战役,斗争vi.作战'], ['The soldiers fought a fierce battle to defend their homeland.']],
  ['beard', 'n.', '胡须,络腮胡子', '985', ['胡须,络腮胡子'], ['胡须,络腮胡子'], ['Santa Claus is known for his long white beard.']],
  ['beauty', 'n.', '美,美丽,美人', '985', ['美,美丽,美人'], ['美,美丽,美人'], ['The beauty of the sunset took everyone\'s breath away.']],
  ['beer', 'n.', '啤酒', '985', ['啤酒'], ['啤酒'], ['Researchers have published new findings about beer.']],
  ['beg', 'vt.', 'vi.乞求,请求', '985', ['vi.乞求,请求'], ['vi.乞求,请求'], ['The students must beg the passage before answering the questions.']],
  ['beginning', 'n.', '开始,开端,起源', '985', ['开始,开端,起源'], ['开始,开端,起源'], ['The essay examines how beginning shapes our decisions.']],
  ['behave', 'vi.', '表现,举止', '985', ['表现,举止'], ['表现,举止'], ['He managed to behave the difficult task without any help.']],
  ['belly', 'n.', '腹部,胃', '985', ['腹部,胃'], ['腹部,胃'], ['The report highlights the significance of belly in education.']],
  ['belong', 'vi.', '属于,附属', '985', ['属于,附属'], ['属于,附属'], ['The author attempts to belong readers\' attention to this issue.']],
  ['belt', 'n.', '带,腰带,区', '985', ['带,腰带,区'], ['带,腰带,区'], ['The report highlights the significance of belt in education.']],
  ['bench', 'n.', '长凳,条凳,工作台', '985', ['长凳,条凳,工作台'], ['长凳,条凳,工作台'], ['The author mentions bench to support the main argument.']],
  ['bend', 'vt.', '使弯曲vi.弯曲', '985', ['使弯曲vi.弯曲'], ['使弯曲vi.弯曲'], ['The experiment shows how plants bend sunlight for growth.']],
  ['benefit', 'n.', '利益,恩惠,津贴', '985', ['利益,恩惠,津贴'], ['利益,恩惠,津贴'], ['Regular exercise has many benefits for both body and mind.']],
  ['best', 'adj.', '最好的', '985', ['最好的'], ['最好的'], ['The teacher was impressed by her best performance in class.']],
  ['better', 'adj.', '较好的ad.更好地', '985', ['较好的ad.更好地'], ['较好的ad.更好地'], ['The better candidate stood out among all the applicants.']],
  ['billion', '待标注', 'num.十亿', '985', ['num.十亿'], ['num.十亿'], ['The word "billion" appears frequently in gaokao reading passages.']],
  ['biology', 'n.', '生物学,生态学', '985', ['生物学,生态学'], ['生物学,生态学'], ['Biology is the study of living organisms and their interactions.']],
  ['birthplace', 'n.', '出生地', '985', ['出生地'], ['出生地'], ['The documentary explores the history of birthplace in China.']],
  ['bite', 'vt.', '咬,叮,螫', '985', ['咬,叮,螫'], ['咬,叮,螫'], ['The speaker continued to bite the audience with fascinating stories.']],
  ['blame', 'vt.', '责备,把…归咎于', '985', ['责备,把…归咎于'], ['责备,把…归咎于'], ['She helped her friend blame the challenging math problem.']],
  ['blank', 'adj.', '空白的n.空白', '985', ['空白的n.空白'], ['空白的n.空白'], ['The situation turned out to be more blank than we had expected.']],
  ['blanket', 'n.', '毯子', '985', ['毯子'], ['毯子'], ['The survey reveals public attitudes toward blanket.']],
  ['bleed', 'vi.', '流血', '985', ['流血'], ['流血'], ['The committee decided to bleed the proposal after careful discussion.']],
  ['block', 'n.', '街区，块，大厦vt.堵塞,拦阻', '985', ['街区，块，大厦vt.'], ['街区，块，大厦vt.堵塞,拦阻'], ['She lives just two blocks away from the school.']],
  ['blouse', 'n.', '宽松的上衣', '985', ['宽松的上衣'], ['宽松的上衣'], ['The documentary explores the history of blouse in China.']],
  ['boil', 'vi.', '沸腾,汽化vt.煮沸', '985', ['沸腾,汽化vt.煮沸'], ['沸腾,汽化vt.煮沸'], ['The scientist managed to boil the data accurately and efficiently.']],
  ['bomb', 'n.', '炸弹vt.轰炸', '985', ['炸弹vt.轰炸'], ['炸弹vt.轰炸'], ['The bomb was safely defused by the bomb disposal team.']],
  ['bone', 'n.', '骨,骨骼', '985', ['骨,骨骼'], ['骨,骨骼'], ['The survey reveals public attitudes toward bone.']],
  ['border', 'n.', '边缘,边界', '985', ['边缘,边界'], ['边缘,边界'], ['Knowing border well gives students confidence in exams.']],
  ['bother', 'vt.', '烦扰,打扰n.麻烦，烦恼', '985', ['烦扰,打扰n.麻烦，'], ['烦扰,打扰n.麻烦，烦恼'], ['She helped her friend bother the challenging math problem.']],
  ['brake', 'n.', '闸,刹车vi.刹车', '985', ['闸,刹车vi.刹车'], ['闸,刹车vi.刹车'], ['She wrote a research paper about brake last semester.']],
  ['branch', 'n.', '树枝,分部,分支，支流', '985', ['树枝,分部,分支，支'], ['树枝,分部,分支，支流'], ['The report highlights the significance of branch in education.']],
  ['brand', 'n.', '商标，牌子，烙印vt.印商标于，打烙印于，铭刻于', '985', ['商标，牌子，烙印vt'], ['商标，牌子，烙印vt.印商标于，打烙印于，铭刻于'], ['This brand of shampoo is popular among young consumers.']],
  ['brick', 'n.', '砖块', '985', ['砖块'], ['砖块'], ['The survey reveals public attitudes toward brick.']],
  ['brief', 'adj.', '简短的vt.作简报', '985', ['简短的vt.作简报'], ['简短的vt.作简报'], ['The brief approach helped students learn more effectively.']],
  ['broad', 'adj.', '宽阔的,广泛的', '985', ['宽阔的,广泛的'], ['宽阔的,广泛的'], ['The findings have broad implications for future research.']],
  ['broadcast', 'v/', 'n.广播,播撒，播音', '985', ['n.广播,播撒，播音'], ['n.广播,播撒，播音'], ['It is important to broadcast the instructions carefully before starting.']],
  ['broom', 'n.', '扫帚', '985', ['扫帚'], ['扫帚'], ['The lecture focused on the role of broom in daily life.']],
  ['bucket', 'n.', '水桶,吊桶', '985', ['水桶,吊桶'], ['水桶,吊桶'], ['The child carried a small bucket to the beach to build sandcastles.']],
  ['budget', 'v/', 'n.预算', '985', ['n.预算'], ['n.预算'], ['The students must budget the passage before answering the questions.']],
  ['burden', 'n.', '负担,责任，装载量vt.使负担，装货于', '985', ['负担,责任，装载量v'], ['负担,责任，装载量vt.使负担，装货于'], ['The survey reveals public attitudes toward burden.']],
  ['burst', 'v/', 'n.爆发，突发，爆炸', '985', ['n.爆发，突发，爆炸'], ['n.爆发，突发，爆炸'], ['Students should learn to burst their knowledge in real practice.']],
  ['bury', 'vt.', '埋葬,埋藏', '985', ['埋葬,埋藏'], ['埋葬,埋藏'], ['He managed to bury the difficult task without any help.']],
  ['bush', 'n.', '灌木', '985', ['灌木'], ['灌木'], ['Many exam questions test students\' knowledge of bush.']],
  ['butcher', 'n.', '屠夫,屠户', '985', ['屠夫,屠户'], ['屠夫,屠户'], ['The essay examines how butcher shapes our decisions.']],
  ['button', 'n.', '扣子,按钮vt.扣紧', '985', ['扣子,按钮vt.扣紧'], ['扣子,按钮vt.扣紧'], ['The teacher explained button with real-life examples in class.']],
  ['café', 'n.', '咖啡馆,小餐厅', '985', ['咖啡馆,小餐厅'], ['咖啡馆,小餐厅'], ['The experiment demonstrates the properties of café.']],
  ['cage', 'n.', '笼,鸟笼,囚笼', '985', ['笼,鸟笼,囚笼'], ['笼,鸟笼,囚笼'], ['The lecture focused on the role of cage in daily life.']],
  ['calculate', 'vt.', '计算,打算，认为', '985', ['计算,打算，认为'], ['计算,打算，认为'], ['She was the first to calculate the error in the report.']],
  ['calm', 'adj.', '平静的，沉着的v(使)平静，(使)镇定', '985', ['平静的，沉着的v(使'], ['平静的，沉着的v(使)平静，(使)镇定'], ['The calm approach helped students learn more effectively.']],
  ['candidate', 'n.', '候选人,应考者', '985', ['候选人,应考者'], ['候选人,应考者'], ['The documentary explores the history of candidate in China.']],
  ['carpet', 'n.', '地毯', '985', ['地毯'], ['地毯'], ['The passage provides a detailed analysis of carpet.']],
  ['carrot', 'n.', '胡萝卜', '985', ['胡萝卜'], ['胡萝卜'], ['The essay examines how carrot shapes our decisions.']],
  ['cart', 'n.', '二轮运货马车', '985', ['二轮运货马车'], ['二轮运货马车'], ['The author mentions cart to support the main argument.']],
  ['case', 'n.', '情况,案例,病例，箱', '985', ['情况,案例,病例，箱'], ['情况,案例,病例，箱'], ['The lecture focused on the role of case in daily life.']],
  ['cash', 'n.', '现金', '985', ['现金'], ['现金'], ['The article discusses the impact of cash on modern society.']],
  ['castle', 'n.', '城堡', '985', ['城堡'], ['城堡'], ['The lecture focused on the role of castle in daily life.']],
  ['casual', 'adj.', '偶然的,随便的，非正式的', '985', ['偶然的,随便的，非正'], ['偶然的,随便的，非正式的'], ['The casual changes in the climate worry many scientists worldwide.']],
  ['cattle', 'n.', '牛,牲口,家畜', '985', ['牛,牲口,家畜'], ['牛,牲口,家畜'], ['She wrote a research paper about cattle last semester.']],
  ['cave', 'n.', '山洞,洞穴,窑洞', '985', ['山洞,洞穴,窑洞'], ['山洞,洞穴,窑洞'], ['The explorers discovered ancient paintings inside the cave.']],
  ['centimeter', 'n.', '厘米', '985', ['厘米'], ['厘米'], ['The author mentions centimeter to support the main argument.']],
  ['central', 'adj.', '中心的,主要的', '985', ['中心的,主要的'], ['中心的,主要的'], ['The book provides a central analysis of the topic.']],
  ['ceremony', 'n.', '典礼,仪式', '985', ['典礼,仪式'], ['典礼,仪式'], ['The article discusses the impact of ceremony on modern society.']],
  ['certainly', 'adv.', '一定,必定,当然', '985', ['一定,必定,当然'], ['一定,必定,当然'], ['certainly, the experiment confirmed the theoretical hypothesis.']],
  ['chain', 'n.', '链,链条,项圈', '985', ['链,链条,项圈'], ['链,链条,项圈'], ['The interview covered several topics related to chain.']],
  ['challenge', 'v/', 'n.挑战', '985', ['n.挑战'], ['n.挑战'], ['She tried to challenge the problem from different angles.']],
  ['champion', 'n.', '冠军,拥护者vt.支持，拥护', '985', ['冠军,拥护者vt.支'], ['冠军,拥护者vt.支持，拥护'], ['The survey reveals public attitudes toward champion.']],
  ['channel', 'n.', '海峡,渠道,频道', '985', ['海峡,渠道,频道'], ['海峡,渠道,频道'], ['The news spread quickly through social media channels.']],
  ['chapter', 'n.', '章,回', '985', ['章,回'], ['章,回'], ['Read chapter three for homework and answer the questions.']],
  ['character', 'n.', '性格,品质，特性,角色，汉字', '985', ['性格,品质，特性,角'], ['性格,品质，特性,角色，汉字'], ['Knowing character well gives students confidence in exams.']],
  ['characteristic', 'adj.', '特有的n.特性', '985', ['特有的n.特性'], ['特有的n.特性'], ['Heavy rain is characteristic of the monsoon season in southern China.']],
  ['charge', 'vt.', '索价,控告，充电，使承担n.费用，控告，电荷，掌管', '985', ['索价,控告，充电，使'], ['索价,控告，充电，使承担n.费用，控告，电荷，掌管'], ['The manager is in charge of the entire sales department.']],
  ['chat', 'vi.', 'n.闲谈,聊天', '985', ['n.闲谈,聊天'], ['n.闲谈,聊天'], ['The two friends chatted happily over coffee at the cafe.']],
  ['cheek', 'n.', '面颊,脸蛋', '985', ['面颊,脸蛋'], ['面颊,脸蛋'], ['The baby\'s cheeks turned red from the cold winter wind.']],
  ['chief', 'adj.', '主要的,首席的', '985', ['主要的,首席的'], ['主要的,首席的'], ['The chief editor approved the article for publication.']],
  ['chimney', 'n.', '烟囱', '985', ['烟囱'], ['烟囱'], ['The report highlights the significance of chimney in education.']],
  ['cigar', 'n.', '雪茄', '985', ['雪茄'], ['雪茄'], ['The businessman lit a cigar after signing the big contract.']],
  ['cigarette', 'n.', '香烟', '985', ['香烟'], ['香烟'], ['The warning label on cigarette packs says smoking harms health.']],
  ['citizen', 'n.', '公民,市民,居民', '985', ['公民,市民,居民'], ['公民,市民,居民'], ['Every citizen has the right to vote in democratic elections.']],
  ['civil', 'adj.', '公民的,文职的', '985', ['公民的,文职的'], ['公民的,文职的'], ['Everyone has the right to participate in civil society.']],
  ['clerk', 'n.', '店员,办事员,职员', '985', ['店员,办事员,职员'], ['店员,办事员,职员'], ['The store clerk helped the customer find the right size.']],
  ['climate', 'n.', '气候', '985', ['气候'], ['气候'], ['The global climate has changed dramatically in recent decades.']],
  ['clinic', 'n.', '诊所,医务室,会诊', '985', ['诊所,医务室,会诊'], ['诊所,医务室,会诊'], ['The community clinic offers free health check-ups every month.']],
  ['clothing', 'n.', '衣服', '985', ['衣服'], ['衣服'], ['The experiment demonstrates the properties of clothing.']],
  ['cock', 'n.', '公鸡,龙头', '985', ['公鸡,龙头'], ['公鸡,龙头'], ['The interview covered several topics related to cock.']],
  ['collar', 'n.', '衣领', '985', ['衣领'], ['衣领'], ['The dog\'s collar has a tag with the owner\'s phone number.']],
  ['comb', 'n.', '梳子vt.梳理', '985', ['梳子vt.梳理'], ['梳子vt.梳理'], ['The interview covered several topics related to comb.']],
  ['combine', 'vt.', '使联合', '985', ['使联合'], ['使联合'], ['The chef combined fresh ingredients to create a delicious dish.']],
  ['comedy', 'n.', '喜剧', '985', ['喜剧'], ['喜剧'], ['The report highlights the significance of comedy in education.']],
  ['comfort', 'n.', '舒适,安慰vt.安慰', '985', ['舒适,安慰vt.安慰'], ['舒适,安慰vt.安慰'], ['The article discusses the impact of comfort on modern society.']],
  ['comment', 'n.', '评论,意见,注释', '985', ['评论,意见,注释'], ['评论,意见,注释'], ['The survey reveals public attitudes toward comment.']],
  ['commercial', 'adj.', '商业的n.商业广告', '985', ['商业的n.商业广告'], ['商业的n.商业广告'], ['Students found the topic commercial but ultimately rewarding.']],
  ['committee', 'n.', '委员会', '985', ['委员会'], ['委员会'], ['The report highlights the significance of committee in education.']],
  ['communism', 'n.', '共产主义', '985', ['共产主义'], ['共产主义'], ['The lecture focused on the role of communism in daily life.']],
  ['communist', 'n.', '共产党员', '985', ['共产党员'], ['共产党员'], ['Many exam questions test students\' knowledge of communist.']],
  ['companion', 'n.', '同伴vt.陪伴', '985', ['同伴vt.陪伴'], ['同伴vt.陪伴'], ['The essay examines how companion shapes our decisions.']],
  ['compete', 'vi.', '比赛,竞争', '985', ['比赛,竞争'], ['比赛,竞争'], ['Students from different schools compete in the annual science fair.']],
  ['complex', 'adj.', '综合的,复杂的', '985', ['综合的,复杂的'], ['综合的,复杂的'], ['The novel tells a complex story about personal growth and resilience.']],
  ['comrade', 'n.', '同志', '985', ['同志'], ['同志'], ['She wrote a research paper about comrade last semester.']],
  ['concentrate', 'v.', '集中,聚集', '985', ['集中,聚集'], ['集中,聚集'], ['She was the first to concentrate the error in the report.']],
  ['concern', 'n.', '关心(的事)，关系vt.使担心，关系到', '985', ['关心(的事)，关系v'], ['关心(的事)，关系vt.使担心，关系到'], ['The survey reveals public attitudes toward concern.']],
  ['conclusion', 'n.', '结论,推论,结局', '985', ['结论,推论,结局'], ['结论,推论,结局'], ['The textbook defines conclusion clearly in chapter three.']],
  ['concrete', 'n.', '混凝土a.具体的', '985', ['混凝土a.具体的'], ['混凝土a.具体的'], ['The workers poured concrete to build the foundation of the house.']],
  ['conduct', 'n.', '举止,行为,指导v.指导，进行', '985', ['举止,行为,指导v.'], ['举止,行为,指导v.指导，进行'], ['The professor will conduct the research project next semester.']],
  ['conductor', 'n.', '售票员,(乐队)指挥', '985', ['售票员,(乐队)指挥'], ['售票员,(乐队)指挥'], ['The documentary explores the history of conductor in China.']],
  ['confident', 'n.', '确信的,自信的', '985', ['确信的,自信的'], ['确信的,自信的'], ['The experiment demonstrates the properties of confident.']],
  ['confirm', 'vt.', '证实,批准', '985', ['证实,批准'], ['证实,批准'], ['Please confirm your reservation by email before the deadline.']],
  ['conflict', 'n.', '冲突', '985', ['冲突'], ['冲突'], ['The textbook defines conflict clearly in chapter three.']],
  ['confuse', 'vt.', '使混乱,混淆', '985', ['使混乱,混淆'], ['使混乱,混淆'], ['She helped her friend confuse the challenging math problem.']],
  ['congratulation', 'n.', '祝词,贺辞', '985', ['祝词,贺辞'], ['祝词,贺辞'], ['The teacher explained congratulation with real-life examples in class.']],
  ['consist', 'vi.', '由…组成', '985', ['由…组成'], ['由…组成'], ['The scientist managed to consist the data accurately and efficiently.']],
  ['constant', 'adj.', '经常的,恒定的，不变的n.(数)常数，恒量', '985', ['经常的,恒定的，不变'], ['经常的,恒定的，不变的n.(数)常数，恒量'], ['The constant approach helped students learn more effectively.']],
  ['construction', 'n.', '建造,建筑物', '985', ['建造,建筑物'], ['建造,建筑物'], ['The teacher explained construction with real-life examples in class.']],
  ['consume', 'vt.', '消耗,消费', '985', ['消耗,消费'], ['消耗,消费'], ['The students must consume the passage before answering the questions.']],
  ['contain', 'vt.', '包含,容纳', '985', ['包含,容纳'], ['包含,容纳'], ['The box contains important documents for the meeting.']],
  ['content', 'adj.', '满意的,满足的', '985', ['满意的,满足的'], ['满意的,满足的'], ['We need a more content plan to address this complex issue.']],
  ['continent', 'n.', '大陆,洲', '985', ['大陆,洲'], ['大陆,洲'], ['The documentary explores the history of continent in China.']],
  ['contribute', 'vt.', '捐献,捐助,投稿', '985', ['捐献,捐助,投稿'], ['捐献,捐助,投稿'], ['Everyone should contribute to protecting the environment.']],
  ['convenient', 'adj.', '便利的,方便的', '985', ['便利的,方便的'], ['便利的,方便的'], ['The convenient candidate stood out among all the applicants.']],
  ['convince', 'vt.', '使确信,使信服', '985', ['使确信,使信服'], ['使确信,使信服'], ['She convinced her parents to let her study abroad for a year.']],
  ['corn', 'n.', '谷物,玉米', '985', ['谷物,玉米'], ['谷物,玉米'], ['The essay examines how corn shapes our decisions.']],
  ['cottage', 'n.', '村舍,小屋', '985', ['村舍,小屋'], ['村舍,小屋'], ['The textbook defines cottage clearly in chapter three.']],
  ['counter', 'n.', '柜台,计数器', '985', ['柜台,计数器'], ['柜台,计数器'], ['The author mentions counter to support the main argument.']],
  ['court', 'n.', '法庭，球场，朝廷', '985', ['法庭，球场，朝廷'], ['法庭，球场，朝廷'], ['Understanding court is crucial for grasping the author\'s main message.']],
  ['courtyard', 'n.', '庭院,院子', '985', ['庭院,院子'], ['庭院,院子'], ['The teacher explained courtyard with real-life examples in class.']],
  ['crash', 'vi.', '碰撞,坠落n.碰撞，坠毁，破产', '985', ['碰撞,坠落n.碰撞，'], ['碰撞,坠落n.碰撞，坠毁，破产'], ['The professor urged students to crash beyond the textbook.']],
  ['cream', 'n.', '奶油', '985', ['奶油'], ['奶油'], ['The lecture focused on the role of cream in daily life.']],
  ['creature', 'n.', '生物,创造物', '985', ['生物,创造物'], ['生物,创造物'], ['The documentary explores the history of creature in China.']],
  ['credit', 'n.', '信用,信任，分数vt.信任', '985', ['信用,信任，分数vt'], ['信用,信任，分数vt.信任'], ['The passage provides a detailed analysis of credit.']],
  ['crew', 'n.', '全体船员', '985', ['全体船员'], ['全体船员'], ['The flight crew ensured all passengers were safe and comfortable.']],
  ['crime', 'n.', '罪,罪行,犯罪', '985', ['罪,罪行,犯罪'], ['罪,罪行,犯罪'], ['Understanding crime is crucial for grasping the author\'s main message.']],
  ['crop', 'n.', '农作物,庄稼', '985', ['农作物,庄稼'], ['农作物,庄稼'], ['Many exam questions test students\' knowledge of crop.']],
  ['crossing', 'n.', '十字路口', '985', ['十字路口'], ['十字路口'], ['The passage provides a detailed analysis of crossing.']],
  ['crowd', 'n.', '群,大众,一伙人', '985', ['群,大众,一伙人'], ['群,大众,一伙人'], ['The interview covered several topics related to crowd.']],
  ['cupboard', 'n.', '碗柜', '985', ['碗柜'], ['碗柜'], ['She stored the clean dishes in the kitchen cupboard.']],
  ['cure', 'vt.', 'n.治疗，治愈', '985', ['n.治疗，治愈'], ['n.治疗，治愈'], ['The experiment shows how plants cure sunlight for growth.']],
  ['curious', 'adj.', '好奇的', '985', ['好奇的'], ['好奇的'], ['The curious candidate stood out among all the applicants.']],
  ['curtain', 'n.', '帘,窗帘,幕(布)', '985', ['帘,窗帘,幕(布)'], ['帘,窗帘,幕(布)'], ['The committee discussed the topic of curtain at length during the meeting.']],
  ['cushion', 'n.', '垫子,坐垫,靠垫', '985', ['垫子,坐垫,靠垫'], ['垫子,坐垫,靠垫'], ['Many exam questions test students\' knowledge of cushion.']],
  ['custom', 'n.', '习惯,风俗,海关', '985', ['习惯,风俗,海关'], ['习惯,风俗,海关'], ['The textbook defines custom clearly in chapter three.']],
  ['customer', 'n.', '顾客', '985', ['顾客'], ['顾客'], ['Knowing customer well gives students confidence in exams.']],
  ['cycle', 'n.', '循环，自行车v.(使)循环，骑自行车', '985', ['循环，自行车v.(使'], ['循环，自行车v.(使)循环，骑自行车'], ['The lecture focused on the role of cycle in daily life.']],
  ['damage', 'vt.', '损害,毁坏n.损害', '985', ['损害,毁坏n.损害'], ['损害,毁坏n.损害'], ['The storm damaged several houses in the coastal village.']],
  ['damp', 'adj.', '潮湿的', '985', ['潮湿的'], ['潮湿的'], ['The novel tells a damp story about personal growth and resilience.']],
  ['darkness', 'n.', '黑暗', '985', ['黑暗'], ['黑暗'], ['The teacher explained darkness with real-life examples in class.']],
  ['dawn', 'n.', '黎明,开端', '985', ['黎明,开端'], ['黎明,开端'], ['The passage provides a detailed analysis of dawn.']],
  ['deadline', 'n.', '最终期限', '985', ['最终期限'], ['最终期限'], ['The textbook defines deadline clearly in chapter three.']],
  ['debate', 'n.', 'vi.争论,辩论', '985', ['vi.争论,辩论'], ['vi.争论,辩论'], ['The students debated passionately about climate change policies.']],
  ['debt', 'n.', '债务,欠债', '985', ['债务,欠债'], ['债务,欠债'], ['Knowing debt well gives students confidence in exams.']],
  ['declare', 'vt.', '断言,声明', '985', ['断言,声明'], ['断言,声明'], ['The government declared a state of emergency after the earthquake.']],
  ['decorate', 'vt.', '装饰', '985', ['装饰'], ['装饰'], ['She helped her friend decorate the challenging math problem.']],
  ['decrease', 'vi.', 'n.减少', '985', ['n.减少'], ['n.减少'], ['The number of smokers has decreased significantly in recent years.']],
  ['deed', 'n.', '行为,功绩,契约', '985', ['行为,功绩,契约'], ['行为,功绩,契约'], ['Many exam questions test students\' knowledge of deed.']],
  ['defeat', 'vt.', '战胜,击败', '985', ['战胜,击败'], ['战胜,击败'], ['The underdog team defeated the champions in a thrilling match.']],
  ['defence', 'n.', '防御,辩护', '985', ['防御,辩护'], ['防御,辩护'], ['The author mentions defence to support the main argument.']],
  ['defend', 'vt.', '保卫,防守，辩护', '985', ['保卫,防守，辩护'], ['保卫,防守，辩护'], ['The lawyer defended his client with compelling evidence.']],
  ['degree', 'n.', '程度,度,学位', '985', ['程度,度,学位'], ['程度,度,学位'], ['The interview covered several topics related to degree.']],
  ['delay', 'vt.', '推迟,耽搁,延误', '985', ['推迟,耽搁,延误'], ['推迟,耽搁,延误'], ['The flight was delayed by two hours due to bad weather.']],
  ['delete', 'vt.', '删除,擦掉', '985', ['删除,擦掉'], ['删除,擦掉'], ['The author attempts to delete readers\' attention to this issue.']],
  ['delight', 'n.', '快乐vt.使高兴', '985', ['快乐vt.使高兴'], ['快乐vt.使高兴'], ['The lecture focused on the role of delight in daily life.']],
  ['deliver', 'vt.', '投递,送交', '985', ['投递,送交'], ['投递,送交'], ['The committee decided to deliver the proposal after careful discussion.']],
  ['demand', 'vt.', '要求,需要', '985', ['要求,需要'], ['要求,需要'], ['Customers demand higher quality products at reasonable prices.']],
  ['department', 'n.', '部,司,局,处,系', '985', ['部,司,局,处,系'], ['部,司,局,处,系'], ['Knowing department well gives students confidence in exams.']],
  ['depth', 'n.', '深度,深处', '985', ['深度,深处'], ['深度,深处'], ['Researchers have published new findings about depth.']],
  ['desert', 'n.', '沙漠，荒原vt.遗弃，放弃', '985', ['沙漠，荒原vt.遗弃'], ['沙漠，荒原vt.遗弃，放弃'], ['Understanding desert is crucial for grasping the author\'s main message.']],
  ['deserve', 'vt.', '应受,值得', '985', ['应受,值得'], ['应受,值得'], ['She deserves the award after years of dedicated service.']],
  ['design', 'vt.', '设计n.设计', '985', ['设计n.设计'], ['设计n.设计'], ['The engineer designed a more efficient engine for the car.']],
  ['desire', 'vt.', '想要,要求n.愿望，要求', '985', ['想要,要求n.愿望，'], ['想要,要求n.愿望，要求'], ['Many readers fail to desire the hidden message in the passage.']],
  ['destination', 'n.', '目的地,终点', '985', ['目的地,终点'], ['目的地,终点'], ['The experiment demonstrates the properties of destination.']],
  ['destroy', 'vt.', '破坏,消灭', '985', ['破坏,消灭'], ['破坏,消灭'], ['The wildfire destroyed thousands of acres of forest land.']],
  ['detect', 'vt.', '察觉,发觉,侦察', '985', ['察觉,发觉,侦察'], ['察觉,发觉,侦察'], ['Many readers fail to detect the hidden message in the passage.']],
  ['determine', 'vt.', '决定,决心', '985', ['决定,决心'], ['决定,决心'], ['Scientists determined the age of the fossil using carbon dating.']],
  ['devote', 'vt.', '将…奉献,致力于', '985', ['将…奉献,致力于'], ['将…奉献,致力于'], ['He devoted his entire life to studying ancient Chinese history.']],
  ['diagram', 'n.', '图解,图表', '985', ['图解,图表'], ['图解,图表'], ['Knowing diagram well gives students confidence in exams.']],
  ['dial', 'n.', '钟面,拨号盘，刻度盘vt.拨号', '985', ['钟面,拨号盘，刻度盘'], ['钟面,拨号盘，刻度盘vt.拨号'], ['The lecture focused on the role of dial in daily life.']],
  ['diamond', 'n.', '钻石,菱形', '985', ['钻石,菱形'], ['钻石,菱形'], ['The committee discussed the topic of diamond at length during the meeting.']],
  ['dictation', 'n.', '听写，口述', '985', ['听写，口述'], ['听写，口述'], ['The article discusses the impact of dictation on modern society.']],
  ['diet', 'n.', '饮食,食物v.节食', '985', ['饮食,食物v.节食'], ['饮食,食物v.节食'], ['The essay examines how diet shapes our decisions.']],
  ['differ', 'vi.', '不同,相异', '985', ['不同,相异'], ['不同,相异'], ['The team will differ the new strategy starting next quarter.']],
  ['digest', 'vt.', '消化,领会n.文摘', '985', ['消化,领会n.文摘'], ['消化,领会n.文摘'], ['You need to digest the situation before making a final decision.']],
  ['digital', 'adj.', '数字的，数码的', '985', ['数字的，数码的'], ['数字的，数码的'], ['A digital diet is essential for maintaining good health.']],
  ['dirt', 'n.', '泥土，灰尘,污垢', '985', ['泥土，灰尘,污垢'], ['泥土，灰尘,污垢'], ['Researchers have published new findings about dirt.']],
  ['disadvantage', 'n.', '缺点，不利条件', '985', ['缺点，不利条件'], ['缺点，不利条件'], ['The report highlights the significance of disadvantage in education.']],
  ['disagree', 'vi.', '不同意;不一致', '985', ['不同意;不一致'], ['不同意;不一致'], ['The experiment shows how plants disagree sunlight for growth.']],
  ['disappear', 'vi.', '不见,失踪,消失', '985', ['不见,失踪,消失'], ['不见,失踪,消失'], ['The sun slowly disappeared behind the mountains at dusk.']],
  ['disappoint', 'vt.', '使失望', '985', ['使失望'], ['使失望'], ['Many readers fail to disappoint the hidden message in the passage.']],
  ['disaster', 'n.', '灾难', '985', ['灾难'], ['灾难'], ['The novel uses the theme of disaster throughout the story.']],
  ['discount', 'n.', '折扣v.打折', '985', ['折扣v.打折'], ['折扣v.打折'], ['Understanding discount is crucial for grasping the author\'s main message.']],
  ['discriminate', 'vt.', 'vi.区别对待,歧视', '985', ['vi.区别对待,歧视'], ['vi.区别对待,歧视'], ['Many readers fail to discriminate the hidden message in the passage.']],
  ['dislike', 'vt.', 'n.不喜爱,厌恶', '985', ['n.不喜爱,厌恶'], ['n.不喜爱,厌恶'], ['The speaker continued to dislike the audience with fascinating stories.']],
  ['distance', 'n.', '距离,远处', '985', ['距离,远处'], ['距离,远处'], ['The committee discussed the topic of distance at length during the meeting.']],
  ['distant', 'adj.', '在远处的,疏远的，冷漠的', '985', ['在远处的,疏远的，冷'], ['在远处的,疏远的，冷漠的'], ['The book provides a distant analysis of the topic.']],
  ['distinguish', 'vt.', '区别,辨别', '985', ['区别,辨别'], ['区别,辨别'], ['It is hard to distinguish the twins from each other.']],
  ['district', 'n.', '地区,区域', '985', ['地区,区域'], ['地区,区域'], ['The teacher explained district with real-life examples in class.']],
  ['document', 'n.', '文件，公文vt.用文件证明', '985', ['文件，公文vt.用文'], ['文件，公文vt.用文件证明'], ['The interview covered several topics related to document.']],
  ['donate', 'vt.', 'vi.捐赠', '985', ['vi.捐赠'], ['vi.捐赠'], ['She tried to donate the problem from different angles.']],
  ['dormitory', 'n.', '集体寝室,宿舍', '985', ['集体寝室,宿舍'], ['集体寝室,宿舍'], ['The author mentions dormitory to support the main argument.']],
  ['dot', 'n.', '点,圆点vt.打点于', '985', ['点,圆点vt.打点于'], ['点,圆点vt.打点于'], ['The article discusses the impact of dot on modern society.']],
  ['download', 'n.', '下装,卸载', '985', ['下装,卸载'], ['下装,卸载'], ['The novel uses the theme of download throughout the story.']],
  ['downtown', 'adv.', '在市区,往市区', '985', ['在市区,往市区'], ['在市区,往市区'], ['The students responded downtown to the teacher\'s challenging question.']],
  ['drawing', 'n.', '绘画', '985', ['绘画'], ['绘画'], ['The experiment demonstrates the properties of drawing.']],
  ['drill', 'n.', '钻孔机，训练vi.钻孔，训练', '985', ['钻孔机，训练vi.钻'], ['钻孔机，训练vi.钻孔，训练'], ['The survey reveals public attitudes toward drill.']],
  ['drown', 'v.', '淹没，溺死', '985', ['淹没，溺死'], ['淹没，溺死'], ['The speaker continued to drown the audience with fascinating stories.']],
  ['drunk', 'adj.', '醉的,陶醉的', '985', ['醉的,陶醉的'], ['醉的,陶醉的'], ['The findings have drunk implications for future research.']],
  ['due', 'adj.', '预期的,到期的，应付的', '985', ['预期的,到期的，应付'], ['预期的,到期的，应付的'], ['The due candidate stood out among all the applicants.']],
  ['dull', 'adj.', '枯燥的,阴暗的', '985', ['枯燥的,阴暗的'], ['枯燥的,阴暗的'], ['The novel tells a dull story about personal growth and resilience.']],
  ['dust', 'n.', '灰尘', '985', ['灰尘'], ['灰尘'], ['The documentary explores the history of dust in China.']],
  ['dusty', 'adj.', '落满灰尘的，灰蒙蒙的', '985', ['落满灰尘的，灰蒙蒙的'], ['落满灰尘的，灰蒙蒙的'], ['Students found the topic dusty but ultimately rewarding.']],
  ['eager', 'adj.', '渴望的,热切的', '985', ['渴望的,热切的'], ['渴望的,热切的'], ['A eager diet is essential for maintaining good health.']],
  ['earn', 'vt.', '挣得,获得', '985', ['挣得,获得'], ['挣得,获得'], ['She earned enough money to pay for her college tuition.']],
  ['earthquake', 'n.', '地震', '985', ['地震'], ['地震'], ['The documentary explores the history of earthquake in China.']],
  ['eastern', 'adj.', '东方的,朝东的', '985', ['东方的,朝东的'], ['东方的,朝东的'], ['The book provides a eastern analysis of the topic.']],
  ['edit', 'vt.', '编辑,编纂,校订', '985', ['编辑,编纂,校订'], ['编辑,编纂,校订'], ['It is important to edit the instructions carefully before starting.']],
  ['effect', 'n.', '影响，效果,作用', '985', ['影响，效果,作用'], ['影响，效果,作用'], ['Understanding effect is crucial for grasping the author\'s main message.']],
  ['elect', 'vt.', '选举,推选', '985', ['选举,推选'], ['选举,推选'], ['The guide began to elect the history of the ancient city.']],
  ['electricity', 'n.', '电,电流', '985', ['电,电流'], ['电,电流'], ['The author mentions electricity to support the main argument.']],
  ['electronic', 'adj.', '电子的', '985', ['电子的'], ['电子的'], ['The electronic design of the building won several international awards.']],
  ['embarrass', 'vt.', '使窘迫,使为难', '985', ['使窘迫,使为难'], ['使窘迫,使为难'], ['She was the first to embarrass the error in the report.']],
  ['emergency', 'n.', '紧急情况,突然事件', '985', ['紧急情况,突然事件'], ['紧急情况,突然事件'], ['She wrote a research paper about emergency last semester.']],
  ['employ', 'vt.', '雇用', '985', ['雇用'], ['雇用'], ['You need to employ the situation before making a final decision.']],
  ['endless', 'adj.', '无止境的', '985', ['无止境的'], ['无止境的'], ['Her endless attitude inspired those around her to do better.']],
  ['engine', 'n.', '发动机,引擎', '985', ['发动机,引擎'], ['发动机,引擎'], ['The lecture focused on the role of engine in daily life.']],
  ['enjoyable', 'adj.', '使人快乐的，有乐趣的', '985', ['使人快乐的，有乐趣的'], ['使人快乐的，有乐趣的'], ['The author\'s enjoyable style attracted a wide and loyal readership.']],
  ['entertainment', 'n.', '娱乐,款待,娱乐表演', '985', ['娱乐,款待,娱乐表演'], ['娱乐,款待,娱乐表演'], ['The essay examines how entertainment shapes our decisions.']],
  ['entire', 'adj.', '全部的,彻底的', '985', ['全部的,彻底的'], ['全部的,彻底的'], ['Her entire attitude inspired those around her to do better.']],
  ['entrance', 'n.', '入口,进入', '985', ['入口,进入'], ['入口,进入'], ['The textbook defines entrance clearly in chapter three.']],
  ['envelope', 'n.', '信封,封皮', '985', ['信封,封皮'], ['信封,封皮'], ['The documentary explores the history of envelope in China.']],
  ['envy', 'vt.', 'n.妒忌,羡慕', '985', ['n.妒忌,羡慕'], ['n.妒忌,羡慕'], ['The guide began to envy the history of the ancient city.']],
  ['equal', 'adj.', '相等的,平等的', '985', ['相等的,平等的'], ['相等的,平等的'], ['His equal response showed great maturity and wisdom.']],
  ['equipment', 'n.', '装备,设备,配备', '985', ['装备,设备,配备'], ['装备,设备,配备'], ['The committee discussed the topic of equipment at length during the meeting.']],
  ['error', 'n.', '错误,误差，过失', '985', ['错误,误差，过失'], ['错误,误差，过失'], ['The article discusses the impact of error on modern society.']],
  ['escape', 'vi.', '逃脱，逃避n.逃跑，逃亡', '985', ['逃脱，逃避n.逃跑，'], ['逃脱，逃避n.逃跑，逃亡'], ['The prisoner attempted to escape but was caught at the border.']],
  ['especially', 'adv.', '特别,尤其,格外', '985', ['特别,尤其,格外'], ['特别,尤其,格外'], ['The professor especially analyzed the research findings for the class.']],
  ['essay', 'n.', '散文,文章，随笔', '985', ['散文,文章，随笔'], ['散文,文章，随笔'], ['Understanding essay is crucial for grasping the author\'s main message.']],
  ['evaluate', 'vt.', '评价,估价', '985', ['评价,估价'], ['评价,估价'], ['The committee will evaluate all proposals before making a decision.']],
  ['event', 'n.', '事件,大事', '985', ['事件,大事'], ['事件,大事'], ['Students often encounter the term "event" in gaokao reading passages.']],
  ['evidence', 'n.', '根据,依据', '985', ['根据,依据'], ['根据,依据'], ['The report highlights the significance of evidence in education.']],
  ['exact', 'adj.', '确切的,精确的', '985', ['确切的,精确的'], ['确切的,精确的'], ['His exact response showed great maturity and wisdom.']],
  ['exactly', 'adv.', '恰好是，准确地', '985', ['恰好是，准确地'], ['恰好是，准确地'], ['The survey exactly reveals a shift in public opinion.']],
  ['exchange', 'vt.', 'n.交换,交流，交易，兑换', '985', ['n.交换,交流，交易'], ['n.交换,交流，交易，兑换'], ['Students can exchange ideas during the group discussion.']],
  ['exciting', 'adj.', '令人兴奋的', '985', ['令人兴奋的'], ['令人兴奋的'], ['Students found the topic exciting but ultimately rewarding.']],
  ['exhibition', 'n.', '展览,陈列,展览会', '985', ['展览,陈列,展览会'], ['展览,陈列,展览会'], ['The teacher explained exhibition with real-life examples in class.']],
  ['exist', 'vi.', '存在,生存', '985', ['存在,生存'], ['存在,生存'], ['The author attempts to exist readers\' attention to this issue.']],
  ['exit', 'n.', '出口,退场vi.退出', '985', ['出口,退场vi.退出'], ['出口,退场vi.退出'], ['The report highlights the significance of exit in education.']],
  ['expand', 'vt.', '扩大,使膨胀,发展', '985', ['扩大,使膨胀,发展'], ['扩大,使膨胀,发展'], ['The company plans to expand its business into Southeast Asia.']],
  ['expense', 'n.', '花费,消费,费用', '985', ['花费,消费,费用'], ['花费,消费,费用'], ['The article discusses the impact of expense on modern society.']],
  ['expert', 'n.', '专家a.熟练的', '985', ['专家a.熟练的'], ['专家a.熟练的'], ['The essay examines how expert shapes our decisions.']],
  ['explanation', 'n.', '解释,说明,辩解', '985', ['解释,说明,辩解'], ['解释,说明,辩解'], ['The interview covered several topics related to explanation.']],
  ['explode', 'vt.', '使爆炸vi.爆炸', '985', ['使爆炸vi.爆炸'], ['使爆炸vi.爆炸'], ['The experiment shows how plants explode sunlight for growth.']],
  ['exploit', 'vt.', '剥削,开发，开采', '985', ['剥削,开发，开采'], ['剥削,开发，开采'], ['The guide began to exploit the history of the ancient city.']],
  ['explore', 'vt.', 'vi.探险,探索', '985', ['vi.探险,探索'], ['vi.探险,探索'], ['The team explored the cave system for over six hours.']],
  ['export', 'vt.', '输出,出口', '985', ['输出,出口'], ['输出,出口'], ['The author attempts to export readers\' attention to this issue.']],
  ['expression', 'n.', '措辞,词句，表达,表情', '985', ['措辞,词句，表达,表'], ['措辞,词句，表达,表情'], ['She wrote a research paper about expression last semester.']],
  ['extra', 'adj.', '额外的ad.另外', '985', ['额外的ad.另外'], ['额外的ad.另外'], ['A extra diet is essential for maintaining good health.']],
  ['extraordinary', 'adj.', '非同寻常的,非凡的，特别的', '985', ['非同寻常的,非凡的，'], ['非同寻常的,非凡的，特别的'], ['The extraordinary changes in the climate worry many scientists worldwide.']],
  ['extremely', 'adv.', '极其，极端地', '985', ['极其，极端地'], ['极其，极端地'], ['She completed the assignment extremely and submitted it early.']],
  ['fade', 'vi.', '褪色,逐渐消失', '985', ['褪色,逐渐消失'], ['褪色,逐渐消失'], ['The old photograph had faded over the years, losing its color.']],
  ['failure', 'n.', '失败,失败的人/事', '985', ['失败,失败的人/事'], ['失败,失败的人/事'], ['The essay examines how failure shapes our decisions.']],
  ['fairly', 'adv.', '相当,公平地', '985', ['相当,公平地'], ['相当,公平地'], ['The results fairly reflect the team\'s combined efforts.']],
  ['faith', 'n.', '信任,信心,信仰', '985', ['信任,信心,信仰'], ['信任,信心,信仰'], ['The author mentions faith to support the main argument.']],
  ['false', 'adj.', '不真实的,伪造的', '985', ['不真实的,伪造的'], ['不真实的,伪造的'], ['The false design of the building won several international awards.']],
  ['familiar', 'adj.', '熟悉的', '985', ['熟悉的'], ['熟悉的'], ['The familiar design of the building won several international awards.']],
  ['farther', 'adv.', '更远地a.更远的', '985', ['更远地a.更远的'], ['更远地a.更远的'], ['The students worked farther throughout the entire semester.']],
  ['fasten', 'vt.', '扎牢,使固定', '985', ['扎牢,使固定'], ['扎牢,使固定'], ['Please fasten your seatbelt before the plane takes off.']],
  ['fault', 'n.', '错误，缺点,毛病,故障', '985', ['错误，缺点,毛病,故'], ['错误，缺点,毛病,故障'], ['Many exam questions test students\' knowledge of fault.']],
  ['favor', 'n.', '好感,赞同,恩惠', '985', ['好感,赞同,恩惠'], ['好感,赞同,恩惠'], ['The survey reveals public attitudes toward favor.']],
  ['fax', 'n.', 'vt.传真', '985', ['vt.传真'], ['vt.传真'], ['The report highlights the significance of fax in education.']],
  ['feather', 'n.', '羽毛,翎毛,羽状物', '985', ['羽毛,翎毛,羽状物'], ['羽毛,翎毛,羽状物'], ['Understanding feather is crucial for grasping the author\'s main message.']],
  ['federal', 'adj.', '联邦的,联盟的', '985', ['联邦的,联盟的'], ['联邦的,联盟的'], ['The findings have federal implications for future research.']],
  ['fee', 'n.', '费用，酬金，小费v.付费给', '985', ['费用，酬金，小费v.'], ['费用，酬金，小费v.付费给'], ['The experiment demonstrates the properties of fee.']],
  ['fellow', 'n.', '家伙,伙伴', '985', ['家伙,伙伴'], ['家伙,伙伴'], ['The essay examines how fellow shapes our decisions.']],
  ['female', 'n.', 'a.女性的,雌性的', '985', ['a.女性的,雌性的'], ['a.女性的,雌性的'], ['Understanding female is crucial for grasping the author\'s main message.']],
  ['fence', 'n.', '栅栏v.围以栅栏', '985', ['栅栏v.围以栅栏'], ['栅栏v.围以栅栏'], ['The committee discussed the topic of fence at length during the meeting.']],
  ['fiction', 'n.', '小说,虚构,谎言', '985', ['小说,虚构,谎言'], ['小说,虚构,谎言'], ['The interview covered several topics related to fiction.']],
  ['fierce', 'adj.', '凶猛的,猛烈的', '985', ['凶猛的,猛烈的'], ['凶猛的,猛烈的'], ['She remained fierce despite the difficulties she faced.']],
  ['figure', 'n.', '数字,人物，体形，画像，图形v.计算，认为', '985', ['数字,人物，体形，画'], ['数字,人物，体形，画像，图形v.计算，认为'], ['Many exam questions test students\' knowledge of figure.']],
  ['file', 'n.', '文件，档案，文件夹vt.把…归档', '985', ['文件，档案，文件夹v'], ['文件，档案，文件夹vt.把…归档'], ['The interview covered several topics related to file.']],
  ['finance', 'n.', '财政,金融', '985', ['财政,金融'], ['财政,金融'], ['Researchers have published new findings about finance.']],
  ['fireworks', 'n.', '[pl.]爆竹,烟花', '985', ['[pl.]爆竹,烟花'], ['[pl.]爆竹,烟花'], ['Students often encounter the term "fireworks" in gaokao reading passages.']],
  ['firm', 'adj.', '坚定的n.公司,商号', '985', ['坚定的n.公司,商号'], ['坚定的n.公司,商号'], ['The firm approach helped students learn more effectively.']],
  ['fist', 'n.', '拳头', '985', ['拳头'], ['拳头'], ['The passage provides a detailed analysis of fist.']],
  ['flame', 'n.', '火焰,光辉,热情', '985', ['火焰,光辉,热情'], ['火焰,光辉,热情'], ['The teacher explained flame with real-life examples in class.']],
  ['flash', 'n.', '闪光vi.闪,闪烁', '985', ['闪光vi.闪,闪烁'], ['闪光vi.闪,闪烁'], ['Knowing flash well gives students confidence in exams.']],
  ['flesh', 'n.', '肉,肌肉,肉体', '985', ['肉,肌肉,肉体'], ['肉,肌肉,肉体'], ['The survey reveals public attitudes toward flesh.']],
  ['flight', 'n.', '航班,飞行,逃跑', '985', ['航班,飞行,逃跑'], ['航班,飞行,逃跑'], ['The lecture focused on the role of flight in daily life.']],
  ['float', 'vi.', '漂浮vt.使漂浮', '985', ['漂浮vt.使漂浮'], ['漂浮vt.使漂浮'], ['The leaves floated gently on the surface of the calm lake.']],
  ['flood', 'n.', '洪水', '985', ['洪水'], ['洪水'], ['The novel uses the theme of flood throughout the story.']],
  ['flour', 'n.', '面粉,粉状物质', '985', ['面粉,粉状物质'], ['面粉,粉状物质'], ['Many exam questions test students\' knowledge of flour.']],
  ['flow', 'vi.', '流动n.流动，流量', '985', ['流动n.流动，流量'], ['流动n.流动，流量'], ['Parents should flow their children to develop good study habits.']],
  ['fluent', 'adj.', '流利的,流畅的', '985', ['流利的,流畅的'], ['流利的,流畅的'], ['Students found the topic fluent but ultimately rewarding.']],
  ['focus', 'vi.', '聚焦,注视n.焦点', '985', ['聚焦,注视n.焦点'], ['聚焦,注视n.焦点'], ['The government plans to focus the policy nationwide next year.']],
  ['foggy', 'adj.', '有雾的，朦胧的', '985', ['有雾的，朦胧的'], ['有雾的，朦胧的'], ['The book provides a foggy analysis of the topic.']],
  ['fold', 'vt.', '折叠,合拢n.褶', '985', ['折叠,合拢n.褶'], ['折叠,合拢n.褶'], ['She folded the letter carefully and put it in the envelope.']],
  ['folk', 'adj.', '民间的n.百姓', '985', ['民间的n.百姓'], ['民间的n.百姓'], ['Students found the topic folk but ultimately rewarding.']],
  ['fond', 'adj.', '喜爱的，宠爱的', '985', ['喜爱的，宠爱的'], ['喜爱的，宠爱的'], ['We need a more fond plan to address this complex issue.']],
  ['fool', 'n.', '傻子vt.欺骗,愚弄', '985', ['傻子vt.欺骗,愚弄'], ['傻子vt.欺骗,愚弄'], ['Researchers have published new findings about fool.']],
  ['foolish', 'adj.', '愚蠢的', '985', ['愚蠢的'], ['愚蠢的'], ['The foolish report highlighted several key issues in the system.']],
  ['forbid', 'vt.', '禁止', '985', ['禁止'], ['禁止'], ['The school forbids students from using phones during class.']],
  ['forecast', 'n.', 'v.预测,预报,预示', '985', ['v.预测,预报,预示'], ['v.预测,预报,预示'], ['Experts forecast steady economic growth for the next decade.']],
  ['forever', 'adv.', '永远,不断地，常常', '985', ['永远,不断地，常常'], ['永远,不断地，常常'], ['The speaker presented the topic forever and engagingly.']],
  ['forgive', 'vt.', '原谅,宽恕', '985', ['原谅,宽恕'], ['原谅,宽恕'], ['She forgave her friend for the mistake and moved on.']],
  ['former', 'adj.', '前者的n.前者', '985', ['前者的n.前者'], ['前者的n.前者'], ['A former diet is essential for maintaining good health.']],
  ['fortnight', 'n.', '两星期,十四天', '985', ['两星期,十四天'], ['两星期,十四天'], ['She wrote a research paper about fortnight last semester.']],
  ['fortunate', 'adj.', '幸运的', '985', ['幸运的'], ['幸运的'], ['We need a more fortunate plan to address this complex issue.']],
  ['fortunately', 'adv.', '幸运地,', '985', ['幸运地,'], ['幸运地,'], ['Fortunately, no one was injured in the minor earthquake.']],
  ['fortune', 'n.', '命运,运气,财富', '985', ['命运,运气,财富'], ['命运,运气,财富'], ['Many exam questions test students\' knowledge of fortune.']],
  ['found', 'vt.', '创立,创办', '985', ['创立,创办'], ['创立,创办'], ['She helped her friend found the challenging math problem.']],
  ['fountain', 'n.', '泉水,喷泉，源泉', '985', ['泉水,喷泉，源泉'], ['泉水,喷泉，源泉'], ['The experiment demonstrates the properties of fountain.']],
  ['freedom', 'n.', '自由', '985', ['自由'], ['自由'], ['The novel uses the theme of freedom throughout the story.']],
  ['frequent', 'adj.', '频繁的', '985', ['频繁的'], ['频繁的'], ['We need a more frequent plan to address this complex issue.']],
  ['frequently', 'adv.', '频繁地', '985', ['频繁地'], ['频繁地'], ['The results frequently reflect the team\'s combined efforts.']],
  ['frighten', 'vt.', '使惊恐,吓唬', '985', ['使惊恐,吓唬'], ['使惊恐,吓唬'], ['The guide began to frighten the history of the ancient city.']],
  ['fry', 'vt.', '油煎,油炸,油炒', '985', ['油煎,油炸,油炒'], ['油煎,油炸,油炒'], ['Many readers fail to fry the hidden message in the passage.']],
  ['fuel', 'n.', '燃料vt.给…加燃料', '985', ['燃料vt.给…加燃料'], ['燃料vt.给…加燃料'], ['She wrote a research paper about fuel last semester.']],
  ['function', 'n.', '功能,职务,函数v.运行，行使职责', '985', ['功能,职务,函数v.'], ['功能,职务,函数v.运行，行使职责'], ['The teacher explained function with real-life examples in class.']],
  ['fur', 'n.', '皮，毛皮', '985', ['皮，毛皮'], ['皮，毛皮'], ['The novel uses the theme of fur throughout the story.']],
  ['further', 'adv.', '进一步地', '985', ['进一步地'], ['进一步地'], ['The students worked further throughout the entire semester.']],
  ['gain', 'vt.', '获得,增加，赚到n.增加，利润，收获', '985', ['获得,增加，赚到n.'], ['获得,增加，赚到n.增加，利润，收获'], ['The team will gain the new strategy starting next quarter.']],
  ['garbage', 'n.', '垃圾,废物', '985', ['垃圾,废物'], ['垃圾,废物'], ['The committee discussed the topic of garbage at length during the meeting.']],
  ['gas', 'n.', '煤气,气体', '985', ['煤气,气体'], ['煤气,气体'], ['The interview covered several topics related to gas.']],
  ['gather', 'vi.', '聚集,集合vt.收集', '985', ['聚集,集合vt.收集'], ['聚集,集合vt.收集'], ['The family gathered around the table for a holiday dinner.']],
  ['gay', 'adj.', '快乐的,艳丽的n.同性恋者', '985', ['快乐的,艳丽的n.同'], ['快乐的,艳丽的n.同性恋者'], ['A gay diet is essential for maintaining good health.']],
  ['generally', 'adv.', '一般地,通常地，普遍地', '985', ['一般地,通常地，普遍'], ['一般地,通常地，普遍地'], ['She remembered the details generally, even after many years.']],
  ['generation', 'n.', '一代,一代人,产生', '985', ['一代,一代人,产生'], ['一代,一代人,产生'], ['The textbook defines generation clearly in chapter three.']],
  ['generous', 'adj.', '慷慨的,宽宏大量的', '985', ['慷慨的,宽宏大量的'], ['慷慨的,宽宏大量的'], ['The author\'s generous style attracted a wide and loyal readership.']],
  ['gentle', 'adj.', '温和的，文雅的', '985', ['温和的，文雅的'], ['温和的，文雅的'], ['The gentle design of the building won several international awards.']],
  ['glance', 'v.', '瞥见n.一瞥', '985', ['瞥见n.一瞥'], ['瞥见n.一瞥'], ['She glanced at her watch and realized she was late.']],
  ['globe', 'n.', '地球,地球仪，球体', '985', ['地球,地球仪，球体'], ['地球,地球仪，球体'], ['The report highlights the significance of globe in education.']],
  ['goal', 'n.', '球门,得分数,目标', '985', ['球门,得分数,目标'], ['球门,得分数,目标'], ['Researchers have published new findings about goal.']],
  ['goods', 'n.', '货物,商品', '985', ['货物,商品'], ['货物,商品'], ['Students often encounter the term "goods" in gaokao reading passages.']],
  ['gradual', 'adj.', '逐渐的,渐进的', '985', ['逐渐的,渐进的'], ['逐渐的,渐进的'], ['The gradual atmosphere in the classroom encouraged open discussion.']],
  ['gradually', 'adv.', '逐渐地，逐步地', '985', ['逐渐地，逐步地'], ['逐渐地，逐步地'], ['The weather gradually improved as the storm moved away.']],
  ['graduate', 'n.', '大学毕业生vi.毕业', '985', ['大学毕业生vi.毕业'], ['大学毕业生vi.毕业'], ['The report highlights the significance of graduate in education.']],
  ['graduation', 'n.', '毕业', '985', ['毕业'], ['毕业'], ['Many exam questions test students\' knowledge of graduation.']],
  ['grain', 'n.', '谷物,颗粒', '985', ['谷物,颗粒'], ['谷物,颗粒'], ['The report highlights the significance of grain in education.']],
  ['grand', 'adj.', '宏伟的,豪华的，极重要的', '985', ['宏伟的,豪华的，极重'], ['宏伟的,豪华的，极重要的'], ['Her grand attitude inspired those around her to do better.']],
  ['grasp', 'vt.', 'n.抓住，领会', '985', ['n.抓住，领会'], ['n.抓住，领会'], ['The student grasped the concept quickly after the explanation.']],
  ['gravity', 'n.', '重力,地心引力,严重性，庄严', '985', ['重力,地心引力,严重'], ['重力,地心引力,严重性，庄严'], ['The teacher explained gravity with real-life examples in class.']],
  ['greatly', 'adv.', '很，大大地，非常地', '985', ['很，大大地，非常地'], ['很，大大地，非常地'], ['The team greatly discussed the issue during the three-hour meeting.']],
  ['greet', 'vt.', '问候,欢迎', '985', ['问候,欢迎'], ['问候,欢迎'], ['The speaker continued to greet the audience with fascinating stories.']],
  ['grey', 'n.', '/a.灰色(的)', '985', ['/a.灰色(的)'], ['/a.灰色(的)'], ['The lecture focused on the role of grey in daily life.']],
  ['grocer', 'n.', '杂货店，食品商', '985', ['杂货店，食品商'], ['杂货店，食品商'], ['The author mentions grocer to support the main argument.']],
  ['grocery', 'n.', '食品杂货店，食品杂货', '985', ['食品杂货店，食品杂货'], ['食品杂货店，食品杂货'], ['Understanding grocery is crucial for grasping the author\'s main message.']],
  ['guide', 'n.', '导游vt.指导', '985', ['导游vt.指导'], ['导游vt.指导'], ['The lecture focused on the role of guide in daily life.']],
  ['guilty', 'adj.', '内疚的,有罪的', '985', ['内疚的,有罪的'], ['内疚的,有罪的'], ['The guilty nature of the problem became clear over time.']],
  ['haircut', 'n.', '理发;发型，发式', '985', ['理发;发型，发式'], ['理发;发型，发式'], ['Understanding haircut is crucial for grasping the author\'s main message.']],
  ['hammer', 'n.', '锤子vt.锤击', '985', ['锤子vt.锤击'], ['锤子vt.锤击'], ['The passage provides a detailed analysis of hammer.']],
  ['handkerchief', 'n.', '手帕', '985', ['手帕'], ['手帕'], ['The committee discussed the topic of handkerchief at length during the meeting.']],
  ['handle', 'n.', '柄,把手vt.处理', '985', ['柄,把手vt.处理'], ['柄,把手vt.处理'], ['She handled the difficult situation with great professionalism.']],
  ['happiness', 'n.', '幸福;满足', '985', ['幸福;满足'], ['幸福;满足'], ['The experiment demonstrates the properties of happiness.']],
  ['harbour', 'n.', '港', '985', ['港'], ['港'], ['The passage provides a detailed analysis of harbour.']],
  ['hard-working', 'adj.', '勤劳', '985', ['勤劳'], ['勤劳'], ['Her hard-working attitude inspired those around her to do better.']],
  ['hardship', 'n.', '艰难,困苦', '985', ['艰难,困苦'], ['艰难,困苦'], ['The survey reveals public attitudes toward hardship.']],
  ['harm', 'n.', '伤害,损害vt.损害', '985', ['伤害,损害vt.损害'], ['伤害,损害vt.损害'], ['Smoking can harm your lungs and overall health.']],
  ['harmony', 'n.', '协调,和谐', '985', ['协调,和谐'], ['协调,和谐'], ['The passage provides a detailed analysis of harmony.']],
  ['harvest', 'n.', '收获,收成vt.收割', '985', ['收获,收成vt.收割'], ['收获,收成vt.收割'], ['Farmers harvest rice in autumn when the grains are ripe.']],
  ['headmaster', 'n.', '英国中小学校长', '985', ['英国中小学校长'], ['英国中小学校长'], ['The documentary explores the history of headmaster in China.']],
  ['hesitate', 'vi.', '犹豫,踌躇', '985', ['犹豫,踌躇'], ['犹豫,踌躇'], ['Do not hesitate to ask if you have any questions.']],
  ['highway', 'n.', '公路,大路', '985', ['公路,大路'], ['公路,大路'], ['The passage provides a detailed analysis of highway.']],
  ['hire', 'vt.', '雇用，租用，出租', '985', ['雇用，租用，出租'], ['雇用，租用，出租'], ['The company hired ten new employees for the summer season.']],
  ['honey', 'n.', '蜜,蜂蜜,甜,甜蜜', '985', ['蜜,蜂蜜,甜,甜蜜'], ['蜜,蜂蜜,甜,甜蜜'], ['The survey reveals public attitudes toward honey.']],
  ['hopeless', 'adj.', '没有希望的,绝望的', '985', ['没有希望的,绝望的'], ['没有希望的,绝望的'], ['The hopeless changes in the climate worry many scientists worldwide.']],
  ['horrible', 'adj.', '可怕的,极可厌的', '985', ['可怕的,极可厌的'], ['可怕的,极可厌的'], ['His horrible response showed great maturity and wisdom.']],
  ['host', 'n.', '主人,主持人v.主持，做主人', '985', ['主人,主持人v.主持'], ['主人,主持人v.主持，做主人'], ['The experiment demonstrates the properties of host.']],
  ['housewife', 'n.', '家庭主妇', '985', ['家庭主妇'], ['家庭主妇'], ['Knowing housewife well gives students confidence in exams.']],
  ['humour', 'n.', '幽默，诙谐v.迁就?', '985', ['幽默，诙谐v.迁就?'], ['幽默，诙谐v.迁就?'], ['Many exam questions test students\' knowledge of humour.']],
  ['hunger', 'n.', '饥饿,渴望', '985', ['饥饿,渴望'], ['饥饿,渴望'], ['The experiment demonstrates the properties of hunger.']],
  ['hunt', 'n.', 'vt.打猎,搜寻', '985', ['vt.打猎,搜寻'], ['vt.打猎,搜寻'], ['In ancient times, people hunted wild animals for food.']],
  ['identity', 'n.', '身份,一致vt.确定身份', '985', ['身份,一致vt.确定'], ['身份,一致vt.确定身份'], ['Please show your identity card before entering the building.']],
  ['ignore', 'vt.', '不理睬,忽视', '985', ['不理睬,忽视'], ['不理睬,忽视'], ['We should not ignore the warnings about climate change.']],
  ['illegal', 'adj.', '非法的', '985', ['非法的'], ['非法的'], ['It is illegal to drive through a red traffic light.']],
  ['immediate', 'adj.', '立即的,直接的', '985', ['立即的,直接的'], ['立即的,直接的'], ['The patient needs immediate medical attention after the injury.']],
  ['immigrate', 'v.', '移民', '985', ['移民'], ['移民'], ['She tried to immigrate the problem from different angles.']],
  ['import', 'vt.', 'n.输入,进口', '985', ['n.输入,进口'], ['n.输入,进口'], ['Parents should import their children to develop good study habits.']],
  ['importance', 'n.', '重要性', '985', ['重要性'], ['重要性'], ['The importance of education cannot be overstated.']],
  ['impress', 'vt.', '给…深刻印象', '985', ['给…深刻印象'], ['给…深刻印象'], ['You need to impress the situation before making a final decision.']],
  ['income', 'n.', '收入,收益', '985', ['收入,收益'], ['收入,收益'], ['Her monthly income barely covers the rent and groceries.']],
  ['indeed', 'adv.', '真正地,确实', '985', ['真正地,确实'], ['真正地,确实'], ['The exam was, indeed, more difficult than we had anticipated.']],
  ['independent', 'adj.', '独立的,自主的', '985', ['独立的,自主的'], ['独立的,自主的'], ['She became financially independent at the age of twenty.']],
  ['indicate', 'vt.', '暗示,表明', '985', ['暗示,表明'], ['暗示,表明'], ['The survey results indicate a growing concern about air quality.']],
  ['infer', 'vt.', '推论,推断', '985', ['推论,推断'], ['推论,推断'], ['From his tone, we can infer that he is not satisfied with the result.']],
  ['inform', 'vt.', '通知,告知', '985', ['通知,告知'], ['通知,告知'], ['Please inform the teacher if you cannot attend the class.']],
  ['innocent', 'adj.', '清白的,无辜的，天真的', '985', ['清白的,无辜的，天真'], ['清白的,无辜的，天真的'], ['The lawyer proved that his client was innocent of all charges.']],
  ['insect', 'n.', '昆虫', '985', ['昆虫'], ['昆虫'], ['The boy observed the insect carefully under a magnifying glass.']],
  ['insert', 'vt.', '插入,嵌入', '985', ['插入,嵌入'], ['插入,嵌入'], ['The students must insert the passage before answering the questions.']],
  ['inspire', 'vt.', '鼓舞,给…以灵感', '985', ['鼓舞,给…以灵感'], ['鼓舞,给…以灵感'], ['The teacher\'s words inspired the students to work harder.']],
  ['instant', 'n.', '瞬间a.立即的', '985', ['瞬间a.立即的'], ['瞬间a.立即的'], ['The novel uses the theme of instant throughout the story.']],
  ['institute', 'n.', '研究所,学院', '985', ['研究所,学院'], ['研究所,学院'], ['He works at a research institute focused on renewable energy.']],
  ['instrument', 'n.', '工具,乐器', '985', ['工具,乐器'], ['工具,乐器'], ['She learned to play three different musical instruments.']],
  ['insurance', 'n.', '保险,保险费', '985', ['保险,保险费'], ['保险,保险费'], ['All employees are required to have health insurance.']],
  ['intelligence', 'n.', '智力,理解力,情报工作，情报机关', '985', ['智力,理解力,情报工'], ['智力,理解力,情报工作，情报机关'], ['Artificial intelligence is transforming the way we live and work.']],
  ['intend', 'vt.', '想要,打算,意指', '985', ['想要,打算,意指'], ['想要,打算,意指'], ['I intend to apply for a scholarship to study abroad next year.']],
  ['interpret', 'vt.', '说明,口译，解释', '985', ['说明,口译，解释'], ['说明,口译，解释'], ['The guide interpreted the ancient paintings for the tourists.']],
  ['interpreter', 'n.', '解释者，口译者，注释器', '985', ['解释者，口译者，注释'], ['解释者，口译者，注释器'], ['She wrote a research paper about interpreter last semester.']],
  ['interrupt', 'vt.', '打断,中止', '985', ['打断,中止'], ['打断,中止'], ['Please do not interrupt the speaker during the presentation.']],
  ['jam', 'n.', '果酱，拥挤，困境', '985', ['果酱，拥挤，困境'], ['果酱，拥挤，困境'], ['I spread strawberry jam on my toast every morning.']],
  ['jar', 'n.', '罐子,坛子,广口瓶', '985', ['罐子,坛子,广口瓶'], ['罐子,坛子,广口瓶'], ['The cookie jar was empty; someone had eaten them all.']],
  ['jazz', 'n.', '爵士音乐,爵士舞曲', '985', ['爵士音乐,爵士舞曲'], ['爵士音乐,爵士舞曲'], ['Jazz music originated in the African American communities of New Orleans.']],
  ['journalist', 'n.', '记者,新闻工作者', '985', ['记者,新闻工作者'], ['记者,新闻工作者'], ['Many exam questions test students\' knowledge of journalist.']],
  ['journey', 'n.', '旅行,旅程', '985', ['旅行,旅程'], ['旅行,旅程'], ['The journey from Beijing to Shanghai takes about five hours by train.']],
  ['judge', 'n.', '法官,裁判员v.审判，判断', '985', ['法官,裁判员v.审判'], ['法官,裁判员v.审判，判断'], ['Do not judge a person by their appearance alone.']],
  ['jungle', 'n.', '丛林,密林', '985', ['丛林,密林'], ['丛林,密林'], ['Researchers have published new findings about jungle.']],
  ['junior', 'adj.', '年少的,下级的n.年少者，晚辈，地位较低者', '985', ['年少的,下级的n.年'], ['年少的,下级的n.年少者，晚辈，地位较低者'], ['Maintaining a junior lifestyle requires discipline and consistent effort.']],
  ['justice', 'n.', '正义,公正,司法', '985', ['正义,公正,司法'], ['正义,公正,司法'], ['Everyone deserves to be treated with justice and fairness.']],
  ['kindergarten', 'n.', '幼儿园', '985', ['幼儿园'], ['幼儿园'], ['She wrote a research paper about kindergarten last semester.']],
  ['lack', 'vt.', '缺乏,不足n.短缺的东西', '985', ['缺乏,不足n.短缺的'], ['缺乏,不足n.短缺的东西'], ['Many students lack confidence when speaking in front of others.']],
  ['ladder', 'n.', '梯子', '985', ['梯子'], ['梯子'], ['Knowing ladder well gives students confidence in exams.']],
  ['lately', 'adv.', '最近', '985', ['最近'], ['最近'], ['He answered the question lately, showing thorough preparation.']],
  ['later', 'adv.', '后来', '985', ['后来'], ['后来'], ['The speaker presented the topic later and engagingly.']],
  ['latter', 'adj.', '(两者中)后者的', '985', ['(两者中)后者的'], ['(两者中)后者的'], ['The book provides a latter analysis of the topic.']],
  ['lawyer', 'n.', '律师', '985', ['律师'], ['律师'], ['She wrote a research paper about lawyer last semester.']],
  ['league', 'n.', '同盟,联盟', '985', ['同盟,联盟'], ['同盟,联盟'], ['The experiment demonstrates the properties of league.']],
  ['leak', 'vi.', '漏;泄露n.漏洞', '985', ['漏;泄露n.漏洞'], ['漏;泄露n.漏洞'], ['She was the first to leak the error in the report.']],
  ['lecture', 'vi.', '演讲;讲课n.演讲;讲课', '985', ['演讲;讲课n.演讲;'], ['演讲;讲课n.演讲;讲课'], ['The professor delivered a fascinating lecture on quantum physics.']],
  ['legal', 'adj.', '合法的', '985', ['合法的'], ['合法的'], ['The situation turned out to be more legal than we had expected.']],
  ['length', 'n.', '长度', '985', ['长度'], ['长度'], ['The novel uses the theme of length throughout the story.']],
  ['less', 'adj.', '更少的ad.更少地', '985', ['更少的ad.更少地'], ['更少的ad.更少地'], ['She remained less despite the difficulties she faced.']],
  ['liberate', 'vt.', '解放,释放', '985', ['解放,释放'], ['解放,释放'], ['The author attempts to liberate readers\' attention to this issue.']],
  ['librarian', 'n.', '图书馆馆员', '985', ['图书馆馆员'], ['图书馆馆员'], ['The documentary explores the history of librarian in China.']],
  ['lifetime', 'n.', '终身', '985', ['终身'], ['终身'], ['The textbook defines lifetime clearly in chapter three.']],
  ['lightning', 'n.', '闪电', '985', ['闪电'], ['闪电'], ['The essay examines how lightning shapes our decisions.']],
  ['likely', 'adj.', '可能的ad.很可能', '985', ['可能的ad.很可能'], ['可能的ad.很可能'], ['The likely changes in the climate worry many scientists worldwide.']],
  ['limit', 'vt.', '限制,限定n.限度,限制', '985', ['限制,限定n.限度,'], ['限制,限定n.限度,限制'], ['The school limits the number of students in each class.']],
  ['link', 'vt.', '连接，联系n.联系', '985', ['连接，联系n.联系'], ['连接，联系n.联系'], ['The bridge links the island to the mainland.']],
  ['lip', 'n.', '嘴唇', '985', ['嘴唇'], ['嘴唇'], ['The report highlights the significance of lip in education.']],
  ['liquid', 'n.', '液体a.液体的,流动的', '985', ['液体a.液体的,流动'], ['液体a.液体的,流动的'], ['The novel uses the theme of liquid throughout the story.']],
  ['literature', 'n.', '文学(作品)', '985', ['文学(作品)'], ['文学(作品)'], ['The experiment demonstrates the properties of literature.']],
  ['litre', 'n.', '公升', '985', ['公升'], ['公升'], ['The teacher explained litre with real-life examples in class.']],
  ['living-room', 'n.', '起居室', '985', ['起居室'], ['起居室'], ['The experiment demonstrates the properties of living-room.']],
  ['load', 'vt.', '装,装满n.负载;负担', '985', ['装,装满n.负载;负'], ['装,装满n.负载;负担'], ['The author attempts to load readers\' attention to this issue.']],
  ['loaf', 'n.', '一条面包', '985', ['一条面包'], ['一条面包'], ['The documentary explores the history of loaf in China.']],
  ['local', 'adj.', '当地的，局部的n.当地居民，局部', '985', ['当地的，局部的n.当'], ['当地的，局部的n.当地居民，局部'], ['Her local attitude inspired those around her to do better.']],
  ['loose', 'adj.', '宽松的;自由的', '985', ['宽松的;自由的'], ['宽松的;自由的'], ['The loose atmosphere in the classroom encouraged open discussion.']],
  ['lorry', 'n.', '卡车', '985', ['卡车'], ['卡车'], ['The teacher explained lorry with real-life examples in class.']],
  ['loss', 'n.', '遗失;失败，损失', '985', ['遗失;失败，损失'], ['遗失;失败，损失'], ['The committee discussed the topic of loss at length during the meeting.']],
  ['luggage', 'n.', '行李,皮箱', '985', ['行李,皮箱'], ['行李,皮箱'], ['Please make sure your luggage is properly labeled before check-in.']],
  ['lung', 'n.', '肺', '985', ['肺'], ['肺'], ['Knowing lung well gives students confidence in exams.']],
  ['mailbox', 'n.', '邮箱', '985', ['邮箱'], ['邮箱'], ['Knowing mailbox well gives students confidence in exams.']],
  ['major', 'vi.', '主修，专攻a.主要的,多数的，主要的n.主修', '985', ['主修，专攻a.主要的'], ['主修，专攻a.主要的,多数的，主要的n.主修'], ['The teacher asked us to major the main idea of the text.']],
  ['majority', 'n.', '多数', '985', ['多数'], ['多数'], ['The majority of students voted in favor of the new policy.']],
  ['male', 'adj.', '男的,雄的n.男人，雄性动物', '985', ['男的,雄的n.男人，'], ['男的,雄的n.男人，雄性动物'], ['Maintaining a male lifestyle requires discipline and consistent effort.']],
  ['mankind', 'n.', '人类', '985', ['人类'], ['人类'], ['The committee discussed the topic of mankind at length during the meeting.']],
  ['manner', 'n.', '方式,态度;礼貌', '985', ['方式,态度;礼貌'], ['方式,态度;礼貌'], ['The lecture focused on the role of manner in daily life.']],
  ['march', 'n.', '三月', '985', ['三月'], ['三月'], ['Researchers have published new findings about march.']],
  ['mass', 'n.', '大量，群众，块，团', '985', ['大量，群众，块，团'], ['大量，群众，块，团'], ['The lecture focused on the role of mass in daily life.']],
  ['material', 'n.', '材料,原料;素材a.物质的', '985', ['材料,原料;素材a.'], ['材料,原料;素材a.物质的'], ['The recycling center processes various types of material.']],
  ['mathematics', 'n.', '数学', '985', ['数学'], ['数学'], ['The documentary explores the history of mathematics in China.']],
  ['matter', 'n.', '事情;物质vi.要紧，有关系', '985', ['事情;物质vi.要紧'], ['事情;物质vi.要紧，有关系'], ['It does not matter how slowly you go, as long as you do not stop.']],
  ['maximum', 'n.', '最大量a.最大的', '985', ['最大量a.最大的'], ['最大量a.最大的'], ['The lecture focused on the role of maximum in daily life.']],
  ['means', 'n.', '方法,手段', '985', ['方法,手段'], ['方法,手段'], ['The report highlights the significance of means in education.']],
  ['meanwhile', 'adv.', '与此同时', '985', ['与此同时'], ['与此同时'], ['She remembered the details meanwhile, even after many years.']],
  ['measure', 'vt.', '测量n.测量，尺寸，措施，程度', '985', ['测量n.测量，尺寸，'], ['测量n.测量，尺寸，措施，程度'], ['The government took strict measures to prevent the spread of the disease.']],
  ['medal', 'n.', '奖章,纪念章', '985', ['奖章,纪念章'], ['奖章,纪念章'], ['Knowing medal well gives students confidence in exams.']],
  ['media', 'n.', '媒体', '985', ['媒体'], ['媒体'], ['The novel uses the theme of media throughout the story.']],
  ['mental', 'adj.', '智力的;精神的', '985', ['智力的;精神的'], ['智力的;精神的'], ['Regular exercise benefits both physical and mental health.']],
  ['menu', 'n.', '菜单', '985', ['菜单'], ['菜单'], ['The textbook defines menu clearly in chapter three.']],
  ['merchant', 'n.', '商人', '985', ['商人'], ['商人'], ['The article discusses the impact of merchant on modern society.']],
  ['mercy', 'n.', '仁慈', '985', ['仁慈'], ['仁慈'], ['Students often encounter the term "mercy" in gaokao reading passages.']],
  ['merely', 'adv.', '仅仅,只不过', '985', ['仅仅,只不过'], ['仅仅,只不过'], ['The team merely discussed the issue during the three-hour meeting.']],
  ['merry', 'adj.', '欢乐的,愉快的', '985', ['欢乐的,愉快的'], ['欢乐的,愉快的'], ['The findings have merry implications for future research.']],
  ['midday', 'n.', '中午', '985', ['中午'], ['中午'], ['Understanding midday is crucial for grasping the author\'s main message.']],
  ['midnight', 'n.', '午夜', '985', ['午夜'], ['午夜'], ['The interview covered several topics related to midnight.']],
  ['mild', 'adj.', '温和的，文雅的', '985', ['温和的，文雅的'], ['温和的，文雅的'], ['The mild changes in the climate worry many scientists worldwide.']],
  ['million', '待标注', 'num.百万', '985', ['num.百万'], ['num.百万'], ['The exam often tests the usage of "million" in reading comprehension.']],
  ['mine', 'pron.', '我的n.矿，矿山;地雷，水雷vt.开采', '985', ['我的n.矿，矿山;地'], ['我的n.矿，矿山;地雷，水雷vt.开采'], ['The report highlights the significance of mine in education.']],
  ['mineral', 'n.', '矿物a.矿物的', '985', ['矿物a.矿物的'], ['矿物a.矿物的'], ['Many exam questions test students\' knowledge of mineral.']],
  ['minimum', 'n.', '最小量a.最小的', '985', ['最小量a.最小的'], ['最小量a.最小的'], ['The textbook defines minimum clearly in chapter three.']],
  ['minister', 'n.', '部长,大臣', '985', ['部长,大臣'], ['部长,大臣'], ['The survey reveals public attitudes toward minister.']],
  ['minority', 'n.', '少数派;少数民族', '985', ['少数派;少数民族'], ['少数派;少数民族'], ['Knowing minority well gives students confidence in exams.']],
  ['miserable', 'adj.', '痛苦的,悲惨的', '985', ['痛苦的,悲惨的'], ['痛苦的,悲惨的'], ['The author\'s miserable style attracted a wide and loyal readership.']],
  ['misunderstand', 'vt.', '误解,误会', '985', ['误解,误会'], ['误解,误会'], ['The team will misunderstand the new strategy starting next quarter.']],
  ['mix', 'vt.', '使混合;混淆', '985', ['使混合;混淆'], ['使混合;混淆'], ['Mix the flour and eggs together to make the cake batter.']],
  ['mobile', 'adj.', '运动的,移动的', '985', ['运动的,移动的'], ['运动的,移动的'], ['The mobile approach helped students learn more effectively.']],
  ['modest', 'adj.', '谦虚的', '985', ['谦虚的'], ['谦虚的'], ['His modest response showed great maturity and wisdom.']],
  ['moral', 'adj.', '合乎道德的n.道德,品行', '985', ['合乎道德的n.道德,'], ['合乎道德的n.道德,品行'], ['The author\'s moral style attracted a wide and loyal readership.']],
  ['motor', 'n.', '发动机,机动车', '985', ['发动机,机动车'], ['发动机,机动车'], ['The boat\'s motor broke down in the middle of the lake.']],
  ['mountainous', 'adj.', '多山的', '985', ['多山的'], ['多山的'], ['She remained mountainous despite the difficulties she faced.']],
  ['mourn', 'vi.', '哀痛,哀悼', '985', ['哀痛,哀悼'], ['哀痛,哀悼'], ['You need to mourn the situation before making a final decision.']],
  ['movement', 'n.', '动作;活动;移动', '985', ['动作;活动;移动'], ['动作;活动;移动'], ['The civil rights movement brought about significant social change.']],
  ['multiply', 'vt.', '增加，繁殖，乘', '985', ['增加，繁殖，乘'], ['增加，繁殖，乘'], ['If you multiply three by four, you get twelve.']],
  ['musical', 'adj.', '音乐的', '985', ['音乐的'], ['音乐的'], ['Maintaining a musical lifestyle requires discipline and consistent effort.']],
  ['nail', 'n.', '钉子;指甲vt.钉', '985', ['钉子;指甲vt.钉'], ['钉子;指甲vt.钉'], ['The passage provides a detailed analysis of nail.']],
  ['nation', 'n.', '民族,国家', '985', ['民族,国家'], ['民族,国家'], ['The entire nation mourned the loss of its beloved leader.']],
  ['nationality', 'n.', '国籍，民族', '985', ['国籍，民族'], ['国籍，民族'], ['The committee discussed the topic of nationality at length during the meeting.']],
  ['native', 'adj.', '本土的n.本地人', '985', ['本土的n.本地人'], ['本土的n.本地人'], ['A native diet is essential for maintaining good health.']],
  ['navy', 'n.', '海军', '985', ['海军'], ['海军'], ['Many exam questions test students\' knowledge of navy.']],
  ['neat', 'adj.', '整洁的;简洁的', '985', ['整洁的;简洁的'], ['整洁的;简洁的'], ['The neat design of the building won several international awards.']],
  ['needle', 'n.', '针vt.缝补,编织', '985', ['针vt.缝补,编织'], ['针vt.缝补,编织'], ['The essay examines how needle shapes our decisions.']],
  ['nephew', 'n.', '侄子,外甥', '985', ['侄子,外甥'], ['侄子,外甥'], ['The textbook defines nephew clearly in chapter three.']],
  ['nest', 'n.', '巢,窝', '985', ['巢,窝'], ['巢,窝'], ['The novel uses the theme of nest throughout the story.']],
  ['niece', 'n.', '侄女,外甥女', '985', ['侄女,外甥女'], ['侄女,外甥女'], ['Researchers have published new findings about niece.']],
  ['noble', 'adj.', '高尚的n.贵族', '985', ['高尚的n.贵族'], ['高尚的n.贵族'], ['Maintaining a noble lifestyle requires discipline and consistent effort.']],
  ['noisy', 'adj.', '嘈杂的,喧闹的', '985', ['嘈杂的,喧闹的'], ['嘈杂的,喧闹的'], ['The noisy changes in the climate worry many scientists worldwide.']],
  ['novel', 'n.', '小说a.新奇的，新颖的', '985', ['小说a.新奇的，新颖'], ['小说a.新奇的，新颖的'], ['The teacher explained novel with real-life examples in class.']],
  ['nowadays', 'adv.', '现今,现在n.现今，当今', '985', ['现今,现在n.现今，'], ['现今,现在n.现今，当今'], ['The situation developed nowadays over the following weeks.']],
  ['nowhere', 'adv.', '任何地方都不', '985', ['任何地方都不'], ['任何地方都不'], ['He worked nowhere to meet the challenging deadline.']],
  ['nuclear', 'adj.', '原子核的;核心的', '985', ['原子核的;核心的'], ['原子核的;核心的'], ['The nuclear nature of the problem became clear over time.']],
  ['nut', 'n.', '坚果', '985', ['坚果'], ['坚果'], ['Understanding nut is crucial for grasping the author\'s main message.']],
  ['nutrition', 'n.', '营养', '985', ['营养'], ['营养'], ['Proper nutrition is essential for growing children.']],
  ['obey', 'vt.', '顺从vi.服从', '985', ['顺从vi.服从'], ['顺从vi.服从'], ['All citizens must obey the law of the country.']],
  ['observe', 'vt.', '观察,遵守', '985', ['观察,遵守'], ['观察,遵守'], ['Scientists observe the stars using powerful telescopes.']],
  ['obtain', 'vt.', '获得', '985', ['获得'], ['获得'], ['You can obtain the application form from the school office.']],
  ['obvious', 'adj.', '显而易见的', '985', ['显而易见的'], ['显而易见的'], ['It is obvious that he has been practicing piano for years.']],
  ['occupation', 'n.', '占领,占据;职业，工作', '985', ['占领,占据;职业，工'], ['占领,占据;职业，工作'], ['The committee discussed the topic of occupation at length during the meeting.']],
  ['occupy', 'vt.', '占领,占有;使忙碌', '985', ['占领,占有;使忙碌'], ['占领,占有;使忙碌'], ['She helped her friend occupy the challenging math problem.']],
  ['occur', 'vi.', '发生，突然想起', '985', ['发生，突然想起'], ['发生，突然想起'], ['Earthquakes often occur along fault lines in the earth\'s crust.']],
  ['official', 'adj.', '官方的，正式的n.官员，行政人员', '985', ['官方的，正式的n.官'], ['官方的，正式的n.官员，行政人员'], ['The situation turned out to be more official than we had expected.']],
  ['onto', 'prep.', '到…上', '985', ['到…上'], ['到…上'], ['The store is open onto nine in the morning until evening.']],
  ['opera', 'n.', '歌剧，歌剧团，歌剧院', '985', ['歌剧，歌剧团，歌剧院'], ['歌剧，歌剧团，歌剧院'], ['The survey reveals public attitudes toward opera.']],
  ['operate', 'vi.', '操作;施行手术', '985', ['操作;施行手术'], ['操作;施行手术'], ['The surgeon will operate on the patient tomorrow morning.']],
  ['opinion', 'n.', '意见,看法', '985', ['意见,看法'], ['意见,看法'], ['Everyone is entitled to express their own opinion freely.']],
  ['oppose', 'vt.', '反对,反抗', '985', ['反对,反抗'], ['反对,反抗'], ['Parents should oppose their children to develop good study habits.']],
  ['opposite', 'adj.', '对面的，相反的，对立的n.对立面，反义词', '985', ['对面的，相反的，对立'], ['对面的，相反的，对立的n.对立面，反义词'], ['The opposite atmosphere in the classroom encouraged open discussion.']],
  ['optimistic', 'adj.', '乐观的', '985', ['乐观的'], ['乐观的'], ['The author\'s optimistic style attracted a wide and loyal readership.']],
  ['oral', 'adj.', '口头的', '985', ['口头的'], ['口头的'], ['Her oral attitude inspired those around her to do better.']],
  ['orbit', 'n.', '运行轨道vt.环绕', '985', ['运行轨道vt.环绕'], ['运行轨道vt.环绕'], ['The experiment demonstrates the properties of orbit.']],
  ['ordinary', 'adj.', '普通的,平凡的', '985', ['普通的,平凡的'], ['普通的,平凡的'], ['The ordinary approach helped students learn more effectively.']],
  ['organize', 'vt.', '组织，安排;筹办', '985', ['组织，安排;筹办'], ['组织，安排;筹办'], ['The students organized a charity event to raise funds.']],
  ['original', 'adj.', '最初的;新颖的n.创新', '985', ['最初的;新颖的n.创'], ['最初的;新颖的n.创新'], ['The original painting is displayed in the national museum.']],
  ['otherwise', 'adv.', '另外,要不然', '985', ['另外,要不然'], ['另外,要不然'], ['You must study hard; otherwise, you will not pass the exam.']],
  ['ought', '待标注', 'aux.应该', '985', ['aux.应该'], ['aux.应该'], ['The passage uses "ought" to convey a specific and nuanced meaning.']],
  ['outdoor', 'adj.', '/ad.户外的，野外的', '985', ['/ad.户外的，野外'], ['/ad.户外的，野外的'], ['The outdoor approach helped students learn more effectively.']],
  ['outdoors', 'adv.', '在户外n.户外', '985', ['在户外n.户外'], ['在户外n.户外'], ['The report outdoors summarizes the achievements of the past year.']],
  ['outer', 'adj.', '外部的,外面的', '985', ['外部的,外面的'], ['外部的,外面的'], ['Students found the topic outer but ultimately rewarding.']],
  ['outline', 'n.', '轮廓;大纲', '985', ['轮廓;大纲'], ['轮廓;大纲'], ['Knowing outline well gives students confidence in exams.']],
  ['outstanding', 'adj.', '突出的,杰出的', '985', ['突出的,杰出的'], ['突出的,杰出的'], ['The teacher was impressed by her outstanding performance in class.']],
  ['overcome', 'vt.', '战胜,克服', '985', ['战胜,克服'], ['战胜,克服'], ['She overcame her fear of public speaking through constant practice.']],
  ['owe', 'vt.', '欠，归功于', '985', ['欠，归功于'], ['欠，归功于'], ['The experiment shows how plants owe sunlight for growth.']],
  ['ox', 'n.', '公牛', '985', ['公牛'], ['公牛'], ['The essay examines how ox shapes our decisions.']],
  ['oxygen', 'n.', '氧，氧气', '985', ['氧，氧气'], ['氧，氧气'], ['Many exam questions test students\' knowledge of oxygen.']],
  ['pack', 'vt.', '捆扎，打包;挤满n.包裹，背包', '985', ['捆扎，打包;挤满n.'], ['捆扎，打包;挤满n.包裹，背包'], ['We packed our bags the night before the trip.']],
  ['packet', 'n.', '小包，口袋', '985', ['小包，口袋'], ['小包，口袋'], ['The article discusses the impact of packet on modern society.']],
  ['pain', 'n.', '痛苦，疼痛，努力', '985', ['痛苦，疼痛，努力'], ['痛苦，疼痛，努力'], ['Many exam questions test students\' knowledge of pain.']],
  ['painful', 'adj.', '痛苦的', '985', ['痛苦的'], ['痛苦的'], ['Her painful attitude inspired those around her to do better.']],
  ['painting', 'n.', '油画;绘画', '985', ['油画;绘画'], ['油画;绘画'], ['Understanding painting is crucial for grasping the author\'s main message.']],
  ['pan', 'n.', '平底锅', '985', ['平底锅'], ['平底锅'], ['The teacher explained pan with real-life examples in class.']],
  ['panic', 'n.', '恐慌,惊慌', '985', ['恐慌,惊慌'], ['恐慌,惊慌'], ['The survey reveals public attitudes toward panic.']],
  ['paragraph', 'n.', '(文章的)段,节', '985', ['(文章的)段,节'], ['(文章的)段,节'], ['The survey reveals public attitudes toward paragraph.']],
  ['parcel', 'n.', '包裹,邮包', '985', ['包裹,邮包'], ['包裹,邮包'], ['The survey reveals public attitudes toward parcel.']],
  ['parrot', 'n.', '鹦鹉', '985', ['鹦鹉'], ['鹦鹉'], ['The passage provides a detailed analysis of parrot.']],
  ['participate', 'vi.', '参与,参加', '985', ['参与,参加'], ['参与,参加'], ['All students are encouraged to participate in extracurricular activities.']],
  ['particular', 'adj.', '特殊的,特定的', '985', ['特殊的,特定的'], ['特殊的,特定的'], ['Is there any particular reason why you chose this topic?']],
  ['partly', 'adv.', '部分地', '985', ['部分地'], ['部分地'], ['partly, the experiment confirmed the theoretical hypothesis.']],
  ['partner', 'n.', '伙伴,搭挡，合伙人;配偶', '985', ['伙伴,搭挡，合伙人;'], ['伙伴,搭挡，合伙人;配偶'], ['The teacher explained partner with real-life examples in class.']],
  ['passer-by', 'n.', '过路人', '985', ['过路人'], ['过路人'], ['Knowing passer-by well gives students confidence in exams.']],
  ['passive', 'adj.', '被动的,消极的', '985', ['被动的,消极的'], ['被动的,消极的'], ['The passive nature of the problem became clear over time.']],
  ['pattern', 'n.', '式样,模型，图案', '985', ['式样,模型，图案'], ['式样,模型，图案'], ['The weather follows a predictable pattern throughout the year.']],
  ['pause', 'n.', '中止vi.中止,暂停', '985', ['中止vi.中止,暂停'], ['中止vi.中止,暂停'], ['The speaker paused for a moment to let the audience think.']],
  ['peaceful', 'adj.', '和平的;平静的', '985', ['和平的;平静的'], ['和平的;平静的'], ['The novel tells a peaceful story about personal growth and resilience.']],
  ['pence', 'n.', '便士；penny的复数', '985', ['便士；penny的复数'], ['便士；penny的复数'], ['Knowing pence well gives students confidence in exams.']],
  ['per', 'prep.', '每，每一', '985', ['每，每一'], ['每，每一'], ['Students should remain per the classroom during the break.']],
  ['perform', 'vt.', '执行，表演，表现', '985', ['执行，表演，表现'], ['执行，表演，表现'], ['The band will perform at the school\'s annual talent show.']],
  ['performance', 'n.', '履行;表演;表现', '985', ['履行;表演;表现'], ['履行;表演;表现'], ['The novel uses the theme of performance throughout the story.']],
  ['permit', 'vt.', '允许n.执照，许可证', '985', ['允许n.执照，许可证'], ['允许n.执照，许可证'], ['The school does not permit students to leave during lunch.']],
  ['persuade', 'vt.', '说服', '985', ['说服'], ['说服'], ['He persuaded his friend to join the volunteer program.']],
  ['petrol', 'n.', '汽油', '985', ['汽油'], ['汽油'], ['The report highlights the significance of petrol in education.']],
  ['phenomenon', 'n.', '现象', '985', ['现象'], ['现象'], ['The northern lights are a natural phenomenon that attracts many tourists.']],
  ['phrase', 'n.', '短语,习惯用语', '985', ['短语,习惯用语'], ['短语,习惯用语'], ['The teacher explained phrase with real-life examples in class.']],
  ['pile', 'n.', '堆vt.堆积', '985', ['堆vt.堆积'], ['堆vt.堆积'], ['The report highlights the significance of pile in education.']],
  ['pill', 'n.', '药丸', '985', ['药丸'], ['药丸'], ['The author mentions pill to support the main argument.']],
  ['pillow', 'n.', '枕头', '985', ['枕头'], ['枕头'], ['The essay examines how pillow shapes our decisions.']],
  ['pin', 'n.', '别针，钉子vt.钉住', '985', ['别针，钉子vt.钉住'], ['别针，钉子vt.钉住'], ['The textbook defines pin clearly in chapter three.']],
  ['pipe', 'vt.', '用管道输送n.管子,导管;烟斗', '985', ['用管道输送n.管子,'], ['用管道输送n.管子,导管;烟斗'], ['The government plans to pipe the policy nationwide next year.']],
  ['platform', 'n.', '站台,讲台，平台', '985', ['站台,讲台，平台'], ['站台,讲台，平台'], ['Researchers have published new findings about platform.']],
  ['player', 'n.', '表演者,运动员，比赛者，游戏者', '985', ['表演者,运动员，比赛'], ['表演者,运动员，比赛者，游戏者'], ['Many exam questions test students\' knowledge of player.']],
  ['playmate', 'n.', '玩伴,游伴', '985', ['玩伴,游伴'], ['玩伴,游伴'], ['Knowing playmate well gives students confidence in exams.']],
  ['pleased', 'adj.', '高兴的', '985', ['高兴的'], ['高兴的'], ['She remained pleased despite the difficulties she faced.']],
  ['plough', 'n.', '犁vt.犁,耕', '985', ['犁vt.犁,耕'], ['犁vt.犁,耕'], ['The novel uses the theme of plough throughout the story.']],
  ['poet', 'n.', '诗人', '985', ['诗人'], ['诗人'], ['Li Bai was one of the greatest poets in Chinese history.']],
  ['poison', 'n.', '毒药vt.毒害;投毒', '985', ['毒药vt.毒害;投毒'], ['毒药vt.毒害;投毒'], ['The teacher explained poison with real-life examples in class.']],
  ['pole', 'n.', '杆,柱', '985', ['杆,柱'], ['杆,柱'], ['The flag flew proudly at the top of the tall pole.']],
  ['policy', 'n.', '政策,方针', '985', ['政策,方针'], ['政策,方针'], ['The new school policy requires students to wear uniforms.']],
  ['political', 'adj.', '政治上的', '985', ['政治上的'], ['政治上的'], ['The political debate attracted a large television audience last night.']],
  ['politics', 'n.', '政治', '985', ['政治'], ['政治'], ['The article discusses the impact of politics on modern society.']],
  ['pollution', 'n.', '污染', '985', ['污染'], ['污染'], ['The passage provides a detailed analysis of pollution.']],
  ['port', 'n.', '港口', '985', ['港口'], ['港口'], ['Shanghai is one of the busiest ports in the world.']],
  ['positive', 'adj.', '积极的，肯定的，阳性的', '985', ['积极的，肯定的，阳性'], ['积极的，肯定的，阳性的'], ['Maintaining a positive attitude can help you overcome difficulties.']],
  ['possession', 'n.', '拥有，财产', '985', ['拥有，财产'], ['拥有，财产'], ['The textbook defines possession clearly in chapter three.']],
  ['possibly', 'adv.', '可能地,也许', '985', ['可能地,也许'], ['可能地,也许'], ['She could possibly have forgotten about the meeting this morning.']],
  ['postcode', 'n.', '邮递区号', '985', ['邮递区号'], ['邮递区号'], ['Please write your postcode clearly on the envelope.']],
  ['pot', 'n.', '锅，壶，罐', '985', ['锅，壶，罐'], ['锅，壶，罐'], ['She boiled water in a small pot to make tea.']],
  ['potential', 'adj.', '潜在的n.潜能', '985', ['潜在的n.潜能'], ['潜在的n.潜能'], ['Every student has the potential to succeed with the right guidance.']],
  ['pour', 'vt.', '倾泻，倒，灌，注，倾吐vi.倾泻，流出，骤雨', '985', ['倾泻，倒，灌，注，倾'], ['倾泻，倒，灌，注，倾吐vi.倾泻，流出，骤雨'], ['She poured a cup of tea for her guest with a warm smile.']],
  ['powder', 'n.', '粉，粉末，火药', '985', ['粉，粉末，火药'], ['粉，粉末，火药'], ['Students often encounter the term "powder" in gaokao reading passages.']],
  ['power', 'n.', '能力，电力;权力', '985', ['能力，电力;权力'], ['能力，电力;权力'], ['The documentary explores the history of power in China.']],
  ['powerful', 'adj.', '强有力的', '985', ['强有力的'], ['强有力的'], ['A powerful diet is essential for maintaining good health.']],
  ['practical', 'adj.', '实际的，实用性的', '985', ['实际的，实用性的'], ['实际的，实用性的'], ['The novel tells a practical story about personal growth and resilience.']],
  ['pray', 'vt.', '请求;祈祷', '985', ['请求;祈祷'], ['请求;祈祷'], ['The villagers prayed for rain during the long drought.']],
  ['precious', 'adj.', '珍贵的,宝贵的', '985', ['珍贵的,宝贵的'], ['珍贵的,宝贵的'], ['Students found the topic precious but ultimately rewarding.']],
  ['predict', 'vt.', '预言,预测', '985', ['预言,预测'], ['预言,预测'], ['Meteorologists can now predict the weather with greater accuracy.']],
  ['prefer', 'vt.', '更喜欢，宁愿', '985', ['更喜欢，宁愿'], ['更喜欢，宁愿'], ['I prefer tea to coffee in the morning.']],
  ['press', 'vi.', '压,按vt.压;压榨n.印刷;新闻，报刊;出版社', '985', ['压,按vt.压;压榨'], ['压,按vt.压;压榨n.印刷;新闻，报刊;出版社'], ['Press the button to start the machine.']],
  ['pretend', 'vt.', '假装，装作vi.假装', '985', ['假装，装作vi.假装'], ['假装，装作vi.假装'], ['The child pretended to be a doctor, examining her teddy bear.']],
  ['principle', 'n.', '原则,原理', '985', ['原则,原理'], ['原则,原理'], ['The school is built on the principle of equal opportunity for all.']],
  ['process', 'n.', '过程vt.处理', '985', ['过程vt.处理'], ['过程vt.处理'], ['Learning a language is a long and gradual process.']],
  ['production', 'n.', '生产，产品，成果，作品', '985', ['生产，产品，成果，作'], ['生产，产品，成果，作品'], ['The textbook defines production clearly in chapter three.']],
  ['profession', 'n.', '职业，专业', '985', ['职业，专业'], ['职业，专业'], ['Teaching is a noble profession that shapes the future.']],
  ['professor', 'n.', '教授', '985', ['教授'], ['教授'], ['Understanding professor is crucial for grasping the author\'s main message.']],
  ['profit', 'n.', '利润vi.得益', '985', ['利润vi.得益'], ['利润vi.得益'], ['The lecture focused on the role of profit in daily life.']],
  ['project', 'n.', '计划;工程;项目vt.设计，规划', '985', ['计划;工程;项目vt'], ['计划;工程;项目vt.设计，规划'], ['The science project won first prize at the national competition.']],
  ['promote', 'vt.', '促进,提升;推销', '985', ['促进,提升;推销'], ['促进,提升;推销'], ['The campaign aims to promote healthy eating habits among teenagers.']],
  ['province', 'n.', '省', '985', ['省'], ['省'], ['The interview covered several topics related to province.']],
  ['publish', 'vt.', '公布,发表;出版，刊印', '985', ['公布,发表;出版，刊'], ['公布,发表;出版，刊印'], ['The researcher plans to publish her findings in a leading journal.']],
  ['pump', 'n.', '泵vt.用泵抽，打气', '985', ['泵vt.用泵抽，打气'], ['泵vt.用泵抽，打气'], ['Researchers have published new findings about pump.']],
  ['punishment', 'n.', '惩罚', '985', ['惩罚'], ['惩罚'], ['The lecture focused on the role of punishment in daily life.']],
  ['purchase', 'vt.', '购买n.购买;赃物', '985', ['购买n.购买;赃物'], ['购买n.购买;赃物'], ['You can purchase tickets online or at the box office.']],
  ['pure', 'adj.', '纯洁的', '985', ['纯洁的'], ['纯洁的'], ['The pure atmosphere in the classroom encouraged open discussion.']],
  ['puzzle', 'n.', '难题;谜vi.使迷惑', '985', ['难题;谜vi.使迷惑'], ['难题;谜vi.使迷惑'], ['The interview covered several topics related to puzzle.']],
  ['quality', 'n.', '质量，品质，特性', '985', ['质量，品质，特性'], ['质量，品质，特性'], ['The quality of education directly affects students\' future prospects.']],
  ['quantity', 'n.', '数量，大量', '985', ['数量，大量'], ['数量，大量'], ['A large quantity of food was wasted at the buffet last night.']],
  ['quarrel', 'vi.', '争吵n.争吵,吵架', '985', ['争吵n.争吵,吵架'], ['争吵n.争吵,吵架'], ['The two neighbors quarreled over the noise late at night.']],
  ['queue', 'n.', '队列vi.排队，将…梳成辫子', '985', ['队列vi.排队，将…'], ['队列vi.排队，将…梳成辫子'], ['The passage provides a detailed analysis of queue.']],
  ['quit', 'vt.', '离开,停止;辞职', '985', ['离开,停止;辞职'], ['离开,停止;辞职'], ['The teacher asked us to quit the main idea of the text.']],
  ['range', 'vi.', '变动，变化n.范围，幅度，', '985', ['变动，变化n.范围，'], ['变动，变化n.范围，幅度，'], ['The store offers a wide range of products for everyday needs.']],
  ['rank', 'n.', '等级，军衔，队列vt.排列，把…分等', '985', ['等级，军衔，队列vt'], ['等级，军衔，队列vt.排列，把…分等'], ['Understanding rank is crucial for grasping the author\'s main message.']],
  ['rate', 'n.', '比率;速度;价格vt.评价，估价', '985', ['比率;速度;价格vt'], ['比率;速度;价格vt.评价，估价'], ['The unemployment rate has dropped for the third consecutive month.']],
  ['ray', 'n.', '光线;射线', '985', ['光线;射线'], ['光线;射线'], ['The passage provides a detailed analysis of ray.']],
  ['react', 'vi.', '反应', '985', ['反应'], ['反应'], ['How did the audience react to the surprising ending of the play?']],
  ['reading', 'n.', '阅读;读物', '985', ['阅读;读物'], ['阅读;读物'], ['The committee discussed the topic of reading at length during the meeting.']],
  ['reality', 'n.', '现实;真实', '985', ['现实;真实'], ['现实;真实'], ['The interview covered several topics related to reality.']],
  ['reception', 'adj.', '接待，接收，接待处', '985', ['接待，接收，接待处'], ['接待，接收，接待处'], ['The reception approach helped students learn more effectively.']],
  ['recognize', 'vt.', '认出,识别，承认，认可', '985', ['认出,识别，承认，认'], ['认出,识别，承认，认可'], ['I did not recognize her because she had changed so much.']],
  ['recommend', 'vt.', '推荐，建议', '985', ['推荐，建议'], ['推荐，建议'], ['The doctor recommends that I get more sleep and exercise regularly.']],
  ['recover', 'vt.', '恢复，痊愈', '985', ['恢复，痊愈'], ['恢复，痊愈'], ['It took him three months to recover from the surgery.']],
  ['recycle', 'vt.', '重复利用', '985', ['重复利用'], ['重复利用'], ['We should recycle paper, plastic, and glass to reduce waste.']],
  ['reduce', 'vt.', '减少,减小', '985', ['减少,减小'], ['减少,减小'], ['Carsharing can help reduce traffic congestion in big cities.']],
  ['refer', 'v.', '提到，涉及，参考，查阅', '985', ['提到，涉及，参考，查'], ['提到，涉及，参考，查阅'], ['Please refer to page 42 for more detailed information.']],
  ['reflect', 'vt.', '反射,反映;思考', '985', ['反射,反映;思考'], ['反射,反映;思考'], ['The calm lake reflected the mountains like a mirror.']],
  ['reform', 'n.', '改革,改良vt.改革,革新', '985', ['改革,改良vt.改革'], ['改革,改良vt.改革,革新'], ['The education reform aims to reduce the burden on students.']],
  ['register', 'vt.', '登记,注册n.登记,注册', '985', ['登记,注册n.登记,'], ['登记,注册n.登记,注册'], ['All new students must register at the admissions office.']],
  ['regular', 'adj.', '规则的,整齐的;定期的，常规的', '985', ['规则的,整齐的;定期'], ['规则的,整齐的;定期的，常规的'], ['The regular nature of the problem became clear over time.']],
  ['reject', 'vt.', '拒绝;丢掉;驳回', '985', ['拒绝;丢掉;驳回'], ['拒绝;丢掉;驳回'], ['The publisher rejected the manuscript, saying it needed revision.']],
  ['relate', 'vt.', '联系', '985', ['联系'], ['联系'], ['The teacher helped students relate the theory to real-world examples.']],
  ['relative', 'adj.', '有关系的;相对的n.亲戚，亲属', '985', ['有关系的;相对的n.'], ['有关系的;相对的n.亲戚，亲属'], ['The relative design of the building won several international awards.']],
  ['relevant', 'adj.', '有关的;中肯的', '985', ['有关的;中肯的'], ['有关的;中肯的'], ['The novel tells a relevant story about personal growth and resilience.']],
  ['reliable', 'adj.', '可靠的', '985', ['可靠的'], ['可靠的'], ['The reliable nature of the problem became clear over time.']],
  ['religion', 'n.', '宗教，宗教信仰', '985', ['宗教，宗教信仰'], ['宗教，宗教信仰'], ['She wrote a research paper about religion last semester.']],
  ['rely', 'vi.', '依赖,依靠;信赖', '985', ['依赖,依靠;信赖'], ['依赖,依靠;信赖'], ['You cannot rely on luck alone; you must work hard.']],
  ['remark', 'vi.', '评论n.评论;谈话', '985', ['评论n.评论;谈话'], ['评论n.评论;谈话'], ['The professor made a remark about the importance of critical thinking.']],
  ['remind', 'vt.', '提醒', '985', ['提醒'], ['提醒'], ['The calendar reminds me of my mother\'s birthday next week.']],
  ['remote', 'adj.', '遥远的，偏僻的', '985', ['遥远的，偏僻的'], ['遥远的，偏僻的'], ['The book provides a remote analysis of the topic.']],
  ['remove', 'vt.', '移动，调动，迁移', '985', ['移动，调动，迁移'], ['移动，调动，迁移'], ['Please remove your shoes before entering the temple.']],
  ['rent', 'n.', '租金,租vi.出租，租用，租借', '985', ['租金,租vi.出租，'], ['租金,租vi.出租，租用，租借'], ['They rent a small apartment near the university campus.']],
  ['repair', 'vt.', '修理,修补n.修理', '985', ['修理,修补n.修理'], ['修理,修补n.修理'], ['The mechanic repaired the broken brake in twenty minutes.']],
  ['repeat', 'vt.', '重说,重做n.重复', '985', ['重说,重做n.重复'], ['重说,重做n.重复'], ['Could you please repeat the question? I did not hear it clearly.']],
  ['reply', 'vi.', '回答,答复n.答复', '985', ['回答,答复n.答复'], ['回答,答复n.答复'], ['She replied to the email immediately with the requested files.']],
  ['represent', 'vt.', '描绘;代表,象征', '985', ['描绘;代表,象征'], ['描绘;代表,象征'], ['The delegate will represent our school at the national conference.']],
  ['republic', 'n.', '共和国，共和政体', '985', ['共和国，共和政体'], ['共和国，共和政体'], ['The experiment demonstrates the properties of republic.']],
  ['reputation', 'n.', '名誉,声望', '985', ['名誉,声望'], ['名誉,声望'], ['Many exam questions test students\' knowledge of reputation.']],
  ['request', 'n.', '请求,要求vt.请求,要求', '985', ['请求,要求vt.请求'], ['请求,要求vt.请求,要求'], ['The lecture focused on the role of request in daily life.']],
  ['rescue', 'vt.', '援救,营救', '985', ['援救,营救'], ['援救,营救'], ['The lifeguard rescued the drowning child from the pool.']],
  ['reserve', 'vt.', '储备,保留;预订', '985', ['储备,保留;预订'], ['储备,保留;预订'], ['The teacher asked us to reserve the main idea of the text.']],
  ['resist', 'vt.', '抵抗,抗拒', '985', ['抵抗,抗拒'], ['抵抗,抗拒'], ['It is hard to resist the temptation of eating chocolate.']],
  ['respect', 'vt.', '尊敬,尊重n.尊敬', '985', ['尊敬,尊重n.尊敬'], ['尊敬,尊重n.尊敬'], ['Students should respect their teachers and classmates.']],
  ['respond', 'vi.', '回答;响应', '985', ['回答;响应'], ['回答;响应'], ['The company responded quickly to the customer\'s complaint.']],
  ['responsible', 'adj.', '有责任的;尽责的', '985', ['有责任的;尽责的'], ['有责任的;尽责的'], ['The situation turned out to be more responsible than we had expected.']],
  ['retire', 'vi.', '退休', '985', ['退休'], ['退休'], ['My grandfather retired at the age of sixty-five.']],
  ['revise', 'vt.', '校订,修改', '985', ['校订,修改'], ['校订,修改'], ['The teacher asked us to revise the main idea of the text.']],
  ['revolution', 'n.', '革命;旋转', '985', ['革命;旋转'], ['革命;旋转'], ['The industrial revolution changed the way people lived and worked.']],
  ['reward', 'n.', '报答;报酬vt.奖赏，奖励', '985', ['报答;报酬vt.奖赏'], ['报答;报酬vt.奖赏，奖励'], ['The school rewarded the top students with certificates.']],
  ['ripe', 'adj.', '成熟的;时机成熟的', '985', ['成熟的;时机成熟的'], ['成熟的;时机成熟的'], ['The findings have ripe implications for future research.']],
  ['risk', 'n.', '风险,危险vt.冒险', '985', ['风险,危险vt.冒险'], ['风险,危险vt.冒险'], ['You risk failing the exam if you do not study properly.']],
  ['rob', 'vt.', '抢劫,劫掠vi.抢劫,劫掠', '985', ['抢劫,劫掠vi.抢劫'], ['抢劫,劫掠vi.抢劫,劫掠'], ['She tried to rob the problem from different angles.']],
  ['rocket', 'n.', '火箭', '985', ['火箭'], ['火箭'], ['The committee discussed the topic of rocket at length during the meeting.']],
  ['roll', 'vi.', '滚动,转动n.一卷;名册', '985', ['滚动,转动n.一卷;'], ['滚动,转动n.一卷;名册'], ['The ball rolled down the hill and into the bushes.']],
  ['roof', 'n.', '屋顶', '985', ['屋顶'], ['屋顶'], ['The passage provides a detailed analysis of roof.']],
  ['root', 'n.', '根(部);根源vi.生根，扎根', '985', ['根(部);根源vi.'], ['根(部);根源vi.生根，扎根'], ['The survey reveals public attitudes toward root.']],
  ['rough', 'adj.', '表面不平的;粗略的;大致的', '985', ['表面不平的;粗略的;'], ['表面不平的;粗略的;大致的'], ['The rough changes in the climate worry many scientists worldwide.']],
  ['rude', 'adj.', '粗野的,残暴的', '985', ['粗野的,残暴的'], ['粗野的,残暴的'], ['The book provides a rude analysis of the topic.']],
  ['ruin', 'n.', '毁灭;废墟vt.毁坏', '985', ['毁灭;废墟vt.毁坏'], ['毁灭;废墟vt.毁坏'], ['The heavy rain ruined our plans for a picnic.']],
  ['sacrifice', 'vt.', '牺牲,献祭n.牺牲，祭品，供奉', '985', ['牺牲,献祭n.牺牲，'], ['牺牲,献祭n.牺牲，祭品，供奉'], ['You need to sacrifice the situation before making a final decision.']],
  ['sailor', 'n.', '海员,水手', '985', ['海员,水手'], ['海员,水手'], ['The report highlights the significance of sailor in education.']],
  ['salary', 'n.', '薪水', '985', ['薪水'], ['薪水'], ['The committee discussed the topic of salary at length during the meeting.']],
  ['satellite', 'n.', '卫星', '985', ['卫星'], ['卫星'], ['The report highlights the significance of satellite in education.']],
  ['satisfaction', 'n.', '满意', '985', ['满意'], ['满意'], ['The lecture focused on the role of satisfaction in daily life.']],
  ['scan', 'vt.', '浏览;扫描', '985', ['浏览;扫描'], ['浏览;扫描'], ['The guard scanned each visitor\'s ID before allowing entry.']],
  ['scare', 'vt.', '惊吓vi.受惊', '985', ['惊吓vi.受惊'], ['惊吓vi.受惊'], ['The guide began to scare the history of the ancient city.']],
  ['scene', 'n.', '情景;景色', '985', ['情景;景色'], ['情景;景色'], ['The report highlights the significance of scene in education.']],
  ['schedule', 'vt.', '安排n.时间表,计划表', '985', ['安排n.时间表,计划'], ['安排n.时间表,计划表'], ['The flight was delayed, disrupting the entire travel schedule.']],
  ['scholarship', 'n.', '奖学金', '985', ['奖学金'], ['奖学金'], ['She won a scholarship to study at a top university.']],
  ['scientific', 'adj.', '科学的', '985', ['科学的'], ['科学的'], ['The scientific atmosphere in the classroom encouraged open discussion.']],
  ['scold', 'vt.', '责骂', '985', ['责骂'], ['责骂'], ['Many readers fail to scold the hidden message in the passage.']],
  ['scream', 'vi.', '尖叫n.尖叫声', '985', ['尖叫n.尖叫声'], ['尖叫n.尖叫声'], ['The little girl screamed when she saw the spider.']],
  ['seaside', 'n.', '海边', '985', ['海边'], ['海边'], ['The committee discussed the topic of seaside at length during the meeting.']],
  ['section', 'n.', '切片;部门;章节', '985', ['切片;部门;章节'], ['切片;部门;章节'], ['Please read the first section of the chapter before next class.']],
  ['secure', 'adj.', '安全的', '985', ['安全的'], ['安全的'], ['Make sure to secure your belongings before leaving the room.']],
  ['seed', 'n.', '种(子),籽', '985', ['种(子),籽'], ['种(子),籽'], ['Many exam questions test students\' knowledge of seed.']],
  ['seek', 'vt.', '寻找,探索', '985', ['寻找,探索'], ['寻找,探索'], ['Many students seek scholarships to help pay for tuition.']],
  ['seize', 'vt.', '抓住;夺取，占据', '985', ['抓住;夺取，占据'], ['抓住;夺取，占据'], ['The police seized a large quantity of illegal drugs.']],
  ['select', 'vt.', '选择vi.挑选', '985', ['选择vi.挑选'], ['选择vi.挑选'], ['The coach selected the best players for the tournament.']],
  ['self', 'n.', '自我,自己', '985', ['自我,自己'], ['自我,自己'], ['The committee discussed the topic of self at length during the meeting.']],
  ['selfish', 'adj.', '自私的,利己的', '985', ['自私的,利己的'], ['自私的,利己的'], ['The author\'s selfish style attracted a wide and loyal readership.']],
  ['senior', 'adj.', '年长者;资格老的', '985', ['年长者;资格老的'], ['年长者;资格老的'], ['His senior response showed great maturity and wisdom.']],
  ['sensitive', 'adj.', '敏感的,灵敏的', '985', ['敏感的,灵敏的'], ['敏感的,灵敏的'], ['The topic of mental health requires sensitive handling.']],
  ['settle', 'vt.', '安排,安放;解决vi.定居', '985', ['安排,安放;解决vi'], ['安排,安放;解决vi.定居'], ['The family decided to settle in a small town by the sea.']],
  ['sew', 'vt.', '缝制', '985', ['缝制'], ['缝制'], ['Grandmother sewed a beautiful dress for her granddaughter.']],
  ['sex', 'n.', '性别,性', '985', ['性别,性'], ['性别,性'], ['The article discusses the impact of sex on modern society.']],
  ['shade', 'n.', '树荫，阴影，阴凉处，遮光物vi.荫蔽', '985', ['树荫，阴影，阴凉处，'], ['树荫，阴影，阴凉处，遮光物vi.荫蔽'], ['The interview covered several topics related to shade.']],
  ['shadow', 'n.', '阴影,影子', '985', ['阴影,影子'], ['阴影,影子'], ['The author mentions shadow to support the main argument.']],
  ['shallow', 'adj.', '浅的,浅薄的n.浅滩', '985', ['浅的,浅薄的n.浅滩'], ['浅的,浅薄的n.浅滩'], ['The shallow nature of the problem became clear over time.']],
  ['sharp', 'adj.', '锋利的，急剧的，敏锐的;刺耳的', '985', ['锋利的，急剧的，敏锐'], ['锋利的，急剧的，敏锐的;刺耳的'], ['The situation turned out to be more sharp than we had expected.']],
  ['shave', 'vt.', '剃,刮vi.修面n.刮脸', '985', ['剃,刮vi.修面n.'], ['剃,刮vi.修面n.刮脸'], ['Parents should shave their children to develop good study habits.']],
  ['sheet', 'n.', '被单;纸张，薄片', '985', ['被单;纸张，薄片'], ['被单;纸张，薄片'], ['The documentary explores the history of sheet in China.']],
  ['shelter', 'n.', '掩蔽处vt.遮蔽，掩护', '985', ['掩蔽处vt.遮蔽，掩'], ['掩蔽处vt.遮蔽，掩护'], ['The Red Cross sheltered hundreds of homeless families.']],
  ['shock', 'n.', '冲击;震惊;电击vi.震动', '985', ['冲击;震惊;电击vi'], ['冲击;震惊;电击vi.震动'], ['The news of the accident shocked everyone in the office.']],
  ['shoot', 'vt.', '射击，射中，拍摄，发芽n.射击，摄影', '985', ['射击，射中，拍摄，发'], ['射击，射中，拍摄，发芽n.射击，摄影'], ['The photographer shot hundreds of photos at the wedding.']],
  ['shopping', 'n.', '购物', '985', ['购物'], ['购物'], ['The report highlights the significance of shopping in education.']],
  ['shore', 'n.', '滨,岸', '985', ['滨,岸'], ['滨,岸'], ['The article discusses the impact of shore on modern society.']],
  ['shortcoming', 'n.', '短处,缺点', '985', ['短处,缺点'], ['短处,缺点'], ['The textbook defines shortcoming clearly in chapter three.']],
  ['shot', 'n.', '射击，发射;投篮', '985', ['射击，发射;投篮'], ['射击，发射;投篮'], ['Understanding shot is crucial for grasping the author\'s main message.']],
  ['sigh', 'vi.', '叹气,叹息n.叹息', '985', ['叹气,叹息n.叹息'], ['叹气,叹息n.叹息'], ['The professor urged students to sigh beyond the textbook.']],
  ['sign', 'n.', '符号;征兆vt.签名', '985', ['符号;征兆vt.签名'], ['符号;征兆vt.签名'], ['Please sign your name at the bottom of the form.']],
  ['signal', 'n.', '信号vi.发信号', '985', ['信号vi.发信号'], ['信号vi.发信号'], ['The red light is a signal that you must stop your car immediately.']],
  ['significance', 'n.', '意义,重要性', '985', ['意义,重要性'], ['意义,重要性'], ['The interview covered several topics related to significance.']],
  ['simply', 'adv.', '简单地;朴素地;仅仅，只不过', '985', ['简单地;朴素地;仅仅'], ['简单地;朴素地;仅仅，只不过'], ['The situation changed simply after the new policy took effect.']],
  ['sincere', 'adj.', '真诚的,真挚的', '985', ['真诚的,真挚的'], ['真诚的,真挚的'], ['The findings have sincere implications for future research.']],
  ['sincerely', 'adv.', '真诚地', '985', ['真诚地'], ['真诚地'], ['He answered the question sincerely, showing thorough preparation.']],
  ['sink', 'vi.', '下沉,消沉，渗透n.水槽,水池', '985', ['下沉,消沉，渗透n.'], ['下沉,消沉，渗透n.水槽,水池'], ['The Titanic sank after hitting an iceberg in 1912.']],
  ['skin', 'vt.', '剥皮n.皮,皮肤;兽皮', '985', ['剥皮n.皮,皮肤;兽'], ['剥皮n.皮,皮肤;兽皮'], ['The experiment shows how plants skin sunlight for growth.']],
  ['skyscraper', 'n.', '摩天大楼', '985', ['摩天大楼'], ['摩天大楼'], ['The lecture focused on the role of skyscraper in daily life.']],
  ['slave', 'n.', '奴隶,苦工', '985', ['奴隶,苦工'], ['奴隶,苦工'], ['The author mentions slave to support the main argument.']],
  ['slight', 'adj.', '细长的;轻微的，少量的，不重要的', '985', ['细长的;轻微的，少量'], ['细长的;轻微的，少量的，不重要的'], ['The findings have slight implications for future research.']],
  ['slightly', 'adv.', '轻微地', '985', ['轻微地'], ['轻微地'], ['The project progressed slightly despite several unexpected setbacks.']],
  ['slim', 'adj.', '苗条的，修长的', '985', ['苗条的，修长的'], ['苗条的，修长的'], ['The slim changes in the climate worry many scientists worldwide.']],
  ['smooth', 'adj.', '光滑的，平稳的，顺利的', '985', ['光滑的，平稳的，顺利'], ['光滑的，平稳的，顺利的'], ['The smooth report highlighted several key issues in the system.']],
  ['sneaker', 'n.', '鬼鬼祟祟做事的人,卑鄙者,运动鞋', '985', ['鬼鬼祟祟做事的人,卑'], ['鬼鬼祟祟做事的人,卑鄙者,运动鞋'], ['Understanding sneaker is crucial for grasping the author\'s main message.']],
  ['soccer', 'n.', '英式足球', '985', ['英式足球'], ['英式足球'], ['The interview covered several topics related to soccer.']],
  ['socialism', 'n.', '社会主义', '985', ['社会主义'], ['社会主义'], ['The textbook defines socialism clearly in chapter three.']],
  ['socialist', 'adj.', '社会主义的', '985', ['社会主义的'], ['社会主义的'], ['Students found the topic socialist but ultimately rewarding.']],
  ['software', 'n.', '软件', '985', ['软件'], ['软件'], ['Understanding software is crucial for grasping the author\'s main message.']],
  ['soil', 'n.', '土壤;土地', '985', ['土壤;土地'], ['土壤;土地'], ['The author mentions soil to support the main argument.']],
  ['solar', 'adj.', '太阳的,日光的', '985', ['太阳的,日光的'], ['太阳的,日光的'], ['The situation turned out to be more solar than we had expected.']],
  ['soul', 'n.', '灵魂,精神;人', '985', ['灵魂,精神;人'], ['灵魂,精神;人'], ['The committee discussed the topic of soul at length during the meeting.']],
  ['specific', 'adj.', '特定的，明确的，具体的', '985', ['特定的，明确的，具体'], ['特定的，明确的，具体的'], ['The teacher gave specific instructions for the lab experiment.']],
  ['spit', 'vi.', '吐唾沫', '985', ['吐唾沫'], ['吐唾沫'], ['She was the first to spit the error in the report.']],
  ['splendid', 'adj.', '壮丽的,显著的', '985', ['壮丽的,显著的'], ['壮丽的,显著的'], ['The author\'s splendid style attracted a wide and loyal readership.']],
  ['split', 'vt.', '劈开', '985', ['劈开'], ['劈开'], ['The scientist managed to split the data accurately and efficiently.']],
  ['spoken', 'adj.', '口头讲的,口语的', '985', ['口头讲的,口语的'], ['口头讲的,口语的'], ['The spoken design of the building won several international awards.']],
  ['speak', 'v.', '说；讲；发言', '985', ['说；讲；发言'], ['说；讲；发言'], ['She speaks three languages fluently: Chinese, English, and French.']],
  ['sponsor', 'n.', '发起者vt.发起', '985', ['发起者vt.发起'], ['发起者vt.发起'], ['Researchers have published new findings about sponsor.']],
  ['spot', 'vt.', '认出，发现n.点,斑点;地点', '985', ['认出，发现n.点,斑'], ['认出，发现n.点,斑点;地点'], ['He managed to spot the difficult task without any help.']],
  ['spy', 'n.', '间谍,特务vt.侦察，监视', '985', ['间谍,特务vt.侦察'], ['间谍,特务vt.侦察，监视'], ['The novel uses the theme of spy throughout the story.']],
  ['stable', 'adj.', '稳定的，安定的n.马厩,马棚', '985', ['稳定的，安定的n.马'], ['稳定的，安定的n.马厩,马棚'], ['A stable political environment is essential for economic growth.']],
  ['stadium', 'n.', '露天大型运动场', '985', ['露天大型运动场'], ['露天大型运动场'], ['The survey reveals public attitudes toward stadium.']],
  ['staff', 'n.', '全体工作人员', '985', ['全体工作人员'], ['全体工作人员'], ['The committee discussed the topic of staff at length during the meeting.']],
  ['stage', 'n.', '舞台;阶段，时期', '985', ['舞台;阶段，时期'], ['舞台;阶段，时期'], ['The documentary explores the history of stage in China.']],
  ['stair', 'n.', '楼梯', '985', ['楼梯'], ['楼梯'], ['The author mentions stair to support the main argument.']],
  ['stare', 'vi.', '凝视', '985', ['凝视'], ['凝视'], ['The boy stared at the ice cream, wanting some badly.']],
  ['starve', 'vi.', '饿死vt.使饿死', '985', ['饿死vt.使饿死'], ['饿死vt.使饿死'], ['The lost hikers starved for three days before being rescued.']],
  ['steady', 'adj.', '稳固的vt.使稳定', '985', ['稳固的vt.使稳定'], ['稳固的vt.使稳定'], ['She remained steady despite the difficulties she faced.']],
  ['steam', 'n.', '蒸汽vi.蒸发vt.蒸煮', '985', ['蒸汽vi.蒸发vt.'], ['蒸汽vi.蒸发vt.蒸煮'], ['The novel uses the theme of steam throughout the story.']],
  ['steel', 'n.', '钢', '985', ['钢'], ['钢'], ['The documentary explores the history of steel in China.']],
  ['straight', 'adj.', '直的;正直的ad.直接地', '985', ['直的;正直的ad.直'], ['直的;正直的ad.直接地'], ['The teacher was impressed by her straight performance in class.']],
  ['strength', 'n.', '力量,力气', '985', ['力量,力气'], ['力量,力气'], ['Her greatest strength is her ability to work under pressure.']],
  ['stress', 'n.', '强调，重要性，压力，重音vt.强调，使紧张，用重音读', '985', ['强调，重要性，压力，'], ['强调，重要性，压力，重音vt.强调，使紧张，用重音读'], ['Effective time management can help reduce stress during exams.']],
  ['strike', 'vt.', '打,击;罢工n.罢工;打击;殴打', '985', ['打,击;罢工n.罢工'], ['打,击;罢工n.罢工;打击;殴打'], ['The workers went on strike to demand better wages.']],
  ['struggle', 'n.', '奋斗，努力，挣扎vi.奋斗，努力，挣扎', '985', ['奋斗，努力，挣扎vi'], ['奋斗，努力，挣扎vi.奋斗，努力，挣扎'], ['Many freshmen struggle to adapt to college life in the first semester.']],
  ['studio', 'n.', '工作室,播音室', '985', ['工作室,播音室'], ['工作室,播音室'], ['The survey reveals public attitudes toward studio.']],
  ['style', 'n.', '风格,式样', '985', ['风格,式样'], ['风格,式样'], ['The author\'s writing style is both elegant and accessible.']],
  ['suck', 'vt.', '吸,吮', '985', ['吸,吮'], ['吸,吮'], ['Students should learn to suck their knowledge in real practice.']],
  ['suddenly', 'adv.', '突然', '985', ['突然'], ['突然'], ['The lights went out suddenly during the thunderstorm.']],
  ['suffer', 'v.', '遭受,忍受', '985', ['遭受,忍受'], ['遭受,忍受'], ['Many people suffer from allergies during spring.']],
  ['suit', 'n.', '套装，诉讼vt.适合，使适应', '985', ['套装，诉讼vt.适合'], ['套装，诉讼vt.适合，使适应'], ['The job suits her personality and skills perfectly.']],
  ['suitable', 'adj.', '适宜的;恰当的', '985', ['适宜的;恰当的'], ['适宜的;恰当的'], ['The situation turned out to be more suitable than we had expected.']],
  ['sum', 'n.', '总数;金额vi.共计', '985', ['总数;金额vi.共计'], ['总数;金额vi.共计'], ['The experiment demonstrates the properties of sum.']],
  ['summary', 'adj.', '简短的，扼要的n.摘要,总结', '985', ['简短的，扼要的n.摘'], ['简短的，扼要的n.摘要,总结'], ['Please write a brief summary of the article for homework.']],
  ['sunset', 'n.', '日落', '985', ['日落'], ['日落'], ['The survey reveals public attitudes toward sunset.']],
  ['sunshine', 'n.', '阳光', '985', ['阳光'], ['阳光'], ['The passage provides a detailed analysis of sunshine.']],
  ['support', 'vt.', '支持;供养', '985', ['支持;供养'], ['支持;供养'], ['Parents should support their children\'s dreams and ambitions.']],
  ['surround', 'vt.', '包围，环绕', '985', ['包围，环绕'], ['包围，环绕'], ['A tall fence surrounds the school to keep students safe.']],
  ['survive', 'vt.', '幸免于vi.活下来', '985', ['幸免于vi.活下来'], ['幸免于vi.活下来'], ['Only two passengers survived the terrible car accident.']],
  ['swallow', 'vt.', '吞，咽vi.吞，咽n.燕子', '985', ['吞，咽vi.吞，咽n'], ['吞，咽vi.吞，咽n.燕子'], ['She swallowed the medicine with a glass of water.']],
  ['switch', 'n.', '开关;转换vt.转换', '985', ['开关;转换vt.转换'], ['开关;转换vt.转换'], ['Please switch off the lights when you leave the room.']],
  ['symbol', 'n.', '象征;符号', '985', ['象征;符号'], ['象征;符号'], ['The interview covered several topics related to symbol.']],
  ['sympathy', 'n.', '同情，同情心', '985', ['同情，同情心'], ['同情，同情心'], ['Understanding sympathy is crucial for grasping the author\'s main message.']],
  ['system', 'n.', '系统;制度', '985', ['系统;制度'], ['系统;制度'], ['The public transport system in this city is very efficient.']],
  ['tailor', 'n.', '裁缝vt.裁制衣服', '985', ['裁缝vt.裁制衣服'], ['裁缝vt.裁制衣服'], ['The survey reveals public attitudes toward tailor.']],
  ['talent', 'n.', '天才，才能', '985', ['天才，才能'], ['天才，才能'], ['Understanding talent is crucial for grasping the author\'s main message.']],
  ['tank', 'n.', '坦克；大容器', '985', ['坦克；大容器'], ['坦克；大容器'], ['The committee discussed the topic of tank at length during the meeting.']],
  ['tap', 'vt.', '轻打，轻敲n.塞子，龙头；轻叩，轻拍', '985', ['轻打，轻敲n.塞子，'], ['轻打，轻敲n.塞子，龙头；轻叩，轻拍'], ['The professor urged students to tap beyond the textbook.']],
  ['target', 'n.', '靶；目标', '985', ['靶；目标'], ['靶；目标'], ['The company set a sales target of one million units this year.']],
  ['tax', 'n.', '税(款)vt.征税', '985', ['税(款)vt.征税'], ['税(款)vt.征税'], ['The novel uses the theme of tax throughout the story.']],
  ['tear', 'n.', '泪滴，眼泪vt.撕开，撕裂', '985', ['泪滴，眼泪vt.撕开'], ['泪滴，眼泪vt.撕开，撕裂'], ['She tore the letter into small pieces and threw it away.']],
  ['technical', 'adj.', '技术的，工艺的', '985', ['技术的，工艺的'], ['技术的，工艺的'], ['We need a more technical plan to address this complex issue.']],
  ['technique', 'n.', '技巧，技能', '985', ['技巧，技能'], ['技巧，技能'], ['The artist developed a unique painting technique over the years.']],
  ['teenager', 'n.', '青少年', '985', ['青少年'], ['青少年'], ['The passage provides a detailed analysis of teenager.']],
  ['telegram', 'n.', '电报', '985', ['电报'], ['电报'], ['Many exam questions test students\' knowledge of telegram.']],
  ['telegraph', 'n.', '电报(机)v.发电报', '985', ['电报(机)v.发电报'], ['电报(机)v.发电报'], ['The lecture focused on the role of telegraph in daily life.']],
  ['telescope', 'n.', '望远镜', '985', ['望远镜'], ['望远镜'], ['The essay examines how telescope shapes our decisions.']],
  ['television', 'n.', '电视，电视机', '985', ['电视，电视机'], ['电视，电视机'], ['The textbook defines television clearly in chapter three.']],
  ['temple', 'n.', '神殿，庙宇；太阳穴', '985', ['神殿，庙宇；太阳穴'], ['神殿，庙宇；太阳穴'], ['The article discusses the impact of temple on modern society.']],
  ['temporary', 'adj.', '暂时的，临时的', '985', ['暂时的，临时的'], ['暂时的，临时的'], ['The temporary design of the building won several international awards.']],
  ['tend', 'vi.', '走向，趋向', '985', ['走向，趋向'], ['走向，趋向'], ['Plants tend to grow towards the light.']],
  ['tendency', 'n.', '趋向，趋势', '985', ['趋向，趋势'], ['趋向，趋势'], ['There is a growing tendency among young people to start their own businesses.']],
  ['tense', 'adj.', '紧张的；拉紧的n.时态', '985', ['紧张的；拉紧的n.时'], ['紧张的；拉紧的n.时态'], ['The tense atmosphere in the classroom encouraged open discussion.']],
  ['theme', 'n.', '题目；词干；主旋律', '985', ['题目；词干；主旋律'], ['题目；词干；主旋律'], ['The author mentions theme to support the main argument.']],
  ['theory', 'n.', '理论，学说', '985', ['理论，学说'], ['理论，学说'], ['The theory of evolution was first proposed by Charles Darwin.']],
  ['therefore', 'adv.', '因此，所以', '985', ['因此，所以'], ['因此，所以'], ['She completed the assignment therefore and submitted it early.']],
  ['thief', 'n.', '窃贼，偷窃犯', '985', ['窃贼，偷窃犯'], ['窃贼，偷窃犯'], ['The teacher explained thief with real-life examples in class.']],
  ['thinking', 'n.', '思考；想法，见解', '985', ['思考；想法，见解'], ['思考；想法，见解'], ['The novel uses the theme of thinking throughout the story.']],
  ['throat', 'n.', '咽喉', '985', ['咽喉'], ['咽喉'], ['She wrote a research paper about throat last semester.']],
  ['throughout', 'prep.', '遍及ad.到处', '985', ['遍及ad.到处'], ['遍及ad.到处'], ['The students sat throughout the tree to escape the summer heat.']],
  ['thus', 'adv.', '如此，这样；因而', '985', ['如此，这样；因而'], ['如此，这样；因而'], ['She remembered the details thus, even after many years.']],
  ['tick', 'n.', '滴答声；记号vi.发出滴答声', '985', ['滴答声；记号vi.发'], ['滴答声；记号vi.发出滴答声'], ['Understanding tick is crucial for grasping the author\'s main message.']],
  ['tight', 'adj.', '紧的；紧身的ad.紧紧地', '985', ['紧的；紧身的ad.紧'], ['紧的；紧身的ad.紧紧地'], ['The tight design of the building won several international awards.']],
  ['timetable', 'n.', '时间表；时刻表', '985', ['时间表；时刻表'], ['时间表；时刻表'], ['Students often encounter the term "timetable" in gaokao reading passages.']],
  ['tin', 'n.', '锡；罐头', '985', ['锡；罐头'], ['锡；罐头'], ['The experiment demonstrates the properties of tin.']],
  ['tip', 'vt.', '轻击vi.给小费n.小费', '985', ['轻击vi.给小费n.'], ['轻击vi.给小费n.小费'], ['She tipped the waiter generously for the excellent service.']],
  ['tire', 'vi.', '疲劳；厌倦n.轮胎', '985', ['疲劳；厌倦n.轮胎'], ['疲劳；厌倦n.轮胎'], ['The teacher asked us to tire the main idea of the text.']],
  ['title', 'n.', '标题，题目；称号，头衔', '985', ['标题，题目；称号，头'], ['标题，题目；称号，头衔'], ['The experiment demonstrates the properties of title.']],
  ['tobacco', 'n.', '烟草，烟叶', '985', ['烟草，烟叶'], ['烟草，烟叶'], ['The author mentions tobacco to support the main argument.']],
  ['tolerate', 'vt.', '忍受，容忍', '985', ['忍受，容忍'], ['忍受，容忍'], ['The author attempts to tolerate readers\' attention to this issue.']],
  ['topic', 'n.', '题目；论题，话题', '985', ['题目；论题，话题'], ['题目；论题，话题'], ['The speaker addressed a wide range of topics during the lecture.']],
  ['tough', 'adj.', '坚韧的；健壮的', '985', ['坚韧的；健壮的'], ['坚韧的；健壮的'], ['Her tough attitude inspired those around her to do better.']],
  ['track', 'n.', '行踪，路径；轨道', '985', ['行踪，路径；轨道'], ['行踪，路径；轨道'], ['The essay examines how track shapes our decisions.']],
  ['tractor', 'n.', '拖拉机', '985', ['拖拉机'], ['拖拉机'], ['The passage provides a detailed analysis of tractor.']],
  ['tradition', 'n.', '传统，惯例', '985', ['传统，惯例'], ['传统，惯例'], ['It is a Chinese tradition to give red envelopes during the Spring Festival.']],
  ['transport', 'n.', '运输vt.运输', '985', ['运输vt.运输'], ['运输vt.运输'], ['Trucks transport goods from factories to stores across the country.']],
  ['trap', 'n.', '陷阱；诡计vt.诱骗', '985', ['陷阱；诡计vt.诱骗'], ['陷阱；诡计vt.诱骗'], ['Researchers have published new findings about trap.']],
  ['trend', 'vi.', '伸向；倾向n.倾向', '985', ['伸向；倾向n.倾向'], ['伸向；倾向n.倾向'], ['The trend towards online shopping continues to grow rapidly.']],
  ['trial', 'n.', '试验；审判', '985', ['试验；审判'], ['试验；审判'], ['The clinical trial showed promising results for the new drug.']],
  ['trick', 'n.', '诡计；窍门vt.哄骗', '985', ['诡计；窍门vt.哄骗'], ['诡计；窍门vt.哄骗'], ['The magician tricked the audience with his clever illusions.']],
  ['type', 'n.', '类型vi.打字', '985', ['类型vi.打字'], ['类型vi.打字'], ['She types over eighty words per minute on the keyboard.']],
  ['typewriter', 'n.', '打字机', '985', ['打字机'], ['打字机'], ['Researchers have published new findings about typewriter.']],
  ['typical', 'adj.', '典型的，代表性的', '985', ['典型的，代表性的'], ['典型的，代表性的'], ['This is a typical example of how cultural differences can cause misunderstandings.']],
  ['typist', 'n.', '打字员', '985', ['打字员'], ['打字员'], ['Many exam questions test students\' knowledge of typist.']],
  ['tyre', 'n.', '轮胎', '985', ['轮胎'], ['轮胎'], ['The novel uses the theme of tyre throughout the story.']],
  ['underline', 'vt.', '在…下划线；强调', '985', ['在…下划线；强调'], ['在…下划线；强调'], ['Many readers fail to underline the hidden message in the passage.']],
  ['understanding', 'n.', '理解，理解力', '985', ['理解，理解力'], ['理解，理解力'], ['The experiment demonstrates the properties of understanding.']],
  ['unfair', 'adj.', '不公平的', '985', ['不公平的'], ['不公平的'], ['The unfair changes in the climate worry many scientists worldwide.']],
  ['uniform', 'adj.', '一样的n.制服', '985', ['一样的n.制服'], ['一样的n.制服'], ['The teacher was impressed by her uniform performance in class.']],
  ['unique', 'adj.', '唯一的', '985', ['唯一的'], ['唯一的'], ['Each student has a unique learning style that should be respected.']],
  ['unite', 'vi.', '联合vt.使联合', '985', ['联合vt.使联合'], ['联合vt.使联合'], ['The crisis united the community in an extraordinary way.']],
  ['united', 'adj.', '一致的；联合的', '985', ['一致的；联合的'], ['一致的；联合的'], ['The united nature of the problem became clear over time.']],
  ['universe', 'n.', '宇宙，世界', '985', ['宇宙，世界'], ['宇宙，世界'], ['The documentary explores the history of universe in China.']],
  ['unknown', 'adj.', '未知的，不知名的', '985', ['未知的，不知名的'], ['未知的，不知名的'], ['The teacher was impressed by her unknown performance in class.']],
  ['unusual', 'adj.', '不平常的，独特的', '985', ['不平常的，独特的'], ['不平常的，独特的'], ['Her unusual attitude inspired those around her to do better.']],
  ['update', 'vt.', '更新，使现代化n.现代化，更新', '985', ['更新，使现代化n.现'], ['更新，使现代化n.现代化，更新'], ['The software updates automatically every week.']],
  ['upset', 'vt.', '使不适，使心烦n.混乱', '985', ['使不适，使心烦n.混'], ['使不适，使心烦n.混乱'], ['She tried to upset the problem from different angles.']],
  ['upward', 'adj.', '向上的，上升的ad.向上，往上', '985', ['向上的，上升的ad.'], ['向上的，上升的ad.向上，往上'], ['His upward response showed great maturity and wisdom.']],
  ['urban', 'adj.', '都市的', '985', ['都市的'], ['都市的'], ['A urban diet is essential for maintaining good health.']],
  ['urgent', 'adj.', '紧急的', '985', ['紧急的'], ['紧急的'], ['The findings have urgent implications for future research.']],
  ['usually', 'adv.', '通常', '985', ['通常'], ['通常'], ['I usually wake up at six to review my lessons before class.']],
  ['valley', 'n.', '山谷，流域', '985', ['山谷，流域'], ['山谷，流域'], ['The village is located in a beautiful valley surrounded by mountains.']],
  ['valuable', 'adj.', '值钱的，有价值的n.贵重物品', '985', ['值钱的，有价值的n.'], ['值钱的，有价值的n.贵重物品'], ['She learned a valuable lesson from her failure in the exam.']],
  ['variety', 'n.', '多样化，种类', '985', ['多样化，种类'], ['多样化，种类'], ['The museum exhibits a variety of artworks from different periods.']],
  ['various', 'adj.', '各种各样的', '985', ['各种各样的'], ['各种各样的'], ['The library offers various resources for student research projects.']],
  ['vast', 'adj.', '巨大的，广阔的', '985', ['巨大的，广阔的'], ['巨大的，广阔的'], ['The vast desert stretches for hundreds of kilometers in northwest China.']],
  ['vehicle', 'n.', '车辆', '985', ['车辆'], ['车辆'], ['Electric vehicles are becoming increasingly popular in China.']],
  ['victim', 'n.', '牺牲者，受害者', '985', ['牺牲者，受害者'], ['牺牲者，受害者'], ['The charity provides support for victims of natural disasters.']],
  ['view', 'vt.', '看待；看n.见解；风景', '985', ['看待；看n.见解；风'], ['看待；看n.见解；风景'], ['The hotel room offers a breathtaking view of the mountains.']],
  ['violent', 'adj.', '猛烈的，狂暴的', '985', ['猛烈的，狂暴的'], ['猛烈的，狂暴的'], ['The film contains violent scenes that may not be suitable for children.']],
  ['virus', 'n.', '病毒', '985', ['病毒'], ['病毒'], ['The computer virus spread rapidly through the company\'s network.']],
  ['visa', 'n.', '签证；信用卡', '985', ['签证；信用卡'], ['签证；信用卡'], ['You need a valid visa to enter the country for study purposes.']],
  ['volunteer', 'n.', '志愿者vt.志愿', '985', ['志愿者vt.志愿'], ['志愿者vt.志愿'], ['She works as a volunteer at the local animal shelter every weekend.']],
  ['vote', 'n.', '选举，投票', '985', ['选举，投票'], ['选举，投票'], ['Citizens voted in large numbers for the new president.']],
  ['voyage', 'n.', '航海vi.航海，航空', '985', ['航海vi.航海，航空'], ['航海vi.航海，航空'], ['The ship set out on a long voyage across the Pacific Ocean.']],
  ['wage', 'n.', '工资，报酬', '985', ['工资，报酬'], ['工资，报酬'], ['The company raised the minimum wage for all entry-level workers.']],
  ['waiter', 'n.', '侍者，服务员', '985', ['侍者，服务员'], ['侍者，服务员'], ['The teacher explained waiter with real-life examples in class.']],
  ['waitress', 'n.', '女侍者，女服务员', '985', ['女侍者，女服务员'], ['女侍者，女服务员'], ['The lecture focused on the role of waitress in daily life.']],
  ['wave', 'n.', '波，波涛；起伏vi.波动；挥手', '985', ['波，波涛；起伏vi.'], ['波，波涛；起伏vi.波动；挥手'], ['She waved goodbye as the train pulled away from the platform.']],
  ['weakness', 'n.', '弱点', '985', ['弱点'], ['弱点'], ['Acknowledging your weakness is the first step to self-improvement.']],
  ['web', 'n.', '(蜘蛛)网，网状物；网络', '985', ['(蜘蛛)网，网状物；'], ['(蜘蛛)网，网状物；网络'], ['The spider spun a delicate web between the two branches.']],
  ['website', '待标注', 'WWW(环球网)的站点', '985', ['WWW(环球网)的站'], ['WWW(环球网)的站点'], ['You can find more information on our school website.']],
  ['wedding', 'n.', '婚礼', '985', ['婚礼'], ['婚礼'], ['The whole village was invited to the grand wedding celebration.']],
  ['weed', 'n.', '杂草，野草vi.除草', '985', ['杂草，野草vi.除草'], ['杂草，野草vi.除草'], ['The gardener pulled weeds from the vegetable patch.']],
  ['well-known', 'adj.', '众所周知的', '985', ['众所周知的'], ['众所周知的'], ['The Great Wall is a well-known landmark in China.']],
  ['whisper', 'vt.', '低声地讲vi.低语n.语，私语', '985', ['低声地讲vi.低语n'], ['低声地讲vi.低语n.语，私语'], ['She whispered the secret so that no one else could hear.']],
  ['whistle', 'n.', '口哨vi.吹口哨wilda.野生的；野蛮的n.荒地', '985', ['口哨vi.吹口哨wi'], ['口哨vi.吹口哨wilda.野生的；野蛮的n.荒地'], ['The referee whistled to start the football match.']],
  ['willing', 'adj.', '心甘情愿', '985', ['心甘情愿'], ['心甘情愿'], ['He is always willing to help classmates who struggle with math.']],
  ['wind', 'n.', '风wipevt.揩，擦n.揩，擦', '985', ['风wipevt.揩，'], ['风wipevt.揩，擦n.揩，擦'], ['Researchers have published new findings about wind.']],
  ['wire', 'n.', '金属线，电缆', '985', ['金属线，电缆'], ['金属线，电缆'], ['The electrician connected the wires to fix the broken light.']],
  ['within', 'prep.', '在…里面；不超过', '985', ['在…里面；不超过'], ['在…里面；不超过'], ['The answer lies within the text itself if you read carefully.']],
  ['witness', 'n.', '证据；证人vt.目击', '985', ['证据；证人vt.目击'], ['证据；证人vt.目击'], ['The witness told the court exactly what she saw that night.']],
  ['wooden', 'adj.', '木制的；呆板的wooln.羊毛，毛线', '985', ['木制的；呆板的woo'], ['木制的；呆板的wooln.羊毛，毛线'], ['The old wooden bridge creaked under the weight of the cart.']],
  ['worse', 'adj.', '更坏的ad.更坏', '985', ['更坏的ad.更坏'], ['更坏的ad.更坏'], ['The weather got worse as we drove further north into the mountains.']],
  ['worst', 'adj.', '最坏的ad.最坏地', '985', ['最坏的ad.最坏地'], ['最坏的ad.最坏地'], ['That was the worst movie I have ever seen in my entire life.']],
  ['worthwhile', 'adj.', '值得的', '985', ['值得的'], ['值得的'], ['Volunteering at the hospital is a worthwhile experience.']],
  ['would', '待标注', 'aux.将；愿意', '985', ['aux.将；愿意'], ['aux.将；愿意'], ['The word "would" appears frequently in gaokao reading passages.']],
  ['youth', 'n.', '青春；青年', '985', ['青春；青年'], ['青春；青年'], ['The teacher explained youth with real-life examples in class.']]
];

// 536话题词汇 - 科技创新
const seedWords536_科技创新 = [
  ['abandoned', 'adj.', '废弃的', '话题', ['科技创新话题词'], ['废弃的'], ['abandoned is common in 科技创新 topics.']],
  ['accessible', 'adj.', '可进入/使用的', '话题', ['科技创新话题词'], ['可进入/使用的'], ['accessible is common in 科技创新 topics.']],
  ['assign', 'v.', '分配，指派，赋值', '话题', ['科技创新话题词'], ['分配，指派，赋值'], ['assign is common in 科技创新 topics.']],
  ['biology', 'n.', '生物学', '话题', ['科技创新话题词'], ['生物学'], ['Biology is the study of living organisms and their interactions.']],
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
  ['monitor', 'v./n.', '监控；监测仪器', '话题', ['科技创新话题词'], ['监控；监测仪器'], ['The teacher monitors each student\'s progress throughout the term.']],
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
  ['transform', 'v.', '使改变形态', '话题', ['科技创新话题词'], ['使改变形态'], ['Education can transform a person\'s life and future.']],
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
  ['respect', 'n./v.', '尊敬；遵守', '话题', ['情感社科话题词'], ['尊敬；遵守'], ['Students should respect their teachers and classmates.']],
  ['solitude', 'n.', '单独，孤独', '话题', ['情感社科话题词'], ['单独，孤独'], ['solitude is common in 情感社科 topics.']],
  ['stress', 'n./v.', '压力；强调；紧张', '话题', ['情感社科话题词'], ['压力；强调；紧张'], ['stress is common in 情感社科 topics.']],
  ['suspect', 'v.', '猜想，觉得；怀疑', '话题', ['情感社科话题词'], ['猜想，觉得；怀疑'], ['The police suspect foul play in the mysterious disappearance.']],
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
  ['tend', 'v.', '倾向', '话题', ['情感社科话题词'], ['倾向'], ['Plants tend to grow towards the light.']],
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
  ['mean', 'adj.', '吝啬的', '话题', ['人物描述话题词'], ['吝啬的'], ['What does this word mean in the context of the passage?']],
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
  ['monitor', 'v./n.', '监测；监控', '必考', ['真题必考词', '一、2021 年高考英语真题'], ['监测；监控', '高考真题高频出现'], ['The teacher monitors each student\'s progress throughout the term.']],
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
  ['improve', 'v.', '改善；改进；提高；变得更好', '真题', ['真题词频28次'], ['改善；改进；提高；变得更好'], ['Reading regularly can improve your vocabulary and writing skills.']],
  ['species', 'n.', '物种；种类', '真题', ['真题词频25次'], ['物种；种类'], ['species appears in recent gaokao exams.']],
  ['creative', 'adj.', '创造性的，指具有创新或原创性的', '真题', ['真题词频24次'], ['创造性的，指具有创新或原创性的'], ['creative appears in recent gaokao exams.']],
  ['wild', 'adj.', '野生的，指自然生长而非人工培育的', '真题', ['真题词频19次'], ['野生的，指自然生长而非人工培育的'], ['wild appears in recent gaokao exams.']],
  ['state', 'n./v.', 'n.状态；状况；国家；州；v.陈述；说明；声明', '真题', ['真题词频17次'], ['n.状态；状况；国家；州；v.陈述；说明；声明'], ['state appears in recent gaokao exams.']],
  ['consider', 'v.', '仔细考虑；细想；认为；以为；体谅；考虑到', '真题', ['真题词频17次'], ['仔细考虑；细想；认为；以为；体谅；考虑到'], ['You should consider all options before making a final decision.']],
  ['require', 'v.', '要求，指需要或命令某人做某事', '真题', ['真题词频16次'], ['要求，指需要或命令某人做某事'], ['require appears in recent gaokao exams.']],
  ['focus', 'n./v.', 'n.焦点；v.聚焦（on）', '真题', ['真题词频16次'], ['n.焦点；v.聚焦（on）'], ['focus appears in recent gaokao exams.']],
  ['positive', 'adj.', '积极的；正面的', '真题', ['真题词频16次'], ['积极的；正面的'], ['positive appears in recent gaokao exams.']],
  ['concept', 'n.', '概念', '真题', ['真题词频16次'], ['概念'], ['concept appears in recent gaokao exams.']],
  ['personal', 'adj.', '私人的；个人的；亲自的', '真题', ['真题词频15次'], ['私人的；个人的；亲自的'], ['personal appears in recent gaokao exams.']],
  ['support', 'v./n.', 'v.支持；拥护；鼓励；帮助；支撑；供养；n.支持；拥护；鼓励；帮助；支撑物；支柱', '真题', ['真题词频15次'], ['v.支持；拥护；鼓励；帮助；支撑；供养；n.支持；拥护；鼓励；帮助；支撑物；支柱'], ['Parents should support their children\'s dreams and ambitions.']],
  ['store', 'v./n.', 'v.储存；n.商店', '真题', ['真题词频15次'], ['v.储存；n.商店'], ['The data is stored securely on the company\'s servers.']],
  ['respect', 'v./n.', 'v./n.尊敬；尊重', '真题', ['真题词频15次'], ['v./n.尊敬；尊重'], ['Students should respect their teachers and classmates.']],
  ['promote', 'v.', '促进，推动某事的发展', '真题', ['真题词频15次'], ['促进，推动某事的发展'], ['promote appears in recent gaokao exams.']],
  ['ancient', 'adj.', '古老的', '真题', ['真题词频15次'], ['古老的'], ['ancient appears in recent gaokao exams.']],
  ['habitat', 'n.', '（动植物的）栖息地；生活环境', '真题', ['真题词频15次'], ['（动植物的）栖息地；生活环境'], ['habitat appears in recent gaokao exams.']],
  ['physical', 'adj.', '物质的；身体的，指与物质或身体相关的', '真题', ['真题词频14次'], ['物质的；身体的，指与物质或身体相关的'], ['physical appears in recent gaokao exams.']],
  ['average', 'adj.', '平均的', '真题', ['真题词频14次'], ['平均的'], ['average appears in recent gaokao exams.']],
  ['protect', 'v.', '保护；防护；（制定法律）保护；（通过征关税）保护（国内企业）', '真题', ['真题词频13次'], ['保护；防护；（制定法律）保护；（通过征关税）保护（国内企业）'], ['protect appears in recent gaokao exams.']],
  ['percent', 'n.', '百分比，表示比例或比率', '真题', ['真题词频13次'], ['百分比，表示比例或比率'], ['percent appears in recent gaokao exams.']],
  ['tax', 'v./n.', 'v.对……征税；使负重担；n.税；税款', '真题', ['真题词频13次'], ['v.对……征税；使负重担；n.税；税款'], ['tax appears in recent gaokao exams.']],
  ['offer', 'v./n.', 'v.出价；n.提议；出价；主动提议', '真题', ['真题词频12次'], ['v.出价；n.提议；出价；主动提议'], ['The company offered her a position with a generous salary.']],
  ['produce', 'v./n.', 'v.生产；制造；产生；引起；创作；n.农产品', '真题', ['真题词频12次'], ['v.生产；制造；产生；引起；创作；n.农产品'], ['produce appears in recent gaokao exams.']],
  ['lead', 'v./n.', 'v.带路；引领；领导；导致；通向；n.铅；（戏剧、电影等的）主角；领先地位', '真题', ['真题词频12次'], ['v.带路；引领；领导；导致；通向；n.铅；（戏剧、电影等的）主角；领先地位'], ['The guide led the tourists through the ancient temple ruins.']],
  ['check', 'n./v.', 'n.支票；检查；v.核对', '真题', ['真题词频12次'], ['n.支票；检查；v.核对'], ['check appears in recent gaokao exams.']],
  ['communicate', 'v.', '交流，通过言语、文字等方式传递信息', '真题', ['真题词频12次'], ['交流，通过言语、文字等方式传递信息'], ['Dolphins communicate with each other through complex sounds.']],
  ['spot', 'n.', '地点，指特定的位置或场所', '真题', ['真题词频12次'], ['地点，指特定的位置或场所'], ['spot appears in recent gaokao exams.']],
  ['success', 'n.', '成功；成就；成功的人（或事物）', '真题', ['真题词频11次'], ['成功；成就；成功的人（或事物）'], ['success appears in recent gaokao exams.']],
  ['deal', 'v./n.', 'v.处理；交易；n.处理；交易', '真题', ['真题词频11次'], ['v.处理；交易；n.处理；交易'], ['deal appears in recent gaokao exams.']],
  ['refer', 'v.', '涉及；提到；查阅', '真题', ['真题词频11次'], ['涉及；提到；查阅'], ['Please refer to page 42 for more detailed information.']],
  ['compare', 'v.', '比较（with）；比喻（to）', '真题', ['真题词频11次'], ['比较（with）；比喻（to）'], ['The teacher asked us to compare the two poems in terms of style.']],
  ['avoid', 'v.', '避免，设法不使某事发生', '真题', ['真题词频11次'], ['避免，设法不使某事发生'], ['avoid appears in recent gaokao exams.']],
  ['content', 'n./adj.', 'n.内容；目录；adj.满意的（with）', '真题', ['真题词频11次'], ['n.内容；目录；adj.满意的（with）'], ['content appears in recent gaokao exams.']],
  ['background', 'n.', '背景；出身', '真题', ['真题词频11次'], ['背景；出身'], ['background appears in recent gaokao exams.']],
  ['urban', 'adj.', '城市的；都市的', '真题', ['真题词频11次'], ['城市的；都市的'], ['urban appears in recent gaokao exams.']],
  ['complete', 'v./adj.', 'v.完成；结束；使完整；使完美；adj.完整的；完全的；彻底的；完成的', '真题', ['真题词频10次'], ['v.完成；结束；使完整；使完美；adj.完整的；完全的；彻底的；完成的'], ['complete appears in recent gaokao exams.']],
  ['tend', 'v.', '往往会；常常就；趋向；倾向；照顾；照料', '真题', ['真题词频10次'], ['往往会；常常就；趋向；倾向；照顾；照料'], ['Plants tend to grow towards the light.']],
  ['fit', 'v./adj./n.', 'v.适合；合身；（使）适应；安装；adj.健康的；合适的；恰当的；n.（癫痫等的）突发；一阵（咳嗽、打喷嚏等）', '真题', ['真题词频10次'], ['v.适合；合身；（使）适应；安装；adj.健康的；合适的；恰当的；n.（癫痫等的）突发；一阵（咳嗽、打喷嚏等）'], ['fit appears in recent gaokao exams.']],
  ['professional', 'adj./n.', 'adj.专业的；职业的；n.具有某种专业技能或从事某种专业工作的人', '真题', ['真题词频10次'], ['adj.专业的；职业的；n.具有某种专业技能或从事某种专业工作的人'], ['professional appears in recent gaokao exams.']],
  ['speech', 'n.', '演讲，指公开发表的讲话或演说', '真题', ['真题词频10次'], ['演讲，指公开发表的讲话或演说'], ['speech appears in recent gaokao exams.']],
  ['regular', 'adj.', '有规律的；定期的，指按照固定模式或时间间隔进行的', '真题', ['真题词频10次'], ['有规律的；定期的，指按照固定模式或时间间隔进行的'], ['regular appears in recent gaokao exams.']],
  ['range', 'n.', '范围，表示一系列事物的界限', '真题', ['真题词频10次'], ['范围，表示一系列事物的界限'], ['range appears in recent gaokao exams.']],
  ['opportunity', 'n.', '机会，有利的时机', '真题', ['真题词频10次'], ['机会，有利的时机'], ['opportunity appears in recent gaokao exams.']],
  ['potential', 'adj./n.', 'adj.潜在的；n.潜力，可能性或潜力', '真题', ['真题词频10次'], ['adj.潜在的；n.潜力，可能性或潜力'], ['potential appears in recent gaokao exams.']],
  ['available', 'adj.', '可利用的，指某物或某人可被使用', '真题', ['真题词频10次'], ['可利用的，指某物或某人可被使用'], ['available appears in recent gaokao exams.']],
  ['remove', 'v.', '移除；去掉', '真题', ['真题词频10次'], ['移除；去掉'], ['Please remove your shoes before entering the temple.']],
  ['unique', 'adj.', '唯一的；独一无二的', '真题', ['真题词频10次'], ['唯一的；独一无二的'], ['unique appears in recent gaokao exams.']],
  ['reserve', 'v./n.', 'v.预订；保留；储备；n.储备；保护区；矜持', '真题', ['真题词频10次'], ['v.预订；保留；储备；n.储备；保护区；矜持'], ['reserve appears in recent gaokao exams.']],
  ['distinguish', 'v.', '区分；辨别；使杰出', '真题', ['真题词频10次'], ['区分；辨别；使杰出'], ['It is hard to distinguish the twins from each other.']],
  ['former', 'adj.', '以前的、前者', '真题', ['真题词频10次'], ['以前的、前者'], ['former appears in recent gaokao exams.']],
  ['volunteer', 'n./v.', 'n.志愿者；v.（自愿）做', '真题', ['真题词频9次'], ['n.志愿者；v.（自愿）做'], ['volunteer appears in recent gaokao exams.']],
  ['review', 'v./n.', 'v./n.复习；回顾；评估', '真题', ['真题词频9次'], ['v./n.复习；回顾；评估'], ['Let us review what we learned in class today.']],
  ['official', 'adj./n.', 'adj.正式的，指符合规定或程序的；n.官员', '真题', ['真题词频9次'], ['adj.正式的，指符合规定或程序的；n.官员'], ['official appears in recent gaokao exams.']],
  ['approach', 'v./n.', 'v.靠近；n.途径；方法（to）', '真题', ['真题词频9次'], ['v.靠近；n.途径；方法（to）'], ['approach appears in recent gaokao exams.']],
  ['entire', 'adj.', '全部的；整个的', '真题', ['真题词频9次'], ['全部的；整个的'], ['entire appears in recent gaokao exams.']],
  ['specific', 'adj.', '明确的；具体的', '真题', ['真题词频9次'], ['明确的；具体的'], ['specific appears in recent gaokao exams.']],
  ['complex', 'adj./n.', 'adj.复杂的；难懂的；n.建筑群；综合设施', '真题', ['真题词频9次'], ['adj.复杂的；难懂的；n.建筑群；综合设施'], ['complex appears in recent gaokao exams.']],
  ['impact', 'n./v.', 'n.影响；冲击力；v.影响；冲击', '真题', ['真题词频9次'], ['n.影响；冲击力；v.影响；冲击'], ['impact appears in recent gaokao exams.']],
  ['industry', 'n.', '工业、产业', '真题', ['真题词频9次'], ['工业、产业'], ['industry appears in recent gaokao exams.']],
  ['wonder', 'v./n.', 'v.想知道；琢磨；感到诧异；惊叹；n.惊奇；惊讶；奇迹；奇观', '真题', ['真题词频8次'], ['v.想知道；琢磨；感到诧异；惊叹；n.惊奇；惊讶；奇迹；奇观'], ['I wonder if it will rain tomorrow afternoon.']],
  ['matter', 'n./v.', 'n.事情；事态；问题；物质；v.要紧；有关系', '真题', ['真题词频8次'], ['n.事情；事态；问题；物质；v.要紧；有关系'], ['It does not matter how slowly you go, as long as you do not stop.']],
  ['popularity', 'n.', '普及；流行，指某物被广泛接受或喜爱的程度', '真题', ['真题词频8次'], ['普及；流行，指某物被广泛接受或喜爱的程度'], ['popularity appears in recent gaokao exams.']],
  ['pressure', 'n.', '压力；压强', '真题', ['真题词频8次'], ['压力；压强'], ['pressure appears in recent gaokao exams.']],
  ['replace', 'v.', '取代，用新的代替旧的', '真题', ['真题词频8次'], ['取代，用新的代替旧的'], ['replace appears in recent gaokao exams.']],
  ['stick', 'v.', 'v.粘住；坚持（to）', '真题', ['真题词频8次'], ['v.粘住；坚持（to）'], ['He stuck the note on the refrigerator with a magnet.']],
  ['response', 'n.', '反应；响应（to）', '真题', ['真题词频8次'], ['反应；响应（to）'], ['response appears in recent gaokao exams.']],
  ['significant', 'adj.', '重要的；有意义的；显著的', '真题', ['真题词频8次'], ['重要的；有意义的；显著的'], ['significant appears in recent gaokao exams.']],
  ['transform', 'v.', '使改变形态；使改观；使转化', '真题', ['真题词频8次'], ['使改变形态；使改观；使转化'], ['Education can transform a person\'s life and future.']],
  ['artificial', 'adj.', '人造的；人工的；人为的；虚假的', '真题', ['真题词频8次'], ['人造的；人工的；人为的；虚假的'], ['artificial appears in recent gaokao exams.']],
  ['awkward', 'adj.', '令人尴尬的；难对付的；笨拙的；不灵活的', '真题', ['真题词频8次'], ['令人尴尬的；难对付的；笨拙的；不灵活的'], ['awkward appears in recent gaokao exams.']],
  ['addition', 'n.', '增加；加法；添加物', '真题', ['真题词频7次'], ['增加；加法；添加物'], ['addition appears in recent gaokao exams.']],
  ['cause', 'v./n.', 'v.引起；使发生；造成；导致；n.原因；起因；理由；事业', '真题', ['真题词频7次'], ['v.引起；使发生；造成；导致；n.原因；起因；理由；事业'], ['cause appears in recent gaokao exams.']],
  ['perform', 'v.', '执行；表演，指完成任务或进行艺术表演', '真题', ['真题词频7次'], ['执行；表演，指完成任务或进行艺术表演'], ['perform appears in recent gaokao exams.']],
  ['connect', 'v.', '连接；联系，指将两个或多个事物连接起来或建立联系', '真题', ['真题词频7次'], ['连接；联系，指将两个或多个事物连接起来或建立联系'], ['The bridge connects the two cities across the wide river.']],
  ['lack', 'n./v.', 'n.缺乏（of/in）；v.缺乏', '真题', ['真题词频7次'], ['n.缺乏（of/in）；v.缺乏'], ['Many students lack confidence when speaking in front of others.']],
  ['original', 'adj.', '原始的；最初的，指最初的状态或版本', '真题', ['真题词频7次'], ['原始的；最初的，指最初的状态或版本'], ['original appears in recent gaokao exams.']],
  ['account', 'n.', '账户，指记录财务收支的账目', '真题', ['真题词频7次'], ['账户，指记录财务收支的账目'], ['account appears in recent gaokao exams.']],
  ['figure', 'n.', '人物，指特定的人或形象', '真题', ['真题词频7次'], ['人物，指特定的人或形象'], ['figure appears in recent gaokao exams.']],
  ['risk', 'n./v.', 'n.危险；风险；v.冒……的危险', '真题', ['真题词频7次'], ['n.危险；风险；v.冒……的危险'], ['You risk failing the exam if you do not study properly.']],
  ['collection', 'n.', '收集', '真题', ['真题词频7次'], ['收集'], ['collection appears in recent gaokao exams.']],
  ['moral', 'adj./n.', 'adj.道德的；道义上的；n.品行；道德规范', '真题', ['真题词频7次'], ['adj.道德的；道义上的；n.品行；道德规范'], ['moral appears in recent gaokao exams.']],
  ['ensure', 'v.', '确保；保证', '真题', ['真题词频7次'], ['确保；保证'], ['Wearing a helmet ensures your safety while riding a bicycle.']],
  ['register', 'v./n.', 'v.登记；注册；记录；n.登记；注册；登记簿', '真题', ['真题词频7次'], ['v.登记；注册；记录；n.登记；注册；登记簿'], ['register appears in recent gaokao exams.']],
  ['frequently', 'adv.', '频繁地；经常', '真题', ['真题词频7次'], ['频繁地；经常'], ['frequently appears in recent gaokao exams.']],
  ['session', 'n.', '一场、一段时间、会议', '真题', ['真题词频7次'], ['一场、一段时间、会议'], ['session appears in recent gaokao exams.']],
  ['present', 'adj./n./v.', 'adj.现存的；当前的；出席的；到场的；n.礼物；目前；现在；v.把……交给；颁发；授予；提出', '真题', ['真题词频6次'], ['adj.现存的；当前的；出席的；到场的；n.礼物；目前；现在；v.把……交给；颁发；授予；提出'], ['The professor presented her research at an international conference.']],
  ['prefer', 'v.', '更喜欢，指对某物或某人比对其他有更强烈的喜好', '真题', ['真题词频6次'], ['更喜欢，指对某物或某人比对其他有更强烈的喜好'], ['I prefer tea to coffee in the morning.']],
  ['raise', 'v.', '举起；筹集；提出', '真题', ['真题词频6次'], ['举起；筹集；提出'], ['raise appears in recent gaokao exams.']],
  ['particular', 'adj.', '特别的，指与众不同的或特定的', '真题', ['真题词频6次'], ['特别的，指与众不同的或特定的'], ['particular appears in recent gaokao exams.']],
  ['subject', 'n./adj.', 'n.主题；实验对象；adj.服从的', '真题', ['真题词频6次'], ['n.主题；实验对象；adj.服从的'], ['subject appears in recent gaokao exams.']],
  ['charge', 'n./v.', 'n.费用；指控；v.要价（for）；管理；充电', '真题', ['真题词频6次'], ['n.费用；指控；v.要价（for）；管理；充电'], ['charge appears in recent gaokao exams.']],
  ['contain', 'v.', '包含，容纳某物在内', '真题', ['真题词频6次'], ['包含，容纳某物在内'], ['The box contains important documents for the meeting.']],
  ['labor', 'n.', '劳力，指体力工作或劳动者', '真题', ['真题词频6次'], ['劳力，指体力工作或劳动者'], ['labor appears in recent gaokao exams.']],
  ['pollution', 'n.', '污染', '真题', ['真题词频6次'], ['污染'], ['pollution appears in recent gaokao exams.']],
  ['hire', 'v.', '雇请', '真题', ['真题词频6次'], ['雇请'], ['The company hired ten new employees for the summer season.']],
  ['aspect', 'n.', '方面；外观', '真题', ['真题词频6次'], ['方面；外观'], ['aspect appears in recent gaokao exams.']],
  ['convenient', 'adj.', '方便的；便利的', '真题', ['真题词频6次'], ['方便的；便利的'], ['convenient appears in recent gaokao exams.']],
  ['decline', 'v./n.', 'v.下降；衰退；谢绝；n.下降；衰退', '真题', ['真题词频6次'], ['v.下降；衰退；谢绝；n.下降；衰退'], ['Sales declined sharply during the economic crisis last year.']],
  ['evaluate', 'v.', '评估；评价', '真题', ['真题词频6次'], ['评估；评价'], ['The committee will evaluate all proposals before making a decision.']],
  ['unexpected', 'adj.', '出乎意料的；意外的', '真题', ['真题词频6次'], ['出乎意料的；意外的'], ['unexpected appears in recent gaokao exams.']],
  ['vital', 'adj.', '至关重要的；生死攸关的；充满生机的', '真题', ['真题词频6次'], ['至关重要的；生死攸关的；充满生机的'], ['vital appears in recent gaokao exams.']],
  ['annual', 'adj./n.', 'adj.每年的；一年一次的；年度的；n.年刊；年鉴', '真题', ['真题词频6次'], ['adj.每年的；一年一次的；年度的；n.年刊；年鉴'], ['annual appears in recent gaokao exams.']],
  ['giant', 'n./adj.', 'n.巨人；巨兽；大公司；adj.巨大的；伟大的', '真题', ['真题词频6次'], ['n.巨人；巨兽；大公司；adj.巨大的；伟大的'], ['giant appears in recent gaokao exams.']],
  ['visual', 'adj.', '视力的、视觉的', '真题', ['真题词频6次'], ['视力的、视觉的'], ['visual appears in recent gaokao exams.']],
  ['promise', 'n./v.', 'n.诺言；允诺；v.许诺；承诺', '真题', ['真题词频5次'], ['n.诺言；允诺；v.许诺；承诺'], ['He promised to help his sister with her math homework.']],
  ['general', 'adj.', '普遍的；通用的', '真题', ['真题词频5次'], ['普遍的；通用的'], ['general appears in recent gaokao exams.']],
  ['condition', 'n.', 'n.情况；条件', '真题', ['真题词频5次'], ['n.情况；条件'], ['condition appears in recent gaokao exams.']],
  ['affect', 'v.', '影响', '真题', ['真题词频5次'], ['影响'], ['affect appears in recent gaokao exams.']],
  ['feed', 'v.', '喂养（on）', '真题', ['真题词频5次'], ['喂养（on）'], ['The farmer feeds the chickens and ducks every morning at dawn.']],
  ['strength', 'n.', '力量', '真题', ['真题词频5次'], ['力量'], ['strength appears in recent gaokao exams.']],
  ['determine', 'v.', '下决心', '真题', ['真题词频5次'], ['下决心'], ['Scientists determined the age of the fossil using carbon dating.']],
  ['equipment', 'n.', '设备', '真题', ['真题词频5次'], ['设备'], ['equipment appears in recent gaokao exams.']],
  ['desire', 'n./v.', 'n.渴望；v.渴望，强烈的愿望或需求', '真题', ['真题词频5次'], ['n.渴望；v.渴望，强烈的愿望或需求'], ['desire appears in recent gaokao exams.']],
  ['advance', 'v./adj./n.', 'v.前进；adj.提前的；n.前进；提前', '真题', ['真题词频5次'], ['v.前进；adj.提前的；n.前进；提前'], ['advance appears in recent gaokao exams.']],
  ['character', 'n.', '个性，指人的性格特征', '真题', ['真题词频5次'], ['个性，指人的性格特征'], ['character appears in recent gaokao exams.']],
  ['private', 'adj.', '私人的，指个人的、非公开的', '真题', ['真题词频5次'], ['私人的，指个人的、非公开的'], ['private appears in recent gaokao exams.']],
  ['persuade', 'v.', '说服，指通过言语或行动使他人信服', '真题', ['真题词频5次'], ['说服，指通过言语或行动使他人信服'], ['He persuaded his friend to join the volunteer program.']],
  ['security', 'n.', '安全；保障', '真题', ['真题词频5次'], ['安全；保障'], ['security appears in recent gaokao exams.']],
  ['host', 'n./v.', 'n.主人；主持人；v.主办；主持', '真题', ['真题词频5次'], ['n.主人；主持人；v.主办；主持'], ['host appears in recent gaokao exams.']],
  ['version', 'n.', '版本', '真题', ['真题词频5次'], ['版本'], ['version appears in recent gaokao exams.']],
  ['chemical', 'adj./n.', 'adj.化学的；n.药品', '真题', ['真题词频5次'], ['adj.化学的；n.药品'], ['chemical appears in recent gaokao exams.']],
  ['straight', 'adj.', 'adj.直的；直接的', '真题', ['真题词频5次'], ['adj.直的；直接的'], ['straight appears in recent gaokao exams.']],
  ['treatment', 'n.', '对待；治疗', '真题', ['真题词频5次'], ['对待；治疗'], ['treatment appears in recent gaokao exams.']],
  ['contribute', 'v.', '贡献；致力于（to）', '真题', ['真题词频5次'], ['贡献；致力于（to）'], ['Everyone should contribute to protecting the environment.']],
  ['constant', 'adj.', '持续不断的', '真题', ['真题词频5次'], ['持续不断的'], ['constant appears in recent gaokao exams.']],
  ['delay', 'v./n.', 'v./n.推迟；耽搁', '真题', ['真题词频5次'], ['v./n.推迟；耽搁'], ['The flight was delayed by two hours due to bad weather.']],
  ['sympathy', 'n.', '同情；同情心', '真题', ['真题词频5次'], ['同情；同情心'], ['sympathy appears in recent gaokao exams.']],
  ['accurate', 'adj.', '准确的；精确的', '真题', ['真题词频5次'], ['准确的；精确的'], ['accurate appears in recent gaokao exams.']],
  ['assess', 'v.', '评估；评定', '真题', ['真题词频5次'], ['评估；评定'], ['assess appears in recent gaokao exams.']],
  ['current', 'adj./n.', 'adj.当前的；现在的；流行的；n.水流；气流；电流；潮流', '真题', ['真题词频5次'], ['adj.当前的；现在的；流行的；n.水流；气流；电流；潮流'], ['current appears in recent gaokao exams.']],
  ['household', 'n./adj.', 'n.家庭；一家人；adj.家庭的；家用的', '真题', ['真题词频5次'], ['n.家庭；一家人；adj.家庭的；家用的'], ['household appears in recent gaokao exams.']],
  ['tough', 'adj.', '艰苦的；困难的；坚强的；坚韧的', '真题', ['真题词频5次'], ['艰苦的；困难的；坚强的；坚韧的'], ['tough appears in recent gaokao exams.']],
  ['confirm', 'v.', '证实；确认；批准', '真题', ['真题词频5次'], ['证实；确认；批准'], ['Please confirm your reservation by email before the deadline.']],
  ['witness', 'v./n.', 'v.目击；见证；n.目击者；证人', '真题', ['真题词频5次'], ['v.目击；见证；n.目击者；证人'], ['witness appears in recent gaokao exams.']],
  ['restore', 'v.', '恢复；修复；归还', '真题', ['真题词频5次'], ['恢复；修复；归还'], ['restore appears in recent gaokao exams.']],
  ['multiple', 'adj./n.', 'adj.数量多的；多种多样的；n.倍数', '真题', ['真题词频5次'], ['adj.数量多的；多种多样的；n.倍数'], ['multiple appears in recent gaokao exams.']],
  ['random', 'adj./n.', 'adj.随机的；随意的；n.随机；随意', '真题', ['真题词频5次'], ['adj.随机的；随意的；n.随机；随意'], ['random appears in recent gaokao exams.']],
  ['phrase', 'n.', '短语、词组', '真题', ['真题词频5次'], ['短语、词组'], ['phrase appears in recent gaokao exams.']],
  ['section', 'n.', '一段、部分', '真题', ['真题词频5次'], ['一段、部分'], ['section appears in recent gaokao exams.']],
  ['string', 'n.', '细线、琴弦、一连串', '真题', ['真题词频5次'], ['细线、琴弦、一连串'], ['string appears in recent gaokao exams.']],
  ['swap', 'v.', '交换', '真题', ['真题词频5次'], ['交换'], ['The two boys swapped sandwiches during lunch break.']],
  ['directly', 'adv.', '直接地；径直地；坦率地；正好；立即', '真题', ['真题词频4次'], ['直接地；径直地；坦率地；正好；立即'], ['directly appears in recent gaokao exams.']],
  ['valuable', 'adj./n.', 'adj.很有用的；宝贵的；很值钱的；贵重的；n.贵重物品（尤指珠宝）', '真题', ['真题词频4次'], ['adj.很有用的；宝贵的；很值钱的；贵重的；n.贵重物品（尤指珠宝）'], ['She learned a valuable lesson from her failure in the exam.']],
  ['necessarily', 'adv.', '必然地，指某事发生是不可避免的', '真题', ['真题词频4次'], ['必然地，指某事发生是不可避免的'], ['necessarily appears in recent gaokao exams.']],
  ['achievement', 'n.', '成就，指通过努力获得的成功或结果', '真题', ['真题词频4次'], ['成就，指通过努力获得的成功或结果'], ['achievement appears in recent gaokao exams.']],
  ['prevent', 'v.', '阻止，指防止某事发生或进行', '真题', ['真题词频4次'], ['阻止，指防止某事发生或进行'], ['Vaccines help prevent many serious diseases.']],
  ['relate', 'v.', '有关联（to）；陈述', '真题', ['真题词频4次'], ['有关联（to）；陈述'], ['relate appears in recent gaokao exams.']],
  ['attack', 'n./v.', 'n./v.攻击', '真题', ['真题词频4次'], ['n./v.攻击'], ['attack appears in recent gaokao exams.']],
  ['gather', 'v.', '聚集，使人或物集合在一起', '真题', ['真题词频4次'], ['聚集，使人或物集合在一起'], ['The family gathered around the table for a holiday dinner.']],
  ['praise', 'v./n.', 'v./n.称赞，表示对某人或某事的赞扬', '真题', ['真题词频4次'], ['v./n.称赞，表示对某人或某事的赞扬'], ['praise appears in recent gaokao exams.']],
  ['recover', 'v.', '恢复，指从疾病、损失等中恢复过来', '真题', ['真题词频4次'], ['恢复，指从疾病、损失等中恢复过来'], ['recover appears in recent gaokao exams.']],
  ['exchange', 'v./n.', 'v./n.交换，指互相给予或接受某物', '真题', ['真题词频4次'], ['v./n.交换，指互相给予或接受某物'], ['Students can exchange ideas during the group discussion.']],
  ['eager', 'adj.', '渴望的，指对某事物有强烈的愿望', '真题', ['真题词频4次'], ['渴望的，指对某事物有强烈的愿望'], ['eager appears in recent gaokao exams.']],
  ['apply', 'v.', '应用（to）；申请（for）', '真题', ['真题词频4次'], ['应用（to）；申请（for）'], ['apply appears in recent gaokao exams.']],
  ['select', 'v.', '挑选；选择', '真题', ['真题词频4次'], ['挑选；选择'], ['The coach selected the best players for the tournament.']],
  ['urgent', 'adj.', '紧急的；迫切的', '真题', ['真题词频4次'], ['紧急的；迫切的'], ['urgent appears in recent gaokao exams.']],
  ['track', 'v./n.', 'v.跟踪；n.小路；轨迹', '真题', ['真题词频4次'], ['v.跟踪；n.小路；轨迹'], ['track appears in recent gaokao exams.']],
  ['reflect', 'v.', '反射；反映；思考', '真题', ['真题词频4次'], ['反射；反映；思考'], ['The calm lake reflected the mountains like a mirror.']],
  ['contact', 'v./n.', 'v./n.联系（with）；接触', '真题', ['真题词频4次'], ['v./n.联系（with）；接触'], ['contact appears in recent gaokao exams.']],
  ['represent', 'v.', '展示；代表', '真题', ['真题词频4次'], ['展示；代表'], ['represent appears in recent gaokao exams.']],
  ['purchase', 'v./n.', 'v./n.购买', '真题', ['真题词频4次'], ['v./n.购买'], ['purchase appears in recent gaokao exams.']],
  ['conflict', 'n.', '冲突', '真题', ['真题词频4次'], ['冲突'], ['conflict appears in recent gaokao exams.']],
  ['grateful', 'adj.', '感激的（to）', '真题', ['真题词频4次'], ['感激的（to）'], ['grateful appears in recent gaokao exams.']],
  ['celebrate', 'v.', '庆祝', '真题', ['真题词频4次'], ['庆祝'], ['The whole family gathered to celebrate the Spring Festival.']],
  ['previous', 'adj.', '先前的；以前的', '真题', ['真题词频4次'], ['先前的；以前的'], ['previous appears in recent gaokao exams.']],
  ['reliable', 'adj.', '可靠的；可信赖的', '真题', ['真题词频4次'], ['可靠的；可信赖的'], ['reliable appears in recent gaokao exams.']],
  ['trap', 'v./n.', 'v.使陷入困境；诱捕；n.陷阱', '真题', ['真题词频4次'], ['v.使陷入困境；诱捕；n.陷阱'], ['trap appears in recent gaokao exams.']],
  ['citizen', 'n.', '公民；市民', '真题', ['真题词频4次'], ['公民；市民'], ['Every citizen has the right to vote in democratic elections.']],
  ['cautious', 'adj.', '小心的；谨慎的', '真题', ['真题词频4次'], ['小心的；谨慎的'], ['cautious appears in recent gaokao exams.']],
  ['federal', 'adj.', '联邦制的；联邦政府的', '真题', ['真题词频4次'], ['联邦制的；联邦政府的'], ['federal appears in recent gaokao exams.']],
  ['chief', 'adj./n.', 'adj.主要的；首要的；n.首领；酋长', '真题', ['真题词频4次'], ['adj.主要的；首要的；n.首领；酋长'], ['The chief editor approved the article for publication.']],
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
  ['expect', 'v.', '预料；预期；期待；指望', '真题', ['真题词频3次'], ['预料；预期；期待；指望'], ['We expect all students to arrive on time for the lecture.']],
  ['manage', 'v.', '管理；经营；设法做到', '真题', ['真题词频3次'], ['管理；经营；设法做到'], ['manage appears in recent gaokao exams.']],
  ['sensitive', 'adj.', '敏感的；灵敏的；善解人意的；易生气的；神经过敏的', '真题', ['真题词频3次'], ['敏感的；灵敏的；善解人意的；易生气的；神经过敏的'], ['sensitive appears in recent gaokao exams.']],
  ['attend', 'v.', 'v.出席；关心；处理', '真题', ['真题词频3次'], ['v.出席；关心；处理'], ['attend appears in recent gaokao exams.']],
  ['concern', 'v.', '关心（about）；涉及', '真题', ['真题词频3次'], ['关心（about）；涉及'], ['concern appears in recent gaokao exams.']],
  ['stress', 'v./n.', 'v.强调；n.压力；强调', '真题', ['真题词频3次'], ['v.强调；n.压力；强调'], ['stress appears in recent gaokao exams.']],
  ['seek', 'v.', '寻找，试图找到某物或某人', '真题', ['真题词频3次'], ['寻找，试图找到某物或某人'], ['Many students seek scholarships to help pay for tuition.']],
  ['equal', 'adj.', '相等的，表示数量、质量等相同', '真题', ['真题词频3次'], ['相等的，表示数量、质量等相同'], ['equal appears in recent gaokao exams.']],
  ['destruction', 'n.', '破坏，指对某物的毁坏', '真题', ['真题词频3次'], ['破坏，指对某物的毁坏'], ['destruction appears in recent gaokao exams.']],
  ['function', 'n./v.', 'n.功能，指某物或某系统的用途或作用；v.运行，起作用', '真题', ['真题词频3次'], ['n.功能，指某物或某系统的用途或作用；v.运行，起作用'], ['function appears in recent gaokao exams.']],
  ['repeat', 'v./n.', 'v./n.重复，指再做一次或多次做某事', '真题', ['真题词频3次'], ['v./n.重复，指再做一次或多次做某事'], ['Could you please repeat the question? I did not hear it clearly.']],
  ['strict', 'adj.', '严格的，指对规则、纪律等要求严格', '真题', ['真题词频3次'], ['严格的，指对规则、纪律等要求严格'], ['strict appears in recent gaokao exams.']],
  ['gradually', 'adv.', '逐渐地，指慢慢地、一步一步地', '真题', ['真题词频3次'], ['逐渐地，指慢慢地、一步一步地'], ['gradually appears in recent gaokao exams.']],
  ['belief', 'n.', '信念，指对某事的坚定信仰', '真题', ['真题词频3次'], ['信念，指对某事的坚定信仰'], ['belief appears in recent gaokao exams.']],
  ['imagination', 'n.', '想象力，指创造或构思新事物的能力', '真题', ['真题词频3次'], ['想象力，指创造或构思新事物的能力'], ['imagination appears in recent gaokao exams.']],
  ['recommend', 'v.', '推荐，指向他人介绍或提议某物', '真题', ['真题词频3次'], ['推荐，指向他人介绍或提议某物'], ['recommend appears in recent gaokao exams.']],
  ['literature', 'n.', '文学', '真题', ['真题词频3次'], ['文学'], ['literature appears in recent gaokao exams.']],
  ['object', 'v./n.', 'v.反对（to）；n.目标；物体', '真题', ['真题词频3次'], ['v.反对（to）；n.目标；物体'], ['Several residents objected to the new construction plan.']],
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
  ['combine', 'v.', '使结合；使联合；（使）混合', '真题', ['真题词频3次'], ['使结合；使联合；（使）混合'], ['The chef combined fresh ingredients to create a delicious dish.']],
  ['remark', 'v./n.', 'v.评论；说起；n.评论；言论', '真题', ['真题词频3次'], ['v.评论；说起；n.评论；言论'], ['remark appears in recent gaokao exams.']],
  ['curiosity', 'n.', '好奇心；求知欲', '真题', ['真题词频3次'], ['好奇心；求知欲'], ['curiosity appears in recent gaokao exams.']],
  ['atmosphere', 'n.', '大气；气氛；氛围', '真题', ['真题词频3次'], ['大气；气氛；氛围'], ['atmosphere appears in recent gaokao exams.']],
  ['recall', 'v./n.', 'v.回忆起；召回；收回；n.回忆；记忆力', '真题', ['真题词频3次'], ['v.回忆起；召回；收回；n.回忆；记忆力'], ['She could not recall where she had left her umbrella.']],
  ['resist', 'v.', '抵抗；抵制；忍住', '真题', ['真题词频3次'], ['抵抗；抵制；忍住'], ['It is hard to resist the temptation of eating chocolate.']],
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
  ['weigh', 'v.', '称（重量）；重达', '真题', ['真题词频2次'], ['称（重量）；重达'], ['The doctor weighed the baby on the small scale.']],
  ['credit', 'n.', '信用', '真题', ['真题词频2次'], ['信用'], ['credit appears in recent gaokao exams.']],
  ['deliver', 'v.', '递送；发表（演讲）', '真题', ['真题词频2次'], ['递送；发表（演讲）'], ['deliver appears in recent gaokao exams.']],
  ['spread', 'v.', '延伸；传播', '真题', ['真题词频2次'], ['延伸；传播'], ['The rumor spread quickly throughout the school.']],
  ['impress', 'v.', '使……有印象；留下深刻印象', '真题', ['真题词频2次'], ['使……有印象；留下深刻印象'], ['impress appears in recent gaokao exams.']],
  ['remind', 'v.', '提醒；使某人想起某事', '真题', ['真题词频2次'], ['提醒；使某人想起某事'], ['The calendar reminds me of my mother\'s birthday next week.']],
  ['guidance', 'n.', '指导，给予方向或建议', '真题', ['真题词频2次'], ['指导，给予方向或建议'], ['guidance appears in recent gaokao exams.']],
  ['emotion', 'n.', '情绪，强烈的感情或心情', '真题', ['真题词频2次'], ['情绪，强烈的感情或心情'], ['emotion appears in recent gaokao exams.']],
  ['reward', 'n./v.', '奖赏，给予报酬或奖励', '真题', ['真题词频2次'], ['奖赏，给予报酬或奖励'], ['The school rewarded the top students with certificates.']],
  ['judge', 'v./n.', 'v.判断，对某事做出评价或决定；n.法官，负责审判的人', '真题', ['真题词频2次'], ['v.判断，对某事做出评价或决定；n.法官，负责审判的人'], ['judge appears in recent gaokao exams.']],
  ['spirit', 'n.', '精神，指人的思想、意志或情绪状态', '真题', ['真题词频2次'], ['精神，指人的思想、意志或情绪状态'], ['spirit appears in recent gaokao exams.']],
  ['fairly', 'adv.', '公正地，指公平、不偏不倚地', '真题', ['真题词频2次'], ['公正地，指公平、不偏不倚地'], ['fairly appears in recent gaokao exams.']],
  ['fellow', 'n.', '同事，指一起工作的人', '真题', ['真题词频2次'], ['同事，指一起工作的人'], ['fellow appears in recent gaokao exams.']],
  ['predict', 'v.', '预言；预测', '真题', ['真题词频2次'], ['预言；预测'], ['predict appears in recent gaokao exams.']],
  ['handle', 'v.', '处理；应付', '真题', ['真题词频2次'], ['处理；应付'], ['She handled the difficult situation with great professionalism.']],
  ['opposite', 'adj.', '相反的；对面的', '真题', ['真题词频2次'], ['相反的；对面的'], ['opposite appears in recent gaokao exams.']],
  ['struggle', 'n./v.', 'n.斗争；挣扎；v.斗争；挣扎（against）', '真题', ['真题词频2次'], ['n.斗争；挣扎；v.斗争；挣扎（against）'], ['struggle appears in recent gaokao exams.']],
  ['delight', 'n.', '高兴；愉快', '真题', ['真题词频2次'], ['高兴；愉快'], ['delight appears in recent gaokao exams.']],
  ['talent', 'n.', '天赋；才华', '真题', ['真题词频2次'], ['天赋；才华'], ['talent appears in recent gaokao exams.']],
  ['permit', 'v.', '允许', '真题', ['真题词频2次'], ['允许'], ['The school does not permit students to leave during lunch.']],
  ['rapid', 'adj.', '迅速的', '真题', ['真题词频2次'], ['迅速的'], ['rapid appears in recent gaokao exams.']],
  ['conclude', 'v.', '总结', '真题', ['真题词频2次'], ['总结'], ['The scientist concluded that the experiment was a success.']],
  ['possess', 'v.', '拥有', '真题', ['真题词频2次'], ['拥有'], ['possess appears in recent gaokao exams.']],
  ['feature', 'n.', '特征', '真题', ['真题词频2次'], ['特征'], ['feature appears in recent gaokao exams.']],
  ['switch', 'v.', '转换（开/关）', '真题', ['真题词频2次'], ['转换（开/关）'], ['Please switch off the lights when you leave the room.']],
  ['fond', 'adj.', '喜欢的（of）', '真题', ['真题词频2次'], ['喜欢的（of）'], ['fond appears in recent gaokao exams.']],
  ['motivate', 'v.', '激发；激励', '真题', ['真题词频2次'], ['激发；激励'], ['motivate appears in recent gaokao exams.']],
  ['trick', 'v./n.', 'v.欺骗；n.诡计', '真题', ['真题词频2次'], ['v.欺骗；n.诡计'], ['The magician tricked the audience with his clever illusions.']],
  ['debate', 'v./n.', 'v./n.辩论；n.辩论会', '真题', ['真题词频2次'], ['v./n.辩论；n.辩论会'], ['The students debated passionately about climate change policies.']],
  ['deserve', 'v.', '应得；值得', '真题', ['真题词频2次'], ['应得；值得'], ['She deserves the award after years of dedicated service.']],
  ['alternative', 'adj./n.', 'adj.可供替代的；n.可供选择的事物', '真题', ['真题词频2次'], ['adj.可供替代的；n.可供选择的事物'], ['alternative appears in recent gaokao exams.']],
  ['analyze', 'v.', '分析', '真题', ['真题词频2次'], ['分析'], ['analyze appears in recent gaokao exams.']],
  ['legal', 'adj.', '法律的；合法的', '真题', ['真题词频2次'], ['法律的；合法的'], ['legal appears in recent gaokao exams.']],
  ['compete', 'v.', '竞争；比赛', '真题', ['真题词频2次'], ['竞争；比赛'], ['Students from different schools compete in the annual science fair.']],
  ['sharp', 'adj.', 'adj.锋利的；尖锐的；敏锐的', '真题', ['真题词频2次'], ['adj.锋利的；尖锐的；敏锐的'], ['sharp appears in recent gaokao exams.']],
  ['absorb', 'v.', '吸收；理解；使全神贯注', '真题', ['真题词频2次'], ['吸收；理解；使全神贯注'], ['absorb appears in recent gaokao exams.']],
  ['adapt', 'v.', '使适应；改编', '真题', ['真题词频2次'], ['使适应；改编'], ['adapt appears in recent gaokao exams.']],
  ['confidence', 'n.', '信心；信任', '真题', ['真题词频2次'], ['信心；信任'], ['confidence appears in recent gaokao exams.']],
  ['attach', 'v.', '系；贴；附加；使依恋', '真题', ['真题词频2次'], ['系；贴；附加；使依恋'], ['attach appears in recent gaokao exams.']],
  ['engage', 'v.', '吸引；使参与；从事', '真题', ['真题词频2次'], ['吸引；使参与；从事'], ['engage appears in recent gaokao exams.']],
  ['political', 'adj.', '政治的；政党的', '真题', ['真题词频2次'], ['政治的；政党的'], ['The political debate attracted a large television audience last night.']],
  ['adjust', 'v.', '调整；调节；适应', '真题', ['真题词频2次'], ['调整；调节；适应'], ['adjust appears in recent gaokao exams.']],
  ['capital', 'n.', 'n.首都；资本；大写字母', '真题', ['真题词频2次'], ['n.首都；资本；大写字母'], ['capital appears in recent gaokao exams.']],
  ['sweep', 'v./n.', 'v.打扫；清扫；席卷；迅速传播；n.打扫；挥动', '真题', ['真题词频2次'], ['v.打扫；清扫；席卷；迅速传播；n.打扫；挥动'], ['She swept the floor and mopped it until it was spotless.']],
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
  ['decrease', 'v./n.', 'v.减少；降低；n.减少；降低；减少量', '真题', ['真题词频2次'], ['v.减少；降低；n.减少；降低；减少量'], ['The number of smokers has decreased significantly in recent years.']],
  ['vast', 'adj.', '巨大的；辽阔的；大量的', '真题', ['真题词频2次'], ['巨大的；辽阔的；大量的'], ['The vast desert stretches for hundreds of kilometers in northwest China.']],
  ['acquire', 'v.', '获得；取得；学到', '真题', ['真题词频2次'], ['获得；取得；学到'], ['acquire appears in recent gaokao exams.']],
  ['estimate', 'v./n.', 'v.估计；估算；评价；n.估计；估算；评价', '真题', ['真题词频2次'], ['v.估计；估算；评价；n.估计；估算；评价'], ['estimate appears in recent gaokao exams.']],
  ['critical', 'adj.', '关键的；批判性的；危急的', '真题', ['真题词频2次'], ['关键的；批判性的；危急的'], ['critical appears in recent gaokao exams.']],
  ['strike', 'v./n.', 'v.撞击；击打；罢工；突然想到；n.罢工；袭击', '真题', ['真题词频2次'], ['v.撞击；击打；罢工；突然想到；n.罢工；袭击'], ['The workers went on strike to demand better wages.']],
  ['identify', 'v.', '认出；识别；鉴定；认同', '真题', ['真题词频2次'], ['认出；识别；鉴定；认同'], ['The witness helped police identify the suspect in the lineup.']],
  ['peer', 'v./n.', 'v.仔细看；端详；n.同龄人；同等地位的人', '真题', ['真题词频2次'], ['v.仔细看；端详；n.同龄人；同等地位的人'], ['peer appears in recent gaokao exams.']],
  ['loose', 'adj.', '宽松的；松散的；不牢固的', '真题', ['真题词频2次'], ['宽松的；松散的；不牢固的'], ['loose appears in recent gaokao exams.']],
  ['rough', 'adj.', '粗糙的；不平滑的；粗略的；艰难的', '真题', ['真题词频2次'], ['粗糙的；不平滑的；粗略的；艰难的'], ['rough appears in recent gaokao exams.']],
  ['negotiate', 'v.', '谈判；协商；洽谈', '真题', ['真题词频2次'], ['谈判；协商；洽谈'], ['The two companies negotiated a deal that benefited both sides.']],
  ['sculpture', 'n./v.', 'n.雕塑；雕刻作品；v.雕刻；雕塑', '真题', ['真题词频2次'], ['n.雕塑；雕刻作品；v.雕刻；雕塑'], ['sculpture appears in recent gaokao exams.']],
  ['unemployment', 'n.', '失业；失业率', '真题', ['真题词频2次'], ['失业；失业率'], ['unemployment appears in recent gaokao exams.']],
  ['seize', 'v.', '抓住；捉住；夺取；攻占；把握（机会等）', '真题', ['真题词频2次'], ['抓住；捉住；夺取；攻占；把握（机会等）'], ['The police seized a large quantity of illegal drugs.']],
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
  ['lean', 'v./adj.', 'v.倾斜；倚靠；靠在；adj.瘦且健康的；贫乏的；歉收的', '真题', ['真题词频2次'], ['v.倾斜；倚靠；靠在；adj.瘦且健康的；贫乏的；歉收的'], ['She leaned against the wall, exhausted after the long run.']],
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
  ['hang', 'v.', '悬挂；吊；垂下；（被）绞死；上吊；安装（门、窗等）', '真题', ['真题词频1次'], ['悬挂；吊；垂下；（被）绞死；上吊；安装（门、窗等）'], ['The painting hung on the wall of the living room.']],
  ['vary', 'v.', '改变；不同，指事物之间的差异或变化', '真题', ['真题词频1次'], ['改变；不同，指事物之间的差异或变化'], ['Prices vary from store to store, so compare before buying.']],
  ['suffer', 'v.', '遭受，指经历痛苦、损失或不幸', '真题', ['真题词频1次'], ['遭受，指经历痛苦、损失或不幸'], ['Many people suffer from allergies during spring.']],
  ['damage', 'v./n.', 'v.损害；n.损害', '真题', ['真题词频1次'], ['v.损害；n.损害'], ['The storm damaged several houses in the coastal village.']],
  ['visible', 'adj.', '可见的', '真题', ['真题词频1次'], ['可见的'], ['visible appears in recent gaokao exams.']],
  ['operate', 'v.', '操作；经营；动手术', '真题', ['真题词频1次'], ['操作；经营；动手术'], ['operate appears in recent gaokao exams.']],
  ['warn', 'v.', '警告', '真题', ['真题词频1次'], ['警告'], ['The weather forecast warned of heavy rain tomorrow.']],
  ['hardly', 'adv.', '几乎不，表示程度极低', '真题', ['真题词频1次'], ['几乎不，表示程度极低'], ['hardly appears in recent gaokao exams.']],
  ['greedy', 'adj.', '贪婪的，过分渴望或追求某物', '真题', ['真题词频1次'], ['贪婪的，过分渴望或追求某物'], ['greedy appears in recent gaokao exams.']],
  ['confuse', 'v.', '使困惑，让人迷惑不解', '真题', ['真题词频1次'], ['使困惑，让人迷惑不解'], ['confuse appears in recent gaokao exams.']],
  ['attempt', 'v./n.', 'v./n.企图；尝试做某事', '真题', ['真题词频1次'], ['v./n.企图；尝试做某事'], ['attempt appears in recent gaokao exams.']],
  ['argument', 'n.', '观点，指对某事的看法或争论', '真题', ['真题词频1次'], ['观点，指对某事的看法或争论'], ['argument appears in recent gaokao exams.']],
  ['desert', 'n.', '沙漠，指干旱、少雨的地区', '真题', ['真题词频1次'], ['沙漠，指干旱、少雨的地区'], ['desert appears in recent gaokao exams.']],
  ['seldom', 'adv.', '很少，指不常发生或出现的', '真题', ['真题词频1次'], ['很少，指不常发生或出现的'], ['seldom appears in recent gaokao exams.']],
  ['consume', 'v.', '消耗；消费', '真题', ['真题词频1次'], ['消耗；消费'], ['consume appears in recent gaokao exams.']],
  ['devote', 'v.', '致力于（to）；专心于', '真题', ['真题词频1次'], ['致力于（to）；专心于'], ['He devoted his entire life to studying ancient Chinese history.']],
  ['complain', 'v.', '抱怨（to/about）', '真题', ['真题词频1次'], ['抱怨（to/about）'], ['The customer complained about the slow service at the restaurant.']],
  ['annoy', 'v.', '使恼怒；烦扰', '真题', ['真题词频1次'], ['使恼怒；烦扰'], ['annoy appears in recent gaokao exams.']],
  ['arrange', 'v.', '安排；筹划', '真题', ['真题词频1次'], ['安排；筹划'], ['arrange appears in recent gaokao exams.']],
  ['rarely', 'adv.', '很少；不常', '真题', ['真题词频1次'], ['很少；不常'], ['rarely appears in recent gaokao exams.']],
  ['colleague', 'n.', '同事', '真题', ['真题词频1次'], ['同事'], ['colleague appears in recent gaokao exams.']],
  ['survive', 'v.', '幸存', '真题', ['真题词频1次'], ['幸存'], ['Only two passengers survived the terrible car accident.']],
  ['surround', 'v.', '包围', '真题', ['真题词频1次'], ['包围'], ['A tall fence surrounds the school to keep students safe.']],
  ['cast', 'v.', '投射；掷', '真题', ['真题词频1次'], ['投射；掷'], ['cast appears in recent gaokao exams.']],
  ['aware', 'adj.', '意识到的（of）', '真题', ['真题词频1次'], ['意识到的（of）'], ['aware appears in recent gaokao exams.']],
  ['narrow', 'v./adj.', 'v.（使）变窄；adj.狭窄的', '真题', ['真题词频1次'], ['v.（使）变窄；adj.狭窄的'], ['The road narrowed as we drove further into the mountains.']],
  ['conduct', 'v.', '实施；指挥', '真题', ['真题词频1次'], ['实施；指挥'], ['conduct appears in recent gaokao exams.']],
  ['overcome', 'v.', '战胜；克服', '真题', ['真题词频1次'], ['战胜；克服'], ['overcome appears in recent gaokao exams.']],
  ['translate', 'v.', '翻译', '真题', ['真题词频1次'], ['翻译'], ['She translates Chinese novels into English for a living.']],
  ['guard', 'v./n.', 'v.保卫；n.看守人', '真题', ['真题词频1次'], ['v.保卫；n.看守人'], ['guard appears in recent gaokao exams.']],
  ['anxiety', 'n.', '焦虑；不安', '真题', ['真题词频1次'], ['焦虑；不安'], ['anxiety appears in recent gaokao exams.']],
  ['concentrate', 'v.', '集中（注意力等）；专心', '真题', ['真题词频1次'], ['集中（注意力等）；专心'], ['concentrate appears in recent gaokao exams.']],
  ['quit', 'v.', '停止；放弃；离开', '真题', ['真题词频1次'], ['停止；放弃；离开'], ['quit appears in recent gaokao exams.']],
  ['stare', 'v./n.', 'v./n.凝视；盯着看', '真题', ['真题词频1次'], ['v./n.凝视；盯着看'], ['The boy stared at the ice cream, wanting some badly.']],
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
  ['guarantee', 'v./n.', 'v.保证；担保；n.保证；担保；保修单', '真题', ['真题词频1次'], ['v.保证；担保；n.保证；担保；保修单'], ['The company guarantees the quality of all its products.']],
  ['block', 'v./n.', 'v.堵塞；阻碍；n.街区；大块；障碍物', '真题', ['真题词频1次'], ['v.堵塞；阻碍；n.街区；大块；障碍物'], ['block appears in recent gaokao exams.']],
  ['emergency', 'n.', '紧急情况；突发事件', '真题', ['真题词频1次'], ['紧急情况；突发事件'], ['emergency appears in recent gaokao exams.']],
  ['sink', 'v./n.', 'v.下沉；沉没；使下降；陷入（困境等）；n.水槽', '真题', ['真题词频1次'], ['v.下沉；沉没；使下降；陷入（困境等）；n.水槽'], ['The Titanic sank after hitting an iceberg in 1912.']],
  ['wander', 'v.', '徘徊；漫步；走神', '真题', ['真题词频1次'], ['徘徊；漫步；走神'], ['The lost child wandered through the streets for hours.']],
  ['precise', 'adj.', '精确的；准确的；确切的', '真题', ['真题词频1次'], ['精确的；准确的；确切的'], ['precise appears in recent gaokao exams.']],
  ['gap', 'n.', '缺口；差距；间隙', '真题', ['真题词频1次'], ['缺口；差距；间隙'], ['gap appears in recent gaokao exams.']],
  ['apparent', 'adj.', '显而易见的；明显的；表面上的', '真题', ['真题词频1次'], ['显而易见的；明显的；表面上的'], ['apparent appears in recent gaokao exams.']],
  ['withdraw', 'v.', '撤回；撤离；取（款）；退出', '真题', ['真题词频1次'], ['撤回；撤离；取（款）；退出'], ['He withdrew some money from the ATM before going shopping.']],
  ['enable', 'v.', '使能够；使成为可能', '真题', ['真题词频1次'], ['使能够；使成为可能'], ['enable appears in recent gaokao exams.']],
  ['thick', 'adj.', 'adj.厚的；浓的；茂密的', '真题', ['真题词频1次'], ['adj.厚的；浓的；茂密的'], ['thick appears in recent gaokao exams.']],
  ['optimistic', 'adj.', '乐观的；乐观主义的', '真题', ['真题词频1次'], ['乐观的；乐观主义的'], ['optimistic appears in recent gaokao exams.']],
  ['addiction', 'n.', '上瘾；沉溺；嗜好', '真题', ['真题词频1次'], ['上瘾；沉溺；嗜好'], ['addiction appears in recent gaokao exams.']],
  ['facility', 'n.', '设施；设备；便利；才能', '真题', ['真题词频1次'], ['设施；设备；便利；才能'], ['facility appears in recent gaokao exams.']],
  ['associate', 'v./n.', 'v.联想；联系；交往；n.同事；伙伴', '真题', ['真题词频1次'], ['v.联想；联系；交往；n.同事；伙伴'], ['associate appears in recent gaokao exams.']],
  ['severe', 'adj.', '严峻的；严厉的；严重的', '真题', ['真题词频1次'], ['严峻的；严厉的；严重的'], ['severe appears in recent gaokao exams.']],
  ['chain', 'n./v.', 'n.链子；链条；一连串；连锁店；v.用链子拴住', '真题', ['真题词频1次'], ['n.链子；链条；一连串；连锁店；v.用链子拴住'], ['chain appears in recent gaokao exams.']],
  ['preserve', 'v.', '保护；维护；保存；腌制', '真题', ['真题词频1次'], ['保护；维护；保存；腌制'], ['preserve appears in recent gaokao exams.']],
  ['manufacture', 'v./n.', 'v.（用机器大量）制造，生产；编造；n.制造；制造业', '真题', ['真题词频1次'], ['v.（用机器大量）制造，生产；编造；n.制造；制造业'], ['The factory manufactures car parts for several major brands.']],
  ['foundation', 'n.', '基础；地基；基金会', '真题', ['真题词频1次'], ['基础；地基；基金会'], ['foundation appears in recent gaokao exams.']],
  ['temporary', 'adj.', '暂时的；临时的', '真题', ['真题词频1次'], ['暂时的；临时的'], ['temporary appears in recent gaokao exams.']],
  ['beneficial', 'adj.', '有益的；有利的', '真题', ['真题词频1次'], ['有益的；有利的'], ['beneficial appears in recent gaokao exams.']],
  ['define', 'v.', '给……下定义；界定；明确', '真题', ['真题词频1次'], ['给……下定义；界定；明确'], ['define appears in recent gaokao exams.']],
  ['exhausted', 'adj.', '筋疲力尽的；耗尽的', '真题', ['真题词频1次'], ['筋疲力尽的；耗尽的'], ['exhausted appears in recent gaokao exams.']],
  ['glance', 'v./n.', 'v.瞥一眼；匆匆一看；n.一瞥；匆匆一看', '真题', ['真题词频1次'], ['v.瞥一眼；匆匆一看；n.一瞥；匆匆一看'], ['She glanced at her watch and realized she was late.']],
  ['uncertain', 'adj.', '不确定的；无把握的；多变的', '真题', ['真题词频1次'], ['不确定的；无把握的；多变的'], ['uncertain appears in recent gaokao exams.']],
  ['ashamed', 'adj.', '羞愧的；惭愧的', '真题', ['真题词频1次'], ['羞愧的；惭愧的'], ['ashamed appears in recent gaokao exams.']],
  ['illegal', 'adj.', '非法的；违法的', '真题', ['真题词频1次'], ['非法的；违法的'], ['It is illegal to drive through a red traffic light.']],
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
  ['swallow', 'v./n.', 'v.吞下；咽下；（因紧张等）做吞咽动作；吞没；淹没；n.吞；咽；燕子', '真题', ['真题词频1次'], ['v.吞下；咽下；（因紧张等）做吞咽动作；吞没；淹没；n.吞；咽；燕子'], ['She swallowed the medicine with a glass of water.']],
  ['fulfill', 'v.', '履行（诺言等）；执行（命令等）；实现（梦想等）；满足（需求等）', '真题', ['真题词频1次'], ['履行（诺言等）；执行（命令等）；实现（梦想等）；满足（需求等）'], ['fulfill appears in recent gaokao exams.']],
  ['unforgettable', 'adj.', '难以忘记的；令人难忘的', '真题', ['真题词频1次'], ['难以忘记的；令人难忘的'], ['unforgettable appears in recent gaokao exams.']],
  ['abstract', 'adj./n./v.', 'adj.抽象的；纯理论的；n.摘要；抽象派艺术作品；v.提取；抽取；使抽象化', '真题', ['真题词频1次'], ['adj.抽象的；纯理论的；n.摘要；抽象派艺术作品；v.提取；抽取；使抽象化'], ['abstract appears in recent gaokao exams.']],
  ['appetite', 'n.', '食欲；胃口；强烈欲望', '真题', ['真题词频1次'], ['食欲；胃口；强烈欲望'], ['appetite appears in recent gaokao exams.']],
  ['vain', 'adj.', '徒劳的；无效的；自负的；虚荣的', '真题', ['真题词频1次'], ['徒劳的；无效的；自负的；虚荣的'], ['vain appears in recent gaokao exams.']],
  ['breakthrough', 'n.', '突破；重大进展', '真题', ['真题词频1次'], ['突破；重大进展'], ['breakthrough appears in recent gaokao exams.']],
  ['mature', 'adj./v.', 'adj.成熟的；理智的；成年的；发育完全的；v.成熟；长成；使成熟', '真题', ['真题词频1次'], ['adj.成熟的；理智的；成年的；发育完全的；v.成熟；长成；使成熟'], ['She has matured a lot since her first year of college.']],
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
  ['twist', 'v./n.', '扭曲、转动', '真题', ['真题词频1次'], ['扭曲、转动'], ['She twisted her ankle while playing basketball.']],
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
  ['mature', 'adj.', '褒义（积极态度）—— 成熟的，理智的', '褒贬', ['作文可表达积极态度'], ['褒义词，可用于描写人物品质'], ['She has matured a lot since her first year of college.']],
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
  ['mean', 'adj.', '贬义（消极态度）—— 吝啬的，刻薄的', '褒贬', ['注意情感色彩辨析'], ['贬义词，阅读中常表达消极态度'], ['What does this word mean in the context of the passage?']],
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
  ['encounter', 'vt.', '遭遇，遇到', '超纲', ['超纲高频词'], ['遭遇，遇到'], ['During the hike, we encountered a rare species of butterfly.']],
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
  ['generate', 'vt.', '使形成，产生', '超纲', ['超纲高频词'], ['使形成，产生'], ['Solar panels generate electricity from sunlight.']],
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
  ['lean', 'vi.', '倾斜，倚靠', '超纲', ['超纲高频词'], ['倾斜，倚靠'], ['She leaned against the wall, exhausted after the long run.']],
  ['likelihood', 'n.', '可能，可能性', '超纲', ['超纲高频词'], ['可能，可能性'], ['likelihood is beyond the syllabus but frequently tested.']],
  ['lobby', 'n.', '大厅，休息室', '超纲', ['超纲高频词'], ['大厅，休息室'], ['lobby is beyond the syllabus but frequently tested.']],
  ['logic', 'n.', '逻辑', '超纲', ['超纲高频词'], ['逻辑'], ['logic is beyond the syllabus but frequently tested.']],
  ['magnetic', 'adj.', '有磁性的，有吸引力的', '超纲', ['超纲高频词'], ['有磁性的，有吸引力的'], ['magnetic is beyond the syllabus but frequently tested.']],
  ['manufacture', 'vt./n.', '大量制造', '超纲', ['超纲高频词'], ['大量制造'], ['The factory manufactures car parts for several major brands.']],
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
  ['resolve', 'vt.', '解决问题、困难', '超纲', ['超纲高频词'], ['解决问题、困难'], ['The two sides resolved their differences through negotiation.']],
  ['retail', 'v./n.', '零售', '超纲', ['超纲高频词'], ['零售'], ['retail is beyond the syllabus but frequently tested.']],
  ['reverse', 'n./vt.', '相反；颠倒', '超纲', ['超纲高频词'], ['相反；颠倒'], ['reverse is beyond the syllabus but frequently tested.']],
  ['salvage', 'n./vt.', '打捞；抢救', '超纲', ['超纲高频词'], ['打捞；抢救'], ['salvage is beyond the syllabus but frequently tested.']],
  ['simulator', 'n.', '模拟装置', '超纲', ['超纲高频词'], ['模拟装置'], ['simulator is beyond the syllabus but frequently tested.']],
  ['source', 'n.', '来源，水源', '超纲', ['超纲高频词'], ['来源，水源'], ['source is beyond the syllabus but frequently tested.']],
  ['spacecraft', 'n.', '宇宙飞船', '超纲', ['超纲高频词'], ['宇宙飞船'], ['spacecraft is beyond the syllabus but frequently tested.']],
  ['span', 'n.', '跨度，范围', '超纲', ['超纲高频词'], ['跨度，范围'], ['span is beyond the syllabus but frequently tested.']],
  ['species', 'n.', '物种，种类', '超纲', ['超纲高频词'], ['物种，种类'], ['species is beyond the syllabus but frequently tested.']],
  ['spectator', 'n.', '观众，旁观者', '超纲', ['超纲高频词'], ['观众，旁观者'], ['spectator is beyond the syllabus but frequently tested.']],
  ['stimulate', 'vt.', '刺激，鼓舞', '超纲', ['超纲高频词'], ['刺激，鼓舞'], ['Good questions can stimulate students to think more deeply.']],
  ['stretch', 'vt.', '伸展；张开', '超纲', ['超纲高频词'], ['伸展；张开'], ['She stretched her arms after sitting at the desk for hours.']],
  ['tame', 'adj.', '驯服的，平淡的', '超纲', ['超纲高频词'], ['驯服的，平淡的'], ['tame is beyond the syllabus but frequently tested.']],
  ['temper', 'n.', '脾气', '超纲', ['超纲高频词'], ['脾气'], ['temper is beyond the syllabus but frequently tested.']],
  ['territory', 'n.', '领土，领域', '超纲', ['超纲高频词'], ['领土，领域'], ['territory is beyond the syllabus but frequently tested.']],
  ['totem', 'n.', '图腾', '超纲', ['超纲高频词'], ['图腾'], ['totem is beyond the syllabus but frequently tested.']],
  ['transfer', 'n./v.', '转让，转移', '超纲', ['超纲高频词'], ['转让，转移'], ['transfer is beyond the syllabus but frequently tested.']],
  ['transplant', 'n./v.', '移植', '超纲', ['超纲高频词'], ['移植'], ['transplant is beyond the syllabus but frequently tested.']],
  ['tuition', 'n.', '学费，讲授', '超纲', ['超纲高频词'], ['学费，讲授'], ['tuition is beyond the syllabus but frequently tested.']],
  ['wreck', 'n.', '失事，残骸', '超纲', ['超纲高频词'], ['失事，残骸'], ['The storm wrecked several boats at the marina.']]
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
  // 原有30个
  ['address', 'n.', '地址；v. 解决(问题)', '生义', ['熟词生义', 'address the problem'], ['地址；v. 解决(问题)', '注意一词多义'], ['The principal addressed the problem during the school assembly.']],
  ['accommodate', 'v.', '容纳；提供住宿；适应', '生义', ['熟词生义', 'accommodate 500 guests'], ['容纳；提供住宿；适应', '注意一词多义'], ['The new hotel can accommodate up to 500 guests at once.']],
  ['affect', 'v.', '影响；感动；假装', '生义', ['熟词生义', 'affect an accent'], ['影响；感动；假装', '注意一词多义'], ['She affected a French accent to sound more sophisticated.']],
  ['book', 'v.', '预订', '生义', ['熟词生义', 'book a hotel room'], ['预订', '注意一词多义'], ['I booked a hotel room online for our trip to Beijing.']],
  ['cause', 'n.', '事业；目标', '生义', ['熟词生义', 'a worthy cause'], ['事业；目标', '注意一词多义'], ['She devoted her life to a worthy cause — protecting wildlife.']],
  ['change', 'n.', '零钱', '生义', ['熟词生义', 'keep the change'], ['零钱', '注意一词多义'], ['Here is twenty yuan; keep the change, the waiter said.']],
  ['company', 'n.', '公司；陪伴', '生义', ['熟词生义', 'enjoy his company'], ['公司；陪伴', '注意一词多义'], ['I really enjoyed his company during the long train ride.']],
  ['conduct', 'v.', '指挥(音乐)；实施', '生义', ['熟词生义', 'conduct an orchestra'], ['指挥(音乐)；实施', '注意一词多义'], ['The maestro conducted the orchestra with great passion last night.']],
  ['cover', 'v.', '报道；行走(距离)', '生义', ['熟词生义', 'cover 10 kilometers'], ['报道；行走(距离)', '注意一词多义'], ['The athletes covered 10 kilometers in under 40 minutes.']],
  ['develop', 'v.', '养成(习惯)；冲洗(照片)', '生义', ['熟词生义', 'develop a habit'], ['养成(习惯)；冲洗(照片)', '注意一词多义'], ['It takes persistence to develop a good study habit.']],
  ['draw', 'v.', '拉；得出结论；吸引', '生义', ['熟词生义', 'draw a conclusion'], ['拉；得出结论；吸引', '注意一词多义'], ['We can draw a conclusion from the experimental data collected.']],
  ['engage', 'v.', '从事；订婚；吸引', '生义', ['熟词生义', 'engage in research'], ['从事；订婚；吸引', '注意一词多义'], ['She engaged in research on renewable energy at the university lab.']],
  ['express', 'n.', '快车；快递', '生义', ['熟词生义', 'take the express'], ['快车；快递', '注意一词多义'], ['Take the express train if you want to reach Shanghai faster.']],
  ['fail', 'v.', '未能(做某事)；使失望', '生义', ['熟词生义', 'fail to pass'], ['未能(做某事)；使失望', '注意一词多义'], ['He failed the driving test because he was too nervous.']],
  ['observe', 'v.', '遵守(规则)；庆祝(节日)', '生义', ['熟词生义', 'observe the rules / observe Christmas'], ['遵守(规则)；庆祝(节日)', '注意一词多义'], ['All students must observe the school rules at all times.']],
  ['owe', 'v.', '欠；把...归功于', '生义', ['熟词生义', 'owe success to'], ['欠；把...归功于', '注意一词多义'], ['She owed her success to years of hard work and dedication.']],
  ['plant', 'n.', '工厂；发电厂', '生义', ['熟词生义', 'a power plant'], ['工厂；发电厂', '注意一词多义'], ['A new power plant was built on the outskirts of the city.']],
  ['position', 'n.', '立场；职位', '生义', ['熟词生义', 'take a position'], ['立场；职位', '注意一词多义'], ['The senator took a firm position on the climate change issue.']],
  ['purchase', 'v.', '购买(正式)', '生义', ['熟词生义', 'purchase equipment'], ['购买(正式)', '注意一词多义'], ['The school purchased new lab equipment for the science department.']],
  ['read', 'v.', '解读；攻读', '生义', ['熟词生义', 'read one\'s mind'], ['解读；攻读', '注意一词多义'], ['He could read her mind from the look in her eyes.']],
  ['reason', 'v.', '推理；说服', '生义', ['熟词生义', 'reason with someone'], ['推理；说服', '注意一词多义'], ['She tried to reason with him, but he refused to listen.']],
  ['remain', 'v.', '仍然是；留下', '生义', ['熟词生义', 'remain silent'], ['仍然是；留下', '注意一词多义'], ['Please remain silent while the exam is in progress.']],
  ['second', 'v.', '赞成；附议', '生义', ['熟词生义', 'second the motion'], ['赞成；附议', '注意一词多义'], ['I second the motion to extend the library hours on weekends.']],
  ['sound', 'adj.', '合理的；完好的', '生义', ['熟词生义', 'a sound argument'], ['合理的；完好的', '注意一词多义'], ['The alarm sounded at exactly seven in the morning.']],
  ['stand', 'v.', '忍受；代表', '生义', ['熟词生义', 'can\'t stand the noise'], ['忍受；代表', '注意一词多义'], ['I cannot stand the noise from the construction site next door.']],
  ['tap', 'v.', '开发；利用', '生义', ['熟词生义', 'tap natural resources'], ['开发；利用', '注意一词多义'], ['The country taps its natural resources for economic growth.']],
  ['term', 'n.', '学期；术语；条款', '生义', ['熟词生义', 'in terms of'], ['学期；术语；条款', '注意一词多义'], ['In terms of quality, this product is the best on the market.']],
  ['walk', 'n.', '职业；阶层', '生义', ['熟词生义', 'people from all walks of life'], ['职业；阶层', '注意一词多义'], ['We walked along the beach as the sun set slowly.']],
  // 新增：高考高频熟词生义
  ['absorb', 'v.', '吸收；理解；承受(打击)', '生义', ['熟词生义', 'absorb the cost'], ['吸收；理解；承受(打击)', '注意一词多义'], ['The company absorbed the increased costs.']],
  ['admit', 'v.', '承认；准许进入；可容纳', '生义', ['熟词生义', 'admit 500 people'], ['承认；准许进入；可容纳', '注意一词多义'], ['The hall admits 500 people.']],
  ['advance', 'n./v.', '预付款；提前；进步', '生义', ['熟词生义', 'in advance'], ['预付款；提前；进步', '注意一词多义'], ['Please pay in advance.']],
  ['approach', 'n.', '方法；途径；接近', '生义', ['熟词生义', 'a new approach to'], ['方法；途径；接近', '注意一词多义'], ['We need a new approach to the problem.']],
  ['argue', 'v.', '争论；主张；说服', '生义', ['熟词生义', 'argue sb into doing'], ['争论；主张；说服', '注意一词多义'], ['She argued him into changing his mind.']],
  ['attend', 'v.', '出席；照料；处理', '生义', ['熟词生义', 'attend to a patient'], ['出席；照料；处理', '注意一词多义'], ['The nurse attended to the patient.']],
  ['balance', 'n.', '余额；平衡', '生义', ['熟词生义', 'bank balance'], ['余额；平衡', '注意一词多义'], ['Check your account balance.']],
  ['bear', 'v.', '承担；忍受；生育；带有', '生义', ['熟词生义', 'bear in mind'], ['承担；忍受；生育；带有', '注意一词多义'], ['Bear in mind that deadlines are strict.']],
  ['beat', 'v.', '打败；跳动；搅拌', '生义', ['熟词生义', 'beat the eggs'], ['打败；跳动；搅拌', '注意一词多义'], ['Beat the eggs before adding flour.']],
  ['block', 'n./v.', '街区；阻塞；一批', '生义', ['熟词生义', 'a block of tickets'], ['街区；阻塞；一批', '注意一词多义'], ['I bought a block of tickets.']],
  ['board', 'n./v.', '木板；委员会；上(车/船)', '生义', ['熟词生义', 'board the train'], ['木板；委员会；上(车/船)', '注意一词多义'], ['Passengers boarded the train.']],
  ['break', 'n.', '休息；机会；裂口', '生义', ['熟词生义', 'take a break'], ['休息；机会；裂口', '注意一词多义'], ['Let\'s take a coffee break.']],
  ['breed', 'v./n.', '繁殖；品种；培育', '生义', ['熟词生义', 'a rare breed'], ['繁殖；品种；培育', '注意一词多义'], ['These dogs are a rare breed.']],
  ['capital', 'n.', '首都；资本；大写字母', '生义', ['熟词生义', 'capital letter'], ['首都；资本；大写字母', '注意一词多义'], ['Write your name in capital letters.']],
  ['catch', 'v.', '抓住；理解；赶上；感染', '生义', ['熟词生义', 'catch a cold / catch on'], ['抓住；理解；赶上；感染', '注意一词多义'], ['I didn\'t catch what you said.']],
  ['channel', 'n.', '频道；渠道；海峡', '生义', ['熟词生义', 'diplomatic channels'], ['频道；渠道；海峡', '注意一词多义'], ['The news spread through official channels.']],
  ['charge', 'v./n.', '收费；充电；指控；负责', '生义', ['熟词生义', 'in charge of'], ['收费；充电；指控；负责', '注意一词多义'], ['She is in charge of the project.']],
  ['claim', 'v.', '声称；索取；认领', '生义', ['熟词生义', 'claim luggage'], ['声称；索取；认领', '注意一词多义'], ['Passengers should claim their luggage.']],
  ['class', 'n.', '班级；阶级；种类；优秀', '生义', ['熟词生义', 'world-class'], ['班级；阶级；种类；优秀', '注意一词多义'], ['He showed real class in the match.']],
  ['climate', 'n.', '气候；风气；氛围', '生义', ['熟词生义', 'a climate of fear'], ['气候；风气；氛围', '注意一词多义'], ['There is a climate of distrust in the office.']],
  ['commit', 'v.', '犯罪；承诺；投入', '生义', ['熟词生义', 'commit oneself to'], ['犯罪；承诺；投入', '注意一词多义'], ['He committed himself to the project.']],
  ['compose', 'v.', '创作；组成；使平静', '生义', ['熟词生义', 'compose oneself'], ['创作；组成；使平静', '注意一词多义'], ['She composed herself before speaking.']],
  ['deliver', 'v.', '递送；发表(演讲)；履行', '生义', ['熟词生义', 'deliver a speech'], ['递送；发表(演讲)；履行', '注意一词多义'], ['The mayor delivered a speech.']],
  ['discipline', 'n./v.', '纪律；学科；训练', '生义', ['熟词生义', 'academic discipline'], ['纪律；学科；训练', '注意一词多义'], ['Sociology is a broad discipline.']],
  ['drive', 'v./n.', '驾驶；驱使；动力；运动', '生义', ['熟词生义', 'a sales drive'], ['驾驶；驱使；动力；运动', '注意一词多义'], ['Hunger drove him to steal.']],
  ['employ', 'v.', '雇用；使用；利用', '生义', ['熟词生义', 'employ a method'], ['雇用；使用；利用', '注意一词多义'], ['She employed a new teaching method.']],
  ['enterprise', 'n.', '企业；事业心；项目', '生义', ['熟词生义', 'a joint enterprise'], ['企业；事业心；项目', '注意一词多义'], ['He showed great enterprise.']],
  ['escape', 'v./n.', '逃跑；逃避；被忘记', '生义', ['熟词生义', 'escape memory'], ['逃跑；逃避；被忘记', '注意一词多义'], ['His name escapes me.']],
  ['establish', 'v.', '建立；确立；证实', '生义', ['熟词生义', 'establish the truth'], ['建立；确立；证实', '注意一词多义'], ['Scientists established the truth of the theory.']],
  ['even', 'adj./adv.', '平坦的；甚至；恰好', '生义', ['熟词生义', 'even chance'], ['平坦的；甚至；恰好', '注意一词多义'], ['The ground is even here.']],
  ['exit', 'n./v.', '出口；退出；离开', '生义', ['熟词生义', 'exit the market'], ['出口；退出；离开', '注意一词多义'], ['The company exited the market.']],
  ['fair', 'adj./n.', '公平的；集市；博览会', '生义', ['熟词生义', 'trade fair'], ['公平的；集市；博览会', '注意一词多义'], ['They met at the trade fair.']],
  ['field', 'n.', '田野；领域；球场；(电/磁)场', '生义', ['熟词生义', 'magnetic field'], ['田野；领域；球场；(电/磁)场', '注意一词多义'], ['She works in the medical field.']],
  ['figure', 'n./v.', '数字；人物；计算；理解', '生义', ['熟词生义', 'figure out'], ['数字；人物；计算；理解', '注意一词多义'], ['I can\'t figure out the answer.']],
  ['fire', 'v.', '解雇；开火；激发', '生义', ['熟词生义', 'fire an employee'], ['解雇；开火；激发', '注意一词多义'], ['He was fired for being late.']],
  ['flat', 'adj./n.', '平坦的；公寓；平淡的', '生义', ['熟词生义', 'a new flat'], ['平坦的；公寓；平淡的', '注意一词多义'], ['They live in a new flat.']],
  ['follow', 'v.', '跟随；遵循；理解', '生义', ['熟词生义', 'follow the argument'], ['跟随；遵循；理解', '注意一词多义'], ['Please follow the instructions on the screen step by step.']],
  ['force', 'n./v.', '力量；武力；强迫', '生义', ['熟词生义', 'in force'], ['力量；武力；强迫', '注意一词多义'], ['The rules are in force.']],
  ['form', 'n./v.', '表格；形式；养成', '生义', ['熟词生义', 'fill in a form'], ['表格；形式；养成', '注意一词多义'], ['Please fill in this form.']],
  ['freeze', 'v.', '结冰；冻结(资产)；呆住', '生义', ['熟词生义', 'freeze assets'], ['结冰；冻结(资产)；呆住', '注意一词多义'], ['The lake froze over completely during the harsh winter.']],
  ['fresh', 'adj.', '新鲜的；新颖的；(水)淡的', '生义', ['熟词生义', 'fresh water'], ['新鲜的；新颖的；(水)淡的', '注意一词多义'], ['Fish live in fresh water.']],
  ['game', 'n.', '游戏；猎物；比赛', '生义', ['熟词生义', 'big game'], ['游戏；猎物；比赛', '注意一词多义'], ['He hunted big game in Africa.']],
  ['gift', 'n.', '礼物；天赋', '生义', ['熟词生义', 'a gift for music'], ['礼物；天赋', '注意一词多义'], ['She has a gift for languages.']],
  ['grill', 'v./n.', '烤；盘问', '生义', ['熟词生义', 'grill a suspect'], ['烤；盘问', '注意一词多义'], ['The police grilled the suspect.']],
  ['harbor', 'n./v.', '港口；怀有(念头)', '生义', ['熟词生义', 'harbor doubts'], ['港口；怀有(念头)', '注意一词多义'], ['He harbored doubts about the plan.']],
  ['heavy', 'adj.', '重的；大量的；严重的', '生义', ['熟词生义', 'heavy rain'], ['重的；大量的；严重的', '注意一词多义'], ['There was heavy rain last night.']],
  ['hit', 'v./n.', '打击；碰撞；成功', '生义', ['熟词生义', 'a hit song'], ['打击；碰撞；成功', '注意一词多义'], ['The baseball hit the window and shattered the glass.']],
  ['hold', 'v.', '握住；举行；容纳；持有', '生义', ['熟词生义', 'hold a meeting'], ['握住；举行；容纳；持有', '注意一词多义'], ['Please hold the baby gently while I prepare the milk.']],
  ['introduce', 'v.', '介绍；推行；引入', '生义', ['熟词生义', 'introduce a bill'], ['介绍；推行；引入', '注意一词多义'], ['The teacher introduced a new topic in today\'s lesson.']],
  ['iron', 'n./v.', '铁；熨斗；熨烫', '生义', ['熟词生义', 'iron a shirt'], ['铁；熨斗；熨烫', '注意一词多义'], ['She ironed her shirt.']],
  ['kill', 'v.', '杀死；消磨(时间)；终止', '生义', ['熟词生义', 'kill time'], ['杀死；消磨(时间)；终止', '注意一词多义'], ['We killed time at the cafe.']],
  ['labour', 'n./v.', '劳动；劳工；努力', '生义', ['熟词生义', 'labour market'], ['劳动；劳工；努力', '注意一词多义'], ['The labour market is competitive.']],
  ['last', 'v./adj.', '持续；最后的', '生义', ['熟词生义', 'last for hours'], ['持续；最后的', '注意一词多义'], ['The meeting lasted two hours.']],
  ['lay', 'v.', '放置；产卵；铺设', '生义', ['熟词生义', 'lay eggs'], ['放置；产卵；铺设', '注意一词多义'], ['Birds lay eggs in spring.']],
  ['lecture', 'n./v.', '讲座；训斥', '生义', ['熟词生义', 'give a lecture'], ['讲座；训斥', '注意一词多义'], ['His father lectured him on responsibility.']],
  ['letter', 'n.', '字母；信件；证书', '生义', ['熟词生义', 'capital letter'], ['字母；信件；证书', '注意一词多义'], ['The word has five letters.']],
  ['live', 'v./adj.', '居住；现场的；直播的', '生义', ['熟词生义', 'live broadcast'], ['居住；现场的；直播的', '注意一词多义'], ['Many people live in apartments in big cities like Beijing.']],
  ['match', 'n./v.', '比赛；火柴；匹配', '生义', ['熟词生义', 'a perfect match'], ['比赛；火柴；匹配', '注意一词多义'], ['The curtains match the sofa.']],
  ['mean', 'v./adj.', '意味着；吝啬的；平均的', '生义', ['熟词生义', 'mean temperature'], ['意味着；吝啬的；平均的', '注意一词多义'], ['What does this word mean in the context of the passage?']],
  ['meet', 'v.', '遇见；满足；支付', '生义', ['熟词生义', 'meet the cost'], ['遇见；满足；支付', '注意一词多义'], ['The company met all the costs.']],
  ['mine', 'pron./n.', '我的；矿；地雷', '生义', ['熟词生义', 'a coal mine'], ['我的；矿；地雷', '注意一词多义'], ['He works in a coal mine.']],
  ['mount', 'v.', '登上；增加； mounting', '生义', ['熟词生义', 'mount pressure'], ['登上；增加', '注意一词多义'], ['Pressure mounted on the team.']],
  ['novel', 'n./adj.', '小说；新颖的', '生义', ['熟词生义', 'a novel idea'], ['小说；新颖的', '注意一词多义'], ['That\'s a novel approach.']],
  ['note', 'n./v.', '笔记；纸币；注意', '生义', ['熟词生义', 'a bank note'], ['笔记；纸币；注意', '注意一词多义'], ['The teacher noted several errors in the student\'s composition.']],
  ['nurse', 'n./v.', '护士；精心照料', '生义', ['熟词生义', 'nurse a grudge'], ['护士；精心照料', '注意一词多义'], ['She nursed her father back to health.']],
  ['object', 'n./v.', '物体；反对', '生义', ['熟词生义', 'object to the plan'], ['物体；反对', '注意一词多义'], ['Several residents objected to the new construction plan.']],
  ['open', 'adj./v.', '开放的；坦诚的；未解决的', '生义', ['熟词生义', 'an open question'], ['开放的；坦诚的；未解决的', '注意一词多义'], ['The library opens at eight in the morning on weekdays.']],
  ['order', 'n./v.', '顺序；订单；命令；秩序', '生义', ['熟词生义', 'place an order'], ['顺序；订单；命令；秩序', '注意一词多义'], ['The teacher ordered the students to sit down quietly.']],
  ['pack', 'v./n.', '打包；一群/组', '生义', ['熟词生义', 'a pack of wolves'], ['打包；一群/组', '注意一词多义'], ['We packed our bags the night before the trip.']],
  ['park', 'n./v.', '公园；停车', '生义', ['熟词生义', 'park the car'], ['公园；停车', '注意一词多义'], ['He parked the car in the underground garage.']],
  ['part', 'n./v.', '部分；角色；分开', '生义', ['熟词生义', 'play a part in'], ['部分；角色；分开', '注意一词多义'], ['She played a key part in the project.']],
  ['passage', 'n.', '通道；段落；航行', '生义', ['熟词生义', 'a passage from the book'], ['通道；段落；航行', '注意一词多义'], ['Read the passage carefully.']],
  ['period', 'n.', '时期；课时；句号', '生义', ['熟词生义', 'a period of time'], ['时期；课时；句号', '注意一词多义'], ['We had three periods of math.']],
  ['piece', 'n.', '块/片；篇/首；硬币', '生义', ['熟词生义', 'a piece of music'], ['块/片；篇/首；硬币', '注意一词多义'], ['She played a beautiful piece.']],
  ['pipe', 'n.', '管子；烟斗', '生义', ['熟词生义', 'a water pipe'], ['管子；烟斗', '注意一词多义'], ['The water pipe burst.']],
  ['pool', 'n.', '水池；资源库；台球', '生义', ['熟词生义', 'a talent pool'], ['水池；资源库；台球', '注意一词多义'], ['We drew from a pool of candidates.']],
  ['practice', 'n.', '练习；惯例；业务', '生义', ['熟词生义', 'common practice'], ['练习；惯例；业务', '注意一词多义'], ['It is common practice in China.']],
  ['present', 'n./v.', '礼物；目前；呈现；介绍', '生义', ['熟词生义', 'present the findings'], ['礼物；目前；呈现；介绍', '注意一词多义'], ['The professor presented her research at an international conference.']],
  ['press', 'v./n.', '按；新闻界；熨烫', '生义', ['熟词生义', 'press conference'], ['按；新闻界；熨烫', '注意一词多义'], ['Press the button to start the machine.']],
  ['produce', 'v./n.', '生产；农产品', '生义', ['熟词生义', 'fresh produce'], ['生产；农产品', '注意一词多义'], ['The store sells fresh produce.']],
  ['promise', 'n./v.', '承诺；前途；迹象', '生义', ['熟词生义', 'show promise'], ['承诺；前途；迹象', '注意一词多义'], ['He promised to help his sister with her math homework.']],
  ['prove', 'v.', '证明；结果是', '生义', ['熟词生义', 'prove to be'], ['证明；结果是', '注意一词多义'], ['The evidence proved that he was innocent of all charges.']],
  ['raise', 'v.', '举起；筹集；饲养；提出', '生义', ['熟词生义', 'raise funds'], ['举起；筹集；饲养；提出', '注意一词多义'], ['They raised money for charity.']],
  ['rate', 'n./v.', '比率；价格；评价', '生义', ['熟词生义', 'at the rate of'], ['比率；价格；评价', '注意一词多义'], ['The birth rate is declining.']],
  ['respect', 'n./v.', '尊重；方面；关于', '生义', ['熟词生义', 'in some respects'], ['尊重；方面；关于', '注意一词多义'], ['Students should respect their teachers and classmates.']],
  ['rest', 'n./v.', '休息；剩余部分；依赖', '生义', ['熟词生义', 'the rest of'], ['休息；剩余部分；依赖', '注意一词多义'], ['You should rest for a while after running the marathon.']],
  ['review', 'n./v.', '评论；回顾；复习', '生义', ['熟词生义', 'book review'], ['评论；回顾；复习', '注意一词多义'], ['Let us review what we learned in class today.']],
  ['role', 'n.', '角色；作用；职能', '生义', ['熟词生义', 'play a role in'], ['角色；作用；职能', '注意一词多义'], ['Technology plays a key role.']],
  ['room', 'n.', '房间；空间；余地', '生义', ['熟词生义', 'no room for'], ['房间；空间；余地', '注意一词多义'], ['There is room for improvement.']],
  ['rough', 'adj.', '粗糙的；粗略的；艰难的', '生义', ['熟词生义', 'a rough estimate'], ['粗糙的；粗略的；艰难的', '注意一词多义'], ['Give me a rough estimate.']],
  ['row', 'n./v.', '一排；划船；争吵', '生义', ['熟词生义', 'in a row'], ['一排；划船；争吵', '注意一词多义'], ['Three days in a row.']],
  ['rush', 'v./n.', '冲；匆忙；急需', '生义', ['熟词生义', 'rush hour'], ['冲；匆忙；急需', '注意一词多义'], ['Do not rush; take your time to read each question carefully.']],
  ['save', 'v.', '拯救；储存；节省', '生义', ['熟词生义', 'save energy'], ['拯救；储存；节省', '注意一词多义'], ['She saves part of her pocket money every week for college.']],
  ['say', 'v./n.', '说；假设；发言权', '生义', ['熟词生义', 'have a say'], ['说；假设；发言权', '注意一词多义'], ['What did the teacher say about the homework assignment?']],
  ['school', 'n.', '学校；学派；鱼群', '生义', ['熟词生义', 'a school of fish'], ['学校；学派；鱼群', '注意一词多义'], ['A school of fish swam by.']],
  ['score', 'n./v.', '分数；二十；乐谱', '生义', ['熟词生义', 'a score of years'], ['分数；二十；乐谱', '注意一词多义'], ['He bought three score eggs.']],
  ['screen', 'n./v.', '屏幕；筛子；审查', '生义', ['熟词生义', 'screen passengers'], ['屏幕；筛子；审查', '注意一词多义'], ['All passengers were screened.']],
  ['seal', 'n./v.', '海豹；印章；密封', '生义', ['熟词生义', 'seal an envelope'], ['海豹；印章；密封', '注意一词多义'], ['Seal the envelope before sending.']],
  ['seat', 'n./v.', '座位；所在地；就座', '生义', ['熟词生义', 'be seated'], ['座位；所在地；就座', '注意一词多义'], ['Please be seated.']],
  ['serve', 'v.', '服务；供应；适合', '生义', ['熟词生义', 'serve sb right'], ['服务；供应；适合', '注意一词多义'], ['The restaurant serves breakfast from seven to ten.']],
  ['set', 'v./n.', '放置；设置；一套/组', '生义', ['熟词生义', 'a set of rules'], ['放置；设置；一套/组', '注意一词多义'], ['She set the alarm clock for six in the morning.']],
  ['shadow', 'n./v.', '影子；阴影；跟踪', '生义', ['熟词生义', 'shadow a suspect'], ['影子；阴影；跟踪', '注意一词多义'], ['The detective shadowed the suspect.']],
  ['sharp', 'adj.', '锋利的；急剧的；敏锐的', '生义', ['熟词生义', 'a sharp drop'], ['锋利的；急剧的；敏锐的', '注意一词多义'], ['There was a sharp drop in sales.']],
  ['shoot', 'v.', '射击；拍摄；芽', '生义', ['熟词生义', 'shoot a film'], ['射击；拍摄；芽', '注意一词多义'], ['The photographer shot hundreds of photos at the wedding.']],
  ['short', 'adj.', '短的；不足的；简略的', '生义', ['熟词生义', 'be short of'], ['短的；不足的；简略的', '注意一词多义'], ['We are short of funds.']],
  ['shoulder', 'n./v.', '肩膀；承担', '生义', ['熟词生义', 'shoulder responsibility'], ['肩膀；承担', '注意一词多义'], ['He shouldered the responsibility.']],
  ['show', 'n./v.', '表演；展览；迹象', '生义', ['熟词生义', 'a trade show'], ['表演；展览；迹象', '注意一词多义'], ['The guide showed the tourists around the ancient palace.']],
  ['sign', 'n./v.', '标志；迹象；签署', '生义', ['熟词生义', 'sign a contract'], ['标志；迹象；签署', '注意一词多义'], ['Please sign your name at the bottom of the form.']],
  ['soil', 'n./v.', '土壤；弄脏', '生义', ['熟词生义', 'soil one\'s clothes'], ['土壤；弄脏', '注意一词多义'], ['The child soiled his clothes.']],
  ['space', 'n.', '空间；太空；间隔', '生义', ['熟词生义', 'outer space'], ['空间；太空；间隔', '注意一词多义'], ['Astronauts explore outer space.']],
  ['spring', 'n./v.', '春天；泉水；弹簧；跳', '生义', ['熟词生义', 'hot spring'], ['春天；泉水；弹簧；跳', '注意一词多义'], ['They bathed in the hot spring.']],
  ['square', 'n./adj.', '广场；正方形；公平的', '生义', ['熟词生义', 'a fair and square'], ['广场；正方形；公平的', '注意一词多义'], ['He won fair and square.']],
  ['stage', 'n.', '舞台；阶段', '生义', ['熟词生义', 'at this stage'], ['舞台；阶段', '注意一词多义'], ['We are at an early stage.']],
  ['stamp', 'n./v.', '邮票；跺脚；盖章', '生义', ['熟词生义', 'stamp a document'], ['邮票；跺脚；盖章', '注意一词多义'], ['The officer stamped the passport.']],
  ['state', 'n./v.', '状态；州；陈述', '生义', ['熟词生义', 'state of mind'], ['状态；州；陈述', '注意一词多义'], ['His state of mind is worrying.']],
  ['stock', 'n.', '库存；股票；家畜', '生义', ['熟词生义', 'in stock'], ['库存；股票；家畜', '注意一词多义'], ['The item is out of stock.']],
  ['strike', 'v./n.', '打；罢工；突然想到', '生义', ['熟词生义', 'strike sb as odd'], ['打；罢工；突然想到', '注意一词多义'], ['The workers went on strike to demand better wages.']],
  ['subject', 'n./adj.', '科目；主题；易遭受的', '生义', ['熟词生义', 'subject to change'], ['科目；主题；易遭受的', '注意一词多义'], ['Prices are subject to change.']],
  ['succeed', 'v.', '成功；继承', '生义', ['熟词生义', 'succeed to the throne'], ['成功；继承', '注意一词多义'], ['She succeeded in passing the exam on her third attempt.']],
  ['suit', 'n./v.', '西装；诉讼；适合', '生义', ['熟词生义', 'file a suit'], ['西装；诉讼；适合', '注意一词多义'], ['The job suits her personality and skills perfectly.']],
  ['supply', 'n./v.', '供应；补给品', '生义', ['熟词生义', 'medical supplies'], ['供应；补给品', '注意一词多义'], ['The farm supplies fresh vegetables to local restaurants.']],
  ['survey', 'n./v.', '调查；审视；测量', '生义', ['熟词生义', 'survey the area'], ['调查；审视；测量', '注意一词多义'], ['They surveyed the damage.']],
  ['swallow', 'v./n.', '吞咽；燕子', '生义', ['熟词生义', 'swallow one\'s pride'], ['吞咽；燕子', '注意一词多义'], ['She swallowed the medicine with a glass of water.']],
  ['tackle', 'v./n.', '处理；用具；拦截', '生义', ['熟词生义', 'tackle a problem'], ['处理；用具；拦截', '注意一词多义'], ['We must tackle the problem now.']],
  ['tear', 'n./v.', '眼泪；撕裂', '生义', ['熟词生义', 'tear apart'], ['眼泪；撕裂', '注意一词多义'], ['She tore the letter into small pieces and threw it away.']],
  ['tell', 'v.', '告诉；辨别；泄密', '生义', ['熟词生义', 'tell the difference'], ['告诉；辨别；泄密', '注意一词多义'], ['Can you tell me the time, please?']],
  ['tie', 'n./v.', '领带；联系；平局', '生义', ['熟词生义', 'family ties'], ['领带；联系；平局', '注意一词多义'], ['She tied her shoelaces before going for a run.']],
  ['touch', 'n./v.', '触摸；感动；少许', '生义', ['熟词生义', 'a touch of humor'], ['触摸；感动；少许', '注意一词多义'], ['Do not touch the wet paint on the wall.']],
  ['track', 'n./v.', '跑道；足迹；跟踪', '生义', ['熟词生义', 'keep track of'], ['跑道；足迹；跟踪', '注意一词多义'], ['Keep track of your expenses.']],
  ['train', 'n./v.', '火车；训练', '生义', ['熟词生义', 'train employees'], ['火车；训练', '注意一词多义'], ['She trains every day for the upcoming marathon.']],
  ['transport', 'n./v.', '交通；运输；流放', '生义', ['熟词生义', 'public transport'], ['交通；运输', '注意一词多义'], ['Trucks transport goods from factories to stores across the country.']],
  ['treat', 'v./n.', '对待；治疗；款待', '生义', ['熟词生义', 'treat yourself'], ['对待；治疗；款待', '注意一词多义'], ['The doctor treated the patient with great care and patience.']],
  ['undergo', 'v.', '经历；承受', '生义', ['熟词生义', 'undergo surgery'], ['经历；承受', '注意一词多义'], ['The building underwent major renovations last summer.']],
  ['undertake', 'v.', '承担；从事；承诺', '生义', ['熟词生义', 'undertake a task'], ['承担；从事；承诺', '注意一词多义'], ['The company undertook a major research project last year.']],
  ['uniform', 'n./adj.', '制服；统一的', '生义', ['熟词生义', 'uniform style'], ['制服；统一的', '注意一词多义'], ['The houses have a uniform style.']],
  ['value', 'n./v.', '价值；估价；重视', '生义', ['熟词生义', 'value friendship'], ['价值；估价；重视', '注意一词多义'], ['I value our friendship.']],
  ['volume', 'n.', '音量；体积；卷/册', '生义', ['熟词生义', 'a volume of poetry'], ['音量；体积；卷/册', '注意一词多义'], ['He bought Volume 2 of the series.']],
  ['warm', 'v./adj.', '温暖的；加热；热心的', '生义', ['熟词生义', 'warm up'], ['温暖的；加热；热心的', '注意一词多义'], ['The players warmed up.']],
  ['watch', 'n./v.', '手表；观看；看守', '生义', ['熟词生义', 'keep watch'], ['手表；观看；看守', '注意一词多义'], ['We watched a documentary about ocean life in class.']],
  ['weigh', 'v.', '称重；权衡；有影响', '生义', ['熟词生义', 'weigh the options'], ['称重；权衡；有影响', '注意一词多义'], ['The doctor weighed the baby on the small scale.']],
  ['will', 'n.', '遗嘱；意志；意愿', '生义', ['熟词生义', 'make a will'], ['遗嘱；意志；意愿', '注意一词多义'], ['He made a will before he died.']],
  ['wind', 'n./v.', '风；蜿蜒；缠绕', '生义', ['熟词生义', 'wind a clock'], ['风；蜿蜒；缠绕', '注意一词多义'], ['The river winds through the valley.']],
  ['work', 'n./v.', '工作；作品；运转', '生义', ['熟词生义', 'a work of art'], ['工作；作品；运转', '注意一词多义'], ['She works as a volunteer at the community center every weekend.']],
  ['wound', 'n./v.', '伤口；伤害', '生义', ['熟词生义', 'a deep wound'], ['伤口；伤害', '注意一词多义'], ['The knife wounded his arm.']],
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
  ['guarantee', 'v./n.', '常见错拼: gaurantee', '易错', ['注意拼写', '常见错拼: gaurantee'], ['常见错拼: gaurantee'], ['The company guarantees the quality of all its products.']],
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
  ['separate', 'v./adj.', '常见错拼: seperate', '易错', ['注意拼写', '常见错拼: seperate'], ['常见错拼: seperate'], ['The teacher separated the two boys who were arguing.']],
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
    ['Shanghai is one of the busiest ports in the world.'],
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

// 数字与日期词汇数据
const numberDateData = {
  months: [
    { word: 'January', phonetic: '/ˈdʒænjueri/', cn: '一月', abbr: 'Jan.', examples: ['January is the first month of the year.', 'School starts in January.'] },
    { word: 'February', phonetic: '/ˈfebrueri/', cn: '二月', abbr: 'Feb.', examples: ['February has 28 or 29 days.', 'Valentine\'s Day is in February.'] },
    { word: 'March', phonetic: '/mɑːrtʃ/', cn: '三月', abbr: 'Mar.', examples: ['March is the beginning of spring.', 'Women\'s Day is on March 8th.'] },
    { word: 'April', phonetic: '/ˈeɪprəl/', cn: '四月', abbr: 'Apr.', examples: ['April showers bring May flowers.', 'April Fools\' Day is on April 1st.'] },
    { word: 'May', phonetic: '/meɪ/', cn: '五月', abbr: 'May', examples: ['May Day is on May 1st.', 'We have a holiday in May.'] },
    { word: 'June', phonetic: '/dʒuːn/', cn: '六月', abbr: 'Jun.', examples: ['Children\'s Day is in June.', 'Summer begins in June.'] },
    { word: 'July', phonetic: '/dʒuˈlaɪ/', cn: '七月', abbr: 'Jul.', examples: ['Summer vacation starts in July.', 'It is very hot in July.'] },
    { word: 'August', phonetic: '/ˈɔːɡəst/', cn: '八月', abbr: 'Aug.', examples: ['August is the hottest month.', 'We traveled in August.'] },
    { word: 'September', phonetic: '/sepˈtembər/', cn: '九月', abbr: 'Sep.', examples: ['School begins in September.', 'September marks the start of autumn.'] },
    { word: 'October', phonetic: '/ɑːkˈtoʊbər/', cn: '十月', abbr: 'Oct.', examples: ['National Day is on October 1st.', 'October is the tenth month.'] },
    { word: 'November', phonetic: '/noʊˈvembər/', cn: '十一月', abbr: 'Nov.', examples: ['Thanksgiving is in November.', 'November is usually cold.'] },
    { word: 'December', phonetic: '/dɪˈsembər/', cn: '十二月', abbr: 'Dec.', examples: ['Christmas is in December.', 'December is the last month of the year.'] },
  ],
  weekdays: [
    { word: 'Monday', phonetic: '/ˈmʌndeɪ/', cn: '星期一', abbr: 'Mon.', examples: ['We have a meeting on Monday.', 'Monday is the first day of the work week.'] },
    { word: 'Tuesday', phonetic: '/ˈtuːzdeɪ/', cn: '星期二', abbr: 'Tue.', examples: ['I have English class on Tuesday.'] },
    { word: 'Wednesday', phonetic: '/ˈwenzdeɪ/', cn: '星期三', abbr: 'Wed.', examples: ['Wednesday is in the middle of the week.'] },
    { word: 'Thursday', phonetic: '/ˈθɜːrzdeɪ/', cn: '星期四', abbr: 'Thu.', examples: ['We have a test on Thursday.'] },
    { word: 'Friday', phonetic: '/ˈfraɪdeɪ/', cn: '星期五', abbr: 'Fri.', examples: ['Friday is the last day of the school week.'] },
    { word: 'Saturday', phonetic: '/ˈsætərdeɪ/', cn: '星期六', abbr: 'Sat.', examples: ['I often play sports on Saturday.'] },
    { word: 'Sunday', phonetic: '/ˈsʌndeɪ/', cn: '星期日', abbr: 'Sun.', examples: ['Sunday is a day of rest.'] },
  ],
  seasons: [
    { word: 'spring', phonetic: '/sprɪŋ/', cn: '春天', examples: ['Spring is the season of new beginnings.', 'Flowers bloom in spring.'] },
    { word: 'summer', phonetic: '/ˈsʌmər/', cn: '夏天', examples: ['We go swimming in summer.'] },
    { word: 'autumn', phonetic: '/ˈɔːtəm/', cn: '秋天', examples: ['Leaves fall in autumn.', 'Autumn is harvest season.'] },
    { word: 'fall', phonetic: '/fɔːl/', cn: '秋天（美式）', examples: ['Fall is the American word for autumn.'] },
    { word: 'winter', phonetic: '/ˈwɪntər/', cn: '冬天', examples: ['It snows in winter.', 'Winter is the coldest season.'] },
  ],
  dateWords: [
    { word: 'today', phonetic: '/təˈdeɪ/', cn: '今天', examples: ['What day is it today?', 'Today is Monday.'] },
    { word: 'tomorrow', phonetic: '/təˈmɒroʊ/', cn: '明天', examples: ['See you tomorrow.', 'We will have a meeting tomorrow.'] },
    { word: 'yesterday', phonetic: '/ˈjestərdeɪ/', cn: '昨天', examples: ['I finished my homework yesterday.'] },
    { word: 'week', phonetic: '/wiːk/', cn: '周，星期', examples: ['There are seven days in a week.', 'I study five days a week.'] },
    { word: 'month', phonetic: '/mʌnθ/', cn: '月', examples: ['There are twelve months in a year.'] },
    { word: 'year', phonetic: '/jɪr/', cn: '年', examples: ['There are 365 days in a year.'] },
    { word: 'date', phonetic: '/deɪt/', cn: '日期', examples: ['What is the date today?'] },
    { word: 'calendar', phonetic: '/ˈkæləndər/', cn: '日历', examples: ['Look at the calendar.'] },
    { word: 'decade', phonetic: '/ˈdekeɪd/', cn: '十年', examples: ['A decade is ten years.'] },
    { word: 'century', phonetic: '/ˈsentʃəri/', cn: '世纪，百年', examples: ['We live in the 21st century.'] },
    { word: 'millennium', phonetic: '/mɪˈleniəm/', cn: '千年', examples: ['The new millennium began in 2000.'] },
  ],
  numbers: Array.from({ length: 31 }, (_, i) => {
    const n = i + 1;
    const cardinal = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
      'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty',
      'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one'][n];
    const ordinal = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
      'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth',
      'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth', 'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first'][n];
    return { n, cardinal, ordinal };
  }),
  extraNumbers: [
    { cardinal: 'forty', ordinal: 'fortieth', n: 40 },
    { cardinal: 'fifty', ordinal: 'fiftieth', n: 50 },
    { cardinal: 'sixty', ordinal: 'sixtieth', n: 60 },
    { cardinal: 'seventy', ordinal: 'seventieth', n: 70 },
    { cardinal: 'eighty', ordinal: 'eightieth', n: 80 },
    { cardinal: 'ninety', ordinal: 'ninetieth', n: 90 },
    { cardinal: 'hundred', ordinal: 'hundredth', n: 100 },
    { cardinal: 'thousand', ordinal: 'thousandth', n: 1000 },
    { cardinal: 'million', ordinal: 'millionth', n: 1000000 },
    { cardinal: 'billion', ordinal: 'billionth', n: 1000000000 },
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
  },
  {
    title: '🌊 海洋微塑料污染（2025全国一卷D篇）',
    words: ['microplastic', 'ocean', 'contaminate', 'filter', 'solution', 'research', 'particle', 'tap', 'reduce', 'chemical'],
    text: 'Microplastics have been found in tap water around the world, posing a potential threat to human health. Chinese researchers have developed an innovative method to significantly reduce microplastic contamination in drinking water. By using a specialized filtration system, they can remove over 90% of plastic particles from tap water. This breakthrough offers a practical solution to a global environmental challenge. The research team emphasizes that while filtering is important, the ultimate solution lies in reducing plastic waste at its source. Every piece of plastic that ends up in the ocean eventually breaks down into particles that contaminate our food chain.',
    textCn: '全球自来水中都发现了微塑料，对人体健康构成潜在威胁。中国研究人员开发了一种创新方法，可显著减少饮用水中的微塑料污染。通过使用专门的过滤系统，他们能去除自来水中90%以上的塑料颗粒。这一突破为全球环境挑战提供了实用解决方案。研究团队强调，虽然过滤很重要，但最终解决方案在于从源头减少塑料废物。每一块进入海洋的塑料最终都会分解成污染我们食物链的颗粒。'
  },
  {
    title: '🚲 绿色出行与城市宜居（2023新课标I卷A篇）',
    words: ['bicycle', 'commute', 'emission', 'sustainable', 'infrastructure', 'convenient', 'rental', 'guide', 'explore', 'carbon'],
    text: 'Amsterdam is famous for its bicycle-friendly infrastructure, where cycling is not just a hobby but a way of life. The city offers extensive bike rental services and professional tour guides for visitors who wish to explore the city on two wheels. Commuting by bicycle produces zero carbon emissions, making it one of the most sustainable forms of transportation. Cities around the world are now following this model, building dedicated bike lanes and offering public bike-sharing programs. Studies show that walkable and bike-friendly cities not only reduce pollution but also improve residents\' physical and mental health. The shift toward green transportation is an essential step in creating livable urban environments.',
    textCn: '阿姆斯特丹以其自行车友好型基础设施而闻名，在那里骑行不仅仅是一种爱好，更是一种生活方式。该市为希望骑车探索城市的游客提供广泛的自行车租赁服务和专业导游。骑自行车通勤产生零碳排放，是最可持续的交通方式之一。世界各地的城市正在效仿这一模式，建设专用自行车道并提供公共自行车共享项目。研究表明，适宜步行和骑行的城市不仅减少了污染，还改善了居民的身心健康。向绿色交通的转变是创造宜居城市环境的关键一步。'
  },
  {
    title: '🍽️ 食物浪费与节约（2022新高考I卷B篇）',
    words: ['waste', 'consume', 'portion', 'leftover', 'ingredient', 'scrape', 'discard', 'nutrition', 'resource', 'awareness'],
    text: 'Every day, tons of food are wasted in restaurants and households around the world. In many restaurants, customers order more than they can consume, and the leftovers are simply discarded. However, some innovative chefs are turning ingredient scraps into delicious dishes, demonstrating that so-called "waste" can be transformed into culinary treasures. Raising awareness about food waste is crucial, as producing food requires enormous amounts of water, land, and energy. Simple habits like ordering appropriate portions, saving leftovers, and composting can make a significant difference. Reducing food waste is not only an ethical obligation but also an environmental necessity.',
    textCn: '每天，世界各地的餐厅和家庭浪费成吨的食物。在许多餐厅中，顾客点的食物超过了他们能消费的量，剩菜被直接丢弃。然而，一些富有创意的厨师正在将食材边角料变成美味佳肴，证明所谓的"废物"可以转化为烹饪珍宝。提高对食物浪费的认识至关重要，因为生产食物需要大量的水、土地和能源。点适量的菜、保存剩菜和堆肥等简单习惯就能产生显著影响。减少食物浪费不仅是道德义务，更是环境需要。'
  },
  {
    title: '🏥 中医文化走向世界（2024新课标I卷B篇）',
    words: ['traditional', 'acupuncture', 'veterinary', 'combine', 'treatment', 'needle', 'therapy', 'effective', 'recovery', 'cultural'],
    text: 'In a small town in the United States, a veterinarian named Dr. Smith has been combining traditional Chinese acupuncture with Western medicine to treat animals. When a dog suffered from a severe spinal injury that conventional treatment could not cure, Dr. Smith turned to acupuncture. After several sessions of needle therapy, the dog showed remarkable recovery. This case demonstrates how traditional Chinese medicine, with thousands of years of history, is gaining recognition worldwide. The combination of Eastern and Western approaches offers patients — both human and animal — more effective treatment options. It also reflects growing cultural exchange and mutual respect between different medical traditions.',
    textCn: '在美国的一个小镇上，一位名叫史密斯博士的兽医一直在将中医针灸与西医结合治疗动物。当一只狗遭受常规治疗无法治愈的严重脊柱损伤时，史密斯博士转向了针灸。经过几次针刺治疗后，这只狗显示出了显著的恢复。这一案例展示了拥有数千年历史的中医正在全球范围内获得认可。东西方方法的结合为患者——无论是人类还是动物——提供了更有效的治疗选择。它也反映了不同医学传统之间日益增长的文化交流和相互尊重。'
  },
  {
    title: '📖 纸质阅读与数字阅读（2024新课标I卷C篇）',
    words: ['print', 'digital', 'screen', 'comprehension', 'retain', 'focus', 'device', 'audiobook', 'absorb', 'preference'],
    text: 'As digital devices become ubiquitous, a debate has emerged: is reading on a screen as effective as reading a physical book? Research suggests that readers tend to comprehend and retain information better when reading print materials. The tactile experience of turning pages helps create spatial memory that aids recall. Digital reading, while convenient and portable, often leads to skimming and multitasking, which can reduce focus and absorption of content. Audiobooks offer yet another mode, allowing listeners to absorb stories during commutes. However, for deep learning and critical analysis, print books remain the preferred medium. The key is understanding that different formats serve different purposes in our reading lives.',
    textCn: '随着数字设备的普及，一个争议出现了：在屏幕上阅读是否和阅读实体书一样有效？研究表明，读者在阅读印刷材料时往往能更好地理解和记忆信息。翻页的触觉体验有助于创造辅助回忆的空间记忆。数字阅读虽然方便且便于携带，但往往导致浏览和多任务处理，从而降低注意力和内容吸收。有声书提供了另一种模式，让听众可以在通勤时吸收故事。然而，对于深度学习和批判性分析，印刷书籍仍然是首选媒介。关键在于理解不同的格式在我们的阅读生活中有不同的用途。'
  },
  {
    title: '🌱 城市花园与生态农业（2023新课标II卷B篇）',
    words: ['urban', 'garden', 'sprout', 'seed', 'cultivate', 'harvest', 'organic', 'community', 'volunteer', 'transform'],
    text: 'In a low-income neighborhood, a teacher named Abby Jaramillo started the Urban Sprouts project, transforming empty schoolyards into thriving gardens. Students learned to cultivate vegetables from seeds, harvest organic produce, and cook nutritious meals with their crops. The project not only provided fresh food to families but also taught children valuable lessons about patience, responsibility, and environmental stewardship. Urban farming initiatives like this are springing up in cities worldwide, converting unused spaces into productive green areas. They strengthen community bonds as volunteers work side by side, sharing knowledge and resources. These gardens prove that even in concrete jungles, nature can flourish and nourish both body and soul.',
    textCn: '在一个低收入社区，一位名叫艾比·哈拉米洛的教师发起了"城市新芽"项目，将空置的校园变成了生机勃勃的花园。学生们学习从种子开始种植蔬菜、收获有机农产品，并用自己种的作物烹饪营养餐。该项目不仅为家庭提供了新鲜食物，还教会了孩子们关于耐心、责任和环境保护的宝贵课程。像这样的城市农业倡议正在世界各地的城市中涌现，将未使用的空间转化为多产的绿色区域。志愿者们并肩工作、分享知识和资源，增强了社区纽带。这些花园证明，即使在钢筋水泥的丛林中，自然也能茁壮成长，滋养身心。'
  },
  {
    title: '🤝 志愿服务与教育关怀（2025全国二卷B篇）',
    words: ['volunteer', 'hospital', 'tutor', 'patient', 'dedicate', 'compassion', 'disadvantaged', 'inspire', 'resilience', 'commitment'],
    text: 'Kathy Ho dedicated her life to teaching children in a hospital setting, where young patients often miss months of school due to serious illnesses. As a hospital teacher, she adapted lessons to each child\'s condition, sometimes teaching at bedside or between treatments. Her compassion and commitment ensured that no child fell behind academically while fighting for their health. Kathy\'s story reminds us that education is not confined to traditional classrooms. Volunteers like her bridge critical gaps in society, providing support to the most disadvantaged. Their selfless dedication inspires us to look beyond our own circumstances and find meaning in serving others. True resilience emerges when communities rally around those who need help most.',
    textCn: '凯西·何将自己的一生奉献给了在医院环境中教学，那里的年幼患者因重病常常缺课数月。作为一名医院教师，她根据每个孩子的病情调整课程，有时在病床旁或治疗间隙进行教学。她的同情心和奉献精神确保了没有孩子在与疾病抗争的同时在学业上掉队。凯西的故事提醒我们，教育不局限于传统课堂。像她这样的志愿者弥合了社会中的关键缺口，为最弱势的群体提供支持。他们无私的奉献激励我们超越自身境遇，在服务他人中找到意义。当社区团结在那些最需要帮助的人周围时，真正的韧性就会出现。'
  },
  {
    title: '🌳 热带雨林保护（2020新高考II卷D篇）',
    words: ['rainforest', 'tropical', 'species', 'medicine', 'deforest', 'biodiversity', 'habitat', 'indigenous', 'conserve', 'irreplaceable'],
    text: 'Tropical rainforests are often called the world\'s largest pharmacy, as over a quarter of modern medicines originate from rainforest plants. Yet these irreplaceable ecosystems are disappearing at an alarming rate due to deforestation. Each hectare of rainforest contains hundreds of tree species and supports countless animals, insects, and microorganisms. Indigenous communities who have lived in harmony with these forests for centuries possess invaluable knowledge about medicinal plants. When we destroy rainforests for timber and agriculture, we lose not only biodiversity but also potential cures for diseases. Conservation efforts must balance economic development with the preservation of these vital habitats. The survival of the rainforest is ultimately tied to our own.',
    textCn: '热带雨林常被称为世界最大的药房，因为超过四分之一的现代药物源自雨林植物。然而，这些不可替代的生态系统正以惊人的速度因森林砍伐而消失。每公顷雨林包含数百个树种，支撑着无数的动物、昆虫和微生物。与这些森林和谐共处了数百年的原住民社区拥有关于药用植物的宝贵知识。当我们为木材和农业破坏雨林时，我们失去的不仅是生物多样性，还有潜在的治疗疾病的药物。保护工作必须在经济发展与这些重要栖息地的保护之间取得平衡。雨林的存续最终与我们自己的生存息息相关。'
  },
  {
    title: '👵 老年人健康与社会关怀（2022新高考I卷C篇）',
    words: ['elderly', 'aging', 'physical', 'mental', 'companionship', 'isolated', 'program', 'engage', 'wellbeing', 'dignity'],
    text: 'As populations age worldwide, caring for the elderly has become a pressing social issue. Many seniors live isolated lives, which can lead to both physical decline and mental health problems. Innovative programs have emerged to address this challenge: community centers offer group activities, volunteers provide regular companionship visits, and technology classes help seniors connect with family online. Studies show that elderly individuals who stay socially engaged maintain better cognitive function and physical health. Simple acts — a conversation, a walk together, a shared meal — can dramatically improve their wellbeing. A society\'s greatness is measured not only by its economic success but by how it treats its most vulnerable members with dignity and respect.',
    textCn: '随着全球人口老龄化，关爱老年人已成为一个紧迫的社会问题。许多老年人过着孤独的生活，这可能导致身体衰退和心理健康问题。创新项目应运而生以应对这一挑战：社区中心提供集体活动，志愿者定期提供陪伴探访，技术课程帮助老年人在线与家人联系。研究表明，保持社交活动的老年人在认知功能和身体健康方面维持得更好。简单的行为——一次对话、一起散步、一顿共享的饭菜——就能极大地改善他们的福祉。一个社会的伟大不仅以其经济成功来衡量，还取决于它如何以尊严和尊重对待最弱势的成员。'
  },
  {
    title: '🔬 科学探索与创新精神',
    words: ['experiment', 'hypothesis', 'evidence', 'innovative', 'breakthrough', 'discover', 'methodology', 'analyze', 'conclusion', 'persist'],
    text: 'Scientific progress relies on the persistent spirit of inquiry. When John Todd set out to build an "eco-machine" to clean polluted water, many doubted his hypothesis. Yet through years of experimentation, he demonstrated that natural ecosystems could be engineered to purify water without chemicals. His methodology involved combining plants, bacteria, and aquatic organisms in a series of tanks that mimic natural wetland processes. The breakthrough came after numerous failed attempts — each failure providing valuable evidence that refined the next experiment. This story illustrates that scientific discovery is rarely a straight line. It requires the courage to challenge conventional wisdom, the patience to analyze unexpected results, and the persistence to continue despite setbacks. Every great innovation begins with a simple question: "What if?"',
    textCn: '科学的进步依赖于持续不断的探索精神。当约翰·托德着手建造一台"生态机器"来净化污水时，许多人质疑他的假说。然而经过多年的实验，他证明了自然生态系统可以被工程化来无化学物质地净化水。他的方法涉及在一系列模拟自然湿地过程的水箱中组合植物、细菌和水生生物。突破出现在无数次失败尝试之后——每一次失败都提供了宝贵的证据来改进下一次实验。这个故事说明科学发现很少是一条直线。它需要挑战传统智慧的勇气、分析意外结果的耐心，以及尽管遭遇挫折仍坚持继续的毅力。每一项伟大的创新都始于一个简单的问题："如果……会怎样？"'
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

const seedWords3500 = [
  ['a', 'art. /ei/', '第一个字母 A; 一个; 第一的；art. [计] 累加器, 加法器, 地址, 振幅, 模拟, 区域, 面积, 汇编, 组件, 异步', '基础', [], [], []],
  ['abandon', 'v. /ә\'bændәn/', 'vt. 放弃, 抛弃, 遗弃, 使屈从, 沉溺, 放纵；n. 放任, 无拘束, 狂热', '基础', [], [], []],
  ['ability', 'n. /ә\'biliti/', 'n. 能力, 才干；[经] 能力, 才能', '基础', [], [], []],
  ['able', 'adj. /\'eibl/', 'a. 能干的, 能够的', '基础', [], [], []],
  ['abnormal', 'adj. /æb\'nɒ:mәl/', 'a. 反常的, 不规则的, 变态的, 畸形的；n. 畸形的人', '基础', [], [], []],
  ['aboard', 'prep. /ә\'bɒ:d/', 'adv. 在船上, 在火车上, 在飞机上；prep. 在...之上', '基础', [], [], []],
  ['abolish', 'v. /ә\'bɒliʃ/', 'vt. 废止, 革除, 消灭；[经] 废除, 取消, 裁撤', '基础', [], [], []],
  ['abortion', 'n. /ә\'bɒ:ʃәn/', 'n. 流产, 堕胎, 失败, 夭折, 中止；[医] 流产, 小产; 顿挫', '基础', [], [], []],
  ['about', 'adv. prep. /ә\'baut/', 'prep. 在...周围, 大约, 有关, 关于；adv. 大约, 四处, 在附近, 周围', '基础', [], [], []],
  ['above', 'prep. adj. adv. /ә\'bʌv/', 'prep. 在上方, 超出；adv. 在上面；a. 上述的, 上面的', '基础', [], [], []],
  ['abroad', 'adv. /ә\'brɒ:d/', 'adv. 往国外, 到室外, 到处；a. 往国外的, 在室外的, 广泛四散的', '基础', [], [], []],
  ['abrupt', 'adj. /ә\'brʌpt/', 'a. 突然的, 唐突的, 陡峭的, 不连贯的', '基础', [], [], []],
  ['absence', 'n. /\'æbsәns/', 'n. 缺席, 缺乏, 没有；[医] 失神', '基础', [], [], []],
  ['absent', 'adj. /\'æbsәnt/', 'a. 缺席的, 不在的, 缺乏的, 漫不经心的；vt. 使缺席', '基础', [], [], []],
  ['absolute', 'adj. /\'æbsәlu:t/', 'a. 绝对的, 专制的, 完全的, 独立的；n. 绝对事物', '基础', [], [], []],
  ['absorb', 'v. /әb\'sɒ:b/', 'vt. 吸收, 使全神贯注, 同化, 买进, 理解, 承受, 忍受, 承担；[医] 吸收', '基础', [], [], []],
  ['abstract', 'adj. n. /\'æbstrækt/', 'a. 抽象的, 深奥的；n. 摘要, 抽象概念；vt. 摘要, 提炼, 使抽象化；[计] 摘录; 摘要; 抽象', '基础', [], [], []],
  ['absurd', 'adj. /әb\'sә:d/', 'a. 荒谬的, 不合理的, 可笑的；n. 荒诞', '基础', [], [], []],
  ['abundant', 'adj. /ә\'bʌndәnt/', 'a. 丰富的, 充分的, 大量的', '基础', [], [], []],
  ['abuse', 'v. /ә\'bju:s.ә\'bju:z/', 'n. 滥用, 虐待, 恶习, 辱骂；vt. 滥用, 辱骂, 虐待', '基础', [], [], []],
  ['academic', 'adj. n. /.ækә\'demik/', 'a. 学院的, 学术的, 不切实际的；n. 大学生, 大学教师, 学者, 学会会员', '基础', [], [], []],
  ['academy', 'n. /ә\'kædәmi/', '学院，学会，（美）私立学校', '基础', [], [], []],
  ['accelerate', 'v. /әk\'selәreit/', 'v. 加速, 促进', '基础', [], [], []],
  ['accent', 'n. /\'æksәnt/', 'n. 重音, 口音, 特点, 注重点；vt. 重读, 加重音号于, 强调', '基础', [], [], []],
  ['accept', 'vt. /әk\'sept/', 'vt. 接受, 承认, 同意, 相信, 赞成, 承担, 承兑, 采纳, 接纳, 容忍；vi. 同意', '基础', [], [], []],
  ['acceptable', 'adj.', '可以接受的', '基础', [], [], []],
  ['access', 'n. & v. /\'ækses/', 'n. 通路, 入口, 接近, 进入, 使用权, 发作；vt. 访问, 存取, 接近, 使用；[计] 访问, 存取', '基础', [], [], []],
  ['accessible', 'adj. /әk\'sesәbl/', 'a. 易接近的, 可进入的, 可使用的, 易受影响的, 可理解的', '基础', [], [], []],
  ['accident', 'n. /\'æksidәnt/', 'n. 意外事件, 机遇, 事故, 次要方面；[化] 意外事故; 事故', '基础', [], [], []],
  ['accommodation', 'n. /ә.kɒmә\'deiʃәn/', 'n. 膳宿, 预订铺位, 适应性调节, 调和, 贷款；[医] 调节(眼); 适应', '基础', [], [], []],
  ['accompany', 'v. /ә\'kʌmpәni/', 'vt. 陪伴, 伴随, 补充, 为...伴奏；vi. 伴奏, 伴唱', '基础', [], [], []],
  ['accomplish', 'v. /ә\'kʌmpliʃ/', 'vt. 完成, 达到, 实现, 使完美', '基础', [], [], []],
  ['according', 'adv.', '按照，根据', '基础', [], [], []],
  ['account', 'n. /ә\'kaunt/', 'n. 报告, 解释, 估价, 理由, 利润, 算账, 帐目；vi. 报帐, 解释, 导致, 报偿, 占, 杀死；vt. 认为；[计] 帐户, 帐号', '基础', [], [], []],
  ['accountant', 'n. /ә\'kauntәnt/', 'n. 会计人员, 会计师；[经] 会计师, 会计人员', '基础', [], [], []],
  ['accumulate', 'v. /ә\'kju:mjuleit/', 'v. 积聚, 堆积', '基础', [], [], []],
  ['accuracy', 'n. /\'ækjurәsi/', 'n. 精确, 正确；[计] 准确度', '基础', [], [], []],
  ['accurate', 'adj.', '准确的；精确的', '基础', [], [], []],
  ['accuse', 'v. /ә\'kju:z/', 'vt. 指责, 控告, 归咎于；vi. 指责, 控告', '基础', [], [], []],
  ['accustomed', 'adj. /ә\'kʌstәmd/', 'a. 惯常的, 习惯了的', '基础', [], [], []],
  ['ache', 'vi. & n. /eik/', 'n. 疼痛；vi. 痛, 哀怜, 渴望', '基础', [], [], []],
  ['achieve', 'vt. /ә\'tʃi:v/', 'vt. 完成, 达到；vi. 如愿以偿', '基础', [], [], []],
  ['achievement', 'n. /ә\'tʃi:vmәnt/', 'n. 完成, 成就, 功业', '基础', [], [], []],
  ['acid', 'adj. /\'æsid/', 'n. 酸, 酸类物质, 尖刻, 迷幻药；a. 酸的, 酸性的, 尖刻的, 敏锐的；[计] 自动文档互参与索引生成程序', '基础', [], [], []],
  ['acknowledge', 'v. /әk\'nɒlidʒ/', 'vt. 承认, 告知收悉, 答谢, 报偿；[经] 承认, 答谢, 收到的通知', '基础', [], [], []],
  ['acquaintance', 'n. /ә\'kweintәns/', '熟人，（与某人）认识', '基础', [], [], []],
  ['acquire', 'v. /ә\'kwaiә/', 'vt. 获得, 学到；[电] 目标锁定', '基础', [], [], []],
  ['acquisition', 'n. /.ækwi\'ziʃәn/', 'n. 获得, 获得物；[经] 收购, 招揽, 取得', '基础', [], [], []],
  ['acre', 'n. /\'eikә/', 'n. 英亩', '基础', [], [], []],
  ['across', 'prep. /ә\'krɒs/', 'prep. 越过, 穿过, 与...相交叉, 在...的对面；adv. 交叉, 到另一边, 在对面, 成十字', '基础', [], [], []],
  ['act', 'n. v. /ækt/', 'n. 行动, 行为, 幕, 法案；vi. 行动, 表演, 假装, 见效, 表现, 担当；vt. 扮演, 装作；[计] 先进通信技术, 先进计算机工艺, 自动代码翻译技术', '基础', [], [], []],
  ['action', 'n. /\'ækʃәn/', 'n. 行动, 活动, 动作, 作用, 战斗, 行为, 诉讼；vt. 对...起诉；[计] 方式', '基础', [], [], []],
  ['active', 'adj. /\'æktiv/', 'a. 活跃的, 起作用的, 积极的, 有效的, 主动的, 活性的, 现行的, 现役的；n. 主动语态, 积极分子', '基础', [], [], []],
  ['activity', 'n. /æk\'tiviti/', 'n. 活动, 行动, 活跃, 活力；[计] 活动', '基础', [], [], []],
  ['actor', 'n. /\'æktә/', 'n. 男演员, 行动者；[医] 作用物, 反应物', '基础', [], [], []],
  ['actress', 'n. /\'æktris/', 'n. 女演员', '基础', [], [], []],
  ['actual', 'adj. /\'æktʃuәl/', 'a. 真实的, 实际的, 现行的；[医] 实际死亡率', '基础', [], [], []],
  ['acute', 'adj. /ә\'kju:t/', 'a. 尖锐的, 敏锐的, 激烈的, 严重的, 急性的；[医] 急性的; 尖锐的', '基础', [], [], []],
  ['AD', 'n.', '公元', '基础', [], [], []],
  ['ad', 'n.', '广告（advertisement 的缩写）', '基础', [], [], []],
  ['adapt', 'v. /ә\'dæpt/', 'vt. 使适应, 改编；vi. 适应', '基础', [], [], []],
  ['adaptation', 'n. /.ædæp\'teiʃәn/', 'n. 适应, 改编, 改编本；[医] 适应[作用]', '基础', [], [], []],
  ['add', 'vt. /æd/', 'vt. 增加, 添加, 附带说明, 计算...总和；vi. 做加法, 积累而成, 增添；[计] 加法', '基础', [], [], []],
  ['addicted', 'adj. /ә\'diktid/', 'a. 沉溺于...的, 无法摆脱(某种嗜好)的；[法] 嗜, 好, 惯于', '基础', [], [], []],
  ['addition', 'n. /ә\'diʃәn/', 'n. 加法, 增加的人(或物)；[计] 加法', '基础', [], [], []],
  ['address', 'n. & v. /ә\'dres/', 'n. 住址, 演说, 举止, 灵巧, 求爱；vt. 发表(演说或讲话), 对付, 写地址；[计] 地址, 寻址', '基础', [], [], []],
  ['adequate', 'adj. /\'ædikwәt/', 'a. 适当的, 足够的；[法] 胜任的, 适当的, 充分的', '基础', [], [], []],
  ['adjust', 'v. /ә\'dʒʌst/', 'vt. 调整, 使适应于, 校准；vi. 适应于, 被调节, 相互熟悉而适应', '基础', [], [], []],
  ['adjustment', 'n. /ә\'dʒʌstmәnt/', 'n. 调整, 调节, 校正；[化] 调节', '基础', [], [], []],
  ['administration', 'n. /әd.mini\'streiʃәn/', 'n. 行政, 管理, 政府机关；[化] 给药', '基础', [], [], []],
  ['admirable', 'adj. /\'ædmәrәbl/', 'a. 可钦佩的, 极好的, 令人惊奇的', '基础', [], [], []],
  ['admire', 'v. /әd\'maiә/', 'vt. 赞美, 钦佩, 爱慕；vi. 称赞, 惊奇', '基础', [], [], []],
  ['admission', 'n. /әd\'miʃәn/', 'n. 准许进入, 入场费, 录用, 承认；[经] 加入, 入股', '基础', [], [], []],
  ['admit', 'vt. /әd\'mit/', 'vt. 承认, 接受, 允许进入, 容许；vi. 开向, 容许, 承认', '基础', [], [], []],
  ['adolescence', 'n. /.ædәu\'lesәns/', 'n. 青春期；[医] 青年期, 青春期', '基础', [], [], []],
  ['adolescent', 'n. /.ædәu\'lesәnt/', 'a. 青春期的, 青少年的；n. 青少年', '基础', [], [], []],
  ['adopt', 'v. /ә\'dɒpt/', 'vt. 采用, 正式通过, 收养, 接受；[医] 采取', '基础', [], [], []],
  ['adore', 'v. /ә\'dɒ:/', 'vt. 崇拜, 爱慕, 喜爱；vi. 崇拜, 爱慕', '基础', [], [], []],
  ['adult', 'n. /\'ædʌlt/', 'n. 成人, 成虫；a. 成年的, 成熟的', '基础', [], [], []],
  ['advance', 'v. n. /әd\'vɑ:ns/', 'n. 前进, 进展, 行过的路程；vi. 前进, 进展, 提高, 上涨；vt. 使前进, 促进, 提出, 提高, 使提前, 预付；a. 前面的, 预先的', '基础', [], [], []],
  ['advantage', 'n. /әd\'vɑ:ntidʒ/', 'n. 优点, 便利, 好处, 优势；vt. 有助于', '基础', [], [], []],
  ['adventure', 'n. /әd\'ventʃә/', 'n. 冒险, 冒险经历；v. 冒险', '基础', [], [], []],
  ['advertise', 'vt. /\'ædvәtaiz/', 'vt. 做广告, 通知, 公布；vi. 做广告', '基础', [], [], []],
  ['advertisement', 'n. /.ædvә\'taizmәnt/', 'n. 广告, 启事, 广告宣传；[法] 广告, 公告, 告示', '基础', [], [], []],
  ['advice', 'n. /әd\'vais/', 'n. 忠告, 劝告, 意见, 报道, 通知；[经] 通知书, 通知, 建议', '基础', [], [], []],
  ['advise', 'vt. /әd\'vaiz/', 'vt. 劝告, 给...出主意, 通知, 建议；vi. 提意见, 商量', '基础', [], [], []],
  ['advocate', 'v. /\'ædvәkeit/', 'n. 提倡者, 拥护者；vt. 主张, 提倡', '基础', [], [], []],
  ['affair', 'n. /ә\'fєә/', 'n. 事件, 事务, 恋爱事件', '基础', [], [], []],
  ['affect', 'vt. /ә\'fekt/', 'vt. 影响, 感动, 假装, 模仿, 爱好, 倾向于；n. 自觉感情', '基础', [], [], []],
  ['affection', 'n. /ә\'fekʃәn/', 'n. 影响, 病, 喜爱, 情感, 倾向；[医] 疾患, 病变, 病; 感情', '基础', [], [], []],
  ['afford', 'vt. /ә\'fɒ:d/', '花费得起，能够做，承担得起（后果）', '基础', [], [], []],
  ['afraid', 'adj. /ә\'freid/', 'a. 害怕的, 恐怕的, 遗憾的', '基础', [], [], []],
  ['Africa', 'n. /\'æfrikә/', 'n. 非洲', '基础', [], [], []],
  ['African', 'adj. n. /\'æfrikәn/', 'n. 非洲人；a. 非洲的, 非洲人的', '基础', [], [], []],
  ['after', 'adv. prep. conj. /\'ɑ:ftә/', 'prep. 在...之后, 由于；conj. 在...之后；adv. 后来', '基础', [], [], []],
  ['afternoon', 'n. /\'ɑ:ftә\'nu:n/', 'n. 午后, 下午', '基础', [], [], []],
  ['afterward', 'adv. /\'ɑ:ftәwәd/', 'adv. 然后, 后来', '基础', [], [], []],
  ['again', 'adv. /ә\'gein/', 'adv. 再一次, 又, 到原处', '基础', [], [], []],
  ['against', 'prep. /ә\'geinst/', 'prep. 反对, 对着, 倚靠', '基础', [], [], []],
  ['age', 'n. /eidʒ/', 'n. 年龄, 老年, 成年, 寿命, 时代, 时期；v. 变老, 成熟', '基础', [], [], []],
  ['agency', 'n. /\'eidʒәnsi/', 'n. 代理机构, 经销商, 中介；[化] 办事处', '基础', [], [], []],
  ['agenda', 'n. /ә\'dʒendә/', 'pl. 议程, 日常工作事项；[计] 待议事件', '基础', [], [], []],
  ['agent', 'n. /\'eidʒәnt/', 'n. 代理商, 政府代表, 动原, 媒介；[计] 代理程序', '基础', [], [], []],
  ['aggression', 'n. /ә\'greʃәn/', 'n. 侵犯, 侵略；[医] 攻击', '基础', [], [], []],
  ['aggressive', 'adj. /ә\'gresiv/', 'a. 侵略的, 挑畔的, 进取的；[法] 侵略的, 爱挑衅的, 行为过火的', '基础', [], [], []],
  ['ago', 'adv. /ә\'gәu/', 'adv. 以前', '基础', [], [], []],
  ['agree', 'v. /ә\'gri:/', 'vi. 同意, 赞成, 应允, 适合；vt. 承认, 认定, 同意', '基础', [], [], []],
  ['agreement', 'n. /ә\'gri:mәnt/', 'n. 同意, 合约, 协议；[经] 契约, 协议, 协定', '基础', [], [], []],
  ['agricultural', 'adj. /.ægri\'kʌltʃәrәl/', 'a. 农业的；[法] 农业的, 耕作的', '基础', [], [], []],
  ['agriculture', 'n. /\'ægrikʌltʃә/', 'n. 农业；[机] 农业, 农学', '基础', [], [], []],
  ['ahead', 'adv. /ә\'hed/', 'a. 领先的, 预先的, 向前的；adv. 领先, 预先, 向前, 胜于, 在前面, 在将来', '基础', [], [], []],
  ['aid', 'n. /eid/', 'n. 帮助, 外援, 助手；vt. 援助, 帮助, 有助于；vi. 帮助；[计] 自动内部诊断', '基础', [], [], []],
  ['AIDS', 'n. /eidz/', 'n. 爱滋病(获得性免疫缺陷综合征)；[计] 高级综合数据系统, 先进交互调试系统, 自动图解文档编制系统；美国决策学学会, 信息自动显示系统, 自动综合调试系统', '基础', [], [], []],
  ['aim', 'n. v. /eim/', 'n. 目标, 瞄准, 击中目标的能力；vi. 对准目标, 致力, 打算；vt. 瞄准；[计] 医学文摘索引, 存取隔离机构, 高级信息管理程序, 先进接口模块；应用接口模块, 医学人工智能, 相联索引法, 异步接口模块；自动化信息管理, 自动化综合制造, 自动化库存管理', '基础', [], [], []],
  ['air', 'n. /єә/', 'n. 空气, 旋律, 态度；vt. 晾, 使通风, 夸耀', '基础', [], [], []],
  ['aircraft', 'n. /\'єәkræft/', 'n. 航空器, 飞机；[机] 航空器', '基础', [], [], []],
  ['airline', 'n. /\'єәlain/', 'n. 航线, 航线的设备, 航空公司', '基础', [], [], []],
  ['airmail', 'n. /\'єәmeil/', 'n. 航空邮件', '基础', [], [], []],
  ['airplane', 'n. /\'єәplein/', 'n. 飞机；[机] 飞机', '基础', [], [], []],
  ['airport', 'n. /\'єәpɒ:t/', 'n. 飞机场；[机] 航空站, 机场', '基础', [], [], []],
  ['airspace', 'n. /\'єәspeis/', 'n. 空域, 空间；[机] 气隙', '基础', [], [], []],
  ['alarm', 'n. /ә\'lɑ:m/', 'n. 惊恐, 警报, 警钟；vt. 使惊恐, 警告；[计] 报警信号', '基础', [], [], []],
  ['album', 'n. /\'ælbәm/', 'n. 粘贴簿, 唱片套；[医] 白色物', '基础', [], [], []],
  ['alcohol', 'n. /\'ælkәhɒl/', 'n. 酒精, 酒；[化] 醇; 乙醇; 酒精', '基础', [], [], []],
  ['alcoholic', 'adj. n. /.ælkә\'hɒlik/', 'n. 酒鬼, 酒精中毒者；a. 酒精的', '基础', [], [], []],
  ['algebra', 'n. /\'ældʒibrә/', 'n. 代数学', '基础', [], [], []],
  ['alike', 'adv. /ә\'laik/', 'a. 相似的, 同样的；adv. 一样, 以同样的方式', '基础', [], [], []],
  ['alive', 'adj. /ә\'laiv/', 'a. 活着的, 活泼的, 敏感的, 热闹的', '基础', [], [], []],
  ['all', 'adv. adj. pron. /ɒ:l/', 'a. 所有的, 全部的, 一切的；adv. 全部, 全然；pron. 全部；n. 全部', '基础', [], [], []],
  ['allergic', 'adj. /ә\'lә:dʒik/', 'a. 对...过敏的, 极反感的；[医] 变应性的', '基础', [], [], []],
  ['alley', 'n. /\'æli/', 'n. 小路, 巷', '基础', [], [], []],
  ['allocate', 'v. /\'ælәukeit/', 'vt. 分派, 分配；[计] 分配', '基础', [], [], []],
  ['allow', 'vt. /ә\'lau/', 'vt. 允许, 同意给予, 承认；vi. 容许, 猜想；[计] 允许命令', '基础', [], [], []],
  ['allowance', 'n. /ә\'lauәns/', 'n. 津贴, 零用钱, 限额, 折扣, 允许；vt. 定量供应', '基础', [], [], []],
  ['almost', 'adv. /\'ɒ:lmәust/', 'adv. 几乎, 差不多', '基础', [], [], []],
  ['alone', 'adj. /ә\'lәun/', 'a. 孤独的, 单独的, 独自的；adv. 独自地', '基础', [], [], []],
  ['along', 'adv. prep. /ә\'lɒŋ/', 'adv. 平行地, 向前；prep. 沿着', '基础', [], [], []],
  ['alongside', 'adv. /ә\'lɒŋ\'said/', 'adv. 在旁边, 靠拢着；prep. 在...旁边, 与...在一起', '基础', [], [], []],
  ['aloud', 'adv. /ә\'laud/', 'adv. 出声地, 大声地', '基础', [], [], []],
  ['alphabet', 'n. /\'ælfәbit/', 'n. 字母；[计] 字母表', '基础', [], [], []],
  ['already', 'adv. /ɒ:l\'redi/', 'adv. 已经, 早已', '基础', [], [], []],
  ['also', 'adv. /\'ɒ:lsәu/', 'adv. 也, 并且, 同样地', '基础', [], [], []],
  ['alternative', 'adj. /ɒ:l\'tә:nәtiv/', 'n. 两者择一, 供替代的选择；a. 两者择一的, 供选择的；[计] 选择对象', '基础', [], [], []],
  ['although', 'conj. /ɒ:l\'ðou/', 'conj. 虽然, 尽管', '基础', [], [], []],
  ['altitude', 'n. /\'æltitju:d/', 'n. 高度, 海拔, 高处；[电] 高度', '基础', [], [], []],
  ['altogether', 'adv. /.ɒ:ltә\'geðә/', 'adv. 完全地, 总而言之', '基础', [], [], []],
  ['aluminium', 'n. /.ælju\'miniәm/', 'n. 铝；a. 铝的', '基础', [], [], []],
  ['always', 'adv. /\'ɒ:lweiz/', 'adv. 总是, 始终', '基础', [], [], []],
  ['amateur', 'adj. /\'æmәtә/', 'n. 业余爱好者, 外行, 爱好者；[电] 业余家', '基础', [], [], []],
  ['amaze', 'v. /ә\'meiz/', 'vt. 使吃惊', '基础', [], [], []],
  ['amazing', 'adj. /ә\'meiziŋ/', 'a. 令人惊异的', '基础', [], [], []],
  ['ambassador', 'n. /æm\'bæsәdә/', 'n. 大使；[法] 大使, 使节, 代理', '基础', [], [], []],
  ['ambiguous', 'adj. /æm\'bigjuәs/', 'a. 不明确的, 模棱两可的；[法] 意思含糊的, 模棱两可的, 暧昧的', '基础', [], [], []],
  ['ambition', 'n. /æm\'biʃәn/', '目标，野心，雄心，抱负', '基础', [], [], []],
  ['ambulance', 'n. /\'æmbjulәns/', 'n. 救护车；[医] 救护车', '基础', [], [], []],
  ['America', 'n. /ә\'merikә/', 'n. 美洲, 美国', '基础', [], [], []],
  ['American', 'adj. n. /ә\'merikәn/', 'n. 美国人；a. 美国的, 美洲的', '基础', [], [], []],
  ['among', 'prep. /ә\'mʌŋ/', '在…中间；在（三个以上）之间', '基础', [], [], []],
  ['amount', 'n. & v. /ә\'maunt/', 'n. 总数, 总额；vi. 总计, 等同', '基础', [], [], []],
  ['ample', 'adj. /\'æmpl/', 'a. 大量的, 充足的, 丰富的', '基础', [], [], []],
  ['amuse', 'vt. /ә\'mju:z/', 'vt. 消遣, 娱乐, 使发笑', '基础', [], [], []],
  ['amusement', 'n. /ә\'mju:zmәnt/', 'n. 兴味, 娱乐, 消遣；[法] 娱乐, 娱乐活动', '基础', [], [], []],
  ['analyse', 'v.', '分析', '基础', [], [], []],
  ['analysis', 'n. /ә\'nælәsis/', 'n. 分析；[计] 分析机; 分析员; 分析; 分析程序', '基础', [], [], []],
  ['ancestor', 'n. /\'ænsestә/', 'n. 祖先, 祖宗', '基础', [], [], []],
  ['anchor', 'v. & n.', '锚，抛锚', '基础', [], [], []],
  ['ancient', 'adj. /\'einʃәnt/', 'a. 古代的, 古老的, 年老的, 旧的', '基础', [], [], []],
  ['and', 'conj. /ænd/', 'conj. 和, 与；[计] 与', '基础', [], [], []],
  ['anecdote', 'n. /\'ænikdәut/', 'n. 轶事, 奇闻', '基础', [], [], []],
  ['anger', 'n. v. /\'æŋgә/', 'n. 忿怒；vt. 激怒, 使发怒；vi. 发怒', '基础', [], [], []],
  ['angle', 'n. /\'æŋgl/', 'n. 角, 角度, 角落；vi. 钓鱼, 谋取, 博取, 斜向移动, 转变角度；vt. 使转动角度, 在...钓鱼, 获取', '基础', [], [], []],
  ['angry', 'adj. /\'æŋgri/', 'a. 生气的, 愤怒的', '基础', [], [], []],
  ['animal', 'n. /\'ænimәl/', 'n. 动物；[医] 动物', '基础', [], [], []],
  ['ankle', 'n. /\'æŋkl/', 'n. 踝；[医] 踝, 踝关节', '基础', [], [], []],
  ['anniversary', 'n. /æni\'vә:sәri/', 'n. 周年纪念', '基础', [], [], []],
  ['announce', 'vt. /ә\'nauns/', 'vt. 宣布, 声称, 显示, 预告；vi. 当报幕员, 宣布参加竞选', '基础', [], [], []],
  ['announcement', 'n. /ә\'naunsmәnt/', 'n. 公告, 发表, 告知；[经] 通告, 布告, 公告', '基础', [], [], []],
  ['annoy', 'vt. /ә\'nɒi/', 'vt. 使恼怒, 骚扰', '基础', [], [], []],
  ['annual', 'adj. /\'ænjuәl/', 'n. 年刊, 年报；a. 每年的, 一年一次的, 全年的, 一年生的', '基础', [], [], []],
  ['another', 'adj. pron. /ә\'nʌðә/', 'a. 另外的, 再一的, 不同的；pron. 又一个, 另一个, 类似的另一个', '基础', [], [], []],
  ['answer', 'n. v. /\'ɑ:nsә/', 'n. 答案, 回答, 回报, 答辩；vt. 回答, 反驳, 适应, 响应, 符合；vi. 回答, 答应, 负责, 符合, 成功；[计] 用户问题及答案新闻组', '基础', [], [], []],
  ['ant', 'n. /ænt/', 'n. 蚂蚁', '基础', [], [], []],
  ['Antarctic', 'adj.', '南极的', '基础', [], [], []],
  ['antique', 'n. /æn\'ti:k/', 'n. 古董, 古物；a. 古老的, 古风的, 旧式的, 过时的', '基础', [], [], []],
  ['anxiety', 'n. /æŋ\'zaiәti/', 'n. 焦虑, 忧虑, 令人焦虑的事；[医] 焦虑', '基础', [], [], []],
  ['anxious', 'adj. /\'æŋʃәs/', 'a. 忧虑的, 发愁的, 渴望的', '基础', [], [], []],
  ['any', 'pron. /\'eni/', '（无论）哪一个；哪些任何的；（用于疑问句、否定句）一些；什么', '基础', [], [], []],
  ['anybody', 'pron. /\'enibɒdi/', 'pron. 任何人；n. 重要人物', '基础', [], [], []],
  ['anyhow', 'adv. /\'enihau/', 'adv. 无论如何, 至少', '基础', [], [], []],
  ['anyone', 'pron. /\'eniwʌn/', 'pron. 任何人', '基础', [], [], []],
  ['anything', 'pron. /\'eniθiŋ/', '什么事（物）；任何事（物）', '基础', [], [], []],
  ['anyway', 'adv.', '不管怎样', '基础', [], [], []],
  ['anywhere', 'adv. /\'enihwєә/', 'adv. 无论何处', '基础', [], [], []],
  ['apart', 'adv. & adj. /ә\'pɑ:t/', 'adv. 成零碎, 成距离, 分别地, 分离着；a. 分离的', '基础', [], [], []],
  ['apartment', 'n. /ә\'pɑ:tmәnt/', '（美）楼中单元房，一套房间；房间', '基础', [], [], []],
  ['apologize', 'vi. /ә\'pɒlәdʒaiz/', 'vi. 道歉, 辩解', '基础', [], [], []],
  ['apology', 'n. /ә\'pɒlәdʒi/', 'n. 道歉, 辩护；[法] 道歉, 谢罪, 辩解者', '基础', [], [], []],
  ['apparent', 'adj. /ә\'pærәnt/', 'a. 清晰可见的, 显然的, 表面上的；[电] 外在的', '基础', [], [], []],
  ['appeal', 'v. /ә\'pi:l/', 'n. 恳求, 诉请, 上诉, 吸引力；vi. 呼吁, 诉请, 要求, 上诉, 有吸引力；vt. 将...上诉', '基础', [], [], []],
  ['appear', 'vi. /ә\'piә/', 'vi. 出现, 显得, 来到；[法] 出庭, 到案, 出现', '基础', [], [], []],
  ['appearance', 'n. /ә\'piәrәns/', 'n. 出现, 露面, 外观, 外表, 出版；[计] 外观, 版面', '基础', [], [], []],
  ['appendix', 'n. /ә\'pendiks/', 'n. 附录, 附加物, 阑尾；[化] 增补', '基础', [], [], []],
  ['appetite', 'n. /\'æpitait/', 'n. 食欲, 欲望, 爱好；[医] 食欲', '基础', [], [], []],
  ['applaud', 'v. & n. /ә\'plɒ:d/', 'v. 拍手喝彩, 称赞, 赞同', '基础', [], [], []],
  ['apple', 'n. /\'æpl/', 'n. 苹果, 家伙；[医] 苹果', '基础', [], [], []],
  ['applicant', 'n. /\'æplikәnt/', 'n. 申请者；[经] 申请人, 请求人, 谋事人', '基础', [], [], []],
  ['application', 'n. /.æpli\'keiʃәn/', 'n. 应用, 申请, 志愿书, 应用程序；[计] 应用, 应用程序', '基础', [], [], []],
  ['apply', 'v. /ә\'plai/', 'vt. 涂, 应用；vi. 申请, 适用', '基础', [], [], []],
  ['appoint', 'v. /ә\'pɒint/', 'vt. 任命, 指定, 下令；[法] 派, 派任, 任命', '基础', [], [], []],
  ['appointment', 'n. /ә\'pɒintmәnt/', 'n. 约会, 委任的职位, 委派；[经] 任命, 派, 指定', '基础', [], [], []],
  ['appreciate', 'v. /ә\'pri:ʃieit/', 'vt. 赏识, 鉴别, 为...而感激, 领会, 欣赏；vi. 增值, 涨价', '基础', [], [], []],
  ['appreciation', 'n. /ә.pri:ʃi\'eiʃәn/', 'n. 感激, 赏识, 鉴别；[经] 涨价, 增值', '基础', [], [], []],
  ['approach', 'n. & v. /ә\'prәutʃ/', 'n. 接近, 入门；vt. 接近, 近似, 找...商量；vi. 靠近', '基础', [], [], []],
  ['appropriate', 'adj. /ә\'prәupriәt/', 'a. 适当的；[经] 适当的, 拨出, 占用', '基础', [], [], []],
  ['approve', 'v. /ә\'pru:v/', 'vt. 赞同, 核准, 为...提供证据；vi. 赞许', '基础', [], [], []],
  ['approximately', 'adv. /ә\'prɒksimәtli/', 'adv. 大约, 大致, 近于；[经] 大约, 近似', '基础', [], [], []],
  ['apron', 'n. /\'eiprәn/', 'n. 围裙；[医] 围裙', '基础', [], [], []],
  ['arbitrary', 'adj. /\'ɑ:bitrәri/', 'a. 任意的, 武断的, 专治的, 霸道的', '基础', [], [], []],
  ['arch', 'n. /ɑ:tʃ/', 'n. 拱门, 拱形, 足弓；vt. 使成弓形；vi. 拱起, 成弓形；a. 主要的, 调皮的, 傲慢无礼的, 狡猾的', '基础', [], [], []],
  ['architect', 'n. /\'ɑ:kitekt/', 'n. 建筑师, 设计者, 缔造者', '基础', [], [], []],
  ['architecture', 'n. /\'ɑ:kitektʃә/', 'n. 建筑学, 建筑式样；[计] 体系结构', '基础', [], [], []],
  ['Arctic', 'adj.', '北极的', '基础', [], [], []],
  ['are', 'v. /ɑ:/', 'be的现在时复数或第二人称单数', '基础', [], [], []],
  ['area', 'n. /\'єәriә/', 'n. 区域, 面积, 范围, 空地；[计] 区域', '基础', [], [], []],
  ['argue', 'vi. /\'ɑ:gju/', 'vi. 提出理由, 争论, 辩论；vt. 主张, 辩论, 证明, 说服', '基础', [], [], []],
  ['argument', 'n. /\'ɑ:gjumәnt/', 'n. 争论, 论证, 论据, 自变量；[计] 参数', '基础', [], [], []],
  ['arise', 'vi. /ә\'raiz/', 'vi. 站立, 出现, 起来', '基础', [], [], []],
  ['arm', 'n. v. n. /ɑ:m/', 'n. 手臂, 袖子, 狭长港湾, 武器；vt. 武装, 装备；vi. 武装起来；[计] 异步应答方式; 自动货品销路管理', '基础', [], [], []],
  ['armchair', 'n. /.ɑ:m\'tʃєә/', 'n. 扶手椅', '基础', [], [], []],
  ['army', 'n. /\'ɑ:mi/', 'n. 军队, 陆军', '基础', [], [], []],
  ['around', 'adv. prep. /ә\'raund/', 'prep. 包围, 在...周围, 四处；adv. 兜着圈子, 在附近, 到处', '基础', [], [], []],
  ['arrange', 'v. /ә\'reindʒ/', 'v. 安排, 排列, 达成协议；[计] 重排', '基础', [], [], []],
  ['arrangement', 'n. /ә\'reindʒmәnt/', 'n. 排列, 整齐, 安排；[计] 排列', '基础', [], [], []],
  ['arrest', 'v. /ә\'rest/', 'n. 逮捕, 监禁；vt. 拘捕, 抑制, 吸引, 阻止', '基础', [], [], []],
  ['arrival', 'n. /ә\'raivl/', 'n. 到达, 抵达, 到达者；[经] 到达, 到达物', '基础', [], [], []],
  ['arrive', 'vi. /ә\'raiv/', 'vi. 到达, 抵达', '基础', [], [], []],
  ['arrow', 'n. /\'ærәu/', 'n. 箭, 箭状物, 箭头记号', '基础', [], [], []],
  ['art', 'n. /ɑ:t/', 'n. 艺术, 人文科学, 技术, 巧妙, 诡计, 美术；[计] 实际保持时间, 特许权和资源表, 平均检索时间, 平均运行时间', '基础', [], [], []],
  ['article', 'n. /\'ɑ:tikl/', 'n. 文章, 冠词, 物品, 物件, 条款, 契约；[计] 信件', '基础', [], [], []],
  ['artificial', 'adj. /.ɑ:ti\'fiʃәl/', 'a. 人造的, 假的, 非原地产的；[医] 人工的, 人造的, 伟牟', '基础', [], [], []],
  ['artist', 'n. /\'ɑ:tist/', 'n. 艺术家, 画家', '基础', [], [], []],
  ['as', 'adv. & conj. prep. /æz/', 'adv. 同样地, 例如；prep. 做为, 当作；conj. 当...之时, 以...的方式, 像...一样, 因为；[计] 高级系统, 先进系统, 辅助存储器, 自治系统', '基础', [], [], []],
  ['ash', 'n. /æʃ/', 'n. 灰, 灰烬；[化] 灰分', '基础', [], [], []],
  ['ashamed', 'adj. /ә\'ʃeimd/', 'a. 惭愧的, 羞耻的', '基础', [], [], []],
  ['Asia', 'n. /\'eiʒә/', 'n. 亚洲', '基础', [], [], []],
  ['Asian', 'adj. n. /\'eiʃәn/', 'n. 亚洲人；a. 亚洲的, 亚洲人的', '基础', [], [], []],
  ['aside', 'adv. /ә\'said/', 'n. 小声说的话, 旁白；adv. 在一边, 离开, 另外', '基础', [], [], []],
  ['ask', 'v. /ɑ:sk/', 'vi. 问, 要求；vt. 问, 要求, 邀请, 需要', '基础', [], [], []],
  ['asleep', 'adj. /ә\'sli:p/', 'a. 睡着的, 长眠的, 麻木的；adv. 熟睡地', '基础', [], [], []],
  ['aspect', 'n. /\'æspekt/', 'n. 外观, 方面, 面貌, 方向；[医] 方面, 局面; 外观', '基础', [], [], []],
  ['assess', 'v. /ә\'ses/', 'vt. 估定, 对...征税, 评定；[经] 估计, 估价, 确定(税款罚款等)的金额', '基础', [], [], []],
  ['assessment', 'n. /ә\'sesmәnt/', 'n. 评估, 估定, 评定的款额；[化] 评估', '基础', [], [], []],
  ['assignment', 'n.', '分配，任务，作业', '基础', [], [], []],
  ['assist', 'v. /ә\'sist/', 'n. 帮助, 协助；vt. 帮助, 促进；vi. 协助, 参加', '基础', [], [], []],
  ['assistance', 'n. /ә\'sistәns/', 'n. 协助, 援助；[经] 援助, 帮助', '基础', [], [], []],
  ['assistant', 'n. /ә\'sistәnt/', 'n. 助手, 助理, 助教；a. 有帮助的, 辅助的, 助理的', '基础', [], [], []],
  ['associate', 'v. /ә\'sәuʃieit/', 'n. 同伴, 伙伴, 关联的事物；vt. 使联合, 使发生联系；vi. 交往；[计] 关联', '基础', [], [], []],
  ['association', 'n. /ә.sәuʃә\'eiʃәn/', 'n. 协会；[计] 关联', '基础', [], [], []],
  ['assume', 'v. /ә\'sju:m/', 'vt. 假定, 承担, 呈现；vi. 装腔作势, 僭越', '基础', [], [], []],
  ['assumption', 'n. /ә\'sʌmpʃәn/', 'n. 假定, 自负, 担任, 假装；[经] 假定, 承担', '基础', [], [], []],
  ['astonish', 'vt. /ә\'stɒniʃ/', 'vt. 使惊讶', '基础', [], [], []],
  ['astronaut', 'n. /\'æstrәnɒ:t/', 'n. 太空旅行者, 宇航员；[法] 美国太空人', '基础', [], [], []],
  ['astronomer', 'n. /ә\'strɒnәmә/', 'n. 天文学家', '基础', [], [], []],
  ['astronomy', 'n. /ә\'strɒnәmi/', 'n. 天文学', '基础', [], [], []],
  ['at', 'prep. /æt/', 'prep. 在, 向, 对；[计] 地址转换器, 异常传输, 自动订票', '基础', [], [], []],
  ['athlete', 'n. /\'æθli:t/', 'n. 运动员, 运动选手；[医] 运动员', '基础', [], [], []],
  ['athletic', 'adj. /æθ\'letik/', '健壮的，体育运动的', '基础', [], [], []],
  ['Atlantic', 'adj. /әt\'læntik/', 'n. 大西洋；a. 大西洋的', '基础', [], [], []],
  ['atmosphere', 'n. /\'ætmәsfiә/', 'n. 大气, 空气, 气氛；[医] 大气; 大气压', '基础', [], [], []],
  ['atom', 'n. /\'ætәm/', 'n. 原子, 核能, 微粒, 微量；[计] 原子', '基础', [], [], []],
  ['attach', 'v. /ә\'tætʃ/', 'vt. 附上, 使依附, 使附属, 使喜爱, 系, 缚；vi. 附属, 归属, 联系在一起；[计] 挂接服务器命令, 关联, 挂接, 附加', '基础', [], [], []],
  ['attack', 'vt. & n. /ә\'tæk/', 'n. 攻击, 抨击；vt. 攻击, 抨击, 动手干；vi. 攻击', '基础', [], [], []],
  ['attain', 'v. /ә\'tein/', 'vt. 达到, 获得；vi. 达到', '基础', [], [], []],
  ['attempt', 'vt. & n. /ә\'tempt/', 'n. 尝试, 企图；vt. 尝试, 企图', '基础', [], [], []],
  ['attend', 'v. /ә\'tend/', 'vt. 参加, 照料, 伴随；vi. 专心于, 照顾, 服侍, 出席', '基础', [], [], []],
  ['attention', 'n. /ә\'tenʃәn/', 'n. 注意, 注意力；[计] 引起注意信号', '基础', [], [], []],
  ['attitude', 'n. /\'ætitju:d/', 'n. 态度, 看法, 姿势；[医] 体态, 姿势, 态度', '基础', [], [], []],
  ['attract', 'v. /ә\'trækt/', 'vt. 吸引, 诱惑；vi. 有吸引力', '基础', [], [], []],
  ['attraction', 'n. /ә\'trækʃәn/', 'n. 吸引, 吸引人的事物, 吸引力；[医] 吸引', '基础', [], [], []],
  ['attractive', 'adj. /ә\'træktiv/', 'a. 吸引人的, 有魅力的；[法] 有吸引力的, 有迷惑力的', '基础', [], [], []],
  ['audience', 'n. /\'ɒ:diәns/', 'n. 听众, 观众, 读者；[法] 听讼, 观众, 听众', '基础', [], [], []],
  ['August', 'n.', '8 月', '基础', [], [], []],
  ['aunt', 'n. /ɑ:nt/', 'n. 阿姨, 姨妈, 舅妈, 姑妈, 伯母', '基础', [], [], []],
  ['Australia', 'n. /ɒ\'streiljә/', 'n. 澳洲, 澳大利亚', '基础', [], [], []],
  ['Australian', 'adj. n. /ɒ\'streiljәn/', 'n. 澳大利亚人；a. 澳大利亚的, 澳洲的, 澳洲人的', '基础', [], [], []],
  ['authentic', 'adj. /ɒ:\'θentik/', 'a. 可靠的, 可信的, 真正的；[法] 被认证的, 确认的, 可信的', '基础', [], [], []],
  ['author', 'n. /\'ɒ:θә/', 'n. 作家, 作家的著作, 创始人；[法] 作者, 著作人, 本人', '基础', [], [], []],
  ['authority', 'n. /ɒ:\'θɒriti/', 'n. 权力, 当权者, 当局, 权威, 专家；[经] 代理权, 授权, 权威', '基础', [], [], []],
  ['automatic', 'adj. /.ɒ:tә\'mætik/', 'n. 自动手枪, 自动机械；a. 自动的, 机械的, 必然的, 无意识的', '基础', [], [], []],
  ['autonomous', 'adj. /ɒ:\'tɒnәmәs/', 'a. 自治的；[医] 自主的', '基础', [], [], []],
  ['autumn', 'n. /\'ɒ:tәm/', 'n. 秋天, 成熟期', '基础', [], [], []],
  ['available', 'adj. /ә\'veilәbl/', 'a. 可利用的, 可获得的, 有效的；[医] 有效的, 可得的', '基础', [], [], []],
  ['avenue', 'n. /\'ævәnju:/', 'n. 大街, 途径, 林荫路', '基础', [], [], []],
  ['average', 'adj. n. /\'ævәridʒ/', 'n. 平均, 平均数, 一般水平, 海损；a. 平均的, 中等的, 平常的；vt. 算出...平均数, 平均做, 均分, 使平衡；vi. 平均为, 呈中间色', '基础', [], [], []],
  ['avoid', 'v. /ә\'vɒid/', 'vt. 避免, 防止, 撤消；[法] 避免, 回避, 躲开', '基础', [], [], []],
  ['awake', 'v. adj. /ә\'weik/', 'a. 醒着的；vt. 唤醒, 唤起, 使意识到；vi. 醒来, 被唤起, 意识到', '基础', [], [], []],
  ['award', 'n. v. /ә\'wɒ:d/', 'n. 奖品, 裁定, 判决；vt. 授予, 给予', '基础', [], [], []],
  ['aware', 'adj. /ә\'wєә/', 'a. 知道的, 有觉悟的', '基础', [], [], []],
  ['away', 'adv. /ә\'wei/', 'adv. 离去', '基础', [], [], []],
  ['awesome', 'adj. /\'ɒ:sәm/', 'a. 引起敬畏的, 可怕的', '基础', [], [], []],
  ['awful', 'adj. /\'ɒ:ful/', 'a. 可怕的, 庄严的, 虔敬的', '基础', [], [], []],
  ['awkward', 'adj. /\'ɒ:kwәd/', 'a. 笨拙的, 棘手的', '基础', [], [], []],
  ['baby', 'n. /\'beibi/', 'n. 婴孩；[医] 婴儿', '基础', [], [], []],
  ['bachelor', 'n. /\'bætʃәlә/', 'n. 单身汉, 学士；[法] 学士, 单身汉', '基础', [], [], []],
  ['back', 'adv. adj. n. /bæk/', 'a. 后面的；vt. 使后退, 支持；vi. 倒退, 背靠；adv. 向后地；n. 背部, 后面', '基础', [], [], []],
  ['background', 'n. /\'bækgraund/', 'n. 背景, 背景资料；[计] 背景, 后台', '基础', [], [], []],
  ['backward', 'adv. /\'bækwәd/', 'adv. 向后地, 相反地；a. 向后的, 相反的；[计] 倒推', '基础', [], [], []],
  ['bacon', 'n. /\'beikәn/', 'n. 熏猪肉；[机] 腌肉', '基础', [], [], []],
  ['bad', 'adj. /bæd/', 'a. 坏的；n. 坏；adv. 坏地', '基础', [], [], []],
  ['bag', 'n. /bæg/', 'n. 袋子, 袋状物；vt. 使膨大, 装袋, 猎获', '基础', [], [], []],
  ['baggage', 'n. /\'bægidʒ/', 'n. 行李；[经] 行李', '基础', [], [], []],
  ['bake', 'v. /beik/', 'vt. 烘焙, 烤；vi. 烤面包；n. 烘焙, 烤', '基础', [], [], []],
  ['bakery', 'n. /\'beikәri/', 'n. 面包店', '基础', [], [], []],
  ['balance', 'n. /\'bælәns/', 'n. 平衡, 差额；vi. 平衡, 相等；vt. 称, 权衡, 比较, 使平衡, 结算, 抵消', '基础', [], [], []],
  ['balcony', 'n. /\'bælkәni/', 'n. 阳台, 戏院楼厅', '基础', [], [], []],
  ['ball', 'n. /bɒ:l/', 'n. 球, 舞会, 球状物；v. 捏成球形', '基础', [], [], []],
  ['ballet', 'n. /\'bælei/', 'n. 芭蕾舞', '基础', [], [], []],
  ['balloon', 'n. /bә\'lu:n/', 'n. 气球；vt. 使成气球状；vi. 膨胀如气球, 激增', '基础', [], [], []],
  ['bamboo', 'n. /bæm\'bu:/', 'n. 竹子；[医] 竹类', '基础', [], [], []],
  ['ban', 'n. v. /bæn/', 'n. 禁令；vt. 禁止, 取缔', '基础', [], [], []],
  ['banana', 'n. /bә\'nɑ:nә/', 'n. 香蕉', '基础', [], [], []],
  ['band', 'n. /bænd/', 'n. 带子, 队, 乐队；v. 联合, 结合；[计] 频带; 波段; 区', '基础', [], [], []],
  ['bandage', 'n. /\'bændidʒ/', 'n. 绷带；[化] 帘布筒; 实心轮胎; 紧带; 绷带', '基础', [], [], []],
  ['bank', 'n. /bæŋk/', 'n. 银行, 堤, 岸；[医] 库', '基础', [], [], []],
  ['bar', 'n. /bɑ:/', 'n. 条, 棒, 酒吧, 栅, 障碍物；vt. 禁止, 阻挡, 妨碍；[计] 棒形图', '基础', [], [], []],
  ['barbecue', 'n. /\'bɑ:bikju:/', 'n. 烤肉；vt. 烤肉, 烧烤', '基础', [], [], []],
  ['barber', 'n. /\'bɑ:bә/', '（为男人理发）理发师', '基础', [], [], []],
  ['bare', 'adj. /bєә/', 'a. 赤裸的, 缺少的, 无遮蔽的, 坦率的；vt. 使赤裸, 露出', '基础', [], [], []],
  ['bargain', 'n. v. /\'bɑ:gin/', 'n. 交易, 买卖协定, 特价商品；v. 讲价, 交易', '基础', [], [], []],
  ['bark', 'v. n. /bɑ:k/', 'n. 树皮, 吠声；vi. 吠, 叫骂；vt. 喊出, 剥树皮', '基础', [], [], []],
  ['barrier', 'n. /\'bæriә/', 'n. 障碍, 栅栏；[化] 势垒; 阻片; 阻挡层', '基础', [], [], []],
  ['base', 'n. /beis/', 'n. 底部, 垒, 基础, 基地；vt. 以...作基础；a. 卑鄙的, 低劣的；[计] 基准', '基础', [], [], []],
  ['baseball', 'n. /\'beisbɒ:l/', 'n. 棒球；[计] 棒球系统', '基础', [], [], []],
  ['basement', 'n. /\'beismәnt/', 'n. 地下室, 墙脚；[化] 地下室', '基础', [], [], []],
  ['basic', 'adj. /\'beisik/', 'n. 基本原理, 要素, 基本规律；a. 基本的, 碱性的；(计算机)BASIC语言', '基础', [], [], []],
  ['basin', 'n. /\'beisn/', 'n. 盆, 盆地；[医] 第三脑室, 骨盆', '基础', [], [], []],
  ['basis', 'n. /\'beisis/', 'n. 基础, 主要成分；[化] 基底', '基础', [], [], []],
  ['basket', 'n. /\'bɑ:skit/', 'n. 篮, 篮子；vt. 装入篮', '基础', [], [], []],
  ['basketball', 'n. /\'bɑ:skitbɒ:l/', 'n. 篮球', '基础', [], [], []],
  ['bat', 'n. /bæt/', 'n. 蝙蝠, 球棒；v. 用球棒打, 眨眼；[计] 成批', '基础', [], [], []],
  ['bath', 'n. /bæθ.bɑ:θ/', 'n. 沐浴, 浴室；[医] 浴', '基础', [], [], []],
  ['bathe', 'vi. /beið/', 'vt. 沐浴, 用水洗；vi. 洗澡', '基础', [], [], []],
  ['bathrobe', 'n. /\'bɑ:θrәub/', 'n. 浴衣', '基础', [], [], []],
  ['bathroom', 'n. /\'bɑ:θru:m/', 'n. 浴室, 厕所', '基础', [], [], []],
  ['bathtub', 'n. /\'bɑ:θtʌb/', 'n. 浴缸', '基础', [], [], []],
  ['battery', 'n. /\'bætәri/', 'n. 电池, 殴打；[化] 蓄电池', '基础', [], [], []],
  ['battle', 'n. /\'bætl/', 'n. 战役；v. 战斗', '基础', [], [], []],
  ['bay', 'n. /bei/', 'n. 海湾, 狗吠声, 月桂；vt. 吠, 使走投无路；vi. 吠', '基础', [], [], []],
  ['BC', 'n.', '公元前', '基础', [], [], []],
  ['be', 'v. /bi:/', '是（原形），其人称和时态形式有（am，is，are，was，were，being，been）；成为', '基础', [], [], []],
  ['beach', 'n. /bi:tʃ/', '海滨，海滩', '基础', [], [], []],
  ['bean', 'n. /bi:n/', 'n. 豆子；[化] 油嘴; 豆', '基础', [], [], []],
  ['beancurd', 'n. /\'bi:nkə:d/', 'n. 豆腐', '基础', [], [], []],
  ['bear', 'v. n. /bєә/', 'n. 熊；vt. 忍受, 支承, 产生, 怀有, 通过卖空使跌价；vi. 忍受, 结果实, 压挤, 行进, 转向', '基础', [], [], []],
  ['beard', 'n. /biәd/', 'n. 胡须；vt. 抓住胡须, 公开反对', '基础', [], [], []],
  ['beast', 'n. /bi:st/', 'n. 畜生, 动物, 野兽, 兽性', '基础', [], [], []],
  ['beat', 'v. n. /bi:t/', 'n. 心跳(声), 打, 敲打声, 拍子；v. 打, 拍打, 打败；a. 疲乏的, 颓废的；beat的过去式；[计] 拍; 节拍', '基础', [], [], []],
  ['beautiful', 'adj. /\'bju:tiful/', '美，美丽，美观的', '基础', [], [], []],
  ['beauty', 'n. /\'bju:ti/', 'n. 美, 美人', '基础', [], [], []],
  ['because', 'conj. /bi\'kɒ:z/', 'conj. 因为', '基础', [], [], []],
  ['become', 'v. /bi\'kʌm/', 'vi. 变成, 变得；vt. 适合', '基础', [], [], []],
  ['bed', 'n. /bed/', 'n. 床, 睡眠处, 河床, 底座, 路基, 一层；vt. 提供宿处, 栽种, 安装；vi. 睡, 形成坚实的一层', '基础', [], [], []],
  ['beddings', 'n. /\'bedɪŋ/', 'n. 寝具；（建筑）[建] 基床；（家畜）草垫；a. 适于花坛种植的；vt. 把…栽入苗床（bed的ing形式）；vi. 睡（bed的ing形式）', '基础', [], [], []],
  ['bedroom', 'n. /\'bedrum/', '寝室，卧室', '基础', [], [], []],
  ['bee', 'n. /bi:/', 'n. 蜜蜂, 聚会', '基础', [], [], []],
  ['beef', 'n. /bi:f/', 'n. 牛肉, 肌肉；vt. 养(牛), 宰(牛)；vi. 抱怨, 告发', '基础', [], [], []],
  ['beer', 'n. /biә/', 'n. 啤酒；[化] 啤酒', '基础', [], [], []],
  ['before', 'prep. adv. conj. /bi\'fɒ:/', 'prep. 在...之前；conj. 在...之前；adv. 在前', '基础', [], [], []],
  ['beg', 'v. /beg/', 'v. 乞求, 乞讨, 请求', '基础', [], [], []],
  ['begin', 'v. /bi\'gin/', 'v. 开始；[计] 开始', '基础', [], [], []],
  ['beginning', 'n. /bi\'giniŋ/', '开始，开端', '基础', [], [], []],
  ['behalf', 'n. /bi\'hɑ:f/', '代表某人，为了某人', '基础', [], [], []],
  ['behave', 'v. /bi\'heiv/', 'vi. 举止端正, 行为规矩；vt. 检点(自己的)行为, 使表现好', '基础', [], [], []],
  ['behaviour', 'n. /bi\'heivjә/', 'n. 行为, 举止；[计] 特性, 性能, 特点, 行为, 动作, 状态', '基础', [], [], []],
  ['behind', 'prep. adv. /bi\'haind/', 'adv. 在后地；prep. 在...背后', '基础', [], [], []],
  ['being', 'n. /\'bi:iŋ/', 'n. 存在, 性质, 生命, 人, 生物, be的现在分词', '基础', [], [], []],
  ['Belgium', 'n. /\'beldʒәm/', 'n. 比利时', '基础', [], [], []],
  ['belief', 'n. /bi\'li:f/', 'n. 信念, 相信, 信仰', '基础', [], [], []],
  ['believe', 'v. /bi\'li:v/', '相信，认为', '基础', [], [], []],
  ['bell', 'n. /bel/', 'n. 铃, 钟；[计] 响铃命令', '基础', [], [], []],
  ['belly', 'n. /\'beli/', 'n. 腹部, 食欲；vt. 使鼓起；vi. 鼓起, 匍匐前进', '基础', [], [], []],
  ['belong', 'vi. /bi\'lɒŋ/', 'vi. 属于, 合适', '基础', [], [], []],
  ['below', 'prep. /bi\'lәu/', 'prep. 在下面；adv. 在下面', '基础', [], [], []],
  ['belt', 'n. /belt/', 'n. 带子, 地带；[医] 带, 腰带, 束带, 地带, 区', '基础', [], [], []],
  ['bench', 'n. /bentʃ/', 'n. 长椅子；[机] 台', '基础', [], [], []],
  ['bend', 'v. /bend/', 'vi. 变弯曲, 屈服；vt. 使弯曲, 使屈服；n. 弯曲', '基础', [], [], []],
  ['beneath', 'prep. /bi\'ni:θ/', 'prep. 在...下方；adv. 在...下方', '基础', [], [], []],
  ['beneficial', 'adj. /.beni\'fiʃәl/', 'a. 有益的, 受益的；[经] 有使用权的, 可享利益的', '基础', [], [], []],
  ['benefit', 'n. & v. /\'benifit/', 'n. 利益；vt. 有益于；vi. 受益', '基础', [], [], []],
  ['beside', 'prep. /bi\'said/', 'prep. 在旁边', '基础', [], [], []],
  ['besides', 'prep. adv. /bi\'saidz/', 'prep. 除...之外；adv. 而且, 此外', '基础', [], [], []],
  ['betray', 'v. /bi\'trei/', 'vt. 出卖, 背叛, 辜负, 暴露；[法] 出卖, 背叛, 泄漏', '基础', [], [], []],
  ['between', 'prep. /bi\'twi:n/', '在（两者）之间；在…中间', '基础', [], [], []],
  ['beyond', 'prep. /bi\'jɒnd/', 'prep. 超过, 在那一边, 迟于；adv. 在远处；n. 更远处', '基础', [], [], []],
  ['bicycle', 'n. /\'baisikl/', 'n. 自行车', '基础', [], [], []],
  ['bid', 'v. & n. /bid/', 'n. 出价；v. 命令, 吩咐, 请求, 表示, 宣布, 投标', '基础', [], [], []],
  ['big', 'adj. /big/', 'a. 大的, 重要的；adv. 大量地', '基础', [], [], []],
  ['bike', 'n.', '自行车', '基础', [], [], []],
  ['bill', 'n. /bil/', 'n. 帐单, 清单, 钞票, 鸟嘴, 广告, 法案, 票据；vt. 开帐单, (用招贴)宣布', '基础', [], [], []],
  ['biology', 'n. /bai\'ɒlәdʒi/', 'n. 生物学；[化] 生物; 生物学', '基础', [], [], []],
  ['bird', 'n. /bә:d/', 'n. 鸟, 羽毛球；vi. 打鸟', '基础', [], [], []],
  ['birth', 'n. /bә:θ/', 'n. 出生, 起源；[医] 生产, 分娩', '基础', [], [], []],
  ['birthday', 'n. /\'bә:θdei/', 'n. 生日', '基础', [], [], []],
  ['birthplace', 'n. /\'bә:θpleis/', '出生地；故乡', '基础', [], [], []],
  ['biscuit', 'n. /\'biskit/', 'n. 饼干；[化] 素坯; 饼干', '基础', [], [], []],
  ['bit', 'n. /bit/', 'n. 少量, 马嚼子, 辅币；vt. 给马上嚼子, 控制；bite的过去式和过去分词；[计] 比特, 二进制数位, 机内测试', '基础', [], [], []],
  ['bite', 'v. /bait/', 'n. 咬, 一口；v. 咬, 刺痛, 穿透', '基础', [], [], []],
  ['bitter', 'adj. /\'bitә/', 'a. 苦的, 痛苦的, 怀恨的；adv. 刺骨；v. (使)变苦', '基础', [], [], []],
  ['black', 'n. adj. /blæk/', 'n. 黑色, 黑颜料；a. 黑色的', '基础', [], [], []],
  ['blackboard', 'n. /\'blækbɒ:d/', 'n. 黑板', '基础', [], [], []],
  ['blame', 'n. & v. /bleim/', 'n. 过失, 责备；vt. 责备, 归咎于', '基础', [], [], []],
  ['blank', 'n. & adj. /blæŋk/', 'n. 空格, 空白；a. 空白的, 空虚的, 完全的, 无色的；vi. 消失, 成为空白；vt. 使无效, 取消, 封锁；[计] 空白', '基础', [], [], []],
  ['blanket', 'n. /\'blæŋkit/', 'n. 毛毯, 毯子；vt. 掩盖, 覆盖；a. 总共的', '基础', [], [], []],
  ['bleed', 'vi. /bli:d/', 'vi. 流血, 悲痛, 渗出；vt. 使出血, 榨取', '基础', [], [], []],
  ['bless', 'vt. /bles/', 'vt. 祝福, 祈佑, 使神圣化', '基础', [], [], []],
  ['blind', 'adj. /blaind/', 'n. 蒙蔽物, 窗帘；a. 盲目的, 瞎的, 不加思考的；vt. 使失明, 蒙蔽, 遮暗；adv. 盲目地', '基础', [], [], []],
  ['block', 'n. vt. /blɒk/', 'n. 街区, 木块, 石块, 块；vt. 阻塞, 封锁, 使成块状；[计] 块, 数据块', '基础', [], [], []],
  ['blonde', 'adj. n.', '头发金黄色的 金发碧眼的女人', '基础', [], [], []],
  ['blood', 'n. /blʌd/', 'n. 血, 血统, 流血, 气质, 生命；vt. 使出血, 用血涂', '基础', [], [], []],
  ['blouse', 'n. /blauz/', '宽罩衫；（妇女、儿童穿的）短上衣', '基础', [], [], []],
  ['blow', 'n. v. /blәu/', 'n. 吹, 打击, 殴打, 花开；v. 吹, 风吹, 吹响, 开花', '基础', [], [], []],
  ['blue', 'n. adj. /blu:/', 'n. 蓝色；a. 蓝色的, 下流的, 忧郁的；vt. 染成蓝色；vi. 变蓝', '基础', [], [], []],
  ['board', 'n. v. /bɒ:d/', 'n. 木板, 甲板, 膳食, 会议桌；vt. 乘船, 供膳食, 用板覆盖；vi. 搭伙；[计] 板', '基础', [], [], []],
  ['boat', 'n. /bәut/', 'n. 船；vi. 乘船；vt. 以船运', '基础', [], [], []],
  ['body', 'n.', '身体', '基础', [], [], []],
  ['boil', 'v. /bɒil/', 'n. 煮沸, 沸腾, 疖；v. 煮沸, 激动', '基础', [], [], []],
  ['bomb', 'n. v. /bɒm/', 'n. 炸弹；vt. 轰炸, 投弹于；vi. 失败', '基础', [], [], []],
  ['bond', 'n. & v. /bɒnd/', 'n. 捆绑物, 结合, 债券, 契约, 粘合剂, 保证人, 键, 关栈保留；vt. 存入关栈, 使黏合；vi. 结合', '基础', [], [], []],
  ['bone', 'n. /bәun/', 'n. 骨头, 骨, 骨制品；vt. 剔骨；vi. 专心致志', '基础', [], [], []],
  ['bonus', 'n. /\'bәunәs/', 'n. 奖金, 红利；[经] 奖金, 红利, 额外补贴', '基础', [], [], []],
  ['book', 'n. v. /buk/', 'n. 书, 书籍, 帐簿, 名册, 工作簿；v. 登记, 预订；[计] 工作簿', '基础', [], [], []],
  ['booklet', 'n.', '小册子', '基础', [], [], []],
  ['boom', 'n. & v. /bu:m/', 'n. 繁荣, 隆隆声；vi. 急速发展, 发隆隆声；vt. 使兴旺, 发隆隆声', '基础', [], [], []],
  ['boot', 'n. /bu:t/', 'n. 长靴, 踢, 解雇, 效用；vt. 使穿靴, 踢, 解雇, 有用；[计] 引导, 自举', '基础', [], [], []],
  ['border', 'n. /\'bɒ:dә/', 'n. 边缘, 边境, 边界, 花坛；vt. 在...上镶边, 接近；vi. 接界, 近似；[计] 边框', '基础', [], [], []],
  ['bored', 'adj.', 'a. 无聊的；烦人的；无趣的', '基础', [], [], []],
  ['boring', 'adj. /\'bɒ:riŋ/', 'a. 烦人的, 无聊的, 无趣的；[机] 成孔期, 搪孔', '基础', [], [], []],
  ['born', 'adj. /bɒ:n/', 'a. 天生的；bear的过去分词', '基础', [], [], []],
  ['borrow', 'v. /\'bɒrәu/', 'vt. 借, 借入, 借用；vi. 借；[计] 借位; 借位数', '基础', [], [], []],
  ['boss', 'n. /bɒs/', 'n. 老板, 上司, 岩瘤, 浮雕, 母牛；vt. 指挥, 控制, 浮雕', '基础', [], [], []],
  ['both', 'adj. pron. /bәuθ/', 'a. 两者的；adv. 两者都；pron. 两者', '基础', [], [], []],
  ['bother', 'vt. vi. n.', '烦扰，打扰 烦恼，操心 麻烦，烦扰', '基础', [], [], []],
  ['bottle', 'n. /\'bɒtl/', 'n. 瓶子, 酒瓶；vt. 装瓶, 抑制, 围困', '基础', [], [], []],
  ['bottom', 'n. /\'bɒtәm/', 'n. 底部；a. 底部的；vt. 给...装底, 查明真相；vi. 到达底部, 建立基础', '基础', [], [], []],
  ['bounce', 'v. /bauns/', 'n. 跳, 跳跃, 弹力, 撞击；vi. 反跳, 弹跳；vt. 使跳回, 撞击；[计] 打回', '基础', [], [], []],
  ['boundary', 'n. /\'baundri/', 'n. 边界, 分界线；[计] 边界', '基础', [], [], []],
  ['bow', 'v. & n. /bәu.bau/', 'n. 弓, 眼睛框；v. 用弓拉琴, 弯成弓形；n. 鞠躬, 屈服', '基础', [], [], []],
  ['bowl', 'n. /bәul/', 'n. 碗, 木球, 大酒杯；v. 滚木球, 快而稳地行驶', '基础', [], [], []],
  ['bowling', 'n. /\'bәuliŋ/', 'n. 保龄球戏', '基础', [], [], []],
  ['box', 'n. /bɒks/', 'n. 盒子, 箱, 方框, 一巴掌；vt. 装...入盒中, 装箱, 打耳光；vi. 拳击；[计] 方框', '基础', [], [], []],
  ['boxing', 'n. /\'bɒksiŋ/', 'n. 拳击；[医] 围模(牙科)', '基础', [], [], []],
  ['boy', 'n. /bɒi/', 'n. 男孩；[法] 男孩, 少年, 儿子', '基础', [], [], []],
  ['boycott', 'v. /\'bɒikɒt/', 'n. 联合抵制；vt. 联合抵制', '基础', [], [], []],
  ['brain', 'n. /brein/', 'n. 脑；vt. 打碎脑部', '基础', [], [], []],
  ['brake', 'n. vi. /breik/', 'n. 刹车, 阻碍, 丛林；v. 刹车', '基础', [], [], []],
  ['branch', 'n. /bræntʃ/', 'n. 树枝, 支店, 支流, 分部；vi. 分支, 出枝；vt. 分割, 用枝状叶脉刺绣花纹装饰；[计] 分支, 目录分支', '基础', [], [], []],
  ['brand', 'n. /brænd/', 'n. 商标, 牌子, 烙印；vt. 打烙印于', '基础', [], [], []],
  ['brave', 'adj. /breiv/', 'a. 勇敢的, 美好的, 华丽的；n. 勇敢者；vt. 勇敢地面对', '基础', [], [], []],
  ['bravery', 'n. /\'breivәri/', 'n. 勇敢', '基础', [], [], []],
  ['bread', 'n. /bred/', 'n. 面包, 生计, 食物；vt. 裹以面包屑', '基础', [], [], []],
  ['break', 'n. v. /breik/', 'n. 休息, 中断, 破裂处, 绝交, 破晓, 突变；vt. 打破, 弄破, 弄坏, 破坏, 违反, 打断, 削弱, 放弃；vi. 破碎, 决裂, 破晓, 突变, 变弱, 暂停；n. 分隔符；[计] 分隔符; 中断; DOS内部命令:设定扫描中断按键的时机', '基础', [], [], []],
  ['breakfast', 'n. /\'brekfәst/', 'n. 早餐', '基础', [], [], []],
  ['breakthrough', 'n. /\'breikθru:/', 'n. 突破；[经] 突破, 新发现, 新进展', '基础', [], [], []],
  ['breast', 'n. /brest/', 'n. 胸部, 乳房, 胸怀；vt. 以胸对着, 面对', '基础', [], [], []],
  ['breath', 'n. /breθ/', 'n. 呼吸, 气息, 瞬间；[医] 呼气, 呵气, 口气, 呼吸', '基础', [], [], []],
  ['breathe', 'vi. /bri:ð/', 'vi. 呼吸, 生存, 低语；vt. 呼吸, 使喘息, 发散, 低声说', '基础', [], [], []],
  ['breathless', 'adj. /\'breθlis/', 'a. 喘不过气来的, 屏气的, 气喘吁吁的, 无风的, 死的', '基础', [], [], []],
  ['brick', 'n. /brik/', 'n. 砖块, 积木；a. 用砖做的；vt. 用砖造, 用砖砌', '基础', [], [], []],
  ['bride', 'n. /braid/', 'n. 新娘', '基础', [], [], []],
  ['bridegroom', 'n. /\'braidgrum/', 'n. 新郎', '基础', [], [], []],
  ['bridge', 'n. /bridʒ/', 'n. 桥, 舰桥, 桥梁, 桥牌；vt. 架桥于, 跨越；[计] 桥, 网桥, 桥接器', '基础', [], [], []],
  ['brief', 'adj. /bri:f/', 'n. 摘要, 简报；a. 简短的, 短暂的；vt. 对...作简报, 摘要, 节录', '基础', [], [], []],
  ['bright', 'adj. /brait/', 'a. 明亮的, 聪明的, 鲜明的, 欢快的；adv. 明亮地, 欢快地', '基础', [], [], []],
  ['brilliant', 'adj. /\'briljәnt/', 'a. 光辉的, 灿烂的, 有才气的；[机] 亮的', '基础', [], [], []],
  ['bring', 'vt. /briŋ/', 'vt. 带来, 产生, 促使, 提出；vi. 生产', '基础', [], [], []],
  ['broad', 'adj. /brɒ:d/', 'a. 宽广的, 辽阔的, 广大的, 显著的；adv. 宽阔地；n. 宽阔部分', '基础', [], [], []],
  ['broadcast', 'v. n. /\'brɒ:dkæst/', 'n. 广播, 传播；a. 广播的；v. 广播；adv. 经广播, 四散地；[计] 广播命令, 广播', '基础', [], [], []],
  ['broken', 'adj. /\'brәukәn/', 'a. 坏掉的, 打破的, 断掉的；break的过去分词', '基础', [], [], []],
  ['broom', 'n. /bru:m/', 'n. 扫帚, 金雀花；vt. 扫除', '基础', [], [], []],
  ['brother', 'n. /\'brʌðә/', 'n. 兄弟', '基础', [], [], []],
  ['brotherhood', 'n. /\'brʌðәhud/', 'n. 手足情谊, 兄弟关系', '基础', [], [], []],
  ['brown', 'n. adj. /braun/', 'n. 褐色；a. 褐色的；v. (使)变褐色', '基础', [], [], []],
  ['brush', 'v. n. /brʌʃ/', 'n. 刷子, 毛笔, 争吵；vt. 刷；vi. 擦过, 掠过；[计] 电刷', '基础', [], [], []],
  ['budget', 'n. /\'bʌdʒit/', 'n. 预算；vi. 编预算；vt. 编入预算, 安排；a. 廉价的', '基础', [], [], []],
  ['buffet', 'n. /\'bʌfit/', 'n. 自助餐, 小卖部, 碗橱, 殴打, 冲击；vt. 连续打, 冲击, 搏斗；vi. 奋斗', '基础', [], [], []],
  ['build', 'v. /bild/', 'v. 建立, 建筑；n. 构造, 体格', '基础', [], [], []],
  ['building', 'n. /\'bildiŋ/', 'n. 建筑物, 建筑；[法] 营造, 建筑, 建筑物', '基础', [], [], []],
  ['bunch', 'n. /bʌntʃ/', 'n. 串, 束；[医] 骨肿块(马)', '基础', [], [], []],
  ['burden', 'n. /\'bә:dn/', 'n. 负担, 重载, 担子, 责任；vt. 装货于, 烦扰, 使负担', '基础', [], [], []],
  ['bureaucratic', 'adj. /bjuәrәu\'krætik/', 'a. 官僚的；[经] 机僚化的', '基础', [], [], []],
  ['burglar', 'n. /\'bә:glә/', 'n. 窃贼；[法] 夜盗, 窃贼, 盗窃者', '基础', [], [], []],
  ['burn', 'v. n. /bә:n/', 'vt. 烧, 烧毁, 烧伤；vi. 燃烧, 发热, 烧毁；n. 烧伤, 烙印', '基础', [], [], []],
  ['burst', 'v. /bә:st/', 'n. 破裂, 突发, 爆发；v. 爆裂, 突发, 充满；[计] 二进制位组; 字符组; 脉冲串', '基础', [], [], []],
  ['bury', 'vt. /\'beri/', 'vt. 埋葬, 埋藏', '基础', [], [], []],
  ['bus', 'n. /bʌs/', 'n. 公共汽车；[计] 总线; 汇流条; 母线', '基础', [], [], []],
  ['bush', 'n. /buʃ/', 'n. 矮树丛；[化] 管衬', '基础', [], [], []],
  ['business', 'n. /\'biznis/', 'n. 生意, 事情, 业务, 商业, 商行, 职责；[经] 企业, 商业, 营业', '基础', [], [], []],
  ['businessman', 'n. /\'biznismæn/', 'n. 商人, 实业家, 工商业家', '基础', [], [], []],
  ['businesswoman', 'n. /\'bizniswjmæn/', 'n. 商人, 办理实务的人, 经商者', '基础', [], [], []],
  ['busy', 'adj. /\'bizi/', 'a. 忙碌的, 热闹的, 没空的；vt. 使忙；vi. 忙碌；[计] 忙; 忙碌', '基础', [], [], []],
  ['but', 'conj. prep. /bʌt/', 'prep. 除了；conj. 但是；adv. 仅仅', '基础', [], [], []],
  ['butcher', 'n. vt. /\'butʃә/', 'n. 屠夫, 肉商, 小贩；vt. 屠宰, 屠杀', '基础', [], [], []],
  ['butter', 'n. /\'bʌtә/', 'n. 奶油, 黄油；vt. 涂黄油于', '基础', [], [], []],
  ['butterfly', 'n. /\'bʌtәflai/', 'n. 蝴蝶；[医] 蝶式棉块, 翼形皮癣, 纸蝶', '基础', [], [], []],
  ['button', 'n. v. /\'bʌtәn/', 'n. 钮扣, 按钮；vi. 扣住；vt. 钉钮扣于, 扣紧；[计] 按钮', '基础', [], [], []],
  ['buy', 'vt. /bai/', 'vt. 买, 获得；vi. 买；n. 购买, 买得的东西', '基础', [], [], []],
  ['by', 'prep. /bai/', 'prep. 被, 经, 由, 在...之旁；adv. 经过, 在近处', '基础', [], [], []],
  ['bye', 'int. /bai/', 'interj. 再会, 回头见；[计] 结束命令', '基础', [], [], []],
  ['cab', 'n. /kæb/', 'n. 出租车, 出租汽车, 出租马车；vi. 乘出租马车(或汽车)', '基础', [], [], []],
  ['cabbage', 'n. /\'kæbidʒ/', 'n. 卷心菜；[医] 卷心菜, 甘兰', '基础', [], [], []],
  ['cafeteria', 'n. /.kæfi\'tiәriә/', 'n. 自助餐厅；[经] 自助餐厅', '基础', [], [], []],
  ['café', 'n.', '咖啡馆；餐馆', '基础', [], [], []],
  ['cage', 'n. /keidʒ/', 'n. 笼, 牢房, 战俘营；vt. 关进笼内', '基础', [], [], []],
  ['cake', 'n. /keik/', 'n. 蛋糕, 块, 饼；vt. 使结块, 加块状物于；vi. 结块', '基础', [], [], []],
  ['calculate', 'v. /\'kælkjuleit/', 'v. 计算, 预测, 计划, 打算', '基础', [], [], []],
  ['call', 'n. v. /kɒ:l/', 'n. 呼叫, 访问, 打电话, 号召, 召集, 要求；vt. 呼叫, 召集, 打电话；vi. 叫喊, 访问, 叫牌；[计] 调用; 呼叫; DOS内部命令:在批处理文件中调用另一个批处理文件', '基础', [], [], []],
  ['calm', 'adj. v. /kɑ:m/', 'n. 平稳, 风平浪静；a. 平静的, 冷静的；vi. 平静下来, 镇静；vt. 使平静', '基础', [], [], []],
  ['camel', 'n. /\'kæml/', 'n. 骆驼, 打捞浮筒', '基础', [], [], []],
  ['camera', 'n. /\'kæmәrә/', 'n. 照相机, 摄影机, 密谈室, 暗箱；[计] 摄影', '基础', [], [], []],
  ['camp', 'n. vi. /kæmp/', 'n. 露营, 帐篷；vi. 露营, 扎营；vt. 使扎营', '基础', [], [], []],
  ['campaign', 'n. /kæm\'pein/', 'n. 战役, 运动, 竞选运动；vi. 参加运动, 作战', '基础', [], [], []],
  ['can', 'v. n. /kæn/', 'vt. 装罐；n. 罐头, 容器；aux. 能, 可以；[计] 作废字符', '基础', [], [], []],
  ['canal', 'n. /kә\'næl/', 'n. 运河, 水道, 管, 沟渠；vt. 开运河', '基础', [], [], []],
  ['cancel', 'vt. /\'kænsәl/', 'n. 取消, 撤消, 盖销(邮票)；vt. 取消, 删去, 抵销, 盖销；vi. 相互抵销；[计] 作废', '基础', [], [], []],
  ['cancer', 'n.', '癌', '基础', [], [], []],
  ['candidate', 'n. /\'kændideit/', 'n. 候选人, 投考者；[法] 候选, 候补者', '基础', [], [], []],
  ['candle', 'n. /\'kændl/', 'n. 蜡烛；vt. 对着光检查', '基础', [], [], []],
  ['candy', 'n. /\'kændi/', 'n. 糖果, 冰糖；vt. 用糖煮, 使结晶为砂糖；vi. 结晶为砂糖', '基础', [], [], []],
  ['canteen', 'n. /kæn\'ti:n/', 'n. 水壶, 军中俱乐部, 临时流动餐馆, 小卖部', '基础', [], [], []],
  ['cap', 'n. /kæp/', 'n. 盖子, 帽子；vt. 戴帽子, 覆盖, 胜过；vi. 脱帽致意；[计] 调用程序分析, 容量, 代码分析程序, 计算机辅助生产, 计算机辅助印刷', '基础', [], [], []],
  ['capable', 'adj.', '有能力的，能干的', '基础', [], [], []],
  ['capital', 'n. /\'kæpitәl/', 'n. 首都, 大写字母, 资本；a. 首都的, 重要的', '基础', [], [], []],
  ['capsule', 'n. /\'kæpsju:l/', 'n. 胶囊, 蒴果, 瓶帽, 航天舱；[化] 胶囊剂', '基础', [], [], []],
  ['captain', 'n. /\'kæptin/', 'n. 船长, 指挥官, 海军上校, 首领；vt. 率领, 指挥', '基础', [], [], []],
  ['caption', 'n. /\'kæpʃәn/', 'n. 说明, 字幕, 标题；vt. 加上标题, 加上说明；[计] 标题', '基础', [], [], []],
  ['car', 'n. /kɑ:/', 'n. 汽车, 客车；[机] 车', '基础', [], [], []],
  ['carbon', 'n. /\'kɑ:bәn/', 'n. 碳, 副本, 复写纸；[化] 碳', '基础', [], [], []],
  ['card', 'n. /kɑ:d/', 'n. 卡片, 纸牌, 节目单, 明信片, 梳棉机；vt. 备置卡片, 记于卡片上, 梳理；[计] 卡片, 卡', '基础', [], [], []],
  ['care', 'n. v. /kєә/', 'n. 小心, 照料, 忧虑；vi. 关心, 介意；vt. 在意, 喜欢', '基础', [], [], []],
  ['career', 'n.', '事业，生涯', '基础', [], [], []],
  ['careful', 'adj. /\'kєәful/', 'a. 小心的, 谨慎的', '基础', [], [], []],
  ['careless', 'adj. /\'kєәlis/', 'a. 粗心的, 不关心的, 无忧无虑的', '基础', [], [], []],
  ['carpenter', 'n. /\'kɑ:pintә/', '木工，木匠', '基础', [], [], []],
  ['carpet', 'n. /\'kɑ:pit/', 'n. 地毯, 地毯状物；vt. 铺以地毯, 铺盖', '基础', [], [], []],
  ['carriage', 'n. /\'kæridʒ/', 'n. 马车, 客车, 举止, 运输；[经] 搬运费, 运费', '基础', [], [], []],
  ['carrier', 'n. /\'kæriә/', '搬运者；媒介；（自行车等的）置物架；（车的）货架', '基础', [], [], []],
  ['carrot', 'n. /\'kærәt/', 'n. 胡萝卜；[医] 胡萝卜', '基础', [], [], []],
  ['carry', 'vt. /\'kæri/', 'n. 进位, 射程, 运载；vt. 携带, 运送, 支持, 传送, 包含；vi. 被携带, 能达到；[计] 进位; 进位数', '基础', [], [], []],
  ['cartoon', 'n. /kɑ:\'tu:n/', 'n. 卡通画, 漫画；v. 画漫画', '基础', [], [], []],
  ['carve', 'vt. /kɑ:v/', 'v. 雕刻, 切开', '基础', [], [], []],
  ['case', 'n. /keis/', 'n. 情形, 情况, 箱, 容器, 事实, 病例, 案例, 框子；vt. 装箱, 包盖', '基础', [], [], []],
  ['cash', 'n. v. /kæʃ/', 'n. 现金；vt. 兑现', '基础', [], [], []],
  ['cassette', 'n.', '磁带', '基础', [], [], []],
  ['cast', 'v. /kɑ:st. kæst/', 'n. 演员阵容, 投掷, 铸件, 预测, 特性；vt. 投, 掷, 抛, 脱落, 铸, 使弯曲, 计算；vi. 投, 计算, 浇铸成型', '基础', [], [], []],
  ['castle', 'n. /\'kæsl. \'kɑ:sl/', 'n. 城堡, 象棋中的车；vt. 置于城堡中, 盘踞于', '基础', [], [], []],
  ['casual', 'adj. /\'kæʒjuәl/', 'a. 偶然的, 不经意的, 便装的；n. 临时工, 待命士兵', '基础', [], [], []],
  ['cat', 'n. /kæt/', 'n. 猫, 恶妇；vi. 呕吐；计算机辅助教育, 计算机辅助测试, 计算机辅助翻译, 计算机辅助排版；[计] 计算机辅助教学, 计算机辅助翻译, 计算机辅助排字, 计算机辅助测试', '基础', [], [], []],
  ['catalogue', 'n. /\'kætәlɒg/', 'n. 目录, 大学情况一览；vt. 编入目录', '基础', [], [], []],
  ['catastrophe', 'n. /kә\'tæstrәfi/', 'n. 大灾难, 大祸；[化] 突变', '基础', [], [], []],
  ['catch', 'v. /kætʃ/', 'n. 捕捉, 陷阱, 捕捉之物, 抓, 拉手；vt. 捕捉, 赶上, 感染, 听清楚；vi. 抓住, 燃着', '基础', [], [], []],
  ['category', 'n. /\'kætigәri/', 'n. 种类, 类项；[计] 分类', '基础', [], [], []],
  ['cater', 'v. /\'keitә/', 'v. 提供饮食及服务, 投合, 迎合', '基础', [], [], []],
  ['catholic', 'adj. /\'kæθәlik/', 'n. 天主教徒；a. 天主教的, 普遍的, 广泛的, 宽宏大量的', '基础', [], [], []],
  ['cattle', 'n. /kætl/', 'n. 牛, 家畜；[法] 家畜', '基础', [], [], []],
  ['cause', 'n. vt. /kɒ:z/', 'n. 原因, 目标；vt. 引起, 使产生, 使遭受', '基础', [], [], []],
  ['caution', 'n. /\'kɒ:ʃәn/', 'n. 小心, 慎重, 警示；vt. 警告；[计] 警告', '基础', [], [], []],
  ['cautious', 'adj. /\'kɒ:ʃәs/', 'a. 谨慎的, 小心的', '基础', [], [], []],
  ['cave', 'n. /keiv/', 'n. 洞, 穴；vi. 凹陷, 塌落；vt. 挖洞, 使凹陷, 损坏...的基础', '基础', [], [], []],
  ['CD', 'n.', 'n. 镭射碟, 镭射唱片；[计] 光盘, 压缩盘, 载波检测, DOS内部命令:显示或改变当前目录', '基础', [], [], []],
  ['ceiling', 'n. /\'si:liŋ/', 'n. 天花板；[经] 顶点, 顶线, 上限', '基础', [], [], []],
  ['celebrate', 'v. /\'selibreit/', 'v. 庆祝, 祝贺, 举行', '基础', [], [], []],
  ['celebration', 'n. /.seli\'breiʃәn/', 'n. 庆祝, 庆典', '基础', [], [], []],
  ['cell', 'n. /sel/', '（监狱的）单人牢房；（修道院等的）单人小室；（蜂巢的）小蜂窝，蜂房；［生物］细胞', '基础', [], [], []],
  ['cent', 'n. /sent/', '美分（100cent=1dollar）', '基础', [], [], []],
  ['centigrade', 'adj. /\'sentigreid/', 'a. 百分度的, 摄氏的；[医] 百分度', '基础', [], [], []],
  ['centimetre', 'n. /\'senti,mi:tә(r)/', '公分，厘米（美 centimeter）', '基础', [], [], []],
  ['central', 'adj. /\'sentrәl/', 'a. 中央的, 重要的；[医] 中央的, 中心的, 中枢的', '基础', [], [], []],
  ['centre', 'n. /\'sentә/', 'n. 中心, 中心点, 中锋；a. 中央的, 位在正中的；vt. 集中, 定中心；vi. 居中', '基础', [], [], []],
  ['century', 'n. /\'sentʃuri/', 'n. 世纪, 百年', '基础', [], [], []],
  ['ceremony', 'n. /\'serimәni/', 'n. 典礼, 仪式, 礼节；[法] 典礼, 仪式', '基础', [], [], []],
  ['certain', 'adj. /\'sә:tәn/', 'a. 确定的, 某一个的, 必然的；[法] 确凿的, 无疑的, 可靠的', '基础', [], [], []],
  ['certificate', 'n. /sә\'tifikeit/', 'n. 证书, 证明书；vt. 发给证明书, 用证书批准, 用证书证明', '基础', [], [], []],
  ['chain', 'n. /tʃein/', 'n. 链, 枷锁, 束缚；vt. 用铁练锁住, 束缚, 囚禁', '基础', [], [], []],
  ['chair', 'n. /tʃєә/', 'n. 椅子, 显要的席位, 主席；vt. 使入座, 使就任要职', '基础', [], [], []],
  ['chairman', 'n. /\'tʃєәmәn/', '主席，会长；议长（复 chairmen）', '基础', [], [], []],
  ['chairwoman', 'n. /\'tʃєәwumәn/', '女主席，女会长；女议长', '基础', [], [], []],
  ['chalk', 'n. /tʃɒ:k/', 'n. 粉笔, 白垩；vt. 用粉笔写, 记录', '基础', [], [], []],
  ['challenge', 'n. v. /\'tʃælindʒ/', 'n. 挑战, 盘问；vt. 向...挑战, 要求, 怀疑；vi. 挑战, 对(证据等)表示异议', '基础', [], [], []],
  ['challenging', 'adj. /\'tʃælindʒiŋ/', 'a. 挑战的, 引起争论的', '基础', [], [], []],
  ['champion', 'n. /\'tʃæmpiәn/', 'n. 冠军, 拥护者, 战士；vt. 保卫, 拥护；a. 优胜的', '基础', [], [], []],
  ['chance', 'n. /tʃæns. tʃɑ:ns/', 'n. 机会, 意外, 可能性；vi. 偶然发生；vt. 冒险', '基础', [], [], []],
  ['change', 'n. v. /tʃeindʒ/', 'n. 变化, 找回的零钱, 找头, 更换；vt. 改变, 更换, 兑换', '基础', [], [], []],
  ['changeable', 'adj. /\'tʃeindʒәbl/', '易变的，变化无常的', '基础', [], [], []],
  ['channel', 'n. /\'tʃænәl/', 'n. 海峡, 航道, 频道；vt. 引导, 在...上挖沟, 形成河道；[计] 信道, 通道', '基础', [], [], []],
  ['chant', 'v. & n. /tʃænt. tʃɑ:nt/', 'n. 圣歌, 赞美诗；v. 吟唱, 诵扬', '基础', [], [], []],
  ['chaos', 'n. /\'keiɒs/', 'n. 大混乱, 混沌；[化] 混沌; 浑沌', '基础', [], [], []],
  ['chapter', 'n. /\'tʃæptә/', 'n. 章, 篇, 重要章节；[计] 章; 段', '基础', [], [], []],
  ['character', 'n. /\'kærәktә/', 'n. 个性, 字符, 人物, 性质, 品格, 资格；[计] 字符', '基础', [], [], []],
  ['characteristic', 'adj. /.kærәktә\'ristik/', 'n. 特性, 特征, 特色；a. 特性的, 特有的, 有特色的；[计] 阶; 指数', '基础', [], [], []],
  ['charge', 'v. n. /tʃɑ:dʒ/', 'n. 指控, 费用, 冲锋, 电荷, 炸药, 主管, 被托管人, 命令；vt. 控诉, 加罪于, 使充满, 使充电, 使承担；vi. 冲锋, 要价, 收费', '基础', [], [], []],
  ['chart', 'n. /tʃɑ:t/', 'n. 图表, 海图；vt. 制成图表；[计] 图表', '基础', [], [], []],
  ['chase', 'vt. & n.', '追逐，追捕，追踪；追寻，寻找', '基础', [], [], []],
  ['chat', 'n. & vi. /tʃæt/', 'n. 闲谈；vi. 闲谈, 聊天', '基础', [], [], []],
  ['cheap', 'adj. /tʃi:p/', 'a. 便宜的, 不值钱的, 可鄙的；adv. 便宜地', '基础', [], [], []],
  ['cheat', 'n. & v. /tʃi:t/', 'n. 欺骗, 作弊, 骗子；v. 欺骗, 逃脱, 骗取', '基础', [], [], []],
  ['check', 'n. vt. /tʃek/', 'n. 检查, 支票, 阻止物, 寄物牌, 象棋中将军；vt. 检查, 阻止, 核对, 寄存, 托运；vi. 逐项相符, 开支票；[计] 复选', '基础', [], [], []],
  ['cheek', 'n. /tʃi:k/', 'n. 颊, 厚颜, 脸蛋；[医] 颊', '基础', [], [], []],
  ['cheer', 'n. & vi. /tʃiә/', 'n. 愉快, 振奋, 欢呼；vi. 欢呼, 喝彩, 快活起来；vt. 使振奋, 欢呼', '基础', [], [], []],
  ['cheerful', 'adj. /\'tʃiәful/', 'a. 快活的, 高兴的, 兴高采烈的', '基础', [], [], []],
  ['cheers', 'int. /tʃiәz/', 'interj. 干杯, 再见', '基础', [], [], []],
  ['cheese', 'n. /tʃi:z/', 'n. 乳酪；[化] 干酪', '基础', [], [], []],
  ['chef', 'n. /ʃef/', '厨师长，主厨', '基础', [], [], []],
  ['chemical', 'adj. n. /\'kemikl/', 'n. 化学药品；a. 化学的, 化学上用的', '基础', [], [], []],
  ['chemist', 'n. /\'kemist/', 'n. 化学家, 药剂师；[化] 化学家; 化学师; 化学工作者; 药剂师; 药房', '基础', [], [], []],
  ['chemistry', 'n. /\'kemistri/', 'n. 化学, 化学过程；[化] 化学', '基础', [], [], []],
  ['cheque', 'n. /tʃek/', '支票（美 check）', '基础', [], [], []],
  ['chess', 'n. /tʃes/', 'n. 国际象棋；[建] 雀麦', '基础', [], [], []],
  ['chest', 'n. /tʃest/', 'n. 胸, 胸部, 衣柜, 箱子；[医] 胸, 胸廓', '基础', [], [], []],
  ['chew', 'vt. /tʃu:/', 'vt. 咀嚼, 嚼碎；vi. 咀嚼, 细想；n. 咀嚼, 咀嚼物', '基础', [], [], []],
  ['chicken', 'n. /\'tʃikin/', 'n. 小鸡, 鸡肉', '基础', [], [], []],
  ['chief', 'adj. n. /tʃi:f/', 'n. 领袖, 酋长, 长官, 主要部分；a. 主要的, 首位的', '基础', [], [], []],
  ['childhood', 'n. /\'tʃaildhud/', 'n. 孩童时期；[医] 儿童期', '基础', [], [], []],
  ['chocolate', 'n. /\'tʃɒkәlit/', 'n. 巧克力；a. 巧克力制的', '基础', [], [], []],
  ['choice', 'n. /tʃɒis/', 'n. 选择, 精选品, 选择权；a. 精选的, 挑三拣四的, 上等的；[计] DOS内部命令:在批处理文件中；该命令用于提示用户作出选择, 决定批处理文件的流程', '基础', [], [], []],
  ['choke', 'n. & v. /tʃәuk/', 'vt. 窒息, 阻塞, 噎, 抑制；vi. 窒息, 阻塞, 噎；n. 窒息, 噎, 阻气门', '基础', [], [], []],
  ['choose', 'vt. /tʃu:z/', 'vt. 选择, 宁愿, 欲；vi. 作出选择, 愿意；[计] 选取', '基础', [], [], []],
  ['chopsticks', 'n. /\'tʃɒpstiks/', 'n. 筷子', '基础', [], [], []],
  ['Christmas', 'n. /\'krismәs/', '圣诞节（12 月 25 日）', '基础', [], [], []],
  ['church', 'n. /tʃә:tʃ/', 'n. 教堂, 礼拜, 教会；vt. 使人接受宗教仪式；a. 教堂的', '基础', [], [], []],
  ['cigar', 'n. /si\'gɑ:/', 'n. 雪茄', '基础', [], [], []],
  ['cigarette', 'n. /.sigә\'ret/', 'n. 香烟, 纸烟', '基础', [], [], []],
  ['cinema', 'n. /\'sinәmә/', 'n. 电影院, 电影', '基础', [], [], []],
  ['circle', 'n. vt. /\'sә:kl/', 'n. 圆周, 社交圈, 循环, 范围；vt. 围着, 环绕；vi. 盘旋, 循环', '基础', [], [], []],
  ['circuit', 'n. /\'sә:kit/', 'n. 电路, 环(行)道, 巡回；[计] 线路; 电路', '基础', [], [], []],
  ['circumstance', 'n. /\'sә:kәmstәns/', 'n. 环境, 状况, 事件', '基础', [], [], []],
  ['circus', 'n. /\'sә:kәs/', 'n. 马戏团, 马戏, 竞技场', '基础', [], [], []],
  ['citizen', 'n. /\'sitizn/', 'n. 市民, 公民；[法] 公民, 国民, 市民', '基础', [], [], []],
  ['city', 'n. /\'siti/', 'n. 城市, 市；[法] 都市, 城市, 市', '基础', [], [], []],
  ['civil', 'adj. /\'sivәl/', 'a. 市民的, 公民的, 有礼貌的；[法] 公民的, 国民的, 民用的', '基础', [], [], []],
  ['civilian', 'n. /si\'viljәn/', 'n. 平民, 民法专家；a. 平民的, 百姓的, 民用的', '基础', [], [], []],
  ['civilization', 'n. /si.vilai\'zeiʃәn/', 'n. 文明, 教化；[法] 文明, 文化, 文明国家的总称', '基础', [], [], []],
  ['claim', 'v. n.', '声称，主张，要求，索取，夺取，认领 要求，要求权', '基础', [], [], []],
  ['clap', 'vi. /klæp/', 'n. 拍手, 拍手声, 霹雳声, 花柳病；v. 鼓掌, (使)啪地关上', '基础', [], [], []],
  ['clarify', 'v. /\'klærifai/', 'vi. 澄清, 阐明；vt. 使明晰', '基础', [], [], []],
  ['class', 'n. /klɑ:s/', 'n. 班级, 阶级, 种类, 课；vt. 分类；[计] 类别; 类; 种类; 类程', '基础', [], [], []],
  ['classic', 'adj. n. /\'klæsik/', 'n. 古典作品, 杰作, 大艺术家；a. 第一流的, 最优秀的, 古典的', '基础', [], [], []],
  ['classical', 'adj. /\'klæsikl/', 'a. 古典的, 正统派的, 经典的；[医] 古典的; 标准的, 典型的', '基础', [], [], []],
  ['classify', 'v. /\'klæsifai/', 'vt. 分类, 归类, 分等；[建] 分类, 分级, 分粒', '基础', [], [], []],
  ['classmate', 'n. /\'klɑ:smeit/', 'n. 同班同学', '基础', [], [], []],
  ['classroom', 'n. /\'klɑ:sru:m/', 'n. 教室', '基础', [], [], []],
  ['clause', 'n.', '（文件的）条款，款项；【语】从句', '基础', [], [], []],
  ['claw', 'n. /klɒ:/', 'n. 爪, 螯, 抓伤；v. 用爪抓, 挖, 搜刮', '基础', [], [], []],
  ['clay', 'n. /klei/', 'n. 泥土, 肉体, 黏土；[化] 粘土', '基础', [], [], []],
  ['clean', 'vt. adj. /kli:n/', 'a. 干净的, 清白的, 简洁的；adv. 清洁地, 完全地；vt. 清理, 使干净, 出空；vi. 被搞干净；n. 打扫', '基础', [], [], []],
  ['cleaner', 'n. /\'kli:nә/', 'n. 清洁工人, 清洁剂, 干洗商；[化] 滤清器; 除垢器; 洗净剂; 清洁剂', '基础', [], [], []],
  ['clear', 'adj. v. /kliә/', 'a. 清楚的, 明确的, 澄清的；adv. 清晰地；vt. 澄清, 清除障碍；vi. 放晴, 变清澈；n. 空隙；[计] 清除', '基础', [], [], []],
  ['clerk', 'n. /klә:k/', 'n. 办事员, 职员, 文书；vi. 当店员', '基础', [], [], []],
  ['clever', 'adj. /\'klevә/', 'a. 聪明的, 精明的', '基础', [], [], []],
  ['click', 'v. & n. /klik/', 'n. 咔哒声, 啪嗒声；vi. 作咔哒声；vt. 使发咔哒声；[计] 单击', '基础', [], [], []],
  ['client', 'n.', '委托人，（律师等的）当事人；顾客，客户', '基础', [], [], []],
  ['climate', 'n. /\'klaimit/', 'n. 气候, 社会趋势, 气候区；[医] 气候', '基础', [], [], []],
  ['climb', 'v. /klaim/', 'v. 攀登, 上升, 爬；n. 攀登, 爬升', '基础', [], [], []],
  ['clinic', 'n. /\'klinik/', 'n. 诊所, 临床教学；[医] 诊所(门诊部); 临床(讲解); 临床(学)科', '基础', [], [], []],
  ['clock', 'n. /klɒk/', 'n. 时钟, 计时器, (袜子上的)绣花边花；vt. 绣花样, 记时, 记录；vi. 记录时间；[计] 时钟', '基础', [], [], []],
  ['clone', 'n. /klәun/', '克隆（无性繁殖出来的有机体群）', '基础', [], [], []],
  ['close', 'adj. adv. vt. /klәuz/', 'n. 结束, 完结；a. 靠近的, 亲近的, 亲密的, 严密的, 关闭的, 狭窄的, 秘密的；vt. 关, 结束, 使靠近, 封闭, 使接近；vi. 关闭, 结束, 靠近；adv. 接近地, 紧密地；[计] 关闭', '基础', [], [], []],
  ['cloth', 'n. /klɒ:θ. klɒθ/', 'n. 布料, 织品, 布；[建] 布', '基础', [], [], []],
  ['clothes', 'n. /klәuðz/', '衣服；各种衣物', '基础', [], [], []],
  ['clothing', 'n. /\'klәuðiŋ/', '（总称）衣服', '基础', [], [], []],
  ['cloud', 'n. /klaud/', 'n. 云, 阴暗, 烟雾, 疑团；vt. 以云遮敝, 笼罩, 使黯然；vi. 乌云密布, 阴沉', '基础', [], [], []],
  ['cloudy', 'adj. /\'klaudi/', 'a. 多云的, 有愁容的, 云的, 浑浊的；[建] (混)浊的', '基础', [], [], []],
  ['club', 'n. /klʌb/', 'n. 俱乐部, 木棍, 球棒；vt. 用棍棒打, 缴纳；vi. 联合起来；a. 俱乐部的', '基础', [], [], []],
  ['clue', 'n.', '线索', '基础', [], [], []],
  ['clumsy', 'adj. /\'klʌmzi/', 'a. 笨拙的, 不雅观的, 粗陋的', '基础', [], [], []],
  ['coach', 'n. /kәutʃ/', 'n. 四轮大马车, 教练；vt. 训练, 指导；vi. 坐马车旅行, 作指导', '基础', [], [], []],
  ['coal', 'n. /kәul/', 'n. 煤, 木炭；v. 加煤', '基础', [], [], []],
  ['coast', 'n. /kәust/', 'n. 海岸, 滑坡；v. 沿海岸而行', '基础', [], [], []],
  ['coat', 'n. vt. /kәut/', 'n. 外套；vt. 外面覆盖, 给...穿外套', '基础', [], [], []],
  ['cocoa', 'n. /\'kәukәu/', 'n. 可可粉, 可可茶, 可可色；[医] 可可, 可可豆', '基础', [], [], []],
  ['code', 'n.', '代码，代号，密码，编码', '基础', [], [], []],
  ['coffee', 'n. /\'kɒfi/', 'n. 咖啡, 咖啡色；[医] 咖啡, 咖啡豆', '基础', [], [], []],
  ['coin', 'n. /kɒin/', 'n. 硬币, 金钱, 货币；vt. 铸币, 创造, 杜撰', '基础', [], [], []],
  ['coincidence', 'n. /kәu\'insidәns/', 'n. 巧合, 同时发生；[电] 符合计数器', '基础', [], [], []],
  ['coke', 'n. /kәuk/', 'n. 可口可乐, 焦炭；v. (使)成焦炭', '基础', [], [], []],
  ['cold', 'adj. n. /kәuld/', 'n. 感冒, 寒冷；a. 寒冷的, 冷淡的, 冷静的；adv. 完全地', '基础', [], [], []],
  ['collapse', 'v. & n.', '倒塌，崩溃', '基础', [], [], []],
  ['collar', 'n. /\'kɒlә/', 'n. 衣领, 颈圈；vt. 控制, 扭住衣领, 给...装上领子', '基础', [], [], []],
  ['colleague', 'n. /\'kɒli:g/', 'n. 同事, 同僚', '基础', [], [], []],
  ['collect', 'vt. /kә\'lekt/', 'v. 收集, 聚集, 集中, 搜集；a. 由收到者付款的；adv. 由收到者付款地', '基础', [], [], []],
  ['collection', 'n. /kә\'lekʃәn/', 'n. 收集, 采集, (一批)收藏品, 募捐；[医] 收集; 收集品, 标本', '基础', [], [], []],
  ['college', 'n. /\'kɒlidʒ/', 'n. 学院, 大学, 学会', '基础', [], [], []],
  ['colour', 'n. vt. /\'kʌlә/', 'n. 颜色, 面色, 颜料, 外貌；vt. 把...涂上颜色, 粉饰, 使脸红, 歪曲；vi. 变色', '基础', [], [], []],
  ['column', 'n.', '圆柱，柱状物；专栏；纵队', '基础', [], [], []],
  ['comb', 'n. v. /kәum/', 'n. 头梳, 鸡冠；vt. 梳头发, 梳毛；vi. (浪)涌起', '基础', [], [], []],
  ['combination', 'n.', '结合，联合，合并；化合，化合物', '基础', [], [], []],
  ['combine', 'vt. /kәm\'bain/', 'v. (使)联合, (使)结合；n. (企业的)联合, 联合收割机', '基础', [], [], []],
  ['come', 'vi. /kʌm/', 'vi. 过来, 来, 到达, 出现, 开始；interj. 喂', '基础', [], [], []],
  ['comedy', 'n. /\'kɒmidi/', 'n. 喜剧, 有趣的事情', '基础', [], [], []],
  ['comfort', 'n. vt. /\'kʌmfәt/', 'n. 舒适, 安慰, 安慰者；vt. 安慰', '基础', [], [], []],
  ['comfortable', 'adj. /\'kʌmfәtәbl/', 'a. 舒服的, 轻松的；n. 盖被', '基础', [], [], []],
  ['command', 'n. & v. /kә\'mɑ:nd/', 'n. 命令, 指挥, 控制, 部队, 司令部；v. 命令, 指挥, 控制；[计] 命令; 指令; DOS外部命令:启动新的命令处理器', '基础', [], [], []],
  ['comment', 'n. & v. /\'kɒment/', 'n. 注解, 批评, 评论, 备注；vi. 评论, 注解；[计] 备注', '基础', [], [], []],
  ['commercial', 'adj.', '贸易的，商业的', '基础', [], [], []],
  ['commission', 'n.', '委任，委托，代办（权），代理（权），犯（罪），佣金', '基础', [], [], []],
  ['commit', 'v. /kә\'mit/', 'vt. 委托(托付), 犯罪, 指派...作战, 使承担义务；[法] 犯, 做, 把...交托给', '基础', [], [], []],
  ['commitment', 'n. /kә\'mitmәnt/', 'n. 委托, 交押, 承担义务, 赞助；[医] 院禁', '基础', [], [], []],
  ['committee', 'n. /kә\'miti/', 'n. 委员会；[经] 委员会', '基础', [], [], []],
  ['common', 'adj. /\'kɒmәn/', 'a. 通常的, 共同的, 通俗的, 公共的；[计] 公用块', '基础', [], [], []],
  ['communicate', 'v. /kә\'mju:nikeit/', 'vt. 显露, 传达, 感染；vi. 通讯', '基础', [], [], []],
  ['communication', 'n. /kә.mju:ni\'keiʃәn/', 'n. 交流, 交通, 通讯；[计] 通信', '基础', [], [], []],
  ['communism', 'n. /\'kɒmjunizm/', 'n. 共产主义', '基础', [], [], []],
  ['communist', 'n. adj. /\'kɒmjunist/', 'n. 共产主义者, 共产党员；[法] 共产主义的, 共产党的', '基础', [], [], []],
  ['community', 'n.', '公社，团体，社会，（政治）共同体，共有，一致，（生物）群落', '基础', [], [], []],
  ['companion', 'n. /kәm\'pænjәn/', 'n. 朋友, 陪伴, 指南, 升降口围罩；vt. 陪伴', '基础', [], [], []],
  ['company', 'n. /\'kʌmpәni/', 'n. 公司, 友伴, 交往, 连队, 朋友, 一群；vt. 陪伴；vi. 交往', '基础', [], [], []],
  ['compare', 'vt. /kәm\'pєә/', 'vt. 比较, 比喻, 对照；vi. 相比；n. 比较；[计] 比较', '基础', [], [], []],
  ['compensate', 'v. /\'kɒmpenseit/', 'v. 偿还, 补偿, 付报酬', '基础', [], [], []],
  ['compete', 'vi. /kәm\'pi:t/', 'vi. 竞争, 对抗', '基础', [], [], []],
  ['competence', 'n. /\'kɒmpitәns/', 'n. 胜任, 职称, 能力；[医] 能力, 活性', '基础', [], [], []],
  ['competition', 'n. /.kɒmpi\'tiʃәn/', 'n. 竞争, 竞赛；[经] 竞争, 竞销, 比赛', '基础', [], [], []],
  ['complain', 'v.', '抱怨，悲叹，控诉', '基础', [], [], []],
  ['complete', 'adj. vt. /kәm\'pli:t/', 'a. 完全的, 十足的, 完成的；vt. 完成, 完工, 使圆满', '基础', [], [], []],
  ['complex', 'adj. & n. /kәm\'pleks/', 'n. 综合体, 情结, 络合物；a. 复杂的, 组合的', '基础', [], [], []],
  ['complicated', 'adj.', '复杂的，难解的', '基础', [], [], []],
  ['component', 'n. /kәm\'pәunәnt/', 'n. 元件, 组件, 成分；a. 组成的, 构成的；[计] 组件', '基础', [], [], []],
  ['composition', 'n. /kɒmpә\'ziʃәn/', 'n. 作文, 创作, 组成；[化] 成分; 组成', '基础', [], [], []],
  ['comprehension', 'n. /.kɒmpri\'henʃәn/', 'n. 理解, 包含', '基础', [], [], []],
  ['compulsory', 'adj. /kәm\'pʌlsәri/', 'a. 被强制的, 强迫的, 义务的；[经] 强迫的, 强制的', '基础', [], [], []],
  ['computer', 'n. /kәm\'pju:tә/', 'n. 电脑, 电子计算机；[计] 计算机', '基础', [], [], []],
  ['concentrate', 'v. /\'kɒnsәntreit/', 'n. 浓缩, 精选；v. 集中, 专心', '基础', [], [], []],
  ['concept', 'n. /\'kɒnsept/', 'n. 观念, 概念；[医] 概念', '基础', [], [], []],
  ['concern', 'v. & n. /kәn\'sә:n/', 'n. 关心, 忧虑；vt. 与...有关, 使担心, 使挂念', '基础', [], [], []],
  ['concerned', 'adj.', '关心的，有关的', '基础', [], [], []],
  ['concert', 'n. /\'kɒnsәt/', 'n. 音乐会, 和声, 一致；vt. 协力, 协调；vi. 协力；[计] 美国北卡罗来纳州Internet网', '基础', [], [], []],
  ['conclude', 'v. /kәn\'klu:d/', 'vt. 结束, 作结论, 推断；vi. 结束, 推断', '基础', [], [], []],
  ['conclusion', 'n. /kәn\'klu:ʒәn/', 'n. 结论, 结尾, 推论；[法] 缔结, 结论, 推论', '基础', [], [], []],
  ['concrete', 'adj. n. /\'kɒnkri:t/', 'n. 凝结物, 混凝土；a. 具体的, 实在的, 混凝土的；v. (使)凝结, 用混凝土浇筑', '基础', [], [], []],
  ['condition', 'n. /kәn\'diʃәn/', 'n. 情况, 条件；vt. 使健康, 以...为条件, 决定, 使适应；[计] 条件', '基础', [], [], []],
  ['conduct', 'vt. /\'kɔndʌkt, -dәkt/', 'n. 行为, 举动, 指导；vt. 为人, 指挥, 管理, 实施；vi. 领导, 传导, 指挥', '基础', [], [], []],
  ['conductor', 'n. /kәn\'dʌktә/', 'n. 领导者, 指挥者, 售票员, 向导；[化] 导体', '基础', [], [], []],
  ['conference', 'n. /\'kɒnfәrәns/', 'n. 会议；[经] 会议, 讨论会, 协商会', '基础', [], [], []],
  ['confident', 'adj. /\'kɒnfidәnt/', 'a. 有信心的, 有把握的', '基础', [], [], []],
  ['confidential', 'adj. /.kɒnfi\'denʃәl/', 'a. 机密的, 获他人信赖的, 易于信任他人的；[经] 秘密件', '基础', [], [], []],
  ['confirm', 'v. /kәn\'fә:m/', 'vt. 证实, 确定, 批准, 使巩固；[计] 确认', '基础', [], [], []],
  ['conflict', 'n. & v. /\'kɒnflikt/', 'n. 战斗, 冲突, 矛盾, 争执；vi. 争执, 战斗, 冲突, 抵触；[计] 冲突', '基础', [], [], []],
  ['confuse', 'v. /kәn\'fju:z/', 'vt. 使混乱, 使狼狈, 使困惑；[法] 混淆', '基础', [], [], []],
  ['congratulate', 'vt. /kәn\'grætʃәleit/', 'vt. 祝贺, 庆贺', '基础', [], [], []],
  ['congratulation', 'n. /kәn.grætʃә\'leiʃәn/', 'n. 祝贺, 恭喜', '基础', [], [], []],
  ['connect', 'v. /kә\'nekt/', 'v. 连接, 联合, 联系', '基础', [], [], []],
  ['connection', 'n. /kә\'nekʃәn/', 'n. 连接, 关系, 前后关系；[计] 连接', '基础', [], [], []],
  ['conscience', 'n. /\'kɒnʃәns/', 'n. 良心；[法] 良心, 道德感, 正义感', '基础', [], [], []],
  ['conscious', 'adj.', '有意识的，有知觉的', '基础', [], [], []],
  ['consequence', 'n. /\'kɒnsikwәns/', 'n. 结果, 重要性；[法] 结果, 后果, 推断', '基础', [], [], []],
  ['conservation', 'n. /.kɒnsә\'veiʃәn/', 'n. 保护, 保存；[医] 保存', '基础', [], [], []],
  ['conservative', 'adj. n.', '保守的，守旧的；保守主义的；谨慎的 保守的人，保守主义', '基础', [], [], []],
  ['consider', 'vt. /kәn\'sidŋ/', 'v. 考虑, 思考, 认为', '基础', [], [], []],
  ['considerable', 'adj.', '相当大（或多）的，值得考虑的，相当可观的', '基础', [], [], []],
  ['considerate', 'adj. /kәn\'sidәrit/', 'a. 体贴的, 体谅的, 考虑周到的', '基础', [], [], []],
  ['consideration', 'n. /kәn.sidә\'reiʃәn/', 'n. 考虑, 原因；[法] 考虑, 思考, 报酬', '基础', [], [], []],
  ['consist', 'v. /kәn\'sist/', 'vi. 组成, 存在于, 一致', '基础', [], [], []],
  ['consistent', 'adj. /kәn\'sistәnt/', 'a. 一致的, 坚持的, 并立的, 坚固的', '基础', [], [], []],
  ['constant', 'adj. /\'kɒnstәnt/', 'n. 常数, 恒量；a. 不变的, 一定的, 时常的；[计] 常量; 常数; 恒值', '基础', [], [], []],
  ['constitution', 'n. /.kɒnsti\'tju:ʃәn/', 'n. 构成, 宪法, 体格；[医] 体质; 结构, 组织', '基础', [], [], []],
  ['construct', 'v. /kәn\'strʌkt/', 'vt. 构造, 建造, 对...进行构思, 作图；n. 构成物', '基础', [], [], []],
  ['construction', 'n. /kәn\'strʌkʃәn/', 'n. 建筑, 构造, 建筑物；[化] 施工', '基础', [], [], []],
  ['consult', 'v. /kәn\'sʌlt/', 'vi. 商讨, 商量, 协商, 会诊；vt. 向...请教, 查阅, 考虑', '基础', [], [], []],
  ['consultant', 'n. /kәn\'sʌltәnt/', 'n. 顾问, 征询意见者；[医] 顾问医师', '基础', [], [], []],
  ['consume', 'v. /kәn\'sju:m/', 'vt. 消耗, 消费, 消灭；vi. 耗尽, 毁灭', '基础', [], [], []],
  ['contact', 'n. & v.', '接触，联系', '基础', [], [], []],
  ['contain', 'v. /kәn\'tein/', 'vt. 包含, 容纳, 控制；vi. 自制', '基础', [], [], []],
  ['container', 'n. /kәn\'teinә/', 'n. 容器, 集装箱；[化] 集装箱; 贮存箱; 容器(任何一种)', '基础', [], [], []],
  ['contemporary', 'adj. /kәn\'tempәrәri/', 'n. 同时代的人；a. 同时代的, 属于同一时期的', '基础', [], [], []],
  ['content', 'adj. n. /kәn\'tent/', 'n. 内容, 满足, 意义, 要旨；a. 满足的, 满意的；vt. 使...满足, 使...安心；[计] 内容', '基础', [], [], []],
  ['continent', 'n. /\'kɒntinәnt/', 'n. 大陆, 洲；a. 自制的', '基础', [], [], []],
  ['continue', 'vi. /kәn\'tinju:/', 'vi. 继续, 延续, 延长；vt. 使继续, 使延长', '基础', [], [], []],
  ['contract', 'n.', '合同，契约，婚约', '基础', [], [], []],
  ['contradict', 'v. /.kɒntrә\'dikt/', 'vt. 反驳, 与...抵触, 与...矛盾；vi. 反驳', '基础', [], [], []],
  ['contradictory', 'adj. /.kɒntrә\'diktәri/', 'a. 反驳的, 反对的, 抗辩的；n. 矛盾因素, 对立物', '基础', [], [], []],
  ['contrary', 'n. adj. /\'kɒntrәri/', 'a. 相反的, 矛盾的, 对立的；n. 相反, 对立面；adv. 相反地', '基础', [], [], []],
  ['contribute', 'v. /kәn\'tribju:t/', 'vt. 有助于, 捐助, 投稿；vi. 出力, 捐献, 投稿', '基础', [], [], []],
  ['contribution', 'n. /.kɒntri\'bju:ʃәn/', 'n. 捐助, 捐助之物, 贡献；[经] 贡献, 捐款, 补助品', '基础', [], [], []],
  ['control', 'vt. & n. /kәn\'trәul/', 'n. 控制, 管理, 克制, 控制器, 操纵装置；vt. 控制, 操纵, 抑制；[计] 控制; 控制器', '基础', [], [], []],
  ['convenience', 'n. /kә\'vi:njәns/', 'n. 方便, 便利的事物, 方便的时候', '基础', [], [], []],
  ['convenient', 'adj. /kәn\'vi:njәnt/', 'a. 方便的, 合宜的；[法] 适当的, 合理而可行的, 方便的', '基础', [], [], []],
  ['conventional', 'adj. /kәn\'venʃәnl/', 'a. 传统的, 习惯的, 约定的；[经] 惯例的, 常规的, 传统的', '基础', [], [], []],
  ['conversation', 'n. /.kɒnvә\'seiʃәn/', 'n. 会话, 说话, 交谈；[法] 交谈, 社交, 性交', '基础', [], [], []],
  ['convey', 'v. /kәn\'vei/', 'vt. 传达, 运输, 转让；[经] 转让(财产等), 搬运', '基础', [], [], []],
  ['convince', 'v. /kәn\'vins/', 'vt. 说服, 使相信；[法] 使确信, 使信服, 使人认识错误', '基础', [], [], []],
  ['cook', 'n. v. /kuk/', 'n. 厨子, 厨师；vt. 烹调, 煮饭, 加热；vi. 在煮着', '基础', [], [], []],
  ['cooker', 'n. /\'kukә/', 'n. 炊事用具, 炉灶, 锅, 炊具, 烹饪用水果, 窜改者, 伪造者；[化] 蒸锅', '基础', [], [], []],
  ['cookie', 'n. /\'kuki/', 'n. 饼干, 小甜点；[建] 糕点', '基础', [], [], []],
  ['cool', 'adj. /ku:l/', 'n. 凉爽, 凉爽的空气；a. 凉爽的, 冷淡的, 冷静的；vi. 冷却, 平息；vt. 使冷却, 使平静', '基础', [], [], []],
  ['cooperation', 'n.', '合作，协作', '基础', [], [], []],
  ['cope', 'v.', '（善于）应付，（善于）处理', '基础', [], [], []],
  ['copy', 'n. v. /\'kɒpi/', 'n. 副本, 摹仿, 一册；v. 复印, 抄袭, 复制；[计] 副本; 复制; DOS内部命令:复制文件；将几个文件合并成一个文件, 以及将文件传至外设或在设备之间传送', '基础', [], [], []],
  ['corn', 'n. /kɒ:n/', 'n. 玉蜀黍, 谷类, 谷粒, 鸡眼；vt. 使成颗粒, 腌', '基础', [], [], []],
  ['corner', 'n. /\'kɒ:nә/', 'n. 角落, 转角, 窘境；vt. 迫至一隅, 垄断, 使陷入绝境；vi. 相交成角, 垄断；[计] 边角', '基础', [], [], []],
  ['corporation', 'n. /.kɒ:pә\'reiʃәn/', 'n. 公司, 合作, 法人团体；[法] 法人团体, 社团, 法人', '基础', [], [], []],
  ['correct', 'v. adj. /kә\'rekt/', 'a. 正确的, 合适的；vt. 改正, 订正', '基础', [], [], []],
  ['correction', 'n. /kә\'rekʃәn/', 'n. 订正, 改正, 改正的地方；[化] 校正', '基础', [], [], []],
  ['correspond', 'vi. /.kɒri\'spɒnd/', 'vi. 符合, 通信, 相当；[法] 符合, 一致, 相当', '基础', [], [], []],
  ['corrupt', 'adj. v. /kә\'rʌpt/', 'a. 腐败的, 贪污的, 讹误充斥的；vt. 使腐烂, 腐蚀, 使恶化；vi. 腐烂, 堕落', '基础', [], [], []],
  ['cost', 'v. n. /kɒst/', 'n. 代价, 价值, 费用；vi. 花费；vt. 使失去, 值, 使花费', '基础', [], [], []],
  ['cottage', 'n. /\'kɒtidʒ/', '（郊外）小屋，村舍，别墅', '基础', [], [], []],
  ['cotton', 'n. adj. /\'kɒtn/', 'n. 棉花；vi. 和谐, 有好感, 理解', '基础', [], [], []],
  ['cough', 'n. & vi. /kɒf/', 'n. 咳嗽；vi. 咳嗽；vt. 咳出', '基础', [], [], []],
  ['could', 'v.', '（can 的过去式）可以…；（表示许可或请求）可以…，行', '基础', [], [], []],
  ['council', 'n.', '政务会，理事会，委员会，参议会', '基础', [], [], []],
  ['count', 'vt. /kaunt/', 'vt. 计算, 视为；vi. 计数；n. 计算, 合计, 计数, 伯爵；[计] 计数', '基础', [], [], []],
  ['counter', 'n. /\'kauntә/', 'n. 计算器, 计算者, 柜台, 筹码；a. 反方向的, 相反的；adv. 反方向地, 相反地；[计] 计数器; 计数字', '基础', [], [], []],
  ['country', 'n. /\'kʌntri/', 'n. 国家, 乡村, 地区, 故乡；a. 乡下的, 农村的；[计] DOS外部命令:用于设定国家代码, 包括日期时间及货币格式', '基础', [], [], []],
  ['countryside', 'n. /\'kʌntrisaid/', 'n. 乡下地方, 乡下居民', '基础', [], [], []],
  ['county', 'n.', '县，郡', '基础', [], [], []],
  ['couple', 'n. /\'kʌpl/', 'n. 对, 夫妇, 数个；vt. 使成双, 连接, 使成婚, 把...联系起来；vi. 结合, 成婚', '基础', [], [], []],
  ['courage', 'n. /\'kʌridʒ/', 'n. 勇气, 胆量', '基础', [], [], []],
  ['course', 'n. /kɒ:s/', 'n. 课程, 路线, 过程, 一道菜, 道路；v. 追, (使)跑', '基础', [], [], []],
  ['court', 'n. /kɒ:t/', 'n. 法院, 庭院, 奉承；vt. 献殷勤, 追求, 招致；vi. 求爱', '基础', [], [], []],
  ['courtyard', 'n. /\'kɒ:tjɑ:d/', 'n. 庭院, 天井', '基础', [], [], []],
  ['cousin', 'n. /\'kʌzәn/', 'n. 堂兄弟姊妹, 表兄弟姊妹；[法] 同辈表亲或堂亲', '基础', [], [], []],
  ['cover', 'n. v. /\'kʌvә/', 'n. 盖子, 封面, 藉口；vt. 覆盖, 掩饰, 保护, 掩护, 包括；vi. 覆盖', '基础', [], [], []],
  ['cow', 'n. /kau/', 'n. 母牛, 母兽；vt. 威胁', '基础', [], [], []],
  ['crack', 'v.', '（使）破裂，裂纹，（使）爆裂', '基础', [], [], []],
  ['crash', 'v. & n. /kræʃ/', 'n. 哗啦声, 猛撞, 崩溃, 粗布；v. 撞碎, 破碎, (使)...坠毁；a. 速成的；[计] 崩溃', '基础', [], [], []],
  ['crayon', 'n. /\'kreiәn/', 'n. 蜡笔, 蜡笔画；vt. 以蜡笔作画', '基础', [], [], []],
  ['crazy', 'adj. /\'kreizi/', 'a. 发狂的, 狂热的', '基础', [], [], []],
  ['cream', 'n. /kri:m/', 'n. 乳酪, 奶油, 面霜；[医] 乳油, 乳皮; 乳膏, 霜', '基础', [], [], []],
  ['create', 'vt. /kri:\'eit/', 'vt. 创造, 建造, 引起, 任命', '基础', [], [], []],
  ['creature', 'n. /\'kri:tʃә/', 'n. 人, 动物, 创造物, 生物', '基础', [], [], []],
  ['credit', 'n. /\'kredit/', 'n. 信用, 信任, 荣誉, 贷款, 学分；vt. 归功于, 赞颂, 信任, 相信；[计] 信用量', '基础', [], [], []],
  ['crew', 'n. /kru:/', 'n. 全体人员, 一群人, 全体队员；crow的过去式', '基础', [], [], []],
  ['crime', 'n. /kraim/', 'n. 犯罪, 罪行, 罪恶；[法] 犯罪, 罪, 罪恶', '基础', [], [], []],
  ['criminal', 'n. /\'kriminәl/', 'n. 罪犯, 犯人, 刑事；a. 犯了罪的, 刑事的, 有罪的', '基础', [], [], []],
  ['crisis', 'n.', '危机，危险期，历史上的紧要关头，决定性时刻', '基础', [], [], []],
  ['critic', 'n.', '批评家，评论家，吹毛求疵者', '基础', [], [], []],
  ['critical', 'adj.', '评论的，鉴定的，批评的，危急的，临界的', '基础', [], [], []],
  ['criticism', 'n.', '批评，批判', '基础', [], [], []],
  ['criticize', 'v.', '批评，责备', '基础', [], [], []],
  ['crop', 'n. /krɒp/', 'n. 农作物, 产量, 平头；vt. 收割, 修剪, 种植；vi. 收获；[计] 裁剪', '基础', [], [], []],
  ['cross', 'adj. n. vt. /krɒs/', 'n. 十字架, 十字架形物件, 交叉, 十字标, 交叉路, 磨难, 杂交；a. 生气的, 交叉的, 相反的；v. 交叉, 横过, 越过；[计] 交叉, 十字标', '基础', [], [], []],
  ['crossing', 'n. /\'krɒsiŋ/', 'n. 横越, 横渡, 交叉点, 渡口；[经] 划线', '基础', [], [], []],
  ['crossroads', 'n.', 'n. 十字路口, 交叉路口, 聚会的中心地点, (喻)需作抉择的重要关头, 紧要关头', '基础', [], [], []],
  ['crowd', 'n. vt. /kraud/', 'n. 群众, 一伙人；vt. 拥挤, 挤满, 挤进', '基础', [], [], []],
  ['cruel', 'adj. /\'kru:әl/', 'a. 残酷的, 令人极痛苦的；[法] 残忍的, 残酷的', '基础', [], [], []],
  ['cry', 'n. v. /krai/', 'n. 叫声, 哭声, 大叫；vi. 哭, 叫, 喊；vt. 叫喊, 大声说, 哭出', '基础', [], [], []],
  ['cube', 'n. /kju:b/', 'n. 立方体, 立方；[机] 立方体, 立方', '基础', [], [], []],
  ['cubic', 'adj. /\'kju:bik/', 'a. 立方体的, 立方的；[机] 立方的, 立方体的', '基础', [], [], []],
  ['cuisine', 'n. /kwi:\'zi:n/', 'n. 烹调风格, 烹调法, 烹饪, 厨房', '基础', [], [], []],
  ['culture', 'n. /\'kʌltʃә/', 'n. 文化, 修养, 耕种；vt. 耕种, 培养', '基础', [], [], []],
  ['cup', 'n. /kʌp/', 'n. 杯子, 茶杯, 优胜杯；vt. 使成杯状, 为...拔火罐', '基础', [], [], []],
  ['cupboard', 'n. /\'kʌpbɒ:d/', 'n. 食橱, 碗柜, 餐具柜', '基础', [], [], []],
  ['cure', 'n. & vt. /kjuә/', 'n. 治疗, 治愈, 治疗法；vt. 治疗, 治愈, 改正, 腌制, 加工处理, 使硫化；vi. 受治疗, 被加工处理, 被硫化', '基础', [], [], []],
  ['curious', 'adj. /\'kjuәriәs/', 'a. 好奇的, 求知的, 古怪的', '基础', [], [], []],
  ['currency', 'n. /\'kʌrәnsi/', 'n. 货币, 通货, 流通, 通用；[计] 货币, 货币型', '基础', [], [], []],
  ['curriculum', 'n. /kә\'rikjulәm/', 'n. 课程；[医] 课程, 学程', '基础', [], [], []],
  ['curtain', 'n. /\'kә:tәn/', 'n. 帐, 幕, 窗帘；vt. 装帘子于, 遮蔽', '基础', [], [], []],
  ['custom', 'n. /\'kʌstәm/', 'n. 习惯, 风俗, 海关, 自定义；a. 定制的；[计] 定制; 自定义', '基础', [], [], []],
  ['customer', 'n. /\'kʌstәmә/', 'n. 消费者；[化] 顾客', '基础', [], [], []],
  ['customs', 'n.', 'n. 海关, 关卡, 关税；[经] 关税, 海关', '基础', [], [], []],
  ['cut', 'v. & n. /kʌt/', 'n. 切口, 割伤, 降低, 切, 割, 砍, 削, 伤口, 削减, 缩短, 删节, 通路；a. 经切割的, 缩减的；vt. 切, 割, 减少, 刺痛, 开辟, 雕刻, 删节, 缩短, 停止, 排斥, 切断, 关, 显出；vi. 切, 割, 砍, 刺痛, 相交, 抄近路, 剪辑；[计] 剪切', '基础', [], [], []],
  ['cute', 'adj.', '漂亮的，可爱的；小巧玲珑的', '基础', [], [], []],
  ['cycle', 'n. vi. /\'saikl/', 'n. 周期, 循环, 自行车, 一段时间, 整套；vi. 循环, 轮转, 骑自行车；vt. 使循环, 使轮转；[计] 环路; 周期; 循环', '基础', [], [], []],
  ['cyclist', 'n. /\'saiklist/', 'n. 骑脚踏车的人', '基础', [], [], []],
  ['dad', 'n.', '（口）爸爸，爹爹', '基础', [], [], []],
  ['daily', 'adj. adv. n. /\'deili/', 'a. 每日的, 日常的；adv. 每日地, 日常地；n. 日报', '基础', [], [], []],
  ['dam', 'n. /dæm/', 'n. 水坝, 障碍；v. 控制, 筑坝；[计] 直接存取法', '基础', [], [], []],
  ['damage', 'n. & vt. /\'dæmidʒ/', 'n. 损害, 伤害；v. 损害', '基础', [], [], []],
  ['damp', 'adj. & n. /dæmp/', 'n. 潮湿, 湿气；a. 潮湿的；vt. 使潮湿, 使阻尼, 抑止；vi. 变潮湿, 衰减', '基础', [], [], []],
  ['dance', 'n. & vi. /dæns. dɑ:ns/', 'n. 跳舞, 舞蹈, 舞会；v. 跳舞', '基础', [], [], []],
  ['danger', 'n. /\'deindʒә/', 'n. 危险, 威胁；[法] 危险, 危险物, 危机', '基础', [], [], []],
  ['dangerous', 'adj. /\'deindʒәrәs/', 'a. 危险的；[法] 危险的, 危害的', '基础', [], [], []],
  ['dare', 'v. & aux. /dєә/', '（后接不带 to 的不定式；主要用于疑问，否定或条件句）敢，敢于', '基础', [], [], []],
  ['dark', 'n. adj. /dɑ:k/', 'n. 黑暗, 夜, 黄昏, 模糊；a. 黑暗的, 暗的, 深色的, 隐密的, 模糊的, 无知的', '基础', [], [], []],
  ['darkness', 'n. /\'dɑ:knis/', 'n. 黑暗, 暗, 深色, 隐密, 模糊, 无知', '基础', [], [], []],
  ['darling', 'n. adj.', '亲爱的，心爱的人 可爱的', '基础', [], [], []],
  ['dash', 'v. & n. /dæʃ/', 'n. 冲撞, 破折号, 短跑；vi. 猛冲, 冲撞；vt. 泼溅, 使猛撞, 搀和, 使破灭, 使沮丧', '基础', [], [], []],
  ['data', 'n. /\'deitә/', 'pl. 资料, 数据；[计] 数据; DOS内部命令:用于显示或设定系统的日期', '基础', [], [], []],
  ['database', 'n. /\'deitәbeis/', 'n. 数据库；[计] 数据库', '基础', [], [], []],
  ['date', 'n. /deit/', 'n. 日期, 约会, 枣椰树；vt. 约会, 定日期；vi. 注明日期, 过时', '基础', [], [], []],
  ['daughter', 'n. /\'dɒ:tә/', 'n. 女儿；a. 女儿的', '基础', [], [], []],
  ['dawn', 'n. /dɒ:n/', 'n. 破晓, 黎明；vi. 破晓', '基础', [], [], []],
  ['day', 'n. /dei/', 'n. 天, 日子, 白天, 工作日；[医] 日(一昼夜), 昼, 白天', '基础', [], [], []],
  ['dead', 'adj. /ded/', 'a. 死的, 不活泼的, 麻木的, 熄灭的；n. 死者；adv. 完全地, 直接地', '基础', [], [], []],
  ['deadline', 'n. /\'dedlain/', 'n. 最后期限, 截止期限；[经] 截止日期', '基础', [], [], []],
  ['deaf', 'adj. /def/', 'a. 聋的；[医] 聋的', '基础', [], [], []],
  ['deal', 'n. /di:l/', 'n. 交易, 协定, 数量, 买卖, 松木板；vi. 处理, 应付, 做生意；vt. 分配, 发牌, 给予；[计] 发牌', '基础', [], [], []],
  ['dear', 'int. adj. /\'diә/', 'n. 亲爱的人；a. 亲爱的, 昂贵的, 严重的, 急迫的；interj. 啊；adv. 深爱地, 高价地', '基础', [], [], []],
  ['death', 'n. /deθ/', 'n. 死亡；[医] 死亡', '基础', [], [], []],
  ['debate', 'n. & v. /di\'beit/', 'n. 辩论, 讨论；v. 争论, 辩论', '基础', [], [], []],
  ['debt', 'n. /det/', 'n. 债务, 罪过；[经] 借款, 欠款, 债务', '基础', [], [], []],
  ['decade', 'n. /\'dekeid/', 'n. 十年, 十', '基础', [], [], []],
  ['decide', 'v. /di\'said/', 'v. 决定, 判决', '基础', [], [], []],
  ['decision', 'n. /di\'siʒәn/', 'n. 决定, 决心, 决断；[计] 判定', '基础', [], [], []],
  ['declare', 'vt. /di\'klєә/', 'v. 宣布, 声明, 申报, 断言', '基础', [], [], []],
  ['decline', 'v. /di\'klain/', 'n. 衰退, 跌落, 下降；vt. 使降低, 婉谢；vi. 下降, 衰落, 偏斜', '基础', [], [], []],
  ['decorate', 'vt. /\'dekәreit/', '装饰…，修饰…', '基础', [], [], []],
  ['decoration', 'n. /.dekә\'reiʃәn/', 'n. 装饰, 装饰品', '基础', [], [], []],
  ['decrease', 'v. /\'di:kri:s/', 'n. 减少, 减少量；v. 减少', '基础', [], [], []],
  ['deed', 'n. /di:d/', 'n. 行为, 实行, 契约；vt. 立契转让', '基础', [], [], []],
  ['deep', 'adj. adv. /di:p/', 'a. 深的；adv. 深入地；n. 深渊, 深处', '基础', [], [], []],
  ['deer', 'n. /diә/', 'n. 鹿', '基础', [], [], []],
  ['defeat', 'vt. /di\'fi:t/', 'n. 败北, 失败；vt. 击败, 使落空', '基础', [], [], []],
  ['defence', 'n. & v. /di\'fens/', 'n. 防卫, 防卫设备；[经] (诉讼程序中的)辩护', '基础', [], [], []],
  ['defend', 'vt. /di\'fend/', 'vt. 防护, 辩护, 防卫；[法] 作...的辩护律师, 辩护, 为...答辩', '基础', [], [], []],
  ['define', 'vt.', '给…下定义，解释；限定，规定', '基础', [], [], []],
  ['definite', 'adj.', '明确的，确切的；一定的，肯定的', '基础', [], [], []],
  ['definition', 'n.', '定义，释义；清晰（度），鲜明（度）', '基础', [], [], []],
  ['degree', 'n. /di\'gri:/', 'n. 程度, 度数, 学位, 度；[医] 度, 程度', '基础', [], [], []],
  ['delay', 'v. & n. /di\'lei/', 'n. 耽搁, 迟滞；v. 耽搁, 延迟；[计] 延迟, 延时', '基础', [], [], []],
  ['delete', 'v. /di\'li:t/', 'vt. 删除；[计] 删除', '基础', [], [], []],
  ['deliberately', 'adv. /di\'libәrәtli/', '故意，蓄意，存心', '基础', [], [], []],
  ['delicate', 'adj. /\'delikәt/', 'a. 细致优雅的, 微妙的, 美味的；[医] 柔弱的', '基础', [], [], []],
  ['delicious', 'adj. /di\'liʃәs/', '美味的，可口的', '基础', [], [], []],
  ['delight', 'n. /di\'lait/', 'n. 高兴, 愉快；vt. 使高兴, 乐于；vi. 感到高兴(或愉快、快乐)', '基础', [], [], []],
  ['delighted', 'adj. /di\'laitid/', 'a. 高兴的, 快乐的', '基础', [], [], []],
  ['deliver', 'vt. /di\'livә/', 'vt. 递送, 陈述, 释放, 发表, 引渡, 投递, 交付；[经] 交运', '基础', [], [], []],
  ['demand', 'n. & vt. /di\'mɑ:nd/', 'n. 要求, 需求, 需要；v. 要求, 查询', '基础', [], [], []],
  ['demanding', 'adj.', '要求多的，吃力的', '基础', [], [], []],
  ['dentist', 'n. /\'dentist/', 'n. 牙科医生；[医] 牙医师', '基础', [], [], []],
  ['deny', 'vt.', '否认，不承认；拒绝给予，拒绝要求', '基础', [], [], []],
  ['department', 'n. /di\'pɑ:tmәnt/', 'n. 部门, 系, 机关；[医] 部, 科', '基础', [], [], []],
  ['departure', 'n. /di\'pɑ:tʃә/', 'n. 离开, 出发, 违背, 偏离；[经] 启运', '基础', [], [], []],
  ['depend', 'vi. /di\'pend/', 'vi. 靠, 视...而定, 信赖', '基础', [], [], []],
  ['deposit', 'v. & n. /di\'pɒzit/', 'n. 存款, 定金, 堆积物；vt. 存放, 堆积；vi. 沉淀', '基础', [], [], []],
  ['depression', 'n.', '抑郁，沮丧；不景气，萧条', '基础', [], [], []],
  ['depth', 'n. /depθ/', 'n. 深度, 深处, 深奥；[计] 深度', '基础', [], [], []],
  ['describe', 'vt. /di\'skraib/', 'vt. 描述, 描绘, 画', '基础', [], [], []],
  ['description', 'n. /di\'skripʃәn/', 'n. 描述, 说明, 种类；[经] 说明书(物品), 品名种类, 货物名称', '基础', [], [], []],
  ['desert', 'n. vt. /\'dezәt. di\'sә:t/', 'n. 沙漠, 应得的赏罚, 功劳；a. 沙漠的, 不毛的；vt. 放弃, 遗弃, 擅离；vi. 逃掉', '基础', [], [], []],
  ['deserve', 'v. /di\'zә:v/', 'vt. 该得到, 值得；vi. 应得报答', '基础', [], [], []],
  ['design', 'n. & vt. n. /di\'zain/', 'n. 设计, 图样, 方案, 企图；v. 设计, 计划', '基础', [], [], []],
  ['desire', 'vt. & n. /di\'zaiә/', 'n. 欲望, 要求；vt. 想要, 请求；vi. 渴望', '基础', [], [], []],
  ['desk', 'n. /desk/', 'n. 书桌, 办公桌, 工作台', '基础', [], [], []],
  ['desperate', 'adj. /\'despәrәt/', 'a. 不顾一切的, 危急的, 令人绝望的, 极渴望的', '基础', [], [], []],
  ['despite', 'prep.', '不管，尽管', '基础', [], [], []],
  ['dessert', 'n. /di\'zә:t/', 'n. 餐后甜点', '基础', [], [], []],
  ['destination', 'n. /.desti\'neiʃәn/', 'n. 目的地, 目标, 目的；[计] 目的文件, 目的单元', '基础', [], [], []],
  ['destroy', 'vt. /di\'strɒi/', 'vt. 破坏, 毁坏, 消灭', '基础', [], [], []],
  ['detail', 'n.', '细节，详情', '基础', [], [], []],
  ['detective', 'n. /di\'tektiv/', 'n. 侦探；a. 侦探的', '基础', [], [], []],
  ['determine', 'vt. /di\'tә:min/', 'v. 决定, 决心', '基础', [], [], []],
  ['develop', 'v. vt. /di\'velәp/', 'vt. 发展, 使发达, 进步, 洗印, 显影；vi. 发展, 生长', '基础', [], [], []],
  ['development', 'n. /di\'velәpmәnt/', 'n. 发展；[化] 展开', '基础', [], [], []],
  ['device', 'n.', '装置，设备，器械', '基础', [], [], []],
  ['devote', 'vt. /di\'vәut/', '把…奉献，把…专用（于）', '基础', [], [], []],
  ['devotion', 'n. /di\'vәuʃәn/', 'n. 热爱, 投入', '基础', [], [], []],
  ['dial', 'vt. /\'daiәl/', 'n. 刻度盘, 钟面, 转盘；v. 拨', '基础', [], [], []],
  ['dialogue', 'n. /\'daiәlɒg/', 'n. 对话；vi. 对话；vt. 用对话表达', '基础', [], [], []],
  ['diamond', 'n. /\'daiәmәnd/', 'n. 钻石, 菱形；[计] 菱形', '基础', [], [], []],
  ['diary', 'n. /\'daiәri/', 'n. 日记；[经] 日记簿', '基础', [], [], []],
  ['dictation', 'n. /dik\'teiʃәn/', 'n. 听写, 口述, 命令', '基础', [], [], []],
  ['dictionary', 'n. /\'dikʃәnәri/', 'n. 字典, 词典；[计] 词典', '基础', [], [], []],
  ['die', 'v. /dai/', 'vi. 死亡, 消逝, 平息, 熄灭, 漠然, 渴望；vt. 死；n. 骰子, 冲模', '基础', [], [], []],
  ['diet', 'n. /\'daiәt/', 'n. 日常饮食, 议会；vt. 照规定饮食；vi. 忌食', '基础', [], [], []],
  ['differ', 'v. /\'difә/', 'vi. 不一致, 不同；[机] 差异, 不同', '基础', [], [], []],
  ['difference', 'n. /\'difәrәns/', 'n. 不同, 差异；[计] 差分', '基础', [], [], []],
  ['different', 'adj. /\'difәrәnt/', 'a. 不同的；[机] 差动, 微分的, 差速器', '基础', [], [], []],
  ['difficult', 'adj. /\'difikәlt/', '难；艰难；不易相处', '基础', [], [], []],
  ['difficulty', 'n. /\'difikәlti/', 'n. 困难, 难点', '基础', [], [], []],
  ['dig', 'v. /dig/', 'vt. 挖, 翻土, 发掘；vi. 挖掘；n. 挖掘；[计] 数字, 数位', '基础', [], [], []],
  ['digest', 'v. /di\'dʒest/', 'n. 文摘；vi. 消化；vt. 消化, 理解；[计] 摘要', '基础', [], [], []],
  ['digital', 'adj. /\'didʒitәl/', 'a. 数字显示的, 数字的；n. 数字仪表, 数字式电子表(或时钟)；[计] 数字, 数字式', '基础', [], [], []],
  ['dignity', 'n. /\'digniti/', 'n. 尊严, 高贵；[法] 尊严, 高位, 高贵', '基础', [], [], []],
  ['dimension', 'n. /dai\'menʃәn/', 'n. 尺寸, 次元, 面积, 维数；vt. 标出尺寸', '基础', [], [], []],
  ['dinner', 'n. /\'dinә/', 'n. 晚餐, 正餐, 宴会', '基础', [], [], []],
  ['dinosaur', 'n. /\'dainәsɒ:/', 'n. 恐龙', '基础', [], [], []],
  ['dip', 'vt. /dip/', 'v. 浸, 降下, 把(手、勺等)伸入, 舀取；n. 浸, 涉猎；[计] 双列直插式组件, 分布式输入输出系统, 双排直插封装', '基础', [], [], []],
  ['diploma', 'n. /di\'plәumә/', 'n. 文凭, 毕业证书；[医] 文凭', '基础', [], [], []],
  ['direct', 'adj. vt. /di\'rekt/', 'a. 直接的, 坦白的；vt. 指示, 指挥, 命令, 导演；vi. 指导, 指挥；adv. 直接地', '基础', [], [], []],
  ['direction', 'n. /di\'rekʃәn/', 'n. 方向, 指导, 趋势；[计] 方向; 流向', '基础', [], [], []],
  ['director', 'n. /di\'rektә/', 'n. 主管, 导演, 董事；[计] 寻向偶极子; 指挥仪', '基础', [], [], []],
  ['directory', 'n. /di\'rektәri/', 'n. 目录, 工商名录, 指南；[计] 目录', '基础', [], [], []],
  ['dirty', 'adj. /\'dә:ti/', 'a. 肮脏的, 卑鄙的；vt. 弄脏；vi. 变脏', '基础', [], [], []],
  ['disability', 'n. /disә\'biliti/', 'n. 无力, 无能, 残疾；[医] 劳动能力丧失, 病废', '基础', [], [], []],
  ['disabled', 'adj. /dis\'eibld/', 'a. 残废的, 有缺陷的, 失效的；[计] 失效的', '基础', [], [], []],
  ['disadvantage', 'n. /.disәd\'vɑ:ntidʒ/', 'n. 缺点, 不利, 坏处', '基础', [], [], []],
  ['disagree', 'vi. /.disә\'gri:/', 'vi. 不一致, 不适宜；[法] 抵触, 不同意, 争执', '基础', [], [], []],
  ['disagreement', 'n. /.disә\'gri:mәnt/', 'n. 不合, 争论, 不一致；[法] 不一致, 不同意, 陪审团的意见不一', '基础', [], [], []],
  ['disappear', 'vi. /.disә\'piә/', 'vi. 消失, 不见', '基础', [], [], []],
  ['disappoint', 'vt. /.disә\'pɒint/', 'vt. 使失望', '基础', [], [], []],
  ['disaster', 'n. /di\'zɑ:stә/', 'n. 灾祸, 不幸, 彻底失败', '基础', [], [], []],
  ['discipline', 'n.', '纪律；训练', '基础', [], [], []],
  ['discount', 'n. /\'diskaunt/', 'n. 折扣, 贴现率；vt. 打折扣；vi. 贴现', '基础', [], [], []],
  ['discourage', 'vt. /dis\'kʌridʒ/', '（使）气馁；打消（做…的念头）', '基础', [], [], []],
  ['discover', 'vt. /dis\'kʌvә/', 'vt. 发现, 找到, 暴露；vi. 发现', '基础', [], [], []],
  ['discovery', 'n. /dis\'kʌvәri/', 'n. 发现, 被发现的事物；[法] 要求告知, 发现, 发觉', '基础', [], [], []],
  ['discrimination', 'n. /dis.krimi\'neiʃәn/', 'n. 差别, 岐视, 辨别力；[化] 鉴别', '基础', [], [], []],
  ['discuss', 'vt. /dis\'kʌs/', 'vt. 讨论, 论述；[医] 讨论, 辩论', '基础', [], [], []],
  ['discussion', 'n. /dis\'kʌʃәn/', '讨论，辩论', '基础', [], [], []],
  ['disease', 'n. /di\'zi:z/', 'n. 疾病, 弊病；[医] [疾]病', '基础', [], [], []],
  ['disgusting', 'adj. /dis\'gʌstiŋ/', '令人厌恶的，令人作呕的', '基础', [], [], []],
  ['dish', 'n. /diʃ/', 'n. 盘子, 碟, 菜肴；[医] 皿, 碟', '基础', [], [], []],
  ['disk', 'n.', '磁盘', '基础', [], [], []],
  ['dislike', 'vt. /dis\'laik/', 'n. 嫌恶；vt. 讨厌, 不喜欢', '基础', [], [], []],
  ['dismiss', 'vt. /dis\'mis/', 'vt. 解散, 开除, 解职；vi. 解散；[计] 解散', '基础', [], [], []],
  ['display', 'n. & vt.', '陈列，展览；显示，表现', '基础', [], [], []],
  ['distance', 'n. /\'distәns/', 'n. 距离, 远方, 遥远；[计] 位距', '基础', [], [], []],
  ['distant', 'adj. /\'distәnt/', 'a. 远的, 疏远的；[经] 远期的', '基础', [], [], []],
  ['distinction', 'n. /dis\'tiŋkʃәn/', '差别，区别，优秀，卓越', '基础', [], [], []],
  ['distinguish', 'v. /dis\'tiŋgwiʃ/', 'v. 区别, 辨别', '基础', [], [], []],
  ['distribute', 'v. /di\'stribju:t/', 'vt. 分配, 散布, 分发；[经] 分配, 分发', '基础', [], [], []],
  ['district', 'n. /\'distrikt/', 'n. 区域, 地方；[医] 地区, 地段', '基础', [], [], []],
  ['disturb', 'vt. /dis\'tә:b/', 'vt. 扰乱, 妨碍, 使不安；[法] 滋扰, 扰乱', '基础', [], [], []],
  ['disturbing', 'adj. /dis\'tә:biŋ/', 'a. 引起烦恼的, 令人不安的', '基础', [], [], []],
  ['dive', 'vi. /daiv/', 'n. 潜水, 跳水；vi. 跳水, 俯冲, 猛冲；vt. 把...突然伸入', '基础', [], [], []],
  ['diverse', 'adj. /dai\'vә:s/', '不同的，多种多样的，形形色色的', '基础', [], [], []],
  ['divide', 'vt. /di\'vaid/', 'vi. 分开, 分配, 分裂；vt. 分, 分开, 分裂, 除；n. 分配, 分水岭；[计] 除', '基础', [], [], []],
  ['division', 'n. /di\'viʒәn/', 'n. 分, 分开, 除法, 部门(如部、处、系等), 师；[计] 部分', '基础', [], [], []],
  ['divorce', 'v. & n. /di\'vɒ:s/', 'n. 离婚；vt. 与...离婚', '基础', [], [], []],
  ['dizzy', 'adj. /\'dizi/', 'a. 晕眩的, 眼花缭乱的；vt. 使晕眩', '基础', [], [], []],
  ['do', 'v. & aux. /du:/', 'v. 做, 进行, 完成', '基础', [], [], []],
  ['doctor', 'n. /\'dɒktә/', 'n. 医生, 博士；vt. 授以博士学位, 诊断, 修改；vi. 行医', '基础', [], [], []],
  ['document', 'n. /\'dɒkjumәnt/', 'n. 文件, 公文, 文档；vt. 证明, 为...引证；[计] 文档', '基础', [], [], []],
  ['dog', 'n. /dɒg/', 'n. 狗, 坏蛋；vt. 跟踪, 尾随', '基础', [], [], []],
  ['doll', 'n. /dɒl/', 'n. 洋娃娃, 无头脑的美丽女人', '基础', [], [], []],
  ['dollar', 'n. /\'dɒlә/', 'n. 美元, 元(加、澳等国货币单位)；[经] 纯经济的, 美元, 元', '基础', [], [], []],
  ['domestic', 'adj.', '国内的；家（庭）的，家用的；驯养的', '基础', [], [], []],
  ['donate', 'v.', '捐赠，赠送', '基础', [], [], []],
  ['door', 'n. /dɒ:/', 'n. 门', '基础', [], [], []],
  ['dormitory', 'n. /\'dɒ:mitәri/', '学生宿舍（缩写式 dorm）', '基础', [], [], []],
  ['dot', 'n. /dɒt/', 'n. 点, 圆点, 小数点, 小东西, 嫁妆；vt. 作小点记号, 加小点于；vi. 打上点；[计] 点', '基础', [], [], []],
  ['double', 'adj. n. v. /\'dʌbl/', 'n. 两倍；a. 两倍的, 双重的；vt. 使加倍；vi. 加倍, 代替, 快步走；[计] 双精度型', '基础', [], [], []],
  ['doubt', 'n. & v. /daut/', 'n. 怀疑, 疑惑；v. 怀疑, 不信', '基础', [], [], []],
  ['down', 'prep. adv. /daun/', 'a. 向下的；adv. 下, 下去, 降下；prep. 往下, 沿着；n. 丘陵, 软毛, 开阔的高地；[计] 向下, 退下命令', '基础', [], [], []],
  ['download', 'n. & v.', '[计] 卸载, 下栽', '基础', [], [], []],
  ['downstairs', 'adv. /\'daun\'stєәz/', 'n. 楼下；a. 楼下的；adv. 在楼下', '基础', [], [], []],
  ['downtown', 'adv. n. adj. /\'daun\'taun/', '往或在城市的商业区（或中心区、闹市区） 城市的商业区，中心区，闹市区 城市的商业区的，中心区的，闹市区的', '基础', [], [], []],
  ['dozen', 'n. /\'dʌzn/', 'n. 打, 十二个；a. 一打的', '基础', [], [], []],
  ['draft', 'n. & v. /dræft. drɑ:ft/', 'n. 气流, 草稿, 汇票, 草案；vt. 起草, 征兵；[计] 草稿', '基础', [], [], []],
  ['drag', 'v. /dræg/', 'n. 拖, 拖累；v. 拖累, 拖拉, 沉重缓慢地走, 拖动；[计] 拖动', '基础', [], [], []],
  ['draw', 'v. /drɒ:/', 'vi. 拉, 拖, 拔剑；vt. 拖拉, 挨近, 领取, 打成平局, 引导, 抽签决定, 画, 描写, 制订, 草拟, 吸引；n. 拉, 拖, 拔出, 抽签, 平局；[计] 翻牌, 绘图', '基础', [], [], []],
  ['drawer', 'n. /\'drɒ:ә/', 'n. 抽屉, 开票人；[计] 抽屉', '基础', [], [], []],
  ['dream', 'n. & vt. /dri:m/', 'n. 梦, 空想, 愿望；v. 做梦, 想象, 梦想', '基础', [], [], []],
  ['dress', 'n. v. /dres/', 'n. 服装, 覆盖物；vi. 穿着；vt. 给...穿衣, 整理', '基础', [], [], []],
  ['drill', 'n. vt. /dril/', 'n. 钻孔机, 钻子, 播种机, 粗斜纹布；v. 训练, 钻孔', '基础', [], [], []],
  ['drink', 'v. /driŋk/', 'n. 饮料, 酒；v. 喝, 喝酒', '基础', [], [], []],
  ['drive', 'v. /draiv/', 'n. 驾车, 快车道, 推进力, 驱动, 动力, 击球, 驱动器；vt. 开车, 驱使, 推动, 驾驶；vi. 开车, 猛击, 飞跑；[计] 驱动器', '基础', [], [], []],
  ['driver', 'n. /\'draivә/', 'n. 驾驶员, 驱动器, 驱动程序；[化] 驱动器', '基础', [], [], []],
  ['drop', 'n. v. /drɒp/', 'n. 滴, 微量, 落下, 空投；vi. 放下, 掉下, 下降；vt. 使滴下, 放下, 丢失, 遗漏；[计] 投入, 投入点, 接入点, 分接点', '基础', [], [], []],
  ['drug', 'n. /drʌg/', 'n. 药, 麻药, 麻醉药；vi. 吸毒；vt. 使服麻醉药, 使麻木', '基础', [], [], []],
  ['drum', 'n. /drʌm/', 'n. 鼓, 鼓声；vi. 击鼓, 作鼓声；vt. 打鼓奏出；[计] 磁鼓', '基础', [], [], []],
  ['drunk', 'adj. /drʌŋk/', 'a. 喝醉了的；drink的过去式', '基础', [], [], []],
  ['dry', 'v. adj. /drai/', 'a. 干的, 无酒的, 枯燥无味的, 干燥的；vt. 把...弄干；vi. 变干；n. 干, 干涸', '基础', [], [], []],
  ['duck', 'n. /dʌk/', 'n. 鸭子；vi. 没入水中, 闪避；vt. 猛按...入水, 躲避', '基础', [], [], []],
  ['due', 'adj. /dju:/', 'n. 应得的东西, 应付款；a. 到期的, 应得的, 应付的, 约定的', '基础', [], [], []],
  ['dull', 'adj. /dʌl/', 'a. 钝的, 无趣的, 呆滞的, 阴暗的；vt. 使迟钝, 使阴暗, 缓和；vi. 变迟钝, 减少', '基础', [], [], []],
  ['dumpling', 'n. /\'dʌmpliŋ/', 'n. 面团布丁, 团子', '基础', [], [], []],
  ['during', 'prep. /\'djuәriŋ/', 'prep. 在...的时候', '基础', [], [], []],
  ['dusk', 'n. /dʌsk/', 'n. 薄暮, 傍晚, 黄昏；a. 微暗的；v. (使)微暗', '基础', [], [], []],
  ['dust', 'n. /dʌst/', 'n. 灰尘, 尘埃, 粉末, 花粉, 土, 骚乱；vt. 拂去灰尘, 撒, 弄成粉末；vi. 拂去灰尘, 化为粉末', '基础', [], [], []],
  ['dustbin', 'n. /\'dʌstbin/', 'n. 垃圾箱', '基础', [], [], []],
  ['dusty', 'adj. /\'dʌsti/', 'a. 灰尘多的, 无聊的, 含糊的, 粉末状的', '基础', [], [], []],
  ['duty', 'n. /\'dju:ti/', 'n. 责任, 关税, 职务, 尊敬；[化] 职责', '基础', [], [], []],
  ['DVD', 'n.', '数码影碟（digital video disc 的缩写）', '基础', [], [], []],
  ['dynamic', 'adj. /dai\'næmik/', 'a. 动态的, 有活力的, 有力的, 动力的, 不断变化的；n. 动力, 动态；[计] 动态的', '基础', [], [], []],
  ['dynasty', 'n. /\'dainæsti/', 'n. 朝代, 王朝', '基础', [], [], []],
  ['e-mail', 'n.', '电子邮件', '基础', [], [], []],
  ['each', 'adj. & pron. /i:tʃ/', 'a. 每个, 每一；adv. 每个；pron. 每个, 个人, 各自', '基础', [], [], []],
  ['eager', 'adj. /\'i:gә/', 'a. 热心的, 渴望的, 热望的', '基础', [], [], []],
  ['eagle', 'n. /\'i:gl/', 'n. 鹰, 鹰状标饰', '基础', [], [], []],
  ['ear', 'n. /iә/', 'n. 耳朵, 倾听, 听觉, 穗；vi. 抽穗', '基础', [], [], []],
  ['early', 'adj. adv. /\'ә:li/', 'a. 早的, 早熟的；adv. 很早, 初', '基础', [], [], []],
  ['earn', 'vt. /ә:n/', 'vt. 赚得, 获得, 博得；[计] 欧州科学研究网', '基础', [], [], []],
  ['earth', 'n. /ә:θ/', 'n. 地球, 泥土, 世界, 尘世；vt. 埋入土中, 赶入洞内；vi. 躲入洞内', '基础', [], [], []],
  ['earthquake', 'n. /\'ә:θkweik/', 'n. 地震', '基础', [], [], []],
  ['east', 'adj. adv. n. /i:st/', '东方的；东部的；朝东的；从东方来的 在东方；向东方；从东方 东，东方；东部', '基础', [], [], []],
  ['Easter', 'n. /\'i:stә/', 'n. 复活节', '基础', [], [], []],
  ['eastern', 'adj. /\'i:stәn/', 'n. 东方人, 东正教徒；a. 东方的, 向东的, 自东的', '基础', [], [], []],
  ['easy', 'adj. /\'i:zi/', 'a. 容易的, 缓缓的, 舒适的, 从容的, 宽容的, 流畅的, 随便的, 自在的, 疲软的；adv. 容易地, 慢慢地', '基础', [], [], []],
  ['eat', 'v. /i:t/', 'v. 吃, 腐蚀', '基础', [], [], []],
  ['ecology', 'n. /i:\'kɒlәdʒi/', 'n. 生态学, 社会生态学；[化] 生态学', '基础', [], [], []],
  ['economic', 'adj.', '经济（上、学）的', '基础', [], [], []],
  ['edge', 'n. /edʒ/', 'n. 边缘, 尖锐, 刀刃, 优势；vt. 使锐利, 挤进, 镶边；vi. 缓缓移动', '基础', [], [], []],
  ['edition', 'n. /i\'diʃәn/', '（发行物的）版，版（本）', '基础', [], [], []],
  ['editor', 'n. /\'editә/', 'n. 编者, 编辑, 主笔, 编辑器, 编辑装置；[计] 编辑器', '基础', [], [], []],
  ['educate', 'vt. /\'edjukeit/', 'vt. 教育, 培养, 训练', '基础', [], [], []],
  ['education', 'n. /.edju\'keiʃәn/', 'n. 教育, 训练, 教育学；[医] 教育, 训练', '基础', [], [], []],
  ['educational', 'adj.', '教育的，有教育意义的', '基础', [], [], []],
  ['educator', 'n. /\'edjukeitә/', 'n. 教育家', '基础', [], [], []],
  ['effect', 'n. /i\'fekt/', 'n. 结果, 影响, 效果, 印象；vt. 实行, 引起, 完成；[计] 效果', '基础', [], [], []],
  ['effective', 'adj.', '有效的，生效的', '基础', [], [], []],
  ['effort', 'n. /\'efәt/', 'n. 努力, 成就', '基础', [], [], []],
  ['egg', 'n. /eg/', 'n. 蛋, 卵；vt. 挑唆, 煽动, 调蛋黄', '基础', [], [], []],
  ['either', 'adj. conj. adv. /\'i:ðә/', 'a. (两者之中)任一的, (两者之中)各一的；pron. (两者之中)任一；conj. 或, 要么', '基础', [], [], []],
  ['elder', 'n. /\'eldә/', 'n. 年长者, 老人, 前辈；a. 年长的, 资深的', '基础', [], [], []],
  ['elderly', 'adj.', '年长的，上了年纪的', '基础', [], [], []],
  ['elect', 'vt. /i\'lekt/', 'n. 当选人, 被选的人；a. 被选的, 选出的；vt. 选举, 选择；vi. 作选择', '基础', [], [], []],
  ['electric', 'adj. /i\'lektik/', 'a. 电的, 导电的, 电动的；[医] 电的', '基础', [], [], []],
  ['electrical', 'adj. /i\'lektrikәl/', 'a. 电的, 有关电的；[医] 电的', '基础', [], [], []],
  ['electricity', 'n. /.ilek\'trisiti/', 'n. 电, 电流, 电学, 热情, 电力供应；[化] 电学; 电', '基础', [], [], []],
  ['electronic', 'adj. /.ilek\'trɒnik/', 'a. 电子的；[计] 电子工业协会接口', '基础', [], [], []],
  ['elegant', 'adj. /\'eligәnt/', 'a. 优雅的, 端庄的, 高雅的', '基础', [], [], []],
  ['element', 'n.', '元素；成分', '基础', [], [], []],
  ['elephant', 'n. /\'elifәnt/', 'n. 象', '基础', [], [], []],
  ['else', 'adv. /els/', 'a. 别的, 其他的；adv. 另外, 否则, 不然', '基础', [], [], []],
  ['embarrass', 'v. /im\'bærәs/', 'vt. 使困窘, 使局促不安, 阻碍', '基础', [], [], []],
  ['embassy', 'n. /\'embәsi/', 'n. 大使馆, 大使馆全体人员；[经] 大使馆', '基础', [], [], []],
  ['emergency', 'n. /i\'mә:dʒәnsi/', 'n. 紧急状况, 紧急事件, 紧急需要；[化] 紧急情况', '基础', [], [], []],
  ['emotion', 'n.', '情感，感情，激情', '基础', [], [], []],
  ['emotional', 'adj.', '令人动情的；易动感情的；感情（上）的', '基础', [], [], []],
  ['emperor', 'n. /\'empәrә/', 'n. 皇帝, 君主', '基础', [], [], []],
  ['employ', 'vt. /im\'plɒi/', 'n. 雇用；vt. 雇用, 使用, 使从事于', '基础', [], [], []],
  ['employer', 'n.', '雇主，雇佣者', '基础', [], [], []],
  ['employment', 'n.', '工作，职业；雇用', '基础', [], [], []],
  ['empty', 'adj. /\'empti/', 'a. 空的, 空虚的, 空腹的, 空洞的；n. 空的东西, 空车；vt. 倒空, 使变空, 使排出；vi. 流空；[计] 空', '基础', [], [], []],
  ['encourage', 'vt. /in\'kʌridʒ/', 'vt. 鼓励, 支持, 激励；[法] 怂恿, 煽动, 助长', '基础', [], [], []],
  ['encouragement', 'n. /in\'kʌridʒmәnt/', 'n. 鼓励, 激励, 奖励；[法] 怂恿, 煽动, 助长', '基础', [], [], []],
  ['end', 'n. v. /end/', 'n. 结束, 终点, 目标, 末端, 梢, 死亡, 残余；v. 结束, 终结, 终止；[计] 端; 结束', '基础', [], [], []],
  ['ending', 'n. /\'endiŋ/', 'n. 终止, 终了, 收场；[医] 末梢', '基础', [], [], []],
  ['endless', 'adj. /\'endlis/', 'a. 不停的, 无穷尽的, 无尽的；[机] 无端的, 环状的', '基础', [], [], []],
  ['enemy', 'n. /\'enimi/', 'n. 敌人, 仇敌, 敌军；a. 敌人的', '基础', [], [], []],
  ['energetic', 'adj. /.enә\'dʒetik/', 'a. 精力充沛的, 积极的', '基础', [], [], []],
  ['energy', 'n.', '精力，能量', '基础', [], [], []],
  ['engine', 'n. /\'endʒin/', 'n. 引擎, 发动机, 机车；vt. 安装发动机于', '基础', [], [], []],
  ['engineer', 'n. /.endʒi\'niә/', 'n. 工程师, 工兵；vt. 设计, 监造, 精明地处理, 策划', '基础', [], [], []],
  ['engineering', 'n.', '工程（学），工程师行业', '基础', [], [], []],
  ['English', 'adj. n. /\'iŋgliʃ/', 'n. 英语；a. 英文的, 英国人的', '基础', [], [], []],
  ['enjoy', 'vt. /in\'dʒɒi/', 'vt. 享受, 喜欢, 欣赏；[法] 享受, 享有, 获得某种利益', '基础', [], [], []],
  ['enjoyable', 'adj. /in\'dʒɒiәbl/', 'a. 可从中得到乐趣的, 令人愉快的', '基础', [], [], []],
  ['enlarge', 'vt. /in\'lɑ:dʒ/', 'vt. 扩大, 增大；vi. 扩大, 详述', '基础', [], [], []],
  ['enough', 'n. adj. adv. /i\'nʌf/', 'n. 充足, 够, 很多；a. 充足的, 足够；adv. 足够；interj. 够了', '基础', [], [], []],
  ['enquiry', 'n. /in\'kwaiәri/', 'n. 询问；[经] 询价, 询盘', '基础', [], [], []],
  ['ensure', 'vt.', '保证，担保，确保', '基础', [], [], []],
  ['enter', 'vt. /\'entә/', 'vt. 进入, 参加, 开始, 输入, 回车；vi. 进去, 参加；[计] 输入, 回车', '基础', [], [], []],
  ['enterprise', 'n. /\'entәpraiz/', 'n. 企业, 事业心, 进取心, 干事业；[计] 企业', '基础', [], [], []],
  ['entertainment', 'n. /.entә\'teinmәnt/', 'n. 娱乐, 款待, 娱乐表演', '基础', [], [], []],
  ['enthusiastic', 'adj. /in.θju:zi\'æstik/', 'a. 狂热的, 热心的, 热烈的', '基础', [], [], []],
  ['entire', 'adj. /in\'taiә/', 'n. 整个, 全部；a. 全体的, 完全的, 全部的', '基础', [], [], []],
  ['entitle', 'vt.', '给…权利，给…资格；给（书等）题名', '基础', [], [], []],
  ['entrance', 'n. /\'entrәns/', 'n. 入口, 进入点, 入场, 入学, 进入, 开始(阶段), 就任；vt. 使出神, 使入迷；[计] 入口', '基础', [], [], []],
  ['entry', 'n. /\'entri/', 'n. 登录, 条目, 进入, 入口, 报关；[计] 登录项, 输入项, 条目', '基础', [], [], []],
  ['envelope', 'n. /\'envәlәup/', 'n. 信封, 封套, 封袋；[医] 膜, 包袋', '基础', [], [], []],
  ['environment', 'n. /in\'vairәnmәnt/', 'n. 环境, 外界, 围绕；[计] 环境', '基础', [], [], []],
  ['environmental', 'adj.', '环境的，有关环境的', '基础', [], [], []],
  ['envy', 'vt. & n. /\'envi/', 'n. 羡慕, 嫉妒；vt. 羡慕, 嫉妒', '基础', [], [], []],
  ['equal', 'adj. vt. /\'i:kwәl/', 'n. 对手, 匹敌, 同辈；a. 相等的, 平等的, 胜任的, 合适的, 平静的, 不相上下的；vt. 等于, 比得上；[计] 等长度编码', '基础', [], [], []],
  ['equality', 'n. /i:\'kwɒliti/', 'n. 平等, 均匀, 相等；[法] 同等, 平等, 相等', '基础', [], [], []],
  ['equip', 'vt. /i\'kwip/', 'vt. 装备, 配备；[机] 设备, 装置', '基础', [], [], []],
  ['equipment', 'n. /i\'kwipmәnt/', 'n. 装备, 设备, 才能；[化] 设备; 装备; 装置', '基础', [], [], []],
  ['eraser', 'n. /i\'reisә/', '橡皮擦；黑板擦', '基础', [], [], []],
  ['error', 'n. /\'erә/', 'n. 错误, 过失, 失误, 误差；[计] 错误', '基础', [], [], []],
  ['erupt', 'v. /i\'rʌpt/', 'vi. 爆发；vt. 喷出', '基础', [], [], []],
  ['escape', 'n. & vi. /i\'skeip/', 'n. 逃亡, 避难设备, 逃跑；vi. 逃脱, 避开, 溜走；vt. 逃避, 避免, 被...忘掉', '基础', [], [], []],
  ['especially', 'adv. /i\'speʃәli/', 'adv. 尤其, 特别, 格外', '基础', [], [], []],
  ['essay', 'n. /\'esei. e\'sei/', 'n. 随笔, 短文, 评论, 企图；vt. 试图', '基础', [], [], []],
  ['essential', 'adj.', '必不可少的；本质的，基本的', '基础', [], [], []],
  ['establish', 'vt.', '建立，创办，设立', '基础', [], [], []],
  ['Europe', 'n.', '欧洲', '基础', [], [], []],
  ['European', 'adj. n. /.juәrә\'pi:әn/', 'n. 欧洲人；a. 欧洲的, 欧洲人的', '基础', [], [], []],
  ['evaluate', 'v. /i\'væljueit/', 'vt. 评估, 评价, 赋值', '基础', [], [], []],
  ['even', 'adv. /\'i:vәn/', 'a. 平坦的, 相等的, 连贯的, 均等的, 公平的, 偶数的, 平均的, 平衡的, 恰好的；vt. 使平坦, 使相等；vi. 变平, 成为相等；adv. 甚至, 实际上, 完全, 十分；n. 偶数, 偶校验；[计] 偶数, 偶校验', '基础', [], [], []],
  ['evening', 'n. /\'i:vniŋ/', 'n. 傍晚, 晚间, 末期', '基础', [], [], []],
  ['event', 'n. /i\'vent/', 'n. 事件, 结果, 事情的进程, 竞赛项目；[计] 事件', '基础', [], [], []],
  ['eventually', 'adv. /i\'ventʃuәli/', 'adv. 最后, 终于', '基础', [], [], []],
  ['ever', 'adv. /\'evә/', 'adv. 曾经, 究竟, 永远', '基础', [], [], []],
  ['every', 'adj. /\'evri/', 'a. 每一, 所有的', '基础', [], [], []],
  ['everybody', 'pron. /\'evribɒdi/', 'pron. 每个人, 人人', '基础', [], [], []],
  ['everyday', 'adj. /\'evri\'dei/', 'a. 每天的, 日常的, 平常的', '基础', [], [], []],
  ['everyone', 'pron. /\'evriwʌn/', 'pron. 每个人, 人人；[计] 系统中的一个组名', '基础', [], [], []],
  ['everything', 'pron. /\'evriθiŋ/', 'pron. 每件事物, 所有事物', '基础', [], [], []],
  ['everywhere', 'adv. /\'evrihwєә/', 'adv. 各处, 到处', '基础', [], [], []],
  ['evidence', 'n. /\'evidәns/', 'n. 根据, 证据, 迹象；[经] 证据, 凭证', '基础', [], [], []],
  ['evident', 'adj. /\'evidәnt/', 'a. 显然的, 明显的', '基础', [], [], []],
  ['evil', 'adj. n.', '邪恶的，坏的 邪恶，罪恶', '基础', [], [], []],
  ['evolution', 'n. /.i:vә\'lu:ʃәn/', 'n. 进化, 发展, 进展, (气体)放出, 开方；[医] 进化, 演化, 旋出', '基础', [], [], []],
  ['exact', 'adj. /ig\'zækt/', 'a. 精确的, 准确的, 精密的；vt. 强求, 急需', '基础', [], [], []],
  ['exam', 'n.', '考试，测试；检查；审查', '基础', [], [], []],
  ['examine', 'vt. /ig\'zæmin/', 'v. 检查, 调查, 考试', '基础', [], [], []],
  ['example', 'n. /ig\'zæmpl/', 'n. 例子, 样本, 实例；[化] 实例', '基础', [], [], []],
  ['excellent', 'adj. /\'ekslәnt/', 'a. 优良的, 杰出的, 出色的', '基础', [], [], []],
  ['except', 'prep. /ik\'sept/', 'vt. 除, 除外；vi. 反对；prep. 除了...之外, 若不是, 除非；conj. 只是', '基础', [], [], []],
  ['exception', 'n.', '例外', '基础', [], [], []],
  ['exchange', 'n. /iks\'tʃeindʒ/', 'n. 交换, (电话)交换局, 交换机, 汇兑, 交易所；v. 交换, 交易, 兑换；[计] 交换; 电话局', '基础', [], [], []],
  ['excite', 'vt. /ik\'sait/', 'vt. 刺激, 使兴奋, 激励', '基础', [], [], []],
  ['excuse', 'n. vt. /ik\'skju:z/', 'vt. 原谅, 申辩, 做为...的托辞；n. 致歉, 理由, 饶恕, 借口', '基础', [], [], []],
  ['exercise', 'n. vi. /\'eksәsaiz/', 'n. 行使, 执行, 运动, 练习, 作业；vt. 运用, 练习, 运动；vi. 练习, 锻炼', '基础', [], [], []],
  ['exhibition', 'n. /.eksi\'biʃәn/', 'n. 表现, 展览会, 展览品；[医] 投药, 展览, 展出', '基础', [], [], []],
  ['exist', 'vi. /ig\'zist/', 'vi. 存在, 生存, 发生', '基础', [], [], []],
  ['existence', 'n. /ig\'zistәns/', 'n. 存在, 生存；[法] 存在, 存在状态, 实体', '基础', [], [], []],
  ['exit', 'n. /\'eksit/', 'n. 出口, 退场, 离去, 去世；vi. 退出, 脱离, 去世；[计] 退出; DOS内部命令:本命令用于退出当前的命令处理器(COMMAND.COM)；恢复前一个命令处理器', '基础', [], [], []],
  ['expand', 'v. /ik\'spænd/', 'vt. 使膨胀, 详述, 扩张；vi. 张开, 发展；vt. 展开；vi. 展开；[计] 展开; DOS外部命令:将原始DOS磁盘上的压缩文件解压缩并拷贝到硬盘上', '基础', [], [], []],
  ['expect', 'vt. /iks\'pekt/', 'vt. 预期, 盼望, 期待', '基础', [], [], []],
  ['expectation', 'n. /.ekspek\'teiʃәn/', 'n. 期待, 指望, 展望；[化] 期望值', '基础', [], [], []],
  ['expense', 'n. /ik\'spens/', 'n. 费用, 代价, 开支, 损失；[经] 费用, 开支, 将支出转为费用', '基础', [], [], []],
  ['expensive', 'adj. /ik\'spensiv/', 'a. 贵的, 奢华的, 费用浩大的, 乱化钱的；[经] 高价的, 昂贵的, 浪费的', '基础', [], [], []],
  ['experience', 'n. /ik\'spiәriәns/', 'n. 经历, 经验, 体验；vt. 经历, 经验, 体验', '基础', [], [], []],
  ['experiment', 'n. /ik\'sperimәnt/', 'n. 实验, 试验, 实验仪器；vi. 实验, 尝试', '基础', [], [], []],
  ['expert', 'n. /\'ekspә:t/', 'n. 专家, 行家；a. 老练的, 内行的, 专门的；[计] 高级', '基础', [], [], []],
  ['explain', 'vt. /ik\'splein/', 'v. 解释, 说明', '基础', [], [], []],
  ['explanation', 'n. /.eksplә\'neiʃәn/', 'n. 解释, 说明, 辩解, 表明；[经] 解释, 注释, 说明', '基础', [], [], []],
  ['explicit', 'adj. /ik\'splisit/', 'a. 详述的, 清楚的, 直言的', '基础', [], [], []],
  ['explode', 'v. /ik\'splәud/', 'vi. 爆炸, 爆发, 激增；vt. 使爆炸', '基础', [], [], []],
  ['explore', 'v. /ik\'splɒ:/', 'v. 探险, 探测, 探究', '基础', [], [], []],
  ['explorer', 'n. /ik\'splɒ:rә/', 'n. 探险家, 探测者, 勘探器；[医] 探察器', '基础', [], [], []],
  ['export', 'n. & v. /ik\'spɒ:t/', 'n. 输出品, 输出；vt. 输出, 出口；vi. 输出物资；[计] 导出', '基础', [], [], []],
  ['expose', 'vt. /ik\'spәuz/', 'vt. 使暴露, 使曝光, 揭穿, 陈列；[医] 暴露, 露置', '基础', [], [], []],
  ['express', 'vt. n. /ik\'spres/', 'n. 快车, 快递, 专使；a. 明确的, 丝毫不差的, 专门的, 快的；vt. 表达, 表示, 表露', '基础', [], [], []],
  ['expression', 'n. /ik\'spreʃәn/', 'n. 表达, 表现, 词语, 措辞；[计] 表达式', '基础', [], [], []],
  ['extension', 'n. /ik\'stenʃәn/', 'n. 延长, 扩充, 范围, 扩展名；a. 伸缩的；[计] 扩展名, 扩充名', '基础', [], [], []],
  ['extra', 'adj. /\'ekstrә/', 'n. 额外的事物, 另外的收费；a. 额外的, 特别的；adv. 额外地, 特别地, 非常地', '基础', [], [], []],
  ['extraordinary', 'adj. /ik\'strɒ:dәnәri/', 'a. 非常的, 特别的, 非凡的；[经] 非常的, 特别的, 临时的', '基础', [], [], []],
  ['extreme', 'adj. /ik\'stri:m/', 'n. 极端, 末端；a. 极端的, 尽头的, 极度的, 偏激的', '基础', [], [], []],
  ['extremely', 'adv. /ik\'stri:mli/', 'adv. 极端地, 非常地', '基础', [], [], []],
  ['eye', 'n. /ai/', 'n. 眼睛, 视力, 看；vt. 看, 注视', '基础', [], [], []],
  ['eyesight', 'n. /\'aisait/', 'n. 视力, 目力', '基础', [], [], []],
  ['eyewitness', 'n. /ai\'witnis/', 'n. 目击者, 见证人', '基础', [], [], []],
  ['f', 'n.', '女（的）；雌（的）；英尺', '基础', [], [], []],
  ['face', 'n. vt. /feis/', 'n. 脸, 面容, 正面, 外观；vt. 面对, 朝, 正视, 面临；vi. 朝, 向；[计] 现场可改变的控制元件', '基础', [], [], []],
  ['facial', 'adj. /\'feiʃәl/', 'n. 美颜, 脸部按摩；a. 脸的, 表面的, 脸部用的', '基础', [], [], []],
  ['facility', 'n.', '设备，设施；工具；容易，简易，便利', '基础', [], [], []],
  ['fact', 'n. /fækt/', 'n. 事实, 真实性, 真相, 细节, 论据', '基础', [], [], []],
  ['factory', 'n. /\'fæktәri/', 'n. 工厂, 产生地, 代理店；[经] 工厂, 代理店, 商行在国外的代理处', '基础', [], [], []],
  ['fade', 'vi. /feid/', 'vi. 褪色, 消失, 凋谢；vt. 使褪色；n. 淡入, 淡出；a. 平淡的', '基础', [], [], []],
  ['fail', 'v. /feil/', 'vi. 失败, 缺乏, 中断, 衰退, 失灵；vt. 忘记, 使...失望, 缺乏, 不及格；n. 不及格', '基础', [], [], []],
  ['failure', 'n. /\'feiljә/', 'n. 失败, 失败者, 不足, 缺乏, 破产；[计] 故障; 失效', '基础', [], [], []],
  ['fair', 'adj. n. /fєә/', 'n. 展览会, 市集, 美好的事物；a. 公平的, 按规则进行的, 不好不坏的, 晴朗的, 美丽的；adv. 公平地, 正面地, 有教养地, 清楚地；vi. 转晴', '基础', [], [], []],
  ['fairly', 'adv. /\'fєәli/', 'adv. 美观地, 公平地, 相当地, 清楚地', '基础', [], [], []],
  ['fairness', 'n. /\'fєәnis/', 'n. 晴朗, 光明正大, 美丽；[经] 公正, 适当', '基础', [], [], []],
  ['faith', 'n. /feiθ/', 'n. 信心, 信任, 忠实, 保证；[法] 信任, 信仰, 信念', '基础', [], [], []],
  ['fall', 'n. vi. /fɒ:l/', 'n. 落下, 瀑布, 采伐量, 下降, 落差, 降低, 堕落, 秋天；vi. 倒下, 落下, 来临, 失守, 阵亡, 下跌, 减弱, 倾斜, 垮台, 轮到, 变成, 降低；a. 秋天的', '基础', [], [], []],
  ['false', 'adj. /fɒ:ls/', 'a. 错误的, 虚伪的, 假的, 不老实的；adv. 不准确地, 欺诈地', '基础', [], [], []],
  ['familiar', 'adj. /fә\'miljә/', 'a. 熟悉的, 常见的, 亲密的；n. 熟友, 常客', '基础', [], [], []],
  ['family', 'n. /\'fæmәli/', 'n. 家庭, 家人, 族；a. 家庭的', '基础', [], [], []],
  ['family name', 'n.', '姓氏', '基础', [], [], []],
  ['famous', 'adj. /\'feimәs/', 'a. 出名的, 极好的', '基础', [], [], []],
  ['fan', 'n. /fæn/', 'n. 风扇, 迷, 狂热者, 爱好者；vt. 煽动, 刺激, 吹拂；vi. 飘动, 成扇形散开', '基础', [], [], []],
  ['fancy', 'adj. /\'fænsi/', 'n. 想象力, 幻想, 喜好；a. 想象的, 精美的, 新奇的, 奇特的, 高价的, 特级的；vt. 想象, 设想, 相信, 喜爱；vi. 想象, 幻想', '基础', [], [], []],
  ['fantastic', 'adj. /fæn\'tæstik/', 'a. 奇妙的, 稀奇的, 空想的', '基础', [], [], []],
  ['fantasy', 'n. /\'fæntәsi/', 'n. 幻想, 想象的产物；[医] 幻想', '基础', [], [], []],
  ['far', 'adj. & adv. /fɑ:/', '远的；远地（比较级 farther／further，最高级 farthest／furthest）', '基础', [], [], []],
  ['fare', 'n. /fєә/', 'n. 费用, 旅客, 食物；vi. 进展, 进步, 经营, 过活', '基础', [], [], []],
  ['farm', 'n. /fɑ:m/', 'n. 农场, 农田；vt. 耕种；vi. 种田', '基础', [], [], []],
  ['farmer', 'n. /\'fɑ:mә/', 'n. 农夫, 农场主；[法] 农民, 农场主, 承包者', '基础', [], [], []],
  ['fascinating', 'adj.', '迷人的；极美的；极好的', '基础', [], [], []],
  ['fast', 'adj. adv. /fɑ:st/', 'a. 快速的, 紧的；adv. 很快地, 紧紧地, 彻底地；n. 绝食, 斋戒；vi. 绝食, 斋戒', '基础', [], [], []],
  ['fasten', 'vt. /\'fɑ:sәn/', 'vt. 拴紧, 使固定, 系, 集中于, 强加于；vi. 扣紧', '基础', [], [], []],
  ['fat', 'n. adj. /fæt/', 'n. 脂肪, 脂油, 肥肉；a. 肥的, 胖的, 油腻的；n. 文件分配表；[计] 文件分配表', '基础', [], [], []],
  ['father', 'n. /\'fɑ:ðә/', 'n. 父亲, 祖先, 长辈, 神父, 创始者；vt. 当...的父亲, 保护, 创作, 发明, 培养', '基础', [], [], []],
  ['fault', 'n. /fɒ:lt/', 'n. 过错, 故障, 毛病；vt. 挑剔；vi. 产生断层, 弄错；[计] 故障', '基础', [], [], []],
  ['favour', 'n. /\'feivә/', 'n. 好感, 偏爱, 喜爱, 相信, 庇护, 赞同, 支持, 信赖, 善行, 恩惠, 徽章, 礼物；vt. 赞成, 帮助, 支持, 喜爱, 偏袒, 关切, 赐与, 给与, 有利于, 有助于, 像, 体恤', '基础', [], [], []],
  ['favourite', 'adj. n. /\'feivәrit/', '喜爱的 特别喜爱的人（或物）（美 favorite）', '基础', [], [], []],
  ['fax', 'n.', '传真', '基础', [], [], []],
  ['fear', 'n. /fiә/', 'n. 恐怖, 害怕, 担心；v. 害怕, 恐惧, 为...担心, 敬畏', '基础', [], [], []],
  ['feast', 'n. /fi:st/', 'n. 宴会, 酒席, 享受, 节日；vt. 款待, 享乐, 请客；vi. 参加宴会, 尽情地吃, 享受', '基础', [], [], []],
  ['feather', 'n. /\'feðә/', 'n. 羽毛；vi. 长羽毛；vt. 用羽毛装饰', '基础', [], [], []],
  ['February', 'n. /\'februәri/', 'n. 二月', '基础', [], [], []],
  ['federal', 'adj.', '联邦的；中央的', '基础', [], [], []],
  ['fee', 'n. /fi:/', 'n. 费用, 小费, 封地, 所有权；vt. 付费给', '基础', [], [], []],
  ['feed', 'vt. /fi:d/', 'n. 饲料, 一餐, 饲养；vt. 喂, 饲养, 放牧, 靠...为生；vi. 吃东西, 用餐, 流入；[计] 送纸', '基础', [], [], []],
  ['feel', 'v. & n. /fi:l/', 'vt. 感觉, 觉得, 触摸, 以为；vi. 有知觉, 摸索, 同情；n. 感觉, 觉得, 触摸', '基础', [], [], []],
  ['feeling', 'n. /\'fi:liŋ/', 'n. 摸, 触觉, 知觉, 感觉, 情绪, 同情；a. 有同情心的, 有感觉的, 仁慈的, 动人的', '基础', [], [], []],
  ['fellow', 'n. /\'felәu/', 'n. 男人, 朋友, 同事；a. 同伴的, 同事的, 同道的', '基础', [], [], []],
  ['female', 'adj. /\'fi:meil/', 'n. 女性, 女人, 雌性动物；a. 女性的, 女子的', '基础', [], [], []],
  ['fence', 'n. /fens/', 'n. 围墙, 栅栏, 买卖赃物的人, 剑术；vt. 用篱笆围住, 练习剑术, 防护；vi. 击剑, 搪塞', '基础', [], [], []],
  ['ferry', 'n. /\'feri/', 'n. 渡船, 渡口；[法] 摆渡营业权, 轮渡', '基础', [], [], []],
  ['festival', 'n. adj. /\'festәvәl/', 'a. 节日的, 喜庆的, 快乐的；n. 节日, 庆祝, 欢宴', '基础', [], [], []],
  ['fetch', 'vt. /fetʃ/', 'n. 取得, 拿, 诡计, 魂；vt. 接来, 取来, 售得, 带来, 推出, 引出, 杀死, 吸引, 到达；vi. 取物, 前进；[计] 取', '基础', [], [], []],
  ['fever', 'n. /\'fi:vә/', 'n. 发烧, 发热, 热病；[医] 发热, 热', '基础', [], [], []],
  ['few', 'pron. /fju:/', 'a. 很少的, 不多的, 少数的；n. 少数', '基础', [], [], []],
  ['fibre', 'n. /\'faibә/', 'n. 纤维, 构造, 纤维制品；[化] 纤维', '基础', [], [], []],
  ['fiction', 'n. /\'fikʃәn/', 'n. 小说, 虚构故事；[法] 虚构的事实, 捏造, 拟制', '基础', [], [], []],
  ['field', 'n. /fi:ld/', 'n. 领域, 田地, 场地, 战场, 场, 域；vt. 使...晒在场上, 使上场；a. 田间的, 野生的, 野外的, 田赛的；[计] 域, 字段', '基础', [], [], []],
  ['fierce', 'adj. /fiәs/', 'a. 凶猛的, 猛烈的, 热烈的, 暴躁的', '基础', [], [], []],
  ['fifteen', 'num. /\'fif\'ti:n/', 'num. 十五, 十五个', '基础', [], [], []],
  ['fifth', 'num. /fifθ/', 'num. 第五, 五分之一', '基础', [], [], []],
  ['fifty', 'num. /\'fifti/', 'num. 五十, 五十个', '基础', [], [], []],
  ['fight', 'n. & v. /fait/', 'n. 打架, 争吵, 斗志；v. 对抗, 打架', '基础', [], [], []],
  ['fighter', 'n. /\'faitә/', 'n. 斗士, 战士, 好战者, 战斗机', '基础', [], [], []],
  ['figure', 'n. vt. /\'figә/', '数字；数目；图；图形；（人的）身型；人物；（绘画、雕刻）人物像 （美口语）认为，判断；（在心里）想像，描绘', '基础', [], [], []],
  ['file', 'n. /fail/', 'n. 档案, 公文箱, 文件夹, 文件, 卷宗, 锉刀；vi. 列队行进, 用锉刀做；vt. 归档, 申请, 锉, 琢磨；[计] 文件', '基础', [], [], []],
  ['fill', 'vt. /fil/', 'vt. 装满, 填充, 弥漫, 供给, 满足, 供应；vi. 充满, 变得沉重；n. 满足, 装满, 充分, 填方；vt. 填充；vi. 填充；[计] 填充', '基础', [], [], []],
  ['film', 'n. vt. /film/', 'n. 软片, 薄膜, 胶卷, 电影；vt. 覆以薄膜, 拍摄；vi. 生薄膜, 拍电影', '基础', [], [], []],
  ['final', 'adj. /\'fainl/', 'n. 期末考试, 结局, 决赛；a. 最后的, 终极的, 决定性的', '基础', [], [], []],
  ['finance', 'n. /fai\'næns/', 'n. 财政, 财务；vt. 供给...经费, 负担经费；vi. 筹措资金', '基础', [], [], []],
  ['financial', 'adj.', '财务的；金融的', '基础', [], [], []],
  ['find', 'vt. /faind/', 'vt. 发现, 感到, 找到, 认为, 得到；vi. 裁决；n. 发现；[计] 查找; DOS外部命令:在指定的文件或从键盘输入的文本行中；寻找指定的字符串, 将符合条件的行或行数输出到标准输出设备上', '基础', [], [], []],
  ['fine', 'adj. n. & v. /fain/', 'n. 罚款, 罚金, 晴天, 精细；a. 好的, 晴朗的, 健康的, 细小的, 精细的；vt. 罚款, 精炼, 澄清；vi. 变清, 变细；adv. 很好；[计] 精细', '基础', [], [], []],
  ['finger', 'n. /\'fiŋgә/', 'n. 手指, 指状物, (手套的)手指部分, 指针；v. 用手指拨弄, 伸出；[计] 网络命令', '基础', [], [], []],
  ['finish', 'v. /\'finiʃ/', 'n. 完成, 结束, 末道漆, 磨光, 完美；vt. 完成, 结束, 用完, 毁掉；vi. 结束；[计] 完成', '基础', [], [], []],
  ['fire', 'n. vi. /\'faiә/', 'n. 火, 炉火, 电炉, 火灾, 闪光体, 炮火, 热情；vt. 点燃, 烧制, 使发光, 激动, 放枪, 解雇；vi. 着火, 烧火, 开枪, 射击, 激动', '基础', [], [], []],
  ['firefighter', 'n. /ˈfaɪəfaɪtə(r)/', 'n. <美>消防队员', '基础', [], [], []],
  ['firework', 'n.', 'n. 烟火具, 烟火, 烟火信号弹, 焰火, 激情的表现', '基础', [], [], []],
  ['firm', 'n. adj. /fә:m/', 'n. 公司, 商号；a. 坚定的, 坚强的, 牢固的, 结实的, 坚硬的, 坚挺的, 严格的, 确定的；vt. 使牢固, 使坚定；vi. 变稳固, 变坚实；adv. 稳固地', '基础', [], [], []],
  ['firmly', 'adv. /\'fә:mli/', 'adv. 坚固, 坚定, 断然', '基础', [], [], []],
  ['first', 'num. adj. & adv. n. /fә:st/', 'adv. 首先, 第一, 优先；a. 第一的；num. 第一；n. 开始, 第一', '基础', [], [], []],
  ['fish', 'n. vi. /fiʃ/', 'n. 鱼, 鱼肉, 鱼类, 接合板；vt. 钓, 钓鱼, 查出, 用接合板连接；vi. 捕鱼, 钓鱼, 用钩捞取, 摸索寻找', '基础', [], [], []],
  ['fisherman', 'n. /\'fiʃәmәn/', 'n. 渔夫, 钓鱼者, 渔船', '基础', [], [], []],
  ['fist', 'n. /fist/', 'n. 拳头, 手；vt. 拳打, 握成拳, 紧握', '基础', [], [], []],
  ['fit', 'adj. v. /fit/', 'n. 适宜, 合身, 发作, 痉挛；a. 适宜的, 对的, 准备好的；vt. 适合, 安装, 使合身, 使适应, 使合格；vi. 适合, 符合, 合身；[计] 非特', '基础', [], [], []],
  ['five', 'num. /faiv/', 'num. 五, 五个', '基础', [], [], []],
  ['fix', 'vt. /fiks/', 'vt. 使固定, 修理, 准备, 安装, 凝视, 牢记, 确定, 整理；vi. 固定, 注视, 确定；n. 困境, 方位, 维修, 贿赂', '基础', [], [], []],
  ['flag', 'n. /flæg/', 'n. 标志, 旗标, 旗子, 信号旗, 菖蒲；vt. 悬旗, 打旗号, 铺石板；vi. 无力地下垂；[计] 标志; 属性标记命令', '基础', [], [], []],
  ['flame', 'n. /fleim/', 'n. 火焰, 火舌, 热情, 光辉；vt. 焚烧, 用火焰给...灭菌, 用火焰传送(信号), 点燃, 激动；vi. 燃烧, 爆发, 闪耀；[计] 无聊邮件, 无益邮件', '基础', [], [], []],
  ['flaming', 'adj. /\'fleimiŋ/', 'a. 燃烧的, 热烈的, 色彩鲜明的', '基础', [], [], []],
  ['flash', 'n. /flæʃ/', 'n. 闪光, 闪现, 一瞬间；vi. 闪光, 闪现, 反射；vt. 使闪光, 反射', '基础', [], [], []],
  ['flashlight', 'n. /\'flæʃlait/', 'n. 手电筒, 闪光信号灯', '基础', [], [], []],
  ['flat', 'adj. n. /flæt/', 'a. 平坦的, 单调的, 无力的, 浅的, 萧条的, 干脆的, 无聊的；adv. 平直地, 断然地；n. 扁平物, 平面, 平地, 平原, 平板车；v. (使)变平', '基础', [], [], []],
  ['flee', 'v. /fli:/', 'vt. 逃避, 逃跑, 逃走；vi. 逃, 消失', '基础', [], [], []],
  ['flesh', 'n. /\'fleʃ/', 'n. 肉, 肉体, 肉欲, 人性, 亲属, 人类, 众生, 人体；vt. 以肉喂, 激起...的杀戳情绪, 使肥, 赋以血肉；vi. 长胖', '基础', [], [], []],
  ['flexible', 'adj. /\'fleksәbl/', 'a. 易曲的, 灵活的, 柔顺的, 能变形的, 可通融的；[医] 能屈的', '基础', [], [], []],
  ['flight', 'n. /flait/', 'n. 飞行, 射程, 逃走, 飞跃, 飞机航程, 班机, 迁徙, 飞逝；vi. 迁徙；vt. 射击(飞禽), 为(箭)装上羽毛, 使惊飞', '基础', [], [], []],
  ['float', 'vi. /flәut/', 'n. 漂流物, 浮舟, 漂浮, 浮萍, 彩车；vi. 浮动, 飘动, 散播, 摇摆, 动摇, 浮动；vt. 使漂浮, 容纳, 淹没, 发行, 实行；[计] 浮动', '基础', [], [], []],
  ['flood', 'n. vt. /flʌd/', 'n. 洪水, 大量之水, 涨潮；vt. 淹没, 使泛滥, 注满；vi. 被淹, 溢出, 涌进', '基础', [], [], []],
  ['floor', 'n. /flɒ:/', 'n. 地板, 楼层, 底部, 底价；vt. 铺地板, 打倒；n. 地面, 地板, 基底；[计] 基底', '基础', [], [], []],
  ['flour', 'n. /\'flauә/', 'n. 面粉, 粉沫, 碎粉；[医] 面粉, 麦粉', '基础', [], [], []],
  ['flow', 'vi. /flәu/', 'n. 流程, 流动, 流量, 洋溢, 泛滥, 涨潮；vi. 流动, 流泄, 畅流, 川流不息, 飘扬, 涌出；vt. 使流动, 淹没, 流出', '基础', [], [], []],
  ['flower', 'n. /\'flauә/', 'n. 花, 开花植物, 精华, 盛时；vi. 开花, 发育, 旺盛, 成熟；vt. 用花装饰, 使开花', '基础', [], [], []],
  ['flu', 'n. /flu:/', 'n. 流感, 流行性感冒', '基础', [], [], []],
  ['fluency', 'n. /\'flu:әnsi/', 'n. 流畅, 雄辩, 善辩', '基础', [], [], []],
  ['fluent', 'adj. /\'flu:әnt/', '（外语）流利的，流畅的', '基础', [], [], []],
  ['fly', 'n. vi. vt. /flai/', 'n. 苍蝇, 两翼昆虫, 飞行；vi. 飞, 飞翔, 飘扬, 逃走；vt. 飞, 飞越, 使飘扬, 逃出；a. 敏捷的', '基础', [], [], []],
  ['focus', 'v. & n. /\'fәukәs/', 'n. 焦点, 焦距；vi. 聚焦, 注视；vt. 使聚焦, 调焦, 集中；[计] 焦点', '基础', [], [], []],
  ['fog', 'n. /fɒg/', 'n. 雾, 迷惑, (割后的)最生草, 苔藓；vi. 被雾笼罩, 变模糊；vt. 使困惑, 以雾笼罩', '基础', [], [], []],
  ['foggy', 'adj. /\'fɒgi/', 'a. 雾深的, 模糊的', '基础', [], [], []],
  ['fold', 'vt. /fәuld/', 'n. 折层, 折, 羊栏, 折痕, 信徒；vt. 折叠, 包, 合拢, 交迭；vi. 折叠起来, 彻底失败；[计] 折叠; 合并', '基础', [], [], []],
  ['folk', 'adj. /fәuk/', 'n. 人们, 家人, 亲属, 民族；a. 民间的', '基础', [], [], []],
  ['follow', 'vt. /\'fɒlәu/', 'vt. 跟随, 沿行, 遵循, 追求；vi. 跟随, 接着；n. 跟随, 追随', '基础', [], [], []],
  ['following', 'adj. /\'fɒlәuiŋ/', 'n. 下列各项, 部下, 追随者；a. 下列的, 其次的', '基础', [], [], []],
  ['fond', 'adj. /fɒnd/', 'a. 喜欢的, 宠爱的, 温柔的', '基础', [], [], []],
  ['food', 'n. /fu:d/', 'n. 食物, 养料；[医] 食物, 食品', '基础', [], [], []],
  ['fool', 'n. /fu:l/', 'n. 愚人, 受骗者, 奶油拌水果；vt. 愚弄, 欺骗, 浪费；vi. 干傻事, 开玩笑, 游荡；a. 傻的', '基础', [], [], []],
  ['foolish', 'adj. /\'fu:liʃ/', 'a. 愚蠢的, 傻的', '基础', [], [], []],
  ['foot', 'n. /fut/', 'n. 脚, 步调, 英尺, 底部, 末尾, 步兵；vt. 走在...上, 给...换底, 支付；vi. 跳舞, 步行, 总计', '基础', [], [], []],
  ['football', 'n. /\'futbɒ:l/', '（英式）足球；（美式）橄榄球', '基础', [], [], []],
  ['for', 'prep. conj. /fɒ:/', 'prep. 为, 因为, 至于；conj. 因为；[计] DOS批处理命令:对一组参数重复执行指定的命令', '基础', [], [], []],
  ['forbid', 'vt. /fә\'bid/', 'vt. 禁止, 不准, 妨碍；[法] 不许, 禁止, 阻止', '基础', [], [], []],
  ['force', 'vt. /fɒ:s/', 'n. 力量, 武力, 势力, 影响力, 军队, 力, 效力；vt. 强迫, 强夺, 推动, 提高；[计] 人工转移; 强制', '基础', [], [], []],
  ['forecast', 'n. & vt. /\'fɒ:kɑ:st/', 'n. 预想, 预测, 预报；vt. 预想, 预测, 预报；[计] 趋势预测', '基础', [], [], []],
  ['forehead', 'n. /\'fɒ:rid/', 'n. 额, 前额, 前部；[医] 额', '基础', [], [], []],
  ['foreign', 'adj. /\'fɒ:rin/', 'a. 外国的, 外交的, 外省的, 外来的, 不相关的；[机] 外来的', '基础', [], [], []],
  ['foreigner', 'n. /\'fɒ:rinә/', 'n. 外国人, 外地人；[法] 外国人, 进口货, 外国货', '基础', [], [], []],
  ['foresee', 'vt. /fɒ:\'si:/', 'vt. 预见, 预知', '基础', [], [], []],
  ['forest', 'n. /\'fɒrist/', 'n. 森林, 林区；vt. 植树于', '基础', [], [], []],
  ['forever', 'adv. /fә\'revә/', 'adv. 永远', '基础', [], [], []],
  ['forget', 'v. /fә\'get/', 'vt. 忘记, 忽略, 忘；vi. 忘记', '基础', [], [], []],
  ['forgetful', 'adj. /fә\'getful/', 'a. 健忘的, 易忘的', '基础', [], [], []],
  ['forgive', 'vt. /fә\'giv/', 'vt. 原谅, 宽恕, 免除；[法] 免除, 宽恕, 原谅', '基础', [], [], []],
  ['fork', 'n. /fɒ:k/', 'n. 叉子, 叉状物, 分岔；vi. 分支, 分歧；vt. 做成叉形, 叉起；[计] 派生指令', '基础', [], [], []],
  ['form', 'n. /fɒ:m/', 'n. 形状, 形体, 类型, 方式, 表格, 形式；v. 形成, 排列, (使)组成；n. 表单；[计] 表单', '基础', [], [], []],
  ['format', 'n. /\'fɒ:mæt/', 'n. 开本, 版式, 形式, 格式；vt. 格式化；[计] 格式; DOS外部命令:对磁盘进行格式化', '基础', [], [], []],
  ['former', 'adj. /\'fɒ:mә/', 'a. 从前的, 前者的；n. 起形成作用的人(或物), 模型, 样板', '基础', [], [], []],
  ['fortnight', 'n. /\'fɒ:tnait/', '十四日，两星期', '基础', [], [], []],
  ['fortunate', 'adj. /\'fɒ:tʃәnit/', 'a. 幸运的, 幸福的', '基础', [], [], []],
  ['fortune', 'n. /\'fɒ:tʃәn/', 'n. 财富, 运气, 兴隆, 大量财产, 好运, 命运；[法] 命运, 财产, 大量财产', '基础', [], [], []],
  ['forty', 'num. /\'fɒ:ti/', 'num. 四十, 四十个', '基础', [], [], []],
  ['forward', 'adv. /\'fɒ:wәd/', 'a. 向前的, 早的, 迅速的, 在前的, 进步的；vt. 促进...的生长, 转寄, 运送；adv. 向前地；[计] 前推, 转信', '基础', [], [], []],
  ['found', 'vt. /faund/', 'vt. 建立, 创立, 铸造；find的过去式和过去分词', '基础', [], [], []],
  ['founding', 'n. /\'faundiŋ/', '[计] 铸造', '基础', [], [], []],
  ['fountain', 'n. /\'fauntin/', 'n. 水源, 源, 喷泉, 泉水, 本源；[医] 泉', '基础', [], [], []],
  ['four', 'num. /fɒ:/', 'num. 四, 四个；[机] 四冲程循环', '基础', [], [], []],
  ['fourteen', 'num. /\'fɒ:\'ti:n/', 'num. 十四, 十四个', '基础', [], [], []],
  ['fourth', 'num. /fɒ:θ/', 'num. 第四, 四分之一', '基础', [], [], []],
  ['fox', 'n. /fɒks/', 'n. 狐狸, 狡猾的人；vi. 奸狡地行动, (书页)生斑, 变酸；vt. 欺骗, 使变酸, 为(鞋等)换面, 使生黄斑', '基础', [], [], []],
  ['fragile', 'adj. /\'frædʒail/', 'a. 易碎的, 脆的；[医] 脆弱的, 脆的', '基础', [], [], []],
  ['fragrant', 'adj. /\'freigrәnt/', 'a. 芬香的, 馥郁的, 愉快的', '基础', [], [], []],
  ['framework', 'n. /\'freimwә:k/', 'n. 结构, 骨架, 参照标准, 准则, 观点；[医] 构架组织', '基础', [], [], []],
  ['franc', 'n. /fræŋk/', 'n. 法郎', '基础', [], [], []],
  ['France', 'n.', '法国', '基础', [], [], []],
  ['free', 'adj. /fri:/', 'a. 自由的, 享受政治权力的, 允许的, 免费的, 丰富的；vt. 释放, 解放, 使自由；adv. 自由地, 免费', '基础', [], [], []],
  ['freedom', 'n. /\'fri:dәm/', 'n. 自由, 坦率, 特权；[法] 自由, 自主, 免除', '基础', [], [], []],
  ['freeway', 'n. /\'fri:wei/', 'n. 高速公路', '基础', [], [], []],
  ['freeze', 'vi. /fri:z/', 'vi. 冻结, 冷冻, 僵硬, 楞住；vt. 使结冰, 使冻住, 使呆住；n. 结冰, 凝固；[计] 冻结', '基础', [], [], []],
  ['freezing', 'adj. /\'fri:ziŋ/', 'a. 冰冻的, 冷冻用的, 严寒的；[化] 冻结; 冻结作用; 凝固; 凝固作用', '基础', [], [], []],
  ['French', 'adj. n. /frentʃ/', 'n. 法国人, 法文, 法式；a. 法国的, 法国人的, 法语的', '基础', [], [], []],
  ['Frenchman', 'n. /\'frentʃmәn/', '法国人（男）（复 Frenchmen）', '基础', [], [], []],
  ['frequent', 'adj. /\'fri:kwәnt/', 'a. 时常发生的, 频繁的, 快速的；vt. 时常来访, 常常聚集, 常与...交往', '基础', [], [], []],
  ['fresh', 'adj. /freʃ/', 'a. 新鲜的, 新奇的, 另外的, 淡的, 精神饱满的, 冒失的；adv. 最新地, 刚刚；n. 开始, 泛滥', '基础', [], [], []],
  ['friction', 'n. /\'frikʃәn/', 'n. 摩擦, 摩擦治疗, 不和；[医] 摩擦', '基础', [], [], []],
  ['Friday', 'n. /\'fraidi/', 'n. 星期五', '基础', [], [], []],
  ['fridge', 'n.', '冰箱', '基础', [], [], []],
  ['fried', 'adj. /fraid/', 'a. 油炸的', '基础', [], [], []],
  ['friend', 'n. /frend/', 'n. 朋友, 支持者, 赞助者；[法] 朋友, 友人, 赞助者', '基础', [], [], []],
  ['friendly', 'adj. /\'frendli/', 'a. 友好的, 亲切的, 互助的；adv. 友善地, 温和地', '基础', [], [], []],
  ['friendship', 'n. /\'frendʃip/', 'n. 友谊, 友爱, 友善', '基础', [], [], []],
  ['fright', 'n. /frait/', 'n. 惊骇, 吃惊；[医] 惊吓', '基础', [], [], []],
  ['frighten', 'vt. /\'fraitn/', 'vt. 使惊吓；vi. 惊恐', '基础', [], [], []],
  ['frog', 'n. /frɒg/', 'n. 青蛙；[医] 蛙, 马蹄叉', '基础', [], [], []],
  ['from', 'prep. /frɒm/', 'prep. 从, 来自, 根据', '基础', [], [], []],
  ['front', 'adj. n. /frʌnt/', 'n. 前面, 开头, 前线, 阵线, 态度；vt. 面对, 朝向, 对抗；vi. 朝向', '基础', [], [], []],
  ['frontier', 'n. /\'frʌntjә/', 'n. 边界, 边境；[法] 国境, 边境, 边界', '基础', [], [], []],
  ['frost', 'n. /frɒst/', 'n. 霜, 冰冻, 冷漠；vt. 覆着霜, 冻结, 结霜；vi. 受冻, 起霜', '基础', [], [], []],
  ['fruit', 'n. /fru:t/', 'n. 水果, 果类, 结果；[医] 果实, 种实', '基础', [], [], []],
  ['fruit juice', 'n.', '果汁', '基础', [], [], []],
  ['fry', 'vt. /frai/', 'n. 油炸食物, 鱼苗；v. 油炸, 煎', '基础', [], [], []],
  ['fuel', 'n. /\'fjuәl/', 'n. 燃料, 木炭；vt. 加燃料, 供燃料；vi. 得到燃料', '基础', [], [], []],
  ['full', 'adj. /ful/', 'n. 全部, 完整；a. 充满的, 完全的, 丰富的, 完美的, 丰满的, 详尽的；adv. 完全地, 整整, 十分；vt. 把(衣服等)缝得宽松, 漂洗；[计] 完整', '基础', [], [], []],
  ['fun', 'n. /fʌn/', 'n. 乐趣, 玩笑, 娱乐；vi. 开玩笑；a. 供娱乐用的', '基础', [], [], []],
  ['function', 'n. & v. /\'fʌŋkʃәn/', 'n. 官能, 职务, 功能, 函数；vi. 活动, 运行, 行使职责；[计] 功能, 函数', '基础', [], [], []],
  ['fundamental', 'adj. /.fʌndә\'mentәl/', 'n. 基本原理, 原则, 基波；a. 基本的, 重要的, 原音的', '基础', [], [], []],
  ['funeral', 'n. /\'fju:nәrәl/', 'n. 葬礼, 出殡', '基础', [], [], []],
  ['funny', 'adj. /\'fʌni/', 'a. 好笑的, 有趣的, 滑稽的；n. 滑稽人物', '基础', [], [], []],
  ['fur', 'n. /fә:/', 'n. 毛皮；vt. 以毛皮制作, 使生苔, 使生水垢；vi. 生苔, 积水垢', '基础', [], [], []],
  ['furnished', 'adj.', 'a. 家具, 有家具的', '基础', [], [], []],
  ['furniture', 'n. /\'fәnitʃә/', 'n. 家具, 帆具', '基础', [], [], []],
  ['future', 'n. /\'fju:tʃә/', 'n. 未来, 将来；a. 将来的, 未来的', '基础', [], [], []],
  ['gain', 'vt. /gein/', 'n. 增益, 获得, 利润, 收获, 增加；vt. 得到, 增进, 赚到；vi. 获利, 增加；[计] 增益', '基础', [], [], []],
  ['gallery', 'n. /\'gælәri/', 'n. 走廊, 最高楼座, 画廊, 收集, 图库；[计] 图库', '基础', [], [], []],
  ['gallon', 'n. /\'gælәn/', 'n. 加仑；[医] 加仑', '基础', [], [], []],
  ['game', 'n. /geim/', 'n. 比赛, 玩耍, 比分, 得胜, 比赛规则, 策略, 游戏, 野味；vi. 赌博；a. 勇敢的, 有胆量的, 关于野味的, 跛的；[计] 博弈; 对策', '基础', [], [], []],
  ['garage', 'n. /gә\'rɑ:ʒ. \'gærɑ:ʒ/', 'n. 车库, 汽车修理厂, 机库；vt. 把车送入修车场', '基础', [], [], []],
  ['garbage', 'n. /\'gɑ:bidʒ/', 'n. 垃圾, 废物；[计] 无用信息', '基础', [], [], []],
  ['garden', 'n. /\'gɑ:dn/', 'n. 花园, 果园, 菜园；vi. 栽培花木；vt. 造园；a. 花园的, 普通的', '基础', [], [], []],
  ['gardening', 'n. /\'gɑ:dniŋ/', 'n. 园艺(学)', '基础', [], [], []],
  ['garment', 'n. /\'gɑ:mәnt/', 'n. 衣服, 衣装, 外表', '基础', [], [], []],
  ['gas', 'n. /gæs/', 'n. 气体, 汽油, 瓦斯；[化] 气体; 煤气; 瓦斯; 毒气', '基础', [], [], []],
  ['gate', 'n. /geit/', 'n. 门, 牌楼, 大门, 通道, 闸；vt. 装门于；[计] 门; 栅', '基础', [], [], []],
  ['gather', 'v. /\'gæðә/', 'n. 集合, 聚集；vi. 聚集, 集合, 渐增；vt. 使聚集, 搜集, 积聚', '基础', [], [], []],
  ['gay', 'adj. /gei/', 'a. 欢快的, 艳丽的, 快乐的, 放荡的', '基础', [], [], []],
  ['general', 'adj. n. /\'dʒenәrәl/', 'n. 一般, 将军, 大体；a. 全面的, 大体的, 总的, 一般的, 普遍的；n. 常规；[计] 常规', '基础', [], [], []],
  ['generation', 'n. /.dʒenә\'reiʃәn/', 'n. 一代, 一世, 产生；[医] 生殖, 世代', '基础', [], [], []],
  ['generous', 'adj. /\'dʒenәrәs/', 'a. 慷慨的, 有雅量的, 大量的, 丰富的', '基础', [], [], []],
  ['gentle', 'adj. /\'dʒentl/', 'a. 温和的, 文雅的', '基础', [], [], []],
  ['gentleman', 'n. /\'dʒentlmәn/', '绅士，先生；有身份、有教养的人', '基础', [], [], []],
  ['geography', 'n. /dʒi\'ɒgrәfi/', 'n. 地理学, 地理；[医] 地理', '基础', [], [], []],
  ['geometry', 'n. /dʒi\'ɒmәtri/', 'n. 几何学；[机] 几何学', '基础', [], [], []],
  ['German', 'adj. n. /\'dʒә:mәn/', 'n. 德国人, 德语；a. 德国的, 德国人的, 德国语的, 同父母的', '基础', [], [], []],
  ['Germany', 'n. /\'dʒә:mәni/', 'n. 德国', '基础', [], [], []],
  ['gesture', 'n. /\'dʒestʃә/', 'n. 手势, 姿态；vi. 作手势, 作姿态', '基础', [], [], []],
  ['get', 'vt. /get/', 'vt. 得到, 获得, 变成, 使得, 收获, 接通, 抓住, 染上；vi. 到达, 成为, 变得；n. (网球等)救球, 生殖, 幼兽；[计] 取得指令, 获取文件', '基础', [], [], []],
  ['get-together', 'n.', '聚会', '基础', [], [], []],
  ['gift', 'n. /gift/', 'n. 礼物, 赠予, 天才；vt. 赋予', '基础', [], [], []],
  ['gifted', 'adj. /\'giftid/', '有天赋的；有才华的', '基础', [], [], []],
  ['giraffe', 'n. /dʒi\'rɑ:f/', 'n. 长颈鹿, 鹿豹座', '基础', [], [], []],
  ['girl', 'n. /gә:l/', 'n. 女孩, 少女, 女佣', '基础', [], [], []],
  ['give', 'vt. /giv/', 'n. 弹性, 适应性；vt. 给, 授予, 供给, 产生, 发表, 付出, 献出, 让出；vi. 捐赠, 支持不住, 让步', '基础', [], [], []],
  ['glad', 'adj. /glæd/', 'a. 高兴的, 喜欢的, 情愿的', '基础', [], [], []],
  ['glance', 'vi. /\'glɑ:ns/', 'n. 一瞥, 闪光, 掠过, 辉矿类；vi. 扫视, 闪光, 掠过, 提到, 略说；vt. 扫视, 反射, 使掠过', '基础', [], [], []],
  ['glare', 'v. /glєә/', 'n. 闪耀光, 刺眼；vi. 发眩光, 瞪视；vt. 瞪眼表示', '基础', [], [], []],
  ['glass', 'n. /glɑ:s/', 'n. 玻璃, 玻璃杯, 透镜；vt. 装玻璃于, 反射, 反映；vi. 成玻璃状', '基础', [], [], []],
  ['globe', 'n. /glәub/', 'n. 球, 球状物, 地球仪, 天体；v. (使)成球状', '基础', [], [], []],
  ['glory', 'n. /\'glɒ:ri/', 'n. 光荣, 荣耀, 荣誉, 壮丽, 繁荣；vi. 自豪', '基础', [], [], []],
  ['glove', 'n. /glʌv/', 'n. 手套；vt. 给...戴手套', '基础', [], [], []],
  ['glue', 'n. /glu:/', 'n. 胶, 粘性物；vt. 粘合, 胶合', '基础', [], [], []],
  ['go', 'vi. n. /gou/', 'vi. 去, 走, 达到, 运转, 查阅, 消失, 结束, 放弃, 花费, 流传, 趋于, 打算, 剩下；vt. 以...打赌, 对付, 忍受, 出产, 为被捕者出(保释金)；n. 去, 尝试, 进行', '基础', [], [], []],
  ['goal', 'n. /gәul/', 'n. 目标, 终点, 得分, 球门, 守门员；vi. 攻门, 射门得分', '基础', [], [], []],
  ['goat', 'n. /gәut/', 'n. 山羊, 替罪羊, 色鬼', '基础', [], [], []],
  ['god', 'n.', '神，（大写）上帝', '基础', [], [], []],
  ['gold', 'n. adj. /gәuld/', 'n. 黄金, 钱财, 金块, 金色, 宝贵；a. 金的, 似金的, 金色的, 金制的', '基础', [], [], []],
  ['golden', 'adj. /\'gәuldn/', 'a. 金的, 含金的, 金色的, 贵重的, 繁盛的；[法] 金制的, 金色的, 兴隆的', '基础', [], [], []],
  ['goldfish', 'n. /\'gәuldfiʃ/', 'n. 金鱼', '基础', [], [], []],
  ['golf', 'n. /gɒlf/', 'n. 高尔夫球；vi. 打高尔夫球', '基础', [], [], []],
  ['good', 'adj. /gud/', 'n. 善行, 好处, 利益；a. 好的, 优良的, 上等的, 愉快的, 有益的, 好心的, 慈善的, 虔诚的', '基础', [], [], []],
  ['good-bye', 'int.', '再见；再会', '基础', [], [], []],
  ['goodness', 'n. /\'gudnis/', 'n. 仁慈, 善良', '基础', [], [], []],
  ['goods', 'n. /guds/', 'n. 货物；[经] 货物, 商品, 动产', '基础', [], [], []],
  ['goose', 'n. /gu:s/', 'n. 鹅, 雌鹅, 鹅肉, 弯把熨斗；vt. 与...性交, 突然加大油门, 使生色, 喝倒彩', '基础', [], [], []],
  ['govern', 'v. /\'gʌvәn/', 'v. 统治, 支配, 管理', '基础', [], [], []],
  ['government', 'n. /\'gʌvәnmәnt/', 'n. 政府, 内阁；[经] 政府, 政治, 政体', '基础', [], [], []],
  ['gown', 'n. /gaun/', 'n. 睡衣, 法衣, 大学全体师生；vt. 使穿睡衣', '基础', [], [], []],
  ['grade', 'n. /greid/', 'n. 等级, 年级, 阶段, 成绩, 程度, 坡度, 斜坡；vt. 分等, 分级, 评分；vi. 属于某等级, 逐渐变化', '基础', [], [], []],
  ['gradually', 'adv. /\'grædʒuәli/', 'adv. 逐渐地', '基础', [], [], []],
  ['graduate', 'v. /\'grædʒueit/', 'n. 毕业生, 量杯；a. 已得学位的, 研究生的, 毕业的；vi. 毕业, 得学位, 逐渐变为；vt. 准予...毕业, 授予...学位, 分等级, 刻刻度', '基础', [], [], []],
  ['graduation', 'n. /.grædʒu\'eiʃәn/', 'n. 毕业, 得学位, 分划, 刻度, 分等级；[医] 刻度, 分度, 毕业', '基础', [], [], []],
  ['grain', 'n. /grein/', 'n. 谷粒, 颗粒, 谷类, 纹理, 本质；v. (使)成谷粒', '基础', [], [], []],
  ['gram', 'n. /græm/', 'n. 克, 绿豆, 鹰嘴豆；[医] 克', '基础', [], [], []],
  ['grammar', 'n. /\'græmә/', 'n. 语法学, 入门书；[计] 语法检查', '基础', [], [], []],
  ['grand', 'adj. /grænd/', 'a. 庄重的, 壮观的, 显赫的, 重大的, 最高的, 雄伟的, 宏大的, 豪华的, 傲慢的；[法] 重大的, 主要的, 伟大的', '基础', [], [], []],
  ['grandchild', 'n. /\'^rændtʃaild/', 'n. 孙, 外孙女, 外孙, 孙女, 孙子', '基础', [], [], []],
  ['granddaughter', 'n. /\'^rændɔ:tә(r)/', 'n. 孙女, 外孙女', '基础', [], [], []],
  ['grandma', 'n.', '奶奶；外婆', '基础', [], [], []],
  ['grandpa', 'n.', '爷爷，外公', '基础', [], [], []],
  ['grandparents', 'n.', 'n. 外祖父母；祖父母（grandparent的复数）', '基础', [], [], []],
  ['grandson', 'n. /\'grændsʌn/', 'n. 孙子, 外孙', '基础', [], [], []],
  ['granny', 'n. /\'^ræni/', 'n. 奶奶, 老奶奶, 老婆婆, 外婆, 婆婆妈妈的人, 唠叨挑剔的人, 接生婆', '基础', [], [], []],
  ['grape', 'n. /greip/', 'n. 葡萄, 葡萄树；[医] 葡萄', '基础', [], [], []],
  ['graph', 'n. /græf/', 'n. 曲线图, 图表, 图形；[计] 图形', '基础', [], [], []],
  ['grasp', 'v. /græsp/', 'n. 把握, 抓紧, 理解, 抓, 柄, 控制；vt. 抓住, 紧握, 领会；vi. 抓', '基础', [], [], []],
  ['grass', 'n. /græs/', 'n. 草, 草原, 牧场；[医] 草, 禾本', '基础', [], [], []],
  ['grateful', 'adj. /\'greitful/', 'a. 感谢的, 感激的, 令人快意的, 受欢迎的', '基础', [], [], []],
  ['gravity', 'n. /\'græviti/', 'n. 地心引力, 重力；[化] 重力', '基础', [], [], []],
  ['great', 'adj. adv. /greit/', 'a. 大的, 非常的, 主要的, 重大的, 崇高的, 伟大的；adv. 顺利地, 得意地；n. 全部, 大人物, 大师', '基础', [], [], []],
  ['Greece', 'n. /gri:s/', 'n. 希腊', '基础', [], [], []],
  ['greedy', 'adj. /\'gri:di/', 'a. 贪婪的, 贪得的, 贪吃的', '基础', [], [], []],
  ['Greek', 'adj. & n. /gri:k/', 'n. 希腊人, 希腊语；a. 希腊的, 希腊人的；[计] 希腊', '基础', [], [], []],
  ['green', 'adj. n. /gri:n/', 'n. 绿色, 绿色颜料；a. 绿色的, 未成熟的, 新鲜的, 青春的, 无经验的, 脸色发青的', '基础', [], [], []],
  ['greengrocer', 'n. /\'gri:ngrәusә/', 'n. 蔬菜水果商, 菜贩', '基础', [], [], []],
  ['greet', 'vt. /gri:t/', 'vt. 问候, 致敬, 欢迎, 映入眼帘', '基础', [], [], []],
  ['greeting', 'n. /\'gri:tiŋ/', '问候，招呼；（复）问候，祝贺', '基础', [], [], []],
  ['grey', 'adj.', '灰色的；灰白的', '基础', [], [], []],
  ['grocer', 'n. /\'grәusә/', '零售商人；食品店', '基础', [], [], []],
  ['ground', 'n. /graund/', 'n. 土地, 战场, 场地, 地面, 范围；a. 土地的, 地面上的；vt. 放在地上, 使搁浅, 打基础, 给...以训练；vi. 搁浅, 落地, 根据, 基于；a. 磨过的；grind的过去式和过去分词', '基础', [], [], []],
  ['group', 'n. /gru:p/', 'n. 团体, 组, 团, 群；v. 聚合, 成群；[计] 创建组; 组, 用户组', '基础', [], [], []],
  ['grow', 'v. /grәu/', 'vt. 种植, 使长满；vi. 生长, 变成, 发展', '基础', [], [], []],
  ['growth', 'n. /grәuθ/', 'n. 生长, 栽培, 增长；[计] 等比级数', '基础', [], [], []],
  ['guarantee', 'v. & n. /.gærәn\'ti:/', 'n. 担保, 抵押品, 保证书；vt. 保证, 担保', '基础', [], [], []],
  ['guard', 'vt. & vi. n. /gɑ:d/', 'n. 守卫者, 警戒, 护卫队, 防护装置；vt. 保卫, 看守, 当心；vi. 防止, 警惕, 警卫, 看守', '基础', [], [], []],
  ['guess', 'vt. & vi. /ges/', 'n. 猜测, 臆测；v. 猜测, 臆测', '基础', [], [], []],
  ['guest', 'n. /gest/', 'n. 客人, 来宾, 旅客；[化] 客体', '基础', [], [], []],
  ['guidance', 'n. /\'gaidns/', 'n. 指导, 领导；[医] 导', '基础', [], [], []],
  ['guide', 'vt. n. /gaid/', 'n. 引导者, 导游, 指南, 路标；vt. 指导, 支配, 管理, 带领, 操纵；vi. 任向导；[计] 辅助线', '基础', [], [], []],
  ['guilty', 'adj. /\'gilti/', 'a. 犯罪的, 有过失的, 自觉有错的, 心虚的；[法] 有罪的, 犯罪的, 自觉有罪的', '基础', [], [], []],
  ['guitar', 'n. /gi\'tɑ:/', '吉他，六弦琴', '基础', [], [], []],
  ['gun', 'n. vt. /gʌn/', 'n. 枪；[医] 枪', '基础', [], [], []],
  ['guy', 'n.', '家伙，伙计', '基础', [], [], []],
  ['gym', 'n.', '体操；体育馆；健身房', '基础', [], [], []],
  ['gymnastics', 'n. /dʒim\'næstiks/', 'n. 体操, 体育；[医] 体操, 体育', '基础', [], [], []],
  ['habit', 'n. /\'hæbit/', 'n. 习惯, 嗜好, 习性；vt. 使穿衣', '基础', [], [], []],
  ['hair', 'n. /hєә/', 'n. 头发, 毛发, 些微；[医] 毛, 发', '基础', [], [], []],
  ['haircut', 'n. /\'hєәkʌt/', 'n. 理发, (男子的)发式', '基础', [], [], []],
  ['half', 'adj. adv. n. /hɑ:f/', 'n. 一半, 半场, 不完全；a. 一半的, 不完全的, 部分的, 半场的；adv. 一半地, 部分地, 在某种程度上地, 几乎', '基础', [], [], []],
  ['hall', 'n. /hɒ:l/', 'n. 门厅, 走廊, 会堂', '基础', [], [], []],
  ['ham', 'n. /hæm/', 'n. 火腿, 后腿, 笨拙演员；a. 过火的, 做作的；v. 演得过火', '基础', [], [], []],
  ['hamburger', 'n. /\'hæmbә:gә/', 'n. 汉堡(德国港口), 肉饼, 汉堡包, 纯精牛肉, 汉堡牛排', '基础', [], [], []],
  ['hammer', 'n. vt. & vi. /\'hæmә/', 'n. 锤, 铁锤, 钉锤；vt. 锤打, 敲打, 钉；vi. 连续锤打；[计] 锤头', '基础', [], [], []],
  ['hand', 'n. v. /hænd/', 'n. 手, 爪, 指针, 掌握, 协助, 人手, 手艺, 手迹, 支配, 插手；vt. 交给, 支持, 搀扶', '基础', [], [], []],
  ['handbag', 'n. /\'hændbæg/', '女用皮包，手提包', '基础', [], [], []],
  ['handful', 'n. /\'hændful/', 'n. 少数, 一把, 棘手事', '基础', [], [], []],
  ['handkerchief', 'n. /\'hæŋkәtʃif/', 'n. 手帕, 头巾, 围巾', '基础', [], [], []],
  ['handle', 'n. vt. vi. /hændl/', 'n. 柄, 把手, 把柄, 柄状物, 手感；vt. 触摸, 运用, 买卖, 处理, 操作；vi. 搬运, 易于操纵；n. 句柄；[计] 句柄', '基础', [], [], []],
  ['handsome', 'adj. /\'hænsәm/', 'a. 英俊的, 大方的, 慷慨的, 相当可观的, 美观的, 灵敏的', '基础', [], [], []],
  ['handwriting', 'n. /\'hændraitiŋ/', 'n. 笔迹', '基础', [], [], []],
  ['handy', 'adj. /\'hændi/', 'a. 便利的, 敏捷的, 容易取得的；[化] 便于使用的; 易操作的', '基础', [], [], []],
  ['hang', 'vt. & vi. /hæŋ/', 'n. 悬挂, 诀窍, 意义；vt. 悬挂, 附着, 装饰, 垂下, 踌躇, 绞死, 使悬而未决；vi. 悬着, 垂下, 被绞死, 悬而不决', '基础', [], [], []],
  ['happen', 'vi. /\'hæpәn/', 'vi. 发生, 发生, 恰巧', '基础', [], [], []],
  ['happily', 'adv. /\'hæpili/', 'adv. 幸福地, 快乐地, 幸好', '基础', [], [], []],
  ['happiness', 'n. /\'hæpinis/', 'n. 快乐, 幸运, 适当', '基础', [], [], []],
  ['happy', 'adj. /\'hæpi/', 'a. 快乐的, 幸福的, 愉快的, 恰当的', '基础', [], [], []],
  ['harbour', 'n. /\'hɑ:bә/', 'n. 港, 避难所；v. 庇护, 藏匿, (使)入港停泊', '基础', [], [], []],
  ['hard', 'adj. adv. /hɑ:d/', 'a. 坚硬的, 硬的, 难的, 艰苦的, 困难的, 坚固的, 猛烈的, 艰难的, 结实的, 确实的；adv. 坚硬地, 努力地, 辛苦地, 接近地, 猛烈地, 牢固地', '基础', [], [], []],
  ['hardly', 'adv. /\'hɑ:dli/', 'adv. 刚刚, 几乎不, 勉强是', '基础', [], [], []],
  ['hardship', 'n. /\'hɑ:dʃip/', 'n. 艰难, 辛苦, 苦难；[法] 受苦, 吃苦, 苦难', '基础', [], [], []],
  ['hardworking', 'adj. /\'hɑ:d.wә:kiŋ/', 'a. 苦干的, 不辞辛劳的', '基础', [], [], []],
  ['harm', 'n. & v. /hɑ:m/', 'n. 伤害, 害处；vt. 伤害, 损害', '基础', [], [], []],
  ['harmful', 'adj. /\'hɑ:mful/', 'a. 有害的, 伤害的', '基础', [], [], []],
  ['harmless', 'adj. /\'hɑ:mlis/', 'a. 无害处的, 未受损害的, 无辜的, 无恶意的；[法] 无害的, 无恶意的, 无损害的', '基础', [], [], []],
  ['harmonious', 'adj.', '和睦的；协调的', '基础', [], [], []],
  ['harmony', 'n. /\'hɑ:mәni/', 'n. 协调, 和睦, 调和；[电] 和声学', '基础', [], [], []],
  ['harvest', 'n. & v. /\'hɑ:vist/', 'n. 收获, 成果, 收获物, 收获期；v. 收割, 收获', '基础', [], [], []],
  ['hat', 'n. /hæt/', 'n. 帽子；vt. 给...戴帽子', '基础', [], [], []],
  ['hatch', 'v. /hætʃ/', 'n. 孵化, 舱口；vt. 孵, 孵出, 策划；vi. 孵化', '基础', [], [], []],
  ['hate', 'vt. & n. /heit/', 'n. 憎恨, 恨, 厌恶；vt. 憎恨, 憎恶；vi. 仇恨', '基础', [], [], []],
  ['have', 'vt. /hæv/', 'vt. 有, 怀有, 拿, 进行；aux. 已经', '基础', [], [], []],
  ['he', 'pron. /hi:/', 'pron. 他；n. 男孩, 男人, 雄性动物', '基础', [], [], []],
  ['head', 'n. adj. vi. /hed/', 'n. 头, 头脑, 领袖, 脑袋, 最前的部分；vt. 为首, 朝向, 前进, 用头顶；vi. 朝特定方向行进, (作物)结穗；a. 头的, 在顶端的, 主要的；[计] 磁头; 冲头', '基础', [], [], []],
  ['headache', 'n. /\'hedeik/', 'n. 头痛, 令人头痛之事；[医] 头痛', '基础', [], [], []],
  ['headline', 'n. /\'hedlain/', 'n. 大标题, 新闻摘要；vt. 为...做标题, 写标题', '基础', [], [], []],
  ['headmaster', 'n. /\'hed\'mɑ:stә/', 'n. (中小学)校长, 监工', '基础', [], [], []],
  ['health', 'n. /\'helθ/', 'n. 健康, 卫生, 蓬勃, 健康状态；[医] 健康', '基础', [], [], []],
  ['healthy', 'adj. /\'helθi/', 'a. 健康的, 有益健康的, 卫生的；[医] 健康的', '基础', [], [], []],
  ['hear', 'v. /hiә/', 'vt. 听到, 倾听, 听说, 审理；vi. 听见, 听', '基础', [], [], []],
  ['hearing', 'n. /\'hiәriŋ/', 'n. 听, 听觉, 听讯；[医] 听, 听觉', '基础', [], [], []],
  ['heart', 'n. /hɑ:t/', 'n. 心, 心脏, 中心, 内心, 感情, 精神, 心情, 宝贝儿；vt. 鼓励', '基础', [], [], []],
  ['heat', 'n. vt. & vi. /hi:t/', 'n. 热, 热度, 体温, 高潮；vi. 加热, 激昂, 加剧；vt. 把...加热, 使激动', '基础', [], [], []],
  ['heating', 'n.', '暖气装置〔设备〕', '基础', [], [], []],
  ['heaven', 'n. /\'hevn/', 'n. 天堂, 上帝, 天空', '基础', [], [], []],
  ['heavily', 'adv. /\'hevili/', 'adv. 很重地, 严重地, 难以忍受地', '基础', [], [], []],
  ['heavy', 'adj. /\'hevi/', 'a. 重的, 巨大的, 沉重的, 笨重的, 过度的；adv. 沉重地；n. 重物, 严肃角色', '基础', [], [], []],
  ['heel', 'n. /hi:l/', 'n. 脚后跟, 踵, 后部, 倾侧；vt. 尾随, 装以鞋跟, 倾侧, 追赶；vi. 紧随, 用脚后跟传球', '基础', [], [], []],
  ['height', 'n. /hait/', 'n. 高度, 海拔, 高地, 顶点；[化] 高度', '基础', [], [], []],
  ['helicopter', 'n. /\'helikɒptә/', 'n. 直升机；vt. 由直升机运送；vi. 乘直升机', '基础', [], [], []],
  ['hell', 'n.', '地狱；苦痛的境况', '基础', [], [], []],
  ['hello', 'int. /hә\'lәu/', '喂；你好（表示打招呼，问候或唤起注意）', '基础', [], [], []],
  ['helmet', 'n. /\'helmit/', 'n. 钢盔, 盔, 防护帽；vt. 给...戴头盔', '基础', [], [], []],
  ['help', 'n. & v. /help/', 'n. 帮忙, 帮助者, 补救办法, 有益的东西；vt. 帮助, 帮忙, 接济, 治疗, 款待；vi. 有用, 救命, 招待；[计] 帮助, 帮助程序; DOS外部命令: DOS命令的电子文件帮助程序', '基础', [], [], []],
  ['helpful', 'adj. /\'helpful/', 'a. 有帮助的, 有益的, 有用的', '基础', [], [], []],
  ['hen', 'n. /hen/', 'n. 母鸡, 雌禽', '基础', [], [], []],
  ['her', 'pron. /hә:/', 'pron. 她的, 她', '基础', [], [], []],
  ['herb', 'n. /hә:b/', 'n. 药草, 香草；[医] 草, 草本, 草药', '基础', [], [], []],
  ['here', 'adv. /hiә/', 'adv. 在这里, 此时, 这里；n. 这里', '基础', [], [], []],
  ['hero', 'n. /\'hiәrәu/', 'n. 英雄, 超越常人者, 男主角', '基础', [], [], []],
  ['heroine', 'n. /\'herәuin/', 'n. 巾帼英雄, 烈妇, 女主角；[化] 海洛因; 二醋吗啡; 二乙酰吗啡', '基础', [], [], []],
  ['hers', 'pron. /hә:z/', 'pron. 她的', '基础', [], [], []],
  ['herself', 'pron. /hә:\'self/', 'pron. 她自己, 她亲自', '基础', [], [], []],
  ['hesitate', 'vi. vt.', '犹豫；踌躇 不情愿；对…犹豫', '基础', [], [], []],
  ['hi', 'int. /hai/', '你好（表示打招呼、问候或唤起注意）', '基础', [], [], []],
  ['hide', 'v. /haid/', 'n. 兽皮, 迹象, 躲藏处；vt. 藏, 隐瞒, 遮避, 剥...的皮, 隐藏；vi. 躲藏；[计] 隐藏', '基础', [], [], []],
  ['high', 'adj. adv. /hai/', 'n. 高度, 高处；a. 高的, 高级的, 主要的, 高尚的, 高原的, 高音的, 昂贵的, 傲慢的；adv. 高度地, 奢侈地', '基础', [], [], []],
  ['highway', 'n. /\'haiwei/', 'n. 公路, 大道, 捷径；[法] 公路, 大路', '基础', [], [], []],
  ['hill', 'n. /hil/', 'n. 小山, 丘陵, 小土堆；vt. 作成土堆, 堆成小丘', '基础', [], [], []],
  ['hillside', 'n. /\'hilsaid/', 'n. 山坡, 山腹', '基础', [], [], []],
  ['hilly', 'adj. /\'hili/', 'a. 多丘陵的, 多山岗的, 险峻的', '基础', [], [], []],
  ['him', 'pron. /him/', 'pron. 他', '基础', [], [], []],
  ['himself', 'pron. /him\'self/', 'pron. 他自己, 他亲自', '基础', [], [], []],
  ['hire', 'vt. /haiә/', 'n. 租金, 租用, 雇用；vt. 雇请, 出租；vi. 受雇', '基础', [], [], []],
  ['his', 'pron. /hiz/', 'pron. 他的；[化] 组氨酸', '基础', [], [], []],
  ['historical', 'adj.', '历史（学）的', '基础', [], [], []],
  ['history', 'n. /\'histәri/', 'n. 历史, 过去, 经历, 发展过程, 历史学, 过去的事, 历史记录；[计] 历史记录', '基础', [], [], []],
  ['hit', 'n. & v. /hit/', 'n. 打击, 打, 冲撞, 讽刺；vt. 打, 打击, 碰撞, 打中, 袭击, 偶然碰上；vi. 打, 打中, 打击, 碰撞, 偶然碰上；[计] 击中; 找到; 瞬时打扰', '基础', [], [], []],
  ['hobby', 'n. /\'hɒbi/', 'n. 嗜好, 癖好, 爱好', '基础', [], [], []],
  ['hold', 'vt. /hәuld/', 'n. 把握, 把持力, 柄, 控制, 掌握, 监禁；vt. 保存, 握住, 拿住, 占据, 持有, 拥有；vi. 支持, 持续, 有效；n. 保留；[计] 保留', '基础', [], [], []],
  ['hole', 'n. /hәul/', 'n. 孔, 洞, 穴, 漏洞；vt. 挖洞, 掘坑；vi. 进洞, 凿洞', '基础', [], [], []],
  ['holiday', 'n. /\'hɒlәdi/', 'n. 假日, 假期, 节日；vi. 度假', '基础', [], [], []],
  ['holy', 'adj. /\'hәuli/', 'a. 神圣的, 圣洁的, 至善的；n. 神圣的东西', '基础', [], [], []],
  ['home', 'n. adv. /hәum/', 'n. 家, 避难所, 故乡；a. 家庭的, 国内的, 打中目标的；adv. 在家, 在本国, 打中目标地；[计] 返回始位', '基础', [], [], []],
  ['homeland', 'n. /\'hәumlænd/', 'n. 本国, 故国', '基础', [], [], []],
  ['hometown', 'n. /hәum\'taun/', 'n. 故乡, 家乡', '基础', [], [], []],
  ['homework', 'n. /\'hәumwә:k/', 'n. 家庭作业, 家里做的工作；[经] 家庭作业', '基础', [], [], []],
  ['honest', 'adj. /\'ɒnist/', 'a. 诚实的, 坦直的, 可靠的', '基础', [], [], []],
  ['honey', 'n. /\'hʌni/', 'n. 蜂蜜, 甜蜜, 爱人；a. 蜂蜜似的, 甜蜜的, 甘美的；vt. 加蜜使甜, 对...说甜言蜜语；vi. 说甜言蜜语, 奉承', '基础', [], [], []],
  ['honour', 'n. vt. /\'ɒnә/', 'n. 荣誉, 头衔, 信用, 尊敬, 名誉, 阁下, 勋章；vt. 尊敬, 授予荣誉, 承兑, 实践', '基础', [], [], []],
  ['hook', 'n. & v. /huk/', 'n. 钩, 钩状, 镰刀, 陷阱；vt. 挂...于钩上, 钩住, 引上钩, 偷窃；vi. 弯成钩状, 钩紧；[计] 钩', '基础', [], [], []],
  ['hope', 'n. & v. /hәup/', 'n. 希望, 信心, 期待；v. 希望, 期望, 信赖', '基础', [], [], []],
  ['hopeful', 'adj. /\'hәupful/', 'n. 有希望之人, 有前途之人；a. 有希望的, 怀抱希望的, 保持乐观的', '基础', [], [], []],
  ['hopeless', 'adj. /\'hәuplis/', 'a. 无希望的, 绝望的, 不可救药的', '基础', [], [], []],
  ['horrible', 'adj. /\'hɒrәbl/', 'a. 可怕的, 遭透的, 极讨厌的', '基础', [], [], []],
  ['horse', 'n. /hɒ:s/', 'n. 马, 骑兵, 脚架；vi. 骑马, 取笑；vt. 使骑马, 系马于', '基础', [], [], []],
  ['hospital', 'n. /\'hɒspitәl/', 'n. 医院；[医] 医院', '基础', [], [], []],
  ['host', 'n. v. /hәust/', 'n. 主人, 旅馆老板, 节目主持人；vt. 当主人招待, 作...节目主持人；[计] 主机, 宿主机', '基础', [], [], []],
  ['hostess', 'n. /\'hәustis/', 'n. 女主人, 女房东, 女老板', '基础', [], [], []],
  ['hot', 'adj. /hɒt/', 'a. 热的, 热心的, 辣的, 热情的, 激动的, 猛烈的, 紧迫的；adv. 热, 紧迫地', '基础', [], [], []],
  ['hotdog', 'n.', '热狗（红肠面包）', '基础', [], [], []],
  ['hotel', 'n. /hәu\'tel/', 'n. 旅馆, 客栈', '基础', [], [], []],
  ['hour', 'n. /auә/', 'n. 小时, 钟头, 时间, ...点钟, 课时', '基础', [], [], []],
  ['house', 'n. vt. /haus/', 'n. 房子, 住宅, 机构, 议院, 家族, 家庭；vt. 给...房子住, 收藏；vi. 住, 躲藏', '基础', [], [], []],
  ['household', 'n. adj.', '同住在一所房子里的人，一家人，户 家庭的，家用的', '基础', [], [], []],
  ['housewife', 'n. /\'hauswaif/', 'n. 主妇, 家庭妇女', '基础', [], [], []],
  ['housework', 'n. /\'hauswә:k/', 'n. 家事, 家务', '基础', [], [], []],
  ['how', 'adv. /hau/', 'adv. 如何, 怎样, 多少, 多么；n. 方式', '基础', [], [], []],
  ['however', 'adv. conj. /hau\'evә/', 'adv. 然而, 无论如何, 究竟怎样；conj. 然而, 可是', '基础', [], [], []],
  ['howl', 'vi. /haul/', 'n. 嗥叫, 吠声, 号叫；vi. 狂吠, 咆哮, 呼啸；vt. 对...吼叫, 狂喊着说', '基础', [], [], []],
  ['hug', 'v. /hʌg/', 'n. 紧抱, 拥抱；vt. 紧抱, 坚持, 使沾沾自喜', '基础', [], [], []],
  ['huge', 'adj. /hju:dʒ/', 'a. 极大的, 巨大的, 无限的', '基础', [], [], []],
  ['human', 'adj. /\'hju:mәn/', 'n. 人, 人类；a. 人类的, 似人类的, 人性的, 有同情心的', '基础', [], [], []],
  ['humorous', 'adj. /\'hju:mәrәs/', 'a. 富幽默感的, 滑稽的, 诙谐的', '基础', [], [], []],
  ['humour', 'n. /\'hju:mә/', 'n. 幽默, 诙谐, 情绪, 体液；vt. 使满足, 迁就', '基础', [], [], []],
  ['hundred', 'num. /\'hʌndrәd/', 'n. 百, 百个东西；num. 百, 百个；a. 一百的, 许多的', '基础', [], [], []],
  ['hunger', 'n. /\'hʌŋgә/', 'n. 饥饿, 渴望, 饥荒；vt. 使挨饿；vi. 挨饿, 渴望', '基础', [], [], []],
  ['hungry', 'adj. /\'hʌŋgi/', 'a. 饥饿的, 荒年的, 渴望的, 不毛的；[化] 欠鞣皮', '基础', [], [], []],
  ['hunt', 'v. /hʌnt/', 'n. 狩猎, 追捕, 搜寻, 猎区；vt. 狩猎, 打猎, 搜索；vi. 打猎, 猎食, 搜寻', '基础', [], [], []],
  ['hunter', 'n. /\'hʌntә/', 'n. 猎人, 猎犬, 追求者', '基础', [], [], []],
  ['hurricane', 'n. /\'hә:rikәn/', 'n. 飓风, 暴风, 暴风雨', '基础', [], [], []],
  ['hurry', 'v. n. /\'hʌri/', 'n. 匆忙, 急忙, 急促；vt. 急派, 催促；vi. 匆忙, 赶快', '基础', [], [], []],
  ['hurt', 'v. n. adj. /hә:t/', 'n. 伤害, 创伤, 损害；v. 伤害, (使)伤心, 危害, 刺痛', '基础', [], [], []],
  ['husband', 'n. /\'hʌzbәnd/', 'n. 丈夫, 管理人, 节俭的人；vt. 节俭, 使成丈夫, 持有', '基础', [], [], []],
  ['hydrogen', 'n. /\'haidrәdʒәn/', 'n. 氢；[化] 氢H-2', '基础', [], [], []],
  ['I', 'pron. /ai/', 'pron. 我；[计] 电流, 中断, 指令, 指示符', '基础', [], [], []],
  ['ice', 'n. /ais/', 'n. 冰, 冰淇淋, 糖衣, 冷若冰霜, 矜持, 贿赂；vt. 使结冰, 冰镇, 覆以糖衣；vi. 结冰', '基础', [], [], []],
  ['ice-cream', 'n.', '冰淇淋', '基础', [], [], []],
  ['idea', 'n. /ai\'diә/', 'n. 主意, 办法, 理想, 思想, 概念, 意见；[医] 观念, 思想', '基础', [], [], []],
  ['ideal', 'adj.', '理想的，完满的；想像的，空想的', '基础', [], [], []],
  ['identification', 'n. /ai.dentifi\'keiʃәn/', 'n. 识别, 身份证明, 认同；[化] 鉴定; 鉴别; 鉴别法; 认证', '基础', [], [], []],
  ['identity', 'n. /ai\'dentiti/', 'n. 身份, 相同, 一致, 特性, 恒等式；[计] (打)标记, 标识', '基础', [], [], []],
  ['idiom', 'n. /\'idiәm/', 'n. 习语, 成语, 惯用语法, 方言', '基础', [], [], []],
  ['if', 'conj. /if/', 'conj. 如果, 是否, 无论何时, 假设, 即使；n. 条件；[计] DOS批处理命令:根据所测试的条件决定是否执行另一条命令', '基础', [], [], []],
  ['ignore', 'v. /ig\'nɒ:/', 'vt. 不理睬, 忽视, 驳回, 忽略；[计] 忽略', '基础', [], [], []],
  ['ill', 'adj. /il/', 'n. 疾病, 坏事, 罪恶, 灾难；a. 生病的, 邪恶的, 不吉利的, 敌意的, 不良的, 不顺利的；adv. 有害地, 不幸地, 几乎不', '基础', [], [], []],
  ['illegal', 'adj. /i\'li:gәl/', 'a. 违法的, 不合规定的；[经] 非法的, 犯规的', '基础', [], [], []],
  ['illness', 'n. /\'ilnis/', 'n. 疾病, 恶意；[医] 病', '基础', [], [], []],
  ['illustrate', 'vt.', '给…加插图；说明，阐明；表明', '基础', [], [], []],
  ['image', 'n.', '形象；图像', '基础', [], [], []],
  ['imagination', 'n.', '想像力；想像', '基础', [], [], []],
  ['imagine', 'vt. /i\'mædʒin/', 'vt. 想像, 设想, 猜测；vi. 想像起来', '基础', [], [], []],
  ['immediate', 'adj. /i\'mi:diәt/', 'a. 立即的, 直接的, 接近的；[医] 直接的, 立即的', '基础', [], [], []],
  ['immediately', 'adv. /i\'mi:diәtli/', 'adv. 直接地, 立刻, 立即', '基础', [], [], []],
  ['immigration', 'n. /.imi\'greiʃәn/', 'n. 移民, 移居；[医] 移民', '基础', [], [], []],
  ['impact', 'n. vt. & vi.', '影响，作用；冲击（力），碰撞 对某事物有影响', '基础', [], [], []],
  ['imply', 'vt.', '暗示，暗指', '基础', [], [], []],
  ['import', 'v. & n. /im\'pɒ:t/', 'n. 进口货, 进口, 输入, 含义, 重要性；vt. 输入, 引入, 进口, 含...的意思, 重要；vi. 有关系；[计] 引入', '基础', [], [], []],
  ['importance', 'n. /im\'pɒ:tәns/', 'n. 重要, 重要性, 重要地位, 自大；[机] 重要, 重要性', '基础', [], [], []],
  ['important', 'adj. /im\'pɒ:tәnt/', 'a. 重要的, 有地位的, 大量的, 显要的, 自负的；[计] 要点', '基础', [], [], []],
  ['impossible', 'adj. /im\'pɒsәbl/', 'a. 不可能的, 难以置信的, 令人无法忍受的', '基础', [], [], []],
  ['impress', 'vt. /im\'pres/', 'n. 印象, 特征, 印记；vt. 使有印象, 印, 铭刻, 传送, 影响, 强征；vi. 给人印象', '基础', [], [], []],
  ['impression', 'n. /im\'preʃәn/', 'n. 印象, 意念, 盖印, 印记, 印数, 底色, 效果；[医] 压迹, 印模, 印象, 影响', '基础', [], [], []],
  ['impressive', 'adj.', '给人印象深刻的，感人的', '基础', [], [], []],
  ['improve', 'vt. & vi. /im\'pru:v/', 'vt. 改良, 提高...的价值, 改善, 利用；vi. 变得更好, 增加', '基础', [], [], []],
  ['improvement', 'n.', '增加或修改；改进，改善，改良', '基础', [], [], []],
  ['in', 'prep. adv. /in/', 'prep. 在...期间, 在...之内, 处于...之中, 从事于, 按照, 穿着；adv. 进入, 朝里, 在里面, 在屋里；a. 在里面的, 在朝的；n. 执政者, 交情', '基础', [], [], []],
  ['inch', 'n. /intʃ/', 'n. 英寸, 身高, 小岛；vi. 慢慢前进, 慢慢移动；vt. 使缓慢地移动', '基础', [], [], []],
  ['incident', 'n. /\'insidәnt/', 'n. 事件, 事变, 小事；a. 附带的, 易于发生的, 外来的, 入射的', '基础', [], [], []],
  ['incidentally', 'adv.', '偶然地，不经意地', '基础', [], [], []],
  ['include', 'vt. /in\'klu:d/', 'vt. 包括, 把...算入, 包住；[计] DOS内部命令:在CONFIG.SYS文件的一个配置块中包含另一配置块的内容', '基础', [], [], []],
  ['including', 'prep.', '包括；包含', '基础', [], [], []],
  ['income', 'n. /\'inkʌm/', 'n. 收入, 收益, 流入；[经] 收益', '基础', [], [], []],
  ['incorrect', 'adj. /.inkә\'rekt/', 'a. 不正确的；[法] 不正确, 错误的, 不适当的', '基础', [], [], []],
  ['increase', 'v. & n. /in\'kri:s/', 'n. 增加, 增进, 利益；vt. 增加, 加大；vi. 增加, 繁殖', '基础', [], [], []],
  ['indeed', 'adv. /in\'di:d/', 'adv. 的确, 实在, 真正地, 甚至', '基础', [], [], []],
  ['independence', 'n. /.indi\'pendәns/', 'n. 独立, 自立, 自主；[医] 自主性, 独立性', '基础', [], [], []],
  ['independent', 'adj. /.indi\'pendәnt/', 'n. 独立自主者, 无党派者；a. 独立的, 有主见的, 不须依赖的, 不受约束的', '基础', [], [], []],
  ['indicate', 'v. /\'indikeit/', 'vt. 显示, 象征, 指示, 指出；[医] 指示', '基础', [], [], []],
  ['individual', 'adj. n.', '个别的，个人的 个人；人', '基础', [], [], []],
  ['industrial', 'adj.', '工业的，产业的；用于工业的', '基础', [], [], []],
  ['industry', 'n. /\'indәstri/', 'n. 勤劳, 工业, 企业, 产业, 有组织的劳动；[经] 工业, 实业', '基础', [], [], []],
  ['infection', 'n.', '〈医〉传染，感染；传染病', '基础', [], [], []],
  ['inflation', 'n.', '（充气而引起的）膨胀；通货膨胀', '基础', [], [], []],
  ['influence', 'n. & v. /\'influәns/', 'n. 影响力, 权力, 势力；vt. 影响, 改变', '基础', [], [], []],
  ['inform', 'vt. /in\'fɒ:m/', 'vt. 通知, 使了解, 使充满；vi. 提供资料, 告发', '基础', [], [], []],
  ['information', 'n. /.infә\'meiʃәn/', 'n. 消息, 知识, 通知, 情报, 信息, 问讯处, 起诉；[计] 信息', '基础', [], [], []],
  ['initial', 'adj. /i\'niʃәl/', 'n. 字首, 首字母；a. 开始的, 最初的, 字首的；vt. 用姓名的首字母签名', '基础', [], [], []],
  ['injure', 'vt. /\'indʒә/', 'vt. 伤害, 损害, 使受冤屈；[医] 损伤', '基础', [], [], []],
  ['injury', 'n. /\'indʒәri/', 'n. 伤害, 侮辱；[医] 伤, 损伤', '基础', [], [], []],
  ['ink', 'n. /iŋk/', 'n. 墨水, 墨汁；vt. 涂墨水于, 签署, 加墨水', '基础', [], [], []],
  ['inn', 'n. /in/', 'n. 旅馆, 客栈；vi. 住旅馆', '基础', [], [], []],
  ['inner', 'adj.', '内部的，里面的；内心的', '基础', [], [], []],
  ['innocent', 'adj. /\'inәsәnt/', 'a. 无罪的, 不懂事的, 无知的；n. 天真的人, 笨蛋', '基础', [], [], []],
  ['insect', 'n. /\'insekt/', 'n. 昆虫, 卑鄙的人；[医] 昆虫', '基础', [], [], []],
  ['insert', 'vt. /in\'sә:t/', 'n. 插入物；vt. 插入, 把(人造卫星)射入(轨道), 添写；vi. 附着；[计] 插入', '基础', [], [], []],
  ['inside', 'prep. adv. /\'in\'said/', 'n. 内部, 内脏, 内幕；a. 内部的, 秘密的, 户内的；adv. 在里面；prep. 在...之内', '基础', [], [], []],
  ['insist', 'vi. /in\'sist/', 'v. 坚持, 坚决主张, 强调', '基础', [], [], []],
  ['inspect', 'vt. /in\'spekt/', 'vt. 检查, 检阅, 检验；vi. 检查', '基础', [], [], []],
  ['inspire', 'vt. /in\'spaiә/', 'vt. 使感动, 激发, 启示, 吸入, 鼓舞, 产生, 使生灵感；vi. 吸入, 赋予灵感', '基础', [], [], []],
  ['install', 'vt.', '安装', '基础', [], [], []],
  ['instance', 'n.', '例子，实例', '基础', [], [], []],
  ['instant', 'n. adj. /\'instәnt/', 'n. 立即, 瞬间；a. 紧急的, 立即的, 即时的', '基础', [], [], []],
  ['instead', 'adv. /in\'sted/', 'adv. 作为替代, 反而', '基础', [], [], []],
  ['institute', 'n. /\'institju:t/', 'n. 学会, 学院, 协会；vt. 创立, 开始, 制定, 任命', '基础', [], [], []],
  ['institution', 'n. /.insti\'tju:ʃәn/', 'n. 机构, 惯例, 制度；[医] 机关, 机构, 设施', '基础', [], [], []],
  ['instruct', 'vt. /in\'strʌkt/', 'vt. 教, 教育, 命令, 通知；[法] 托办, 指导, 指示', '基础', [], [], []],
  ['instruction', 'n. /in\'strʌkʃәn/', '命令，指示；讲授，指导，教学；使用说明书，操作指南', '基础', [], [], []],
  ['instrument', 'n. /\'instrumәnt/', 'n. 工具, 手段, 仪器；[化] 仪器', '基础', [], [], []],
  ['insurance', 'n. /in\'ʃurәns/', 'n. 保险, 保险业, 保险费；[医] 保险', '基础', [], [], []],
  ['insure', 'vt. /in\'ʃuә/', 'vt. 保险, 确保；vi. 投保', '基础', [], [], []],
  ['intelligence', 'n. /in\'telidʒәns/', 'n. 智力, 情报, 信息；[医] 智力', '基础', [], [], []],
  ['intelligent', 'adj.', '聪明的；理解力强的', '基础', [], [], []],
  ['intend', 'vt. /in\'tend/', 'vt. 计划, 打算, 意思是；[法] 想要, 打算, 意旨', '基础', [], [], []],
  ['intention', 'n. /in\'tenʃәn/', 'n. 意图, 目的, 含义；[医] 愈合, 意向', '基础', [], [], []],
  ['interest', 'n. vt. /\'intrist/', 'n. 兴趣, 嗜好, 利息, 利益, 爱好, 趣味, 势力；vt. 使感兴趣, 与...有关系', '基础', [], [], []],
  ['interesting', 'adj. /\'intristiŋ/', 'a. 有趣的', '基础', [], [], []],
  ['internal', 'adj.', '内部的；国内的，内政的；体内的', '基础', [], [], []],
  ['international', 'adj. /.intә\'næʃәnәl/', 'a. 国际的；n. 国别设定；[计] 国别设定', '基础', [], [], []],
  ['Internet', 'n.', '互联网，英特网', '基础', [], [], []],
  ['interpret', 'vt. vt. & vi.', '解释；说明 口译；翻译', '基础', [], [], []],
  ['interpreter', 'n. /in\'tә:pritә/', 'n. 直译程序, 解释者, 口译者, 注释器；[计] 注释器', '基础', [], [], []],
  ['interrupt', 'v. /.intә\'rʌpt/', 'vt. 中断, 妨碍, 插嘴；vi. 打断；n. 中断；[计] 中断', '基础', [], [], []],
  ['interval', 'n. /\'intәvәl/', 'n. 间隔, 距离, 间歇, 间隙；[计] 时间间隔', '基础', [], [], []],
  ['interview', 'n. & v. /\'intәvju:/', 'n. 面谈, 访问, 接见, 面试；vt. 接见, 对...进行面谈(试)', '基础', [], [], []],
  ['into', 'prep. /\'intu:/', 'prep. 进入...之内, 朝..., 深入...之中, 成为...状况', '基础', [], [], []],
  ['introduce', 'vt. /.intrә\'dju:s/', 'vt. 介绍, 引入, 采用, 输入；[法] 引进, 输入, 介绍', '基础', [], [], []],
  ['introduction', 'n. /.intrә\'dʌkʃәn/', 'n. 介绍, 传入, 采用, 初步', '基础', [], [], []],
  ['invent', 'vt. /in\'vent/', 'vt. 发明, 创作, 虚构；[机] 发明', '基础', [], [], []],
  ['invention', 'n. /in\'venʃәn/', 'n. 发明, 创作能力, 虚构的故事；[经] 发明', '基础', [], [], []],
  ['inventor', 'n. /in\'ventә/', 'n. 发明家；[法] 发明人, 发明家, 创造者', '基础', [], [], []],
  ['invest', 'v.', '投资', '基础', [], [], []],
  ['investigate', 'vt.', '调查；审查', '基础', [], [], []],
  ['invitation', 'n. /.invi\'teiʃәn/', 'n. 邀请, 请柬, 引诱；[经] 邀请, 招待, 吸引', '基础', [], [], []],
  ['invite', 'vt. /in\'vait/', 'vt. 邀请, 请求, 引起, 招致；n. 邀请', '基础', [], [], []],
  ['involve', 'vt.', '需要；使参与，牵涉', '基础', [], [], []],
  ['iron', 'n. vt. /\'aiәn/', 'n. 铁, 熨斗, 铁器, 坚强, 烙铁, 镣铐；vt. 烫平, 熨, 用铁包；vi. 烫平', '基础', [], [], []],
  ['irrigate', 'vt. /\'irigeit/', 'vt. 灌溉, 冲洗伤口, 使清新；vi. 灌溉', '基础', [], [], []],
  ['irrigation', 'n. /.iri\'geiʃәn/', 'n. 灌溉, 冲洗；[医] 冲洗法, 灌溉', '基础', [], [], []],
  ['island', 'n. /\'ailәnd/', 'n. 岛, 岛屿, 孤立地区, 安全岛；vt. 使成岛状, 孤立', '基础', [], [], []],
  ['issue', 'n. vt.', '问题；争论点；发行物；发行 出版，发行', '基础', [], [], []],
  ['it', 'pron. /it/', 'pron. 它；[计] 信息论, 输入终端, 智能终端, 内捕获', '基础', [], [], []],
  ['item', 'n.', '一项，一件，一条；项目', '基础', [], [], []],
  ['its', 'pron. /its/', 'pron. 它的', '基础', [], [], []],
  ['itself', 'pron. /it\'self/', 'pron. 它本身, 它自己', '基础', [], [], []],
  ['jacket', 'n. /\'dʒækit/', 'n. 夹克, 外套, 护套；vt. 给...穿夹克, 给...装护套', '基础', [], [], []],
  ['jam', 'n. /dʒæm/', 'n. 果酱, 拥塞之物, 堵塞, 困境；vt. 挤进, 使塞满, 混杂, 压碎, 使堵塞；vi. 堵塞, 轧住, 拥挤', '基础', [], [], []],
  ['January', 'n. /\'dʒænjuәri/', 'n. 一月', '基础', [], [], []],
  ['jar', 'n. /dʒɑ:/', 'n. 广口瓶, 震动, 刺耳声；vi. 震惊, 冲突, 发刺耳声, 不一致；vt. 震动, 刺激', '基础', [], [], []],
  ['jaw', 'n. /dʒɒ:/', 'n. 颚, 颌；v. 闲谈, 教训, 唠叨', '基础', [], [], []],
  ['jazz', 'n. /dʒæz/', 'n. 爵士乐, 喧闹；a. 爵士乐的, 喧吵的；vi. 演奏爵士乐, 跳爵士舞, 游荡；vt. 奏爵士乐, 使活泼', '基础', [], [], []],
  ['jeans', 'n. /dʒi:nz/', 'n. 工装裤, 牛仔裤', '基础', [], [], []],
  ['jeep', 'n. /dʒi:p/', 'n. 吉普车；vi. 乘吉普车；vt. 用吉普车运', '基础', [], [], []],
  ['jet', 'n. /dʒet/', 'n. 喷射流, 喷嘴, 煤玉；v. 射出, 迸出, 喷射；a. 黑而发亮的, 墨黑的', '基础', [], [], []],
  ['jewel', 'n. /\'dʒu:әl/', 'n. 珠宝, 贵重物, 镶珠宝的饰物；vt. 饰以珠宝, 镶以宝石', '基础', [], [], []],
  ['jewelry', 'n. /\'dʒu:әlri/', 'n. 珠宝, 珠宝类', '基础', [], [], []],
  ['job', 'n. /dʒɒb/', 'n. 工作, 零活, 职业, 事情；vi. 做零工, 打杂, 做股票经纪, 假公济私；vt. 代客买卖, 批发, 承包, 欺骗；[计] 作业', '基础', [], [], []],
  ['jog', 'v. /dʒɒg/', 'n. 轻推, 轻撞, 慢跑；v. 轻推, (使)蹒跚行进, (使)慢跑', '基础', [], [], []],
  ['join', 'v. /dʒɒin/', 'vi. 参加, 结合, 加入；vt. 连接, 结合, 参加, 加入；n. 连接, 结合, 接合点；[计] 连接; 汇合指令', '基础', [], [], []],
  ['joint', 'adj. n.', '共同的，联合的 关节；接头，接合处', '基础', [], [], []],
  ['joke', 'n. /dʒәuk/', 'n. 笑话, 玩笑, 笑柄；v. 开玩笑, 取笑, 作弄', '基础', [], [], []],
  ['journalist', 'n. /\'dʒә:nәlist/', 'n. 新闻记者, 从事新闻杂志业的人', '基础', [], [], []],
  ['journey', 'n. vi. /\'dʒә:ni/', 'n. 旅程, 旅行, 行程；vi. 旅行；vt. 游历', '基础', [], [], []],
  ['joy', 'n. /dʒɒi/', 'n. 欢喜, 乐事, 高兴；vt. 使快乐, 令人高兴；vi. 欢喜', '基础', [], [], []],
  ['judge', 'n. vt. & vi. /dʒʌdʒ/', 'n. 法官, 裁判员, 审判官, 鉴定人；vt. 审理, 鉴定, 判断, 判决, 裁定；vi. 下判断, 作评价', '基础', [], [], []],
  ['judgement', 'n. /\'dʒʌdʒmәnt/', 'n. 审判, 判决, 判断；[经] 判定, 审定, 鉴定', '基础', [], [], []],
  ['juice', 'n. /dʒu:s/', 'n. 汁, 活力, 体液；vt. 挤出汁来, 加汁', '基础', [], [], []],
  ['July', 'n. /dʒu:\'lai/', 'n. 七月', '基础', [], [], []],
  ['jump', 'n. v. /dʒʌmp/', 'n. 跳跃, 跳动, 暴涨, 惊跳；vt. 跳跃, 跃过, 突升, 使跳跃；vi. 跳跃, 跳, 跳动, 暴涨；[计] 转移, 跳转', '基础', [], [], []],
  ['junction', 'n.', '联结点，会合点，枢纽', '基础', [], [], []],
  ['June', 'n. /dʒu:n/', 'n. 六月', '基础', [], [], []],
  ['jungle', 'n. /\'dʒʌŋgl/', 'n. 丛林, 杂乱的一堆, 弱肉强食的地方', '基础', [], [], []],
  ['junior', 'adj. n. /\'dʒu:njә/', 'n. 年少者, 地位较低者, 大学三年级学生；a. 年少的, 下级的, 后进的', '基础', [], [], []],
  ['just', 'adv. adj. /dʒʌst/', 'a. 正直的, 合理的, 正确的, 应得的；adv. 刚刚, 正好, 仅仅', '基础', [], [], []],
  ['justice', 'n. /\'dʒʌstis/', 'n. 正义, 公平, 公正, 正确, 司法, 审判', '基础', [], [], []],
  ['justify', 'vt.', '证明…有理；为…辩护', '基础', [], [], []],
  ['kangaroo', 'n. /.kæŋgә\'ru:/', 'n. 袋鼠；[医] 袋鼠(澳洲产)', '基础', [], [], []],
  ['keen', 'adj.', '热心的，渴望（做某事）；敏锐的，敏捷的', '基础', [], [], []],
  ['keep', 'v. vt. /ki:p/', 'n. 生计, 维持, 保持；vt. 保持, 保存, 遵守, 看守, 整理, 维持, 履行, 经营, 拘留, 记帐；vi. 保持, 继续不断', '基础', [], [], []],
  ['kettle', 'n. /\'ketl/', 'n. 茶壶, 罐；[化] 釜体釜; 锅', '基础', [], [], []],
  ['key', 'n. /ki:/', 'n. 钥匙, 键, 解答, 关键, 要害, 基调, 线索, 答案, 暗礁；vt. 调音, 锁上, 提供线索；vi. 使用钥匙；[计] 键, 密钥', '基础', [], [], []],
  ['keyboard', 'n. /\'ki:bɒ:d/', 'n. 键盘；[计] 键盘', '基础', [], [], []],
  ['kick', 'v. & n. /kik/', 'n. 踢, 反冲, 后座力, 凹底；vi. 踢, 反抗, 反冲；vt. 踢, 反冲', '基础', [], [], []],
  ['kid', 'n. /kid/', 'n. 小山羊, 小山羊肉, 小孩, 欺骗；a. 小山羊皮制的；v. 哄骗, 嘲弄', '基础', [], [], []],
  ['kill', 'v. /kil/', 'n. 杀, 杀戮, 小河；vt. 杀, 破坏, 消灭, 使终止, 抵消, 否决；vi. 杀死；[计] 删除', '基础', [], [], []],
  ['kilo', 'n. /\'kilәu/', 'n. 千；[计] 千', '基础', [], [], []],
  ['kilogram', 'n. /\'kilәgræm/', 'n. 千克, 公斤；[医] 千克, 公斤', '基础', [], [], []],
  ['kilometre', 'n.', '千米（公里）', '基础', [], [], []],
  ['kind', 'n. adj. /kaind/', 'n. 种类, 性质, 方式；a. 亲切的, 仁慈的, 和蔼的', '基础', [], [], []],
  ['kindergarten', 'n. /\'kindә.gɑ:tn/', 'n. 幼稚园', '基础', [], [], []],
  ['kindness', 'n. /\'kaindnis/', 'n. 仁慈, 亲切, 和蔼', '基础', [], [], []],
  ['king', 'n. /kiŋ/', 'n. 国王, 君主；vt. 使...成为君主；vi. 君临, 统治', '基础', [], [], []],
  ['kingdom', 'n. /\'kiŋdәm/', 'n. 王国, 领域；[医] 界(动物,植物,矿物)', '基础', [], [], []],
  ['kiss', 'n. & v. /kis/', 'n. 吻；vt. 吻；vi. 接吻', '基础', [], [], []],
  ['kitchen', 'n. /\'kitʃin/', 'n. 厨房, 全套炊具；[医] 厨房', '基础', [], [], []],
  ['kite', 'n. /kait/', 'n. 风筝, 筝帆, 空头支票, 骗子；vi. 象风筝一样飞, 轻快地移动, 使用空头支票；vt. 使上升, 骗钱', '基础', [], [], []],
  ['knee', 'n. /ni:/', 'n. 膝, 膝盖；vt. 膝行, 用膝盖碰', '基础', [], [], []],
  ['knife', 'n. /naif/', 'n. 小刀, 匕首；vt. 切割, 伤害, 切, 戳；vi. 劈开, 穿过', '基础', [], [], []],
  ['knock', 'n. & v. /nɒk/', 'n. 敲, 敲打, 敲门；v. 敲击, 互撞, 攻击', '基础', [], [], []],
  ['know', 'v. /nәu/', 'v. 知道, 了解, 认识, 确信', '基础', [], [], []],
  ['knowledge', 'n. /\'nɒlidʒ/', 'n. 知识, 学问, 认识, 知道', '基础', [], [], []],
  ['lab', 'n. /læb/', '实验室（laboratory 的缩写）', '基础', [], [], []],
  ['labour', 'n. /\'leibә/', 'n. 劳动, 努力, 工作, 劳工, 分娩；vi. 劳动, 努力, 苦干；vt. 详细分析, 使厌烦', '基础', [], [], []],
  ['lack', 'n. & vt. /læk/', 'n. 缺乏, 无, 不足；vt. 缺乏, 短少, 不足, 需要；vi. 缺乏', '基础', [], [], []],
  ['ladder', 'n. /\'lædә/', 'n. 梯, 梯状物, 发迹的途径；vi. 袜子抽丝, 成名', '基础', [], [], []],
  ['lady', 'n. /\'leidi/', 'n. 淑女, 夫人, 女士, 贵妇', '基础', [], [], []],
  ['lake', 'n. /leik/', 'n. 湖, 池, 色淀；v. (使)血球溶解', '基础', [], [], []],
  ['lamb', 'n. /læm/', 'n. 小羊, 羔羊；v. 产羊羔', '基础', [], [], []],
  ['lame', 'adj. /leim/', 'a. 跛足的, 僵痛的, 不完全的, 金属薄板, 不知内情的人；vi. 变跛；vt. 使成残废, 使无用', '基础', [], [], []],
  ['lamp', 'n. /læmp/', 'n. 灯；vt. 照亮；[计] 逻辑模拟分析系统', '基础', [], [], []],
  ['land', 'n. v. /lænd/', 'n. 陆地, 地面, 地界, 地产, 国土, 土地；vi. 登陆, 登岸, 到达；vt. 使上岸, 使登陆, 使到达；[计] 连接盘; 焊盘', '基础', [], [], []],
  ['landscape', 'n. vt.', '风景；风景画；全景 美化…', '基础', [], [], []],
  ['lane', 'n.', '（乡间）小路（巷）；车（跑，泳）道；航道', '基础', [], [], []],
  ['language', 'n. /\'læŋgwidʒ/', 'n. 语言, 文字, 措辞；[计] 语言', '基础', [], [], []],
  ['lap', 'n. /læp/', 'n. 膝盖, 舔, 一圈, 下摆, 衣兜, 山坳；vi. 重叠, 围住, 轻拍, 舔；vt. 包围, 抱...在膝上, 使重叠, 舔, 拍打, 泼溅；[计] 链接访问程序', '基础', [], [], []],
  ['large', 'adj. /lɑ:dʒ/', 'a. 大的, 大量的, 宽大的, 广博的；adv. 大大地, 夸大地', '基础', [], [], []],
  ['last', 'adj. adv. n. v. /lɑ:st/', 'a. 最后的, 末尾的, 最近的；vi. 持续, 支持, 维持；vt. 使维持, 够...用；adv. 最后, 后来；n. 最后, 末尾, 鞋楦头', '基础', [], [], []],
  ['late', 'adj. adv. /leit/', 'a. 迟的, 晚的, 已故的；adv. 很晚, 很迟, 晚', '基础', [], [], []],
  ['later', 'adj. /\'leitә/', 'adv. 以后, 随后', '基础', [], [], []],
  ['latter', 'n. /\'lætә/', 'a. 后者的, 较后的, 近来的', '基础', [], [], []],
  ['laugh', 'n. & v. /lɑ:f/', 'n. 笑, 笑声；vi. 笑, 大笑；vt. 以笑表示', '基础', [], [], []],
  ['laughter', 'n. /\'lɑ:ftә/', 'n. 笑, 笑声；[医] 笑, 大笑', '基础', [], [], []],
  ['launch', 'v. n.', '发动，推出；发射 发射，下水，投产', '基础', [], [], []],
  ['laundry', 'n. /\'lɒ:ndri/', 'n. 洗衣店, 洗好的衣服, 洗涤；[机] 洗衣作, 洗衣店, 洗衣房', '基础', [], [], []],
  ['law', 'n. /lɒ:/', 'n. 法律, 法则, 定律, 法律的制约, 法学, 司法界, 诉讼；v. 起诉', '基础', [], [], []],
  ['lawyer', 'n. /\'lɒ:jә/', 'n. 律师；[经] 律师', '基础', [], [], []],
  ['lay', 'vt. /lei/', 'vt. 放置, 产, 铺设, 布置, 提出, 平息；vi. 下蛋, 打赌；n. 位置, 层, 隐藏处；a. 世俗的, 外行的；lie的过去式', '基础', [], [], []],
  ['layer', 'n.', '层，层次', '基础', [], [], []],
  ['lazy', 'adj. /\'leizi/', 'a. 懒惰的, 怠惰的, 缓慢的；vi. 懒散', '基础', [], [], []],
  ['lead', 'v. n. /li:d. led/', 'n. 铅, 铅条, 领导, 超前量, 领引, 榜样, 主角, 导线；vt. 引导, 带领, 领导, 指挥, 致使, 加铅于, 用铅包；vi. 领导, 带头, 导致, 用测深锤测深, 被铅覆盖；a. 带头的, 最重要的', '基础', [], [], []],
  ['leader', 'n. /\'li:dә/', 'n. 领导者, 社论, 指挥, 领袖, 领唱者, 前导字符；[计] 前导字符', '基础', [], [], []],
  ['leadership', 'n.', '领导，领导层', '基础', [], [], []],
  ['leaf', 'n. /li:f/', 'n. 叶, 树叶, 花瓣, 页；vi. 生叶, 翻书页；vt. 在...上长叶, 翻...的页', '基础', [], [], []],
  ['league', 'n. /li:g/', 'n. 同盟, 联盟, 盟约；v. 组联盟, (使)加盟', '基础', [], [], []],
  ['leak', 'vi. /li:k/', 'n. 漏洞, 漏处, 漏出, 泄漏；vi. 漏, 泄漏；vt. 使渗漏', '基础', [], [], []],
  ['learn', 'vt. /lә:n/', 'vt. 学习；认识到；得知', '基础', [], [], []],
  ['least', 'adj. adv. n. /li:st/', 'n. 最少, 最小, 最小限度；a. 最少的, 最小的；adv. 最小, 最少', '基础', [], [], []],
  ['leather', 'n. /\'leðә/', 'n. 皮革, 皮制品, 马镫的皮带；vt. 覆以皮革, 鞭苔, 抽打；a. 皮革的, 皮制的', '基础', [], [], []],
  ['leave', 'v. /li:v/', 'n. 许可, 告别, 请假, 休假；vt. 离开, 剩下, 遗忘, 委托, 丢弃；vi. 出发, 离开, 生叶', '基础', [], [], []],
  ['lecture', 'n. /\'lektʃә/', 'n. 演讲, 谴责, 讲稿；vt. 演讲, 训诫, 说教；vi. 讲演', '基础', [], [], []],
  ['left', 'adj. adv. n. /left/', 'a. 左边的, 左倾的, 左侧的, 左派的；adv. 在左面；n. 左, 左面, 左派；leave的过去式和过去分词', '基础', [], [], []],
  ['leg', 'n. /leg/', 'n. 腿, 假腿, 路程；vi. 走, 跑', '基础', [], [], []],
  ['legal', 'adj. /\'li:gәl/', 'a. 法律的, 法定的, 合法的；[经] 法定权利; 法律(上)的, 合法的', '基础', [], [], []],
  ['lemon', 'n. adj. /\'lemәn/', 'n. 柠檬, 柠檬树, 柠檬色；[医] 柠檬', '基础', [], [], []],
  ['lemonade', 'n. /.lemә\'neid/', 'n. 柠檬水；[医] 柠檬水', '基础', [], [], []],
  ['lend', 'vt. /lend/', 'vt. 借, 贷款给, 增添, 提供, 出租；vi. 贷款', '基础', [], [], []],
  ['length', 'n. /leŋθ/', 'n. 长度, 长, 期间, 一段；[计] 记录长度; 块长; 字长', '基础', [], [], []],
  ['lesson', 'n. /\'lesn/', 'n. 课, 课业, 教训', '基础', [], [], []],
  ['let', 'vt. /let/', 'vt. 让, 假设, 出租, 排放, 妨碍；vi. 出租, 被承包；n. 出租屋, 障碍', '基础', [], [], []],
  ['letter', 'n. /\'letә/', 'n. 信, 字母, 证书, 字面意义, 铅字, 学问, 出租人；vt. 写字母于, 在...上刻字母, 用字母标明；vi. 写印刷体字；[计] 字母', '基础', [], [], []],
  ['level', 'n. /\'levl/', 'n. 水平, 水准, 平地；a. 同高的, 平坦的, 齐平的, 水平的；vt. 弄平, 夷平, 使同等, 瞄准, 对准；vi. 变平, 拉平；[计] 级别', '基础', [], [], []],
  ['liberal', 'adj.', '心胸宽阔的；自由（主义）的；慷慨的', '基础', [], [], []],
  ['liberation', 'n. /.libә\'reiʃәn/', 'n. 释放, 解放；[化] 发出; 释放; 放出', '基础', [], [], []],
  ['liberty', 'n. /\'libәli/', 'n. 自由, 特权, 许可, 冒失；[法] 自由, 自由权, 自由区域', '基础', [], [], []],
  ['librarian', 'n. /lai\'brєәriәn/', 'n. 图书馆员, 图书管理员；[计] 程序库管理程序; 程序库生成程序', '基础', [], [], []],
  ['library', 'n. /\'laibrәri/', 'n. 图书馆, 藏书, 库；[计] 库', '基础', [], [], []],
  ['license', 'n. /\'laisns/', 'n. 执照, 许可证, 特许；vt. 许可, 特许', '基础', [], [], []],
  ['lid', 'n. /lid/', 'n. 盖子, 限制, 眼睑；vt. 给...盖盖子', '基础', [], [], []],
  ['lie', 'vi. n. /lai/', 'n. 谎言, 假象, 位置；vi. 躺着, 说谎, 位于, 展现, 存在, 停泊；vt. 谎骗', '基础', [], [], []],
  ['life', 'n. /laif/', 'n. 生活, 生命, 人生, 世事, 生物, 寿命, 一生, 生命力, 灵魂, 无期徒刑；[医] 生活, 生存, 生命, 寿命', '基础', [], [], []],
  ['lift', 'v. n. /lift/', 'n. 举起, 帮助, 昂扬, 电梯；vt. 升高, 提高, 鼓舞, 清偿, 空运, 举起, 剽窃；vi. 升起, 消散, 耸立', '基础', [], [], []],
  ['light', 'n. vt. adj. /lait/', 'n. 光, 光亮, 灯, 日光, 发光体, 光源, 杰出人物, 火花, 眼光；a. 轻的, 少量的, 轻微的, 轻快的, 轻浮的, 明亮的, 淡色的, 容易的；vt. 点燃, 照亮；vi. 点着, 变亮, 突降, 偶然碰到；adv. 轻地', '基础', [], [], []],
  ['lightning', 'n. /\'laitniŋ/', 'n. 闪电；vi. 闪电；a. 闪电的', '基础', [], [], []],
  ['like', 'prep. vt. /laik/', 'a. 相似的, 同样的；vt. 喜欢, 愿意, 想；vi. 喜欢, 希望；n. 爱好, 同样的人(或物)；prep. 象, 如同；adv. 可能', '基础', [], [], []],
  ['likely', 'adj. /\'laikli/', 'a. 有可能的, 合适的, 前途有望的；adv. 或许, 可能', '基础', [], [], []],
  ['limit', 'vt. /\'limit/', 'n. 界限, 边界, 限度, 极限, 限制；vt. 限制, 限定', '基础', [], [], []],
  ['limited', 'adj.', '有限的', '基础', [], [], []],
  ['line', 'n. v. /lain/', 'n. 列, 线, 绳, 电线, 线路, 路线, 航线, 作业线, 界线, 战线, 外形, 排, 家系；vt. 排成一行, 顺...排列, 划线于, 加衬里, 使有线条, 使起皱纹；vi. 排队；[计] 线路', '基础', [], [], []],
  ['link', 'v. /liŋk/', 'n. 环, 连结物, 链接, 火把；vt. 连结, 联合, 挽住；vi. 连接起来；[计] 连接, 链路', '基础', [], [], []],
  ['lion', 'n. /\'laiәn/', 'n. 狮子, 狮子(星)座, 国际狮子会会员', '基础', [], [], []],
  ['lip', 'n. /lip/', 'n. 唇, 口缘, 唇状构造；vt. 以嘴唇碰, 轻轻说出；a. 口头上的；[计] 大型互连网信息包', '基础', [], [], []],
  ['liquid', 'n. & adj. /\'likwid/', 'n. 液体, 流体, 流音；a. 液体的, 透明的, 明亮的, 流动的, 易变的', '基础', [], [], []],
  ['list', 'n. /list/', 'n. 目录, 名单, 明细表, 布条, 条纹, 列表, 序列, 数据清单；vt. 列出, 列于表上, 记入名单内, 装布条；vi. 列于表上；[计] 列表, 序列, 数据清单', '基础', [], [], []],
  ['listen', 'vi. /\'lisn/', 'vi. 听, 倾听, 听从；n. 听, 倾听', '基础', [], [], []],
  ['literally', 'adv.', '逐字地，照字面地；真正地；简直', '基础', [], [], []],
  ['literary', 'adj. /\'litәrәri/', 'a. 文学的, 文艺的, 精通文学的；[法] 文学的, 从事文学的, 从事写作的', '基础', [], [], []],
  ['literature', 'n. /\'litәrәtʃә/', 'n. 文学, 文艺, 著作；[经] 广告, 商品介绍等文学', '基础', [], [], []],
  ['litre', 'n. /li:tә(r)/', 'n. 升, 公升；[计] 升', '基础', [], [], []],
  ['litter', 'v. /\'litә/', 'n. 垃圾, 杂乱, 轿, 担架；vt. 乱丢, 铺草, 弄乱；vi. 产仔, 乱丢垃圾', '基础', [], [], []],
  ['little', 'adj. adv. n. /\'litl/', 'n. 一点点, 少许, 一会儿, 短时间；a. 小的, 很少的, 幼小的, 琐碎的, 短暂的, 矮小的；adv. 很少, 稍微, 完全不', '基础', [], [], []],
  ['live', 'vi. adj. /liv.laiv/', 'a. 活的, 生动的, 精力充沛的, 实况转播的；vi. 活, 生存, 居住；vt. 过着, 度过, 经历；adv. 实况地', '基础', [], [], []],
  ['lively', 'adj. /\'laivli/', 'a. 活泼的, 鲜明的, 生动的', '基础', [], [], []],
  ['load', 'n. /lәud/', 'n. 负荷, 担子, 重担, 装载量, 负载, 工作量, 加载；vt. 装载, 装填, 使担负；vi. 装货, 上客, 装料；[计] 加载, 装入程序', '基础', [], [], []],
  ['loaf', 'n. /lәuf/', 'n. 一条面包, 块, 游荡；v. 游手好闲, 虚度光阴', '基础', [], [], []],
  ['loan', 'n. vt.', '贷款，借，贷 借出，贷给', '基础', [], [], []],
  ['local', 'adj. /\'lәukәl/', 'a. 地方性的, 当地的, 局部的, 乡土的, 本地的；n. 当地居民, 本地新闻, 局部；[计] 本地的; 局部', '基础', [], [], []],
  ['location', 'n.', '位置，场所；（电影的）外景拍摄地', '基础', [], [], []],
  ['lock', 'n. vt. /lɒk/', 'n. 锁, 刹车, 水闸, 一缕头发；vt. 锁, 锁上, 拘禁, 隐藏, (用锁等)拴住, 刹住；vi. 锁住, (齿轮等)啮合, (船)过闸', '基础', [], [], []],
  ['lonely', 'adj. /\'lәunli/', 'a. 孤单的, 孤寂的, 荒凉的', '基础', [], [], []],
  ['long', 'adj. adv. /lɒŋ/', 'a. 长的, 长久的, 冗长的, 做多头的；vi. 渴望, 热望, 极想；adv. 长久, 始终；n. 长时间, 长信号, 长整型；[计] 长, 长整型', '基础', [], [], []],
  ['look', 'n. v. /luk/', 'n. 一看, 神色, 样子, 面容；vi. 看, 注意, 朝着, 显得；vt. 打量, 看上去与...一样, 以眼色(或脸色)显示, 期待', '基础', [], [], []],
  ['loose', 'adj. /lu:s/', 'n. 发射, 放任, 放纵；a. 宽松的, 松的, 宽的, 不牢固的, 散漫的, 自由的, 不精确的；vt. 释放, 放枪, 开船；vi. 变松, 开火；adv. 松散地', '基础', [], [], []],
  ['lorry', 'n. /\'lɒri/', 'n. 卡车, 货车；[化] 载重汽车', '基础', [], [], []],
  ['lose', 'v. /lu:z/', 'vt. 遗失, 损失, 丢失, 使失去, 错过, 浪费, 迷失, 使迷路, 输去, 使沉溺于；vi. 受损失, 失败', '基础', [], [], []],
  ['loss', 'n. /lɒs/', 'n. 损失, 遗失, 失败, 输, 错过, 伤亡；[化] 损失; 损耗', '基础', [], [], []],
  ['lost', 'adj.', '失去的', '基础', [], [], []],
  ['lot', 'n. /lɒt/', 'n. 运气, 签, 抽签, 份额, 许多, 一堆；vt. 划分；vi. 抽签, 抓阄', '基础', [], [], []],
  ['loud', 'adj. /laud/', 'a. 大声的, 不断的, 喧吵的；adv. 高声地, 大声地', '基础', [], [], []],
  ['lounge', 'n. /laundʒ/', 'n. 闲逛, 休闲室, 长沙发；vi. 闲混, (懒洋洋地)躺；vt. 闲混', '基础', [], [], []],
  ['love', 'n. & vt. /lʌv/', 'n. 爱, 恋爱, 爱情, 爱好, 性爱；vt. 爱, 爱好, 爱慕；vi. 爱', '基础', [], [], []],
  ['lovely', 'adj. /\'lʌvli/', 'a. 可爱的, 有趣的', '基础', [], [], []],
  ['low', 'adj. & adv. /lәu/', 'n. 低点, 低价, 低, 牛叫声；a. 低的, 消沉的, 低等的, 浅的, 卑贱的；adv. 低下地, 谦卑地, 低；vi. 牛叫', '基础', [], [], []],
  ['luck', 'n. /lʌk/', 'n. 运气, 幸运, 好运, 侥幸；vi. 靠好运成功', '基础', [], [], []],
  ['lucky', 'adj. /\'lʌki/', 'a. 幸运的, 吉祥的, 好运的, 侥幸的', '基础', [], [], []],
  ['luggage', 'n. /\'lʌgidʒ/', 'n. 行李, 皮箱', '基础', [], [], []],
  ['lump', 'n. vt. vi.', '小方块，（肿）块 归在一起 结块', '基础', [], [], []],
  ['lunch', 'n. /lʌntʃ/', '午餐，午饭', '基础', [], [], []],
  ['lung', 'n. /lʌŋ/', 'n. 肺, 肺脏, 空地；[医] 肺', '基础', [], [], []],
  ['machine', 'n. /mә\'ʃi:n/', 'n. 机器, 机械装置, 机构, 自动售货机, 机械般工作的人；vt. 以机器制造', '基础', [], [], []],
  ['mad', 'adj. /mæd/', 'a. 疯狂的, 发疯的, 生气的, 愚蠢的, 狂欢的；n. 狂怒', '基础', [], [], []],
  ['madam', 'n.', '夫人，女士', '基础', [], [], []],
  ['magazine', 'n. /.mægә\'zi:n/', 'n. 杂志, 仓库, 弹盒, 胶卷盒；[计] 卡片箱, 介质装卸程序', '基础', [], [], []],
  ['magic', 'n. adj. /\'mædʒik/', 'n. 魔术, 魔法；a. 魔术的, 有魔力的, 不可思议的', '基础', [], [], []],
  ['maid', 'n. /meid/', 'n. 少女, 未婚女子, 女仆', '基础', [], [], []],
  ['mail', 'n. v. /meil/', 'n. 邮件, 邮政, 邮递, 盔甲；vt. 邮寄, 给...穿盔甲；[计] 邮件', '基础', [], [], []],
  ['mailbox', 'n. /\'meilbɒks/', 'n. 邮筒, 邮箱；[计] 邮箱, 电子邮箱', '基础', [], [], []],
  ['main', 'adj. /mein/', 'n. 主要部分, 干线, 体力, 力量, 主群组；a. 主要的, 重要的, 全力的；[计] 主群组', '基础', [], [], []],
  ['mainland', 'n. /\'meinlәnd/', 'n. 大陆, 本土；[法] 大陆', '基础', [], [], []],
  ['major', 'adj. /\'meidʒә/', 'n. 主修课, 成年人, 陆军少校；a. 主要的, 较多的, 大部分的, 成年的, 严重的；vi. 主修；[计] 主要, 主要刻度', '基础', [], [], []],
  ['majority', 'n. /mә\'dʒɒriti/', 'n. 多数, 大半；[计] 多数逻辑', '基础', [], [], []],
  ['make', 'vt. n. /meik/', 'vt. 制造, 安排, 创造, 构成, 使得, 产生, 造成, 整理, 布置, 引起, 到达, 进行；vi. 开始, 前进, 增大, 被制造, 被处理；n. 制造, 构造, 性情', '基础', [], [], []],
  ['male', 'adj. /meil/', 'n. 男人, 雄性动物；a. 男性的, 雄性的, 有力的', '基础', [], [], []],
  ['man', 'n. /mæn/', 'n. 男人, 人类, 人；vt. 为...配备人手, 操纵, 使振奋；[计] 城域网, 手册', '基础', [], [], []],
  ['man-made', 'adj.', '人造的，人工的', '基础', [], [], []],
  ['manage', 'v. /\'mænidʒ/', 'vi. 处理；vt. 管理, 控制, 维持, 达成, 经营, 运用', '基础', [], [], []],
  ['manager', 'n. /\'mænidʒә/', 'n. 经理, 管理员, 管理器；[计] 管理器', '基础', [], [], []],
  ['mankind', 'n. /mæn\'kaind/', 'n. 人类, 男性', '基础', [], [], []],
  ['manner', 'n. /\'mænә/', 'n. 样子, 礼貌, 风格；[法] 方式, 方法, 样式', '基础', [], [], []],
  ['many', 'pron. adj. /\'meni/', 'n. 多数, 多数人；a. 许多的；pron. 许多', '基础', [], [], []],
  ['map', 'n. /mæp/', 'n. 地图, 天体图, 映像；vt. 映射, 绘制...地图, 计划；[计] 实用程序, 映射, 制造自动化协议', '基础', [], [], []],
  ['marathon', 'n. /\'mærәθәn/', 'n. 马拉松, 耐力的考验', '基础', [], [], []],
  ['march', 'v. n. /mɑ:tʃ/', 'n. 三月, 进行, 行军, 步伐, 长途跋涉, 进行曲, 边界；vi. 进军, 前进, 交界；vt. 使行军, 使行进', '基础', [], [], []],
  ['margin', 'n.', '页边空白；差额；余地，余裕；边，边缘', '基础', [], [], []],
  ['mark', 'n. vt. /mɑ:k/', 'n. 标志, 分数, 马克, 痕迹, 斑点, 靶子, 刻度, 记号, 符号, 戳记, 标准, 起跑线；vt. 做标记于, 留意, 打分数, 表明, 标志, 记录；vi. 作记号, 记得分；[计] 标志; 标记; 传号', '基础', [], [], []],
  ['market', 'n. /\'mɑ:kit/', 'n. 市场, 交易, 集市, 推销地区, 行情, 市面, 销路；vt. 在市场上交易, 使上市, 销售；vi. 在市场上买卖', '基础', [], [], []],
  ['marriage', 'n. /\'mæridʒ/', 'n. 婚姻, 结婚, 婚礼, 合并；[医] 婚姻, 结婚', '基础', [], [], []],
  ['marry', 'v. /\'mæri/', 'vt. 与...结婚, 娶, 嫁；vi. 结婚', '基础', [], [], []],
  ['marvellous', 'adj.', '奇迹般的，惊人的，了不起的', '基础', [], [], []],
  ['mask', 'n. v. /mæsk/', 'n. 面具, 假面具, 掩饰, 石膏面模；vt. 戴面具, 掩饰, 使模糊；vi. 化装, 戴面具, 掩饰, 参加化装舞会；[计] 屏蔽; 掩码', '基础', [], [], []],
  ['mass', 'n. /mæs/', 'n. 块, 大多数, 质量, 大量, 群众, 弥撒；a. 群众的, 大规模的, 整个的；vt. 使集合, 集中；vi. 聚集', '基础', [], [], []],
  ['massive', 'adj.', '大的，大而重的，大块的；大规模的', '基础', [], [], []],
  ['mat', 'n. /mæt/', 'n. 垫, 丛, 衬边；a. 粗糙的, 无光泽的；vi. 纠缠在一起；vt. 铺席于...上, 使无光泽, 使缠结', '基础', [], [], []],
  ['match', 'vt. n. /mætʃ/', 'n. 比赛, 火柴, 对手；vt. 使相配, 使比赛, 与...竞争；vi. 结婚, 相配；[计] 比较', '基础', [], [], []],
  ['material', 'n. /mә\'tiәriәl/', 'n. 材料, 物资, 素材, 布料, 资料；a. 物质的, 肉体的, 重要的', '基础', [], [], []],
  ['mathematics', 'n.', '（常作单数用）数学，（英美口语）数学', '基础', [], [], []],
  ['matter', 'n. vi. /\'mætә/', 'n. 事件, 物质, 原因, 素材, 实体, 重要；vi. 有关系', '基础', [], [], []],
  ['mature', 'adj. /mә\'tjuә/', 'a. 成熟的, 到期的, 充分考虑的；vt. 使成熟；vi. 成熟, 到期', '基础', [], [], []],
  ['maximum', 'adj. & n. /\'mæksimәn/', 'n. 极点, 最大量, 极大；a. 最高的, 最大的, 最大极限的；[计] 最大值', '基础', [], [], []],
  ['may', 'v. /mei/', 'n. 五月；aux. 愿能, 可以, 愿意', '基础', [], [], []],
  ['maybe', 'adv. /\'meibi:/', 'adv. 也许, 大概；n. 可能性', '基础', [], [], []],
  ['me', 'pron. /mi:/', 'pron. 我', '基础', [], [], []],
  ['meal', 'n. /mi:l/', 'n. 一餐, 膳食, 粗粉；vi. 进餐', '基础', [], [], []],
  ['mean', 'vt. adj. /mi:n/', 'a. 低劣的, 卑贱的, 简陋的, 吝啬的, 惭愧的, 平均的, 中间的, 普通的；vt. 意谓, 想要, 意欲, 预定；vi. 用意, 有意义；n. 平均数, 中间, 中庸', '基础', [], [], []],
  ['meaning', 'n. /\'mi:niŋ/', 'n. 意义, 含义, 目的, 意图；a. 意味深长的', '基础', [], [], []],
  ['means', 'n. /mi:nz/', 'n. 方法, 手段, 工具, 财产, 收入；[经] 方法, 手段, 工具; 意谓', '基础', [], [], []],
  ['meanwhile', 'adv. /\'mi:nhwail/', 'n. 其时, 其间；adv. 同时, 于此时', '基础', [], [], []],
  ['measure', 'v. n. /\'meʒә/', 'n. 尺寸, 量度器, 量度标准, 测量, 量具, 程度, 范围, 限度, 分寸, 措施, 方法；vt. 测量, 测度, 估量, 权衡, 调节, 拿(自己或自己的力量等)作较量；vi. 度量', '基础', [], [], []],
  ['meat', 'n. /mi:t/', 'n. 肉, 餐, 食物；[经] 肉类', '基础', [], [], []],
  ['medal', 'n. /\'medl/', 'n. 奖牌, 勋章；vt. 授勋予', '基础', [], [], []],
  ['media', 'n. /\'mi:diә/', 'n. 媒体；[计] 媒质', '基础', [], [], []],
  ['medical', 'adj. /\'medikl/', 'n. 医生, 体格检查；a. 医学的, 内科的, 药的', '基础', [], [], []],
  ['medicine', 'n. /\'medisin/', 'n. 药, 医学, 内科；vt. 给...用药', '基础', [], [], []],
  ['medium', 'n. adj. /\'mi:diәm/', 'n. 媒体, 方法, 媒介；a. 半生熟的, 中间的；[计] 媒体, 中', '基础', [], [], []],
  ['meet', 'vt. vi. n. /mi:t/', 'n. 会, 集会；a. 适宜的, 合适的；vt. 遇见, 引见, 认识, 满足, 对付；vi. 相遇, 接触', '基础', [], [], []],
  ['meeting', 'n. /\'mi:tiŋ/', 'n. 会议, 会面；[法] 会议, 会谈, 集会', '基础', [], [], []],
  ['melon', 'n. /\'melәn/', 'n. 瓜, 甜瓜, 红利, 赃物；[化] 三聚二氰亚胺', '基础', [], [], []],
  ['member', 'n. /\'membә/', 'n. 成员, 会员；[医] │肢, 肢体', '基础', [], [], []],
  ['membership', 'n.', '会员身份，会籍；全体会员，会员数', '基础', [], [], []],
  ['memorize', 'v. /\'memәraiz/', 'vt. 记住, 熟记, 背熟', '基础', [], [], []],
  ['memory', 'n. /\'memәri/', 'n. 记忆, 记忆力, 回忆, 纪念, 存储；n. 内存；[计] 存储器, 内存, 查看内存实用程序', '基础', [], [], []],
  ['mend', 'v. /mend/', 'n. 改进, 修补, 好转；vt. 修改, 改进, 加快, 修理；vi. 好转, 改善', '基础', [], [], []],
  ['mental', 'adj. /\'mentl/', 'a. 心智的, 精神病的, 心理的, 颏的；n. 精神病患者', '基础', [], [], []],
  ['mention', 'n. vt. /\'menʃәn/', 'n. 提到, 言及, 陈述；vt. 提到, 提及', '基础', [], [], []],
  ['menu', 'n. /\'menju:/', 'n. 菜单, (功能)选择单；[计] 菜单', '基础', [], [], []],
  ['merchant', 'adj. n. /\'mә:tʃәnt/', 'n. 商人, 店主；a. 商业的, 商人的', '基础', [], [], []],
  ['merciful', 'adj. /\'mә:siful/', 'a. 仁慈的, 慈悲的', '基础', [], [], []],
  ['mercy', 'n. /\'mә:si/', 'n. 仁慈, 宽恕, 慈悲, 怜悯, 幸运；[法] 权宜处置权, 决定权, 宽恕', '基础', [], [], []],
  ['merely', 'adv. /\'miәli/', '仅仅，只不过', '基础', [], [], []],
  ['merry', 'adj. /\'meri/', 'a. 快乐的, 愉快的, 嬉戏作乐的', '基础', [], [], []],
  ['mess', 'n. /mes/', 'n. 食堂, 伙食, 用膳, 一份食品, 混乱, 乱七八糟, 困境；vt. 将...弄糟, 妨碍, 使紊乱, 使就餐；vi. 陷入困境, 搞乱, 用膳', '基础', [], [], []],
  ['message', 'n. /\'mesidʒ/', 'n. 消息, 通讯, 讯息, 教训, 预言, 广告词；vt. 通知；vi. 通报, 报告, 报信；[计] 报文; 消息; 信息', '基础', [], [], []],
  ['metal', 'n. adj. /\'metәl/', 'n. 金属, 金属制品, 合金, 本质, 质料；a. 金属制的；vt. 以金属覆盖', '基础', [], [], []],
  ['method', 'n. /\'meθәd/', 'n. 方法, 办法, 条理, 秩序；[医] [方]法', '基础', [], [], []],
  ['metre', 'n. /\'mi:tә/', 'n. 公尺, 格律, 韵律；[医] 米, 公尺', '基础', [], [], []],
  ['microscope', 'n. /\'maikrәuskәup/', 'n. 显微镜；[化] 显微镜', '基础', [], [], []],
  ['microwave', 'n. /\'maikrәuweiv/', 'n. 微波；[计] 微波', '基础', [], [], []],
  ['middle', 'n. /\'midl/', 'n. 中央, 中间, 腰部；a. 中央的, 中庸的, 中间的', '基础', [], [], []],
  ['midnight', 'n. /\'midnait/', 'n. 午夜, 子夜, 半夜；a. 午夜的, 半夜的', '基础', [], [], []],
  ['might', 'aux. /mait/', 'n. 力量, 权力；aux. 可能, 也许', '基础', [], [], []],
  ['migration', 'n.', '迁移；移居', '基础', [], [], []],
  ['mild', 'adj. /maild/', 'a. 温和的, 温柔的, 淡味的, 适度的, 轻微的, (肥皂等)软性的；[医] 轻的, 缓和的', '基础', [], [], []],
  ['mile', 'n. /mail/', 'n. 英里, 很大距离；[机] 英里, 哩', '基础', [], [], []],
  ['military', 'adj. n.', '军事的，军用的 军队，武装力量', '基础', [], [], []],
  ['milk', 'n. vt. /milk/', 'n. 奶, 乳状物；vt. 挤乳, 榨取；vi. 产乳', '基础', [], [], []],
  ['millimetre', 'n.', '毫米', '基础', [], [], []],
  ['millionaire', 'n. /.miljә\'nєә/', 'n. 百万富翁, 大富豪；[经] 大资本家, 巨富, 百万富翁', '基础', [], [], []],
  ['mind', 'n. v. /maind/', 'n. 思想, 愿望, 智力, 记忆, 心理, 情绪, 理智, 主意, 心意；vi. 介意, 注意, 留心；vt. 注意, 留意, 专心于, 照看, 介意', '基础', [], [], []],
  ['mine', 'n. vt. pron. /main/', 'n. 矿, 矿藏, 地雷；vt. 挖掘, 开采, 在...布雷, 破坏；vi. 开矿, 埋设地雷；pron. 我的', '基础', [], [], []],
  ['mineral', 'n. /\'minәrәl/', 'n. 矿物, 无机物, 苏打水；a. 矿物的, 似矿物的', '基础', [], [], []],
  ['minibus', 'n. /\'minibʌs/', 'n. 中客车, 小型公共汽车', '基础', [], [], []],
  ['minimum', 'adj. & n. /\'minimәm/', 'a. 最小的, 最低的；n. 最小值；[计] 最小值', '基础', [], [], []],
  ['minister', 'n. /\'ministә/', 'n. 部长, 牧师, 公使；vi. 服侍, 救助, 主持宗教仪式', '基础', [], [], []],
  ['ministry', 'n. /\'ministri/', 'n. 部, 内阁, 服务；[经] 部', '基础', [], [], []],
  ['minor', 'adj. n. vi.', '较小的；次要的 未成年人 副修', '基础', [], [], []],
  ['minority', 'n. /mai\'nɒriti/', 'n. 少数, 未成年, 少数民族；a. 少数的, 属于少数派的', '基础', [], [], []],
  ['minus', 'prep. & adj. /\'mainәs/', 'n. 负号, 不足；a. 减的, 负的, 阴性的；prep. 减, 缺；[计] 负差', '基础', [], [], []],
  ['minute', 'n. /\'minit. mai\'nju:t/', 'n. 分, 分钟, 片刻, 备忘录, 笔记；vt. 记录, 摘录, 测定时间；a. 微小的, 详细的', '基础', [], [], []],
  ['mirror', 'n. /\'mirә/', 'n. 镜子, 写真, 典范；vt. 反映, 映出', '基础', [], [], []],
  ['misery', 'n.', '痛苦，苦恼，苦难；悲惨的境遇，贫苦', '基础', [], [], []],
  ['mist', 'n. /mist/', 'n. 雾, 迷蒙, 朦胧不清；vt. 使模糊, 使蒙上雾；vi. 变模糊, 下雾', '基础', [], [], []],
  ['mistake', 'n. vt. /mis\'teik/', 'n. 错误, 误会；vi. 犯错, 误认；vt. 误解, 弄错；[计] 错误', '基础', [], [], []],
  ['mistaken', 'adj. /mis\'teikәn/', 'a. 犯错的, 错误的；mistake的过去分词', '基础', [], [], []],
  ['misunderstand', 'v. /.misʌndә\'stænd/', 'vt. 误解, 误会', '基础', [], [], []],
  ['mix', 'v. /miks/', 'n. 混合物, 混乱, 糊涂；vt. 使混合, 弄混, 使结合, 混淆；vi. 相混合, 交往, 参与', '基础', [], [], []],
  ['mixture', 'n. /\'mikstʃә/', 'n. 混合, 混淆, 混合物；[化] 混合物', '基础', [], [], []],
  ['mobile', 'adj. /\'mәubil/', 'a. 移动的, 易变的, 机动的；n. 活动物体', '基础', [], [], []],
  ['model', 'n. /\'mɒdәl/', 'n. 模型, 模范, 模特儿；a. 模范的, 作模型用的；vi. 做模型, 做模特儿；vt. 使模仿, 塑造；[计] 模型', '基础', [], [], []],
  ['modem', 'n. /\'mәudem/', 'n. 调制解调器；[计] 调制解调器', '基础', [], [], []],
  ['modern', 'adj. /\'mɒdәn/', 'n. 现代人, 有思想的人；a. 现代的, 时髦的', '基础', [], [], []],
  ['modest', 'adj. /\'mɒdist/', 'a. 谦逊的, 羞怯的, 端庄的, 适度的；[经] 适当的', '基础', [], [], []],
  ['Mom', 'n.', '妈妈', '基础', [], [], []],
  ['moment', 'n. /\'mәumәnt/', 'n. 片刻, 瞬间, 重要, 阶段, 力矩；[医] 片刻, 瞬间, 时机, 因素, 矩', '基础', [], [], []],
  ['mommy', 'n.', '妈妈（美）', '基础', [], [], []],
  ['money', 'n. /\'mʌni/', 'n. 金钱, 一笔款, 财富, 货币, 金额；[经] 货币, 金钱, 财产', '基础', [], [], []],
  ['monitor', 'n. v. /\'mɒnitә/', 'n. 监督器, 级长, 监听员, 班长, 监视器, 告诫物；v. 监视, 监听, 监督；[计] 监视器, 监视程序; 监视', '基础', [], [], []],
  ['monkey', 'n. /\'mʌŋki/', 'n. 猴子, 猿, 打桩锤；vi. 淘气, 胡闹；vt. 嘲弄', '基础', [], [], []],
  ['month', 'n. /mʌnθ/', 'n. 月；[经] 月', '基础', [], [], []],
  ['monument', 'n. /\'mɒnjumәnt/', 'n. 纪念碑, 纪念物, 石碑', '基础', [], [], []],
  ['mood', 'n.', '心情，情绪', '基础', [], [], []],
  ['moon', 'n. /mu:n/', 'n. 月亮, 月球, 月光；vi. 闲荡；vt. 虚度', '基础', [], [], []],
  ['mop', 'n. & v. /mɒp/', 'n. 拖把, 鬼脸；vt. 用拖把洗擦, 擦, 拭；vi. 做鬼脸；[计] 维护操作协议', '基础', [], [], []],
  ['moral', 'adj. n. /\'mɒrәl/', 'n. 道德, 品行, 寓意；a. 道德的, 品性端正的, 精神上的', '基础', [], [], []],
  ['more', 'adj. & adv. n.', '另外的，附加的，较多的；再，另外，更（much／many 的比较级） 更多的量；另外的一些', '基础', [], [], []],
  ['moreover', 'adv.', '而且，再者，此外', '基础', [], [], []],
  ['morning', 'n. /\'mɒ:niŋ/', 'n. 早晨, 早上, 初期', '基础', [], [], []],
  ['mosquito', 'n. /mә\'ski:tәu/', 'n. 蚊子；[医] 蚊', '基础', [], [], []],
  ['mother', 'n. /\'mʌðә/', 'n. 母亲, 修女院长；vt. 产生, 照看, 收养', '基础', [], [], []],
  ['motherland', 'n. /\'mʌðәlænd/', 'n. 祖国', '基础', [], [], []],
  ['motivation', 'n. /.mәuti\'veiʃәn/', 'n. 动机, 刺激, 推动；[医] 促动, 推动, 诱导', '基础', [], [], []],
  ['motor', 'n. /\'mәutә/', 'n. 马达, 发动机, 原动力, 汽车；a. 马达的, 发动机的, 汽车的, 发动的；vt. 推动, 以汽车载运；vi. 乘汽车, 驾车', '基础', [], [], []],
  ['mountain', 'n. /\'mauntin/', 'n. 山, 山脉, 大堆', '基础', [], [], []],
  ['mountainous', 'adj. /\'mauntinәs/', 'a. 多山的, 如山的, 巨大的', '基础', [], [], []],
  ['mouse', 'n. /maus/', 'n. 老鼠, 胆小羞怯的人, 鼠标；vi. 捕鼠, 窥探；vt. 探出；[计] 鼠标', '基础', [], [], []],
  ['moustache', 'n. /\'mʌstæʃ/', 'n. 髭, 小胡子, 触须', '基础', [], [], []],
  ['mouth', 'n. /mauθ/', 'n. 嘴, 口, 口腔, 口状物；vi. 装腔作势说话, 做鬼脸；vt. 说出, 做作地说', '基础', [], [], []],
  ['move', 'v. /mu:v/', 'n. 移动, 迁居, 步骤；vt. 移动, 开动, 感动, 搬(家)；vi. 移动, 离开, 运行, 迁移, 摇动, 搬家, 交往, 进展, 脱手；[计] 移动; 传送; DOS外部命令:移动文件, 它可将文件移动到指定的地方', '基础', [], [], []],
  ['movement', 'n. /\'mu:vmәnt/', 'n. 运动, 动作, 运转, 移动, 倾向, 变化, 活动, 乐章；[医] 运动', '基础', [], [], []],
  ['movie', 'n. /\'mu:vi/', '（口语）电影', '基础', [], [], []],
  ['Mr.', 'n. /\'mistә(r)/', '先生（用于姓名前）', '基础', [], [], []],
  ['Mrs.', 'n.', '夫人，太太（称呼已婚妇女）', '基础', [], [], []],
  ['Ms.', 'n. /miz/', '女士（用在婚姻状况不明的女子姓名前）', '基础', [], [], []],
  ['mud', 'n. /mʌd/', 'n. 泥, 诽谤；vt. 弄脏', '基础', [], [], []],
  ['muddy', 'adj. /\'mʌdi/', 'a. 泥泞的, 浑浊的, 模糊的；vt. 使污浊, 使沾上泥污', '基础', [], [], []],
  ['mug', 'n. vt.', '大杯 对…行凶抢劫', '基础', [], [], []],
  ['multiply', 'vt. /\'mʌltiplai/', 'v. 繁殖, 乘, 增加；[计] 乘', '基础', [], [], []],
  ['mum', 'n.', '（口语）妈妈', '基础', [], [], []],
  ['mummy', 'n.', '木乃伊；妈妈', '基础', [], [], []],
  ['murder', 'vt. /\'mә:dә/', 'n. 谋杀；vt. 谋杀, 损毁, 破坏；vi. 犯杀人罪', '基础', [], [], []],
  ['muscle', 'n.', '肌肉', '基础', [], [], []],
  ['museum', 'n. /mju:\'ziәm/', '博物馆，博物院', '基础', [], [], []],
  ['mushroom', 'n. /\'mʌʃrum/', 'n. 蘑菇形物, 蘑菇, 暴发户；vi. 迅速生长, 迅速增加, 采蘑菇；a. 蘑菇形的, 迅速生长的', '基础', [], [], []],
  ['music', 'n. /\'mju:zik/', 'n. 音乐, 乐曲', '基础', [], [], []],
  ['musical', 'adj. n. /\'mju:zikl/', 'n. 音乐片, 音乐舞台剧；a. 音乐的, 声音美妙的, 喜爱音乐的', '基础', [], [], []],
  ['musician', 'n. /mju:\'ziʃәn/', 'n. 音乐家, 乐师, 作曲家', '基础', [], [], []],
  ['must', 'v.', '必须，应当；必定是', '基础', [], [], []],
  ['mutton', 'n. /\'mʌtn/', 'n. 羊肉', '基础', [], [], []],
  ['my', 'pron. /mai/', 'pron. 我的；[医] 迈尔(热容单位)', '基础', [], [], []],
  ['myself', 'pron. /mai\'self/', 'pron. 我自己, 我亲自, 我独自', '基础', [], [], []],
  ['mystery', 'n.', '神秘（性），神秘的人（或事物）', '基础', [], [], []],
  ['nail', 'n. /neil/', 'n. 钉子, 指甲；vt. 用钉钉牢, 使固定, 截住, 揭露', '基础', [], [], []],
  ['name', 'n. vt. /neim/', 'n. 名字, 名称, 姓名, 名义, 名誉, 文件名；vt. 命名, 称呼, 任命, 提名, 列举；a. 姓名的, 据以取名的；[计] 名称, 文件名, 姓名', '基础', [], [], []],
  ['narrow', 'adj. /\'nærәu/', 'n. 狭窄部分, 隘路；a. 狭窄的, 仔细的, 有限的, 勉强的, 狭隘的, 手紧的；vi. 变窄；vt. 使变狭窄', '基础', [], [], []],
  ['nasty', 'adj.', '令人讨厌的', '基础', [], [], []],
  ['nation', 'n. /\'neiʃәn/', 'n. 国家, 民族；[法] 民族, 国家', '基础', [], [], []],
  ['national', 'adj. /\'næʃәnәl/', 'a. 国家的, 国立的, 全国性的, 民族的；[经] 全国性的, 国家的, 国民的', '基础', [], [], []],
  ['nationality', 'n. /.næʃә\'nælәti/', 'n. 国籍, 国家, 民族性；[法] 国家, 民族, 国民', '基础', [], [], []],
  ['nationwide', 'adj. /\'neiʃәnwaid/', 'a. 全国性的；[法] 全国的, 全国范围的', '基础', [], [], []],
  ['native', 'adj. /\'neitiv/', 'n. 本地人, 土产, 当地人；a. 本国的, 与生俱来的, 自然的', '基础', [], [], []],
  ['natural', 'adj. /\'nætʃәrәl/', 'n. 白痴；a. 自然的, 自然界的, 本能的, 天然的, 物质的, 正常的, 原始的, 自然数的', '基础', [], [], []],
  ['nature', 'n. /\'neitʃә/', 'n. 自然, 大自然, 本性, 性格, 性质；[医] 自然, 大自然; 本性, 性能', '基础', [], [], []],
  ['navy', 'n. /\'neivi/', 'n. 海军, 海军人员, 海军军力, 烟蒂', '基础', [], [], []],
  ['near', 'adj. adv. prep. /niә/', 'a. 近的, 近亲的, 近似的；adv. 接近, 亲近；prep. 靠近, 近似于；v. 接近, 走近', '基础', [], [], []],
  ['nearby', 'adj. /\'niәbai/', 'a. 附近的, 近旁的；adv. 在附近, 近旁地；prep. 在...附近', '基础', [], [], []],
  ['nearly', 'adv. /\'niәli/', 'adv. 几乎, 密切地', '基础', [], [], []],
  ['neat', 'adj. /ni:t/', 'a. 整洁的, 巧妙的, 匀称的, 简洁的；n. 牛', '基础', [], [], []],
  ['necessary', 'adj. /\'nesisәri/', 'a. 必要的；必然的；必需的', '基础', [], [], []],
  ['neck', 'n. /nek/', 'n. 脖子, 衣领, 颈；vi. 拥抱, 拥吻, 收缩；vt. 割颈', '基础', [], [], []],
  ['necklace', 'n. /\'neklis/', 'n. 项链', '基础', [], [], []],
  ['need', 'n. aux. & v. /ni:d/', 'n. 需要, 必须, 缺乏；vt. 需要, 必需；vi. 贫困, 有必要；aux. 需要', '基础', [], [], []],
  ['needle', 'n. /\'ni:dl/', 'n. 针, 尖；vt. 用针缝；vi. 缝纫；[计] 探针', '基础', [], [], []],
  ['negative', 'adj.', '否定的；消极的；负的', '基础', [], [], []],
  ['negotiate', 'v. /ni\'gәuʃieit/', 'vi. 商议, 谈判, 交涉；vt. 谈妥, 转让, 处理', '基础', [], [], []],
  ['neighbour', 'n. /\'neibә/', 'n. 邻居, 邻接的东西, 邻国, 邻座, 邻人, 世人；a. 邻接的, 邻近的；vi.vt. 邻近, 与...结邻, 邻接', '基础', [], [], []],
  ['neighbourhood', 'n. /\'neibәhud/', 'n. 邻接, 周围, 附近一带, 邻近, 邻居关系, 地区, 街道, 街坊, 四邻；[计] 邻域', '基础', [], [], []],
  ['neither', 'adj. /\'naiðә/', 'adv. 皆不, 两个都不；a. (两者)都不的；pron. 两者都不；conj. 既非, 既不', '基础', [], [], []],
  ['nephew', 'n. /\'nefju:/', 'n. 侄子, 外甥', '基础', [], [], []],
  ['nervous', 'adj. /\'nә:vәs/', 'a. 神经紧张的, 不安的, 神经的；[医] 神经的; 神经质的, 神经过敏的', '基础', [], [], []],
  ['nest', 'n. /nest/', 'n. 巢, 窝, 休息所, 隐匿处；vi. 筑巢, 找鸟巢；vt. 为...设窝, 使套叠；[计] 嵌套', '基础', [], [], []],
  ['net', 'n. /net/', 'n. 网, 网状物, 罗网, 净利, 净价；a. 净的, 最终的；vt. 用网捕, 撒网, 净赚, 得到；vi. 编网；[计] 网络, 网络分析程序', '基础', [], [], []],
  ['network', 'n. /\'netwә:k/', 'n. 网络, 广播网, 网状物；[计] 网络', '基础', [], [], []],
  ['never', 'adv. /\'nevә/', 'adv. 从不, 决不, 不曾；[法] 永不, 决不, 从来没有', '基础', [], [], []],
  ['nevertheless', 'adv.', '仍然，不过，然而', '基础', [], [], []],
  ['new', 'adj. /nju:/', 'a. 新的, 陌生的, 最近的, 不熟悉的；[法] 新发现的, 新的, 重新开始的', '基础', [], [], []],
  ['news', 'n. /nju:z/', 'n. 新闻, 消息, 报导；[法] 新闻, 消息, 新闻报导', '基础', [], [], []],
  ['newspaper', 'n. /\'nju:z.peipә/', 'n. 报纸', '基础', [], [], []],
  ['next', 'adj. adv. n. /\'nekst/', 'n. 下一个；a. 下一个的, 其次的, 贴近的；adv. 然后, 下次, 次于；[计] 近邻干扰', '基础', [], [], []],
  ['nice', 'adj. /nais/', 'a. 美好的, 和蔼的, 正派的, 做得好的, 精密的, 细微的, 挑剔的, 谨慎的', '基础', [], [], []],
  ['niece', 'n. /ni:s/', 'n. 侄女, 甥女', '基础', [], [], []],
  ['night', 'n. /nait/', 'n. 夜, 夜晚, 晚上, 黑暗, 夜晚的工作；[法] 夜, 黑夜, 黑暗', '基础', [], [], []],
  ['night-club', 'n.', '夜总会', '基础', [], [], []],
  ['nine', 'num. /nain/', 'num. 九, 九个', '基础', [], [], []],
  ['nineteen', 'num. /.nain\'ti:n/', 'num. 十九, 十九个', '基础', [], [], []],
  ['ninety', 'num. /\'nainti/', 'num. 九十, 九十个', '基础', [], [], []],
  ['ninth', 'num. /nainθ/', 'num. 第九, 九分之一', '基础', [], [], []],
  ['no', 'adv. adj. /nәu/', 'n. 不, 拒绝, 否决票；a. 没有, 不是, 绝非；adv. 不', '基础', [], [], []],
  ['noble', 'adj. /\'nәubl/', 'n. 贵族；a. 高贵的, 高尚的, 贵族的, 辉煌的', '基础', [], [], []],
  ['nobody', 'n. pron. /\'nәubɒdi/', 'n. 小人物, 无名小卒；pron. 无人, 没有人', '基础', [], [], []],
  ['nod', 'vi. /nɒd/', 'n. 点头, 打盹, 晃动；vi. 点头, 打盹；vt. 点头表示, 点(头)', '基础', [], [], []],
  ['noise', 'n. /nɒiz/', 'n. 噪音, 杂音, 响声, 喧闹；vt. 谣传；vi. 喧闹；[计] 噪声', '基础', [], [], []],
  ['noisily', 'adv. /\'nɒizili/', 'adv. 吵闹地', '基础', [], [], []],
  ['noisy', 'adj. /\'nɒizi/', 'a. 嘈杂的, 喧闹的；[机] 噪声的, 嘈杂的', '基础', [], [], []],
  ['non-stop', 'adj. & adv.', '不停的，不断地', '基础', [], [], []],
  ['non-violent', 'adj.', '非暴力的', '基础', [], [], []],
  ['none', 'pron. /nʌn/', 'adv. 一点也不, 毫不；pron. 没有人, 无一物, 并无一个；a. 没有的', '基础', [], [], []],
  ['nonsense', 'n. int.', '胡说；胡闹，愚蠢的举动，无价值（或不重要）的东西 胡说！废话！', '基础', [], [], []],
  ['noodle', 'n. /\'nu:dl/', 'n. 面条, 笨蛋', '基础', [], [], []],
  ['noon', 'n. /nu:n/', 'n. 正午, 中午, 全盛期', '基础', [], [], []],
  ['nor', 'conj. /nɒ:/', 'conj. 也不, 也没有；[计] 或非', '基础', [], [], []],
  ['normal', 'n. & adj. /\'nɒ:ml/', 'n. 常态, 标准, 正常, 普通；a. 正常的, 正规的, 标准的, 师范的, 正态的；[计] 标准, 普通', '基础', [], [], []],
  ['north', 'adj. adv. n.', '北的；朝北的；从北来的 向（在，从）北方 北；北方；北部', '基础', [], [], []],
  ['northeast', 'n. /.nɒ:θ\'i:st/', 'n. 东北；a. 东北的, 向东北的, 来自东北的；adv. 向东北, 来自东北', '基础', [], [], []],
  ['northern', 'adj. /\'nɒ:ðәn/', 'n. 北方人；a. 北方的, 向北的, 自北方来的', '基础', [], [], []],
  ['northwards', 'adv. /\'nɔ:θwәdz/', 'adv. 向北方', '基础', [], [], []],
  ['northwest', 'n. /.nɒ:θ\'west/', 'n. 西北, 西北方；a. 西北的, 在西北的, 来自西北的；adv. 向西北', '基础', [], [], []],
  ['nose', 'n. /nәuz/', 'n. 鼻子, 突出部分, 嗅觉；vt. 嗅到, 探出, 用鼻子触；vi. 闻, 嗅, 探听, 告密', '基础', [], [], []],
  ['not', 'adv. /nɒt/', 'adv. 不, 非, 未；[计] 非', '基础', [], [], []],
  ['note', 'n. vt. /nәut/', 'n. 笔记, 记录, 注解, 票据, 符号, 显要, 注重, 便笺, 照会；vt. 记录, 注解, 注意', '基础', [], [], []],
  ['notebook', 'n. /\'nәutbuk/', 'n. 笔记本, 手册, 期票簿', '基础', [], [], []],
  ['nothing', 'n. adv. /\'nʌθiŋ/', 'n. 无, 不关紧要之事, 零；adv. 毫不, 决不；interj. 什么也没有, 无', '基础', [], [], []],
  ['notice', 'n. vt. /\'nәutis/', 'n. 注意, 布告, 通知, 预告, 短评；vt. 注意, 通知, 评论, 提及, 关注；vi. 注意', '基础', [], [], []],
  ['novel', 'n. /\'nɒvl/', 'n. 小说, 长篇故事；a. 新奇的, 异常的', '基础', [], [], []],
  ['novelist', 'n. /\'nɒvәlist/', 'n. 小说家', '基础', [], [], []],
  ['November', 'n. /nәu\'vembә/', 'n. 十一月', '基础', [], [], []],
  ['now', 'adv. /nau/', 'adv. 现在, 刚才, 目前；n. 现在；a. 现在的；conj. 由于', '基础', [], [], []],
  ['nowadays', 'adv. /\'nauәdeiz/', 'n. 现在, 现时, 当今；adv. 时下, 现今', '基础', [], [], []],
  ['nowhere', 'adv. /\'nәuhwєә/', 'adv. 无处, 到处都无', '基础', [], [], []],
  ['nuclear', 'adj. /\'nju:kliә/', 'a. 核子的, 原子能的, 核的, 中心的；[医] 核的', '基础', [], [], []],
  ['numb', 'adj. /nʌm/', 'a. 麻木的, 失去知觉的；vt. 使麻木, 使昏迷, 使失去知觉', '基础', [], [], []],
  ['number', 'n. /\'nʌmbә/', 'n. 数, 数字, 数目, 号码；vt. 数, 计算, 共计；vi. 计算, 报数；[计] 数字', '基础', [], [], []],
  ['nurse', 'n. /nә:s/', 'n. 护士, 保姆, 奶妈；vt. 看护, 照顾, 培养；vi. 喂奶, 看护病人', '基础', [], [], []],
  ['nursery', 'n. /\'nә:sәri/', 'n. 托儿所, 苗圃, 温床；[医] 婴儿室, 托儿所', '基础', [], [], []],
  ['nursing', 'n. /\'nә:siŋ/', 'n. 看护, 养育；[医] 护理[法], 喂乳[法]', '基础', [], [], []],
  ['nut', 'n. /nʌt/', 'n. 坚果, 核心, 螺帽；[计] Novell NetWare服务器实用程序', '基础', [], [], []],
  ['nutrition', 'n. /nju:\'triʃәn/', 'n. 营养, 营养学；[医] 营养, 营养品', '基础', [], [], []],
  ['nylon', 'n. /\'nailɒn/', 'n. 尼龙；[化] 尼龙; 聚酰胺纤维', '基础', [], [], []],
  ['o\'clock', 'adv.', '点钟', '基础', [], [], []],
  ['obey', 'v. /ә\'bei/', 'vt. 服从, 遵从, 顺从；vi. 服从', '基础', [], [], []],
  ['object', 'n. /\'ɒbdʒekt/', 'n. 物体, 目标, 目的, 对象, 宾语, 客体；vi. 反对, 抱反感；vt. 提出...来反对；[计] 对象', '基础', [], [], []],
  ['observe', 'v. /әb\'zә:v/', 'vt. 觉察到, 遵守, 注意到, 庆祝；vi. 注意, 评论', '基础', [], [], []],
  ['obtain', 'vt. /әb\'tein/', 'vt. 获得, 达到；vi. 流行, 得到公认', '基础', [], [], []],
  ['obvious', 'adj. /\'ɒbviәs/', 'a. 明显的, 明白的, 显然的, 平淡无奇的', '基础', [], [], []],
  ['occasion', 'n. vt.', '场合；时机 引起；惹起', '基础', [], [], []],
  ['occupation', 'n. /.ɒkju\'peiʃәn/', 'n. 职业, 占有, 占有期, 占领, 占领军；[经] 占有, 占用, 职业', '基础', [], [], []],
  ['occupy', 'vt.', '占领，占据，占（时间，空间）；占用；住，（常与 oneself 连用或作被动式）……', '基础', [], [], []],
  ['occur', 'vi. /ә\'kә:/', 'vi. 发生, 被想到, 存在', '基础', [], [], []],
  ['ocean', 'n. /\'әuʃәn/', 'n. 海洋, 广阔, 许多, 一大片；[法] 海洋, 海', '基础', [], [], []],
  ['Oceania', 'n. /.әuʃi\'æniә/', 'n. 大洋洲', '基础', [], [], []],
  ['October', 'n. /ɒk\'tәubә/', 'n. 十月', '基础', [], [], []],
  ['odd', 'adj.', '奇特的，古怪的，单只的，不成对的，零散的，奇数的，单数的，临时的', '基础', [], [], []],
  ['of', 'prep. /ɒv/', '（表所属，数量，）…. 的', '基础', [], [], []],
  ['off', 'prep. adv. /ɒf/', 'a. 关着的, 不再生效的, 处于...境况的, 休假的, 空闲的；adv. 走开, ...掉, ...下, 休息, 出发, 隔断；prep. 离开, 脱落, 不在从事......, 在...之外；vi. 离开, 滚开；vt. 杀死；n. 关闭状态；[计] 关闭, 清屏命令', '基础', [], [], []],
  ['offence', 'n. /ә\'fens/', 'n. 犯罪, 冒犯, 违反, 罪过, 过错, 攻击；[法] 犯法, 罪过, 过错', '基础', [], [], []],
  ['offer', 'n. & vt. /\'ɒfә/', 'n. 给予(物), 出价, 提议, 意图, 报价；vt. 提供, 出价, 奉献, 试图, 使出现, 演出；vi. 出现, 献祭, 提议, 求婚', '基础', [], [], []],
  ['office', 'n. /\'ɒfis/', 'n. 办公室, 部, 公职, 职责；[化] 办公室', '基础', [], [], []],
  ['officer', 'n. /\'ɒfisә/', 'n. 军官, 主管, 官员, 公务员；vt. 指挥', '基础', [], [], []],
  ['official', 'n. adj. /ә\'fiʃәl/', 'n. 官员, 公务员, 职员；a. 公务的, 官方的, 正式的', '基础', [], [], []],
  ['offshore', 'adj. /ɒ:f\'ʃɒ:/', 'a. 海面的, 吹向海面的, 近海的；adv. 向海面', '基础', [], [], []],
  ['often', 'adv. /\'ɒ:fn/', 'adv. 时常, 常常', '基础', [], [], []],
  ['oh', 'int. /әu/', 'interj. (表示惊讶、恐怖、赞叹)哦', '基础', [], [], []],
  ['oil', 'n. /ɒil/', 'n. 油, 石油, 油画颜料；vt. 涂油于, 使融化成油状, 加油于；vi. 加燃油, 融化', '基础', [], [], []],
  ['oilfield', 'n. /ˈɔɪlfi:ld/', 'n. 油田', '基础', [], [], []],
  ['OK', 'adv. /\'әu\'kei/', 'a. 好, 不错, 可以；adv. 好, 不错, 可以；n. 批准, 认可；[计] 确定', '基础', [], [], []],
  ['old', 'adj. /әuld/', 'n. 以前, 往昔；a. 老的, 旧的, 古老的, 年长的, 老练的', '基础', [], [], []],
  ['Olympic', 'adj. & n. /әu\'limpik/', 'a. 奥林匹亚的, 奥林匹斯山的, 强有力的, 巨大的', '基础', [], [], []],
  ['Olympic Games', 'n.', '奥运会', '基础', [], [], []],
  ['omelette', 'n. /\'ɒmlit/', 'n. 煎蛋卷, 炒蛋', '基础', [], [], []],
  ['on', 'prep. adv. /ɒn/', 'prep. 在...之上；adv. ...上去；a. 正起作用的；[计] 打开', '基础', [], [], []],
  ['once', 'n. & adv. conj. /wʌns/', 'adv. 一次, 曾经, 一旦；conj. 一旦, 一经；n. 一次；a. 从前的', '基础', [], [], []],
  ['one', 'pron. num. /wʌn/', 'n. 一(个)；pron. 一, 任何人；num. 一, 一个；a. 一致的, 完整的', '基础', [], [], []],
  ['oneself', 'pron. /wʌn\'self/', 'pron. 自己, 亲自', '基础', [], [], []],
  ['onion', 'n. /\'ʌnjәn/', 'n. 洋葱；vt. 因洋葱使掉泪', '基础', [], [], []],
  ['only', 'adj. adv. /\'әunli/', 'a. 唯一的, 仅有的, 最佳的；adv. 只有, 仅仅, 只能；conj. 但是, 不过', '基础', [], [], []],
  ['onto', 'prep. /\'ɒntu:/', 'prep. 在...之上', '基础', [], [], []],
  ['open', 'adj. vt. /\'әupәn/', 'n. 公开, 户外, 空旷；a. 开着的, 开放的, 开阔的, 营业着的, 公开的, 悬而未决的；vt. 打开, 公开, 开放；vi. 展开, 开始, 展现；[计] 打开指令; 打开语句', '基础', [], [], []],
  ['opener', 'n. /\'әupәnә/', 'n. 开...的人, 开局人, 开创人, 开具, 开启工具, 首项；[经] 申请开证人', '基础', [], [], []],
  ['opening', 'n. /\'әupәniŋ/', 'n. 开始, 口子, 穴, 揭幕；a. 开始的', '基础', [], [], []],
  ['opera', 'n. /\'ɒpәrә/', 'n. 歌剧', '基础', [], [], []],
  ['opera house', 'n.', '歌剧院，艺术剧院', '基础', [], [], []],
  ['operate', 'v. /\'ɒpәreit/', '做手术，运转；实施，负责，经营，管理', '基础', [], [], []],
  ['operation', 'n. /.ɒpә\'reiʃәn/', 'n. 操作, 动作, 手术, 运算, 作用, 业务；[计] 运算', '基础', [], [], []],
  ['operator', 'n. /\'ɒpәreitә/', 'n. 操作员, 行家, 经纪人, 算子, 运算符；[计] 运算符', '基础', [], [], []],
  ['opinion', 'n. /ә\'pinjәn/', 'n. 意见, 评价, 主张；[经] 意见', '基础', [], [], []],
  ['opportunity', 'n.', '机会；良机', '基础', [], [], []],
  ['oppose', 'vt. /ә\'pәuz/', 'vt. 反对, 以...对抗, 抗争；vi. 反对', '基础', [], [], []],
  ['opposite', 'n. adj. /\'ɒpәzit/', 'a. 相对的, 相反的, 对面的；prep. 对面；n. 对立面', '基础', [], [], []],
  ['opposition', 'n.', '反对；反抗；对抗，敌对；对立；意见相反', '基础', [], [], []],
  ['optimistic', 'adj. /.ɒpti\'mistik/', 'a. 乐观的, 乐观主义的, 乐天的', '基础', [], [], []],
  ['option', 'n.', '选择；选择权；选择自由，可选择的东西；选修科目', '基础', [], [], []],
  ['optional', 'adj. /\'ɒpʃәnl/', 'a. 可选择的, 随意的；[化] 选购的', '基础', [], [], []],
  ['or', 'conj. /ɒ:/', 'conj. 或, 或者；[计] 或', '基础', [], [], []],
  ['oral', 'adj. /\'ɒ:rәl/', 'n. 口试；a. 口头的, 口述的, 口部的', '基础', [], [], []],
  ['orange', 'n. adj. /\'ɒ:rindʒ/', 'n. 柑橘, 桔子, 橘色；a. 橘色的', '基础', [], [], []],
  ['orbit', 'n. /\'ɒ:bit/', 'n. 轨道, 常轨, 眼眶；vt. 绕...轨道而行；vi. 进入轨道, 盘旋', '基础', [], [], []],
  ['order', 'n. vt. /\'ɒ:dә/', 'n. 次序, 规则, 命令；vi. 命令, 定货；vt. 整理, 命令, 定购；n. 顺序, 阶数；[计] 顺序, 阶数', '基础', [], [], []],
  ['ordinary', 'adj. /\'ɒ:dinәri/', 'a. 平常的, 普通的, 平凡的；n. 平常的人(或事)', '基础', [], [], []],
  ['organ', 'n. /\'ɒ:gәn/', 'n. 风琴, 器官, 元件, 机构, 机关；[电] 风琴', '基础', [], [], []],
  ['organise', 'vt. /\'ɒ:gәnaiz/', 'vt. 组织, 有机化, 给予生机', '基础', [], [], []],
  ['organiser', 'n.', '[经] 组织者, 创立人, 发起人', '基础', [], [], []],
  ['organization', 'n. /.ɒ:gәnai\'zeiʃәn/', 'n. 组织, 结构, 团体, 体制；[医] 组织, 机构, 机化(血栓或坏死组织)', '基础', [], [], []],
  ['origin', 'n. /\'ɒridʒin/', 'n. 起源, 起因, 出身, 开端；[计] 原点; 起始地址; 信件来源的相关数据', '基础', [], [], []],
  ['original', 'adj. n.', '最初的，本来的，原始的，有独创性的，新颖的；奇特的，原作的 原物；原著；原画；原版；原著之语言；原文，原型', '基础', [], [], []],
  ['other', 'pron. adj. /\'ʌðә/', 'a. 其他的, 另外的, 从前的；pron. 其他的, 他人, 另外一个', '基础', [], [], []],
  ['otherwise', 'adv. /\'ʌðәwaiz/', 'adv. 否则, 不同地, 别的方式', '基础', [], [], []],
  ['Ottawa', 'n. /\'ɔtәwә/', 'n. 渥太华', '基础', [], [], []],
  ['ouch', 'int. /autʃ/', 'interj. 哎唷(表剧痛)；n. 扣环, 胸针, 珠宝饰物', '基础', [], [], []],
  ['ought', 'v. & aux. /ɒ:t/', 'aux. 应该, 大概；n. 责任', '基础', [], [], []],
  ['our', 'pron. /\'auә/', 'pron. 我们的', '基础', [], [], []],
  ['ours', 'pron. /\'auәz/', 'pron. 我们的', '基础', [], [], []],
  ['ourselves', 'pron. /.auә\'selvz/', 'pron. 我们自己', '基础', [], [], []],
  ['out', 'adv. /aut/', 'a. 外面的, 熄灭的, 结束的；adv. 在外, 熄灭, 出现；prep. 出自, 离去, 向', '基础', [], [], []],
  ['outcome', 'n. /\'autkʌm/', 'n. 结果, 出口', '基础', [], [], []],
  ['outdoors', 'adv. /\'aut\'dɒ:z/', 'n. 户外, 野外活动；adv. 在户外, 在野外', '基础', [], [], []],
  ['outer', 'adj. /\'autә/', 'a. 外部的, 外面的, 在外的, 远离中心的；[机] 外部的, 外面的, 外侧的', '基础', [], [], []],
  ['outgoing', 'adj. /\'autgәuiŋ/', 'n. 外出, 开支, 流出；a. 喜欢外出的, 即将离职的, 乐于助人的', '基础', [], [], []],
  ['outing', 'n. /\'autiŋ/', 'n. 郊游, 远足；a. 远足适用的', '基础', [], [], []],
  ['outline', 'n. /\'autlain/', 'n. 大纲, 轮廓, 概要；vt. 描画轮廓, 描述要点；n. 大纲, 分级, 轮廓；[计] 大纲, 分级, 轮廓', '基础', [], [], []],
  ['output', 'n. /\'autput/', 'n. 输出, 产品, 产量；[计] 输出', '基础', [], [], []],
  ['outside', 'n. adv. prep. /\'aut\'said/', 'n. 外面, 外表, 外界；a. 外面的, 外表的, 外界的；adv. 外面, 外表, 外界', '基础', [], [], []],
  ['outspoken', 'adj. /.aut\'spәukәn/', 'a. 直言无讳的, 坦率的, 坦白无隐的', '基础', [], [], []],
  ['outstanding', 'adj. /.aut\'stændiŋ/', 'a. 杰出的, 突出的, 未偿付的, 未决定的；[经] 未解决的, 未偿付', '基础', [], [], []],
  ['outward', 'adj. /\'autwәd/', 'a. 向外的, 表面的, 外服的；adv. 向外, 在外, 表面', '基础', [], [], []],
  ['over', 'prep. adv. /\'әuvә/', 'adv. 结束, 越过, 从头到尾；prep. 在...之上, 遍于...之上, 越过；a. 上面的；vt. 越过', '基础', [], [], []],
  ['overall', 'adj. adv. n.', '全部的，全体的，全面的 总体地，大体说来 工作裤，工作服；防护服，罩衫', '基础', [], [], []],
  ['overcoat', 'n. /\'әuvәkәut/', 'n. 外套大衣', '基础', [], [], []],
  ['overcome', 'v. /.әuvә\'kʌm/', 'vt. 战胜, 克服, 胜过；vi. 得胜', '基础', [], [], []],
  ['overhead', 'adj. /\'әuvәhed/', 'n. 经常开支, 普通用费, 天花板；a. 在头上的, 高架的；adv. 在头顶上, 在空中, 在高处, 从头到脚全部没入地；[计] 总开销; 额外开销', '基础', [], [], []],
  ['overlook', 'v. /.әuvә\'luk/', 'vt. 俯瞰, 远眺, 没注意到；n. 眺望, 俯瞰到的景色', '基础', [], [], []],
  ['overweight', 'adj. /\'әuvә\'weit/', 'n. 超过重量, 过重, 优势；a. 超过重量的, 超重的；vt. 使超重, 重于, 过于重视', '基础', [], [], []],
  ['owe', 'vt. /әu/', 'vt. 亏欠, 负...债, 归功于, 怀有, 应给予, 感恩；vi. 欠钱', '基础', [], [], []],
  ['own', 'adj. v. /әun/', 'n. 自己的；a. 自己的, 嫡亲的, 同胞的；vt. 拥有, 支配, 自认, 承认, 顺从于；vi. 承认, 供认', '基础', [], [], []],
  ['owner', 'n. /\'әunә/', 'n. 拥有者, 物主, 所有人；[经] 所有者, 物主, 业主', '基础', [], [], []],
  ['ownership', 'n. /\'әunәʃip/', 'n. 所有权, 物主身份；[经] 所有权, 所有制', '基础', [], [], []],
  ['ox', 'n. /ɒks/', '牛；公牛', '基础', [], [], []],
  ['oxygen', 'n. /\'ɒksәdʒәn/', 'n. 氧；[化] 氧O-2', '基础', [], [], []],
  ['p.m.', 'n.', '下午，午后（亦作 pm／P.M.）', '基础', [], [], []],
  ['pace', 'n. /peis/', 'n. 速度, 步调, 步法；vi. 踱步, 缓慢走；vt. 用步测, 踱步于', '基础', [], [], []],
  ['Pacific', 'adj.', '太平洋的', '基础', [], [], []],
  ['pack', 'n. v. /pæk/', 'n. 包裹, 一伙, 一副, 背包, 包装；vt. 包装, 捆扎, 塞满, 压紧, 挑选；vi. 包装货物, 挤, 群集, 被包装；[计] 压缩', '基础', [], [], []],
  ['package', 'n. /\'pækidʒ/', 'n. 包裹, 套装软件, 包, 包装用物, 程序包；vt. 包装, 打包；a. 一揽子的；[计] 包, 软件包, 包装', '基础', [], [], []],
  ['packet', 'n. /\'pækit/', 'n. 小包, 一批信件, 大量, 信息包；vt. 打包, 装进小包；[计] 分组, 分组报文, 数据分组', '基础', [], [], []],
  ['page', 'n. /peidʒ/', 'n. 页, 记录, 事件, 专栏, 男侍；vt. 标明...的页数, 翻...的书页, 分页排版, 呼叫, 侍候；vi. 翻书页, 侍侯；[计] 页; 页面', '基础', [], [], []],
  ['pain', 'n. /pein/', 'n. 痛苦, 疼痛, 辛苦；vt. 使痛苦, 痛苦；vi. 作痛, 疼', '基础', [], [], []],
  ['painful', 'adj. /\'peinful/', 'a. 痛苦的, 困难的, 令人烦恼的；[医] 疼痛的', '基础', [], [], []],
  ['paint', 'n. vt. /peint/', 'n. 油漆, 颜料, 绘画作品, 涂漆；vt. 油漆, 绘, 画, 描绘, 装饰, 点缀；vi. 绘画, 涂漆', '基础', [], [], []],
  ['painter', 'n. /\'peintә/', 'n. 画家, 油漆匠；[机] 油漆匠, 喷漆匠', '基础', [], [], []],
  ['painting', 'n. /\'peintiŋ/', 'n. 画, 绘画, 油漆；[化] 涂漆', '基础', [], [], []],
  ['pair', 'n. /pєә/', 'n. 一双, 一对, 一副；v. (使)成对', '基础', [], [], []],
  ['palace', 'n. /\'pælis/', 'n. 宫, 宫殿, 华丽大厦', '基础', [], [], []],
  ['pale', 'adj. /peil/', 'n. 栅栏, 界线, 范围；a. 苍白的, 暗淡的, 无力的；vi. 变苍白, 变暗, 失色；vt. 使变苍白, 使失色, 用栅栏围', '基础', [], [], []],
  ['pan', 'n. /pæn/', 'n. 平锅, 浅盘, 盆地, 硬土层, 拍摄全景；v. 上下左右移动, 摇镜头, 淘洗, 淘金', '基础', [], [], []],
  ['pancake', 'n. /\'pænkeik/', 'n. 薄烤饼, 薄煎饼, 烙饼', '基础', [], [], []],
  ['panda', 'n. /\'pændә/', 'n. 大熊猫, 小熊猫', '基础', [], [], []],
  ['panel', 'n. vt.', '嵌板，镶板；壁板；镜板，控制板；操纵盘；仪表盘，专门小组 （用镶板等）镶嵌（门，墙等），把……分格', '基础', [], [], []],
  ['panic', 'n. & v. /\'pænik/', 'n. 恐慌, 惊慌；a. 惊慌的, 没有理由的, 恐慌的；vt. 使惊慌, 使狂热；vi. 惊慌', '基础', [], [], []],
  ['pants', 'n.', '裤子，宽松的长裤，短裤', '基础', [], [], []],
  ['paper', 'n. /\'peipә/', 'n. 纸, 文件, 文章, 报纸, 证券, 证件；vt. 用纸糊, 贴壁纸于, 用纸包装；vi. 贴壁纸；a. 纸做的, 纸上的', '基础', [], [], []],
  ['paperwork', 'n. /\'peipәwә:k/', 'n. 文书工作', '基础', [], [], []],
  ['paragraph', 'n. /\'pærәgrɑ:f/', 'n. 段落, 短评；vt. 将...分段, 分段落；vi. 写短讯；[计] 段落', '基础', [], [], []],
  ['parallel', 'adj. n. vt. /\'pærәlel/', '平行的，同方向的，相同的；类似的，电并联的…… 平行线；平行面，类似的人（或事物），可相比拟的人（或事物） 使成平行；与……平行，与……相似，比得上', '基础', [], [], []],
  ['parcel', 'n. /\'pɑ:sl/', 'n. 包裹, 部分, 片；vt. 分配, 打包；a. 部分的；adv. 局部地', '基础', [], [], []],
  ['pardon', 'n. /\'pɑ:dn/', 'n. 原谅, 赦免；vt. 宽恕, 原谅', '基础', [], [], []],
  ['parent', 'n. /\'perәnt/', 'n. 父母, 父母亲, 根源；[法] 父亲, 母亲, 根源', '基础', [], [], []],
  ['Paris', 'n. /\'pæris/', 'n. 巴黎；[医] 重楼属', '基础', [], [], []],
  ['park', 'n. vt. /pɑ:k/', 'n. 公园, 停车处；vt. 停车, 置于；vi. 停车', '基础', [], [], []],
  ['parking', 'n. /\'pɑ:kiŋ/', 'n. 停车；a. 停车的', '基础', [], [], []],
  ['parrot', 'n. /\'pærәt/', 'n. 鹦鹉, 应声虫；vt. 学舌, 机械地模仿', '基础', [], [], []],
  ['part', 'n. adj. v. /pɑ:t/', 'n. 部分, 局部, 零件, 要素, 等分, 职责, 角色, 部位；vt. 分开, 分离, 断绝, 区别, 分配；vi. 分开, 断裂, 分手；a. 部分的, 局部的；adv. 部分地, 有些', '基础', [], [], []],
  ['part-time', 'adj. & adv.', '兼职的；部分时间的（地）', '基础', [], [], []],
  ['participate', 'v. /pɑ:\'tisipeit/', 'vi. 参加, 分享, 参与, 带有；vt. 分享, 分担', '基础', [], [], []],
  ['particular', 'adj. /pә\'tikjulә/', 'n. 一项(或条、点), 个别项目, 详细说明；a. 特别的, 独有的, 挑剔的, 详尽的', '基础', [], [], []],
  ['partly', 'adv. /\'pɑ:tli/', 'adv. 部分地, 在一定程度上', '基础', [], [], []],
  ['partner', 'n. /\'pɑ:tnә/', 'n. 合伙人, 股东, 伙伴, 伴侣；vt. 与...合伙, 组成一对；vi. 做伙伴, 当助手', '基础', [], [], []],
  ['party', 'n. v. /\'pɑ:ti/', 'n. 宴会, 党, 政党, 团体, 当事人, 聚会；v. 举办聚会', '基础', [], [], []],
  ['pass', 'vt. /pæs/', 'n. 经过, 要隘, 途径, 通行, 护照, 及格；vt. 经过, 越过, 通过, 批准, 度过, 传递, 忽略；vi. 经过, 变化, 流通, 及格, 宣判, 终止, 消逝, 被忽略, 不叫牌, 传递；[计] 遍', '基础', [], [], []],
  ['passage', 'n. /\'pæsidʒ/', 'n. 通道, 通过, 移居, 航行, 一段, 走廊；vi. 通过, 经过, 航行, 横渡, 争吵；vt. (使)马以斜横步前进, 使传代', '基础', [], [], []],
  ['passenger', 'n. /\'pæsindʒә/', 'n. 乘客, 旅客；[经] 乘客, 旅客', '基础', [], [], []],
  ['passer-by', 'n.', '过客，过路人', '基础', [], [], []],
  ['passive', 'adj. /\'pæsiv/', 'a. 消极的, 被动的, 冷漠的, 顺从的, 无源的；[医] 被动的', '基础', [], [], []],
  ['passport', 'n. /\'pæspɒ:t/', 'n. 护照, 手段, 通行证；[法] 通行证, 护照', '基础', [], [], []],
  ['past', 'adv. n. prep. /pɑ:st/', 'n. 过去, 昔时, 往事, 早年经历, 过去时；a. 过去的, 结束的, 卸任的, 过去时的；prep. 越过, 晚于, 超越, 超出...的可能性(能力、范围等)；pass的过去分词', '基础', [], [], []],
  ['patent', 'n. /\'pætnt. \'peitnt/', 'n. 专利权, 许可证, 执照, 专利品, 素质；a. 专利的, 特许的, 显著的, 新奇的；vt. 取得...的专利权, 请准专利', '基础', [], [], []],
  ['path', 'n. /pɑ:θ/', 'n. 路径, 小路, 道路, 途径, 路线, 轨道；[计] 路径; DOS内部命令:设定DOS读取程序的路径', '基础', [], [], []],
  ['patience', 'n. /\'peiʃәns/', 'n. 耐性, 忍耐', '基础', [], [], []],
  ['patient', 'n. /\'peiʃәnt/', 'n. 病人, 承受者；a. 忍耐的, 容忍的, 有耐性的, 坚忍的', '基础', [], [], []],
  ['pattern', 'n. /\'pætәn/', 'n. 模范, 典型, 式样, 样品, 图案, 格调, 模式；vt. 模仿, 仿造, 以图案装饰；vi. 形成图案；[计] 模式, 图案', '基础', [], [], []],
  ['pause', 'n. & vi. /pɒ:z/', 'n. 暂停, 中止, 停顿, 间歇, 踌躇, 休止符；vi. 暂停, 中止, 停顿, 踌躇；[计] DOS内部命令:暂时停止批处理文件的执行', '基础', [], [], []],
  ['pay', 'v. n. /pei/', 'n. 薪资, 付款, 补偿；vt. 支付, 付清, 补偿, 偿还, 对...有利, 为...涂防水物；vi. 付款, 付出代价, 偿还, 得到报应, 获得好处', '基础', [], [], []],
  ['payment', 'n.', '支付，付款，支付的款项（或实物），报偿；惩罚', '基础', [], [], []],
  ['pea', 'n. /pi:/', 'n. 豌豆, 似豌豆的东西', '基础', [], [], []],
  ['peace', 'n. /pi:s/', 'n. 和平, 和约, 治安, 和睦, 安宁, 静寂；vi. 安静下来, 不作声', '基础', [], [], []],
  ['peaceful', 'adj. /\'pi:sful/', 'a. 平静的, 和平的, 和平时期的, 爱好和平的, 喜爱安静的；[法] 和平的, 爱好和平的, 和平时期的', '基础', [], [], []],
  ['peach', 'n. /pi:tʃ/', 'n. 桃子, 桃树, 桃色, 美人儿, 极好的事物；vt. 告发；vi. 告密, 检举', '基础', [], [], []],
  ['peak', 'n. vt. vi. adj.', '山顶，山峰；（有尖峰的）山，高峰，顶端，最高点，（物体的）尖端，帽舌 使尖起，使成峰状，使达到高峰 达到高峰，耸起 最高的，高峰的', '基础', [], [], []],
  ['pear', 'n. /pєә/', 'n. 梨子, 梨树, 梨木；[机] 梨木', '基础', [], [], []],
  ['peasant', 'n. /\'peznt/', 'n. 农夫, 乡下人', '基础', [], [], []],
  ['pedestrian', 'n. /pә\'destriәn/', 'n. 行人, 步行者；a. 人行的, 徒步的, 呆板的, 通俗的, 平淡无奇的', '基础', [], [], []],
  ['pen', 'n. /pen/', 'n. 钢笔, 笔, 笔调, 笔杆子, 作家, 围栏, 栅栏, 禽畜；vt. 写, 关入栏中, 囚禁；vi. 动笔, 写作', '基础', [], [], []],
  ['pen-friend', 'n.', '笔友', '基础', [], [], []],
  ['penalty', 'n.', '处罚；刑罚，罚款，【体】犯规的处罚；罚球', '基础', [], [], []],
  ['pence', 'n.', '便士（penny 的复数）', '基础', [], [], []],
  ['pencil', 'n. /\'pensl/', 'n. 铅笔, 色笔, 眉笔, 画笔, 光线束；vt. 用铅笔写或涂, 草拟', '基础', [], [], []],
  ['pencil-box', 'n.', '铅笔盒', '基础', [], [], []],
  ['penny', 'n. /\'peni/', 'n. 便士, 一分, 小钱, 点滴；[经] 便士', '基础', [], [], []],
  ['pension', 'n. /\'penʃәn/', 'n. 养老金, 退休金, 津贴, 年金, 抚恤金, 膳宿学校, 膳宿费；vt. 发给退休金, 用津贴拉拢', '基础', [], [], []],
  ['people', 'n. /\'pi:pl/', 'n. 人, 人民, 民族, 平民；vt. 使住满人, 居住于', '基础', [], [], []],
  ['pepper', 'n. /\'pepә/', 'n. 胡椒粉, 胡椒, 辣椒；[化] 胡椒; 辣椒; 花椒', '基础', [], [], []],
  ['per', 'prep. /pә:/', 'prep. 每一, 通过, 经, 按照；[经] 每, 按照', '基础', [], [], []],
  ['percent', 'n. /pә\'sent/', 'n. 百分比, 百分数, 部分；[机] 百分率', '基础', [], [], []],
  ['percentage', 'n. /pә\'sentidʒ/', 'n. 百分比, 比率, 部分, 可能性；[计] 百分比', '基础', [], [], []],
  ['perfect', 'adj. /\'pә:fikt/', 'n. 完成时；a. 完美的, 完好的, 理想的, 熟练的, 精确的, 完成式的；vt. 使完美, 修改, 使精通, 改善, 使熟练', '基础', [], [], []],
  ['perform', 'v. /pә\'fɒ:m/', 'vt. 进行, 履行, 完成, 执行, 表演；vi. 行动, 工作, 执行, 演出', '基础', [], [], []],
  ['performance', 'n. /pә\'fɒ:mәns/', 'n. 施行, 工作情况, 成绩, 行为, 表现, 演出；[电] 绩效, 性能', '基础', [], [], []],
  ['performer', 'n. /pә\'fɒ:mә/', 'n. 表演者, 执行者, 完成者；[法] 执行者, 履行者, 实行者', '基础', [], [], []],
  ['perfume', 'n. /\'pә:fju:m/', 'n. 香水, 香气, (悦人的)气氛, 美名；vt. 洒香水于, 薰香, 使充满香气', '基础', [], [], []],
  ['perhaps', 'adv. /pә\'hæps/', 'adv. 也许, 大概', '基础', [], [], []],
  ['period', 'n. /\'piәriәd/', 'n. 时期, 节段, 节, 句点, 学时, 周期；a. 当时特有的, 过去某段时期的；interj. 就是这话, 就是这么回事', '基础', [], [], []],
  ['permanent', 'adj. /\'pә:mәnәnt/', 'a. 永久的, 不变的, 固定的, 持久的；n. 烫发；[计] 永久的', '基础', [], [], []],
  ['permission', 'n. /pә\'miʃәn/', 'n. 许可, 允许；[计] 许可, 认可', '基础', [], [], []],
  ['permit', 'vt. n. /pә\'mit/', 'n. 许可证, 许可, 执照, 通行证；vt. 允许, 容许, 可能, 使放手做；vi. 容许, 给以机会, 提供可能', '基础', [], [], []],
  ['person', 'n. /\'pә:sn/', 'n. 人, 人身, 人称；[法] 人, 法人, 人身', '基础', [], [], []],
  ['personal', 'adj. /\'pә:snl/', 'a. 私人的, 涉及隐私的, 有人性的, 人称的, 亲自的, 身体的；[医] 人的; 个人的, 自身的', '基础', [], [], []],
  ['personally', 'adv. /\'pә:sәnli/', 'adv. 亲自地, 个别地, 当面, 就本人而言, 针对个人地', '基础', [], [], []],
  ['personnel', 'n. /.pә:sә\'nel/', 'n. 人员, 人事部门, 人事科(处)；[经] 人事, 全体人员, 职工', '基础', [], [], []],
  ['persuade', 'vt. /pә\'sweid/', 'vt. 劝, 使相信, 恳求, 敦促, 说服；vi. 劝服, 被说服', '基础', [], [], []],
  ['pest', 'n. /pest/', 'n. 令人讨厌之物, 有害之物, 害虫, 瘟疫；[医] 鼠疫, 瘟疫', '基础', [], [], []],
  ['pet', 'n. /pet/', 'n. 宠物, 受宠爱的人, 宠坏的孩子, 不悦, 生气；a. 宠爱的, 表示亲昵的, 养着观赏的, 特别珍爱的, 格外的；vt. 宠爱, 溺爱, 抚摸；vi. 拥抱, 爱抚, 生气, 发脾气', '基础', [], [], []],
  ['petrol', 'n. /\'petrәl/', 'n. 汽油；[经] 汽油, 挥发油, 石油', '基础', [], [], []],
  ['phenomenon', 'n. /fi\'nɒminәn/', 'n. 现象, 迹象, 表现, 奇迹, 奇才；[化] 现象', '基础', [], [], []],
  ['phone', 'v. n.', '打电话 电话，电话机', '基础', [], [], []],
  ['photo', 'n.', '照片', '基础', [], [], []],
  ['photograph', 'n. /\'fәutәgrɑ:f/', 'n. 相片, 照片, 逼真的描绘；v. 照相, 摄影', '基础', [], [], []],
  ['photographer', 'n. /fә\'tɔ^rәfә/', 'n. 摄影师, 摄影者', '基础', [], [], []],
  ['phrase', 'n. /freiz/', 'n. 惯用语, 词组, 成语, 措词, 乐句；vt. 用短语表达, 把(乐曲)分成短句；[计] 短语', '基础', [], [], []],
  ['physical', 'adj. /\'fizikl/', 'a. 身体的, 物质的, 自然的, 物理学的, 好色的；n. 体格检查', '基础', [], [], []],
  ['physician', 'n. /fi\'ziʃәn/', 'n. 医师, 内科医师, 解除痛苦者；[医] 主治医师', '基础', [], [], []],
  ['physicist', 'n. /\'fizisist/', 'n. 物理学家, 机械唯物论者, 自然科学家；[医] 菲西克氏手术(虹膜圆片切除)', '基础', [], [], []],
  ['physics', 'n. /\'fiziks/', 'n. 物理学, 物理过程, 物理现象；[化] 物理; 物理学', '基础', [], [], []],
  ['pianist', 'n. /\'piәnist/', 'n. 钢琴家, 钢琴演奏者', '基础', [], [], []],
  ['piano', 'n. /pi\'ɑ:nәu/', 'n. 钢琴', '基础', [], [], []],
  ['pick', 'v. /pik/', 'n. 精选, 选择, 掘, 精华, 牙签, 鹤嘴锄；v. 摘, 掘, 凿, 挖, 挑选；[计] 拾取', '基础', [], [], []],
  ['picnic', 'n. & v. /\'piknik/', 'n. 野餐, 远足, 愉快的经历；vi. 去野餐, 远足', '基础', [], [], []],
  ['picture', 'n. /\'piktʃә/', 'n. 图画, 照片, 景色, 美丽如画的人(或物), 化身, 生动的描述, 想像, 形象思维；vt. 画, 拍摄, 用图说明, 描写, 想像；[计] 图象; 形象; 字形', '基础', [], [], []],
  ['pie', 'n. /pai/', 'n. 馅饼, 财富, 总额, 贪污受贿, 杂乱, 喜鹊；[计] 饼图', '基础', [], [], []],
  ['piece', 'n. /pi:s/', 'n. 块, 片, 篇, 碎片, 部分, 部件, 标准量；vt. 修补, 修理, 拼合, 接线头；vi. 吃零食', '基础', [], [], []],
  ['pig', 'n. /pig/', 'n. 猪, 猪肉, 贪婪的人, 猪一样的人；v. 生小猪, 象猪般地生活', '基础', [], [], []],
  ['pile', 'n. /pail/', 'n. 堆, 大堆, 大厦, 建筑群, 电池, 大量, 桥桩, 软毛, 痔疮；vi. 堆起, 堆积, 积累, 挤, 猛烈攻击；vt. 堆于, 累积, 堆叠, 打桩于, 用桩支撑', '基础', [], [], []],
  ['pill', 'n. /pil/', 'n. 药丸, 弹丸, 屈辱, 胡说；v. 做成药丸, 形成丸状, 服药丸, 挫败, 抢劫', '基础', [], [], []],
  ['pillow', 'n. /\'pilәu/', 'n. 枕头, 靠垫, 枕状岩；vt. 作...的枕头, 垫, 枕于；vi. 靠在枕上', '基础', [], [], []],
  ['pilot', 'n. /\'pailәt/', 'n. 飞行员, 领航员, 航船者, 导向器, 驾驶仪, 向导, 领导人；vt. 领航, 驾驶, 引导, 试用；a. 引导的, 控制的, 试点的；[计] 引导', '基础', [], [], []],
  ['pin', 'n. v. /pin/', 'n. 大头针, 针, 别针, 栓, 销子, 图钉, 插头, 管脚, 品(液量单位)；vt. 将...用针别住, 钉住, 压住, 牵制, 使不能动, 归罪于；a. 针的, 销子的, 闩的', '基础', [], [], []],
  ['pine', 'n. /pain/', 'n. 松树, 松木；vi. 消瘦, 憔悴, 痛苦, 怀念, 渴望；[计] 邮件程序', '基础', [], [], []],
  ['pineapple', 'n. /\'pain.æpl/', 'n. 凤梨, 菠萝, 失业救济金；[医] 凤梨, 波萝', '基础', [], [], []],
  ['ping-pong', 'n.', '乒乓球', '基础', [], [], []],
  ['pink', 'adj.', '粉红色的', '基础', [], [], []],
  ['pint', 'n. /paint/', 'n. 品脱(干量或液量的单位)；[医] 量磅, 品脱', '基础', [], [], []],
  ['pioneer', 'n. /.paiә\'niә/', 'n. 先锋, 拓荒者, 创始人；vt. 提倡, 开辟, 开创, 倡导；vi. 作先驱, 开路；a. 最早的, 开拓的, 先驱的, 有开拓者特点的', '基础', [], [], []],
  ['pipe', 'n. /paip/', 'n. 管, 导管, 输送管, 管状器官, 声带, 尖细的声音, 烟斗, 笛, 管乐器；vt. 以管输送, 吹哨子, 吹奏, 尖声唱；vi. 吹笛, 尖叫, 吹长哨发令；[计] 管道', '基础', [], [], []],
  ['pity', 'n. /\'piti/', 'n. 遗憾, 同情, 怜悯, 憾事, 可惜；vt. 同情, 怜悯；vi. 觉得可怜, 有同情心', '基础', [], [], []],
  ['pizza', 'n.', '（涂有番茄酱、乳酪等的）意大利肉馅饼', '基础', [], [], []],
  ['place', 'n. v. /pleis/', 'n. 地方, 地点, 位置, 住所, 座位, 地位, 处境, 特权, 空间, 余地, 职务, 位；vt. 放置, 寄予, 认出, 评定, 任命；vi. 名次列前', '基础', [], [], []],
  ['plain', 'adj. /plein/', 'n. 平原, 草原, 朴实无华的东西, 无格式；a. 简单的, 明白的, 平常的, 不好看的, 朴素的, 清晰的, 普通的, 平坦的, 十足的；adv. 清楚地, 显然地；[计] 无格式', '基础', [], [], []],
  ['plan', 'n. & v. /plæn/', 'n. 计划, 方案, 策略, 方法, 进度表, 程序表, 平面图, 设计图, 轮廓, 示意图；vt. 计划, 设计, 意欲；vi. 订计划', '基础', [], [], []],
  ['plane', 'n. /plein/', 'n. 平面, 扁平物, 机翼, 飞机, 水准, 地位；a. 平的, 平面的；vt. 将...刨平, 刨平, 掠过水面；vi. 翱翔, 乘飞机旅行, 刨掉', '基础', [], [], []],
  ['planet', 'n. /\'plænit/', 'n. 行星, 命运星辰, 杰出的人, 重大影响的事', '基础', [], [], []],
  ['plant', 'vt. n. /plænt. plɑ:nt/', 'n. 植物, 作物, 工厂, 树枝, 生长, 设施, 成套设备；vt. 种植, 栽培, 播种, 培养, 安置, 殖民于, 使位于；vi. 种植', '基础', [], [], []],
  ['plastic', 'adj. /\'plæstik/', 'n. 塑料, 可塑体, 可塑性物质；a. 塑料的, 塑造的, 有可塑性的, 造型的, 易受影响的, 有创造力的', '基础', [], [], []],
  ['plate', 'n. /pleit/', 'n. 碟, 盘子, 盆中物, 金属板, 图版, 金银餐具, 印版, 金属牌(照)；vt. 镀金, 电镀, 用金属板固定, 给...装钢板, 为...制印版', '基础', [], [], []],
  ['platform', 'n. /\'plætfɒ:m/', 'n. 站台, 月台, 讲台, 论坛, 平台；[计] 平台', '基础', [], [], []],
  ['play', 'v. n. /plei/', 'n. 游戏, 游玩, 玩笑, 运动, 比赛, 赌博, 跳动, 表演, 剧本；v. 玩, 游戏, 假装, 开玩笑, 比赛, 扮演, 演奏, 演戏, 传摇曳, (使)跳动；[计] 播放', '基础', [], [], []],
  ['player', 'n. /\'pleiә/', 'n. 竞赛者, 上场队员, 游戏者, 演员；[经] 交易者', '基础', [], [], []],
  ['playground', 'n. /\'pleigraund/', 'n. 运动场, 操场, 度假胜地, 活动场所', '基础', [], [], []],
  ['playmate', 'n. /\'pleimeit/', 'n. 玩伴, 游伴', '基础', [], [], []],
  ['playroom', 'n. /\'pleiru:m/', 'n. 游戏室, 娱乐室', '基础', [], [], []],
  ['pleasant', 'adj. /\'pleznt/', 'a. 愉快的, 可爱的, 活泼的, 亲切的', '基础', [], [], []],
  ['please', 'v. /pli:z/', 'adv. 请；vt. 使高兴, 合...的心意, 取悦；vi. 使人满意, 讨好, 愿意, 敬请', '基础', [], [], []],
  ['pleased', 'adj. /pli:zd/', 'a. 高兴的, 喜欢的, 满足的', '基础', [], [], []],
  ['pleasure', 'n. /\'pleʒә/', 'n. 快乐, 愉快, 令人高兴的事, 娱乐, 希望；v. (使)高兴', '基础', [], [], []],
  ['plenty', 'n. /\'plenti/', 'n. 充分, 很多, 丰富；a. 很多的, 足够的, 丰富的', '基础', [], [], []],
  ['plot', 'v. & n. /plɒt/', 'n. 小块土地, 地区图, 图, 阴谋, 情节；vt. 划分, 绘图, 密谋；vi. 密谋, 策划；[计] 绘制', '基础', [], [], []],
  ['plug', 'n. vt. /plʌg/', 'n. 塞子, 栓, 插头；vt. 插入, 塞住, 接插头；vi. 被塞住', '基础', [], [], []],
  ['plus', 'prep. /plʌs/', 'prep. 加上, 加, 外加；a. 正的, 附加的；n. 正号, 加号, 附加额, 正数, 增益；[计] 正差', '基础', [], [], []],
  ['pocket', 'n. /\'pɒkit/', 'n. 口袋, 钱袋, 钱, 容器；vt. 装...在口袋里, 隐藏, 抑制, 私吞, 搁置, 击...入袋；a. 袖珍的, 小型的, 压缩的, 金钱上的', '基础', [], [], []],
  ['poem', 'n. /\'pәuim/', 'n. 诗, 诗般美的事物', '基础', [], [], []],
  ['poet', 'n. /\'pәuit/', 'n. 诗人', '基础', [], [], []],
  ['point', 'v. n. /pɒint/', 'n. 点, 小数点, 标点, 地点, 要点, 特点, 尖端, 分数, 得分, 穴位；vt. 弄尖, 强调, 指出, 加标点于, 瞄准；vi. 指, 指向, 表明', '基础', [], [], []],
  ['poison', 'n. /\'pɒizn/', 'n. 毒药, 毒, 毒物, 有毒害的事物；vt. 毒害, 毒杀, 使中毒；vi. 放毒, 下毒', '基础', [], [], []],
  ['poisonous', 'adj. /\'pɒizәnәs/', 'a. 有毒的, 恶毒的, 讨厌的；[医] 有毒的', '基础', [], [], []],
  ['pole', 'n.', '杆，电线杆', '基础', [], [], []],
  ['police', 'n. /pә\'li:s/', 'n. 警察, 警察当局, 治安；vt. 维持治安, 管辖', '基础', [], [], []],
  ['policeman', 'n. /pә\'li:smәn/', 'n. 警察；[化] 淀帚', '基础', [], [], []],
  ['policewoman', 'n.', '女警察', '基础', [], [], []],
  ['policy', 'n. /\'pɒlisi/', 'n. 政策, 方针, 策略, 保险单；[医] 凭单, 保险单', '基础', [], [], []],
  ['polish', 'v. n.', '擦亮 擦光剂，亮光剂', '基础', [], [], []],
  ['polite', 'adj. /pә\'lait/', 'a. 有礼貌的, 文雅的, 客气的, 有教养的', '基础', [], [], []],
  ['political', 'adj. /pә\'litikl/', 'a. 政治的, 政治上的, 政党的, 从事政治的；[法] 政治的, 政治上的, 党派政治的', '基础', [], [], []],
  ['politician', 'n. /.pɒli\'tiʃәn/', 'n. 政客, 政治家, 从事党派政治的人；[法] 政客, 政治家', '基础', [], [], []],
  ['politics', 'n. /\'pɒlitiks/', 'n. 政治, 政治学, 政见, 政治活动；[法] 政治, 政治学, 政纲', '基础', [], [], []],
  ['pollute', 'vt. /pә\'lu:t/', 'vt. 污染, 弄脏, 玷污；[化] 污染', '基础', [], [], []],
  ['pollution', 'n. /pә\'lu:ʃәn/', 'n. 污染, 玷污；[化] 污染', '基础', [], [], []],
  ['pond', 'n. /pɒnd/', 'n. 池塘；v. 筑成池塘', '基础', [], [], []],
  ['pool', 'n. /pu:l/', 'n. 池, 水塘, 石油层, 联营；vt. 合伙经营, 共享, 采掘, 汇聚成；vi. 汇合成塘, 淤积, 联营', '基础', [], [], []],
  ['poor', 'adj. /puә. pɒ:/', 'a. 贫穷的, 贫乏的, 不幸的, 可怜的, 拙劣的, 卑鄙的；[经] 低劣的, 不良的', '基础', [], [], []],
  ['popcorn', 'n. /\'pɒpkɒ:n/', 'n. 爆米花', '基础', [], [], []],
  ['popular', 'adj. /\'pɒpjulә/', 'a. 通俗的, 流行的, 受欢迎的, 大众的, 人民的, 普及的；[经] 大众的, 通俗的, 普及的', '基础', [], [], []],
  ['population', 'n. /.pɒpju\'leiʃәn/', 'n. 人口, 人口数；[化] 群体; 总体', '基础', [], [], []],
  ['pork', 'n. /pɒ:k/', 'n. 猪肉；[医] 猪肉', '基础', [], [], []],
  ['porridge', 'n. /\'pɒ:ridʒ/', 'n. 粥, 糊', '基础', [], [], []],
  ['port', 'n. /pɒ:t/', 'n. 港口, 埠, 舱门, 避风港, 左舷, 炮眼, 姿势, 意义；vt. 左转舵, 持(枪)；vi. 左转舵；[计] 端口, 移植', '基础', [], [], []],
  ['portable', 'adj. /\'pɒ:tәbl/', 'a. 可携带的, 可搬运的, 可移动的；[计] 可移植的', '基础', [], [], []],
  ['porter', 'n. /\'pɒ:tә/', 'n. 大楼管理员, 门房, 搬运工人, 侍者, 服务员；[化] 搬运车; 搬运工人', '基础', [], [], []],
  ['position', 'n. /pә\'ziʃәn/', 'n. 位置, 地位, 身分, 形势, 姿势, 立场, 职位, 状态, 阵地；vt. 安置, 决定...的位置；[计] 位置', '基础', [], [], []],
  ['positive', 'adj.', '积极的，肯定的', '基础', [], [], []],
  ['possess', 'vt. /pә\'zes/', 'vt. 持有, 占有, 拥有, 克制, 支配, 迷住；[法] 持有, 占有, 具有', '基础', [], [], []],
  ['possession', 'n. /pә\'zeʃәn/', 'n. 拥有, 占有, 所有, 财产, 领土, 领地, 自制, 着迷；[经] 占有, 持有', '基础', [], [], []],
  ['possibility', 'n. /.pɒsә\'biliti/', 'n. 可能性, 可能的事；[法] 可能性, 可能发生的事, 不确定权', '基础', [], [], []],
  ['possible', 'adj. /\'pɒsәbl/', 'a. 可能的, 潜在的, 合适的；n. 可能性, 可能的事物', '基础', [], [], []],
  ['post', 'n. v. /pәust/', 'n. 柱, 杆, 准星, 邮件, 邮政, 标竿, 职位, 岗位, 哨所, 兵营；vt. 张帖, 邮递, 公布, 登入帐, 使熟悉, 布置；vi. 快速行进；adv. 急速地；[计] 记入; 登记, 上电自检', '基础', [], [], []],
  ['postage', 'n. /\'pәustidʒ/', 'n. 邮资；[经] 邮费, 邮资', '基础', [], [], []],
  ['postcard', 'n. /\'pәustkɑ:d/', 'n. 明信片', '基础', [], [], []],
  ['postcode', 'n. /\'pәustkәud/', '（英）邮政编码', '基础', [], [], []],
  ['poster', 'n. /\'pәustә/', '（贴在公共场所的大型）招贴；广告（画）', '基础', [], [], []],
  ['postman', 'n. /\'pәustmәn/', 'n. 邮递员；[法] 邮递员, 理财法庭的高级律师', '基础', [], [], []],
  ['postpone', 'vt. /pәust\'pәun/', 'vt. 延迟, 使延期, 缓办, 搁延；vi. 延缓, 延缓发作', '基础', [], [], []],
  ['pot', 'n. /pɒt/', 'n. 盆, 罐, 壶, 坩埚, 奖杯；vt. 装入盆中, 在锅中煮, 随手射击；vi. 随手射击', '基础', [], [], []],
  ['potato', 'n. /pә\'teitәu/', '土豆，马铃薯', '基础', [], [], []],
  ['potential', 'adj. /pә\'tenʃәl/', 'n. 潜在性, 可能性, 潜力, 潜能, 势, 位；a. 有潜力的, 可能的, 潜在的', '基础', [], [], []],
  ['pound', 'n. /paund/', 'n. 磅, 英镑, 重击, 鱼塘, 拘留所, 兽栏；vt. 强烈打击, 捣烂, 监禁, 关入栏内；vi. 连续重击, 苦干', '基础', [], [], []],
  ['pour', 'v. /pɒ:/', 'n. 流出, 倾泻, 骤雨；vt. 倒, 灌, 注, 倾泻, 诉说, 倾吐；vi. 倾泻, 蜂涌而来, 下大雨', '基础', [], [], []],
  ['poverty', 'n.', '贫困，贫穷', '基础', [], [], []],
  ['powder', 'n. /\'paudә/', 'n. 粉, 粉末, 火药；vt. 搽粉于, 搽粉, 撒粉, 使成粉末；vi. 搽粉, 变成粉末', '基础', [], [], []],
  ['power', 'n. /\'pauә/', 'n. 力, 体力, 力量, 势力, 动力, 权力, 强国, 乘方, 强度, 幂, 功率；vt. 使...有力量, 供以动力, 激励；[计] 乘幂; DOS外部命令:能控制许多电池电源计算机上的电源管理特性', '基础', [], [], []],
  ['powerful', 'adj. /\'pauәful/', 'a. 有力的, 有权力的, 强大的；[机] 强力的', '基础', [], [], []],
  ['practical', 'adj. /\'præktikl/', 'a. 实际的, 现实的, 实用性的；[法] 事实上的, 实际上的, 接近...的', '基础', [], [], []],
  ['practice', 'n. /\'præktis/', 'n. 实践, 练习, 实行, 惯例, 习惯, 开业；v. 实践, 实行, 练习, 实习, 业务', '基础', [], [], []],
  ['praise', 'n. & vt. /preiz/', 'n. 赞美, 称赞, 崇拜；vt. 称赞, 赞美；vi. 赞扬, 表扬', '基础', [], [], []],
  ['pray', 'v. /prei/', 'v. 祈祷, 恳求, 请', '基础', [], [], []],
  ['prayer', 'n. /prєә. \'preiә/', 'n. 祈祷, 恳求, 祷辞, 祈祷者', '基础', [], [], []],
  ['precious', 'adj. /\'preʃәs/', 'a. 宝贵的, 珍贵的, 过于精致的, 珍爱的', '基础', [], [], []],
  ['precise', 'adj. /pri\'sais/', 'a. 精确的, 严谨的, 明确的；[机] 精密的, 正确的', '基础', [], [], []],
  ['predict', 'vt. /pri\'dikt/', 'v. 预知, 预言, 预报', '基础', [], [], []],
  ['prefer', 'vt. /pri\'fә:/', 'vt. 宁可, 较喜欢, 提出；[法] 给予优先权, 优先偿还, 提出', '基础', [], [], []],
  ['preference', 'n. /\'prefәrәns/', 'n. 偏爱, 优先, 喜爱物；[计] 首选项', '基础', [], [], []],
  ['prejudice', 'n. /\'predʒudis/', 'n. 偏见, 成见, 侵害；vt. 使存偏见, 使有成见, 侵害', '基础', [], [], []],
  ['premier', 'n. /\'pri:mjә/', 'n. 总理, 首相；a. 首位的, 最初的', '基础', [], [], []],
  ['preparation', 'n. /.prepә\'reiʃәn/', 'n. 准备, 预备, 预习；[化] 制剂', '基础', [], [], []],
  ['prepare', 'vt. /pri\'pєә/', 'vt. 准备, 筹备, 使在思想上有准备, 制造, 调制；vi. 预备', '基础', [], [], []],
  ['presence', 'n.', '在场，出席', '基础', [], [], []],
  ['present', 'adj. n. vt. /\'preznt/', 'n. 现在, 礼品, 瞄准；a. 现在的, 出席的；vt. 介绍, 引见, 赠送, 提出, 呈现, 上演；vi. 举枪瞄准', '基础', [], [], []],
  ['presentation', 'n. /.prezәn\'teiʃәn/', 'n. 赠与, 描述, 介绍；[计] 简报', '基础', [], [], []],
  ['preserve', 'v. /pri\'zә:v/', 'vt. 保护, 保持, 保存, 维持, 腌, 禁猎；vi. 加工食品, 禁猎；n. 加工成的食品, 禁猎地, 保护区, 防护物', '基础', [], [], []],
  ['president', 'n. /\'prezidәnt/', 'n. 总统, 总裁, 董事长, (学院)院长, (大学)校长, 主管人, 主持人；[经] 总经理, 董事长, 总裁', '基础', [], [], []],
  ['press', 'vt. n. /pres/', 'n. 压, 揿, 按, 人群, 印刷机, 压力, 出版社, 记者, 报刊, 新闻舆论, 紧迫；vt. 压, 压榨, 紧抱, 逼迫, 推进, 强迫征募, 催逼；vi. 压, 重压, 催促, 拥挤, 奋力前进, 受压', '基础', [], [], []],
  ['pressure', 'n. /\'preʃә/', 'n. 压, 榨, 按, 强制, 压力, 压迫, 压强；vt. 迫使, 使增压, 密封', '基础', [], [], []],
  ['pretend', 'vi. /pri\'tend/', 'v. 假装, 伪称, 自命, 自称', '基础', [], [], []],
  ['pretty', 'adj. /\'priti/', 'a. 漂亮的, 优美的, 机灵的, 狡猾的, 恰当的；adv. 相当, 颇', '基础', [], [], []],
  ['prevent', 'vt. /pri\'vent/', 'v. 预防, 防止, 阻止, 妨碍', '基础', [], [], []],
  ['preview', 'n. & vt. /\'pri:vju:/', 'n. 事先查看, 预览；vt. 事先查看, 预演；[计] 预览', '基础', [], [], []],
  ['previous', 'adj.', '先前的，以前的', '基础', [], [], []],
  ['price', 'n. /prais/', 'n. 价格, 代价, 价值；vt. 定...的价格', '基础', [], [], []],
  ['pride', 'n. /praid/', 'n. 骄傲, 自尊心, 自豪, 精华, 勇气；vt. 以...自豪', '基础', [], [], []],
  ['primary', 'adj. /\'praimәri/', 'n. 最主要者, 原色；a. 主要的, 初期的, 根本的, 原始的, 首要的, 基本的；[计] 初等量; 主要的; 一次的', '基础', [], [], []],
  ['principle', 'n. /\'prinsipl/', 'n. 原则, 原理, 主义；[化] 原理', '基础', [], [], []],
  ['print', 'vt. /print/', 'n. 打印, 版, 印刷物, 痕迹, 印刷业, 印刷字体, 图片, 印花布, 印章；v. 打印, 印刷, 铭记, 留印记于, 用印刷体写；[计] DOS外部命令:在打印机上打印文件, 可一边打印文件一边执行其他工作', '基础', [], [], []],
  ['priority', 'n.', '优先考虑的事', '基础', [], [], []],
  ['prison', 'n. /\'prizn/', 'n. 监狱, 监禁, 拘留所；vt. 监禁', '基础', [], [], []],
  ['prisoner', 'n. /\'priznә/', 'n. 囚犯, 犯人, 战俘；[法] 犯人, 囚犯, 扣押犯', '基础', [], [], []],
  ['private', 'adj. /\'praivit/', 'a. 私人的, 秘密的, 私立的, 隐蔽的；n. 士兵, 隐士, 阴部；[计] 私人的', '基础', [], [], []],
  ['privilege', 'n. /\'privilidʒ/', 'n. 特权, 特别恩典, 基本权利, 特免；vt. 给与...特权, 特免', '基础', [], [], []],
  ['prize', 'n. /praiz/', 'n. 奖赏, 奖金, 奖品, 战利品, 捕获；a. 得奖的；vt. 珍视, 估价, 捕获, 撬, 撬动', '基础', [], [], []],
  ['probable', 'adj. /\'prɒbәbl/', 'a. 很可能的, 大概的, 可信的；n. 很有希望的候选人, 很可能的事情', '基础', [], [], []],
  ['probably', 'adv. /\'prɒbәbli/', 'adv. 大概, 或许', '基础', [], [], []],
  ['problem', 'n. /\'prɒblәm/', 'n. 问题, 难题；a. 成问题的, 难处理的', '基础', [], [], []],
  ['procedure', 'n. /prә\'si:dʒә/', 'n. 程序, 过程, 手续；[计] 规程; 过程', '基础', [], [], []],
  ['process', 'n. vt. /\'prɒses/', 'n. 程序, 进行, 过程；vt. 加工, 使...接受处理, 对...处置, 对...起诉；a. 经加工的, 有特殊光效的；[计] 进程', '基础', [], [], []],
  ['produce', 'vt. /prә\'dju:s/', 'n. 生产品, 物产, 后代；vt. 产生, 生产, 提出, 出示；vi. 生产, 制造', '基础', [], [], []],
  ['product', 'n. /\'prɒdʌkt/', 'n. 产品, 结果, 乘积；[化] 生产物', '基础', [], [], []],
  ['production', 'n. /prә\'dʌkʃәn/', 'n. 制造, 生产, 产物；[医] 产生, 生成', '基础', [], [], []],
  ['profession', 'n. /prә\'feʃәn/', 'n. 职业, 表白, 声明；[化] 工种; 职业', '基础', [], [], []],
  ['professor', 'n. /prә\'fesә/', 'n. 教授', '基础', [], [], []],
  ['profit', 'n. /\'prɒfit/', 'n. 利润, 赢利, 利益；vi. 有益, 获利, 赚钱；vt. 有益于', '基础', [], [], []],
  ['programme', 'n. /\'prәugræm/', 'n. 节目, 节目单, 程序, 纲要, 大纲, 计划；vt. 规划, 拟...计划；vi. 安排节目, 编程序', '基础', [], [], []],
  ['progress', 'n. vi. /\'prәugres/', 'n. 进步, 发展, 前进；vi. 进步, 进行', '基础', [], [], []],
  ['project', 'n. /\'prɒdʒekt/', 'n. 计划, 设计, 事业；vt. 计划, 设计, 投掷, 发射, 使凸出, 放映；vi. 凸出', '基础', [], [], []],
  ['promise', 'n. & v. /\'prɒmis/', 'n. 诺言, 约定的事情, 有指望；vt. 允诺, 约定, 预示；vi. 允诺, 有前途, 有指望', '基础', [], [], []],
  ['promote', 'v. /prәu\'mәut/', 'vt. 促进, 晋升, 创办, 推销；[经] 促进, 推广, 推销', '基础', [], [], []],
  ['pronounce', 'vt. /prә\'nauns/', 'v. 发音, 宣告, 断言', '基础', [], [], []],
  ['pronunciation', 'n. /prәu.nʌnsi\'eiʃәn/', 'n. 发音, 读法', '基础', [], [], []],
  ['proper', 'adj. /\'prɒpә/', 'a. 适当的, 固有的, 高尚的, 专属的；adv. 完全地, 彻底地', '基础', [], [], []],
  ['properly', 'adv. /\'prɒpәli/', 'adv. 适当地, 相当地', '基础', [], [], []],
  ['property', 'n.', '财产，资产，地产', '基础', [], [], []],
  ['proposal', 'n.', '建议；求婚', '基础', [], [], []],
  ['protect', 'vt. /prә\'tekt/', 'vt. 防卫, 保护, 警戒；[法] 庇护, 保护, 警戒', '基础', [], [], []],
  ['protection', 'n. /prә\'tekʃәn/', 'n. 保护, 防卫, 贸易保护制度；[计] 保护', '基础', [], [], []],
  ['proud', 'adj. /praud/', 'a. 骄傲的, 自大的, 自豪的, 辉煌的, 壮丽的', '基础', [], [], []],
  ['prove', 'vt. /pru:v/', 'vt. 证明, 查验, 检验, 勘探, 显示；vi. 证明是', '基础', [], [], []],
  ['provide', 'vt. /prә\'vaid/', 'vt. 提供, 供应, 规定, 预备；vi. 作准备, 抚养, 规定', '基础', [], [], []],
  ['provided', 'conj.', '以……为条件；假如', '基础', [], [], []],
  ['providing', 'conj.', '以……为条件；假如', '基础', [], [], []],
  ['province', 'n. /\'prɒvins/', 'n. 省, 地方, 职权, 领域；[法] 省, 地方, 领域', '基础', [], [], []],
  ['psychological', 'adj.', '心理学的；心理的，精神的', '基础', [], [], []],
  ['psychology', 'n. /sai\'kɒlәdʒi/', 'n. 心理学, 心理状态；[医] 心理学', '基础', [], [], []],
  ['pub', 'n. /pʌb/', 'n. 酒馆, 客栈', '基础', [], [], []],
  ['public', 'adj. n. /\'pʌblik/', 'n. 公众, 民众；a. 公众的, 公共的, 公立的, 公用的', '基础', [], [], []],
  ['publish', 'vt. /\'pʌbliʃ/', 'vt. 出版, 发行, 公开, 发表, 宣传, 公布；vi. 出版, 发行', '基础', [], [], []],
  ['pull', 'vt. n. /pul/', 'vt. 拉, 拖, 拔, 牵, 撕开, 吸引；vi. 拉, 拖, 拔, 有吸引力；n. 拉, 拖, 拔, 拉力, 牵引力, 划船, 吸引', '基础', [], [], []],
  ['pulse', 'n. /pʌls/', 'n. 脉冲, 脉搏, 情绪, 意向, 拍子, 豆类；vi. 跳动, 脉跳；vt. 使跳动, 用脉冲调制；[计] 脉冲', '基础', [], [], []],
  ['pump', 'vt. /pʌmp/', 'n. 抽水机, 打气筒, 泵, 抽吸；vt. 用唧筒抽水, 打气, 盘问, 倾注, 使疲惫；vi. 抽水, 上下(或往复)运动', '基础', [], [], []],
  ['punctual', 'adj. /\'pәŋktʃuәl/', 'a. 准时的, 守时的, 点状的, 中肯的；[经] 准时的, 不误期的, 准时', '基础', [], [], []],
  ['punish', 'v. /\'pʌniʃ/', 'vt. 处罚, 惩罚, 严厉对待；vi. 惩罚', '基础', [], [], []],
  ['punishment', 'n. /\'pʌniʃmәnt/', 'n. 处罚, 刑罚, 惩罚；[法] 罚, 处罚, 刑罚', '基础', [], [], []],
  ['pupil', 'n. /\'pju:pl/', 'n. 学生, 门生, 未成年人, 瞳孔；[医] 瞳孔', '基础', [], [], []],
  ['purchase', 'v. /\'pә:tʃәs/', 'n. 购买, 购买品, 紧握, 绞辘；vt. 购买, 赢得, 努力取得, 用滑轮起(锚等)', '基础', [], [], []],
  ['pure', 'adj. /pjuә/', 'a. 纯的, 纯净的, 纯洁的, 清白的, 完美的, 无瑕的, 抽象的；[医] 的, 纯净的', '基础', [], [], []],
  ['purple', 'adj. n. /\'pә:pl/', 'n. 紫色, 帝位；a. 紫色的, 帝王的, 华而不实的；v. (使)成紫色', '基础', [], [], []],
  ['purpose', 'n. /\'pә:pәs/', 'n. 目的, 意向, 决心, 用途, 效果, 论题；vt. 意欲, 企图, 计划', '基础', [], [], []],
  ['purse', 'n. /pә:s/', 'n. 钱包, 小钱袋, 金钱, 募捐款, 囊状物；v. 缩拢, 皱起', '基础', [], [], []],
  ['push', 'n. & v. /puʃ/', 'n. 推, 推动, 奋斗, 攻击, 进取心；vt. 推, 推动, 使伸出, 推行, 逼迫, 增加；vi. 推, 推进, 增加, 努力争取', '基础', [], [], []],
  ['put', 'vt. /put/', 'vt. 放, 摆, 安置, 移动, 发射, 投掷, 写上, 表达, 使从事, 使受到, 驱使, 赋予；vi. 出发, 航行, 发芽；n. 掷, 股票出售权, 笨蛋；a. 固定不动的；[计] 发送文件', '基础', [], [], []],
  ['puzzle', 'n. /\'pʌzl/', 'n. 难题, 迷惑；vt. 使困惑, 使为难；vi. 迷惑, 苦思', '基础', [], [], []],
  ['quake', 'n. & v. /kweik/', 'vi. 颤抖, 地震；n. 颤抖, 地震', '基础', [], [], []],
  ['qualification', 'n. /.kwɒlifi\'keiʃәn/', 'n. 资格, 条件, 限制；[计] 限定', '基础', [], [], []],
  ['qualify', 'vt.', '使具有资格，使合格', '基础', [], [], []],
  ['quality', 'n. /\'kwɒlәti/', 'n. 品质, 特性, 才能, 质量；a. 优质的；[计] 品质', '基础', [], [], []],
  ['quantity', 'n. /\'kwɒntәti/', 'n. 量, 数量, 总量；[计] 数量; 量', '基础', [], [], []],
  ['quarrel', 'vi. /\'kwɒrәl/', 'n. 吵架, 反目, 怨言, 方头凿；vi. 吵架, 争论, 挑剔', '基础', [], [], []],
  ['quarter', 'n. /\'kwɒ:tә/', 'n. 四分之一, 一刻钟, 季度, 地区；vt. 四等分, 肢解；vi. 驻扎, 住宿', '基础', [], [], []],
  ['queen', 'n. /\'kwi:n/', 'n. 王后, 女王；vt. 立为女王；vi. 做女王', '基础', [], [], []],
  ['question', 'vt. n. /\'kwestʃәn/', 'n. 问题, 询问；v. 询问, 审问, 怀疑；[计] 询问', '基础', [], [], []],
  ['questionnaire', 'n. /kwestʃә\'nєә/', 'n. 调查表, 问卷；[经] 调查表', '基础', [], [], []],
  ['queue', 'n. /kju:/', 'n. 辫子, 一队人, 队列；vt. 使排队, 将...梳成辫子；vi. 排队；[计] 队列', '基础', [], [], []],
  ['quick', 'adj. adv. /kwik/', 'a. 快的, 迅速的, 敏捷的, 灵敏的, 急速的；adv. 快；n. 新长出的肉, 要害, 核心, 感觉敏锐部位', '基础', [], [], []],
  ['quiet', 'adj. /\'kwaiәt/', 'n. 安静, 闲适, 平静；a. 安静的, 静止的, 寂静的, 朴素的, 从容的, 暗中的；vi. 平静下来；vt. 使平静, 使平息, 使安心, 安慰', '基础', [], [], []],
  ['quilt', 'n. /kwilt/', 'n. 棉被；vt. 加软衬料后缝制, 东拼西凑地编；vi. 缝被子', '基础', [], [], []],
  ['quit', 'v. /kwit/', 'vi. 离开, 辞职, 停止；vt. 离开, 放弃, 使解除, 停止；n. 离开；[计] 结束, 退出', '基础', [], [], []],
  ['quite', 'adv. /kwait/', 'adv. 相当, 完全, 十分', '基础', [], [], []],
  ['quiz', 'n. /kwiz/', 'n. 考查, 课堂测验, 恶作剧, 智力测验；vt. 戏弄, 考查, 恶作剧', '基础', [], [], []],
  ['rabbit', 'n. /\'ræbit/', 'n. 兔子；vi. 猎兔；vt. 让...见鬼去', '基础', [], [], []],
  ['race', 'n. v. /reis/', 'n. 种族, 人种, 赛跑, 比赛, 急流, 人类, 同道, 姜根；vi. 赛跑, 竞赛, 疾走；vt. 与...赛跑, 使疾走, 使猛转；[计] 竞争; 追赶; 欧州高级通信研究开发计划', '基础', [], [], []],
  ['racial', 'adj. /\'reiʃәl/', 'a. 人种的, 种族的；[医] 种族的', '基础', [], [], []],
  ['radio', 'n. /\'reidiәu/', 'n. 无线电, 收音机, 无线电报, 无线电广播, 无线电台；v. 用无线电发送', '基础', [], [], []],
  ['rag', 'n. /ræg/', 'n. 碎布, 抹布, 碎片, 碎屑, 少量, 破旧衣服；vt. 责骂, 揶揄, 戏弄；vi. 喧闹', '基础', [], [], []],
  ['rail', 'n. /reil/', 'n. 横杆, 围栏, 栏杆, 铁轨, 扶手, 秧鸡；vt. 以横木围栏, 给...铺铁轨；vi. 责骂, 抱怨', '基础', [], [], []],
  ['railway', 'n. /\'reilwei/', 'n. 铁路, 轨道；[经] 铁路', '基础', [], [], []],
  ['rain', 'n. vi. /rein/', 'n. 雨, 下雨, 雨天；vi. 下雨；vt. 使大量落下', '基础', [], [], []],
  ['rainbow', 'n. /\'reinbәu/', 'n. 彩虹；a. 五彩缤纷的', '基础', [], [], []],
  ['raincoat', 'n. /\'reinkәut/', 'n. 雨衣', '基础', [], [], []],
  ['rainfall', 'n. /\'reinfɒ:l/', 'n. 降雨, 降雨量；[经] 降雨量', '基础', [], [], []],
  ['rainy', 'adj. /\'reini/', 'a. 下雨的, 多雨的', '基础', [], [], []],
  ['raise', 'vt. /reiz/', 'n. 上升, 高地, 增高；vt. 升起, 举起, 唤起, 提高, 使出现, 使复活, 提出, 筹集, 饲养', '基础', [], [], []],
  ['random', 'adj. /\'rændәm/', 'n. 随意, 随机；a. 任意的, 随便的, 胡乱的, 随机的；adv. 胡乱地', '基础', [], [], []],
  ['range', 'n. & v. /\'reindʒ/', 'n. 排, 行, 山脉, 范围, 行列, 射程；vt. 排列, 归类于, 使并列, 放牧；vi. 平行, 延伸, 漫游；[计] 量程; 范围; 域; 距离', '基础', [], [], []],
  ['rank', 'n. v. /ræŋk/', 'n. 等级, 排, 横列, 队伍, 阶级；a. 茂密丛生的, 恶臭的, 十足的, 粗俗的；vt. 排列, 归类于, 把...分等；vi. 列为, 列队；n. 秩；[计] 秩', '基础', [], [], []],
  ['rapid', 'adj. /\'ræpid/', 'a. 迅速的, 飞快的, 急促的, 陡的；n. 急流', '基础', [], [], []],
  ['rare', 'adj. /rєә/', 'a. 稀罕的, 罕有的, 珍奇的, 稀薄的, 半熟的, 非常好的；adv. 非常', '基础', [], [], []],
  ['rat', 'n. /ræt/', 'n. 鼠, 卑鄙的人, 破坏者, 变节者；vi. 捕鼠, 变节；vt. 弄蓬松', '基础', [], [], []],
  ['rate', 'n. & v. /reit/', 'n. 比率, 率, 速度, 价格, 费用, 等级；vt. 估价, 认为, 鉴定等级, 责骂；vi. 被评价, 责骂', '基础', [], [], []],
  ['rather', 'adv. /\'ræðә/', 'adv. 宁可, 稍微, 相当', '基础', [], [], []],
  ['raw', 'adj. /rɒ:/', 'n. 擦伤处, 半成品；a. 生的, 未加工的, 生疏的, 不成熟的, 阴冷的, 刺痛的, 擦掉皮的；vt. 擦伤；[计] 写后读', '基础', [], [], []],
  ['ray', 'n. /rei/', 'n. 光线, 射线, 闪烁, 光辉；vi. 射出光线, 浮现, 放射光线；vt. 放射, 显出', '基础', [], [], []],
  ['razor', 'n. /\'reizә/', 'n. 剃刀；vt. 剃', '基础', [], [], []],
  ['reach', 'v. /ri:tʃ/', 'n. 伸出, 延伸, 区域, 范围, 流域, 岬；vt. 到达, 达到, 伸出, 延伸, 影响；vi. 达到, 延伸, 伸出手, 传到', '基础', [], [], []],
  ['react', 'v. /ri\'ækt/', 'vi. 起反应, 起作用, 反攻；[医] 应答, 发生反应', '基础', [], [], []],
  ['reaction', 'n.', '反应，反作用', '基础', [], [], []],
  ['read', 'v. /ri:d/', 'v. 读, 阅读, 理解；a. 有学问的；n. 读取, 阅读；[计] 读取', '基础', [], [], []],
  ['reading', 'n. /\'ri:diŋ/', 'n. 阅读, 知识, 读物；a. 阅读的', '基础', [], [], []],
  ['ready', 'adj. /\'redi/', 'n. 预备好的状态, 现款；a. 准备好的, 备用的, 可以使用的；adv. 预先, 迅速；vt. 使准备好', '基础', [], [], []],
  ['real', 'adj. /\'riәl/', 'a. 真的, 真实的, 实际的, 实在的, 不动(产)的, 实数的；n. 实数, 现实；adv. 真正地', '基础', [], [], []],
  ['realise', 'vt. /\'riәlaiz,\'ri:-/', 'vt. 实现, 认识到, 体会到, 了解, 认清, 使显得逼真, 变卖财产为现钱', '基础', [], [], []],
  ['realistic', 'adj.', '现实的，现实主义的', '基础', [], [], []],
  ['reality', 'n. /ri\'æliti/', 'n. 实在, 事实, 实体, 逼真；[法] 现实, 实在存在的事物, 实在性', '基础', [], [], []],
  ['really', 'adv.', '真正地；确实，的确', '基础', [], [], []],
  ['reason', 'vi. n. /\'ri:zn/', 'n. 理由, 原因, 理智, 道理, 前提, 理性；vt. 说服, 推论, 辩论；vi. 推论, 劝说, 思考', '基础', [], [], []],
  ['reasonable', 'adj. /\'ri:znәbl/', 'a. 合理的, 明理的, 适当的；[法] 合理的, 公道的, 正当的', '基础', [], [], []],
  ['rebuild', 'vt. /ri\'bild/', 'vt. 改建, 重建, 改造；vi. 重建', '基础', [], [], []],
  ['recall', 'n. & vt.', '回忆，取消，召回', '基础', [], [], []],
  ['receipt', 'n. /ri\'si:t/', 'n. 收据, 收入, 收到；vt. 开...的收据', '基础', [], [], []],
  ['receive', 'v. /ri\'si:v/', 'vt. 收到, 接到, 得到, 接待, 迎接, 承受；vi. 收到, 会客；[计] 接收', '基础', [], [], []],
  ['receiver', 'n. /ri\'si:vә/', 'n. 接收器；接受者；收信机；收款员, 接待者', '基础', [], [], []],
  ['reception', 'n. /ri\'sepʃәn/', 'n. 接待, 接受, 招待会；[医] 接受, 感受', '基础', [], [], []],
  ['receptionist', 'n. /ri\'sepʃәnist/', 'n. 接待员', '基础', [], [], []],
  ['recite', 'v. /ri\'sait/', 'v. 背诵, 朗读, 叙述', '基础', [], [], []],
  ['recognise', 'vt. /\'rekә^naiz/', 'vt. 认识, 辩认, 认出, 承认, 认可, 清楚地认识到, 自认, 公认, 赏识, 准许某人发言', '基础', [], [], []],
  ['recommend', 'v. /.rekә\'mend/', 'vt. 推荐, 介绍, 劝告, 使受欢迎, 托付；[经] 建议, 推荐', '基础', [], [], []],
  ['record', 'n. v. /ri\'kɒ:d/', 'n. 记录, 履历, 档案, 审判记录, 最高纪录, 唱片；vt. 记录, 记载, 标明, 将...录音；vi. 记录, 录音, 可被录音；a. 创纪录的；[计] 录制, 记录', '基础', [], [], []],
  ['recorder', 'n. /ri\'kɒ:dә/', 'n. 记录员, 录音机；n. 记录器；[计] 宏录制器, 记录器', '基础', [], [], []],
  ['recover', 'vi. /ri\'kʌvә/', 'vt. 重新获得, 恢复, 复原, 拯救；vi. 痊愈, 复原, 胜诉；[计] 恢复', '基础', [], [], []],
  ['recreation', 'n. /.rekri\'eiʃәn/', 'n. 娱乐, 消遣, 休息, 再创造；[医] 娱乐, 休养', '基础', [], [], []],
  ['recycle', 'vt. /.ri:\'saikl/', 'vt. 使再循环, 重新利用, 再制；n. 再循环', '基础', [], [], []],
  ['red', 'adj. n. /red/', 'a. 红的, 红色的, 红肿的, 流血的；n. 红色, 红颜料, 赤字；[计] 简化, 减少', '基础', [], [], []],
  ['reduce', 'vt. /ri\'dju:s/', 'vt. 减少, 分解, 降低, 使衰退, 把...分解, 把...归纳；vi. 减少, 减肥, 缩小；[计] 缩小', '基础', [], [], []],
  ['refer', 'vi. /ri\'fә:/', 'vt. 提交, 归诸于, 把...提交, 使求助于；vi. 提到, 涉及, 查阅, 查询, 咨询', '基础', [], [], []],
  ['reference', 'n. /\'refәrәns/', 'n. 参考, 索引, 参照；vt. 给...加上参考资料；vt. 引用；vi. 引用；[计] 引用', '基础', [], [], []],
  ['reflect', 'v. /ri\'flekt/', 'vt. 反射, 反映, 招致, 深思；vi. 被反射, 映出, 深思, 考虑, 指责', '基础', [], [], []],
  ['reform', 'v. & n. /ri\'fɒ:m/', 'n. 改革, 改正, 改造；vt. 改革, 改过, 革新, 重整；vi. 革新, 改过', '基础', [], [], []],
  ['refresh', 'v. /ri\'freʃ/', 'vt. 使清新, 使恢复, 使生气蓬勃；vi. 提起精神, 恢复精神, 吃点心, 喝饮料；vt. 刷新, 重新整理；vi. 刷新, 重新整理；[计] 刷新, 重新整理', '基础', [], [], []],
  ['refrigerator', 'n. /ri\'fridʒәreitә/', 'n. 电冰箱, 冷藏库；[计] 冷冻机; 致冷器', '基础', [], [], []],
  ['refusal', 'n. /ri\'fju:zl/', 'n. 拒绝, 推却, 优先决定权；[法] 拒绝, 谢绝, 取舍权', '基础', [], [], []],
  ['refuse', 'vi. /ri\'fju:z/', 'vt. 拒绝, 谢绝；vi. 拒绝；n. 废物；a. 扔掉的, 无用的', '基础', [], [], []],
  ['regard', 'v. /ri\'gɑ:d/', 'n. 关心, 注意, 尊敬, 关系, 问候；vt. 视为, 注意, 考虑, 和...有关, 看待；vi. 注视, 注意', '基础', [], [], []],
  ['regarding', 'prep.', '关于', '基础', [], [], []],
  ['regardless', 'adv. /ri\'gɑ:dlis/', 'a. 不管, 不注意, 不顾', '基础', [], [], []],
  ['regards', 'n.', 'n. 问候, 致意', '基础', [], [], []],
  ['region', 'n.', '地区，范围，领域', '基础', [], [], []],
  ['regional', 'adj.', '地区的，局部的', '基础', [], [], []],
  ['register', 'n. v. /\'redʒistә/', 'n. 寄存器, 记录, 登记簿, 注册；vt. 记录, 注册, 提示, 表达, 把...挂号；vi. 登记, 注册, 挂号；[计] 寄存器', '基础', [], [], []],
  ['regret', 'n. & vt. /ri\'gret/', 'n. 遗憾, 后悔, 悔恨, 抱歉, 歉意；vt. 为...感到遗憾, 后悔, 惋惜, 懊悔, 抱歉；vi. 感到抱歉', '基础', [], [], []],
  ['regular', 'adj. /\'regjulә/', 'a. 规则的, 常例的, 有秩序的, 整齐的, 等边的, 定期的, 经常的, 合格的, 常备军的；n. 正规军, 正式队员；adv. 经常地；n. 正常体；[计] 正常体', '基础', [], [], []],
  ['regulation', 'n. /.regju\'leiʃәn/', 'n. 规则, 管理, 调整；[计] 调整; 规章; 规则; 调节', '基础', [], [], []],
  ['reject', 'v. /ri\'dʒekt/', 'n. 被拒之人, 被弃之物, 不合格品, 次品；vt. 拒绝, 抵制, 否决, 驳回, 丢弃, 呕出', '基础', [], [], []],
  ['relate', 'vi. /ri\'leit/', 'vt. 讲, 叙述, 使互相关联；vi. 有关, 符合, 相处得好', '基础', [], [], []],
  ['relation', 'n. /ri\'leiʃәn/', 'n. 关系, 联系, 叙述, 故事, 家属, 亲戚；[计] 关系', '基础', [], [], []],
  ['relationship', 'n. /ri\'leiʃәnʃip/', 'n. 关系, 关联；[医] 关系', '基础', [], [], []],
  ['relative', 'n. /\'relәtiv/', 'n. 亲戚, 关系词；a. 有关系的, 相对的, 比较的', '基础', [], [], []],
  ['relax', 'v. /ri\'læks/', 'vi. 放松, 松懈, 松弛, 变从容, 休息, 休养；vt. 使松弛, 缓和, 使松懈, 使休息', '基础', [], [], []],
  ['release', 'vt. & n.', '释放，让渡，发行', '基础', [], [], []],
  ['relevant', 'adj. /\'relivәnt/', 'a. 有关联的, 有关系的, 适当的, 相应的；[法] 有关的, 相关的', '基础', [], [], []],
  ['reliable', 'adj. /ri\'laiәbl/', 'a. 可靠的, 可信赖的；[法] 可靠的, 可信赖的, 确实的', '基础', [], [], []],
  ['relief', 'n. /ri\'li:f/', 'n. 减轻, 解除, 救济, 安慰, 调剂, 浮雕, 换班, (地势的)起伏；[医] 缓减, 减轻, 浮雕(绘画中)', '基础', [], [], []],
  ['religion', 'n. /ri\'lidʒәn/', 'n. 宗教, 信仰；[法] 宗教, 宗教信仰, 信仰', '基础', [], [], []],
  ['religious', 'adj. /ri\'lidʒәs/', 'a. 宗教性的, 虔诚的, 宗教上的, 严谨的；n. 修道士, 出家人', '基础', [], [], []],
  ['rely', 'v. /ri\'lai/', 'vi. 信赖, 依赖, 信任', '基础', [], [], []],
  ['remain', 'vt. vi. /ri\'mein/', 'vi. 保持, 逗留, 剩余；[法] 停留, 居住, 继续', '基础', [], [], []],
  ['remaining', 'adj.', '剩余的', '基础', [], [], []],
  ['remark', 'n. /ri\'mɑ:k/', 'n. 评论, 注意；vt. 评论, 注意；vi. 评论, 谈论；[计] 注释', '基础', [], [], []],
  ['remember', 'v. /ri\'membә/', 'vt. 记得, 回忆起, 记住, 铭记, 纪念；vi. 记得', '基础', [], [], []],
  ['remind', 'vt. /ri\'maind/', 'vt. 提醒, 使想起', '基础', [], [], []],
  ['remote', 'adj. /ri\'mәut/', 'a. 遥远的, 偏僻的, 疏远的, 微少的；[计] 远程, 远程访问实用程序', '基础', [], [], []],
  ['removal', 'n.', '移动，搬迁，除去，开除', '基础', [], [], []],
  ['remove', 'vt. /ri\'mu:v/', 'vt. 移动, 调动, 除去, 迁移, 开除, 移交；vi. 迁移, 移动, 搬家；n. 班级, 升级, 移动, 搬家, 间距；[计] 删除', '基础', [], [], []],
  ['rent', 'n. & v. /rent/', 'n. 租金, 房租, 出租物, 裂缝, 破裂处, 分裂；vt. 租用, 租出；vi. 出租；a. 分裂的, 破裂的；rend的过去式和过去分词', '基础', [], [], []],
  ['repair', 'n. & vt. /ri\'pєә/', 'n. 修理, 补救, 修复；vt. 修理, 修补, 补救, 恢复, 补偿；vi. 修理, 修补, 补救, 恢复, 去, 常去, 集合', '基础', [], [], []],
  ['repairs', 'n.', 'n. 备件；修理；修理费；修理工作（repair的复数形式）', '基础', [], [], []],
  ['repeat', 'vt. /ri\'pi:t/', 'n. 重复, 反复；vt. 重做, 重复, 复述, 使再现, 复制；vi. 重复；[计] 重复', '基础', [], [], []],
  ['replace', 'vt. /ri\'pleis/', 'vt. 代替, 替换, 放回, 归还；[计] 替换; DOS外部命令:取代或更新文件', '基础', [], [], []],
  ['reply', 'n. & v. /ri\'plai/', 'n. 答复, 回答, 答辩；vi. 答复, 回答, 回击, 反响, 答辩；vt. 回答；[计] 答复', '基础', [], [], []],
  ['report', 'n. & v. /ri\'pɒ:t/', 'n. 报告, 报道, 传说, 案情报告, 爆炸声, 成绩单；vt. 报告, 汇报, 转述, 报道, 揭发, 使报到；vi. 报告, 写报道, 报到；[计] 报告', '基础', [], [], []],
  ['reporter', 'n. /ri\'pɒ:tә/', 'n. 记者, 报告者；[化] 指示器', '基础', [], [], []],
  ['represent', 'vt. /.repri\'zent/', 'vt. 表现, 表示, 描绘, 讲述, 代表, 象征, 回忆, 再赠送, 再上演；vi. 提出异议', '基础', [], [], []],
  ['representative', 'n. /.repri\'zentәtiv/', 'n. 代表, 众议员, 典型；a. 描写的, 表现的, 代理的, 代表的, 代议制的, 典型的', '基础', [], [], []],
  ['republic', 'n. /ri\'pʌblik/', 'n. 共和国, 共和政体, 团体, 界', '基础', [], [], []],
  ['reputation', 'n. /.repju\'teiʃәn/', 'n. 名誉, 名声, 声望；[法] 名声, 名誉, 公认证据', '基础', [], [], []],
  ['request', 'n. & vt. /ri\'kwest/', 'n. 请求, 需要, 申请书；vt. 请求, 要求, 邀请；[计] 请求', '基础', [], [], []],
  ['require', 'vt. /ri\'kwaiә/', 'vt. 需要, 命令, 要求；[法] 需要, 要求, 命令', '基础', [], [], []],
  ['requirement', 'n. /ri\'kwaiәmәnt/', 'n. 需求, 必要条件, 要求；[化] 要求; 合同要求', '基础', [], [], []],
  ['rescue', 'vt. /\'reskju:/', 'n. 援救, 解救, 营救；vt. 援救, 救出, 营救', '基础', [], [], []],
  ['research', 'n. /ri\'sә:tʃ/', 'n. 研究, 调查, 考察；vi. 研究, 调查', '基础', [], [], []],
  ['resemble', 'v. /ri\'zembl/', '（不用进行时）像，看起来像', '基础', [], [], []],
  ['reservation', 'n. /.rezә\'veiʃәn/', 'n. 保留, 预定, 保留品, 保留地；[经] 预定, 预约, 权益保留', '基础', [], [], []],
  ['reserve', 'n. & v. /ri\'zә:v/', 'n. 储备品, 贮量, 后备军, 自然保护区, 保留, 拘谨, 节制, 储备金；vt. 保留, 保存, 预订, 延期, 推迟', '基础', [], [], []],
  ['resign', 'v. /ri\'zain/', 'vt. 辞职, 放弃, 使顺从；vi. 辞职, 屈从', '基础', [], [], []],
  ['resist', 'v. /ri\'zist/', 'v. 抵抗, 耐得住, 抵制, 反抗；n. 防染材料', '基础', [], [], []],
  ['resource', 'n.', '资源', '基础', [], [], []],
  ['respect', 'vt. & n. /ri\'spekt/', 'n. 尊敬, 尊重, 问候；vt. 尊敬, 注意, 遵守', '基础', [], [], []],
  ['respond', 'v. /ri\'spɒnd/', 'vt. 以...回答；vi. 回答, 响应, 回报, 有反应, 承担责任', '基础', [], [], []],
  ['response', 'n.', '回答，响应，答复', '基础', [], [], []],
  ['responsibility', 'n. /ri.spɒnsә\'biliti/', 'n. 责任, 职责, 负担, 可靠性；[化] 职责', '基础', [], [], []],
  ['responsible', 'adj.', '有责任的，负责的', '基础', [], [], []],
  ['rest', 'n. vi. /rest/', 'n. 休息, 睡眠, 安息, 稍息, 静止, 支架, 休息处, 其余者, 剩余部分；vi. 休息, 睡, 长眠, 安心, 静止, 停止, 安置, 依赖；vt. 使休息, 使支撑, 把...寄托于', '基础', [], [], []],
  ['restaurant', 'n. /\'restәrɒŋ/', 'n. 餐馆, 饭店', '基础', [], [], []],
  ['restore', 'vt.', '恢复，归还，复原', '基础', [], [], []],
  ['restriction', 'n. /ri\'strikʃәn/', 'n. 限制, 限定, 约束；[计] 限定', '基础', [], [], []],
  ['result', 'n. /ri\'zʌlt/', 'n. 结果, 成绩, 答案；vi. 产生, 结果, 致使；[计] 结果', '基础', [], [], []],
  ['retell', 'vt. /ri:\'tel/', 'vt. 再讲, 重复, 重说', '基础', [], [], []],
  ['retire', 'v. /ri\'taiә/', 'n. 隐居；vi. 引退, 退役, 退休, 退去, 撤退, 退却；vt. 使...撤退, 辞退', '基础', [], [], []],
  ['return', 'v. n. /ri\'tә:n/', 'n. 回来, 返回, 来回票, 归还, 报答, 利润率, 报告书；a. 返回的, 回程的, 报答的, 反向的, 重现的, 复原的；vi. 返回, 归还, 回来；vt. 归还, 还, 回报, 产生, 反射, 报告, 申报, 退回；[计] 返回', '基础', [], [], []],
  ['reveal', 'vt.', '显示，透露，揭示，展现', '基础', [], [], []],
  ['revenue', 'n.', '税收，收入，税务局', '基础', [], [], []],
  ['review', 'vt. n. /ri\'vju:/', 'n. 检讨, 复习, 回顾, 检阅, 评论；vt. 温习, 检讨, 评论, 再检察, 复审；vi. 复习功课, 写评论', '基础', [], [], []],
  ['revision', 'n. /ri\'viʒәn/', 'n. 校订, 修正, 修订本, 修订版；[计] 修订版', '基础', [], [], []],
  ['revolution', 'n. /.revә\'lu:ʃәn/', 'n. 革命, 大变革, 旋转, 转数, 循环；[化] 回转', '基础', [], [], []],
  ['reward', 'n. /ri\'wɒ:d/', 'n. 报酬, 酬谢, 赏金；vt. 奖赏, 酬谢, 给...应有报应', '基础', [], [], []],
  ['rewind', 'v. /ri:\'waind/', 'vt. 重绕；n. 重绕；[计] 反绕', '基础', [], [], []],
  ['rhyme', 'n. v. /raim/', 'n. 韵, 押韵, 韵文；vi. 押韵；vt. 使押韵, 用韵诗表达', '基础', [], [], []],
  ['rice', 'n. /rais/', 'n. 米, 米饭, 稻；vt. 将...压成米粒状', '基础', [], [], []],
  ['rich', 'adj. /ri:tʃ/', 'a. 富裕的, 富饶的, 浓厚的, 贵重的', '基础', [], [], []],
  ['rid', 'vt. /rid/', 'vt. 免除, 以...清除, 使获自由, 使摆脱；[法] 免除, 清除, 摆脱', '基础', [], [], []],
  ['riddle', 'n. /\'ridl/', 'n. 谜, 谜语, 粗筛；vt. 解谜, 给...出谜, 筛, 寻根究底地检验, 充满于；vi. 出谜', '基础', [], [], []],
  ['ride', 'v. n. /raid/', 'n. 骑马, 乘坐, 乘车, 搭便车；vt. 骑, 乘坐, 压迫, 控制；vi. 骑马, 乘车, 漂游', '基础', [], [], []],
  ['ridiculous', 'adj. /ri\'dikjulәs/', 'a. 荒谬的, 可笑的', '基础', [], [], []],
  ['right', 'n. adj. adv. /rait/', 'n. 权利, 右边, 正义, 右派, 公正；a. 正确的, 对的, 恰当的, 正常的, 正直的, 正面的, 右方的；adv. 正确地, 以有利结果, 一直, 直接, 向右；vt. 扶直, 整理, 纠正, 伸冤, 使昭雪；vi. 恢复平衡；[计] 右, 权利', '基础', [], [], []],
  ['rigid', 'adj. /\'ridʒid/', 'a. 坚硬的, 刚性的, 严格的, 精密的, 刻板的', '基础', [], [], []],
  ['ring', 'v. n. /riŋ/', 'n. 环, 环形物, 拳击场, 戒指, 角逐, 小集团, 铃声, 钟声, 声调；vt. 包围, 套住, 按铃, 敲钟；vi. 成环形, 响, 鸣, 按铃, 敲钟, 回响', '基础', [], [], []],
  ['ripe', 'adj. /raip/', 'a. 成熟的, 熟练的, 成年的；[医] 成熟的', '基础', [], [], []],
  ['rise', 'vi. /raiz/', 'n. 上升, 增加, 上涨, 高地, 升高, 出现；vi. 升起, 起身, 起立, 上升, 上涨, 增长, 高耸, 起义, 浮现；vt. 使飞起', '基础', [], [], []],
  ['risk', 'n. & v. /risk/', 'n. 冒险, 危险, 保险额；vt. 冒...的危险, 冒险干', '基础', [], [], []],
  ['river', 'n. /\'rivә/', 'n. 河, 江；[法] 河流, 江河, 内河', '基础', [], [], []],
  ['road', 'n. /rәud/', 'n. 路, 道路, 公路, 途径, 方法；[法] 公路, 道路, 行车道', '基础', [], [], []],
  ['roast', 'v. /rәust/', 'n. 烤肉, 烘烤, 嘲笑；a. 烘烤的, 烤过的；vt. 烤, 炙, 烘焙, 嘲笑；vi. 烤, 炙, 烘焙', '基础', [], [], []],
  ['rob', 'v. /rɒb/', 'v. 抢夺, 抢掠, 剥夺', '基础', [], [], []],
  ['robot', 'n. /\'rәubәt/', 'n. 机械人, 自动机械, 机械般工作的人；[计] 机器人; 自动机', '基础', [], [], []],
  ['rock', 'n. vt. /rɒk/', 'n. 岩石, 岩礁, 石头, 基石, 暗礁, 摇动, 摇滚乐；vt. 摇摆, 摇动, 使摇晃, 使动摇；vi. 摇, 摇动', '基础', [], [], []],
  ['rocket', 'n. /\'rɒkit/', 'n. 火箭, 烟火；vi. 急升, 猛涨, 飞驰；vt. 用火箭运载', '基础', [], [], []],
  ['role', 'n. /rәul/', 'n. 角色, 职责, 任务；[医] 作用, 功用', '基础', [], [], []],
  ['roll', 'v. n. /rәul/', 'n. 卷, 滚动, 名单, 案卷, 压路机；vi. 滚, 滚动, 飘流, 起伏, 卷, 绕；vt. 使滚动, 卷, 绕', '基础', [], [], []],
  ['roof', 'n. /ru:f/', 'n. 屋顶, 室顶；vt. 给...盖屋顶, 遮蔽', '基础', [], [], []],
  ['room', 'n. /ru:m/', 'n. 房间, 空位, 场所；vi. 住宿, 居住；vt. 留宿', '基础', [], [], []],
  ['root', 'n. /ru:t/', 'n. 根, 根本, 根源, 基础, 底部；vt. 使扎根, 使固定, 根除, 肃清, 搜出, 用鼻拱；vi. 生根, 固定, 源于, 用鼻拱土, 寻找, 捧场, 支持', '基础', [], [], []],
  ['rope', 'n. /rәup/', 'n. 绳, 索, 粗绳, 绞索, 决窍；vt. 捆, 缚, 绑, 圈起, 以绳将...系住；vi. 拧成绳状', '基础', [], [], []],
  ['rose', 'n. /rәuz/', 'n. 玫瑰, 蔷薇, 玫瑰色；a. 玫瑰色的, 玫瑰花的；vt. 使成玫瑰色；rise的过去式', '基础', [], [], []],
  ['rot', 'vi. /rɒt/', 'n. 腐烂, 腐蚀, 败坏；vi. 腐烂, 烂, 堕落, 憔悴；vt. 使腐烂, 使腐朽, 使堕落', '基础', [], [], []],
  ['rough', 'adj. /rʌf/', 'n. 粗糙的东西, 毛坯, 未加工品, 梗概, 草图, 暴徒, 艰难；a. 粗糙的, 粗暴的, 蓬乱的, 草率的, 大致的, 简陋的, 暴风雨的, 艰难的；vt. 使粗糙, 使不平, 使蓬乱, 粗制, 草拟, 粗暴对待, 对...动粗；vi. 变粗糙；adv. 粗糙地, 粗暴地', '基础', [], [], []],
  ['round', 'adj. adv. prep. /raund/', 'n. 圆, 圆形物, 巡回, 循环, 一轮, 一回合, 一局, 范围, 轮唱；a. 圆的, 球形的, 丰满的, 肥胖的, 完全的, 大概的, 完美的, 圆润的；prep. 围着, 附近, 绕过, 在...周围；adv. 围绕着, 在周围, 迂回地, 挨个, 朝反方向；vt. 弄圆, 使成圆形, 绕行, 完成, 围捕, 把...四舍五入；vi. 变圆, 发胖, 环行, 拐弯, 进展', '基础', [], [], []],
  ['roundabout', 'adj. & n. /\'raundә.baut/', 'a. 迂回的, 委婉的；n. 迂回路线', '基础', [], [], []],
  ['route', 'n.', '路线', '基础', [], [], []],
  ['routine', 'n. /ru:\'ti:n/', 'n. 常规, 日常工作, 惯例, 例行公事；a. 日常的, 常规的；[计] 例程', '基础', [], [], []],
  ['row', 'n. v. /rәu. rau/', 'n. 排, 行, 街道, 划船, 吵闹；vt. 使成排, 划, 划船, 参加(赛船), 痛骂；vi. 划船, 划动, 争吵；[计] 行', '基础', [], [], []],
  ['royal', 'adj. /\'rɒiәl/', 'n. 王室, 皇族；a. 王室的, 皇家的, 盛大的, 庄严的', '基础', [], [], []],
  ['rubber', 'n. /\'rʌbә/', 'n. 橡皮, 橡胶, 做摩擦动作的人, 按摩师, 决胜盘；vt. 用橡胶制造, 涂橡胶于', '基础', [], [], []],
  ['rubbish', 'n. /\'rʌbiʃ/', 'n. 废物, 垃圾, 胡说', '基础', [], [], []],
  ['rude', 'adj. /ru:d/', 'a. 粗鲁无礼的, 粗陋的, 粗暴的, 原始的, 未开化的, 大略的, 崎岖不平的, 狂暴的', '基础', [], [], []],
  ['rugby', 'n. /\'rʌ^bi/', 'n. 橄榄球, 橄榄球赛', '基础', [], [], []],
  ['ruin', 'vt. n. /ruin/', 'n. 毁灭, 推翻, 废墟；vi. 毁灭, 衰败, 破坏, 破产, 堕落；vt. 使毁灭, 毁坏, 使破产', '基础', [], [], []],
  ['rule', 'n. vt. /ru:l/', 'n. 规则, 统治, 控制, 支配, 规律, 标准, 章程, 破折号, 铅线；vt. 规定, 统治, 管理, 控制, 支配, 裁决；vi. 统治, 管辖, 裁定；[计] 规则, 水线', '基础', [], [], []],
  ['ruler', 'n. /\'ru:lә/', 'n. 统治者, 管理者, 尺, 直尺；n. 划线板；[计] 标尺', '基础', [], [], []],
  ['run', 'vi. /rʌn/', 'n. 跑, 赛跑, 奔跑, 奔跑的路程, 趋向, 流出, 运转时间, 连续；vi. 跑, 奔跑, 跑步, 赛跑, 竞赛, 行驶, 运转, 进行, 蔓延；vt. 使跑, 参赛, 追究, 驾驶, 开动, 管理, 经营, 使流出, 运行；a. 熔化的, 融化的, 浇铸的；run的过去式和过去分词；[计] 运行', '基础', [], [], []],
  ['rural', 'adj.', '乡下的，农村的', '基础', [], [], []],
  ['rush', 'vi. /rʌʃ/', 'n. 匆促, 冲进, 急流, 灯心草；vi. 冲, 奔, 闯, 赶紧, 匆促行事, 涌现；vt. 使冲, 匆忙地做, 突袭, 飞跃, 用灯心草做；a. 紧急的', '基础', [], [], []],
  ['sacred', 'adj. /\'seikrid/', 'a. 神圣的, 献给上帝的, 庄严的, 祭祀的；[法] 神圣的, 不可侵犯的', '基础', [], [], []],
  ['sacrifice', 'n. & vt. /\'sækrifais/', 'n. 牺牲, 供奉, 祭品；vt. 牺牲, 祭祀, 贱卖；vi. 献祭', '基础', [], [], []],
  ['sad', 'adj. /sæd/', 'a. 忧愁的, 悲哀的', '基础', [], [], []],
  ['sadness', 'n. /\'sædnis/', 'n. 悲哀, 悲伤', '基础', [], [], []],
  ['safe', 'adj. n. /seif/', 'n. 保险箱, 冷藏室；a. 安全的, 可靠的, 平安的, 稳健的, 有把握的', '基础', [], [], []],
  ['safety', 'n. /\'seifti/', 'n. 安全, 保险, 平安, 保安设备；vt. 保护, 防护', '基础', [], [], []],
  ['sail', 'n. v. /seil/', 'n. 帆, 篷, 帆船, 航程, 帆状物；vi. 航行, 启航, 张帆而行；vt. 航行于, 驾船', '基础', [], [], []],
  ['sailor', 'n. /\'seilә/', 'n. 水手, 船员, 海员；[法] 水手, 船员, 海员', '基础', [], [], []],
  ['sake', 'n.', '缘故，理由；利益', '基础', [], [], []],
  ['salad', 'n. /\'sælәd/', '色拉（西餐中的一种菜）', '基础', [], [], []],
  ['salary', 'n. /\'sælәri/', 'n. 薪水；vt. 给...加薪', '基础', [], [], []],
  ['sale', 'n. /seil/', 'n. 出售, 卖, 拍卖, 销售额, 廉价出售；[经] 卖, 出售; 销售(货)', '基础', [], [], []],
  ['salesgirl', 'n. /\'seilzgә:l/', 'n. 女店员', '基础', [], [], []],
  ['salesman', 'n. /\'seilzmәn/', 'n. 售货员, 推销员；[经] 售货员, 店员, 推销员', '基础', [], [], []],
  ['saleswoman', 'n. /\'seilzwumәn/', 'n. 女售货员, 女店员', '基础', [], [], []],
  ['salt', 'n. /sɒ:lt/', 'n. 盐, 风趣, 刺激；a. 含盐的, 咸的, 风趣的, 辛辣的；vt. 加盐于, 用盐腌', '基础', [], [], []],
  ['salty', 'adj. /\'sɒ:lti/', 'a. 有盐分的, 咸味浓的, 海洋的, 辛辣的, 有经验的', '基础', [], [], []],
  ['same', 'n. adj. /seim/', 'a. 相同的, 同样的；pron. 相同的人(或事物)；adv. 同样地', '基础', [], [], []],
  ['sand', 'n. /sænd/', 'n. 沙, 沙子, 沙滩, 光阴, 生涯；vt. 撒沙, 以沙掩盖', '基础', [], [], []],
  ['sandwich', 'n. /\'sændwitʃ/', 'n. 三明治, 夹心面包, 夹层板；vt. 插入, 夹入, 把...制成三明治', '基础', [], [], []],
  ['satellite', 'n. /\'sætlait/', 'n. 人造卫星；[医] 伴行静脉, 陪静脉, 陪病部, 随体, 卫星', '基础', [], [], []],
  ['satisfaction', 'n. /.sætis\'fækʃәn/', 'n. 满足, 满意, 快事, 赔偿, 赎罪, 报仇的机会；[经] 偿还, 赎回', '基础', [], [], []],
  ['satisfy', 'vt. /\'sætisfai/', 'vt. 使满意, 满足, 符合, 使确信, 赔偿；vi. 令人满意, 替人赎罪', '基础', [], [], []],
  ['sausage', 'n. /\'sɒsidʒ/', 'n. 香肠, 腊肠', '基础', [], [], []],
  ['save', 'vt. /seiv/', 'n. 救球；vt. 解救, 挽救, 储蓄, 保存, 节省, 保留；vi. 挽救, 节省, 救球；prep. 除...之外；[计] 保存', '基础', [], [], []],
  ['say', 'vt. /sei/', 'vt. 说, 讲, 念, 说明, 指明；vi. 说, 讲；n. 意见, 发言权', '基础', [], [], []],
  ['saying', 'n. /\'seiiŋ/', 'n. 叙述, 话, 说, 言论', '基础', [], [], []],
  ['scale', 'n.', '天平，秤', '基础', [], [], []],
  ['scan', 'n. & v. /skæn/', 'n. 审视, 浏览, 扫描, 细查；vt. 细看, 浏览, 扫描, 详细调查, 标出格律；vi. 押韵, 扫描；[计] 网络软件目录, 编码与分析系统', '基础', [], [], []],
  ['scar', 'n. /skɑ:/', 'n. 疤痕, 伤痕, 悬崖；vi. 结疤, 愈合, 痊愈；vt. 使有伤痕', '基础', [], [], []],
  ['scare', 'vt. /skєә/', 'n. 惊吓, 恐慌；vt. 惊吓, 使恐慌；vi. 受惊', '基础', [], [], []],
  ['scarf', 'n. /skɑ:f/', 'n. 围巾, 头巾, 领带, 领巾, 嵌接；vt. 用围巾围, 嵌接', '基础', [], [], []],
  ['scene', 'n. /si:n/', 'n. 场, 情景, 镜头, 发生地点, 道具, 布景, 景色；[化] 现场', '基础', [], [], []],
  ['scenery', 'n. /\'si:nәri/', 'n. 风景, 景色, 舞台布景', '基础', [], [], []],
  ['sceptical', 'adj. /\'skeptikl/', 'a. 怀疑论的, 怀疑的', '基础', [], [], []],
  ['schedule', 'n. v. /\'skedʒuәl/', 'n. 时间表, 一览表, 计划表, 议事日程；vt. 预定, 编制目录, 制...表, 安排', '基础', [], [], []],
  ['scheme', 'n. & v.', '计划；策划', '基础', [], [], []],
  ['scholar', 'n. /\'skɒlә/', 'n. 学者, 奖学金获得者, 有文化者, 学习者', '基础', [], [], []],
  ['scholarship', 'n. /\'skɒlәʃip/', 'n. 学问, 学术成就, 奖学金', '基础', [], [], []],
  ['school', 'n. /sku:l/', 'n. 学校, 鱼群, 门派, 学派；vt. 教育, 训练, 培养；vi. 成群地游', '基础', [], [], []],
  ['schoolbag', 'n. /\'sku:lbæ^/', 'n. 书包', '基础', [], [], []],
  ['schoolmate', 'n. /\'sku:lmeit/', 'n. 同窗, 同学', '基础', [], [], []],
  ['science', 'n. /\'saiәns/', 'n. 科学, 学科, 学问, 自然科学；[医] 科学', '基础', [], [], []],
  ['scientific', 'adj. /.saiәn\'tifik/', 'a. 科学的, 系统的, 符合科学规律的；[计] 科学记数法', '基础', [], [], []],
  ['scientist', 'n. /\'saiәntist/', 'n. 科学家；[医] 科学家', '基础', [], [], []],
  ['scissors', 'n. /\'sizәz/', 'pl. 剪刀；[医] 剪', '基础', [], [], []],
  ['scold', 'vt. /skәuld/', 'n. 好骂街的人, 责骂；v. 责骂', '基础', [], [], []],
  ['score', 'n. & v. /skɒ:/', 'n. 得分, 抓痕, 二十个, 刻痕, 帐目, 乐谱, 起跑线, 终点线, 大量；vt. 刻划, 划线, 获得, 评价, 把...记下；vi. 刻痕, 记分, 得分；[计] 得分', '基础', [], [], []],
  ['scratch', 'v. & n. /skrætʃ/', 'n. 抓痕, 搔, 抓, 擦伤, 刮擦声, 乱写, 零分, 起跑线；vt. 搔, 抓, 挖出, 擦, 刮, 乱涂, 勾抹掉；vi. 搔, 抓, 发刮擦声, 勉强糊口；a. 碰巧的, 凑合的, 打草稿用的；[计] 擦除', '基础', [], [], []],
  ['scream', 'n. & v. /skri:m/', 'n. 尖叫声；vi. 尖叫, 大笑, 尖啸, 令人震惊；vt. 尖叫着说, 大叫大嚷着要求', '基础', [], [], []],
  ['screen', 'n. /skri:n/', 'n. 幕, 银幕, 屏风, 掩蔽物, 屏蔽, 筛子；vt. 掩蔽, 放映, 拍摄, 掩护, 筛, 甄别；vi. 拍电影；[计] 筛选; 屏幕', '基础', [], [], []],
  ['sea', 'n. /si:/', 'n. 海, 海洋, 海浪, 大量；[法] 海, 海洋', '基础', [], [], []],
  ['seal', 'n. vt. /si:l/', 'n. 印章, 封条, 海豹, 海豹皮, 火漆, 封蜡, 玺, 保证, 批准, 象征, 标志；vt. 封闭, 盖印, 盖章；vi. 猎海豹', '基础', [], [], []],
  ['search', 'n. & v. /sә:tʃ/', 'n. 搜寻, 查究；v. 搜寻, 搜查, 探求, 调查, 搜索；[计] 搜索, 路径检索程序', '基础', [], [], []],
  ['seaside', 'n. /\'si:said/', 'a. 海边的, 海滨的；n. 海滨', '基础', [], [], []],
  ['season', 'n. /\'si:zn/', 'n. 季节, 时节, 当令期, 时期；vt. 给...调味, 使成熟, 使老练, 缓和；vi. 变干燥', '基础', [], [], []],
  ['seat', 'n. /si:t/', 'n. 座, 座位, 位子, 席位, 所在地；vt. 使坐下, 使就座, 为...设座于, 使就职；vi. 安装在底座上', '基础', [], [], []],
  ['second', 'n. num. adj. /\'sekәnd/', 'n. 秒, 瞬间, 第二名, 支持者, 助手；a. 第二的, 其次的, 次要的, 附加的, 辅助的；num. 第二；vt. 当...助手, 支持', '基础', [], [], []],
  ['secondary', 'adj.', '中等的，次要的', '基础', [], [], []],
  ['secret', 'n. /\'si:krit/', 'n. 秘密, 机密, 秘诀, 秘方；a. 秘密的, 极机密的, 隐蔽的, 暗中的, 神秘的, 偏僻的', '基础', [], [], []],
  ['secretary', 'n. /\'sekrәtәri/', 'n. 秘书, 书记, 大臣；[经] 秘书', '基础', [], [], []],
  ['section', 'n. /\'sekʃәn/', 'n. 区段, 部分, 区域, 节, 截面, 处, 科, 区, 扇区；vt. 把...分段, 把...切片；vi. 被切成片；[计] 扇区', '基础', [], [], []],
  ['sector', 'n.', '部门', '基础', [], [], []],
  ['secure', 'adj. /si\'kjuә/', 'a. 无虑的, 安心的, 安全的, 可靠的, 保险的；vt. 固定, 获得, 保证, 使安全, 掩护, 招致；vi. 停止操作, 船抛锚', '基础', [], [], []],
  ['security', 'n. /si\'kjuriti/', 'n. 安全, 安全性, 防护物, 保安, 可靠性, 担保人, 抵押品, 保证金；[计] 安全性, 保密性, 安全检查程序', '基础', [], [], []],
  ['see', 'vt. /si:/', 'vt. 看见, 查看, 参观, 游览, 理解, 知道, 同意；vi. 看, 观看, 注意, 知道, 考虑；n. 主教的职位', '基础', [], [], []],
  ['seed', 'n. /si:d/', 'n. 种子, 籽, 萌芽, 子孙, 精液；vt. 在...播种, 催...发育, 脱...籽；vi. 结实, 播种', '基础', [], [], []],
  ['seek', 'vt. /si:k/', 'vt. 寻求, 寻找, 探索, 追求, 搜索, 请求；vi. 寻找, 搜索；[计] 查找', '基础', [], [], []],
  ['seem', 'v. /si:m/', 'vi. 象是, 似乎', '基础', [], [], []],
  ['seize', 'vt. /si:z/', 'vt. 抓住, 逮捕, 俘获, 没收, 扣押, 掌握；vi. 突然抓住, 利用', '基础', [], [], []],
  ['seldom', 'adv. /\'seldәm/', 'a. 不常的, 稀少的；adv. 很少, 不常', '基础', [], [], []],
  ['select', 'vt. /si\'lekt/', 'a. 挑选出来的, 极好的；v. 选择, 挑选；n. 被挑选者, 精萃；[计] 选定', '基础', [], [], []],
  ['selection', 'n.', '选择，挑选，选拔', '基础', [], [], []],
  ['self', 'n. /self/', 'n. 自己, 自我, 本性, 本质, 私心, 本人；vt. 使近亲繁殖, 使自花授精；vi. 自花授精；a. 同一的', '基础', [], [], []],
  ['selfish', 'adj. /\'selfiʃ/', 'a. 自私的, 利己主义的, 自我中心的', '基础', [], [], []],
  ['sell', 'v. /sel/', 'vt. 卖, 背叛, 销售, 出卖；vi. 卖, 销售；n. 卖, 推销术, 失望', '基础', [], [], []],
  ['send', 'v. /send/', 'vt. 发送, 使进入, 寄, 派遣, 发射, 使陷于；vi. 寄信, 派人, 播送；n. (船的)上升运动；[计] 发送', '基础', [], [], []],
  ['senior', 'adj. n. /\'si:njә/', 'n. 年长者, 资深者, 毕业班学生；a. 年长的, 高级的, 资深的', '基础', [], [], []],
  ['sense', 'n. /sens/', 'n. 感应, 感觉, 感官, 意识, 观念, 情理, 知觉, 理智；vt. 感觉, 觉察, 检测；[计] 阅读; 检测', '基础', [], [], []],
  ['sensitive', 'adj. /\'sensitiv/', 'a. 敏感的, 易感的, 灵敏的, 感光的；[机] 敏感的, 灵敏的, 感度高的', '基础', [], [], []],
  ['sentence', 'n. /\'sentәns/', 'n. 句子, 命题, 宣判；vt. 宣判, 判决；[计] 句子', '基础', [], [], []],
  ['separate', 'v. adj. /\'sepәreit/', 'n. 独立件, 抽印本；a. 分开的, 各别的, 单独的, 分隔的；vi. 分开, 隔开, 分居；vt. 使分离, 使分开, 区分, 使分居', '基础', [], [], []],
  ['separately', 'adv. /\'sepәrәtli/', 'adv. [表]分开, 不相连, 分隔, 分离, 不同, 单独, 独立, 各自, 各别, 脱离肉体, 灵魂；[计] 分离地', '基础', [], [], []],
  ['separation', 'n. /.sepә\'reiʃәn/', 'n. 分离, 分居, 缺口, 退职；[化] 分离', '基础', [], [], []],
  ['series', 'n.', '一系列；一连串', '基础', [], [], []],
  ['serious', 'adj. /\'siәriәs/', 'a. 严肃的, 认真的, 重要的, 严重的；[电] 严重的', '基础', [], [], []],
  ['servant', 'n. /\'sә:vәnt/', 'n. 仆人, 有用物, 公务员, 雇员；[法] 受雇人, 服务者, 公务员', '基础', [], [], []],
  ['serve', 'vt. /sә:v/', 'vt. 可作...用, 服务, 经历, 招待, 供应, 送交, 对待；vi. 服务, 服役, 侍应, 适合, 有用, 开球；n. 发球, 轮到发球', '基础', [], [], []],
  ['service', 'n. /\'sә:vis/', 'n. 服务, 贡献, 雇佣, 公职, 服役, 功劳, 仪式, 送达, 行政部门；vt. 保养, 维修；a. 武装部队的, 服务性的, 仆人的, 耐用的；[计] 服务, 业务', '基础', [], [], []],
  ['session', 'n. /\'seʃәn/', 'n. 期间, 开庭期, 会议, 学期；[计] 会话, 对话, 会晤, 通用任务程序', '基础', [], [], []],
  ['set', 'vt. n. /set/', 'n. 日落, 同伙, 组合, 集合, 装置；vt. 放, 安置, 放置, 设定, 使凝结, 点燃, 确定, 点缀, 使就位, 树立, 分配, 调整；vi. 日落, 凝固, 定型, 搁住, 结果, 适合；a. 决心的, 规定的, 故意的, 持久的, 固定的, 老套的, 准备好的；[计] 设置; DOS内部命令:改变或显示分配给环境变量的值', '基础', [], [], []],
  ['setting', 'n.', '环境，背景；舞台布景', '基础', [], [], []],
  ['settle', 'v. /\'setl/', 'n. 有背长椅；vt. 决定, 整理, 安放, 使定居, 使平静, 支付, 安排, 解决, 结算；vi. 停留, 下陷, 沉淀, 澄清, 安下心来, 结清, 定居, 安家', '基础', [], [], []],
  ['settlement', 'n. /\'setlmәnt/', 'n. 安顿, 解决, 处理, 结算, 殖民, 殖民地, 沉降；[医] 居住区; 沉渣', '基础', [], [], []],
  ['settler', 'n. /\'setlә/', 'n. 移民者, 解决者, 结算员；[化] 沉淀池; 沉降器; 澄清槽', '基础', [], [], []],
  ['several', 'pron. adj. /\'sevәrәl/', 'a. 几个的, 一些的, 各自的；pron. 几个', '基础', [], [], []],
  ['severe', 'adj. /si\'viә/', 'a. 严格的, 尖锐的, 严肃的, 严重的, 严厉的, 朴素的；[法] 严厉的, 苛刻的, 严重的', '基础', [], [], []],
  ['sew', 'vi. /sәu/', 'vt. 缝纫, 缝合, 缝；vi. 缝纫', '基础', [], [], []],
  ['sex', 'n. /seks/', 'n. 性别, 性欲；vt. 区别...的性别, 引起...的性欲', '基础', [], [], []],
  ['shabby', 'adj. /\'ʃæbi/', 'a. 衣衫褴褛的, 低劣的, 破旧的, 吝啬的, 卑鄙的', '基础', [], [], []],
  ['shade', 'n. /ʃeid/', 'n. 荫, 阴暗, 遮光物, 灯罩, 帘, 浓淡, 微量, 底纹；vi. 渐变；vt. 使阴暗, 使渐变, 遮蔽, 微减；[计] 底纹', '基础', [], [], []],
  ['shadow', 'n. /\'ʃædәu/', 'n. 阴影, 荫, 影子, 影像, 阴暗, 幽灵, 少许, 隐蔽处, 庇护；vt. 遮蔽, 使朦胧, 预示, 尾随；vi. 渐变, 变阴暗；[计] 阴影', '基础', [], [], []],
  ['shake', 'v. /ʃeik/', 'n. 摇动, 震动；vt. 摇动, 动摇, 使震动, 挥舞；vi. 震动, 发抖, 动摇', '基础', [], [], []],
  ['shall', 'aux. /ʃæl/', '（表示将来）将要，会；……好吗', '基础', [], [], []],
  ['shallow', 'adj. /\'ʃælәu/', 'n. 水浅的地方, 浅滩；a. 浅的, 肤浅的；v. (使)变浅', '基础', [], [], []],
  ['shame', 'n. /ʃeim/', 'n. 羞耻, 羞愧, 耻辱；vt. 使羞愧, 侮辱', '基础', [], [], []],
  ['shape', 'n. v. /ʃeip/', 'n. 形状, 形态, 外形, 形式, 身材；vt. 定形, 使成形, 塑造, 计划, 使符合；vi. 成形, 形成, 成长；[计] 形状', '基础', [], [], []],
  ['share', 'vt. /ʃєә/', 'n. 部分, 参与, 一份, 参股, 份额；vt. 均分, 分担, 分享, 分配, 共有；vi. 分享；[计] 共享; DOS外部命令:在网络或多工系统中提供文件共享；文件锁定及检测磁盘更动和对超过32MB硬盘分区的支持', '基础', [], [], []],
  ['shark', 'n. /ʃɑ:k/', 'n. 鲨鱼, 骗子；v. 诈骗', '基础', [], [], []],
  ['sharp', 'adj. /ʃɑ:p/', 'n. 半升音调, 利刃, 骗子；a. 锋利的, 明显的, 敏锐的, 急剧的, 尖刻的, 严厉的, 刺耳的, 精明的；adv. 锐利地, 急速地', '基础', [], [], []],
  ['sharpen', 'v. /\'ʃɑ:pn/', 'vt. 使尖锐, 使敏捷, 加重, 削尖；vi. 尖锐化, 变锋利', '基础', [], [], []],
  ['shave', 'v. /ʃeiv/', 'n. 修面, 刮胡子, 幸免, 剃刀；vt. 修面, 剃, 修剪, 掠过；vi. 刮脸, 勉强通过', '基础', [], [], []],
  ['shaver', 'n. /\'ʃeivә/', 'n. 修面的人, 电动剃刀, 刨刀, 杀价买进期票的人, 善于讨价还价的人', '基础', [], [], []],
  ['she', 'pron. /ʃi:/', 'pron. 她', '基础', [], [], []],
  ['sheep', 'n. /ʃi:p/', 'n. 羊, 胆小者', '基础', [], [], []],
  ['sheet', 'n. /ʃi:t/', 'n. 床单, 张, 纸张, 印刷品, 裹尸布, 薄片；vt. 盖上被单, 遍布；vi. 大片落下；a. 片状的, 成薄片的；[计] 工作表', '基础', [], [], []],
  ['shelf', 'n. /ʃelf/', 'n. 架子, 搁板；[化] 架子', '基础', [], [], []],
  ['shelter', 'n. /\'ʃeltә/', 'n. 庇护所, 避难所, 庇护, 隐蔽处, 掩蔽；vt. 庇护, 保护, 隐匿；vi. 躲避', '基础', [], [], []],
  ['shift', 'n. & v.', '转移，转变，更换；（工作的）轮班', '基础', [], [], []],
  ['shine', 'v. /ʃain/', 'n. 光泽, 阳光；vt. 使发光；vi. 照耀, 发光, 发亮', '基础', [], [], []],
  ['ship', 'n. vi. /ʃip/', 'n. 船, 舰；vt. 以船运送, 装船, 运送；vi. 上船, 乘船', '基础', [], [], []],
  ['shirt', 'n. /ʃә:t/', 'n. 衬衫, 内衣, 汗衫', '基础', [], [], []],
  ['shock', 'vt. /ʃɒk/', 'n. 震动, 冲突, 震惊, 冲击, 突击, 禾束堆, 休克, 长毛狗；vt. 使震动, 使休克, 使受电击, 震惊得；vi. 震动, 吓人；a. 蓬乱浓密的', '基础', [], [], []],
  ['shoe', 'n. /ʃu:/', 'n. 鞋, 靴, 外胎；vt. 给...穿鞋, 为马钉蹄铁', '基础', [], [], []],
  ['shoot', 'v. n. /ʃu:t/', 'n. 射击, 狩猎, 芽, 射伤, 发射, 发芽, 急流, 推力, 摄影, 急送, 滑运道, 浪费；vt. 射击, 射中, 损毁, 拍摄, 喷出, 投射, 挥出, 飞速行进, 挥霍, 给...注射；vi. 射出, 射击, 发出, 拍电影, 射门, 发芽', '基础', [], [], []],
  ['shop', 'vi. n. /ʃɒp/', 'n. 商店, 工厂, 车间；vi. 购物, 到处寻找；vt. 选购', '基础', [], [], []],
  ['shopkeeper', 'n. /\'ʃɒp.ki:pә/', 'n. 零售商, 店主, 老板', '基础', [], [], []],
  ['shopping', 'n. /\'ʃɒpiŋ/', 'n. 买东西, 购物；[经] 购物, 买东西', '基础', [], [], []],
  ['shore', 'n. /ʃɒ:/', 'n. 海岸, 海滨, 斜撑柱；vt. 把...送上岸, 支撑, 支持', '基础', [], [], []],
  ['short', 'adj. /ʃɒ:t/', 'a. 短的, 近的, 矮的, 短期的, 简短的, 少量的；adv. 简短地, 突然；n. 扼要, 短片, 缺乏；vt. 故意少给, 使短路', '基础', [], [], []],
  ['shortcoming', 'n. /\'ʃɒ:t\'kʌmiŋ/', 'n. 缺点, 短处', '基础', [], [], []],
  ['shortly', 'adv. /\'ʃɒ:tli/', 'adv. 不久, 简短, 唐突地', '基础', [], [], []],
  ['shorts', 'n. /ʃɔ:ts/', 'n. 短裤, (美)男人的短衬裤；[经] 空头户, 空头, 短期债券', '基础', [], [], []],
  ['shot', 'n. /ʃɒt/', 'n. 发射, 炮弹, 射击, 射手, 投篮, 射门, 子弹, 射程, 拍摄, 注射；vt. 装弹, 使成颗粒状；a. 杂色的, 交织着的, 渗透的, 点焊的, 破旧的；shoot的过去式和过去分词', '基础', [], [], []],
  ['should', 'aux. /ʃud/', '应当，应该；可能；竟然（shall 的过去式）', '基础', [], [], []],
  ['shoulder', 'n. /\'ʃәuldә/', 'n. 肩, 肩膀, 衣肩；vt. 肩负, 负担, 担任；vi. 用肩推挤', '基础', [], [], []],
  ['shout', 'n. & v. /ʃaut/', 'n. 呼喊, 喊声；vi. 呼喊, 喊叫, 嚷；vt. 高喊', '基础', [], [], []],
  ['show', 'n. v. /ʃәu/', 'n. 显示, 表现, 展览, 卖弄, 炫耀, 外观, 演出, 洋相；vt. 表示, 显示, 展现, 陈列, 演出, 表明, 指出, 带领；vi. 露面, 显现, 演出；[计] 显示', '基础', [], [], []],
  ['shower', 'n. /\'ʃauә/', 'n. 阵雨, 淋浴, 一阵, 展出者, 显示者；vi. 淋浴, 下阵雨；vt. 淋湿, 倾注', '基础', [], [], []],
  ['shrink', 'v. /ʃriŋk/', 'n. 收缩, 萎缩, 回避；vi. 收缩, 退缩, 萎缩, 缩小, 回避；vt. 使收缩, 使缩小', '基础', [], [], []],
  ['shut', 'v. & n. /ʃʌʃ/', 'n. 关闭；vt. 关上, 闭起, 幽禁, 合拢, 轧住；vi. 关上, 停止营业', '基础', [], [], []],
  ['shuttle', 'n. v. /\'ʃʌtl/', 'n. 穿梭, 梭子, 往返移动之物；v. (使)穿梭移动, 往返运送', '基础', [], [], []],
  ['shy', 'adj.', '害羞的', '基础', [], [], []],
  ['sick', 'adj. /sik/', 'n. 病人；a. 不舒服, 有病的, 恶心的, 厌恶的, 渴望的, 病态的；vt. 呕吐, 追击, 使(狗)去攻击', '基础', [], [], []],
  ['sickness', 'n. /\'siknis/', 'n. 疾病, 不健康, 呕吐；[医] 病', '基础', [], [], []],
  ['side', 'n. /said/', 'n. 旁边, 侧, 方面, 胁, 侧边, 血统；a. 旁的, 侧的, 次要的；vt. 同意, 支持；vi. 支持, 赞助', '基础', [], [], []],
  ['sidewalk', 'n.', '人行道', '基础', [], [], []],
  ['sigh', 'vi. /sai/', 'n. 叹息；vi. 叹息, 渴望；vt. 叹息着说', '基础', [], [], []],
  ['sight', 'n. /sait/', 'n. 景观, 视力, 眼界, 阅读, 见解, 意见；vt. 看见, 瞄准；vi. 瞄准, 观看；a. 即席的, 见票即付的', '基础', [], [], []],
  ['sightseeing', 'n. /\'saitsi:iŋ/', 'n. 观光, 游览；a. 观光的, 游览的', '基础', [], [], []],
  ['sign', 'n. v. /sain/', 'n. 符号, 招牌, 征兆, 正负号, 手势；vt. 签名, 打手势表达；vi. 签名；[计] 正负号; 符号; 符号字符', '基础', [], [], []],
  ['signal', 'n. v. /\'signl/', 'n. 信号, 暗号, 近因, 导火线；vt. 向...作信号, 标志, 用信号通知；vi. 发信号；a. 作为信号的, 显著的；[计] 信号', '基础', [], [], []],
  ['significance', 'n. /sig\'nifikәns/', 'n. 重要性, 意义, 意味；[计] 有效; 有效性', '基础', [], [], []],
  ['significant', 'adj.', '重要的', '基础', [], [], []],
  ['silence', 'n. /\'sailәns/', 'n. 沉默, 无声, 静寂, 湮没, 无声息；vt. 使缄默；interj. 安静', '基础', [], [], []],
  ['silent', 'adj. /\'sailәnt/', 'a. 沉默的, 安静的, 无声的, 静止的；[医] 静止的, 无症状的', '基础', [], [], []],
  ['silk', 'n. /silk/', 'n. 丝, 绸, 绸锻类, 丝织品；a. 丝的, 丝织的', '基础', [], [], []],
  ['silly', 'adj. /\'sili/', 'a. 愚蠢的, 糊涂的', '基础', [], [], []],
  ['silver', 'n. /\'silvә/', 'n. 银, 银币, 银器；a. 银的, 银制的, 银器的；vt. 镀银；vi. 变银白色', '基础', [], [], []],
  ['similar', 'adj. /\'similә/', 'a. 相似的, 类似的；n. 相似的东西', '基础', [], [], []],
  ['similarity', 'n.', '相似', '基础', [], [], []],
  ['simple', 'adj. /\'simpl/', 'a. 简单的, 普通的, 朴素的, 单纯的, 绝对的, 初级的, 原始的, 迟钝的；n. 出身低微者, 傻子', '基础', [], [], []],
  ['simplify', 'v. /\'simplifai/', 'vt. 单一化, 简单化', '基础', [], [], []],
  ['simply', 'adv. /\'simpli/', 'adv. 简单地, 只是, 简直, 简朴地, 坦白地', '基础', [], [], []],
  ['sin', 'n. vi.', '罪，罪孽 犯罪', '基础', [], [], []],
  ['since', 'adv. conj. prep. /sins/', 'prep. 自...以后, 自...以来；adv. 自那时以后；conj. 既然, 自...以后, 自...以来', '基础', [], [], []],
  ['sincerely', 'adv. /sin\'siәli/', 'adv. 真诚地', '基础', [], [], []],
  ['sing', 'v. /siŋ/', 'vi. 唱, 唱歌, 演唱, 鸣, 啼；vt. 唱, 歌颂；n. 嗖嗖声', '基础', [], [], []],
  ['single', 'adj. /\'siŋgl/', 'a. 单身的, 单程的, 单一的, 个别的, 孤独的, 专一的；n. 一个, 单打, 单程票；vt. 选出；vi. 击出一垒打；[计] 单精度型', '基础', [], [], []],
  ['sink', 'n. vi. /siŋk/', 'n. 藏垢的场所, 沟渠, 污水槽；vi. 下沉, 沉没, 下陷, 减弱, 衰退, 消沉, 堕落, 渗透；vt. 使低落, 使下沉, 陷于, 投入(资金等), 挖掘', '基础', [], [], []],
  ['sir', 'n. /sә:/', 'n. 先生, 阁下', '基础', [], [], []],
  ['sister', 'n. /\'sistә/', 'n. 姐妹, 姐, 妹, 护士, 修女；vt. 姐妹般对待', '基础', [], [], []],
  ['sit', 'vi. /sit/', 'vi. 坐, 就座, 坐落；vt. 使就座, 骑；n. 坐, 衣服合身', '基础', [], [], []],
  ['situation', 'n. /.sitju\'eiʃәn/', 'n. 情形, 境遇, 位置；[医] 情境, 处境', '基础', [], [], []],
  ['size', 'n. /saiz/', 'n. 大小, 尺寸, 规模, 尺码, 能力, 浆料；vt. 上浆, 依大小排列；vi. 可比拟；a. 一定大小的, 一定尺寸的', '基础', [], [], []],
  ['skate', 'vi. /skeit/', 'n. 溜冰, 冰鞋；vi. 滑冰, 滑过', '基础', [], [], []],
  ['ski', 'n. vi. /ski:/', 'n. 滑雪橇；vi. 滑雪', '基础', [], [], []],
  ['skill', 'n. /\'skil/', 'n. 技术, 技巧, 技能, 熟练, 熟练工人；[化] 技能', '基础', [], [], []],
  ['skillful', 'adj. /\'skilful/', 'a. 熟练的, 巧妙的；[机] 熟练的', '基础', [], [], []],
  ['skin', 'n. /skin/', 'n. 皮肤, 皮；vt. 剥皮, 在...植皮；vi. 长皮, 愈合, 蜕皮', '基础', [], [], []],
  ['skip', 'v. /skip/', 'n. 跳跃, 跳读；vi. 跳越, 跳读, 跳绳, 遗漏, 跳级；vt. 跳过, 遗漏；[计] 跳过', '基础', [], [], []],
  ['skirt', 'n. /skә:t/', 'n. 裙子, 下摆, 边缘, 郊区；vt. 位于...边缘, 绕过, 回避；vi. 位于边缘', '基础', [], [], []],
  ['sky', 'n. /skai/', 'n. 天空, 天色, 天堂；vt. 击向空中, 挂在高处；vi. 高涨', '基础', [], [], []],
  ['skyscraper', 'n. /\'skaiskreipә/', 'n. 摩天楼, 三角形天帆', '基础', [], [], []],
  ['slap', 'n. & v.', '拍打，掌击', '基础', [], [], []],
  ['slave', 'n. /sleiv/', 'n. 奴隶, 从动装置, 卑鄙的人；vi. 拼命工作；[计] 从设备', '基础', [], [], []],
  ['slavery', 'n. /\'sleivәri/', 'n. 奴隶的身分, 奴隶状态, 奴隶制度；[法] 奴隶制度, 奴役, 苦役', '基础', [], [], []],
  ['sleep', 'n. & vi. /sli:p/', 'n. 睡眠, 静止, 昏迷, 麻木, 长眠, 冬眠；vi. 睡觉, 睡眠, 静止；vt. 睡', '基础', [], [], []],
  ['sleepy', 'adj. /\'sli:pi/', '想睡的，困倦的，瞌睡的', '基础', [], [], []],
  ['sleeve', 'n. /sli:v/', 'n. 袖子, 套管；vt. 缝上袖子', '基础', [], [], []],
  ['slice', 'n. /slais/', 'n. 薄的切片, 一部分, 菜刀；vt. 切成薄片, 切下；vi. 切；[计] 片', '基础', [], [], []],
  ['slide', 'n. v. /slaid/', 'n. 滑, 滑道, 山崩, 雪崩, 幻灯片；vt. 使滑动, 偷偷放入；vi. 滑动, 滑落, 不知不觉陷入, 偷偷地走', '基础', [], [], []],
  ['slight', 'adj. /slait/', 'n. 轻蔑, 怠慢；a. 轻微的, 纤细的, 脆弱的, 苗条的；vt. 轻视, 忽略, 怠慢', '基础', [], [], []],
  ['slim', 'adj. /slim/', 'a. 瘦的, 苗条的, 微小的, 稀少的, 微薄的；vi. 变苗条；vt. 使苗条', '基础', [], [], []],
  ['slip', 'vi. n. /slip/', 'n. 滑, 滑行, 事故, 溜, 差错, 滑台, 下降, 插条, 后裔, 板条, 瘦长的年轻人；vi. 滑动, 滑倒, 失足, 溜走, 滑落, 犯错, 变坏；vt. 使滑动, 滑过, 摆脱, 闪开, 塞入, 从...取接枝；a. 滑动的, 滑移的, 活络的, 有活结的；[计] 串行线接口协议', '基础', [], [], []],
  ['slow', 'adj. adv. /slәu/', 'a. 慢的, 缓慢的, 迟缓的, 迟钝的, 冷漠的, 落后的；adv. 慢地, 迟缓地；v. (使)慢下来', '基础', [], [], []],
  ['small', 'adj. /smɒ:l/', 'a. 小的, 少的, 小型的, 低微的, 小气的, 细微的；adv. 些微地；n. 狭小部分', '基础', [], [], []],
  ['smart', 'adj. /smɑ:t/', 'a. 聪明的, 漂亮的, 刺痛的, 剧烈的, 敏捷的, 巧妙的, 伶俐的, 潇洒的；n. 刺痛, 痛苦；vi. 刺痛', '基础', [], [], []],
  ['smell', 'v. n. /smel/', 'n. 味道, 气味, 嗅觉, 嗅, 臭味, 气息；vt. 闻, 探出, 察觉, 发出...的气味；vi. 嗅, 散发气味, 发臭', '基础', [], [], []],
  ['smile', 'n. & v. /smail/', 'n. 微笑, 喜色, 笑容；vi. 微笑, 觉得好笑；vt. 微笑着表示', '基础', [], [], []],
  ['smog', 'n. /smәug/', '烟雾（smoke ＋ fog）', '基础', [], [], []],
  ['smoke', 'n. v. /smәuk/', 'n. 烟, 雾气, 烟熏剂, 抽烟, 烟色；vi. 吸烟, 冒烟, 弥漫；vt. 以烟熏, 抽烟而导致...', '基础', [], [], []],
  ['smoker', 'n. /\'smәukә/', 'n. 吸烟者, 吸烟的人, 吸烟车厢, (美)(非正式)蒸汽火车头', '基础', [], [], []],
  ['smooth', 'adj. /smu:ð/', 'a. 平滑的, 平稳的, 流畅的, 和蔼的, 安祥的, 圆滑的, 调匀的, 无毛的；vt. 使光滑, 烫平, 使平和, 消除；vi. 变平滑, 变平静；n. 一块平地, 平滑部分', '基础', [], [], []],
  ['snake', 'n. v. /sneik/', 'n. 蛇, 阴险的人；vi. 曲折行进；vt. 迂回, 拉, 急抽', '基础', [], [], []],
  ['snap', 'v.', '发出劈啪声；猛地折断；猛咬', '基础', [], [], []],
  ['sneaker', 'n. /\'sni:kә/', 'n. 鬼鬼祟祟做事的人, 卑鄙者, 帆布胶底运动鞋', '基础', [], [], []],
  ['sneeze', 'v. /sni:z/', 'n. 喷嚏；vi. 打喷嚏', '基础', [], [], []],
  ['sniff', 'v. /snif/', 'n. 以鼻吸气, 嗅, 气息；vi. 嗅, 蔑视, 嗤之以鼻；vt. 闻, 用力吸, 发觉', '基础', [], [], []],
  ['snow', 'n. vi. /snәu/', 'n. 雪, 积雪, 下雪, 雪花形干扰；vi. 下雪, 似雪般落下；vt. 使雪白, 用雪覆盖, 使像雪般落下', '基础', [], [], []],
  ['snowball', 'n. /\'snәubɒ:l/', 'n. 雪球, 果味冰霜卷, 滚雪球式的募捐法；vt. 向...丢雪球, 使滚雪球般增长；vi. 打雪仗, 滚雪球般增长', '基础', [], [], []],
  ['snowman', 'n. /\'snәumæn/', 'n. 雪人', '基础', [], [], []],
  ['snowy', 'adj. /\'snәui/', 'a. 多雪的, 雪的, 被雪所覆盖着的, 下雪的', '基础', [], [], []],
  ['so', 'adv. conj. /sәu/', 'adv. 如此, 如是, 如...那样；conj. 所以, 因此；pron. 这样', '基础', [], [], []],
  ['soap', 'n. /sәup/', 'n. 肥皂, 阿谀；vt. 以肥皂洗, 阿谀；[计] 评语', '基础', [], [], []],
  ['sob', 'n. & v. /sɒb/', 'vi. 啜泣, 呜咽；vt. 哭诉, 哭得使；n. 啜泣, 呜咽', '基础', [], [], []],
  ['soccer', 'n. /\'sɒkә/', 'n. 英式足球', '基础', [], [], []],
  ['social', 'adj. /\'sәuʃәl/', 'a. 社会的, 群居的, 社交的；n. 联欢会', '基础', [], [], []],
  ['socialism', 'n. /\'sәuʃәlizm/', 'n. 社会主义, 社会主义运动', '基础', [], [], []],
  ['socialist', 'adj. n. /\'sәuʃәlist/', 'n. 社会主义者, 社会党党员；[法] 社会主义的', '基础', [], [], []],
  ['society', 'n. /sә\'saiәti/', 'n. 社会；社交界；交往；社团', '基础', [], [], []],
  ['sock', 'n. /sɒk/', 'n. 短袜, 鞋垫, 一击；vt. 重击, 猛投, 给...穿袜；vi. 打击；adv. 正着地, 不偏不倚地；a. 非常成功的', '基础', [], [], []],
  ['socket', 'n. /\'sɒkit/', 'n. 窝, 穴, 插座, 眼窝；vt. 插进插座；[计] 套接字', '基础', [], [], []],
  ['sofa', 'n. /\'sәufә/', '（长）沙发', '基础', [], [], []],
  ['soft', 'adj. /sɒft/', 'a. 软的, 温和的, 柔和的, 柔滑的, 温柔的, 软弱的, 坡度小的, 笨的, 纸币的；n. 柔软的东西, 笨人, 纸币；adv. 柔软地, 温和地', '基础', [], [], []],
  ['software', 'n. /\'sɒftwєә/', 'n. 软件；[计] 软设备', '基础', [], [], []],
  ['soil', 'n. /sɒil/', 'n. 土壤, 土地, 国家, 国土, 温床, 污物, 粪便, 水池；vt. 弄脏, 污辱；vi. 变脏', '基础', [], [], []],
  ['solar', 'adj. /\'sәulә/', 'a. 太阳的, 日光的, 源自太阳的；[医] 太阳的; 腹腔丛的', '基础', [], [], []],
  ['soldier', 'n. /\'sәuldʒә/', 'n. 军人, 士兵, 兵蚁；vi. 从军, 尽职, 偷懒, 磨洋工', '基础', [], [], []],
  ['solid', 'adj. n. /\'sɒlid/', 'n. 固体；a. 坚硬的, 稳固的, 固体的, 实心的, 纯质的, 立体的, 立方的；[计] 原色', '基础', [], [], []],
  ['solution', 'n.', '解答；解决（办法）', '基础', [], [], []],
  ['solve', 'vt.', '解决', '基础', [], [], []],
  ['some', 'adj. pron. /sʌm/', 'pron. 一些, 一部分, 若干；adv. 大约；a. 一些的, 少许的, 某一的', '基础', [], [], []],
  ['somebody', 'pron. /\'sʌmbɒdi/', 'n. 了不起的人, 大人物；pron. 有人, 某人', '基础', [], [], []],
  ['somehow', 'adv.', '以某种方法，设法', '基础', [], [], []],
  ['someone', 'pron. /\'sʌmwʌn/', 'pron. 有人, 某人', '基础', [], [], []],
  ['something', 'pron. /\'sʌmθiŋ/', 'pron. 某事, 某物', '基础', [], [], []],
  ['sometimes', 'adv. /\'sʌmtaimz/', 'adv. 有时, 时常, 往往', '基础', [], [], []],
  ['somewhat', 'adv.', '稍许，有几分', '基础', [], [], []],
  ['somewhere', 'adv. /\'sʌmhwєә/', 'adv. 到某处, 在某处', '基础', [], [], []],
  ['son', 'n. /sʌn/', 'n. 儿子, 女婿, 子孙；[法] 儿子, 女婿, 养子', '基础', [], [], []],
  ['song', 'n. /sɒŋ/', 'n. 歌, 曲, 鸣声, 歌唱, 歌曲, 诗歌', '基础', [], [], []],
  ['soon', 'adv. /su:n/', 'adv. 不久, 早, 快, 宁可', '基础', [], [], []],
  ['sore', 'adj.', '疼痛的，酸痛的', '基础', [], [], []],
  ['sorrow', 'n. /\'sɒrәu/', 'n. 悲伤, 哀惜, 不幸；vi. 悲伤, 懊悔, 遗憾', '基础', [], [], []],
  ['sorry', 'adj. /\'sɒri/', 'a. 难过的, 悲哀的, 遗憾的', '基础', [], [], []],
  ['sort', 'vt. n. /sɒ:t/', 'n. 种类, 方式, 品质, 态度, 举止；vt. 分类, 排序, 挑选；vi. 交往, 协调；[计] 排序; DOS外部命令:从标准输入设备接收数据, 整个数据输入完后；对它以行为单位进行排序, 然后在标准输出设备上输出', '基础', [], [], []],
  ['soul', 'n. /sәul/', 'n. 灵魂, 心灵, 精神, 精髓, 人, 化身, 典型, 鬼魂；a. 黑人的', '基础', [], [], []],
  ['sound', 'vi. n. /saund/', 'n. 声音, 语音, 吵闹, 声调, 听力范围, 探条, 海峡；a. 健全的, 可靠的, 合理的, 健康的, 彻底的, 资金充实的；adv. 彻底地, 充分地；vi. 发出声音, 回响, 测深, 试探, 听起来；vt. 使发声, 宣告, 听诊, 测...深, 试探；[计] 声音', '基础', [], [], []],
  ['soup', 'n. /su:p/', 'n. 汤, 马力；vt. 加速, 增加马力', '基础', [], [], []],
  ['sour', 'adj. /\'sauә/', 'a. 酸的, 酸臭的, 发酵的, 愠怒的, 讨厌的, 拙劣的, 不健全的；vi. 变酸, 发酵, 厌烦, 变坏；vt. 使变酸, 使失望；n. 酸味, 酸饮料', '基础', [], [], []],
  ['source', 'n.', '来源，水源', '基础', [], [], []],
  ['south', 'adj. adv. n. /sauθ/', '南（方）的；向南的；从南来的 在南方；向南方；自南方 南；南方；南风；南部', '基础', [], [], []],
  ['southeast', 'n. /sauθ\'i:st/', 'n. 东南, 东南地区；a. 东南的, 向东南的, 来自东南的；adv. 往东南, 来自东南', '基础', [], [], []],
  ['southern', 'adj. /\'sʌðәn/', 'n. 南方人, 男风；a. 向南方的, 来自南方的', '基础', [], [], []],
  ['southwest', 'n. /sauθ\'west/', 'n. 西南, 西南方, 西南地区；a. 西南的, 来自西南方的；adv. 往西南, 来自西南', '基础', [], [], []],
  ['souvenir', 'n.', '旅游纪念品，纪念物', '基础', [], [], []],
  ['sow', 'v. /sau. sәu/', 'n. 母猪, 懒胖女人；vt. 播种, 散布, 使密布；vi. 播种', '基础', [], [], []],
  ['space', 'n. /speis/', 'n. 位置, 空间, 距离, 太空, 空白, 间隔, (期刊等的)篇幅；vt. 隔开, 分隔；vi. 留间隔；[计] 空白, 空格校验', '基础', [], [], []],
  ['spaceship', 'n. /\'speisʃip/', 'n. 宇宙飞船', '基础', [], [], []],
  ['spade', 'n. /speid/', 'n. 铲子, 锄, 铲刀, 黑桃；vt. 以锄掘, 把...弄实抹平；vi. 铲', '基础', [], [], []],
  ['spare', 'adj. vt. /spєә/', 'n. 剩余, 备用品, 备件, 备用零件, 备用轮胎；a. 多余的, 备用的, 空闲的, 节约的, 瘦的；vi. 节约, 省掉, 宽恕；vt. 节约, 省用, 剩下, 饶恕, 赦免', '基础', [], [], []],
  ['speak', 'v. /spi:k/', 'vi. 说, 说话, 演说, 发言；vt. 说, 讲, 说出', '基础', [], [], []],
  ['speaker', 'n. /\'spi:kә/', 'n. 说话人, 讲演者, 发言人, 喇叭, 扬声器；[计] 扬声器', '基础', [], [], []],
  ['special', 'adj. /\'speʃәl/', 'n. 专辑, 专车, 号外, 特别的东西, 负有特别任务的人员；a. 特别的, 专门的, 特殊的, 额外的, 附加的, 特别亲密的', '基础', [], [], []],
  ['specialist', 'n. /\'speiʃәlist/', 'n. 专门医师, 专家；a. 专业的, 专家的', '基础', [], [], []],
  ['specific', 'adj. /spi\'sifik/', 'n. 特效药, 特性；a. 特殊的, 明确的, 具有特效的, 特定地, 具体地', '基础', [], [], []],
  ['speech', 'n. /spi:tʃ/', 'n. 演讲, 说话, 谈话, 言语, 引语, 民族语言；[医] 言语, 语言', '基础', [], [], []],
  ['speed', 'n. v. /spi:d/', 'n. 速率, 速度, 迅速；vi. 加速, 超速, 快进；vt. 快速传送, 促进, 使加速；[计] 中央处理机速度设置程序', '基础', [], [], []],
  ['spell', 'vt. /spel/', 'n. 符咒, 魅力, 轮值, 轮班, 工作时间, 一次发作；vt. 拼写, 拼成, 琢磨, 理解, 招致, 轮换, 迷住；vi. 轮换, 拼字', '基础', [], [], []],
  ['spelling', 'n. /\'speliŋ/', 'n. 拼, 拼字, 拼法；[计] 拼写检查', '基础', [], [], []],
  ['spend', 'v. /spend/', 'vt. 花费, 浪费, 度过, 消耗, 消磨；vi. 花费, 用尽', '基础', [], [], []],
  ['spin', 'v. & n. /spin/', 'n. 旋转, 自旋, 疾驰, 情绪低落；vt. 纺织, 纺, 使旋转, 编造；vi. 纺纱, 吐丝, 作茧, 结网, 旋转, 自旋, 疾驰', '基础', [], [], []],
  ['spirit', 'n. /\'spirit/', 'n. 精神, 心灵, 灵魂, 态度, 志气, 人格, 情绪, 心情, 烈酒；vt. 诱拐, 鼓励, 鼓舞', '基础', [], [], []],
  ['spiritual', 'adj. /\'spiritʃuәl/', 'a. 精神上的, 神圣的, 崇高的, 高尚的, 鬼的, 招魂术的；n. 有关教会的事', '基础', [], [], []],
  ['spit', 'v. /spit/', 'n. 唾液, 唾吐, 小雨, 炙叉, 一铲的深度；vt. 唾吐, 吐出, 降小雨, 用炙叉穿过；vi. 吐唾沫, 吐痰, 唾弃, 飘霏霏细雨', '基础', [], [], []],
  ['splendid', 'adj. /\'spendid/', 'a. 光亮的, 了不起的, 灿烂的, 壮丽的, 显著的, 杰出的', '基础', [], [], []],
  ['split', 'v. & n. /split/', 'n. 劈开, 裂片, 裂缝, 分裂, 派系, 派别, 柳条；a. 劈开的；vi. 分离, 分开, 裂开, 被劈开；vt. 劈开, 切开, 使分裂, 使分离；[计] 拆分', '基础', [], [], []],
  ['spoken', 'adj. /\'spәukәn/', 'a. 口头讲的, 口语的；speak的过去分词', '基础', [], [], []],
  ['sponsor', 'n. /\'spɒnsә/', 'n. 保证人, 赞助者, 发起者, 倡议者, 教父；vt. 发起, 赞助, 倡议', '基础', [], [], []],
  ['spoon', 'n. /spu:n/', 'n. 匙, 调羹, 匙形工具；vt. 以匙舀起, 调情, 使成匙状', '基础', [], [], []],
  ['spoonful', 'n. /\'spu:nful/', 'n. 一匙；[医] 一匙, 匙', '基础', [], [], []],
  ['sport', 'n. /spɒ:t/', 'n. 运动, 游戏, 娱乐, 消遣, 玩笑；a. 运动的, 户外穿戴的；vi. 游戏, 参加体育运动, 戏弄, 产生变种；vt. 炫耀, 使产生变种', '基础', [], [], []],
  ['spot', 'n. v. /spɒt/', 'n. 污点, 地点, 斑点, 点, 娱乐场所, 处境, 少量；a. 当场的, 现场的, 现货买卖的, 现金交易的, 抽样的；vt. 点缀, 玷污, 认出, 准确定...的位, 用灯光照射；vi. 玷污, (从空中)侦察敌方目标', '基础', [], [], []],
  ['spray', 'n. & v. /sprei/', 'n. 水沫, 浪花, 水花, 喷雾, 喷雾器, 小树枝；vt. 喷雾, 扫射, 喷射；vi. 喷, 溅开', '基础', [], [], []],
  ['spread', 'v. /spred/', 'n. 传播, 散布, 伸展；a. 双唇展开的, 伸展的；vt. 展开, 铺开, 传播, 推广, 伸出, 涂, 敷, 延伸；vi. 展开, 扩大, 传开, 延伸；[计] 展开', '基础', [], [], []],
  ['spring', 'n. /spriŋ/', 'n. 春天, 弹簧, 跳跃, 弹性, 活力, 泉, 源泉；a. 春天的；vi. 跳, 弹跳, 涌出, 生长, 裂开, 高耸；vt. 使跳起, 使爆炸, 突然提出', '基础', [], [], []],
  ['spy', 'n. v. /spai/', 'n. 间谍, 侦探, 侦察；vt. 侦察, 找出, 发现；vi. 做密探, 侦查', '基础', [], [], []],
  ['square', 'n. adj. /skwєә/', 'n. 正方形, 街区, 广场, 平方, 直角尺；a. 正方形的, 正直的, 公正的, 平方的, 方正的, 结清的；adv. 成直角地, 对准地；vi. 一致, 符合, 结清；vt. 使成方形, 使平方自乘, 调正, 结清, 使一致', '基础', [], [], []],
  ['squeeze', 'n. /skwi:z/', 'n. 紧握, 挤, 榨, 榨取, 佣金；vt. 紧握, 挤, 榨取；vi. 压榨, 榨', '基础', [], [], []],
  ['stable', 'adj. /\'steibl/', 'n. 马房, 牛棚；a. 稳定的, 安定的, 坚固的, 坚定的；vt. 赶入马房；vi. 被关在马厩', '基础', [], [], []],
  ['stadium', 'n. /\'steidiәm/', 'n. 露天大型运动场；[医] 期, 病期', '基础', [], [], []],
  ['staff', 'n. /stɑ:f/', 'n. 全体人员, 工作班子, 棍棒, 杆, 拐杖, 支柱, 权杖；a. 职员的, 雇员的, 参谋的；vt. 为...配备人员', '基础', [], [], []],
  ['stage', 'n. /steidʒ/', 'n. 阶段, 舞台, 场所, 戏剧, 站, 驿站, 级, 层, 脚手架；vt. 上演, 表演, 筹划；vi. 适于上演, 乘驿车旅行', '基础', [], [], []],
  ['stain', 'n. v. /stein/', 'n. 污染, 污点, 着色剂；vt. 沾染, 染污, 着色；vi. 变脏', '基础', [], [], []],
  ['stair', 'n. /stєә/', 'n. 梯级, 楼梯, 阶梯', '基础', [], [], []],
  ['stamp', 'n. v. /stæmp/', 'n. 印, 邮票, 打印器, 戳子, 图章, 印花税票, 标志, 特征, 类型, 跺脚；vt. 盖章于, 顿足, 贴上邮票, 铭刻, 捣碎, 扑灭；vi. 捣碎, 跺脚', '基础', [], [], []],
  ['stand', 'n. v. /stænd/', 'n. 站立, 站住, 停顿, 讲台, 看台, 立场, 法院证人席；vi. 站, 立, 坐落, 停滞, 位于, 坚持, 维持原状；vt. 忍受, 使站立, 抵挡', '基础', [], [], []],
  ['standard', 'n. adj. /\'stændәd/', 'n. 标准, 规格, 旗, 军旗, 本位；a. 标准的, 合规格的；[计] 标准', '基础', [], [], []],
  ['star', 'n. /stɑ:/', 'n. 星, 恒星, 星形物, 运气, 明星；vt. 以星状物装饰, 用星号标, 使成为明星；vi. 变成明星', '基础', [], [], []],
  ['stare', 'vi. /stєә/', 'vi. 注视, 凝视, 瞪视, 显眼；vt. 盯；n. 凝视', '基础', [], [], []],
  ['start', 'v. /stɑ:t/', 'n. 惊起, 出发, 开端, 起点, 吃惊, 有利条件；vi. 开始, 出发, 启动, 跳起, 吃惊, 出现, 松动, 脱落, 起价, 参赛；vt. 使惊起, 开动, 发动, 启动, 开始, 创办, 提议, 使松动, 使脱落, 起用；[计] 起始', '基础', [], [], []],
  ['starvation', 'n. /stɑ:\'veiʃәn/', 'n. 饥饿, 饿死；[医] 绝食, 饥锇(指长时期的)', '基础', [], [], []],
  ['starve', 'v. /stɑ:v/', 'v. (使)饿死, (使)挨饿', '基础', [], [], []],
  ['state', 'n. /steit/', 'n. 州, 状态, 情形, 国家, 政府, 领土, 国务, 社会地位；a. 国家的, 正式的, 礼仪用的, 州的；vt. 说明, 陈述, 规定；[计] 状态', '基础', [], [], []],
  ['statement', 'n. /\'steitmәnt/', 'n. 陈述, 指令, 声明；[计] 程序语句; 语句', '基础', [], [], []],
  ['station', 'n. /\'steiʃәn/', 'n. 车站, 站, 局, 驻地, 位置, 身分, 地位；vt. 安置, 配置, 驻扎；[计] 站', '基础', [], [], []],
  ['statistics', 'n. /stә\'tistiks/', 'n. 统计学, 统计资料；[计] 统计信息', '基础', [], [], []],
  ['statue', 'n. /\'stætju/', 'vt. 以雕像装饰；n. 雕像', '基础', [], [], []],
  ['status', 'n. /\'steitәs/', 'n. 状态, 情形, 地位, 要人身份；[计] 状态', '基础', [], [], []],
  ['stay', 'n. & vi. /stei/', 'n. 停留, 逗留, 制止, 延缓, 停止, 支柱, 支撑物, 支索；vt. 制止, 延缓, 坚持, 支持, 支撑, 用支索固定；vi. 停留, 逗留, 暂停, 坚持, 中止', '基础', [], [], []],
  ['steady', 'adj. /\'stedi/', 'a. 稳定的, 不动摇的, 沉着的, 稳固的, 坚定的, 经常的；vt. 使稳定, 使坚定；vi. 变为沉着, 稳固', '基础', [], [], []],
  ['steak', 'n. /steik/', 'n. 牛排, 鱼排, 肉排', '基础', [], [], []],
  ['steal', 'vt. /sti:l/', 'vt. 剽窃；偷偷地做；偷窃；vi. 窃取；偷偷地行动；[棒球]偷垒；n. [口]偷窃；便宜货；偷垒；[篮球]断球', '基础', [], [], []],
  ['steam', 'n. /sti:m/', 'n. 蒸汽, 精力；a. 蒸汽的；vi. 蒸发, 行驶, 发怒；vt. 蒸, 煮, 散发', '基础', [], [], []],
  ['steel', 'n. /sti:l/', 'n. 钢, 钢制品, 钢铁, 坚硬, 坚固；a. 钢的, 钢制的, 钢铁业的, 坚强的；vt. 使坚强, 钢化, 使冷酷', '基础', [], [], []],
  ['steep', 'adj. /sti:p/', 'n. 浸渍, 悬崖；a. 险峻的, 陡峭的, 急剧升降的, 夸大的；v. 浸, 泡', '基础', [], [], []],
  ['step', 'n. vi. /step/', 'n. 步骤, 步, 步幅, 脚步声, 踏级, 步伐, 短距离, 步态, 手段, 等级；vt. 踏, 以步测量, 跨步, 使成阶梯状；vi. 跨步, 轻快地走, 跳舞, 踩, 踏上, 行走；[计] 步骤', '基础', [], [], []],
  ['stick', 'vi. n. /stik/', 'n. 棍, 棒, 刺, 枯枝, 茎, 条状物；vt. 插进, 刺入, 钉住, 伸出, 粘贴, 停止；vi. 粘住, 停留, 坚持, 陷住, 伸出', '基础', [], [], []],
  ['still', 'adj. adv. /stil/', 'n. 蒸馏室, 寂静, 剧照；v. 蒸馏, (使)平静, (使)静止；a. 静止的, 不动的, 静寂的, 不起泡的, 静物摄影的；adv. 仍然, 更, 静止地；conj. 然而, 但是', '基础', [], [], []],
  ['stocking', 'n. /\'stɒkiŋ/', 'n. 长袜；[医] 马足水肿; 长袜', '基础', [], [], []],
  ['stomach', 'n. /\'stʌmәk/', 'n. 胃, 食欲, 欲望, 肚子；vt. 吃下, 忍受', '基础', [], [], []],
  ['stone', 'n. /stәun/', 'n. 石头, 宝石, 果核, 纪念碑, 结石；vt. 投扔石子, 铺石头；a. 石的, 石制的, 完全的', '基础', [], [], []],
  ['stop', 'n. v. /stɒp/', 'n. 停止, 车站, 逗留, 填塞, 障碍, (风琴的)音栓；vi. 停止, 被塞住；vt. 塞住, 堵塞, 阻止, 击落, 停止, 终止, 断绝', '基础', [], [], []],
  ['storage', 'n. /\'stɒ:ridʒ/', 'n. 存储器, 储藏, 保管, 库存, 仓库；[计] 存放处; 存储', '基础', [], [], []],
  ['store', 'n. vt. /stɒ:/', 'n. 商店, 贮藏, 仓库, 备用品, 存储器；vt. 储存, 贮藏, 供给；vi. 贮藏；a. 贮藏的, 现成的；[计] 存储器操作; 存储', '基础', [], [], []],
  ['storm', 'n. /stɒ:m/', 'n. 暴风雨, 骚动, 风波, 风暴, 猛攻；vi. 起风, 猛冲, 怒吼；vt. 猛攻', '基础', [], [], []],
  ['story', 'n. /\'stɒ:ri/', 'n. 故事, 小说, 传奇, 描述, 阅历, 经历, 层', '基础', [], [], []],
  ['straight', 'adj. adv. /streit/', 'n. 直线, 直；a. 直的, 笔直的, 正直的, 直接的, 连续的, 整齐的；adv. 直接地, 立即, 不断地', '基础', [], [], []],
  ['straightforward', 'adj. & adv. /streit\'fɒ:wәd/', 'a. 笔直的, 率直的, 明确的, 简单的, 直接的', '基础', [], [], []],
  ['strange', 'adj. /streindʒ/', 'a. 奇怪的, 陌生的, 生疏的, 不熟悉的, 不可思议的, 外行的, 外地的, 异乡的', '基础', [], [], []],
  ['stranger', 'n. /\'streindʒә/', 'n. 陌生人, 门外汉；[法] 局外人, 非当事人, 第三者', '基础', [], [], []],
  ['straw', 'n. /strɒ:/', 'n. 稻草, 麦管, 吸管, 一文不值的东西, 草帽；a. 稻草的, 稻草色的, 琐碎的, 无价值的', '基础', [], [], []],
  ['strawberry', 'n. /\'strɒ:bәri/', 'n. 草莓', '基础', [], [], []],
  ['stream', 'n. /stri:m/', 'n. 水流, 小河, 流出, 趋势, 人潮；vt. 流出, 流动, 展开；vi. 流, 涌, 飘扬；[计] 流', '基础', [], [], []],
  ['street', 'n. /stri:t/', 'n. 街道, 马路, 街区；a. 街道的', '基础', [], [], []],
  ['strength', 'n. /streŋθ/', 'n. 力量, 实力, 强度, 浓度, 人数, 抵抗力；[化] 强度', '基础', [], [], []],
  ['strengthen', 'vt. /\'streŋθәn/', 'vt. 加强, 变坚固；vi. 变强, 股票上涨', '基础', [], [], []],
  ['stress', 'n. v. /stres/', 'n. 压力, 紧迫, 强调, 重音, 重点, 应力；vt. 加压力于, 着重, 重读', '基础', [], [], []],
  ['strict', 'adj. /strikt/', 'a. 严厉的, 绝对的, 详尽的, 严格的, 精确的；[法] 严格的, 精确的, 绝对的', '基础', [], [], []],
  ['strike', 'v. /straik/', 'n. 罢工, 打击, 殴打；vt. 打, 撞击, 冲击, 侵袭, 取消, 结算, 打掉, 罢工, 刺透, 使生根, 遇见；vi. 打, 打击, 抓, 罢工, 搏动, 触礁, 敲, 响, 穿透, 打动', '基础', [], [], []],
  ['string', 'n. /striŋ/', 'n. 线, 细绳, 一串, 字符串；vt. 串起, 成串, 收紧, 缚, 扎；vi. 成一串；[计] 字符串, 串', '基础', [], [], []],
  ['strong', 'adj. /strɒŋ/', 'a. 强壮的, 坚固的, 坚强的, 强烈的, 有力的, 优良的；adv. 强劲地, 有力地, 猛烈地', '基础', [], [], []],
  ['structure', 'n.', '结构；构造', '基础', [], [], []],
  ['struggle', 'vi. n. /\'strʌgl/', 'n. 斗争, 努力, 奋斗；vi. 努力, 奋斗, 挣扎', '基础', [], [], []],
  ['stubborn', 'adj. /\'stʌbәn/', 'a. 顽固的, 不听话的, 执拗的, 棘手的', '基础', [], [], []],
  ['student', 'n. /\'stju:dnt/', 'n. 学生, 研究者, 学者', '基础', [], [], []],
  ['studio', 'n. /\'stju:diәu/', 'n. 工作室, 画室, 演播室, 电影制片厂', '基础', [], [], []],
  ['study', 'v. n. /\'stʌdi/', 'n. 学习, 研究, 学科, 论文, 求学, 书房, 试作；vt. 学习, 读书, 研究, 考虑, 计划；vi. 学习, 思索', '基础', [], [], []],
  ['stuff', 'n.', '东西，材料', '基础', [], [], []],
  ['stupid', 'adj. /\'stju:pid/', 'a. 愚蠢的, 麻木的', '基础', [], [], []],
  ['style', 'n. /stail/', 'n. 风格, 时尚, 文体, 风度, 字体, 类型；vt. 称呼, (根据新款式)设计, 使合潮流；n. 风格, 样式；[计] 风格, 样式', '基础', [], [], []],
  ['subject', 'adj. vt. n. /\'sʌbdʒekt/', 'n. 科目, 主题, 臣民, 主语, 题目, (事物的)经受者, 学科, 受治疗者, 原因, 理由；a. 服从的, 易患...的, 隶属的, 受支配的；adv. 在...条件下；vt. 使隶属, 使受到；[计] 主题, 主体', '基础', [], [], []],
  ['subjective', 'adj. /sәb\'dʒektiv/', 'a. 主观的, 个人的；[医] 主观的, 自觉的', '基础', [], [], []],
  ['submission', 'n.', '投降；提交（物）', '基础', [], [], []],
  ['submit', 'v. /sәb\'mit/', 'vt. 使服从, 使受到, 委托, 提交, 认为；vi. 屈服, 服从', '基础', [], [], []],
  ['subscribe', 'v. /sәb\'skraib/', 'vt. 捐献, 签署；vi. 赞成, 同意, 捐款, 预订, 认购；[计] 订阅', '基础', [], [], []],
  ['succeed', 'vi. /sәk\'si:d/', 'vi. 成功, 继承, 继续；vt. 继承, 接替', '基础', [], [], []],
  ['success', 'n. /sәk\'ses/', 'n. 成功, 成就, 胜利', '基础', [], [], []],
  ['successful', 'adj. /sәk\'sesful/', 'a. 成功的, 一帆风顺的, 顺利的；[经] 成功的', '基础', [], [], []],
  ['such', 'adv. pron. adj. /sʌtʃ/', '那么 （泛指）人，事物 这样的，那样的', '基础', [], [], []],
  ['suck', 'vt. /sʌk/', 'vt. 吸, 吮, 吸入, 吮吸, 吸收；vi. 吸, 吸奶；n. 吸, 吸入, 吮吸', '基础', [], [], []],
  ['sudden', 'adj. /\'sʌdn/', 'n. 突然, 忽然；a. 突然的, 意外的, 快速的', '基础', [], [], []],
  ['suffer', 'vi. /\'sʌfә/', 'vt. 遭受, 经历, 忍受；vi. 受痛苦, 受损害', '基础', [], [], []],
  ['suffering', 'n. /\'sʌfәriŋ/', 'n. 苦难, 受苦', '基础', [], [], []],
  ['sufficient', 'adj.', '足够的，充分的', '基础', [], [], []],
  ['sugar', 'n. /\'ʃugә/', 'n. 糖, 糖块, 甜言蜜语；vt. 加糖于, 使甜蜜, 粉饰, 美化；vi. 制成糖', '基础', [], [], []],
  ['suggest', 'vt. /sәg\'dʒest/', 'vt. 提议, 建议, 促成, 暗示, 启发, 使人想起；[法] 建议, 提出, 提议', '基础', [], [], []],
  ['suggestion', 'n. /sә\'dʒestʃәn/', 'n. 提议, 意见；[医] 暗示', '基础', [], [], []],
  ['suit', 'vt. n. /sju:t. su:t/', 'n. 套装, 诉讼, 请求, 起诉, 套, 组；vt. 适合, 使适应；vi. 合适, 相称', '基础', [], [], []],
  ['suitable', 'adj. /\'sju:tәbl/', 'a. 适当的, 相配的；[法] 合适的, 适宜的, 适当的', '基础', [], [], []],
  ['suitcase', 'n. /\'sju:tkeis/', '（旅行用）小提箱，衣箱', '基础', [], [], []],
  ['suite', 'n. /swi:t/', 'n. 随员, 套房, (一)组, (一)套, 组曲, 继之而来的事；[电] 程序组', '基础', [], [], []],
  ['sum', 'n.', '金额，总数', '基础', [], [], []],
  ['summary', 'n. /\'sʌmәri/', 'n. 摘要, 概要；a. 摘要的, 简略的；[计] 摘要; 概要', '基础', [], [], []],
  ['summer', 'n. /\'sʌmә/', 'n. 夏季, 全盛时期；vi. 避暑, 过夏天；[计] 加法器', '基础', [], [], []],
  ['sun', 'n. /sʌn/', 'n. 太阳, 日, 日光, 阳光；vt. 晒；vi. 晒太阳', '基础', [], [], []],
  ['sunlight', 'n. /\'sʌnlait/', 'n. 日光；[医] 日光, 太阳光', '基础', [], [], []],
  ['sunny', 'adj. /\'sʌni/', 'a. 阳光充足的, 乐观的, 快乐的, 像太阳的', '基础', [], [], []],
  ['sunshine', 'n. /\'sʌnʃain/', 'n. 阳光, 光明, 晴天', '基础', [], [], []],
  ['super', 'adj. /\'sju:pә/', 'n. 跑龙套角色, 冗员, 特级品, 特大号, 管理人；a. 上等的, 特大的, 超级的, 极好的, 十分的, 过分的；adv. 非常', '基础', [], [], []],
  ['superior', 'adj. n. /sju:\'piәriә/', 'n. 长者, 占优势的人, 上级；a. 上级的, 出众的, 高傲的', '基础', [], [], []],
  ['supermarket', 'n. /\'sju:pәmɑ:kit/', 'n. 超级市场；[经] 超级市场, 自助售货商店', '基础', [], [], []],
  ['supper', 'n. /\'sʌpә/', '晚餐，晚饭', '基础', [], [], []],
  ['supply', 'vt. & n. /sә\'plai/', 'n. 补给, 供给, 供应品；vt. 补给, 供给, 提供, 补充；vi. 替代', '基础', [], [], []],
  ['support', 'vt. & n. /sә\'pɒ:t/', 'n. 支持, 支撑, 援助, 供养, 支撑物；vt. 支援, 支撑, 帮助, 支持, 忍受, 供养, 证实；[计] 后援; 支持', '基础', [], [], []],
  ['suppose', 'vt. /sә\'pәuz/', 'vt. 推想, 假设, 以为, 想像, 假定；vi. 料想', '基础', [], [], []],
  ['sure', 'adj. adv. /ʃuә/', 'a. 确信, 必然的, 必定的；adv. 当然, 确实地, 无疑地', '基础', [], [], []],
  ['surface', 'n. /\'sә:fis/', 'n. 面, 表面, 水面, 外表, 平面；a. 表面的, 外观的, 肤浅的, 水面上的；vt. 使成平面, 使浮出水面；vi. 浮出水面, 呈现, 在地面上工作', '基础', [], [], []],
  ['surgeon', 'n. /\'sә:dʒәn/', 'n. 外科医生, 军医, 船医；[医] 外科医师', '基础', [], [], []],
  ['surgery', 'n.', '外科；外科手术', '基础', [], [], []],
  ['surplus', 'n. /\'sә:plәs/', 'n. 剩余, 过剩, 盈余；a. 过剩的, 剩余的', '基础', [], [], []],
  ['surprise', 'vt. n. /sә\'praiz/', 'n. 惊奇, 奇袭, 诧异；vt. 使惊奇, 撞见, 奇袭', '基础', [], [], []],
  ['surround', 'vt. /sә\'raund/', 'vt. 包围, 环绕, 围绕；n. 围绕物', '基础', [], [], []],
  ['surrounding', 'adj. /sә\'raundiŋ/', 'n. 环境；a. 周围的', '基础', [], [], []],
  ['survey', 'n.', '调查；测量', '基础', [], [], []],
  ['survival', 'n. /sә\'vaivәl/', 'n. 生存, 残存, 幸存者；a. 赖以生存的', '基础', [], [], []],
  ['survive', 'v. /sә\'vaiv/', 'vt. 比...活得长, 生存, 生还, 幸免于；vi. 活下来, 幸存', '基础', [], [], []],
  ['suspect', 'n. vt. /sә\'spekt/', 'n. 被怀疑者, 嫌疑犯；a. 令人怀疑的, 不可信的, 可疑的；v. 怀疑, 猜想', '基础', [], [], []],
  ['sustainable', 'adj.', '可持续的；可忍受的', '基础', [], [], []],
  ['swallow', 'vt. /\'swɒlәu/', 'n. 燕子, 吞咽, 喉；vt. 咽, 淹没, 吞没, 耗尽, 轻信, 忍受, 抑制；vi. 吞下, 咽下', '基础', [], [], []],
  ['swap', 'v. /swɒp/', 'n. 以货易货；v. 交换, 替换, 交易；[计] 交换', '基础', [], [], []],
  ['swear', 'v. /swєә/', 'vt. 发誓, 咒骂, 使宣誓；vi. 发誓, 诅咒；n. 诅咒, 誓言', '基础', [], [], []],
  ['sweat', 'n. /swet/', 'n. 汗, 汗水, 水珠, 焦急；vi. 出汗, 渗出, 冒出水气, 结水珠, 烦恼, 懊恼；vt. 使出汗, 流出, 榨出, 使汗流浃背', '基础', [], [], []],
  ['sweater', 'n. /\'swetә/', 'n. 毛衣, 毛线衫, 运动衫, 出汗者；[化] 发汗器', '基础', [], [], []],
  ['sweep', 'v. /swi:p/', 'n. 扫除, 打扫, 肃清, 视野, 范围, 全胜；vt. 扫除, 掸去, 猛拉, 扫荡, 肃清, 冲走, 刮起, 环视, 掠过, 扫射；vi. 扫, 打扫, 袭击, 席卷, 扫视, 掠过', '基础', [], [], []],
  ['sweet', 'n. adj. /swi:t/', 'n. 甜蜜, 糖果, 情人；a. 甜的, 芳香的, 悦耳的, 漂亮的, 和蔼的, 不咸的, 灵活的, 轻快的', '基础', [], [], []],
  ['swell', 'v. /swel/', 'n. 增大, 隆起的部分, 巨浪, 肿胀；a. 优秀的, 一流的；vi. 增大, 膨胀, 肿胀, 增强, 骄傲；vt. 使膨胀, 使增大, 使上涨, 使骄傲', '基础', [], [], []],
  ['swift', 'adj. /swift/', 'n. 褐雨燕, 快速爬行的小蜥蜴, 蝙蝠蛾, 大滚筒；a. 迅速的, 快的, 敏捷的, 立刻的；adv. 迅速地, 敏捷地', '基础', [], [], []],
  ['swim', 'vi. /swim/', 'n. 游泳, 漂浮, 潮流, 眩晕；vi. 游泳, 游, 漂浮, 浸, 覆盖, 充溢, 大量拥有, 旋转, 眩晕；vt. 游过, 使浮起', '基础', [], [], []],
  ['swing', 'vt. n. /swiŋ/', 'n. 摇摆, 振幅, 音律, 节奏, 涨落, 秋千, 旋转, 行动自由；vi. 摇摆, 悬挂, 旋转, 大摇大摆地走, 转向；vt. 挥舞, 使旋转, 使转向, 悬挂, 吊运；a. 旋转的, 悬挂的, 强节奏爵士音乐的', '基础', [], [], []],
  ['switch', 'v. & n. /switʃ/', 'n. 开关, 电闸, 转换, 软枝, 鞭子, 道岔；vt. 转变, 切换, 摆动, 转换, 使转轨；vi. 转换, 变换, 摆动；[计] 开关; 翻转; 转移', '基础', [], [], []],
  ['symbol', 'n. /\'simbl/', 'n. 符号, 象征, 代号, 信条；[计] 符号; 码元', '基础', [], [], []],
  ['sympathy', 'n. /\'simpәθi/', 'n. 同情, 赞同, 怜悯, 慰问, 吊唁；[医] 交感[作用], 同感[作用], 感应, 同情', '基础', [], [], []],
  ['symptom', 'n. /\'simptәm/', 'n. 症状, 征候, 征兆；[医] 症状', '基础', [], [], []],
  ['system', 'n. /\'sistәm/', 'n. 系统, 体系, 制度, 方式, 秩序, 分类原则；[计] 系统; 体制; 体系', '基础', [], [], []],
  ['systematic', 'adj. /.sisti\'mætik/', 'a. 有系统的, 分类上的, 体系的；[医] 系统的, 系的, 分类的', '基础', [], [], []],
  ['T-shirt', 'n.', 'T恤衫', '基础', [], [], []],
  ['table', 'n. /\'teibl/', 'n. 桌子, 餐桌, 工作台, 铭文, 表格, 表, 高原, 平地层；vt. 搁置, 嵌合, 制表, 把...列入议事日程；[计] 表格, 模拟运算表', '基础', [], [], []],
  ['tablet', 'n.', '药片', '基础', [], [], []],
  ['tail', 'n. /teil/', 'n. 尾部, 后部, 辫子, 随员, 特务, 燕尾服, 踪迹, 限定继承(权)；a. 在后面的, 从后面而来的, 限定继承的, 尾部的, 后部的；vt. 为...装尾, 附于其后, 尾随, 使搭牢, 跟踪, 监视；vi. 跟踪, 船尾搁浅', '基础', [], [], []],
  ['take', 'vt. /teik/', 'vt. 拿, 取, 抓, 带领, 获得, 就座, 接受, 吃, 吸引, 采取, 乘, 需要, 花费；vi. 吃掉对方棋子, 抓住, 起作用, 依法获得财产；n. 拿, 取, 收成, 奏效', '基础', [], [], []],
  ['tale', 'n. /teil/', 'n. 故事, 谎言, 谣言, 陈述, 叙述；[法] 虚语, 诽语, 谣言', '基础', [], [], []],
  ['talent', 'n. /\'tælәnt/', 'n. 天才, 才能, 有才干的人, 天资', '基础', [], [], []],
  ['talk', 'n. & v. /tɒ:k/', 'n. 谈话, 交谈, 会谈, 讲话, 演讲, 空谈, 谣言, 方言, 语言；vi. 讲话, 演讲, 说话, 谈话, 交流, 闲聊, 说闲话；vt. 讲, 说, 讨论, 谈论；[计] 对话类, 聊天', '基础', [], [], []],
  ['tall', 'adj. /tɒ:l/', 'a. 高的, 长的, 夸大的；adv. 夸大地', '基础', [], [], []],
  ['tank', 'n. /tæŋk/', 'n. 槽, 箱, 柜, 罐, 池塘, 储水池, 坦克；vt. 储于箱中', '基础', [], [], []],
  ['tap', 'n. /\'tæp/', 'n. 轻打, 水龙头；vt. 轻打, 轻敲, 敲打出, 选择, 装上嘴子, 使流出, 开发, 分接, 向...乞讨；vi. 轻叩, 轻拍, 啪塔啪塔地走；[计] 接头', '基础', [], [], []],
  ['tape', 'n. /teip/', 'n. 带子, 录音带, 磁带, 窄带, 卷尺；vt. 以带子绑起, 测量, 录音；[计] 带', '基础', [], [], []],
  ['target', 'n. & v. /\'tɑ:git/', 'n. 目标, 靶子, 指标；vt. 对准, 订指标', '基础', [], [], []],
  ['task', 'n. /tɑ:sk/', 'n. 工作, 任务, 作业, 困难的工作；vt. 派给...工作, 使辛劳；[计] 任务', '基础', [], [], []],
  ['taste', 'n. vt. /teist/', 'n. 味道, 品味, 味觉, 感受, 体验, 爱好, 审美, 少量；vt. 尝, 察觉...的味道, 体会；vi. 品尝, 察觉味道, 有某种味道', '基础', [], [], []],
  ['tasty', 'adj. /\'teisti/', 'a. 好吃的, 可口的', '基础', [], [], []],
  ['tax', 'n. /tæks/', 'n. 税, 税款, 重负, 会费；vt. 课以税, 使负重荷, 斥责', '基础', [], [], []],
  ['taxi', 'n. /\'tæksi/', 'n. 出租车；vi. 乘出租车；vt. 用出租车送', '基础', [], [], []],
  ['taxpayer', 'n.', '纳税人', '基础', [], [], []],
  ['tea', 'n. /ti:/', 'n. 茶, 茶叶；[医] 茶, 茶剂, 浸剂', '基础', [], [], []],
  ['teach', 'v. /ti:tʃ/', 'vt. 教, 讲授, 教导, 教育；vi. 教书, 教学, 可以教', '基础', [], [], []],
  ['teacher', 'n. /\'ti:tʃә/', 'n. 教师, 老师, 导师', '基础', [], [], []],
  ['team', 'n. /ti:m/', 'n. 队, 组；vt. 把马(牛)套在同一辆车上, 把...编成一组；vi. 驾驶卡车, 协作', '基础', [], [], []],
  ['teamwork', 'n. /\'ti:mwә:k/', 'n. 协同作业, 协力；[法] 联合工作, 联合行动, 协调工作', '基础', [], [], []],
  ['teapot', 'n. /\'ti:pɒt/', 'n. 茶壶', '基础', [], [], []],
  ['tear', 'n. v. /tiә. tєә/', 'n. 泪滴, 眼泪, 撕, 扯, 裂缝, 激怒, 飞奔；vi. 流泪, 撕破, 赶快, 飞奔, 被撕破；vt. 撕裂, 戳破, 拉掉, 撕掉, 使分裂, 使精神不安, 折磨', '基础', [], [], []],
  ['tease', 'v. /ti:z/', 'n. 揶揄, 戏弄, 逗惹；vt. 戏弄, 取笑, 强求, 梳理, 使起毛', '基础', [], [], []],
  ['technical', 'adj. /\'teknikl/', 'a. 技术上的, 专门的, 工业的, 严格根据法律的；[化] 技巧', '基础', [], [], []],
  ['technique', 'n. /tek\'ni:k/', 'n. 技巧, 技术, 方法；[化] 工艺方法; 技巧', '基础', [], [], []],
  ['technology', 'n. /tek\'nɒlәdʒi/', 'n. 技术, 工业技术, 术语；[医] 技术学, 工艺学', '基础', [], [], []],
  ['teenager', 'n. /\'ti:nidʒә/', '（13 – 19 岁的）青少年，十几岁的少年', '基础', [], [], []],
  ['telephone', 'v. n. /\'telifәun/', 'n. 电话, 电话机；v. 打电话', '基础', [], [], []],
  ['telescope', 'n. /\'teliskәup/', 'n. 望远镜；vi. 叠缩, 嵌进, 缩短；vt. 使叠缩, 使缩短', '基础', [], [], []],
  ['television', 'n. /\'teli.viʒәn/', 'n. 电视；[电] 电视', '基础', [], [], []],
  ['tell', 'vt. /tel/', 'vt. 告诉, 说, 吩咐, 断定, 知道；vi. 讲述, 泄密, 告发, 表明', '基础', [], [], []],
  ['temperature', 'n. /\'temprәtʃә/', 'n. 温度, 发烧, 热度；[化] 温度', '基础', [], [], []],
  ['temporary', 'adj. /\'tempәrәri/', 'a. 暂时的, 临时的；n. 临时工, 临时雇员；[计] 临时', '基础', [], [], []],
  ['tend', 'v. /tend/', 'vi. 走向, 有某种的倾向, 易于, 照顾, 注意；vt. 照料, 护理', '基础', [], [], []],
  ['tendency', 'n. /\'tendәnsi/', 'n. 趋向, 倾向；[医] 趋向, 趋势', '基础', [], [], []],
  ['tennis', 'n. /\'tenis/', 'n. 网球', '基础', [], [], []],
  ['tense', 'adj. /tens/', 'a. 紧张的, 拉紧的；v. (使)紧张, (使)拉紧；n. 时态', '基础', [], [], []],
  ['tension', 'n. /\'tenʃәn/', 'n. 紧张, 不安, 拉紧, 张力, 压力, 电压；vt. 拉紧, 使紧张', '基础', [], [], []],
  ['tent', 'n. /tent/', 'n. 帐篷, 帷幕, 住处, 塞条, 塞子；vi. 住帐蓬, 宿营, 暂时居住；vt. 用帐篷遮盖, 使住帐篷, 用塞条嵌入', '基础', [], [], []],
  ['term', 'n. /tә:m/', 'n. 术语, 专有名词, 期限, 学期, 任期, 条件, 价钱, 关系, 地位, 项, 界石；vt. 称, 呼；[计] 检索词; 项', '基础', [], [], []],
  ['terminal', 'n. /\'tә:minәl/', 'n. 终端机, 终点, 末端, 极限, 终点站；a. 终点的, 定期的, 致死的, 结尾的, 末端的, 晚期的；[计] 终端; 终端设备', '基础', [], [], []],
  ['terrible', 'adj. /\'terәbl/', 'a. 可怕的, 令人恐惧的, 极坏的', '基础', [], [], []],
  ['terrify', 'vt. /\'terifai/', 'vt. 使恐惧, 恐吓', '基础', [], [], []],
  ['territory', 'n.', '领土，领域；范围', '基础', [], [], []],
  ['terror', 'n. /\'terә/', 'n. 恐怖, 可怕的人；[医] 惊吓, 惊悸', '基础', [], [], []],
  ['test', 'vt. & n. /test/', 'n. 测试, 试验, 化验, 检验, 考验, 甲壳；vt. 测试, 试验, 化验；vi. 接受测验, 进行测试', '基础', [], [], []],
  ['text', 'n. /tekst/', 'n. 文本, 正文, 课文, 主题, 圣经文句, 乐谱；[计] 电文; 文本; 正文', '基础', [], [], []],
  ['textbook', 'n. /\'tekstbuk/', '课本，教科书', '基础', [], [], []],
  ['than', 'conj. /ðæn/', 'conj. 比, 除...外；prep. 比', '基础', [], [], []],
  ['thank', 'vt. n. /θæŋk/', 'n. 谢意, 感谢；vt. 谢谢, 感谢', '基础', [], [], []],
  ['thankful', 'adj. /\'θæŋkfәl/', 'a. 感谢的, 感激的, 欣慰的', '基础', [], [], []],
  ['that', 'adj. & pron. conj. adv. /ðæt/', 'a. 那, 那个；conj. 以致, 因为；pron. 那；adv. 那么, 那样', '基础', [], [], []],
  ['the', 'art. /ðә/', '这（那）个，这（那）些（用于特定人或物，序数词，最高级，专有名词，世上独一无二事物前）', '基础', [], [], []],
  ['theatre', 'n.', 'n. 戏院, 电影院, 剧场, 全体观众, 戏剧, 戏剧效果, 阶梯式讲堂, 场所', '基础', [], [], []],
  ['theft', 'n. /θeft/', 'n. 盗窃, 失窃, 盗窃罪, 赃物；[法] 盗窃行为, 偷窃, 失窃', '基础', [], [], []],
  ['their', 'pron. /ðєә/', 'pron. 他们的', '基础', [], [], []],
  ['theirs', 'pron. /ðєәz/', 'pron. 他们的', '基础', [], [], []],
  ['them', 'pron. /ðem/', 'pron. 他们, 她们, 它们', '基础', [], [], []],
  ['theme', 'n. /θi:m/', 'n. 主题, 话题, 题目', '基础', [], [], []],
  ['themselves', 'pron. /ðәm\'selvz/', 'pron. 他们自己, 她们自己, 它们自己', '基础', [], [], []],
  ['then', 'adv. /ðen/', 'adv. 然后, 当时；conj. 然后, 当时；n. 那时', '基础', [], [], []],
  ['theoretical', 'adj. /θiә\'retikәl/', 'a. 理论的, 理论上的, 假设的, 推理的；[计] 理论的', '基础', [], [], []],
  ['theory', 'n. /\'θiәri/', 'n. 理论, 学说, 原理, 意见, 推测；[化] 理论', '基础', [], [], []],
  ['there', 'int. n. adv. /ðєә/', '那！你瞧（表示引起注意） 那里，那儿 在那里，往那里；（作引导词）表存在', '基础', [], [], []],
  ['therefore', 'adv. /\'ðєәfɒ:/', 'adv. 因此, 所以', '基础', [], [], []],
  ['these', 'adj. & pron. /ði:z/', 'pron. 这些', '基础', [], [], []],
  ['they', 'pron. /ðei/', 'pron. 他们, 它们', '基础', [], [], []],
  ['thick', 'adj. /θik/', 'a. 厚的, 粗壮的, 浓的, 迟钝的, 浑浊的, 多雾的, 过分的, 口齿不清的；adv. 厚地, 密地, 浓浓地；n. 最浓处, 最厚处, 最密集处；[计] 暗, 粗线', '基础', [], [], []],
  ['thief', 'n. /θi:f/', '窃贼，小偷（复 thieves）', '基础', [], [], []],
  ['thin', 'adj. /θin/', 'a. 薄的, 细的, 瘦的, 稀疏的, 稀薄的, 淡的, 弱的, 空洞的；vt. 使变薄, 使变细, 使稀少, 使淡；vi. 变薄, 变细, 变少, 变淡；adv. 薄地, 稀疏地, 微弱地；n. 细小部分', '基础', [], [], []],
  ['thing', 'n. /θiŋ/', 'n. 事物, 东西, 物, 用品, 事, 事件, 情况, 行为, 特征', '基础', [], [], []],
  ['think', 'v. /θiŋk/', 'vt. 想, 考虑, 想起, 想像, 打算, 认为；vi. 思考, 料想；n. 想法；a. 思想的', '基础', [], [], []],
  ['thirst', 'n. /θә:st/', 'n. 口渴, 渴望；vi. 口渴, 渴望', '基础', [], [], []],
  ['this', 'adj. & pron. /θis/', 'pron. 这, 本；a. 这, 本；adv. 这么', '基础', [], [], []],
  ['thorough', 'adj. /\'θʌrә/', 'a. 十分的, 彻底的', '基础', [], [], []],
  ['those', 'adj. & pron. /ðәuz/', 'pron. 那些', '基础', [], [], []],
  ['though', 'conj. /ðәu/', 'adv. 然而, 可是；conj. 虽然, 纵然', '基础', [], [], []],
  ['thought', 'n. /θɒ:t/', 'n. 想法, 思想, 思维, 关心, 挂念；think的过去式和过去分词', '基础', [], [], []],
  ['thread', 'n. /θred/', 'n. 线, 丝, 纤维, 线索；vt. 穿线于, 穿过, 通过, 用线穿成；vi. 穿过；[计] 线索, 线程', '基础', [], [], []],
  ['threat', 'n.', '威胁，恐吓；凶兆', '基础', [], [], []],
  ['threaten', 'v.', '威胁，恐吓；预示', '基础', [], [], []],
  ['thrill', 'n. & v. /θril/', 'n. 震颤, 激动, 刺激性, 一阵激动；vi. 震颤, 颤抖, 激动；vt. 使激动, 使颤动', '基础', [], [], []],
  ['thriller', 'n. /\'θrilә/', 'n. 使人激动的东西, 使人毛骨悚然的东西, 使人毛骨悚然的小说', '基础', [], [], []],
  ['throat', 'n. /θrәut/', 'n. 咽喉, 喉咙, 嗓音；vt. 用喉音说, 开沟于', '基础', [], [], []],
  ['through', 'prep. adv. /θru:/', 'adv. 穿越, 从头至尾, 到底, 因为；prep. 经过, 穿过；a. 对穿的, 直达的, 完结的', '基础', [], [], []],
  ['throughout', 'prep. /θru:\'aut/', 'adv. 到处, 贯穿全部地, 自始至终；prep. 遍及, 在各处；[计] 吞吐量', '基础', [], [], []],
  ['throw', 'v. /θrәu/', 'vt. 投, 掷, 抛, 发射, 摔下, 匆匆穿上(或脱下), 抛弃, 摆脱；vi. 丢, 掷, 抛；n. 投掷, 掷骰子, 冒险', '基础', [], [], []],
  ['thunder', 'n. & v. /\'θʌndә/', 'n. 雷, 雷声；vi. 打雷, 轰隆地响, 怒喝；vt. 大声喊出, 轰隆地发出', '基础', [], [], []],
  ['thus', 'adv. /ðʌs/', 'adv. 如此, 因此, 到如此程度；[医] 乳香', '基础', [], [], []],
  ['ticket', 'n. /\'tikit/', 'n. 票, 券, 车票, 标签, 入场券, 证明书；vt. 加标签于, 为...购票', '基础', [], [], []],
  ['tidy', 'adj. vt. /\'taidi/', 'n. 椅子的背罩, 装杂物的容器；a. 整齐的, 有条理的；vt. 弄整齐, 收拾, 整理；vi. 整理, 收拾', '基础', [], [], []],
  ['tie', 'vt. n. /tai/', 'n. 带子, 线, 鞋带, 领带, 领结, 关系, 束缚, 平局, 不分胜负；vt. 系, 打结, 扎, 约束, 与...成平局；vi. 结合, 打结, 不分胜负', '基础', [], [], []],
  ['tiger', 'n. /\'taigә/', 'n. 老虎, 虎, 凶暴的人', '基础', [], [], []],
  ['tight', 'adj. /tait/', 'a. 紧的, 密封的, 吝啬的, 严厉的；adv. 紧紧地', '基础', [], [], []],
  ['till', 'conj. & prep. /til/', 'prep. 直到, 在...以前, 迄；conj. 直到...为止；vt. 耕种；n. 放钱的抽屉, 备用现金, 冰碛', '基础', [], [], []],
  ['time', 'n. vt. /taim/', 'n. 时间, 时侯, 时机, 时期, 期限, 次数, 节拍, 暂停, 规定时间；vt. 测定...的时间, 记录...的时间, 计时, 定时；a. 时间的, 记时的, 定时的, 定期的, 分期的；[计] DOS内部命令:用于显示或设定系统的时间', '基础', [], [], []],
  ['timetable', 'n. /\'taimteibl/', '（火车、公共汽车等）时间表；（学校）课表', '基础', [], [], []],
  ['tin', 'n. /tin/', 'n. 锡, 马口铁, 罐头；vt. 在...镀锡于；a. 锡制的；[计] tin阅读程序', '基础', [], [], []],
  ['tiny', 'adj. /\'taini/', 'a. 很少的, 微小的', '基础', [], [], []],
  ['tip', 'n. & v. /tip/', 'n. 顶, 尖端, 梢, 末端, 倾斜, 垃圾场, 小费, 轻击, 指点, 秘密消息；vt. 装顶端, 使倾斜, 使翻倒, 泄露, 告诫, 暗示, 给...小费, 轻击；vi. 倾斜, 翻倒, 倾覆, 踮脚走, 给小费；[计] 终端接口处理器, 提示, 技巧', '基础', [], [], []],
  ['tire', 'v. /taiә/', 'n. 轮胎, 头饰；vt. 使疲倦, 使厌烦, 打扮；vi. 疲劳, 厌倦', '基础', [], [], []],
  ['tired', 'adj. /taiәd/', 'a. 疲累的, 疲乏的, 厌倦的', '基础', [], [], []],
  ['tiresome', 'adj.', '令人厌倦的', '基础', [], [], []],
  ['tissue', 'n. /\'tiʃu:/', 'n. 薄的织物, 薄纱, 棉纸, 组织, 一套；[化] 组织', '基础', [], [], []],
  ['title', 'n. /\'taitl/', 'n. 头衔, 名称, 标题, 书名, 扉页, 权利, 资格, 冠军, 字幕；vt. 授予头衔, 加标题于；[计] 标题', '基础', [], [], []],
  ['to', 'prep. /tu:/', '（动词不定式符号，无词义）；（表示接受动作的人或物）给；对，向，到；在…之前', '基础', [], [], []],
  ['toast', 'v. & n. /tәust/', 'n. 吐司, 烤面包, 干杯；vt. 敬酒, 烤, 使暖和；vi. 烤, 烘', '基础', [], [], []],
  ['tobacco', 'n. /tә\'bækәu/', 'n. 烟草, 香烟；[医] 烟草', '基础', [], [], []],
  ['today', 'adv. & n. /tә\'dei/', 'n. 今天, 当今, 现在；adv. 今天, 当今', '基础', [], [], []],
  ['together', 'adv. /tә\'geðә/', 'adv. 一起, 共同, 彼此', '基础', [], [], []],
  ['toilet', 'n. /\'tɒilit/', 'n. 厕所, 梳妆；vi. 梳妆, 打扮, 上厕所；vt. 给...梳妆打扮', '基础', [], [], []],
  ['tolerate', 'v. /\'tɒlәreit/', 'vt. 宽容, 容许, 有耐力', '基础', [], [], []],
  ['tomato', 'n. /tә\'mɑ:tәu/', 'n. 番茄, 西红柿', '基础', [], [], []],
  ['tomb', 'n. /tu:m/', 'n. 坟墓, 死亡；vt. 埋葬', '基础', [], [], []],
  ['tomorrow', 'adv. & n. /tә\'mɒ:rәu/', 'n. 明天, 未来；adv. 明天, 未来地', '基础', [], [], []],
  ['ton', 'n. /tʌn/', 'n. 吨；[经] 吨', '基础', [], [], []],
  ['tone', 'n.', '声音；音调', '基础', [], [], []],
  ['tongue', 'n. /tʌŋ/', 'n. 舌, 语言能力, 讲话方式, 语言；vt. 舔, 斥责, 发...的音；vi. 使用舌头, 吹管乐器', '基础', [], [], []],
  ['tonight', 'adv. & n. /tә\'nait/', 'n. 今晚, 今夜；adv. 今晚, 今夜', '基础', [], [], []],
  ['too', 'adv. /tu:/', '也，还，又，太，过分，很，非常', '基础', [], [], []],
  ['tool', 'n. /tu:l/', 'n. 工具, 机床, 傀儡；vt. 用工具加工；vi. 使用工具', '基础', [], [], []],
  ['tooth', 'n. /tu:θ/', 'n. 牙齿, 齿状物, 爱好；vt. 装以齿, 将...切成齿状；vi. 啮合', '基础', [], [], []],
  ['toothache', 'n. /\'tu:θeik/', 'n. 牙痛；[医] 牙痛', '基础', [], [], []],
  ['top', 'n. /tɒp/', 'n. 顶部, 顶端, 极点, 上面, 上部, 顶篷, 最高地位, 首位, 陀螺；a. 最高的, 顶上的, 头等的；vt. 盖, 加以顶, 高达, 超越；vi. 结束, 达到顶点, 高出；[计] TOP协议', '基础', [], [], []],
  ['topic', 'n. /\'tɒpik/', 'n. 主题, 论题, 话题', '基础', [], [], []],
  ['tortoise', 'n. /\'tɒ:tәs/', 'n. 龟, 行动迟缓的人', '基础', [], [], []],
  ['total', 'adj. n. v. /\'tәutl/', 'a. 全体的, 总的, 全然的；vt. 计算...的总和, 共计为；vi. 合计；n. 总数, 全体, 合计；adv. 统统', '基础', [], [], []],
  ['totally', 'adv. /\'tәutli/', 'adv. 完全地', '基础', [], [], []],
  ['touch', 'vt. /tʌtʃ/', 'n. 触觉, 碰, 触, 机灵, 轻触, 格调, 少许, 缺点, 弹力；vt. 接触, 触摸, 触及, 使接触, 达到, 涉及, 影响到, 使轻度受害, 感动；vi. 触摸, 接近, 涉及, 提到', '基础', [], [], []],
  ['tough', 'adj. /tʌf/', 'n. 恶棍；a. 强硬的, 艰苦的, 坚固的, 坚韧的, 粗暴的, 咬不动的', '基础', [], [], []],
  ['tour', 'n. /tuә/', 'n. 旅游, 观光旅行, 任期；vi. 旅行, 周游, 巡回；vt. 周游, 观光, 游历, 使巡回演出', '基础', [], [], []],
  ['tourism', 'n. /\'tuәrizm/', 'n. 观光业, 游览；[经] 旅游业', '基础', [], [], []],
  ['tourist', 'n. /\'tuәrist/', 'n. 观光客, 旅行者；a. 旅游的', '基础', [], [], []],
  ['toward', 'prep. /tә\'wɒ:d/', 'prep. 向, 对于, 为了；a. 即将来临的, 进行中的', '基础', [], [], []],
  ['towel', 'n. /\'tauәl/', 'n. 手巾, 毛巾；v. 擦干身子', '基础', [], [], []],
  ['tower', 'n. /\'tauә/', 'n. 塔, 高楼, 堡垒；vi. 高耸, 翱翔', '基础', [], [], []],
  ['town', 'n. /taun/', 'n. 城镇, 市, 镇；[法] 城镇, 城市, 闹市', '基础', [], [], []],
  ['toy', 'n. /tɒi/', 'n. 玩具, 小玩艺儿, 小型的东西, 消遣；a. 供玩耍的, 作为玩具的；vi. 玩弄, 戏弄, 调情', '基础', [], [], []],
  ['track', 'n. /træk/', 'n. 轨迹, 足迹, 径迹, 小道, 轨道, 磁轨, 途径；vt. 循路而行, 追踪, 通过, 用纤拉；vi. 追踪, 留下足迹, 沿轨道运行；[计] 跟踪', '基础', [], [], []],
  ['tractor', 'n. /\'træktә/', 'n. 牵引器, 拖拉机, 拉纸器；[计] 进纸器', '基础', [], [], []],
  ['trade', 'n. vt. /treid/', 'n. 贸易, 商业, 交易, 生意, 职业, 顾客, 信风；vi. 进行交易, 做买卖, 经商, 对换, 购物；vt. 用...进行交换', '基础', [], [], []],
  ['tradition', 'n. /trә\'diʃәn/', 'n. 传说, 传统, 交付；[法] 传统, 惯例, 移交', '基础', [], [], []],
  ['traditional', 'adj. /trә\'diʃәnl/', 'a. 传统的, 惯例的；[经] 传统的, 惯例的', '基础', [], [], []],
  ['traffic', 'n. /\'træfik/', 'n. 交通, 通行, 运输, 交通量, 贸易, 交易, 交往, 通信量；vi. 交易, 做买卖；vt. 用...作交换；[计] 通信量, 传输量', '基础', [], [], []],
  ['trail', 'n.', '痕迹；踪迹；足迹', '基础', [], [], []],
  ['train', 'n. v. /trein/', 'n. 火车, 列车, 行列, 长队, 一连串的后果, 顺序；vt. 训练, 教育, 对准；vi. 受训练, 锻炼', '基础', [], [], []],
  ['trainer', 'n. /\'treinә/', 'n. 训练员, 驯马师；[电] 列车器', '基础', [], [], []],
  ['training', 'n. /\'treiniŋ/', 'n. 训练, 培养；[医] 训练', '基础', [], [], []],
  ['transform', 'v. /træns\'fɒ:m/', 'vt. 使转换, 改变, 改造, 使...变形；vi. 改变, 转化, 变换；[计] 变换', '基础', [], [], []],
  ['translate', 'vt. /træns\'leit/', 'vt. 翻译, 解释, 转化, 转变为, 调动；vi. 翻译, 被译；[计] 转换', '基础', [], [], []],
  ['translation', 'n. /træns\'leiʃәn/', 'n. 翻译, 译文, 转化, 调任, 平移, 转译；[计] 转换', '基础', [], [], []],
  ['translator', 'n. /træn\'leitә/', 'n. 翻译者；[计] 翻译程序; 翻译器', '基础', [], [], []],
  ['transparent', 'adj. /træns\'pærәnt/', 'a. 透明的, 显然的, 清晰的；[计] 透明', '基础', [], [], []],
  ['transport', 'n. & vt. /træns\'pɒ:t/', 'n. 运输, 运输工具, 激动, 狂喜, 流放犯；vt. 传送, 运输, 流放；[计] 传送', '基础', [], [], []],
  ['transportation', 'n.', '运输；输送；运输工具', '基础', [], [], []],
  ['trap', 'n. vt. /træp/', 'n. 圈套, 陷阱, 诡计, 存水弯；vi. 设圈套, 设陷阱；vt. 诱捕, 诱骗, 抓住, 使受限制；[计] 俘获; 陷井', '基础', [], [], []],
  ['travel', 'n. & vi. /\'trævl/', 'n. 旅行, 游历, 行进；vi. 旅行, 行进, 移动, 被传播；vt. 旅行, 通过, 使移动', '基础', [], [], []],
  ['traveler', 'n. /\'trævlә/', 'n. 旅行者, 游客, 旅客, 旅行推销员, 活动起重架, 行车, 临时记帐单', '基础', [], [], []],
  ['treasure', 'n. /\'treʒә/', 'n. 宝物, 财富；vt. 珍爱, 重视, 秘藏', '基础', [], [], []],
  ['treat', 'vt. /tri:t/', 'n. 宴请, 款待；vt. 视为, 对待, 论述, 治疗, 款待；vi. 讨论, 谈判, 作东', '基础', [], [], []],
  ['treatment', 'n. /\'tri:tmәnt/', 'n. 治疗, 待遇, 处理；[医] 疗法, 治疗; 处理', '基础', [], [], []],
  ['tree', 'n. /tri:/', 'n. 树, 木料, 树状物；vt. 把...赶上树；[计] 树; DOS外部命令:显示指定磁盘驱动器的目录结构', '基础', [], [], []],
  ['tremble', 'v. /\'trembl/', 'n. 战栗, 颤抖；vi. 战栗, 忧虑, 摇晃', '基础', [], [], []],
  ['tremendous', 'adj.', '巨大的，极大的', '基础', [], [], []],
  ['trend', 'n. /trend/', 'n. 趋势, 倾向, 走向；vi. 倾向, 转向；[计] 趋势', '基础', [], [], []],
  ['trial', 'n. /\'traiәl/', 'n. 审判, 试验, 艰苦, 麻烦事, 考验；a. 审讯的, 试验性的', '基础', [], [], []],
  ['triangle', 'n. & adj. /\'traiæŋgl/', 'n. 三角形, 三个一组, 三角关系；[医] 三角, 三角形', '基础', [], [], []],
  ['trick', 'n. /trik/', 'n. 诡计, 欺诈, 谋略, 恶作剧, 习惯, 决窍；vt. 愚弄, 欺骗, 装饰；vi. 哄骗, 戏弄；a. 有决窍的, 特技的, 欺诈的, 漂亮的, 靠不住的', '基础', [], [], []],
  ['trip', 'n. /trip/', 'n. 旅行, 绊倒, 摔倒, 失足, 差错, 旅程；vt. 使跌倒, 使犯错, 使失败；vi. 轻快地走, 绊倒, 失误, 犯错, 结巴, 旅行, 远足', '基础', [], [], []],
  ['troop', 'n. vi. /tru:p/', 'n. 军队, 一群, 一队；vi. 群集, 结队, 成群而行', '基础', [], [], []],
  ['trouble', 'vt. n. /\'trʌbl/', 'n. 烦恼, 麻烦, 困难, 动乱, 故障；vt. 困扰, 麻烦, 使烦恼, 折磨；vi. 烦恼, 费心', '基础', [], [], []],
  ['troublesome', 'adj. /\'trʌblsәm/', 'a. 麻烦的, 令人讨厌的', '基础', [], [], []],
  ['trousers', 'n. /\'trauzәz/', 'pl. 裤子, 长裤', '基础', [], [], []],
  ['truck', 'n. v. /trʌk/', 'n. 卡车, 货车, 对...进行交易, 来往, 实物工资, (供应市场的)蔬菜, 废物, 废话；vt. 对...进行交易, 交往, 以卡车运输；vi. 驾驶卡车, 以物易物', '基础', [], [], []],
  ['true', 'adj. /tru:/', 'a. 真实的, 正确的, 忠诚的, 可靠的, 纯粹的, 正式的；n. 真实, 准确；adv. 真实地, 准确地', '基础', [], [], []],
  ['truly', 'adv. /\'tru:li/', 'adv. 真实地, 不假', '基础', [], [], []],
  ['trunk', 'n. /trʌŋk/', 'n. 树干, 干线, 躯干, 主干, 象鼻, 箱子；vt. 把...放入旅行箱内；a. 树干的, 躯干的, 干线的, 箱形的；[计] 中继线; 母线', '基础', [], [], []],
  ['trust', 'vt. /trʌst/', 'n. 信任, 信赖, 相信, 受托, 职责, 信心, 托拉斯；a. 信托的, 托拉斯的；vt. 信赖, 信任, 相信, 盼望, 赊卖给；vi. 相信, 信赖, 依靠；[计] 委托, 信任', '基础', [], [], []],
  ['truth', 'n. /tru:θ/', 'n. 事实, 实情；[法] 真实, 真相, 事实', '基础', [], [], []],
  ['try', 'v. /trai/', 'n. 尝试, 试验, 审理, 审判；vt. 试, 尝试, 试验, 考验, 审问, 提炼；vi. 尝试, 试图', '基础', [], [], []],
  ['tube', 'n. /tju:b/', 'n. 管, 软管, 隧道；vt. 把...装管, 使通过管子；[计] 管子', '基础', [], [], []],
  ['tune', 'n. /tju:n/', 'n. 歌曲, 主旋律, 心情, 声调, 和谐, 一致, 语调, 程度；vt. 为...调音, 调整, 调谐, 使一致；vi. 协调, 调谐', '基础', [], [], []],
  ['tunnel', 'n.', '隧道，地道', '基础', [], [], []],
  ['turkey', 'n. /\'tә:ki/', 'n. 火鸡, 无用的家伙, 土耳其', '基础', [], [], []],
  ['turn', 'v. n. /tә:n/', 'n. 转弯, 转动, 旋转, 翻转, 一圈, 顺次, 改动, 变化, 性格, 特色, 形状, 转折；vt. 使旋转, 转弯, 转动, 使转向, 驱赶, 阻挡, 兑换, 改写, 使作对, 绕过, 使流通；vi. 转动, 转弯, 转向, 翻转, 回转, 改变, 转身, 变成, 变质, 晕眩, 易脱手', '基础', [], [], []],
  ['turning', 'n.', '拐弯处，拐角处', '基础', [], [], []],
  ['tutor', 'n. /\'tju:tә/', 'n. 家庭教师, 导师, 助教, 监护人；vt. 当...的教师, 教, 指导, 约束, 克制；vi. 当家庭教师, 受家庭教师的指导', '基础', [], [], []],
  ['TV', 'n. /\'ti:\'vi:/', '电视；[计] 电视, 转移向量', '基础', [], [], []],
  ['twice', 'adv. /twais/', 'adv. 两次, 两倍', '基础', [], [], []],
  ['twin', 'n. /twin/', 'n. 双胞胎中一人, 一对非常相像的人(或物)中的一个；a. 双胞胎的, 成对的, 孪生的；vi. 生双胞胎, 成对；vt. 怀(双胞胎), 使成对', '基础', [], [], []],
  ['twist', 'v. & n. /twist/', 'n. 一扭, 扭曲, 曲折, 歪曲, 螺旋状, 新手法；vt. 拧, 扭, 捻, 编织, 使扭转, 缠绕, 盘绕, 歪曲, 使转动, 使苦恼, 使混乱, 使旋转；vi. 转向, 弯曲, 缠绕, 扭动, 呈螺旋形', '基础', [], [], []],
  ['type', 'n. vt. /taip/', 'n. 类型, 样式, 典型, 榜样, 标志, 符号, 型, 式；vi. 打字；vt. 作为代表, 测定类型, 用打字机打；[计] 类型; 键入; DOS内部命令:在屏幕上显示指定文件的内容', '基础', [], [], []],
  ['typewriter', 'n. /\'taip.raitә/', 'n. 打字机', '基础', [], [], []],
  ['typhoon', 'n. /tai\'fu:n/', 'n. 台风', '基础', [], [], []],
  ['typical', 'adj. /\'tipikl/', 'a. 典型的, 象征性的；[医] 典型的', '基础', [], [], []],
  ['typist', 'n. /\'taipist/', 'n. 打字员', '基础', [], [], []],
  ['tyre', 'n. /\'taiә/', 'n. 轮胎；vt. 装轮胎于', '基础', [], [], []],
  ['ugly', 'adj. /\'ʌgli/', 'a. 丑陋的, 邪恶的, 险恶的, 不祥的；n. 丑陋的人(或物)', '基础', [], [], []],
  ['umbrella', 'n. /ʌm\'brelә/', 'n. 伞, 雨伞, 保护伞；a. 伞的, 包罗万象的；vt. 用伞遮掩', '基础', [], [], []],
  ['unable', 'adj. /ʌn\'eibl/', 'a. 不能的, 不会的；[法] 无能力的, 无资格的, 没有办法的', '基础', [], [], []],
  ['unbearable', 'adj. /.ʌn\'bєәrәbl/', 'a. 无法忍受的, 承受不住的', '基础', [], [], []],
  ['unbelievable', 'adj. /.ʌnbi\'li:vәbl/', 'a. 难以置信的', '基础', [], [], []],
  ['uncertain', 'adj. /.ʌn\'sә:tn/', 'a. 不确定的, 无常的, 不确信的, 不可预测的；[法] 不确定的, 未定的, 不确信的', '基础', [], [], []],
  ['uncle', 'n. /ʌŋkl/', 'n. 叔父, 伯父, 姨丈', '基础', [], [], []],
  ['uncomfortable', 'adj. /.ʌn\'kʌmfәtәbl/', 'a. 不舒服的, 不自在的, 不安的', '基础', [], [], []],
  ['unconditional', 'adj. /.ʌnkәn\'diʃәnl/', 'a. 无条件的, 无限制的, 绝对的；[经] 无条件的, 无保留的', '基础', [], [], []],
  ['unconscious', 'adj. /.ʌn\'kɒnʃәs/', 'a. 未意识到的, 无意识的, 无知觉的；[医] 人事不省的, 神志丧失的; 无意识的', '基础', [], [], []],
  ['under', 'adv. & prep. /\'ʌndә/', 'prep. 在...之下, 低于；a. 下面的, 从属的；adv. 在下面', '基础', [], [], []],
  ['underground', 'adj. n. /\'ʌndәgraund/', 'n. 地下, 地铁, 地道, 秘密活动；a. 地下的, 秘密的；adv. 在地下, 秘密地', '基础', [], [], []],
  ['underline', 'v. /\'ʌndәlain/', 'vt. 在...下面划线, 作...的衬里, 强调；n. 下划线, 图下说明文字；[计] 加下划线; 下划线', '基础', [], [], []],
  ['underneath', 'prep.', '在……下面，在……底下', '基础', [], [], []],
  ['understand', 'v. /.ʌndә\'stænd/', 'vt. 理解, 了解, 领会, 听说, 懂；vi. 懂得, 认为', '基础', [], [], []],
  ['understanding', 'n. /.ʌndә\'stændiŋ/', 'n. 理解, 谅解；[法] 协商, 协议, 谅解', '基础', [], [], []],
  ['undertake', 'v. /.ʌndә\'teik/', 'vt. 试图, 从事, 保证, 承担, 同意, 接受；[化] 承包; 承担', '基础', [], [], []],
  ['undivided', 'adj. /.ʌndi\'vaidid/', 'a. 未分开的, 专一的, (组织等)未分裂的；[法] 不可分割的, 完整的, 未分割的', '基础', [], [], []],
  ['undo', 'v. /.ʌn\'du:/', 'vt. 解开, 取消, 破坏, 毁灭, 扰乱；vi. 松开；[计] 撤消', '基础', [], [], []],
  ['unemployed', 'adj.', '失业的，无工作的', '基础', [], [], []],
  ['unemployment', 'n. /.ʌnim\'plɒimәnt/', 'n. 失业, 失业人数；[经] 失业', '基础', [], [], []],
  ['unfair', 'adj. /.ʌn\'fєә/', 'a. 不公平的, 不正直的, 不正当的；[法] 不正直的, 不公平的, 偏颇的', '基础', [], [], []],
  ['unfold', 'vt. /.ʌn\'fәuld/', 'vt. 展开, 打开, 披露, 开展, 挑明；vi. 伸展, 开花, 呈现', '基础', [], [], []],
  ['unfortunate', 'adj. /.ʌn\'fɒ:tʃәnit/', 'a. 不幸的, 不合适的, 不吉利的', '基础', [], [], []],
  ['unfortunately', 'adv. /ʌn\'fɔ:tjjnәtli/', 'adv. 恐怕, 不幸的是', '基础', [], [], []],
  ['uniform', 'n. /\'ju:nifɒ:m/', 'n. 制服；a. 统一的, 一律的, 始终如一的', '基础', [], [], []],
  ['union', 'n. /\'ju:njәn/', 'n. 联盟, 联合, 结合, 工会；[化] 联合; 联管节; 活接头', '基础', [], [], []],
  ['unique', 'adj. /ju:\'ni:k/', 'a. 独一无二的, 独特的, 稀罕的', '基础', [], [], []],
  ['unit', 'n. /\'ju:nit/', 'n. 单位, 分队, 部队, 单元, 部件, 装置；a. 单位的, 单元的；[计] 单元常数; 部件', '基础', [], [], []],
  ['unite', 'v. /ju:\'nait/', 'vi. 联合, 接合, 混合；vt. 使联合, 统一, 使粘合, 使结合', '基础', [], [], []],
  ['universal', 'adj. /.ju:ni\'vә:sl/', 'a. 全世界的, 普遍的, 宇宙的, 通用的；n. 一般概念', '基础', [], [], []],
  ['universe', 'n. /\'ju:nivә:s/', 'n. 宇宙, 星系, (思想等)范围', '基础', [], [], []],
  ['university', 'n. /.ju:ni\'vә:siti/', 'n. 大学', '基础', [], [], []],
  ['unless', 'conj. /.ʌn\'les/', 'conj. 除非；prep. 除...之外', '基础', [], [], []],
  ['unlike', 'prep. /.ʌn\'laik/', 'a. 不像的, 不同的；prep. 不像, 和...不同', '基础', [], [], []],
  ['unrest', 'n. /.ʌn\'rest/', 'n. 不安的状态, 动荡的局面；[医] 不安', '基础', [], [], []],
  ['until', 'prep. & conj. /әn\'til/', 'prep. 直到, 在...以前；conj. 直到...时, 在...以前', '基础', [], [], []],
  ['unusual', 'adj. /.ʌn\'ju:ʒu:l/', 'a. 不寻常的, 罕见的, 与众不同的', '基础', [], [], []],
  ['unwilling', 'adj. /.ʌn\'wiliŋ/', 'a. 不愿意的, 勉强的；[法] 不愿意的, 勉强的, 不服从的', '基础', [], [], []],
  ['up', 'adv. adj. n. v. prep. /ʌp/', '向上；在上方；起来；在…以上 上面的，向上的，上行的 上升；上坡；上行；繁荣 举起；拿起；提高 向（高处）；向（在）……上（面）游', '基础', [], [], []],
  ['update', 'v. n.', '更新，升级 更新', '基础', [], [], []],
  ['upon', 'prep. /ә\'pɒn/', 'prep. 在...之上, 迫近, 紧接着', '基础', [], [], []],
  ['upper', 'adj. /\'ʌpә/', 'a. 上面的, 较高的, 上级的, 上院的, 穿在外面的, 北部的, 地表的, 后期的；n. 鞋帮, 上齿', '基础', [], [], []],
  ['upset', 'adj. /ʌp\'set/', 'a. 弄翻的, 混乱的, 心烦的；vt. 弄翻, 颠覆, 推翻, 打乱, 使不适, 使心烦；vi. 翻倒', '基础', [], [], []],
  ['upstairs', 'adv. /\'ʌp\'stєәz/', 'a. 楼上的；adv. 在楼上, 向楼上, 处于更高地位；n. 楼层', '基础', [], [], []],
  ['upward', 'adv. /\'ʌpwәd/', 'a. 向上的；adv. 以上', '基础', [], [], []],
  ['urban', 'adj. /\'ә:bәn/', 'a. 都市的, 住在都市的, 习惯于都市的；[法] 城市的, 都市的, 市区的', '基础', [], [], []],
  ['urge', 'v. /ә:dʒ/', 'n. 冲动, 推动力, 迫切的要求；vt. 驱策, 力劝, 竭力主张, 推动；vi. 强烈要求', '基础', [], [], []],
  ['urgent', 'adj. /\'ә:dʒәnt/', 'a. 紧急的, 急迫的, 催逼的；[经] 紧急的, 急迫的', '基础', [], [], []],
  ['use', 'n. & vt. /ju:s/', 'n. 使用, 习惯, 使用价值, 用法, 使用权；vt. 使用, 利用, 运用, 耗费；vi. 惯常', '基础', [], [], []],
  ['used', 'adj.', '用过的；旧的；二手的', '基础', [], [], []],
  ['useful', 'adj. /\'ju:sful/', 'a. 有用的, 有益的；[机] 有用的, 有效的', '基础', [], [], []],
  ['useless', 'adj. /\'ju:slis/', 'a. 无用的, 无效的, 无益的；[机] 无用, 无价值, 无效', '基础', [], [], []],
  ['user', 'n. /\'ju:zә/', 'n. 使用者；[计] 用户', '基础', [], [], []],
  ['usual', 'adj. /\'ju:ʒuәl/', 'a. 平常的, 通常的', '基础', [], [], []],
  ['vacant', 'adj. /\'veikәnt/', 'a. 空的, 空白的, 空虚的, 空闲的, 茫然的, 空缺的；[法] 空的, 空虚的, 闲暇的', '基础', [], [], []],
  ['vacation', 'n. /vei\'keiʃәn/', 'n. 假期, 休假；[法] 假期, 停审期, 休庭期', '基础', [], [], []],
  ['vague', 'adj. /veig/', 'a. 含糊的, 不清楚的, 茫然的', '基础', [], [], []],
  ['vain', 'adj. /vein/', 'a. 无价值的, 徒然的, 空虚的, 自负的, 愚蠢的', '基础', [], [], []],
  ['valid', 'adj. /\'vælid/', 'a. 有确实根据的, 有法律效力的, 正当的, 正确的；[经] 有效的', '基础', [], [], []],
  ['valley', 'n. /\'væli/', 'n. 山谷, 溪谷, 流域, 凹地；[医] 谷', '基础', [], [], []],
  ['valuable', 'adj. /\'væljuәbl/', 'a. 有价值的, 贵重的, 宝贵的, 可估价的；[经] 有价值的, 可估价的, 贵重的', '基础', [], [], []],
  ['value', 'n. /\'vælju:/', 'n. 价值, 价格, 购买力, 评价, 估价, 计算结果；vt. 评价, 估价, 重视；[计] 计算结果', '基础', [], [], []],
  ['variety', 'n. /vә\'raiәti/', 'n. 多样, 种类, 变种, 杂耍；[化] 变种', '基础', [], [], []],
  ['various', 'adj. /\'vєәriәs/', 'a. 不同的, 各种的, 多方面的, 许多的, 个别的, 杂色的；[法] 不同的, 种种的, 各式各样的', '基础', [], [], []],
  ['vary', 'v.', '变化，不同；使多样化', '基础', [], [], []],
  ['vase', 'n. /veis/', 'n. 花瓶, 瓶', '基础', [], [], []],
  ['vast', 'adj. /vɑ:st/', 'a. 巨大的, 广大的, 非常的, 大量的', '基础', [], [], []],
  ['vegetable', 'n. /\'vedʒәtәbl/', 'n. 蔬菜, 植物, 无精打采之人；a. 蔬菜的, 植物的', '基础', [], [], []],
  ['vehicle', 'n. /\'vi:ikl/', 'n. 交通工具, 车辆, 传播媒介；[化] 载体; 运载体; 漆料', '基础', [], [], []],
  ['version', 'n. /\'vә:ʒәn/', 'n. 一种描述, 版本, 译文；[计] 版本', '基础', [], [], []],
  ['vertical', 'adj. /\'vә:tikl/', 'a. 垂直的, 直立的；[医] 垂直的, 顶的, 头顶的', '基础', [], [], []],
  ['very', 'adv. /\'veri/', 'a. 真正的, 恰好的, 十足的, 特有的；adv. 非常, 完全', '基础', [], [], []],
  ['vest', 'n. /vest/', 'n. 背心, 汗背心；vt. 使穿衣服, 授予；vi. 穿衣服, 归属', '基础', [], [], []],
  ['via', 'prep. /vaiә/', 'prep. 经由, 经过, 通过；[医] 病毒灭活剂', '基础', [], [], []],
  ['vice', 'n. /vais/', 'n. 恶习, 恶行, 罪恶, 堕落, 缺陷, 恶癖, 老虎钳；vt. 钳住；prep. 代替', '基础', [], [], []],
  ['victim', 'n. /\'viktim/', 'n. 受害人, 牺牲者, 牺牲品；[法] 受害人, 被害人, 遭难者', '基础', [], [], []],
  ['victory', 'n. /\'viktәri/', 'n. 胜利, 战胜, 克服', '基础', [], [], []],
  ['video', 'n. /\'vidiәu/', 'n. 影像, 电视；a. 图像的, 电视的', '基础', [], [], []],
  ['view', 'n. /vju:/', 'n. 视野, 风景, 见解, 视力, 观看, 视图, 指望, 意图, 印象；vt. 看, 考虑, 视察, 查看, 估量；[计] 视图', '基础', [], [], []],
  ['viewer', 'n. /\'vju:ә/', 'n. 观察者, 看电视者, 视察员, 观察器；[化] 指示器', '基础', [], [], []],
  ['village', 'n. /\'vilidʒ/', 'n. 村庄；a. 乡村的, 村庄的', '基础', [], [], []],
  ['villager', 'n. /\'vilidʒә/', 'n. 村民', '基础', [], [], []],
  ['vinegar', 'n. /\'vinigә/', 'n. 醋, 尖酸刻薄；vt. 加醋于', '基础', [], [], []],
  ['violence', 'n. /\'vaiәlәns/', 'n. 猛烈, 暴力, 暴虐, 暴行；[法] 暴行, 暴力, 暴乱', '基础', [], [], []],
  ['violent', 'adj. /\'vaiәlәnt/', 'a. 暴力的, 猛烈的, 激烈的, 极端的, 凶暴的', '基础', [], [], []],
  ['violin', 'n. /.vaiә\'lin/', 'n. 小提琴', '基础', [], [], []],
  ['virtue', 'n. /\'vә:tju:/', 'n. 德行, 美德, 优点, 功效, 效力；[法] 美德, 贞操, 优点', '基础', [], [], []],
  ['virus', 'n. /\'vaiәrәs/', 'n. 病毒, 滤过性病毒, 毒害；[化] 病毒', '基础', [], [], []],
  ['visa', 'n. /\'vi:zә/', 'n. 签证；vt. 签发', '基础', [], [], []],
  ['visit', 'n. & vt. /\'vizit/', 'n. 拜访, 访问, 游览, 视察；vt. 拜访, 访问, 参观, 视察, 降临；vi. 访问, 参观, 闲谈', '基础', [], [], []],
  ['visitor', 'n. /\'vizitә/', 'n. 参观者, 游客, 访客；[法] 视察人, 检视人, 检查员', '基础', [], [], []],
  ['visual', 'adj. /\'viʒuәl/', 'a. 视觉的；[医] 视觉的, 视力的, 视觉性记忆优势者', '基础', [], [], []],
  ['vital', 'adj. /\'vaitl/', 'a. 生命的, 重要的, 充满活力的, 生死攸关的, 致命的；[医] 生命的, 生活的, 生活上必需的, 紧要的', '基础', [], [], []],
  ['vivid', 'adj. /\'vivid/', 'a. 生动的, 鲜明的, 鲜艳的, 活泼的, 逼真的, 清晰的', '基础', [], [], []],
  ['vocabulary', 'n. /vә\'kæbjulәri/', 'n. 词汇(量), 词汇表；[计] 词表', '基础', [], [], []],
  ['voice', 'n. /vɒis/', 'n. 声音, 嗓音, 嗓子, 愿望, 发言权, 表达, 喉舌, 语态；vt. 表达, 吐露, 调音', '基础', [], [], []],
  ['volcano', 'n. /vɒl\'keinәu/', 'n. 火山', '基础', [], [], []],
  ['volleyball', 'n. /\'vɒlibɒ:l/', 'n. 排球', '基础', [], [], []],
  ['voluntary', 'adj. /\'vɒlәntәri/', 'a. 自动的, 自愿的, 故意的, 志愿的, 自发的；n. 自愿行动, 志愿者, 自由调', '基础', [], [], []],
  ['volunteer', 'n. & v. /.vɒlәn\'tiә/', 'n. 志愿者；a. 志愿的；v. 自愿', '基础', [], [], []],
  ['vote', 'vi. /vәut/', 'n. 投票, 选举, 选票, 表决, 选举权, 得票数；vi. 投票, 选举；vt. 投票选举, 投票决定, 公认, 使投票', '基础', [], [], []],
  ['voyage', 'n. /\'vɒiidʒ/', 'n. 航行, 航海, 航程, 旅行, 航空；vi. 航海, 航行；vt. 航行越过, 飞过', '基础', [], [], []],
  ['wag', 'v. /wæg/', 'vt. 摇摆, 摇动, 饶舌；vi. 摆动, 喋喋不休；n. 摇摆, 爱说笑打趣的人', '基础', [], [], []],
  ['wage', 'n. /weidʒ/', 'n. 工资, 报应, 报偿；vt. 开展, 进行；vi. 进行', '基础', [], [], []],
  ['waist', 'n. /weist/', 'n. 腰部, 腰；[医] 腰', '基础', [], [], []],
  ['wait', 'vi. /weit/', 'n. 等待, 等候；vt. 等候, 期待, 延缓, 伺候, 推迟；vi. 等, 等候, 耽搁, 伺候用餐；[计] 等待', '基础', [], [], []],
  ['waiter', 'n. /\'weitә/', '（餐厅）男服务员', '基础', [], [], []],
  ['waiting', 'n.', '候诊室，候车室', '基础', [], [], []],
  ['waitress', 'n. /\'weitris/', 'n. 女侍者, 女服务员', '基础', [], [], []],
  ['wake', 'v. /weik/', 'vt. 叫醒, 激发；vi. 醒来, 醒着, 觉醒, 活跃起来；n. 守侯, 守夜, 尾迹, 痕迹', '基础', [], [], []],
  ['walk', 'n. & v. /wɒ:k/', 'n. 走, 散步, 步行, 行走的路程, 竞走, 散步场所；vi. 走路, 步行, 处世；vt. 走过, 遛, 使走, 护送...走', '基础', [], [], []],
  ['wall', 'n. /wɒ:l/', 'n. 墙, 墙壁, 垣, 内壁, 分界物, 屏障；a. 墙的；vt. 给...建墙, 禁闭, 用墙围住；[计] 背景墙', '基础', [], [], []],
  ['wallet', 'n. /\'wɒlit/', 'n. 皮夹；[法] 皮包, 皮夹, 钱袋', '基础', [], [], []],
  ['wander', 'vi. /\'wɒndә/', 'vi. 游荡, 漫步, 徘徊, 迷路, 离题, 蜿蜒；vt. 在...漫游', '基础', [], [], []],
  ['want', 'vt. /wɒnt/', 'n. 需要的东西, 缺乏, 贫困, 需要；vt. 要, 希望, 应该, 缺少；vi. 生活困苦, 需要, 缺少', '基础', [], [], []],
  ['war', 'n. /wɒ:/', 'n. 战争, 战争状态, 战术, 军事, 冲突, 斗争, 竞争；vi. 进行战争, 作战, 打仗, 战斗；a. 战争的, 战时用的', '基础', [], [], []],
  ['ward', 'n. /wɒ:d/', 'n. 病房, 守卫, 保卫, 保护, 监护, 牢房, 行政区, 锁孔内的榫舌；vt. 使入病房, 守护, 保卫', '基础', [], [], []],
  ['warehouse', 'n. /\'wєәhaus/', 'n. 仓库, 货栈, 大商店；vt. 储入仓库', '基础', [], [], []],
  ['warm', 'adj. /wɒ:m/', 'a. 暖和的, 暖的, 温暖的, 热烈的, 兴奋的, 激烈的, 多情的, 色情的；vt. 使温暖, 弄热, 使兴奋, 使充满仇恨；vi. 变暖和, 变温暖, 取暖, 激动, 同情, 爱好；n. 暖, 保暖物', '基础', [], [], []],
  ['warmth', 'n. /wɒ:mθ/', 'n. 温暖, 温情, 暖和, 激动, 生气', '基础', [], [], []],
  ['warn', 'vt.', '警告，预先通知', '基础', [], [], []],
  ['wash', 'n. v. /wɒʃ/', 'n. 洗, 洗涤, 冲洗, 洗的衣服, 冲积物, 洼地；vt. 洗, 洗涤, 洗清, 用水冲洗, 流过, 弄湿, 粉刷, 镀金属薄层于；vi. 洗涤, 洗澡, 被冲蚀, 漂浮', '基础', [], [], []],
  ['washroom', 'n. /\'wɒʃrum/', 'n. 盥洗室', '基础', [], [], []],
  ['waste', 'n. & vt. /weist/', 'n. 浪费, 废物, 损耗, 消耗, 荒地, 垃圾, 地面风化物；a. 废弃的, 荒芜的, 多余的；vt. 浪费, 消耗, 使荒芜；vi. 浪费, 消耗, 变消瘦', '基础', [], [], []],
  ['watch', 'vt. n. /wɒtʃ/', 'n. 观察, 手表, 看守, 守护, 监视, 值班人；vt. 看, 注视, 照顾, 看守, 守护, 监视；vi. 观看, 注视, 守侯', '基础', [], [], []],
  ['water', 'n. v. /\'wɒ:tә/', 'n. 水, 雨水, 海水, 水位, 水面, 流水；vt. 给...浇水, 供以水, 注入水, 使湿；vi. 流泪, 流口水, 加水；a. 水的, 水上的, 水生的, 含水的', '基础', [], [], []],
  ['watermelon', 'n. /\'wɒtә.melәn/', 'n. 西瓜', '基础', [], [], []],
  ['wave', 'n. v. /weiv/', 'n. 波, 波浪, 波动, 起伏, 高潮, 潮涌, 挥手致意, (气压)突变；vi. 波动, 飘动, 挥手示意, 起伏；vt. 使波动, 使飘扬, 挥舞, 使成波浪形', '基础', [], [], []],
  ['way', 'n. /wei/', 'n. 路, 路线, 路途, 方法, 道路, 情形, 规模, 习惯, 行业, 方面；adv. 远远地, 非常', '基础', [], [], []],
  ['we', 'pron. /wi:/', 'pron. 我们', '基础', [], [], []],
  ['weak', 'adj. /wi:k/', 'a. 不牢固的, 弱的, 虚弱的, 软弱的, 无力的, 无权力的, (论据等)不充分的；[经] 疲软的', '基础', [], [], []],
  ['weakness', 'n. /\'wi:knis/', 'n. 虚弱, 薄弱, 弱点；[经] 欲振乏力', '基础', [], [], []],
  ['wealth', 'n. /welθ/', 'n. 财富, 资源, 财产, 丰富, 富裕, 大量；[经] 财富', '基础', [], [], []],
  ['wealthy', 'adj. /\'welθi/', 'a. 富有的, 丰裕的, 充分的', '基础', [], [], []],
  ['weapon', 'n.', '武器，兵器', '基础', [], [], []],
  ['wear', 'v. /wєә/', 'n. 穿着, 戴, 使用, 耗损, 服装, 耐久性；vt. 穿着, 戴, 留(须、发等), 呈现, 磨损, 磨成, 耗损, 使疲乏, 消磨；vi. 磨损, 变旧, 耐久, 渐变, 渐渐消失', '基础', [], [], []],
  ['weather', 'n. /\'weðә/', 'n. 天气, 气象, 处境；a. 迎风的；vt. 使受风吹雨打, 侵蚀, 使风化, 经受住；vi. 风化, 受侵蚀, 经受风雨', '基础', [], [], []],
  ['weatherman', 'n. /\'weðәmæn/', 'n. 气象员；天气预报员', '基础', [], [], []],
  ['web', 'n. /web/', 'n. 网, 蛛丝, 蹼, 织物, 圈套, 卷筒纸；vi. 结网, 形成网；vt. 织蜘蛛网于, 使落入圈套', '基础', [], [], []],
  ['website', 'n.', 'n. 网站（全球资讯网的主机站）', '基础', [], [], []],
  ['wedding', 'n. /\'wediŋ/', 'n. 婚礼, 结婚, 结婚周年纪念日, 结合；[法] 结婚, 婚礼, 结婚纪念日', '基础', [], [], []],
  ['Wednesday', 'n. /\'wenzdi/', 'n. 星期三', '基础', [], [], []],
  ['weed', 'n. /wi:d/', 'n. 杂草, 野草；vi. 除草；vt. 除...的草, 剔除', '基础', [], [], []],
  ['week', 'n. /wi:k/', 'n. 星期, 周', '基础', [], [], []],
  ['weekday', 'n. /\'wi:kdei/', 'n. 周日, 平日；[计] 工作日', '基础', [], [], []],
  ['weekend', 'n. /\'wi:kend/', 'n. 周末, 周末休假', '基础', [], [], []],
  ['weekly', 'adj. /\'wi:kli/', 'n. 周刊, 周报；a. 每周的, 一周一次的, 周刊的；adv. 每周, 一周一次', '基础', [], [], []],
  ['weep', 'v. /wi:p/', 'n. 哭, 哭泣；vi. 哭泣, 流泪, 哀悼, 滴落；vt. 哭着使..., 悲叹, 滴下', '基础', [], [], []],
  ['weigh', 'vt. /wei/', 'vt. 称...重量, 衡量, 把...压弯, 考虑, 权衡, 起锚；vi. 称分量, 有意义, 重压, 起锚；n. 过秤, 称分量', '基础', [], [], []],
  ['weight', 'n. /weit/', 'n. 重, 重量, 体重, 砝码, 重大, 影响, 力量；vt. 加重量于, 压迫, 使加权, 称重量；[计] 粗细', '基础', [], [], []],
  ['weird', 'adj.', '神秘的；奇特的；不可思议的', '基础', [], [], []],
  ['welcome', 'int. & n. & v. adj. /\'welkәm/', 'n. 欢迎, 欢迎词；a. 受欢迎的, 可随意的, 可喜的；vt. 欢迎, 接待；interj. 欢迎', '基础', [], [], []],
  ['welfare', 'n. /\'welfєә/', 'n. 福利, 安宁, 幸福, 福利事业；a. 福利的', '基础', [], [], []],
  ['well', 'adv. adj. int. n. /wel/', 'n. 井, 泉水, 源泉, 好；v. 涌出；a. 健康的, 良好的, 适宜的, 恰当的；adv. 很好地, 适当地, 好意地, 很, 完全；interj. 好啦', '基础', [], [], []],
  ['west', 'adj. adv. n. /west/', 'n. 西方, 西部；a. 西方的, 向西的；adv. 向西, 自西方, 在西方', '基础', [], [], []],
  ['western', 'adj. /\'westәn/', 'n. 西方人, 西部片, 西部小说；a. 向西方的, 来自西方的, 西方的, 西洋的, 西部的', '基础', [], [], []],
  ['westwards', 'adv. /\'westwәdz/', 'adv. 向西', '基础', [], [], []],
  ['wet', 'adj. /wet/', 'n. 湿气, 潮湿, 水分, 雨天；a. 湿的, 潮的, 搞错的, 下雨的, 反对禁酒的；vi. 变湿；vt. 使...湿', '基础', [], [], []],
  ['whale', 'n. /hweil/', 'n. 鲸；vi. 捕鲸；vt. 使惨败, 猛揍', '基础', [], [], []],
  ['what', 'pron. adj. /hwɒt/', 'pron. 什么；interj. 怎么, 多么；a. 什么的；adv. 到什么程度', '基础', [], [], []],
  ['whatever', 'conj. & pron. /hwɒt\'evә/', 'pron. 无论什么', '基础', [], [], []],
  ['wheat', 'n. /hwi:t/', 'n. 小麦', '基础', [], [], []],
  ['wheel', 'n. /hwi:l/', 'n. 轮子, 车轮, 轮, 方向盘, 旋转, 机构, 重要人物；vt. 使旋转, 转动, 使转向；vi. 旋转, 转弯, 盘旋', '基础', [], [], []],
  ['when', 'conj. adv. /hwen/', 'conj. 当...的时候；adv. 何时, 什么时候；pron. 什么时侯；n. 时间', '基础', [], [], []],
  ['whenever', 'conj. /hwen\'evә/', 'conj. 每当；adv. 不论何时, 每逢', '基础', [], [], []],
  ['where', 'adv. /hwєә/', 'adv. 在哪里；pron. 哪里；n. 地点', '基础', [], [], []],
  ['wherever', 'conj. /hwєәr\'evә/', 'adv. 无论哪里', '基础', [], [], []],
  ['whether', 'conj. /\'hweðә/', 'conj. 是否, 不论；pron. 两个中的哪一个', '基础', [], [], []],
  ['which', 'pron. adj. /hwitʃ/', '那（哪）一个；那（哪）一些 这（哪）个；这（哪）些；无论哪个（些）', '基础', [], [], []],
  ['whichever', 'pron. /hwitʃ\'evә/', 'pron. 无论那一个, 任何一个', '基础', [], [], []],
  ['while', 'conj. n. /hwail/', 'n. 一会儿, (一段)时间；conj. 当...的时候, 虽然；vt. 消磨', '基础', [], [], []],
  ['whisper', 'v. /\'hwispә/', 'n. 耳语, 密谈, 谣传, 沙沙声；vi. 耳语, 密谈, 沙沙地响；vt. 低声说', '基础', [], [], []],
  ['whistle', 'n. /\'hwisl/', 'n. 口哨, 汽笛, 啸啸声, 口哨声；vi. 吹口哨, 鸣汽笛, 发嘘嘘声；vt. 用口哨或吹哨传意, 用口哨演奏', '基础', [], [], []],
  ['white', 'adj. n. /hwait/', 'n. 白色, 洁白, 眼白, 白种人, 蛋白；a. 白色的, 纯洁的, 白种的, 苍白的, 空白的, 幸运的', '基础', [], [], []],
  ['who', 'pron. /hu:/', 'pron. 谁', '基础', [], [], []],
  ['whole', 'adj. /hәul/', 'n. 全部, 全体, 整体, 完全之体系；a. 所有的, 完整的, 完全的, 纯粹的', '基础', [], [], []],
  ['whom', 'pron. /hu:m/', '（who 的宾格）', '基础', [], [], []],
  ['whose', 'pron. /hu:z/', 'pron. 谁的', '基础', [], [], []],
  ['why', 'adv. & int. /hwai/', '为什么，你难道不知道（表示反驳、不耐烦等）', '基础', [], [], []],
  ['wide', 'adj. /waid/', 'a. 宽的, 广阔的, 普遍的, 宽阔的, 广泛的, 一般的；adv. 广阔地, 遍及各处地, 广泛地；n. 大千世界', '基础', [], [], []],
  ['widespread', 'adj. /\'waidspred/', 'a. 充分伸展的, 广布的, 普及的, 流传广的', '基础', [], [], []],
  ['widow', 'n.', '寡妇', '基础', [], [], []],
  ['wife', 'n. /waif/', 'n. 妻子, 太太, 夫人；[法] 妻子, 已婚妇女', '基础', [], [], []],
  ['wild', 'adj. /waild/', 'n. 荒野, 荒地；a. 野性的, 野蛮的, 野生的, 失控的, 任性的, 杂乱的, 轻率的, 狂热的, 疯狂的；adv. 狂暴地, 失控地', '基础', [], [], []],
  ['wildlife', 'n. /\'waildlaif/', 'n. 野生动植物', '基础', [], [], []],
  ['will', 'n. v. /wil/', 'n. 意志, 决心, 意愿, 意向, 干劲, 遗嘱；vt. 用意志的力量驱使, 决意, 愿意, 立遗嘱；vi. 下决心, 愿意；aux. 将, 愿意, 必须', '基础', [], [], []],
  ['willing', 'adj. /\'wiliŋ/', 'a. 乐意的, 自愿的, 甘愿的', '基础', [], [], []],
  ['win', 'v. n. /win/', 'vt. 赢得, 打胜, 成功；vi. 获胜, 达到, 影响；n. 胜利, 赢, 收益', '基础', [], [], []],
  ['wind', 'n. vt. /wind/', 'n. 风, 气息, 气味, 呼吸, 风声, 趋势, 空谈, 卷绕, 弯曲；vt. 使通风, 嗅出, 使喘气, 吹号角, 上发条, 缠绕, 包, 绞起, 吊起, 使弯曲, 使迂回；vi. 嗅出猎物, 吹响号角, 卷曲, 蜿蜒, 迂回, 缠绕', '基础', [], [], []],
  ['window', 'n. /\'windәu/', 'n. 窗户, 窗子, 窗口；vt. 给...开窗；[计] 窗口', '基础', [], [], []],
  ['windy', 'adj. /\'windi/', 'a. 多风的, 风强的, 腹胀的, 吹牛的', '基础', [], [], []],
  ['wine', 'n. /wain/', 'n. 葡萄酒, 果酒, 暗红色；v. (请)喝酒', '基础', [], [], []],
  ['wing', 'n. /wiŋ/', 'n. 翅膀, 翼, 机翼, 派别；vt. 给...装上翼, 飞过, 使飞, 空运, 增加...速度；vi. 飞行', '基础', [], [], []],
  ['winner', 'n. /\'winә/', 'n. 胜利者, 优胜者；[法] 取胜者', '基础', [], [], []],
  ['winter', 'n. /\'wintә/', 'n. 冬季, 萧条期, 衰退期；a. 冬天的；vt. 使度过冬天；vi. 过冬', '基础', [], [], []],
  ['wipe', 'v. /waip/', 'n. 擦拭, 用力打, 凸轮；vt. 擦, 揩, 消灭, 涂上, 拭去；vi. 擦, 打', '基础', [], [], []],
  ['wire', 'n. /\'waiә/', 'n. 电线, 电报, 电信, 铁丝网, 金属丝；vt. 用金属丝捆扎, 拍电报；vi. 打电报', '基础', [], [], []],
  ['wisdom', 'n. /\'wizdәm/', 'n. 智慧, 明智行为, 学识, 名言, 贤人', '基础', [], [], []],
  ['wise', 'adj. /waiz/', 'a. 明智的, 慎虑的, 聪明的, 博学的, 狡猾的, 机灵的；vi. 知道；vt. 教导, 告诉, 劝导；n. 方法, 方式；[计] 教育信息系统', '基础', [], [], []],
  ['wish', 'n. vt. /wiʃ/', 'n. 希望, 愿望, 祝愿, 命令, 请求；vt. 愿, 想要, 希望, 祝愿；vi. 希望', '基础', [], [], []],
  ['with', 'prep. /wið/', 'prep. 和...在一起, 以, 由于', '基础', [], [], []],
  ['withdraw', 'v. /wið\'drɒ:/', 'vt. 撤回, 取回, 撤消, 使撤退, 拉开, 移开；vi. 撤退, 离开', '基础', [], [], []],
  ['within', 'prep. /wi\'ðin/', 'n. 内部, 里头；adv. 在内部, 在内心里；prep. 在...之内', '基础', [], [], []],
  ['without', 'prep. /wi\'ðaut/', 'prep. 没有, 不, 在...之外；adv. 在外面, 户外；n. 外面, 外部', '基础', [], [], []],
  ['witness', 'v. & n. /\'witnis/', 'n. 证人, 目击者, 证据, 证词；vt. 目击, 作证, 证明, 表明；vi. 作证人, 作为证据', '基础', [], [], []],
  ['wolf', 'n. /wulf/', 'n. 狼, 残忍贪婪之人, 极度穷困；vt. 狼吞虎咽, 大吃', '基础', [], [], []],
  ['woman', 'n. /\'wumәn/', 'n. 女人, 妇女, 女仆；a. 女用的, 女性的, 妇女的；vt. 贬称...为女人, 使成女人腔', '基础', [], [], []],
  ['wonder', 'v. n. /\'wʌndә/', 'n. 奇迹, 惊奇, 惊愕；vt. 惊奇, 想知道；vi. 惊讶, 怀疑', '基础', [], [], []],
  ['wonderful', 'adj. /\'wʌndәful/', 'a. 令人惊奇的, 奇妙的, 极好的', '基础', [], [], []],
  ['wood', 'n. /wud/', 'n. 木材, 木制品；vt. 植林于, 给...添加木柴；vi. 收集木材', '基础', [], [], []],
  ['wooden', 'adj. /\'wudn/', 'a. 木制的, 呆笨的, 木然的', '基础', [], [], []],
  ['wool', 'n.', '羊毛，羊绒', '基础', [], [], []],
  ['woollen', 'adj. /\'wulin/', 'n. 毛织品；a. 羊毛制的', '基础', [], [], []],
  ['word', 'n. /wә:d/', 'n. 话, 消息, 词, 诺言, 命令；vt. 用言辞表达；[计] 字', '基础', [], [], []],
  ['work', 'n. vi. /wә:k/', 'n. 工作, 劳动, 职业, 行为, 功, 作品, 成果, 产品, 工程；vi. 工作, 劳动, 做, 运转, 起作用, 被加工；vt. 使工作, 使转动, 开动, 使用, 经营, 使逐渐变得, 造成', '基础', [], [], []],
  ['worker', 'n. /\'wә:kә/', 'n. 工人, 劳动者；[经] 工人, 劳工, 劳动者', '基础', [], [], []],
  ['world', 'n. /wә:ld/', 'n. 世界, 地球, 宇宙, 万物, 世人, 人间, 领域, 世事, 世故, 社会生活, 大量；[法] 世界, 地球, 世人', '基础', [], [], []],
  ['worldwide', 'adj. /\'wә:ldwaid/', '遍及全球的，世界范围的', '基础', [], [], []],
  ['worm', 'n. /wә:m/', 'n. 虫, 蠕虫, 小人物, 螺纹, 蜗杆；vi. 蠕行, 慢慢前进；vt. 使蠕行, 慢慢地走, 除虫；[计] 蠕虫病毒', '基础', [], [], []],
  ['worn', 'adj. /wɒ:n/', 'a. 用旧的, 穿旧的；wear的过去分词', '基础', [], [], []],
  ['worried', 'adj. /\'wʌrid/', 'a. 担心的, 闷闷不乐的', '基础', [], [], []],
  ['worry', 'n. & v. /\'wʌri/', 'n. 担心, 烦恼, 忧虑, 苦恼, 撕咬；vt. 使烦恼, 使焦虑, 使苦恼, 困扰, 折磨, 撕咬；vi. 烦恼, 担心, 撕咬', '基础', [], [], []],
  ['worth', 'adj. /wә:θ/', 'n. 价值, 财产；a. 值...的, 值得的', '基础', [], [], []],
  ['worthwhile', 'adj. /\'wә:θ\'hwail/', 'a. 值得花时间的, 值得做的, 有真实价值的', '基础', [], [], []],
  ['worthy', 'adj. /\'wә:ði/', 'n. 杰出人物；a. 有价值的, 可敬的, 值得的', '基础', [], [], []],
  ['would', 'v. /wud/', '（will 的过去时）将会，打算，想要，过去常常', '基础', [], [], []],
  ['wound', 'vt. n. /wu:nd/', 'n. 创伤, 伤口, 伤疤, 伤害, 痛苦；vt. 伤害, 损害, 使受伤；vi. 打伤, 伤害；wind的过去式和过去分词', '基础', [], [], []],
  ['wrap', 'vt.', '包，裹', '基础', [], [], []],
  ['wrinkle', 'n. /\'riŋkl/', 'n. 皱纹, 妙计, 方法, 技巧；vi. 起皱；vt. 使起皱纹', '基础', [], [], []],
  ['wrist', 'n. /rist/', 'n. 手腕, 腕关节；[医] 腕', '基础', [], [], []],
  ['write', 'v. /rait/', 'vt. 书写, 著述, 写, 写满, 写信给；vi. 写, 写字, 写信, 写作, 作曲；[计] 书写器', '基础', [], [], []],
  ['wrong', 'adj. /rɒŋ/', 'a. 错误的, 不正当的, 失常的；adv. 错误地', '基础', [], [], []],
  ['Xray', 'n.', 'X射线；X光', '基础', [], [], []],
  ['yard', 'n. /jɑ:d/', 'n. 码, 庭院, 工场；[化] 堆置场', '基础', [], [], []],
  ['yawn', 'v. /jɒ:n/', 'n. 哈欠；vi. 打哈欠, 裂开；vt. 打着哈欠说', '基础', [], [], []],
  ['yeah', 'adv.', '是', '基础', [], [], []],
  ['year', 'n. /jiә/', 'n. 年, 年度, 年龄；[经] 年度', '基础', [], [], []],
  ['yell', 'v. /jel/', 'vi. 叫喊, 大叫, (齐声)呐喊欢呼；vt. 喊叫着说；n. 叫声, 喊声, 呐喊', '基础', [], [], []],
  ['yellow', 'adj. /\'jelәu/', 'n. 黄色；a. 黄色的', '基础', [], [], []],
  ['yes', 'adv. /jes/', 'adv. 是；n. 是, 同意；v. 同意', '基础', [], [], []],
  ['yesterday', 'n. & adv. /\'jestәdi/', 'n. 昨天；adv. 昨天', '基础', [], [], []],
  ['yet', 'adv. /jet/', 'adv. 还, 尚, 仍然, 已经, 然而；conj. 然而', '基础', [], [], []],
  ['yoghurt', 'n. /\'jәugә:t/', 'n. 酸乳, 酸奶', '基础', [], [], []],
  ['you', 'pron. /ju:/', 'pron. 你, 你们', '基础', [], [], []],
  ['young', 'adj. /jʌŋ/', 'a. 年轻的, 无经验的, 朝气蓬勃的；n. 青年们, 幼小动物, 崽', '基础', [], [], []],
  ['your', 'pron. /juә/', 'pron. 你的, 你们的', '基础', [], [], []],
  ['yours', 'pron. /juәz/', 'pron. 你的(东西), 你们的(东西)', '基础', [], [], []],
  ['yourself', 'pron. /juә\'self/', 'pron. 你自己', '基础', [], [], []],
  ['yourselves', 'pron. /jɔ:\'selvz,jjә-,jә-/', 'pron. 你们自己', '基础', [], [], []],
  ['youth', 'n. /ju:θ/', 'n. 年轻, 青年时代, 青年们, 青春；[法] 青年, 青年时期, 青春时期', '基础', [], [], []],
  ['zebra', 'n. /\'zi:brә/', 'n. 斑马', '基础', [], [], []],
  ['zero', 'n. & num. /\'ziәrәu/', 'n. 零, 零点, 零度, 无, 乌有, 最低点；a. 零的, 没有的；vt. 调零, 对(炮火等)作协调校正；[计] 零', '基础', [], [], []],
  ['zip', 'v. & n. /zip/', 'n. 尖啸声, 拉链, 活力；vt. 给...以速度, 使增加活力, 拉(拉链)；vi. 有力而迅速地行动, 嘘嘘地响, 拉拉链', '基础', [], [], []],
  ['zone', 'n. /zәun/', 'n. 地带, 带, 地区；vt. 环绕, 使分成地带；vi. 分成区；[计] 卡片顶部的三行区; 区; 区域', '基础', [], [], []],
  ['zoo', 'n. /zu:/', 'n. 动物园', '基础', [], [], []],
  ['zoom', 'v. /zu:m/', 'n. 急速上升, 变焦摄影, 嗡嗡声；vi. 猛增, 急速上升, 摄象机移动；vt. 使摄象机移动；[计] 缩放', '基础', [], [], []],
];


const builtInBooks = [
  {
    id: 'gaokao-3500',
    name: '高考3500词',
    editable: false,
    items: makeAllItems(seedWords3500, 'word')
  },
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
      ['benefit','n./v.','好处；受益','高频',['benefit from'],['作文高频'],['Regular exercise has many benefits for both body and mind.']],
      ['challenge','n./v.','挑战','高频',['face a challenge'],['challenging adj.有挑战性的'],['The task is challenging but meaningful.']],
      ['concern','n./v.','担心；涉及','高频',['be concerned about 担心'],['concerning prep.关于'],['Parents are concerned about safety.']],
      ['contribute','v.','贡献；促成','高频',['contribute to 有助于'],['to 是介词'],['Everyone should contribute to protecting the environment.']],
      ['convenient','adj.','方便的','高频',['It is convenient for sb to do'],['不能说 sb is convenient'],['It is convenient for us to shop online.']],
      ['determine','v.','决定；确定','高频',['be determined to do 决心做'],['determination n.'],['Scientists determined the age of the fossil using carbon dating.']],
      ['devote','v.','奉献；投入','高频',['devote oneself to doing'],['to 是介词'],['He devoted his entire life to studying ancient Chinese history.']],
      ['evidence','n.','证据','高频',['there is evidence that'],['不可数名词常考'],['There is evidence that sleep affects memory.']],
      ['focus','n./v.','焦点；集中','高频',['focus on 集中于'],['作文高频'],['Focus on what you can control.']],
      ['impress','v.','给……留下印象','高频',['be impressed by/with'],['impression n.'],['The speech impressed everyone deeply.']],
      ['influence','n./v.','影响','高频',['have an influence on'],['affect 动词；effect/influence 名词'],['Parents have a great influence on their children\'s development.']],
      ['involve','v.','涉及；包含','高频',['be involved in 参与'],['后接 doing'],['The project involves students from three different schools.']],
      ['opportunity','n.','机会','高频',['have an opportunity to do'],['chance/opportunity 辨析'],['The contest offers an opportunity to learn.']],
      ['prevent','v.','阻止；预防','高频',['prevent sb from doing'],['被动 from 不可省'],['Vaccines help prevent many serious diseases.']],
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
    name: '熟词生义(150个)',
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
      ['earn','v.','赢得','生义',['常见义：赚得'],['earn respect 赢得尊重'],['She earned enough money to pay for her college tuition.']],
      ['observe','v.','遵守','生义',['常见义：观察'],['observe the rules 遵守规则'],['We must observe the law.']],
      ['plant','n.','工厂；设备','生义',['常见义：植物'],['a power plant 发电厂'],['The plant was closed.']],
      ['position','v.','定位','生义',['常见义：位置/职位'],['position yourself 定位自己'],['She positioned herself near the door.']],
      ['read','v.','解读；理解','生义',['常见义：阅读'],['read one\'s mind 看出心思'],['I can read your expression.']],
      ['rest','v.','依靠','生义',['常见义：休息'],['rest on 依赖'],['You should rest for a while after running the marathon.']],
      ['sound','adj.','合理的','生义',['常见义：声音/听起来'],['sound advice 合理的建议'],['The alarm sounded at exactly seven in the morning.']],
      ['tell','v.','分辨','生义',['常见义：告诉'],['tell the difference 分辨'],['Can you tell me the time, please?']],
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
  try {
    const raw = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    // 兼容旧数据：如果 key 包含 '-' 说明是旧的 item.id 格式，尝试转换为 term-based
    const hasOldKeys = Object.keys(raw).some(k => k.includes('-'));
    // 检查是否有非小写 key（旧数据大小写敏感迁移）
    const hasMixedCase = Object.keys(raw).some(k => k !== k.toLowerCase());
    if (hasOldKeys || hasMixedCase) {
      const converted = {};
      Object.entries(raw).forEach(([k, v]) => {
        let key = k;
        if (k.includes('-')) {
          // 旧格式 key 如 "word-0-abandon"，提取 term（最后一个 '-' 之后的部分）
          const term = k.split('-').pop();
          if (term) key = term;
        }
        // 统一转为小写，确保大小写不敏感匹配
        key = key.toLowerCase();
        converted[key] = v;
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

// 提取词干（去掉常见词性后缀），用于词族关联
function getStem(word) {
  if (!word || word.length < 3) return word;
  const suffixes = ['fully', 'fully', 'tion', 'sion', 'ment', 'ness', 'ity', 'ly', 'ful', 'less', 'ous', 'ive', 'able', 'ible', 'al', 'ic', 'er', 'or', 'ist', 'ize', 'ise', 'en', 'ed', 'ing', 'y'];
  for (const s of suffixes) {
    if (word.endsWith(s) && word.length > s.length + 2) {
      let stem = word.slice(0, -s.length);
      // 处理双写辅音：如 stopped → stop
      if (/([bcdfghjklmnpqrstvwxz])\1$/.test(stem)) stem = stem.slice(0, -1);
      // 处理 y → i：如 happiness → happy (stem=happi, 还原为 happy)
      if (stem.endsWith('i') && !/^[aeiou]/.test(word)) {
        const withY = stem.slice(0, -1) + 'y';
        if (withY.length >= 2) return withY;
      }
      // 处理 e 还原：如 beautiful → beauty (beauti → beauty)
      if (stem.endsWith('i') && word.endsWith('ful')) {
        const withY = stem.slice(0, -1) + 'y';
        if (withY.length >= 2) return withY;
      }
      return stem;
    }
  }
  return word;
}

// 查找词族：与给定单词同一词根的不同形式
function findWordFamily(term, items) {
  const seen = new Set([term]);
  const related = [];
  const termStem = getStem(term);

  // 收集当前词库中所有有效的 term
  const termSet = new Set(items.map(i => i.term));

  for (const item of items) {
    if (termKey(item.term) === termKey(term) || seen.has(termKey(item.term))) continue;
    const otherStem = getStem(item.term);
    // 匹配规则：
    // 1. 当前词是另一个词的词干（如 success → successful）
    // 2. 两个词共享同一个词干（如 successful 和 successfully）
    // 3. 另一个词是当前词的词干（如 successful → success）
    if (item.term.startsWith(term) || term.startsWith(item.term) ||
        otherStem === term || otherStem === termStem ||
        termStem === item.term || termStem === otherStem) {
      related.push(item);
      seen.add(item.term);
    }
  }

  // 按词性分组排序
  const posOrder = { 'n.': 1, 'v.': 2, 'adj.': 3, 'adv.': 4 };
  related.sort((a, b) => {
    const oa = posOrder[a.pos] || 99;
    const ob = posOrder[b.pos] || 99;
    if (oa !== ob) return oa - ob;
    return a.term.localeCompare(b.term);
  });

  return related.slice(0, 12); // 最多显示12个关联词
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

// 获取简短释义（用于背诵页选项），只取常见意思
function getShortMeaning(text) {
  if (!text) return '';
  const stripped = stripPosPrefix(text);
  // 如果去除词性后还是很长，只取第一个主要义项（按中文分号或逗号分隔）
  if (stripped.length > 12) {
    // 尝试按中文分号/逗号分隔取第一个义项
    const first = stripped.split(/[，；;]/)[0].trim();
    if (first && first.length >= 2) return first;
  }
  return stripped;
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

async function extractPptxText(file) {
  try {
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
  } catch (e) { throw new Error('PDF 解析失败: ' + e.message); }
}

async function extractDocxText(file) {
  try {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const xml = await zip.files['word/document.xml']?.async('text');
    if (!xml) throw new Error('DOCX 文件结构异常');
    return cleanOcrText(xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'"));
  } catch (e) { throw new Error('DOCX 解析失败: ' + e.message); }
}

async function extractImageText(file) {
  try {
    setImportStatus('正在识别图片文字，可能需要十几秒...');
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

// 标准化 term key（小写），确保不同词库中大小写变体被视为同一单词
function termKey(term) { return (term || '').toLowerCase(); }

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
  const shuffleSeedRef = useRef(Date.now()); // 洗牌种子：仅词库变化时更新，进度变化时保持稳定
  const [search, setSearch] = useState('');
  const [libraryLimit, setLibraryLimit] = useState(60); // 词库页懒加载条数
  const [importText, setImportText] = useState('');
  const [importStatus, setImportStatus] = useState('');
  const [lastFile, setLastFile] = useState(null);
  const [importTargetBookId, setImportTargetBookId] = useState(null); // 导入目标词库
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
  const [numberDateSubTab, setNumberDateSubTab] = useState('months');
  const [spellingSearch, setSpellingSearch] = useState('');
  const [scenePage, setScenePage] = useState(0);
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
    setBooks(prev => prev.map(b => b.id === 'mastered-words' ? { ...b, items: masteredItems } : b));
  }, [progress]);

  // 当前页面对应的词库选择（背诵页和词库页独立）
  const currentBookIds = section === 'learn' ? studyBookIds : libraryBookIds;
  const activeBook = useMemo(() => {
    // 如果选中了错词本，单独处理
    if (currentBookIds.includes('wrong-words')) {
      return {
        id: 'wrong-words',
        name: '错词本',
        items: wrongWords,
        editable: false
      };
    }
    const selected = books.filter(b => currentBookIds.includes(b.id) && !hiddenBookIds.includes(b.id));
    if (selected.length === 0) return books[0] || { id: 'empty', name: '空', items: [], editable: false };
    // 多词库合并时按 term 去重（大小写不敏感），保留第一个出现的
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
    // 词库变化时更新洗牌种子
    shuffleSeedRef.current = Date.now();
    return {
      id: currentBookIds.join(','),
      name: selected.length === 1 ? selected[0].name : `${selected.length}个词库`,
      items: uniqueItems,
      editable: false
    };
  }, [books, currentBookIds, wrongWords, hiddenBookIds]);

  // 全部词汇合并（词根词缀、对比、易错词基于全量词汇）
  const allWords = useMemo(() => {
    return books.flatMap(b => b.items);
  }, [books]);

  const filteredItems = useMemo(() => {
    let items = activeBook.items.filter(item => {
      const posOk = posFilter === '全部' || getPosCategory(item.pos) === posFilter;
      const typeOk = typeFilter === '全部' || item.type === typeFilter;
      // 隐藏已掌握只在背诵页生效，词库页不受影响（大小写不敏感）
      const masteredOk = section !== 'learn' || !hideMastered || progress[termKey(item.term)] !== 'mastered';
      // 搜索只在词库页生效，不影响背诵页
      const searchOk = section === 'learn' || !search || `${item.term}${item.meaning}${item.pos}`.toLowerCase().includes(search.toLowerCase());
      return posOk && typeOk && masteredOk && searchOk;
    });
    // 使用稳定种子洗牌，避免进度变化时顺序跳变
    if (settings.shuffleMode) items = seededShuffle(items, shuffleSeedRef.current);
    return items;
  }, [activeBook, posFilter, typeFilter, hideMastered, search, settings.shuffleMode, progress, section]);

  const current = filteredItems[index % Math.max(filteredItems.length, 1)];

  // 锁定当前显示的单词，防止 toggleProgress 改变 filteredItems 导致 UI 判断错误
  const lockedCurrent = useRef(null);
  // 临时回退显示的单词（即使被过滤也能回退看到）
  const [forceShowItem, setForceShowItem] = useState(null);
  // 显示用的当前单词：答题后使用锁定的单词，防止 toggleProgress 改变 current 导致显示不匹配
  const displayCurrent = forceShowItem || (selected && lockedCurrent.current) || current;

  // 问题1：4个选项（1正确+3干扰项）—— 排除易混/同义/反义词干扰
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
    if (practiceMode === 'cn-to-en') {
      // 中文选英文：用 term 做选项，排除空 term 和重复
      const correctTerm = item.term;
      const pool = normalWords.filter(w => 
        w.id !== item.id && 
        w.term && w.term !== correctTerm
      );
      const wrongItems = shuffle(pool).slice(0, 3);
      const values = [correctTerm, ...wrongItems.map(i => i.term)];
      return shuffle(values);
    } else {
      // 英文选中文：用 meaning 做选项，过滤无效释义并去重
      const correctShort = getShortMeaning(item.meaning);
      const pool = normalWords.filter(w => {
        if (!w.meaning) return false;
        const shortMeaning = getShortMeaning(w.meaning);
        // 排除：过短、纯英文、纯数字、与正确答案相同
        if (shortMeaning.length < 2) return false;
        if (!/[\u4e00-\u9fa5]/.test(shortMeaning)) return false; // 必须含中文
        if (shortMeaning === correctShort) return false;
        if (w.id === item.id) return false;
        if (w.term === item.term) return false;
        return true;
      });
      const wrongItems = shuffle(pool).slice(0, 3);
      // 用 shortMeaning 去重，确保4个选项各不相同
      const seen = new Set([correctShort]);
      const uniqueWrong = [];
      for (const w of wrongItems) {
        const sm = getShortMeaning(w.meaning);
        if (!seen.has(sm)) { seen.add(sm); uniqueWrong.push(w.meaning); }
        if (uniqueWrong.length >= 3) break;
      }
      const values = [item.meaning, ...uniqueWrong];
      return shuffle(values);
    }
  }, [books, displayCurrent, current, practiceMode]);

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
        setStudyBookIds(['gaokao-core']);
        try { localStorage.setItem('gaokao_study_books', 'gaokao-core'); } catch {}
      } else {
        setStudyBookIds(['wrong-words']);
        try { localStorage.setItem('gaokao_study_books', 'wrong-words'); } catch {}
      }
    } else {
      if (studyBookIds.includes(id)) {
        const next = studyBookIds.filter(x => x !== id && x !== 'wrong-words');
        if (next.length === 0) next.push('gaokao-core');
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

  function toggleProgress(item) {
    const key = termKey(item.term);
    setProgress(prev => {
      const next = { ...prev };
      if (next[key] === 'mastered') delete next[key];
      else next[key] = 'mastered';
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
      book.items.forEach(item => { delete next[item.term]; });
      saveProgress(next);
      return next;
    });
  }

  // 清理不存在的词库引用：从 studyBookIds/libraryBookIds 中移除已删除的词库 id
  function cleanDeletedBookRefs() {
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
    books.forEach(b => b.items.forEach(item => allTerms.add(item.term)));
    setProgress(prev => {
      const next = {};
      let removed = 0;
      Object.entries(prev).forEach(([term, val]) => {
        if (allTerms.has(term)) next[term] = val;
        else removed++;
      });
      if (removed > 0) saveProgress(next);
      return next;
    });
    // 清理错词本中不属于任何词库的残留数据
    setWrongWords(prev => {
      const next = prev.filter(w => allTerms.has(w.term));
      if (next.length !== prev.length) saveWrongWords(next);
      return next;
    });
    return { study: beforeStudy - newStudyIds.length, library: beforeLibrary - newLibraryIds.length };
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
  // 最近答错的单词（term），短时间内不重复出现
  const recentWrongRef = useRef([]);
  const RECENT_WRONG_WINDOW = 20; // 最近20个单词内不重复出现答错的词
  // 最近看到过的单词（term），点击"下一个"/"跳过"后不重复出现
  const recentSeenRef = useRef([]);

  // 切换词库时清空已看记录
  useEffect(() => {
    recentSeenRef.current = [];
    recentWrongRef.current = [];
  }, [activeBook.id]);

  // 同步 practiceMode 与 settings.mode（设置页修改模式后生效）
  useEffect(() => {
    setPracticeMode(settings.mode || 'en-to-cn');
  }, [settings.mode]);

  // 筛选条件变化时重置词库页显示条数
  useEffect(() => {
    setLibraryLimit(60);
  }, [search, posFilter, typeFilter, activeBook.id]);

  function nextCard() {
    // 把当前单词加入"已看"记录
    if (filteredItems.length > 0) {
      const currentItem = filteredItems[index % filteredItems.length];
      if (currentItem && currentItem.term) {
        const rs = recentSeenRef.current;
        if (!rs.includes(currentItem.term)) rs.push(currentItem.term);
        // 动态窗口：最多保留词库60%且不超过50个
        const maxSeen = Math.min(50, Math.max(3, Math.floor(filteredItems.length * 0.6)));
        while (rs.length > maxSeen) rs.shift();
      }
    }

    let nextIdx = (index + 1) % Math.max(filteredItems.length, 1);
    // 跳过最近已看和答错的单词，除非所有单词都被跳过了
    if (filteredItems.length > 3) {
      const rs = recentSeenRef.current;
      const rw = recentWrongRef.current;
      let tried = 0;
      while (tried < filteredItems.length) {
        const item = filteredItems[nextIdx];
        // 检查是否所有单词都在"已看"或"答错"列表中
        const allSeenOrWrong = filteredItems.every(it => rs.includes(it.term) || rw.includes(it.term));
        if (allSeenOrWrong) break; // 词库内没有新单词了，允许重复
        if (!rs.includes(item.term) && !rw.includes(item.term)) break;
        nextIdx = (nextIdx + 1) % filteredItems.length;
        tried++;
      }
    }
    setIndex(nextIdx);
    setShowBack(false); setSelected('');
    lockedCurrent.current = null;
    setForceShowItem(null);
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
      // 先尝试在 filteredItems 中找到
      const targetIdx = filteredItems.findIndex(it => it.term === item.term);
      if (targetIdx !== -1 && targetIdx !== index) {
        setIndex(targetIdx);
        setShowBack(false); setSelected('');
        lockedCurrent.current = null;
        setForceShowItem(null);
        lastAnsweredRef.current = null;
        return;
      }
      // 如果在 filteredItems 中找不到（被隐藏已掌握等过滤掉了），
      // 强制临时显示该单词
      setIndex(0); // index 暂时不重要，用 forceShowItem 覆盖显示
      setShowBack(false); setSelected('');
      lockedCurrent.current = null;
      setForceShowItem(item);
      lastAnsweredRef.current = null;
      return;
    }
    setForceShowItem(null);
    setIndex(i => (i - 1 + filteredItems.length) % Math.max(filteredItems.length, 1));
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
    const keys = [
      'gaokao_progress', 'gaokao_settings', 'gaokao_study_log', 'gaokao_downloaded',
      'gaokao_wrong_words', 'customBooks', 'customSpelling', 'aiImportConfig',
      'gaokao_study_books', 'gaokao_library_books', 'gaokao_hide_mastered',
      'gaokao_dismissed_version', 'gaokao_avatar', 'gaokao_first_use'
    ];
    const data = {};
    keys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) data[k] = v;
    });
    const jsonStr = JSON.stringify(data, null, 2);
    const fileName = `gaokao-backup-${new Date().toISOString().slice(0,10)}.json`;
    const dirName = '高考词汇备份';

    // APP端：保存到 Documents/高考词汇备份/ 目录，方便查找
    if (isNativeApp) {
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
        const msg = `数据已备份！\n\n保存位置：Documents/${dirName}/${fileName}\n${uri ? '\n完整路径：' + uri : ''}\n\n打开手机"文件管理器" → "Documents" → "高考词汇备份" 即可找到。`;
        alert(msg);
        return;
      } catch (e) {
        // Filesystem 失败时回退到浏览器下载
        console.warn('[Backup] Filesystem failed:', e);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = fileName; a.click();
        URL.revokeObjectURL(url);
        alert(`数据已备份（文件名：${fileName}）\n\n保存到下载目录。如需指定位置，请授予存储权限后重试。\n失败原因：${e.message}`);
        return;
      }
    }
    // 网页端：浏览器下载
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
    alert(`数据已备份！文件名为 ${fileName}\n\n保存位置：浏览器"下载"文件夹\n请将此文件保存到安全位置，换设备或更新时可恢复。`);
  }

  // 数据恢复：从 JSON 文件导入所有数据
  async function importData() {
    const dirName = '高考词汇备份';
    // APP端：优先从 Documents/高考词汇备份/ 读取
    if (isNativeApp) {
      try {
        const result = await Filesystem.readdir({ path: dirName, directory: Directory.Documents });
        const files = (result.files || []).filter(f => f.name.endsWith('.json')).sort((a, b) => b.name.localeCompare(a.name));
        if (files.length > 0) {
          const list = files.map((f, i) => `${i + 1}. ${f.name}`).join('\n');
          const choice = prompt(`在 Documents/${dirName}/ 中找到以下备份文件：\n\n${list}\n\n请输入序号选择要恢复的文件（留空取消）：`);
          if (choice === null || choice.trim() === '') return;
          const idx = parseInt(choice.trim()) - 1;
          if (idx < 0 || idx >= files.length) { alert('序号无效'); return; }
          const fileContent = await Filesystem.readFile({
            path: `${dirName}/${files[idx].name}`,
            directory: Directory.Documents,
            encoding: Encoding.UTF8
          });
          const data = JSON.parse(fileContent.data);
          if (!data || typeof data !== 'object') throw new Error('文件格式错误');
          let count = 0;
          Object.entries(data).forEach(([k, v]) => {
            if (typeof v === 'string') { localStorage.setItem(k, v); count++; }
          });
          alert(`成功从 ${files[idx].name} 恢复 ${count} 项数据，页面即将刷新。`);
          window.location.reload();
          return;
        }
        alert(`Documents/${dirName}/ 中没有找到备份文件。\n\n请先备份数据，或选择其他文件恢复。`);
        return;
      } catch (e) {
        if (e.message && e.message.includes('cancel')) return;
        console.warn('[Restore] Filesystem readdir failed:', e);
        // 读取失败，回退到文件选择
      }
    }
    // 网页端或读取失败：让用户手动选择文件
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
          let count = 0;
          Object.entries(data).forEach(([k, v]) => {
            if (typeof v === 'string') {
              localStorage.setItem(k, v);
              count++;
            }
          });
          alert(`成功恢复 ${count} 项数据，页面即将刷新。`);
          window.location.reload();
        } catch (err) {
          alert('恢复失败：' + err.message);
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
    const right = practiceMode === 'cn-to-en' ? c.term : c.meaning;
    // 错词本模式下，答对不自动掌握也不自动跳转（优先级最高）
    const isWrongWordBook = currentBookIds.includes('wrong-words');
    if (option === right) {
      setSessionCorrect(co => co + 1);
      recordStudy();
      // 自动标记已掌握（仅非错词本模式，且开关开启且当前未标记）
      if (!isWrongWordBook && settings.autoMaster && progress[termKey(c.term)] !== 'mastered') {
        toggleProgress(c);
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
      updateBooks(books.map(b => b.id === targetId ? { ...b, items: [...b.items, ...items] } : b));
      setImportStatus(`导入成功：${items.length} 条 → ${targetBook.name}`);
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
      // 第一优先：GitHub Pages（deploy 后立即生效，无 CDN 缓存延迟）
      try {
        const ghUrl = `https://xdbzys.github.io/gaokao-vocab/app-update.json?_t=${Date.now()}`;
        console.log('[Update] Trying GitHub Pages:', ghUrl);
        const ghResp = await fetch(ghUrl, { cache: 'no-store' });
        if (ghResp.ok) { data = await ghResp.json(); console.log('[Update] GitHub Pages success:', data); }
        else throw new Error('GitHub Pages HTTP ' + ghResp.status);
      } catch (ghErr) {
        console.warn('[Update] GitHub Pages failed:', ghErr.message);
        // 第二回退：jsdelivr CDN
        try {
          const cdnUrl = `https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/app-update.json?_t=${Date.now()}`;
          console.log('[Update] Trying jsdelivr CDN:', cdnUrl);
          const cdnResp = await fetch(cdnUrl, { cache: 'no-store' });
          if (cdnResp.ok) { data = await cdnResp.json(); console.log('[Update] jsdelivr CDN success:', data); }
          else throw new Error('jsdelivr HTTP ' + cdnResp.status);
        } catch (cdnErr) {
        console.warn('[Update] jsdelivr CDN failed:', cdnErr.message);
        // 第三回退：Gitee raw
        try {
          data = await fetchFromRaw();
          console.log('[Update] Raw success:', data);
        } catch (rawErr) {
          console.warn('[Update] Raw failed:', rawErr.message);
          // 第四回退：Gitee API
          try {
            data = await fetchFromApi();
            console.log('[Update] API fallback success:', data);
          } catch (apiErr) {
            console.warn('[Update] API failed:', apiErr.message);
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

        setUpdateVersion(version);
        setUpdateChangelog(changelog);
        // 不再静默下载（Gitee raw 容易被 WAF 拦截），改为提示用户手动下载
        if (!silent) {
          setCloudStatus('发现新版本，点击下方按钮前往下载');
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
    setCloudStatus('正在打开下载页面...');

    // 多个下载源，逐一尝试
    const downloadSources = [
      { name: 'Gitee（推荐）', url: 'https://gitee.com/xdbzys/app/raw/master/gaokao-vocab.apk' },
      { name: 'jsdelivr CDN', url: 'https://cdn.jsdelivr.net/gh/xdbzys/gaokao-vocab@master/android/app/build/outputs/apk/debug/app-debug.apk' },
      { name: 'GitHub', url: 'https://github.com/xdbzys/gaokao-vocab/releases/latest/download/app-debug.apk' },
    ];

    try {
      // 优先尝试 Gitee
      const apkUrl = downloadSources[0].url;
      let opened = false;
      if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
        try {
          await Capacitor.Plugins.Browser.open({ url: apkUrl });
          opened = true;
        } catch {}
      }
      if (!opened) {
        window.open(apkUrl, '_blank');
      }
      // 提示用户：如果打不开，提供其他下载源
      const altLinks = downloadSources.slice(1).map(s => `${s.name}: ${s.url}`).join('\n');
      setCloudStatus(`已打开下载页面，下载完成后请安装。\n\n如果页面打不开，请手动复制以下链接到浏览器：\n${altLinks}`);
      setUpdateInfo(prev => ({ ...prev, updating: false }));
    } catch (e) {
      // 全部失败，显示所有下载链接让用户手动选择
      const allLinks = downloadSources.map(s => `${s.name}:\n${s.url}`).join('\n\n');
      setCloudStatus(`自动打开失败，请手动复制以下链接到浏览器下载：\n\n${allLinks}`);
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
                  {/* 错词本（单独复习） */}
                  {wrongWords.length > 0 && (
                    <label key="wrong-words" className="bookPickerItem" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginBottom: 4 }}>
                      <input type="checkbox" checked={studyBookIds.includes('wrong-words')} onChange={() => switchStudyBook('wrong-words')} />
                      <span style={{ color: '#ef4444', fontWeight: 600 }}>错词本</span>
                      <span className="bookCount">({wrongWords.length})</span>
                    </label>
                  )}
                  {books.filter(b => !b.id.includes('synonym') && !b.id.includes('antonym') && !b.id.includes('confused') && !b.id.includes('dual-sentiment') && !hiddenBookIds.includes(b.id)).map(b => (
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
          </div>

          {/* 背诵模式快捷开关 */}
          <div className="quickToggleRow">
            <button
              className="quickToggleBtn modeBtn"
              onClick={() => { const modes = choiceModes.map(m => m.id); const cur = modes.indexOf(practiceMode); const next = modes[(cur + 1) % modes.length]; setPracticeMode(next); setSettings(s => ({ ...s, mode: next })); saveSettings({ ...settings, mode: next }); setSelected(''); setShowBack(false); }}
            >📖 {choiceModes.find(m => m.id === practiceMode)?.name || '英文选中文'}</button>
            <button
              className={`quickToggleBtn ${settings.shuffleMode ? 'shuffleOn' : 'shuffleOff'}`}
              onClick={() => { setSettings(s => ({ ...s, shuffleMode: !s.shuffleMode })); saveSettings({ ...settings, shuffleMode: !settings.shuffleMode }); }}
            >{settings.shuffleMode ? '🔀 乱序' : '📋 顺序'}</button>
            <button
              className={`quickToggleBtn ${settings.autoMaster ? 'masterOn' : 'masterOff'}`}
              onClick={() => { const v = !settings.autoMaster; setSettings(s => ({ ...s, autoMaster: v })); saveSettings({ ...settings, autoMaster: v }); }}
            >{settings.autoMaster ? '✅ 自动掌握' : '📝 自动掌握'}</button>
            <button
              className={`quickToggleBtn ${settings.autoJump ? 'jumpOn' : 'jumpOff'}`}
              onClick={() => { const v = !settings.autoJump; setSettings(s => ({ ...s, autoJump: v })); saveSettings({ ...settings, autoJump: v }); }}
            >{settings.autoJump ? '⏭ 自动跳转' : '⏸ 自动跳转'}</button>
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
                {progress[termKey(displayCurrent.term)] === 'mastered' && <span className="masteredTag">已掌握</span>}
              </div>

              <div className="questionArea">
                <h2 style={{ color: wordStatusColor(displayCurrent, progress, wrongWords) || undefined }}>{practiceMode === 'cn-to-en' ? getShortMeaning(displayCurrent.meaning) : practiceMode === 'flashcard' ? displayCurrent.term : displayCurrent.term}</h2>
                {displayCurrent.pos && <p className="posText" style={{ color: posColor(displayCurrent.pos), fontWeight: 600, fontSize: '1.1em', margin: '4px 0' }}>{displayCurrent.pos}</p>}
                {practiceMode !== 'cn-to-en' && displayCurrent.phonetic && <p className="phoneticText">{displayCurrent.phonetic}</p>}
                <button className="sound" onClick={() => speak(displayCurrent.term, settings.speakRate)}>🔊 发音</button>
              </div>

              {/* 问题1：4选项答题 - 未回答时显示选项，回答后隐藏 */}
              {practiceMode !== 'flashcard' && !selected && (
                <div className="options">
                  {options.map(option => {
                    const right = practiceMode === 'cn-to-en' ? current.term : current.meaning;
                    // en-to-cn 模式下选项只显示简短中文释义，不显示词性标记和详细义项
                    const displayOption = practiceMode === 'en-to-cn' ? getShortMeaning(option) : option;
                    return <button key={option} onClick={() => handleSelect(option)}>{displayOption}</button>;
                  })}
                </div>
              )}

              {/* 闪卡模式 */}
              {practiceMode === 'flashcard' && !showBack && (
                <button className="primary" onClick={() => { setShowBack(true); recordStudy(); }}>显示释义</button>
              )}

              {/* 答题后选项消失，解释内容顶替选项位置 */}
              {(showBack || selected) && (() => {
                const isFlashcard = practiceMode === 'flashcard';
                const enrichment = isFlashcard ? getWordEnrichment(displayCurrent.term) : null;
                const showAll = isFlashcard || detailMode === 'full';
                return (
                <div className="answerBox">
                  {selected && (
                    <p style={{ fontWeight: 600, marginBottom: 8, color: (practiceMode === 'cn-to-en' ? displayCurrent.term : displayCurrent.meaning) === selected ? '#16a34a' : '#dc2626' }}>
                      {selected === (practiceMode === 'cn-to-en' ? displayCurrent.term : displayCurrent.meaning) ? '✅ 回答正确' : `❌ 回答错误（你选了：${selected}）`}
                    </p>
                  )}
                  <h3>{displayCurrent.term} &middot; {stripPosPrefix(displayCurrent.meaning)}</h3>
                  <p className="muted">{displayCurrent.pos} &middot; {displayCurrent.source}</p>
                  <div className="points">
                    {(showAll ? displayCurrent.allPoints : displayCurrent.corePoints.slice(0, 2)).map(p => <p key={p}>• {p}</p>)}
                  </div>
                  {/* 闪卡模式：显示全部考点和增强数据 */}
                  {isFlashcard && enrichment && (
                    <>
                      {enrichment.examPoints.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}>📝 常考要点</p>
                          {enrichment.examPoints.map((p, i) => <p key={i}>• {p}</p>)}
                        </div>
                      )}
                      {enrichment.collocations.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}>🔗 词组搭配</p>
                          {enrichment.collocations.map((p, i) => <p key={i}>• {p}</p>)}
                        </div>
                      )}
                      {enrichment.derivatives.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}>🌿 派生词</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrichment.derivatives.map((d, i) => {
                              const derivWord = d.split(' ')[0];
                              return <span key={i} style={{ display: 'inline-block', background: 'var(--primary-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13, cursor: 'pointer' }} onClick={() => speak(derivWord, settings.speakRate)}>{d}</span>;
                            })}
                          </div>
                        </div>
                      )}
                      {enrichment.synonyms.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}>📌 近义词</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrichment.synonyms.map((s, i) => <span key={i} style={{ display: 'inline-block', background: 'var(--primary-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13 }}>{s}</span>)}
                          </div>
                        </div>
                      )}
                      {enrichment.antonyms.length > 0 && (
                        <div className="points" style={{ marginTop: 8 }}>
                          <p style={{ fontWeight: 600, color: 'var(--primary-dark)', marginBottom: 4 }}>⚡ 反义词</p>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {enrichment.antonyms.map((a, i) => <span key={i} style={{ display: 'inline-block', background: 'var(--danger-light)', borderRadius: 8, padding: '2px 8px', fontSize: 13 }}>{a}</span>)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {(showAll || isFlashcard) && displayCurrent.examples.length > 0 && (
                    <div className="examples">{displayCurrent.examples.map(e => <p key={e}>{e}</p>)}</div>
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
                <article key={item.id} className="listItem" onClick={() => setDetailItem(item)}>
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
                    <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}>🔊</button>
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
                {activeBook.name} ▼
              </button>
              {showBookPicker2 && (
                <div className="bookPickerDropdown">
                  <div className="bookPickerActions">
                    <button onClick={selectAllLibraryBooks}>全选</button>
                    <button onClick={() => { setLibraryBookIds(['gaokao-core']); try { localStorage.setItem('gaokao_library_books', 'gaokao-core'); } catch {} }}>重置</button>
                  </div>
                  {books.filter(b => !hiddenBookIds.includes(b.id)).map(b => (
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
            {filteredItems.slice(0, libraryLimit).map(item => (
              <article key={item.id} className="listItem" onClick={() => setDetailItem(item)}>
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
                  <button className="smallBtn" onClick={() => speak(item.term, settings.speakRate)}>🔊</button>
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
          {/* 词条详情弹窗 */}
          {detailItem && (() => {
            const enrichment = getWordEnrichment(detailItem.term);
            return (
            <div className="modal" onClick={() => setDetailItem(null)}>
              <div className="modalContent" onClick={e => e.stopPropagation()}>
                <div className="modalHeader">
                  <h2>{detailItem.term}</h2>
                  {detailItem.phonetic && <p className="phoneticText">{detailItem.phonetic}</p>}
                  <button className="closeBtn" onClick={() => setDetailItem(null)}>✕</button>
                </div>
                <div className="detailMetaRow">
                  {detailItem.pos && <span className="detailPosTag" style={{ color: posColor(detailItem.pos), background: posColor(detailItem.pos) + '18' }}>{detailItem.pos}</span>}
                  {detailItem.frequency && <span className="detailFreqTag" style={{ color: freqColor(detailItem.frequency) }}>{detailItem.frequency}</span>}
                  {progress[termKey(detailItem.term)] === 'mastered' && <span className="detailMasteredTag">✓ 已掌握</span>}
                </div>
                <h3 className="detailMeaning">{detailItem.meaning}</h3>

                {/* 考点提示 */}
                {detailItem.corePoints && detailItem.corePoints.length > 0 && (
                  <div className="detailSection detailExamPoints">
                    <p className="detailSectionTitle">🎯 核心考点</p>
                    {detailItem.corePoints.map((p, i) => <p key={i} className="detailPointItem">{p}</p>)}
                  </div>
                )}

                {/* 增强数据：考点 */}
                {enrichment && enrichment.examPoints.length > 0 && (
                  <div className="detailSection detailExamPoints">
                    <p className="detailSectionTitle">📝 常考要点</p>
                    {enrichment.examPoints.map((p, i) => <p key={i} className="detailPointItem">{p}</p>)}
                  </div>
                )}

                {/* 知识点 */}
                {detailItem.allPoints && detailItem.allPoints.length > 0 && (
                  <div className="detailSection">
                    <p className="detailSectionTitle">💡 知识点</p>
                    <div className="points">
                      {detailItem.allPoints.map((p, i) => <p key={i}>• {p}</p>)}
                    </div>
                  </div>
                )}

                {/* 词组搭配 */}
                {enrichment && enrichment.collocations.length > 0 && (
                  <div className="detailSection detailCollocations">
                    <p className="detailSectionTitle">🔗 词组搭配</p>
                    {enrichment.collocations.map((c, i) => <p key={i} className="detailCollocationItem">{c}</p>)}
                  </div>
                )}

                {/* 单词变形 */}
                {enrichment && Object.keys(enrichment.wordForms).length > 0 && (
                  <div className="detailSection detailWordForms">
                    <p className="detailSectionTitle">🔄 单词变形</p>
                    <div className="detailFormGrid">
                      {enrichment.wordForms.noun && <div className="detailFormItem"><span className="detailFormLabel">名词</span><span className="detailFormValue">{enrichment.wordForms.noun}</span></div>}
                      {enrichment.wordForms.adjective && <div className="detailFormItem"><span className="detailFormLabel">形容词</span><span className="detailFormValue">{enrichment.wordForms.adjective}</span></div>}
                      {enrichment.wordForms.adverb && <div className="detailFormItem"><span className="detailFormLabel">副词</span><span className="detailFormValue">{enrichment.wordForms.adverb}</span></div>}
                      {enrichment.wordForms.pastTense && <div className="detailFormItem"><span className="detailFormLabel">过去式</span><span className="detailFormValue">{enrichment.wordForms.pastTense}</span></div>}
                      {enrichment.wordForms.pastParticiple && <div className="detailFormItem"><span className="detailFormLabel">过去分词</span><span className="detailFormValue">{enrichment.wordForms.pastParticiple}</span></div>}
                      {enrichment.wordForms.presentParticiple && <div className="detailFormItem"><span className="detailFormLabel">现在分词</span><span className="detailFormValue">{enrichment.wordForms.presentParticiple}</span></div>}
                    </div>
                  </div>
                )}

                {/* 派生词 */}
                {enrichment && enrichment.derivatives.length > 0 && (
                  <div className="detailSection detailDerivatives">
                    <p className="detailSectionTitle">🌿 派生词</p>
                    <div className="detailTagWrap">
                      {enrichment.derivatives.map((d, i) => {
                        const derivWord = d.split(' ')[0];
                        return <span key={i} className="detailDerivTag" style={{ cursor: 'pointer' }} onClick={() => speak(derivWord, settings.speakRate)}>{d}</span>;
                      })}
                    </div>
                  </div>
                )}

                {/* 近义词 / 同义词 */}
                {enrichment && enrichment.synonyms.length > 0 && (
                  <div className="detailSection detailSynonyms">
                    <p className="detailSectionTitle">📌 近义词</p>
                    <div className="detailTagWrap">
                      {enrichment.synonyms.map((s, i) => <span key={i} className="detailSynonymTag">{s}</span>)}
                    </div>
                  </div>
                )}

                {/* 反义词 */}
                {enrichment && enrichment.antonyms.length > 0 && (
                  <div className="detailSection detailAntonyms">
                    <p className="detailSectionTitle">⚡ 反义词</p>
                    <div className="detailTagWrap">
                      {enrichment.antonyms.map((a, i) => <span key={i} className="detailAntonymTag">{a}</span>)}
                    </div>
                  </div>
                )}

                {/* 例句 */}
                {detailItem.examples && detailItem.examples.length > 0 && (
                  <div className="detailSection">
                    <p className="detailSectionTitle">💬 例句</p>
                    <div className="examples">{detailItem.examples.map((e, i) => <p key={i}>{e}</p>)}</div>
                  </div>
                )}

                {/* 关联词族 */}
                {(() => {
                  const family = findWordFamily(detailItem.term, allWords);
                  if (family.length === 0) return null;
                  return (
                    <div className="detailSection detailWordFamily">
                      <p className="detailSectionTitle">🔗 关联词族</p>
                      <div className="detailTagWrap">
                        {family.map(item => (
                          <button key={item.id} className="detailFamilyBtn"
                            onClick={() => setDetailItem(item)}>
                            {item.term} <small>{item.pos}</small>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
                <div className="modalActions">
                  <button onClick={() => speak(detailItem.term, settings.speakRate)}>🔊 发音</button>
                  <button className="masterBtn" onClick={() => { toggleProgress(detailItem); setDetailItem({...detailItem}); }}>
                    {progress[termKey(detailItem.term)] === 'mastered' ? '取消掌握' : '标记掌握'}
                  </button>
                </div>
              </div>
            </div>
            );
          })()}
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
            <button className={extendTab === 'numberdate' ? 'active' : ''} onClick={() => setExtendTab('numberdate')}>数字日期</button>
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
                        <article key={item.id} className="listItem" onClick={() => setDetailItem(item)}>
                          <div>
                            <h3 style={{ color: freqColor(item.frequency) }}>{item.term}</h3>
                            <p>{getShortMeaning(item.meaning)}</p>
                          </div>
                          <div className="listActions">
                            <button className="smallBtn" onClick={(e) => { e.stopPropagation(); speak(item.term, settings.speakRate); }}>🔊</button>
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
                <p className="muted" style={{ margin: 0 }}>高考真题主题文章 · 点击单词可听发音</p>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{startIdx + 1}-{Math.min(startIdx + SCENE_PAGE_SIZE, sceneData.length)} / {sceneData.length}</span>
              </div>
              {currentScenes.map((scene, i) => (
                <div key={startIdx + i} className="sceneCard">
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
              {/* 分页控件 */}
              {totalScenePages > 1 && (
                <div className="scenePagination">
                  <button
                    className="scenePageBtn"
                    disabled={safePage === 0}
                    onClick={() => setScenePage(p => Math.max(0, p - 1))}
                  >◀ 上一页</button>
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
                  >下一页 ▶</button>
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
                  <p className="muted">点击单词可听发音。缩写在日记、书信中常用。</p>
                  <div className="list">
                    {numberDateData.months.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speak(m.word, settings.speakRate)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                            <span className="posTag" style={{ color: '#2563eb', background: '#2563eb18' }}>{m.abbr}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#2563eb' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => <p key={j} style={{ fontSize: '0.85em' }}>• {ex}</p>)}
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
                  <p className="muted">星期一到星期日的英文表达，点击可听发音。</p>
                  <div className="list">
                    {numberDateData.weekdays.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speak(m.word, settings.speakRate)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                            <span className="posTag" style={{ color: '#7c3aed', background: '#7c3aed18' }}>{m.abbr}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#7c3aed' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => <p key={j} style={{ fontSize: '0.85em' }}>• {ex}</p>)}
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
                  <p className="muted">四季的英文表达。注意 autumn（英式）和 fall（美式）两种写法。</p>
                  <div className="list">
                    {numberDateData.seasons.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speak(m.word, settings.speakRate)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#16a34a' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => <p key={j} style={{ fontSize: '0.85em' }}>• {ex}</p>)}
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
                  <p className="muted">与日期时间相关的高频词汇。</p>
                  <div className="list">
                    {numberDateData.dateWords.map((m, i) => (
                      <div key={i} className="listItem" style={{ cursor: 'pointer' }} onClick={() => speak(m.word, settings.speakRate)}>
                        <div className="listItemMain">
                          <div className="listItemTitle">
                            <h3>{m.word}</h3>
                            <span className="phoneticSmall">{m.phonetic}</span>
                          </div>
                          <p style={{ fontWeight: 600, color: '#ea580c' }}>{m.cn}</p>
                          <div className="points" style={{ marginTop: 4 }}>
                            {m.examples.map((ex, j) => <p key={j} style={{ fontSize: '0.85em' }}>• {ex}</p>)}
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
                  <p className="muted">基数词（one, two...）用于计数，序数词（first, second...）用于表示顺序和日期。点击可听发音。</p>
                  <div className="list">
                    {numberDateData.numbers.map(item => (
                      <div key={item.n} className="listItem" style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px' }}>
                        <div style={{ minWidth: 60, fontSize: '1.2em', fontWeight: 700, color: '#2563eb' }}>{item.n}</div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, color: '#16a34a', marginRight: 12, cursor: 'pointer' }} onClick={() => speak(item.cardinal, settings.speakRate)}>{item.cardinal}</span>
                          <span style={{ fontWeight: 600, color: '#ea580c', cursor: 'pointer' }} onClick={() => speak(item.ordinal, settings.speakRate)}>{item.ordinal}</span>
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
                            <span style={{ fontWeight: 600, color: '#16a34a', marginRight: 12, cursor: 'pointer' }} onClick={() => speak(item.cardinal, settings.speakRate)}>{item.cardinal}</span>
                            <span style={{ fontWeight: 600, color: '#ea580c', cursor: 'pointer' }} onClick={() => speak(item.ordinal, settings.speakRate)}>{item.ordinal}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
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
              <select value={importTargetBookId || ''} onChange={e => setImportTargetBookId(e.target.value || null)} style={{ minWidth: 140, marginRight: 8 }}>
                <option value="">自动创建新词库</option>
                {books.filter(b => b.editable).map(b => <option key={b.id} value={b.id}>{b.name} ({b.items.length}条)</option>)}
              </select>
              <button className="primary" onClick={() => addImportedItems(parseImportedText(importText, 'word'))}>导入到词库</button>
            </div>
            <p className="status">{importStatus || '粘贴或上传文件后点击导入，未选词库时自动创建新词库'}</p>
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

          {/* 数据备份与恢复 */}
          <div className="settingsGroup" style={{ marginTop: 16 }}>
            <h3>数据备份</h3>
            <p className="muted" style={{ marginBottom: 12 }}>{isNativeApp ? '备份保存到 Documents/高考词汇备份/ 目录，恢复时自动读取。' : '备份学习进度、错词本、设置等数据，更新或换设备后可恢复。'}</p>
            <div className="importActions">
              <button className="smallBtn" onClick={exportData}>📤 备份数据</button>
              <button className="smallBtn" onClick={importData}>📥 恢复数据</button>
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
            {cloudStatus && <p className="status" style={{ marginTop: 8, maxHeight: 120, overflowY: 'auto' }}>{cloudStatus}</p>}
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
                  try { navigator.clipboard?.writeText('3219858871'); alert('QQ号已复制：3219858871'); } catch { alert('QQ号：3219858871'); }
                }}>复制QQ号</button>
              </div>
            </div>
          )}

          {/* 隐私政策 */}
          <div className="cloudUpdateSection" style={{ background: '#f0fdf4', borderColor: '#bbf7d0' }}>
            <h3 style={{ color: '#166534' }}>📋 隐私政策</h3>
            <p className="muted">本应用不收集任何用户个人信息，所有数据保存在设备本地。</p>
            <button className="smallBtn" onClick={() => {
              window.open('https://xdbzys.github.io/gaokao-vocab-website/privacy.html', '_blank');
            }}>查看隐私政策</button>
          </div>

          {/* 官网 */}
          <div className="cloudUpdateSection" style={{ background: '#eff6ff', borderColor: '#bfdbfe', marginTop: 12 }}>
            <h3 style={{ color: '#1d4ed8' }}>🌐 官网</h3>
            <p className="muted">
              <a href="https://xdbzys.github.io/gaokao-vocab-website/" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>
                xdbzys.github.io/gaokao-vocab-website
              </a>
            </p>
            <button className="smallBtn" onClick={() => {
              if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                Capacitor.Plugins.Browser.open({ url: 'https://xdbzys.github.io/gaokao-vocab-website/' });
              } else {
                window.open('https://xdbzys.github.io/gaokao-vocab-website/', '_blank');
              }
            }}>访问官网</button>
          </div>

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
            <button className="smallBtn" style={{ marginBottom: 12, background: '#f59e0b', color: '#fff' }} onClick={() => {
              const result = cleanDeletedBookRefs();
              const msgs = [];
              if (result.study > 0) msgs.push(`背诵页清理 ${result.study} 个`);
              if (result.library > 0) msgs.push(`词库页清理 ${result.library} 个`);
              alert(msgs.length > 0 ? `已清理不存在的词库引用：\n${msgs.join('\n')}` : '没有发现不存在的词库引用');
            }}>清理不存在的词库</button>
            <div className="list">
              {books.filter(b => b.id !== 'mastered-words' && b.id !== 'wrong-words').map(b => {
                const mastered = b.items.filter(i => progress[termKey(i.term)] === 'mastered').length;
                const isBuiltIn = builtInBooks.some(bb => bb.id === b.id);
                const isHidden = hiddenBookIds.includes(b.id);
                return (
                  <div key={b.id} className="listItem" style={isHidden ? { opacity: 0.5 } : {}}>
                    <div>
                      <h3>{b.name} {isHidden && <small style={{ color: '#999' }}>(已隐藏)</small>}</h3>
                      <small>已掌握 {mastered}/{b.items.length}</small>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <button className="smallBtn dangerGhost" onClick={() => resetBookProgress(b.id)}>重置</button>
                      {isBuiltIn ? (
                        <button className="smallBtn" style={{ background: isHidden ? '#2563eb' : '#6b7280', color: '#fff' }} onClick={() => {
                          const next = isHidden
                            ? hiddenBookIds.filter(x => x !== b.id)
                            : [...hiddenBookIds, b.id];
                          setHiddenBookIds(next);
                          localStorage.setItem('gaokao_hidden_books', JSON.stringify(next));
                        }}>{isHidden ? '显示' : '隐藏'}</button>
                      ) : (
                        <button className="smallBtn dangerGhost" style={{ color: '#dc2626' }} onClick={() => {
                          if (!confirm(`确定删除词库「${b.name}」及其进度？`)) return;
                          const remaining = books.filter(x => x.id !== b.id);
                          setBooks(remaining);
                          updateBooks(remaining);
                          setStudyBookIds(prev => { const n = prev.filter(x => x !== b.id); localStorage.setItem('gaokao_study_books', n.join(',')); return n; });
                          setLibraryBookIds(prev => { const n = prev.filter(x => x !== b.id); localStorage.setItem('gaokao_library_books', n.join(',')); return n; });
                        }}>删除词库</button>
                      )}
                    </div>
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
                    // 使用 GitHub Pages 托管的 APK 链接（国内访问更稳定）
                    const url = 'https://gitee.com/xdbzys/app/raw/master/gaokao-vocab.apk';
                    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Browser) {
                      Capacitor.Plugins.Browser.open({ url });
                    } else {
                      window.open(url, '_blank');
                    }
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
