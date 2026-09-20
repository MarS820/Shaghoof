import { useState, useEffect, useCallback, useRef } from 'react'
import { useApp } from '../context/AppContext'
import Mascot from './Mascot'

const BREAK_DURATION = 5 * 60 // 5 minutes in seconds
const ACTIVITY_THRESHOLD = 20 * 60 * 1000 // 20 minutes in ms

const BREATHING_STEPS = [
  { label: 'Breathe in', ar: 'تنفّس الصعداء', duration: 4 },
  { label: 'Hold', ar: 'احتبس', duration: 4 },
  { label: 'Breathe out', ar: 'زفر ببطء', duration: 6 },
  { label: 'Hold', ar: 'احتبس', duration: 2 },
]

const TIPS = [
  { en: 'Look at something 20 feet away for 20 seconds', ar: 'انظر إلى شيء على بعد ٢٠ قدمًا لمدة ٢٠ ثانية' },
  { en: 'Roll your shoulders back 5 times', ar: 'لف كتفيك للخلف ٥ مرات' },
  { en: 'Stretch your arms above your head', ar: 'مدّ ذراعيك فوق رأسك' },
  { en: 'Wiggle your toes and fingers', ar: 'حرّك أصابع قدميك ويديك' },
  { en: 'Take a sip of water', ar: 'رشفة ماء' },
  { en: 'Close your eyes and listen to your breathing', ar: 'أغمض عينيك واستمع إلى تنفّسك' },
]

function formatTime(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function BreakPage({ onDismiss }) {
  const { lang } = useApp()
  const arabic = lang === 'ar'
  const [remaining, setRemaining] = useState(BREAK_DURATION)
  const [breathStep, setBreathStep] = useState(0)
  const [breathCount, setBreathCount] = useState(0)
  const [tipIndex, setTipIndex] = useState(() => Math.floor(Math.random() * TIPS.length))
  const breathTimer = useRef(null)
  const tipTimer = useRef(null)

  // Countdown
  useEffect(() => {
    if (remaining <= 0) {
      onDismiss()
      return
    }
    const id = setInterval(() => setRemaining((r) => r - 1), 1000)
    return () => clearInterval(id)
  }, [remaining, onDismiss])

  // Breathing cycle
  useEffect(() => {
    const step = BREATHING_STEPS[breathStep]
    breathTimer.current = setTimeout(() => {
      const next = (breathStep + 1) % BREATHING_STEPS.length
      setBreathStep(next)
      if (next === 0) setBreathCount((c) => c + 1)
    }, step.duration * 1000)
    return () => clearTimeout(breathTimer.current)
  }, [breathStep])

  // Rotate tips
  useEffect(() => {
    tipTimer.current = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length)
    }, 15000)
    return () => clearInterval(tipTimer.current)
  }, [])

  const progress = ((BREAK_DURATION - remaining) / BREAK_DURATION) * 100
  const breathPhase = BREATHING_STEPS[breathStep]
  const tip = TIPS[tipIndex]

  // Breathing circle animation scale
  const breathScale = breathStep === 0 ? 1.3 : breathStep === 1 ? 1.3 : breathStep === 2 ? 1 : 1

  return (
    <div className="break-space-bg fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, var(--energy-violet), transparent 70%)', animation: 'ambientGlow 8s ease-in-out infinite alternate' }} />
        <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, var(--energy-blue), transparent 70%)', animation: 'ambientGlow 10s ease-in-out infinite alternate-reverse' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
        {/* Mascot */}
        <div className="mascot-float">
          <Mascot size={80} animate mood="idle" />
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl" style={{ fontFamily: 'var(--font-heading)' }}>
            {arabic ? 'وقت استراحة!' : 'Break Time!'}
          </h1>
          <p className="mt-2 text-sm text-white/60">
            {arabic ? 'استرخِ قليلاً ثم عد أقوى' : 'Relax for a moment, then come back stronger'}
          </p>
        </div>

        {/* Breathing circle */}
        <div className="relative flex items-center justify-center">
          <div
            className="flex h-40 w-40 items-center justify-center rounded-full transition-transform"
            style={{
              background: 'radial-gradient(circle, rgba(139,92,246,0.25), rgba(59,108,255,0.15) 70%, transparent)',
              transform: `scale(${breathScale})`,
              transitionDuration: `${BREATHING_STEPS[breathStep].duration}s`,
              transitionTimingFunction: 'ease-in-out',
            }}
          >
            <div className="flex h-28 w-28 items-center justify-center rounded-full" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}>
              <div className="text-center">
                <p className="text-lg font-extrabold text-white">{breathPhase.duration}s</p>
                <p className="text-[11px] font-bold text-white/70">{arabic ? breathPhase.ar : breathPhase.label}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timer ring */}
        <div className="relative flex items-center justify-center">
          <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
            <circle
              cx="40" cy="40" r="34" fill="none"
              stroke="url(#breakGradient)" strokeWidth="5" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 34}`}
              strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
              className="transition-all duration-1000"
            />
            <defs>
              <linearGradient id="breakGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--energy-violet)" />
                <stop offset="100%" stopColor="var(--energy-blue)" />
              </linearGradient>
            </defs>
          </svg>
          <span className="absolute text-lg font-extrabold text-white">{formatTime(remaining)}</span>
        </div>

        {/* Breathing count */}
        <p className="text-xs text-white/40">
          {arabic ? `دورة تنفس ${breathCount + 1}` : `Breathing cycle ${breathCount + 1}`}
        </p>

        {/* Tip */}
        <div className="max-w-xs rounded-2xl px-5 py-3" style={{ background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-xs font-bold text-white/80">
            {arabic ? tip.ar : tip.en}
          </p>
        </div>

        {/* Early dismiss (only after 2 minutes) */}
        {remaining <= BREAK_DURATION - 120 && (
          <button
            onClick={onDismiss}
            className="mt-2 rounded-full px-6 py-2 text-xs font-bold transition-bouncy hover:scale-105"
            style={{ background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)' }}
          >
            {arabic ? 'المتابعة' : 'Continue'}
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * Hook to manage the 20-minute activity timer.
 * Tracks user activity (mouse, keyboard, touch) and shows the break page
 * after 20 minutes of continuous activity.
 */
export function useBreakTimer() {
  const [showBreak, setShowBreak] = useState(() => {
    // Resume from sessionStorage if mid-break
    const breakUntil = sessionStorage.getItem('shaghoof_break_until')
    if (breakUntil && Date.now() < Number(breakUntil)) return true
    return false
  })
  const lastActivity = useRef(Date.now())
  const checkRef = useRef(null)

  const recordActivity = useCallback(() => {
    lastActivity.current = Date.now()
  }, [])

  // Dismiss handler
  const dismissBreak = useCallback(() => {
    setShowBreak(false)
    sessionStorage.removeItem('shaghoof_break_until')
    lastActivity.current = Date.now()
  }, [])

  // Listen for user activity
  useEffect(() => {
    if (showBreak) return

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll']
    events.forEach((e) => document.addEventListener(e, recordActivity, { passive: true }))
    return () => events.forEach((e) => document.removeEventListener(e, recordActivity))
  }, [showBreak, recordActivity])

  // Check activity every 30 seconds
  useEffect(() => {
    if (showBreak) return

    checkRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivity.current
      if (elapsed >= ACTIVITY_THRESHOLD) {
        setShowBreak(true)
        // Store break timestamp so page refreshes keep the break
        const breakEnd = Date.now() + BREAK_DURATION * 1000
        sessionStorage.setItem('shaghoof_break_until', String(breakEnd))
      }
    }, 30_000)

    return () => clearInterval(checkRef.current)
  }, [showBreak])

  return { showBreak, dismissBreak }
}
