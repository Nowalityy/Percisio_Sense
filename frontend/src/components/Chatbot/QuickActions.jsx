import { useSceneStore } from '../../store';
import { focusOnOrgan } from '../Viewer3D.jsx';
import { SEGMENTS } from '../Viewer3D/medicalColors';

const QUICK_ACTIONS = [
  { label: 'Cœur', focus: 'heart', icon: '❤️' },
  { label: 'Foie', focus: 'liver', icon: '🫀' },
  { label: 'Poumons', focus: 'lung', icon: '🫁' },
  { label: 'Estomac', focus: 'stomach', icon: '🍽️' },
  { label: 'Squelette', focus: 'clavicle', icon: '🦴' },
  { label: 'Vaisseaux', focus: 'artery', icon: '🩸' },
];

export function QuickActions() {
  const setFocus = useSceneStore((s) => s.setFocus);

  const handleQuickAction = (focus) => {
    setFocus(focus);
    focusOnOrgan(focus);
  };

  return (
    <div className="px-3 py-2 border-b border-gray-200 bg-gray-50">
      <div className="text-xs text-gray-500 mb-2 font-medium">Actions rapides:</div>
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map((action) => (
          <button
            key={action.focus}
            onClick={() => handleQuickAction(action.focus)}
            className="px-2.5 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-accent hover:text-white hover:border-accent transition-colors flex items-center gap-1.5"
          >
            <span>{action.icon}</span>
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
