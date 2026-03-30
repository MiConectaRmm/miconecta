import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  ChatMessage,
  ChatMessageTipo,
  ChatRemetenteTipo,
  ChatMessageStatus,
} from '../../database/entities/chat-message.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { ChatConversationAdapter } from '../conversations/chat-conversation.adapter';
import { TicketChatMessageResponseDto } from './dto/ticket-chat-message-response.dto';

export type EnviarChatMensagemOptions = {
  /** Evita loop quando a mensagem veio da replicação conversation → ticket */
  skipConversationReplication?: boolean;
};

export type TicketChatAccessContext = {
  role?: string;
  userType: string;
  scopedTenantId: string;
};

export type TicketMessageCursor = { createdAt: string; id: string };

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @Inject(forwardRef(() => ChatConversationAdapter))
    private readonly chatConversationAdapter: ChatConversationAdapter,
  ) {}

  private static canAccessAnyTenant(role?: string): boolean {
    return Boolean(role && ['super_admin', 'admin_maginf'].includes(role));
  }

  /** Ticket existe e o usuário tem escopo de tenant para o chat deste ticket. */
  async carregarTicketParaChat(ticketId: string, ctx: TicketChatAccessContext): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['tenant', 'tecnicoAtribuido', 'device', 'organization'],
    });
    if (!ticket) {
      throw new NotFoundException('Ticket não encontrado');
    }
    if (!ChatService.canAccessAnyTenant(ctx.role) && ticket.tenantId !== ctx.scopedTenantId) {
      throw new ForbiddenException('Sem acesso a este ticket');
    }
    return ticket;
  }

  /**
   * Mensagens enviadas por terceiros ainda SENT → DELIVERED quando este participante entra no ticket
   * (outro lado “recebeu” no canal).
   */
  async marcarEntregueParaParticipante(ticketId: string, viewerUserId: string): Promise<string[]> {
    const candidatas = await this.messageRepo
      .createQueryBuilder('msg')
      .select(['msg.id'])
      .where('msg.ticketId = :ticketId', { ticketId })
      .andWhere('msg.messageStatus = :sent', { sent: ChatMessageStatus.SENT })
      .andWhere('(msg.remetenteId IS NULL OR msg.remetenteId != :userId)', { userId: viewerUserId })
      .getMany();
    const ids = candidatas.map((m) => m.id);
    if (ids.length === 0) return [];
    await this.messageRepo.update({ id: In(ids) }, { messageStatus: ChatMessageStatus.DELIVERED });
    return ids;
  }

  /** Quando já existe outro socket na sala do ticket — marcar envio como entregue. */
  async marcarComoEntreguePorIds(messageIds: string[]): Promise<void> {
    if (!messageIds.length) return;
    await this.messageRepo.update(
      { id: In(messageIds), messageStatus: ChatMessageStatus.SENT },
      { messageStatus: ChatMessageStatus.DELIVERED },
    );
  }

  async buscarMensagemPorId(id: string): Promise<ChatMessage | null> {
    return this.messageRepo.findOne({ where: { id } });
  }

  async buscarMensagemNoTicket(messageId: string, ticketId: string): Promise<ChatMessage | null> {
    return this.messageRepo.findOne({ where: { id: messageId, ticketId } });
  }

  formatMensagemCanonica(message: ChatMessage): TicketChatMessageResponseDto {
    const status =
      message.lido || message.messageStatus === ChatMessageStatus.READ
        ? ChatMessageStatus.READ
        : message.messageStatus || ChatMessageStatus.SENT;

    const deliveryStatus: TicketChatMessageResponseDto['deliveryStatus'] =
      status === ChatMessageStatus.READ || message.lido
        ? 'read'
        : status === ChatMessageStatus.DELIVERED
          ? 'delivered'
          : 'sent';

    let senderType: TicketChatMessageResponseDto['senderType'] = message.remetenteTipo;
    if (message.remetenteTipo === ChatRemetenteTipo.TECHNICIAN) senderType = 'TECH';
    else if (message.remetenteTipo === ChatRemetenteTipo.CLIENT_USER) senderType = 'CLIENT';
    else if (message.remetenteTipo === ChatRemetenteTipo.AGENT) senderType = 'AGENT';
    else if (message.remetenteTipo === ChatRemetenteTipo.SYSTEM) senderType = 'SYSTEM';

    let type: TicketChatMessageResponseDto['type'] = 'TEXT';
    if (message.tipo === ChatMessageTipo.SISTEMA) type = 'SYSTEM';
    else if (message.tipo === ChatMessageTipo.TEXTO) type = 'TEXT';
    else type = 'FILE';

    return {
      id: message.id,
      ticketId: message.ticketId,
      deviceId: message.deviceId,
      senderType,
      senderId: message.remetenteId,
      senderName: message.remetenteNome,
      type,
      content: message.conteudo,
      status,
      deliveryStatus,
      read: message.lido,
      readAt: message.lidoEm,
      createdAt: message.criadoEm,
      arquivoUrl: message.arquivoUrl,
      arquivoNome: message.arquivoNome,
      arquivoTamanho: message.arquivoTamanho != null ? Number(message.arquivoTamanho) : undefined,
      remetenteTipo: message.remetenteTipo,
      remetenteId: message.remetenteId,
      remetenteNome: message.remetenteNome,
      tipo: message.tipo,
      conteudo: message.conteudo,
      lido: message.lido,
      lidoEm: message.lidoEm,
      criadoEm: message.criadoEm,
    };
  }

  async listarHistoricoFormatado(
    ticketId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<TicketChatMessageResponseDto[]> {
    const rows = await this.listarMensagens(ticketId, limit, offset);
    return rows.map((m) => this.formatMensagemCanonica(m));
  }

  /**
   * Janela das mensagens mais recentes (ordem cronológica ASC) ou página mais antiga via cursor.
   * `nextOlderCursor` aponta para a mensagem mais antiga do lote (use no próximo request).
   */
  async listarHistoricoCursor(
    ticketId: string,
    limit: number = 40,
    olderThan?: TicketMessageCursor | null,
  ): Promise<{
    items: TicketChatMessageResponseDto[];
    nextOlderCursor: TicketMessageCursor | null;
    hasMoreOlder: boolean;
  }> {
    const take = Math.min(Math.max(limit, 1), 100);
    const qb = this.messageRepo
      .createQueryBuilder('msg')
      .where('msg.ticketId = :ticketId', { ticketId });

    if (olderThan?.createdAt && olderThan?.id) {
      qb.andWhere(
        '(msg.criadoEm < :cAt OR (msg.criadoEm = :cAt AND msg.id < :cid))',
        { cAt: olderThan.createdAt, cid: olderThan.id },
      );
    }

    qb.orderBy('msg.criadoEm', 'DESC').addOrderBy('msg.id', 'DESC').take(take + 1);
    const rows = await qb.getMany();
    const hasMoreOlder = rows.length > take;
    const batch = hasMoreOlder ? rows.slice(0, take) : rows;
    batch.reverse();
    const items = batch.map((m) => this.formatMensagemCanonica(m));
    const nextOlderCursor =
      hasMoreOlder && batch.length > 0
        ? { createdAt: batch[0].criadoEm instanceof Date ? batch[0].criadoEm.toISOString() : String(batch[0].criadoEm), id: batch[0].id }
        : null;
    return { items, nextOlderCursor, hasMoreOlder };
  }

  /** Contagem de não lidas por ticket (mensagens de terceiros), só tickets do tenant. */
  async contagemNaoLidasPorTickets(
    ticketIds: string[],
    readerUserId: string,
    tenantId: string,
  ): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    if (!ticketIds.length || !tenantId) return out;
    const unique = [...new Set(ticketIds)].slice(0, 200);
    const rows = await this.messageRepo
      .createQueryBuilder('msg')
      .innerJoin(Ticket, 't', 't.id = msg.ticketId')
      .select('msg.ticketId', 'ticketId')
      .addSelect('COUNT(*)', 'cnt')
      .where('msg.ticketId IN (:...ids)', { ids: unique })
      .andWhere('t.tenantId = :tenantId', { tenantId })
      .andWhere('msg.lido = false')
      .andWhere('(msg.remetenteId IS NULL OR msg.remetenteId != :uid)', { uid: readerUserId })
      .groupBy('msg.ticketId')
      .getRawMany<{ ticketId: string; cnt: string }>();
    for (const r of rows) {
      out[r.ticketId] = Number(r.cnt || 0);
    }
    for (const id of unique) {
      if (out[id] === undefined) out[id] = 0;
    }
    return out;
  }

  async enviarMensagem(
    dados: {
      ticketId: string;
      deviceId?: string;
      remetenteTipo: ChatRemetenteTipo;
      remetenteId?: string;
      remetenteNome: string;
      tipo?: ChatMessageTipo;
      conteudo: string;
      arquivoUrl?: string;
      arquivoNome?: string;
      arquivoTamanho?: number;
    },
    options?: EnviarChatMensagemOptions,
  ) {
    const message = this.messageRepo.create({
      ticketId: dados.ticketId,
      deviceId: dados.deviceId,
      remetenteTipo: dados.remetenteTipo,
      remetenteId: dados.remetenteId,
      remetenteNome: dados.remetenteNome,
      tipo: dados.tipo || ChatMessageTipo.TEXTO,
      conteudo: dados.conteudo,
      arquivoUrl: dados.arquivoUrl,
      arquivoNome: dados.arquivoNome,
      arquivoTamanho: dados.arquivoTamanho,
      messageStatus: ChatMessageStatus.SENT,
      lido: false,
    });

    const saved = await this.messageRepo.save(message);

    if (!options?.skipConversationReplication) {
      void this.chatConversationAdapter.replicarMensagemLegadaParaConversation(saved).catch(() => {});
    }

    return saved;
  }

  async listarMensagens(ticketId: string, limit: number = 100, offset: number = 0) {
    return this.messageRepo.find({
      where: { ticketId },
      order: { criadoEm: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async marcarComoLida(messageId: string) {
    await this.messageRepo.update(messageId, {
      lido: true,
      lidoEm: new Date(),
      messageStatus: ChatMessageStatus.READ,
    });
    return this.messageRepo.findOne({ where: { id: messageId } });
  }

  async marcarTodasComoLidas(ticketId: string, userId: string) {
    await this.messageRepo
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ lido: true, lidoEm: new Date(), messageStatus: ChatMessageStatus.READ })
      .where('ticketId = :ticketId', { ticketId })
      .andWhere('remetenteId != :userId', { userId })
      .andWhere('lido = false')
      .execute();
  }

  async enviarMensagemSistema(ticketId: string, conteudo: string) {
    return this.enviarMensagem(
      {
        ticketId,
        remetenteTipo: ChatRemetenteTipo.SYSTEM,
        remetenteNome: 'Sistema',
        tipo: ChatMessageTipo.SISTEMA,
        conteudo,
      },
      undefined,
    );
  }

  /** Mensagens não lidas (de técnico/sistema/cliente) nos tickets ligados ao dispositivo — para o agente. */
  async listarMensagensNaoLidasAgente(deviceId: string, tenantId: string): Promise<ChatMessage[]> {
    return this.messageRepo
      .createQueryBuilder('msg')
      .innerJoin(Ticket, 't', 't.id = msg.ticketId')
      .where('t.deviceId = :deviceId', { deviceId })
      .andWhere('t.tenantId = :tenantId', { tenantId })
      .andWhere('msg.lido = :lido', { lido: false })
      .andWhere('msg.remetenteTipo != :agent', { agent: ChatRemetenteTipo.AGENT })
      .orderBy('msg.criadoEm', 'DESC')
      .take(40)
      .getMany();
  }

  async contarNaoLidas(ticketId: string, userId: string) {
    const result = await this.messageRepo
      .createQueryBuilder('msg')
      .select('COUNT(*)', 'count')
      .where('msg.ticketId = :ticketId', { ticketId })
      .andWhere('msg.lido = false')
      .andWhere('(msg.remetenteId IS NULL OR msg.remetenteId != :userId)', { userId })
      .getRawOne<{ count: string }>();

    return Number(result?.count || 0);
  }
}
