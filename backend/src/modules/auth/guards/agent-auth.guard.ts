import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../../database/entities/device.entity';

@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-agent-token'];
    const deviceId = request.headers['x-device-id'];

    if (!token || !deviceId) {
      throw new UnauthorizedException('Token ou ID do dispositivo ausente');
    }

    const device = await this.deviceRepo.findOne({
      where: { id: deviceId, deviceToken: token },
    });

    if (!device) {
      throw new UnauthorizedException('Dispositivo não autorizado');
    }

    request.device = device;
    return true;
  }
}
