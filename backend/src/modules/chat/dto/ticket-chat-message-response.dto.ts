import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Resposta canônica do chat do ticket (REST + WebSocket). */
export class TicketChatMessageResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  ticketId: string;

  @ApiPropertyOptional()
  deviceId?: string | null;

  @ApiProperty({ enum: ['TECH', 'CLIENT', 'AGENT', 'SYSTEM'] })
  senderType: 'TECH' | 'CLIENT' | 'AGENT' | 'SYSTEM' | string;

  @ApiPropertyOptional()
  senderId?: string | null;

  @ApiProperty()
  senderName: string;

  @ApiProperty({ enum: ['TEXT', 'FILE', 'SYSTEM'] })
  type: 'TEXT' | 'FILE' | 'SYSTEM';

  @ApiProperty()
  content: string;

  @ApiProperty({ enum: ['SENT', 'DELIVERED', 'READ'] })
  status: 'SENT' | 'DELIVERED' | 'READ';

  /** Estilo WhatsApp (minúsculas) para UI. */
  @ApiProperty({ enum: ['sent', 'delivered', 'read'] })
  deliveryStatus: 'sent' | 'delivered' | 'read';

  @ApiProperty()
  read: boolean;

  @ApiPropertyOptional()
  readAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiPropertyOptional()
  arquivoUrl?: string | null;

  @ApiPropertyOptional()
  arquivoNome?: string | null;

  @ApiPropertyOptional()
  arquivoTamanho?: number | null;

  // Compatibilidade com clientes legados (PT + enums internos)
  @ApiPropertyOptional()
  remetenteTipo?: string;

  @ApiPropertyOptional()
  remetenteId?: string | null;

  @ApiPropertyOptional()
  remetenteNome?: string;

  @ApiPropertyOptional()
  tipo?: string;

  @ApiPropertyOptional()
  conteudo?: string;

  @ApiPropertyOptional()
  lido?: boolean;

  @ApiPropertyOptional()
  lidoEm?: Date | null;

  @ApiPropertyOptional()
  criadoEm?: Date;
}
