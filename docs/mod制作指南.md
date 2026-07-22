# PocPet Mod 制作指南

PocPet Mod 是一个 zip 包，根目录必须直接包含 `manifest.json`，可选包含 `pet/`、`items/` 和 `cg/`。不要在 zip 里再套一层外部文件夹。

## 开源与素材授权

PocPet 内置图片素材由 AI 生成或 AI 辅助生成，并随主项目按 GPL-3.0-or-later 发布。你可以 fork 项目制作自己的版本，也可以制作独立 Mod zip 分发。

制作和发布 Mod 时，请只使用你拥有充分授权的图片、文本、音频或其他素材。不要直接使用未经授权的第三方角色、商标、游戏截图、影视截图、音乐、字体或音效。推荐在 Mod 包或发布页中附上素材来源、生成方式和许可证说明。

如果 Mod 使用 AI 生成图片，建议在说明中写明图片由 AI 生成或 AI 辅助生成，并确认所用模型、平台或素材来源允许公开分发。

当前支持两种 manifest：

- `schemaVersion: 1`：替换宠物图片、内置道具图片、好结局 CG、文本、默认宠物名、喜欢食物和默认生日。
- `schemaVersion: 2`：兼容 v1，并支持覆盖内置道具显示，以及新增可购买、可使用的自定义道具。

## Mod 库与邻居

- PocPet 最多同时保存 12 个完整 Mod。导入只负责安装或更新，不会自动切换当前宠物；可在设置的 Mod 库中明确选择或删除。
- 当前启用 Mod 负责宠物外观、文本和可用自定义道具；其他已安装 Mod 的 `defaultPetName` 会作为本地“邻居”名字出现在部分伙伴日程、每日遭遇和离线事件中。
- 邻居只引用 Mod ID，Mod 更新后会显示新的默认宠物名；Mod 被删除或缺失时使用“邻居”泛称。
- 邻居送礼只从当前启用 Mod 的可购买道具和内置道具中选择，不会直接发放未启用 Mod 的自定义道具。每个 5:00 开始的游戏日最多结算 3 件邻居礼物；增益卡每日奖励未领取时，会为卡牌保留其中 1 件。
- 存档导出不包含 Mod 库或图片；迁移到其他设备时仍需分别导入所需 Mod zip。

## 目录结构

```text
my-mod.zip
|- manifest.json
|- pet/content.png
|- pet/hungry.png
|- items/*.png
`- cg/good_ending_year_1.png
```

支持的宠物图片完整路径：

`pet/content.png`、`pet/hungry.png`、`pet/sad.png`、`pet/dirty.png`、`pet/tired.png`、`pet/sick.png`、`pet/sleeping.png`、`pet/happy.png`、`pet/bath.png`、`pet/eat_cookie.png`、`pet/eat_noodles.png`、`pet/eat_meat.png`、`pet/give_heart.png`、`pet/level_up.png`、`pet/reading_books.png`、`pet/workout.png`、`pet/work_food.png`、`pet/work_plants.png`。

支持覆盖的内置道具图片完整路径：

`items/emergency_biscuit.png`、`items/bento.png`、`items/orange.png`、`items/apple.png`、`items/banana.png`、`items/watermelon.png`、`items/nutri_meal.png`、`items/pig_trotter.png`、`items/strawberry_cake.png`、`items/ad_milk.png`、`items/strawberry_milk.png`、`items/small_bouquet.png`、`items/shiny_sticker.png`、`items/soft_cloud_doll.png`、`items/ribbon_bell.png`、`items/toy_ball.png`、`items/picture_book.png`、`items/shampoo.png`、`items/wet_wipes.png`、`items/medicine.png`、`items/vitamin_tablet.png`、`items/blanket.png`、`items/energy_drink.png`、`items/golden_apple.png`、`items/fruit_tree_sapling.png`、`items/care_tree_sapling.png`、`items/gift_tree_sapling.png`、`items/money_tree_sapling.png`、`items/golden_apple_tree_sapling.png`、`items/normal_fertilizer.png`、`items/heart_fertilizer.png`、`items/harvest_nutrient.png`。

对应的内置道具 ID 就是文件名去掉 `items/` 和 `.png` 后的部分，例如 `items/watermelon.png` 对应 `watermelon`。

`birthday_cake` 是生日特殊道具，不能由 Mod 覆盖。

支持覆盖的 CG 图片完整路径：

`cg/good_ending_year_1.png`。这个文件会替换隐藏成就“好结局”弹窗里的纪念图；缺少时继续使用内置好结局 CG，不会导入失败。

## v2 示例

推荐新 Mod 使用 `schemaVersion: 2`。

```json
{
  "schemaVersion": 2,
  "id": "creator.farm",
  "name": "Farm Pack",
  "author": "Creator",
  "version": "1.0.0",
  "defaultPetName": "Momo",
  "description": "Farm themed items.",
  "favoriteFoodIds": ["strawberry_cake"],
  "birthday": { "month": 4, "day": 23 },
  "texts": {
    "recentEvent": "Momo brought a seed packet.",
    "favoriteFood": "Momo loves this flavor. Mood +{amount}.",
    "status": {
      "content": "状态不错"
    }
  },
  "items": {
    "overrides": {
      "watermelon": {
        "name": "像素西瓜",
        "summary": "清甜的夏日水果。",
        "image": "items/watermelon.png"
      }
    },
    "custom": [
      {
        "id": "creator.farm:melon_seed",
        "name": "瓜种",
        "summary": "可以留给后续种植系统使用。",
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

## 字段规则

- `id`：2-64 个字符，只能用小写字母、数字、点、短横线、下划线。
- `name`：最多 48 个字符。
- `author`：可选，最多 48 个字符。
- `version`：例如 `1.0.0`，最多 32 个字符。
- `defaultPetName`：最多 16 个字符。
- `description`：可选，最多 160 个字符。
- `favoriteFoodIds`：只能引用内置道具 ID。
- `birthday`：可选，格式为 `{ "month": 4, "day": 23 }`，必须是有效日期。
- `texts.status`：只能覆盖已有宠物状态文本，每项最多 24 个字符。
- `items.overrides`：只能覆盖内置道具的 `name`、`summary`、`image`。

## 自定义道具规则

`items.custom` 只在 v2 可用。

- `id` 必须以当前 Mod ID 开头，例如 `creator.farm:melon_seed`。
- 冒号后的本地 ID 只能使用小写字母、数字、短横线、下划线。
- `kind` 只能是 `food`、`item`、`care`、`garden`。
- `price` 必须是 `0..99999`。
- `effect` 只能包含 `hunger`、`mood`、`cleanliness`、`energy`、`health`，每个数值必须在 `-100..100`。
- `image` 必须是 `items/*.png`；缺图会用占位图，但 zip 中不能出现未被 manifest 引用的自定义图片。
- `shop: true` 表示进入商店；`false` 表示只在获得后出现在背包。
- `tags` 会被保留，供后续种植、奖励池等系统使用。

自定义道具不会参与“所有商店道具”“水果大师”等固定内置集合成就，但购买次数、使用次数这类总量统计可以累计。

## 图片与导入限制

- 图片必须是 PNG。
- 图片内容应避免侵犯第三方版权、商标权、肖像权或平台条款。
- AI 生成图片建议保留提示词、生成平台、后期编辑记录或其他可追溯说明，方便后续确认授权。
- 单张图片不超过 3MB。
- 好结局 CG 使用 `cg/good_ending_year_1.png`，推荐横向构图，接近 4:3 或 16:9，PNG 格式。
- 整个 zip 不超过 25MB。
- 缺少 manifest 引用的图片不会导入失败，会回退内置图或占位图。
- zip 中出现未知文件、未允许路径或路径套壳会导入失败。

## Fork 与兼容建议

如果你的改造需要新增玩法规则、修改存档结构、替换大量内置资源或改变道具经济，推荐 fork PocPet 源码独立维护，而不是把这些规则塞进 Mod。Mod 更适合做外观、文本、角色和安全范围内的道具扩展。

公开 fork 时，请同步更新项目名称、应用图标、包名、许可证说明和素材声明，避免用户误认为是官方 PocPet 版本。

## 存档兼容

存档只保存当前数据和 Mod 摘要，不包含 Mod 图片。换设备恢复时，需要重新导入 Mod zip。

如果背包里有当前未加载 Mod 的自定义道具，数量会保留，并显示为“未知 Mod 道具”；重新导入提供相同 ID 的 Mod 后会恢复显示和使用。
