using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Gerencia a identidade persistente do dispositivo:
/// - Fingerprint (hash determinístico de hostname + serial + MAC)
/// - DeviceId e AgentToken no disco (AgentConfig)
/// - Fluxo de registro via provision token
/// - Re-registro quando necessário (token expirado / ID perdido)
/// </summary>
public class AgentIdentityService
{
    private readonly AgentConfig _config;
    private readonly ApiClient _api;
    private readonly SystemInfoCollector _sysInfo;
    private readonly LocalStateStore _store;
    private readonly ILogger<AgentIdentityService> _logger;

    // Chaves no LocalStateStore
    private const string KEY_FINGERPRINT = "identity.fingerprint";
    private const string KEY_REGISTERED_AT = "identity.registeredAt";
    private const string KEY_LAST_REGISTER_ATTEMPT = "identity.lastRegisterAttempt";

    public AgentIdentityService(
        AgentConfig config,
        ApiClient api,
        SystemInfoCollector sysInfo,
        LocalStateStore store,
        ILogger<AgentIdentityService> logger)
    {
        _config = config;
        _api = api;
        _sysInfo = sysInfo;
        _store = store;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────
    // Propriedades públicas
    // ─────────────────────────────────────────────────────

    public bool IsRegistered => _config.IsRegistered;

    public string DeviceId => _config.DeviceId;

    /// <summary>
    /// Retorna o fingerprint calculado do hardware atual.
    /// Fingerprint = SHA256(hostname | serial | mac).
    /// </summary>
    public string CalcularFingerprint()
    {
        var info = _sysInfo.ColetarInformacoes();
        var hostname = info.TryGetValue("hostname", out var h) ? h?.ToString() ?? "" : Environment.MachineName;
        var serial = info.TryGetValue("numeroSerie", out var s) ? s?.ToString() ?? "" : "";
        var mac = ObterPrimeiroMac();
        var raw = $"{hostname}|{serial}|{mac}";
        using var sha = SHA256.Create();
        var bytes = sha.ComputeHash(Encoding.UTF8.GetBytes(raw));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    /// <summary>
    /// Verifica se o fingerprint mudou desde o último registro.
    /// (Ex: troca de motherboard, reinstalação em hardware diferente)
    /// </summary>
    public bool FingerprintAlterado()
    {
        var saved = _store.GetState(KEY_FINGERPRINT);
        if (saved is null) return false; // primeiro boot, ainda sem registro
        var atual = CalcularFingerprint();
        return !string.Equals(saved, atual, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Executa o registro do dispositivo no servidor.
    /// Tenta até conseguir (loop com backoff), respeitando o token de provision.
    /// Retorna true quando registrado com sucesso.
    /// </summary>
    public async Task<bool> RegistrarAsync(CancellationToken ct)
    {
        if (IsRegistered && !FingerprintAlterado())
        {
            _logger.LogInformation("Dispositivo já registrado: {DeviceId}", DeviceId);
            return true;
        }

        if (FingerprintAlterado())
        {
            _logger.LogWarning("Fingerprint alterado — re-registrando dispositivo...");
            _config.DeviceId = "";
            _config.DeviceToken = "";
            _config.Salvar();
        }

        _logger.LogInformation("Iniciando registro do dispositivo no servidor...");
        _store.SetState(KEY_LAST_REGISTER_ATTEMPT, DateTime.UtcNow.ToString("O"));

        int tentativa = 0;
        while (!ct.IsCancellationRequested)
        {
            tentativa++;
            try
            {
                var info = _sysInfo.ColetarInformacoes();
                info["agentVersion"] = _config.AgentVersion;
                info["fingerprint"] = CalcularFingerprint();
                info["macAddress"] = ObterPrimeiroMac();
                info["username"] = Environment.UserName;

                var resultado = await _api.RegistrarDispositivo(info);

                if (resultado.HasValue)
                {
                    var json = resultado.Value;

                    _config.DeviceId = json.GetProperty("deviceId").GetString() ?? "";
                    if (json.TryGetProperty("agentToken", out var token))
                        _config.DeviceToken = token.GetString() ?? "";
                    _config.Salvar();

                    // Persiste fingerprint e timestamp no estado local
                    _store.SetState(KEY_FINGERPRINT, CalcularFingerprint());
                    _store.SetState(KEY_REGISTERED_AT, DateTime.UtcNow.ToString("O"));

                    _logger.LogInformation("Dispositivo registrado com sucesso. DeviceId={Id}", _config.DeviceId);
                    return true;
                }

                _logger.LogWarning("Tentativa {N}: servidor não retornou deviceId, tentando novamente...", tentativa);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Tentativa {N}: erro ao registrar dispositivo", tentativa);
            }

            int delaySegundos = tentativa <= 3 ? 30 : Math.Min(tentativa * 60, 600);
            _logger.LogInformation("Aguardando {Seg}s antes de nova tentativa...", delaySegundos);
            await Task.Delay(TimeSpan.FromSeconds(delaySegundos), ct);
        }

        return false;
    }

    /// <summary>
    /// Salva o estado de identidade após registro bem-sucedido recebido por outro caminho.
    /// </summary>
    public void MarcarRegistrado(string deviceId, string agentToken)
    {
        _config.DeviceId = deviceId;
        _config.DeviceToken = agentToken;
        _config.Salvar();
        _store.SetState(KEY_FINGERPRINT, CalcularFingerprint());
        _store.SetState(KEY_REGISTERED_AT, DateTime.UtcNow.ToString("O"));
    }

    // ─────────────────────────────────────────────────────
    // Helpers privados
    // ─────────────────────────────────────────────────────

    private string ObterPrimeiroMac()
    {
        try
        {
            return System.Net.NetworkInformation.NetworkInterface
                .GetAllNetworkInterfaces()
                .Where(n => n.NetworkInterfaceType != System.Net.NetworkInformation.NetworkInterfaceType.Loopback
                         && n.OperationalStatus == System.Net.NetworkInformation.OperationalStatus.Up)
                .Select(n => n.GetPhysicalAddress().ToString())
                .FirstOrDefault(m => !string.IsNullOrWhiteSpace(m) && m != "000000000000")
                ?? "000000000000";
        }
        catch
        {
            return "000000000000";
        }
    }
}
