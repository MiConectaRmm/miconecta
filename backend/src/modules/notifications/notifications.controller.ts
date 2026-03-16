import {
  Controller, Get, Put, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar notificações do usuário' })
  async listar(@Req() req: any, @Query('naoLidas') naoLidas?: string) {
    return this.notificationsService.listar(req.user.sub, naoLidas === 'true');
  }

  @Get('count')
  @ApiOperation({ summary: 'Contar notificações não lidas' })
  async contar(@Req() req: any) {
    const count = await this.notificationsService.contarNaoLidas(req.user.sub);
    return { count };
  }

  @Put(':id/read')
  @ApiOperation({ summary: 'Marcar notificação como lida' })
  async marcarComoLida(@Req() req: any, @Param('id') id: string) {
    return this.notificationsService.marcarComoLida(id, req.user.sub);
  }

  @Put('read-all')
  @ApiOperation({ summary: 'Marcar todas como lidas' })
  async marcarTodasComoLidas(@Req() req: any) {
    return this.notificationsService.marcarTodasComoLidas(req.user.sub);
  }
}
