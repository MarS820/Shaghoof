import { useState, useRef, useEffect } from 'react'
import api from '../services/api'

/**
 * PodcastGeneratorModal — NotebookLM-style two-speaker podcast generator.
 * Generates conversational dialogue, plays TTS audio with dual speakers.
 * Supports Arabic (Egyptian/MSA) and English.
 */
export default function PodcastGeneratorModal({ open, onClose, lang = 'en', onXp }) {
  const [topic, setTopic] = useState('')
  const [dialect, setDialect] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [podcast, setPodcast] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentLine, setCurrentLine] = useState(-1)
  const [audioUrl, setAudioUrl] = useState(null)
  const audioRef = useRef(null)
  const arabic = lang === 'ar'

  useEffect(() => {
    if (!open) {
      setTopic('')
      setPodcast(null)
      setPlaying(false)
      setCurrentLine(-1)
      setAudioUrl(null)
    }
  }, [open])

  const generate = async () => {
    if (!topic.trim()) return
    setGenerating(true)
    try {
      const data = await api.generatePodcast({ topic: topic.trim(), language: lang, dialect })
      setPodcast(data)
    } catch (e) {
      console.error('Podcast generation failed:', e)
    } finally {
      setGenerating(false)
    }
  }

  const playTTS = async (text, speaker) => {
    try {
      const res = await api.synthesizeTTS({
        text, speaker, language: lang, dialect, speed: 1.0, engine: 'azure'
      })
      const blob = new Blob([res], { type: 'audio/mpeg' })
      return URL.createObjectURL(blob)
    } catch {
      return null
    }
  }

  const playPodcast = async () => {
    if (!podcast?.dialogue?.length) return
    setPlaying(true)
    onXp?.(20, arabic ? 'بودكاست' : 'Podcast')
    for (let i = 0; i < podcast.dialogue.length; i++) {
      setCurrentLine(i)
      const line = podcast.dialogue[i]
      const url = await playTTS(line.text, line.speaker)
      if (url) {
        setAudioUrl(url)
        await new Promise((resolve) => {
          const audio = new Audio(url)
          audioRef.current = audio
          audio.onended = resolve
          audio.onerror = resolve
          audio.play().catch(resolve)
        })
      }
    }
    setPlaying(false)
    setCurrentLine(-1)
  }

  const stopPodcast = () => {
    setPlaying(false)
    setCurrentLine(-1)
    audioRef.current?.pause()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="animate-pop-in w-full max-w-2xl rounded-3xl border-2 border-purple-300 bg-white p-6 shadow-2xl dark:border-purple-700 dark:bg-gray-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-purple-700 dark:text-purple-300">
            🎙️ {arabic ? 'بودكاست شغوف' : 'Shaghoof Podcast'}
          </h2>
          <button onClick={onClose} className="text-2xl text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
          {arabic ? 'بودكاست تعليمي بنمط NotebookLM مع مقدمين اثنين' : 'NotebookLM-style educational podcast with two hosts'}
        </p>

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && generate()}
            placeholder={arabic ? 'ادخل الموضوع... مثلاً: الشبكات العصبية' : 'Enter topic... e.g.: Neural Networks'}
            className="flex-1 rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200 dark:border-purple-800 dark:bg-purple-950 dark:text-white"
            disabled={generating || playing}
          />
          <button
            onClick={generate}
            disabled={!topic.trim() || generating || playing}
            className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-700 disabled:opacity-50"
          >
            {generating ? (arabic ? 'جاري التوليد...' : 'Generating...') : '🎙️'}
          </button>
        </div>

        {arabic && (
          <label className="mb-3 flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <input type="checkbox" checked={dialect} onChange={(e) => setDialect(e.target.checked)} className="rounded" disabled={playing} />
            {arabic ? 'اللهجة المصرية' : 'Egyptian Dialect'}
          </label>
        )}

        {podcast && (
          <div className="max-h-80 overflow-y-auto rounded-2xl border border-purple-200 bg-purple-50/50 p-4 dark:border-purple-800 dark:bg-purple-950/30">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-purple-700 dark:text-purple-300">
                🎬 {podcast.title} ({podcast.duration})
              </p>
              <div className="flex gap-2">
                <button
                  onClick={playing ? stopPodcast : playPodcast}
                  className={`rounded-full px-3 py-1 text-xs font-bold text-white ${playing ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`}
                >
                  {playing ? (arabic ? '⏹ إيقاف' : '⏹ Stop') : (arabic ? '▶ تشغيل' : '▶ Play')}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {podcast.dialogue.map((line, i) => (
                <div
                  key={i}
                  className={`flex gap-3 rounded-xl p-3 transition-all ${
                    currentLine === i
                      ? 'bg-purple-200 dark:bg-purple-800'
                      : 'bg-white dark:bg-gray-800'
                  }`}
                >
                  <span className="text-2xl">{line.avatar}</span>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-xs font-extrabold text-purple-700 dark:text-purple-300">
                        {line.speakerName}
                      </span>
                      <span className="text-[9px] text-gray-400">{line.timestamp}</span>
                      {currentLine === i && playing && (
                        <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                      )}
                    </div>
                    <p className="text-xs leading-relaxed text-gray-700 dark:text-gray-300">
                      {line.text}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
