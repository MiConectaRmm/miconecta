import {
  Controller, Post, Get, Body, Req,
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
import { AgentsService } from './agents.service';
import { AgentRegisterDto, AgentHeartbeatDto, AgentInventoryDto } from './dto/agent.dto';

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

  @Post('register')
  @ApiOperation({ summary: 'Registrar agente (usa provision token, sem auth JWT)' })
  async register(
    @Headers('x-agent-provision-token') provisionToken: string,
    @Body() dto: AgentRegisterDto,
  ) {
    return this.agentsService.registrar(provisionToken, dto);
  }

  @Post('heartbeat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Heartbeat do agente com métricas' })
  async heartbeat(@Req() req: any, @Body() dto: AgentHeartbeatDto) {
    const tenantId = req.user.tenantId;
    return this.agentsService.heartbeat(dto.deviceId, tenantId, dto);
  }

  @Post('inventory')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
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
