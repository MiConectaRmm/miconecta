import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ChatService } from './chat.service';
import { ChatRemetenteTipo } from '../../database/entities/chat-message.entity';
import { SendMessageDto } from './dto/chat-message.dto';
import { TicketIdsBodyDto } from './dto/ticket-ids-body.dto';

@ApiTags('Chat')
@Controller('chat')
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
@ApiBearerAuth()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('tickets/:ticketId/messages')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Listar mensagens do ticket (cursor: before* + limit; ou offset legado)' })
  async listarMensagens(
    @Param('ticketId') ticketId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
    @Query('beforeCreatedAt') beforeCreatedAt?: string,
    @Query('beforeId') beforeId?: string,
  ) {
    if (beforeCreatedAt && beforeId) {
      return this.chatService.listarHistoricoCursor(ticketId, limit || 40, {
        createdAt: beforeCreatedAt,
        id: beforeId,
      });
    }
    if (offset !== undefined && Number(offset) > 0) {
      const items = await this.chatService.listarHistoricoFormatado(ticketId, limit || 100, Number(offset));
      return { items, nextOlderCursor: null, hasMoreOlder: false };
    }
    return this.chatService.listarHistoricoCursor(ticketId, limit || 40, null);
  }

  @Post('tickets/unread-summary')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Contagem de mensagens não lidas por ticket (lote, até 200 ids)' })
  async unreadSummary(@Req() req: any, @Body() dto: TicketIdsBodyDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    const counts = await this.chatService.contagemNaoLidasPorTickets(dto.ticketIds, req.user.sub, tenantId);
    return { counts };
  }

  @Post('tickets/:ticketId/messages')
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Enviar mensagem no ticket (REST fallback)' })
  async enviarMensagem(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Body() dto: SendMessageDto,
  ) {
    const remetenteTipo = req.user.userType === 'client_user'
      ? ChatRemetenteTipo.CLIENT_USER
      : ChatRemetenteTipo.TECHNICIAN;

    const message = await this.chatService.enviarMensagem({
      ticketId,
      remetenteTipo,
      remetenteId: req.user.sub,
      remetenteNome: req.user.nome,
      tipo: dto.tipo,
      conteudo: dto.conteudo,
      arquivoUrl: dto.arquivoUrl,
      arquivoNome: dto.arquivoNome,
      arquivoTamanho: dto.arquivoTamanho,
    });
    return this.chatService.formatMensagemCanonica(message);
  }

  @Put('messages/:id/read')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Marcar mensagem como lida' })
  async marcarComoLida(@Param('id') id: string) {
    const message = await this.chatService.marcarComoLida(id);
    if (!message) return null;
    return this.chatService.formatMensagemCanonica(message);
  }

  @Put('tickets/:ticketId/read-all')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Marcar todas mensagens do ticket como lidas' })
  async marcarTodasComoLidas(@Req() req: any, @Param('ticketId') ticketId: string) {
    await this.chatService.marcarTodasComoLidas(ticketId, req.user.sub);
    return { message: 'Mensagens marcadas como lidas' };
  }

  @Get('tickets/:ticketId/unread')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Contar mensagens não lidas no ticket' })
  async contarNaoLidas(@Req() req: any, @Param('ticketId') ticketId: string) {
    const count = await this.chatService.contarNaoLidas(ticketId, req.user.sub);
    return { ticketId, unread: count };
  }

}
