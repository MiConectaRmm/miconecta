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
        // Prioridade: DB_HOST > DATABASE_URL > defaults
        const dbHost = config.get('DB_HOST');
        const databaseUrl = config.get('DATABASE_URL');

        if (dbHost) {
          const needsSsl = dbHost.includes('supabase') || dbHost.includes('neon') || dbHost.includes('amazonaws');
          console.log(`TypeORM: conectando via DB_HOST em ${dbHost} (ssl=${needsSsl})`);
          return {
            type: 'postgres' as const,
            host: dbHost,
            port: parseInt(config.get('DB_PORT', '5432'), 10),
            username: config.get<string>('DB_USER', 'postgres'),
            password: config.get<string>('DB_PASSWORD', ''),
            database: config.get<string>('DB_NAME', 'postgres'),
            entities,
            synchronize: true,
            logging: false,
            ssl: needsSsl ? { rejectUnauthorized: false } : false,
            retryAttempts: 5,
            retryDelay: 3000,
            connectTimeoutMS: 30000,
          };
        }

        if (databaseUrl) {
          try {
            const url = new URL(databaseUrl);
            const needsSsl = url.hostname.includes('supabase') || url.hostname.includes('neon') || url.hostname.includes('amazonaws');
            console.log(`TypeORM: conectando via URL em ${url.hostname} (ssl=${needsSsl})`);
            return {
              type: 'postgres' as const,
              host: url.hostname,
              port: parseInt(url.port || '5432', 10),
              username: decodeURIComponent(url.username),
              password: decodeURIComponent(url.password),
              database: url.pathname.replace('/', ''),
              entities,
              synchronize: true,
              logging: false,
              ssl: needsSsl ? { rejectUnauthorized: false } : false,
              retryAttempts: 5,
              retryDelay: 3000,
              connectTimeoutMS: 30000,
            };
          } catch (e) {
            console.error('ERRO ao parsear DATABASE_URL:', e.message);
          }
        }

        console.log('TypeORM: usando config local default');
        return {
          type: 'postgres' as const,
          host: config.get<string>('DATABASE_HOST', 'localhost'),
          port: config.get<number>('DATABASE_PORT', 5432),
          username: config.get<string>('DATABASE_USER', 'miconecta'),
          password: config.get<string>('DATABASE_PASSWORD', ''),
          database: config.get<string>('DATABASE_NAME', 'miconecta_rmm'),
          entities,
          synchronize: true,
          logging: true,
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
