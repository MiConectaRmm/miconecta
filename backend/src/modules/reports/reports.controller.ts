import {
  Controller, Get, Post, Body, Query, Res,
  UseGuards, Req, Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ReportsService } from './reports.service';
import { ReportTipo, ReportFrequencia } from '../../database/entities/report-schedule.entity';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
@ApiBearerAuth()
export class ReportsController {
  private readonly logger = new Logger(ReportsController.name);

  constructor(private readonly reportsService: ReportsService) {}

  // ══════════════════════════════════════════════════
  // RELATÓRIOS
  // ══════════════════════════════════════════════════

  @Get('executivo')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Gerar resumo executivo do tenant' })
  async resumoExecutivo(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.gerarResumoExecutivo(tenantId);
  }

  @Get('tecnico')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Gerar relatório técnico do tenant' })
  async relatorioTecnico(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.gerarRelatorioTecnico(tenantId);
  }

  @Get('disponibilidade')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Relatório de disponibilidade de dispositivos' })
  async disponibilidade(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.gerarRelatorioDisponibilidade(tenantId);
  }

  // ══════════════════════════════════════════════════
  // AGENDAMENTOS
  // ══════════════════════════════════════════════════

  @Get('agendamentos')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Listar agendamentos de relatórios' })
  async listarAgendamentos(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.reportsService.listarAgendamentos(tenantId);
  }

  @Post('agendamentos')
  @RequirePermissions('reports:read')
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

  // ══════════════════════════════════════════════════
  // EXPORTAÇÕES (CSV / JSON)
  // ══════════════════════════════════════════════════

  @Get('export/dispositivos')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Exportar dispositivos (CSV ou JSON)' })
  async exportDispositivos(@Req() req: any, @Res() res: Response, @Query('formato') formato?: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const fmt = formato === 'csv' ? 'csv' : 'json';
    const data = await this.reportsService.exportarDispositivos(tenantId, fmt);
    this.logger.log(`Export dispositivos ${fmt} por ${req.user.nome} (tenant=${tenantId})`);
    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="dispositivos_${Date.now()}.csv"`);
      return res.send(data);
    }
    return res.json(data);
  }

  @Get('export/tickets')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Exportar tickets (CSV ou JSON)' })
  async exportTickets(@Req() req: any, @Res() res: Response, @Query('formato') formato?: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const fmt = formato === 'csv' ? 'csv' : 'json';
    const data = await this.reportsService.exportarTickets(tenantId, fmt);
    this.logger.log(`Export tickets ${fmt} por ${req.user.nome} (tenant=${tenantId})`);
    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="tickets_${Date.now()}.csv"`);
      return res.send(data);
    }
    return res.json(data);
  }

  @Get('export/sessoes')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Exportar sessões remotas (CSV ou JSON)' })
  async exportSessoes(@Req() req: any, @Res() res: Response, @Query('formato') formato?: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const fmt = formato === 'csv' ? 'csv' : 'json';
    const data = await this.reportsService.exportarSessoes(tenantId, fmt);
    this.logger.log(`Export sessoes ${fmt} por ${req.user.nome} (tenant=${tenantId})`);
    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="sessoes_${Date.now()}.csv"`);
      return res.send(data);
    }
    return res.json(data);
  }

  @Get('export/inventario')
  @RequirePermissions('reports:read')
  @ApiOperation({ summary: 'Exportar inventário (CSV ou JSON)' })
  async exportInventario(@Req() req: any, @Res() res: Response, @Query('formato') formato?: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const fmt = formato === 'csv' ? 'csv' : 'json';
    const data = await this.reportsService.exportarInventario(tenantId, fmt);
    this.logger.log(`Export inventario ${fmt} por ${req.user.nome} (tenant=${tenantId})`);
    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="inventario_${Date.now()}.csv"`);
      return res.send(data);
    }
    return res.json(data);
  }

  @Get('export/audit')
  @RequirePermissions('audit:read')
  @ApiOperation({ summary: 'Exportar logs de auditoria (CSV ou JSON)' })
  async exportAudit(@Req() req: any, @Res() res: Response, @Query('formato') formato?: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const fmt = formato === 'csv' ? 'csv' : 'json';
    const data = await this.reportsService.exportarAuditLog(tenantId, fmt);
    this.logger.log(`Export audit ${fmt} por ${req.user.nome} (tenant=${tenantId})`);
    if (fmt === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit_${Date.now()}.csv"`);
      return res.send(data);
    }
    return res.json(data);
  }
}
