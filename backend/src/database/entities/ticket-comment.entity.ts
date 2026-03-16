import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Ticket } from './ticket.entity';

export enum TicketCommentTipo {
  MENSAGEM = 'mensagem',
  NOTA_INTERNA = 'nota_interna',
  MUDANCA_STATUS = 'mudanca_status',
  SESSAO_REMOTA = 'sessao_remota',
  SCRIPT_EXECUTADO = 'script_executado',
  ANEXO = 'anexo',
  AVALIACAO = 'avaliacao',
  SISTEMA = 'sistema',
}

@Entity('ticket_comments')
@Index(['ticketId', 'criadoEm'])
export class TicketComment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ name: 'autor_tipo', length: 50 })
  autorTipo: string;

  @Column({ name: 'autor_id', nullable: true })
  autorId: string;

  @Column({ name: 'autor_nome', length: 255, nullable: true })
  autorNome: string;

  @Column({ type: 'enum', enum: TicketCommentTipo, default: TicketCommentTipo.MENSAGEM })
  tipo: TicketCommentTipo;

  @Column({ type: 'text', nullable: true })
  conteudo: string;

  @Column({ name: 'visivel_cliente', default: true })
  visivelCliente: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;
}
