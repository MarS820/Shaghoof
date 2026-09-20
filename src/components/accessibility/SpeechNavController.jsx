import { useEffect, useRef, useState } from 'react'
import { speak } from '../../services/speech'

const PAGE_ROUTES = {
  dashboard: '/dashboard', لوحة: '/dashboard', لوحتي: '/dashboard',
  courses: '/lessons', دروسي: '/lessons', مواد: '/lessons',
  profile: '/profile', ملفي: '/profile', الملف: '/profile',
  settings: '/settings', إعدادات: '/settings',
  home: '/', الرئيسية: '/',
}

export default function SpeechNavController({ enabled, arabic, lang }) {
  const [lastCommand, setLastCommand] = useState(null)
  const [interimText, setInterimText] = useState('')
  const [unsupported, setUnsupported] = useState(false)
  const listeningRef = useRef(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!enabled) {
      recognitionRef.current?.stop?.()
      listeningRef.current = false
      return undefined
    }

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) { setUnsupported(true); return undefined }
    setUnsupported(false)

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = arabic ? 'ar-EG' : 'en-US'
    rec.maxAlternatives = 1
    recognitionRef.current = rec

    const run = (raw) => {
      const cmd = (raw || '').toLowerCase().trim()
      if (!cmd) return
      const has = (...words) => words.some((w) => cmd.includes(w))

      if (has('down', 'أسفل', 'انزل', 'انزلي')) { window.scrollBy({ top: 420, behavior: 'smooth' }); setLastCommand('⬇'); return }
      if (has('up', 'أعلى', 'ارفع', 'ارفعي')) { window.scrollBy({ top: -420, behavior: 'smooth' }); setLastCommand('⬆'); return }
      if (has('top', 'بداية', 'أعلى الصفحة', 'فوق')) { window.scrollTo({ top: 0, behavior: 'smooth' }); setLastCommand('⤒'); return }
      if (has('back', 'رجوع', 'خلف', 'ارجع')) { window.history.back(); setLastCommand('←'); return }
      if (has('read', 'اقرأ', 'قراءة', 'اقري')) {
        const main = document.querySelector('main') || document.body
        speak((main.innerText || '').slice(0, 2200), { lang, rate: 0.95 })
        setLastCommand('🔊'); return
      }
      if (has('stop', 'توقف', 'كفى', 'اوقف', 'صمت')) { window.speechSynthesis?.cancel?.(); setLastCommand('⏹'); return }

      for (const [keyword, route] of Object.entries(PAGE_ROUTES)) {
        if (has(keyword)) { window.location.href = route; setLastCommand('🧭'); return }
      }
    }

    rec.onresult = (event) => {
      let interim = ''
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) { run(result[0].transcript); setInterimText('') }
        else { interim += result[0].transcript }
      }
      if (interim) setInterimText(interim)
    }

    rec.onend = () => {
      setInterimText('')
      if (listeningRef.current) { try { rec.start() } catch {} }
    }
    rec.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') return
      if (event.error === 'not-allowed') setUnsupported(true)
    }

    try { rec.start(); listeningRef.current = true } catch { setUnsupported(true) }
    return () => { listeningRef.current = false; try { rec.stop() } catch {} }
  }, [enabled, arabic, lang])

  if (!enabled) return null
  if (unsupported) {
    return (
      <div className="fixed bottom-24 start-4 z-50 rounded-2xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700 shadow-lg dark:bg-amber-950/40 dark:text-amber-300">
        {arabic ? 'التحكم الصوتي غير مدعوم في هذا المتصفح.' : 'Voice control is not supported in this browser.'}
      </div>
    )
  }

  return (
    <div className="fixed bottom-24 start-4 z-50 flex items-center gap-2 rounded-full border-2 border-indigo-300 bg-indigo-50 px-3 py-1.5 shadow-lg dark:border-indigo-700 dark:bg-indigo-950/60" aria-live="polite">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-500" />
      </span>
      <span className="text-[11px] font-extrabold text-indigo-700 dark:text-indigo-300">{arabic ? 'التحكم الصوتي فعال' : 'Voice control on'}</span>
      {lastCommand && <span className="rounded-full bg-white px-2 py-0.5 text-xs font-black text-indigo-600 dark:bg-slate-900 dark:text-indigo-300">{lastCommand}</span>}
      {interimText && <span className="max-w-[140px] truncate text-[10px] italic text-indigo-400 dark:text-indigo-500">{interimText}</span>}
    </div>
  )
}
