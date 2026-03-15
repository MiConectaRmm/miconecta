import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Alert, AlertType, AlertSeverity, AlertStatus } from '../../database/entities/alert.entity';
import { Device, DeviceStatus } from '../../database/entities/device.entity';

@Injectable()
export class AlertEngine {
  private readonly logger = new Logger(AlertEngine.name);

  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async avaliarMetricas(deviceId: string, tenantId: string, metricas: any) {
    const alertas: Partial<Alert>[] = [];

    // CPU acima de 90%
    if (metricas.cpuPercent > 90) {
      alertas.push({
        tenantId,
        deviceId,
        tipo: AlertType.CPU_ALTA,
        severidade: AlertSeverity.CRITICO,
        titulo: `CPU em ${metricas.cpuPercent}%`,
        descricao: `O uso de CPU ultrapassou 90% no dispositivo.`,
        valor: metricas.cpuPercent,
        limite: 90,
      });
    }

    // RAM acima de 90%
    if (metricas.ramPercent > 90) {
      alertas.push({
        tenantId,
        deviceId,
        tipo: AlertType.RAM_ALTA,
        severidade: AlertSeverity.CRITICO,
        titulo: `Memória RAM em ${metricas.ramPercent}%`,
        descricao: `O uso de memória RAM ultrapassou 90%.`,
        valor: metricas.ramPercent,
        limite: 90,
      });
    }

    // Disco abaixo de 10%
    if (metricas.discoPercent > 90) {
      alertas.push({
        tenantId,
        deviceId,
        tipo: AlertType.DISCO_BAIXO,
        severidade: AlertSeverity.EMERGENCIA,
        titulo: `Disco com ${100 - metricas.discoPercent}% livre`,
        descricao: `O espaço em disco está abaixo de 10%.`,
        valor: metricas.discoPercent,
        limite: 90,
      });
    }

    for (const alertaData of alertas) {
      // Verificar se já existe alerta ativo do mesmo tipo para o device
      const existente = await this.alertRepo.findOne({
        where: {
          deviceId,
          tipo: alertaData.tipo,
          status: AlertStatus.ATIVO,
        },
      });

      if (!existente) {
        const alerta = this.alertRepo.create(alertaData);
        await this.alertRepo.save(alerta);
        this.logger.warn(`Alerta criado: ${alertaData.titulo} - Device: ${deviceId}`);
      }
    }
  }

  // Verificar dispositivos offline a cada 2 minutos
  @Cron(CronExpression.EVERY_MINUTE)
  async verificarOffline() {
    const limite = new Date(Date.now() - 3 * 60 * 1000);

    const offlineDevices = await this.deviceRepo
      .createQueryBuilder('device')
      .where('device.status = :status', { status: DeviceStatus.ONLINE })
      .andWhere('device.last_seen < :limite', { limite })
      .getMany();

    for (const device of offlineDevices) {
      // Verificar se já existe alerta de offline ativo
      const existente = await this.alertRepo.findOne({
        where: {
          deviceId: device.id,
          tipo: AlertType.OFFLINE,
          status: AlertStatus.ATIVO,
        },
      });

      if (!existente) {
        const alerta = this.alertRepo.create({
          tenantId: device.tenantId,
          deviceId: device.id,
          tipo: AlertType.OFFLINE,
          severidade: AlertSeverity.AVISO,
          titulo: `Dispositivo ${device.hostname} offline`,
          descricao: `Último contato: ${device.lastSeen?.toISOString()}`,
        });
        await this.alertRepo.save(alerta);
        this.logger.warn(`Dispositivo offline: ${device.hostname}`);
      }
    }
  }

  // Auto-resolver alertas de offline quando o device volta
  async resolverAlertaOffline(deviceId: string) {
    await this.alertRepo.update(
      { deviceId, tipo: AlertType.OFFLINE, status: AlertStatus.ATIVO },
      { status: AlertStatus.RESOLVIDO, resolvidoEm: new Date() },
    );
  }
}
