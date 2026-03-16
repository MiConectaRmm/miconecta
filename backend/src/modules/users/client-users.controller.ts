import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientUsersService } from './client-users.service';
import { CreateClientUserDto } from './dto/create-client-user.dto';

@ApiTags('Users - Clientes')
@Controller('users/clients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ClientUsersController {
  constructor(private readonly clientUsersService: ClientUsersService) {}

  @Post()
  @ApiOperation({ summary: 'Criar usuário do cliente' })
  async criar(@Req() req: any, @Body() dto: CreateClientUserDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.criar(tenantId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar usuários do cliente' })
  async listar(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.listar(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário do cliente por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.buscar(id, tenantId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar usuário do cliente' })
  async atualizar(@Req() req: any, @Param('id') id: string, @Body() dto: Partial<CreateClientUserDto>) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.atualizar(id, tenantId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Desativar usuário do cliente' })
  async desativar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.desativar(id, tenantId);
  }

  @Post(':id/invite')
  @ApiOperation({ summary: 'Gerar/reenviar convite' })
  async invite(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.clientUsersService.gerarConvite(id, tenantId);
  }
}
