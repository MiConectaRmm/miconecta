import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../../database/entities/device.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { AgentController } from './agent.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Device, DeviceInventory])],
  controllers: [DevicesController, AgentController],
  providers: [DevicesService],
  exports: [DevicesService],
})
export class DevicesModule {}
