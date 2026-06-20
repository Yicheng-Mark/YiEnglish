import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DICTS_DIR = path.join(__dirname, '..', 'src', 'dictionaries')
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'validation-report.json')

function getWords(data) {
  const words = []
  if (data.chapters) {
    for (const chapter of data.chapters) {
      if (chapter.words) {
        let idx = 0
        for (const word of chapter.words) {
          words.push({ ...word, _chapterId: chapter.id, _index: idx++ })
        }
      }
    }
  }
  return words
}

function validateFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  const words = getWords(data)

  const errors = []
  const nameMap = new Map() // name -> [{chapter, index}]

  words.forEach((item, _globalIndex) => {
    const pos = `章节${item._chapterId} 第 ${item._index + 1} 条`

    // 1. 必填字段检查
    if (!item.name || typeof item.name !== 'string' || item.name.trim() === '') {
      errors.push({ pos, type: 'missing_name', message: '缺少 name 字段或为空' })
    }

    const hasTrans =
      item.trans &&
      ((typeof item.trans === 'string' && item.trans.trim() !== '') ||
        (Array.isArray(item.trans) &&
          item.trans.length > 0 &&
          item.trans.some((t) => t && t.trim && t.trim() !== '')))
    if (!hasTrans) {
      errors.push({ pos, type: 'missing_trans', message: '缺少 trans 字段或为空', name: item.name })
    }

    const hasPhone =
      (item.uk && String(item.uk).trim() !== '') ||
      (item.us && String(item.us).trim() !== '') ||
      (item.ukphone && String(item.ukphone).trim() !== '') ||
      (item.usphone && String(item.usphone).trim() !== '')
    if (!hasPhone) {
      errors.push({
        pos,
        type: 'missing_phone',
        message: '缺少音标 (uk/us/ukphone/usphone)',
        name: item.name,
      })
    }

    // 2. 词库内查重（不区分大小写）
    if (item.name) {
      const key = item.name.toLowerCase().trim()
      if (!nameMap.has(key)) nameMap.set(key, [])
      nameMap.get(key).push({ chapter: item._chapterId, index: item._index + 1 })
    }
  })

  const duplicates = []
  for (const [name, locations] of nameMap.entries()) {
    if (locations.length > 1) {
      duplicates.push({ name, count: locations.length, positions: locations })
    }
  }

  return {
    total: words.length,
    errors,
    duplicates,
    hasIssues: errors.length > 0 || duplicates.length > 0,
  }
}

function traverse(dir, callback) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      traverse(fullPath, callback)
    } else if (entry.name.endsWith('.json')) {
      callback(fullPath)
    }
  }
}

if (!fs.existsSync(path.dirname(REPORT_PATH))) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
}

const report = {
  timestamp: new Date().toISOString(),
  summary: { totalFiles: 0, totalErrors: 0, totalDuplicates: 0, cleanFiles: 0 },
  files: [],
  crossDictDuplicates: [],
}

const allWords = new Map() // name -> Set of files

traverse(DICTS_DIR, (filePath) => {
  const relativePath = path.relative(process.cwd(), filePath)
  try {
    const result = validateFile(filePath)

    // 收集跨词库重复数据
    const content = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(content)
    const words = getWords(data)
    words.forEach((item) => {
      if (item.name) {
        const key = item.name.toLowerCase().trim()
        if (!allWords.has(key)) allWords.set(key, new Set())
        allWords.get(key).add(relativePath)
      }
    })

    report.summary.totalFiles++
    report.summary.totalErrors += result.errors.length
    report.summary.totalDuplicates += result.duplicates.length
    if (!result.hasIssues) report.summary.cleanFiles++

    report.files.push({
      file: relativePath,
      totalWords: result.total,
      errorCount: result.errors.length,
      duplicateCount: result.duplicates.length,
      errors: result.errors.slice(0, 10),
      duplicates: result.duplicates,
    })

    const icon = result.hasIssues ? '⚠️' : '✅'
    console.log(
      `${icon} ${relativePath} | ${result.total} 词 | ${result.errors.length} 错误 | ${result.duplicates.length} 重复`
    )
  } catch (err) {
    report.summary.totalFiles++
    report.files.push({ file: relativePath, error: err.message, status: 'error' })
    console.error(`❌ ${relativePath}: ${err.message}`)
  }
})

// 跨词库重复：出现在 2 个及以上词库中的单词
const crossDups = []
for (const [name, files] of allWords.entries()) {
  if (files.size > 1) {
    crossDups.push({ name, fileCount: files.size, files: Array.from(files) })
  }
}
report.crossDictDuplicates = crossDups.sort((a, b) => b.fileCount - a.fileCount)

fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
console.log(`\n📄 报告已保存: ${REPORT_PATH}`)
console.log(
  `\n汇总: ${report.summary.totalFiles} 个文件 | ${report.summary.totalErrors} 个错误 | ${report.summary.totalDuplicates} 个重复 | ${crossDups.length} 个跨词库重复单词`
)
