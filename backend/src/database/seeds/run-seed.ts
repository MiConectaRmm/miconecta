import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Tenant, TenantPlano, TenantStatus } from '../entities/tenant.entity';
import { Technician, TechnicianRole } from '../entities/technician.entity';

async function seed() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('DATABASE_URL não definida. Defina via variável de ambiente.');
    process.exit(1);
  }

  const useSsl = process.env.DB_SSL === 'true';

  const ds = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    entities: [Tenant, Technician],
    ssl: useSsl ? { rejectUnauthorized: false } : false,
    synchronize: false,
  });

  await ds.initialize();
  console.log('Conectado ao banco.');

  const tenantRepo = ds.getRepository(Tenant);
  const techRepo = ds.getRepository(Technician);

  let tenant = await tenantRepo.findOne({ where: { slug: 'maginf' } });
  if (!tenant) {
    tenant = tenantRepo.create({
      nome: 'Maginf Tecnologia',
      slug: 'maginf',
      email: 'contato@maginf.com.br',
      ativo: true,
      plano: TenantPlano.ENTERPRISE,
      statusContrato: TenantStatus.ATIVO,
      maxDispositivos: 1000,
      maxUsuarios: 100,
      storageMaxMb: 51200,
      storageUsadoMb: 0,
      timezone: 'America/Sao_Paulo',
      retencaoMeses: 12,
    });
    tenant = await tenantRepo.save(tenant);
    console.log(`Tenant criado: ${tenant.nome} (${tenant.id})`);
  } else {
    console.log(`Tenant já existe: ${tenant.nome} (${tenant.id})`);
  }

  const adminEmail = 'admin@maginf.com.br';
  let admin = await techRepo.findOne({ where: { email: adminEmail } });
  if (!admin) {
    const senhaHash = await bcrypt.hash('Admin@123', 12);
    admin = techRepo.create({
      tenantId: tenant.id,
      nome: 'Administrador Maginf',
      email: adminEmail,
      senha: senhaHash,
      funcao: TechnicianRole.SUPER_ADMIN,
      ativo: true,
      disponivel: true,
      maxTicketsSimultaneos: 20,
    });
    admin = await techRepo.save(admin);
    console.log(`Admin criado: ${admin.email} (${admin.id})`);
  } else {
    const senhaHash = await bcrypt.hash('Admin@123', 12);
    await techRepo.update(admin.id, { senha: senhaHash });
    console.log(`Admin já existe, senha atualizada: ${admin.email}`);
  }

  console.log('\n=== SEED COMPLETO ===');
  console.log(`Tenant: ${tenant.nome} (${tenant.id})`);
  console.log(`Admin:  ${adminEmail} / Admin@123`);
  console.log(`Role:   super_admin`);

  await ds.destroy();
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
