import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AuthenticatedRequest } from '../../common/interfaces/authenticated-request.interface';
import { TenantsService } from './tenants.service';
import { AgentsService } from '../agents/agents.service';
import { GenerateClientInstallerDto } from '../agents/dto/agent.dto';

/**
 * Rotas REST sob /clients — o :id é o tenant (cliente MSP), alinhado ao dashboard /dashboard/clients/[id].
 */
@ApiTags('Clients')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly agentsService: AgentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post(':id/generate-installer')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:write')
  @ApiOperation({
    summary: 'Gerar pacote de instalador white-label (token único + scripts PS1/BAT)',
    description:
      'Cria installation_token, devolve scripts com ProvisionToken e URLs. Revogar: DELETE /agents/installation-tokens/:installationTokenId',
  })
  async generateInstaller(
    @Param('id') clientTenantId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: GenerateClientInstallerDto,
  ) {
    await this.tenantsService.buscarTenant(clientTenantId, req.user);
    return this.agentsService.gerarPacoteInstaladorCliente(clientTenantId, this.configService, dto || {});
  }
}
