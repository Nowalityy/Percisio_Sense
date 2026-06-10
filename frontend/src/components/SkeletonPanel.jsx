export function SkeletonPanel({ lines = 3, className = '' }) {
  return (
    <div
      className={`animate-pulse ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 16 }}
    >
      <div style={{ height: 14, width: 128, borderRadius: 4, background: 'var(--elevated)', marginBottom: 12 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            style={{
              height: 11,
              borderRadius: 4,
              background: 'var(--elevated)',
              width: `${60 + ((index * 13) % 30)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
