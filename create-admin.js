const bcrypt = require('bcrypt');
const { Client } = require('pg');

(async () => {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  
  const hashedPassword = await bcrypt.hash('Admin@123', 10);
  
  const result = await client.query(
    `INSERT INTO users (id, email, nome, senha, user_type, role, active) 
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6) 
     RETURNING id, email, nome`,
    ['admin@miconecta.com', 'Super Admin', hashedPassword, 'technician', 'super_admin', true]
  );
  
  console.log('Super Admin criado:', result.rows[0]);
  
  await client.end();
})().catch(console.error);
