using System.Diagnostics;
using System.Management;

namespace MIConectaAgent.Services;

public class MetricsCollector
{
    private PerformanceCounter? _cpuCounter;
    private PerformanceCounter? _ramCounter;

    public MetricsCollector()
    {
        try
        {
            _cpuCounter = new PerformanceCounter("Processor", "% Processor Time", "_Total");
            _ramCounter = new PerformanceCounter("Memory", "Available MBytes");
            // Primeira leitura é sempre 0, descartar
            _cpuCounter.NextValue();
        }
        catch { }
    }

    public Dictionary<string, object> Coletar()
    {
        var metricas = new Dictionary<string, object>();

        // CPU
        try
        {
            var cpu = _cpuCounter?.NextValue() ?? 0;
            metricas["cpuPercent"] = Math.Round(cpu, 2);
        }
        catch { metricas["cpuPercent"] = 0; }

        // RAM
        try
        {
            var ramDisponivel = _ramCounter?.NextValue() ?? 0;
            var ramTotal = ObterRamTotalMb();
            var ramUsada = ramTotal - (long)ramDisponivel;
            var ramPercent = ramTotal > 0 ? (double)ramUsada / ramTotal * 100 : 0;

            metricas["ramPercent"] = Math.Round(ramPercent, 2);
            metricas["ramUsadaMb"] = ramUsada;
        }
        catch
        {
            metricas["ramPercent"] = 0;
            metricas["ramUsadaMb"] = 0;
        }

        // Disco
        try
        {
            var drive = new DriveInfo("C");
            var total = drive.TotalSize;
            var usado = total - drive.AvailableFreeSpace;
            var percent = (double)usado / total * 100;

            metricas["discoPercent"] = Math.Round(percent, 2);
            metricas["discoUsadoMb"] = usado / (1024 * 1024);
        }
        catch
        {
            metricas["discoPercent"] = 0;
            metricas["discoUsadoMb"] = 0;
        }

        // Rede
        try
        {
            var interfaces = NetworkInterface.GetAllNetworkInterfaces()
                .Where(n => n.OperationalStatus == OperationalStatus.Up
                    && n.NetworkInterfaceType != NetworkInterfaceType.Loopback)
                .ToList();

            long bytesRecebidos = 0, bytesEnviados = 0;
            foreach (var ni in interfaces)
            {
                var stats = ni.GetIPStatistics();
                bytesRecebidos += stats.BytesReceived;
                bytesEnviados += stats.BytesSent;
            }

            metricas["redeEntradaBytes"] = bytesRecebidos;
            metricas["redeSaidaBytes"] = bytesEnviados;
        }
        catch
        {
            metricas["redeEntradaBytes"] = 0;
            metricas["redeSaidaBytes"] = 0;
        }

        // Uptime
        metricas["uptimeSegundos"] = (int)(Environment.TickCount64 / 1000);

        return metricas;
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
}
