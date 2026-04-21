export const PERFORMANCE_CONFIG = {
  // PERF: Cap pixel density to avoid retina overdraw.
  MAX_DPR: 1.5,
  // PERF: Lower AA quality on weak CPUs.
  LOW_END_CPU_CORES: 4,
  // PERF: Throttle interactive updates at 60 FPS.
  FRAME_THROTTLE_MS: 16,
  // PERF: Debounce filter operations to avoid rapid scene churn.
  FILTER_DEBOUNCE_MS: 150,
  // PERF: Debounce chat input-derived work.
  CHAT_DEBOUNCE_MS: 300,
  // PERF: Cache deduplication window for AI responses.
  API_CACHE_TTL_MS: 60_000,
  // PERF: Keep cache bounded to avoid memory growth.
  API_CACHE_MAX_ENTRIES: 20,
  // PERF: Single in-flight request to limit pressure.
  API_MAX_INFLIGHT: 1,
} as const;

export type PerformanceConfig = typeof PERFORMANCE_CONFIG;
