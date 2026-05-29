import React, { memo, useMemo, useRef, useEffect } from 'react';

const WordDisplay = memo(function WordDisplay({ word, currentInput, isWrong }) {
  const chars = useMemo(() => word?.name?.split('') || [], [word?.name]);
  const prevLenRef = useRef(0);

  // 单词切换时重置 prevLenRef，避免上一个单词的输入长度污染新单词
  useEffect(() => {
    prevLenRef.current = 0;
  }, [word?.name]);

  // 追踪输入长度变化，用于正确字符 pop 动画
  const newCorrectIndex = currentInput.length > prevLenRef.current ? currentInput.length - 1 : -1;
  prevLenRef.current = currentInput.length;

  return (
    <div className={`text-[clamp(2rem,8vw,4rem)] md:text-9xl font-mono tracking-[0.15em] flex gap-1.5 md:gap-4 justify-center select-none shrink-0 ${isWrong ? 'animate-shake' : ''}`}>
      {chars.map((char, i) => {
        let className;
        const isCorrect = i < currentInput.length && currentInput[i] === char;
        const isError = i < currentInput.length && currentInput[i] !== char;

        if (isCorrect) {
          className = 'text-primary dark:text-primary-dark dark:drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]';
        } else if (isError) {
          className = 'text-violet-500 dark:text-violet-400 dark:drop-shadow-[0_0_6px_rgba(139,92,246,0.4)]';
        } else if (i === currentInput.length) {
          className = 'text-primary dark:text-primary-dark';
        } else {
          className = 'text-gray-300 dark:text-gray-600';
        }

        const shouldPop = isCorrect && i === newCorrectIndex;

        return (
          <span
            key={`${word?.name}-${i}`}
            className={`${className} ${shouldPop ? 'animate-char-pop' : ''} transition-colors duration-75 inline-block`}
          >
            {char}
          </span>
        );
      })}
    </div>
  );
});

export default WordDisplay;
