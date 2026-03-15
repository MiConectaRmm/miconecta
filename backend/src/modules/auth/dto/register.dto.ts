import { IsEmail, IsString, MinLength, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { TechnicianRole } from '../../../database/entities/technician.entity';

export class RegisterDto {
  @ApiProperty({ example: 'João Silva' })
  @IsString()
  @MinLength(3, { message: 'Nome deve ter pelo menos 3 caracteres' })
  nome: string;

  @ApiProperty({ example: 'joao@maginf.com.br' })
  @IsEmail({}, { message: 'E-mail inválido' })
  email: string;

  @ApiProperty({ example: 'MinhaS3nha!' })
  @IsString()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  senha: string;

  @ApiProperty({ example: 'uuid-do-tenant' })
  @IsUUID()
  tenantId: string;

  @ApiProperty({ enum: TechnicianRole, default: TechnicianRole.TECNICO })
  @IsEnum(TechnicianRole)
  @IsOptional()
  funcao?: TechnicianRole;
}
