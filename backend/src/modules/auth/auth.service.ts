import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Technician, TechnicianRole } from '../../database/entities/technician.entity';
import { ClientUser } from '../../database/entities/client-user.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from '../../common/interfaces';

// Mapeamento de roles para permissions
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['*'],
  admin_maginf: ['tenants:*', 'devices:*', 'tickets:*', 'chat:*', 'scripts:*', 'reports:*', 'audit:*', 'users:*', 'sessions:*', 'alerts:*'],
  admin: ['tenants:*', 'devices:*', 'tickets:*', 'chat:*', 'scripts:*', 'reports:*', 'audit:*', 'users:*', 'sessions:*', 'alerts:*'],
  tecnico_senior: ['devices:read', 'devices:write', 'devices:remote_access', 'tickets:*', 'chat:*', 'scripts:*', 'reports:read', 'audit:read', 'users:*', 'sessions:*', 'alerts:*'],
  tecnico: ['devices:read', 'devices:remote_access', 'tickets:read', 'tickets:write', 'chat:*', 'scripts:execute', 'users:*', 'alerts:read', 'alerts:acknowledge', 'sessions:initiate'],
  visualizador: ['devices:read', 'tickets:read', 'alerts:read', 'reports:read'],
  admin_cliente: ['devices:read', 'tickets:*', 'chat:*', 'reports:read', 'users:read', 'users:write', 'users:invite', 'sessions:read', 'alerts:read'],
  gestor: ['devices:read', 'tickets:read', 'tickets:write', 'chat:*', 'reports:read', 'sessions:read', 'alerts:read'],
  usuario: ['tickets:read', 'tickets:write', 'chat:read', 'chat:write'],
};

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepo: Repository<Technician>,
    @InjectRepository(ClientUser)
    private readonly clientUserRepo: Repository<ClientUser>,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly jwtService: JwtService,
  ) {}

  private getPermissions(role: string): string[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  private generateTokens(payload: JwtPayload) {
    const accessToken = this.jwtService.sign(payload, { expiresIn: '15m' });
    const refreshToken = this.jwtService.sign(
      { sub: payload.sub, type: 'refresh', userType: payload.userType },
      { expiresIn: '7d' },
    );
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto, ip?: string) {
    // Tentar login como Technician primeiro
    const tecnico = await this.technicianRepo.findOne({
      where: { email: dto.email },
      relations: ['tenant'],
    });

    if (tecnico && tecnico.ativo) {
      const senhaValida = await bcrypt.compare(dto.senha, tecnico.senha);
      if (senhaValida) {
        return this.loginAsTechnician(tecnico, ip);
      }
    }

    // Tentar login como ClientUser
    const clientUser = await this.clientUserRepo.findOne({
      where: { email: dto.email },
      relations: ['tenant'],
    });

    if (clientUser && clientUser.ativo) {
      const senhaValida = await bcrypt.compare(dto.senha, clientUser.senha);
      if (senhaValida) {
        return this.loginAsClientUser(clientUser, ip);
      }
    }

    throw new UnauthorizedException('Credenciais inválidas');
  }

  private async loginAsTechnician(tecnico: Technician, ip?: string) {
    await this.technicianRepo.update(tecnico.id, { ultimoLogin: new Date() });

    const payload: JwtPayload = {
      sub: tecnico.id,
      email: tecnico.email,
      nome: tecnico.nome,
      userType: 'technician',
      role: tecnico.funcao,
      tenantId: tecnico.tenantId,
      permissions: this.getPermissions(tecnico.funcao),
    };

    const tokens = this.generateTokens(payload);

    // Salvar refresh token hasheado
    const refreshHash = await bcrypt.hash(tokens.refreshToken, 10);
    await this.technicianRepo.update(tecnico.id, { refreshToken: refreshHash });

    await this.registrarAuditLogin(tecnico.tenantId, tecnico.id, tecnico.nome, 'technician', ip);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: tecnico.id,
        nome: tecnico.nome,
        email: tecnico.email,
        userType: 'technician',
        role: tecnico.funcao,
        tenantId: tecnico.tenantId,
        tenant: tecnico.tenant ? { id: tecnico.tenant.id, nome: tecnico.tenant.nome, slug: tecnico.tenant.slug } : null,
        permissions: payload.permissions,
      },
    };
  }

  private async loginAsClientUser(clientUser: ClientUser, ip?: string) {
    await this.clientUserRepo.update(clientUser.id, { ultimoLogin: new Date() });

    const payload: JwtPayload = {
      sub: clientUser.id,
      email: clientUser.email,
      nome: clientUser.nome,
      userType: 'client_user',
      role: clientUser.funcao,
      tenantId: clientUser.tenantId,
      permissions: this.getPermissions(clientUser.funcao),
    };

    const tokens = this.generateTokens(payload);

    await this.registrarAuditLogin(clientUser.tenantId, clientUser.id, clientUser.nome, 'client_user', ip);

    return {
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      user: {
        id: clientUser.id,
        nome: clientUser.nome,
        email: clientUser.email,
        userType: 'client_user',
        role: clientUser.funcao,
        tenantId: clientUser.tenantId,
        tenant: clientUser.tenant ? { id: clientUser.tenant.id, nome: clientUser.tenant.nome } : null,
        permissions: payload.permissions,
      },
    };
  }

  async refresh(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken);
      if (decoded.type !== 'refresh') throw new Error('Invalid token type');

      if (decoded.userType === 'technician') {
        const tecnico = await this.technicianRepo.findOne({ where: { id: decoded.sub }, relations: ['tenant'] });
        if (!tecnico || !tecnico.ativo || !tecnico.refreshToken) {
          throw new UnauthorizedException('Refresh token inválido');
        }

        const isValid = await bcrypt.compare(refreshToken, tecnico.refreshToken);
        if (!isValid) throw new UnauthorizedException('Refresh token inválido');

        // Rotation: gerar novos tokens e invalidar o anterior
        return this.loginAsTechnician(tecnico);
      }

      if (decoded.userType === 'client_user') {
        const clientUser = await this.clientUserRepo.findOne({ where: { id: decoded.sub }, relations: ['tenant'] });
        if (!clientUser || !clientUser.ativo) {
          throw new UnauthorizedException('Refresh token inválido');
        }
        return this.loginAsClientUser(clientUser);
      }

      throw new UnauthorizedException('Tipo de usuário desconhecido');
    } catch {
      throw new UnauthorizedException('Refresh token inválido ou expirado');
    }
  }

  async logout(userId: string, userType: string) {
    if (userType === 'technician') {
      await this.technicianRepo.update(userId, { refreshToken: '' });
    }
    return { message: 'Logout realizado com sucesso' };
  }

  async register(dto: RegisterDto) {
    const existente = await this.technicianRepo.findOne({
      where: { email: dto.email },
    });

    if (existente) {
      throw new ConflictException('E-mail já cadastrado');
    }

    const senhaHash = await bcrypt.hash(dto.senha, 12);
    const tecnico = this.technicianRepo.create({ ...dto, senha: senhaHash });
    const salvo = await this.technicianRepo.save(tecnico);

    return { id: salvo.id, nome: salvo.nome, email: salvo.email, funcao: salvo.funcao };
  }

  async validarToken(payload: any) {
    if (payload.userType === 'client_user') {
      const user = await this.clientUserRepo.findOne({ where: { id: payload.sub } });
      if (!user || !user.ativo) throw new UnauthorizedException('Token inválido');
      return { ...payload, tenantId: user.tenantId };
    }

    const tecnico = await this.technicianRepo.findOne({ where: { id: payload.sub } });
    if (!tecnico || !tecnico.ativo) throw new UnauthorizedException('Token inválido');
    return payload;
  }

  async me(userId: string, userType: string) {
    if (userType === 'client_user') {
      const user = await this.clientUserRepo.findOne({ where: { id: userId }, relations: ['tenant', 'organization'] });
      if (!user) throw new UnauthorizedException('Usuário não encontrado');
      return {
        id: user.id, nome: user.nome, email: user.email,
        userType: 'client_user', role: user.funcao,
        tenantId: user.tenantId, tenant: user.tenant,
        organization: user.organization,
        permissions: this.getPermissions(user.funcao),
      };
    }

    const tecnico = await this.technicianRepo.findOne({ where: { id: userId }, relations: ['tenant'] });
    if (!tecnico) throw new UnauthorizedException('Usuário não encontrado');
    return {
      id: tecnico.id, nome: tecnico.nome, email: tecnico.email,
      userType: 'technician', role: tecnico.funcao,
      tenantId: tecnico.tenantId, tenant: tecnico.tenant,
      tenantsAtribuidos: tecnico.tenantsAtribuidos,
      permissions: this.getPermissions(tecnico.funcao),
    };
  }

  private async registrarAuditLogin(tenantId: string, userId: string, nome: string, tipo: string, ip?: string) {
    await this.auditRepo.save({
      tenantId,
      usuarioId: userId,
      usuarioNome: nome,
      acao: 'login',
      recurso: 'auth',
      detalhes: { userType: tipo },
      ip,
    });
  }
}
