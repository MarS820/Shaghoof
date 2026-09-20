import { useState } from 'react'

/**
 * VisualLessonRenderer — VARK "visual" + T3/T5 UI.
 * Ported from SHAGHOOF-AI-main's VisualRenderer, but every node, card and
 * description is derived from the student's OWN lesson (key concepts,
 * objectives, sections) — never from a hardcoded demo topic.
 */
export default function VisualLessonRenderer({ lesson, arabic, onAskTutor, onXp }) {
  const concepts = (lesson?.key_concepts || [])
    .map((c) => (typeof c === 'string' ? c : (c && c.text) || '').trim())
    .filter(Boolean)
    .slice(0, 6)
  const objectives = (lesson?.learning_objectives || []).slice(0, 4)

  const [selected, setSelected] = useState(null)

  if (!concepts.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--line)] p-6 text-center text-xs font-semibold text-[var(--muted)]">
        {arabic ? 'لا توجد مفاهيم كافية في هذا الدرس لبناء الخريطة.' : 'This lesson has no key concepts to map yet.'}
      </div>
    )
  }

  // Deterministic SVG layout: two rows, stable positions per concept.
  const nodes = concepts.map((label, idx) => {
    const row = idx < Math.ceil(concepts.length / 2) ? 0 : 1
    const inRow = row === 0 ? Math.min(Math.ceil(concepts.length / 2), concepts.length) : concepts.length - Math.ceil(concepts.length / 2)
    const idxInRow = row === 0 ? idx : idx - Math.ceil(concepts.length / 2)
    const x = 300 + (idxInRow - (inRow - 1) / 2) * (520 / Math.max(inRow, 1))
    const y = row === 0 ? 70 : 175
    const palette = ['#7C3AED', '#0284C7', '#FF4D2D', '#0D9488', '#D97706', '#DB2777']
    const concept = concepts[idx]
    // The section text mentioning this concept becomes the inspector detail.
    const detailSection = (lesson.sections || []).find((s) => s.type === 'paragraph' && s.text && s.text.toLowerCase().includes(concept.toLowerCase()))
    return { id: `n${idx}`, label, x, y, color: palette[idx % palette.length], detail: detailSection?.text || (objectives[idx] ? String(objectives[idx]) : '') }
  })

  const askAbout = (node) => {
    onXp?.(5, arabic ? 'استكشاف بصري' : 'Visual explorer')
    onAskTutor?.(arabic
      ? `اشرح لي "${node.label}" من هذا الدرس بمثال بسيط.`
      : `Explain "${node.label}" from this lesson with a simple example.`)
  }

  return (
    <div className="space-y-3">
      {objectives.length > 0 && (
        <div className="animate-bubble-in rounded-2xl border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
          <p className="mb-1.5 text-xs font-extrabold text-blue-700 dark:text-blue-300">🎯 {arabic ? 'أهداف الدرس' : 'Learning objectives'}</p>
          <ul className="space-y-1">
            {objectives.map((o) => <li key={o} className="text-xs font-medium text-blue-600 dark:text-blue-200">• {o}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-4">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-wide text-[var(--brand)]">🗺️ {arabic ? 'خريطة المفاهيم التفاعلية' : 'Interactive concept map'}</p>
        <svg className="h-64 w-full" viewBox="0 0 600 240" role="img" aria-label={arabic ? 'خريطة مفاهيم الدرس' : 'Lesson concept map'}>
          <g stroke="var(--line)" strokeWidth="2" strokeDasharray="5,5">
            {nodes.slice(1).map((n) => (
              <line key={n.id} x1={nodes[0].x} y1={nodes[0].y} x2={n.x} y2={n.y} opacity="0.5" />
            ))}
          </g>
          {nodes.map((node) => {
            const isSel = selected?.id === node.id
            return (
              <g key={node.id} onClick={() => setSelected(node)} className="cursor-pointer" role="button" tabIndex={0}
                 onKeyDown={(e) => e.key === 'Enter' && setSelected(node)}
                 aria-label={node.label}>
                <circle cx={node.x} cy={node.y} r={isSel ? 32 : 28} fill="var(--surface)" stroke={node.color} strokeWidth={isSel ? 4 : 2.5} className="transition-all" />
                <circle cx={node.x} cy={node.y} r={isSel ? 26 : 22} fill={node.color} opacity={isSel ? 0.95 : 0.85} />
                <text x={node.x} y={node.y + 4} fill="#fff" fontSize={node.label.length > 12 ? 8 : 9.5} textAnchor="middle" fontWeight="bold">
                  {node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}
                </text>
              </g>
            )
          })}
        </svg>

        {selected && (
          <div className="animate-bubble-in mt-3 rounded-xl border border-[var(--line)] bg-[var(--page)] p-3">
            <p className="text-xs font-extrabold text-[var(--ink)]">{selected.label}</p>
            <p className="mt-1 line-clamp-4 text-[11px] leading-relaxed text-[var(--muted)]">
              {selected.detail || (arabic ? 'حدد مفهوماً واطلب من المعلّم شرحه.' : 'Select a node and ask the tutor to explain it.')}
            </p>
            <button onClick={() => askAbout(selected)} className="mt-2 rounded-full bg-[var(--brand-light)] px-3 py-1 text-[11px] font-extrabold text-[var(--brand)] transition-bouncy hover:scale-105 press-bubble">
              💬 {arabic ? 'اسأل المعلّم عن هذا' : 'Ask the AI Tutor'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
