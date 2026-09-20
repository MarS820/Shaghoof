import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useApp } from '../context/AppContext'
import Mascot from './Mascot'
import api from '../services/api'
import { speak, stopSpeaking } from '../services/speech'

const SCENE_BG = {
  intro: ['#2563EB', '#7C3AED'],
  content: ['#3B82F6', '#6366F1'],
  review: ['#10B981', '#2563EB'],
  outro: ['#F59E0B', '#EC4899'],
}

const CUE_ICON = {
  mascot_wave: '👋', mascot_celebrate: '🎉', diagram: '📊', animation: '✨',
  illustration: '🎨', chart: '📈', infographic: '🗺️', mind_map: '🧠',
  flowchart: '🔀', picture: '🖼️', waveform: '〰️', speaker_icon: '🔊',
  concept_grid: '🧩', text_highlight: '🖍️', book_page: '📖',
  definition_card: '📇', interactive_demo: '🧪', drag_drop: '🖐️',
  step_by_step: '🪜', hands_on: '🛠️', default: '📚',
}

function hexToRgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/)
  const lines = []
  let line = ''
  words.forEach((w) => {
    const test = line ? `${line} ${w}` : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else {
      line = test
    }
  })
  if (line) lines.push(line)
  return lines.slice(0, 6)
}

/**
 * Renders one scene to the canvas at time t (seconds since scene start).
 * Uses the scene's template accent color so each template looks distinct.
 */
function drawScene(ctx, canvas, scene, tLocal, progress, title) {
  const W = canvas.width
  const H = canvas.height
  const accent = scene.accent || null
  const [c1, c2] = accent
    ? [accent, SCENE_BG[scene.type]?.[1] || SCENE_BG.content[1]]
    : (SCENE_BG[scene.type] || SCENE_BG.content)

  // Animated gradient background
  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, c1)
  grad.addColorStop(1, c2)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  // Floating bubbles (bubbly brand motion) — fewer in sensory-calm scenes
  const bubbleCount = scene.max_bubbles || 7
  for (let i = 0; i < bubbleCount; i += 1) {
    const seed = i * 97
    const bx = (W * ((seed * 13) % 100) / 100 + Math.sin(tLocal * 0.8 + i) * 24 + W) % W
    const by = H - ((tLocal * (18 + i * 5) + seed * 7) % (H + 80))
    const r = 8 + (i % 4) * 7
    ctx.beginPath()
    ctx.arc(bx, by, r, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba('#FFFFFF', 0.10)
    ctx.fill()
  }

  // Header strip
  ctx.fillStyle = hexToRgba('#000000', 0.18)
  ctx.fillRect(0, 0, W, 56)
  ctx.fillStyle = '#FFFFFF'
  ctx.font = 'bold 22px "Nunito Sans", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  const titleLines = wrapText(ctx, title, W - 160)
  ctx.fillText((titleLines[0] || title).slice(0, 48), 20, 28)

  // Scene icon — large centered cue
  const icon = CUE_ICON[scene.visual] || CUE_ICON.default
  ctx.textAlign = 'center'
  const pulse = 1 + Math.sin(tLocal * 2.4) * 0.06
  ctx.save()
  ctx.translate(W / 2, H * 0.34)
  ctx.scale(pulse, pulse)
  ctx.font = '84px serif'
  ctx.textBaseline = 'middle'
  ctx.fillText(icon, 0, 0)
  ctx.restore()

  // Text overlay — main message
  ctx.font = 'bold 30px "Nunito Sans", sans-serif'
  const overlayLines = wrapText(ctx, scene.text_overlay || scene.narration || '', W - 120)
  ctx.fillStyle = '#FFFFFF'
  overlayLines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, H * 0.55 + i * 38)
  })

  // Narration strip (subtitles)
  const narrLines = wrapText(ctx, scene.narration || '', W - 140)
  ctx.font = '20px "Inter", sans-serif'
  const boxH = narrLines.length * 26 + 20
  ctx.fillStyle = hexToRgba('#000000', 0.45)
  const bw = Math.min(W - 80, Math.max(...narrLines.map((l) => ctx.measureText(l).width), 200) + 40)
  ctx.fillRect(W / 2 - bw / 2, H - 96 - boxH + 26, bw, boxH)
  ctx.fillStyle = '#FFFFFF'
  narrLines.forEach((ln, i) => {
    ctx.fillText(ln, W / 2, H - 96 - boxH + 46 + i * 26)
  })

  // Step counter (ASD structure support)
  if (scene.show_step_counter && scene.step_number) {
    ctx.fillStyle = hexToRgba('#000000', 0.3)
    ctx.beginPath()
    ctx.arc(W - 44, 28, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 18px "Inter", sans-serif'
    ctx.fillText(String(scene.step_number), W - 44, 28)
  }

  // Progress bar
  ctx.fillStyle = hexToRgba('#FFFFFF', 0.25)
  ctx.fillRect(0, H - 10, W, 10)
  ctx.fillStyle = '#FDE68A'
  ctx.fillRect(0, H - 10, W * progress, 10)
}

/**
 * VideoLessonPlayer — real playable video from the backend scene script.
 * - Canvas render loop (30fps) draws every scene with animated visuals.
 * - Narration via Web Speech API, synced per scene.
 * - "Record" exports a real .webm video file via MediaRecorder + canvas.captureStream.
 */
export default function VideoLessonPlayer({ lesson, onDone }) {
  const { lang, awardXp } = useApp()
  const arabic = lang === 'ar'
  const canvasRef = useRef(null)
  const rafRef = useRef(0)
  const startRef = useRef(0)
  const recRef = useRef(null)
  const chunksRef = useRef([])

  const [state, setState] = useState('idle') // idle | loading | playing | paused | done | error
  const [video, setVideo] = useState(null)
  const [sceneIdx, setSceneIdx] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [recording, setRecording] = useState(false)
  const [videoUrl, setVideoUrl] = useState(null)

  const scenes = useMemo(() => video?.scenes || [], [video])
  const total = video?.total_duration_seconds || 0

  const stopLoop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = 0
    stopSpeaking()
  }, [])

  const stopRecording = () => {
    if (recRef.current?.state === 'recording') recRef.current.stop()
    recRef.current = null
    setRecording(false)
  }

  useEffect(() => () => { stopLoop(); stopRecording() }, [stopLoop])

  const generate = async () => {
    setState('loading')
    try {
      const res = await api.generateVideoLesson({
        session_id: lesson.session_id,
        user_id: lesson.user_id,
        duration_minutes: 5,
        vark_mode: lesson.vark_mode || 'visual',
        sen_profile: lesson.sen_profile || 'general',
        // Optional AI motion clips (LTX-Video) — only when explicitly enabled.
        ai_clips: lesson.ai_clips === true,
      })
      setVideo(res)
      setState('ready')
      api.trackEvent({ user_id: lesson.user_id, event_type: 'video_generated', topic: res.title }).catch(() => {})
    } catch {
      setState('error')
    }
  }

  const sceneAt = useCallback((t) => {
    let acc = 0
    for (let i = 0; i < scenes.length; i += 1) {
      acc += scenes[i].duration_seconds || 0
      if (t < acc) return { idx: i, local: t - (acc - scenes[i].duration_seconds) }
    }
    return { idx: scenes.length - 1, local: scenes[scenes.length - 1]?.duration_seconds || 0 }
  }, [scenes])

  const loop = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const t = (Date.now() - startRef.current) / 1000

    if (t >= total) {
      stopLoop()
      setState('done')
      awardXp(20, arabic ? 'فيديو مكتمل' : 'Video complete')
      onDone?.()
      return
    }
    const { idx, local } = sceneAt(t)
    const scene = scenes[idx]
    if (scene) {
      drawScene(ctx, canvas, scene, local, t / total, video?.title || '')
      // Narration per scene start
      setSceneIdx((prev) => {
        if (prev !== idx) {
          speak(scene.narration || '', { lang, rate: 0.95 })
          return idx
        }
        return prev
      })
    }
    setElapsed(t)
    rafRef.current = requestAnimationFrame(() => loopRef.current?.())
  }, [total, scenes, sceneAt, video, lang, arabic, awardXp, onDone, stopLoop])

  // Indirection so the animation loop can re-schedule itself without
  // referencing its own binding during initialization.
  const loopRef = useRef(null)
  useEffect(() => {
    // eslint-disable-next-line react/immutability -- storing latest loop callback in a ref
    loopRef.current = loop
  }, [loop])

  const play = () => {
    if (!scenes.length) return
    setState('playing')
    startRef.current = Date.now() - elapsed * 1000
    rafRef.current = requestAnimationFrame(() => loopRef.current?.())
  }

  const pause = () => {
    stopLoop()
    setState('paused')
  }

  const restart = () => {
    stopLoop()
    setElapsed(0)
    setSceneIdx(-1)
    setState('ready')
  }

  const startRecording = () => {
    const canvas = canvasRef.current
    if (!canvas || typeof MediaRecorder === 'undefined') return
    try {
      const stream = canvas.captureStream(30)
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
      chunksRef.current = []
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        setVideoUrl(URL.createObjectURL(blob))
      }
      rec.start()
      recRef.current = rec
      setRecording(true)
      restart()
      play()
    } catch {
      setRecording(false)
    }
  }

  const currentScene = scenes[sceneIdx] || scenes[0]

  if (state === 'error') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center dark:border-red-800 dark:bg-red-950/30">
        <p className="text-sm font-bold text-red-600">{arabic ? 'تعذر إنشاء الفيديو — تحقق من تشغيل الخادم.' : 'Could not create the video — check the server is running.'}</p>
        <button onClick={() => setState('idle')} className="brand-btn-ghost mt-2 text-xs">{arabic ? 'حاول مجدداً' : 'Try again'}</button>
      </div>
    )
  }

  return (
    <div className="animate-bubble-in rounded-3xl border border-[var(--line)] bg-[var(--surface)] p-4 shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-extrabold text-[var(--ink)]">🎬 {arabic ? 'درس فيديو' : 'Video lesson'}</p>
        {video && <span className="rounded-full bg-[var(--brand-light)] px-2.5 py-1 text-[10px] font-extrabold text-[var(--brand)]">{video.total_duration_label} · {video.scene_count} {arabic ? 'مشاهد' : 'scenes'}</span>}
      </div>

      {/* Stage */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900">
        <canvas ref={canvasRef} width="960" height="540" className="h-auto w-full" aria-label="Video lesson player" />
        {(state === 'idle' || state === 'loading') && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-900/85 p-6 text-center">
            {state === 'loading'
              ? <><div className="loading-dots"><span /><span /><span /></div><p className="text-sm font-bold text-white">{arabic ? 'جارٍ بناء مشاهد الفيديو...' : 'Building your video scenes...'}</p></>
              : <><Mascot size={56} animate mood="teaching" className="animate-bobble" /><p className="text-sm font-bold text-white">{arabic ? 'حوّل درسك إلى فيديو متحرك بتعليق صوتي.' : 'Turn this lesson into an animated, narrated video.'}</p></>}
          </div>
        )}
        {state === 'paused' && (
          <button onClick={play} className="absolute inset-0 flex items-center justify-center bg-slate-900/40 text-6xl transition-bouncy hover:scale-105" aria-label="Play">▶️</button>
        )}
        {state === 'done' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-900/85 text-center">
            <p className="text-3xl">🎉</p>
            <p className="text-sm font-bold text-white">{arabic ? 'اكتمل الفيديو!' : 'Video complete!'}</p>
          </div>
        )}
      </div>

      {/* Scene strip */}
      {video && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {scenes.map((s, i) => (
            <span key={i} className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-bold ${i === sceneIdx && state === 'playing' ? 'bg-[var(--brand)] text-white' : s.type === 'intro' ? 'bg-purple-100 text-purple-700' : s.type === 'review' ? 'bg-green-100 text-green-700' : s.type === 'outro' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
              {s.type === 'intro' ? '👋 ' : s.type === 'review' ? '🧩 ' : s.type === 'outro' ? '🎉 ' : `${i}. `}{CUE_ICON[s.visual] || '📚'} {s.duration_seconds}s
            </span>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === 'idle' && (
          <button onClick={generate} className="brand-btn-primary flex-1 text-sm">🎬 {arabic ? 'أنشئ الفيديو' : 'Generate video'}</button>
        )}
        {(state === 'ready' || state === 'paused') && (
          <button onClick={play} className="brand-btn-primary flex-1 text-sm">▶ {arabic ? 'تشغيل' : 'Play'}</button>
        )}
        {state === 'playing' && (
          <button onClick={pause} className="brand-btn-secondary flex-1 text-sm">⏸ {arabic ? 'إيقاف مؤقت' : 'Pause'}</button>
        )}
        {(state === 'done' || state === 'playing') && (
          <button onClick={restart} className="brand-btn-ghost text-sm">🔄 {arabic ? 'إعادة' : 'Restart'}</button>
        )}
        {video && (state === 'ready' || state === 'paused' || state === 'done') && !recording && (
          <button onClick={startRecording} className="brand-btn-ghost text-sm" title={arabic ? 'سجّل الفيديو كملف WebM' : 'Record as a WebM file'}>⏺ {arabic ? 'سجّل' : 'Record'}</button>
        )}
        {recording && (
          <button onClick={stopRecording} className="brand-btn-ghost animate-pulse text-sm">⏹ {arabic ? 'إيقاف التسجيل' : 'Stop recording'}</button>
        )}
      </div>

      {/* Narration transcript */}
      {state === 'playing' && currentScene?.narration && (
        <p className="mt-2 rounded-xl bg-[var(--page)] px-3 py-2 text-[11px] font-semibold text-[var(--muted)]">💬 {currentScene.narration}</p>
      )}

      {videoUrl && (
        <div className="mt-3 rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
          <p className="text-xs font-extrabold text-green-700 dark:text-green-300">✅ {arabic ? 'الفيديو جاهز للتحميل' : 'Your video is ready'}</p>
          <video src={videoUrl} controls className="mt-2 w-full rounded-xl" />
          <a href={videoUrl} download={`${(video?.title || 'shaghoof-lesson').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.webm`} className="brand-btn-primary mt-2 w-full text-xs">
            ⬇ {arabic ? 'حمّل الفيديو' : 'Download video'}
          </a>
        </div>
      )}
    </div>
  )
}
