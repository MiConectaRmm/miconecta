using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Armazena estado local persistente em SQLite.
/// Tabelas: agent_state (k/v), outbox_events (fila offline), agent_logs.
/// </summary>
public class LocalStateStore
{
    private readonly string _dbPath;
    private readonly ILogger<LocalStateStore> _logger;

    public LocalStateStore(AgentConfig config, ILogger<LocalStateStore> logger)
    {
        _logger = logger;
        _dbPath = Path.Combine(AgentConfig.AppDir, "agent_state.db");
        InicializarBanco();
    }

    // ─────────────────────────────────────────────────────
    // Inicialização
    // ─────────────────────────────────────────────────────

    private void InicializarBanco()
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                PRAGMA journal_mode=WAL;
                PRAGMA synchronous=NORMAL;

                CREATE TABLE IF NOT EXISTS agent_state (
                    chave     TEXT PRIMARY KEY,
                    valor     TEXT NOT NULL,
                    atualizado_em TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS outbox_events (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    tipo       TEXT NOT NULL,
                    endpoint   TEXT NOT NULL,
                    payload    TEXT NOT NULL,
                    tentativas INTEGER NOT NULL DEFAULT 0,
                    criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
                    proximo_em TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE TABLE IF NOT EXISTS agent_logs (
                    id         INTEGER PRIMARY KEY AUTOINCREMENT,
                    nivel      TEXT NOT NULL,
                    mensagem   TEXT NOT NULL,
                    criado_em  TEXT NOT NULL DEFAULT (datetime('now'))
                );

                CREATE INDEX IF NOT EXISTS idx_outbox_proximo ON outbox_events(proximo_em);
            ";
            cmd.ExecuteNonQuery();
            _logger.LogDebug("Banco SQLite inicializado: {Path}", _dbPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inicializar banco SQLite");
        }
    }

    private SqliteConnection AbrirConexao()
    {
        var conn = new SqliteConnection($"Data Source={_dbPath}");
        conn.Open();
        return conn;
    }

    // ─────────────────────────────────────────────────────
    // agent_state — chave/valor
    // ─────────────────────────────────────────────────────

    public void SetState(string chave, string valor)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO agent_state(chave, valor, atualizado_em)
                VALUES($chave, $valor, datetime('now'))
                ON CONFLICT(chave) DO UPDATE SET valor=$valor, atualizado_em=datetime('now');
            ";
            cmd.Parameters.AddWithValue("$chave", chave);
            cmd.Parameters.AddWithValue("$valor", valor);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao gravar estado '{Chave}'", chave);
        }
    }

    public void SetState<T>(string chave, T valor) =>
        SetState(chave, JsonSerializer.Serialize(valor));

    public string? GetState(string chave)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT valor FROM agent_state WHERE chave=$chave";
            cmd.Parameters.AddWithValue("$chave", chave);
            return cmd.ExecuteScalar() as string;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao ler estado '{Chave}'", chave);
            return null;
        }
    }

    public T? GetState<T>(string chave)
    {
        var raw = GetState(chave);
        if (raw is null) return default;
        try { return JsonSerializer.Deserialize<T>(raw); }
        catch { return default; }
    }

    public void DeleteState(string chave)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM agent_state WHERE chave=$chave";
            cmd.Parameters.AddWithValue("$chave", chave);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao remover estado '{Chave}'", chave);
        }
    }

    // ─────────────────────────────────────────────────────
    // outbox_events — fila de eventos offline
    // ─────────────────────────────────────────────────────

    public void EnqueueEvent(string tipo, string endpoint, object payload)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO outbox_events(tipo, endpoint, payload)
                VALUES($tipo, $endpoint, $payload);
            ";
            cmd.Parameters.AddWithValue("$tipo", tipo);
            cmd.Parameters.AddWithValue("$endpoint", endpoint);
            cmd.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(payload));
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao enfileirar evento '{Tipo}'", tipo);
        }
    }

    public List<OutboxEvent> GetPendingEvents(int limite = 20)
    {
        var lista = new List<OutboxEvent>();
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT id, tipo, endpoint, payload, tentativas
                FROM outbox_events
                WHERE proximo_em <= datetime('now') AND tentativas < 5
                ORDER BY proximo_em ASC
                LIMIT $limite;
            ";
            cmd.Parameters.AddWithValue("$limite", limite);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                lista.Add(new OutboxEvent
                {
                    Id = reader.GetInt64(0),
                    Tipo = reader.GetString(1),
                    Endpoint = reader.GetString(2),
                    Payload = reader.GetString(3),
                    Tentativas = reader.GetInt32(4),
                });
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao buscar eventos pendentes");
        }
        return lista;
    }

    public void MarkEventSuccess(long id)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "DELETE FROM outbox_events WHERE id=$id";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao remover evento {Id}", id);
        }
    }

    public void MarkEventFailed(long id)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            // backoff exponencial: 2^tentativas minutos
            cmd.CommandText = @"
                UPDATE outbox_events
                SET tentativas = tentativas + 1,
                    proximo_em = datetime('now', '+' || (2 << tentativas) || ' minutes')
                WHERE id=$id;
            ";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao marcar evento {Id} como falho", id);
        }
    }

    public int GetPendingEventCount()
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM outbox_events WHERE tentativas < 5";
            return Convert.ToInt32(cmd.ExecuteScalar());
        }
        catch { return 0; }
    }

    // ─────────────────────────────────────────────────────
    // agent_logs — log estruturado local
    // ─────────────────────────────────────────────────────

    public void WriteLog(string nivel, string mensagem)
    {
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                INSERT INTO agent_logs(nivel, mensagem) VALUES($nivel, $mensagem);
                DELETE FROM agent_logs WHERE id IN (
                    SELECT id FROM agent_logs ORDER BY id DESC LIMIT -1 OFFSET 5000
                );
            ";
            cmd.Parameters.AddWithValue("$nivel", nivel);
            cmd.Parameters.AddWithValue("$mensagem", mensagem);
            cmd.ExecuteNonQuery();
        }
        catch { /* silencioso */ }
    }

    public List<(string Nivel, string Mensagem, string CriadoEm)> GetRecentLogs(int limite = 100)
    {
        var lista = new List<(string, string, string)>();
        try
        {
            using var conn = AbrirConexao();
            var cmd = conn.CreateCommand();
            cmd.CommandText = @"
                SELECT nivel, mensagem, criado_em
                FROM agent_logs
                ORDER BY id DESC LIMIT $limite;
            ";
            cmd.Parameters.AddWithValue("$limite", limite);
            using var reader = cmd.ExecuteReader();
            while (reader.Read())
                lista.Add((reader.GetString(0), reader.GetString(1), reader.GetString(2)));
        }
        catch { /* silencioso */ }
        return lista;
    }
}

public class OutboxEvent
{
    public long Id { get; set; }
    public string Tipo { get; set; } = "";
    public string Endpoint { get; set; } = "";
    public string Payload { get; set; } = "";
    public int Tentativas { get; set; }
}
