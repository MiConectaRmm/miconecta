# CHANGELOG

Todas as mudanças relevantes deste projeto serão documentadas neste arquivo.

O formato segue as convenções do [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]
- Início do registro de mudanças.

## Histórico recente
- 2026-03-25: feat: incluir versão do agente no cabeçalho dos scripts .bat e .ps1 gerados para instalação
- 2026-03-25: fix: tray icon, concluir button visibility (client+technician)
- 2026-03-24: feat: conclusao ticket + pesquisa satisfacao 5 carinhas + media dashboard + notificacao tecnico responde
- 2026-03-24: feat: central de chat multi-atendimento para tecnicos (WhatsApp-style)
- 2026-03-24: fix: emitir WebSocket ao criar ticket/enviar msg via agent REST + dialog TopMost
- 2026-03-24: fix: chat - botao fechar visivel, recarregar config ao abrir chat, recriar api client
- 2026-03-24: fix: upsert agent no registrar para evitar duplicate key
- 2026-03-24: fix: registrar aceita provision token do tenant como fallback
- 2026-03-23: fix: MSI x64 com ServiceInstall no componente do exe + recovery via script + log verbose
- 2026-03-23: fix: scripts instalacao criam agent.config e iniciam servico apos MSI
- 2026-03-23: feat: chat nativo (widget Zendesk-style) - endpoints backend agents/me/tickets, ChatForm WinForms, MSI com tray em subpasta
- 2026-03-23: fix: .bat download powershell em linha unica (sem ^ de continuacao)
- 2026-03-23: feat: MSI v2.0 em assets/ + Dockerfile copia assets + endpoint busca assets e uploads
- 2026-03-23: feat: agente auto-download MSI via .bat/.ps1 + endpoint GET /agents/download/msi + MSI v2.0.0 gerado
- 2026-03-23: feat: tab Instalar Agente por cliente com download .bat e .ps1
- 2026-03-23: fix: fluxo completo de consentimento de sessao remota
- 2026-03-23: config: RustDesk Oracle Cloud - IP 136.248.114.218
- 2026-03-23: fix: usar npm install no Dockerfile (sem package-lock.json no contexto)
- 2026-03-23: feat: acesso remoto auditado - fluxo consentimento + RustDesk Oracle Cloud placeholders
- 2026-03-23: fix: liberar acesso tecnico - sistema uso interno Maginf, todos de confianca
- 2026-03-23: fix: JWT 8h+30d, mutex refresh, tecnico pode ver agentes/scripts
- 2026-03-22: fix: desabilitar SSL e usar conexao direta PG (.internal:5433) para resolver Connection terminated unexpectedly
- 2026-03-22: fix: pool PostgreSQL + keepAlive para evitar Connection terminated unexpectedly no Fly.io
- 2026-03-22: feat: logo MIConecta no login, sidebar, portal e favicon
- 2026-03-22: fix: dashboard nao chama technicians.contagem para tecnico + desabilita auto_stop_machines
- 2026-03-22: fix: RBAC/tenant - tecnico vê dados do próprio tenant, superadmin continua global
- 2026-03-22: feat: nova identidade visual MIConecta - paleta azul/roxa, dark mode, CSS variables, branding assets
- 2026-03-21: chore: switch production domains to maginf
- 2026-03-21: fix: use production backend url for agent defaults
- 2026-03-21: fix: preserve actual rustdesk id on device heartbeat
- 2026-03-21: feat: dispatch scripts to online agents via websocket
- 2026-03-21: fix: use JWT agent auth for heartbeat and align agent heartbeat payload
- 2026-03-21: fix: allow agent registration by ensuring default organization
- 2026-03-21: fix: destravar registro do agente e criar organizacao padrao
- 2026-03-21: fix: HeartbeatService duplicated code, SocketIO namespace conflict, int? conversion
- 2026-03-21: fix: AgentAuthGuard JWT verify, DevicesModule JwtModule, LocalStateStore AppDir, users.module cleanup
- 2026-03-21: feat: Fases 1-7 completas - WebSocket, RustDesk, Telemetria, ScriptWS, Chat, Patches, AutoUpdate
- 2026-03-21: fase1: LocalStateStore, AgentIdentityService, loggedUser, check-update endpoint, devices com metricas inline
- 2026-03-21: fix: corrigir status tickets, mapeamento prioridade e tratamento defensivo de arrays
- 2026-03-21: fix: corrigir arquivos de redirect corrompidos em clientes/
- 2026-03-21: fix: auditoria completa - redirect login, mapping technicians, CORS prod, rotas duplicadas, hook duplicado
- 2026-03-21: Etapa 5: Configurações reorganizadas com 5 abas (Geral, Scripts, Patches, LGPD, Integrações)
- 2026-03-21: feat: WebSocket real-time na Central de Atendimento (Etapa 3)
- 2026-03-21: feat: hub do cliente com 9 abas (Etapa 2) - Cadastro, Usuarios, Dispositivos, Alertas, Tickets, Scripts, Software, Patches, Sessoes - cada aba como componente separado em tabs/ - lazy loading por aba, sidebar resumo + navegacao vertical
- 2026-03-21: refactor: sidebar 5 itens + dashboard executivo + central de atendimento
- 2026-03-21: refactor: portal users integrados na página da empresa - removido sidebar/dashboard links separados
- 2026-03-21: feat: portal users management - CRUD com limite dinâmico por tenant, tab Usuários do Portal, documentação AI
- 2026-03-21: feat: fix client users page - add senha/funcao/tenantId fields, enforce max 5 users per tenant
- 2026-03-21: fix: add tenantId to filter DTOs (devices, tickets, sessions, alerts) - fix 400 Bad Request
- 2026-03-21: chore: add .dockerignore for faster deploys, update create-admin.js seed script
