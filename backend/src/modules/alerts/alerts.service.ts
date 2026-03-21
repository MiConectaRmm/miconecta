import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Alert, AlertStatus } from '../../database/entities/alert.entity';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class AlertsService {
  constructor(
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    private readonly chatGateway: ChatGateway,
  ) {}

  async criarAlerta(dados: Partial<Alert>) {
    const alerta = this.alertRepo.create(dados);
    const saved = await this.alertRepo.save(alerta);

    // Emitir via WebSocket para o tenant
    if (saved.tenantId) {
      this.chatGateway.emitNotification(saved.tenantId, {
        type: 'alert_created',
        alertId: saved.id,
        tenantId: saved.tenantId,
        severidade: saved.severidade,
        titulo: saved.titulo || saved.tipo,
        timestamp: new Date(),
      });
    }

    return saved;
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

    const updated = await this.alertRepo.findOne({ where: { id } });

    // Emitir via WebSocket
    if (alerta.tenantId) {
      this.chatGateway.emitNotification(alerta.tenantId, {
        type: 'alert_acknowledged',
        alertId: id,
        tenantId: alerta.tenantId,
        reconhecidoPor: usuario,
        timestamp: new Date(),
      });
    }

    return updated;
  }

  async resolverAlerta(id: string) {
    const alerta = await this.alertRepo.findOne({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');

    await this.alertRepo.update(id, {
      status: AlertStatus.RESOLVIDO,
      resolvidoEm: new Date(),
    });

    const updated = await this.alertRepo.findOne({ where: { id } });

    // Emitir via WebSocket
    if (alerta.tenantId) {
      this.chatGateway.emitNotification(alerta.tenantId, {
        type: 'alert_resolved',
        alertId: id,
        tenantId: alerta.tenantId,
        timestamp: new Date(),
      });
    }

    return updated;
  }
}
