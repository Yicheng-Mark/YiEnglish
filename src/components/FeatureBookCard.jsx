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

// 颜色 token -> 该颜色涉及的全部 className 映射。
// 新增颜色只需在此处追加一项，并在调用方传 color="xxx"。
const COLOR_TOKENS = {
  violet: {
    border:
      'border-violet-200 hover:border-violet-300 dark:border-violet-900/40 dark:hover:border-violet-700/60 dark:hover:shadow-violet-900/20',
    gradient:
      'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/20',
    topBar: 'bg-violet-500',
    iconWrap: 'bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
    title: 'text-violet-900 dark:text-violet-200',
    subtitle: 'text-violet-600/80 dark:text-violet-400/70',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300',
    desc: 'text-violet-600/70 dark:text-violet-400/60',
  },
  cyan: {
    border:
      'border-cyan-200 hover:border-cyan-300 dark:border-cyan-900/40 dark:hover:border-cyan-700/60 dark:hover:shadow-cyan-900/20',
    gradient: 'bg-gradient-to-br from-cyan-50 to-sky-50 dark:from-cyan-950/30 dark:to-sky-950/20',
    topBar: 'bg-cyan-500',
    iconWrap: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
    title: 'text-cyan-900 dark:text-cyan-200',
    subtitle: 'text-cyan-600/80 dark:text-cyan-400/70',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300',
    desc: 'text-cyan-600/70 dark:text-cyan-400/60',
  },
  amber: {
    border:
      'border-amber-200 hover:border-amber-300 dark:border-amber-900/40 dark:hover:border-amber-700/60 dark:hover:shadow-amber-900/20',
    gradient:
      'bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/20',
    topBar: 'bg-amber-500',
    iconWrap: 'bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
    title: 'text-amber-900 dark:text-amber-200',
    subtitle: 'text-amber-600/80 dark:text-amber-400/70',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    desc: 'text-amber-600/70 dark:text-amber-400/60',
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
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 p-6 cursor-pointer hover:shadow-lg animate-card-enter glow-border-subtle transition-all duration-150 active:scale-[0.98] ${c.border} ${c.gradient}`}
    >
      {/* 顶部色条 */}
      <div className={`absolute top-0 left-0 w-full h-1 opacity-80 ${c.topBar}`} />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${c.iconWrap}`}>
            {icon}
          </div>
          <div>
            <h3 className={`text-lg font-bold ${c.title}`}>{title}</h3>
            <p className={`text-sm ${c.subtitle}`}>{subtitle}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div
          className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium ${c.badge}`}
        >
          {badge}
        </div>
        <p className={`mt-2 text-sm ${c.desc}`}>{count > 0 ? countText(count) : emptyText}</p>
      </div>
    </div>
  )
}
