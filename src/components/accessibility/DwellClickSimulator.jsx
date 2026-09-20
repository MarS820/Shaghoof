import { useEffect, useRef, useState } from 'react'

/**
 * DwellClickSimulator — ported from SHAGHOOF-AI-main.
 * For learners who cannot click reliably (motor difficulties): hovering any
 * button/link for ~1.2s shows a countdown ring and then activates it.
 * Enabled via the dwellClick toggle.
 */
export default function DwellClickSimulator({ enabled }) {
  const [coords, setCoords] = useState(null)
  const [progress, setProgress] = useState(0)
  const [hovering, setHovering] = useState(false)
  const rafRef = useRef(null)
  const cooldownRef = useRef(false)

  useEffect(() => {
    if (!enabled) {
      setCoords(null)
      setProgress(0)
      setHovering(false)
      return undefined
    }

    let interval = null
    let targetEl = null

    const onMove = (e) => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        setCoords({ x: e.clientX, y: e.clientY })
        if (cooldownRef.current) return

        const el = document.elementFromPoint(e.clientX, e.clientY)
        const clickable = el?.closest('button:not(:disabled), a, select, [role="button"]:not([aria-disabled="true"])')
        if (clickable && clickable.getAttribute('type') === 'range') return

        if (clickable && clickable !== targetEl) {
          targetEl = clickable
          setHovering(true)
          setProgress(0)
          if (interval) clearInterval(interval)
          let current = 0
          interval = setInterval(() => {
            current += 10
            setProgress(current)
            if (current >= 100) {
              clearInterval(interval)
              cooldownRef.current = true
              clickable.click()
              setProgress(0)
              setHovering(false)
              targetEl = null
              setTimeout(() => { cooldownRef.current = false }, 1000)
            }
          }, 120)
        } else if (!clickable) {
          targetEl = null
          setHovering(false)
          setProgress(0)
          if (interval) clearInterval(interval)
        }
      })
    }

    window.addEventListener('mousemove', onMove)
    return () => {
      window.removeEventListener('mousemove', onMove)
      if (interval) clearInterval(interval)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [enabled])

  if (!enabled || !coords || !hovering) return null

  return (
    <div className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2" style={{ left: coords.x, top: coords.y }} aria-hidden="true">
      <div className="relative flex h-12 w-12 items-center justify-center">
        <svg className="h-12 w-12 -rotate-90">
          <circle cx="24" cy="24" r="20" className="fill-none stroke-[4] stroke-slate-300 dark:stroke-slate-700" />
          <circle
            cx="24" cy="24" r="20"
            className="fill-none stroke-[4] stroke-amber-500 transition-all duration-100 ease-linear"
            strokeDasharray={125.6}
            strokeDashoffset={125.6 - (125.6 * progress) / 100}
          />
        </svg>
        <span className="absolute font-mono text-[10px] font-black text-amber-500">{Math.round(progress)}%</span>
      </div>
    </div>
  )
}
