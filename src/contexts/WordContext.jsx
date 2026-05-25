import { createContext, useContext, useState, useMemo } from 'react'

const WordContext = createContext(null)

export function WordProvider({ children }) {
  const [currentWord, setCurrentWord] = useState(null)
  const value = useMemo(() => ({ currentWord, setCurrentWord }), [currentWord])
  return <WordContext.Provider value={value}>{children}</WordContext.Provider>
}

export function useWordContext() {
  const ctx = useContext(WordContext)
  if (!ctx) throw new Error('useWordContext must be used within WordProvider')
  return ctx
}
