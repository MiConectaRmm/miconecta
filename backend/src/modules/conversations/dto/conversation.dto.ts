import { IsNotEmpty, IsString, IsOptional, IsEnum, IsNumber, MaxLength, IsUUID, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ConversationType } from '../../../database/entities/conversation.entity';
import { ConversationMessageType } from '../../../database/entities/conversation-message.entity';

export class CreateConversationDto {
  @ApiPropertyOptional({ enum: ConversationType })
  @IsOptional()
  @IsEnum(ConversationType)
  type?: ConversationType;

  @ApiPropertyOptional({ description: 'Título da conversa' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  titulo?: string;

  @ApiPropertyOptional({ description: 'ID do dispositivo associado' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({ description: 'Mensagem inicial (opcional)' })
  @IsOptional()
  @IsString()
  mensagemInicial?: string;
}

export class SendConversationMessageDto {
  @ApiProperty({ example: 'Olá, preciso de ajuda.' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ConversationMessageType })
  @IsOptional()
  @IsEnum(ConversationMessageType)
  type?: ConversationMessageType;

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
