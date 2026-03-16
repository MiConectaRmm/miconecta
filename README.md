# MIConectaRMM Enterprise

**by Maginf Tecnologia** | Deploy: GitHub + Render + Vercel

Plataforma completa de Remote Monitoring and Management (RMM) para MSPs.

---

## Stack de Producao

| Servico | Tecnologia | Hospedagem |
|---|---|---|
| **Frontend** | Next.js 14 + TailwindCSS | Vercel (auto-deploy) |
| **Backend API** | NestJS + TypeORM | Render.com (auto-deploy) |
| **Banco de Dados** | PostgreSQL 16 | Render PostgreSQL |
| **Agente Windows** | C# .NET 8 Service | Instalado nos PCs |
| **Acesso Remoto** | RustDesk | 136.248.114.218 |

## URLs de Producao

| Componente | URL |
|---|---|
| **Frontend** | https://miconecta.vercel.app |
| **Backend API** | https://miconecta.onrender.com |
| **API Docs (Swagger)** | https://miconecta.onrender.com/api/docs |
| **GitHub** | https://github.com/MiConectaRmm/miconecta |

## Componentes

| Pasta | Descricao |
|---|---|
| `backend/` | API NestJS (10 modulos, 14 entidades) |
| `frontend/` | Dashboard Next.js (10 paginas) |
| `agent/` | Agente Windows Service C# |
| `installer/` | Instalador Inno Setup |

---

## Deploy em Producao

### 1. Backend no Render.com

1. Acesse [render.com](https://render.com) e crie um **Web Service**
2. Conecte ao repositorio GitHub `MiConectaRmm/miconecta`
3. Configuracao:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install --include=dev && npm run build`
   - **Start Command:** `node dist/main.js`
4. Crie um **PostgreSQL** no Render e copie a `DATABASE_URL` interna
5. Adicione as **Environment Variables**:

| Variavel | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | (connection string interna do Render PostgreSQL) |
| `JWT_SECRET` | (gere uma chave forte de 64 caracteres) |
| `JWT_EXPIRATION` | `24h` |
| `AGENT_AUTH_SECRET` | (gere uma chave forte de 32 caracteres) |
| `CORS_ORIGIN` | `https://miconecta.vercel.app` |

### 2. Frontend no Vercel

1. Acesse [vercel.com](https://vercel.com) e importe o repositorio GitHub
2. Configuracao:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
3. Adicione as **Environment Variables**:

| Variavel | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://miconecta.onrender.com/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://miconecta.onrender.com` |

4. Clique em **Deploy**

---

## Deploy Automatico

Apos a configuracao inicial, todo `git push` para a branch `main` dispara automaticamente:
- Build e deploy do **backend** no Render
- Build e deploy do **frontend** no Vercel

---

## Desenvolvimento Local

```bash
# Backend
cd backend
npm install
cp .env.example .env   # preencha com credenciais locais ou Supabase
npm run start:dev       # http://localhost:3000

# Frontend
cd frontend
npm install
cp .env.example .env.local
npm run dev             # http://localhost:3001
```

## Agente Windows

```bash
cd agent/MIConectaAgent
dotnet publish -c Release -r win-x64 --self-contained
# Use o Inno Setup com installer/MIConectaRMMSetup.iss para gerar o instalador
```

## RustDesk

- **Servidor:** 136.248.114.218
- **Dominio:** remoto.maginf.com.br
- **Portas:** 21115-21119
- **Key:** `ev3ic04E+VsgunfupaellTSWgSzmHiQL2H5ywzBE+yI=`

## Variaveis de Ambiente (Referencia)

Veja os arquivos:
- `backend/.env.example` - todas as variaveis do backend
- `frontend/.env.example` - variaveis do frontend

## Licenca

Proprietario - Maginf Tecnologia (c) 2026
