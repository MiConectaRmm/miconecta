import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Tenant } from './tenant.entity';

export enum InstallationTokenStatus {
  ATIVO = 'ativo',
  INATIVO = 'inativo',
  EXPIRADO = 'expirado',
}

@Entity('installation_tokens')
@Index(['tenantId', 'status'])
export class InstallationToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ name: 'token_preview', length: 32 })
  tokenPreview: string;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'enum', enum: InstallationTokenStatus, default: InstallationTokenStatus.ATIVO })
  status: InstallationTokenStatus;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
