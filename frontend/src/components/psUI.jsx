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

export function Badge({ cls = 'gray', dot = false, fill = false, children, style }) {
  return (
    <span className={`ps-bdg ${fill ? 'fill-' + cls : 'bdg-' + cls}`} style={style}>
      {dot && <span className={`ps-dot dot-${cls}`} />}
      {children}
    </span>
  );
}

/** Cyan reticle / crosshair-on-target — the Percisio brand mark. */
export function BrandMark({ size = 21 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ display: 'block' }}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3.4" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.2 1.8" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
