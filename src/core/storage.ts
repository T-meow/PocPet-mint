import { normalizePet, type PetState } from './pet';
import { loadStoredPetJson } from './saveCodec';

const storageKey = 'pocpet.pet.v1';

export const loadPet = (now = Date.now()): PetState => loadStoredPetJson(window.localStorage.getItem(storageKey), now);

export const savePet = (pet: PetState) => {
  window.localStorage.setItem(storageKey, JSON.stringify(normalizePet(pet)));
};

export const clearPet = () => {
  window.localStorage.removeItem(storageKey);
};
