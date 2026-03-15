import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';
import { Tenant } from './tenant.entity';

export enum AlertSeverity {
  INFO = 'info',
  AVISO = 'aviso',
  CRITICO = 'critico',
  EMERGENCIA = 'emergencia',
}

export enum AlertStatus {
  ATIVO = 'ativo',
  RECONHECIDO = 'reconhecido',
  RESOLVIDO = 'resolvido',
}

export enum AlertType {
  CPU_ALTA = 'cpu_alta',
  RAM_ALTA = 'ram_alta',
  DISCO_BAIXO = 'disco_baixo',
  OFFLINE = 'offline',
  SERVICO_FALHA = 'servico_falha',
  ANTIVIRUS = 'antivirus',
  UPDATE_PENDENTE = 'update_pendente',
  CUSTOM = 'custom',
}

@Entity('alerts')
@Index(['tenantId', 'status'])
@Index(['deviceId', 'criadoEm'])
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ type: 'enum', enum: AlertType })
  tipo: AlertType;

  @Column({ type: 'enum', enum: AlertSeverity, default: AlertSeverity.AVISO })
  severidade: AlertSeverity;

  @Column({ type: 'enum', enum: AlertStatus, default: AlertStatus.ATIVO })
  status: AlertStatus;

  @Column({ length: 500 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  valor: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  limite: number;

  @Column({ default: false, name: 'email_enviado' })
  emailEnviado: boolean;

  @Column({ type: 'timestamp', name: 'reconhecido_em', nullable: true })
  reconhecidoEm: Date;

  @Column({ length: 255, name: 'reconhecido_por', nullable: true })
  reconhecidoPor: string;

  @Column({ type: 'timestamp', name: 'resolvido_em', nullable: true })
  resolvidoEm: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Device, (device) => device.alertas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
