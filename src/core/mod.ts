import JSZip from 'jszip';
import type { ItemId, PetStatus, RecentActivity, ShopItem } from './pet';

export const modSchemaVersion = 1;

export const petStatusImageKeys = [
  'content',
  'hungry',
  'sad',
  'dirty',
  'tired',
  'sick',
  'sleeping',
] as const satisfies readonly PetStatus[];

export const petActivityImageKeys = [
  'happy',
  'bath',
  'eat_cookie',
  'eat_noodles',
  'eat_meat',
  'give_heart',
  'level_up',
  'reading_books',
  'workout',
  'work_food',
  'work_plants',
] as const satisfies readonly Exclude<RecentActivity, 'idle'>[];

export const itemImageKeys = [
  'emergency_biscuit',
  'bento',
  'nutri_meal',
  'pig_trotter',
  'strawberry_cake',
  'ad_milk',
  'small_bouquet',
  'shiny_sticker',
  'soft_cloud_doll',
  'ribbon_bell',
  'toy_ball',
  'shampoo',
  'medicine',
  'blanket',
] as const satisfies readonly ItemId[];

export type PetStatusImageKey = (typeof petStatusImageKeys)[number];
export type PetActivityImageKey = (typeof petActivityImageKeys)[number];
export type ItemImageKey = (typeof itemImageKeys)[number];
export type PetImageKey = PetStatusImageKey | PetActivityImageKey;

export interface PetModTexts {
  recentEvent?: string;
  favoriteFood?: string;
  status?: Partial<Record<PetStatus, string>>;
  items?: Partial<Record<ItemId, { name?: string; summary?: string }>>;
}

export interface PetModManifestV1 {
  schemaVersion: 1;
  id: string;
  name: string;
  author?: string;
  version: string;
  defaultPetName: string;
  description?: string;
  favoriteFoodIds?: ItemId[];
  texts?: PetModTexts;
}

export interface ParsedPetMod {
  manifest: PetModManifestV1;
  petImages: Partial<Record<PetImageKey, Blob>>;
  itemImages: Partial<Record<ItemId, Blob>>;
  warnings: string[];
}

export interface ActivePetMod {
  manifest: PetModManifestV1;
  petImageUrls: Partial<Record<PetImageKey, string>>;
  itemImageUrls: Partial<Record<ItemId, string>>;
}

export type ItemDisplay = ShopItem & {
  displayName: string;
  displaySummary: string;
};

const maxZipBytes = 25 * 1024 * 1024;
const maxImageBytes = 3 * 1024 * 1024;
const idPattern = /^[a-z0-9][a-z0-9._-]{1,63}$/;
const versionPattern = /^[0-9]+(?:\.[0-9]+){0,2}(?:[-+][a-z0-9._-]+)?$/i;
const allowedPetPaths = new Map<string, PetImageKey>([
  ...petStatusImageKeys.map((key) => [`pet/${key}.png`, key] as const),
  ...petActivityImageKeys.map((key) => [`pet/${key}.png`, key] as const),
]);
const allowedItemPaths = new Map<string, ItemId>(itemImageKeys.map((key) => [`items/${key}.png`, key] as const));
const allowedPaths = new Set(['manifest.json', ...allowedPetPaths.keys(), ...allowedItemPaths.keys()]);
const itemIdSet = new Set<ItemId>(itemImageKeys);
const statusSet = new Set<PetStatus>(petStatusImageKeys);
const pngHeader = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const asTrimmedString = (value: unknown, maxLength: number) => {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  return text ? text.slice(0, maxLength) : undefined;
};

const ensureString = (value: unknown, field: string, maxLength: number) => {
  const text = asTrimmedString(value, maxLength);
  if (!text) throw new Error(`manifest.json is missing ${field}.`);
  return text;
};

const normalizePath = (path: string) => path.replace(/\\/g, '/').replace(/^\/+/, '');

const isPngBlob = async (blob: Blob) => {
  const header = new Uint8Array(await blob.slice(0, pngHeader.length).arrayBuffer());
  return pngHeader.every((byte, index) => header[index] === byte);
};

const readTexts = (value: unknown): PetModTexts | undefined => {
  if (!isObject(value)) return undefined;

  const texts: PetModTexts = {};
  const recentEvent = asTrimmedString(value.recentEvent, 240);
  const favoriteFood = asTrimmedString(value.favoriteFood, 160);
  if (recentEvent) texts.recentEvent = recentEvent;
  if (favoriteFood) texts.favoriteFood = favoriteFood;

  if (isObject(value.status)) {
    const statusTexts: Partial<Record<PetStatus, string>> = {};
    for (const [key, rawText] of Object.entries(value.status)) {
      if (statusSet.has(key as PetStatus)) {
        const text = asTrimmedString(rawText, 24);
        if (text) statusTexts[key as PetStatus] = text;
      }
    }
    if (Object.keys(statusTexts).length > 0) texts.status = statusTexts;
  }

  if (isObject(value.items)) {
    const itemTexts: Partial<Record<ItemId, { name?: string; summary?: string }>> = {};
    for (const [key, rawConfig] of Object.entries(value.items)) {
      if (!itemIdSet.has(key as ItemId)) throw new Error(`Unknown item id in texts.items: ${key}`);
      if (!isObject(rawConfig)) continue;
      const name = asTrimmedString(rawConfig.name, 28);
      const summary = asTrimmedString(rawConfig.summary, 96);
      if (name || summary) itemTexts[key as ItemId] = { name, summary };
    }
    if (Object.keys(itemTexts).length > 0) texts.items = itemTexts;
  }

  return Object.keys(texts).length > 0 ? texts : undefined;
};

export const validatePetModManifest = (value: unknown): PetModManifestV1 => {
  if (!isObject(value)) throw new Error('manifest.json must be a JSON object.');

  if (value.schemaVersion !== modSchemaVersion) {
    if (typeof value.schemaVersion === 'number' && value.schemaVersion > modSchemaVersion) {
      throw new Error('This mod uses a newer schema version. Please upgrade PocPet.');
    }
    throw new Error('manifest.json schemaVersion must be 1.');
  }

  const id = ensureString(value.id, 'id', 64);
  if (!idPattern.test(id)) {
    throw new Error('manifest.json id must use lowercase letters, numbers, dots, dashes, or underscores.');
  }

  const version = ensureString(value.version, 'version', 32);
  if (!versionPattern.test(version)) {
    throw new Error('manifest.json version should look like 1.0.0.');
  }

  let favoriteFoodIds: ItemId[] | undefined;
  if (Array.isArray(value.favoriteFoodIds)) {
    favoriteFoodIds = [];
    for (const id of value.favoriteFoodIds) {
      if (!itemIdSet.has(id as ItemId)) throw new Error(`Unknown item id in favoriteFoodIds: ${String(id)}`);
      favoriteFoodIds.push(id as ItemId);
    }
  }

  return {
    schemaVersion: 1,
    id,
    name: ensureString(value.name, 'name', 48),
    author: asTrimmedString(value.author, 48),
    version,
    defaultPetName: ensureString(value.defaultPetName, 'defaultPetName', 16),
    description: asTrimmedString(value.description, 160),
    favoriteFoodIds: favoriteFoodIds && favoriteFoodIds.length > 0 ? Array.from(new Set(favoriteFoodIds)) : undefined,
    texts: readTexts(value.texts),
  };
};

export const parsePetModZip = async (file: File): Promise<ParsedPetMod> => {
  if (file.size > maxZipBytes) {
    throw new Error('Mod zip is larger than 25MB. Please compress the images.');
  }

  const zip = await JSZip.loadAsync(file);
  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new Error('Mod zip must contain manifest.json at the root.');

  let rawManifest: unknown;
  try {
    rawManifest = JSON.parse(await manifestEntry.async('text'));
  } catch {
    throw new Error('manifest.json is not valid JSON.');
  }
  const manifest = validatePetModManifest(rawManifest);
  const warnings: string[] = [];
  const petImages: ParsedPetMod['petImages'] = {};
  const itemImages: ParsedPetMod['itemImages'] = {};

  for (const entry of Object.values(zip.files)) {
    const path = normalizePath(entry.name);
    if (entry.dir || path.endsWith('/')) continue;
    if (!allowedPaths.has(path)) {
      throw new Error(`Mod zip contains an unsupported file: ${path}`);
    }
  }

  for (const [path, key] of allowedPetPaths) {
    const entry = zip.file(path);
    if (!entry) {
      warnings.push(`Missing ${path}; built-in image will be used.`);
      continue;
    }
    const blob = await entry.async('blob');
    if (blob.size > maxImageBytes) throw new Error(`${path} is larger than 3MB.`);
    if (!(await isPngBlob(blob))) throw new Error(`${path} must be a PNG image.`);
    petImages[key] = blob.slice(0, blob.size, 'image/png');
  }

  for (const [path, key] of allowedItemPaths) {
    const entry = zip.file(path);
    if (!entry) {
      warnings.push(`Missing ${path}; built-in icon will be used.`);
      continue;
    }
    const blob = await entry.async('blob');
    if (blob.size > maxImageBytes) throw new Error(`${path} is larger than 3MB.`);
    if (!(await isPngBlob(blob))) throw new Error(`${path} must be a PNG image.`);
    itemImages[key] = blob.slice(0, blob.size, 'image/png');
  }

  return { manifest, petImages, itemImages, warnings };
};

export const getModFavoriteFoodIds = (mod?: ActivePetMod | null) => mod?.manifest.favoriteFoodIds;

export const formatFavoriteFoodText = (mod: ActivePetMod | null | undefined, amount: number) => {
  const template = mod?.manifest.texts?.favoriteFood;
  return template ? template.replace(/\{amount\}/g, String(amount)) : undefined;
};

export const getModStatusText = (mod: ActivePetMod | null | undefined, status: PetStatus) =>
  mod?.manifest.texts?.status?.[status];

export const getDisplayShopItems = (
  items: readonly ShopItem[],
  mod: ActivePetMod | null | undefined,
): readonly ItemDisplay[] =>
  items.map((item) => ({
    ...item,
    displayName: mod?.manifest.texts?.items?.[item.id]?.name ?? item.name,
    displaySummary: mod?.manifest.texts?.items?.[item.id]?.summary ?? item.summary,
  }));
