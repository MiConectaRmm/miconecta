import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { Organization } from './organization.entity';
import { Device } from './device.entity';
import { Technician } from './technician.entity';

export enum TicketStatus {
  ABERTO = 'aberto',
  EM_ATENDIMENTO = 'em_atendimento',
  AGUARDANDO_CLIENTE = 'aguardando_cliente',
  AGUARDANDO_TECNICO = 'aguardando_tecnico',
  RESOLVIDO = 'resolvido',
  FECHADO = 'fechado',
  CANCELADO = 'cancelado',
}

export enum TicketPrioridade {
  BAIXA = 'baixa',
  MEDIA = 'media',
  ALTA = 'alta',
  URGENTE = 'urgente',
}

export enum TicketOrigem {
  PORTAL = 'portal',
  PAINEL = 'painel',
  AGENTE = 'agente',
  ALERTA = 'alerta',
  EMAIL = 'email',
}

@Entity('tickets')
@Index(['tenantId', 'status'])
@Index(['tenantId', 'numero'])
@Index(['atribuidoA', 'status'])
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'organization_id', nullable: true })
  organizationId: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId: string;

  @Column({ type: 'int', generated: 'increment' })
  numero: number;

  @Column({ length: 500 })
  titulo: string;

  @Column({ type: 'text' })
  descricao: string;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.ABERTO })
  status: TicketStatus;

  @Column({ type: 'enum', enum: TicketPrioridade, default: TicketPrioridade.MEDIA })
  prioridade: TicketPrioridade;

  @Column({ type: 'enum', enum: TicketOrigem, default: TicketOrigem.PORTAL })
  origem: TicketOrigem;

  @Column({ name: 'categoria_id', nullable: true })
  categoriaId: string;

  @Column({ name: 'criado_por_tipo', length: 50 })
  criadoPorTipo: string;

  @Column({ name: 'criado_por_id' })
  criadoPorId: string;

  @Column({ name: 'criado_por_nome', length: 255, nullable: true })
  criadoPorNome: string;

  @Column({ name: 'atribuido_a', nullable: true })
  atribuidoA: string;

  @Column({ type: 'timestamp', name: 'sla_resposta_em', nullable: true })
  slaRespostaEm: Date;

  @Column({ type: 'timestamp', name: 'sla_resolucao_em', nullable: true })
  slaResolucaoEm: Date;

  @Column({ type: 'timestamp', name: 'respondido_em', nullable: true })
  respondidoEm: Date;

  @Column({ type: 'timestamp', name: 'resolvido_em', nullable: true })
  resolvidoEm: Date;

  @Column({ type: 'timestamp', name: 'fechado_em', nullable: true })
  fechadoEm: Date;

  @Column({ type: 'int', name: 'avaliacao_nota', nullable: true })
  avaliacaoNota: number;

  @Column({ type: 'text', name: 'avaliacao_comentario', nullable: true })
  avaliacaoComentario: string;

  @Column({ type: 'jsonb', nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

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

  @ManyToOne(() => Device, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'device_id' })
  device: Device;

  @ManyToOne(() => Technician, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'atribuido_a' })
  tecnicoAtribuido: Technician;
}
