export default function Logo({ size = 40, withWordmark = false, wordmarkHeight }) {
  const markH = size
  const wordH = wordmarkHeight || Math.round(size * 0.72)

  return (
    <span className="inline-flex items-center gap-2" aria-label="Shaghoof">
      <img
        src="/brand/shaghoof-mark-clear.png"
        alt="Shaghoof"
        width={markH}
        height={markH}
        className="brand-mark shrink-0 object-contain"
        style={{ width: markH, height: markH }}
      />
      {withWordmark && (
        <img
          src="/brand/shaghoof-wordmark-clear.png"
          alt="Shaghoof"
          className="brand-wordmark object-contain object-left"
          style={{ height: wordH, width: 'auto' }}
        />
      )}
    </span>
  )
}
