import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Script } from '../../database/entities/script.entity';
import { ScriptExecution } from '../../database/entities/script-execution.entity';
import { Device } from '../../database/entities/device.entity';
import { GatewayModule } from '../gateway/gateway.module';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';

@Module({
  imports: [TypeOrmModule.forFeature([Script, ScriptExecution, Device]), GatewayModule],
  controllers: [ScriptsController],
  providers: [ScriptsService],
  exports: [ScriptsService],
})
export class ScriptsModule {}
