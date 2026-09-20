import { useState, useEffect } from 'react'
import api from '../../services/api'
import AnimatedCard from '../AnimatedCard'

export default function TeacherRoster({ teacherId, classId, lang }) {
  const arabic = lang === 'ar'
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRisk, setFilterRisk] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', progress: 0, status: 'green' })
  const [adding, setAdding] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)

  const loadStudents = async () => {
    setLoading(true)
    try {
      const data = await api.teacherRoster(teacherId, classId, {
        q: search || undefined,
        status: filterStatus || undefined,
        risk_level: filterRisk || undefined,
      })
      setStudents(data)
    } catch {}
    setLoading(false)
  }

  useEffect(() => { loadStudents() }, [teacherId, classId, search, filterStatus, filterRisk])

  const handleAdd = async () => {
    if (!form.name.trim() || !form.email.trim()) return
    setAdding(true)
    try {
      await api.createStudent(teacherId, classId, form)
      setForm({ name: '', email: '', progress: 0, status: 'green' })
      setShowAdd(false)
      loadStudents()
    } catch {}
    setAdding(false)
  }

  const openProfile = async (studentId) => {
    setSelectedStudent(studentId)
    setProfileLoading(true)
    try {
      const data = await api.studentProfile(teacherId, classId, studentId)
      setProfile(data)
    } catch {}
    setProfileLoading(false)
  }

  const riskColor = (level) => {
    if (level === 'critical') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
    if (level === 'high') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
    if (level === 'medium') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
  }

  const statusColor = (s) => {
    if (s === 'green') return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'
    if (s === 'yellow') return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300'
    return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
  }

  if (selectedStudent) {
    return (
      <div>
        <button onClick={() => { setSelectedStudent(null); setProfile(null) }} className="mb-4 text-sm font-bold text-blue-500 hover:text-blue-700 dark:text-blue-400">
          ← {arabic ? 'رجوع للقائمة' : 'Back to roster'}
        </button>
        {profileLoading ? (
          <div className="py-8 text-center text-gray-400">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>
        ) : profile ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-blue-700 dark:text-blue-300">{profile.student.name}</h3>
                <p className="text-sm text-gray-500">{profile.student.email}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${statusColor(profile.status)}`}>{profile.progress}%</span>
                <span className={`rounded-full px-3 py-1 text-sm font-bold ${riskColor(profile.academic_risk.level)}`}>
                  {arabic ? 'خطر' : 'Risk'}: {profile.academic_risk.score}
                </span>
              </div>
            </div>
            {profile.academic_risk.reasons.length > 0 && (
              <div className="mb-4 rounded-xl bg-amber-50 p-4 dark:bg-amber-900/20">
                <h4 className="mb-2 text-sm font-bold text-amber-700 dark:text-amber-300">{arabic ? 'أسباب الخطر' : 'Risk Reasons'}</h4>
                {profile.academic_risk.reasons.map((r, i) => (
                  <p key={i} className="text-xs text-amber-600 dark:text-amber-400">• {r.message}</p>
                ))}
              </div>
            )}
            {profile.submissions.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-bold text-gray-700 dark:text-gray-300">{arabic ? 'النتائج' : 'Submissions'}</h4>
                <div className="space-y-2">
                  {profile.submissions.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                      <div>
                        <span className="font-semibold text-gray-900 dark:text-white">{s.assessment}</span>
                        <span className="ml-2 text-xs text-gray-400">#{s.attempt_no}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-700 dark:text-gray-300">{s.raw_score}/{s.max_score}</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${s.percentage >= 70 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'}`}>
                          {s.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-extrabold text-blue-700 dark:text-blue-300">
          {arabic ? 'قائمة الطلاب' : 'Roster'}
        </h2>
        <button onClick={() => setShowAdd(!showAdd)} className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white transition-standard hover:bg-blue-700">
          {arabic ? '+ إضافة طالب' : '+ Add Student'}
        </button>
      </div>

      {showAdd && (
        <div className="mb-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input type="text" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} placeholder={arabic ? 'الاسم' : 'Name'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <input type="email" value={form.email} onChange={(e) => setForm({...form, email: e.target.value})} placeholder={arabic ? 'البريد' : 'Email'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <input type="number" min="0" max="100" value={form.progress} onChange={(e) => setForm({...form, progress: Number(e.target.value)})} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
            <button onClick={handleAdd} disabled={adding} className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
              {adding ? '...' : (arabic ? 'إضافة' : 'Add')}
            </button>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-2">
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={arabic ? 'بحث...' : 'Search...'} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <option value="">{arabic ? 'كل الحالات' : 'All Status'}</option>
          <option value="green">{arabic ? 'أخضر' : 'Green'}</option>
          <option value="yellow">{arabic ? 'أصفر' : 'Yellow'}</option>
          <option value="red">{arabic ? 'أحمر' : 'Red'}</option>
        </select>
        <select value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)} className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white">
          <option value="">{arabic ? 'كل المستويات' : 'All Risk'}</option>
          <option value="low">{arabic ? 'منخفض' : 'Low'}</option>
          <option value="medium">{arabic ? 'متوسط' : 'Medium'}</option>
          <option value="high">{arabic ? 'عالي' : 'High'}</option>
          <option value="critical">{arabic ? 'حرج' : 'Critical'}</option>
        </select>
      </div>

      {loading ? (
        <div className="py-8 text-center text-gray-400">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>
      ) : students.length === 0 ? (
        <div className="py-8 text-center text-gray-400">{arabic ? 'لا يوجد طلاب' : 'No students'}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'الطالب' : 'Student'}</th>
                <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'التقدم' : 'Progress'}</th>
                <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'الحالة' : 'Status'}</th>
                <th className="pb-2 font-bold text-gray-600 dark:text-gray-400">{arabic ? 'الخطر' : 'Risk'}</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <AnimatedCard key={s.id} delay={0.05}>
                <tr className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-3">
                    <div className="font-semibold text-gray-900 dark:text-white">{s.name}</div>
                    <div className="text-xs text-gray-400">{s.email}</div>
                  </td>
                  <td className="py-3 font-bold text-gray-700 dark:text-gray-300">{s.progress}%</td>
                  <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColor(s.status)}`}>{s.status}</span></td>
                  <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-bold ${riskColor(s.academic_risk.level)}`}>{s.academic_risk.score}</span></td>
                  <td className="py-3">
                    <button onClick={() => openProfile(s.id)} className="text-xs font-bold text-blue-500 hover:text-blue-700 dark:text-blue-400">
                      {arabic ? 'عرض' : 'View'}
                    </button>
                  </td>
                </tr>
                </AnimatedCard>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
