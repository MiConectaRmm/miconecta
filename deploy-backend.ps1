# Deploy so da API na Fly.io, com MSI vindo de installer\output (sem copiar para backend\assets).
#
# Uso:
#   .\deploy-backend.ps1
#   .\deploy-backend.ps1 -BuildIfMissing
#   .\deploy-backend.ps1 -SkipMsiCheck

param(
    [switch]$SkipMsiCheck,
    [switch]$BuildIfMissing
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$Msi = Join-Path $Root "installer\output\MIConectaSetup.msi"

if (-not $SkipMsiCheck) {
    if (-not (Test-Path $Msi)) {
        if ($BuildIfMissing) {
            Write-Host "MSI ausente - executando build-agent.ps1..." -ForegroundColor Yellow
            & (Join-Path $Root "build-agent.ps1")
            if (-not (Test-Path $Msi)) {
                Write-Host "Ainda sem MSI apos build: $Msi" -ForegroundColor Red
                exit 1
            }
        }
        else {
            Write-Host "ERRO: MSI nao encontrado:" -ForegroundColor Red
            Write-Host "  $Msi" -ForegroundColor Gray
            Write-Host ""
            Write-Host "Gere o instalador:" -ForegroundColor Yellow
            Write-Host "  .\build-agent.ps1" -ForegroundColor White
            Write-Host "Ou:" -ForegroundColor Yellow
            Write-Host '  .\deploy-backend.ps1 -BuildIfMissing' -ForegroundColor White
            exit 1
        }
    }
}

Set-Location $Root
fly deploy . --config backend/fly.toml
