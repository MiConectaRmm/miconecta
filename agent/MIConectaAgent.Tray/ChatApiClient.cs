using System.Net.Http.Json;
using System.Text;
using System.Text.Json;

namespace MIConectaAgent.Tray;

/// <summary>
/// Cliente REST leve para o chat. Usa o device-token do agente para
/// autenticação (header x-agent-token) e consulta tickets + mensagens.
/// </summary>
public sealed class SupportPanelContext
{
    public string CompanyName { get; set; } = "";
    public string? LogoUrl { get; set; }
    public string TechnicianName { get; set; } = "";
    public string? TechnicianAvatarUrl { get; set; }
}

public class ChatApiClient : IDisposable
{
    private readonly HttpClient _http;

    /// <summary>Último erro ocorrido (para diagnóstico no UI).</summary>
    public string? LastError { get; private set; }

    /// <summary>True se o último TestarConexao foi bem-sucedido.</summary>
    public bool Connected { get; private set; }

    public ChatApiClient(string serverUrl, string deviceId, string deviceToken)
    {
        _http = new HttpClient
        {
            BaseAddress = new Uri(serverUrl.TrimEnd('/') + "/"),
            Timeout = TimeSpan.FromSeconds(45),
        };
        _http.DefaultRequestHeaders.Add("x-device-id", deviceId);
        _http.DefaultRequestHeaders.Add("x-agent-token", deviceToken);
    }

    /// <summary>
    /// Testa conexão com o servidor (GET /health fora do prefix, ou agents/me/tickets como fallback).
    /// </summary>
    public async Task<bool> TestarConexaoAsync()
    {
        try
        {
            // health fica fora do /api/v1, então montar URL absoluta
            var baseUri = _http.BaseAddress!;
            var healthUri = new Uri(baseUri.GetLeftPart(UriPartial.Authority) + "/health");
            using var req = new HttpRequestMessage(HttpMethod.Get, healthUri);
            var resp = await _http.SendAsync(req);
            Connected = resp.IsSuccessStatusCode;
            if (!Connected)
                LastError = $"Servidor respondeu {(int)resp.StatusCode} ({resp.StatusCode})";
            return Connected;
        }
        catch (Exception ex)
        {
            Connected = false;
            LastError = $"Sem conexão: {ex.Message}";
            return false;
        }
    }

    /// <summary>GET agents/me/support-context — logo, técnico.</summary>
    public async Task<SupportPanelContext?> ObterContextoSuporteAsync()
    {
        try
        {
            var resp = await _http.GetAsync("agents/me/support-context");
            if (!resp.IsSuccessStatusCode) return null;
            var j = await resp.Content.ReadFromJsonAsync<JsonElement>();
            if (j.ValueKind != JsonValueKind.Object) return null;
            return new SupportPanelContext
            {
                CompanyName = j.TryGetProperty("companyName", out var cn) ? cn.GetString() ?? "" : "",
                LogoUrl = j.TryGetProperty("logoUrl", out var lu) && lu.ValueKind == JsonValueKind.String ? lu.GetString() : null,
                TechnicianName = j.TryGetProperty("technicianName", out var tn) ? tn.GetString() ?? "" : "",
                TechnicianAvatarUrl = j.TryGetProperty("technicianAvatarUrl", out var au) && au.ValueKind == JsonValueKind.String ? au.GetString() : null,
            };
        }
        catch
        {
            return null;
        }
    }

    /// <summary>GET agents/me/tickets/history</summary>
    public async Task<List<ChatTicket>> ListarTicketsHistoricoAsync()
    {
        try
        {
            var resp = await _http.GetAsync("agents/me/tickets/history");
            if (!resp.IsSuccessStatusCode) return [];
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var list = new List<ChatTicket>();
            if (json.ValueKind != JsonValueKind.Array) return list;
            foreach (var t in json.EnumerateArray())
            {
                list.Add(new ChatTicket
                {
                    Id = t.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                    Numero = t.TryGetProperty("numero", out var num) && num.TryGetInt32(out var n) ? n : 0,
                    Titulo = t.TryGetProperty("titulo", out var tit) ? tit.GetString() ?? "" : "",
                    Status = t.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "",
                });
            }
            return list;
        }
        catch
        {
            return [];
        }
    }

    /// <summary>
    /// Lista tickets abertos associados ao dispositivo.
    /// GET /agents/me/tickets
    /// </summary>
    public async Task<List<ChatTicket>> ListarTicketsAsync()
    {
        try
        {
            var resp = await _http.GetAsync("agents/me/tickets");
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao listar tickets: {(int)resp.StatusCode} {resp.StatusCode}";
                return [];
            }

            LastError = null;
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var tickets = new List<ChatTicket>();

            JsonElement items = json.ValueKind == JsonValueKind.Array ? json : default;
            if (json.ValueKind == JsonValueKind.Object && json.TryGetProperty("data", out var data))
                items = data;
            else if (json.ValueKind == JsonValueKind.Array)
                items = json;

            if (items.ValueKind == JsonValueKind.Array)
            {
                foreach (var t in items.EnumerateArray())
                {
                    tickets.Add(new ChatTicket
                    {
                        Id = t.GetProperty("id").GetString() ?? "",
                        Numero = t.TryGetProperty("numero", out var num) && num.TryGetInt32(out var n) ? n : 0,
                        Titulo = t.TryGetProperty("titulo", out var tit) ? tit.GetString() ?? "" : "",
                        Status = t.TryGetProperty("status", out var st) ? st.GetString() ?? "" : "",
                    });
                }
            }

            return tickets;
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return [];
        }
    }

    /// <summary>
    /// Lista mensagens de um ticket.
    /// GET /agents/me/tickets/{ticketId}/messages?limit=50
    /// </summary>
    public async Task<List<ChatMessage>> ListarMensagensAsync(string ticketId)
    {
        try
        {
            var resp = await _http.GetAsync($"agents/me/tickets/{ticketId}/messages?limit=50");
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao listar mensagens: {(int)resp.StatusCode}";
                return [];
            }

            var arr = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var msgs = new List<ChatMessage>();

            if (arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var m in arr.EnumerateArray())
                {
                    msgs.Add(ParseMessage(m));
                }
            }

            return msgs;
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return [];
        }
    }

    /// <summary>
    /// Envia mensagem no ticket.
    /// POST /agents/me/tickets/{ticketId}/messages
    /// </summary>
    public async Task<ChatMessage?> EnviarMensagemAsync(string ticketId, string conteudo)
    {
        try
        {
            var body = new { conteudo, tipo = "texto" };
            var resp = await _http.PostAsJsonAsync($"agents/me/tickets/{ticketId}/messages", body);
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao enviar: {(int)resp.StatusCode}";
                return null;
            }

            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            return ParseMessage(json);
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return null;
        }
    }

    /// <summary>GET agents/me/conversations</summary>
    public async Task<List<ChatTicket>> ListarConversacoesAsync()
    {
        try
        {
            var resp = await _http.GetAsync("agents/me/conversations");
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao listar conversas: {(int)resp.StatusCode}";
                return [];
            }

            LastError = null;
            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var list = new List<ChatTicket>();
            if (json.ValueKind != JsonValueKind.Array) return list;

            foreach (var c in json.EnumerateArray())
            {
                list.Add(new ChatTicket
                {
                    Id = c.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                    Titulo = c.TryGetProperty("titulo", out var tit) ? tit.GetString() ?? "Conversa" : "Conversa",
                    Status = c.TryGetProperty("status", out var st) ? st.GetString() ?? "open" : "open",
                    IsConversation = true,
                });
            }

            return list;
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return [];
        }
    }

    public async Task<ChatTicket?> CriarConversaAsync(string? titulo = null, string? mensagemInicial = null)
    {
        try
        {
            var body = new { titulo, mensagemInicial };
            var resp = await _http.PostAsJsonAsync("agents/me/conversations", body);
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao criar conversa: {(int)resp.StatusCode}";
                return null;
            }

            var c = await resp.Content.ReadFromJsonAsync<JsonElement>();
            LastError = null;
            return new ChatTicket
            {
                Id = c.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
                Titulo = c.TryGetProperty("titulo", out var tit) ? tit.GetString() ?? "Conversa" : "Conversa",
                Status = "open",
                IsConversation = true,
            };
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return null;
        }
    }

    public async Task<List<ChatMessage>> ListarMensagensConversaAsync(string conversationId)
    {
        try
        {
            var resp = await _http.GetAsync($"agents/me/conversations/{Uri.EscapeDataString(conversationId)}/messages?limit=80");
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao listar mensagens: {(int)resp.StatusCode}";
                return [];
            }

            var arr = await resp.Content.ReadFromJsonAsync<JsonElement>();
            var msgs = new List<ChatMessage>();
            if (arr.ValueKind == JsonValueKind.Array)
            {
                foreach (var m in arr.EnumerateArray())
                    msgs.Add(ParseMessage(m));
            }

            return msgs;
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return [];
        }
    }

    public async Task<ChatMessage?> EnviarMensagemConversaAsync(string conversationId, string conteudo)
    {
        try
        {
            var body = new { content = conteudo };
            var resp = await _http.PostAsJsonAsync($"agents/me/conversations/{Uri.EscapeDataString(conversationId)}/messages", body);
            if (!resp.IsSuccessStatusCode)
            {
                LastError = $"Erro ao enviar: {(int)resp.StatusCode}";
                return null;
            }

            var json = await resp.Content.ReadFromJsonAsync<JsonElement>();
            return ParseMessage(json);
        }
        catch (Exception ex)
        {
            LastError = $"Erro de conexão: {ex.Message}";
            return null;
        }
    }

    /// <summary>
    /// Cria um ticket rápido de suporte para este dispositivo.
    /// POST /agents/me/tickets
    /// </summary>
    public async Task<ChatTicket?> CriarTicketAsync(string titulo, string descricao)
    {
        try
        {
            var body = new { titulo, descricao, prioridade = "media" };
            var resp = await _http.PostAsJsonAsync("agents/me/tickets", body);
            var raw = await resp.Content.ReadAsStringAsync();
            if (!resp.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"CriarTicket ERRO {resp.StatusCode}: {raw}");
                return null;
            }

            var json = JsonSerializer.Deserialize<JsonElement>(raw);
            return new ChatTicket
            {
                Id = json.GetProperty("id").GetString() ?? "",
                Numero = json.TryGetProperty("numero", out var num) && num.TryGetInt32(out var n) ? n : 0,
                Titulo = json.TryGetProperty("titulo", out var t) ? t.GetString() ?? "" : titulo,
                Status = "aberto",
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"CriarTicket exception: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Concluir/resolver um ticket pelo cliente.
    /// PUT /agents/me/tickets/{ticketId}/concluir
    /// </summary>
    public async Task<bool> ConcluirTicketAsync(string ticketId)
    {
        try
        {
            var resp = await _http.PutAsync($"agents/me/tickets/{ticketId}/concluir", null);
            return resp.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    /// <summary>
    /// Avaliar satisfação de um ticket.
    /// POST /agents/me/tickets/{ticketId}/avaliar
    /// </summary>
    public async Task<bool> AvaliarTicketAsync(string ticketId, int nota, string? comentario = null)
    {
        try
        {
            var body = new { nota, comentario = comentario ?? "" };
            var resp = await _http.PostAsJsonAsync($"agents/me/tickets/{ticketId}/avaliar", body);
            return resp.IsSuccessStatusCode;
        }
        catch { return false; }
    }

    private static ChatMessage ParseMessage(JsonElement m)
    {
        return new ChatMessage
        {
            Id = m.TryGetProperty("id", out var id) ? id.GetString() ?? "" : "",
            Conteudo = m.TryGetProperty("content", out var c) ? c.GetString() ?? ""
                     : m.TryGetProperty("conteudo", out var c2) ? c2.GetString() ?? "" : "",
            RemetenteNome = m.TryGetProperty("senderName", out var sn) ? sn.GetString() ?? ""
                          : m.TryGetProperty("remetenteNome", out var rn) ? rn.GetString() ?? "" : "",
            RemetenteTipo = m.TryGetProperty("senderType", out var st) ? st.GetString() ?? ""
                          : m.TryGetProperty("remetenteTipo", out var rt) ? rt.GetString() ?? "" : "",
            CriadoEm = m.TryGetProperty("createdAt", out var ca) ? ca.GetString() ?? ""
                      : m.TryGetProperty("criadoEm", out var ce) ? ce.GetString() ?? "" : "",
        };
    }

    public override string ToString() => _http.BaseAddress?.ToString() ?? "(desconhecido)";

    public void Dispose() => _http.Dispose();
}

public class ChatMessage
{
    public string Id { get; set; } = "";
    public string Conteudo { get; set; } = "";
    public string RemetenteNome { get; set; } = "";
    public string RemetenteTipo { get; set; } = "";
    public string CriadoEm { get; set; } = "";

    public bool IsTechnician =>
        RemetenteTipo.Contains("technician", StringComparison.OrdinalIgnoreCase)
        || RemetenteTipo.Contains("tecnico", StringComparison.OrdinalIgnoreCase);

    /// <summary>Mensagens do dispositivo / portal cliente (bolha do usuário).</summary>
    public bool IsClientSide =>
        RemetenteTipo.Equals("client_user", StringComparison.OrdinalIgnoreCase)
        || RemetenteTipo.Equals("device", StringComparison.OrdinalIgnoreCase)
        || RemetenteTipo.Equals("agent", StringComparison.OrdinalIgnoreCase);

    public bool IsSystem =>
        RemetenteTipo.Equals("system", StringComparison.OrdinalIgnoreCase)
        || RemetenteTipo.Equals("SYSTEM", StringComparison.OrdinalIgnoreCase);
}

public class ChatTicket
{
    public string Id { get; set; } = "";
    public int Numero { get; set; }
    public string Titulo { get; set; } = "";
    public string Status { get; set; } = "";
    /// <summary>True quando o item é uma conversation (não ticket).</summary>
    public bool IsConversation { get; set; }
}
