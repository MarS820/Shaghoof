import { useState, useEffect, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'

import AnimatedCard from '../components/AnimatedCard'
import TeacherDashboard from '../components/teacher/TeacherDashboard'
import TeacherRoster from '../components/teacher/TeacherRoster'
import TeacherAssessments from '../components/teacher/TeacherAssessments'
import TeacherMisconceptions from '../components/teacher/TeacherMisconceptions'
import TeacherInterventions from '../components/teacher/TeacherInterventions'
import TeacherSettings from '../components/teacher/TeacherSettings'

const GRADES = [
  '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th'
]

const TABS = [
  { key: 'dashboard', labelEn: 'Command Center', labelAr: 'مركز التحكم', icon: '📊' },
  { key: 'roster', labelEn: 'Roster', labelAr: 'قائمة الطلاب', icon: '👥' },
  { key: 'assessments', labelEn: 'Assessments', labelAr: 'التقييمات', icon: '📝' },
  { key: 'misconceptions', labelEn: 'Misconceptions', labelAr: 'المفاهيم الخاطئة', icon: '⚠️' },
  { key: 'interventions', labelEn: 'Interventions', labelAr: 'التدخّلات', icon: '🎯' },
  { key: 'settings', labelEn: 'Settings', labelAr: 'الإعدادات', icon: '⚙️' },
]

function friendlyError(err, arabic) {
  const raw = String(err?.message || err || '')
  if (raw.includes('Failed to fetch') || raw.includes('NetworkError') || raw.includes('ECONNREFUSED') || raw.includes('API error 0:')) {
    return arabic
      ? 'تعذّر الاتصال بالخادم. تأكد من تشغيل الخادم (backend) ثم أعد المحاولة.'
      : 'Cannot reach the server. Start the backend, then try again.'
  }
  return raw.replace(/^API error \d+:\s*/, '') || (arabic ? 'حدث خطأ غير متوقع.' : 'Something went wrong.')
}

export default function Teacher() {
  const { user, lang } = useApp()
  const arabic = lang === 'ar'

  const [classes, setClasses] = useState([])
  const [selectedClass, setSelectedClass] = useState(null)
  const [activeTab, setActiveTab] = useState('dashboard')
  const [showCreateClass, setShowCreateClass] = useState(false)
  const [newClassName, setNewClassName] = useState('')
  const [newClassGrade, setNewClassGrade] = useState('1st')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [pageError, setPageError] = useState('')
  const [createError, setCreateError] = useState('')

  // Hooks must run in the same order while auth state hydrates.  Keep the
  // redirect below the hooks rather than returning before them.
  const teacherId = user?.id || user?.user_id || ''

  const loadClasses = useCallback(async () => {
    if (!teacherId) {
      setClasses([])
      setLoading(false)
      return
    }
    try {
      const data = await api.teacherClasses(teacherId)
      setClasses(Array.isArray(data) ? data : [])
      setPageError('')
      if (Array.isArray(data) && data.length > 0) setSelectedClass((current) => current || data[0])
    } catch (err) {
      setClasses([])
      setPageError(friendlyError(err, arabic))
    }
    setLoading(false)
  }, [teacherId, arabic])

  useEffect(() => { loadClasses() }, [loadClasses])

  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'teacher') return <Navigate to="/dashboard" replace />

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return
    setCreating(true)
    setCreateError('')
    try {
      await api.createTeacherClass(teacherId, { name: newClassName.trim(), grade: newClassGrade })
      setNewClassName('')
      setNewClassGrade('1st')
      setShowCreateClass(false)
      await loadClasses()
    } catch (err) {
      setCreateError(friendlyError(err, arabic))
    }
    setCreating(false)
  }

  const gradeLabels = {
    '1st': arabic ? 'الصف الأول' : '1st Grade',
    '2nd': arabic ? 'الصف الثاني' : '2nd Grade',
    '3rd': arabic ? 'الصف الثالث' : '3rd Grade',
    '4th': arabic ? 'الصف الرابع' : '4th Grade',
    '5th': arabic ? 'الصف الخامس' : '5th Grade',
    '6th': arabic ? 'الصف السادس' : '6th Grade',
    '7th': arabic ? 'الصف السابع' : '7th Grade',
    '8th': arabic ? 'الصف الثامن' : '8th Grade',
    '9th': arabic ? 'الصف التاسع' : '9th Grade',
    '10th': arabic ? 'الصف العاشر' : '10th Grade',
    '11th': arabic ? 'الصف الحادي عشر' : '11th Grade',
    '12th': arabic ? 'الصف الثاني عشر' : '12th Grade',
  }

  return (
    <div className="relative mx-auto max-w-7xl px-4 py-6">

      {/* Header */}
      <div className="mb-6 flex items-center justify-between animate-slide-up">
        <div className="flex items-center gap-3">
          <Mascot size={56} mood="excited" />
          <div>
            <h1 className="text-2xl font-extrabold text-blue-600 dark:text-blue-400" style={{ fontFamily: 'var(--font-heading)' }}>
              {arabic ? 'لوحة المعلم' : 'Teacher Board'}
            </h1>
            <p className="mt-1 text-sm text-blue-400 dark:text-blue-300">
              {arabic ? `مرحباً، ${user.name}` : `Welcome, ${user.name} 👋`}
            </p>
          </div>
        </div>
      </div>

      {/* Class Selector */}
      <AnimatedCard delay={0.1} className="mb-6 rounded-2xl border-2 border-blue-200 bg-white p-4 dark:border-blue-900/30 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
            {arabic ? 'الفصل:' : '📚 Class:'}
          </span>
          {classes.map((cls, i) => (
            <button
              key={cls.id}
              onClick={() => { setSelectedClass(cls); setActiveTab('dashboard') }}
              className={`animate-pop-in rounded-xl border-2 px-4 py-2 text-sm font-bold transition-bouncy ${
                selectedClass?.id === cls.id
                  ? 'border-blue-500 bg-blue-100 text-blue-700 dark:border-blue-500 dark:bg-blue-900/30 dark:text-blue-300 animate-pulse-glow'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-blue-900/20'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              {cls.name}
              <span className="ml-1.5 text-xs opacity-70">({gradeLabels[cls.grade] || cls.grade})</span>
              <span className="ml-1.5 text-xs opacity-50">{cls.student_count} 👤</span>
            </button>
          ))}
          <button
            onClick={() => setShowCreateClass(!showCreateClass)}
            className="animate-pop-in rounded-xl border-2 border-dashed border-blue-300 px-4 py-2 text-sm font-bold text-blue-500 transition-bouncy hover:border-blue-400 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-400"
          >
            {arabic ? '+ إنشاء فصل' : '+ New Class'}
          </button>
        </div>

        {showCreateClass && (
          <div className="mt-4 flex flex-wrap items-end gap-3 rounded-xl bg-blue-50 p-4 animate-pop-in dark:bg-blue-900/20">
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-600 dark:text-blue-400">
                {arabic ? 'اسم الفصل' : 'Class Name'}
              </label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder={arabic ? 'مثال: الصف 5 أ' : 'e.g. Grade 5A'}
                className="rounded-xl border-2 border-blue-200 bg-white px-3 py-2 text-sm font-medium transition-standard focus:border-blue-400 focus:ring-2 focus:ring-blue-200 dark:border-blue-800 dark:bg-gray-800 dark:text-white dark:focus:border-blue-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-blue-600 dark:text-blue-400">
                {arabic ? 'المرحلة' : 'Grade'}
              </label>
              <select
                value={newClassGrade}
                onChange={(e) => setNewClassGrade(e.target.value)}
                className="rounded-xl border-2 border-blue-200 bg-white px-3 py-2 text-sm font-medium transition-standard focus:border-blue-400 dark:border-blue-800 dark:bg-gray-800 dark:text-white"
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>{gradeLabels[g]}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreateClass}
              disabled={creating || !newClassName.trim()}
              className="rounded-xl bg-blue-500 px-5 py-2 text-sm font-bold text-white transition-bouncy hover:bg-blue-600 hover:scale-105 hover:shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:hover:scale-100 dark:hover:shadow-blue-900/30"
            >
              {creating ? (arabic ? 'جارٍ الإنشاء...' : '✨ Creating...') : (arabic ? 'إنشاء' : '🚀 Create')}
            </button>
            {createError && (
              <p role="alert" className="w-full rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">
                {createError}
              </p>
            )}
          </div>
        )}
      </AnimatedCard>

      {/* Tab Bar */}
      {selectedClass && (
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((tab, i) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`animate-pop-in flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold transition-bouncy ${
                activeTab === tab.key
                  ? 'bg-blue-500 text-white shadow-lg shadow-blue-300/50 dark:shadow-blue-900/30 animate-pulse-glow'
                  : 'bg-blue-100 text-blue-600 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:hover:bg-blue-900/50'
              }`}
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <span className="text-lg">{tab.icon}</span>
              {arabic ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      {selectedClass && (
        <AnimatedCard delay={0.3} className="rounded-2xl border-2 border-blue-200 bg-white p-6 dark:border-blue-900/30 dark:bg-gray-900">
          {activeTab === 'dashboard' && <TeacherDashboard teacherId={teacherId} classId={selectedClass.id} lang={lang} />}
          {activeTab === 'roster' && <TeacherRoster teacherId={teacherId} classId={selectedClass.id} lang={lang} />}
          {activeTab === 'assessments' && <TeacherAssessments teacherId={teacherId} classId={selectedClass.id} lang={lang} />}
          {activeTab === 'misconceptions' && <TeacherMisconceptions teacherId={teacherId} classId={selectedClass.id} lang={lang} />}
          {activeTab === 'interventions' && <TeacherInterventions teacherId={teacherId} classId={selectedClass.id} lang={lang} />}
          {activeTab === 'settings' && <TeacherSettings teacherId={teacherId} lang={lang} />}
        </AnimatedCard>
      )}

      {!loading && pageError && (
        <AnimatedCard delay={0.15} className="rounded-2xl border-2 border-red-200 bg-white p-6 dark:border-red-900/40 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-red-600 dark:text-red-300" role="alert">{pageError}</p>
              <p className="mt-1 text-xs text-red-400 dark:text-red-400">
                {arabic ? 'قد لا يعمل إنشاء الفصل حتى يستعيد الخادم الاتصال.' : 'Class create will fail until the backend is reachable.'}
              </p>
            </div>
            <button
              onClick={() => loadClasses()}
              className="rounded-xl bg-red-500 px-4 py-2 text-xs font-bold text-white transition-bouncy hover:bg-red-600"
            >
              {arabic ? 'إعادة المحاولة' : 'Retry'}
            </button>
          </div>
        </AnimatedCard>
      )}

      {!loading && !pageError && classes.length === 0 && (
        <AnimatedCard delay={0.2} className="rounded-2xl border-2 border-dashed border-blue-300 bg-white p-12 text-center dark:border-blue-700 dark:bg-gray-900">
          <Mascot size={96} mood="thinking" className="mx-auto mb-4" />
          <p className="text-lg font-bold text-blue-400 dark:text-blue-300">
            {arabic ? 'لا يوجد فصول بعد. أنشئ فصلاً للبدء.' : 'No classes yet. Create a class to get started!'}
          </p>
          <p className="mt-2 text-sm text-blue-300 dark:text-blue-400">
            {arabic ? 'سيتم تسجيل الطلاب تلقائياً في الفصول التي تطابق صفهم' : 'Students will auto-enroll into classes matching their grade'}
          </p>
        </AnimatedCard>
      )}
    </div>
  )
}
