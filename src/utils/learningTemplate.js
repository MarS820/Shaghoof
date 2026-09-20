const TEXT_FLAGS = new Set(['dyslexia', 'dyslexic', 'esl', 'cognitive'])
const FOCUS_FLAGS = new Set(['adhd', 'semh', 'focus', 'emotional'])
const STRUCTURE_FLAGS = new Set(['asd', 'autism', 'slcn', 'speech', 'language'])

export const TEMPLATES = {
  T1: {
    id: 'T1', name: 'The Sandbox', mode: 'kinesthetic', profile: 'focus', quizFormat: 'sandbox',
    icon: '✋', visualAid: false, prominentAudio: false, structured: false, textSupport: false,
    en: 'Short hands-on quests. One action, then feedback.',
    ar: 'مهام قصيرة عملية. خطوة واحدة ثم ملاحظات.',
  },
  T2: {
    id: 'T2', name: 'The Podcast', mode: 'auditory', profile: 'text', quizFormat: 'podcast',
    icon: '🔊', visualAid: false, prominentAudio: true, structured: false, textSupport: true,
    en: 'Listen first, then use a clear transcript at your pace.',
    ar: 'استمع أولاً، ثم راجع النص الواضح بالسرعة التي تناسبك.',
  },
  T3: {
    id: 'T3', name: 'The Storyboard', mode: 'visual', profile: 'structure', quizFormat: 'storyboard',
    icon: '▣', visualAid: true, prominentAudio: false, structured: true, textSupport: false,
    en: 'The same sequence every time: scene, question, answer.',
    ar: 'التسلسل نفسه كل مرة: مشهد، سؤال، إجابة.',
  },
  T4: {
    id: 'T4', name: 'The Translator', mode: 'reading', profile: 'text', quizFormat: 'translator',
    icon: 'Aa', visualAid: false, prominentAudio: false, structured: false, textSupport: true,
    en: 'Split reading supports, glossary, and simplified wording.',
    ar: 'دعم قراءة مقسوم، مسرد، وصياغة مبسطة.',
  },
  T5: {
    id: 'T5', name: 'The Explorer', mode: 'visual', profile: 'text', quizFormat: 'explorer',
    icon: '⌁', visualAid: true, prominentAudio: true, structured: false, textSupport: true,
    en: 'Diagrams plus concise bullets, with speech on every line.',
    ar: 'رسوم مع نقاط مختصرة، والصوت على كل سطر.',
  },
  T6: {
    id: 'T6', name: 'The Routine', mode: 'reading', profile: 'structure', quizFormat: 'routine',
    icon: '☰', visualAid: true, prominentAudio: true, structured: true, textSupport: false,
    en: 'A calm timeline, concrete language, limited sensory load.',
    ar: 'جدول زمني هادئ، لغة مباشرة، وحمل حسي محدود.',
  },
}

export const OVERLAY_OPTIONS = ['general', 'text', 'focus', 'structure']
export const CORE_OPTIONS = ['visual', 'auditory', 'reading', 'kinesthetic']

export function dominantMode(vark = {}, preferred) {
  if (preferred && CORE_OPTIONS.includes(preferred)) return preferred
  const entries = Object.entries(vark).filter(([, score]) => Number.isFinite(Number(score)))
  if (!entries.length) return 'visual'
  return entries.reduce((top, entry) => Number(entry[1]) > Number(top[1]) ? entry : top)[0]
}

export function accessibilityProfile(user = {}) {
  if (user.sen_profile && ['text', 'focus', 'structure', 'general'].includes(user.sen_profile)) {
    return user.sen_profile
  }
  const scores = user.sen_scores || {}
  const groups = {
    structure: ((Number(scores.asd) || 0) + (Number(scores.slcn) || 0)) / 2,
    focus: ((Number(scores.adhd) || 0) + (Number(scores.semh) || 0)) / 2,
    text: ((Number(scores.dyslexia) || 0) + (Number(scores.esl) || 0)) / 2,
  }
  const flags = (user.sen_flags || user.conditions || []).map((flag) => String(flag).trim().toLowerCase())
  const flagged = []
  if (flags.some((flag) => STRUCTURE_FLAGS.has(flag)) || groups.structure >= 1.75) flagged.push(['structure', groups.structure])
  if (flags.some((flag) => FOCUS_FLAGS.has(flag)) || groups.focus >= 1.75) flagged.push(['focus', groups.focus])
  if (flags.some((flag) => TEXT_FLAGS.has(flag)) || groups.text >= 1.75) flagged.push(['text', groups.text])
  if (!flagged.length) return 'general'
  flagged.sort((a, b) => b[1] - a[1])
  return flagged[0][0]
}

export function pickTemplateId(mode, profile) {
  // Overlay (SEN) is the primary switch. Core (VARK) only refines within a profile.
  if (profile === 'focus') return 'T1'
  if (profile === 'text') {
    if (mode === 'auditory') return 'T2'
    if (mode === 'reading') return 'T4'
    return 'T5'
  }
  if (profile === 'structure') {
    if (mode === 'visual' || mode === 'kinesthetic') return 'T3'
    return 'T6'
  }
  return { kinesthetic: 'T1', auditory: 'T2', visual: 'T3', reading: 'T4' }[mode] || 'T3'
}

export function resolveLearningTemplate(user = {}) {
  const mode = dominantMode(user.vark, user.preferred_core)
  const profile = accessibilityProfile(user)
  const id = pickTemplateId(mode, profile)
  return {
    ...TEMPLATES[id],
    mode,
    accessibilityProfile: profile,
    overlay: profile,
    core: mode,
  }
}

export function previewTemplate(overlay, mode) {
  const id = pickTemplateId(mode, overlay)
  return { ...TEMPLATES[id], mode, accessibilityProfile: overlay, overlay, core: mode }
}

export function varkWithDominant(mode, previous = {}) {
  const result = {}
  CORE_OPTIONS.forEach((key) => {
    result[key] = key === mode ? 70 : Math.max(8, Number(previous[key] || 20) * 0.35)
  })
  const otherMax = Math.max(...CORE_OPTIONS.filter((key) => key !== mode).map((key) => result[key]))
  if (result[mode] <= otherMax) result[mode] = otherMax + 12
  const total = Object.values(result).reduce((sum, value) => sum + value, 0) || 1
  return Object.fromEntries(CORE_OPTIONS.map((key) => [key, Math.round((result[key] / total) * 1000) / 10]))
}

export function defaultTogglesForProfile(template) {
  const text = template.accessibilityProfile === 'text' || template.textSupport
  return {
    voiceReader: text || template.prominentAudio,
    signLanguage: false,
    highContrast: false,
    largeText: false,
    audioQuiz: template.prominentAudio || template.mode === 'auditory',
    visualQuiz: template.visualAid || template.mode === 'visual',
  }
}

export function layerClassNames(template) {
  if (!template) return ''
  return [
    `ui-core-${template.mode}`,
    `ui-overlay-${template.accessibilityProfile}`,
    `lesson-template-${template.id}`,
  ].join(' ')
}
