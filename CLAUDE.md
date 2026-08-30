# Yi English（仓库目录 typing-word）

英语学习闭环平台：单词打字训练为核心，环绕语料视频、阅读、复习测验、AI 助手等模块。前端 Vite + React 18（纯 JSX，无 TS），后端 Express 5（CommonJS）+ MySQL 8，测试 Vitest。产品介绍见 README.md。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev:all` | 前端(5173) + 后端(3001) 同时起，Vite 已代理 `/api` → 3001 |
| `npm run test:run` | Vitest 单次全量（CI 用这个；`npm test` 是 watch 模式） |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run build` | 生产构建 |
| `npm run dict:check` | 词库清洗 + 校验（改 `public/dictionaries/*.json` 后必跑） |

## 本地开发前置

- **MySQL80 必须先以管理员权限启动**（服务或手动提权），否则后端起不来。
- 根目录 `.env.local`（不进 git）由后端 dotenv 加载：`DB_*`、`JWT_SECRET`、`DEEPSEEK_API_KEY` 等，完整清单见 `server/config.js`。
- 建库用 `server/sql/schema.sql`；`migrate_*.sql` 在后端启动时自动按序执行（`schema_migrations` 表记版本，失败不中止启动、下次自动重试）。

## 架构速览

- `src/` React 前端：`pages/` 路由页（Typing / ReviewQuiz / Stats / WordBooks / AIChat 等）；`modules/` 功能模块（corpus 语料视频、grammar、reading、learning-methods）；`hooks/`（useTyping / useQuiz 等）；`contexts/`（Auth / Word）；`lib/`（api 封装、chat-engine）；`utils/` 纯函数工具，多数有配套 `.test.js`
- `server/` Express 后端：根 package.json 是 `type:module`，server 自带 `{"type":"commonjs"}`——后端代码用 require。`routes/`（auth / progress / review / wordbooks / chat / memory / clientError 等，均有测试）、`services/`（deepseekProxy、memoryExtractor、promptBuilder）、`middleware/`（JWT auth、rateLimit）
- `public/dictionaries/*.json` 词库数据（按需 fetch 不进 bundle）+ `src/dictionaries/meta.js` 元信息注册（含功能词本虚拟词库）；`standards/` 原始标准词表；`scripts/*.mjs` 词库维护与语料处理脚本
- `deploy/` pm2 ecosystem（fork 单实例）、nginx.conf

## 功能地图

学习闭环：输入(打字) → 规则(语法) → 记忆(SM-2+错题本) → 训练(听写/复习/词本) → 应用(阅读+语料) → 反馈(统计)。

- **打字训练（核心）**：`/typing/:dictId/:chapterId` → `pages/Typing` + `hooks/useTyping*`；音效纯 Web Audio 合成（`utils/audioContext.js`，无音频文件）；错词自动分类入错题本
- **词库**：固定 25 词/章（`meta.js` CHAPTER_SIZE）；`*freq.json` 高频变体由 `scripts/gen-freq-dicts.mjs` 生成；词库清单以 `src/dictionaries/meta.js` 为准
- **五大功能词本（闭环载体）**：错题本 / 阅读词本 / 语料词本 / 收藏词本 / 复习计划（SM-2，`utils/reviewCards.js`）。在 `meta.js` 以 `error-book` 等虚拟 id 注册为「功能词本」，与普通词库走同一套打字/复习流程
- **阅读**：`/read` → `modules/reading`，词形还原 `utils/wordLookup.js`；**语料**：`/listening` → `modules/corpus`，8 种字幕模式在 `components/subtitleModes/`，视频托管阿里云 OSS `videos.lingoforge.fun`（H.264 + faststart，iOS Safari 内嵌播放的前提，别改格式）
- **语法 / 学习方法**：纯静态数据 `src/data/*.json`
- **复习**：`/review/setup/:bookId`、`/review/quiz/:bookId`
- **AI 助手**：`/ai-assistant` + 全局悬浮球（`components/AIAssistant`，显隐开关在个人中心）；前端 `lib/chat-engine.js` → 后端 `routes/chat|memory|style` → `services/deepseekProxy`（DeepSeek 代理）+ `memoryExtractor`（长期记忆）

## 数据与同步

- 本地双存储：localStorage + IndexedDB（库 `lingoforge` v2，7 个 store 见 `utils/idb.js`）；启动空闲时自动跑 localStorage → IDB 迁移。
- **词本类 util 统一模式**：内存缓存为唯一数据源，2s debounce 落盘（localStorage 全量 + IDB 增量 put 合并刷盘）——照 `errorBook.js` / `reviewCards.js` / `localProgress.js` 的既有写法，别每词一次全量 stringify。
- 登录后跨设备同步：`hooks/useProgressSync` + `server/routes/progress|favorites|review`。
- 体验账号：isTrial 锁定 `/demo` 沙箱、语料仅 1–5 期（`TrialGuard` + `server/middleware/requireFullAccount`）；统计口径一律排除 `is_guest=1`。

## 测试约定

- Vitest 默认 node 环境；`vitest.config.js` 故意独立于 `vite.config.js`，DOM 测试在文件顶部加 `// @vitest-environment jsdom`；esbuild jsx automatic 已配，.jsx 测试无需 import React。
- 改 `src/utils/` 或 `server/` 逻辑时同步维护对应 `.test.js`。

## 构建注意

- 构建目标 es2020 + `@vitejs/plugin-legacy`（Safari 14–15.3 白屏修复的关键开关，modernPolyfills 勿关）。
- 生产构建剥离 console.log/debug/info/trace、保留 warn/error；sourcemap 为 hidden，部署 rsync 排除 `*.map` 防源码泄漏。

## 部署（push main 即发布）

- **生产服务器**：阿里云 47.115.147.221（cn-shenzhen，2C2G），代码在 `/home/lingoforge`，**不是 git 仓库**。**唯一部署方式：push 到 main 触发 `.github/workflows/deploy.yml`**（lint → test → build → 硬链接快照备份 → rsync --delete → pm2 reload lingoforge）。不要在服务器上 `git pull`。
- 回滚：`ssh root@47.115.147.221` 后 `rm -rf /home/lingoforge && cp -al /home/lingoforge.bak /home/lingoforge && pm2 reload lingoforge`。
- **Vercel** 绑定 GitHub 自动构建；国内访问被墙，`curl` 返回 000 不是部署故障，验证只看 Vercel 控制台。
- HTTPS 证书 acme.sh 自动续期（cron 每 6 小时），无需手动管。
- 老实例 120.76.228.235 已于 2026-08-19 下线，无任何残留依赖。

## 生产数据库与线上排障

- MySQL 凭证在服务器 `/home/lingoforge/.env.local`（dotenv 加载，**pm2 environ 查不到**）；连 mysql 前先 `source /home/lingoforge/.env.local`。
- SSH 走 `ssh root@47.115.147.221`（复用 `~/.ssh/lingoforge_key.pem`）。
- 线上前端报错会 `POST /api/client-error`；排障在 `pm2 logs` 里 grep 接口/错误串。

## 红线（必须遵守）

- **打乱词库**：只能 shuffle `words` 数组的**顺序**，不得改动任何字段内容和 JSON 结构。
- **移动端开发**：不要修改、重构、抽离**桌面端**组件代码。
- **私钥/密钥**：绝不贴进对话或写进磁盘文件；`.env*` 已 gitignore，提交前检查暂存区无密钥。
- **清理后台进程**：禁用 `taskkill /IM node.exe`（会误杀 dev server），按 PID 用 PowerShell `Stop-Process -Id <PID>` 精准清理。

## Git 约定

- husky + lint-staged：提交时自动对暂存文件跑 eslint --fix + prettier；commitlint 强制 conventional commits（`feat:` / `fix:` / `docs:` / `chore:` / `ci:` / `test:` / `refactor:`）。
