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
    private readonly AgentIdentityService _identity;
    private readonly ModuleSupervisor _supervisor;
    private readonly RustDeskIntegrationService _rustDesk;
    private readonly TelemetryService _telemetry;
    private readonly RealtimeClient _realtimeClient;

    private bool _online = false;
    private DateTime _ultimoInventario = DateTime.MinValue;
    private DateTime _ultimoPatches = DateTime.MinValue;
    private DateTime _ultimoChat = DateTime.MinValue;
    private DateTime _ultimoConsent = DateTime.MinValue;
    private DateTime _ultimoUpdateCheck = DateTime.MinValue;
    private DateTime _ultimoTelemetria = DateTime.MinValue;

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
        AutoUpdater autoUpdater,
        AgentIdentityService identity,
        ModuleSupervisor supervisor,
        RustDeskIntegrationService rustDesk,
        TelemetryService telemetry,
        RealtimeClient realtimeClient)
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
        _identity = identity;
        _supervisor = supervisor;
        _rustDesk = rustDesk;
        _telemetry = telemetry;
        _realtimeClient = realtimeClient;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("MIConectaRMM Agent v{Version} iniciado", _config.AgentVersion);

        // Registro via AgentIdentityService (retry infinito com backoff)
        await _identity.RegistrarAsync(stoppingToken);

        // Fase 2: Inicializar RustDesk
        await _rustDesk.InicializarAsync();

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // ── Heartbeat + Métricas ──
                var metricas = _metricsCollector.Coletar();
                metricas["loggedUser"] = Environment.UserName;

                // Incluir RustDesk ID se disponível (Fase 2)
                if (!string.IsNullOrEmpty(_rustDesk.RustDeskId))
                    metricas["rustdeskId"] = _rustDesk.RustDeskId!;

                // Incluir status dos módulos (Fase 1)
                metricas["modulos"] = _supervisor.GetHeartbeatPayload();

                var heartbeatOk = await _apiClient.EnviarHeartbeat(metricas);

                if (heartbeatOk)
                {
                    _online = true;
                    await _apiClient.EnviarMetricas(metricas);
                    _supervisor.ReportHealthy("HeartbeatService");
                    _logger.LogDebug("Heartbeat OK — CPU: {Cpu}% RAM: {Ram}%",
                        metricas["cpuPercent"], metricas["ramPercent"]);

                    // Enviar métricas via WebSocket em tempo real (Fase 4)
                    if (_realtimeClient.Conectado)
                        await _realtimeClient.EnviarMetricasRealtime(new Dictionary<string, object>(metricas));
                }
                else
                {
                    _online = false;
                    _supervisor.ReportFailure("HeartbeatService");
                    _logger.LogWarning("Heartbeat falhou — servidor indisponível");
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

                // ── Patches (a cada 12h) — Fase 6 ──
                if ((DateTime.UtcNow - _ultimoPatches).TotalHours >= 12)
                {
                    _logger.LogInformation("Verificando Windows Update...");
                    var patches = _updateChecker.VerificarAtualizacoesPendentes();
                    var enviado = await _apiClient.SincronizarPatches(patches);
                    if (!enviado && _config.QueueEnabled)
                        _queue.Enfileirar("patches", "patches/agent/sync", new { patches });

                    // Alerta se patches críticos pendentes (Fase 6)
                    var criticos = patches.Count(p =>
                        p.TryGetValue("severidade", out var s) && s?.ToString() == "critico");
                    if (criticos > 0)
                    {
                        _logger.LogWarning("{N} patch(es) crítico(s) pendente(s)", criticos);
                        await _apiClient.CriarAlerta("patches_criticos", $"{criticos} patch(es) crítico(s) pendente(s)", "alta");
                    }

                    _ultimoPatches = DateTime.UtcNow;
                    _logger.LogInformation("{Count} patches pendentes encontrados ({Criticos} críticos)",
                        patches.Count, criticos);
                }

                // ── Telemetria (a cada 30min) — Fase 3 ──
                if ((DateTime.UtcNow - _ultimoTelemetria).TotalMinutes >= 30)
                {
                    var snap = _telemetry.Coletar();
                    await _apiClient.EnviarTelemetria(snap);

                    // Alerta de reboot pendente (Fase 6)
                    if (snap.ReinicializacaoPendente)
                        await _apiClient.CriarAlerta("reboot_pendente", "Reinicialização pendente detectada", "media");

                    _ultimoTelemetria = DateTime.UtcNow;
                }

                // ── Consent polling HTTP — fallback quando WS offline ──
                if (_online && _config.ConsentEnabled && !_realtimeClient.Conectado &&
                    (DateTime.UtcNow - _ultimoConsent).TotalSeconds >= _config.ConsentPollIntervalSeconds)
                {
                    await _consentManager.VerificarSolicitacoesPendentes();
                    _ultimoConsent = DateTime.UtcNow;
                }

                // ── Chat polling HTTP — fallback quando WS offline ──
                if (_online && _config.ChatEnabled && !_realtimeClient.Conectado &&
                    (DateTime.UtcNow - _ultimoChat).TotalSeconds >= _config.ChatPollIntervalSeconds)
                {
                    await _chatService.VerificarMensagens();
                    _ultimoChat = DateTime.UtcNow;
                }

                // ── Auto-update check (a cada N horas) — Fase 7 ──
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
                _supervisor.ReportFailure("HeartbeatService", ex);
                _logger.LogError(ex, "Erro no ciclo de heartbeat");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.HeartbeatIntervalSeconds), stoppingToken);
        }
    }
}

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // ── Heartbeat + Métricas ──
                var metricas = _metricsCollector.Coletar();

                // Adiciona usuário logado ao payload do heartbeat
                metricas["loggedUser"] = Environment.UserName;

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
}
