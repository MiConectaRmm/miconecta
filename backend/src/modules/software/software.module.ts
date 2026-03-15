import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SoftwarePackage } from '../../database/entities/software-package.entity';
import { SoftwareDeployment } from '../../database/entities/software-deployment.entity';
import { Device } from '../../database/entities/device.entity';
import { SoftwareController } from './software.controller';
import { SoftwareService } from './software.service';

@Module({
  imports: [TypeOrmModule.forFeature([SoftwarePackage, SoftwareDeployment, Device])],
  controllers: [SoftwareController],
  providers: [SoftwareService],
  exports: [SoftwareService],
})
export class SoftwareModule {}
