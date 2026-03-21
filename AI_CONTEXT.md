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
**Reestruturação completa da navegação + Hub do Cliente com Abas + WebSocket Real-Time + Configurações Reorganizadas (Etapas 1, 2, 3, 4, 5)**

O sidebar foi reduzido de ~13 itens para 5. Dashboard é painel executivo unificado.
Central de Atendimento criada como inbox **com WebSocket em tempo real**. A página de detalhe do cliente agora é um
**hub central com 9 abas**: Cadastro, Usuários Portal, Dispositivos, Alertas, Tickets,
Scripts, Software, Patches, Sessões. Cada aba é um componente separado em `tabs/`.
Página de Configurações reorganizada em **5 abas**: Geral, Biblioteca de Scripts, Políticas de Patch, LGPD, Integrações.

**Etapa 3 — WebSocket Real-Time na Central de Atendimento:**
- Backend: `ChatGateway` agora emite eventos para sala `atendimento` (broadcast para técnicos)
- Backend: `AlertsService` agora emite `notification:new` via WebSocket ao criar/reconhecer/resolver alertas
- Frontend: Central usa `useSocket('/chat')` e entra na sala `atendimento:join`
- Eventos escutados: `atendimento:update` (ticket_created, ticket_message, alert_created, alert_resolved) e `atendimento:ticket_updated`
- Indicador visual de conexão WS (⚡ Tempo real / 🔴 Desconectado)
- Toast notifications com slide-in animado para novos tickets/alertas
- Som de notificação (Web Audio API) com toggle on/off
- Badge "N atualizações" quando há pending updates (debounce 3s)
- Itens com mensagens não lidas têm dot amarelo pulsante
- Itens novos via WS têm badge "NOVO" e borda azul
- Ticket resolvido/fechado removido da fila instantaneamente
- Fallback: polling a cada 60s como backup do WebSocket
- Contadores expandidos: Total, Tickets, Alertas, Críticas, Não Lidas

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

3. **`frontend/src/app/dashboard/atendimento/page.tsx`** — REESCRITO (WebSocket Real-Time)
   - Central de Atendimento / Inbox unificado
   - Carrega tickets abertos + em andamento + alertas ativos
   - **WebSocket**: `useSocket('/chat')` → sala `atendimento:join` para receber eventos em tempo real
   - Eventos: `atendimento:update` (ticket_created, ticket_message, alert_created, alert_resolved)
   - Eventos: `atendimento:ticket_updated` (status/prioridade mudou, remove resolvidos)
   - Toast notifications animadas (slide-in-right) com auto-dismiss 8s
   - Som de notificação via Web Audio API com toggle on/off
   - Badge "N atualizações" pulsante com debounce (pending updates)
   - Indicador WS: badge verde "Tempo real" ou vermelho "Desconectado"
   - Contadores: Total, Tickets, Alertas, Críticas, Não Lidas (grid-cols-5)
   - Filtros: tipo (todos/tickets/alertas), prioridade, busca textual
   - Lista com: dot amarelo para não lidas, badge NOVO para itens via WS, borda azul
   - Fallback: polling 60s como backup do WebSocket

4. **`frontend/src/app/dashboard/clients/[id]/page.tsx`** — REESCRITO (Hub com Abas)
   - Layout: sidebar resumo (1 col) + conteúdo aba (3 col)
   - Header com dados do tenant (nome, slug, status, plano)
   - Sidebar: card Resumo (dispositivos, storage, online, usuários, retenção, desde) + navegação vertical 9 abas
   - Abas: Cadastro, Usuários Portal, Dispositivos, Alertas, Tickets, Scripts, Software, Patches, Sessões
   - Lazy loading: cada aba carrega dados sob demanda (só quando selecionada)

5. **`frontend/src/app/dashboard/clients/[id]/tabs/TabCadastro.tsx`** — NOVO
   - Dados da empresa (CRUD inline), endereço, organizações
   - Configuração do agente (Tenant ID, Server URL, Provision Token)
   - Instalação do agente (download MSI, scripts .bat/.ps1, comando manual)
   - Tokens de instalação (CRUD, revogar)

6. **`frontend/src/app/dashboard/clients/[id]/tabs/TabUsuarios.tsx`** — NOVO
   - CRUD completo de usuários do portal com limite dinâmico
   - Contagem visual (barra de progresso total/limite)
   - Modal criar/editar com perfis (Admin, Gestor, Usuário)
   - Ações: editar, desativar/reativar, enviar convite

7. **`frontend/src/app/dashboard/clients/[id]/tabs/TabDispositivos.tsx`** — NOVO
   - Stats rápidos (total, online, offline, alerta)
   - Filtros: busca hostname/IP, status
   - Tabela com hostname, IP, SO, CPU, RAM, status, último contato
   - Botão CONECTAR via RustDesk para dispositivos com rustdeskId
   - Auto-refresh 15s

8. **`frontend/src/app/dashboard/clients/[id]/tabs/TabAlertas.tsx`** — NOVO
   - Stats: ativos, reconhecidos, total
   - Filtros por status (ativo, reconhecido, resolvido, todos)
   - Cards com ícone por severidade, hostname, timeago
   - Ações: reconhecer, resolver
   - Auto-refresh 15s

9. **`frontend/src/app/dashboard/clients/[id]/tabs/TabTickets.tsx`** — NOVO
   - Stats: abertos, atendimento, aguardando, urgentes, total
   - Filtros: busca, status, prioridade
   - Lista com StatusBadge, indicador nova mensagem, técnico atribuído
   - Modal para criar ticket direto no contexto do cliente
   - Link para detalhe do ticket

10. **`frontend/src/app/dashboard/clients/[id]/tabs/TabScripts.tsx`** — NOVO
    - Grid de scripts com preview do código
    - Modal criar script (PowerShell/CMD/Batch)
    - Modal executar: selecionar dispositivos online do cliente
    - Ação remover script

11. **`frontend/src/app/dashboard/clients/[id]/tabs/TabSoftware.tsx`** — NOVO
    - Sub-tabs: Pacotes e Deploys
    - Grid de pacotes com botão Deploy
    - Lista de deploys com status
    - Modal deploy: selecionar dispositivos online

12. **`frontend/src/app/dashboard/clients/[id]/tabs/TabPatches.tsx`** — NOVO
    - Seletor de dispositivo (dropdown)
    - Stats: pendentes, instalados, total
    - Lista de patches com severidade e status
    - Botão instalar para patches pendentes

13. **`frontend/src/app/dashboard/clients/[id]/tabs/TabSessoes.tsx`** — NOVO
    - Stats: ativas, aguardando, total
    - Lista de sessões com status, técnico, motivo, duração
    - Botão Conectar para sessões ativas via RustDesk
    - Modal nova sessão: selecionar dispositivo online + motivo

14. **`backend/src/modules/chat/chat.gateway.ts`** — ATUALIZADO (Etapa 3)
    - Nova sala `atendimento` para técnicos (broadcast global)
    - `@SubscribeMessage('atendimento:join')` — técnicos entram na sala
    - `@SubscribeMessage('atendimento:leave')` — técnicos saem da sala
    - `emitTicketUpdated()` agora também emite para sala `atendimento`
    - `emitNotification()` agora também emite para sala `atendimento`
    - Novo `emitAtendimento()` helper para broadcast direto

15. **`backend/src/modules/alerts/alerts.service.ts`** — ATUALIZADO (Etapa 3)
    - Injeção do `ChatGateway` para emissão de eventos WS
    - `criarAlerta()` → emite `alert_created` via WS para o tenant
    - `reconhecerAlerta()` → emite `alert_acknowledged` via WS
    - `resolverAlerta()` → emite `alert_resolved` via WS

16. **`backend/src/modules/alerts/alerts.module.ts`** — ATUALIZADO (Etapa 3)
    - Importa `ChatModule` para acesso ao `ChatGateway`

17. **`frontend/tailwind.config.ts`** — ATUALIZADO (Etapa 3)
    - Keyframes: `slide-in-right`, `fade-out`
    - Animations: `animate-slide-in-right`, `animate-fade-out`

18. **`frontend/src/app/dashboard/settings/page.tsx`** — REESCRITO (Etapa 5)
    - De página estática com 4 cards para interface com **5 abas**
    - **Aba Geral**: API Backend, Segurança, Notificações, Branding (info estática)
    - **Aba Biblioteca de Scripts**: CRUD completo de scripts globais
      - Lista com badge linguagem (PowerShell/Bat/Bash/Python), badge GLOBAL
      - Modal criar/editar com campos: nome, descrição, linguagem, código, checkbox global
      - Modal preview do código (fundo terminal)
      - Ações: ver código, editar, remover
    - **Aba Políticas de Patch**: Resumo global de patches cross-tenant
      - Contadores por status (pendente, instalando, instalado, falha, agendado)
      - Distribuição por severidade com barras de progresso
      - Info de janelas de manutenção
    - **Aba LGPD**: Proteção de dados
      - Tabela de políticas de retenção (5 entidades com prazos)
      - Tabela de solicitações DSAR com status (pendente, em andamento, concluída, negada)
      - Tabela de registros de consentimento (concedido/recusado)
    - **Aba Integrações**: Serviços externos
      - RustDesk (servidor, domínio, portas, status)
      - SMTP (pendente, instruções .env)
      - Agente Windows (runtime, protocolo, heartbeat, auto-update)
      - Storage S3/R2 (provider, upload, limites)
    - Componentes compartilhados: `InfoRow`, `Modal`, `ScriptFormModal`

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
