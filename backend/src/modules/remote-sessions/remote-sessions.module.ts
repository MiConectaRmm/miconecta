import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemoteSession } from '../../database/entities/remote-session.entity';
import { RemoteSessionLog } from '../../database/entities/remote-session-log.entity';
import { ConsentRecord } from '../../database/entities/consent-record.entity';
import { Device } from '../../database/entities/device.entity';
import { Agent } from '../../database/entities/agent.entity';
import { AuthModule } from '../auth/auth.module';
import { RemoteSessionsController } from './remote-sessions.controller';
import { RemoteSessionsService } from './remote-sessions.service';
import { GatewayModule } from '../gateway/gateway.module';
import { ConversationsModule } from '../conversations/conversations.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RemoteSession, RemoteSessionLog, ConsentRecord, Device, Agent]),
    AuthModule,
    forwardRef(() => GatewayModule),
    ConversationsModule,
  ],
  controllers: [RemoteSessionsController],
  providers: [RemoteSessionsService],
  exports: [RemoteSessionsService],
})
export class RemoteSessionsModule {}
