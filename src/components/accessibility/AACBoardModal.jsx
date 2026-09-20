import { useEffect } from 'react'

/**
 * AACBoardModal — ported from SHAGHOOF-AI-main.
 * Symbol communication board for non-verbal / minimal-speech learners (SLCN).
 * Tapping a symbol sends a ready-made phrase straight into the tutor chat.
 */
export default function AACBoardModal({ open, onClose, arabic, onSend }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const symbols = [
    { id: 'dont_understand', icon: '❓', label: arabic ? 'لم أفهم النقطة' : "I don't understand", msg: arabic ? 'لم أفهم هذه النقطة جيداً، هل يمكنك شرحها بأسلوب أبسط؟' : "I didn't quite understand this point. Could you explain it in simpler terms?", color: 'border-amber-400/40 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20' },
    { id: 'example', icon: '✨', label: arabic ? 'أعطني مثالاً' : 'Give me an example', msg: arabic ? 'هل يمكنك إعطائي مثالاً من الحياة اليومية؟' : 'Can you give me a real-world example?', color: 'border-amber-400/40 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20' },
    { id: 'slower', icon: '🐢', label: arabic ? 'اشرح أبطأ' : 'Explain slower', msg: arabic ? 'اشرح لي بخطوات أبطأ وأقصر من فضلك.' : 'Please explain in slower, smaller steps.', color: 'border-cyan-400/40 bg-cyan-50 hover:bg-cyan-100 dark:bg-cyan-950/20' },
    { id: 'next', icon: '⏩', label: arabic ? 'الجزء التالي' : 'Move next', msg: arabic ? 'فهمت هذه الجزئية! لننتقل إلى ما بعدها.' : 'I understand this part! Let us move to the next section.', color: 'border-indigo-400/40 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/20' },
    { id: 'break', icon: '☕', label: arabic ? 'أحتاج استراحة' : 'Need a break', msg: arabic ? 'أشعر بتعب ذهني، هل يمكننا أخذ استراحة دقيقة؟' : 'I feel mentally tired — can we take a 1-minute pause?', color: 'border-emerald-400/40 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/20' },
    { id: 'summary', icon: '✅', label: arabic ? 'خصّص النقاط المهمة' : 'Summarize key points', msg: arabic ? 'هل يمكنك تلخيص النقاط الأساسية في نقطتين؟' : 'Can you summarize the key points in two bullets?', color: 'border-blue-400/40 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20' },
    { id: 'confident', icon: '😄', label: arabic ? 'فهمت وأنا سعيد!' : 'I feel confident!', msg: arabic ? 'ممتاز! الشرح واضح جداً الآن.' : 'Awesome! The explanation is really clear now.', color: 'border-rose-400/40 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/20' },
    { id: 'repeat', icon: '🔁', label: arabic ? 'أعد الجزئية الأخيرة' : 'Repeat last part', msg: arabic ? 'هل يمكنك إعادة صياغة الجزئية الأخيرة بطريقة مختلفة؟' : 'Could you rephrase the last part differently?', color: 'border-teal-400/40 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20' },
  ]

  return (
    <div
      dir={arabic ? 'rtl' : 'ltr'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label={arabic ? 'لوحة الرموز' : 'AAC symbol board'}
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--line)] p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100 text-xl dark:bg-amber-950/40">💬</span>
            <div>
              <h2 className="text-base font-extrabold text-[var(--ink)]">{arabic ? 'لوحة التواصل بالرموز' : 'AAC Symbol Board'}</h2>
              <p className="text-xs text-[var(--muted)]">{arabic ? 'اضغط أي رمز للتواصل مع المعلّم فوراً' : 'Tap any icon to tell the AI tutor instantly'}</p>
            </div>
          </div>
          <button onClick={onClose} aria-label={arabic ? 'إغلاق' : 'Close'} className="rounded-xl p-2 text-xl text-[var(--muted)] transition hover:bg-[var(--page)] hover:text-[var(--ink)]">✕</button>
        </div>

        <div className="grid flex-1 grid-cols-2 gap-3 overflow-y-auto p-4 sm:grid-cols-4">
          {symbols.map((sym) => (
            <button
              key={sym.id}
              type="button"
              onClick={() => onSend(sym.msg)}
              className={`flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 text-center transition-bouncy hover:scale-[1.04] press-bubble ${sym.color}`}
            >
              <span className="text-2xl">{sym.icon}</span>
              <span className="text-xs font-extrabold leading-tight text-[var(--ink)]">{sym.label}</span>
            </button>
          ))}
        </div>

        <p className="border-t border-[var(--line)] p-3 text-center text-[11px] text-[var(--muted)]">
          {arabic ? 'لوحة مصممة للمتعلمين غير الناطقين أو الذين يفضلون التواصل السريع.' : 'Designed for non-verbal learners and quick expression without typing.'}
        </p>
      </div>
    </div>
  )
}
