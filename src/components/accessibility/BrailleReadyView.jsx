import { useEffect } from 'react'
import { speak, stopSpeaking } from '../../services/speech'

/**
 * BrailleReadyView — ported from SHAGHOOF-AI-main's BrailleReaderOverlay.
 * A braille-display-ready plain-text rendering of the student's REAL lesson
 * (no demo content): headings, short lines, and vocabulary — the format
 * refreshable braille displays and screen readers handle best. Also reads
 * the text aloud for auditory learners.
 */
export default function BrailleReadyView({ lesson, arabic, lang, onClose }) {
  useEffect(() => () => stopSpeaking(), [])

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const lines = []
  lines.push(arabic ? '====== منصة شغوف - عرض قابل للبرايل ======' : '====== SHAGHOOF — Braille-ready view ======')
  lines.push(`[${arabic ? 'الدرس' : 'Lesson'}]: ${lesson?.title || ''}`)
  lines.push('-----------------------------------')
  if (lesson?.summary) lines.push(`[${arabic ? 'الملخص' : 'Summary'}]: ${lesson.summary}`)
  ;(lesson?.sections || []).forEach((s) => {
    if (!s.text) return
    if (s.type === 'heading' || s.type === 'subheading') {
      lines.push('')
      lines.push(s.text.toUpperCase())
    } else {
      // Short lines (~40 chars) so refreshable braille cells don't truncate mid-word.
      const words = s.text.split(' ')
      let line = ''
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 40) { lines.push(line.trim()); line = w }
        else line = `${line} ${w}`
      }
      if (line.trim()) lines.push(line.trim())
    }
  })
  if (lesson?.vocabulary?.length) {
    lines.push('')
    lines.push(arabic ? '[المفردات]' : '[Vocabulary]')
    lesson.vocabulary.slice(0, 10).forEach((v) => v?.term && lines.push(`${v.term}: ${v.definition || ''}`))
  }
  lines.push('')
  lines.push('===========================================')

  const fullText = lines.join('\n')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4" role="dialog" aria-modal="true" aria-label={arabic ? 'عرض برايل' : 'Braille-ready view'}>
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">⠿</span>
            <h2 className="text-base font-extrabold text-[var(--ink)]">{arabic ? 'عرض جاهز للبرايل' : 'Braille-ready view'}</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => speak(fullText, { lang, rate: 0.9 })} className="rounded-full bg-[var(--brand-light)] px-3 py-1.5 text-xs font-extrabold text-[var(--brand)] transition-bouncy hover:scale-105" aria-label={arabic ? 'استمع' : 'Read aloud'}>🔊 {arabic ? 'استمع' : 'Read aloud'}</button>
            <button onClick={() => { stopSpeaking(); onClose() }} aria-label={arabic ? 'إغلاق' : 'Close'} className="rounded-xl p-2 text-xl text-[var(--muted)] transition hover:bg-[var(--page)] hover:text-[var(--ink)]">✕</button>
          </div>
        </div>
        <pre className="flex-1 overflow-auto whitespace-pre-wrap p-5 font-mono text-xs leading-relaxed text-[var(--ink)]" dir={arabic ? 'rtl' : 'ltr'}>{fullText}</pre>
        <p className="border-t border-[var(--line)] p-3 text-center text-[11px] text-[var(--muted)]">
          {arabic ? 'نص مُهيأ لشاشات برايل وقارئات الشاشة: أسطر قصيرة وترتيب ثابت.' : 'Formatted for refreshable braille displays and screen readers: short lines, predictable order.'}
        </p>
      </div>
    </div>
  )
}
