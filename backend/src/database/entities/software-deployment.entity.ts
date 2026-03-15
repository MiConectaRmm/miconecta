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
import { SoftwarePackage } from './software-package.entity';
import { Device } from './device.entity';

export enum DeploymentStatus {
  PENDENTE = 'pendente',
  BAIXANDO = 'baixando',
  INSTALANDO = 'instalando',
  SUCESSO = 'sucesso',
  ERRO = 'erro',
  CANCELADO = 'cancelado',
}

@Entity('software_deployments')
@Index(['deviceId', 'criadoEm'])
export class SoftwareDeployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'package_id' })
  packageId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'solicitado_por', length: 255 })
  solicitadoPor: string;

  @Column({
    type: 'enum',
    enum: DeploymentStatus,
    default: DeploymentStatus.PENDENTE,
  })
  status: DeploymentStatus;

  @Column({ type: 'text', nullable: true })
  log: string;

  @Column({ type: 'int', name: 'codigo_saida', nullable: true })
  codigoSaida: number;

  @Column({ type: 'timestamp', name: 'iniciado_em', nullable: true })
  iniciadoEm: Date;

  @Column({ type: 'timestamp', name: 'finalizado_em', nullable: true })
  finalizadoEm: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => SoftwarePackage, (pkg) => pkg.deployments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'package_id' })
  softwarePackage: SoftwarePackage;

  @ManyToOne(() => Device, (device) => device.deployments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
