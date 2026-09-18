# Yi English（仓库目录 typing-word）

英语学习闭环平台：单词打字训练为核心，环绕语料视频、阅读、复习测验、AI 助手等模块。前端 Vite + React 18（纯 JSX，无 TS），后端 Express 5（CommonJS）+ MySQL 8，测试 Vitest。产品介绍见 README.md。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `npm run dev:all` | 前端(5173) + 后端(3001) 同时起，Vite 已代理 `/api` → 3001 |
| `npm run test:run` | Vitest 单次全量（CI 用这个；`npm test` 是 watch 模式） |
| `npm run lint` / `lint:fix` | ESLint |
| `npm run build` | 生产构建 |
| `npm run dict:check` | 词库清洗 + 校验 + 重建合并索引（改 `public/dictionaries/*.json` 后必跑） |

## 本地开发前置

- **MySQL80 必须先以管理员权限启动**（服务或手动提权），否则后端起不来。
- 根目录 `.env.local`（不进 git）由后端 dotenv 加载：`DB_*`、`JWT_SECRET`、`DEEPSEEK_API_KEY` 等，完整清单见 `server/config.js`。
- env 加载顺序（`server/config.js`）：优先 `server/.env`（服务端密钥独占，推荐新变量放这里），不存在则回退根 `.env.local`（历史布局，本地开发前后端变量混放）；已存在的环境变量优先于文件。生产机继续用 `/home/lingoforge/.env.local`（rsync 排除不覆盖）。**给前端用的变量必须带 `VITE_` 前缀且不得是密钥**（`VITE_` 变量会被打进浏览器 bundle）。
- 建库用 `server/sql/schema.sql`；`migrate_*.sql` 在后端启动时自动按文件名序执行（`schema_migrations` 表记版本，失败文件多轮重试解决依赖倒挂、失败不中止启动、下次自动重试）。2026-09-17 起 `migrate_auth_v1.sql` 提供基础 users 表，迁移链可从全空库自举（建空库后直接起服务即可收敛），schema.sql 仍是文档化的标准建库路径。SQL 切分器在 `server/utils/splitSqlStatements.js`（纯函数，有测试）。

## 架构速览

- `src/` React 前端：`pages/` 路由页（Typing / ReviewQuiz / Stats / WordBooks 等）；`modules/` 功能模块（corpus 语料视频、grammar、reading、learning-methods）；`hooks/`（useTyping / useQuiz 等）；`contexts/`（Auth）；`lib/`（api 封装）；`utils/` 纯函数工具，多数有配套 `.test.js`
- `server/` Express 后端：根 package.json 是 `type:module`，server 自带 `{"type":"commonjs"}`——后端代码用 require。`routes/`（auth / progress / review / wordbooks / settings / demo / clientError 等，均有测试）、`middleware/`（JWT auth、rateLimit）
- `public/dictionaries/*.json` 词库数据（按需 fetch 不进 bundle）+ `public/dictionaries/word-index.json` 全库去重合并索引（`npm run dict:index` 生成，语料/阅读/搜词的唯一数据源，加载失败回退逐册拉取）+ `src/dictionaries/meta.js` 元信息注册（含功能词本虚拟词库）；`standards/` 原始标准词表；`scripts/*.mjs` 词库维护与语料处理脚本
- `deploy/` pm2 ecosystem（cluster `instances: 1` 单进程）、nginx.conf

## 功能地图

学习闭环：输入(打字) → 规则(语法) → 记忆(SM-2+错题本) → 训练(听写/复习/词本) → 应用(阅读+语料) → 反馈(统计)。

- **打字训练（核心）**：`/typing/:dictId/:chapterId` → `pages/Typing` + `hooks/useTyping*`；音效纯 Web Audio 合成（`utils/audioContext.js`，无音频文件）；错词自动分类入错题本
- **词库**：固定 25 词/章（`meta.js` CHAPTER_SIZE）；`*freq.json` 高频变体由 `scripts/gen-freq-dicts.mjs` 生成；词库清单以 `src/dictionaries/meta.js` 为准
- **五大功能词本（闭环载体）**：错题本 / 阅读词本 / 语料词本 / 收藏词本 / 复习计划（SM-2，`utils/reviewCards.js`）。在 `meta.js` 以 `error-book` 等虚拟 id 注册为「功能词本」，与普通词库走同一套打字/复习流程
- **阅读**：`/read` → `modules/reading`，词形还原 `utils/wordLookup.js`；**语料**：`/listening` → `modules/corpus`，8 种字幕模式在 `components/subtitleModes/`，视频托管阿里云 OSS `videos.lingoforge.fun`（H.264 + faststart，iOS Safari 内嵌播放的前提，别改格式）
- **语法 / 学习方法**：纯静态数据 `src/data/*.json`
- **复习**：`/review/setup/:bookId`、`/review/quiz/:bookId`
- **AI 助手**：已于 2026-09-11 整体归档（先于 09-04 因 DeepSeek key 无额度下线入口）。全部模块文件（前端悬浮球/页面/ai-settings/chat-engine + 后端 chat|style|memory 路由与 services）在 `D:\AI助手归档`，恢复指南见其 README.md；DB 表与 schema.sql 未动

## 数据与同步

- 本地双存储：localStorage + IndexedDB（库 `lingoforge` v2，7 个 store 见 `utils/idb.js`）；启动空闲时自动跑 localStorage → IDB 迁移。
- **词本类 util 统一模式**：内存缓存为唯一数据源，2s debounce 落盘（localStorage 全量 + IDB 增量 put 合并刷盘）；`writeStorageNow` 必须带 `_cache === null` 守卫（登出断开后 pagehide 兜底不得把 null 写回——否则 localStorage 是唯一 bootstrap 源，等于清空用户数据）+ `persistDirty` 脏标记（无变更时 pagehide 跳过写）。2026-09-18 起六个词本 util 已全部对齐，照任一文件写法即可，别每词一次全量 stringify。数据量涨到单键 stringify 明显卡顿（>1MB 量级）再考虑按词库分 key，当前规模不值得迁移成本。
- 登录后跨设备同步：`hooks/useProgressSync` + `server/routes/progress|favorites|review`；登录/会话恢复成功时并行下拉五大功能词本（`syncWordBooksFromServer`，覆盖式）与用户设置。
- 体验账号：isTrial 锁定 `/demo` 沙箱、语料仅 1–5 期（`TrialGuard` + `server/middleware/requireFullAccount`）；统计口径一律排除 `is_guest=1`。

## 测试约定

- Vitest 默认 node 环境；`vitest.config.js` 故意独立于 `vite.config.js`，DOM 测试在文件顶部加 `// @vitest-environment jsdom`；esbuild jsx automatic 已配，.jsx 测试无需 import React。
- 改 `src/utils/` 或 `server/` 逻辑时同步维护对应 `.test.js`。
- 链路回归测试：把已修 bug 编码为用例时，用 `git show <fix-commit>^:<file>` 对照旧代码推演「旧逻辑下该断言必失败」，关键修复在旧代码 worktree 里实跑验证；计时/日期类用例的时钟每用例只取一次或 `vi.setSystemTime` 钉死（二次取真实时钟会引进跨天窗口，见 useReadingStore 教训）。

## 构建注意

- 构建目标 es2020 + `@vitejs/plugin-legacy`（Safari 14–15.3 白屏修复的关键开关，modernPolyfills 勿关；现为显式 13 项 core-js 列表而非全量 true，新增现代 API 时同步补列表）。
- 生产构建剥离 console.log/debug/info/trace、保留 warn/error；sourcemap 为 hidden，部署 rsync 排除 `*.map` 防源码泄漏。

## 部署（push main 即发布）

- **生产服务器**：阿里云 47.115.147.221（cn-shenzhen，2C2G），代码在 `/home/lingoforge`，**不是 git 仓库**。**唯一部署方式：push 到 main 触发 `.github/workflows/deploy.yml`**（lint → test → build → 硬链接快照备份 → rsync --delete → pm2 reload lingoforge）。不要在服务器上 `git pull`。
- 回滚：`ssh root@47.115.147.221` 后 `rm -rf /home/lingoforge && cp -al /home/lingoforge.bak /home/lingoforge && pm2 reload lingoforge`。
- **Vercel** 绑定 GitHub 自动构建；国内访问被墙，`curl` 返回 000 不是部署故障，验证只看 Vercel 控制台。
- HTTPS 证书 acme.sh 自动续期（cron 每 6 小时），无需手动管。
- 老实例 120.76.228.235 已于 2026-08-19 下线，无任何残留依赖。

## 生产数据库与线上排障

- **应用连库走专用低权账号**（2026-09-17 起）：`lingoforge_app`@localhost/127.0.0.1，仅 `lingoforge` 库的 SELECT/INSERT/UPDATE/DELETE/CREATE/DROP/ALTER/INDEX/REFERENCES，凭证在服务器 `/home/lingoforge/.env.local`（dotenv 加载，**pm2 environ 查不到**）。**管理 SQL（提管理员/重置 TOTP 等）走 root**：凭证在 `/root/.my.cnf`（chmod 600），ssh 后直接 `mysql` 即可，不再 source `.env.local`。切换前的 root 凭证备份在服务器 `.env.local.bak-20260917`（含旧 JWT_SECRET，稳定运行数日后可删）。
- SSH 走 `ssh root@47.115.147.221`（复用 `~/.ssh/lingoforge_key.pem`）。
- 线上前端报错会 `POST /api/client-error`；排障在 `pm2 logs` 里 grep 接口/错误串。

### 管理后台（/admin，2026-09-17 上线）

- 前端 `/admin` 四 Tab：用户（列表/筛选「7 天内到期·已到期」/搜索/续期/设备上限）、激活码（生成永久·月·季·年卡/停用/发放备注）、审计（`admin_audit_log` 全量操作记录）、安全（管理员 TOTP 两步验证开关）。入口在个人中心，仅 `user.isAdmin` 可见。
- 鉴权：`users.is_admin` 字段（手工 SQL 提升：`UPDATE users SET is_admin = 1 WHERE username = 'xxx';`）+ `middleware/requireAdmin.js` 每请求查库（不嵌 JWT，收回即时生效）；非 admin 统一 404 防探测。
- **管理员两步验证（TOTP，2026-09-17）**：`users.totp_secret`（AES-256-GCM 加密，key 由 JWT_SECRET 派生，NULL=未启用）；启用后 login 与 recover-reset 都需 6 位动态验证码（`server/utils/totp.js`，RFC 6238，零依赖）。后台「安全」Tab 自助开/关（关闭需出示当前验证码）。**验证器丢失的解锁方式**：`UPDATE users SET totp_secret = NULL WHERE username = 'xxx';`；**轮换 JWT_SECRET 会使存量密钥不可解密**（等同验证失败），同样用该 SQL 重置。相关迁移 `migrate_admin_totp.sql`。2026-09-17 曾因 JWT_SECRET 轮换重置过一次（zyc 需在后台重新启用）。
- **找回密码双要素（2026-09-17）**：`recover-lookup` 只回打码用户名（`usernameMasked`），`recover-reset` 需 激活码 + 当前用户名 匹配才能重置（可选改用户名）——仅凭激活码不再能接管关联账号。
- 生成码形如 `lf-XXXXXXXXXXXX`（去易混淆字符）；激活码发放追踪靠 `experience_codes.issued_note`。
- 过期访客自动清理：`utils/cleanupGuests.js`（试用到期超 30 天整行删，FK 全 CASCADE），随启动挂 24h 定时器。
- 计数对齐工具：`node scripts/align-code-usage.mjs`（dry-run / `--apply`），修 `current_uses` 与事实表漂移。
- 相关迁移：`migrate_admin_backoffice.sql`、`migrate_admin_totp.sql`。

### 词库数据服务端门禁（2026-09-17）

- 词库 JSON 与合并索引不再静态直出：前端统一走 `GET /api/dictionaries/:file`（`server/routes/content.js`，认证必需）——匿名 401、体验用户拿「前 5 章裁剪词典 + 体验版索引」、正式账号拿全量。取用点：`loadDictionary.js` / `dictWordMap.js`（经 `lib/api.js` 的 `fetchWithAuth`，自带 401 静默刷新重试）。
- 体验版索引 `word-index-trial.json` 由 `scripts/gen-word-index.mjs` 与全量索引一并产出：前 5 章词汇 ∪ 体验期语料（1–5 期）字幕词汇 ∪ 体验阅读文章词汇——保证体验期取词弹窗不受裁剪影响。改词典/字幕后跑 `npm run dict:check` 同步两个索引。
- 缓存策略：`Cache-Control: private, no-cache` + ETag 协商（304 免传输但不允许跨身份本地复用）。
- **部署顺序（重要）**：先 push 部署前后端（前端已改从 `/api/dictionaries` 取数），再到生产 nginx 加 `location /dictionaries/ { return 404; }` 并 reload（deploy/nginx.conf 已含该段及说明）——先封 nginx 后部署会断掉线上词库加载。
- 边界（未做，属 OSS 侧操作）：语料视频仍是 OSS 公网直链（元数据随前端 bundle 下发），彻底收紧需 OSS 私有读 + 服务端签名 URL；字幕与阅读文章同理为静态/打包资源。

### 用户级设备登录上限（users.max_devices）

- 语义：`NULL`=跟随全局默认（env `MAX_DEVICES_PER_USER`，默认 2）；`0`=不限台数；`>0`=该账号精确上限。全局 env 同样支持 `0`=不限。
- 设置入口：管理后台 `/admin`（用户 Tab → 设备上限）或手工 SQL：`UPDATE users SET max_devices = 3 WHERE username = 'xxx';`（设回 `NULL` 恢复全局默认）。
- 调低上限不会立刻踢人：每次 token 轮换时服务端按 `last_active_at` 驱逐**最旧的超额他台**（约 30 分钟内逐台收敛），被驱逐设备下次 refresh 收到 401「请先登录」+ 清 cookie（普通登出语义）；403 `DEVICE_LIMIT_REACHED` 只出现在登录路径拦新设备。
- `TRUST_PROXY` env（默认 1）控制 `app.set('trust proxy')`；IP 限流的安全性依赖 nginx 前置，若 3001 端口直接暴露须设 0。
- 相关迁移：`migrate_user_device_limit.sql`（加列）、`migrate_refresh_device_unique.sql`（(user_id, device_id) 唯一键 + 清理 device_id='' 历史行）。启动时自动执行；若登录报 `ER_BAD_FIELD_ERROR: max_devices` 说明迁移未跑成，查 `SELECT * FROM schema_migrations` 确认。

### 账号订阅到期（users.subscription_expires_at，月/季/年卡）

- activation 激活码用 `trial_hours` 携带时长：`0`/`NULL`=永久（存量 77 个旧码已统一归 0），`720`=月卡 30 天、`2160`=季卡 90 天、`8760`=年卡 365 天；注册时写入 `users.subscription_expires_at`（`NULL`=永久，存量账号全是 NULL 不受影响）。
- 到期三道闸：middleware 每请求比对 access token 内嵌 `subExp`（零窗口，到期即 401 `SUBSCRIPTION_EXPIRED`）+ login 查库拒签发 + refresh 查库清 cookie；前端 `api.js` 收到该 code 会 toast「账号已到期」并登出。
- **续期**：管理后台 `/admin`（用户 Tab → 续期，基准取 `GREATEST(NOW(), 当前到期)`，未到期续期不吃亏）或手工 SQL：`UPDATE users SET subscription_expires_at = DATE_ADD(NOW(), INTERVAL 30 DAY) WHERE id = 用户id;`（设 `NULL` 即转永久）；续期后用户下次 refresh 拿到新 subExp 自动恢复，无需重启。
- 2026-09-16 已生成并入库：月卡 200 / 季卡 100 / 年卡 100（链接按档位备份在用户桌面「账号链接-20260916」）。注册链接形态：`https://www.lingoforge.fun/activate/<code>`。
- **`/api/demo/upgrade` 体验转正端点已于 2026-09-16 关闭（410）**：原实现把访客直接转成永久正式账号，绕过激活码档位体系；前端升级按钮 2026-06 已移除，无正常入口。体验用户走 `/activate/<code>` 开通。
- 相关迁移：`migrate_subscription_expire.sql`。

## 红线（必须遵守）

- **打乱词库**：只能 shuffle `words` 数组的**顺序**，不得改动任何字段内容和 JSON 结构。
- **移动端开发**：不要修改、重构、抽离**桌面端**组件代码。
- **私钥/密钥**：绝不贴进对话或写进磁盘文件；`.env*` 已 gitignore，提交前检查暂存区无密钥。
- **清理后台进程**：禁用 `taskkill /IM node.exe`（会误杀 dev server），按 PID 用 PowerShell `Stop-Process -Id <PID>` 精准清理。

## Git 约定

- husky + lint-staged：提交时自动对暂存文件跑 eslint --fix + prettier；commitlint 强制 conventional commits（`feat:` / `fix:` / `docs:` / `chore:` / `ci:` / `test:` / `refactor:`）。
