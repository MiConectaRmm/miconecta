#Requires -Version 5.1
<#
.SYNOPSIS
  Desinstala o MIConecta Agent (MSI) instalado pelo instalador oficial.

.DESCRIPTION
  Localiza o pacote em HKLM\...\Uninstall pelo nome de exibição e executa msiexec /x.
  Para antes processos MIConectaTray (bandeja) para evitar ficheiros em uso.

  UpgradeCode fixo no WiX (referência): E7A3B1C2-4D5F-6A7B-8C9D-0E1F2A3B4C5D
  O ProductCode vem do registo da instalação atual.

.PARAMETER Silent
  Desinstalação silenciosa (/qn). Caso contrário usa interface básica (/qb).

.PARAMETER LogPath
  Caminho opcional para log do Windows Installer (/l*v).

.EXAMPLE
  .\desinstalar-miconecta.ps1
  .\desinstalar-miconecta.ps1 -Silent
  .\desinstalar-miconecta.ps1 -Silent -LogPath "$env:TEMP\MIConecta_uninstall.log"
#>
param(
    [switch]$Silent,
    [string]$LogPath = ""
)

$ErrorActionPreference = "Stop"

function Test-Administrator {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Host "A executar como Administrador..." -ForegroundColor Yellow
    $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    if ($Silent) { $arg += " -Silent" }
    if ($LogPath) { $arg += " -LogPath `"$LogPath`"" }
    $p = Start-Process powershell.exe -Verb RunAs -ArgumentList $arg -PassThru -Wait
    exit $(if ($p.ExitCode -ne $null) { $p.ExitCode } else { 0 })
}

$displayNamePattern = "^MIConecta Agent"

$uninstallRoots = @(
    "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
    "HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
)

$productCode = $null
foreach ($root in $uninstallRoots) {
    if (-not (Test-Path $root)) { continue }
    foreach ($key in Get-ChildItem $root -ErrorAction SilentlyContinue) {
        $props = Get-ItemProperty -LiteralPath $key.PSPath -ErrorAction SilentlyContinue
        if (-not $props.DisplayName) { continue }
        if ($props.DisplayName -notmatch $displayNamePattern) { continue }
        $name = $key.PSChildName
        if ($name -match '^\{[0-9A-Fa-f-]{36}\}$') {
            $productCode = $name
            break
        }
    }
    if ($productCode) { break }
}

if (-not $productCode) {
    Write-Host "[ERRO] MIConecta Agent não encontrado em Programas e Funcionalidades (não instalado ou nome alterado)." -ForegroundColor Red
    exit 1
}

Write-Host "Produto encontrado: ProductCode $productCode" -ForegroundColor Cyan

Get-Process -Name "MIConectaTray" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

$ui = if ($Silent) { "/qn" } else { "/qb" }
$args = @("/x", $productCode, $ui, "/norestart")
if ($LogPath) {
    $args += "/l*v"
    $args += $LogPath
}

Write-Host "msiexec $($args -join ' ')" -ForegroundColor Gray
$p = Start-Process -FilePath "msiexec.exe" -ArgumentList $args -PassThru -Wait
$code = $p.ExitCode

# 0 = sucesso, 3010 = sucesso reinício necessário
if ($code -eq 0 -or $code -eq 3010) {
    Write-Host "[OK] Desinstalação concluída (código $code)." -ForegroundColor Green
    exit 0
}

Write-Host "[ERRO] msiexec saiu com código $code." -ForegroundColor Red
exit $code
