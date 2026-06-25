# PocPet Mod 制作指南

PocPet v1 mod 通过 zip 导入。第一版只替换宠物图片、道具图片、显示文本、默认姓名和喜欢食物；不修改道具 ID、价格、效果、商店分类、存档规则或核心玩法。

## Zip 结构

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

`items` 目录支持这些固定文件名：`emergency_biscuit.png`、`bento.png`、`nutri_meal.png`、`pig_trotter.png`、`strawberry_cake.png`、`ad_milk.png`、`small_bouquet.png`、`shiny_sticker.png`、`soft_cloud_doll.png`、`ribbon_bell.png`、`toy_ball.png`、`shampoo.png`、`medicine.png`、`blanket.png`。

缺少图片不会导入失败，会回退到内置资源；zip 里出现未知文件会被拒绝。

## manifest.json 示例

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

## 图片建议

- 使用透明 PNG。
- 宠物图片建议使用正方形画布，512x512 或更高，主体居中。
- 道具图标建议 256x256 或 128x128。
- 单张图片必须小于等于 3MB，整个 zip 必须小于等于 25MB。

## 打包步骤

1. 在 zip 根目录准备 `manifest.json`、`pet/` 和 `items/`。
2. 直接压缩这些文件，不要在 zip 里多包一层外部文件夹。
3. 在 PocPet 设置中选择 `Import Pet Mod` 导入 zip。
4. 如果提示缺少图片，对应槽位会使用内置资源。

## 兼容说明

- v1 mod 不能新增或删除道具 ID。
- v1 mod 不能修改价格、效果、金币、小心心、等级、番茄钟或离线规则。
- 存档导出只包含当前数据和 mod 摘要，不包含 mod 图片；换设备恢复时需要重新导入 mod zip。
