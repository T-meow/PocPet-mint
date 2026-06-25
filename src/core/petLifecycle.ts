import { t } from '../i18n';
import { dailyBiscuitClaimLimit } from './items';
import { applyTimedEvent, getRandomDailyEncounter, getRandomOfflineDiary, getRandomOfflineEvent, maybeApplyDreamTalk, settleSleep, startSleepSnapshot } from './petEvents';
import { clampCoins, clampCount, clampPetHealth, clampPetStat, getEnergyRecoveryIntervalMs, getPetStatCap, lowEnergyThreshold } from './petStats';
import type { PetState, PomodoroPhase } from './petTypes';
import { getDefaultPomodoroRemainingMs, getPomodoroPhaseDurationMs, getPomodoroPhaseId, getPomodoroReward, pickPomodoroActivity, pomodoroMinHealthThreshold } from './pomodoro';
import { normalizePet } from './petState';
import { getWeatherForDate } from './weather';
import { getLocalDateKey, isNightTime, isSameLocalDay } from './utils';

export const getEnergyRecoveryInfo = (pet: PetState, now = Date.now()) => {
  const current = normalizePet(pet, now);
  const statCap = getPetStatCap(current);
  const intervalMs = getEnergyRecoveryIntervalMs(current);
  if (current.energy >= statCap) {
    return { intervalMs, remainingMs: 0, isFull: true };
  }

  const startedAt = Math.min(current.lastEnergyRecoveryAt, now);
  const elapsedMs = Math.max(0, now - startedAt);
  const remainingMs = intervalMs - (elapsedMs % intervalMs);

  return {
    intervalMs,
    remainingMs: remainingMs === intervalMs && elapsedMs > 0 ? 0 : remainingMs,
    isFull: false,
  };
};









export const getDailyBiscuitClaimInfo = (pet: PetState, now = Date.now()) => {
  const claimed =
    pet.dailyBiscuitClaimDate === getLocalDateKey(now)
      ? Math.min(dailyBiscuitClaimLimit, clampCount(pet.dailyBiscuitClaims))
      : 0;

  return {
    claimed,
    limit: dailyBiscuitClaimLimit,
    canClaim: claimed < dailyBiscuitClaimLimit,
  };
};


export const isPetLowEnergy = (pet: PetState) => pet.energy < lowEnergyThreshold;

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
  let next = normalizePet(pet, now);
  let pomodoro = next.pomodoro;
  if (!pomodoro.isRunning) return next;


  let settledPhaseCount = 0;
  let settledFocusCount = 0;
  let settledShortBreakCount = 0;
  let settledLongBreakCount = 0;
  let earnedCoins = 0;
  let earnedMood = 0;
  let activity = pomodoro.currentActivity;
  const today = getLocalDateKey(now);
  const maxSettlements = 1000;

  while (pomodoro.isRunning && pomodoro.phaseEndsAt > 0 && pomodoro.phaseEndsAt <= now && settledPhaseCount < maxSettlements) {
    const phaseId = getPomodoroPhaseId(pomodoro);
    const shouldReward = pomodoro.lastSettledPhaseId !== phaseId;
    const phaseMinutes = Math.max(1, Math.round((pomodoro.phaseEndsAt - pomodoro.phaseStartedAt) / 60000));
    const reward = shouldReward ? getPomodoroReward(pomodoro.phase, phaseMinutes) : { coins: 0, mood: 0 };
    const completedFocusCount = pomodoro.phase === 'focus' ? pomodoro.completedFocusCount + 1 : pomodoro.completedFocusCount;
    const dailyCompletedFocusCount =
      pomodoro.phase === 'focus'
        ? (pomodoro.dailyFocusDate === today ? pomodoro.dailyCompletedFocusCount : 0) + 1
        : pomodoro.dailyFocusDate === today
          ? pomodoro.dailyCompletedFocusCount
          : 0;
    const nextPhase: PomodoroPhase =
      pomodoro.phase === 'focus' ? (completedFocusCount % 4 === 0 ? 'long_break' : 'short_break') : 'focus';
    const nextRound = pomodoro.phase === 'focus' ? pomodoro.round : pomodoro.round + 1;
    const nextStartedAt = pomodoro.phaseEndsAt;

    if (shouldReward) {
      settledPhaseCount += 1;
      earnedCoins += reward.coins;
      earnedMood += reward.mood;
      settledFocusCount += pomodoro.phase === 'focus' ? 1 : 0;
      settledShortBreakCount += pomodoro.phase === 'short_break' ? 1 : 0;
      settledLongBreakCount += pomodoro.phase === 'long_break' ? 1 : 0;
    }

    activity = pickPomodoroActivity();
    pomodoro = {
      ...pomodoro,
      phase: nextPhase,
      phaseStartedAt: nextStartedAt,
      phaseEndsAt: nextStartedAt + getPomodoroPhaseDurationMs(nextPhase, pomodoro.settings),
      round: nextRound,
      completedFocusCount,
      dailyFocusDate: today,
      dailyCompletedFocusCount,
      currentActivity: activity,
      lastSettledPhaseId: phaseId,
      pausedRemainingMs: 0,
    };
  }

  next = {
    ...next,
    coins: clampCoins(next.coins + earnedCoins),
    mood: clampPetStat(next, next.mood + earnedMood),
    pomodoro,
    recentActivity: activity,
    recentActivityUntil: pomodoro.phaseEndsAt > now ? pomodoro.phaseEndsAt : now + 3000,
    lastInteractionAt: now,
  };

  if (settledPhaseCount > 0) {
    const parts = [
      settledFocusCount > 0 ? t('pet.pomodoro.phaseCount.focus', { count: settledFocusCount }) : '',
      settledShortBreakCount > 0 ? t('pet.pomodoro.phaseCount.short_break', { count: settledShortBreakCount }) : '',
      settledLongBreakCount > 0 ? t('pet.pomodoro.phaseCount.long_break', { count: settledLongBreakCount }) : '',
    ].filter(Boolean);
    const prefix = settledPhaseCount === 1 ? t('pet.pomodoro.completePrefix') : t('pet.pomodoro.offlineSettlePrefix');
    next = {
      ...next,
      recentEvent: t('pet.pomodoro.settlementEvent', { prefix, parts: parts.join(t('common.comma')), mood: earnedMood, coins: earnedCoins }),
    };
  }

  if (isPetLowEnergy(next)) {
    return pausePomodoroForReason(next, now, t('pet.pomodoro.pause.lowEnergy', { name: next.name }));
  }

  if (next.health <= pomodoroMinHealthThreshold) {
    return pausePomodoroForReason(next, now, t('pet.pomodoro.pause.lowHealth', { name: next.name }));
  }

  return next;
};


const applyDailyEncounter = (pet: PetState, now: number): PetState => {
  if (isSameLocalDay(pet.lastDailyEncounterAt, now)) return pet;

  const encounter = getRandomDailyEncounter(pet.name);
  return applyTimedEvent(pet, encounter, now, t('pet.prefix.dailyEncounter'));
};

export const advancePet = (pet: PetState, now = Date.now()): PetState => {
  const current = normalizePet(pet, now);
  const deltaMs = Math.max(0, now - current.lastUpdatedAt);
  const elapsedSeconds = deltaMs / 1000;
  const weather = getWeatherForDate(now);
  const weatherChanged = current.weatherDate !== getLocalDateKey(now) || current.weather !== weather;
  const currentWithWeather = weatherChanged
    ? {
        ...current,
        weatherDate: getLocalDateKey(now),
        weather,
      }
    : current;
  const currentWithPomodoro = currentWithWeather;
  const currentForActivity =
    currentWithPomodoro.pomodoro.isRunning
      ? { ...currentWithPomodoro, lastInteractionAt: now }
      : currentWithPomodoro;

  if (elapsedSeconds < 1) {
    return advancePomodoro(currentForActivity, now);
  }

  const statCap = getPetStatCap(currentForActivity);
  const weatherMoodModifier = weather === 'sunny' ? 0.75 : 1;
  const weatherCleanlinessModifier = weather === 'rainy' ? 1.3 : 1;
  const pressure = [currentForActivity.hunger <= 18, currentForActivity.cleanliness <= 22, currentForActivity.mood <= 18].filter(Boolean).length;
  const autoSleepByIdle =
    !currentForActivity.pomodoro.isRunning &&
    !currentForActivity.isSleeping &&
    isNightTime(now) &&
    now - currentForActivity.lastInteractionAt >= 30 * 60 * 1000;
  const sleepingForDecay = currentForActivity.isSleeping || autoSleepByIdle;
  const hungerDelta = sleepingForDecay ? -(elapsedSeconds / 3600) * 2 : -(elapsedSeconds / 3600) * 7;
  const moodDelta = sleepingForDecay ? (elapsedSeconds / 3600) * 2 : -(elapsedSeconds / 3600) * (pressure > 0 ? 5 : 2) * weatherMoodModifier;
  const cleanDelta = sleepingForDecay ? -(elapsedSeconds / 3600) * 1 : -(elapsedSeconds / 3600) * 4 * weatherCleanlinessModifier;
  const healthDelta =
    pressure >= 2
      ? -(elapsedSeconds / 3600) * 4
      : pressure === 0 && currentForActivity.health < statCap
        ? (elapsedSeconds / 3600) * 1.5
        : 0;

  const energyRecoveryIntervalMs = getEnergyRecoveryIntervalMs(currentForActivity, sleepingForDecay);
  const recoveryStartedAt = Math.min(currentForActivity.lastEnergyRecoveryAt, now);
  const elapsedRecoveryMs = Math.max(0, now - recoveryStartedAt);
  const recoverableEnergy = Math.max(0, statCap - currentForActivity.energy);
  const energyRecoveryPoints = currentForActivity.energy >= statCap ? 0 : Math.floor(elapsedRecoveryMs / energyRecoveryIntervalMs);
  const recoveredEnergy = Math.min(recoverableEnergy, energyRecoveryPoints);
  const energy = clampPetStat(currentForActivity, currentForActivity.energy + recoveredEnergy);
  const lastEnergyRecoveryAt =
    energy >= statCap
      ? now
      : recoveredEnergy > 0
        ? recoveryStartedAt + energyRecoveryPoints * energyRecoveryIntervalMs
        : currentForActivity.lastEnergyRecoveryAt;

  const hunger = clampPetStat(currentForActivity, currentForActivity.hunger + hungerDelta);
  const mood = clampPetStat(currentForActivity, currentForActivity.mood + moodDelta);
  const cleanliness = clampPetStat(currentForActivity, currentForActivity.cleanliness + cleanDelta);
  const health = clampPetHealth(currentForActivity, currentForActivity.health + healthDelta);
  const ageSeconds = currentForActivity.ageSeconds + elapsedSeconds;
  const keepSleepingAtNight =
    sleepingForDecay && isNightTime(now) && now - currentForActivity.lastInteractionAt >= 30 * 60 * 1000;
  const wokeUp = currentForActivity.isSleeping && energy >= statCap && !keepSleepingAtNight;

  let recentEvent = currentForActivity.recentEvent;
  let recentActivity = currentForActivity.recentActivityUntil > now ? currentForActivity.recentActivity : 'idle';
  let recentActivityUntil = currentForActivity.recentActivityUntil > now ? currentForActivity.recentActivityUntil : 0;
  const offlineDiaryDue = !currentForActivity.pomodoro.isRunning && deltaMs >= 30 * 60 * 1000;
  const offlineEventDue = !currentForActivity.pomodoro.isRunning && deltaMs >= 2 * 60 * 60 * 1000;
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
    return settleSleep(next, now);
  }

  next = maybeApplyDreamTalk(next, now);

  next = advancePomodoro(next, now);

  if (offlineEventDue) {
    return applyTimedEvent(next, getRandomOfflineEvent(next.name, weather), now, t('pet.prefix.offlineEvent'));
  }

  if (offlineDiaryDue) {
    return next;
  }

  return applyDailyEncounter(next, now);
};



