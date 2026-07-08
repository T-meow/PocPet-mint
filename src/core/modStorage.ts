import {
  itemImageKeys as builtinItemImageKeys,
  modCgImageKeys,
  petActivityImageKeys,
  petStatusImageKeys,
  validatePetModManifest,
  type ActivePetMod,
  type ParsedPetMod,
  type PetImageKey,
  type PetModManifest,
} from './mod';

const activeManifestStorageKey = 'pocpet-mint.mod.active.v1';
const databaseName = 'pocpet-mint-mods';
const imageStoreName = 'images';
const databaseVersion = 1;

type ImageScope = 'pet' | 'item' | 'cg';

interface StoredImageRecord {
  key: string;
  modId: string;
  scope: ImageScope;
  imageKey: string;
  blob: Blob;
}

const objectUrls = new Set<string>();

const revokeObjectUrls = () => {
  for (const url of objectUrls) URL.revokeObjectURL(url);
  objectUrls.clear();
};

const getImageRecordKey = (modId: string, scope: ImageScope, key: string) => `${modId}:${scope}:${key}`;

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);
    request.onerror = () => reject(request.error ?? new Error('Unable to open mod image database.'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(imageStoreName)) db.createObjectStore(imageStoreName, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
  });

const withStore = async <T>(mode: IDBTransactionMode, execute: (store: IDBObjectStore) => IDBRequest<T>) => {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(imageStoreName, mode);
      const request = execute(tx.objectStore(imageStoreName));
      request.onerror = () => reject(request.error ?? tx.error ?? new Error('Mod image database request failed.'));
      request.onsuccess = () => resolve(request.result);
      tx.onerror = () => reject(tx.error ?? new Error('Mod image database transaction failed.'));
      tx.onabort = () => reject(tx.error ?? new Error('Mod image database transaction aborted.'));
    });
  } finally {
    db.close();
  }
};

const putRecord = (record: StoredImageRecord) => withStore('readwrite', (store) => store.put(record));
const getRecord = (key: string) => withStore<StoredImageRecord | undefined>('readonly', (store) => store.get(key));
const clearStore = () => withStore('readwrite', (store) => store.clear());

export const getStoredPetModManifest = (): PetModManifest | null => {
  try {
    const raw = window.localStorage.getItem(activeManifestStorageKey);
    if (!raw) return null;
    return validatePetModManifest(JSON.parse(raw));
  } catch {
    window.localStorage.removeItem(activeManifestStorageKey);
    return null;
  }
};

export const saveActivePetMod = async (mod: ParsedPetMod) => {
  await clearStore();
  for (const [imageKey, blob] of Object.entries(mod.petImages)) {
    if (!blob) continue;
    await putRecord({
      key: getImageRecordKey(mod.manifest.id, 'pet', imageKey),
      modId: mod.manifest.id,
      scope: 'pet',
      imageKey,
      blob,
    });
  }
  for (const [imageKey, blob] of Object.entries(mod.itemImages)) {
    if (!blob) continue;
    await putRecord({
      key: getImageRecordKey(mod.manifest.id, 'item', imageKey),
      modId: mod.manifest.id,
      scope: 'item',
      imageKey,
      blob,
    });
  }
  for (const [imageKey, blob] of Object.entries(mod.cgImages)) {
    if (!blob) continue;
    await putRecord({
      key: getImageRecordKey(mod.manifest.id, 'cg', imageKey),
      modId: mod.manifest.id,
      scope: 'cg',
      imageKey,
      blob,
    });
  }
  window.localStorage.setItem(activeManifestStorageKey, JSON.stringify(mod.manifest));
};

export const clearActivePetMod = async () => {
  window.localStorage.removeItem(activeManifestStorageKey);
  revokeObjectUrls();
  await clearStore();
};

export const loadActivePetMod = async (): Promise<ActivePetMod | null> => {
  const manifest = getStoredPetModManifest();
  revokeObjectUrls();
  if (!manifest) return null;

  const petImageUrls: ActivePetMod['petImageUrls'] = {};
  const itemImageUrls: ActivePetMod['itemImageUrls'] = {};
  const cgImageUrls: ActivePetMod['cgImageUrls'] = {};

  for (const key of [...petStatusImageKeys, ...petActivityImageKeys]) {
    const record = await getRecord(getImageRecordKey(manifest.id, 'pet', key));
    if (!record?.blob) continue;
    const url = URL.createObjectURL(record.blob);
    objectUrls.add(url);
    petImageUrls[key as PetImageKey] = url;
  }

  const storedItemImageKeys = manifest.schemaVersion === 2
    ? [
        ...Object.keys(manifest.items?.overrides ?? {}),
        ...(manifest.items?.custom ?? []).map((item: { id: string }) => item.id),
      ]
    : [...builtinItemImageKeys];

  for (const key of storedItemImageKeys) {
    const record = await getRecord(getImageRecordKey(manifest.id, 'item', key));
    if (!record?.blob) continue;
    const url = URL.createObjectURL(record.blob);
    objectUrls.add(url);
    itemImageUrls[key] = url;
  }

  for (const key of modCgImageKeys) {
    const record = await getRecord(getImageRecordKey(manifest.id, 'cg', key));
    if (!record?.blob) continue;
    const url = URL.createObjectURL(record.blob);
    objectUrls.add(url);
    cgImageUrls[key] = url;
  }

  return { manifest, petImageUrls, itemImageUrls, cgImageUrls };
};
