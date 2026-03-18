import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThanOrEqual, Repository } from 'typeorm';
import { Ticket, TicketStatus, TicketPrioridade, TicketOrigem, TicketSlaStatus } from '../../database/entities/ticket.entity';
import { TicketComment, TicketCommentTipo } from '../../database/entities/ticket-comment.entity';
import { ChatMessage, ChatRemetenteTipo } from '../../database/entities/chat-message.entity';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ChatGateway } from '../chat/chat.gateway';
import { TicketIntelligenceService } from './ticket-intelligence.service';

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketComment)
    private readonly commentRepo: Repository<TicketComment>,
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    private readonly chatGateway: ChatGateway,
    private readonly intelligenceService: TicketIntelligenceService,
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
    const automacao = this.intelligenceService.aplicarRegrasAutomaticas(salvo);
    await this.ticketRepo.update(salvo.id, {
      prioridade: automacao.prioridade,
      categoriaId: automacao.categoriaId,
      atribuidoA: automacao.atribuidoA,
    } as any);

    // Calcular SLA baseado na prioridade
    const ticketAtualizado = await this.buscar(salvo.id, tenantId);
    await this.calcularSla(ticketAtualizado);

    // Registrar na timeline
    await this.adicionarComentarioSistema(salvo.id, `Ticket criado por ${criadoPor.nome}`, {
      statusAnterior: null,
      statusNovo: TicketStatus.ABERTO,
    });
    const created = await this.buscar(salvo.id, tenantId);
    this.chatGateway.emitNotification(tenantId, {
      type: 'ticket_created',
      ticketId: created.id,
      tenantId,
      timestamp: new Date(),
    });
    this.chatGateway.emitTicketUpdated(created.id, {
      ticketId: created.id,
      status: created.status,
      prioridade: created.prioridade,
      hasUnreadFromClient: false,
    });
    return created;
  }

  async sugerirIA(ticketId: string, tenantId: string) {
    const ticket = await this.buscar(ticketId, tenantId);
    const comments = await this.commentRepo.find({ where: { ticketId }, order: { criadoEm: 'ASC' } });
    const messages = await this.chatRepo.find({ where: { ticketId }, order: { criadoEm: 'ASC' } });
    return this.intelligenceService.sugerirResposta(ticket, comments, messages);
  }

  async listar(tenantId: string, filtros?: any) {
    const query = this.ticketRepo.createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.device', 'device')
      .leftJoinAndSelect('ticket.organization', 'organization')
      .leftJoinAndSelect('ticket.tecnicoAtribuido', 'tecnico')
      .where('ticket.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('ticket.status = :status', { status: this.normalizarStatus(filtros.status) });
    }
    if (filtros?.prioridade) {
      query.andWhere('ticket.prioridade = :prioridade', { prioridade: filtros.prioridade });
    }
    if (filtros?.categoriaId) {
      query.andWhere('ticket.categoriaId = :categoriaId', { categoriaId: filtros.categoriaId });
    }
    if (filtros?.atribuidoA === 'none' || filtros?.atribuidoA === 'sem_responsavel') {
      query.andWhere('ticket.atribuidoA IS NULL');
    } else if (filtros?.atribuidoA) {
      query.andWhere('ticket.atribuidoA = :atribuidoA', { atribuidoA: filtros.atribuidoA });
    }
    if (filtros?.deviceId) {
      query.andWhere('ticket.deviceId = :deviceId', { deviceId: filtros.deviceId });
    }
    if (filtros?.busca) {
      query.andWhere('(ticket.titulo ILIKE :busca OR ticket.descricao ILIKE :busca)', {
        busca: `%${filtros.busca}%`,
      });
    }

    const tickets = await query.orderBy('ticket.criadoEm', 'DESC').take(100).getMany();

    // Indicador de nova mensagem do cliente (não lida)
    if (tickets.length > 0) {
      const ids = tickets.map((t) => t.id);
      const unread = await this.chatRepo.find({
        where: {
          ticketId: In(ids),
          remetenteTipo: ChatRemetenteTipo.CLIENT_USER,
          lido: false,
        },
        select: ['ticketId'],
      });
      const unreadMap = new Set(unread.map((m) => m.ticketId));
      tickets.forEach((t) => {
        (t as any).hasUnreadFromClient = unreadMap.has(t.id);
      });
    }

    return tickets;
  }

  async buscar(id: string, tenantId: string) {
    const ticket = await this.ticketRepo.findOne({
      where: { id, tenantId },
      relations: ['device', 'organization', 'tecnicoAtribuido', 'tenant'],
    });
    if (!ticket) throw new NotFoundException('Ticket não encontrado');
    ticket.slaStatus = this.calcularStatusSla(ticket);
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

    this.chatGateway.emitTicketUpdated(id, {
      ticketId: id,
      status: TicketStatus.EM_ATENDIMENTO,
      atribuidoA: technicianId,
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

    const updated = await this.buscar(id, tenantId);
    await this.ticketRepo.update(id, { slaStatus: this.calcularStatusSla(updated) } as any);
    this.chatGateway.emitTicketUpdated(id, {
      ticketId: id,
      status: novoStatus,
    });
    return this.buscar(id, tenantId);
  }

  normalizarStatus(status: string): TicketStatus {
    const mapa: Record<string, TicketStatus> = {
      open: TicketStatus.ABERTO,
      in_progress: TicketStatus.EM_ATENDIMENTO,
      waiting_customer: TicketStatus.AGUARDANDO_CLIENTE,
      waiting_third_party: TicketStatus.AGUARDANDO_TECNICO,
      resolved: TicketStatus.RESOLVIDO,
      closed: TicketStatus.FECHADO,
      aberto: TicketStatus.ABERTO,
      em_atendimento: TicketStatus.EM_ATENDIMENTO,
      aguardando_cliente: TicketStatus.AGUARDANDO_CLIENTE,
      aguardando_tecnico: TicketStatus.AGUARDANDO_TECNICO,
      resolvido: TicketStatus.RESOLVIDO,
      fechado: TicketStatus.FECHADO,
    };
    return mapa[status] || status as TicketStatus;
  }

  async atualizarPrioridade(id: string, tenantId: string, prioridade: TicketPrioridade, autorNome: string) {
    const ticket = await this.buscar(id, tenantId);
    const prioridadeAnterior = ticket.prioridade;
    if (prioridadeAnterior === prioridade) return ticket;

    await this.ticketRepo.update(id, { prioridade });
    const updatedTicket = await this.buscar(id, tenantId);
    await this.ticketRepo.update(id, { ...this.calcularSlaFields(updatedTicket) } as any);

    await this.adicionarComentarioSistema(id, `Prioridade alterada para ${prioridade} por ${autorNome}`, {
      prioridadeAnterior,
      prioridadeNova: prioridade,
    });
    this.chatGateway.emitTicketUpdated(id, {
      ticketId: id,
      prioridade,
    });

    return this.buscar(id, tenantId);
  }

  async atualizarCategoria(id: string, tenantId: string, categoriaId: string | null, autorNome: string) {
    const ticket = await this.buscar(id, tenantId);
    const categoriaAnterior = ticket.categoriaId || null;
    if (categoriaAnterior === categoriaId) return ticket;

    await this.ticketRepo.update(id, { categoriaId: categoriaId ?? null } as any);

    await this.adicionarComentarioSistema(id, `Categoria alterada por ${autorNome}`, {
      categoriaAnterior,
      categoriaNova: categoriaId,
    });
    this.chatGateway.emitTicketUpdated(id, {
      ticketId: id,
    });

    return this.buscar(id, tenantId);
  }

  async removerAtribuicao(id: string, tenantId: string, autorNome: string) {
    const ticket = await this.buscar(id, tenantId);
    if (!ticket.atribuidoA) return ticket;

    await this.ticketRepo.update(id, { atribuidoA: null } as any);

    await this.adicionarComentarioSistema(id, `Atribuição removida por ${autorNome}`, {
      technicianIdAnterior: ticket.atribuidoA,
    });
    this.chatGateway.emitTicketUpdated(id, {
      ticketId: id,
      atribuidoA: null,
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

    const urgentes = await this.ticketRepo.count({
      where: {
        tenantId,
        prioridade: TicketPrioridade.URGENTE,
        status: In([
          TicketStatus.ABERTO,
          TicketStatus.EM_ATENDIMENTO,
          TicketStatus.AGUARDANDO_CLIENTE,
          TicketStatus.AGUARDANDO_TECNICO,
        ]),
      },
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const fechadosHoje = await this.ticketRepo.count({
      where: {
        tenantId,
        status: TicketStatus.FECHADO,
        fechadoEm: MoreThanOrEqual(hoje),
      },
    });

    const unread = await this.chatRepo
      .createQueryBuilder('msg')
      .select('COUNT(DISTINCT msg.ticketId)', 'count')
      .where('msg.lido = false')
      .andWhere('msg.remetenteTipo = :tipo', { tipo: ChatRemetenteTipo.CLIENT_USER })
      .andWhere('msg.ticketId IN ' +
        this.ticketRepo
          .createQueryBuilder('t')
          .select('t.id')
          .where('t.tenantId = :tenantId', { tenantId })
          .getQuery(),
      )
      .setParameter('tenantId', tenantId)
      .getRawOne<{ count: string }>();

    const comNovaMensagem = unread?.count ? Number(unread.count) : 0;

    return { abertos, emAtendimento, aguardando, resolvidos, total, urgentes, comNovaMensagem, fechadosHoje };
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
      slaPrimeiraRespostaEm: new Date(agora.getTime() + sla.resposta * 60 * 60 * 1000),
      slaStatus: TicketSlaStatus.DENTRO_PRAZO,
    } as any);
  }

  private calcularSlaFields(ticket: Ticket): Partial<Ticket> {
    const slaMap: Record<string, { resposta: number; resolucao: number }> = {
      urgente: { resposta: 1, resolucao: 4 },
      alta: { resposta: 2, resolucao: 8 },
      media: { resposta: 4, resolucao: 24 },
      baixa: { resposta: 8, resolucao: 72 },
    };
    const sla = slaMap[ticket.prioridade] || slaMap.media;
    const agora = new Date();
    return {
      slaRespostaEm: new Date(agora.getTime() + sla.resposta * 60 * 60 * 1000),
      slaResolucaoEm: new Date(agora.getTime() + sla.resolucao * 60 * 60 * 1000),
      slaPrimeiraRespostaEm: new Date(agora.getTime() + sla.resposta * 60 * 60 * 1000),
      slaStatus: this.calcularStatusSla({
        ...ticket,
        slaRespostaEm: new Date(agora.getTime() + sla.resposta * 60 * 60 * 1000),
        slaResolucaoEm: new Date(agora.getTime() + sla.resolucao * 60 * 60 * 1000),
        slaPrimeiraRespostaEm: new Date(agora.getTime() + sla.resposta * 60 * 60 * 1000),
      }),
    };
  }

  private calcularStatusSla(ticket: Ticket): TicketSlaStatus {
    const now = new Date();
    const due = ticket.slaResolucaoEm || ticket.slaPrimeiraRespostaEm || ticket.slaRespostaEm;
    if (!due) return TicketSlaStatus.INDEFINIDO;
    const dueTime = new Date(due).getTime();
    if (dueTime <= now.getTime()) return TicketSlaStatus.VENCIDO;
    const diffMs = dueTime - now.getTime();
    if (diffMs <= 1000 * 60 * 60 * 2) return TicketSlaStatus.EM_RISCO;
    return TicketSlaStatus.DENTRO_PRAZO;
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
