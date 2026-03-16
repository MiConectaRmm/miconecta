import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

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
  Tenant, Organization, Device, DeviceMetric, DeviceInventory,
  Alert, Script, ScriptExecution, SoftwarePackage, SoftwareDeployment,
  Technician, Session, AuditLog, Patch,
];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const databaseUrl = config.get<string>('DATABASE_URL');
        const useSsl = config.get<string>('DB_SSL', 'false') === 'true';
        console.log(`TypeORM: DATABASE_URL=${databaseUrl ? 'set' : 'unset'}, SSL=${useSsl}`);

        return {
          type: 'postgres' as const,
          url: databaseUrl,
          entities,
          synchronize: true,
          logging: false,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          retryAttempts: 5,
          retryDelay: 3000,
        };
      },
    }),

    ScheduleModule.forRoot(),

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
