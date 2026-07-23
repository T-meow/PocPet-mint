import { t } from '../i18n';

export const quantityPresetOptions = [1, 5, 10] as const;

export const getValidQuantityPreset = (requested: number, max: number) => {
  const available = quantityPresetOptions.filter((option) => option <= max);
  if (available.length === 0) return quantityPresetOptions[0];
  return available.includes(requested as (typeof quantityPresetOptions)[number])
    ? requested
    : available[available.length - 1];
};

interface QuantityPresetsProps {
  value: number;
  max: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

export const QuantityPresets = ({ value, max, disabled = false, onChange }: QuantityPresetsProps) => (
  <div className="quantity-presets" role="group" aria-label={t('ui.quantity.presetsAria')}>
    {quantityPresetOptions.map((option) => {
      const label = t('ui.quantity.preset', { count: option });
      return (
        <button
          type="button"
          className="quantity-presets__button"
          aria-pressed={value === option}
          aria-label={label}
          title={label}
          disabled={disabled || option > max}
          key={option}
          onClick={() => onChange(option)}
        >
          x{option}
        </button>
      );
    })}
  </div>
);
