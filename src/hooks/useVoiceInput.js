import { useState, useEffect, useRef, useCallback } from 'react'

const SpeechRecognition = typeof window !== 'undefined'
  ? window.SpeechRecognition || window.webkitSpeechRecognition
  : null

/**
 * Hook wrapping the Web Speech API.
 * Returns raw transcript — parsing happens server-side via /parse-voice.
 */
export function useVoiceInput({ onResult, onError } = {}) {
  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onResultRef.current = onResult
    onErrorRef.current = onError
  }, [onResult, onError])

  const isSupported = !!SpeechRecognition

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort()
        recognitionRef.current = null
      }
    }
  }, [])

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
  }, [])

  const startListening = useCallback(() => {
    if (!SpeechRecognition) {
      onErrorRef.current?.('Speech recognition not supported in this browser')
      return
    }

    if (recognitionRef.current) {
      recognitionRef.current.abort()
      recognitionRef.current = null
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setIsListening(true)
      setTranscript('')
    }

    recognition.onresult = (event) => {
      let finalTranscript = ''
      let interimTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0].transcript

        if (result.isFinal) {
          finalTranscript += text
        } else {
          interimTranscript += text
        }
      }

      setTranscript(interimTranscript || finalTranscript)

      if (finalTranscript) {
        // Pass raw transcript to caller — server-side parses player names + scores
        onResultRef.current?.(finalTranscript.trim())
      }
    }

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        setIsListening(false)
        setTranscript('')
        return
      }
      onErrorRef.current?.(event.error || 'Speech recognition error')
      setIsListening(false)
      setTranscript('')
    }

    recognition.onend = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch {
      setIsListening(false)
      recognitionRef.current = null
    }
  }, [])

  return { isListening, isSupported, transcript, startListening, stopListening }
}
