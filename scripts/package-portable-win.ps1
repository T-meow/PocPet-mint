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

$source = Join-Path $root 'src-tauri\target\release\app.exe'
$distIndex = Join-Path $root 'dist\index.html'
$releaseDir = Join-Path $root 'release'
$target = Join-Path $releaseDir "PocPet-$version-windows-portable.exe"

if (-not (Test-Path -LiteralPath $distIndex)) {
  throw "Vite index.html not found: $distIndex"
}

if (-not (Test-Path -LiteralPath $source)) {
  throw "Tauri executable not found: $source"
}

New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null
Copy-Item -LiteralPath $source -Destination $target -Force

$indexContent = Get-Content -LiteralPath $distIndex -Raw
$expectedAssets = [regex]::Matches($indexContent, 'assets/[^"]+\.(js|css)') | ForEach-Object { $_.Value }
if ($expectedAssets.Count -eq 0) {
  throw "No JavaScript or CSS asset references found in: $distIndex"
}

$latin1 = [System.Text.Encoding]::GetEncoding(28591)
$exeText = $latin1.GetString([System.IO.File]::ReadAllBytes($target))
foreach ($asset in $expectedAssets) {
  if (-not $exeText.Contains($asset)) {
    throw "Portable exe does not contain frontend asset reference '$asset'. The Tauri embedded assets are stale or missing."
  }
}

Write-Host "Portable Windows executable:"
Write-Host $target
