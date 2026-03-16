import {
  Controller, Get, Post, Body, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ReportsService } from './reports.service';
import { ReportTipo, ReportFrequencia } from '../../database/entities/report-schedule.entity';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('executivo')
  @ApiOperation({ summary: 'Gerar resumo executivo do tenant' })
  async resumoExecutivo(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.gerarResumoExecutivo(tenantId);
  }

  @Get('disponibilidade')
  @ApiOperation({ summary: 'Relatório de disponibilidade de dispositivos' })
  async disponibilidade(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.gerarRelatorioDisponibilidade(tenantId);
  }

  @Get('agendamentos')
  @ApiOperation({ summary: 'Listar agendamentos de relatórios' })
  async listarAgendamentos(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.listarAgendamentos(tenantId);
  }

  @Post('agendamentos')
  @ApiOperation({ summary: 'Criar agendamento de relatório' })
  async criarAgendamento(@Req() req: any, @Body() body: {
    tipo: ReportTipo;
    nome: string;
    frequencia?: ReportFrequencia;
    destinatariosEmail?: string[];
    parametros?: Record<string, any>;
  }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.criarAgendamento(tenantId, {
      ...body,
      criadoPor: req.user.sub,
    });
  }
}
