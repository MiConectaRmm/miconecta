import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { ClientUser, ClientUserRole } from '../../database/entities/client-user.entity';
import { CreateClientUserDto } from './dto/create-client-user.dto';

@Injectable()
export class ClientUsersService {
  constructor(
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
  ) {}

  async criar(tenantId: string, dto: CreateClientUserDto) {
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

  async listar(tenantId: string) {
    const users = await this.clientUserRepo.find({
      where: { tenantId },
      relations: ['organization'],
      order: { nome: 'ASC' },
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
