import { t } from '../i18n';
import { getDailyResetDateKey, isSameDailyResetDay, normalizeLegacyDailyDateKey } from './dailyReset';
import { ensureDailyWishForDate, maybeCreateReturnWelcome, returnWelcomeMinAwayMs } from './dailyWishes';
import { getAchievementEffects, incrementAchievementPomodoroFocus, incrementNaturalWake, recordEarnedCoins } from './achievements';
import { canClaimBoostCardDailyReward } from './boostCards';
import { advanceGarden } from './garden';
import { dailyBiscuitClaimLimit } from './items';
import { applyTimedEvent, getRandomDailyEncounter, getRandomOfflineDiary, getRandomOfflineEvent, maybeApplyDreamTalk, settleSleep, startSleepSnapshot } from './petEvents';
import { neighborGiftDailyLimit } from './neighbors';
import { clampCoins, clampCount, clampPetHealth, clampPetStat, criticalHungerActionThreshold, getEnergyRecoveryIntervalMs, getPetStatCap, lowEnergyThreshold } from './petStats';
import type { NeighborEventContext, PetState } from './petTypes';
import {
  getDefaultPomodoroRemainingMs,
  getPomodoroBonusReward,
  getPomodoroHourlyBaseCoins,
  getPomodoroMoodRewardBlocks,
  getPomodoroPhaseDurationMs,
  getPomodoroPhaseId,
  getPomodoroTargetBaseCoins,
  pickPomodoroActivity,
  pomodoroBonusRewardHourMs,
  pomodoroMinHealthThreshold,
} from './pomodoro';
import { normalizePet } from './petState';
import { advancePartnerSchedule, isPartnerSchedulePetBusy } from './partnerSchedule';
import { getCleanlinessDecaySeasonModifier, getMoodDecaySeasonModifier } from './season';
import { ensureYearlyStatsForDate, recordYearlyPomodoroFocus } from './yearlyStats';
import { getWeatherForDate } from './weather';
import { isNightTime } from './utils';

export const getEnergyRecoveryInfo = (pet: PetState, now = Date.now()) => {
  const current = normalizePet(pet, now);
  const statCap = getPetStatCap(current);
  const intervalMs = getEnergyRecoveryIntervalMs(current, current.isSleeping, now);
  if (current.energy >= statCap) {
    return { intervalMs, remainingMs: 0, isFull: true, isPaused: false };
  }

  if (isPartnerSchedulePetBusy(current)) {
    return { intervalMs, remainingMs: intervalMs, isFull: false, isPaused: true };
  }

  const startedAt = Math.min(current.lastEnergyRecoveryAt, now);
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = intervalMs - (elapsedMs % intervalMs);

  return {
    intervalMs,
    remainingMs: remainingMs === intervalMs && elapsedMs > 0 ? 0 : remainingMs,
    isFull: false,
    isPaused: false,
  };
};









export const getDailyBiscuitClaimInfo = (pet: PetState, now = Date.now()) => {
  const claimed =
    pet.dailyBiscuitClaimDate === getDailyResetDateKey(now)
      ? Math.min(dailyBiscuitClaimLimit, clampCount(pet.dailyBiscuitClaims))
      : 0;

  return {
    claimed,
    limit: dailyBiscuitClaimLimit,
    canClaim: claimed < dailyBiscuitClaimLimit,
  };
};


export const isPetLowEnergy = (pet: PetState) => pet.energy < lowEnergyThreshold;

export const isPetCriticallyHungry = (pet: PetState) => pet.hunger < criticalHungerActionThreshold;

export const canStartPomodoro = (pet: PetState) =>
  !isPetLowEnergy(pet) && pet.health > pomodoroMinHealthThreshold;

export const pausePomodoroForReason = (pet: PetState, now: number, recentEvent: string): PetState => {
  if (!pet.pomodoro.isRunning) {
    return { ...pet, recentEvent };
  }

  const pausedRemainingMs = Math.max(0, pet.pomodoro.phaseEndsAt - now);

  return {
    ...pet,
    recentEvent,
    pomodoro: {
      ...pet.pomodoro,
      isRunning: false,
      phaseStartedAt: 0,
      phaseEndsAt: 0,
      pausedRemainingMs:
        pausedRemainingMs > 0 ? pausedRemainingMs : getDefaultPomodoroRemainingMs(pet.pomodoro.phase, pet.pomodoro.settings),
    },
  };
};

export const advancePomodoro = (pet: PetState, now = Date.now()): PetState => {
  const persistedDailyFocusDate = normalizeLegacyDailyDateKey(pet.pomodoro.dailyFocusDate, now);
  const persistedDailyFocusCount = clampCount(pet.pomodoro.dailyCompletedFocusCount);
  let next = normalizePet(pet, now);
  let pomodoro = next.pomodoro;
  if (!pomodoro.isRunning) return next;
  if (persistedDailyFocusDate) {
    pomodoro = {
      ...pomodoro,
      dailyFocusDate: persistedDailyFocusDate,
      dailyCompletedFocusCount: persistedDailyFocusCount,
    };
  }

  let settledPhaseCount = 0;
  let settledFocusCount = 0;
  let settledShortBreakCount = 0;
  const settledFocusTimes: number[] = [];
  let maxSettledDailyFocusCount = pomodoro.dailyCompletedFocusCount;
  let earnedCoins = 0;
  let earnedMood = 0;
  let earnedBonusCoins = 0;
  let rewardChanged = false;
  let autoStopped = false;
  let activity = pomodoro.currentActivity;
  const today = getDailyResetDateKey(now);
  const maxSettlements = 1000;

  const settleFocusRewardsUntil = (focusUntil: number) => {
    if (!pomodoro.isRunning || pomodoro.phase !== 'focus' || pomodoro.phaseStartedAt <= 0) return;

    const phaseEnd = pomodoro.phaseEndsAt > 0 ? Math.min(focusUntil, pomodoro.phaseEndsAt) : focusUntil;
    const checkpoint = pomodoro.focusRewardCheckpointAt > 0 ? pomodoro.focusRewardCheckpointAt : pomodoro.phaseStartedAt;
    const rewardStart = Math.max(pomodoro.phaseStartedAt, checkpoint);
    const rewardEnd = Math.max(rewardStart, phaseEnd);
    const addedFocusMs = Math.max(0, rewardEnd - rewardStart);
    const sessionFocusMs = pomodoro.sessionFocusMs + addedFocusMs;
    const targetBaseCoins = getPomodoroTargetBaseCoins(sessionFocusMs, next.level);
    const baseCoins = Math.max(0, targetBaseCoins - pomodoro.baseRewardCoinsPaid);
    const hourlyBaseCoins = getPomodoroHourlyBaseCoins(next.level);
    const completedBonusHours = Math.floor(sessionFocusMs / pomodoroBonusRewardHourMs);
    let bonusRewardedHours = pomodoro.bonusRewardedHours;
    let bonusCoins = 0;

    while (bonusRewardedHours < completedBonusHours) {
      bonusRewardedHours += 1;
      bonusCoins += getPomodoroBonusReward(next, hourlyBaseCoins);
    }

    const moodRewardedBlocks = getPomodoroMoodRewardBlocks(sessionFocusMs);
    const mood = Math.max(0, moodRewardedBlocks - pomodoro.moodRewardedBlocks);

    if (baseCoins > 0 || bonusCoins > 0 || mood > 0) {
      rewardChanged = true;
      earnedCoins += baseCoins + bonusCoins + (baseCoins + bonusCoins > 0 ? getAchievementEffects(next).pomodoroCoinBonus : 0);
      earnedBonusCoins += bonusCoins;
      earnedMood += mood;
    }

    pomodoro = {
      ...pomodoro,
      focusRewardCheckpointAt: rewardEnd,
      sessionFocusMs,
      baseRewardCoinsPaid: targetBaseCoins,
      bonusRewardedHours,
      moodRewardedBlocks,
    };
  };

  while (pomodoro.isRunning && pomodoro.phaseEndsAt > 0 && pomodoro.phaseEndsAt <= now && settledPhaseCount < maxSettlements) {
    if (pomodoro.phase === 'focus') {
      settleFocusRewardsUntil(pomodoro.phaseEndsAt);
    }

    const phaseId = getPomodoroPhaseId(pomodoro);
    const shouldSettlePhase = pomodoro.lastSettledPhaseId !== phaseId;
    const phaseDateKey = getDailyResetDateKey(pomodoro.phaseEndsAt);
    const completedFocusCount = pomodoro.phase === 'focus' ? pomodoro.completedFocusCount + 1 : pomodoro.completedFocusCount;
    const dailyCompletedFocusCount =
      pomodoro.phase === 'focus'
        ? (pomodoro.dailyFocusDate === phaseDateKey ? pomodoro.dailyCompletedFocusCount : 0) + 1
        : pomodoro.dailyFocusDate === phaseDateKey
          ? pomodoro.dailyCompletedFocusCount
          : 0;
    const nextStartedAt = pomodoro.phaseEndsAt;

    if (shouldSettlePhase) {
      settledPhaseCount += 1;
      settledFocusCount += pomodoro.phase === 'focus' ? 1 : 0;
      settledShortBreakCount += pomodoro.phase === 'short_break' ? 1 : 0;
      if (pomodoro.phase === 'focus') {
        settledFocusTimes.push(pomodoro.phaseEndsAt);
        maxSettledDailyFocusCount = Math.max(maxSettledDailyFocusCount, dailyCompletedFocusCount);
      }
    }

    if (pomodoro.phase === 'short_break' && pomodoro.round >= pomodoro.settings.targetRounds) {
      autoStopped = true;
      pomodoro = {
        ...pomodoro,
        isRunning: false,
        phase: 'focus',
        phaseStartedAt: 0,
        phaseEndsAt: 0,
        round: 1,
        completedFocusCount,
        dailyFocusDate: phaseDateKey,
        dailyCompletedFocusCount,
        currentActivity: 'reading_books',
        lastSettledPhaseId: phaseId,
        pausedRemainingMs: getDefaultPomodoroRemainingMs('focus', pomodoro.settings),
        focusRewardCheckpointAt: 0,
      };
      break;
    }

    const nextPhase = pomodoro.phase === 'focus' ? 'short_break' : 'focus';
    const nextRound = pomodoro.phase === 'focus' ? pomodoro.round : Math.min(pomodoro.settings.targetRounds, pomodoro.round + 1);
    if (!next.isSleeping) {
      activity = pickPomodoroActivity();
    }
    pomodoro = {
      ...pomodoro,
      phase: nextPhase,
      phaseStartedAt: nextStartedAt,
      phaseEndsAt: nextStartedAt + getPomodoroPhaseDurationMs(nextPhase, pomodoro.settings),
      round: nextRound,
      completedFocusCount,
      dailyFocusDate: phaseDateKey,
      dailyCompletedFocusCount,
      currentActivity: activity,
      lastSettledPhaseId: phaseId,
      pausedRemainingMs: 0,
      focusRewardCheckpointAt: nextPhase === 'focus' ? nextStartedAt : 0,
    };
  }

  if (pomodoro.isRunning && pomodoro.phase === 'focus') {
    settleFocusRewardsUntil(now);
  }

  if (pomodoro.dailyFocusDate !== today) {
    pomodoro = { ...pomodoro, dailyFocusDate: today, dailyCompletedFocusCount: 0 };
  }

  next = {
    ...next,
    coins: clampCoins(next.coins + earnedCoins),
    mood: clampPetStat(next, next.mood + earnedMood),
    pomodoro,
    recentActivity: !pomodoro.isRunning ? 'idle' : next.isSleeping ? next.recentActivity : activity,
    recentActivityUntil: !pomodoro.isRunning ? 0 : next.isSleeping ? next.recentActivityUntil : pomodoro.phaseEndsAt > now ? pomodoro.phaseEndsAt : 0,
    lastInteractionAt: now,
  };

  settledFocusTimes.forEach((settledAt) => {
    next = recordYearlyPomodoroFocus(next, 1, settledAt);
  });
  next = ensureYearlyStatsForDate(next, now);
  next = recordEarnedCoins(
    incrementAchievementPomodoroFocus(next, settledFocusCount, maxSettledDailyFocusCount),
    earnedCoins,
  );

  if (settledPhaseCount > 0) {
    const parts = [
      settledFocusCount > 0 ? t('pet.pomodoro.phaseCount.focus', { count: settledFocusCount }) : '',
      settledShortBreakCount > 0 ? t('pet.pomodoro.phaseCount.short_break', { count: settledShortBreakCount }) : '',
    ].filter(Boolean);
    const prefix = settledPhaseCount === 1 ? t('pet.pomodoro.completePrefix') : t('pet.pomodoro.offlineSettlePrefix');
    const bonusText = earnedBonusCoins > 0 ? t('pet.pomodoro.bonusEvent', { coins: earnedBonusCoins }) : '';
    const autoStopText = autoStopped ? t('pet.pomodoro.autoStopped', { rounds: pomodoro.settings.targetRounds }) : '';
    next = {
      ...next,
      recentEvent: t('pet.pomodoro.settlementEvent', { prefix, parts: parts.join(t('common.comma')), mood: earnedMood, coins: earnedCoins }) + bonusText + autoStopText,
    };
  } else if (rewardChanged) {
    const minutes = Math.floor(pomodoro.sessionFocusMs / 60000);
    const bonusText = earnedBonusCoins > 0 ? t('pet.pomodoro.bonusEvent', { coins: earnedBonusCoins }) : '';
    next = {
      ...next,
      recentEvent: t('pet.pomodoro.rewardTick', { minutes, mood: earnedMood, coins: earnedCoins }) + bonusText,
    };
  }

  if (next.pomodoro.isRunning && isPetLowEnergy(next)) {
    return pausePomodoroForReason(next, now, t('pet.pomodoro.pause.lowEnergy', { name: next.name }));
  }

  if (next.pomodoro.isRunning && next.health <= pomodoroMinHealthThreshold) {
    return pausePomodoroForReason(next, now, t('pet.pomodoro.pause.lowHealth', { name: next.name }));
  }

  return next;
};

const applyDailyEncounter = (pet: PetState, now: number, eventContext?: NeighborEventContext): PetState => {
  if (isSameDailyResetDay(pet.lastDailyEncounterAt, now)) return pet;

  const giftCount = pet.neighborGiftDateKey === getDailyResetDateKey(now) ? pet.neighborGiftCount : 0;
  const randomGiftLimit = canClaimBoostCardDailyReward(pet, now) ? neighborGiftDailyLimit - 1 : neighborGiftDailyLimit;
  const encounter = getRandomDailyEncounter(pet.name, eventContext, giftCount < randomGiftLimit);
  return applyTimedEvent(pet, encounter, now, t('pet.prefix.dailyEncounter'));
};

export const advancePet = (pet: PetState, now = Date.now(), eventContext?: NeighborEventContext): PetState => {
  const prepared = advanceGarden(ensureDailyWishForDate(ensureYearlyStatsForDate(
    normalizePet(pet, now, { preserveExpiredPartnerSchedule: true }),
    now,
  ), now), now);
  const scheduleForInterval = prepared.partnerSchedule.active;
  const current = advancePartnerSchedule(prepared, now);
  const deltaMs = Math.max(0, now - current.lastUpdatedAt);
  const getProtectedScheduleMs = (from: number, to: number) => {
    if (!scheduleForInterval || to <= from) return 0;
    const overlapStart = Math.max(from, scheduleForInterval.startedAt);
    const overlapEnd = Math.min(to, scheduleForInterval.endsAt);
    return Math.max(0, overlapEnd - overlapStart);
  };
  const lifecycleDeltaMs = Math.max(0, deltaMs - getProtectedScheduleMs(current.lastUpdatedAt, now));
  const elapsedSeconds = lifecycleDeltaMs / 1000;
  const weather = getWeatherForDate(now);
  const weatherChanged = current.weatherDate !== getDailyResetDateKey(now) || current.weather !== weather;
  const currentWithWeather = weatherChanged
    ? {
        ...current,
        weatherDate: getDailyResetDateKey(now),
        weather,
      }
    : current;
  const currentWithPomodoro = currentWithWeather;
  const currentForActivity =
    currentWithPomodoro.pomodoro.isRunning
      ? { ...currentWithPomodoro, lastInteractionAt: now }
      : currentWithPomodoro;

  if (deltaMs < 1000) {
    return advancePomodoro(currentForActivity, now);
  }

  const statCap = getPetStatCap(currentForActivity);
  const weatherMoodModifier = weather === 'sunny' ? 0.75 : 1;
  const seasonMoodModifier = getMoodDecaySeasonModifier(now);
  const weatherCleanlinessModifier = weather === 'rainy' ? 1.3 : 1;
  const seasonCleanlinessModifier = getCleanlinessDecaySeasonModifier(now);
  const pressure = [currentForActivity.hunger <= 18, currentForActivity.cleanliness <= 22, currentForActivity.mood <= 18].filter(Boolean).length;
  const autoSleepByIdle =
    !currentForActivity.pomodoro.isRunning &&
    !currentForActivity.partnerSchedule.active &&
    !currentForActivity.isSleeping &&
    isNightTime(now) &&
    now - currentForActivity.lastInteractionAt >= 30 * 60 * 1000;
  const sleepingForDecay = currentForActivity.isSleeping || autoSleepByIdle;
  const hungerDelta = sleepingForDecay ? -(elapsedSeconds / 3600) * 2 : -(elapsedSeconds / 3600) * 7;
  const moodDelta = sleepingForDecay
    ? (elapsedSeconds / 3600) * 2
    : -(elapsedSeconds / 3600) * (pressure > 0 ? 5 : 2) * weatherMoodModifier * seasonMoodModifier;
  const cleanDelta = sleepingForDecay
    ? -(elapsedSeconds / 3600) * 1
    : -(elapsedSeconds / 3600) * 4 * weatherCleanlinessModifier * seasonCleanlinessModifier;
  const healthDelta =
    pressure >= 2
      ? -(elapsedSeconds / 3600) * 4
      : pressure === 0 && currentForActivity.health < statCap
        ? (elapsedSeconds / 3600) * 1.5
        : 0;

  const energyRecoveryIntervalMs = getEnergyRecoveryIntervalMs(currentForActivity, sleepingForDecay, now);
  const recoveryStartedAt = Math.min(currentForActivity.lastEnergyRecoveryAt, now);
  const elapsedRecoveryMs = Math.max(0, now - recoveryStartedAt - getProtectedScheduleMs(recoveryStartedAt, now));
  const recoverableEnergy = Math.max(0, statCap - currentForActivity.energy);
  const energyRecoveryPoints = currentForActivity.energy >= statCap ? 0 : Math.floor(elapsedRecoveryMs / energyRecoveryIntervalMs);
  const recoveredEnergy = Math.min(recoverableEnergy, energyRecoveryPoints);
  const energy = clampPetStat(currentForActivity, currentForActivity.energy + recoveredEnergy);
  const lastEnergyRecoveryAt = energy >= statCap
    ? now
    : now - (elapsedRecoveryMs % energyRecoveryIntervalMs);

  const hunger = clampPetStat(currentForActivity, currentForActivity.hunger + hungerDelta);
  const mood = clampPetStat(currentForActivity, currentForActivity.mood + moodDelta);
  const cleanliness = clampPetStat(currentForActivity, currentForActivity.cleanliness + cleanDelta);
  const health = clampPetHealth(currentForActivity, currentForActivity.health + healthDelta);
  const ageSeconds = currentForActivity.ageSeconds + deltaMs / 1000;
  const keepSleepingAtNight =
    sleepingForDecay && isNightTime(now) && now - currentForActivity.lastInteractionAt >= 30 * 60 * 1000;
  const wokeUp = currentForActivity.isSleeping && energy >= statCap && !keepSleepingAtNight;

  let recentEvent = currentForActivity.recentEvent;
  let recentActivity = currentForActivity.recentActivityUntil > now ? currentForActivity.recentActivity : 'idle';
  let recentActivityUntil = currentForActivity.recentActivityUntil > now ? currentForActivity.recentActivityUntil : 0;
  const offlineDiaryDue = !currentForActivity.pomodoro.isRunning && lifecycleDeltaMs >= 30 * 60 * 1000;
  const offlineEventDue = !currentForActivity.pomodoro.isRunning && lifecycleDeltaMs >= 2 * 60 * 60 * 1000;
  if (wokeUp) {
    recentEvent = t('pet.advance.wokeUp', { name: currentForActivity.name });
  } else if (autoSleepByIdle) {
    recentEvent = t('pet.advance.autoSleep', { name: currentForActivity.name });
  } else if (offlineDiaryDue) {
    recentEvent = t('pet.prefix.offlineDiary') + getRandomOfflineDiary(currentForActivity.name, weather);
  } else if (hunger <= 10) {
    recentEvent = t('pet.advance.hungerCritical', { name: currentForActivity.name });
  } else if (pressure >= 2) {
    recentEvent = t('pet.advance.needsCare', { name: currentForActivity.name });
  }

  let next: PetState = {
    ...currentForActivity,
    hunger,
    mood,
    cleanliness,
    energy,
    health,
    ageSeconds,
    isSleeping: wokeUp ? false : sleepingForDecay,
    lastEnergyRecoveryAt,
    lastUpdatedAt: now,
    recentEvent,
    recentActivity,
    recentActivityUntil,
  };

  if (autoSleepByIdle) {
    next = startSleepSnapshot(next, now);
  }

  if (wokeUp) {
    const settled = incrementNaturalWake(settleSleep(next, now));
    return !currentForActivity.pomodoro.isRunning && deltaMs >= returnWelcomeMinAwayMs
      ? maybeCreateReturnWelcome(settled, deltaMs, now)
      : settled;
  }

  next = maybeApplyDreamTalk(next, now);

  next = advancePomodoro(next, now);

  if (!currentForActivity.pomodoro.isRunning && deltaMs >= returnWelcomeMinAwayMs) {
    const withReturnWelcome = maybeCreateReturnWelcome(next, deltaMs, now);
    if (withReturnWelcome.returnWelcome && !withReturnWelcome.returnWelcome.claimedAt) {
      return withReturnWelcome;
    }
    next = withReturnWelcome;
  }

  if (currentForActivity.partnerSchedule.active) {
    return next;
  }

  if (offlineEventDue) {
    const giftCount = next.neighborGiftDateKey === getDailyResetDateKey(now) ? next.neighborGiftCount : 0;
    const randomGiftLimit = canClaimBoostCardDailyReward(next, now) ? neighborGiftDailyLimit - 1 : neighborGiftDailyLimit;
    return applyTimedEvent(
      next,
      getRandomOfflineEvent(next.name, weather, eventContext, giftCount < randomGiftLimit),
      now,
      t('pet.prefix.offlineEvent'),
    );
  }

  if (offlineDiaryDue) {
    return next;
  }

  return applyDailyEncounter(next, now, eventContext);
};

