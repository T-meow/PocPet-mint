import { t } from '../i18n';
import { addInventoryItem } from './items';
import { applyHeartGain, claimAchievementDailyStipendWithResult, getAchievementEffects, incrementAchievementDateReward, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getDailyResetDateKey } from './dailyReset';
import { clampCoins } from './petStats';
import type { ItemId, PetBirthday, PetState } from './petTypes';
import { getLocalDateKey, hashString } from './utils';

export const defaultPetBirthday: PetBirthday = { month: 4, day: 23 };
export const birthdayRewardCoins = 100;
export const birthdayRewardHearts = 10;
export const anniversaryRewardCoins = 50;
export const anniversaryRewardHearts = 3;
export const monthlyGiftCoins = 20;

export type DateRewardKind = 'birthday' | 'anniversary' | 'festival' | 'monthly_gift' | 'daily_login';

export interface DateRewardItem {
  itemId: ItemId;
  amount: number;
}

export interface ClaimedDateReward {
  id: string;
  kind: DateRewardKind;
  title: string;
  message: string;
  coins?: number;
  hearts?: number;
  items: DateRewardItem[];
  achievementBonusItemCount?: number;
}

type WeightedEntry<T> = T & { weight: number };

type FestivalRewardConfig =
  | { type: 'pool'; items: readonly ItemId[] }
  | { type: 'harvest_food' };

export interface FestivalConfig {
  id: string;
  month: number;
  day: number;
  nameKey: string;
  dialogueKey: string;
  reward: FestivalRewardConfig;
}

const fruitItems: readonly ItemId[] = ['orange', 'apple', 'banana', 'watermelon'];
const giftItems: readonly ItemId[] = ['small_bouquet', 'shiny_sticker', 'ribbon_bell'];
const goodFoodAndGiftItems: readonly ItemId[] = ['bento', 'nutri_meal', 'strawberry_cake', 'small_bouquet', 'ribbon_bell'];
const cleaningItems: readonly ItemId[] = ['wet_wipes', 'shampoo'];
const toyAndSweetItems: readonly ItemId[] = ['toy_ball', 'picture_book', 'strawberry_cake', 'strawberry_milk'];
const christmasItems: readonly ItemId[] = ['soft_cloud_doll', 'ribbon_bell', 'strawberry_cake', 'blanket', 'small_bouquet'];
const harvestFoodItems: readonly ItemId[] = ['orange', 'apple', 'banana', 'watermelon', 'bento', 'nutri_meal', 'strawberry_cake'];

// TODO: Allow future festival-exclusive ItemIds and Mod-provided festival reward pools.
export const festivalConfigs: readonly FestivalConfig[] = [
  { id: 'new_year', month: 1, day: 1, nameKey: 'pet.festivals.newYear', dialogueKey: 'pet.festivalDialogue.newYear', reward: { type: 'pool', items: goodFoodAndGiftItems } },
  { id: 'valentine', month: 2, day: 14, nameKey: 'pet.festivals.valentine', dialogueKey: 'pet.festivalDialogue.valentine', reward: { type: 'pool', items: giftItems } },
  { id: 'earth_day', month: 4, day: 22, nameKey: 'pet.festivals.earthDay', dialogueKey: 'pet.festivalDialogue.earthDay', reward: { type: 'pool', items: [...fruitItems, ...cleaningItems] } },
  { id: 'children_day', month: 6, day: 1, nameKey: 'pet.festivals.childrenDay', dialogueKey: 'pet.festivalDialogue.childrenDay', reward: { type: 'pool', items: toyAndSweetItems } },
  { id: 'harvest_festival', month: 9, day: 23, nameKey: 'pet.festivals.harvestFestival', dialogueKey: 'pet.festivalDialogue.harvestFestival', reward: { type: 'harvest_food' } },
  { id: 'christmas', month: 12, day: 25, nameKey: 'pet.festivals.christmas', dialogueKey: 'pet.festivalDialogue.christmas', reward: { type: 'pool', items: christmasItems } },
];

const dailyLoginRewardPool: readonly WeightedEntry<{ coins: number } | { itemId: ItemId }>[] = [
  { coins: 10, weight: 30 },
  { itemId: 'orange', weight: 16 },
  { itemId: 'apple', weight: 15 },
  { itemId: 'banana', weight: 15 },
  { itemId: 'watermelon', weight: 10 },
  { itemId: 'emergency_biscuit', weight: 8 },
  { coins: 20, weight: 7 },
  { itemId: 'bento', weight: 5 },
  { itemId: 'strawberry_milk', weight: 5 },
  { itemId: 'wet_wipes', weight: 4 },
  { itemId: 'toy_ball', weight: 3 },
  { coins: 50, weight: 2 },
  { itemId: 'nutri_meal', weight: 2 },
  { itemId: 'strawberry_cake', weight: 2 },
  { itemId: 'small_bouquet', weight: 2 },
  { itemId: 'ribbon_bell', weight: 2 },
  { itemId: 'vitamin_tablet', weight: 1 },
  { itemId: 'medicine', weight: 1 },
  { itemId: 'soft_cloud_doll', weight: 1 },
];

const dailyLoginBonusItemPool: readonly WeightedEntry<{ itemId: ItemId }>[] = dailyLoginRewardPool
  .filter((entry): entry is WeightedEntry<{ itemId: ItemId }> => 'itemId' in entry);

const getLocalYear = (time: number) => new Date(time).getFullYear();

const getMonthDay = (time: number) => {
  const date = new Date(time);
  return { month: date.getMonth() + 1, day: date.getDate() };
};

const getMonthKey = (time: number) => getLocalDateKey(time).slice(0, 7);

const getMonthMaxDayForYear = (month: number, year: number) =>
  month >= 1 && month <= 12 ? new Date(year, month, 0).getDate() : 0;

const isSameMonthDay = (time: number, birthday: PetBirthday) => {
  const current = getMonthDay(time);
  return current.month === birthday.month && current.day === birthday.day;
};

const getAnnualRewardKey = (id: string, time: number) => `${id}:${getLocalYear(time)}`;

export const getPetBirthdayMaxDay = (month: number) => (month >= 1 && month <= 12 ? new Date(2024, month, 0).getDate() : 0);

export const normalizePetBirthday = (value: unknown): PetBirthday | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const month = typeof raw.month === 'number' && Number.isInteger(raw.month) ? raw.month : 0;
  const day = typeof raw.day === 'number' && Number.isInteger(raw.day) ? raw.day : 0;
  const maxDay = getPetBirthdayMaxDay(month);
  return month >= 1 && month <= 12 && day >= 1 && day <= maxDay ? { month, day } : undefined;
};

export const withBackfilledBirthday = (pet: PetState, birthday?: PetBirthday): PetState => {
  if (pet.birthday || !birthday) return pet;
  return { ...pet, birthday };
};

export const withPetIdentityBirthday = (pet: PetState, birthday?: PetBirthday): PetState => {
  if (birthday) {
    if (pet.birthday?.month === birthday.month && pet.birthday.day === birthday.day) return pet;
    return { ...pet, birthday, lastBirthdayRewardYear: undefined };
  }

  if (!pet.birthday && pet.lastBirthdayRewardYear === undefined) return pet;
  const { birthday: _birthday, lastBirthdayRewardYear: _lastBirthdayRewardYear, ...rest } = pet;
  return rest;
};

const pickWeightedRandom = <T,>(items: readonly WeightedEntry<T>[]): T => {
  const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
  let target = Math.floor(Math.random() * Math.max(1, totalWeight));

  for (const item of items) {
    target -= Math.max(0, item.weight);
    if (target < 0) return item;
  }

  return items[items.length - 1];
};

const pickSeededItem = (items: readonly ItemId[], seed: string) => items[hashString(seed) % items.length];

const mergeRewardItems = (items: readonly DateRewardItem[]): DateRewardItem[] => {
  const amounts: Partial<Record<ItemId, number>> = {};
  items.forEach((item) => {
    amounts[item.itemId] = (amounts[item.itemId] ?? 0) + Math.max(0, Math.floor(item.amount));
  });
  return Object.entries(amounts)
    .filter(([, amount]) => (amount ?? 0) > 0)
    .map(([itemId, amount]) => ({ itemId: itemId as ItemId, amount: amount ?? 0 }));
};

const pickDailyLoginBonusItems = (count: number): DateRewardItem[] => {
  const amount = Math.max(0, Math.floor(count));
  return mergeRewardItems(Array.from({ length: amount }, () => ({
    itemId: pickWeightedRandom(dailyLoginBonusItemPool).itemId,
    amount: 1,
  })));
};

const updateDailyLoginAchievementMessage = (reward: ClaimedDateReward, stipendCoins: number) => {
  const bonusItemCount = reward.achievementBonusItemCount ?? 0;
  if (stipendCoins > 0 && bonusItemCount > 0) {
    reward.message = t('pet.reward.dailyWithStipendAndBonusItems', { coins: reward.coins ?? 0, stipend: stipendCoins, count: bonusItemCount });
    return;
  }
  if (stipendCoins > 0) {
    reward.message = t('pet.reward.dailyWithStipend', { coins: reward.coins ?? 0, stipend: stipendCoins });
    return;
  }
  if (bonusItemCount > 0) {
    reward.message = t('pet.reward.dailyWithBonusItems', { count: bonusItemCount });
  }
};

const addRewardItems = (inventory: PetState['inventory'], items: readonly DateRewardItem[]) =>
  items.reduce((next, item) => addInventoryItem(next, item.itemId, item.amount), inventory);

const applyReward = (pet: PetState, reward: ClaimedDateReward): { pet: PetState; reward: ClaimedDateReward } => {
  const heartGain = applyHeartGain(pet, reward.hearts ?? 0);
  const actualReward = reward.hearts ? { ...reward, hearts: heartGain.amount, message: reward.message.replace(/\{hearts\}/g, String(heartGain.amount)) } : reward;
  return {
    pet: {
      ...pet,
      coins: clampCoins(pet.coins + (actualReward.coins ?? 0)),
      hearts: actualReward.hearts ? heartGain.hearts : pet.hearts,
      boostCards: actualReward.hearts ? heartGain.boostCards : pet.boostCards,
      inventory: addRewardItems(pet.inventory, actualReward.items),
      recentEvent: actualReward.message,
    },
    reward: actualReward,
  };
};

const getFestivalForDate = (now: number) => {
  const current = getMonthDay(now);
  return festivalConfigs.find((festival) => festival.month === current.month && festival.day === current.day);
};

const getFestivalItems = (festival: FestivalConfig, annualKey: string): DateRewardItem[] => {
  if (festival.reward.type === 'harvest_food') {
    return [
      { itemId: pickSeededItem(harvestFoodItems, `${annualKey}:0`), amount: 1 },
      { itemId: pickSeededItem(harvestFoodItems, `${annualKey}:1`), amount: 1 },
    ];
  }

  return [{ itemId: pickSeededItem(festival.reward.items, annualKey), amount: 1 }];
};

const getAnniversaryDateForYear = (createdAt: number, year: number): PetBirthday => {
  const created = new Date(createdAt);
  const month = created.getMonth() + 1;
  const day = created.getDate();
  if (month === 2 && day === 29 && getMonthMaxDayForYear(2, year) === 28) return { month: 2, day: 28 };
  return { month, day };
};

const claimBirthdayReward = (pet: PetState, now: number): { pet: PetState; reward?: ClaimedDateReward } => {
  if (!pet.birthday || !isSameMonthDay(now, pet.birthday)) return { pet };

  const year = getLocalYear(now);
  if (pet.lastBirthdayRewardYear === year) return { pet };

  const reward: ClaimedDateReward = {
    id: `birthday:${year}`,
    kind: 'birthday',
    title: t('ui.rewards.birthdayTitle', { name: pet.name }),
    message: t('pet.reward.birthday', { name: pet.name, coins: birthdayRewardCoins, hearts: '{hearts}' }),
    coins: birthdayRewardCoins,
    hearts: birthdayRewardHearts,
    items: [{ itemId: 'birthday_cake', amount: 1 }],
  };

  const applied = applyReward(pet, reward);
  return {
    pet: { ...applied.pet, lastBirthdayRewardYear: year },
    reward: applied.reward,
  };
};

const claimAnniversaryReward = (pet: PetState, now: number): { pet: PetState; reward?: ClaimedDateReward } => {
  const year = getLocalYear(now);
  const createdYear = getLocalYear(pet.createdAt);
  if (year <= createdYear) return { pet };
  if (pet.lastAnniversaryRewardYear === year) return { pet };
  if (!isSameMonthDay(now, getAnniversaryDateForYear(pet.createdAt, year))) return { pet };

  const reward: ClaimedDateReward = {
    id: `anniversary:${year}`,
    kind: 'anniversary',
    title: t('ui.rewards.anniversaryTitle', { name: pet.name }),
    message: t('pet.reward.anniversary', { name: pet.name, coins: anniversaryRewardCoins, hearts: '{hearts}' }),
    coins: anniversaryRewardCoins,
    hearts: anniversaryRewardHearts,
    items: [{ itemId: 'shiny_sticker', amount: 1 }],
  };

  const applied = applyReward(pet, reward);
  return {
    pet: { ...applied.pet, lastAnniversaryRewardYear: year },
    reward: applied.reward,
  };
};

const claimFestivalReward = (pet: PetState, now: number): { pet: PetState; reward?: ClaimedDateReward } => {
  const festival = getFestivalForDate(now);
  if (!festival) return { pet };

  const annualKey = getAnnualRewardKey(festival.id, now);
  if (pet.claimedFestivalRewardKeys.includes(annualKey)) return { pet };

  const festivalName = t(festival.nameKey);
  const items = getFestivalItems(festival, annualKey);
  const reward: ClaimedDateReward = {
    id: `festival:${annualKey}`,
    kind: 'festival',
    title: t('ui.rewards.festivalTitle', { festival: festivalName }),
    message: t(festival.dialogueKey, { name: pet.name, festival: festivalName }),
    items,
  };

  const applied = applyReward(pet, reward);
  return {
    pet: {
      ...applied.pet,
      claimedFestivalRewardKeys: [...pet.claimedFestivalRewardKeys, annualKey],
    },
    reward: applied.reward,
  };
};

const claimMonthlyGiftReward = (pet: PetState, now: number): { pet: PetState; reward?: ClaimedDateReward } => {
  const current = getMonthDay(now);
  if (current.day !== 1) return { pet };

  const monthKey = getMonthKey(now);
  if (pet.monthlyGiftDateKey === monthKey) return { pet };

  const fruit = pickSeededItem(fruitItems, `monthly:${monthKey}`);
  const reward: ClaimedDateReward = {
    id: `monthly_gift:${monthKey}`,
    kind: 'monthly_gift',
    title: t('ui.rewards.monthlyTitle'),
    message: t('pet.reward.monthlyGift', { coins: monthlyGiftCoins }),
    coins: monthlyGiftCoins,
    items: [{ itemId: fruit, amount: 1 }],
  };

  const applied = applyReward(pet, reward);
  return {
    pet: { ...applied.pet, monthlyGiftDateKey: monthKey },
    reward: applied.reward,
  };
};

const claimDailyLoginReward = (pet: PetState, now: number): { pet: PetState; reward?: ClaimedDateReward } => {
  const resetDateKey = getDailyResetDateKey(now);
  if (pet.dailyLoginRewardDateKey === resetDateKey) return { pet };

  const picked = pickWeightedRandom(dailyLoginRewardPool);
  const coins = 'coins' in picked ? picked.coins : undefined;
  const baseItems: DateRewardItem[] = 'itemId' in picked ? [{ itemId: picked.itemId, amount: 1 }] : [];
  const bonusItems = pickDailyLoginBonusItems(getAchievementEffects(pet).dailyLoginItemBonus);
  const bonusItemCount = bonusItems.reduce((sum, item) => sum + item.amount, 0);
  const reward: ClaimedDateReward = {
    id: `daily_login:${resetDateKey}`,
    kind: 'daily_login',
    title: t('ui.rewards.dailyTitle'),
    message: coins
      ? t('pet.reward.dailyCoins', { coins })
      : t('pet.reward.dailyItem'),
    coins,
    items: mergeRewardItems([...baseItems, ...bonusItems]),
    achievementBonusItemCount: bonusItemCount > 0 ? bonusItemCount : undefined,
  };
  updateDailyLoginAchievementMessage(reward, 0);

  const applied = applyReward(pet, reward);
  return {
    pet: { ...applied.pet, dailyLoginRewardDateKey: resetDateKey },
    reward: applied.reward,
  };
};

export const claimAvailableDateRewards = (pet: PetState, now = Date.now()) => {
  const rewards: ClaimedDateReward[] = [];
  let next = pet;

  for (const claim of [claimBirthdayReward, claimAnniversaryReward, claimFestivalReward, claimMonthlyGiftReward, claimDailyLoginReward]) {
    const result = claim(next, now);
    next = result.pet;
    if (result.reward) rewards.push(result.reward);
  }

  if (rewards.length > 0) {
    rewards.forEach((reward) => {
      next = incrementAchievementDateReward(next, reward.kind);
      if (reward.coins) next = recordEarnedCoins(next, reward.coins);
      if (reward.hearts) next = recordEarnedHearts(next, reward.hearts);
    });
    const dailyLoginReward = rewards.find((reward) => reward.kind === 'daily_login');
    if (dailyLoginReward) {
      const stipend = claimAchievementDailyStipendWithResult(next, now, getDailyResetDateKey(now));
      next = stipend.pet;
      if (stipend.coins > 0) {
        dailyLoginReward.coins = (dailyLoginReward.coins ?? 0) + stipend.coins;
      }
      updateDailyLoginAchievementMessage(dailyLoginReward, stipend.coins);
    }
    next = { ...next, recentEvent: rewards[0].message };
  }

  return { pet: next, rewards };
};
