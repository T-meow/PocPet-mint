import { useState, type ReactNode } from 'react';
import { CalendarDays, ChevronDown, ChevronUp, Cloud, CloudRain, Sparkles, Sun, Wind, type LucideIcon } from 'lucide-react';
import { getPartnerScheduleActivity, getPrimaryStatus, getSeasonInfo, getStatusText, weatherInfo, type PetState, type PetStatus, type RecentActivity, type WeatherType } from '../core/pet';
import { petActivityImages as defaultPetActivityImages, petStatusImages as defaultPetStatusImages } from '../assets';
import { t } from '../i18n';
import { formatCompactNumber } from './numberFormat';

const weatherIcons: Record<WeatherType, LucideIcon> = {
  sunny: Sun,
  cloudy: Cloud,
  rainy: CloudRain,
  breezy: Wind,
};

interface PetDisplayProps {
  pet: PetState;
  onInteract: () => void;
  canUpgrade: boolean;
  isPetBusy: boolean;
  nextUpgradeCost: number;
  onUpgrade: () => void;
  overlay?: ReactNode;
  petStatusImages?: Record<PetStatus, string>;
  petActivityImages?: Partial<Record<RecentActivity, string>>;
  getStatusLabel?: (status: PetStatus) => string;
}

export const PetDisplay = ({
  pet,
  onInteract,
  canUpgrade,
  isPetBusy,
  nextUpgradeCost,
  onUpgrade,
  overlay,
  petStatusImages = defaultPetStatusImages,
  petActivityImages = defaultPetActivityImages,
  getStatusLabel = getStatusText,
}: PetDisplayProps) => {
  const [isWeatherExpanded, setWeatherExpanded] = useState(false);
  const [isSeasonExpanded, setSeasonExpanded] = useState(false);
  const [isStatusCollapsed, setStatusCollapsed] = useState(false);
  const status = getPrimaryStatus(pet);
  const scheduleActivity = pet.partnerSchedule.active
    ? getPartnerScheduleActivity(pet.partnerSchedule.active.category)
    : undefined;
  const activeActivity = !pet.isSleeping
    ? scheduleActivity ?? (pet.recentActivity !== 'idle' && pet.recentActivityUntil > Date.now() ? pet.recentActivity : undefined)
    : undefined;
  const petImage = activeActivity ? petActivityImages[activeActivity] ?? petStatusImages[status] : petStatusImages[status];
  const statusLabel = getStatusLabel(status);
  const currentWeather = weatherInfo[pet.weather];
  const WeatherIcon = weatherIcons[pet.weather];
  const season = getSeasonInfo(pet.lastUpdatedAt);
  const petAlt = activeActivity
    ? t('ui.petDisplay.activityAlt', { name: pet.name })
    : t('ui.petDisplay.statusAlt', { name: pet.name, status: statusLabel });

  return (
    <section className={`pet-scene pet-scene--${status} pet-scene--weather-${pet.weather}`} aria-label={t('ui.petDisplay.sceneAria')}>
      <div className="pet-scene__sky"><span /><span /><span /></div>
      <div className="pet-scene__environment-panels">
        <section className={`pet-environment-panel pet-environment-panel--weather pet-environment-panel--weather-${pet.weather}${isWeatherExpanded ? ' pet-environment-panel--expanded' : ''}`}>
          <div className="pet-environment-panel__header">
            <span><WeatherIcon size={15} aria-hidden="true" /><strong>{currentWeather.label}</strong></span>
            <button
              type="button"
              className="pet-environment-panel__toggle"
              aria-expanded={isWeatherExpanded}
              aria-controls="pet-weather-details"
              aria-label={isWeatherExpanded ? t('ui.petDisplay.collapseWeather') : t('ui.petDisplay.expandWeather')}
              title={isWeatherExpanded ? t('ui.petDisplay.collapseWeather') : t('ui.petDisplay.expandWeather')}
              onClick={() => setWeatherExpanded((expanded) => !expanded)}
            >
              {isWeatherExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>
          </div>
          {isWeatherExpanded && <p id="pet-weather-details">{currentWeather.summary}</p>}
        </section>

        <section className={`pet-environment-panel pet-environment-panel--season pet-environment-panel--season-${season.id}${isSeasonExpanded ? ' pet-environment-panel--expanded' : ''}`}>
          <div className="pet-environment-panel__header">
            <span><CalendarDays size={15} aria-hidden="true" /><strong>{season.label}</strong></span>
            <button
              type="button"
              className="pet-environment-panel__toggle"
              aria-expanded={isSeasonExpanded}
              aria-controls="pet-season-details"
              aria-label={isSeasonExpanded ? t('ui.petDisplay.collapseSeason') : t('ui.petDisplay.expandSeason')}
              title={isSeasonExpanded ? t('ui.petDisplay.collapseSeason') : t('ui.petDisplay.expandSeason')}
              onClick={() => setSeasonExpanded((expanded) => !expanded)}
            >
              {isSeasonExpanded ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
            </button>
          </div>
          {isSeasonExpanded && <p id="pet-season-details">{season.summary}</p>}
        </section>
      </div>
      {overlay}
      <button
        type="button"
        className={`pet pet--image pet--${status}`}
        disabled={isPetBusy}
        title={isPetBusy ? t('ui.petDisplay.partnerScheduleBusy') : undefined}
        onClick={onInteract}
        aria-label={isPetBusy ? t('ui.petDisplay.partnerScheduleBusy') : t('ui.petDisplay.interactAria')}
      >
        <img src={petImage} alt={petAlt} draggable="false" />
      </button>
      <div className="pet-scene__ground" />
      <div className={isStatusCollapsed ? 'pet-badge pet-badge--collapsed' : 'pet-badge'}>
        {!isStatusCollapsed && (
          <>
            <div className="pet-badge__status"><strong>{statusLabel}</strong></div>
            <button
              type="button"
              className={canUpgrade && !isPetBusy ? 'pet-level-button pet-level-button--ready' : 'pet-level-button'}
              disabled={isPetBusy}
              title={isPetBusy ? t('ui.petDisplay.partnerScheduleBusy') : nextUpgradeCost > 0 ? t('ui.features.upgradeTitle', { cost: nextUpgradeCost }) : t('ui.features.maxLevel')}
              onClick={onUpgrade}
            >
              <Sparkles size={16} aria-hidden="true" />
              <span>{t('ui.features.level', { level: pet.level })}</span>
              <small>{nextUpgradeCost > 0 ? t('ui.features.cost', { cost: formatCompactNumber(nextUpgradeCost) }) : t('ui.features.maxLevel')}</small>
            </button>
          </>
        )}
        <button
          type="button"
          className={isStatusCollapsed ? 'pet-badge__collapse pet-badge__collapse--status' : 'pet-badge__collapse'}
          aria-expanded={!isStatusCollapsed}
          aria-label={isStatusCollapsed ? t('ui.petDisplay.expandStatus') : t('ui.petDisplay.collapseStatus')}
          title={isStatusCollapsed ? t('ui.petDisplay.expandStatus') : t('ui.petDisplay.collapseStatus')}
          onClick={() => setStatusCollapsed((collapsed) => !collapsed)}
        >
          {isStatusCollapsed ? <span>{statusLabel}</span> : null}
          {isStatusCollapsed ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </button>
      </div>
    </section>
  );
};
