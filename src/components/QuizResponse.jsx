import { useState } from 'react'

export function optionLabel(option) {
  return String(option || '').replace(/^[A-D]\.\s*/i, '').trim()
}

export function matchAnswerIndex(question, answer) {
  if (typeof answer === 'number' && Number.isInteger(answer) && answer >= 0) return answer
  const typed = String(answer || '').trim().toLowerCase()
  if (!typed) return undefined
  const options = question.options || []
  const exact = options.findIndex((option) => optionLabel(option).toLowerCase() === typed)
  if (exact >= 0) return exact
  const partial = options.findIndex((option) => {
    const label = optionLabel(option).toLowerCase()
    return Boolean(label) && (label.includes(typed) || typed.includes(label))
  })
  return partial >= 0 ? partial : undefined
}

export default function QuizResponse({ template, question, selected, lang, onSelect, VisualAid }) {
  const format = template.quizFormat || 'choice'
  const arabic = lang === 'ar'
  const options = question.options || []

  if (format === 'sandbox') return <SandboxQuest options={options} selected={selected} arabic={arabic} onSelect={onSelect} />
  if (format === 'podcast') return <PodcastChoices options={options} selected={selected} arabic={arabic} lang={lang} onSelect={onSelect} />
  if (format === 'storyboard') return <StoryboardChoices question={question} options={options} selected={selected} arabic={arabic} onSelect={onSelect} VisualAid={VisualAid} lang={lang} />
  if (format === 'translator') return <TranslatorAnswer question={question} options={options} selected={selected} arabic={arabic} onSelect={onSelect} />
  if (format === 'explorer') return <ExplorerBoard question={question} options={options} selected={selected} arabic={arabic} onSelect={onSelect} VisualAid={VisualAid} lang={lang} />
  if (format === 'routine') return <RoutineChoice options={options} selected={selected} arabic={arabic} onSelect={onSelect} />
  return <ChoiceList options={options} selected={selected} onSelect={onSelect} layout="stack" />
}

function ChoiceList({ options, selected, onSelect, layout = 'stack', hideLetters = false }) {
  const letters = ['A', 'B', 'C', 'D']
  return (
    <div className={layout === 'grid' ? 'grid gap-3 sm:grid-cols-2' : 'space-y-3'}>
      {options.map((opt, idx) => (
        <button
          key={idx}
          type="button"
          onClick={() => onSelect(idx)}
          className={`lesson-option flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-start transition-standard ${
            selected === idx
              ? 'border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/30'
              : 'border-gray-200 hover:border-violet-300 dark:border-gray-700 dark:hover:border-violet-500'
          }`}
        >
          {!hideLetters && (
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-sm font-bold ${
              selected === idx ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
            }`}>
              {letters[idx]}
            </span>
          )}
          <span dir="auto" style={{ unicodeBidi: 'plaintext' }} className="break-words font-medium text-gray-800 dark:text-gray-200">
            {optionLabel(opt)}
          </span>
        </button>
      ))}
    </div>
  )
}

function SandboxQuest({ options, selected, arabic, onSelect }) {
  const drop = (event) => {
    event.preventDefault()
    const idx = Number(event.dataTransfer.getData('text/plain'))
    if (Number.isInteger(idx)) onSelect(idx)
  }
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
        {arabic ? 'اسحب الإجابة إلى الصندوق، أو اضغط عليها.' : 'Drag one answer into the box, or tap it.'}
      </p>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
        className={`flex min-h-28 items-center justify-center rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm font-bold ${
          typeof selected === 'number'
            ? 'border-violet-500 bg-violet-50 text-violet-800 dark:border-violet-400 dark:bg-violet-950/40 dark:text-violet-200'
            : 'border-violet-300 bg-violet-50/50 text-violet-500 dark:border-violet-800 dark:bg-violet-950/20'
        }`}
      >
        {typeof selected === 'number' ? optionLabel(options[selected]) : (arabic ? 'صندوق المهمة' : 'Quest box')}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            draggable
            onDragStart={(event) => event.dataTransfer.setData('text/plain', String(idx))}
            onClick={() => onSelect(idx)}
            className={`lesson-option cursor-grab rounded-xl border-2 px-4 py-5 text-start text-sm font-semibold active:cursor-grabbing ${
              selected === idx ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-gray-700'
            }`}
          >
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function PodcastChoices({ options, selected, arabic, lang, onSelect }) {
  const [ready, setReady] = useState(false)
  const hear = (text) => {
    if (!('speechSynthesis' in window)) return
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang === 'ar' ? 'ar-SA' : 'en-US'
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utter)
  }
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-gray-600 dark:text-gray-300">
        {arabic ? 'استمع أولاً، ثم أظهر الخيارات الصوتية.' : 'Listen first, then reveal the spoken options.'}
      </p>
      {!ready ? (
        <button type="button" onClick={() => setReady(true)} className="flex w-full items-center justify-center gap-3 rounded-xl bg-violet-600 py-5 text-base font-bold text-white">
          {arabic ? 'أظهر الخيارات بعد الاستماع' : 'Show options after listening'}
        </button>
      ) : (
        <div className="space-y-3">
          {options.map((opt, idx) => (
            <div key={idx} className={`flex items-center gap-2 rounded-xl border-2 p-2 ${selected === idx ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-gray-700'}`}>
              <button type="button" className="rounded-lg bg-violet-100 px-3 py-3 text-sm font-bold text-violet-800 dark:bg-violet-900/50 dark:text-violet-200" onClick={() => hear(optionLabel(opt))}>
                {arabic ? 'اسمع' : 'Hear'}
              </button>
              <button type="button" onClick={() => onSelect(idx)} className="flex-1 px-2 py-3 text-start text-sm font-semibold text-gray-800 dark:text-gray-100">
                {optionLabel(opt)}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StoryboardChoices({ question, options, selected, arabic, onSelect, VisualAid, lang }) {
  const [frame, setFrame] = useState(0)
  return (
    <div className="space-y-4">
      <div className="flex gap-2" aria-label={arabic ? `إطار ${frame + 1} من 3` : `Frame ${frame + 1} of 3`}>
        {[0, 1, 2].map((index) => (
          <div key={index} className={`h-1.5 flex-1 rounded-full ${index <= frame ? 'bg-violet-600' : 'bg-violet-100 dark:bg-gray-800'}`} />
        ))}
      </div>
      {frame === 0 && (
        <div>
          {VisualAid ? <VisualAid cue={question.visual_cue} lang={lang} /> : null}
          <button type="button" onClick={() => setFrame(1)} className="mt-3 w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">
            {arabic ? 'التالي: السؤال' : 'Next: the question'}
          </button>
        </div>
      )}
      {frame === 1 && (
        <div>
          <p className="mb-4 text-lg font-bold text-gray-900 dark:text-white">{arabic ? 'اقرأ السؤال، ثم انتقل لاختيار المشهد.' : 'Read the question, then choose the matching scene.'}</p>
          <button type="button" onClick={() => setFrame(2)} className="w-full rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">
            {arabic ? 'التالي: الإجابة' : 'Next: choose'}
          </button>
        </div>
      )}
      {frame === 2 && <ChoiceList options={options} selected={selected} onSelect={onSelect} layout="grid" hideLetters />}
    </div>
  )
}

function TranslatorAnswer({ question, options, selected, arabic, onSelect }) {
  const typed = typeof selected === 'string' ? selected : ''
  const index = typeof selected === 'number' ? selected : matchAnswerIndex(question, typed)
  return (
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        {arabic ? 'اكتب إجابتك، أو اختر من بنك الكلمات.' : 'Write your answer, or tap a word-bank card.'}
      </label>
      <textarea
        value={typed}
        onInput={(event) => onSelect(event.currentTarget.value)}
        rows={3}
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
        placeholder={arabic ? 'أعتقد أن الإجابة هي…' : 'I think the answer is…'}
      />
      <div className="flex flex-wrap gap-2">
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${index === idx ? 'border-violet-500 bg-violet-50 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200' : 'border-gray-200 text-gray-700 dark:border-gray-700 dark:text-gray-200'}`}
          >
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function ExplorerBoard({ question, options, selected, arabic, onSelect, VisualAid, lang }) {
  const spots = ['1', '2', '3', '4']
  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">
        {arabic ? 'انظر إلى الرسم، ثم اضغط النقطة التي تطابق الفكرة.' : 'Study the diagram, then tap the matching point.'}
      </p>
      {VisualAid ? <VisualAid cue={question.visual_cue} lang={lang} /> : null}
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => onSelect(idx)}
            className={`rounded-xl border-2 px-3 py-4 text-start text-sm font-semibold ${selected === idx ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30' : 'border-gray-200 dark:border-gray-700'}`}
          >
            <span className="mb-1 block text-[10px] uppercase tracking-wide text-violet-500">{arabic ? `نقطة ${spots[idx]}` : `Point ${spots[idx]}`}</span>
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  )
}

function RoutineChoice({ options, selected, arabic, onSelect }) {
  const [cursor, setCursor] = useState(0)
  const current = options[cursor]
  return (
    <div className="space-y-4">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-600">
        {arabic ? `خيار ${cursor + 1} من ${options.length}` : `Choice ${cursor + 1} of ${options.length}`}
      </p>
      <div className="rounded-xl border border-violet-200 bg-white p-6 text-lg font-bold text-gray-900 dark:border-violet-800 dark:bg-gray-900 dark:text-white">
        {optionLabel(current)}
      </div>
      <div className="flex gap-2">
        <button type="button" disabled={cursor === 0} onClick={() => setCursor((value) => value - 1)} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold disabled:opacity-30 dark:border-gray-600">
          {arabic ? 'السابق' : 'Previous'}
        </button>
        <button type="button" onClick={() => onSelect(cursor)} className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-bold text-white">
          {selected === cursor ? (arabic ? 'هذا اختياري' : 'This is my answer') : (arabic ? 'أكد هذا' : 'Choose this')}
        </button>
        <button type="button" disabled={cursor === options.length - 1} onClick={() => setCursor((value) => value + 1)} className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-bold disabled:opacity-30 dark:border-gray-600">
          {arabic ? 'التالي' : 'Next'}
        </button>
      </div>
    </div>
  )
}
