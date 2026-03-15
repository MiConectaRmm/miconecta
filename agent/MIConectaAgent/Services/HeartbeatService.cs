using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MIConectaAgent.Services;

public class HeartbeatService : BackgroundService
{
    private readonly ILogger<HeartbeatService> _logger;
    private readonly AgentConfig _config;
    private readonly SystemInfoCollector _systemInfo;
    private readonly MetricsCollector _metricsCollector;
    private readonly SoftwareInventoryCollector _inventoryCollector;
    private readonly WindowsUpdateChecker _updateChecker;
    private readonly ApiClient _apiClient;

    private bool _registrado = false;
    private DateTime _ultimoInventario = DateTime.MinValue;
    private DateTime _ultimoPatches = DateTime.MinValue;

    public HeartbeatService(
        ILogger<HeartbeatService> logger,
        AgentConfig config,
        SystemInfoCollector systemInfo,
        MetricsCollector metricsCollector,
        SoftwareInventoryCollector inventoryCollector,
        WindowsUpdateChecker updateChecker,
        ApiClient apiClient)
    {
        _logger = logger;
        _config = config;
        _systemInfo = systemInfo;
        _metricsCollector = metricsCollector;
        _inventoryCollector = inventoryCollector;
        _updateChecker = updateChecker;
        _apiClient = apiClient;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MIConectaRMM Agent iniciado");

        // Registrar dispositivo
        await RegistrarDispositivo();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Coletar e enviar métricas
                var metricas = _metricsCollector.Coletar();
                await _apiClient.EnviarHeartbeat(metricas);
                await _apiClient.EnviarMetricas(metricas);

                _logger.LogDebug("Heartbeat enviado - CPU: {Cpu}% RAM: {Ram}%",
                    metricas["cpuPercent"], metricas["ramPercent"]);

                // Inventário de software a cada 6 horas
                if ((DateTime.UtcNow - _ultimoInventario).TotalHours >= 6)
                {
                    _logger.LogInformation("Coletando inventário de software...");
                    var softwares = _inventoryCollector.Coletar();
                    await _apiClient.EnviarInventario(softwares);
                    _ultimoInventario = DateTime.UtcNow;
                    _logger.LogInformation("{Count} softwares inventariados", softwares.Count);
                }

                // Verificar patches a cada 12 horas
                if ((DateTime.UtcNow - _ultimoPatches).TotalHours >= 12)
                {
                    _logger.LogInformation("Verificando Windows Update...");
                    var patches = _updateChecker.VerificarAtualizacoesPendentes();
                    await _apiClient.SincronizarPatches(patches);
                    _ultimoPatches = DateTime.UtcNow;
                    _logger.LogInformation("{Count} patches pendentes encontrados", patches.Count);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no ciclo de heartbeat");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.HeartbeatIntervalSeconds), stoppingToken);
        }
    }

    private async Task RegistrarDispositivo()
    {
        while (!_registrado)
        {
            try
            {
                _logger.LogInformation("Registrando dispositivo no servidor...");
                var info = _systemInfo.ColetarInformacoes();
                var resultado = await _apiClient.RegistrarDispositivo(info);

                if (resultado.HasValue)
                {
                    var json = resultado.Value;
                    _config.DeviceId = json.GetProperty("id").GetString() ?? "";
                    if (json.TryGetProperty("deviceToken", out var token))
                        _config.DeviceToken = token.GetString() ?? "";
                    _config.Salvar();
                    _registrado = true;
                    _logger.LogInformation("Dispositivo registrado com ID: {DeviceId}", _config.DeviceId);
                }
                else
                {
                    _logger.LogWarning("Falha ao registrar, tentando novamente em 30s...");
                    await Task.Delay(30000);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao registrar dispositivo, tentando novamente em 30s...");
                await Task.Delay(30000);
            }
        }
    }
}
