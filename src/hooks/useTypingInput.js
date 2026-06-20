import { useCallback, useEffect, useRef } from 'react'
import { unlockAudio } from '../utils/audioContext.js'

/**
 * useTypingInput —— 从 Typing.jsx 机械抽离的 IME 合成处理与输入代理逻辑。
 *
 * 抽离自 Typing.jsx（原内联代码逐行对应，无业务逻辑改动）：
 *  - isComposingRef / justCommittedRef / inputValueRef：IME 合成状态隔离
 *  - handleInputRef + 始终指向最新 handleInput 的 useEffect
 *  - handleCharacterInput / handleBackspace：核心输入代理（桌面 keydown 与移动 input 双轨复用）
 *  - handleInputChange：隐藏 input 的 onChange diff 逻辑（追加/替换/退格判定）
 *  - onCompositionStart / onCompositionEnd：原内联在 <input> JSX 的合成事件处理，
 *    提升为稳定回调（逻辑与原代码逐行一致）
 *
 * 注意：桌面端 window keydown 处理保留在 Typing.jsx（约束要求不动）。
 *
 * @param {object} opts
 * @param {boolean} opts.isFinished
 * @param {Function} opts.handleInput useTyping 返回的核心输入函数
 * @param {React.RefObject<HTMLInputElement>} opts.hiddenInputRef 隐藏输入框 ref（仍由 Typing.jsx 持有）
 */
export default function useTypingInput({ isFinished, handleInput, hiddenInputRef }) {
  const handleInputRef = useRef(null)
  const inputValueRef = useRef('')
  const isComposingRef = useRef(false)
  const justCommittedRef = useRef(false) // IME 刚完成提交，等待 onChange 隔离

  // 始终保持 ref 指向最新的 handleInput
  useEffect(() => {
    handleInputRef.current = handleInput
  }, [handleInput])

  // 核心输入处理函数，供 keydown 和 input 代理层双轨复用
  const handleCharacterInput = useCallback(
    (char) => {
      if (isFinished) return
      unlockAudio()
      handleInputRef.current?.(char)
    },
    [isFinished]
  )

  const handleBackspace = useCallback(() => {
    if (isFinished) return
    unlockAudio()
    handleInputRef.current?.('Backspace')
  }, [isFinished])

  // 输入处理：通过隐藏 input 代理键盘输入
  // 不清空 input 值（部分浏览器/IME 下清空不生效），改为智能 diff：
  // - 追加（拼音增长）：处理新增后缀
  // - 替换（中文字符→新拼音）：处理整个新值
  const handleInputChange = useCallback(
    (e) => {
      if (isFinished) return
      const inputType = e.nativeEvent?.inputType
      const newVal = e.target.value
      const oldVal = inputValueRef.current

      // 检测是否在 IME 合成中（拼音输入）
      const isComposing = inputType === 'insertCompositionText' || isComposingRef.current

      // IME 提交隔离：compositionEnd 已触发，此 onChange 携带的是中文提交字符
      // 跳过所有 diff 逻辑，重置输入值，防止触发虚假退格
      if (justCommittedRef.current) {
        justCommittedRef.current = false
        inputValueRef.current = ''
        if (hiddenInputRef.current) hiddenInputRef.current.value = ''
        return
      }

      if (newVal.startsWith(oldVal) && newVal.length > oldVal.length) {
        // 追加模式：拼音在增长，提取新增后缀中的英文字母
        // 使用 replace 而非整体正则，避免 IME 残留中文字符导致整批字母被丢弃
        const newChars = newVal.slice(oldVal.length)
        // 允许空格通过：复合词连字符已规范化为空格，用户按主面板空格键即可（连字符不在主面板）
        const asciiChars = newChars.replace(/[^a-zA-Z ]/g, '')
        if (asciiChars) {
          for (const ch of asciiChars) {
            handleCharacterInput(ch)
          }
        }
      } else if (newVal !== oldVal && /^[a-zA-Z]+$/.test(newVal) && !/^[a-zA-Z]+$/.test(oldVal)) {
        // 替换模式：中文字符被新拼音替换（如 "个" → "l"）
        // 此时 newVal 全是英文字母，oldVal 含非英文字符，处理整个 newVal
        for (const ch of newVal) {
          handleCharacterInput(ch)
        }
      } else if (newVal.length < oldVal.length && !isComposing) {
        // 仅当 newVal 是 oldVal 的前缀时才视为退格
        // IME 提交（拼音→中文字符）产生完全不同的字符串，不满足前缀关系
        if (oldVal.startsWith(newVal)) {
          handleBackspace()
        }
      }

      inputValueRef.current = newVal

      // 非 ASCII 污染清理：如果追踪值含中文字符（IME 残留），重置输入
      // 不在合成中才清理，避免干扰正在进行的输入法组合
      if (!/^[\x00-\x7F]*$/.test(inputValueRef.current) && !isComposingRef.current) {
        inputValueRef.current = ''
        if (hiddenInputRef.current) hiddenInputRef.current.value = ''
      }
    },
    [isFinished, handleCharacterInput, handleBackspace, hiddenInputRef]
  )

  // 原内联在 <input> JSX 的合成事件处理，提升为稳定回调（逻辑逐行对应原代码）
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
    justCommittedRef.current = false // 清除过期的提交标记
  }, [])

  const handleCompositionEnd = useCallback(
    (e) => {
      const data = e.data
      if (data && /^[a-zA-Z]+$/.test(data)) {
        for (const ch of data) {
          handleCharacterInput(ch)
        }
      }
      // 不清空 input 值，避免浏览器/IME 拒绝清空导致 diff 失败
      // 让 onChange 自然追踪值变化
      isComposingRef.current = false
      justCommittedRef.current = true // 标记提交完成，等待 onChange 隔离
    },
    [handleCharacterInput]
  )

  return {
    // refs（桌面端 keydown 处理需要读取/重置 isComposingRef / justCommittedRef）
    isComposingRef,
    justCommittedRef,
    handleInputRef,
    inputValueRef,
    // 回调
    handleCharacterInput,
    handleBackspace,
    handleInputChange,
    handleCompositionStart,
    handleCompositionEnd,
  }
}
