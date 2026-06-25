# PocPet Mod Guide

PocPet v1 mods are imported as zip files. Version 1 only changes pet images, item images, display text, default pet name, and favorite food. It does not change item ids, prices, effects, shop categories, save rules, or core gameplay.

## Zip Layout

```text
my-pet-mod.zip
|- manifest.json
|- pet/content.png
|- pet/hungry.png
|- pet/sad.png
|- pet/dirty.png
|- pet/tired.png
|- pet/sick.png
|- pet/sleeping.png
|- pet/happy.png
|- pet/bath.png
|- pet/eat_cookie.png
|- pet/eat_noodles.png
|- pet/eat_meat.png
|- pet/give_heart.png
|- pet/level_up.png
|- pet/reading_books.png
|- pet/workout.png
|- pet/work_food.png
|- pet/work_plants.png
`- items/*.png
```

Supported item image names are: `emergency_biscuit.png`, `bento.png`, `nutri_meal.png`, `pig_trotter.png`, `strawberry_cake.png`, `ad_milk.png`, `small_bouquet.png`, `shiny_sticker.png`, `soft_cloud_doll.png`, `ribbon_bell.png`, `toy_ball.png`, `shampoo.png`, `medicine.png`, and `blanket.png`.

Missing images are allowed and will fall back to built-in assets. Unknown files are rejected.

## manifest.json Example

```json
{
  "schemaVersion": 1,
  "id": "creator.momo",
  "name": "Momo Pack",
  "author": "Creator",
  "version": "1.0.0",
  "defaultPetName": "Momo",
  "description": "A custom pet for PocPet.",
  "favoriteFoodIds": ["strawberry_cake", "ad_milk"],
  "texts": {
    "recentEvent": "Momo is here with a biscuit in the bag.",
    "favoriteFood": "Momo loves this flavor. Mood +{amount}.",
    "status": {
      "content": "Doing well",
      "hungry": "Hungry",
      "sad": "A little sad",
      "dirty": "Needs cleaning",
      "tired": "Tired",
      "sick": "Unwell",
      "sleeping": "Sleeping"
    },
    "items": {
      "strawberry_cake": {
        "name": "Berry Cake",
        "summary": "Momo's favorite sweet snack."
      }
    }
  }
}
```

## Image Guidelines

- Use transparent PNG images.
- Pet images should use a square canvas, ideally 512x512 or larger, with the subject centered.
- Item icons should be 256x256 or 128x128.
- Each image must be 3MB or smaller; the full zip must be 25MB or smaller.

## Packaging Steps

1. Prepare `manifest.json`, `pet/`, and `items/` at the zip root.
2. Zip those files directly; do not wrap them in an extra folder.
3. Open PocPet settings and choose Import Pet Mod.
4. If the app reports missing images, those slots use built-in assets.

## Compatibility

- v1 mods cannot add or remove item ids.
- v1 mods cannot change prices, effects, coins, hearts, levels, Pomodoro rules, or offline rules.
- Save export includes current data and a mod summary, but does not include mod images. Re-import the zip on another device before or after importing the save.
