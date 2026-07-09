/* Percisio Sense — shared UI atoms (ported from the design's ui.jsx).
   Icons use the Tabler webfont loaded in index.html. */

export function Icon({ name, size = 16, color, style = {}, className = '', ...rest }) {
  return (
    <i
      className={`ti ti-${name} ${className}`}
      style={{ fontSize: size, color, lineHeight: 1, display: 'inline-flex', ...style }}
      aria-hidden
      {...rest}
    />
  );
}

/** Four-point sparkle glyph — assistant trigger spec (PER-77).
    Single smooth concave star, fills `currentColor` so the button's CSS
    states (default/hover/pressed/focus/disabled) drive its colour. */
export function SparkIcon({ size = 18, style, ...rest }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      style={{ display: 'block', ...style }}
      {...rest}
    >
      <path d="M12 1.55c.1-.54.77-.54.87 0 .8 4.6 3.06 6.94 7.72 7.9.53.1.53.99 0 1.1-4.66.96-6.92 3.3-7.72 7.9-.1.54-.77.54-.87 0-.8-4.6-3.06-6.94-7.72-7.9-.53-.11-.53-1 0-1.1 4.66-.96 6.92-3.3 7.72-7.9Z" />
    </svg>
  );
}

export function Badge({ cls = 'gray', dot = false, fill = false, children, style }) {
  return (
    <span className={`ps-bdg ${fill ? 'fill-' + cls : 'bdg-' + cls}`} style={style}>
      {dot && <span className={`ps-dot dot-${cls}`} />}
      {children}
    </span>
  );
}

/** Cyan reticle / crosshair-on-target — inlined `assets/percisio-mark.svg`
    from the design handoff (stroke #00D4FF hardcoded in the asset, so the
    mark stays cyan in both themes, exactly like the design). */
export function BrandMark({ size = 21 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden style={{ display: 'block' }}>
      <circle cx="9" cy="9" r="7" stroke="#00D4FF" strokeWidth="1" />
      <circle cx="9" cy="9" r="3.5" stroke="#00D4FF" strokeWidth="0.8" strokeDasharray="2 1.5" />
      <line x1="2" y1="9" x2="5" y2="9" stroke="#00D4FF" strokeWidth="1" />
      <line x1="13" y1="9" x2="16" y2="9" stroke="#00D4FF" strokeWidth="1" />
      <line x1="9" y1="2" x2="9" y2="5" stroke="#00D4FF" strokeWidth="1" />
      <line x1="9" y1="13" x2="9" y2="16" stroke="#00D4FF" strokeWidth="1" />
    </svg>
  );
}
