<#
.SYNOPSIS
  Build, push, dan deploy backend ke Azure Container Apps.

.DESCRIPTION
  Image diberi tag berdasarkan commit git yang sedang aktif, sehingga setiap
  revisi di Azure bisa ditelusuri balik ke kode persisnya. Tanpa ini, tag
  seperti "latest" membuat Anda tidak pernah tahu versi mana yang sedang
  berjalan saat ada masalah.

.EXAMPLE
  ./scripts/deploy.ps1
  ./scripts/deploy.ps1 -Tag hotfix-1
#>
param(
  [string]$Tag,
  [string]$Registry     = "asebackendacr01",
  [string]$AppName      = "ase-backend",
  [string]$ResourceGroup = "ase-backend-rg",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

# --- Pemeriksaan sebelum jalan ----------------------------------------------

$dirty = git status --porcelain
if ($dirty) {
  Write-Host "Ada perubahan yang belum di-commit:" -ForegroundColor Yellow
  git status --short
  $lanjut = Read-Host "Deploy kode yang belum di-commit? (y/N)"
  if ($lanjut -ne "y") { exit 1 }
}

if (-not $Tag) {
  $Tag = git rev-parse --short HEAD
}

$image = "$Registry.azurecr.io/$AppName`:$Tag"

Write-Host ""
Write-Host "Registry : $Registry" -ForegroundColor Cyan
Write-Host "Image    : $image"    -ForegroundColor Cyan
Write-Host "Commit   : $(git log -1 --format='%h %s')" -ForegroundColor Cyan
Write-Host ""

# --- Uji dulu sebelum deploy -------------------------------------------------
# Mendorong kode yang gagal test ke production jauh lebih mahal daripada
# menunggu beberapa detik di sini.

Write-Host "Menjalankan typecheck dan test..." -ForegroundColor Cyan
bun run typecheck
if ($LASTEXITCODE -ne 0) { Write-Host "Typecheck gagal. Deploy dibatalkan." -ForegroundColor Red; exit 1 }

bun test
if ($LASTEXITCODE -ne 0) { Write-Host "Test gagal. Deploy dibatalkan." -ForegroundColor Red; exit 1 }

# --- Build & push ------------------------------------------------------------

if (-not $SkipBuild) {
  Write-Host ""
  Write-Host "Login ke registry..." -ForegroundColor Cyan
  az acr login --name $Registry
  if ($LASTEXITCODE -ne 0) { exit 1 }

  Write-Host "Membangun image..." -ForegroundColor Cyan
  docker build -t $image .
  if ($LASTEXITCODE -ne 0) { exit 1 }

  Write-Host "Mengunggah image..." -ForegroundColor Cyan
  docker push $image
  if ($LASTEXITCODE -ne 0) { exit 1 }
}

# --- Deploy ------------------------------------------------------------------

Write-Host ""
Write-Host "Memperbarui container app..." -ForegroundColor Cyan
az containerapp update --name $AppName --resource-group $ResourceGroup --image $image
if ($LASTEXITCODE -ne 0) { exit 1 }

$fqdn = az containerapp show --name $AppName --resource-group $ResourceGroup `
  --query properties.configuration.ingress.fqdn -o tsv

Write-Host ""
Write-Host "Selesai. Memeriksa kesehatan..." -ForegroundColor Cyan

# Revisi baru butuh beberapa detik sebelum melayani.
Start-Sleep -Seconds 10
try {
  $health = Invoke-RestMethod "https://$fqdn/health/ready" -TimeoutSec 30
  if ($health.checks.database.ok) {
    Write-Host "Sehat: database tersambung." -ForegroundColor Green
  } else {
    Write-Host "Server hidup tapi database TIDAK tersambung." -ForegroundColor Red
  }
} catch {
  Write-Host "Belum bisa dihubungi. Cek log:" -ForegroundColor Yellow
  Write-Host "  az containerapp logs show --name $AppName --resource-group $ResourceGroup --tail 50"
}

Write-Host ""
Write-Host "https://$fqdn" -ForegroundColor Green
