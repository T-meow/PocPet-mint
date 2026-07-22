import assert from 'node:assert/strict';
import {
  claimAvailableDateRewards,
  dateRewardCatchUpDays,
  withPetIdentityBirthday,
} from '../src/core/dateRewards';
import { getDailyResetDateKey } from '../src/core/dailyReset';
import { updatePetProfile } from '../src/core/petActions';
import { createDefaultPet, normalizePet } from '../src/core/petState';
import type { PetState } from '../src/core/petTypes';

const atNoon = (year: number, month: number, day: number) => new Date(year, month - 1, day, 12, 0, 0, 0).getTime();
const itemCount = (pet: PetState, itemId: string) => pet.inventory[itemId] ?? 0;

const createDateRewardPet = (now: number, overrides: Partial<PetState> = {}): PetState => ({
  ...createDefaultPet(now),
  name: 'Pocky',
  birthday: undefined,
  metDate: { year: 2020, month: 3, day: 10 },
  claimedDateRewardKeys: [],
  dailyLoginRewardDateKey: getDailyResetDateKey(now),
  ...overrides,
});

assert.equal(dateRewardCatchUpDays, 3);

const birthdayNow = atNoon(2027, 7, 16);
const birthdayPet = createDateRewardPet(birthdayNow, { birthday: { month: 7, day: 16 } });
const birthdayResult = claimAvailableDateRewards(birthdayPet, birthdayNow);
const birthdayReward = birthdayResult.rewards.find((reward) => reward.kind === 'birthday');
assert(birthdayReward, 'birthday reward should be available on the birthday');
assert.equal(birthdayReward.coins, undefined);
assert.equal(birthdayReward.hearts, undefined);
assert.equal(birthdayReward.gachaTickets, 10);
assert.deepEqual(birthdayReward.items, [
  { itemId: 'golden_apple', amount: 1 },
  { itemId: 'birthday_cake', amount: 1 },
]);
assert.equal(birthdayResult.pet.coins, birthdayPet.coins);
assert.equal(birthdayResult.pet.hearts, birthdayPet.hearts);
assert.equal(birthdayResult.pet.goldenAppleGacha.tickets, birthdayPet.goldenAppleGacha.tickets + 10);
assert.equal(itemCount(birthdayResult.pet, 'golden_apple'), itemCount(birthdayPet, 'golden_apple') + 1);
assert.equal(itemCount(birthdayResult.pet, 'birthday_cake'), 1);
assert.equal(birthdayResult.pet.achievements.counters.dateRewardClaimCountsByKind.birthday, 1);

const renamedBirthday = updatePetProfile(birthdayResult.pet, birthdayResult.pet.name, { month: 7, day: 15 });
const restoredBirthday = updatePetProfile(renamedBirthday, renamedBirthday.name, { month: 7, day: 16 });
assert.equal(claimAvailableDateRewards(restoredBirthday, birthdayNow).rewards.some((reward) => reward.kind === 'birthday'), false);
const modBirthdayChanged = withPetIdentityBirthday(birthdayResult.pet, { month: 7, day: 15 });
const modBirthdayRestored = withPetIdentityBirthday(modBirthdayChanged, { month: 7, day: 16 });
assert.equal(claimAvailableDateRewards(modBirthdayRestored, birthdayNow).rewards.some((reward) => reward.kind === 'birthday'), false);
assert(claimAvailableDateRewards(birthdayResult.pet, atNoon(2028, 7, 16)).rewards.some((reward) => reward.kind === 'birthday'));

const anniversaryNow = atNoon(2026, 8, 8);
const anniversaryPet = createDateRewardPet(anniversaryNow, { metDate: { year: 2025, month: 8, day: 8 } });
const anniversaryResult = claimAvailableDateRewards(anniversaryPet, anniversaryNow);
const anniversaryReward = anniversaryResult.rewards.find((reward) => reward.kind === 'anniversary');
assert(anniversaryReward, 'anniversary reward should start in the year after meeting');
assert.equal(anniversaryReward.coins, undefined);
assert.equal(anniversaryReward.hearts, undefined);
assert.equal(anniversaryReward.gachaTickets, 10);
assert.deepEqual(anniversaryReward.items, [
  { itemId: 'golden_apple', amount: 1 },
  { itemId: 'shiny_sticker', amount: 1 },
]);

const januaryFourth = atNoon(2027, 1, 4);
const catchUpPet = createDateRewardPet(januaryFourth);
const catchUpResult = claimAvailableDateRewards(catchUpPet, januaryFourth);
const catchUpCalendarRewards = catchUpResult.rewards.filter((reward) => reward.kind !== 'daily_login');
assert.deepEqual(catchUpCalendarRewards.map((reward) => reward.kind), ['festival', 'monthly_gift']);
catchUpCalendarRewards.forEach((reward) => assert.equal(reward.message, '「Pocky」带着礼物等你回来。'));
const monthlyReward = catchUpCalendarRewards.find((reward) => reward.kind === 'monthly_gift');
assert(monthlyReward);
assert.equal(monthlyReward.coins, undefined);
assert.equal(monthlyReward.gachaTickets, 3);
assert.deepEqual(monthlyReward.items, [{ itemId: 'golden_apple', amount: 1 }]);
assert.equal(itemCount(catchUpResult.pet, 'orange'), itemCount(catchUpPet, 'orange'));
assert.equal(itemCount(catchUpResult.pet, 'apple'), itemCount(catchUpPet, 'apple'));
assert.equal(itemCount(catchUpResult.pet, 'banana'), itemCount(catchUpPet, 'banana'));
assert.equal(itemCount(catchUpResult.pet, 'watermelon'), itemCount(catchUpPet, 'watermelon'));

const januaryFifth = atNoon(2027, 1, 5);
const expiredPet = createDateRewardPet(januaryFifth);
assert.deepEqual(
  claimAvailableDateRewards(expiredPet, januaryFifth).rewards.filter((reward) => reward.kind !== 'daily_login'),
  [],
  'calendar rewards should expire on the fourth day after the event',
);

const createdAfterEvent = createDateRewardPet(januaryFourth, { metDate: { year: 2027, month: 1, day: 4 } });
assert.deepEqual(
  claimAvailableDateRewards(createdAfterEvent, januaryFourth).rewards.filter((reward) => reward.kind !== 'daily_login'),
  [],
  'a new pet must not receive calendar rewards from before its meeting date',
);

const birthdayCatchUp = claimAvailableDateRewards(
  createDateRewardPet(atNoon(2027, 7, 19), { birthday: { month: 7, day: 16 } }),
  atNoon(2027, 7, 19),
).rewards.find((reward) => reward.kind === 'birthday');
assert.equal(birthdayCatchUp?.message, '「Pocky」带着礼物等你回来。');
assert.equal(
  claimAvailableDateRewards(
    createDateRewardPet(atNoon(2027, 7, 20), { birthday: { month: 7, day: 16 } }),
    atNoon(2027, 7, 20),
  ).rewards.some((reward) => reward.kind === 'birthday'),
  false,
);

const anniversaryCatchUpNow = atNoon(2027, 12, 3);
const anniversaryCatchUpPet = createDateRewardPet(anniversaryCatchUpNow, {
  metDate: { year: 2025, month: 11, day: 30 },
});
assert.equal(
  claimAvailableDateRewards(anniversaryCatchUpPet, anniversaryCatchUpNow)
    .rewards.find((reward) => reward.kind === 'anniversary')?.message,
  '「Pocky」带着礼物等你回来。',
);

const sameDayNow = atNoon(2026, 6, 1);
const sameDayPet = createDateRewardPet(sameDayNow, {
  birthday: { month: 6, day: 1 },
  metDate: { year: 2025, month: 6, day: 1 },
});
assert.deepEqual(
  claimAvailableDateRewards(sameDayPet, sameDayNow).rewards.map((reward) => reward.kind),
  ['birthday', 'anniversary', 'festival', 'monthly_gift'],
);

const nonLeapDay = atNoon(2027, 2, 28);
const leapPet = createDateRewardPet(nonLeapDay, {
  birthday: { month: 2, day: 29 },
  metDate: { year: 2024, month: 2, day: 29 },
});
assert.deepEqual(
  claimAvailableDateRewards(leapPet, nonLeapDay).rewards.map((reward) => reward.kind),
  ['birthday', 'anniversary'],
);

const migrationNow = atNoon(2027, 9, 10);
const migrationCreatedAt = atNoon(2024, 2, 29);
const legacyRaw: Record<string, unknown> = {
  ...createDefaultPet(migrationNow),
  createdAt: migrationCreatedAt,
  lastBirthdayRewardYear: 2026,
  lastAnniversaryRewardYear: 2025,
  monthlyGiftDateKey: '2027-08',
  claimedFestivalRewardKeys: ['new_year:2027'],
};
delete legacyRaw.metDate;
delete legacyRaw.claimedDateRewardKeys;
const migrated = normalizePet(legacyRaw, migrationNow);
assert.deepEqual(migrated.metDate, { year: 2024, month: 2, day: 29 });
assert(migrated.claimedDateRewardKeys.includes('birthday:2026'));
assert(migrated.claimedDateRewardKeys.includes('anniversary:2025'));
assert(migrated.claimedDateRewardKeys.includes('monthly_gift:2027-08'));
assert(migrated.claimedDateRewardKeys.includes('festival:new_year:2027'));

const clockRollbackNow = atNoon(2023, 1, 1);
const normalizedAfterClockRollback = normalizePet(migrated, clockRollbackNow);
assert.equal(normalizedAfterClockRollback.createdAt, migrationCreatedAt, 'clock rollback must not rewrite createdAt');
assert.deepEqual(normalizedAfterClockRollback.metDate, migrated.metDate, 'meeting date must remain stable');

const dailyNow = atNoon(2027, 7, 21);
const dailyResult = claimAvailableDateRewards(createDateRewardPet(dailyNow, { dailyLoginRewardDateKey: undefined }), dailyNow);
assert(dailyResult.rewards.some((reward) => reward.kind === 'daily_login'), 'daily login reward should remain available');

console.log('date reward checks passed');
