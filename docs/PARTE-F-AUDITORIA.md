# F. AUDITORIA

## F.1 Princípios

1. **Imutabilidade** — Logs de auditoria são append-only. Nunca alterados ou deletados.
2. **Completude** — Toda operação de escrita (create, update, delete) é registrada.
3. **Rastreabilidade** — Cada log tem: quem, quando, o quê, de onde, por quê.
4. **Performance** — Auditoria assíncrona (interceptor + fila BullMQ) para não impactar latência.
5. **Retenção** — Mínimo 5 anos para compliance. Configurável por tipo.

## F.2 O Que DEVE Ser Auditado

```
CATEGORIA             EVENTOS                                    RETENÇÃO   IMUTÁVEL
──────────────────── ──────────────────────────────────────────── ────────── ────────
Autenticação          Login sucesso/falha, logout, reset senha,   5 anos     ✅
                      token refresh, lockout, 2FA

Gestão de Usuários    Criar/editar/desativar técnico ou client,   5 anos     ✅
                      alterar role, alterar permissão, convite

Gestão de Tenants     Criar/editar/suspender tenant,              5 anos     ✅
                      alterar plano, SLA, config

Dispositivos          Registrar/remover device, alterar tags,     3 anos     ✅
                      alterar organização

Tickets               Criar/editar/fechar/reabrir ticket,         3 anos     ✅
                      alterar status, atribuir, escalonar,
                      adicionar comentário, avaliar

Chat                  Mensagens NÃO auditadas individualmente      —          —
                      (já persistidas em chat_messages)
                      EXCETO: exclusão de mensagem

Sessão Remota         Solicitar/aceitar/recusar/iniciar/           5 anos    ✅
                      finalizar sessão, cada ação durante

Consentimento         Todo registro de consentimento LGPD          10 anos   ✅

Scripts               Criar/editar/executar script,                3 anos    ✅
                      resultado da execução

Software              Upload/deploy/resultado                      3 anos    ✅

Patches               Aplicar/agendar/resultado                    3 anos    ✅

Relatórios            Gerar/exportar relatório                     2 anos    ✅

Storage               Upload/download/excluir arquivo              3 anos    ✅

LGPD                  Solicitação de dados, exportação,            10 anos   ✅
                      exclusão, revogação de consentimento

Configurações         Alterar qualquer configuração                5 anos    ✅
```

## F.3 Estrutura do Audit Log

```typescript
{
  id: "uuid",
  tenantId: "uuid",                // tenant afetado (null para ops globais)
  correlationId: "uuid",           // X-Request-Id para rastrear request completo

  // QUEM
  autorTipo: "technician" | "client_user" | "agent" | "system" | "job",
  autorId: "uuid",                 // null para system/job
  autorNome: "João Silva",
  autorEmail: "joao@maginf.com.br",
  autorRole: "tecnico",
  autorIp: "200.x.x.x",
  autorUserAgent: "Mozilla/5.0...",

  // O QUÊ
  acao: "ticket.criar" | "session.iniciar" | "device.registrar",
  recurso: "ticket" | "device" | "session",
  recursoId: "uuid",
  recursoDescricao: "Ticket #1234 - Mouse não funciona",

  // DETALHES
  dadosAnteriores: { status: "aberto" },       // null para CREATE
  dadosNovos: { status: "em_atendimento" },    // null para DELETE
  metadata: { ... contexto adicional ... },

  // QUANDO
  criadoEm: "2026-03-16T15:00:00Z"
}
```

## F.4 Implementação Técnica

```
Estratégia: AuditInterceptor (NestJS) + BullMQ Job

1. AuditInterceptor captura TODA request de escrita (POST, PUT, PATCH, DELETE)
2. Extrai contexto: user, tenant, IP, action, correlation_id
3. Publica job na fila BullMQ: audit.log (fire-and-forget)
4. AuditProcessor persiste no banco de forma assíncrona
5. Impacto na latência: ~0ms

Para operações CRÍTICAS (consentimento, sessão remota):
→ Persistência SÍNCRONA (não via fila) para garantir registro imediato

TypeORM Subscriber (camada adicional):
→ Intercepta beforeInsert/beforeUpdate/beforeRemove
→ Captura diff (antes/depois) automaticamente
→ Log de segurança se tenantId inconsistente
```
