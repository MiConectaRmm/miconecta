import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Tipos de evento na timeline unificada.
 * Cada tipo mapeia para uma fonte de dados diferente.
 */
export enum TimelineEventType {
  // ── Ticket lifecycle ──
  TICKET_CRIADO = 'ticket_criado',
  TICKET_ATRIBUIDO = 'ticket_atribuido',
  TICKET_STATUS_ALTERADO = 'ticket_status_alterado',
  TICKET_PRIORIDADE_ALTERADA = 'ticket_prioridade_alterada',
  TICKET_AVALIADO = 'ticket_avaliado',
  TICKET_SLA_BREACH = 'ticket_sla_breach',

  // ── Chat ──
  CHAT_MENSAGEM = 'chat_mensagem',
  CHAT_ARQUIVO = 'chat_arquivo',
  CHAT_IMAGEM = 'chat_imagem',
  CHAT_SISTEMA = 'chat_sistema',

  // ── Notas ──
  NOTA_INTERNA = 'nota_interna',
  COMENTARIO = 'comentario',

  // ── Sessão remota ──
  SESSAO_SOLICITADA = 'sessao_solicitada',
  SESSAO_CONSENTIDA = 'sessao_consentida',
  SESSAO_RECUSADA = 'sessao_recusada',
  SESSAO_INICIADA = 'sessao_iniciada',
  SESSAO_FINALIZADA = 'sessao_finalizada',

  // ── Scripts / Automação ──
  SCRIPT_EXECUTADO = 'script_executado',
  SCRIPT_RESULTADO = 'script_resultado',

  // ── Dispositivo ──
  DEVICE_VINCULADO = 'device_vinculado',
  DEVICE_ALERTA = 'device_alerta',

  // ── Anexos ──
  ANEXO_ADICIONADO = 'anexo_adicionado',

  // ── Sistema ──
  SISTEMA = 'sistema',
}

/**
 * Evento unificado da timeline.
 * Estrutura normalizada que agrega dados de TicketComment, ChatMessage,
 * RemoteSession e AuditLog em uma única linha do tempo cronológica.
 */
export class TimelineEventDto {
  @ApiProperty({ description: 'ID do evento original' })
  id: string;

  @ApiProperty({ description: 'ID do ticket pai' })
  ticketId: string;

  @ApiProperty({ enum: TimelineEventType, description: 'Tipo do evento' })
  tipo: TimelineEventType;

  @ApiProperty({ description: 'Fonte de dados: comment | chat | session | audit | system' })
  fonte: 'comment' | 'chat' | 'session' | 'audit' | 'system';

  @ApiProperty({ description: 'Timestamp do evento' })
  timestamp: Date;

  @ApiPropertyOptional({ description: 'Tipo do autor: technician | client_user | agent | system' })
  autorTipo?: string;

  @ApiPropertyOptional({ description: 'ID do autor' })
  autorId?: string;

  @ApiPropertyOptional({ description: 'Nome do autor' })
  autorNome?: string;

  @ApiProperty({ description: 'Conteúdo textual do evento' })
  conteudo: string;

  @ApiPropertyOptional({ description: 'Visível para o cliente?' })
  visivelCliente?: boolean;

  @ApiPropertyOptional({ description: 'Metadados extras do evento (JSON)' })
  metadata?: Record<string, any>;
}

/**
 * Resumo automático do atendimento.
 * Gerado ao fechar/resolver ticket.
 */
export class TicketResumoDto {
  @ApiProperty()
  ticketId: string;

  @ApiProperty()
  numero: number;

  @ApiProperty()
  titulo: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  prioridade: string;

  @ApiProperty({ description: 'Duração total em minutos' })
  duracaoMinutos: number;

  @ApiProperty({ description: 'Tempo até primeira resposta (minutos)' })
  tempoRespostaMinutos: number | null;

  @ApiProperty({ description: 'SLA resposta cumprido?' })
  slaRespostaCumprido: boolean | null;

  @ApiProperty({ description: 'SLA resolução cumprido?' })
  slaResolucaoCumprido: boolean | null;

  @ApiProperty()
  totalMensagensChat: number;

  @ApiProperty()
  totalNotasInternas: number;

  @ApiProperty()
  totalSessoesRemotas: number;

  @ApiProperty()
  totalScriptsExecutados: number;

  @ApiProperty()
  totalAnexos: number;

  @ApiPropertyOptional()
  avaliacaoNota: number | null;

  @ApiPropertyOptional()
  avaliacaoComentario: string | null;

  @ApiProperty()
  criadoPorNome: string;

  @ApiPropertyOptional()
  tecnicoAtribuidoNome: string | null;

  @ApiPropertyOptional()
  deviceHostname: string | null;

  @ApiProperty()
  criadoEm: Date;

  @ApiPropertyOptional()
  resolvidoEm: Date | null;

  @ApiPropertyOptional()
  fechadoEm: Date | null;

  @ApiProperty({ description: 'Resumo textual gerado automaticamente' })
  resumoTexto: string;

  @ApiProperty({ description: 'Participantes do atendimento' })
  participantes: { nome: string; tipo: string; mensagens: number }[];
}

/**
 * Audit event types específicos do módulo Chat+Tickets
 */
export enum TicketAuditEvent {
  TICKET_CREATED = 'ticket.created',
  TICKET_ASSIGNED = 'ticket.assigned',
  TICKET_STATUS_CHANGED = 'ticket.status_changed',
  TICKET_PRIORITY_CHANGED = 'ticket.priority_changed',
  TICKET_RATED = 'ticket.rated',
  TICKET_CLOSED = 'ticket.closed',
  TICKET_REOPENED = 'ticket.reopened',
  TICKET_SLA_BREACHED = 'ticket.sla_breached',
  CHAT_MESSAGE_SENT = 'chat.message_sent',
  CHAT_FILE_UPLOADED = 'chat.file_uploaded',
  CHAT_MESSAGES_READ = 'chat.messages_read',
  NOTE_ADDED = 'ticket.note_added',
  SESSION_REQUESTED = 'session.requested',
  SESSION_CONSENTED = 'session.consented',
  SESSION_REFUSED = 'session.refused',
  SESSION_STARTED = 'session.started',
  SESSION_ENDED = 'session.ended',
  SCRIPT_EXECUTED = 'ticket.script_executed',
  ATTACHMENT_ADDED = 'ticket.attachment_added',
}
