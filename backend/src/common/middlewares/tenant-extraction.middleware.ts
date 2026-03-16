import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantExtractionMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const user = (req as any).user;
    if (user) {
      if (user.userType === 'client_user') {
        (req as any).tenantId = user.tenantId;
      } else {
        (req as any).tenantId = (req.headers['x-tenant-id'] as string) || user.tenantId;
      }
    }
    next();
  }
}
