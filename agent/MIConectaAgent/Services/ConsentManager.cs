using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Gerencia consentimento do usuário para sessões remotas (LGPD).
/// Exibe popup nativo do Windows solicitando autorização antes
/// de iniciar qualquer acesso remoto ao dispositivo.
/// </summary>
public class ConsentManager
{
    private readonly ILogger<ConsentManager> _logger;
    private readonly ApiClient _apiClient;
    private readonly AgentConfig _config;

    public ConsentManager(ILogger<ConsentManager> logger, ApiClient apiClient, AgentConfig config)
    {
        _logger = logger;
        _apiClient = apiClient;
        _config = config;
    }

    /// <summary>
    /// Verifica se há solicitações de sessão remota pendentes e solicita consentimento.
    /// </summary>
    public async Task<bool> VerificarSolicitacoesPendentes()
    {
        try
        {
            var solicitacoes = await _apiClient.ObterSolicitacoesSessao();
            foreach (var solicitacao in solicitacoes)
            {
                var sessionId = solicitacao.GetProperty("id").GetString() ?? "";
                var tecnicoNome = solicitacao.TryGetProperty("tecnicoNome", out var tn) ? tn.GetString() : "Técnico";
                var motivo = solicitacao.TryGetProperty("motivo", out var m) ? m.GetString() : "Suporte remoto";

                _logger.LogInformation("Solicitação de sessão remota: {SessionId} de {Tecnico}", sessionId, tecnicoNome);

                var consentido = SolicitarConsentimento(tecnicoNome!, motivo!);
                await _apiClient.ResponderConsentimento(sessionId, consentido, ObterInfoConsentimento());

                _logger.LogInformation("Consentimento {Status} para sessão {SessionId}",
                    consentido ? "CONCEDIDO" : "NEGADO", sessionId);
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar solicitações de sessão remota");
            return false;
        }
    }

    /// <summary>
    /// Exibe MessageBox nativo do Windows solicitando consentimento.
    /// Roda na sessão do usuário logado.
    /// </summary>
    private bool SolicitarConsentimento(string tecnicoNome, string motivo)
    {
        try
        {
            var titulo = "MIConectaRMM - Acesso Remoto";
            var mensagem = $"O técnico {tecnicoNome} solicita acesso remoto ao seu computador.\n\n" +
                           $"Motivo: {motivo}\n\n" +
                           "Deseja autorizar o acesso?\n\n" +
                           "• Clique SIM para permitir\n" +
                           "• Clique NÃO para recusar\n\n" +
                           "Seus dados são protegidos conforme a LGPD.";

            // MessageBox nativo - funciona mesmo em sessão de serviço com interação
            var result = NativeMessageBox.Show(mensagem, titulo);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao exibir popup de consentimento");
            return false; // Na dúvida, nega
        }
    }

    private Dictionary<string, object> ObterInfoConsentimento()
    {
        return new Dictionary<string, object>
        {
            ["deviceId"] = _config.DeviceId,
            ["hostname"] = Environment.MachineName,
            ["usuarioLogado"] = Environment.UserName,
            ["timestamp"] = DateTime.UtcNow.ToString("o"),
            ["ip"] = _config.DeviceId,
        };
    }
}

/// <summary>
/// Wrapper para MessageBox nativo via P/Invoke.
/// Permite exibir na sessão do usuário ativo.
/// </summary>
public static class NativeMessageBox
{
    [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
    private static extern int MessageBoxW(IntPtr hWnd, string text, string caption, uint type);

    private const uint MB_YESNO = 0x00000004;
    private const uint MB_ICONQUESTION = 0x00000020;
    private const uint MB_TOPMOST = 0x00040000;
    private const uint MB_SETFOREGROUND = 0x00010000;
    private const int IDYES = 6;

    public static bool Show(string message, string title)
    {
        var result = MessageBoxW(IntPtr.Zero, message, title,
            MB_YESNO | MB_ICONQUESTION | MB_TOPMOST | MB_SETFOREGROUND);
        return result == IDYES;
    }
}
