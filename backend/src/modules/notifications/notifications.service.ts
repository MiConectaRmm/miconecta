import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../../database/entities/notification.entity';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async criar(dados: {
    tenantId?: string;
    destinatarioTipo: string;
    destinatarioId: string;
    tipo: NotificationType;
    titulo: string;
    conteudo?: string;
    link?: string;
    metadata?: Record<string, any>;
  }) {
    const notif = this.notifRepo.create(dados);
    return this.notifRepo.save(notif);
  }

  async listar(destinatarioId: string, apenasNaoLidas: boolean = false) {
    const where: any = { destinatarioId };
    if (apenasNaoLidas) where.lida = false;

    return this.notifRepo.find({
      where,
      order: { criadoEm: 'DESC' },
      take: 50,
    });
  }

  async contarNaoLidas(destinatarioId: string) {
    return this.notifRepo.count({
      where: { destinatarioId, lida: false },
    });
  }

  async marcarComoLida(id: string, destinatarioId: string) {
    await this.notifRepo.update(
      { id, destinatarioId },
      { lida: true, lidaEm: new Date() },
    );
    return { message: 'Notificação marcada como lida' };
  }

  async marcarTodasComoLidas(destinatarioId: string) {
    await this.notifRepo.update(
      { destinatarioId, lida: false },
      { lida: true, lidaEm: new Date() },
    );
    return { message: 'Todas notificações marcadas como lidas' };
  }
}
