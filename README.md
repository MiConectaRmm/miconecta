# MIConectaRMM Enterprise

**by Maginf Tecnologia** | Deploy: GitHub + Supabase + Vercel

Plataforma completa de Remote Monitoring and Management (RMM) para MSPs.

---

## Stack de Producao

| Servico | Tecnologia | Hospedagem |
|---|---|---|
| **Frontend** | Next.js 14 + TailwindCSS | Vercel (auto-deploy) |
| **Backend API** | NestJS + TypeORM | Vercel Serverless |
| **Banco de Dados** | PostgreSQL 16 | Supabase |
| **Cache/Filas** | Redis | Upstash |
| **Agente Windows** | C# .NET 8 Service | Instalado nos PCs |
| **Acesso Remoto** | RustDesk | 136.248.114.218 |

## Componentes

| Pasta | Descricao |
|---|---|
| `backend/` | API NestJS (10 modulos, 14 entidades) |
| `frontend/` | Dashboard Next.js (10 paginas) |
| `agent/` | Agente Windows Service C# |
| `installer/` | Instalador Inno Setup |

---

## Deploy em Producao

### 1. Criar projeto no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie um novo projeto
2. Escolha a regiao `South America (Sao Paulo)`
3. Anote a **connection string** em: Settings > Database > Connection string > URI
4. O TypeORM ira criar as tabelas automaticamente no primeiro deploy

### 2. Criar banco Redis no Upstash

1. Acesse [console.upstash.com](https://console.upstash.com)
2. Crie um novo banco Redis (regiao: sa-east-1)
3. Copie a **REDIS_URL** (formato: `rediss://default:TOKEN@HOST:6379`)

### 3. Subir para o GitHub

```bash
cd c:\app.miconecta
git init
git add .
git commit -m "MIConectaRMM Enterprise v1.0.0"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/miconecta-rmm.git
git push -u origin main
```

### 4. Deploy do Backend na Vercel

1. Acesse [vercel.com](https://vercel.com) e importe o repositorio do GitHub
2. Na configuracao do projeto:
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
3. Adicione as **Environment Variables**:

| Variavel | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `postgresql://postgres.xxx:SENHA@aws-0-sa-east-1.pooler.supabase.com:6543/postgres` |
| `REDIS_URL` | `rediss://default:TOKEN@HOST.upstash.io:6379` |
| `JWT_SECRET` | (gere uma chave forte de 64 caracteres) |
| `JWT_EXPIRATION` | `24h` |
| `AGENT_AUTH_SECRET` | (gere uma chave forte de 32 caracteres) |
| `CORS_ORIGIN` | `https://miconecta-rmm.vercel.app` |

4. Clique em **Deploy**
5. Anote a URL gerada (ex: `https://miconecta-rmm-api.vercel.app`)

### 5. Deploy do Frontend na Vercel

1. No Vercel, importe o **mesmo repositorio** novamente (ou crie um segundo projeto)
2. Na configuracao:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js
3. Adicione as **Environment Variables**:

| Variavel | Valor |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://miconecta-rmm-api.vercel.app/api/v1` |
| `NEXT_PUBLIC_WS_URL` | `wss://miconecta-rmm-api.vercel.app` |

4. Clique em **Deploy**

### 6. Atualizar CORS do Backend

Apos o deploy do frontend, atualize a variavel `CORS_ORIGIN` do backend com a URL real do frontend.

---

## Deploy Automatico

Apos a configuracao inicial, todo `git push` para a branch `main` dispara automaticamente:
- Build e deploy do **backend** na Vercel
- Build e deploy do **frontend** na Vercel

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
