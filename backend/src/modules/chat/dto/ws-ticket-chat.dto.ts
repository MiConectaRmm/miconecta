import { IsBoolean, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class WsJoinTicketDto {
  @ApiProperty()
  @IsUUID()
  ticketId: string;
}

export class WsSendMessagePayloadDto {
  @ApiProperty()
  @IsUUID()
  ticketId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  @MaxLength(20000)
  content: string;
}

export class WsTypingPayloadDto {
  @ApiProperty()
  @IsUUID()
  ticketId: string;

  @ApiProperty()
  @IsBoolean()
  isTyping: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nome?: string;
}

export class WsReadMessagePayloadDto {
  @ApiProperty()
  @IsUUID()
  ticketId: string;

  @ApiProperty()
  @IsUUID()
  messageId: string;
}
