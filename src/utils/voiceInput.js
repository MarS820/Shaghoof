// Voice-to-text input (master plan: Dyslexia Suite — "answer via microphone;
// the system assesses meaning, not spelling"). Thin Web Speech API wrapper.

export function isVoiceInputSupported() {
  return typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition)
}

/**
 * Start listening; calls onText with the final transcript and onInterim with
 * live partial results so the UI can show what's being heard in real time.
 * Returns a stop() function.
 */
export function startVoiceInput({ lang = 'en-US', onText, onInterim, onError, continuous = false } = {}) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Recognition) {
    onError?.('unsupported')
    return () => {}
  }
  const recognition = new Recognition()
  recognition.lang = lang === 'ar' ? 'ar-EG' : 'en-US'
  recognition.interimResults = true
  recognition.continuous = continuous
  recognition.maxAlternatives = 1

  recognition.onresult = (event) => {
    let final = ''
    let interim = ''
    for (let i = 0; i < event.results.length; i += 1) {
      const result = event.results[i]
      if (result.isFinal) {
        final += result[0].transcript
      } else {
        interim += result[0].transcript
      }
    }
    if (interim.trim()) onInterim?.(interim.trim())
    if (final.trim()) onText?.(final.trim())
  }

  recognition.onerror = (event) => {
    // 'no-speech' and 'aborted' are transient — don't surface as errors
    if (event.error === 'no-speech' || event.error === 'aborted') return
    onError?.(event.error)
  }

  recognition.onend = () => {
    // Auto-restart if continuous and still wanted
    if (continuous && listeningGuard) {
      try { recognition.start() } catch { /* already started */ }
    }
  }

  let listeningGuard = continuous
  try { recognition.start() } catch { onError?.('start-failed') }
  return () => {
    listeningGuard = false
    try { recognition.stop() } catch { /* already stopped */ }
  }
}

export default { isVoiceInputSupported, startVoiceInput }
