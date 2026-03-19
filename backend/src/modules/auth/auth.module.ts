import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Technician } from '../../database/entities/technician.entity';
import { ClientUser } from '../../database/entities/client-user.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Device } from '../../database/entities/device.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AgentAuthGuard } from './guards/agent-auth.guard';
import { Agent } from '../../database/entities/agent.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Technician, ClientUser, AuditLog, Device, Tenant, Agent]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRATION', '24h') },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AgentAuthGuard],
  exports: [
    AuthService,
    JwtModule,
    AgentAuthGuard,
    TypeOrmModule, // Export repositories for AgentAuthGuard usage in other modules
  ],
})
export class AuthModule {}
