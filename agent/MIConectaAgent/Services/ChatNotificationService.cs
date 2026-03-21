using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Runtime.InteropServices;

namespace MIConectaAgent.Services;

/// <summary>
/// Fase 5 — Chat Desktop:
/// Recebe mensagens via WebSocket (RealtimeClient.OnChatMessage) e exibe
/// notificações desktop ao usuário logado via MessageBox não-bloqueante.
/// Quando WS offline, o HeartbeatService chama ChatService.VerificarMensagens().
/// </summary>
public class ChatNotificationService : BackgroundService
{
    private readonly ILogger<ChatNotificationService> _logger;
    private readonly ChatService _chatService;
    private readonly RealtimeClient _realtimeClient;
    private readonly AgentConfig _config;

    // Controle de mensagens já exibidas (evita duplicatas)
    private readonly HashSet<string> _mensagensExibidas = [];
    private readonly SemaphoreSlim _sem = new(1, 1);

    public ChatNotificationService(
        ILogger<ChatNotificationService> logger,
        ChatService chatService,
        RealtimeClient realtimeClient,
        AgentConfig config)
    {
        _logger = logger;
        _chatService = chatService;
        _realtimeClient = realtimeClient;
        _config = config;

        // Wire: WebSocket → notificação desktop
        _realtimeClient.OnChatMessage += HandleChatMessageWs;

        // Wire: polling HTTP → notificação desktop
        _chatService.OnNovaMensagem += HandleChatMessageHttp;
    }

    protected override Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Serviço apenas reage a eventos — sem loop próprio
        return Task.Delay(Timeout.Infinite, stoppingToken);
    }

    // ── Handler WS ──
    private async Task HandleChatMessageWs(ChatMessagePayload payload)
    {
        var id = $"{payload.TicketId}:{payload.Conteudo.GetHashCode()}";
        if (!MarcarExibido(id)) return;

        _logger.LogInformation("Chat (WS): ticket={TicketId} de={Remetente}", payload.TicketId, payload.Remetente);

        await Task.Run(() => ExibirNotificacao(
            remetente: payload.Remetente,
            conteudo: payload.Conteudo,
            ticketId: payload.TicketId));
    }

    // ── Handler HTTP polling ──
    private void HandleChatMessageHttp(ChatNotification notif)
    {
        var id = notif.MensagemId;
        if (!MarcarExibido(id)) return;

        _logger.LogInformation("Chat (HTTP): ticket={TicketId} de={Remetente}", notif.TicketId, notif.RemetenteNome);

        Task.Run(() => ExibirNotificacao(
            remetente: notif.RemetenteNome,
            conteudo: notif.Conteudo,
            ticketId: notif.TicketId));
    }

    // ─────────────────────────────────────────────────────
    // Notificação desktop
    // ─────────────────────────────────────────────────────

    private static void ExibirNotificacao(string remetente, string conteudo, string ticketId)
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;

        var titulo = $"💬 MIConectaRMM — {remetente}";
        var mensagem = $"Ticket #{ticketId}\n\n{conteudo}\n\n[Esta é uma notificação do suporte técnico]";

        // MessageBox em thread separada — não bloqueia o serviço
        // Usa MB_TOPMOST | MB_SYSTEMMODAL para aparecer sobre outras janelas
        _ = MessageBoxNative.Show(mensagem, titulo, MessageBoxNative.MB_OK | MessageBoxNative.MB_TOPMOST | MessageBoxNative.MB_ICONINFORMATION);
    }

    private bool MarcarExibido(string id)
    {
        _sem.Wait();
        try
        {
            if (_mensagensExibidas.Contains(id)) return false;
            _mensagensExibidas.Add(id);
            // Limpar cache se muito grande
            if (_mensagensExibidas.Count > 500)
                _mensagensExibidas.Clear();
            return true;
        }
        finally { _sem.Release(); }
    }
}

/// <summary>P/Invoke para MessageBox nativo do Windows.</summary>
internal static class MessageBoxNative
{
    public const uint MB_OK = 0x00000000;
    public const uint MB_TOPMOST = 0x00040000;
    public const uint MB_SYSTEMMODAL = 0x00001000;
    public const uint MB_ICONINFORMATION = 0x00000040;
    public const uint MB_ICONQUESTION = 0x00000020;
    public const uint MB_YESNO = 0x00000004;
    public const uint IDYES = 6;

    [DllImport("user32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    public static extern int MessageBox(IntPtr hWnd, string lpText, string lpCaption, uint uType);

    public static int Show(string texto, string titulo, uint tipo = MB_OK) =>
        MessageBox(IntPtr.Zero, texto, titulo, tipo);
}
