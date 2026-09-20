import { useRef, useState } from 'react'

/**
 * WordwallGame — interactive Wordwall-style activity rendered from a pack
 * generated strictly from the lesson's own content. The game KIND is chosen
 * by the student's active template:
 *
 *   T1 match (tap term ↔ tap meaning) · T2 truefalse · T3 wordimage (emoji)
 *   T4 missingword (cloze) · T5/T6 wheel (spin & explain)
 */
export default function WordwallGame({ pack, arabic = false, onXp }) {
  const [done, setDone] = useState(false)

  if (!pack) return null
  const award = (amount) => { try { onXp?.(amount, arabic ? 'لعبة الدرس' : 'Wordwall') } catch { /* noop */ } }
  const finish = () => { setDone(true); award(10) }

  return (
    <div className="animate-pop-in mt-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
          🎮 {arabic ? pack.game?.ar : pack.game?.en}
          <span className="ms-2 rounded-full bg-emerald-200 px-2 py-0.5 text-[9px] font-extrabold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
            {pack.template_id}
          </span>
        </p>
        {done && <span className="text-[10px] font-extrabold text-emerald-600">🎉 {arabic ? 'أحسنت!' : 'Great job!'}</span>}
      </div>

      {pack.kind === 'match' && <MatchGame pack={pack} arabic={arabic} onDone={finish} />}
      {pack.kind === 'truefalse' && <TrueFalseGame pack={pack} arabic={arabic} onDone={finish} />}
      {pack.kind === 'wordimage' && <WordImageGame pack={pack} arabic={arabic} onDone={finish} />}
      {pack.kind === 'missingword' && <MissingWordGame pack={pack} arabic={arabic} onDone={finish} />}
      {pack.kind === 'wheel' && <WheelGame pack={pack} arabic={arabic} onXp={(a) => award(a)} />}
      {pack.kind === 'sequence' && <SequenceGame pack={pack} arabic={arabic} onDone={finish} />}
      {pack.kind === 'fillblank' && <FillBlankGame pack={pack} arabic={arabic} onDone={finish} />}
    </div>
  )
}

// ── T1: match term ↔ definition ───────────────────────────────────────────────

function MatchGame({ pack, arabic, onDone }) {
  const pairs = pack.pairs || []
  const [matched, setMatched] = useState(() => new Set())
  const [pickedTerm, setPickedTerm] = useState(null)
  const [pickedDef, setPickedDef] = useState(null)
  const [wrong, setWrong] = useState(false)
  const firedRef = useRef(false)

  // Columns are deterministically shuffled so pairs aren't aligned in a row.
  // (≤6 items — recomputing per render is free and keeps the linter happy.)
  const rot = (arr) => { const off = Math.max(1, Math.floor(arr.length / 2)); return arr.slice(off).concat(arr.slice(0, off)) }
  const cards = {
    terms: rot(pairs.map((p) => ({ id: p.id, text: p.term }))),
    defs: rot(pairs.map((p) => ({ id: p.id, text: p.definition }))).reverse(),
  }

  // Resolve a pair as soon as both sides are picked — no effect needed.
  const resolve = (side, card) => {
    if (wrong) return
    const term = side === 'term' ? card : pickedTerm
    const def = side === 'def' ? card : pickedDef
    if (side === 'term') setPickedTerm(card)
    else setPickedDef(card)
    if (!term || !def) return
    if (term.id === def.id) {
      const next = new Set(matched)
      next.add(term.id)
      setMatched(next)
      setPickedTerm(null)
      setPickedDef(null)
      if (next.size === pairs.length && !firedRef.current) { firedRef.current = true; onDone?.() }
    } else {
      setWrong(true)
      setTimeout(() => { setWrong(false); setPickedTerm(null); setPickedDef(null) }, 600)
    }
  }

  const cardClass = (isActive, isMatched) =>
    `w-full rounded-xl border-2 px-2 py-2 text-start text-[11px] font-bold transition-bouncy press-bubble ${
      isMatched
        ? 'border-emerald-400 bg-emerald-100 text-emerald-700 opacity-60 dark:bg-emerald-900/40'
        : wrong && isActive
          ? 'border-red-400 bg-red-50 text-red-600'
          : isActive
            ? 'border-emerald-500 bg-emerald-200 text-emerald-800'
            : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-emerald-400 dark:bg-gray-800'
    }`

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold text-[var(--muted)]">{arabic ? 'طابق كل مصطلح مع معناه' : 'Tap a term, then its meaning'}</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          {cards.terms.map((c) => (
            <button key={`t-${c.id}`} onClick={() => resolve('term', c)} disabled={matched.has(c.id) || wrong}
              className={cardClass(pickedTerm?.id === c.id, matched.has(c.id))}>
              {c.text}
            </button>
          ))}
        </div>
        <div className="space-y-1.5">
          {cards.defs.map((c) => (
            <button key={`d-${c.id}`} onClick={() => resolve('def', c)} disabled={matched.has(c.id) || wrong}
              className={cardClass(pickedDef?.id === c.id, matched.has(c.id))}>
              {c.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── T2: true/false sprint ─────────────────────────────────────────────────────

function TrueFalseGame({ pack, arabic, onDone }) {
  const [idx, setIdx] = useState(0)
  const [score, setScore] = useState(0)
  const [last, setLast] = useState(null) // { choice, correct }
  const items = pack.items || []
  const item = items[idx]

  const answer = (choice) => {
    if (last || !item) return
    const correct = choice === item.answer
    if (correct) setScore((s) => s + 1)
    setLast({ choice, correct })
    setTimeout(() => {
      setLast(null)
      if (idx + 1 >= items.length) onDone?.()
      else setIdx((i) => i + 1)
    }, 700)
  }

  if (!item) return null
  const btnState = (value) => {
    if (!last || last.choice !== value) return 'border-[var(--line)] bg-white text-[var(--ink)] hover:bg-gray-50 dark:bg-gray-800'
    return last.correct ? 'border-emerald-500 bg-emerald-200 text-emerald-800' : 'border-red-400 bg-red-50 text-red-500'
  }

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold text-[var(--muted)]">{idx + 1}/{items.length} · ⭐ {score}</p>
      <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs font-bold text-[var(--ink)] dark:bg-gray-800">{item.statement}</p>
      <div className="flex gap-2">
        <button onClick={() => answer(true)} disabled={!!last} className={`flex-1 rounded-xl border-2 py-2 text-xs font-extrabold transition-bouncy press-bubble ${btnState(true)}`}>
          ✔️ {arabic ? 'صح' : 'True'}
        </button>
        <button onClick={() => answer(false)} disabled={!!last} className={`flex-1 rounded-xl border-2 py-2 text-xs font-extrabold transition-bouncy press-bubble ${btnState(false)}`}>
          ✖️ {arabic ? 'خطأ' : 'False'}
        </button>
      </div>
    </div>
  )
}

// ── T3: emoji picture words ───────────────────────────────────────────────────

function WordImageGame({ pack, arabic, onDone }) {
  const [flipped, setFlipped] = useState({})
  const items = pack.items || []
  if (!items.length) return null

  const flip = (i) => {
    if (flipped[i]) return
    const next = { ...flipped, [i]: true }
    setFlipped(next)
    if (Object.keys(next).length === items.length) onDone?.()
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold text-[var(--muted)]">{arabic ? 'اضغط البطاقة لترى المعنى' : 'Tap a card to reveal its meaning'} ({Object.keys(flipped).length}/{items.length})</p>
      <div className="grid grid-cols-3 gap-1.5">
        {items.map((it, i) => (
          <button key={i} onClick={() => flip(i)} className={`rounded-xl border-2 p-2 text-center transition-bouncy press-bubble ${flipped[i] ? 'border-emerald-400 bg-emerald-100 dark:bg-emerald-900/40' : 'border-[var(--line)] bg-white hover:border-emerald-400 dark:bg-gray-800'}`}>
            <div className="text-xl">{it.emoji}</div>
            <div className="mt-0.5 text-[10px] font-extrabold text-[var(--ink)]">{it.term}</div>
            {flipped[i] && <div className="mt-0.5 text-[9px] leading-tight text-[var(--muted)]">{it.definition}</div>}
          </button>
        ))}
      </div>
    </div>
  )
}

// ── T4: missing word (cloze) ──────────────────────────────────────────────────

function MissingWordGame({ pack, arabic, onDone }) {
  const [idx, setIdx] = useState(0)
  const [last, setLast] = useState(null) // { choice, correct }
  const items = pack.items || []
  const item = items[idx]

  const choose = (opt) => {
    if (last || !item || !opt) return
    const correct = opt === item.answer
    setLast({ choice: opt, correct })
    setTimeout(() => {
      setLast(null)
      if (idx + 1 >= items.length) onDone?.()
      else setIdx((i) => i + 1)
    }, 800)
  }

  if (!item) return null
  return (
    <div>
      <p className="mb-1 text-[10px] font-bold text-[var(--muted)]">{idx + 1}/{items.length}</p>
      <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs font-bold leading-relaxed text-[var(--ink)] dark:bg-gray-800">{item.sentence}</p>
      {item.options?.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {item.options.map((opt, i) => {
            const isAnswer = opt === item.answer
            const cls = last
              ? isAnswer
                ? 'border-emerald-500 bg-emerald-200 text-emerald-800'
                : 'border-[var(--line)] bg-white text-[var(--muted)] opacity-50 dark:bg-gray-800'
              : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-emerald-400 dark:bg-gray-800'
            return (
              <button key={i} onClick={() => choose(opt)} disabled={!!last}
                className={`rounded-xl border-2 px-2 py-2 text-[11px] font-extrabold transition-bouncy press-bubble ${cls}`}>
                {opt}
              </button>
            )
          })}
        </div>
      ) : (
        <p className="text-[10px] font-bold text-emerald-600">{arabic ? 'الإجابة: ' : 'Answer: '}{item.answer}</p>
      )}
      {last && !last.correct && <p className="mt-1 text-[10px] font-extrabold text-red-500">{arabic ? 'الإجابة الصحيحة: ' : 'Correct answer: '}{item.answer}</p>}
    </div>
  )
}

// ── T5/T6: spin the wheel ─────────────────────────────────────────────────────

function WheelGame({ pack, arabic, onXp }) {
  const [angle, setAngle] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [landed, setLanded] = useState(null)
  const segments = pack.segments || []
  const colors = ['#3b82f6', '#a855f7', '#10b981', '#f59e0b', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e']
  const seg = 360 / Math.max(segments.length, 1)

  const spin = () => {
    if (spinning || !segments.length) return
    setSpinning(true)
    setLanded(null)
    const next = angle + 1080 + Math.random() * 360
    setAngle(next)
    setTimeout(() => {
      const final = ((next % 360) + 360) % 360
      const idx = Math.floor((360 - final) / seg) % segments.length
      setLanded(segments[idx])
      setSpinning(false)
      onXp?.(5)
    }, 2100)
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-40 w-40">
        <div className="h-full w-full rounded-full border-4 border-white shadow-lg transition-transform duration-[2000ms] dark:border-gray-700"
          style={{
            transform: `rotate(${angle}deg)`,
            background: `conic-gradient(${segments.map((_, i) => `${colors[i % colors.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(', ')})`,
          }} />
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 text-lg">🔻</div>
      </div>
      <button onClick={spin} disabled={spinning} className="brand-btn-primary mt-3 px-6 py-2 text-xs disabled:opacity-60">
        {spinning ? (arabic ? 'تدور…' : 'Spinning…') : (arabic ? 'أدر العجلة' : 'Spin the Wheel')}
      </button>
      {landed && (
        <div className="animate-pop-in mt-2 rounded-xl bg-white px-3 py-2 text-center dark:bg-gray-800">
          <p className="text-sm font-extrabold text-[var(--ink)]">{landed}</p>
          <p className="text-[10px] font-bold text-[var(--muted)]">{arabic ? pack.prompt?.ar : pack.prompt?.en}</p>
        </div>
      )}
    </div>
  )
}

// ── Sequence ordering game (T1/T6) ─────────────────────────────────────────────

function SequenceGame({ pack, arabic, onDone }) {
  const items = pack.items || []
  const [order, setOrder] = useState(() => {
    // Start with shuffled order
    return pack.shuffled || [...items].map(i => i.text).sort(() => Math.random() - 0.5)
  })
  const [checked, setChecked] = useState(false)
  const [correct, setCorrect] = useState(false)

  const move = (idx, dir) => {
    const next = [...order]
    const target = idx + dir
    if (target < 0 || target >= next.length) return
    ;[next[idx], next[target]] = [next[target], next[idx]]
    setOrder(next)
    setChecked(false)
  }

  const check = () => {
    const correctOrder = items.map(i => i.text)
    const isCorrect = order.every((v, i) => v === correctOrder[i])
    setCorrect(isCorrect)
    setChecked(true)
    if (isCorrect) onDone?.()
  }

  return (
    <div>
      <p className="mb-2 text-[10px] font-bold text-[var(--muted)]">{arabic ? 'رتب العناصر بالترتيب الصحيح' : 'Put the items in the correct order'}</p>
      <div className="space-y-2">
        {order.map((item, idx) => (
          <div key={item} className={`flex items-center gap-2 rounded-xl border-2 p-2 transition-bouncy ${
            checked 
              ? item === items[idx]?.text 
                ? 'border-emerald-500 bg-emerald-100 dark:bg-emerald-900/40'
                : 'border-red-400 bg-red-50 dark:bg-red-900/20'
              : 'border-[var(--line)] bg-white dark:bg-gray-800'
          }`}>
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-light)] text-xs font-extrabold text-[var(--brand)]">{idx + 1}</span>
            <span className="flex-1 text-xs font-bold text-[var(--ink)]">{item}</span>
            <div className="flex gap-1">
              <button onClick={() => move(idx, -1)} disabled={idx === 0} className="rounded-full bg-[var(--brand-light)] px-2 py-1 text-xs font-extrabold text-[var(--brand)] press-bubble disabled:opacity-30" aria-label="Move up">↑</button>
              <button onClick={() => move(idx, 1)} disabled={idx === order.length - 1} className="rounded-full bg-[var(--brand-light)] px-2 py-1 text-xs font-extrabold text-[var(--brand)] press-bubble disabled:opacity-30" aria-label="Move down">↓</button>
            </div>
          </div>
        ))}
      </div>
      {!checked && (
        <button onClick={check} className="mt-3 w-full brand-btn-primary text-xs">
          {arabic ? 'تحقق من الترتيب' : 'Check my order'}
        </button>
      )}
      {checked && (
        <div className={`mt-2 rounded-xl p-2 text-center text-xs font-extrabold ${
          correct 
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
            : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
        }`}>
          {correct 
            ? (arabic ? '🎉 ممتاز! الترتيب صحيح' : '🎉 Perfect! The order is correct')
            : (arabic ? 'حاول مرة أخرى' : 'Try again — check the order carefully')}
        </div>
      )}
    </div>
  )
}

// ── Fill-in-the-blank game (T2) ─────────────────────────────────────────────

function FillBlankGame({ pack, arabic, onDone }) {
  const [idx, setIdx] = useState(0)
  const [last, setLast] = useState(null)
  const items = pack.items || []
  const item = items[idx]

  const choose = (opt) => {
    if (last || !item || !opt) return
    const correct = opt === item.answer
    setLast({ choice: opt, correct })
    setTimeout(() => {
      setLast(null)
      if (idx + 1 >= items.length) onDone?.()
      else setIdx((i) => i + 1)
    }, 800)
  }

  if (!item) return null

  return (
    <div>
      <p className="mb-1 text-[10px] font-bold text-[var(--muted)]">{idx + 1}/{items.length}</p>
      <p className="mb-3 rounded-xl bg-white px-3 py-2 text-xs font-bold leading-relaxed text-[var(--ink)] dark:bg-gray-800">
        {item.sentence}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {item.options.map((opt, i) => {
          const isAnswer = opt === item.answer
          const cls = last
            ? isAnswer
              ? 'border-emerald-500 bg-emerald-200 text-emerald-800'
              : 'border-[var(--line)] bg-white text-[var(--muted)] opacity-50 dark:bg-gray-800'
            : 'border-[var(--line)] bg-white text-[var(--ink)] hover:border-emerald-400 dark:bg-gray-800'
          return (
            <button key={i} onClick={() => choose(opt)} disabled={!!last}
              className={`rounded-xl border-2 px-2 py-2 text-[11px] font-extrabold transition-bouncy press-bubble ${cls}`}>
              {opt}
            </button>
          )
        })}
      </div>
      {last && !last.correct && (
        <p className="mt-2 text-[10px] font-extrabold text-red-500">
          {arabic ? 'الإجابة الصحيحة: ' : 'Correct answer: '}{item.answer}
        </p>
      )}
    </div>
  )
}
