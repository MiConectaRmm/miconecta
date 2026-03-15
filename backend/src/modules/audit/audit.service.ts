import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
  ) {}

  async registrar(dados: Partial<AuditLog>) {
    const log = this.auditRepo.create(dados);
    return this.auditRepo.save(log);
  }

  async listar(tenantId: string, filtros?: any) {
    const query = this.auditRepo.createQueryBuilder('log')
      .where('log.tenant_id = :tenantId', { tenantId });

    if (filtros?.acao) {
      query.andWhere('log.acao = :acao', { acao: filtros.acao });
    }

    if (filtros?.usuarioId) {
      query.andWhere('log.usuario_id = :usuarioId', { usuarioId: filtros.usuarioId });
    }

    return query.orderBy('log.criado_em', 'DESC').take(200).getMany();
  }
}
