import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../../database/entities/device.entity';
import { RmmGateway } from './rmm.gateway';

@Module({
  imports: [TypeOrmModule.forFeature([Device])],
  providers: [RmmGateway],
  exports: [RmmGateway],
})
export class GatewayModule {}
