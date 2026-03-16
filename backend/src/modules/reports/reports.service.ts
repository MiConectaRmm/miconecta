import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReportSchedule, ReportTipo, ReportFrequencia } from '../../database/entities/report-schedule.entity';
import { Device } from '../../database/entities/device.entity';
import { Ticket, TicketStatus } from '../../database/entities/ticket.entity';
import { Alert } from '../../database/entities/alert.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(ReportSchedule)
    private readonly scheduleRepo: Repository<ReportSchedule>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Alert)
    private readonly alertRepo: Repository<Alert>,
  ) {}

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

  async gerarResumoExecutivo(tenantId: string) {
    const totalDevices = await this.deviceRepo.count({ where: { tenantId } });
    const devicesOnline = await this.deviceRepo.count({ where: { tenantId, status: 'online' as any } });
    const devicesOffline = await this.deviceRepo.count({ where: { tenantId, status: 'offline' as any } });

    const ticketsAbertos = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.ABERTO } });
    const ticketsEmAtendimento = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.EM_ATENDIMENTO } });
    const ticketsResolvidos = await this.ticketRepo.count({ where: { tenantId, status: TicketStatus.RESOLVIDO } });
    const totalTickets = await this.ticketRepo.count({ where: { tenantId } });

    const alertasAtivos = await this.alertRepo.count({ where: { tenantId, status: 'ativo' as any } });

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
      },
      alertas: {
        ativos: alertasAtivos,
      },
    };
  }

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
}
