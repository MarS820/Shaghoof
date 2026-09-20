import { useEffect, useRef, useState, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'

const NOISE_KINDS = ['rain', 'cafe', 'waves']

const NOISE_LABELS = {
  rain: { en: 'Rain', ar: 'مطر' },
  cafe: { en: 'Coffee shop', ar: 'مقهى' },
  waves: { en: 'Waves', ar: 'أمواج' },
}

const BREAK_INTERVAL_MS = 15 * 60 * 1000
const WORK_KEY = 'shaghoof_last_activity'
const NOISE_PREF_KEY = 'shaghoof_noise_kind'

function touchActivity() {
  try { localStorage.setItem(WORK_KEY, String(Date.now())) } catch {}
}

/**
 * Procedural ambient sound — synthesized with the Web Audio API so it works
 * with zero network dependency (the old CDN mp3 URLs 404'd / were CORS-blocked,
 * which is why white noise never played).
 *  - rain: filtered white noise with random droplet blips
 *  - cafe: brown-ish noise + soft murmur modulation
 *  - waves: slow LFO-swell pink noise (ocean rhythm)
 */
function createNoiseEngine(kind) {
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  const ctx = new Ctx()

  // Buffer of looping noise (2 seconds)
  const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  if (kind === 'cafe') {
    // Brown noise: integrate white noise for a low rumble
    let last = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    }
  } else if (kind === 'waves') {
    // Pink-ish noise via simple filter approximation
    let b0 = 0; let b1 = 0
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + white * 0.099
      b1 = 0.963 * b1 + white * 0.283
      data[i] = (b0 + b1 + white * 0.1) * 0.6
    }
  } else {
    // rain: plain white noise, shaped by the bandpass below
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1
  }

  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true

  // Tone shaping per kind
  const filter = ctx.createBiquadFilter()
  if (kind === 'rain') {
    filter.type = 'bandpass'; filter.frequency.value = 1400; filter.Q.value = 0.6
  } else if (kind === 'cafe') {
    filter.type = 'lowpass'; filter.frequency.value = 700
  } else {
    filter.type = 'lowpass'; filter.frequency.value = 900
  }

  const gain = ctx.createGain()
  gain.gain.value = 0

  src.connect(filter).connect(gain).connect(ctx.destination)

  // Waves: slow LFO swelling the gain (ocean rhythm)
  let lfo = null
  let lfoGain = null
  if (kind === 'waves') {
    lfo = ctx.createOscillator()
    lfo.frequency.value = 0.12
    lfoGain = ctx.createGain()
    lfoGain.gain.value = 0.05
    lfo.connect(lfoGain).connect(gain.gain)
    lfo.start()
  }

  // Rain: sparse droplet blips
  let dropletTimer = null
  if (kind === 'rain') {
    dropletTimer = setInterval(() => {
      if (ctx.state !== 'running') return
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.frequency.value = 600 + Math.random() * 900
      g.gain.setValueAtTime(0.015, ctx.currentTime)
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09)
      osc.connect(g).connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.1)
    }, 320)
  }

  src.start()

  // Browsers start AudioContexts suspended until a user gesture resumes them;
  // without this the engine "plays" but stays silent.
  ctx.resume?.().catch(() => {})

  // Gentle fade-in
  gain.gain.linearRampToValueAtTime(0.16, ctx.currentTime + 1.2)

  let stopped = false
  return {
    stop: () => {
      if (stopped) return
      stopped = true
      try {
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.5)
        setTimeout(() => {
          try { src.stop() } catch { /* already stopped */ }
          try { ctx.close() } catch { /* already closed */ }
          if (dropletTimer) clearInterval(dropletTimer)
        }, 600)
      } catch { /* noop */ }
    },
  }
}

/**
 * Retention mechanics layer (master plan: Retention Psychology + SEMH suite):
 *  - Break Reminder: after 15 min of continuous work, a gentle popup suggests a 2-minute break.
 *  - White Noise: procedural ambient loop (rain / cafe / waves) with a compact popover control,
 *    also auto-startable from the accessibility suite's `whiteNoise` toggle.
 */
export default function RetentionLayer() {
  const { user, lang, refreshProfile, toggles, setToggles } = useApp()
  const [breakDue, setBreakDue] = useState(false)
  const [noiseOpen, setNoiseOpen] = useState(false)
  const [playing, setPlaying] = useState(null)
  const engineRef = useRef(null)
  const arabic = lang === 'ar'

  const stopCurrent = useCallback(() => {
    engineRef.current?.stop?.()
    engineRef.current = null
    setPlaying(null)
  }, [])

  const startNoise = useCallback((kind) => {
    stopCurrent()
    const engine = createNoiseEngine(kind)
    if (!engine) return
    engineRef.current = engine
    setPlaying(kind)
    try { localStorage.setItem(NOISE_PREF_KEY, kind) } catch {}
  }, [stopCurrent])

  // Track activity; when 15 continuous minutes pass, offer a break.
  useEffect(() => {
    touchActivity()
    const onActivity = () => touchActivity()
    const events = ['click', 'keydown', 'scroll', 'pointerdown']
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }))
    const timer = setInterval(() => {
      const last = Number(localStorage.getItem(WORK_KEY) || 0)
      if (last && Date.now() - last >= BREAK_INTERVAL_MS) {
        setBreakDue(true)
        touchActivity()
      }
    }, 30000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, onActivity))
      clearInterval(timer)
    }
  }, [])

  // Stop audio on unmount
  useEffect(() => () => { engineRef.current?.stop?.() }, [])

  // Accessibility suite toggle drives the engine (off / on with saved kind).
  useEffect(() => {
    if (!user || user.role === 'teacher') return
    if (toggles?.whiteNoise) {
      if (!engineRef.current) {
        let kind = 'rain'
        try { kind = localStorage.getItem(NOISE_PREF_KEY) || 'rain' } catch {}
        if (!NOISE_KINDS.includes(kind)) kind = 'rain'
        startNoise(kind)
      }
    } else if (engineRef.current) {
      stopCurrent()
    }
  }, [toggles?.whiteNoise, user, startNoise, stopCurrent])

  const acceptBreak = async () => {
    setBreakDue(false)
    try {
      await api.breakReminder({ user_id: user.id, accepted: true })
      refreshProfile?.()
    } catch { /* offline-safe */ }
  }

  if (!user || user.role === 'teacher') return null

  const pick = (kind) => {
    if (playing === kind) {
      stopCurrent()
      // Keep the suite toggle in sync so both controls reflect reality.
      if (toggles?.whiteNoise) setToggles((prev) => ({ ...prev, whiteNoise: false }))
    } else {
      startNoise(kind)
      if (!toggles?.whiteNoise) setToggles((prev) => ({ ...prev, whiteNoise: true }))
    }
  }

  return (
    <>
      {/* White noise control — sits above the mobile tab bar */}
      <div className="fixed bottom-20 md:bottom-4 start-4 z-[85] zen-hide">
        <div className="relative">
          <button
            type="button"
            onClick={() => setNoiseOpen((v) => !v)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-lg transition-bouncy bouncy-hover ${playing ? 'border-transparent bg-[var(--accent-green)] text-white animate-pulse-ring' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)]'}`}
            title={arabic ? 'ضوضاء بيضاء' : 'White noise'}
            aria-label={arabic ? 'ضوضاء بيضاء' : 'White noise'}
            aria-expanded={noiseOpen}
          >
            {playing ? '🔇' : '🎧'}
          </button>
          {noiseOpen && (
            <div className="animate-bubble-in absolute bottom-14 start-0 w-52 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-3 shadow-xl">
              <p className="mb-2 text-xs font-bold text-[var(--ink)]">{arabic ? 'صوت محيط للتركيز' : 'Focus sound'}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {NOISE_KINDS.map((kind) => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => pick(kind)}
                    className={`rounded-xl border px-1 py-2 text-[11px] font-bold transition-bouncy press-bubble ${playing === kind ? 'border-[var(--accent-green)] bg-green-50 text-green-700' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`}
                  >
                    {arabic ? NOISE_LABELS[kind].ar : NOISE_LABELS[kind].en}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-snug text-[var(--muted)]">
                {arabic ? 'مولّد صوت حقيقي يعمل دون إنترنت.' : 'Real synthesized sound — works offline.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Break reminder popup */}
      {breakDue && (
        <div className="animate-nudge fixed bottom-20 md:bottom-4 end-4 z-[88] w-72 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-2xl" role="alert">
          <p className="text-sm font-bold text-[var(--ink)]">🧠 {arabic ? 'دماغك اشتغل بجد!' : 'Your brain has been working hard!'}</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            {arabic ? 'خد استراحة دقيقتين؟' : 'Take a 2-minute break?'}
          </p>
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={acceptBreak} className="brand-btn-primary flex-1 py-1.5 text-xs">
              {arabic ? 'استراحة' : 'Take a break'}
            </button>
            <button type="button" onClick={() => setBreakDue(false)} className="brand-btn-ghost flex-1 py-1.5 text-xs">
              {arabic ? 'لاحقاً' : 'Later'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
