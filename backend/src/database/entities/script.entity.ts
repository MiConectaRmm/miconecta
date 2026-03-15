import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { ScriptExecution } from './script-execution.entity';

export enum ScriptType {
  POWERSHELL = 'powershell',
  CMD = 'cmd',
  BATCH = 'batch',
}

@Entity('scripts')
export class Script {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'enum', enum: ScriptType, default: ScriptType.POWERSHELL })
  tipo: ScriptType;

  @Column({ type: 'text' })
  conteudo: string;

  @Column({ default: false })
  global: boolean;

  @Column({ type: 'jsonb', nullable: true })
  parametros: Record<string, any>;

  @Column({ type: 'int', name: 'timeout_segundos', default: 300 })
  timeoutSegundos: number;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => ScriptExecution, (exec) => exec.script)
  execucoes: ScriptExecution[];
}
