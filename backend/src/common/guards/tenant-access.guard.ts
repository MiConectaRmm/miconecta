import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';

@Injectable()
export class TenantAccessGuard implements CanActivate {
  private readonly logger = new Logger(TenantAccessGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return false;

    // Técnicos Maginf: super_admin e admin_maginf acessam qualquer tenant
    if (user.userType === 'technician') {
      if (['super_admin', 'admin_maginf'].includes(user.role)) {
        // Extrair tenant do header X-Tenant-Id
        const headerTenantId = request.headers['x-tenant-id'];
        if (headerTenantId) {
          request.tenantId = headerTenantId;
        } else if (user.tenantId) {
          request.tenantId = user.tenantId;
        }
        this.logger.debug(`[TenantAccessGuard] super/admin: userId=${user.sub}, role=${user.role}, tenantId=${request.tenantId}`);
        return true;
      }
      // Técnicos comuns: usar tenant do JWT ou header
      const headerTenantId = request.headers['x-tenant-id'];
      request.tenantId = headerTenantId || user.tenantId;
      this.logger.debug(`[TenantAccessGuard] tecnico: userId=${user.sub}, role=${user.role}, tenantId=${request.tenantId}`);
      return true;
    }

    // Client users: tenant fixo do JWT — ignora qualquer header
    if (user.userType === 'client_user') {
      if (!user.tenantId) {
        throw new ForbiddenException('Usuário sem tenant associado');
      }
      request.tenantId = user.tenantId;
      return true;
    }

    return false;
  }
}
