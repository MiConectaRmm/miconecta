import {
  Controller, Get, Put, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlertsService } from './alerts.service';

@ApiTags('alertas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('alerts')
export class AlertsController {
  constructor(private readonly service: AlertsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar alertas do tenant' })
  listar(@Req() req: any, @Query() filtros: any) {
    return this.service.listarAlertas(req.user.tenantId, filtros);
  }

  @Get('contagem')
  @ApiOperation({ summary: 'Contar alertas ativos' })
  contar(@Req() req: any) {
    return this.service.contarAlertas(req.user.tenantId);
  }

  @Put(':id/reconhecer')
  @ApiOperation({ summary: 'Reconhecer alerta' })
  reconhecer(@Param('id') id: string, @Req() req: any) {
    return this.service.reconhecerAlerta(id, req.user.nome);
  }

  @Put(':id/resolver')
  @ApiOperation({ summary: 'Resolver alerta' })
  resolver(@Param('id') id: string) {
    return this.service.resolverAlerta(id);
  }
}
