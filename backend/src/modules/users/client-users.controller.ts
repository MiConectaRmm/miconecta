import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantAccessGuard } from '../../common/guards/tenant-access.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { ClientUsersService } from './client-users.service';
import { CreateClientUserDto } from './dto/create-client-user.dto';

@ApiTags('Users - Clientes')
@Controller('users/clients')
@UseGuards(JwtAuthGuard, TenantAccessGuard, RolesGuard, PermissionsGuard)
@ApiBearerAuth()
export class ClientUsersController {
  constructor(private readonly clientUsersService: ClientUsersService) {}

  @Post()
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Criar usuário do cliente' })
  async criar(@Req() req: any, @Body() dto: CreateClientUserDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.criar(tenantId, dto);
  }

  @Get()
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Listar usuários do cliente' })
  async listar(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.listar(tenantId);
  }

  @Get(':id')
  @RequirePermissions('users:read')
  @ApiOperation({ summary: 'Buscar usuário do cliente por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.buscar(id, tenantId);
  }

  @Put(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Atualizar usuário do cliente' })
  async atualizar(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateClientUserDto>) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.atualizar(id, tenantId, dto);
  }

  @Delete(':id')
  @RequirePermissions('users:write')
  @ApiOperation({ summary: 'Desativar usuário do cliente' })
  async desativar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.desativar(id, tenantId);
  }

  @Post(':id/invite')
  @RequirePermissions('users:invite')
  @ApiOperation({ summary: 'Gerar/reenviar convite' })
  async invite(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.gerarConvite(id, tenantId);
  }
}
