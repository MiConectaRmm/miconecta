import { Controller, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DevicesService } from './devices.service';

@ApiTags('agente')
@Controller('agent')
export class AgentController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('register')
  @ApiOperation({ summary: 'Registrar novo dispositivo via agente' })
  async registrar(@Body() dados: any) {
    return this.devicesService.registrarDispositivo(dados);
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Heartbeat do agente' })
  async heartbeat(
    @Headers('x-device-id') deviceId: string,
    @Body() metricas: any,
  ) {
    return this.devicesService.heartbeat(deviceId, metricas);
  }

  @Post('inventory')
  @ApiOperation({ summary: 'Atualizar inventário de software' })
  async inventario(
    @Headers('x-device-id') deviceId: string,
    @Body() dados: { softwares: any[] },
  ) {
    return this.devicesService.atualizarInventario(deviceId, dados.softwares);
  }
}
