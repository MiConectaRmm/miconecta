import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Alert } from '../../database/entities/alert.entity';
import { Device } from '../../database/entities/device.entity';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { AlertEngine } from './alert-engine.service';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Alert, Device]),
    ChatModule,
  ],
  controllers: [AlertsController],
  providers: [AlertsService, AlertEngine],
  exports: [AlertsService, AlertEngine],
})
export class AlertsModule {}
