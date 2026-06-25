import type { ReactNode } from 'react';
import { getPrimaryStatus, getStatusText, type PetState, type PetStatus, type RecentActivity } from '../core/pet';
import { petActivityImages as defaultPetActivityImages, petStatusImages as defaultPetStatusImages } from '../assets';
import { t } from '../i18n';

interface PetDisplayProps {
  pet: PetState;
  onInteract: () => void;
  overlay?: ReactNode;
  petStatusImages?: Record<PetStatus, string>;
  petActivityImages?: Partial<Record<RecentActivity, string>>;
  getStatusLabel?: (status: PetStatus) => string;
}

export const PetDisplay = ({
  pet,
  onInteract,
  overlay,
  petStatusImages = defaultPetStatusImages,
  petActivityImages = defaultPetActivityImages,
  getStatusLabel = getStatusText,
}: PetDisplayProps) => {
  const status = getPrimaryStatus(pet);
  const activeActivity =
    !pet.isSleeping && pet.recentActivity !== 'idle' && pet.recentActivityUntil > Date.now()
      ? pet.recentActivity
      : undefined;
  const petImage = activeActivity ? petActivityImages[activeActivity] ?? petStatusImages[status] : petStatusImages[status];
  const statusLabel = getStatusLabel(status);
  const petAlt = activeActivity
    ? t('ui.petDisplay.activityAlt', { name: pet.name })
    : t('ui.petDisplay.statusAlt', { name: pet.name, status: statusLabel });

  return (
    <section className={`pet-scene pet-scene--${status} pet-scene--weather-${pet.weather}`} aria-label={t('ui.petDisplay.sceneAria')}>
      <div className="pet-scene__sky">
        <span />
        <span />
        <span />
      </div>
      {overlay}
      <button type="button" className={`pet pet--image pet--${status}`} onClick={onInteract} aria-label={t('ui.petDisplay.interactAria')}>
        <img src={petImage} alt={petAlt} draggable="false" />
      </button>
      <div className="pet-scene__ground" />
      <div className="pet-badge">
        <strong>{pet.name}</strong>
        <span>{statusLabel}</span>
      </div>
    </section>
  );
};

