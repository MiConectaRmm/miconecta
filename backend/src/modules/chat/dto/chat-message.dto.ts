import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, MaxLength, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChatMessageTipo } from '../../../database/entities/chat-message.entity';

export class SendMessageDto {
  @ApiProperty({ example: 'Boa tarde, preciso de ajuda com meu computador.' })
  @IsNotEmpty()
  @IsString()
  conteudo: string;

  @ApiPropertyOptional({ enum: ChatMessageTipo })
  @IsOptional()
  @IsEnum(ChatMessageTipo)
  tipo?: ChatMessageTipo;

  @ApiPropertyOptional({ description: 'URL do arquivo (após upload via storage)' })
  @IsOptional()
  @IsString()
  arquivoUrl?: string;

  @ApiPropertyOptional({ description: 'Nome original do arquivo' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  arquivoNome?: string;

  @ApiPropertyOptional({ description: 'Tamanho do arquivo em bytes' })
  @IsOptional()
  @IsNumber()
  arquivoTamanho?: number;
}

export class WsSendMessageDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ticketId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  conteudo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  remetenteId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  remetenteNome: string;

  @ApiProperty({ example: 'technician' })
  @IsNotEmpty()
  @IsString()
  remetenteTipo: string;
}

export class WsSendFileDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  ticketId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  remetenteId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  remetenteNome: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  remetenteTipo: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  arquivoUrl: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  arquivoNome: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumber()
  arquivoTamanho: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conteudo?: string;
}
