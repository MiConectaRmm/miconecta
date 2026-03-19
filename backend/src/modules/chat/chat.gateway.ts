import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ChatService } from './chat.service';
import { Ticket } from '../../database/entities/ticket.entity';
import { ChatRemetenteTipo, ChatMessageTipo } from '../../database/entities/chat-message.entity';
import { TicketStatus } from '../../database/entities/ticket.entity';

interface JwtSocketUser {
  sub: string;
  nome: string;
  email: string;
  userType: string;
  role?: string;
  tenantId: string;
  permissions?: string[];
}

interface AuthenticatedSocket extends Socket {
  data: {
    user?: JwtSocketUser;
    joinedTickets?: Set<string>;
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

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
  ) {}

  async handleConnection(client: AuthenticatedSocket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify<JwtSocketUser>(token);
      client.data.user = payload;
      client.data.joinedTickets = new Set<string>();
      client.join(`tenant:${payload.tenantId}`);
      this.logger.log(`WS connected: ${client.id} (${payload.userType}:${payload.sub})`);
    } catch (error) {
      this.logger.warn(`WS connection rejected: ${client.id}`);
      client.emit('error', { message: 'Invalid token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket) {
    this.logger.log(`WS disconnected: ${client.id}`);
  }

  @SubscribeMessage('ticket:join')
  async handleJoinTicket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TicketJoinPayload,
  ) {
    const user = this.getUser(client);
    const ticket = await this.assertTicketAccess(user, data.ticketId);
    const room = `ticket:${ticket.id}`;
    client.join(room);
    client.data.joinedTickets?.add(ticket.id);
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

  @SubscribeMessage('message:send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: MessageSendPayload,
  ) {
    const user = this.getUser(client);
    const ticket = await this.assertTicketAccess(user, data.ticketId);
    const isClient = user.userType === 'client_user';
    const message = await this.chatService.enviarMensagem({
      ticketId: ticket.id,
      remetenteTipo: isClient ? ChatRemetenteTipo.CLIENT_USER : ChatRemetenteTipo.TECHNICIAN,
      remetenteId: user.sub,
      remetenteNome: user.nome,
      conteudo: data.content,
    });

    const normalized = this.normalizeMessage(message);
    this.server.to(`ticket:${ticket.id}`).emit('message:new', normalized);
    this.server.to(`tenant:${ticket.tenantId}`).emit('notification:new', {
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
    const ticket = await this.assertTicketAccess(user, data.ticketId);
    const message = await this.chatService.enviarMensagem({
      ticketId: ticket.id,
      remetenteTipo: user.userType === 'client_user' ? ChatRemetenteTipo.CLIENT_USER : ChatRemetenteTipo.TECHNICIAN,
      remetenteId: user.sub,
      remetenteNome: user.nome,
      conteudo: data.conteudo,
    });
    const normalized = this.normalizeMessage(message);
    this.server.to(`ticket:${ticket.id}`).emit('message:new', normalized);
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
    const ticket = await this.assertTicketAccess(user, data.ticketId);
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
    const normalized = this.normalizeMessage(message);
    this.server.to(`ticket:${ticket.id}`).emit('message:new', normalized);
    this.server.to(`tenant:${ticket.tenantId}`).emit('notification:new', {
      type: 'ticket_message',
      ticketId: ticket.id,
      tenantId: ticket.tenantId,
      message: normalized,
      timestamp: new Date(),
    });
    return normalized;
  }

  @SubscribeMessage('chat:mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: TicketJoinPayload,
  ) {
    const user = this.getUser(client);
    const ticket = await this.assertTicketAccess(user, data.ticketId);
    await this.chatService.marcarTodasComoLidas(ticket.id, user.sub);
    this.server.to(`ticket:${ticket.id}`).emit('ticket:read', {
      ticketId: ticket.id,
      userId: user.sub,
      timestamp: new Date(),
    });
    return { ok: true };
  }

  emitTicketUpdated(ticketId: string, payload: TicketEventPayload) {
    const { ticketId: _ignored, ...rest } = payload as TicketEventPayload & { ticketId?: string };
    this.server.to(`ticket:${ticketId}`).emit('ticket:updated', { ticketId, ...rest });
  }

  emitNotification(tenantId: string, payload: Record<string, unknown>) {
    this.server.to(`tenant:${tenantId}`).emit('notification:new', payload);
  }

  emitMessage(ticketId: string, payload: unknown) {
    this.server.to(`ticket:${ticketId}`).emit('message:new', payload);
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
      throw new Error('Socket not authenticated');
    }
    return user;
  }

  private async assertTicketAccess(user: JwtSocketUser, ticketId: string): Promise<Ticket> {
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId },
      relations: ['tenant', 'tecnicoAtribuido', 'device', 'organization'],
    });

    if (!ticket) {
      throw new Error('Ticket not found');
    }

    if (ticket.tenantId !== user.tenantId && !this.canAccessCrossTenant(user)) {
      throw new Error('Forbidden');
    }

    return ticket;
  }

  private canAccessCrossTenant(user: JwtSocketUser): boolean {
    // Cross-tenant apenas para perfis globais de administração.
    const globalRoles = new Set(['super_admin', 'admin_maginf']);
    return Boolean(user.role && globalRoles.has(user.role));
  }

  private normalizeMessage(message: {
    id: string;
    ticketId: string;
    deviceId?: string;
    remetenteTipo: ChatRemetenteTipo;
    remetenteId?: string;
    remetenteNome: string;
    tipo: ChatMessageTipo;
    conteudo: string;
    arquivoUrl?: string;
    arquivoNome?: string;
    arquivoTamanho?: number;
    lido: boolean;
    lidoEm?: Date | null;
    criadoEm: Date;
  }) {
    return {
      id: message.id,
      ticketId: message.ticketId,
      deviceId: message.deviceId,
      // Campos canônicos (EN)
      senderType: message.remetenteTipo,
      senderId: message.remetenteId,
      senderName: message.remetenteNome,
      type: message.tipo,
      content: message.conteudo,
      read: message.lido,
      readAt: message.lidoEm,
      createdAt: message.criadoEm,
      // Campos legados (PT) para compatibilidade gradual no frontend.
      remetenteTipo: message.remetenteTipo,
      remetenteId: message.remetenteId,
      remetenteNome: message.remetenteNome,
      tipo: message.tipo,
      conteudo: message.conteudo,
      arquivoUrl: message.arquivoUrl,
      arquivoNome: message.arquivoNome,
      arquivoTamanho: message.arquivoTamanho,
      lido: message.lido,
      lidoEm: message.lidoEm,
      criadoEm: message.criadoEm,
    };
  }
}
