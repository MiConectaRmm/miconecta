import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LgpdRequest, LgpdRequestTipo, LgpdRequestStatus } from '../../database/entities/lgpd-request.entity';
import { ConsentRecord, ConsentTipo } from '../../database/entities/consent-record.entity';

@Injectable()
export class LgpdService {
  constructor(
    @InjectRepository(LgpdRequest)
    private readonly requestRepo: Repository<LgpdRequest>,
    @InjectRepository(ConsentRecord)
    private readonly consentRepo: Repository<ConsentRecord>,
  ) {}

  async criarSolicitacao(tenantId: string, dados: {
    tipo: LgpdRequestTipo;
    solicitanteTipo: string;
    solicitanteId: string;
    solicitanteNome: string;
    solicitanteEmail: string;
    justificativa?: string;
  }) {
    const request = this.requestRepo.create({
      tenantId,
      ...dados,
      status: LgpdRequestStatus.PENDENTE,
    });
    return this.requestRepo.save(request);
  }

  async listarSolicitacoes(tenantId: string, filtros?: { status?: LgpdRequestStatus }) {
    const query = this.requestRepo.createQueryBuilder('r')
      .where('r.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('r.status = :status', { status: filtros.status });
    }

    return query.orderBy('r.criadoEm', 'DESC').take(100).getMany();
  }

  async processarSolicitacao(id: string, processadoPor: string, dados: {
    status: LgpdRequestStatus;
    resultadoUrl?: string;
    metadata?: Record<string, any>;
  }) {
    const request = await this.requestRepo.findOne({ where: { id } });
    if (!request) throw new NotFoundException('Solicitação não encontrada');

    await this.requestRepo.update(id, {
      status: dados.status,
      resultadoUrl: dados.resultadoUrl,
      processadoPor,
      processadoEm: new Date(),
      metadata: dados.metadata,
    });

    return this.requestRepo.findOne({ where: { id } });
  }

  async registrarConsentimento(dados: {
    tenantId: string;
    tipo: ConsentTipo;
    concedenteTipo: string;
    concedenteId?: string;
    concedenteNome: string;
    concedenteIp?: string;
    deviceId?: string;
    sessionId?: string;
    consentido: boolean;
    versaoTermos?: string;
    detalhes?: Record<string, any>;
  }) {
    const consent = this.consentRepo.create(dados);
    return this.consentRepo.save(consent);
  }

  async listarConsentimentos(tenantId: string, filtros?: { tipo?: ConsentTipo }) {
    const query = this.consentRepo.createQueryBuilder('c')
      .where('c.tenantId = :tenantId', { tenantId });

    if (filtros?.tipo) {
      query.andWhere('c.tipo = :tipo', { tipo: filtros.tipo });
    }

    return query.orderBy('c.criadoEm', 'DESC').take(200).getMany();
  }

  async verificarConsentimentoAtivo(tenantId: string, concedenteId: string, tipo: ConsentTipo): Promise<boolean> {
    const ultimo = await this.consentRepo.findOne({
      where: { tenantId, concedenteId: concedenteId, tipo },
      order: { criadoEm: 'DESC' },
    });
    return ultimo?.consentido === true;
  }
}
