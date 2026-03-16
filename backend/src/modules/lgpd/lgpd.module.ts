import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LgpdRequest } from '../../database/entities/lgpd-request.entity';
import { ConsentRecord } from '../../database/entities/consent-record.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Notification } from '../../database/entities/notification.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { RemoteSessionLog } from '../../database/entities/remote-session-log.entity';
import { ChatMessage } from '../../database/entities/chat-message.entity';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';
import { DataRetentionService } from './data-retention.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    LgpdRequest, ConsentRecord, AuditLog, Notification,
    DeviceMetric, RemoteSessionLog, ChatMessage,
  ])],
  controllers: [LgpdController],
  providers: [LgpdService, DataRetentionService],
  exports: [LgpdService, DataRetentionService],
})
export class LgpdModule {}
