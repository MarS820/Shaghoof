import { useEffect, useState } from 'react'

/**
 * LineFocusRuler — ported from SHAGHOOF-AI-main.
 * Dimmed overlays with a 60px reading window following the mouse.
 * Helps readers with dyslexia keep their place. Enabled via the
 * lineFocus accessibility toggle.
 */
export default function LineFocusRuler({ enabled }) {
  const [mouseY, setMouseY] = useState(200)

  useEffect(() => {
    if (!enabled) return undefined
    const onMove = (e) => setMouseY(e.clientY)
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [enabled])

  if (!enabled) return null

  const rulerHeight = 60

  return (
    <div className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden" aria-hidden="true">
      <div className="absolute left-0 right-0 top-0 bg-black/60 transition-all duration-75" style={{ height: `${Math.max(0, mouseY - rulerHeight / 2)}px` }} />
      <div
        className="absolute left-0 right-0 border-y-2 border-sky-400/80 bg-sky-400/10 shadow-[0_0_15px_rgba(56,189,248,0.2)] transition-all duration-75"
        style={{ top: `${Math.max(0, mouseY - rulerHeight / 2)}px`, height: `${rulerHeight}px` }}
      />
      <div className="absolute bottom-0 left-0 right-0 bg-black/60 transition-all duration-75" style={{ top: `${mouseY + rulerHeight / 2}px` }} />
    </div>
  )
}
