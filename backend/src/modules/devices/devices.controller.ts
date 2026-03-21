import {
  Controller, Get, Put, Delete,
  Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { DevicesService } from './devices.service';
import { UpdateDeviceDto, DeviceFilterDto } from './dto/device.dto';

@ApiTags('Dispositivos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
@Controller('devices')
export class DevicesController {
  constructor(private readonly service: DevicesService) {}

  @Get()
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'Listar dispositivos do tenant' })
  listar(@Req() req: any, @Query() filtros: DeviceFilterDto) {
    const tenantId = filtros.tenantId || req.tenantId || req.user.tenantId;
    return this.service.listarDispositivos(tenantId, filtros);
  }

  @Get('resumo')
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'Resumo dos dispositivos (online/offline/alerta)' })
  resumo(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.service.resumo(tenantId);
  }

  @Get(':id')
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'Buscar dispositivo por ID com métricas e alertas' })
  buscar(@Param('id') id: string) {
    return this.service.buscarDispositivo(id);
  }

  @Put(':id')
  @RequirePermissions('devices:write')
  @ApiOperation({ summary: 'Atualizar dispositivo (tags, notas, organização)' })
  atualizar(@Param('id') id: string, @Body() dto: UpdateDeviceDto) {
    return this.service.atualizarDispositivo(id, dto);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('devices:write')
  @ApiOperation({ summary: 'Remover dispositivo' })
  remover(@Param('id') id: string) {
    return this.service.removerDispositivo(id);
  }

  @Get(':id/inventario')
  @RequirePermissions('devices:read')
  @ApiOperation({ summary: 'Listar inventário do dispositivo' })
  inventario(@Param('id') id: string, @Query('tipo') tipo?: string) {
    return this.service.listarInventario(id, tipo);
  }
}
