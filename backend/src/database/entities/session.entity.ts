import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Technician } from './technician.entity';
import { Device } from './device.entity';

export enum SessionType {
  ACESSO_REMOTO = 'acesso_remoto',
  SCRIPT = 'script',
  DEPLOY = 'deploy',
}

@Entity('sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'technician_id' })
  technicianId: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ type: 'enum', enum: SessionType })
  tipo: SessionType;

  @Column({ length: 45, nullable: true })
  ip: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string;

  @Column({ type: 'timestamp', name: 'finalizado_em', nullable: true })
  finalizadoEm: Date;

  @Column({ type: 'int', name: 'duracao_segundos', nullable: true })
  duracaoSegundos: number;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Technician, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'technician_id' })
  technician: Technician;

  @ManyToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
