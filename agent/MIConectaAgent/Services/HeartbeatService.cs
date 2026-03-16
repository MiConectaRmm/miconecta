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
    private readonly LocalQueue _queue;
    private readonly ConsentManager _consentManager;
    private readonly ChatService _chatService;
    private readonly AutoUpdater _autoUpdater;

    private bool _registrado = false;
    private bool _online = false;
    private DateTime _ultimoInventario = DateTime.MinValue;
    private DateTime _ultimoPatches = DateTime.MinValue;
    private DateTime _ultimoChat = DateTime.MinValue;
    private DateTime _ultimoConsent = DateTime.MinValue;
    private DateTime _ultimoUpdateCheck = DateTime.MinValue;

    public HeartbeatService(
        ILogger<HeartbeatService> logger,
        AgentConfig config,
        SystemInfoCollector systemInfo,
        MetricsCollector metricsCollector,
        SoftwareInventoryCollector inventoryCollector,
        WindowsUpdateChecker updateChecker,
        ApiClient apiClient,
        LocalQueue queue,
        ConsentManager consentManager,
        ChatService chatService,
        AutoUpdater autoUpdater)
    {
        _logger = logger;
        _config = config;
        _systemInfo = systemInfo;
        _metricsCollector = metricsCollector;
        _inventoryCollector = inventoryCollector;
        _updateChecker = updateChecker;
        _apiClient = apiClient;
        _queue = queue;
        _consentManager = consentManager;
        _chatService = chatService;
        _autoUpdater = autoUpdater;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MIConectaRMM Agent v{Version} iniciado", _config.AgentVersion);

        // Registrar dispositivo (com retry infinito)
        await RegistrarDispositivo(stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // ── Heartbeat + Métricas ──
                var metricas = _metricsCollector.Coletar();
                var heartbeatOk = await _apiClient.EnviarHeartbeat(metricas);

                if (heartbeatOk)
                {
                    _online = true;
                    await _apiClient.EnviarMetricas(metricas);
                    _logger.LogDebug("Heartbeat OK - CPU: {Cpu}% RAM: {Ram}%",
                        metricas["cpuPercent"], metricas["ramPercent"]);
                }
                else
                {
                    _online = false;
                    _logger.LogWarning("Heartbeat falhou - servidor indisponível");
                    if (_config.QueueEnabled)
                        _queue.Enfileirar("metrics", "metrics/report", metricas);
                }

                // ── Inventário de software (a cada 6h) ──
                if ((DateTime.UtcNow - _ultimoInventario).TotalHours >= 6)
                {
                    _logger.LogInformation("Coletando inventário de software...");
                    var softwares = _inventoryCollector.Coletar();
                    var enviado = await _apiClient.EnviarInventario(softwares);
                    if (!enviado && _config.QueueEnabled)
                        _queue.Enfileirar("inventory", "agent/inventory", new { softwares });
                    _ultimoInventario = DateTime.UtcNow;
                    _logger.LogInformation("{Count} softwares inventariados", softwares.Count);
                }

                // ── Patches (a cada 12h) ──
                if ((DateTime.UtcNow - _ultimoPatches).TotalHours >= 12)
                {
                    _logger.LogInformation("Verificando Windows Update...");
                    var patches = _updateChecker.VerificarAtualizacoesPendentes();
                    var enviado = await _apiClient.SincronizarPatches(patches);
                    if (!enviado && _config.QueueEnabled)
                        _queue.Enfileirar("patches", "patches/agent/sync", new { patches });
                    _ultimoPatches = DateTime.UtcNow;
                    _logger.LogInformation("{Count} patches pendentes encontrados", patches.Count);
                }

                // ── Consent polling (a cada 10s se online) ──
                if (_online && _config.ConsentEnabled &&
                    (DateTime.UtcNow - _ultimoConsent).TotalSeconds >= _config.ConsentPollIntervalSeconds)
                {
                    await _consentManager.VerificarSolicitacoesPendentes();
                    _ultimoConsent = DateTime.UtcNow;
                }

                // ── Chat polling (a cada 15s se online) ──
                if (_online && _config.ChatEnabled &&
                    (DateTime.UtcNow - _ultimoChat).TotalSeconds >= _config.ChatPollIntervalSeconds)
                {
                    await _chatService.VerificarMensagens();
                    _ultimoChat = DateTime.UtcNow;
                }

                // ── Auto-update check (a cada 6h) ──
                if (_online && _config.AutoUpdateEnabled &&
                    (DateTime.UtcNow - _ultimoUpdateCheck).TotalHours >= _config.UpdateCheckIntervalHours)
                {
                    var update = await _autoUpdater.VerificarAtualizacao();
                    if (update != null)
                    {
                        _logger.LogInformation("Atualização encontrada: v{Nova}", update.VersaoNova);
                        if (update.Obrigatoria)
                            await _autoUpdater.AplicarAtualizacao(update);
                    }
                    _ultimoUpdateCheck = DateTime.UtcNow;
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no ciclo de heartbeat");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.HeartbeatIntervalSeconds), stoppingToken);
        }
    }

    private async Task RegistrarDispositivo(CancellationToken stoppingToken)
    {
        // Se já registrado, pular
        if (_config.IsRegistered)
        {
            _registrado = true;
            _logger.LogInformation("Dispositivo já registrado: {DeviceId}", _config.DeviceId);
            return;
        }

        while (!_registrado && !stoppingToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Registrando dispositivo no servidor...");
                var info = _systemInfo.ColetarInformacoes();
                info["agentVersion"] = _config.AgentVersion;
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
                    await Task.Delay(30000, stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro ao registrar dispositivo, tentando novamente em 30s...");
                await Task.Delay(30000, stoppingToken);
            }
        }
    }
}
