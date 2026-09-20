export default function ProgressRing({ value = 0, max = 100, size = 64, strokeWidth = 5, label, color }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const percent = Math.min(Math.max(value / max, 0), 1)
  const offset = circumference - percent * circumference

  const gradientId = `ring-${Math.random().toString(36).slice(2, 8)}`

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color || 'var(--brand)'} />
            <stop offset="100%" stopColor={color ? color : 'var(--accent-purple)'} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--line)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-extrabold text-gray-800 dark:text-gray-100" style={{ fontSize: size * 0.22 }}>
          {Math.round(percent * 100)}%
        </span>
        {label && <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500" style={{ fontSize: size * 0.13 }}>{label}</span>}
      </div>
    </div>
  )
}
