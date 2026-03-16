import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Notification } from '../../database/entities/notification.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { RemoteSessionLog } from '../../database/entities/remote-session-log.entity';
import { ChatMessage } from '../../database/entities/chat-message.entity';

/**
 * Políticas de retenção de dados (LGPD compliance).
 * Executa limpeza periódica de dados expirados.
 */
export const RETENTION_POLICIES = {
  auditLogs: { dias: 365, descricao: 'Logs de auditoria — 1 ano' },
  deviceMetrics: { dias: 90, descricao: 'Métricas de dispositivos — 90 dias' },
  notifications: { dias: 90, descricao: 'Notificações — 90 dias' },
  sessionLogs: { dias: 180, descricao: 'Logs de sessão remota — 6 meses' },
  chatMessages: { dias: 365, descricao: 'Mensagens de chat — 1 ano' },
};

@Injectable()
export class DataRetentionService {
  private readonly logger = new Logger(DataRetentionService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(DeviceMetric)
    private readonly metricRepo: Repository<DeviceMetric>,
    @InjectRepository(RemoteSessionLog)
    private readonly sessionLogRepo: Repository<RemoteSessionLog>,
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
  ) {}

  /**
   * Executa diariamente às 03:00 (horário do servidor).
   * Remove dados além do período de retenção.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async executarLimpeza() {
    this.logger.log('Iniciando limpeza de dados (retenção LGPD)...');

    const resultados: Record<string, number> = {};

    // Métricas de dispositivos (90 dias)
    const limiteMetricas = this.diasAtras(RETENTION_POLICIES.deviceMetrics.dias);
    const metricasRemovidas = await this.metricRepo.delete({ criadoEm: LessThan(limiteMetricas) });
    resultados.deviceMetrics = metricasRemovidas.affected || 0;

    // Notificações (90 dias)
    const limiteNotif = this.diasAtras(RETENTION_POLICIES.notifications.dias);
    const notifsRemovidas = await this.notifRepo.delete({ criadoEm: LessThan(limiteNotif) });
    resultados.notifications = notifsRemovidas.affected || 0;

    // Logs de sessão remota (180 dias)
    const limiteSessaoLogs = this.diasAtras(RETENTION_POLICIES.sessionLogs.dias);
    const sessaoLogsRemovidos = await this.sessionLogRepo.delete({ timestamp: LessThan(limiteSessaoLogs) });
    resultados.sessionLogs = sessaoLogsRemovidos.affected || 0;

    // Audit logs (365 dias)
    const limiteAudit = this.diasAtras(RETENTION_POLICIES.auditLogs.dias);
    const auditRemovidos = await this.auditRepo.delete({ criadoEm: LessThan(limiteAudit) });
    resultados.auditLogs = auditRemovidos.affected || 0;

    // Chat messages (365 dias)
    const limiteChat = this.diasAtras(RETENTION_POLICIES.chatMessages.dias);
    const chatRemovidos = await this.chatRepo.delete({ criadoEm: LessThan(limiteChat) });
    resultados.chatMessages = chatRemovidos.affected || 0;

    const totalRemovidos = Object.values(resultados).reduce((a, b) => a + b, 0);
    this.logger.log(`Limpeza concluída: ${totalRemovidos} registros removidos`);
    this.logger.log(`Detalhes: ${JSON.stringify(resultados)}`);

    return resultados;
  }

  /**
   * Retorna as políticas de retenção configuradas.
   */
  getPoliticas() {
    return Object.entries(RETENTION_POLICIES).map(([chave, policy]) => ({
      recurso: chave,
      retencaoDias: policy.dias,
      descricao: policy.descricao,
      dataLimiteAtual: this.diasAtras(policy.dias).toISOString(),
    }));
  }

  private diasAtras(dias: number): Date {
    return new Date(Date.now() - dias * 86400000);
  }
}
