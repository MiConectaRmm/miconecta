import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Patch, PatchStatus } from '../../database/entities/patch.entity';

@Injectable()
export class PatchesService {
  constructor(
    @InjectRepository(Patch)
    private readonly patchRepo: Repository<Patch>,
  ) {}

  async sincronizarPatches(deviceId: string, patches: Partial<Patch>[]) {
    // Remover patches anteriores que ainda estão pendentes
    await this.patchRepo.delete({ deviceId, status: PatchStatus.PENDENTE });

    // Inserir novos patches
    const novos = patches.map((p) =>
      this.patchRepo.create({ ...p, deviceId }),
    );
    return this.patchRepo.save(novos);
  }

  async listarPatches(deviceId: string, filtros?: any) {
    const where: any = { deviceId };
    if (filtros?.status) where.status = filtros.status;
    if (filtros?.severidade) where.severidade = filtros.severidade;

    return this.patchRepo.find({
      where,
      order: { criadoEm: 'DESC' },
    });
  }

  async resumoPatches(tenantId: string) {
    const resultado = await this.patchRepo
      .createQueryBuilder('patch')
      .leftJoin('patch.device', 'device')
      .select('patch.status', 'status')
      .addSelect('patch.severidade', 'severidade')
      .addSelect('COUNT(*)', 'total')
      .where('device.tenant_id = :tenantId', { tenantId })
      .groupBy('patch.status')
      .addGroupBy('patch.severidade')
      .getRawMany();

    return resultado;
  }

  async instalarPatch(patchId: string) {
    const patch = await this.patchRepo.findOne({ where: { id: patchId } });
    if (!patch) throw new NotFoundException('Patch não encontrado');

    await this.patchRepo.update(patchId, {
      status: PatchStatus.INSTALANDO,
    });

    return this.patchRepo.findOne({ where: { id: patchId } });
  }

  async agendarPatch(patchId: string, agendadoPara: Date) {
    const patch = await this.patchRepo.findOne({ where: { id: patchId } });
    if (!patch) throw new NotFoundException('Patch não encontrado');

    await this.patchRepo.update(patchId, {
      status: PatchStatus.AGENDADO,
      agendadoPara,
    });

    return this.patchRepo.findOne({ where: { id: patchId } });
  }

  async atualizarStatusPatch(patchId: string, status: PatchStatus) {
    await this.patchRepo.update(patchId, {
      status,
      ...(status === PatchStatus.INSTALADO ? { instaladoEm: new Date() } : {}),
    });
    return this.patchRepo.findOne({ where: { id: patchId } });
  }
}
