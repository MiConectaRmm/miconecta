import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('Iniciando MIConectaRMM API v2...');
    logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'definida' : 'NAO DEFINIDA'}`);

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

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
    const corsOrigin = process.env.CORS_ORIGIN || '*';
    app.enableCors({
      origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    // Swagger
    const config = new DocumentBuilder()
      .setTitle('MIConectaRMM Enterprise API')
      .setDescription('API v2 — Plataforma RMM + Help Desk da Maginf Tecnologia')
      .setVersion('2.0.0')
      .addBearerAuth()
      .addApiKey({ type: 'apiKey', name: 'X-Tenant-Id', in: 'header' }, 'tenant-id')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`MIConectaRMM API v2 rodando na porta ${port}`);
    logger.log(`Swagger: http://localhost:${port}/api/docs`);
    logger.log(`Módulos: 20 | Entidades: 25 | Endpoints: ~80`);
  } catch (error) {
    console.error('FATAL: Falha ao iniciar aplicacao:', error);
    process.exit(1);
  }
}
bootstrap();
