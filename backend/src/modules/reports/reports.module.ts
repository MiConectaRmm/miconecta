import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportSchedule } from '../../database/entities/report-schedule.entity';
import { Device } from '../../database/entities/device.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { Alert } from '../../database/entities/alert.entity';
import { RemoteSession } from '../../database/entities/remote-session.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReportSchedule, Device, DeviceInventory, Ticket, Alert, RemoteSession, AuditLog])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
