import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { TicketComment, TicketCommentTipo } from '../../database/entities/ticket-comment.entity';
import { ChatMessage, ChatMessageTipo } from '../../database/entities/chat-message.entity';
import { RemoteSession, RemoteSessionStatus } from '../../database/entities/remote-session.entity';
import { TimelineEventDto, TimelineEventType, TicketResumoDto } from './dto/timeline-event.dto';

@Injectable()
export class UnifiedTimelineService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(TicketComment)
    private readonly commentRepo: Repository<TicketComment>,
    @InjectRepository(ChatMessage)
    private readonly chatRepo: Repository<ChatMessage>,
    @InjectRepository(RemoteSession)
    private readonly sessionRepo: Repository<RemoteSession>,
  ) {}

  /**
   * Retorna a timeline unificada de um ticket.
   * Merge cronológico de: TicketComments + ChatMessages + RemoteSessions
   * Filtro de visibilidade: notas internas ocultadas para clientes.
   */
  async getTimeline(
    ticketId: string,
    options?: { visivelCliente?: boolean; limit?: number; offset?: number },
  ): Promise<TimelineEventDto[]> {
    const [comments, messages, sessions] = await Promise.all([
      this.getCommentEvents(ticketId, options?.visivelCliente),
      this.getChatEvents(ticketId),
      this.getSessionEvents(ticketId),
    ]);

    const timeline = [...comments, ...messages, ...sessions];

    // Ordenar cronologicamente
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Paginação
    const offset = options?.offset || 0;
    const limit = options?.limit || 500;
    return timeline.slice(offset, offset + limit);
  }

  /**
   * Gera o resumo automático de um atendimento ao fechar/resolver.
   */
  async gerarResumo(ticketId: string, tenantId: string): Promise<TicketResumoDto> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, tenantId },
      relations: ['device', 'tecnicoAtribuido'],
    });
    if (!ticket) throw new Error('Ticket não encontrado');

    const [comments, messages, sessions] = await Promise.all([
      this.commentRepo.find({ where: { ticketId } }),
      this.chatRepo.find({ where: { ticketId } }),
      this.sessionRepo.find({ where: { ticketId } }),
    ]);

    // Contagens
    const totalMensagensChat = messages.length;
    const totalNotasInternas = comments.filter(c => c.tipo === TicketCommentTipo.NOTA_INTERNA).length;
    const totalSessoesRemotas = sessions.length;
    const totalScriptsExecutados = comments.filter(c => c.tipo === TicketCommentTipo.SCRIPT_EXECUTADO).length;
    const totalAnexos = comments.filter(c => c.tipo === TicketCommentTipo.ANEXO).length
      + messages.filter(m => m.tipo === ChatMessageTipo.ARQUIVO || m.tipo === ChatMessageTipo.IMAGEM).length;

    // Duração
    const criadoEm = new Date(ticket.criadoEm);
    const fimEm = ticket.fechadoEm || ticket.resolvidoEm || new Date();
    const duracaoMinutos = Math.round((new Date(fimEm).getTime() - criadoEm.getTime()) / 60000);

    // Tempo de resposta (primeira mensagem de técnico ou primeiro comentário)
    const primeiraResposta = this.calcularTempoResposta(ticket, comments, messages);

    // SLA
    const slaRespostaCumprido = ticket.slaRespostaEm && ticket.respondidoEm
      ? new Date(ticket.respondidoEm) <= new Date(ticket.slaRespostaEm) : null;
    const slaResolucaoCumprido = ticket.slaResolucaoEm && ticket.resolvidoEm
      ? new Date(ticket.resolvidoEm) <= new Date(ticket.slaResolucaoEm) : null;

    // Participantes
    const participantesMap = new Map<string, { nome: string; tipo: string; mensagens: number }>();
    for (const msg of messages) {
      const key = msg.remetenteId || msg.remetenteNome;
      const existing = participantesMap.get(key);
      if (existing) {
        existing.mensagens++;
      } else {
        participantesMap.set(key, {
          nome: msg.remetenteNome,
          tipo: msg.remetenteTipo,
          mensagens: 1,
        });
      }
    }
    for (const c of comments.filter(c => c.autorTipo !== 'system')) {
      const key = c.autorId || c.autorNome;
      const existing = participantesMap.get(key);
      if (existing) {
        existing.mensagens++;
      } else {
        participantesMap.set(key, {
          nome: c.autorNome || 'Desconhecido',
          tipo: c.autorTipo,
          mensagens: 1,
        });
      }
    }

    // Gerar texto de resumo
    const resumoTexto = this.gerarTextoResumo(
      ticket, duracaoMinutos, totalMensagensChat, totalSessoesRemotas,
      totalScriptsExecutados, sessions, Array.from(participantesMap.values()),
    );

    return {
      ticketId: ticket.id,
      numero: ticket.numero,
      titulo: ticket.titulo,
      status: ticket.status,
      prioridade: ticket.prioridade,
      duracaoMinutos,
      tempoRespostaMinutos: primeiraResposta,
      slaRespostaCumprido,
      slaResolucaoCumprido,
      totalMensagensChat,
      totalNotasInternas,
      totalSessoesRemotas,
      totalScriptsExecutados,
      totalAnexos,
      avaliacaoNota: ticket.avaliacaoNota,
      avaliacaoComentario: ticket.avaliacaoComentario,
      criadoPorNome: ticket.criadoPorNome,
      tecnicoAtribuidoNome: ticket.tecnicoAtribuido?.nome || null,
      deviceHostname: ticket.device?.hostname || null,
      criadoEm: ticket.criadoEm,
      resolvidoEm: ticket.resolvidoEm,
      fechadoEm: ticket.fechadoEm,
      resumoTexto,
      participantes: Array.from(participantesMap.values()),
    };
  }

  // ── Mappers privados ──

  private async getCommentEvents(ticketId: string, visivelCliente?: boolean): Promise<TimelineEventDto[]> {
    const where: any = { ticketId };
    if (visivelCliente) where.visivelCliente = true;

    const comments = await this.commentRepo.find({ where, order: { criadoEm: 'ASC' } });

    return comments.map(c => ({
      id: c.id,
      ticketId: c.ticketId,
      tipo: this.mapCommentTipo(c.tipo),
      fonte: 'comment' as const,
      timestamp: c.criadoEm,
      autorTipo: c.autorTipo,
      autorId: c.autorId,
      autorNome: c.autorNome,
      conteudo: c.conteudo,
      visivelCliente: c.visivelCliente,
      metadata: this.normalizeMetadata(c.tipo, c.metadata),
    }));
  }

  private async getChatEvents(ticketId: string): Promise<TimelineEventDto[]> {
    const messages = await this.chatRepo.find({
      where: { ticketId },
      order: { criadoEm: 'ASC' },
    });

    return messages.map(m => ({
      id: m.id,
      ticketId: m.ticketId,
      tipo: this.mapChatTipo(m.tipo),
      fonte: 'chat' as const,
      timestamp: m.criadoEm,
      autorTipo: m.remetenteTipo,
      autorId: m.remetenteId,
      autorNome: m.remetenteNome,
      conteudo: m.conteudo,
      visivelCliente: true,
      metadata: m.arquivoUrl ? {
        arquivoUrl: m.arquivoUrl,
        arquivoNome: m.arquivoNome,
        arquivoTamanho: m.arquivoTamanho,
        lido: m.lido,
      } : undefined,
    }));
  }

  private async getSessionEvents(ticketId: string): Promise<TimelineEventDto[]> {
    const sessions = await this.sessionRepo.find({
      where: { ticketId },
      relations: ['technician'],
      order: { criadoEm: 'ASC' },
    });

    const events: TimelineEventDto[] = [];
    for (const s of sessions) {
      // Evento de solicitação
      events.push({
        id: `${s.id}_solicitada`,
        ticketId,
        tipo: TimelineEventType.SESSAO_SOLICITADA,
        fonte: 'session',
        timestamp: s.criadoEm,
        autorTipo: 'technician',
        autorId: s.technicianId,
        autorNome: s.technician?.nome || 'Técnico',
        conteudo: `Sessão remota solicitada${s.motivo ? ': ' + s.motivo : ''}`,
        visivelCliente: true,
        metadata: { sessionId: s.id, deviceId: s.deviceId },
      });

      // Evento de consentimento
      if (s.status === RemoteSessionStatus.CONSENTIDA || s.status === RemoteSessionStatus.ATIVA || s.status === RemoteSessionStatus.FINALIZADA) {
        events.push({
          id: `${s.id}_consentida`,
          ticketId,
          tipo: TimelineEventType.SESSAO_CONSENTIDA,
          fonte: 'session',
          timestamp: s.consentidoEm || s.criadoEm,
          autorTipo: 'system',
          autorNome: s.consentidoPor || 'Usuário',
          conteudo: `Sessão remota autorizada por ${s.consentidoPor || 'usuário local'}`,
          visivelCliente: true,
          metadata: { sessionId: s.id },
        });
      }

      // Evento de recusa
      if (s.status === RemoteSessionStatus.RECUSADA) {
        events.push({
          id: `${s.id}_recusada`,
          ticketId,
          tipo: TimelineEventType.SESSAO_RECUSADA,
          fonte: 'session',
          timestamp: s.consentidoEm || s.criadoEm,
          autorTipo: 'system',
          autorNome: s.consentidoPor || 'Usuário',
          conteudo: `Sessão remota recusada pelo usuário local`,
          visivelCliente: true,
          metadata: { sessionId: s.id },
        });
      }

      // Evento de início
      if (s.iniciadaEm) {
        events.push({
          id: `${s.id}_iniciada`,
          ticketId,
          tipo: TimelineEventType.SESSAO_INICIADA,
          fonte: 'session',
          timestamp: s.iniciadaEm,
          autorTipo: 'technician',
          autorId: s.technicianId,
          autorNome: s.technician?.nome || 'Técnico',
          conteudo: `Sessão remota iniciada`,
          visivelCliente: true,
          metadata: { sessionId: s.id, ipTecnico: s.ipTecnico },
        });
      }

      // Evento de fim
      if (s.finalizadaEm) {
        events.push({
          id: `${s.id}_finalizada`,
          ticketId,
          tipo: TimelineEventType.SESSAO_FINALIZADA,
          fonte: 'session',
          timestamp: s.finalizadaEm,
          autorTipo: 'system',
          autorNome: 'Sistema',
          conteudo: `Sessão remota finalizada (${s.duracaoSegundos ? Math.round(s.duracaoSegundos / 60) + ' min' : 'duração desconhecida'})`,
          visivelCliente: true,
          metadata: { sessionId: s.id, duracaoSegundos: s.duracaoSegundos, resumo: s.resumo },
        });
      }
    }

    return events;
  }

  private mapCommentTipo(tipo: TicketCommentTipo): TimelineEventType {
    const map: Record<string, TimelineEventType> = {
      [TicketCommentTipo.MENSAGEM]: TimelineEventType.COMENTARIO,
      [TicketCommentTipo.NOTA_INTERNA]: TimelineEventType.NOTA_INTERNA,
      [TicketCommentTipo.MUDANCA_STATUS]: TimelineEventType.TICKET_STATUS_ALTERADO,
      [TicketCommentTipo.SESSAO_REMOTA]: TimelineEventType.SESSAO_SOLICITADA,
      [TicketCommentTipo.SCRIPT_EXECUTADO]: TimelineEventType.SCRIPT_EXECUTADO,
      [TicketCommentTipo.ANEXO]: TimelineEventType.ANEXO_ADICIONADO,
      [TicketCommentTipo.AVALIACAO]: TimelineEventType.TICKET_AVALIADO,
      [TicketCommentTipo.SISTEMA]: TimelineEventType.SISTEMA,
    };
    return map[tipo] || TimelineEventType.SISTEMA;
  }

  private mapChatTipo(tipo: ChatMessageTipo): TimelineEventType {
    const map: Record<string, TimelineEventType> = {
      [ChatMessageTipo.TEXTO]: TimelineEventType.CHAT_MENSAGEM,
      [ChatMessageTipo.IMAGEM]: TimelineEventType.CHAT_IMAGEM,
      [ChatMessageTipo.ARQUIVO]: TimelineEventType.CHAT_ARQUIVO,
      [ChatMessageTipo.SISTEMA]: TimelineEventType.CHAT_SISTEMA,
    };
    return map[tipo] || TimelineEventType.CHAT_MENSAGEM;
  }

  private normalizeMetadata(tipo: TicketCommentTipo, metadata?: Record<string, any>) {
    if (!metadata) return metadata;

    if (tipo === TicketCommentTipo.MUDANCA_STATUS) {
      return {
        ...metadata,
        antes: metadata.statusAnterior || metadata.anterior,
        depois: metadata.statusNovo || metadata.novo,
        tipoEvento: 'status',
      };
    }

    if (tipo === TicketCommentTipo.NOTA_INTERNA) {
      return {
        ...metadata,
        tipoEvento: 'nota_interna',
      };
    }

    if (tipo === TicketCommentTipo.SISTEMA) {
      return {
        ...metadata,
        tipoEvento: 'sistema',
      };
    }

    return metadata;
  }

  private calcularTempoResposta(
    ticket: Ticket,
    comments: TicketComment[],
    messages: ChatMessage[],
  ): number | null {
    const criadoEm = new Date(ticket.criadoEm).getTime();

    // Primeira resposta de técnico no chat
    const primeiroChat = messages.find(m => m.remetenteTipo === 'technician');
    // Primeira resposta de técnico nos comentários
    const primeiroComment = comments.find(c =>
      c.autorTipo === 'technician' && c.tipo === TicketCommentTipo.MENSAGEM,
    );

    const tempos: number[] = [];
    if (primeiroChat) tempos.push(new Date(primeiroChat.criadoEm).getTime());
    if (primeiroComment) tempos.push(new Date(primeiroComment.criadoEm).getTime());

    if (tempos.length === 0) return null;

    const primeiraResposta = Math.min(...tempos);
    return Math.round((primeiraResposta - criadoEm) / 60000);
  }

  private gerarTextoResumo(
    ticket: Ticket,
    duracaoMinutos: number,
    totalChat: number,
    totalSessoes: number,
    totalScripts: number,
    sessions: RemoteSession[],
    participantes: { nome: string; tipo: string; mensagens: number }[],
  ): string {
    const duracao = duracaoMinutos < 60
      ? `${duracaoMinutos} minutos`
      : `${Math.round(duracaoMinutos / 60)} horas e ${duracaoMinutos % 60} minutos`;

    let resumo = `Ticket #${ticket.numero} "${ticket.titulo}" — `;
    resumo += `Prioridade ${ticket.prioridade} | Status: ${ticket.status}\n`;
    resumo += `Duração total: ${duracao}\n`;

    if (participantes.length > 0) {
      resumo += `Participantes: ${participantes.map(p => p.nome).join(', ')}\n`;
    }

    resumo += `\nAtividades:\n`;
    resumo += `• ${totalChat} mensagens de chat\n`;

    if (totalSessoes > 0) {
      const duracaoSessoes = sessions
        .filter(s => s.duracaoSegundos)
        .reduce((acc, s) => acc + (s.duracaoSegundos || 0), 0);
      resumo += `• ${totalSessoes} sessão(ões) remota(s) (${Math.round(duracaoSessoes / 60)} min total)\n`;
    }

    if (totalScripts > 0) {
      resumo += `• ${totalScripts} script(s) executado(s)\n`;
    }

    if (ticket.avaliacaoNota) {
      resumo += `\nAvaliação: ${ticket.avaliacaoNota}/5`;
      if (ticket.avaliacaoComentario) resumo += ` — "${ticket.avaliacaoComentario}"`;
      resumo += '\n';
    }

    return resumo;
  }
}
