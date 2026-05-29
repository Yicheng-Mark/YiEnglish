import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export default function Dropdown({ label, value, options, onChange, formatOption, className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const display = value === '全部' ? label : (formatOption?.(value) || value)

  return (
    <div className={`relative w-full md:w-auto ${className || ''}`} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center gap-2 w-full px-4 py-2 glass-card rounded-button text-sm font-medium text-content-secondary dark:text-gray-300 hover:border-primary/40 transition-colors cursor-pointer"
      >
        <span>{display}</span>
        <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="dropdown-menu">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
              className={`dropdown-item ${
                value === opt ? 'dropdown-item-active' : 'dropdown-item-inactive'
              }`}
            >
              {opt === '全部' ? label : (formatOption?.(opt) || opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
