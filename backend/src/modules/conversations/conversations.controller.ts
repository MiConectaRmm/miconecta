import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ConversationsService } from './conversations.service';
import { CreateConversationDto, SendConversationMessageDto } from './dto/conversation.dto';
import { ParticipantRole } from '../../database/entities/conversation-participant.entity';
import { ConversationStatus, ConversationType } from '../../database/entities/conversation.entity';

@ApiTags('Conversations')
@Controller('conversations')
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
@ApiBearerAuth()
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Listar conversas do tenant' })
  async listar(
    @Req() req: any,
    @Query('status') status?: ConversationStatus,
    @Query('type') type?: ConversationType,
  ) {
    const tenantId = req.user.tenantId;
    // Portal (cliente): só conversas em que o usuário participa.
    // Técnicos: todas as conversas do tenant (inclui DEVICE só com agente — inbox / suporte).
    const isClient = req.user.userType === 'client_user';
    return this.conversationsService.listar(tenantId, {
      status,
      type,
      ...(isClient ? { userId: req.user.sub } : {}),
    });
  }

  @Get('me')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Listar conversas do usuário logado' })
  async minhasConversas(@Req() req: any) {
    return this.conversationsService.listarPorParticipante(req.user.sub, req.user.tenantId);
  }

  @Get(':id')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Buscar conversa por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.buscar(id, req.user.tenantId);
  }

  @Post()
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Criar nova conversa' })
  async criar(@Req() req: any, @Body() dto: CreateConversationDto) {
    const conversation = await this.conversationsService.criar({
      tenantId: req.user.tenantId,
      type: dto.type,
      titulo: dto.titulo,
      deviceId: dto.deviceId,
    });

    // Adicionar o criador como participante
    const role = req.user.userType === 'client_user'
      ? ParticipantRole.CLIENT
      : ParticipantRole.TECHNICIAN;

    await this.conversationsService.adicionarParticipante({
      conversationId: conversation.id,
      userId: req.user.sub,
      participantName: req.user.nome,
      role,
    });

    // Enviar mensagem inicial se fornecida
    if (dto.mensagemInicial) {
      await this.conversationsService.enviarMensagem({
        conversationId: conversation.id,
        senderUserId: req.user.sub,
        senderName: req.user.nome,
        senderType: req.user.userType === 'client_user' ? 'client' : 'technician',
        content: dto.mensagemInicial,
      });
    }

    return this.conversationsService.buscar(conversation.id, req.user.tenantId);
  }

  @Get(':id/messages')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Listar mensagens da conversa' })
  async listarMensagens(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    // Validar acesso
    await this.conversationsService.buscar(id, req.user.tenantId);
    return this.conversationsService.listarMensagens(id, limit || 100, offset || 0);
  }

  @Post(':id/messages')
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Enviar mensagem na conversa' })
  async enviarMensagem(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: SendConversationMessageDto,
  ) {
    // Validar acesso
    await this.conversationsService.buscar(id, req.user.tenantId);

    // Garantir que o remetente é participante
    const role = req.user.userType === 'client_user'
      ? ParticipantRole.CLIENT
      : ParticipantRole.TECHNICIAN;

    await this.conversationsService.adicionarParticipante({
      conversationId: id,
      userId: req.user.sub,
      participantName: req.user.nome,
      role,
    });

    return this.conversationsService.enviarMensagem({
      conversationId: id,
      senderUserId: req.user.sub,
      senderName: req.user.nome,
      senderType: req.user.userType === 'client_user' ? 'client' : 'technician',
      content: dto.content,
      type: dto.type,
      arquivoUrl: dto.arquivoUrl,
      arquivoNome: dto.arquivoNome,
      arquivoTamanho: dto.arquivoTamanho,
    });
  }

  @Put(':id/read')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Marcar conversa como lida' })
  async marcarComoLida(@Req() req: any, @Param('id') id: string) {
    await this.conversationsService.buscar(id, req.user.tenantId);
    await this.conversationsService.marcarComoLida(id, req.user.sub);
    return { message: 'Conversa marcada como lida' };
  }

  @Get(':id/unread')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Contar mensagens não lidas na conversa' })
  async contarNaoLidas(@Req() req: any, @Param('id') id: string) {
    await this.conversationsService.buscar(id, req.user.tenantId);
    const count = await this.conversationsService.contarNaoLidas(id, req.user.sub);
    return { conversationId: id, unread: count };
  }

  @Get(':id/participants')
  @RequirePermissions('tickets:read')
  @ApiOperation({ summary: 'Listar participantes da conversa' })
  async listarParticipantes(@Req() req: any, @Param('id') id: string) {
    await this.conversationsService.buscar(id, req.user.tenantId);
    return this.conversationsService.listarParticipantes(id);
  }

  @Put(':id/close')
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Fechar conversa' })
  async fechar(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.fechar(id, req.user.tenantId);
  }

  @Put(':id/reopen')
  @RequirePermissions('tickets:write')
  @ApiOperation({ summary: 'Reabrir conversa' })
  async reabrir(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.reabrir(id, req.user.tenantId);
  }
}
