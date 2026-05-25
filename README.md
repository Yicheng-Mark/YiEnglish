<h1 align="center">Nothing is impossible.</h1>

<p align="center">
  <b>面向中国学习者的英语学习平台</b><br/>
  <sub>打字背词 · 分级阅读 · 视频语料 · 语法体系 · AI 助手 · 科学方法</sub>
</p>

<p align="center">
  <a href="https://www.lingoforge.fun/">🌐 线上体验</a> ·
  <a href="#-功能一览">功能一览</a> ·
  <a href="#-技术栈">技术栈</a> ·
  <a href="#-本地运行">本地运行</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-blue" alt="React 18" />
  <img src="https://img.shields.io/badge/Vite-5-purple" alt="Vite 5" />
  <img src="https://img.shields.io/badge/TailwindCSS-3-cyan" alt="TailwindCSS 3" />
  <img src="https://img.shields.io/badge/Express-5-green" alt="Express 5" />
  <img src="https://img.shields.io/badge/MySQL-8.0-orange" alt="MySQL" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License" />
</p>

---

## ✨ 产品定位

这是一个面向中国学习者的英语学习平台，覆盖从单词输入到语法理解再到 AI 辅助的完整学习链路。通过打字练习建立肌肉记忆，在真实语料中接触活的英语，用 AI 助手随时解答疑问。

---

## 🚀 功能一览

### 📝 打字背单词
- **21 本精准词库**：中高考、CET-4/6、CET-4/6 高频、考研、雅思、托福、SAT、专四专八，以及 6 类专业英语（程序员、航海、商务、汽修、厨师、电工）
- **科学分章记忆**：每章 25 词，学习负担可控
- **沉浸式打字练习**：边打边记，肌肉记忆 + 视觉记忆双通道，机械键盘音效反馈
- **下一词预览**：右上角实时预览，提前准备拼写
- **错词自动收录**：拼写错误自动进入错题本
- **收藏与分类**：支持词汇收藏和词库收藏，数据跨设备同步
- **跨词库搜词**：全局搜索，点击直达对应词库章节

### 📖 分级阅读
- 分级文章列表 + 沉浸式文章详情阅读
- 点击查词，即点即查，不打断阅读节奏
- 生词一键收藏至阅读词本，可在打字模块中专项练习
- 分类、年份、搜索、收藏筛选

### 🎬 语料中心
- 视频 + 字幕双视图，在真实语境中学英语
- **8 种字幕模式**：中英双语 · 纯中文 · 纯英文 · 完形填空 · 听写模式 · 阅读模式 · 中英互译 · 词汇卡片
- **键盘快捷键**：`空格` 暂停 / `←→` 前后跳转 5 秒 / `↑↓` 切换字幕 / `L` 切换循环
- 字幕点词即查，收藏至语料词本

### 📐 语法模块
- **三阶进阶体系**：词性 → 时态 → 长难句分析，由词到句逐步构建语法框架
- **词性学习**：系统掌握八大词性，理解句子组成逻辑
- **时态学习**：16 种时态体系化讲解
- **长难句拆解**：从复合句到复杂句，层层拆分

### 💡 科学学习方法
- 基于认知科学研究的 6 大高效学习法，按证据等级分级
- **科学方法 vs 低效方法**对比数据
- **每日 15-20 分钟科学记忆流程**，提供最小有效剂量的学习计划

### 🤖 AI 助手
- **流式对话**：基于 DeepSeek API，SSE 实时流式回复，支持深度推理内容展示
- **悬浮聊天按钮**：可拖拽悬浮入口，随时唤起 AI 对话
- **语音输入**：Web Speech API 中文语音识别
- **长期记忆**：自动提取用户偏好与学习上下文，跨会话保持连贯
- **可切换人设**：严肃 / 活泼 / 温柔 / 自定义 4 种风格，自定义支持配置名称、性别和提示词
- **专属页面**：支持从悬浮窗展开至全屏 AI 对话页

### 👥 用户系统
- **邮箱注册 / 登录**：验证码邮件验证，JWT + HttpOnly Cookie 双重鉴权
- **密码重置**：邮箱验证码重置
- **跨设备进度同步**：词库学习进度、词本数据、收藏状态服务端持久化
- **个人资料管理**：昵称、签名、头像、每日学习目标可编辑

### 📊 数据统计
- 模块化计时统计：打字 / 阅读 / 语料独立计时
- 月度学习日历热力图
- 最近 7 天学习节奏图表
- 实时 WPM、正确率、输入数追踪

### 👤 个人中心
- 四类个人词本：错题本 · 阅读词本 · 语料词本 · 收藏词本，全部可作为词库进入打字训练
- 间隔重复复习（SM-2 算法），根据记忆曲线智能安排复习
- 四套主题：浅色 · 曜黑 · 星空 · 暖米，毛玻璃质感 UI
- 移动端优先响应式设计，底部导航适配触屏操作

---

## 🛠 技术栈

| 层级 | 技术选型 |
|:---|:---|
| 前端框架 | React 18 + Vite 5 |
| 样式方案 | Tailwind CSS 3 + CSS 变量主题系统 |
| 路由 | React Router 6 |
| 状态管理 | React Hooks + Context |
| 虚拟列表 | @tanstack/react-virtual |
| 图表 | Recharts |
| 图标 | Lucide React |
| 通知 | Sonner |
| 后端框架 | Express 5 |
| 数据库 | MySQL (mysql2) |
| 认证 | JWT + bcryptjs + HttpOnly Cookie |
| 邮件服务 | Resend |
| AI 服务 | DeepSeek API (SSE 流式) |
| 语音识别 | Web Speech API |
| 部署 | Vercel（前端）+ 独立服务器（后端） |
| 数据 | JSON 静态词库（21 本词书，已清洗去重） |

---

## 📚 词库数据

通用词库来源于开源项目 [qwerty-learner](https://github.com/RealKai42/qwerty-learner) 及公开考试大纲，经以下处理：
- 清洗去重，保证词库纯净
- 按 **25 词/章** 强制切分，控制单次学习负荷
- CET-4/6 高频词库提供考试高频精选词汇，与完整 CET-4/6 词库互补
- **专业英语**（航海 / 商务 / 汽修 / 厨师 / 电工）词库由项目自建，基于行业标准用语和官方词表整理

---

## 🚀 本地运行

```bash
# 克隆项目
git clone https://github.com/zhang12120113-creator/typing-word.git
cd typing-word

# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..

# 配置环境变量（参考 .env.example 填写）
cp .env.example .env.local

# 启动前端开发服务器
npm run dev
```

**后端配置说明：**

1. 需要本地 MySQL 服务，导入 `server/sql/schema.sql` 和 `server/sql/seed.sql`
2. AI 助手需配置 `DEEPSEEK_API_KEY`
3. 邮件服务需配置 `RESEND_API_KEY`
4. 启动后端：`cd server && npm run dev`

---

## 👤 关于作者

**小月** —— 独立开发者，构建了面向中国学习者的英语学习平台。
如果你也认同"学英语不是背单词，而是在真实语境中建立完整的输入-理解-反馈链路"，欢迎 Star ⭐

---

## 📄 License

MIT © 2026 小月
