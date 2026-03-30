# Instalador MIConecta Agent (Windows)

## Pacote oficial (produção)

O **MSI** publicado em `backend/assets/MIConectaSetup.msi` é gerado pelo pipeline existente:

```powershell
# Na raiz do repositório
.\build-agent.ps1
```

Isso compila o **serviço** (`MIConectaAgent`) e o **Tray** via **WiX Toolset**, alinhado ao download público `GET /api/v1/agents/download/msi`.

## White-label por cliente (Fase 6)

1. No painel, abra o cliente (tenant) e use **Gerar instalador** — ou chame `POST /api/v1/clients/:tenantId/generate-installer` com JWT e permissão `devices:write`.
2. A API cria um **installation_token** único e devolve scripts **PS1** e **BAT** já com `ProvisionToken`, `TenantId`, URLs e RustDesk a partir do `.env` do backend.
3. Execute o **.ps1** como Administrador na máquina do cliente (baixa o MSI, instala, grava `agent.config`, inicia o serviço).

Revogar token: `DELETE /api/v1/agents/installation-tokens/:id` (mesmo fluxo já existente).

## Inno Setup (opcional)

O projeto **prioriza WiX** no `build-agent.ps1`. O ficheiro `MIConectaSetup.iss` nesta pasta é um **esqueleto** de referência: pode copiar os artefactos publicados (`MIConectaAgent.exe`, DLLs, Tray) e ajustar caminhos antes de compilar com `ISCC.exe`, se a equipa padronizar Inno em vez de WiX.

```powershell
# Exemplo (requer Inno Setup 6 no PATH)
# iscc.exe .\installer\MIConectaSetup.iss
```

## Teste de instalação limpa

1. VM Windows 10/11 sem agente anterior (ou desinstalar MSI e apagar `%ProgramFiles%\MIConecta`).
2. Gerar pacote pela API; guardar o `.ps1` e executar elevado.
3. Confirmar serviço **MIConectaRMMAgent** em execução e dispositivo no dashboard.
4. Opcional: bandeja MIConecta Tray se incluída no MSI.

## Riscos / pendências

- **RustDesk** no `agent.config` vem de `RUSTDESK_SERVER` / `RUSTDESK_KEY` no backend; sem variáveis, o script usa apenas fallback de servidor relay.
- **BAT** com caracteres especiais na chave RustDesk pode exigir ajuste manual; prefira **PS1** em produção.
- **Inno** não substitui o MSI WiX até a equipa migrar o pipeline de release.
