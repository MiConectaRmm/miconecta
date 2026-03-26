using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Serviço de chat local do agente.
/// Faz polling de mensagens do servidor e permite que o usuário
/// local responda via tray icon popup ou toast notification.
/// </summary>
public class ChatService
{
    private readonly ILogger<ChatService> _logger;
    private readonly ApiClient _apiClient;
    private readonly AgentConfig _config;

    public event Action<ChatNotification>? OnNovaMensagem;

    public ChatService(ILogger<ChatService> logger, ApiClient apiClient, AgentConfig config)
    {
        _logger = logger;
        _apiClient = apiClient;
        _config = config;
    }

    /// <summary>
    /// Verifica mensagens não lidas em tickets e em conversations (GET agents/me/chat/unread).
    /// </summary>
    public async Task<List<ChatNotification>> VerificarMensagens()
    {
        var notificacoes = new List<ChatNotification>();

        try
        {
            var mensagens = await _apiClient.ObterMensagensNaoLidas();
            foreach (var msg in mensagens)
            {
                var ticketId = msg.TryGetProperty("ticketId", out var tid) && tid.ValueKind != JsonValueKind.Null
                    ? tid.GetString() ?? ""
                    : "";
                var conversationId = msg.TryGetProperty("conversationId", out var cid) && cid.ValueKind != JsonValueKind.Null
                    ? cid.GetString() ?? ""
                    : "";

                var notif = new ChatNotification
                {
                    TicketId = ticketId,
                    ConversationId = conversationId,
                    MensagemId = msg.TryGetProperty("id", out var mid) ? mid.GetString() ?? "" : "",
                    RemetenteNome = msg.TryGetProperty("remetenteNome", out var rn) ? rn.GetString() ?? "" : "Suporte",
                    Conteudo = msg.TryGetProperty("conteudo", out var c) ? c.GetString() ?? "" : "",
                    Timestamp = msg.TryGetProperty("criadoEm", out var ts) ? ts.GetString() ?? "" : "",
                };

                notificacoes.Add(notif);
                OnNovaMensagem?.Invoke(notif);

                _logger.LogDebug("Nova mensagem de {Remetente} (ticket={TicketId}, conv={ConversationId})",
                    notif.RemetenteNome, notif.TicketId, notif.ConversationId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar mensagens de chat");
        }

        return notificacoes;
    }

    /// <summary>
    /// Envia mensagem em um ticket (chat legado).
    /// </summary>
    public async Task<bool> EnviarMensagem(string ticketId, string conteudo)
    {
        try
        {
            var sucesso = await _apiClient.EnviarMensagemChat(ticketId, conteudo);
            if (sucesso)
                _logger.LogInformation("Mensagem enviada no ticket {TicketId}", ticketId);
            return sucesso;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar mensagem no ticket {TicketId}", ticketId);
            return false;
        }
    }

    /// <summary>
    /// Envia mensagem em uma conversation (sem ticket obrigatório).
    /// </summary>
    public async Task<bool> EnviarMensagemConversa(string conversationId, string conteudo)
    {
        try
        {
            var sucesso = await _apiClient.EnviarMensagemConversa(conversationId, conteudo);
            if (sucesso)
                _logger.LogInformation("Mensagem enviada na conversa {ConversationId}", conversationId);
            return sucesso;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao enviar mensagem na conversa {ConversationId}", conversationId);
            return false;
        }
    }
}

public class ChatNotification
{
    public string TicketId { get; set; } = "";
    /// <summary>Guid da conversation quando a notificação não é de ticket.</summary>
    public string ConversationId { get; set; } = "";
    public string MensagemId { get; set; } = "";
    public string RemetenteNome { get; set; } = "";
    public string Conteudo { get; set; } = "";
    public string Timestamp { get; set; } = "";
}
