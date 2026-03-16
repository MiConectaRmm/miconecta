import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { TechniciansService } from './technicians.service';
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto/create-technician.dto';
import { TechnicianRole } from '../../database/entities/technician.entity';

@ApiTags('Users - Técnicos Maginf')
@Controller('users/technicians')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class TechniciansController {
  constructor(private readonly techniciansService: TechniciansService) {}

  @Post()
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Criar técnico Maginf' })
  async criar(@Req() req: any, @Body() dto: CreateTechnicianDto) {
    return this.techniciansService.criar(dto, req.user.role || req.user.funcao);
  }

  @Get()
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar técnicos' })
  async listar(@Query('tenantId') tenantId?: string, @Query('funcao') funcao?: TechnicianRole, @Query('ativo') ativo?: boolean) {
    return this.techniciansService.listar({ tenantId, funcao, ativo });
  }

  @Get('contagem')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Contagem de técnicos' })
  async contagem() {
    return this.techniciansService.contagem();
  }

  @Get(':id')
  @Roles('super_admin', 'admin_maginf', 'admin', 'tecnico_senior')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Buscar técnico por ID' })
  async buscar(@Param('id') id: string) {
    return this.techniciansService.buscar(id);
  }

  @Put(':id')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Atualizar técnico' })
  async atualizar(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateTechnicianDto) {
    return this.techniciansService.atualizar(id, dto, req.user.role || req.user.funcao);
  }

  @Delete(':id')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Desativar técnico' })
  async desativar(@Param('id') id: string) {
    return this.techniciansService.desativar(id);
  }

  @Put(':id/reativar')
  @Roles('super_admin', 'admin_maginf', 'admin')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Reativar técnico' })
  async reativar(@Param('id') id: string) {
    return this.techniciansService.reativar(id);
  }
}
