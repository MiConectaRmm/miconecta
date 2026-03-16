import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const method = request.method;

    // Apenas auditar operações de escrita
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const user = request.user;
        const logData = {
          correlationId: request.correlationId,
          tenantId: request.tenantId,
          userId: user?.sub,
          userName: user?.nome,
          userType: user?.userType,
          method,
          path: request.path,
          statusCode: request.res?.statusCode,
          duration,
          ip: request.ip || request.headers['x-forwarded-for'],
          userAgent: request.headers['user-agent'],
        };
        // Log estruturado — em produção usar logger injetado
        console.log(JSON.stringify({ type: 'audit', ...logData }));
      }),
    );
  }
}
