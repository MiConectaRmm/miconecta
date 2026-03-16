import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LgpdRequest } from '../../database/entities/lgpd-request.entity';
import { ConsentRecord } from '../../database/entities/consent-record.entity';
import { LgpdController } from './lgpd.controller';
import { LgpdService } from './lgpd.service';

@Module({
  imports: [TypeOrmModule.forFeature([LgpdRequest, ConsentRecord])],
  controllers: [LgpdController],
  providers: [LgpdService],
  exports: [LgpdService],
})
export class LgpdModule {}
