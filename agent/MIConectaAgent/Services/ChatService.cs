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
    /// Verifica se há mensagens de chat não lidas para tickets associados ao dispositivo.
    /// </summary>
    public async Task<List<ChatNotification>> VerificarMensagens()
    {
        var notificacoes = new List<ChatNotification>();

        try
        {
            var mensagens = await _apiClient.ObterMensagensNaoLidas();
            foreach (var msg in mensagens)
            {
                var notif = new ChatNotification
                {
                    TicketId = msg.TryGetProperty("ticketId", out var tid) ? tid.GetString() ?? "" : "",
                    MensagemId = msg.TryGetProperty("id", out var mid) ? mid.GetString() ?? "" : "",
                    RemetenteNome = msg.TryGetProperty("remetenteNome", out var rn) ? rn.GetString() ?? "" : "Suporte",
                    Conteudo = msg.TryGetProperty("conteudo", out var c) ? c.GetString() ?? "" : "",
                    Timestamp = msg.TryGetProperty("criadoEm", out var ts) ? ts.GetString() ?? "" : "",
                };

                notificacoes.Add(notif);
                OnNovaMensagem?.Invoke(notif);

                _logger.LogDebug("Nova mensagem de {Remetente} no ticket {TicketId}",
                    notif.RemetenteNome, notif.TicketId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar mensagens de chat");
        }

        return notificacoes;
    }

    /// <summary>
    /// Envia uma mensagem de resposta do usuário local.
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
}

public class ChatNotification
{
    public string TicketId { get; set; } = "";
    public string MensagemId { get; set; } = "";
    public string RemetenteNome { get; set; } = "";
    public string Conteudo { get; set; } = "";
    public string Timestamp { get; set; } = "";
}
