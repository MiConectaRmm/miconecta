import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not } from 'typeorm';
import { ChatService } from '../chat/chat.service';
import { ConversationsService } from './conversations.service';
import { Ticket } from '../../database/entities/ticket.entity';
import { Conversation, ConversationType } from '../../database/entities/conversation.entity';
import { ChatRemetenteTipo, ChatMessageTipo } from '../../database/entities/chat-message.entity';
import { ConversationMessageType } from '../../database/entities/conversation-message.entity';
import { ParticipantRole } from '../../database/entities/conversation-participant.entity';

/**
 * Adapter bidirecional entre o Chat legado (ticket-based) e o sistema de Conversations.
 *
 * - Quando uma mensagem legada é enviada em um ticket com conversationId,
 *   ela é replicada para a conversation.
 * - Quando uma mensagem de conversation é enviada em uma conversation linkada a um ticket,
 *   ela é replicada como ChatMessage no ticket.
 * - Utilitário de migração para criar conversations em tickets existentes.
 */
@Injectable()
export class ChatConversationAdapter {
  private readonly logger = new Logger(ChatConversationAdapter.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly conversationsService: ConversationsService,
    @InjectRepository(Ticket)
    private readonly ticketRepo: Repository<Ticket>,
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
  ) {}

  // ── Legacy → Conversation ──

  /**
   * Após enviar uma ChatMessage legada, replicar na conversation do ticket.
   * Chamar após chatService.enviarMensagem() quando o ticket tem conversationId.
   */
  async replicarParaConversation(ticketId: string, dados: {
    senderName: string;
    senderType: string;
    senderUserId?: string;
    senderDeviceId?: string;
    content: string;
    arquivoUrl?: string;
    arquivoNome?: string;
    arquivoTamanho?: number;
  }) {
    try {
      const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
      if (!ticket?.conversationId) return null;

      return await this.conversationsService.enviarMensagem({
        conversationId: ticket.conversationId,
        senderUserId: dados.senderUserId,
        senderDeviceId: dados.senderDeviceId,
        senderName: dados.senderName,
        senderType: dados.senderType,
        content: dados.content,
        type: ConversationMessageType.TEXT,
        arquivoUrl: dados.arquivoUrl,
        arquivoNome: dados.arquivoNome,
        arquivoTamanho: dados.arquivoTamanho,
      });
    } catch (err) {
      this.logger.warn(`Falha ao replicar msg legada para conversation (ticket=${ticketId}): ${err}`);
      return null;
    }
  }

  // ── Conversation → Legacy ──

  /**
   * Após enviar uma ConversationMessage, replicar como ChatMessage no ticket linkado.
   * Chamar quando a conversation tem um ticket vinculado.
   */
  async replicarParaChatLegado(conversationId: string, dados: {
    remetenteNome: string;
    remetenteTipo: ChatRemetenteTipo;
    remetenteId?: string;
    conteudo: string;
    deviceId?: string;
    arquivoUrl?: string;
    arquivoNome?: string;
    arquivoTamanho?: number;
  }) {
    try {
      // Buscar ticket vinculado
      const ticket = await this.ticketRepo.findOne({ where: { conversationId } });
      if (!ticket) return null;

      return await this.chatService.enviarMensagem({
        ticketId: ticket.id,
        deviceId: dados.deviceId,
        remetenteTipo: dados.remetenteTipo,
        remetenteId: dados.remetenteId,
        remetenteNome: dados.remetenteNome,
        conteudo: dados.conteudo,
        arquivoUrl: dados.arquivoUrl,
        arquivoNome: dados.arquivoNome,
        arquivoTamanho: dados.arquivoTamanho,
      });
    } catch (err) {
      this.logger.warn(`Falha ao replicar msg conversation para chat legado (conv=${conversationId}): ${err}`);
      return null;
    }
  }

  // ── Mappers ──

  mapRemetenteTipoToSenderType(tipo: ChatRemetenteTipo): string {
    const map: Record<string, string> = {
      [ChatRemetenteTipo.TECHNICIAN]: 'technician',
      [ChatRemetenteTipo.CLIENT_USER]: 'client',
      [ChatRemetenteTipo.SYSTEM]: 'system',
    };
    return map[tipo] || 'unknown';
  }

  mapSenderTypeToRemetenteTipo(senderType: string): ChatRemetenteTipo {
    const map: Record<string, ChatRemetenteTipo> = {
      technician: ChatRemetenteTipo.TECHNICIAN,
      client: ChatRemetenteTipo.CLIENT_USER,
      device: ChatRemetenteTipo.CLIENT_USER,
      system: ChatRemetenteTipo.SYSTEM,
    };
    return map[senderType] || ChatRemetenteTipo.SYSTEM;
  }

  // ── Migração ──

  /**
   * Criar conversations para tickets existentes que ainda não têm conversationId.
   * Útil para migração gradual do sistema legado.
   */
  async migrarTicketsSemConversation(tenantId: string, limit: number = 50): Promise<number> {
    const tickets = await this.ticketRepo.find({
      where: {
        tenantId,
        conversationId: IsNull(),
      },
      order: { criadoEm: 'DESC' },
      take: limit,
    });

    let migrados = 0;
    for (const ticket of tickets) {
      try {
        const conversation = await this.conversationsService.criar({
          tenantId: ticket.tenantId,
          type: ConversationType.SUPPORT,
          titulo: ticket.titulo || 'Sem título',
          deviceId: ticket.deviceId,
        });

        await this.ticketRepo.update(ticket.id, { conversationId: conversation.id });

        // Adicionar criador como participante
        if (ticket.criadoPorId) {
          const role = ticket.criadoPorTipo === 'client_user' || ticket.criadoPorTipo === 'device'
            ? ParticipantRole.CLIENT
            : ParticipantRole.TECHNICIAN;
          await this.conversationsService.adicionarParticipante({
            conversationId: conversation.id,
            userId: ticket.criadoPorTipo !== 'device' ? ticket.criadoPorId : undefined,
            deviceId: ticket.criadoPorTipo === 'device' ? ticket.criadoPorId : undefined,
            participantName: ticket.criadoPorNome || 'Desconhecido',
            role,
          });
        }

        // Mensagem de sistema
        await this.conversationsService.enviarMensagemSistema(
          conversation.id,
          `Conversa criada a partir do ticket #${ticket.numero} - ${ticket.titulo}`,
        );

        migrados++;
        this.logger.log(`Migrado ticket ${ticket.id} (#{${ticket.numero}}) → conversation ${conversation.id}`);
      } catch (err) {
        this.logger.warn(`Falha ao migrar ticket ${ticket.id}: ${err}`);
      }
    }

    this.logger.log(`Migração concluída: ${migrados}/${tickets.length} tickets migrados para tenant ${tenantId}`);
    return migrados;
  }

  /**
   * Copiar mensagens legadas de um ticket para sua conversation (batch).
   * Apenas para tickets que JÁ têm conversationId.
   */
  async copiarMensagensLegadas(ticketId: string): Promise<number> {
    const ticket = await this.ticketRepo.findOne({ where: { id: ticketId } });
    if (!ticket?.conversationId) return 0;

    const legacyMessages = await this.chatService.listarMensagens(ticketId, 500, 0);

    // Verificar se já tem mensagens na conversation (evitar duplicar)
    const existingCount = (await this.conversationsService.listarMensagens(ticket.conversationId, 1, 0)).length;
    if (existingCount > 1) {
      this.logger.log(`Conversation ${ticket.conversationId} já tem mensagens, pulando cópia`);
      return 0;
    }

    let copiadas = 0;
    for (const msg of legacyMessages) {
      try {
        await this.conversationsService.enviarMensagem({
          conversationId: ticket.conversationId,
          senderUserId: msg.remetenteId,
          senderName: msg.remetenteNome,
          senderType: this.mapRemetenteTipoToSenderType(msg.remetenteTipo),
          content: msg.conteudo,
          type: msg.tipo === ChatMessageTipo.SISTEMA ? ConversationMessageType.SYSTEM : ConversationMessageType.TEXT,
          arquivoUrl: msg.arquivoUrl,
          arquivoNome: msg.arquivoNome,
          arquivoTamanho: msg.arquivoTamanho,
        });
        copiadas++;
      } catch (err) {
        this.logger.warn(`Falha ao copiar msg ${msg.id}: ${err}`);
      }
    }

    this.logger.log(`Copiadas ${copiadas}/${legacyMessages.length} mensagens do ticket ${ticketId} para conversation ${ticket.conversationId}`);
    return copiadas;
  }
}
