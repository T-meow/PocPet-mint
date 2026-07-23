# PocPet 1.5.0 增量同步计划

## 目标

将本体 `upstream/main@2dead89` 相对上一同步点 `1d8e3cc` 的更新合入 Pocpet-Mint，并将 Mint 版本提升为 `1.2.0`。同步后继续兼容 Mint `1.0.1`、`1.1.0` 存档及 Mod 数据。

## 范围与非目标

- 纳入时间防回拨、离线生命周期、睡眠结算、交互冷却、损坏存档检测与备份恢复，以及对应检查脚本、界面调整和 Android CI 稳定性设置。
- 保留 `Pocpet-Mint` 品牌、Mint 角色素材、`com.frostforge.pocpet.mint`、`pocpet-mint.*` 存储键、存档加密标识和 `pp-Mint<version>` 产物名。
- 将主 README 精简为玩法、原项目地址和 Mint 改动三部分。
- 不打包、不发布、不推送，不改动本体仓库。

## 实施阶段

1. 以 `--no-commit --no-ff` 合并 `local-pocpet/main`，按本体功能优先、Mint 身份隔离优先的规则解决冲突。
2. 将前端、Tauri 与 Rust crate 版本统一为 `1.2.0`，由 npm 与 Cargo 更新锁文件。
3. 适配 Mint 旧存档迁移夹具和恢复流程，确保新增备份键也使用 Mint 命名空间。
4. 精简 `README.md`，检查品牌、存储键、包名和产物名。

## 兼容与数据风险

- 新版 `loadStoredPetJson` 返回带状态的结果，Mint 的迁移检查和调用方必须同步更新。
- 主存档、普通备份、导入备份和损坏原文必须全部使用 `pocpet-mint.pet.v1*`，避免与同域 PocPet Pages 数据冲突。
- 导入旧受保护存档时继续使用 `Pocpet-Mint` app id、`POCPET-SAVE-v2:` 前缀及原密钥。
- 恢复逻辑不得把损坏主存档静默覆盖；Mod 的 localStorage 与 IndexedDB 命名保持不变。

## 验证

- 运行 `npm run build`、全部 `check:*` 脚本及 `check:save-migration`。
- 运行 `cargo check --manifest-path src-tauri/Cargo.toml` 和 `--locked` 检查。
- 检查冲突标记、Mint 品牌与存储命名空间，并确认两个仓库工作区状态。

## 假设

- 本次 Mint 目标版本为 `1.2.0`。
- 当前本体 GitHub `main@2dead89` 是同步来源，其中应用版本提交为 `ddec505 / 1.5.0`，上一同步点为 `1d8e3cc`。
- 本轮只形成可审查的本地修改，不创建提交或部署。

## 执行结果

- 已以 `--no-commit --no-ff` 合并本体 `ddec505 / 1.5.0`，并补入远端 `2dead89` 的 Android CI 与 Pages 更新。
- 7 个冲突均已解决：版本与锁文件使用 Mint `1.2.0`，存档实现采用本体恢复逻辑并保留 Mint app id 和存储命名空间。
- 已适配旧 Mint 迁移检查及新增存档恢复检查；睡眠结算用例显式排除 Mint 喜爱食物加成，避免角色配置影响基础规则断言。
- `README.md` 已精简为玩法、原项目地址和 Mint 改动三部分。
- `npm run build` 与 11 个 `check:*` 检查全部通过；Cargo 普通检查和 `--locked` 检查均通过。
- 已核对 Mint Android identifier、存档/Mod 键、损坏存档文件名和发布命名；工作区无冲突标记。
- 本轮未创建提交、未推送、未部署；后续按用户要求生成了 Windows x64/x86、Android arm64/ARMv7 和 Web 共 5 个本地测试产物。
