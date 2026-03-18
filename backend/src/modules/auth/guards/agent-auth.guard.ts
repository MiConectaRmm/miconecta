import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../../database/entities/device.entity';
import { Agent } from '../../../database/entities/agent.entity';
import * as crypto from 'crypto';

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
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

    const agent = await this.agentRepo.findOne({ where: { deviceId } });
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });

    if (!device || !agent) {
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    if (agent.agentTokenHash !== tokenHash) {
      throw new UnauthorizedException('Agente não autorizado');
    }

    request.device = device;
    request.agent = agent;
    return true;
  }
}
