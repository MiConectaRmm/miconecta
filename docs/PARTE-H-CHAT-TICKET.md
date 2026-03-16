# H. CHAT + TICKET + TIMELINE UNIFICADA

## H.1 Modelo Conceitual

```
┌────────────────────────────────────────────────────────────────┐
│                         TICKET                                  │
│  (entidade central que conecta tudo)                           │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    TIMELINE UNIFICADA                     │  │
│  │  (ordenada por criadoEm ASC)                             │  │
│  │                                                           │  │
│  │  Fontes de dados:                                        │  │
│  │  ├── chat_messages       WHERE ticket_id = :id           │  │
│  │  ├── ticket_comments     WHERE ticket_id = :id           │  │
│  │  ├── remote_sessions     WHERE ticket_id = :id           │  │
│  │  ├── script_executions   WHERE via ticket (metadata)     │  │
│  │  └── file_attachments    WHERE entidade='ticket'         │  │
│  │                                                           │  │
│  │  A timeline é uma QUERY VIRTUAL (UNION ALL), não         │  │
│  │  uma tabela separada.                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  Vínculos:                                                     │
│  ├── tenant_id       (obrigatório)                             │
│  ├── device_id       (opcional)                                │
│  ├── organization_id (opcional — inferido do device)           │
│  ├── atribuido_a     (technician_id)                           │
│  └── criado_por      (client_user_id ou technician_id)         │
└────────────────────────────────────────────────────────────────┘
```

## H.2 Quando Existe Chat

```
REGRA FUNDAMENTAL: Todo chat é vinculado a um ticket.
Não existe chat avulso sem ticket.

CENÁRIO 1 — Chat Geral (via Portal do Cliente)
  1. Cliente abre ticket no portal
  2. Ticket é criado com status ABERTO
  3. Chat do ticket fica disponível automaticamente
  4. Cliente e técnico trocam mensagens nesse chat
  → O chat É o canal de comunicação do ticket

CENÁRIO 2 — Chat por Dispositivo (via Agente)
  1. Usuário clica "Solicitar Suporte" no tray icon do agente
  2. Agente envia request ao backend:
     POST /tickets { origem: 'agente', deviceId: '...' }
  3. Backend cria ticket vinculado ao device automaticamente
  4. Chat abre vinculado ao ticket + device
  5. Técnico vê: chat + info do device lado a lado
  → O device_id permite ao técnico ver métricas, inventário,
    histórico ao mesmo tempo que conversa

CENÁRIO 3 — Chat por Ticket (via Painel Maginf)
  1. Técnico cria ticket interno (ex: manutenção preventiva)
  2. Técnico vincula device (opcional)
  3. Chat do ticket fica disponível
  4. Técnico pode convidar o cliente para o chat
  → Usado para comunicação interna ou com o cliente
```

## H.3 Timeline Unificada — Implementação

```typescript
// Endpoint: GET /tickets/:id/timeline
// Retorna todos os eventos do ticket em ordem cronológica

async getTimeline(ticketId: string): Promise<TimelineItem[]> {
  // 1. Buscar mensagens de chat
  const chatMessages = await this.chatMessageRepo.find({
    where: { ticketId },
    order: { criadoEm: 'ASC' },
  });

  // 2. Buscar comentários do ticket (notas internas, mudanças de status)
  const comments = await this.ticketCommentRepo.find({
    where: { ticketId },
    order: { criadoEm: 'ASC' },
  });

  // 3. Buscar sessões remotas
  const sessions = await this.remoteSessionRepo.find({
    where: { ticketId },
    order: { criadoEm: 'ASC' },
  });

  // 4. Buscar anexos
  const attachments = await this.fileAttachmentRepo.find({
    where: { entidadeTipo: 'ticket', entidadeId: ticketId },
    order: { criadoEm: 'ASC' },
  });

  // 5. Normalizar todos para TimelineItem
  const timeline: TimelineItem[] = [
    ...chatMessages.map(m => ({
      tipo: 'chat_message',
      criadoEm: m.criadoEm,
      autorNome: m.remetenteNome,
      autorTipo: m.remetenteTipo,
      conteudo: m.conteudo,
      visivelCliente: true,
      metadata: { tipoMensagem: m.tipo },
    })),
    ...comments.map(c => ({
      tipo: c.tipo, // 'nota_interna', 'mudanca_status', 'script_executado'
      criadoEm: c.criadoEm,
      autorNome: c.autorNome,
      autorTipo: c.autorTipo,
      conteudo: c.conteudo,
      visivelCliente: c.visivelCliente,
      metadata: c.metadata,
    })),
    ...sessions.map(s => ({
      tipo: 'sessao_remota',
      criadoEm: s.criadoEm,
      autorNome: s.technician?.nome,
      autorTipo: 'technician',
      conteudo: `Sessão remota: ${s.status} (${s.duracaoSegundos}s)`,
      visivelCliente: true,
      metadata: { sessionId: s.id, status: s.status, duracao: s.duracaoSegundos },
    })),
    ...attachments.map(a => ({
      tipo: 'anexo',
      criadoEm: a.criadoEm,
      autorNome: a.uploadedPorNome,
      autorTipo: a.uploadedPorTipo,
      conteudo: a.nomeOriginal,
      visivelCliente: true,
      metadata: { fileId: a.id, mimeType: a.mimeType, tamanho: a.tamanhoBytes },
    })),
  ];

  // 6. Ordenar cronologicamente
  timeline.sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime());

  // 7. Filtrar visibilidade se for client_user
  // (visivelCliente: false = nota interna, não exibida)

  return timeline;
}
```

## H.4 Como Eventos Técnicos Entram no Histórico

```
EVENTO                          TIPO NO TIMELINE         VISÍVEL CLIENTE
─────────────────────────────── ─────────────────────── ────────────────
Mensagem de chat                chat_message             ✅ Sim
Nota interna do técnico         nota_interna             ❌ Não
Mudança de status               mudanca_status           ✅ Sim
Atribuição de técnico           mudanca_atribuicao       ✅ Sim
Sessão remota solicitada        sessao_remota            ✅ Sim (resumo)
Sessão remota consentida        sessao_remota            ✅ Sim
Sessão remota finalizada        sessao_remota            ✅ Sim (duração)
Script executado                script_executado         ✅ Sim (resumo)
Script resultado detalhado      script_resultado         ❌ Não
Alerta vinculado                alerta_vinculado         ✅ Sim
Anexo adicionado                anexo                    ✅ Sim
Avaliação do cliente            avaliacao                ✅ Sim
SLA warning                     sla_warning              ❌ Não
```

## H.5 Geração de Resumo Pós-Atendimento

```
Ao resolver um ticket, o sistema gera automaticamente um resumo:

DADOS COLETADOS:
- Título e descrição do ticket
- Todas as mensagens de chat (exceto sistema)
- Sessões remotas (duração, ações principais)
- Scripts executados e resultados
- Tempo total de atendimento
- SLA: atendido ou não

RESUMO GERADO (template):
┌─────────────────────────────────────────────────────────┐
│ RESUMO DO ATENDIMENTO - Ticket #1234                     │
│                                                          │
│ Cliente: Empresa ABC Ltda                                │
│ Dispositivo: DESKTOP-MARIA (192.168.1.100)              │
│ Problema: Mouse não funciona                             │
│                                                          │
│ Técnico: João Silva                                      │
│ Abertura: 16/03/2026 14:30                              │
│ Resolução: 16/03/2026 14:51                             │
│ Tempo total: 21 minutos                                  │
│ SLA: ✅ Dentro do prazo (meta: 4h)                      │
│                                                          │
│ Ações realizadas:                                        │
│ - Sessão remota: 12min 34s                              │
│ - Driver de mouse atualizado                             │
│ - Dispositivo reiniciado                                 │
│                                                          │
│ Solução: Driver do mouse estava corrompido.              │
│ Reinstalado via Gerenciador de Dispositivos.             │
│                                                          │
│ Avaliação: ⭐⭐⭐⭐⭐ (5/5)                            │
│ Comentário: "Rápido e eficiente!"                        │
└─────────────────────────────────────────────────────────┘

ARMAZENAMENTO:
- Salvo como ticket_comment (tipo: 'resumo_atendimento')
- Pode ser exportado como PDF
- Incluído em relatórios mensais do cliente
- Visível no portal do cliente
```

## H.6 Anexos no Fluxo

```
UPLOAD DE ANEXO:
1. Frontend envia: POST /storage/upload (multipart/form-data)
   { file, entidadeTipo: 'ticket', entidadeId: ticketId }
2. Backend valida: tamanho (max 25MB), tipo MIME (whitelist), quota do tenant
3. Upload para S3: bucket/{tenantId}/tickets/{ticketId}/{uuid}-{nome}
4. Cria file_attachment no banco
5. Cria ticket_comment tipo 'anexo' (para aparecer na timeline)
6. Emite WebSocket: ticket:comment_added

TIPOS PERMITIDOS:
- Imagens: jpg, png, gif, webp (max 10MB)
- Documentos: pdf, doc, docx, xls, xlsx, txt (max 25MB)
- Compactados: zip, rar (max 25MB)
- Screenshots de sessão: png (automático, max 5MB)

SEGURANÇA:
- URL assinada (presigned URL) com expiração de 1h
- Verificação de vírus (futuro: ClamAV)
- Acesso controlado por tenant
```
