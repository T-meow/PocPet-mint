import { t } from '../i18n';
import { getDailyResetDateKey } from './dailyReset';
import { addInventoryItem, dailyBiscuitClaimLimit, favoriteFoodIdSet, getDailyHeartExchangeInfo, getDailyShopDiscountInfo, getInventoryCount, getInventoryItem, getShopItem, giftItemIdSet, heartExchangeCoins, removeInventoryItem } from './items';
import { applyBoostCardWorkBonus } from './boostCards';
import { applyActionStreak, getRandomHealthIncident, getRandomPetInteractionCost, lowSleepMoodWarningThreshold, markInteraction, petInteractionCooldownMs, petInteractionOveruseCooldownMs, withActivity } from './petCommon';
import { normalizePetBirthday } from './dateRewards';
import { applyHeartGain, getAchievementEffects, incrementAchievementCareAction, incrementAchievementItemUse, incrementAchievementPurchase, incrementAchievementSleepStart, incrementManualWake, recordCoinBalance, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { recordWishProgress } from './dailyWishes';
import { advancePet, getDailyBiscuitClaimInfo, isPetCriticallyHungry, isPetLowEnergy, pausePomodoroForReason } from './petLifecycle';
import { getCleanActionSeasonBonus, getWorkSeasonCoinBonus } from './season';
import { recordYearlyCareAction, recordYearlyItemUse } from './yearlyStats';
import { clampCoins, clampCount, clampPetEnergy, clampPetHealth, clampPetStat, getPetEnergyCap, getPetStatCap, getUpgradeHeartCost, lowCleanlinessSleepConfirmClicks, lowCleanlinessSleepMoodPenalty, lowCleanlinessSleepWarningThreshold, maxPetLevel, statCapPerLevel } from './petStats';
import type { BuiltinItemId, BuyItemOptions, CareActionKey, ItemId, PetAction, PetBirthday, PetState, PomodoroDurations, RecentActivity, UseInventoryItemOptions } from './petTypes';
import { defaultPomodoroState, getDefaultPomodoroRemainingMs, getPomodoroPhaseDurationMs, normalizePomodoroSettings, pickPomodoroActivity, pomodoroMinHealthThreshold, pomodoroPhaseLabels, pomodoroResetEventMinFocusMs } from './pomodoro';
import { settleSleep, startSleepSnapshot } from './petEvents';
import { getPartnerScheduleCrossSystemEffects } from './partnerScheduleEffects';
import { getClassicTrophyEffects } from './classicTrophies';
import { randomInt } from './utils';
import { isPartnerSchedulePetBusy } from './partnerSchedule';

const clearLowCleanlinessSleepConfirm = (pet: PetState): PetState =>
  pet.lowCleanlinessSleepConfirmCount > 0 ? { ...pet, lowCleanlinessSleepConfirmCount: 0 } : pet;

export const recordPetInteraction = (pet: PetState, now = Date.now()): PetState =>
  clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));

export const getWorkReward = (pet: PetState, now = Date.now()) => {
  const baseCoins = (pet.weather === 'rainy' ? 20 : 24) + Math.max(0, pet.level - 1) + getWorkSeasonCoinBonus(now);
  const statCap = getPetStatCap(pet);
  const moodRatio = statCap > 0 ? Math.max(0, Math.min(1, pet.mood / statCap)) : 0;
  const bonusChance = 0.05 + moodRatio * 0.4;
  const achievementBonusCoins = getAchievementEffects(pet).workCoinBonus;
  const boostBonus = applyBoostCardWorkBonus(pet, now);
  const bonusCoins =
    Math.random() < bonusChance
      ? Math.max(1, Math.floor(baseCoins * (randomInt(5, 15) / 100)))
      : 0;

  return {
    baseCoins,
    bonusCoins,
    boostBonusCoins: boostBonus.bonusCoins,
    boostCards: boostBonus.boostCards,
    totalCoins: baseCoins + bonusCoins + achievementBonusCoins + boostBonus.bonusCoins,
  };
};

export const upgradePet = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  if (isPartnerSchedulePetBusy(current)) {
    return { ...current, recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }) };
  }
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
    energy: clampPetEnergy(next, current.energy + statCapPerLevel),
    health: clampPetHealth(next, current.health + statCapPerLevel),
  };

  return withActivity(upgraded, 'level_up', now, 4200);
};


export const exchangeHeartForCoins = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  const exchangeInfo = getDailyHeartExchangeInfo(current, now);

  if (current.hearts < 1) {
    return { ...current, recentEvent: t('pet.exchange.notEnoughHearts') };
  }

  if (!exchangeInfo.canExchange) {
    return { ...current, recentEvent: t('pet.exchange.limitReached') };
  }

  return recordCoinBalance({
    ...current,
    hearts: clampCount(current.hearts - 1),
    coins: clampCoins(current.coins + heartExchangeCoins),
    dailyHeartExchangeDate: exchangeInfo.dateKey,
    dailyHeartExchangeCount: exchangeInfo.count + 1,
    recentEvent: t('pet.exchange.success', { coins: heartExchangeCoins }),
  });
};

export const applyPetAction = (pet: PetState, action: PetAction, now = Date.now()): PetState => {
  const advanced = markInteraction(advancePet(pet, now), now);
  const current = action === 'sleep' ? advanced : clearLowCleanlinessSleepConfirm(advanced);

  if (isPartnerSchedulePetBusy(current)) {
    return {
      ...current,
      recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }),
    };
  }

  if (action !== 'sleep' && current.isSleeping) {
    return incrementManualWake({
      ...current,
      isSleeping: false,
      mood: clampPetStat(current, current.mood - 4),
      lowCleanlinessSleepConfirmCount: 0,
      recentEvent: t('pet.action.woke', { name: current.name }),
    });
  }

  if (action !== 'sleep' && isPetCriticallyHungry(current)) {
    return {
      ...current,
      lowCleanlinessSleepConfirmCount: 0,
      recentEvent: t('pet.action.lowHungerBlocked', { name: current.name }),
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

        return incrementAchievementCareAction(recordWishProgress(recordYearlyCareAction({
          ...withActivity(base, 'happy', now),
          mood: clampPetStat(base, base.mood + 18 + (base.weather === 'sunny' ? 2 : 0)),
          energy: clampPetEnergy(base, base.energy - 3),
          hunger: clampPetStat(base, base.hunger - 4),
          health: clampPetHealth(base, base.health - healthDrop),
          recentEvent: `${t('pet.action.play', { name: base.name })}${base.weather === 'sunny' ? t('pet.weather.effect.sunnyPlay') : ''}${incidentText}${overuse.text}`,
        }, 'play', now), 'play', now), 'play');
      }
    case 'clean':
      {
        const overuse = applyActionStreak(current, 'clean', now);
        const base = overuse.pet;
        const seasonCleanBonus = getCleanActionSeasonBonus(now);
        const achievementCareBonus = getAchievementEffects(base).careStatBonus;
        return incrementAchievementCareAction(recordWishProgress(recordYearlyCareAction({
          ...withActivity(base, 'bath', now),
          cleanliness: clampPetStat(base, base.cleanliness + 30 + (base.weather === 'rainy' ? 5 : 0) + seasonCleanBonus + achievementCareBonus),
          energy: clampPetEnergy(base, base.energy - 3),
          hunger: clampPetStat(base, base.hunger - 3),
          mood: clampPetStat(base, base.mood + 1),
          health: clampPetHealth(base, base.health + 4 + achievementCareBonus),
          recentEvent: `${t('pet.action.clean', { name: base.name })}${base.weather === 'rainy' ? t('pet.weather.effect.rainyClean') : ''}${seasonCleanBonus > 0 ? t('pet.season.effect.summerClean') : ''}${overuse.text}`,
        }, 'clean', now), 'clean', now), 'clean');
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
        const reward = getWorkReward(base, now);
        const bonusText = reward.bonusCoins > 0 ? t('pet.action.workBonus', { coins: reward.bonusCoins }) : '';
        const boostBonusText = reward.boostBonusCoins > 0 ? t('pet.boostCards.workBonus', { coins: reward.boostBonusCoins }) : '';
        const seasonWorkText = getWorkSeasonCoinBonus(now) > 0 ? t('pet.season.effect.autumnWork') : '';

        return recordEarnedCoins(incrementAchievementCareAction(recordWishProgress(recordYearlyCareAction({
          ...withActivity(base, Math.floor(base.ageSeconds / 60) % 2 === 0 ? 'work_food' : 'work_plants', now, 2200),
          coins: base.coins + reward.totalCoins,
          boostCards: reward.boostCards,
          energy: clampPetEnergy(base, base.energy - (base.weather === 'breezy' ? 10 : 12)),
          mood: clampPetStat(base, base.mood - 5),
          hunger: clampPetStat(base, base.hunger - 6),
          health: clampPetHealth(base, base.health - healthDrop),
          recentEvent: `${t('pet.action.work', { name: base.name, coins: reward.totalCoins })}${bonusText}${boostBonusText}${base.weather === 'rainy' ? t('pet.weather.effect.rainyWork') : ''}${base.weather === 'breezy' ? t('pet.weather.effect.breezyWork') : ''}${seasonWorkText}${incidentText}${overuse.text}`,
        }, 'work', now), 'work', now), 'work'), reward.totalCoins);
      }
    case 'sleep':
      if (current.isSleeping) {
        return incrementManualWake(settleSleep(
          {
            ...current,
            isSleeping: false,
            lowCleanlinessSleepConfirmCount: 0,
            mood: clampPetStat(current, current.mood - 2),
          },
          now,
        ));
      }

      {
        const needsCleanlinessConfirm = current.cleanliness <= lowCleanlinessSleepWarningThreshold;
        const confirmCount = current.lowCleanlinessSleepConfirmCount;
        if (needsCleanlinessConfirm && confirmCount < lowCleanlinessSleepConfirmClicks - 1) {
          const nextCount = confirmCount + 1;
          return {
            ...current,
            lowCleanlinessSleepConfirmCount: nextCount,
            recentEvent: t(
              nextCount >= lowCleanlinessSleepConfirmClicks - 1
                ? 'pet.action.sleep.lowCleanlinessFinalWarning'
                : 'pet.action.sleep.lowCleanlinessWarning',
              { name: current.name, amount: lowCleanlinessSleepMoodPenalty },
            ),
          };
        }

        const cleanlinessMoodPenalty = needsCleanlinessConfirm ? lowCleanlinessSleepMoodPenalty : 0;
        return incrementAchievementSleepStart(recordWishProgress(
          startSleepSnapshot(
            {
              ...current,
              isSleeping: true,
              lowCleanlinessSleepConfirmCount: 0,
              mood: clampPetStat(current, current.mood - cleanlinessMoodPenalty),
              recentEvent: needsCleanlinessConfirm
                ? t('pet.action.sleep.lowCleanlinessStarted', { name: current.name, amount: lowCleanlinessSleepMoodPenalty })
                : current.pomodoro.isRunning
                  ? t('pet.action.sleep.pomodoroPaused', { name: current.name })
                  : current.mood <= lowSleepMoodWarningThreshold
                    ? t('pet.action.sleep.lowMood', { name: current.name })
                    : t('pet.action.sleep.normal', { name: current.name }),
            },
            now,
          ),
          'sleep',
          now,
        ));
      }
  }
};
export const buyItem = (pet: PetState, itemId: ItemId, now = Date.now(), options: BuyItemOptions = {}): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  const item = options.item ?? getShopItem(itemId);
  if (!item) return { ...current, recentEvent: t('pet.buy.missing') };
  const isShopAvailable = 'shop' in item ? item.shop : true;
  if (!isShopAvailable) return { ...current, recentEvent: t('pet.buy.missing') };

  if (itemId === 'emergency_biscuit') {
    const claimInfo = getDailyBiscuitClaimInfo(current, now);
    if (!claimInfo.canClaim) {
      return { ...current, recentEvent: t('pet.buy.biscuitClaimedOut') };
    }

    return incrementAchievementPurchase({
      ...current,
      inventory: addInventoryItem(current.inventory, itemId, 1),
      dailyBiscuitClaimDate: getDailyResetDateKey(now),
      dailyBiscuitClaims: claimInfo.claimed + 1,
      recentEvent: t('pet.buy.freeClaim', {
        item: item.name,
        claimed: claimInfo.claimed + 1,
        limit: dailyBiscuitClaimLimit,
      }),
    }, false);
  }

  const discountInfo = getDailyShopDiscountInfo(current, now);
  const discountEntry = discountInfo?.items.find((discountItem) => discountItem.itemId === itemId);
  const isDiscountPurchase = Boolean(discountEntry && !discountEntry.used);
  const price = isDiscountPurchase ? discountEntry?.price ?? item.price : item.price;
  const discountDateKey = discountInfo?.dateKey ?? current.dailyDiscountDate;
  const discountItemIds = discountInfo?.items.map((discountItem) => discountItem.itemId) ?? current.dailyDiscountItemIds;
  const migratedUsedDiscountItemIds =
    current.dailyDiscountDate === discountDateKey
      ? current.dailyDiscountUsedItemIds.length > 0
        ? current.dailyDiscountUsedItemIds
        : current.dailyDiscountUsed && discountItemIds[0]
          ? [discountItemIds[0]]
          : []
      : [];
  const nextDailyDiscountUsedItemIds = isDiscountPurchase
    ? Array.from(new Set([...migratedUsedDiscountItemIds, itemId as BuiltinItemId])).slice(0, 3)
    : current.dailyDiscountUsedItemIds;

  if (current.coins < price) {
    return { ...current, recentEvent: t('pet.buy.notEnoughCoins', { item: item.name, price }) };
  }

  return incrementAchievementPurchase({
    ...current,
    coins: current.coins - price,
    inventory: addInventoryItem(current.inventory, itemId, 1),
    dailyDiscountDate: isDiscountPurchase ? discountDateKey : current.dailyDiscountDate,
    dailyDiscountItemIds: isDiscountPurchase ? discountItemIds : current.dailyDiscountItemIds,
    dailyDiscountUsedItemIds: nextDailyDiscountUsedItemIds,
    dailyDiscountUsed: isDiscountPurchase ? true : current.dailyDiscountUsed,
    recentEvent: isDiscountPurchase
      ? t('pet.buy.discount', { item: item.name, price })
      : item.price === 0
        ? t('pet.buy.free', { item: item.name })
        : t('pet.buy.paid', { item: item.name }),
  }, price > 0);
};

export const useInventoryItem = (
  pet: PetState,
  itemId: ItemId,
  now = Date.now(),
  options: UseInventoryItemOptions = {},
): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  if (isPartnerSchedulePetBusy(current)) {
    return { ...current, recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }) };
  }
  const item = options.item ?? getInventoryItem(itemId);
  if (!item) return { ...current, recentEvent: t('pet.item.missing') };
  const isUsable = 'usable' in item ? item.usable : true;
  if (!isUsable) return { ...current, recentEvent: t('pet.item.missing') };
  const displayItemName = options.itemName ?? item.name;

  const count = getInventoryCount(current.inventory, itemId);
  if (count <= 0) {
    return { ...current, recentEvent: t('pet.item.empty', { item: displayItemName }) };
  }

  const wokePet = current.isSleeping;

  if (itemId === 'birthday_cake') {
    const statCap = getPetStatCap(current);
    const energyCap = getPetEnergyCap(current);
    return (wokePet ? incrementManualWake : (nextPet: PetState) => nextPet)(incrementAchievementItemUse(incrementAchievementCareAction(recordWishProgress(recordYearlyItemUse({
      ...withActivity(current, 'eat_cookie', now),
      isSleeping: false,
      hunger: statCap,
      mood: statCap,
      cleanliness: statCap,
      energy: energyCap,
      health: statCap,
      inventory: removeInventoryItem(current.inventory, itemId),
      recentEvent: t(wokePet ? 'pet.item.use.birthdayCakeWoke' : 'pet.item.use.birthdayCake', {
        name: current.name,
        item: displayItemName,
      }),
    }, now), 'feed', now), 'feed'), itemId));
  }

  if (itemId === 'golden_apple') {
    const heartAmount = randomInt(1, 10);
    const heartGain = applyHeartGain(current, heartAmount);
    const usedGoldenApple = recordYearlyItemUse(recordYearlyCareAction({
      ...withActivity(current, 'eat_cookie', now),
      isSleeping: false,
      hunger: clampPetStat(current, current.hunger + 30),
      mood: clampPetStat(current, current.mood + 30 - (wokePet ? 2 : 0)),
      cleanliness: clampPetStat(current, current.cleanliness + 30),
      energy: clampPetEnergy(current, current.energy + 30),
      health: clampPetHealth(current, current.health + 30),
      hearts: heartGain.hearts,
      boostCards: heartGain.boostCards,
      inventory: removeInventoryItem(current.inventory, itemId),
      recentEvent: t(wokePet ? 'pet.item.use.goldenAppleWoke' : 'pet.item.use.goldenApple', {
        name: current.name,
        item: displayItemName,
        hearts: heartGain.amount,
      }),
    }, 'feed', now), now);
    const withAchievementUse = incrementAchievementItemUse(incrementAchievementCareAction(usedGoldenApple, 'feed'), itemId);
    const withWakeRecord = wokePet ? incrementManualWake(withAchievementUse) : withAchievementUse;
    return recordWishProgress(recordEarnedHearts(withWakeRecord, heartGain.amount), 'feed', now);
  }

  const foodEffectMultiplier = item.kind === 'food'
    ? getPartnerScheduleCrossSystemEffects(current).foodEffectMultiplier * getClassicTrophyEffects(current).foodEffectMultiplier
    : 1;
  const scaleFoodEffect = (amount: number | undefined) => {
    if (amount === undefined || amount <= 0 || foodEffectMultiplier === 1) return amount ?? 0;
    return Math.max(1, Math.round(amount * foodEffectMultiplier));
  };
  const effect = item.effect;
  const runtimeFavoriteFoodIdSet = options.favoriteFoodIds ? new Set<ItemId>(options.favoriteFoodIds) : favoriteFoodIdSet;
  const favoriteMoodBonus = runtimeFavoriteFoodIdSet.has(itemId) ? 4 : 0;
  const giftHeartBonus = giftItemIdSet.has(itemId) && Math.random() < 0.2 ? 1 : 0;
  const overuseKey: CareActionKey = item.kind === 'food' ? 'feed' : giftItemIdSet.has(itemId) ? 'gift' : 'touch';
  const overuse = applyActionStreak(current, overuseKey, now);
  const base = overuse.pet;
  const defaultItemActivity: RecentActivity = item.kind === 'food' ? 'eat_cookie' : item.kind === 'care' ? 'bath' : 'happy';
  const itemActivity: Partial<Record<ItemId, RecentActivity>> = {
    emergency_biscuit: 'eat_cookie',
    bento: 'eat_noodles',
    orange: 'eat_cookie',
    apple: 'eat_cookie',
    banana: 'eat_cookie',
    watermelon: 'eat_cookie',
    nutri_meal: 'eat_meat',
    pig_trotter: 'eat_meat',
    strawberry_cake: 'eat_cookie',
    birthday_cake: 'eat_cookie',
    ad_milk: 'eat_cookie',
    strawberry_milk: 'eat_cookie',
    small_bouquet: 'give_heart',
    shiny_sticker: 'give_heart',
    soft_cloud_doll: 'happy',
    ribbon_bell: 'give_heart',
    toy_ball: 'happy',
    picture_book: 'reading_books',
    shampoo: 'bath',
    wet_wipes: 'bath',
    medicine: 'give_heart',
    vitamin_tablet: 'give_heart',
    blanket: 'happy',
    energy_drink: 'happy',
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
  const giftHeartGain = applyHeartGain(base, giftHeartBonus);
  const giftHeartText = giftHeartBonus > 0 ? t('pet.item.use.giftHeart', { hearts: giftHeartGain.amount }) : '';
  const usedItemPet = recordYearlyItemUse(
    recordYearlyCareAction({
      ...withActivity(base, itemActivity[itemId] ?? defaultItemActivity, now),
      isSleeping: false,
      hunger: clampPetStat(base, base.hunger + scaleFoodEffect(effect.hunger) + (item.kind === 'food' ? getAchievementEffects(base).careStatBonus : 0)),
      mood: clampPetStat(base, base.mood + scaleFoodEffect(effect.mood) + favoriteMoodBonus - (wokePet ? 2 : 0)),
      cleanliness: clampPetStat(base, base.cleanliness + scaleFoodEffect(effect.cleanliness)),
      energy: clampPetEnergy(base, base.energy + scaleFoodEffect(effect.energy)),
      health: clampPetHealth(base, base.health + scaleFoodEffect(effect.health)),
      hearts: giftHeartBonus > 0 ? giftHeartGain.hearts : base.hearts,
      boostCards: giftHeartBonus > 0 ? giftHeartGain.boostCards : base.boostCards,
      inventory: removeInventoryItem(base.inventory, itemId),
      recentEvent: `${baseEvent}${favoriteText}${giftHeartText}${overuse.text}`,
    }, overuseKey, now),
    now,
  );

  const withAchievementUse = incrementAchievementItemUse(incrementAchievementCareAction(usedItemPet, overuseKey), itemId);
  const withWakeRecord = wokePet ? incrementManualWake(withAchievementUse) : withAchievementUse;
  const withHeartRecord = giftHeartBonus > 0 ? recordEarnedHearts(withWakeRecord, giftHeartGain.amount) : withWakeRecord;
  const wishAction = item.kind === 'food' ? 'feed' : itemId === 'shampoo' || itemId === 'wet_wipes' ? 'clean' : undefined;
  return wishAction ? recordWishProgress(withHeartRecord, wishAction, now) : withHeartRecord;
};

export const interactWithPet = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(markInteraction(advancePet(pet, now), now));
  if (isPartnerSchedulePetBusy(current)) {
    return { ...current, recentEvent: t('pet.partnerSchedule.busyAction', { name: current.name }) };
  }
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

  if (isPetCriticallyHungry(current)) {
    return {
      ...current,
      lastPetInteractionAt: now,
      recentEvent: t('pet.interaction.lowHunger', { name: current.name }),
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
    const heartGain = applyHeartGain(base, 1);
    const touched = recordWishProgress(recordYearlyCareAction({
      ...withActivity(base, 'give_heart', now, 3600),
      hearts: heartGain.hearts,
      boostCards: heartGain.boostCards,
      mood: clampPetStat(base, base.mood - 12),
      hunger: clampPetStat(base, base.hunger - interactionCost.hunger),
      cleanliness: clampPetStat(base, base.cleanliness - interactionCost.cleanliness),
      energy: clampPetEnergy(base, base.energy - interactionCost.energy),
      lastPetInteractionAt: overuse.triggered ? now + petInteractionOveruseCooldownMs : now,
      recentEvent: overuse.triggered
        ? `${t('pet.interaction.heart', { name: base.name, hearts: heartGain.amount })}${interactionCost.text}${overuse.text} ${t('pet.interaction.overuseCooldown', { name: base.name })}`
        : `${t('pet.interaction.heart', { name: base.name, hearts: heartGain.amount })}${interactionCost.text}${overuse.text}`,
    }, 'touch', now), 'touch', now);
    return recordEarnedHearts(incrementAchievementCareAction(touched, 'touch'), heartGain.amount);
  }

  const touched = recordWishProgress(recordYearlyCareAction({
    ...withActivity(base, 'happy', now, 3200),
    mood: clampPetStat(base, base.mood + 5),
    hunger: clampPetStat(base, base.hunger - interactionCost.hunger),
    cleanliness: clampPetStat(base, base.cleanliness - interactionCost.cleanliness),
    energy: clampPetEnergy(base, base.energy - interactionCost.energy),
    lastPetInteractionAt: overuse.triggered ? now + petInteractionOveruseCooldownMs : now,
    recentEvent: overuse.triggered
      ? `${t('pet.interaction.touch', { name: base.name })}${interactionCost.text}${overuse.text} ${t('pet.interaction.overuseCooldown', { name: base.name })}`
      : `${t('pet.interaction.touch', { name: base.name })}${interactionCost.text}${overuse.text}`,
  }, 'touch', now), 'touch', now);
  return incrementAchievementCareAction(touched, 'touch');
};
export const startPomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
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
    recentActivity: current.isSleeping ? current.recentActivity : activity,
    recentActivityUntil: current.isSleeping ? current.recentActivityUntil : phaseEndsAt,
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
      focusRewardCheckpointAt: current.pomodoro.phase === 'focus' ? now : 0,
    },
  };
};

export const pausePomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  if (!current.pomodoro.isRunning) return current;

  return pausePomodoroForReason(current, now, t('pet.pomodoro.pause.manual', { name: current.name }));
};
export const resetPomodoro = (pet: PetState, now = Date.now()): PetState => {
  const current = clearLowCleanlinessSleepConfirm(advancePet(pet, now));
  const today = getDailyResetDateKey(now);
  const settings = current.pomodoro.settings;
  const dailyCompletedFocusCount =
    current.pomodoro.dailyFocusDate === today ? current.pomodoro.dailyCompletedFocusCount : 0;
  const shouldTriggerResetEvent =
    current.pomodoro.sessionFocusMs >= pomodoroResetEventMinFocusMs && !current.pomodoro.hasTriggeredSessionResetEvent;
  const resetEventCoins = shouldTriggerResetEvent ? randomInt(1, 3) : 0;
  const resetEventMood = shouldTriggerResetEvent ? 1 : 0;
  const resetEventText = shouldTriggerResetEvent
    ? t('pet.pomodoro.resetSessionEvent', { name: current.name, coins: resetEventCoins, mood: resetEventMood })
    : '';
  const resetBase = recordEarnedCoins({
    ...current,
    coins: clampCoins(current.coins + resetEventCoins),
    mood: clampPetStat(current, current.mood + resetEventMood),
  }, resetEventCoins);

  return {
    ...resetBase,
    recentEvent: t('pet.pomodoro.reset', { name: current.name }) + resetEventText,
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
  const nextName = name.trim().slice(0, 32) || pet.name;
  return {
    ...pet,
    name: nextName,
    recentEvent: t('pet.rename.updated', { name: nextName }),
  };
};

export const updatePetProfile = (pet: PetState, name: string, birthday?: PetBirthday): PetState => {
  const nextName = name.trim().slice(0, 32) || pet.name;
  const nextBirthday = normalizePetBirthday(birthday);

  return {
    ...pet,
    name: nextName,
    ...(nextBirthday ? { birthday: nextBirthday } : {}),
    recentEvent: t('pet.profile.updated', { name: nextName }),
  };
};



