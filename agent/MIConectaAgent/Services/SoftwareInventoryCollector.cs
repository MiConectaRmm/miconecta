using Microsoft.Win32;

namespace MIConectaAgent.Services;

public class SoftwareInventoryCollector
{
    public List<Dictionary<string, string?>> Coletar()
    {
        var softwares = new List<Dictionary<string, string?>>();
        var chaves = new[]
        {
            @"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall",
            @"SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall"
        };

        foreach (var chaveBase in chaves)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(chaveBase);
                if (key == null) continue;

                foreach (var subKeyName in key.GetSubKeyNames())
                {
                    try
                    {
                        using var subKey = key.OpenSubKey(subKeyName);
                        var nome = subKey?.GetValue("DisplayName")?.ToString();
                        if (string.IsNullOrWhiteSpace(nome)) continue;

                        softwares.Add(new Dictionary<string, string?>
                        {
                            ["nome"] = nome,
                            ["versao"] = subKey?.GetValue("DisplayVersion")?.ToString(),
                            ["fabricante"] = subKey?.GetValue("Publisher")?.ToString(),
                            ["tamanho"] = subKey?.GetValue("EstimatedSize")?.ToString(),
                            ["tipo"] = "software"
                        });
                    }
                    catch { continue; }
                }
            }
            catch { continue; }
        }

        return softwares.DistinctBy(s => s["nome"]).OrderBy(s => s["nome"]).ToList();
    }
}
