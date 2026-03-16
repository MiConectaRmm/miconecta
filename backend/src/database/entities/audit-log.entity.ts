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
@Index(['correlationId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ name: 'correlation_id', nullable: true })
  correlationId: string;

  @Column({ name: 'autor_tipo', length: 50, nullable: true })
  autorTipo: string;

  @Column({ name: 'usuario_id', nullable: true })
  usuarioId: string;

  @Column({ name: 'usuario_nome', length: 255, nullable: true })
  usuarioNome: string;

  @Column({ name: 'usuario_email', length: 255, nullable: true })
  usuarioEmail: string;

  @Column({ name: 'usuario_role', length: 50, nullable: true })
  usuarioRole: string;

  @Column({ length: 100 })
  acao: string;

  @Column({ length: 100, nullable: true })
  recurso: string;

  @Column({ name: 'recurso_id', nullable: true })
  recursoId: string;

  @Column({ name: 'recurso_descricao', length: 500, nullable: true })
  recursoDescricao: string;

  @Column({ type: 'jsonb', name: 'dados_anteriores', nullable: true })
  dadosAnteriores: Record<string, any>;

  @Column({ type: 'jsonb', name: 'dados_novos', nullable: true })
  dadosNovos: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  detalhes: Record<string, any>;

  @Column({ length: 45, nullable: true })
  ip: string;

  @Column({ type: 'text', name: 'user_agent', nullable: true })
  userAgent: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
