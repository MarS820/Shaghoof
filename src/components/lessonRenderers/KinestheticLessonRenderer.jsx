import { useState } from 'react'

/**
 * KinestheticLessonRenderer — VARK "kinesthetic" + T1 Sandbox / T5 Explorer UI.
 * Ported from SHAGHOOF-AI-main's KinestheticRenderer: tap-to-reveal flip cards
 * and a micro-quest checklist — content pulled from the student's own lesson
 * concepts, objectives and sections. Micro-quests follow T1's 2-minute-chunk rule.
 */
export default function KinestheticLessonRenderer({ lesson, arabic, onXp, onAskTutor }) {
  const concepts = (lesson?.key_concepts || []).map((c) => (typeof c === 'string' ? c : c?.text)).filter(Boolean).slice(0, 6)
  const objectives = (lesson?.learning_objectives || []).slice(0, 3)
  const paragraphs = (lesson?.sections || []).filter((s) => s.type === 'paragraph' && s.text)

  // Tap-to-reveal: each card hides the lesson sentence that explains the concept.
  const [revealed, setRevealed] = useState(() => new Set())
  // Micro-quest: check off each objective by finding its supporting paragraph.
  const [doneQuests, setDoneQuests] = useState(() => new Set())

  const reveal = (i) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (!next.has(i)) {
        next.add(i)
        onXp?.(next.size === concepts.length && concepts.length > 1 ? 20 : 4, arabic ? 'اكتشاف' : 'Discover')
      }
      return next
    })
  }

  const completeQuest = (i) => {
    setDoneQuests((prev) => {
      const next = new Set(prev)
      if (!next.has(i)) {
        next.add(i)
        onXp?.(10, arabic ? 'مهمة' : 'Quest')
      }
      return next
    })
  }

  const detailFor = (concept) => {
    const sec = paragraphs.find((s) => s.text.toLowerCase().includes(concept.toLowerCase()))
    return sec?.text?.slice(0, 200) || null
  }

  if (!concepts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-xs font-semibold text-[var(--muted)]">
        {arabic ? 'هذا الدرس قصير — افتح تبويب القراءة أو اسأل المعلّم.' : 'This lesson is light on concepts — try the Read tab or ask the tutor.'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tap-to-reveal concept cards */}
      <div>
        <p className="mb-2 text-xs font-extrabold text-[var(--ink)]">🖐️ {arabic ? 'اضغط البطاقة لتكشف الفكرة' : 'Tap a card to reveal the idea'}</p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {concepts.map((c, i) => {
            const open = revealed.has(i)
            return (
              <button
                key={c}
                onClick={() => reveal(i)}
                aria-pressed={open}
                className={`group relative min-h-24 overflow-hidden rounded-2xl border-2 p-3 text-start transition-bouncy hover:-translate-y-1 press-bubble ${open ? 'border-[var(--brand)] bg-[var(--brand-light)]' : 'border-[var(--line)] bg-[var(--surface)] hover:border-[var(--brand)]'}`}
              >
                <span className="absolute end-2 top-2 text-[10px] font-extrabold text-[var(--muted)]">{i + 1}</span>
                {open ? (
                  <span className="block text-[11px] leading-snug text-[var(--ink)]">
                    <span className="mb-1 block text-xs font-extrabold text-[var(--brand)]">{c}</span>
                    {detailFor(c) || (arabic ? '✨ اكتشفتَ فكرة الدرس!' : '✨ You uncovered a core idea!')}
                  </span>
                ) : (
                  <span className="flex h-full flex-col items-center justify-center gap-1 text-center">
                    <span className="text-2xl transition-bouncy group-hover:scale-125">🎁</span>
                    <span className="text-[11px] font-extrabold text-[var(--muted)]">{c.length > 22 ? `${c.slice(0, 21)}…` : c}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {revealed.size > 0 && revealed.size < concepts.length && (
          <p className="mt-1.5 text-center text-[10px] font-bold text-[var(--muted)]">
            {arabic ? `كشفت ${revealed.size} من ${concepts.length}` : `${revealed.size} of ${concepts.length} revealed`}
          </p>
        )}
      </div>

      {/* Micro-quests — T1's 2-minute chunks built from the lesson's objectives */}
      {objectives.length > 0 && (
        <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
          <p className="mb-2 flex items-center justify-between text-xs font-extrabold text-orange-700 dark:text-orange-300">
            <span>🎯 {arabic ? 'مهام دقيقة (٢ دقيقة لكل مهمة)' : 'Micro-quests (2 min each)'}</span>
            <span>{doneQuests.size}/{objectives.length}</span>
          </p>
          <div className="space-y-1.5">
            {objectives.map((o, i) => {
              const done = doneQuests.has(i)
              return (
                <div key={i} className={`flex items-center gap-2 rounded-xl border bg-white p-2 transition ${done ? 'border-green-300 opacity-70' : 'border-orange-200'}`}>
                  <button
                    onClick={() => !done && completeQuest(i)}
                    aria-label={done ? (arabic ? 'مكتملة' : 'Done') : (arabic ? 'حدد كمكتملة' : 'Mark done')}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-extrabold transition-bouncy ${done ? 'border-green-400 bg-green-400 text-white' : 'border-orange-300 text-orange-400 hover:scale-110'}`}
                  >
                    {done ? '✓' : i + 1}
                  </button>
                  <span className={`flex-1 text-[11px] font-semibold ${done ? 'text-[var(--muted)] line-through' : 'text-[var(--ink)]'}`}>{o}</span>
                  {!done && (
                    <button
                      onClick={() => onAskTutor?.(arabic ? `ساعدني في تحقيق هذه المهمة: ${o}` : `Help me with this quest: ${o}`)}
                      className="shrink-0 rounded-full bg-orange-100 px-2 py-1 text-[10px] font-extrabold text-orange-700 transition-bouncy hover:scale-105"
                    >
                      💬
                    </button>
                  )}
                </div>
              )
            })}
          </div>
          {doneQuests.size === objectives.length && (
            <p className="animate-bubble-in mt-2 rounded-xl bg-green-100 p-2 text-center text-xs font-extrabold text-green-700 dark:bg-green-950/40 dark:text-green-300">
              🎉 {arabic ? 'أكملت كل المهام! +XP مطر' : 'All quests complete! XP rain earned'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
