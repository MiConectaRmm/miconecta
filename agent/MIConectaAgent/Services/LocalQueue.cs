using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Fila local persistente (SQLite) para fallback offline.
/// Quando o servidor está indisponível, os dados são enfileirados localmente
/// e enviados automaticamente quando a conexão é restabelecida.
/// </summary>
public class LocalQueue : IDisposable
{
    private readonly ILogger<LocalQueue> _logger;
    private readonly string _dbPath;
    private SqliteConnection? _conn;

    public LocalQueue(ILogger<LocalQueue> logger)
    {
        _logger = logger;
        var appData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "MIConectaRMM"
        );
        Directory.CreateDirectory(appData);
        _dbPath = Path.Combine(appData, "queue.db");
        Inicializar();
    }

    private void Inicializar()
    {
        try
        {
            _conn = new SqliteConnection($"Data Source={_dbPath}");
            _conn.Open();

            using var cmd = _conn.CreateCommand();
            cmd.CommandText = @"
                CREATE TABLE IF NOT EXISTS queue (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    tipo TEXT NOT NULL,
                    endpoint TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    criado_em TEXT NOT NULL DEFAULT (datetime('now')),
                    tentativas INTEGER NOT NULL DEFAULT 0,
                    max_tentativas INTEGER NOT NULL DEFAULT 10,
                    proximo_envio TEXT NOT NULL DEFAULT (datetime('now'))
                );
                CREATE INDEX IF NOT EXISTS idx_queue_proximo ON queue(proximo_envio);
            ";
            cmd.ExecuteNonQuery();

            _logger.LogInformation("LocalQueue inicializada: {Path}", _dbPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao inicializar LocalQueue");
        }
    }

    public void Enfileirar(string tipo, string endpoint, object payload)
    {
        try
        {
            EnsureOpen();
            using var cmd = _conn!.CreateCommand();
            cmd.CommandText = "INSERT INTO queue (tipo, endpoint, payload) VALUES ($tipo, $endpoint, $payload)";
            cmd.Parameters.AddWithValue("$tipo", tipo);
            cmd.Parameters.AddWithValue("$endpoint", endpoint);
            cmd.Parameters.AddWithValue("$payload", JsonSerializer.Serialize(payload));
            cmd.ExecuteNonQuery();

            _logger.LogDebug("Enfileirado: {Tipo} → {Endpoint}", tipo, endpoint);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enfileirar {Tipo}", tipo);
        }
    }

    public List<QueueItem> ObterPendentes(int limite = 50)
    {
        var items = new List<QueueItem>();
        try
        {
            EnsureOpen();
            using var cmd = _conn!.CreateCommand();
            cmd.CommandText = @"
                SELECT id, tipo, endpoint, payload, tentativas
                FROM queue
                WHERE proximo_envio <= datetime('now') AND tentativas < max_tentativas
                ORDER BY criado_em ASC
                LIMIT $limite
            ";
            cmd.Parameters.AddWithValue("$limite", limite);

            using var reader = cmd.ExecuteReader();
            while (reader.Read())
            {
                items.Add(new QueueItem
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
            _logger.LogError(ex, "Erro ao obter pendentes da fila");
        }
        return items;
    }

    public void Remover(long id)
    {
        try
        {
            EnsureOpen();
            using var cmd = _conn!.CreateCommand();
            cmd.CommandText = "DELETE FROM queue WHERE id = $id";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao remover item {Id} da fila", id);
        }
    }

    public void IncrementarTentativa(long id)
    {
        try
        {
            EnsureOpen();
            using var cmd = _conn!.CreateCommand();
            // Backoff exponencial: próxima tentativa = agora + 2^tentativas minutos
            cmd.CommandText = @"
                UPDATE queue 
                SET tentativas = tentativas + 1,
                    proximo_envio = datetime('now', '+' || (1 << tentativas) || ' minutes')
                WHERE id = $id
            ";
            cmd.Parameters.AddWithValue("$id", id);
            cmd.ExecuteNonQuery();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao incrementar tentativa {Id}", id);
        }
    }

    public int ContarPendentes()
    {
        try
        {
            EnsureOpen();
            using var cmd = _conn!.CreateCommand();
            cmd.CommandText = "SELECT COUNT(*) FROM queue WHERE tentativas < max_tentativas";
            return Convert.ToInt32(cmd.ExecuteScalar());
        }
        catch { return 0; }
    }

    public void LimparExpirados()
    {
        try
        {
            EnsureOpen();
            using var cmd = _conn!.CreateCommand();
            cmd.CommandText = "DELETE FROM queue WHERE tentativas >= max_tentativas OR criado_em < datetime('now', '-7 days')";
            var removed = cmd.ExecuteNonQuery();
            if (removed > 0)
                _logger.LogInformation("Removidos {Count} itens expirados da fila", removed);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao limpar expirados");
        }
    }

    private void EnsureOpen()
    {
        if (_conn?.State != System.Data.ConnectionState.Open)
        {
            _conn?.Close();
            _conn = new SqliteConnection($"Data Source={_dbPath}");
            _conn.Open();
        }
    }

    public void Dispose()
    {
        _conn?.Close();
        _conn?.Dispose();
    }
}

public class QueueItem
{
    public long Id { get; set; }
    public string Tipo { get; set; } = "";
    public string Endpoint { get; set; } = "";
    public string Payload { get; set; } = "";
    public int Tentativas { get; set; }
}
