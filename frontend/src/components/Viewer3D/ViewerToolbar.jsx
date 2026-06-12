import { SegmentFilterPanel } from './SegmentFilterPanel';
import { Icon } from '../psUI.jsx';

/** Map the app's view modes to the design's layer tabs + Tabler icons. */
const LAYER_ICONS = {
  Skeleton: 'bone',
  Organs: 'lungs',
  Vessels: 'activity',
  Skin: 'body-scan',
  Full: 'stack-2',
};

export function ViewerToolbar({ viewMode, viewModes, onModeChange }) {
  return (
    <>
      {/* centered layer tabs (design: .av-tabs) */}
      <div className="av-tabs">
        {viewModes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onModeChange(mode)}
            className={`av-tab ${viewMode === mode ? 'on' : ''}`}
            aria-pressed={viewMode === mode}
            title={mode}
          >
            <Icon name={LAYER_ICONS[mode] || 'stack-2'} size={14} />
            <span className="av-tab-label">{mode}</span>
          </button>
        ))}
      </div>

      {/* filters chip + panel (design: .av-filters) */}
      <div className="av-filters">
        <SegmentFilterPanel />
      </div>
    </>
  );
}
