# C. MÓDULOS DO DOMÍNIO (Consolidado)

## C.1 Lista Definitiva — 20 Módulos

```
Nº   Módulo              Responsabilidade                                    Entidades
──── ─────────────────── ───────────────────────────────────────────────────  ──────────────────────
01   auth                Login, logout, JWT, refresh token, reset senha       (usa technician, client_user)
02   users               CRUD de technicians + client_users                   technician, client_user
03   roles               Roles e permissions, RBAC engine                     role, permission (JSONB)
04   tenants             CRUD de clientes/tenants, configurações              tenant
05   organizations       Filiais/sites/unidades por tenant                    organization
06   devices             Registro, inventário, status, tags                   device, device_inventory
07   agents              Provisionamento, tokens, heartbeat, comandos         (usa device + tokens)
08   metrics             Coleta, armazenamento, agregação                     device_metric
09   alerts              Motor de regras, criação, escalonamento              alert, alert_rule
10   tickets             Help desk, SLA, workflow                             ticket, ticket_comment, ticket_category, ticket_sla_config
11   chat                Mensagens real-time, histórico                       chat_message
12   remote-sessions     Sessões remotas, consentimento, auditoria           remote_session, remote_session_log
13   scripts             Biblioteca, execução remota, resultados             script, script_execution
14   software            Pacotes, deploy, progresso                          software_package, software_deployment
15   patches             Sincronização Windows Update, políticas             patch
16   reports             Geração, agendamento, templates                     report_schedule
17   notifications       In-app, email, push, preferências                   notification, notification_preference
18   storage             Upload/download S3, controle de acesso              file_attachment
19   lgpd                Consentimento, retenção, DSAR, termos               consent_record, lgpd_request
20   audit               Trilha imutável, exportação                         audit_log
```

## C.2 Dependências entre Módulos

```
auth ──────► users, roles
users ─────► tenants, roles, notifications
tenants ───► organizations
devices ───► tenants, organizations, agents
agents ────► devices, auth
metrics ───► devices
alerts ────► devices, metrics, tickets (auto-criação), notifications
tickets ───► tenants, devices, users, chat, remote-sessions, notifications, storage
chat ──────► tickets, users, gateway (WebSocket)
remote-sessions ► devices, tickets, users, lgpd (consentimento), audit, storage
scripts ───► devices, agents, audit
software ──► devices, agents, storage
patches ───► devices, agents
reports ───► tenants, devices, tickets, metrics, alerts
notifications ► users, gateway (WebSocket)
storage ───► tenants (quotas)
lgpd ──────► tenants, users, audit, storage
audit ─────► (autônomo — interceptor captura tudo)
```

## C.3 Detalhamento dos Módulos Críticos

### M01 — Auth

```
Endpoints:
POST   /auth/login              → Login (email+senha) → access_token + refresh_token
POST   /auth/refresh            → Renovar access_token com refresh_token
POST   /auth/logout             → Invalidar refresh_token (blacklist Redis)
POST   /auth/forgot-password    → Enviar email de recuperação
POST   /auth/reset-password     → Redefinir senha com token do email
GET    /auth/me                 → Dados do usuário autenticado

Lógica:
- Detecta tipo de usuário pelo email (Technician ou ClientUser)
- JWT payload: { sub, tenantId, userType, role, permissions[] }
- Access token: 15 minutos | Refresh token: 7 dias
- Refresh token rotation: a cada uso, gera novo refresh token
- Blacklist de tokens revogados no Redis (TTL = expiração do token)
- Rate limit: 5 tentativas / 15 min por IP+email
- Lockout: após 10 tentativas → bloqueia 30 minutos
- Audit: registra toda tentativa (sucesso e falha)
```

### M02 — Users

```
Endpoints (Technicians — admin_maginf+):
GET    /users/technicians        → Listar técnicos Maginf
POST   /users/technicians        → Criar técnico
PUT    /users/technicians/:id    → Atualizar
DELETE /users/technicians/:id    → Desativar

Endpoints (ClientUsers — admin_maginf+ ou admin_cliente):
GET    /users/clients            → Listar usuários do tenant
POST   /users/clients            → Criar (envia convite email)
PUT    /users/clients/:id        → Atualizar
DELETE /users/clients/:id        → Desativar
POST   /users/clients/invite     → Reenviar convite

Lógica:
- Technician pertence à Maginf, tem lista tenants_atribuidos
- ClientUser pertence a tenant específico
- Admin do cliente pode CRUD usuários do próprio tenant
- Convite por email com token de ativação (24h validade)
- Primeiro acesso: definir senha + aceitar termos
```

### M03 — Roles & Permissions

```
Abordagem: RBAC com roles pré-definidas + permissions granulares

Roles fixas (não editáveis):
MAGINF: super_admin, admin_maginf, tecnico_senior, tecnico, visualizador
CLIENTE: admin_cliente, gestor, usuario

Permissions (recurso:ação):
tenants:read, tenants:write, tenants:delete
devices:read, devices:write, devices:remote_access
tickets:read, tickets:write, tickets:assign, tickets:close
chat:read, chat:write
scripts:read, scripts:execute, scripts:manage
reports:read, reports:generate
audit:read, audit:export
users:read, users:write, users:invite
lgpd:manage, lgpd:export
alerts:read, alerts:acknowledge, alerts:configure
sessions:read, sessions:initiate

Guard: @RequirePermissions('tickets:write', 'devices:read')
→ Verifica se o role do usuário contém TODAS as permissions listadas
```

### M07 — Agents

```
Endpoints:
POST   /agents/provision                → Gerar token de provisionamento
POST   /agents/register                 → Agente se registra
POST   /agents/heartbeat                → Heartbeat + métricas
POST   /agents/inventory                → Envio de inventário
GET    /agents/commands/:deviceId       → Poll de comandos pendentes
POST   /agents/commands/:id/result      → Resultado de comando
POST   /agents/chat/message             → Mensagem do chat local
GET    /agents/chat/messages            → Mensagens pendentes

Tipos de comando:
executar_script, instalar_software, coletar_inventario,
solicitar_consentimento_remoto, atualizar_agente
```

### M10 — Tickets

```
Endpoints:
GET    /tickets                  → Listar (filtros: status, prioridade, tenant)
GET    /tickets/:id              → Detalhes + timeline completa
POST   /tickets                  → Criar ticket
PUT    /tickets/:id              → Atualizar
PUT    /tickets/:id/assign       → Atribuir a técnico
PUT    /tickets/:id/resolve      → Resolver
PUT    /tickets/:id/close        → Fechar
PUT    /tickets/:id/reopen       → Reabrir
POST   /tickets/:id/comment      → Adicionar comentário/nota
POST   /tickets/:id/rate         → Avaliar atendimento
GET    /tickets/categories       → Listar categorias

Workflow de Estados:
ABERTO → EM_ATENDIMENTO → AGUARDANDO_CLIENTE → RESOLVIDO → FECHADO
                        → AGUARDANDO_TECNICO ↗
FECHADO → ABERTO (reabrir)

SLA Engine:
- Cada tenant tem SLA configurado por prioridade
- urgente=1h/4h, alta=2h/8h, média=4h/24h, baixa=8h/72h
- Job BullMQ monitora a cada 5 minutos
- 80% do tempo: notificação ao técnico
- SLA estourado: notificação ao admin + escalonamento
```

### M11 — Chat

```
REST (histórico):
GET    /chat/tickets/:ticketId/messages
POST   /chat/tickets/:ticketId/messages
PUT    /chat/messages/:id/read

WebSocket (namespace /chat):
Client → Server:
  chat:join_ticket     { ticketId }
  chat:leave_ticket    { ticketId }
  chat:send_message    { ticketId, conteudo, tipo }
  chat:typing          { ticketId, isTyping }
  chat:read_messages   { ticketId, messageIds[] }

Server → Client:
  chat:new_message     { message }
  chat:user_typing     { ticketId, userId, nome, isTyping }
  chat:messages_read   { ticketId, messageIds[], readBy }

Regras:
- Toda mensagem vinculada a ticket (obrigatório)
- Mensagens de sistema automáticas (sessão, script, alerta)
- Persistência no banco ANTES de emitir evento WebSocket
- REST como fallback se WebSocket indisponível
- Redis PubSub para múltiplas instâncias
```

### M12 — Remote Sessions

```
Endpoints:
POST   /remote-sessions             → Solicitar sessão
GET    /remote-sessions/:id         → Status da sessão
PUT    /remote-sessions/:id/consent → Registrar consentimento
PUT    /remote-sessions/:id/start   → Marcar como iniciada
PUT    /remote-sessions/:id/end     → Marcar como finalizada
POST   /remote-sessions/:id/log     → Registrar ação
GET    /remote-sessions/:id/logs    → Listar logs
GET    /remote-sessions/:id/report  → Relatório da sessão

Estados:
SOLICITADA → CONSENTIMENTO_PENDENTE → CONSENTIDA → ATIVA → FINALIZADA
                                    → RECUSADA
                                                  → ERRO
```

### M16 — Reports

```
Tipos de relatório:
- Executivo mensal (para o cliente): parque, SLA, tickets, saúde
- Técnico semanal (para Maginf): performance, tempos, recorrências
- SLA: conformidade por tenant
- Inventário: hardware/software por tenant
- Alertas: recorrências e tendências

Funcionalidades:
- Geração sob demanda ou agendada (diário/semanal/mensal)
- Templates customizáveis por tenant
- Exportação: PDF, CSV, Excel
- Envio automático por email
- Armazenamento em S3
```

### M19 — LGPD

```
Funcionalidades:
1. Consentimento de acesso remoto (popup no dispositivo)
2. Política de retenção configurável por tenant (ex: 12 meses)
3. Job de limpeza automática de dados expirados
4. Anonimização em vez de exclusão hard
5. Exportação de dados do titular (DSAR) em até 15 dias úteis
6. Solicitação de exclusão com registro
7. Versionamento de termos de uso
8. Aceite obrigatório no primeiro login do portal
9. Registro de todo consentimento com timestamp + IP
```
