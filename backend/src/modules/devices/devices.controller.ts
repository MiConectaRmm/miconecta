import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DevicesService } from './devices.service';

@ApiTags('dispositivos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar dispositivos do tenant' })
  listar(@Req() req: any, @Query() filtros: any) {
    return this.service.listarDispositivos(req.user.tenantId, filtros);
  }

  @Get('resumo')
  @ApiOperation({ summary: 'Resumo dos dispositivos' })
  resumo(@Req() req: any) {
    return this.service.resumo(req.user.tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar dispositivo por ID' })
  buscar(@Param('id') id: string) {
    return this.service.buscarDispositivo(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar dispositivo' })
  atualizar(@Param('id') id: string, @Body() dados: any) {
    return this.service.atualizarDispositivo(id, dados);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover dispositivo' })
  remover(@Param('id') id: string) {
    return this.service.removerDispositivo(id);
  }

  @Get(':id/inventario')
  @ApiOperation({ summary: 'Listar software instalado no dispositivo' })
  inventario(@Param('id') id: string) {
    return this.service.listarInventario(id);
  }
}
