using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using System.Diagnostics;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;

namespace MIConectaAgent.Services;

/// <summary>
/// Coleta telemetria avançada do dispositivo:
/// — Serviços Windows em execução
/// — Reinicialização pendente (WSUS, CBS, PendingFileRename)
/// — Adaptadores de rede (IP, MAC, velocidade)
/// — Drivers instalados (via SC query type= kernel)
/// — Processos críticos
/// </summary>
public class TelemetryService
{
    private readonly ILogger<TelemetryService> _logger;

    public TelemetryService(ILogger<TelemetryService> logger)
    {
        _logger = logger;
    }

    /// <summary>Coleta snapshot completo de telemetria.</summary>
    public TelemetrySnapshot Coletar()
    {
        var snap = new TelemetrySnapshot
        {
            Timestamp = DateTime.UtcNow,
            ReinicializacaoPendente = VerificarReinicializacaoPendente(),
        };

        try { snap.Servicos = ColetarServicos(); }
        catch (Exception ex) { _logger.LogWarning(ex, "Erro ao coletar serviços"); snap.Servicos = []; }

        try { snap.InterfacesRede = ColetarInterfacesRede(); }
        catch (Exception ex) { _logger.LogWarning(ex, "Erro ao coletar interfaces de rede"); snap.InterfacesRede = []; }

        try { snap.ProcessosCriticos = ColetarProcessosCriticos(); }
        catch (Exception ex) { _logger.LogWarning(ex, "Erro ao coletar processos"); snap.ProcessosCriticos = []; }

        return snap;
    }

    // ─────────────────────────────────────────────────────
    // Serviços Windows
    // ─────────────────────────────────────────────────────

    private List<ServicoInfo> ColetarServicos()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows))
            return [];

        var lista = new List<ServicoInfo>();

        using var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = "query type= all state= all",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true,
            }
        };

        process.Start();
        var output = process.StandardOutput.ReadToEnd();
        process.WaitForExit();

        // Parsear output do sc query
        var linhas = output.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        ServicoInfo? atual = null;

        foreach (var linha in linhas)
        {
            var l = linha.Trim();
            if (l.StartsWith("SERVICE_NAME:"))
            {
                if (atual is not null) lista.Add(atual);
                atual = new ServicoInfo { Nome = l["SERVICE_NAME:".Length..].Trim() };
            }
            else if (atual is not null)
            {
                if (l.StartsWith("DISPLAY_NAME:"))
                    atual.NomeExibicao = l["DISPLAY_NAME:".Length..].Trim();
                else if (l.StartsWith("STATE"))
                {
                    atual.Estado = l.Contains("RUNNING") ? "running" :
                                   l.Contains("STOPPED") ? "stopped" :
                                   l.Contains("PAUSED") ? "paused" : "unknown";
                }
            }
        }
        if (atual is not null) lista.Add(atual);

        // Filtrar para apenas serviços relevantes (reduzir payload)
        return lista
            .Where(s => s.Estado == "running" || IsServicoRelevante(s.Nome))
            .Take(100)
            .ToList();
    }

    private static bool IsServicoRelevante(string nome) =>
        nome is "wuauserv" or "WinDefend" or "RemoteRegistry" or "RpcSs" or "Spooler" or "BITS";

    // ─────────────────────────────────────────────────────
    // Reinicialização pendente
    // ─────────────────────────────────────────────────────

    private bool VerificarReinicializacaoPendente()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return false;

        try
        {
            // 1. CBS (Component-Based Servicing)
            using var cbs = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\Component Based Servicing\RebootPending");
            if (cbs is not null) return true;

            // 2. Windows Update
            using var wu = Registry.LocalMachine.OpenSubKey(
                @"SOFTWARE\Microsoft\Windows\CurrentVersion\WindowsUpdate\Auto Update\RebootRequired");
            if (wu is not null) return true;

            // 3. PendingFileRenameOperations
            using var pfro = Registry.LocalMachine.OpenSubKey(
                @"SYSTEM\CurrentControlSet\Control\Session Manager");
            var pfroVal = pfro?.GetValue("PendingFileRenameOperations");
            if (pfroVal is string[] arr && arr.Length > 0) return true;

            // 4. SessionManager\PendingFileRenameOperations2
            var pfro2 = pfro?.GetValue("PendingFileRenameOperations2");
            if (pfro2 is string[] arr2 && arr2.Length > 0) return true;
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Erro ao verificar reboot pendente via registro");
        }

        return false;
    }

    // ─────────────────────────────────────────────────────
    // Interfaces de rede
    // ─────────────────────────────────────────────────────

    private List<InterfaceRedeInfo> ColetarInterfacesRede()
    {
        var lista = new List<InterfaceRedeInfo>();

        foreach (var ni in NetworkInterface.GetAllNetworkInterfaces())
        {
            if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback) continue;
            if (ni.OperationalStatus != OperationalStatus.Up) continue;

            var props = ni.GetIPProperties();
            var ips = props.UnicastAddresses
                .Select(a => a.Address.ToString())
                .Where(a => !a.StartsWith("169.254")) // excluir APIPA
                .ToList();

            lista.Add(new InterfaceRedeInfo
            {
                Nome = ni.Name,
                Descricao = ni.Description,
                MacAddress = string.Join(":", ni.GetPhysicalAddress().GetAddressBytes()
                    .Select(b => b.ToString("X2"))),
                Status = ni.OperationalStatus.ToString(),
                VelocidadeMbps = (int)(ni.Speed / 1_000_000),
                EnderecoIp = ips,
                Tipo = ni.NetworkInterfaceType.ToString(),
            });
        }

        return lista;
    }

    // ─────────────────────────────────────────────────────
    // Processos críticos
    // ─────────────────────────────────────────────────────

    private static readonly string[] ProcessosCriticosMonitorados =
    [
        "winlogon", "csrss", "lsass", "services", "svchost",
        "rustdesk", "MIConectaAgent", "MIConectaAgent.Tray"
    ];

    private List<ProcessoInfo> ColetarProcessosCriticos()
    {
        var lista = new List<ProcessoInfo>();

        foreach (var nome in ProcessosCriticosMonitorados)
        {
            try
            {
                var processos = Process.GetProcessesByName(nome);
                if (processos.Length == 0) continue;

                foreach (var p in processos)
                {
                    try
                    {
                        lista.Add(new ProcessoInfo
                        {
                            Nome = p.ProcessName,
                            Pid = p.Id,
                            MemoriaMb = (int)(p.WorkingSet64 / 1_048_576),
                            CpuTempo = p.TotalProcessorTime.TotalSeconds,
                        });
                    }
                    finally { p.Dispose(); }
                }
            }
            catch { /* processo pode ter terminado */ }
        }

        return lista;
    }
}

// ─────────────────────────────────────────────────────
// DTOs de telemetria
// ─────────────────────────────────────────────────────

public class TelemetrySnapshot
{
    public DateTime Timestamp { get; set; }
    public bool ReinicializacaoPendente { get; set; }
    public List<ServicoInfo> Servicos { get; set; } = [];
    public List<InterfaceRedeInfo> InterfacesRede { get; set; } = [];
    public List<ProcessoInfo> ProcessosCriticos { get; set; } = [];
}

public class ServicoInfo
{
    public string Nome { get; set; } = "";
    public string NomeExibicao { get; set; } = "";
    public string Estado { get; set; } = "";
}

public class InterfaceRedeInfo
{
    public string Nome { get; set; } = "";
    public string Descricao { get; set; } = "";
    public string MacAddress { get; set; } = "";
    public string Status { get; set; } = "";
    public int VelocidadeMbps { get; set; }
    public List<string> EnderecoIp { get; set; } = [];
    public string Tipo { get; set; } = "";
}

public class ProcessoInfo
{
    public string Nome { get; set; } = "";
    public int Pid { get; set; }
    public int MemoriaMb { get; set; }
    public double CpuTempo { get; set; }
}
