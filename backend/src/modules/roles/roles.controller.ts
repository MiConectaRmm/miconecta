import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesService } from './roles.service';

@ApiTags('Roles & Permissions')
@Controller('roles')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todos os roles' })
  listar(@Query('tipo') tipo?: 'maginf' | 'cliente') {
    if (tipo) return this.rolesService.getRolesByTipo(tipo);
    return this.rolesService.getAllRoles();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar role por ID' })
  buscar(@Param('id') id: string) {
    return this.rolesService.getRole(id);
  }

  @Get(':id/permissions')
  @ApiOperation({ summary: 'Listar permissões de um role' })
  permissions(@Param('id') id: string) {
    return { role: id, permissions: this.rolesService.getPermissions(id) };
  }
}
