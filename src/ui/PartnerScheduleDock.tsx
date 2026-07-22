import { ArrowRight, BookOpen, ChefHat, Dumbbell, Sprout, type LucideIcon } from 'lucide-react';
import {
  getPartnerScheduleDefinition,
  getPartnerScheduleProgress,
  type NeighborIdentity,
  type PartnerScheduleCategory,
  type PetState,
} from '../core/pet';
import { t } from '../i18n';
import { getPartnerScheduleDisplayTitle } from './partnerScheduleText';

const categoryIcons: Record<PartnerScheduleCategory, LucideIcon> = {
  study: BookOpen,
  cooking: ChefHat,
  garden: Sprout,
  exercise: Dumbbell,
};

const formatCountdown = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':');
};

interface PartnerScheduleDockProps {
  pet: PetState;
  neighbors: readonly NeighborIdentity[];
  onOpen: () => void;
}

export const PartnerScheduleDock = ({ pet, neighbors, onOpen }: PartnerScheduleDockProps) => {
  const active = pet.partnerSchedule.active;
  if (!active) return null;
  const definition = getPartnerScheduleDefinition(active.templateId);
  if (!definition) return null;
  const Icon = categoryIcons[active.category];
  const progress = getPartnerScheduleProgress(active);
  const title = getPartnerScheduleDisplayTitle(definition.id, active.neighbor, neighbors);

  return (
    <div className={`partner-schedule-dock partner-schedule-dock--${active.category}`} aria-label={t('ui.partnerSchedule.homeDockAria')}>
      <span className={`partner-schedule-category-icon partner-schedule-category-icon--${active.category}`} aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="partner-schedule-dock__main">
        <div className="partner-schedule-dock__heading">
          <span>{t('ui.partnerSchedule.homeDockKicker')}</span>
          <strong>{title}</strong>
        </div>
        <div className="partner-schedule-progress" aria-label={t('ui.partnerSchedule.progress', { percent: Math.round(progress.percent) })}>
          <i style={{ width: `${progress.percent}%` }} />
        </div>
      </div>
      <time dateTime={`PT${Math.ceil(progress.remainingMs / 1000)}S`}>{formatCountdown(progress.remainingMs)}</time>
      <button type="button" className="icon-button" onClick={onOpen} aria-label={t('ui.partnerSchedule.open')} title={t('ui.partnerSchedule.open')}>
        <ArrowRight size={20} aria-hidden="true" />
      </button>
    </div>
  );
};
