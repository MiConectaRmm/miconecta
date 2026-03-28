# MIConecta - Redesign Dashboard (v2.0)

## Alterações Implementadas

### 🎨 Tema Visual
- **Migração Dark → Light**: paleta neutra e profissional
- **Cores principais**:
  - Fundo: `#F7F8FA`
  - Cards: `#FFFFFF`
  - Texto: `#1F2937` / `#6B7280`
  - Acentos: Ciano `#2EA3E6` + Roxo `#7D3C98`
- **Design clean**: muito espaço em branco, bordas sutis, sombras leves

### 🧭 Navegação
- **Header fixo horizontal** (substituiu sidebar vertical)
- **Menu simplificado**: Dashboard | Chat/Ticket
- **Logo Miconecta** com gradiente ciano→roxo
- **Frase motivacional** rotativa no header
- **Perfil dropdown** com avatar, config e sair

### 👤 Perfil do Técnico
- **Dropdown** clicando no avatar no header:
  - Informações do usuário
  - Botão "Meu perfil"
  - Botão "Sair"
- **Modal de configurações**:
  - Upload de foto de perfil
  - Editar nome e e-mail
  - Alterar senha (requer senha atual)
  - Salvar alterações

### 🏠 Dashboard (Home)
- **Grid responsivo** de clientes (4 cols desktop)
- **Cards de cliente** com:
  - Nome do cliente
  - Status visual (OK/Atenção/Crítico)
  - Indicadores: dispositivos, online, offline, alertas, tickets
  - Hover suave com sombra
- **KPIs gerais** no topo
- **Auto-refresh** a cada 45 segundos

### 🏢 Detalhe do Cliente
- **KPIs no topo**: Total PCs, Servidores, Online, Offline, Alertas
- **Seção de download do agente**:
  - Botões para baixar scripts .BAT ou .PS1 personalizados
  - URL do MSI oficial
  - Copiar URL com um clique
- **Filtros**: Todos | Computadores | Servidores
- **Grid de máquinas** (4 cols) com:
  - Hostname e status (online/offline)
  - Métricas: CPU, RAM, Disco
  - Alertas inline
  - **3 botões de ação**:
    - 💬 **Chat**: cria conversa vinculada ao device
    - 🎫 **Ticket**: cria ticket vinculado ao device
    - 🖥️ **Conectar**: abre RustDesk (se configurado)

### 💬 Chat/Ticket (Inbox)
- **Layout 2 colunas**:
  - Lista de conversas/tickets à esquerda
  - Área de mensagens à direita
- **Tabs**: Tudo | Conversas | Tickets
- **Busca** por cliente, título, hostname
- **WebSocket real-time** com indicador de conexão
- **Som de notificação** ativável
- **Botões funcionais**:
  - Conectar remoto (RustDesk)
  - Finalizar ticket
  - Encerrar conversa

### 🔗 Integrações
- **Agente Windows** → Backend → Frontend (real-time)
- **RustDesk** pronto para uso nos cards
- **Upload de arquivos** via storageApi
- **Socket.io** para notificações instantâneas
- **Auto-refresh** em todas as páginas críticas

### 🗂️ Estrutura de Arquivos Criados/Modificados

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header.tsx (NOVO - substitui Sidebar)
│   │   └── ProfileModal.tsx (NOVO)
│   ├── app/
│   │   ├── globals.css (ATUALIZADO - tema light)
│   │   └── dashboard/
│   │       ├── layout.tsx (REFATORADO - sem sidebar)
│   │       ├── page.tsx (REFATORADO - grid clientes)
│   │       ├── chat/page.tsx (REFATORADO - tema light)
│   │       └── clients/[id]/page.tsx (REFATORADO - grid máquinas + botões)
│   ├── stores/
│   │   └── auth.store.ts (ATUALIZADO - profilePhotoUrl)
│   └── lib/
│       └── api.ts (ATUALIZADO - updateProfile endpoint)
├── tailwind.config.ts (ATUALIZADO - novas cores)

backend/
└── src/
    └── modules/
        └── auth/
            ├── auth.controller.ts (NOVO endpoint PUT /auth/profile)
            └── auth.service.ts (NOVA função updateProfile)
```

### 🚀 Como Testar

1. **Iniciar o backend**: `cd backend && npm run dev`
2. **Iniciar o frontend**: `cd frontend && npm run dev`
3. **Acessar**: `http://localhost:3000`
4. **Login** com suas credenciais
5. **Explorar**:
   - Dashboard → ver grid de clientes
   - Clicar em cliente → ver máquinas
   - Testar botões Chat/Ticket/Conectar
   - Abrir dropdown perfil → testar modal configurações
   - Ir para Chat/Ticket → inbox unificado

### ⚠️ Notas Importantes

- O upload de foto requer o endpoint `/storage/upload` funcionando
- RustDesk só funciona se `device.rustdeskId` estiver configurado
- Botão "Conectar" usa protocolo `rustdesk://` (requer RustDesk instalado no PC do técnico)
- Scripts de instalação do agente já incluem token de provisionamento único por cliente
- Todas as cores antigas (dark-*) foram migradas para light (gray-*/white)

### 🎯 Funcionalidades Prontas

✅ Header horizontal com menu simplificado
✅ Tema light profissional
✅ Perfil com upload de foto
✅ Dashboard com grid de clientes
✅ Detalhe cliente com grid de máquinas
✅ Botões Chat/Ticket/Conectar funcionais
✅ Download de agente por cliente
✅ Inbox unificado (conversas + tickets)
✅ Integração completa com agente Windows
✅ Real-time via Socket.io
✅ Auto-refresh automático

---

**MIConecta RMM - Gestão de TI para MSPs**
*Desenvolvido por Maginf Tecnologia*
