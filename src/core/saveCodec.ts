import { advancePet, createDefaultPet, normalizePet, type NeighborEventContext, type PetState } from './pet';
import type { PetModManifest } from './mod';

export const saveFileSchemaVersion = 1;
const appId = 'Pocpet-Mint';
const protectedSavePrefix = 'POCPET-SAVE-v2:';
const protectedSaveKey = `${appId}:save-file:v2`;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface PocPetSaveModSummary {
  id: string;
  name: string;
  version: string;
}

export interface PocPetSaveFileV1 {
  schemaVersion: 1;
  app: typeof appId;
  exportedAt: string;
  pet: PetState;
  activeMod?: PocPetSaveModSummary;
}

export interface PocPetImportedSave {
  pet: PetState;
  activeMod?: PocPetSaveModSummary;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const readSummaryString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : undefined;
};

const readActiveModSummary = (value: unknown): PocPetSaveModSummary | undefined => {
  if (!isObject(value)) return undefined;
  const id = readSummaryString(value.id, 64);
  const name = readSummaryString(value.name, 48);
  const version = readSummaryString(value.version, 32);
  return id && name && version ? { id, name, version } : undefined;
};

const bytesToBase64Url = (bytes: Uint8Array) => {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToBytes = (text: string) => {
  const base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
};

const checksumText = (text: string) => {
  const bytes = textEncoder.encode(text);
  let hash = 0x811c9dc5;
  for (let index = 0; index < bytes.length; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
};

const transformSaveBytes = (bytes: Uint8Array) => {
  const keyBytes = textEncoder.encode(protectedSaveKey);
  const output = new Uint8Array(bytes.length);
  let state = 0x6d2b79f5;

  for (let index = 0; index < keyBytes.length; index += 1) {
    state = (Math.imul(state ^ keyBytes[index], 1664525) + 1013904223) >>> 0;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    state = (Math.imul(state + index + keyBytes[index % keyBytes.length], 1664525) + 1013904223) >>> 0;
    output[index] = bytes[index] ^ (state & 0xff) ^ keyBytes[index % keyBytes.length];
  }

  return output;
};

const protectSaveFileText = (plainText: string) =>
  `${protectedSavePrefix}${checksumText(plainText)}:${bytesToBase64Url(transformSaveBytes(textEncoder.encode(plainText)))}`;

const unprotectSaveFileText = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith(protectedSavePrefix)) return trimmed;

  const body = trimmed.slice(protectedSavePrefix.length);
  const separatorIndex = body.indexOf(':');
  if (separatorIndex <= 0) throw new Error('Save text is damaged.');

  const expectedChecksum = body.slice(0, separatorIndex).toLowerCase();
  const payload = body.slice(separatorIndex + 1);
  if (!/^[0-9a-f]{8}$/.test(expectedChecksum) || !payload) throw new Error('Save text is damaged.');

  let plainText = '';
  try {
    plainText = textDecoder.decode(transformSaveBytes(base64UrlToBytes(payload)));
  } catch {
    throw new Error('Save text could not be decoded.');
  }

  if (checksumText(plainText) !== expectedChecksum) throw new Error('Save text checksum does not match.');
  return plainText;
};

export const createSaveFileText = (pet: PetState, activeMod?: PetModManifest | null, now = Date.now()) => {
  const file: PocPetSaveFileV1 = {
    schemaVersion: saveFileSchemaVersion,
    app: appId,
    exportedAt: new Date(now).toISOString(),
    pet: normalizePet(pet, now),
    activeMod: activeMod
      ? {
          id: activeMod.id,
          name: activeMod.name,
          version: activeMod.version,
        }
      : undefined,
  };

  return protectSaveFileText(JSON.stringify(file));
};

const resetImportedTimeBaseline = (pet: PetState, now: number): PetState => {
  const normalized = normalizePet(pet, now);
  const pomodoro = normalized.pomodoro.isRunning
    ? {
        ...normalized.pomodoro,
        isRunning: false,
        phaseStartedAt: 0,
        phaseEndsAt: 0,
        pausedRemainingMs: Math.max(0, normalized.pomodoro.phaseEndsAt - normalized.pomodoro.phaseStartedAt),
      }
    : normalized.pomodoro;

  return {
    ...normalized,
    lastUpdatedAt: now,
    lastEnergyRecoveryAt: now,
    sleepStartedAt: normalized.isSleeping ? now : 0,
    lastDreamTalkAt: normalized.isSleeping ? 0 : normalized.lastDreamTalkAt,
    recentActivityUntil: 0,
    lastInteractionAt: now,
    lastPetInteractionAt: now,
    lastDailyEncounterAt: now,
    actionStreak: {
      ...normalized.actionStreak,
      windowStartedAt: now,
      lastAt: 0,
    },
    pomodoro,
  };
};

export const parseSaveFileText = (text: string, now = Date.now()): PocPetImportedSave => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(unprotectSaveFileText(text));
  } catch {
    throw new Error('Save text is not valid Pocpet-Mint save data.');
  }

  if (!isObject(parsed)) {
    throw new Error('Save text must be a JSON object.');
  }

  if (parsed.app === appId || parsed.schemaVersion !== undefined) {
    if (parsed.app !== appId) throw new Error('This is not a Pocpet-Mint save file.');
    if (parsed.schemaVersion !== saveFileSchemaVersion) {
      if (typeof parsed.schemaVersion === 'number' && parsed.schemaVersion > saveFileSchemaVersion) {
        throw new Error('This save file comes from a newer Pocpet-Mint version. Please upgrade the app.');
      }
      throw new Error('Unsupported save file version.');
    }
    if (!('pet' in parsed)) throw new Error('Save file is missing pet data.');
    return {
      pet: resetImportedTimeBaseline(normalizePet(parsed.pet, now), now),
      activeMod: readActiveModSummary(parsed.activeMod),
    };
  }

  return { pet: resetImportedTimeBaseline(normalizePet(parsed, now), now) };
};

export const loadStoredPetJson = (raw: string | null, now = Date.now(), eventContext?: NeighborEventContext) => {
  if (!raw) return createDefaultPet(now);
  try {
    return advancePet(JSON.parse(raw) as PetState, now, eventContext);
  } catch {
    return createDefaultPet(now);
  }
};
