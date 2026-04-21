import { useState, useEffect } from 'react';
import { useSceneStore } from '../../store';
import { focusOnOrgan } from '../../utils/viewerUtils.js';

const TOOL_CARDS = [
  { id: 'measurement', label: 'Measurement', desc: 'Distance and volume tools', icon: '📏' },
  { id: 'annotation', label: 'Annotation', desc: 'Mark and tag findings', icon: '🖊️' },
  { id: 'segmentation', label: 'Segmentation', desc: 'Auto-segment organ groups', icon: '🧠' },
  { id: 'export', label: 'Export', desc: 'Generate DICOM or PDF outputs', icon: '📤' },
  { id: 'compare', label: 'Compare', desc: 'Side-by-side timeline scans', icon: '🧬' },
  { id: 'share', label: 'Share', desc: 'Securely share a case view', icon: '🔗' },
];

const CATEGORIES = [
  {
    id: 'organs',
    label: 'Organs',
    actions: [
      { label: 'Heart', focus: 'heart' },
      { label: 'Liver', focus: 'liver' },
      { label: 'Lungs', focus: 'lung' },
      { label: 'Stomach', focus: 'stomach' },
    ],
  },
  {
    id: 'systems',
    label: 'Systems',
    actions: [
      { label: 'Pancreas', focus: 'pancreas' },
      { label: 'Spleen', focus: 'spleen' },
      { label: 'Thyroid', focus: 'thyroid' },
    ],
  },
  {
    id: 'vascular',
    label: 'Vascular',
    actions: [
      { label: 'Vessels', focus: 'artery' },
      { label: 'Aorta', focus: 'aorta' },
    ],
  },
  {
    id: 'skeletal',
    label: 'Skeletal',
    actions: [
      { label: 'Skeleton', focus: 'clavicle' },
      { label: 'Spine', focus: 'spinal-cord' },
    ],
  },
];

const MORE_ACTIONS = [
  { label: 'Kidneys', focus: 'kidney' },
  { label: 'Esophagus', focus: 'esophagus' },
  { label: 'Trachea', focus: 'trachea' },
  { label: 'Adrenal', focus: 'adrenal' },
];

function segmentClass(active) {
  return `flex-1 min-w-0 py-1.5 px-2 rounded-full text-xs font-medium transition-[background,box-shadow,color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]/35 ${
    active
      ? 'bg-[var(--brand-primary)] text-[var(--text-on-brand)] shadow-[var(--shadow-md)]'
      : 'text-text-secondary hover:text-text'
  }`;
}

/** @param {{ embedded?: boolean }} props */
export function QuickActions({ embedded = false }) {
  const [activeTab, setActiveTab] = useState('organs');
  const [moreOpen, setMoreOpen] = useState(false);
  const setFocus = useSceneStore((s) => s.setFocus);

  const handleQuickAction = (focus) => {
    setFocus(focus);
    focusOnOrgan(focus);
    setMoreOpen(false);
  };

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab) ?? CATEGORIES[0];

  useEffect(() => {
    if (!moreOpen) return;
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [moreOpen]);

  return (
    <div className={`shrink-0 min-w-0 ${embedded ? '' : 'px-4 py-3 border-b border-white/10 bg-white/[0.02]'}`}>
      <p className="text-sm font-semibold text-text mb-2 px-0.5">Clinical Tools</p>

      <div className="grid grid-cols-2 gap-2 mb-4">
        {TOOL_CARDS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            aria-disabled="true"
            disabled
            className="glass-card p-3 text-left group opacity-75 cursor-not-allowed"
            title={`${tool.label} (coming soon)`}
          >
            <span className="text-lg">{tool.icon}</span>
            <p className="mt-2 text-sm text-text font-medium">{tool.label}</p>
            <p className="mt-1 text-[11px] text-text-secondary">{tool.desc}</p>
            <span className="mt-2 inline-block text-xs text-[var(--brand-primary-dark)]">Coming soon</span> {/* BRAND: #62C5EF */}
          </button>
        ))}
      </div>

      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2 px-0.5">Focus shortcuts</p>
      <div className="flex p-[3px] rounded-full bg-white/5 border border-white/10 gap-0 mb-3">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveTab(cat.id)}
            className={segmentClass(activeTab === cat.id)}
          >
            {cat.label}
          </button>
        ))}
        <div className="relative flex-1 min-w-0">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-controls="quick-actions-more-menu"
            className={`${segmentClass(moreOpen)} w-full`}
          >
            More
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMoreOpen(false)} />
              <div
                id="quick-actions-more-menu"
                role="menu"
                className="absolute left-0 right-0 top-full mt-1 z-20 py-1 rounded-xl bg-[#0f172a] border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.28)] overflow-hidden"
              >
                {MORE_ACTIONS.map((action) => (
                  <button
                    key={action.focus}
                    type="button"
                    onClick={() => handleQuickAction(action.focus)}
                    role="menuitem"
                    className="w-full text-left px-4 py-2.5 text-sm text-text active:bg-white/[0.04] border-b border-white/10 last:border-0"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden divide-y divide-white/10">
        {activeCategory.actions.map((action) => (
          <button
            key={action.focus}
            type="button"
            onClick={() => handleQuickAction(action.focus)}
            className="w-full text-left px-4 py-3 min-h-[42px] text-sm text-text flex items-center justify-between active:bg-white/[0.04]"
          >
            {action.label}
            <span className="text-slate-400 text-xl font-extralight">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
