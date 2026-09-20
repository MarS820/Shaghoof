import { useApp } from '../context/AppContext'

/**
 * XP Rain — "+5 XP" burst chips that float up whenever a micro-step is
 * completed (master plan: ADHD Suite → XP Rain). Renders a fixed viewport in
 * the bottom corner; chips animate up and fade out via CSS keyframes.
 */
export default function XPRain() {
  const { xpEvents } = useApp()

  return (
    <div className="xp-rain-viewport" aria-live="polite" aria-label="Experience points earned">
      {xpEvents.slice(-6).map((event) => (
        <div key={event.id} className="xp-rain-chip">
          ⭐ +{event.amount} XP{event.label ? <span className="ml-1 opacity-70 font-semibold">· {event.label}</span> : null}
        </div>
      ))}
    </div>
  )
}
