import { t } from '../i18n';
import { dailyBiscuitClaimLimit, allItemIds } from './items';
import { clampCoins, clampCount, clampHealth, clampLevel, clampStat, defaultPetName, getPetStatCap } from './petStats';
import type { ActionStreak, Inventory, ItemId, PetState, PetStatus, RecentActivity, WeatherType } from './petTypes';
import { defaultPomodoroState, normalizePomodoroState } from './pomodoro';
import { getWeatherForDate, weatherTypeSet } from './weather';
import { getLocalDateKey, isNumber } from './utils';

export const defaultActionStreak = (now: number): ActionStreak => ({
  key: 'none',
  count: 0,
  windowStartedAt: now,
  lastAt: 0,
});

export const recentActivities = new Set<RecentActivity>([
  'idle',
  'happy',
  'bath',
  'eat_cookie',
  'eat_noodles',
  'eat_meat',
  'give_heart',
  'level_up',
  'reading_books',
  'workout',
  'work_food',
  'work_plants',
]);

export const isRecentActivity = (value: unknown): value is RecentActivity =>
  typeof value === 'string' && recentActivities.has(value as RecentActivity);

export const createDefaultPet = (now = Date.now()): PetState => ({
  name: defaultPetName,
  level: 1,
  hunger: 78,
  mood: 72,
  cleanliness: 82,
  energy: 76,
  health: 90,
  ageSeconds: 0,
  lastUpdatedAt: now,
  isSleeping: false,
  recentEvent: t('pet.default.recentEvent'),
  recentActivity: 'idle',
  recentActivityUntil: 0,
  coins: 30,
  hearts: 0,
  inventory: { emergency_biscuit: 1 },
  lastDailyRewardAt: now,
  lastDailyEncounterAt: now,
  dailyBiscuitClaimDate: getLocalDateKey(now),
  dailyBiscuitClaims: 0,
  dailyDiscountDate: getLocalDateKey(now),
  dailyDiscountUsed: false,
  weatherDate: getLocalDateKey(now),
  weather: getWeatherForDate(now),
  lastEnergyRecoveryAt: now,
  sleepStartedAt: 0,
  sleepStartMood: 0,
  sleepStartHunger: 0,
  sleepStartCleanliness: 0,
  lastDreamTalkAt: 0,
  actionStreak: defaultActionStreak(now),
  lastInteractionAt: now,
  lastPetInteractionAt: 0,
  pomodoro: defaultPomodoroState(now),
});

export const getPrimaryStatus = (pet: PetState): PetStatus => {
  if (pet.isSleeping) return 'sleeping';
  if (pet.health <= 35) return 'sick';
  if (pet.hunger <= 32) return 'hungry';
  if (pet.cleanliness <= 32) return 'dirty';
  if (pet.energy <= 28) return 'tired';
  if (pet.mood <= 30) return 'sad';
  return 'content';
};

export const getStatusText = (status: PetStatus) => {
  const labels: Record<PetStatus, string> = {
    content: t('pet.status.content'),
    hungry: t('pet.status.hungry'),
    sad: t('pet.status.sad'),
    dirty: t('pet.status.dirty'),
    tired: t('pet.status.tired'),
    sick: t('pet.status.sick'),
    sleeping: t('pet.status.sleeping'),
  };
  return labels[status];
};

export const normalizePet = (value: unknown, now = Date.now()): PetState => {
  const fallback = createDefaultPet(now);
  if (!value || typeof value !== 'object') return fallback;

  const raw = value as Record<string, unknown>;
  const ageSeconds = Math.max(0, isNumber(raw.ageSeconds) ? raw.ageSeconds : fallback.ageSeconds);
  const rawInventory = raw.inventory && typeof raw.inventory === 'object' ? (raw.inventory as Record<string, unknown>) : {};
  const inventory: Inventory = {};
  const dailyDiscountDate =
    typeof raw.dailyDiscountDate === 'string' ? raw.dailyDiscountDate : fallback.dailyDiscountDate;
  const weatherDate = typeof raw.weatherDate === 'string' ? raw.weatherDate : fallback.weatherDate;
  const weather =
    weatherDate === getLocalDateKey(now) && typeof raw.weather === 'string' && weatherTypeSet.has(raw.weather as WeatherType)
      ? (raw.weather as WeatherType)
      : getWeatherForDate(now);
  const rawActionStreak =
    raw.actionStreak && typeof raw.actionStreak === 'object' ? (raw.actionStreak as Record<string, unknown>) : {};
  const actionStreakKey =
    typeof rawActionStreak.key === 'string' &&
    ['play', 'clean', 'work', 'feed', 'gift', 'touch', 'none'].includes(rawActionStreak.key)
      ? (rawActionStreak.key as ActionStreak['key'])
      : 'none';

  for (const [key, amount] of Object.entries(rawInventory)) {
    if (allItemIds.has(key as ItemId) && isNumber(amount) && amount > 0) {
      inventory[key as ItemId] = Math.floor(amount);
    }
  }

  const level = clampLevel(isNumber(raw.level) ? raw.level : fallback.level);
  const statCap = getPetStatCap(level);

  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 16) : fallback.name,
    level,
    hunger: clampStat(isNumber(raw.hunger) ? raw.hunger : fallback.hunger, statCap),
    mood: clampStat(isNumber(raw.mood) ? raw.mood : fallback.mood, statCap),
    cleanliness: clampStat(isNumber(raw.cleanliness) ? raw.cleanliness : fallback.cleanliness, statCap),
    energy: clampStat(isNumber(raw.energy) ? raw.energy : fallback.energy, statCap),
    health: clampHealth(isNumber(raw.health) ? raw.health : fallback.health, statCap),
    ageSeconds,
    lastUpdatedAt: isNumber(raw.lastUpdatedAt) ? raw.lastUpdatedAt : now,
    isSleeping: Boolean(raw.isSleeping),
    recentEvent: typeof raw.recentEvent === 'string' ? raw.recentEvent : t('pet.default.welcomeBack'),
    recentActivity: isRecentActivity(raw.recentActivity) ? raw.recentActivity : 'idle',
    recentActivityUntil: isNumber(raw.recentActivityUntil) ? raw.recentActivityUntil : 0,
    coins: clampCoins(isNumber(raw.coins) ? raw.coins : fallback.coins),
    hearts: clampCount(isNumber(raw.hearts) ? raw.hearts : fallback.hearts),
    inventory,
    lastDailyRewardAt: isNumber(raw.lastDailyRewardAt) ? raw.lastDailyRewardAt : now,
    lastDailyEncounterAt: isNumber(raw.lastDailyEncounterAt)
      ? raw.lastDailyEncounterAt
      : isNumber(raw.lastDailyRewardAt)
        ? raw.lastDailyRewardAt
        : now,
    dailyBiscuitClaimDate:
      typeof raw.dailyBiscuitClaimDate === 'string' ? raw.dailyBiscuitClaimDate : fallback.dailyBiscuitClaimDate,
    dailyBiscuitClaims: Math.min(
      dailyBiscuitClaimLimit,
      clampCount(isNumber(raw.dailyBiscuitClaims) ? raw.dailyBiscuitClaims : fallback.dailyBiscuitClaims),
    ),
    dailyDiscountDate,
    dailyDiscountUsed: dailyDiscountDate === getLocalDateKey(now) ? Boolean(raw.dailyDiscountUsed) : false,
    weatherDate: getLocalDateKey(now),
    weather,
    lastEnergyRecoveryAt: isNumber(raw.lastEnergyRecoveryAt) ? raw.lastEnergyRecoveryAt : now,
    sleepStartedAt: isNumber(raw.sleepStartedAt) ? raw.sleepStartedAt : 0,
    sleepStartMood: clampStat(isNumber(raw.sleepStartMood) ? raw.sleepStartMood : 0, statCap),
    sleepStartHunger: clampStat(isNumber(raw.sleepStartHunger) ? raw.sleepStartHunger : 0, statCap),
    sleepStartCleanliness: clampStat(isNumber(raw.sleepStartCleanliness) ? raw.sleepStartCleanliness : 0, statCap),
    lastDreamTalkAt: isNumber(raw.lastDreamTalkAt) ? raw.lastDreamTalkAt : 0,
    actionStreak: {
      key: actionStreakKey,
      count: clampCount(isNumber(rawActionStreak.count) ? rawActionStreak.count : 0),
      windowStartedAt: isNumber(rawActionStreak.windowStartedAt) ? rawActionStreak.windowStartedAt : now,
      lastAt: isNumber(rawActionStreak.lastAt) ? rawActionStreak.lastAt : 0,
    },
    lastInteractionAt: isNumber(raw.lastInteractionAt)
      ? raw.lastInteractionAt
      : isNumber(raw.lastUpdatedAt)
        ? raw.lastUpdatedAt
        : now,
    lastPetInteractionAt: isNumber(raw.lastPetInteractionAt) ? raw.lastPetInteractionAt : 0,
    pomodoro: normalizePomodoroState(raw.pomodoro, now),
  };
};
