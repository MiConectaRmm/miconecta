import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TenantsService } from './tenants.service';
import { CreateTenantDto, UpdateTenantDto, CreateOrganizationDto } from './dto/create-tenant.dto';

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Post()
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('tenants:write')
  @ApiOperation({ summary: 'Criar novo tenant (apenas admins Maginf)' })
  criar(@Body() dto: CreateTenantDto) {
    return this.service.criarTenant(dto);
  }

  @Get()
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('tenants:read')
  @ApiOperation({ summary: 'Listar todos os tenants' })
  listar() {
    return this.service.listarTenants();
  }

  @Get(':id')
  @RequirePermissions('tenants:read')
  @ApiOperation({ summary: 'Buscar tenant por ID' })
  buscar(@Param('id') id: string) {
    return this.service.buscarTenant(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('tenants:write')
  @ApiOperation({ summary: 'Atualizar tenant' })
  atualizar(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.service.atualizarTenant(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin_maginf')
  @RequirePermissions('tenants:delete')
  @ApiOperation({ summary: 'Remover tenant (super_admin/admin_maginf)' })
  remover(@Param('id') id: string) {
    return this.service.removerTenant(id);
  }

  // ── Organizações ──

  @Post(':tenantId/organizacoes')
  @RequirePermissions('tenants:write')
  @ApiOperation({ summary: 'Criar organização no tenant' })
  criarOrg(@Param('tenantId') tenantId: string, @Body() dto: CreateOrganizationDto) {
    return this.service.criarOrganizacao(tenantId, dto);
  }

  @Get(':tenantId/organizacoes')
  @RequirePermissions('tenants:read')
  @ApiOperation({ summary: 'Listar organizações do tenant' })
  listarOrgs(@Param('tenantId') tenantId: string) {
    return this.service.listarOrganizacoes(tenantId);
  }

  @Put('organizacoes/:id')
  @RequirePermissions('tenants:write')
  @ApiOperation({ summary: 'Atualizar organização' })
  atualizarOrg(@Param('id') id: string, @Body() dto: Partial<CreateOrganizationDto>) {
    return this.service.atualizarOrganizacao(id, dto);
  }

  @Delete('organizacoes/:id')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('tenants:delete')
  @ApiOperation({ summary: 'Remover organização' })
  removerOrg(@Param('id') id: string) {
    return this.service.removerOrganizacao(id);
  }
}
