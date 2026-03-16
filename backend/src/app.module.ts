import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// ── Middlewares ──
import { CorrelationIdMiddleware } from './common/middlewares/correlation-id.middleware';

// ── Módulos Core ──
import { AuthModule } from './modules/auth/auth.module';
import { RolesModule } from './modules/roles/roles.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { UsersModule } from './modules/users/users.module';
import { DevicesModule } from './modules/devices/devices.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ChatModule } from './modules/chat/chat.module';
import { RemoteSessionsModule } from './modules/remote-sessions/remote-sessions.module';
import { ScriptsModule } from './modules/scripts/scripts.module';
import { SoftwareModule } from './modules/software/software.module';
import { PatchesModule } from './modules/patches/patches.module';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReportsModule } from './modules/reports/reports.module';
import { StorageModule } from './modules/storage/storage.module';
import { LgpdModule } from './modules/lgpd/lgpd.module';
import { GatewayModule } from './modules/gateway/gateway.module';

// ── Entidades ──
import {
  Tenant, Organization, Device, DeviceMetric, DeviceInventory,
  Alert, Script, ScriptExecution, SoftwarePackage, SoftwareDeployment,
  Technician, Session, AuditLog, Patch,
  ClientUser, Ticket, TicketComment, ChatMessage,
  RemoteSession, RemoteSessionLog, ConsentRecord, Notification,
  FileAttachment, LgpdRequest, ReportSchedule,
} from './database/entities';

// ── Subscriber ──
import { TenantValidationSubscriber } from './database/subscribers/tenant-validation.subscriber';

const entities = [
  Tenant, Organization, Device, DeviceMetric, DeviceInventory,
  Alert, Script, ScriptExecution, SoftwarePackage, SoftwareDeployment,
  Technician, Session, AuditLog, Patch,
  ClientUser, Ticket, TicketComment, ChatMessage,
  RemoteSession, RemoteSessionLog, ConsentRecord, Notification,
  FileAttachment, LgpdRequest, ReportSchedule,
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
          subscribers: [TenantValidationSubscriber],
          synchronize: true,
          logging: false,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          retryAttempts: 5,
          retryDelay: 3000,
        };
      },
    }),

    ScheduleModule.forRoot(),

    // Core
    AuthModule,
    RolesModule,

    // Domain
    TenantsModule,
    UsersModule,
    DevicesModule,
    AgentsModule,
    MetricsModule,
    AlertsModule,
    TicketsModule,
    ChatModule,
    RemoteSessionsModule,
    ScriptsModule,
    SoftwareModule,
    PatchesModule,

    // Platform
    AuditModule,
    NotificationsModule,
    ReportsModule,
    StorageModule,
    LgpdModule,
    GatewayModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
