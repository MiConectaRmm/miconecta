import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Organization } from './organization.entity';
import { Technician } from './technician.entity';

export enum TenantPlano {
  BASIC = 'basic',
  PROFESSIONAL = 'professional',
  ENTERPRISE = 'enterprise',
}

export enum TenantStatus {
  ATIVO = 'ativo',
  SUSPENSO = 'suspenso',
  TRIAL = 'trial',
  CANCELADO = 'cancelado',
}

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 255, unique: true })
  slug: string;

  @Column({ length: 14, nullable: true })
  cnpj: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({ type: 'text', nullable: true })
  endereco: string;

  @Column({ name: 'contato_principal', length: 255, nullable: true })
  contatoPrincipal: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ type: 'enum', enum: TenantPlano, default: TenantPlano.BASIC })
  plano: TenantPlano;

  @Column({ type: 'enum', enum: TenantStatus, default: TenantStatus.ATIVO, name: 'status_contrato' })
  statusContrato: TenantStatus;

  @Column({ name: 'max_dispositivos', type: 'int', default: 50 })
  maxDispositivos: number;

  @Column({ name: 'max_usuarios', type: 'int', default: 10 })
  maxUsuarios: number;

  @Column({ name: 'storage_max_mb', type: 'bigint', default: 5120 })
  storageMaxMb: number;

  @Column({ name: 'storage_usado_mb', type: 'bigint', default: 0 })
  storageUsadoMb: number;

  @Column({ type: 'jsonb', nullable: true, name: 'sla_config' })
  slaConfig: Record<string, any>;

  @Column({ name: 'logo_url', type: 'text', nullable: true })
  logoUrl: string;

  @Column({ length: 50, default: 'America/Sao_Paulo' })
  timezone: string;

  @Column({ name: 'retencao_meses', type: 'int', default: 12 })
  retencaoMeses: number;

  @Column({ type: 'jsonb', nullable: true })
  configuracoes: Record<string, any>;

  @Column({ name: 'provision_token', type: 'text', nullable: true })
  provisionToken: string;

  @Column({ name: 'provision_token_expires', type: 'timestamp', nullable: true })
  provisionTokenExpires: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @OneToMany(() => Organization, (org) => org.tenant)
  organizacoes: Organization[];

  @OneToMany(() => Technician, (tech) => tech.tenant)
  tecnicos: Technician[];
}
