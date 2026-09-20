import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'


export default function MoodleConnect() {
  const { user } = useApp()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [courses, setCourses] = useState([])
  const [moodleUrl, setMoodleUrl] = useState('')
  const [moodleToken, setMoodleToken] = useState('')
  const [coursesLoading, setCoursesLoading] = useState(false)
  const [ragQuery, setRagQuery] = useState('')
  const [ragResult, setRagResult] = useState(null)
  const [ragLoading, setRagLoading] = useState(false)
  const [syncJob, setSyncJob] = useState(null)

  useEffect(() => {
    checkStatus()
  }, [])

  const checkStatus = async () => {
    setLoading(true)
    try {
      const res = await api.moodleStatus(user?.id)
      setStatus(res)
      if (res.connected) loadCourses()
    } catch {
      setStatus({ connected: false })
    } finally {
      setLoading(false)
    }
  }

  const connect = async () => {
    if (!moodleUrl || !moodleToken) return
    setConnecting(true)
    try {
      await api.moodleConnect({ user_id: user?.id, moodle_url: moodleUrl, token: moodleToken })
      await checkStatus()
    } catch {
      alert('Connection failed. Check your URL and token.')
    } finally {
      setConnecting(false)
    }
  }

  const disconnect = async () => {
    if (!confirm('Disconnect from Moodle?')) return
    try {
      await api.moodleDisconnect(user?.id)
      setStatus({ connected: false })
      setCourses([])
    } catch {}
  }

  const loadCourses = async () => {
    setCoursesLoading(true)
    try {
      const res = await api.moodleCourses(user?.id)
      setCourses(res.courses || [])
    } catch {
      setCourses([])
    } finally {
      setCoursesLoading(false)
    }
  }

  const activateCourse = async (courseId) => {
    try {
      await api.moodleActivateCourse(courseId, user?.id)
      setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, active: true } : c))
    } catch {}
  }

  const queryRag = async () => {
    if (!ragQuery.trim()) return
    setRagLoading(true)
    try {
      const res = await api.moodleRagQuery({ user_id: user?.id, query: ragQuery.trim() })
      setRagResult(res)
    } catch {
      setRagResult(null)
    } finally {
      setRagLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-center">
        <Mascot size={48} animate className="mascot-float" />
        <p className="mt-3 text-sm text-gray-500">Checking Moodle status...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Mascot size={48} animate mood={status?.connected ? 'happy' : 'neutral'} className="mascot-float" />
        <div>
          <h1 className="text-2xl font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Moodle LMS</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Connect your school's Moodle for course sync and RAG</p>
        </div>
      </div>

      {!status?.connected ? (
        <div className="space-y-4">
          <div className="border border-[var(--line)] rounded-lg bg-blue-50/50 p-4">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Enter your Moodle server URL and API token to connect. You can find these in your Moodle profile under <strong>Site administration → Plugins → Web services</strong>.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">Moodle URL</label>
            <input type="url" value={moodleUrl} onChange={(e) => setMoodleUrl(e.target.value)} placeholder="https://your-school.moodle.com" className="w-full brand-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-bold text-gray-700 dark:text-gray-300">API Token</label>
            <input type="password" value={moodleToken} onChange={(e) => setMoodleToken(e.target.value)} placeholder="Your Moodle web service token" className="w-full brand-input" />
          </div>
          <button onClick={connect} disabled={!moodleUrl || !moodleToken || connecting} className="w-full brand-btn-primary py-3 disabled:opacity-40">
            {connecting ? 'Connecting...' : 'Connect to Moodle'}
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center justify-between border border-[var(--line)] rounded-lg bg-green-50 p-4">
            <div>
              <p className="text-sm font-bold text-green-700 dark:text-green-300">✅ Connected to Moodle</p>
              <p className="text-xs text-gray-500 mt-0.5">{status.site_name || status.url || 'Moodle instance'}</p>
            </div>
            <button onClick={disconnect} className="brand-btn-ghost px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">Disconnect</button>
          </div>

          <div>
            <h2 className="mb-3 text-lg font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>Your Courses</h2>
            {coursesLoading ? (
              <p className="text-sm text-gray-500">Loading courses...</p>
            ) : courses.length === 0 ? (
              <p className="text-sm text-gray-500">No courses found. Try syncing.</p>
            ) : (
              <div className="space-y-2">
                {courses.map((c) => (
                  <div key={c.id || c.fullname} className="flex items-center justify-between border border-[var(--line)] rounded-lg p-4">
                    <div>
                      <p className="text-sm font-bold text-gray-800 dark:text-gray-100">{c.fullname || c.name}</p>
                      <p className="text-xs text-gray-500">{c.category || ''} {c.enrolled_users ? `• ${c.enrolled_users} students` : ''}</p>
                    </div>
                    <button onClick={() => activateCourse(c.id)} className={`brand-tag px-3 py-1.5 text-xs transition-standard ${c.active ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'brand-btn-secondary'}`}>
                      {c.active ? 'Active' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-extrabold text-blue-700 dark:text-blue-300" style={{ fontFamily: 'var(--font-heading)' }}>RAG Query</h2>
            <p className="mb-2 text-xs text-gray-500">Ask questions about your Moodle course materials using AI-powered retrieval.</p>
            <div className="flex gap-2">
              <input type="text" value={ragQuery} onChange={(e) => setRagQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && queryRag()} placeholder="Ask about course content..." className="flex-1 brand-input" />
              <button onClick={queryRag} disabled={!ragQuery.trim() || ragLoading} className="brand-btn-primary px-6 disabled:opacity-40">
                {ragLoading ? '...' : 'Ask'}
              </button>
            </div>
            {ragResult && (
              <div className="mt-3 border border-[var(--line)] rounded-lg bg-blue-50 p-4">
                <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed">{ragResult.answer || ragResult.response || 'No results found.'}</p>
                {ragResult.sources && ragResult.sources.length > 0 && (
                  <div className="mt-2 border-t border-blue-200 pt-2 dark:border-blue-800">
                    <p className="text-xs font-bold text-blue-500 mb-1">Sources:</p>
                    {ragResult.sources.map((s, i) => (
                      <p key={i} className="text-xs text-gray-500">• {typeof s === 'string' ? s : s.title || s.file || 'Source'}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
