import { useState, useEffect } from 'react'
import { ChevronRight, ChevronDown } from 'lucide-react'
import useErrorTracking from '../hooks/useErrorTracking'
import ErrorHeatmap from './ErrorHeatmap'

const PATTERN_CONFIG = [
  { key: 'doubleLetter', label: '双写遗漏', color: 'bg-amber-500' },
  { key: 'vowel', label: '元音混淆', color: 'bg-purple-500' },
  { key: 'adjacentKey', label: '键位误触', color: 'bg-cyan-500' },
  { key: 'other', label: '其他', color: 'bg-gray-400' },
]

export default function ErrorAnalysisPanel() {
  const [expanded, setExpanded] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const { getErrorStats } = useErrorTracking()

  useEffect(() => {
    if (expanded && !stats && !loading) {
      setLoading(true)
      getErrorStats()
        .then(data => setStats(data))
        .catch(() => setStats({ total: 0, byPattern: {}, topWords: [] }))
        .finally(() => setLoading(false))
    }
  }, [expanded, stats, loading, getErrorStats])

  const handleToggle = () => {
    setExpanded(prev => !prev)
  }

  const hasData = stats && stats.total > 0

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-2xl shadow-sm border border-gray-100/80 dark:border-white/[0.06] overflow-hidden">
      {/* 折叠/展开按钮 */}
      <button
        onClick={handleToggle}
        className="w-full p-5 md:p-6 flex justify-between items-center text-left hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <span className="font-semibold text-content dark:text-gray-100">错题分析</span>
        </div>
        {expanded ? (
          <ChevronDown className="w-5 h-5 text-content-secondary dark:text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-content-secondary dark:text-gray-400" />
        )}
      </button>

      {/* 展开内容 */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          expanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-5 md:px-6 pb-5 md:pb-6">
          {loading ? (
            <p className="text-sm text-content-secondary dark:text-gray-400 py-2">加载中…</p>
          ) : !hasData ? (
            <p className="text-sm text-content-secondary dark:text-gray-400 py-2">
              暂无错题数据，开始练习后会自动记录。
            </p>
          ) : (
            <>
              {/* 总计 */}
              <p className="text-sm text-content-secondary dark:text-gray-400 mb-5">
                最近 30 天共打错 <span className="font-semibold text-content dark:text-gray-200">{stats.total}</span> 个字母
              </p>

              {/* 错误模式占比 */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-content dark:text-gray-200 mb-3">错误模式占比：</h4>
                <div className="space-y-2.5">
                  {PATTERN_CONFIG.map(({ key, label, color }) => {
                    const count = stats.byPattern[key] || 0
                    const percent = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0
                    return (
                      <div key={key} className="flex items-center gap-3">
                        <span className="text-sm text-content-secondary dark:text-gray-400 w-16 shrink-0">
                          {label}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-gray-200 dark:bg-white/[0.06] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color} transition-all duration-500`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <span className="text-sm text-content-secondary dark:text-gray-400 w-10 text-right">
                          {percent}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* 高频错词 Top 5 */}
              {stats.topWords.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-content dark:text-gray-200 mb-3">高频错词 Top {stats.topWords.length}：</h4>
                  {stats.topWords.map((item, i) => (
                    <ErrorHeatmap
                      key={item.word}
                      word={item.word}
                      errorMap={item.errorMap}
                      rank={i + 1}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
