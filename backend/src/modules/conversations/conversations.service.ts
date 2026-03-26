import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, ConversationStatus, ConversationType } from '../../database/entities/conversation.entity';
import { ConversationParticipant, ParticipantRole } from '../../database/entities/conversation-participant.entity';
import { ConversationMessage, ConversationMessageType } from '../../database/entities/conversation-message.entity';

@Injectable()
export class ConversationsService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepo: Repository<ConversationMessage>,
  ) {}

  async criar(dados: {
    tenantId: string;
    type?: ConversationType;
    titulo?: string;
    deviceId?: string;
    metadata?: Record<string, any>;
  }): Promise<Conversation> {
    const conversation = this.conversationRepo.create({
      tenantId: dados.tenantId,
      type: dados.type || ConversationType.SUPPORT,
      titulo: dados.titulo,
      deviceId: dados.deviceId,
      metadata: dados.metadata,
    });
    return this.conversationRepo.save(conversation);
  }

  async buscar(id: string, tenantId: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id, tenantId },
      relations: ['participants'],
    });
    if (!conversation) throw new NotFoundException('Conversa não encontrada');
    return conversation;
  }

  async listar(tenantId: string, filtros?: { status?: ConversationStatus; type?: ConversationType; userId?: string }) {
    const query = this.conversationRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.participants', 'p')
      .where('c.tenantId = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('c.status = :status', { status: filtros.status });
    }
    if (filtros?.type) {
      query.andWhere('c.type = :type', { type: filtros.type });
    }
    if (filtros?.userId) {
      query.andWhere('EXISTS (SELECT 1 FROM conversation_participants cp WHERE cp.conversation_id = c.id AND cp.user_id = :userId)', { userId: filtros.userId });
    }

    return query.orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST').take(100).getMany();
  }

  async listarPorParticipante(userId: string, tenantId: string) {
    return this.conversationRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.participants', 'p')
      .innerJoin('conversation_participants', 'me', 'me.conversation_id = c.id AND me.user_id = :userId', { userId })
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.status != :archived', { archived: ConversationStatus.ARCHIVED })
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .take(100)
      .getMany();
  }

  async listarPorDevice(deviceId: string, tenantId: string) {
    return this.conversationRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.participants', 'p')
      .innerJoin('conversation_participants', 'dp', 'dp.conversation_id = c.id AND dp.device_id = :deviceId', { deviceId })
      .where('c.tenantId = :tenantId', { tenantId })
      .andWhere('c.status != :archived', { archived: ConversationStatus.ARCHIVED })
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .take(100)
      .getMany();
  }

  // ── Participantes ──

  async adicionarParticipante(dados: {
    conversationId: string;
    userId?: string;
    deviceId?: string;
    participantName: string;
    role: ParticipantRole;
  }): Promise<ConversationParticipant> {
    // Verificar se já participa
    const existing = await this.participantRepo.findOne({
      where: {
        conversationId: dados.conversationId,
        ...(dados.userId ? { userId: dados.userId } : {}),
        ...(dados.deviceId ? { deviceId: dados.deviceId } : {}),
      },
    });
    if (existing) return existing;

    const participant = this.participantRepo.create({
      conversationId: dados.conversationId,
      userId: dados.userId,
      deviceId: dados.deviceId,
      participantName: dados.participantName,
      role: dados.role,
    });
    return this.participantRepo.save(participant);
  }

  async listarParticipantes(conversationId: string) {
    return this.participantRepo.find({ where: { conversationId } });
  }

  // ── Mensagens ──

  async enviarMensagem(dados: {
    conversationId: string;
    senderUserId?: string;
    senderDeviceId?: string;
    senderName: string;
    senderType: string;
    content: string;
    type?: ConversationMessageType;
    arquivoUrl?: string;
    arquivoNome?: string;
    arquivoTamanho?: number;
    metadata?: Record<string, any>;
  }): Promise<ConversationMessage> {
    const message = this.messageRepo.create({
      conversationId: dados.conversationId,
      senderUserId: dados.senderUserId,
      senderDeviceId: dados.senderDeviceId,
      senderName: dados.senderName,
      senderType: dados.senderType,
      content: dados.content,
      type: dados.type || ConversationMessageType.TEXT,
      arquivoUrl: dados.arquivoUrl,
      arquivoNome: dados.arquivoNome,
      arquivoTamanho: dados.arquivoTamanho,
      metadata: dados.metadata,
    });

    const saved = await this.messageRepo.save(message);

    // Atualizar lastMessageAt e preview na conversation
    await this.conversationRepo.update(dados.conversationId, {
      lastMessageAt: new Date(),
      lastMessagePreview: dados.content.substring(0, 200),
    });

    return saved;
  }

  async enviarMensagemSistema(conversationId: string, content: string): Promise<ConversationMessage> {
    return this.enviarMensagem({
      conversationId,
      senderName: 'Sistema',
      senderType: 'system',
      content,
      type: ConversationMessageType.SYSTEM,
    });
  }

  async listarMensagens(conversationId: string, limit: number = 100, offset: number = 0) {
    return this.messageRepo.find({
      where: { conversationId },
      order: { criadoEm: 'ASC' },
      take: limit,
      skip: offset,
    });
  }

  async marcarComoLida(conversationId: string, userId: string) {
    await this.participantRepo
      .createQueryBuilder()
      .update(ConversationParticipant)
      .set({ lastReadAt: new Date() })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('userId = :userId', { userId })
      .execute();
  }

  async contarNaoLidas(conversationId: string, userId: string): Promise<number> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, userId },
    });
    if (!participant || !participant.lastReadAt) {
      // Nunca leu — contar todas que não são dele
      const count = await this.messageRepo
        .createQueryBuilder('m')
        .where('m.conversationId = :conversationId', { conversationId })
        .andWhere('(m.senderUserId IS NULL OR m.senderUserId != :userId)', { userId })
        .getCount();
      return count;
    }

    return this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.criadoEm > :lastRead', { lastRead: participant.lastReadAt })
      .andWhere('(m.senderUserId IS NULL OR m.senderUserId != :userId)', { userId })
      .getCount();
  }

  // ── Status ──

  async fechar(id: string, tenantId: string) {
    const conversation = await this.buscar(id, tenantId);
    conversation.status = ConversationStatus.CLOSED;
    return this.conversationRepo.save(conversation);
  }

  async reabrir(id: string, tenantId: string) {
    const conversation = await this.buscar(id, tenantId);
    conversation.status = ConversationStatus.OPEN;
    return this.conversationRepo.save(conversation);
  }

  async arquivar(id: string, tenantId: string) {
    const conversation = await this.buscar(id, tenantId);
    conversation.status = ConversationStatus.ARCHIVED;
    return this.conversationRepo.save(conversation);
  }
}
