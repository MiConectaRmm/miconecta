# I. ESTRUTURA MONOREPO + CONTRATOS

## I.1 Estrutura de Pastas Completa

```
c:\app.miconecta\
│
├── apps/
│   ├── backend/                          # API NestJS
│   │   ├── src/
│   │   │   ├── common/
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── current-user.decorator.ts
│   │   │   │   │   ├── current-tenant.decorator.ts
│   │   │   │   │   ├── roles.decorator.ts
│   │   │   │   │   └── require-permissions.decorator.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   ├── roles.guard.ts
│   │   │   │   │   ├── tenant-access.guard.ts
│   │   │   │   │   ├── permissions.guard.ts
│   │   │   │   │   └── agent-auth.guard.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── audit.interceptor.ts
│   │   │   │   │   ├── transform.interceptor.ts
│   │   │   │   │   └── timeout.interceptor.ts
│   │   │   │   ├── middlewares/
│   │   │   │   │   ├── correlation-id.middleware.ts
│   │   │   │   │   ├── tenant-extraction.middleware.ts
│   │   │   │   │   └── request-logger.middleware.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   ├── pipes/
│   │   │   │   │   └── tenant-validation.pipe.ts
│   │   │   │   └── interfaces/
│   │   │   │       ├── authenticated-request.interface.ts
│   │   │   │       └── paginated-result.interface.ts
│   │   │   │
│   │   │   ├── config/
│   │   │   │   ├── database.config.ts
│   │   │   │   ├── redis.config.ts
│   │   │   │   ├── jwt.config.ts
│   │   │   │   ├── storage.config.ts
│   │   │   │   └── app.config.ts
│   │   │   │
│   │   │   ├── database/
│   │   │   │   ├── entities/              # 28+ entidades
│   │   │   │   │   ├── tenant.entity.ts
│   │   │   │   │   ├── organization.entity.ts
│   │   │   │   │   ├── technician.entity.ts
│   │   │   │   │   ├── client-user.entity.ts
│   │   │   │   │   ├── device.entity.ts
│   │   │   │   │   ├── device-metric.entity.ts
│   │   │   │   │   ├── device-inventory.entity.ts
│   │   │   │   │   ├── alert.entity.ts
│   │   │   │   │   ├── alert-rule.entity.ts
│   │   │   │   │   ├── ticket.entity.ts
│   │   │   │   │   ├── ticket-comment.entity.ts
│   │   │   │   │   ├── ticket-category.entity.ts
│   │   │   │   │   ├── ticket-sla-config.entity.ts
│   │   │   │   │   ├── chat-message.entity.ts
│   │   │   │   │   ├── remote-session.entity.ts
│   │   │   │   │   ├── remote-session-log.entity.ts
│   │   │   │   │   ├── consent-record.entity.ts
│   │   │   │   │   ├── script.entity.ts
│   │   │   │   │   ├── script-execution.entity.ts
│   │   │   │   │   ├── software-package.entity.ts
│   │   │   │   │   ├── software-deployment.entity.ts
│   │   │   │   │   ├── patch.entity.ts
│   │   │   │   │   ├── notification.entity.ts
│   │   │   │   │   ├── notification-preference.entity.ts
│   │   │   │   │   ├── report-schedule.entity.ts
│   │   │   │   │   ├── file-attachment.entity.ts
│   │   │   │   │   ├── lgpd-request.entity.ts
│   │   │   │   │   ├── audit-log.entity.ts
│   │   │   │   │   └── session.entity.ts
│   │   │   │   ├── migrations/
│   │   │   │   ├── subscribers/
│   │   │   │   │   ├── audit.subscriber.ts
│   │   │   │   │   └── tenant-validation.subscriber.ts
│   │   │   │   └── seeds/
│   │   │   │       ├── roles.seed.ts
│   │   │   │       └── categories.seed.ts
│   │   │   │
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── auth.module.ts
│   │   │   │   │   ├── auth.controller.ts
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── strategies/
│   │   │   │   │   │   ├── jwt.strategy.ts
│   │   │   │   │   │   └── agent-jwt.strategy.ts
│   │   │   │   │   └── dto/
│   │   │   │   │       ├── login.dto.ts
│   │   │   │   │       ├── refresh-token.dto.ts
│   │   │   │   │       ├── forgot-password.dto.ts
│   │   │   │   │       └── reset-password.dto.ts
│   │   │   │   │
│   │   │   │   ├── users/
│   │   │   │   │   ├── users.module.ts
│   │   │   │   │   ├── technicians.controller.ts
│   │   │   │   │   ├── client-users.controller.ts
│   │   │   │   │   ├── technicians.service.ts
│   │   │   │   │   ├── client-users.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── tenants/
│   │   │   │   │   ├── tenants.module.ts
│   │   │   │   │   ├── tenants.controller.ts
│   │   │   │   │   ├── tenants.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── organizations/
│   │   │   │   │   ├── organizations.module.ts
│   │   │   │   │   ├── organizations.controller.ts
│   │   │   │   │   ├── organizations.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── devices/
│   │   │   │   │   ├── devices.module.ts
│   │   │   │   │   ├── devices.controller.ts
│   │   │   │   │   ├── devices.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── agents/
│   │   │   │   │   ├── agents.module.ts
│   │   │   │   │   ├── agents.controller.ts
│   │   │   │   │   ├── agents.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── metrics/
│   │   │   │   │   ├── metrics.module.ts
│   │   │   │   │   ├── metrics.controller.ts
│   │   │   │   │   ├── metrics.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── alerts/
│   │   │   │   │   ├── alerts.module.ts
│   │   │   │   │   ├── alerts.controller.ts
│   │   │   │   │   ├── alerts.service.ts
│   │   │   │   │   ├── alert-engine.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── tickets/
│   │   │   │   │   ├── tickets.module.ts
│   │   │   │   │   ├── tickets.controller.ts
│   │   │   │   │   ├── tickets.service.ts
│   │   │   │   │   ├── sla.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── chat/
│   │   │   │   │   ├── chat.module.ts
│   │   │   │   │   ├── chat.controller.ts
│   │   │   │   │   ├── chat.service.ts
│   │   │   │   │   ├── chat.gateway.ts       # Socket.IO /chat
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── remote-sessions/
│   │   │   │   │   ├── remote-sessions.module.ts
│   │   │   │   │   ├── remote-sessions.controller.ts
│   │   │   │   │   ├── remote-sessions.service.ts
│   │   │   │   │   ├── remote-sessions.gateway.ts  # Socket.IO /sessions
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── scripts/
│   │   │   │   ├── software/
│   │   │   │   ├── patches/
│   │   │   │   ├── reports/
│   │   │   │   │   ├── reports.module.ts
│   │   │   │   │   ├── reports.controller.ts
│   │   │   │   │   ├── reports.service.ts
│   │   │   │   │   ├── generators/
│   │   │   │   │   │   ├── executive-report.generator.ts
│   │   │   │   │   │   ├── technical-report.generator.ts
│   │   │   │   │   │   └── sla-report.generator.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── notifications/
│   │   │   │   │   ├── notifications.module.ts
│   │   │   │   │   ├── notifications.controller.ts
│   │   │   │   │   ├── notifications.service.ts
│   │   │   │   │   ├── notifications.gateway.ts  # Socket.IO /notifications
│   │   │   │   │   ├── email.service.ts
│   │   │   │   │   └── templates/
│   │   │   │   │       ├── ticket-created.hbs
│   │   │   │   │       ├── ticket-resolved.hbs
│   │   │   │   │       ├── alert-critical.hbs
│   │   │   │   │       ├── invite-user.hbs
│   │   │   │   │       └── reset-password.hbs
│   │   │   │   │
│   │   │   │   ├── storage/
│   │   │   │   │   ├── storage.module.ts
│   │   │   │   │   ├── storage.controller.ts
│   │   │   │   │   ├── storage.service.ts     # abstração S3
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── lgpd/
│   │   │   │   │   ├── lgpd.module.ts
│   │   │   │   │   ├── lgpd.controller.ts
│   │   │   │   │   ├── lgpd.service.ts
│   │   │   │   │   ├── consent.service.ts
│   │   │   │   │   ├── retention.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   ├── audit/
│   │   │   │   │   ├── audit.module.ts
│   │   │   │   │   ├── audit.controller.ts
│   │   │   │   │   ├── audit.service.ts
│   │   │   │   │   └── dto/
│   │   │   │   │
│   │   │   │   └── gateway/
│   │   │   │       ├── gateway.module.ts
│   │   │   │       ├── devices.gateway.ts     # Socket.IO /devices
│   │   │   │       ├── alerts.gateway.ts      # Socket.IO /alerts
│   │   │   │       ├── tickets.gateway.ts     # Socket.IO /tickets
│   │   │   │       └── agent.gateway.ts       # Socket.IO /agent
│   │   │   │
│   │   │   ├── jobs/
│   │   │   │   ├── alert-engine.job.ts
│   │   │   │   ├── offline-check.job.ts
│   │   │   │   ├── sla-monitor.job.ts
│   │   │   │   ├── notification.job.ts
│   │   │   │   ├── report-generator.job.ts
│   │   │   │   ├── retention-cleanup.job.ts
│   │   │   │   └── metrics-aggregate.job.ts
│   │   │   │
│   │   │   ├── app.module.ts
│   │   │   └── main.ts
│   │   │
│   │   ├── test/
│   │   │   ├── unit/
│   │   │   ├── integration/
│   │   │   └── e2e/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   └── .env.example
│   │
│   ├── frontend-maginf/                     # Painel Maginf (Next.js)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   └── forgot-password/page.tsx
│   │   │   │   ├── dashboard/
│   │   │   │   │   ├── page.tsx             # Home
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── devices/
│   │   │   │   │   │   ├── page.tsx         # Lista
│   │   │   │   │   │   └── [id]/page.tsx    # Detalhe
│   │   │   │   │   ├── tickets/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── [id]/page.tsx    # Detalhe + chat + timeline
│   │   │   │   │   ├── alerts/page.tsx
│   │   │   │   │   ├── chat/page.tsx        # Visão geral de chats ativos
│   │   │   │   │   ├── sessions/page.tsx    # Sessões remotas
│   │   │   │   │   ├── scripts/page.tsx
│   │   │   │   │   ├── software/page.tsx
│   │   │   │   │   ├── patches/page.tsx
│   │   │   │   │   ├── clients/
│   │   │   │   │   │   ├── page.tsx         # Tenants
│   │   │   │   │   │   └── [id]/page.tsx    # Detalhe tenant
│   │   │   │   │   ├── technicians/page.tsx
│   │   │   │   │   ├── reports/page.tsx
│   │   │   │   │   ├── audit/page.tsx
│   │   │   │   │   └── settings/page.tsx
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── ui/                      # shadcn/ui components
│   │   │   │   ├── layout/
│   │   │   │   │   ├── sidebar.tsx
│   │   │   │   │   ├── header.tsx
│   │   │   │   │   └── tenant-selector.tsx
│   │   │   │   ├── tickets/
│   │   │   │   │   ├── ticket-list.tsx
│   │   │   │   │   ├── ticket-detail.tsx
│   │   │   │   │   ├── ticket-timeline.tsx
│   │   │   │   │   └── ticket-form.tsx
│   │   │   │   ├── chat/
│   │   │   │   │   ├── chat-panel.tsx
│   │   │   │   │   ├── message-bubble.tsx
│   │   │   │   │   └── typing-indicator.tsx
│   │   │   │   ├── devices/
│   │   │   │   ├── alerts/
│   │   │   │   └── sessions/
│   │   │   ├── lib/
│   │   │   │   ├── api.ts                   # Axios client
│   │   │   │   ├── socket.ts                # Socket.IO client
│   │   │   │   ├── auth.ts                  # Auth helpers
│   │   │   │   └── utils.ts
│   │   │   ├── hooks/
│   │   │   │   ├── use-socket.ts
│   │   │   │   ├── use-chat.ts
│   │   │   │   ├── use-notifications.ts
│   │   │   │   └── use-tenant.ts
│   │   │   └── stores/
│   │   │       ├── auth.store.ts
│   │   │       ├── tenant.store.ts
│   │   │       └── notification.store.ts
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   ├── frontend-portal/                     # Portal do Cliente (Next.js)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/page.tsx
│   │   │   │   │   ├── activate/page.tsx    # Primeiro acesso
│   │   │   │   │   └── forgot-password/page.tsx
│   │   │   │   ├── portal/
│   │   │   │   │   ├── page.tsx             # Home do portal
│   │   │   │   │   ├── layout.tsx
│   │   │   │   │   ├── devices/page.tsx
│   │   │   │   │   ├── tickets/
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   ├── new/page.tsx
│   │   │   │   │   │   └── [id]/page.tsx
│   │   │   │   │   ├── chat/page.tsx
│   │   │   │   │   ├── reports/page.tsx
│   │   │   │   │   ├── users/page.tsx       # admin_cliente
│   │   │   │   │   └── settings/page.tsx
│   │   │   │   └── terms/page.tsx           # Aceite de termos LGPD
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   ├── hooks/
│   │   │   └── stores/
│   │   ├── package.json
│   │   └── tailwind.config.ts
│   │
│   └── agent-windows/                       # Agente Windows (C# .NET 8)
│       └── MIConectaAgent/
│           ├── Services/
│           │   ├── SystemInfoCollector.cs
│           │   ├── MetricsCollector.cs
│           │   ├── SoftwareInventoryCollector.cs
│           │   ├── WindowsUpdateChecker.cs
│           │   ├── ScriptExecutor.cs
│           │   ├── ApiClient.cs
│           │   ├── HeartbeatService.cs
│           │   ├── CommandPollingService.cs
│           │   ├── ChatService.cs           # NOVO
│           │   ├── ConsentService.cs         # NOVO
│           │   ├── RemoteSessionService.cs   # NOVO
│           │   ├── OfflineQueueService.cs    # NOVO
│           │   └── AutoUpdateService.cs      # NOVO
│           ├── UI/
│           │   ├── TrayIcon.cs
│           │   ├── ChatWindow.xaml           # WPF
│           │   ├── ChatWindow.xaml.cs
│           │   ├── ConsentDialog.xaml        # WPF
│           │   └── ConsentDialog.xaml.cs
│           ├── Models/
│           ├── MIConectaAgent.csproj
│           └── Program.cs
│
├── packages/
│   ├── shared-types/                        # Tipos TypeScript compartilhados
│   │   ├── src/
│   │   │   ├── enums.ts                     # DeviceStatus, TicketStatus, etc.
│   │   │   ├── dto/                         # DTOs compartilhados
│   │   │   │   ├── auth.dto.ts
│   │   │   │   ├── ticket.dto.ts
│   │   │   │   ├── chat.dto.ts
│   │   │   │   ├── device.dto.ts
│   │   │   │   └── session.dto.ts
│   │   │   ├── events/                      # Tipos de eventos WebSocket
│   │   │   │   ├── chat.events.ts
│   │   │   │   ├── alert.events.ts
│   │   │   │   ├── device.events.ts
│   │   │   │   ├── ticket.events.ts
│   │   │   │   ├── session.events.ts
│   │   │   │   └── agent.events.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── contracts/                           # Contratos de API (OpenAPI/zod)
│   │   ├── src/
│   │   │   ├── api/                         # Schemas de request/response
│   │   │   └── websocket/                   # Schemas de eventos WS
│   │   └── package.json
│   │
│   └── ui/                                  # Componentes UI compartilhados
│       ├── src/
│       │   ├── components/                  # shadcn/ui customizados
│       │   └── styles/                      # Tema Tailwind compartilhado
│       └── package.json
│
├── docs/
│   ├── ARQUITETURA-v2.md
│   ├── ARQUITETURA-TECNICA-v2.md
│   ├── PARTE-A-ARQUITETURA-MACRO.md
│   ├── PARTE-B-MULTITENANT.md
│   ├── ... (demais partes)
│   └── api/                                 # Swagger/OpenAPI exportado
│
├── infra/
│   ├── docker-compose.yml                   # Dev local
│   ├── docker-compose.prod.yml              # Produção
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend-maginf
│   ├── Dockerfile.frontend-portal
│   └── nginx/
│       └── nginx.conf
│
├── installer/
│   └── MIConectaRMMSetup.iss                # Inno Setup
│
├── turbo.json                               # Turborepo config
├── package.json                             # Root workspace
├── pnpm-workspace.yaml                      # PNPM workspaces
└── README.md
```

## I.2 Decisão: Monorepo com Turborepo + PNPM

| Opção | Prós | Contras | Veredicto |
|---|---|---|---|
| **Turborepo + PNPM** | Cache inteligente, builds paralelos, workspaces nativos | Curva de aprendizado | ✅ **Escolhido** |
| **Nx** | Muito poderoso | Overhead grande, opinativo demais | ❌ Overkill |
| **Lerna** | Maduro | Manutenção irregular, PNPM melhor | ❌ Legado |
| **Repos separados** | Simples | Sem compartilhamento de tipos, deploy complexo | ❌ Fragmentado |

### Justificativa
- `shared-types` garante que frontend e backend usem os mesmos tipos
- Builds paralelos aceleram CI/CD
- PNPM economiza espaço em disco (symlinks)
- Deploy independente: cada app é deployada separadamente

## I.3 Contratos entre Sistemas

### Agente → Backend

```typescript
// POST /api/v1/agents/register
interface AgentRegisterRequest {
  hostname: string;
  sistemaOperacional: string;
  cpu: string;
  ramTotalMb: number;
  discoTotalMb: number;
  discoDisponivelMb: number;
  ipLocal: string;
  ipExterno: string;
  modeloMaquina?: string;
  numeroSerie?: string;
  agentVersion: string;
}

interface AgentRegisterResponse {
  deviceId: string;
  deviceToken: string;
  tenantId: string;
  configuracoes: {
    heartbeatIntervalMs: number;    // default: 60000
    inventoryIntervalMs: number;    // default: 21600000 (6h)
    screenshotEnabled: boolean;
    screenshotIntervalMs: number;
  };
}

// POST /api/v1/agents/heartbeat
interface AgentHeartbeatRequest {
  deviceId: string;
  cpuPercent: number;
  ramPercent: number;
  ramUsadaMb: number;
  discoPercent: number;
  discoUsadoMb?: number;
  temperatura?: number;
  uptimeSegundos: number;
  redeEntradaBytes?: number;
  redeSaidaBytes?: number;
  antivirusStatus?: string;
  antivirusNome?: string;
}

interface AgentHeartbeatResponse {
  status: 'ok';
  commands: AgentCommand[];
}

interface AgentCommand {
  id: string;
  tipo: 'executar_script' | 'instalar_software' | 'coletar_inventario'
      | 'solicitar_consentimento_remoto' | 'atualizar_agente';
  payload: Record<string, any>;
  prioridade: 'normal' | 'urgente';
}
```

### Frontend → Backend (Tickets)

```typescript
// POST /api/v1/tickets
interface CreateTicketRequest {
  titulo: string;
  descricao: string;
  prioridade: 'baixa' | 'media' | 'alta' | 'urgente';
  categoriaId?: string;
  deviceId?: string;
  organizationId?: string;
}

interface TicketResponse {
  id: string;
  numero: number;
  titulo: string;
  descricao: string;
  status: TicketStatus;
  prioridade: TicketPrioridade;
  origem: TicketOrigem;
  criadoPor: { id: string; nome: string; tipo: string };
  atribuidoA?: { id: string; nome: string };
  device?: { id: string; hostname: string; status: string };
  organization?: { id: string; nome: string };
  slaRespostaEm?: string;
  slaResolucaoEm?: string;
  avaliacaoNota?: number;
  criadoEm: string;
  atualizadoEm: string;
}

// GET /api/v1/tickets/:id/timeline
interface TimelineItem {
  tipo: 'chat_message' | 'nota_interna' | 'mudanca_status'
      | 'sessao_remota' | 'script_executado' | 'anexo' | 'avaliacao';
  criadoEm: string;
  autorNome: string;
  autorTipo: 'technician' | 'client_user' | 'system' | 'agent';
  conteudo: string;
  visivelCliente: boolean;
  metadata?: Record<string, any>;
}
```

### WebSocket Events (Contratos)

```typescript
// === /chat namespace ===
interface ChatSendMessage {
  ticketId: string;
  conteudo: string;
  tipo: 'texto' | 'imagem' | 'arquivo';
  arquivoUrl?: string;
  arquivoNome?: string;
}

interface ChatNewMessage {
  id: string;
  ticketId: string;
  remetenteNome: string;
  remetenteTipo: 'technician' | 'client_user' | 'agent' | 'system';
  tipo: 'texto' | 'imagem' | 'arquivo' | 'sistema';
  conteudo: string;
  arquivoUrl?: string;
  criadoEm: string;
}

interface ChatTyping {
  ticketId: string;
  userId: string;
  nome: string;
  isTyping: boolean;
}

// === /sessions namespace ===
interface SessionConsentRequest {
  sessionId: string;
  deviceId: string;
  technicianName: string;
  motivo: string;
  ticketNumero?: number;
}

interface SessionConsentResponse {
  sessionId: string;
  consentido: boolean;
  usuarioLocal?: string;
  timestamp: string;
  ip?: string;
}

// === /agent namespace ===
interface AgentCommandEvent {
  id: string;
  tipo: string;
  payload: Record<string, any>;
}

interface AgentCommandResultEvent {
  commandId: string;
  sucesso: boolean;
  resultado?: string;
  erro?: string;
  duracaoMs: number;
}

// === /notifications namespace ===
interface NotificationNew {
  id: string;
  tipo: string;
  titulo: string;
  conteudo: string;
  link?: string;
  criadoEm: string;
}
```
