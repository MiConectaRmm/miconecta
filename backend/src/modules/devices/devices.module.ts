import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Device } from '../../database/entities/device.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { DeviceMetric } from '../../database/entities/device-metric.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AgentAuthGuard } from '../../common/guards/agent-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device, DeviceInventory, DeviceMetric]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [DevicesController],
  providers: [DevicesService, AgentAuthGuard],
  exports: [DevicesService],
})
export class DevicesModule {}
