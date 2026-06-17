import React, { memo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

function NextWordPreview({ prevWord, nextWord, showTranslation, hideEnglish }) {
  const hasPrev = !!prevWord;
  const hasNext = !!nextWord;
  if (!hasPrev && !hasNext) return null;

  const formatTrans = (trans) => {
    const text = Array.isArray(trans) ? trans[0] : trans;
    if (!text) return '';
    return text.split(/[；;]/)[0];
  };

  return (
    <div className="absolute top-24 left-0 right-0 px-8 hidden lg:flex justify-between items-start z-10">
      {hasPrev ? (
        <div className="flex items-center gap-5 opacity-50 hover:opacity-80 transition-opacity cursor-default">
          <ArrowLeft className="w-7 h-7 text-slate-400 dark:text-slate-500 shrink-0" />
          <div className="text-left">
            {hideEnglish ? (
              <div className="h-8 w-28 rounded-md bg-slate-300/60 dark:bg-slate-600/50" />
            ) : (
              <p className="text-2xl font-mono text-slate-500 dark:text-slate-300">
                {prevWord.name}
              </p>
            )}
            {showTranslation && (
              <p className="text-lg text-slate-400 dark:text-slate-500 truncate max-w-[320px]">
                {formatTrans(prevWord.trans)}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div />
      )}

      {hasNext ? (
        <div className="flex items-center gap-5 opacity-50 hover:opacity-80 transition-opacity cursor-default">
          <div className="text-right">
            {hideEnglish ? (
              <div className="h-8 w-28 ml-auto rounded-md bg-slate-300/60 dark:bg-slate-600/50" />
            ) : (
              <p className="text-2xl font-mono text-slate-500 dark:text-slate-300">
                {nextWord.name}
              </p>
            )}
            {showTranslation && (
              <p className="text-lg text-slate-400 dark:text-slate-500 truncate max-w-[320px]">
                {formatTrans(nextWord.trans)}
              </p>
            )}
          </div>
          <ArrowRight className="w-7 h-7 text-slate-400 dark:text-slate-500 shrink-0" />
        </div>
      ) : (
        <div />
      )}
    </div>
  );
}

export default memo(NextWordPreview);
