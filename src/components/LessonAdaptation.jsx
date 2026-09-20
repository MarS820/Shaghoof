const COPY = {
  T1: { en: ['Look', 'Try', 'Explain'], ar: ['لاحظ', 'جرّب', 'اشرح'] },
  T2: { en: ['Listen', 'Read the transcript', 'Choose'], ar: ['استمع', 'اقرأ النص', 'اختر'] },
  T3: { en: ['Scene', 'Question', 'Answer'], ar: ['المشهد', 'السؤال', 'الإجابة'] },
  T4: { en: ['Read', 'Check a word', 'Write'], ar: ['اقرأ', 'تحقق من كلمة', 'اكتب'] },
  T5: { en: ['Observe', 'Listen', 'Connect'], ar: ['لاحظ', 'استمع', 'اربط'] },
  T6: { en: ['First', 'Now', 'Next'], ar: ['أولاً', 'الآن', 'بعد ذلك'] },
}

export default function LessonAdaptation({ template, current, total, lang, keywords = [], sensoryReduced, onToggleSensory }) {
  const arabic = lang === 'ar'
  const progress = total ? Math.round((current / total) * 100) : 0
  const steps = COPY[template.id][arabic ? 'ar' : 'en']

  return (
    <aside className="mb-5 border-s-4 border-violet-500 bg-violet-50 px-4 py-3 dark:border-violet-400 dark:bg-violet-950/30" aria-label={arabic ? 'إعدادات التعلم المخصصة' : 'Personalised learning setup'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-white text-sm font-bold text-violet-700 dark:bg-gray-900 dark:text-violet-300" aria-hidden="true">{template.icon}</span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-violet-700 dark:text-violet-300">{template.name}</p>
            <p className="text-sm text-gray-700 dark:text-gray-200">{arabic ? template.ar : template.en}</p>
          </div>
        </div>
        {template.structured && <span className="rounded-md border border-violet-200 bg-white px-2 py-1 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-gray-900 dark:text-violet-300">{arabic ? `الخطوة ${current} من ${total}` : `Step ${current} of ${total}`}</span>}
        {template.id === 'T1' && <span className="rounded-md border border-violet-200 bg-white px-2 py-1 text-xs font-semibold text-violet-700 dark:border-violet-800 dark:bg-gray-900 dark:text-violet-300">{arabic ? 'مهمة قصيرة' : 'Short quest'}</span>}
      </div>

      {template.structured && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-100 dark:bg-violet-900/60"><div className="h-full bg-violet-600" style={{ width: `${progress}%` }} /></div>}
      {template.textSupport && keywords.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5" aria-label={arabic ? 'كلمات أساسية' : 'Key terms'}>{keywords.slice(0, 4).map((word) => <span key={word} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-gray-700 dark:bg-gray-900 dark:text-gray-200">{word}</span>)}</div>}

      <div className={`mt-3 grid gap-2 ${template.id === 'T1' ? 'grid-cols-3' : 'sm:grid-cols-3'}`} aria-label={arabic ? 'خطوات الدرس' : 'Lesson steps'}>
        {steps.map((step, index) => (
          <div key={step} className={`border px-3 py-2 text-center text-xs font-semibold ${index === 1 ? 'border-violet-300 bg-white text-violet-800 dark:border-violet-700 dark:bg-gray-900 dark:text-violet-200' : 'border-violet-100 bg-violet-50/60 text-gray-600 dark:border-violet-900 dark:bg-violet-950/20 dark:text-gray-300'}`}>
            <span className="me-1 text-violet-500">{index + 1}.</span>{step}
          </div>
        ))}
      </div>

      {template.id === 'T2' && <div className="mt-3 flex h-9 items-center justify-center gap-1 border border-violet-100 bg-white px-3 dark:border-violet-900 dark:bg-gray-900" aria-label={arabic ? 'شكل الموجة الصوتية' : 'Audio waveform'}>{[35, 70, 45, 90, 55, 75, 40, 85, 50, 65, 35, 80].map((height, index) => <span key={index} className="w-1 bg-violet-500" style={{ height: `${height}%` }} />)}</div>}

      {(template.id === 'T6' || template.id === 'T3') && <button type="button" onClick={onToggleSensory} className="mt-3 rounded-md border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-700 transition-standard hover:bg-violet-100 dark:border-violet-800 dark:bg-gray-900 dark:text-violet-300">
        {sensoryReduced ? (arabic ? 'إعادة المؤثرات العادية' : 'Restore standard sensory settings') : (arabic ? 'تقليل المؤثرات الحسية' : 'Reduce sensory input')}
      </button>}
    </aside>
  )
}
