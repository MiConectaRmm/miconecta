# B. ESTRATÉGIA MULTI-TENANT

## B.1 Abordagem Escolhida

**Shared Database + Shared Schema + tenant_id em toda entidade de dados**

### Comparação de Abordagens

| Abordagem | Prós | Contras | Veredicto |
|---|---|---|---|
| **Database por tenant** | Isolamento total | Custo alto (1 DB por cliente), migrations difíceis, pool de conexões explode | ❌ Inviável para SaaS |
| **Schema por tenant** | Bom isolamento | Migrations por schema, pooling complexo, PostgreSQL schemas pesados | ❌ Complexo demais |
| **Shared DB + tenant_id** | Simples, escalável, barato, migrations únicas | Risco de vazamento se mal implementado | ✅ **Escolhido** |

### Justificativa
Esta é a abordagem padrão da indústria para SaaS multi-tenant (Salesforce, Slack, Notion). O risco de vazamento é mitigado por **5 camadas de proteção**.

## B.2 Camadas de Proteção Contra Vazamento

```
CAMADA 1 — JWT Token
├── Todo JWT carrega: { userId, tenantId, userType, role }
├── Token assinado com HS256 + secret robusto
├── Access token: 15 minutos | Refresh token: 7 dias
└── TenantExtractionMiddleware extrai tenantId do JWT

CAMADA 2 — Guards do NestJS
├── TenantAccessGuard verifica acesso ao tenant da rota
├── Técnicos Maginf: verifica se tenant está nos atribuídos
├── super_admin/admin_maginf: acesso a todos os tenants
├── client_user: acesso APENAS ao próprio tenant
└── Rejeita com 403 se não corresponder

CAMADA 3 — Service Layer
├── Todo método de leitura recebe tenantId como primeiro argumento
├── Todo método de escrita valida tenantId antes de salvar
├── QueryBuilder SEMPRE inclui WHERE tenantId = :tenantId
├── Nenhuma query é executada sem filtro de tenant
└── Exceção: super_admin com flag explícita para cross-tenant

CAMADA 4 — TypeORM Subscriber (Automático)
├── TenantSubscriber intercepta beforeInsert e beforeUpdate
├── Verifica se entidade tem tenantId e está preenchido
├── Se ausente → lança exceção (NUNCA insert sem tenant)
├── Se diferir do contexto → lança exceção
└── Log de segurança em caso de violação

CAMADA 5 — PostgreSQL RLS (Row Level Security)
├── CREATE POLICY tenant_isolation ON [tabela]
│   USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
├── Backend seta: SET LOCAL app.current_tenant_id = 'uuid'
├── Ativada nas tabelas mais sensíveis
└── Rede de segurança: mesmo com bug no código, banco rejeita cross-tenant
```

## B.3 tenant_id — Mapeamento Completo

### Entidades COM tenant_id direto

| Entidade | Motivo |
|---|---|
| organization | Filiais/sites do cliente |
| client_user | Usuários do cliente |
| device | Dispositivos do parque |
| alert | Alertas do tenant |
| ticket | Chamados do tenant |
| remote_session | Sessões remotas |
| consent_record | Consentimentos LGPD |
| notification | Notificações |
| file_attachment | Anexos |
| audit_log | Logs de auditoria |
| lgpd_request | Solicitações LGPD |
| report_schedule | Agendamentos de relatórios |
| script* | Scripts (null = global compartilhado) |
| software_package* | Pacotes (null = global compartilhado) |
| ticket_category* | Categorias (null = global) |

### Entidades SEM tenant_id direto (acessíveis via JOIN)

| Entidade | Acessa via |
|---|---|
| device_metric | device.tenantId |
| device_inventory | device.tenantId |
| ticket_comment | ticket.tenantId |
| chat_message | ticket.tenantId |
| remote_session_log | remote_session.tenantId |
| script_execution | device.tenantId |
| software_deployment | device.tenantId |
| patch | device.tenantId |

### Entidades globais (sem tenant)

| Entidade | Motivo |
|---|---|
| tenant | É a própria entidade raiz |
| technician | Pertence à Maginf (tem tenants_atribuidos[]) |
| notification_preference | Preferência do usuário, não do tenant |

## B.4 Acesso Cross-Tenant (Maginf)

```typescript
// Técnicos Maginf acessam múltiplos tenants
// O frontend Maginf mantém "tenant ativo" no estado global
// Toda request inclui header: X-Tenant-Id: <uuid>
// TenantAccessGuard valida se técnico tem acesso

// Para dashboards cross-tenant (super_admin/admin_maginf):
// Rota específica: GET /api/v1/admin/overview
// Guard específico: @Roles('super_admin', 'admin_maginf')
// Query faz GROUP BY tenant_id (nunca retorna dados misturados)
```

## B.5 Acesso do Cliente (Isolamento Estrito)

```typescript
// ClientUser NUNCA escolhe tenant — o tenant é FIXO no JWT
// O sistema IGNORA qualquer X-Tenant-Id enviado por client_user

if (user.userType === 'client_user') {
  req.tenantId = user.tenantId; // fixo do JWT
} else if (user.userType === 'technician') {
  req.tenantId = req.headers['x-tenant-id']; // do header
  // TenantAccessGuard valida acesso
}
```
