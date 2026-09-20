/**
 * Learner screening used at registration.
 *
 * This is an accessibility placement tool, not a clinical diagnosis.
 * Constructs are sampled from published frameworks; item wording is original
 * so we do not reproduce copyrighted instruments.
 *
 * VARK: Fleming & Mills (1992) four-modality model (Visual, Aural, Read/Write,
 * Kinesthetic). Forced-choice scenarios follow that model’s structure.
 *
 * SEN domains (self-report, ages 6–16):
 * - Dyslexia: Rose (2009) / IDA literacy indicators (decoding, spelling, recall)
 * - ESL: language-of-instruction access (not a SEN diagnosis)
 * - ADHD: DSM-5-TR inattention / hyperactivity-impulsivity domains
 * - SEMH: Goodman SDQ emotional / classroom regulation constructs
 * - ASD: social-communication, routine, sensory load (AQ-style constructs)
 * - SLCN: comprehension, word-finding, aided expression (Bishop SLI indicators)
 */

export const LIKERT = [
  { value: 0, en: 'Never', ar: 'أبداً' },
  { value: 1, en: 'Sometimes', ar: 'أحياناً' },
  { value: 2, en: 'Often', ar: 'غالباً' },
  { value: 3, en: 'Almost always', ar: 'دائماً تقريباً' },
]

export const SEN_ITEMS = [
  { id: 'dx1', domain: 'dyslexia', en: 'Sounding out new words on the page feels mixed-up or slow.', ar: 'تهجئة الكلمات الجديدة على الصفحة تبدو مختلطة أو بطيئة.' },
  { id: 'dx2', domain: 'dyslexia', en: 'I spell the same word in different ways.', ar: 'أكتب نفس الكلمة بأشكال مختلفة.' },
  { id: 'dx3', domain: 'dyslexia', en: 'I remember a lesson better when I hear it than when I only read it.', ar: 'أتذكر الدرس أفضل عندما أسمعه مقارنة بالقراءة فقط.' },
  { id: 'es1', domain: 'esl', en: 'I understand schoolwork better in a language that is not English.', ar: 'أفهم العمل المدرسي أفضل بلغة غير الإنجليزية.' },
  { id: 'es2', domain: 'esl', en: 'New English words need extra explanation before I can use them.', ar: 'أحتاج شرحاً إضافياً للكلمات الإنجليزية الجديدة قبل أن أستخدمها.' },
  { id: 'es3', domain: 'esl', en: 'Seeing the same idea in two languages helps me learn.', ar: 'رؤية الفكرة نفسها بلغتين تساعدني على التعلم.' },
  { id: 'ad1', domain: 'adhd', en: 'Sitting still through a long lesson is hard for me.', ar: 'الجلوس بهدوء خلال درس طويل صعب عليّ.' },
  { id: 'ad2', domain: 'adhd', en: 'I lose the steps if someone gives several instructions at once.', ar: 'أضيع الخطوات إذا أُعطيت عدة تعليمات دفعة واحدة.' },
  { id: 'ad3', domain: 'adhd', en: 'Sounds or movement around me pull my attention off the task.', ar: 'الأصوات أو الحركة من حولي تسحب انتباهي عن المهمة.' },
  { id: 'sm1', domain: 'semh', en: 'Big feelings make it hard to keep working.', ar: 'المشاعر القوية تجعل الاستمرار في العمل صعباً.' },
  { id: 'sm2', domain: 'semh', en: 'A mistake makes me want to stop rather than try again.', ar: 'الخطأ يجعلني أرغب في التوقف بدل المحاولة مرة أخرى.' },
  { id: 'sm3', domain: 'semh', en: 'I need a calm pause before I can return to a hard task.', ar: 'أحتاج وقفة هادئة قبل أن أعود إلى مهمة صعبة.' },
  { id: 'as1', domain: 'asd', en: 'I prefer knowing exactly what will happen next.', ar: 'أفضل أن أعرف بالضبط ماذا سيحدث بعد ذلك.' },
  { id: 'as2', domain: 'asd', en: 'A sudden change to the usual plan feels uncomfortable.', ar: 'التغيير المفاجئ للخطة المعتادة يشعرني بعدم الارتياح.' },
  { id: 'as3', domain: 'asd', en: 'Bright lights, loud sounds, or busy screens bother me.', ar: 'الأضواء الساطعة أو الأصوات العالية أو الشاشات المزدحمة تزعجني.' },
  { id: 'sl1', domain: 'slcn', en: 'Long spoken instructions are hard to follow.', ar: 'التعليمات الكلامية الطويلة صعبة المتابعة.' },
  { id: 'sl2', domain: 'slcn', en: 'Finding the right words to explain my idea takes extra time.', ar: 'إيجاد الكلمات المناسبة لشرح فكرتي يحتاج وقتاً إضافياً.' },
  { id: 'sl3', domain: 'slcn', en: 'Pictures or sentence starters help me answer.', ar: 'الصور أو بدايات الجمل تساعدني على الإجابة.' },
]

export const VARK_ITEMS = [
  {
    id: 'v1',
    en: 'A teacher is explaining how a plant grows. What helps you most?',
    ar: 'المعلم يشرح كيف ينمو النبات. ما الذي يساعدك أكثر؟',
    options: {
      visual: { en: 'A labelled diagram of roots, stem and leaves', ar: 'رسم مسمّى للجذور والساق والأوراق' },
      auditory: { en: 'Listening to the teacher talk it through', ar: 'الاستماع إلى شرح المعلم' },
      reading: { en: 'A short written list of the growth steps', ar: 'قائمة مكتوبة قصيرة لخطوات النمو' },
      kinesthetic: { en: 'Planting a seed and watching it myself', ar: 'زراعة بذرة ومتابعتها بنفسي' },
    },
  },
  {
    id: 'v2',
    en: 'You need to remember the planets in order. You would…',
    ar: 'تحتاج تذكّر ترتيب الكواكب. سوف…',
    options: {
      visual: { en: 'Use a coloured map or poster of the solar system', ar: 'تستخدم خريطة أو ملصقاً ملوناً للمجموعة الشمسية' },
      auditory: { en: 'Say a rhyme or song of the names', ar: 'تقول أغنية أو قافية بالأسماء' },
      reading: { en: 'Write the names in a neat list several times', ar: 'تكتب الأسماء في قائمة مرتبة عدة مرات' },
      kinesthetic: { en: 'Line up objects on the floor like planets', ar: 'تصفّ أشياء على الأرض مثل الكواكب' },
    },
  },
  {
    id: 'v3',
    en: 'A new classroom game has tricky rules. How do you start?',
    ar: 'لعبة صفية جديدة لها قواعد صعبة. كيف تبدأ؟',
    options: {
      visual: { en: 'Watch someone play a round first', ar: 'تشاهد شخصاً يلعب جولة أولاً' },
      auditory: { en: 'Ask a friend to explain the rules out loud', ar: 'تطلب من صديق شرح القواعد بصوت عالٍ' },
      reading: { en: 'Read the rules card carefully', ar: 'تقرأ بطاقة القواعد بتركيز' },
      kinesthetic: { en: 'Try a practice round and learn by doing', ar: 'تجرب جولة تدريبية وتتعلم بالممارسة' },
    },
  },
  {
    id: 'v4',
    en: 'You are learning a new maths method. What clicks for you?',
    ar: 'تتعلم طريقة جديدة في الرياضيات. ما الذي يناسبك؟',
    options: {
      visual: { en: 'Blocks, bars or a picture of the problem', ar: 'مكعبات أو أعمدة أو صورة للمسألة' },
      auditory: { en: 'Talking the steps through with someone', ar: 'مناقشة الخطوات مع شخص آخر' },
      reading: { en: 'Worked examples written step by step', ar: 'أمثلة محلولة مكتوبة خطوة بخطوة' },
      kinesthetic: { en: 'Moving objects or using a slider myself', ar: 'تحريك الأشياء أو استخدام شريط تمرير بنفسي' },
    },
  },
  {
    id: 'v5',
    en: 'Before a science quiz, your first move is to…',
    ar: 'قبل اختبار علوم، أول خطوة لك هي…',
    options: {
      visual: { en: 'Review diagrams and colour-coded notes', ar: 'مراجعة الرسوم والملاحظات الملونة' },
      auditory: { en: 'Quiz myself by speaking answers aloud', ar: 'أختبر نفسي بقول الإجابات بصوت عالٍ' },
      reading: { en: 'Re-read my notes and highlight key words', ar: 'أعيد قراءة ملاحظاتي وأظلل الكلمات المهمة' },
      kinesthetic: { en: 'Do a short practice activity or experiment', ar: 'أقوم بنشاط عملي قصير أو تجربة' },
    },
  },
  {
    id: 'v6',
    en: 'Someone explains fractions. What makes it make sense?',
    ar: 'شخص يشرح الكسور. ما الذي يجعلك تفهم؟',
    options: {
      visual: { en: 'A pizza or bar split into equal parts', ar: 'بيتزا أو عمود مقسوم إلى أجزاء متساوية' },
      auditory: { en: 'Hearing the explanation more than once', ar: 'سماع الشرح أكثر من مرة' },
      reading: { en: 'Written definitions and a short example', ar: 'تعريفات مكتوبة ومثال قصير' },
      kinesthetic: { en: 'Cutting paper or folding to make the parts', ar: 'قص الورق أو طيه لصنع الأجزاء' },
    },
  },
  {
    id: 'v7',
    en: 'You are learning a new computer skill. You prefer to…',
    ar: 'تتعلم مهارة حاسوب جديدة. تفضّل أن…',
    options: {
      visual: { en: 'Follow screenshots or a short video', ar: 'تتبع لقطات الشاشة أو فيديو قصير' },
      auditory: { en: 'Listen to spoken click-by-click guidance', ar: 'تستمع إلى توجيه صوتي خطوة بخطوة' },
      reading: { en: 'Use a written checklist of commands', ar: 'تستخدم قائمة مكتوبة بالأوامر' },
      kinesthetic: { en: 'Click around in a safe practice screen', ar: 'تجرب النقر في شاشة تدريب آمنة' },
    },
  },
  {
    id: 'v8',
    en: 'To remember a story you just heard, you would…',
    ar: 'لتتذكر قصة سمعتها للتو، سوف…',
    options: {
      visual: { en: 'Sketch the scenes in order', ar: 'ترسم المشاهد بالترتيب' },
      auditory: { en: 'Retell it out loud to someone', ar: 'تعيد روايتها بصوت عالٍ لشخص ما' },
      reading: { en: 'Write a short summary in your own words', ar: 'تكتب ملخصاً قصيراً بكلماتك' },
      kinesthetic: { en: 'Act out the main events', ar: 'تمثل الأحداث الرئيسية' },
    },
  },
]

const DOMAINS = ['dyslexia', 'esl', 'adhd', 'semh', 'asd', 'slcn']
const TEXT_DOMAINS = ['dyslexia', 'esl']
const FOCUS_DOMAINS = ['adhd', 'semh']
const STRUCTURE_DOMAINS = ['asd', 'slcn']
const FLAG_THRESHOLD = 1.75

function mean(values) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length
}

export function scoreLearnerScreen(senAnswers = {}, varkChoices = []) {
  const scores = {}
  const flags = []

  for (const domain of DOMAINS) {
    const items = SEN_ITEMS.filter((item) => item.domain === domain)
    const values = items.map((item) => Number(senAnswers[item.id] ?? 0))
    const domainMean = mean(values)
    const strongItems = values.filter((value) => value >= 2).length
    scores[domain] = Math.round(domainMean * 100) / 100
    if (domainMean >= FLAG_THRESHOLD || strongItems >= 2) flags.push(domain)
  }

  const groupScore = (domains) => mean(domains.map((domain) => scores[domain] || 0))
  const groups = {
    text: groupScore(TEXT_DOMAINS),
    focus: groupScore(FOCUS_DOMAINS),
    structure: groupScore(STRUCTURE_DOMAINS),
  }

  const flaggedGroups = []
  if (flags.some((flag) => TEXT_DOMAINS.includes(flag))) flaggedGroups.push(['text', groups.text])
  if (flags.some((flag) => FOCUS_DOMAINS.includes(flag))) flaggedGroups.push(['focus', groups.focus])
  if (flags.some((flag) => STRUCTURE_DOMAINS.includes(flag))) flaggedGroups.push(['structure', groups.structure])

  // SEN overlay wins: the strongest flagged support profile, not VARK.
  let profile = 'general'
  if (flaggedGroups.length) {
    flaggedGroups.sort((a, b) => b[1] - a[1])
    profile = flaggedGroups[0][0]
  }

  const varkCounts = { visual: 0, auditory: 0, reading: 0, kinesthetic: 0 }
  varkChoices.forEach((style) => {
    if (varkCounts[style] !== undefined) varkCounts[style] += 1
  })
  const varkTotal = Object.values(varkCounts).reduce((sum, value) => sum + value, 0) || 1
  const vark = Object.fromEntries(
    Object.entries(varkCounts).map(([key, value]) => [key, Math.round((value / varkTotal) * 1000) / 10]),
  )
  const dominant = Object.entries(vark).reduce((top, entry) => (entry[1] > top[1] ? entry : top))[0]

  return {
    flags,
    scores,
    groups,
    profile,
    vark,
    dominant,
    hasSen: flags.length > 0,
  }
}

export function emptySenAnswers() {
  return Object.fromEntries(SEN_ITEMS.map((item) => [item.id, null]))
}
