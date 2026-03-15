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

@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 255, unique: true })
  slug: string;

  @Column({ length: 255, nullable: true })
  email: string;

  @Column({ length: 20, nullable: true })
  telefone: string;

  @Column({ type: 'text', nullable: true })
  endereco: string;

  @Column({ default: true })
  ativo: boolean;

  @Column({ type: 'jsonb', nullable: true })
  configuracoes: Record<string, any>;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @OneToMany(() => Organization, (org) => org.tenant)
  organizacoes: Organization[];

  @OneToMany(() => Technician, (tech) => tech.tenant)
  tecnicos: Technician[];
}
