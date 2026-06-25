param(
  [switch]$RebuildRust
)

$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$packageJson = Join-Path $root 'package.json'
if (-not (Test-Path -LiteralPath $packageJson)) {
  throw "package.json not found: $packageJson"
}

$project = Get-Content -LiteralPath $packageJson -Raw | ConvertFrom-Json
$version = [string]$project.version
if ([string]::IsNullOrWhiteSpace($version)) {
  throw 'Project version not found in package.json.'
}

$androidDir = Join-Path $root 'src-tauri\gen\android'
$appDir = Join-Path $androidDir 'app'
$sourceSo = Join-Path $root 'src-tauri\target\aarch64-linux-android\release\libapp_lib.so'
$jniDir = Join-Path $appDir 'src\main\jniLibs\arm64-v8a'
$jniSo = Join-Path $jniDir 'libapp_lib.so'
$releaseDir = Join-Path $root 'release'
$alignedApk = Join-Path $releaseDir "PocPet-$version-arm64-release-aligned.apk"
$finalApk = Join-Path $releaseDir "PocPet-$version-arm64-release-debugsigned.apk"

function Convert-VersionNameToCode([string]$versionName) {
  $core = ($versionName -split '[-+]')[0]
  $parts = $core -split '\.'
  $major = 0
  $minor = 0
  $patch = 0

  if ($parts.Count -ge 1 -and $parts[0] -match '^\d+$') { $major = [int]$parts[0] }
  if ($parts.Count -ge 2 -and $parts[1] -match '^\d+$') { $minor = [int]$parts[1] }
  if ($parts.Count -ge 3 -and $parts[2] -match '^\d+$') { $patch = [int]$parts[2] }

  $code = ($major * 10000) + ($minor * 100) + $patch
  if ($code -lt 1) { return 1 }
  return $code
}

function Resolve-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }

  foreach ($candidate in $candidates) {
    return (Resolve-Path -LiteralPath $candidate).Path
  }

  throw 'Android SDK not found. Set ANDROID_HOME or ANDROID_SDK_ROOT, or install it under %LOCALAPPDATA%\Android\Sdk.'
}

function Resolve-BuildTool([string]$sdk, [string]$toolName) {
  $buildToolsDir = Join-Path $sdk 'build-tools'
  if (-not (Test-Path -LiteralPath $buildToolsDir)) {
    throw "Android SDK build-tools directory not found: $buildToolsDir"
  }

  $tool = Get-ChildItem -Directory -LiteralPath $buildToolsDir |
    Sort-Object -Property @{ Expression = { try { [version]$_.Name } catch { [version]'0.0.0' } } } -Descending |
    ForEach-Object {
      $candidate = Join-Path $_.FullName $toolName
      if (Test-Path -LiteralPath $candidate) { $candidate }
    } |
    Select-Object -First 1

  if (-not $tool) {
    throw "$toolName not found in Android SDK build-tools: $buildToolsDir"
  }

  return $tool
}

function Resolve-Keytool {
  $pathCommand = Get-Command keytool -ErrorAction SilentlyContinue
  if ($pathCommand) { return $pathCommand.Source }

  if ($env:JAVA_HOME) {
    $candidate = Join-Path $env:JAVA_HOME 'bin\keytool.exe'
    if (Test-Path -LiteralPath $candidate) { return $candidate }
  }

  throw 'keytool not found. Install a JDK or set JAVA_HOME.'
}

function Ensure-DebugKeystore([string]$keytool) {
  $androidHome = Join-Path $env:USERPROFILE '.android'
  $keystore = Join-Path $androidHome 'debug.keystore'
  if (Test-Path -LiteralPath $keystore) { return $keystore }

  New-Item -ItemType Directory -Force -Path $androidHome | Out-Null
  & $keytool -genkeypair -v -keystore $keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname 'CN=Android Debug,O=Android,C=US'
  if ($LASTEXITCODE -ne 0) { throw 'Failed to create Android debug keystore.' }
  return $keystore
}

function Get-Arm64ReleaseApk {
  $apkRoot = Join-Path $appDir 'build\outputs\apk'
  if (-not (Test-Path -LiteralPath $apkRoot)) {
    throw "Gradle APK output directory not found: $apkRoot"
  }

  $apk = Get-ChildItem -Recurse -File -LiteralPath $apkRoot -Filter '*.apk' |
    Where-Object { $_.FullName -match '\\arm64\\release\\' -or $_.Name -match 'arm64.*release' } |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1

  if (-not $apk) {
    throw "Arm64 release APK not found under: $apkRoot"
  }

  return $apk.FullName
}

$sdk = Resolve-AndroidSdk
$zipalign = Resolve-BuildTool $sdk 'zipalign.exe'
$apksigner = Resolve-BuildTool $sdk 'apksigner.bat'
$keytool = Resolve-Keytool
$debugKeystore = Ensure-DebugKeystore $keytool

if ($RebuildRust -or -not (Test-Path -LiteralPath $sourceSo)) {
  Write-Host 'Building arm64 Rust library with Tauri Android script...'
  Push-Location $root
  try {
    & npm.cmd run tauri -- android android-studio-script --release --target aarch64
    if ($LASTEXITCODE -ne 0) { throw 'Tauri Android Rust build failed.' }
  } finally {
    Pop-Location
  }
}

if (-not (Test-Path -LiteralPath $sourceSo)) {
  throw "Rust arm64 library not found: $sourceSo"
}

$androidVersionCode = Convert-VersionNameToCode $version
$tauriProperties = Join-Path $appDir 'tauri.properties'
@(
  "tauri.android.versionCode=$androidVersionCode"
  "tauri.android.versionName=$version"
) | Set-Content -LiteralPath $tauriProperties -Encoding ASCII
Write-Host "Android versionName: $version"
Write-Host "Android versionCode: $androidVersionCode"

New-Item -ItemType Directory -Force -Path $jniDir | Out-Null
Copy-Item -LiteralPath $sourceSo -Destination $jniSo -Force
Write-Host "Copied arm64 library: $jniSo"

Push-Location $androidDir
try {
  & .\gradlew.bat assembleArm64Release -x rustBuildArm64Release
  if ($LASTEXITCODE -ne 0) { throw 'Gradle assembleArm64Release failed.' }
} finally {
  Pop-Location
}

$unsignedApk = Get-Arm64ReleaseApk
New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
if (Test-Path -LiteralPath $alignedApk) { Remove-Item -LiteralPath $alignedApk -Force }
if (Test-Path -LiteralPath $finalApk) { Remove-Item -LiteralPath $finalApk -Force }
if (Test-Path -LiteralPath "$finalApk.idsig") { Remove-Item -LiteralPath "$finalApk.idsig" -Force }

& $zipalign -p -f 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'zipalign failed.' }

& $apksigner sign --ks $debugKeystore --ks-key-alias androiddebugkey --ks-pass pass:android --key-pass pass:android --out $finalApk $alignedApk
if ($LASTEXITCODE -ne 0) { throw 'apksigner sign failed.' }

& $apksigner verify --verbose $finalApk
if ($LASTEXITCODE -ne 0) { throw 'apksigner verify failed.' }

Remove-Item -LiteralPath $alignedApk -Force
Write-Host 'Android arm64 debug-signed APK:'
Write-Host $finalApk
