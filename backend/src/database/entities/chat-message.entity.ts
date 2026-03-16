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
import { Device } from './device.entity';

export enum ChatMessageTipo {
  TEXTO = 'texto',
  IMAGEM = 'imagem',
  ARQUIVO = 'arquivo',
  SISTEMA = 'sistema',
}

export enum ChatRemetenteTipo {
  TECHNICIAN = 'technician',
  CLIENT_USER = 'client_user',
  AGENT = 'agent',
  SYSTEM = 'system',
}

@Entity('chat_messages')
@Index(['ticketId', 'criadoEm'])
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'ticket_id' })
  ticketId: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ name: 'remetente_tipo', type: 'enum', enum: ChatRemetenteTipo })
  remetenteTipo: ChatRemetenteTipo;

  @Column({ name: 'remetente_id', nullable: true })
  remetenteId: string;

  @Column({ name: 'remetente_nome', length: 255 })
  remetenteNome: string;

  @Column({ type: 'enum', enum: ChatMessageTipo, default: ChatMessageTipo.TEXTO })
  tipo: ChatMessageTipo;

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ name: 'arquivo_url', type: 'text', nullable: true })
  arquivoUrl: string;

  @Column({ name: 'arquivo_nome', length: 255, nullable: true })
  arquivoNome: string;

  @Column({ name: 'arquivo_tamanho', type: 'bigint', nullable: true })
  arquivoTamanho: number;

  @Column({ default: false })
  lido: boolean;

  @Column({ name: 'lido_em', type: 'timestamp', nullable: true })
  lidoEm: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Ticket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
