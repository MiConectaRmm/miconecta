import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertStatus } from '../../database/entities/alert.entity';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

  async criarAlerta(dados: Partial<Alert>) {
    const alerta = this.alertRepo.create(dados);
    return this.alertRepo.save(alerta);
  }

  async listarAlertas(tenantId: string, filtros?: any) {
    const query = this.alertRepo.createQueryBuilder('alert')
      .leftJoinAndSelect('alert.device', 'device')
      .where('alert.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('alert.status = :status', { status: filtros.status });
    }

    if (filtros?.severidade) {
      query.andWhere('alert.severidade = :severidade', { severidade: filtros.severidade });
    }

    return query.orderBy('alert.criadoEm', 'DESC').take(100).getMany();
  }

  async contarAlertas(tenantId: string) {
    const ativos = await this.alertRepo.count({
      where: { tenantId, status: AlertStatus.ATIVO },
    });
    const total = await this.alertRepo.count({ where: { tenantId } });

    return { ativos, total };
  }

  async reconhecerAlerta(id: string, usuario: string) {
    const alerta = await this.alertRepo.findOne({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');

    await this.alertRepo.update(id, {
      status: AlertStatus.RECONHECIDO,
      reconhecidoEm: new Date(),
      reconhecidoPor: usuario,
    });

    return this.alertRepo.findOne({ where: { id } });
  }

  async resolverAlerta(id: string) {
    const alerta = await this.alertRepo.findOne({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');

    await this.alertRepo.update(id, {
      status: AlertStatus.RESOLVIDO,
      resolvidoEm: new Date(),
    });

    return this.alertRepo.findOne({ where: { id } });
  }
}
