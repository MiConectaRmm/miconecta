import {
  Controller, Get, Post, Body, Param, Req,
  UseGuards, Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgentsService } from './agents.service';

@ApiTags('Agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Post('provision')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Gerar token de provisionamento para tenant' })
  async provision(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.agentsService.gerarProvisionToken(tenantId);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar agente (usa provision token)' })
  async register(
    @Headers('x-agent-provision-token') provisionToken: string,
    @Body() body: {
      hostname: string;
      sistemaOperacional?: string;
      cpu?: string;
      ramTotalMb?: number;
      discoTotalMb?: number;
      discoDisponivelMb?: number;
      ipLocal?: string;
      ipExterno?: string;
      modeloMaquina?: string;
      numeroSerie?: string;
      agentVersion?: string;
    },
  ) {
    return this.agentsService.registrar(provisionToken, body);
  }

  @Post('heartbeat')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Heartbeat do agente com metricas' })
  async heartbeat(
    @Req() req: any,
    @Body() body: {
      deviceId: string;
      cpuPercent?: number;
      ramPercent?: number;
      ramUsadaMb?: number;
      discoPercent?: number;
      discoUsadoMb?: number;
      temperatura?: number;
      uptimeSegundos?: number;
      redeEntradaBytes?: number;
      redeSaidaBytes?: number;
      antivirusStatus?: string;
      antivirusNome?: string;
    },
  ) {
    const tenantId = req.user.tenantId;
    return this.agentsService.heartbeat(body.deviceId, tenantId, body);
  }
}
