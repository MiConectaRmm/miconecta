import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DeviceMetric } from '../../database/entities/device-metric.entity';

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(DeviceMetric)
    private readonly metricRepo: Repository<DeviceMetric>,
  ) {}

  async registrarMetrica(dados: Partial<DeviceMetric>) {
    const metrica = this.metricRepo.create(dados);
    return this.metricRepo.save(metrica);
  }

  async registrarMetricasBatch(deviceId: string, metricas: Partial<DeviceMetric>) {
    const metrica = this.metricRepo.create({ ...metricas, deviceId });
    return this.metricRepo.save(metrica);
  }

  async listarMetricas(deviceId: string, periodo?: { inicio: Date; fim: Date }) {
    const where: any = { deviceId };

    if (periodo) {
      where.criadoEm = Between(periodo.inicio, periodo.fim);
    }

    return this.metricRepo.find({
      where,
      order: { criadoEm: 'DESC' },
      take: 1000,
    });
  }

  async ultimaMetrica(deviceId: string) {
    return this.metricRepo.findOne({
      where: { deviceId },
      order: { criadoEm: 'DESC' },
    });
  }

  async mediaMetricas(deviceId: string, horas: number = 24) {
    const inicio = new Date(Date.now() - horas * 60 * 60 * 1000);

    const resultado = await this.metricRepo
      .createQueryBuilder('m')
      .select('AVG(m.cpu_percent)', 'cpu_media')
      .addSelect('AVG(m.ram_percent)', 'ram_media')
      .addSelect('AVG(m.disco_percent)', 'disco_media')
      .addSelect('MAX(m.cpu_percent)', 'cpu_max')
      .addSelect('MAX(m.ram_percent)', 'ram_max')
      .where('m.device_id = :deviceId', { deviceId })
      .andWhere('m.criado_em >= :inicio', { inicio })
      .getRawOne();

    return resultado;
  }
}
