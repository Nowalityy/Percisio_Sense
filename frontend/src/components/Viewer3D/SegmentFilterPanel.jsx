import { useState, useMemo } from 'react';
import { useSceneStore } from '../../store';
import { SEGMENTS, getSegmentColor } from './medicalColors';

const SEGMENT_CATEGORIES = {
  organs: {
    label: 'Organes',
    keywords: ['heart', 'liver', 'lung', 'stomach', 'pancreas', 'spleen', 'thyroid', 'adrenal', 'esophagus', 'trachea'],
  },
  bones: {
    label: 'Os',
    keywords: ['clavicle', 'scapula', 'humerus', 'sternum', 'spinal-cord'],
  },
  vessels: {
    label: 'Vaisseaux',
    keywords: ['aorta', 'artery', 'vein', 'vena-cava', 'brachiocephalic', 'carotid', 'subclavian', 'pulmonary', 'portal'],
  },
  muscles: {
    label: 'Muscles',
    keywords: ['muscle'],
  },
  other: {
    label: 'Autres',
    keywords: ['segment_1'],
  },
};

function getSegmentCategory(segmentName) {
  const lower = segmentName.toLowerCase();
  for (const [category, { keywords }] of Object.entries(SEGMENT_CATEGORIES)) {
    if (keywords.some((keyword) => lower.includes(keyword))) {
      return category;
    }
  }
  return 'other';
}

function SegmentItem({ segmentName, isVisible, onToggle }) {
  const color = getSegmentColor(segmentName);
  const category = getSegmentCategory(segmentName);

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-gray-50 transition-colors cursor-pointer ${
        !isVisible ? 'opacity-50' : ''
      }`}
      onClick={() => onToggle(segmentName)}
    >
      <input
        type="checkbox"
        checked={isVisible}
        onChange={() => onToggle(segmentName)}
        className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent cursor-pointer"
        onClick={(e) => e.stopPropagation()}
      />
      <div
        className="w-3 h-3 rounded-full border border-gray-300"
        style={{ backgroundColor: color }}
      />
      <span className="flex-1 text-sm text-gray-700 capitalize">
        {segmentName.replace(/-/g, ' ')}
      </span>
      <span className="text-xs text-gray-400 px-1.5 py-0.5 rounded bg-gray-100">
        {SEGMENT_CATEGORIES[category]?.label || 'Autre'}
      </span>
    </div>
  );
}

function QuickFilterButton({ label, onClick, active }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
        active
          ? 'bg-accent text-white'
          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
      }`}
    >
      {label}
    </button>
  );
}

export function SegmentFilterPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState(null);

  const segmentVisibility = useSceneStore((s) => s.segmentVisibility);
  const toggleSegmentVisibility = useSceneStore((s) => s.toggleSegmentVisibility);
  const setAllSegmentsVisibility = useSceneStore((s) => s.setAllSegmentsVisibility);

  const filteredSegments = useMemo(() => {
    let filtered = SEGMENTS;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((name) => name.toLowerCase().includes(query));
    }

    if (activeCategory) {
      const keywords = SEGMENT_CATEGORIES[activeCategory]?.keywords || [];
      filtered = filtered.filter((name) =>
        keywords.some((keyword) => name.toLowerCase().includes(keyword))
      );
    }

    return filtered;
  }, [searchQuery, activeCategory]);

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
        className="absolute top-4 right-4 z-30 px-3 py-2 bg-white rounded-lg shadow-md border border-gray-200 hover:bg-gray-50 transition-colors flex items-center gap-2 text-sm font-medium text-gray-700"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filtres
      </button>
    );
  }

  return (
    <div className="absolute top-4 right-4 z-30 w-80 bg-white rounded-xl shadow-xl border border-gray-200 flex flex-col max-h-[80vh]">
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Filtrage des segments</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
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

      <div className="px-4 py-3 border-b border-gray-200">
        <input
          type="text"
          placeholder="Rechercher un segment..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        />
      </div>

      <div className="px-4 py-2 border-b border-gray-200 flex flex-wrap gap-2">
        {Object.entries(SEGMENT_CATEGORIES).map(([key, { label }]) => (
          <QuickFilterButton
            key={key}
            label={label}
            active={activeCategory === key}
            onClick={() => handleQuickFilter(key)}
          />
        ))}
      </div>

      <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
        <span className="text-xs text-gray-600">
          {visibleCount} / {filteredSegments.length} visibles
        </span>
        <div className="flex gap-2">
          <button
            onClick={handleShowAll}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Tout afficher
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={handleHideAll}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium"
          >
            Tout masquer
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
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
