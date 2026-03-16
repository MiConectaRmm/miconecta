import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ReportSchedule, ReportTipo, ReportFrequencia } from '../../database/entities/report-schedule.entity';
import { Device } from '../../database/entities/device.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Alert } from '../../database/entities/alert.entity';
import { RemoteSession } from '../../database/entities/remote-session.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepo: Repository<ReportSchedule>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DeviceInventory)
    private readonly inventoryRepo: Repository<DeviceInventory>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
    @InjectRepository(RemoteSession)
    private readonly sessionRepo: Repository<RemoteSession>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  // ══════════════════════════════════════════════════
  // AGENDAMENTOS
  // ══════════════════════════════════════════════════

  async criarAgendamento(tenantId: string, dados: {
    tipo: ReportTipo;
    nome: string;
    frequencia?: ReportFrequencia;
    destinatariosEmail?: string[];
    parametros?: Record<string, any>;
    criadoPor: string;
  }) {
    const schedule = this.scheduleRepo.create({
      tenantId,
      tipo: dados.tipo,
      nome: dados.nome,
      frequencia: dados.frequencia || ReportFrequencia.MANUAL,
      destinatariosEmail: dados.destinatariosEmail,
      parametros: dados.parametros,
      criadoPor: dados.criadoPor,
    });
    return this.scheduleRepo.save(schedule);
  }

  async listarAgendamentos(tenantId: string) {
    return this.scheduleRepo.find({
      where: { tenantId },
      order: { criadoEm: 'DESC' },
    });
  }

  // ══════════════════════════════════════════════════
  // RELATÓRIO EXECUTIVO
  // ══════════════════════════════════════════════════

  async gerarResumoExecutivo(tenantId: string) {
    const totalDevices = await this.deviceRepo.count({ where: { tenantId } });
    const devicesOnline = await this.deviceRepo.count({ where: { tenantId, status: 'online' as any } });
    const devicesOffline = await this.deviceRepo.count({ where: { tenantId, status: 'offline' as any } });

    const ticketsAbertos = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.ABERTO } });
    const ticketsEmAtendimento = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.EM_ATENDIMENTO } });
    const ticketsResolvidos = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.RESOLVIDO } });
    const totalTickets = await this.ticketRepo.count({ where: { tenantId } });

    const alertasAtivos = await this.alertRepo.count({ where: { tenantId, status: 'ativo' as any } });

    const totalSessoes = await this.sessionRepo.count({ where: { tenantId } });
    const sessoesAtivas = await this.sessionRepo.count({ where: { tenantId, status: 'ativa' as any } });

    // Tempo médio de atendimento (tickets resolvidos com duração)
    const avgResult = await this.ticketRepo
      .createQueryBuilder('t')
      .select('AVG(EXTRACT(EPOCH FROM (t.atualizadoEm - t.criadoEm)))', 'avgSegundos')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.status IN (:...statuses)', { statuses: ['resolvido', 'fechado'] })
      .getRawOne();

    return {
      geradoEm: new Date().toISOString(),
      tenantId,
      dispositivos: {
        total: totalDevices,
        online: devicesOnline,
        offline: devicesOffline,
        percentualOnline: totalDevices > 0 ? Math.round((devicesOnline / totalDevices) * 100) : 0,
      },
      tickets: {
        total: totalTickets,
        abertos: ticketsAbertos,
        emAtendimento: ticketsEmAtendimento,
        resolvidos: ticketsResolvidos,
        tempoMedioAtendimentoMinutos: avgResult?.avgSegundos ? Math.round(avgResult.avgSegundos / 60) : 0,
      },
      sessoes: {
        total: totalSessoes,
        ativas: sessoesAtivas,
      },
      alertas: {
        ativos: alertasAtivos,
      },
    };
  }

  // ══════════════════════════════════════════════════
  // RELATÓRIO TÉCNICO
  // ══════════════════════════════════════════════════

  async gerarRelatorioTecnico(tenantId: string) {
    const devices = await this.deviceRepo.find({ where: { tenantId } });
    const totalSw = await this.inventoryRepo.count({ where: { tipo: 'software' as any } });
    const totalHw = await this.inventoryRepo.count({ where: { tipo: 'hardware' as any } });

    const alertas30d = await this.alertRepo.count({
      where: { tenantId, criadoEm: MoreThan(new Date(Date.now() - 30 * 86400000)) },
    });

    const sessoes30d = await this.sessionRepo.count({
      where: { tenantId, criadoEm: MoreThan(new Date(Date.now() - 30 * 86400000)) },
    });

    // Sessões por técnico
    const sessoesPorTecnico = await this.sessionRepo
      .createQueryBuilder('s')
      .select('s.technicianId', 'technicianId')
      .addSelect('COUNT(*)', 'total')
      .where('s.tenantId = :tenantId', { tenantId })
      .groupBy('s.technicianId')
      .getRawMany();

    // Tickets por dispositivo (top 10)
    const ticketsPorDevice = await this.ticketRepo
      .createQueryBuilder('t')
      .select('t.deviceId', 'deviceId')
      .addSelect('COUNT(*)', 'total')
      .where('t.tenantId = :tenantId', { tenantId })
      .andWhere('t.deviceId IS NOT NULL')
      .groupBy('t.deviceId')
      .orderBy('COUNT(*)', 'DESC')
      .limit(10)
      .getRawMany();

    return {
      geradoEm: new Date().toISOString(),
      tenantId,
      inventario: { softwareTotal: totalSw, hardwareTotal: totalHw },
      dispositivos: {
        total: devices.length,
        online: devices.filter(d => d.status === 'online').length,
        offline: devices.filter(d => d.status === 'offline').length,
      },
      ultimos30dias: {
        alertas: alertas30d,
        sessoes: sessoes30d,
      },
      sessoesPorTecnico,
      ticketsPorDevice,
    };
  }

  // ══════════════════════════════════════════════════
  // DISPONIBILIDADE
  // ══════════════════════════════════════════════════

  async gerarRelatorioDisponibilidade(tenantId: string) {
    const devices = await this.deviceRepo.find({
      where: { tenantId },
      select: ['id', 'hostname', 'status', 'lastSeen', 'sistemaOperacional', 'ipLocal'],
      order: { hostname: 'ASC' },
    });

    return {
      geradoEm: new Date().toISOString(),
      tenantId,
      totalDispositivos: devices.length,
      dispositivos: devices.map(d => ({
        id: d.id,
        hostname: d.hostname,
        status: d.status,
        ultimaComunicacao: d.lastSeen,
        sistemaOperacional: d.sistemaOperacional,
        ipLocal: d.ipLocal,
      })),
    };
  }

  // ══════════════════════════════════════════════════
  // EXPORTS (CSV/JSON)
  // ══════════════════════════════════════════════════

  async exportarDispositivos(tenantId: string, formato: 'csv' | 'json') {
    const devices = await this.deviceRepo.find({
      where: { tenantId },
      order: { hostname: 'ASC' },
    });
    if (formato === 'csv') return this.toCsv(devices, ['hostname', 'sistemaOperacional', 'ipLocal', 'status', 'lastSeen', 'cpu', 'ramTotalMb']);
    return devices;
  }

  async exportarTickets(tenantId: string, formato: 'csv' | 'json') {
    const tickets = await this.ticketRepo.find({
      where: { tenantId },
      order: { criadoEm: 'DESC' },
      take: 5000,
    });
    if (formato === 'csv') return this.toCsv(tickets, ['numero', 'titulo', 'status', 'prioridade', 'criadoEm', 'atualizadoEm']);
    return tickets;
  }

  async exportarSessoes(tenantId: string, formato: 'csv' | 'json') {
    const sessions = await this.sessionRepo.find({
      where: { tenantId },
      order: { criadoEm: 'DESC' },
      take: 5000,
    });
    if (formato === 'csv') return this.toCsv(sessions, ['id', 'deviceId', 'technicianId', 'status', 'duracaoSegundos', 'criadoEm', 'finalizadaEm']);
    return sessions;
  }

  async exportarInventario(tenantId: string, formato: 'csv' | 'json') {
    const items = await this.inventoryRepo
      .createQueryBuilder('i')
      .innerJoin('i.device', 'd')
      .where('d.tenantId = :tenantId', { tenantId })
      .select(['i.id', 'i.nome', 'i.versao', 'i.fabricante', 'i.tipo', 'd.hostname'])
      .take(10000)
      .getMany();
    if (formato === 'csv') return this.toCsv(items.map(i => ({ ...i, hostname: (i as any).device?.hostname })), ['nome', 'versao', 'fabricante', 'tipo', 'hostname']);
    return items;
  }

  async exportarAuditLog(tenantId: string, formato: 'csv' | 'json') {
    const logs = await this.auditRepo.find({
      where: { tenantId },
      order: { criadoEm: 'DESC' },
      take: 5000,
    });
    if (formato === 'csv') return this.toCsv(logs, ['acao', 'recurso', 'usuarioNome', 'ip', 'criadoEm']);
    return logs;
  }

  // ══════════════════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════════════════

  private toCsv(data: any[], fields: string[]): string {
    if (!data.length) return fields.join(',') + '\n';
    const header = fields.join(',');
    const rows = data.map(row =>
      fields.map(f => {
        const val = row[f];
        if (val === null || val === undefined) return '';
        const str = String(val).replace(/"/g, '""');
        return str.includes(',') || str.includes('\n') ? `"${str}"` : str;
      }).join(','),
    );
    return [header, ...rows].join('\n');
  }
}
