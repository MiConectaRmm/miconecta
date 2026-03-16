import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { Device, DeviceStatus } from '../../database/entities/device.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';

@Injectable()
export class AgentsService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(DeviceMetric)
    private readonly metricRepo: Repository<DeviceMetric>,
    private readonly jwtService: JwtService,
  ) {}

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

  async registrar(provisionToken: string, dados: {
    hostname: string;
    sistemaOperacional?: string;
    cpu?: string;
    ramTotalMb?: number;
    discoTotalMb?: number;
    discoDisponivelMb?: number;
    ipLocal?: string;
    ipExterno?: string;
    modeloMaquina?: string;
    numeroSerie?: string;
    agentVersion?: string;
  }) {
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

    if (device) {
      // Atualizar device existente
      await this.deviceRepo.update(device.id, {
        sistemaOperacional: dados.sistemaOperacional,
        cpu: dados.cpu,
        ramTotalMb: dados.ramTotalMb,
        discoTotalMb: dados.discoTotalMb,
        discoDisponivelMb: dados.discoDisponivelMb,
        ipLocal: dados.ipLocal,
        ipExterno: dados.ipExterno,
        modeloMaquina: dados.modeloMaquina,
        numeroSerie: dados.numeroSerie,
        agentVersion: dados.agentVersion,
        status: DeviceStatus.ONLINE,
        lastSeen: new Date(),
      });
    } else {
      // Criar novo device
      device = await this.deviceRepo.save({
        tenantId: tenant.id,
        hostname: dados.hostname,
        sistemaOperacional: dados.sistemaOperacional,
        cpu: dados.cpu,
        ramTotalMb: dados.ramTotalMb,
        discoTotalMb: dados.discoTotalMb,
        discoDisponivelMb: dados.discoDisponivelMb,
        ipLocal: dados.ipLocal,
        ipExterno: dados.ipExterno,
        modeloMaquina: dados.modeloMaquina,
        numeroSerie: dados.numeroSerie,
        agentVersion: dados.agentVersion,
        status: DeviceStatus.ONLINE,
        lastSeen: new Date(),
      });
    }

    // Gerar device token (JWT permanente)
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
        inventoryIntervalMs: 21600000,
      },
    };
  }

  async heartbeat(deviceId: string, tenantId: string, metricas: {
    cpuPercent?: number;
    ramPercent?: number;
    ramUsadaMb?: number;
    discoPercent?: number;
    discoUsadoMb?: number;
    temperatura?: number;
    uptimeSegundos?: number;
    redeEntradaBytes?: number;
    redeSaidaBytes?: number;
    antivirusStatus?: string;
    antivirusNome?: string;
  }) {
    // Atualizar status do device
    await this.deviceRepo.update(deviceId, {
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
    });

    // Registrar métricas
    if (metricas.cpuPercent !== undefined || metricas.ramPercent !== undefined) {
      await this.metricRepo.save({
        deviceId,
        cpuPercent: metricas.cpuPercent,
        ramPercent: metricas.ramPercent,
        ramUsadaMb: metricas.ramUsadaMb,
        discoPercent: metricas.discoPercent,
        discoUsadoMb: metricas.discoUsadoMb,
        temperatura: metricas.temperatura,
        uptimeSegundos: metricas.uptimeSegundos,
        redeEntradaBytes: metricas.redeEntradaBytes,
        redeSaidaBytes: metricas.redeSaidaBytes,
      });
    }

    // Buscar comandos pendentes (futuro: tabela de comandos)
    return { status: 'ok', commands: [] };
  }
}
