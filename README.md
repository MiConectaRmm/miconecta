# MIConectaRMM Enterprise v2

**by Maginf Tecnologia** | Plataforma completa de RMM + Help Desk para MSPs

---

## Visao Geral

O **MIConecta** e uma plataforma completa de **Remote Monitoring and Management (RMM)** combinada com **Help Desk** multi-tenant, desenvolvida para a **Maginf Tecnologia** gerenciar de forma centralizada todos os clientes (empresas), seus dispositivos, chamados, acessos remotos e mais.

### O que o sistema faz

- **Monitoramento de dispositivos** — CPU, RAM, disco, uptime em tempo real
- **Alertas automaticos** — Notificacoes quando metricas ultrapassam limites
- **Help Desk completo** — Tickets com SLA, chat em tempo real, timeline unificada
- **Acesso remoto** — Conexao via RustDesk com consentimento do usuario (LGPD)
- **Execucao remota de scripts** — PowerShell/CMD/Batch em dispositivos remotos
- **Deploy de software** — Pacotes e instalacoes remotas
- **Gerenciamento de patches** — Windows Update centralizado
- **Portal do cliente** — Interface para clientes abrirem chamados e acompanharem
- **Agente Windows** — Servico + Tray app instalado nos PCs monitorados
- **Relatorios e auditoria** — Export CSV/JSON, log de todas as acoes
- **Conformidade LGPD** — Consentimento, DSAR, retencao de dados

---

## Stack Tecnologica

| Componente | Tecnologia | Hospedagem |
|---|---|---|
| **Backend API** | NestJS 10 + TypeORM + PostgreSQL 16 | Fly.io (gru - Sao Paulo) |
| **Frontend** | Next.js 14 + Tailwind CSS + Zustand | Fly.io (gru) |
| **Database** | PostgreSQL 16 | Fly.io Postgres (gru) |
| **Agente Windows** | C# .NET 8 Windows Service + Tray App | Instalado nos PCs clientes |
| **Acesso Remoto** | RustDesk (self-hosted) | 136.248.114.218 |
| **Storage** | Cloudflare R2 (S3-compatible) | Cloudflare |
| **WebSocket** | Socket.IO via NestJS Gateway | Fly.io |
| **Installer** | WiX / Inno Setup | Gera .msi para distribuicao |

## URLs de Producao

| Componente | URL |
|---|---|
| **Frontend (Dashboard + Portal)** | https://miconecta-frontend.fly.dev |
| **Backend API** | https://miconecta-backend.fly.dev/api/v1 |
| **Health Check** | https://miconecta-backend.fly.dev/health |
| **Swagger (dev only)** | http://localhost:3000/api/docs |
| **GitHub** | https://github.com/MiConectaRmm/miconecta |
| **RustDesk** | remoto.maginf.com.br (136.248.114.218:21115-21119) |

---

## Estrutura do Monorepo

```
miconecta/
├── backend/                       NestJS API (20 modulos, 28 entidades)
│   ├── src/
│   │   ├── common/                Guards, interceptors, decorators, middlewares, filters
│   │   ├── database/entities/     28 entidades TypeORM
│   │   ├── modules/               20 modulos (ver detalhes abaixo)
│   │   ├── app.module.ts          Root module
│   │   └── main.ts                Bootstrap (Helmet, Validation, CORS, health)
│   ├── Dockerfile
│   ├── fly.toml
│   └── package.json
│
├── frontend/                      Next.js 14 (~35 paginas)
│   ├── src/
│   │   ├── app/
│   │   │   ├── login/             Login unificado (tecnico + cliente)
│   │   │   ├── dashboard/         Painel Maginf (20+ paginas)
│   │   │   └── portal/            Portal do Cliente (9 paginas)
│   │   ├── components/            Sidebar, StatusBadge, StatCard, Modal, etc
│   │   ├── hooks/                 usePermissions, useSocket, useChatSocket
│   │   ├── stores/                Zustand auth store
│   │   └── lib/api.ts             Cliente Axios (17 modulos de API)
│   ├── Dockerfile
│   ├── fly.toml
│   └── package.json
│
├── agent/                         .NET 8 (self-contained, win-x64)
│   ├── MIConectaAgent/            Windows Service (21 services)
│   ├── MIConectaAgent.Tray/       Tray App (icone bandeja + chat nativo)
│   ├── MIConectaAgent.sln
│   └── atualizar-agente.ps1       Script de atualizacao local
│
├── installer/                     Gerador de .msi
│   ├── wix/                       WiX toolset config
│   ├── scripts/                   desinstalar-miconecta.ps1 / .bat (desinstalacao geral MSI)
│   └── assets/                    Icones e recursos
│
├── docs/                          Documentacao tecnica (14 arquivos)
├── docker-compose.yml             Stack local (Postgres + Redis + Backend + Frontend)
├── build-agent.ps1                Script de build do agente
├── create-admin.js                Script para criar admin inicial
└── check-rustdesk.js              Verificador de conexao RustDesk
```

---

## Backend — 20 Modulos NestJS

### Modulos e Funcionalidades

| Modulo | Descricao | Principais Endpoints |
|---|---|---|
| **auth** | Login, refresh, logout, JWT, AgentAuth | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| **roles** | RBAC com 9 roles e permissoes granulares | `GET /roles`, `GET /roles/:id/permissions` |
| **tenants** | Clientes (empresas) + Organizacoes + consulta CNPJ | `GET/POST/PUT/DELETE /tenants`, `GET /tenants/cnpj/:cnpj` |
| **users** | Tecnicos Maginf + Usuarios Portal do cliente | `GET/POST/PUT /users/technicians`, `GET/POST /users/clients` |
| **devices** | Dispositivos monitorados + inventario | `GET/POST/PUT/DELETE /devices`, `GET /devices/:id/inventario` |
| **agents** | Provisionamento, heartbeat, comandos, scripts install | `POST /agents/provision`, `GET /agents/install-script/:tenantId` |
| **metrics** | Metricas CPU, RAM, disco por dispositivo | `GET /metrics/:deviceId`, `GET /metrics/:deviceId/ultima` |
| **alerts** | Alertas por threshold com WebSocket broadcast | `GET /alerts`, `PUT /alerts/:id/reconhecer`, `PUT /alerts/:id/resolver` |
| **tickets** | Tickets + SLA + atribuicao + workflow completo | `GET/POST /tickets`, `PUT /tickets/:id/resolver`, `PUT /tickets/:id/atribuir` |
| **tickets (timeline)** | UnifiedTimeline + resumo IA do ticket | `GET /tickets/:id/timeline`, `GET /tickets/:id/resumo` |
| **chat** | Chat por ticket (WebSocket + REST) | `GET/POST /chat/tickets/:id/messages`, `PUT /chat/tickets/:id/read-all` |
| **remote-sessions** | Sessoes remotas com policy, consentimento, evidencias | `POST /remote-sessions`, `PUT /remote-sessions/:id/start` |
| **scripts** | CRUD de scripts + execucao remota em dispositivos | `GET/POST /scripts`, `POST /scripts/:id/executar` |
| **software** | Pacotes + deploy remoto | `GET/POST /software/packages`, `POST /software/deploy` |
| **patches** | Windows Update centralizado | `GET /patches/device/:id`, `PUT /patches/:id/instalar` |
| **audit** | Log de auditoria de todas as acoes | `GET /audit` |
| **notifications** | Notificacoes in-app | `GET /notifications`, `PUT /notifications/read-all` |
| **reports** | Relatorios executivo, tecnico, disponibilidade + export | `GET /reports/executivo`, `GET /reports/export/dispositivos` |
| **storage** | Upload de arquivos via S3/R2 (presigned URLs) | `POST /storage/upload`, `GET /storage/:id/url` |
| **lgpd** | DSAR, consentimentos, politicas de retencao | `GET/POST /lgpd/solicitacoes`, `GET /lgpd/consentimentos` |
| **gateway** | WebSocket gateway (Socket.IO) | Salas: `ticket:*`, `atendimento`, `rmm` |

### 28 Entidades (TypeORM)

| Entidade | Descricao |
|---|---|
| `Tenant` | Empresa/cliente (multi-tenant root) |
| `Organization` | Sub-organizacao dentro do tenant |
| `Technician` | Tecnico da Maginf |
| `ClientUser` | Usuario do portal do cliente |
| `Device` | Dispositivo monitorado (PC, servidor) |
| `DeviceMetric` | Metricas (CPU, RAM, disco) por dispositivo |
| `DeviceInventory` | Inventario de hardware/software do dispositivo |
| `Agent` | Agente instalado no dispositivo |
| `Alert` | Alerta gerado por threshold |
| `Ticket` | Chamado de suporte |
| `TicketComment` | Comentario/nota interna no ticket |
| `ChatMessage` | Mensagem de chat por ticket |
| `RemoteSession` | Sessao de acesso remoto |
| `RemoteSessionLog` | Log de eventos da sessao remota |
| `Script` | Script (PowerShell/CMD/Batch) |
| `ScriptExecution` | Execucao de script em dispositivo |
| `SoftwarePackage` | Pacote de software para deploy |
| `SoftwareDeployment` | Deploy de software em dispositivo |
| `Patch` | Windows Update patch |
| `AuditLog` | Log de auditoria |
| `Notification` | Notificacao in-app |
| `ReportSchedule` | Agendamento de relatorio |
| `FileAttachment` | Arquivo anexado (S3/R2) |
| `Session` | Sessao de login |
| `InstallationToken` | Token para instalacao de agente |
| `ConsentRecord` | Registro de consentimento LGPD |
| `LgpdRequest` | Solicitacao DSAR (direito do titular) |

---

## Frontend — Dashboard Maginf (Tecnico/Admin)

### Navegacao Principal (Sidebar)

| Item | Rota | Visivel para |
|---|---|---|
| Dashboard | `/dashboard` | Todos |
| Central de Atendimento | `/dashboard/atendimento` | Todos |
| Clientes | `/dashboard/clients` | Todos |
| Chat Multi | `/dashboard/chat` | Todos |
| Tecnicos | `/dashboard/technicians` | Super Admin / Admin |
| Configuracoes | `/dashboard/settings` | Super Admin / Admin |

### Paginas do Dashboard

| Pagina | Rota | Funcionalidade |
|---|---|---|
| **Dashboard** | `/dashboard` | Painel executivo: stats, saude por cliente, atividade recente |
| **Central de Atendimento** | `/dashboard/atendimento` | Inbox unificado (tickets + alertas) com WebSocket real-time |
| **Chat Multi** | `/dashboard/chat` | Chat multi-ticket simultaneo com botoes Conectar e Finalizar |
| **Clientes** | `/dashboard/clients` | Lista de empresas com busca e filtros |
| **Detalhe Cliente** | `/dashboard/clients/[id]` | Hub com 10 abas (ver abaixo) |
| **Dispositivos** | `/dashboard/devices` | Todos dispositivos cross-tenant com metricas |
| **Detalhe Dispositivo** | `/dashboard/devices/[id]` | Info completa + metricas real-time + acesso remoto |
| **Alertas** | `/dashboard/alerts` | Alertas globais com acoes |
| **Tickets** | `/dashboard/tickets` | Tickets globais |
| **Detalhe Ticket** | `/dashboard/tickets/[id]` | Chat + timeline + atribuicao + workflow |
| **Scripts** | `/dashboard/scripts` | Biblioteca de scripts global |
| **Software** | `/dashboard/software` | Pacotes e deploys |
| **Patches** | `/dashboard/patches` | Windows Update global |
| **Relatorios** | `/dashboard/reports` | Executivo, tecnico, disponibilidade + export CSV/JSON |
| **Auditoria** | `/dashboard/audit` | Log de todas as acoes do sistema |
| **Tecnicos** | `/dashboard/technicians` | CRUD de tecnicos Maginf |
| **Configuracoes** | `/dashboard/settings` | 5 abas: Geral, Scripts, Patches, LGPD, Integracoes |

### Hub do Cliente — 10 Abas

Cada empresa tem uma pagina de detalhe com 10 abas:

| Aba | Funcionalidade |
|---|---|
| **Cadastro** | Dados da empresa, endereco, CNPJ, config agente, tokens, download scripts |
| **Usuarios Portal** | CRUD de usuarios do portal com limite dinamico por plano |
| **Dispositivos** | Lista com stats, filtros, botao CONECTAR (RustDesk), auto-refresh 15s |
| **Instalar Agente** | Download MSI, scripts .bat/.ps1, instrucoes de instalacao |
| **Alertas** | Alertas do cliente com acoes (reconhecer, resolver) |
| **Tickets** | Tickets do cliente + criar ticket no contexto |
| **Scripts** | Biblioteca de scripts + executar em dispositivos do cliente |
| **Software** | Pacotes + deploy em dispositivos |
| **Patches** | Windows Update por dispositivo |
| **Sessoes** | Sessoes remotas + iniciar nova sessao |

### Chat Multi (Tecnico)

O chat multi permite ao tecnico:
- Ver todos os tickets ativos com chat em uma lista lateral
- Conversar com multiplos clientes simultaneamente
- **Botao Conectar** — abre RustDesk para acesso remoto ao dispositivo do ticket
- **Botao Finalizar** — finaliza o chamado e remove da lista ativa (vai pro historico)
- Notificacoes sonoras para novas mensagens
- WebSocket real-time + fallback polling 60s
- Indicador de conexao WS (online/offline)

---

## Frontend — Portal do Cliente

Interface acessivel pelos usuarios do cliente para autoatendimento.

| Pagina | Rota | Funcionalidade |
|---|---|---|
| **Dashboard** | `/portal` | Visao geral: dispositivos, tickets abertos, alertas |
| **Dispositivos** | `/portal/devices` | Lista de dispositivos da empresa |
| **Detalhe Dispositivo** | `/portal/devices/[id]` | Info e metricas |
| **Tickets** | `/portal/tickets` | Abrir e acompanhar chamados |
| **Detalhe Ticket** | `/portal/tickets/[id]` | Chat + timeline + botao **Finalizar Chamado** |
| **Chat** | `/portal/chat` | Lista de chamados ativos para conversar |
| **Sessoes Remotas** | `/portal/sessions` | Historico de acessos remotos ao dispositivo |
| **Relatorios** | `/portal/reports` | Relatorios da empresa |
| **Usuarios** | `/portal/users` | Gerenciar usuarios do portal |
| **Historico** | `/portal/history` | Historico de chamados finalizados |

### Funcionalidades do Portal

- **Abrir chamado** — com titulo, descricao e prioridade
- **Chat por ticket** — conversar com tecnico em tempo real (WebSocket)
- **Finalizar chamado** — botao no detalhe do ticket (remove da lista ativa, fica no historico)
- **Timeline** — ver tudo que foi feito no ticket
- **Consentimento remoto** — aprovar/recusar acesso remoto via popup

---

## Agente Windows (.NET 8)

### MIConectaAgent (Windows Service)

Servico Windows que roda em background nos dispositivos monitorados.

| Service | Funcionalidade |
|---|---|
| **HeartbeatService** | Envia heartbeat periodico para o backend |
| **MetricsCollector** | Coleta CPU, RAM, disco e envia metricas |
| **SystemInfoCollector** | Coleta info do sistema (SO, hardware, rede) |
| **SoftwareInventoryCollector** | Lista de software instalado |
| **WindowsUpdateChecker** | Verifica Windows Updates pendentes |
| **ScriptExecutor** | Executa scripts PowerShell/CMD recebidos do backend |
| **CommandPollingService** | Polling de comandos pendentes |
| **ConsentManager** | Gerencia consentimento de acesso remoto |
| **ChatService** | Comunicacao de chat com backend |
| **ChatNotificationService** | Notificacoes de chat para o usuario |
| **AutoUpdater** | Atualizacao automatica do agente |
| **LocalQueue** | Fila local para resiliencia offline |
| **QueueProcessor** | Processa fila local quando online |
| **RealtimeClient** | Conexao WebSocket com backend |
| **RemoteSessionHandler** | Gerencia sessoes remotas no dispositivo |
| **RustDeskIntegrationService** | Integracao com RustDesk |
| **AgentIdentityService** | Identidade e registro do agente |
| **ApiClient** | Cliente HTTP para comunicacao com backend |
| **LocalStateStore** | Persistencia de estado local |
| **ModuleSupervisor** | Supervisao de modulos do agente |
| **TelemetryService** | Telemetria e diagnostico |

### MIConectaAgent.Tray (Tray App)

Aplicativo da bandeja do sistema (system tray) para interacao do usuario.

| Componente | Funcionalidade |
|---|---|
| **TrayApplicationContext** | Icone na bandeja + menu de contexto |
| **ChatForm** | Interface nativa de chat com suporte |
| **ChatApiClient** | Cliente REST para chat (usando headers x-device-id, x-agent-token) |
| **SatisfacaoDialog** | Dialog de avaliacao ao finalizar chamado |

#### Chat Nativo no Agente

O chat nativo permite que o usuario do dispositivo:
- Veja seus tickets ativos
- Crie novos chamados
- Converse com o tecnico
- **Finalize chamados** (com avaliacao de satisfacao)
- Receba notificacoes de novas mensagens

### Configuracao do Agente

Arquivo `agent.config` em `C:\Program Files\MIConecta\`:

```ini
ServerUrl=https://miconecta-backend.fly.dev
TenantId=<uuid>
ProvisionToken=<token>
DeviceId=<uuid>          # preenchido apos registro
DeviceToken=<jwt>        # preenchido apos registro
RustDeskServer=136.248.114.218
RustDeskKey=ev3ic04E+VsgunfupaellTSWgSzmHiQL2H5ywzBE+yI=
```

### Build do Agente

```bash
# Agente (Windows Service) — self-contained, inclui todas DLLs
cd agent/MIConectaAgent
dotnet publish -c Release -r win-x64 --self-contained

# Tray App — self-contained
cd agent/MIConectaAgent.Tray
dotnet publish -c Release -r win-x64 --self-contained
```

---

## Seguranca

| Camada | Implementacao |
|---|---|
| **Autenticacao** | JWT 15min + refresh token 7d com rotacao, bcrypt cost 12 |
| **RBAC** | 9 roles, 3 guards (RolesGuard, PermissionsGuard, TenantAccessGuard) |
| **Multi-tenant** | Row-level isolation via `tenantId`, TenantValidationSubscriber |
| **API** | Helmet, rate limit 100/min, ValidationPipe, CORS restrito |
| **Auditoria** | AuditInterceptor, CorrelationId, IP tracking em todas as acoes |
| **LGPD** | ConsentRecord, DSAR workflow, classificacao de dados, retencao |
| **Sessoes Remotas** | Policy engine (servidor vs estacao), popup de consentimento, evidencias |
| **Agente** | JWT dedicado (x-agent-token), registro com provision token |

## RBAC — 9 Roles

### Roles Maginf (Tecnicos)

| Role | Descricao | Acesso |
|---|---|---|
| `super_admin` | Dono / Admin Total | Cross-tenant, todas as funcionalidades |
| `admin_maginf` | Admin Maginf | Gestao de todos os clientes |
| `admin` | Admin legado | Mapeado para compatibilidade |
| `tecnico_senior` | Tecnico Senior | Acesso avancado + servidores |
| `tecnico` | Tecnico | Suporte basico |
| `visualizador` | Somente leitura | Visualizar sem modificar |

### Roles Cliente (Portal)

| Role | Descricao | Acesso |
|---|---|---|
| `admin_cliente` | Admin do tenant | Gerenciar usuarios, ver tudo |
| `gestor` | Gestor operacional | Abrir tickets, ver relatorios |
| `usuario` | Usuario final | Abrir tickets, usar chat |

---

## WebSocket (Tempo Real)

O sistema usa Socket.IO com namespaces:

| Namespace | Uso | Eventos principais |
|---|---|---|
| `/chat` | Chat de tickets + Central de Atendimento | `message:new`, `ticket:new`, `ticket:join` |
| `/rmm` | Monitoramento e sessoes remotas | `session:started`, `session:denied`, `session:updated` |

### Salas

| Sala | Quem entra | Proposito |
|---|---|---|
| `ticket:{ticketId}` | Tecnico + Cliente | Chat do ticket especifico |
| `atendimento` | Todos tecnicos | Broadcast de novos tickets/alertas |
| `tenant:{tenantId}` | Usuarios do tenant | Notificacoes por empresa |

### Eventos Emitidos

- `message:new` — Nova mensagem de chat
- `message:send` — Enviar mensagem (cliente → servidor)
- `ticket:new` — Novo ticket criado
- `atendimento:update` — Atualizacao na central (ticket, alerta, mensagem)
- `atendimento:ticket_updated` — Status do ticket mudou
- `notification:new` — Nova notificacao
- `session:started` — Sessao remota aprovada
- `session:denied` — Sessao remota recusada

---

## Fluxos Principais

### 1. Instalacao do Agente

```
1. Admin cria o cliente (tenant) no dashboard
2. Na aba "Instalar Agente", baixa o script .ps1 ou .bat
3. Tecnico executa o script no PC do cliente (como Admin)
4. Script instala MSI + configura agent.config + inicia servico
5. Agente se registra no backend (recebe DeviceId + DeviceToken)
6. Dispositivo aparece no dashboard
```

### 2. Abertura e Resolucao de Ticket

```
1. Cliente abre ticket (via Portal ou via Agente Tray)
2. Ticket aparece na Central de Atendimento do tecnico (WebSocket)
3. Tecnico atribui pra si e inicia chat
4. Tecnico pode se conectar ao dispositivo (botao Conectar → RustDesk)
5. Tecnico ou cliente finaliza o chamado (botao Finalizar)
6. Ticket some da lista ativa de ambos os lados
7. Ticket fica disponivel apenas no historico com timeline completa
```

### 3. Acesso Remoto

```
1. Tecnico clica "Conectar" no chat ou no dispositivo
2. Backend cria RemoteSession e notifica agente via WebSocket
3. Agente mostra popup de consentimento ao usuario
4. Usuario aprova → backend notifica tecnico → abre RustDesk
5. Sessao registrada com logs, evidencias e duracao
```

### 4. Execucao de Script Remoto

```
1. Tecnico seleciona script na biblioteca
2. Escolhe dispositivos alvos
3. Backend envia comando via polling/WebSocket
4. Agente executa (PowerShell/CMD) e retorna resultado
5. Resultado registrado no historico
```

---

## Deploy em Producao (Fly.io)

Toda a stack roda no Fly.io, regiao `gru` (Sao Paulo).

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
| `DB_SSL` | `true` |
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

PostgreSQL 16 gerenciado pelo Fly.io, conectado via `fly postgres attach`.

---

## Desenvolvimento Local

### Pre-requisitos

- Node.js 18+
- .NET 8 SDK
- Docker (para Postgres + Redis)

### Subir tudo com Docker

```bash
docker-compose up -d    # Postgres + Redis + Backend + Frontend
```

### Subir individualmente

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

# Agente (build)
cd agent/MIConectaAgent
dotnet publish -c Release -r win-x64 --self-contained
```

### Criar admin inicial

```bash
node create-admin.js
```

---

## RustDesk (Acesso Remoto)

| Item | Valor |
|---|---|
| **Servidor** | 136.248.114.218 |
| **Dominio** | remoto.maginf.com.br |
| **Portas** | 21115-21119 |
| **Protocolo** | `rustdesk://connection/new/{rustdeskId}` |

O RustDesk e self-hosted e integrado com o sistema:
- Agente envia o `rustdeskId` no registro
- Tecnico clica "Conectar" em qualquer lugar (chat, dispositivo, sessoes)
- Sistema registra sessao com consentimento, logs e evidencias

---

## API Reference Rapida

### Autenticacao

```
POST   /api/v1/auth/login          { email, senha }
POST   /api/v1/auth/refresh         { refreshToken }
GET    /api/v1/auth/me              → usuario logado
```

### Tenants (Clientes)

```
GET    /api/v1/tenants              → lista de empresas
POST   /api/v1/tenants              → criar empresa
GET    /api/v1/tenants/:id          → detalhe
PUT    /api/v1/tenants/:id          → atualizar
DELETE /api/v1/tenants/:id          → remover
GET    /api/v1/tenants/cnpj/:cnpj   → consulta BrasilAPI
```

### Dispositivos

```
GET    /api/v1/devices              → lista (filtros: tenantId, status, busca)
GET    /api/v1/devices/:id          → detalhe
GET    /api/v1/devices/resumo       → contagem por status
GET    /api/v1/devices/:id/inventario → inventario hw/sw
```

### Tickets

```
GET    /api/v1/tickets              → lista (filtros: status, prioridade, busca)
POST   /api/v1/tickets              → criar
GET    /api/v1/tickets/:id          → detalhe
PUT    /api/v1/tickets/:id/resolver → resolver/finalizar
PUT    /api/v1/tickets/:id/atribuir → atribuir tecnico
GET    /api/v1/tickets/:id/timeline → timeline unificada
GET    /api/v1/tickets/:id/resumo   → resumo IA
POST   /api/v1/tickets/:id/avaliar  → avaliacao satisfacao
```

### Chat

```
GET    /api/v1/chat/tickets/:id/messages   → mensagens do ticket
POST   /api/v1/chat/tickets/:id/messages   → enviar mensagem
PUT    /api/v1/chat/tickets/:id/read-all   → marcar todas como lidas
```

### Sessoes Remotas

```
POST   /api/v1/remote-sessions             → solicitar sessao
PUT    /api/v1/remote-sessions/:id/start   → iniciar
PUT    /api/v1/remote-sessions/:id/end     → finalizar
PUT    /api/v1/remote-sessions/:id/consent → consentimento
GET    /api/v1/remote-sessions/:id/logs    → logs da sessao
```

### Relatorios + Export

```
GET    /api/v1/reports/executivo                      → relatorio executivo
GET    /api/v1/reports/tecnico                        → relatorio tecnico
GET    /api/v1/reports/disponibilidade                → disponibilidade
GET    /api/v1/reports/export/dispositivos?formato=csv → export CSV
GET    /api/v1/reports/export/tickets?formato=json     → export JSON
```

---

## Documentacao Tecnica

| Documento | Descricao |
|---|---|
| [`AI_CONTEXT.md`](./AI_CONTEXT.md) | Estado atual do projeto para assistentes de IA |
| [`FLY_MIGRATION.md`](./FLY_MIGRATION.md) | Guia de migracao e deploy no Fly.io |
| [`docs/ARQUITETURA-v2.md`](./docs/ARQUITETURA-v2.md) | Arquitetura completa do sistema |
| [`docs/PARTE-A-ARQUITETURA-MACRO.md`](./docs/PARTE-A-ARQUITETURA-MACRO.md) | Arquitetura macro |
| [`docs/PARTE-B-MULTITENANT.md`](./docs/PARTE-B-MULTITENANT.md) | Multi-tenancy |
| [`docs/PARTE-C-MODULOS.md`](./docs/PARTE-C-MODULOS.md) | Modulos detalhados |
| [`docs/PARTE-D-AGENTE.md`](./docs/PARTE-D-AGENTE.md) | Agente Windows |
| [`docs/PARTE-E-REALTIME.md`](./docs/PARTE-E-REALTIME.md) | WebSocket e tempo real |
| [`docs/PARTE-F-AUDITORIA.md`](./docs/PARTE-F-AUDITORIA.md) | Auditoria e compliance |
| [`docs/PARTE-G-SESSAO-REMOTA.md`](./docs/PARTE-G-SESSAO-REMOTA.md) | Sessoes remotas |
| [`docs/PARTE-H-CHAT-TICKET.md`](./docs/PARTE-H-CHAT-TICKET.md) | Chat e tickets |
| [`docs/PARTE-I-MONOREPO.md`](./docs/PARTE-I-MONOREPO.md) | Estrutura do monorepo |
| [`docs/PARTE-J-DECISOES-RISCOS.md`](./docs/PARTE-J-DECISOES-RISCOS.md) | Decisoes e riscos |
| [`docs/BRANDING-ASSETS.md`](./docs/BRANDING-ASSETS.md) | Assets de marca |

---

## Licenca

Proprietario — Maginf Tecnologia (c) 2026. Todos os direitos reservados.
