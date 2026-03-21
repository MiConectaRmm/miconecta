# 📋 Registro de Sessão — 21/03/2026

## Funcionalidade: Usuários do Portal por Cliente (limite 5)

**Autor da sessão:** GitHub Copilot  
**Data:** 21 de Março de 2026  
**Branch:** main  
**Status:** ✅ Implementado — sem erros de compilação  

---

## 🎯 Objetivo

Permitir que ao acessar um **cliente (tenant)** no dashboard, o técnico/admin possa **cadastrar até 5 usuários do portal** para aquele cliente. Os usuários do portal são quem acessa a área `/portal/` do sistema (abrir tickets, acompanhar dispositivos, etc).

---

## 📁 Arquivos Modificados

### Backend (NestJS)

| Arquivo | O que mudou |
|---|---|
| `backend/src/modules/users/users.module.ts` | Adicionou `Tenant` ao `TypeOrmModule.forFeature()` para que o service possa consultar o limite de usuários do tenant |
| `backend/src/modules/users/client-users.service.ts` | Injetou `Tenant` repository; limite dinâmico via `tenant.maxUsuarios` (default 5); novos métodos `contagem()` e `listarPorTenant()` |
| `backend/src/modules/users/client-users.controller.ts` | Adicionou `Query` no import; 2 novos endpoints: `GET tenant/:tenantId` e `GET tenant/:tenantId/contagem` |

### Frontend (Next.js)

| Arquivo | O que mudou |
|---|---|
| `frontend/src/lib/api.ts` | Adicionou 2 métodos ao `usersApi`: `listarPorTenant(tenantId)` e `contagemPorTenant(tenantId)` |
| `frontend/src/app/dashboard/clientes/[id]/page.tsx` | Nova aba "Usuários do Portal" completa (listagem, CRUD, contagem visual, modal de criar/editar, limite) |

---

## 🔧 Detalhes Técnicos das Mudanças

### 1. Backend — `users.module.ts`

```typescript
// ANTES:
imports: [TypeOrmModule.forFeature([ClientUser, Technician])]

// DEPOIS:
imports: [TypeOrmModule.forFeature([ClientUser, Technician, Tenant])]
```

A entidade `Tenant` foi adicionada para que o `ClientUsersService` possa consultar `tenant.maxUsuarios`.

---

### 2. Backend — `client-users.service.ts`

**Mudanças principais:**

- **Injeção do `Tenant` repository:**
  ```typescript
  @InjectRepository(Tenant)
  private readonly tenantRepo: Repository<Tenant>,
  ```

- **Limite dinâmico** (antes era hardcoded `MAX_USERS_PER_TENANT = 5`):
  ```typescript
  private static readonly DEFAULT_MAX_USERS = 5;

  private async getMaxUsuarios(tenantId: string): Promise<number> {
    const tenant = await this.tenantRepo.findOne({ where: { id: tenantId } });
    if (!tenant) throw new NotFoundException('Tenant não encontrado');
    return tenant.maxUsuarios ?? ClientUsersService.DEFAULT_MAX_USERS;
  }
  ```
  > Agora usa `tenant.maxUsuarios` da entity (campo `max_usuarios` na tabela). Default = 5.

- **Novo método `contagem(tenantId)`:** Retorna:
  ```json
  {
    "total": 3,
    "ativos": 2,
    "inativos": 1,
    "limite": 5,
    "disponivel": 2,
    "atingiuLimite": false
  }
  ```

- **Novo método `listarPorTenant(tenantId)`:** Lista somente os client users de um tenant específico, ordenados por `ativo DESC, nome ASC` (ativos primeiro).

- **Mensagem de erro melhorada** ao atingir o limite:
  ```
  "Limite de 5 usuários do portal atingido para este cliente. Atualmente existem 5 usuários cadastrados."
  ```

---

### 3. Backend — `client-users.controller.ts`

**Novos endpoints:**

| Método | Rota | Descrição | Guard |
|---|---|---|---|
| `GET` | `/api/v1/users/clients/tenant/:tenantId` | Listar usuários de um tenant | `users:read` |
| `GET` | `/api/v1/users/clients/tenant/:tenantId/contagem` | Contagem de usuários com limite | `users:read` |

> ⚠️ Os endpoints `tenant/:tenantId` estão **antes** de `:id` no controller para evitar conflito de rotas.

---

### 4. Frontend — `api.ts`

**Novos métodos no `usersApi`:**

```typescript
listarPorTenant: (tenantId: string) => api.get(`/users/clients/tenant/${tenantId}`),
contagemPorTenant: (tenantId: string) => api.get(`/users/clients/tenant/${tenantId}/contagem`),
```

---

### 5. Frontend — `/dashboard/clientes/[id]/page.tsx`

Esta é a página de **detalhe de um cliente** (tenant). Anteriormente tinha 12 abas. Agora tem **13 abas** com a adição de "Usuários do Portal".

**Novos imports:**
- Ícones: `Users, Mail, Phone, Building`
- API: `usersApi`
- Componente: `Modal`

**Novos states:**
```typescript
const [portalUsers, setPortalUsers] = useState<any[]>([])
const [portalContagem, setPortalContagem] = useState<any>(null)
const [showUserModal, setShowUserModal] = useState(false)
const [editandoUser, setEditandoUser] = useState<any>(null)
const [userForm, setUserForm] = useState({
  nome: '', email: '', senha: '', telefone: '', cargo: '', funcao: 'usuario',
})
```

**Lazy loading:** Os usuários do portal só são carregados quando a aba é clicada (useEffect no `activeTab`).

**Nova aba (tab id = `portal-users`):**
- Posicionada em 3º lugar (depois de Tickets e Chat)
- Ícone: `Users` do Lucide

**Conteúdo da aba:**

1. **Header com contagem visual:**
   - Texto "X/5" com cor dinâmica (verde/amarelo/vermelho)
   - Barra de progresso visual (width proporcional)
   - Texto de vagas disponíveis
   - Botão "Novo Usuário" (desabilitado quando limite atingido)

2. **Aviso de limite (condicional):**
   - Aparece quando `atingiuLimite === true`
   - Fundo vermelho com ícone de alerta

3. **Cards de estatísticas:**
   - 4 cards: Total, Ativos, Inativos, Vagas
   - Grid de 4 colunas

4. **Lista de usuários:**
   - Cada usuário mostra: avatar colorido por perfil, nome, badge de perfil (Admin/Gestor/Usuário), status ativo/inativo, email verificado, email, telefone, cargo, último login
   - Ações: Editar, Desativar/Reativar, Enviar convite
   - Inativos aparecem com opacidade reduzida

5. **Modal de criar/editar:**
   - Info do tenant no topo
   - Campos: nome*, email*, senha* (obrigatória apenas ao criar), perfil*, telefone, cargo
   - Descrição do perfil selecionado
   - Botão desabilitado se campos obrigatórios vazios ou senha < 6 chars

**Funções implementadas:**
- `carregarPortalUsers()` — carrega lista + contagem via Promise.allSettled
- `abrirUserModal(usuario?)` — abre modal (vazio para criar, preenchido para editar)
- `salvarUser()` — cria ou atualiza, com tratamento de erro do backend
- `desativarUser(id)` — com confirmação
- `reativarUser(id)` — sem confirmação
- `enviarConviteUser(id)` — gera token de convite

---

## 🗄️ Entidades Relacionadas (não modificadas, mas relevantes)

### `Tenant` (tabela `tenants`)
- Campo `max_usuarios` (TypeORM: `maxUsuarios`): `int`, default `10`
- Este campo controla o limite de client users por tenant
- Default no service = 5 (se `maxUsuarios` for null)

### `ClientUser` (tabela `client_users`)
- Enum `ClientUserRole`: `admin_cliente`, `gestor`, `usuario`
- Index unique: `[tenantId, email]`
- Campos relevantes: `nome`, `email`, `senha`, `funcao`, `telefone`, `cargo`, `ativo`, `emailVerificado`, `ultimoLogin`, `inviteToken`, `inviteExpiresAt`

### `CreateClientUserDto`
```typescript
{ nome: string, email: string, senha: string, funcao?: ClientUserRole, telefone?: string, cargo?: string, organizationId?: string }
```

---

## 🔌 Endpoints da API Completos (módulo users/clients)

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/v1/users/clients` | Criar client user (header X-Tenant-Id para admin) |
| `GET` | `/api/v1/users/clients` | Listar todos (admin) ou do tenant (client) |
| `GET` | `/api/v1/users/clients/tenant/:tenantId` | **NOVO** — Listar users de um tenant |
| `GET` | `/api/v1/users/clients/tenant/:tenantId/contagem` | **NOVO** — Contagem + limite |
| `GET` | `/api/v1/users/clients/:id` | Buscar por ID |
| `PUT` | `/api/v1/users/clients/:id` | Atualizar |
| `DELETE` | `/api/v1/users/clients/:id` | Desativar (soft delete) |
| `PUT` | `/api/v1/users/clients/:id/reativar` | Reativar |
| `POST` | `/api/v1/users/clients/:id/invite` | Gerar convite (token 24h) |

---

## 🧪 O que NÃO foi testado / Pontos de atenção

1. **Não há testes unitários** para os novos endpoints — jest está configurado mas sem `*.spec.ts`
2. **O convite** gera um token mas **não envia email** (precisa integrar nodemailer)
3. **O `organizationId`** não é selecionável no modal — futuro: dropdown de organizações do tenant
4. **O limite `maxUsuarios`** na entity Tenant tem default 10, mas o service usa default 5 — verificar qual é a regra de negócio correta
5. **CORS/Auth**: Os novos endpoints usam os mesmos guards (JWT + TenantAccess + Roles + Permissions), permissão necessária: `users:read` para listar/contagem, `users:write` para CRUD
6. **A listagem geral** (`/dashboard/clientes` page.tsx) continua existindo e NÃO foi alterada nesta sessão

---

## 🚀 Próximos Passos Sugeridos

1. **Ajustar limite no Tenant**: Decidir se `maxUsuarios` default deve ser 5 ou 10 (entity diz 10, service diz 5)
2. **Enviar email de convite**: Integrar o endpoint `/invite` com nodemailer para envio real
3. **Página de aceitar convite**: Criar rota pública para o client user aceitar o convite (setPassword)
4. **Organizações no modal**: Adicionar dropdown para selecionar a organização do client user
5. **Testes**: Criar `client-users.service.spec.ts` e `client-users.controller.spec.ts`
6. **Permissão do admin_cliente**: Permitir que o próprio admin_cliente gerencie os users do seu tenant via portal
7. **Audit log**: Registrar criação/edição/desativação de client users no audit trail

---

## 📐 Arquitetura de Referência

```
                    Frontend (Next.js 14)
                    /dashboard/clientes/[id]
                           │
                    Aba "Usuários do Portal"
                           │
                    ┌──────┴──────┐
                    │ usersApi    │
                    │ .listarPorTenant()
                    │ .contagemPorTenant()
                    │ .criarCliente()
                    │ .atualizarCliente()
                    │ .desativarCliente()
                    │ .reativarCliente()
                    │ .convidarCliente()
                    └──────┬──────┘
                           │ axios (JWT + X-Tenant-Id)
                           ▼
                    Backend (NestJS 10)
                    ClientUsersController
                    /api/v1/users/clients/...
                           │
                    ClientUsersService
                    ├── ClientUser repository
                    └── Tenant repository
                           │
                    PostgreSQL 16
                    ├── client_users
                    └── tenants (max_usuarios)
```

---

## 📂 Estrutura de Arquivos do Módulo Users

```
backend/src/modules/users/
├── users.module.ts                 ← Module (ClientUser + Technician + Tenant)
├── client-users.controller.ts      ← REST endpoints para client users
├── client-users.service.ts         ← Lógica de negócio + limite dinâmico
├── technicians.controller.ts       ← REST endpoints para técnicos (NÃO alterado)
├── technicians.service.ts          ← Lógica de técnicos (NÃO alterado)
└── dto/
    ├── create-client-user.dto.ts   ← DTO de criação (NÃO alterado)
    └── create-technician.dto.ts    ← DTO de técnico (NÃO alterado)

frontend/src/
├── lib/api.ts                      ← usersApi com listarPorTenant + contagemPorTenant
└── app/dashboard/clientes/
    ├── page.tsx                     ← Lista geral de clientes (NÃO alterado)
    └── [id]/page.tsx                ← Detalhe do cliente — NOVA aba "Usuários do Portal"
```

---

## 🔑 Credenciais / Config Relevante

- **DB**: PostgreSQL em `postgres:5432`, database `miconecta_rmm`
- **Tabela**: `client_users` com index unique `(tenant_id, email)`
- **Limite padrão**: 5 usuários por tenant (service) / 10 (entity default)
- **Hash de senha**: bcrypt, 12 rounds
- **Token de convite**: UUID v4, validade 24h
- **Roles do portal**: `admin_cliente`, `gestor`, `usuario`

---

*Documento gerado automaticamente por GitHub Copilot em 21/03/2026*
