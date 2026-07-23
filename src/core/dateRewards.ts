import { t } from '../i18n';
import { addInventoryItem } from './items';
import { applyHeartGain, claimAchievementDailyStipendWithResult, getAchievementEffects, incrementAchievementDateReward, recordEarnedCoins, recordEarnedHearts } from './achievements';
import { getDailyResetDateKey } from './dailyReset';
import { clampCoins } from './petStats';
import type { ItemId, PetBirthday, PetCalendarDate, PetState } from './petTypes';
import { hashString } from './utils';

export const defaultPetBirthday: PetBirthday = { month: 6, day: 1 };
export const annualDateRewardGachaTickets = 10;
export const monthlyGiftGachaTickets = 3;
export const dateRewardCatchUpDays = 3;

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
  gachaTickets?: number;
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

export const getLocalCalendarDate = (time: number): PetCalendarDate => {
  const date = new Date(time);
  return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
};

const getMonthMaxDayForYear = (month: number, year: number) =>
  month >= 1 && month <= 12 ? new Date(year, month, 0).getDate() : 0;

export const normalizePetCalendarDate = (value: unknown): PetCalendarDate | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const raw = value as Record<string, unknown>;
  const year = typeof raw.year === 'number' && Number.isInteger(raw.year) ? raw.year : 0;
  const month = typeof raw.month === 'number' && Number.isInteger(raw.month) ? raw.month : 0;
  const day = typeof raw.day === 'number' && Number.isInteger(raw.day) ? raw.day : 0;
  const maxDay = getMonthMaxDayForYear(month, year);
  return year >= 1 && year <= 9999 && day >= 1 && day <= maxDay ? { year, month, day } : undefined;
};

const getAnnualMonthDay = (date: PetBirthday, year: number): PetBirthday =>
  date.month === 2 && date.day === 29 && getMonthMaxDayForYear(2, year) === 28
    ? { month: 2, day: 28 }
    : { month: date.month, day: date.day };

const isSameMonthDay = (date: PetCalendarDate, target: PetBirthday) =>
  date.month === target.month && date.day === target.day;

interface RecentCalendarDate extends PetCalendarDate {
  dateKey: string;
  daysAgo: number;
}

const getCalendarDateKey = (date: PetCalendarDate) =>
  `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;

const getRecentCalendarDates = (now: number): RecentCalendarDate[] => {
  const current = new Date(now);
  return Array.from({ length: dateRewardCatchUpDays + 1 }, (_, daysAgo) => {
    const date = new Date(current.getFullYear(), current.getMonth(), current.getDate() - daysAgo, 12, 0, 0, 0);
    const calendarDate = getLocalCalendarDate(date.getTime());
    return { ...calendarDate, dateKey: getCalendarDateKey(calendarDate), daysAgo };
  }).reverse();
};

const getMonthKey = (date: PetCalendarDate) =>
  `${String(date.year).padStart(4, '0')}-${String(date.month).padStart(2, '0')}`;

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
    return { ...pet, birthday };
  }

  if (!pet.birthday) return pet;
  const { birthday: _birthday, ...rest } = pet;
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
      goldenAppleGacha: actualReward.gachaTickets ? {
        ...pet.goldenAppleGacha,
        tickets: Math.min(9999, pet.goldenAppleGacha.tickets + actualReward.gachaTickets),
      } : pet.goldenAppleGacha,
      recentEvent: actualReward.message,
    },
    reward: actualReward,
  };
};

const getFestivalForDate = (date: PetCalendarDate) =>
  festivalConfigs.find((festival) => festival.month === date.month && festival.day === date.day);

const getFestivalItems = (festival: FestivalConfig, annualKey: string): DateRewardItem[] => {
  if (festival.reward.type === 'harvest_food') {
    return [
      { itemId: pickSeededItem(harvestFoodItems, `${annualKey}:0`), amount: 1 },
      { itemId: pickSeededItem(harvestFoodItems, `${annualKey}:1`), amount: 1 },
    ];
  }

  return [{ itemId: pickSeededItem(festival.reward.items, annualKey), amount: 1 }];
};

const applyCalendarReward = (pet: PetState, reward: ClaimedDateReward) => {
  const applied = applyReward(pet, reward);
  return {
    pet: {
      ...applied.pet,
      claimedDateRewardKeys: [...applied.pet.claimedDateRewardKeys, reward.id],
    },
    reward: applied.reward,
  };
};

const getRewardMessage = (pet: PetState, date: RecentCalendarDate, timelyMessage: string) =>
  date.daysAgo > 0 ? t('pet.reward.catchUp', { name: pet.name }) : timelyMessage;

const claimBirthdayReward = (pet: PetState, date: RecentCalendarDate): { pet: PetState; reward?: ClaimedDateReward } => {
  if (!pet.birthday || !isSameMonthDay(date, getAnnualMonthDay(pet.birthday, date.year))) return { pet };

  const rewardKey = `birthday:${date.year}`;
  if (pet.claimedDateRewardKeys.includes(rewardKey)) return { pet };

  const reward: ClaimedDateReward = {
    id: rewardKey,
    kind: 'birthday',
    title: t('ui.rewards.birthdayTitle', { name: pet.name }),
    message: getRewardMessage(pet, date, t('pet.reward.birthday', { name: pet.name })),
    gachaTickets: annualDateRewardGachaTickets,
    items: [
      { itemId: 'golden_apple', amount: 1 },
      { itemId: 'birthday_cake', amount: 1 },
    ],
  };

  return applyCalendarReward(pet, reward);
};

const claimAnniversaryReward = (pet: PetState, date: RecentCalendarDate): { pet: PetState; reward?: ClaimedDateReward } => {
  if (date.year <= pet.metDate.year) return { pet };
  if (!isSameMonthDay(date, getAnnualMonthDay(pet.metDate, date.year))) return { pet };

  const rewardKey = `anniversary:${date.year}`;
  if (pet.claimedDateRewardKeys.includes(rewardKey)) return { pet };

  const reward: ClaimedDateReward = {
    id: rewardKey,
    kind: 'anniversary',
    title: t('ui.rewards.anniversaryTitle', { name: pet.name }),
    message: getRewardMessage(pet, date, t('pet.reward.anniversary', { name: pet.name })),
    gachaTickets: annualDateRewardGachaTickets,
    items: [
      { itemId: 'golden_apple', amount: 1 },
      { itemId: 'shiny_sticker', amount: 1 },
    ],
  };

  return applyCalendarReward(pet, reward);
};

const claimFestivalReward = (pet: PetState, date: RecentCalendarDate): { pet: PetState; reward?: ClaimedDateReward } => {
  const festival = getFestivalForDate(date);
  if (!festival) return { pet };

  const annualKey = `${festival.id}:${date.year}`;
  const rewardKey = `festival:${annualKey}`;
  if (pet.claimedDateRewardKeys.includes(rewardKey)) return { pet };

  const festivalName = t(festival.nameKey);
  const items = getFestivalItems(festival, annualKey);
  const reward: ClaimedDateReward = {
    id: rewardKey,
    kind: 'festival',
    title: t('ui.rewards.festivalTitle', { festival: festivalName }),
    message: getRewardMessage(pet, date, t(festival.dialogueKey, { name: pet.name, festival: festivalName })),
    gachaTickets: annualDateRewardGachaTickets,
    items,
  };

  return applyCalendarReward(pet, reward);
};

const claimMonthlyGiftReward = (pet: PetState, date: RecentCalendarDate): { pet: PetState; reward?: ClaimedDateReward } => {
  if (date.day !== 1) return { pet };

  const monthKey = getMonthKey(date);
  const rewardKey = `monthly_gift:${monthKey}`;
  if (pet.claimedDateRewardKeys.includes(rewardKey)) return { pet };

  const reward: ClaimedDateReward = {
    id: rewardKey,
    kind: 'monthly_gift',
    title: t('ui.rewards.monthlyTitle'),
    message: getRewardMessage(pet, date, t('pet.reward.monthlyGift')),
    gachaTickets: monthlyGiftGachaTickets,
    items: [{ itemId: 'golden_apple', amount: 1 }],
  };

  return applyCalendarReward(pet, reward);
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
  const metDateKey = getCalendarDateKey(pet.metDate);

  for (const date of getRecentCalendarDates(now)) {
    if (date.dateKey < metDateKey) continue;
    for (const claim of [claimBirthdayReward, claimAnniversaryReward, claimFestivalReward, claimMonthlyGiftReward]) {
      const result = claim(next, date);
      next = result.pet;
      if (result.reward) rewards.push(result.reward);
    }
  }

  const dailyLoginResult = claimDailyLoginReward(next, now);
  next = dailyLoginResult.pet;
  if (dailyLoginResult.reward) rewards.push(dailyLoginResult.reward);

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
