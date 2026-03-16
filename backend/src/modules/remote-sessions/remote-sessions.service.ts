import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { RemoteSession, RemoteSessionStatus, DevicePolicyType } from '../../database/entities/remote-session.entity';
import { RemoteSessionLog, RemoteSessionLogTipo } from '../../database/entities/remote-session-log.entity';
import { ConsentRecord, ConsentTipo } from '../../database/entities/consent-record.entity';
import { Device } from '../../database/entities/device.entity';
import { AccessPolicyDto, AccessPolicyType } from './dto/remote-session.dto';

/**
 * Políticas padrão por tipo de dispositivo.
 *
 * SERVIDOR:
 * - Consentimento dispensado (sem usuário interativo)
 * - Gravação obrigatória
 * - Exige ticket + motivo
 * - Notifica admin
 * - Horário restrito (06-22h)
 *
 * ESTAÇÃO:
 * - Consentimento obrigatório (LGPD)
 * - Gravação opcional
 * - Ticket/motivo opcionais
 * - Sem restrição de horário
 */
const DEFAULT_POLICIES: Record<string, AccessPolicyDto> = {
  servidor: {
    tipo: AccessPolicyType.SERVIDOR,
    exigeConsentimento: false,
    consentimentoTimeoutSegundos: 0,
    gravacaoObrigatoria: true,
    screenshotAutoConexao: true,
    screenshotAutoDesconexao: true,
    maxSessoesSimultaneas: 1,
    horariosPermitidos: { inicio: '06:00', fim: '22:00' },
    rolesPermitidos: ['super_admin', 'admin_maginf', 'admin', 'tecnico_senior'],
    exigeTicket: true,
    exigeMotivo: true,
    notificarAdmin: true,
  },
  estacao: {
    tipo: AccessPolicyType.ESTACAO,
    exigeConsentimento: true,
    consentimentoTimeoutSegundos: 120,
    gravacaoObrigatoria: false,
    screenshotAutoConexao: false,
    screenshotAutoDesconexao: false,
    maxSessoesSimultaneas: 2,
    horariosPermitidos: null,
    rolesPermitidos: ['super_admin', 'admin_maginf', 'admin', 'tecnico_senior', 'tecnico'],
    exigeTicket: false,
    exigeMotivo: false,
    notificarAdmin: false,
  },
};

@Injectable()
export class RemoteSessionsService {
  private readonly logger = new Logger(RemoteSessionsService.name);

  constructor(
    @InjectRepository(RemoteSession)
    private readonly sessionRepo: Repository<RemoteSession>,
    @InjectRepository(RemoteSessionLog)
    private readonly logRepo: Repository<RemoteSessionLog>,
    @InjectRepository(ConsentRecord)
    private readonly consentRepo: Repository<ConsentRecord>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  // ══════════════════════════════════════════════════
  // POLICY ENGINE
  // ══════════════════════════════════════════════════

  /**
   * Determina a política de acesso para um dispositivo.
   * Servidores (Windows Server) → política restritiva.
   * Estações de trabalho → consentimento obrigatório.
   */
  getPolicy(device: Device): AccessPolicyDto {
    const isServidor = this.isServidor(device);
    const policyKey = isServidor ? 'servidor' : 'estacao';
    return { ...DEFAULT_POLICIES[policyKey] };
  }

  private isServidor(device: Device): boolean {
    const os = (device.sistemaOperacional || '').toLowerCase();
    const hostname = (device.hostname || '').toLowerCase();
    return (
      os.includes('server') ||
      hostname.startsWith('srv') ||
      hostname.startsWith('dc') ||
      hostname.startsWith('ad-')
    );
  }

  /**
   * Valida se a solicitação atende os requisitos da política.
   */
  private async validarPolitica(
    device: Device,
    policy: AccessPolicyDto,
    dados: { ticketId?: string; motivo?: string; userRole?: string },
  ) {
    // Verificar role permitida
    if (dados.userRole && !policy.rolesPermitidos.includes(dados.userRole)) {
      throw new ForbiddenException(
        `Role '${dados.userRole}' não tem permissão para acessar ${policy.tipo}`,
      );
    }

    // Exige ticket?
    if (policy.exigeTicket && !dados.ticketId) {
      throw new BadRequestException('Política exige ticket vinculado para este tipo de dispositivo');
    }

    // Exige motivo?
    if (policy.exigeMotivo && !dados.motivo) {
      throw new BadRequestException('Política exige motivo obrigatório para este tipo de dispositivo');
    }

    // Verificar horário permitido
    if (policy.horariosPermitidos) {
      const agora = new Date();
      const hora = agora.getHours();
      const minuto = agora.getMinutes();
      const horaAtual = `${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}`;
      if (horaAtual < policy.horariosPermitidos.inicio || horaAtual > policy.horariosPermitidos.fim) {
        throw new ForbiddenException(
          `Acesso permitido apenas entre ${policy.horariosPermitidos.inicio} e ${policy.horariosPermitidos.fim}`,
        );
      }
    }

    // Verificar sessões simultâneas
    const ativas = await this.sessionRepo.count({
      where: {
        deviceId: device.id,
        status: In([RemoteSessionStatus.ATIVA, RemoteSessionStatus.CONSENTIDA]),
      },
    });
    if (ativas >= policy.maxSessoesSimultaneas) {
      throw new ForbiddenException(
        `Dispositivo já tem ${ativas} sessão(ões) ativa(s). Máximo: ${policy.maxSessoesSimultaneas}`,
      );
    }
  }

  // ══════════════════════════════════════════════════
  // SOLICITAR SESSÃO
  // ══════════════════════════════════════════════════

  async solicitar(dados: {
    tenantId: string;
    deviceId: string;
    technicianId: string;
    ticketId?: string;
    motivo?: string;
    ipTecnico?: string;
    gravarSessao?: boolean;
    userRole?: string;
  }) {
    // Buscar device para determinar política
    const device = await this.deviceRepo.findOne({ where: { id: dados.deviceId } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');

    const policy = this.getPolicy(device);

    // Validar política
    await this.validarPolitica(device, policy, {
      ticketId: dados.ticketId,
      motivo: dados.motivo,
      userRole: dados.userRole,
    });

    // Determinar se gravação é necessária
    const gravarSessao = policy.gravacaoObrigatoria || dados.gravarSessao || false;

    // Determinar status inicial
    const statusInicial = policy.exigeConsentimento
      ? RemoteSessionStatus.CONSENTIMENTO_PENDENTE
      : RemoteSessionStatus.CONSENTIDA;

    // Calcular expiração (sessão expira se consent não chegar em N seg)
    const consentTimeout = policy.consentimentoTimeoutSegundos;
    const expiraEm = policy.exigeConsentimento && consentTimeout > 0
      ? new Date(Date.now() + consentTimeout * 1000)
      : null;

    const session = this.sessionRepo.create({
      tenantId: dados.tenantId,
      deviceId: dados.deviceId,
      technicianId: dados.technicianId,
      ticketId: dados.ticketId,
      motivo: dados.motivo,
      ipTecnico: dados.ipTecnico,
      status: statusInicial,
      gravacaoSolicitada: gravarSessao,
      policyTipo: this.isServidor(device) ? DevicePolicyType.SERVIDOR : DevicePolicyType.ESTACAO,
      consentimentoExigido: policy.exigeConsentimento,
      consentimentoTimeout: consentTimeout,
      expiraEm,
    });

    // Servidores: auto-consent → já consentida
    if (!policy.exigeConsentimento) {
      session.consentidoPor = 'policy:servidor';
      session.consentidoEm = new Date();
    }

    const saved = await this.sessionRepo.save(session);

    this.logger.log(
      `Sessão ${saved.id} solicitada: device=${device.hostname} policy=${saved.policyTipo} consent=${policy.exigeConsentimento}`,
    );

    return this.buscar(saved.id, dados.tenantId);
  }

  // ══════════════════════════════════════════════════
  // CONSENTIMENTO
  // ══════════════════════════════════════════════════

  async registrarConsentimento(
    sessionId: string,
    consentido: boolean,
    dados: { usuarioLocal?: string; hostname?: string; ip?: string; deviceId?: string },
  ) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    // Verificar timeout
    if (session.expiraEm && new Date() > new Date(session.expiraEm)) {
      await this.sessionRepo.update(sessionId, {
        status: RemoteSessionStatus.TIMEOUT_CONSENTIMENTO,
      });
      throw new ForbiddenException('Tempo para consentimento expirado');
    }

    // Verificar estado válido
    if (session.status !== RemoteSessionStatus.CONSENTIMENTO_PENDENTE &&
        session.status !== RemoteSessionStatus.SOLICITADA) {
      throw new ForbiddenException(`Estado inválido para consentimento: ${session.status}`);
    }

    // Registrar consent record (LGPD compliance)
    await this.consentRepo.save({
      tenantId: session.tenantId,
      tipo: ConsentTipo.ACESSO_REMOTO,
      concedenteTipo: 'usuario_local_dispositivo',
      concedenteNome: dados.usuarioLocal || 'Desconhecido',
      concedenteIp: dados.ip,
      deviceId: session.deviceId,
      sessionId: session.id,
      consentido,
      detalhes: {
        hostname: dados.hostname,
        timestamp: new Date().toISOString(),
        motivo: session.motivo,
        technicianId: session.technicianId,
      },
    });

    if (consentido) {
      await this.sessionRepo.update(sessionId, {
        status: RemoteSessionStatus.CONSENTIDA,
        consentidoPor: dados.usuarioLocal,
        consentidoEm: new Date(),
        ipDispositivo: dados.ip,
      });
      this.logger.log(`Sessão ${sessionId} CONSENTIDA por ${dados.usuarioLocal}`);
    } else {
      await this.sessionRepo.update(sessionId, {
        status: RemoteSessionStatus.RECUSADA,
        consentidoPor: dados.usuarioLocal,
        consentidoEm: new Date(),
      });
      this.logger.log(`Sessão ${sessionId} RECUSADA por ${dados.usuarioLocal}`);
    }

    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  // ══════════════════════════════════════════════════
  // CICLO DE VIDA
  // ══════════════════════════════════════════════════

  async iniciar(sessionId: string, rustdeskSessionId?: string) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    if (session.status !== RemoteSessionStatus.CONSENTIDA) {
      throw new ForbiddenException('Sessão não foi consentida');
    }

    await this.sessionRepo.update(sessionId, {
      status: RemoteSessionStatus.ATIVA,
      iniciadaEm: new Date(),
      rustdeskSessionId: rustdeskSessionId || null,
    });

    // Log automático: sessão iniciada
    await this.registrarLog(sessionId, {
      tipo: RemoteSessionLogTipo.REGISTRO,
      descricao: 'Sessão remota iniciada',
      detalhes: { rustdeskSessionId },
    });

    this.logger.log(`Sessão ${sessionId} INICIADA`);
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async finalizar(sessionId: string, dados?: {
    resumo?: string;
    gravacaoUrl?: string;
    gravacaoTamanho?: number;
  }) {
    const session = await this.sessionRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Sessão não encontrada');

    const agora = new Date();
    const duracao = session.iniciadaEm
      ? Math.round((agora.getTime() - new Date(session.iniciadaEm).getTime()) / 1000)
      : 0;

    await this.sessionRepo.update(sessionId, {
      status: RemoteSessionStatus.FINALIZADA,
      finalizadaEm: agora,
      duracaoSegundos: duracao,
      resumo: dados?.resumo,
      gravacaoUrl: dados?.gravacaoUrl,
      gravacaoTamanho: dados?.gravacaoTamanho,
    });

    // Log automático: sessão finalizada
    await this.registrarLog(sessionId, {
      tipo: RemoteSessionLogTipo.REGISTRO,
      descricao: `Sessão remota finalizada (${Math.round(duracao / 60)} min)`,
      detalhes: { duracaoSegundos: duracao, temGravacao: !!dados?.gravacaoUrl },
    });

    this.logger.log(`Sessão ${sessionId} FINALIZADA (${duracao}s)`);
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  async marcarErro(sessionId: string, erro: string) {
    await this.sessionRepo.update(sessionId, {
      status: RemoteSessionStatus.ERRO,
      resumo: `Erro: ${erro}`,
    });
    await this.registrarLog(sessionId, {
      tipo: RemoteSessionLogTipo.REGISTRO,
      descricao: `Erro na sessão: ${erro}`,
    });
    return this.sessionRepo.findOne({ where: { id: sessionId } });
  }

  // ══════════════════════════════════════════════════
  // LOGS E EVIDÊNCIAS
  // ══════════════════════════════════════════════════

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

  async registrarEvidencia(sessionId: string, dados: {
    tipo: string;
    descricao: string;
    arquivoUrl?: string;
    arquivoNome?: string;
    arquivoTamanho?: number;
    detalhes?: Record<string, any>;
  }) {
    // Mapear tipo de evidência para RemoteSessionLogTipo
    const tipoMap: Record<string, RemoteSessionLogTipo> = {
      screenshot: RemoteSessionLogTipo.SCREENSHOT,
      gravacao: RemoteSessionLogTipo.OUTRO,
      arquivo_transferido: RemoteSessionLogTipo.ARQUIVO_TRANSFERIDO,
      clipboard: RemoteSessionLogTipo.CLIPBOARD,
      log_comando: RemoteSessionLogTipo.COMANDO,
    };

    return this.registrarLog(sessionId, {
      tipo: tipoMap[dados.tipo] || RemoteSessionLogTipo.OUTRO,
      descricao: dados.descricao,
      arquivoUrl: dados.arquivoUrl,
      detalhes: {
        ...dados.detalhes,
        arquivoNome: dados.arquivoNome,
        arquivoTamanho: dados.arquivoTamanho,
        tipoEvidencia: dados.tipo,
      },
    });
  }

  async listarLogs(sessionId: string) {
    return this.logRepo.find({
      where: { sessionId },
      order: { timestamp: 'ASC' },
    });
  }

  async listarEvidencias(sessionId: string) {
    return this.logRepo.find({
      where: {
        sessionId,
        tipo: In([
          RemoteSessionLogTipo.SCREENSHOT,
          RemoteSessionLogTipo.ARQUIVO_TRANSFERIDO,
          RemoteSessionLogTipo.CLIPBOARD,
        ]),
      },
      order: { timestamp: 'ASC' },
    });
  }

  // ══════════════════════════════════════════════════
  // QUERIES
  // ══════════════════════════════════════════════════

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
      .leftJoinAndSelect('session.ticket', 'ticket')
      .where('session.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('session.status = :status', { status: filtros.status });
    }
    if (filtros?.deviceId) {
      query.andWhere('session.deviceId = :deviceId', { deviceId: filtros.deviceId });
    }
    if (filtros?.technicianId) {
      query.andWhere('session.technicianId = :technicianId', { technicianId: filtros.technicianId });
    }
    if (filtros?.ticketId) {
      query.andWhere('session.ticketId = :ticketId', { ticketId: filtros.ticketId });
    }

    return query.orderBy('session.criadoEm', 'DESC').take(100).getMany();
  }

  /**
   * Sessões pendentes de consentimento para um device (polling do agente).
   */
  async pendentesParaDevice(deviceId: string) {
    return this.sessionRepo.find({
      where: {
        deviceId,
        status: RemoteSessionStatus.CONSENTIMENTO_PENDENTE,
      },
      relations: ['technician'],
      order: { criadoEm: 'ASC' },
    });
  }

  /**
   * Sessões ativas de um device (para o portal do cliente).
   */
  async ativasParaDevice(deviceId: string) {
    return this.sessionRepo.find({
      where: {
        deviceId,
        status: In([RemoteSessionStatus.ATIVA, RemoteSessionStatus.CONSENTIDA]),
      },
      relations: ['technician', 'ticket'],
      order: { criadoEm: 'DESC' },
    });
  }

  /**
   * Histórico de sessões de um device (para portal cliente).
   */
  async historicoDevice(deviceId: string, tenantId: string) {
    return this.sessionRepo.find({
      where: { deviceId, tenantId },
      relations: ['technician'],
      order: { criadoEm: 'DESC' },
      take: 50,
    });
  }

  /**
   * Estatísticas de sessões remotas.
   */
  async estatisticas(tenantId: string) {
    const total = await this.sessionRepo.count({ where: { tenantId } });
    const ativas = await this.sessionRepo.count({
      where: { tenantId, status: RemoteSessionStatus.ATIVA },
    });
    const finalizadas = await this.sessionRepo.count({
      where: { tenantId, status: RemoteSessionStatus.FINALIZADA },
    });
    const recusadas = await this.sessionRepo.count({
      where: { tenantId, status: RemoteSessionStatus.RECUSADA },
    });

    // Tempo médio de sessão
    const avgResult = await this.sessionRepo
      .createQueryBuilder('session')
      .select('AVG(session.duracaoSegundos)', 'avgDuracao')
      .where('session.tenantId = :tenantId', { tenantId })
      .andWhere('session.status = :status', { status: RemoteSessionStatus.FINALIZADA })
      .andWhere('session.duracaoSegundos IS NOT NULL')
      .getRawOne();

    return {
      total,
      ativas,
      finalizadas,
      recusadas,
      tempoMedioSegundos: Math.round(avgResult?.avgDuracao || 0),
    };
  }

  /**
   * Verificar e expirar sessões com timeout de consentimento.
   * Chamado periodicamente por um cron job ou no polling do agente.
   */
  async expirarSessoesTimeout() {
    const agora = new Date();
    const result = await this.sessionRepo
      .createQueryBuilder()
      .update(RemoteSession)
      .set({ status: RemoteSessionStatus.TIMEOUT_CONSENTIMENTO })
      .where('status = :status', { status: RemoteSessionStatus.CONSENTIMENTO_PENDENTE })
      .andWhere('expiraEm IS NOT NULL')
      .andWhere('expiraEm < :agora', { agora })
      .execute();

    if (result.affected > 0) {
      this.logger.warn(`${result.affected} sessão(ões) expirada(s) por timeout de consentimento`);
    }
    return result.affected;
  }
}
