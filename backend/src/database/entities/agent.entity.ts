import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Tenant } from './tenant.entity';
import { Device } from './device.entity';
import { InstallationToken } from './installation-token.entity';

export enum AgentStatus {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
  OFFLINE = 'offline',
  ONLINE = 'online',
  MANUTENCAO = 'manutencao',
}

@Entity('agents')
@Index(['tenantId', 'deviceId'], { unique: true })
export class Agent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'installation_token_id', nullable: true })
  installationTokenId: string | null;

  @Column({ name: 'agent_token_hash', type: 'text' })
  agentTokenHash: string;

  @Column({ name: 'agent_token_preview', length: 32 })
  agentTokenPreview: string;

  @Column({ type: 'enum', enum: AgentStatus, default: AgentStatus.ATIVO })
  status: AgentStatus;

  @Column({ name: 'agent_version', length: 50, nullable: true })
  agentVersion: string | null;

  @Column({ name: 'last_seen', type: 'timestamp', nullable: true })
  lastSeen: Date | null;

  @Column({ name: 'remote_status', length: 50, nullable: true })
  remoteStatus: string | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => InstallationToken, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'installation_token_id' })
  installationToken: InstallationToken | null;
}
