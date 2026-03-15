import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantsService } from './tenants.service';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar novo tenant' })
  criar(@Body() dados: any) {
    return this.service.criarTenant(dados);
  }

  @Get()
  @ApiOperation({ summary: 'Listar todos os tenants' })
  listar() {
    return this.service.listarTenants();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar tenant por ID' })
  buscar(@Param('id') id: string) {
    return this.service.buscarTenant(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Atualizar tenant' })
  atualizar(@Param('id') id: string, @Body() dados: any) {
    return this.service.atualizarTenant(id, dados);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Remover tenant' })
  remover(@Param('id') id: string) {
    return this.service.removerTenant(id);
  }

  // Organizações
  @Post(':tenantId/organizacoes')
  @ApiOperation({ summary: 'Criar organização no tenant' })
  criarOrg(@Param('tenantId') tenantId: string, @Body() dados: any) {
    return this.service.criarOrganizacao(tenantId, dados);
  }

  @Get(':tenantId/organizacoes')
  @ApiOperation({ summary: 'Listar organizações do tenant' })
  listarOrgs(@Param('tenantId') tenantId: string) {
    return this.service.listarOrganizacoes(tenantId);
  }
}
