param(
    [string]$InstallDir,
    [string]$ServerUrl,
    [string]$TenantId,
    [string]$ProvisionToken,
    [string]$RustDeskServer,
    [string]$RustDeskKey
)

$configPath = Join-Path $InstallDir "agent.config"

$content = @"
ServerUrl=$ServerUrl
TenantId=$TenantId
ProvisionToken=$ProvisionToken
RustDeskServer=$RustDeskServer
RustDeskKey=$RustDeskKey
HeartbeatIntervalSeconds=60
"@

Set-Content -Path $configPath -Value $content -Encoding UTF8

$logsDir = Join-Path $InstallDir "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -Path $logsDir -ItemType Directory -Force | Out-Null
}
