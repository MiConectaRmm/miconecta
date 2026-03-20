import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HttpService } from '@nestjs/axios';
import { In, Repository } from 'typeorm';
import { firstValueFrom } from 'rxjs';
import { Tenant, TenantPlano, TenantStatus } from '../../database/entities/tenant.entity';
import { Organization } from '../../database/entities/organization.entity';
import { Technician } from '../../database/entities/technician.entity';
import { CreateTenantDto, UpdateTenantDto } from './dto/create-tenant.dto';
import { JwtPayload } from '../../common/interfaces';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
    private readonly httpService: HttpService,
  ) {}

  async criarTenant(dados: CreateTenantDto) {
    const toSave: Partial<Tenant> = {
      ...dados,
      dataAbertura: dados.dataAbertura ? new Date(dados.dataAbertura) : undefined,
      plano: dados.plano as TenantPlano | undefined,
    };
    const tenant = this.tenantRepo.create(toSave);
    return this.tenantRepo.save(tenant);
  }

  private readonly rolesListaTenantsGlobal = ['super_admin', 'admin_maginf', 'admin'];

  private isTecnicoCampo(user: JwtPayload): boolean {
    return (
      user.userType === 'technician' &&
      ['tecnico', 'tecnico_senior', 'visualizador'].includes(user.role)
    );
  }

  async listarTenants(user: JwtPayload) {
    if (this.rolesListaTenantsGlobal.includes(user.role)) {
      return this.tenantRepo.find({
        relations: ['organizacoes'],
        order: { nome: 'ASC' },
      });
    }

    if (!this.isTecnicoCampo(user)) {
      throw new ForbiddenException('Sem permissão para listar tenants');
    }

    const tecnico = await this.technicianRepo.findOne({ where: { id: user.sub } });
    const ids = (tecnico?.tenantsAtribuidos ?? []).filter(Boolean);
    if (ids.length === 0) {
      return [];
    }

    return this.tenantRepo.find({
      where: { id: In(ids) },
      relations: ['organizacoes'],
      order: { nome: 'ASC' },
    });
  }

  async podeLerTenant(id: string, user: JwtPayload): Promise<boolean> {
    if (this.rolesListaTenantsGlobal.includes(user.role)) {
      return true;
    }
    if (user.userType !== 'technician') {
      return false;
    }
    if (this.isTecnicoCampo(user)) {
      const tecnico = await this.technicianRepo.findOne({ where: { id: user.sub } });
      const ids = tecnico?.tenantsAtribuidos ?? [];
      return ids.includes(id);
    }
    return false;
  }

  async buscarTenant(id: string, user?: JwtPayload) {
    const tenant = await this.tenantRepo.findOne({
      where: { id },
      relations: ['organizacoes', 'organizacoes.dispositivos'],
    });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    if (user && !(await this.podeLerTenant(id, user))) {
      throw new ForbiddenException('Sem permissão para acessar este tenant');
    }
    return tenant;
  }

  async atualizarTenant(id: string, dados: UpdateTenantDto) {
    await this.buscarTenant(id);
    const toUpdate: Partial<Tenant> = {
      ...dados,
      dataAbertura: dados.dataAbertura ? new Date(dados.dataAbertura) : undefined,
      plano: dados.plano as TenantPlano | undefined,
      statusContrato: dados.statusContrato as TenantStatus | undefined,
    };
    await this.tenantRepo.update(id, toUpdate);
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

  async listarOrganizacoes(tenantId: string, user?: JwtPayload) {
    if (user && !(await this.podeLerTenant(tenantId, user))) {
      throw new ForbiddenException('Sem permissão para acessar este tenant');
    }
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
      const { data } = await firstValueFrom(
        this.httpService.get(`https://brasilapi.com.br/api/cnpj/v1/${cnpjLimpo}`),
      ).catch(() => {
        throw new BadRequestException('CNPJ não encontrado na Receita Federal');
      });

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
