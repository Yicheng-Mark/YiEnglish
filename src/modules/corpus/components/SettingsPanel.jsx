import { useEffect } from 'react'
import { X, ExternalLink, Link2 } from 'lucide-react'
import { useCorpusContext } from '../context/CorpusPlayerContext.jsx'
import { useUserConfig } from '../../../hooks/useUserConfig.js'

const THEME_OPTIONS = [
  { value: 'light', label: '明亮', activeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  { value: 'gray', label: '暗夜', activeClass: 'bg-gray-200 text-gray-700 dark:bg-white dark:text-gray-900' },
  { value: 'star', label: '星空', activeClass: 'bg-amber-100 text-amber-700 dark:bg-white dark:text-gray-900' },
  { value: 'warm', label: '暖光', activeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
]

function Section({ title, children }) {
  return (
    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
      {title && (
        <div className="text-xs font-medium text-content-tertiary dark:text-gray-500 mb-2">
          {title}
        </div>
      )}
      {children}
    </div>
  )
}

function ToggleRow({ label, value, onChange, hint }) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 min-w-0">
        <div className="text-sm text-content dark:text-gray-200">{label}</div>
        {hint && (
          <div className="text-xs text-content-tertiary dark:text-gray-500">{hint}</div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={`shrink-0 relative w-9 h-5 rounded-full transition-colors ${
          value
            ? 'bg-primary dark:bg-white'
            : 'bg-gray-200 dark:bg-white/[0.1]'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full shadow transition-transform ${
            value ? 'translate-x-4 bg-white dark:bg-gray-900' : 'bg-white'
          }`}
        />
      </button>
    </div>
  )
}

function Segmented({ options, value, onChange }) {
  return (
    <div className="flex items-center gap-1 p-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06] overflow-hidden">
      {options.map((opt) => {
        const active = value === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-center px-2 py-1.5 text-xs rounded transition ${
              active
                ? 'bg-surface dark:bg-white/[0.08] text-content dark:text-gray-100 shadow-sm font-medium'
                : 'text-content-tertiary dark:text-gray-400 hover:text-content dark:hover:text-gray-200'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function SettingsPanel({ open, onClose }) {
  const { settings, toggleSetting, video } = useCorpusContext()
  const { theme, setTheme } = useUserConfig()

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* 遮罩 */}
      <div
        className="fixed inset-0 bg-black/40 z-50 animate-[fadeIn_0.18s_ease-out]"
        onClick={onClose}
      />
      <aside className="corpus-settings-drawer text-content dark:text-gray-100">
        {/* 顶部 */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/[0.06]">
          <span className="text-sm font-semibold">设置</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06] text-content-tertiary dark:text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {/* 一组开关 */}
          <Section>
            <ToggleRow
              label="视频循环"
              value={settings.videoLoop}
              onChange={() => toggleSetting('videoLoop')}
            />
            {/* 视频来源 */}
            <a
              href={video?.youtubeUrl || undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!video?.youtubeUrl) e.preventDefault()
              }}
              className={`flex items-center justify-between py-2 ${
                video?.youtubeUrl
                  ? 'text-content dark:text-gray-200 cursor-pointer'
                  : 'text-content-tertiary dark:text-gray-500 cursor-not-allowed pointer-events-none'
              }`}
            >
              <span className="flex items-center gap-2 text-sm">
                <Link2 className="w-4 h-4" />
                视频来源
              </span>
              <ExternalLink className="w-3.5 h-3.5 text-content-tertiary dark:text-gray-500" />
            </a>
          </Section>

          {/* 主题 */}
          <Section title="主题颜色">
            <div className="grid grid-cols-4 gap-1 p-0.5 rounded-md bg-gray-100 dark:bg-white/[0.06]">
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTheme(opt.value)}
                    className={`text-center px-2 py-1.5 text-xs rounded transition ${
                      active
                        ? opt.activeClass + ' shadow-sm font-medium'
                        : 'text-content-tertiary dark:text-gray-400 hover:text-content dark:hover:text-gray-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </Section>
        </div>
      </aside>
    </>
  )
}
