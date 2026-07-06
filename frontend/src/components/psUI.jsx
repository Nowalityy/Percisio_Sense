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

/** Cyan ring + sparkle — matches the favicon (PER-64). Hardcoded #00D4FF so the
    mark stays cyan in both themes, on a transparent background (works on the
    light header tile and as the chat AI avatar). */
export function BrandMark({ size = 21 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden style={{ display: 'block' }}>
      <circle cx="8.44" cy="9.56" r="4.15" stroke="#00D4FF" strokeWidth="1.97" />
      <path
        fill="#00D4FF"
        d="M13.64 2.18 C13.886 3.692 14.308 4.114 15.82 4.36 C14.308 4.606 13.886 5.028 13.64 6.54 C13.394 5.028 12.972 4.606 11.46 4.36 C12.972 4.114 13.394 3.692 13.64 2.18 Z"
      />
    </svg>
  );
}
