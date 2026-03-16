import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportSchedule } from '../../database/entities/report-schedule.entity';
import { Device } from '../../database/entities/device.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { Alert } from '../../database/entities/alert.entity';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [TypeOrmModule.forFeature([ReportSchedule, Device, Ticket, Alert])],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
