const bcrypt = require('bcrypt');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL nao definida. Use: DATABASE_URL=postgres://... node create-admin.js');
  process.exit(1);
}

(async () => {
  const client = new Client({ connectionString: DATABASE_URL, ssl: DATABASE_URL.includes('fly.dev') ? { rejectUnauthorized: false } : false });
  await client.connect();
  console.log('Conectado ao banco.');

  // 1. Criar tenant Maginf (se nao existir)
  let tenantId;
  const tenantCheck = await client.query(`SELECT id FROM tenants WHERE slug = 'maginf' LIMIT 1`);
  if (tenantCheck.rows.length > 0) {
    tenantId = tenantCheck.rows[0].id;
    console.log('Tenant Maginf ja existe:', tenantId);
  } else {
    const tenantRes = await client.query(
      `INSERT INTO tenants (id, nome, slug, email, ativo, plano, status_contrato, max_dispositivos, max_usuarios, storage_max_mb, storage_usado_mb, retencao_meses, timezone)
       VALUES (gen_random_uuid(), $1, $2, $3, true, 'enterprise', 'ativo', 1000, 100, 51200, 0, 24, 'America/Sao_Paulo')
       RETURNING id`,
      ['Maginf Tecnologia', 'maginf', 'contato@maginf.com.br']
    );
    tenantId = tenantRes.rows[0].id;
    console.log('Tenant Maginf criado:', tenantId);
  }

  // 2. Criar super_admin
  const adminCheck = await client.query(`SELECT id FROM technicians WHERE email = $1 LIMIT 1`, ['admin@maginf.com.br']);
  if (adminCheck.rows.length > 0) {
    console.log('Super Admin ja existe:', adminCheck.rows[0].id);
  } else {
    const hash1 = await bcrypt.hash('Admin@2026', 12);
    const res1 = await client.query(
      `INSERT INTO technicians (id, tenant_id, nome, email, senha, funcao, ativo, disponivel, max_tickets_simultaneos)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'super_admin', true, true, 20)
       RETURNING id, email, funcao`,
      [tenantId, 'Admin Maginf', 'admin@maginf.com.br', hash1]
    );
    console.log('Super Admin criado:', res1.rows[0]);
  }

  // 3. Criar tecnico suporte
  const supCheck = await client.query(`SELECT id FROM technicians WHERE email = $1 LIMIT 1`, ['suporte@maginf.com.br']);
  if (supCheck.rows.length > 0) {
    console.log('Tecnico Suporte ja existe:', supCheck.rows[0].id);
  } else {
    const hash2 = await bcrypt.hash('@@Supo_301#', 12);
    const res2 = await client.query(
      `INSERT INTO technicians (id, tenant_id, nome, email, senha, funcao, ativo, disponivel, max_tickets_simultaneos)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'tecnico', true, true, 10)
       RETURNING id, email, funcao`,
      [tenantId, 'Suporte Maginf', 'suporte@maginf.com.br', hash2]
    );
    console.log('Tecnico Suporte criado:', res2.rows[0]);
  }

  console.log('\nSeed concluido! Credenciais:');
  console.log('  admin@maginf.com.br / Admin@2026 (super_admin)');
  console.log('  suporte@maginf.com.br / @@Supo_301# (tecnico)');
  console.log('  Tenant ID:', tenantId);

  await client.end();
})().catch((err) => {
  console.error('Erro:', err.message);
  process.exit(1);
});
