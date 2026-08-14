<h1 align="center">Nothing is impossible.</h1>

<p align="center">
  <b>Nothing is impossible · 面向中国学习者的英语学习闭环平台</b><br/>
  <sub>输入 · 规则 · 记忆 · 训练 · 应用 · 反馈 —— 让背过的每个词都回到语境里被使用、被检测、被复习</sub>
</p>

<p align="center">
  <a href="https://www.lingoforge.fun/">🌐 线上体验</a> ·
  <a href="#-产品定位">产品定位</a> ·
  <a href="#-学习闭环">学习闭环</a> ·
  <a href="#-核心功能">核心功能</a> ·
  <a href="#-词库数据">词库数据</a> ·
  <a href="#-技术架构">技术架构</a> ·
  <a href="#-部署拓扑">部署拓扑</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-5-purple" alt="Vite 5" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-cyan" alt="TailwindCSS 3" />
  <img src="https://img.shields.io/badge/Express-5-green" alt="Express 5" />
  <img src="https://img.shields.io/badge/MySQL-8.0-orange" alt="MySQL 8.0" />
  <img src="https://img.shields.io/badge/Node-%3E%3D20-green" alt="Node >=20" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## ✨ 产品定位

**Nothing is impossible** 把英语学习拆成一条**六层闭环**：**输入 → 规则 → 记忆 → 训练 → 应用 → 反馈**。

绝大多数背单词 App 只解决「输入 + 记忆」两层，背过的词没有出口、没有反馈，更没有真正的「活英语」。本项目的核心论点是：**背过的词必须回到语境里被使用、被检测、被复习，记忆才能真正留存**。因此五大功能词本（错题本 / 阅读词本 / 语料词本 / 复习计划 / 收藏词本）会把阅读、语料、练习中积累的词汇自动回流到打字训练，形成自驱的闭环。

> 不卖词库，卖方法；不堆功能，做闭环。

---

## 🔁 学习闭环

```
        输入（打字背词） · 23 本词库 · 93,644 词 · 25 词/章
                    │
                    ▼
        规则（语法体系） · 词性 · 时态 · 长难句
                    │
                    ▼
        记忆（SM-2 间隔重复 + 错题本）  ◄── 回流
                    │
                    ▼
        训练（听写 · 复习 · 五大功能词本）
                    │
                    ▼
        应用（分级阅读 + 65 集真实语料）
                    │  生词一键收藏 ──► 阅读词本 / 语料词本 ──► 回流训练
                    ▼
        反馈（数据统计）
                    │
                    └──────────────►（回到输入）
```

---

## 🚀 核心功能

### ⌨️ 打字背单词（核心引擎）
- **23 本精准词库**：覆盖中学、大学、英专、留学、考研、船员考试、专业英语七大类，共 **93,644 词**
- **25 词/章科学切分**：强制控制单次学习负荷，每章一个独立进度单元
- **沉浸式逐字输入**：实时纠错高亮，肌肉记忆 + 视觉记忆双通道强化
- **Web Audio 机械键盘音效**：纯代码合成真实机械键盘声 + 正确 / 错误 / 完成提示音，零音频文件依赖（见 [src/hooks/useTyping.js](src/hooks/useTyping.js) + [src/utils/audioContext.js](src/utils/audioContext.js)）
- **听写模式**：隐藏单词，纯凭记忆与中文释义拼写
- **可配重复次数**：1 / 3 / 5 / 8 / 无限次，按需强化
- **错词智能分类**：自动识别双字母遗漏、元音混淆、相邻键误触等错误类型，沉淀进错题本
- **跨词库搜词**：全局搜索，点击直达对应词库章节

### 🔁 五大功能词本（闭环载体）
阅读 / 语料 / 错题中积累的词汇，自动回流到打字训练，是闭环的核心：
- **错题本**：打字练习中出错的词，专项重练
- **阅读词本**：分级阅读里点查收藏的生词
- **语料词本**：视频字幕里点查收藏的生词
- **复习计划**：SM-2 间隔重复调度，在「将要遗忘前」精准召回（实现见 [src/utils/reviewCards.js](src/utils/reviewCards.js)）
- **收藏词本**：练习中随手收藏的词，随时专项练习

### 📖 分级阅读
- **点击即查**：即点即查，支持不规则动词、复数、时态等词形还原（[src/utils/wordLookup.js](src/utils/wordLookup.js)）
- **生词回流**：一键收藏至阅读词本，回到打字模块专项练习
- **沉浸式阅读**：段落级中文翻译折叠，阅读进度持久化
- **多维筛选**：分类、年份、搜索、收藏四维过滤

### 🎬 视频语料中心
- **65 集精选语料**：TED 演讲、旅行 Vlog、生活播客、美食分享，美音英音兼备
- **8 种字幕模式**：中英双语 · 纯英文 · 纯中文 · 完形填空 · 听写模式 · 阅读模式 · 中英互译 · 词汇卡片
- **键盘快捷键**：空格暂停 / ← → 跳转 5s / ↑ ↓ 切换字幕 / L 循环
- **字幕点词即查**：点击字幕任意单词即时查义并收藏至语料词本
- **移动端专属播放器**：针对触屏优化的手势与布局（[src/modules/corpus/components/mobile/](src/modules/corpus/components/mobile/)）
- **iOS Safari 兼容**：自定义 OSS 域名 + 内嵌播放 / 封面 / 全屏专项修复；片源已统一转码 H.264 + faststart
- **体验用户限流**：体验账号仅开放第 1–5 期，超出（含直链 / 历史 / 期号跳转）自动重定向至体验沙箱

### 📐 语法体系
- **三阶进阶**：词性 → 时态 → 长难句，由词到句逐步构建语法框架
- **八大词性**系统讲解 · **16 种时态**体系梳理 · **长难句**层层拆分（数据见 [src/data/english_grammar_system.json](src/data/english_grammar_system.json)）

### 💡 科学学习方法
- 6 大高效学习法，按证据等级分级，附科学方法 vs 低效方法对比数据（[src/data/english_learning_methods_data.json](src/data/english_learning_methods_data.json)）
- 每日 15–20 分钟最小有效剂量学习计划

### 🔐 账号体系
- **用户名 + 密码注册 / 登录**：bcryptjs（12 轮）加盐哈希，JWT（access 30m）+ Refresh（7d）+ HttpOnly Cookie 双重鉴权
- **设备登录限制**：每账号最多 2 台设备同时在线，超出直接拒绝，支持设备管理（查看 / 踢出）
- **激活码注册**：`/activate/<code>` 链接直达，粘贴完整链接自动提取码段
- **体验码试用**：1 小时试用、设备级限流（一设备一码）、试用条引导升级；试用到期时间内嵌 JWT，服务端 + 前端双重强制下线
- **找回密码**：凭激活码反查账号并重置用户名 / 密码
- **跨设备进度同步**：词库进度、词本、收藏状态服务端持久化
- **个人资料**：昵称、签名、头像、每日学习目标

### 📊 数据统计
- **模块化计时**：打字 / 阅读 / 语料独立计时
- **月度热力图**：学习日历一目了然
- **7 天趋势图**：学习节奏可视化
- **实时追踪**：WPM、正确率、输入数

---

## 🌟 产品亮点

| 亮点 | 说明 |
|:---|:---|
| 🔁 六层学习闭环 | 阅读 / 语料 / 错题的词汇自动回流训练，五大功能词本是闭环载体 |
| 🧠 SM-2 间隔重复 | 基于遗忘曲线在「将要遗忘前」召回，错题本 + 复习计划双驱动 |
| ⌨️ Web Audio 合成音效 | 机械键盘声、正确 / 错误 / 完成提示音，纯代码合成零依赖 |
| 🔍 词形还原查词 | 不规则动词、复数、时态、比较级等形态还原，查词无死角 |
| 🎬 65 集真实语料 | 8 种字幕模式 + 字幕点词即查，OSS 自定义域名解决 iOS 内嵌播放 |
| 🔐 完整账号体系 | 每账号 2 设备 + 激活码 / 体验码 / 找回密码，到期双重强制下线 |
| 🎨 3 套主题 | 明亮 / 暗夜 / 暖色，CSS 变量驱动全局换肤 |
| 📱 深度移动端适配 | UA + 触控 + 屏幕尺寸 + 指针类型多维检测，平板横竖屏自动切换（运行时分流，单构建产物） |
| 💾 离线可用 + 服务端同步 | IndexedDB + localStorage 双存储，登录后跨设备同步 |
| 🧭 Safari 14+ 兼容 | `@vitejs/plugin-legacy`（iOS/Safari ≥ 14）+ `modernPolyfills` + `es2020` 产物，根治低版本 Safari 白屏 |

---

## 📚 词库数据

23 本词库，共 **93,644 词**，全部按 **25 词/章** 强制切分。词库 JSON 以静态资源方式按需 `fetch`，不打入前端 bundle。

| 分类 | 词库 | 词数 |
|:---|:---|---:|
| **中学英语** | 初中 · 中考核心 · 高中 · 高考核心 | 6,595 |
| **大学英语** | CET-4 · CET-4 高频 · CET-6 · CET-6 高频 | 15,534 |
| **英专生英语** | TEM-4 · TEM-8 | 18,976 |
| **留学英语** | 雅思 · 托福 · SAT | 22,421 |
| **考研英语** | 考研词汇 · 考研核心词汇 | 7,971 |
| **船员考试** | 航海英语 | 1,565 |
| **专业英语** | 程序员 · 轮机 · 商务 · 外贸 · 汽修 · 电工 · 厨师 | 20,582 |

> 各词库均标注权威来源（如轮机英语依据《轮机英语词汇》国防工业出版社 2022、外贸英语依据外经贸大 880 万词语料库、汽修英语依据 GB/T 5624-2019 等 SAE 标准）。词库元数据见 [src/dictionaries/meta.js](src/dictionaries/meta.js)。

---

## 🎬 语料库

65 集真实英语视频语料，覆盖 **演讲 / 旅行 / 生活 / 美食** 四大类，美音英音兼备。每集提供：

- 完整中英字幕（时间轴对齐，[public/corpus/subtitles/](public/corpus/subtitles/)）
- 句数、词汇量统计、口音标注
- 字幕逐词点查 + 收藏至语料词本
- YouTube 原始链接溯源

视频资源托管于 **阿里云 OSS 自定义域名**（`videos.lingoforge.fun`），通过 CNAME + DV 证书解决 iOS Safari 的 `Content-Disposition: attachment` 拒绝内嵌播放问题；片源统一为 H.264 + faststart，避免 iPhone 无法解码 AV1。

---

## 🛠 技术架构

### 前端

| 层级 | 技术选型 |
|:---|:---|
| 框架 | React 18 + Vite 5（ESM） |
| 样式 | Tailwind CSS 3 + CSS 变量主题系统（4 套主题，`darkMode: 'class'`） |
| 路由 | React Router 6（懒加载 + 失败重试 `lazyRetry`） |
| 虚拟列表 | @tanstack/react-virtual（[src/components/virtual/](src/components/virtual/)） |
| 图表 | 纯 CSS/DOM 自绘（学习日历热力图 + 7 天趋势图，无第三方图表库） |
| 图标 | lucide-react |
| 通知 | sonner（toast） |
| 兼容 | `@vitejs/plugin-legacy`（targets `iOS ≥ 14` / `Safari ≥ 14`）+ `modernPolyfills`，`build.target: 'es2020'` |

### 后端

| 层级 | 技术选型 |
|:---|:---|
| 框架 | Express 5（Node ≥ 20，ESM） |
| 数据库 | MySQL 8.0（mysql2 连接池，utf8mb4_unicode_ci） |
| 认证 | JWT（access 30m / refresh 7d）+ bcryptjs（12 轮）+ HttpOnly Cookie |
| 邮件 | resend（验证码 / 找回密码） |
| 日志 | pino（生产 JSON 单行 / 开发 pino-pretty 彩色，[server/utils/logger.js](server/utils/logger.js)） |
| 迁移 | 服务启动时自动幂等执行 `server/sql/migrate_*.sql`，无需手动建表 |

### REST API

| 模块 | 路由 | 能力 |
|:---|:---|:---|
| 账号 | `/api/auth` | 注册 · 登录 · 刷新 · 登出 · 改密 · 设备管理 · 激活码校验 · 找回密码 |
| 体验 | `/api/demo` | 体验码兑换 · 试用状态 · 升级 |
| 打字 | `/api/progress` | 词库 / 章节进度同步 |
| 词本 | `/api/wordbooks` | 收藏 / 错题 / 阅读 / 语料 **四类词本**读写 |
| 收藏 | `/api/favorites` | 词汇收藏 / 词库收藏 |
| 复习 | `/api/review` | SM-2 卡片调度 |
| 设置 | `/api/settings` | 用户配置 |
| 监控 | `/api/client-error` | 前端错误统一上报 |
| 迁移 | `/api/migrate` | 一次性本地（localStorage）→ 服务端用户数据导入 |

> 数据库 schema 迁移不由此端点触发，而是在**服务启动时自动幂等执行** `server/sql/migrate_*.sql`（[server/index.js](server/index.js) `runMigrations()`，含单引号感知的 SQL 切分器）。

---

## 📁 项目结构

```
typing-word/
├── src/
│   ├── modules/                  # 业务模块（按功能域懒加载）
│   │   ├── corpus/               # 视频语料中心（字幕模式 / components/mobile/ 移动端组件）
│   │   ├── reading/              # 分级阅读
│   │   ├── grammar/              # 语法体系
│   │   └── learning-methods/     # 科学学习方法
│   ├── pages/                    # 顶层页面（打字 / 词本 / 统计 / 登录 / 设备 …）
│   ├── components/               # 通用组件 + virtual/（VirtualList / VirtualGrid）
│   ├── contexts/                 # Auth / Word 全局状态
│   ├── data/                     # grammar / learning-methods 静态数据 JSON
│   ├── hooks/                    # useTyping / useQuiz / useIsMobile / useTypingGestures …
│   ├── dictionaries/meta.js      # 词库元数据（JSON 已移出 bundle，运行时 fetch）
│   ├── utils/                    # reviewCards(SM-2) / wordLookup(词形还原) / audioContext / idb …
│   └── lib/                      # API 客户端
├── server/
│   ├── routes/                   # 9 个 REST 路由模块
│   ├── middleware/               # auth / rateLimit / errorHandler
│   ├── sql/                      # schema.sql + 幂等 migrate_*.sql
│   ├── config.js  db.js
│   ├── utils/logger.js           # pino 日志
│   └── index.js                  # 入口 + 启动时自动迁移
├── scripts/                      # 词库校验 / 语料 YouTube 去重 / OSS 编码与转码工具
├── standards/                    # 权威词表（dict:levels 分级校验对照源：CET / TEM / 考研 / SAT 等）
├── deploy/                       # nginx.conf / ecosystem.config.js / setup.sh / deploy.sh
├── public/
│   ├── dictionaries/             # 23 本词库 JSON（fetch 加载，不进 bundle）
│   └── corpus/subtitles/         # 65 集字幕 JSON
└── .github/workflows/            # CI/CD（push main 自动部署阿里云）
```

---

## 🧪 本地开发

```bash
# 安装依赖（Node >= 20）
npm install

# 前后端联调（Vite :5173 + Express :3001）
npm run dev:all

# 仅前端 / 仅后端
npm run dev
npm run server
```

> ⚠️ **MySQL80 须先以管理员权限启动**（系统服务或手动提权），否则后端起不来。

**环境变量**（参考 [.env.example](.env.example)）：

```env
PORT=3001
DB_HOST=localhost
DB_PORT=3306
DB_NAME=lingoforge
JWT_SECRET=<your-secret>
JWT_ACCESS_EXPIRES=30m
JWT_REFRESH_EXPIRES=7d
MAX_DEVICES_PER_USER=2
FRONTEND_URL=http://localhost:5173
ALLOWED_ORIGINS=http://localhost:5173
VITE_API_BASE_URL=               # 本地留空走 Vite proxy
VITE_OSS_BASE_URL=https://videos.lingoforge.fun
VITE_AUTH_ENABLED=true           # 置 false 即为免登录体验构建（Vercel 演示站用）
```

**词库维护脚本**：

```bash
npm run dict:check        # 清理 + 校验 + 分级检查（对照权威词表）
npm run add:cntitle       # 批量补全中文标题
npm run corpus:check-yt   # 语料 YouTube 去重
```

### 测试与质量

```bash
npm run test:run          # vitest 一次性跑全量（hooks + utils + server supertest）
npm test                  # vitest watch
npm run lint              # eslint（flat config）
npm run format            # prettier 格式化
```

- **测试**：Vitest + Testing Library + jsdom（前端），supertest（后端路由）。
- **质量门禁**：eslint + prettier + husky + commitlint（Conventional Commits）+ lint-staged，提交时自动 lint / format。

---

## 🌐 部署拓扑

生产采用「阿里云主站 + Vercel 体验站 + OSS 媒体源」三段式：

```
   www.lingoforge.fun
            │
            ▼
        Nginx (:80)
            │
            ├──►  静态 dist (/)                  ← 前端 SPA
            │
            └──►  /api/*  ──►  Express (:3001, PM2 守护)
                                      │
                                      ▼
                                   MySQL 8.0

   视频媒体  ──►  阿里云 OSS  ──►  videos.lingoforge.fun（自定义域名 + DV 证书）
   体验/演示 ──►  Vercel（VITE_AUTH_ENABLED=false 的免登录构建）
```

- **主站（阿里云）**：Express(:3001) + PM2 单实例守护 + Nginx 反代 + MySQL，承载完整账号体系。代码目录 `/home/lingoforge`，**非 git 仓库**，部署靠推送同步（见下 CI/CD），不在服务器上 `git pull`。
- **媒体源（OSS）**：65 集视频与封面，自定义域名规避 iOS Safari `attachment` 头；片源统一 H.264 + faststart。
- **体验站（Vercel）**：`VITE_AUTH_ENABLED=false` 免登录演示构建，[App.jsx](src/App.jsx) 据此裁剪鉴权路由，独立于主站。
- **数据迁移**：服务启动时自动幂等执行 `server/sql/migrate_*.sql`，无需手动建表。
- **前端错误闭环**：`/api/client-error` 收集客户端异常，pino 落盘，PM2 日志可检索。

> ℹ️ Vercel 域名 `lingoforge.vercel.app` 在国内被 GFW 污染（DNS + RST），国内 `curl` 必返回 HTTP 000，**这不是部署故障**；验证 Vercel 状态请看 Vercel 控制台。

### CI/CD（[.github/workflows/deploy.yml](.github/workflows/deploy.yml)）

push 到 `main` 自动触发，质量门禁失败即中止部署：

1. `npm ci --ignore-scripts` → `npm run lint` → `npm run test:run` → `npm run build`
2. SSH 密钥就绪 → `cp -al /home/lingoforge /home/lingoforge.bak`（硬链接快照，可回滚）
3. `rsync --delete`（排除 `.env.local` / `node_modules` / `.git` / `*.map`）→ `/home/lingoforge/`
4. `npm install --omit=dev --ignore-scripts` → `pm2 reload lingoforge --update-env`

---

## 🗺 路线图

> 融资后规划

### 词库增强
- 优化现有词库释义与例句质量
- 新增更多专业 / 行业词库

### 训练中心
- **听**：听力选择、听写填空、关联语料中心素材
- **说**：跟读训练、口语评分、语音对齐
- **练**：选择题、完形填空、单词填空、写作批改、翻译练习

---

## 👤 关于作者

**张艺城** —— 独立开发者

> _Nothing is impossible._

---

## 📄 许可证

[MIT License](LICENSE) © 2026 warri

> 词库与语料内容仅用于学习目的，部分依据权威大纲 / 标准（详见各词库 description 标注的来源）；第三方素材（TED、YouTube 等）版权归原作者所有。
