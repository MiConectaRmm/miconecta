import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../../database/entities/conversation.entity';
import { ConversationParticipant } from '../../database/entities/conversation-participant.entity';
import { ConversationMessage } from '../../database/entities/conversation-message.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';
import { ChatConversationAdapter } from './chat-conversation.adapter';
import { ChatModule } from '../chat/chat.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationParticipant, ConversationMessage, Ticket]),
    forwardRef(() => ChatModule),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService, ChatConversationAdapter],
  exports: [ConversationsService, ChatConversationAdapter],
})
export class ConversationsModule {}
