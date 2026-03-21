import { IsNotEmpty, IsString, IsOptional, IsEnum, IsArray, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeviceStatus } from '../../../database/entities/device.entity';

export class UpdateDeviceDto {
  @ApiPropertyOptional({ example: 'PC-FINANCEIRO' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  hostname?: string;

  @ApiPropertyOptional({ example: 'maginf.local' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  dominio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  rustdeskId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipLocal?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(45)
  ipExterno?: string;

  @ApiPropertyOptional({ enum: DeviceStatus })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ type: [String], example: ['servidor', 'financeiro'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notas?: string;
}

export class DeviceFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar por tenant (super_admin)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional({ enum: DeviceStatus })
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Busca por hostname ou IP' })
  @IsOptional()
  @IsString()
  busca?: string;
}
