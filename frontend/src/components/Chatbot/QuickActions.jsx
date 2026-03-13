import { useState } from 'react';
import { useSceneStore } from '../../store';
import { focusOnOrgan } from '../../utils/viewerUtils.js';

const CATEGORIES = [
  {
    id: 'organs',
    label: 'Organs',
    actions: [
      { label: 'Heart', focus: 'heart', icon: '❤️' },
      { label: 'Liver', focus: 'liver', icon: '🫀' },
      { label: 'Lungs', focus: 'lung', icon: '🫁' },
      { label: 'Stomach', focus: 'stomach', icon: '🍽️' },
    ],
  },
  {
    id: 'systems',
    label: 'Systems',
    actions: [
      { label: 'Pancreas', focus: 'pancreas', icon: '🔬' },
      { label: 'Spleen', focus: 'spleen', icon: '🔬' },
      { label: 'Thyroid', focus: 'thyroid', icon: '🔬' },
    ],
  },
  {
    id: 'vascular',
    label: 'Vascular',
    actions: [
      { label: 'Vessels', focus: 'artery', icon: '🩸' },
      { label: 'Aorta', focus: 'aorta', icon: '🩸' },
    ],
  },
  {
    id: 'skeletal',
    label: 'Skeletal',
    actions: [
      { label: 'Skeleton', focus: 'clavicle', icon: '🦴' },
      { label: 'Spine', focus: 'spinal-cord', icon: '🦴' },
    ],
  },
];

const MORE_ACTIONS = [
  { label: 'Kidneys', focus: 'kidney', icon: '🫘' },
  { label: 'Esophagus', focus: 'esophagus', icon: '〰️' },
  { label: 'Trachea', focus: 'trachea', icon: '〰️' },
  { label: 'Adrenal', focus: 'adrenal', icon: '🔬' },
];

export function QuickActions() {
  const [activeTab, setActiveTab] = useState('organs');
  const [moreOpen, setMoreOpen] = useState(false);
  const setFocus = useSceneStore((s) => s.setFocus);

  const handleQuickAction = (focus) => {
    setFocus(focus);
    focusOnOrgan(focus);
    setMoreOpen(false);
  };

  const activeCategory = CATEGORIES.find((c) => c.id === activeTab) ?? CATEGORIES[0];

  return (
    <div className="px-4 md:px-5 py-2 md:py-2.5 border-b border-[#E5E7EB] shrink-0 bg-white min-w-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-transparent">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveTab(cat.id)}
            className={`shrink-0 px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-[color_150ms_ease,border-color_150ms_ease] ${
              activeTab === cat.id
                ? 'border-accent text-[#0F172A]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            {cat.label}
          </button>
        ))}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            className={`min-w-[4rem] px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-[color_150ms_ease,border-color_150ms_ease] text-left ${
              moreOpen ? 'border-slate-300 text-[#0F172A]' : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            More
          </button>
          {moreOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                aria-hidden
                onClick={() => setMoreOpen(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 py-1.5 px-1.5 rounded-xl bg-white border border-border shadow-lg min-w-[140px]">
                {MORE_ACTIONS.map((action) => (
                  <button
                    key={action.focus}
                    type="button"
                    onClick={() => handleQuickAction(action.focus)}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium rounded-lg text-text hover:bg-accent/10 hover:text-accent transition-colors flex items-center gap-2"
                  >
                    <span>{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {activeCategory.actions.map((action) => (
          <button
            key={action.focus}
            type="button"
            onClick={() => handleQuickAction(action.focus)}
            className="glass-btn px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[#E5E7EB] hover:border-accent/30 hover:bg-accent/5 hover:text-accent transition-all duration-200 flex items-center gap-1.5"
          >
            <span>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
