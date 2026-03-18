import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../database/entities/ticket.entity';
import { TicketComment } from '../../database/entities/ticket-comment.entity';
import { ChatMessage } from '../../database/entities/chat-message.entity';
import { RemoteSession } from '../../database/entities/remote-session.entity';
import { ChatModule } from '../chat/chat.module';
import { TicketsController } from './tickets.controller';
import { InboundChannelsController } from './inbound-channels.controller';
import { TicketsService } from './tickets.service';
import { UnifiedTimelineService } from './unified-timeline.service';
import { TicketIntelligenceService } from './ticket-intelligence.service';
import { InboundChannelsService } from './inbound-channels.service';
import { Tenant } from '../../database/entities/tenant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketComment, ChatMessage, RemoteSession, Tenant]), ChatModule],
  controllers: [TicketsController, InboundChannelsController],
  providers: [TicketsService, UnifiedTimelineService, TicketIntelligenceService, InboundChannelsService],
  exports: [TicketsService, UnifiedTimelineService, TicketIntelligenceService, InboundChannelsService],
})
export class TicketsModule {}
