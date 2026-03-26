import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { ConversationParticipant } from './conversation-participant.entity';
import { ConversationMessage } from './conversation-message.entity';

export enum ConversationType {
  SUPPORT = 'support',
  DEVICE = 'device',
  INTERNAL = 'internal',
}

export enum ConversationStatus {
  OPEN = 'open',
  CLOSED = 'closed',
  ARCHIVED = 'archived',
}

@Entity('conversations')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'enum', enum: ConversationType, default: ConversationType.SUPPORT })
  type: ConversationType;

  @Column({ type: 'enum', enum: ConversationStatus, default: ConversationStatus.OPEN })
  status: ConversationStatus;

  @Column({ length: 500, nullable: true })
  titulo: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ name: 'last_message_at', type: 'timestamp', nullable: true })
  lastMessageAt: Date;

  @Column({ name: 'last_message_preview', type: 'text', nullable: true })
  lastMessagePreview: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => ConversationParticipant, (p) => p.conversation)
  participants: ConversationParticipant[];

  @OneToMany(() => ConversationMessage, (m) => m.conversation)
  messages: ConversationMessage[];
}
