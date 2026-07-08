# Pocpet-Mint Agent Rules

## 打包规则

- 当前版本来源以 `package.json` 为准；打包前同步确认 Tauri 和 Cargo 版本字段。
- 日常打包默认只生成简名测试包：
  - Windows x64：`release/pocket<version>.exe`
  - Android arm64：`release/pocket<version>.apk`
- 日常打包不要额外生成 Web、macOS、Linux、Windows 32 位或 Android 32 位产物，除非用户明确要求。
- 全量打包在以下任一条件触发：
  - 当前版本号是 semver 的 `x.y.0`，例如 `1.1.0`、`1.2.0`、`2.0.0`
  - 用户明确要求“全量打包”“完整包”，或明确要求包含 macOS、Linux、32 位、Web 部署包等产物
- 全量打包产物命名：
  - Windows x64：`release/pocket<version>.exe`
  - Windows 32 位 x86：`release/pocket<version>-win32.exe`
  - Android arm64：`release/pocket<version>.apk`
  - Android 32 位 ARMv7 / `armeabi-v7a`：`release/pocket<version>-32bit.apk`
  - Web 部署包：`release/pocket<version>-web.zip`
  - macOS 图形桌面包：`release/pocket<version>-mac.dmg`
  - Ubuntu/Linux 图形桌面包：优先 `release/pocket<version>-ubuntu.AppImage`，如 CI/runner 支持也保留 `release/pocket<version>-ubuntu.deb`
- Android 测试包默认使用 debug keystore 签名；正式商店签名必须由用户明确要求。
- macOS/Linux 包需要在对应系统或 CI runner 上构建；Windows 本机不要强行生成这些平台产物。
- `release/` 是本地交付产物目录，打包产物不提交到 git。
