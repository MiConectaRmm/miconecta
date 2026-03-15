import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Patch } from '../../database/entities/patch.entity';
import { Device } from '../../database/entities/device.entity';
import { PatchesController } from './patches.controller';
import { PatchesService } from './patches.service';

@Module({
  imports: [TypeOrmModule.forFeature([Patch, Device])],
  controllers: [PatchesController],
  providers: [PatchesService],
  exports: [PatchesService],
})
export class PatchesModule {}
