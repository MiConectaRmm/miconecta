import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Prefixo global da API
  app.setGlobalPrefix('api/v1');

  // Validação global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Swagger / Documentação da API
  const config = new DocumentBuilder()
    .setTitle('MIConectaRMM Enterprise API')
    .setDescription('API da plataforma RMM da Maginf Tecnologia')
    .setVersion('1.0.0')
    .addBearerAuth()
    .addTag('autenticação', 'Endpoints de autenticação')
    .addTag('tenants', 'Gestão de tenants/clientes')
    .addTag('dispositivos', 'Gestão de dispositivos')
    .addTag('métricas', 'Monitoramento e métricas')
    .addTag('alertas', 'Motor de alertas')
    .addTag('scripts', 'Execução remota de scripts')
    .addTag('software', 'Deploy de software')
    .addTag('patches', 'Gerenciamento de patches')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 MIConectaRMM API rodando na porta ${port}`);
  console.log(`📖 Documentação: http://localhost:${port}/api/docs`);
}
bootstrap();
