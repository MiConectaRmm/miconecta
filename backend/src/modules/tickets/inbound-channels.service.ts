import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../../database/entities/tenant.entity';
import { TicketOrigem } from '../../database/entities/ticket.entity';
import { TicketsService } from './tickets.service';

export interface InboundTicketInput {
  tenantId?: string;
  tenantSlug?: string;
  fromName?: string;
  fromEmail?: string;
  subject: string;
  body: string;
  source: 'email' | 'whatsapp';
  externalId?: string;
}

@Injectable()
export class InboundChannelsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    private readonly ticketsService: TicketsService,
  ) {}

  async criarTicketInbound(input: InboundTicketInput) {
    const tenant = await this.resolveTenant(input);
    const subject = input.subject?.trim() || `Mensagem via ${input.source}`;
    const body = input.body?.trim() || input.subject?.trim() || 'Sem conteúdo';

    return this.ticketsService.criar(
      tenant.id,
      {
        titulo: subject,
        descricao: body,
        origem: input.source === 'email' ? TicketOrigem.EMAIL : TicketOrigem.ALERTA,
      },
      {
        id: input.externalId || input.fromEmail || input.fromName || 'external',
        nome: input.fromName || input.fromEmail || input.source,
        tipo: 'client_user',
      },
    );
  }

  private async resolveTenant(input: InboundTicketInput): Promise<Tenant> {
    if (input.tenantId) {
      const byId = await this.tenantRepo.findOne({ where: { id: input.tenantId } });
      if (byId) return byId;
    }

    if (input.tenantSlug) {
      const bySlug = await this.tenantRepo.findOne({ where: { slug: input.tenantSlug } });
      if (bySlug) return bySlug;
    }

    throw new NotFoundException('Tenant não encontrado para o inbound');
  }
}
