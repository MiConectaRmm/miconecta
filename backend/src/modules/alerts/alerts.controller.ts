import {
  Controller, Get, Put, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AlertsService } from './alerts.service';

@ApiTags('Alertas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @RequirePermissions('alerts:read')
  @ApiOperation({ summary: 'Listar alertas do tenant' })
  listar(@Req() req: any, @Query() filtros: any) {
    const tenantId = filtros.tenantId || req.tenantId || req.user.tenantId;
    return this.service.listarAlertas(tenantId, filtros);
  }

  @Get('contagem')
  @RequirePermissions('alerts:read')
  @ApiOperation({ summary: 'Contar alertas ativos' })
  contar(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.service.contarAlertas(tenantId);
  }

  @Put(':id/reconhecer')
  @RequirePermissions('alerts:acknowledge')
  @ApiOperation({ summary: 'Reconhecer alerta' })
  reconhecer(@Param('id') id: string, @Req() req: any) {
    return this.service.reconhecerAlerta(id, req.user.nome);
  }

  @Put(':id/resolver')
  @RequirePermissions('alerts:acknowledge')
  @ApiOperation({ summary: 'Resolver alerta' })
  resolver(@Param('id') id: string) {
    return this.service.resolverAlerta(id);
  }
}
