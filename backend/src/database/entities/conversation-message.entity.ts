import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Conversation } from './conversation.entity';

export enum ConversationMessageType {
  TEXT = 'text',
  SYSTEM = 'system',
  FILE = 'file',
}

@Entity('conversation_messages')
@Index(['conversationId', 'criadoEm'])
export class ConversationMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'sender_user_id', nullable: true })
  senderUserId: string;

  @Column({ name: 'sender_device_id', nullable: true })
  senderDeviceId: string;

  @Column({ name: 'sender_name', length: 255 })
  senderName: string;

  @Column({ name: 'sender_type', length: 50 })
  senderType: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: ConversationMessageType, default: ConversationMessageType.TEXT })
  type: ConversationMessageType;

  @Column({ name: 'arquivo_url', type: 'text', nullable: true })
  arquivoUrl: string;

  @Column({ name: 'arquivo_nome', length: 255, nullable: true })
  arquivoNome: string;

  @Column({ name: 'arquivo_tamanho', type: 'bigint', nullable: true })
  arquivoTamanho: number;

  @Column({ type: 'jsonb', name: 'read_by', nullable: true })
  readBy: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
