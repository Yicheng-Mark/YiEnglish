/**
 * 修复 OSS 视频对象的 Content-Disposition: attachment → inline。
 *
 * 背景：iOS Safari 对 <video> 元素严格遵循 Content-Disposition: attachment，会拒绝内嵌
 * 播放（当成下载），导致所有 iPhone 用户无法播放语料视频；安卓/桌面浏览器宽容不受影响。
 * 本脚本把 bucket 内所有带 attachment 头的对象改为 inline：
 *   用 CopyObject 复制到自身 + x-oss-metadata-directive: REPLACE，是 OSS 服务端内部操作，
 *   不下载、不重传视频字节，接近瞬时完成。
 *
 * 用法（凭证绝不贴聊天，从环境变量读取）：
 *   OSS_ACCESS_KEY_ID=xxx OSS_ACCESS_KEY_SECRET=yyy node scripts/fix-oss-content-disposition.mjs
 *
 *   预览（不实际修改）：
 *   DRY_RUN=1 OSS_ACCESS_KEY_ID=xxx OSS_ACCESS_KEY_SECRET=yyy node scripts/fix-oss-content-disposition.mjs
 *
 *   或把凭证放进本地 gitignore 的 .oss.env 后（Node 20+）：
 *   node --env-file=.oss.env scripts/fix-oss-content-disposition.mjs
 *
 * 验证：脚本结束打印汇总；亦可 curl -sI <url> | grep -i content-disposition 复核。
 */
import OSS from 'ali-oss'

const REGION = 'oss-cn-shenzhen'
const BUCKET = 'lingoforge-videos'
const DRY_RUN = !!process.env.DRY_RUN

const accessKeyId = process.env.OSS_ACCESS_KEY_ID
const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET
if (!accessKeyId || !accessKeySecret) {
  console.error('缺少 OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET 环境变量。')
  console.error('请在本机设置（不要贴到聊天）：')
  console.error('  OSS_ACCESS_KEY_ID=xxx OSS_ACCESS_KEY_SECRET=yyy node scripts/fix-oss-content-disposition.mjs')
  process.exit(1)
}

const client = new OSS({ region: REGION, accessKeyId, accessKeySecret, bucket: BUCKET })

const summary = { scanned: 0, hit: 0, fixed: 0, skipped: 0, failed: [] }

async function listAll() {
  const all = []
  let token
  do {
    const res = await client.listV2({ 'max-keys': 1000, 'continuation-token': token })
    all.push(...(res.objects || []))
    token = res.isTruncated ? res.nextContinuationToken || res.continuationToken : null
  } while (token)
  return all
}

;(async () => {
  console.log(`枚举 bucket ${BUCKET} ...${DRY_RUN ? ' (DRY RUN，不实际修改)' : ''}`)
  const objects = await listAll()
  const real = objects.filter((o) => Number(o.size) > 0) // 跳过 0 字节的目录占位符
  console.log(`共 ${objects.length} 个对象，${real.length} 个实际文件。`)

  for (const obj of real) {
    summary.scanned++
    const name = obj.name
    let disposition = ''
    try {
      const head = await client.head(name)
      disposition = head?.res?.headers?.['content-disposition'] || ''
    } catch (e) {
      summary.failed.push({ name, step: 'head', error: String(e?.message || e) })
      continue
    }
    if (!/attachment/i.test(disposition)) {
      summary.skipped++
      continue
    }
    summary.hit++
    if (DRY_RUN) {
      console.log(`[dry-run] 需修复: ${name}  (当前: ${disposition})`)
      continue
    }
    try {
      // copy 到自身 + 传 content-disposition：ali-oss 检测到 REPLACE_HEADER 会自动加
      // x-oss-metadata-directive: REPLACE（见 ali-oss/lib/common/object/copyObject.js）。
      await client.copy(name, name, {
        headers: { 'Content-Disposition': 'inline' },
      })
      summary.fixed++
      console.log(`✓ [${summary.fixed}/${summary.hit}] ${name}`)
    } catch (e) {
      summary.failed.push({ name, step: 'copy', error: String(e?.message || e) })
      console.error(`✗ ${name}: ${e?.message || e}`)
    }
  }

  console.log('\n==== 汇总 ====')
  console.log(`扫描: ${summary.scanned}`)
  console.log(`已无 attachment（跳过）: ${summary.skipped}`)
  console.log(`命中 attachment: ${summary.hit}`)
  console.log(`已修复: ${summary.fixed}`)
  if (summary.failed.length) {
    console.log(`失败: ${summary.failed.length}`)
    for (const f of summary.failed) console.log(`  - [${f.step}] ${f.name}: ${f.error}`)
    process.exit(2)
  }
  if (DRY_RUN) console.log('\n(dry-run 模式：以上为预览，未实际修改。去掉 DRY_RUN=1 后再跑一次以应用。)')
})().catch((e) => {
  console.error('脚本异常:', e)
  process.exit(1)
})
