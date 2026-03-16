import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LgpdService } from './lgpd.service';
import { LgpdRequestTipo, LgpdRequestStatus } from '../../database/entities/lgpd-request.entity';
import { ConsentTipo } from '../../database/entities/consent-record.entity';

@ApiTags('LGPD')
@Controller('lgpd')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LgpdController {
  constructor(private readonly lgpdService: LgpdService) {}

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
  @ApiOperation({ summary: 'Processar solicitação LGPD' })
  async processar(@Req() req: any, @Param('id') id: string, @Body() body: {
    status: LgpdRequestStatus;
    resultadoUrl?: string;
  }) {
    return this.lgpdService.processarSolicitacao(id, req.user.sub, body);
  }

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
}
