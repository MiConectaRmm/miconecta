import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    logger.log('Iniciando MIConectaRMM API...');
    logger.log(`NODE_ENV: ${process.env.NODE_ENV}`);
    logger.log(`DATABASE_URL: ${process.env.DATABASE_URL ? 'definida' : 'NAO DEFINIDA'}`);

    const app = await NestFactory.create(AppModule, {
      logger: ['error', 'warn', 'log'],
    });

    app.setGlobalPrefix('api/v1');

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const corsOrigin = process.env.CORS_ORIGIN || '*';
    app.enableCors({
      origin: corsOrigin === '*' ? '*' : corsOrigin.split(',').map(o => o.trim()),
      methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
      credentials: true,
    });

    const config = new DocumentBuilder()
      .setTitle('MIConectaRMM Enterprise API')
      .setDescription('API da plataforma RMM da Maginf Tecnologia')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');
    logger.log(`MIConectaRMM API rodando na porta ${port}`);
  } catch (error) {
    console.error('FATAL: Falha ao iniciar aplicacao:', error);
    process.exit(1);
  }
}
bootstrap();
