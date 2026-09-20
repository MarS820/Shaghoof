import { useEffect, useRef, useState } from 'react'
import Mascot from './Mascot'

let mermaidPromise = null
let mermaidInstance = null
let mermaidId = 0

async function getMermaid() {
  if (mermaidInstance) return mermaidInstance
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then((mod) => {
      const m = mod.default
      m.initialize({
        startOnLoad: false,
        theme: 'default',
        securityLevel: 'loose',
        fontFamily: 'Inter, Cairo, system-ui, sans-serif',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
        themeVariables: {
          primaryColor: '#EFF6FF',
          primaryBorderColor: '#2563EB',
          primaryTextColor: '#0F172A',
          lineColor: '#94A3B8',
          secondaryColor: '#F3E8FF',
          tertiaryColor: '#F0FDF4',
          fontSize: '14px',
        },
      })
      mermaidInstance = m
      return m
    })
  }
  return mermaidPromise
}

function MermaidDiagram({ code }) {
  const ref = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const id = `mermaid-${++mermaidId}`
    getMermaid().then((m) => m.render(id, code)).then(({ svg }) => setSvg(svg)).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [code])

  if (loading) {
    return <div className="my-3 flex items-center justify-center rounded-xl border border-[var(--line)] bg-white p-6 dark:bg-[var(--surface)]"><div className="loading-dots"><span /><span /><span /></div></div>
  }

  if (error) {
    return (
      <div className="my-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
        <p className="font-bold">Diagram error:</p>
        <pre className="mt-1 whitespace-pre-wrap opacity-80">{error}</pre>
      </div>
    )
  }

  return (
    <div ref={ref} className="my-3 overflow-x-auto rounded-xl border border-[var(--line)] bg-white p-4 shadow-sm dark:bg-[var(--surface)]" dangerouslySetInnerHTML={{ __html: svg }} />
  )
}

function parseMessage(content) {
  // Split on ```mermaid ... ``` blocks
  const parts = []
  const regex = /```mermaid\n([\s\S]*?)```/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: content.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mermaid', value: match[1].trim() })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', value: content.slice(lastIndex) })
  }

  return parts.length ? parts : [{ type: 'text', value: content }]
}

function renderText(text) {
  // Simple markdown-ish rendering: **bold**, bullet lists
  const lines = text.split('\n')
  const elements = []
  let inList = false
  let listItems = []

  const flushList = () => {
    if (listItems.length) {
      elements.push(
        <ul key={`list-${elements.length}`} className="my-2 space-y-1 ps-4 list-disc text-sm text-[var(--ink)]/80">
          {listItems.map((item, i) => <li key={i}>{renderInline(item)}</li>)}
        </ul>
      )
      listItems = []
    }
    inList = false
  }

  lines.forEach((line, i) => {
    const trimmed = line.trim()
    if (/^[\*\-\•]\s/.test(trimmed)) {
      inList = true
      listItems.push(trimmed.replace(/^[\*\-\•]\s/, ''))
    } else {
      flushList()
      if (trimmed) {
        elements.push(<p key={`p-${elements.length}`} className="text-sm leading-relaxed text-[var(--ink)]">{renderInline(trimmed)}</p>)
      }
    }
  })
  flushList()

  return elements
}

function renderInline(text) {
  // **bold** → <strong>
  const parts = []
  const regex = /\*\*(.*?)\*\*/g
  let last = 0
  let m
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index))
    parts.push(<strong key={m.index} className="font-extrabold text-[var(--ink)]">{m[1]}</strong>)
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push(text.slice(last))
  return parts.length ? parts : text
}

export default function ChatMessage({ msg, index, onSpeak, speakingId }) {
  const isUser = msg.role === 'user'
  const parts = parseMessage(msg.content)

  return (
    <div className={`animate-bubble-in flex gap-2 ${isUser ? 'justify-end' : ''}`} style={{ animationDelay: '0.02s' }}>
      {!isUser && <Mascot size={22} animate={false} mood={null} />}
      <div className={`chat-bubble-${isUser ? 'user' : 'bot'} max-w-[85%]`}>
        {parts.map((part, i) =>
          part.type === 'mermaid' ? (
            <MermaidDiagram key={i} code={part.value} />
          ) : (
            <div key={i}>{renderText(part.value)}</div>
          )
        )}
        {!isUser && (
          <div className="mt-1.5 flex gap-2 opacity-70">
            <button onClick={() => onSpeak(msg.content, `msg-${index}`)} className="text-[10px] font-bold hover:opacity-100" title="Text-to-speech">
              {speakingId === `msg-${index}` ? '⏹ Stop' : '🔊 Listen'}
            </button>
            <button onClick={() => navigator.clipboard?.writeText(msg.content)} className="text-[10px] font-bold hover:opacity-100">📋 Copy</button>
          </div>
        )}
      </div>
    </div>
  )
}
