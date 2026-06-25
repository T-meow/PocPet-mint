import { list, pick, t } from '../i18n';
import { clampPetHealth, clampPetStat } from './petStats';
import type { ActionStreak, CareActionKey, PetState, RecentActivity } from './petTypes';
import type { TimedEvent } from './petEvents';
import { randomInt } from './utils';

export const lowSleepMoodWarningThreshold = 25;

export const petInteractionCooldownMs = 1000;
export const petInteractionOveruseCooldownMs = 12 * 1000;


const overuseWindowMs = 10 * 60 * 1000;
const defaultOveruseThreshold = 3;
const overuseThresholds: Partial<Record<CareActionKey, number>> = {
  touch: 6,
};






export const getRandomPetInteractionCost = (name: string) => {
  const texts = list('pet.interaction.cost', { name });
  const options = [
    {
      hunger: 2,
      cleanliness: 0,
      energy: 1,
      text: texts[0] ?? '',
    },
    {
      hunger: 0,
      cleanliness: 3,
      energy: 0,
      text: texts[1] ?? '',
    },
    {
      hunger: 1,
      cleanliness: 2,
      energy: 0,
      text: texts[2] ?? '',
    },
    {
      hunger: 1,
      cleanliness: 0,
      energy: 2,
      text: texts[3] ?? '',
    },
  ];

  return options[Math.floor(Math.random() * options.length)];
};

export type ActionIncidentKind = 'play' | 'work';

export const getRandomHealthIncident = (kind: ActionIncidentKind) => {
  const triggered = Math.random() < (kind === 'play' ? 0.2 : 0.3);
  if (!triggered) return undefined;

  const amount = kind === 'play' ? randomInt(1, 3) : randomInt(2, 5);
  const text = pick(kind === 'play' ? 'pet.incident.play' : 'pet.incident.work', { amount });

  return { amount, text };
};

export const applyActionStreak = (pet: PetState, key: CareActionKey, now: number) => {
  const previous = pet.actionStreak;
  const count =
    previous.key === key && now - previous.windowStartedAt <= overuseWindowMs ? Math.min(previous.count + 1, 99) : 1;
  const nextStreak: ActionStreak = {
    key,
    count,
    windowStartedAt: previous.key === key && now - previous.windowStartedAt <= overuseWindowMs ? previous.windowStartedAt : now,
    lastAt: now,
  };

  const base = { ...pet, actionStreak: nextStreak };
  const threshold = overuseThresholds[key] ?? defaultOveruseThreshold;
  if (count < threshold) return { pet: base, text: '', triggered: false };

  const resetStreak: ActionStreak = {
    key: 'none',
    count: 0,
    windowStartedAt: now,
    lastAt: now,
  };

  const reactions: Record<CareActionKey, TimedEvent> = {
    play: {
      effect: { energy: -2, hunger: -2 },
      text: t('pet.streak.play', { name: pet.name }),
    },
    clean: {
      effect: { mood: -4, hunger: -1 },
      text: t('pet.streak.clean', { name: pet.name }),
    },
    work: {
      effect: { mood: -2, health: -2 },
      text: t('pet.streak.work', { name: pet.name }),
    },
    feed: {
      effect: { mood: -3, cleanliness: -1 },
      text: t('pet.streak.feed', { name: pet.name }),
    },
    gift: {
      effect: { mood: -2 },
      text: t('pet.streak.gift', { name: pet.name }),
    },
    touch: {
      effect: { mood: -3, energy: -1 },
      text: t('pet.streak.touch', { name: pet.name }),
    },
  };

  const reaction = reactions[key];
  return {
    pet: {
      ...base,
      actionStreak: resetStreak,
      hunger: clampPetStat(base, base.hunger + (reaction.effect?.hunger ?? 0)),
      mood: clampPetStat(base, base.mood + (reaction.effect?.mood ?? 0)),
      cleanliness: clampPetStat(base, base.cleanliness + (reaction.effect?.cleanliness ?? 0)),
      energy: clampPetStat(base, base.energy + (reaction.effect?.energy ?? 0)),
      health: clampPetHealth(base, base.health + (reaction.effect?.health ?? 0)),
    },
    text: reaction.text,
    triggered: true,
  };
};


export const withActivity = (pet: PetState, activity: RecentActivity, now: number, durationMs = 4500): PetState => ({
  ...pet,
  recentActivity: activity,
  recentActivityUntil: now + durationMs,
});

export const markInteraction = (pet: PetState, now: number): PetState => ({
  ...pet,
  lastInteractionAt: now,
});



