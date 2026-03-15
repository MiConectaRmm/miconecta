import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Headers, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ScriptsService } from './scripts.service';

@ApiTags('scripts')
@Controller('scripts')
export class ScriptsController {
  constructor(private readonly service: ScriptsService) {}

  // === Endpoints do dashboard (autenticação JWT) ===

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar script' })
  criar(@Body() dados: any, @Req() req: any) {
    return this.service.criarScript({ ...dados, tenantId: req.user.tenantId });
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar scripts' })
  listar(@Req() req: any) {
    return this.service.listarScripts(req.user.tenantId);
  }

  @Get('historico')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Histórico de execuções' })
  historico(@Req() req: any, @Query() filtros: any) {
    return this.service.historicoExecucoes(req.user.tenantId, filtros);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar script por ID' })
  buscar(@Param('id') id: string) {
    return this.service.buscarScript(id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Atualizar script' })
  atualizar(@Param('id') id: string, @Body() dados: any) {
    return this.service.atualizarScript(id, dados);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover script' })
  remover(@Param('id') id: string) {
    return this.service.removerScript(id);
  }

  @Post(':id/executar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Executar script em dispositivos' })
  executar(
    @Param('id') id: string,
    @Body() body: { deviceIds: string[] },
    @Req() req: any,
  ) {
    return this.service.executarScript(id, body.deviceIds, req.user.nome);
  }

  // === Endpoints do agente ===

  @Get('agent/pendentes')
  @ApiOperation({ summary: 'Obter comandos pendentes (agente)' })
  pendentes(@Headers('x-device-id') deviceId: string) {
    return this.service.obterComandosPendentes(deviceId);
  }

  @Post('agent/resultado/:execId')
  @ApiOperation({ summary: 'Reportar resultado da execução (agente)' })
  resultado(@Param('execId') execId: string, @Body() resultado: any) {
    return this.service.atualizarExecucao(execId, resultado);
  }
}
