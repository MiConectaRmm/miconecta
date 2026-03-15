import { Module, DynamicModule } from '@nestjs/common';
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

import {
  Tenant,
  Organization,
  Device,
  DeviceMetric,
  DeviceInventory,
  Alert,
  Script,
  ScriptExecution,
  SoftwarePackage,
  SoftwareDeployment,
  Technician,
  Session,
  AuditLog,
  Patch,
} from './database/entities';

const entities = [
  Tenant,
  Organization,
  Device,
  DeviceMetric,
  DeviceInventory,
  Alert,
  Script,
  ScriptExecution,
  SoftwarePackage,
  SoftwareDeployment,
  Technician,
  Session,
  AuditLog,
  Patch,
];

// Redis/Bull é opcional — funciona sem ele em produção
const redisImports: DynamicModule[] = [];
if (process.env.REDIS_URL || process.env.REDIS_HOST) {
  redisImports.push(
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
  );
}

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
            type: 'postgres' as const,
            url: databaseUrl,
            entities,
            synchronize: true,
            logging: false,
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres' as const,
          host: config.get<string>('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get<string>('DATABASE_USER', 'miconecta'),
          password: config.get<string>('DATABASE_PASSWORD', 'MiConecta@2026!'),
          database: config.get<string>('DATABASE_NAME', 'miconecta_rmm'),
          entities,
          synchronize: true,
          logging: config.get('NODE_ENV') === 'development',
        };
      },
    }),

    // Redis (opcional)
    ...redisImports,

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
