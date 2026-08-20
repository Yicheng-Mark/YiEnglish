# typing-word

英语多模块学习平台（含单词打字练习等模块）。前端 Vite + React，后端 Node，数据库 MySQL。

## 本地开发

- **数据库**：MySQL80 须先**以管理员权限启动**（服务或手动提权），否则后端起不来。
- **一键启动**：`npm run dev:all` —— 同时起前端（Vite，端口 **5173**）和后端（端口 **3001**）。
- 单独前端：`npm run dev`（5173）。

## 部署

- **生产服务器（阿里云 47.115.147.221，cn-shenzhen，2C2G，Alibaba Cloud Linux 3）**：代码在 `/home/lingoforge`，**不是 git 仓库**。**部署方式：push 到 main 自动触发 GitHub Actions**（lint/test/build → rsync → pm2 reload，见 `.github/workflows/deploy.yml`；SSH 密钥在 secret `ALIYUN_KEY`）。不要在服务器上 `git pull`。
- **HTTPS 证书**：acme.sh 自动续期（cron 每 6 小时），正常情况无需手动管。
- **老实例 120.76.228.235**：2026-08-19 完成迁移切换，08-20 实测 SSH/HTTP 全不可达（已下线），不再有任何依赖。
- **Vercel**：绑定了 GitHub，push 自动构建。
- **国内访问 Vercel 域名被墙**（GFW DNS 污染 + RST）：国内 `curl` 必返回 HTTP 000，**这不是部署故障**。验证 Vercel 部署状态只能看 **Vercel 控制台**，别用国内网络请求判断成败。

## 生产数据库访问

- MySQL 凭证在服务器的 `/home/lingoforge/.env.local`（由 dotenv 加载，**pm2 environ 查不到**）。
- 连 mysql 前必须先 `source /home/lingoforge/.env.local` 注入凭证，再连。
- 连服务器走 ssh 别名：`ssh root@47.115.147.221`（复用 `~/.ssh/lingoforge_key.pem`）。

## 客户端错误上报

线上前端报错会 `POST /api/client-error` 上报到后端。排查线上问题：`pm2 logs` 里 grep 对应接口/错误串即可看到。

## 红线（必须遵守）

- **打乱词库**：只能 shuffle `words` 数组的**顺序**，**不得**改动任何字段内容和 JSON 结构。
- **移动端开发**：不要修改、重构、抽离**桌面端**组件代码。
- **私钥**：绝不贴进对话或写进磁盘文件。
- **清理后台进程**：禁用 `taskkill /IM node.exe`（会误杀用户的 dev server），按 **PID** 用 PowerShell `Stop-Process -Id <PID>` 精准清理。
