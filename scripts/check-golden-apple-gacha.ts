import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  annualDateRewardGachaTickets,
  buyBoostCard,
  claimAvailableDateRewards,
  claimGoldenAppleGachaStarterGift,
  classicEndgameUnlockLevel,
  classicEndgameUnlockSkillLevel,
  classicGoldenAppleHeartExchangeRate,
  completeClassicLegacyLevel,
  completeDreamProjectStage,
  dreamProjectCategories,
  dreamProjectTotalCoinCost,
  dreamStageCoinCosts,
  dreamTotalAppleCost,
  dreamTotalCoinCost,
  exchangeClassicGoldenApplesForHearts,
  getClassicLegacyAppleCost,
  getClassicLegacyLevelCoinCost,
  getClassicGoldenAppleHeartExchangePreview,
  getClassicGoalProgress,
  getClassicTrophyCount,
  getClassicTrophyEffects,
  getGoldenAppleGachaCoinExpectedValue,
  getGoldenAppleGachaExpectedValue,
  getGoldenAppleGachaTenExpectedValue,
  getPartnerScheduleClaimPreview,
  getPartnerScheduleOfferPreview,
  getPetEnergyCap,
  getUpgradeHeartCost,
  goldenAppleGachaStarterGiftRewardId,
  goldenAppleGachaJackpotPityThreshold,
  goldenAppleGachaPoolWeight,
  goldenAppleGachaRewards,
  goldenAppleGachaSchemaVersion,
  investDreamProject,
  isClassicEndgameUnlocked,
  normalizeGoldenAppleGachaState,
  normalizePartnerScheduleState,
  partnerScheduleDefinitions,
  partnerScheduleSchemaVersion,
  festivalConfigs,
  resolveDailyGachaTicket,
  startPartnerSchedule,
  upgradePet,
  useInventoryItem,
  drawGoldenAppleGacha,
} from '../src/core/pet';
import { advanceGarden, defaultGardenState, gardenSchemaVersion, gardenTreeDefinitions, goldenAppleTreeLimit, normalizeGardenState, plantTree } from '../src/core/garden';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { getInventoryItem, shopItems } from '../src/core/items';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import type { GardenSlot, PartnerScheduleCategory, PetState } from '../src/core/petTypes';
import { hashString } from '../src/core/utils';

const dayMs = 24 * 60 * 60 * 1000;
const now = new Date(2026, 6, 22, 12, 0, 0).getTime();
const near = (actual: number, expected: number, tolerance: number, label: string) =>
  assert(Math.abs(actual - expected) <= tolerance, `${label}: expected ${expected} ± ${tolerance}, got ${actual}`);

for (const localePath of ['src/i18n/zh-CN.json', 'src/i18n/en-US.json']) {
  const locale = JSON.parse(readFileSync(localePath, 'utf8')) as {
    ui?: { classicEndgame?: { projects?: Record<string, { stages?: Record<string, string> }>; trophies?: { names?: Record<string, unknown> }; exchange?: { title?: string; confirm?: { title?: string } } } };
    pet?: { classicEndgame?: { exchangeLocked?: string; exchangeEmpty?: string; exchangeSuccess?: string } };
  };
  const classicEndgame = locale.ui?.classicEndgame;
  assert(classicEndgame, `${localePath} must include Classic endgame copy`);
  dreamProjectCategories.forEach((category) => {
    for (let stage = 1; stage <= 5; stage += 1) {
      assert(classicEndgame.projects?.[category]?.stages?.[String(stage)], `${localePath} missing ${category} stage ${stage}`);
    }
    assert(classicEndgame.trophies?.names?.[category], `${localePath} missing ${category} trophy names`);
  });
  assert(classicEndgame.trophies?.names?.diamond, `${localePath} missing diamond trophy name`);
  assert(classicEndgame.exchange?.title, `${localePath} missing golden apple exchange title`);
  assert(classicEndgame.exchange?.confirm?.title, `${localePath} missing golden apple exchange confirmation`);
  assert(locale.pet?.classicEndgame?.exchangeLocked, `${localePath} missing locked exchange event`);
  assert(locale.pet?.classicEndgame?.exchangeEmpty, `${localePath} missing empty exchange event`);
  assert(locale.pet?.classicEndgame?.exchangeSuccess, `${localePath} missing exchange success event`);
}

assert.deepEqual(
  [19, 20, 30, 50, 70, 90, 99].map(getUpgradeHeartCost),
  [6859, 6900, 7120, 7560, 8000, 8440, 8638],
  'upgrade costs must follow the cubic-to-linear curve',
);
const totalHeartsToLevel99 = Array.from({ length: 98 }, (_, index) => getUpgradeHeartCost(index + 2))
  .reduce((sum, cost) => sum + cost, 0);
assert.equal(totalHeartsToLevel99, 657619);
const cumulativeHeartsAt = (targetLevel: number) => Array.from(
  { length: Math.max(0, targetLevel - 1) },
  (_, index) => getUpgradeHeartCost(index + 2),
).reduce((sum, cost) => sum + cost, 0);
assert.deepEqual(
  [20, 30, 50, 70, 90, 99].map(cumulativeHeartsAt),
  [42999, 113209, 260229, 416049, 580669, 657619],
  'milestone cumulative costs must match the three-year plan',
);
near(totalHeartsToLevel99 / 600 / 365.2425, 3, 0.001, 'Lv.1 to Lv.99 at 600 hearts per day');

assert.equal(goldenAppleGachaRewards.reduce((sum, reward) => sum + reward.weight, 0), goldenAppleGachaPoolWeight);
assert(!goldenAppleGachaRewards.some((reward) => reward.itemId === 'shampoo'), 'shampoo must not be in the pool');
const gachaWeights = new Map(goldenAppleGachaRewards.map((reward) => [reward.id, reward.weight]));
const expectedGachaWeights: Record<string, number> = {
  coins_100: 10350,
  coins_200: 8000,
  coins_300: 7600,
  coins_500: 5200,
  coins_888: 6000,
  coins_1888: 2100,
  coins_3888: 638,
  coins_8888: 112,
  bento_5: 3200,
  nutri_meal_5: 3200,
  energy_drink_5: 3200,
  blanket_5: 2800,
  picture_book_5: 2000,
  bento_10: 8000,
  energy_drink_10: 7600,
  blanket_10: 2600,
  picture_book_10: 2600,
  normal_fertilizer_1: 4800,
  harvest_nutrient_1: 5000,
  heart_fertilizer_1: 1000,
  money_tree_sapling_1: 1180,
  golden_apple_tree_sapling_1: 320,
  golden_apple_1: 11632,
  golden_apple_3: 593,
  golden_apple_5: 200,
  golden_apple_10: 73,
  golden_apple_100: 2,
};
assert.equal(gachaWeights.size, Object.keys(expectedGachaWeights).length, 'the pool must contain only the planned rewards');
Object.entries(expectedGachaWeights).forEach(([rewardId, weight]) => {
  assert.equal(gachaWeights.get(rewardId), weight, `${rewardId} must use the planned weight`);
});

const totalWeightFor = (predicate: (reward: typeof goldenAppleGachaRewards[number]) => boolean) =>
  goldenAppleGachaRewards.reduce((sum, reward) => sum + (predicate(reward) ? reward.weight : 0), 0);
const basicConsumables = new Set(['bento', 'nutri_meal', 'energy_drink', 'blanket', 'picture_book']);
const gardenConsumables = new Set(['normal_fertilizer', 'harvest_nutrient', 'heart_fertilizer']);
const saplings = new Set(['money_tree_sapling', 'golden_apple_tree_sapling']);
assert.equal(totalWeightFor((reward) => reward.kind === 'coins'), 40000);
assert.equal(totalWeightFor((reward) => Boolean(reward.itemId && basicConsumables.has(reward.itemId))), 35200);
assert.equal(totalWeightFor((reward) => Boolean(reward.itemId && gardenConsumables.has(reward.itemId))), 10800);
assert.equal(totalWeightFor((reward) => Boolean(reward.itemId && saplings.has(reward.itemId))), 1500);
assert.equal(totalWeightFor((reward) => reward.itemId === 'golden_apple'), 12500);
assert.equal(gachaWeights.get('coins_200'), gachaWeights.get('bento_10'));
assert.equal(gachaWeights.get('coins_300'), gachaWeights.get('energy_drink_10'));
assert.equal(
  gachaWeights.get('coins_500'),
  (gachaWeights.get('blanket_10') ?? 0) + (gachaWeights.get('picture_book_10') ?? 0),
);
assert.equal(gachaWeights.get('golden_apple_tree_sapling_1'), (gachaWeights.get('golden_apple_100') ?? 0) * 160);

const expectedRarityWeights = { common: 55950, uncommon: 21200, rare: 20912, legendary: 1936, jackpot: 2 } as const;
Object.entries(expectedRarityWeights).forEach(([rarity, weight]) => {
  assert.equal(totalWeightFor((reward) => reward.rarity === rarity), weight, `${rarity} rarity weight must match the plan`);
});

const appleProbability = totalWeightFor((reward) => reward.itemId === 'golden_apple') / goldenAppleGachaPoolWeight;
const tenDrawFallbackProbability = (1 - appleProbability) ** 10;
const appleCountExpected = goldenAppleGachaRewards.reduce((sum, reward) =>
  sum + (reward.itemId === 'golden_apple' ? reward.amount * reward.weight / goldenAppleGachaPoolWeight : 0), 0);
const whiteGreenProbability = (expectedRarityWeights.common + expectedRarityWeights.uncommon) / goldenAppleGachaPoolWeight;
const tenDrawWhiteGreenCount = whiteGreenProbability * 10
  - tenDrawFallbackProbability * whiteGreenProbability / (1 - appleProbability);
const coinExpectedValue = getGoldenAppleGachaCoinExpectedValue();
const tenDrawCoinExpectedValue = coinExpectedValue * 10
  - tenDrawFallbackProbability * coinExpectedValue / (1 - appleProbability);
near(getGoldenAppleGachaExpectedValue(), 538.74768, 0.00001, 'single expected value');
near(coinExpectedValue, 202.838, 0.00001, 'coin expected value');
near(getGoldenAppleGachaTenExpectedValue(), 5500.067254, 0.00001, 'ten draw expected value');
near(tenDrawCoinExpectedValue, 1967.395173, 0.00001, 'ten draw coin expected value');
near(tenDrawFallbackProbability, 0.2630755762, 0.0000000001, 'ten draw fallback probability');
near(appleCountExpected, 0.15341, 0.0000001, 'single golden apple count');
near(appleCountExpected * 10 + tenDrawFallbackProbability, 1.7971755762, 0.0000000001, 'ten draw golden apple count');
near(tenDrawWhiteGreenCount, 7.4830425063, 0.0000000001, 'ten draw white and green result count');
assert.equal(getInventoryItem('golden_apple')?.price, 888);
assert(!shopItems.some((item) => item.id === 'golden_apple'), 'golden apples must not enter the normal shop');

const gachaModalSource = readFileSync('src/ui/GoldenAppleGachaModal.tsx', 'utf8');
assert(
  gachaModalSource.includes('{!gachaState.jackpotPityUsed ? ('),
  'the probability dialog must render pity status only while the one-time pity remains available',
);
assert(
  !gachaModalSource.includes("gachaState.jackpotPityUsed ? 'ui.gacha.pityUsed'"),
  'used pity information must stay hidden instead of rendering an exhausted status',
);

const fundedPet = { ...createDefaultPet(now), coins: 1_000_000 };
const deterministicA = drawGoldenAppleGacha(fundedPet, 'coins', 10, now);
const deterministicB = drawGoldenAppleGacha(fundedPet, 'coins', 10, now);
assert.deepEqual(deterministicA.results, deterministicB.results, 'same save state must replay deterministically');
assert.equal(deterministicA.results.length, 10);
assert(deterministicA.results.some((result) => result.itemId === 'golden_apple'), 'ten draw must contain a golden apple result');
assert.equal(deterministicA.pet.goldenAppleGacha.totalDraws, 10);
assert.equal(deterministicA.pet.goldenAppleGacha.coinsSpent, 5000);
assert.equal(deterministicA.pet.goldenAppleGacha.rngCounter, 10);
assert.equal(deterministicA.pet.goldenAppleGacha.recentResults.length, 10);

const noCoinDraw = drawGoldenAppleGacha(createDefaultPet(now), 'coins', 1, now);
assert.equal(noCoinDraw.error, 'not_enough_coins');
assert.deepEqual(noCoinDraw.pet, createDefaultPet(now), 'failed payment must not mutate state');
const ticketPet = {
  ...createDefaultPet(now),
  goldenAppleGacha: { ...createDefaultPet(now).goldenAppleGacha, tickets: 10 },
};
const ticketDraw = drawGoldenAppleGacha(ticketPet, 'tickets', 10, now);
assert.equal(ticketDraw.error, undefined);
assert.equal(ticketDraw.pet.goldenAppleGacha.tickets, 0);
assert.equal(ticketDraw.pet.goldenAppleGacha.ticketsSpent, 10);
assert.equal(ticketDraw.pet.coins, ticketPet.coins + ticketDraw.results.reduce((sum, result) => sum + (result.kind === 'coins' ? result.amount : 0), 0));

assert.equal(goldenAppleGachaSchemaVersion, 2);
assert.equal(goldenAppleGachaJackpotPityThreshold, 1000);
const rawV1Gacha = structuredClone(createDefaultPet(now).goldenAppleGacha) as unknown as Record<string, unknown>;
rawV1Gacha.schemaVersion = 1;
rawV1Gacha.totalDraws = 4321;
delete rawV1Gacha.jackpotPityMisses;
delete rawV1Gacha.jackpotPityUsed;
const migratedV1Gacha = normalizeGoldenAppleGachaState(rawV1Gacha, createDefaultPet(now).createdAt, now);
assert.equal(migratedV1Gacha.schemaVersion, goldenAppleGachaSchemaVersion);
assert.equal(migratedV1Gacha.jackpotPityMisses, 0, 'v1 saves must not backfill pity misses from historical draws');
assert.equal(migratedV1Gacha.jackpotPityUsed, false, 'v1 saves must begin with the one-time pity available');
const malformedV2Gacha = normalizeGoldenAppleGachaState({
  ...createDefaultPet(now).goldenAppleGacha,
  totalDraws: 5,
  jackpotPityMisses: goldenAppleGachaJackpotPityThreshold,
  jackpotPityUsed: 'false',
}, createDefaultPet(now).createdAt, now);
assert.equal(malformedV2Gacha.jackpotPityUsed, false, 'non-boolean pity state must not consume the one-time guarantee');
assert.equal(malformedV2Gacha.jackpotPityMisses, 5, 'pity misses must not exceed total draws');
const normalizedUsedPity = normalizeGoldenAppleGachaState({
  ...createDefaultPet(now).goldenAppleGacha,
  totalDraws: 1000,
  jackpotPityMisses: 999,
  jackpotPityUsed: true,
}, createDefaultPet(now).createdAt, now);
assert.equal(normalizedUsedPity.jackpotPityMisses, 0, 'used pity state must stop carrying misses');

const coinPityMiss = drawGoldenAppleGacha({ ...createDefaultPet(now), coins: 10_000 }, 'coins', 1, now);
assert.equal(coinPityMiss.error, undefined);
assert.notEqual(coinPityMiss.results[0].rewardId, 'golden_apple_100', 'the fixed first draw must be a pity miss');
assert.equal(coinPityMiss.results[0].pityGuaranteed, false);
assert.equal(coinPityMiss.pet.goldenAppleGacha.jackpotPityMisses, 1, 'coin draws must accumulate pity misses');
const ticketPityMiss = drawGoldenAppleGacha({
  ...coinPityMiss.pet,
  goldenAppleGacha: { ...coinPityMiss.pet.goldenAppleGacha, tickets: 1 },
}, 'tickets', 1, now + 1);
assert.equal(ticketPityMiss.error, undefined);
assert.notEqual(ticketPityMiss.results[0].rewardId, 'golden_apple_100', 'the fixed second draw must be a pity miss');
assert.equal(ticketPityMiss.pet.goldenAppleGacha.jackpotPityMisses, 2, 'ticket draws must share the same pity counter');

const jackpotDefinitionIndex = goldenAppleGachaRewards.findIndex((reward) => reward.id === 'golden_apple_100');
assert(jackpotDefinitionIndex >= 0, 'jackpot definition must exist');
const jackpotWeightStart = goldenAppleGachaRewards
  .slice(0, jackpotDefinitionIndex)
  .reduce((sum, reward) => sum + reward.weight, 0);
const jackpotWeightEnd = jackpotWeightStart + goldenAppleGachaRewards[jackpotDefinitionIndex].weight;
const pitySeed = createDefaultPet(now).goldenAppleGacha.rngSeed;
const isNaturalJackpotCounter = (counter: number) => {
  const target = hashString(`${pitySeed}:${counter}:reward`) % goldenAppleGachaPoolWeight;
  return target >= jackpotWeightStart && target < jackpotWeightEnd;
};
let naturalJackpotCounter = 0;
while (!isNaturalJackpotCounter(naturalJackpotCounter) && naturalJackpotCounter < 2_000_000) naturalJackpotCounter += 1;
assert(naturalJackpotCounter < 2_000_000, 'a deterministic natural jackpot counter must be discoverable');

let knownNonJackpotCounter = 1;
while (isNaturalJackpotCounter(knownNonJackpotCounter)) knownNonJackpotCounter += 1;
const almostReadyPityPet: PetState = {
  ...createDefaultPet(now),
  coins: 20_000,
  goldenAppleGacha: {
    ...createDefaultPet(now).goldenAppleGacha,
    totalDraws: goldenAppleGachaJackpotPityThreshold - 1,
    rngCounter: knownNonJackpotCounter,
    jackpotPityMisses: goldenAppleGachaJackpotPityThreshold - 1,
    jackpotPityUsed: false,
  },
};
const thousandthMiss = drawGoldenAppleGacha(almostReadyPityPet, 'coins', 1, now);
assert.equal(thousandthMiss.results[0].pityGuaranteed, false, 'the 1000th miss must not be replaced early');
assert.equal(thousandthMiss.pet.goldenAppleGacha.jackpotPityMisses, goldenAppleGachaJackpotPityThreshold);
const drawAfterThousandMisses = drawGoldenAppleGacha(thousandthMiss.pet, 'coins', 1, now + 1);
assert.equal(drawAfterThousandMisses.results[0].pityGuaranteed, true, 'the draw after 1000 misses must trigger pity');
const pityReadyPet: PetState = {
  ...createDefaultPet(now),
  coins: 20_000,
  goldenAppleGacha: {
    ...createDefaultPet(now).goldenAppleGacha,
    totalDraws: goldenAppleGachaJackpotPityThreshold,
    rngCounter: knownNonJackpotCounter - 1,
    jackpotPityMisses: goldenAppleGachaJackpotPityThreshold,
    jackpotPityUsed: false,
  },
};
const forcedJackpot = drawGoldenAppleGacha(pityReadyPet, 'coins', 1, now);
assert.equal(forcedJackpot.error, undefined);
assert.equal(forcedJackpot.results[0].rewardId, 'golden_apple_100');
assert.equal(forcedJackpot.results[0].pityGuaranteed, true);
assert.equal(forcedJackpot.results[0].guaranteed, false, 'jackpot pity must not reuse the ten-draw guarantee flag');
assert.equal(forcedJackpot.pet.goldenAppleGacha.rngCounter, pityReadyPet.goldenAppleGacha.rngCounter + 1, 'forced pity must consume one RNG counter');
assert.equal(forcedJackpot.pet.goldenAppleGacha.jackpotPityMisses, 0);
assert.equal(forcedJackpot.pet.goldenAppleGacha.jackpotPityUsed, true);
assert.equal(forcedJackpot.pet.goldenAppleGacha.recentResults[0].pityGuaranteed, true, 'recent results must persist the pity marker');
assert.equal(
  normalizeGoldenAppleGachaState(forcedJackpot.pet.goldenAppleGacha, forcedJackpot.pet.createdAt, now).recentResults[0].pityGuaranteed,
  true,
  'normalization must preserve the pity marker',
);
const afterUsedPity = drawGoldenAppleGacha(forcedJackpot.pet, 'coins', 1, now + 1);
assert.notEqual(afterUsedPity.results[0].rewardId, 'golden_apple_100', 'the fixed post-pity draw must be a natural miss');
assert.equal(afterUsedPity.results[0].pityGuaranteed, false, 'the one-time pity must never force a second result');
assert.equal(afterUsedPity.pet.goldenAppleGacha.jackpotPityMisses, 0, 'misses must stop accumulating after pity is used');
assert.equal(afterUsedPity.pet.goldenAppleGacha.jackpotPityUsed, true);

const naturalJackpotPet: PetState = {
  ...createDefaultPet(now),
  coins: 10_000,
  goldenAppleGacha: {
    ...createDefaultPet(now).goldenAppleGacha,
    totalDraws: 731,
    rngCounter: naturalJackpotCounter,
    jackpotPityMisses: 731,
    jackpotPityUsed: false,
  },
};
const naturalJackpot = drawGoldenAppleGacha(naturalJackpotPet, 'coins', 1, now);
assert.equal(naturalJackpot.results[0].rewardId, 'golden_apple_100');
assert.equal(naturalJackpot.results[0].pityGuaranteed, false, 'a natural jackpot must not be marked as pity');
assert.equal(naturalJackpot.pet.goldenAppleGacha.jackpotPityMisses, 0, 'a natural jackpot must reset consecutive misses');
assert.equal(naturalJackpot.pet.goldenAppleGacha.jackpotPityUsed, false, 'a natural jackpot must preserve one-time pity eligibility');

let tenDrawCounter = 0;
while (Array.from({ length: 9 }, (_, index) => isNaturalJackpotCounter(tenDrawCounter + index)).some(Boolean)) tenDrawCounter += 9;
const crossingTenPet: PetState = {
  ...createDefaultPet(now),
  coins: 10_000,
  goldenAppleGacha: {
    ...createDefaultPet(now).goldenAppleGacha,
    totalDraws: goldenAppleGachaJackpotPityThreshold - 9,
    rngCounter: tenDrawCounter,
    jackpotPityMisses: goldenAppleGachaJackpotPityThreshold - 9,
    jackpotPityUsed: false,
  },
};
const crossingTen = drawGoldenAppleGacha(crossingTenPet, 'coins', 10, now);
assert.equal(crossingTen.results.filter((result) => result.pityGuaranteed).length, 1);
assert.equal(crossingTen.results[9].rewardId, 'golden_apple_100', 'the tenth result must force pity after nine misses reach the threshold');
assert.equal(crossingTen.results[9].pityGuaranteed, true, 'the ten-draw apple fallback must not overwrite the forced jackpot');
assert.equal(crossingTen.results[9].guaranteed, false);
assert.equal(crossingTen.pet.goldenAppleGacha.rngCounter, tenDrawCounter + 10);
assert.equal(crossingTen.pet.goldenAppleGacha.jackpotPityMisses, 0);
assert.equal(crossingTen.pet.goldenAppleGacha.jackpotPityUsed, true);

const rawLegacyRecentResult = structuredClone(deterministicA.pet.goldenAppleGacha) as unknown as Record<string, unknown>;
rawLegacyRecentResult.recentResults = [{ ...deterministicA.results[0], pityGuaranteed: undefined }];
const normalizedLegacyRecentResult = normalizeGoldenAppleGachaState(rawLegacyRecentResult, deterministicA.pet.createdAt, now);
assert.equal(normalizedLegacyRecentResult.recentResults[0].pityGuaranteed, false, 'legacy recent results must default the pity marker to false');

const starterGift = claimGoldenAppleGachaStarterGift(createDefaultPet(now));
assert.equal(starterGift.claimed, true);
assert.equal(starterGift.pet.goldenAppleGacha.tickets, 10);
assert(starterGift.pet.claimedRewardIds.includes(goldenAppleGachaStarterGiftRewardId));
const repeatedStarterGift = claimGoldenAppleGachaStarterGift(starterGift.pet);
assert.equal(repeatedStarterGift.claimed, false);
assert.deepEqual(repeatedStarterGift.pet, starterGift.pet, 'starter gift must be idempotent');
const migratedStarterGiftPet = normalizePet({ ...createDefaultPet(now), claimedRewardIds: [] }, now);
assert(!migratedStarterGiftPet.claimedRewardIds.includes(goldenAppleGachaStarterGiftRewardId));
assert.equal(claimGoldenAppleGachaStarterGift(migratedStarterGiftPet).pet.goldenAppleGacha.tickets, 10);

let samplePet = { ...createDefaultPet(now), coins: 100_000_000 };
const sampleCounts = { coins: 0, consumables: 0, garden: 0, saplings: 0, apples: 0 };
const consumableIds = new Set(['bento', 'nutri_meal', 'energy_drink', 'blanket', 'picture_book']);
const gardenIds = new Set(['normal_fertilizer', 'harvest_nutrient', 'heart_fertilizer']);
const saplingIds = new Set(['money_tree_sapling', 'golden_apple_tree_sapling']);
const sampleSize = 30000;
for (let index = 0; index < sampleSize; index += 1) {
  const outcome = drawGoldenAppleGacha(samplePet, 'coins', 1, now + index);
  assert.equal(outcome.error, undefined);
  samplePet = outcome.pet;
  const result = outcome.results[0];
  if (result.kind === 'coins') sampleCounts.coins += 1;
  else if (result.itemId === 'golden_apple') sampleCounts.apples += 1;
  else if (result.itemId && consumableIds.has(result.itemId)) sampleCounts.consumables += 1;
  else if (result.itemId && gardenIds.has(result.itemId)) sampleCounts.garden += 1;
  else if (result.itemId && saplingIds.has(result.itemId)) sampleCounts.saplings += 1;
}
near(sampleCounts.coins / sampleSize, 0.4, 0.012, 'fixed-seed coin sample');
near(sampleCounts.consumables / sampleSize, 0.352, 0.012, 'fixed-seed consumable sample');
near(sampleCounts.garden / sampleSize, 0.108, 0.008, 'fixed-seed garden sample');
near(sampleCounts.saplings / sampleSize, 0.015, 0.004, 'fixed-seed sapling sample');
near(sampleCounts.apples / sampleSize, 0.125, 0.008, 'fixed-seed golden apple sample');

let ticketState = createDefaultPet(now);
ticketState = resolveDailyGachaTicket(ticketState, 'partner_schedule', 100, now).pet;
ticketState = resolveDailyGachaTicket(ticketState, 'daily_wish', 100, now).pet;
ticketState = resolveDailyGachaTicket(ticketState, 'daily_encounter', 100, now).pet;
assert.equal(ticketState.goldenAppleGacha.tickets, 3);
assert.equal(ticketState.goldenAppleGacha.dailyTicketsGranted, 3);
const repeatedSource = resolveDailyGachaTicket(ticketState, 'daily_wish', 100, now);
assert.equal(repeatedSource.processed, false);
assert.equal(repeatedSource.pet.goldenAppleGacha.tickets, 3);
const rollback = resolveDailyGachaTicket(ticketState, 'daily_wish', 100, now - dayMs);
assert.equal(rollback.processed, false, 'clock rollback must not reprocess a source');
assert.equal(rollback.pet.goldenAppleGacha.dailyDateKey, ticketState.goldenAppleGacha.dailyDateKey);
const nextDay = resolveDailyGachaTicket(ticketState, 'partner_schedule', 100, now + dayMs);
assert.equal(nextDay.granted, true);
assert.equal(nextDay.pet.goldenAppleGacha.dailyTicketsGranted, 1);
const beforeReset = new Date(2026, 6, 23, 4, 59, 0).getTime();
const afterReset = new Date(2026, 6, 23, 5, 0, 0).getTime();
assert.notEqual(getDailyResetDateKey(beforeReset), getDailyResetDateKey(afterReset));

assert.equal(annualDateRewardGachaTickets, 10);
const birthdayTime = new Date(2026, 6, 22, 12, 0, 0).getTime();
const birthdayPet = { ...createDefaultPet(birthdayTime), birthday: { month: 7, day: 22 } };
const birthdayRewards = claimAvailableDateRewards(birthdayPet, birthdayTime);
assert.equal(birthdayRewards.rewards.find((reward) => reward.kind === 'birthday')?.gachaTickets, 10);
assert.equal(birthdayRewards.pet.goldenAppleGacha.tickets, 10);
const repeatedBirthday = claimAvailableDateRewards(birthdayRewards.pet, birthdayTime);
assert.equal(repeatedBirthday.pet.goldenAppleGacha.tickets, 10, 'annual rewards must not grant tickets twice');

const anniversaryTime = new Date(2026, 7, 12, 12, 0, 0).getTime();
const anniversaryPet = {
  ...createDefaultPet(anniversaryTime),
  createdAt: new Date(2020, 7, 12, 12, 0, 0).getTime(),
  birthday: undefined,
};
const anniversaryRewards = claimAvailableDateRewards(anniversaryPet, anniversaryTime);
assert.equal(anniversaryRewards.rewards.find((reward) => reward.kind === 'anniversary')?.gachaTickets, 10);
assert.equal(anniversaryRewards.pet.goldenAppleGacha.tickets, 10);

festivalConfigs.forEach((festival) => {
  const festivalTime = new Date(2027, festival.month - 1, festival.day, 12, 0, 0).getTime();
  const festivalPet = { ...createDefaultPet(festivalTime), birthday: undefined };
  const festivalRewards = claimAvailableDateRewards(festivalPet, festivalTime);
  assert.equal(festivalRewards.rewards.find((reward) => reward.kind === 'festival')?.gachaTickets, 10, `${festival.id} must grant ten tickets`);
  assert.equal(festivalRewards.pet.goldenAppleGacha.tickets, 10);
});

const monthlyTime = new Date(2026, 1, 1, 12, 0, 0).getTime();
const monthlyRewards = claimAvailableDateRewards({ ...createDefaultPet(monthlyTime), birthday: undefined }, monthlyTime);
assert.equal(monthlyRewards.rewards.find((reward) => reward.kind === 'monthly_gift')?.gachaTickets, undefined);
assert.equal(monthlyRewards.rewards.find((reward) => reward.kind === 'daily_login')?.gachaTickets, undefined);
assert.equal(monthlyRewards.pet.goldenAppleGacha.tickets, 0);

assert.equal(gardenSchemaVersion, 2);
assert.equal(gardenTreeDefinitions.golden_apple_tree.growDurationMs, 4 * dayMs);
assert.equal(gardenTreeDefinitions.golden_apple_tree.harvestCooldownMs, 48 * 60 * 60 * 1000);
assert.equal(gardenTreeDefinitions.golden_apple_tree.maxHarvests, 9);
assert.equal(goldenAppleTreeLimit, 3);

const oldGarden = defaultGardenState(now) as unknown as Record<string, unknown>;
oldGarden.schemaVersion = 1;
const oldSlots = [...(oldGarden.slots as GardenSlot[])];
oldSlots[0] = { ...oldSlots[0], unlocked: true, treeId: 'golden_apple_tree', state: 'growing', plantedAt: now - dayMs, nextReadyAt: now + dayMs, maxHarvests: 7, harvestsUsed: 3 };
oldSlots[1] = { ...oldSlots[1], unlocked: true, treeId: 'golden_apple_tree', state: 'withered', plantedAt: now - 10 * dayMs, nextReadyAt: now - dayMs, maxHarvests: 7, harvestsUsed: 7 };
oldGarden.slots = oldSlots;
const migratedGarden = normalizeGardenState(oldGarden, now);
assert.equal(migratedGarden.slots[0].maxHarvests, 9, 'active old golden apple tree should gain two harvests');
assert.equal(migratedGarden.slots[1].maxHarvests, 7, 'withered old tree must not be revived');
assert.equal(normalizeGardenState(migratedGarden, now).slots[0].maxHarvests, 9, 'migration must only run once');

const overLimitSlots = defaultGardenState(now).slots.map((slot, index): GardenSlot => index < 4
  ? { ...slot, unlocked: true, treeId: 'golden_apple_tree', state: index === 3 ? 'withered' : 'growing', plantedAt: now, nextReadyAt: now + dayMs, maxHarvests: 9, harvestsUsed: index === 3 ? 9 : 0 }
  : { ...slot, unlocked: true });
const overLimitPet = {
  ...createDefaultPet(now),
  inventory: { golden_apple_tree_sapling: 1 },
  garden: { ...defaultGardenState(now), slots: overLimitSlots },
};
const preservedOverLimit = normalizePet(overLimitPet, now);
assert.equal(preservedOverLimit.garden.slots.filter((slot) => slot.treeId === 'golden_apple_tree').length, 4);
const blockedPlant = plantTree(preservedOverLimit, 4, 'golden_apple_tree', now);
assert.equal(blockedPlant.garden.slots[4].state, 'empty');
assert.equal(blockedPlant.inventory.golden_apple_tree_sapling, 1);

assert.deepEqual(dreamStageCoinCosts, [2000, 4000, 8000, 16000, 30000]);
assert.equal(dreamProjectTotalCoinCost, 60000);
assert.equal(dreamTotalCoinCost, 240000);
assert.equal(dreamTotalAppleCost, 60);
assert.deepEqual([1, 2, 3, 4].map(getClassicLegacyLevelCoinCost), [20000, 27000, 36450, 49208]);
assert.deepEqual([1, 5, 6, 10, 11].map(getClassicLegacyAppleCost), [1, 1, 2, 2, 3]);
assert.equal(classicEndgameUnlockLevel, 20);
assert.equal(classicEndgameUnlockSkillLevel, 6);

const unlockSkill = { level: 6, xp: 0, masterCompletions: 0 };
const unlockReadyPet: PetState = {
  ...createDefaultPet(now),
  level: 20,
  partnerSchedule: {
    ...createDefaultPet(now).partnerSchedule,
    skills: { study: unlockSkill, cooking: unlockSkill, garden: unlockSkill, exercise: unlockSkill },
  },
};
assert.equal(isClassicEndgameUnlocked({ ...unlockReadyPet, level: 19 }), false, 'Lv.19 must stay locked');
assert.equal(isClassicEndgameUnlocked(unlockReadyPet), true, 'Lv.20 and all Lv.6 skills must unlock');
assert.equal(isClassicEndgameUnlocked({
  ...unlockReadyPet,
  partnerSchedule: {
    ...unlockReadyPet.partnerSchedule,
    skills: { ...unlockReadyPet.partnerSchedule.skills, garden: { ...unlockSkill, level: 5 } },
  },
}), false, 'one Lv.5 skill must keep the goals locked');

const lockedFundedPet: PetState = {
  ...unlockReadyPet,
  level: 19,
  coins: 10000,
  achievements: {
    ...unlockReadyPet.achievements,
    counters: {
      ...unlockReadyPet.achievements.counters,
      partnerScheduleClaimCountsByCategory: { study: 10, cooking: 0, garden: 0, exercise: 0 },
    },
  },
  classicEndgame: {
    ...unlockReadyPet.classicEndgame,
    projects: {
      ...unlockReadyPet.classicEndgame.projects,
      study: { completedStages: 0, currentStageCoins: 2000 },
    },
  },
};
assert.equal(investDreamProject(lockedFundedPet, 'study', 1000, now).coins, lockedFundedPet.coins, 'locked goals must reject investment');
assert.equal(completeDreamProjectStage(lockedFundedPet, 'study', now).classicEndgame.projects.study.completedStages, 0, 'locked goals must reject settlement');

const skill = { level: 10, xp: 0, masterCompletions: 30 };
const endgameBase: PetState = {
  ...createDefaultPet(now),
  level: 30,
  coins: 500000,
  inventory: { golden_apple: 4 },
  partnerSchedule: {
    ...createDefaultPet(now).partnerSchedule,
    skills: { study: skill, cooking: skill, garden: skill, exercise: skill },
  },
  achievements: {
    ...createDefaultPet(now).achievements,
    counters: {
      ...createDefaultPet(now).achievements.counters,
      partnerScheduleClaimCountsByCategory: { study: 120, cooking: 120, garden: 120, exercise: 120 },
    },
  },
  classicEndgame: {
    ...createDefaultPet(now).classicEndgame,
    projects: {
      ...createDefaultPet(now).classicEndgame.projects,
      study: { completedStages: 3, currentStageCoins: 16000 },
    },
    lifetimeCoinsInvested: 30000,
  },
};

const withGoalStages = (
  pet: PetState,
  stages: Partial<Record<PartnerScheduleCategory, number>>,
): PetState => ({
  ...pet,
  classicEndgame: {
    ...pet.classicEndgame,
    projects: dreamProjectCategories.reduce<PetState['classicEndgame']['projects']>((projects, category) => ({
      ...projects,
      [category]: {
        completedStages: stages[category] ?? pet.classicEndgame.projects[category].completedStages,
        currentStageCoins: 0,
      },
    }), pet.classicEndgame.projects),
  },
});

const studyBronzePet = withGoalStages(createDefaultPet(now), { study: 1 });
assert.equal(getClassicTrophyCount(studyBronzePet), 1);
assert.equal(getClassicTrophyEffects(studyBronzePet).partnerScheduleRewardMultiplier, 1.25);
assert.equal(getClassicTrophyEffects(withGoalStages(studyBronzePet, { study: 3 })).partnerScheduleRewardMultiplier, 1.5);
assert.equal(getClassicTrophyEffects(withGoalStages(studyBronzePet, { study: 5 })).partnerScheduleRewardMultiplier, 2);
assert.equal(getClassicTrophyEffects(withGoalStages(createDefaultPet(now), { cooking: 5 })).foodEffectMultiplier, 2);
assert.equal(getClassicTrophyEffects(withGoalStages(createDefaultPet(now), { garden: 5 })).gardenExtraDropChancePercent, 100);
assert.equal(getClassicTrophyEffects(withGoalStages(createDefaultPet(now), { exercise: 5 })).energyCapBonus, 100);

const diamondPet = withGoalStages(createDefaultPet(now), { study: 5, cooking: 5, garden: 5, exercise: 5 });
assert.equal(getClassicTrophyCount(diamondPet), 12);
assert.deepEqual(getClassicTrophyEffects(diamondPet), {
  partnerScheduleRewardMultiplier: 2.5,
  foodEffectMultiplier: 2.5,
  gardenExtraDropChancePercent: 150,
  energyCapBonus: 150,
  diamondUnlocked: true,
});

assert.equal(classicGoldenAppleHeartExchangeRate, 100);
const lockedExchangePet: PetState = { ...createDefaultPet(now), hearts: 25, inventory: { golden_apple: 10 } };
assert.equal(getClassicGoldenAppleHeartExchangePreview(lockedExchangePet, 1).unlocked, false);
const lockedExchange = exchangeClassicGoldenApplesForHearts(lockedExchangePet, 1, now);
assert.equal(lockedExchange.hearts, lockedExchangePet.hearts, 'locked exchange must not grant hearts');
assert.equal(lockedExchange.inventory.golden_apple, 10, 'locked exchange must not spend apples');

const exchangePet: PetState = {
  ...diamondPet,
  hearts: 123,
  inventory: { golden_apple: 15 },
  achievements: {
    ...diamondPet.achievements,
    completedGoodEndingYears: [1, 2, 3],
  },
};
const earnedHeartsBeforeExchange = exchangePet.achievements.counters.heartEarnedTotal;
assert.deepEqual(getClassicGoldenAppleHeartExchangePreview(exchangePet, 10), {
  unlocked: true,
  availableApples: 15,
  appleAmount: 10,
  heartAmount: 1000,
  canExchange: true,
});
const singleExchange = exchangeClassicGoldenApplesForHearts(exchangePet, 1, now);
assert.equal(singleExchange.inventory.golden_apple, 14);
assert.equal(singleExchange.hearts, 223, 'exchange must ignore achievement heart bonuses');
assert.equal(singleExchange.achievements.counters.heartEarnedTotal, earnedHeartsBeforeExchange + 100);
const tenExchange = exchangeClassicGoldenApplesForHearts(exchangePet, 10, now);
assert.equal(tenExchange.inventory.golden_apple, 5);
assert.equal(tenExchange.hearts, 1123);
const allExchange = exchangeClassicGoldenApplesForHearts(exchangePet, Number.MAX_SAFE_INTEGER, now);
assert.equal(allExchange.inventory.golden_apple ?? 0, 0);
assert.equal(allExchange.hearts, 1623, 'oversized exchange requests must clamp to inventory');
const invalidExchange = exchangeClassicGoldenApplesForHearts(exchangePet, 0, now);
assert.equal(invalidExchange.inventory.golden_apple, 15);
assert.equal(invalidExchange.hearts, 123);

const boostedExchangePet = withGoalStages(buyBoostCard({
  ...createDefaultPet(now),
  hearts: 1000,
  inventory: { golden_apple: 1 },
}, 'best_friend_pass', now), { study: 5, cooking: 5, garden: 5, exercise: 5 });
const randomBeforeExchange = Math.random;
Math.random = () => 0;
try {
  assert.equal(
    exchangeClassicGoldenApplesForHearts(boostedExchangePet, 1, now).hearts,
    boostedExchangePet.hearts + 100,
    'exchange must ignore active Boost Card heart bonuses',
  );
} finally {
  Math.random = randomBeforeExchange;
}

const exchangeForUpgrade = exchangeClassicGoldenApplesForHearts({
  ...diamondPet,
  level: 20,
  hearts: 0,
  inventory: { golden_apple: 70 },
}, 70, now);
assert.equal(upgradePet(exchangeForUpgrade, now).level, 21, 'exchanged hearts must be immediately available for upgrades');

const scheduleBase = normalizePet({
  ...unlockReadyPet,
  energy: 195,
  hunger: 195,
  mood: 195,
  health: 195,
}, now);
const scheduleDefinition = partnerScheduleDefinitions.find((definition) => definition.category === 'study' && definition.size === 'short');
assert(scheduleDefinition, 'study short schedule definition must exist');
const plainSchedulePreview = getPartnerScheduleOfferPreview(scheduleBase, scheduleDefinition, now);
const bronzeSchedulePet = withGoalStages(scheduleBase, { study: 1 });
const bronzeSchedulePreview = getPartnerScheduleOfferPreview(bronzeSchedulePet, scheduleDefinition, now);
assert.equal(bronzeSchedulePreview.trophyRewardMultiplier, 1.25);
assert.equal(bronzeSchedulePreview.coinReward, Math.round(plainSchedulePreview.coinReward * 1.25));
assert.equal(bronzeSchedulePreview.skillXp, Math.round(plainSchedulePreview.skillXp * 1.25));
const startedSchedule = startPartnerSchedule(bronzeSchedulePet, bronzeSchedulePet.partnerSchedule.offers[0].id, now);
assert.equal(startedSchedule.partnerSchedule.active?.trophyRewardMultiplier, 1.25);
const upgradedWhileActive = withGoalStages(startedSchedule, { study: 5 });
assert.equal(upgradedWhileActive.partnerSchedule.active?.trophyRewardMultiplier, 1.25, 'active schedules must keep the start snapshot');
assert.equal(getPartnerScheduleOfferPreview(upgradedWhileActive, scheduleDefinition, now).trophyRewardMultiplier, 2, 'new schedules must use the latest trophy tier');

const rawV4Schedule = structuredClone(startedSchedule.partnerSchedule) as unknown as Record<string, unknown>;
rawV4Schedule.schemaVersion = 4;
const rawV4Active = rawV4Schedule.active as Record<string, unknown>;
delete rawV4Active.trophyRewardMultiplier;
const migratedV4Schedule = normalizePartnerScheduleState(rawV4Schedule, {
  level: startedSchedule.level,
  createdAt: startedSchedule.createdAt,
}, now, false);
assert.equal(partnerScheduleSchemaVersion, 5);
assert.equal(migratedV4Schedule.active?.trophyRewardMultiplier, 1, 'v4 active schedules must default to multiplier 1');
if (migratedV4Schedule.active) {
  const legacyResult = {
    ...migratedV4Schedule.active,
    completedAt: migratedV4Schedule.active.endsAt,
  };
  assert.equal(getPartnerScheduleClaimPreview(legacyResult, 'coins').coins, migratedV4Schedule.active.coinReward);
}
const rawV4PendingSchedule = structuredClone(rawV4Schedule);
delete rawV4PendingSchedule.active;
rawV4PendingSchedule.pendingResult = { ...rawV4Active, completedAt: now };
const migratedV4Pending = normalizePartnerScheduleState(rawV4PendingSchedule, {
  level: startedSchedule.level,
  createdAt: startedSchedule.createdAt,
}, now);
assert.equal(migratedV4Pending.pendingResult?.trophyRewardMultiplier, 1, 'v4 pending rewards must default to multiplier 1');
const combinedScheduleReward = getPartnerScheduleClaimPreview({
  offerId: 'combined-rounding',
  templateId: 'cooking_lunch',
  category: 'cooking',
  size: 'standard',
  completedAt: now,
  coinReward: 100,
  skillXp: 10,
  trophyRewardMultiplier: 1.25,
  grantsMasterCompletion: false,
}, 'category', 1);
assert.equal(combinedScheduleReward.itemAmount, 3, 'trophy and extra reward copies must multiply before one final rounding');
assert.equal(combinedScheduleReward.coins, 200);
assert.equal(combinedScheduleReward.skillXp, 38);

const cookingGoldPet = withGoalStages({
  ...createDefaultPet(now),
  hunger: 0,
  cleanliness: 50,
  inventory: { watermelon: 1 },
}, { cooking: 5 });
const ateWithCookingGold = useInventoryItem(cookingGoldPet, 'watermelon', now);
assert.equal(ateWithCookingGold.hunger, 56, 'gold cooking trophy must double positive normal-food effects');
assert.equal(ateWithCookingGold.cleanliness, 48, 'food trophies must not amplify negative effects');
const masteryCookingPet: PetState = {
  ...cookingGoldPet,
  partnerSchedule: {
    ...cookingGoldPet.partnerSchedule,
    skills: {
      ...cookingGoldPet.partnerSchedule.skills,
      cooking: { level: 10, xp: 0, masterCompletions: 60 },
    },
  },
};
assert.equal(useInventoryItem(masteryCookingPet, 'watermelon', now).hunger, 64, 'cooking mastery and trophy multipliers must multiply');
const specialApplePet = withGoalStages({
  ...createDefaultPet(now),
  hunger: 0,
  inventory: { golden_apple: 1 },
}, { cooking: 5 });
assert.equal(useInventoryItem(specialApplePet, 'golden_apple', now).hunger, 30, 'golden apples must ignore food trophy multipliers');

const readyGardenSlot: GardenSlot = {
  ...defaultGardenState(now).slots[0],
  unlocked: true,
  treeId: 'fruit_tree',
  state: 'growing',
  plantedAt: now - dayMs,
  nextReadyAt: now - 1,
  maxHarvests: gardenTreeDefinitions.fruit_tree.maxHarvests,
};
const gardenDropPet: PetState = {
  ...createDefaultPet(now),
  garden: { ...defaultGardenState(now), slots: [readyGardenSlot, ...defaultGardenState(now).slots.slice(1)] },
};
const countPendingGardenItems = (pet: PetState) => pet.garden.slots[0].pendingDrops.reduce(
  (sum, drop) => sum + (drop.itemId ? drop.amount : 0),
  0,
);
const plainGardenDrops = countPendingGardenItems(advanceGarden(gardenDropPet, now));
const goldGardenDrops = countPendingGardenItems(advanceGarden(withGoalStages(gardenDropPet, { garden: 5 }), now));
const diamondGardenDrops = countPendingGardenItems(advanceGarden(withGoalStages(gardenDropPet, { study: 5, cooking: 5, garden: 5, exercise: 5 }), now));
assert.equal(goldGardenDrops, plainGardenDrops + 1, '+100 points must guarantee exactly one additional product over the same seed');
assert(diamondGardenDrops >= plainGardenDrops + 1, '+150 points must guarantee at least one additional product');

assert.equal(getPetEnergyCap({ ...createDefaultPet(now), level: 20 }), 195);
assert.equal(getPetEnergyCap(withGoalStages({ ...createDefaultPet(now), level: 20 }, { exercise: 1 })), 220);
assert.equal(getPetEnergyCap(withGoalStages({ ...createDefaultPet(now), level: 20 }, { exercise: 3 })), 245);
assert.equal(getPetEnergyCap(withGoalStages({ ...createDefaultPet(now), level: 20 }, { exercise: 5 })), 295);
assert.equal(getPetEnergyCap(withGoalStages({ ...createDefaultPet(now), level: 20 }, { study: 5, cooking: 5, garden: 5, exercise: 5 })), 345);
const normalizedHighEnergy = normalizePet({
  ...withGoalStages({ ...createDefaultPet(now), level: 20 }, { exercise: 5 }),
  energy: 280,
}, now);
assert.equal(normalizedHighEnergy.energy, 280, 'normalize must preserve energy allowed by a derived trophy cap');
assert.equal(normalizePet({ ...normalizedHighEnergy, energy: 400 }, now).energy, 295, 'normalize must clamp energy to the derived trophy cap');

const exerciseUnlockPet: PetState = {
  ...unlockReadyPet,
  energy: 80,
  achievements: {
    ...unlockReadyPet.achievements,
    counters: {
      ...unlockReadyPet.achievements.counters,
      partnerScheduleClaimCountsByCategory: { study: 0, cooking: 0, garden: 0, exercise: 10 },
    },
  },
  classicEndgame: {
    ...unlockReadyPet.classicEndgame,
    projects: {
      ...unlockReadyPet.classicEndgame.projects,
      exercise: { completedStages: 0, currentStageCoins: 2000 },
    },
  },
};
const exerciseBronzeUnlocked = completeDreamProjectStage(exerciseUnlockPet, 'exercise', now);
assert.equal(exerciseBronzeUnlocked.energy, 80, 'unlocking an energy-cap trophy must not refill energy');
assert.equal(getPetEnergyCap(exerciseBronzeUnlocked), 220);

const missingApples = completeDreamProjectStage(endgameBase, 'study', now);
assert.equal(missingApples.classicEndgame.projects.study.completedStages, 3);
assert.equal(missingApples.inventory.golden_apple, 4);
const stageFour = completeDreamProjectStage({ ...endgameBase, inventory: { golden_apple: 5 } }, 'study', now);
assert.equal(stageFour.classicEndgame.projects.study.completedStages, 4);
assert.equal(stageFour.inventory.golden_apple ?? 0, 0);

const completeProjects = dreamProjectCategories.reduce<Record<PartnerScheduleCategory, { completedStages: number; currentStageCoins: number; completedAt: number }>>((projects, category) => ({
  ...projects,
  [category]: { completedStages: 5, currentStageCoins: 0, completedAt: now },
}), {} as Record<PartnerScheduleCategory, { completedStages: number; currentStageCoins: number; completedAt: number }>);
const fundedLegacy: PetState = {
  ...endgameBase,
  inventory: {},
  classicEndgame: {
    ...endgameBase.classicEndgame,
    projects: completeProjects,
    completedAt: now,
    legacyLevel: 0,
    legacyCoinsInvested: 20000,
    lifetimeCoinsInvested: 260000,
  },
};
assert.deepEqual(getClassicGoalProgress(fundedLegacy), {
  completedStages: 20,
  totalStages: 20,
  investedCoins: 240000,
  totalCoins: 240000,
  unlockedTrophies: 12,
  totalTrophies: 12,
  diamondUnlocked: true,
}, 'goal funding progress must exclude infinite legacy investment');
const legacyWithoutApple = completeClassicLegacyLevel(fundedLegacy, now);
assert.equal(legacyWithoutApple.classicEndgame.legacyLevel, 0);
assert.equal(legacyWithoutApple.classicEndgame.legacyCoinsInvested, 20000);
const legacyComplete = completeClassicLegacyLevel({ ...fundedLegacy, inventory: { golden_apple: 1 } }, now);
assert.equal(legacyComplete.classicEndgame.legacyLevel, 1);
assert.equal(legacyComplete.classicEndgame.legacyCoinsInvested, 0);
assert.equal(legacyComplete.inventory.golden_apple ?? 0, 0);

const migratedSave = normalizePet({ ...createDefaultPet(now), goldenAppleGacha: undefined, classicEndgame: undefined }, now);
assert.equal(migratedSave.goldenAppleGacha.tickets, 0);
assert.equal(migratedSave.goldenAppleGacha.totalDraws, 0);
assert.equal(migratedSave.classicEndgame.legacyLevel, 0);

console.log('Golden Apple Gacha and Classic endgame checks passed.');
