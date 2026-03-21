import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ClientUser, ClientUserRole } from '../../database/entities/client-user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { CreateClientUserDto } from './dto/create-client-user.dto';

@Injectable()
export class ClientUsersService {
  constructor(
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
  ) {}

  /** Limite padrão caso o tenant não tenha maxUsuarios definido */
  private static readonly DEFAULT_MAX_USERS = 5;

  /**
   * Retorna o limite de usuários do portal para um tenant.
   * Usa tenant.maxUsuarios se definido, senão DEFAULT_MAX_USERS.
   */
  private async getMaxUsuarios(tenantId: string): Promise<number> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant.maxUsuarios ?? ClientUsersService.DEFAULT_MAX_USERS;
  }

  /**
   * Retorna a contagem atual e o limite de usuários do portal para um tenant.
   */
  async contagem(tenantId: string) {
    const maxUsuarios = await this.getMaxUsuarios(tenantId);
    const total = await this.clientUserRepo.count({ where: { tenantId } });
    const ativos = await this.clientUserRepo.count({ where: { tenantId, ativo: true } });
    const inativos = total - ativos;

    return {
      total,
      ativos,
      inativos,
      limite: maxUsuarios,
      disponivel: Math.max(0, maxUsuarios - total),
      atingiuLimite: total >= maxUsuarios,
    };
  }

  async criar(tenantId: string, dto: CreateClientUserDto) {
    const maxUsuarios = await this.getMaxUsuarios(tenantId);
    const totalUsuarios = await this.clientUserRepo.count({ where: { tenantId } });

    if (totalUsuarios >= maxUsuarios) {
      throw new BadRequestException(
        `Limite de ${maxUsuarios} usuários do portal atingido para este cliente. ` +
        `Atualmente existem ${totalUsuarios} usuários cadastrados.`,
      );
    }

    const existente = await this.clientUserRepo.findOne({
      where: { tenantId, email: dto.email },
    });
    if (existente) {
      throw new ConflictException('E-mail já cadastrado neste tenant');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const user = this.clientUserRepo.create({
      tenantId,
      nome: dto.nome,
      email: dto.email,
      senha: senhaHash,
      funcao: dto.funcao || ClientUserRole.USUARIO,
      telefone: dto.telefone,
      cargo: dto.cargo,
      organizationId: dto.organizationId,
    });

    const salvo = await this.clientUserRepo.save(user);
    return this.sanitize(salvo);
  }

  async listar(tenantId?: string | null) {
    const where = tenantId ? { tenantId } : {};
    const users = await this.clientUserRepo.find({
      where,
      relations: ['organization', 'tenant'],
      order: { nome: 'ASC' },
    });
    return users.map((u) => this.sanitize(u));
  }

  async listarPorTenant(tenantId: string) {
    const users = await this.clientUserRepo.find({
      where: { tenantId },
      relations: ['organization', 'tenant'],
      order: { ativo: 'DESC', nome: 'ASC' },
    });
    return users.map((u) => this.sanitize(u));
  }

  async buscar(id: string, tenantId: string) {
    const user = await this.clientUserRepo.findOne({
      where: { id, tenantId },
      relations: ['organization', 'tenant'],
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return this.sanitize(user);
  }

  async atualizar(id: string, tenantId: string, dados: Partial<CreateClientUserDto>) {
    const user = await this.clientUserRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    if (dados.senha) {
      dados.senha = await bcrypt.hash(dados.senha, 12);
    }

    await this.clientUserRepo.update(id, dados as any);
    return this.buscar(id, tenantId);
  }

  async desativar(id: string, tenantId: string) {
    const user = await this.clientUserRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    await this.clientUserRepo.update(id, { ativo: false });
    return { message: 'Usuário desativado' };
  }

  async reativar(id: string, tenantId: string) {
    const user = await this.clientUserRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    await this.clientUserRepo.update(id, { ativo: true });
    return this.buscar(id, tenantId);
  }

  async gerarConvite(id: string, tenantId: string) {
    const user = await this.clientUserRepo.findOne({ where: { id, tenantId } });
    if (!user) throw new NotFoundException('Usuário não encontrado');

    const token = uuidv4();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24);

    await this.clientUserRepo.update(id, {
      inviteToken: token,
      inviteExpiresAt: expires,
    });

    return { inviteToken: token, expiresAt: expires };
  }

  private sanitize(user: ClientUser) {
    const { senha, inviteToken, ...rest } = user;
    return rest;
  }
}
