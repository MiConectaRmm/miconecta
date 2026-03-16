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
import { Tenant } from './tenant.entity';
import { Organization } from './organization.entity';

export enum ClientUserRole {
  ADMIN_CLIENTE = 'admin_cliente',
  GESTOR = 'gestor',
  USUARIO = 'usuario',
}

@Entity('client_users')
@Index(['tenantId', 'email'], { unique: true })
export class ClientUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 255 })
  email: string;

  @Column({ type: 'text' })
  senha: string;

  @Column({ type: 'enum', enum: ClientUserRole, default: ClientUserRole.USUARIO })
  funcao: ClientUserRole;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({ length: 255, nullable: true })
  cargo: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ name: 'email_verificado', default: false })
  emailVerificado: boolean;

  @Column({ type: 'timestamp', name: 'ultimo_login', nullable: true })
  ultimoLogin: Date;

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @Column({ type: 'jsonb', nullable: true })
  preferencias: Record<string, any>;

  @Column({ type: 'timestamp', name: 'termos_aceitos_em', nullable: true })
  termosAceitosEm: Date;

  @Column({ type: 'text', name: 'invite_token', nullable: true })
  inviteToken: string;

  @Column({ type: 'timestamp', name: 'invite_expires_at', nullable: true })
  inviteExpiresAt: Date;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @ManyToOne(() => Organization, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
