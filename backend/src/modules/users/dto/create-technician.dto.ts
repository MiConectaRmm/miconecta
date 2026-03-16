import { IsNotEmpty, IsString, IsOptional, IsEmail, IsEnum, IsBoolean, IsArray, IsInt, MaxLength, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TechnicianRole } from '../../../database/entities/technician.entity';

export class CreateTechnicianDto {
  @ApiProperty({ example: 'João Silva' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  nome: string;

  @ApiProperty({ example: 'joao@maginf.com.br' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Senha@123' })
  @IsNotEmpty()
  @IsString()
  senha: string;

  @ApiProperty({ example: 'tecnico' })
  @IsNotEmpty()
  @IsEnum(TechnicianRole)
  funcao: TechnicianRole;

  @ApiProperty({ description: 'Tenant ID ao qual o técnico pertence' })
  @IsNotEmpty()
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({ example: '(11) 99999-0000' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @ApiPropertyOptional({ type: [String], example: ['windows', 'redes'] })
  @IsOptional()
  @IsArray()
  especialidades?: string[];

  @ApiPropertyOptional({ type: [String], description: 'IDs de tenants que o técnico pode acessar' })
  @IsOptional()
  @IsArray()
  tenantsAtribuidos?: string[];

  @ApiPropertyOptional({ example: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxTicketsSimultaneos?: number;
}

export class UpdateTechnicianDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'Nova senha (se informada, será hasheada)' })
  @IsOptional()
  @IsString()
  senha?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(TechnicianRole)
  funcao?: TechnicianRole;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  telefone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disponivel?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  especialidades?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  tenantsAtribuidos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  maxTicketsSimultaneos?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}
