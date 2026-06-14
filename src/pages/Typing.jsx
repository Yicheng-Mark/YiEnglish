import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { List } from 'lucide-react';
import { unlockAudio } from '../utils/audioContext.js';
import { loadDictionary } from '../utils/loadDictionary.js';
import { getErrorBook, getErrorBookCount, removeFromErrorBook } from '../utils/errorBook.js';
import { getReadingWordBookCount, removeFromReadingWordBook } from '../utils/readingWordBook.js';
import { getCorpusWordBookCount, removeFromCorpusWordBook } from '../utils/corpusWordBook.js';
import { getFavoriteWordsCount, isInFavoriteWords, addToFavoriteWords, removeFromFavoriteWords } from '../utils/favoriteWords.js';
import { getMeta } from '../dictionaries/meta.js';
import useTyping from '../hooks/useTyping.js';
import { useUserConfig } from '../hooks/useUserConfig.js';
import { useReadingStore } from '../modules/reading/hooks/useReadingStore.js';
import StatsPanel from '../components/StatsPanel.jsx';
import ResultModal from '../components/ResultModal.jsx';
import TypingToolbar from '../components/TypingToolbar.jsx';
import WrongBookModal from '../components/WrongBookModal.jsx';
import WordListPanel from '../components/WordListPanel.jsx';
import NextWordPreview from '../components/NextWordPreview.jsx';
import WordDisplay from '../components/WordDisplay.jsx';
import useIsMobile from '../hooks/useIsMobile.js';
import { saveProgress } from '../lib/api.js';
import { saveLocalProgress } from '../utils/localProgress.js';
import { addWordToReview, updateReviewCard } from '../utils/reviewCards.js';
import { useWordContext } from '../contexts/WordContext.jsx';
import useErrorTracking from '../hooks/useErrorTracking.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const TRIAL_CHAPTER_COUNT = 5;

export default function Typing() {
  const { dictId, chapterId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isTrial = !!user?.isTrial;
  const [searchParams] = useSearchParams();
  const [words, setWords] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showWrongBook, setShowWrongBook] = useState(false);
  const [isWordListOpen, setIsWordListOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const hiddenInputRef = useRef(null);
  const handleInputRef = useRef(null);
  const hasJumpedRef = useRef(false);
  const inputValueRef = useRef('');
  const [keyboardActive, setKeyboardActive] = useState(true);
  const keyboardActiveRef = useRef(true);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(null);
  const touchStartRef = useRef(null);
  const suppressClickRef = useRef(false);
  const completedBufferRef = useRef([]);
  const isComposingRef = useRef(false);
  const justCommittedRef = useRef(false); // IME 刚完成提交，等待 onChange 隔离
  const blurTimerRef = useRef(null);

  const isMobile = useIsMobile();
  const isErrorBookMode = dictId === 'error-book';
  const isReadingWordBookMode = dictId === 'reading-word-book';
  const isCorpusWordBookMode = dictId === 'corpus-word-book';
  const isFavoriteWordBookMode = dictId === 'favorite-words';
  const isReviewMode = dictId === 'review';
  const isWordBookMode = isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode;

  const targetWordIndex = parseInt(searchParams.get('wordIndex')) || 0;

  const { config, toggleConfig, updateConfig, theme, setTheme } = useUserConfig();
  const { onError: onErrorTracking } = useErrorTracking();

  useEffect(() => {
    setLoading(true); setError(null); hasJumpedRef.current = false;
    loadDictionary(dictId).then(dict => {
      if (!dict) {
        setError('加载失败'); setLoading(false); return;
      }
      setChapters(dict.chapters || []);
      const chapter = dict.chapters?.find(c => c.id === Number(chapterId));
      if (chapter?.words?.length > 0) {
        setWords(chapter.words);
      } else if (isErrorBookMode && (!dict.chapters || dict.chapters.length === 0)) {
        setError('错题本暂无单词');
      } else if (isReviewMode && (!dict.chapters || dict.chapters.length === 0)) {
        setError('暂无待复习单词');
      } else if (isFavoriteWordBookMode && (!dict.chapters || dict.chapters.length === 0)) {
        setError('收藏词本暂无单词');
        setWords([]);
      } else {
        setError('章节不存在或为空');
      }
      setLoading(false);
    }).catch(() => { setError('加载失败'); setLoading(false); });
  }, [dictId, chapterId, isErrorBookMode, isFavoriteWordBookMode, isReviewMode, reloadKey]);

  const dictName = useMemo(() => getMeta(dictId)?.name || dictId, [dictId]);

  const flushServerProgress = useCallback(() => {
    if (isErrorBookMode || isWordBookMode || isReviewMode) return;
    const buffered = completedBufferRef.current.splice(0);
    if (buffered.length === 0) return;
    saveProgress(dictId, Number(chapterId), buffered).catch(() => {
      completedBufferRef.current.push(...buffered);
    });
  }, [isErrorBookMode, isWordBookMode, isReviewMode, dictId, chapterId]);

  const handleWordComplete = useCallback((wordName) => {
    if (isReviewMode) {
      const hadError = lastWordHadErrorRef.current;
      updateReviewCard(wordName, hadError ? 3 : 5);
      return;
    }
    if (isErrorBookMode || isWordBookMode) return;
    saveLocalProgress(dictId, Number(chapterId), [wordName]);
    addWordToReview(wordName, dictId);
    completedBufferRef.current.push(wordName);
    if (completedBufferRef.current.length >= 5) {
      flushServerProgress();
    }
  }, [isReviewMode, isErrorBookMode, isWordBookMode, dictId, chapterId, flushServerProgress]);

  const handleAutoRemove = useCallback((wordName) => {
    if (isReviewMode) return;
    if (isErrorBookMode) removeFromErrorBook(wordName);
    else if (isReadingWordBookMode) removeFromReadingWordBook(wordName);
    else if (isCorpusWordBookMode) removeFromCorpusWordBook(wordName);
    else if (isFavoriteWordBookMode) removeFromFavoriteWords(wordName);
  }, [isReviewMode, isErrorBookMode, isReadingWordBookMode, isCorpusWordBookMode, isFavoriteWordBookMode]);

  const { currentWord, currentInput, wordIndex, stats, isFinished, handleInput, jumpTo, reset, isWrong, startTime, lastWordHadErrorRef } = useTyping(words, config.soundEnabled, config.wordRepeatCount, isErrorBookMode, dictName, config.autoRemoveErrorWord, handleWordComplete, handleAutoRemove, onErrorTracking);
  const { setCurrentWord } = useWordContext();
  useEffect(() => { setCurrentWord(currentWord); return () => setCurrentWord(null) }, [currentWord, setCurrentWord]);
  const studyStore = useReadingStore();
  const typingAccumulatedRef = useRef(0);
  const lastFlushRef = useRef(0);

  const remainingErrorCount = useMemo(() => {
    if (!isErrorBookMode) return 0;
    return getErrorBookCount();
  }, [isErrorBookMode, isFinished, reloadKey]);

  const remainingReadingCount = useMemo(() => {
    if (!isReadingWordBookMode) return 0;
    return getReadingWordBookCount();
  }, [isReadingWordBookMode, isFinished, reloadKey]);

  const remainingCorpusCount = useMemo(() => {
    if (!isCorpusWordBookMode) return 0;
    return getCorpusWordBookCount();
  }, [isCorpusWordBookMode, isFinished, reloadKey]);

  const remainingFavoriteCount = useMemo(() => {
    if (!isFavoriteWordBookMode) return 0;
    return getFavoriteWordsCount();
  }, [isFavoriteWordBookMode, isFinished, reloadKey]);

  // 收藏状态同步
  const [isCurrentWordFavorited, setIsCurrentWordFavorited] = useState(false);
  useEffect(() => {
    setIsCurrentWordFavorited(currentWord ? isInFavoriteWords(currentWord.name) : false);
  }, [currentWord?.name]);

  const handleToggleFavorite = useCallback((e) => {
    e.stopPropagation();
    if (!currentWord) return;
    if (isInFavoriteWords(currentWord.name)) {
      removeFromFavoriteWords(currentWord.name);
      setIsCurrentWordFavorited(false);
    } else {
      addToFavoriteWords(currentWord);
      setIsCurrentWordFavorited(true);
    }
  }, [currentWord]);

  // 加载完成后，自动跳转到 URL 参数指定的单词
  useEffect(() => {
    if (!loading && words.length > 0 && targetWordIndex > 0 && !hasJumpedRef.current) {
      const validIndex = Math.min(targetWordIndex, words.length - 1);
      jumpTo(validIndex);
      hasJumpedRef.current = true;
    }
  }, [loading, words, targetWordIndex, jumpTo]);

  // 始终保持 ref 指向最新的 handleInput
  useEffect(() => {
    handleInputRef.current = handleInput;
  }, [handleInput]);

  // 记录单词打字学习时间
  useEffect(() => {
    if (!startTime || isFinished) {
      if (typingAccumulatedRef.current > lastFlushRef.current) {
        const delta = typingAccumulatedRef.current - lastFlushRef.current
        studyStore.addTypingSeconds(delta)
        lastFlushRef.current = typingAccumulatedRef.current
      }
      return
    }

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      typingAccumulatedRef.current = elapsed
      const delta = elapsed - lastFlushRef.current
      if (delta >= 30) {
        studyStore.addTypingSeconds(delta)
        lastFlushRef.current = elapsed
      }
    }, 1000)

    return () => {
      clearInterval(interval)
      const elapsed = Math.floor((Date.now() - startTime) / 1000)
      typingAccumulatedRef.current = elapsed
      const delta = elapsed - lastFlushRef.current
      if (delta > 0) {
        studyStore.addTypingSeconds(delta)
        lastFlushRef.current = elapsed
      }
    }
  }, [startTime, isFinished, studyStore])

  // 章节完成时刷新进度到服务器
  useEffect(() => {
    if (isFinished) flushServerProgress();
  }, [isFinished, flushServerProgress]);

  // 组件卸载时刷新进度
  useEffect(() => {
    return () => flushServerProgress();
  }, [flushServerProgress]);

  // 移动端：点击/触摸页面任意位置重新聚焦输入框，防止失焦后无法打字
  useEffect(() => {
    if (!isMobile || isFinished || words.length === 0 || !keyboardActive) return;
    const focusInput = (e) => {
      if (suppressClickRef.current) return;
      // 点击/触摸工具栏按钮、下拉菜单项等交互控件时不抢焦点，避免移动端干扰其 click
      if (e?.target?.closest?.('button, a, .dropdown-menu, .dropdown-item, input, textarea, select, [data-no-refocus]')) return;
      try {
        hiddenInputRef.current?.focus({ preventScroll: true });
      } catch {
        hiddenInputRef.current?.focus();
      }
    };
    document.addEventListener('click', focusInput);
    document.addEventListener('touchstart', focusInput, { passive: true });
    return () => {
      document.removeEventListener('click', focusInput);
      document.removeEventListener('touchstart', focusInput);
    };
  }, [isMobile, isFinished, words.length, keyboardActive]);

  // 页面加载/章节切换后自动聚焦隐藏输入框并清空残留
  useEffect(() => {
    if (!loading && words.length > 0 && hiddenInputRef.current) {
      setTimeout(() => {
        if (isMobile && !keyboardActiveRef.current) return;
        if (isMobile) {
          try { hiddenInputRef.current?.focus({ preventScroll: true }); }
          catch { hiddenInputRef.current?.focus(); }
        } else {
          hiddenInputRef.current?.focus();
        }
        inputValueRef.current = '';
        if (hiddenInputRef.current) hiddenInputRef.current.value = '';
      }, 300);
    }
  }, [loading, isMobile]);

  // 同步 keyboardActive 到 ref，避免 setTimeout 闭包 stale
  useEffect(() => { keyboardActiveRef.current = keyboardActive; }, [keyboardActive]);

  // 移动端：监听 visualViewport 高度变化，检测虚拟键盘弹出/收起
  // 不支持 visualViewport 的浏览器 fallback 到 window.innerHeight
  useEffect(() => {
    if (!isMobile) return;
    const vv = window.visualViewport;

    if (vv) {
      const initialHeight = window.innerHeight;
      const handleResize = () => {
        const currentHeight = vv.height;
        const kbdHeight = Math.max(0, initialHeight - currentHeight);
        setKeyboardHeight(kbdHeight);
        // 键盘弹出时,vv.height 就是键盘上方的可视区域,直接用即可,
        // 不要再减 safe-area(部分安卓机会把手势条/键盘高度算进 safe-area,导致下方留白)
        setViewportHeight(kbdHeight > 0 ? currentHeight : null);
      };
      vv.addEventListener('resize', handleResize);
      handleResize();
      return () => vv.removeEventListener('resize', handleResize);
    }

    const initialHeight = window.innerHeight;
    const handleResize = () => {
      const currentHeight = window.innerHeight;
      const kbdHeight = Math.max(0, initialHeight - currentHeight);
      setKeyboardHeight(kbdHeight);
      setViewportHeight(kbdHeight > 0 ? currentHeight : null);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  // 核心输入处理函数，供 keydown 和 input 代理层双轨复用
  const handleCharacterInput = useCallback((char) => {
    if (isFinished) return;
    unlockAudio();
    handleInputRef.current?.(char);
  }, [isFinished]);

  const handleBackspace = useCallback(() => {
    if (isFinished) return;
    unlockAudio();
    handleInputRef.current?.('Backspace');
  }, [isFinished]);

  const visibleChapters = isTrial ? chapters.slice(0, TRIAL_CHAPTER_COUNT) : chapters;
  const hasNextChapter = !isErrorBookMode && !isReadingWordBookMode && !isCorpusWordBookMode && !isFavoriteWordBookMode && !isReviewMode
    && visibleChapters.some(c => c.id === Number(chapterId) + 1);

  const handleNextChapter = useCallback(() => {
    const nextId = Number(chapterId) + 1;
    navigate(`/typing/${dictId}/${nextId}`);
  }, [navigate, dictId, chapterId]);

  // 桌面端：window 级别 keydown 监听，保持原有逻辑不变
  useEffect(() => {
    if (isMobile) return;
    const onKeyDown = (e) => {
      if (isFinished) return;
      // 安全重置：防止从 IME 切换到直接英文输入时标记残留
      justCommittedRef.current = false;
      // Windows IME 发送 Process 键，跳过（字符通过 compositionEnd 或 onChange 到达）
      if (e.key === 'Process') return;
      // macOS 中文 IME 的 keydown 中 e.key 为实际字母而非 Process，但 e.isComposing 为 true
      // 优先检查浏览器原生 isComposing，避免 preventDefault 取消 IME 合成
      if (e.isComposing || e.nativeEvent?.isComposing) return;
      // Edge bug: 中文 IME 英文模式下 compositionEnd 不触发，isComposingRef 卡在 true。
      // 用原生 e.isComposing 检测：如果浏览器认为合成已结束，立即重置 ref
      if (!e.isComposing) isComposingRef.current = false;
      if (isComposingRef.current) return;
      if (isWordListOpen) return;
      if ((e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') && e.target !== hiddenInputRef.current) return;
      if (e.key === 'Tab' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentWord) {
          saveLocalProgress(dictId, Number(chapterId), [currentWord.name]);
        }
        if (wordIndex < words.length - 1) {
          jumpTo(wordIndex + 1);
        } else if (hasNextChapter) {
          flushServerProgress();
          navigate(`/typing/${dictId}/${Number(chapterId) + 1}`);
        }
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (wordIndex > 0) {
          jumpTo(wordIndex - 1);
        } else if (Number(chapterId) > 0) {
          flushServerProgress();
          navigate(`/typing/${dictId}/${Number(chapterId) - 1}?wordIndex=999`);
        }
        return;
      }
      if (e.key === ' ') e.preventDefault();
      if (e.key === 'Backspace') { e.preventDefault(); handleBackspace(); return; }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); handleCharacterInput(e.key); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isMobile, isFinished, isWordListOpen, handleBackspace, handleCharacterInput, wordIndex, words.length, jumpTo, currentWord, dictId, chapterId, hasNextChapter, flushServerProgress, navigate]);

  // 输入处理：通过隐藏 input 代理键盘输入
  // 不清空 input 值（部分浏览器/IME 下清空不生效），改为智能 diff：
  // - 追加（拼音增长）：处理新增后缀
  // - 替换（中文字符→新拼音）：处理整个新值
  const handleInputChange = useCallback((e) => {
    if (isFinished) return;
    const inputType = e.nativeEvent?.inputType;
    const newVal = e.target.value;
    const oldVal = inputValueRef.current;

    // 检测是否在 IME 合成中（拼音输入）
    const isComposing = inputType === 'insertCompositionText' || isComposingRef.current;

    // IME 提交隔离：compositionEnd 已触发，此 onChange 携带的是中文提交字符
    // 跳过所有 diff 逻辑，重置输入值，防止触发虚假退格
    if (justCommittedRef.current) {
      justCommittedRef.current = false;
      inputValueRef.current = '';
      if (hiddenInputRef.current) hiddenInputRef.current.value = '';
      return;
    }

    if (newVal.startsWith(oldVal) && newVal.length > oldVal.length) {
      // 追加模式：拼音在增长，提取新增后缀中的英文字母
      // 使用 replace 而非整体正则，避免 IME 残留中文字符导致整批字母被丢弃
      const newChars = newVal.slice(oldVal.length);
      // 允许空格通过：复合词连字符已规范化为空格，用户按主面板空格键即可（连字符不在主面板）
      const asciiChars = newChars.replace(/[^a-zA-Z ]/g, '');
      if (asciiChars) {
        for (const ch of asciiChars) {
          handleCharacterInput(ch);
        }
      }
    } else if (newVal !== oldVal && /^[a-zA-Z]+$/.test(newVal) && !/^[a-zA-Z]+$/.test(oldVal)) {
      // 替换模式：中文字符被新拼音替换（如 "个" → "l"）
      // 此时 newVal 全是英文字母，oldVal 含非英文字符，处理整个 newVal
      for (const ch of newVal) {
        handleCharacterInput(ch);
      }
    } else if (newVal.length < oldVal.length && !isComposing) {
      // 仅当 newVal 是 oldVal 的前缀时才视为退格
      // IME 提交（拼音→中文字符）产生完全不同的字符串，不满足前缀关系
      if (oldVal.startsWith(newVal)) {
        handleBackspace();
      }
    }

    inputValueRef.current = newVal;

    // 非 ASCII 污染清理：如果追踪值含中文字符（IME 残留），重置输入
    // 不在合成中才清理，避免干扰正在进行的输入法组合
    if (!/^[\x00-\x7F]*$/.test(inputValueRef.current) && !isComposingRef.current) {
      inputValueRef.current = '';
      if (hiddenInputRef.current) hiddenInputRef.current.value = '';
    }
  }, [isFinished, handleCharacterInput, handleBackspace]);

  const handleInputBlur = useCallback(() => {
    if (isMobile) {
      // 延迟检查：键盘弹出动画期间可能短暂 blur 再 refocus，
      // 避免误将 keyboardActive 设为 false 导致 pointer-events-none 生效
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = setTimeout(() => {
        if (!document.activeElement || document.activeElement === document.body) {
          setKeyboardActive(false);
        }
      }, 300);
      return;
    }
    setTimeout(() => {
      if (isMobile) {
        try { hiddenInputRef.current?.focus({ preventScroll: true }); }
        catch { hiddenInputRef.current?.focus(); }
      } else {
        hiddenInputRef.current?.focus();
      }
    }, 100);
  }, [isMobile]);

  const handleTouchStart = useCallback((e) => {
    if (!isMobile || isFinished) return;
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, [isMobile, isFinished]);

  const handleTouchEnd = useCallback((e) => {
    if (!isMobile || isFinished || !touchStartRef.current) return;
    const start = touchStartRef.current;
    touchStartRef.current = null;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    const dt = Date.now() - start.t;
    const absX = Math.abs(dx), absY = Math.abs(dy);

    const SWIPE_THRESHOLD = 50;
    const TAP_THRESHOLD = 10;
    const SWIPE_MAX_DURATION = 800;

    if (absX > SWIPE_THRESHOLD && absX > absY && dt < SWIPE_MAX_DURATION) {
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 350);
      if (dx > 0 && wordIndex > 0) jumpTo(wordIndex - 1);
      else if (dx < 0 && wordIndex < words.length - 1) {
        if (currentWord) saveLocalProgress(dictId, Number(chapterId), [currentWord.name]);
        jumpTo(wordIndex + 1);
      }
      return;
    }

    if (!keyboardActive && absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
      setKeyboardActive(true);
      setTimeout(() => {
        try { hiddenInputRef.current?.focus({ preventScroll: true }); }
        catch { hiddenInputRef.current?.focus(); }
      }, 0);
    }
  }, [isMobile, isFinished, wordIndex, words.length, jumpTo, keyboardActive, currentWord, dictId, chapterId]);

  const handleGoHome = useCallback(() => {
    if (isErrorBookMode || isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode || isReviewMode) {
      navigate('/word');
    } else {
      navigate(`/dict/${dictId}`);
    }
  }, [navigate, dictId, isErrorBookMode, isReadingWordBookMode, isCorpusWordBookMode, isFavoriteWordBookMode, isReviewMode]);

  // 完成章节后延迟跳到下一章，让用户看到"已完成"状态
  useEffect(() => {
    if (!isFinished || !hasNextChapter) return;
    flushServerProgress();
    const timer = setTimeout(() => {
      navigate(`/typing/${dictId}/${Number(chapterId) + 1}`);
    }, 1500);
    return () => clearTimeout(timer);
  }, [isFinished, hasNextChapter, navigate, dictId, chapterId, flushServerProgress]);

  const handleDeleteCurrentWord = useCallback(() => {
    if (!currentWord || words.length === 0) return;
    if (isReviewMode) return;
    if (isErrorBookMode) {
      removeFromErrorBook(currentWord.name);
    } else if (isReadingWordBookMode) {
      removeFromReadingWordBook(currentWord.name);
    } else if (isCorpusWordBookMode) {
      removeFromCorpusWordBook(currentWord.name);
    } else if (isFavoriteWordBookMode) {
      removeFromFavoriteWords(currentWord.name);
    } else {
      return;
    }
    setWords(prev => prev.filter(w => w.name !== currentWord.name));
    // words 变化后 useTyping 的 useEffect 会自动重置输入、计时器、统计等状态
  }, [currentWord, words.length, isReviewMode, isErrorBookMode, isReadingWordBookMode, isCorpusWordBookMode, isFavoriteWordBookMode]);

  const handleWordRemovedFromModal = useCallback((wordName) => {
    setWords(prev => {
      if (!prev.some(w => w.name === wordName)) return prev;
      return prev.filter(w => w.name !== wordName);
    });
  }, []);

  const handleJumpToWord = useCallback((index) => {
    jumpTo(index);
    setIsWordListOpen(false);
    if (isMobile && keyboardActive) {
      try { hiddenInputRef.current?.focus({ preventScroll: true }); }
      catch { hiddenInputRef.current?.focus(); }
    }
  }, [jumpTo, isMobile, keyboardActive]);

  const handlePlaySound = useCallback((word) => {
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`);
    audio.play().catch(() => {});
  }, []);

  const showPhonetic = useMemo(() => config.showPhonetic && !config.dictationMode && !currentWord?.name?.includes(' '), [config.showPhonetic, config.dictationMode, currentWord?.name]);
  const showTranslation = useMemo(() => config.showTranslation && !config.dictationMode, [config.showTranslation, config.dictationMode]);

  if (loading) return (
    <div className="h-[calc(100dvh-3rem)] md:h-[calc(100vh-4rem)] bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500">
      <div className="text-center">
        <div className="animate-spin w-12 h-12 border-4 border-primary dark:border-primary-dark border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-content-tertiary dark:text-gray-400 text-sm">{isErrorBookMode ? '正在加载错题本...' : isReviewMode ? '正在加载复习计划...' : isReadingWordBookMode ? '正在加载阅读词本...' : isCorpusWordBookMode ? '正在加载语料词本...' : isFavoriteWordBookMode ? '正在加载收藏词本...' : '正在加载章节...'}</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="h-[calc(100dvh-3rem)] md:h-[calc(100vh-4rem)] bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500">
      <div className="text-center card p-8 shadow-lg dark:shadow-black/40 mx-4">
        <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="text-indigo-500 dark:text-violet-400 mb-6 font-medium">{error}</p>
        <button onClick={() => isErrorBookMode || isWordBookMode || isReviewMode ? navigate('/word') : navigate(`/dict/${dictId}`)} className="px-5 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20">{isFavoriteWordBookMode || isReviewMode ? '返回词库' : '返回章节列表'}</button>
      </div>
    </div>
  );

  if (words.length === 0) {
    if (isReviewMode) {
      return (
        <div className="h-[calc(100dvh-3rem)] md:h-[calc(100vh-4rem)] bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500">
          <div className="text-center card p-8 shadow-lg dark:shadow-black/40 mx-4">
            <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-emerald-600 dark:text-emerald-400 mb-2 font-medium text-xl">复习完成</p>
            <p className="text-content-tertiary dark:text-gray-400 mb-6">所有待复习单词已练习完毕！</p>
            <button onClick={() => navigate('/word')} className="px-5 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20">返回词库</button>
          </div>
        </div>
      );
    }
    if (isErrorBookMode || isWordBookMode) {
      const emptyTitle = isErrorBookMode
        ? '错题本已清空'
        : isReadingWordBookMode
        ? '阅读词本已清空'
        : isCorpusWordBookMode
        ? '语料词本已清空'
        : '收藏词本已清空';
      const emptyDesc = isErrorBookMode
        ? '所有单词都已练熟，去挑战新词库吧！'
        : isReadingWordBookMode
        ? '所有积累的词汇都已练习完毕，去阅读新文章吧！'
        : isCorpusWordBookMode
        ? '所有积累的词汇都已练习完毕，去刷新的语料吧！'
        : '收藏的词汇都已练习完毕，去收藏新的单词吧！';
      return (
        <div className="h-[calc(100dvh-3rem)] md:h-[calc(100vh-4rem)] bg-background dark:bg-transparent flex items-center justify-center transition-colors duration-500">
          <div className="text-center card p-8 shadow-lg dark:shadow-black/40 mx-4">
            <div className="w-16 h-16 bg-green-50 dark:bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-green-600 dark:text-green-400 mb-2 font-medium text-xl">{emptyTitle}</p>
            <p className="text-content-tertiary dark:text-gray-400 mb-6">{emptyDesc}</p>
            <button onClick={() => navigate('/word')} className="px-5 py-2.5 bg-primary hover:opacity-90 text-white rounded-button font-medium transition shadow-lg shadow-primary/20">返回词库</button>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="h-[var(--vv-height,calc(100dvh-3rem))] md:h-[calc(100vh-4rem)] flex bg-background dark:bg-transparent transition-colors duration-500 overflow-hidden"
      style={
        isMobile && viewportHeight
          ? { '--vv-height': `calc(${viewportHeight}px - 3rem)` }
          : undefined
      }
    >
      {/* 左侧可折叠单词列表 */}
      <div className={`
        transition-all duration-300 ease-in-out shrink-0 self-stretch
        ${isWordListOpen ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'}
      `}>
        <WordListPanel
          words={words}
          currentIndex={wordIndex}
          onPlaySound={handlePlaySound}
          onJumpTo={handleJumpToWord}
          onClose={() => setIsWordListOpen(false)}
        />
      </div>

      {/* 右侧主练习区 */}
      <div
        className={`flex-1 flex flex-col min-w-0 relative ${keyboardHeight > 0 ? 'justify-between' : ''}`}
        id="typing-container"
        onClick={() => {
          if (!isMobile) { hiddenInputRef.current?.focus(); return; }
          if (suppressClickRef.current) return;
          if (keyboardActive) {
            try { hiddenInputRef.current?.focus({ preventScroll: true }); }
            catch { hiddenInputRef.current?.focus(); }
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { touchStartRef.current = null; }}
      >
        {/* 左侧中部展开列表按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsWordListOpen(v => !v);
            if (isMobile) hiddenInputRef.current?.blur();
          }}
          className={`
            fixed left-2 md:left-4 top-[55%] md:top-1/2 -translate-y-1/2 z-[60] p-3 rounded-full shadow-lg
            transition-all duration-300 backdrop-blur-sm
            ${isWordListOpen
              ? 'opacity-0 pointer-events-none -translate-x-4'
              : 'opacity-100 translate-x-0 bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
            }
          `}
          title="章节单词列表"
        >
          <List className="w-5 h-5" />
        </button>

        {/* 顶部栏 */}
        <div className="min-h-12 md:h-14 shrink-0 flex items-center justify-between px-3 md:px-4 z-[60]">
          <button onClick={() => (isErrorBookMode || isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode || isReviewMode) ? navigate('/word') : navigate(`/dict/${dictId}`)} className="text-content-tertiary dark:text-gray-400 hover:text-primary dark:hover:text-primary-dark flex items-center gap-2 text-sm transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.04]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="hidden sm:inline">{(isErrorBookMode || isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode || isReviewMode) ? '返回词库' : '返回章节列表'}</span>
          </button>

          <div className="flex flex-col items-center">
            <div className="text-base font-semibold text-content dark:text-white">
              {isFinished
                ? <span className="text-green-600 dark:text-green-400">已完成 ✓</span>
                : isReviewMode ? '复习练习' : isErrorBookMode ? '错题本练习' : isReadingWordBookMode ? '阅读词本练习' : isCorpusWordBookMode ? '语料词本练习' : isFavoriteWordBookMode ? '收藏词本练习' : `第 ${wordIndex + 1} / ${words.length} 词`}
            </div>
            <div className="w-48 md:w-56 h-2 bg-gray-200 dark:bg-white/[0.08] rounded-full mt-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  isFinished
                    ? 'bg-green-500 dark:bg-green-400 shadow-[0_0_8px_rgba(34,197,94,0.5)]'
                    : 'bg-primary dark:bg-primary-dark shadow-[0_0_6px_rgba(99,102,241,0.45)] dark:shadow-[0_0_8px_rgba(129,140,248,0.5)]'
                }`}
                style={{ width: `${((wordIndex + 1) / words.length) * 100}%` }}
              />
            </div>
          </div>

          <TypingToolbar
            dictId={dictId}
            currentChapterId={chapterId}
            chapters={visibleChapters}
            config={config}
            toggleConfig={toggleConfig}
            updateConfig={updateConfig}
            theme={theme}
            setTheme={setTheme}
            onOpenWrongBook={() => setShowWrongBook(true)}
            isErrorBookMode={isErrorBookMode}
            isReadingWordBookMode={isReadingWordBookMode}
            isCorpusWordBookMode={isCorpusWordBookMode}
            isFavoriteWordBookMode={isFavoriteWordBookMode}
            onDeleteCurrentWord={handleDeleteCurrentWord}
            onToggleFavorite={handleToggleFavorite}
            isCurrentWordFavorited={isCurrentWordFavorited}
          />
        </div>

        {/* 单词前后预览 */}
        <NextWordPreview
          prevWord={wordIndex > 0 ? words[wordIndex - 1] : null}
          nextWord={wordIndex < words.length - 1 ? words[wordIndex + 1] : null}
          showTranslation={showTranslation}
        />

        {/* 单词显示 */}
        <div className={`flex flex-col items-center px-4 min-h-0 relative ${keyboardHeight > 0 ? 'flex-1 min-h-0 justify-start pt-2' : 'flex-1 justify-center overflow-hidden'}`}>
          {/* 隐藏输入框：桌面端接收 IME 事件，移动端代理键盘输入 */}
          <input
            ref={hiddenInputRef}
            type="text"
            onChange={handleInputChange}
            onCompositionStart={() => {
              isComposingRef.current = true;
              justCommittedRef.current = false; // 清除过期的提交标记
            }}
            onCompositionEnd={(e) => {
              const data = e.data;
              if (data && /^[a-zA-Z]+$/.test(data)) {
                for (const ch of data) {
                  handleCharacterInput(ch);
                }
              }
              // 不清空 input 值，避免浏览器/IME 拒绝清空导致 diff 失败
              // 让 onChange 自然追踪值变化
              isComposingRef.current = false;
              justCommittedRef.current = true; // 标记提交完成，等待 onChange 隔离
            }}
            onBlur={handleInputBlur}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            className={isMobile
              ? 'absolute inset-0 w-full h-full opacity-0 z-50'
              : 'fixed opacity-0 w-px h-px top-0 left-0 pointer-events-none'
            }
            style={{
              fontSize: '16px',
              caretColor: 'transparent',
            }}
          />
          <div className={`flex flex-col items-center text-center ${keyboardHeight > 0 ? 'gap-0.5' : 'gap-2 md:gap-10'}`}>
            {showPhonetic && (currentWord?.usphone || currentWord?.us || currentWord?.ukphone || currentWord?.uk) && (
              <div className={`text-gray-300 dark:text-gray-600 font-mono tracking-wide shrink-0 ${keyboardHeight > 0 ? 'text-lg mb-0' : 'text-xl md:text-5xl mb-1 md:mb-4'}`}>
                /{currentWord.usphone || currentWord.us || currentWord.ukphone || currentWord.uk}/
              </div>
            )}

            <div className="shrink-0">
              <WordDisplay key={currentWord?.name} word={currentWord} currentInput={currentInput} isWrong={isWrong} />
            </div>

            {currentWord?.trans && showTranslation && (
              <div className={`text-content-tertiary dark:text-gray-400 leading-relaxed md:leading-normal max-w-full md:max-w-2xl shrink-0 ${keyboardHeight > 0 ? 'text-xs' : 'text-sm md:text-2xl'}`}>
                {(Array.isArray(currentWord.trans) ? currentWord.trans.join('；') : currentWord.trans).split(/(\[[^\]]+\])/g).map((part, i) =>
                  /^\[.+\]$/.test(part)
                    ? <span key={i} className="text-content-tertiary dark:text-gray-500">{part}</span>
                    : part
                )}
              </div>
            )}
          </div>
        </div>

        <StatsPanel stats={stats} keyboardHeight={keyboardHeight} />

        {isFinished && !hasNextChapter && <ResultModal stats={stats} onRestart={reset} onGoHome={handleGoHome} onNextChapter={handleNextChapter} hasNextChapter={hasNextChapter} isErrorBookMode={isErrorBookMode} remainingErrorCount={remainingErrorCount} isReadingWordBookMode={isReadingWordBookMode} remainingReadingCount={remainingReadingCount} isCorpusWordBookMode={isCorpusWordBookMode} remainingCorpusCount={remainingCorpusCount} isFavoriteWordBookMode={isFavoriteWordBookMode} remainingFavoriteCount={remainingFavoriteCount} isReviewMode={isReviewMode} />}
        {showWrongBook && <WrongBookModal onClose={() => setShowWrongBook(false)} onWordRemoved={isErrorBookMode || isWordBookMode ? handleWordRemovedFromModal : undefined} />}
      </div>
    </div>
  );
}
