using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;

namespace MIConectaAgent.Services;

public class ApiClient
{
    private readonly HttpClient _http;
    private readonly AgentConfig _config;
    private readonly ILogger<ApiClient> _logger;

    public ApiClient(AgentConfig config, ILogger<ApiClient> logger)
    {
        _config = config;
        _logger = logger;
        _http = new HttpClient
        {
            BaseAddress = new Uri(config.ServerUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(30),
        };
    }

    private void AdicionarHeaders()
    {
        _http.DefaultRequestHeaders.Remove("x-device-id");
        _http.DefaultRequestHeaders.Remove("x-agent-token");

        if (!string.IsNullOrEmpty(_config.DeviceId))
            _http.DefaultRequestHeaders.Add("x-device-id", _config.DeviceId);

        if (!string.IsNullOrEmpty(_config.DeviceToken))
            _http.DefaultRequestHeaders.Add("x-agent-token", _config.DeviceToken);
    }

    public async Task<JsonElement?> RegistrarDispositivo(Dictionary<string, object?> info)
    {
        try
        {
            var payload = new Dictionary<string, object?>
            {
                ["installationToken"] = _config.ProvisionToken,
                ["hostname"] = info.TryGetValue("hostname", out var hostname) ? hostname : Environment.MachineName,
                ["username"] = info.TryGetValue("username", out var username) ? username : Environment.UserName,
                ["sistemaOperacional"] = info.TryGetValue("sistemaOperacional", out var sistemaOperacional) ? sistemaOperacional : null,
                ["versaoWindows"] = info.TryGetValue("versaoWindows", out var versaoWindows) ? versaoWindows : null,
                ["cpu"] = info.TryGetValue("cpu", out var cpu) ? cpu : null,
                ["ramTotalMb"] = info.TryGetValue("ramTotalMb", out var ramTotalMb) ? ramTotalMb : null,
                ["discoTotalMb"] = info.TryGetValue("discoTotalMb", out var discoTotalMb) ? discoTotalMb : null,
                ["discoDisponivelMb"] = info.TryGetValue("discoDisponivelMb", out var discoDisponivelMb) ? discoDisponivelMb : null,
                ["ipLocal"] = info.TryGetValue("ipLocal", out var ipLocal) ? ipLocal : null,
                ["ipExterno"] = info.TryGetValue("ipExterno", out var ipExterno) ? ipExterno : null,
                ["modeloMaquina"] = info.TryGetValue("modeloMaquina", out var modeloMaquina) ? modeloMaquina : null,
                ["numeroSerie"] = info.TryGetValue("numeroSerie", out var numeroSerie) ? numeroSerie : null,
                ["macAddress"] = info.TryGetValue("macAddress", out var macAddress) ? macAddress : null,
                ["agentVersion"] = info.TryGetValue("agentVersion", out var agentVersion) ? agentVersion : _config.AgentVersion,
                ["rustdeskId"] = info.TryGetValue("rustdeskId", out var rustdeskId) ? rustdeskId : null,
                ["antivirusNome"] = info.TryGetValue("antivirusNome", out var antivirusNome) ? antivirusNome : null,
                ["antivirusStatus"] = info.TryGetValue("antivirusStatus", out var antivirusStatus) ? antivirusStatus : null,
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, "agents/register");
            request.Headers.Add("x-agent-provision-token", _config.ProvisionToken);
            request.Content = JsonContent.Create(payload);

            var response = await _http.SendAsync(request);
            response.EnsureSuccessStatusCode();

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            return json;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao registrar dispositivo");
            return null;
        }
    }

    public async Task<bool> EnviarHeartbeat(Dictionary<string, object>? metricas = null)
    {
        try
        {
            AdicionarHeaders();
            var data = metricas ?? new Dictionary<string, object>();
            var payload = new Dictionary<string, object?>
            {
                ["agentToken"] = _config.DeviceToken,
                ["deviceId"] = _config.DeviceId,
                ["status"] = "online",
                ["agentVersion"] = data.TryGetValue("agentVersion", out var agentVersion) ? agentVersion : _config.AgentVersion,
                ["remoteStatus"] = data.TryGetValue("rustdeskId", out var rustdeskId) && rustdeskId is not null && !string.IsNullOrWhiteSpace(rustdeskId.ToString()) ? "ready" : null,
                ["rustdeskId"] = data.TryGetValue("rustdeskId", out var rustdeskIdValue) ? rustdeskIdValue : null,
                ["cpuPercent"] = data.TryGetValue("cpuPercent", out var cpuPercent) ? cpuPercent : null,
                ["ramPercent"] = data.TryGetValue("ramPercent", out var ramPercent) ? ramPercent : null,
                ["ramUsadaMb"] = data.TryGetValue("ramUsadaMb", out var ramUsadaMb) ? ramUsadaMb : null,
                ["discoPercent"] = data.TryGetValue("discoPercent", out var discoPercent) ? discoPercent : null,
                ["discoUsadoMb"] = data.TryGetValue("discoUsadoMb", out var discoUsadoMb) ? discoUsadoMb : null,
                ["uptimeSegundos"] = data.TryGetValue("uptimeSegundos", out var uptimeSegundos) ? uptimeSegundos : null,
                ["loggedUser"] = data.TryGetValue("loggedUser", out var loggedUser) ? loggedUser : null,
                ["antivirusNome"] = data.TryGetValue("antivirusNome", out var antivirusNome) ? antivirusNome : null,
                ["antivirusStatus"] = data.TryGetValue("antivirusStatus", out var antivirusStatus) ? antivirusStatus : null,
            };

            var response = await _http.PostAsJsonAsync("agents/heartbeat", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar heartbeat");
            return false;
        }
    }

    public async Task<bool> EnviarMetricas(Dictionary<string, object> metricas)
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.PostAsJsonAsync("metrics/report", metricas);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar métricas");
            return false;
        }
    }

    public async Task<bool> EnviarInventario(List<Dictionary<string, string?>> softwares)
    {
        try
        {
            AdicionarHeaders();
            var payload = new { softwares };
            var response = await _http.PostAsJsonAsync("agents/inventory", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar inventário");
            return false;
        }
    }

    public async Task<bool> SincronizarPatches(List<Dictionary<string, object?>> patches)
    {
        try
        {
            AdicionarHeaders();
            var payload = new { patches };
            var response = await _http.PostAsJsonAsync("patches/agent/sync", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao sincronizar patches");
            return false;
        }
    }

    public async Task<List<JsonElement>> ObterComandosPendentes()
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.GetAsync("scripts/agent/pendentes");
            if (!response.IsSuccessStatusCode) return new List<JsonElement>();

            var json = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            return json ?? new List<JsonElement>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter comandos pendentes");
            return new List<JsonElement>();
        }
    }

    public async Task<bool> ReportarResultadoExecucao(string execId, ScriptResult resultado)
    {
        try
        {
            AdicionarHeaders();
            var payload = new
            {
                status = resultado.Status,
                saida = resultado.Saida,
                saidaErro = resultado.SaidaErro,
                codigoSaida = resultado.CodigoSaida,
                iniciadoEm = resultado.IniciadoEm,
                finalizadoEm = resultado.FinalizadoEm,
            };
            var response = await _http.PostAsJsonAsync($"scripts/agent/resultado/{execId}", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao reportar resultado da execução {ExecId}", execId);
            return false;
        }
    }

    public async Task<List<JsonElement>> ObterDeploysPendentes()
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.GetAsync("software/agent/pendentes");
            if (!response.IsSuccessStatusCode) return new List<JsonElement>();

            var json = await response.Content.ReadFromJsonAsync<List<JsonElement>>();
            return json ?? new List<JsonElement>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter deploys pendentes");
            return new List<JsonElement>();
        }
    }

    // ── v2: Sessão Remota / Consentimento ──

    public async Task<List<JsonElement>> ObterSolicitacoesSessao()
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.GetAsync("remote-sessions/agent/pendentes");
            if (!response.IsSuccessStatusCode) return new List<JsonElement>();
            return await response.Content.ReadFromJsonAsync<List<JsonElement>>() ?? new List<JsonElement>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter solicitações de sessão");
            return new List<JsonElement>();
        }
    }

    public async Task<bool> ResponderConsentimento(string sessionId, bool consentido, Dictionary<string, object> info)
    {
        try
        {
            AdicionarHeaders();
            var payload = new { consentido, info };
            var response = await _http.PutAsJsonAsync($"remote-sessions/{sessionId}/consent", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao responder consentimento {SessionId}", sessionId);
            return false;
        }
    }

    // ── v2: Chat ──

    public async Task<List<JsonElement>> ObterMensagensNaoLidas()
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.GetAsync("chat/agent/unread");
            if (!response.IsSuccessStatusCode) return new List<JsonElement>();
            return await response.Content.ReadFromJsonAsync<List<JsonElement>>() ?? new List<JsonElement>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao obter mensagens não lidas");
            return new List<JsonElement>();
        }
    }

    public async Task<bool> EnviarMensagemChat(string ticketId, string conteudo)
    {
        try
        {
            AdicionarHeaders();
            var payload = new { conteudo };
            var response = await _http.PostAsJsonAsync($"chat/tickets/{ticketId}/messages", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar mensagem no ticket {TicketId}", ticketId);
            return false;
        }
    }

    // ── v2: Auto-Update ──

    public async Task<JsonElement?> VerificarAtualizacaoAgente(string versaoAtual)
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.GetAsync($"agents/check-update?versao={versaoAtual}&deviceId={_config.DeviceId}");
            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadFromJsonAsync<JsonElement>();
            if (json.TryGetProperty("updateAvailable", out var avail) && avail.GetBoolean())
                return json;
            return null;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar atualização");
            return null;
        }
    }

    public async Task<bool> BaixarArquivo(string url, string destino)
    {
        try
        {
            using var downloadClient = new HttpClient { Timeout = TimeSpan.FromMinutes(10) };
            using var stream = await downloadClient.GetStreamAsync(url);
            using var file = File.Create(destino);
            await stream.CopyToAsync(file);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao baixar arquivo de {Url}", url);
            return false;
        }
    }

    // ── v2: Queue Fallback ──

    public async Task<bool> EnviarPayloadGenerico(string endpoint, string jsonPayload)
    {
        try
        {
            AdicionarHeaders();
            var content = new StringContent(jsonPayload, System.Text.Encoding.UTF8, "application/json");
            var response = await _http.PostAsync(endpoint, content);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar payload para {Endpoint}", endpoint);
            return false;
        }
    }

    // ── v2: Connectivity Check ──

    public async Task<bool> TestarConexao()
    {
        try
        {
            var response = await _http.GetAsync("health");
            return response.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    // ── Fase 6: Alertas ──

    public async Task<bool> CriarAlerta(string tipo, string mensagem, string severidade = "media")
    {
        try
        {
            AdicionarHeaders();
            var payload = new
            {
                deviceId = _config.DeviceId,
                tipo,
                mensagem,
                severidade,
                timestamp = DateTime.UtcNow.ToString("O"),
            };
            var response = await _http.PostAsJsonAsync("alerts/agent", payload);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao criar alerta {Tipo}", tipo);
            return false;
        }
    }

    // ── Fase 3: Telemetria ──

    public async Task<bool> EnviarTelemetria(TelemetrySnapshot snap)
    {
        try
        {
            AdicionarHeaders();
            var response = await _http.PostAsJsonAsync($"devices/{_config.DeviceId}/telemetry", snap);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao enviar telemetria");
            return false;
        }
    }
}
