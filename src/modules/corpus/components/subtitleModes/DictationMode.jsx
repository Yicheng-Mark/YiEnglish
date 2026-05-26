import { useState } from 'react'
import { Send, Eye, RotateCcw } from 'lucide-react'
import { formatTime } from '../../../../utils/formatTime.js'
import { useCorpusContext } from '../../context/CorpusPlayerContext.jsx'
import { useAutoScrollList } from '../../hooks/useAutoScrollList.js'
import { ColorizedText } from '../ColorizedToken.jsx'

function tokenizeForCompare(text) {
  if (!text) return []
  const re = /[a-zA-Z]+(?:['-][a-zA-Z0-9]+)*/g
  const out = []
  let m
  while ((m = re.exec(text)) !== null) {
    out.push(m[0].toLowerCase())
  }
  return out
}

function compareInput(input, target) {
  const inputWords = tokenizeForCompare(input)
  const targetWords = tokenizeForCompare(target)
  const result = []
  const max = Math.max(inputWords.length, targetWords.length)
  let correct = 0
  for (let i = 0; i < max; i++) {
    const it = inputWords[i] || null
    const tg = targetWords[i] || null
    const ok = it && tg && it === tg
    if (ok) correct++
    result.push({ input: it, target: tg, ok })
  }
  return { result, correct, total: targetWords.length }
}

export default function DictationMode() {
  const { subtitles, player, posMap, handleWordClick, settings, updateSetting } =
    useCorpusContext()
  const { setItemRef, containerProps } = useAutoScrollList(player.activeId)

  const isFollow = settings.dictationFollowMode === 'follow'

  // 每条字幕的输入与提交结果
  const [inputs, setInputs] = useState({})
  const [submissions, setSubmissions] = useState({})
  const [showOriginal, setShowOriginal] = useState({})

  if (!subtitles?.length) return null

  const setInput = (id, val) => setInputs((p) => ({ ...p, [id]: val }))
  const submit = (sub) => {
    const inp = inputs[sub.id] || ''
    setSubmissions((p) => ({ ...p, [sub.id]: compareInput(inp, sub.en || '') }))
  }
  const resetSub = (id) => {
    setSubmissions((p) => {
      const { [id]: _, ...rest } = p
      return rest
    })
    setInputs((p) => ({ ...p, [id]: '' }))
  }

  return (
    <div
      {...containerProps}
      className="h-full overflow-y-auto p-2 md:p-3 space-y-2 bg-surface dark:bg-white/[0.03] border border-gray-200/70 dark:border-white/[0.06] rounded-2xl shadow-sm"
    >
      {/* 顶部模式切换 */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-content-tertiary dark:text-gray-500">
          {isFollow ? '跟读模式：边听边读' : '听写模式：输入后提交对比'}
        </span>
        <div className="flex items-center gap-1 p-0.5 rounded-full bg-gray-100 dark:bg-white/[0.06] text-xs">
          <button
            type="button"
            onClick={() => updateSetting('dictationFollowMode', 'dictation')}
            className={`px-3 py-1 rounded-full transition ${
              !isFollow
                ? 'bg-surface dark:bg-white/[0.08] text-content dark:text-gray-100 shadow-sm'
                : 'text-content-tertiary dark:text-gray-400'
            }`}
          >
            听写
          </button>
          <button
            type="button"
            onClick={() => updateSetting('dictationFollowMode', 'follow')}
            className={`px-3 py-1 rounded-full transition ${
              isFollow
                ? 'bg-surface dark:bg-white/[0.08] text-content dark:text-gray-100 shadow-sm'
                : 'text-content-tertiary dark:text-gray-400'
            }`}
          >
            跟读
          </button>
        </div>
      </div>

      {subtitles.map((sub) => {
        const active = sub.id === player.activeId
        const sub_show = showOriginal[sub.id]
        const submission = submissions[sub.id]
        return (
          <div
            ref={setItemRef(sub.id)}
            key={sub.id}
            onClick={() => player.jumpToCue(sub.id)}
            className={
              'p-3 rounded-xl cursor-pointer transition-all select-none border ' +
              (active
                ? 'bg-primary-soft border-primary/30 dark:bg-primary-soft dark:border-primary/30'
                : 'bg-transparent border-transparent hover:bg-gray-100/60 dark:hover:bg-white/[0.04]')
            }
          >
            <div className="text-xs text-content-tertiary dark:text-gray-500 mb-1 tabular-nums">
              {formatTime(sub.start)} — {formatTime(sub.end)}
            </div>
            {/* 跟读模式直接显示原文 */}
            {isFollow ? (
              sub.en && (
                <div
                  className={`text-base leading-snug ${
                    active ? 'font-semibold' : 'text-content dark:text-gray-100'
                  }`}
                >
                  <ColorizedText
                    text={sub.en}
                    paraKey={`dt-${sub.id}`}
                    posMap={posMap}
                    onWordClick={handleWordClick}
                    showColor={settings?.posHighlight}
                  />
                </div>
              )
            ) : !active && !sub_show && !submission ? (
              <div className="text-base text-content-tertiary dark:text-gray-500 select-none">
                ……
              </div>
            ) : null}

            {sub.zh && (
              <div className="text-sm leading-relaxed text-content-tertiary dark:text-gray-400 mt-1">
                {sub.zh}
              </div>
            )}

            {/* 听写模式 + 当前活跃句：输入区 */}
            {!isFollow && active && (
              <div
                className="mt-2"
                onClick={(e) => e.stopPropagation()}
              >
                {!submission ? (
                  <>
                    <textarea
                      value={inputs[sub.id] || ''}
                      onChange={(e) => setInput(sub.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault()
                          submit(sub)
                        }
                      }}
                      placeholder="开始听写吧…（Ctrl+Enter 提交）"
                      rows={2}
                      className="w-full px-3 py-2 text-sm rounded-md bg-surface dark:bg-white/[0.04] border border-gray-200 dark:border-white/[0.08] text-content dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-primary"
                    />
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => submit(sub)}
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-primary text-white hover:opacity-90"
                      >
                        <Send className="w-3 h-3" />
                        <span>提交对比</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setShowOriginal((p) => ({ ...p, [sub.id]: !p[sub.id] }))
                        }
                        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-content-secondary dark:text-gray-300"
                      >
                        <Eye className="w-3 h-3" />
                        <span>{sub_show ? '隐藏原文' : '查看原文'}</span>
                      </button>
                    </div>
                    {sub_show && sub.en && (
                      <div className="mt-2 px-3 py-2 rounded-md bg-gray-50 dark:bg-white/[0.04] text-sm text-content-secondary dark:text-gray-300 leading-snug">
                        <ColorizedText
                          text={sub.en}
                          paraKey={`dt-orig-${sub.id}`}
                          posMap={posMap}
                          onWordClick={handleWordClick}
                          showColor={settings?.posHighlight}
                        />
                      </div>
                    )}
                  </>
                ) : (
                  <DictationFeedback submission={submission} sub={sub} onReset={() => resetSub(sub.id)} />
                )}
              </div>
            )}

            {/* 提交后即使切走也保持显示反馈 */}
            {!isFollow && !active && submission && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <DictationFeedback submission={submission} sub={sub} onReset={() => resetSub(sub.id)} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function DictationFeedback({ submission, sub, onReset }) {
  const { result, correct, total } = submission
  const accuracy = total === 0 ? 0 : Math.round((correct / total) * 100)
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 text-xs">
        <span
          className={`font-semibold ${
            accuracy >= 80
              ? 'text-emerald-600 dark:text-emerald-400'
              : accuracy >= 50
              ? 'text-amber-600 dark:text-amber-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
          准确率 {accuracy}%（{correct}/{total}）
        </span>
        <button
          type="button"
          onClick={onReset}
          className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.1] text-content-secondary dark:text-gray-300"
        >
          <RotateCcw className="w-3 h-3" />
          <span>重写</span>
        </button>
      </div>
      <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-white/[0.04] text-sm leading-snug">
        <span className="text-xs text-content-tertiary dark:text-gray-500 mr-2">原文</span>
        {result.map((r, i) => {
          const target = r.target || ''
          if (!target) return null
          return (
            <span
              key={i}
              className={
                'mr-1 ' +
                (r.ok
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400 underline decoration-dotted')
              }
            >
              {target}
            </span>
          )
        })}
      </div>
      <div className="px-3 py-2 rounded-md bg-gray-50 dark:bg-white/[0.04] text-sm leading-snug">
        <span className="text-xs text-content-tertiary dark:text-gray-500 mr-2">你写</span>
        {result.map((r, i) => (
          <span
            key={i}
            className={
              'mr-1 ' +
              (r.ok
                ? 'text-emerald-600 dark:text-emerald-400'
                : r.input
                ? 'text-rose-600 dark:text-rose-400 line-through'
                : 'text-content-tertiary dark:text-gray-500')
            }
          >
            {r.input || '—'}
          </span>
        ))}
      </div>
    </div>
  )
}
