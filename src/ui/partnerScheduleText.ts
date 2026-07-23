import { resolveNeighborName, type NeighborIdentity, type NeighborReference } from '../core/pet';
import { t } from '../i18n';

export const getPartnerScheduleDisplayTitle = (
  definitionId: string,
  neighbor: NeighborReference | undefined,
  neighbors: readonly NeighborIdentity[],
) => {
  const activity = t(`ui.partnerSchedule.activities.${definitionId}.title`);
  if (!neighbor) return activity;
  const neighborName = resolveNeighborName(neighbor, neighbors);
  return t(`ui.partnerSchedule.neighborActivity.title.${neighborName ? 'named' : 'generic'}`, {
    activity,
    neighbor: neighborName ?? '',
  });
};

export const getPartnerScheduleDisplaySummary = (
  definitionId: string,
  neighbor: NeighborReference | undefined,
  neighbors: readonly NeighborIdentity[],
) => {
  const summary = t(`ui.partnerSchedule.activities.${definitionId}.summary`);
  if (!neighbor) return summary;
  const neighborName = resolveNeighborName(neighbor, neighbors);
  return t(`ui.partnerSchedule.neighborActivity.summary.${neighborName ? 'named' : 'generic'}`, {
    summary,
    neighbor: neighborName ?? '',
  });
};
