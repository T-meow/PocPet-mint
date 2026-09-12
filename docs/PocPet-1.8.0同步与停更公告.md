# PocPet 1.8.0 同步与 Mint 停更公告

## 目标与授权

- 将原版已提交的 1.8.0 更新同步到 `D:\Projects\pocpet-mint`，每天弹出 Mint 合并与停更公告，链接原版 GitHub Pages。
- 原版来源：`T-meow/PocPet main@25913ecf83ed638d7335490dd2698de9fb38733f`；已核对 GitHub 与本地提交一致，1.8.0 Release 尚为草稿。
- Mint 基线：`9adc863`，工作区干净。首阶段仅完成本地同步和检查。
- 后续用户已明确授权「提交远端构建，并发布pages」：提交并推送 Mint `main`，触发 GitHub Actions 全量构建，并发布 Mint GitHub Pages。
- 原版 `D:\Projects\PocPet` 的未提交文件及未跟踪文件不纳入、不修改。

## 决定

- Mint 最终版本定为 `1.3.0`，同步前端、Tauri、Cargo 版本。
- 保留 Mint 包名、应用标识、素材、默认角色及存档/Mod 隔离，验证旧 Mint 存档与原版互通。
- 复用原版公告 UI；按本地自然日每天显示一次，覆盖重新启动、常驻跨日与回到前台，不提供永久关闭选项。
- 公告明确 Mint 已和原版合并、独立 Mint 此后不再更新；入口为 `https://t-meow.github.io/PocPet/`。
- 原版更新检测需适配停更版本，避免向 Mint 用户提示安装原版包覆盖更新。
- 保留 Mint 既有 GitHub/Gitee 工作流、Android 签名脚本和历史任务记录，不引入原版专用证书基线。默认角色仍为 Mint，新增 Doro 入口，避免重复显示内置 Mint。

## 进度与验证

- 已核对 Git 状态、来源提交、Pages API；已抓取原版已提交对象到 Mint 的 `upstream/main`。
- 试合并显示 16 个冲突文件，集中在版本、存档命名空间、翻译与发布配置。
- 已合并厨房、三种小游戏、陪伴回忆、主页改版、自动备份与恢复、Mod 和存档兼容等已提交变更。
- 已实现独立于版本/启动次数的每日公告；角色选择页与游戏页均可显示，常驻每 30 秒及回到前台时检查；等待已有弹窗结束再显示。
- 已隔离新增主存档身份、升级备份、自动备份数据库、网页锁、云存档和提醒键；保留 Mint 导出 app id，支持原版/Mint 两类导入。
- 修复旧版 active Mod manifest 指向内置 Mint 时角色选择丢失的问题，并加入旧 Mint 与自定义 Mod 数据库迁移检查。
- 首轮回归发现测试仍断言旧 schema 和原版喜爱食物行为；已适配 1.8 的日程 schema 6、扭蛋 schema 4 与 Mint 加成。
- 已统一默认 Mint 的小游戏/料理回忆 actor id 与邻居身份，防止迁移到原版后把回忆归入 Furo，或让 Mint 将自己视作邻居。
- 最终 `npm run build -- --logLevel warn`、16 个 TypeScript 回归检查及 `cargo check --offline --manifest-path src-tauri/Cargo.toml` 均通过；`check:release -- --dist dist` 通过（包含锁定的 Cargo 元数据核对）。
- 检查覆盖：每日公告同日重启、跨日、连续多日、存储满/禁用/损坏、中英文渲染及链接；Mint 1.0.1 存档、保护格式、Mod 数据库、导入备份、升级备份、时间与日程；厨房、三种小游戏、扭蛋及奖励。
- Vite 仅保留上游现有的大 chunk 和静态/动态混用导入提示，无构建错误。未进行真实浏览器/客户端点击验证，未打包或部署。

## 依赖与产物校验

- npm 安装目录：`D:\Projects\pocpet-mint\node_modules`，173,228,138 bytes（165.20 MiB，含项目内 npm 缓存）；97 个已安装包版本均匹配锁文件。
- 安装指定镜像 `https://registry.npmmirror.com/`；`npm cache verify --cache=node_modules/.npm-cache` 校验通过：98 个内容条目、32,676,683 bytes。
- `package-lock.json` SHA-256：`cfaf1fd5f5a194e3afcfd69f47dff2389f3026ae3ae6f3cf46d1b48539346096`。
- `src-tauri/Cargo.lock` SHA-256：`96ee1f994c8f74f2debf2493fbe7ade305e3034ea566d8e187d0a72ac08790f5`；沿用原版依赖锁定，仅调整本包版本为 1.3.0，Rust 检查使用已有离线依赖。
- 前端构建：`D:\Projects\pocpet-mint\dist`，13,761,459 bytes（13.12 MiB）；Rust 检查缓存：`D:\Projects\pocpet-mint\src-tauri\target`，1,065,455,793 bytes（1016.10 MiB）。均由 Git 忽略。

## 交付状态

- 代码、公告和检查已完成；合并冲突按上述 Mint 定制解决。
- 远端构建使用 `release.yml` 的 `workflow_dispatch`（`full_build=true`），按 1.3.0 规则构建全套产物；本次不创建 Release tag。
- Pages 使用 `pages.yml` 的 `main` 推送触发部署；目标为 `https://t-meow.github.io/PocPet-mint/`。公告链接仍指向原版 `https://t-meow.github.io/PocPet/`。
- 已提交并推送合并提交 `f284fa12dfca58712edebeda21c875ca552cb38c`；Git HTTPS 连接重置后使用同仓库 SSH URL 正常推送，未改动 origin 配置、未强推。
- [Pages 部署 34679033029](https://github.com/T-meow/PocPet-mint/actions/runs/34679033029) 成功；HTTP 验证 `build-info.json` 为 `1.3.0 / standard / f284fa1`，入口脚本 `assets/index-CRCA1nH_.js` 含独立每日公告键、停更文案和原版页面链接。
- [推送 CI 34679033032](https://github.com/T-meow/PocPet-mint/actions/runs/34679033032) 成功；[全量构建 34679074271](https://github.com/T-meow/PocPet-mint/actions/runs/34679074271) 已通过 `workflow_dispatch` 启动。
- 待完成：跟进全平台构建结果、核对远端产物、提交交付记录。
- 全量构建中 Windows x64/x86、macOS、Linux、Web 已成功；Android arm64 在原生库复制步骤失败。日志显示 Tauri 已建立指向源库的符号链接，旧脚本重复复制同一文件导致 `Copy-Item` 占用错误。
- 已补入原版对绝对/相对符号链接的处理；Android 签名规则保持原样。为补齐 APK，手动构建新增 `android_only` 选项，仅重建两种 Android 架构。
- Android 修复已通过 PowerShell 语法解析，以及绝对链接、相对链接、缺失目标、普通文件四种场景检查；脚本级修改不改变已部署网页及已成功桌面/Web 包的应用代码。
- 浏览器完全禁用持久存储时，公告使用会话内日期记录；重新启动后可能再次提醒，游戏不会因此阻塞。
