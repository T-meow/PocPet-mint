import coin from './assets/icon/coin.png';
import iconAdMilk from './assets/icon/icon_ADmilk.png';
import iconBeltedBell from './assets/icon/icon_belted_bell.png';
import iconBerryCake from './assets/icon/icon_berry_cake.png';
import iconCloudPuff from './assets/icon/icon_cloud_puff.png';
import iconFlowers from './assets/icon/icon_flowers.png';
import iconPigTotters from './assets/icon/icon_pigtotters.png';
import iconShinyStickers from './assets/icon/icon_shiny_stickers.png';
import itemBento from './assets/icon/item_bento.png';
import itemBlanket from './assets/icon/item_blanket.png';
import itemEmergencyBiscuit from './assets/icon/item_emergency_biscuit.png';
import itemMedicine from './assets/icon/item_medicine.png';
import itemNutriMeal from './assets/icon/item_nutri_meal.png';
import itemShampoo from './assets/icon/item_shampoo.png';
import itemToyBall from './assets/icon/item_toy_ball.png';
import petBath from './assets/pet/pet_bath.png';
import petDirtySad from './assets/pet/pet_dirty_sad.png';
import petEatCookie from './assets/pet/pet_eat_cookie.png';
import petEatMeat from './assets/pet/pet_eat_meat.png';
import petEatNoodles from './assets/pet/pet_eat_noodles.png';
import petGiveHeart from './assets/pet/pet_give_heart.png';
import petHappy from './assets/pet/pet_happy.png';
import petHungry from './assets/pet/pet_hungry.png';
import petIdleSit from './assets/pet/pet_idle_sit.png';
import petLittleDirty from './assets/pet/pet_little_dirty.png';
import petLevelUp from './assets/pet/pet_levelUp.png';
import petReadingBooks from './assets/pet/pet_reading_books.png';
import petSick from './assets/pet/pet_sick1.png';
import petSleep from './assets/pet/pet_sleep.png';
import petWorkout from './assets/pet/pet_workout.png';
import petWorkMakingFood from './assets/pet/pet_work_making_food.png';
import petWorkWateringPlants from './assets/pet/pet_work_watering_plants.png';
import type { ActivePetMod } from './core/mod';
import type { ItemId, PetStatus, RecentActivity } from './core/pet';

export const currencyIcon = coin;

export const itemIcons: Record<ItemId, string> = {
  emergency_biscuit: itemEmergencyBiscuit,
  bento: itemBento,
  nutri_meal: itemNutriMeal,
  pig_trotter: iconPigTotters,
  strawberry_cake: iconBerryCake,
  ad_milk: iconAdMilk,
  small_bouquet: iconFlowers,
  shiny_sticker: iconShinyStickers,
  soft_cloud_doll: iconCloudPuff,
  ribbon_bell: iconBeltedBell,
  toy_ball: itemToyBall,
  shampoo: itemShampoo,
  medicine: itemMedicine,
  blanket: itemBlanket,
};

export const petStatusImages: Record<PetStatus, string> = {
  content: petIdleSit,
  hungry: petHungry,
  sad: petDirtySad,
  dirty: petLittleDirty,
  tired: petReadingBooks,
  sick: petSick,
  sleeping: petSleep,
};

export const petActivityImages: Partial<Record<RecentActivity, string>> = {
  happy: petHappy,
  bath: petBath,
  eat_cookie: petEatCookie,
  eat_noodles: petEatNoodles,
  eat_meat: petEatMeat,
  give_heart: petGiveHeart,
  level_up: petLevelUp,
  reading_books: petReadingBooks,
  workout: petWorkout,
  work_food: petWorkMakingFood,
  work_plants: petWorkWateringPlants,
};


export const resolveItemIcons = (mod?: ActivePetMod | null): Record<ItemId, string> => ({
  ...itemIcons,
  ...mod?.itemImageUrls,
});

export const resolvePetStatusImages = (mod?: ActivePetMod | null): Record<PetStatus, string> => ({
  ...petStatusImages,
  ...mod?.petImageUrls,
});

export const resolvePetActivityImages = (mod?: ActivePetMod | null): Partial<Record<RecentActivity, string>> => ({
  ...petActivityImages,
  ...mod?.petImageUrls,
});
