import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  try {
    logger.log('Iniciando MIConectaRMM API v2...');
    logger.log(`NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
    logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'definida' : 'NAO DEFINIDA'}`);

    const app = await NestFactory.create(AppModule, {
      logger: isProd ? ['error', 'warn', 'log'] : ['error', 'warn', 'log', 'debug'],
    });

    // Security headers
    app.use(helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }));

    app.setGlobalPrefix('api/v1');

    // Global pipes
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    // Global filters
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global interceptors
    app.useGlobalInterceptors(new AuditInterceptor());

    // CORS
    const corsOrigin = process.env.CORS_ORIGIN || (isProd ? 'https://miconecta-frontend.fly.dev' : '*');
    app.enableCors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map(o => o.trim()),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Health checks (fora do prefix /api/v1)
    const httpAdapter = app.getHttpAdapter();
    const startTime = Date.now();

    httpAdapter.get('/health', (req: any, res: any) => {
      res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        uptime: Math.round((Date.now() - startTime) / 1000),
        environment: process.env.NODE_ENV || 'development',
      });
    });

    httpAdapter.get('/health/live', (req: any, res: any) => {
      res.json({ status: 'ok', check: 'liveness' });
    });

    httpAdapter.get('/health/ready', (req: any, res: any) => {
      res.json({ status: 'ok', check: 'readiness', uptime: Math.round((Date.now() - startTime) / 1000) });
    });

    // Swagger — apenas em dev/staging
    if (!isProd) {
      const config = new DocumentBuilder()
        .setTitle('MIConectaRMM Enterprise API')
        .setDescription('API v2 — Plataforma RMM + Help Desk da Maginf Tecnologia')
        .setVersion('2.0.0')
        .addBearerAuth()
        .addApiKey({ type: 'apiKey', name: 'X-Tenant-Id', in: 'header' }, 'tenant-id')
        .build();

      const document = SwaggerModule.createDocument(app, config);
      SwaggerModule.setup('api/docs', app, document);
      logger.log('Swagger habilitado em /api/docs');
    }

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`MIConectaRMM API v2 rodando na porta ${port}`);
    logger.log(`Módulos: 20 | Entidades: 25 | Rate limit: 100 req/min`);
  } catch (error) {
    console.error('FATAL: Falha ao iniciar aplicacao:', error);
    process.exit(1);
  }
}
bootstrap();
