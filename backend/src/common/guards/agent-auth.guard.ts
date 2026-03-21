import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../database/entities/device.entity';

/**
 * Guard para endpoints chamados pelo agente.
 * Valida o header x-device-id + x-agent-token contra o banco.
 */
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const deviceId = request.headers['x-device-id'];
    const token = request.headers['x-agent-token'];

    if (!deviceId || !token) {
      throw new UnauthorizedException('x-device-id e x-agent-token obrigatórios');
    }

    const device = await this.deviceRepo.findOne({
      where: { id: deviceId, deviceToken: token },
    });

    if (!device) {
      throw new UnauthorizedException('Token do agente inválido');
    }

    // Injetar device no request para uso nos controllers
    request.device = device;
    request.tenantId = device.tenantId;

    return true;
  }
}
