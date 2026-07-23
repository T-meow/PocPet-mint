import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Buffer } from 'node:buffer';
import 'fake-indexeddb/auto';
import type { PetModManifest } from '../src/core/mod';
import { getPetModLibraryState, loadActivePetMod } from '../src/core/modStorage';
import { createSaveFileText, loadStoredPetJson, parseSaveFileText } from '../src/core/saveCodec';
import { hasStoredPet, loadPet } from '../src/core/storage';
import { normalizePet } from '../src/core/petState';

const fixtureNow = Date.parse('2026-07-01T04:00:00.000Z');
const fixturePath = (name: string) => resolve('scripts/fixtures', name);

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  failSetKey?: string;

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    if (key === this.failSetKey) throw new Error(`Blocked fixture write for ${key}`);
    this.values.set(key, String(value));
  }
}

const setWindowStorage = (localStorage: Storage) => {
  Object.defineProperty(globalThis, 'window', {
    value: { localStorage },
    configurable: true,
  });
};

const requestResult = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolveRequest, rejectRequest) => {
    request.onsuccess = () => resolveRequest(request.result);
    request.onerror = () => rejectRequest(request.error ?? new Error('IndexedDB fixture request failed.'));
  });

const legacyRaw = readFileSync(fixturePath('pocpet-mint-1.0.1-local-storage.json'), 'utf8');
const legacyPet = JSON.parse(legacyRaw) as Record<string, unknown>;
const legacyExport = readFileSync(fixturePath('pocpet-mint-1.0.1-export.pocpet'), 'utf8').trim();
const modFixture = JSON.parse(
  readFileSync(fixturePath('pocpet-mint-1.0.1-mod-storage.json'), 'utf8'),
) as {
  activeManifestStorageKey: string;
  libraryStorageKey: string;
  databaseName: string;
  databaseVersion: number;
  imageStoreName: string;
  manifest: PetModManifest;
  imageRecord: {
    key: string;
    modId: string;
    scope: 'pet';
    imageKey: string;
    blobBase64: string;
    mimeType: string;
  };
};

const localStorage = new MemoryStorage();
setWindowStorage(localStorage);
localStorage.setItem('pocpet-mint.pet.v1', legacyRaw);
assert.equal(hasStoredPet(), true, 'Mint 1.0.1 storage key must remain active');

const loadedLegacy = loadPet(fixtureNow);
assert.equal(loadedLegacy.status, 'ok');
if (loadedLegacy.status !== 'ok') assert.fail('Mint 1.0.1 save must load successfully');
assert.equal(loadedLegacy.pet.name, 'mint-legacy');
assert.equal(loadedLegacy.pet.level, 37);
assert.equal(loadedLegacy.pet.coins, 4321);
assert.equal(loadedLegacy.pet.hearts, 87);
assert.equal(loadedLegacy.pet.inventory.emergency_biscuit, 12);
assert.equal(loadedLegacy.pet.inventory.strawberry_cake, 3);
assert.deepEqual(loadedLegacy.pet.birthday, { month: 6, day: 1 });
assert(loadedLegacy.pet.claimedRewardIds.includes('mint_legacy_fixture_reward'));
assert.equal(loadedLegacy.pet.partnerSchedule.schemaVersion, 5);
assert.equal(loadedLegacy.pet.goldenAppleGacha.schemaVersion, 3);
assert.equal(loadedLegacy.pet.classicEndgame.schemaVersion, 2);
assert.equal(loadedLegacy.pet.timeGuard.schemaVersion, 1);

const loadedDirectly = loadStoredPetJson(legacyRaw, fixtureNow);
assert.equal(loadedDirectly.status, 'ok');
if (loadedDirectly.status !== 'ok') assert.fail('Mint 1.0.1 raw save must load successfully');
assert.equal(loadedDirectly.pet.name, loadedLegacy.pet.name);
assert.equal(loadedDirectly.pet.coins, loadedLegacy.pet.coins);

const normalizedOnce = normalizePet(legacyPet, fixtureNow);
const normalizedTwice = normalizePet(normalizedOnce, fixtureNow);
assert.equal(
  JSON.stringify(normalizedTwice),
  JSON.stringify(normalizedOnce),
  'persisted save migration must be idempotent',
);
assert.equal(
  normalizedTwice.claimedRewardIds.length,
  new Set(normalizedTwice.claimedRewardIds).size,
  'migration reward ids must not be duplicated',
);

const importedLegacy = parseSaveFileText(legacyExport, fixtureNow);
assert.equal(importedLegacy.pet.name, 'mint-legacy');
assert.equal(importedLegacy.pet.coins, 4321);
assert.equal(importedLegacy.pet.pomodoro.isRunning, false);
assert.equal(importedLegacy.pet.lastUpdatedAt, fixtureNow);
assert.equal(importedLegacy.activeMod?.id, modFixture.manifest.id);

const roundTripText = createSaveFileText(importedLegacy.pet, modFixture.manifest, fixtureNow);
const roundTrip = parseSaveFileText(roundTripText, fixtureNow);
assert.equal(roundTrip.pet.name, importedLegacy.pet.name);
assert.equal(roundTrip.pet.coins, importedLegacy.pet.coins);
assert.equal(roundTrip.activeMod?.id, modFixture.manifest.id);

assert.throws(() => parseSaveFileText(`${legacyExport.slice(0, -1)}A`, fixtureNow));
assert.throws(
  () => parseSaveFileText(JSON.stringify({ schemaVersion: 2, app: 'Pocpet-Mint', pet: legacyPet }), fixtureNow),
  /newer Pocpet-Mint version/,
);
assert.throws(
  () => parseSaveFileText(JSON.stringify({ schemaVersion: 1, app: 'PocPet', pet: legacyPet }), fixtureNow),
  /not a Pocpet-Mint save file/,
);

localStorage.clear();
localStorage.setItem(modFixture.activeManifestStorageKey, JSON.stringify(modFixture.manifest));

await new Promise<void>((resolveDatabase, rejectDatabase) => {
  const request = indexedDB.open(modFixture.databaseName, modFixture.databaseVersion);
  request.onerror = () => rejectDatabase(request.error ?? new Error('Unable to create the v1 fixture database.'));
  request.onupgradeneeded = () => {
    request.result.createObjectStore(modFixture.imageStoreName, { keyPath: 'key' });
  };
  request.onsuccess = () => {
    const database = request.result;
    const transaction = database.transaction(modFixture.imageStoreName, 'readwrite');
    const { blobBase64, mimeType, ...record } = modFixture.imageRecord;
    transaction.objectStore(modFixture.imageStoreName).put({
      ...record,
      blob: new Blob([Buffer.from(blobBase64, 'base64')], { type: mimeType }),
    });
    transaction.oncomplete = () => {
      database.close();
      resolveDatabase();
    };
    transaction.onerror = () => rejectDatabase(transaction.error ?? new Error('Unable to seed the v1 fixture database.'));
    transaction.onabort = () => rejectDatabase(transaction.error ?? new Error('The v1 fixture database transaction aborted.'));
  };
});

const migratedLibrary = getPetModLibraryState();
assert.equal(migratedLibrary.activeModId, modFixture.manifest.id);
assert.equal(migratedLibrary.mods.length, 1);
assert.equal(localStorage.getItem(modFixture.activeManifestStorageKey), null);
assert(localStorage.getItem(modFixture.libraryStorageKey));

const activeMod = await loadActivePetMod();
assert.equal(activeMod?.manifest.id, modFixture.manifest.id);
assert(activeMod?.petImageUrls.content, 'the legacy IndexedDB image must remain readable');

const upgradedDatabase = await requestResult(indexedDB.open(modFixture.databaseName));
assert.equal(upgradedDatabase.version, 2);
const upgradedTransaction = upgradedDatabase.transaction(modFixture.imageStoreName, 'readonly');
const upgradedStore = upgradedTransaction.objectStore(modFixture.imageStoreName);
assert.equal(upgradedStore.indexNames.contains('modId'), true);
const upgradedRecord = await requestResult<{ blob?: Blob } | undefined>(upgradedStore.get(modFixture.imageRecord.key));
assert.equal(upgradedRecord?.blob?.size, Buffer.from(modFixture.imageRecord.blobBase64, 'base64').length);
upgradedDatabase.close();

const failedStorage = new MemoryStorage();
failedStorage.setItem(modFixture.activeManifestStorageKey, JSON.stringify(modFixture.manifest));
failedStorage.failSetKey = modFixture.libraryStorageKey;
setWindowStorage(failedStorage);
assert.throws(() => getPetModLibraryState(), /Blocked fixture write/);
assert(
  failedStorage.getItem(modFixture.activeManifestStorageKey),
  'legacy manifest must remain when writing the new library fails',
);

console.log('Mint 1.0.1 save and Mod storage migration checks passed.');
