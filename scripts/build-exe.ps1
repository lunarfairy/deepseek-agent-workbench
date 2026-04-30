$ErrorActionPreference = 'Stop'

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Set-Location $root

Write-Host ''
Write-Host 'DeepSeek Agent Workbench Windows EXE builder'
Write-Host "Project: $root"
Write-Host ''

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw 'npm was not found. Install Node.js first, then run this script again.'
}

if (-not (Test-Path (Join-Path $root 'node_modules'))) {
  Write-Host 'node_modules was not found. Installing dependencies...'
  npm install
}

Write-Host ''
Write-Host 'Building and packaging Windows EXE...'
npm run package

$packageJson = Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json
$installerName = "DeepSeek-Agent-Workbench-Setup-$($packageJson.version).exe"
$installerPath = Join-Path $root "dist\$installerName"
$appName = $packageJson.build.productName
$appExePath = Join-Path $root "dist\win-unpacked\$appName.exe"

Write-Host ''
Write-Host 'Build complete.'

if (Test-Path $installerPath) {
  Write-Host "Installer EXE: $installerPath"
} else {
  Write-Warning "Expected installer was not found: $installerPath"
  Get-ChildItem -Path (Join-Path $root 'dist') -Filter '*.exe' -Recurse -ErrorAction SilentlyContinue |
    ForEach-Object { Write-Host "Found EXE: $($_.FullName)" }
}

if (Test-Path $appExePath) {
  Write-Host "Unpacked app EXE: $appExePath"
}

Write-Host ''
Write-Host 'Note: the EXE is unsigned, so Windows may show a security warning.'
