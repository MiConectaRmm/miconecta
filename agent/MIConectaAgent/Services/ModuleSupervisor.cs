using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;

namespace MIConectaAgent.Services;

/// <summary>
/// Supervisor de módulos: monitora a saúde de cada serviço registrado,
/// registra falhas e expõe status geral para o heartbeat.
/// </summary>
public class ModuleSupervisor
{
    private readonly ILogger<ModuleSupervisor> _logger;
    private readonly LocalStateStore _store;

    private readonly ConcurrentDictionary<string, ModuleStatus> _status = new();

    public ModuleSupervisor(ILogger<ModuleSupervisor> logger, LocalStateStore store)
    {
        _logger = logger;
        _store = store;
    }

    // ─────────────────────────────────────────────────────
    // API pública
    // ─────────────────────────────────────────────────────

    /// <summary>Registra ou atualiza um módulo como saudável.</summary>
    public void ReportHealthy(string modulo)
    {
        var status = _status.GetOrAdd(modulo, _ => new ModuleStatus(modulo));
        status.UltimaAtividade = DateTime.UtcNow;
        status.Saudavel = true;
        status.FalhasConsecutivas = 0;
        status.UltimoErro = null;
    }

    /// <summary>Registra uma falha em um módulo.</summary>
    public void ReportFailure(string modulo, Exception? ex = null)
    {
        var status = _status.GetOrAdd(modulo, _ => new ModuleStatus(modulo));
        status.FalhasConsecutivas++;
        status.TotalFalhas++;
        status.Saudavel = status.FalhasConsecutivas < 3;
        status.UltimoErro = ex?.Message ?? "Falha desconhecida";
        status.UltimaFalha = DateTime.UtcNow;

        _logger.LogWarning("Módulo '{Modulo}' reportou falha #{N}: {Erro}",
            modulo, status.FalhasConsecutivas, status.UltimoErro);

        if (status.FalhasConsecutivas >= 3)
        {
            _logger.LogError("Módulo '{Modulo}' marcado como DEGRADADO após {N} falhas consecutivas", modulo, status.FalhasConsecutivas);
            _store.WriteLog("ERROR", $"Módulo {modulo} degradado: {status.UltimoErro}");
        }
    }

    /// <summary>Retorna resumo de saúde de todos os módulos registrados.</summary>
    public IReadOnlyDictionary<string, ModuleStatus> GetAllStatus() =>
        _status;

    /// <summary>True se todos os módulos essenciais estão saudáveis.</summary>
    public bool IsSystemHealthy()
    {
        if (_status.IsEmpty) return true;
        return _status.Values.All(s => s.Saudavel);
    }

    /// <summary>Serializa status para incluir no heartbeat.</summary>
    public Dictionary<string, object> GetHeartbeatPayload()
    {
        var result = new Dictionary<string, object>();
        foreach (var (nome, status) in _status)
        {
            result[nome] = new
            {
                ok = status.Saudavel,
                falhas = status.FalhasConsecutivas,
                ultimaAtividade = status.UltimaAtividade?.ToString("O"),
            };
        }
        return result;
    }
}

public class ModuleStatus
{
    public ModuleStatus(string nome) { Nome = nome; }

    public string Nome { get; }
    public bool Saudavel { get; set; } = true;
    public int FalhasConsecutivas { get; set; }
    public int TotalFalhas { get; set; }
    public string? UltimoErro { get; set; }
    public DateTime? UltimaAtividade { get; set; }
    public DateTime? UltimaFalha { get; set; }
}
