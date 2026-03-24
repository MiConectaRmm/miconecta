// Verifica dispositivos com rustdeskId no banco
const { Client } = require('pg')

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL nao definida')
  process.exit(1)
}

;(async () => {
  const client = new Client({ connectionString: DATABASE_URL, ssl: false })
  await client.connect()
  console.log('✅ Conectado ao banco\n')

  // Dispositivos com RustDesk configurado
  const devices = await client.query(`
    SELECT 
      d.hostname,
      d.status,
      d.rustdesk_id,
      t.nome as tenant,
      d.last_seen
    FROM devices d
    JOIN tenants t ON t.id = d.tenant_id
    ORDER BY d.last_seen DESC NULLS LAST
    LIMIT 20
  `)

  console.log('=== DISPOSITIVOS ===')
  if (devices.rows.length === 0) {
    console.log('Nenhum dispositivo encontrado.')
  } else {
    devices.rows.forEach(d => {
      const rustdesk = d.rustdesk_id ? `✅ RustDesk: ${d.rustdesk_id}` : '❌ Sem RustDesk ID'
      const status = d.status === 'online' ? '🟢' : '🔴'
      console.log(`${status} ${d.hostname} (${d.tenant}) — ${rustdesk} — LastSeen: ${d.last_seen ? new Date(d.last_seen).toLocaleString('pt-BR') : 'nunca'}`)
    })
  }

  // Sessões remotas
  const sessions = await client.query(`
    SELECT 
      rs.id,
      rs.status,
      rs.motivo,
      rs.criado_em,
      d.hostname,
      tech.nome as tecnico
    FROM remote_sessions rs
    JOIN devices d ON d.id = rs.device_id
    JOIN technicians tech ON tech.id = rs.technician_id
    ORDER BY rs.criado_em DESC
    LIMIT 10
  `).catch(() => ({ rows: [] }))

  console.log('\n=== ULTIMAS SESSOES REMOTAS ===')
  if (sessions.rows.length === 0) {
    console.log('Nenhuma sessao encontrada ainda.')
  } else {
    sessions.rows.forEach(s => {
      console.log(`[${s.status}] ${s.hostname} — ${s.tecnico} — ${s.motivo || 'sem motivo'} — ${new Date(s.criado_em).toLocaleString('pt-BR')}`)
    })
  }

  await client.end()
})().catch(err => {
  console.error('Erro:', err.message)
  process.exit(1)
})
