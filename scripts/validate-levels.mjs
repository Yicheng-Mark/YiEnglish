import fs from 'fs'
import path from 'path'
import https from 'https'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DICTS_DIR = path.join(__dirname, '..', 'src', 'dictionaries')
const STANDARDS_DIR = path.join(__dirname, '..', 'standards')
const REPORT_PATH = path.join(__dirname, '..', 'reports', 'level-compliance-report.json')

const STANDARD_SOURCES = {
  cet4: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET4_edited.txt',
  cet6: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_edited.txt',
  gaokao:
    'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/Highschool_edited.txt',
  zhongkao:
    'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E4%B8%AD%E8%80%83%E8%8B%B1%E8%AF%AD%E8%AF%8D%E6%B1%87%E8%A1%A8.txt',
  toefl: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/TOEFL.txt',
  postgraduate:
    'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/NPEE_Wordlist.txt',
  tem4: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E5%9B%9B%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87%E8%A1%A8.txt',
  tem8: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E8%8B%B1%E8%AF%AD%E4%B8%93%E4%B8%9A%E5%9B%9B%E5%85%AB%E7%BA%A7%E8%AF%8D%E6%B1%87%E8%A1%A8.txt',
  junior:
    'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E4%B8%AD%E8%80%83%E8%8B%B1%E8%AF%AD%E8%AF%8D%E6%B1%87%E8%A1%A8.txt',
  ielts: null,
  sat: null,
  senior:
    'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/%E5%8F%B0%E7%81%A3%E9%AB%98%E4%B8%AD%E8%8B%B1%E6%96%87%E5%8F%83%E8%80%83%E8%A9%9E%E5%BD%99%E8%A1%A8.txt',
  programmer: null,
  cet4freq: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET4_edited.txt',
  cet6freq: 'https://raw.githubusercontent.com/mahavivo/english-wordlists/master/CET6_edited.txt',
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          https
            .get(response.headers.location, (res2) => {
              if (res2.statusCode !== 200) {
                reject(new Error(`HTTP ${res2.statusCode}`))
                return
              }
              res2.pipe(file)
              file.on('finish', () => {
                file.close()
                resolve()
              })
            })
            .on('error', reject)
          return
        }
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`))
          return
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', reject)
  })
}

function downloadFromGitHubAPI(fileName, dest) {
  return new Promise((resolve, reject) => {
    const apiUrl = `https://api.github.com/repos/mahavivo/english-wordlists/contents/${encodeURIComponent(fileName)}`
    https
      .get(apiUrl, { headers: { 'User-Agent': 'typing-word-validator' } }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.content) {
              const decoded = Buffer.from(json.content.replace(/\n/g, ''), 'base64').toString(
                'utf-8'
              )
              fs.writeFileSync(dest, decoded)
              resolve()
            } else {
              reject(new Error(json.message || 'No content in API response'))
            }
          } catch (err) {
            reject(new Error(`Failed to parse API response: ${err.message}`))
          }
        })
      })
      .on('error', reject)
  })
}

async function ensureStandard(dictName) {
  const standardPath = path.join(STANDARDS_DIR, `${dictName}-standard.txt`)
  if (fs.existsSync(standardPath)) return standardPath

  const url = STANDARD_SOURCES[dictName]
  if (!url) return null

  try {
    if (!fs.existsSync(STANDARDS_DIR)) fs.mkdirSync(STANDARDS_DIR, { recursive: true })
    console.log(`⬇️ 尝试下载 ${dictName} 标准词汇表...`)
    await downloadFile(url, standardPath)
    console.log(`✅ 已下载: ${standardPath}`)
    return standardPath
  } catch (err) {
    console.error(`⚠️ 直接下载失败 ${dictName}: ${err.message}`)
    // Fallback to GitHub API
    try {
      const fileName = decodeURIComponent(url.split('/master/')[1])
      console.log(`   尝试通过 GitHub API 获取: ${fileName}...`)
      await downloadFromGitHubAPI(fileName, standardPath)
      console.log(`✅ GitHub API 下载成功: ${standardPath}`)
      return standardPath
    } catch (apiErr) {
      console.error(`❌ GitHub API 也失败 ${dictName}: ${apiErr.message}`)
      return null
    }
  }
}

function loadStandardWords(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8')
  return new Set(
    content
      .split('\n')
      .map((line) => {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) return ''
        // Extract first token (the word itself), before tab or first space
        const word = trimmed
          .split(/[\t\s]/)[0]
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '')
        return word
      })
      .filter((word) => word.length > 0)
  )
}

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

function getDictNameFromPath(filePath) {
  const relative = path.relative(DICTS_DIR, filePath)
  return relative.split(path.sep)[0].replace(/\.json$/, '')
}

function validateLevel(filePath, standardWords) {
  const content = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(content)
  const words = getWords(data)

  const suspicious = []
  const covered = new Set()

  words.forEach((item, index) => {
    if (!item.name) return
    const key = item.name.toLowerCase().trim()

    if (!standardWords.has(key)) {
      suspicious.push({ word: item.name, index: index + 1 })
    } else {
      covered.add(key)
    }
  })

  const missingInStandard = []
  for (const w of standardWords) {
    if (!covered.has(w)) missingInStandard.push(w)
  }

  return {
    total: words.length,
    suspicious,
    suspiciousCount: suspicious.length,
    missingInStandard: missingInStandard.slice(0, 50),
    missingCount: missingInStandard.length,
    coverage:
      standardWords.size === 0 ? '0.0' : ((covered.size / standardWords.size) * 100).toFixed(1),
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

async function main() {
  if (!fs.existsSync(path.dirname(REPORT_PATH))) {
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  }

  const report = {
    timestamp: new Date().toISOString(),
    summary: { checked: 0, skipped: 0, totalSuspicious: 0, totalMissing: 0 },
    files: [],
  }

  const dictGroups = new Map()
  traverse(DICTS_DIR, (filePath) => {
    const dictName = getDictNameFromPath(filePath)
    if (!dictGroups.has(dictName)) dictGroups.set(dictName, [])
    dictGroups.get(dictName).push(filePath)
  })

  for (const [dictName, files] of dictGroups.entries()) {
    console.log(`\n📚 检查词库级别: ${dictName} (${files.length} 个文件)`)

    const standardPath = await ensureStandard(dictName)
    if (!standardPath) {
      console.log(`⏭️ 跳过 ${dictName}: 无标准词汇表`)
      console.log(
        `   💡 如需检查，请手动准备文件: standards/${dictName}-standard.txt（每行一个单词）`
      )
      report.summary.skipped += files.length
      files.forEach((f) => {
        report.files.push({
          file: path.relative(process.cwd(), f),
          dictName,
          status: 'skipped',
          reason: '缺少标准词汇表',
        })
      })
      continue
    }

    const standardWords = loadStandardWords(standardPath)
    console.log(`   标准表基准: ${standardWords.size} 个单词`)

    let dictSuspicious = 0
    let dictMissing = 0

    for (const filePath of files) {
      const relativePath = path.relative(process.cwd(), filePath)
      const result = validateLevel(filePath, standardWords)
      dictSuspicious += result.suspiciousCount
      dictMissing += result.missingCount

      report.files.push({
        file: relativePath,
        dictName,
        status: 'checked',
        total: result.total,
        suspiciousCount: result.suspiciousCount,
        suspicious: result.suspicious.slice(0, 15),
        missingCount: result.missingCount,
        coverage: result.coverage + '%',
      })

      const icon = result.suspiciousCount === 0 ? '✅' : '⚠️'
      console.log(
        `   ${icon} ${path.basename(filePath)}: ${result.suspiciousCount} 个可疑 | 覆盖率 ${result.coverage}%`
      )
    }

    report.summary.checked += files.length
    report.summary.totalSuspicious += dictSuspicious
    report.summary.totalMissing += dictMissing
  }

  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))
  console.log(`\n📄 报告已保存: ${REPORT_PATH}`)
}

main().catch(console.error)
