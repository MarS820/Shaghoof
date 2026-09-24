import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'
import { resolveLearningTemplate } from '../utils/learningTemplate'

const FORMAT_TO_TYPES = {
  sandbox: ['mcq', 'true_false'],
  podcast: ['mcq', 'fill_blank'],
  storyboard: ['mcq', 'true_false'],
  translator: ['fill_blank', 'short_answer', 'mcq'],
  explorer: ['mcq', 'true_false', 'fill_blank'],
  routine: ['mcq', 'true_false', 'fill_blank'],
}

const normalize = (s) => String(s ?? '').trim().toLowerCase().replace(/[.!?،,]/g, '').replace(/\s+/g, ' ')

function isCorrect(question, given) {
  const type = question?.type || 'mcq'
  if (type === 'mcq' || type === 'true_false') return given === question.correct
  const accepted = (question.accepted_answers || []).map(normalize)
  const canon = normalize(question.correct_answer)
  if (canon) accepted.push(canon)
  const g = normalize(given)
  if (!g) return false
  if (accepted.includes(g)) return true
  return accepted.some((a) => a.length > 3 && (a.includes(g) || g.includes(a)))
}

export default function QuizGenerator() {
  const { user, awardXp } = useApp()
  const localSubjects = (user?.subjects || [])
  const subjects = localSubjects
  const template = user ? resolveLearningTemplate(user) : null
  const [subject, setSubject] = useState('')
  const [topic, setTopic] = useState('')
  const [difficulty, setDifficulty] = useState('Medium')
  const [count, setCount] = useState(5)
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [textDraft, setTextDraft] = useState({})
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
    setTextDraft({})
    try {
      const res = await api.generateQuiz({
        topic: quizTopic,
        subject: subject || undefined,
        n: count,
        difficulty,
        user_id: user.id,
        ground_in_lessons: true,
        question_types: template?.quizFormat ? FORMAT_TO_TYPES[template.quizFormat] : undefined,
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

  const setTextAnswer = (qIdx, value) => {
    setTextDraft((prev) => ({ ...prev, [qIdx]: value }))
  }

  const isAnswered = (q, i) => {
    const type = q.type || 'mcq'
    if (type === 'mcq' || type === 'true_false') return answers[i] !== undefined
    return String(textDraft[i] || '').trim().length > 0
  }

  const allAnswered = questions.length > 0 && questions.every((q, i) => isAnswered(q, i))

  const submitQuiz = () => {
    let correct = 0
    const breakdown = questions.map((q, i) => {
      const type = q.type || 'mcq'
      const given = (type === 'mcq' || type === 'true_false') ? answers[i] : (textDraft[i] ?? '')
      const ok = isCorrect(q, given)
      if (ok) correct++
      let userAnswer
      if (type === 'mcq' || type === 'true_false') {
        userAnswer = typeof q.options?.[given] === 'string' ? q.options[given] : String(given ?? '')
      } else {
        userAnswer = String(given || '')
      }
      const right = q.correct_answer
        || (typeof q.options?.[q.correct] === 'string' ? q.options[q.correct] : String(q.correct ?? ''))
      return {
        question: q.question, type, userAnswer, correctAnswer: right,
        correct: ok, explanation: q.explanation || '', options: q.options,
      }
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
      api.saveAssessmentSession({
        user_id: user.id,
        topic: topic || subject || 'Quiz',
        total_questions: questions.length,
        correct_count: correct,
        score: Math.round((correct / questions.length) * 100),
        growth_score: 0,
        xp_earned: correct * 5,
        mode: 'quiz',
      }).catch(() => {})
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
              <p className="text-sm font-medium text-[var(--ink)]">Q{i + 1}. {item.question}
                {item.type && item.type !== 'mcq' && (
                  <span className="ms-1 text-[9px] uppercase opacity-60">{item.type}</span>
                )}
              </p>
              {(item.type === 'mcq' || item.type === 'true_false') && item.options?.length ? (
                <div className="mt-2 space-y-1">
                  {item.options.map((opt, oi) => {
                    const rightIdx = typeof item.correctAnswer === 'number' ? item.correctAnswer : -1
                    const givenIdx = typeof item.userAnswer === 'number' ? item.userAnswer : -1
                    return (
                      <p key={oi} className={`text-xs ${oi === rightIdx ? 'font-bold text-green-700' : oi === givenIdx && !item.correct ? 'text-red-600 line-through' : 'text-[var(--muted)]'}`}>
                        {String.fromCharCode(65 + oi)}. {typeof opt === 'string' ? opt : opt.text}
                        {oi === rightIdx && ' ✓'}
                        {oi === givenIdx && !item.correct && ' ✗'}
                      </p>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-2 space-y-1 text-xs">
                  <p className={item.correct ? 'text-green-700 font-bold' : 'text-red-600'}>
                    Your answer: {item.userAnswer || '—'}{item.correct && ' ✓'}
                  </p>
                  {!item.correct && (
                    <p className="text-green-700 font-bold">Correct: {item.correctAnswer}</p>
                  )}
                </div>
              )}
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
            <span className="text-sm font-medium text-[var(--muted)]">{questions.filter((q, i) => isAnswered(q, i)).length}/{questions.length} answered</span>
          </div>
          {questions.map((q, qi) => {
            const type = q.type || 'mcq'
            const isChoice = type === 'mcq' || type === 'true_false'
            return (
            <div key={qi} className="border border-[var(--line)] rounded-lg p-4 bg-[var(--surface)]">
              <p className="mb-3 text-sm font-medium text-[var(--ink)]">Q{qi + 1}. {q.question}
                {type !== 'mcq' && (
                  <span className="ms-2 rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-[10px] font-bold text-[var(--brand)] uppercase">{type.replace('_', ' ')}</span>
                )}
              </p>
              {isChoice ? (
                <div className="space-y-2">
                  {(q.options || []).map((opt, oi) => (
                    <button key={oi} onClick={() => selectAnswer(qi, oi)} className={`w-full rounded-md px-3 py-2 text-left text-sm border transition-colors ${answers[qi] === oi ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--ink)] hover:border-[var(--brand)]'}`}>
                      {(type === 'true_false' ? (oi === 0 ? 'T. ' : 'F. ') : `${String.fromCharCode(65 + oi)}. `)}
                      {typeof opt === 'string' ? opt : opt.text || JSON.stringify(opt)}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                    {type === 'fill_blank' ? 'Fill in the blank' : 'Short answer'}
                  </label>
                  <input
                    type="text"
                    value={textDraft[qi] || ''}
                    onChange={(e) => setTextAnswer(qi, e.target.value)}
                    placeholder={type === 'fill_blank' ? 'Type the missing word(s)…' : 'Type a short answer…'}
                    className="w-full brand-input"
                  />
                </div>
              )}
            </div>
            )
          })}
          <button onClick={submitQuiz} disabled={!allAnswered} className="w-full brand-btn-primary py-2.5 disabled:opacity-40">
            Submit Quiz
          </button>
        </div>
      )}
    </div>
  )
}
