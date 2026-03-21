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
- [x] Clientes (lista + detalhe com 13 abas)
- [x] Aba "Usuários do Portal" no detalhe do cliente (CRUD, limite visual, contagem)
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
**Feature: Usuários do Portal por Cliente (limite de até 5)**

Implementação completa do gerenciamento de usuários do portal dentro da página de detalhe de cada cliente.

#### Arquivos modificados:

1. **`backend/src/modules/users/users.module.ts`**
   - Adicionou `Tenant` ao `TypeOrmModule.forFeature()` 

2. **`backend/src/modules/users/client-users.service.ts`**
   - Injetou `Tenant` repository
   - Limite agora é dinâmico via `tenant.maxUsuarios` (default 5 se null)
   - Novo método `contagem(tenantId)` → retorna `{ total, ativos, inativos, limite, disponivel, atingiuLimite }`
   - Novo método `listarPorTenant(tenantId)` → ordenado por ativos primeiro

3. **`backend/src/modules/users/client-users.controller.ts`**
   - Novo endpoint: `GET /api/v1/users/clients/tenant/:tenantId` (listar por tenant)
   - Novo endpoint: `GET /api/v1/users/clients/tenant/:tenantId/contagem` (contagem + limite)

4. **`frontend/src/lib/api.ts`**
   - Novos métodos: `usersApi.listarPorTenant(tenantId)` e `usersApi.contagemPorTenant(tenantId)`

5. **`frontend/src/app/dashboard/clientes/[id]/page.tsx`**
   - Nova aba "Usuários do Portal" (tab id: `portal-users`) com:
     - Barra de progresso visual X/5 (verde/amarelo/vermelho)
     - Cards de estatísticas (Total, Ativos, Inativos, Vagas)
     - Aviso vermelho quando limite atingido
     - Lista de usuários com badges de perfil (Admin/Gestor/Usuário)
     - Modal completo de criar/editar (nome, email, senha, perfil, telefone, cargo)
     - Ações: Editar, Desativar/Reativar, Enviar convite
     - Lazy loading (carrega só quando aba é clicada)
     - Botão "Novo Usuário" bloqueado quando limite atingido

#### Detalhes técnicos:
- O limite de usuários vem de `tenant.maxUsuarios` (coluna `max_usuarios`, default entity = 10, default service = 5)
- Client users têm 3 perfis: `admin_cliente`, `gestor`, `usuario`
- Senha com bcrypt 12 rounds
- Token de convite: UUID v4, validade 24h
- Registro detalhado em `docs/SESSAO-2026-03-21-USUARIOS-PORTAL.md`

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
