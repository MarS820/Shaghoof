import { useState, useRef, useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import api from '../services/api'
import Mascot from '../components/Mascot'
import PulseNudge from '../components/PulseNudge'
import VideoLessonPlayer from '../components/VideoLessonPlayer'
import WordwallGame from '../components/WordwallGame'
import WordwallEmbed, { WordwallSuggestion } from '../components/WordwallEmbed'
import VisualLessonRenderer from '../components/lessonRenderers/VisualLessonRenderer'
import AudioLessonRenderer from '../components/lessonRenderers/AudioLessonRenderer'
import ReadWriteLessonRenderer from '../components/lessonRenderers/ReadWriteLessonRenderer'
import KinestheticLessonRenderer from '../components/lessonRenderers/KinestheticLessonRenderer'
import AACBoardModal from '../components/accessibility/AACBoardModal'
import VisualScheduleModal from '../components/accessibility/VisualScheduleModal'
import BrailleReadyView from '../components/accessibility/BrailleReadyView'
import { resolveLearningTemplate } from '../utils/learningTemplate'
import { speak, stopSpeaking } from '../services/speech'
import { isVoiceInputSupported, startVoiceInput } from '../utils/voiceInput'
import ChatMessage from '../components/ChatMessage'

const MODALITIES = [
  { id: 'visual', icon: '👁️', en: 'Visual', ar: 'بصري', xp: 10 },
  { id: 'auditory', icon: '🎧', en: 'Audio', ar: 'صوتي', xp: 10 },
  { id: 'reading', icon: '📖', en: 'Read', ar: 'قراءة', xp: 10 },
  { id: 'kinesthetic', icon: '🖐️', en: 'Interactive', ar: 'تفاعلي', xp: 10 },
]

const XP_BADGE = '+10 XP'

export default function LessonTutor() {
  const { user, lang, toggles, setToggles, awardXp } = useApp()
  const [searchParams] = useSearchParams()
  const arabic = lang === 'ar'
  const subjects = user?.subjects || []
  const sources = user?.dataSources || []
  const hasData = subjects.length > 0 || sources.length > 0

  const [selectedSubject, setSelectedSubject] = useState(() => searchParams.get('subject') || '')
  const [feynmanLevel, setFeynmanLevel] = useState('academic')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatEnd = useRef(null)
  const [activityTrigger, setActivityTrigger] = useState(0)

  const [lessons, setLessons] = useState([])
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [lessonDetail, setLessonDetail] = useState(null)
  const [wordwallPack, setWordwallPack] = useState(null)
  const [wordwallEmbeds, setWordwallEmbeds] = useState([])
  const [wordwallSuggestions, setWordwallSuggestions] = useState([])
  const [modality, setModality] = useState('visual')
  const [visitedModalities, setVisitedModalities] = useState(new Set())
  const [generating, setGenerating] = useState(null)
  const [speakingId, setSpeakingId] = useState(null)
  const [bilingual, setBilingual] = useState(false)
  const [translations, setTranslations] = useState({})
  const [listening, setListening] = useState(false)
  const [interimText, setInterimText] = useState('')
  const [videoOpen, setVideoOpen] = useState(false)
  const [aacOpen, setAacOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [brailleOpen, setBrailleOpen] = useState(false)
  const stopVoice = useRef(null)

  // Video lessons suit narrated, scene-based templates (T2 Podcast, T3
  // Storyboard, T5 Explorer, T6 Routine). Hands-on (T1) and interactive
  // reading (T4) templates stay interactive-first by design.
  const template = user && user.role !== 'teacher' ? resolveLearningTemplate(user) : null
  const videoSuitable = ['T2', 'T3', 'T5', 'T6'].includes(template?.id)

  // Each template opens its signature VARK modality by default:
  // T1 Sandbox→hands-on · T2 Podcast→audio · T3/T5→visual · T4 Translator/T6 Routine→reading
  const TEMPLATE_DEFAULT_MODALITY = { T1: 'kinesthetic', T2: 'auditory', T3: 'visual', T4: 'reading', T5: 'visual', T6: 'reading' }

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    loadLessons()
    return () => stopSpeaking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadLessons = async () => {
    try {
      const res = await api.listLessons(user.id)
      setLessons(res.lessons || [])
    } catch {
      setLessons([])
    }
  }

  const filteredSources = selectedSubject
    ? sources.filter((s) => s.subject === selectedSubject)
    : sources

  const filteredLessons = selectedSubject
    ? lessons.filter((l) => l.subject === selectedSubject)
    : lessons
  const courseIdFor = (source) => subjects.find((subject) => subject.name === source.subject)?.id || source.subject || ''

  // detailOrNull: when the caller already holds the lesson payload (e.g. the
  // generate response), pass it here — a refetch round-trip is then skipped
  // entirely, which removes the race that could strand the UI on the list.
  const openLesson = async (sessionId, detailOrNull = null) => {
    setSelectedLesson(sessionId)
    const defaultModality = TEMPLATE_DEFAULT_MODALITY[template?.id] || 'visual'
    setVisitedModalities(new Set([defaultModality]))
    setModality(defaultModality)
    try {
      const detail = detailOrNull || await api.getLesson(sessionId, user.id)
      setLessonDetail(detail)
      setWordwallPack(detail.wordwall || null)
      
      // Load Wordwall embed activities if available
      const wordwallSection = detail.presentation?.wordwall
      if (wordwallSection?.activities) {
        setWordwallEmbeds(wordwallSection.activities.filter(a => a.status === 'pending_embed'))
      } else {
        setWordwallEmbeds([])
      }
      
      // Load Wordwall suggestions if available
      if (detail.wordwall?.embed_suggestions) {
        setWordwallSuggestions(detail.wordwall.embed_suggestions)
      } else {
        setWordwallSuggestions([])
      }
      
      setMessages([{ role: 'tutor', content: arabic
        ? `أهلاً يا بطل! أنا معاك في درس "${detail.title}". اسألني أي حاجة خلال الدرس 💬`
        : `Hi! We're in "${detail.title}" together. Ask me anything during the lesson 💬` }])
      // Older lessons predate the embedded pack — fetch it for the current template.
      if (!detail.wordwall) {
        api.getWordwallPack(sessionId, user.id)
          .then((pack) => setWordwallPack(pack))
          .catch(() => setWordwallPack(null))
      }
    } catch {
      setLessonDetail(null)
      setWordwallPack(null)
      setWordwallEmbeds([])
      setWordwallSuggestions([])
    }
  }

  // ── Lesson generation from any source, inline ──
  const generateLesson = async (source) => {
    setGenerating(source.id)
    try {
      let result
      if (source.type === 'url' && source.url) {
        result = await api.generateLessonFromUrl({ url: source.url, topic: source.name, subject: source.subject || '', source_id: source.id, course_id: courseIdFor(source), user_id: user.id })
      } else if (source.type === 'pdf' && source.sessionId) {
        result = await api.generateLessonFromPdfSession({ pdf_session_id: source.sessionId, filename: source.name, subject: source.subject || '', source_id: source.id, course_id: courseIdFor(source), user_id: user.id })
      } else if (source.type === 'pdf' && source.file) {
        const fd = new FormData()
        fd.append('file', source.file)
        fd.append('subject', source.subject || '')
        fd.append('source_id', source.id)
        fd.append('course_id', courseIdFor(source))
        fd.append('user_id', user.id)
        result = await api.generateLessonFromPdf(fd)
      } else if (source.type === 'moodle') {
        result = await api.generateLessonFromMoodle({ course_name: source.name, files: [], subject: source.subject || '', source_id: source.id, course_id: courseIdFor(source), user_id: user.id })
      } else if (source.type === 'text' && source.content) {
        result = await api.generateLessonFromText({ text: source.content, title: source.name, subject: source.subject || '', source_id: source.id, course_id: courseIdFor(source), user_id: user.id })
      }
      if (result && result.session_id) {
        // Open straight from the generate response — no list refresh, no
        // second fetch, no race. The list refresh happens in the background.
        openLesson(result.session_id, result)
        loadLessons().catch(() => {})
        awardXp(15, arabic ? 'درس جديد' : 'New lesson')
        if (result.ai_generated === false) {
          setMessages((prev) => [...prev, { role: 'tutor', content: arabic
            ? '⚠️ تم إنشاء هذا الدرس كمسودة منظمة لأن خدمة الذكاء الاصطناعي لم تكن متاحة. اضغط "إعادة التوليد" للحصول على النسخة الذكية.'
            : '⚠️ This lesson was saved as a structured draft because the AI service was unavailable. Press "Regenerate" to get the AI version.' }])
        }
      } else {
        setMessages((prev) => [...prev, { role: 'tutor', content: arabic
          ? '⚠️ تعذر إنشاء الدرس. تأكد من تشغيل الخادم ثم أعد المحاولة.'
          : '⚠️ Could not generate the lesson. Make sure the server is running and try again.' }])
      }
    } catch (e) {
      console.error('Lesson generation failed:', e)
      setMessages((prev) => [...prev, { role: 'tutor', content: arabic
        ? `⚠️ فشل إنشاء الدرس: ${String(e?.message || e).slice(0, 120)}`
        : `⚠️ Lesson generation failed: ${String(e?.message || e).slice(0, 120)}` }])
    } finally {
      setGenerating(null)
    }
  }

  // ── Modality switching with Explorer XP ──
  const switchModality = (id) => {
    setModality(id)
    // Compute freshness from current state, NOT inside the updater —
    // setState updaters must be pure (calling awardXp there triggers
    // "setState during render" and double-fires in StrictMode).
    if (!visitedModalities.has(id)) {
      setVisitedModalities((prev) => new Set(prev).add(id))
      awardXp(MODALITIES.find((m) => m.id === id)?.xp || 10, arabic ? 'استكشاف' : 'Explorer')
    }
  }

  // ── TTS on any text block ──
  const toggleSpeak = (text, id) => {
    if (speakingId === id) {
      stopSpeaking()
      setSpeakingId(null)
      return
    }
    setSpeakingId(id)
    speak(text, { lang, rate: 0.9, onEnd: () => setSpeakingId(null) })
  }

  // ── Bilingual toggle: translate a text block via backend ──
  const getTranslation = async (text, key) => {
    const cacheKey = `${key}:${text.slice(0, 64)}`
    if (translations[cacheKey]) return translations[cacheKey]
    try {
      const res = await api.translateText(text, arabic ? 'en' : 'ar')
      const out = res?.translated || res?.text || ''
      setTranslations((prev) => ({ ...prev, [cacheKey]: out }))
      return out
    } catch {
      return ''
    }
  }

  // ── Add custom Wordwall URL to lesson ──
  const [customWordwallUrl, setCustomWordwallUrl] = useState('')
  const [addingWordwall, setAddingWordwall] = useState(false)
  
  const addCustomWordwallUrl = async () => {
    if (!customWordwallUrl.trim() || !selectedLesson) return
    
    setAddingWordwall(true)
    try {
      // Validate the URL first
      const validation = await api.validateWordwallUrl(customWordwallUrl.trim())
      if (!validation.valid) {
        alert(arabic ? 'رابط Wordwall غير صالح' : 'Invalid Wordwall URL')
        return
      }
      
      // Add to lesson
      await api.addWordwallToLesson({
        session_id: selectedLesson,
        user_id: user.id,
        wordwall_urls: [customWordwallUrl.trim()],
        template_id: lessonDetail?.template_id,
      })
      
      // Add to local state
      setWordwallEmbeds(prev => [...prev, {
        url: customWordwallUrl.trim(),
        url_type: validation.url_type,
        resource_id: validation.resource_id,
        status: 'pending_embed',
      }])
      
      setCustomWordwallUrl('')
      awardXp(5, arabic ? 'إضافة نشاط Wordwall' : 'Add Wordwall Activity')
    } catch (err) {
      console.error('Failed to add Wordwall URL:', err)
      alert(arabic ? 'فشل إضافة النشاط' : 'Failed to add activity')
    } finally {
      setAddingWordwall(false)
    }
  }

  // ── Tutor chat (RAG-backed, lesson-aware) ──
  const sendChat = async (message) => {
    const text = message || input.trim()
    if (!text || loading) return
    setActivityTrigger((v) => v + 1)
    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInput('')
    setLoading(true)

    // Detect diagram requests and append mermaid instructions
    const wantsDiagram = /flowchart|diagram|chart|mind.?map|مخطط|تدفقي|خريطة/i.test(text)
    const diagramInstruction = wantsDiagram
      ? '\n\n[SYSTEM: When creating diagrams, use Mermaid syntax. Wrap all diagram code in ```mermaid code blocks. Use flowchart TD or flowchart LR for flowcharts, and mindmap for mind maps. Keep labels concise. Add a brief text explanation before and after the diagram.]'
      : ''
    const enhancedText = text + diagramInstruction

    try {
      // Strict lesson grounding: the tutor answers ONLY from the open lesson's
      // material — the backend blocks off-lesson answers when session_id is set.
      const res = await api.tutorChatRag({
        message: enhancedText,
        modality: user?.vark?.dominant || modality,
        feynman_level: feynmanLevel,
        username: user.id,
        language: lang,
        egyptian_dialect: arabic,
        session_id: selectedLesson || undefined,
        lesson_title: lessonDetail?.title || undefined,
        source_id: lessonDetail?.source_id || undefined,
        course_id: lessonDetail?.course_id || undefined,
        strict_lesson: !!selectedLesson,
      })
      setMessages((prev) => [...prev, { role: 'tutor', content: res.text || (arabic ? 'لا يوجد رد.' : 'No response.') }])
      // Accessibility suite: voiceReader auto-reads every tutor reply aloud.
      const replyText = res.text
      if (replyText && toggles.voiceReader) {
        speak(replyText, { lang, rate: 0.9 })
      }
      awardXp(5, arabic ? 'سؤال' : 'Ask')
    } catch {
      setMessages((prev) => [...prev, { role: 'tutor', content: arabic
        ? 'عذراً يا بطل، مش عارف أكمل دلوقتي. تأكد إن الخادم شغال ومفاتيح الـ API موجودة.'
        : 'Sorry, I could not process that. Please check the server and API keys.' }])
    } finally { setLoading(false) }
  }

  const quickActions = [
    { icon: '💡', label: arabic ? 'معلومة سريعة' : 'Explain simply', msg: arabic ? 'بص يا بطل، اشرحلي الفكرة الأساسية من الدرس ده ببساطة' : 'Explain the key concept from the current lesson in simple terms' },
    { icon: '🪜', label: arabic ? 'تلميح' : 'Give me a hint', msg: arabic ? 'هات تلميح ميسر يا بطل من غير ما تقولي الإجابة' : "Give me a hint (don't give the answer)" },
    { icon: '🔄', label: arabic ? 'اشرح بطريقة تانية' : 'Explain differently', msg: arabic ? 'اشرحلي كده بطريقة تانية أو بمثال مختلف' : 'Explain that differently or with an example' },
    { icon: '🌍', label: arabic ? 'مثال واقعي' : 'Real-world example', msg: arabic ? 'dalini مثال من الحياة الواقعية يوضحلي الموضوع' : 'Give me a real-world example' },
    { icon: '📊', label: arabic ? 'رسم تدفقي' : 'Flowchart', msg: arabic ? 'ارسملي مخطط تدفقي (flowchart) يوضح خطوات العملية الرئيسية في الدرس ده باستخدام Mermaid. اكتب الكود جوه ```mermaid```' : 'Create a flowchart diagram for the main process in this lesson using Mermaid syntax. Wrap the code in ```mermaid``` code blocks' },
    { icon: '🧠', label: arabic ? 'خريطة ذهنية' : 'Mind map', msg: arabic ? 'ارسملي خريطة ذهنية (mind map) للدرس ده توضح العناصر الرئيسية والعلاقات بينها باستخدام Mermaid. اكتب الكود جوه ```mermaid```' : 'Create a mind map for this lesson showing key concepts and their relationships using Mermaid syntax. Wrap the code in ```mermaid``` code blocks' },
  ]

  const voiceSupported = isVoiceInputSupported()

  const startListening = () => {
    stopVoice.current?.()
    setListening(true)
    setInterimText('')
    stopVoice.current = startVoiceInput({
      lang,
      onInterim: (text) => setInterimText(text),
      onText: (text) => {
        setInput((prev) => {
          const merged = prev ? `${prev} ${text}` : text
          return merged
        })
        setInterimText('')
        setListening(false)
      },
      onError: () => { setListening(false); setInterimText('') },
    })
  }

  const stopListening = () => {
    stopVoice.current?.()
    setListening(false)
    setInterimText('')
  }

  // ── Modality content renderers — ported VARK renderers on real lesson data ──
  const modalityViews = lessonDetail ? {
    visual: <VisualLessonRenderer lesson={lessonDetail} arabic={arabic} onAskTutor={(msg) => sendChat(msg)} onXp={awardXp} />,
    auditory: <AudioLessonRenderer lesson={lessonDetail} arabic={arabic} lang={lang} onXp={awardXp} />,
    reading: <ReadWriteLessonRenderer lesson={lessonDetail} arabic={arabic} lang={lang} toggles={toggles} bilingual={bilingual} getTranslation={getTranslation} onXp={awardXp} />,
    kinesthetic: <KinestheticLessonRenderer lesson={lessonDetail} arabic={arabic} onAskTutor={(msg) => sendChat(msg)} onXp={awardXp} />,
  } : {}



  // ── Chat panel (shared across both layouts) ──
  const chatPanel = (
    <div className="bubble-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--line)] p-3" style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--energy-violet) 8%, transparent), color-mix(in srgb, var(--energy-pink) 5%, transparent))' }}>
        <div className="flex items-center gap-2">
          <Mascot size={26} animate mood={loading ? 'thinking' : 'happy'} />
          <div>
            <h2 className="text-sm font-extrabold" style={{ color: 'var(--energy-violet)' }}>{arabic ? 'المعلّم الذكي' : '🧠 AI Tutor'}</h2>
            <div className="flex items-center gap-1">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: 'var(--energy-mint)' }} />
              <span className="text-[10px] font-semibold text-[var(--muted)]">{arabic ? 'متصل' : 'Online'}</span>
              {arabic && (
                <span className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold" style={{ background: 'color-mix(in srgb, var(--energy-orange) 15%, transparent)', color: 'var(--energy-orange)' }}>🇪🇬 عامية</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {toggles.zenMode && (
            <button
              type="button"
              onClick={() => setToggles((previous) => ({ ...previous, zenMode: false }))}
              className="rounded-full border px-2.5 py-1 text-[10px] font-extrabold transition-bouncy hover:scale-105 dark:text-orange-200"
              style={{ borderColor: 'var(--energy-orange)', background: 'color-mix(in srgb, var(--energy-orange) 10%, transparent)', color: 'var(--energy-orange)' }}
              title={arabic ? 'إنهاء وضع التركيز' : 'Exit Zen mode'}
            >
              ← {arabic ? 'إنهاء التركيز' : 'Exit Zen'}
            </button>
          )}
          {[{ id: 'intuitive', label: arabic ? 'بسيط' : 'Simple' }, { id: 'academic', label: arabic ? 'أكاديمي' : 'Academic' }, { id: 'deep', label: arabic ? 'متعمق' : 'Deep' }].map((d) => (
            <button key={d.id} onClick={() => setFeynmanLevel(d.id)} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${feynmanLevel === d.id ? 'text-white' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} style={feynmanLevel === d.id ? { background: 'linear-gradient(135deg, var(--energy-violet), var(--energy-pink))', borderColor: 'var(--energy-violet)' } : {}}>{d.label}</button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="animate-bubble-in flex flex-col items-center py-8 text-center">
            <Mascot size={56} animate mood="happy" className="mb-3 animate-bobble" />
            <p className="max-w-xs text-sm font-bold text-[var(--ink)]">{user?.name ? `Hi ${user.name.split(' ')[0]}! ` : ''}{arabic ? 'اختار درس من القائمة أو اسألني أي حاجة بالعامية المصرية 💬' : 'Pick a lesson from the panel — or ask me anything right now 💬'}</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <ChatMessage key={i} msg={msg} index={i} onSpeak={toggleSpeak} speakingId={speakingId} />
        ))}
        {loading && (
          <div className="flex gap-2">
            <Mascot size={22} animate mood="thinking" />
            <div className="chat-bubble-bot !max-w-none py-1"><div className="loading-dots"><span /><span /><span /></div></div>
          </div>
        )}
        <div ref={chatEnd} />
      </div>

      <div className="relative border-t border-[var(--line)] p-3">
        <PulseNudge trigger={activityTrigger} watching={!!selectedLesson && hasData} onNudgeClick={() => sendChat(quickActions[0].msg)} />
        <div className="mb-2 flex gap-1.5 overflow-x-auto pb-0.5">
          {quickActions.map((a, i) => (
            <button key={i} onClick={() => sendChat(a.msg)} className="whitespace-nowrap rounded-full border border-[var(--line)] px-2.5 py-1 text-[10px] font-bold text-[var(--muted)] transition-bouncy hover:border-[var(--brand)] hover:text-[var(--brand)] press-bubble">{a.icon} {a.label}</button>
          ))}
        </div>
        <div className="flex gap-2">
          {voiceSupported && (
            <button
              type="button"
              onClick={listening ? stopListening : startListening}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-lg transition-bouncy ${listening ? 'animate-pulse-ring border-[var(--danger)] bg-red-50 text-[var(--danger)]' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)] hover:text-[var(--brand)]'}`}
              title={arabic ? 'إدخال صوتي' : 'Voice input'}
              aria-pressed={listening}
            >
              {listening ? '⏹' : '🎙️'}
            </button>
          )}
          <input
            type="text"
            value={listening && interimText ? interimText : input}
            onChange={(e) => { setInput(e.target.value); setActivityTrigger((v) => v + 1) }}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
            placeholder={listening ? (arabic ? 'جاري الاستماع...' : 'Listening...') : (arabic ? 'اسأل المساعد بالمصري أو اطلب تبسيطاً...' : 'Ask anything about this lesson...')}
            className={`flex-1 brand-input text-sm ${listening ? 'border-[var(--brand)] ring-2 ring-[var(--brand)]/20' : ''}`}
            readOnly={listening && !!interimText}
          />
          <button onClick={() => sendChat()} disabled={!input.trim() || loading} className="brand-btn-primary px-4 text-sm">{arabic ? 'إرسال' : 'Send'}</button>
        </div>
      </div>
    </div>
  )

  // ── Lesson panel (shared) ──
  const lessonPanel = (
    <div className="bubble-card flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-[var(--line)] p-3">
        {selectedLesson ? (
          <div className="flex items-center justify-between gap-2">
            <button onClick={() => { setSelectedLesson(null); setLessonDetail(null); stopSpeaking() }} className="rounded-full bg-[var(--brand-light)] px-2.5 py-1 text-xs font-bold text-[var(--brand)] transition-bouncy hover:scale-105">← {arabic ? 'العودة' : 'Back'}</button>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setScheduleOpen(true)} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${template?.accessibilityProfile === 'structure' ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} title={arabic ? 'الجدول البصري للدرس' : 'Lesson visual schedule'}>🗓️</button>
              <button onClick={() => setAacOpen(true)} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} title={arabic ? 'لوحة الرموز' : 'AAC symbol board'}>💬</button>
              <button onClick={() => setBrailleOpen(true)} className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] font-bold text-[var(--muted)] transition-bouncy hover:border-[var(--brand)]" title={arabic ? 'عرض برايل' : 'Braille-ready view'}>⠿</button>
              <button onClick={() => setToggles((p) => ({ ...p, zenMode: !p.zenMode }))} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${toggles.zenMode ? 'border-purple-400 bg-purple-50 text-purple-700' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} title="Zen Mode">🧘</button>
              <button onClick={() => setBilingual((v) => !v)} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${bilingual ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} title="Bilingual toggle">🌍</button>
              <button onClick={() => setToggles((p) => ({ ...p, lineFocus: !p.lineFocus }))} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${toggles.lineFocus ? 'border-amber-400 bg-amber-50 text-amber-700' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} title="Line focus (dyslexia ruler)">📏</button>
              <button onClick={() => setToggles((p) => ({ ...p, dyslexicFont: !p.dyslexicFont }))} className={`rounded-full border px-2 py-1 text-[10px] font-bold transition-bouncy ${toggles.dyslexicFont ? 'border-sky-400 bg-sky-50 text-sky-700' : 'border-[var(--line)] text-[var(--muted)] hover:border-[var(--brand)]'}`} title="OpenDyslexic font">🔤</button>
            </div>
          </div>
        ) : (
          <h2 className="text-sm font-extrabold text-[var(--ink)]">📚 {arabic ? 'اختر درساً أو أنشئ واحداً' : 'Pick a lesson or create one'}</h2>
        )}
      </div>

      {!selectedLesson || !lessonDetail ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
          {subjects.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setSelectedSubject('')} className={`rounded-full border px-2.5 py-1 text-xs font-bold transition-bouncy ${!selectedSubject ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{arabic ? 'الكل' : 'All'}</button>
              {subjects.map((s) => (
                <button key={s.id} onClick={() => setSelectedSubject(s.name)} className={`rounded-full border px-2.5 py-1 text-xs font-bold transition-bouncy ${selectedSubject === s.name ? 'border-[var(--brand)] bg-[var(--brand-light)] text-[var(--brand)]' : 'border-[var(--line)] text-[var(--muted)]'}`}>{s.name}</button>
              ))}
            </div>
          )}

          {filteredLessons.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{arabic ? 'دروسي' : 'My lessons'}</p>
              <div className="space-y-1.5">
                {filteredLessons.map((lesson) => (
                  <button key={lesson.session_id} onClick={() => openLesson(lesson.session_id)} className="w-full rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5 text-left transition-bouncy hover:-translate-y-0.5 hover:border-[var(--brand)] hover:shadow-md">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{{ pdf: '📄', url: '🔗', moodle: '🎓', text: '✏️' }[lesson.source_type] || '📚'}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-bold text-[var(--ink)]">{lesson.title}</p>
                        <p className="text-[10px] text-[var(--muted)]">{lesson.source_type}{lesson.word_count ? ` · ${lesson.word_count}w` : ''}</p>
                      </div>
                      <span className="text-[var(--brand)]">→</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredSources.length > 0 && (
            <div>
              <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-wide text-[var(--muted)]">{arabic ? 'أنشئ درساً من مصدر' : 'Generate a lesson from a source'}</p>
              <div className="space-y-1.5">
                {filteredSources.map((src) => {
                  const isGenerating = generating === src.id
                  return (
                    <button key={src.id} onClick={() => generateLesson(src)} disabled={isGenerating} className={`w-full rounded-2xl border border-dashed p-2.5 text-left transition-bouncy ${isGenerating ? 'shimmer border-[var(--brand)]' : 'border-[var(--line)] hover:border-[var(--brand)] hover:bg-[var(--brand-light)]'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{{ pdf: '📄', url: '🔗', moodle: '🎓', text: '✏️' }[src.type] || '📎'}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-[var(--ink)]">{src.name}</p>
                          <p className="text-[10px] text-[var(--muted)]">{src.type.toUpperCase()}{src.subject ? ` · ${src.subject}` : ''}</p>
                        </div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-extrabold ${isGenerating ? 'bg-[var(--brand)] text-white' : 'bg-[var(--brand-light)] text-[var(--brand)]'}`}>
                          {isGenerating ? (arabic ? 'جارٍ...' : '...') : (arabic ? 'إنشاء' : 'Generate')}
                        </span>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {filteredLessons.length === 0 && filteredSources.length === 0 && (
            <div className="py-10 text-center">
              <Mascot size={56} animate mood="waving" className="mx-auto mb-3" />
              <p className="mb-3 text-xs text-[var(--muted)]">{sources.length === 0 ? (arabic ? 'لا توجد مصادر بعد.' : 'No sources yet.') : (arabic ? 'لا مصادر لهذا الموضوع.' : 'No sources for this subject.')}</p>
              <Link to="/settings" className="brand-btn-primary text-xs">{arabic ? 'أضف من الإعدادات' : 'Add in Settings'}</Link>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Modality tabs — master plan: Modality Switching Tabs */}
          <div className="border-b border-[var(--line)] px-3 pt-2">
            <div className="flex items-center justify-between gap-2 pb-1.5">
              <div className="flex min-w-0 items-center gap-1.5">
                <h3 className="truncate text-sm font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{lessonDetail.title}</h3>
                {lessonDetail.ai_generated === false && (
                  <button
                    onClick={() => {
                      const src = sources.find((s) => s.id === lessonDetail.source_id)
                      if (src) generateLesson(src)
                      else setMessages((prev) => [...prev, { role: 'tutor', content: arabic ? '⚠️ لم أجد المصدر الأصلي لإعادة التوليد.' : '⚠️ Original source not found for regeneration.' }])
                    }}
                    disabled={!!generating}
                    title={arabic ? 'هذه مسودة — أعد التوليد بالذكاء الاصطناعي' : 'This is a draft — regenerate with AI'}
                    className="shrink-0 rounded-full border border-amber-400 bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold text-amber-700 transition-bouncy hover:scale-105 disabled:opacity-50 dark:bg-amber-950/40 dark:text-amber-300"
                  >
                    {generating ? (arabic ? 'جارٍ...' : '...') : (arabic ? '✎ مسودة — إعادة' : '✎ Draft — Regenerate')}
                  </button>
                )}
              </div>
              {videoSuitable && (
                <button onClick={() => setVideoOpen((v) => !v)} className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold transition-bouncy press-bubble ${videoOpen ? 'border-pink-400 bg-pink-50 text-pink-600' : 'border-[var(--line)] text-[var(--muted)] hover:border-pink-400 hover:text-pink-500'}`}>
                  🎬 {arabic ? 'فيديو' : 'Video'}
                </button>
              )}
            </div>
            <div className="flex gap-1 overflow-x-auto pb-2">
              {MODALITIES.map((m) => {
                const active = modality === m.id
                const visited = visitedModalities.has(m.id)
                return (
                  <button
                    key={m.id}
                    onClick={() => switchModality(m.id)}
                    className={`relative flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition-bouncy press-bubble ${active ? 'bg-[var(--brand)] text-white shadow-md' : visited ? 'border border-[var(--line)] text-[var(--muted)]' : 'border border-dashed border-[var(--accent-yellow)] text-amber-600'}`}
                  >
                    <span aria-hidden="true">{m.icon}</span> {arabic ? m.ar : m.en}
                    {!visited && <span className="absolute -top-1.5 -end-1 rounded-full bg-[var(--accent-yellow)] px-1 text-[8px] font-extrabold text-amber-900">{XP_BADGE}</span>}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {videoOpen && videoSuitable && (
              <div className="mb-4">
                <VideoLessonPlayer
                  lesson={{
                    session_id: selectedLesson,
                    user_id: user.id,
                    vark_mode: user?.vark?.dominant || modality,
                    sen_profile: template?.accessibilityProfile || 'general',
                  }}
                  onXp={(amount, label) => awardXp(amount, label)}
                />
              </div>
            )}
            {modalityViews[modality]}
            {/* Template-exclusive Wordwall game — built only from this lesson. */}
            {wordwallPack && (
              <WordwallGame pack={wordwallPack} arabic={arabic} onXp={(amount, label) => awardXp(amount, label)} />
            )}
            
            {/* Embedded Wordwall activities from URLs */}
            {wordwallEmbeds.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-extrabold text-[var(--ink)]">
                  {arabic ? 'أنشطة Wordwall المضمنة' : 'Embedded Wordwall Activities'}
                </h3>
                {wordwallEmbeds.map((activity, index) => (
                  <WordwallEmbed
                    key={index}
                    url={activity.url}
                    templateId={lessonDetail?.template_id || 'T3'}
                    arabic={arabic}
                    onXp={(amount, label) => awardXp(amount, label)}
                  />
                ))}
              </div>
            )}
            
            {/* Wordwall activity suggestions */}
            {wordwallSuggestions.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 text-xs font-extrabold text-[var(--ink)]">
                  {arabic ? 'أنشطة مقترحة' : 'Suggested Activities'}
                </h3>
                <div className="space-y-2">
                  {wordwallSuggestions.map((suggestion, index) => (
                    <WordwallSuggestion
                      key={index}
                      suggestion={suggestion}
                      arabic={arabic}
                    />
                  ))}
                </div>
              </div>
            )}
            
            {/* Add custom Wordwall URL */}
            <div className="mt-4 rounded-2xl border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/50">
              <h3 className="mb-2 text-xs font-extrabold text-[var(--ink)]">
                {arabic ? 'إضافة نشاط Wordwall مخصص' : 'Add Custom Wordwall Activity'}
              </h3>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={customWordwallUrl}
                  onChange={(e) => setCustomWordwallUrl(e.target.value)}
                  placeholder={arabic ? 'الصق رابط Wordwall هنا...' : 'Paste Wordwall URL here...'}
                  className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={addCustomWordwallUrl}
                  disabled={!customWordwallUrl.trim() || addingWordwall}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingWordwall ? (arabic ? 'جاري الإضافة...' : 'Adding...') : (arabic ? 'إضافة' : 'Add')}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                {arabic ? 'يدعم روابط wordwall.net/resource/* و wordwall.net/play/*' : 'Supports wordwall.net/resource/* and wordwall.net/play/* URLs'}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )

  // ── Empty state (no data at all) ──
  if (!hasData) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center">
        <Mascot size={72} animate mood="waving" className="mx-auto mb-4 animate-bobble" />
        <h1 className="text-xl font-extrabold text-[var(--ink)]" style={{ fontFamily: 'var(--font-heading)' }}>{arabic ? 'ابدأ رحلة التعلم' : 'Start your learning journey'}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--muted)]">{arabic ? 'أضف موضوعات ومصادر في الإعدادات لتبدأ الدروس مع المعلّم الذكي.' : 'Add subjects and data sources in Settings to unlock lessons with your AI tutor.'}</p>
        <Link to="/settings" className="brand-btn-primary mt-5">{arabic ? 'اذهب للإعدادات' : 'Go to Settings'}</Link>
      </div>
    )
  }

  return (
    <div className="lessons-bg mx-auto max-w-[100rem] px-4 py-4 sm:px-6">
      {/* SEN accessibility modals (ported from SHAGHOOF-AI-main) */}
      <AACBoardModal open={aacOpen} onClose={() => setAacOpen(false)} arabic={arabic} onSend={(msg) => { setAacOpen(false); sendChat(msg) }} />
      <VisualScheduleModal open={scheduleOpen} onClose={() => setScheduleOpen(false)} arabic={arabic} lesson={lessonDetail} currentSection={1} />
      {brailleOpen && lessonDetail && (
        <BrailleReadyView lesson={lessonDetail} arabic={arabic} lang={lang} onClose={() => setBrailleOpen(false)} />
      )}
      <div className="grid h-[calc(100vh-8.5rem)] min-h-[28rem] gap-4 lg:grid-cols-[3fr_2fr]">
        {/* Lesson content — left */}
        <div className={`min-h-0 ${toggles.zenMode ? 'hidden' : ''}`}>{lessonPanel}</div>
        {/* Tutor chat — right, always visible during the lesson */}
        <div className={`min-h-0 ${toggles.zenMode ? 'lg:col-span-2' : ''}`}>{chatPanel}</div>
      </div>
    </div>
  )
}

// ── Small inline helpers ──

