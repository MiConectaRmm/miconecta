import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Technician, TechnicianRole } from '../../database/entities/technician.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const tecnico = await this.technicianRepo.findOne({
      where: { email: dto.email },
      relations: ['tenant'],
    });

    if (!tecnico || !tecnico.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(dto.senha, tecnico.senha);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    // Atualizar último login
    await this.technicianRepo.update(tecnico.id, { ultimoLogin: new Date() });

    // Registrar auditoria
    await this.auditRepo.save({
      tenantId: tecnico.tenantId,
      usuarioId: tecnico.id,
      usuarioNome: tecnico.nome,
      acao: 'login',
      recurso: 'auth',
      ip,
    });

    const payload = {
      sub: tecnico.id,
      email: tecnico.email,
      nome: tecnico.nome,
      funcao: tecnico.funcao,
      tenantId: tecnico.tenantId,
    };

    return {
      access_token: this.jwtService.sign(payload),
      tecnico: {
        id: tecnico.id,
        nome: tecnico.nome,
        email: tecnico.email,
        funcao: tecnico.funcao,
        tenantId: tecnico.tenantId,
        tenant: tecnico.tenant,
      },
    };
  }

  async register(dto: RegisterDto) {
    const existente = await this.technicianRepo.findOne({
      where: { email: dto.email },
    });

    if (existente) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);

    const tecnico = this.technicianRepo.create({
      ...dto,
      senha: senhaHash,
    });

    const salvo = await this.technicianRepo.save(tecnico);

    return {
      id: salvo.id,
      nome: salvo.nome,
      email: salvo.email,
      funcao: salvo.funcao,
    };
  }

  async bootstrap() {
    const existingTenant = await this.tenantRepo.findOne({ where: { slug: 'maginf' } });
    if (existingTenant) {
      const existingAdmin = await this.technicianRepo.findOne({ where: { email: 'admin@maginf.com.br' } });
      return { message: 'Bootstrap já executado', tenantId: existingTenant.id, adminExists: !!existingAdmin };
    }

    const tenant = await this.tenantRepo.save({
      nome: 'Maginf Tecnologia',
      slug: 'maginf',
      email: 'contato@maginf.com.br',
      ativo: true,
    });

    const senhaHash = await bcrypt.hash('Admin@2026', 12);
    const admin = await this.technicianRepo.save({
      tenantId: tenant.id,
      nome: 'Administrador',
      email: 'admin@maginf.com.br',
      senha: senhaHash,
      funcao: TechnicianRole.ADMIN,
      ativo: true,
    });

    return {
      message: 'Bootstrap concluído!',
      tenant: { id: tenant.id, nome: tenant.nome, slug: tenant.slug },
      admin: { id: admin.id, nome: admin.nome, email: admin.email, funcao: admin.funcao },
      credenciais: { email: 'admin@maginf.com.br', senha: 'Admin@2026' },
    };
  }

  async validarToken(payload: any) {
    const tecnico = await this.technicianRepo.findOne({
      where: { id: payload.sub },
    });

    if (!tecnico || !tecnico.ativo) {
      throw new UnauthorizedException('Token inválido');
    }

    return tecnico;
  }
}
