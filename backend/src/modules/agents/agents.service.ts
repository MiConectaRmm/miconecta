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
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto, InstallationTokenCreateDto } from './dto/agent.dto';
import * as crypto from 'crypto';

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
  ) {}

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
    const agentVersion = configService.get('AGENT_VERSION') || '1.0.0';

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
      serverUrl: configService.get('API_URL') || `${configService.get('RAILWAY_PUBLIC_DOMAIN') ? 'https://' + configService.get('RAILWAY_PUBLIC_DOMAIN') : 'http://localhost:3000'}/api/v1`,
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

  async generateInstallScript(tenantId: string, configService: ConfigService, format: string) {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');

    let provisionToken = tenant.provisionToken;
    if (!provisionToken || !tenant.provisionTokenExpires || tenant.provisionTokenExpires < new Date()) {
      const result = await this.gerarProvisionToken(tenantId);
      provisionToken = result.provisionToken;
    }

    const serverUrl = configService.get('API_URL')
      || (configService.get('RAILWAY_PUBLIC_DOMAIN')
        ? `https://${configService.get('RAILWAY_PUBLIC_DOMAIN')}/api/v1`
        : 'http://localhost:3000/api/v1');

    const clientName = tenant.nome.replace(/[^a-zA-Z0-9 ]/g, '').trim();

    if (format === 'ps1') {
      const script = [
        `# MIConectaRMM - Script de Instalação`,
        `# Cliente: ${tenant.nome}`,
        `# Gerado em: ${new Date().toISOString()}`,
        `# Execute como Administrador`,
        ``,
        `$ErrorActionPreference = "Stop"`,
        ``,
        `# Procurar MSI na mesma pasta (versão-agnóstico)`,
        `$msiCandidates = @()`,
        `$msiCandidates += Get-ChildItem -Path $PSScriptRoot -Filter "MIConectaRMMSetup-*.msi" -ErrorAction SilentlyContinue`,
        `$msiCandidates += Get-ChildItem -Path $PSScriptRoot -Filter "MIConectaRMMSetup.msi" -ErrorAction SilentlyContinue`,
        ``,
        `if (-not $msiCandidates -or $msiCandidates.Count -eq 0) {`,
        `    Write-Host "ERRO: Nenhum arquivo MIConectaRMMSetup*.msi encontrado na mesma pasta do script." -ForegroundColor Red`,
        `    Write-Host "Baixe o MSI (ex: MIConectaRMMSetup-v2.0.0.msi) e coloque na mesma pasta." -ForegroundColor Yellow`,
        `    pause`,
        `    exit 1`,
        `}`,
        ``,
        `$MsiPath = $msiCandidates[0].FullName`,
        `Write-Host "Usando MSI: $MsiPath" -ForegroundColor Cyan`,
        `Write-Host "Instalando MIConectaRMM Agent para: ${tenant.nome}" -ForegroundColor Cyan`,
        `Write-Host ""`,
        ``,
        `$msiArgs = @(`,
        `    "/i"`,
        `    $MsiPath`,
        `    "/qn"`,
        `    "SERVER_URL=${serverUrl}"`,
        `    "TENANT_ID=${tenantId}"`,
        `    "PROVISION_TOKEN=${provisionToken}"`,
        `)`,
        ``,
        `Start-Process msiexec.exe -ArgumentList $msiArgs -Wait -NoNewWindow`,
        ``,
        `if ($LASTEXITCODE -eq 0) {`,
        `    Write-Host ""`,
        `    Write-Host "Instalacao concluida com sucesso!" -ForegroundColor Green`,
        `    Write-Host "O dispositivo aparecera no dashboard em ate 1 minuto." -ForegroundColor White`,
        `} else {`,
        `    Write-Host ""`,
        `    Write-Host "Erro na instalacao. Codigo: $LASTEXITCODE" -ForegroundColor Red`,
        `}`,
        ``,
        `pause`,
      ].join('\r\n');

      return {
        filename: `instalar-${clientName.replace(/\s+/g, '-').toLowerCase()}.ps1`,
        content: script,
        contentType: 'application/octet-stream',
      };
    }

    const bat = [
      `@echo off`,
      `REM MIConectaRMM - Script de Instalacao`,
      `REM Cliente: ${tenant.nome}`,
      `REM Gerado em: ${new Date().toISOString()}`,
      `REM Execute como Administrador`,
      ``,
      `setlocal enabledelayedexpansion`,
      ``,
      `echo.`,
      `echo ========================================`,
      `echo   MIConectaRMM - Instalacao do Agente`,
      `echo   Cliente: ${tenant.nome}`,
      `echo ========================================`,
      `echo.`,
      ``,
      `REM Procurar MSI na mesma pasta (versao-agnostico)`,
      `set "MSI_PATH="`,
      `for %%F in ("%~dp0MIConectaRMMSetup-*.msi" "%~dp0MIConectaRMMSetup.msi") do (`,
      `    if exist "%%~F" (`,
      `        set "MSI_PATH=%%~F"`,
      `        goto FOUND_MSI`,
      `    )`,
      `)`,
      ``,
      `echo ERRO: Nenhum arquivo MIConectaRMMSetup*.msi encontrado na mesma pasta do script.`,
      `echo Certifique-se de colocar aqui o MSI gerado (ex: MIConectaRMMSetup-v2.0.0.msi).`,
      `pause`,
      `exit /b 1`,
      ``,
      `:FOUND_MSI`,
      `echo Usando MSI: "%MSI_PATH%"`,
      `echo Instalando...`,
      `msiexec /i "%MSI_PATH%" /qn SERVER_URL=${serverUrl} TENANT_ID=${tenantId} PROVISION_TOKEN=${provisionToken}`,
      ``,
      `if %errorlevel% equ 0 (`,
      `    echo.`,
      `    echo Instalacao concluida com sucesso!`,
      `    echo O dispositivo aparecera no dashboard em ate 1 minuto.`,
      `) else (`,
      `    echo.`,
      `    echo Erro na instalacao. Codigo: %errorlevel%`,
      `)`,
      ``,
      `echo.`,
      `pause`,
    ].join('\r\n');

    return {
      filename: `instalar-${clientName.replace(/\s+/g, '-').toLowerCase()}.bat`,
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
    const installationToken = await this.installationTokenRepo.findOne({ where: { tokenHash: this.hashToken(provisionToken) }, relations: ['tenant'] });
    if (!installationToken || installationToken.status !== InstallationTokenStatus.ATIVO || (installationToken.expiresAt && installationToken.expiresAt < new Date())) {
      throw new UnauthorizedException('Token de instalação inválido ou expirado');
    }

    const tenant = installationToken.tenant;
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
    const agent = await this.agentRepo.save({
      tenantId: tenant.id,
      deviceId: device.id,
      installationTokenId: installationToken.id,
      agentTokenHash: this.hashToken(agentTokenPlain),
      agentTokenPreview: agentTokenPlain.slice(0, 8),
      status: AgentStatus.ONLINE,
      agentVersion: dados.agentVersion || null,
      lastSeen: new Date(),
      remoteStatus: dados.rustdeskId ? 'ready' : null,
    });

    await this.deviceRepo.update(device.id, {
      agentId: agent.id,
      agentVersion: dados.agentVersion || device.agentVersion,
      rustdeskId: dados.rustdeskId || device.rustdeskId,
      lastCheckin: new Date(),
    } as any);

    installationToken.status = InstallationTokenStatus.INATIVO;
    await this.installationTokenRepo.save(installationToken);

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
    const versaoDisponivel = process.env.AGENT_VERSION || '2.0.0';
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
