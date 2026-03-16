import { IsNotEmpty, IsString, IsOptional, IsNumber, IsArray, ValidateNested, MaxLength, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class AgentRegisterDto {
  @ApiProperty({ example: 'PC-FINANCEIRO' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  hostname: string;

  @ApiPropertyOptional({ example: 'Windows 11 Pro' })
  @IsOptional()
  @IsString()
  sistemaOperacional?: string;

  @ApiPropertyOptional({ example: '23H2' })
  @IsOptional()
  @IsString()
  versaoWindows?: string;

  @ApiPropertyOptional({ example: 'Intel Core i7-12700' })
  @IsOptional()
  @IsString()
  cpu?: string;

  @ApiPropertyOptional({ example: 16384 })
  @IsOptional()
  @IsNumber()
  ramTotalMb?: number;

  @ApiPropertyOptional({ example: 512000 })
  @IsOptional()
  @IsNumber()
  discoTotalMb?: number;

  @ApiPropertyOptional({ example: 256000 })
  @IsOptional()
  @IsNumber()
  discoDisponivelMb?: number;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  @IsOptional()
  @IsString()
  ipLocal?: string;

  @ApiPropertyOptional({ example: '201.10.20.30' })
  @IsOptional()
  @IsString()
  ipExterno?: string;

  @ApiPropertyOptional({ example: 'Dell Latitude 5530' })
  @IsOptional()
  @IsString()
  modeloMaquina?: string;

  @ApiPropertyOptional({ example: 'SN123456789' })
  @IsOptional()
  @IsString()
  numeroSerie?: string;

  @ApiPropertyOptional({ example: '2.1.0' })
  @IsOptional()
  @IsString()
  agentVersion?: string;

  @ApiPropertyOptional({ example: '123456789' })
  @IsOptional()
  @IsString()
  rustdeskId?: string;

  @ApiPropertyOptional({ example: 'Windows Defender' })
  @IsOptional()
  @IsString()
  antivirusNome?: string;

  @ApiPropertyOptional({ example: 'Atualizado' })
  @IsOptional()
  @IsString()
  antivirusStatus?: string;
}

export class AgentHeartbeatDto {
  @ApiProperty({ description: 'ID do dispositivo' })
  @IsNotEmpty()
  @IsString()
  deviceId: string;

  @ApiPropertyOptional({ example: 45.2 })
  @IsOptional()
  @IsNumber()
  cpuPercent?: number;

  @ApiPropertyOptional({ example: 72.5 })
  @IsOptional()
  @IsNumber()
  ramPercent?: number;

  @ApiPropertyOptional({ example: 11776 })
  @IsOptional()
  @IsNumber()
  ramUsadaMb?: number;

  @ApiPropertyOptional({ example: 68.3 })
  @IsOptional()
  @IsNumber()
  discoPercent?: number;

  @ApiPropertyOptional({ example: 350000 })
  @IsOptional()
  @IsNumber()
  discoUsadoMb?: number;

  @ApiPropertyOptional({ example: 55 })
  @IsOptional()
  @IsNumber()
  temperatura?: number;

  @ApiPropertyOptional({ example: 86400 })
  @IsOptional()
  @IsNumber()
  uptimeSegundos?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  redeEntradaBytes?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  redeSaidaBytes?: number;

  @ApiPropertyOptional({ example: 'Windows Defender' })
  @IsOptional()
  @IsString()
  antivirusNome?: string;

  @ApiPropertyOptional({ example: 'Atualizado' })
  @IsOptional()
  @IsString()
  antivirusStatus?: string;

  @ApiPropertyOptional({ example: 256000 })
  @IsOptional()
  @IsNumber()
  discoDisponivelMb?: number;
}

export class InventoryItemDto {
  @ApiProperty({ example: 'Google Chrome' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  nome: string;

  @ApiPropertyOptional({ example: '120.0.6099.130' })
  @IsOptional()
  @IsString()
  versao?: string;

  @ApiPropertyOptional({ example: 'Google LLC' })
  @IsOptional()
  @IsString()
  fabricante?: string;

  @ApiPropertyOptional({ example: '250 MB' })
  @IsOptional()
  @IsString()
  tamanho?: string;

  @ApiPropertyOptional()
  @IsOptional()
  dataInstalacao?: string;

  @ApiPropertyOptional({ example: 'software', enum: ['software', 'hardware', 'driver', 'update'] })
  @IsOptional()
  @IsString()
  tipo?: string;
}

export class AgentInventoryDto {
  @ApiProperty({ type: [InventoryItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InventoryItemDto)
  itens: InventoryItemDto[];
}
