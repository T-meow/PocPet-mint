import type { ClassicEndgameState, PartnerScheduleCategory, PetState } from './petTypes';

export type ClassicTrophyTier = 'bronze' | 'silver' | 'gold';
export type ClassicTrophyId = `${PartnerScheduleCategory}_${ClassicTrophyTier}`;

export interface ClassicTrophyDefinition {
  id: ClassicTrophyId;
  category: PartnerScheduleCategory;
  tier: ClassicTrophyTier;
  requiredStages: 1 | 3 | 5;
  effectValue: number;
}

export interface ClassicTrophyEffects {
  partnerScheduleRewardMultiplier: number;
  foodEffectMultiplier: number;
  gardenExtraDropChancePercent: number;
  energyCapBonus: number;
  diamondUnlocked: boolean;
}

type ClassicTrophySource = ClassicEndgameState | Pick<PetState, 'classicEndgame'>;

export const classicTrophyCategories: readonly PartnerScheduleCategory[] = ['study', 'cooking', 'garden', 'exercise'];

const tierDefinitions = [
  { tier: 'bronze', requiredStages: 1 },
  { tier: 'silver', requiredStages: 3 },
  { tier: 'gold', requiredStages: 5 },
] as const;

const trophyEffectValues: Record<PartnerScheduleCategory, readonly [number, number, number]> = {
  study: [1.25, 1.5, 2],
  cooking: [1.25, 1.5, 2],
  garden: [25, 50, 100],
  exercise: [25, 50, 100],
};

export const classicTrophyDefinitions: readonly ClassicTrophyDefinition[] = classicTrophyCategories.flatMap((category) =>
  tierDefinitions.map((definition, index) => ({
    id: `${category}_${definition.tier}` as ClassicTrophyId,
    category,
    tier: definition.tier,
    requiredStages: definition.requiredStages,
    effectValue: trophyEffectValues[category][index],
  })),
);

export const classicTrophyTotal = classicTrophyDefinitions.length;

const getClassicEndgameState = (source: ClassicTrophySource) =>
  'classicEndgame' in source ? source.classicEndgame : source;

export const isClassicTrophyUnlocked = (source: ClassicTrophySource, trophy: ClassicTrophyDefinition) =>
  getClassicEndgameState(source).projects[trophy.category].completedStages >= trophy.requiredStages;

export const getClassicTrophyCount = (source: ClassicTrophySource) =>
  classicTrophyDefinitions.reduce((count, trophy) => count + (isClassicTrophyUnlocked(source, trophy) ? 1 : 0), 0);

export const isClassicDiamondTrophyUnlocked = (source: ClassicTrophySource) =>
  getClassicTrophyCount(source) >= classicTrophyTotal;

const getTierEffectValue = (completedStages: number, values: readonly [number, number, number], fallback: number) => {
  if (completedStages >= 5) return values[2];
  if (completedStages >= 3) return values[1];
  if (completedStages >= 1) return values[0];
  return fallback;
};

export const getClassicTrophyEffects = (source: ClassicTrophySource): ClassicTrophyEffects => {
  const state = getClassicEndgameState(source);
  const diamondUnlocked = isClassicDiamondTrophyUnlocked(state);
  if (diamondUnlocked) {
    return {
      partnerScheduleRewardMultiplier: 2.5,
      foodEffectMultiplier: 2.5,
      gardenExtraDropChancePercent: 150,
      energyCapBonus: 150,
      diamondUnlocked: true,
    };
  }

  return {
    partnerScheduleRewardMultiplier: getTierEffectValue(state.projects.study.completedStages, trophyEffectValues.study, 1),
    foodEffectMultiplier: getTierEffectValue(state.projects.cooking.completedStages, trophyEffectValues.cooking, 1),
    gardenExtraDropChancePercent: getTierEffectValue(state.projects.garden.completedStages, trophyEffectValues.garden, 0),
    energyCapBonus: getTierEffectValue(state.projects.exercise.completedStages, trophyEffectValues.exercise, 0),
    diamondUnlocked: false,
  };
};
