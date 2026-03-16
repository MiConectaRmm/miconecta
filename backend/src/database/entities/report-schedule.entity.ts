import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ReportTipo {
  EXECUTIVO = 'executivo',
  TECNICO = 'tecnico',
  SLA = 'sla',
  INVENTARIO = 'inventario',
  ALERTAS = 'alertas',
  DISPONIBILIDADE = 'disponibilidade',
}

export enum ReportFrequencia {
  MANUAL = 'manual',
  DIARIO = 'diario',
  SEMANAL = 'semanal',
  MENSAL = 'mensal',
}

@Entity('report_schedules')
@Index(['tenantId', 'ativo'])
export class ReportSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'enum', enum: ReportTipo })
  tipo: ReportTipo;

  @Column({ length: 500 })
  nome: string;

  @Column({ type: 'enum', enum: ReportFrequencia, default: ReportFrequencia.MANUAL })
  frequencia: ReportFrequencia;

  @Column({ default: true })
  ativo: boolean;

  @Column({ name: 'destinatarios_email', type: 'jsonb', nullable: true })
  destinatariosEmail: string[];

  @Column({ name: 'ultimo_envio', type: 'timestamp', nullable: true })
  ultimoEnvio: Date;

  @Column({ name: 'resultado_url', type: 'text', nullable: true })
  resultadoUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  parametros: Record<string, any>;

  @Column({ name: 'criado_por', nullable: true })
  criadoPor: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
