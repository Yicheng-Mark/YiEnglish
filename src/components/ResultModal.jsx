import { memo } from 'react';

function ResultModal({ stats, onRestart, onGoHome, onNextChapter, hasNextChapter, isErrorBookMode, remainingErrorCount = 0, isReadingWordBookMode, remainingReadingCount = 0, isCorpusWordBookMode, remainingCorpusCount = 0, isFavoriteWordBookMode, remainingFavoriteCount = 0 }) {
  const statItems = [
    {
      label: '用时',
      value: `${stats.time}s`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'WPM',
      value: stats.wpm,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
    },
    {
      label: '正确字母',
      value: stats.correctCount,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: '正确率',
      value: `${Math.round(stats.accuracy * 100)}%`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="text-center mb-2">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30 dark:shadow-primary/40">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-title text-content dark:text-white">{isErrorBookMode ? '错题复习完成' : isReadingWordBookMode ? '阅读词本练习完成' : isCorpusWordBookMode ? '语料词本练习完成' : isFavoriteWordBookMode ? '收藏词本练习完成' : '章节完成！'}</h2>
          <p className="text-sm text-content-tertiary dark:text-gray-400 mt-1">
            {isErrorBookMode
              ? (remainingErrorCount > 0 ? `还有 ${remainingErrorCount} 个错题待复习` : '本次错题已全部复习完毕')
              : isReadingWordBookMode
              ? (remainingReadingCount > 0 ? `还有 ${remainingReadingCount} 个词汇待练习` : '本次阅读词本已全部练习完毕')
              : isCorpusWordBookMode
              ? (remainingCorpusCount > 0 ? `还有 ${remainingCorpusCount} 个词汇待练习` : '本次语料词本已全部练习完毕')
              : isFavoriteWordBookMode
              ? (remainingFavoriteCount > 0 ? `还有 ${remainingFavoriteCount} 个词汇待练习` : '本次收藏词本已全部练习完毕')
              : '太棒了，继续加油'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-8 mt-6">
          {statItems.map((item) => (
            <div key={item.label} className="stat-box">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-primary dark:text-primary-dark">{item.icon}</span>
                <div className="text-2xl font-extrabold text-primary dark:text-primary-dark">{item.value}</div>
              </div>
              <div className="text-xs text-content-tertiary dark:text-gray-400">{item.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3">
          {hasNextChapter && onNextChapter && (
            <button onClick={onNextChapter} className="btn-primary w-full">
              下一章
            </button>
          )}
          <div className="flex gap-3">
            {((!isErrorBookMode && !isReadingWordBookMode && !isCorpusWordBookMode && !isFavoriteWordBookMode) || remainingErrorCount > 0 || remainingReadingCount > 0 || remainingCorpusCount > 0 || remainingFavoriteCount > 0) && (
              <button onClick={onRestart} className={`${hasNextChapter ? 'btn-secondary' : 'btn-primary'} flex-1`}>
                {isErrorBookMode ? '继续错题练习' : isReadingWordBookMode ? '继续阅读词本练习' : isCorpusWordBookMode ? '继续语料词本练习' : isFavoriteWordBookMode ? '继续收藏词本练习' : '再来一次'}
              </button>
            )}
            {onGoHome && (
              <button onClick={onGoHome} className={`btn-secondary ${((!isErrorBookMode && !isReadingWordBookMode && !isCorpusWordBookMode && !isFavoriteWordBookMode) || remainingErrorCount > 0 || remainingReadingCount > 0 || remainingCorpusCount > 0 || remainingFavoriteCount > 0) ? 'flex-1' : 'w-full'}`}>
                {isErrorBookMode || isReadingWordBookMode || isCorpusWordBookMode || isFavoriteWordBookMode ? '返回词库' : '返回首页'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default memo(ResultModal);
