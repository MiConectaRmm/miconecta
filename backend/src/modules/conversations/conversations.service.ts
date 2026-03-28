import { Injectable, NotFoundException, ForbiddenException, Logger, Inject, forwardRef } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not } from 'typeorm';
import { ChatConversationAdapter } from './chat-conversation.adapter';
import { Conversation, ConversationStatus, ConversationType } from '../../database/entities/conversation.entity';
import { ConversationParticipant, ParticipantRole } from '../../database/entities/conversation-participant.entity';
import { ConversationMessage, ConversationMessageType } from '../../database/entities/conversation-message.entity';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationParticipant)
    private readonly participantRepo: Repository<ConversationParticipant>,
    @InjectRepository(ConversationMessage)
    private readonly messageRepo: Repository<ConversationMessage>,
    @Inject(forwardRef(() => ChatConversationAdapter))
    private readonly chatConversationAdapter: ChatConversationAdapter,
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
      .leftJoinAndSelect('c.tenant', 'tenant')
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

  async listarPorTenant(tenantId: string) {
    return this.conversationRepo.find({
      where: { tenantId },
      relations: ['participants'],
      order: { lastMessageAt: { direction: 'DESC', nulls: 'LAST' } },
      take: 100,
    });
  }

  async listarPorParticipante(userId: string, tenantId: string) {
    return this.conversationRepo.createQueryBuilder('c')
      .leftJoinAndSelect('c.participants', 'p')
      .leftJoinAndSelect('c.tenant', 'tenant')
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

  async enviarMensagem(
    dados: {
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
    },
    opts?: { skipReplicationToLegacy?: boolean },
  ): Promise<ConversationMessage> {
    // Business rule: block messages on closed/archived conversations (except system)
    if (dados.senderType !== 'system') {
      const conv = await this.conversationRepo.findOne({ where: { id: dados.conversationId } });
      if (conv && conv.status === ConversationStatus.CLOSED) {
        throw new ForbiddenException('Conversa fechada. Reabra para enviar mensagens.');
      }
      if (conv && conv.status === ConversationStatus.ARCHIVED) {
        throw new ForbiddenException('Conversa arquivada. Não é possível enviar mensagens.');
      }
    }

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

    if (!opts?.skipReplicationToLegacy) {
      void this.chatConversationAdapter.replicarMensagemConversationParaLegado(saved).catch(() => {});
    }

    return saved;
  }

  async enviarMensagemSistema(conversationId: string, content: string): Promise<ConversationMessage> {
    return this.enviarMensagem(
      {
        conversationId,
        senderName: 'Sistema',
        senderType: 'system',
        content,
        type: ConversationMessageType.SYSTEM,
      },
      undefined,
    );
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

  async marcarComoLidaPorDevice(conversationId: string, deviceId: string) {
    await this.participantRepo.update(
      { conversationId, deviceId },
      { lastReadAt: new Date() },
    );
  }

  async contarNaoLidasPorDevice(conversationId: string, deviceId: string): Promise<number> {
    const participant = await this.participantRepo.findOne({
      where: { conversationId, deviceId },
    });
    if (!participant || !participant.lastReadAt) {
      return this.messageRepo
        .createQueryBuilder('m')
        .where('m.conversationId = :conversationId', { conversationId })
        .andWhere('(m.senderDeviceId IS NULL OR m.senderDeviceId != :deviceId)', { deviceId })
        .getCount();
    }

    return this.messageRepo
      .createQueryBuilder('m')
      .where('m.conversationId = :conversationId', { conversationId })
      .andWhere('m.criadoEm > :lastRead', { lastRead: participant.lastReadAt })
      .andWhere('(m.senderDeviceId IS NULL OR m.senderDeviceId != :deviceId)', { deviceId })
      .getCount();
  }

  /** Mensagens de conversa não lidas pelo dispositivo (outros remetentes), para o agente. */
  async listarMensagensNaoLidasDispositivo(deviceId: string, tenantId: string): Promise<ConversationMessage[]> {
    const convs = await this.listarPorDevice(deviceId, tenantId);
    const out: ConversationMessage[] = [];
    for (const c of convs) {
      const n = await this.contarNaoLidasPorDevice(c.id, deviceId);
      if (n === 0) continue;
      const recent = await this.messageRepo.find({
        where: { conversationId: c.id },
        order: { criadoEm: 'DESC' },
        take: 5,
      });
      const fromOthers = recent.filter((m) => m.senderDeviceId !== deviceId);
      if (fromOthers.length > 0) out.push(fromOthers[0]);
    }
    return out;
  }

  // ── Status ──

  async fechar(id: string, tenantId: string, autorNome?: string) {
    const conversation = await this.buscar(id, tenantId);
    if (conversation.status === ConversationStatus.CLOSED) return conversation;
    conversation.status = ConversationStatus.CLOSED;
    const saved = await this.conversationRepo.save(conversation);
    await this.enviarMensagemSistema(id, `Conversa fechada${autorNome ? ' por ' + autorNome : ''}`);
    return saved;
  }

  async reabrir(id: string, tenantId: string, autorNome?: string) {
    const conversation = await this.buscar(id, tenantId);
    if (conversation.status === ConversationStatus.OPEN) return conversation;
    conversation.status = ConversationStatus.OPEN;
    const saved = await this.conversationRepo.save(conversation);
    await this.enviarMensagemSistema(id, `Conversa reaberta${autorNome ? ' por ' + autorNome : ''}`);
    return saved;
  }

  async arquivar(id: string, tenantId: string) {
    const conversation = await this.buscar(id, tenantId);
    conversation.status = ConversationStatus.ARCHIVED;
    return this.conversationRepo.save(conversation);
  }

  // ── Cron: auto-close inactive conversations (no messages for 7 days) ──

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async autoCloseInactive() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const stale = await this.conversationRepo.find({
      where: {
        status: ConversationStatus.OPEN,
        lastMessageAt: LessThan(cutoff),
      },
      take: 100,
    });

    for (const conv of stale) {
      conv.status = ConversationStatus.CLOSED;
      await this.conversationRepo.save(conv);
      await this.enviarMensagemSistema(conv.id, 'Conversa fechada automaticamente por inatividade (7 dias)');
      this.logger.log(`Auto-closed conversation ${conv.id} (inactive since ${conv.lastMessageAt})`);
    }

    if (stale.length > 0) {
      this.logger.log(`Auto-closed ${stale.length} inactive conversations`);
    }
  }
}
