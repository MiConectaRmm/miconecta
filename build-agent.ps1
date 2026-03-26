# ============================================================
# MIConectaRMM Agent - Build Script
# Compila o agente + tray e gera o MSI via WiX Toolset
# ============================================================
# REGRA (não alterar sem revisar WiX + installer):
#   - Agente e tray: self-contained, publicação MULTI-ARQUIVO (runtime .NET + DLLs na pasta).
#   - Proibido: PublishSingleFile / PublishTrimmed no MSI (quebra pasta de instalação e
#     pode remover assemblies necessários). Ver agent/Directory.Build.props.
# Uso:
#   .\build-agent.ps1
#   .\build-agent.ps1 -Version "2.1.0"
#   .\build-agent.ps1 -SkipClean
# ============================================================

param(
    [string]$Version = "2.0.0",
    [switch]$SkipClean
)

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot
$AgentProj = "$Root\agent\MIConectaAgent\MIConectaAgent.csproj"
$TrayProj = "$Root\agent\MIConectaAgent.Tray\MIConectaAgent.Tray.csproj"
$WixProj = "$Root\installer\wix\MIConectaInstaller.wixproj"
$PublishDir = "$Root\agent\publish"
$OutputDir = "$Root\installer\output"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MIConectaRMM Agent Build v$Version" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean
if (-not $SkipClean) {
    Write-Host "[1/4] Limpando builds anteriores..." -ForegroundColor Yellow
    if (Test-Path $PublishDir) { Remove-Item $PublishDir -Recurse -Force }
    if (Test-Path $OutputDir) { Remove-Item $OutputDir -Recurse -Force }
    New-Item -Path "$PublishDir\agent" -ItemType Directory -Force | Out-Null
    New-Item -Path "$PublishDir\tray" -ItemType Directory -Force | Out-Null
    New-Item -Path $OutputDir -ItemType Directory -Force | Out-Null
    Write-Host "  OK" -ForegroundColor Green
} else {
    Write-Host "[1/4] Pulando limpeza (SkipClean)" -ForegroundColor DarkGray
}

# Step 2: Compile Agent (self-contained, pasta com coreclr + DLLs — obrigatório para o MSI)
Write-Host "[2/4] Compilando MIConectaAgent (self-contained, multi-arquivo)..." -ForegroundColor Yellow
dotnet publish $AgentProj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -o "$PublishDir\agent" `
    /p:PublishSingleFile=false `
    /p:PublishTrimmed=false `
    /p:Version=$Version `
    --nologo -v quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO: Falha ao compilar o Agent!" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$PublishDir\agent\coreclr.dll")) {
    Write-Host "  ERRO: Publicacao invalida — falta coreclr.dll (runtime nao incluido na pasta)." -ForegroundColor Red
    exit 1
}
$agentDlls = (Get-ChildItem "$PublishDir\agent" -Filter "*.dll" -File -ErrorAction SilentlyContinue).Count
if ($agentDlls -lt 50) {
    Write-Host "  ERRO: Publicacao invalida — poucas DLLs na pasta ($agentDlls). Esperado self-contained multi-arquivo." -ForegroundColor Red
    exit 1
}
$agentSize = [math]::Round((Get-Item "$PublishDir\agent\MIConectaAgent.exe").Length / 1MB, 2)
Write-Host ('  OK - MIConectaAgent.exe ({0} MB), {1} DLLs, runtime presente' -f $agentSize, $agentDlls) -ForegroundColor Green

# Step 3: Compile Tray (self-contained na subpasta tray\, para nao depender do .NET no PC)
Write-Host "[3/4] Compilando MIConectaTray (self-contained, multi-arquivo)..." -ForegroundColor Yellow
dotnet publish $TrayProj `
    -c Release `
    -r win-x64 `
    --self-contained true `
    -o "$PublishDir\tray" `
    /p:PublishSingleFile=false `
    /p:PublishTrimmed=false `
    /p:Version=$Version `
    --nologo -v quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO: Falha ao compilar o Tray!" -ForegroundColor Red
    exit 1
}
if (-not (Test-Path "$PublishDir\tray\coreclr.dll")) {
    Write-Host "  ERRO: Publicacao do tray invalida — falta coreclr.dll." -ForegroundColor Red
    exit 1
}
$trayDlls = (Get-ChildItem "$PublishDir\tray" -Filter "*.dll" -File -ErrorAction SilentlyContinue).Count
if ($trayDlls -lt 50) {
    Write-Host "  ERRO: Publicacao invalida — poucas DLLs no tray ($trayDlls)." -ForegroundColor Red
    exit 1
}
$traySize = [math]::Round((Get-Item "$PublishDir\tray\MIConectaTray.exe").Length / 1MB, 2)
Write-Host ('  OK - MIConectaTray.exe ({0} MB), {1} DLLs' -f $traySize, $trayDlls) -ForegroundColor Green

# Step 4: Build MSI
Write-Host "[4/4] Gerando MSI com WiX Toolset..." -ForegroundColor Yellow
dotnet build $WixProj -c Release --nologo -v quiet

if ($LASTEXITCODE -ne 0) {
    Write-Host "  ERRO: Falha ao gerar o MSI!" -ForegroundColor Red
    exit 1
}

$msiSource = "$Root\installer\wix\bin\Release\MIConectaSetup.msi"
$msiDest = "$OutputDir\MIConectaSetup-v$Version.msi"
Copy-Item $msiSource $msiDest -Force

$msiSize = [math]::Round((Get-Item $msiDest).Length / 1MB, 2)

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  BUILD COMPLETO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  MSI: $msiDest" -ForegroundColor White
Write-Host "  Tamanho: $msiSize MB" -ForegroundColor White
Write-Host ""
Write-Host "  Instalacao interativa:" -ForegroundColor Cyan
Write-Host "    msiexec /i MIConectaSetup-v$Version.msi" -ForegroundColor White
Write-Host ""
Write-Host "  Instalacao silenciosa:" -ForegroundColor Cyan
Write-Host "    msiexec /i MIConectaSetup-v$Version.msi /qn SERVER_URL=https://api.maginf.com.br/api/v1 TENANT_ID=xxx PROVISION_TOKEN=yyy" -ForegroundColor White
Write-Host ""
Write-Host "  Via GPO:" -ForegroundColor Cyan
Write-Host "    Adicione o .msi em Software Installation da GPO" -ForegroundColor White
Write-Host ""
