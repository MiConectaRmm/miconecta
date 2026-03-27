@echo off
chcp 65001 >nul
REM Desinstala MIConecta Agent (MSI) — pede Administrador
setlocal
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%desinstalar-miconecta.ps1" %*
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" pause
exit /b %ERR%
