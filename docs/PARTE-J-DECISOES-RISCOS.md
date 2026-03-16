# J. DECISÕES TÉCNICAS + RISCOS + FASE 1

## J.1 Decisões Técnicas com Justificativa

### Decisão 1: ORM — TypeORM (manter)

| Aspecto | Detalhe |
|---|---|
| **Escolha** | TypeORM |
| **Alternativas** | Prisma, MikroORM, Knex.js |
| **Justificativa** | Já em uso no projeto v1; migrar causaria retrabalho sem ganho imediato. TypeORM tem: migrations incrementais, QueryBuilder robusto para relatórios, subscribers para auditoria automática, integração madura com NestJS via `@nestjs/typeorm`. Prisma seria melhor para projetos novos (type-safety superior), mas não justifica migração. |

### Decisão 2: Multi-Tenant — Shared DB + tenant_id

| Aspecto | Detalhe |
|---|---|
| **Escolha** | Shared database, shared schema, filtro por tenant_id |
| **Alternativas** | Database por tenant, schema por tenant |
| **Justificativa** | Custo: 1 único banco ($7/mês no Render vs $7×N clientes). Migrations: 1 única execução vs N. Pool de conexões: 1 pool compartilhado. Escalabilidade: suporta centenas de tenants sem overhead. Risco mitigado por 5 camadas de proteção (JWT, guards, service layer, subscriber, RLS). Padrão da indústria SaaS. |

### Decisão 3: Real-Time — Socket.IO

| Aspecto | Detalhe |
|---|---|
| **Escolha** | Socket.IO via `@nestjs/platform-socket.io` |
| **Alternativas** | Raw WebSocket, SSE, Mercure, Ably, Pusher |
| **Justificativa** | NestJS tem suporte nativo com decorators. Rooms isolam por tenant/ticket/device. Namespaces separam domínios. Auto-reconnect é crítico para agentes. Fallback para HTTP long-polling quando firewalls bloqueiam WS. Redis adapter para escalar horizontalmente. Serviços pagos (Ably, Pusher) adicionam custo e dependência externa. |

### Decisão 4: Filas — BullMQ (Redis-backed)

| Aspecto | Detalhe |
|---|---|
| **Escolha** | BullMQ com Redis |
| **Alternativas** | RabbitMQ, AWS SQS, pg-boss |
| **Justificativa** | BullMQ usa o mesmo Redis já provisionado para cache/PubSub (custo zero adicional). Integração com NestJS via `@nestjs/bullmq`. Retry automático com backoff exponencial. Dead letter queue. Dashboard de monitoramento (Bull Board). RabbitMQ exigiria serviço separado. SQS criaria dependência AWS. pg-boss sobrecarregaria o PostgreSQL. |

### Decisão 5: Storage — Cloudflare R2

| Aspecto | Detalhe |
|---|---|
| **Escolha** | Cloudflare R2 (S3-compatible) |
| **Alternativas** | AWS S3, MinIO self-hosted, Supabase Storage |
| **Justificativa** | R2 é 100% compatível com API S3. Zero custo de egress (download gratuito — AWS cobra $0.09/GB). 10 GB free tier. Integração com SDK `@aws-sdk/client-s3` (mesma API do S3). MinIO exigiria servidor dedicado. Se necessário, migrar para AWS S3 é trivial (mesma API). |

### Decisão 6: Frontend — 2 apps separadas (Maginf + Portal)

| Aspecto | Detalhe |
|---|---|
| **Escolha** | 2 aplicações Next.js independentes |
| **Alternativas** | 1 app com roteamento por role, micro-frontends |
| **Justificativa** | Separação clara de responsabilidades. Bundle menor para cada público. Deploy independente (Maginf pode atualizar sem afetar portal). UX otimizada para cada contexto. Componentes compartilhados via `packages/ui`. Micro-frontends seriam overengineering para este estágio. |

### Decisão 7: Chat vinculado a ticket (não avulso)

| Aspecto | Detalhe |
|---|---|
| **Escolha** | Todo chat é vinculado a um ticket (obrigatório) |
| **Alternativas** | Chat avulso entre usuários |
| **Justificativa** | Rastreabilidade: toda conversa está documentada em um ticket auditável. SLA: tempo de resposta é medido a partir do ticket. Relatórios: conversas alimentam métricas de atendimento. LGPD: retenção e exportação são por ticket. Se o cliente quer "só conversar", o sistema cria um ticket automaticamente (tipo "consulta geral"). Elimina conversas fantasmas sem registro. |

### Decisão 8: Monorepo com Turborepo + PNPM

| Aspecto | Detalhe |
|---|---|
| **Escolha** | Turborepo + PNPM workspaces |
| **Alternativas** | Nx, Lerna, repositórios separados |
| **Justificativa** | `shared-types` garante consistência de tipos entre frontend e backend. Builds paralelos com cache inteligente. PNPM é mais rápido e econômico em disco que npm/yarn. Nx seria mais poderoso, mas o overhead de configuração não compensa para 4 apps. Repos separados fragmentariam os tipos compartilhados. |

### Decisão 9: Auth — JWT com Refresh Token Rotation

| Aspecto | Detalhe |
|---|---|
| **Escolha** | Access Token (15min) + Refresh Token (7 dias) com rotação |
| **Alternativas** | Session-based (cookies), JWT longo, OAuth2 |
| **Justificativa** | Access token curto limita janela de comprometimento. Refresh token rotation: a cada uso, o anterior é invalidado (detecta roubo). Blacklist no Redis para logout imediato. Agente usa device_token separado (sem expiração, revogável). OAuth2 seria necessário apenas se integrasse com IDPs externos (futuro). |

### Decisão 10: Acesso Remoto — RustDesk (manter)

| Aspecto | Detalhe |
|---|---|
| **Escolha** | RustDesk self-hosted |
| **Alternativas** | TeamViewer API, AnyDesk, Apache Guacamole |
| **Justificativa** | Já em operação em 136.248.114.218. Open-source (sem licenciamento por seat). Self-hosted (dados sob controle). API para integração. TeamViewer/AnyDesk cobram por assento e são caixas-pretas. Guacamole é web-based (boa alternativa futura, mas requer setup adicional). |

---

## J.2 Lista Consolidada de Entidades (28+)

```
Nº   Entidade                  Tabela                    Status    tenant_id
──── ──────────────────────── ─────────────────────────── ───────── ─────────
01   Tenant                    tenants                    Existente  —
02   Organization              organizations              Existente  ✅
03   Technician                technicians                Evoluir    — (global)
04   ClientUser                client_users               NOVO       ✅
05   Device                    devices                    Existente  ✅
06   DeviceMetric              device_metrics             Existente  via JOIN
07   DeviceInventory           device_inventories         Existente  via JOIN
08   Alert                     alerts                     Evoluir    ✅
09   AlertRule                 alert_rules                NOVO       ✅*
10   Ticket                    tickets                    NOVO       ✅
11   TicketComment             ticket_comments            NOVO       via JOIN
12   TicketCategory            ticket_categories          NOVO       ✅*
13   TicketSlaConfig           ticket_sla_configs         NOVO       ✅
14   ChatMessage               chat_messages              NOVO       via JOIN
15   RemoteSession             remote_sessions            NOVO       ✅
16   RemoteSessionLog          remote_session_logs        NOVO       via JOIN
17   ConsentRecord             consent_records            NOVO       ✅
18   Script                    scripts                    Existente  ✅*
19   ScriptExecution           script_executions          Existente  via JOIN
20   SoftwarePackage           software_packages          Existente  ✅*
21   SoftwareDeployment        software_deployments       Existente  via JOIN
22   Patch                     patches                    Existente  via JOIN
23   Notification              notifications              NOVO       ✅
24   NotificationPreference    notification_preferences   NOVO       —
25   ReportSchedule            report_schedules           NOVO       ✅
26   FileAttachment            file_attachments           NOVO       ✅
27   LgpdRequest               lgpd_requests              NOVO       ✅
28   AuditLog                  audit_logs                 Evoluir    ✅
29   Session                   sessions                   Existente  via JOIN

* = tenant_id nullable (null = recurso global)
```

---

## J.3 Ordem Exata Recomendada para FASE 1

```
FASE 1 — Fundação (4 semanas)

SEMANA 1: Infraestrutura Base
──────────────────────────────
DIA 1-2: Reestruturação do Projeto
  ├── 1.1 Migrar para estrutura monorepo (apps/, packages/)
  ├── 1.2 Configurar Turborepo + PNPM workspaces
  ├── 1.3 Criar packages/shared-types com enums e DTOs
  ├── 1.4 Mover backend para apps/backend
  └── 1.5 Mover frontend para apps/frontend-maginf

DIA 3-4: Redis + BullMQ
  ├── 1.6 Provisionar Redis (Upstash free tier)
  ├── 1.7 Configurar @nestjs/bullmq no backend
  ├── 1.8 Implementar health check /health/redis
  ├── 1.9 Criar job base: OfflineCheckJob (substituir @Cron)
  └── 1.10 Testar filas com job simples

DIA 5: Storage S3
  ├── 1.11 Criar conta Cloudflare R2
  ├── 1.12 Implementar StorageModule (upload/download/delete)
  ├── 1.13 Implementar entidade FileAttachment
  ├── 1.14 Health check /health/storage
  └── 1.15 Testar upload/download de arquivo

SEMANA 2: Auth + RBAC Expandido
──────────────────────────────
DIA 6-7: Entidade ClientUser + Auth Expandido
  ├── 2.1 Criar entidade ClientUser (entity, migration)
  ├── 2.2 Expandir Technician (tipo, tenants_atribuidos)
  ├── 2.3 Expandir Tenant (plano, limites, sla_config)
  ├── 2.4 Implementar Refresh Token (entity ou Redis)
  ├── 2.5 Implementar refresh token rotation
  ├── 2.6 Implementar POST /auth/refresh
  └── 2.7 Implementar POST /auth/logout (blacklist Redis)

DIA 8-9: RBAC Granular
  ├── 2.8 Definir permissions por role (JSONB ou constantes)
  ├── 2.9 Implementar RolesGuard expandido
  ├── 2.10 Implementar PermissionsGuard
  ├── 2.11 Implementar TenantAccessGuard
  ├── 2.12 Implementar decorators: @Roles, @RequirePermissions
  ├── 2.13 Implementar @CurrentUser, @CurrentTenant
  └── 2.14 Testes unitários dos guards

DIA 10: Middleware Pipeline
  ├── 2.15 CorrelationIdMiddleware (X-Request-Id)
  ├── 2.16 TenantExtractionMiddleware (do JWT)
  ├── 2.17 RequestLoggerMiddleware (structured logging)
  └── 2.18 Aplicar middlewares globalmente

SEMANA 3: Audit + Tenant Isolation
──────────────────────────────
DIA 11-12: Auditoria Automática
  ├── 3.1 Expandir entidade AuditLog (campos novos)
  ├── 3.2 Implementar AuditInterceptor (captura toda escrita)
  ├── 3.3 Implementar AuditJob (BullMQ — persistência async)
  ├── 3.4 Implementar TenantValidationSubscriber (TypeORM)
  ├── 3.5 Implementar AuditSubscriber (captura diffs auto)
  └── 3.6 Testes: verificar que toda operação é auditada

DIA 13-14: Tenant Isolation Reforçado
  ├── 3.7 Revisar TODAS as queries existentes (tenant filter)
  ├── 3.8 Implementar base service com tenant filter embutido
  ├── 3.9 Implementar RLS no PostgreSQL (tabelas críticas)
  ├── 3.10 Testes de isolamento: verificar cross-tenant bloqueado
  └── 3.11 Stress test: criar 2 tenants e validar isolamento

DIA 15: Users Module
  ├── 3.12 Implementar UsersModule (TechniciansController + ClientUsersController)
  ├── 3.13 CRUD de técnicos (expandido)
  ├── 3.14 CRUD de client_users (com convite por email)
  └── 3.15 Testes

SEMANA 4: Notificações + Testes + Deploy
──────────────────────────────
DIA 16-17: Notificações Base
  ├── 4.1 Implementar entidades: Notification, NotificationPreference
  ├── 4.2 Implementar NotificationsService (criar, listar, marcar lida)
  ├── 4.3 Implementar NotificationsGateway (Socket.IO /notifications)
  ├── 4.4 Implementar EmailService (Nodemailer + templates)
  ├── 4.5 Implementar NotificationJob (BullMQ — envio de emails)
  └── 4.6 Templates de email: convite, reset senha, alerta crítico

DIA 18-19: WebSocket Gateway Expandido
  ├── 4.7 Refatorar Gateway para múltiplos namespaces
  ├── 4.8 Implementar autenticação JWT no WebSocket handshake
  ├── 4.9 Implementar rooms por tenant e por usuário
  ├── 4.10 Configurar Redis adapter para Socket.IO
  ├── 4.11 Implementar /devices namespace (status changes)
  └── 4.12 Implementar /alerts namespace (novos alertas)

DIA 20: Testes + Deploy
  ├── 4.13 Testes E2E dos fluxos: login, refresh, RBAC, audit
  ├── 4.14 Testar isolamento multi-tenant (2 tenants)
  ├── 4.15 Testar notificações (in-app + email)
  ├── 4.16 Atualizar Render env vars (REDIS_URL, S3 vars)
  ├── 4.17 Deploy no Render
  ├── 4.18 Smoke test em produção
  └── 4.19 Documentar o que foi feito

ENTREGÁVEIS DA FASE 1:
├── ✅ Monorepo funcionando (Turborepo + PNPM)
├── ✅ Redis configurado (Upstash)
├── ✅ S3 configurado (Cloudflare R2)
├── ✅ ClientUser entity + CRUD
├── ✅ Technician expandido (tipos, tenants_atribuidos)
├── ✅ Tenant expandido (plano, limites, SLA)
├── ✅ Refresh Token com rotation
├── ✅ RBAC granular (guards + decorators + permissions)
├── ✅ Audit automático (interceptor + subscriber + BullMQ)
├── ✅ Tenant isolation reforçado (5 camadas)
├── ✅ Notificações in-app + email
├── ✅ WebSocket com namespaces + Redis adapter
├── ✅ Testes de isolamento
└── ✅ Deploy em produção
```

---

## J.4 Riscos Técnicos e Mitigações

```
RISCO 1: Vazamento de Dados Cross-Tenant
─────────────────────────────────────────
Impacto: CRÍTICO
Probabilidade: Média (se não mitigado)
Mitigação:
  ├── 5 camadas de proteção (seção B.2)
  ├── TypeORM Subscriber valida tenant_id em TODA operação
  ├── PostgreSQL RLS como rede de segurança final
  ├── Testes automatizados de isolamento em CI/CD
  ├── Code review obrigatório para toda query de banco
  └── NUNCA usar .find() sem where.tenantId

RISCO 2: Performance do Banco com Muitos Tenants
─────────────────────────────────────────────────
Impacto: Alto
Probabilidade: Baixa (a curto prazo)
Mitigação:
  ├── Indexes compostos em (tenant_id, campo_filtro)
  ├── Particionamento de tabelas grandes (device_metrics por mês)
  ├── Agregação de métricas históricas (job diário)
  ├── Cache Redis para queries frequentes
  ├── Paginação obrigatória em toda listagem
  └── Monitoramento de slow queries (pg_stat_statements)

RISCO 3: Complexidade do Monorepo
──────────────────────────────────
Impacto: Médio
Probabilidade: Média
Mitigação:
  ├── Migração incremental (não reescrever tudo de uma vez)
  ├── Backend e frontend-maginf primeiro
  ├── frontend-portal adicionado na Fase 3
  ├── CI/CD testado em cada etapa
  └── Fallback: se Turborepo complicar, deploy como apps independentes

RISCO 4: WebSocket em Produção (Render)
────────────────────────────────────────
Impacto: Alto
Probabilidade: Média
Mitigação:
  ├── Socket.IO com fallback para HTTP long-polling
  ├── Render suporta WebSocket nativamente
  ├── Redis adapter para múltiplas instâncias
  ├── Heartbeat do Socket.IO para detectar desconexões
  ├── Agente com fallback para REST polling
  └── Testar atrás de firewalls corporativos

RISCO 5: Migração de Dados v1 → v2
────────────────────────────────────
Impacto: Alto
Probabilidade: Alta (certeza de acontecer)
Mitigação:
  ├── Migrations incrementais (NUNCA drop + recreate)
  ├── Novas colunas com DEFAULT ou nullable
  ├── Dados existentes preservados
  ├── Script de migração para popular novos campos obrigatórios
  ├── Testar migration em banco clone antes de produção
  └── Backup antes de cada migration

RISCO 6: Cold Start do Render (Free Tier)
──────────────────────────────────────────
Impacto: Médio (UX ruim na primeira request)
Probabilidade: Alta
Mitigação:
  ├── Usar plano pago Render ($7/mês) — sem sleep
  ├── Ou: UptimeRobot pinga a cada 5 minutos
  ├── Frontend exibe "Conectando..." durante cold start
  └── Agentes toleram 30s de timeout no heartbeat

RISCO 7: Crescimento do Banco de Audit Logs
────────────────────────────────────────────
Impacto: Médio
Probabilidade: Alta (cresce indefinidamente)
Mitigação:
  ├── Particionamento por mês (audit_logs_2026_03)
  ├── Indexes específicos para queries comuns
  ├── Job de arquivamento: mover logs > 1 ano para tabela cold
  ├── Política de retenção configurável por tipo
  ├── Compressão de dados antigos (JSONB)
  └── Futuro: migrar logs históricos para data warehouse

RISCO 8: Segurança do Agente Windows
─────────────────────────────────────
Impacto: CRÍTICO
Probabilidade: Baixa
Mitigação:
  ├── Device token armazenado no Windows Credential Manager
  ├── Toda comunicação via HTTPS/TLS 1.3
  ├── Token revogável pelo admin (invalidação imediata)
  ├── Agente verifica certificado do servidor (certificate pinning)
  ├── Auto-update com verificação SHA256
  └── Logs locais protegidos contra edição
```

---

## J.5 Próximos Passos Técnicos

Após aprovação deste documento:

1. **Fase 1, Semana 1:** Reestruturar monorepo + Redis + S3
2. **Fase 1, Semana 2:** Auth expandido + RBAC granular
3. **Fase 1, Semana 3:** Auditoria automática + tenant isolation
4. **Fase 1, Semana 4:** Notificações + WebSocket + deploy

Diga **"vamos implementar a Fase 1"** para iniciar o código real.

---

*Documento técnico completo do MIConectaRMM Enterprise v2.0*
*Maginf Tecnologia © 2026*
