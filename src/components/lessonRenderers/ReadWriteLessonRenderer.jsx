import { useEffect, useState } from 'react'
import { speak } from '../../services/speech'

/**
 * ReadWriteLessonRenderer — VARK "reading" + T4 Translator UI.
 * Ported from SHAGHOOF-AI-main's ReadWriteRenderer: click-to-define glossary,
 * section progress checkmarks, TTS on every line. All content comes from the
 * student's own lesson sections + vocabulary — no invented material.
 */
export default function ReadWriteLessonRenderer({ lesson, arabic, lang, toggles = {}, bilingual = false, getTranslation, onXp }) {
  const sections = (lesson?.sections || []).filter((s) => s.text)
  const vocab = (lesson?.vocabulary || [])
  const [definedTerm, setDefinedTerm] = useState(null)
  const [readSet, setReadSet] = useState(() => new Set())

  const markRead = (i) => {
    setReadSet((prev) => {
      const next = new Set(prev)
      if (!next.has(i)) {
        next.add(i)
        if (next.size === sections.length && sections.length > 1) onXp?.(15, arabic ? 'قراءة كاملة' : 'Full read')
        else onXp?.(3, arabic ? 'قراءة' : 'Read')
      }
      return next
    })
  }

  const listen = (text) => {
    speak(text, { lang, rate: 0.95 })
    onXp?.(2, arabic ? 'استماع' : 'Listen')
  }

  const findDefinition = (term) => {
    const hit = vocab.find((v) => v.term?.toLowerCase() === term.toLowerCase())
    if (hit) return hit.definition
    // Fall back to the sentence in the lesson that introduces the term.
    const section = sections.find((s) => s.type === 'paragraph' && s.text?.toLowerCase().includes(term.toLowerCase()))
    return section?.text?.slice(0, 180) || null
  }

  const glossaryTerms = vocab.map((v) => v.term).filter(Boolean)
  const conceptTerms = (lesson?.key_concepts || []).map((c) => (typeof c === 'string' ? c : c?.text)).filter(Boolean)

  return (
    <div className={`space-y-2 ${toggles.lineFocus ? 'line-focus-target line-focus-on' : ''}`}>
      {lesson?.summary && (
        <p className="rounded-xl bg-[var(--brand-light)] px-3 py-2 text-xs font-semibold text-[var(--brand)]">📖 {lesson.summary}</p>
      )}

      {sections.map((sec, i) => (
        <div key={i} className="animate-fade-in-up rounded-xl border border-transparent p-2 transition hover:border-[var(--line)] hover:bg-[var(--page)]" style={{ animationDelay: `${Math.min(i * 0.04, 0.3)}s` }}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {sec.type === 'heading' && <h3 className="text-sm font-extrabold text-[var(--ink)]">{sec.text}</h3>}
              {sec.type === 'subheading' && <h4 className="text-xs font-bold text-[var(--ink)]">{sec.text}</h4>}
              {sec.type === 'paragraph' && (
                <p className="text-xs leading-relaxed text-[var(--ink)]">
                  {sec.text}
                  {bilingual && <BilingualLine text={sec.text} getKey={`sec-${i}`} getTranslation={getTranslation} arabic={arabic} />}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-center gap-1">
              <button
                onClick={() => markRead(i)}
                aria-label={arabic ? 'تم القراءة' : 'Mark as read'}
                className={`flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-extrabold transition-bouncy ${readSet.has(i) ? 'border-green-400 bg-green-50 text-green-600 dark:bg-green-950/40 dark:text-green-300' : 'border-[var(--line)] text-[var(--muted)] hover:border-green-400'}`}
              >
                ✓
              </button>
              <button
                onClick={() => listen(sec.text, `rw-${i}`)}
                aria-label={arabic ? 'استمع' : 'Listen'}
                className="text-[11px] opacity-60 transition hover:opacity-100"
                title={arabic ? 'استمع لهذا الجزء' : 'Listen to this block'}
              >
                🔊
              </button>
            </div>
          </div>
        </div>
      ))}

      {/* Click-to-define glossary — T4 signature feature */}
      {(glossaryTerms.length > 0 || conceptTerms.length > 0) && (
        <div className="mt-3 rounded-2xl border border-purple-200 bg-purple-50 p-3 dark:border-purple-800 dark:bg-purple-950/30">
          <p className="mb-1.5 text-xs font-extrabold text-purple-700 dark:text-purple-300">👆 {arabic ? 'اضغط على أي مصطلح لتعريفه' : 'Click any term to define it'}</p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...glossaryTerms, ...conceptTerms])].slice(0, 14).map((term) => (
              <button
                key={term}
                onClick={() => setDefinedTerm(definedTerm === term ? null : term)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-bouncy press-bubble ${definedTerm === term ? 'border-purple-500 bg-white text-purple-700 dark:bg-purple-900' : 'border-purple-200 bg-white/60 text-purple-600 hover:scale-105 dark:border-purple-800 dark:text-purple-300'}`}
              >
                {term}
              </button>
            ))}
          </div>
          {definedTerm && (
            <div className="animate-bubble-in mt-2 rounded-xl border border-purple-200 bg-white p-2.5 dark:border-purple-800 dark:bg-slate-900">
              <p className="text-xs font-extrabold text-purple-700 dark:text-purple-300">{definedTerm}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--ink)]">
                {findDefinition(definedTerm) || (arabic ? 'لا يوجد تعريف مباشر في الدرس — اسأل المعلّم.' : 'No direct definition in this lesson — ask the tutor.')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Sentence starters — T4 support for writing about the lesson */}
      <details className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3">
        <summary className="cursor-pointer text-xs font-extrabold text-[var(--ink)]">✏️ {arabic ? 'بدايات جمل للتدوين' : 'Sentence starters'}</summary>
        <ul className="mt-2 space-y-1 text-[11px] text-[var(--muted)]">
          {(arabic
            ? ['الفكرة الرئيسية في هذا الدرس هي...', 'شيء جديد تعلمته هو...', 'هذا يذكّرني ب...', 'سؤال ما زال لديّ هو...']
            : ['The main idea of this lesson is...', 'Something new I learned is...', 'This reminds me of...', 'A question I still have is...']
          ).map((s, i) => <li key={i}>• {s}</li>)}
        </ul>
      </details>

      {/* Reading progress */}
      {sections.length > 1 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="brand-progress flex-1"><div className="brand-progress-fill transition-all" style={{ width: `${(readSet.size / sections.length) * 100}%` }} /></div>
          <span className="text-[10px] font-bold text-[var(--muted)]">{readSet.size}/{sections.length}</span>
        </div>
      )}
    </div>
  )
}

function BilingualLine({ text, getKey, getTranslation, arabic }) {
  const [out, setOut] = useState('')
  useEffect(() => {
    let live = true
    getTranslation?.(text, getKey).then((t) => { if (live) setOut(t) })
    return () => { live = false }
  }, [text, getKey, getTranslation])
  if (!out) return null
  return <span className="mt-1 block text-[11px] font-semibold text-emerald-600 dark:text-emerald-300" dir={arabic ? 'ltr' : 'rtl'}>{out}</span>
}
