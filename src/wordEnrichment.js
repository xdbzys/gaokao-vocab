/* ============================
   单词增强数据 - 参考百词斩详情页
   包含：考点、词组搭配、派生词、单词变形、近义词、反义词
   ============================ */

// 高考核心词汇增强数据（手动整理高频词）
const wordEnrichmentData = {
  abandon: {
    collocations: ['abandon oneself to 沉溺于', 'abandon hope 放弃希望', 'with abandon 放纵地'],
    derivatives: ['abandonment n. 放弃', 'abandoned adj. 被遗弃的'],
    wordForms: { noun: 'abandonment', adjective: 'abandoned', pastTense: 'abandoned', pastParticiple: 'abandoned', presentParticiple: 'abandoning' },
    synonyms: ['give up 放弃', 'desert 遗弃', 'forsake 放弃', 'quit 放弃'],
    antonyms: ['keep 保持', 'maintain 维持', 'retain 保留', 'preserve 保存'],
    examPoints: ['后接 doing sth. 不接 to do', 'abandoned 作形容词常考']
  },
  ability: {
    collocations: ['have the ability to do 有能力做', 'show ability in 显示才能', 'to the best of one\'s ability 尽力'],
    derivatives: ['able adj. 有能力的', 'unable adj. 不能的', 'inability n. 无能', 'disable v. 使残疾', 'disability n. 残疾', 'enable v. 使能够'],
    wordForms: { adjective: 'able', adverb: 'ably' },
    synonyms: ['capability 能力', 'capacity 容量', 'competence 能力', 'skill 技能'],
    antonyms: ['inability 无能', 'incapacity 无能力', 'incompetence 不胜任'],
    examPoints: ['ability 后接不定式 to do', 'able → unable (加 un-)', 'enable sb to do sth 使某人能够做某事']
  },
  absent: {
    collocations: ['be absent from 缺席', 'absent-minded 心不在焉的'],
    derivatives: ['absence n. 缺席', 'absently adv. 心不在焉地', 'absenteeism n. 旷课'],
    wordForms: { noun: 'absence', adverb: 'absently' },
    synonyms: ['missing 缺失的', 'lacking 缺少的', 'away 离开'],
    antonyms: ['present 呈现', 'attending 出席的'],
    examPoints: ['be absent from 后接名词/动名词']
  },
  absorb: {
    collocations: ['be absorbed in 专心于', 'absorb knowledge 吸收知识'],
    derivatives: ['absorption n. 吸收', 'absorbing adj. 引人入胜的', 'absorbed adj. 全神贯注的'],
    wordForms: { noun: 'absorption', adjective: 'absorbing', pastTense: 'absorbed', pastParticiple: 'absorbed', presentParticiple: 'absorbing' },
    synonyms: ['engage 参与', 'soak up 吸收', 'take in 吸收', 'assimilate 吸收'],
    antonyms: ['emit 发射', 'release 释放', 'exude 散发'],
    examPoints: ['be absorbed in 后接 doing/名词', 'absorbing = fascinating 引人入胜的']
  },
  accept: {
    collocations: ['accept an offer 接受提议', 'accept responsibility 承担责任', 'accept the truth 接受事实'],
    derivatives: ['acceptance n. 接受', 'acceptable adj. 可接受的', 'unacceptable adj. 不可接受的', 'accepted adj. 公认的'],
    wordForms: { noun: 'acceptance', adjective: 'acceptable', pastTense: 'accepted', pastParticiple: 'accepted', presentParticiple: 'accepting' },
    synonyms: ['receive 收到', 'take 拿', 'admit 承认', 'acknowledge 承认'],
    antonyms: ['reject 拒绝', 'refuse 拒绝', 'decline 拒绝；下降'],
    examPoints: ['accept 强调主观愿意接受', 'receive 仅表示客观收到']
  },
  access: {
    collocations: ['have access to 有权使用', 'gain access to 获得使用权限', 'easy access to 易于接近'],
    derivatives: ['accessible adj. 易接近的', 'accessibility n. 可达性', 'accession n. 就任'],
    wordForms: { adjective: 'accessible', adverb: 'accessibly' },
    synonyms: ['entry 进入', 'approach 接近', 'admission 准入'],
    antonyms: ['denial 否认', 'exclusion 排斥', 'barrier 障碍'],
    examPoints: ['have access to 中 to 是介词后接 doing', 'accessible to sb 某人可接近/使用的']
  },
  account: {
    collocations: ['account for 解释；占比', 'on account of 因为', 'take account of 考虑到', 'open an account 开户'],
    derivatives: ['accountant n. 会计', 'accounting n. 会计学', 'accountable adj. 应负责的', 'accountability n. 责任'],
    wordForms: { noun: 'account', adjective: 'accountable', adverb: 'accountably' },
    synonyms: ['explanation 解释', 'report 报告', 'record 记录', 'description 描述'],
    antonyms: [],
    examPoints: ['account for 高频短语动词', 'on no account 放句首需部分倒装']
  },
  achieve: {
    collocations: ['achieve one\'s goal 实现目标', 'achieve success 取得成功'],
    derivatives: ['achievement n. 成就', 'achievable adj. 可实现的'],
    wordForms: { noun: 'achievement', adjective: 'achievable', pastTense: 'achieved', pastParticiple: 'achieved', presentParticiple: 'achieving' },
    synonyms: ['accomplish 完成', 'attain 达到', 'reach 到达', 'fulfill 实现'],
    antonyms: ['fail 失败', 'miss 错过', 'lose 失去'],
    examPoints: ['achievement 可数名词', 'make a great achievement 取得巨大成就']
  },
  adapt: {
    collocations: ['adapt to 适应', 'adapt from 改编自', 'adapt oneself to 使自己适应'],
    derivatives: ['adaptation n. 适应；改编', 'adaptable adj. 适应性强的', 'adapter n. 适配器'],
    wordForms: { noun: 'adaptation', adjective: 'adaptable', pastTense: 'adapted', pastParticiple: 'adapted', presentParticiple: 'adapting' },
    synonyms: ['adjust 调整', 'accommodate 容纳；适应', 'modify 修改', 'alter 改变'],
    antonyms: ['remain 保持', 'stay 停留', 'preserve 保存'],
    examPoints: ['adapt to 中 to 是介词后接 doing', 'adapt ≠ adopt(收养/采纳)']
  },
  adopt: {
    collocations: ['adopt a policy 采取政策', 'adopt a child 收养孩子', 'adopt a new approach 采用新方法'],
    derivatives: ['adoption n. 收养；采纳', 'adoptive adj. 收养的', 'adopted adj. 被收养的'],
    wordForms: { noun: 'adoption', adjective: 'adoptive', pastTense: 'adopted', pastParticiple: 'adopted', presentParticiple: 'adopting' },
    synonyms: ['accept 接受', 'embrace 拥抱', 'take on 承担', 'assume 假设'],
    antonyms: ['reject 拒绝', 'abandon 放弃', 'discard 丢弃'],
    examPoints: ['adopt ≠ adapt(适应)', 'adopted son 养子 vs adoptive father 养父']
  },
  advantage: {
    collocations: ['take advantage of 利用', 'have an advantage over 比...有优势', 'to one\'s advantage 对...有利'],
    derivatives: ['advantageous adj. 有利的', 'disadvantage n. 劣势', 'disadvantageous adj. 不利的'],
    wordForms: { adjective: 'advantageous', adverb: 'advantageously' },
    synonyms: ['benefit 有益', 'edge 优势', 'upper hand 优势', 'merit 值得'],
    antonyms: ['disadvantage 劣势', 'drawback 缺点', 'shortcoming 缺点'],
    examPoints: ['take advantage of = make use of 利用', '反义词加 dis- 前缀']
  },
  affect: {
    collocations: ['be affected by 受...影响', 'affect sb deeply 深深影响某人'],
    derivatives: ['affection n. 喜爱', 'affectionate adj. 深情的', 'affectation n. 做作'],
    wordForms: { noun: 'affection', adjective: 'affectionate', pastTense: 'affected', pastParticiple: 'affected', presentParticiple: 'affecting' },
    synonyms: ['influence 影响', 'impact 影响', 'touch 触摸', 'alter 改变'],
    antonyms: ['leave unaffected 不受影响', 'preserve 保存'],
    examPoints: ['affect(v.) ≠ effect(n.效果)', 'affecting = moving 感人的']
  },
  afford: {
    collocations: ['afford to do 负担得起做', 'can\'t afford 买不起', 'afford time for 抽出时间'],
    derivatives: ['affordable adj. 负担得起的', 'affordability n. 可负担性'],
    wordForms: { adjective: 'affordable', pastTense: 'afforded', pastParticiple: 'afforded', presentParticiple: 'affording' },
    synonyms: ['bear 承受', 'manage 管理', 'sustain 维持', 'support 支持'],
    antonyms: ['cannot afford 负担不起', 'be unable to 不能'],
    examPoints: ['常与 can/could/be able to 连用', 'afford to do sth 负担得起做某事']
  },
  agree: {
    collocations: ['agree with sb 同意某人', 'agree on sth 就...达成一致', 'agree to do 同意做'],
    derivatives: ['agreement n. 协议；同意', 'disagree v. 不同意', 'disagreement n. 分歧', 'agreeable adj. 令人愉快的'],
    wordForms: { noun: 'agreement', adjective: 'agreeable', pastTense: 'agreed', pastParticiple: 'agreed', presentParticiple: 'agreeing' },
    synonyms: ['consent 同意', 'approve 批准', 'concur 同意', 'assent 同意'],
    antonyms: ['disagree 不同意', 'differ 不同', 'object 反对', 'oppose 反对'],
    examPoints: ['agree with + 人/意见', 'agree on + 话题', 'agree to + 计划/提议']
  },
  allow: {
    collocations: ['allow sb to do 允许某人做', 'allow for 考虑到', 'allow doing 允许做'],
    derivatives: ['allowance n. 津贴', 'allowable adj. 许可的'],
    wordForms: { noun: 'allowance', adjective: 'allowable', pastTense: 'allowed', pastParticiple: 'allowed', presentParticiple: 'allowing' },
    synonyms: ['permit 允许', 'let 允许', 'authorize 授权', 'enable 使能够'],
    antonyms: ['forbid 禁止', 'prohibit 禁止', 'ban 禁止', 'prevent 阻止'],
    examPoints: ['allow sb to do vs allow doing 允许某人做 vs 允许做', 'allow for = take into consideration 考虑到']
  },
  amaze: {
    collocations: ['be amazed at 对...感到惊讶', 'amaze sb 使某人惊讶'],
    derivatives: ['amazement n. 惊讶', 'amazing adj. 令人惊奇的', 'amazed adj. 感到惊讶的'],
    wordForms: { noun: 'amazement', adjective: 'amazing', pastTense: 'amazed', pastParticiple: 'amazed', presentParticiple: 'amazing' },
    synonyms: ['astonish 使惊讶', 'surprise 使惊讶', 'stun 使震惊', 'astound 使震惊'],
    antonyms: ['expect 期待', 'anticipate 预期'],
    examPoints: ['amazing(令人惊讶) vs amazed(感到惊讶)', 'be amazed at/by 对...感到惊讶']
  },
  analyze: {
    collocations: ['analyze data 分析数据', 'analyze the cause 分析原因'],
    derivatives: ['analysis n. 分析', 'analyst n. 分析师', 'analytical adj. 分析的'],
    wordForms: { noun: 'analysis', adjective: 'analytical', pastTense: 'analyzed', pastParticiple: 'analyzed', presentParticiple: 'analyzing' },
    synonyms: ['examine 检查', 'study 研究', 'investigate 调查', 'evaluate 评估'],
    antonyms: ['ignore 忽视', 'overlook 忽略'],
    examPoints: ['analysis 复数 analyses', 'analytical(英) = analytic(美)']
  },
  announce: {
    collocations: ['announce the result 宣布结果', 'announce to the public 向公众宣布'],
    derivatives: ['announcement n. 宣布', 'announcer n. 广播员'],
    wordForms: { noun: 'announcement', pastTense: 'announced', pastParticiple: 'announced', presentParticiple: 'announcing' },
    synonyms: ['declare 宣布', 'proclaim 宣告', 'broadcast 广播', 'reveal 揭示'],
    antonyms: ['conceal 隐藏', 'hide 隐藏', 'withhold 保留'],
    examPoints: ['announce + that 从句', 'make an announcement 宣布']
  },
  anxious: {
    collocations: ['be anxious about 担心', 'be anxious to do 急于做', 'anxious for 渴望'],
    derivatives: ['anxiety n. 焦虑', 'anxiously adv. 焦虑地'],
    wordForms: { noun: 'anxiety', adverb: 'anxiously' },
    synonyms: ['worried 担心的', 'nervous 紧张的', 'uneasy 不安的', 'concerned 关心的'],
    antonyms: ['calm 平静的', 'relaxed 放松的', 'confident 自信的', 'composed 镇定的'],
    examPoints: ['be anxious about + 名词', 'be anxious to do = be eager to do 急于做']
  },
  apply: {
    collocations: ['apply for 申请', 'apply to 适用于', 'apply oneself to 致力于', 'apply A to B 把A应用于B'],
    derivatives: ['application n. 申请；应用', 'applicant n. 申请人', 'applicable adj. 适用的', 'applied adj. 应用的'],
    wordForms: { noun: 'application', adjective: 'applicable', pastTense: 'applied', pastParticiple: 'applied', presentParticiple: 'applying' },
    synonyms: ['request 请求', 'petition 请求', 'implement 实施', 'utilize 利用'],
    antonyms: ['withdraw 撤回', 'cancel 取消'],
    examPoints: ['apply for + 职位/学校', 'apply to + 对象', 'to 是介词后接 doing']
  },
  approach: {
    collocations: ['an approach to doing ...的方法', 'approach sb 接近某人', 'make an approach to 接近'],
    derivatives: ['approachable adj. 可接近的'],
    wordForms: { adjective: 'approachable', pastTense: 'approached', pastParticiple: 'approached', presentParticiple: 'approaching' },
    synonyms: ['method 方法', 'way 方法', 'technique 技巧', 'draw near 接近'],
    antonyms: ['avoid 避免', 'withdraw 撤回', 'retreat 撤退'],
    examPoints: ['an approach to doing (to是介词)', 'approach 作动词和名词都常用']
  },
  argue: {
    collocations: ['argue with sb 与某人争论', 'argue for 支持', 'argue against 反对', 'argue that 辩称'],
    derivatives: ['argument n. 论点；争论', 'argumentative adj. 好争论的'],
    wordForms: { noun: 'argument', adjective: 'argumentative', pastTense: 'argued', pastParticiple: 'argued', presentParticiple: 'arguing' },
    synonyms: ['debate 辩论', 'dispute 争论', 'contend 争夺', 'reason 推理'],
    antonyms: ['agree 同意', 'consent 同意', 'concede 让步'],
    examPoints: ['argument 不双写 e', 'argue sb into doing 说服某人做']
  },
  arrange: {
    collocations: ['arrange for 安排', 'arrange to do 安排做', 'arrange a meeting 安排会议'],
    derivatives: ['arrangement n. 安排', 'arranger n. 编曲者'],
    wordForms: { noun: 'arrangement', pastTense: 'arranged', pastParticiple: 'arranged', presentParticiple: 'arranging' },
    synonyms: ['organize 组织', 'plan 计划', 'schedule 安排', 'prepare 准备'],
    antonyms: ['disarrange 打乱', 'disrupt 破坏'],
    examPoints: ['arrange for sb to do sth 安排某人做某事', 'make arrangements for 为...做安排']
  },
  assume: {
    collocations: ['assume responsibility 承担责任', 'assume that 假定'],
    derivatives: ['assumption n. 假设', 'assuming conj. 假如'],
    wordForms: { noun: 'assumption', pastTense: 'assumed', pastParticiple: 'assumed', presentParticiple: 'assuming' },
    synonyms: ['suppose 假设', 'presume 假定', 'take for granted 视为理所当然', 'believe 相信'],
    antonyms: ['prove 证明', 'demonstrate 证明', 'verify 核实'],
    examPoints: ['assuming that = supposing 假如', 'make an assumption 做出假设']
  },
  avoid: {
    collocations: ['avoid doing 避免做', 'avoid sb 避开某人'],
    derivatives: ['avoidance n. 避免', 'avoidable adj. 可避免的', 'unavoidable adj. 不可避免的'],
    wordForms: { noun: 'avoidance', adjective: 'avoidable', pastTense: 'avoided', pastParticiple: 'avoided', presentParticiple: 'avoiding' },
    synonyms: ['evade 逃避', 'escape 逃跑', 'dodge 躲避', 'shun 避开'],
    antonyms: ['face 面对', 'confront 面对', 'encounter 遭遇', 'meet 满足'],
    examPoints: ['后接 doing 不接 to do', 'unavoidable = inevitable 不可避免的']
  },
  aware: {
    collocations: ['be aware of 意识到', 'become aware of 逐渐意识到'],
    derivatives: ['awareness n. 意识', 'unaware adj. 未意识到的'],
    wordForms: { noun: 'awareness' },
    synonyms: ['conscious 有意识的', 'mindful 留心的', 'alert 警觉的', 'informed 知情的'],
    antonyms: ['unaware 未察觉的', 'ignorant 无知的', 'oblivious 未察觉的'],
    examPoints: ['be aware of + 名词', 'be aware that + 从句', '反义词 unaware']
  },
  benefit: {
    collocations: ['benefit from 从...受益', 'for the benefit of 为了...的利益', 'be of benefit 有益'],
    derivatives: ['beneficial adj. 有益的', 'beneficiary n. 受益人'],
    wordForms: { adjective: 'beneficial', pastTense: 'benefited', pastParticiple: 'benefited', presentParticiple: 'benefiting' },
    synonyms: ['advantage 优势', 'profit 获利', 'gain 获得', 'help 帮助'],
    antonyms: ['harm 伤害', 'damage 损害', 'disadvantage 劣势', 'loss 损失'],
    examPoints: ['benefit from (主动受益)', 'be beneficial to (对...有益)', '美式 benefited/benefiting']
  },
  capable: {
    collocations: ['be capable of 能够', 'capable of doing 有能力做'],
    derivatives: ['capability n. 能力', 'capably adv. 有能力地', 'incapable adj. 无能力的'],
    wordForms: { noun: 'capability', adverb: 'capably' },
    synonyms: ['able 有能力的', 'competent 胜任的', 'qualified 合格的', 'proficient 熟练的'],
    antonyms: ['incapable 无能力的', 'unable 不能的', 'incompetent 不胜任的'],
    examPoints: ['be capable of doing (不是 to do)', 'capable ≠ able(后接 to do)']
  },
  cause: {
    collocations: ['cause sb to do 导致某人做', 'the cause of ...的原因', 'cause and effect 因果'],
    derivatives: ['causal adj. 因果的'],
    wordForms: { adjective: 'causal', pastTense: 'caused', pastParticiple: 'caused', presentParticiple: 'causing' },
    synonyms: ['lead to 导致', 'result in 导致', 'bring about 引起', 'trigger 触发'],
    antonyms: ['prevent 阻止', 'stop 停止', 'hinder 阻碍'],
    examPoints: ['cause sb to do sth 导致某人做某事', 'cause 作名词 = reason']
  },
  challenge: {
    collocations: ['challenge sb to do 向某人挑战', 'take up the challenge 接受挑战', 'face a challenge 面临挑战'],
    derivatives: ['challenger n. 挑战者', 'challenging adj. 有挑战性的'],
    wordForms: { adjective: 'challenging', pastTense: 'challenged', pastParticiple: 'challenged', presentParticiple: 'challenging' },
    synonyms: ['defy 违抗', 'confront 面对', 'dare 敢于', 'test 测试'],
    antonyms: ['accept 接受', 'yield to 屈服于', 'surrender to 屈服于'],
    examPoints: ['challenging = demanding 有挑战性的', 'a challenging task 一项挑战性任务']
  },
  charge: {
    collocations: ['in charge of 负责', 'take charge of 掌管', 'charge sb with 指控某人', 'free of charge 免费'],
    derivatives: ['charger n. 充电器'],
    wordForms: { pastTense: 'charged', pastParticiple: 'charged', presentParticiple: 'charging' },
    synonyms: ['accuse 指控', 'blame 责备', 'fee 费用', 'cost 花费', 'responsibility 责任'],
    antonyms: ['discharge 排出', 'free 释放', 'release 释放'],
    examPoints: ['in charge of (主动负责)', 'in the charge of (被...管理)', 'charge sb with sth 指控某人某事']
  },
  claim: {
    collocations: ['claim that 声称', 'claim to have done 声称做过', 'make a claim 提出索赔'],
    derivatives: ['claimant n. 索赔人'],
    wordForms: { noun: 'claim', pastTense: 'claimed', pastParticiple: 'claimed', presentParticiple: 'claiming' },
    synonyms: ['assert 断言', 'declare 宣布', 'state 陈述', 'maintain 维持'],
    antonyms: ['deny 否认', 'disclaim 否认', 'reject 拒绝'],
    examPoints: ['claim to do / claim that 声称做/声称', 'claim 作名词=索赔']
  },
  collect: {
    collocations: ['collect data 收集数据', 'collect stamps 集邮', 'collect oneself 镇定下来'],
    derivatives: ['collection n. 收集', 'collector n. 收藏家', 'collective adj. 集体的', 'collectively adv. 共同地'],
    wordForms: { noun: 'collection', adjective: 'collective', adverb: 'collectively', pastTense: 'collected', pastParticiple: 'collected', presentParticiple: 'collecting' },
    synonyms: ['gather 聚集', 'assemble 集合', 'accumulate 积累', 'amass 积聚'],
    antonyms: ['scatter 分散', 'distribute 分配', 'disperse 分散'],
    examPoints: ['collection 可数', 'a collection of + 复数名词']
  },
  commit: {
    collocations: ['commit a crime 犯罪', 'commit suicide 自杀', 'commit oneself to 致力于', 'be committed to 投入于'],
    derivatives: ['commitment n. 承诺', 'committed adj. 忠诚的'],
    wordForms: { noun: 'commitment', adjective: 'committed', pastTense: 'committed', pastParticiple: 'committed', presentParticiple: 'committing' },
    synonyms: ['pledge 保证', 'promise 承诺', 'dedicate 致力于', 'devote 奉献'],
    antonyms: ['abandon 放弃', 'withdraw 撤回', 'quit 放弃'],
    examPoints: ['commit a crime/suicide/error 犯罪/自杀/犯错', 'be committed to + doing 致力于做(接动名词)']
  },
  communicate: {
    collocations: ['communicate with 与...交流', 'communicate sth to 把...传达给'],
    derivatives: ['communication n. 交流', 'communicative adj. 健谈的', 'communicator n. 沟通者'],
    wordForms: { noun: 'communication', adjective: 'communicative', pastTense: 'communicated', pastParticiple: 'communicated', presentParticiple: 'communicating' },
    synonyms: ['convey 传达', 'transmit 传输', 'share 分享', 'express 表达'],
    antonyms: ['withhold 保留', 'conceal 隐藏', 'hide 隐藏'],
    examPoints: ['communicate with sb 与某人交流', 'communication 不可数名词']
  },
  compare: {
    collocations: ['compare A with B 把A与B比较', 'compare A to B 把A比作B', 'compared with/to 与...相比', 'beyond compare 无与伦比'],
    derivatives: ['comparison n. 比较', 'comparative adj. 比较的', 'comparable adj. 可比较的'],
    wordForms: { noun: 'comparison', adjective: 'comparable', pastTense: 'compared', pastParticiple: 'compared', presentParticiple: 'comparing' },
    synonyms: ['contrast 对比', 'evaluate 评估', 'assess 评估', 'match 匹配'],
    antonyms: ['distinguish 区分', 'differentiate 区分', 'contrast 对比'],
    examPoints: ['compare with (比较差异)', 'compare to (比喻)', 'compared to/with 作状语']
  },
  compete: {
    collocations: ['compete with/against 与...竞争', 'compete for 争夺', 'compete in 参加比赛'],
    derivatives: ['competition n. 竞争', 'competitor n. 竞争者', 'competitive adj. 有竞争力的', 'competence n. 能力'],
    wordForms: { noun: 'competition', adjective: 'competitive', pastTense: 'competed', pastParticiple: 'competed', presentParticiple: 'competing' },
    synonyms: ['contend 争夺', 'rival 竞争', 'contest 竞争', 'vie 竞争'],
    antonyms: ['cooperate 合作', 'collaborate 合作', 'yield 屈服'],
    examPoints: ['compete against/with sb for sth 与某人竞争某物', 'competition 可数']
  },
  complain: {
    collocations: ['complain about 抱怨', 'complain to sb 向某人投诉', 'complain that 抱怨说'],
    derivatives: ['complaint n. 抱怨', 'complainant n. 投诉人'],
    wordForms: { noun: 'complaint', pastTense: 'complained', pastParticiple: 'complained', presentParticiple: 'complaining' },
    synonyms: ['protest 抗议', 'grumble 抱怨', 'object 反对', 'criticize 批评'],
    antonyms: ['praise 赞扬', 'commend 表扬', 'applaud 鼓掌'],
    examPoints: ['complain to sb about sth 向某人抱怨某事', 'make a complaint 投诉']
  },
  concern: {
    collocations: ['be concerned about 关心', 'as far as...be concerned 就...而言', 'concern oneself with 关心', 'of concern 令人担忧的'],
    derivatives: ['concerned adj. 关心的', 'concerning prep. 关于', 'unconcerned adj. 不关心的'],
    wordForms: { adjective: 'concerned', pastTense: 'concerned', pastParticiple: 'concerned', presentParticiple: 'concerning' },
    synonyms: ['worry 担心', 'involve 涉及', 'relate to 有关', 'affect 影响'],
    antonyms: ['ignore 忽视', 'disregard 无视', 'overlook 忽略'],
    examPoints: ['as far as I\'m concerned 就我而言', 'concerned(前置=有关的, 后置=关切的)']
  },
  conclude: {
    collocations: ['conclude that 得出结论', 'conclude by doing 以...结束', 'to conclude 总之'],
    derivatives: ['conclusion n. 结论', 'conclusive adj. 决定性的'],
    wordForms: { noun: 'conclusion', adjective: 'conclusive', pastTense: 'concluded', pastParticiple: 'concluded', presentParticiple: 'concluding' },
    synonyms: ['finish 完成', 'end 结束', 'decide 决定', 'determine 决定'],
    antonyms: ['begin 开始', 'start 开始', 'commence 开始'],
    examPoints: ['draw/reach a conclusion 得出结论', 'in conclusion 最后']
  },
  condition: {
    collocations: ['on condition that 条件是', 'in good condition 状况良好', 'under...conditions 在...条件下'],
    derivatives: ['conditional adj. 有条件的', 'conditioner n. 护发素'],
    wordForms: { adjective: 'conditional' },
    synonyms: ['state 陈述', 'situation 情况', 'circumstance 情况', 'requirement 要求'],
    antonyms: [],
    examPoints: ['on condition that = provided that 条件是', 'conditions 复数=环境/条件']
  },
  conduct: {
    collocations: ['conduct a survey 进行调查', 'conduct an experiment 做实验', 'conduct oneself 表现'],
    derivatives: ['conductor n. 指挥；导体', 'conduction n. 传导', 'conductive adj. 导电的'],
    wordForms: { noun: 'conduction', adjective: 'conductive', pastTense: 'conducted', pastParticiple: 'conducted', presentParticiple: 'conducting' },
    synonyms: ['carry out 执行', 'perform 执行', 'direct 指导', 'guide 引导', 'behavior 行为'],
    antonyms: ['misconduct 不当行为'],
    examPoints: ['conduct(v.执行) /kənˈdʌkt/', 'conduct(n.行为) /ˈkɒndʌkt/']
  },
  confidence: {
    collocations: ['have confidence in 对...有信心', 'with confidence 自信地', 'lack confidence 缺乏信心'],
    derivatives: ['confident adj. 自信的', 'confidently adv. 自信地', 'confide v. 吐露', 'confidential adj. 机密的'],
    wordForms: { adjective: 'confident', adverb: 'confidently' },
    synonyms: ['assurance 保证', 'certainty 确定', 'trust 信任', 'faith 信任'],
    antonyms: ['doubt 怀疑', 'uncertainty 不确定', 'timidity 胆怯'],
    examPoints: ['be confident of/about 对...有信心', 'have confidence in sb 对某人有信心']
  },
  confirm: {
    collocations: ['confirm that 确认', 'confirm sb in 使某人坚定', 'confirm a booking 确认预订'],
    derivatives: ['confirmation n. 确认', 'confirmed adj. 确认的'],
    wordForms: { noun: 'confirmation', adjective: 'confirmed', pastTense: 'confirmed', pastParticiple: 'confirmed', presentParticiple: 'confirming' },
    synonyms: ['verify 核实', 'validate 验证', 'prove 证明', 'establish 建立'],
    antonyms: ['deny 否认', 'contradict 反驳', 'refute 反驳'],
    examPoints: ['confirm + that 从句', 'confirmation 可数']
  },
  consider: {
    collocations: ['consider doing 考虑做', 'consider...as 把...看作', 'considering that 考虑到'],
    derivatives: ['consideration n. 考虑', 'considerate adj. 体贴的', 'considerable adj. 相当大的', 'considered adj. 深思熟虑的'],
    wordForms: { noun: 'consideration', adjective: 'considerable', pastTense: 'considered', pastParticiple: 'considered', presentParticiple: 'considering' },
    synonyms: ['think about 考虑', 'ponder 思考', 'contemplate 沉思', 'regard 看待'],
    antonyms: ['disregard 无视', 'ignore 忽视', 'overlook 忽略'],
    examPoints: ['后接 doing 不接 to do', 'considerate ≠ considerable(相当大的)']
  },
  contribute: {
    collocations: ['contribute to 贡献；导致', 'contribute A to B 把A贡献给B', 'make a contribution to 对...做出贡献'],
    derivatives: ['contribution n. 贡献', 'contributor n. 贡献者', 'contributory adj. 促成的'],
    wordForms: { noun: 'contribution', adjective: 'contributory', pastTense: 'contributed', pastParticiple: 'contributed', presentParticiple: 'contributing' },
    synonyms: ['donate 捐赠', 'provide 提供', 'add to 增加', 'lead to 导致'],
    antonyms: ['withhold 保留', 'detract 减损', 'subtract 减去'],
    examPoints: ['contribute to = lead to (to是介词)', 'make a contribution to 对...做出贡献']
  },
  convince: {
    collocations: ['convince sb of 使某人确信', 'convince sb to do 说服某人做', 'be convinced that 确信'],
    derivatives: ['convincing adj. 有说服力的', 'conviction n. 信念'],
    wordForms: { noun: 'conviction', adjective: 'convincing', pastTense: 'convinced', pastParticiple: 'convinced', presentParticiple: 'convincing' },
    synonyms: ['persuade 说服', 'assure 保证', 'satisfy 满足', 'prove to 证明'],
    antonyms: ['doubt 怀疑', 'disbelieve 不信', 'dissuade 劝阻'],
    examPoints: ['convince sb of sth 使某人确信某事', 'be convinced that 确信', 'convincing argument 令人信服的论点']
  },
  create: {
    collocations: ['create jobs 创造就业', 'create a good impression 留下好印象', 'create conditions 创造条件'],
    derivatives: ['creation n. 创造', 'creative adj. 有创造力的', 'creativity n. 创造力', 'creator n. 创造者', 'creature n. 生物'],
    wordForms: { noun: 'creation', adjective: 'creative', pastTense: 'created', pastParticiple: 'created', presentParticiple: 'creating' },
    synonyms: ['produce 生产', 'make 制造', 'generate 产生', 'invent 发明', 'establish 建立'],
    antonyms: ['destroy 破坏', 'demolish 拆除', 'ruin 毁坏', 'annihilate 消灭'],
    examPoints: ['creative = innovative 有创造力的', 'creature = living being 生物']
  },
  decide: {
    collocations: ['decide to do 决定做', 'decide on 决定选用', 'decide against 决定不'],
    derivatives: ['decision n. 决定', 'decisive adj. 决定性的', 'decidedly adv. 果断地'],
    wordForms: { noun: 'decision', adjective: 'decisive', adverb: 'decidedly', pastTense: 'decided', pastParticiple: 'decided', presentParticiple: 'deciding' },
    synonyms: ['determine 决定', 'resolve 解决', 'settle 解决', 'conclude 得出结论'],
    antonyms: ['hesitate 犹豫', 'waver 动摇', 'delay 延迟'],
    examPoints: ['decide to do = make a decision to do 决定做', 'decisive = determining 决定性的']
  },
  declare: {
    collocations: ['declare war on 对...宣战', 'declare that 宣布', 'declare oneself 表明立场'],
    derivatives: ['declaration n. 宣布', 'declared adj. 公开宣称的'],
    wordForms: { noun: 'declaration', pastTense: 'declared', pastParticiple: 'declared', presentParticiple: 'declaring' },
    synonyms: ['announce 宣布', 'proclaim 宣告', 'state 陈述', 'assert 断言'],
    antonyms: ['conceal 隐藏', 'hide 隐藏', 'withhold 保留'],
    examPoints: ['declare + that 从句', 'Declaration of Independence 独立宣言']
  },
  decline: {
    collocations: ['decline to do 拒绝做', 'on the decline 在下降', 'a sharp decline 急剧下降'],
    derivatives: [],
    wordForms: { pastTense: 'declined', pastParticiple: 'declined', presentParticiple: 'declining' },
    synonyms: ['decrease 减少', 'drop 下降', 'fall 落下', 'refuse 拒绝', 'reject 拒绝'],
    antonyms: ['increase 增加', 'rise 上升', 'accept 接受', 'improve 改善'],
    examPoints: ['decline to do = refuse to do 拒绝做', 'decline 作名词=下降趋势']
  },
  defend: {
    collocations: ['defend against 防御', 'defend sb from 保护某人免受', 'defend one\'s rights 捍卫权利'],
    derivatives: ['defense n. 防御', 'defensive adj. 防御性的', 'defendant n. 被告', 'defender n. 防御者'],
    wordForms: { noun: 'defense', adjective: 'defensive', pastTense: 'defended', pastParticiple: 'defended', presentParticiple: 'defending' },
    synonyms: ['protect 保护', 'guard 守卫', 'shield 保护', 'safeguard 保护'],
    antonyms: ['attack 攻击', 'assault 袭击', 'invade 入侵'],
    examPoints: ['defend sb from/against 保护某人免受', 'in defense of 保卫']
  },
  deliver: {
    collocations: ['deliver a speech 发表演讲', 'deliver goods 送货', 'deliver a baby 接生'],
    derivatives: ['delivery n. 递送', 'deliveryman n. 送货员'],
    wordForms: { noun: 'delivery', pastTense: 'delivered', pastParticiple: 'delivered', presentParticiple: 'delivering' },
    synonyms: ['convey 传达', 'transport 运输', 'hand over 移交', 'give 给予'],
    antonyms: ['receive 收到', 'collect 收集', 'retain 保留'],
    examPoints: ['deliver a speech/lecture 发表演讲/讲座', 'take delivery of 收货']
  },
  demand: {
    collocations: ['demand to do 要求做', 'in demand 有需求', 'meet the demand 满足需求', 'on demand 一经要求'],
    derivatives: ['demanding adj. 要求高的'],
    wordForms: { adjective: 'demanding', pastTense: 'demanded', pastParticiple: 'demanded', presentParticiple: 'demanding' },
    synonyms: ['require 需要', 'request 请求', 'insist 坚持', 'need 需要'],
    antonyms: ['supply 供应', 'offer 提供', 'grant 授予'],
    examPoints: ['demand + that 从句用虚拟语气(should + do)', 'in demand ≠ on demand 有需求 ≠ 按需(易混)']
  },
  depend: {
    collocations: ['depend on 依赖', 'depend on sb to do 指望某人做', 'it depends 视情况而定'],
    derivatives: ['dependence n. 依赖', 'dependent adj. 依赖的', 'independent adj. 独立的', 'independence n. 独立'],
    wordForms: { noun: 'dependence', adjective: 'dependent' },
    synonyms: ['rely 依赖', 'count on 依靠', 'hinge on 取决于', 'rest on 依靠'],
    antonyms: ['independent 独立的', 'autonomous 自主的', 'self-sufficient 自给自足的'],
    examPoints: ['depend on = rely on 依赖', 'dependent on ≠ independent of 依赖 ≠ 独立']
  },
  describe: {
    collocations: ['describe...as 把...描述为', 'describe in detail 详细描述'],
    derivatives: ['description n. 描述', 'descriptive adj. 描述性的'],
    wordForms: { noun: 'description', adjective: 'descriptive', pastTense: 'described', pastParticiple: 'described', presentParticiple: 'describing' },
    synonyms: ['depict 描绘', 'portray 描绘', 'characterize 描述', 'illustrate 说明'],
    antonyms: [],
    examPoints: ['describe A as B 把A描述为B', 'beyond description 难以描述']
  },
  desire: {
    collocations: ['desire to do 渴望做', 'desire for 渴望', 'at sb\'s desire 应某人要求'],
    derivatives: ['desirable adj. 令人向往的', 'undesirable adj. 不想要的'],
    wordForms: { adjective: 'desirable', pastTense: 'desired', pastParticiple: 'desired', presentParticiple: 'desiring' },
    synonyms: ['want 想要', 'wish 希望', 'long for 渴望', 'crave 渴望'],
    antonyms: ['dislike 不喜欢', 'despise 鄙视', 'reject 拒绝'],
    examPoints: ['desire to do 渴望做', 'desirable ≠ desirous(渴望的)']
  },
  determine: {
    collocations: ['determine to do 决心做', 'be determined to do 下定决心', 'determine on 决定'],
    derivatives: ['determination n. 决心', 'determined adj. 坚决的'],
    wordForms: { noun: 'determination', adjective: 'determined', pastTense: 'determined', pastParticiple: 'determined', presentParticiple: 'determining' },
    synonyms: ['decide 决定', 'resolve 解决', 'establish 建立', 'ascertain 查明'],
    antonyms: ['hesitate 犹豫', 'waver 动摇', 'fluctuate 波动'],
    examPoints: ['determine to do (动作)', 'be determined to do (状态)']
  },
  develop: {
    collocations: ['develop from 从...发展而来', 'develop into 发展成为', 'develop a habit 养成习惯'],
    derivatives: ['development n. 发展', 'developing adj. 发展中的', 'developed adj. 发达的', 'developer n. 开发者'],
    wordForms: { noun: 'development', adjective: 'developed', pastTense: 'developed', pastParticiple: 'developed', presentParticiple: 'developing' },
    synonyms: ['grow 增长', 'expand 扩大', 'evolve 演变', 'progress 进步'],
    antonyms: ['decline 拒绝；下降', 'regress 倒退', 'deteriorate 恶化'],
    examPoints: ['developing country 发展中国家', 'developed country 发达国家']
  },
  devote: {
    collocations: ['devote oneself to 致力于', 'devote...to doing 把...奉献给', 'be devoted to 专心于'],
    derivatives: ['devotion n. 奉献', 'devoted adj. 忠诚的'],
    wordForms: { noun: 'devotion', adjective: 'devoted', pastTense: 'devoted', pastParticiple: 'devoted', presentParticiple: 'devoting' },
    synonyms: ['dedicate 致力于', 'commit 承诺', 'pledge 保证', 'allocate 分配'],
    antonyms: ['neglect 忽视', 'abandon 放弃', 'ignore 忽视'],
    examPoints: ['devote...to doing (to是介词)', 'be devoted to + doing/名词']
  },
  discover: {
    collocations: ['discover that 发现', 'discover sb doing 发现某人在做'],
    derivatives: ['discovery n. 发现', 'discoverer n. 发现者'],
    wordForms: { noun: 'discovery', pastTense: 'discovered', pastParticiple: 'discovered', presentParticiple: 'discovering' },
    synonyms: ['find 找到', 'detect 察觉', 'uncover 揭露', 'reveal 揭示', 'unearth 发掘'],
    antonyms: ['hide 隐藏', 'conceal 隐藏', 'cover 覆盖', 'bury 埋葬'],
    examPoints: ['make a discovery 做出发现', 'discover sb doing sth 发现某人正在做']
  },
  effective: {
    collocations: ['effective measures 有效措施', 'become effective 生效', 'effective in 在...方面有效'],
    derivatives: ['effect n. 效果', 'effectively adv. 有效地', 'effectiveness n. 有效性'],
    wordForms: { noun: 'effect', adverb: 'effectively' },
    synonyms: ['efficient 高效的', 'productive 多产的', 'successful 成功的', 'potent 有效的'],
    antonyms: ['ineffective 无效的', 'useless 无用的', 'futile 徒劳的'],
    examPoints: ['effective(有效果的) ≠ efficient(有效率的)', 'take effect 生效']
  },
  effort: {
    collocations: ['make an effort to do 努力做', 'spare no effort to do 不遗余力', 'with effort 费力地', 'efforts to do 努力做'],
    derivatives: [],
    wordForms: {},
    synonyms: ['attempt 尝试', 'endeavor 努力', 'struggle 挣扎', 'exertion 努力'],
    antonyms: ['ease 减轻', 'laziness 懒惰', 'idleness 懒惰'],
    examPoints: ['make an effort/efforts to do 努力做', 'spare no effort to do 不遗余力做']
  },
  employ: {
    collocations: ['employ sb to do 雇佣某人做', 'be employed in 从事于', 'employ a method 使用方法'],
    derivatives: ['employee n. 雇员', 'employer n. 雇主', 'employment n. 就业', 'unemployment n. 失业', 'unemployed adj. 失业的'],
    wordForms: { noun: 'employment', adjective: 'employed', pastTense: 'employed', pastParticiple: 'employed', presentParticiple: 'employing' },
    synonyms: ['hire 雇佣', 'engage 参与', 'recruit 招募', 'use 使用', 'apply 申请'],
    antonyms: ['fire 解雇', 'dismiss 解雇', 'lay off 解雇', 'unemploy 解雇'],
    examPoints: ['employ = use (使用方法)', 'be employed in doing 从事于']
  },
  encourage: {
    collocations: ['encourage sb to do 鼓励某人做', 'encourage sb in sth 在...方面鼓励'],
    derivatives: ['encouragement n. 鼓励', 'encouraging adj. 令人鼓舞的'],
    wordForms: { noun: 'encouragement', adjective: 'encouraging', pastTense: 'encouraged', pastParticiple: 'encouraged', presentParticiple: 'encouraging' },
    synonyms: ['inspire 激励', 'motivate 激励', 'urge 催促', 'support 支持'],
    antonyms: ['discourage 使气馁', 'deter 阻止', 'dishearten 使灰心'],
    examPoints: ['encourage sb to do (反义: discourage sb from doing)', 'encouraging news 令人鼓舞的消息']
  },
  environment: {
    collocations: ['protect the environment 保护环境', 'in a...environment 在...环境中'],
    derivatives: ['environmental adj. 环境的', 'environmentally adv. 环境方面地', 'environmentalist n. 环保主义者'],
    wordForms: { adjective: 'environmental', adverb: 'environmentally' },
    synonyms: ['surroundings 环境', 'setting 环境', 'habitat 栖息地', 'context 背景'],
    antonyms: [],
    examPoints: ['environmental protection 环境保护', 'environmentally friendly 环保的']
  },
  establish: {
    collocations: ['establish a company 创办公司', 'establish a relationship 建立关系', 'establish oneself as 确立自己为'],
    derivatives: ['establishment n. 建立', 'established adj. 既定的'],
    wordForms: { noun: 'establishment', adjective: 'established', pastTense: 'established', pastParticiple: 'established', presentParticiple: 'establishing' },
    synonyms: ['set up 建立', 'found 建立', 'create 创造', 'institute 建立'],
    antonyms: ['abolish 废除', 'dismantle 拆除', 'destroy 破坏'],
    examPoints: ['establish = set up 建立', 'an established fact 既定事实']
  },
  evaluate: {
    collocations: ['evaluate the effect 评估效果', 'evaluate performance 评估表现'],
    derivatives: ['evaluation n. 评估', 'evaluator n. 评估者'],
    wordForms: { noun: 'evaluation', pastTense: 'evaluated', pastParticiple: 'evaluated', presentParticiple: 'evaluating' },
    synonyms: ['assess 评估', 'appraise 评估', 'judge 判断', 'rate 评估'],
    antonyms: ['guess 猜测', 'speculate 推测', 'ignore 忽视'],
    examPoints: ['evaluate = assess 评估', 'make an evaluation 做出评估']
  },
  evidence: {
    collocations: ['evidence for...的证据', 'in evidence 显而易见', 'provide evidence 提供证据'],
    derivatives: ['evident adj. 明显的', 'evidently adv. 显然地'],
    wordForms: { adjective: 'evident', adverb: 'evidently' },
    synonyms: ['proof 证明', 'indication 指示', 'sign 标志', 'testimony 证词'],
    antonyms: ['concealment 隐藏', 'hiding 隐藏'],
    examPoints: ['evidence 不可数名词', 'evident = obvious 明显的']
  },
  examine: {
    collocations: ['examine carefully 仔细检查', 'examine sb on 考查某人'],
    derivatives: ['examination n. 检查；考试', 'examiner n. 考官', 'examinee n. 考生'],
    wordForms: { noun: 'examination', pastTense: 'examined', pastParticiple: 'examined', presentParticiple: 'examining' },
    synonyms: ['inspect 检查', 'investigate 调查', 'analyze 分析', 'test 测试'],
    antonyms: ['ignore 忽视', 'overlook 忽略', 'neglect 忽视'],
    examPoints: ['examination = exam 考试(缩写)', 'medical examination 体检']
  },
  exist: {
    collocations: ['exist in 存在于', 'exist on 靠...生存', 'come into existence 产生'],
    derivatives: ['existence n. 存在', 'existent adj. 存在的', 'coexistence n. 共存'],
    wordForms: { noun: 'existence', adjective: 'existent' },
    synonyms: ['be 是', 'live 生活', 'survive 幸存', 'occur 发生'],
    antonyms: ['die 死亡', 'disappear 消失', 'vanish 消失', 'cease 停止'],
    examPoints: ['come into existence = come into being 形成', 'in existence 现存的']
  },
  expand: {
    collocations: ['expand into 扩展到', 'expand on 详述'],
    derivatives: ['expansion n. 扩张', 'expansive adj. 广阔的'],
    wordForms: { noun: 'expansion', adjective: 'expansive', pastTense: 'expanded', pastParticiple: 'expanded', presentParticiple: 'expanding' },
    synonyms: ['enlarge 扩大', 'extend 延伸', 'grow 增长', 'broaden 拓宽'],
    antonyms: ['shrink 缩小', 'contract 收缩', 'reduce 减少', 'diminish 减少'],
    examPoints: ['expand ≠ expend(花费)', 'expansion 不可数']
  },
  explain: {
    collocations: ['explain sth to sb 向某人解释', 'explain that 解释说', 'explain oneself 说明意图'],
    derivatives: ['explanation n. 解释', 'explanatory adj. 解释性的'],
    wordForms: { noun: 'explanation', adjective: 'explanatory', pastTense: 'explained', pastParticiple: 'explained', presentParticiple: 'explaining' },
    synonyms: ['clarify 澄清', 'elucidate 阐明', 'illustrate 说明', 'demonstrate 证明'],
    antonyms: ['confuse 混淆', 'obscure 掩盖', 'muddle 混淆'],
    examPoints: ['explain sth to sb (不是 explain sb sth)', 'give an explanation 做出解释']
  },
  explore: {
    collocations: ['explore the possibility 探索可能性', 'explore the world 探索世界'],
    derivatives: ['exploration n. 探索', 'explorer n. 探险家', 'exploratory adj. 探索性的'],
    wordForms: { noun: 'exploration', adjective: 'exploratory', pastTense: 'explored', pastParticiple: 'explored', presentParticiple: 'exploring' },
    synonyms: ['investigate 调查', 'discover 发现', 'examine 检查', 'probe 探究'],
    antonyms: ['ignore 忽视', 'neglect 忽视', 'overlook 忽略'],
    examPoints: ['exploration 不可数', 'space exploration 太空探索']
  },
  expose: {
    collocations: ['be exposed to 暴露于', 'expose sb to 使某人接触', 'expose oneself 暴露自己'],
    derivatives: ['exposure n. 暴露', 'exposed adj. 暴露的'],
    wordForms: { noun: 'exposure', adjective: 'exposed', pastTense: 'exposed', pastParticiple: 'exposed', presentParticiple: 'exposing' },
    synonyms: ['reveal 揭示', 'uncover 揭露', 'disclose 揭露', 'show 展示'],
    antonyms: ['hide 隐藏', 'conceal 隐藏', 'cover 覆盖', 'shield 保护'],
    examPoints: ['be exposed to + 名词', 'exposure to sth 暴露于某物']
  },
  express: {
    collocations: ['express oneself 表达自己', 'express concern 表达关切', 'express one\'s thanks 表达感谢'],
    derivatives: ['expression n. 表达', 'expressive adj. 富有表现力的', 'expressly adv. 明确地'],
    wordForms: { noun: 'expression', adjective: 'expressive', adverb: 'expressly', pastTense: 'expressed', pastParticiple: 'expressed', presentParticiple: 'expressing' },
    synonyms: ['convey 传达', 'communicate 交流', 'state 陈述', 'articulate 表达'],
    antonyms: ['suppress 镇压', 'repress 压抑', 'conceal 隐藏'],
    examPoints: ['expression 可数(表情)不可数(表达)', 'freedom of expression 言论自由']
  },
  fail: {
    collocations: ['fail to do 未能做', 'fail in 在...失败', 'without fail 务必'],
    derivatives: ['failure n. 失败', 'failing n. 缺点'],
    wordForms: { noun: 'failure', pastTense: 'failed', pastParticiple: 'failed', presentParticiple: 'failing' },
    synonyms: ['not succeed 失败', 'fall short 未达到', 'miss 错过'],
    antonyms: ['succeed 成功', 'achieve 实现', 'accomplish 完成'],
    examPoints: ['fail to do = fail in doing 做某事失败', 'failure is the mother of success 失败是成功之母']
  },
  familiar: {
    collocations: ['be familiar with 熟悉', 'be familiar to 为...所熟知'],
    derivatives: ['familiarity n. 熟悉', 'familiarize v. 使熟悉', 'unfamiliar adj. 不熟悉的'],
    wordForms: { noun: 'familiarity', verb: 'familiarize' },
    synonyms: ['acquainted 熟识的', 'known 已知的', 'recognized 公认的', 'common 常见的'],
    antonyms: ['unfamiliar 不熟悉的', 'unknown 未知的', 'strange 陌生的'],
    examPoints: ['be familiar with (人熟悉物)', 'be familiar to (物为人熟知)']
  },
  finance: {
    collocations: ['finance a project 为项目提供资金', 'in finance 在金融领域'],
    derivatives: ['financial adj. 金融的', 'financially adv. 金融地', 'financier n. 金融家'],
    wordForms: { adjective: 'financial', adverb: 'financially' },
    synonyms: ['fund 资助', 'back 后退', 'sponsor 赞助', 'bankroll 资助'],
    antonyms: ['bankrupt 破产的', 'default 违约'],
    examPoints: ['financial crisis 金融危机', 'financially stable 财务稳定的']
  },
  focus: {
    collocations: ['focus on 集中于', 'focus one\'s attention on 集中注意力于', 'bring into focus 使明确'],
    derivatives: [],
    wordForms: { pastTense: 'focused', pastParticiple: 'focused', presentParticiple: 'focusing' },
    synonyms: ['concentrate 集中', 'center 集中', 'fix 修理', 'direct 指导'],
    antonyms: ['distract 分散', 'divert 转移', 'scatter 分散'],
    examPoints: ['focus on = concentrate on 集中于', 'focus 复数 focuses/foci']
  },
  function: {
    collocations: ['function as 起...作用', 'perform a function 发挥功能'],
    derivatives: ['functional adj. 功能的', 'functionally adv. 功能上地', 'malfunction n. 故障'],
    wordForms: { adjective: 'functional', adverb: 'functionally', pastTense: 'functioned', pastParticiple: 'functioned', presentParticiple: 'functioning' },
    synonyms: ['work 工作', 'operate 操作', 'serve 服务', 'role 角色'],
    antonyms: ['malfunction 故障', 'fail 失败', 'break down 崩溃'],
    examPoints: ['function as = serve as 充当', 'functional = working 功能性的']
  },
  generate: {
    collocations: ['generate electricity 发电', 'generate income 创造收入', 'generate interest 引起兴趣'],
    derivatives: ['generation n. 一代', 'generator n. 发电机', 'generative adj. 产生的'],
    wordForms: { noun: 'generation', adjective: 'generative', pastTense: 'generated', pastParticiple: 'generated', presentParticiple: 'generating' },
    synonyms: ['produce 生产', 'create 创造', 'make 制造', 'yield 屈服'],
    antonyms: ['destroy 破坏', 'eliminate 消除', 'consume 消耗'],
    examPoints: ['generate heat/electricity/income 产生热/电/收入', 'the younger generation 年轻一代']
  },
  handle: {
    collocations: ['handle a problem 处理问题', 'handle with care 小心轻放'],
    derivatives: [],
    wordForms: { pastTense: 'handled', pastParticiple: 'handled', presentParticiple: 'handling' },
    synonyms: ['deal with 处理', 'manage 管理', 'tackle 处理', 'address 处理；演说'],
    antonyms: ['ignore 忽视', 'neglect 忽视', 'avoid 避免'],
    examPoints: ['handle = deal with 处理', 'handle with care 小心轻放']
  },
  identify: {
    collocations: ['identify A with B 把A等同于B', 'identify oneself 自我介绍', 'be identified as 被认定为'],
    derivatives: ['identification n. 识别', 'identical adj. 相同的', 'identity n. 身份'],
    wordForms: { noun: 'identification', adjective: 'identical', pastTense: 'identified', pastParticiple: 'identified', presentParticiple: 'identifying' },
    synonyms: ['recognize 认出', 'distinguish 区分', 'spot 发现', 'detect 察觉'],
    antonyms: ['confuse 混淆', 'mistake 弄错', 'misidentify 误认'],
    examPoints: ['identify with sb 认同某人', 'identity card 身份证']
  },
  imagine: {
    collocations: ['imagine doing 想象做', 'imagine that 想象', 'imagine sb doing 想象某人做'],
    derivatives: ['imagination n. 想象力', 'imaginative adj. 富有想象力的', 'imaginary adj. 虚构的', 'imaginable adj. 可想象的'],
    wordForms: { noun: 'imagination', adjective: 'imaginative', pastTense: 'imagined', pastParticiple: 'imagined', presentParticiple: 'imagining' },
    synonyms: ['visualize 想象', 'picture 想象', 'conceive 构想', 'fantasize 幻想'],
    antonyms: ['realize 意识到', 'perceive 察觉', 'experience 经历'],
    examPoints: ['后接 doing 不接 to do', 'imaginative ≠ imaginary(虚构的)']
  },
  improve: {
    collocations: ['improve on/upon 改进', 'improve one\'s English 提高英语', 'improve the situation 改善状况'],
    derivatives: ['improvement n. 改进'],
    wordForms: { noun: 'improvement', pastTense: 'improved', pastParticiple: 'improved', presentParticiple: 'improving' },
    synonyms: ['enhance 增强', 'better 改善', 'upgrade 升级', 'refine 精炼'],
    antonyms: ['worsen 恶化', 'deteriorate 恶化', 'decline 拒绝；下降'],
    examPoints: ['improve on = do better than 改进', 'room for improvement 改进空间']
  },
  include: {
    collocations: ['include sth in 把...包括在', 'including... 包括...', 'included 包括在内的'],
    derivatives: ['inclusion n. 包含', 'inclusive adj. 包含的'],
    wordForms: { noun: 'inclusion', adjective: 'inclusive', pastTense: 'included', pastParticiple: 'included', presentParticiple: 'including' },
    synonyms: ['contain 包含', 'comprise 包含', 'involve 涉及', 'encompass 包含'],
    antonyms: ['exclude 排除', 'omit 省略', 'leave out 遗漏'],
    examPoints: ['including + 名词 (主动)', 'included 放名词后 (被动)']
  },
  influence: {
    collocations: ['have an influence on 对...有影响', 'under the influence of 在...影响下', 'influence sb to do 影响某人做'],
    derivatives: ['influential adj. 有影响力的'],
    wordForms: { adjective: 'influential', pastTense: 'influenced', pastParticiple: 'influenced', presentParticiple: 'influencing' },
    synonyms: ['affect 影响', 'impact 影响', 'shape 塑造', 'persuade 说服'],
    antonyms: ['ignore 忽视', 'neglect 忽视', 'disregard 无视'],
    examPoints: ['have an influence on = have an effect on 对...有影响', 'influential figure 有影响力的人物']
  },
  inform: {
    collocations: ['inform sb of sth 告知某人', 'inform sb that 通知某人', 'keep sb informed 让某人知情'],
    derivatives: ['information n. 信息', 'informative adj. 信息量大的', 'informed adj. 见多识广的'],
    wordForms: { noun: 'information', adjective: 'informative', pastTense: 'informed', pastParticiple: 'informed', presentParticiple: 'informing' },
    synonyms: ['notify 通知', 'tell 告诉', 'advise 建议', 'apprize 告知'],
    antonyms: ['conceal 隐藏', 'hide 隐藏', 'withhold 保留'],
    examPoints: ['inform sb of sth (不是 inform sb sth)', 'information 不可数']
  },
  insist: {
    collocations: ['insist on doing 坚持做', 'insist that 坚持说', 'insist on one\'s opinion 坚持己见'],
    derivatives: ['insistence n. 坚持', 'insistent adj. 坚持的'],
    wordForms: { noun: 'insistence', adjective: 'insistent', pastTense: 'insisted', pastParticiple: 'insisted', presentParticiple: 'insisting' },
    synonyms: ['persist 坚持', 'maintain 维持', 'demand 要求', 'urge 催促'],
    antonyms: ['yield 屈服', 'give in 屈服', 'concede 让步'],
    examPoints: ['insist on doing 坚持做', 'insist that + 虚拟语气(should + do) 表示"坚持要求"']
  },
  intend: {
    collocations: ['intend to do 打算做', 'intend sb for 打算让某人做', 'be intended for 专为...设计'],
    derivatives: ['intention n. 意图', 'intentional adj. 故意的', 'intentionally adv. 故意地'],
    wordForms: { noun: 'intention', adjective: 'intentional', adverb: 'intentionally', pastTense: 'intended', pastParticiple: 'intended', presentParticiple: 'intending' },
    synonyms: ['plan 计划', 'mean 意味着', 'aim 瞄准', 'design 设计'],
    antonyms: ['improvise 即兴', 'happen by chance 偶然发生'],
    examPoints: ['intend to do = mean to do 打算做', 'be intended for = be designed for 专为...设计']
  },
  involve: {
    collocations: ['involve sb in 让某人参与', 'be involved in 参与', 'involve doing 需要做'],
    derivatives: ['involvement n. 参与', 'involved adj. 复杂的；参与的'],
    wordForms: { noun: 'involvement', adjective: 'involved', pastTense: 'involved', pastParticiple: 'involved', presentParticiple: 'involving' },
    synonyms: ['include 包含', 'entail 需要', 'engage 参与', 'implicate 牵连'],
    antonyms: ['exclude 排除', 'eliminate 消除', 'omit 省略'],
    examPoints: ['involve doing (后接 doing)', 'be involved in = participate in 参与']
  },
  justify: {
    collocations: ['justify doing 为...辩护', 'be justified in 有理由做'],
    derivatives: ['justification n. 正当理由', 'justified adj. 有正当理由的'],
    wordForms: { noun: 'justification', adjective: 'justified', pastTense: 'justified', pastParticiple: 'justified', presentParticiple: 'justifying' },
    synonyms: ['defend 保卫', 'vindicate 证明', 'warrant 保证', 'excuse 原谅'],
    antonyms: ['condemn 谴责', 'blame 责备', 'criticize 批评'],
    examPoints: ['justify + doing/名词', 'be justified in doing 做某事是有正当理由的']
  },
  maintain: {
    collocations: ['maintain order 维持秩序', 'maintain contact 保持联系', 'maintain that 坚持'],
    derivatives: ['maintenance n. 维护', 'maintainable adj. 可维护的'],
    wordForms: { noun: 'maintenance', adjective: 'maintainable', pastTense: 'maintained', pastParticiple: 'maintained', presentParticiple: 'maintaining' },
    synonyms: ['keep 保持', 'preserve 保存', 'sustain 维持', 'uphold 维护'],
    antonyms: ['abandon 放弃', 'neglect 忽视', 'discontinue 中断'],
    examPoints: ['maintain = keep up 维持', 'maintenance 不可数']
  },
  observe: {
    collocations: ['observe sb do/doing 观察某人做', 'observe that 注意到', 'observe the rules 遵守规则'],
    derivatives: ['observation n. 观察', 'observer n. 观察者', 'observatory n. 天文台'],
    wordForms: { noun: 'observation', pastTense: 'observed', pastParticiple: 'observed', presentParticiple: 'observing' },
    synonyms: ['notice 注意', 'watch 观看', 'monitor 监控', 'heed 注意'],
    antonyms: ['ignore 忽视', 'overlook 忽略', 'disregard 无视'],
    examPoints: ['observe sb do (全过程)', 'observe sb doing (进行中)']
  },
  obtain: {
    collocations: ['obtain sth from 从...获得', 'obtain a degree 获得学位'],
    derivatives: ['obtainable adj. 可获得的'],
    wordForms: { adjective: 'obtainable', pastTense: 'obtained', pastParticiple: 'obtained', presentParticiple: 'obtaining' },
    synonyms: ['get 得到', 'acquire 获得', 'gain 获得', 'secure 确保'],
    antonyms: ['lose 失去', 'forfeit 丧失', 'give up 放弃'],
    examPoints: ['obtain = acquire 获得', 'formal usage 正式用法']
  },
  occur: {
    collocations: ['occur to sb 突然想到', 'it occurs to sb that 某人想到', 'occur unexpectedly 意外发生'],
    derivatives: ['occurrence n. 发生', 'occurrent adj. 正在发生的'],
    wordForms: { noun: 'occurrence', pastTense: 'occurred', pastParticiple: 'occurred', presentParticiple: 'occurring' },
    synonyms: ['happen 发生', 'take place 发生', 'arise 出现', 'come about 发生'],
    antonyms: ['cease 停止', 'stop 停止', 'fail to happen 未发生'],
    examPoints: ['双写 r: occurred/occurring', 'it occurs to sb that = sb suddenly realizes 某人突然想到']
  },
  offer: {
    collocations: ['offer to do 主动提出做', 'offer sb sth 提供某人某物', 'make an offer 提议'],
    derivatives: ['offering n. 祭品；提供物'],
    wordForms: { noun: 'offer', pastTense: 'offered', pastParticiple: 'offered', presentParticiple: 'offering' },
    synonyms: ['provide 提供', 'give 给予', 'present 呈现', 'propose 提议'],
    antonyms: ['refuse 拒绝', 'reject 拒绝', 'withdraw 撤回'],
    examPoints: ['offer sb sth = offer sth to sb 提供某人某物', 'offer to do (主动提出)']
  },
  oppose: {
    collocations: ['oppose doing 反对做', 'be opposed to 反对', 'as opposed to 与...相对'],
    derivatives: ['opposition n. 反对', 'opposite adj. 对面的', 'opponent n. 对手'],
    wordForms: { noun: 'opposition', adjective: 'opposite', pastTense: 'opposed', pastParticiple: 'opposed', presentParticiple: 'opposing' },
    synonyms: ['resist 抵抗', 'object to 反对', 'fight 战斗', 'combat 对抗'],
    antonyms: ['support 支持', 'favor 支持', 'endorse 认可', 'back 后退'],
    examPoints: ['be opposed to + doing/名词', 'as opposed to = rather than 而不是']
  },
  organize: {
    collocations: ['organize an activity 组织活动', 'organize one\'s thoughts 整理思路'],
    derivatives: ['organization n. 组织', 'organizer n. 组织者', 'organized adj. 有组织的', 'organizational adj. 组织的'],
    wordForms: { noun: 'organization', adjective: 'organized', pastTense: 'organized', pastParticiple: 'organized', presentParticiple: 'organizing' },
    synonyms: ['arrange 安排', 'coordinate 协调', 'plan 计划', 'structure 结构'],
    antonyms: ['disorganize 打乱', 'disrupt 破坏', 'scatter 分散'],
    examPoints: ['organize = arrange 组织', 'disorganized 杂乱无章的']
  },
  perform: {
    collocations: ['perform an operation 做手术', 'perform a play 演出', 'perform well 表现好'],
    derivatives: ['performance n. 表演；表现', 'performer n. 表演者'],
    wordForms: { noun: 'performance', pastTense: 'performed', pastParticiple: 'performed', presentParticiple: 'performing' },
    synonyms: ['carry out 执行', 'execute 执行', 'do 做', 'act 行动'],
    antonyms: ['fail 失败', 'neglect 忽视', 'ignore 忽视'],
    examPoints: ['perform a task/duty 执行任务/职责', 'give a performance 进行表演']
  },
  possess: {
    collocations: ['possess sth 拥有某物', 'be possessed of 具有'],
    derivatives: ['possession n. 拥有', 'possessive adj. 占有欲强的'],
    wordForms: { noun: 'possession', adjective: 'possessive', pastTense: 'possessed', pastParticiple: 'possessed', presentParticiple: 'possessing' },
    synonyms: ['own 拥有', 'have 有', 'hold 持有', 'acquire 获得'],
    antonyms: ['lose 失去', 'forfeit 丧失', 'lack 缺乏'],
    examPoints: ['in possession of (拥有)', 'in the possession of (被拥有)']
  },
  preserve: {
    collocations: ['preserve the environment 保护环境', 'preserve food 保存食物', 'preserve one\'s dignity 保持尊严'],
    derivatives: ['preservation n. 保存', 'preservative n. 防腐剂'],
    wordForms: { noun: 'preservation', pastTense: 'preserved', pastParticiple: 'preserved', presentParticiple: 'preserving' },
    synonyms: ['protect 保护', 'conserve 保存', 'maintain 维持', 'safeguard 保护'],
    antonyms: ['destroy 破坏', 'ruin 毁坏', 'abandon 放弃', 'discard 丢弃'],
    examPoints: ['preserve ≠ reserve(预留)', 'preservation 不可数']
  },
  prevent: {
    collocations: ['prevent sb from doing 阻止某人做', 'prevent disease 预防疾病'],
    derivatives: ['prevention n. 预防', 'preventive adj. 预防性的'],
    wordForms: { noun: 'prevention', adjective: 'preventive', pastTense: 'prevented', pastParticiple: 'prevented', presentParticiple: 'preventing' },
    synonyms: ['stop 停止', 'hinder 阻碍', 'obstruct 阻碍', 'deter 阻止'],
    antonyms: ['allow 允许', 'permit 允许', 'enable 使能够', 'facilitate 促进'],
    examPoints: ['prevent sb from doing = stop sb from doing 阻止某人做', 'prevention is better than cure 预防胜于治疗']
  },
  produce: {
    collocations: ['produce results 产生结果', 'produce evidence 提供证据'],
    derivatives: ['product n. 产品', 'production n. 生产', 'productive adj. 多产的', 'productivity n. 生产力', 'producer n. 生产者'],
    wordForms: { noun: 'product', adjective: 'productive', pastTense: 'produced', pastParticiple: 'produced', presentParticiple: 'producing' },
    synonyms: ['make 制造', 'create 创造', 'generate 产生', 'yield 屈服', 'manufacture 制造'],
    antonyms: ['consume 消耗', 'destroy 破坏', 'waste 浪费'],
    examPoints: ['product(产品) ≠ produce(n.农产品 /v.生产)', 'productive = fruitful 多产的']
  },
  promote: {
    collocations: ['promote development 促进发展', 'be promoted to 被提升为', 'promote a product 推销产品'],
    derivatives: ['promotion n. 促进；晋升', 'promotional adj. 促销的'],
    wordForms: { noun: 'promotion', adjective: 'promotional', pastTense: 'promoted', pastParticiple: 'promoted', presentParticiple: 'promoting' },
    synonyms: ['advance 前进', 'boost 提升', 'further 促进', 'elevate 提升'],
    antonyms: ['demote 降职', 'hinder 阻碍', 'impede 阻碍', 'discourage 使气馁'],
    examPoints: ['promote sb to + 职位', 'get a promotion 获得晋升']
  },
  propose: {
    collocations: ['propose to do 提议做', 'propose doing 建议做', 'propose that 提议', 'propose to sb 向某人求婚'],
    derivatives: ['proposal n. 提议', 'proposition n. 命题'],
    wordForms: { noun: 'proposal', pastTense: 'proposed', pastParticiple: 'proposed', presentParticiple: 'proposing' },
    synonyms: ['suggest 建议', 'recommend 推荐', 'put forward 提出', 'offer 提供'],
    antonyms: ['withdraw 撤回', 'retract 撤回', 'oppose 反对'],
    examPoints: ['propose + that + 虚拟语气(should + do)', 'make a proposal 提出建议']
  },
  prove: {
    collocations: ['prove that 证明', 'prove sb wrong 证明某人错了', 'prove to be 结果是'],
    derivatives: ['proof n. 证据', 'proven adj. 被证实的'],
    wordForms: { noun: 'proof', adjective: 'proven', pastTense: 'proved', pastParticiple: 'proved/proven', presentParticiple: 'proving' },
    synonyms: ['demonstrate 证明', 'confirm 确认', 'verify 核实', 'establish 建立'],
    antonyms: ['disprove 反驳', 'refute 反驳', 'contradict 反驳'],
    examPoints: ['prove to be = turn out to be 结果是', 'proof = evidence 证据']
  },
  provide: {
    collocations: ['provide sb with sth 提供某人某物', 'provide sth for sb 为某人提供', 'provide that 规定'],
    derivatives: ['provider n. 提供者', 'provision n. 供应；条款'],
    wordForms: { noun: 'provision', pastTense: 'provided', pastParticiple: 'provided', presentParticiple: 'providing' },
    synonyms: ['supply 供应', 'furnish 提供', 'give 给予', 'equip 装备'],
    antonyms: ['deprive 剥夺', 'withhold 保留', 'deny 否认'],
    examPoints: ['provide sb with sth = provide sth for sb 提供某人某物', 'provided that = if 如果(条件)']
  },
  realize: {
    collocations: ['realize one\'s dream 实现梦想', 'realize that 意识到', 'come to realize 逐渐意识到'],
    derivatives: ['realization n. 实现', 'realistic adj. 现实的', 'reality n. 现实', 'really adv. 真正地'],
    wordForms: { noun: 'realization', adjective: 'realistic', pastTense: 'realized', pastParticiple: 'realized', presentParticiple: 'realizing' },
    synonyms: ['achieve 实现', 'fulfill 实现', 'accomplish 完成', 'recognize 认出'],
    antonyms: ['fail 失败', 'miss 错过', 'ignore 忽视'],
    examPoints: ['realize(实现) ≠ realize(意识到) 两个意思', 'reality ≠ realty(不动产)']
  },
  recognize: {
    collocations: ['recognize sb as 承认某人为', 'recognize that 认识到'],
    derivatives: ['recognition n. 认出', 'recognizable adj. 可辨认的'],
    wordForms: { noun: 'recognition', adjective: 'recognizable', pastTense: 'recognized', pastParticiple: 'recognized', presentParticiple: 'recognizing' },
    synonyms: ['identify 识别', 'acknowledge 承认', 'admit 承认', 'realize 意识到'],
    antonyms: ['ignore 忽视', 'overlook 忽略', 'deny 否认'],
    examPoints: ['recognize = identify 识别', 'beyond recognition 认不出来']
  },
  reduce: {
    collocations: ['reduce by 减少了', 'reduce to 减少到', 'reduce costs 降低成本'],
    derivatives: ['reduction n. 减少'],
    wordForms: { noun: 'reduction', pastTense: 'reduced', pastParticiple: 'reduced', presentParticiple: 'reducing' },
    synonyms: ['decrease 减少', 'cut 削减', 'lower 降低', 'diminish 减少'],
    antonyms: ['increase 增加', 'raise 提高', 'elevate 提升', 'expand 扩大'],
    examPoints: ['reduce by (减少了多少)', 'reduce to (减少到多少)']
  },
  reflect: {
    collocations: ['reflect on 反思', 'reflect that 反映'],
    derivatives: ['reflection n. 反射；反思', 'reflective adj. 反思的'],
    wordForms: { noun: 'reflection', adjective: 'reflective', pastTense: 'reflected', pastParticiple: 'reflected', presentParticiple: 'reflecting' },
    synonyms: ['mirror 反映', 'show 展示', 'demonstrate 证明', 'consider 考虑'],
    antonyms: ['absorb 吸收', 'ignore 忽视', 'overlook 忽略'],
    examPoints: ['reflect on = think carefully about 反思', 'reflection in the mirror 镜中倒影']
  },
  regulate: {
    collocations: ['regulate the market 规范市场', 'regulate temperature 调节温度'],
    derivatives: ['regulation n. 规定', 'regulator n. 监管机构', 'regulatory adj. 监管的'],
    wordForms: { noun: 'regulation', adjective: 'regulatory', pastTense: 'regulated', pastParticiple: 'regulated', presentParticiple: 'regulating' },
    synonyms: ['control 控制', 'manage 管理', 'govern 统治', 'adjust 调整'],
    antonyms: ['deregulate 放松管制', 'free 释放', 'release 释放'],
    examPoints: ['regulations = rules 规章制度', 'regulatory body 监管机构']
  },
  relate: {
    collocations: ['relate to 与...有关', 'be related to 与...相关', 'relate A to B 把A与B联系起来'],
    derivatives: ['relation n. 关系', 'relationship n. 关系', 'relative n. 亲属 adj. 相对的', 'relatively adv. 相对地'],
    wordForms: { noun: 'relation', adjective: 'relative', adverb: 'relatively', pastTense: 'related', pastParticiple: 'related', presentParticiple: 'relating' },
    synonyms: ['connect 连接', 'link 连接', 'associate 联想', 'correlate 相关'],
    antonyms: ['disconnect 断开', 'separate 分离', 'dissociate 分离'],
    examPoints: ['relate to = be connected with 与...有关', 'in relation to = regarding 关于']
  },
  rely: {
    collocations: ['rely on 依赖', 'rely on sb to do 指望某人做', 'rely on doing 依靠做'],
    derivatives: ['reliance n. 依赖', 'reliable adj. 可靠的', 'reliability n. 可靠性'],
    wordForms: { noun: 'reliance', adjective: 'reliable', pastTense: 'relied', pastParticiple: 'relied', presentParticiple: 'relying' },
    synonyms: ['depend 依赖', 'count on 依靠', 'trust 信任', 'lean on 依靠'],
    antonyms: ['distrust 不信任', 'doubt 怀疑', 'suspect 怀疑'],
    examPoints: ['rely on = depend on 依赖', 'reliable = dependable 可靠的']
  },
  remain: {
    collocations: ['remain silent 保持沉默', 'remain to be done 尚待完成', 'remain in power 继续执政'],
    derivatives: ['remains n. 遗迹', 'remainder n. 剩余物'],
    wordForms: { noun: 'remainder', pastTense: 'remained', pastParticiple: 'remained', presentParticiple: 'remaining' },
    synonyms: ['stay 停留', 'continue 继续', 'persist 坚持', 'endure 忍受'],
    antonyms: ['leave 离开', 'depart 离开', 'change 改变', 'disappear 消失'],
    examPoints: ['remain + adj./n. (系动词)', 'remain to be done (被动)']
  },
  remember: {
    collocations: ['remember to do 记得要做', 'remember doing 记得做过', 'remember sb to sb 代某人问候'],
    derivatives: ['remembrance n. 纪念', 'memorable adj. 值得纪念的'],
    wordForms: { noun: 'remembrance', adjective: 'memorable', pastTense: 'remembered', pastParticiple: 'remembered', presentParticiple: 'remembering' },
    synonyms: ['recall 回忆', 'recollect 回忆', 'reminisce 回忆', 'commemorate 纪念'],
    antonyms: ['forget 忘记', 'overlook 忽略', 'neglect 忽视'],
    examPoints: ['remember to do (未做)', 'remember doing (已做)']
  },
  represent: {
    collocations: ['represent...as 把...描绘为', 'represent sb 代表某人', 'represent itself as 自称'],
    derivatives: ['representation n. 代表', 'representative n. 代表 adj. 典型的'],
    wordForms: { noun: 'representation', adjective: 'representative', pastTense: 'represented', pastParticiple: 'represented', presentParticiple: 'representing' },
    synonyms: ['stand for 代表', 'symbolize 象征', 'act for 代理', 'depict 描绘'],
    antonyms: ['misrepresent 歪曲', 'distort 歪曲'],
    examPoints: ['represent = stand for 代表', 'representative of 典型的']
  },
  require: {
    collocations: ['require sb to do 要求某人做', 'require doing 需要被做', 'require that 要求'],
    derivatives: ['requirement n. 要求', 'required adj. 必修的'],
    wordForms: { noun: 'requirement', adjective: 'required', pastTense: 'required', pastParticiple: 'required', presentParticiple: 'requiring' },
    synonyms: ['need 需要', 'demand 要求', 'ask 询问', 'necessitate 需要'],
    antonyms: ['excuse 原谅', 'exempt 豁免', 'waive 放弃'],
    examPoints: ['require doing = require to be done (被动含义)', 'meet the requirements 满足要求']
  },
  resolve: {
    collocations: ['resolve to do 决心做', 'resolve a problem 解决问题', 'resolve that 决定'],
    derivatives: ['resolution n. 决心；解决', 'resolute adj. 坚决的'],
    wordForms: { noun: 'resolution', adjective: 'resolute', pastTense: 'resolved', pastParticiple: 'resolved', presentParticiple: 'resolving' },
    synonyms: ['decide 决定', 'determine 决定', 'settle 解决', 'solve 解决'],
    antonyms: ['waver 动摇', 'hesitate 犹豫', 'delay 延迟'],
    examPoints: ['resolve a problem = solve a problem 解决问题', 'make a resolution 做出决定']
  },
  respond: {
    collocations: ['respond to 回应', 'respond by doing 以...回应'],
    derivatives: ['response n. 回应', 'responsible adj. 负责的', 'responsibility n. 责任'],
    wordForms: { noun: 'response', adjective: 'responsible', pastTense: 'responded', pastParticiple: 'responded', presentParticiple: 'responding' },
    synonyms: ['reply 回复', 'answer 回答', 'react 反应', 'acknowledge 承认'],
    antonyms: ['ignore 忽视', 'disregard 无视', 'neglect 忽视'],
    examPoints: ['respond to = reply to 回复', 'in response to 作为对...的回应']
  },
  result: {
    collocations: ['result in 导致', 'result from 由...引起', 'as a result 因此', 'as a result of 由于'],
    derivatives: [],
    wordForms: { pastTense: 'resulted', pastParticiple: 'resulted', presentParticiple: 'resulting' },
    synonyms: ['outcome 结果', 'consequence 后果', 'effect 效果', 'conclusion 结论'],
    antonyms: ['cause 导致', 'origin 起源', 'source 来源'],
    examPoints: ['result in (主动导致)', 'result from (被动源于)']
  },
  reveal: {
    collocations: ['reveal that 透露', 'reveal sth to sb 向某人透露', 'reveal oneself 显露'],
    derivatives: ['revelation n. 揭露', 'revealing adj. 揭露性的'],
    wordForms: { noun: 'revelation', adjective: 'revealing', pastTense: 'revealed', pastParticiple: 'revealed', presentParticiple: 'revealing' },
    synonyms: ['disclose 揭露', 'uncover 揭露', 'expose 暴露', 'unveil 揭示'],
    antonyms: ['hide 隐藏', 'conceal 隐藏', 'cover 覆盖', 'mask 掩饰'],
    examPoints: ['reveal = disclose 揭示', 'revelation 不可数']
  },
  satisfy: {
    collocations: ['satisfy one\'s needs 满足需求', 'be satisfied with 对...满意', 'satisfy the conditions 满足条件'],
    derivatives: ['satisfaction n. 满意', 'satisfactory adj. 令人满意的', 'satisfied adj. 满意的', 'unsatisfied adj. 不满意的', 'dissatisfy v. 使不满'],
    wordForms: { noun: 'satisfaction', adjective: 'satisfactory', pastTense: 'satisfied', pastParticiple: 'satisfied', presentParticiple: 'satisfying' },
    synonyms: ['fulfill 实现', 'meet 满足', 'please 取悦', 'content 满足的'],
    antonyms: ['disappoint 使失望', 'dissatisfy 使不满', 'frustrate 挫败'],
    examPoints: ['be satisfied with (人满意)', 'satisfactory (事物令人满意)']
  },
  secure: {
    collocations: ['secure a position 获得职位', 'be secure from 免于', 'secure sth against 保护...免受'],
    derivatives: ['security n. 安全', 'securely adv. 安全地'],
    wordForms: { noun: 'security', adverb: 'securely', pastTense: 'secured', pastParticiple: 'secured', presentParticiple: 'securing' },
    synonyms: ['safe 安全的', 'protected 受保护的', 'obtain 获得', 'guarantee 保证'],
    antonyms: ['insecure 不安全的', 'vulnerable 脆弱的', 'exposed 暴露的'],
    examPoints: ['secure(安全的) → security(名词)', 'feel secure 感到安全']
  },
  seek: {
    collocations: ['seek to do 试图做', 'seek for 寻找', 'seek advice 征求建议', 'seek out 找出'],
    derivatives: ['seeker n. 寻找者'],
    wordForms: { noun: 'seeker', pastTense: 'sought', pastParticiple: 'sought', presentParticiple: 'seeking' },
    synonyms: ['look for 寻找', 'search 搜索', 'pursue 追求', 'try 尝试'],
    antonyms: ['find 找到', 'discover 发现', 'ignore 忽视'],
    examPoints: ['不规则变形: seek-sought-sought', 'seek to do = try to do 试图做']
  },
  solve: {
    collocations: ['solve a problem 解决问题', 'solve a puzzle 解谜'],
    derivatives: ['solution n. 解决方案', 'solvable adj. 可解决的'],
    wordForms: { noun: 'solution', adjective: 'solvable', pastTense: 'solved', pastParticiple: 'solved', presentParticiple: 'solving' },
    synonyms: ['resolve 解决', 'settle 解决', 'work out 解决', 'figure out 弄明白'],
    antonyms: ['create 创造', 'cause 导致', 'complicate 使复杂'],
    examPoints: ['a solution to a problem 问题的解决方法', 'solve ≠ settle(安顿)']
  },
  succeed: {
    collocations: ['succeed in doing 成功做', 'succeed sb as 接替某人', 'succeed to the throne 继承王位'],
    derivatives: ['success n. 成功', 'successful adj. 成功的', 'successfully adv. 成功地', 'successor n. 继承人'],
    wordForms: { noun: 'success', adjective: 'successful', adverb: 'successfully', pastTense: 'succeeded', pastParticiple: 'succeeded', presentParticiple: 'succeeding' },
    synonyms: ['achieve 实现', 'accomplish 完成', 'triumph 胜利', 'follow 跟随'],
    antonyms: ['fail 失败', 'lose 失去', 'precede 先于'],
    examPoints: ['succeed in doing (不是 to do)', 'succeed sb = take over from sb 继任某人']
  },
  suffer: {
    collocations: ['suffer from 患...病；遭受', 'suffer loss 遭受损失', 'suffer pain 忍受痛苦'],
    derivatives: ['suffering n. 痛苦', 'sufferer n. 患病者'],
    wordForms: { noun: 'suffering', pastTense: 'suffered', pastParticiple: 'suffered', presentParticiple: 'suffering' },
    synonyms: ['endure 忍受', 'bear 承受', 'experience 经历', 'undergo 经历'],
    antonyms: ['enjoy 享受', 'benefit 有益', 'thrive 繁荣'],
    examPoints: ['suffer from + 疾病/痛苦', 'suffer = tolerate(忍受)']
  },
  suggest: {
    collocations: ['suggest doing 建议做', 'suggest that 建议', 'suggest sth to sb 向某人建议'],
    derivatives: ['suggestion n. 建议', 'suggestive adj. 暗示的'],
    wordForms: { noun: 'suggestion', adjective: 'suggestive', pastTense: 'suggested', pastParticiple: 'suggested', presentParticiple: 'suggesting' },
    synonyms: ['propose 提议', 'recommend 推荐', 'advise 建议', 'imply 暗示'],
    antonyms: ['demand 要求', 'insist 坚持', 'reject 拒绝'],
    examPoints: ['后接 doing 不接 to do', 'suggest that + 虚拟语气(should + do) 表示"建议"']
  },
  survive: {
    collocations: ['survive sth 幸免于', 'survive on 靠...存活', 'survive sb 比某人活得长'],
    derivatives: ['survival n. 生存', 'survivor n. 幸存者'],
    wordForms: { noun: 'survival', pastTense: 'survived', pastParticiple: 'survived', presentParticiple: 'surviving' },
    synonyms: ['live through 经历', 'endure 忍受', 'outlast 比...持久', 'withstand 经受'],
    antonyms: ['die 死亡', 'perish 消亡', 'succumb 屈服'],
    examPoints: ['survive 是及物动词不加 from', 'survive the earthquake 在地震中幸存']
  },
  tend: {
    collocations: ['tend to do 倾向于做', 'tend towards 倾向于', 'tend sb 照料某人'],
    derivatives: ['tendency n. 倾向', 'tender adj. 温柔的'],
    wordForms: { noun: 'tendency', adjective: 'tender', pastTense: 'tended', pastParticiple: 'tended', presentParticiple: 'tending' },
    synonyms: ['be inclined to 倾向于', 'lean towards 倾向于', 'be likely to 可能', 'care for 照顾'],
    antonyms: ['avoid 避免', 'shun 避开', 'neglect 忽视'],
    examPoints: ['tend to do = be likely to do 倾向于做', 'have a tendency to do 有做某事的倾向']
  },
  transform: {
    collocations: ['transform A into B 把A变成B', 'transform one\'s life 改变生活'],
    derivatives: ['transformation n. 变形', 'transformer n. 变压器'],
    wordForms: { noun: 'transformation', pastTense: 'transformed', pastParticiple: 'transformed', presentParticiple: 'transforming' },
    synonyms: ['change 改变', 'convert 转换', 'alter 改变', 'turn 转动'],
    antonyms: ['preserve 保存', 'maintain 维持', 'keep 保持'],
    examPoints: ['transform A into B 把A变成B', 'transformation 不可数']
  },
  value: {
    collocations: ['value sth at 估价', 'place a high value on 高度重视', 'of great value 很有价值'],
    derivatives: ['valuable adj. 有价值的', 'valueless adj. 无价值的', 'valuation n. 估价', 'invaluable adj. 无价的'],
    wordForms: { adjective: 'valuable', noun: 'valuation', pastTense: 'valued', pastParticiple: 'valued', presentParticiple: 'valuing' },
    synonyms: ['worth 值得', 'prize 珍视', 'treasure 珍视', 'appreciate 欣赏；感激'],
    antonyms: ['disregard 无视', 'devalue 贬值', 'ignore 忽视'],
    examPoints: ['valuable(有价值的) ≠ valued(被重视的)', 'invaluable = priceless 无价的']
  },
  vary: {
    collocations: ['vary from 不同于', 'vary with 随...变化', 'vary in 在...方面不同'],
    derivatives: ['variety n. 多样性', 'various adj. 不同的', 'variation n. 变化', 'variable adj. 可变的 n. 变量'],
    wordForms: { noun: 'variety', adjective: 'various', pastTense: 'varied', pastParticiple: 'varied', presentParticiple: 'varying' },
    synonyms: ['differ 不同', 'change 改变', 'fluctuate 波动', 'diversify 多样化'],
    antonyms: ['remain 保持', 'stay 停留', 'be constant 不变的'],
    examPoints: ['a variety of = various 多种多样的', 'vary from...to... 从...到...不等']
  },
  volunteer: {
    collocations: ['volunteer to do 自愿做', 'volunteer for 自愿参加'],
    derivatives: ['voluntary adj. 自愿的', 'voluntarily adv. 自愿地', 'voluntarism n. 志愿主义'],
    wordForms: { adjective: 'voluntary', adverb: 'voluntarily', pastTense: 'volunteered', pastParticiple: 'volunteered', presentParticiple: 'volunteering' },
    synonyms: ['offer 提供', 'step forward 站出来', 'enlist 征募'],
    antonyms: ['be forced 被迫', 'be drafted 被征召'],
    examPoints: ['volunteer to do 志愿做', 'voluntary work 志愿工作']
  },
  warn: {
    collocations: ['warn sb of sth 警告某人', 'warn sb against doing 警告某人不要', 'warn sb not to do 警告某人不要做'],
    derivatives: ['warning n. 警告'],
    wordForms: { noun: 'warning', pastTense: 'warned', pastParticiple: 'warned', presentParticiple: 'warning' },
    synonyms: ['caution 警告', 'alert 警觉的', 'advise 建议', 'notify 通知'],
    antonyms: ['reassure 使安心', 'encourage 鼓励', 'urge 催促'],
    examPoints: ['warn sb against doing = warn sb not to do 警告某人不要做', 'give a warning 给予警告']
  },
  forget: {
    collocations: ['forget to do 忘记要做', 'forget doing 忘记做过', 'forget about 忘记关于'],
    derivatives: ['forgetful adj. 健忘的', 'forgetfulness n. 健忘', 'unforgettable adj. 难忘的'],
    wordForms: { noun: 'forgetfulness', adjective: 'forgetful', pastTense: 'forgot', pastParticiple: 'forgotten', presentParticiple: 'forgetting' },
    synonyms: ['overlook 忽略', 'neglect 忽视'],
    antonyms: ['remember 记得', 'recall 回想'],
    examPoints: ['forget to do 忘记要做(未做)', 'forget doing 忘记做过(已做)', 'unforgettable = memorable 难忘的']
  },
  stop: {
    collocations: ['stop to do 停下来去做', 'stop doing 停止做某事', 'stop sb from doing 阻止某人做', 'come to a stop 停下来'],
    derivatives: ['stoppage n. 停止', 'nonstop adj. 不停的'],
    wordForms: { noun: 'stop', pastTense: 'stopped', pastParticiple: 'stopped', presentParticiple: 'stopping' },
    synonyms: ['halt 停止', 'cease 停止', 'quit 放弃'],
    antonyms: ['continue 继续', 'proceed 继续', 'start 开始'],
    examPoints: ['stop to do 停下去做另一件事', 'stop doing 停止正在做的事', '双写p再加ed/ing']
  },
  try: {
    collocations: ['try to do 努力做', 'try doing 试做', 'try on 试穿', 'try out 试用', 'have a try 试一试'],
    derivatives: ['trial n. 试验', 'trying adj. 难受的'],
    wordForms: { noun: 'trial', pastTense: 'tried', pastParticiple: 'tried', presentParticiple: 'trying' },
    synonyms: ['attempt 尝试', 'endeavor 努力', 'strive 奋斗'],
    antonyms: ['give up 放弃', 'abandon 放弃'],
    examPoints: ['try to do 努力设法做某事', 'try doing 试着做看效果如何', 'try on 试穿(衣物)']
  },
  mean: {
    collocations: ['mean to do 打算做', 'mean doing 意味着', 'be meant for 为...而设计', 'what do you mean 你什么意思'],
    derivatives: ['meaning n. 意义', 'meaningful adj. 有意义的', 'meaningless adj. 无意义的', 'means n. 手段'],
    wordForms: { noun: 'meaning', adjective: 'meaningful', pastTense: 'meant', pastParticiple: 'meant', presentParticiple: 'meaning' },
    synonyms: ['signify 意味', 'indicate 表明', 'intend 打算'],
    antonyms: ['misunderstand 误解'],
    examPoints: ['mean to do 打算做某事', 'mean doing 意味着做某事', 'by means of 通过...方式', 'by no means 决不(放句首倒装)']
  },
  regret: {
    collocations: ['regret to do 遗憾要做', 'regret doing 后悔做过', 'regret having done 后悔做过', 'to one\'s regret 令人遗憾'],
    derivatives: ['regretful adj. 后悔的', 'regrettable adj. 令人遗憾的'],
    wordForms: { noun: 'regret', adjective: 'regretful', pastTense: 'regretted', pastParticiple: 'regretted', presentParticiple: 'regretting' },
    synonyms: ['repent 后悔', 'rue 懊悔'],
    antonyms: ['be content 满足', 'rejoice 高兴'],
    examPoints: ['regret to do 遗憾地要做(将做)', 'regret doing 后悔做过(已做)', '双写t再加ed/ing', 'regret to say/tell/inform 遗憾地说/告诉/通知']
  },
  remember: {
    collocations: ['remember to do 记得要做', 'remember doing 记得做过', 'remember sb to sb 代某人问候', 'if I remember correctly 如果我没记错'],
    derivatives: ['remembrance n. 纪念', 'memorial n. 纪念碑'],
    wordForms: { noun: 'remembrance', pastTense: 'remembered', pastParticiple: 'remembered', presentParticiple: 'remembering' },
    synonyms: ['recall 回想', 'recollect 回忆', 'memorize 记住'],
    antonyms: ['forget 忘记', 'ignore 忽视'],
    examPoints: ['remember to do 记得要做(未做)', 'remember doing 记得做过(已做)', 'remember to lock the door 记得锁门']
  },
  continue: {
    collocations: ['continue to do 继续做', 'continue doing 继续做', 'to be continued 未完待续', 'continue with 继续某事'],
    derivatives: ['continuity n. 连续性', 'continuous adj. 连续的', 'continual adj. 频繁的'],
    wordForms: { noun: 'continuity', adjective: 'continuous', pastTense: 'continued', pastParticiple: 'continued', presentParticiple: 'continuing' },
    synonyms: ['go on 继续', 'proceed 继续', 'persist 坚持'],
    antonyms: ['stop 停止', 'halt 停止', 'discontinue 中断'],
    examPoints: ['continue to do = continue doing 意义相同', 'continuous vs continual: continuous 不间断的, continual 频繁的(可断)']
  },
  begin: {
    collocations: ['begin to do 开始做', 'begin doing 开始做', 'to begin with 首先', 'begin with 以...开始'],
    derivatives: ['beginning n. 开始', 'beginner n. 初学者'],
    wordForms: { noun: 'beginning', noun2: 'beginner', pastTense: 'began', pastParticiple: 'begun', presentParticiple: 'beginning' },
    synonyms: ['start 开始', 'commence 开始', 'initiate 发起'],
    antonyms: ['end 结束', 'finish 完成', 'conclude 总结'],
    examPoints: ['begin to do = begin doing 通常可互换', 'beginning 双写n再加ing', 'to begin with = first of all 首先']
  },
  start: {
    collocations: ['start to do 开始做', 'start doing 开始做', 'start off 出发', 'start out 出发', 'to start with 首先'],
    derivatives: ['startle v. 惊吓', 'starter n. 起动机'],
    wordForms: { noun: 'start', pastTense: 'started', pastParticiple: 'started', presentParticiple: 'starting' },
    synonyms: ['begin 开始', 'commence 开始', 'initiate 发起'],
    antonyms: ['stop 停止', 'finish 结束', 'end 结束'],
    examPoints: ['start to do = start doing 通常可互换', 'start sb doing 使某人开始做', 'to start with = to begin with 首先']
  },
  like: {
    collocations: ['like to do 喜欢做', 'like doing 喜欢做', 'would like to do 想要做', 'feel like doing 想要做', 'if you like 如果你愿意'],
    derivatives: ['likely adj. 可能的', 'liking n. 喜好', 'dislike v. 不喜欢'],
    wordForms: { noun: 'liking', adjective: 'likely', adverb: 'likely', pastTense: 'liked', pastParticiple: 'liked', presentParticiple: 'liking' },
    synonyms: ['enjoy 享受', 'love 喜爱', 'be fond of 喜欢'],
    antonyms: ['dislike 不喜欢', 'hate 讨厌'],
    examPoints: ['would like to do = want to do 想要做', 'feel like doing = want to do 想要做', 'likely 作副词: sb is likely to do = it is likely that']
  },
  prefer: {
    collocations: ['prefer to do 更喜欢做', 'prefer doing to doing 宁愿...而不', 'prefer to do rather than do 宁愿做而不做', 'have a preference for 偏爱'],
    derivatives: ['preference n. 偏爱', 'preferable adj. 更好的', 'preferably adv. 更好地'],
    wordForms: { noun: 'preference', adjective: 'preferable', pastTense: 'preferred', pastParticiple: 'preferred', presentParticiple: 'preferring' },
    synonyms: ['favor 偏爱', 'choose 选择'],
    antonyms: ['reject 拒绝', 'dislike 不喜欢'],
    examPoints: ['prefer A to B (A/B为名词或动名词)', 'prefer to do rather than do 宁愿做而不做', '双写r再加ed/ing', 'have a preference for sth 偏爱某物']
  },
  need: {
    collocations: ['need to do 需要做', 'need doing 需要被做', 'in need of 需要', 'there is no need to do 没必要做'],
    derivatives: ['needless adj. 不需要的', 'needs n. 需求'],
    wordForms: { noun: 'need', adjective: 'needless', pastTense: 'needed', pastParticiple: 'needed', presentParticiple: 'needing' },
    synonyms: ['require 需要', 'demand 要求', 'lack 缺乏'],
    antonyms: ['supply 供给', 'provide 提供'],
    examPoints: ['need doing = need to be done (被动含义)', 'needn\'t have done 本不必做却做了', 'didn\'t need to do 不需要做(也没做)']
  },
  refuse: {
    collocations: ['refuse to do 拒绝做', 'refuse sb sth 拒绝某人某事', 'refuse sth to sb 拒绝给某人'],
    derivatives: ['refusal n. 拒绝'],
    wordForms: { noun: 'refusal', pastTense: 'refused', pastParticiple: 'refused', presentParticiple: 'refusing' },
    synonyms: ['reject 拒绝', 'decline 婉拒', 'turn down 拒绝'],
    antonyms: ['accept 接受', 'agree 同意'],
    examPoints: ['refuse to do sth 拒绝做某事', 'refuse + 双宾语: refuse sb sth']
  },
  manage: {
    collocations: ['manage to do 设法做到', 'manage on 靠...过活', 'manage without 没有...也应付'],
    derivatives: ['management n. 管理', 'manager n. 经理', 'manageable adj. 可管理的'],
    wordForms: { noun: 'management', noun2: 'manager', adjective: 'manageable', pastTense: 'managed', pastParticiple: 'managed', presentParticiple: 'managing' },
    synonyms: ['succeed in doing 成功做', 'handle 处理', 'cope 应付'],
    antonyms: ['fail 失败'],
    examPoints: ['manage to do = succeed in doing 设法做成', 'manage to do vs try to do: manage 强调成功, try 强调努力']
  },
  mind: {
    collocations: ['mind doing 介意做', 'would you mind doing 你介意...吗', 'change one\'s mind 改变主意', 'make up one\'s mind 下定决心', 'keep in mind 记住'],
    derivatives: ['reminder n. 提醒物', 'minded adj. 有...思想的'],
    wordForms: { noun: 'mind', adjective: 'minded', pastTense: 'minded', pastParticiple: 'minded', presentParticiple: 'minding' },
    synonyms: ['object 反对', 'care 在乎'],
    antonyms: ['be indifferent 无所谓'],
    examPoints: ['mind doing 介意做某事', 'Would you mind my doing? 你介意我做吗', 'make up one\'s mind to do 下决心做', 'bear/keep in mind 记住']
  },
  enjoy: {
    collocations: ['enjoy doing 喜欢做', 'enjoy oneself 玩得开心', 'enjoy good health 身体健康'],
    derivatives: ['enjoyment n. 享受', 'enjoyable adj. 愉快的'],
    wordForms: { noun: 'enjoyment', adjective: 'enjoyable', pastTense: 'enjoyed', pastParticiple: 'enjoyed', presentParticiple: 'enjoying' },
    synonyms: ['like 喜欢', 'appreciate 欣赏', 'relish 享受'],
    antonyms: ['dislike 不喜欢', 'hate 讨厌', 'suffer 受苦'],
    examPoints: ['enjoy 后接 doing 不接 to do', 'enjoy oneself = have a good time 玩得开心', 'enjoyable = pleasant 愉快的']
  },
  finish: {
    collocations: ['finish doing 完成做', 'finish off 完成;吃完', 'finish with 完成;与...分手'],
    derivatives: ['finished adj. 完成的', 'finish n. 结束'],
    wordForms: { noun: 'finish', adjective: 'finished', pastTense: 'finished', pastParticiple: 'finished', presentParticiple: 'finishing' },
    synonyms: ['complete 完成', 'accomplish 完成', 'conclude 结束'],
    antonyms: ['start 开始', 'begin 开始'],
    examPoints: ['finish 后接 doing 不接 to do', 'finish doing sth = complete doing sth 完成做某事']
  },
  avoid: {
    collocations: ['avoid doing 避免做', 'avoid sth 避免某事'],
    derivatives: ['avoidance n. 避免', 'unavoidable adj. 不可避免的'],
    wordForms: { noun: 'avoidance', adjective: 'unavoidable', pastTense: 'avoided', pastParticiple: 'avoided', presentParticiple: 'avoiding' },
    synonyms: ['evade 逃避', 'escape 逃避', 'shun 避开'],
    antonyms: ['face 面对', 'confront 面对', 'encounter 遭遇'],
    examPoints: ['avoid 后接 doing 不接 to do', 'avoid doing = keep from doing 避免做']
  },
  consider: {
    collocations: ['consider doing 考虑做', 'consider sb to be 认为某人是', 'consider...as 把...看作', 'take into consideration 考虑到'],
    derivatives: ['consideration n. 考虑', 'considerate adj. 体贴的', 'considerable adj. 相当大的', 'considering prep. 考虑到'],
    wordForms: { noun: 'consideration', adjective: 'considerate', pastTense: 'considered', pastParticiple: 'considered', presentParticiple: 'considering' },
    synonyms: ['think about 考虑', 'ponder 思考', 'regard as 视为'],
    antonyms: ['ignore 忽视', 'disregard 无视'],
    examPoints: ['consider doing 考虑做(后接doing)', 'considerate vs considerable: considerate 体贴的, considerable 相当大的', 'take sth into consideration 把...考虑在内']
  },
  suggest: {
    collocations: ['suggest doing 建议做', 'suggest that 建议(虚拟语气)', 'suggest sth to sb 向某人建议', 'make a suggestion 提建议'],
    derivatives: ['suggestion n. 建议', 'suggestive adj. 暗示的'],
    wordForms: { noun: 'suggestion', adjective: 'suggestive', pastTense: 'suggested', pastParticiple: 'suggested', presentParticiple: 'suggesting' },
    synonyms: ['propose 提议', 'recommend 推荐', 'advise 建议'],
    antonyms: ['demand 要求', 'insist 坚持'],
    examPoints: ['suggest doing 后接动名词', 'suggest that + 主语 + (should) do 虚拟语气', 'suggestion 后的同位语从句也用虚拟(should) do']
  },
  practice: {
    collocations: ['practice doing 练习做', 'put into practice 付诸实践', 'in practice 实际上', 'common practice 惯例'],
    derivatives: ['practical adj. 实际的', 'practically adv. 几乎;实际上', 'practitioner n. 从业者'],
    wordForms: { noun: 'practice', adjective: 'practical', adverb: 'practically', pastTense: 'practiced', pastParticiple: 'practiced', presentParticiple: 'practicing' },
    synonyms: ['rehearse 排练', 'train 训练', 'drill 操练'],
    antonyms: ['theory 理论'],
    examPoints: ['practice doing 练习做某事(美式practice=英式practise)', 'practical vs practicable: practical 实用的, practicable 可行的', 'put theory into practice 将理论付诸实践']
  },
  permit: {
    collocations: ['permit doing 允许做', 'permit sb to do 允许某人做', 'if time permits 如果时间允许', 'with permission 经许可'],
    derivatives: ['permission n. 许可', 'permissible adj. 容许的'],
    wordForms: { noun: 'permission', adjective: 'permissible', pastTense: 'permitted', pastParticiple: 'permitted', presentParticiple: 'permitting' },
    synonyms: ['allow 允许', 'authorize 授权'],
    antonyms: ['forbid 禁止', 'prohibit 禁止', 'ban 禁止'],
    examPoints: ['permit doing 允许做(动名词)', 'permit sb to do 允许某人做(不定式)', '双写t再加ed/ing', 'weather permitting 天气允许的话(独立主格)']
  },
  forbid: {
    collocations: ['forbid sb to do 禁止某人做', 'forbid doing 禁止做', 'forbidden fruit 禁果'],
    derivatives: ['forbidden adj. 被禁止的'],
    wordForms: { adjective: 'forbidden', pastTense: 'forbade', pastParticiple: 'forbidden', presentParticiple: 'forbidding' },
    synonyms: ['prohibit 禁止', 'ban 禁止', 'ban 禁止'],
    antonyms: ['allow 允许', 'permit 许可', 'authorize 授权'],
    examPoints: ['forbid sb to do 禁止某人做(用to do)', 'forbid doing 禁止做(用doing)', 'forbade/forbad 过去式, forbidden 过去分词']
  },
  advise: {
    collocations: ['advise doing 建议做', 'advise sb to do 建议某人做', 'advise sb against doing 劝某人不要', 'advise that 建议(虚拟语气)'],
    derivatives: ['advice n. 建议(不可数)', 'adviser n. 顾问', 'advisable adj. 明智的'],
    wordForms: { noun: 'advice', noun2: 'adviser', adjective: 'advisable', pastTense: 'advised', pastParticiple: 'advised', presentParticiple: 'advising' },
    synonyms: ['recommend 推荐', 'suggest 建议', 'counsel 劝告'],
    antonyms: ['warn 警告', 'deter 阻止'],
    examPoints: ['advise doing 建议做(动名词)', 'advise sb to do 建议某人做(不定式)', 'advice 是不可数名词: a piece of advice', 'advise that + (should) do 虚拟语气']
  },
  admit: {
    collocations: ['admit doing 承认做', 'admit to doing 承认做', 'admit sb into 准许某人进入', 'admit that 承认'],
    derivatives: ['admission n. 准入;承认', 'admittedly adv. 诚然'],
    wordForms: { noun: 'admission', pastTense: 'admitted', pastParticiple: 'admitted', presentParticiple: 'admitting' },
    synonyms: ['confess 承认', 'acknowledge 承认', 'concede 让步'],
    antonyms: ['deny 否认', 'reject 拒绝'],
    examPoints: ['admit doing 承认做过(后接动名词)', 'admit sb to/into 允许进入', '双写t再加ed/ing', 'admission to 准入(to是介词)']
  },
  deny: {
    collocations: ['deny doing 否认做', 'deny that 否认', 'deny sb sth 拒绝给某人', 'there is no denying that 不可否认'],
    derivatives: ['denial n. 否认'],
    wordForms: { noun: 'denial', pastTense: 'denied', pastParticiple: 'denied', presentParticiple: 'denying' },
    synonyms: ['contradict 反驳', 'dispute 质疑'],
    antonyms: ['admit 承认', 'confess 承认', 'acknowledge 承认'],
    examPoints: ['deny doing 否认做过(后接动名词)', 'deny sb sth 拒绝给某人', 'There is no denying that... 不可否认']
  },
  imagine: {
    collocations: ['imagine doing 想象做', 'imagine sb doing 想象某人做', 'imagine that 想象', 'beyond imagination 超出想象'],
    derivatives: ['imagination n. 想象力', 'imaginative adj. 富有想象力的', 'imaginary adj. 虚构的', 'imaginable adj. 可想象的'],
    wordForms: { noun: 'imagination', adjective: 'imaginative', pastTense: 'imagined', pastParticiple: 'imagined', presentParticiple: 'imagining' },
    synonyms: ['visualize 想象', 'picture 想象', 'envision 设想'],
    antonyms: ['observe 观察', 'witness 目击'],
    examPoints: ['imagine doing 想象做(后接动名词)', 'imaginative vs imaginary vs imaginable: imaginative 有想象力的, imaginary 虚构的, imaginable 可想象的']
  },
  appreciate: {
    collocations: ['appreciate doing 感激做', 'appreciate sb doing 感激某人做', 'I would appreciate it if 我将感激如果', 'appreciate sth 欣赏某物'],
    derivatives: ['appreciation n. 欣赏;感激', 'appreciative adj. 感激的'],
    wordForms: { noun: 'appreciation', adjective: 'appreciative', pastTense: 'appreciated', pastParticiple: 'appreciated', presentParticiple: 'appreciating' },
    synonyms: ['value 珍视', 'treasure 珍惜', 'admire 钦佩'],
    antonyms: ['disregard 无视', 'depreciate 贬值'],
    examPoints: ['appreciate doing 感激做(后接动名词)', 'I would appreciate it if... 我将感激如果(it作形式宾语)', 'appreciate + sth 感激(不接人)']
  },
  risk: {
    collocations: ['risk doing 冒险做', 'at risk 处于危险', 'at the risk of 冒...的危险', 'take a risk 冒险', 'run the risk of doing 冒...的风险'],
    derivatives: ['risky adj. 危险的'],
    wordForms: { noun: 'risk', adjective: 'risky', pastTense: 'risked', pastParticiple: 'risked', presentParticiple: 'risking' },
    synonyms: ['endanger 危及', 'jeopardize 危及', 'hazard 冒险'],
    antonyms: ['protect 保护', 'safeguard 保卫'],
    examPoints: ['risk doing 冒险做(后接动名词)', 'at risk 处境危险', 'run the risk of doing 冒做某事的风险']
  },
  escape: {
    collocations: ['escape doing 逃避做', 'escape from 从...逃跑', 'narrow escape 死里逃生', 'escape one\'s notice 逃过注意'],
    derivatives: ['escapee n. 逃亡者', 'escapism n. 逃避现实'],
    wordForms: { noun: 'escape', noun2: 'escapee', pastTense: 'escaped', pastParticiple: 'escaped', presentParticiple: 'escaping' },
    synonyms: ['flee 逃跑', 'evade 逃避', 'avoid 避免'],
    antonyms: ['face 面对', 'confront 面对', 'encounter 遭遇'],
    examPoints: ['escape doing 逃避做(后接动名词)', 'escape from prison 越狱', 'a narrow escape 九死一生']
  },
  delay: {
    collocations: ['delay doing 推迟做', 'without delay 毫不迟延', 'be delayed by 因...延误'],
    derivatives: ['delay n. 延迟'],
    wordForms: { noun: 'delay', pastTense: 'delayed', pastParticiple: 'delayed', presentParticiple: 'delaying' },
    synonyms: ['postpone 推迟', 'put off 推迟', 'defer 延期'],
    antonyms: ['hasten 催促', 'expedite 加快'],
    examPoints: ['delay doing 推迟做(后接动名词)', 'without delay = immediately 毫不迟延', 'delay = put off = postpone 推迟']
  },
  miss: {
    collocations: ['miss doing 错过做', 'miss the bus 错过公交', 'miss home 想家', 'miss out 错过'],
    derivatives: ['missing adj. 缺失的', 'missingly adv. 缺失地'],
    wordForms: { adjective: 'missing', pastTense: 'missed', pastParticiple: 'missed', presentParticiple: 'missing' },
    synonyms: ['lose 丢失', 'overlook 忽略', 'skip 跳过'],
    antonyms: ['catch 赶上', 'find 找到'],
    examPoints: ['miss doing 错过做(后接动名词)', 'miss the bus/train 错过车', 'missing = lost 失踪的']
  },
  happen: {
    collocations: ['happen to do 碰巧做', 'happen to sb 发生于某人', 'it happens that 碰巧', 'as it happens 碰巧'],
    derivatives: ['happening n. 事件'],
    wordForms: { noun: 'happening', pastTense: 'happened', pastParticiple: 'happened', presentParticiple: 'happening' },
    synonyms: ['occur 发生', 'take place 发生', 'chance 碰巧'],
    antonyms: ['plan 计划', 'arrange 安排'],
    examPoints: ['happen to do 碰巧做(不定式)', 'sth happen to sb 某事发生在某人身上', 'happen 无被动语态', 'It (so) happens that... 碰巧...']
  },
  seem: {
    collocations: ['seem to do 似乎做', 'seem like 看起来像', 'it seems that 似乎', 'there seems to be 似乎有'],
    derivatives: ['seemingly adv. 表面上'],
    wordForms: { adverb: 'seemingly', pastTense: 'seemed', pastParticiple: 'seemed', presentParticiple: 'seeming' },
    synonyms: ['appear 似乎', 'look 看起来'],
    antonyms: ['be 确定'],
    examPoints: ['seem to do 似乎做', 'It seems that... = sb seems to do 似乎...', 'seem 无被动语态和进行时']
  },
  offer: {
    collocations: ['offer to do 主动提出做', 'offer sb sth 提供某人某物', 'offer sth to sb 提供某物给某人', 'make an offer 提出提议'],
    derivatives: ['offering n. 提供物', 'offer n. 提议'],
    wordForms: { noun: 'offer', pastTense: 'offered', pastParticiple: 'offered', presentParticiple: 'offering' },
    synonyms: ['provide 提供', 'supply 供给', 'propose 提议'],
    antonyms: ['refuse 拒绝', 'reject 拒绝', 'withdraw 撤回'],
    examPoints: ['offer to do 主动提出做(不定式)', 'offer sb sth = offer sth to sb 双宾语', 'offer 不接 doing']
  },
  intend: {
    collocations: ['intend to do 打算做', 'intend doing 打算做', 'intend sb for 打算让某人', 'be intended for 专为...设计'],
    derivatives: ['intention n. 意图', 'intentional adj. 故意的', 'intentionally adv. 故意地'],
    wordForms: { noun: 'intention', adjective: 'intentional', adverb: 'intentionally', pastTense: 'intended', pastParticiple: 'intended', presentParticiple: 'intending' },
    synonyms: ['plan 计划', 'mean 打算', 'aim 打算'],
    antonyms: ['abandon 放弃', 'cancel 取消'],
    examPoints: ['intend to do = intend doing 打算做', 'be intended for 为...而设计(被动)', 'with the intention of doing 抱着做...的意图']
  },
  promise: {
    collocations: ['promise to do 承诺做', 'promise sb sth 承诺某人某事', 'promise that 承诺', 'make a promise 做出承诺', 'keep a promise 遵守承诺'],
    derivatives: ['promising adj. 有前途的'],
    wordForms: { noun: 'promise', adjective: 'promising', pastTense: 'promised', pastParticiple: 'promised', presentParticiple: 'promising' },
    synonyms: ['pledge 保证', 'swear 发誓', 'guarantee 保证'],
    antonyms: ['break a promise 违背承诺'],
    examPoints: ['promise to do 承诺做(不定式)', 'promise sb to do 承诺某人去做(to do逻辑主语是主语)', 'promising = hopeful 有前途的']
  },
  pretend: {
    collocations: ['pretend to do 假装做', 'pretend to be doing 假装正在做', 'pretend to have done 假装做过', 'pretend that 假装'],
    derivatives: ['pretence n. 假装'],
    wordForms: { noun: 'pretence', pastTense: 'pretended', pastParticiple: 'pretended', presentParticiple: 'pretending' },
    synonyms: ['feign 假装', 'fake 伪造'],
    antonyms: ['be honest 诚实', 'be genuine 真诚'],
    examPoints: ['pretend to do 假装做', 'pretend to be doing 假装正在做', 'pretend to have done 假装已做过']
  },
  deserve: {
    collocations: ['deserve to do 值得做', 'deserve doing 值得被做', 'deserve sth 应得', 'deserve well of 应受优待'],
    derivatives: ['deserved adj. 应得的', 'deserving adj. 值得的'],
    wordForms: { adjective: 'deserved', pastTense: 'deserved', pastParticiple: 'deserved', presentParticiple: 'deserving' },
    synonyms: ['merit 值得', 'warrant 值得', 'earn 赢得'],
    antonyms: ['be undeserving 不值得'],
    examPoints: ['deserve to do 值得做(主动)', 'deserve doing 值得被(被动含义,如deserve punishing=deserve to be punished)', 'deserving of 值得...的']
  },
  demand: {
    collocations: ['demand to do 要求做', 'demand sth of sb 向某人要求', 'demand that 要求(虚拟语气)', 'in demand 有需求', 'meet the demand 满足需求'],
    derivatives: ['demanding adj. 要求高的'],
    wordForms: { noun: 'demand', adjective: 'demanding', pastTense: 'demanded', pastParticiple: 'demanded', presentParticiple: 'demanding' },
    synonyms: ['require 要求', 'request 请求', 'insist 坚持'],
    antonyms: ['supply 供给', 'offer 提供'],
    examPoints: ['demand to do 要求做(不定式)', 'demand that + (should) do 虚拟语气', 'in demand = sought after 有需求', 'demand sth of sb (不用demand sb sth)']
  },
  hesitate: {
    collocations: ['hesitate to do 犹豫做', 'don\'t hesitate to do 不要犹豫做', 'hesitate about doing 对...犹豫', 'without hesitation 毫不犹豫'],
    derivatives: ['hesitation n. 犹豫', 'hesitant adj. 犹豫的'],
    wordForms: { noun: 'hesitation', adjective: 'hesitant', pastTense: 'hesitated', pastParticiple: 'hesitated', presentParticiple: 'hesitating' },
    synonyms: ['waver 犹豫', 'falter 犹豫'],
    antonyms: ['decide 果断决定', 'resolve 决心'],
    examPoints: ['hesitate to do 犹豫做(不定式)', 'Don\'t hesitate to do 不要犹豫', 'without hesitation 毫不犹豫地']
  },
  determine: {
    collocations: ['determine to do 决心做', 'be determined to do 决心做', 'determine on doing 决定做', 'determine that 决定'],
    derivatives: ['determination n. 决心', 'determined adj. 坚决的'],
    wordForms: { noun: 'determination', adjective: 'determined', pastTense: 'determined', pastParticiple: 'determined', presentParticiple: 'determining' },
    synonyms: ['decide 决定', 'resolve 决心', 'settle 解决'],
    antonyms: ['hesitate 犹豫', 'waver 动摇'],
    examPoints: ['determine to do 决心做(主动,表动作)', 'be determined to do 决心做(状态,表态度)', 'determination to do 做某事的决心']
  },
  expect: {
    collocations: ['expect to do 期望做', 'expect sb to do 期望某人做', 'expect that 期望', 'as expected 正如预期', 'beyond expectation 出乎意料'],
    derivatives: ['expectation n. 期望', 'unexpected adj. 意外的', 'unexpectedly adv. 意外地'],
    wordForms: { noun: 'expectation', adjective: 'unexpected', adverb: 'unexpectedly', pastTense: 'expected', pastParticiple: 'expected', presentParticiple: 'expecting' },
    synonyms: ['anticipate 预期', 'await 等待', 'look forward to 期待'],
    antonyms: ['despair 绝望', 'give up 放弃'],
    examPoints: ['expect to do 期望做', 'expect sb to do 期望某人做', 'as expected = as was expected 如预期般', 'beyond expectation = beyond expectations 出乎意料']
  },
  wish: {
    collocations: ['wish to do 希望做', 'wish sb to do 希望某人做', 'wish + 虚拟语气 但愿', 'wish for 希望得到', 'make a wish 许愿'],
    derivatives: ['wishful adj. 一厢情愿的'],
    wordForms: { noun: 'wish', adjective: 'wishful', pastTense: 'wished', pastParticiple: 'wished', presentParticiple: 'wishing' },
    synonyms: ['desire 渴望', 'long for 渴望', 'yearn for 渴望'],
    antonyms: ['be content 满足'],
    examPoints: ['wish to do 希望做', 'wish sb to do 希望某人做', 'wish + 过去时(与现在相反虚拟)', 'wish + 过去完成时(与过去相反虚拟)', 'wish + could/would(与将来相反虚拟)']
  },
  devote: {
    collocations: ['devote oneself to doing 致力于做', 'devote...to doing 把... devoted to doing', 'be devoted to doing 专心于做', 'devotion to 致力于'],
    derivatives: ['devotion n. 奉献', 'devoted adj. 忠实的'],
    wordForms: { noun: 'devotion', adjective: 'devoted', pastTense: 'devoted', pastParticiple: 'devoted', presentParticiple: 'devoting' },
    synonyms: ['dedicate 奉献', 'commit 致力', 'pledge 保证'],
    antonyms: ['neglect 忽视', 'abandon 放弃'],
    examPoints: ['devote...to doing 中 to 是介词后接动名词', 'devote oneself to = dedicate oneself to 致力于', 'be devoted to doing = be dedicated to doing 专心于']
  },
  look: {
    collocations: ['look forward to doing 期待做', 'look at 看', 'look after 照顾', 'look into 调查', 'look up 查阅', 'look down upon 蔑视', 'look up to 尊敬', 'look for 寻找', 'look out 当心', 'look like 看起来像', 'look over 检查'],
    derivatives: ['lookout n. 守望', 'outlook n. 前景'],
    wordForms: { noun: 'look', pastTense: 'looked', pastParticiple: 'looked', presentParticiple: 'looking' },
    synonyms: ['watch 观看', 'observe 观察', 'view 观看', 'gaze 凝视'],
    antonyms: ['ignore 忽视', 'overlook 忽略'],
    examPoints: ['look forward to doing 中 to 是介词(后接doing)', 'look up 查阅(字典) vs look up to 尊敬', 'look into = investigate 调查', 'look out = watch out 当心']
  },
  get: {
    collocations: ['get down to doing 开始认真做', 'get along with 与...相处', 'get away from 逃离', 'get over 克服', 'get through 通过;完成', 'get rid of 摆脱', 'get used to doing 习惯于做', 'get sb to do 让某人做', 'get sth done 使某事被做'],
    derivatives: ['getter n. 获取者'],
    wordForms: { noun: 'getter', pastTense: 'got', pastParticiple: 'got/gotten', presentParticiple: 'getting' },
    synonyms: ['obtain 获得', 'acquire 获得', 'receive 收到'],
    antonyms: ['give 给', 'lose 失去'],
    examPoints: ['get down to doing 开始认真做(to是介词)', 'get sb to do 使某人做(不用get sb do)', 'get sth done 使某事被做', 'get used to doing = be used to doing 习惯于(used是形容词)']
  },
  make: {
    collocations: ['make sb do 使某人做', 'be made to do 被迫做', 'make it 成功;赶到', 'make up 编造;化妆;组成', 'make sense 有意义', 'make sure 确保', 'make a difference 有影响', 'make fun of 取笑', 'make use of 利用', 'make an effort 努力'],
    derivatives: ['maker n. 制造者', 'makeup n. 化妆品'],
    wordForms: { noun: 'maker', pastTense: 'made', pastParticiple: 'made', presentParticiple: 'making' },
    synonyms: ['create 创造', 'produce 生产', 'construct 建造'],
    antonyms: ['destroy 破坏', 'break 打破'],
    examPoints: ['make sb do 使某人做(省略to)', '被动: be made to do (恢复to)', 'make it 赶到;成功', 'make up for 弥补']
  },
  let: {
    collocations: ['let sb do 让某人做', 'let alone 更不用说', 'let down 使失望', 'let go 放手', 'let out 放出', 'let in 让...进来'],
    derivatives: [],
    wordForms: { pastTense: 'let', pastParticiple: 'let', presentParticiple: 'letting' },
    synonyms: ['allow 允许', 'permit 许可', 'enable 使能够'],
    antonyms: ['forbid 禁止', 'prevent 阻止'],
    examPoints: ['let sb do 让某人做(省略to,不用let sb to do)', 'let alone + do/doing/noun 更不用说', 'let sb down = disappoint sb 使某人失望']
  },
  have: {
    collocations: ['have sb do 让某人做', 'have sth done 使某事被做', 'have sb doing 让某人一直做', 'have to do 不得不做', 'have sth to do 有事要做', 'have difficulty (in) doing 做某事有困难', 'have a good time doing 做某事很开心'],
    derivatives: [],
    wordForms: { pastTense: 'had', pastParticiple: 'had', presentParticiple: 'having' },
    synonyms: ['possess 拥有', 'own 拥有', 'hold 持有'],
    antonyms: ['lack 缺乏'],
    examPoints: ['have sb do 让某人做(省略to)', 'have sth done 使某事被做(别人做)', 'have sb doing 让某人一直做(强调持续)', 'have difficulty (in) doing 做有困难(in可省)', 'have a good time (in) doing 做开心']
  },
  keep: {
    collocations: ['keep doing 一直做', 'keep on doing 继续做', 'keep sb doing 让某人一直做', 'keep sb from doing 阻止某人做', 'keep up with 跟上', 'keep in touch 保持联系', 'keep a diary 写日记'],
    derivatives: ['keeper n. 看守人', 'keeping n. 保管'],
    wordForms: { noun: 'keeper', pastTense: 'kept', pastParticiple: 'kept', presentParticiple: 'keeping' },
    synonyms: ['maintain 保持', 'retain 保留', 'preserve 保存'],
    antonyms: ['abandon 放弃', 'lose 失去'],
    examPoints: ['keep doing 一直做(后接动名词)', 'keep on doing 继续做(强调重复)', 'keep sb from doing = prevent sb from doing 阻止', 'keep up with = catch up with 跟上']
  },
  put: {
    collocations: ['put off doing 推迟做', 'put up with 忍受', 'put aside 储存', 'put away 收好', 'put forward 提出', 'put on 穿上', 'put out 熄灭', 'put down 放下', 'put through 接通'],
    derivatives: [],
    wordForms: { pastTense: 'put', pastParticiple: 'put', presentParticiple: 'putting' },
    synonyms: ['place 放置', 'set 放', 'position 定位'],
    antonyms: ['take 拿', 'remove 移除'],
    examPoints: ['put off doing 推迟做(后接动名词)', 'put up with = tolerate 忍受', 'put forward a proposal 提出建议']
  },
  set: {
    collocations: ['set out to do 出发去做', 'set about doing 开始做', 'set up 建立', 'set off 出发', 'set aside 留出', 'set an example 树立榜样', 'set free 释放'],
    derivatives: ['setting n. 背景;设置', 'settlement n. 解决'],
    wordForms: { noun: 'setting', pastTense: 'set', pastParticiple: 'set', presentParticiple: 'setting' },
    synonyms: ['establish 建立', 'place 放置', 'fix 固定'],
    antonyms: ['demolish 拆除', 'remove 移除'],
    examPoints: ['set out to do 出发去做(不定式)', 'set about doing 开始做(动名词)', 'set out to do vs set about doing: out后接to do, about后接doing', 'set up = establish 建立']
  },
  take: {
    collocations: ['take up doing 开始从事做', 'take to doing 养成...习惯', 'take care of 照顾', 'take part in 参加', 'take place 发生', 'take it easy 别紧张', 'take over 接管', 'take advantage of 利用', 'take pride in 以...为豪', 'take sth for granted 认为理所当然', 'take charge of 负责'],
    derivatives: ['taker n. 接受者', 'takeover n. 接管'],
    wordForms: { noun: 'taker', pastTense: 'took', pastParticiple: 'taken', presentParticiple: 'taking' },
    synonyms: ['grab 抓取', 'seize 夺取', 'receive 收到'],
    antonyms: ['give 给', 'offer 提供'],
    examPoints: ['take up doing 开始从事(后接动名词)', 'take to doing 养成习惯(后接动名词)', 'take place = happen 发生(无被动)', 'take sth for granted 认为理所当然', 'It takes sb time to do 花费某人时间做']
  },
  turn: {
    collocations: ['turn out to be 结果是', 'turn out that 结果是', 'turn down 拒绝;调低', 'turn up 出现;调高', 'turn into 变成', 'turn over 翻转', 'turn to sb for help 求助于', 'in turn 依次', 'in return 作为回报', 'it turns out that 结果是'],
    derivatives: ['turning n. 转弯', 'turnover n. 营业额'],
    wordForms: { noun: 'turn', pastTense: 'turned', pastParticiple: 'turned', presentParticiple: 'turning' },
    synonyms: ['rotate 旋转', 'spin 旋转', 'revolve 旋转'],
    antonyms: ['stay 保持', 'remain 保持'],
    examPoints: ['turn out to be 结果是', 'It turns out that... 结果是...', 'turn down = refuse 拒绝', 'turn up = appear 出现', 'in turn 依次 / in return 作为回报(易混)']
  },
  help: {
    collocations: ['help sb (to) do 帮助某人做', 'help oneself to 请自便', 'can\'t help doing 忍不住做', 'can\'t help but do 不得不做', 'help out 帮忙', 'with the help of 在...帮助下'],
    derivatives: ['helpful adj. 有帮助的', 'helpless adj. 无助的'],
    wordForms: { noun: 'help', adjective: 'helpful', adjective2: 'helpless', pastTense: 'helped', pastParticiple: 'helped', presentParticiple: 'helping' },
    synonyms: ['assist 协助', 'aid 援助', 'support 支持'],
    antonyms: ['hinder 阻碍', 'obstruct 妨碍'],
    examPoints: ['help sb (to) do to可省略', 'can\'t help doing 忍不住做(动名词)', 'can\'t help but do 不得不做(不定式省to)', 'can\'t help but do = cannot but do 不得不做']
  },
};

// 常见词根中文释义表（用于算法生成派生词时补充中文）
const baseWordMeanings = {
  act: '行动', adapt: '适应', adjust: '调整', admit: '承认', adopt: '采纳',
  advance: '前进', affect: '影响', agree: '同意', allow: '允许', amaze: '惊讶',
  analyze: '分析', announce: '宣布', apply: '申请', approach: '接近', argue: '争论',
  arrange: '安排', assess: '评估', assign: '分配', assist: '协助', assume: '假设',
  attach: '附上', attempt: '尝试', attract: '吸引', avoid: '避免', aware: '意识到的',
  balance: '平衡', behave: '表现', believe: '相信', belong: '属于', benefit: '受益',
  calculate: '计算', cancel: '取消', capture: '捕获', celebrate: '庆祝', challenge: '挑战',
  change: '改变', charge: '收费', choose: '选择', circulate: '循环', classify: '分类',
  collect: '收集', combine: '结合', comfort: '安慰', command: '命令', communicate: '交流',
  compare: '比较', compete: '竞争', complain: '抱怨', complete: '完成', compose: '组成',
  concern: '关心', conclude: '得出结论', conduct: '进行', confess: '坦白', confirm: '确认',
  confront: '面对', connect: '连接', consider: '考虑', consist: '组成', construct: '建造',
  consume: '消耗', contain: '包含', contest: '竞争', continue: '继续', contribute: '贡献',
  control: '控制', converse: '交谈', convince: '说服', correct: '纠正', create: '创造',
  cultivate: '培养', decide: '决定', declare: '宣布', decline: '下降', decorate: '装饰',
  decrease: '减少', defend: '保卫', define: '定义', delay: '延迟', deliver: '递送',
  demand: '要求', demonstrate: '证明', depend: '依赖', describe: '描述', deserve: '应得',
  design: '设计', desire: '渴望', destroy: '破坏', determine: '决定', develop: '发展',
  devote: '奉献', differ: '不同', direct: '指导', disappear: '消失', disappoint: '使失望',
  discover: '发现', discuss: '讨论', display: '展示', distinguish: '区分', distribute: '分配',
  disturb: '打扰', divide: '划分', dominate: '支配', doubt: '怀疑', earn: '赚取',
  educate: '教育', effect: '效果', elect: '选举', emerge: '出现', employ: '雇用',
  encourage: '鼓励', endure: '忍受', engage: '参与', enjoy: '享受', ensure: '确保',
  enter: '进入', entertain: '娱乐', equip: '装备', establish: '建立', estimate: '估计',
  evaluate: '评估', examine: '检查', exceed: '超过', exchange: '交换', exist: '存在',
  expand: '扩展', expect: '期待', experience: '经历', experiment: '实验', explain: '解释',
  explore: '探索', expose: '暴露', express: '表达', extend: '延伸', fail: '失败',
  fancy: '想象', fascinate: '迷住', favor: '偏爱', fear: '害怕', figure: '计算',
  finance: '资助', finish: '完成', fix: '修理', fluctuate: '波动', focus: '集中',
  follow: '跟随', forbid: '禁止', forecast: '预测', forgive: '原谅', form: '形成',
  found: '建立', free: '释放', freeze: '冻结', frighten: '惊吓', function: '运作',
  gain: '获得', gather: '聚集', generate: '产生', govern: '统治', graduate: '毕业',
  grasp: '掌握', grow: '增长', guarantee: '保证', guess: '猜测', guide: '引导',
  handle: '处理', happen: '发生', harm: '伤害', hate: '讨厌', heal: '治愈',
  hesitate: '犹豫', hide: '隐藏', highlight: '强调', hire: '雇佣', hope: '希望',
  hunt: '搜寻', identify: '识别', ignore: '忽视', imagine: '想象', imitate: '模仿',
  impact: '影响', imply: '暗示', import: '进口', impose: '强加', improve: '改善',
  include: '包含', increase: '增加', indicate: '指示', influence: '影响', inform: '通知',
  inherit: '继承', injure: '伤害', insist: '坚持', inspire: '激励', instruct: '指导',
  intend: '打算', interest: '兴趣', interpret: '解释', interrupt: '打断', interview: '面试',
  introduce: '介绍', invade: '入侵', invent: '发明', invest: '投资', invite: '邀请',
  involve: '涉及', isolate: '隔离', join: '加入', judge: '判断', justify: '证明正当',
  keep: '保持', kill: '杀死', know: '知道', lack: '缺乏', last: '持续',
  launch: '发射', lead: '引导', learn: '学习', lend: '借出', limit: '限制',
  link: '连接', listen: '听', live: '生活', locate: '定位', long: '渴望',
  look: '看', lose: '失去', maintain: '维持', manage: '管理', manufacture: '制造',
  mark: '标记', marry: '结婚', master: '掌握', matter: '要紧', mean: '意味着',
  measure: '测量', meet: '遇见', mention: '提及', mind: '介意', miss: '错过',
  misunderstand: '误解', mix: '混合', modify: '修改', monitor: '监控', move: '移动',
  multiply: '相乘', name: '命名', need: '需要', neglect: '忽视', negotiate: '谈判',
  note: '注意', notice: '注意', observe: '观察', obtain: '获得', occupy: '占据',
  occur: '发生', offer: '提供', open: '打开', operate: '操作', oppose: '反对',
  organize: '组织', originate: '起源', overcome: '克服', owe: '欠', own: '拥有',
  pack: '打包', participate: '参与', pass: '通过', perform: '执行', permit: '允许',
  persist: '坚持', persuade: '说服', pick: '挑选', plan: '计划', please: '取悦',
  possess: '拥有', postpone: '推迟', practice: '练习', predict: '预测', prefer: '偏爱',
  prepare: '准备', present: '呈现', preserve: '保存', pretend: '假装', prevent: '阻止',
  produce: '生产', progress: '进步', prohibit: '禁止', promise: '承诺', promote: '促进',
  propose: '提议', protect: '保护', prove: '证明', provide: '提供', publish: '出版',
  punish: '惩罚', purchase: '购买', pursue: '追求', puzzle: '使困惑', qualify: '使合格',
  question: '质疑', quit: '放弃', quote: '引用', race: '比赛', raise: '提高',
  range: '范围', reach: '到达', react: '反应', read: '阅读', realize: '意识到',
  reason: '推理', recall: '回忆', receive: '收到', recognize: '认出', recommend: '推荐',
  record: '记录', recover: '恢复', recycle: '回收', reduce: '减少', reflect: '反思',
  reform: '改革', refuse: '拒绝', regard: '看待', regret: '后悔', regulate: '管理',
  reject: '拒绝', relate: '联系', relax: '放松', release: '释放', rely: '依赖',
  remain: '保持', remember: '记得', remind: '提醒', remove: '移除', renew: '更新',
  repair: '修理', repeat: '重复', replace: '替换', reply: '回复', report: '报告',
  represent: '代表', require: '需要', research: '研究', resist: '抵抗', resolve: '解决',
  respond: '回应', rest: '休息', restore: '恢复', restrict: '限制', result: '导致',
  retire: '退休', return: '返回', reveal: '揭示', review: '回顾', revolution: '革命',
  reward: '奖励', rid: '摆脱', ride: '骑', rise: '上升', risk: '冒险',
  rob: '抢劫', ruin: '毁坏', rule: '统治', run: '跑', sacrifice: '牺牲',
  satisfy: '满足', save: '节省', say: '说', scan: '扫描', scare: '惊吓',
  schedule: '安排', search: '搜索', secure: '保护', see: '看见', seek: '寻找',
  select: '选择', sell: '卖', send: '发送', separate: '分离', serve: '服务',
  settle: '解决', share: '分享', shock: '震惊', shoot: '射击', show: '展示',
  shrink: '缩小', signal: '发信号', sign: '签署', simplify: '简化', sit: '坐',
  sleep: '睡觉', slow: '减慢', solve: '解决', sort: '分类', sound: '听起来',
  source: '来源', speak: '说', specify: '指定', spend: '花费', spread: '传播',
  stand: '站立', start: '开始', stay: '停留', steal: '偷', steer: '引导',
  stimulate: '刺激', stop: '停止', store: '储存', strengthen: '加强', stress: '强调',
  strike: '打击', struggle: '挣扎', study: '研究', submit: '提交', succeed: '成功',
  suffer: '遭受', suggest: '建议', suit: '适合', supply: '供应', support: '支持',
  suppose: '假设', surround: '包围', survey: '调查', survive: '幸存', suspect: '怀疑',
  sustain: '维持', swallow: '吞咽', swap: '交换', talk: '谈话', taste: '品尝',
  teach: '教', tend: '倾向', test: '测试', thank: '感谢', think: '思考',
  threaten: '威胁', throw: '扔', train: '训练', transform: '转变', translate: '翻译',
  transport: '运输', travel: '旅行', treat: '对待', trust: '信任', try: '尝试',
  turn: '转动', understand: '理解', undertake: '承担', unite: '联合', update: '更新',
  use: '使用', utilize: '利用', vary: '变化', view: '观看', visit: '访问',
  vote: '投票', wait: '等待', wake: '醒来', walk: '走', wander: '漫步',
  want: '想要', warm: '温暖', warn: '警告', waste: '浪费', watch: '观看',
  weaken: '减弱', wear: '穿戴', weigh: '称重', welcome: '欢迎', win: '获胜',
  wish: '希望', withdraw: '撤回', wonder: '想知道', work: '工作', worry: '担心',
  wrap: '包裹', write: '写', wrong: '冤枉',
};

// 算法生成派生词（仅从已知后缀还原词根，不盲目添加后缀造词）
function generateDerivatives(word) {
  if (!word || word.length < 3) return [];
  const w = word.toLowerCase();

  // 仅当单词本身已有后缀时，还原出词根形式
  // 且词根必须在 baseWordMeanings 中有记录（确保是真实单词+有中文释义）
  const suffixRules = [
    { suffix: 'tion', type: 'v.' },   // education → educate
    { suffix: 'sion', type: 'v.' },   // decision → decide
    { suffix: 'ment', type: 'v.' },   // development → develop
    { suffix: 'ness', type: 'adj.' }, // happiness → happy
    { suffix: 'ity', type: 'adj.' },  // ability → able
    { suffix: 'able', type: 'v.' },   // enjoyable → enjoy
    { suffix: 'ible', type: 'v.' },   // visible → vis(e) (rare, skip)
    { suffix: 'ful', type: 'n.' },    // careful → care
    { suffix: 'less', type: 'n.' },   // fearless → fear
    { suffix: 'ous', type: 'n.' },    // dangerous → danger
    { suffix: 'ive', type: 'v.' },    // creative → create
    { suffix: 'al', type: 'n.' },     // cultural → culture
    { suffix: 'ly', type: 'adj.' },   // quickly → quick
    { suffix: 'er', type: 'v.' },     // teacher → teach
    { suffix: 'or', type: 'v.' },     // actor → act
    { suffix: 'ist', type: 'n.' },    // artist → art
  ];

  const results = [];
  for (const rule of suffixRules) {
    if (w.endsWith(rule.suffix)) {
      let base = w.slice(0, -rule.suffix.length);
      // 处理特殊拼写变化
      if (rule.suffix === 'tion' && base.endsWith('a')) base = base.slice(0, -1) + 'e'; // educa → educate
      if (rule.suffix === 'sion' && base.endsWith('de')) base = base; // decide → decid (keep)
      if (rule.suffix === 'ity' && base.endsWith('abil')) base = base.slice(0, -1); // abil → able
      if (rule.suffix === 'ness' && base.endsWith('i')) base = base.slice(0, -1) + 'y'; // happi → happy
      if (base.length < 2) continue;

      // 必须在词库中找到中文释义，否则跳过（避免生成不存在的词）
      const baseM = baseWordMeanings[base];
      if (!baseM) continue;

      results.push(`${base} ${rule.type} ${baseM}`);
    }
  }
  return results.slice(0, 4);
}

// 获取单词的增强数据（合并手动数据和算法生成）
export function getWordEnrichment(term) {
  if (!term) return null;
  const key = term.toLowerCase().trim();
  const data = wordEnrichmentData[key];
  if (data) {
    return {
      collocations: data.collocations || [],
      derivatives: data.derivatives || [],
      wordForms: data.wordForms || {},
      synonyms: data.synonyms || [],
      antonyms: data.antonyms || [],
      examPoints: data.examPoints || [],
    };
  }
  // 算法回退：仅当能还原出词根时才返回派生词
  const autoDerivatives = generateDerivatives(term);
  if (autoDerivatives.length === 0) return null;
  return {
    collocations: [],
    derivatives: autoDerivatives,
    wordForms: {},
    synonyms: [],
    antonyms: [],
    examPoints: [],
  };
}

export default wordEnrichmentData;
