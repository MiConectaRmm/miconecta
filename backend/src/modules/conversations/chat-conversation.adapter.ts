import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { ChatService } from '../chat/chat.service';
import { ConversationsService } from './conversations.service';
import { Ticket } from '../../database/entities/ticket.entity';
import { Conversation, ConversationType } from '../../database/entities/conversation.entity';
import { ChatMessage, ChatRemetenteTipo, ChatMessageTipo } from '../../database/entities/chat-message.entity';
import { ConversationMessage, ConversationMessageType } from '../../database/entities/conversation-message.entity';
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
    @Inject(forwardRef(() => ChatService))
    private readonly chatService: ChatService,
    @Inject(forwardRef(() => ConversationsService))
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

      const type = dados.arquivoUrl
        ? ConversationMessageType.FILE
        : ConversationMessageType.TEXT;

      return await this.conversationsService.enviarMensagem(
        {
          conversationId: ticket.conversationId,
          senderUserId: dados.senderUserId,
          senderDeviceId: dados.senderDeviceId,
          senderName: dados.senderName,
          senderType: dados.senderType,
          content: dados.content,
          type,
          arquivoUrl: dados.arquivoUrl,
          arquivoNome: dados.arquivoNome,
          arquivoTamanho: dados.arquivoTamanho,
        },
        { skipReplicationToLegacy: true },
      );
    } catch (err) {
      this.logger.warn(`Falha ao replicar msg legada para conversation (ticket=${ticketId}): ${err}`);
      return null;
    }
  }

  /** Chamado após salvar ChatMessage no fluxo legado (REST/WS ticket). */
  async replicarMensagemLegadaParaConversation(msg: ChatMessage): Promise<ConversationMessage | null> {
    try {
      const ticket = await this.ticketRepo.findOne({ where: { id: msg.ticketId } });
      if (!ticket?.conversationId) return null;

      const senderType = this.mapRemetenteTipoToSenderType(msg.remetenteTipo);
      const senderUserId =
        msg.remetenteTipo === ChatRemetenteTipo.TECHNICIAN || msg.remetenteTipo === ChatRemetenteTipo.CLIENT_USER
          ? msg.remetenteId
          : undefined;
      const senderDeviceId = msg.remetenteTipo === ChatRemetenteTipo.AGENT ? msg.remetenteId : msg.deviceId;

      let type = ConversationMessageType.TEXT;
      if (msg.tipo === ChatMessageTipo.SISTEMA) type = ConversationMessageType.SYSTEM;
      else if (msg.tipo === ChatMessageTipo.ARQUIVO || msg.tipo === ChatMessageTipo.IMAGEM || msg.arquivoUrl)
        type = ConversationMessageType.FILE;

      return await this.conversationsService.enviarMensagem(
        {
          conversationId: ticket.conversationId,
          senderUserId,
          senderDeviceId,
          senderName: msg.remetenteNome,
          senderType,
          content: msg.conteudo,
          type,
          arquivoUrl: msg.arquivoUrl,
          arquivoNome: msg.arquivoNome,
          arquivoTamanho: msg.arquivoTamanho,
        },
        { skipReplicationToLegacy: true },
      );
    } catch (err) {
      this.logger.warn(`Falha ao replicar ChatMessage ${msg.id} para conversation: ${err}`);
      return null;
    }
  }

  // ── Conversation → Legacy ──

  /**
   * Após enviar uma ConversationMessage, replicar como ChatMessage no ticket linkado.
   * Chamar quando a conversation tem um ticket vinculado.
   */
  /** Replica uma ConversationMessage já persistida para o ticket vinculado (se existir). */
  async replicarMensagemConversationParaLegado(msg: ConversationMessage) {
    const rt = this.mapSenderTypeToRemetenteTipo(msg.senderType);
    const remetenteId = rt === ChatRemetenteTipo.AGENT ? msg.senderDeviceId : msg.senderUserId;
    let tipo: ChatMessageTipo = ChatMessageTipo.TEXTO;
    if (msg.type === ConversationMessageType.SYSTEM) tipo = ChatMessageTipo.SISTEMA;
    else if (msg.type === ConversationMessageType.FILE) tipo = ChatMessageTipo.ARQUIVO;

    return this.replicarParaChatLegado(msg.conversationId, {
      remetenteNome: msg.senderName,
      remetenteTipo: rt,
      remetenteId,
      conteudo: msg.content,
      deviceId: msg.senderDeviceId,
      arquivoUrl: msg.arquivoUrl,
      arquivoNome: msg.arquivoNome,
      arquivoTamanho: msg.arquivoTamanho,
      tipo,
    });
  }

  async replicarParaChatLegado(conversationId: string, dados: {
    remetenteNome: string;
    remetenteTipo: ChatRemetenteTipo;
    remetenteId?: string;
    conteudo: string;
    deviceId?: string;
    arquivoUrl?: string;
    arquivoNome?: string;
    arquivoTamanho?: number;
    tipo?: ChatMessageTipo;
  }) {
    try {
      const ticket = await this.ticketRepo.findOne({ where: { conversationId } });
      if (!ticket) return null;

      const tipo =
        dados.tipo ||
        (dados.remetenteTipo === ChatRemetenteTipo.SYSTEM ? ChatMessageTipo.SISTEMA : ChatMessageTipo.TEXTO);

      return await this.chatService.enviarMensagem(
        {
          ticketId: ticket.id,
          deviceId: dados.deviceId,
          remetenteTipo: dados.remetenteTipo,
          remetenteId: dados.remetenteId,
          remetenteNome: dados.remetenteNome,
          tipo,
          conteudo: dados.conteudo,
          arquivoUrl: dados.arquivoUrl,
          arquivoNome: dados.arquivoNome,
          arquivoTamanho: dados.arquivoTamanho,
        },
        { skipConversationReplication: true },
      );
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
      [ChatRemetenteTipo.AGENT]: 'device',
      [ChatRemetenteTipo.SYSTEM]: 'system',
    };
    return map[tipo] || 'unknown';
  }

  mapSenderTypeToRemetenteTipo(senderType: string): ChatRemetenteTipo {
    const map: Record<string, ChatRemetenteTipo> = {
      technician: ChatRemetenteTipo.TECHNICIAN,
      client: ChatRemetenteTipo.CLIENT_USER,
      client_user: ChatRemetenteTipo.CLIENT_USER,
      device: ChatRemetenteTipo.AGENT,
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
        const r = await this.replicarMensagemLegadaParaConversation(msg);
        if (r) copiadas++;
      } catch (err) {
        this.logger.warn(`Falha ao copiar msg ${msg.id}: ${err}`);
      }
    }

    this.logger.log(`Copiadas ${copiadas}/${legacyMessages.length} mensagens do ticket ${ticketId} para conversation ${ticket.conversationId}`);
    return copiadas;
  }
}
