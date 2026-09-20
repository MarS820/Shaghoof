import { useApp } from '../context/AppContext'

export default function BrainWheel({ data, selectedStyle, onSelectStyle }) {
  const { lang } = useApp()
  if (!data || !data.values || data.values.length !== 4) return null

  const labels = [lang === 'ar' ? 'بصري' : 'Visual', lang === 'ar' ? 'سمعي' : 'Auditory', lang === 'ar' ? 'قرائي' : 'Reading', lang === 'ar' ? 'حركي' : 'Kinesthetic']
  const styles = ['visual', 'auditory', 'reading', 'kinesthetic']
  const colors = ['#3B6CFF', '#F43F8E', '#35C98A', '#FF8A3D']
  // use backend labels if language matches; fallback simple
  const size = 300
  const center = size / 2
  const radius = 110

  const angle = (i) => (Math.PI / 2) + (2 * Math.PI * i) / 4

  const point = (i, value) => {
    const a = angle(i)
    const r = (value / 100) * radius
    return {
      x: center + r * Math.cos(a),
      y: center - r * Math.sin(a),
    }
  }

  const polyPoints = data.values
    .map((v, i) => {
      const p = point(i, v)
      return `${p.x},${p.y}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-56 w-56" role="img" aria-label="Brain wheel">
      {/* Grid rings */}
      {[25, 50, 75, 100].map((level) => {
        const pts = [0, 1, 2, 3]
          .map((i) => {
            const p = point(i, level)
            return `${p.x},${p.y}`
          })
          .join(' ')
        return (
          <polygon
            key={level}
            points={pts}
            fill="none"
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth="1"
          />
        )
      })}

      {/* Axes */}
      {[0, 1, 2, 3].map((i) => {
        const a = angle(i)
        const x = center + radius * Math.cos(a)
        const y = center - radius * Math.sin(a)
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            className="stroke-gray-200 dark:stroke-gray-700"
            strokeWidth="1"
          />
        )
      })}

      {/* Data polygon */}
      <polygon
        points={polyPoints}
        fill="rgba(139,92,246,0.25)"
        stroke="#8B5CF6"
        strokeWidth="2"
      />
      <circle cx={center} cy={center} r="28" className="fill-white dark:fill-gray-900" />
      <text x={center} y={center - 2} textAnchor="middle" style={{ fill: '#8B5CF6' }} className="text-[10px] font-extrabold">VARK</text>
      <text x={center} y={center + 12} textAnchor="middle" className="fill-gray-500 dark:fill-gray-400 text-[8px] font-bold">{data.badge || 'PROFILE'}</text>
      {data.values.map((v, i) => {
        const p = point(i, v)
        return <circle key={i} cx={p.x} cy={p.y} r={selectedStyle === styles[i] ? '7' : '4'} fill={colors[i]} className="transition-all" />
      })}

      {/* Labels */}
      {labels.map((label, i) => {
        const a = angle(i)
        const x = center + (radius + 28) * Math.cos(a)
        const y = center - (radius + 28) * Math.sin(a)
        const value = data.values[i]
        const isWeakest = data.weakest === data.labels[i]?.toLowerCase?.()
        const isDominant = data.dominant === data.labels[i]?.toLowerCase?.()
        return (
          <g key={i} role="button" tabIndex="0" className="cursor-pointer" onClick={() => onSelectStyle?.(selectedStyle === styles[i] ? null : styles[i])} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onSelectStyle?.(styles[i]) }}>
            <text
              x={x}
              y={y - 7}
              textAnchor="middle"
              className={`${selectedStyle === styles[i] ? 'fill-violet-600 dark:fill-violet-300' : 'fill-gray-700 dark:fill-gray-300'} text-[12px] font-bold`}
            >
              {label}
            </text>
            <text
              x={x}
              y={y + 8}
              textAnchor="middle"
              className={`${isWeakest ? 'text-[11px] font-semibold' : isDominant ? 'text-[11px] font-semibold' : 'fill-gray-400 text-[11px] font-semibold'}`}
              style={isWeakest ? { fill: '#FF8A3D' } : isDominant ? { fill: '#35C98A' } : {}}
            >
              {Math.round(value)}%
            </text>
          </g>
        )
      })}
    </svg>
  )
}
