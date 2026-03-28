import {
  Controller, Post, Get, Put, Body, Req, Param, Delete, Query,
  UseGuards, Headers, Res, ForbiddenException,
} from '@nestjs/common';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AgentAuthGuard } from '../auth/guards/agent-auth.guard';
import { AgentsService } from './agents.service';
import { ChatService } from '../chat/chat.service';
import { ChatGateway } from '../chat/chat.gateway';
import { TicketsService } from '../tickets/tickets.service';
import { ConversationsService } from '../conversations/conversations.service';
import { ChatRemetenteTipo } from '../../database/entities/chat-message.entity';
import { ConversationType } from '../../database/entities/conversation.entity';
import { ParticipantRole } from '../../database/entities/conversation-participant.entity';
import { ConversationMessageType } from '../../database/entities/conversation-message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Ticket, TicketStatus, TicketOrigem, TicketPrioridade } from '../../database/entities/ticket.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto, InstallationTokenCreateDto } from './dto/agent.dto';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
    private readonly ticketsService: TicketsService,
    private readonly conversationsService: ConversationsService,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  @Get('download-info')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter informações de download do agente para o tenant' })
  async downloadInfo(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.getDownloadInfo(tenantId, this.configService);
  }

  @Get('download/msi')
  @ApiOperation({ summary: 'Download do instalador MSI do agente (público)' })
  async downloadMsi(@Res() res: Response) {
    // Procurar MSI em assets/ (commitado no git) ou uploads/packages/ (volume persistente)
    const candidates = [
      path.join(process.cwd(), 'assets', 'MIConectaSetup.msi'),
      path.join(process.cwd(), 'uploads', 'packages', 'MIConectaSetup.msi'),
    ];
    const msiPath = candidates.find(p => fs.existsSync(p));
    if (!msiPath) {
      return res.status(404).json({ message: 'Instalador não disponível. Entre em contato com o suporte.' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', 'attachment; filename="MIConectaSetup.msi"');
    return res.sendFile(msiPath);
  }

  @Post('provision')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar token de provisionamento para tenant' })
  async provision(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.gerarProvisionToken(tenantId);
  }

  @Get('installation-tokens')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar tokens de instalação do tenant' })
  async listInstallationTokens(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.listarInstallationTokens(tenantId);
  }

  @Post('installation-tokens')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar token de instalação' })
  async createInstallationToken(@Req() req: any, @Body() dto: InstallationTokenCreateDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.criarInstallationToken(tenantId, dto);
  }

  @Delete('installation-tokens/:id')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revogar token de instalação' })
  async revokeInstallationToken(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.revogarInstallationToken(tenantId, id);
  }

  @Get('agents')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar agentes do tenant' })
  async listAgents(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.listarAgentes(tenantId);
  }

  @Get('install-script/:tenantId')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar script de instalação (.bat ou .ps1) para o tenant' })
  async installScript(
    @Param('tenantId') tenantId: string,
    @Req() req: any,
  ) {
    const format = (req.query?.format as string) || 'bat';
    return this.agentsService.generateInstallScript(tenantId, this.configService, format);
  }

  @Get('installer-page/:tenantId')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Página HTML de instalador (download MSI) para o tenant' })
  async installerPage(
    @Param('tenantId') tenantId: string,
    @Res() res: Response,
  ) {
    const html = await this.agentsService.buildInstallerLandingHtml(tenantId, this.configService);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.send(html);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar agente (usa provision token, sem auth JWT)' })
  async register(
    @Headers('x-agent-provision-token') provisionToken: string,
    @Body() dto: AgentRegisterDto,
  ) {
    return this.agentsService.registrar(provisionToken, dto);
  }

  @Post('heartbeat')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Heartbeat do agente com métricas' })
  async heartbeat(@Req() req: any, @Body() dto: AgentHeartbeatDto) {
    const agentToken = req.headers['x-agent-token'] || req.body.agentToken;
    return this.agentsService.heartbeat(agentToken, dto);
  }

  @Get('check-update')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Verifica se há atualização disponível para o agente' })
  async checkUpdate(@Req() req: any) {
    return this.agentsService.verificarAtualizacao();
  }

  @Post('inventory')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Agente envia inventário (software + hardware)' })
  async inventory(
    @Req() req: any,
    @Headers('x-device-id') deviceId: string,
    @Body() dto: AgentInventoryDto,
  ) {
    const tenantId = req.user.tenantId;
    return this.agentsService.atualizarInventario(deviceId, tenantId, dto);
  }

  // ─── Agent Chat Endpoints ─────────────────────────────────────

  @Get('me/support-context')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Logo do tenant, nome e avatar do técnico (painel do agente)' })
  async meSupportContext(@Req() req: any) {
    const device = req.device;
    const tenantId = req.tenantId;
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    const publicBase = (this.configService.get<string>('PUBLIC_API_URL') || '').replace(/\/$/, '');

    const openOnly = [
      TicketStatus.ABERTO,
      TicketStatus.EM_ATENDIMENTO,
      TicketStatus.AGUARDANDO_CLIENTE,
      TicketStatus.AGUARDANDO_TECNICO,
    ];

    const tickets = await this.ticketRepo.find({
      where: { deviceId: device.id, tenantId, status: In(openOnly) },
      relations: ['tecnicoAtribuido'],
      order: { atualizadoEm: 'DESC' },
      take: 15,
    });

    let technicianName = 'Equipe de suporte';
    let technicianAvatarUrl: string | null = null;
    for (const t of tickets) {
      if (t.tecnicoAtribuido?.nome) {
        technicianName = t.tecnicoAtribuido.nome;
        technicianAvatarUrl = t.tecnicoAtribuido.avatarUrl || null;
        break;
      }
    }

    const absolutize = (u: string | null | undefined): string | null => {
      if (!u) return null;
      const s = u.trim();
      if (/^https?:\/\//i.test(s)) return s;
      if (!publicBase) return s.startsWith('/') ? s : `/${s}`;
      return `${publicBase}${s.startsWith('/') ? '' : '/'}${s}`;
    };

    return {
      companyName: tenant?.nome || 'MIConecta',
      logoUrl: absolutize(tenant?.logoUrl),
      technicianName,
      technicianAvatarUrl: absolutize(technicianAvatarUrl),
    };
  }

  @Get('me/tickets/history')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Histórico de tickets finalizados do dispositivo (agent chat)' })
  async meTicketsHistory(@Req() req: any) {
    const device = req.device;
    const tenantId = req.tenantId;
    const tickets = await this.ticketRepo.find({
      where: {
        deviceId: device.id,
        tenantId,
        status: In([TicketStatus.RESOLVIDO, TicketStatus.FECHADO, TicketStatus.CANCELADO]),
      },
      order: { atualizadoEm: 'DESC' },
      take: 40,
    });

    return tickets.map(t => ({
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      status: t.status,
      atualizadoEm: t.atualizadoEm,
    }));
  }

  @Get('me/tickets')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Listar tickets em aberto do dispositivo (agent chat)' })
  async meTickets(@Req() req: any) {
    const device = req.device;
    const tenantId = req.tenantId;

    const openOnly = [
      TicketStatus.ABERTO,
      TicketStatus.EM_ATENDIMENTO,
      TicketStatus.AGUARDANDO_CLIENTE,
      TicketStatus.AGUARDANDO_TECNICO,
    ];

    const tickets = await this.ticketRepo.find({
      where: { deviceId: device.id, tenantId, status: In(openOnly) },
      order: { criadoEm: 'DESC' },
      take: 50,
    });

    return tickets.map(t => ({
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      descricao: t.descricao,
      status: t.status,
      prioridade: t.prioridade,
      criadoEm: t.criadoEm,
      atualizadoEm: t.atualizadoEm,
    }));
  }

  @Post('me/tickets')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Criar ticket a partir do agente (agent chat)' })
  async meCreateTicket(
    @Req() req: any,
    @Body() body: { titulo: string; descricao: string; prioridade?: string },
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    const ticket = this.ticketRepo.create({
      tenantId,
      deviceId: device.id,
      organizationId: device.organizationId || null,
      titulo: body.titulo,
      descricao: body.descricao || '',
      prioridade: (body.prioridade as TicketPrioridade) || TicketPrioridade.MEDIA,
      status: TicketStatus.ABERTO,
      origem: TicketOrigem.AGENTE,
      criadoPorTipo: 'device',
      criadoPorId: device.id,
      criadoPorNome: device.hostname || 'Dispositivo',
    });

    const saved = await this.ticketRepo.save(ticket);

    // Enviar mensagem de sistema no ticket
    const sysMsg = await this.chatService.enviarMensagemSistema(
      saved.id,
      `Ticket criado pelo dispositivo ${device.hostname || device.id}`,
    );

    // Mesmo canal que tickets criados pela API: tenant + atendimento:update
    this.chatGateway.emitNotification(tenantId, {
      type: 'ticket_created',
      ticketId: saved.id,
      tenantId,
      titulo: saved.titulo,
      timestamp: new Date(),
    });
    this.chatGateway.emitTicketUpdated(saved.id, {
      ticketId: saved.id,
      status: saved.status,
      prioridade: saved.prioridade,
      hasUnreadFromClient: false,
    });

    return {
      id: saved.id,
      numero: saved.numero,
      titulo: saved.titulo,
      status: saved.status,
      criadoEm: saved.criadoEm,
    };
  }

  @Get('me/tickets/:ticketId/messages')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Listar mensagens de um ticket do dispositivo (agent chat)' })
  async meTicketMessages(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    // Verificar se o ticket pertence ao device ou ao tenant
    const ticket = await this.ticketRepo.findOne({
      where: [{ id: ticketId, deviceId: device.id, tenantId }],
    });
    if (!ticket) {
      return { error: 'Ticket não encontrado', messages: [] };
    }

    const messages = await this.chatService.listarMensagens(
      ticketId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );

    return messages.map(m => ({
      id: m.id,
      conteudo: m.conteudo,
      content: m.conteudo,
      remetenteTipo: m.remetenteTipo,
      senderType: m.remetenteTipo,
      remetenteNome: m.remetenteNome,
      senderName: m.remetenteNome,
      remetenteId: m.remetenteId,
      tipo: m.tipo,
      criadoEm: m.criadoEm,
      createdAt: m.criadoEm,
      lido: m.lido,
    }));
  }

  @Post('me/tickets/:ticketId/messages')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Enviar mensagem em um ticket do dispositivo (agent chat)' })
  async meTicketSendMessage(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Body() body: { conteudo: string },
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    // Verificar se o ticket pertence ao device ou ao tenant
    const ticket = await this.ticketRepo.findOne({
      where: [{ id: ticketId, deviceId: device.id, tenantId }],
    });
    if (!ticket) {
      return { error: 'Ticket não encontrado' };
    }

    const message = await this.chatService.enviarMensagem({
      ticketId,
      deviceId: device.id,
      remetenteTipo: ChatRemetenteTipo.CLIENT_USER,
      remetenteId: device.id,
      remetenteNome: device.hostname || 'Dispositivo',
      conteudo: body.conteudo,
    });

    // Emitir via WebSocket para técnicos receberem em tempo real
    const normalized = {
      id: message.id,
      ticketId: message.ticketId,
      deviceId: message.deviceId,
      senderType: message.remetenteTipo,
      senderId: message.remetenteId,
      senderName: message.remetenteNome,
      type: message.tipo,
      content: message.conteudo,
      read: message.lido,
      readAt: message.lidoEm,
      createdAt: message.criadoEm,
      remetenteTipo: message.remetenteTipo,
      remetenteId: message.remetenteId,
      remetenteNome: message.remetenteNome,
      tipo: message.tipo,
      conteudo: message.conteudo,
      lido: message.lido,
      lidoEm: message.lidoEm,
      criadoEm: message.criadoEm,
    };
    this.chatGateway.emitMessage(ticketId, normalized);
    this.chatGateway.emitNotification(tenantId, {
      type: 'ticket_message',
      ticketId,
      tenantId,
      message: normalized,
      timestamp: new Date(),
    });

    return normalized;
  }

  // ── Concluir ticket pelo cliente (agente) ──

  @Put('me/tickets/:ticketId/concluir')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Concluir/resolver ticket pelo cliente (agent chat)' })
  async meTicketConcluir(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    const ticket = await this.ticketRepo.findOne({
      where: [{ id: ticketId, deviceId: device.id, tenantId }],
    });
    if (!ticket) {
      return { error: 'Ticket não encontrado' };
    }

    // Atualizar status para resolvido
    await this.ticketRepo.update(ticketId, {
      status: TicketStatus.RESOLVIDO,
      resolvidoEm: new Date(),
    });

    // Mensagem de sistema
    await this.chatService.enviarMensagemSistema(
      ticketId,
      `Ticket concluído pelo cliente (${device.hostname || 'Dispositivo'})`,
    );

    // Emitir via WebSocket
    this.chatGateway.emitTicketUpdated(ticketId, {
      ticketId,
      status: TicketStatus.RESOLVIDO,
    });
    this.chatGateway.emitAtendimento('atendimento:ticket_updated', {
      type: 'ticket_resolved',
      ticketId,
      tenantId,
      resolvedBy: 'client',
      deviceHostname: device.hostname,
      timestamp: new Date(),
    });

    return { id: ticketId, status: 'resolvido', message: 'Ticket concluído com sucesso' };
  }

  // ── Avaliar ticket pelo cliente (agente) ──

  @Post('me/tickets/:ticketId/avaliar')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Avaliar satisfação do atendimento (agent chat)' })
  async meTicketAvaliar(
    @Req() req: any,
    @Param('ticketId') ticketId: string,
    @Body() body: { nota: number; comentario?: string },
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    const ticket = await this.ticketRepo.findOne({
      where: [{ id: ticketId, deviceId: device.id, tenantId }],
    });
    if (!ticket) {
      return { error: 'Ticket não encontrado' };
    }

    const nota = Math.min(5, Math.max(1, Math.round(body.nota)));

    await this.ticketRepo.update(ticketId, {
      avaliacaoNota: nota,
      avaliacaoComentario: body.comentario || undefined,
    });

    // Mensagem de sistema com a avaliação
    const labels = ['', 'Péssimo', 'Ruim', 'Mediano', 'Bom', 'Excelente'];
    const emojis = ['', '😠', '😟', '😐', '😊', '😄'];
    await this.chatService.enviarMensagemSistema(
      ticketId,
      `Avaliação: ${emojis[nota]} ${labels[nota]} (${nota}/5)${body.comentario ? ' - ' + body.comentario : ''}`,
    );

    // Fechar ticket após avaliação
    await this.ticketRepo.update(ticketId, {
      status: TicketStatus.FECHADO,
      fechadoEm: new Date(),
    });

    // Emitir via WebSocket
    this.chatGateway.emitTicketUpdated(ticketId, {
      ticketId,
      status: TicketStatus.FECHADO,
    } as any);

    return { id: ticketId, nota, status: 'fechado', message: 'Avaliação registrada' };
  }

  // ─── Agent Conversation Endpoints ─────────────────────────────

  @Get('me/conversations')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Listar conversas do dispositivo autenticado' })
  async meConversations(@Req() req: any) {
    const device = req.device;
    const tenantId = req.tenantId;
    return this.conversationsService.listarPorDevice(device.id, tenantId);
  }

  @Get('me/chat/unread')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Mensagens não lidas (tickets + conversas) para o agente' })
  async meChatUnread(@Req() req: any) {
    const device = req.device;
    const tenantId = req.tenantId;
    const ticketMsgs = await this.chatService.listarMensagensNaoLidasAgente(device.id, tenantId);
    const convMsgs = await this.conversationsService.listarMensagensNaoLidasDispositivo(device.id, tenantId);
    const list: Record<string, unknown>[] = [];
    for (const m of ticketMsgs) {
      list.push({
        id: m.id,
        ticketId: m.ticketId,
        conversationId: null,
        remetenteNome: m.remetenteNome,
        conteudo: m.conteudo,
        criadoEm: m.criadoEm,
      });
    }
    for (const m of convMsgs) {
      list.push({
        id: m.id,
        ticketId: null,
        conversationId: m.conversationId,
        remetenteNome: m.senderName,
        conteudo: m.content,
        criadoEm: m.criadoEm,
      });
    }
    return list;
  }

  @Post('me/conversations')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Criar conversa a partir do agente (sem ticket)' })
  async meCreateConversation(
    @Req() req: any,
    @Body() body: { titulo?: string; mensagemInicial?: string },
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    const conversation = await this.conversationsService.criar({
      tenantId,
      type: ConversationType.DEVICE,
      titulo: body.titulo || `Chat - ${device.hostname || 'Dispositivo'}`,
      deviceId: device.id,
    });

    // Adicionar device como participante
    await this.conversationsService.adicionarParticipante({
      conversationId: conversation.id,
      deviceId: device.id,
      participantName: device.hostname || 'Dispositivo',
      role: ParticipantRole.CLIENT,
    });

    // Mensagem inicial se fornecida
    if (body.mensagemInicial) {
      await this.conversationsService.enviarMensagem({
        conversationId: conversation.id,
        senderDeviceId: device.id,
        senderName: device.hostname || 'Dispositivo',
        senderType: 'device',
        content: body.mensagemInicial,
        type: ConversationMessageType.TEXT,
      });
    }

    // Emitir via WebSocket
    this.chatGateway.emitConversationNew(tenantId, conversation);

    return conversation;
  }

  @Get('me/conversations/:conversationId/messages')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Listar mensagens de uma conversa do dispositivo' })
  async meConversationMessages(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const device = req.device;
    const tenantId = req.tenantId;
    const conversation = await this.conversationsService.buscar(conversationId, tenantId);
    const parts = await this.conversationsService.listarParticipantes(conversation.id);
    if (!parts.some((p) => p.deviceId === device.id)) {
      throw new ForbiddenException('Dispositivo não participa desta conversa');
    }
    const msgs = await this.conversationsService.listarMensagens(
      conversation.id,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0,
    );
    await this.conversationsService.marcarComoLidaPorDevice(conversation.id, device.id);
    return msgs;
  }

  @Post('me/conversations/:conversationId/messages')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Enviar mensagem em uma conversa do dispositivo' })
  async meConversationSendMessage(
    @Req() req: any,
    @Param('conversationId') conversationId: string,
    @Body() body: { content: string },
  ) {
    const device = req.device;
    const tenantId = req.tenantId;

    const conversation = await this.conversationsService.buscar(conversationId, tenantId);
    const parts = await this.conversationsService.listarParticipantes(conversation.id);
    if (!parts.some((p) => p.deviceId === device.id)) {
      throw new ForbiddenException('Dispositivo não participa desta conversa');
    }

    const message = await this.conversationsService.enviarMensagem({
      conversationId: conversation.id,
      senderDeviceId: device.id,
      senderName: device.hostname || 'Dispositivo',
      senderType: 'device',
      content: body.content,
      type: ConversationMessageType.TEXT,
    });

    // Igual ao WebSocket conversation:message: conversa + notification:new (tenant) + atendimento:update
    this.chatGateway.emitConversationMessage(conversation.id, message);
    this.chatGateway.emitNotification(tenantId, {
      type: 'conversation_message',
      conversationId: conversation.id,
      tenantId,
      message,
      timestamp: new Date(),
    });

    return message;
  }
}
