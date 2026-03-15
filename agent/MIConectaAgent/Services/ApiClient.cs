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
}
