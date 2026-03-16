import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRemetenteTipo, ChatMessageTipo } from '../../database/entities/chat-message.entity';

/**
 * WebSocket Gateway para chat em tempo real.
 * Namespace: /chat
 *
 * Eventos CLIENT → SERVER:
 *   chat:join_ticket      Entrar na room do ticket
 *   chat:leave_ticket     Sair da room do ticket
 *   chat:send_message     Enviar mensagem de texto
 *   chat:send_file        Enviar mensagem com arquivo
 *   chat:typing           Indicador de digitação
 *   chat:mark_read        Marcar mensagens como lidas
 *
 * Eventos SERVER → CLIENT:
 *   chat:new_message      Nova mensagem recebida
 *   chat:user_typing      Alguém está digitando
 *   chat:messages_read    Mensagens marcadas como lidas
 *   ticket:status_changed Status do ticket alterado
 *   ticket:assigned       Ticket atribuído
 *   timeline:new_event    Novo evento na timeline (sessão, script, etc)
 *   session:requested     Sessão remota solicitada
 *   session:consent       Resposta de consentimento
 *   session:started       Sessão remota iniciada
 *   session:ended         Sessão remota finalizada
 */
@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ── Room Management ──

  @SubscribeMessage('chat:join_ticket')
  handleJoinTicket(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    client.join(`ticket:${data.ticketId}`);
    this.logger.debug(`${client.id} joined ticket:${data.ticketId}`);
    return { event: 'chat:joined', data: { ticketId: data.ticketId } };
  }

  @SubscribeMessage('chat:leave_ticket')
  handleLeaveTicket(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    client.leave(`ticket:${data.ticketId}`);
    this.logger.debug(`${client.id} left ticket:${data.ticketId}`);
  }

  // ── Messages ──

  @SubscribeMessage('chat:send_message')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      ticketId: string;
      conteudo: string;
      remetenteId: string;
      remetenteNome: string;
      remetenteTipo: string;
    },
  ) {
    const remetenteTipo = data.remetenteTipo === 'client_user'
      ? ChatRemetenteTipo.CLIENT_USER
      : ChatRemetenteTipo.TECHNICIAN;

    const message = await this.chatService.enviarMensagem({
      ticketId: data.ticketId,
      remetenteTipo,
      remetenteId: data.remetenteId,
      remetenteNome: data.remetenteNome,
      conteudo: data.conteudo,
    });

    this.server.to(`ticket:${data.ticketId}`).emit('chat:new_message', message);
    return message;
  }

  @SubscribeMessage('chat:send_file')
  async handleSendFile(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: {
      ticketId: string;
      remetenteId: string;
      remetenteNome: string;
      remetenteTipo: string;
      arquivoUrl: string;
      arquivoNome: string;
      arquivoTamanho: number;
      conteudo?: string;
    },
  ) {
    const remetenteTipo = data.remetenteTipo === 'client_user'
      ? ChatRemetenteTipo.CLIENT_USER
      : ChatRemetenteTipo.TECHNICIAN;

    const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(data.arquivoNome);

    const message = await this.chatService.enviarMensagem({
      ticketId: data.ticketId,
      remetenteTipo,
      remetenteId: data.remetenteId,
      remetenteNome: data.remetenteNome,
      tipo: isImage ? ChatMessageTipo.IMAGEM : ChatMessageTipo.ARQUIVO,
      conteudo: data.conteudo || data.arquivoNome,
      arquivoUrl: data.arquivoUrl,
      arquivoNome: data.arquivoNome,
      arquivoTamanho: data.arquivoTamanho,
    });

    this.server.to(`ticket:${data.ticketId}`).emit('chat:new_message', message);
    return message;
  }

  // ── Typing & Read Receipts ──

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string; userId: string; nome: string; isTyping: boolean },
  ) {
    client.to(`ticket:${data.ticketId}`).emit('chat:user_typing', data);
  }

  @SubscribeMessage('chat:mark_read')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string; userId: string },
  ) {
    await this.chatService.marcarTodasComoLidas(data.ticketId, data.userId);
    this.server.to(`ticket:${data.ticketId}`).emit('chat:messages_read', {
      ticketId: data.ticketId,
      userId: data.userId,
      timestamp: new Date(),
    });
  }

  // ── Public methods for other modules to emit events ──

  emitSystemMessage(ticketId: string, message: any) {
    this.server.to(`ticket:${ticketId}`).emit('chat:new_message', message);
  }

  emitTicketStatusChanged(ticketId: string, data: {
    statusAnterior: string;
    statusNovo: string;
    autorNome: string;
    timestamp: Date;
  }) {
    this.server.to(`ticket:${ticketId}`).emit('ticket:status_changed', {
      ticketId,
      ...data,
    });
  }

  emitTicketAssigned(ticketId: string, data: {
    technicianId: string;
    technicianNome: string;
    timestamp: Date;
  }) {
    this.server.to(`ticket:${ticketId}`).emit('ticket:assigned', {
      ticketId,
      ...data,
    });
  }

  emitTimelineEvent(ticketId: string, event: any) {
    this.server.to(`ticket:${ticketId}`).emit('timeline:new_event', event);
  }

  emitSessionEvent(ticketId: string, eventName: string, data: any) {
    this.server.to(`ticket:${ticketId}`).emit(`session:${eventName}`, {
      ticketId,
      ...data,
    });
  }
}
