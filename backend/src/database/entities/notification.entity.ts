import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum NotificationType {
  ALERTA = 'alerta',
  TICKET_NOVO = 'ticket_novo',
  TICKET_ATUALIZADO = 'ticket_atualizado',
  CHAT_MENSAGEM = 'chat_mensagem',
  SLA_PROXIMO = 'sla_proximo',
  SESSAO_SOLICITADA = 'sessao_solicitada',
  RELATORIO_PRONTO = 'relatorio_pronto',
  SISTEMA = 'sistema',
}

@Entity('notifications')
@Index(['destinatarioTipo', 'destinatarioId', 'lida'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'destinatario_tipo', length: 50 })
  destinatarioTipo: string;

  @Column({ name: 'destinatario_id' })
  destinatarioId: string;

  @Column({ type: 'enum', enum: NotificationType })
  tipo: NotificationType;

  @Column({ length: 500 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  conteudo: string;

  @Column({ default: false })
  lida: boolean;

  @Column({ name: 'lida_em', type: 'timestamp', nullable: true })
  lidaEm: Date;

  @Column({ length: 500, nullable: true })
  link: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
