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
    synonyms: ['give up', 'desert', 'forsake', 'quit'],
    antonyms: ['keep', 'maintain', 'retain', 'preserve'],
    examPoints: ['后接 doing sth. 不接 to do', 'abandoned 作形容词常考']
  },
  ability: {
    collocations: ['have the ability to do 有能力做', 'show ability in 显示才能', 'to the best of one\'s ability 尽力'],
    derivatives: ['able adj. 有能力的', 'unable adj. 不能的', 'inability n. 无能', 'disable v. 使残疾', 'disability n. 残疾', 'enable v. 使能够'],
    wordForms: { adjective: 'able', adverb: 'ably' },
    synonyms: ['capability', 'capacity', 'competence', 'skill'],
    antonyms: ['inability', 'incapacity', 'incompetence'],
    examPoints: ['ability 后接不定式 to do', 'able → unable (加 un-)', 'enable sb to do sth']
  },
  absent: {
    collocations: ['be absent from 缺席', 'absent-minded 心不在焉的'],
    derivatives: ['absence n. 缺席', 'absently adv. 心不在焉地', 'absenteeism n. 旷课'],
    wordForms: { noun: 'absence', adverb: 'absently' },
    synonyms: ['missing', 'lacking', 'away'],
    antonyms: ['present', 'attending'],
    examPoints: ['be absent from 后接名词/动名词']
  },
  absorb: {
    collocations: ['be absorbed in 专心于', 'absorb knowledge 吸收知识'],
    derivatives: ['absorption n. 吸收', 'absorbing adj. 引人入胜的', 'absorbed adj. 全神贯注的'],
    wordForms: { noun: 'absorption', adjective: 'absorbing', pastTense: 'absorbed', pastParticiple: 'absorbed', presentParticiple: 'absorbing' },
    synonyms: ['engage', 'soak up', 'take in', 'assimilate'],
    antonyms: ['emit', 'release', 'exude'],
    examPoints: ['be absorbed in 后接 doing/名词', 'absorbing = fascinating']
  },
  accept: {
    collocations: ['accept an offer 接受提议', 'accept responsibility 承担责任', 'accept the truth 接受事实'],
    derivatives: ['acceptance n. 接受', 'acceptable adj. 可接受的', 'unacceptable adj. 不可接受的', 'accepted adj. 公认的'],
    wordForms: { noun: 'acceptance', adjective: 'acceptable', pastTense: 'accepted', pastParticiple: 'accepted', presentParticiple: 'accepting' },
    synonyms: ['receive', 'take', 'admit', 'acknowledge'],
    antonyms: ['reject', 'refuse', 'decline'],
    examPoints: ['accept 强调主观愿意接受', 'receive 仅表示客观收到']
  },
  access: {
    collocations: ['have access to 有权使用', 'gain access to 获得使用权限', 'easy access to 易于接近'],
    derivatives: ['accessible adj. 易接近的', 'accessibility n. 可达性', 'accession n. 就任'],
    wordForms: { adjective: 'accessible', adverb: 'accessibly' },
    synonyms: ['entry', 'approach', 'admission'],
    antonyms: ['denial', 'exclusion', 'barrier'],
    examPoints: ['have access to 中 to 是介词后接 doing', 'accessible to sb']
  },
  account: {
    collocations: ['account for 解释；占比', 'on account of 因为', 'take account of 考虑到', 'open an account 开户'],
    derivatives: ['accountant n. 会计', 'accounting n. 会计学', 'accountable adj. 应负责的', 'accountability n. 责任'],
    wordForms: { noun: 'account', adjective: 'accountable', adverb: 'accountably' },
    synonyms: ['explanation', 'report', 'record', 'description'],
    antonyms: [],
    examPoints: ['account for 高频短语动词', 'on no account 放句首需部分倒装']
  },
  achieve: {
    collocations: ['achieve one\'s goal 实现目标', 'achieve success 取得成功'],
    derivatives: ['achievement n. 成就', 'achievable adj. 可实现的'],
    wordForms: { noun: 'achievement', adjective: 'achievable', pastTense: 'achieved', pastParticiple: 'achieved', presentParticiple: 'achieving' },
    synonyms: ['accomplish', 'attain', 'reach', 'fulfill'],
    antonyms: ['fail', 'miss', 'lose'],
    examPoints: ['achievement 可数名词', 'make a great achievement']
  },
  adapt: {
    collocations: ['adapt to 适应', 'adapt from 改编自', 'adapt oneself to 使自己适应'],
    derivatives: ['adaptation n. 适应；改编', 'adaptable adj. 适应性强的', 'adapter n. 适配器'],
    wordForms: { noun: 'adaptation', adjective: 'adaptable', pastTense: 'adapted', pastParticiple: 'adapted', presentParticiple: 'adapting' },
    synonyms: ['adjust', 'accommodate', 'modify', 'alter'],
    antonyms: ['remain', 'stay', 'preserve'],
    examPoints: ['adapt to 中 to 是介词后接 doing', 'adapt ≠ adopt(收养/采纳)']
  },
  adopt: {
    collocations: ['adopt a policy 采取政策', 'adopt a child 收养孩子', 'adopt a new approach 采用新方法'],
    derivatives: ['adoption n. 收养；采纳', 'adoptive adj. 收养的', 'adopted adj. 被收养的'],
    wordForms: { noun: 'adoption', adjective: 'adoptive', pastTense: 'adopted', pastParticiple: 'adopted', presentParticiple: 'adopting' },
    synonyms: ['accept', 'embrace', 'take on', 'assume'],
    antonyms: ['reject', 'abandon', 'discard'],
    examPoints: ['adopt ≠ adapt(适应)', 'adopted son 养子 vs adoptive father 养父']
  },
  advantage: {
    collocations: ['take advantage of 利用', 'have an advantage over 比...有优势', 'to one\'s advantage 对...有利'],
    derivatives: ['advantageous adj. 有利的', 'disadvantage n. 劣势', 'disadvantageous adj. 不利的'],
    wordForms: { adjective: 'advantageous', adverb: 'advantageously' },
    synonyms: ['benefit', 'edge', 'upper hand', 'merit'],
    antonyms: ['disadvantage', 'drawback', 'shortcoming'],
    examPoints: ['take advantage of = make use of', '反义词加 dis- 前缀']
  },
  affect: {
    collocations: ['be affected by 受...影响', 'affect sb deeply 深深影响某人'],
    derivatives: ['affection n. 喜爱', 'affectionate adj. 深情的', 'affectation n. 做作'],
    wordForms: { noun: 'affection', adjective: 'affectionate', pastTense: 'affected', pastParticiple: 'affected', presentParticiple: 'affecting' },
    synonyms: ['influence', 'impact', 'touch', 'alter'],
    antonyms: ['leave unaffected', 'preserve'],
    examPoints: ['affect(v.) ≠ effect(n.效果)', 'affecting = moving 感人的']
  },
  afford: {
    collocations: ['afford to do 负担得起做', 'can\'t afford 买不起', 'afford time for 抽出时间'],
    derivatives: ['affordable adj. 负担得起的', 'affordability n. 可负担性'],
    wordForms: { adjective: 'affordable', pastTense: 'afforded', pastParticiple: 'afforded', presentParticiple: 'affording' },
    synonyms: ['bear', 'manage', 'sustain', 'support'],
    antonyms: ['cannot afford', 'be unable to'],
    examPoints: ['常与 can/could/be able to 连用', 'afford to do sth']
  },
  agree: {
    collocations: ['agree with sb 同意某人', 'agree on sth 就...达成一致', 'agree to do 同意做'],
    derivatives: ['agreement n. 协议；同意', 'disagree v. 不同意', 'disagreement n. 分歧', 'agreeable adj. 令人愉快的'],
    wordForms: { noun: 'agreement', adjective: 'agreeable', pastTense: 'agreed', pastParticiple: 'agreed', presentParticiple: 'agreeing' },
    synonyms: ['consent', 'approve', 'concur', 'assent'],
    antonyms: ['disagree', 'differ', 'object', 'oppose'],
    examPoints: ['agree with + 人/意见', 'agree on + 话题', 'agree to + 计划/提议']
  },
  allow: {
    collocations: ['allow sb to do 允许某人做', 'allow for 考虑到', 'allow doing 允许做'],
    derivatives: ['allowance n. 津贴', 'allowable adj. 许可的'],
    wordForms: { noun: 'allowance', adjective: 'allowable', pastTense: 'allowed', pastParticiple: 'allowed', presentParticiple: 'allowing' },
    synonyms: ['permit', 'let', 'authorize', 'enable'],
    antonyms: ['forbid', 'prohibit', 'ban', 'prevent'],
    examPoints: ['allow sb to do vs allow doing', 'allow for = take into consideration']
  },
  amaze: {
    collocations: ['be amazed at 对...感到惊讶', 'amaze sb 使某人惊讶'],
    derivatives: ['amazement n. 惊讶', 'amazing adj. 令人惊奇的', 'amazed adj. 感到惊讶的'],
    wordForms: { noun: 'amazement', adjective: 'amazing', pastTense: 'amazed', pastParticiple: 'amazed', presentParticiple: 'amazing' },
    synonyms: ['astonish', 'surprise', 'stun', 'astound'],
    antonyms: ['expect', 'anticipate'],
    examPoints: ['amazing(令人惊讶) vs amazed(感到惊讶)', 'be amazed at/by']
  },
  analyze: {
    collocations: ['analyze data 分析数据', 'analyze the cause 分析原因'],
    derivatives: ['analysis n. 分析', 'analyst n. 分析师', 'analytical adj. 分析的'],
    wordForms: { noun: 'analysis', adjective: 'analytical', pastTense: 'analyzed', pastParticiple: 'analyzed', presentParticiple: 'analyzing' },
    synonyms: ['examine', 'study', 'investigate', 'evaluate'],
    antonyms: ['ignore', 'overlook'],
    examPoints: ['analysis 复数 analyses', 'analytical(英) = analytic(美)']
  },
  announce: {
    collocations: ['announce the result 宣布结果', 'announce to the public 向公众宣布'],
    derivatives: ['announcement n. 宣布', 'announcer n. 广播员'],
    wordForms: { noun: 'announcement', pastTense: 'announced', pastParticiple: 'announced', presentParticiple: 'announcing' },
    synonyms: ['declare', 'proclaim', 'broadcast', 'reveal'],
    antonyms: ['conceal', 'hide', 'withhold'],
    examPoints: ['announce + that 从句', 'make an announcement']
  },
  anxious: {
    collocations: ['be anxious about 担心', 'be anxious to do 急于做', 'anxious for 渴望'],
    derivatives: ['anxiety n. 焦虑', 'anxiously adv. 焦虑地'],
    wordForms: { noun: 'anxiety', adverb: 'anxiously' },
    synonyms: ['worried', 'nervous', 'uneasy', 'concerned'],
    antonyms: ['calm', 'relaxed', 'confident', 'composed'],
    examPoints: ['be anxious about + 名词', 'be anxious to do = be eager to do']
  },
  apply: {
    collocations: ['apply for 申请', 'apply to 适用于', 'apply oneself to 致力于', 'apply A to B 把A应用于B'],
    derivatives: ['application n. 申请；应用', 'applicant n. 申请人', 'applicable adj. 适用的', 'applied adj. 应用的'],
    wordForms: { noun: 'application', adjective: 'applicable', pastTense: 'applied', pastParticiple: 'applied', presentParticiple: 'applying' },
    synonyms: ['request', 'petition', 'implement', 'utilize'],
    antonyms: ['withdraw', 'cancel'],
    examPoints: ['apply for + 职位/学校', 'apply to + 对象', 'to 是介词后接 doing']
  },
  approach: {
    collocations: ['an approach to doing ...的方法', 'approach sb 接近某人', 'make an approach to 接近'],
    derivatives: ['approachable adj. 可接近的'],
    wordForms: { adjective: 'approachable', pastTense: 'approached', pastParticiple: 'approached', presentParticiple: 'approaching' },
    synonyms: ['method', 'way', 'technique', 'draw near'],
    antonyms: ['avoid', 'withdraw', 'retreat'],
    examPoints: ['an approach to doing (to是介词)', 'approach 作动词和名词都常用']
  },
  argue: {
    collocations: ['argue with sb 与某人争论', 'argue for 支持', 'argue against 反对', 'argue that 辩称'],
    derivatives: ['argument n. 论点；争论', 'argumentative adj. 好争论的'],
    wordForms: { noun: 'argument', adjective: 'argumentative', pastTense: 'argued', pastParticiple: 'argued', presentParticiple: 'arguing' },
    synonyms: ['debate', 'dispute', 'contend', 'reason'],
    antonyms: ['agree', 'consent', 'concede'],
    examPoints: ['argument 不双写 e', 'argue sb into doing 说服某人做']
  },
  arrange: {
    collocations: ['arrange for 安排', 'arrange to do 安排做', 'arrange a meeting 安排会议'],
    derivatives: ['arrangement n. 安排', 'arranger n. 编曲者'],
    wordForms: { noun: 'arrangement', pastTense: 'arranged', pastParticiple: 'arranged', presentParticiple: 'arranging' },
    synonyms: ['organize', 'plan', 'schedule', 'prepare'],
    antonyms: ['disarrange', 'disrupt'],
    examPoints: ['arrange for sb to do sth', 'make arrangements for']
  },
  assume: {
    collocations: ['assume responsibility 承担责任', 'assume that 假定'],
    derivatives: ['assumption n. 假设', 'assuming conj. 假如'],
    wordForms: { noun: 'assumption', pastTense: 'assumed', pastParticiple: 'assumed', presentParticiple: 'assuming' },
    synonyms: ['suppose', 'presume', 'take for granted', 'believe'],
    antonyms: ['prove', 'demonstrate', 'verify'],
    examPoints: ['assuming that = supposing 假如', 'make an assumption']
  },
  avoid: {
    collocations: ['avoid doing 避免做', 'avoid sb 避开某人'],
    derivatives: ['avoidance n. 避免', 'avoidable adj. 可避免的', 'unavoidable adj. 不可避免的'],
    wordForms: { noun: 'avoidance', adjective: 'avoidable', pastTense: 'avoided', pastParticiple: 'avoided', presentParticiple: 'avoiding' },
    synonyms: ['evade', 'escape', 'dodge', 'shun'],
    antonyms: ['face', 'confront', 'encounter', 'meet'],
    examPoints: ['后接 doing 不接 to do', 'unavoidable = inevitable']
  },
  aware: {
    collocations: ['be aware of 意识到', 'become aware of 逐渐意识到'],
    derivatives: ['awareness n. 意识', 'unaware adj. 未意识到的'],
    wordForms: { noun: 'awareness' },
    synonyms: ['conscious', 'mindful', 'alert', 'informed'],
    antonyms: ['unaware', 'ignorant', 'oblivious'],
    examPoints: ['be aware of + 名词', 'be aware that + 从句', '反义词 unaware']
  },
  benefit: {
    collocations: ['benefit from 从...受益', 'for the benefit of 为了...的利益', 'be of benefit 有益'],
    derivatives: ['beneficial adj. 有益的', 'beneficiary n. 受益人'],
    wordForms: { adjective: 'beneficial', pastTense: 'benefited', pastParticiple: 'benefited', presentParticiple: 'benefiting' },
    synonyms: ['advantage', 'profit', 'gain', 'help'],
    antonyms: ['harm', 'damage', 'disadvantage', 'loss'],
    examPoints: ['benefit from (主动受益)', 'be beneficial to (对...有益)', '美式 benefited/benefiting']
  },
  capable: {
    collocations: ['be capable of 能够', 'capable of doing 有能力做'],
    derivatives: ['capability n. 能力', 'capably adv. 有能力地', 'incapable adj. 无能力的'],
    wordForms: { noun: 'capability', adverb: 'capably' },
    synonyms: ['able', 'competent', 'qualified', 'proficient'],
    antonyms: ['incapable', 'unable', 'incompetent'],
    examPoints: ['be capable of doing (不是 to do)', 'capable ≠ able(后接 to do)']
  },
  cause: {
    collocations: ['cause sb to do 导致某人做', 'the cause of ...的原因', 'cause and effect 因果'],
    derivatives: ['causal adj. 因果的'],
    wordForms: { adjective: 'causal', pastTense: 'caused', pastParticiple: 'caused', presentParticiple: 'causing' },
    synonyms: ['lead to', 'result in', 'bring about', 'trigger'],
    antonyms: ['prevent', 'stop', 'hinder'],
    examPoints: ['cause sb to do sth', 'cause 作名词 = reason']
  },
  challenge: {
    collocations: ['challenge sb to do 向某人挑战', 'take up the challenge 接受挑战', 'face a challenge 面临挑战'],
    derivatives: ['challenger n. 挑战者', 'challenging adj. 有挑战性的'],
    wordForms: { adjective: 'challenging', pastTense: 'challenged', pastParticiple: 'challenged', presentParticiple: 'challenging' },
    synonyms: ['defy', 'confront', 'dare', 'test'],
    antonyms: ['accept', 'yield to', 'surrender to'],
    examPoints: ['challenging = demanding', 'a challenging task']
  },
  charge: {
    collocations: ['in charge of 负责', 'take charge of 掌管', 'charge sb with 指控某人', 'free of charge 免费'],
    derivatives: ['charger n. 充电器'],
    wordForms: { pastTense: 'charged', pastParticiple: 'charged', presentParticiple: 'charging' },
    synonyms: ['accuse', 'blame', 'fee', 'cost', 'responsibility'],
    antonyms: ['discharge', 'free', 'release'],
    examPoints: ['in charge of (主动负责)', 'in the charge of (被...管理)', 'charge sb with sth']
  },
  claim: {
    collocations: ['claim that 声称', 'claim to have done 声称做过', 'make a claim 提出索赔'],
    derivatives: ['claimant n. 索赔人'],
    wordForms: { noun: 'claim', pastTense: 'claimed', pastParticiple: 'claimed', presentParticiple: 'claiming' },
    synonyms: ['assert', 'declare', 'state', 'maintain'],
    antonyms: ['deny', 'disclaim', 'reject'],
    examPoints: ['claim to do / claim that', 'claim 作名词=索赔']
  },
  collect: {
    collocations: ['collect data 收集数据', 'collect stamps 集邮', 'collect oneself 镇定下来'],
    derivatives: ['collection n. 收集', 'collector n. 收藏家', 'collective adj. 集体的', 'collectively adv. 共同地'],
    wordForms: { noun: 'collection', adjective: 'collective', adverb: 'collectively', pastTense: 'collected', pastParticiple: 'collected', presentParticiple: 'collecting' },
    synonyms: ['gather', 'assemble', 'accumulate', 'amass'],
    antonyms: ['scatter', 'distribute', 'disperse'],
    examPoints: ['collection 可数', 'a collection of + 复数名词']
  },
  commit: {
    collocations: ['commit a crime 犯罪', 'commit suicide 自杀', 'commit oneself to 致力于', 'be committed to 投入于'],
    derivatives: ['commitment n. 承诺', 'committed adj. 忠诚的'],
    wordForms: { noun: 'commitment', adjective: 'committed', pastTense: 'committed', pastParticiple: 'committed', presentParticiple: 'committing' },
    synonyms: ['pledge', 'promise', 'dedicate', 'devote'],
    antonyms: ['abandon', 'withdraw', 'quit'],
    examPoints: ['commit a crime/suicide/error', 'be committed to + doing']
  },
  communicate: {
    collocations: ['communicate with 与...交流', 'communicate sth to 把...传达给'],
    derivatives: ['communication n. 交流', 'communicative adj. 健谈的', 'communicator n. 沟通者'],
    wordForms: { noun: 'communication', adjective: 'communicative', pastTense: 'communicated', pastParticiple: 'communicated', presentParticiple: 'communicating' },
    synonyms: ['convey', 'transmit', 'share', 'express'],
    antonyms: ['withhold', 'conceal', 'hide'],
    examPoints: ['communicate with sb', 'communication 不可数名词']
  },
  compare: {
    collocations: ['compare A with B 把A与B比较', 'compare A to B 把A比作B', 'compared with/to 与...相比', 'beyond compare 无与伦比'],
    derivatives: ['comparison n. 比较', 'comparative adj. 比较的', 'comparable adj. 可比较的'],
    wordForms: { noun: 'comparison', adjective: 'comparable', pastTense: 'compared', pastParticiple: 'compared', presentParticiple: 'comparing' },
    synonyms: ['contrast', 'evaluate', 'assess', 'match'],
    antonyms: ['distinguish', 'differentiate', 'contrast'],
    examPoints: ['compare with (比较差异)', 'compare to (比喻)', 'compared to/with 作状语']
  },
  compete: {
    collocations: ['compete with/against 与...竞争', 'compete for 争夺', 'compete in 参加比赛'],
    derivatives: ['competition n. 竞争', 'competitor n. 竞争者', 'competitive adj. 有竞争力的', 'competence n. 能力'],
    wordForms: { noun: 'competition', adjective: 'competitive', pastTense: 'competed', pastParticiple: 'competed', presentParticiple: 'competing' },
    synonyms: ['contend', 'rival', 'contest', 'vie'],
    antonyms: ['cooperate', 'collaborate', 'yield'],
    examPoints: ['compete against/with sb for sth', 'competition 可数']
  },
  complain: {
    collocations: ['complain about 抱怨', 'complain to sb 向某人投诉', 'complain that 抱怨说'],
    derivatives: ['complaint n. 抱怨', 'complainant n. 投诉人'],
    wordForms: { noun: 'complaint', pastTense: 'complained', pastParticiple: 'complained', presentParticiple: 'complaining' },
    synonyms: ['protest', 'grumble', 'object', 'criticize'],
    antonyms: ['praise', 'commend', 'applaud'],
    examPoints: ['complain to sb about sth', 'make a complaint']
  },
  concern: {
    collocations: ['be concerned about 关心', 'as far as...be concerned 就...而言', 'concern oneself with 关心', 'of concern 令人担忧的'],
    derivatives: ['concerned adj. 关心的', 'concerning prep. 关于', 'unconcerned adj. 不关心的'],
    wordForms: { adjective: 'concerned', pastTense: 'concerned', pastParticiple: 'concerned', presentParticiple: 'concerning' },
    synonyms: ['worry', 'involve', 'relate to', 'affect'],
    antonyms: ['ignore', 'disregard', 'overlook'],
    examPoints: ['as far as I\'m concerned 就我而言', 'concerned(前置=有关的, 后置=关切的)']
  },
  conclude: {
    collocations: ['conclude that 得出结论', 'conclude by doing 以...结束', 'to conclude 总之'],
    derivatives: ['conclusion n. 结论', 'conclusive adj. 决定性的'],
    wordForms: { noun: 'conclusion', adjective: 'conclusive', pastTense: 'concluded', pastParticiple: 'concluded', presentParticiple: 'concluding' },
    synonyms: ['finish', 'end', 'decide', 'determine'],
    antonyms: ['begin', 'start', 'commence'],
    examPoints: ['draw/reach a conclusion', 'in conclusion 最后']
  },
  condition: {
    collocations: ['on condition that 条件是', 'in good condition 状况良好', 'under...conditions 在...条件下'],
    derivatives: ['conditional adj. 有条件的', 'conditioner n. 护发素'],
    wordForms: { adjective: 'conditional' },
    synonyms: ['state', 'situation', 'circumstance', 'requirement'],
    antonyms: [],
    examPoints: ['on condition that = provided that', 'conditions 复数=环境/条件']
  },
  conduct: {
    collocations: ['conduct a survey 进行调查', 'conduct an experiment 做实验', 'conduct oneself 表现'],
    derivatives: ['conductor n. 指挥；导体', 'conduction n. 传导', 'conductive adj. 导电的'],
    wordForms: { noun: 'conduction', adjective: 'conductive', pastTense: 'conducted', pastParticiple: 'conducted', presentParticiple: 'conducting' },
    synonyms: ['carry out', 'perform', 'direct', 'guide', 'behavior'],
    antonyms: ['misconduct'],
    examPoints: ['conduct(v.执行) /kənˈdʌkt/', 'conduct(n.行为) /ˈkɒndʌkt/']
  },
  confidence: {
    collocations: ['have confidence in 对...有信心', 'with confidence 自信地', 'lack confidence 缺乏信心'],
    derivatives: ['confident adj. 自信的', 'confidently adv. 自信地', 'confide v. 吐露', 'confidential adj. 机密的'],
    wordForms: { adjective: 'confident', adverb: 'confidently' },
    synonyms: ['assurance', 'certainty', 'trust', 'faith'],
    antonyms: ['doubt', 'uncertainty', 'timidity'],
    examPoints: ['be confident of/about', 'have confidence in sb']
  },
  confirm: {
    collocations: ['confirm that 确认', 'confirm sb in 使某人坚定', 'confirm a booking 确认预订'],
    derivatives: ['confirmation n. 确认', 'confirmed adj. 确认的'],
    wordForms: { noun: 'confirmation', adjective: 'confirmed', pastTense: 'confirmed', pastParticiple: 'confirmed', presentParticiple: 'confirming' },
    synonyms: ['verify', 'validate', 'prove', 'establish'],
    antonyms: ['deny', 'contradict', 'refute'],
    examPoints: ['confirm + that 从句', 'confirmation 可数']
  },
  consider: {
    collocations: ['consider doing 考虑做', 'consider...as 把...看作', 'considering that 考虑到'],
    derivatives: ['consideration n. 考虑', 'considerate adj. 体贴的', 'considerable adj. 相当大的', 'considered adj. 深思熟虑的'],
    wordForms: { noun: 'consideration', adjective: 'considerable', pastTense: 'considered', pastParticiple: 'considered', presentParticiple: 'considering' },
    synonyms: ['think about', 'ponder', 'contemplate', 'regard'],
    antonyms: ['disregard', 'ignore', 'overlook'],
    examPoints: ['后接 doing 不接 to do', 'considerate ≠ considerable(相当大的)']
  },
  contribute: {
    collocations: ['contribute to 贡献；导致', 'contribute A to B 把A贡献给B', 'make a contribution to 对...做出贡献'],
    derivatives: ['contribution n. 贡献', 'contributor n. 贡献者', 'contributory adj. 促成的'],
    wordForms: { noun: 'contribution', adjective: 'contributory', pastTense: 'contributed', pastParticiple: 'contributed', presentParticiple: 'contributing' },
    synonyms: ['donate', 'provide', 'add to', 'lead to'],
    antonyms: ['withhold', 'detract', 'subtract'],
    examPoints: ['contribute to = lead to (to是介词)', 'make a contribution to']
  },
  convince: {
    collocations: ['convince sb of 使某人确信', 'convince sb to do 说服某人做', 'be convinced that 确信'],
    derivatives: ['convincing adj. 有说服力的', 'conviction n. 信念'],
    wordForms: { noun: 'conviction', adjective: 'convincing', pastTense: 'convinced', pastParticiple: 'convinced', presentParticiple: 'convincing' },
    synonyms: ['persuade', 'assure', 'satisfy', 'prove to'],
    antonyms: ['doubt', 'disbelieve', 'dissuade'],
    examPoints: ['convince sb of sth', 'be convinced that', 'convincing argument']
  },
  create: {
    collocations: ['create jobs 创造就业', 'create a good impression 留下好印象', 'create conditions 创造条件'],
    derivatives: ['creation n. 创造', 'creative adj. 有创造力的', 'creativity n. 创造力', 'creator n. 创造者', 'creature n. 生物'],
    wordForms: { noun: 'creation', adjective: 'creative', pastTense: 'created', pastParticiple: 'created', presentParticiple: 'creating' },
    synonyms: ['produce', 'make', 'generate', 'invent', 'establish'],
    antonyms: ['destroy', 'demolish', 'ruin', 'annihilate'],
    examPoints: ['creative = innovative', 'creature = living being']
  },
  decide: {
    collocations: ['decide to do 决定做', 'decide on 决定选用', 'decide against 决定不'],
    derivatives: ['decision n. 决定', 'decisive adj. 决定性的', 'decidedly adv. 果断地'],
    wordForms: { noun: 'decision', adjective: 'decisive', adverb: 'decidedly', pastTense: 'decided', pastParticiple: 'decided', presentParticiple: 'deciding' },
    synonyms: ['determine', 'resolve', 'settle', 'conclude'],
    antonyms: ['hesitate', 'waver', 'delay'],
    examPoints: ['decide to do = make a decision to do', 'decisive = determining']
  },
  declare: {
    collocations: ['declare war on 对...宣战', 'declare that 宣布', 'declare oneself 表明立场'],
    derivatives: ['declaration n. 宣布', 'declared adj. 公开宣称的'],
    wordForms: { noun: 'declaration', pastTense: 'declared', pastParticiple: 'declared', presentParticiple: 'declaring' },
    synonyms: ['announce', 'proclaim', 'state', 'assert'],
    antonyms: ['conceal', 'hide', 'withhold'],
    examPoints: ['declare + that 从句', 'Declaration of Independence']
  },
  decline: {
    collocations: ['decline to do 拒绝做', 'on the decline 在下降', 'a sharp decline 急剧下降'],
    derivatives: [],
    wordForms: { pastTense: 'declined', pastParticiple: 'declined', presentParticiple: 'declining' },
    synonyms: ['decrease', 'drop', 'fall', 'refuse', 'reject'],
    antonyms: ['increase', 'rise', 'accept', 'improve'],
    examPoints: ['decline to do = refuse to do', 'decline 作名词=下降趋势']
  },
  defend: {
    collocations: ['defend against 防御', 'defend sb from 保护某人免受', 'defend one\'s rights 捍卫权利'],
    derivatives: ['defense n. 防御', 'defensive adj. 防御性的', 'defendant n. 被告', 'defender n. 防御者'],
    wordForms: { noun: 'defense', adjective: 'defensive', pastTense: 'defended', pastParticiple: 'defended', presentParticiple: 'defending' },
    synonyms: ['protect', 'guard', 'shield', 'safeguard'],
    antonyms: ['attack', 'assault', 'invade'],
    examPoints: ['defend sb from/against', 'in defense of']
  },
  deliver: {
    collocations: ['deliver a speech 发表演讲', 'deliver goods 送货', 'deliver a baby 接生'],
    derivatives: ['delivery n. 递送', 'deliveryman n. 送货员'],
    wordForms: { noun: 'delivery', pastTense: 'delivered', pastParticiple: 'delivered', presentParticiple: 'delivering' },
    synonyms: ['convey', 'transport', 'hand over', 'give'],
    antonyms: ['receive', 'collect', 'retain'],
    examPoints: ['deliver a speech/lecture', 'take delivery of 收货']
  },
  demand: {
    collocations: ['demand to do 要求做', 'in demand 有需求', 'meet the demand 满足需求', 'on demand 一经要求'],
    derivatives: ['demanding adj. 要求高的'],
    wordForms: { adjective: 'demanding', pastTense: 'demanded', pastParticiple: 'demanded', presentParticiple: 'demanding' },
    synonyms: ['require', 'request', 'insist', 'need'],
    antonyms: ['supply', 'offer', 'grant'],
    examPoints: ['demand + that 从句用虚拟语气(should + do)', 'in demand ≠ on demand']
  },
  depend: {
    collocations: ['depend on 依赖', 'depend on sb to do 指望某人做', 'it depends 视情况而定'],
    derivatives: ['dependence n. 依赖', 'dependent adj. 依赖的', 'independent adj. 独立的', 'independence n. 独立'],
    wordForms: { noun: 'dependence', adjective: 'dependent' },
    synonyms: ['rely', 'count on', 'hinge on', 'rest on'],
    antonyms: ['independent', 'autonomous', 'self-sufficient'],
    examPoints: ['depend on = rely on', 'dependent on ≠ independent of']
  },
  describe: {
    collocations: ['describe...as 把...描述为', 'describe in detail 详细描述'],
    derivatives: ['description n. 描述', 'descriptive adj. 描述性的'],
    wordForms: { noun: 'description', adjective: 'descriptive', pastTense: 'described', pastParticiple: 'described', presentParticiple: 'describing' },
    synonyms: ['depict', 'portray', 'characterize', 'illustrate'],
    antonyms: [],
    examPoints: ['describe A as B', 'beyond description 难以描述']
  },
  desire: {
    collocations: ['desire to do 渴望做', 'desire for 渴望', 'at sb\'s desire 应某人要求'],
    derivatives: ['desirable adj. 令人向往的', 'undesirable adj. 不想要的'],
    wordForms: { adjective: 'desirable', pastTense: 'desired', pastParticiple: 'desired', presentParticiple: 'desiring' },
    synonyms: ['want', 'wish', 'long for', 'crave'],
    antonyms: ['dislike', 'despise', 'reject'],
    examPoints: ['desire to do', 'desirable ≠ desirous(渴望的)']
  },
  determine: {
    collocations: ['determine to do 决心做', 'be determined to do 下定决心', 'determine on 决定'],
    derivatives: ['determination n. 决心', 'determined adj. 坚决的'],
    wordForms: { noun: 'determination', adjective: 'determined', pastTense: 'determined', pastParticiple: 'determined', presentParticiple: 'determining' },
    synonyms: ['decide', 'resolve', 'establish', 'ascertain'],
    antonyms: ['hesitate', 'waver', 'fluctuate'],
    examPoints: ['determine to do (动作)', 'be determined to do (状态)']
  },
  develop: {
    collocations: ['develop from 从...发展而来', 'develop into 发展成为', 'develop a habit 养成习惯'],
    derivatives: ['development n. 发展', 'developing adj. 发展中的', 'developed adj. 发达的', 'developer n. 开发者'],
    wordForms: { noun: 'development', adjective: 'developed', pastTense: 'developed', pastParticiple: 'developed', presentParticiple: 'developing' },
    synonyms: ['grow', 'expand', 'evolve', 'progress'],
    antonyms: ['decline', 'regress', 'deteriorate'],
    examPoints: ['developing country 发展中国家', 'developed country 发达国家']
  },
  devote: {
    collocations: ['devote oneself to 致力于', 'devote...to doing 把...奉献给', 'be devoted to 专心于'],
    derivatives: ['devotion n. 奉献', 'devoted adj. 忠诚的'],
    wordForms: { noun: 'devotion', adjective: 'devoted', pastTense: 'devoted', pastParticiple: 'devoted', presentParticiple: 'devoting' },
    synonyms: ['dedicate', 'commit', 'pledge', 'allocate'],
    antonyms: ['neglect', 'abandon', 'ignore'],
    examPoints: ['devote...to doing (to是介词)', 'be devoted to + doing/名词']
  },
  discover: {
    collocations: ['discover that 发现', 'discover sb doing 发现某人在做'],
    derivatives: ['discovery n. 发现', 'discoverer n. 发现者'],
    wordForms: { noun: 'discovery', pastTense: 'discovered', pastParticiple: 'discovered', presentParticiple: 'discovering' },
    synonyms: ['find', 'detect', 'uncover', 'reveal', 'unearth'],
    antonyms: ['hide', 'conceal', 'cover', 'bury'],
    examPoints: ['make a discovery', 'discover sb doing sth']
  },
  effective: {
    collocations: ['effective measures 有效措施', 'become effective 生效', 'effective in 在...方面有效'],
    derivatives: ['effect n. 效果', 'effectively adv. 有效地', 'effectiveness n. 有效性'],
    wordForms: { noun: 'effect', adverb: 'effectively' },
    synonyms: ['efficient', 'productive', 'successful', 'potent'],
    antonyms: ['ineffective', 'useless', 'futile'],
    examPoints: ['effective(有效果的) ≠ efficient(有效率的)', 'take effect 生效']
  },
  effort: {
    collocations: ['make an effort to do 努力做', 'spare no effort to do 不遗余力', 'with effort 费力地', 'efforts to do 努力做'],
    derivatives: [],
    wordForms: {},
    synonyms: ['attempt', 'endeavor', 'struggle', 'exertion'],
    antonyms: ['ease', 'laziness', 'idleness'],
    examPoints: ['make an effort/efforts to do', 'spare no effort to do']
  },
  employ: {
    collocations: ['employ sb to do 雇佣某人做', 'be employed in 从事于', 'employ a method 使用方法'],
    derivatives: ['employee n. 雇员', 'employer n. 雇主', 'employment n. 就业', 'unemployment n. 失业', 'unemployed adj. 失业的'],
    wordForms: { noun: 'employment', adjective: 'employed', pastTense: 'employed', pastParticiple: 'employed', presentParticiple: 'employing' },
    synonyms: ['hire', 'engage', 'recruit', 'use', 'apply'],
    antonyms: ['fire', 'dismiss', 'lay off', 'unemploy'],
    examPoints: ['employ = use (使用方法)', 'be employed in doing']
  },
  encourage: {
    collocations: ['encourage sb to do 鼓励某人做', 'encourage sb in sth 在...方面鼓励'],
    derivatives: ['encouragement n. 鼓励', 'encouraging adj. 令人鼓舞的'],
    wordForms: { noun: 'encouragement', adjective: 'encouraging', pastTense: 'encouraged', pastParticiple: 'encouraged', presentParticiple: 'encouraging' },
    synonyms: ['inspire', 'motivate', 'urge', 'support'],
    antonyms: ['discourage', 'deter', 'dishearten'],
    examPoints: ['encourage sb to do (反义: discourage sb from doing)', 'encouraging news']
  },
  environment: {
    collocations: ['protect the environment 保护环境', 'in a...environment 在...环境中'],
    derivatives: ['environmental adj. 环境的', 'environmentally adv. 环境方面地', 'environmentalist n. 环保主义者'],
    wordForms: { adjective: 'environmental', adverb: 'environmentally' },
    synonyms: ['surroundings', 'setting', 'habitat', 'context'],
    antonyms: [],
    examPoints: ['environmental protection', 'environmentally friendly']
  },
  establish: {
    collocations: ['establish a company 创办公司', 'establish a relationship 建立关系', 'establish oneself as 确立自己为'],
    derivatives: ['establishment n. 建立', 'established adj. 既定的'],
    wordForms: { noun: 'establishment', adjective: 'established', pastTense: 'established', pastParticiple: 'established', presentParticiple: 'establishing' },
    synonyms: ['set up', 'found', 'create', 'institute'],
    antonyms: ['abolish', 'dismantle', 'destroy'],
    examPoints: ['establish = set up', 'an established fact 既定事实']
  },
  evaluate: {
    collocations: ['evaluate the effect 评估效果', 'evaluate performance 评估表现'],
    derivatives: ['evaluation n. 评估', 'evaluator n. 评估者'],
    wordForms: { noun: 'evaluation', pastTense: 'evaluated', pastParticiple: 'evaluated', presentParticiple: 'evaluating' },
    synonyms: ['assess', 'appraise', 'judge', 'rate'],
    antonyms: ['guess', 'speculate', 'ignore'],
    examPoints: ['evaluate = assess', 'make an evaluation']
  },
  evidence: {
    collocations: ['evidence for...的证据', 'in evidence 显而易见', 'provide evidence 提供证据'],
    derivatives: ['evident adj. 明显的', 'evidently adv. 显然地'],
    wordForms: { adjective: 'evident', adverb: 'evidently' },
    synonyms: ['proof', 'indication', 'sign', 'testimony'],
    antonyms: ['concealment', 'hiding'],
    examPoints: ['evidence 不可数名词', 'evident = obvious']
  },
  examine: {
    collocations: ['examine carefully 仔细检查', 'examine sb on 考查某人'],
    derivatives: ['examination n. 检查；考试', 'examiner n. 考官', 'examinee n. 考生'],
    wordForms: { noun: 'examination', pastTense: 'examined', pastParticiple: 'examined', presentParticiple: 'examining' },
    synonyms: ['inspect', 'investigate', 'analyze', 'test'],
    antonyms: ['ignore', 'overlook', 'neglect'],
    examPoints: ['examination = exam', 'medical examination 体检']
  },
  exist: {
    collocations: ['exist in 存在于', 'exist on 靠...生存', 'come into existence 产生'],
    derivatives: ['existence n. 存在', 'existent adj. 存在的', 'coexistence n. 共存'],
    wordForms: { noun: 'existence', adjective: 'existent' },
    synonyms: ['be', 'live', 'survive', 'occur'],
    antonyms: ['die', 'disappear', 'vanish', 'cease'],
    examPoints: ['come into existence = come into being', 'in existence 现存的']
  },
  expand: {
    collocations: ['expand into 扩展到', 'expand on 详述'],
    derivatives: ['expansion n. 扩张', 'expansive adj. 广阔的'],
    wordForms: { noun: 'expansion', adjective: 'expansive', pastTense: 'expanded', pastParticiple: 'expanded', presentParticiple: 'expanding' },
    synonyms: ['enlarge', 'extend', 'grow', 'broaden'],
    antonyms: ['shrink', 'contract', 'reduce', 'diminish'],
    examPoints: ['expand ≠ expend(花费)', 'expansion 不可数']
  },
  explain: {
    collocations: ['explain sth to sb 向某人解释', 'explain that 解释说', 'explain oneself 说明意图'],
    derivatives: ['explanation n. 解释', 'explanatory adj. 解释性的'],
    wordForms: { noun: 'explanation', adjective: 'explanatory', pastTense: 'explained', pastParticiple: 'explained', presentParticiple: 'explaining' },
    synonyms: ['clarify', 'elucidate', 'illustrate', 'demonstrate'],
    antonyms: ['confuse', 'obscure', 'muddle'],
    examPoints: ['explain sth to sb (不是 explain sb sth)', 'give an explanation']
  },
  explore: {
    collocations: ['explore the possibility 探索可能性', 'explore the world 探索世界'],
    derivatives: ['exploration n. 探索', 'explorer n. 探险家', 'exploratory adj. 探索性的'],
    wordForms: { noun: 'exploration', adjective: 'exploratory', pastTense: 'explored', pastParticiple: 'explored', presentParticiple: 'exploring' },
    synonyms: ['investigate', 'discover', 'examine', 'probe'],
    antonyms: ['ignore', 'neglect', 'overlook'],
    examPoints: ['exploration 不可数', 'space exploration 太空探索']
  },
  expose: {
    collocations: ['be exposed to 暴露于', 'expose sb to 使某人接触', 'expose oneself 暴露自己'],
    derivatives: ['exposure n. 暴露', 'exposed adj. 暴露的'],
    wordForms: { noun: 'exposure', adjective: 'exposed', pastTense: 'exposed', pastParticiple: 'exposed', presentParticiple: 'exposing' },
    synonyms: ['reveal', 'uncover', 'disclose', 'show'],
    antonyms: ['hide', 'conceal', 'cover', 'shield'],
    examPoints: ['be exposed to + 名词', 'exposure to sth']
  },
  express: {
    collocations: ['express oneself 表达自己', 'express concern 表达关切', 'express one\'s thanks 表达感谢'],
    derivatives: ['expression n. 表达', 'expressive adj. 富有表现力的', 'expressly adv. 明确地'],
    wordForms: { noun: 'expression', adjective: 'expressive', adverb: 'expressly', pastTense: 'expressed', pastParticiple: 'expressed', presentParticiple: 'expressing' },
    synonyms: ['convey', 'communicate', 'state', 'articulate'],
    antonyms: ['suppress', 'repress', 'conceal'],
    examPoints: ['expression 可数(表情)不可数(表达)', 'freedom of expression']
  },
  fail: {
    collocations: ['fail to do 未能做', 'fail in 在...失败', 'without fail 务必'],
    derivatives: ['failure n. 失败', 'failing n. 缺点'],
    wordForms: { noun: 'failure', pastTense: 'failed', pastParticiple: 'failed', presentParticiple: 'failing' },
    synonyms: ['not succeed', 'fall short', 'miss'],
    antonyms: ['succeed', 'achieve', 'accomplish'],
    examPoints: ['fail to do = fail in doing', 'failure is the mother of success']
  },
  familiar: {
    collocations: ['be familiar with 熟悉', 'be familiar to 为...所熟知'],
    derivatives: ['familiarity n. 熟悉', 'familiarize v. 使熟悉', 'unfamiliar adj. 不熟悉的'],
    wordForms: { noun: 'familiarity', verb: 'familiarize' },
    synonyms: ['acquainted', 'known', 'recognized', 'common'],
    antonyms: ['unfamiliar', 'unknown', 'strange'],
    examPoints: ['be familiar with (人熟悉物)', 'be familiar to (物为人熟知)']
  },
  finance: {
    collocations: ['finance a project 为项目提供资金', 'in finance 在金融领域'],
    derivatives: ['financial adj. 金融的', 'financially adv. 金融地', 'financier n. 金融家'],
    wordForms: { adjective: 'financial', adverb: 'financially' },
    synonyms: ['fund', 'back', 'sponsor', 'bankroll'],
    antonyms: ['bankrupt', 'default'],
    examPoints: ['financial crisis 金融危机', 'financially stable']
  },
  focus: {
    collocations: ['focus on 集中于', 'focus one\'s attention on 集中注意力于', 'bring into focus 使明确'],
    derivatives: [],
    wordForms: { pastTense: 'focused', pastParticiple: 'focused', presentParticiple: 'focusing' },
    synonyms: ['concentrate', 'center', 'fix', 'direct'],
    antonyms: ['distract', 'divert', 'scatter'],
    examPoints: ['focus on = concentrate on', 'focus 复数 focuses/foci']
  },
  function: {
    collocations: ['function as 起...作用', 'perform a function 发挥功能'],
    derivatives: ['functional adj. 功能的', 'functionally adv. 功能上地', 'malfunction n. 故障'],
    wordForms: { adjective: 'functional', adverb: 'functionally', pastTense: 'functioned', pastParticiple: 'functioned', presentParticiple: 'functioning' },
    synonyms: ['work', 'operate', 'serve', 'role'],
    antonyms: ['malfunction', 'fail', 'break down'],
    examPoints: ['function as = serve as', 'functional = working']
  },
  generate: {
    collocations: ['generate electricity 发电', 'generate income 创造收入', 'generate interest 引起兴趣'],
    derivatives: ['generation n. 一代', 'generator n. 发电机', 'generative adj. 产生的'],
    wordForms: { noun: 'generation', adjective: 'generative', pastTense: 'generated', pastParticiple: 'generated', presentParticiple: 'generating' },
    synonyms: ['produce', 'create', 'make', 'yield'],
    antonyms: ['destroy', 'eliminate', 'consume'],
    examPoints: ['generate heat/electricity/income', 'the younger generation']
  },
  handle: {
    collocations: ['handle a problem 处理问题', 'handle with care 小心轻放'],
    derivatives: [],
    wordForms: { pastTense: 'handled', pastParticiple: 'handled', presentParticiple: 'handling' },
    synonyms: ['deal with', 'manage', 'tackle', 'address'],
    antonyms: ['ignore', 'neglect', 'avoid'],
    examPoints: ['handle = deal with', 'handle with care']
  },
  identify: {
    collocations: ['identify A with B 把A等同于B', 'identify oneself 自我介绍', 'be identified as 被认定为'],
    derivatives: ['identification n. 识别', 'identical adj. 相同的', 'identity n. 身份'],
    wordForms: { noun: 'identification', adjective: 'identical', pastTense: 'identified', pastParticiple: 'identified', presentParticiple: 'identifying' },
    synonyms: ['recognize', 'distinguish', 'spot', 'detect'],
    antonyms: ['confuse', 'mistake', 'misidentify'],
    examPoints: ['identify with sb 认同某人', 'identity card 身份证']
  },
  imagine: {
    collocations: ['imagine doing 想象做', 'imagine that 想象', 'imagine sb doing 想象某人做'],
    derivatives: ['imagination n. 想象力', 'imaginative adj. 富有想象力的', 'imaginary adj. 虚构的', 'imaginable adj. 可想象的'],
    wordForms: { noun: 'imagination', adjective: 'imaginative', pastTense: 'imagined', pastParticiple: 'imagined', presentParticiple: 'imagining' },
    synonyms: ['visualize', 'picture', 'conceive', 'fantasize'],
    antonyms: ['realize', 'perceive', 'experience'],
    examPoints: ['后接 doing 不接 to do', 'imaginative ≠ imaginary(虚构的)']
  },
  improve: {
    collocations: ['improve on/upon 改进', 'improve one\'s English 提高英语', 'improve the situation 改善状况'],
    derivatives: ['improvement n. 改进'],
    wordForms: { noun: 'improvement', pastTense: 'improved', pastParticiple: 'improved', presentParticiple: 'improving' },
    synonyms: ['enhance', 'better', 'upgrade', 'refine'],
    antonyms: ['worsen', 'deteriorate', 'decline'],
    examPoints: ['improve on = do better than', 'room for improvement']
  },
  include: {
    collocations: ['include sth in 把...包括在', 'including... 包括...', 'included 包括在内的'],
    derivatives: ['inclusion n. 包含', 'inclusive adj. 包含的'],
    wordForms: { noun: 'inclusion', adjective: 'inclusive', pastTense: 'included', pastParticiple: 'included', presentParticiple: 'including' },
    synonyms: ['contain', 'comprise', 'involve', 'encompass'],
    antonyms: ['exclude', 'omit', 'leave out'],
    examPoints: ['including + 名词 (主动)', 'included 放名词后 (被动)']
  },
  influence: {
    collocations: ['have an influence on 对...有影响', 'under the influence of 在...影响下', 'influence sb to do 影响某人做'],
    derivatives: ['influential adj. 有影响力的'],
    wordForms: { adjective: 'influential', pastTense: 'influenced', pastParticiple: 'influenced', presentParticiple: 'influencing' },
    synonyms: ['affect', 'impact', 'shape', 'persuade'],
    antonyms: ['ignore', 'neglect', 'disregard'],
    examPoints: ['have an influence on = have an effect on', 'influential figure']
  },
  inform: {
    collocations: ['inform sb of sth 告知某人', 'inform sb that 通知某人', 'keep sb informed 让某人知情'],
    derivatives: ['information n. 信息', 'informative adj. 信息量大的', 'informed adj. 见多识广的'],
    wordForms: { noun: 'information', adjective: 'informative', pastTense: 'informed', pastParticiple: 'informed', presentParticiple: 'informing' },
    synonyms: ['notify', 'tell', 'advise', 'apprize'],
    antonyms: ['conceal', 'hide', 'withhold'],
    examPoints: ['inform sb of sth (不是 inform sb sth)', 'information 不可数']
  },
  insist: {
    collocations: ['insist on doing 坚持做', 'insist that 坚持说', 'insist on one\'s opinion 坚持己见'],
    derivatives: ['insistence n. 坚持', 'insistent adj. 坚持的'],
    wordForms: { noun: 'insistence', adjective: 'insistent', pastTense: 'insisted', pastParticiple: 'insisted', presentParticiple: 'insisting' },
    synonyms: ['persist', 'maintain', 'demand', 'urge'],
    antonyms: ['yield', 'give in', 'concede'],
    examPoints: ['insist on doing', 'insist that + 虚拟语气(should + do) 表示"坚持要求"']
  },
  intend: {
    collocations: ['intend to do 打算做', 'intend sb for 打算让某人做', 'be intended for 专为...设计'],
    derivatives: ['intention n. 意图', 'intentional adj. 故意的', 'intentionally adv. 故意地'],
    wordForms: { noun: 'intention', adjective: 'intentional', adverb: 'intentionally', pastTense: 'intended', pastParticiple: 'intended', presentParticiple: 'intending' },
    synonyms: ['plan', 'mean', 'aim', 'design'],
    antonyms: ['improvise', 'happen by chance'],
    examPoints: ['intend to do = mean to do', 'be intended for = be designed for']
  },
  involve: {
    collocations: ['involve sb in 让某人参与', 'be involved in 参与', 'involve doing 需要做'],
    derivatives: ['involvement n. 参与', 'involved adj. 复杂的；参与的'],
    wordForms: { noun: 'involvement', adjective: 'involved', pastTense: 'involved', pastParticiple: 'involved', presentParticiple: 'involving' },
    synonyms: ['include', 'entail', 'engage', 'implicate'],
    antonyms: ['exclude', 'eliminate', 'omit'],
    examPoints: ['involve doing (后接 doing)', 'be involved in = participate in']
  },
  justify: {
    collocations: ['justify doing 为...辩护', 'be justified in 有理由做'],
    derivatives: ['justification n. 正当理由', 'justified adj. 有正当理由的'],
    wordForms: { noun: 'justification', adjective: 'justified', pastTense: 'justified', pastParticiple: 'justified', presentParticiple: 'justifying' },
    synonyms: ['defend', 'vindicate', 'warrant', 'excuse'],
    antonyms: ['condemn', 'blame', 'criticize'],
    examPoints: ['justify + doing/名词', 'be justified in doing']
  },
  maintain: {
    collocations: ['maintain order 维持秩序', 'maintain contact 保持联系', 'maintain that 坚持'],
    derivatives: ['maintenance n. 维护', 'maintainable adj. 可维护的'],
    wordForms: { noun: 'maintenance', adjective: 'maintainable', pastTense: 'maintained', pastParticiple: 'maintained', presentParticiple: 'maintaining' },
    synonyms: ['keep', 'preserve', 'sustain', 'uphold'],
    antonyms: ['abandon', 'neglect', 'discontinue'],
    examPoints: ['maintain = keep up', 'maintenance 不可数']
  },
  observe: {
    collocations: ['observe sb do/doing 观察某人做', 'observe that 注意到', 'observe the rules 遵守规则'],
    derivatives: ['observation n. 观察', 'observer n. 观察者', 'observatory n. 天文台'],
    wordForms: { noun: 'observation', pastTense: 'observed', pastParticiple: 'observed', presentParticiple: 'observing' },
    synonyms: ['notice', 'watch', 'monitor', 'heed'],
    antonyms: ['ignore', 'overlook', 'disregard'],
    examPoints: ['observe sb do (全过程)', 'observe sb doing (进行中)']
  },
  obtain: {
    collocations: ['obtain sth from 从...获得', 'obtain a degree 获得学位'],
    derivatives: ['obtainable adj. 可获得的'],
    wordForms: { adjective: 'obtainable', pastTense: 'obtained', pastParticiple: 'obtained', presentParticiple: 'obtaining' },
    synonyms: ['get', 'acquire', 'gain', 'secure'],
    antonyms: ['lose', 'forfeit', 'give up'],
    examPoints: ['obtain = acquire', 'formal usage']
  },
  occur: {
    collocations: ['occur to sb 突然想到', 'it occurs to sb that 某人想到', 'occur unexpectedly 意外发生'],
    derivatives: ['occurrence n. 发生', 'occurrent adj. 正在发生的'],
    wordForms: { noun: 'occurrence', pastTense: 'occurred', pastParticiple: 'occurred', presentParticiple: 'occurring' },
    synonyms: ['happen', 'take place', 'arise', 'come about'],
    antonyms: ['cease', 'stop', 'fail to happen'],
    examPoints: ['双写 r: occurred/occurring', 'it occurs to sb that = sb suddenly realizes']
  },
  offer: {
    collocations: ['offer to do 主动提出做', 'offer sb sth 提供某人某物', 'make an offer 提议'],
    derivatives: ['offering n. 祭品；提供物'],
    wordForms: { noun: 'offer', pastTense: 'offered', pastParticiple: 'offered', presentParticiple: 'offering' },
    synonyms: ['provide', 'give', 'present', 'propose'],
    antonyms: ['refuse', 'reject', 'withdraw'],
    examPoints: ['offer sb sth = offer sth to sb', 'offer to do (主动提出)']
  },
  oppose: {
    collocations: ['oppose doing 反对做', 'be opposed to 反对', 'as opposed to 与...相对'],
    derivatives: ['opposition n. 反对', 'opposite adj. 对面的', 'opponent n. 对手'],
    wordForms: { noun: 'opposition', adjective: 'opposite', pastTense: 'opposed', pastParticiple: 'opposed', presentParticiple: 'opposing' },
    synonyms: ['resist', 'object to', 'fight', 'combat'],
    antonyms: ['support', 'favor', 'endorse', 'back'],
    examPoints: ['be opposed to + doing/名词', 'as opposed to = rather than']
  },
  organize: {
    collocations: ['organize an activity 组织活动', 'organize one\'s thoughts 整理思路'],
    derivatives: ['organization n. 组织', 'organizer n. 组织者', 'organized adj. 有组织的', 'organizational adj. 组织的'],
    wordForms: { noun: 'organization', adjective: 'organized', pastTense: 'organized', pastParticiple: 'organized', presentParticiple: 'organizing' },
    synonyms: ['arrange', 'coordinate', 'plan', 'structure'],
    antonyms: ['disorganize', 'disrupt', 'scatter'],
    examPoints: ['organize = arrange', 'disorganized 杂乱无章的']
  },
  perform: {
    collocations: ['perform an operation 做手术', 'perform a play 演出', 'perform well 表现好'],
    derivatives: ['performance n. 表演；表现', 'performer n. 表演者'],
    wordForms: { noun: 'performance', pastTense: 'performed', pastParticiple: 'performed', presentParticiple: 'performing' },
    synonyms: ['carry out', 'execute', 'do', 'act'],
    antonyms: ['fail', 'neglect', 'ignore'],
    examPoints: ['perform a task/duty', 'give a performance']
  },
  possess: {
    collocations: ['possess sth 拥有某物', 'be possessed of 具有'],
    derivatives: ['possession n. 拥有', 'possessive adj. 占有欲强的'],
    wordForms: { noun: 'possession', adjective: 'possessive', pastTense: 'possessed', pastParticiple: 'possessed', presentParticiple: 'possessing' },
    synonyms: ['own', 'have', 'hold', 'acquire'],
    antonyms: ['lose', 'forfeit', 'lack'],
    examPoints: ['in possession of (拥有)', 'in the possession of (被拥有)']
  },
  preserve: {
    collocations: ['preserve the environment 保护环境', 'preserve food 保存食物', 'preserve one\'s dignity 保持尊严'],
    derivatives: ['preservation n. 保存', 'preservative n. 防腐剂'],
    wordForms: { noun: 'preservation', pastTense: 'preserved', pastParticiple: 'preserved', presentParticiple: 'preserving' },
    synonyms: ['protect', 'conserve', 'maintain', 'safeguard'],
    antonyms: ['destroy', 'ruin', 'abandon', 'discard'],
    examPoints: ['preserve ≠ reserve(预留)', 'preservation 不可数']
  },
  prevent: {
    collocations: ['prevent sb from doing 阻止某人做', 'prevent disease 预防疾病'],
    derivatives: ['prevention n. 预防', 'preventive adj. 预防性的'],
    wordForms: { noun: 'prevention', adjective: 'preventive', pastTense: 'prevented', pastParticiple: 'prevented', presentParticiple: 'preventing' },
    synonyms: ['stop', 'hinder', 'obstruct', 'deter'],
    antonyms: ['allow', 'permit', 'enable', 'facilitate'],
    examPoints: ['prevent sb from doing = stop sb from doing', 'prevention is better than cure']
  },
  produce: {
    collocations: ['produce results 产生结果', 'produce evidence 提供证据'],
    derivatives: ['product n. 产品', 'production n. 生产', 'productive adj. 多产的', 'productivity n. 生产力', 'producer n. 生产者'],
    wordForms: { noun: 'product', adjective: 'productive', pastTense: 'produced', pastParticiple: 'produced', presentParticiple: 'producing' },
    synonyms: ['make', 'create', 'generate', 'yield', 'manufacture'],
    antonyms: ['consume', 'destroy', 'waste'],
    examPoints: ['product(产品) ≠ produce(n.农产品 /v.生产)', 'productive = fruitful']
  },
  promote: {
    collocations: ['promote development 促进发展', 'be promoted to 被提升为', 'promote a product 推销产品'],
    derivatives: ['promotion n. 促进；晋升', 'promotional adj. 促销的'],
    wordForms: { noun: 'promotion', adjective: 'promotional', pastTense: 'promoted', pastParticiple: 'promoted', presentParticiple: 'promoting' },
    synonyms: ['advance', 'boost', 'further', 'elevate'],
    antonyms: ['demote', 'hinder', 'impede', 'discourage'],
    examPoints: ['promote sb to + 职位', 'get a promotion']
  },
  propose: {
    collocations: ['propose to do 提议做', 'propose doing 建议做', 'propose that 提议', 'propose to sb 向某人求婚'],
    derivatives: ['proposal n. 提议', 'proposition n. 命题'],
    wordForms: { noun: 'proposal', pastTense: 'proposed', pastParticiple: 'proposed', presentParticiple: 'proposing' },
    synonyms: ['suggest', 'recommend', 'put forward', 'offer'],
    antonyms: ['withdraw', 'retract', 'oppose'],
    examPoints: ['propose + that + 虚拟语气(should + do)', 'make a proposal']
  },
  prove: {
    collocations: ['prove that 证明', 'prove sb wrong 证明某人错了', 'prove to be 结果是'],
    derivatives: ['proof n. 证据', 'proven adj. 被证实的'],
    wordForms: { noun: 'proof', adjective: 'proven', pastTense: 'proved', pastParticiple: 'proved/proven', presentParticiple: 'proving' },
    synonyms: ['demonstrate', 'confirm', 'verify', 'establish'],
    antonyms: ['disprove', 'refute', 'contradict'],
    examPoints: ['prove to be = turn out to be', 'proof = evidence']
  },
  provide: {
    collocations: ['provide sb with sth 提供某人某物', 'provide sth for sb 为某人提供', 'provide that 规定'],
    derivatives: ['provider n. 提供者', 'provision n. 供应；条款'],
    wordForms: { noun: 'provision', pastTense: 'provided', pastParticiple: 'provided', presentParticiple: 'providing' },
    synonyms: ['supply', 'furnish', 'give', 'equip'],
    antonyms: ['deprive', 'withhold', 'deny'],
    examPoints: ['provide sb with sth = provide sth for sb', 'provided that = if']
  },
  realize: {
    collocations: ['realize one\'s dream 实现梦想', 'realize that 意识到', 'come to realize 逐渐意识到'],
    derivatives: ['realization n. 实现', 'realistic adj. 现实的', 'reality n. 现实', 'really adv. 真正地'],
    wordForms: { noun: 'realization', adjective: 'realistic', pastTense: 'realized', pastParticiple: 'realized', presentParticiple: 'realizing' },
    synonyms: ['achieve', 'fulfill', 'accomplish', 'recognize'],
    antonyms: ['fail', 'miss', 'ignore'],
    examPoints: ['realize(实现) ≠ realize(意识到) 两个意思', 'reality ≠ realty(不动产)']
  },
  recognize: {
    collocations: ['recognize sb as 承认某人为', 'recognize that 认识到'],
    derivatives: ['recognition n. 认出', 'recognizable adj. 可辨认的'],
    wordForms: { noun: 'recognition', adjective: 'recognizable', pastTense: 'recognized', pastParticiple: 'recognized', presentParticiple: 'recognizing' },
    synonyms: ['identify', 'acknowledge', 'admit', 'realize'],
    antonyms: ['ignore', 'overlook', 'deny'],
    examPoints: ['recognize = identify', 'beyond recognition 认不出来']
  },
  reduce: {
    collocations: ['reduce by 减少了', 'reduce to 减少到', 'reduce costs 降低成本'],
    derivatives: ['reduction n. 减少'],
    wordForms: { noun: 'reduction', pastTense: 'reduced', pastParticiple: 'reduced', presentParticiple: 'reducing' },
    synonyms: ['decrease', 'cut', 'lower', 'diminish'],
    antonyms: ['increase', 'raise', 'elevate', 'expand'],
    examPoints: ['reduce by (减少了多少)', 'reduce to (减少到多少)']
  },
  reflect: {
    collocations: ['reflect on 反思', 'reflect that 反映'],
    derivatives: ['reflection n. 反射；反思', 'reflective adj. 反思的'],
    wordForms: { noun: 'reflection', adjective: 'reflective', pastTense: 'reflected', pastParticiple: 'reflected', presentParticiple: 'reflecting' },
    synonyms: ['mirror', 'show', 'demonstrate', 'consider'],
    antonyms: ['absorb', 'ignore', 'overlook'],
    examPoints: ['reflect on = think carefully about', 'reflection in the mirror']
  },
  regulate: {
    collocations: ['regulate the market 规范市场', 'regulate temperature 调节温度'],
    derivatives: ['regulation n. 规定', 'regulator n. 监管机构', 'regulatory adj. 监管的'],
    wordForms: { noun: 'regulation', adjective: 'regulatory', pastTense: 'regulated', pastParticiple: 'regulated', presentParticiple: 'regulating' },
    synonyms: ['control', 'manage', 'govern', 'adjust'],
    antonyms: ['deregulate', 'free', 'release'],
    examPoints: ['regulations = rules', 'regulatory body 监管机构']
  },
  relate: {
    collocations: ['relate to 与...有关', 'be related to 与...相关', 'relate A to B 把A与B联系起来'],
    derivatives: ['relation n. 关系', 'relationship n. 关系', 'relative n. 亲属 adj. 相对的', 'relatively adv. 相对地'],
    wordForms: { noun: 'relation', adjective: 'relative', adverb: 'relatively', pastTense: 'related', pastParticiple: 'related', presentParticiple: 'relating' },
    synonyms: ['connect', 'link', 'associate', 'correlate'],
    antonyms: ['disconnect', 'separate', 'dissociate'],
    examPoints: ['relate to = be connected with', 'in relation to = regarding']
  },
  rely: {
    collocations: ['rely on 依赖', 'rely on sb to do 指望某人做', 'rely on doing 依靠做'],
    derivatives: ['reliance n. 依赖', 'reliable adj. 可靠的', 'reliability n. 可靠性'],
    wordForms: { noun: 'reliance', adjective: 'reliable', pastTense: 'relied', pastParticiple: 'relied', presentParticiple: 'relying' },
    synonyms: ['depend', 'count on', 'trust', 'lean on'],
    antonyms: ['distrust', 'doubt', 'suspect'],
    examPoints: ['rely on = depend on', 'reliable = dependable']
  },
  remain: {
    collocations: ['remain silent 保持沉默', 'remain to be done 尚待完成', 'remain in power 继续执政'],
    derivatives: ['remains n. 遗迹', 'remainder n. 剩余物'],
    wordForms: { noun: 'remainder', pastTense: 'remained', pastParticiple: 'remained', presentParticiple: 'remaining' },
    synonyms: ['stay', 'continue', 'persist', 'endure'],
    antonyms: ['leave', 'depart', 'change', 'disappear'],
    examPoints: ['remain + adj./n. (系动词)', 'remain to be done (被动)']
  },
  remember: {
    collocations: ['remember to do 记得要做', 'remember doing 记得做过', 'remember sb to sb 代某人问候'],
    derivatives: ['remembrance n. 纪念', 'memorable adj. 值得纪念的'],
    wordForms: { noun: 'remembrance', adjective: 'memorable', pastTense: 'remembered', pastParticiple: 'remembered', presentParticiple: 'remembering' },
    synonyms: ['recall', 'recollect', 'reminisce', 'commemorate'],
    antonyms: ['forget', 'overlook', 'neglect'],
    examPoints: ['remember to do (未做)', 'remember doing (已做)']
  },
  represent: {
    collocations: ['represent...as 把...描绘为', 'represent sb 代表某人', 'represent itself as 自称'],
    derivatives: ['representation n. 代表', 'representative n. 代表 adj. 典型的'],
    wordForms: { noun: 'representation', adjective: 'representative', pastTense: 'represented', pastParticiple: 'represented', presentParticiple: 'representing' },
    synonyms: ['stand for', 'symbolize', 'act for', 'depict'],
    antonyms: ['misrepresent', 'distort'],
    examPoints: ['represent = stand for', 'representative of 典型的']
  },
  require: {
    collocations: ['require sb to do 要求某人做', 'require doing 需要被做', 'require that 要求'],
    derivatives: ['requirement n. 要求', 'required adj. 必修的'],
    wordForms: { noun: 'requirement', adjective: 'required', pastTense: 'required', pastParticiple: 'required', presentParticiple: 'requiring' },
    synonyms: ['need', 'demand', 'ask', 'necessitate'],
    antonyms: ['excuse', 'exempt', 'waive'],
    examPoints: ['require doing = require to be done (被动含义)', 'meet the requirements']
  },
  resolve: {
    collocations: ['resolve to do 决心做', 'resolve a problem 解决问题', 'resolve that 决定'],
    derivatives: ['resolution n. 决心；解决', 'resolute adj. 坚决的'],
    wordForms: { noun: 'resolution', adjective: 'resolute', pastTense: 'resolved', pastParticiple: 'resolved', presentParticiple: 'resolving' },
    synonyms: ['decide', 'determine', 'settle', 'solve'],
    antonyms: ['waver', 'hesitate', 'delay'],
    examPoints: ['resolve a problem = solve a problem', 'make a resolution']
  },
  respond: {
    collocations: ['respond to 回应', 'respond by doing 以...回应'],
    derivatives: ['response n. 回应', 'responsible adj. 负责的', 'responsibility n. 责任'],
    wordForms: { noun: 'response', adjective: 'responsible', pastTense: 'responded', pastParticiple: 'responded', presentParticiple: 'responding' },
    synonyms: ['reply', 'answer', 'react', 'acknowledge'],
    antonyms: ['ignore', 'disregard', 'neglect'],
    examPoints: ['respond to = reply to', 'in response to 作为对...的回应']
  },
  result: {
    collocations: ['result in 导致', 'result from 由...引起', 'as a result 因此', 'as a result of 由于'],
    derivatives: [],
    wordForms: { pastTense: 'resulted', pastParticiple: 'resulted', presentParticiple: 'resulting' },
    synonyms: ['outcome', 'consequence', 'effect', 'conclusion'],
    antonyms: ['cause', 'origin', 'source'],
    examPoints: ['result in (主动导致)', 'result from (被动源于)']
  },
  reveal: {
    collocations: ['reveal that 透露', 'reveal sth to sb 向某人透露', 'reveal oneself 显露'],
    derivatives: ['revelation n. 揭露', 'revealing adj. 揭露性的'],
    wordForms: { noun: 'revelation', adjective: 'revealing', pastTense: 'revealed', pastParticiple: 'revealed', presentParticiple: 'revealing' },
    synonyms: ['disclose', 'uncover', 'expose', 'unveil'],
    antonyms: ['hide', 'conceal', 'cover', 'mask'],
    examPoints: ['reveal = disclose', 'revelation 不可数']
  },
  satisfy: {
    collocations: ['satisfy one\'s needs 满足需求', 'be satisfied with 对...满意', 'satisfy the conditions 满足条件'],
    derivatives: ['satisfaction n. 满意', 'satisfactory adj. 令人满意的', 'satisfied adj. 满意的', 'unsatisfied adj. 不满意的', 'dissatisfy v. 使不满'],
    wordForms: { noun: 'satisfaction', adjective: 'satisfactory', pastTense: 'satisfied', pastParticiple: 'satisfied', presentParticiple: 'satisfying' },
    synonyms: ['fulfill', 'meet', 'please', 'content'],
    antonyms: ['disappoint', 'dissatisfy', 'frustrate'],
    examPoints: ['be satisfied with (人满意)', 'satisfactory (事物令人满意)']
  },
  secure: {
    collocations: ['secure a position 获得职位', 'be secure from 免于', 'secure sth against 保护...免受'],
    derivatives: ['security n. 安全', 'securely adv. 安全地'],
    wordForms: { noun: 'security', adverb: 'securely', pastTense: 'secured', pastParticiple: 'secured', presentParticiple: 'securing' },
    synonyms: ['safe', 'protected', 'obtain', 'guarantee'],
    antonyms: ['insecure', 'vulnerable', 'exposed'],
    examPoints: ['secure(安全的) → security(名词)', 'feel secure 感到安全']
  },
  seek: {
    collocations: ['seek to do 试图做', 'seek for 寻找', 'seek advice 征求建议', 'seek out 找出'],
    derivatives: ['seeker n. 寻找者'],
    wordForms: { noun: 'seeker', pastTense: 'sought', pastParticiple: 'sought', presentParticiple: 'seeking' },
    synonyms: ['look for', 'search', 'pursue', 'try'],
    antonyms: ['find', 'discover', 'ignore'],
    examPoints: ['不规则变形: seek-sought-sought', 'seek to do = try to do']
  },
  solve: {
    collocations: ['solve a problem 解决问题', 'solve a puzzle 解谜'],
    derivatives: ['solution n. 解决方案', 'solvable adj. 可解决的'],
    wordForms: { noun: 'solution', adjective: 'solvable', pastTense: 'solved', pastParticiple: 'solved', presentParticiple: 'solving' },
    synonyms: ['resolve', 'settle', 'work out', 'figure out'],
    antonyms: ['create', 'cause', 'complicate'],
    examPoints: ['a solution to a problem', 'solve ≠ settle(安顿)']
  },
  succeed: {
    collocations: ['succeed in doing 成功做', 'succeed sb as 接替某人', 'succeed to the throne 继承王位'],
    derivatives: ['success n. 成功', 'successful adj. 成功的', 'successfully adv. 成功地', 'successor n. 继承人'],
    wordForms: { noun: 'success', adjective: 'successful', adverb: 'successfully', pastTense: 'succeeded', pastParticiple: 'succeeded', presentParticiple: 'succeeding' },
    synonyms: ['achieve', 'accomplish', 'triumph', 'follow'],
    antonyms: ['fail', 'lose', 'precede'],
    examPoints: ['succeed in doing (不是 to do)', 'succeed sb = take over from sb']
  },
  suffer: {
    collocations: ['suffer from 患...病；遭受', 'suffer loss 遭受损失', 'suffer pain 忍受痛苦'],
    derivatives: ['suffering n. 痛苦', 'sufferer n. 患病者'],
    wordForms: { noun: 'suffering', pastTense: 'suffered', pastParticiple: 'suffered', presentParticiple: 'suffering' },
    synonyms: ['endure', 'bear', 'experience', 'undergo'],
    antonyms: ['enjoy', 'benefit', 'thrive'],
    examPoints: ['suffer from + 疾病/痛苦', 'suffer = tolerate(忍受)']
  },
  suggest: {
    collocations: ['suggest doing 建议做', 'suggest that 建议', 'suggest sth to sb 向某人建议'],
    derivatives: ['suggestion n. 建议', 'suggestive adj. 暗示的'],
    wordForms: { noun: 'suggestion', adjective: 'suggestive', pastTense: 'suggested', pastParticiple: 'suggested', presentParticiple: 'suggesting' },
    synonyms: ['propose', 'recommend', 'advise', 'imply'],
    antonyms: ['demand', 'insist', 'reject'],
    examPoints: ['后接 doing 不接 to do', 'suggest that + 虚拟语气(should + do) 表示"建议"']
  },
  survive: {
    collocations: ['survive sth 幸免于', 'survive on 靠...存活', 'survive sb 比某人活得长'],
    derivatives: ['survival n. 生存', 'survivor n. 幸存者'],
    wordForms: { noun: 'survival', pastTense: 'survived', pastParticiple: 'survived', presentParticiple: 'surviving' },
    synonyms: ['live through', 'endure', 'outlast', 'withstand'],
    antonyms: ['die', 'perish', 'succumb'],
    examPoints: ['survive 是及物动词不加 from', 'survive the earthquake']
  },
  tend: {
    collocations: ['tend to do 倾向于做', 'tend towards 倾向于', 'tend sb 照料某人'],
    derivatives: ['tendency n. 倾向', 'tender adj. 温柔的'],
    wordForms: { noun: 'tendency', adjective: 'tender', pastTense: 'tended', pastParticiple: 'tended', presentParticiple: 'tending' },
    synonyms: ['be inclined to', 'lean towards', 'be likely to', 'care for'],
    antonyms: ['avoid', 'shun', 'neglect'],
    examPoints: ['tend to do = be likely to do', 'have a tendency to do']
  },
  transform: {
    collocations: ['transform A into B 把A变成B', 'transform one\'s life 改变生活'],
    derivatives: ['transformation n. 变形', 'transformer n. 变压器'],
    wordForms: { noun: 'transformation', pastTense: 'transformed', pastParticiple: 'transformed', presentParticiple: 'transforming' },
    synonyms: ['change', 'convert', 'alter', 'turn'],
    antonyms: ['preserve', 'maintain', 'keep'],
    examPoints: ['transform A into B', 'transformation 不可数']
  },
  value: {
    collocations: ['value sth at 估价', 'place a high value on 高度重视', 'of great value 很有价值'],
    derivatives: ['valuable adj. 有价值的', 'valueless adj. 无价值的', 'valuation n. 估价', 'invaluable adj. 无价的'],
    wordForms: { adjective: 'valuable', noun: 'valuation', pastTense: 'valued', pastParticiple: 'valued', presentParticiple: 'valuing' },
    synonyms: ['worth', 'prize', 'treasure', 'appreciate'],
    antonyms: ['disregard', 'devalue', 'ignore'],
    examPoints: ['valuable(有价值的) ≠ valued(被重视的)', 'invaluable = priceless']
  },
  vary: {
    collocations: ['vary from 不同于', 'vary with 随...变化', 'vary in 在...方面不同'],
    derivatives: ['variety n. 多样性', 'various adj. 不同的', 'variation n. 变化', 'variable adj. 可变的 n. 变量'],
    wordForms: { noun: 'variety', adjective: 'various', pastTense: 'varied', pastParticiple: 'varied', presentParticiple: 'varying' },
    synonyms: ['differ', 'change', 'fluctuate', 'diversify'],
    antonyms: ['remain', 'stay', 'be constant'],
    examPoints: ['a variety of = various', 'vary from...to...']
  },
  volunteer: {
    collocations: ['volunteer to do 自愿做', 'volunteer for 自愿参加'],
    derivatives: ['voluntary adj. 自愿的', 'voluntarily adv. 自愿地', 'voluntarism n. 志愿主义'],
    wordForms: { adjective: 'voluntary', adverb: 'voluntarily', pastTense: 'volunteered', pastParticiple: 'volunteered', presentParticiple: 'volunteering' },
    synonyms: ['offer', 'step forward', 'enlist'],
    antonyms: ['be forced', 'be drafted'],
    examPoints: ['volunteer to do', 'voluntary work']
  },
  warn: {
    collocations: ['warn sb of sth 警告某人', 'warn sb against doing 警告某人不要', 'warn sb not to do 警告某人不要做'],
    derivatives: ['warning n. 警告'],
    wordForms: { noun: 'warning', pastTense: 'warned', pastParticiple: 'warned', presentParticiple: 'warning' },
    synonyms: ['caution', 'alert', 'advise', 'notify'],
    antonyms: ['reassure', 'encourage', 'urge'],
    examPoints: ['warn sb against doing = warn sb not to do', 'give a warning']
  },
};

// 算法生成派生词（作为手动数据的补充）
function generateDerivatives(word) {
  if (!word || word.length < 3) return [];
  const w = word.toLowerCase();
  const results = [];
  const suffixRules = [
    { suffix: 'tion', add: ['tion', 'sion'], type: 'n.' },
    { suffix: 'sion', add: ['sion'], type: 'n.' },
    { suffix: 'ment', add: ['ment'], type: 'n.' },
    { suffix: 'ness', add: ['ness'], type: 'n.' },
    { suffix: 'ity', add: ['ity'], type: 'n.' },
    { suffix: 'able', add: ['able', 'ible'], type: 'adj.' },
    { suffix: 'ful', add: ['ful'], type: 'adj.' },
    { suffix: 'less', add: ['less'], type: 'adj.' },
    { suffix: 'ous', add: ['ous'], type: 'adj.' },
    { suffix: 'ive', add: ['ive'], type: 'adj.' },
    { suffix: 'al', add: ['al'], type: 'adj.' },
    { suffix: 'ly', add: ['ly'], type: 'adv.' },
    { suffix: 'er', add: ['er', 'or'], type: 'n.' },
    { suffix: 'ist', add: ['ist'], type: 'n.' },
  ];
  // 检查是否已有后缀，若有则生成去掉后缀的形式
  for (const rule of suffixRules) {
    if (w.endsWith(rule.suffix)) {
      const base = w.slice(0, -rule.suffix.length);
      if (base.length >= 2) {
        results.push(`${base} (${rule.type} 去后缀)`);
      }
    }
  }
  // 生成常见派生
  const commonSuffixes = [
    { suffix: 'tion', label: 'n.' },
    { suffix: 'ment', label: 'n.' },
    { suffix: 'ness', label: 'n.' },
    { suffix: 'ful', label: 'adj.' },
    { suffix: 'less', label: 'adj.' },
    { suffix: 'ly', label: 'adv.' },
    { suffix: 'er', label: 'n.' },
    { suffix: 'able', label: 'adj.' },
    { suffix: 'ive', label: 'adj.' },
    { suffix: 'al', label: 'adj.' },
  ];
  for (const cs of commonSuffixes) {
    const derived = w + cs.suffix;
    if (derived !== w && !results.some(r => r.startsWith(derived))) {
      results.push(`${derived} (${cs.label})`);
    }
  }
  return results.slice(0, 6);
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
  // 算法回退：生成基本派生词
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
