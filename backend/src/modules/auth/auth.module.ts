import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Technician } from '../../database/entities/technician.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { Device } from '../../database/entities/device.entity';
import { Tenant } from '../../database/entities/tenant.entity';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AgentAuthGuard } from './guards/agent-auth.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([Technician, AuditLog, Device, Tenant]),
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
  exports: [AuthService, JwtModule, AgentAuthGuard],
})
export class AuthModule {}
