using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MIConectaAgent.Services;

/// <summary>
/// Handler de sessão remota via WebSocket:
/// — Recebe remote.request via WS
/// — Exibe popup de consentimento (NativeMessageBox)
/// — Envia resposta via WS (remote.consent)
/// — Se aceito, garante RustDesk em execução
/// </summary>
public class RemoteSessionHandler : BackgroundService
{
    private readonly ILogger<RemoteSessionHandler> _logger;
    private readonly RealtimeClient _realtimeClient;
    private readonly RustDeskIntegrationService _rustDesk;
    private readonly AgentConfig _config;

    public RemoteSessionHandler(
        ILogger<RemoteSessionHandler> logger,
        RealtimeClient realtimeClient,
        RustDeskIntegrationService rustDesk,
        AgentConfig config)
    {
        _logger = logger;
        _realtimeClient = realtimeClient;
        _rustDesk = rustDesk;
        _config = config;

        _realtimeClient.OnRemoteSession += HandleRemoteRequest;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken) =>
        Task.Delay(Timeout.Infinite, stoppingToken);

    private async Task HandleRemoteRequest(RemoteSessionPayload payload)
    {
        _logger.LogInformation("Solicitação remota: sessão={Id} técnico={Tecnico}", payload.SessionId, payload.Tecnico);

        bool consentido;
        try
        {
            var titulo = "MIConectaRMM — Acesso Remoto";
            var mensagem = $"O técnico {payload.Tecnico} solicita acesso remoto.\n\n" +
                           $"Motivo: {(string.IsNullOrEmpty(payload.Motivo) ? "Suporte técnico" : payload.Motivo)}\n\n" +
                           "Deseja autorizar o acesso?\n\n" +
                           "• SIM para permitir\n• NÃO para recusar\n\n" +
                           "Seus dados são protegidos conforme a LGPD.";

            var result = await Task.Run(() =>
                MessageBoxNative.Show(mensagem, titulo,
                    MessageBoxNative.MB_YESNO | MessageBoxNative.MB_TOPMOST | MessageBoxNative.MB_ICONQUESTION));

            consentido = result == MessageBoxNative.IDYES;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao exibir popup de consentimento");
            consentido = false;
        }

        // Enviar resposta ao backend via WS
        await _realtimeClient.EnviarRespostaConsentimento(payload.SessionId, consentido);

        _logger.LogInformation("Consentimento {Status} para sessão {Id}",
            consentido ? "CONCEDIDO" : "NEGADO", payload.SessionId);

        // Se consentido, garantir RustDesk em execução
        if (consentido)
        {
            _rustDesk.GarantirEmExecucao();
            _logger.LogInformation("RustDesk iniciado para sessão {Id} (ID={RdId})",
                payload.SessionId, _rustDesk.RustDeskId ?? "?");
        }
    }
}
