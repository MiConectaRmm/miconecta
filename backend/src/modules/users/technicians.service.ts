import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Technician, TechnicianRole } from '../../database/entities/technician.entity';
import { CreateTechnicianDto, UpdateTechnicianDto } from './dto/create-technician.dto';

@Injectable()
export class TechniciansService {
  constructor(
    @InjectRepository(Technician)
    private readonly techRepo: Repository<Technician>,
  ) {}

  async criar(dto: CreateTechnicianDto, criadorRole: string) {
    // Apenas super_admin/admin_maginf podem criar outros admins
    const rolesAdmin: string[] = [TechnicianRole.SUPER_ADMIN, TechnicianRole.ADMIN_MAGINF, TechnicianRole.ADMIN];
    if (rolesAdmin.includes(dto.funcao) && criadorRole !== TechnicianRole.SUPER_ADMIN) {
      throw new ForbiddenException('Apenas super_admin pode criar usuários admin');
    }

    const existente = await this.techRepo.findOne({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const tecnico = this.techRepo.create({
      ...dto,
      senha: senhaHash,
    });

    const salvo = await this.techRepo.save(tecnico);
    return this.sanitize(salvo);
  }

  async listar(filtros?: { tenantId?: string; funcao?: TechnicianRole; ativo?: boolean }) {
    const query = this.techRepo.createQueryBuilder('t')
      .leftJoinAndSelect('t.tenant', 'tenant')
      .orderBy('t.nome', 'ASC');

    if (filtros?.tenantId) {
      query.andWhere('t.tenantId = :tenantId', { tenantId: filtros.tenantId });
    }
    if (filtros?.funcao) {
      query.andWhere('t.funcao = :funcao', { funcao: filtros.funcao });
    }
    if (filtros?.ativo !== undefined) {
      query.andWhere('t.ativo = :ativo', { ativo: filtros.ativo });
    }

    const tecnicos = await query.getMany();
    return tecnicos.map(t => this.sanitize(t));
  }

  async buscar(id: string) {
    const tecnico = await this.techRepo.findOne({
      where: { id },
      relations: ['tenant'],
    });
    if (!tecnico) throw new NotFoundException('Técnico não encontrado');
    return this.sanitize(tecnico);
  }

  async atualizar(id: string, dto: UpdateTechnicianDto, executorRole: string) {
    const tecnico = await this.techRepo.findOne({ where: { id } });
    if (!tecnico) throw new NotFoundException('Técnico não encontrado');

    // Proteção: não pode alterar role de super_admin se não for super_admin
    if (dto.funcao && tecnico.funcao === TechnicianRole.SUPER_ADMIN && executorRole !== TechnicianRole.SUPER_ADMIN) {
      throw new ForbiddenException('Apenas super_admin pode alterar outro super_admin');
    }

    const updateData: any = { ...dto };
    if (dto.senha) {
      updateData.senha = await bcrypt.hash(dto.senha, 12);
    }

    await this.techRepo.update(id, updateData);
    return this.buscar(id);
  }

  async desativar(id: string) {
    const tecnico = await this.techRepo.findOne({ where: { id } });
    if (!tecnico) throw new NotFoundException('Técnico não encontrado');

    // Proteção: não pode desativar super_admin
    if (tecnico.funcao === TechnicianRole.SUPER_ADMIN) {
      throw new ForbiddenException('Não é possível desativar um super_admin');
    }

    await this.techRepo.update(id, { ativo: false, refreshToken: '' });
    return { message: 'Técnico desativado' };
  }

  async reativar(id: string) {
    const tecnico = await this.techRepo.findOne({ where: { id } });
    if (!tecnico) throw new NotFoundException('Técnico não encontrado');

    await this.techRepo.update(id, { ativo: true });
    return this.buscar(id);
  }

  async contagem() {
    const total = await this.techRepo.count();
    const ativos = await this.techRepo.count({ where: { ativo: true } });
    const disponiveis = await this.techRepo.count({ where: { ativo: true, disponivel: true } });
    return { total, ativos, disponiveis };
  }

  private sanitize(tecnico: Technician) {
    const { senha, refreshToken, ...rest } = tecnico;
    return rest;
  }
}
