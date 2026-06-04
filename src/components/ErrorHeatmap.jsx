/**
 * ErrorHeatmap — 单个单词的字母级错误热力图
 * Props: { word, errorMap, rank }
 */
export default function ErrorHeatmap({ word, errorMap, rank }) {
  if (!word) return null

  const letters = word.split('')

  // 找到错误次数最高的位置
  let maxIndex = 0
  let maxCount = 0
  for (const [idx, count] of Object.entries(errorMap || {})) {
    if (count > maxCount) {
      maxCount = count
      maxIndex = Number(idx)
    }
  }

  function cellBg(count) {
    if (!count || count === 0) return 'bg-gray-100 dark:bg-white/[0.04]'
    if (count <= 2) return 'bg-yellow-200 dark:bg-yellow-900/30'
    if (count <= 5) return 'bg-orange-300 dark:bg-orange-800/40'
    return 'bg-red-400 dark:bg-red-700/50'
  }

  return (
    <div className="bg-gray-50 dark:bg-white/[0.02] rounded-xl p-4 mb-3">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-xs font-bold text-content-secondary dark:text-gray-500">#{rank}</span>
        <span className="text-lg font-bold font-mono text-content dark:text-gray-100">{word}</span>
      </div>

      <div className="flex items-end gap-1">
        {letters.map((letter, i) => {
          const count = errorMap?.[i] || 0
          return (
            <div
              key={i}
              className="w-8 h-14 flex flex-col items-center justify-end rounded"
            >
              {count > 0 && (
                <span className="text-[10px] text-content-secondary dark:text-gray-500 mb-0.5">
                  {count}
                </span>
              )}
              <div
                className={`w-full flex items-center justify-center rounded ${cellBg(count)}`}
                style={{ height: '32px' }}
              >
                <span className="text-sm font-mono text-content dark:text-gray-200">
                  {letter}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {maxCount > 0 && (
        <p className="mt-2 text-xs text-red-500">
          ↑ 第 {maxIndex + 1} 个字母 &quot;{letters[maxIndex]}&quot; 错误率最高（{maxCount} 次）
        </p>
      )}
    </div>
  )
}
