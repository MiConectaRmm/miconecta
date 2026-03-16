import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketPrioridade, TicketOrigem } from '../../../database/entities/ticket.entity';

export class CreateTicketDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  titulo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  descricao: string;

  @ApiPropertyOptional({ enum: TicketPrioridade })
  @IsOptional()
  @IsEnum(TicketPrioridade)
  prioridade?: TicketPrioridade;

  @ApiPropertyOptional({ enum: TicketOrigem })
  @IsOptional()
  @IsEnum(TicketOrigem)
  origem?: TicketOrigem;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  deviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoriaId?: string;
}
