export function SkeletonPanel({ lines = 3, className = '' }) {
  return (
    <div className={`glass-card p-4 animate-pulse ${className}`}>
      <div className="h-4 w-32 rounded bg-[var(--brand-primary-light)] mb-3" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className="h-3 rounded"
            style={{
              background: 'var(--brand-primary-light)', // BRAND: #62C5EF
              width: `${60 + ((index * 13) % 30)}%`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
