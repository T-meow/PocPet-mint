import { useEffect, useRef, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { advancePet, evaluateAchievementUnlocks, type AchievementView, type NeighborEventContext, type PetState } from '../../core/pet';
import { playSfx, setAudioTemporarilyMuted } from '../../core/audio';
import { savePet } from '../../core/storage';

export type AchievementToast = { kind: 'single'; achievement: AchievementView } | { kind: 'review' };

interface CommitOptions {
  silent?: boolean;
}

interface PetSession {
  pet: PetState;
  petRef: MutableRefObject<PetState>;
  setPet: Dispatch<SetStateAction<PetState>>;
  commitPet: (next: PetState, options?: CommitOptions) => PetState;
  achievementToast: AchievementToast | null;
  setAchievementToast: Dispatch<SetStateAction<AchievementToast | null>>;
}

export const usePetSession = (
  initialPet: PetState,
  isHomeRef: MutableRefObject<boolean>,
  eventContext?: NeighborEventContext,
): PetSession => {
  const [pet, setPet] = useState<PetState>(initialPet);
  const [achievementToast, setAchievementToast] = useState<AchievementToast | null>(null);
  const petRef = useRef(pet);

  const commitPet = (next: PetState, options: CommitOptions = {}) => {
    const result = evaluateAchievementUnlocks(next);
    if (!options.silent && isHomeRef.current && result.unlocked.length > 0) {
      setAchievementToast(
        result.unlocked.length === 1 && !result.pet.achievements.pendingReviewNotice
          ? { kind: 'single', achievement: result.unlocked[0] }
          : { kind: 'review' },
      );
      playSfx('notification');
    }
    return result.pet;
  };

  const commitRef = useRef(commitPet);
  commitRef.current = commitPet;
  const eventContextRef = useRef(eventContext);
  eventContextRef.current = eventContext;

  useEffect(() => {
    petRef.current = pet;
    savePet(pet);
  }, [pet]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPet((current) => commitRef.current(advancePet(current, Date.now(), eventContextRef.current)));
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible = document.visibilityState === 'visible';
      setAudioTemporarilyMuted(!isVisible);
      if (isVisible) {
        setPet((current) => commitRef.current(advancePet(current, Date.now(), eventContextRef.current)));
      }
    };

    handleVisibilityChange();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  return { pet, petRef, setPet, commitPet, achievementToast, setAchievementToast };
};
