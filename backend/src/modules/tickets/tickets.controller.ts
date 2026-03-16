import {
  Controller, Get, Post, Put, Body, Param, Query,
  UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TicketsService } from './tickets.service';
import { UnifiedTimelineService } from './unified-timeline.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { TicketStatus } from '../../database/entities/ticket.entity';

@ApiTags('Tickets')
@Controller('tickets')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly timelineService: UnifiedTimelineService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Criar ticket' })
  async criar(@Req() req: any, @Body() dto: CreateTicketDto) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.criar(tenantId, dto, {
      id: req.user.sub,
      nome: req.user.nome,
      tipo: req.user.userType || 'technician',
    });
  }

  @Get()
  @ApiOperation({ summary: 'Listar tickets do tenant' })
  async listar(@Req() req: any, @Query() filtros: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.listar(tenantId, filtros);
  }

  @Get('contagem')
  @ApiOperation({ summary: 'Contagem de tickets por status' })
  async contagem(@Req() req: any) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.contagem(tenantId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Buscar ticket por ID' })
  async buscar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.buscar(id, tenantId);
  }

  // ── Timeline Unificada ──

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Timeline unificada do ticket (comments + chat + sessions)' })
  async timeline(
    @Req() req: any,
    @Param('id') id: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    await this.ticketsService.buscar(id, tenantId); // Valida acesso
    const isClient = req.user.userType === 'client_user';
    return this.timelineService.getTimeline(id, {
      visivelCliente: isClient ? true : undefined,
      limit: limit || 500,
      offset: offset || 0,
    });
  }

  @Get(':id/resumo')
  @ApiOperation({ summary: 'Resumo automático do atendimento' })
  async resumo(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.timelineService.gerarResumo(id, tenantId);
  }

  // ── Transições de Status ──

  @Put(':id/atribuir')
  @ApiOperation({ summary: 'Atribuir ticket a técnico' })
  async atribuir(@Req() req: any, @Param('id') id: string, @Body() body: { technicianId: string; technicianNome: string }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.atribuir(id, tenantId, body.technicianId, body.technicianNome);
  }

  @Put(':id/resolver')
  @ApiOperation({ summary: 'Resolver ticket' })
  async resolver(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.atualizarStatus(id, tenantId, TicketStatus.RESOLVIDO, req.user.nome);
  }

  @Put(':id/fechar')
  @ApiOperation({ summary: 'Fechar ticket (gera resumo automático)' })
  async fechar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const ticket = await this.ticketsService.atualizarStatus(id, tenantId, TicketStatus.FECHADO, req.user.nome);
    const resumo = await this.timelineService.gerarResumo(id, tenantId);
    return { ...ticket, resumo };
  }

  @Put(':id/reabrir')
  @ApiOperation({ summary: 'Reabrir ticket' })
  async reabrir(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.atualizarStatus(id, tenantId, TicketStatus.ABERTO, req.user.nome);
  }

  @Put(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar ticket' })
  async cancelar(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.atualizarStatus(id, tenantId, TicketStatus.CANCELADO, req.user.nome);
  }

  @Put(':id/aguardar-cliente')
  @ApiOperation({ summary: 'Marcar como aguardando cliente' })
  async aguardarCliente(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.atualizarStatus(id, tenantId, TicketStatus.AGUARDANDO_CLIENTE, req.user.nome);
  }

  @Put(':id/aguardar-tecnico')
  @ApiOperation({ summary: 'Marcar como aguardando técnico' })
  async aguardarTecnico(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.atualizarStatus(id, tenantId, TicketStatus.AGUARDANDO_TECNICO, req.user.nome);
  }

  // ── Comentários e Notas ──

  @Post(':id/comentario')
  @ApiOperation({ summary: 'Adicionar comentário ao ticket' })
  async comentar(@Req() req: any, @Param('id') id: string, @Body() body: { conteudo: string; visivelCliente?: boolean }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.adicionarComentario(id, tenantId, {
      conteudo: body.conteudo,
      autorId: req.user.sub,
      autorNome: req.user.nome,
      autorTipo: req.user.userType || 'technician',
      visivelCliente: body.visivelCliente,
    });
  }

  @Post(':id/nota-interna')
  @ApiOperation({ summary: 'Adicionar nota interna (não visível ao cliente)' })
  async notaInterna(@Req() req: any, @Param('id') id: string, @Body() body: { conteudo: string }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.adicionarComentario(id, tenantId, {
      conteudo: body.conteudo,
      autorId: req.user.sub,
      autorNome: req.user.nome,
      autorTipo: req.user.userType || 'technician',
      visivelCliente: false,
    });
  }

  // ── Avaliação ──

  @Post(':id/avaliar')
  @ApiOperation({ summary: 'Avaliar atendimento (cliente)' })
  async avaliar(@Req() req: any, @Param('id') id: string, @Body() body: { nota: number; comentario?: string }) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.ticketsService.avaliar(id, tenantId, body.nota, body.comentario);
  }
}
