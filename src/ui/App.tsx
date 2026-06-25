import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { Heart, Settings, Volume2, VolumeX } from 'lucide-react';
import {
  advancePet,
  applyPetAction,
  buyItem,
  canStartPomodoro,
  createDefaultPet,
  defaultPetName,
  getEnergyRecoveryInfo,
  getNextUpgradeHeartCost,
  getPetStatCap,
  interactWithPet,
  isPetLowEnergy,
  pausePomodoro,
  resetPomodoro,
  pomodoroMinHealthThreshold,
  recordPetInteraction,
  renamePet,
  shopCategories,
  shopItems,
  startPomodoro,
  updatePomodoroSettings,
  upgradePet,
  useInventoryItem,
  weatherInfo,
  type ItemId,
  type PetAction,
  type PetState,
  type PetStatus,
  type PomodoroDurations,
} from '../core/pet';
import { currencyIcon, resolveItemIcons, resolvePetActivityImages, resolvePetStatusImages } from '../assets';
import {
  getAudioEnabled,
  playSfx,
  setAudioEnabled,
  syncBgm,
  unlockAudio,
  type BgmMode,
  type SfxId,
} from '../core/audio';
import { clearPet, loadPet, savePet } from '../core/storage';
import {
  formatFavoriteFoodText,
  getDisplayShopItems,
  getModFavoriteFoodIds,
  getModStatusText,
  parsePetModZip,
  type ActivePetMod,
  type ItemDisplay,
} from '../core/mod';
import { clearActivePetMod, loadActivePetMod, saveActivePetMod } from '../core/modStorage';
import { createSaveFileText, parseSaveFileText } from '../core/saveCodec';
import { ActionDock } from './ActionDock';
import { FeatureRow } from './FeatureRow';
import { InventoryPanel } from './InventoryPanel';
import { PetDisplay } from './PetDisplay';
import { PomodoroOverlay } from './PomodoroOverlay';
import { SettingsModal } from './SettingsModal';
import { ShopModal } from './ShopModal';
import { StatusBar } from './StatusBar';
import { getLanguage, setLanguage, t, type LanguageCode } from '../i18n';

const formatSharedTime = (seconds: number) => {
  const totalMinutes = Math.floor(seconds / 60);
  if (totalMinutes < 1) return t('ui.time.lessThanMinute');
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? t('ui.time.hoursMinutes', { hours, minutes }) : t('ui.time.minutes', { minutes });
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

  const minutes =
    pet.pomodoro.phase === 'focus'
      ? pet.pomodoro.settings.focusMinutes
      : pet.pomodoro.phase === 'short_break'
        ? pet.pomodoro.settings.shortBreakMinutes
        : pet.pomodoro.settings.longBreakMinutes;

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

const getInventoryCount = (pet: PetState, itemId: ItemId) => pet.inventory[itemId] ?? 0;
const getShopItem = (itemId: ItemId) => shopItems.find((item) => item.id === itemId);
const getDisplayItem = (items: readonly ItemDisplay[], itemId: ItemId) => items.find((item) => item.id === itemId);

const getActionSfx = (action: PetAction): SfxId => {
  if (action === 'clean') return 'action_bath';
  if (action === 'play' || action === 'work') return 'action_work_play_medicine';
  return 'pet_touch';
};

const getItemSfx = (itemId: ItemId): SfxId => {
  const item = getShopItem(itemId);
  if (item?.kind === 'food') return 'action_eat';
  if (itemId === 'shampoo') return 'action_bath';
  if (itemId === 'blanket' || itemId === 'soft_cloud_doll') return 'action_blanket';
  if (itemId === 'medicine') return 'action_work_play_medicine';
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

export const App = () => {
  const [pet, setPet] = useState<PetState>(() => loadPet());
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const [isShopOpen, setShopOpen] = useState(false);
  const [isPomodoroOpen, setPomodoroOpen] = useState(false);
  const [isAudioEnabled, setAudioEnabledState] = useState(() => getAudioEnabled());
  const [language, setLanguageState] = useState<LanguageCode>(() => getLanguage());
  const [activeShopCategory, setActiveShopCategory] = useState(shopCategories[0].id);
  const [draftName, setDraftName] = useState(pet.name);
  const [activeMod, setActiveMod] = useState<ActivePetMod | null>(null);
  const [modMessage, setModMessage] = useState('');
  const [saveText, setSaveText] = useState('');
  const [importSaveText, setImportSaveText] = useState('');
  const petRef = useRef(pet);
  const completedFocusCountRef = useRef(pet.pomodoro.completedFocusCount);

  useEffect(() => {
    petRef.current = pet;
    savePet(pet);
  }, [pet]);

  useEffect(() => {
    void loadActivePetMod()
      .then((mod) => {
        setActiveMod(mod);
        if (mod) setModMessage(t('ui.settings.mod.active', { name: mod.manifest.name, version: mod.manifest.version }));
      })
      .catch((error) => setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.loadFailed')));
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPet((current) => advancePet(current));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setPet((current) => advancePet(current));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  const itemIconMap = useMemo(() => resolveItemIcons(activeMod), [activeMod]);
  const petStatusImageMap = useMemo(() => resolvePetStatusImages(activeMod), [activeMod]);
  const petActivityImageMap = useMemo(() => resolvePetActivityImages(activeMod), [activeMod]);
  const displayShopItems = useMemo(() => getDisplayShopItems(shopItems, activeMod), [activeMod]);
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

  const ownedItems = useMemo(
    () => displayShopItems.filter((item) => (pet.inventory[item.id] ?? 0) > 0),
    [displayShopItems, pet.inventory],
  );
  const visibleShopItems = useMemo(
    () => displayShopItems.filter((item) => item.kind === activeShopCategory),
    [activeShopCategory, displayShopItems],
  );
  const isLowEnergy = isPetLowEnergy(pet);
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
      : pet.isSleeping
        ? t('ui.pomodoro.sleepingTitle')
        : undefined;
  const isPomodoroActionDisabled = !pet.pomodoro.isRunning && !canRunPomodoro;
  const currentBgmMode: BgmMode = isShopOpen ? 'shop' : pet.isSleeping ? 'sleep' : 'room';

  useEffect(() => {
    syncBgm(currentBgmMode);
  }, [currentBgmMode, isAudioEnabled]);

  useEffect(() => {
    if (pet.pomodoro.completedFocusCount > completedFocusCountRef.current) {
      playSfx('notification');
    }
    completedFocusCountRef.current = pet.pomodoro.completedFocusCount;
  }, [pet.pomodoro.completedFocusCount]);

  const playAfterUnlock = (id: SfxId) => {
    void unlockAudio().then(() => playSfx(id));
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
      return next;
    });
  };

  const handleBuyItem = (itemId: ItemId) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, itemId);
      const beforeCoins = current.coins;
      const next = buyItem(current, itemId);
      const didGainItem = getInventoryCount(next, itemId) > beforeCount;
      const didSpendCoins = next.coins < beforeCoins;
      playSfx(didGainItem ? (didSpendCoins ? 'purchase' : 'coin') : 'error');
      return next;
    });
  };

  const handleUseItem = (itemId: ItemId) => {
    playAfterUnlock('tap');
    setPet((current) => {
      const beforeCount = getInventoryCount(current, itemId);
      const displayItem = getDisplayItem(displayShopItems, itemId);
      const next = useInventoryItem(current, itemId, Date.now(), {
        favoriteFoodIds: getModFavoriteFoodIds(activeMod),
        favoriteText: (amount) => formatFavoriteFoodText(activeMod, amount),
        itemName: displayItem?.displayName,
      });
      playSfx(getInventoryCount(next, itemId) < beforeCount ? getItemSfx(itemId) : 'error');
      return next;
    });
  };
  const handleInteract = () => {
    const outcome = getPetInteractionOutcome(petRef.current);
    playAfterUnlock(outcome === 'heart' ? 'pet_heart' : outcome === 'low_state' ? 'pet_low_state' : 'pet_touch');
    setPet((current) => interactWithPet(current));
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
    setPet((current) => (current.pomodoro.isRunning ? pausePomodoro(current) : startPomodoro(current)));
  };

  const handleResetPomodoro = () => {
    playAfterUnlock('notification');
    setPomodoroOpen(true);
    setPet((current) => resetPomodoro(current));
  };

  const handleUpgrade = () => {
    playAfterUnlock(canUpgrade ? 'pet_heart' : 'error');
    setPet((current) => upgradePet(current));
  };

  const handlePomodoroSettingChange = (key: PomodoroSettingKey, value: number) => {
    if (!Number.isFinite(value)) return;
    setPet((current) => updatePomodoroSettings(current, { [key]: value }));
  };

  const handleRename = () => {
    playAfterUnlock('tap');
    setPet((current) => renamePet(current, draftName));
    setSettingsOpen(false);
  };

  const handleLanguageChange = (nextLanguage: LanguageCode) => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    setLanguageState(nextLanguage);
    window.location.reload();
  };

  const handleReset = () => {
    playAfterUnlock('tap');
    const confirmed = window.confirm(t('ui.settings.resetConfirm'));
    if (!confirmed) return;
    clearPet();
    const fresh = createDefaultPet();
    const moddedFresh = activeMod
      ? {
          ...fresh,
          name: activeMod.manifest.defaultPetName,
          recentEvent: activeMod.manifest.texts?.recentEvent ?? fresh.recentEvent,
        }
      : fresh;
    setPet(moddedFresh);
    setDraftName(moddedFresh.name);
    setPomodoroOpen(false);
    setSettingsOpen(false);
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
          ...current,
          name: nextName,
          recentEvent: parsed.manifest.texts?.recentEvent ?? t('ui.settings.mod.switched', { name: parsed.manifest.name }),
        };
      });
      setDraftName((current) => (current === defaultPetName || current === oldDefaultName ? parsed.manifest.defaultPetName : current));
    } catch (error) {
      setModMessage(error instanceof Error ? error.message : t('ui.settings.mod.importFailed'));
      playSfx('error');
    }
  };

  const handleClearMod = async () => {
    try {
      await clearActivePetMod();
      setActiveMod(null);
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
    const text = saveText || createSaveFileText(petRef.current, activeMod?.manifest);
    setSaveText(text);
    downloadTextFile(`pocpet-save-${new Date().toISOString().slice(0, 10)}.json`, text);
  };

  const importSaveFromText = (text: string) => {
    try {
      const imported = parseSaveFileText(text);
      setPet(imported.pet);
      setDraftName(imported.pet.name);
      setImportSaveText('');
      const importedMod = imported.activeMod;
      const hasMatchingMod = importedMod ? activeMod?.manifest.id === importedMod.id : true;
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
          <button type="button" className="coin-pill" onClick={handleOpenShop} aria-label={t('ui.top.openShop')}>
            <img src={currencyIcon} alt="" aria-hidden="true" />
            <strong>{pet.coins}</strong>
          </button>
          <div className="heart-pill" aria-label={t('ui.top.heartsAria', { hearts: pet.hearts })} title={t('ui.top.heartsTitle')}>
            <Heart size={20} aria-hidden="true" />
            <strong>{pet.hearts}</strong>
          </div>
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
              setSettingsOpen(true);
            }}
          >
            <Settings size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

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
            <p>{pet.recentEvent}</p>
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
            onUpgrade={handleUpgrade}
            onOpenPomodoro={handleOpenPomodoro}
          />

          <div className="meta-row" aria-label={t('ui.dashboard.metaAria')}>
            <span>{t('ui.dashboard.sharedTime', { time: formatSharedTime(pet.ageSeconds) })}</span>
            <span title={weatherInfo[pet.weather].summary}>{t('ui.dashboard.weather', { weather: weatherInfo[pet.weather].label })}</span>
            <span>{pet.isSleeping ? t('ui.dashboard.resting') : t('ui.dashboard.active')}</span>
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

      <ActionDock isSleeping={pet.isSleeping} isLowEnergy={isLowEnergy} onAction={handleAction} onOpenShop={handleOpenShop} />

      {isShopOpen && (
        <ShopModal
          pet={pet}
          visibleItems={visibleShopItems}
          activeCategory={activeShopCategory}
          itemIconMap={itemIconMap}
          onClose={handleCloseShop}
          onSelectCategory={setActiveShopCategory}
          onBuyItem={handleBuyItem}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal
          activeMod={activeMod}
          modMessage={modMessage}
          draftName={draftName}
          language={language}
          saveText={saveText}
          importSaveText={importSaveText}
          onDraftNameChange={setDraftName}
          onLanguageChange={handleLanguageChange}
          onImportSaveTextChange={setImportSaveText}
          onClose={() => {
            playAfterUnlock('close');
            setSettingsOpen(false);
          }}
          onRename={handleRename}
          onReset={handleReset}
          onClearMod={handleClearMod}
          onExportSave={handleExportSave}
          onDownloadSave={handleDownloadSave}
          onImportPastedSave={() => importSaveFromText(importSaveText)}
          onModFileChange={handleModFileChange}
          onImportSaveFileChange={handleImportSaveFileChange}
        />
      )}
    </main>
  );
};







