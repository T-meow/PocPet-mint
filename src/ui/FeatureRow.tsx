import { Cloud, CloudRain, Sparkles, Sun, Timer, Wind, type LucideIcon } from 'lucide-react';
import { weatherInfo, type PetState, type WeatherType } from '../core/pet';
import { t } from '../i18n';
import { formatPomodoroTime } from './time';

const weatherIcons: Record<WeatherType, LucideIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  breezy: Wind,
};

interface FeatureRowProps {
  pet: PetState;
  canUpgrade: boolean;
  nextUpgradeCost: number;
  isPomodoroOpen: boolean;
  pomodoroRemainingMs: number;
  pomodoroStartTitle?: string;
  onUpgrade: () => void;
  onOpenPomodoro: () => void;
}

export const FeatureRow = ({
  pet,
  canUpgrade,
  nextUpgradeCost,
  isPomodoroOpen,
  pomodoroRemainingMs,
  pomodoroStartTitle,
  onUpgrade,
  onOpenPomodoro,
}: FeatureRowProps) => {
  const WeatherIcon = weatherIcons[pet.weather];

  return (
    <div className="feature-row" aria-label={t('ui.features.aria')}>
      <button
        type="button"
        className={canUpgrade ? 'feature-button feature-button--upgrade' : 'feature-button feature-button--upgrade feature-button--muted'}
        onClick={onUpgrade}
        title={nextUpgradeCost > 0 ? t('ui.features.upgradeTitle', { cost: nextUpgradeCost }) : t('ui.features.maxLevel')}
      >
        <Sparkles size={20} aria-hidden="true" />
        <span>
          {t('ui.features.upgrade')}
          <small>{t('ui.features.level', { level: pet.level })} - {nextUpgradeCost > 0 ? t('ui.features.cost', { cost: nextUpgradeCost }) : t('ui.features.maxLevel')}</small>
        </span>
      </button>

      <button
        type="button"
        className={pet.pomodoro.isRunning ? 'feature-button feature-button--pomodoro feature-button--active' : 'feature-button feature-button--pomodoro'}
        title={pomodoroStartTitle}
        aria-pressed={isPomodoroOpen}
        onClick={onOpenPomodoro}
      >
        <Timer size={20} aria-hidden="true" />
        <span>
          {t('ui.features.pomodoro')}
          <small>{pet.pomodoro.isRunning ? t('ui.pomodoro.running') : formatPomodoroTime(pomodoroRemainingMs)}</small>
        </span>
        {pet.pomodoro.isRunning && <i aria-hidden="true" />}
      </button>

      <div className="feature-button feature-button--weather" title={weatherInfo[pet.weather].summary} aria-label={t('ui.features.weatherAria', { weather: weatherInfo[pet.weather].label })}>
        <WeatherIcon size={20} aria-hidden="true" />
        <span>
          {weatherInfo[pet.weather].label}
          <small>{weatherInfo[pet.weather].summary}</small>
        </span>
      </div>
    </div>
  );
};



