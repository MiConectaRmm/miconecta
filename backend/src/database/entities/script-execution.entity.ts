import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Script } from './script.entity';
import { Device } from './device.entity';

export enum ExecutionStatus {
  PENDENTE = 'pendente',
  EXECUTANDO = 'executando',
  SUCESSO = 'sucesso',
  ERRO = 'erro',
  TIMEOUT = 'timeout',
  CANCELADO = 'cancelado',
}

@Entity('script_executions')
@Index(['deviceId', 'criadoEm'])
export class ScriptExecution {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'script_id' })
  scriptId: string;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column({ name: 'executado_por', length: 255 })
  executadoPor: string;

  @Column({
    type: 'enum',
    enum: ExecutionStatus,
    default: ExecutionStatus.PENDENTE,
  })
  status: ExecutionStatus;

  @Column({ type: 'text', nullable: true })
  saida: string;

  @Column({ type: 'text', name: 'saida_erro', nullable: true })
  saidaErro: string;

  @Column({ type: 'int', name: 'codigo_saida', nullable: true })
  codigoSaida: number;

  @Column({ type: 'timestamp', name: 'iniciado_em', nullable: true })
  iniciadoEm: Date;

  @Column({ type: 'timestamp', name: 'finalizado_em', nullable: true })
  finalizadoEm: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @ManyToOne(() => Script, (script) => script.execucoes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'script_id' })
  script: Script;

  @ManyToOne(() => Device, (device) => device.execucoes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'device_id' })
  device: Device;
}
