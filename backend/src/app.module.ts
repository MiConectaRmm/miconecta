import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

import { AuthModule } from './modules/auth/auth.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { DevicesModule } from './modules/devices/devices.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { SoftwareModule } from './modules/software/software.module';
import { PatchesModule } from './modules/patches/patches.module';
import { GatewayModule } from './modules/gateway/gateway.module';
import { AuditModule } from './modules/audit/audit.module';

@Module({
  imports: [
    // Configuração global
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // Banco de dados PostgreSQL (Supabase)
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get('DATABASE_URL');
        if (databaseUrl) {
          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [__dirname + '/**/*.entity{.ts,.js}'],
            synchronize: config.get('NODE_ENV') !== 'production',
            logging: config.get('NODE_ENV') === 'development',
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres',
          host: config.get('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get('DATABASE_USER', 'miconecta'),
          password: config.get('DATABASE_PASSWORD', 'MiConecta@2026!'),
          database: config.get('DATABASE_NAME', 'miconecta_rmm'),
          entities: [__dirname + '/**/*.entity{.ts,.js}'],
          synchronize: config.get('NODE_ENV') !== 'production',
          logging: config.get('NODE_ENV') === 'development',
        };
      },
    }),

    // Redis para filas (Upstash)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get('REDIS_URL');
        if (redisUrl) {
          return { redis: redisUrl };
        }
        return {
          redis: {
            host: config.get('REDIS_HOST', 'localhost'),
            port: config.get<number>('REDIS_PORT', 6379),
            password: config.get('REDIS_PASSWORD'),
          },
        };
      },
    }),

    // Agendamento de tarefas
    ScheduleModule.forRoot(),

    // Módulos da aplicação
    AuthModule,
    TenantsModule,
    DevicesModule,
    MetricsModule,
    AlertsModule,
    ScriptsModule,
    SoftwareModule,
    PatchesModule,
    GatewayModule,
    AuditModule,
  ],
})
export class AppModule {}
