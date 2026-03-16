import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatService } from './chat.service';
import { ChatRemetenteTipo } from '../../database/entities/chat-message.entity';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('tickets/:ticketId/messages')
  @ApiOperation({ summary: 'Listar mensagens do ticket' })
  async listarMensagens(
    @Param('ticketId') ticketId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.chatService.listarMensagens(ticketId, limit || 100, offset || 0);
  }

  @Post('tickets/:ticketId/messages')
  @ApiOperation({ summary: 'Enviar mensagem no ticket' })
  async enviarMensagem(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Body() body: { conteudo: string; tipo?: string; arquivoUrl?: string; arquivoNome?: string },
  ) {
    const remetenteTipo = req.user.userType === 'client_user'
      ? ChatRemetenteTipo.CLIENT_USER
      : ChatRemetenteTipo.TECHNICIAN;

    return this.chatService.enviarMensagem({
      ticketId,
      remetenteTipo,
      remetenteId: req.user.sub,
      remetenteNome: req.user.nome,
      conteudo: body.conteudo,
      arquivoUrl: body.arquivoUrl,
      arquivoNome: body.arquivoNome,
    });
  }

  @Put('messages/:id/read')
  @ApiOperation({ summary: 'Marcar mensagem como lida' })
  async marcarComoLida(@Param('id') id: string) {
    return this.chatService.marcarComoLida(id);
  }

  @Put('tickets/:ticketId/read-all')
  @ApiOperation({ summary: 'Marcar todas mensagens do ticket como lidas' })
  async marcarTodasComoLidas(@Req() req: any, @Param('ticketId') ticketId: string) {
    await this.chatService.marcarTodasComoLidas(ticketId, req.user.sub);
    return { message: 'Mensagens marcadas como lidas' };
  }
}
