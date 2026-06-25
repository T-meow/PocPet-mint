$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$releaseTarget = Join-Path $root 'src-tauri\target\release'

if (-not (Test-Path -LiteralPath $releaseTarget)) {
  Write-Host "Tauri release target does not exist yet:"
  Write-Host $releaseTarget
  exit 0
}

$resolvedReleaseTarget = Resolve-Path -LiteralPath $releaseTarget
$expectedPrefix = (Join-Path $root 'src-tauri\target\release')
if ($resolvedReleaseTarget.Path -ne $expectedPrefix) {
  throw "Refusing to clean unexpected release target: $($resolvedReleaseTarget.Path)"
}

$paths = @(
  (Join-Path $releaseTarget 'app.exe'),
  (Join-Path $releaseTarget 'app.d'),
  (Join-Path $releaseTarget 'app.pdb')
)

$patterns = @(
  (Join-Path $releaseTarget 'build\app-*'),
  (Join-Path $releaseTarget '.fingerprint\app-*'),
  (Join-Path $releaseTarget 'deps\app-*'),
  (Join-Path $releaseTarget 'deps\app_lib-*')
)

foreach ($path in $paths) {
  if (Test-Path -LiteralPath $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

foreach ($pattern in $patterns) {
  Get-ChildItem -Path $pattern -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $resolvedPath = Resolve-Path -LiteralPath $_.FullName
    if (-not $resolvedPath.Path.StartsWith($resolvedReleaseTarget.Path, [StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove path outside release target: $($resolvedPath.Path)"
    }
    Remove-Item -LiteralPath $resolvedPath.Path -Recurse -Force
  }
}

Write-Host "Cleaned Tauri app release cache:"
Write-Host $releaseTarget
