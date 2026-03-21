import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientUser } from '../../database/entities/client-user.entity';
import { Technician } from '../../database/entities/technician.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { ClientUsersController } from './client-users.controller';
import { ClientUsersService } from './client-users.service';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientUser, Technician, Tenant])],
  controllers: [ClientUsersController, TechniciansController],
  providers: [ClientUsersService, TechniciansService],
  exports: [ClientUsersService, TechniciansService],
})
export class UsersModule {}
