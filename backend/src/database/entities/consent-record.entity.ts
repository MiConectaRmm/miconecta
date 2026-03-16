import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Device } from './device.entity';
import { RemoteSession } from './remote-session.entity';

export enum ConsentTipo {
  ACESSO_REMOTO = 'acesso_remoto',
  COLETA_DADOS = 'coleta_dados',
  TERMOS_USO = 'termos_uso',
  POLITICA_PRIVACIDADE = 'politica_privacidade',
}

@Entity('consent_records')
@Index(['tenantId', 'tipo', 'criadoEm'])
export class ConsentRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'enum', enum: ConsentTipo })
  tipo: ConsentTipo;

  @Column({ name: 'concedente_tipo', length: 50 })
  concedenteTipo: string;

  @Column({ name: 'concedente_id', nullable: true })
  concedenteId: string;

  @Column({ name: 'concedente_nome', length: 255 })
  concedenteNome: string;

  @Column({ name: 'concedente_ip', length: 45, nullable: true })
  concedenteIp: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ name: 'session_id', nullable: true })
  sessionId: string;

  @Column({ default: true })
  consentido: boolean;

  @Column({ name: 'versao_termos', length: 50, nullable: true })
  versaoTermos: string;

  @Column({ type: 'jsonb', nullable: true })
  detalhes: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => RemoteSession, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'session_id' })
  session: RemoteSession;
}
