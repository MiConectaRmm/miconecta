import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Conversation } from '../../database/entities/conversation.entity';
import { ConversationParticipant } from '../../database/entities/conversation-participant.entity';
import { ConversationMessage } from '../../database/entities/conversation-message.entity';
import { ConversationsController } from './conversations.controller';
import { ConversationsService } from './conversations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationParticipant, ConversationMessage]),
  ],
  controllers: [ConversationsController],
  providers: [ConversationsService],
  exports: [ConversationsService],
})
export class ConversationsModule {}
