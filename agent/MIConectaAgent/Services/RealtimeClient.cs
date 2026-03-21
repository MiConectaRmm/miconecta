using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using SocketIOClient;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Cliente WebSocket via Socket.IO para comunicação em tempo real com o backend.
/// Conecta ao namespace /rmm — recebe comandos de script, chat e sessões remotas.
/// Usa reconnect manual com backoff. Cai para outbox HTTP quando offline.
/// </summary>
public class RealtimeClient : BackgroundService
{
    private readonly AgentConfig _config;
    private readonly LocalStateStore _store;
    private readonly ModuleSupervisor _supervisor;
    private readonly ILogger<RealtimeClient> _logger;

    private SocketIOClient.SocketIO? _socket;
    private bool _conectado = false;

    public bool Conectado => _conectado;

    public event Func<ScriptDispatchPayload, Task>? OnScriptDispatch;
    public event Func<ChatMessagePayload, Task>? OnChatMessage;
    public event Func<RemoteSessionPayload, Task>? OnRemoteSession;

    public RealtimeClient(
        AgentConfig config,
        LocalStateStore store,
        ModuleSupervisor supervisor,
        ILogger<RealtimeClient> logger)
    {
        _config = config;
        _store = store;
        _supervisor = supervisor;
        _logger = logger;
    }

    // ─────────────────────────────────────────────────────
    // BackgroundService
    // ─────────────────────────────────────────────────────

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Aguardar registro antes de conectar
        while (!_config.IsRegistered && !stoppingToken.IsCancellationRequested)
            await Task.Delay(5000, stoppingToken);

        if (stoppingToken.IsCancellationRequested) return;

        _logger.LogInformation("RealtimeClient: iniciando conexão Socket.IO...");

        int tentativa = 0;
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                tentativa++;
                await ConectarAsync(stoppingToken);

                // Mantém o loop enquanto conectado
                while (_conectado && !stoppingToken.IsCancellationRequested)
                {
                    await Task.Delay(10000, stoppingToken);
                    _supervisor.ReportHealthy("RealtimeClient");
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _supervisor.ReportFailure("RealtimeClient", ex);
                _logger.LogWarning("RealtimeClient: falha #{N} — {Msg}", tentativa, ex.Message);
                _conectado = false;
            }

            int delay = Math.Min(tentativa * 30, 300); // máx 5 min
            _logger.LogInformation("RealtimeClient: aguardando {Seg}s antes de reconectar...", delay);
            await Task.Delay(TimeSpan.FromSeconds(delay), stoppingToken);
        }

        await DesconectarAsync();
    }

    // ─────────────────────────────────────────────────────
    // Conexão
    // ─────────────────────────────────────────────────────

    private async Task ConectarAsync(CancellationToken ct)
    {
        var serverUrl = _config.ServerUrl.TrimEnd('/');
        // Remove /api/v1 do sufixo para obter a URL base do Socket.IO
        var baseUrl = serverUrl.Replace("/api/v1", "");

        _socket = new SocketIOClient.SocketIO(baseUrl, new SocketIOOptions
        {
            Path = "/socket.io",
            Reconnection = false, // gerenciamos manualmente
            Transport = SocketIOClient.Transport.TransportProtocol.WebSocket,
            ExtraHeaders = new Dictionary<string, string>
            {
                ["x-device-id"] = _config.DeviceId,
                ["x-agent-token"] = _config.DeviceToken,
            },
            Query = new Dictionary<string, string>
            {
                ["deviceId"] = _config.DeviceId,
                ["tenantId"] = _config.TenantId,
                ["EIO"] = "4",
            },
        });

        // ── Eventos de lifecycle ──
        _socket.OnConnected += async (s, e) =>
        {
            _conectado = true;
            _logger.LogInformation("RealtimeClient: conectado ao namespace /rmm");
            _supervisor.ReportHealthy("RealtimeClient");

            // Anunciar agente online
            await _socket!.EmitAsync("agent.online", new
            {
                deviceId = _config.DeviceId,
                tenantId = _config.TenantId,
                agentVersion = _config.AgentVersion,
                loggedUser = Environment.UserName,
                timestamp = DateTime.UtcNow.ToString("O"),
            });
        };

        _socket.OnDisconnected += (s, reason) =>
        {
            _conectado = false;
            _logger.LogWarning("RealtimeClient: desconectado — {Reason}", reason);
        };

        _socket.OnError += (s, err) =>
        {
            _logger.LogError("RealtimeClient: erro Socket.IO — {Err}", err);
        };

        // ── Handlers de eventos recebidos ──

        _socket.On("script.dispatch", async response =>
        {
            try
            {
                var data = response.GetValue<JsonElement>();
                var payload = new ScriptDispatchPayload
                {
                    ExecutionId = GetStr(data, "executionId"),
                    Conteudo = GetStr(data, "conteudo"),
                    Linguagem = GetStr(data, "linguagem", "powershell"),
                    TimeoutSegundos = GetInt(data, "timeoutSegundos", 60),
                };
                _logger.LogInformation("WebSocket: script.dispatch — execId={Id}", payload.ExecutionId);

                await _socket!.EmitAsync("script.started", new
                {
                    executionId = payload.ExecutionId,
                    deviceId = _config.DeviceId,
                    timestamp = DateTime.UtcNow.ToString("O"),
                });

                if (OnScriptDispatch is not null)
                    await OnScriptDispatch(payload);
            }
            catch (Exception ex) { _logger.LogError(ex, "Erro em script.dispatch"); }
        });

        _socket.On("chat.message", async response =>
        {
            try
            {
                var data = response.GetValue<JsonElement>();
                var payload = new ChatMessagePayload
                {
                    TicketId = GetStr(data, "ticketId"),
                    Conteudo = GetStr(data, "conteudo"),
                    Remetente = GetStr(data, "remetente"),
                };
                _logger.LogInformation("WebSocket: chat.message — ticket={Id}", payload.TicketId);

                if (OnChatMessage is not null)
                    await OnChatMessage(payload);
            }
            catch (Exception ex) { _logger.LogError(ex, "Erro em chat.message"); }
        });

        _socket.On("remote.request", async response =>
        {
            try
            {
                var data = response.GetValue<JsonElement>();
                var payload = new RemoteSessionPayload
                {
                    SessionId = GetStr(data, "sessionId"),
                    Tecnico = GetStr(data, "tecnico"),
                    Motivo = GetStr(data, "motivo"),
                };
                _logger.LogInformation("WebSocket: remote.request — sessão={Id}", payload.SessionId);

                if (OnRemoteSession is not null)
                    await OnRemoteSession(payload);
            }
            catch (Exception ex) { _logger.LogError(ex, "Erro em remote.request"); }
        });

        await _socket.ConnectAsync();

        // Aguardar conexão confirmar (timeout 15s)
        var timeout = DateTime.UtcNow.AddSeconds(15);
        while (!_conectado && DateTime.UtcNow < timeout && !ct.IsCancellationRequested)
            await Task.Delay(500, ct);

        if (!_conectado)
            throw new TimeoutException("Timeout ao conectar Socket.IO ao namespace /rmm");
    }

    // ─────────────────────────────────────────────────────
    // API pública — enviar eventos ao backend
    // ─────────────────────────────────────────────────────

    /// <summary>Notifica o backend que um script foi concluído.</summary>
    public async Task EnviarScriptResultado(string executionId, string saida, bool sucesso, int exitCode)
    {
        if (_socket?.Connected != true)
        {
            _store.EnqueueEvent("script.completed", $"scripts/agent/resultado/{executionId}",
                new { executionId, saida, sucesso, exitCode });
            return;
        }
        await _socket.EmitAsync("script.completed", new
        {
            executionId,
            deviceId = _config.DeviceId,
            saida,
            sucesso,
            exitCode,
            timestamp = DateTime.UtcNow.ToString("O"),
        });
    }

    /// <summary>Notifica o backend da resposta de consentimento de sessão remota.</summary>
    public async Task EnviarRespostaConsentimento(string sessionId, bool consentido)
    {
        if (_socket?.Connected != true)
        {
            _store.EnqueueEvent("remote.consent", $"remote-sessions/{sessionId}/consent",
                new { sessionId, consentido });
            return;
        }
        await _socket.EmitAsync("remote.consent", new
        {
            sessionId,
            deviceId = _config.DeviceId,
            consentido,
            timestamp = DateTime.UtcNow.ToString("O"),
        });
    }

    /// <summary>Envia métricas em tempo real ao backend via WebSocket.</summary>
    public async Task EnviarMetricasRealtime(Dictionary<string, object> metricas)
    {
        if (_socket?.Connected != true) return;
        try
        {
            metricas["deviceId"] = _config.DeviceId;
            await _socket.EmitAsync("agent.metrics", metricas);
        }
        catch (Exception ex) { _logger.LogWarning(ex, "Erro ao enviar métricas via WebSocket"); }
    }

    private async Task DesconectarAsync()
    {
        if (_socket is not null)
        {
            try { await _socket.DisconnectAsync(); _socket.Dispose(); }
            catch { /* silencioso */ }
        }
        _conectado = false;
    }

    // ── Helpers ──
    private static string GetStr(JsonElement e, string key, string def = "") =>
        e.TryGetProperty(key, out var v) ? v.GetString() ?? def : def;

    private static int GetInt(JsonElement e, string key, int def = 0) =>
        e.TryGetProperty(key, out var v) && v.TryGetInt32(out var r) ? r : def;
}

// ─────────────────────────────────────────────────────
// DTOs de payload
// ─────────────────────────────────────────────────────

public class ScriptDispatchPayload
{
    public string ExecutionId { get; set; } = "";
    public string Conteudo { get; set; } = "";
    public string Linguagem { get; set; } = "powershell";
    public int TimeoutSegundos { get; set; } = 60;
}

public class ChatMessagePayload
{
    public string TicketId { get; set; } = "";
    public string Conteudo { get; set; } = "";
    public string Remetente { get; set; } = "";
}

public class RemoteSessionPayload
{
    public string SessionId { get; set; } = "";
    public string Tecnico { get; set; } = "";
    public string Motivo { get; set; } = "";
}
