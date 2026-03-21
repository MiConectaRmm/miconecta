# 🤖 AI_CONTEXT.md — Contexto para Assistentes de IA

> **LEIA ESTE ARQUIVO PRIMEIRO.** Ele contém o estado atual do projeto, o que foi feito recentemente,
> o que está em andamento e os próximos passos. Atualizado a cada sessão de desenvolvimento com IA.

---

## 📌 Estado Atual do Projeto

**Última atualização:** 21 de Março de 2026  
**Branch:** `main`  
**Status geral:** Plataforma RMM funcional, em desenvolvimento ativo

---

## 🏗️ Arquitetura Resumida

| Componente | Tech | Localização | Módulos/Páginas |
|---|---|---|---|
| **Backend API** | NestJS 10 + TypeORM + PostgreSQL 16 | `backend/` | 20 módulos, 27 entidades |
| **Frontend** | Next.js 14 + Tailwind + Zustand | `frontend/` | ~30 páginas (dashboard + portal) |
| **Agente Windows** | C# .NET 8 Windows Service | `agent/` | 12 services |
| **Installer** | WiX + Inno Setup | `installer/` | Gera `.msi` |
| **Deploy** | Docker + Fly.io (GRU) | `docker-compose.yml` | PostgreSQL + Redis + Backend + Frontend |

### Fluxo de autenticação
- JWT 15min + Refresh Token 7d com rotação
- Dois tipos de user: `Technician` (Maginf) e `ClientUser` (Portal do Cliente)
- Login único em `/login` que redireciona para `/dashboard/` ou `/portal/`
- Tokens em `localStorage` com auto-refresh via interceptor Axios

### Multi-tenant
- Row-level isolation via `tenantId` em todas as entidades
- `TenantValidationSubscriber` valida em nível de DB
- `TenantAccessGuard` valida no request
- Header `X-Tenant-Id` para operações cross-tenant (admin)

---

## ✅ Funcionalidades Concluídas

### Backend (API)
- [x] Auth (login, refresh, logout, JWT, AgentAuth)
- [x] RBAC (9 roles, permissions granulares)
- [x] Tenants CRUD + Organizations + consulta CNPJ (BrasilAPI)
- [x] Users: Technicians CRUD + ClientUsers CRUD com **limite dinâmico por tenant**
- [x] Devices CRUD + inventário
- [x] Agents (provisioning, heartbeat, commands, installation tokens)
- [x] Metrics (CPU, RAM, disk)
- [x] Alerts (threshold alerts)
- [x] Tickets (CRUD + UnifiedTimeline + SLA + atribuição + workflow completo)
- [x] Chat (WebSocket + REST, mensagens por ticket)
- [x] Remote Sessions (policy engine, consent, evidence, recording)
- [x] Scripts (CRUD + execução remota)
- [x] Software (packages + deploy)
- [x] Patches (Windows Update management)
- [x] Audit (log de auditoria)
- [x] Notifications (in-app)
- [x] Reports (executivo, técnico, disponibilidade, export CSV/JSON)
- [x] Storage (S3/R2 presigned uploads)
- [x] LGPD (DSAR, consent records, retenção)
- [x] Gateway (WebSocket gateway)

### Frontend (Dashboard Maginf)
- [x] Login dual-user
- [x] Dashboard principal com stats
- [x] Empresas (lista + detalhe com dados, endereço, agente, tokens, orgs, usuários do portal)
- [x] Usuários do Portal integrados na página de detalhe da empresa (/dashboard/clients/[id])
- [x] Dispositivos
- [x] Tickets
- [x] Alertas
- [x] Scripts
- [x] Patches
- [x] Software deploy
- [x] Sessões remotas
- [x] Relatórios + export
- [x] Auditoria
- [x] Settings / Técnicos

### Frontend (Portal Cliente)
- [x] Dashboard do cliente
- [x] Dispositivos
- [x] Tickets (abrir, acompanhar)
- [x] Chat por ticket
- [x] Sessões remotas
- [x] Relatórios
- [x] Histórico
- [x] Gerenciar usuários do portal

### Agente Windows
- [x] Windows Service (.NET 8)
- [x] HeartbeatService
- [x] MetricsCollector
- [x] SystemInfoCollector
- [x] SoftwareInventoryCollector
- [x] WindowsUpdateChecker
- [x] ScriptExecutor
- [x] CommandPollingService
- [x] ConsentManager
- [x] ChatService
- [x] AutoUpdater
- [x] LocalQueue (resiliência offline)
- [x] Tray App

---

## 🔄 Última Sessão de Desenvolvimento (21/03/2026)

### O que foi feito
**Reestruturação completa da navegação do Dashboard (Etapa 1 + Etapa 4)**

O sidebar foi reduzido de ~13 itens para 5 itens. O Dashboard agora é um painel executivo unificado.
Uma nova página "Central de Atendimento" foi criada como inbox unificado de tickets e alertas.

#### Decisões de design (aprovadas pelo Maicon):
- **Maicon** = Super Admin / Dono da Maginf
- **Gabriel** = Técnico (atende todos os 20 clientes)
- Mesmo painel `/dashboard/` para ambos, com itens escondidos por role
- Técnicos e Configurações visíveis só para Super Admin / Admin
- Cliente é o **hub central** — tudo fica dentro do perfil da empresa
- Sidebar com **5 itens**: Dashboard, Central de Atendimento, Clientes, Técnicos*, Config*

#### Novo Sidebar:
```
📊 Dashboard              → /dashboard           (Painel executivo com saúde por cliente)
📥 Central de Atendimento → /dashboard/atendimento (Inbox de tickets + alertas, auto-refresh 30s)
👥 Clientes               → /dashboard/clients    (Lista de empresas → detalhe com tudo)
👨‍💻 Técnicos              → /dashboard/technicians (🔒 Só Super Admin / Admin)
⚙️ Configurações          → /dashboard/settings   (🔒 Só Super Admin / Admin)
```

#### Arquivos modificados:

1. **`frontend/src/components/Sidebar.tsx`** — REESCRITO
   - De ~13 itens em 4 seções para 5 itens com RBAC
   - Filtro por role (super_admin, admin, admin_maginf veem Técnicos + Config)
   - Técnicos de campo (tecnico, tecnico_senior, visualizador) veem só Dashboard + Central + Clientes
   - Mostra nome e role do usuário no footer

2. **`frontend/src/app/dashboard/page.tsx`** — REESCRITO
   - Dashboard unificado (não mais 3 componentes separados)
   - Cards: Clientes, Técnicos*, Dispositivos, Offline, Alertas, Tickets
   - Seção "Saúde por Cliente" com status (OK/Atenção/Crítico) e indicadores
   - Seção "Atividade Recente" com tickets mais recentes
   - Ações rápidas contextualizadas por role
   - Auto-refresh 30s + WebSocket
   - *Técnicos card só visível para Super Admin/Admin

3. **`frontend/src/app/dashboard/atendimento/page.tsx`** — NOVO
   - Central de Atendimento / Inbox unificado
   - Carrega tickets abertos + em andamento + alertas ativos
   - Contadores: Total, Tickets, Alertas
   - Filtros: tipo (todos/tickets/alertas), prioridade (critica/alta/media/baixa), busca textual
   - Ordenação: crítica primeiro, depois por tempo
   - Clique em ticket → abre detalhe do ticket
   - Clique em alerta → abre perfil do cliente
   - Auto-refresh a cada 30s

#### Páginas que continuam existindo (sem link no sidebar):
- `/dashboard/devices` — Dispositivos (global)
- `/dashboard/alerts` — Alertas (global)
- `/dashboard/scripts` — Scripts (global)
- `/dashboard/software` — Software (global)
- `/dashboard/patches` — Patches (global)
- `/dashboard/tickets` — Tickets (global) — acessível via Central de Atendimento
- `/dashboard/audit` — Auditoria (global)
- `/dashboard/reports` — Relatórios (global)
- `/dashboard/agent-download` — Download do agente
- `/dashboard/clientes` e `/dashboard/clientes/[id]` — Rotas antigas órfãs

### Sessão anterior (mesmo dia):
**Feature: Usuários do Portal por Cliente**
- Implementação completa do gerenciamento de usuários do portal dentro da página `/dashboard/clients/[id]`
- CRUD completo com limite dinâmico por tenant
- Removido do sidebar e dashboard links separados

---

## ⚠️ Pontos de Atenção / Dívida Técnica

| Item | Detalhe | Prioridade |
|---|---|---|
| `synchronize: true` | TypeORM em produção com synchronize — deveria usar migrations | 🔴 Alta |
| Secrets hardcoded | docker-compose com senhas default | 🔴 Alta |
| CORS `origin: '*'` | Fallback perigoso em produção | 🟡 Média |
| localStorage tokens | Vulnerável a XSS — considerar httpOnly cookies | 🟡 Média |
| Sem testes | Jest configurado mas sem `*.spec.ts` | 🟡 Média |
| Sem error boundaries | Frontend sem tratamento global de erro | 🟢 Baixa |
| maxUsuarios inconsistente | Entity default=10, Service default=5 — decidir qual é correto | 🟢 Baixa |
| Convite não envia email | `/invite` gera token mas não envia email (nodemailer não integrado) | 🟢 Baixa |
| organizationId no modal | Modal de client user não tem dropdown de organização | 🟢 Baixa |

---

## 🚀 Próximos Passos Sugeridos (backlog)

1. **Decidir limite de usuários**: Alinhar `maxUsuarios` entre entity (10) e service (5)
2. **Envio real de convite**: Integrar nodemailer no endpoint `/invite`
3. **Página de aceitar convite**: Rota pública para client user definir senha via invite token
4. **Dropdown de organizações**: No modal de criar client user, mostrar organizações do tenant
5. **Testes unitários**: Criar specs para os módulos críticos (auth, users, tickets)
6. **Migrations**: Desativar `synchronize` e criar migrations TypeORM
7. **Error boundaries**: Implementar no frontend
8. **Audit trail para client users**: Registrar CRUD de client users no log de auditoria

---

## 📂 Documentação Técnica

| Documento | Conteúdo |
|---|---|
| `README.md` | Visão geral, stack, URLs, deploy, RBAC |
| `AI_CONTEXT.md` | **ESTE ARQUIVO** — Estado atual para IAs |
| `FLY_MIGRATION.md` | Guia de deploy no Fly.io |
| `docs/ARQUITETURA-TECNICA-v2.md` | Arquitetura técnica detalhada |
| `docs/ARQUITETURA-v2.md` | Visão de arquitetura |
| `docs/PARTE-A até PARTE-J` | 10 documentos técnicos modulares |
| `docs/SESSAO-2026-03-21-USUARIOS-PORTAL.md` | Log detalhado da sessão de 21/03 |

---

## 🔑 Referência Rápida

### Endpoints principais
```
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
GET    /api/v1/tenants
GET    /api/v1/users/clients/tenant/:tenantId
GET    /api/v1/users/clients/tenant/:tenantId/contagem
GET    /api/v1/devices
GET    /api/v1/tickets
GET    /api/v1/alerts
GET    /api/v1/remote-sessions
```

### Estrutura de pastas chave
```
backend/src/modules/       ← 20 módulos NestJS
backend/src/database/entities/ ← 27 entidades TypeORM
frontend/src/app/dashboard/ ← Dashboard Maginf (~15 páginas)
frontend/src/app/portal/    ← Portal Cliente (~9 páginas)
frontend/src/lib/api.ts     ← API client Axios (16 módulos)
agent/MIConectaAgent/Services/ ← 12 services do agente
```

### Roles e permissões
```
Maginf:  super_admin > admin_maginf > admin > tecnico_senior > tecnico > visualizador
Cliente: admin_cliente > gestor > usuario
```

---

*Atualizado em 21/03/2026 por GitHub Copilot*
