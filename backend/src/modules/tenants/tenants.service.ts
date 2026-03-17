import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { Organization } from '../../database/entities/organization.entity';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

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

  async consultarCnpj(cnpj: string) {
    const cnpjLimpo = cnpj.replace(/[^\d]/g, '');
    if (cnpjLimpo.length !== 14) {
      throw new BadRequestException('CNPJ deve conter 14 dígitos');
    }

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`);
      if (!response.ok) {
        throw new BadRequestException('CNPJ não encontrado na Receita Federal');
      }
      const data = await response.json() as any;

      return {
        razaoSocial: data.razao_social || '',
        nomeFantasia: data.nome_fantasia || '',
        cnpj: data.cnpj || cnpjLimpo,
        email: data.email || '',
        telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.substring(0, 2)}) ${data.ddd_telefone_1.substring(2)}` : '',
        cep: data.cep || '',
        logradouro: data.logradouro || '',
        numero: data.numero || '',
        complemento: data.complemento || '',
        bairro: data.bairro || '',
        cidade: data.municipio || '',
        uf: data.uf || '',
        atividadePrincipal: data.cnae_fiscal_descricao || '',
        naturezaJuridica: data.natureza_juridica || '',
        porte: data.porte || '',
        dataAbertura: data.data_inicio_atividade || null,
        situacaoCadastral: data.descricao_situacao_cadastral || '',
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Erro ao consultar CNPJ ${cnpjLimpo}`, err);
      throw new BadRequestException('Erro ao consultar CNPJ. Tente novamente.');
    }
  }
}
