import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientUser } from '../../database/entities/client-user.entity';
import { Technician } from '../../database/entities/technician.entity';
import { ClientUsersController } from './client-users.controller';
import { ClientUsersService } from './client-users.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientUser, Technician])],
  controllers: [ClientUsersController],
  providers: [ClientUsersService],
  exports: [ClientUsersService],
})
export class UsersModule {}
