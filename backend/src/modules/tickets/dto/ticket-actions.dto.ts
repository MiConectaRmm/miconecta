import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsInt, Min, Max, MaxLength, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AtribuirTicketDto {
  @ApiProperty({ description: 'ID do técnico' })
  @IsNotEmpty()
  @IsUUID()
  technicianId: string;

  @ApiProperty({ description: 'Nome do técnico' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  technicianNome: string;
}

export class ComentarioDto {
  @ApiProperty({ example: 'Verificado o problema, reiniciando serviço...' })
  @IsNotEmpty()
  @IsString()
  conteudo: string;

  @ApiPropertyOptional({ description: 'Se false, será nota interna (não visível ao cliente)', default: true })
  @IsOptional()
  @IsBoolean()
  visivelCliente?: boolean;
}

export class NotaInternaDto {
  @ApiProperty({ example: 'Cliente possui contrato premium, priorizar.' })
  @IsNotEmpty()
  @IsString()
  conteudo: string;
}

export class AvaliarTicketDto {
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @IsNotEmpty()
  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;

  @ApiPropertyOptional({ example: 'Atendimento excelente!' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comentario?: string;
}

export class TicketFilterDto {
  @ApiPropertyOptional({ description: 'Filtrar por tenant (super_admin)' })
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  prioridade?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoriaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  atribuidoA?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ description: 'Limitar quantidade de resultados' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}
