import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Ticket } from '../../database/entities/ticket.entity';
import { TicketComment } from '../../database/entities/ticket-comment.entity';
import { ChatMessage } from '../../database/entities/chat-message.entity';
import { RemoteSession } from '../../database/entities/remote-session.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { UnifiedTimelineService } from './unified-timeline.service';

@Module({
  imports: [TypeOrmModule.forFeature([Ticket, TicketComment, ChatMessage, RemoteSession])],
  controllers: [TicketsController],
  providers: [TicketsService, UnifiedTimelineService],
  exports: [TicketsService, UnifiedTimelineService],
})
export class TicketsModule {}
