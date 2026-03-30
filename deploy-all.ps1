# Deploy API (Fly) + Frontend (Fly) a partir da raiz do repositório.
#
# Uso:
#   .\deploy-all.ps1                    # backend sem exigir MSI (como deploy-backend -SkipMsiCheck)
#   .\deploy-all.ps1 -RequireMsi        # exige installer\output\MIConectaSetup.msi no backend
#
param(
    [switch]$RequireMsi
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
Set-Location $Root

if ($RequireMsi) {
    & (Join-Path $Root "deploy-backend.ps1")
} else {
    & (Join-Path $Root "deploy-backend.ps1") -SkipMsiCheck
}

Set-Location (Join-Path $Root "frontend")
fly deploy

Write-Host ""
Write-Host "Deploy concluido: miconecta-backend + miconecta-frontend" -ForegroundColor Green
