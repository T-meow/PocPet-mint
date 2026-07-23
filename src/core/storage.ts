import { normalizePet, type NeighborEventContext, type PetState } from './pet';
import { hasLegacyPetSaveFingerprint, loadStoredPetJson } from './saveCodec';

const storageKey = 'pocpet.pet.v1';
const backupStorageKey = 'pocpet.pet.v1.backup';
const importBackupStorageKey = 'pocpet.pet.v1.import-backup';
const corruptStorageKey = 'pocpet.pet.v1.corrupt';

export type PetStorageLoadResult =
  | { status: 'missing' }
  | { status: 'ok'; pet: PetState }
  | { status: 'corrupt'; raw: string; backup: PetState | null };

const isValidStoredPetRaw = (raw: string) => {
  try {
    return hasLegacyPetSaveFingerprint(JSON.parse(raw));
  } catch {
    return false;
  }
};

const preserveCorruptRaw = (raw: string) => {
  try {
    window.localStorage.setItem(corruptStorageKey, raw);
  } catch {
    // Keep the primary key untouched when storage is unavailable or full.
  }
};

export const hasStoredPet = () => window.localStorage.getItem(storageKey) !== null;

export const loadPet = (now = Date.now(), eventContext?: NeighborEventContext): PetStorageLoadResult => {
  const raw = window.localStorage.getItem(storageKey);
  const result = loadStoredPetJson(raw, now, eventContext);
  if (result.status !== 'corrupt') return result;

  preserveCorruptRaw(result.raw);
  const backupResult = loadStoredPetJson(window.localStorage.getItem(backupStorageKey), now, eventContext);
  return {
    status: 'corrupt',
    raw: result.raw,
    backup: backupResult.status === 'ok' ? backupResult.pet : null,
  };
};

export const backupCurrentPet = () => {
  const raw = window.localStorage.getItem(storageKey);
  if (raw === null || !isValidStoredPetRaw(raw)) return false;
  window.localStorage.setItem(backupStorageKey, raw);
  return true;
};

export const saveImportBackup = (saveText: string) => {
  window.localStorage.setItem(importBackupStorageKey, saveText);
};

export const getImportBackup = () => window.localStorage.getItem(importBackupStorageKey);

export const savePet = (pet: PetState) => {
  try {
    backupCurrentPet();
  } catch {
    // A failed backup must not block the primary atomic localStorage write.
  }
  window.localStorage.setItem(storageKey, JSON.stringify(normalizePet(pet)));
};

const restoreStorageValue = (key: string, value: string | null) => {
  if (value === null) window.localStorage.removeItem(key);
  else window.localStorage.setItem(key, value);
};

export const replacePetFromImport = (pet: PetState, importBackupText: string) => {
  const previousPrimary = window.localStorage.getItem(storageKey);
  const previousBackup = window.localStorage.getItem(backupStorageKey);
  const previousImportBackup = window.localStorage.getItem(importBackupStorageKey);
  const nextPrimary = JSON.stringify(normalizePet(pet));

  try {
    window.localStorage.setItem(importBackupStorageKey, importBackupText);
    if (previousPrimary !== null && isValidStoredPetRaw(previousPrimary)) {
      window.localStorage.setItem(backupStorageKey, previousPrimary);
    }
    window.localStorage.setItem(storageKey, nextPrimary);
  } catch (error) {
    try {
      restoreStorageValue(storageKey, previousPrimary);
      restoreStorageValue(backupStorageKey, previousBackup);
      restoreStorageValue(importBackupStorageKey, previousImportBackup);
    } catch {
      // Preserve the original write error; callers keep the in-memory pet unchanged.
    }
    throw error;
  }
};

export const restorePetBackup = (now = Date.now(), eventContext?: NeighborEventContext): PetState | null => {
  const backupRaw = window.localStorage.getItem(backupStorageKey);
  const result = loadStoredPetJson(backupRaw, now, eventContext);
  if (result.status !== 'ok' || backupRaw === null) return null;

  const primaryRaw = window.localStorage.getItem(storageKey);
  if (primaryRaw !== null && !isValidStoredPetRaw(primaryRaw)) preserveCorruptRaw(primaryRaw);
  window.localStorage.setItem(storageKey, backupRaw);
  return result.pet;
};

export const getPreservedCorruptPetRaw = () => window.localStorage.getItem(corruptStorageKey);

export const clearPet = () => {
  window.localStorage.removeItem(storageKey);
  window.localStorage.removeItem(backupStorageKey);
  window.localStorage.removeItem(importBackupStorageKey);
  window.localStorage.removeItem(corruptStorageKey);
};
