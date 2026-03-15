import {
  Controller, Get, Post, Put,
  Body, Param, Query, Headers, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PatchesService } from './patches.service';

@ApiTags('patches')
@Controller('patches')
export class PatchesController {
  constructor(private readonly service: PatchesService) {}

  // === Dashboard ===

  @Get('device/:deviceId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar patches de um dispositivo' })
  listar(@Param('deviceId') deviceId: string, @Query() filtros: any) {
    return this.service.listarPatches(deviceId, filtros);
  }

  @Get('resumo')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resumo de patches do tenant' })
  resumo(@Req() req: any) {
    return this.service.resumoPatches(req.user.tenantId);
  }

  @Put(':id/instalar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Solicitar instalação de patch' })
  instalar(@Param('id') id: string) {
    return this.service.instalarPatch(id);
  }

  @Put(':id/agendar')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Agendar instalação de patch' })
  agendar(@Param('id') id: string, @Body() body: { agendadoPara: string }) {
    return this.service.agendarPatch(id, new Date(body.agendadoPara));
  }

  // === Agente ===

  @Post('agent/sync')
  @ApiOperation({ summary: 'Sincronizar patches do dispositivo (agente)' })
  sincronizar(
    @Headers('x-device-id') deviceId: string,
    @Body() body: { patches: any[] },
  ) {
    return this.service.sincronizarPatches(deviceId, body.patches);
  }

  @Post('agent/status/:patchId')
  @ApiOperation({ summary: 'Atualizar status do patch (agente)' })
  atualizarStatus(
    @Param('patchId') patchId: string,
    @Body() body: { status: any },
  ) {
    return this.service.atualizarStatusPatch(patchId, body.status);
  }
}
