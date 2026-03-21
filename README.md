# MIConectaRMM Enterprise v2

**by Maginf Tecnologia** | Monorepo: Backend + Frontend + Agent + Installer

Plataforma completa de Remote Monitoring and Management (RMM) + Help Desk para MSPs.

---

## Stack

| Componente | Tecnologia | Hospedagem |
|---|---|---|
| **Backend API** | NestJS 10 + TypeORM + PostgreSQL | Fly.io (gru) |
| **Frontend** | Next.js 14 + Tailwind + Zustand | Fly.io (gru) |
| **Database** | PostgreSQL 15 | Fly.io (gru) |
| **Agente Windows** | C# .NET 8 Windows Service | Instalado nos PCs |
| **Acesso Remoto** | RustDesk (self-hosted) | 136.248.114.218 |
| **Storage** | Cloudflare R2 (S3-compatible) | Cloudflare |

## URLs

| Componente | URL |
|---|---|
| **Frontend** | https://miconecta-frontend.fly.dev |
| **Backend API** | https://miconecta-backend.fly.dev/api/v1 |
| **Health Check** | https://miconecta-backend.fly.dev/health |
| **Swagger** | http://localhost:3000/api/docs (dev only) |
| **GitHub** | https://github.com/MiConectaRmm/miconecta |

---

## Estrutura do Monorepo

```
miconecta/
├── backend/                    NestJS API (20 modules, 27 entities)
│   ├── src/
│   │   ├── common/             Guards, interceptors, decorators, middlewares, filters
│   │   │   ├── guards/         RolesGuard, PermissionsGuard, TenantAccessGuard
│   │   │   ├── interceptors/   AuditInterceptor, TransformInterceptor
│   │   │   ├── middlewares/    CorrelationIdMiddleware
│   │   │   ├── filters/       GlobalExceptionFilter
│   │   │   ├── decorators/    @Roles, @RequirePermissions, @CurrentUser, @CurrentTenant
│   │   │   └── interfaces/    JwtPayload, etc
│   │   ├── database/
│   │   │   ├── entities/       27 TypeORM entities
│   │   │   └── subscribers/    TenantValidationSubscriber
│   │   ├── modules/
│   │   │   ├── auth/           Login, refresh, logout, JWT, AgentAuth
│   │   │   ├── roles/          RBAC (9 roles, granular permissions)
│   │   │   ├── tenants/        Tenant + Organization CRUD
│   │   │   ├── users/          Technicians + ClientUsers CRUD
│   │   │   ├── devices/        Device management
│   │   │   ├── agents/         Agent provisioning, heartbeat, commands
│   │   │   ├── metrics/        CPU, RAM, disk metrics
│   │   │   ├── alerts/         Threshold alerts
│   │   │   ├── tickets/        Tickets + UnifiedTimeline + auto-summary
│   │   │   ├── chat/           WebSocket chat + REST API
│   │   │   ├── remote-sessions/ Policy engine, consent, evidence, recording
│   │   │   ├── scripts/        Script management + execution
│   │   │   ├── software/       Package deployment
│   │   │   ├── patches/        Windows Update management
│   │   │   ├── audit/          Audit log queries
│   │   │   ├── notifications/  In-app notifications
│   │   │   ├── reports/        Executive reports
│   │   │   ├── storage/        S3/R2 presigned uploads
│   │   │   ├── lgpd/           DSAR, consent records
│   │   │   └── gateway/        WebSocket gateway
│   │   ├── app.module.ts       Root module (20 imports)
│   │   └── main.ts             Bootstrap (Helmet, ValidationPipe, CORS, health)
│   └── package.json
│
├── frontend/                   Next.js 14 (30 pages)
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/          Dual-user login
│   │   │   ├── dashboard/      Painel Maginf (18 pages)
│   │   │   └── portal/         Portal Cliente (11 pages)
│   │   ├── components/         Sidebar, StatusBadge, StatCard, Modal, EmptyState
│   │   ├── hooks/              usePermissions, useSocket, useChatSocket
│   │   ├── stores/             Zustand auth store
│   │   └── lib/                Axios API client (16 modules), utils
│   └── package.json
│
├── agent/                      .NET 8 Windows Service
│   └── MIConectaAgent/
│       ├── Services/           HeartbeatService, MetricsCollector, ScriptExecutor, etc
│       ├── AgentConfig.cs      Local configuration
│       └── Program.cs          Service host
│
├── installer/                  Inno Setup installer
│   └── MIConectaRMMSetup.iss
│
└── README.md
```

## Seguranca

| Camada | Implementacao |
|---|---|
| **Auth** | JWT 15min + refresh 7d com rotacao, bcrypt cost 12 |
| **RBAC** | 9 roles, 3 guards (Roles, Permissions, TenantAccess) |
| **Multi-tenant** | Row-level isolation, TenantValidationSubscriber |
| **API** | Helmet, rate limit 100/min, ValidationPipe, CORS restrito |
| **Audit** | AuditInterceptor, CorrelationId, IP tracking |
| **LGPD** | ConsentRecord, DSAR workflow, data classification |
| **Sessions** | Policy engine (servidor vs estacao), consent popup, evidence |

## RBAC (9 Roles)

| Role | Tipo | Descricao |
|---|---|---|
| `super_admin` | Maginf | Acesso total cross-tenant |
| `admin_maginf` | Maginf | Gestao de todos tenants |
| `admin` | Maginf | Admin legado (mapeado) |
| `tecnico_senior` | Maginf | Acesso avancado + servidores |
| `tecnico` | Maginf | Suporte basico |
| `visualizador` | Maginf | Somente leitura |
| `admin_cliente` | Cliente | Admin do tenant |
| `gestor` | Cliente | Gestor operacional |
| `usuario` | Cliente | Usuario final |

---

## Deploy em Producao (Fly.io)

Toda a stack roda no Fly.io, regiao `gru` (Sao Paulo). Veja `FLY_MIGRATION.md` para setup completo.

### Backend

```bash
cd backend
fly deploy
```

| Variavel | Valor |
|---|---|
| `DATABASE_URL` | (via `fly postgres attach`) |
| `NODE_ENV` | `production` |
| `JWT_SECRET` | (64 chars, via `fly secrets set`) |
| `JWT_EXPIRATION` | `15m` |
| `AGENT_AUTH_SECRET` | (32 chars) |
| `CORS_ORIGIN` | `https://miconecta-frontend.fly.dev` |
| `PORT` | `3000` |

### Frontend

```bash
cd frontend
fly deploy
```

| Variavel | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://miconecta-backend.fly.dev/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://miconecta-backend.fly.dev` |

### Database

PostgreSQL gerenciado pelo Fly.io, conectado via `fly postgres attach`.

---

## Desenvolvimento Local

```bash
# Backend
cd backend
npm install
cp .env.example .env
npm run start:dev       # http://localhost:3000

# Frontend
cd frontend
npm install
npm run dev             # http://localhost:3001

# Agent
cd agent/MIConectaAgent
dotnet publish -c Release -r win-x64 --self-contained
```

## RustDesk

- **Servidor:** 136.248.114.218
- **Dominio:** remoto.maginf.com.br
- **Portas:** 21115-21119

---

## Licenca

Proprietario - Maginf Tecnologia (c) 2026
