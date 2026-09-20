import { useEffect } from 'react'

/**
 * VisualScheduleModal — ported from SHAGHOOF-AI-main, rebuilt on real data.
 * Predictability timeline for structure-support learners (ASD/SLCN): every
 * step is a real heading from the student's open lesson — nothing invented.
 * Steps unlock in order; completed lesson sections check off automatically.
 */
export default function VisualScheduleModal({ open, onClose, arabic, lesson, currentSection }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const steps = (lesson?.sections || [])
    .filter((s) => s.text && (s.type === 'heading' || s.type === 'subheading'))
    .map((s) => s.text)
  const total = steps.length
  const estimate = Math.max(2, Math.round((lesson?.word_count || total * 60) / 120))

  return (
    <div
      dir={arabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={arabic ? 'الجدول البصري للدرس' : 'Lesson visual schedule'}
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-100 text-xl dark:bg-indigo-950/40">🗓️</span>
            <div>
              <h2 className="text-base font-extrabold text-[var(--ink)]">{arabic ? 'الجدول البصري للدرس' : 'Predictability schedule'}</h2>
              <p className="text-xs text-[var(--muted)]">{arabic ? 'خارطة واضحة لخطوات الدرس — نفس الترتيب كل مرة' : 'A clear map of lesson steps — same order every time'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={arabic ? 'إغلاق' : 'Close'} className="rounded-xl p-2 text-xl text-[var(--muted)] transition hover:bg-[var(--page)] hover:text-[var(--ink)]">✕</button>
        </div>

        <p className="truncate border-b border-indigo-500/10 bg-indigo-500/5 px-5 py-3 text-xs font-extrabold text-[var(--ink)]">📚 {lesson?.title || (arabic ? 'الدرس الحالي' : 'Current lesson')}</p>

        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {total === 0 && (
            <p className="rounded-2xl border border-dashed border-[var(--line)] p-5 text-center text-xs text-[var(--muted)]">
              {arabic ? 'هذا الدرس لا يحتوي عناوين — افتح أي درس آخر لعرض الجدول.' : 'This lesson has no headings — open another lesson to see its schedule.'}
            </p>
          )}
          {steps.map((title, i) => {
            const num = i + 1
            const isCurrent = num === currentSection
            const isDone = num < currentSection
            return (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 rounded-2xl border p-3.5 transition-all ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-500/10 shadow-md ring-2 ring-indigo-500/20'
                    : isDone
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-[var(--line)] bg-[var(--page)] opacity-70'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                    isCurrent ? 'bg-indigo-500 text-white' : isDone ? 'bg-emerald-500 text-white' : 'bg-[var(--line)] text-[var(--muted)]'
                  }`}>
                    {isDone ? '✓' : num}
                  </span>
                  <div className="min-w-0">
                    <h4 className="truncate text-sm font-bold text-[var(--ink)]">{title}</h4>
                    <p className="text-[11px] text-[var(--muted)]">⏱ ~{estimate} {arabic ? 'دقائق' : 'mins'}</p>
                  </div>
                </div>
                {isCurrent && (
                  <span className="shrink-0 animate-pulse rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-bold text-indigo-600 dark:text-indigo-300">
                    {arabic ? 'أنت هنا' : 'You are here'}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {total > 0 && (
          <p className="border-t border-[var(--line)] p-3.5 text-center text-[11px] text-[var(--muted)]">
            {arabic
              ? `الوقت المتوقع: ~${total * estimate} دقيقة موزعة على ${total} محطات هادئة.`
              : `Estimated duration: ~${total * estimate} mins across ${total} calm checkpoints.`}
          </p>
        )}
      </div>
    </div>
  )
}
