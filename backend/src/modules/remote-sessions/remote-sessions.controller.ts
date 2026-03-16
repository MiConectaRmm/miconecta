import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentAuthGuard } from '../auth/guards/agent-auth.guard';
import { RemoteSessionsService } from './remote-sessions.service';
import { RemoteSessionLogTipo } from '../../database/entities/remote-session-log.entity';
import {
  SolicitarSessaoDto,
  ConsentimentoDto,
  FinalizarSessaoDto,
  RegistrarEvidenciaDto,
} from './dto/remote-session.dto';

@ApiTags('Remote Sessions')
@Controller('remote-sessions')
export class RemoteSessionsController {
  constructor(private readonly sessionsService: RemoteSessionsService) {}

  // ══════════════════════════════════════════════════
  // ENDPOINTS TÉCNICO (JWT Auth)
  // ══════════════════════════════════════════════════

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicitar sessão remota (aplica política automática)' })
  async solicitar(@Req() req: any, @Body() body: SolicitarSessaoDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.solicitar({
      tenantId,
      deviceId: body.deviceId,
      technicianId: req.user.sub,
      ticketId: body.ticketId,
      motivo: body.motivo,
      ipTecnico: req.ip,
      gravarSessao: body.gravarSessao,
      userRole: req.user.funcao || req.user.role,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sessões remotas' })
  async listar(@Req() req: any, @Query() filtros: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.listar(tenantId, filtros);
  }

  @Get('estatisticas')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estatísticas de sessões remotas' })
  async estatisticas(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.estatisticas(tenantId);
  }

  @Get('device/:deviceId/policy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar política de acesso para um device' })
  async consultarPolitica(@Param('deviceId') deviceId: string) {
    const { Device } = await import('../../database/entities/device.entity');
    const device = await this.sessionsService['deviceRepo'].findOne({ where: { id: deviceId } });
    if (!device) return { error: 'Dispositivo não encontrado' };
    return this.sessionsService.getPolicy(device);
  }

  @Get('device/:deviceId/historico')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de sessões de um device' })
  async historicoDevice(@Req() req: any, @Param('deviceId') deviceId: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.historicoDevice(deviceId, tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar sessão por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.buscar(id, tenantId);
  }

  @Put(':id/start')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar sessão como iniciada' })
  async iniciar(@Param('id') id: string, @Body() body: { rustdeskSessionId?: string }) {
    return this.sessionsService.iniciar(id, body.rustdeskSessionId);
  }

  @Put(':id/end')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalizar sessão remota' })
  async finalizar(@Param('id') id: string, @Body() body: FinalizarSessaoDto) {
    return this.sessionsService.finalizar(id, body);
  }

  @Put(':id/error')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar sessão com erro' })
  async marcarErro(@Param('id') id: string, @Body() body: { erro: string }) {
    return this.sessionsService.marcarErro(id, body.erro);
  }

  @Post(':id/log')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar ação na sessão' })
  async registrarLog(
    @Param('id') id: string,
    @Body() body: { tipo: RemoteSessionLogTipo; descricao: string; detalhes?: Record<string, any>; arquivoUrl?: string },
  ) {
    return this.sessionsService.registrarLog(id, body);
  }

  @Get(':id/logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos logs da sessão' })
  async listarLogs(@Param('id') id: string) {
    return this.sessionsService.listarLogs(id);
  }

  @Post(':id/evidencia')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar evidência (screenshot, arquivo, clipboard)' })
  async registrarEvidencia(@Param('id') id: string, @Body() body: RegistrarEvidenciaDto) {
    return this.sessionsService.registrarEvidencia(id, body);
  }

  @Get(':id/evidencias')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar evidências da sessão' })
  async listarEvidencias(@Param('id') id: string) {
    return this.sessionsService.listarEvidencias(id);
  }

  // ══════════════════════════════════════════════════
  // ENDPOINTS AGENTE (Agent Auth)
  // ══════════════════════════════════════════════════

  @Get('agent/pendentes')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Sessões pendentes de consentimento (polling do agente)' })
  async agentPendentes(@Req() req: any) {
    // Expirar sessões com timeout antes de retornar
    await this.sessionsService.expirarSessoesTimeout();
    return this.sessionsService.pendentesParaDevice(req.deviceId);
  }

  @Put('agent/:id/consent')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Registrar consentimento do usuário local (via agente)' })
  async agentConsent(@Param('id') id: string, @Body() body: ConsentimentoDto) {
    return this.sessionsService.registrarConsentimento(id, body.consentido, {
      usuarioLocal: body.usuarioLocal,
      hostname: body.hostname,
      ip: body.ip,
      deviceId: body.deviceId,
    });
  }

  @Put(':id/consent')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar consentimento (fallback via painel)' })
  async consent(@Param('id') id: string, @Body() body: ConsentimentoDto) {
    return this.sessionsService.registrarConsentimento(id, body.consentido, {
      usuarioLocal: body.usuarioLocal,
      hostname: body.hostname,
      ip: body.ip,
    });
  }
}
