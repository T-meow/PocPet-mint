import { t } from '../i18n';
import { addInventoryItem, dailyBiscuitClaimLimit, favoriteFoodIdSet, getDailyShopDiscountInfo, getInventoryCount, getShopItem, giftItemIdSet, removeInventoryItem } from './items';
import { applyActionStreak, getRandomHealthIncident, getRandomPetInteractionCost, lowSleepMoodWarningThreshold, markInteraction, petInteractionCooldownMs, petInteractionOveruseCooldownMs, withActivity } from './petCommon';
import { advancePet, getDailyBiscuitClaimInfo, isPetLowEnergy, pausePomodoroForReason } from './petLifecycle';
import { clampCount, clampPetHealth, clampPetStat, getPetStatCap, getUpgradeHeartCost, maxPetLevel, statCapPerLevel } from './petStats';
import type { CareActionKey, ItemId, PetAction, PetState, PomodoroDurations, RecentActivity, UseInventoryItemOptions } from './petTypes';
import { defaultPomodoroState, getDefaultPomodoroRemainingMs, getPomodoroPhaseDurationMs, normalizePomodoroSettings, pickPomodoroActivity, pomodoroMinHealthThreshold, pomodoroPhaseLabels } from './pomodoro';
import { settleSleep, startSleepSnapshot } from './petEvents';
import { getLocalDateKey } from './utils';

export const recordPetInteraction = (pet: PetState, now = Date.now()): PetState =>
  markInteraction(advancePet(pet, now), now);

export const upgradePet = (pet: PetState, now = Date.now()): PetState => {
  const current = advancePet(pet, now);
  if (current.level >= maxPetLevel) {
    return { ...current, recentEvent: t('pet.upgrade.maxLevel', { level: current.level }) };
  }

  const nextLevel = current.level + 1;
  const cost = getUpgradeHeartCost(nextLevel);
  if (current.hearts < cost) {
    return { ...current, recentEvent: t('pet.upgrade.notEnoughHearts', { level: nextLevel, cost }) };
  }

  const next: PetState = {
    ...current,
    level: nextLevel,
    hearts: clampCount(current.hearts - cost),
    recentEvent: t('pet.upgrade.success', { level: nextLevel, cost, max: getPetStatCap(nextLevel) }),
    lastInteractionAt: now,
  };

  const upgraded = {
    ...next,
    hunger: clampPetStat(next, current.hunger + statCapPerLevel),
    mood: clampPetStat(next, current.mood + statCapPerLevel),
    cleanliness: clampPetStat(next, current.cleanliness + statCapPerLevel),
    energy: clampPetStat(next, current.energy + statCapPerLevel),
    health: clampPetHealth(next, current.health + statCapPerLevel),
  };

  return withActivity(upgraded, 'level_up', now, 4200);
};


export const applyPetAction = (pet: PetState, action: PetAction, now = Date.now()): PetState => {
  const current = markInteraction(advancePet(pet, now), now);

  if (action !== 'sleep' && current.isSleeping) {
    return {
      ...current,
      isSleeping: false,
      mood: clampPetStat(current, current.mood - 4),
      recentEvent: t('pet.action.woke', { name: current.name }),
    };
  }

  switch (action) {
    case 'play':
      if (isPetLowEnergy(current)) {
        return { ...current, recentEvent: t('pet.action.lowEnergyPlay', { name: current.name }) };
      }
      {
        const overuse = applyActionStreak(current, 'play', now);
        const base = overuse.pet;
        const incident = getRandomHealthIncident('play');
        const healthDrop = incident?.amount ?? 0;
        const incidentText = incident ? ` ${incident.text}` : '';

        return {
          ...withActivity(base, 'happy', now),
          mood: clampPetStat(base, base.mood + 18 + (base.weather === 'sunny' ? 2 : 0)),
          energy: clampPetStat(base, base.energy - 5),
          hunger: clampPetStat(base, base.hunger - 4),
          health: clampPetHealth(base, base.health - healthDrop),
          recentEvent: `${t('pet.action.play', { name: base.name })}${base.weather === 'sunny' ? t('pet.weather.effect.sunnyPlay') : ''}${incidentText}${overuse.text}`,
        };
      }
    case 'clean':
      {
        const overuse = applyActionStreak(current, 'clean', now);
        const base = overuse.pet;
        return {
          ...withActivity(base, 'bath', now),
          cleanliness: clampPetStat(base, base.cleanliness + 30 + (base.weather === 'rainy' ? 5 : 0)),
          energy: clampPetStat(base, base.energy + 2),
          hunger: clampPetStat(base, base.hunger - 3),
          mood: clampPetStat(base, base.mood + 1),
          health: clampPetHealth(base, base.health + 4),
          recentEvent: `${t('pet.action.clean', { name: base.name })}${base.weather === 'rainy' ? t('pet.weather.effect.rainyClean') : ''}${overuse.text}`,
        };
      }
    case 'work':
      if (isPetLowEnergy(current)) {
        return { ...current, recentEvent: t('pet.action.lowEnergyWork') };
      }
      {
        const overuse = applyActionStreak(current, 'work', now);
        const base = overuse.pet;
        const incident = getRandomHealthIncident('work');
        const healthDrop = incident?.amount ?? 0;
        const incidentText = incident ? ` ${incident.text}` : '';

        return {
          ...withActivity(base, Math.floor(base.ageSeconds / 60) % 2 === 0 ? 'work_food' : 'work_plants', now, 2200),
          coins: base.coins + (base.weather === 'rainy' ? 20 : 24),
          energy: clampPetStat(base, base.energy - (base.weather === 'breezy' ? 10 : 12)),
          mood: clampPetStat(base, base.mood - 5),
          hunger: clampPetStat(base, base.hunger - 6),
          health: clampPetHealth(base, base.health - healthDrop),
          recentEvent: `${t('pet.action.work', { name: base.name })}${base.weather === 'rainy' ? t('pet.weather.effect.rainyWork') : ''}${base.weather === 'breezy' ? t('pet.weather.effect.breezyWork') : ''}${incidentText}${overuse.text}`,
        };
      }
    case 'sleep':
      if (current.isSleeping) {
        return settleSleep(
          {
            ...current,
            isSleeping: false,
            mood: clampPetStat(current, current.mood - 2),
          },
          now,
        );
      }

      {
        return startSleepSnapshot(
          {
            ...current,
            isSleeping: true,
            recentEvent: current.pomodoro.isRunning
              ? t('pet.action.sleep.pomodoroPaused', { name: current.name })
              : current.mood <= lowSleepMoodWarningThreshold
                ? t('pet.action.sleep.lowMood', { name: current.name })
                : t('pet.action.sleep.normal', { name: current.name }),
          },
          now,
        );
      }
  }
};
export const buyItem = (pet: PetState, itemId: ItemId, now = Date.now()): PetState => {
  const current = markInteraction(advancePet(pet, now), now);
  const item = getShopItem(itemId);
  if (!item) return { ...current, recentEvent: t('pet.buy.missing') };

  if (itemId === 'emergency_biscuit') {
    const claimInfo = getDailyBiscuitClaimInfo(current, now);
    if (!claimInfo.canClaim) {
      return { ...current, recentEvent: t('pet.buy.biscuitClaimedOut') };
    }

    return {
      ...current,
      inventory: addInventoryItem(current.inventory, itemId, 1),
      dailyBiscuitClaimDate: getLocalDateKey(now),
      dailyBiscuitClaims: claimInfo.claimed + 1,
      recentEvent: t('pet.buy.freeClaim', {
        item: item.name,
        claimed: claimInfo.claimed + 1,
        limit: dailyBiscuitClaimLimit,
      }),
    };
  }

  const discountInfo = getDailyShopDiscountInfo(current, now);
  const isDiscountPurchase = discountInfo?.itemId === itemId && !discountInfo.used;
  const price = isDiscountPurchase ? discountInfo.price : item.price;

  if (current.coins < price) {
    return { ...current, recentEvent: t('pet.buy.notEnoughCoins', { item: item.name, price }) };
  }

  return {
    ...current,
    coins: current.coins - price,
    inventory: addInventoryItem(current.inventory, itemId, 1),
    dailyDiscountDate: isDiscountPurchase ? discountInfo.dateKey : current.dailyDiscountDate,
    dailyDiscountUsed: isDiscountPurchase ? true : current.dailyDiscountUsed,
    recentEvent: isDiscountPurchase
      ? t('pet.buy.discount', { item: item.name, price })
      : item.price === 0
        ? t('pet.buy.free', { item: item.name })
        : t('pet.buy.paid', { item: item.name }),
  };
};

export const useInventoryItem = (
  pet: PetState,
  itemId: ItemId,
  now = Date.now(),
  options: UseInventoryItemOptions = {},
): PetState => {
  const current = markInteraction(advancePet(pet, now), now);
  const item = getShopItem(itemId);
  if (!item) return { ...current, recentEvent: t('pet.item.missing') };
  const displayItemName = options.itemName ?? item.name;

  const count = getInventoryCount(current.inventory, itemId);
  if (count <= 0) {
    return { ...current, recentEvent: t('pet.item.empty', { item: displayItemName }) };
  }

  const wokePet = current.isSleeping;
  const effect = item.effect;
  const runtimeFavoriteFoodIdSet = options.favoriteFoodIds ? new Set<ItemId>(options.favoriteFoodIds) : favoriteFoodIdSet;
  const favoriteMoodBonus = runtimeFavoriteFoodIdSet.has(itemId) ? 4 : 0;
  const stickerHeartBonus = itemId === 'shiny_sticker' && Math.random() < 0.25 ? 1 : 0;
  const overuseKey: CareActionKey = item.kind === 'food' ? 'feed' : giftItemIdSet.has(itemId) ? 'gift' : 'touch';
  const overuse = applyActionStreak(current, overuseKey, now);
  const base = overuse.pet;
  const itemActivity: Record<ItemId, RecentActivity> = {
    emergency_biscuit: 'eat_cookie',
    bento: 'eat_noodles',
    nutri_meal: 'eat_meat',
    pig_trotter: 'eat_meat',
    strawberry_cake: 'eat_cookie',
    ad_milk: 'eat_cookie',
    small_bouquet: 'give_heart',
    shiny_sticker: 'give_heart',
    soft_cloud_doll: 'happy',
    ribbon_bell: 'give_heart',
    toy_ball: 'happy',
    shampoo: 'bath',
    medicine: 'give_heart',
    blanket: 'happy',
  };
  const baseEvent =
    item.kind === 'food'
      ? t(wokePet ? 'pet.item.use.foodWoke' : 'pet.item.use.food', { name: base.name, item: displayItemName })
      : giftItemIdSet.has(itemId)
        ? t('pet.item.use.gift', { name: base.name, item: displayItemName })
        : t(wokePet ? 'pet.item.use.careWoke' : 'pet.item.use.care', { name: base.name, item: displayItemName });
  const favoriteText =
    favoriteMoodBonus > 0
      ? options.favoriteText?.(favoriteMoodBonus) ?? t('pet.item.use.favorite', { amount: favoriteMoodBonus })
      : '';
  const stickerText =
    itemId === 'shiny_sticker'
      ? stickerHeartBonus > 0
        ? t('pet.item.use.stickerHeart')
        : t('pet.item.use.stickerSaved')
      : '';

  return {
    ...withActivity(base, itemActivity[itemId], now),
    isSleeping: false,
    hunger: clampPetStat(base, base.hunger + (effect.hunger ?? 0)),
    mood: clampPetStat(base, base.mood + (effect.mood ?? 0) + favoriteMoodBonus - (wokePet ? 2 : 0)),
    cleanliness: clampPetStat(base, base.cleanliness + (effect.cleanliness ?? 0)),
    energy: clampPetStat(base, base.energy + (effect.energy ?? 0)),
    health: clampPetHealth(base, base.health + (effect.health ?? 0)),
    hearts: clampCount(base.hearts + stickerHeartBonus),
    inventory: removeInventoryItem(base.inventory, itemId),
    recentEvent: `${baseEvent}${favoriteText}${stickerText}${overuse.text}`,
  };
};

export const interactWithPet = (pet: PetState, now = Date.now()): PetState => {
  const current = markInteraction(advancePet(pet, now), now);
  if (now - current.lastPetInteractionAt < petInteractionCooldownMs) {
    return {
      ...current,
      recentEvent: t('pet.interaction.cooldown', { name: current.name }),
    };
  }

  if (current.isSleeping) {
    return {
      ...current,
      lastPetInteractionAt: now,
      recentEvent: t('pet.interaction.sleeping', { name: current.name }),
    };
  }

  if (isPetLowEnergy(current)) {
    return {
      ...current,
      lastPetInteractionAt: now,
      recentEvent: t('pet.interaction.lowEnergy', { name: current.name }),
    };
  }

  const interactionCost = getRandomPetInteractionCost(current.name);
  const overuse = applyActionStreak(current, 'touch', now);
  const base = overuse.pet;

  if (base.mood >= 75 && base.health >= 40) {
    return {
      ...withActivity(base, 'give_heart', now, 3600),
      hearts: base.hearts + 1,
      mood: clampPetStat(base, base.mood - 12),
      hunger: clampPetStat(base, base.hunger - interactionCost.hunger),
      cleanliness: clampPetStat(base, base.cleanliness - interactionCost.cleanliness),
      energy: clampPetStat(base, base.energy - interactionCost.energy),
      lastPetInteractionAt: overuse.triggered ? now + petInteractionOveruseCooldownMs : now,
      recentEvent: overuse.triggered
        ? `${t('pet.interaction.heart', { name: base.name })}${interactionCost.text}${overuse.text} ${t('pet.interaction.overuseCooldown', { name: base.name })}`
        : `${t('pet.interaction.heart', { name: base.name })}${interactionCost.text}${overuse.text}`,
    };
  }

  return {
    ...withActivity(base, 'happy', now, 3200),
    mood: clampPetStat(base, base.mood + 5),
    hunger: clampPetStat(base, base.hunger - interactionCost.hunger),
    cleanliness: clampPetStat(base, base.cleanliness - interactionCost.cleanliness),
    energy: clampPetStat(base, base.energy - interactionCost.energy),
    lastPetInteractionAt: overuse.triggered ? now + petInteractionOveruseCooldownMs : now,
    recentEvent: overuse.triggered
      ? `${t('pet.interaction.touch', { name: base.name })}${interactionCost.text}${overuse.text} ${t('pet.interaction.overuseCooldown', { name: base.name })}`
      : `${t('pet.interaction.touch', { name: base.name })}${interactionCost.text}${overuse.text}`,
  };
};

export const startPomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = advancePet(pet, now);
  if (current.pomodoro.isRunning) return current;


  if (isPetLowEnergy(current)) {
    return { ...current, recentEvent: t('pet.pomodoro.start.lowEnergy', { name: current.name }) };
  }

  if (current.health <= pomodoroMinHealthThreshold) {
    return { ...current, recentEvent: t('pet.pomodoro.start.lowHealth', { name: current.name }) };
  }

  const remainingMs =
    current.pomodoro.pausedRemainingMs > 0
      ? current.pomodoro.pausedRemainingMs
      : getDefaultPomodoroRemainingMs(current.pomodoro.phase, current.pomodoro.settings);
  const activity = pickPomodoroActivity();
  const phaseEndsAt = now + remainingMs;

  return {
    ...current,
    lastInteractionAt: now,
    recentActivity: activity,
    recentActivityUntil: phaseEndsAt,
    recentEvent: t('pet.pomodoro.start.started', {
      name: current.name,
      phase: pomodoroPhaseLabels[current.pomodoro.phase],
    }),
    pomodoro: {
      ...current.pomodoro,
      isRunning: true,
      phaseStartedAt: now,
      phaseEndsAt,
      currentActivity: activity,
      pausedRemainingMs: 0,
    },
  };
};

export const pausePomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = advancePet(pet, now);
  if (!current.pomodoro.isRunning) return current;

  return pausePomodoroForReason(current, now, t('pet.pomodoro.pause.manual', { name: current.name }));
};
export const resetPomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = advancePet(pet, now);
  const today = getLocalDateKey(now);
  const settings = current.pomodoro.settings;
  const dailyCompletedFocusCount =
    current.pomodoro.dailyFocusDate === today ? current.pomodoro.dailyCompletedFocusCount : 0;

  return {
    ...current,
    recentEvent: t('pet.pomodoro.reset', { name: current.name }),
    recentActivity: 'idle',
    recentActivityUntil: 0,
    lastInteractionAt: now,
    pomodoro: {
      ...defaultPomodoroState(now),
      settings,
      dailyFocusDate: today,
      dailyCompletedFocusCount,
      pausedRemainingMs: getPomodoroPhaseDurationMs('focus', settings),
    },
  };
};

export const updatePomodoroSettings = (
  pet: PetState,
  settings: Partial<PomodoroDurations>,
  now = Date.now(),
): PetState => {
  const current = advancePet(pet, now);
  const nextSettings = normalizePomodoroSettings({
    ...current.pomodoro.settings,
    ...settings,
  });

  return {
    ...current,
    pomodoro: {
      ...current.pomodoro,
      settings: nextSettings,
      pausedRemainingMs: current.pomodoro.isRunning
        ? current.pomodoro.pausedRemainingMs
        : getDefaultPomodoroRemainingMs(current.pomodoro.phase, nextSettings),
    },
  };
};

export const renamePet = (pet: PetState, name: string): PetState => {
  const nextName = name.trim().slice(0, 16) || pet.name;
  return {
    ...pet,
    name: nextName,
    recentEvent: t('pet.rename.updated', { name: nextName }),
  };
};


