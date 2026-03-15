import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Device } from './device.entity';

@Entity('device_metrics')
@Index(['deviceId', 'criadoEm'])
export class DeviceMetric {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'cpu_percent' })
  cpuPercent: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'ram_percent' })
  ramPercent: number;

  @Column({ type: 'bigint', name: 'ram_usada_mb' })
  ramUsadaMb: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, name: 'disco_percent' })
  discoPercent: number;

  @Column({ type: 'bigint', name: 'disco_usado_mb', nullable: true })
  discoUsadoMb: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  temperatura: number;

  @Column({ type: 'bigint', name: 'rede_entrada_bytes', nullable: true })
  redeEntradaBytes: number;

  @Column({ type: 'bigint', name: 'rede_saida_bytes', nullable: true })
  redeSaidaBytes: number;

  @Column({ type: 'int', name: 'uptime_segundos', nullable: true })
  uptimeSegundos: number;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Device, (device) => device.metricas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
