import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { Organization } from '../../database/entities/organization.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
  ) {}

  async criarTenant(dados: Partial<Tenant>) {
    const tenant = this.tenantRepo.create(dados);
    return this.tenantRepo.save(tenant);
  }

  async listarTenants() {
    return this.tenantRepo.find({
      relations: ['organizacoes'],
      order: { nome: 'ASC' },
    });
  }

  async buscarTenant(id: string) {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      relations: ['organizacoes', 'organizacoes.dispositivos'],
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant;
  }

  async atualizarTenant(id: string, dados: Partial<Tenant>) {
    await this.buscarTenant(id);
    await this.tenantRepo.update(id, dados);
    return this.buscarTenant(id);
  }

  async removerTenant(id: string) {
    await this.buscarTenant(id);
    await this.tenantRepo.delete(id);
    return { mensagem: 'Tenant removido com sucesso' };
  }

  // Organizações
  async criarOrganizacao(tenantId: string, dados: Partial<Organization>) {
    await this.buscarTenant(tenantId);
    const org = this.orgRepo.create({ ...dados, tenantId });
    return this.orgRepo.save(org);
  }

  async listarOrganizacoes(tenantId: string) {
    return this.orgRepo.find({
      where: { tenantId },
      relations: ['dispositivos'],
      order: { nome: 'ASC' },
    });
  }

  async buscarOrganizacao(id: string) {
    const org = await this.orgRepo.findOne({
      where: { id },
      relations: ['dispositivos'],
    });
    if (!org) throw new NotFoundException('Organização não encontrada');
    return org;
  }

  async atualizarOrganizacao(id: string, dados: Partial<Organization>) {
    await this.buscarOrganizacao(id);
    await this.orgRepo.update(id, dados);
    return this.buscarOrganizacao(id);
  }

  async removerOrganizacao(id: string) {
    await this.buscarOrganizacao(id);
    await this.orgRepo.delete(id);
    return { mensagem: 'Organização removida com sucesso' };
  }
}
