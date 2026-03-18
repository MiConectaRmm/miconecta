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
import { Organization } from './organization.entity';
import { DeviceMetric } from './device-metric.entity';
import { Alert } from './alert.entity';
import { ScriptExecution } from './script-execution.entity';
import { SoftwareDeployment } from './software-deployment.entity';

export enum DeviceStatus {
  ONLINE = 'online',
  OFFLINE = 'offline',
  ALERTA = 'alerta',
  MANUTENCAO = 'manutencao',
}

@Entity('devices')
@Index(['tenantId', 'hostname'])
export class Device {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ length: 255 })
  hostname: string;

  @Column({ length: 255, nullable: true })
  dominio: string;

  @Column({ length: 100, name: 'rustdesk_id', nullable: true })
  rustdeskId: string;

  @Column({ length: 45, name: 'ip_local', nullable: true })
  ipLocal: string;

  @Column({ length: 45, name: 'ip_externo', nullable: true })
  ipExterno: string;

  @Column({
    type: 'enum',
    enum: DeviceStatus,
    default: DeviceStatus.OFFLINE,
  })
  status: DeviceStatus;

  @Column({ length: 255, name: 'sistema_operacional', nullable: true })
  sistemaOperacional: string;

  @Column({ length: 255, name: 'versao_windows', nullable: true })
  versaoWindows: string;

  @Column({ length: 255, nullable: true })
  cpu: string;

  @Column({ type: 'bigint', name: 'ram_total_mb', nullable: true })
  ramTotalMb: number;

  @Column({ type: 'bigint', name: 'disco_total_mb', nullable: true })
  discoTotalMb: number;

  @Column({ type: 'bigint', name: 'disco_disponivel_mb', nullable: true })
  discoDisponivelMb: number;

  @Column({ length: 100, name: 'modelo_maquina', nullable: true })
  modeloMaquina: string;

  @Column({ length: 100, name: 'numero_serie', nullable: true })
  numeroSerie: string;

  @Column({ length: 50, name: 'agent_version', nullable: true })
  agentVersion: string;

  @Column({ name: 'agent_id', type: 'uuid', nullable: true })
  agentId: string | null;

  @Column({ name: 'last_checkin', type: 'timestamp', nullable: true })
  lastCheckin: Date | null;

  @Column({ length: 255, name: 'antivirus_status', nullable: true })
  antivirusStatus: string;

  @Column({ length: 255, name: 'antivirus_nome', nullable: true })
  antivirusNome: string;

  @Column({ type: 'int', nullable: true })
  uptime_segundos: number;

  @Column({ type: 'timestamp', name: 'last_seen', nullable: true })
  lastSeen: Date;

  @Column({ type: 'text', name: 'device_token', nullable: true })
  deviceToken: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  notas: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Organization, (org) => org.dispositivos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => DeviceMetric, (metric) => metric.device)
  metricas: DeviceMetric[];

  @OneToMany(() => Alert, (alert) => alert.device)
  alertas: Alert[];

  @OneToMany(() => ScriptExecution, (exec) => exec.device)
  execucoes: ScriptExecution[];

  @OneToMany(() => SoftwareDeployment, (deploy) => deploy.device)
  deployments: SoftwareDeployment[];
}
