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

@Entity('device_inventory')
@Index(['deviceId'])
export class DeviceInventory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ length: 500 })
  nome: string;

  @Column({ length: 255, nullable: true })
  versao: string;

  @Column({ length: 255, nullable: true })
  fabricante: string;

  @Column({ length: 255, nullable: true })
  tamanho: string;

  @Column({ type: 'timestamp', name: 'data_instalacao', nullable: true })
  dataInstalacao: Date;

  @Column({ length: 50, default: 'software' })
  tipo: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Device, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
