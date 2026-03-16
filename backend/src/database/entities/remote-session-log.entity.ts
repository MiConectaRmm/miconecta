import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { RemoteSession } from './remote-session.entity';

export enum RemoteSessionLogTipo {
  COMANDO = 'comando',
  PROCESSO = 'processo',
  ARQUIVO_TRANSFERIDO = 'arquivo_transferido',
  SCREENSHOT = 'screenshot',
  CLIPBOARD = 'clipboard',
  REGISTRO = 'registro',
  OUTRO = 'outro',
}

@Entity('remote_session_logs')
@Index(['sessionId', 'timestamp'])
export class RemoteSessionLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'session_id' })
  sessionId: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @Column({ type: 'enum', enum: RemoteSessionLogTipo })
  tipo: RemoteSessionLogTipo;

  @Column({ type: 'text' })
  descricao: string;

  @Column({ type: 'jsonb', nullable: true })
  detalhes: Record<string, any>;

  @Column({ name: 'arquivo_url', type: 'text', nullable: true })
  arquivoUrl: string;

  @ManyToOne(() => RemoteSession, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: RemoteSession;
}
