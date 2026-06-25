interface StatusBarProps {
  label: string;
  value: number;
  max?: number;
  detail?: string;
  tone: 'food' | 'mood' | 'clean' | 'energy' | 'health';
}

const radius = 28;
const circumference = 2 * Math.PI * radius;

export const StatusBar = ({ label, value, max = 100, detail, tone }: StatusBarProps) => {
  const statMax = Math.max(1, Math.round(max));
  const clampedValue = Math.max(0, Math.min(statMax, Math.round(value)));
  const ratio = clampedValue / statMax;
  const level = ratio <= 0.3 ? 'low' : ratio <= 0.6 ? 'mid' : 'high';
  const progressOffset = circumference * (1 - ratio);

  return (
    <div className={`status-bar status-bar--${tone} status-bar--${level}`}>
      <div className="status-bar__ring" aria-label={`${label} ${clampedValue}/${statMax}`}>
        <svg viewBox="0 0 72 72" aria-hidden="true" focusable="false">
          <circle className="status-bar__track" cx="36" cy="36" r={radius} />
          <circle
            className="status-bar__progress"
            cx="36"
            cy="36"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
          />
        </svg>
        <strong>{clampedValue}</strong>
      </div>
      <span className="status-bar__label">{label}</span>
      {detail && <small className="status-bar__detail">{detail}</small>}
    </div>
  );
};
