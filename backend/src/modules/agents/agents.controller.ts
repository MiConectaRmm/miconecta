import {
  Controller, Post, Get, Body, Req, Param, Delete, Query,
  UseGuards, Headers, Res,
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
import { ChatRemetenteTipo } from '../../database/entities/chat-message.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { Ticket, TicketStatus, TicketOrigem, TicketPrioridade } from '../../database/entities/ticket.entity';
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto, InstallationTokenCreateDto } from './dto/agent.dto';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly configService: ConfigService,
    private readonly chatService: ChatService,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
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

  @Get('me/tickets')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Listar tickets do dispositivo autenticado (agent chat)' })
  async meTickets(@Req() req: any) {
    const device = req.device;
    const tenantId = req.tenantId;

    const tickets = await this.ticketRepo.find({
      where: {
        deviceId: device.id,
        tenantId,
        status: Not(In([TicketStatus.FECHADO, TicketStatus.CANCELADO])),
      },
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
    await this.chatService.enviarMensagemSistema(
      saved.id,
      `Ticket criado pelo dispositivo ${device.hostname || device.id}`,
    );

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

    // Verificar se o ticket pertence ao device
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, deviceId: device.id, tenantId },
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

    // Verificar se o ticket pertence ao device
    const ticket = await this.ticketRepo.findOne({
      where: { id: ticketId, deviceId: device.id, tenantId },
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

    return {
      id: message.id,
      conteudo: message.conteudo,
      content: message.conteudo,
      remetenteTipo: message.remetenteTipo,
      senderType: message.remetenteTipo,
      remetenteNome: message.remetenteNome,
      senderName: message.remetenteNome,
      criadoEm: message.criadoEm,
      createdAt: message.criadoEm,
    };
  }
}
