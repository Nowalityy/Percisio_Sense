import { useState } from 'react';
import { useSceneStore } from '../../store';
import { focusOnOrgan } from '../../utils/viewerUtils.js';

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
  return `flex-1 min-w-0 py-1.5 px-2 rounded-[7px] text-[13px] font-medium transition-[background,box-shadow,color] duration-200 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-[#007aff]/35 ${
    active
      ? 'bg-white text-[#1c1c1e] shadow-[0_1px_3px_rgba(0,0,0,0.08)]'
      : 'text-[#8e8e93] hover:text-[#636366]'
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

  return (
    <div className={`shrink-0 min-w-0 ${embedded ? '' : 'px-4 py-3 border-b border-black/[0.08] bg-white'}`}>
      <p className="text-[13px] font-semibold text-[#8e8e93] mb-2 px-0.5">3D focus</p>
      <div className="flex p-[3px] rounded-[9px] bg-[#00000014] gap-0 mb-3">
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
            className={`${segmentClass(moreOpen)} w-full`}
          >
            More
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-10" aria-hidden onClick={() => setMoreOpen(false)} />
              <div className="absolute left-0 right-0 top-full mt-1 z-20 py-1 rounded-[10px] bg-white border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.12)] overflow-hidden">
                {MORE_ACTIONS.map((action) => (
                  <button
                    key={action.focus}
                    type="button"
                    onClick={() => handleQuickAction(action.focus)}
                    className="w-full text-left px-4 py-3 text-[17px] font-normal text-[#1c1c1e] active:bg-black/[0.04] border-b border-black/[0.06] last:border-0"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      <div className="rounded-[10px] bg-white border border-black/[0.06] overflow-hidden divide-y divide-black/[0.08]">
        {activeCategory.actions.map((action) => (
          <button
            key={action.focus}
            type="button"
            onClick={() => handleQuickAction(action.focus)}
            className="w-full text-left px-4 py-3.5 min-h-[44px] text-[17px] font-normal text-[#1c1c1e] flex items-center justify-between active:bg-black/[0.03]"
          >
            {action.label}
            <span className="text-[#c7c7cc] text-xl font-extralight">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
