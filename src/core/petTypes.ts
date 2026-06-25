export type PetStatus = 'content' | 'hungry' | 'sad' | 'dirty' | 'tired' | 'sick' | 'sleeping';

export type ItemId =
  | 'emergency_biscuit'
  | 'bento'
  | 'nutri_meal'
  | 'pig_trotter'
  | 'strawberry_cake'
  | 'ad_milk'
  | 'small_bouquet'
  | 'shiny_sticker'
  | 'soft_cloud_doll'
  | 'ribbon_bell'
  | 'toy_ball'
  | 'shampoo'
  | 'medicine'
  | 'blanket';

export type Inventory = Partial<Record<ItemId, number>>;

export type ShopCategory = 'food' | 'item' | 'care';

export type WeatherType = 'sunny' | 'cloudy' | 'rainy' | 'breezy';

export type CareActionKey = 'play' | 'clean' | 'work' | 'feed' | 'gift' | 'touch';

export interface ActionStreak {
  key: CareActionKey | 'none';
  count: number;
  windowStartedAt: number;
  lastAt: number;
}

export type RecentActivity =
  | 'idle'
  | 'happy'
  | 'bath'
  | 'eat_cookie'
  | 'eat_noodles'
  | 'eat_meat'
  | 'give_heart'
  | 'level_up'
  | 'reading_books'
  | 'workout'
  | 'work_food'
  | 'work_plants';

export type PomodoroPhase = 'focus' | 'short_break' | 'long_break';

export interface PomodoroDurations {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
}

export type PomodoroActivity = Extract<RecentActivity, 'reading_books' | 'workout' | 'work_food' | 'work_plants'>;

export interface PomodoroState {
  isRunning: boolean;
  phase: PomodoroPhase;
  phaseStartedAt: number;
  phaseEndsAt: number;
  round: number;
  completedFocusCount: number;
  dailyFocusDate: string;
  dailyCompletedFocusCount: number;
  settings: PomodoroDurations;
  currentActivity: PomodoroActivity;
  lastSettledPhaseId: string;
  pausedRemainingMs: number;
}

export interface PetState {
  name: string;
  level: number;
  hunger: number;
  mood: number;
  cleanliness: number;
  energy: number;
  health: number;
  ageSeconds: number;
  lastUpdatedAt: number;
  isSleeping: boolean;
  recentEvent: string;
  recentActivity: RecentActivity;
  recentActivityUntil: number;
  coins: number;
  hearts: number;
  inventory: Inventory;
  lastDailyRewardAt: number;
  lastDailyEncounterAt: number;
  dailyBiscuitClaimDate: string;
  dailyBiscuitClaims: number;
  dailyDiscountDate: string;
  dailyDiscountUsed: boolean;
  weatherDate: string;
  weather: WeatherType;
  lastEnergyRecoveryAt: number;
  sleepStartedAt: number;
  sleepStartMood: number;
  sleepStartHunger: number;
  sleepStartCleanliness: number;
  lastDreamTalkAt: number;
  actionStreak: ActionStreak;
  lastInteractionAt: number;
  lastPetInteractionAt: number;
  pomodoro: PomodoroState;
}

export type PetAction = 'play' | 'clean' | 'sleep' | 'work';

export interface ItemEffect {
  hunger?: number;
  mood?: number;
  cleanliness?: number;
  energy?: number;
  health?: number;
}

export interface ShopItem {
  id: ItemId;
  name: string;
  kind: ShopCategory;
  price: number;
  effect: ItemEffect;
  summary: string;
}

export interface UseInventoryItemOptions {
  favoriteFoodIds?: readonly ItemId[];
  favoriteText?: (amount: number) => string | undefined;
  itemName?: string;
}
