import { Injectable, UnauthorizedException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { Device, DeviceStatus } from '../../database/entities/device.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { AlertEngine } from '../alerts/alert-engine.service';
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto } from './dto/agent.dto';

@Injectable()
export class AgentsService {
  private readonly logger = new Logger(AgentsService.name);

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(DeviceMetric)
    private readonly metricRepo: Repository<DeviceMetric>,
    @InjectRepository(DeviceInventory)
    private readonly inventoryRepo: Repository<DeviceInventory>,
    private readonly jwtService: JwtService,
    private readonly alertEngine: AlertEngine,
  ) {}

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
        `$MsiPath = Join-Path $PSScriptRoot "MIConectaRMMSetup.msi"`,
        `if (-not (Test-Path $MsiPath)) {`,
        `    Write-Host "ERRO: MIConectaRMMSetup.msi nao encontrado na mesma pasta do script." -ForegroundColor Red`,
        `    Write-Host "Baixe o MSI e coloque na mesma pasta." -ForegroundColor Yellow`,
        `    pause`,
        `    exit 1`,
        `}`,
        ``,
        `Write-Host "Instalando MIConectaRMM Agent para: ${tenant.nome}" -ForegroundColor Cyan`,
        `Write-Host ""`,
        ``,
        `$args = @(`,
        `    "/i"`,
        `    "`"$MsiPath`""`,
        `    "/qn"`,
        `    "SERVER_URL=${serverUrl}"`,
        `    "TENANT_ID=${tenantId}"`,
        `    "PROVISION_TOKEN=${provisionToken}"`,
        `)`,
        ``,
        `Start-Process msiexec.exe -ArgumentList $args -Wait -NoNewWindow`,
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
      `echo.`,
      `echo ========================================`,
      `echo   MIConectaRMM - Instalacao do Agente`,
      `echo   Cliente: ${tenant.nome}`,
      `echo ========================================`,
      `echo.`,
      ``,
      `if not exist "%~dp0MIConectaRMMSetup.msi" (`,
      `    echo ERRO: MIConectaRMMSetup.msi nao encontrado na mesma pasta do script.`,
      `    echo Baixe o MSI e coloque na mesma pasta.`,
      `    pause`,
      `    exit /b 1`,
      `)`,
      ``,
      `echo Instalando...`,
      `msiexec /i "%~dp0MIConectaRMMSetup.msi" /qn SERVER_URL=${serverUrl} TENANT_ID=${tenantId} PROVISION_TOKEN=${provisionToken}`,
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
    // Validar provision token
    const tenant = await this.tenantRepo.findOne({
      where: { provisionToken },
    });

    if (!tenant || !tenant.provisionTokenExpires || tenant.provisionTokenExpires < new Date()) {
      throw new UnauthorizedException('Token de provisionamento inválido ou expirado');
    }

    // Verificar se device já existe
    let device = await this.deviceRepo.findOne({
      where: { tenantId: tenant.id, hostname: dados.hostname },
    });

    const deviceData = {
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

    // Gerar device token (JWT 365d)
    const deviceToken = this.jwtService.sign(
      { sub: device.id, tenantId: tenant.id, type: 'agent' },
      { expiresIn: '365d' },
    );

    return {
      deviceId: device.id,
      deviceToken,
      tenantId: tenant.id,
      configuracoes: {
        heartbeatIntervalMs: 60000,
        metricsIntervalMs: 60000,
        inventoryIntervalMs: 21600000,
      },
    };
  }

  async heartbeat(deviceId: string, tenantId: string, dto: AgentHeartbeatDto) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId, tenantId } });
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

    await this.deviceRepo.update(deviceId, updateData);

    // Resolver alertas de offline ativos para este device
    await this.alertEngine.resolverAlertaOffline(deviceId);

    // Registrar métricas se presentes
    if (dto.cpuPercent !== undefined || dto.ramPercent !== undefined) {
      await this.metricRepo.save({
        deviceId,
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
      await this.alertEngine.avaliarMetricas(deviceId, tenantId, dto);
    }

    // Retornar comandos pendentes (placeholder para futuro)
    return { status: 'ok', commands: [], timestamp: new Date().toISOString() };
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
    const org = await this.deviceRepo.manager
      .getRepository('Organization')
      .findOne({ where: { tenantId }, order: { criadoEm: 'ASC' } });
    return org?.id || tenantId;
  }
}
