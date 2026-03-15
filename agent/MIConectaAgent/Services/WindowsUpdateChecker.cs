using System.Management;

namespace MIConectaAgent.Services;

public class WindowsUpdateChecker
{
    public List<Dictionary<string, object?>> VerificarAtualizacoesPendentes()
    {
        var updates = new List<Dictionary<string, object?>>();

        try
        {
            // Usar COM para acessar Windows Update
            dynamic updateSession = Activator.CreateInstance(
                Type.GetTypeFromProgID("Microsoft.Update.Session")!
            )!;

            dynamic updateSearcher = updateSession.CreateUpdateSearcher();
            dynamic searchResult = updateSearcher.Search("IsInstalled=0");

            foreach (dynamic update in searchResult.Updates)
            {
                var severity = "moderado";
                try
                {
                    var msrcSeverity = update.MsrcSeverity?.ToString()?.ToLower() ?? "";
                    severity = msrcSeverity switch
                    {
                        "critical" => "critico",
                        "important" => "importante",
                        "moderate" => "moderado",
                        "low" => "baixo",
                        _ => "moderado"
                    };
                }
                catch { }

                updates.Add(new Dictionary<string, object?>
                {
                    ["titulo"] = update.Title?.ToString(),
                    ["descricao"] = update.Description?.ToString(),
                    ["kbId"] = ExtrairKB(update.Title?.ToString() ?? ""),
                    ["severidade"] = severity,
                    ["tamanhoBytes"] = update.MaxDownloadSize,
                    ["requerReinicio"] = update.RebootRequired,
                    ["status"] = "pendente",
                });
            }
        }
        catch { }

        return updates;
    }

    public List<Dictionary<string, object?>> ObterHistoricoInstalacao()
    {
        var historico = new List<Dictionary<string, object?>>();

        try
        {
            dynamic updateSession = Activator.CreateInstance(
                Type.GetTypeFromProgID("Microsoft.Update.Session")!
            )!;

            dynamic updateSearcher = updateSession.CreateUpdateSearcher();
            int count = updateSearcher.GetTotalHistoryCount();
            if (count <= 0) return historico;

            dynamic history = updateSearcher.QueryHistory(0, Math.Min(count, 50));

            foreach (dynamic entry in history)
            {
                historico.Add(new Dictionary<string, object?>
                {
                    ["titulo"] = entry.Title?.ToString(),
                    ["kbId"] = ExtrairKB(entry.Title?.ToString() ?? ""),
                    ["instaladoEm"] = entry.Date,
                    ["status"] = entry.ResultCode == 2 ? "instalado" : "falha",
                });
            }
        }
        catch { }

        return historico;
    }

    private static string ExtrairKB(string titulo)
    {
        var match = System.Text.RegularExpressions.Regex.Match(titulo, @"KB(\d+)");
        return match.Success ? $"KB{match.Groups[1].Value}" : "";
    }
}
