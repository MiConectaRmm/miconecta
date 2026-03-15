using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using Microsoft.Win32;

namespace MIConectaAgent.Services;

public class SystemInfoCollector
{
    public Dictionary<string, object?> ColetarInformacoes()
    {
        var info = new Dictionary<string, object?>
        {
            ["hostname"] = Environment.MachineName,
            ["dominio"] = Environment.UserDomainName,
            ["sistemaOperacional"] = Environment.OSVersion.ToString(),
            ["versaoWindows"] = ObterVersaoWindows(),
            ["cpu"] = ObterNomeCPU(),
            ["ramTotalMb"] = ObterRamTotalMb(),
            ["discoTotalMb"] = ObterDiscoTotalMb(),
            ["discoDisponivelMb"] = ObterDiscoDisponivelMb(),
            ["ipLocal"] = ObterIpLocal(),
            ["ipExterno"] = ObterIpExterno(),
            ["rustdeskId"] = ObterRustDeskId(),
            ["modeloMaquina"] = ObterModeloMaquina(),
            ["numeroSerie"] = ObterNumeroSerie(),
            ["antivirusNome"] = ObterAntivirus(),
            ["antivirusStatus"] = ObterStatusAntivirus(),
            ["agentVersion"] = "1.0.0",
            ["uptime_segundos"] = (int)(Environment.TickCount64 / 1000),
        };

        return info;
    }

    private string ObterVersaoWindows()
    {
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Windows NT\CurrentVersion");
            var productName = key?.GetValue("ProductName")?.ToString() ?? "";
            var buildNumber = key?.GetValue("CurrentBuildNumber")?.ToString() ?? "";
            return $"{productName} (Build {buildNumber})";
        }
        catch { return Environment.OSVersion.VersionString; }
    }

    private string ObterNomeCPU()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Name FROM Win32_Processor");
            foreach (var obj in searcher.Get())
                return obj["Name"]?.ToString() ?? "Desconhecido";
        }
        catch { }
        return "Desconhecido";
    }

    private long ObterRamTotalMb()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT TotalPhysicalMemory FROM Win32_ComputerSystem");
            foreach (var obj in searcher.Get())
            {
                if (long.TryParse(obj["TotalPhysicalMemory"]?.ToString(), out var bytes))
                    return bytes / (1024 * 1024);
            }
        }
        catch { }
        return 0;
    }

    private long ObterDiscoTotalMb()
    {
        try
        {
            var drive = new DriveInfo("C");
            return drive.TotalSize / (1024 * 1024);
        }
        catch { return 0; }
    }

    private long ObterDiscoDisponivelMb()
    {
        try
        {
            var drive = new DriveInfo("C");
            return drive.AvailableFreeSpace / (1024 * 1024);
        }
        catch { return 0; }
    }

    private string ObterIpLocal()
    {
        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork)
                    return ip.ToString();
            }
        }
        catch { }
        return "0.0.0.0";
    }

    private string? ObterIpExterno()
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
            return client.GetStringAsync("https://api.ipify.org").Result.Trim();
        }
        catch { return null; }
    }

    private string? ObterRustDeskId()
    {
        try
        {
            var configPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                "RustDesk", "config", "RustDesk.toml"
            );
            if (File.Exists(configPath))
            {
                foreach (var linha in File.ReadAllLines(configPath))
                {
                    if (linha.TrimStart().StartsWith("id"))
                    {
                        var partes = linha.Split('=', 2);
                        if (partes.Length == 2)
                            return partes[1].Trim().Trim('\'', '"');
                    }
                }
            }

            // Tentar caminho alternativo
            var altPath = Path.Combine("C:\\Program Files\\RustDesk", "RustDesk.toml");
            if (File.Exists(altPath))
            {
                foreach (var linha in File.ReadAllLines(altPath))
                {
                    if (linha.TrimStart().StartsWith("id"))
                    {
                        var partes = linha.Split('=', 2);
                        if (partes.Length == 2)
                            return partes[1].Trim().Trim('\'', '"');
                    }
                }
            }
        }
        catch { }
        return null;
    }

    private string ObterModeloMaquina()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT Model FROM Win32_ComputerSystem");
            foreach (var obj in searcher.Get())
                return obj["Model"]?.ToString() ?? "Desconhecido";
        }
        catch { }
        return "Desconhecido";
    }

    private string ObterNumeroSerie()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher("SELECT SerialNumber FROM Win32_BIOS");
            foreach (var obj in searcher.Get())
                return obj["SerialNumber"]?.ToString() ?? "";
        }
        catch { }
        return "";
    }

    private string ObterAntivirus()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                @"root\SecurityCenter2",
                "SELECT displayName FROM AntiVirusProduct"
            );
            foreach (var obj in searcher.Get())
                return obj["displayName"]?.ToString() ?? "Desconhecido";
        }
        catch { }
        return "Não detectado";
    }

    private string ObterStatusAntivirus()
    {
        try
        {
            using var searcher = new ManagementObjectSearcher(
                @"root\SecurityCenter2",
                "SELECT productState FROM AntiVirusProduct"
            );
            foreach (var obj in searcher.Get())
            {
                if (int.TryParse(obj["productState"]?.ToString(), out var state))
                {
                    var hex = state.ToString("X6");
                    var rtProtection = hex.Substring(2, 2);
                    return rtProtection == "10" ? "Ativo" : "Inativo";
                }
            }
        }
        catch { }
        return "Desconhecido";
    }
}
