import { Controller, Get, Post, Body, Param, Query, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { MetricsService } from './metrics.service';

@ApiTags('Métricas')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  // Endpoint para o agente enviar métricas (autenticado via device JWT)
  @Post('report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agente reporta métricas' })
  async reportar(
    @Headers('x-device-id') deviceId: string,
    @Body() metricas: any,
  ) {
    return this.service.registrarMetricasBatch(deviceId, metricas);
  }

  @Get(':deviceId')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar métricas de um dispositivo' })
  async listar(
    @Param('deviceId') deviceId: string,
    @Query('inicio') inicio?: string,
    @Query('fim') fim?: string,
  ) {
    const periodo = inicio && fim
      ? { inicio: new Date(inicio), fim: new Date(fim) }
      : undefined;
    return this.service.listarMetricas(deviceId, periodo);
  }

  @Get(':deviceId/ultima')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Última métrica do dispositivo' })
  async ultima(@Param('deviceId') deviceId: string) {
    return this.service.ultimaMetrica(deviceId);
  }

  @Get(':deviceId/media')
  @UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
  @RequirePermissions('devices:read')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Média de métricas (padrão 24h)' })
  async media(
    @Param('deviceId') deviceId: string,
    @Query('horas') horas?: string,
  ) {
    return this.service.mediaMetricas(deviceId, horas ? parseInt(horas) : 24);
  }
}
