import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'


export default function PodcastPlayer() {
  const { user } = useApp()
  const [subjects, setSubjects] = useState([])
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [duration, setDuration] = useState('short')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from storage
    setSubjects(user?.subjects || JSON.parse(localStorage.getItem('shaghoof_user') || '{}').subjects || [])
  }, [user?.subjects])
  const [podcast, setPodcast] = useState(null)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [audioUrl, setAudioUrl] = useState(null)
  const audioRef = useRef(null)

  const generate = async () => {
    if (!topic) return
    setLoading(true)
    try {
      // Schema: { topic, language, dialect }
      const res = await api.generatePodcast({
        topic: topic.trim() || subject,
        language: 'en',
        dialect: false,
      })
      setPodcast(res)
      setAudioUrl(null)
    } catch {
      setPodcast(null)
    } finally {
      setLoading(false)
    }
  }

  const synthesize = async () => {
    if (!podcast) return
    setTtsLoading(true)
    try {
      const res = await api.synthesizeTTS({
        text: podcast.script || podcast.content || podcast.text || '',
        language: 'en',
      })
      if (res.audio_url) setAudioUrl(res.audio_url)
      else if (res.audio_base64) setAudioUrl(`data:audio/mpeg;base64,${res.audio_base64}`)
    } catch {
      // TTS not available
    } finally {
      setTtsLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={48} animate mood="happy" className="mascot-float" />
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Learning Podcast</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Generate conversational audio lessons on any topic</p>
        </div>
      </div>

      {!podcast ? (
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Subject</label>
            {subjects.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No subjects found. Add subjects in Settings.</p>
            ) : (
              <select value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full brand-input">
                <option value="">Select a subject...</option>
                {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Topic</label>
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Solar System, World War II..." className="w-full brand-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Duration</label>
            <div className="flex gap-2">
              {[{ v: 'short', l: '2 min' }, { v: 'medium', l: '5 min' }, { v: 'long', l: '10 min' }].map((d) => (
                <button key={d.v} onClick={() => setDuration(d.v)} className={`flex-1 brand-tag py-2 transition-standard ${duration === d.v ? 'brand-btn-primary' : 'brand-btn-secondary'}`}>
                  {d.l}
                </button>
              ))}
            </div>
          </div>
          <button onClick={generate} disabled={!topic || loading} className="w-full brand-btn-primary py-3 disabled:opacity-40">
            {loading ? 'Generating...' : 'Generate Podcast'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-[var(--line)] rounded-lg p-6">
            <h2 className="mb-3 text-lg font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>{podcast.title || topic}</h2>

            {(podcast.script || podcast.content || podcast.text) && (
              <div className="mb-4 brand-tag bg-blue-50 p-4 dark:bg-blue-900/20">
                <p className="text-xs font-bold text-blue-500 mb-2">SCRIPT</p>
                <div className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed">
                  {podcast.script || podcast.content || podcast.text}
                </div>
              </div>
            )}

            {podcast.speakers && (
              <div className="mb-3 flex flex-wrap gap-2">
                {podcast.speakers.map((s, i) => (
                  <span key={i} className="brand-tag">
                    {typeof s === 'string' ? s : s.name || 'Speaker'}
                  </span>
                ))}
              </div>
            )}
          </div>

          {audioUrl && (
            <div className="border border-[var(--line)] rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
              <audio ref={audioRef} controls src={audioUrl} className="w-full" />
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={synthesize} disabled={ttsLoading} className="flex-1 brand-btn-primary py-3 disabled:opacity-40">
              {ttsLoading ? 'Synthesizing...' : 'Generate Audio (TTS)'}
            </button>
            <button onClick={() => { setPodcast(null); setAudioUrl(null) }} className="brand-btn-ghost px-6 py-3">
              New
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
