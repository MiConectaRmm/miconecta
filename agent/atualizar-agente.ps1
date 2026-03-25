# Auto-elevar como Administrador se necessario
if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$ErrorActionPreference = "Continue"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MIConecta Agent - Atualizacao Local"    -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$InstallDir = "$env:ProgramFiles\MIConecta"
$TrayDir    = "$InstallDir\tray"
$PublishAgent = "$PSScriptRoot\publish\agent"
$PublishTray  = "$PSScriptRoot\publish\tray"

# 1. Parar servico
Write-Host "[1/6] Parando servico..." -ForegroundColor Yellow
sc.exe stop MIConectaRMMAgent 2>$null | Out-Null
Start-Sleep -Seconds 3

# 2. Matar tray se estiver rodando
Write-Host "[2/6] Fechando MIConecta Tray..." -ForegroundColor Yellow
Get-Process -Name "MIConectaTray" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# 3. Backup config
Write-Host "[3/6] Salvando configuracao..." -ForegroundColor Yellow
$configFile = "$InstallDir\agent.config"
$configBackup = $null
if (Test-Path $configFile) {
    $configBackup = Get-Content $configFile -Raw
    Write-Host "     Config salva ($((Get-Content $configFile | Measure-Object).Count) linhas)" -ForegroundColor Gray
}

# 4. Copiar agent
Write-Host "[4/6] Copiando servico ($((Get-ChildItem $PublishAgent -Recurse | Measure-Object).Count) arquivos)..." -ForegroundColor Yellow
Copy-Item -Path "$PublishAgent\*" -Destination "$InstallDir\" -Recurse -Force

# 5. Copiar tray
Write-Host "[5/6] Copiando tray ($((Get-ChildItem $PublishTray -Recurse | Measure-Object).Count) arquivos)..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $TrayDir -Force | Out-Null
Copy-Item -Path "$PublishTray\*" -Destination "$TrayDir\" -Recurse -Force

# Restaurar config (publish pode ter sobrescrito)
if ($configBackup) {
    Set-Content -Path $configFile -Value $configBackup -NoNewline
    Write-Host "     Config restaurada" -ForegroundColor Gray
}

# 6. Reiniciar servico
Write-Host "[6/6] Iniciando servico..." -ForegroundColor Yellow
sc.exe start MIConectaRMMAgent | Out-Null
Start-Sleep -Seconds 10

# Verificar
$svc = Get-Service -Name "MIConectaRMMAgent" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host "[OK] Servico rodando" -ForegroundColor Green
} else {
    Write-Host "[AVISO] Servico nao iniciou. Verificar logs." -ForegroundColor Red
}

# Checar registro
$config = Get-Content $configFile
$deviceId = ($config | Select-String "^DeviceId=(.+)$").Matches.Groups[1].Value
if ($deviceId) {
    Write-Host "[OK] DeviceId: $deviceId" -ForegroundColor Green
} else {
    Write-Host "[AGUARDANDO] DeviceId ainda vazio - aguardando registro..." -ForegroundColor Yellow
    Start-Sleep -Seconds 15
    $config2 = Get-Content $configFile
    $deviceId2 = ($config2 | Select-String "^DeviceId=(.+)$").Matches.Groups[1].Value
    if ($deviceId2) {
        Write-Host "[OK] DeviceId: $deviceId2" -ForegroundColor Green
    } else {
        Write-Host "[ERRO] Registro falhou. Verificar logs em $InstallDir\logs" -ForegroundColor Red
        if (Test-Path "$InstallDir\logs") {
            $lastLog = Get-ChildItem "$InstallDir\logs" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
            if ($lastLog) {
                Write-Host "--- Ultimas 20 linhas do log ---" -ForegroundColor Yellow
                Get-Content $lastLog.FullName -Tail 20
            }
        }
    }
}

# DLLs
$dllCount = (Get-ChildItem "$InstallDir" -Filter "*.dll" | Measure-Object).Count
$trayDllCount = (Get-ChildItem "$TrayDir" -Filter "*.dll" -ErrorAction SilentlyContinue | Measure-Object).Count
Write-Host ""
Write-Host "Agent: $dllCount DLLs em $InstallDir" -ForegroundColor Gray
Write-Host "Tray:  $trayDllCount DLLs em $TrayDir" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Atualizacao concluida!"                 -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
pause
