import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../../database/entities/device.entity';
import { Agent } from '../../../database/entities/agent.entity';

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Agent)
    private readonly agentRepo: Repository<Agent>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-agent-token'];
    const deviceId = request.headers['x-device-id'];

    if (!token || !deviceId) {
      throw new UnauthorizedException('Token ou ID do dispositivo ausente');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; tenantId: string; deviceId: string; type: string }>(String(token));

      if (payload.type !== 'agent' || payload.deviceId !== deviceId) {
        throw new UnauthorizedException('Token inválido para este dispositivo');
      }

      const agent = await this.agentRepo.findOne({ where: { id: payload.sub, tenantId: payload.tenantId, deviceId } });
      const device = await this.deviceRepo.findOne({ where: { id: deviceId, tenantId: payload.tenantId } });

      if (!device || !agent) {
        throw new UnauthorizedException('Dispositivo não autorizado');
      }

      request.device = device;
      request.agent = agent;
      request.tenantId = payload.tenantId;
      request.agentPayload = payload;

      return true;
    } catch {
      throw new UnauthorizedException('Agente não autorizado');
    }
  }
}
