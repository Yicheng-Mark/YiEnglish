/**
 * 语料视频逐个体检：编解码（AV1 / H.264 / HEVC）+ moov 位置（前/后）+ 当前 Content-Disposition。
 * 用于确认哪些视频在 iPhone 上播不了、需要转码。
 *
 * 运行（无凭证需要，只读公开 OSS）：
 *   node scripts/inspect-corpus-codecs.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const OSS = 'https://lingoforge-videos.oss-cn-shenzhen.aliyuncs.com'
const DATA_FILE = path.resolve('src/modules/corpus/data/mockCorpusVideos.js')
const HEAD_BYTES = 2_000_000 // 头部 2MB，moov 在前的视频足够定位 codec
const TAIL_BYTES = 512_000 // 头部没找到 codec 时再抓尾部 512KB（moov 在后的情况）

// 从数据文件里提取所有 videoUrl（`${OSS}/xxx.mp4` 形式）
const src = fs.readFileSync(DATA_FILE, 'utf8')
const idMatches = [...src.matchAll(/id:\s*'(\d+)'/g)]
const urlMatches = [...src.matchAll(/videoUrl:\s*`\$\{OSS\}([^`]+)`/g)]
const items = urlMatches.map((m, i) => ({ id: idMatches[i]?.[1] || '?', path: m[1] }))

function detectCodec(buf) {
  if (buf.includes('av1C') || buf.includes(Buffer.from('av01'))) return 'AV1'
  if (buf.includes('avcC') || buf.includes(Buffer.from('avc1'))) return 'H.264'
  if (buf.includes('hvcC') || buf.includes('hev1') || buf.includes('hvc1')) return 'HEVC'
  return null
}

// 解析头部 chunk 里 moov 相对 mdat 的位置；moov 不在头部则返回 'tail?'
function moovPosition(headBuf) {
  let i = 0
  const n = headBuf.length
  let moovAt = -1
  let mdatAt = -1
  while (i + 8 <= n) {
    const size = headBuf.readUInt32BE(i)
    const typ = headBuf.subarray(i + 4, i + 8).toString('latin1')
    if (typ === 'moov') moovAt = i
    else if (typ === 'mdat') mdatAt = i
    let realSize = size
    if (size === 1 && i + 16 <= n) realSize = Number(headBuf.readBigUInt64BE(i + 8))
    if (realSize < 8) break
    i += realSize
  }
  if (moovAt >= 0 && (mdatAt < 0 || moovAt < mdatAt)) return 'front'
  return 'tail?'
}

async function fetchRange(url, start, end) {
  const headers = start != null ? { Range: `bytes=${start}-${end ?? ''}` } : undefined
  const res = await fetch(url, { headers })
  if (!res.ok && res.status !== 206) throw new Error(`HTTP ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

const results = []
for (const it of items) {
  const url = OSS + it.path
  let codec = null
  let moov = '?'
  let disp = '?'
  let size = '?'
  try {
    const headRes = await fetch(url, { method: 'HEAD' })
    disp = headRes.headers.get('content-disposition') || 'none'
    size = headRes.headers.get('content-length') || '?'

    const head = await fetchRange(url, 0, HEAD_BYTES - 1)
    codec = detectCodec(head)
    moov = moovPosition(head)
    if (!codec || moov === 'tail?') {
      const total = Number(size)
      if (total > 0) {
        const tail = await fetchRange(url, Math.max(0, total - TAIL_BYTES))
        codec = codec || detectCodec(tail)
        if (moov === 'tail?' && tail.includes(Buffer.from('moov'))) moov = 'tail'
      }
    }
  } catch (e) {
    codec = `ERR:${e.message}`
  }
  const playable = codec === 'H.264' || codec === 'HEVC' ? '✓' : codec === 'AV1' ? '✗(AV1)' : '?'
  results.push({ id: it.id, codec, moov, playable, disp: disp.includes('attachment') ? 'attachment!' : disp.slice(0, 8) })
  console.log(`Ep.${it.id.padStart(2)}  codec=${String(codec).padEnd(8)} moov=${String(moov).padEnd(6)} disp=${String(disp).padEnd(10)} ${playable}`)
}

const bad = results.filter((r) => r.codec === 'AV1')
const h264 = results.filter((r) => r.codec === 'H.264')
const hevc = results.filter((r) => r.codec === 'HEVC')
console.log('\n==== 汇总 ====')
console.log(`总数: ${results.length}  H.264: ${h264.length}  HEVC: ${hevc.length}  AV1(需转码): ${bad.length}`)
if (bad.length) {
  console.log(`AV1 期号: ${bad.map((r) => r.id).join(', ')}`)
}
const stillAttached = results.filter((r) => r.disp.startsWith('attach'))
console.log(`仍带 attachment 头: ${stillAttached.length}`)
