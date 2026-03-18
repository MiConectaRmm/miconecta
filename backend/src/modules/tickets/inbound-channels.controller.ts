import { Body, Controller, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { InboundChannelsService, InboundTicketInput } from './inbound-channels.service';

@ApiTags('Tickets Inbound')
@Controller('tickets/inbound')
export class InboundChannelsController {
  constructor(private readonly inboundChannelsService: InboundChannelsService) {}

  @Post('email')
  @ApiOperation({ summary: 'Converter e-mail em ticket' })
  async email(@Body() body: Omit<InboundTicketInput, 'source'>) {
    return this.inboundChannelsService.criarTicketInbound({
      ...body,
      source: 'email',
    });
  }

  @Post('whatsapp')
  @ApiOperation({ summary: 'Webhook WhatsApp para ticket' })
  async whatsapp(@Body() body: Omit<InboundTicketInput, 'source'>) {
    return this.inboundChannelsService.criarTicketInbound({
      ...body,
      source: 'whatsapp',
    });
  }
}
