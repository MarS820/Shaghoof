import { useState, useRef } from 'react'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'

const VARK_OPTIONS = [
  { id: 'visual', label: 'Visual', desc: 'Diagrams, charts, videos', icon: '👁️' },
  { id: 'auditory', label: 'Auditory', desc: 'Listening, discussion, podcasts', icon: '🎧' },
  { id: 'reading', label: 'Reading/Writing', desc: 'Notes, lists, written text', icon: '📖' },
  { id: 'kinesthetic', label: 'Kinesthetic', desc: 'Hands-on, practice, activities', icon: '🖐️' },
]

const SEN_OPTIONS = [
  { id: 'general', label: 'General', desc: 'No specific support needed' },
  { id: 'text', label: 'Text Support', desc: 'Clearer typography, speech-ready' },
  { id: 'focus', label: 'Focus Support', desc: 'Shorter tasks, fewer distractions' },
  { id: 'structure', label: 'Structure Support', desc: 'Step-by-step, progress tracking' },
]

const A11Y_OPTIONS = [
  { key: 'dyslexicFont', icon: '🔤', label: 'OpenDyslexic font', desc: 'Easier letter shapes for reading' },
  { key: 'largeText', icon: '🔠', label: 'Larger text', desc: 'Bigger base font size' },
  { key: 'highContrast', icon: '◐', label: 'High contrast', desc: 'Stronger colors + focus rings' },
  { key: 'lineFocus', icon: '📏', label: 'Line focus ruler', desc: 'Highlights one line at a time' },
  { key: 'voiceReader', icon: '🔊', label: 'Voice reader', desc: 'Reads tutor replies aloud automatically' },
  { key: 'audioQuiz', icon: '🎧', label: 'Audio quizzes', desc: 'Speak quiz questions when available' },
  { key: 'visualQuiz', icon: '👁️', label: 'Visual quizzes', desc: 'Add icons and visual cues to options' },
  { key: 'zenMode', icon: '🧘', label: 'Zen mode', desc: 'Distraction-free reading' },
  { key: 'whiteNoise', icon: '🎧', label: 'White noise', desc: 'Ambient focus sound (offline)' },
  { key: 'sensoryCalm', icon: '🌿', label: 'Low sensory load', desc: 'Calms animations and colors' },
  { key: 'dwellClick', icon: '🖱️', label: 'Dwell clicking', desc: 'Hover a button ~1s to press it (no clicking needed)' },
  { key: 'speechNav', icon: '🎙️', label: 'Voice control', desc: 'Say "scroll down", "read page", "stop" to navigate' },
]

function DataSourceCard({ source, onRemove, onSubjectChange, subjects }) {
  const typeLabels = { pdf: '📄 PDF', url: '🔗 Article', moodle: '🎓 Moodle', text: '✏️ Text' }
  return (
    <div className="rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)]/60 p-3 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--muted)]">{typeLabels[source.type] || source.type}</span>
            {source.subject && <span className="rounded-full bg-[var(--brand-light)] px-2 py-0.5 text-xs font-medium text-[var(--brand)]">{source.subject}</span>}
          </div>
          <p className="truncate text-sm font-medium text-[var(--ink)]">{source.name || source.url || 'Untitled'}</p>
          {source.wordCount && <p className="mt-0.5 text-xs text-[var(--muted)]">{source.wordCount} words</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={source.subject || ''}
            onChange={(e) => onSubjectChange(source.id, e.target.value)}
            className="rounded-lg border border-[var(--neutral-10)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--ink)]"
          >
            <option value="">Assign subject...</option>
            {subjects.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
          </select>
          <button onClick={() => onRemove(source.id)} className="text-[var(--muted)] transition-colors hover:text-[var(--danger)]">✕</button>
        </div>
      </div>
    </div>
  )
}

export default function Settings() {
  const { user, updateUser, toggleAccessibility, toggles } = useApp()
  const [vark, setVark] = useState(user?.vark?.dominant || 'visual')
  const [senProfile, setSenProfile] = useState(user?.sen_profile || 'general')
  const [subjects, setSubjects] = useState(user?.subjects || [])
  const [newSubject, setNewSubject] = useState('')
  const [sources, setSources] = useState(user?.dataSources || [])
  const [uploadType, setUploadType] = useState('url')
  const [uploadUrl, setUploadUrl] = useState('')
  const [uploadFile, setUploadFile] = useState(null)
  const [moodleUrl, setMoodleUrl] = useState(user?.moodleUrl || '')
  const [moodleToken, setMoodleToken] = useState(user?.moodleToken || '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const fileRef = useRef(null)

  const addSubject = () => {
    const name = newSubject.trim()
    if (!name || subjects.some((s) => s.name.toLowerCase() === name.toLowerCase())) return
    setSubjects((prev) => [...prev, { id: Date.now().toString(), name, sources: [] }])
    setNewSubject('')
  }

  const removeSubject = (id) => {
    setSubjects((prev) => prev.filter((s) => s.id !== id))
    setSources((prev) => prev.map((s) => s.subject === subjects.find((sub) => sub.id === id)?.name ? { ...s, subject: '' } : s))
  }

  const removeSource = (id) => setSources((prev) => prev.filter((s) => s.id !== id))

  const assignSubject = (sourceId, subjectName) => {
    setSources((prev) => prev.map((s) => s.id === sourceId ? { ...s, subject: subjectName } : s))
  }

  const handleUpload = async () => {
    setLoading(true)
    try {
      if (uploadType === 'url' && uploadUrl.trim()) {
        const res = await api.createWebLesson({ url: uploadUrl.trim(), user_id: user.id })
        setSources((prev) => [...prev, { id: Date.now().toString(), type: 'url', name: res.title || uploadUrl, url: uploadUrl, subject: '', wordCount: res.word_count || 0, data: res }])
        setUploadUrl('')
      } else if (uploadType === 'pdf' && uploadFile) {
        const fd = new FormData()
        fd.append('file', uploadFile)
        const upRes = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8080'}/pdf/upload?user_id=${user.id}`, { method: 'POST', body: fd })
        if (!upRes.ok) throw new Error('Upload failed')
        const upData = await upRes.json()
        setSources((prev) => [...prev, { id: Date.now().toString(), type: 'pdf', name: uploadFile.name, subject: '', wordCount: 0, sessionId: upData.session_id }])
        setUploadFile(null)
      } else if (uploadType === 'moodle' && moodleUrl.trim()) {
        setSources((prev) => [...prev, { id: Date.now().toString(), type: 'moodle', name: 'Moodle LMS', url: moodleUrl, subject: '', moodleToken }])
      }
    } catch { alert('Failed to add data source.') } finally { setLoading(false) }
  }

  const handleSave = async () => {
    const profile = {
      vark: { dominant: vark },
      sen_profile: senProfile,
      subjects,
      dataSources: sources,
      moodleUrl,
      moodleToken,
    }
    updateUser(profile)
    localStorage.setItem('shaghoof_user', JSON.stringify({ ...user, ...profile }))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    // Persist the student's subjects + sources so quizzes, lessons, and the
    // tutor can be grounded in them (server-side single source of truth).
    if (user?.id) {
      try {
        await api.updateProfile(user.id, {
          vark: profile.vark,
          sen_profile: senProfile,
          subjects: subjects.map((s) => ({ id: s.id, name: s.name })),
          dataSources: sources.map((src) => ({
            id: src.id,
            type: src.type,
            name: src.name || '',
            subject: src.subject || '',
            url: src.url || '',
            sessionId: src.sessionId || '',
            wordCount: src.wordCount || 0,
          })),
        })
      } catch { /* local twin stays authoritative when offline */ }
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Mascot size={40} animate mood="happy" />
        <div>
          <h1 className="text-xl font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Settings</h1>
          <p className="text-sm text-[var(--muted)]">Configure your learning profile and data sources</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* VARK Learning Style */}
        <section className="rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 text-base font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Learning Style (VARK)</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">How do you prefer to learn?</p>
          <div className="grid grid-cols-2 gap-3">
            {VARK_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setVark(opt.id)}
                className={`rounded-xl border p-3 text-left transition-bouncy ${vark === opt.id ? 'border-[var(--brand)] bg-[var(--brand-light)]' : 'border-[var(--neutral-10)] hover:border-[var(--brand)]'}`}
              >
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-lg">{opt.icon}</span>
                  <span className="text-sm font-semibold text-[var(--ink)]">{opt.label}</span>
                </div>
                <p className="text-xs text-[var(--muted)]">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* SEN Profile */}
        <section className="rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 text-base font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Support Profile</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">Additional support adaptations</p>
          <div className="grid grid-cols-2 gap-3">
            {SEN_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setSenProfile(opt.id)}
                className={`rounded-xl border p-3 text-left transition-bouncy ${senProfile === opt.id ? 'border-[var(--brand)] bg-[var(--brand-light)]' : 'border-[var(--neutral-10)] hover:border-[var(--brand)]'}`}
              >
                <span className="text-sm font-semibold text-[var(--ink)]">{opt.label}</span>
                <p className="mt-0.5 text-xs text-[var(--muted)]">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Subjects */}
        <section className="rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 text-base font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>My Subjects</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">Create subjects to organize your learning material</p>
          <div className="mb-3 flex gap-2">
            <input
              type="text"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSubject()}
              placeholder="e.g. Biology, Algebra, History..."
              className="flex-1 rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] px-4 py-2.5 text-sm"
            />
            <button onClick={addSubject} disabled={!newSubject.trim()} className="brand-btn-primary text-sm px-4">Add</button>
          </div>
          {subjects.length > 0 ? (
            <div className="space-y-2">
              {subjects.map((s) => {
                const sourceCount = sources.filter((src) => src.subject === s.name).length
                return (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-xl border border-[var(--neutral-10)] bg-[var(--page)] p-2.5"
                  >
                    <div>
                      <span className="text-sm font-medium text-[var(--ink)]">{s.name}</span>
                      <span className="text-xs text-[var(--muted)] ml-2">{sourceCount} source{sourceCount !== 1 ? 's' : ''}</span>
                    </div>
                    <button onClick={() => removeSubject(s.id)} className="text-[var(--muted)] transition-colors hover:text-[var(--danger)] text-sm">Remove</button>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)] italic">No subjects yet. Add one above.</p>
          )}
        </section>

        {/* Data Sources */}
        <section className="rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 text-base font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Data Sources</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">Upload content that powers your tutor, quizzes, and assessments</p>

          {/* Source Type Tabs */}
          <div className="mb-4 flex gap-2">
            {[
              { id: 'url', label: 'Article Link', icon: '🔗' },
              { id: 'pdf', label: 'PDF Upload', icon: '📄' },
              { id: 'moodle', label: 'Moodle LMS', icon: '🎓' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setUploadType(t.id)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${uploadType === t.id ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--neutral-10)] text-[var(--muted)] hover:border-[var(--brand)]'}`}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>

          {/* Upload Forms */}
          <div className="mb-4 rounded-xl border border-[var(--neutral-10)] bg-[var(--page)] p-4">
            {uploadType === 'url' && (
              <div className="flex gap-2">
                <input
                  type="url"
                  value={uploadUrl}
                  onChange={(e) => setUploadUrl(e.target.value)}
                  placeholder="https://example.com/article..."
                  className="flex-1 rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] px-4 py-2.5 text-sm"
                />
                <button onClick={handleUpload} disabled={!uploadUrl.trim() || loading} className="brand-btn-primary text-sm px-4">{loading ? '...' : 'Add'}</button>
              </div>
            )}
            {uploadType === 'pdf' && (
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept=".pdf" onChange={(e) => setUploadFile(e.target.files?.[0] || null)} className="hidden" />
                <button onClick={() => fileRef.current?.click()} className="flex-1 cursor-pointer rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] px-4 py-2.5 text-sm text-left">{uploadFile ? uploadFile.name : 'Select PDF file...'}</button>
                <button onClick={handleUpload} disabled={!uploadFile || loading} className="brand-btn-primary text-sm px-4">{loading ? '...' : 'Upload'}</button>
              </div>
            )}
            {uploadType === 'moodle' && (
              <div className="space-y-2">
                <input
                  type="url"
                  value={moodleUrl}
                  onChange={(e) => setMoodleUrl(e.target.value)}
                  placeholder="https://your-moodle-site.com"
                  className="w-full rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] px-4 py-2.5 text-sm"
                />
                <input
                  type="text"
                  value={moodleToken}
                  onChange={(e) => setMoodleToken(e.target.value)}
                  placeholder="Moodle API token"
                  className="w-full rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] px-4 py-2.5 text-sm"
                />
                <button onClick={handleUpload} disabled={!moodleUrl.trim() || loading} className="w-full rounded-xl bg-[var(--primary-orange)] px-4 py-2.5 text-sm font-bold text-white transition-bouncy hover:opacity-90">{loading ? '...' : 'Connect Moodle'}</button>
              </div>
            )}
          </div>

          {/* Uploaded Sources */}
          {sources.length > 0 && (
            <div className="space-y-2">
              <p className="mb-2 text-xs font-medium text-[var(--muted)]">{sources.length} source{sources.length !== 1 ? 's' : ''} added</p>
              {sources.map((src) => (
                <DataSourceCard key={src.id} source={src} onRemove={removeSource} onSubjectChange={assignSubject} subjects={subjects} />
              ))}
            </div>
          )}
        </section>

        {/* Accessibility Suite */}
        <section className="rounded-xl border border-[var(--neutral-10)] bg-[var(--surface)] p-5">
          <h2 className="mb-1 text-base font-bold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>Accessibility Suite</h2>
          <p className="mb-4 text-xs text-[var(--muted)]">Every option applies instantly and is remembered on this device</p>
          <div className="grid sm:grid-cols-2 gap-2">
            {A11Y_OPTIONS.map((opt) => {
              const active = !!toggles[opt.key]
              return (
                <button
                  key={opt.key}
                  onClick={() => toggleAccessibility(opt.key)}
                  aria-pressed={active}
                  className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-bouncy ${active ? 'border-[var(--brand)] bg-[var(--brand-light)]' : 'border-[var(--neutral-10)] hover:border-[var(--brand)]'}`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span className="text-lg shrink-0" aria-hidden="true">{opt.icon}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--ink)]">{opt.label}</span>
                      <span className="block text-[11px] text-[var(--muted)] truncate">{opt.desc}</span>
                    </span>
                  </span>
                  <span className={`shrink-0 inline-flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${active ? 'bg-[var(--brand)]' : 'bg-[var(--neutral-20)]'}`}>
                    <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${active ? 'translate-x-4' : ''}`} />
                  </span>
                </button>
              )
            })}
          </div>
          {toggles.whiteNoise && (
            <p className="mt-3 rounded-xl bg-[var(--success)]/5 px-3 py-2 text-[11px] font-semibold text-[var(--success)]">
              🎧 White noise is on — use the round control at the bottom-left to pick rain, coffee shop or waves.
            </p>
          )}
        </section>

        {/* Save */}
        <div className="flex items-center gap-3 pb-8">
          <button onClick={handleSave} className="brand-btn-primary px-8">{saved ? 'Saved!' : 'Save Settings'}</button>
          {saved && <span className="text-sm font-medium text-[var(--success)]">Settings saved successfully</span>}
        </div>
      </div>
    </div>
  )
}
