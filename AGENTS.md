# 背群英 · 维护交接说明（给下一次接手的人或 AI）

本文件是这个仓库的**唯一操作手册**。任何一次改动都按这里的顺序执行，不要凭记忆推断。
仓库：`xdbzys/gaokao-vocab`，分支 `master`。

---

## 1. 这个项目由哪几块组成

| 组成 | 源码位置 | 构建产物 | 发布位置 |
|---|---|---|---|
| 安卓安装包（APK） | `src/main.jsx` + `src/*.java` + `android/` | `app-release.apk` | GitHub Release / jsDelivr / Gitee / 官网下载按钮 |
| 经典网页版（旧） | 与 APK 同一份 `src/main.jsx` | `dist/index.html` | `https://xdbzys.github.io/gaokao-vocab/`（Pages 根路径） |
| App 同款网页版（新） | 同一份产物，运行期按路径识别 | `dist/app/index.html` | `https://xdbzys.github.io/gaokao-vocab/app/` |
| 官网 | `gaokao-vocab-site/gaokao-vocab-site.html` | `dist/site/index.html` | `https://xdbzys.github.io/gaokao-vocab/site/` |
| 旧站（仅跳转） | 仓库 `xdbzys/gaokao-vocab-website` | 无 | 自动跳转到上面的新官网 |
| 中文高清语音包 | 仓库根 `zhvoice.zip`（6337 条 .ogg） | 运行时下载解压到 `filesDir/zhvoice` | jsDelivr 多节点 |

**三者共用同一份前端代码**：不要为网页版另建一份 `main.jsx`，否则版本会分叉。

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
npm run build                     → dist/index.html（单文件，全内联）
gzip -9 dist/index.html           → index.html.gz（云端热更用）
cp -r dist android/app/src/main/assets/public   ← 注意：这一步之后才生成网页版副本
node scripts/sync-site-changelog.js             ← 官网更新日志注入
cp -r gaokao-vocab-site/. dist/site/            ← 官网
mkdir dist/app && cp dist/index.html dist/app/index.html  ← 新网页版
./gradlew assembleRelease                       ← 打 APK
aapt2 断言包名/版本号
写入 apkSize / apkSha256 → version.json / app-update.json
```

**为什么 `dist/app` 必须在「拷贝到 assets」之后**：否则同一份 2MB HTML 会再被打进 APK，
包体翻倍，还会拖慢 Gitee 镜像推送。

---

## 4. 本地改完怎么验证（不含真机时的最低要求）

```bash
# 1) 打包（必须过；CI 第一步就是它）
npm install && npm run build        # 产出 dist/index.html 单文件，语法错会直接报

# 2) 已有兼容性检查（仓库自带，改完前端务必各跑一次）
node verify_es5.cjs                 # 产物必须是 ES5，否则老 WebView 白屏
node verify_chromium37.cjs          # Chromium 37 兜底语法检查
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
