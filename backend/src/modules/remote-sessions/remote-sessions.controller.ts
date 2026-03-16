import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RemoteSessionsService } from './remote-sessions.service';
import { RemoteSessionLogTipo } from '../../database/entities/remote-session-log.entity';

@ApiTags('Remote Sessions')
@Controller('remote-sessions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RemoteSessionsController {
  constructor(private readonly sessionsService: RemoteSessionsService) {}

  @Post()
  @ApiOperation({ summary: 'Solicitar sessão remota' })
  async solicitar(@Req() req: any, @Body() body: { deviceId: string; ticketId?: string; motivo?: string }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.solicitar({
      tenantId,
      deviceId: body.deviceId,
      technicianId: req.user.sub,
      ticketId: body.ticketId,
      motivo: body.motivo,
      ipTecnico: req.ip,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar sessões remotas' })
  async listar(@Req() req: any, @Query() filtros: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.listar(tenantId, filtros);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar sessão por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.sessionsService.buscar(id, tenantId);
  }

  @Put(':id/consent')
  @ApiOperation({ summary: 'Registrar consentimento (do agente)' })
  async consent(@Param('id') id: string, @Body() body: { consentido: boolean; usuarioLocal?: string; ip?: string }) {
    return this.sessionsService.registrarConsentimento(id, body.consentido, {
      usuarioLocal: body.usuarioLocal,
      ip: body.ip,
    });
  }

  @Put(':id/start')
  @ApiOperation({ summary: 'Marcar sessão como iniciada' })
  async iniciar(@Param('id') id: string) {
    return this.sessionsService.iniciar(id);
  }

  @Put(':id/end')
  @ApiOperation({ summary: 'Finalizar sessão remota' })
  async finalizar(@Param('id') id: string, @Body() body: { resumo?: string }) {
    return this.sessionsService.finalizar(id, body.resumo);
  }

  @Post(':id/log')
  @ApiOperation({ summary: 'Registrar ação na sessão' })
  async registrarLog(
    @Param('id') id: string,
    @Body() body: { tipo: RemoteSessionLogTipo; descricao: string; detalhes?: Record<string, any>; arquivoUrl?: string },
  ) {
    return this.sessionsService.registrarLog(id, body);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Listar logs da sessão' })
  async listarLogs(@Param('id') id: string) {
    return this.sessionsService.listarLogs(id);
  }
}
