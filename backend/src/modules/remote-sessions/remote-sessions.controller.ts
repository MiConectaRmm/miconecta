import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { AgentAuthGuard } from '../auth/guards/agent-auth.guard';
import { RemoteSessionsService } from './remote-sessions.service';
import {
  SolicitarSessaoDto,
  ConsentimentoDto,
  FinalizarSessaoDto,
  RegistrarEvidenciaDto,
  SessionFilterDto,
  IniciarSessaoDto,
  CancelarSessaoDto,
  LogRegistroDto,
} from './dto/remote-session.dto';

@ApiTags('Remote Sessions')
@Controller('remote-sessions')
export class RemoteSessionsController {
  constructor(private readonly sessionsService: RemoteSessionsService) {}

  // ══════════════════════════════════════════════════
  // ENDPOINTS TÉCNICO (JWT + RBAC)
  // ══════════════════════════════════════════════════

  @Post()
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico_senior', 'tecnico')
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicitar sessão remota (aplica política automática)' })
  async solicitar(@Req() req: any, @Body() dto: SolicitarSessaoDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.solicitar({
      tenantId,
      deviceId: dto.deviceId,
      technicianId: req.user.sub,
      ticketId: dto.ticketId,
      motivo: dto.motivo,
      ipTecnico: req.ip,
      gravarSessao: dto.gravarSessao,
      userRole: req.user.funcao || req.user.role,
    });
  }

  @Get()
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar sessões remotas' })
  async listar(@Req() req: any, @Query() filtros: SessionFilterDto) {
    const isSuperRole = ['super_admin', 'admin_maginf', 'admin'].includes(req.user?.role);
    const tenantId = isSuperRole
      ? (filtros.deviceTenantId || req.tenantId || req.user.tenantId)
      : (req.tenantId || req.user.tenantId);
    return this.sessionsService.listar(tenantId, filtros);
  }

  @Get('estatisticas')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estatísticas de sessões remotas' })
  async estatisticas(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.estatisticas(tenantId);
  }

  @Get('device/:deviceId/policy')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consultar política de acesso para um device' })
  async consultarPolitica(@Param('deviceId') deviceId: string) {
    return this.sessionsService.consultarPoliticaDevice(deviceId);
  }

  @Get('device/:deviceId/historico')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de sessões de um device' })
  async historicoDevice(@Req() req: any, @Param('deviceId') deviceId: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.historicoDevice(deviceId, tenantId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar sessão por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.buscar(id, tenantId);
  }

  @Put(':id/start')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar sessão como iniciada' })
  async iniciar(@Param('id') id: string, @Body() dto: IniciarSessaoDto) {
    return this.sessionsService.iniciar(id, dto.rustdeskSessionId);
  }

  @Put(':id/end')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Finalizar sessão remota' })
  async finalizar(@Param('id') id: string, @Body() dto: FinalizarSessaoDto) {
    return this.sessionsService.finalizar(id, dto);
  }

  @Put(':id/cancel')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancelar sessão remota' })
  async cancelar(@Req() req: any, @Param('id') id: string, @Body() dto: CancelarSessaoDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.cancelar(id, tenantId, dto.motivo, req.user.nome);
  }

  @Put(':id/error')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Marcar sessão com erro' })
  async marcarErro(@Param('id') id: string, @Body() body: { erro: string }) {
    return this.sessionsService.marcarErro(id, body.erro);
  }

  @Post(':id/log')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar ação/log na sessão' })
  async registrarLog(@Param('id') id: string, @Body() dto: LogRegistroDto) {
    return this.sessionsService.registrarLog(id, dto);
  }

  @Get(':id/logs')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar todos logs da sessão' })
  async listarLogs(@Param('id') id: string) {
    return this.sessionsService.listarLogs(id);
  }

  @Post(':id/evidencia')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar evidência (screenshot, arquivo, clipboard)' })
  async registrarEvidencia(@Param('id') id: string, @Body() dto: RegistrarEvidenciaDto) {
    return this.sessionsService.registrarEvidencia(id, dto);
  }

  @Get(':id/evidencias')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar evidências da sessão' })
  async listarEvidencias(@Param('id') id: string) {
    return this.sessionsService.listarEvidencias(id);
  }

  @Put(':id/consent')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('sessions:write')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Registrar consentimento (fallback via painel)' })
  async consent(@Param('id') id: string, @Body() dto: ConsentimentoDto) {
    return this.sessionsService.registrarConsentimento(id, dto.consentido, {
      usuarioLocal: dto.usuarioLocal,
      hostname: dto.hostname,
      ip: dto.ip,
    });
  }

  // ══════════════════════════════════════════════════
  // ENDPOINTS AGENTE (Agent Auth — sem RBAC)
  // ══════════════════════════════════════════════════

  @Get('agent/pendentes')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Sessões pendentes de consentimento (polling do agente)' })
  async agentPendentes(@Req() req: any) {
    return this.sessionsService.pendentesParaDevice(req.deviceId);
  }

  @Put('agent/:id/consent')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Registrar consentimento do usuário local (via agente)' })
  async agentConsent(@Param('id') id: string, @Body() dto: ConsentimentoDto) {
    return this.sessionsService.registrarConsentimento(id, dto.consentido, {
      usuarioLocal: dto.usuarioLocal,
      hostname: dto.hostname,
      ip: dto.ip,
      deviceId: dto.deviceId,
    });
  }
}
