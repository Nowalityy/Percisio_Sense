import { useState, useMemo, useEffect } from 'react';
import { useSceneStore } from '../../store';
import { getSegmentListForSet } from '../../segmentList';
import { getSegmentColor, isSkinSegment } from './medicalColors';
import { PERFORMANCE_CONFIG } from '../../performance.config';
import { SEGMENT_CATEGORIES, getSegmentCategory } from '../../viewer-core/segmentRules';

function SegmentItem({ segmentName, isVisible, onToggle }) {
  const color = getSegmentColor(segmentName);
  const category = getSegmentCategory(segmentName);

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer transition-colors hover:bg-white/10 ${
        !isVisible ? 'opacity-50' : ''
      }`}
      onClick={() => onToggle(segmentName)}
    >
      <input
        type="checkbox"
        checked={isVisible}
        onChange={() => onToggle(segmentName)}
        className="w-4 h-4 rounded border-slate-300/30 text-[#00D4FF] bg-transparent focus:ring-[#00D4FF] cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="w-3 h-3 rounded-full border border-slate-300/30"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-sm text-text capitalize">
        {segmentName.replace(/-/g, ' ')}
      </span>
      <span className="text-xs text-text-secondary px-1.5 py-0.5 rounded bg-white/5 border border-white/10">
        {SEGMENT_CATEGORIES[category]?.label || 'Autre'}
      </span>
    </div>
  );
}

function QuickFilterButton({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
        active
          ? 'bg-[#00D4FF] text-[#00222B]'
          : 'glass-btn text-text-secondary'
      }`}
    >
      {label}
    </button>
  );
}

export function SegmentFilterPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const anatomySegmentSet = useSceneStore((s) => s.anatomySegmentSet);
  const toggleSegmentVisibility = useSceneStore((s) => s.toggleSegmentVisibility);
  const skinOpacity = useSceneStore((s) => s.skinOpacity);
  const setSkinOpacity = useSceneStore((s) => s.setSkinOpacity);
  const segmentList = useMemo(
    () => getSegmentListForSet(anatomySegmentSet),
    [anatomySegmentSet]
  );
  const skinSegmentName = useMemo(
    () => segmentList.find((name) => isSkinSegment(name)) ?? null,
    [segmentList]
  );
  const isSkinVisible = skinSegmentName
    ? segmentVisibility.get(skinSegmentName) !== false
    : false;

  useEffect(() => {
    // PERF: Debounce expensive filter queries to avoid rapid list recompute.
    const timer = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, PERFORMANCE_CONFIG.FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  const filteredSegments = useMemo(() => {
    let filtered = segmentList;

    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter((name) => name.toLowerCase().includes(query));
    }

    if (activeCategory) {
      const keywords = SEGMENT_CATEGORIES[activeCategory]?.keywords || [];
      filtered = filtered.filter((name) =>
        keywords.some((keyword) => name.toLowerCase().includes(keyword))
      );
    }

    return filtered;
  }, [segmentList, debouncedSearchQuery, activeCategory]);

  const visibleCount = useMemo(() => {
    let count = 0;
    filteredSegments.forEach((name) => {
      if (segmentVisibility.get(name) !== false) {
        count++;
      }
    });
    return count;
  }, [filteredSegments, segmentVisibility]);

  const handleQuickFilter = (category) => {
    if (activeCategory === category) {
      setActiveCategory(null);
      return;
    }
    setActiveCategory(category);
  };

  const handleShowAll = () => {
    filteredSegments.forEach((name) => {
      if (segmentVisibility.get(name) === false) {
        toggleSegmentVisibility(name);
      }
    });
  };

  const handleHideAll = () => {
    filteredSegments.forEach((name) => {
      if (segmentVisibility.get(name) !== false) {
        toggleSegmentVisibility(name);
      }
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="av-chip"
        title="Filter segments"
        aria-label="Filter segments"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filters
      </button>
    );
  }

  return (
    <div className="absolute top-11 right-0 z-40 w-80 glass-card flex flex-col max-h-[78vh]">
      <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Segment Filtering</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-400 hover:text-slate-100 transition-colors"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="px-4 py-3 border-b border-white/10">
        <input
          type="text"
          placeholder="Search for a segment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="glass-input w-full px-3 py-2 text-sm rounded-xl"
        />
      </div>

      {skinSegmentName && (
        <div className="px-4 py-3 border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <label
              htmlFor="skin-opacity-slider"
              className="text-xs font-medium text-text-secondary flex items-center gap-1.5"
            >
              <span
                className="size-3 rounded-full border border-white/20"
                style={{ backgroundColor: getSegmentColor(skinSegmentName) }}
                aria-hidden
              />
              Skin opacity
            </label>
            <span className="text-xs tabular-nums text-text-secondary w-9 text-right">
              {Math.round(skinOpacity * 100)}%
            </span>
          </div>
          <input
            id="skin-opacity-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={skinOpacity}
            onChange={(e) => setSkinOpacity(parseFloat(e.target.value))}
            disabled={!isSkinVisible}
            className="w-full accent-[#00D4FF] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            aria-label="Skin opacity"
          />
          {!isSkinVisible && (
            <p className="text-[10px] text-text-secondary leading-snug">
              Skin segment hidden — toggle it on below to see opacity changes.
            </p>
          )}
        </div>
      )}

      <div className="px-4 py-2 border-b border-white/10 flex flex-wrap gap-2">
        {Object.entries(SEGMENT_CATEGORIES).map(([key, { label }]) => (
          <QuickFilterButton
            key={key}
            label={label}
            active={activeCategory === key}
            onClick={() => handleQuickFilter(key)}
          />
        ))}
      </div>

      <div className="px-4 py-2 border-b border-white/10 flex items-center justify-between">
        <span className="text-xs text-text-secondary">
          {visibleCount} / {filteredSegments.length} visible
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleShowAll}
            className="text-xs text-[#00D4FF] hover:opacity-80 font-medium"
          >
            Show All
          </button>
          <span className="text-slate-500">|</span>
          <button
            onClick={handleHideAll}
            className="text-xs text-text-secondary hover:text-text font-medium"
          >
            Hide All
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 app-scrollbar">
        <div className="space-y-1">
          {filteredSegments.map((segmentName) => (
            <SegmentItem
              key={segmentName}
              segmentName={segmentName}
              isVisible={segmentVisibility.get(segmentName) !== false}
              onToggle={toggleSegmentVisibility}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
