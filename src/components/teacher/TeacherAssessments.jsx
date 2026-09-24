import { useState, useEffect } from 'react'
import api from '../../services/api'
import AnimatedCard from '../AnimatedCard'

function friendlyError(err, arabic) {
  const raw = String(err?.message || err || '')
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('API error 0:')) {
    return arabic ? 'تعذّر الاتصال بالخادم. تأكد من تشغيل الخادم ثم أعد المحاولة.' : 'Cannot reach the server. Start the backend, then try again.'
  }
  const detail = raw.match(/\d+:\s*(.*)$/)?.[1] || raw
  try {
    const parsed = JSON.parse(detail)
    if (parsed?.detail) return String(parsed.detail)
  } catch { /* not JSON */ }
  return detail.replace(/^API error \d+:\s*/, '') || (arabic ? 'حدث خطأ غير متوقع.' : 'Something went wrong.')
}

export default function TeacherAssessments({ teacherId, classId, lang }) {
  const arabic = lang === 'ar'
  const [assessments, setAssessments] = useState([])
  const [students, setStudents] = useState([])
  const [submissions, setSubmissions] = useState([])
  const [analytics, setAnalytics] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showAddResult, setShowAddResult] = useState(false)
  const [form, setForm] = useState({ title: '', max_score: 100, attempt_limit: 1, status: 'draft' })
  const [resultForm, setResultForm] = useState({ assessment_id: '', student_id: '', raw_score: 0, misconception: '', teacher_feedback: '' })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') } else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const [a, s, sub, an] = await Promise.all([
        api.classAssessments(teacherId, classId),
        api.classStudents(teacherId, classId),
        api.classSubmissions(teacherId, classId),
        api.assessmentAnalytics(teacherId, classId),
      ])
      setAssessments(Array.isArray(a) ? a : [])
      setStudents(Array.isArray(s) ? s : [])
      setSubmissions(Array.isArray(sub) ? sub : [])
      setAnalytics(Array.isArray(an) ? an : [])
      setError('')
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [teacherId, classId])

  const handleCreate = async () => {
    setError('')
    setSuccess('')
    if (!form.title.trim()) {
      flash(arabic ? 'أدخل عنوان التقييم أولاً.' : 'Enter an assessment title first.', true)
      return
    }
    setCreating(true)
    try {
      await api.createAssessment(teacherId, classId, form)
      setForm({ title: '', max_score: 100, attempt_limit: 1, status: 'draft' })
      setShowCreate(false)
      flash(arabic ? 'تم إنشاء التقييم.' : 'Assessment created.')
      await loadData()
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setCreating(false)
  }

  const handleAddResult = async () => {
    setError('')
    setSuccess('')
    if (!resultForm.assessment_id || !resultForm.student_id) {
      flash(arabic ? 'اختر التقييم والطالب أولاً.' : 'Select an assessment and student first.', true)
      return
    }
    setCreating(true)
    try {
      await api.createSubmission(teacherId, { ...resultForm, raw_score: Number(resultForm.raw_score) })
      setResultForm({ assessment_id: '', student_id: '', raw_score: 0, misconception: '', teacher_feedback: '' })
      setShowAddResult(false)
      flash(arabic ? 'تمت إضافة النتيجة.' : 'Result added.')
      await loadData()
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setCreating(false)
  }

  const statusColor = (s) => {
    if (s === 'published') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    if (s === 'closed') return 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300'
    return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
          {arabic ? 'التقييمات والنتائج' : 'Assessments & Results'}
        </h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowCreate(!showCreate); setShowAddResult(false); setError(''); setSuccess('') }} className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-standard hover:bg-blue-700">
            {arabic ? '+ إنشاء تقييم' : '+ New Assessment'}
          </button>
          <button onClick={() => { setShowAddResult(!showAddResult); setShowCreate(false); setError(''); setSuccess('') }} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-standard hover:bg-emerald-700">
            {arabic ? '+ إضافة نتيجة' : '+ Add Result'}
          </button>
        </div>
      </div>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}
      {success && (
        <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{success}</p>
      )}

      {showCreate && (
        <div className="mb-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="text" value={form.title} onChange={(e) => setForm({...form, title: e.target.value})} placeholder={arabic ? 'عنوان التقييم' : 'Assessment Title'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <input type="number" min="1" value={form.max_score} onChange={(e) => setForm({...form, max_score: Number(e.target.value)})} placeholder="Max Score" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <input type="number" min="1" max="20" value={form.attempt_limit} onChange={(e) => setForm({...form, attempt_limit: Number(e.target.value)})} placeholder="Attempts" className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <button onClick={handleCreate} disabled={creating} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {creating ? '...' : (arabic ? 'إنشاء' : 'Create')}
            </button>
          </div>
        </div>
      )}

      {showAddResult && (
        <div className="mb-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <select value={resultForm.assessment_id} onChange={(e) => setResultForm({...resultForm, assessment_id: e.target.value})} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">{arabic ? 'اختر التقييم' : 'Select Assessment'}</option>
              {assessments.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
            <select value={resultForm.student_id} onChange={(e) => setResultForm({...resultForm, student_id: e.target.value})} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
              <option value="">{arabic ? 'اختر الطالب' : 'Select Student'}</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <input type="number" min="0" value={resultForm.raw_score} onChange={(e) => setResultForm({...resultForm, raw_score: e.target.value})} placeholder={arabic ? 'الدرجة' : 'Score'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <input type="text" value={resultForm.misconception} onChange={(e) => setResultForm({...resultForm, misconception: e.target.value})} placeholder={arabic ? 'مفهوم خاطئ' : 'Misconception'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <input type="text" value={resultForm.teacher_feedback} onChange={(e) => setResultForm({...resultForm, teacher_feedback: e.target.value})} placeholder={arabic ? 'ملاحظات' : 'Feedback'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <button onClick={handleAddResult} disabled={creating} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {creating ? '...' : (arabic ? 'إضافة' : 'Add')}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-8 text-center text-gray-400">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : (
        <>
          {/* Assessments List */}
          <div className="mb-6">
            <h3 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">{arabic ? 'التقييمات' : 'Assessments'}</h3>
            {assessments.length === 0 ? (
              <p className="text-sm text-gray-400">{arabic ? 'لا توجد تقييمات' : 'No assessments'}</p>
            ) : (
              <div className="space-y-2">
                {assessments.map((a) => {
                  const an = analytics.find((x) => x.assessment_id === a.id)
                  return (
                    <AnimatedCard key={a.id} delay={0.05}>
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">{a.title}</span>
                        <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-bold ${statusColor(a.status)}`}>{a.status}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>{arabic ? 'الدرجة القصوى' : 'Max'}: {a.max_score}</span>
                        {an && <span>{arabic ? 'المعدل' : 'Avg'}: {an.average_final ?? '-'}</span>}
                        {an && <span>{arabic ? 'مرسل' : 'Submitted'}: {an.students_submitted}</span>}
                      </div>
                    </div>
                    </AnimatedCard>
                  )
                })}
              </div>
            )}
          </div>

          {/* Submissions */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">{arabic ? 'النتائج' : 'Results'}</h3>
            {submissions.length === 0 ? (
              <p className="text-sm text-gray-400">{arabic ? 'لا توجد نتائج' : 'No results'}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'الطالب' : 'Student'}</th>
                      <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'التقييم' : 'Assessment'}</th>
                      <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'الدرجة' : 'Score'}</th>
                      <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'النسبة' : 'Percent'}</th>
                      <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'ملاحظة' : 'Misconception'}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submissions.slice(0, 20).map((s) => (
                      <tr key={s.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="py-2 font-semibold text-gray-900 dark:text-white">{s.student}</td>
                        <td className="py-2 text-gray-600 dark:text-gray-400">{s.assessment}</td>
                        <td className="py-2 font-bold text-gray-700 dark:text-gray-300">{s.raw_score}/{s.max_score}</td>
                        <td className="py-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.percentage >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                            {s.percentage}%
                          </span>
                        </td>
                        <td className="py-2 text-xs text-gray-500">{s.misconception || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
