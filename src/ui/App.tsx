import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Heart, Settings, Trophy, Upload, Volume2, VolumeX } from 'lucide-react';
import {
  advancePet,
  buyBoostCard,
  claimBoostCardDailyCoins,
  clearWitheredTree,
  fertilizeTree,
  getGardenClearCost,
  getGardenReminder,
  harvestTree,
  plantTree,
  selectGardenSlot,
  unlockGardenSlot,
  upgradeGardenTool,
  useGardenNutrient,
  waterTree,
  applyPetAction,
  claimAvailableDateRewards,
  claimAchievementReward,
  claimReturnWelcomeReward,
  buyItem,
  canStartPomodoro,
  claimDailyWishReward,
  exchangeHeartForCoins,
  createDefaultPet,
  defaultPetBirthday,
  defaultPetName,
  dismissYearReview,
  evaluateAchievementUnlocks,
  getAchievementSummary,
  getDailyWishView,
  getEnergyRecoveryInfo,
  gardenCompensationCoins,
  gardenCompensationRewardId,
  getNextUpgradeHeartCost,
  getInventoryItem,
  getInventoryDefinitions,
  getItemDefinition,
  getShopDefinitions,
  createItemRegistry,
  heartExchangeCooldownMs,
  helpPageGiftCoins,
  helpPageGiftRewardId,
  helpStarterGiftCoins,
  helpStarterGiftRewardId,
  clampCoins,
  getPetStatCap,
  getReturnWelcomeView,
  interactWithPet,
  isPetCriticallyHungry,
  isPetLowEnergy,
  markAchievementReviewSeen,
  pausePomodoro,
  resetPomodoro,
  pomodoroMinHealthThreshold,
  recordPetInteraction,
  recordEarnedCoins,
  updatePetProfile,
  shopCategories,
  startPomodoro,
  updatePomodoroSettings,
  upgradePet,
  useInventoryItem,
  withBackfilledBirthday,
  withPetIdentityBirthday,
  type AchievementCategory,
  type AchievementId,
  type AchievementView,
  type BoostCardId,
  type GardenFertilizerId,
  type GardenToolId,
  type GardenTreeId,
  type ClaimedDateReward,
  type InventoryItemDefinition,
  type ItemId,
  type PetAction,
  type PetBirthday,
  type PetState,
  type PetStatus,
  type PomodoroDurations,
} from '../core/pet';
import { currencyIcon, giftBoxIcon, goodEndingImage, itemIcons, resolveItemIcons, resolvePetActivityImages, resolvePetStatusImages } from '../assets';
import {
  getAudioEnabled,
  playSfx,
  setAudioEnabled,
  setAudioTemporarilyMuted,
  syncBgm,
  unlockAudio,
  type BgmMode,
  type SfxId,
} from '../core/audio';
import { clearPet, loadPetOrNull, savePet } from '../core/storage';
import {
  formatFavoriteFoodText,
  getModFavoriteFoodIds,
  getModStatusText,
  parsePetModZip,
  type ActivePetMod,
} from '../core/mod';
import { clearActivePetMod, loadActivePetMod, saveActivePetMod } from '../core/modStorage';
import { createSaveFileText, parseSaveFileText } from '../core/saveCodec';
import { ActionDock } from './ActionDock';
import { AchievementsPage } from './AchievementsPage';
import { BoostCardModal } from './BoostCardModal';
import { ConfirmDialog } from './ConfirmDialog';
import { FeatureRow } from './FeatureRow';
import { GardenPage } from './GardenPage';
import { InventoryPanel } from './InventoryPanel';
import { PetDisplay } from './PetDisplay';
import { PomodoroOverlay } from './PomodoroOverlay';
import { SettingsModal } from './SettingsModal';
import { ShopModal } from './ShopModal';
import { YearReviewModal } from './YearReviewModal';
import { StatusBar } from './StatusBar';
import { formatCompactNumber } from './numberFormat';
import { getLanguage, setLanguage, t, type LanguageCode } from '../i18n';

const formatSharedTime = (seconds: number) => {
  const totalDays = Math.max(1, Math.floor(seconds / 86400) + 1);
  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays % 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears % 30;

  if (years > 0) return t('ui.time.yearsMonthsDays', { years, months, days });
  if (months > 0) return t('ui.time.monthsDays', { months, days });
  return t('ui.time.days', { days: totalDays });
};

const formatCountdownTime = (milliseconds: number) => {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
};

const getPomodoroRemainingMs = (pet: PetState) =>
  pet.pomodoro.isRunning ? pet.pomodoro.phaseEndsAt - Date.now() : pet.pomodoro.pausedRemainingMs;

const getPomodoroPhaseDurationMs = (pet: PetState) => {
  if (pet.pomodoro.isRunning && pet.pomodoro.phaseStartedAt > 0 && pet.pomodoro.phaseEndsAt > pet.pomodoro.phaseStartedAt) {
    return pet.pomodoro.phaseEndsAt - pet.pomodoro.phaseStartedAt;
  }

  const minutes = pet.pomodoro.phase === 'focus' ? pet.pomodoro.settings.focusMinutes : pet.pomodoro.settings.shortBreakMinutes;

  return minutes * 60 * 1000;
};

const getPomodoroProgress = (pet: PetState) => {
  const duration = getPomodoroPhaseDurationMs(pet);
  if (duration <= 0) return 0;
  const elapsed = duration - Math.max(0, getPomodoroRemainingMs(pet));
  return Math.max(0, Math.min(100, (elapsed / duration) * 100));
};

type PomodoroSettingKey = keyof PomodoroDurations;
type SoundOutcome = 'success' | 'blocked' | 'heart' | 'low_state';
type FloatingRewardConfig = { id: string; coins: number; eventKey: string };
type RewardPopup = ClaimedDateReward;
type RewardDisplayItem = { key: string; icon?: string; label: string; title?: string };
type WishQuickAction = PetState['dailyWish']['action'] | NonNullable<PetState['returnWelcome']>['action'];
type ActivePage = 'home' | 'achievements' | 'garden';
type AchievementToast = { kind: 'single'; achievement: AchievementView } | { kind: 'review' };
type AchievementCgPopup = { title: string; description: string; image: string; fileName: string };
type GardenClearConfirm = { slotIndex: number; kind: 'clear' | 'remove'; treeId: GardenTreeId; coins: number };
type PetAppProps = { initialPet: PetState; initialActiveMod: ActivePetMod | null; onResetToPicker: (storedMod: ActivePetMod | null) => void };
type RolePickerProps = {
  installedMod: ActivePetMod | null;
  modMessage: string;
  isAudioEnabled: boolean;
  isLoading?: boolean;
  onUseBuiltin: () => void;
  onUseInstalledMod: () => void;
  onImportMod: (event: ChangeEvent<HTMLInputElement>) => void;
  onAudioToggle: () => void;
};
const achievementToastLabels = {
  single: t('ui.achievements.toast.single'),
  review: t('ui.achievements.toast.review'),
  reviewTitle: t('ui.achievements.toast.reviewTitle'),
};
const achievementCgImages: Record<string, string> = {
  good_ending_year_1: goodEndingImage,
};

const defaultRolePetImage = resolvePetStatusImages(null).content;

const floatingRewardConfigs: readonly FloatingRewardConfig[] = [
  { id: helpStarterGiftRewardId, coins: helpStarterGiftCoins, eventKey: 'pet.reward.helpStarterGift' },
];

const getInventoryCount = (pet: PetState, itemId: ItemId) => pet.inventory[itemId] ?? 0;
const getDisplayItem = (items: readonly InventoryItemDefinition[], itemId: ItemId) => items.find((item) => item.id === itemId);
const getActionSfx = (action: PetAction): SfxId => {
  if (action === 'clean') return 'action_bath';
  if (action === 'play' || action === 'work') return 'action_work_play_medicine';
  return 'pet_touch';
};
const getWishActionButtonLabel = (action: WishQuickAction) => t(`ui.wishes.actions.${action}`);


const getItemSfx = (itemId: ItemId, item?: { kind: 'food' | 'item' | 'care' | 'garden' }): SfxId => {
  const resolvedItem = item ?? getInventoryItem(itemId);
  if (resolvedItem?.kind === 'food') return 'action_eat';
  if (itemId === 'shampoo' || itemId === 'wet_wipes') return 'action_bath';
  if (itemId === 'blanket' || itemId === 'soft_cloud_doll' || itemId === 'picture_book') return 'action_blanket';
  if (itemId === 'medicine' || itemId === 'vitamin_tablet' || itemId === 'energy_drink') return 'action_work_play_medicine';
  return 'pet_heart';
};
const downloadTextFile = (fileName: string, text: string) => {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const downloadImageFile = (fileName: string, imageUrl: string) => {
  const link = document.createElement('a');
  link.href = imageUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
};

const readFileText = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error(t('ui.settings.save.readFileFailed')));
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.readAsText(file);
  });

const getPetInteractionOutcome = (pet: PetState): SoundOutcome => {
  if (pet.isSleeping || isPetLowEnergy(pet) || pet.health <= pomodoroMinHealthThreshold || pet.hunger <= 32 || pet.mood <= 30) {
    return 'low_state';
  }
  return pet.mood >= 75 && pet.health >= 40 ? 'heart' : 'success';
};

const createPetForMod = (mod: ActivePetMod | null) => {
  const fresh = createDefaultPet();
  if (!mod) return withPetIdentityBirthday(fresh, defaultPetBirthday);
  return {
    ...withPetIdentityBirthday(fresh, mod.manifest.birthday),
    name: mod.manifest.defaultPetName,
    recentEvent: mod.manifest.texts?.recentEvent ?? fresh.recentEvent,
  };
};

const RolePicker = ({ installedMod, modMessage, isAudioEnabled, isLoading = false, onUseBuiltin, onUseInstalledMod, onImportMod, onAudioToggle }: RolePickerProps) => (
  <main className="app-shell app-shell--role-picker">
    <section className="role-picker" aria-label={t('ui.rolePicker.aria')}>
      <div className="role-picker__header">
        <p className="eyebrow">{t('ui.brand.eyebrow')}</p>
        <h1>{t('ui.rolePicker.title')}</h1>
        <p>{isLoading ? t('ui.rolePicker.loading') : t('ui.rolePicker.description')}</p>
      </div>
      {!isLoading && (
        <div className="role-picker__grid">
          <button type="button" className="role-card" onClick={onUseBuiltin}>
            <img src={defaultRolePetImage} alt="" aria-hidden="true" />
            <span>
              <strong>{t('ui.rolePicker.builtinTitle')}</strong>
              <small>{t('ui.rolePicker.builtinSummary')}</small>
            </span>
          </button>
          {installedMod && (
            <button type="button" className="role-card" onClick={onUseInstalledMod}>
              <img src={installedMod.petImageUrls.content ?? defaultRolePetImage} alt="" aria-hidden="true" />
              <span>
                <strong>{t('ui.rolePicker.installedTitle', { name: installedMod.manifest.name })}</strong>
                <small>{t('ui.rolePicker.installedSummary', { pet: installedMod.manifest.defaultPetName })}</small>
              </span>
            </button>
          )}
          <label className="role-card role-card--import">
            <Upload size={34} aria-hidden="true" />
            <span>
              <strong>{t('ui.rolePicker.importTitle')}</strong>
              <small>{t('ui.rolePicker.importSummary')}</small>
            </span>
            <input type="file" accept=".zip,application/zip" onChange={onImportMod} />
          </label>
        </div>
      )}
      {modMessage && <p className="role-picker__message">{modMessage}</p>}
      <button type="button" className="icon-button audio-button role-picker__audio" aria-label={isAudioEnabled ? t('ui.top.audioOn') : t('ui.top.audioOff')} aria-pressed={isAudioEnabled} onClick={onAudioToggle}>
        {isAudioEnabled ? <Volume2 size={21} aria-hidden="true" /> : <VolumeX size={21} aria-hidden="true" />}
      </button>
    </section>
  </main>
);

const PetApp = ({ initialPet, initialActiveMod, onResetToPicker }: PetAppProps) => {
  const [pet, setPet] = useState<PetState>(initialPet);
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isShopOpen, setShopOpen] = useState(false);
  const [isPomodoroOpen, setPomodoroOpen] = useState(false);
  const [isBoostCardOpen, setBoostCardOpen] = useState(false);
  const [isAudioEnabled, setAudioEnabledState] = useState(() => getAudioEnabled());
  const [language, setLanguageState] = useState<LanguageCode>(() => getLanguage());
  const [activeShopCategory, setActiveShopCategory] = useState(shopCategories[0].id);
  const [draftName, setDraftName] = useState(initialPet.name);
  const [draftBirthday, setDraftBirthday] = useState<PetBirthday | undefined>(initialPet.birthday);
  const [activeMod, setActiveMod] = useState<ActivePetMod | null>(initialActiveMod);
  const [modMessage, setModMessage] = useState('');
  const [saveText, setSaveText] = useState('');
  const [importSaveText, setImportSaveText] = useState('');
  const [rewardQueue, setRewardQueue] = useState<RewardPopup[]>([]);
  const [isResetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [gardenClearConfirm, setGardenClearConfirm] = useState<GardenClearConfirm | null>(null);
  const [featureInfoMessage, setFeatureInfoMessage] = useState<{ message: string; recentEvent: string } | null>(null);
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const activePageRef = useRef<ActivePage>('home');
  const [activeAchievementCategory, setActiveAchievementCategory] = useState<'all' | AchievementCategory>('all');
  const [achievementToast, setAchievementToast] = useState<AchievementToast | null>(null);
  const [achievementCgPopup, setAchievementCgPopup] = useState<AchievementCgPopup | null>(null);
  const petRef = useRef(pet);
  const completedFocusCountRef = useRef(pet.pomodoro.completedFocusCount);
  const lastHeartExchangeAtRef = useRef(0);
  const [isHeartExchangeCoolingDown, setHeartExchangeCoolingDown] = useState(false);
  const hasLoadedModRef = useRef(false);
  activePageRef.current = activePage;

  useEffect(() => {
    petRef.current = pet;
    savePet(pet);
  }, [pet]);

  useEffect(() => {
    setFeatureInfoMessage((current) => (current && current.recentEvent !== pet.recentEvent ? null : current));
  }, [pet.recentEvent]);

  useEffect(() => {
    setActiveMod(initialActiveMod);
    setPet((current) => {
      if (!initialActiveMod) return withBackfilledBirthday(current, defaultPetBirthday);
      const next = withPetIdentityBirthday(current, initialActiveMod.manifest.birthday);
      return {
        ...next,
        name: current.name === defaultPetName ? initialActiveMod.manifest.defaultPetName : next.name,
      };
    });
    if (initialActiveMod) {
      setDraftName((current) => (current === defaultPetName ? initialActiveMod.manifest.defaultPetName : current));
      setDraftBirthday(initialActiveMod.manifest.birthday);
      setModMessage(t('ui.settings.mod.active', { name: initialActiveMod.manifest.name, version: initialActiveMod.manifest.version }));
    } else {
      setDraftBirthday(defaultPetBirthday);
    }
    hasLoadedModRef.current = true;
  }, [initialActiveMod]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPet((current) => commitPet(advancePet(current)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setAudioTemporarilyMuted(!isVisible);
      if (isVisible) {
        setPet((current) => commitPet(advancePet(current)));
      }
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  const itemIconMap = useMemo(() => resolveItemIcons(activeMod), [activeMod]);
  const itemRegistry = useMemo(() => createItemRegistry(activeMod, itemIconMap), [activeMod, itemIconMap]);
  const petStatusImageMap = useMemo(() => resolvePetStatusImages(activeMod), [activeMod]);
  const petActivityImageMap = useMemo(() => resolvePetActivityImages(activeMod), [activeMod]);
  const displayInventoryItems = useMemo(() => getInventoryDefinitions(itemRegistry, pet.inventory), [itemRegistry, pet.inventory]);
  const displayShopItems = useMemo(() => getShopDefinitions(itemRegistry), [itemRegistry]);
  const getStatusLabel = (status: PetStatus) => getModStatusText(activeMod, status) ?? t(`pet.status.${status}`);
  const statCap = getPetStatCap(pet);
  const energyRecoveryInfo = getEnergyRecoveryInfo(pet);
  const energyRecoveryText = energyRecoveryInfo.isFull ? '' : formatCountdownTime(energyRecoveryInfo.remainingMs);
  const stats = useMemo(
    () => [
      { label: t('ui.stats.hunger'), value: pet.hunger, max: statCap, tone: 'food' as const },
      { label: t('ui.stats.mood'), value: pet.mood, max: statCap, tone: 'mood' as const },
      { label: t('ui.stats.cleanliness'), value: pet.cleanliness, max: statCap, tone: 'clean' as const },
      { label: t('ui.stats.energy'), value: pet.energy, max: statCap, detail: energyRecoveryText, tone: 'energy' as const },
      { label: t('ui.stats.health'), value: pet.health, max: statCap, tone: 'health' as const },
    ],
    [energyRecoveryText, pet, statCap],
  );

  const ownedItems = displayInventoryItems;
  const visibleShopItems = useMemo(
    () => displayShopItems.filter((item) => item.kind === activeShopCategory),
    [activeShopCategory, displayShopItems],
  );
  const isLowEnergy = isPetLowEnergy(pet);
  const isCriticallyHungry = isPetCriticallyHungry(pet);
  const dashboardEventText = featureInfoMessage?.message ?? pet.recentEvent;
  const nextUpgradeCost = getNextUpgradeHeartCost(pet);
  const canUpgrade = nextUpgradeCost > 0 && pet.hearts >= nextUpgradeCost;
  const canRunPomodoro = canStartPomodoro(pet);
  const pomodoroRemainingMs = getPomodoroRemainingMs(pet);
  const pomodoroProgress = getPomodoroProgress(pet);
  const showPomodoroPanel = isPomodoroOpen;
  const pomodoroStartTitle = isLowEnergy
    ? t('ui.pomodoro.lowEnergyTitle')
    : pet.health <= pomodoroMinHealthThreshold
      ? t('ui.pomodoro.lowHealthTitle')
      : undefined;
  const isPomodoroActionDisabled = !pet.pomodoro.isRunning && !canRunPomodoro;
  const currentBgmMode: BgmMode = isShopOpen ? 'shop' : pet.isSleeping ? 'sleep' : 'room';
  const achievementSummary = getAchievementSummary(pet);
  const hasAchievementNotice = achievementSummary.pendingReviewNotice || achievementSummary.claimable > 0;
  const gardenReminder = getGardenReminder(pet);
  const dailyWishView = getDailyWishView(pet);
  const returnWelcomeView = getReturnWelcomeView(pet);
  const dailyWishButtonLabel = dailyWishView.canClaim || dailyWishView.claimed
    ? dailyWishView.buttonLabel
    : getWishActionButtonLabel(pet.dailyWish.action);
  const returnWelcomeButtonLabel =
    returnWelcomeView && pet.returnWelcome
      ? returnWelcomeView.canClaim
        ? returnWelcomeView.buttonLabel
        : getWishActionButtonLabel(pet.returnWelcome.action)
      : '';

  useEffect(() => {
    syncBgm(currentBgmMode);
  }, [currentBgmMode, isAudioEnabled]);

  useEffect(() => {
    claimDateRewards();
  }, [pet.lastUpdatedAt, pet.birthday, activeMod]);

  useEffect(() => {
    if (pet.pomodoro.completedFocusCount > completedFocusCountRef.current) {
      playSfx('notification');
    }
    completedFocusCountRef.current = pet.pomodoro.completedFocusCount;
  }, [pet.pomodoro.completedFocusCount]);

  useEffect(() => {
    if (activePage === 'home' && pet.achievements.pendingReviewNotice && !achievementToast) {
      setAchievementToast({ kind: 'review' });
    }
  }, [activePage, achievementToast, pet.achievements.pendingReviewNotice]);

  const playAfterUnlock = (id: SfxId) => {
    void unlockAudio().then(() => playSfx(id));
  };

  const commitPet = (next: PetState, options: { silent?: boolean } = {}) => {
    const result = evaluateAchievementUnlocks(next);
    const shouldShowAchievementToast = !options.silent && activePageRef.current === 'home';
    if (shouldShowAchievementToast && result.unlocked.length > 0) {
      setAchievementToast(result.unlocked.length === 1 && !result.pet.achievements.pendingReviewNotice ? { kind: 'single', achievement: result.unlocked[0] } : { kind: 'review' });
      playSfx('notification');
    }
    return result.pet;
  };

  const claimDateRewards = () => {
    if (!hasLoadedModRef.current) return;
    setPet((current) => {
      const result = claimAvailableDateRewards(current);
      if (result.rewards.length > 0) {
        setRewardQueue((queue) => [
          ...queue,
          ...result.rewards.filter((reward) => !queue.some((queued) => queued.id === reward.id)),
        ]);
        playSfx('notification');
      }
      return commitPet(result.pet);
    });
  };

  const handleAudioToggle = () => {
    const nextEnabled = !isAudioEnabled;
    setAudioEnabled(nextEnabled);
    setAudioEnabledState(nextEnabled);
    if (nextEnabled) {
      void unlockAudio().then(() => {
        syncBgm(currentBgmMode);
        playSfx('tap');
      });
    }
  };

  const handleAction = (action: PetAction) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const next = applyPetAction(current, action);
      const actionSucceeded = next.recentEvent !== current.recentEvent || next.recentActivity !== current.recentActivity;
      playSfx(actionSucceeded ? getActionSfx(action) : 'error');
      return commitPet(next);
    });
  };

  const handleBuyItem = (itemId: ItemId) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, itemId);
      const beforeCoins = current.coins;
      const item = getItemDefinition(itemRegistry, itemId);
      const next = buyItem(current, itemId, Date.now(), { item });
      const didGainItem = getInventoryCount(next, itemId) > beforeCount;
      const didSpendCoins = next.coins < beforeCoins;
      playSfx(didGainItem ? (didSpendCoins ? 'purchase' : 'coin') : 'error');
      return commitPet(next);
    });
  };

  const handleExchangeHeart = () => {
    const now = Date.now();
    if (now - lastHeartExchangeAtRef.current < heartExchangeCooldownMs) {
      playAfterUnlock('error');
      return;
    }

    lastHeartExchangeAtRef.current = now;
    setHeartExchangeCoolingDown(true);
    window.setTimeout(() => setHeartExchangeCoolingDown(false), heartExchangeCooldownMs);
    playAfterUnlock('tap');

    setPet((current) => {
      const beforeCoins = current.coins;
      const beforeHearts = current.hearts;
      const next = exchangeHeartForCoins(current, now);
      const didExchange = next.coins > beforeCoins && next.hearts < beforeHearts;
      playSfx(didExchange ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const handleUseItem = (itemId: ItemId) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, itemId);
      const displayItem = getDisplayItem(displayInventoryItems, itemId);
      const item = getItemDefinition(itemRegistry, itemId);
      const next = useInventoryItem(current, itemId, Date.now(), {
        favoriteFoodIds: getModFavoriteFoodIds(activeMod),
        favoriteText: (amount) => formatFavoriteFoodText(activeMod, amount),
        itemName: displayItem?.displayName,
        item,
      });
      playSfx(getInventoryCount(next, itemId) < beforeCount ? getItemSfx(itemId, item) : 'error');
      return commitPet(next);
    });
  };
  const handleInteract = () => {
    const outcome = getPetInteractionOutcome(petRef.current);
    playAfterUnlock(outcome === 'heart' ? 'pet_heart' : outcome === 'low_state' ? 'pet_low_state' : 'pet_touch');
    setPet((current) => commitPet(interactWithPet(current)));
  };

  const handleOpenShop = () => {
    playAfterUnlock('open');
    setPet((current) => recordPetInteraction(current));
    setShopOpen(true);
  };

  const handleCloseShop = () => {
    playAfterUnlock('close');
    setShopOpen(false);
  };

  const handleShowFeatureInfo = (message: string) => {
    setFeatureInfoMessage({ message, recentEvent: petRef.current.recentEvent });
  };
  const handleOpenGarden = () => {
    playAfterUnlock('open');
    setActivePage('garden');
    setPet((current) => recordPetInteraction(current));
  };

  const handleCloseGarden = () => {
    playAfterUnlock('close');
    setGardenClearConfirm(null);
    setActivePage('home');
  };

  const commitGardenAction = (action: (current: PetState) => PetState, successSfx: SfxId = 'coin') => {
    playAfterUnlock('tap');
    setPet((current) => {
      const before = current.recentEvent;
      const next = action(current);
      playSfx(next.recentEvent === before ? 'error' : successSfx);
      return commitPet(next);
    });
  };

  const handleSelectGardenSlot = (slotIndex: number) => {
    playAfterUnlock('tap');
    setPet((current) => selectGardenSlot(current, slotIndex));
  };
  const handleUnlockGardenSlot = (slotIndex: number) => commitGardenAction((current) => unlockGardenSlot(current, slotIndex), 'purchase');
  const handlePlantTree = (slotIndex: number, treeId: GardenTreeId) => commitGardenAction((current) => plantTree(current, slotIndex, treeId), 'purchase');
  const handleWaterTree = (slotIndex: number) => commitGardenAction((current) => waterTree(current, slotIndex), 'tap');
  const handleFertilizeTree = (slotIndex: number, fertilizerId: GardenFertilizerId) => commitGardenAction((current) => fertilizeTree(current, slotIndex, fertilizerId), fertilizerId === 'heart' ? 'pet_heart' : 'purchase');
  const handleGardenNutrient = (slotIndex: number) => commitGardenAction((current) => useGardenNutrient(current, slotIndex), 'purchase');
  const handleHarvestTree = (slotIndex: number) => commitGardenAction((current) => harvestTree(current, slotIndex), 'coin');
  const handleClearGardenSlot = (slotIndex: number) => commitGardenAction((current) => clearWitheredTree(current, slotIndex), 'purchase');
  const handleRequestClearGardenSlot = (slotIndex: number) => {
    const current = petRef.current;
    const slot = current.garden.slots[slotIndex];
    if (!slot || !slot.treeId || slot.state === 'empty') {
      handleClearGardenSlot(slotIndex);
      return;
    }

    playAfterUnlock('tap');
    setGardenClearConfirm({
      slotIndex,
      kind: slot.state === 'withered' ? 'clear' : 'remove',
      treeId: slot.treeId,
      coins: getGardenClearCost(current.garden.tools),
    });
  };
  const handleCancelGardenClear = () => {
    playAfterUnlock('close');
    setGardenClearConfirm(null);
  };
  const handleConfirmGardenClear = () => {
    const pending = gardenClearConfirm;
    if (!pending) return;
    setGardenClearConfirm(null);
    handleClearGardenSlot(pending.slotIndex);
  };
  const handleUpgradeGardenTool = (toolId: GardenToolId) => commitGardenAction((current) => upgradeGardenTool(current, toolId), 'purchase');

  const handleOpenBoostCards = () => {
    playAfterUnlock('open');
    setBoostCardOpen(true);
  };

  const handleCloseBoostCards = () => {
    playAfterUnlock('close');
    setBoostCardOpen(false);
  };

  const handleBuyBoostCard = (cardId: BoostCardId) => {
    commitGardenAction((current) => buyBoostCard(current, cardId), 'purchase');
  };

  const handleClaimBoostCardCoins = () => {
    playAfterUnlock('tap');
    setPet((current) => {
      const result = claimBoostCardDailyCoins(current);
      playSfx(result.coins > 0 ? 'coin' : 'error');
      return commitPet(result.pet);
    });
  };

  const handleOpenAchievements = () => {
    playAfterUnlock('open');
    setAchievementToast(null);
    setActivePage('achievements');
  };

  const handleCloseAchievements = () => {
    playAfterUnlock('close');
    setAchievementToast(null);
    setPet((current) => markAchievementReviewSeen(current));
    setActivePage('home');
  };

  const handleClaimAchievementReward = (id: AchievementId) => {
    playAfterUnlock('coin');
    setPet((current) => commitPet(claimAchievementReward(current, id)));
  };

  const handleOpenAchievementCg = (achievement: AchievementView) => {
    const cgId = achievement.reward.cgId;
    const image = cgId ? activeMod?.cgImageUrls[cgId as keyof typeof activeMod.cgImageUrls] ?? achievementCgImages[cgId] : undefined;
    if (!achievement.unlocked || !image) {
      playAfterUnlock('error');
      return;
    }
    playAfterUnlock('open');
    setAchievementCgPopup({ title: achievement.title, description: achievement.description, image, fileName: `${achievement.id}.png` });
  };

  const handleSaveAchievementCg = () => {
    if (!achievementCgPopup) return;
    playAfterUnlock('tap');
    downloadImageFile(achievementCgPopup.fileName, achievementCgPopup.image);
  };

  const handleCloseAchievementCg = () => {
    playAfterUnlock('close');
    setAchievementCgPopup(null);
  };


  const handleOpenPomodoro = () => {
    const willOpen = !isPomodoroOpen;
    playAfterUnlock(willOpen ? 'open' : 'close');
    setPet((current) => recordPetInteraction(current));
    setPomodoroOpen(willOpen);
  };

  const handleTogglePomodoro = () => {
    if (isPomodoroActionDisabled) {
      playAfterUnlock('error');
      return;
    }
    playAfterUnlock(petRef.current.pomodoro.isRunning ? 'tap' : 'pet_read');
    setPomodoroOpen(true);
    setPet((current) => commitPet(current.pomodoro.isRunning ? pausePomodoro(current) : startPomodoro(current)));
  };

  const handleResetPomodoro = () => {
    playAfterUnlock('notification');
    setPomodoroOpen(true);
    setPet((current) => commitPet(resetPomodoro(current)));
  };

  const handleUpgrade = () => {
    playAfterUnlock(canUpgrade ? 'pet_heart' : 'error');
    setPet((current) => commitPet(upgradePet(current)));
  };

  const handlePomodoroSettingChange = (key: PomodoroSettingKey, value: number) => {
    if (!Number.isFinite(value)) return;
    setPet((current) => updatePomodoroSettings(current, { [key]: value }));
  };

  const handleSaveProfile = () => {
    playAfterUnlock('tap');
    setPet((current) => updatePetProfile(current, draftName, draftBirthday));
    setSettingsOpen(false);
  };

  const handleOpenHelp = () => {
    setPet((current) => (current.hasOpenedHelp ? current : { ...current, hasOpenedHelp: true }));
  };

  const handleClaimFloatingReward = (reward: FloatingRewardConfig) => {
    playAfterUnlock('coin');
    setPet((current) => {
      if (current.claimedRewardIds.includes(reward.id)) return current;

      return recordEarnedCoins({
        ...current,
        coins: current.coins + reward.coins,
        claimedRewardIds: [...current.claimedRewardIds, reward.id],
        recentEvent: t(reward.eventKey, { coins: reward.coins }),
      }, reward.coins);
    });
  };

  const handleClaimHelpPageGift = () => {
    playAfterUnlock('coin');
    setPet((current) => {
      if (current.claimedRewardIds.includes(helpPageGiftRewardId)) return current;

      return recordEarnedCoins({
        ...current,
        coins: current.coins + helpPageGiftCoins,
        claimedRewardIds: [...current.claimedRewardIds, helpPageGiftRewardId],
        recentEvent: t('pet.reward.helpPageGift', { coins: helpPageGiftCoins }),
      }, helpPageGiftCoins);
    });
  };

  const handleClaimGardenCompensation = () => {
    playAfterUnlock('coin');
    setPet((current) => {
      if (current.claimedRewardIds.includes(gardenCompensationRewardId)) return current;

      return recordEarnedCoins({
        ...current,
        coins: clampCoins(current.coins + gardenCompensationCoins),
        claimedRewardIds: [...current.claimedRewardIds, gardenCompensationRewardId],
        recentEvent: t('pet.reward.gardenCompensation', { coins: gardenCompensationCoins }),
      }, gardenCompensationCoins);
    });
  };

  const handleClaimDailyWish = () => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeClaimedAt = current.dailyWish.claimedAt;
      const next = claimDailyWishReward(current);
      const didClaim = next.dailyWish.claimedAt !== beforeClaimedAt;
      playSfx(didClaim ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const completeFeedWishAction = () => {
    const foodItem = displayInventoryItems.find((item) => item.kind === 'food' && getInventoryCount(petRef.current, item.id) > 0);
    if (!foodItem) {
      playAfterUnlock('open');
      setActiveShopCategory('food');
      setPet((current) => recordPetInteraction(current));
      setShopOpen(true);
      return;
    }

    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, foodItem.id);
      const displayItem = getDisplayItem(displayInventoryItems, foodItem.id);
      const item = getItemDefinition(itemRegistry, foodItem.id);
      const next = useInventoryItem(current, foodItem.id, Date.now(), {
        favoriteFoodIds: getModFavoriteFoodIds(activeMod),
        favoriteText: (amount) => formatFavoriteFoodText(activeMod, amount),
        itemName: displayItem?.displayName,
        item,
      });
      playSfx(getInventoryCount(next, foodItem.id) < beforeCount ? getItemSfx(foodItem.id, item) : 'error');
      return commitPet(next);
    });
  };

  const handleWishQuickAction = (action: WishQuickAction) => {
    switch (action) {
      case 'feed':
        completeFeedWishAction();
        return;
      case 'touch':
        handleInteract();
        return;
      case 'clean':
      case 'play':
      case 'work':
      case 'sleep':
        handleAction(action);
        return;
    }
  };

  const handleDailyWishButton = () => {
    const wish = petRef.current.dailyWish;
    if (wish.claimedAt) {
      playAfterUnlock('error');
      return;
    }
    if (wish.completedAt) {
      handleClaimDailyWish();
      return;
    }
    handleWishQuickAction(wish.action);
  };

  const handleClaimReturnWelcome = () => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeClaimedAt = current.returnWelcome?.claimedAt;
      const next = claimReturnWelcomeReward(current);
      const didClaim = next.returnWelcome?.claimedAt !== beforeClaimedAt;
      playSfx(didClaim ? 'coin' : 'error');
      return commitPet(next);
    });
  };

  const handleReturnWelcomeButton = () => {
    const welcome = petRef.current.returnWelcome;
    if (!welcome) return;
    if (welcome.claimedAt) {
      playAfterUnlock('error');
      return;
    }
    if (welcome.completedAt) {
      handleClaimReturnWelcome();
      return;
    }
    handleWishQuickAction(welcome.action);
  };

  const handleLanguageChange = (nextLanguage: LanguageCode) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    window.location.reload();
  };

  const handleReset = () => {
    playAfterUnlock('tap');
    setResetConfirmOpen(true);
  };

  const handleCancelReset = () => {
    playAfterUnlock('close');
    setResetConfirmOpen(false);
  };

  const handleConfirmReset = () => {
    playAfterUnlock('tap');
    clearPet();
    onResetToPicker(activeMod);
    setDraftName(defaultPetName);
    setDraftBirthday(defaultPetBirthday);
    setPomodoroOpen(false);
    setSettingsOpen(false);
    setResetConfirmOpen(false);
  };

  const handleModFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const oldDefaultName = activeMod?.manifest.defaultPetName ?? defaultPetName;
      const parsed = await parsePetModZip(file);
      await saveActivePetMod(parsed);
      const loaded = await loadActivePetMod();
      setActiveMod(loaded);
      setModMessage(
        parsed.warnings.length > 0
          ? t('ui.settings.mod.importedWithFallback', { name: parsed.manifest.name, count: parsed.warnings.length })
          : t('ui.settings.mod.imported', { name: parsed.manifest.name }),
      );
      setPet((current) => {
        const shouldUseModDefaultName = current.name === defaultPetName || current.name === oldDefaultName;
        const nextName = shouldUseModDefaultName ? parsed.manifest.defaultPetName : current.name;
        return {
          ...withPetIdentityBirthday(current, parsed.manifest.birthday),
          name: nextName,
          recentEvent: parsed.manifest.texts?.recentEvent ?? t('ui.settings.mod.switched', { name: parsed.manifest.name }),
        };
      });
      setDraftName((current) => (current === defaultPetName || current === oldDefaultName ? parsed.manifest.defaultPetName : current));
      setDraftBirthday(parsed.manifest.birthday);
      setSaveText('');
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.importFailed'));
      playSfx('error');
    }
  };

  const handleClearMod = async () => {
    try {
      const oldDefaultName = activeMod?.manifest.defaultPetName;
      await clearActivePetMod();
      setActiveMod(null);
      setPet((current) => {
        const shouldRestoreDefaultName = Boolean(oldDefaultName) && current.name === oldDefaultName;
        return {
          ...withPetIdentityBirthday(current, defaultPetBirthday),
          name: shouldRestoreDefaultName ? defaultPetName : current.name,
        };
      });
      setDraftName((current) => (oldDefaultName && current === oldDefaultName ? defaultPetName : current));
      setDraftBirthday(defaultPetBirthday);
      setSaveText('');
      setModMessage(t('ui.settings.mod.restored'));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.restoreFailed'));
    }
  };

  const handleExportSave = () => {
    const text = createSaveFileText(petRef.current, activeMod?.manifest);
    setSaveText(text);
    setModMessage(t('ui.settings.save.generated'));
  };

  const handleDownloadSave = () => {
    const text = createSaveFileText(petRef.current, activeMod?.manifest);
    setSaveText(text);
    downloadTextFile(`pocpet-mint-save-${new Date().toISOString().slice(0, 10)}.pocpet`, text);
  };

  const importSaveFromText = (text: string) => {
    try {
      const imported = parseSaveFileText(text);
      const importedMod = imported.activeMod;
      const hasMatchingMod = importedMod ? activeMod?.manifest.id === importedMod.id : true;
      const nextPet = importedMod && !hasMatchingMod
        ? imported.pet
        : activeMod
          ? withPetIdentityBirthday(imported.pet, activeMod.manifest.birthday)
          : withBackfilledBirthday(imported.pet, defaultPetBirthday);
      setPet(nextPet);
      setDraftName(nextPet.name);
      setDraftBirthday(nextPet.birthday);
      setImportSaveText('');
      setModMessage(
        importedMod && !hasMatchingMod
          ? t('ui.settings.save.importedMissingMod', { name: importedMod.name, version: importedMod.version })
          : t('ui.settings.save.imported'),
      );
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.importFailed'));
      playSfx('error');
    }
  };

  const handleImportSaveFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      importSaveFromText(await readFileText(file));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.save.readFailed'));
    }
  };

  const availableFloatingReward = floatingRewardConfigs.find((reward) => !pet.claimedRewardIds.includes(reward.id));
  const hasClaimedHelpPageGift = pet.claimedRewardIds.includes(helpPageGiftRewardId);
  const hasClaimedGardenCompensation = pet.claimedRewardIds.includes(gardenCompensationRewardId);
  const activeRewardPopup = rewardQueue[0];
  const activeYearReview = !activeRewardPopup && !achievementCgPopup && !isShopOpen && !isSettingsOpen && !isResetConfirmOpen && !gardenClearConfirm ? pet.pendingYearReview : undefined;

  const handleCloseYearReview = () => {
    playAfterUnlock('tap');
    setPet((current) => dismissYearReview(current));
  };

  const renderRewardItems = (reward: RewardPopup) => {
    const rewardItems: RewardDisplayItem[] = [];

    if (reward.coins) {
      rewardItems.push({
        key: 'coins',
        icon: currencyIcon,
        label: t('ui.rewards.coins', { coins: formatCompactNumber(reward.coins) }),
        title: t('ui.rewards.coins', { coins: reward.coins }),
      });
    }

    if (reward.hearts) {
      rewardItems.push({
        key: 'hearts',
        label: t('ui.rewards.hearts', { hearts: formatCompactNumber(reward.hearts) }),
        title: t('ui.rewards.hearts', { hearts: reward.hearts }),
      });
    }

    reward.items.forEach((item, index) => {
      const displayItem = getItemDefinition(itemRegistry, item.itemId);
      rewardItems.push({
        key: `${item.itemId}:${index}`,
        icon: itemIconMap[item.itemId],
        label: t('ui.rewards.item', { item: displayItem?.name ?? item.itemId, count: item.amount }),
      });
    });

    return rewardItems.map((item) => (
      <div className="reward-modal__item" key={item.key} title={item.title}>
        {item.icon ? <img src={item.icon} alt="" aria-hidden="true" /> : <Heart size={22} aria-hidden="true" />}
        <span>{item.label}</span>
      </div>
    ));
  };

  const pomodoroOverlay = showPomodoroPanel ? (
    <PomodoroOverlay
      pet={pet}
      progress={pomodoroProgress}
      remainingMs={pomodoroRemainingMs}
      isActionDisabled={isPomodoroActionDisabled}
      startTitle={pomodoroStartTitle}
      onToggle={handleTogglePomodoro}
      onReset={handleResetPomodoro}
      onSettingChange={handlePomodoroSettingChange}
    />
  ) : undefined;
  return (
    <main className="app-shell">
      <header className="top-bar">
        <div>
          <p className="eyebrow">{t('ui.brand.eyebrow')}</p>
          <h1>{pet.name}</h1>
        </div>
        <div className="top-actions">
          <button
            type="button"
            className="coin-pill"
            onClick={handleOpenShop}
            aria-label={`${t('ui.top.openShop')}: ${t('ui.shop.wallet', { coins: pet.coins })}`}
            title={t('ui.shop.wallet', { coins: pet.coins })}
          >
            <img src={currencyIcon} alt="" aria-hidden="true" />
            <strong>{pet.coins}</strong>
          </button>
          <div className="heart-pill" aria-label={t('ui.top.heartsAria', { hearts: pet.hearts })} title={t('ui.top.heartsAria', { hearts: pet.hearts })}>
            <Heart size={20} aria-hidden="true" />
            <strong>{pet.hearts}</strong>
          </div>
          <button
            type="button"
            className={`icon-button achievement-entry${hasAchievementNotice ? ' achievement-entry--notice' : ''}`}
            aria-label={t('ui.top.openAchievements')}
            title={t('ui.achievements.title')}
            onClick={handleOpenAchievements}
          >
            <Trophy size={22} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="icon-button audio-button"
            aria-label={isAudioEnabled ? t('ui.top.audioOn') : t('ui.top.audioOff')}
            title={isAudioEnabled ? t('ui.top.audioOn') : t('ui.top.audioOff')}
            aria-pressed={isAudioEnabled}
            onClick={handleAudioToggle}
          >
            {isAudioEnabled ? <Volume2 size={21} aria-hidden="true" /> : <VolumeX size={21} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label={t('ui.top.openSettings')}
            title={t('ui.top.settings')}
            onClick={() => {
              playAfterUnlock('open');
              setDraftName(pet.name);
              setDraftBirthday(pet.birthday);
              setSettingsOpen(true);
            }}
          >
            <Settings size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      {activePage === 'achievements' ? (
        <AchievementsPage
          pet={pet}
          activeCategory={activeAchievementCategory}
          itemIconMap={itemIconMap}
          onBack={handleCloseAchievements}
          onCategoryChange={setActiveAchievementCategory}
          onClaimReward={handleClaimAchievementReward}
          onOpenCg={handleOpenAchievementCg}
        />
      ) : activePage === 'garden' ? (
        <GardenPage
          pet={pet}
          itemIconMap={itemIconMap}
          onBack={handleCloseGarden}
          onSelectSlot={handleSelectGardenSlot}
          onUnlockSlot={handleUnlockGardenSlot}
          onPlantTree={handlePlantTree}
          onWater={handleWaterTree}
          onFertilize={handleFertilizeTree}
          onNutrient={handleGardenNutrient}
          onHarvest={handleHarvestTree}
          onClear={handleRequestClearGardenSlot}
          onUpgradeTool={handleUpgradeGardenTool}
          compensationCoins={gardenCompensationCoins}
          onClaimCompensation={hasClaimedGardenCompensation ? undefined : handleClaimGardenCompensation}
        />
      ) : (
        <>
          <div className="content-grid">
            <PetDisplay
              pet={pet}
              onInteract={handleInteract}
              overlay={pomodoroOverlay}
              petStatusImages={petStatusImageMap}
              petActivityImages={petActivityImageMap}
              getStatusLabel={getStatusLabel}
            />

            <section className="dashboard" aria-label={t('ui.dashboard.aria')}>
              <div className="event-panel">
                <span>{t('ui.dashboard.event')}</span>
                <p>{dashboardEventText}</p>
              </div>

              <div className="wish-stack">
                {returnWelcomeView && (
                  <section className="wish-panel wish-panel--return" aria-label={t('ui.returnWelcome.aria')}>
                    <div className="wish-panel__copy">
                      <span>{t('ui.returnWelcome.kicker')}</span>
                      <h2>{returnWelcomeView.title}</h2>
                      <p>{returnWelcomeView.description}</p>
                      <small>{returnWelcomeView.progressText} · {returnWelcomeView.rewardText}</small>
                    </div>
                    <button type="button" className="primary-button wish-panel__button" onClick={handleReturnWelcomeButton}>
                      {returnWelcomeButtonLabel}
                    </button>
                  </section>
                )}
                {!dailyWishView.claimed && (
                  <section className="wish-panel" aria-label={t('ui.dailyWish.aria')}>
                    <div className="wish-panel__copy">
                      <span>{t('ui.dailyWish.kicker')}</span>
                      <h2>{dailyWishView.title}</h2>
                      <p>{dailyWishView.description}</p>
                      <small>{dailyWishView.progressText} · {dailyWishView.rewardText}</small>
                    </div>
                    <button type="button" className="primary-button wish-panel__button" disabled={dailyWishView.claimed} onClick={handleDailyWishButton}>
                      {dailyWishButtonLabel}
                    </button>
                  </section>
                )}
              </div>

              <div className="stat-grid">
                {stats.map((stat) => (
                  <StatusBar key={stat.label} {...stat} />
                ))}
              </div>

              <FeatureRow
                pet={pet}
                canUpgrade={canUpgrade}
                nextUpgradeCost={nextUpgradeCost}
                isPomodoroOpen={isPomodoroOpen}
                pomodoroRemainingMs={pomodoroRemainingMs}
                pomodoroStartTitle={pomodoroStartTitle}
                gardenReminder={gardenReminder}
                onUpgrade={handleUpgrade}
                onOpenPomodoro={handleOpenPomodoro}
                onOpenGarden={handleOpenGarden}
                onOpenBoostCards={handleOpenBoostCards}
                onShowInfo={handleShowFeatureInfo}
              />

              <div className="meta-row" aria-label={t('ui.dashboard.metaAria')}>
                <span className="meta-row__shared-time">{t('ui.dashboard.sharedTime', { time: formatSharedTime(pet.ageSeconds) })}</span>
                <span className="meta-row__state">{pet.isSleeping ? t('ui.dashboard.resting') : t('ui.dashboard.active')}</span>
              </div>

              <InventoryPanel
                ownedItems={ownedItems}
                inventory={pet.inventory}
                itemIconMap={itemIconMap}
                onOpenShop={handleOpenShop}
                onUseItem={handleUseItem}
              />
            </section>
          </div>

          <ActionDock isSleeping={pet.isSleeping} isLowEnergy={isLowEnergy} isCriticallyHungry={isCriticallyHungry} onAction={handleAction} />
        </>
      )}

      {availableFloatingReward && (
        <button
          type="button"
          className="floating-reward-button"
          aria-label={t('ui.rewards.claim')}
          title={t('ui.rewards.claim')}
          onClick={() => handleClaimFloatingReward(availableFloatingReward)}
        >
          <img src={giftBoxIcon} alt="" aria-hidden="true" />
        </button>
      )}

      {achievementToast && activePage === 'home' && (
        <button type="button" className="achievement-toast" onClick={handleOpenAchievements}>
          <span className="achievement-toast__icon" aria-hidden="true"><Trophy size={22} /></span>
          <span className="achievement-toast__copy">
            <span>{achievementToast.kind === 'single' ? achievementToastLabels.single : achievementToastLabels.review}</span>
            <strong>{achievementToast.kind === 'single' ? achievementToast.achievement.title : achievementToastLabels.reviewTitle}</strong>
          </span>
        </button>
      )}
      {activeRewardPopup && (
        <div className="modal-backdrop" role="presentation">
          <section className="reward-modal" role="dialog" aria-modal="true" aria-labelledby="reward-title">
            <img className="reward-modal__gift" src={giftBoxIcon} alt="" aria-hidden="true" />
            <div className="reward-modal__copy">
              <span>{t('ui.rewards.kicker')}</span>
              <h2 id="reward-title">{activeRewardPopup.title}</h2>
              <p>{activeRewardPopup.message}</p>
            </div>
            <div className="reward-modal__items">{renderRewardItems(activeRewardPopup)}</div>
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                playAfterUnlock('tap');
                setRewardQueue((queue) => queue.slice(1));
              }}
            >
              {t('ui.rewards.confirm')}
            </button>
          </section>
        </div>
      )}

      {achievementCgPopup && (
        <div className="modal-backdrop" role="presentation">
          <section className="achievement-cg-modal" role="dialog" aria-modal="true" aria-labelledby="achievement-cg-title">
            <img className="achievement-cg-modal__image" src={achievementCgPopup.image} alt={achievementCgPopup.title} />
            <div className="achievement-cg-modal__copy">
              <span>{t('ui.achievements.cg.kicker')}</span>
              <h2 id="achievement-cg-title">{achievementCgPopup.title}</h2>
              <p>{achievementCgPopup.description}</p>
            </div>
            <div className="achievement-cg-modal__actions">
              <button type="button" className="primary-button" onClick={handleSaveAchievementCg}>
                {t('ui.achievements.cg.save')}
              </button>
              <button type="button" className="text-button" onClick={handleCloseAchievementCg}>
                {t('ui.achievements.cg.close')}
              </button>
            </div>
          </section>
        </div>
      )}

      {activeYearReview && <YearReviewModal review={activeYearReview} onClose={handleCloseYearReview} />}

      {isShopOpen && (
        <ShopModal
          pet={pet}
          visibleItems={visibleShopItems}
          activeCategory={activeShopCategory}
          itemIconMap={itemIconMap}
          onClose={handleCloseShop}
          onSelectCategory={setActiveShopCategory}
          onBuyItem={handleBuyItem}
          onExchangeHeart={handleExchangeHeart}
          isHeartExchangeCoolingDown={isHeartExchangeCoolingDown}
        />
      )}
      {isBoostCardOpen && (
        <BoostCardModal
          pet={pet}
          onClose={handleCloseBoostCards}
          onBuyCard={handleBuyBoostCard}
          onClaimDailyCoins={handleClaimBoostCardCoins}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal
          activeMod={activeMod}
          modMessage={modMessage}
          draftName={draftName}
          draftBirthday={draftBirthday}
          language={language}
          saveText={saveText}
          importSaveText={importSaveText}
          hasOpenedHelp={pet.hasOpenedHelp}
          hasClaimedHelpPageGift={hasClaimedHelpPageGift}
          onDraftNameChange={setDraftName}
          onDraftBirthdayChange={setDraftBirthday}
          onLanguageChange={handleLanguageChange}
          onImportSaveTextChange={setImportSaveText}
          onOpenHelp={handleOpenHelp}
          onClaimHelpPageGift={handleClaimHelpPageGift}
          onClose={() => {
            playAfterUnlock('close');
            setSettingsOpen(false);
          }}
          onSaveProfile={handleSaveProfile}
          onReset={handleReset}
          onClearMod={handleClearMod}
          onExportSave={handleExportSave}
          onDownloadSave={handleDownloadSave}
          onImportPastedSave={() => importSaveFromText(importSaveText)}
          onModFileChange={handleModFileChange}
          onImportSaveFileChange={handleImportSaveFileChange}
        />
      )}
      {isResetConfirmOpen && (
        <ConfirmDialog
          title={t('ui.settings.resetDialog.title')}
          message={t('ui.settings.resetDialog.message')}
          cancelLabel={t('ui.settings.resetDialog.cancel')}
          confirmLabel={t('ui.settings.resetDialog.confirm')}
          onCancel={handleCancelReset}
          onConfirm={handleConfirmReset}
        />
      )}
      {gardenClearConfirm && (
        <ConfirmDialog
          title={t(`ui.garden.confirm.${gardenClearConfirm.kind}Title`)}
          message={t(`ui.garden.confirm.${gardenClearConfirm.kind}Message`, {
            tree: t(`ui.garden.trees.${gardenClearConfirm.treeId}.name`),
            slot: gardenClearConfirm.slotIndex + 1,
            coins: gardenClearConfirm.coins,
          })}
          cancelLabel={t('ui.garden.confirm.cancel')}
          confirmLabel={t(`ui.garden.confirm.${gardenClearConfirm.kind}Confirm`)}
          onCancel={handleCancelGardenClear}
          onConfirm={handleConfirmGardenClear}
        />
      )}
    </main>
  );
};


export const App = () => {
  const [initialPet, setInitialPet] = useState<PetState | null>(() => loadPetOrNull());
  const [installedMod, setInstalledMod] = useState<ActivePetMod | null>(null);
  const [hasLoadedInitialMod, setHasLoadedInitialMod] = useState(false);
  const [modMessage, setModMessage] = useState('');
  const [isAudioEnabled, setAudioEnabledState] = useState(() => getAudioEnabled());

  useEffect(() => {
    void loadActivePetMod()
      .then((mod) => setInstalledMod(mod))
      .catch((error) => setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.loadFailed')))
      .finally(() => setHasLoadedInitialMod(true));
  }, []);

  const handleAudioToggle = () => {
    const nextEnabled = !isAudioEnabled;
    setAudioEnabled(nextEnabled);
    setAudioEnabledState(nextEnabled);
    if (nextEnabled) {
      void unlockAudio().then(() => {
        syncBgm('room');
        playSfx('tap');
      });
    }
  };

  const startWithMod = (mod: ActivePetMod | null) => {
    const nextPet = createPetForMod(mod);
    setInstalledMod(mod);
    setInitialPet(nextPet);
    setModMessage(mod ? t('ui.settings.mod.active', { name: mod.manifest.name, version: mod.manifest.version }) : '');
  };

  const handleUseBuiltin = async () => {
    try {
      await clearActivePetMod();
      startWithMod(null);
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.restoreFailed'));
    }
  };

  const handleImportMod = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const parsed = await parsePetModZip(file);
      await saveActivePetMod(parsed);
      const loaded = await loadActivePetMod();
      if (!loaded) throw new Error(t('ui.settings.mod.loadFailed'));
      startWithMod(loaded);
      setModMessage(parsed.warnings.length > 0 ? t('ui.settings.mod.importedWithFallback', { name: parsed.manifest.name, count: parsed.warnings.length }) : t('ui.settings.mod.imported', { name: parsed.manifest.name }));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.importFailed'));
      playSfx('error');
    }
  };

  if (!hasLoadedInitialMod) {
    return (
      <RolePicker
        installedMod={null}
        modMessage={modMessage}
        isAudioEnabled={isAudioEnabled}
        isLoading
        onUseBuiltin={handleUseBuiltin}
        onUseInstalledMod={() => undefined}
        onImportMod={handleImportMod}
        onAudioToggle={handleAudioToggle}
      />
    );
  }

  if (!initialPet) {
    return (
      <RolePicker
        installedMod={installedMod}
        modMessage={modMessage}
        isAudioEnabled={isAudioEnabled}
        onUseBuiltin={handleUseBuiltin}
        onUseInstalledMod={() => installedMod && startWithMod(installedMod)}
        onImportMod={handleImportMod}
        onAudioToggle={handleAudioToggle}
      />
    );
  }

  return (
    <PetApp
      key={initialPet.createdAt + ':' + (installedMod?.manifest.id ?? 'builtin')}
      initialPet={initialPet}
      initialActiveMod={installedMod}
      onResetToPicker={(storedMod) => {
        setInstalledMod(storedMod);
        setInitialPet(null);
      }}
    />
  );
};
