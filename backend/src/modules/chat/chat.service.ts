import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatMessage, ChatMessageTipo, ChatRemetenteTipo } from '../../database/entities/chat-message.entity';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(ChatMessage)
    private readonly messageRepo: Repository<ChatMessage>,
  ) {}

  async enviarMensagem(dados: {
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
  }) {
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

    return this.messageRepo.save(message);
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
    return this.enviarMensagem({
      ticketId,
      remetenteTipo: ChatRemetenteTipo.SYSTEM,
      remetenteNome: 'Sistema',
      tipo: ChatMessageTipo.SISTEMA,
      conteudo,
    });
  }

  async contarNaoLidas(ticketId: string, userId: string) {
    return this.messageRepo.count({
      where: {
        ticketId,
        lido: false,
      },
    });
  }
}
