# E. TEMPO REAL (Real-Time)

## E.1 Decisão: Socket.IO

| Opção | Prós | Contras | Veredicto |
|---|---|---|---|
| **Socket.IO** | Auto-reconnect, rooms, namespaces, fallback polling, integração NestJS nativa | Overhead vs raw WS | ✅ **Escolhido** |
| **Raw WebSocket** | Menor overhead | Sem rooms, sem auto-reconnect, sem fallback | ❌ Muito baixo nível |
| **SSE (Server-Sent Events)** | Simples | Unidirecional, sem rooms | ❌ Insuficiente |
| **Mercure** | HTTP-based pub/sub | Requer serviço separado | ❌ Complexidade extra |

### Justificativa Socket.IO
1. NestJS tem `@nestjs/platform-socket.io` com decorators nativos
2. Rooms permitem isolar por tenant, ticket, device
3. Namespaces separam domínios (chat vs alerts vs devices)
4. Auto-reconnect é crítico para agentes Windows instáveis
5. Fallback para HTTP long-polling se WebSocket bloqueado por firewall
6. Redis adapter para escalar horizontalmente (múltiplas instâncias)

## E.2 Arquitetura WebSocket

```
┌─────────────────────────────────────────────────────────────────┐
│                   SOCKET.IO GATEWAY                              │
│                                                                  │
│  Autenticação: JWT no handshake (query param ou auth header)    │
│  Middleware: valida token → extrai userId, tenantId, userType   │
│                                                                  │
│  ┌─── Namespace /chat ────────────────────────────────────┐     │
│  │  Rooms:                                                 │     │
│  │  • ticket:{ticketId}  → todos os participantes         │     │
│  │  • user:{userId}      → room pessoal                   │     │
│  │  Eventos:                                               │     │
│  │  • chat:send_message → chat:new_message                │     │
│  │  • chat:typing → chat:user_typing                      │     │
│  │  • chat:read_messages → chat:messages_read             │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─── Namespace /alerts ──────────────────────────────────┐     │
│  │  Rooms: tenant:{tenantId}                               │     │
│  │  Eventos:                                               │     │
│  │  • alert:new, alert:resolved, alert:escalated          │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─── Namespace /devices ─────────────────────────────────┐     │
│  │  Rooms: tenant:{tenantId}, device:{deviceId}            │     │
│  │  Eventos:                                               │     │
│  │  • device:status_changed                               │     │
│  │  • device:metrics_updated                              │     │
│  │  • device:inventory_updated                            │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─── Namespace /tickets ─────────────────────────────────┐     │
│  │  Rooms: tenant:{tenantId}, ticket:{ticketId}            │     │
│  │  Eventos:                                               │     │
│  │  • ticket:created, ticket:updated, ticket:assigned     │     │
│  │  • ticket:status_changed, ticket:comment_added         │     │
│  │  • ticket:sla_warning, ticket:sla_breached             │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─── Namespace /sessions ────────────────────────────────┐     │
│  │  Rooms: session:{sessionId}                             │     │
│  │  Eventos:                                               │     │
│  │  • session:consent_requested/granted/denied            │     │
│  │  • session:started, session:ended                      │     │
│  │  • session:action_logged                               │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─── Namespace /notifications ───────────────────────────┐     │
│  │  Rooms: user:{userId}                                   │     │
│  │  Eventos:                                               │     │
│  │  • notification:new, notification:count                │     │
│  └─────────────────────────────────────────────────────────┘     │
│                                                                  │
│  ┌─── Namespace /agent ───────────────────────────────────┐     │
│  │  Rooms: device:{deviceId}                               │     │
│  │  Eventos:                                               │     │
│  │  • agent:command → agent:command_result                 │     │
│  │  • agent:consent_request → agent:consent_response      │     │
│  │  • agent:chat_message (bidirecional)                   │     │
│  └─────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

## E.3 Papel do Redis no Real-Time

```
1. SOCKET.IO ADAPTER
   @socket.io/redis-adapter
   → Sincroniza eventos entre múltiplas instâncias do backend
   → Se tiver 2+ instâncias, Redis garante que todos recebam

2. BULLMQ JOB QUEUE
   → Filas de jobs assíncronos com retry automático
   → Backoff exponencial em falhas
   → Dead letter queue para jobs falhados
   → Jobs: AlertEngine, SLAMonitor, Notification, Report, Retention

3. CACHE LAYER
   → Sessões de usuário (para logout global)
   → Contadores de rate limiting
   → Refresh token blacklist (TTL = expiração do token)
   → Dados frequentes: tenant config, user permissions
   → TTL configurável por tipo de dado

4. PRESENCE SYSTEM
   → SETEX user:{userId}:online 120 "true"
   → Expira em 120s se não renovado
   → Frontend envia ping a cada 60s
   → Usado para indicador online/offline no chat

5. PUBSUB (cross-instance)
   → Eventos que precisam chegar a todas as instâncias
   → Complementar ao Socket.IO adapter
   → Usado para invalidação de cache distribuída
```

## E.4 Fluxo Real-Time: Exemplo Chat

```
FRONTEND (Técnico)            BACKEND                    FRONTEND (Cliente)
      │                          │                              │
      │ chat:send_message        │                              │
      │ { ticketId, conteudo }   │                              │
      ├─────────────────────────►│                              │
      │                          │                              │
      │                          │ 1. Valida JWT + permissão    │
      │                          │ 2. Valida acesso ao ticket   │
      │                          │ 3. Persiste chat_message     │
      │                          │ 4. Publica via Redis PubSub  │
      │                          │    (para outras instâncias)  │
      │                          │ 5. Emite para room           │
      │                          │    ticket:{ticketId}         │
      │                          │                              │
      │ ◄── chat:new_message ────┤──── chat:new_message ───────►│
      │     { id, remetente,     │                              │
      │       conteudo, criado } │                              │
      │                          │ 6. Cria notification         │
      │                          │    para participantes offline │
      │                          │ 7. Se agente conectado:      │
      │                          │    emite para /agent          │
      │                          │    device:{deviceId}          │
```
