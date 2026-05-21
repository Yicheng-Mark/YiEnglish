import { useState, useRef, useEffect, useCallback } from 'react'

export function useSpeechRecognition() {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [isSupported, setIsSupported] = useState(false)
  const recognitionRef = useRef(null)
  const restartRef = useRef(false)

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setIsSupported(false)
      return
    }

    setIsSupported(true)
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'zh-CN'
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) {
          finalText += result[0].transcript
        } else {
          interimText += result[0].transcript
        }
      }
      setTranscript(finalText || interimText)
    }

    recognition.onend = () => {
      setIsListening(false)
      restartRef.current = false
    }

    recognition.onerror = (event) => {
      // 'no-speech' and 'aborted' are not real errors
      if (event.error !== 'no-speech' && event.error !== 'aborted') {
        console.warn('[SpeechRecognition error]', event.error)
      }
      setIsListening(false)
      restartRef.current = false
    }

    recognitionRef.current = recognition

    return () => {
      recognitionRef.current = null
    }
  }, [])

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return
    setTranscript('')
    try {
      recognitionRef.current.start()
      setIsListening(true)
    } catch (err) {
      // Already started
      if (err.name !== 'InvalidStateError') {
        console.warn('[SpeechRecognition start error]', err)
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return
    try {
      recognitionRef.current.stop()
    } catch {
      // Already stopped
    }
    setIsListening(false)
    return transcript
  }, [transcript])

  return {
    isSupported,
    isListening,
    transcript,
    startListening,
    stopListening,
  }
}
