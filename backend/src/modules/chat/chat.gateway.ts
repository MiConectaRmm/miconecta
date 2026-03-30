import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
  WsException,
} from '@nestjs/websockets';
import { Logger, NotFoundException, ForbiddenException, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { ChatService } from './chat.service';
import { Ticket } from '../../database/entities/ticket.entity';
import { ChatRemetenteTipo, ChatMessageTipo } from '../../database/entities/chat-message.entity';
import { TicketStatus } from '../../database/entities/ticket.entity';
import { ConversationsService } from '../conversations/conversations.service';
import { Conversation } from '../../database/entities/conversation.entity';
import { ParticipantRole } from '../../database/entities/conversation-participant.entity';
import { ConversationMessageType } from '../../database/entities/conversation-message.entity';
import { AuthService } from '../auth/auth.service';
import {
  WsJoinTicketDto,
  WsSendMessagePayloadDto,
  WsTypingPayloadDto,
  WsReadMessagePayloadDto,
} from './dto/ws-ticket-chat.dto';

interface JwtSocketUser {
  sub: string;
  nome: string;
  email: string;
  userType: string;
  role?: string;
  tenantId: string | null;
  permissions?: string[];
  /** Alinhado ao TenantAccessGuard: técnico pode enviar tenant em `handshake.auth.tenantId`. */
  scopedTenantId: string;
}

interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtSocketUser;
    joinedTickets?: Set<string>;
    joinedConversations?: Set<string>;
    presenceTenantKey?: string;
  };
}

interface MessageSendPayload {
  ticketId: string;
  content: string;
}

interface TicketJoinPayload {
  ticketId: string;
}

interface TicketEventPayload {
  ticketId: string;
  status?: TicketStatus;
  prioridade?: string;
  atribuidoA?: string | null;
  hasUnreadFromClient?: boolean;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: false,
  }),
)
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  /** tenantKey → userId → sockets */
  private readonly presenceByTenant = new Map<string, Map<string, Set<string>>>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly authService: AuthService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const decoded = this.jwtService.verify(token) as Record<string, unknown>;
      const payload = await this.authService.validarToken(decoded);
      const auth = client.handshake.auth as { token?: string; tenantId?: string } | undefined;

      let scopedTenantId: string;
      if (payload.userType === 'client_user') {
        scopedTenantId = String(payload.tenantId || '');
      } else {
        scopedTenantId =
          typeof auth?.tenantId === 'string' && auth.tenantId.trim()
            ? auth.tenantId.trim()
            : String(payload.tenantId || '');
      }

      if (!scopedTenantId && !this.canAccessCrossTenant(payload as Pick<JwtSocketUser, 'role'>)) {
        client.emit('error', { message: 'Tenant scope required' });
        client.disconnect();
        return;
      }

      const user: JwtSocketUser = {
        sub: payload.sub,
        nome: payload.nome,
        email: payload.email,
        userType: payload.userType,
        role: payload.role,
        tenantId: payload.tenantId,
        permissions: payload.permissions,
        scopedTenantId,
      };

      client.data.user = user;
      client.data.joinedTickets = new Set<string>();
      client.data.joinedConversations = new Set<string>();

      const tenantRoom = scopedTenantId || String(payload.tenantId || 'unscoped');
      client.join(`tenant:${tenantRoom}`);
      this.trackPresence(client, tenantRoom, user);

      client.emit('connection', {
        userId: user.sub,
        userType: user.userType,
        scopedTenantId: scopedTenantId || null,
      });

      this.logger.log(`WS connected: ${client.id} (${user.userType}:${user.sub})`);
    } catch (error) {
      this.logger.warn(`WS connection rejected: ${client.id}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.untrackPresence(client);
    const user = client.data.user;
    this.logger.log(`WS disconnected: ${client.id}${user ? ` (${user.userType}:${user.sub})` : ''}`);
  }

  @SubscribeMessage('join_ticket')
  async handleJoinTicketCanonical(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsJoinTicketDto,
  ) {
    return this.runTicketRoomJoin(client, data.ticketId);
  }

  @SubscribeMessage('ticket:join')
  async handleJoinTicket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TicketJoinPayload,
  ) {
    return this.runTicketRoomJoin(client, data.ticketId);
  }

  private async runTicketRoomJoin(client: AuthenticatedSocket, ticketId: string) {
    const user = this.getUser(client);
    const ticket = await this.resolveTicket(client, ticketId);
    const room = `ticket:${ticket.id}`;
    const deliveredIds = await this.chatService.marcarEntregueParaParticipante(ticket.id, user.sub);
    client.join(room);
    client.data.joinedTickets?.add(ticket.id);
    if (deliveredIds.length) {
      this.server.to(room).emit('message:status', {
        ticketId: ticket.id,
        messageIds: deliveredIds,
        deliveryStatus: 'delivered',
      });
    }
    await this.chatService.marcarTodasComoLidas(ticket.id, user.sub);
    this.server.to(room).emit('ticket:read', { ticketId: ticket.id, userId: user.sub, timestamp: new Date() });
    return { ok: true, ticketId: ticket.id };
  }

  @SubscribeMessage('ticket:leave')
  handleLeaveTicket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TicketJoinPayload,
  ) {
    client.leave(`ticket:${data.ticketId}`);
    client.data.joinedTickets?.delete(data.ticketId);
    return { ok: true, ticketId: data.ticketId };
  }

  @SubscribeMessage('send_message')
  async handleSendMessageCanonical(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsSendMessagePayloadDto,
  ) {
    return this.persistAndBroadcastMessage(client, data.ticketId, data.content);
  }

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageSendPayload,
  ) {
    return this.persistAndBroadcastMessage(client, data.ticketId, data.content);
  }

  private async persistAndBroadcastMessage(
    client: AuthenticatedSocket,
    ticketId: string,
    content: string,
  ) {
    const user = this.getUser(client);
    const ticket = await this.resolveTicket(client, ticketId);
    const isClient = user.userType === 'client_user';
    let message = await this.chatService.enviarMensagem({
      ticketId: ticket.id,
      remetenteTipo: isClient ? ChatRemetenteTipo.CLIENT_USER : ChatRemetenteTipo.TECHNICIAN,
      remetenteId: user.sub,
      remetenteNome: user.nome,
      conteudo: content,
    });

    try {
      const room = `ticket:${ticket.id}`;
      const sockets = await this.server.in(room).fetchSockets();
      const hasOther = sockets.some((s) => (s.data as AuthenticatedSocket['data'])?.user?.sub !== user.sub);
      if (hasOther) {
        await this.chatService.marcarComoEntreguePorIds([message.id]);
        const refreshed = await this.chatService.buscarMensagemPorId(message.id);
        if (refreshed) message = refreshed;
      }
    } catch {
      /* fetchSockets indisponível em alguns adapters — ignora */
    }

    const normalized = this.chatService.formatMensagemCanonica(message);
    this.server.to(`ticket:${ticket.id}`).emit('message:new', normalized);
    this.pushTicketsInboxTouch(ticket, normalized);
    this.emitNotification(ticket.tenantId, {
      type: 'ticket_message',
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
      message: normalized,
      timestamp: new Date(),
    });
    return normalized;
  }

  @SubscribeMessage('chat:send_message')
  async handleLegacySendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { ticketId: string; conteudo: string; remetenteId?: string; remetenteNome?: string; remetenteTipo?: string },
  ) {
    const user = this.getUser(client);
    const ticket = await this.resolveTicket(client, data.ticketId);
    const message = await this.chatService.enviarMensagem({
      ticketId: ticket.id,
      remetenteTipo: user.userType === 'client_user' ? ChatRemetenteTipo.CLIENT_USER : ChatRemetenteTipo.TECHNICIAN,
      remetenteId: user.sub,
      remetenteNome: user.nome,
      conteudo: data.conteudo,
    });
    let msgEntity = message;
    try {
      const room = `ticket:${ticket.id}`;
      const sockets = await this.server.in(room).fetchSockets();
      const hasOther = sockets.some((s) => (s.data as AuthenticatedSocket['data'])?.user?.sub !== user.sub);
      if (hasOther) {
        await this.chatService.marcarComoEntreguePorIds([message.id]);
        const refreshed = await this.chatService.buscarMensagemPorId(message.id);
        if (refreshed) msgEntity = refreshed;
      }
    } catch {
      /* ignore */
    }
    const normalized = this.chatService.formatMensagemCanonica(msgEntity);
    this.server.to(`ticket:${ticket.id}`).emit('message:new', normalized);
    this.pushTicketsInboxTouch(ticket, normalized);
    return normalized;
  }

  @SubscribeMessage('chat:send_file')
  async handleSendFile(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: {
      ticketId: string;
      arquivoUrl: string;
      arquivoNome: string;
      arquivoTamanho: number;
      conteudo?: string;
    },
  ) {
    const user = this.getUser(client);
    const ticket = await this.resolveTicket(client, data.ticketId);
    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(data.arquivoNome);
    const message = await this.chatService.enviarMensagem({
      ticketId: ticket.id,
      remetenteTipo: user.userType === 'client_user' ? ChatRemetenteTipo.CLIENT_USER : ChatRemetenteTipo.TECHNICIAN,
      remetenteId: user.sub,
      remetenteNome: user.nome,
      tipo: isImage ? ChatMessageTipo.IMAGEM : ChatMessageTipo.ARQUIVO,
      conteudo: data.conteudo || data.arquivoNome,
      arquivoUrl: data.arquivoUrl,
      arquivoNome: data.arquivoNome,
      arquivoTamanho: data.arquivoTamanho,
    });
    let msgEntity = message;
    try {
      const room = `ticket:${ticket.id}`;
      const sockets = await this.server.in(room).fetchSockets();
      const hasOther = sockets.some((s) => (s.data as AuthenticatedSocket['data'])?.user?.sub !== user.sub);
      if (hasOther) {
        await this.chatService.marcarComoEntreguePorIds([message.id]);
        const refreshed = await this.chatService.buscarMensagemPorId(message.id);
        if (refreshed) msgEntity = refreshed;
      }
    } catch {
      /* ignore */
    }
    const normalized = this.chatService.formatMensagemCanonica(msgEntity);
    this.server.to(`ticket:${ticket.id}`).emit('message:new', normalized);
    this.pushTicketsInboxTouch(ticket, normalized);
    this.emitNotification(ticket.tenantId, {
      type: 'ticket_message',
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
      message: normalized,
      timestamp: new Date(),
    });
    return normalized;
  }

  @SubscribeMessage('typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsTypingPayloadDto,
  ) {
    const user = this.getUser(client);
    await this.resolveTicket(client, data.ticketId);
    const payload = {
      ticketId: data.ticketId,
      userId: user.sub,
      nome: data.nome || user.nome,
      isTyping: data.isTyping,
    };
    client.to(`ticket:${data.ticketId}`).emit('typing', payload);
    return { ok: true };
  }

  @SubscribeMessage('chat:typing')
  async handleChatTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { ticketId: string; userId?: string; nome?: string; isTyping: boolean },
  ) {
    const user = this.getUser(client);
    if (!data?.ticketId) throw new WsException('ticketId obrigatório');
    await this.resolveTicket(client, data.ticketId);
    client.to(`ticket:${data.ticketId}`).emit('typing', {
      ticketId: data.ticketId,
      userId: user.sub,
      nome: data.nome || user.nome,
      isTyping: Boolean(data.isTyping),
    });
    return { ok: true };
  }

  @SubscribeMessage('read_message')
  async handleReadMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: WsReadMessagePayloadDto,
  ) {
    const user = this.getUser(client);
    await this.resolveTicket(client, data.ticketId);
    const existing = await this.chatService.buscarMensagemNoTicket(data.messageId, data.ticketId);
    if (!existing) {
      throw new WsException('Mensagem não encontrada');
    }
    const updated = await this.chatService.marcarComoLida(data.messageId);
    const normalized = updated ? this.chatService.formatMensagemCanonica(updated) : null;
    this.server.to(`ticket:${data.ticketId}`).emit('read_message', {
      ticketId: data.ticketId,
      messageId: data.messageId,
      userId: user.sub,
      message: normalized,
      timestamp: new Date(),
    });
    this.server.to(`ticket:${data.ticketId}`).emit('message:status', {
      ticketId: data.ticketId,
      messageIds: [data.messageId],
      deliveryStatus: 'read',
      readerId: user.sub,
    });
    return { ok: true, message: normalized };
  }

  @SubscribeMessage('chat:mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TicketJoinPayload,
  ) {
    const user = this.getUser(client);
    const ticket = await this.resolveTicket(client, data.ticketId);
    await this.chatService.marcarTodasComoLidas(ticket.id, user.sub);
    this.server.to(`ticket:${ticket.id}`).emit('ticket:read', {
      ticketId: ticket.id,
      userId: user.sub,
      timestamp: new Date(),
    });
    return { ok: true };
  }

  // ── Central de Atendimento: sala global para técnicos ──

  @SubscribeMessage('presence:list')
  handlePresenceList(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = this.getUser(client);
    const tenantKey = user.scopedTenantId || String(user.tenantId || '');
    const m = this.presenceByTenant.get(tenantKey);
    const online = m ? [...m.entries()].filter(([, set]) => set.size > 0).map(([uid]) => uid) : [];
    return { onlineUserIds: online };
  }

  @SubscribeMessage('atendimento:join')
  handleAtendimentoJoin(@ConnectedSocket() client: AuthenticatedSocket) {
    const user = this.getUser(client);
    if (user.userType !== 'technician' && !this.canAccessCrossTenant(user)) {
      return { ok: false, message: 'Forbidden' };
    }
    client.join('atendimento');
    this.logger.log(`Atendimento joined: ${client.id} (${user.nome})`);
    return { ok: true };
  }

  @SubscribeMessage('atendimento:leave')
  handleAtendimentoLeave(@ConnectedSocket() client: AuthenticatedSocket) {
    client.leave('atendimento');
    return { ok: true };
  }

  emitTicketUpdated(ticketId: string, payload: TicketEventPayload) {
    const { ticketId: _ignored, ...rest } = payload as TicketEventPayload & { ticketId?: string };
    this.server.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, ...rest });
    this.server.to('atendimento').emit('atendimento:ticket_updated', { ticketId, ...rest });
  }

  emitNotification(tenantId: string, payload: Record<string, unknown>) {
    this.server.to(`tenant:${tenantId}`).emit('notification:new', payload);
    this.server.to('atendimento').emit('atendimento:update', payload);
  }

  emitMessage(ticketId: string, payload: unknown) {
    this.server.to(`ticket:${ticketId}`).emit('message:new', payload);
  }

  emitAtendimento(event: string, payload: Record<string, unknown>) {
    this.server.to('atendimento').emit(event, payload);
  }

  // ── Conversation Events ──

  @SubscribeMessage('conversation:join')
  async handleConversationJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = this.getUser(client);
    const conversation = await this.assertConversationAccess(user, data.conversationId);
    const room = `conversation:${conversation.id}`;
    client.join(room);
    client.data.joinedConversations?.add(conversation.id);
    await this.conversationsService.marcarComoLida(conversation.id, user.sub);
    this.server.to(room).emit('conversation:read', {
      conversationId: conversation.id,
      userId: user.sub,
      timestamp: new Date(),
    });
    return { ok: true, conversationId: conversation.id };
  }

  @SubscribeMessage('conversation:leave')
  handleConversationLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    client.leave(`conversation:${data.conversationId}`);
    client.data.joinedConversations?.delete(data.conversationId);
    return { ok: true, conversationId: data.conversationId };
  }

  @SubscribeMessage('conversation:message')
  async handleConversationMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string; content: string; arquivoUrl?: string; arquivoNome?: string; arquivoTamanho?: number },
  ) {
    const user = this.getUser(client);
    const conversation = await this.assertConversationAccess(user, data.conversationId);
    const isClient = user.userType === 'client_user';

    await this.conversationsService.adicionarParticipante({
      conversationId: conversation.id,
      userId: user.sub,
      participantName: user.nome,
      role: isClient ? ParticipantRole.CLIENT : ParticipantRole.TECHNICIAN,
    });

    const isFile = !!data.arquivoUrl;
    const message = await this.conversationsService.enviarMensagem({
      conversationId: conversation.id,
      senderUserId: user.sub,
      senderName: user.nome,
      senderType: isClient ? 'client' : 'technician',
      content: data.content || data.arquivoNome || '',
      type: isFile ? ConversationMessageType.FILE : ConversationMessageType.TEXT,
      arquivoUrl: data.arquivoUrl,
      arquivoNome: data.arquivoNome,
      arquivoTamanho: data.arquivoTamanho,
    });

    this.server.to(`conversation:${conversation.id}`).emit('conversation:message:new', message);
    this.emitNotification(conversation.tenantId, {
      type: 'conversation_message',
      conversationId: conversation.id,
      tenantId: conversation.tenantId,
      message,
      timestamp: new Date(),
    });
    return message;
  }

  @SubscribeMessage('conversation:mark_read')
  async handleConversationMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ) {
    const user = this.getUser(client);
    await this.assertConversationAccess(user, data.conversationId);
    await this.conversationsService.marcarComoLida(data.conversationId, user.sub);
    this.server.to(`conversation:${data.conversationId}`).emit('conversation:read', {
      conversationId: data.conversationId,
      userId: user.sub,
      timestamp: new Date(),
    });
    return { ok: true };
  }

  emitConversationNew(tenantId: string, conversation: any) {
    this.server.to(`tenant:${tenantId}`).emit('conversation:new', conversation);
    this.server.to('atendimento').emit('atendimento:update', {
      type: 'conversation_created',
      conversation,
      tenantId,
      timestamp: new Date(),
    });
  }

  emitConversationMessage(conversationId: string, message: any) {
    this.server.to(`conversation:${conversationId}`).emit('conversation:message:new', message);
  }

  emitConversationUpdated(conversationId: string, payload: Record<string, unknown>) {
    this.server.to(`conversation:${conversationId}`).emit('conversation:updated', payload);
  }

  private trackPresence(client: AuthenticatedSocket, tenantKey: string, user: JwtSocketUser) {
    if (!tenantKey) return;
    if (!this.presenceByTenant.has(tenantKey)) {
      this.presenceByTenant.set(tenantKey, new Map());
    }
    const byUser = this.presenceByTenant.get(tenantKey)!;
    if (!byUser.has(user.sub)) byUser.set(user.sub, new Set());
    const set = byUser.get(user.sub)!;
    const wasEmpty = set.size === 0;
    set.add(client.id);
    client.data.presenceTenantKey = tenantKey;
    if (wasEmpty) {
      this.server.to(`tenant:${tenantKey}`).emit('presence:online', {
        userId: user.sub,
        nome: user.nome,
        userType: user.userType,
      });
    }
  }

  private untrackPresence(client: AuthenticatedSocket) {
    const tenantKey = client.data.presenceTenantKey;
    const user = client.data.user;
    if (!tenantKey || !user) return;
    const byUser = this.presenceByTenant.get(tenantKey);
    if (!byUser) return;
    const set = byUser.get(user.sub);
    if (!set) return;
    set.delete(client.id);
    if (set.size === 0) {
      byUser.delete(user.sub);
      this.server.to(`tenant:${tenantKey}`).emit('presence:offline', { userId: user.sub });
    }
    if (byUser.size === 0) {
      this.presenceByTenant.delete(tenantKey);
    }
  }

  private pushTicketsInboxTouch(ticket: Ticket, normalized: { content: string; createdAt: string | Date }) {
    const lastMessageAt = typeof normalized.createdAt === 'string' ? normalized.createdAt : normalized.createdAt.toISOString();
    const payload = {
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
      titulo: ticket.titulo,
      lastMessage: normalized.content,
      lastMessageAt,
    };
    this.server.to(`tenant:${ticket.tenantId}`).emit('tickets:inbox_touch', payload);
    this.server.to('atendimento').emit('tickets:inbox_touch', payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    const queryToken = client.handshake.query?.token;
    const token = typeof authToken === 'string' ? authToken : typeof queryToken === 'string' ? queryToken : null;
    if (!token) return null;
    return token.replace(/^Bearer\s+/i, '');
  }

  private getUser(client: AuthenticatedSocket): JwtSocketUser {
    const user = client.data.user;
    if (!user) {
      throw new WsException('Socket not authenticated');
    }
    return user;
  }

  private getTicketChatContext(client: AuthenticatedSocket) {
    const u = this.getUser(client);
    return {
      role: u.role,
      userType: u.userType,
      scopedTenantId: u.scopedTenantId,
    };
  }

  private async resolveTicket(client: AuthenticatedSocket, ticketId: string): Promise<Ticket> {
    try {
      return await this.chatService.carregarTicketParaChat(ticketId, this.getTicketChatContext(client));
    } catch (e) {
      if (e instanceof NotFoundException || e instanceof ForbiddenException) {
        throw new WsException(e.message);
      }
      throw new WsException('Erro ao validar ticket');
    }
  }

  private async assertConversationAccess(user: JwtSocketUser, conversationId: string): Promise<Conversation> {
    const tenantKey = user.scopedTenantId || String(user.tenantId || '');
    const conversation = await this.conversationsService.buscar(conversationId, tenantKey).catch(() => null);

    if (!conversation) {
      if (this.canAccessCrossTenant(user)) {
        const conv = await this.conversationsService.buscar(conversationId, tenantKey).catch(() => null);
        if (conv) return conv;
      }
      throw new WsException('Conversation not found');
    }

    return conversation;
  }

  private canAccessCrossTenant(user: Pick<JwtSocketUser, 'role'>): boolean {
    const globalRoles = new Set(['super_admin', 'admin_maginf']);
    return Boolean(user.role && globalRoles.has(user.role));
  }
}
