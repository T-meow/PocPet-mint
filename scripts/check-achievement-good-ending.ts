import assert from 'node:assert/strict';
import {
  applyCoinGain,
  applyHeartGain,
  claimAchievementDailyStipendWithResult,
  getAchievementEffects,
  getAchievementViews,
  goodEndingCgId,
} from '../src/core/achievements';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import type { PetState } from '../src/core/petTypes';

const now = new Date(2026, 6, 23, 12, 0, 0, 0).getTime();

const withGoodEndingYears = (years: number[]): PetState => {
  const pet = createDefaultPet(now);
  return {
    ...pet,
    coins: 0,
    hearts: 0,
    achievements: {
      ...pet.achievements,
      completedGoodEndingYears: years,
    },
  };
};

const noEnding = getAchievementEffects(withGoodEndingYears([]));
assert.equal(noEnding.dailyStipendCoins, 0, 'no good ending adds no daily stipend');
assert.equal(noEnding.extraHeartChancePercent, 0, 'no good ending adds no heart chance');

const oneEndingPet = withGoodEndingYears([1]);
const oneEnding = getAchievementEffects(oneEndingPet);
assert.equal(oneEnding.dailyStipendCoins, 30, 'one good ending adds 30 daily coins');
assert.equal(oneEnding.extraHeartChancePercent, 30, 'one good ending adds 30% heart chance');
assert.equal(applyCoinGain(oneEndingPet, 10).amount, 10, 'good endings no longer add coins to every gain');

const firstDailyClaim = claimAchievementDailyStipendWithResult(oneEndingPet, now, '2026-07-23');
assert.equal(firstDailyClaim.coins, 30, 'one good ending daily stipend pays 30 coins');
assert.equal(firstDailyClaim.pet.coins, 30);
assert.equal(claimAchievementDailyStipendWithResult(firstDailyClaim.pet, now, '2026-07-23').coins, 0, 'daily stipend can only be claimed once per date key');

const twoEndings = getAchievementEffects(withGoodEndingYears([1, 2]));
assert.equal(twoEndings.dailyStipendCoins, 60, 'two good endings add 60 daily coins');
assert.equal(twoEndings.extraHeartChancePercent, 60, 'two good endings add 60% heart chance');

const originalRandom = Math.random;
try {
  Math.random = () => 0.29;
  assert.equal(applyHeartGain(oneEndingPet, 1).amount, 2, 'one ending succeeds below its 30% threshold');
  Math.random = () => 0.3;
  assert.equal(applyHeartGain(oneEndingPet, 1).amount, 1, 'one ending does not succeed at its 30% boundary');
  Math.random = () => 0.59;
  assert.equal(applyHeartGain(withGoodEndingYears([1, 2]), 1).amount, 2, 'two endings succeed below their 60% threshold');
  Math.random = () => 0.6;
  assert.equal(applyHeartGain(withGoodEndingYears([1, 2]), 1).amount, 1, 'two endings do not succeed at their 60% boundary');
} finally {
  Math.random = originalRandom;
}

const oldSavePet = normalizePet(JSON.parse(JSON.stringify(oneEndingPet)), now);
delete oldSavePet.achievements.unlockedAtById.hidden_good_ending_year_1;
const migratedEffects = getAchievementEffects(oldSavePet);
assert.equal(migratedEffects.dailyStipendCoins, 30, 'an existing completed year activates the new daily stipend without re-unlocking');
assert.equal(migratedEffects.extraHeartChancePercent, 30, 'an existing completed year activates the new heart chance without re-unlocking');

const firstYearUnlocked: PetState = {
  ...oneEndingPet,
  achievements: {
    ...oneEndingPet.achievements,
    unlockedAtById: { ...oneEndingPet.achievements.unlockedAtById, hidden_good_ending_year_1: now },
    unlockedCgIds: [goodEndingCgId],
  },
};
const firstYearView = getAchievementViews(firstYearUnlocked).find((view) => view.id === 'hidden_good_ending_year_1');
assert(firstYearView);
assert.equal(firstYearView.reward.cgId, goodEndingCgId, 'the first good ending keeps its CG reward');
assert.match(firstYearView.rewardText, /30/);
assert.equal(getAchievementEffects(firstYearUnlocked).dailyStipendCoins, 30, 'the first-year achievement definition does not double the stipend');
assert.equal(getAchievementEffects(firstYearUnlocked).extraHeartChancePercent, 30, 'the first-year achievement definition does not double the heart chance');

const secondYearView = getAchievementViews(withGoodEndingYears([1, 2])).find((view) => view.id === 'hidden_together_year_2');
assert(secondYearView);
assert.equal(secondYearView.reward.dailyStipendCoins, 30);
assert.equal(secondYearView.reward.extraHeartChancePercent, 30);

console.log('achievement good-ending reward checks passed');
