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
            info["tenantId"] = _config.TenantId;
            info["organizationId"] = _config.OrganizationId;

            var response = await _http.PostAsJsonAsync("agent/register", info);
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
            var response = await _http.PostAsJsonAsync("agent/heartbeat", metricas ?? new Dictionary<string, object>());
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
            var response = await _http.PostAsJsonAsync("agent/inventory", payload);
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
            var response = await _http.GetAsync($"agents/update/check?versao={versaoAtual}");
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
}
