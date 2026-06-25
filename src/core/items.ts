import { t } from '../i18n';
import type { Inventory, ItemId, PetState, ShopCategory, ShopItem } from './petTypes';
import { getLocalDateKey, hashString } from './utils';

export const dailyBiscuitClaimLimit = 3;

export const favoriteFoodIds: readonly ItemId[] = ['pig_trotter', 'strawberry_cake', 'ad_milk'];

export const favoriteFoodIdSet = new Set<ItemId>(favoriteFoodIds);

export const giftItemIds: readonly ItemId[] = ['small_bouquet', 'shiny_sticker', 'soft_cloud_doll', 'ribbon_bell'];

export const giftItemIdSet = new Set<ItemId>(giftItemIds);

export const shopItems: readonly ShopItem[] = [
  {
    id: 'emergency_biscuit',
    name: t('pet.shop.items.emergency_biscuit.name'),
    kind: 'food',
    price: 0,
    effect: { hunger: 14, mood: -1 },
    summary: t('pet.shop.items.emergency_biscuit.summary'),
  },
  {
    id: 'bento',
    name: t('pet.shop.items.bento.name'),
    kind: 'food',
    price: 24,
    effect: { hunger: 34, mood: 5, cleanliness: -3 },
    summary: t('pet.shop.items.bento.summary'),
  },
  {
    id: 'nutri_meal',
    name: t('pet.shop.items.nutri_meal.name'),
    kind: 'food',
    price: 42,
    effect: { hunger: 26, mood: 2, health: 12 },
    summary: t('pet.shop.items.nutri_meal.summary'),
  },
  {
    id: 'pig_trotter',
    name: t('pet.shop.items.pig_trotter.name'),
    kind: 'food',
    price: 48,
    effect: { hunger: 42, mood: 8, cleanliness: -5, health: 4 },
    summary: t('pet.shop.items.pig_trotter.summary'),
  },
  {
    id: 'strawberry_cake',
    name: t('pet.shop.items.strawberry_cake.name'),
    kind: 'food',
    price: 38,
    effect: { hunger: 24, mood: 14, cleanliness: -3 },
    summary: t('pet.shop.items.strawberry_cake.summary'),
  },
  {
    id: 'ad_milk',
    name: t('pet.shop.items.ad_milk.name'),
    kind: 'food',
    price: 28,
    effect: { hunger: 16, mood: 8, health: 3 },
    summary: t('pet.shop.items.ad_milk.summary'),
  },
  {
    id: 'small_bouquet',
    name: t('pet.shop.items.small_bouquet.name'),
    kind: 'item',
    price: 28,
    effect: { mood: 18 },
    summary: t('pet.shop.items.small_bouquet.summary'),
  },
  {
    id: 'shiny_sticker',
    name: t('pet.shop.items.shiny_sticker.name'),
    kind: 'item',
    price: 34,
    effect: { mood: 12 },
    summary: t('pet.shop.items.shiny_sticker.summary'),
  },
  {
    id: 'soft_cloud_doll',
    name: t('pet.shop.items.soft_cloud_doll.name'),
    kind: 'item',
    price: 58,
    effect: { mood: 30, energy: 3 },
    summary: t('pet.shop.items.soft_cloud_doll.summary'),
  },
  {
    id: 'ribbon_bell',
    name: t('pet.shop.items.ribbon_bell.name'),
    kind: 'item',
    price: 36,
    effect: { mood: 20 },
    summary: t('pet.shop.items.ribbon_bell.summary'),
  },
  {
    id: 'toy_ball',
    name: t('pet.shop.items.toy_ball.name'),
    kind: 'item',
    price: 30,
    effect: { mood: 25, energy: -4 },
    summary: t('pet.shop.items.toy_ball.summary'),
  },
  {
    id: 'shampoo',
    name: t('pet.shop.items.shampoo.name'),
    kind: 'care',
    price: 24,
    effect: { cleanliness: 35, health: 3 },
    summary: t('pet.shop.items.shampoo.summary'),
  },
  {
    id: 'medicine',
    name: t('pet.shop.items.medicine.name'),
    kind: 'care',
    price: 45,
    effect: { health: 30, mood: -2 },
    summary: t('pet.shop.items.medicine.summary'),
  },
  {
    id: 'blanket',
    name: t('pet.shop.items.blanket.name'),
    kind: 'care',
    price: 36,
    effect: { energy: 20, mood: 2 },
    summary: t('pet.shop.items.blanket.summary'),
  },
] as const;

export const shopCategories: readonly { id: ShopCategory; label: string }[] = [
  { id: 'food', label: t('pet.shop.categories.food') },
  { id: 'item', label: t('pet.shop.categories.item') },
  { id: 'care', label: t('pet.shop.categories.care') },
];

export const allItemIds = new Set<ItemId>(shopItems.map((item) => item.id));

export const getShopItem = (id: ItemId) => shopItems.find((item) => item.id === id);

export const getInventoryCount = (inventory: Inventory, id: ItemId) => inventory[id] ?? 0;

export const addInventoryItem = (inventory: Inventory, id: ItemId, amount: number): Inventory => ({
  ...inventory,
  [id]: Math.max(0, getInventoryCount(inventory, id) + amount),
});

export const removeInventoryItem = (inventory: Inventory, id: ItemId): Inventory => {
  const count = getInventoryCount(inventory, id);
  if (count <= 1) {
    const next = { ...inventory };
    delete next[id];
    return next;
  }
  return { ...inventory, [id]: count - 1 };
};

const getDailyDiscountPrice = (price: number) => Math.max(1, Math.ceil(price * 0.7));

const getDailyDiscountItem = (now: number) => {
  const eligibleItems = shopItems.filter((item) => item.price > 0 && item.id !== 'emergency_biscuit');
  if (eligibleItems.length === 0) return undefined;

  const dateKey = getLocalDateKey(now);
  return eligibleItems[hashString(dateKey) % eligibleItems.length];
};

export const getDailyShopDiscountInfo = (pet: PetState, now = Date.now()) => {
  const item = getDailyDiscountItem(now);
  const dateKey = getLocalDateKey(now);
  if (!item) return undefined;

  const used = pet.dailyDiscountDate === dateKey && pet.dailyDiscountUsed;

  return {
    dateKey,
    itemId: item.id,
    label: t('pet.shop.discount.label'),
    originalPrice: item.price,
    price: getDailyDiscountPrice(item.price),
    used,
  };
};
