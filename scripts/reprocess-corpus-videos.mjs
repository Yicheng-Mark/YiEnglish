/**
 * 语料视频终极修复：让每个视频在 iPhone 上都能播。
 *
 * 解决三个问题（一次性）：
 *   1. Content-Disposition: attachment → inline（iOS Safari 因 attachment 拒绝内嵌播放）
 *   2. AV1 编码 → H.264（AV1 仅 iPhone 15 Pro+ 能解码）
 *   3. moov 在文件尾 → faststart（移到文件头，iOS 流式起播更快更稳）
 *
 * 策略（自适应，能省则省）：
 *   - AV1 期号（1,2,3,4,5,6,8）：必须下载 → ffmpeg 重编码 H.264+faststart → 重传（inline）。
 *   - H.264 期号：先试 OSS 服务端 copy-to-self 改 inline（不下载/不重传，秒级）；改不动再下载 → ffmpeg 无损 remux+faststart → 重传（inline）。
 *   - 已是 inline 的：跳过。
 *
 * 用法（OSS 上传凭证从环境变量读，不贴聊天）：
 *   预览：    DRY_RUN=1 OSS_ACCESS_KEY_ID=xx OSS_ACCESS_KEY_SECRET=yy node scripts/reprocess-corpus-videos.mjs
 *   只做某些期：EPISODES=1,2,3 ...
 *   正式执行：去掉 DRY_RUN=1
 *
 * ⚠️ 正式执行会覆盖生产 OSS 上的视频对象（同 key 覆盖）。建议先 DRY_RUN 预览。
 */
import OSS from 'ali-oss'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const REGION = 'oss-cn-shenzhen'
const BUCKET = 'lingoforge-videos'
const OSS_BASE = `https://${BUCKET}.${REGION}.aliyuncs.com`
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const TMP_DIR = path.resolve('temp-corpus-reprocess')
const AV1_IDS = new Set(['1', '2', '3', '4', '5', '6', '8'])
const DRY_RUN = !!process.env.DRY_RUN
const ONLY = process.env.EPISODES ? new Set(process.env.EPISODES.split(',').map((s) => s.trim())) : null

const accessKeyId = process.env.OSS_ACCESS_KEY_ID
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
if (!accessKeyId || !accessKeySecret) {
  console.error('缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET。请在本地环境变量提供（不要贴聊天）。')
  process.exit(1)
}

const client = new OSS({ region: REGION, accessKeyId, accessKeySecret, bucket: BUCKET, timeout: 600000 })

// 解析视频清单
// 数据文件里 videoUrl 是 URL 编码的路径（含前导 /），如 `/corpus/X.mp4` 或 `/%E7%AC%AC16-30%E6%9C%9F/...`。
// - 公网匿名请求用编码后的 url（OSS 能识别）。
// - ali-oss SDK 的 key 必须是「解码后的原始名 + 去前导斜杠」，否则会被二次编码 → 404。
const dataSrc = fs.readFileSync(path.resolve('src/modules/corpus/data/mockCorpusVideos.js'), 'utf8')
const idMatches = [...dataSrc.matchAll(/id:\s*'(\d+)'/g)]
const urlMatches = [...dataSrc.matchAll(/videoUrl:\s*`\$\{OSS\}([^`]+)`/g)]
const items = urlMatches
  .map((m, i) => {
    const rawPath = m[1]
    const url = OSS_BASE + rawPath
    const key = decodeURIComponent(rawPath.replace(/^\/+/, ''))
    return { id: idMatches[i]?.[1] || '?', url, key }
  })
  .filter((it) => !ONLY || ONLY.has(it.id))

fs.mkdirSync(TMP_DIR, { recursive: true })

// Content-Disposition 用匿名 HEAD 读（ali-oss 的 head() 不暴露该标准头）。
async function getDisposition(url) {
  const res = await fetch(url, { method: 'HEAD' })
  if (!res.ok) throw new Error(`HEAD HTTP ${res.status}`)
  return (res.headers.get('content-disposition') || '').toLowerCase()
}
const isAttachment = (d) => d.includes('attachment')

// 用 curl 下载（带断点续传 + 重试），比 fetch 抗网络抖动。
function download(url, dest) {
  const r = spawnSync(
    'curl',
    ['-sSL', '--fail', '--retry', '8', '--retry-delay', '3', '--retry-all-errors', '-C', '-', '-o', dest, url],
    { shell: true, encoding: 'utf8' }
  )
  if (r.status !== 0) throw new Error(`curl exit ${r.status}: ${(r.stderr || '').slice(-200)}`)
}

function runFfmpeg(args) {
  const r = spawnSync(FFMPEG, ['-y', ...args], { shell: true, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`ffmpeg exit ${r.status}: ${(r.stderr || '').slice(-500)}`)
}

async function uploadInline(key, file) {
  // 分片上传：大文件 + 不稳定连接更可靠（每片自动重试）。Content-Disposition 在
  // InitiateMultipartUpload 时设定，完成后成为对象元数据。
  await client.multipartUpload(key, file, {
    partSize: 5 * 1024 * 1024,
    mime: 'video/mp4',
    headers: { 'Content-Disposition': 'inline' },
  })
}

const summary = { total: items.length, skip: 0, av1Transcoded: 0, metaFixed: 0, remuxed: 0, failed: [] }

;(async () => {
  console.log(`共 ${items.length} 个视频。${DRY_RUN ? '(DRY RUN 预览，不实际改动)' : '正式执行（会覆盖生产对象）'}`)
  for (const it of items) {
    const tag = AV1_IDS.has(it.id) ? 'AV1→H264' : 'H.264'
    const inPath = path.join(TMP_DIR, `ep${it.id}-in.mp4`)
    const outPath = path.join(TMP_DIR, `ep${it.id}-out.mp4`)
    try {
      const disp = await getDisposition(it.url)
      const isAV1 = AV1_IDS.has(it.id)

      if (!isAV1 && !isAttachment(disp)) {
        summary.skip++
        console.log(`Ep.${it.id.padStart(2)} [${tag}] 已是 inline，跳过`)
        continue
      }

      if (isAV1) {
        if (DRY_RUN) {
          console.log(`Ep.${it.id.padStart(2)} [${tag}] 将：下载 → ffmpeg 重编码 H.264+faststart → 重传 inline`)
          continue
        }
        console.log(`Ep.${it.id.padStart(2)} [${tag}] 下载…`)
        download(it.url, inPath)
        console.log(`Ep.${it.id.padStart(2)} [${tag}] ffmpeg 重编码…`)
        runFfmpeg([
          '-i', inPath,
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
          '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
          '-movflags', '+faststart',
          '-c:a', 'aac', '-b:a', '128k',
          outPath,
        ])
        console.log(`Ep.${it.id.padStart(2)} [${tag}] 重传 inline…`)
        await uploadInline(it.key, outPath)
        summary.av1Transcoded++
        console.log(`Ep.${it.id.padStart(2)} [${tag}] ✓ 完成（注：disposition 由自定义域名解决，与对象无关）`)
      } else {
        // H.264：先试便宜的 metadata copy
        if (DRY_RUN) {
          console.log(`Ep.${it.id.padStart(2)} [${tag}] 将：试 copy-to-self inline；失败则下载→remux+faststart→重传`)
          continue
        }
        await client.copy(it.key, it.key, { headers: { 'Content-Disposition': 'inline' } })
        let disp2 = await getDisposition(it.url)
        if (!isAttachment(disp2)) {
          summary.metaFixed++
          console.log(`Ep.${it.id.padStart(2)} [${tag}] ✓ copy 改 inline 成功（无需重传）`)
          continue
        }
        console.log(`Ep.${it.id.padStart(2)} [${tag}] copy 未生效，降级：下载→remux+faststart→重传…`)
        download(it.url, inPath)
        runFfmpeg(['-i', inPath, '-c', 'copy', '-movflags', '+faststart', outPath])
        await uploadInline(it.key, outPath)
        summary.remuxed++
        console.log(`Ep.${it.id.padStart(2)} [${tag}] ✓ remux+faststart 重传完成`)
      }
    } catch (e) {
      summary.failed.push({ id: it.id, error: String(e?.message || e) })
      console.error(`Ep.${it.id.padStart(2)} ✗ ${e?.message || e}`)
    } finally {
      fs.rmSync(inPath, { force: true })
      fs.rmSync(outPath, { force: true })
    }
  }

  console.log('\n==== 汇总 ====')
  console.log(`总数: ${summary.total}`)
  console.log(`已是 inline 跳过: ${summary.skip}`)
  console.log(`AV1 重编码重传: ${summary.av1Transcoded}`)
  console.log(`H.264 copy 改 inline: ${summary.metaFixed}`)
  console.log(`H.264 remux+faststart 重传: ${summary.remuxed}`)
  console.log(`失败: ${summary.failed.length}`)
  for (const f of summary.failed) console.log(`  - Ep.${f.id}: ${f.error}`)
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
  if (summary.failed.length) process.exit(2)
})().catch((e) => {
  console.error('脚本异常:', e)
  process.exit(1)
})
