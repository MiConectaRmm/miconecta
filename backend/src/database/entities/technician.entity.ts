import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';

export enum TechnicianRole {
  ADMIN = 'admin',
  TECNICO = 'tecnico',
  VISUALIZADOR = 'visualizador',
}

@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 255, unique: true })
  email: string;

  @Column({ type: 'text' })
  senha: string;

  @Column({ type: 'enum', enum: TechnicianRole, default: TechnicianRole.TECNICO })
  funcao: TechnicianRole;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ type: 'timestamp', name: 'ultimo_login', nullable: true })
  ultimoLogin: Date;

  @Column({ type: 'text', name: 'avatar_url', nullable: true })
  avatarUrl: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, (tenant) => tenant.tecnicos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;
}
