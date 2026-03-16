import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  email: string;
  nome: string;
  userType: 'technician' | 'client_user';
  role: string;
  tenantId: string | null;
  permissions: string[];
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
  tenantId?: string;
  correlationId?: string;
}
