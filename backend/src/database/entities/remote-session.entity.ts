import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Ticket } from './ticket.entity';
import { Device } from './device.entity';
import { Technician } from './technician.entity';

export enum RemoteSessionStatus {
  SOLICITADA = 'solicitada',
  CONSENTIMENTO_PENDENTE = 'consentimento_pendente',
  CONSENTIDA = 'consentida',
  RECUSADA = 'recusada',
  ATIVA = 'ativa',
  FINALIZADA = 'finalizada',
  EXPIRADA = 'expirada',
  TIMEOUT_CONSENTIMENTO = 'timeout_consentimento',
  ERRO = 'erro',
}

export enum DevicePolicyType {
  SERVIDOR = 'servidor',
  ESTACAO = 'estacao',
}

@Entity('remote_sessions')
@Index(['tenantId', 'deviceId'])
@Index(['technicianId'])
export class RemoteSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'ticket_id', nullable: true })
  ticketId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'technician_id' })
  technicianId: string;

  @Column({ name: 'rustdesk_session_id', length: 255, nullable: true })
  rustdeskSessionId: string;

  @Column({ type: 'enum', enum: RemoteSessionStatus, default: RemoteSessionStatus.SOLICITADA })
  status: RemoteSessionStatus;

  @Column({ type: 'text', nullable: true })
  motivo: string;

  @Column({ name: 'consentido_por', length: 255, nullable: true })
  consentidoPor: string;

  @Column({ name: 'consentido_em', type: 'timestamp', nullable: true })
  consentidoEm: Date;

  @Column({ name: 'iniciada_em', type: 'timestamp', nullable: true })
  iniciadaEm: Date;

  @Column({ name: 'finalizada_em', type: 'timestamp', nullable: true })
  finalizadaEm: Date;

  @Column({ name: 'duracao_segundos', type: 'int', nullable: true })
  duracaoSegundos: number;

  @Column({ name: 'ip_tecnico', length: 45, nullable: true })
  ipTecnico: string;

  @Column({ name: 'ip_dispositivo', length: 45, nullable: true })
  ipDispositivo: string;

  @Column({ type: 'text', nullable: true })
  resumo: string;

  // ── Gravação ──
  @Column({ name: 'gravacao_solicitada', default: false })
  gravacaoSolicitada: boolean;

  @Column({ name: 'gravacao_url', type: 'text', nullable: true })
  gravacaoUrl: string;

  @Column({ name: 'gravacao_tamanho', type: 'bigint', nullable: true })
  gravacaoTamanho: number;

  // ── Política aplicada ──
  @Column({ name: 'policy_tipo', type: 'varchar', length: 50, nullable: true })
  policyTipo: string;

  @Column({ name: 'consentimento_exigido', default: true })
  consentimentoExigido: boolean;

  @Column({ name: 'consentimento_timeout', type: 'int', default: 120 })
  consentimentoTimeout: number;

  // ── Expiração ──
  @Column({ name: 'expira_em', type: 'timestamp', nullable: true })
  expiraEm: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Ticket, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'ticket_id' })
  ticket: Ticket;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => Technician, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician;
}
