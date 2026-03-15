import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Technician } from '../../database/entities/technician.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
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
