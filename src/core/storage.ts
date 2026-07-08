import { normalizePet, type PetState } from './pet';
import { loadStoredPetJson } from './saveCodec';

const storageKey = 'pocpet-mint.pet.v1';

export const hasStoredPet = () => window.localStorage.getItem(storageKey) !== null;

export const loadPet = (now = Date.now()): PetState => loadStoredPetJson(window.localStorage.getItem(storageKey), now);

export const loadPetOrNull = (now = Date.now()): PetState | null => {
  const raw = window.localStorage.getItem(storageKey);
  return raw ? loadStoredPetJson(raw, now) : null;
};

export const savePet = (pet: PetState) => {
  window.localStorage.setItem(storageKey, JSON.stringify(normalizePet(pet)));
};

export const clearPet = () => {
  window.localStorage.removeItem(storageKey);
};
