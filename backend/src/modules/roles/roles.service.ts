import { Injectable } from '@nestjs/common';

export interface RoleDefinition {
  nome: string;
  descricao: string;
  tipo: 'maginf' | 'cliente';
  permissions: string[];
}

const ROLES: Record<string, RoleDefinition> = {
  super_admin: {
    nome: 'Super Admin',
    descricao: 'Acesso total ao sistema',
    tipo: 'maginf',
    permissions: ['*'],
  },
  admin_maginf: {
    nome: 'Admin Maginf',
    descricao: 'Administrador da Maginf',
    tipo: 'maginf',
    permissions: [
      'tenants:read', 'tenants:write', 'tenants:delete',
      'devices:read', 'devices:write', 'devices:remote_access',
      'tickets:read', 'tickets:write', 'tickets:assign', 'tickets:close',
      'chat:read', 'chat:write',
      'scripts:read', 'scripts:execute', 'scripts:manage',
      'reports:read', 'reports:generate',
      'audit:read', 'audit:export',
      'users:read', 'users:write', 'users:invite',
      'alerts:read', 'alerts:acknowledge', 'alerts:configure',
      'sessions:read', 'sessions:initiate',
      'lgpd:manage', 'lgpd:export',
      'storage:read', 'storage:write', 'storage:delete',
    ],
  },
  admin: {
    nome: 'Admin (legado)',
    descricao: 'Mapeado para admin_maginf',
    tipo: 'maginf',
    permissions: [
      'tenants:read', 'tenants:write', 'tenants:delete',
      'devices:read', 'devices:write', 'devices:remote_access',
      'tickets:read', 'tickets:write', 'tickets:assign', 'tickets:close',
      'chat:read', 'chat:write',
      'scripts:read', 'scripts:execute', 'scripts:manage',
      'reports:read', 'reports:generate',
      'audit:read', 'audit:export',
      'users:read', 'users:write', 'users:invite',
      'alerts:read', 'alerts:acknowledge', 'alerts:configure',
      'sessions:read', 'sessions:initiate',
      'lgpd:manage', 'lgpd:export',
      'storage:read', 'storage:write', 'storage:delete',
    ],
  },
  tecnico_senior: {
    nome: 'Técnico Sênior',
    descricao: 'Técnico com acesso avançado',
    tipo: 'maginf',
    permissions: [
      'devices:read', 'devices:write', 'devices:remote_access',
      'tickets:read', 'tickets:write', 'tickets:assign', 'tickets:close',
      'chat:read', 'chat:write',
      'scripts:read', 'scripts:execute', 'scripts:manage',
      'reports:read',
      'audit:read',
      'users:read',
      'alerts:read', 'alerts:acknowledge', 'alerts:configure',
      'sessions:read', 'sessions:initiate',
      'storage:read', 'storage:write',
    ],
  },
  tecnico: {
    nome: 'Técnico',
    descricao: 'Técnico de suporte',
    tipo: 'maginf',
    permissions: [
      'devices:read', 'devices:remote_access',
      'tickets:read', 'tickets:write',
      'chat:read', 'chat:write',
      'scripts:read', 'scripts:execute',
      'users:read',
      'alerts:read', 'alerts:acknowledge',
      'sessions:initiate',
      'storage:read', 'storage:write',
    ],
  },
  visualizador: {
    nome: 'Visualizador',
    descricao: 'Acesso somente leitura',
    tipo: 'maginf',
    permissions: [
      'devices:read',
      'tickets:read',
      'alerts:read',
      'reports:read',
    ],
  },
  admin_cliente: {
    nome: 'Admin do Cliente',
    descricao: 'Administrador do tenant do cliente',
    tipo: 'cliente',
    permissions: [
      'devices:read',
      'tickets:read', 'tickets:write',
      'chat:read', 'chat:write',
      'reports:read',
      'users:read', 'users:write', 'users:invite',
      'storage:read',
    ],
  },
  gestor: {
    nome: 'Gestor',
    descricao: 'Gestor do cliente',
    tipo: 'cliente',
    permissions: [
      'devices:read',
      'tickets:read', 'tickets:write',
      'chat:read', 'chat:write',
      'reports:read',
    ],
  },
  usuario: {
    nome: 'Usuário',
    descricao: 'Usuário final do cliente',
    tipo: 'cliente',
    permissions: [
      'tickets:read', 'tickets:write',
      'chat:read', 'chat:write',
    ],
  },
};

@Injectable()
export class RolesService {
  getAllRoles(): RoleDefinition[] {
    return Object.entries(ROLES).map(([key, value]) => ({
      ...value,
      id: key,
    }));
  }

  getRolesByTipo(tipo: 'maginf' | 'cliente'): RoleDefinition[] {
    return Object.entries(ROLES)
      .filter(([, v]) => v.tipo === tipo)
      .map(([key, value]) => ({ ...value, id: key }));
  }

  getRole(roleId: string): RoleDefinition | null {
    return ROLES[roleId] || null;
  }

  getPermissions(roleId: string): string[] {
    return ROLES[roleId]?.permissions || [];
  }

  hasPermission(roleId: string, permission: string): boolean {
    const perms = this.getPermissions(roleId);
    if (perms.includes('*')) return true;
    if (perms.includes(permission)) return true;
    const [resource] = permission.split(':');
    return perms.includes(`${resource}:*`);
  }

  hasAnyPermission(roleId: string, permissions: string[]): boolean {
    return permissions.some(p => this.hasPermission(roleId, p));
  }

  hasAllPermissions(roleId: string, permissions: string[]): boolean {
    return permissions.every(p => this.hasPermission(roleId, p));
  }
}
