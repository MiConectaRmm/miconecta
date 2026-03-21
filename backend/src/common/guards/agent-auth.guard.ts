import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from '../../database/entities/device.entity';

/**
 * Guard para endpoints chamados pelo agente via HTTP.
 * Valida x-agent-token como JWT (mesmo token emitido em /agents/register).
 * Compatível com AgentsController.AgentAuthGuard mas sem dependência de Agent entity.
 */
@Injectable()
export class AgentAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = request.headers['x-agent-token'];
    const deviceId = request.headers['x-device-id'];

    if (!token || !deviceId) {
      throw new UnauthorizedException('x-device-id e x-agent-token obrigatórios');
    }

    try {
      const payload = this.jwtService.verify<{ sub: string; tenantId: string; deviceId: string; type: string }>(token);

      if (payload.type !== 'agent' || payload.deviceId !== deviceId) {
        throw new UnauthorizedException('Token inválido para este dispositivo');
      }

      const device = await this.deviceRepo.findOne({ where: { id: deviceId, tenantId: payload.tenantId } });
      if (!device) throw new UnauthorizedException('Dispositivo não encontrado');

      request.device = device;
      request.tenantId = payload.tenantId;
      request.agentPayload = payload;

      return true;
    } catch (err) {
      throw new UnauthorizedException('Token do agente inválido ou expirado');
    }
  }
}
