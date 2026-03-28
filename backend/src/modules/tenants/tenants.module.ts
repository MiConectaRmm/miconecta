import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { Organization } from '../../database/entities/organization.entity';
import { Technician } from '../../database/entities/technician.entity';
import { TenantsController } from './tenants.controller';
import { TenantsService } from './tenants.service';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant, Organization, Technician]),
    HttpModule,
    AgentsModule,
  ],
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
