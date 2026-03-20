const bcrypt = require('bcrypt');
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  // Criar tenant se não existir
  let tenantResult = await client.query(
    `INSERT INTO tenants (id, nome, slug, ativo) 
     VALUES (gen_random_uuid(), 'Admin Tenant', 'admin', true) 
     ON CONFLICT DO NOTHING
     RETURNING id`
  );
  
  if (tenantResult.rows.length === 0) {
    tenantResult = await client.query(`SELECT id FROM tenants LIMIT 1`);
  }
  
  const tenantId = tenantResult.rows[0].id;
  console.log('Tenant ID:', tenantId);
  
  // Criar super admin
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  
  const result = await client.query(
    `INSERT INTO technicians (id, tenant_id, email, nome, senha, funcao, ativo) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) 
     RETURNING id, email, nome, funcao`,
    [tenantId, 'admin@miconecta.com', 'Super Admin', hashedPassword, 'super_admin', true]
  );
  
  console.log('\n✅ Super Admin criado:', result.rows[0]);
  console.log('📧 Email: admin@miconecta.com');
  console.log('🔑 Senha: Admin@123');
  
  await client.end();
})().catch(console.error);
