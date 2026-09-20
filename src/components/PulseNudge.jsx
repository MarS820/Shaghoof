import { useEffect, useRef, useState } from 'react'
import { useApp } from '../context/AppContext'

/**
 * Pulse Nudge (master plan: ADHD Suite) — if the student pauses for more than
 * 4 seconds mid-lesson, the tutor pops a gentle "keep the momentum" prompt.
 * The parent passes `trigger` (increments on every student input); when the
 * pause exceeds the threshold, a nudge bubble appears near the input area.
 */
export default function PulseNudge({ trigger = 0, watching = true, onNudgeClick }) {
  const { lang } = useApp()
  const [visible, setVisible] = useState(false)
  const lastTrigger = useRef(trigger)
  const timerRef = useRef(null)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
  }

  useEffect(() => {
    if (!watching) return undefined
    lastTrigger.current = trigger
    setVisible(false)
    clearTimer()
    timerRef.current = setTimeout(() => setVisible(true), 6000)
    return clearTimer
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger, watching])

  const arabic = lang === 'ar'
  if (!watching || !visible) return null

  return (
    <div className="animate-nudge absolute -top-12 end-0 z-20 flex items-center gap-2 rounded-2xl border border-[var(--accent-orange)] bg-orange-50 px-3 py-2 shadow-lg dark:bg-orange-950/40" role="status">
      <span className="text-lg" aria-hidden="true">🔥</span>
      <span className="text-xs font-bold text-orange-700 dark:text-orange-300">
        {arabic ? 'خلّينا نكمل الزحام!' : "Let's keep the momentum!"}
      </span>
      <button
        type="button"
        onClick={() => { setVisible(false); onNudgeClick?.() }}
        className="rounded-full bg-[var(--accent-orange)] px-2 py-1 text-[10px] font-extrabold text-white transition-bouncy press-bubble"
      >
        {arabic ? 'كمّل' : 'Continue'}
      </button>
    </div>
  )
}
