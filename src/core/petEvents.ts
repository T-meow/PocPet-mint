import { pick, t } from '../i18n';
import { addInventoryItem } from './items';
import { clampCoins, clampCount, clampPetHealth, clampPetStat } from './petStats';
import type { ItemEffect, ItemId, PetState, WeatherType } from './petTypes';
import { hashString, pickRandom } from './utils';

export interface DailyEncounter {
  coins?: number;
  hearts?: number;
  itemId?: ItemId;
  itemAmount?: number;
  effect?: ItemEffect;
  text: string;
}

export interface TimedEvent {
  coins?: number;
  hearts?: number;
  itemId?: ItemId;
  itemAmount?: number;
  effect?: ItemEffect;
  text: string;
}

const dreamEventMinSleepMinutes = 15;

export const dreamTalkStartDelayMs = 8 * 60 * 1000;

export const dreamTalkCooldownMs = 15 * 60 * 1000;

export const getRandomDailyEncounter = (name: string): DailyEncounter =>
  pickRandom([
    {
      coins: 18,
      text: t('pet.dailyEncounter.coins', { name }),
    },
    {
      itemId: 'emergency_biscuit',
      itemAmount: 1,
      text: t('pet.dailyEncounter.biscuit'),
    },
    {
      effect: { mood: 8, cleanliness: -2 },
      text: t('pet.dailyEncounter.sun', { name }),
    },
    {
      effect: { energy: 10 },
      text: t('pet.dailyEncounter.rest', { name }),
    },
    {
      effect: { hunger: 10, cleanliness: -3 },
      text: t('pet.dailyEncounter.snack', { name }),
    },
    {
      effect: { mood: -5 },
      text: t('pet.dailyEncounter.nightmare', { name }),
    },
    {
      hearts: 1,
      text: t('pet.dailyEncounter.heart', { name }),
    },
  ]);

export const getRandomOfflineDiary = (name: string, weather: WeatherType) => pick(`pet.offlineDiary.${weather}`, { name });

export const getRandomOfflineEvent = (name: string, weather: WeatherType): TimedEvent =>
  pickRandom([
    {
      coins: 12,
      text: t('pet.offlineEvent.coins', { name }),
    },
    {
      itemId: 'emergency_biscuit',
      itemAmount: 1,
      text: t('pet.offlineEvent.biscuit'),
    },
    {
      hearts: 1,
      text: t('pet.offlineEvent.heart', { name }),
    },
    {
      effect: { mood: 6, cleanliness: -2 },
      text: weather === 'sunny' ? t('pet.offlineEvent.sunnyPlay', { name }) : t('pet.offlineEvent.play', { name }),
    },
    {
      effect: { hunger: -4, mood: 4 },
      text: t('pet.offlineEvent.hungryHappy', { name }),
    },
    {
      effect: { energy: 8 },
      text: t('pet.offlineEvent.rest', { name }),
    },
    {
      effect: { cleanliness: -5 },
      text: t('pet.offlineEvent.mess', { name }),
    },
  ]);

export const getRandomDreamEvent = (name: string): TimedEvent =>
  pickRandom([
    {
      effect: { mood: 3 },
      text: t('pet.dreamEvent.cloudNap', { name }),
    },
    {
      coins: 10,
      text: t('pet.dreamEvent.coinPath', { name }),
    },
    {
      hearts: 1,
      text: t('pet.dreamEvent.sticker', { name }),
    },
    {
      itemId: 'emergency_biscuit',
      itemAmount: 1,
      text: t('pet.dreamEvent.biscuit'),
    },
    {
      effect: { energy: 4, cleanliness: -1 },
      text: t('pet.dreamEvent.puddleRun', { name }),
    },
  ]);

export const applyTimedEvent = (pet: PetState, event: TimedEvent, now: number, prefix: string): PetState => {
  const effect = event.effect ?? {};

  return {
    ...pet,
    hunger: clampPetStat(pet, pet.hunger + (effect.hunger ?? 0)),
    mood: clampPetStat(pet, pet.mood + (effect.mood ?? 0)),
    cleanliness: clampPetStat(pet, pet.cleanliness + (effect.cleanliness ?? 0)),
    energy: clampPetStat(pet, pet.energy + (effect.energy ?? 0)),
    health: clampPetHealth(pet, pet.health + (effect.health ?? 0)),
    coins: clampCoins(pet.coins + (event.coins ?? 0)),
    hearts: clampCount(pet.hearts + (event.hearts ?? 0)),
    inventory: event.itemId ? addInventoryItem(pet.inventory, event.itemId, event.itemAmount ?? 1) : pet.inventory,
    recentEvent: `${prefix}${event.text}`,
    lastDailyRewardAt: prefix === t('pet.prefix.dailyEncounter') ? now : pet.lastDailyRewardAt,
    lastDailyEncounterAt: prefix === t('pet.prefix.dailyEncounter') ? now : pet.lastDailyEncounterAt,
  };
};

const addEffects = (left?: ItemEffect, right?: ItemEffect): ItemEffect | undefined => {
  if (!left && !right) return undefined;
  return {
    hunger: (left?.hunger ?? 0) + (right?.hunger ?? 0),
    mood: (left?.mood ?? 0) + (right?.mood ?? 0),
    cleanliness: (left?.cleanliness ?? 0) + (right?.cleanliness ?? 0),
    energy: (left?.energy ?? 0) + (right?.energy ?? 0),
    health: (left?.health ?? 0) + (right?.health ?? 0),
  };
};

const addDreamEvent = (event: TimedEvent, pet: PetState, sleptMinutes: number): TimedEvent => {
  if (sleptMinutes < dreamEventMinSleepMinutes) return event;

  const dream = getRandomDreamEvent(pet.name);
  return {
    effect: addEffects(event.effect, dream.effect),
    coins: (event.coins ?? 0) + (dream.coins ?? 0),
    hearts: (event.hearts ?? 0) + (dream.hearts ?? 0),
    itemId: dream.itemId ?? event.itemId,
    itemAmount: dream.itemId ? dream.itemAmount ?? 1 : event.itemAmount,
    text: `${event.text} ${t('pet.prefix.dreamEvent')}${dream.text}`,
  };
};

const getSleepSettlement = (pet: PetState, now: number): TimedEvent => {
  const sleptMinutes = pet.sleepStartedAt > 0 ? Math.floor((now - pet.sleepStartedAt) / 60000) : 0;
  const startMood = pet.sleepStartMood || pet.mood;
  const startHunger = pet.sleepStartHunger || pet.hunger;
  const startCleanliness = pet.sleepStartCleanliness || pet.cleanliness;

  if (sleptMinutes < 10) {
    return {
      effect: { mood: -1 },
      text: t('pet.sleepSettlement.tooShort', { name: pet.name }),
    };
  }

  if (startMood <= 25 || startHunger <= 25 || startCleanliness <= 25) {
    return addDreamEvent({
      effect: { mood: -3, health: -1 },
      text: t('pet.sleepSettlement.bad', { name: pet.name }),
    }, pet, sleptMinutes);
  }

  if (startMood >= 60 && startHunger >= 45 && startCleanliness >= 45 && sleptMinutes >= 20) {
    return addDreamEvent({
      effect: { mood: 4, energy: 5 },
      text: t('pet.sleepSettlement.good', { name: pet.name }),
    }, pet, sleptMinutes);
  }

  return addDreamEvent({
    effect: { mood: 2 },
    text: t('pet.sleepSettlement.normal', { name: pet.name }),
  }, pet, sleptMinutes);
};

export const resetSleepSnapshot = (pet: PetState): PetState => ({
  ...pet,
  sleepStartedAt: 0,
  sleepStartMood: 0,
  sleepStartHunger: 0,
  sleepStartCleanliness: 0,
  lastDreamTalkAt: 0,
});

export const startSleepSnapshot = (pet: PetState, now: number): PetState => ({
  ...pet,
  sleepStartedAt: pet.sleepStartedAt > 0 ? pet.sleepStartedAt : now,
  sleepStartMood: pet.sleepStartedAt > 0 ? pet.sleepStartMood : pet.mood,
  sleepStartHunger: pet.sleepStartedAt > 0 ? pet.sleepStartHunger : pet.hunger,
  sleepStartCleanliness: pet.sleepStartedAt > 0 ? pet.sleepStartCleanliness : pet.cleanliness,
  lastDreamTalkAt: pet.sleepStartedAt > 0 ? pet.lastDreamTalkAt : 0,
});

export const settleSleep = (pet: PetState, now: number): PetState =>
  resetSleepSnapshot(applyTimedEvent(pet, getSleepSettlement(pet, now), now, t('pet.prefix.sleepSettlement')));

export const maybeApplyDreamTalk = (pet: PetState, now: number): PetState => {
  if (!pet.isSleeping || pet.sleepStartedAt <= 0) return pet;
  if (now - pet.sleepStartedAt < dreamTalkStartDelayMs) return pet;
  if (pet.lastDreamTalkAt > 0 && now - pet.lastDreamTalkAt < dreamTalkCooldownMs) return pet;

  const bucket = Math.floor(now / dreamTalkCooldownMs);
  const shouldTalk = hashString(`${pet.name}:${pet.sleepStartedAt}:${bucket}`) % 100 < 55;
  return {
    ...pet,
    lastDreamTalkAt: now,
    recentEvent: shouldTalk ? `${t('pet.prefix.dreamTalk')}${pick('pet.dreamTalk', { name: pet.name })}` : pet.recentEvent,
  };
};
