import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Device } from '../../database/entities/device.entity';
import { RmmGateway } from './rmm.gateway';
import { RemoteSessionsModule } from '../remote-sessions/remote-sessions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Device]),
    forwardRef(() => RemoteSessionsModule),
  ],
  providers: [RmmGateway],
  exports: [RmmGateway],
})
export class GatewayModule {}
