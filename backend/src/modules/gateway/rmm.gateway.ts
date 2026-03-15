import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device, DeviceStatus } from '../../database/entities/device.entity';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/rmm',
})
export class RmmGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RmmGateway.name);
  private agentConnections = new Map<string, string>(); // deviceId -> socketId
  private dashboardClients = new Set<string>(); // socketIds

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  handleConnection(client: Socket) {
    this.logger.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente desconectado: ${client.id}`);

    // Remover agente desconectado
    for (const [deviceId, socketId] of this.agentConnections) {
      if (socketId === client.id) {
        this.agentConnections.delete(deviceId);
        this.deviceRepo.update(
          { id: deviceId },
          { status: DeviceStatus.OFFLINE },
        );
        // Notificar dashboard
        this.server.to('dashboard').emit('device:offline', { deviceId });
        break;
      }
    }

    this.dashboardClients.delete(client.id);
  }

  // Agente se registra via WebSocket
  @SubscribeMessage('agent:register')
  handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    this.agentConnections.set(data.deviceId, client.id);
    client.join(`device:${data.deviceId}`);
    this.logger.log(`Agente registrado: ${data.deviceId}`);

    // Notificar dashboard
    this.server.to('dashboard').emit('device:online', { deviceId: data.deviceId });

    return { status: 'ok' };
  }

  // Dashboard se registra
  @SubscribeMessage('dashboard:join')
  handleDashboardJoin(@ConnectedSocket() client: Socket) {
    client.join('dashboard');
    this.dashboardClients.add(client.id);
    this.logger.log(`Dashboard conectado: ${client.id}`);
    return { status: 'ok', agentesOnline: this.agentConnections.size };
  }

  // Agente envia métricas em tempo real
  @SubscribeMessage('agent:metrics')
  handleAgentMetrics(
    @MessageBody() data: { deviceId: string; metricas: any },
  ) {
    // Repassar para o dashboard
    this.server.to('dashboard').emit('device:metrics', data);
  }

  // Agente envia alerta
  @SubscribeMessage('agent:alert')
  handleAgentAlert(
    @MessageBody() data: { deviceId: string; alerta: any },
  ) {
    this.server.to('dashboard').emit('alert:new', data);
  }

  // Dashboard solicita execução de comando
  @SubscribeMessage('command:execute')
  handleCommand(
    @MessageBody() data: { deviceId: string; comando: any },
  ) {
    const socketId = this.agentConnections.get(data.deviceId);
    if (socketId) {
      this.server.to(socketId).emit('command:execute', data.comando);
      return { status: 'enviado' };
    }
    return { status: 'erro', mensagem: 'Dispositivo não conectado' };
  }
}
