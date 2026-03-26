import { Injectable, NotFoundException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatMessageTipo, ChatRemetenteTipo } from '../../database/entities/chat-message.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { ChatConversationAdapter } from '../conversations/chat-conversation.adapter';

export type EnviarChatMensagemOptions = {
  /** Evita loop quando a mensagem veio da replicação conversation → ticket */
  skipConversationReplication?: boolean;
};

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
    @Inject(forwardRef(() => ChatConversationAdapter))
    private readonly chatConversationAdapter: ChatConversationAdapter,
  ) {}

  async enviarMensagem(
    dados: {
      ticketId: string;
      deviceId?: string;
      remetenteTipo: ChatRemetenteTipo;
      remetenteId?: string;
      remetenteNome: string;
      tipo?: ChatMessageTipo;
      conteudo: string;
      arquivoUrl?: string;
      arquivoNome?: string;
      arquivoTamanho?: number;
    },
    options?: EnviarChatMensagemOptions,
  ) {
    const message = this.messageRepo.create({
      ticketId: dados.ticketId,
      deviceId: dados.deviceId,
      remetenteTipo: dados.remetenteTipo,
      remetenteId: dados.remetenteId,
      remetenteNome: dados.remetenteNome,
      tipo: dados.tipo || ChatMessageTipo.TEXTO,
      conteudo: dados.conteudo,
      arquivoUrl: dados.arquivoUrl,
      arquivoNome: dados.arquivoNome,
      arquivoTamanho: dados.arquivoTamanho,
    });

    const saved = await this.messageRepo.save(message);

    if (!options?.skipConversationReplication) {
      void this.chatConversationAdapter.replicarMensagemLegadaParaConversation(saved).catch(() => {});
    }

    return saved;
  }

  async listarMensagens(ticketId: string, limit: number = 100, offset: number = 0) {
    return this.messageRepo.find({
      where: { ticketId },
      order: { criadoEm: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async marcarComoLida(messageId: string) {
    await this.messageRepo.update(messageId, {
      lido: true,
      lidoEm: new Date(),
    });
    return this.messageRepo.findOne({ where: { id: messageId } });
  }

  async marcarTodasComoLidas(ticketId: string, userId: string) {
    await this.messageRepo
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ lido: true, lidoEm: new Date() })
      .where('ticketId = :ticketId', { ticketId })
      .andWhere('remetenteId != :userId', { userId })
      .andWhere('lido = false')
      .execute();
  }

  async enviarMensagemSistema(ticketId: string, conteudo: string) {
    return this.enviarMensagem(
      {
        ticketId,
        remetenteTipo: ChatRemetenteTipo.SYSTEM,
        remetenteNome: 'Sistema',
        tipo: ChatMessageTipo.SISTEMA,
        conteudo,
      },
      undefined,
    );
  }

  /** Mensagens não lidas (de técnico/sistema/cliente) nos tickets ligados ao dispositivo — para o agente. */
  async listarMensagensNaoLidasAgente(deviceId: string, tenantId: string): Promise<ChatMessage[]> {
    return this.messageRepo
      .createQueryBuilder('msg')
      .innerJoin(Ticket, 't', 't.id = msg.ticketId')
      .where('t.deviceId = :deviceId', { deviceId })
      .andWhere('t.tenantId = :tenantId', { tenantId })
      .andWhere('msg.lido = :lido', { lido: false })
      .andWhere('msg.remetenteTipo != :agent', { agent: ChatRemetenteTipo.AGENT })
      .orderBy('msg.criadoEm', 'DESC')
      .take(40)
      .getMany();
  }

  async contarNaoLidas(ticketId: string, userId: string) {
    const result = await this.messageRepo
      .createQueryBuilder('msg')
      .select('COUNT(*)', 'count')
      .where('msg.ticketId = :ticketId', { ticketId })
      .andWhere('msg.lido = false')
      .andWhere('(msg.remetenteId IS NULL OR msg.remetenteId != :userId)', { userId })
      .getRawOne<{ count: string }>();

    return Number(result?.count || 0);
  }
}
