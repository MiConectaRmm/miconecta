import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketPrioridade, TicketOrigem } from '../../database/entities/ticket.entity';
import { TicketComment, TicketCommentTipo } from '../../database/entities/ticket-comment.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketComment)
    private readonly commentRepo: Repository<TicketComment>,
  ) {}

  async criar(tenantId: string, dto: CreateTicketDto, criadoPor: { id: string; nome: string; tipo: string }) {
    const ticket = this.ticketRepo.create({
      tenantId,
      titulo: dto.titulo,
      descricao: dto.descricao,
      prioridade: dto.prioridade || TicketPrioridade.MEDIA,
      origem: dto.origem || TicketOrigem.PORTAL,
      deviceId: dto.deviceId,
      organizationId: dto.organizationId,
      categoriaId: dto.categoriaId,
      criadoPorTipo: criadoPor.tipo,
      criadoPorId: criadoPor.id,
      criadoPorNome: criadoPor.nome,
      status: TicketStatus.ABERTO,
    });

    const salvo = await this.ticketRepo.save(ticket);

    // Calcular SLA baseado na prioridade
    await this.calcularSla(salvo);

    // Registrar na timeline
    await this.adicionarComentarioSistema(salvo.id, `Ticket criado por ${criadoPor.nome}`, {
      statusAnterior: null,
      statusNovo: TicketStatus.ABERTO,
    });

    return this.buscar(salvo.id, tenantId);
  }

  async listar(tenantId: string, filtros?: any) {
    const query = this.ticketRepo.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.device', 'device')
      .leftJoinAndSelect('ticket.organization', 'organization')
      .leftJoinAndSelect('ticket.tecnicoAtribuido', 'tecnico')
      .where('ticket.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('ticket.status = :status', { status: filtros.status });
    }
    if (filtros?.prioridade) {
      query.andWhere('ticket.prioridade = :prioridade', { prioridade: filtros.prioridade });
    }
    if (filtros?.atribuidoA) {
      query.andWhere('ticket.atribuidoA = :atribuidoA', { atribuidoA: filtros.atribuidoA });
    }
    if (filtros?.deviceId) {
      query.andWhere('ticket.deviceId = :deviceId', { deviceId: filtros.deviceId });
    }

    return query.orderBy('ticket.criadoEm', 'DESC').take(100).getMany();
  }

  async buscar(id: string, tenantId: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id, tenantId },
      relations: ['device', 'organization', 'tecnicoAtribuido', 'tenant'],
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    return ticket;
  }

  async timeline(ticketId: string, tenantId: string) {
    // Verificar acesso
    await this.buscar(ticketId, tenantId);

    const comments = await this.commentRepo.find({
      where: { ticketId },
      order: { criadoEm: 'ASC' },
    });

    return comments;
  }

  async atribuir(id: string, tenantId: string, technicianId: string, technicianNome: string) {
    const ticket = await this.buscar(id, tenantId);
    const statusAnterior = ticket.status;

    await this.ticketRepo.update(id, {
      atribuidoA: technicianId,
      status: TicketStatus.EM_ATENDIMENTO,
    });

    await this.adicionarComentarioSistema(id, `Ticket atribuído a ${technicianNome}`, {
      statusAnterior,
      statusNovo: TicketStatus.EM_ATENDIMENTO,
      technicianId,
    });

    return this.buscar(id, tenantId);
  }

  async atualizarStatus(id: string, tenantId: string, novoStatus: TicketStatus, autorNome: string) {
    const ticket = await this.buscar(id, tenantId);
    const statusAnterior = ticket.status;

    const updateData: Partial<Ticket> = { status: novoStatus };
    if (novoStatus === TicketStatus.RESOLVIDO) updateData.resolvidoEm = new Date();
    if (novoStatus === TicketStatus.FECHADO) updateData.fechadoEm = new Date();

    await this.ticketRepo.update(id, updateData);

    await this.adicionarComentarioSistema(id, `Status alterado para ${novoStatus} por ${autorNome}`, {
      statusAnterior,
      statusNovo: novoStatus,
    });

    return this.buscar(id, tenantId);
  }

  async adicionarComentario(
    ticketId: string,
    tenantId: string,
    dados: { conteudo: string; autorId: string; autorNome: string; autorTipo: string; visivelCliente?: boolean },
  ) {
    await this.buscar(ticketId, tenantId);

    const comment = this.commentRepo.create({
      ticketId,
      autorId: dados.autorId,
      autorNome: dados.autorNome,
      autorTipo: dados.autorTipo,
      tipo: dados.visivelCliente === false ? TicketCommentTipo.NOTA_INTERNA : TicketCommentTipo.MENSAGEM,
      conteudo: dados.conteudo,
      visivelCliente: dados.visivelCliente !== false,
    });

    return this.commentRepo.save(comment);
  }

  async avaliar(id: string, tenantId: string, nota: number, comentario?: string) {
    await this.buscar(id, tenantId);
    await this.ticketRepo.update(id, {
      avaliacaoNota: nota,
      avaliacaoComentario: comentario,
    });

    await this.adicionarComentarioSistema(id, `Avaliação: ${nota}/5${comentario ? ' - ' + comentario : ''}`, {
      nota,
      comentario,
    });

    return this.buscar(id, tenantId);
  }

  async contagem(tenantId: string) {
    const abertos = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.ABERTO } });
    const emAtendimento = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.EM_ATENDIMENTO } });
    const aguardando = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.AGUARDANDO_CLIENTE } });
    const resolvidos = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.RESOLVIDO } });
    const total = await this.ticketRepo.count({ where: { tenantId } });

    return { abertos, emAtendimento, aguardando, resolvidos, total };
  }

  private async calcularSla(ticket: Ticket) {
    // SLA padrão por prioridade (em horas): resposta / resolução
    const slaMap: Record<string, { resposta: number; resolucao: number }> = {
      urgente: { resposta: 1, resolucao: 4 },
      alta: { resposta: 2, resolucao: 8 },
      media: { resposta: 4, resolucao: 24 },
      baixa: { resposta: 8, resolucao: 72 },
    };

    const sla = slaMap[ticket.prioridade] || slaMap.media;
    const agora = new Date();

    await this.ticketRepo.update(ticket.id, {
      slaRespostaEm: new Date(agora.getTime() + sla.resposta * 60 * 60 * 1000),
      slaResolucaoEm: new Date(agora.getTime() + sla.resolucao * 60 * 60 * 1000),
    });
  }

  private async adicionarComentarioSistema(ticketId: string, conteudo: string, metadata?: Record<string, any>) {
    const comment = this.commentRepo.create({
      ticketId,
      autorTipo: 'system',
      autorNome: 'Sistema',
      tipo: TicketCommentTipo.MUDANCA_STATUS,
      conteudo,
      visivelCliente: true,
      metadata,
    });
    return this.commentRepo.save(comment);
  }
}
