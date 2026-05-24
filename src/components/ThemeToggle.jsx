import { useState, useRef, useEffect } from 'react';

const themes = [
  { key: 'light', label: '明亮', icon: '☀️', desc: '清新简洁', activeClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' },
  { key: 'gray',  label: '暗夜', icon: '🌙', desc: '沉稳深邃', activeClass: 'bg-gray-200 text-gray-700 dark:bg-white dark:text-gray-900' },
  { key: 'star',  label: '星空', icon: '✨', desc: '浩瀚星海', activeClass: 'bg-amber-100 text-amber-700 dark:bg-white dark:text-gray-900' },
  { key: 'warm',  label: '暖光', icon: '☕', desc: '温暖舒适', activeClass: 'bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400' },
];

export default function ThemeToggle({ theme, setTheme }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const current = themes.find(t => t.key === theme) || themes[0];

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="p-1 md:p-2 rounded-button hover:bg-primary/5 dark:hover:bg-white/[0.05] transition-colors text-content-secondary dark:text-gray-400 flex flex-col items-center gap-1"
        title="切换主题"
        aria-label="切换主题"
        aria-expanded={open}
      >
        <span className="text-base md:text-lg leading-none" aria-hidden="true">{current.icon}</span>
        <span className="text-[11px] hidden sm:inline">模式</span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-44 rounded-card overflow-hidden z-50 glass-card border border-gray-200/60 dark:border-white/[0.08] shadow-xl"
        >
          {themes.map((t) => {
            const active = theme === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                onClick={() => { setTheme(t.key); setOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                  active
                    ? t.activeClass
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.05] text-content-secondary dark:text-gray-300'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">{t.icon}</span>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm font-medium">{t.label}</span>
                  <span className="text-[10px] text-content-tertiary dark:text-gray-500">{t.desc}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
