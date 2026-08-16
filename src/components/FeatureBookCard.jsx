/**
 * 通用功能词本卡片（Home 页阅读词本 / 语料词本 / 收藏词本 共用）。
 *
 * 视觉结构与原先三张内联卡片完全一致：
 * rounded-2xl border-2 渐变背景 + 顶部色条 + 图标 + 标题/副标题 + 徽标 + 计数文案。
 *
 * 颜色参数化：Tailwind 无法安全拼接动态类名（`bg-${color}-100` 会被 purge），
 * 故沿用项目既有 tagColors 的写法——用一个 color token 映射表把每种颜色涉及的全部
 * 类字符串预先声明出来，保证主题切换与 JIT purge 都正常工作。
 */

// 颜色 token -> 该颜色涉及的 className 映射（只管亮色模式的淡彩渐变身份）。
// 暗夜走「中性化」：卡片统一 #16181c 中性面 + 白α 边框，色彩不参与静止态，
// 由组件模板里的 dark: 类统一接管（hover 交给 glow-border-subtle 的紫色光边）。
// 新增颜色只需在此处追加一项，并在调用方传 color="xxx"。
const COLOR_TOKENS = {
  violet: {
    border: 'border-violet-200 hover:border-violet-300',
    gradient: 'bg-gradient-to-br from-violet-50 to-purple-50',
    topBar: 'bg-violet-500 dark:hidden',
    iconWrap: 'bg-violet-100 text-violet-600',
    title: 'text-violet-900',
    subtitle: 'text-violet-600/80',
    badge: 'bg-violet-100 text-violet-700',
    desc: 'text-violet-600/70',
  },
  cyan: {
    border: 'border-cyan-200 hover:border-cyan-300',
    gradient: 'bg-gradient-to-br from-cyan-50 to-sky-50',
    topBar: 'bg-cyan-500 dark:hidden',
    iconWrap: 'bg-cyan-100 text-cyan-600',
    title: 'text-cyan-900',
    subtitle: 'text-cyan-600/80',
    badge: 'bg-cyan-100 text-cyan-700',
    desc: 'text-cyan-600/70',
  },
  amber: {
    border: 'border-amber-200 hover:border-amber-300',
    gradient: 'bg-gradient-to-br from-amber-50 to-yellow-50',
    topBar: 'bg-amber-500 dark:hidden',
    iconWrap: 'bg-amber-100 text-amber-600',
    title: 'text-amber-900',
    subtitle: 'text-amber-600/80',
    badge: 'bg-amber-100 text-amber-700',
    desc: 'text-amber-600/70',
  },
}

/**
 * @param {object} props
 * @param {'violet'|'cyan'|'amber'} props.color 颜色 token
 * @param {React.ReactNode} props.icon 卡片图标（svg），建议包裹 `<svg className="w-5 h-5" ...>`
 * @param {string} props.title 卡片标题
 * @param {string} props.subtitle 副标题（图标右侧说明）
 * @param {string} props.badge 徽标文案（如「阅读」「语料」「收藏」）
 * @param {number} props.count 当前积累/收藏的词汇数；>0 时展示计数文案
 * @param {(count:number)=>string} props.countText count>0 时展示的文案工厂
 * @param {string} props.emptyText count===0 时展示的引导文案
 * @param {function} props.onClick 点击回调
 */
export default function FeatureBookCard({
  color = 'violet',
  icon,
  title,
  subtitle,
  badge,
  count = 0,
  countText,
  emptyText,
  onClick,
}) {
  const c = COLOR_TOKENS[color] || COLOR_TOKENS.violet

  return (
    <div
      onClick={onClick}
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 dark:border p-6 cursor-pointer hover:shadow-lg animate-card-enter glow-border-subtle transition-all duration-150 active:scale-[0.98] dark:bg-surface dark:from-transparent dark:to-transparent dark:border-white/[0.09] ${c.border} ${c.gradient}`}
    >
      {/* 顶部色条（仅亮色模式；暗夜中性化后隐藏） */}
      <div className={`absolute top-0 left-0 w-full h-1 opacity-80 ${c.topBar}`} />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl dark:bg-white/[0.06] dark:text-gray-300 ${c.iconWrap}`}
          >
            {icon}
          </div>
          <div>
            <h3 className={`text-lg font-bold dark:text-gray-100 ${c.title}`}>{title}</h3>
            <p className={`text-sm dark:text-gray-400 ${c.subtitle}`}>{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div
          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium dark:bg-white/[0.06] dark:text-gray-300 ${c.badge}`}
        >
          {badge}
        </div>
        <p className={`mt-2 text-sm dark:text-gray-500 ${c.desc}`}>
          {count > 0 ? countText(count) : emptyText}
        </p>
      </div>
    </div>
  )
}
