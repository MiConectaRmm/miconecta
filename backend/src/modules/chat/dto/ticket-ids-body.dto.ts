import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TicketIdsBodyDto {
  @ApiProperty({ type: [String], maxItems: 200 })
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('4', { each: true })
  ticketIds: string[];
}
