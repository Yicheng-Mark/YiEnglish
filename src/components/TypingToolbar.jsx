import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, Zap } from 'lucide-react';

const REPEAT_OPTIONS = [
  { value: 1, label: '1次' },
  { value: 3, label: '3次' },
  { value: 5, label: '5次' },
  { value: 8, label: '8次' },
  { value: 0, label: '无限' },
];

const TypingToolbar = memo(function TypingToolbar({ dictId, currentChapterId, chapters, config, toggleConfig, updateConfig, onOpenWrongBook, isErrorBookMode, isReadingWordBookMode, isCorpusWordBookMode, isFavoriteWordBookMode, onDeleteCurrentWord, onToggleFavorite, isCurrentWordFavorited }) {
  const navigate = useNavigate();
  const [showChapterMenu, setShowChapterMenu] = useState(false);
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);
  const currentIndex = chapters.findIndex(c => c.id === currentChapterId);

  const switchChapter = (chapterId) => { setShowChapterMenu(false); navigate(`/typing/${dictId}/${chapterId}`); };
  const selectRepeat = (value) => { updateConfig('wordRepeatCount', value); setShowRepeatMenu(false); };

  const repeatLabel = config.wordRepeatCount === 0 ? '∞' : `×${config.wordRepeatCount}`;

  const toolbarBtn = "p-1 md:p-2 rounded-button hover:bg-primary/5 dark:hover:bg-white/[0.05] transition-colors text-content-secondary dark:text-gray-400 flex flex-col items-center gap-1";
  const activeBtn = "bg-primary-soft text-primary dark:bg-primary-soft dark:text-primary-dark";
  const iconCls = "w-4 h-4 md:w-5 md:h-5";

  return (
    <div className="flex flex-col md:flex-row items-center gap-1 md:gap-1">
      {/* 第一行：核心功能 */}
      <div className="flex items-center gap-1 md:gap-1">
        {/* 自动消除开关 */}
        {(isErrorBookMode || isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode) && (
          <button
            onClick={() => toggleConfig('autoRemoveErrorWord')}
            className={`${toolbarBtn} ${config.autoRemoveErrorWord ? activeBtn : 'opacity-40'}`}
            title={config.autoRemoveErrorWord ? '自动消除：开启（一次打对自动移出错题本）' : '自动消除：关闭（仅手动移除）'}
          >
            <Zap className={iconCls} />
            <span className="text-[11px] hidden sm:inline">自动消除</span>
          </button>
        )}

        {/* 单词循环次数 */}
        <div className="relative">
          <button onClick={() => setShowRepeatMenu(!showRepeatMenu)} className={toolbarBtn} title="单词循环次数">
            <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="text-[11px]">{repeatLabel}</span>
          </button>
          {showRepeatMenu && (<><div className="fixed inset-0 z-40" onClick={() => setShowRepeatMenu(false)} /><div className="dropdown-menu w-36">
            {REPEAT_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => selectRepeat(opt.value)} className={`dropdown-item flex items-center justify-between ${config.wordRepeatCount === opt.value ? 'dropdown-item-active' : 'dropdown-item-inactive'}`}>
                <span>{opt.label}</span>
                {config.wordRepeatCount === opt.value && (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
            ))}
          </div></>)}
        </div>

        {!isErrorBookMode && !isReadingWordBookMode && !isCorpusWordBookMode && !isFavoriteWordBookMode && (
          <>
            <div className="relative">
              <button onClick={() => setShowChapterMenu(!showChapterMenu)} className={toolbarBtn} title="切换章节">
                <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                <span className="text-[11px] hidden sm:inline">章节</span>
              </button>
              {showChapterMenu && (<><div className="fixed inset-0 z-40" onClick={() => setShowChapterMenu(false)} /><div className="dropdown-menu w-48 max-h-64 overflow-y-auto">
                {chapters.map((ch) => (<button key={ch.id} onClick={() => switchChapter(ch.id)} className={`dropdown-item ${ch.id === currentChapterId ? 'dropdown-item-active' : 'dropdown-item-inactive'}`}>{ch.name}</button>))}
              </div></>)}
            </div>
          </>
        )}

        <button onClick={() => toggleConfig('soundEnabled')} className={`${toolbarBtn} ${!config.soundEnabled ? 'opacity-40' : ''}`} title={config.soundEnabled ? '关闭音效' : '开启音效'}>
          {config.soundEnabled ? (<svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>) : (<svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" /></svg>)}
          <span className="text-[11px] hidden sm:inline">音效</span>
        </button>

        <button onClick={() => toggleConfig('showTranslation')} className={`${toolbarBtn} ${!config.showTranslation ? activeBtn : ''}`} title={config.showTranslation ? '隐藏中文' : '显示中文'}>
          <span className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-md border border-current/50 font-bold text-sm">中</span>
          <span className="text-[11px] hidden sm:inline">隐藏中文</span>
        </button>

        <button onClick={() => toggleConfig('hideEnglish')} className={`${toolbarBtn} ${config.hideEnglish ? activeBtn : ''}`} title={config.hideEnglish ? '显示英文' : '隐藏英文'}>
          <span className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center rounded-md border border-current/50 font-bold text-sm">E</span>
          <span className="text-[11px] hidden sm:inline">隐藏英文</span>
        </button>
      </div>

      {/* 第二行：辅助功能 */}
      <div className="flex items-center gap-1 md:gap-1">
        <button onClick={onOpenWrongBook} className={toolbarBtn} title="错题本">
          <svg className={iconCls} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
          <span className="text-[11px] hidden sm:inline">错题本</span>
        </button>

        {!isFavoriteWordBookMode && onToggleFavorite && (
          <button onClick={onToggleFavorite} className={`${toolbarBtn} ${isCurrentWordFavorited ? '!text-amber-500 dark:!text-amber-400' : ''}`} title={isCurrentWordFavorited ? '取消收藏' : '收藏单词'}>
            <svg className={iconCls} fill={isCurrentWordFavorited ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
            <span className="text-[11px] hidden sm:inline">{isCurrentWordFavorited ? '已收藏' : '收藏'}</span>
          </button>
        )}

        {(isErrorBookMode || isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode) && onDeleteCurrentWord && (
          <button onClick={onDeleteCurrentWord} className={toolbarBtn} title={isErrorBookMode ? '练熟了，移出错题本' : isReadingWordBookMode ? '已掌握，移出阅读词本' : isCorpusWordBookMode ? '已掌握，移出语料词本' : '移出收藏词本'}>
            <Trash2 className={`${iconCls} text-red-500 hover:text-red-600`} />
            <span className="text-[11px] hidden sm:inline text-red-500">移除</span>
          </button>
        )}

      </div>
    </div>
  );
});

export default TypingToolbar;
