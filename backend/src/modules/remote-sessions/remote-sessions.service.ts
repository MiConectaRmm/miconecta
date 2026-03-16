import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RemoteSession, RemoteSessionStatus } from '../../database/entities/remote-session.entity';
import { RemoteSessionLog, RemoteSessionLogTipo } from '../../database/entities/remote-session-log.entity';
import { ConsentRecord, ConsentTipo } from '../../database/entities/consent-record.entity';

@Injectable()
export class RemoteSessionsService {
  constructor(
    @InjectRepository(RemoteSession)
    private readonly sessionRepo: Repository<RemoteSession>,
    @InjectRepository(RemoteSessionLog)
    private readonly logRepo: Repository<RemoteSessionLog>,
    @InjectRepository(ConsentRecord)
    private readonly consentRepo: Repository<ConsentRecord>,
  ) {}

  async solicitar(dados: {
    tenantId: string;
    deviceId: string;
    technicianId: string;
    ticketId?: string;
    motivo?: string;
    ipTecnico?: string;
  }) {
    const session = this.sessionRepo.create({
      tenantId: dados.tenantId,
      deviceId: dados.deviceId,
      technicianId: dados.technicianId,
      ticketId: dados.ticketId,
      motivo: dados.motivo,
      ipTecnico: dados.ipTecnico,
      status: RemoteSessionStatus.SOLICITADA,
    });

    return this.sessionRepo.save(session);
  }

  async registrarConsentimento(
    sessionId: string,
    consentido: boolean,
    dados: { usuarioLocal?: string; ip?: string },
  ) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    // Registrar consent record (LGPD)
    await this.consentRepo.save({
      tenantId: session.tenantId,
      tipo: ConsentTipo.ACESSO_REMOTO,
      concedenteTipo: 'usuario_local_dispositivo',
      concedenteNome: dados.usuarioLocal || 'Desconhecido',
      concedenteIp: dados.ip,
      deviceId: session.deviceId,
      sessionId: session.id,
      consentido,
    });

    if (consentido) {
      await this.sessionRepo.update(sessionId, {
        status: RemoteSessionStatus.CONSENTIDA,
        consentidoPor: dados.usuarioLocal,
        consentidoEm: new Date(),
      });
    } else {
      await this.sessionRepo.update(sessionId, {
        status: RemoteSessionStatus.RECUSADA,
      });
    }

    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async iniciar(sessionId: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    if (session.status !== RemoteSessionStatus.CONSENTIDA) {
      throw new ForbiddenException('Sessão não foi consentida');
    }

    await this.sessionRepo.update(sessionId, {
      status: RemoteSessionStatus.ATIVA,
      iniciadaEm: new Date(),
    });

    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async finalizar(sessionId: string, resumo?: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    const agora = new Date();
    const duracao = session.iniciadaEm
      ? Math.round((agora.getTime() - session.iniciadaEm.getTime()) / 1000)
      : 0;

    await this.sessionRepo.update(sessionId, {
      status: RemoteSessionStatus.FINALIZADA,
      finalizadaEm: agora,
      duracaoSegundos: duracao,
      resumo,
    });

    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async registrarLog(sessionId: string, dados: {
    tipo: RemoteSessionLogTipo;
    descricao: string;
    detalhes?: Record<string, any>;
    arquivoUrl?: string;
  }) {
    const log = this.logRepo.create({
      sessionId,
      tipo: dados.tipo,
      descricao: dados.descricao,
      detalhes: dados.detalhes,
      arquivoUrl: dados.arquivoUrl,
    });
    return this.logRepo.save(log);
  }

  async buscar(id: string, tenantId: string) {
    const session = await this.sessionRepo.findOne({
      where: { id, tenantId },
      relations: ['device', 'technician', 'ticket'],
    });
    if (!session) throw new NotFoundException('Sessão não encontrada');
    return session;
  }

  async listar(tenantId: string, filtros?: any) {
    const query = this.sessionRepo.createQueryBuilder('session')
      .leftJoinAndSelect('session.device', 'device')
      .leftJoinAndSelect('session.technician', 'technician')
      .where('session.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('session.status = :status', { status: filtros.status });
    }
    if (filtros?.deviceId) {
      query.andWhere('session.deviceId = :deviceId', { deviceId: filtros.deviceId });
    }

    return query.orderBy('session.criadoEm', 'DESC').take(100).getMany();
  }

  async listarLogs(sessionId: string) {
    return this.logRepo.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    });
  }
}
