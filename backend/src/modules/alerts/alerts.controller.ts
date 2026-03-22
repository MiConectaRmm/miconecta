import {
  Controller, Get, Put, Post, Param, Query, Body, UseGuards, Req, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { AlertsService } from './alerts.service';
import { AgentAuthGuard } from '../../common/guards';
import { AlertType, AlertSeverity } from '../../database/entities/alert.entity';

@ApiTags('Alertas')
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  // ── Endpoint do agente (sem JWT, usa x-agent-token) ──
  @Post('agent')
  @UseGuards(AgentAuthGuard)
  @ApiOperation({ summary: 'Criar alerta a partir do agente (Fase 6)' })
  async criarAlertaAgente(
    @Headers('x-device-id') deviceId: string,
    @Body() body: { tipo: string; mensagem: string; severidade?: string },
  ) {
    const severidadeMap: Record<string, AlertSeverity> = {
      alta: AlertSeverity.CRITICO,
      critico: AlertSeverity.CRITICO,
      media: AlertSeverity.AVISO,
      baixa: AlertSeverity.INFO,
    };

    const tipoMap: Record<string, AlertType> = {
      patches_criticos: AlertType.UPDATE_PENDENTE,
      reboot_pendente: AlertType.CUSTOM,
      cpu_alta: AlertType.CPU_ALTA,
      ram_alta: AlertType.RAM_ALTA,
      disco_baixo: AlertType.DISCO_BAIXO,
    };

    return this.service.criarAlertaDoAgente(
      deviceId,
      tipoMap[body.tipo] ?? AlertType.CUSTOM,
      severidadeMap[body.severidade ?? 'media'] ?? AlertSeverity.AVISO,
      body.mensagem,
    );
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Get()
  @RequirePermissions('alerts:read')
  @ApiOperation({ summary: 'Listar alertas do tenant' })
  listar(@Req() req: any, @Query() filtros: any) {
    const isSuperRole = ['super_admin', 'admin_maginf', 'admin'].includes(req.user?.role);
    const tenantId = isSuperRole
      ? (filtros.tenantId || req.tenantId || req.user.tenantId)
      : (req.tenantId || req.user.tenantId);
    console.log('[alerts:listar]', { userId: req.user?.sub, role: req.user?.role, tenantId });
    return this.service.listarAlertas(tenantId, filtros);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Get('contagem')
  @RequirePermissions('alerts:read')
  @ApiOperation({ summary: 'Contar alertas ativos' })
  contar(@Req() req: any, @Query() filtros: any) {
    const isSuperRole = ['super_admin', 'admin_maginf', 'admin'].includes(req.user?.role);
    const tenantId = isSuperRole
      ? (filtros?.tenantId || req.tenantId || req.user.tenantId)
      : (req.tenantId || req.user.tenantId);
    console.log('[alerts:contagem]', { userId: req.user?.sub, role: req.user?.role, tenantId });
    return this.service.contarAlertas(tenantId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Put(':id/reconhecer')
  @RequirePermissions('alerts:acknowledge')
  @ApiOperation({ summary: 'Reconhecer alerta' })
  reconhecer(@Param('id') id: string, @Req() req: any) {
    return this.service.reconhecerAlerta(id, req.user.nome);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
  @Put(':id/resolver')
  @RequirePermissions('alerts:acknowledge')
  @ApiOperation({ summary: 'Resolver alerta' })
  resolver(@Param('id') id: string) {
    return this.service.resolverAlerta(id);
  }
}
