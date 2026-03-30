import { Injectable, UnauthorizedException, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { Device, DeviceStatus } from '../../database/entities/device.entity';
import { Organization } from '../../database/entities/organization.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { Agent, AgentStatus } from '../../database/entities/agent.entity';
import { InstallationToken, InstallationTokenStatus } from '../../database/entities/installation-token.entity';
import { AlertEngine } from '../alerts/alert-engine.service';
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto, InstallationTokenCreateDto, GenerateClientInstallerDto } from './dto/agent.dto';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Organization)
    private readonly organizationRepo: Repository<Organization>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(DeviceMetric)
    private readonly metricRepo: Repository<DeviceMetric>,
    @InjectRepository(DeviceInventory)
    private readonly inventoryRepo: Repository<DeviceInventory>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
    @InjectRepository(InstallationToken)
    private readonly installationTokenRepo: Repository<InstallationToken>,
    private readonly jwtService: JwtService,
    private readonly alertEngine: AlertEngine,
    private readonly configService: ConfigService,
  ) {}

  /** Base pública da API (scripts, MSI, agent.config) — alinhada a API_URL ou produção Maginf. */
  getPublicApiBaseUrl(configService: ConfigService): string {
    const explicit = configService.get<string>('API_URL')?.trim();
    if (explicit) return explicit.replace(/\/$/, '');
    const railway = configService.get<string>('RAILWAY_PUBLIC_DOMAIN')?.trim();
    if (railway) return `https://${railway}/api/v1`;
    if (configService.get<string>('NODE_ENV') !== 'production') {
      return 'http://localhost:3000/api/v1';
    }
    return 'https://api.maginf.com.br/api/v1';
  }

  /** Mesma versão do MSI/agente (AGENT_VERSION, senão assets/agent-version.txt gerado pelo build-agent.ps1). */
  resolveAgentVersion(configService: ConfigService): string {
    const env = configService.get<string>('AGENT_VERSION')?.trim();
    if (env) return env;
    try {
      const p = path.join(process.cwd(), 'assets', 'agent-version.txt');
      if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8').trim();
    } catch {
      /* ignore */
    }
    return '2.0.0';
  }

  /** Relay RustDesk a partir do .env (fallback legado só se vazio — evitar quebrar dev). */
  getRustDeskConfig(configService: ConfigService): { server: string; key: string } {
    const server = configService.get<string>('RUSTDESK_SERVER')?.trim() || '';
    const key = configService.get<string>('RUSTDESK_KEY')?.trim() || '';
    return { server, key };
  }

  /** Base HTTP(S) para Socket.IO: mesma regra do agente (URL da API sem sufixo /api/v1). */
  resolveWsBaseUrl(configService: ConfigService): string {
    const api = this.getPublicApiBaseUrl(configService).replace(/\/$/, '');
    return api.replace(/\/api\/v1$/i, '') || api;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Página HTML única por tenant (abra a resposta no navegador a partir do painel, com JWT). */
  async buildInstallerLandingHtml(tenantId: string, configService: ConfigService): Promise<string> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const base = this.getPublicApiBaseUrl(configService);
    const v = this.resolveAgentVersion(configService);
    const msiUrl = `${base}/agents/download/msi`;
    const nome = this.escapeHtml(tenant.nome);
    const year = new Date().getFullYear();

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Instalar MIConecta — ${nome}</title>
  <style>
    :root { --bg:#0f1419; --card:#1a2332; --text:#e8eef7; --muted:#8b9bb4; --accent:#3b82f6; --accent2:#22c55e; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: system-ui, Segoe UI, Roboto, sans-serif; background: linear-gradient(160deg, var(--bg) 0%, #162030 100%); color: var(--text); min-height: 100vh; }
    .wrap { max-width: 640px; margin: 0 auto; padding: 2.5rem 1.25rem; }
    .badge { display:inline-block; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--accent2); background: rgba(34,197,94,0.12); padding: 0.35rem 0.65rem; border-radius: 6px; margin-bottom: 1rem; }
    h1 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; line-height: 1.3; }
    .sub { color: var(--muted); font-size: 0.95rem; margin-bottom: 1.75rem; }
    .card { background: var(--card); border-radius: 12px; padding: 1.5rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.06); }
    .row { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
    a.btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1.25rem; border-radius: 8px; font-weight: 600; text-decoration: none; color: #fff; background: var(--accent); border: none; cursor: pointer; font-size: 0.95rem; }
    a.btn:hover { filter: brightness(1.08); }
    a.btn-secondary { background: #334155; color: var(--text); }
    .meta { font-size: 0.8rem; color: var(--muted); word-break: break-all; margin-top: 0.75rem; }
    .ver { font-family: ui-monospace, monospace; font-size: 0.85rem; color: var(--accent2); }
    footer { margin-top: 2rem; font-size: 0.75rem; color: var(--muted); text-align: center; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="badge">Instalador oficial</div>
    <h1>MIConecta Agent</h1>
    <p class="sub">Cliente: <strong>${nome}</strong> · Versão do pacote <span class="ver">${this.escapeHtml(v)}</span></p>
    <div class="card">
      <p style="margin:0 0 1rem; font-size:0.95rem;">Baixe o instalador assinado pela Maginf (MSI). Os scripts .ps1 / .bat do painel usam a mesma versão e o mesmo servidor.</p>
      <div class="row">
        <a class="btn" href="${this.escapeHtml(msiUrl)}">Baixar MIConectaSetup.msi</a>
      </div>
      <p class="meta">Endpoint: ${this.escapeHtml(msiUrl)}</p>
    </div>
    <div class="card">
      <p style="margin:0; font-size:0.9rem; color:var(--muted);">Scripts automatizados com token de provisionamento ficam em <strong>Dispositivos / Instalar agente</strong> no painel (mesma versão <span class="ver">${this.escapeHtml(v)}</span> nos nomes dos ficheiros).</p>
    </div>
    <footer>Maginf Tecnologia · MIConecta · ${year}</footer>
  </div>
</body>
</html>`;
  }

  /** Chamado após criar tenant: não compila MSI no servidor (o build é único por release); centraliza log e URL da página de instalador. */
  async onTenantCreated(tenantId: string, configService: ConfigService): Promise<void> {
    const base = this.getPublicApiBaseUrl(configService);
    const v = this.resolveAgentVersion(configService);
    this.logger.log(
      `Tenant ${tenantId}: pacote agente v${v}; página de instalador: ${base}/agents/installer-page/${tenantId} (requer JWT)`,
    );
  }

  async criarInstallationToken(tenantId: string, dto: InstallationTokenCreateDto) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const rawToken = this.gerarTokenSeguro(32);
    const tokenHash = this.hashToken(rawToken);
    const preview = rawToken.slice(0, 8);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    const token = await this.installationTokenRepo.save({
      tenantId,
      tokenHash,
      tokenPreview: preview,
      descricao: dto.descricao || null,
      status: InstallationTokenStatus.ATIVO,
      expiresAt,
    });

    return { ...token, token: rawToken };
  }

  async listarInstallationTokens(tenantId: string) {
    return this.installationTokenRepo.find({
      where: { tenantId },
      order: { criadoEm: 'DESC' },
    });
  }

  async revogarInstallationToken(tenantId: string, tokenId: string) {
    const token = await this.installationTokenRepo.findOne({ where: { id: tokenId, tenantId } });
    if (!token) throw new NotFoundException('Token não encontrado');
    token.status = InstallationTokenStatus.INATIVO;
    return this.installationTokenRepo.save(token);
  }

  async listarAgentes(tenantId: string) {
    return this.agentRepo.find({
      where: { tenantId },
      relations: ['device', 'tenant'],
      order: { criadoEm: 'DESC' },
    });
  }

  async getDownloadInfo(tenantId: string, configService: ConfigService) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const apiUrl = configService.get('API_URL') || configService.get('CORS_ORIGIN')?.replace(/\/$/, '');
    const downloadUrl = configService.get('AGENT_DOWNLOAD_URL') || null;
    const agentVersion = this.resolveAgentVersion(configService);

    let provisionToken = tenant.provisionToken;
    let provisionExpires = tenant.provisionTokenExpires;

    if (!provisionToken || !provisionExpires || provisionExpires < new Date()) {
      const result = await this.gerarProvisionToken(tenantId);
      provisionToken = result.provisionToken;
      provisionExpires = result.expiresAt;
    }

    return {
      downloadUrl,
      agentVersion,
      serverUrl: this.getPublicApiBaseUrl(configService),
      tenantId,
      tenantNome: tenant.nome,
      provisionToken,
      provisionExpires,
      systemRequirements: {
        os: 'Windows 10/11 ou Windows Server 2016+',
        runtime: '.NET 8 Runtime',
        minRam: '128 MB',
        minDisk: '100 MB',
      },
    };
  }

  async generateInstallScript(
    tenantId: string,
    configService: ConfigService,
    format: string,
    options?: { installationTokenPlain?: string; organizationId?: string },
  ) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    let provisionToken = options?.installationTokenPlain;
    if (!provisionToken) {
      provisionToken = tenant.provisionToken;
      if (!provisionToken || !tenant.provisionTokenExpires || tenant.provisionTokenExpires < new Date()) {
        const result = await this.gerarProvisionToken(tenantId);
        provisionToken = result.provisionToken;
      }
    }

    const organizationId = (options?.organizationId || '').replace(/[\r\n"']/g, '').trim();
    const rd = this.getRustDeskConfig(configService);
    const rdServer = rd.server || '136.248.114.218';
    const rdKey = rd.key || '';
    const rdKeyPs = rdKey.replace(/`/g, '``').replace(/\$/g, '`$');
    const rdServerPs = rdServer.replace(/`/g, '``').replace(/\$/g, '`$');
    const rdKeyBat = rdKey.replace(/%/g, '%%');
    const rdServerBat = rdServer.replace(/%/g, '%%');

    const serverUrl = this.getPublicApiBaseUrl(configService);

    const msiDownloadUrl = `${serverUrl}/agents/download/msi`;
    const clientName = tenant.nome.replace(/[^a-zA-Z0-9 ]/g, '').trim();

    const agentVersion = this.resolveAgentVersion(configService);
    if (format === 'ps1') {
      const script = [
        `# MIConectaRMM - Instalacao Automatica`,
        `# Agente MSI / scripts: v${agentVersion} (alinhado ao deploy do servidor)`,
        `# Cliente: ${tenant.nome}`,
        `# Gerado em: ${new Date().toISOString()}`,
        ``,
        `# Auto-elevar como Administrador se necessario`,
        `if (-not ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {`,
        `    Write-Host "Solicitando permissao de Administrador..." -ForegroundColor Yellow`,
        `    Start-Process powershell.exe -ArgumentList "-ExecutionPolicy Bypass -File \`"$PSCommandPath\`"" -Verb RunAs`,
        `    exit`,
        `}`,
        ``,
        `$ErrorActionPreference = "Stop"`,
        ``,
        `$ServerUrl      = "${serverUrl}"`,
        `$TenantId       = "${tenantId}"`,
        `$ProvisionToken = "${provisionToken}"`,
        `$MsiUrl         = "${msiDownloadUrl}"`,
        `$MsiFile        = Join-Path $env:TEMP "MIConectaSetup.msi"`,
        `$InstallDir     = "$env:ProgramFiles\\MIConecta"`,
        `$ConfigFile     = Join-Path $InstallDir "agent.config"`,
        ``,
        `Write-Host ""`,
        `Write-Host "========================================" -ForegroundColor Cyan`,
        `Write-Host "  MIConecta Agent - Instalacao" -ForegroundColor Cyan`,
        `Write-Host "  Cliente: ${tenant.nome}"               -ForegroundColor Cyan`,
        `Write-Host "  Servidor: $ServerUrl"                   -ForegroundColor Cyan`,
        `Write-Host "========================================" -ForegroundColor Cyan`,
        `Write-Host ""`,
        ``,
        `# 1. Download do MSI`,
        `Write-Host "[1/7] Baixando instalador..." -ForegroundColor Yellow`,
        `try {`,
        `    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12`,
        `    Invoke-WebRequest -Uri $MsiUrl -OutFile $MsiFile -UseBasicParsing`,
        `    Write-Host "[OK] Download concluido" -ForegroundColor Green`,
        `} catch {`,
        `    Write-Host "[ERRO] Falha no download: $_" -ForegroundColor Red`,
        `    Write-Host "[INFO] Verifique a URL: $MsiUrl" -ForegroundColor Yellow`,
        `    pause`,
        `    exit 1`,
        `}`,
        ``,
        `# 2. Parar servico e tray existentes`,
        `Write-Host "[2/7] Parando servicos existentes..." -ForegroundColor Yellow`,
        `Stop-Service -Name "MIConectaRMMAgent" -Force -ErrorAction SilentlyContinue`,
        `Get-Process -Name "MIConectaTray" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`,
        `Start-Sleep -Seconds 3`,
        `Write-Host "[OK] Servicos parados" -ForegroundColor Green`,
        ``,
        `# 3. Instalar MSI silenciosamente`,
        `Write-Host "[3/7] Instalando agente..." -ForegroundColor Yellow`,
        `$logFile = Join-Path $env:TEMP "MIConecta_install.log"`,
        `$msiArgs = @("/i", $MsiFile, "/qn", "/l*v", $logFile)`,
        `$proc = Start-Process msiexec -ArgumentList $msiArgs -Wait -PassThru`,
        `if ($proc.ExitCode -ne 0) {`,
        `    Write-Host "[ERRO] Falha na instalacao. Codigo: $($proc.ExitCode)" -ForegroundColor Red`,
        `    Write-Host "Log: $logFile" -ForegroundColor Yellow`,
        `    Write-Host "--- Ultimas 30 linhas do log ---" -ForegroundColor Yellow`,
        `    Get-Content $logFile -Tail 30 -ErrorAction SilentlyContinue`,
        `    pause`,
        `    exit 1`,
        `}`,
        `Write-Host "[OK] Agente instalado" -ForegroundColor Green`,
        ``,
        `# 4. Verificar DLLs instaladas`,
        `Write-Host "[4/7] Verificando integridade..." -ForegroundColor Yellow`,
        `$dllCount = (Get-ChildItem "$InstallDir" -Filter "*.dll" -ErrorAction SilentlyContinue | Measure-Object).Count`,
        `if ($dllCount -lt 10) {`,
        `    Write-Host "[AVISO] Apenas $dllCount DLLs encontradas em $InstallDir" -ForegroundColor Yellow`,
        `    Write-Host "        O MSI pode estar sem self-contained. O agente pode nao funcionar" -ForegroundColor Yellow`,
        `    Write-Host "        se o .NET 8 Runtime nao estiver instalado." -ForegroundColor Yellow`,
        `} else {`,
        `    Write-Host "[OK] $dllCount DLLs verificadas" -ForegroundColor Green`,
        `}`,
        ``,
        `# 5. Criar/Atualizar agent.config`,
        `Write-Host "[5/7] Criando configuracao..." -ForegroundColor Yellow`,
        `# Preservar DeviceId e DeviceToken se ja existirem (reinstalacao)`,
        `$existingDeviceId = ""`,
        `$existingDeviceToken = ""`,
        `if (Test-Path $ConfigFile) {`,
        `    foreach ($line in (Get-Content $ConfigFile)) {`,
        `        if ($line -match "^DeviceId=(.+)$") { $existingDeviceId = $Matches[1] }`,
        `        if ($line -match "^DeviceToken=(.+)$") { $existingDeviceToken = $Matches[1] }`,
        `    }`,
        `    if ($existingDeviceId) {`,
        `        Write-Host "     Preservando registro existente: DeviceId=$existingDeviceId" -ForegroundColor Gray`,
        `    }`,
        `}`,
        `$configContent = @"`,
        `ServerUrl=$ServerUrl`,
        `TenantId=$TenantId`,
        `OrganizationId=${organizationId}`,
        `DeviceId=$existingDeviceId`,
        `DeviceToken=$existingDeviceToken`,
        `ProvisionToken=$ProvisionToken`,
        `RustDeskServer=${rdServerPs}`,
        `RustDeskKey=${rdKeyPs}`,
        `HeartbeatIntervalSeconds=60`,
        `CommandPollIntervalSeconds=30`,
        `ChatPollIntervalSeconds=15`,
        `UpdateCheckIntervalHours=6`,
        `QueueEnabled=True`,
        `AutoUpdateEnabled=True`,
        `ChatEnabled=True`,
        `ConsentEnabled=True`,
        `"@`,
        `Set-Content -Path $ConfigFile -Value $configContent -Encoding UTF8`,
        `Write-Host "[OK] Configuracao criada" -ForegroundColor Green`,
        ``,
        `# 6. Iniciar servico`,
        `Write-Host "[6/7] Iniciando servico..." -ForegroundColor Yellow`,
        `sc.exe failure MIConectaRMMAgent reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null`,
        `Start-Service -Name "MIConectaRMMAgent" -ErrorAction SilentlyContinue`,
        `Start-Sleep -Seconds 2`,
        `$svc = Get-Service -Name "MIConectaRMMAgent" -ErrorAction SilentlyContinue`,
        `if ($svc -and $svc.Status -eq "Running") {`,
        `    Write-Host "[OK] Servico iniciado" -ForegroundColor Green`,
        `} else {`,
        `    Write-Host "[AVISO] Servico nao iniciou. Verificando logs..." -ForegroundColor Yellow`,
        `    $logDir = Join-Path $InstallDir "logs"`,
        `    if (Test-Path $logDir) {`,
        `        $lastLog = Get-ChildItem $logDir | Sort-Object LastWriteTime -Descending | Select-Object -First 1`,
        `        if ($lastLog) { Get-Content $lastLog.FullName -Tail 10 -ErrorAction SilentlyContinue }`,
        `    }`,
        `}`,
        ``,
        `# 7. Aguardar registro e verificar`,
        `Write-Host "[7/7] Aguardando registro no servidor..." -ForegroundColor Yellow`,
        `$registrado = $false`,
        `for ($i = 1; $i -le 6; $i++) {`,
        `    Start-Sleep -Seconds 5`,
        `    $cfg = Get-Content $ConfigFile -ErrorAction SilentlyContinue`,
        `    $devId = ($cfg | Select-String "^DeviceId=(.+)$").Matches`,
        `    if ($devId -and $devId.Groups[1].Value) {`,
        `        $registrado = $true`,
        `        Write-Host "[OK] Dispositivo registrado! DeviceId=$($devId.Groups[1].Value)" -ForegroundColor Green`,
        `        break`,
        `    }`,
        `    Write-Host "     Tentativa $i/6 - aguardando..." -ForegroundColor Gray`,
        `}`,
        `if (-not $registrado) {`,
        `    Write-Host "[AVISO] Registro ainda nao completou. Isso pode levar ate 1 minuto." -ForegroundColor Yellow`,
        `    Write-Host "        Verifique o dashboard em breve." -ForegroundColor Yellow`,
        `}`,
        ``,
        `# Limpar MSI temporario`,
        `Remove-Item $MsiFile -Force -ErrorAction SilentlyContinue`,
        ``,
        `Write-Host ""`,
        `Write-Host "========================================" -ForegroundColor Green`,
        `Write-Host "  Instalacao concluida!"                  -ForegroundColor Green`,
        `Write-Host "  Cliente: ${tenant.nome}"                -ForegroundColor Green`,
        `Write-Host "  Servidor: $ServerUrl"                   -ForegroundColor Green`,
        `Write-Host "========================================" -ForegroundColor Green`,
        `Write-Host ""`,
        `Write-Host "O dispositivo aparecera no dashboard em instantes." -ForegroundColor Cyan`,
        `Write-Host "O chat de suporte estara disponivel na bandeja do sistema." -ForegroundColor Cyan`,
        `pause`,
      ].join('\r\n');

      return {
        filename: `instalar-${clientName.replace(/\s+/g, '-').toLowerCase()}-v${agentVersion}.ps1`,
        content: script,
        contentType: 'application/octet-stream',
      };
    }

    // .BAT
    const bat = [
      `@echo off`,
      `chcp 65001 > nul`,
      `REM MIConectaRMM - Instalacao Automatica`,
      `REM Agente MSI / scripts: v${agentVersion} (alinhado ao deploy do servidor)`,
      `REM Cliente: ${tenant.nome}`,
      `REM Gerado em: ${new Date().toISOString()}`,
      `REM Execute como Administrador`,
      ``,
      `setlocal enabledelayedexpansion`,
      ``,
      `REM Verificar privilegios de administrador`,
      `net session >nul 2>&1`,
      `if %errorLevel% neq 0 (`,
      `    echo [ERRO] Execute este script como Administrador!`,
      `    pause`,
      `    exit /b 1`,
      `)`,
      ``,
      `set "SERVER_URL=${serverUrl}"`,
      `set "TENANT_ID=${tenantId}"`,
      `set "ORG_ID=${organizationId}"`,
      `set "PROVISION_TOKEN=${provisionToken}"`,
      `set "RD_SERVER=${rdServerBat}"`,
      `set "RD_KEY=${rdKeyBat}"`,
      `set "MSI_URL=${msiDownloadUrl}"`,
      `set "MSI_FILE=%TEMP%\\MIConectaSetup.msi"`,
      `set "INSTALL_DIR=%ProgramFiles%\\MIConecta"`,
      `set "CONFIG_FILE=%INSTALL_DIR%\\agent.config"`,
      ``,
      `echo.`,
      `echo ========================================`,
      `echo   MIConecta Agent - Instalacao`,
      `echo   Cliente: ${tenant.nome}`,
      `echo ========================================`,
      `echo.`,
      ``,
      `echo [1/5] Baixando instalador...`,
      `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; try { Invoke-WebRequest -Uri '%MSI_URL%' -OutFile '%MSI_FILE%' -UseBasicParsing; Write-Host '[OK] Download concluido' } catch { Write-Host '[ERRO]' $_.Exception.Message; exit 1 }"`,
      ``,
      `if not exist "%MSI_FILE%" (`,
      `    echo [ERRO] Falha ao baixar o instalador!`,
      `    pause`,
      `    exit /b 1`,
      `)`,
      ``,
      `echo [2/5] Instalando agente...`,
      `REM Parar servico se existir`,
      `sc stop MIConectaRMMAgent >nul 2>&1`,
      `timeout /t 3 /nobreak >nul`,
      `REM Desinstalar versao anterior se existir`,
      `wmic product where "name='MIConecta Agent'" call uninstall /nointeractive >nul 2>&1`,
      `set "LOG_FILE=%TEMP%\\MIConecta_install.log"`,
      `msiexec /i "%MSI_FILE%" /qn /l*v "%LOG_FILE%"`,
      ``,
      `if %errorlevel% neq 0 (`,
      `    echo [ERRO] Falha na instalacao. Codigo: %errorlevel%`,
      `    echo Log em: %LOG_FILE%`,
      `    echo Ultimas linhas do log:`,
      `    powershell -NoProfile -Command "Get-Content '%LOG_FILE%' | Select-Object -Last 30"`,
      `    pause`,
      `    exit /b 1`,
      `)`,
      ``,
      `echo [3/5] Criando configuracao...`,
      `(`,
      `echo ServerUrl=%SERVER_URL%`,
      `echo TenantId=%TENANT_ID%`,
      `echo OrganizationId=%ORG_ID%`,
      `echo DeviceId=`,
      `echo DeviceToken=`,
      `echo ProvisionToken=%PROVISION_TOKEN%`,
      `echo RustDeskServer=%RD_SERVER%`,
      `echo RustDeskKey=%RD_KEY%`,
      `echo HeartbeatIntervalSeconds=60`,
      `echo CommandPollIntervalSeconds=30`,
      `echo ChatPollIntervalSeconds=15`,
      `echo UpdateCheckIntervalHours=6`,
      `echo QueueEnabled=True`,
      `echo AutoUpdateEnabled=True`,
      `echo ChatEnabled=True`,
      `echo ConsentEnabled=True`,
      `) > "%CONFIG_FILE%"`,
      `echo [OK] Configuracao criada`,
      ``,
      `echo [4/5] Iniciando servico...`,
      `sc failure MIConectaRMMAgent reset= 86400 actions= restart/60000/restart/60000/restart/60000 >nul 2>&1`,
      `sc start MIConectaRMMAgent >nul 2>&1`,
      `timeout /t 2 /nobreak >nul`,
      `sc query MIConectaRMMAgent | find "RUNNING" >nul 2>&1`,
      `if %errorlevel% equ 0 (`,
      `    echo [OK] Servico iniciado`,
      `) else (`,
      `    echo [AVISO] Servico nao iniciou automaticamente. Verifique os logs.`,
      `)`,
      ``,
      `echo [5/5] Limpando arquivos temporarios...`,
      `del /f /q "%MSI_FILE%" 2>nul`,
      ``,
      `echo.`,
      `echo ========================================`,
      `echo   Instalacao concluida com sucesso!`,
      `echo   O dispositivo aparecera no dashboard`,
      `echo   em aproximadamente 1 minuto.`,
      `echo ========================================`,
      `echo.`,
      `pause`,
    ].join('\r\n');

    return {
      filename: `instalar-${clientName.replace(/\s+/g, '-').toLowerCase()}-v${agentVersion}.bat`,
      content: bat,
      contentType: 'application/octet-stream',
    };
  }

  async gerarProvisionToken(tenantId: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    const token = uuidv4();
    const expires = new Date();
    expires.setDate(expires.getDate() + 30);

    await this.tenantRepo.update(tenantId, {
      provisionToken: token,
      provisionTokenExpires: expires,
    });

    return { provisionToken: token, expiresAt: expires, tenantId };
  }

  async registrar(provisionToken: string, dados: AgentRegisterDto) {
    // Tentar primeiro via installation_tokens (token hash)
    let installationToken = await this.installationTokenRepo.findOne({ where: { tokenHash: this.hashToken(provisionToken) }, relations: ['tenant'] });
    let tenant: Tenant | null = null;

    if (installationToken && installationToken.status === InstallationTokenStatus.ATIVO && (!installationToken.expiresAt || installationToken.expiresAt >= new Date())) {
      tenant = installationToken.tenant;
    } else {
      // Fallback: buscar via provision_token do tenant
      installationToken = null;
      tenant = await this.tenantRepo.findOne({ where: { provisionToken } });
      if (!tenant || !tenant.provisionTokenExpires || tenant.provisionTokenExpires < new Date()) {
        throw new UnauthorizedException('Token de instalação inválido ou expirado');
      }
    }

    if (!tenant) throw new UnauthorizedException('Tenant não identificado');

    const fingerprint = this.calcularFingerprint(dados);
    let device = null as Device | null;
    if (dados.numeroSerie) {
      device = await this.deviceRepo.findOne({ where: { tenantId: tenant.id, numeroSerie: dados.numeroSerie } });
    }
    if (!device) {
      device = await this.deviceRepo.findOne({ where: { tenantId: tenant.id, hostname: dados.hostname } });
    }

    const deviceData: Partial<Device> = {
      sistemaOperacional: dados.sistemaOperacional,
      versaoWindows: dados.versaoWindows,
      cpu: dados.cpu,
      ramTotalMb: dados.ramTotalMb,
      discoTotalMb: dados.discoTotalMb,
      discoDisponivelMb: dados.discoDisponivelMb,
      ipLocal: dados.ipLocal,
      ipExterno: dados.ipExterno,
      modeloMaquina: dados.modeloMaquina,
      numeroSerie: dados.numeroSerie,
      agentVersion: dados.agentVersion,
      rustdeskId: dados.rustdeskId,
      antivirusNome: dados.antivirusNome,
      antivirusStatus: dados.antivirusStatus,
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
      notas: JSON.stringify({ fingerprint, macAddress: dados.macAddress, username: dados.username }),
    };

    if (device) {
      await this.deviceRepo.update(device.id, deviceData);
      this.logger.log(`Device re-registrado: ${dados.hostname} (${device.id})`);
    } else {
      // Buscar primeira organização do tenant como default
      const defaultOrgId = await this.getDefaultOrganizationId(tenant.id);

      device = await this.deviceRepo.save({
        tenantId: tenant.id,
        organizationId: defaultOrgId,
        hostname: dados.hostname,
        ...deviceData,
      });
      this.logger.log(`Novo device registrado: ${dados.hostname} (${device.id})`);
    }

    const agentTokenPlain = this.gerarTokenSeguro(48);

    // Upsert agent: verificar se já existe para este tenant+device
    let agent = await this.agentRepo.findOne({ where: { tenantId: tenant.id, deviceId: device.id } });
    if (agent) {
      await this.agentRepo.update(agent.id, {
        installationTokenId: installationToken?.id || agent.installationTokenId,
        agentTokenHash: this.hashToken(agentTokenPlain),
        agentTokenPreview: agentTokenPlain.slice(0, 8),
        status: AgentStatus.ONLINE,
        agentVersion: dados.agentVersion || agent.agentVersion,
        lastSeen: new Date(),
        remoteStatus: dados.rustdeskId ? 'ready' : agent.remoteStatus,
      });
      this.logger.log(`Agent re-registrado: ${dados.hostname} (${agent.id})`);
    } else {
      agent = await this.agentRepo.save({
        tenantId: tenant.id,
        deviceId: device.id,
        installationTokenId: installationToken?.id || null,
        agentTokenHash: this.hashToken(agentTokenPlain),
        agentTokenPreview: agentTokenPlain.slice(0, 8),
        status: AgentStatus.ONLINE,
        agentVersion: dados.agentVersion || null,
        lastSeen: new Date(),
        remoteStatus: dados.rustdeskId ? 'ready' : null,
      });
      this.logger.log(`Novo agent registrado: ${dados.hostname} (${agent.id})`);
    }

    await this.deviceRepo.update(device.id, {
      agentId: agent.id,
      agentVersion: dados.agentVersion || device.agentVersion,
      rustdeskId: dados.rustdeskId || device.rustdeskId,
      lastCheckin: new Date(),
    } as any);

    if (installationToken) {
      installationToken.status = InstallationTokenStatus.INATIVO;
      await this.installationTokenRepo.save(installationToken);
    }

    const agentToken = this.jwtService.sign(
      { sub: agent.id, tenantId: tenant.id, deviceId: device.id, type: 'agent', role: 'agent' },
      { expiresIn: '365d' },
    );

    return {
      deviceId: device.id,
      agentId: agent.id,
      agentToken,
      tenantId: tenant.id,
      configuracoes: {
        heartbeatIntervalMs: 60000,
        metricsIntervalMs: 60000,
        inventoryIntervalMs: 21600000,
      },
    };
  }

  async heartbeat(agentToken: string, dto: AgentHeartbeatDto) {
    if (!agentToken) throw new UnauthorizedException('Agent token ausente');
    const payload = this.jwtService.verify<{ sub: string; tenantId: string; deviceId: string }>(agentToken);
    const agent = await this.agentRepo.findOne({ where: { id: payload.sub, tenantId: payload.tenantId, deviceId: payload.deviceId }, relations: ['device'] });
    if (!agent) throw new UnauthorizedException('Agente não autorizado');

    const device = await this.deviceRepo.findOne({ where: { id: dto.deviceId, tenantId: payload.tenantId } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');

    // Atualizar status e campos do device
    const updateData: Partial<Device> = {
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
    };
    if (dto.antivirusNome) updateData.antivirusNome = dto.antivirusNome;
    if (dto.antivirusStatus) updateData.antivirusStatus = dto.antivirusStatus;
    if (dto.uptimeSegundos) updateData.uptime_segundos = dto.uptimeSegundos;
    if (dto.discoDisponivelMb) updateData.discoDisponivelMb = dto.discoDisponivelMb;
  if (dto.rustdeskId) updateData.rustdeskId = dto.rustdeskId;

    // Preservar usuário logado nas notas do device
    if ((dto as any).loggedUser) {
      try {
        const notas = JSON.parse(device.notas || '{}');
        notas.loggedUser = (dto as any).loggedUser;
        notas.loggedUserAt = new Date().toISOString();
        (updateData as any).notas = JSON.stringify(notas);
      } catch { /* ignora */ }
    }

    await this.deviceRepo.update(device.id, {
      ...updateData,
      lastCheckin: new Date(),
    } as any);
    await this.agentRepo.update(agent.id, {
      status: dto.status === 'offline' ? AgentStatus.OFFLINE : AgentStatus.ONLINE,
      lastSeen: new Date(),
      agentVersion: dto.agentVersion || agent.agentVersion,
      remoteStatus: dto.remoteStatus || agent.remoteStatus,
    } as any);

    // Resolver alertas de offline ativos para este device
    await this.alertEngine.resolverAlertaOffline(device.id);

    // Registrar métricas se presentes
    if (dto.cpuPercent !== undefined || dto.ramPercent !== undefined) {
      await this.metricRepo.save({
        deviceId: device.id,
        cpuPercent: dto.cpuPercent,
        ramPercent: dto.ramPercent,
        ramUsadaMb: dto.ramUsadaMb,
        discoPercent: dto.discoPercent,
        discoUsadoMb: dto.discoUsadoMb,
        temperatura: dto.temperatura,
        uptimeSegundos: dto.uptimeSegundos,
        redeEntradaBytes: dto.redeEntradaBytes,
        redeSaidaBytes: dto.redeSaidaBytes,
      });

      // Avaliar thresholds de alerta
      await this.alertEngine.avaliarMetricas(device.id, payload.tenantId, dto);
    }

    // Retornar comandos pendentes (placeholder para futuro)
    return { status: 'ok', agentId: agent.id, deviceId: device.id, tenantId: payload.tenantId, commands: [], timestamp: new Date().toISOString() };
  }

  async verificarAtualizacao() {
    // Retorna informações da versão mais recente do agente disponível
    // Configurável via env AGENT_VERSION e AGENT_DOWNLOAD_URL
    const versaoDisponivel = this.resolveAgentVersion(this.configService);
    const downloadUrl = process.env.AGENT_DOWNLOAD_URL || null;
    const checksum = process.env.AGENT_CHECKSUM || null;

    return {
      versaoDisponivel,
      downloadUrl,
      checksum,
      obrigatoria: false,
      notas: `Agente MIConectaRMM v${versaoDisponivel}`,
    };
  }

  async atualizarInventario(deviceId: string, tenantId: string, dto: AgentInventoryDto) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, tenantId } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');

    // Remover inventário antigo
    await this.inventoryRepo.delete({ deviceId });

    // Inserir novo inventário
    const itens = dto.itens.map(item =>
      this.inventoryRepo.create({
        deviceId,
        nome: item.nome,
        versao: item.versao,
        fabricante: item.fabricante,
        tamanho: item.tamanho,
        tipo: item.tipo || 'software',
        dataInstalacao: item.dataInstalacao ? new Date(item.dataInstalacao) : undefined,
      }),
    );

    const saved = await this.inventoryRepo.save(itens);
    this.logger.log(`Inventário atualizado: device=${deviceId}, itens=${saved.length}`);
    return { count: saved.length };
  }

  /**
   * White-label por cliente (tenant): cria installation_token único + scripts PS1/BAT
   * com o mesmo fluxo do agente (MSI + agent.config). Revogação: DELETE /agents/installation-tokens/:id
   */
  async gerarPacoteInstaladorCliente(
    clientTenantId: string,
    configService: ConfigService,
    dto: GenerateClientInstallerDto,
  ) {
    const tenant = await this.tenantRepo.findOne({ where: { id: clientTenantId } });
    if (!tenant) throw new NotFoundException('Cliente (tenant) não encontrado');

    const created = await this.criarInstallationToken(clientTenantId, {
      descricao: dto.descricao?.trim() || `Instalador white-label ${new Date().toISOString().slice(0, 10)}`,
      expiresAt: dto.expiresAt,
    });
    const rawToken = (created as { token: string }).token;
    if (!rawToken) throw new BadRequestException('Falha ao gerar token de instalação');

    const ps1 = await this.generateInstallScript(clientTenantId, configService, 'ps1', {
      installationTokenPlain: rawToken,
      organizationId: dto.organizationId,
    });
    const bat = await this.generateInstallScript(clientTenantId, configService, 'bat', {
      installationTokenPlain: rawToken,
      organizationId: dto.organizationId,
    });

    const backendUrl = this.getPublicApiBaseUrl(configService);
    const wsUrl = this.resolveWsBaseUrl(configService);

    return {
      clientId: clientTenantId,
      tenantId: clientTenantId,
      clientNome: tenant.nome,
      backendUrl,
      wsUrl,
      agentVersion: this.resolveAgentVersion(configService),
      installationTokenId: created.id,
      tokenPreview: created.tokenPreview,
      expiresAt: created.expiresAt,
      installationToken: rawToken,
      scripts: {
        ps1: { filename: ps1.filename, content: ps1.content },
        bat: { filename: bat.filename, content: bat.content },
      },
      revocation: {
        method: 'DELETE' as const,
        path: `/api/v1/agents/installation-tokens/${created.id}`,
      },
    };
  }

  private async getDefaultOrganizationId(tenantId: string): Promise<string> {
    const existente = await this.organizationRepo.findOne({
      where: { tenantId, ativo: true },
      order: { criadoEm: 'ASC' },
    });

    if (existente?.id) return existente.id;

    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    this.logger.warn(`Nenhuma organização ativa encontrada para tenant ${tenantId}. Criando organização padrão.`);

    const organizacao = await this.organizationRepo.save(
      this.organizationRepo.create({
        tenantId,
        nome: tenant.nome || 'Organização Principal',
        ativo: true,
        configuracoes: { criadaAutomaticamente: true, origem: 'agent-register' },
      }),
    );

    this.logger.log(`Organização padrão criada automaticamente para tenant ${tenantId}: ${organizacao.id}`);
    return organizacao.id;
  }

  private gerarTokenSeguro(bytes: number): string {
    return crypto.randomBytes(bytes).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private calcularFingerprint(dados: AgentRegisterDto): string {
    return this.hashToken([
      dados.hostname,
      dados.username || '',
      dados.sistemaOperacional || '',
      dados.versaoWindows || '',
      dados.numeroSerie || '',
      dados.macAddress || '',
    ].join('|'));
  }
}
