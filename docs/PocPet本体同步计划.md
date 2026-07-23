# Pocpet-Mint 与 PocPet 本体同步计划

## 目标

将本地 PocPet 本体 `D:\Projects\PocPet` 的已提交版本 `1d8e3cc`（应用版本 `1.4.7`）同步到 Pocpet-Mint，同时完整保留 Mint 的独立品牌、应用标识、存档空间、角色设定、素材、发布产物命名和部署配置。

## 当前基线

- Mint 仓库：`D:\Projects\PocPet-mint`
- Mint 分支：`update/sync-pocpet-1.4.7`
- Mint 基线：`origin/main`，`b4dec9d`，应用版本 `1.0.1`
- Mint 同步目标版本：`1.1.0`
- 本体远程：`upstream/main`，`0f7e512`，应用版本 `1.4.4`
- 本地本体：`local-pocpet/main`，`1d8e3cc`，应用版本 `1.4.7`
- 共同祖先：`67fdeae`（2026-07-06）
- 分叉情况：Mint 独有 5 个提交，本地本体独有 12 个提交
- 总体差异：197 个文件，约 16578 行新增、1790 行删除

`local-pocpet/main` 是从本地仓库抓取的比较引用，可用下列命令刷新：

```powershell
git fetch 'D:\Projects\PocPet' 'main:refs/remotes/local-pocpet/main'
```

## 范围

本次同步纳入本体 `1.4.7` 的功能、修复、测试脚本、依赖、Tauri 插件和样式拆分，包括伙伴日程、成就扩展、邻居与每日进度、金苹果抽卡、Classic 终局、属性缩放和批量道具操作。

本次同步不包含：

- 本体工作区尚未提交的 `src/styles/dialogs.css` 修改（10 行新增、9 行删除）。该修改需先在本体中确认并提交，再决定是否补入 Mint。
- 发布、推送、创建 GitHub Release 或生成安装包。
- 将 Mint 的存档键、应用 identifier 或包名改回本体值。

## 必须保留的 Mint 定制

| 类别 | Mint 值或行为 |
| --- | --- |
| 产品与包名 | `Pocpet-Mint`、`pocpet-mint`、`com.frostforge.pocpet.mint` |
| 应用数据隔离 | `pocpet-mint.*` localStorage / IndexedDB 键，Mint 独立存档标识与文件名 |
| 默认角色 | 名称 `mint`，生日 6 月 1 日，Mint 喜爱食物配置 |
| 文案与素材 | 咕比脆文案和图片、Mint 宠物素材、Mint 图标与 favicon |
| Android | Mint applicationId、包路径、应用名、自适应图标配置 |
| 发布系统 | `pp-Mint<version>` 产物名，Mint GitHub/Gitee workflow、Pages 触发规则 |
| 文档与许可 | Mint 项目名、仓库链接及 Mint 的署名/许可说明 |

## 已识别冲突

只读 `merge-tree` 试合并识别出 19 个冲突文件：

- 品牌与版本：`README.md`、`README.en.md`、`package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/Cargo.lock`、`src-tauri/tauri.conf.json`
- Mint 角色二进制素材：7 个 `src/assets/pet/*.png`
- 业务与存储：`src/core/dateRewards.ts`、`src/core/modStorage.ts`、`src/ui/App.tsx`
- 文案：`src/i18n/zh-CN.json`、`src/i18n/en-US.json`

合并时应以本体 `1.4.7` 的结构和功能为主体，再逐项重新应用 Mint 定制。锁文件不手工拼接：先解决 manifest，再由包管理器和 Cargo 重建并核对。

## 实施阶段

### 第一阶段：建立可审查的合并结果

1. 再次确认两个仓库工作区状态，并刷新 `upstream/main` 与 `local-pocpet/main`。
2. 将 `local-pocpet/main` 合并到当前更新分支，不推送、不发布。
3. 按“本体功能优先、Mint 身份隔离必须保留”的规则解决 19 个冲突。
4. 对 Mint 独有 5 个提交涉及的非冲突文件做回归检查，避免自动合并静默覆盖品牌值。

### 第二阶段：版本与生成文件

1. Mint 版本提升到 `1.1.0`，因为本次是大规模功能同步。
2. 同步 `package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json` 三处版本。
3. 安装/更新依赖后重建 `package-lock.json` 和 `src-tauri/Cargo.lock`。
4. 检查 Android applicationId、Kotlin 包路径和 Tauri 插件注册是否一致。

### 第三阶段：验证

1. 运行 `npm run build`。
2. 运行本体新增检查：`check:date-rewards`、`check:garden-care`、`check:stat-scaling-batch`、`check:gacha`，并直接运行伙伴日程检查脚本（如未暴露 npm script）。
3. 运行 `cargo check --manifest-path src-tauri/Cargo.toml`。
4. 核对新旧 Mint 存档键、导入导出 app id、默认角色和 Mod 数据库隔离。
5. 搜索残留的本体品牌、包名、产物名和 `com.frostforge.pocpet`，逐项确认是代码兼容需要还是遗漏。
6. 只在代码验证通过后按用户要求生成对应平台产物；本阶段不默认打包。

## 兼容性与风险

- 存档风险最高：本体新增字段必须通过现有 normalize/migration 路径兼容 Mint `1.0.1` 存档，不能只验证新存档。
- `saveCodec` 的 app id 目前区分 PocPet 与 Pocpet-Mint；同步时必须保持 Mint id，否则可能导入错误产品的存档或拒绝旧 Mint 存档。
- 本体已加入 `dialog` 与 `fs` Tauri 插件，前端依赖、Rust 依赖、capabilities 和 `lib.rs` 注册必须成组同步。
- 二进制宠物素材无法自动合并。默认保留 Mint 定制图，同时评估是否补充本体新增的压缩资源目录。
- 本体本地 `main` 比 GitHub `upstream/main` 多 2 个提交；若先推送本体，后续可改为只从 `upstream/main` 同步，减少本地引用依赖。
- Mint 版本若定为 `1.1.0`，按仓库规则会触发全量打包条件；实际打包仍需明确执行。

## 执行结果

- 已以 `--no-commit --no-ff` 合并本地本体 `1d8e3cc`，19 个冲突均已解决，未创建提交。
- 七个二进制宠物素材冲突全部保留 Mint 版本；本体未提交的 `src/styles/dialogs.css` 未纳入。
- `package.json`、Tauri 配置、Cargo manifest 及两个锁文件已统一为 `1.1.0`。
- 已保留 Mint 的产品名、Android identifier、存储键、Mod 数据库、存档 app id、角色生日、角色素材和发包命名。
- 已用 Mint `1.0.1` 代码生成本地存档、受保护导出和旧 Mod 数据库夹具，并新增自动迁移检查。
- `npm run build`、日期奖励、花园护理、属性缩放/批量操作、金苹果抽卡、伙伴日程、存档/Mod 迁移检查均通过。
- `cargo check --manifest-path src-tauri/Cargo.toml` 与对应的 `--locked` 检查均通过。
- 本轮未打包、未发布、未推送。
