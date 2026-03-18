import { Injectable } from '@nestjs/common';
import { Ticket, TicketPrioridade } from '../../database/entities/ticket.entity';
import { TicketComment } from '../../database/entities/ticket-comment.entity';
import { ChatMessage, ChatMessageTipo } from '../../database/entities/chat-message.entity';

export interface TicketAutomationResult {
  prioridade: TicketPrioridade;
  categoriaId: string | null;
  atribuidoA: string | null;
}

export interface TicketAiSuggestion {
  suggestedReply: string;
  summary: string;
  priority: TicketPrioridade;
}

@Injectable()
export class TicketIntelligenceService {
  aplicarRegrasAutomaticas(ticket: Pick<Ticket, 'titulo' | 'descricao' | 'prioridade' | 'categoriaId' | 'atribuidoA'>): TicketAutomationResult {
    const texto = `${ticket.titulo} ${ticket.descricao}`.toLowerCase();

    const categoriaId = this.detectarCategoria(texto);
    const prioridade = this.detectarPrioridade(texto);
    const atribuidoA = this.detectarAtribuicao(texto);

    return {
      prioridade: ticket.prioridade === TicketPrioridade.MEDIA ? prioridade : ticket.prioridade,
      categoriaId,
      atribuidoA,
    };
  }

  sugerirResposta(ticket: Ticket, comments: TicketComment[], messages: ChatMessage[]): TicketAiSuggestion {
    const contexto = this.compilarContexto(ticket, comments, messages);
    const prioridade = this.detectarPrioridade(contexto);
    return {
      suggestedReply: this.montarResposta(ticket, comments, messages),
      summary: this.montarResumo(ticket, comments, messages),
      priority: prioridade,
    };
  }

  private detectarCategoria(texto: string): string | null {
    if (/(email|e-mail|outlook|exchange)/i.test(texto)) return 'email';
    if (/(rede|wi-?fi|internet|vpn|roteador|switch)/i.test(texto)) return 'rede';
    if (/(impressora|printer|spooler)/i.test(texto)) return 'impressora';
    if (/(backup|copia|restaura)/i.test(texto)) return 'backup';
    if (/(acesso|senha|login|autentica|permissao)/i.test(texto)) return 'acesso';
    if (/(servidor|server|vm|virtual)/i.test(texto)) return 'servidor';
    if (/(financeiro|boleto|pagamento|fatura)/i.test(texto)) return 'financeiro';
    if (/(incidente|falha|erro|parou|queda)/i.test(texto)) return 'incidente';
    return 'suporte_tecnico';
  }

  private detectarPrioridade(texto: string): TicketPrioridade {
    if (/(critico|urgente|parado|fora do ar|sem acesso|indisponivel)/i.test(texto)) return TicketPrioridade.URGENTE;
    if (/(alto impacto|muitos usuarios|várias unidades|varias unidades|produção)/i.test(texto)) return TicketPrioridade.ALTA;
    if (/(baixo|duvida|orientacao|solicitacao)/i.test(texto)) return TicketPrioridade.BAIXA;
    return TicketPrioridade.MEDIA;
  }

  private detectarAtribuicao(texto: string): string | null {
    if (/(rede|vpn|wi-?fi|internet)/i.test(texto)) return 'rede';
    if (/(email|outlook|exchange)/i.test(texto)) return 'email';
    if (/(backup|restore|copia)/i.test(texto)) return 'backup';
    return null;
  }

  private montarResposta(ticket: Ticket, comments: TicketComment[], messages: ChatMessage[]): string {
    const ultimoCliente = [...messages].reverse().find((m) => m.remetenteTipo === 'client_user') || [...comments].reverse().find((c) => c.autorTipo === 'client_user');
    const assunto = ticket.titulo || 'o chamado';
    const base = ultimoCliente ? `Entendi o contexto sobre "${assunto}".` : `Recebemos seu chamado sobre "${assunto}".`;
    return [
      base,
      'Estamos analisando a causa e validando a melhor ação para seguir com o atendimento.',
      'Se houver impacto maior ou mudança de prioridade, podemos ajustar imediatamente.',
    ].join(' ');
  }

  private montarResumo(ticket: Ticket, comments: TicketComment[], messages: ChatMessage[]): string {
    const totalMensagens = messages.length;
    const totalNotas = comments.filter((c) => c.tipo === 'nota_interna').length;
    return `Ticket #${ticket.numero} - ${ticket.titulo}. ${totalMensagens} mensagens e ${totalNotas} notas internas registradas.`;
  }

  private compilarContexto(ticket: Ticket, comments: TicketComment[], messages: ChatMessage[]): string {
    return [
      ticket.titulo,
      ticket.descricao,
      ...comments.map((c) => c.conteudo || ''),
      ...messages.map((m) => m.conteudo || ''),
    ].join(' ');
  }
}
