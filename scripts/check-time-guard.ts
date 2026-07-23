import assert from 'node:assert/strict';
import { claimAvailableDateRewards } from '../src/core/dateRewards';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { normalizeTimeGuardState, reconcilePetClock } from '../src/core/gameClock';
import { advancePet } from '../src/core/petLifecycle';
import { createSaveFileText, parseSaveFileText } from '../src/core/saveCodec';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import type { PetState } from '../src/core/petTypes';

const minuteMs = 60 * 1000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const atNoon = (year: number, month: number, day: number) =>
  new Date(year, month - 1, day, 12, 0, 0, 0).getTime();

const later = atNoon(2028, 6, 1);
const earlier = atNoon(2027, 6, 1);
const laterDateKey = getDailyResetDateKey(later);
const earlierDateKey = getDailyResetDateKey(earlier);

const dailyPet = createDefaultPet(later);
const heldDailyPet: PetState = {
  ...dailyPet,
  lastUpdatedAt: later,
  lastEnergyRecoveryAt: later,
  timeGuard: { schemaVersion: 1, lastObservedAt: later, maxDailyDateKey: laterDateKey },
  dailyEncounterDateKey: laterDateKey,
  neighborGiftDateKey: laterDateKey,
  neighborGiftCount: 2,
  dailyBiscuitClaimDate: laterDateKey,
  dailyBiscuitClaims: 2,
  dailyDiscountDate: laterDateKey,
  dailyDiscountItemIds: ['orange'],
  dailyDiscountUsedItemIds: ['orange'],
  dailyDiscountUsed: true,
  dailyHeartExchangeDate: laterDateKey,
  dailyHeartExchangeCount: 2,
  dailyLoginRewardDateKey: laterDateKey,
  claimedDateRewardKeys: [
    `monthly_gift:${laterDateKey.slice(0, 7)}`,
    'festival:children_day:2028',
  ],
  dailyWish: { ...dailyPet.dailyWish, dateKey: laterDateKey, progress: 1, completedAt: later, claimedAt: later },
  achievements: {
    ...dailyPet.achievements,
    dailyStipendClaimDateKey: laterDateKey,
  },
  garden: {
    ...dailyPet.garden,
    dailyCareDateKey: laterDateKey,
    dailyWaterCount: 2,
    dailyFertilizeCount: 1,
    dailyHarvestDateKey: laterDateKey,
    dailyHarvestCount: 3,
    slots: dailyPet.garden.slots.map((slot, index) => index === 0 ? {
      ...slot,
      unlocked: true,
      treeId: 'fruit_tree',
      state: 'growing',
      plantedAt: later - hourMs,
      naturalReadyAt: later + 2 * hourMs,
      nextReadyAt: later + 2 * hourMs,
      maxHarvests: 8,
      lastWateredDateKey: laterDateKey,
      lastFertilizedDateKey: laterDateKey,
      lastBoostedDateKey: laterDateKey,
      dailyHarvestDateKey: laterDateKey,
      dailyHarvestCount: 2,
    } : slot),
  },
  boostCards: {
    ...dailyPet.boostCards,
    dailyDateKey: laterDateKey,
    dailyRewardClaimed: true,
    dailyWorkBonusCoinsUsed: 7,
    dailyGardenExtraDrops: 1,
  },
  goldenAppleGacha: {
    ...dailyPet.goldenAppleGacha,
    dailyDateKey: laterDateKey,
    dailyProcessedSources: ['daily_wish'],
    dailyGrantedSources: ['daily_wish'],
    dailyTicketsGranted: 1,
  },
  pomodoro: {
    ...dailyPet.pomodoro,
    dailyFocusDate: laterDateKey,
    dailyCompletedFocusCount: 3,
  },
  yearlyStats: {
    ...dailyPet.yearlyStats,
    year: 2028,
    activeDateKeys: [laterDateKey],
  },
};

const rolledBack = advancePet(heldDailyPet, earlier);
assert.equal(rolledBack.timeGuard.maxDailyDateKey, earlierDateKey);
assert.equal(rolledBack.timeGuard.lastObservedAt, earlier);
assert.equal(rolledBack.createdAt, earlier, 'a future creation anchor must not lock companion-year progress');
assert.deepEqual(rolledBack.metDate, { year: 2027, month: 6, day: 1 });
assert.equal(rolledBack.dailyEncounterDateKey, earlierDateKey);
assert.equal(rolledBack.neighborGiftCount, 2);
assert.equal(rolledBack.dailyBiscuitClaims, 2);
assert.deepEqual(rolledBack.dailyDiscountUsedItemIds, ['orange']);
assert.equal(rolledBack.dailyHeartExchangeCount, 2);
assert.equal(rolledBack.dailyWish.dateKey, earlierDateKey);
assert.equal(rolledBack.dailyWish.claimedAt, later);
assert.equal(rolledBack.achievements.dailyStipendClaimDateKey, earlierDateKey);
assert.equal(rolledBack.garden.dailyWaterCount, 2);
assert.equal(rolledBack.garden.dailyFertilizeCount, 1);
assert.equal(rolledBack.garden.dailyHarvestCount, 3);
assert.equal(rolledBack.garden.slots[0].lastWateredDateKey, earlierDateKey);
assert.equal(rolledBack.boostCards.dailyRewardClaimed, true);
assert.equal(rolledBack.boostCards.dailyWorkBonusCoinsUsed, 7);
assert.deepEqual(rolledBack.goldenAppleGacha.dailyGrantedSources, ['daily_wish']);
assert.equal(rolledBack.pomodoro.dailyCompletedFocusCount, 3);
assert.equal(rolledBack.yearlyStats.year, 2027);
assert.equal(rolledBack.partnerSchedule.boardDateKey, earlierDateKey);
assert.equal(
  claimAvailableDateRewards(rolledBack, earlier).rewards.some((reward) => reward.kind === 'daily_login'),
  false,
  'a severe rollback may repair the date but must preserve today\'s daily claim',
);

const legacyGardenSlots = heldDailyPet.garden.slots.map((slot, index) => {
  if (index !== 0) return slot;
  const {
    lastWateredDateKey: _lastWateredDateKey,
    lastFertilizedDateKey: _lastFertilizedDateKey,
    lastBoostedDateKey: _lastBoostedDateKey,
    ...legacySlot
  } = slot;
  return {
    ...legacySlot,
    lastWateredAt: later - 30 * minuteMs,
    lastFertilizedAt: later - 20 * minuteMs,
    lastBoostedAt: later - 10 * minuteMs,
  };
});
const legacyGardenPet = {
  ...heldDailyPet,
  garden: { ...heldDailyPet.garden, schemaVersion: 3, slots: legacyGardenSlots },
} as unknown as PetState;
const migratedLegacyGarden = advancePet(legacyGardenPet, earlier);
assert.equal(migratedLegacyGarden.garden.slots[0].lastWateredDateKey, earlierDateKey);
assert.equal(migratedLegacyGarden.garden.slots[0].lastFertilizedDateKey, earlierDateKey);
assert.equal(migratedLegacyGarden.garden.slots[0].lastBoostedDateKey, earlierDateKey);

const minorLater = earlier + dayMs;
const minorLaterDateKey = getDailyResetDateKey(minorLater);
const minorRollbackState: PetState = {
  ...createDefaultPet(minorLater),
  timeGuard: { schemaVersion: 1, lastObservedAt: minorLater, maxDailyDateKey: minorLaterDateKey },
  dailyBiscuitClaimDate: minorLaterDateKey,
  dailyBiscuitClaims: 2,
};
const minorRollback = reconcilePetClock(minorRollbackState, earlier);
assert.equal(minorRollback.dailyDateRebased, false);
assert.equal(minorRollback.pet.timeGuard.maxDailyDateKey, minorLaterDateKey);
assert.equal(minorRollback.pet.dailyBiscuitClaims, 2);

const staleFutureDailyState: PetState = {
  ...heldDailyPet,
  timeGuard: { schemaVersion: 1, lastObservedAt: earlier, maxDailyDateKey: laterDateKey },
  lastUpdatedAt: earlier,
  lastEnergyRecoveryAt: earlier,
};
const repairedStaleFutureDailyState = reconcilePetClock(staleFutureDailyState, earlier);
assert.equal(repairedStaleFutureDailyState.rolledBackByMs, 0);
assert.equal(repairedStaleFutureDailyState.dailyDateRebased, true);
assert.equal(repairedStaleFutureDailyState.pet.timeGuard.maxDailyDateKey, earlierDateKey);
assert.equal(repairedStaleFutureDailyState.pet.dailyBiscuitClaims, 2);

const deadlinePet = createDefaultPet(later);
const historicalUnlockAt = later - 20 * dayMs;
const deadlineState: PetState = {
  ...deadlinePet,
  lastUpdatedAt: later - 10 * minuteMs,
  lastEnergyRecoveryAt: later - 2 * minuteMs,
  sleepStartedAt: later - hourMs,
  lastInteractionAt: later - 5 * minuteMs,
  timeGuard: { schemaVersion: 1, lastObservedAt: later, maxDailyDateKey: laterDateKey },
  achievements: {
    ...deadlinePet.achievements,
    unlockedAtById: { first_feed: historicalUnlockAt },
  },
  pomodoro: {
    ...deadlinePet.pomodoro,
    isRunning: true,
    phaseStartedAt: later - 5 * minuteMs,
    phaseEndsAt: later + 20 * minuteMs,
    focusRewardCheckpointAt: later - 5 * minuteMs,
  },
  garden: {
    ...deadlinePet.garden,
    slots: deadlinePet.garden.slots.map((slot, index) => index === 0 ? {
      ...slot,
      unlocked: true,
      treeId: 'fruit_tree',
      state: 'growing',
      plantedAt: later - hourMs,
      lastWateredAt: later - 30 * minuteMs,
      naturalReadyAt: later + 2 * hourMs,
      nextReadyAt: later + 2 * hourMs,
      maxHarvests: 8,
    } : slot),
  },
  boostCards: {
    ...deadlinePet.boostCards,
    friendPassExpiresAt: later + dayMs,
    bestFriendPassExpiresAt: later + 2 * dayMs,
  },
  partnerSchedule: {
    ...deadlinePet.partnerSchedule,
    active: {
      offerId: 'clock-test',
      templateId: 'clock-test',
      category: 'study',
      size: 'short',
      startedAt: later - 10 * minuteMs,
      endsAt: later + hourMs,
      coinReward: 10,
      skillXp: 1,
      trophyRewardMultiplier: 1,
      grantsMasterCompletion: false,
    },
  },
};

const severeReconciliation = reconcilePetClock(deadlineState, earlier);
assert.equal(severeReconciliation.dailyDateRebased, true);
const reconciled = severeReconciliation.pet;
assert.equal(reconciled.lastUpdatedAt, earlier - 10 * minuteMs);
assert.equal(reconciled.pomodoro.phaseEndsAt - earlier, 20 * minuteMs);
assert.equal(reconciled.garden.slots[0].nextReadyAt - earlier, 2 * hourMs);
assert.equal(reconciled.boostCards.friendPassExpiresAt - earlier, dayMs);
assert.equal(reconciled.partnerSchedule.active!.endsAt - earlier, hourMs);
assert.equal(reconciled.garden.slots[0].lastWateredAt, deadlineState.garden.slots[0].lastWateredAt);
assert.equal(reconciled.achievements.unlockedAtById.first_feed, historicalUnlockAt);

const oneMinuteLater = reconcilePetClock(reconciled, earlier + minuteMs).pet;
assert.equal(oneMinuteLater.pomodoro.phaseEndsAt, reconciled.pomodoro.phaseEndsAt);
assert.equal(oneMinuteLater.garden.slots[0].nextReadyAt, reconciled.garden.slots[0].nextReadyAt);
assert.equal(oneMinuteLater.pomodoro.phaseEndsAt - (earlier + minuteMs), 19 * minuteMs);

const invalidGuard = normalizeTimeGuardState(
  { schemaVersion: 1, lastObservedAt: earlier, maxDailyDateKey: '9999-99-99' },
  { lastUpdatedAt: earlier },
  earlier,
);
assert.equal(invalidGuard.maxDailyDateKey, earlierDateKey);

const legacy = { ...createDefaultPet(later) } as unknown as Record<string, unknown>;
delete legacy.timeGuard;
delete legacy.dailyEncounterDateKey;
delete legacy.actionStreak;
delete legacy.pomodoro;
delete legacy.garden;
delete legacy.boostCards;
delete legacy.partnerSchedule;
const migratedLegacy = advancePet(legacy as unknown as PetState, earlier);
assert.equal(migratedLegacy.dailyEncounterDateKey, earlierDateKey);

const importedAgeSeconds = 2 * dayMs / 1000;
const importSource: PetState = {
  ...deadlinePet,
  createdAt: later - 2 * dayMs,
  metDate: { year: 2028, month: 5, day: 30 },
  ageSeconds: importedAgeSeconds,
  lastUpdatedAt: later,
  timeGuard: { schemaVersion: 1, lastObservedAt: later, maxDailyDateKey: laterDateKey },
  pomodoro: deadlineState.pomodoro,
  garden: deadlineState.garden,
  boostCards: deadlineState.boostCards,
};
const imported = parseSaveFileText(createSaveFileText(importSource, undefined, later), earlier).pet;
assert.equal(imported.timeGuard.lastObservedAt, earlier);
assert.equal(imported.timeGuard.maxDailyDateKey, earlierDateKey);
assert.equal(imported.createdAt, earlier - 2 * dayMs);
assert.deepEqual(imported.metDate, { year: 2027, month: 5, day: 30 });
assert.equal(imported.garden.slots[0].nextReadyAt - earlier, 2 * hourMs);
assert.equal(imported.boostCards.friendPassExpiresAt - earlier, dayMs);
assert.equal(imported.pomodoro.isRunning, false);
assert.equal(imported.pomodoro.pausedRemainingMs, 20 * minuteMs);
assert.equal(normalizePet(imported, earlier).timeGuard.lastObservedAt, earlier);

console.log('time guard checks passed');
