import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'motion/react'

const DEFAULT_SPRING = { stiffness: 400, damping: 25, mass: 0.4 }

function gaussian(d, magnification, distance) {
  return (magnification - 1) * Math.exp(-(d * d) / (2 * distance * distance)) + 1
}

function DockIcon({ item, mouseX, magnification, distance, iconSize, borderRadius, springOptions, onHover, iconRef }) {
  const wrapperRef = useRef(null)

  const distanceFromMouse = useTransform(mouseX, (val) => {
    const el = wrapperRef.current
    if (!el) return distance * 100
    const rect = el.getBoundingClientRect()
    return Math.abs(val - (rect.left + rect.width / 2))
  })

  const widthRaw = useTransform(distanceFromMouse, (d) => iconSize * gaussian(d, magnification, distance))
  const heightRaw = useTransform(distanceFromMouse, (d) => iconSize * gaussian(d, magnification, distance))

  const width = useSpring(widthRaw, springOptions)
  const height = useSpring(heightRaw, springOptions)

  const Tag = item.href ? 'a' : 'button'

  return (
    <motion.div ref={wrapperRef} className="relative flex items-end justify-center" style={{ width, height: iconSize + 16 }}>
      <motion.div ref={iconRef} style={{ width, height: iconSize, bottom: 16 }} className="absolute">
        <Tag
          href={item.href}
          onClick={item.onClick}
          onMouseEnter={() => onHover(iconRef)}
          onMouseLeave={() => onHover(null)}
          aria-label={item.label}
          aria-current={item.active ? 'page' : undefined}
          style={{ borderRadius }}
          className={`flex h-full w-full items-center justify-center transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--brand)]/30 [&_svg]:size-[55%] [&>span]:text-base ${
            item.active
              ? 'bg-white text-[var(--brand)] shadow-md dark:bg-white/15 dark:text-[var(--brand)]'
              : 'text-[var(--ink)]/60 hover:bg-white/50 hover:text-[var(--ink)] dark:text-[var(--ink)]/50 dark:hover:bg-white/10 dark:hover:text-[var(--ink)]'
          } ${item.className || ''}`}
        >
          {item.icon}
        </Tag>
      </motion.div>
      {item.label && (
        <span className="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap text-[8px] font-bold leading-none text-[var(--muted)] dark:text-[var(--ink)]/50 pointer-events-none max-w-[52px] truncate text-center">
          {item.label}
        </span>
      )}
    </motion.div>
  )
}

export default function Dock({ items, magnification = 1.8, distance = 120, iconSize = 40, gap = 4, borderRadius = 16, springOptions = DEFAULT_SPRING, className = '' }) {
  const mouseX = useMotionValue(Infinity)
  const dockRef = useRef(null)
  const iconRefs = useRef(items.map(() => ({ current: null })))

  const [hoveredIndex, setHoveredIndex] = useState(null)
  const [tooltipX, setTooltipX] = useState(0)
  const [tooltipBottomOffset, setTooltipBottomOffset] = useState(0)

  useEffect(() => {
    if (hoveredIndex === null) return
    let raf
    const update = () => {
      const iconEl = iconRefs.current[hoveredIndex]?.current
      const dockEl = dockRef.current
      if (iconEl && dockEl) {
        const iconRect = iconEl.getBoundingClientRect()
        const dockRect = dockEl.getBoundingClientRect()
        setTooltipX(iconRect.left - dockRect.left + iconRect.width / 2)
        setTooltipBottomOffset(dockRect.bottom - iconRect.top)
      }
      raf = requestAnimationFrame(update)
    }
    raf = requestAnimationFrame(update)
    return () => cancelAnimationFrame(raf)
  }, [hoveredIndex])

  const handleHover = useCallback((ref) => {
    if (ref === null) { setHoveredIndex(null); return }
    const idx = iconRefs.current.findIndex((r) => r === ref)
    setHoveredIndex(idx >= 0 ? idx : null)
  }, [])

  if (iconRefs.current.length !== items.length) {
    iconRefs.current = items.map((_, i) => iconRefs.current[i] || { current: null })
  }

  return (
    <motion.div
      ref={dockRef}
      className={`relative flex items-end overflow-visible ${className}`}
      style={{ gap, borderRadius }}
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      {items.map((item, i) => (
        <DockIcon
          key={i}
          item={item}
          mouseX={mouseX}
          magnification={magnification}
          distance={distance}
          iconSize={iconSize}
          borderRadius={borderRadius}
          springOptions={springOptions}
          onHover={handleHover}
          iconRef={iconRefs.current[i]}
        />
      ))}

      <AnimatePresence>
        {hoveredIndex !== null && (
          <motion.div
            key="dock-tooltip"
            layoutId="dock-tooltip"
            className="pointer-events-none absolute flex flex-col items-center z-50"
            style={{ left: tooltipX, bottom: tooltipBottomOffset + 8, x: '-50%' }}
            initial={{ opacity: 0, y: 6, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.94 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
          >
            <span className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-sm font-bold text-[var(--ink)] shadow-sm whitespace-nowrap dark:bg-[var(--surface)] dark:text-[var(--ink)]">
              {items[hoveredIndex].label}
            </span>
            <svg width="8" height="4" viewBox="0 0 8 4" className="-mt-px text-white dark:text-[var(--surface)]" aria-hidden>
              <path d="M0 0L4 4L8 0" fill="currentColor" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
