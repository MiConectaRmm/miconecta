namespace MIConectaAgent.Tray;

/// <summary>
/// Migra URLs antigas do backend Fly.io para o domínio de produção.
/// </summary>
public static class ServerUrlNormalizer
{
    public const string ProductionApiBase = "https://api.maginf.com.br/api/v1";

    public static string Normalize(string? serverUrl)
    {
        if (string.IsNullOrWhiteSpace(serverUrl))
            return serverUrl ?? "";

        var u = serverUrl.Trim();
        if (u.Contains("miconecta-backend.fly.dev", StringComparison.OrdinalIgnoreCase))
        {
            u = u.Replace("https://miconecta-backend.fly.dev", "https://api.maginf.com.br", StringComparison.OrdinalIgnoreCase)
                 .Replace("http://miconecta-backend.fly.dev", "https://api.maginf.com.br", StringComparison.OrdinalIgnoreCase);
        }

        return u.TrimEnd('/');
    }
}
