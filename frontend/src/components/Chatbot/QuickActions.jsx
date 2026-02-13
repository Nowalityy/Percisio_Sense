import { useSceneStore } from '../../store';
import { focusOnOrgan } from '../../utils/viewerUtils.js';

/** Quick actions: EN + FR labels so both languages are visible. */
const QUICK_ACTIONS = [
  { label: 'Heart', labelFr: 'Cœur', focus: 'heart', icon: '❤️' },
  { label: 'Liver', labelFr: 'Foie', focus: 'liver', icon: '🫀' },
  { label: 'Lungs', labelFr: 'Poumons', focus: 'lung', icon: '🫁' },
  { label: 'Stomach', labelFr: 'Estomac', focus: 'stomach', icon: '🍽️' },
  { label: 'Skeleton', labelFr: 'Squelette', focus: 'clavicle', icon: '🦴' },
  { label: 'Vessels', labelFr: 'Vaisseaux', focus: 'artery', icon: '🩸' },
];

export function QuickActions() {
  const setFocus = useSceneStore((s) => s.setFocus);

  const handleQuickAction = (focus) => {
    setFocus(focus);
    focusOnOrgan(focus);
  };

  return (
    <div className="px-3 py-2 border-b border-border bg-slate-50">
      <div className="text-xs text-text-secondary mb-2 font-medium">Quick actions:</div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.focus}
            onClick={() => handleQuickAction(action.focus)}
            className="glass-btn px-2.5 py-1.5 text-xs rounded-xl hover:!bg-accent hover:!text-white hover:!border-accent/30 transition-colors flex items-center gap-1.5"
            title={action.labelFr ? `${action.label} / ${action.labelFr}` : action.label}
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
            {action.labelFr && (
              <span className="text-[10px] opacity-75" aria-hidden="true">
                ({action.labelFr})
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
