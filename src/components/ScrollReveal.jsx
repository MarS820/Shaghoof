import { useEffect, useRef } from 'react'

/**
 * Wraps children with IntersectionObserver to add scroll-reveal classes.
 * Usage:
 *   <ScrollReveal className="scroll-reveal">...</ScrollReveal>
 *   <ScrollReveal variant="scale">...</ScrollReveal>
 *   <ScrollReveal stagger>{items.map(...)}</ScrollReveal>
 */
export default function ScrollReveal({ children, variant = 'up', stagger = false, className = '', threshold = 0.15, ...props }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('revealed')
          observer.unobserve(el)
        }
      },
      { threshold, rootMargin: '0px 0px -40px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])

  const variantClass = {
    up: 'scroll-reveal',
    scale: 'scroll-reveal-scale',
    left: 'scroll-reveal-left',
    right: 'scroll-reveal-right',
  }[variant] || 'scroll-reveal'

  return (
    <div
      ref={ref}
      className={`${variantClass} ${stagger ? 'scroll-stagger' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
