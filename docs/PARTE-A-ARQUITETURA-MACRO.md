# A. ARQUITETURA MACRO

## A.1 Diagrama de Alto Nível

```
                          ┌──────────────────────────┐
                          │        INTERNET           │
                          └─────┬──────┬─────┬───────┘
                                │      │     │
                    ┌───────────┘      │     └───────────┐
                    ▼                  ▼                  ▼
         ┌──────────────────┐ ┌──────────────┐ ┌─────────────────┐
         │ Frontend Maginf  │ │ Frontend     │ │ Agente Windows  │
         │ (Painel Interno) │ │ Portal       │ │ (C# .NET 8)     │
         │ Next.js 14       │ │ Cliente      │ │                 │
         │ Port: 3001       │ │ Next.js 14   │ │ Tray Icon +     │
         │                  │ │ Port: 3002   │ │ Chat Window +   │
         │ Roles:           │ │              │ │ Consent Dialog  │
         │ super_admin      │ │ Roles:       │ │                 │
         │ admin_maginf     │ │ admin_cliente│ │ Comunicação:    │
         │ tecnico_senior   │ │ gestor       │ │ HTTPS REST      │
         │ tecnico          │ │ usuario      │ │ WSS (Socket.IO) │
         │ visualizador     │ │              │ │                 │
         └────────┬─────────┘ └──────┬───────┘ └───────┬─────────┘
                  │                  │                  │
                  │    HTTPS/WSS     │    HTTPS/WSS     │  HTTPS/WSS
                  ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    REVERSE PROXY / LOAD BALANCER                    │
│                    (Render.com / Nginx / Cloudflare)                │
│  Rate Limiting | SSL Termination | CORS por origem | Gzip          │
└────────────────────────────┬────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND NESTJS (Node.js 20)                     │
│                     Port: 3000 | Prefixo: /api/v1                  │
│                                                                     │
│  ┌─── HTTP Pipeline ───────────────────────────────────────────┐   │
│  │  MIDDLEWARES:                                                │   │
│  │  1. RateLimitMiddleware                                     │   │
│  │  2. CorrelationIdMiddleware (X-Request-Id)                  │   │
│  │  3. TenantExtractionMiddleware (do JWT)                     │   │
│  │  4. RequestLoggerMiddleware                                 │   │
│  │                                                              │   │
│  │  GUARDS (nesta ordem):                                      │   │
│  │  1. JwtAuthGuard (valida token)                             │   │
│  │  2. RolesGuard (verifica perfil)                            │   │
│  │  3. TenantAccessGuard (verifica acesso ao tenant)           │   │
│  │  4. PermissionsGuard (verifica permissão granular)          │   │
│  │                                                              │   │
│  │  INTERCEPTORS:                                              │   │
│  │  1. AuditInterceptor (registra toda operação)               │   │
│  │  2. TransformInterceptor (padroniza response)               │   │
│  │  3. TimeoutInterceptor (30s default)                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Módulos de Negócio (20) ─────────────────────────────────┐   │
│  │  auth, users, roles, tenants, organizations, devices,       │   │
│  │  agents, metrics, alerts, tickets, chat, remote-sessions,   │   │
│  │  scripts, software, patches, reports, notifications,        │   │
│  │  storage, lgpd, audit                                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── WebSocket Gateway (Socket.IO) ──────────────────────────┐   │
│  │  Namespaces: /chat, /alerts, /devices, /tickets,           │   │
│  │              /sessions, /notifications, /agent              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─── Background Jobs (BullMQ) ───────────────────────────────┐   │
│  │  AlertEngineJob, OfflineCheckJob, SLAMonitorJob,           │   │
│  │  NotificationJob, ReportGeneratorJob,                       │   │
│  │  RetentionCleanupJob, MetricsAggregateJob                  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└──────┬──────────────┬──────────────┬───────────────────────────────┘
       │              │              │
       ▼              ▼              ▼
┌──────────┐  ┌──────────────┐  ┌───────────────┐
│PostgreSQL│  │    Redis      │  │  S3-Compatible│
│   16     │  │  (Upstash)   │  │  (Cloudflare  │
│          │  │              │  │   R2 / MinIO)  │
│ 28+      │  │ Cache        │  │               │
│ tabelas  │  │ PubSub       │  │ attachments   │
│ RLS      │  │ BullMQ       │  │ screenshots   │
│ Indexes  │  │ Sessions     │  │ reports       │
│ JSONB    │  │ Rate Limit   │  │ software      │
│ FTS      │  │ Presence     │  │ exports       │
└──────────┘  └──────────────┘  └───────────────┘
```

## A.2 Responsabilidades dos Componentes

### Frontend Maginf (Painel Interno)
- **URL produção:** `https://painel.miconecta.com.br`
- **Público:** Equipe Maginf (técnicos, admins)
- Dashboard operacional com métricas de todos os tenants
- Gestão de clientes, dispositivos, alertas
- Atendimento de tickets + chat com clientes
- Acesso remoto a dispositivos
- Execução de scripts e deploys
- Relatórios globais e por tenant
- Auditoria completa e configurações do sistema

### Frontend Portal do Cliente
- **URL produção:** `https://portal.miconecta.com.br`
- **Público:** Usuários do cliente
- Dashboard do parque tecnológico do tenant
- Abertura e acompanhamento de tickets
- Chat com equipe de suporte
- Visualização de dispositivos e alertas (somente leitura)
- Relatórios do tenant
- Gestão de usuários do tenant (admin_cliente)
- Consentimento e políticas LGPD

### Backend API
- **URL produção:** `https://api.miconecta.com.br`
- API REST para ambos os frontends e para o agente
- WebSocket gateway para real-time
- Jobs assíncronos em background
- Autenticação, autorização, isolamento multi-tenant
- Toda lógica de negócio centralizada

### Agente Windows
- **Distribuição:** Instalador .exe (Inno Setup) com token embutido
- Coleta de métricas (CPU, RAM, disco, rede)
- Inventário de hardware e software
- Heartbeat periódico + execução de scripts
- Canal de chat local (tray icon)
- Popup de consentimento para sessão remota
- Resiliência offline com fila local

## A.3 Observabilidade

```
LOGS ESTRUTURADOS (JSON via Pino)
├── correlation_id em todo request (X-Request-Id)
├── tenant_id, user_id, action em todo log
├── Níveis: error, warn, info, debug
└── Destino: stdout → Render logs (futuro: Grafana Loki)

MÉTRICAS DA APLICAÇÃO
├── Requests/segundo por rota
├── Latência P50/P95/P99
├── Erros por tipo (4xx, 5xx)
├── Jobs processados/falhos (BullMQ)
├── WebSocket conexões ativas
├── Dispositivos online/total
└── Destino: futuro Prometheus + Grafana

HEALTH CHECKS
├── GET /health       → status geral
├── GET /health/db    → PostgreSQL
├── GET /health/redis → Redis
├── GET /health/storage → S3
└── Usado por: Render auto-restart, UptimeRobot

ERROR TRACKING
└── Sentry (futuro, quando escalar)
```
