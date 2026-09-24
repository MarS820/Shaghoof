import { useState, useEffect } from 'react'
import api from '../../services/api'
import AnimatedCard from '../AnimatedCard'

function friendlyError(err, arabic) {
  const raw = String(err?.message || err || '')
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('API error 0:')) {
    return arabic
      ? 'تعذّر الاتصال بالخادم. تأكد من تشغيل الخادم ثم أعد المحاولة.'
      : 'Cannot reach the server. Start the backend, then try again.'
  }
  const detail = raw.match(/\d+:\s*(.*)$/)?.[1] || raw
  try {
    const parsed = JSON.parse(detail)
    if (parsed?.detail) return String(parsed.detail)
  } catch { /* not JSON */ }
  return detail.replace(/^API error \d+:\s*/, '') || (arabic ? 'حدث خطأ غير متوقع.' : 'Something went wrong.')
}

export default function TeacherInterventions({ teacherId, classId, lang }) {
  const arabic = lang === 'ar'
  const [suggestions, setSuggestions] = useState([])
  const [interventions, setInterventions] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [students, setStudents] = useState([])
  const [form, setForm] = useState({ student_id: '', title: '', action_type: 'follow_up', priority: 'medium', details: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busyKey, setBusyKey] = useState('')

  const flash = (msg, isError = false) => {
    if (isError) {
      setError(msg)
      setSuccess('')
    } else {
      setSuccess(msg)
      setError('')
    }
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, i, st] = await Promise.all([
        api.interventionSuggestions(teacherId, classId),
        api.interventions(teacherId, classId),
        api.classStudents(teacherId, classId),
      ])
      setSuggestions(Array.isArray(s) ? s : [])
      setInterventions(Array.isArray(i) ? i : [])
      setStudents(Array.isArray(st) ? st : [])
      setError('')
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [teacherId, classId])

  // Hide suggestions that already have an open intervention for the same student.
  const openByStudent = new Set(
    interventions
      .filter((x) => !['completed', 'dismissed', 'outcome_review'].includes(x.status))
      .map((x) => x.student_id),
  )
  const visibleSuggestions = suggestions.filter((s) => !openByStudent.has(s.student_id))

  const handleCreate = async () => {
    setError('')
    setSuccess('')
    if (!form.student_id) {
      flash(arabic ? 'اختر الطالب أولاً.' : 'Select a student first.', true)
      return
    }
    if (!form.title.trim()) {
      flash(arabic ? 'أدخل عنواناً للتدخل (3 أحرف على الأقل).' : 'Enter a title (at least 3 characters).', true)
      return
    }
    if (form.title.trim().length < 3) {
      flash(arabic ? 'العنوان قصير جداً (3 أحرف على الأقل).' : 'Title is too short (min 3 characters).', true)
      return
    }
    setCreating(true)
    try {
      await api.createIntervention(teacherId, { ...form, class_id: classId, title: form.title.trim() })
      setForm({ student_id: '', title: '', action_type: 'follow_up', priority: 'medium', details: '' })
      setShowCreate(false)
      flash(arabic ? 'تم إنشاء التدخل.' : 'Intervention created.')
      await loadData()
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setCreating(false)
  }

  const handleFromSuggestion = async (studentId) => {
    const key = `s:${studentId}`
    setBusyKey(key)
    setError('')
    setSuccess('')
    try {
      await api.createFromSuggestion(teacherId, classId, studentId)
      flash(arabic ? 'تم إنشاء التدخل من الاقتراح.' : 'Intervention created from suggestion.')
      await loadData()
    } catch (err) {
      flash(friendlyError(err, arabic), true)
      await loadData()
    }
    setBusyKey('')
  }

  const handleAdvance = async (id, currentStatus) => {
    const transitions = {
      'suggested': 'approved',
      'approved': 'in_progress',
      'scheduled': 'in_progress',
      'in_progress': 'completed',
      'completed': 'outcome_review',
    }
    const next = transitions[currentStatus]
    if (!next) return
    setBusyKey(`a:${id}`)
    setError('')
    setSuccess('')
    try {
      await api.updateIntervention(teacherId, id, { status: next })
      flash(arabic ? `تم التحديث: ${currentStatus} → ${next}` : `Updated: ${currentStatus} → ${next}`)
      await loadData()
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setBusyKey('')
  }

  const priorityColor = (p) => {
    if (p === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    if (p === 'high') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    if (p === 'medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  }

  const statusColor = (s) => {
    if (s === 'completed' || s === 'outcome_review') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    if (s === 'dismissed') return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
    return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
  }

  if (loading) return <div className="py-8 text-center text-gray-400">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
          {arabic ? 'التدخلات' : 'Interventions'}
        </h2>
        <button onClick={() => { setShowCreate(!showCreate); setError(''); setSuccess('') }} className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-standard hover:bg-blue-700">
          {arabic ? '+ تدخل جديد' : '+ New Intervention'}
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          {success}
        </p>
      )}

      {showCreate && (
        <div className="mb-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <select value={form.student_id} onChange={(e) => setForm({...form, student_id: e.target.value})} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">{arabic ? 'اختر الطالب' : 'Select Student'}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder={arabic ? 'العنوان (مطلوب)' : 'Title (required)'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <select value={form.action_type} onChange={(e) => setForm({...form, action_type: e.target.value})} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="follow_up">{arabic ? 'متابعة' : 'Follow-up'}</option>
              <option value="targeted_review">{arabic ? 'مراجعة' : 'Targeted Review'}</option>
              <option value="progress_check">{arabic ? 'فحص التقدم' : 'Progress Check'}</option>
            </select>
            <select value={form.priority} onChange={(e) => setForm({...form, priority: e.target.value})} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="low">{arabic ? 'منخفض' : 'Low'}</option>
              <option value="medium">{arabic ? 'متوسط' : 'Medium'}</option>
              <option value="high">{arabic ? 'عالي' : 'High'}</option>
              <option value="critical">{arabic ? 'حرج' : 'Critical'}</option>
            </select>
            <input type="text" value={form.details} onChange={(e) => setForm({...form, details: e.target.value})} placeholder={arabic ? 'التفاصيل' : 'Details'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {creating ? '...' : (arabic ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      )}

      {/* AI Suggestions */}
      {visibleSuggestions.length > 0 && (
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">
            {arabic ? 'اقتراحات الذكاء الاصطناعي' : 'AI Suggestions'}
          </h3>
          <div className="space-y-2">
            {visibleSuggestions.map((s, i) => (
              <AnimatedCard key={`${s.student_id}-${i}`} delay={i * 0.05}>
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
                <div>
                  <span className="font-semibold text-gray-900 dark:text-white">{s.student}</span>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">{s.title}</span>
                </div>
                <button
                  onClick={() => handleFromSuggestion(s.student_id)}
                  disabled={busyKey === `s:${s.student_id}`}
                  className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  {busyKey === `s:${s.student_id}` ? '...' : (arabic ? 'إنشاء' : 'Create')}
                </button>
              </div>
              </AnimatedCard>
            ))}
          </div>
        </div>
      )}

      {/* Active Interventions */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">
          {arabic ? 'التدخلات النشطة' : 'Active Interventions'}
        </h3>
        {interventions.length === 0 ? (
          <p className="text-sm text-gray-400">{arabic ? 'لا توجد تدخلات' : 'No interventions'}</p>
        ) : (
          <div className="space-y-2">
            {interventions.map((item) => (
              <AnimatedCard key={item.id} delay={0.05}>
              <div className="rounded-xl border border-gray-100 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-gray-900 dark:text-white">{item.title}</span>
                    <span className="ml-2 text-sm text-gray-500">- {item.student}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${priorityColor(item.priority)}`}>{item.priority}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColor(item.status)}`}>{item.status}</span>
                  </div>
                </div>
                {item.details && <p className="mb-2 text-xs text-gray-500">{item.details}</p>}
                {item.improvement !== null && item.improvement !== undefined && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {arabic ? 'التحسن' : 'Improvement'}: {item.improvement > 0 ? '+' : ''}{item.improvement}%
                  </p>
                )}
                {item.status !== 'completed' && item.status !== 'outcome_review' && item.status !== 'dismissed' && (
                  <button
                    onClick={() => handleAdvance(item.id, item.status)}
                    disabled={busyKey === `a:${item.id}`}
                    className="mt-2 rounded-lg bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 disabled:opacity-50"
                  >
                    {busyKey === `a:${item.id}` ? '...' : `${arabic ? 'تقدم' : 'Advance'} →`}
                  </button>
                )}
              </div>
              </AnimatedCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
