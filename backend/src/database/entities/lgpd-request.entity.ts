import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum LgpdRequestTipo {
  EXPORTACAO_DADOS = 'exportacao_dados',
  EXCLUSAO_DADOS = 'exclusao_dados',
  REVOGACAO_CONSENTIMENTO = 'revogacao_consentimento',
  CONSULTA_DADOS = 'consulta_dados',
}

export enum LgpdRequestStatus {
  PENDENTE = 'pendente',
  EM_PROCESSAMENTO = 'em_processamento',
  CONCLUIDA = 'concluida',
  REJEITADA = 'rejeitada',
}

@Entity('lgpd_requests')
@Index(['tenantId', 'status'])
export class LgpdRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ type: 'enum', enum: LgpdRequestTipo })
  tipo: LgpdRequestTipo;

  @Column({ type: 'enum', enum: LgpdRequestStatus, default: LgpdRequestStatus.PENDENTE })
  status: LgpdRequestStatus;

  @Column({ name: 'solicitante_tipo', length: 50 })
  solicitanteTipo: string;

  @Column({ name: 'solicitante_id' })
  solicitanteId: string;

  @Column({ name: 'solicitante_nome', length: 255 })
  solicitanteNome: string;

  @Column({ name: 'solicitante_email', length: 255 })
  solicitanteEmail: string;

  @Column({ type: 'text', nullable: true })
  justificativa: string;

  @Column({ name: 'resultado_url', type: 'text', nullable: true })
  resultadoUrl: string;

  @Column({ name: 'processado_por', nullable: true })
  processadoPor: string;

  @Column({ name: 'processado_em', type: 'timestamp', nullable: true })
  processadoEm: Date;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;
}
