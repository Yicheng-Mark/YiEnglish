/**
 * 针对上次扫描因网络中断报 ERR 的期号重新探测编解码（小 chunk + 重试）。
 *   node scripts/reprobe-codecs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const OSS = 'https://lingoforge-videos.oss-cn-shenzhen.aliyuncs.com'
const DATA_FILE = path.resolve('src/modules/corpus/data/mockCorpusVideos.js')
const TARGET_IDS = new Set([
  '4',
  '6',
  '7',
  '11',
  '14',
  '17',
  '20',
  '21',
  '25',
  '26',
  '32',
  '35',
  '38',
  '40',
  '41',
  '49',
  '55',
  '57',
])

const src = fs.readFileSync(DATA_FILE, 'utf8')
const idMatches = [...src.matchAll(/id:\s*'(\d+)'/g)]
const urlMatches = [...src.matchAll(/videoUrl:\s*`\$\{OSS\}([^`]+)`/g)]
const items = urlMatches
  .map((m, i) => ({ id: idMatches[i]?.[1] || '?', path: m[1] }))
  .filter((it) => TARGET_IDS.has(it.id))

function detectCodec(buf) {
  if (buf.includes('av1C')) return 'AV1'
  if (buf.includes('avcC') || buf.includes(Buffer.from('avc1'))) return 'H.264'
  if (buf.includes('hvcC') || buf.includes('hev1')) return 'HEVC'
  return null
}

async function fetchRangeRetry(url, start, end, tries = 4) {
  for (let t = 0; t < tries; t++) {
    try {
      const res = await fetch(url, { headers: { Range: `bytes=${start}-${end}` } })
      if (res.ok || res.status === 206) return Buffer.from(await res.arrayBuffer())
    } catch {
      await new Promise((r) => setTimeout(r, 500 * (t + 1)))
    }
  }
  throw new Error('terminated')
}

const av1 = []
for (const it of items) {
  const url = OSS + it.path
  let codec = null
  try {
    const total = Number((await fetch(url, { method: 'HEAD' })).headers.get('content-length') || 0)
    const head = await fetchRangeRetry(url, 0, 262143) // 256KB head
    codec = detectCodec(head)
    if (!codec && total > 0) {
      const tail = await fetchRangeRetry(url, Math.max(0, total - 524288), total - 1)
      codec = detectCodec(tail)
    }
  } catch (e) {
    codec = `ERR:${e.message}`
  }
  console.log(`Ep.${it.id.padStart(2)}  codec=${codec}`)
  if (codec === 'AV1') av1.push(it.id)
}
console.log(`\n本轮 AV1: ${av1.join(', ') || '无'}`)
