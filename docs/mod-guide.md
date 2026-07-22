# PocPet Mod Guide

PocPet mods are imported as zip files. `schemaVersion: 1` can replace pet images, built-in item images, display text, the default pet name, favorite foods, and the pet's default birthday. `schemaVersion: 2` keeps those capabilities and can also override built-in item names, summaries, and images, plus register safe custom items for the shop and inventory.

## Mod Library and Neighbors

- PocPet can keep up to 12 complete mods. Importing installs or updates a mod without switching the current pet; use the Mod Library in settings to activate or delete one explicitly.
- The active mod supplies the current appearance, text, and custom items. The `defaultPetName` values from other installed mods may appear as local neighbors in partner schedules, daily encounters, and offline events.
- Neighbor activities store only the mod ID. Updating a mod uses its new default pet name; deleting or missing mods fall back to a generic “neighbor” label.
- Neighbor gifts use only purchasable built-in items and purchasable items from the active mod. Custom items from inactive neighbor mods are never granted directly. At most three neighbor gift events can settle per local day.
- Save exports do not contain the mod library or image assets. Import the required mod zip files separately on another device.

## Open Source and Asset Licensing

PocPet built-in image assets are AI-generated or AI-assisted, then selected and integrated by FrostForge Studio. They are distributed with the main project under GPL-3.0-or-later unless a specific file or later notice says otherwise. You can fork the project for your own pet app, or distribute a standalone Mod zip.

When publishing a Mod, only include images, text, audio, fonts, or other assets that you are allowed to distribute under your chosen license. Do not include unauthorized third-party characters, trademarks, game screenshots, film screenshots, music, fonts, sound effects, or other restricted material.

If your Mod uses AI-generated images, say so in the Mod notes or release page, and keep enough information about the model, platform, prompts, edits, or source material to confirm that public distribution is allowed.

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
|- items/*.png
`- cg/good_ending_year_1.png
```

Put `manifest.json`, `pet/`, `items/`, and optional `cg/` directly at the zip root. Do not wrap them in an extra folder.

Supported pet image files are the status images `content.png`, `hungry.png`, `sad.png`, `dirty.png`, `tired.png`, `sick.png`, `sleeping.png`, plus activity images `happy.png`, `bath.png`, `eat_cookie.png`, `eat_noodles.png`, `eat_meat.png`, `give_heart.png`, `level_up.png`, `reading_books.png`, `workout.png`, `work_food.png`, and `work_plants.png`.

Supported item image files are `emergency_biscuit.png`, `bento.png`, `orange.png`, `apple.png`, `banana.png`, `watermelon.png`, `nutri_meal.png`, `pig_trotter.png`, `strawberry_cake.png`, `ad_milk.png`, `strawberry_milk.png`, `small_bouquet.png`, `shiny_sticker.png`, `soft_cloud_doll.png`, `ribbon_bell.png`, `toy_ball.png`, `picture_book.png`, `shampoo.png`, `wet_wipes.png`, `medicine.png`, `vitamin_tablet.png`, `blanket.png`, `energy_drink.png`, `golden_apple.png`, `fruit_tree_sapling.png`, `care_tree_sapling.png`, `gift_tree_sapling.png`, `money_tree_sapling.png`, `golden_apple_tree_sapling.png`, `normal_fertilizer.png`, `heart_fertilizer.png`, and `harvest_nutrient.png`. The built-in special item `birthday_cake` is birthday-only and is not mod-customizable in v1.

The optional CG replacement path is `cg/good_ending_year_1.png`. It replaces the memorial image shown for the hidden “Good Ending” achievement. If it is missing, PocPet uses the built-in good ending CG.

Missing images are allowed and fall back to built-in assets. Unknown files are rejected.

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
  "birthday": { "month": 4, "day": 23 },
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

## Manifest Fields

- `schemaVersion`: required, `1` or `2`. v1 uses `texts.items` and fixed `items/{itemId}.png`; v2 should use `items.overrides` and `items.custom`.
- `id`: required, 2-64 chars, lowercase letters, numbers, dots, dashes, or underscores.
- `name`: required display name, max 48 chars.
- `author`: optional author name, max 48 chars.
- `version`: required version like `1.0.0`, max 32 chars.
- `defaultPetName`: required pet name, max 16 chars.
- `description`: optional summary, max 160 chars.
- `favoriteFoodIds`: optional list of existing item IDs; duplicates are removed.
- `birthday`: optional `{ "month": number, "day": number }` using a valid calendar date.
- `texts.recentEvent`: optional import/switch message, max 240 chars.
- `texts.favoriteFood`: optional favorite food message. Use `{amount}` for the bonus mood amount.
- `texts.status`: optional labels for existing pet status IDs, max 24 chars each.
- `texts.items`: optional item names and summaries for existing item IDs. Names are max 28 chars; summaries are max 96 chars.

A Mod birthday is the pet's default birthday. Users can edit the current pet birthday in Settings, and that edit is kept until the next app startup with an active Mod, save import with a matching active Mod, restore, reset, or Mod switch reapplies the active Mod manifest birthday. If a Mod has no `birthday`, that Mod does not provide a birthday default.

## Manifest v2 Item Example

`schemaVersion: 2` supports built-in item display overrides through `items.overrides` and custom items through `items.custom`. Custom item IDs must use the current mod ID as their namespace, such as `creator.farm:melon_seed`.

```json
{
  "schemaVersion": 2,
  "id": "creator.farm",
  "name": "Farm Pack",
  "author": "Creator",
  "version": "1.0.0",
  "defaultPetName": "Momo",
  "items": {
    "overrides": {
      "watermelon": {
        "name": "Pixel Watermelon",
        "summary": "A crisp summer fruit.",
        "image": "items/watermelon.png"
      }
    },
    "custom": [
      {
        "id": "creator.farm:melon_seed",
        "name": "Melon Seed",
        "summary": "Reserved for the future garden system.",
        "kind": "item",
        "price": 30,
        "effect": { "mood": 2 },
        "image": "items/creator.farm_melon_seed.png",
        "shop": true,
        "tags": ["planting", "seed", "watermelon"]
      }
    ]
  }
}
```

Custom item limits:

- `kind` must be `food`, `item`, `care`, or `garden`.
- `effect` may only contain `hunger`, `mood`, `cleanliness`, `energy`, and `health`, each from `-100..100`.
- `price` must be an integer from `0..99999`.
- If `image` is set, it must point to `items/*.png` at the zip root. Missing referenced images import with a placeholder; unreferenced custom image files are rejected.
- Custom items do not count toward fixed built-in collection achievements, but total purchase/use counters can still increase.

## Image Guidelines

- Use PNG images; transparent backgrounds work best.
- Avoid content that infringes copyright, trademarks, personality rights, or platform terms.
- For AI-generated images, keep prompts, generation platform notes, edit history, or similar provenance records so later licensing questions can be resolved.
- Pet images should use a square canvas, ideally 512x512 or larger, with the subject centered.
- Item icons should be 256x256 or 128x128.
- Good ending CG uses `cg/good_ending_year_1.png`; a landscape PNG close to 4:3 or 16:9 is recommended.
- Each image must be 3MB or smaller; the full zip must be 25MB or smaller.

## Packaging Steps

1. Prepare `manifest.json`, `pet/`, `items/`, and optional `cg/` at the zip root.
2. Zip those files directly; do not wrap them in an extra folder.
3. Open PocPet settings and choose Import Pet Mod.
4. If the app reports missing images, those slots use built-in assets.

## Forking Guidance

If your changes need new gameplay rules, save schema changes, large built-in asset replacements, or a different item economy, fork PocPet and maintain your own source branch instead of forcing those rules into a Mod. Mods are best for appearance, text, character packs, and safe item extensions.

For public forks, update the project name, app icon, package identifier, license notes, and asset statement so users do not confuse your version with the upstream PocPet project.

## Compatibility

- v1 mods cannot add or remove item IDs; v2 mods can add namespaced custom items through `items.custom`.
- v1 mods cannot change item prices, item effects, shop categories, coins, hearts, levels, Pomodoro rules, daily wish rules, return welcome rules, save rules, or offline rules.
- v1 mods cannot add festival-exclusive items, customize the built-in `birthday_cake`, or define birthday, festival, daily login, daily wish, return welcome, anniversary, monthly gift, seasonal effect, or year review content yet. They can only replace the existing good ending CG image, not add new CG entries or change achievement rules.
- Save export includes current data and a Mod summary, but does not include Mod images. Re-import the zip on another device before or after importing the save.
- Inventory keeps custom item counts when their mod is not loaded. They appear as “Unknown mod item” and cannot be used or bought until the matching mod is re-imported.
