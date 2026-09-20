import { useState } from 'react'
import { speak, stopSpeaking } from '../../services/speech'

/**
 * AudioLessonRenderer — VARK "auditory" + T2 Podcast UI.
 * Ported from SHAGHOOF-AI-main's AudioRenderer: large play button, animated
 * waveform, speed control, chapter list — chapters are the lesson's own
 * sections, and the transcript is the lesson text itself.
 */
export default function AudioLessonRenderer({ lesson, arabic, lang, onXp }) {
  const sections = (lesson?.sections || []).filter((s) => s.text)
  const [speed, setSpeed] = useState(1)
  const [speaking, setSpeaking] = useState(false)
  const [activeChapter, setActiveChapter] = useState(0)
  const [showTranscript, setShowTranscript] = useState(true)

  const chapterText = (idx) => sections[idx]?.text || ''
  const fullText = sections.map((s) => s.text).join(' ')

  const play = (idx = activeChapter, rate = speed) => {
    if (!sections.length) return
    stopSpeaking()
    setSpeaking(true)
    setActiveChapter(idx)
    onXp?.(5, arabic ? 'استماع' : 'Listen')
    speak(chapterText(idx) || fullText, { lang, rate, onEnd: () => setSpeaking(false) })
  }

  const togglePlay = () => {
    if (speaking) { stopSpeaking(); setSpeaking(false) } else { play() }
  }

  const chapters = sections.slice(0, 12)

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-purple-200 bg-gradient-to-r from-white via-purple-50 to-white p-5 dark:border-purple-800 dark:from-slate-900 dark:via-purple-950/30 dark:to-slate-900">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-lg dark:bg-purple-950/60">🎧</span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold text-[var(--ink)]">{arabic ? 'البودكاست الدراسي' : 'Lesson podcast'}</h3>
              <p className="truncate text-xs text-[var(--muted)]">{chapters.length} {arabic ? 'فصول من درسك' : 'chapters from your lesson'}</p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-[10px] font-bold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300">🎙️ {arabic ? 'صوت HD' : 'HD audio'}</span>
        </div>

        {/* Animated equalizer */}
        <div className="mt-4 flex h-16 items-center justify-center gap-1.5 rounded-xl border border-purple-100 bg-purple-50/50 px-4 dark:border-slate-800 dark:bg-slate-950/40" aria-hidden="true">
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className={`w-1.5 rounded-full transition-all duration-150 ${speaking ? 'animate-pulse' : ''}`}
              style={{
                height: speaking ? `${Math.sin(i / 2 + Date.now() / 500) * 18 + 26}px` : `${((i % 5) + 1) * 7}px`,
                backgroundColor: i % 3 === 0 ? '#0284C7' : i % 2 === 0 ? '#7C3AED' : '#FF4D2D',
                animationDelay: `${i * 0.08}s`,
              }}
            />
          ))}
        </div>

        {/* Controls: speed selector + big play + transcript toggle */}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-purple-100 pt-3 dark:border-slate-800">
          <div className="flex items-center gap-1 rounded-lg border border-purple-100 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
            {[0.75, 1, 1.25, 1.5].map((s) => (
              <button key={s} type="button" onClick={() => { setSpeed(s); if (speaking) play(activeChapter, s) }}
                aria-label={`${s}x`}
                className={`rounded px-1.5 py-0.5 text-[11px] font-bold transition ${speed === s ? 'bg-purple-600 text-white' : 'text-[var(--muted)] hover:text-[var(--ink)]'}`}>
                {s}x
              </button>
            ))}
          </div>
          <button type="button" onClick={togglePlay} disabled={!sections.length}
            aria-label={speaking ? (arabic ? 'إيقاف' : 'Pause') : (arabic ? 'تشغيل' : 'Play')}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-[var(--accent-orange)] text-lg text-white shadow-lg transition-bouncy hover:scale-105 press-bubble disabled:opacity-50">
            {speaking ? '⏸' : '▶'}
          </button>
          <button type="button" onClick={() => setShowTranscript((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition ${showTranscript ? 'border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300' : 'border-[var(--line)] text-[var(--muted)]'}`}>
            📜 {arabic ? 'النص' : 'Transcript'}
          </button>
        </div>
      </div>

      {/* Chapters = the lesson's own sections */}
      {chapters.length > 0 && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-xs font-bold text-[var(--ink)]">⏱ {arabic ? 'فصول الدرس:' : 'Chapters:'}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {chapters.map((sec, idx) => (
              <button key={idx} onClick={() => play(idx)}
                className={`flex items-center justify-between rounded-xl border p-2.5 text-start text-xs transition ${activeChapter === idx && speaking ? 'border-purple-500 bg-purple-500/10 font-bold text-purple-600 dark:text-purple-300' : 'border-[var(--line)] bg-[var(--page)] hover:bg-[var(--brand-light)]'}`}>
                <span className="truncate">{(sec.text || '').slice(0, 46)}…</span>
                <span className="ml-2 shrink-0 rounded bg-[var(--brand-light)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--brand)]">{idx + 1}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {showTranscript && (
        <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-xs font-bold text-[var(--ink)]">📜 {arabic ? 'النص المتزامن (من درسك):' : 'Synchronized transcript (from your lesson):'}</p>
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--page)] p-3">
            {sections.map((s, i) => (
              <p key={i} className={`cursor-pointer rounded-lg p-1.5 text-xs leading-relaxed transition hover:bg-[var(--brand-light)] ${activeChapter === i && speaking ? 'bg-purple-500/10 font-bold' : ''} text-[var(--ink)]`}
                onClick={() => play(i)} role="button" tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && play(i)}>
                {s.text}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
