# Guia Rápido - Novo Dashboard MIConecta

## 🚀 Início Rápido

### 1. Iniciar o projeto

```bash
# Backend
cd backend
npm install
npm run dev

# Frontend (outro terminal)
cd frontend
npm install
npm run dev
```

### 2. Acessar
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:4000`

---

## 🎯 Navegação Principal

### Header (sempre visível)
- **Logo**: clique para voltar ao Dashboard
- **Dashboard**: lista de todos os clientes
- **Chat/Ticket**: inbox unificado de atendimento
- **Avatar**: dropdown com configurações e logout

---

## 📊 Dashboard - Tela Principal

### O que você vê:
- **4 KPIs** no topo: total dispositivos, online, offline, alertas
- **Grid de clientes**: cards com status e indicadores
- **Auto-refresh**: atualiza a cada 45s automaticamente

### Ações:
- **Clique em qualquer cliente** → abre detalhe do parque tecnológico

---

## 🏢 Detalhe do Cliente

### Seções:

#### 1. KPIs (topo)
- Total PCs | Servidores | Online | Offline | Alertas

#### 2. Download do Agente
- **Script .BAT** ou **.PS1** personalizado
- Já contém: server URL, tenant ID, token de provisionamento
- **Como instalar**:
  1. Baixe o MSI oficial
  2. Baixe o script (.bat ou .ps1)
  3. Coloque na mesma pasta
  4. Execute como Administrador

#### 3. Grid de Máquinas
- **Filtros**: Todos | Computadores | Servidores
- **Cada card mostra**:
  - Hostname e status (online/offline)
  - Sistema operacional
  - Métricas: CPU, RAM, Disco (se online)
  - Alertas críticos (se houver)

#### 4. Botões de Ação (em cada máquina)
- 💬 **Chat**: abre conversa instantânea
- 🎫 **Ticket**: cria chamado de suporte
- 🖥️ **Conectar**: acesso remoto via RustDesk

---

## 💬 Chat/Ticket (Inbox)

### Layout:
- **Esquerda**: lista de conversas e tickets
- **Centro**: mensagens em tempo real
- **Direita**: ações rápidas (opcional)

### Funcionalidades:
- **Tabs**: Tudo | Conversas | Tickets
- **Busca**: por cliente, título, hostname
- **Notificações sonoras**: toggle no topo
- **WebSocket**: indicador de conexão
- **Unread badges**: conversas não lidas em destaque

### Durante o atendimento:
- **Conectar remoto**: abre RustDesk direto
- **Finalizar ticket**: botão verde no topo
- **Enviar mensagem**: Enter ou botão de envio

---

## ⚙️ Configurações de Perfil

### Acesso:
1. Clique no **avatar** (canto superior direito)
2. Selecione **"Meu perfil"**

### O que pode alterar:
- ✅ Foto de perfil (PNG/JPG até 5MB)
- ✅ Nome completo
- ✅ E-mail
- ✅ Senha (requer senha atual)

---

## 🔗 Integração com o Agente Windows

### Fluxo completo:

1. **Técnico baixa script** no detalhe do cliente
2. **Instala agente** no PC do cliente (executar como Admin)
3. **Agente registra** no backend usando token único
4. **Dispositivo aparece** no grid em ~60 segundos
5. **Heartbeat a cada 60s** mantém status atualizado
6. **Técnico pode**:
   - Ver métricas real-time
   - Iniciar chat instantâneo
   - Criar tickets
   - Conectar remotamente (RustDesk)

### Botões funcionais:

#### Chat
```typescript
conversationsApi.criar({ deviceId }) → abre no inbox
```

#### Ticket
```typescript
ticketsApi.criar({ deviceId, titulo, descricao }) → abre no inbox
```

#### Conectar
```typescript
rustdesk://connection/new/{rustdeskId} → protocolo RustDesk
```

---

## 🎨 Paleta de Cores

```css
/* Estrutura */
--bg-main: #F7F8FA
--bg-card: #FFFFFF
--border: #E5E7EB

/* Texto */
--text-primary: #1F2937
--text-secondary: #6B7280

/* Acentos */
--brand-cyan: #2EA3E6
--brand-purple: #7D3C98

/* Estados */
--green: #22C55E (online)
--red: #EF4444 (offline)
--amber: #F59E0B (alertas)
```

---

## 📱 Responsividade

### Desktop (1440px+)
- Grid 4 colunas (clientes e máquinas)
- Menu horizontal completo
- Frases motivacionais visíveis

### Tablet (768-1439px)
- Grid 2 colunas
- Menu compacto

### Mobile (<768px)
- Grid 1 coluna
- Hamburger menu
- Avatar sem nome

---

## ⚡ Performance

- **Auto-refresh inteligente**: silencioso em background
- **Socket.io**: notificações instantâneas
- **Lazy loading**: apenas dados visíveis carregados
- **Parallel requests**: múltiplas APIs em paralelo
- **Optimistic UI**: feedback imediato nos botões

---

## 🐛 Troubleshooting

### Botão "Conectar" não funciona
- ✅ Verificar se `device.rustdeskId` existe
- ✅ Verificar se dispositivo está online
- ✅ RustDesk deve estar instalado no PC do técnico

### Chat não aparece
- ✅ Verificar backend está rodando
- ✅ Verificar WebSocket conectado (indicador no inbox)
- ✅ Verificar console do navegador para erros

### Upload de foto falha
- ✅ Verificar endpoint `/storage/upload` no backend
- ✅ Verificar permissões (auth token válido)
- ✅ Arquivo deve ser imagem e < 5MB

### Scripts de instalação não geram
- ✅ Verificar `provisionToken` do tenant válido
- ✅ Backend deve ter `PUBLIC_API_BASE_URL` configurado
- ✅ MSI deve estar disponível na URL

---

**Pronto para uso!** 🎉
