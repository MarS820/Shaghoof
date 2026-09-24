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

export default function TeacherSettings({ teacherId, lang }) {
  const arabic = lang === 'ar'
  const [settings, setSettings] = useState({ notifications: true, risk_threshold: 40 })
  const [auditLog, setAuditLog] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const flash = (msg, isError = false) => {
    if (isError) { setError(msg); setSuccess('') } else { setSuccess(msg); setError('') }
    setTimeout(() => { setError(''); setSuccess('') }, 4000)
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([
      api.teacherSettings(teacherId),
      api.auditLog(teacherId),
    ]).then(([s, a]) => {
      setSettings(s)
      setAuditLog(Array.isArray(a) ? a : [])
    }).catch((err) => {
      flash(friendlyError(err, arabic), true)
    }).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId])

  const handleSave = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      await api.updateTeacherSettings(teacherId, settings)
      flash(arabic ? 'تم حفظ الإعدادات.' : 'Settings saved.')
    } catch (err) {
      flash(friendlyError(err, arabic), true)
    }
    setSaving(false)
  }

  if (loading) return <div className="py-8 text-center text-gray-400">{arabic ? 'جارٍ التحميل...' : 'Loading...'}</div>

  return (
    <div>
      <h2 className="mb-4 text-xl font-extrabold text-blue-700 dark:text-blue-300">
        {arabic ? 'الإعدادات' : 'Settings'}
      </h2>

      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-600 dark:bg-red-950/40 dark:text-red-300">{error}</p>
      )}
      {success && (
        <p role="status" className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">{success}</p>
      )}

      <AnimatedCard className="mb-6 rounded-xl bg-gray-50 p-4 dark:bg-gray-800">
        <div className="mb-4 flex items-center justify-between">
          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            {arabic ? 'الإشعارات' : 'Notifications'}
          </label>
          <button
            onClick={() => setSettings({...settings, notifications: !settings.notifications})}
            className={`relative h-6 w-11 rounded-full transition-standard ${settings.notifications ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-standard ${settings.notifications ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="mb-1 block text-sm font-semibold text-gray-700 dark:text-gray-300">
            {arabic ? 'عتبة الخطر' : 'Risk Threshold'}: {settings.risk_threshold}
          </label>
          <input
            type="range"
            min="10"
            max="90"
            value={settings.risk_threshold}
            onChange={(e) => setSettings({...settings, risk_threshold: Number(e.target.value)})}
            className="w-full accent-blue-500"
          />
          <div className="flex justify-between text-xs text-gray-400">
            <span>10</span>
            <span>90</span>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="mt-4 rounded-lg bg-blue-500 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50">
          {saving ? (arabic ? 'جارٍ الحفظ...' : 'Saving...') : (arabic ? 'حفظ' : 'Save')}
        </button>
      </AnimatedCard>

      {/* Audit Log */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-gray-700 dark:text-gray-300">
          {arabic ? 'سجل التدقيق' : 'Audit Log'}
        </h3>
        {auditLog.length === 0 ? (
          <p className="text-sm text-gray-400">{arabic ? 'لا يوجد سجل' : 'No audit entries'}</p>
        ) : (
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {auditLog.slice(0, 50).map((entry) => (
              <div key={entry.id} className="flex items-start gap-3 rounded-lg border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800">
                <span className="text-xs text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono text-gray-600 dark:bg-gray-700 dark:text-gray-400">{entry.action}</span>
                <span className="text-xs text-gray-500">{entry.entity_type}{entry.entity_id ? `#${entry.entity_id}` : ''}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
