// themes 白名单漂移守护：服务端 VALID_THEMES 必须恰为 ['light','warm']，
// 且与 src/hooks/useUserConfig.js 的前端白名单保持一致（改主题时三处同步的其中两处）。
// 前端模块是 ESM React hook（依赖 window/localStorage），node 环境不能 import ——
// 用 fs 读文件内容 + 正则提取数组字面量比对。
import { describe, it, expect } from 'vitest'
const fs = require('fs')
const path = require('path')
const { VALID_THEMES } = require('./themes')

describe('VALID_THEMES 漂移守护', () => {
  it('恰为 [light, warm]（暗夜 gray 已下线，服务端不再接受该值）', () => {
    expect(VALID_THEMES).toEqual(['light', 'warm'])
  })

  it('大小写敏感：Light 不合法', () => {
    expect(VALID_THEMES).not.toContain('Light')
    expect(VALID_THEMES.includes('Light')).toBe(false)
  })

  it('与前端 useUserConfig.js 的白名单一致（fs 读文件 + 正则提取，不 import ESM 模块）', () => {
    // vitest 转换上下文里 __dirname/require.resolve/import.meta.url 均不可靠，
    // 以仓库根（vitest 恒以项目根为 cwd 运行，见 vitest.config.js 同级）定位前端文件
    const frontendPath = path.resolve(process.cwd(), 'src/hooks/useUserConfig.js')
    const src = fs.readFileSync(frontendPath, 'utf8')
    const match = src.match(/VALID_THEMES\s*=\s*\[([^\]]*)\]/)
    expect(match).toBeTruthy()
    const frontendThemes = match[1]
      .split(',')
      .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean)
    expect(frontendThemes).toEqual([...VALID_THEMES])
  })
})
