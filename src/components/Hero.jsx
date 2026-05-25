import { useEffect, useState } from 'react';

export default function Hero() {
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 800);
    return () => clearInterval(interval);
  }, []);

  const scrollToWordbooks = () => {
    const element = document.getElementById('wordbooks');
    if (element) {
      const offset = 80;
      const top = element.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });
    }
  };

  return (
    <section className="relative w-full min-h-[500px] h-[60vh] flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-indigo-900 text-white overflow-hidden">
      {/* 背景光晕装饰 */}
      <div className="absolute inset-0 opacity-10 pointer-events-none">
        <div className="absolute top-20 left-20 w-72 h-72 bg-indigo-500 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-500 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto">
        <h1 className="text-6xl md:text-8xl font-bold tracking-tight mb-4">
          LingoForge
          <span
            className={`inline-block ml-1 w-[3px] h-[0.9em] bg-indigo-400 align-middle transition-opacity duration-100 ${
              showCursor ? 'opacity-100' : 'opacity-0'
            }`}
          />
        </h1>

        <p className="text-2xl md:text-4xl text-slate-300 mb-8 font-light italic">
          Nothing is impossible.
        </p>

        <div className="flex justify-center items-center">
          <button
            onClick={scrollToWordbooks}
            className="px-8 py-3 bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-medium rounded-lg transition-all duration-200 shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5"
          >
            立即开始
          </button>
        </div>
      </div>

      {/* 向下滚动提示 */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}
