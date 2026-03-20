# Migração para Fly.io

## Pré-requisitos

1. Instalar Fly.io CLI:
```powershell
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

2. Fazer login:
```bash
fly auth login
```

## Deploy Backend

1. Criar app backend:
```bash
cd backend
fly launch --no-deploy --name miconecta-backend --region gru
```

2. Criar banco PostgreSQL:
```bash
fly postgres create --name miconecta-db --region gru
```

3. Conectar banco ao backend:
```bash
fly postgres attach miconecta-db --app miconecta-backend
```

4. Configurar secrets:
```bash
fly secrets set \
  JWT_SECRET="seu-jwt-secret-aqui" \
  JWT_EXPIRATION="15m" \
  --app miconecta-backend
```

5. Deploy:
```bash
fly deploy
```

## Deploy Frontend

1. Criar app frontend:
```bash
cd ../frontend
fly launch --no-deploy --name miconecta-frontend --region gru
```

2. Configurar secrets:
```bash
fly secrets set \
  NEXT_PUBLIC_API_URL="https://miconecta-backend.fly.dev/api/v1" \
  NEXT_PUBLIC_WS_URL="wss://miconecta-backend.fly.dev" \
  --app miconecta-frontend
```

3. Deploy:
```bash
fly deploy
```

## Pós-Deploy

1. Verificar apps:
```bash
fly status --app miconecta-backend
fly status --app miconecta-frontend
```

2. Ver logs:
```bash
fly logs --app miconecta-backend
```

3. Abrir no navegador:
```bash
fly open --app miconecta-frontend
```

## Variáveis de Ambiente

Backend já configuradas automaticamente:
- `DATABASE_URL` (via postgres attach)
- `PORT=3000`
- `NODE_ENV=production`

Frontend precisa configurar:
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_WS_URL`
