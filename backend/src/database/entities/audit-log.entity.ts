import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('audit_logs')
@Index(['tenantId', 'criadoEm'])
@Index(['acao'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'usuario_id', nullable: true })
  usuarioId: string;

  @Column({ name: 'usuario_nome', length: 255, nullable: true })
  usuarioNome: string;

  @Column({ length: 100 })
  acao: string;

  @Column({ length: 100, nullable: true })
  recurso: string;

  @Column({ name: 'recurso_id', nullable: true })
  recursoId: string;

  @Column({ type: 'jsonb', nullable: true })
  detalhes: Record<string, any>;

  @Column({ length: 45, nullable: true })
  ip: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
