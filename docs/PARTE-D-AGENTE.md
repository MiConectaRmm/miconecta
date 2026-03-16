# D. MODELO DE COMUNICAÇÃO DO AGENTE

## D.1 Ciclo de Vida Completo

### FASE 1: PROVISIONAMENTO

```
Admin Maginf → Painel → "Gerar Token de Instalação"
                           │
                           ▼
                    Token UUID gerado
                    Vinculado ao tenant_id
                    Validade: 30 dias
                    Uso: múltiplo (vários devices)
                           │
                           ▼
                    Embutido no instalador .exe
                    (ou passado como parâmetro:
                     MIConectaSetup.exe /TOKEN=abc-123)
```

### FASE 2: REGISTRO INICIAL

```
Agente inicia pela primeira vez
     │
     ▼
POST /api/v1/agents/register
Headers: X-Agent-Provision-Token: <token>
Body: {
  hostname: "DESKTOP-ABC",
  sistemaOperacional: "Windows 11 Pro 23H2",
  cpu: "Intel Core i7-12700",
  ramTotalMb: 16384,
  discoTotalMb: 512000,
  discoDisponivelMb: 320000,
  ipLocal: "192.168.1.100",
  ipExterno: "200.x.x.x",
  modeloMaquina: "Dell Optiplex 7090",
  numeroSerie: "ABC123XYZ",
  agentVersion: "2.0.0"
}
     │
     ▼
Backend:
1. Valida provision token → extrai tenant_id
2. Verifica se device já existe (hostname + tenant_id)
3. Se novo: cria Device + gera device_token (JWT permanente)
4. Se existente: atualiza dados + retorna device_token existente
5. Retorna: { deviceId, deviceToken, tenantId, configuracoes }
     │
     ▼
Agente salva device_token localmente
(Windows Credential Manager — criptografado via DPAPI)
```

### FASE 3: OPERAÇÃO NORMAL

```
A cada 60 segundos — HEARTBEAT:
┌────────────────────────────────────────────────────────────┐
│ POST /api/v1/agents/heartbeat                              │
│ Headers: Authorization: Bearer <device_token>              │
│ Body: {                                                    │
│   deviceId: "uuid",                                        │
│   cpuPercent: 45.2,                                        │
│   ramPercent: 68.1,                                        │
│   ramUsadaMb: 11100,                                       │
│   discoPercent: 37.5,                                      │
│   discoUsadoMb: 192000,                                    │
│   temperatura: 62.0,                                       │
│   uptimeSegundos: 345600,                                  │
│   redeEntradaBytes: 1048576,                               │
│   redeSaidaBytes: 524288,                                  │
│   antivirusStatus: "atualizado",                           │
│   antivirusNome: "Windows Defender"                        │
│ }                                                          │
│                                                            │
│ Response: {                                                │
│   status: "ok",                                            │
│   commands: [                                              │
│     { id: "cmd-1", tipo: "executar_script", payload: {} }, │
│     { id: "cmd-2", tipo: "coletar_inventario" }           │
│   ]                                                        │
│ }                                                          │
└────────────────────────────────────────────────────────────┘

A cada 6 horas (ou sob demanda) — INVENTÁRIO:
┌────────────────────────────────────────────────────────────┐
│ POST /api/v1/agents/inventory                              │
│ Body: {                                                    │
│   deviceId: "uuid",                                        │
│   hardware: { ... detalhes completos ... },                │
│   software: [                                              │
│     { nome: "Google Chrome", versao: "122.0", editor: ".."│
│   ],                                                       │
│   servicos: [                                              │
│     { nome: "Spooler", status: "running" }                 │
│   ],                                                       │
│   windowsUpdates: [                                        │
│     { kb: "KB5034441", titulo: "...", instalado: false }   │
│   ]                                                        │
│ }                                                          │
└────────────────────────────────────────────────────────────┘
```

### FASE 4: RESILIÊNCIA OFFLINE

```
Se o agente não consegue alcançar o backend:
1. Continua coletando métricas localmente
2. Armazena em fila local (SQLite ou arquivo JSON rotativo)
3. Capacidade: 24h de métricas (1440 registros)
4. Ao reconectar: envia batch de métricas acumuladas
   POST /api/v1/agents/heartbeat/batch
5. Comandos pendentes são executados quando reconectar
6. Indicador visual no tray icon: 🔴 Offline / 🟢 Conectado
7. Retry com backoff exponencial: 10s → 30s → 60s → 5min → 15min
```

### FASE 5: ATUALIZAÇÃO DO AGENTE

```
Backend envia comando: { tipo: "atualizar_agente", payload: { versao: "2.1.0", url: "...", sha256: "..." } }
1. Agente baixa nova versão do S3
2. Verifica hash SHA256
3. Salva em diretório temporário
4. Para o serviço Windows atual
5. Substitui executável
6. Reinicia serviço
7. Envia confirmação de versão atualizada
8. Se falhar: rollback para versão anterior
```

## D.2 Segurança do Agente

```
AUTENTICAÇÃO:
- Provision token: UUID v4, curta duração (30 dias), revogável
- Device token: JWT assinado, sem expiração (revogável pelo admin)
  Payload: { sub: deviceId, tenantId, type: 'agent' }
- AgentAuthGuard valida device_token separadamente do user JWT

CRIPTOGRAFIA:
- Toda comunicação via HTTPS (TLS 1.3)
- Device token armazenado no Windows Credential Manager
- Configurações locais criptografadas com DPAPI

ANTI-TAMPER:
- Agente verifica integridade do próprio executável
- Se token revogado → agente para de enviar dados
- Se device desativado → agente recebe instrução de parar
- Logs locais do agente protegidos contra edição
```

## D.3 Comunicação WebSocket do Agente

```
O agente também pode conectar via WebSocket (namespace /agent)
para receber comandos em tempo real em vez de polling:

Conexão:
  io("wss://api.miconecta.com.br/agent", {
    auth: { token: deviceToken }
  })

Eventos recebidos:
  agent:command             → comando para executar
  agent:consent_request     → solicitar consentimento de sessão remota
  agent:chat_new_message    → nova mensagem no chat do device

Eventos enviados:
  agent:command_result      → resultado do comando
  agent:consent_response    → resposta do consentimento
  agent:chat_message        → mensagem do usuário local

Fallback:
  Se WebSocket não disponível (firewall corporativo):
  → Agente faz polling via REST a cada 30 segundos
  → GET /agents/commands/:deviceId
```
