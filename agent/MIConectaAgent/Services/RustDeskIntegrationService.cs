using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace MIConectaAgent.Services;

/// <summary>
/// Gerencia a integração com RustDesk:
/// — Verifica se está instalado
/// — Lê o ID do dispositivo RustDesk (do registro ou CLI)
/// — Configura servidor e chave se necessário
/// — Expõe o ID para o heartbeat enviar ao backend
/// </summary>
public class RustDeskIntegrationService
{
    private readonly ILogger<RustDeskIntegrationService> _logger;
    private readonly AgentConfig _config;

    private const string RustDeskExeName = "rustdesk.exe";
    private static readonly string[] RustDeskPaths =
    [
        @"C:\Program Files\RustDesk\rustdesk.exe",
        @"C:\Program Files (x86)\RustDesk\rustdesk.exe",
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Programs\RustDesk\rustdesk.exe"),
    ];

    private string? _rustdeskId;
    private bool _inicializado = false;

    public string? RustDeskId => _rustdeskId;
    public bool Instalado => EncontrarExecutavel() is not null;

    public RustDeskIntegrationService(ILogger<RustDeskIntegrationService> logger, AgentConfig config)
    {
        _logger = logger;
        _config = config;
    }

    /// <summary>
    /// Inicializa: lê ID, configura servidor/chave se necessário.
    /// Idempotente — pode ser chamado várias vezes.
    /// </summary>
    public async Task InicializarAsync()
    {
        if (_inicializado) return;
        _inicializado = true;

        var exePath = EncontrarExecutavel();
        if (exePath is null)
        {
            _logger.LogWarning("RustDesk não encontrado. Sessão remota via RustDesk indisponível.");
            return;
        }

        _logger.LogInformation("RustDesk encontrado: {Path}", exePath);

        // Configurar servidor e chave se definidos no config
        if (!string.IsNullOrWhiteSpace(_config.RustDeskServer))
            await ConfigurarAsync(exePath);

        // Ler ID do dispositivo
        _rustdeskId = await LerIdAsync(exePath);

        if (!string.IsNullOrEmpty(_rustdeskId))
            _logger.LogInformation("RustDesk ID: {Id}", _rustdeskId);
        else
            _logger.LogWarning("Não foi possível obter o ID RustDesk do dispositivo");
    }

    /// <summary>Garante que RustDesk está em execução (inicia se necessário).</summary>
    public void GarantirEmExecucao()
    {
        if (!RuntimeInformation.IsOSPlatform(OSPlatform.Windows)) return;

        var processos = Process.GetProcessesByName("rustdesk");
        if (processos.Length > 0) return;

        var exePath = EncontrarExecutavel();
        if (exePath is null) return;

        try
        {
            Process.Start(new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = "--service",
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            _logger.LogInformation("RustDesk iniciado como serviço");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Não foi possível iniciar o RustDesk");
        }
    }

    // ─────────────────────────────────────────────────────
    // Internals
    // ─────────────────────────────────────────────────────

    private string? EncontrarExecutavel()
    {
        foreach (var path in RustDeskPaths)
            if (File.Exists(path)) return path;

        // Tentar via registro
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\RustDesk") ??
                            Registry.LocalMachine.OpenSubKey(@"SOFTWARE\WOW6432Node\RustDesk");
            if (key is not null)
            {
                var installDir = key.GetValue("InstallDir")?.ToString() ??
                                 key.GetValue("Install_Dir")?.ToString();
                if (installDir is not null)
                {
                    var path = Path.Combine(installDir, RustDeskExeName);
                    if (File.Exists(path)) return path;
                }
            }
        }
        catch { /* registro não disponível */ }

        return null;
    }

    private async Task ConfigurarAsync(string exePath)
    {
        try
        {
            // rustdesk.exe --option rendezvous-server <host>
            await ExecutarComandoAsync(exePath, $"--option rendezvous-server {_config.RustDeskServer}");

            if (!string.IsNullOrWhiteSpace(_config.RustDeskKey))
                await ExecutarComandoAsync(exePath, $"--option key {_config.RustDeskKey}");

            _logger.LogInformation("RustDesk configurado com servidor={Srv}", _config.RustDeskServer);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Erro ao configurar RustDesk");
        }
    }

    private async Task<string?> LerIdAsync(string exePath)
    {
        // 1. Tentar via CLI: rustdesk.exe --get-id
        try
        {
            var resultado = await ExecutarComandoAsync(exePath, "--get-id");
            var id = resultado?.Trim();
            if (!string.IsNullOrWhiteSpace(id) && id.All(c => char.IsDigit(c) || c == '-'))
                return id;
        }
        catch { /* CLI pode não suportar este argumento */ }

        // 2. Tentar via arquivo de config do RustDesk
        var configPaths = new[]
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), @"RustDesk\config\RustDesk.toml"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"RustDesk\config\RustDesk.toml"),
        };

        foreach (var configPath in configPaths)
        {
            try
            {
                if (!File.Exists(configPath)) continue;
                var conteudo = await File.ReadAllTextAsync(configPath);
                foreach (var linha in conteudo.Split('\n'))
                {
                    if (linha.StartsWith("id =") || linha.StartsWith("id="))
                    {
                        var parts = linha.Split('=', 2);
                        if (parts.Length == 2)
                        {
                            var id = parts[1].Trim().Trim('"').Trim('\'');
                            if (!string.IsNullOrWhiteSpace(id)) return id;
                        }
                    }
                }
            }
            catch { /* arquivo pode estar em uso */ }
        }

        // 3. Tentar via registro
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"SOFTWARE\RustDesk");
            var id = key?.GetValue("id")?.ToString();
            if (!string.IsNullOrWhiteSpace(id)) return id;
        }
        catch { /* registro não disponível */ }

        return null;
    }

    private async Task<string?> ExecutarComandoAsync(string exePath, string argumentos)
    {
        using var processo = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = argumentos,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            }
        };

        processo.Start();
        var output = await processo.StandardOutput.ReadToEndAsync();
        await processo.WaitForExitAsync();
        return output;
    }
}
