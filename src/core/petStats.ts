import { getEnergyRecoverySeasonModifier } from './season';
import type { PetState } from './petTypes';

export const lowEnergyThreshold = 10;

export const criticalHungerActionThreshold = 10;

export const lowCleanlinessSleepWarningThreshold = 25;

export const lowCleanlinessSleepConfirmClicks = 3;

export const lowCleanlinessSleepMoodPenalty = 12;

export const defaultPetName = 'mint';

export const maxPetLevel = 99;

export const baseStatCap = 100;

export const statCapPerLevel = 5;

export const awakeEnergyRecoveryMs = 5 * 60 * 1000;

export const breezyEnergyRecoveryMs = 4 * 60 * 1000;

export const sleepEnergyRecoveryMs = 3 * 60 * 1000;

export const clampStat = (value: number, max = baseStatCap) => Math.max(0, Math.min(max, Math.round(value)));

export const clampHealth = (value: number, max = baseStatCap) => Math.max(1, clampStat(value, max));

export const clampCoins = (value: number) => Math.max(0, Math.round(value));

export const clampCount = (value: number) => Math.max(0, Math.floor(value));

export const clampLevel = (value: number) => Math.max(1, Math.min(maxPetLevel, clampCount(value)));

export const getPetStatCap = (petOrLevel: PetState | number) => {
  const level = typeof petOrLevel === 'number' ? petOrLevel : petOrLevel.level;
  return baseStatCap + (clampLevel(level) - 1) * statCapPerLevel;
};

export const clampPetStat = (pet: PetState, value: number) => clampStat(value, getPetStatCap(pet));

export const clampPetHealth = (pet: PetState, value: number) => clampHealth(value, getPetStatCap(pet));

export const getUpgradeHeartCost = (targetLevel: number) => clampLevel(targetLevel) ** 3;

export const getNextUpgradeHeartCost = (pet: PetState) =>
  pet.level >= maxPetLevel ? 0 : getUpgradeHeartCost(pet.level + 1);

export const getEnergyRecoveryIntervalMs = (pet: PetState, isSleeping = pet.isSleeping, now = Date.now()) => {
  const baseIntervalMs = isSleeping ? sleepEnergyRecoveryMs : pet.weather === 'breezy' ? breezyEnergyRecoveryMs : awakeEnergyRecoveryMs;
  return Math.max(1, Math.round(baseIntervalMs * getEnergyRecoverySeasonModifier(now, isSleeping)));
};
