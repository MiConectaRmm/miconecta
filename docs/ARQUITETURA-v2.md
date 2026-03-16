# MIConectaRMM Enterprise — Arquitetura v2.0

**Maginf Tecnologia** | Documento de Arquitetura de Software
**Data:** Março 2026 | **Versão:** 2.0

---

## 1. VISÃO GERAL DO PRODUTO

### 1.1 O que é o MIConectaRMM

MIConectaRMM é uma **plataforma SaaS multi-tenant** de Remote Monitoring and Management (RMM) voltada para empresas de suporte técnico (MSPs). Desenvolvida pela Maginf Tecnologia, a plataforma unifica em um único sistema:

- **Monitoramento proativo** de ativos de TI
- **Gestão de chamados** (help desk) com chat integrado
- **Acesso remoto** auditado via RustDesk
- **Automação** via scripts e deploy de software
- **Portal do cliente** com visibilidade do parque
- **Auditoria completa** com conformidade LGPD

### 1.2 Proposta de Valor

| Para | Valor |
|---|---|
| **MSP (Maginf)** | Painel operacional unificado para gerenciar múltiplos clientes, reduzir tempo de resposta e aumentar eficiência |
| **Cliente** | Portal transparente com visão do parque, histórico de chamados, evidências de atendimento e controle de consentimento |
| **Técnico** | Ferramentas integradas: monitoramento + chat + acesso remoto + scripts em uma só tela |

### 1.3 Diferenciação vs Versão v1

| Aspecto | v1 (Atual) | v2 (Nova) |
|---|---|---|
| Usuários | Apenas técnicos Maginf | + Usuários do cliente (portal) |
| Chamados | Não existe | Help desk completo com SLA |
| Chat | Não existe | Chat real-time vinculado a ticket/device |
| Sessão remota | Apenas link RustDesk | Auditoria completa da sessão |
| LGPD | Não implementado | Consentimento, retenção, anonimização |
| Relatórios | Não existe | Executivos + técnicos + exportação |
| Armazenamento | Não existe | S3 para anexos e evidências |
| Notificações | Não existe | Email + push + in-app |

---

## 2. ARQUITETURA MACRO

### 2.1 Diagrama de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│                        INTERNET / CLIENTES                      │
├──────────────┬──────────────────┬───────────────────────────────┤
│  Portal do   │  Painel Maginf   │  Agente Windows               │
│  Cliente     │  (Dashboard)     │  (C# .NET 8)                  │
│  Next.js     │  Next.js         │                                │
└──────┬───────┴────────┬─────────┴──────────┬────────────────────┘
       │                │                    │
       │     HTTPS      │      HTTPS         │  HTTPS + WSS
       ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API GATEWAY / LOAD BALANCER                   │
│                         (Render / Nginx)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              BACKEND NESTJS (API REST + WebSocket)        │   │
│  │                                                           │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │  Auth   │ │ Tenants │ │ Devices  │ │   Metrics    │  │   │
│  │  │ + RBAC  │ │ + Orgs  │ │ + Invent │ │   + Alerts   │  │   │
│  │  └─────────┘ └─────────┘ └──────────┘ └──────────────┘  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Tickets │ │  Chat   │ │ Sessions │ │   Scripts    │  │   │
│  │  │+HelpDesk│ │ + WS    │ │ + Audit  │ │  + Software  │  │   │
│  │  └─────────┘ └─────────┘ └──────────┘ └──────────────┘  │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │   │
│  │  │ Reports │ │  LGPD   │ │  Audit   │ │ Notifications│  │   │
│  │  │         │ │+Consent │ │  Trail   │ │ Email+Push   │  │   │
│  │  └─────────┘ └─────────┘ └──────────┘ └──────────────┘  │   │
│  │  ┌─────────┐ ┌─────────┐                                │   │
│  │  │ Storage │ │ Patches │                                 │   │
│  │  │  (S3)   │ │         │                                 │   │
│  │  └─────────┘ └─────────┘                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
├──────────────┬──────────────────┬───────────────────────────────┤
│  PostgreSQL  │      Redis       │   S3 / MinIO                  │
│  (Dados)     │  (Cache + PubSub │   (Anexos/Evidências)         │
│              │   + Filas)       │                                │
└──────────────┴──────────────────┴───────────────────────────────┘
```

### 2.2 Stack Tecnológica Definitiva

| Camada | Tecnologia | Justificativa |
|---|---|---|
| **Backend** | NestJS + TypeScript | Framework enterprise com DI, módulos, guards, interceptors |
| **ORM** | TypeORM | Já em uso, boa integração com NestJS, suporte a migrations |
| **Banco** | PostgreSQL 16 | Multi-tenant com RLS (Row Level Security), JSONB, full-text search |
| **Cache/Filas** | Redis (Upstash ou BullMQ) | PubSub para chat, filas para jobs assíncronos, cache de sessão |
| **Frontend** | Next.js 14 + TailwindCSS + shadcn/ui | SSR, App Router, componentes modernos |
| **Real-time** | Socket.IO (via NestJS Gateway) | Chat, notificações, status de dispositivos em tempo real |
| **Armazenamento** | S3-compatible (AWS S3 / MinIO / Cloudflare R2) | Anexos de tickets, evidências de sessão, screenshots |
| **Acesso Remoto** | RustDesk | Já configurado em 136.248.114.218, open-source |
| **Agente** | C# .NET 8 Windows Service | Coleta de métricas, inventário, execução de scripts, canal de chat |
| **Autenticação** | JWT + Refresh Token + RBAC multi-tenant | Isolamento por tenant, múltiplos perfis |
| **Email** | Nodemailer + template engine | Notificações, recuperação de senha, relatórios |

### 2.3 Decisão: TypeORM vs Prisma

**Escolha: TypeORM** — Justificativas:
1. Já está em uso no projeto (migrar para Prisma seria retrabalho sem ganho imediato)
2. Suporte nativo a migrations incrementais
3. Integração madura com NestJS via `@nestjs/typeorm`
4. QueryBuilder robusto para consultas complexas de relatórios
5. Suporte a subscribers e listeners para auditoria automática

---

## 3. MÓDULOS PRINCIPAIS

### 3.1 Mapa de Módulos (16 módulos)

```
MÓDULOS EXISTENTES (v1 — evoluir)     MÓDULOS NOVOS (v2)
─────────────────────────────────      ──────────────────────────
✅ Auth (expandir RBAC)               🆕 Tickets (Help Desk)
✅ Tenants (expandir config)           🆕 Chat (Real-time)
✅ Devices (expandir inventário)       🆕 RemoteSessions (Auditoria)
✅ Metrics                             🆕 Notifications
✅ Alerts (expandir regras)            🆕 Reports
✅ Scripts                             🆕 Storage (S3)
✅ Software                            🆕 LGPD (Consentimento)
✅ Patches                             🆕 ClientPortal (rotas específicas)
✅ Audit (expandir trilha)
✅ Gateway (expandir WebSocket)
```

### 3.2 Detalhamento por Módulo

#### M01 — Auth (Autenticação e Autorização)
- **Evolução:** Suportar dois tipos de usuário: `Technician` (Maginf) e `ClientUser` (cliente)
- Login por email + senha com bcrypt
- JWT Access Token (15min) + Refresh Token (7 dias)
- RBAC com guards por rota
- Recuperação de senha por email
- Registro de tentativas de login (auditoria)
- 2FA opcional (TOTP) — fase futura

#### M02 — Tenants (Gestão de Clientes)
- **Evolução:** Configurações por tenant (SLA, retenção, logo, domínio)
- CRUD de tenants
- Gestão de organizações/filiais/sites
- Configurações: SLA padrão, política de retenção, timezone, logo
- Limites de uso (max dispositivos, max usuários)
- Status: ativo, suspenso, trial

#### M03 — Users (Gestão de Usuários) — NOVO
- Dois domínios de usuário no mesmo módulo:
  - **Technician** (staff Maginf): admin, técnico, visualizador
  - **ClientUser** (usuário do cliente): admin_cliente, usuario_cliente
- Convite por email
- Gestão de permissões granulares
- Avatar, preferências, timezone

#### M04 — Devices (Dispositivos e Inventário)
- **Evolução:** Inventário detalhado, vínculo automático por token
- Registro automático via agente
- Inventário de hardware: CPU, RAM, disco, placa-mãe, nº série
- Inventário de software: programas instalados, versões
- Status: online, offline, alerta, manutenção
- Tags e agrupamento por organização/site
- Histórico de alterações do dispositivo

#### M05 — Metrics (Métricas e Saúde)
- **Sem mudança estrutural**, mas:
- Dashboards de saúde por tenant/organização
- Thresholds configuráveis por tenant
- Retenção de dados configurável

#### M06 — Alerts (Alertas e Eventos)
- **Evolução:** Motor de regras configurável
- Regras de alerta configuráveis por tenant
- Severidade: info, aviso, crítico, emergência
- Auto-criação de ticket quando severidade >= crítico
- Notificação por email/push/in-app
- Escalonamento automático

#### M07 — Tickets (Help Desk) — NOVO
- Criação manual (portal ou painel) ou automática (alerta/agente)
- Estados: aberto → em_atendimento → aguardando_cliente → resolvido → fechado
- Prioridade: baixa, média, alta, urgente
- SLA configurável por tenant (tempo de resposta + resolução)
- Vínculo obrigatório: tenant + opcional: device, organization
- Categorias e subcategorias configuráveis
- Atribuição a técnico (manual ou round-robin)
- Timeline com todas as ações (mensagens, sessões, scripts, evidências)
- Avaliação de satisfação (NPS ao fechar)
- Reabertura com justificativa

#### M08 — Chat (Comunicação em Tempo Real) — NOVO
- Chat vinculado a: ticket (obrigatório) + device (opcional)
- Participantes: técnico(s) + usuário(s) do cliente
- Mensagens de texto, imagens, arquivos
- Mensagens do sistema (ex: "Técnico iniciou sessão remota")
- Indicadores: digitando, online, lido
- Histórico persistido e auditável
- Chat iniciado pelo agente (ícone na bandeja do Windows)
- Transcrição completa exportável

#### M09 — RemoteSessions (Sessões Remotas Auditadas) — NOVO
- Integração com RustDesk via API/webhook
- Registro: técnico, dispositivo, início, fim, duração
- Gravação de ações executadas durante a sessão
- Screenshots/vídeo opcional (armazenado em S3)
- Consentimento do cliente antes de iniciar
- Vínculo com ticket
- Log detalhado: comandos executados, arquivos transferidos
- Relatório da sessão gerado automaticamente

#### M10 — Scripts (Execução Remota)
- **Evolução:** Biblioteca de scripts compartilhada + por tenant
- Categorias: diagnóstico, correção, manutenção, coleta
- Execução individual ou em lote
- Resultado em tempo real via WebSocket
- Aprovação obrigatória para scripts destrutivos

#### M11 — Software (Deploy de Software)
- **Sem mudança estrutural significativa**
- Pacotes armazenados em S3
- Progresso em tempo real via agente

#### M12 — Patches (Windows Update)
- **Sem mudança estrutural significativa**
- Políticas de patch por tenant
- Janelas de manutenção configuráveis

#### M13 — Reports (Relatórios) — NOVO
- **Relatórios Executivos** (para o cliente):
  - Resumo mensal do parque
  - SLA atendido vs contratado
  - Tickets abertos/resolvidos
  - Saúde geral dos ativos
- **Relatórios Técnicos** (para a Maginf):
  - Performance por técnico
  - Tempo médio de resolução
  - Dispositivos problemáticos
  - Alertas recorrentes
- Exportação: PDF, CSV, Excel
- Agendamento automático (mensal/semanal)
- Envio por email

#### M14 — Notifications (Notificações) — NOVO
- Canais: in-app (badge), email, push (futuro)
- Eventos disparadores: novo ticket, alerta crítico, SLA próximo de expirar, mensagem no chat
- Preferências por usuário
- Digest (resumo diário/semanal por email)
- Templates de email personalizáveis por tenant

#### M15 — LGPD & Compliance — NOVO
- **Consentimento de acesso remoto:**
  - Popup no dispositivo antes de cada sessão
  - Registro de aceite com timestamp, IP, usuário
  - Opção de recusar
- **Política de retenção de dados:**
  - Configurável por tenant (ex: 12 meses)
  - Job de limpeza automática
  - Anonimização em vez de exclusão hard
- **Direitos do titular:**
  - Exportação de dados pessoais (DSAR)
  - Solicitação de exclusão
  - Registro de todas as solicitações
- **Termos de uso e privacidade:**
  - Aceite obrigatório no primeiro login
  - Versionamento de termos

#### M16 — Storage (Armazenamento) — NOVO
- Abstração sobre S3-compatible (AWS S3 / Cloudflare R2 / MinIO)
- Upload de anexos em tickets
- Evidências de sessão remota
- Screenshots de dispositivos
- Pacotes de software
- Controle de acesso por tenant
- Limite de armazenamento por tenant
- Limpeza automática por política de retenção

#### M17 — Audit (Trilha de Auditoria) — EXPANDIR
- **Evolução:** Subscriber automático do TypeORM
- Registro automático de TODA operação de escrita
- Campos: quem, quando, o quê, de onde (IP), tenant
- Imutável (append-only)
- Consulta com filtros avançados
- Exportação para compliance
- Retenção mínima de 5 anos

---

## 4. PERFIS DE USUÁRIO E RBAC

### 4.1 Hierarquia de Usuários

```
MAGINF (operador MSP)
├── SUPER_ADMIN        → Acesso total a todos os tenants
├── ADMIN_MAGINF       → Gestão de tenants, técnicos, relatórios globais
├── TECNICO_SENIOR     → Todos os tenants atribuídos, scripts avançados
├── TECNICO            → Tenants atribuídos, operação básica
└── VISUALIZADOR       → Somente leitura em tenants atribuídos

CLIENTE (portal do cliente)
├── ADMIN_CLIENTE      → Gestão de usuários do tenant, relatórios, config
├── GESTOR             → Visualiza tudo, abre tickets, aprova sessões
└── USUARIO            → Abre tickets, chat com suporte, vê seus devices
```

### 4.2 Matriz de Permissões

| Recurso | SUPER_ADMIN | ADMIN_MAGINF | TECNICO | ADMIN_CLIENTE | USUARIO |
|---|---|---|---|---|---|
| Gerenciar tenants | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver todos os tenants | ✅ | ✅ | ❌ | ❌ | ❌ |
| Gerenciar técnicos | ✅ | ✅ | ❌ | ❌ | ❌ |
| Ver dispositivos | ✅ | ✅ | ✅* | ✅* | ✅** |
| Acesso remoto | ✅ | ✅ | ✅* | ❌ | ❌ |
| Executar scripts | ✅ | ✅ | ✅* | ❌ | ❌ |
| Gerenciar tickets | ✅ | ✅ | ✅* | ✅* | Próprios |
| Chat | ✅ | ✅ | ✅* | ✅* | ✅* |
| Relatórios globais | ✅ | ✅ | ❌ | ❌ | ❌ |
| Relatórios do tenant | ✅ | ✅ | ✅* | ✅* | ❌ |
| Configurar LGPD | ✅ | ✅ | ❌ | ✅* | ❌ |
| Auditoria | ✅ | ✅ | ✅* | ✅* | ❌ |
| Gerenciar usuários cliente | ✅ | ✅ | ❌ | ✅* | ❌ |

`*` = apenas dentro do tenant atribuído
`**` = apenas dispositivos da sua organização

### 4.3 Modelo de Dados de Permissões

```
User (Technician | ClientUser)
  └── tem roles: Role[]
        └── tem permissions: Permission[]
              └── { recurso, acao, condicao }
                   ex: { "tickets", "read", "own_tenant" }
                   ex: { "devices", "write", "assigned_orgs" }
```

---

## 5. FLUXOS CRÍTICOS DO SISTEMA

### 5.1 Fluxo: Onboarding de Novo Cliente

```
1. Admin Maginf cria Tenant no painel
   → Define: nome, slug, email, plano, SLA
   → Define: organizações/filiais iniciais
   → Sistema gera: token de instalação do agente

2. Admin Maginf cria Admin do Cliente
   → Sistema envia email de convite com link de ativação
   → Cliente define senha no primeiro acesso
   → Cliente aceita termos de uso e política de privacidade

3. Admin do Cliente configura:
   → Usuários adicionais (gestor, usuários)
   → Preferências de notificação

4. Técnico Maginf instala agente nos dispositivos do cliente
   → Agente usa token do tenant para se registrar
   → Dispositivo aparece automaticamente no dashboard
   → Inventário de hardware/software é coletado automaticamente
```

### 5.2 Fluxo: Abertura e Resolução de Chamado

```
1. ABERTURA (3 origens possíveis):
   a) Usuário do cliente abre via Portal
      → Seleciona categoria, descreve problema, anexa arquivos
      → Opcionalmente vincula dispositivo
   b) Alerta automático cria ticket
      → Severidade >= crítico → ticket auto-criado
      → Vinculado ao dispositivo que gerou o alerta
   c) Agente Windows → usuário clica "Solicitar Suporte"
      → Chat abre vinculado ao dispositivo
      → Ticket criado automaticamente

2. ATRIBUIÇÃO:
   → Round-robin entre técnicos disponíveis OU
   → Atribuição manual pelo admin
   → Notificação ao técnico atribuído

3. ATENDIMENTO:
   → Técnico responde via chat (real-time)
   → Se necessário, solicita acesso remoto:
     a) Sistema envia popup de consentimento ao dispositivo
     b) Usuário aceita/recusa
     c) Se aceito: sessão RustDesk inicia automaticamente
     d) Toda a sessão é registrada (início, fim, duração, ações)
   → Técnico pode executar scripts remotamente
   → Técnico pode enviar screenshots/evidências
   → Cada ação é registrada na timeline do ticket

4. RESOLUÇÃO:
   → Técnico marca como resolvido + adiciona notas
   → Cliente recebe notificação
   → Cliente avalia satisfação (1-5 estrelas + comentário)
   → Ticket muda para estado "fechado" automaticamente após 48h
   → Pode ser reaberto pelo cliente com justificativa

5. PÓS-RESOLUÇÃO:
   → Relatório do ticket gerado automaticamente
   → Métricas de SLA computadas
   → Dados alimentam relatórios mensais
```

### 5.3 Fluxo: Chat Integrado

```
FRONTEND (WebSocket)           BACKEND (Socket.IO)              AGENTE (WebSocket)
     │                              │                                │
     │  connect(jwt)                │                                │
     ├─────────────────────────────►│                                │
     │                              │  authenticate + join rooms     │
     │                              │  (ticket:{id}, device:{id})    │
     │                              │                                │
     │  sendMessage(ticketId, text) │                                │
     ├─────────────────────────────►│                                │
     │                              │── persist to DB                │
     │                              │── notify all room members      │
     │                              ├───────────────────────────────►│
     │  ◄──── newMessage event ─────┤                                │
     │                              │                                │
     │                              │◄── sendMessage (from agent) ───┤
     │                              │── persist to DB                │
     │  ◄──── newMessage event ─────┤                                │
     │                              │                                │
     │                              │── systemMessage:               │
     │                              │   "Sessão remota iniciada"     │
     │  ◄──── newMessage event ─────┤───────────────────────────────►│
```

### 5.4 Fluxo: Sessão Remota Auditada

```
1. Técnico clica "Acesso Remoto" no dispositivo ou ticket
2. Backend verifica permissão + cria registro de sessão
3. Backend envia comando ao agente: "solicitar_consentimento"
4. Agente exibe popup no Windows:
   "O técnico [nome] da Maginf solicita acesso remoto.
    Motivo: [descrição do ticket]
    [Permitir] [Recusar]"
5. Se RECUSADO → registro de recusa no audit + notifica técnico
6. Se ACEITO:
   a) Agente registra consentimento (timestamp, IP, usuário local)
   b) Backend inicia sessão RustDesk via API
   c) Técnico recebe link/ID do RustDesk
   d) Sessão inicia
   e) Mensagem automática no chat: "Sessão remota iniciada"
7. Durante a sessão:
   → Agente registra ações (processos abertos, comandos, transfers)
   → Screenshots periódicos (configurável)
8. Ao finalizar:
   → Duração registrada
   → Mensagem automática: "Sessão remota encerrada (12min 34s)"
   → Resumo da sessão anexado ao ticket
   → Registro no audit trail
```

### 5.5 Fluxo: Monitoramento e Alertas

```
AGENTE (a cada 60s)                 BACKEND                        FRONTEND
     │                                │                                │
     │  POST /metrics (heartbeat)     │                                │
     ├───────────────────────────────►│                                │
     │                                │── salvar métricas              │
     │                                │── executar AlertEngine:        │
     │                                │   CPU > 90% por 5min?         │
     │                                │   RAM > 95%?                  │
     │                                │   Disco < 10%?                │
     │                                │   Antivírus desatualizado?    │
     │                                │   Backup falhou?              │
     │                                │                                │
     │                                │── SE alerta:                   │
     │                                │   1. Criar Alert               │
     │                                │   2. Se crítico → criar Ticket │
     │                                │   3. Notificar (email+push)    │
     │                                │   4. WebSocket → dashboard     │
     │                                │──────────────────────────────►│
     │                                │                                │  🔔 badge atualiza
```

---

## 6. ESTRUTURA DO BANCO DE DADOS

### 6.1 Entidades (28 entidades — v2)

```
EXISTENTES (14 — evoluir)           NOVAS (14)
────────────────────────            ─────────────────────────
tenant                              client_user
organization                        ticket
device                              ticket_category
device_metric                       ticket_comment
device_inventory                    ticket_sla_config
alert                               chat_message
script                              remote_session
script_execution                    remote_session_log
software_package                    consent_record
software_deployment                 notification
patch                               notification_preference
technician                          report_schedule
session                             file_attachment
audit_log                           lgpd_request
```

### 6.2 Entidades Novas — Esquema Detalhado

#### client_users (Usuários do Cliente)
```sql
id              UUID PK
tenant_id       UUID FK → tenants
organization_id UUID FK → organizations (nullable)
nome            VARCHAR(255)
email           VARCHAR(255) UNIQUE
senha           TEXT
funcao          ENUM('admin_cliente', 'gestor', 'usuario')
telefone        VARCHAR(20)
cargo           VARCHAR(255)
ativo           BOOLEAN DEFAULT true
email_verificado BOOLEAN DEFAULT false
ultimo_login    TIMESTAMP
avatar_url      TEXT
preferencias    JSONB
termos_aceitos_em TIMESTAMP
criado_em       TIMESTAMP
atualizado_em   TIMESTAMP
```

#### tickets (Chamados)
```sql
id              UUID PK
tenant_id       UUID FK → tenants
organization_id UUID FK → organizations (nullable)
device_id       UUID FK → devices (nullable)
numero          SERIAL (auto-increment por tenant)
titulo          VARCHAR(500)
descricao       TEXT
status          ENUM('aberto','em_atendimento','aguardando_cliente',
                     'aguardando_tecnico','resolvido','fechado','cancelado')
prioridade      ENUM('baixa','media','alta','urgente')
categoria_id    UUID FK → ticket_categories (nullable)
origem          ENUM('portal','painel','agente','alerta','email')
criado_por_tipo ENUM('technician','client_user','system')
criado_por_id   UUID
atribuido_a     UUID FK → technicians (nullable)
sla_resposta_em TIMESTAMP (nullable)
sla_resolucao_em TIMESTAMP (nullable)
respondido_em   TIMESTAMP (nullable)
resolvido_em    TIMESTAMP (nullable)
fechado_em      TIMESTAMP (nullable)
avaliacao_nota  INT (1-5, nullable)
avaliacao_comentario TEXT (nullable)
tags            JSONB
metadata        JSONB
criado_em       TIMESTAMP
atualizado_em   TIMESTAMP

INDEXES: (tenant_id, status), (tenant_id, numero), (atribuido_a, status)
```

#### ticket_categories
```sql
id              UUID PK
tenant_id       UUID FK → tenants (nullable, null = global)
nome            VARCHAR(255)
descricao       TEXT
icone           VARCHAR(50)
pai_id          UUID FK → ticket_categories (nullable, para subcategorias)
ativo           BOOLEAN DEFAULT true
ordem           INT
```

#### ticket_comments (Timeline do Ticket)
```sql
id              UUID PK
ticket_id       UUID FK → tickets
autor_tipo      ENUM('technician','client_user','system')
autor_id        UUID
tipo            ENUM('mensagem','nota_interna','mudanca_status',
                     'sessao_remota','script_executado','anexo','avaliacao')
conteudo        TEXT
visivel_cliente BOOLEAN DEFAULT true
metadata        JSONB (ex: {status_anterior, status_novo} para mudanças)
criado_em       TIMESTAMP

INDEX: (ticket_id, criado_em)
```

#### chat_messages (Mensagens de Chat)
```sql
id              UUID PK
ticket_id       UUID FK → tickets
device_id       UUID FK → devices (nullable)
remetente_tipo  ENUM('technician','client_user','agent','system')
remetente_id    UUID (nullable para system)
remetente_nome  VARCHAR(255)
tipo            ENUM('texto','imagem','arquivo','sistema')
conteudo        TEXT
arquivo_url     TEXT (nullable)
arquivo_nome    VARCHAR(255) (nullable)
arquivo_tamanho BIGINT (nullable)
lido            BOOLEAN DEFAULT false
lido_em         TIMESTAMP (nullable)
criado_em       TIMESTAMP

INDEX: (ticket_id, criado_em)
```

#### remote_sessions (Sessões Remotas)
```sql
id              UUID PK
tenant_id       UUID FK → tenants
ticket_id       UUID FK → tickets (nullable)
device_id       UUID FK → devices
technician_id   UUID FK → technicians
rustdesk_session_id VARCHAR(255) (nullable)
status          ENUM('solicitada','consentimento_pendente','consentida',
                     'recusada','ativa','finalizada','erro')
motivo          TEXT
consentido_por  VARCHAR(255) (nome do usuário local)
consentido_em   TIMESTAMP (nullable)
iniciada_em     TIMESTAMP (nullable)
finalizada_em   TIMESTAMP (nullable)
duracao_segundos INT (nullable)
ip_tecnico      VARCHAR(45)
ip_dispositivo  VARCHAR(45)
resumo          TEXT (nullable, preenchido ao finalizar)
criado_em       TIMESTAMP

INDEX: (tenant_id, device_id), (technician_id)
```

#### remote_session_logs (Log de Ações na Sessão)
```sql
id              UUID PK
session_id      UUID FK → remote_sessions
timestamp       TIMESTAMP
tipo            ENUM('comando','processo','arquivo_transferido',
                     'screenshot','clipboard','registro','outro')
descricao       TEXT
detalhes        JSONB
arquivo_url     TEXT (nullable, para screenshots)
```

#### consent_records (Registros de Consentimento LGPD)
```sql
id              UUID PK
tenant_id       UUID FK → tenants
tipo            ENUM('acesso_remoto','coleta_dados','termos_uso',
                     'politica_privacidade','compartilhamento')
concedente_tipo ENUM('client_user','usuario_local_dispositivo')
concedente_id   UUID (nullable)
concedente_nome VARCHAR(255)
concedente_ip   VARCHAR(45)
device_id       UUID FK → devices (nullable)
session_id      UUID FK → remote_sessions (nullable)
consentido      BOOLEAN
versao_termos   VARCHAR(50) (nullable)
detalhes        JSONB
criado_em       TIMESTAMP

INDEX: (tenant_id, tipo, criado_em)
```

#### notifications
```sql
id              UUID PK
tenant_id       UUID FK → tenants
destinatario_tipo ENUM('technician','client_user')
destinatario_id UUID
tipo            ENUM('alerta','ticket_novo','ticket_atualizado',
                     'chat_mensagem','sla_proximo','sessao_solicitada',
                     'relatorio_pronto','sistema')
titulo          VARCHAR(500)
conteudo        TEXT
lida            BOOLEAN DEFAULT false
lida_em         TIMESTAMP (nullable)
link            VARCHAR(500) (nullable)
metadata        JSONB
criado_em       TIMESTAMP

INDEX: (destinatario_tipo, destinatario_id, lida)
```

#### notification_preferences
```sql
id              UUID PK
usuario_tipo    ENUM('technician','client_user')
usuario_id      UUID
canal           ENUM('in_app','email','push')
tipo_evento     VARCHAR(100)
ativo           BOOLEAN DEFAULT true

UNIQUE: (usuario_tipo, usuario_id, canal, tipo_evento)
```

#### report_schedules
```sql
id              UUID PK
tenant_id       UUID FK → tenants
nome            VARCHAR(255)
tipo            ENUM('executivo_mensal','tecnico_semanal','sla',
                     'inventario','alertas','custom')
frequencia      ENUM('diario','semanal','mensal')
destinatarios   JSONB (lista de emails)
parametros      JSONB
ultimo_envio    TIMESTAMP (nullable)
proximo_envio   TIMESTAMP
ativo           BOOLEAN DEFAULT true
criado_por_id   UUID
criado_em       TIMESTAMP
```

#### file_attachments
```sql
id              UUID PK
tenant_id       UUID FK → tenants
entidade_tipo   ENUM('ticket','chat','session','device','report')
entidade_id     UUID
nome_original   VARCHAR(500)
nome_storage    VARCHAR(500)
mime_type       VARCHAR(255)
tamanho_bytes   BIGINT
storage_path    TEXT (caminho no S3)
uploaded_por_tipo ENUM('technician','client_user','agent','system')
uploaded_por_id UUID (nullable)
criado_em       TIMESTAMP

INDEX: (entidade_tipo, entidade_id)
```

#### lgpd_requests
```sql
id              UUID PK
tenant_id       UUID FK → tenants
tipo            ENUM('exportacao_dados','exclusao_dados','revogacao_consentimento',
                     'consulta','retificacao')
solicitante_tipo ENUM('client_user','technician')
solicitante_id  UUID
status          ENUM('pendente','em_processamento','concluido','recusado')
descricao       TEXT
resposta        TEXT (nullable)
dados_exportados_url TEXT (nullable)
processado_por  UUID FK → technicians (nullable)
processado_em   TIMESTAMP (nullable)
prazo_legal     TIMESTAMP (15 dias úteis por LGPD)
criado_em       TIMESTAMP
```

### 6.3 Evolução das Entidades Existentes

#### technicians → adicionar campos
```sql
+ tipo           ENUM('super_admin','admin_maginf','tecnico_senior','tecnico','visualizador')
+ especialidades JSONB
+ tenants_atribuidos UUID[] (para técnicos que atendem tenants específicos)
+ max_tickets_simultaneos INT DEFAULT 10
+ disponivel     BOOLEAN DEFAULT true
```

#### tenants → adicionar campos
```sql
+ plano          ENUM('basic','professional','enterprise')
+ max_dispositivos INT DEFAULT 50
+ max_usuarios   INT DEFAULT 10
+ storage_max_mb BIGINT DEFAULT 5120
+ storage_usado_mb BIGINT DEFAULT 0
+ sla_config     JSONB
+ logo_url       TEXT
+ dominio_customizado VARCHAR(255)
+ timezone       VARCHAR(50) DEFAULT 'America/Sao_Paulo'
+ retencao_meses INT DEFAULT 12
```

#### alerts → adicionar campos
```sql
+ ticket_id      UUID FK → tickets (nullable, se gerou ticket)
+ notificado     BOOLEAN DEFAULT false
+ regra_id       VARCHAR(255) (qual regra gerou o alerta)
```

---

## 7. ROADMAP DE DESENVOLVIMENTO POR FASES

### FASE 1 — Fundação (4 semanas)
**Objetivo:** Refatorar base existente e preparar para v2

```
Semana 1-2: Refatoração da Base
├── Expandir entidade Technician (tipos, especialidades)
├── Expandir entidade Tenant (plano, limites, SLA config)
├── Criar entidade ClientUser + módulo Users
├── Implementar RBAC granular com guards
├── Criar middleware de tenant isolation
├── Implementar Refresh Token
├── Migrations incrementais

Semana 3-4: Infraestrutura
├── Configurar Redis (Upstash) para cache + pub/sub
├── Configurar S3 (Cloudflare R2 ou AWS) para storage
├── Implementar módulo Storage com upload/download
├── Implementar módulo Notifications (in-app)
├── Expandir Audit com TypeORM Subscriber automático
├── Implementar middleware de rate limiting
├── Setup de testes automatizados (Jest)
```

### FASE 2 — Help Desk (4 semanas)
**Objetivo:** Sistema completo de chamados

```
Semana 5-6: Tickets
├── Entidades: ticket, ticket_category, ticket_comment
├── CRUD completo de tickets
├── Estados e transições
├── Atribuição de técnicos (manual + round-robin)
├── Timeline do ticket (comments com tipos)
├── SLA engine (cálculo de prazos)
├── Anexos em tickets (via Storage module)
├── API do Portal do Cliente (rotas específicas)

Semana 7-8: Chat + Notificações
├── Entidade chat_message
├── Socket.IO rooms por ticket
├── Chat real-time no frontend (Painel + Portal)
├── Mensagens do sistema automáticas
├── Indicadores (digitando, online, lido)
├── Notificações por email (templates)
├── Preferências de notificação por usuário
├── Badge de notificações no frontend
```

### FASE 3 — Portal do Cliente (3 semanas)
**Objetivo:** Frontend separado para clientes

```
Semana 9-10: Portal Web
├── Layout e navegação do portal do cliente
├── Login + recuperação de senha
├── Dashboard do cliente: resumo do parque, tickets abertos
├── Lista de dispositivos (somente leitura)
├── Abertura de ticket via portal
├── Chat com suporte via portal
├── Histórico de tickets e avaliação
├── Aceite de termos de uso (LGPD)

Semana 11: Integração com Agente
├── Botão "Solicitar Suporte" no agente Windows
├── Chat integrado no agente (ícone na bandeja)
├── Agente abre ticket automaticamente com info do device
├── Popup de consentimento para acesso remoto
```

### FASE 4 — Sessão Remota Auditada (3 semanas)
**Objetivo:** Acesso remoto com auditoria completa

```
Semana 12-13: Sessões Remotas
├── Entidades: remote_session, remote_session_log, consent_record
├── Fluxo de consentimento (backend → agente → popup → resposta)
├── Integração com RustDesk (iniciar/finalizar sessão)
├── Registro de ações durante a sessão
├── Vínculo sessão ↔ ticket
├── Mensagens automáticas no chat
├── Resumo automático da sessão

Semana 14: Evidências
├── Captura de screenshots durante sessão
├── Upload automático para S3
├── Visualização de evidências no ticket
├── Exportação de relatório da sessão
```

### FASE 5 — Relatórios + LGPD (3 semanas)
**Objetivo:** Relatórios completos e conformidade legal

```
Semana 15-16: Relatórios
├── Entidade report_schedule
├── Motor de geração de relatórios
├── Relatório executivo mensal (PDF)
├── Relatório técnico semanal
├── Relatório de SLA
├── Relatório de inventário
├── Agendamento automático
├── Envio por email

Semana 17: LGPD
├── Entidade lgpd_request
├── Módulo de consentimento completo
├── Política de retenção de dados (job de limpeza)
├── Exportação de dados do titular (DSAR)
├── Painel de compliance para admin
├── Versionamento de termos de uso
├── Anonimização de dados expirados
```

### FASE 6 — Polimento + Produção (2 semanas)
**Objetivo:** Preparação final para uso em produção real

```
Semana 18: Qualidade
├── Testes E2E dos fluxos críticos
├── Performance testing (carga)
├── Security audit (OWASP top 10)
├── Revisão de logs e monitoramento
├── Documentação de API (Swagger completo)

Semana 19: Go-Live
├── Migração de dados v1 → v2
├── Treinamento da equipe Maginf
├── Onboarding do primeiro cliente piloto
├── Monitoramento intensivo
├── Ajustes pós-deploy
```

### Cronograma Visual

```
MÊS 1          MÊS 2          MÊS 3          MÊS 4          MÊS 5
├──────────────┼──────────────┼──────────────┼──────────────┼──────┤
│ FASE 1       │ FASE 2       │ FASE 3       │ FASE 4       │FASE 6│
│ Fundação     │ Help Desk    │ Portal       │ Sessão       │Polish│
│ (4 sem)      │ (4 sem)      │ (3 sem)      │ Remota       │(2sem)│
│              │              │              │ (3 sem)      │      │
│              │              │              ├──────────────┤      │
│              │              │              │ FASE 5       │      │
│              │              │              │ Relatórios   │      │
│              │              │              │ + LGPD       │      │
│              │              │              │ (3 sem)      │      │
└──────────────┴──────────────┴──────────────┴──────────────┴──────┘
                                                          Total: ~19 semanas
```

---

## 8. ESTRUTURA DE PASTAS (v2)

```
c:\app.miconecta\
├── backend/
│   └── src/
│       ├── common/
│       │   ├── decorators/          # @CurrentUser, @Roles, @TenantId
│       │   ├── guards/              # JwtAuthGuard, RolesGuard, TenantGuard
│       │   ├── interceptors/        # AuditInterceptor, TenantInterceptor
│       │   ├── filters/             # HttpExceptionFilter
│       │   ├── pipes/               # TenantValidationPipe
│       │   └── interfaces/          # tipos compartilhados
│       ├── config/                  # configurações centralizadas
│       ├── database/
│       │   ├── entities/            # 28 entidades
│       │   ├── migrations/          # migrations incrementais
│       │   ├── subscribers/         # AuditSubscriber (auto-log)
│       │   └── seeds/               # dados iniciais
│       └── modules/
│           ├── auth/                # Login, JWT, Refresh Token, RBAC
│           ├── users/               # Technicians + ClientUsers
│           ├── tenants/             # Tenants + Organizations
│           ├── devices/             # Devices + Inventory
│           ├── metrics/             # Métricas + Saúde
│           ├── alerts/              # Alertas + Motor de Regras
│           ├── tickets/             # Help Desk completo
│           ├── chat/                # Chat real-time
│           ├── remote-sessions/     # Sessões remotas auditadas
│           ├── scripts/             # Execução remota
│           ├── software/            # Deploy de software
│           ├── patches/             # Windows Update
│           ├── reports/             # Relatórios
│           ├── notifications/       # Notificações multi-canal
│           ├── storage/             # Upload/download S3
│           ├── lgpd/                # Consentimento + compliance
│           ├── audit/               # Trilha de auditoria
│           └── gateway/             # WebSocket (Socket.IO)
├── frontend/
│   └── src/
│       └── app/
│           ├── (auth)/              # Login, recuperar senha
│           ├── dashboard/           # Painel Maginf (técnicos)
│           │   ├── page.tsx         # Home dashboard
│           │   ├── devices/
│           │   ├── tickets/
│           │   ├── alerts/
│           │   ├── chat/
│           │   ├── scripts/
│           │   ├── software/
│           │   ├── patches/
│           │   ├── clients/
│           │   ├── technicians/
│           │   ├── reports/
│           │   ├── audit/
│           │   └── settings/
│           └── portal/              # Portal do Cliente (NOVO)
│               ├── page.tsx         # Home portal
│               ├── devices/
│               ├── tickets/
│               ├── chat/
│               ├── reports/
│               ├── users/
│               └── settings/
├── agent/                           # Agente Windows C# .NET 8
│   └── MIConectaAgent/
│       ├── Services/
│       │   ├── SystemInfoCollector.cs
│       │   ├── MetricsCollector.cs
│       │   ├── SoftwareInventoryCollector.cs
│       │   ├── WindowsUpdateChecker.cs
│       │   ├── ScriptExecutor.cs
│       │   ├── ApiClient.cs
│       │   ├── HeartbeatService.cs
│       │   ├── CommandPollingService.cs
│       │   ├── ChatService.cs          # NOVO
│       │   ├── ConsentService.cs        # NOVO
│       │   └── RemoteSessionService.cs  # NOVO
│       └── UI/
│           ├── TrayIcon.cs             # Ícone na bandeja
│           ├── ChatWindow.cs           # Janela de chat
│           └── ConsentDialog.cs        # Popup de consentimento
├── installer/
├── docs/
│   └── ARQUITETURA-v2.md              # Este documento
└── docker-compose.yml
```

---

## 9. PRÓXIMOS PASSOS

Após aprovação deste documento, seguiremos nesta ordem:

1. **Aprofundar Fase 1** → Criar código real para RBAC, ClientUser, Refresh Token
2. **Aprofundar Fase 2** → Criar código real para Tickets, Chat, Notificações
3. **Aprofundar Fase 3** → Criar código real para Portal do Cliente
4. **Aprofundar Fase 4** → Criar código real para Sessões Remotas
5. **Aprofundar Fase 5** → Criar código real para Relatórios + LGPD
6. **Fase 6** → Testes, segurança, go-live

Cada fase será detalhada com:
- Código real das entidades, services, controllers
- Telas do frontend com componentes
- Testes automatizados
- Documentação de API

---

*Documento gerado como referência de arquitetura do MIConectaRMM Enterprise v2.0*
*Maginf Tecnologia © 2026*
