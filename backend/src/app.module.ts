import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';

// Módulos existentes (v1)
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

// Módulos novos (v2)
import { TicketsModule } from './modules/tickets/tickets.module';
import { ChatModule } from './modules/chat/chat.module';
import { RemoteSessionsModule } from './modules/remote-sessions/remote-sessions.module';
import { UsersModule } from './modules/users/users.module';
import { AgentsModule } from './modules/agents/agents.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

// Entidades existentes (v1)
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

// Entidades novas (v2)
import { ClientUser } from './database/entities/client-user.entity';
import { Ticket } from './database/entities/ticket.entity';
import { TicketComment } from './database/entities/ticket-comment.entity';
import { ChatMessage } from './database/entities/chat-message.entity';
import { RemoteSession } from './database/entities/remote-session.entity';
import { RemoteSessionLog } from './database/entities/remote-session-log.entity';
import { ConsentRecord } from './database/entities/consent-record.entity';
import { Notification } from './database/entities/notification.entity';

const entities = [
  // v1
  Tenant, Organization, Device, DeviceMetric, DeviceInventory,
  Alert, Script, ScriptExecution, SoftwarePackage, SoftwareDeployment,
  Technician, Session, AuditLog, Patch,
  // v2
  ClientUser, Ticket, TicketComment, ChatMessage,
  RemoteSession, RemoteSessionLog, ConsentRecord, Notification,
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

    // v1 modules
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

    // v2 modules
    TicketsModule,
    ChatModule,
    RemoteSessionsModule,
    UsersModule,
    AgentsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
