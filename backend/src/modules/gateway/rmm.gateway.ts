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
    for (const [deviceId, socketId] of this.agentConnections) {
      if (socketId === client.id) {
        this.agentConnections.delete(deviceId);
        this.deviceRepo.update({ id: deviceId }, { status: DeviceStatus.OFFLINE }).catch(() => {});
        this.server.to('dashboard').emit('device:offline', { deviceId });
        break;
      }
    }
    this.dashboardClients.delete(client.id);
  }

  // ── Agente se anuncia online ──
  @SubscribeMessage('agent.online')
  handleAgentOnline(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string; tenantId: string; agentVersion?: string; loggedUser?: string },
  ) {
    if (!data?.deviceId) return { status: 'erro', mensagem: 'deviceId obrigatório' };

    this.agentConnections.set(data.deviceId, client.id);
    client.join(`device:${data.deviceId}`);
    client.join(`tenant:${data.tenantId}`);

    this.deviceRepo.update({ id: data.deviceId }, {
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
    }).catch(() => {});

    this.logger.log(`Agente online: deviceId=${data.deviceId} loggedUser=${data.loggedUser ?? '?'}`);
    this.server.to('dashboard').emit('device:online', {
      deviceId: data.deviceId,
      tenantId: data.tenantId,
      loggedUser: data.loggedUser,
      agentVersion: data.agentVersion,
    });

    return { status: 'ok' };
  }

  // Compatibilidade com handler antigo
  @SubscribeMessage('agent:register')
  handleAgentRegister(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { deviceId: string },
  ) {
    return this.handleAgentOnline(client, { deviceId: data.deviceId, tenantId: '' });
  }

  // ── Dashboard se registra ──
  @SubscribeMessage('dashboard:join')
  handleDashboardJoin(@ConnectedSocket() client: Socket) {
    client.join('dashboard');
    this.dashboardClients.add(client.id);
    return { status: 'ok', agentesOnline: this.agentConnections.size };
  }

  // ── Agente envia métricas em tempo real ──
  @SubscribeMessage('agent.metrics')
  handleAgentMetrics(@MessageBody() data: any) {
    const deviceId = data?.deviceId;
    if (deviceId) {
      this.server.to('dashboard').emit('device:metrics', data);
    }
  }

  // Compatibilidade
  @SubscribeMessage('agent:metrics')
  handleAgentMetricsLegacy(@MessageBody() data: { deviceId: string; metricas: any }) {
    this.server.to('dashboard').emit('device:metrics', data);
  }

  // ── Script concluído (agente → backend → dashboard) ──
  @SubscribeMessage('script.completed')
  handleScriptCompleted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { executionId: string; deviceId: string; saida: string; sucesso: boolean; exitCode: number },
  ) {
    this.logger.log(`Script concluído: execId=${data.executionId} sucesso=${data.sucesso}`);
    this.server.to('dashboard').emit('script:completed', data);
    return { status: 'ok' };
  }

  // ── Script iniciado ──
  @SubscribeMessage('script.started')
  handleScriptStarted(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { executionId: string; deviceId: string },
  ) {
    this.server.to('dashboard').emit('script:started', data);
  }

  // ── Consentimento de sessão remota ──
  @SubscribeMessage('remote.consent')
  handleRemoteConsent(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { sessionId: string; deviceId: string; consentido: boolean },
  ) {
    this.logger.log(`Consentimento recebido: sessionId=${data.sessionId} consentido=${data.consentido}`);
    this.server.to('dashboard').emit('remote:consent', data);
    return { status: 'ok' };
  }

  // ── Alerta do agente ──
  @SubscribeMessage('agent:alert')
  handleAgentAlert(@MessageBody() data: { deviceId: string; alerta: any }) {
    this.server.to('dashboard').emit('alert:new', data);
  }

  // ── Dashboard despacha script para agente ──
  @SubscribeMessage('command:execute')
  handleCommand(@MessageBody() data: { deviceId: string; comando: any }) {
    const socketId = this.agentConnections.get(data.deviceId);
    if (socketId) {
      this.server.to(socketId).emit('script.dispatch', data.comando);
      return { status: 'enviado' };
    }
    return { status: 'erro', mensagem: 'Dispositivo não conectado' };
  }

  // ── Dashboard despacha script (novo protocolo) ──
  @SubscribeMessage('script.dispatch')
  handleScriptDispatch(@MessageBody() data: { deviceId: string; payload: any }) {
    const socketId = this.agentConnections.get(data.deviceId);
    if (socketId) {
      this.server.to(socketId).emit('script.dispatch', data.payload);
      return { status: 'enviado' };
    }
    return { status: 'erro', mensagem: 'Dispositivo não conectado' };
  }

  // ── Dashboard envia solicitação de sessão remota ──
  @SubscribeMessage('remote.request')
  handleRemoteRequest(@MessageBody() data: { deviceId: string; sessionId: string; tecnico: string; motivo?: string }) {
    const socketId = this.agentConnections.get(data.deviceId);
    if (socketId) {
      this.server.to(socketId).emit('remote.request', data);
      return { status: 'enviado' };
    }
    return { status: 'erro', mensagem: 'Dispositivo não conectado' };
  }

  // ── Helpers públicos (chamados por outros services) ──

  /** Verifica se um agente está conectado via WebSocket */
  isAgentOnline(deviceId: string): boolean {
    return this.agentConnections.has(deviceId);
  }

  /** Envia evento para um agente específico */
  emitToAgent(deviceId: string, event: string, data: any): boolean {
    const socketId = this.agentConnections.get(deviceId);
    if (!socketId) return false;
    this.server.to(socketId).emit(event, data);
    return true;
  }

  /** Envia evento para todos os dashboards conectados */
  emitToDashboard(event: string, data: any) {
    this.server.to('dashboard').emit(event, data);
  }

  /** Total de agentes conectados */
  get agentesOnline(): number {
    return this.agentConnections.size;
  }
}

