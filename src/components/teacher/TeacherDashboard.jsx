import { useState, useEffect } from 'react'
import api from '../../services/api'
import AnimatedCard from '../AnimatedCard'

export default function TeacherDashboard({ teacherId, classId, lang }) {
  const arabic = lang === 'ar'
  const [data, setData] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.teacherDashboard(teacherId, classId),
      api.teacherNotifications(teacherId),
    ]).then(([dash, notifs]) => {
      setData(dash)
      setNotifications(notifs)
    }).catch(() => {}).finally(() => setLoading(false))
  }, [teacherId, classId])

  if (loading) return (
    <div className="py-8 text-center">
      <div className="inline-block animate-mascot-bounce text-4xl mb-2">✨</div>
      <p className="text-blue-400 font-bold">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</p>
    </div>
  )
  if (!data) return (
    <div className="py-8 text-center">
      <div className="inline-block text-4xl mb-2">😢</div>
      <p className="text-red-400 font-bold">{arabic ? 'خطأ في التحميل' : 'Failed to load'}</p>
    </div>
  )

  const m = data.metrics || {}
  const riskStudents = data.risk_students || []

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

  const kpiEmojis = ['👥', '📊', '🏆', '⚠️', '🎯', '🔔']

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold text-blue-600 dark:text-blue-400">
        🎯 {arabic ? 'مركز التحكم' : 'Command Center'}
      </h2>

      {/* KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {[
          { label: arabic ? 'الطلاب' : 'Students', value: m.students },
          { label: arabic ? 'التقدم' : 'Avg Progress', value: `${m.average_progress || 0}%` },
          { label: arabic ? 'المعدل' : 'Avg Score', value: m.average_final_score != null ? `${m.average_final_score}%` : '-' },
          { label: arabic ? 'تحت الخطر' : 'At Risk', value: m.students_over_threshold },
          { label: arabic ? 'التدخلات' : 'Open Actions', value: m.open_interventions },
          { label: arabic ? 'غير مقروء' : 'Unread', value: data.unread_notifications },
        ].map((kpi, i) => (
          <AnimatedCard key={i} delay={i * 0.05} className="rounded-xl border-2 border-blue-200 bg-blue-50 p-3 text-center dark:border-blue-900/30 dark:bg-blue-900/10">
            <div className="text-2xl mb-1">{kpiEmojis[i]}</div>
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{kpi.value}</div>
            <div className="mt-1 text-xs font-bold text-blue-400 dark:text-blue-300">{kpi.label}</div>
          </AnimatedCard>
        ))}
      </div>

      {/* Risk Students */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-bold text-blue-600 dark:text-blue-400">
          ⚠️ {arabic ? 'الطلاب المعرضون للخطر' : 'Academic Risk Students'}
        </h3>
        {riskStudents.length === 0 && (
          <p className="text-sm text-blue-300 dark:text-blue-400">✨ {arabic ? 'لا يوجد طلاب في خطر' : 'No at-risk students'}</p>
        )}
        <div className="space-y-2">
          {riskStudents.slice(0, 10).map((s, i) => (
            <AnimatedCard key={s.student_id} delay={0.3 + i * 0.05} className="flex items-center justify-between rounded-xl border-2 border-blue-100 bg-white p-3 dark:border-blue-900/20 dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900 dark:text-white">{s.name}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${statusColor(s.status)}`}>
                  {s.progress}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-400">{s.risk.trend === 'declining' ? '📉' : s.risk.trend === 'improving' ? '📈' : '➡️'}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${riskColor(s.risk.level)}`}>
                  {s.risk.score} - {s.risk.level}
                </span>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-blue-600 dark:text-blue-400">
          🔔 {arabic ? 'الإشعارات' : 'Notifications'}
        </h3>
        {notifications.length === 0 && (
          <p className="text-sm text-blue-300 dark:text-blue-400">📭 {arabic ? 'لا إشعارات' : 'No notifications'}</p>
        )}
        <div className="space-y-2">
          {notifications.slice(0, 8).map((n, i) => (
            <AnimatedCard key={n.id} delay={0.4 + i * 0.05} className={`flex items-start gap-3 rounded-xl border-2 p-3 ${n.is_read ? 'border-blue-100 bg-blue-50/50 dark:border-blue-900/20 dark:bg-blue-900/5' : 'border-blue-300 bg-blue-100 dark:border-blue-700 dark:bg-blue-900/20'}`}>
              <span className={`mt-0.5 rounded-full px-2 py-0.5 text-xs font-bold ${riskColor(n.severity)}`}>
                {n.severity}
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{n.title}</p>
                <p className="text-xs text-blue-400 dark:text-blue-400">{n.message}</p>
              </div>
            </AnimatedCard>
          ))}
        </div>
      </div>
    </div>
  )
}
