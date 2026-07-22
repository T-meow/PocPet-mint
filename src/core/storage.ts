import { normalizePet, type NeighborEventContext, type PetState } from './pet';
import { loadStoredPetJson } from './saveCodec';

const storageKey = 'pocpet.pet.v1';

export const hasStoredPet = () => window.localStorage.getItem(storageKey) !== null;

export const loadPet = (now = Date.now(), eventContext?: NeighborEventContext): PetState =>
  loadStoredPetJson(window.localStorage.getItem(storageKey), now, eventContext);

export const loadPetOrNull = (now = Date.now(), eventContext?: NeighborEventContext): PetState | null => {
  const raw = window.localStorage.getItem(storageKey);
  return raw ? loadStoredPetJson(raw, now, eventContext) : null;
};

export const savePet = (pet: PetState) => {
  window.localStorage.setItem(storageKey, JSON.stringify(normalizePet(pet)));
};

export const clearPet = () => {
  window.localStorage.removeItem(storageKey);
};
