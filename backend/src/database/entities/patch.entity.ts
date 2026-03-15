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

export enum PatchStatus {
  PENDENTE = 'pendente',
  INSTALANDO = 'instalando',
  INSTALADO = 'instalado',
  FALHA = 'falha',
  AGENDADO = 'agendado',
}

export enum PatchSeverity {
  CRITICO = 'critico',
  IMPORTANTE = 'importante',
  MODERADO = 'moderado',
  BAIXO = 'baixo',
}

@Entity('patches')
@Index(['deviceId', 'status'])
export class Patch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ length: 50, name: 'kb_id', nullable: true })
  kbId: string;

  @Column({ length: 500 })
  titulo: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'enum', enum: PatchSeverity, default: PatchSeverity.MODERADO })
  severidade: PatchSeverity;

  @Column({ type: 'enum', enum: PatchStatus, default: PatchStatus.PENDENTE })
  status: PatchStatus;

  @Column({ type: 'bigint', name: 'tamanho_bytes', nullable: true })
  tamanhoBytes: number;

  @Column({ type: 'timestamp', name: 'agendado_para', nullable: true })
  agendadoPara: Date;

  @Column({ type: 'timestamp', name: 'instalado_em', nullable: true })
  instaladoEm: Date;

  @Column({ default: false, name: 'requer_reinicio' })
  requerReinicio: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
