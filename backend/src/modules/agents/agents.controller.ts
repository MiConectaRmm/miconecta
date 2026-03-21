import {
  Controller, Post, Get, Body, Req, Param, Delete,
  UseGuards, Headers,
} from '@nestjs/common';
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
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto, InstallationTokenCreateDto } from './dto/agent.dto';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly configService: ConfigService,
  ) {}

  @Get('download-info')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter informações de download do agente para o tenant' })
  async downloadInfo(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.getDownloadInfo(tenantId, this.configService);
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
  @Roles('super_admin', 'admin_maginf', 'admin')
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
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar agentes do tenant' })
  async listAgents(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.listarAgentes(tenantId);
  }

  @Get('install-script/:tenantId')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Roles('super_admin', 'admin_maginf', 'admin')
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
}
