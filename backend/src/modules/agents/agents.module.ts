import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Device } from '../../database/entities/device.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { AlertsModule } from '../alerts/alerts.module';
import { AgentsController } from './agents.controller';
import { AgentsService } from './agents.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, Tenant, DeviceMetric, DeviceInventory]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
    AlertsModule,
  ],
  controllers: [AgentsController],
  providers: [AgentsService],
  exports: [AgentsService],
})
export class AgentsModule {}
