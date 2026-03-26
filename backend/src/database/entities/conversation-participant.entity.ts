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

export enum ParticipantRole {
  TECHNICIAN = 'technician',
  CLIENT = 'client',
  SYSTEM = 'system',
}

@Entity('conversation_participants')
@Index(['conversationId', 'userId'], { unique: false })
@Index(['conversationId', 'deviceId'], { unique: false })
export class ConversationParticipant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'conversation_id' })
  conversationId: string;

  @Column({ name: 'user_id', nullable: true })
  userId: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ name: 'participant_name', length: 255 })
  participantName: string;

  @Column({ type: 'enum', enum: ParticipantRole })
  role: ParticipantRole;

  @Column({ name: 'last_read_at', type: 'timestamp', nullable: true })
  lastReadAt: Date;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;

  @ManyToOne(() => Conversation, (c) => c.participants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversation_id' })
  conversation: Conversation;
}
