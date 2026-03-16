# G. SESSÃO REMOTA (Desenho Técnico Completo)

## G.1 Fluxo Detalhado

```
TÉCNICO (Painel)               BACKEND                     AGENTE (Windows)
      │                           │                              │
 1. Clica "Acesso Remoto"        │                              │
    no ticket ou device           │                              │
      │                           │                              │
 2. POST /remote-sessions         │                              │
    { deviceId, ticketId,         │                              │
      motivo: "Resolver #1234" }  │                              │
      ├──────────────────────────►│                              │
      │                           │ 3. Cria RemoteSession        │
      │                           │    status: SOLICITADA        │
      │                           │                              │
      │                           │ 4. Verifica permissão:       │
      │                           │    técnico tem acesso ao     │
      │                           │    tenant/device?            │
      │                           │                              │
      │                           │ 5. WebSocket /agent:         │
      │                           │    agent:consent_request     │
      │                           ├─────────────────────────────►│
      │                           │ { sessionId, techName,       │
      │                           │   motivo, ticketNum }        │
      │                           │                              │
      │                           │ 6. status →                  │
      │                           │    CONSENTIMENTO_PENDENTE    │
      │                           │                              │
      │ session:updated ◄─────────┤                              │
      │ (pendente)                │                              │
      │                           │                              │
      │                           │    8. Agente exibe popup:    │
      │                           │ ┌──────────────────────────┐ │
      │                           │ │ 🔒 MIConectaRMM          │ │
      │                           │ │                           │ │
      │                           │ │ O técnico João Silva     │ │
      │                           │ │ da Maginf Tecnologia     │ │
      │                           │ │ solicita acesso remoto.  │ │
      │                           │ │                           │ │
      │                           │ │ Motivo: Resolver         │ │
      │                           │ │ ticket #1234             │ │
      │                           │ │                           │ │
      │                           │ │ [✅ Permitir]            │ │
      │                           │ │ [❌ Recusar]             │ │
      │                           │ │                           │ │
      │                           │ │ Suas ações poderão       │ │
      │                           │ │ ser registradas.         │ │
      │                           │ └──────────────────────────┘ │
```

### SE PERMITIR:

```
      │                           │                              │
      │                           │ 9. agent:consent_response    │
      │                           │◄─────────────────────────────┤
      │                           │ { sessionId,                 │
      │                           │   consentido: true,          │
      │                           │   usuarioLocal: "maria",     │
      │                           │   timestamp, ip }            │
      │                           │                              │
      │                           │ 10. Cria ConsentRecord       │
      │                           │     (registro LGPD imutável) │
      │                           │                              │
      │                           │ 11. status → CONSENTIDA      │
      │                           │                              │
      │                           │ 12. Obtém RustDesk ID        │
      │                           │     do device                │
      │                           │                              │
      │                           │ 13. status → ATIVA           │
      │                           │     iniciadaEm: now()        │
      │                           │                              │
      │ session:started ◄─────────┤─────────────────────────────►│
      │ { rustdeskId, key }       │                              │
      │                           │                              │
 14. Frontend abre RustDesk       │                              │
     (via URI protocol)           │                              │
      │                           │                              │
 15. Mensagem automática no chat: │                              │
     "🟢 Sessão remota iniciada   │                              │
      por João Silva"             │                              │
```

### DURANTE A SESSÃO:

```
      │                           │                              │
      │                           │ 16. Agente registra ações:   │
      │                           │◄─────────────────────────────┤
      │                           │ POST /remote-sessions/:id/log│
      │                           │ { tipo: "processo",          │
      │                           │   descricao: "Abriu cmd.exe",│
      │                           │   detalhes: { pid, args } }  │
      │                           │                              │
      │                           │ 17. Screenshot periódico:    │
      │                           │◄─────────────────────────────┤
      │                           │ POST /storage/upload         │
      │                           │ (imagem → S3)                │
      │                           │ + log { tipo: "screenshot",  │
      │                           │   arquivo_url: "s3://..." }  │
```

### AO FINALIZAR:

```
 18. Técnico clica "Encerrar"     │                              │
     (ou sessão RustDesk encerra) │                              │
      │                           │                              │
     PUT /remote-sessions/:id/end │                              │
      ├──────────────────────────►│                              │
      │                           │ 19. status → FINALIZADA      │
      │                           │     finalizadaEm: now()      │
      │                           │     duracaoSegundos: calc    │
      │                           │                              │
      │                           │ 20. Gera resumo automático   │
      │                           │ 21. Mensagem no chat:        │
      │                           │     "🔴 Sessão encerrada     │
      │                           │      Duração: 12min 34s"     │
      │                           │ 22. Audit log registrado     │
      │                           │ 23. Comment na timeline      │
      │                           │     do ticket                │
```

### SE RECUSAR:

```
      │                           │ 9b. agent:consent_response   │
      │                           │◄─────────────────────────────┤
      │                           │ { consentido: false }        │
      │                           │                              │
      │                           │ 10b. ConsentRecord           │
      │                           │      (consentido: false)     │
      │                           │ 11b. status → RECUSADA       │
      │                           │                              │
      │ session:denied ◄──────────┤                              │
      │                           │ 12b. Chat: "⚠️ Acesso       │
      │                           │ remoto recusado pelo         │
      │                           │ usuário do dispositivo"      │
```

## G.2 Estados da Sessão

```
┌────────────┐  solicitar  ┌──────────────────────┐
│ SOLICITADA ├────────────►│CONSENTIMENTO_PENDENTE│
└────────────┘             └──────────┬───────────┘
                                      │
                           ┌──────────┴──────────┐
                           ▼                     ▼
                    ┌────────────┐        ┌──────────┐
                    │ CONSENTIDA │        │ RECUSADA  │ (terminal)
                    └─────┬──────┘        └──────────┘
                          │
                          ▼
                    ┌──────────┐
                    │  ATIVA   │
                    └─────┬────┘
                          │
                    ┌─────┴─────┐
                    ▼           ▼
             ┌────────────┐ ┌───────┐
             │ FINALIZADA │ │ ERRO  │ (terminal)
             └────────────┘ └───────┘
```

## G.3 Exibição no Portal do Cliente

```
O cliente vê na timeline do ticket:

14:30  🎫  Ticket #1234 criado por Maria (Portal)
14:32  💬  "Meu mouse não está funcionando"
14:35  👤  Ticket atribuído ao técnico João Silva
14:35  💬  João: "Vou verificar. Posso acessar remotamente?"
14:36  💬  Maria: "Pode sim"
14:37  🔒  Acesso remoto solicitado por João Silva
14:37  ✅  Acesso remoto autorizado por maria@DESKTOP-ABC
14:37  🟢  Sessão remota iniciada (12min 34s)
14:50  🔴  Sessão remota encerrada
14:50  💬  João: "Problema resolvido. Era o driver do mouse."
14:51  ✅  Ticket resolvido por João Silva

O cliente NÃO vê:
- Logs técnicos detalhados (processos, comandos)
- Screenshots capturados durante a sessão
- Notas internas do técnico

O admin do cliente pode solicitar:
- Exportação completa dos logs (via LGPD request)
- Relatório da sessão (resumo não-técnico)
```

## G.4 Exibição no Painel Maginf

```
O técnico vê tudo:

TIMELINE DO TICKET:
├── Mensagens do chat
├── Eventos do sistema (status changes)
├── Sessão remota com detalhes:
│   ├── Duração
│   ├── Quem autorizou
│   ├── Logs de ações (processos, comandos)
│   ├── Screenshots capturados
│   └── Resumo gerado
├── Scripts executados + resultado
├── Alertas relacionados
└── Anexos e evidências

PAINEL DE SESSÕES REMOTAS:
├── Lista de sessões ativas (real-time)
├── Histórico de sessões por device/tenant
├── Métricas: duração média, recusas, frequência
└── Alertas de sessões longas (>60min)
```
