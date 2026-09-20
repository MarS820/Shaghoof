import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'

export default function QuizGenerator() {
  const { user, awardXp } = useApp()
  const localSubjects = (user?.subjects || [])
  const subjects = localSubjects
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('Medium')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [results, setResults] = useState(null)
  const [adaptation, setAdaptation] = useState(null)
  const [error, setError] = useState('')

  const generate = async () => {
    const quizTopic = topic.trim() || subject
    if (!quizTopic || !subject) return
    setLoading(true)
    setError('')
    setResults(null)
    setAnswers({})
    try {
      const res = await api.generateQuiz({
        topic: quizTopic,
        subject: subject || undefined,
        n: count,
        difficulty,
        user_id: user.id,
        ground_in_lessons: true,
      })
      setQuestions(res.questions || [])
      setAdaptation(res.adaptation || null)
    } catch (e) {
      console.error('Quiz generation failed:', e)
      setQuestions([])
      setError(e.message || 'This quiz needs more lesson material from the selected subject.')
    } finally {
      setLoading(false)
    }
  }

  const selectAnswer = (qIdx, optIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }))
  }

  const submitQuiz = () => {
    let correct = 0
    const breakdown = questions.map((q, i) => {
      const userAns = answers[i]
      const isCorrect = userAns === q.correct
      if (isCorrect) correct++
      return { question: q.question, userAnswer: userAns, correctAnswer: q.correct, correct: isCorrect, explanation: q.explanation || '', options: q.options }
    })
    setResults({ score: correct, total: questions.length, breakdown })

    try {
      api.trackEvent({
        user_id: user.id,
        event_type: 'quiz_submitted',
        topic: topic || subject,
        score: correct,
        total: questions.length,
        difficulty,
      })
    } catch {}
    // XP for the attempt (quiz results feed the activity feed + Brain Wheel loop)
    awardXp(correct * 5, 'Quiz')
  }

  if (results) {
    const pct = Math.round((results.score / results.total) * 100)
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="text-center mb-8">
          <Mascot size={64} animate mood={pct >= 70 ? 'happy' : 'thinking'} />
          <h1 className="mt-3 text-xl font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Quiz Results</h1>
          <div className="mt-2 text-4xl font-bold text-[var(--brand)]">{results.score}/{results.total}</div>
          <p className="mt-1 text-sm text-[var(--muted)]">{pct}% correct</p>
        </div>
        <div className="space-y-3">
          {results.breakdown.map((item, i) => (
            <div key={i} className={`border rounded-lg p-4 ${item.correct ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
              <p className="text-sm font-medium text-[var(--ink)]">Q{i + 1}: {item.question}</p>
              <div className="mt-2 space-y-1">
                {item.options?.map((opt, oi) => (
                  <p key={oi} className={`text-xs ${oi === item.correctAnswer ? 'font-bold text-green-700' : oi === item.userAnswer && !item.correct ? 'text-red-600 line-through' : 'text-[var(--muted)]'}`}>
                    {String.fromCharCode(65 + oi)}. {typeof opt === 'string' ? opt : opt.text}
                    {oi === item.correctAnswer && ' ✓'}
                    {oi === item.userAnswer && !item.correct && ' ✗'}
                  </p>
                ))}
              </div>
              {item.explanation && <p className="mt-2 text-xs text-[var(--muted)] italic">{item.explanation}</p>}
            </div>
          ))}
        </div>
        <button onClick={() => { setResults(null); setQuestions([]); setAnswers({}) }} className="mt-6 w-full brand-btn-primary py-2.5">
          Generate New Quiz
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={40} animate mood="happy" />
        <div>
          <h1 className="text-xl font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Quiz</h1>
          <p className="text-sm text-[var(--muted)]">Test your knowledge on any topic</p>
          {adaptation && (
            <p className="mt-1 text-[11px] font-bold text-[var(--brand)]">
              ✨ Adapted to your template: {adaptation.template_id} · {adaptation.vark_mode} · {adaptation.sen_profile}
            </p>
          )}
        </div>
      </div>

      {questions.length === 0 && (
        <div className="border border-[var(--line)] rounded-lg p-6 bg-[var(--surface)]">
          {error && <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">📖 {error}</p>}
          {subjects.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-[var(--muted)] mb-3">No subjects found. Add subjects in Settings first.</p>
              <Link to="/settings" className="brand-btn-primary text-sm">Go to Settings</Link>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Subject</label>
                <div className="flex gap-2 flex-wrap">
                  {subjects.map((s) => (
                    <button key={s.id} onClick={() => { setSubject(s.name); setTopic('') }} className={`px-3 py-1.5 text-sm font-medium rounded-md border transition-colors ${subject === s.name ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{s.name}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Topic</label>
                <input type="text" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder={subject ? `Topics in ${subject}...` : 'e.g. Photosynthesis, Algebra...'} className="brand-input" />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Difficulty</label>
                  <div className="flex gap-1">
                    {['Easy', 'Medium', 'Hard'].map((d) => (
                      <button key={d} onClick={() => setDifficulty(d)} className={`flex-1 py-1.5 text-xs font-medium rounded-md border transition-colors ${difficulty === d ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{d}</button>
                    ))}
                  </div>
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-sm font-medium text-[var(--ink)]">Count</label>
                  <select value={count} onChange={(e) => setCount(Number(e.target.value))} className="brand-input text-sm">
                    {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              <button onClick={generate} disabled={!subject || loading} className="w-full brand-btn-primary py-2.5">
                {loading ? 'Generating...' : 'Generate Quiz'}
              </button>
            </div>
          )}
        </div>
      )}

      {questions.length > 0 && !results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[var(--muted)]">{Object.keys(answers).length}/{questions.length} answered</span>
          </div>
          {questions.map((q, qi) => (
            <div key={qi} className="border border-[var(--line)] rounded-lg p-4 bg-[var(--surface)]">
              <p className="mb-3 text-sm font-medium text-[var(--ink)]">Q{qi + 1}. {q.question}</p>
              <div className="space-y-2">
                {(q.options || []).map((opt, oi) => (
                  <button key={oi} onClick={() => selectAnswer(qi, oi)} className={`w-full rounded-md px-3 py-2 text-left text-sm border transition-colors ${answers[qi] === oi ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--ink)] hover:border-[var(--brand)]'}`}>
                    {String.fromCharCode(65 + oi)}. {typeof opt === 'string' ? opt : opt.text || JSON.stringify(opt)}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <button onClick={submitQuiz} disabled={Object.keys(answers).length < questions.length} className="w-full brand-btn-primary py-2.5 disabled:opacity-40">
            Submit Quiz
          </button>
        </div>
      )}
    </div>
  )
}
