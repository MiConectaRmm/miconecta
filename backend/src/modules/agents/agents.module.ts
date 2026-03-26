import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Device } from '../../database/entities/device.entity';
import { Organization } from '../../database/entities/organization.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { Agent } from '../../database/entities/agent.entity';
import { InstallationToken } from '../../database/entities/installation-token.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { AlertsModule } from '../alerts/alerts.module';
import { ChatModule } from '../chat/chat.module';
import { TicketsModule } from '../tickets/tickets.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';
import { AgentAuthGuard } from '../auth/guards/agent-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, Organization, Tenant, Agent, InstallationToken, DeviceMetric, DeviceInventory, Ticket]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
    AlertsModule,
    ChatModule,
    TicketsModule,
    ConversationsModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService, AgentAuthGuard],
  exports: [AgentsService],
})
export class AgentsModule {}
