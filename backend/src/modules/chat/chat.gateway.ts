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
import { ChatService } from './chat.service';
import { ChatRemetenteTipo } from '../../database/entities/chat-message.entity';

@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly chatService: ChatService) {}

  handleConnection(client: Socket) {
    console.log(`Chat: client connected ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Chat: client disconnected ${client.id}`);
  }

  @SubscribeMessage('chat:join_ticket')
  handleJoinTicket(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    client.join(`ticket:${data.ticketId}`);
    return { event: 'chat:joined', data: { ticketId: data.ticketId } };
  }

  @SubscribeMessage('chat:leave_ticket')
  handleLeaveTicket(@ConnectedSocket() client: Socket, @MessageBody() data: { ticketId: string }) {
    client.leave(`ticket:${data.ticketId}`);
  }

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

  @SubscribeMessage('chat:typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { ticketId: string; userId: string; nome: string; isTyping: boolean },
  ) {
    client.to(`ticket:${data.ticketId}`).emit('chat:user_typing', data);
  }

  // Método público para emitir mensagens de sistema de outros módulos
  emitSystemMessage(ticketId: string, message: any) {
    this.server.to(`ticket:${ticketId}`).emit('chat:new_message', message);
  }
}
