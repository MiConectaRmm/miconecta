import { Controller, Get, Post, Body, Param, Query, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MetricsService } from './metrics.service';

@ApiTags('métricas')
@Controller('metrics')
export class MetricsController {
  constructor(private readonly service: MetricsService) {}

  // Endpoint para o agente enviar métricas
  @Post('report')
  @ApiOperation({ summary: 'Agente reporta métricas' })
  async reportar(
    @Headers('x-device-id') deviceId: string,
    @Body() metricas: any,
  ) {
    return this.service.registrarMetricasBatch(deviceId, metricas);
  }

  @Get(':deviceId')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Última métrica do dispositivo' })
  async ultima(@Param('deviceId') deviceId: string) {
    return this.service.ultimaMetrica(deviceId);
  }

  @Get(':deviceId/media')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Média de métricas' })
  async media(
    @Param('deviceId') deviceId: string,
    @Query('horas') horas?: string,
  ) {
    return this.service.mediaMetricas(deviceId, horas ? parseInt(horas) : 24);
  }
}
