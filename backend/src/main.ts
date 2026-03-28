import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { AppSocketIoAdapter } from './socket-io.adapter';

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

    const httpAdapter = app.getHttpAdapter();
    const startTime = Date.now();
    // Health o mais cedo possível (antes de helmet/CORS/Socket.IO) para o probe da Fly não falhar sob carga de polling WS.
    httpAdapter.get('/health', (_req: any, res: any) => {
      res.status(200).json({
        status: 'ok',
        uptime: Math.round((Date.now() - startTime) / 1000),
        env: process.env.NODE_ENV || 'development',
      });
    });
    httpAdapter.get('/health/live', (_req: any, res: any) => {
      res.status(200).json({ status: 'ok', check: 'liveness' });
    });
    httpAdapter.get('/health/ready', (_req: any, res: any) => {
      res.status(200).json({ status: 'ok', check: 'readiness' });
    });

    // Security headers — CORP cross-origin: o painel (app.*) embute imagens da API (avatars, etc.)
    app.use(helmet({
      contentSecurityPolicy: isProd ? undefined : false,
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
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

    // CORS — incluir app oficial e fly.dev; CORS_ORIGIN pode ser lista separada por vírgula no Fly
    const defaultProdOrigins =
      'https://app.maginf.com.br,https://www.app.maginf.com.br,https://miconecta-frontend.fly.dev';
    const corsOrigin = process.env.CORS_ORIGIN || (isProd ? defaultProdOrigins : '*');
    app.enableCors({
      origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((o) => o.trim()),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Id', 'X-Requested-With'],
    });

    app.useWebSocketAdapter(new AppSocketIoAdapter(app));

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
