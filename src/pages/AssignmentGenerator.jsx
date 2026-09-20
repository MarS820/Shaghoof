import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'


export default function AssignmentGenerator() {
  const { user } = useApp()
  const [subjects, setSubjects] = useState([])
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [grade, setGrade] = useState(user?.grade || 8)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydrate from storage
    setSubjects(user?.subjects || JSON.parse(localStorage.getItem('shaghoof_user') || '{}').subjects || [])
  }, [user?.subjects])
  const [result, setResult] = useState(null)

  const generate = async () => {
    const assignTopic = topic.trim() || subject
    if (!assignTopic) return
    setLoading(true)
    setError('')
    try {
      // Schema: { topic, source, student_level, difficulty, count } — the
      // student's description/grade map onto source text + level.
      const res = await api.generateAssignment({
        user_id: user?.id || undefined,
        topic: assignTopic,
        source: description || '',
        student_level: `grade ${grade}`,
        difficulty: 'medium',
        count: 5,
      })
      setResult(res)
    } catch {
      setResult(null)
      setError('Could not generate the assignment. Please check the server and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={48} animate mood="happy" className="mascot-float" />
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Assignment Generator</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">AI-powered assignment creation with review and improvement</p>
        </div>
      </div>

      {!result ? (
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
            <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Fractions, Cell Division..." className="w-full brand-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Grade</label>
            <select value={grade} onChange={(e) => setGrade(Number(e.target.value))} className="w-full brand-input">
              {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}th Grade</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Additional Notes (Optional)</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Any specific requirements or focus areas..." rows={3} className="w-full brand-textarea" />
          </div>
          <button onClick={generate} disabled={(!topic.trim() && !subject) || loading} className="w-full brand-btn-primary py-3 disabled:opacity-40">
            {loading ? 'Generating...' : 'Generate Assignment'}
          </button>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="border border-[var(--line)] rounded-lg p-6">
            <h2 className="mb-3 text-lg font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>{result.title || topic}</h2>
            {result.description && <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">{result.description}</p>}
            {result.questions && result.questions.length > 0 && (
              <div className="space-y-3">
                {result.questions.map((q, i) => (
                  <div key={i} className="brand-tag bg-blue-50 p-4 dark:bg-blue-900/20">
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-100">Q{i + 1}. {q.question || q.text || JSON.stringify(q)}</p>
                    {q.hint && <p className="mt-1 text-xs text-gray-500">Hint: {q.hint}</p>}
                  </div>
                ))}
              </div>
            )}
            {result.rubric && (
              <div className="mt-4 border border-[var(--line)] rounded-lg bg-green-50 p-4">
                <p className="text-sm font-bold text-green-700 dark:text-green-300 mb-1">Rubric</p>
                <p className="text-xs text-gray-600 dark:text-gray-300 whitespace-pre-line">{typeof result.rubric === 'string' ? result.rubric : JSON.stringify(result.rubric, null, 2)}</p>
              </div>
            )}
          </div>
          <button onClick={() => setResult(null)} className="w-full brand-btn-ghost py-3">
            Generate Another
          </button>
        </div>
      )}
    </div>
  )
}
