import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { LgpdService } from './lgpd.service';
import { DataRetentionService } from './data-retention.service';
import { LgpdRequestTipo, LgpdRequestStatus } from '../../database/entities/lgpd-request.entity';
import { ConsentTipo } from '../../database/entities/consent-record.entity';

@ApiTags('LGPD')
@Controller('lgpd')
@UseGuards(JwtAuthGuard, TenantAccessGuard, PermissionsGuard)
@ApiBearerAuth()
export class LgpdController {
  constructor(
    private readonly lgpdService: LgpdService,
    private readonly retentionService: DataRetentionService,
  ) {}

  // ══════════════════════════════════════════════════
  // SOLICITAÇÕES LGPD (DSAR)
  // ══════════════════════════════════════════════════

  @Post('solicitacoes')
  @ApiOperation({ summary: 'Criar solicitação LGPD (DSAR)' })
  async criarSolicitacao(@Req() req: any, @Body() body: {
    tipo: LgpdRequestTipo;
    justificativa?: string;
  }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.lgpdService.criarSolicitacao(tenantId, {
      tipo: body.tipo,
      solicitanteTipo: req.user.userType || 'technician',
      solicitanteId: req.user.sub,
      solicitanteNome: req.user.nome,
      solicitanteEmail: req.user.email,
      justificativa: body.justificativa,
    });
  }

  @Get('solicitacoes')
  @ApiOperation({ summary: 'Listar solicitações LGPD' })
  async listarSolicitacoes(@Req() req: any, @Query('status') status?: LgpdRequestStatus) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.lgpdService.listarSolicitacoes(tenantId, { status });
  }

  @Put('solicitacoes/:id/processar')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'admin_maginf', 'admin')
  @ApiOperation({ summary: 'Processar solicitação LGPD' })
  async processar(@Req() req: any, @Param('id') id: string, @Body() body: {
    status: LgpdRequestStatus;
    resultadoUrl?: string;
  }) {
    return this.lgpdService.processarSolicitacao(id, req.user.sub, body);
  }

  // ══════════════════════════════════════════════════
  // CONSENTIMENTOS
  // ══════════════════════════════════════════════════

  @Get('consentimentos')
  @ApiOperation({ summary: 'Listar consentimentos do tenant' })
  async listarConsentimentos(@Req() req: any, @Query('tipo') tipo?: ConsentTipo) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.lgpdService.listarConsentimentos(tenantId, { tipo });
  }

  @Post('consentimentos')
  @ApiOperation({ summary: 'Registrar consentimento' })
  async registrarConsentimento(@Req() req: any, @Body() body: {
    tipo: ConsentTipo;
    consentido: boolean;
    versaoTermos?: string;
    deviceId?: string;
  }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.lgpdService.registrarConsentimento({
      tenantId,
      tipo: body.tipo,
      concedenteTipo: req.user.userType || 'technician',
      concedenteId: req.user.sub,
      concedenteNome: req.user.nome,
      concedenteIp: req.ip,
      deviceId: body.deviceId,
      consentido: body.consentido,
      versaoTermos: body.versaoTermos,
    });
  }

  // ══════════════════════════════════════════════════
  // RETENÇÃO DE DADOS
  // ══════════════════════════════════════════════════

  @Get('retencao/politicas')
  @ApiOperation({ summary: 'Consultar políticas de retenção de dados' })
  async politicasRetencao() {
    return this.retentionService.getPoliticas();
  }

  @Post('retencao/executar')
  @UseGuards(RolesGuard)
  @Roles('super_admin', 'admin_maginf')
  @ApiOperation({ summary: 'Executar limpeza manual de dados expirados' })
  async executarLimpeza() {
    return this.retentionService.executarLimpeza();
  }
}
