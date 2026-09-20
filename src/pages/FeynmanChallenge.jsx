import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'


export default function FeynmanChallenge() {
  const { user } = useApp()
  const [subjects, setSubjects] = useState([])
  const [topic, setTopic] = useState('')
  const [subject, setSubject] = useState('')
  const [explanation, setExplanation] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from storage
    setSubjects(user?.subjects || JSON.parse(localStorage.getItem('shaghoof_user') || '{}').subjects || [])
  }, [user?.subjects])
  const [result, setResult] = useState(null)

  const evaluate = async () => {
    if (!topic || !explanation.trim()) return
    setLoading(true)
    try {
      // Schema: { topic, student_explanation, language }
      const res = await api.evaluateFeynman({
        topic,
        student_explanation: explanation.trim(),
        language: 'en',
      })
      setResult(res)
    } catch {
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  const score = result?.score || result?.rating || 0
  const scoreMax = 10

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={48} animate mood={score >= 7 ? 'happy' : score >= 4 ? 'neutral' : 'sad'} className="mascot-float" />
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Feynman Challenge</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Explain it simply — if you can teach it, you know it!</p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-4">
          <div className="border border-[var(--line)] rounded-lg bg-blue-50/50 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <strong>How it works:</strong> Explain the topic in your own words, as if teaching a younger student. The AI will evaluate your understanding, clarity, and suggest improvements.
            </p>
          </div>
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
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Photosynthesis, Gravity..." className="w-full brand-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Your Explanation</label>
            <textarea value={explanation} onChange={(e) => setExplanation(e.target.value)} placeholder="Explain this topic in your own words, as simply as possible..." rows={6} className="w-full brand-textarea" />
            <p className="mt-1 text-xs text-gray-400">{explanation.split(/\s+/).filter(Boolean).length} words</p>
          </div>
          <button onClick={evaluate} disabled={!topic || !explanation.trim() || loading} className="w-full brand-btn-primary py-3 disabled:opacity-40">
            {loading ? 'Evaluating...' : 'Evaluate My Explanation'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-[var(--line)] rounded-lg p-6 text-center">
            <div className="mb-2 text-5xl font-black text-blue-600">{score}<span className="text-lg text-gray-400">/{scoreMax}</span></div>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-300">Your Feynman Score</p>
          </div>

          {result.feedback && (
            <div className="border border-[var(--line)] rounded-lg p-5">
              <h3 className="mb-2 text-sm font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Feedback</h3>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed">{result.feedback}</p>
            </div>
          )}

          {result.strengths && (
            <div className="border border-[var(--line)] rounded-lg bg-green-50 p-4">
              <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">Strengths</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{Array.isArray(result.strengths) ? result.strengths.join('. ') : result.strengths}</p>
            </div>
          )}

          {result.improvements && (
            <div className="border border-[var(--line)] rounded-lg bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-700 dark:text-amber-300 mb-1">Areas to Improve</p>
              <p className="text-sm text-gray-700 dark:text-gray-200">{Array.isArray(result.improvements) ? result.improvements.join('. ') : result.improvements}</p>
            </div>
          )}

          {result.simplified_version && (
            <div className="border border-[var(--line)] rounded-lg bg-blue-50 p-4">
              <p className="text-sm font-bold text-blue-700 dark:text-blue-300 mb-1">Suggested Simplified Version</p>
              <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">{result.simplified_version}</p>
            </div>
          )}

          <button onClick={() => { setResult(null); setExplanation('') }} className="w-full brand-btn-ghost py-3">
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}
