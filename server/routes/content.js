// 词库数据下发（带认证与体验裁剪）：
// GET /api/dictionaries/:file —— file 为 <dictId>.json 或 word-index.json。
//
// 背景：词库 JSON 此前由 public/ 静态直出（nginx 直接服务 dist/dictionaries），
// 任何未登录访客都能整包拉走 25 部词典与全量合并索引。本路由把数据移到认证之后：
// - 匿名 → 401；正式账号 → 全量文件（字节级同旧静态文件，sendFile 流式 + ETag/304）；
// - 体验用户 → 词典裁剪为前 TRIAL_CHAPTER_COUNT 章、word-index 换发预生成的体验版
//   （word-index-trial.json，由 scripts/gen-word-index.mjs 一并产出：前 5 章词汇 ∪
//   体验期语料字幕词汇 ∪ 体验阅读文章词汇），与前端 TrialGuard/章节裁剪口径一致。
// 前端取用点（loadDictionary.js / dictWordMap.js）已切换到本路径；原 /dictionaries/
// 静态路径由 nginx 封死（deploy/nginx.conf），防绕过直取全量数据。
//
// 缓存：Cache-Control: private, no-cache —— 允许浏览器/ETag 协商缓存（304 免传输），
// 但禁止不经校验的本地复用：同一浏览器先后登录不同身份（如正式转体验）时，
// 缓存里的全量数据不能被体验会话直接复用。no-store 会连 304 都省不掉，不必。
const express = require('express')
const fs = require('fs')
const path = require('path')
const authMiddleware = require('../middleware/auth')

const router = express.Router()

// 与前端 Typing.jsx / ChapterSelect.jsx 的 TRIAL_CHAPTER_COUNT 同值同源（两处各自内联，
// 改章数时三处同步）。词典固定 25 词/章，前 5 章 = 125 词，即体验沙箱的打字内容边界
const TRIAL_CHAPTER_COUNT = 5

// 词库文件目录：dev 优先仓库 public/dictionaries，生产取 dist/dictionaries
// （vite build 把 public/* 复制进 dist；rsync 部署后两者内容一致）。
// 本文件位于 server/routes/，仓库根需回溯两层
function dictDir() {
  const fromPublic = path.resolve(__dirname, '../../public/dictionaries')
  if (fs.existsSync(fromPublic)) return fromPublic
  return path.resolve(__dirname, '../../dist/dictionaries')
}

// 文件名白名单：dictId（字母数字下划线）+ word-index(-trial)?.json，杜绝路径穿越
const FILE_RE = /^[A-Za-z0-9_-]{1,50}\.json$/
const TRIAL_INDEX_FILE = 'word-index-trial.json'
const FULL_INDEX_FILE = 'word-index.json'

// 体验版词典裁剪结果缓存：{ filename → Buffer }
// 访客只会命中少数几部词典，按文件懒加载；文件内容部署期内不变，无需失效逻辑
const trialCache = new Map()

function loadDictJson(dir, file) {
  return JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'))
}

function buildTrialDictBuffer(dir, file) {
  const cached = trialCache.get(file)
  if (cached) return cached
  const data = loadDictJson(dir, file)
  const sliced = {
    ...data,
    chapters: Array.isArray(data.chapters) ? data.chapters.slice(0, TRIAL_CHAPTER_COUNT) : [],
  }
  const buf = Buffer.from(JSON.stringify(sliced))
  trialCache.set(file, buf)
  return buf
}

router.get('/:file', authMiddleware, async (req, res, next) => {
  try {
    const file = req.params.file
    if (!FILE_RE.test(file)) {
      return res.status(404).json({ error: 'Not found' })
    }
    const dir = dictDir()

    // 访客的合并索引换发体验版；体验版缺失（未重新生成）时回退 404——
    // 前端 loadWordIndex 的 fallback 会退回逐册路径，每册仍是裁剪版，边界不破
    const effectiveFile = req.isGuest && file === FULL_INDEX_FILE ? TRIAL_INDEX_FILE : file
    const fullPath = path.join(dir, effectiveFile)
    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ error: 'Not found' })
    }
    res.set('Cache-Control', 'private, no-cache')

    if (req.isGuest && effectiveFile !== TRIAL_INDEX_FILE) {
      // 访客词库：裁剪后的 JSON（ETag 默认开启，304 协商照常）
      const buf = buildTrialDictBuffer(dir, effectiveFile)
      return res.type('application/json').send(buf)
    }
    // 正式账号全量 / 访客体验索引：流式 sendFile（自带 ETag/Last-Modified/304）
    return res.sendFile(fullPath, { dotfiles: 'deny' })
  } catch (err) {
    next(err)
  }
})

module.exports = router
