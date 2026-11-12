# 背群英 · 维护交接说明（给下一次接手的人或 AI）

本文件是这个仓库的**唯一操作手册**。任何一次改动都按这里的顺序执行，不要凭记忆推断。
仓库：`xdbzys/gaokao-vocab`，分支 `master`。

---

## 1. 这个项目由哪几块组成

| 组成 | 源码位置 | 构建产物 | 发布位置 |
|---|---|---|---|
| 安卓安装包（APK） | `src/main.jsx` + `src/*.java` + `android/` | `app-release.apk` | GitHub Release / jsDelivr / Gitee / 官网下载按钮 |
| 经典网页版 | 与 APK 同一份 `src/main.jsx` | `dist/index.html`（多文件，v2.79 起） | `https://xdbzys.github.io/gaokao-vocab/`（Pages 根路径） |
| App 同款网页版 | 同一份产物，运行期按路径识别 | `dist/app/`（多文件） | `https://xdbzys.github.io/gaokao-vocab/app/` |
| 旧单文件网页版 | 同上 | `dist/legacy/index.html` | `https://xdbzys.github.io/gaokao-vocab/legacy/`（老 WebView 兜底，别删） |
| App 云端热更包 | 同上 | `dist/web/index.html`（单文件） | gitee / jsDelivr 的 `web/index.html` |
| 官网 | `gaokao-vocab-site/gaokao-vocab-site.html` | `dist/site/index.html` | `https://xdbzys.github.io/gaokao-vocab/site/` |
| 旧站（仅跳转） | 仓库 `xdbzys/gaokao-vocab-website` | 无 | 自动跳转到上面的新官网 |
| 中文高清语音包 | 仓库根 `zhvoice.zip`（6337 条 .ogg） | 运行时下载解压到 `filesDir/zhvoice` | jsDelivr 多节点 |

**三者共用同一份前端代码**：不要为网页版另建一份 `main.jsx`，否则版本会分叉。

### 两套产物形态（v2.79.0 起，别搞混）

| | 形态 | 由谁构建 | 用途 |
|---|---|---|---|
| 单文件 | 一个 HTML 全内联，ES5 | `npm run build`（vite + Babel） | App 本地 assets、云端热更 `web/index.html`、`/legacy/` |
| 多文件 | `index.html` + `assets/main.<hash>.js` + `assets/chunk-*.js` | `node scripts/build-web.cjs`（esbuild，ESM） | 网页版 `/` 与 `/app/` |

**为什么要两套**：单文件版本 3.4MB / gzip 1MB，github.io 上弱网首屏 40s，
用户反馈「网页版打不开」。多文件版首屏只 216KB gzip，词库按需下载。
单文件不能取消——App 热更与老 WebView 都依赖它。

两套网页版的差别**只有能力开关**，没有第二套界面：

```js
// src/main.jsx 顶部
const isNativeApp = !!window.NativeFS ...      // 真机 App
const isFullWeb   = _isFullWebPath(location.pathname)  // /app/ 子路径 → 新网页版
const isFullApp   = isNativeApp || isFullWeb   // 功能完整版（App / 新网页版）
```

- 界面元素想「App 有、新网页版也有」→ 用 `isFullApp`
- 想「只有装 APK 才有」（安装包更新、系统通知设置、音量键翻页）→ 用 `isNativeApp`
- 想「只有经典网页版才显示」→ 用 `!isFullApp`

---

## 2.0 如果这版动了释义

```bash
node src/scripts/build-core-meanings.js   # 重新生成 coreMeanings.js（人工表在脚本顶部 MANUAL）
```
生成脚本会读 `src/data/curated/*.json`，不联网。**改完必须提交 `coreMeanings.js`**，
否则 CI 构建用的是旧表。

---

## 2. 每次发版必须做的四件事（顺序不能乱）

1. **改版本号**：`src/main.jsx` 里的 `APP_VERSION`（如 `2.76.0`）。
   `APP_VERSION_CODE` 不用手动改，CI 会用 `max(清单码+1, run_number)` 覆盖。
2. **写更新说明**：`app-update.json` 与 `version.json` 的 `changelog`，格式固定：

   ```
   【v2.76.0】一句话主题
   新增 具体做了什么（面向用户，不写实现细节）
   优化 具体改进了什么
   ```

   - 标签只用 `新增 / 优化`，**不要写「修复」**（本项目的约定：修复类不进用户可见说明）
   - 一行一条，`标签` 与正文之间一个空格
   - 同一条内容会被 App 更新弹窗、两套网页版、官网更新日志同时使用，一次写好三处生效
3. **官网更新日志不用手改**：CI 的 `scripts/sync-site-changelog.js` 会把上面这段
   自动注入官网 `#changelog` 顶部（同版本已存在则原地替换）。
4. **推送并等 CI 全绿**：`git push origin master` 后看 Actions，构建末尾会断言
   「APK 里的 versionName/versionCode 与清单一致」，不一致直接红，不要发。

---

## 3. CI 里三个产物怎么生成（不要删改顺序）

`.github/workflows/build.yml` 关键步骤顺序：

```
npm run build                     → dist/index.html（单文件，全内联，ES5）
gzip -9 dist/index.html           → index.html.gz（云端热更用）
cp -r dist android/app/src/main/assets/public   ← 注意：这一步之后才生成网页版副本
node scripts/sync-site-changelog.js             ← 官网更新日志注入
cp -r gaokao-vocab-site/. dist/site/            ← 官网
./gradlew assembleRelease                       ← 打 APK
aapt2 断言包名/版本号
写入 apkSize / apkSha256 → version.json / app-update.json
node scripts/build-web.cjs                      ← 多文件网页版（v2.79 新增）
cp dist/index.html dist/legacy/index.html       ← 旧单文件留档
cp dist-web/index.html dist/index.html          ← 根路径换多文件
cp -r dist-web/assets/. dist/assets/
cp -r dist-web/assets/. dist/app/assets/ + cp dist-web/index.html dist/app/index.html
cp dist/legacy/index.html dist/web/index.html   ← 热更包保持单文件
```

**为什么 `dist/app` 必须在「拷贝到 assets」之后**：否则同一份 2MB HTML 会再被打进 APK，
包体翻倍，还会拖慢 Gitee 镜像推送。

**为什么多文件步骤里不能 `cp -r dist-web/. dist/`**：`dist-web/` 里有构建期的
`app-update.json`（不含 APK 摘要），整体拷贝会覆盖上一步刚写入 `apkSha256` 的清单，
App 更新链路会直接断。只搬 `index.html` 与 `assets/`，CI 里有断言兜底。

---

## 4. 本地改完怎么验证（不含真机时的最低要求）

```bash
# 1) 打包（必须过；CI 第一步就是它）
npm install && npm run build        # 产出 dist/index.html 单文件，语法错会直接报

# 2) 已有兼容性检查（仓库自带，改完前端务必各跑一次）
node verify_es5.cjs                 # 产物必须是 ES5，否则老 WebView 白屏
node verify_chromium37.cjs          # Chromium 37 兜底语法检查

# 3) 网页版多文件产物（v2.79 起；改了 main.jsx / 词库数据都要跑）
node scripts/build-web.cjs          # 产出 dist-web/，脚本内建「首屏 gzip ≤250KB」红线
                                    # 超预算会 WARN 并列出超出的分片，需要继续拆分
```

改动涉及释义清洗 / 朗读文本 / 面板 / 返回键时，除上面两条，还要自查这 5 类断言
（历史上都是用临时 jsdom + esbuild 脚本跑的，**脚本未入库**，需要时按下面的点重写）：

| 断言 | 期望 |
|---|---|
| `cleanMeaning()` 全库扫描 | 6502 条里 0 条残留 `a. / adj. / n.`，0 条孤立 `a` |
| `_zhAlbumText()` 与语音包命名一致率 | ≥99.8%（低于此值会让部分词回退机械音） |
| `_isFullWebPath()` | `/xxx/app/`、`/xxx/app/index.html` 为真；`/`、`/apple/` 为假 |
| `window.__appBack()` | 主页返回空串；我的页 / 面板 / 弹窗返回 `handled` |
| 听读面板 | 同时只存在 1 个 `.listenSettings`，切换时旧的必须消失 |
| 中文音频源顺序 | 在线时首源必须是云端；本地包只能排最后（断网时才可以排第一） |
| 下拉交互 | 点遮罩、点选项都必须关闭菜单，且菜单只能存在 1 个 |
| 释义分段 | 含「；」的释义要渲染成多个 `.mnItem`，分号保留、间距 ≥8px |
| 核心释义 | 全库 12867 条都非空、≤18 字、不含英文单词；同一词跨词库必须一致 |
| 选项去重 | 任一题四选项两两 `meaningsTooClose()` 为假（困难模式重点抽查） |
| 释义脏数据 | 全库 0 条含 `DOS命令 / 计算机辅助 / BASIC语言 / 的过去分词` |

**必须自己看截图**再交付：面板是否重叠、按钮是否被挤出屏幕、深色文字是否压在图上看不清。
没有截图证据就当没做完（Chromium 390×844，模拟安卓手机屏宽）。

---

## 5. 几个容易踩的坑（都是真实踩过的）

| 现象 | 真正原因 | 正确做法 |
|---|---|---|
| 按返回键直接退出应用 | SPA 没有浏览器历史，`webView.canGoBack()` 恒为 `false` | 返回键先调 `window.__appBack()`，页面回 `handled` 才拦截 |
| 提示框标题出现「网址为 file:// 的网页显示」 | 用了 `alert()`，WebView 会套原生标题 | 一律用 `appTip(文本, 标题)`，渲染成应用内卡片 |
| 释义里出现无意义的 `a.` | `stripPosPrefix` 的词性白名单漏了 `a.`，`_meaningForSpeech` 只剥段首 | 统一用 `POS_TAG_RE`（全量、边界锚定），入库时 `cleanMeaning()` 洗一次 |
| 中文语音变回机械音 | 语音包文件名是释义文本的哈希，改了朗读文本就对不上 | 改动 `_zhAlbumText` 前先跑「语音包命名一致率」断言（≥99.8%） |
| 官网内容停留在旧版本 | 软件内链接与部分用户收藏都指向旧站 `gaokao-vocab-website`（停在 v2.37.0） | 软件内入口已改指新站；旧站只放跳转页，不要再往里写内容 |
| 官网版本号一直「加载中」 | 先请求 `raw.githubusercontent.com`，国内会挂起不报错 | 同源 `../app-update.json` 优先 + 4 秒超时再降级 jsDelivr |
| 下拉选择点空白关不掉 | 下拉包在 `<label>` 里，点遮罩后 label 会把这次点击转发给内部按钮，等于又 toggle 一次 | 遮罩与选项的 onClick 都要 `preventDefault()` 掐断转发 |
| 中文明显不如英文好听 | 旧链路把 16kbps 的离线包排第一（音量压缩、频带窄），云端 64kbps 配音永远用不上 | 云端优先、离线包只做断网兜底；语速 spd 用 `rate*5`（1.0x=常速） |
| 软件占用越用越大 | 听读每个词留 en/zh 两个缓存文件，整库播完 150MB+，且从不清理 | 缓存目录设 40MB 上限，按最后访问时间淘汰，见 `trimAlbumCacheIfNeeded()` |
| 面板叠在一起、退不出去 | 4 个独立布尔量各自展开 | 只保留一个 `listenPanel` 单值状态 + 面板顶部常驻「完成」 |
| 网页版一直白屏、像打不开 | 单文件 3.37MB（gzip 1MB），github.io 握手就要 4s，弱网首屏 40s | 网页版走多文件 + 词库分片（首屏 216KB gzip），单文件只留给 App/老内核 |
| CI 报 `require is not defined` | 仓库 `package.json` 是 `"type": "module"`，`.js` 一律按 ESM 解析 | 构建脚本用 `.cjs` 后缀（`build-web.cjs` / `build-single-html.cjs`），别用 `.js` |
| 单文件版里词库加载不出来 | 担心动态 `import()` 会去找 `chunk-*.js` | 不会：esbuild `iife` 与 vite `singlefile` 都会把 `import()` 内联成 `Promise.resolve`，无需外部 chunk |
| App 更新清单丢了 APK 摘要 | 多文件步骤 `cp -r dist-web/. dist/` 覆盖了 `Finalize manifests` 刚写的 `app-update.json` | 只拷 `index.html` 与 `assets/`，CI 有 `apkSha256` 断言兜底 |
| 分片下载失败后一直「请稍等」 | UI 只判断 `items.length === 0`，没读错误态 | `bookDataLoad` 三态（ready/loading/error）+ 重试按钮；重试要带 `?r=N` 绕开 module map 缓存 |
| 老用户的掌握记录被清空 | 词库异步化后，启动时 `cleanDeletedBookRefs()` 在数据未到时会判定「词书已删除」 | 数据未齐时跳过清理，`bookDataVersion` 变化后再补跑 |
| 版本号发了但客户端不提示更新 | 清单 `versionCode` 没递增，或 APK 与清单不一致 | 只改 `APP_VERSION`，让 CI 生成 code，并看构建末尾的断言 |
| 选项里两个中文几乎一样 | 去重只比了「字符串完全相同」，`放弃` 与 `放弃，遗弃` 被当成不同项 | 一律用 `meaningsTooClose()`：包含关系、汉字 Jaccard≥0.6、短词编辑距离≤1 都算重复 |
| 精选词表反而给出错释义 | 开源词表也有错条：`sacred→害怕`、`statue→法令`、`war→警告` | 生成核心释义时必须校验「与现有释义有汉字交集」，否则宁可回退 |
| 释义里出现「DOS内部命令」 | 3500 词库来自一部 DOS 时代的老词典，末尾挂着工具说明 | `cleanMeaning()` 的三条规则（`MEANING_JUNK_RE / GRAMMAR_RE / TOOL_TAIL_RE`），常量必须在 `builtInBooks` 之前声明 |
| 核心释义被截断成半个词 | 把整串按 18 字 `slice`，会切出「媒」这种残字 | 按义项切分后再取整条，超长只保留第一个义项 |
| 听读还是有文件落盘 | `playAlbumEn` 先 `downloadToFile` 再播 | 联网走 `playAlbumUrl`（流式）；`prefetchAhead` 在 `streamMode()` 时直接跳过 |

---

## 6. 目录速查

```
src/main.jsx                 前端全部逻辑（单文件，约 1.7 万行）
src/sfx.js                   答题音效（v2.80.0 新增：8 个真实 MP3 base64 内嵌，离线可用，勿手改）
src/styles.css               全部样式（新增样式追加到文件末尾，按版本号注释分块）
src/avatarData.js            内置头像（data URI，改头像就换这个文件）
src/MainActivity.java        WebView 容器 / 更新安装 / 保存目录（SAF）/ 返回键
src/PlayerService.java       前台播放服务 / MediaSession / TTS / 语音包
src/build.yml                CI 流水线（对应仓库 .github/workflows/build.yml）
src/site/gaokao-vocab-site.html   官网
src/scripts/sync-site-changelog.js  官网更新日志注入
src/coreMeanings.js          核心释义表（3857 词，自动生成，勿手改）
src/data/curated/*.json      精选词库源数据（高考3500 / 真题高频 / 牛津3000）
src/scripts/build-core-meanings.js  重新生成 coreMeanings.js（改了精选表或人工表后跑一次）
app-update.json              版本清单（客户端更新判断的唯一事实来源）
src/AGENTS.md                本文件（改版前先读）
version.json                 轻量版本探针（约 300 字节，先比 code 再决定要不要下正文）
zhvoice.zip                  中文高清语音包（仓库根，走 jsDelivr）
android/app/src/main/assets/public/   构建时由 dist 覆盖，不要手改
```

---

## 6.5. v2.80.0 新增的四项体验功能（实现要点）

- **护眼模式**：`settings.eyeCare` 开关 → `useEffect` 给 `document.body` 加/去 `eye-care` 类；
  `styles.css` 末尾 `body.eye-care { ... }` 覆盖主题 CSS 变量为暖色低蓝光，并叠一层极淡暖色滤镜。
  仅单开关，不做深色（与用户约定）。
- **艾宾浩斯记忆法**：`settings.ebbinghaus` 开关 + `localStorage` 键 `gaokao_review_schedule`
  （termKey → `{ l: 间隔档位, d: 下次复习时间戳 }`）。遗忘曲线间隔：20分钟/1小时/9小时/1天/2天/6天/15天/35天。
  开启后 `learnItems` 按 `d` 升序排，到期（含新词 d=0）优先；答题时答对进下一档、答错回第 1 档。
- **答题音效**：`src/sfx.js` 导出 `SFX_CORRECT`（4 套）/ `SFX_WRONG`（4 套），均为 base64 MP3，
  `playAnswerSfx(isCorrect, correctId, wrongId)` 用 `new Audio(dataURI).play()` 播放（离线、无文件请求）。
  `handleSelect` 内按对错触发；设置里 `soundEnabled` 总开关 + `soundCorrect`/`soundWrong` 分别切换并试听。
- **例句语境模式**：`choiceModes` 新增 `sentence`；题目区用 `getWordEnrichment(term).collocations[0]`
  的英文部分（去掉末尾中文释义）作语境，高亮目标词，按语境选义项（复用既有的 4 选项逻辑）。

---

## 7. 发布后自检清单

- [ ] Actions 全绿，`APK ok: com.gaokao.vocab vX.Y.Z (code)`
- [ ] `app-update.json` 的 `version / versionCode / apkSize / apkSha256` 与 Release 里的包一致
- [ ] `https://xdbzys.github.io/gaokao-vocab/` 打开正常（经典网页版）
- [ ] `https://xdbzys.github.io/gaokao-vocab/app/` 打开正常（新网页版，功能与 App 一致）
- [ ] `https://xdbzys.github.io/gaokao-vocab/site/` 更新日志第一条是本次版本，页头版本号同步
- [ ] 真机装一次：返回键逐层返回、听读面板互斥、MP3 能选目录并保存、头像为新图

---

## 8. 推不上去怎么办（云端沙箱常见）

在隔离沙箱里 `git push` 经常被代理打断（`Recv failure: Connection reset by peer`、
`early EOF`），仓库本身没问题。此时改成走 **Git Data API** 推，一次提交原子生效：

```
1) POST /git/blobs              content + encoding(utf-8 | base64)   → blob sha
2) POST /git/trees              base_tree=当前 master 提交 + 上面所有 blob → tree sha
3) POST /git/commits            message + tree + parents=[当前 master]  → commit sha
4) PATCH /git/refs/heads/master sha=commit（不要 force）
```

要点：

- 大二进制（`zhvoice.zip` 15.7MB、`gaokao-vocab.apk`）必须用 `encoding: base64`，
  按 utf-8 传会直接损坏。
- 每次推送前**重新 GET 一次 `ref/heads/master`**：CI 成功后会自己往 master 写清单，
  用旧 base 推会 422（not a fast forward）。
- 只改文档、不想再跑一遍 20 分钟的 APK 构建时，commit message 里加 `[skip ci]`，
  GitHub 会跳过 workflow（文档改动也不影响 Pages，可以放心跳过）。


---

## 9. v2.82.0 变更记录（背诵页首屏紧凑布局 / 答后考点开关）

**布局**：`main.jsx` 背诵页 `<section className="learnPage">`、题卡 `<div className="card learnCard">`；
`styles.css` 里 `.options` 改为 `grid-template-columns: repeat(2, minmax(0,1fr))` 两列紧凑胶囊
（`min-height: 44px`、`padding: 8px 10px`、`gap: 8px`、`flex: 0 0 auto`），
`.learnPage` 作用域压缩六个快捷按钮、进度区、题卡（`min-height` 380px → 0）、题目区、例句语境与答后面板。
两列网格对 4 选 1 与 6 个选项都成立；窄屏（≤360px）另有二次压缩。

**开关**：`settings.answerFullPoints`（默认 `false`），位置「我的 → 学习辅助与反馈 → 答题后显示全部考点」。
答题后 `answerBox` 内 `fullPoints / showDetail / showAll` 三个派生量控制：
- 关闭（默认）：只显示结果、当前单词释义、`其他选项单词 · 中文对照` 紧凑列表；
  隐藏 `mergedPoints` 考点、`enrichment` 增强数据、词族/易混词与例句，列表不显示「考点 ›」。
- 开启：显示该单词跨词库全部考点 + 常考要点/搭配/派生/近义反义 + 词族 + 例句，答错也全量显示；
  列表恢复「考点 ›」跳转。
- 闪卡模式不受影响（`showDetail` 恒为 true）。

**版本**：`APP_VERSION 2.82.0` / `APP_VERSION_CODE 308`（CI 生成 309，> 线上 307）。


---

## 10. v2.82.1 变更记录（收敛布局：只压缩设置开关）

用户反馈 v2.82.0 把「六个设置开关」和「答题选项」一起缩小了，要求**只压缩设置开关、答题选项还原**。

- 答题选项 `.options` 完整还原到 v2.81.3：单列 `display:grid; gap:10px; flex:1`，
  按钮 `text-align:left; padding:15px 18px; font-size:16px; line-height:1.4; border-radius:18px; font-weight:500`；
  `@media (max-width:360px)` 里的 `.options` 规则也还原。
- 删除第 9 节里 `.learnPage` 对题卡 / 题目区 / 进度条 / 分类行 / 例句语境 / 答后面板 / 导航按钮的全部压缩，
  `card.learnCard` 与 `learnBrand` 类名移除，`posText` 内联字号间距还原。
- **只保留** `.learnPage .quickToggleRow / .quickToggleBtn / svg` 的压缩（矮屏窄屏另有更紧凑一档）。
- v2.82.0 的「答题后显示全部考点」开关功能完整保留，仅还原其选项词汇列表的尺寸微调。
- 版本 2.82.1 / code 310（CI→311）。


## 11. v2.83.0 变更记录（高考考频分级 / 考察次数 / 优先背诵高频词）

用户要求：对所有词库联网对照高考，标注高频/中频/低频与考察次数，范围含所有年份；
并在「我的」新增「是否开启优先背诵频率高的单词」设置。

### 数据文件
- 新增 `src/data/exam-freq.js`（独立分片，93KB，App 挂载后动态 import，不进首屏包）。
  导出 `EXAM_FREQ_MAP`（word -> [level, count]）、`EXAM_RECENT_MAP`、`EXAM_FREQ_META`。
- `level`：3 高频 / 2 中频 / 1 低频 / 0 基础（虚词，不参与优先排序）。
  `count`：历年真题语料中的出现次数；0 = 未被语料收录，界面显示「—」。
- 生成脚本：`gen_exam_freq.py`（项目根，离线运行，输入为联网数据，非运行时依赖）。

### 数据来源与口径（如实标注，严禁编造次数）
1. 主数据：GitHub 开源 `HK-SHAO/English-Dictionary` 的 `dic.txt` —— 130+ 份历年高考全国卷
   及各省高三模拟卷、约 50 万词次的逐词频数统计（真题语料实测）。
2. 补充：项目 `seeds-exam.js`「近五年真题高频词」508 条的真题词频，界面显示为「近五年 N 次」。
3. 兜底：`FrequencyWords` 通用英语语料库词频。未被真题语料收录的词只给等级、不给次数。
4. 分级：按真题语料频次分位，高频前 25%（门槛 39 次）、中频 25%~60%（门槛 8 次）、
   低频后 40%；139 个基础虚词单列。与公开真题考频口径（高频≥42 / 中频 19-42 / 低频 9-19）接近。
5. 局限：公开资料无法覆盖全部年份、全部省份的逐词精确考查次数；App「我的」页原文说明，
   等级仅用于安排背诵优先级，不代表官方考查次数。

### 实现要点
- `main.jsx` 模块级：`EXAM_FREQ` / `getExamFreq()` / `examLevelOf()` / `examCountOf()` /
  `ExamFreqTag`；App 内 `examFreqReady` state + `import('./data/exam-freq')` 懒加载。
- 徽标挂载三处：背诵页 `cardMeta`、词库列表 `listItemTitle`、详情页 `detailMetaRow`。
- `settings.freqFirst`（默认 false）：`learnItems` 在艾宾浩斯排序之后按等级分桶降序；
  用显式下标保序（不依赖 Array.sort 稳定性），艾宾浩斯/乱序开启时保留桶内顺序，
  否则桶内按真题次数降序。`useMemo` deps 补 `settings.freqFirst` / `examFreqReady`。
- 「我的 → 学习辅助与反馈」新增开关与 `examFreqNote` 口径说明；`styles.css` 追加
  `.examFreqTag` / `.examFreqLv0~3` / `.examFreqNote`（含护眼模式适配）。
- 版本 2.83.0 / versionCode 312（线上 311 → CI 313）。
