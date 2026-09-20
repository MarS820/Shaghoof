// Browser text-to-speech with cancellation protection.
// A run id prevents cancelled utterances from resuming and speaking over the
// newest question - a common Chromium speechSynthesis behaviour.

let voices = []
let voicesLoaded = false
let speechRun = 0

function loadVoices() {
  if (!('speechSynthesis' in window)) return []
  voices = window.speechSynthesis.getVoices()
  voicesLoaded = true
  return voices
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = loadVoices
}

export function pickVoice(lang) {
  if (!voicesLoaded) loadVoices()
  if (!voices.length) return null
  const language = lang.toLowerCase()
  const local = voices.filter((voice) => voice.lang.toLowerCase().startsWith(language))
  const preferred = local.find((voice) => /premium|neural|enhanced|natural|online/i.test(voice.name))
  return preferred || local[0] || voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) || null
}

function splitIntoSentences(text) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim()
  if (!clean) return []
  return clean.split(/(?<=[.!؟?])\s+/).flatMap((sentence) => {
    if (sentence.length <= 170) return [sentence]
    return sentence.match(/.{1,170}(?:\s|$)/g) || [sentence]
  })
}

export function speak(text, { lang = 'en', rate = 0.84, pitch = 1, onEnd } = {}) {
  if (!('speechSynthesis' in window)) {
    onEnd?.()
    return
  }
  const chunks = splitIntoSentences(text)
  if (!chunks.length) return

  const runId = ++speechRun
  const voice = pickVoice(lang)
  const utteranceLanguage = lang === 'ar' ? 'ar-EG' : 'en-US'
  let index = 0
  window.speechSynthesis.cancel()

  const speakNext = () => {
    if (runId !== speechRun || index >= chunks.length) return
    const utterance = new SpeechSynthesisUtterance(chunks[index])
    utterance.lang = utteranceLanguage
    utterance.voice = voice || null
    utterance.rate = Math.max(0.72, Math.min(0.92, rate))
    utterance.pitch = pitch
    utterance.onend = () => {
      if (runId !== speechRun) return
      index += 1
      if (index < chunks.length) window.setTimeout(speakNext, 180)
      else onEnd?.()
    }
    utterance.onerror = () => { if (runId === speechRun) onEnd?.() }
    window.speechSynthesis.speak(utterance)
  }

  // Let a cancelled utterance leave the browser's internal queue first.
  window.setTimeout(speakNext, 120)
}

export function stopSpeaking() {
  speechRun += 1
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
}

// Sign language must be a verified signed-video asset, never an emoji or a
// text description pretending to be a sign. Questions can provide a local or
// trusted `sign_video` URL when such assets are licensed and available.
export function hasVerifiedSignVideo(question) {
  return Boolean(question?.sign_video)
}

export default { speak, stopSpeaking, hasVerifiedSignVideo, pickVoice }
