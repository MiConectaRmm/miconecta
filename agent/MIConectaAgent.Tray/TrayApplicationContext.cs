using System.Diagnostics;
using System.Drawing;
using System.ServiceProcess;

namespace MIConectaAgent.Tray;

/// <summary>
/// Tray icon application que roda na sessão do usuário logado.
/// Exibe ícone na bandeja do sistema com menu de contexto:
/// - Status do agente (Online/Offline)
/// - Abrir portal web
/// - Suporte (chat)
/// - Logs
/// - Sobre
/// - Sair
/// </summary>
public class TrayApplicationContext : ApplicationContext
{
    private readonly NotifyIcon _trayIcon;
    private readonly System.Windows.Forms.Timer _statusTimer;
    private bool _serviceRunning = false;

    private const string SERVICE_NAME = "MIConectaRMMAgent";
    private const string PORTAL_URL = "https://app.maginf.com.br";
    private const string LOG_DIR = @"C:\Program Files\MIConectaRMM\logs";
    private const string CONFIG_PATH = @"C:\Program Files\MIConectaRMM\agent.config";
    private static readonly string ICON_PATH = Path.Combine(AppContext.BaseDirectory, "icon.ico");

    public TrayApplicationContext()
    {
        _trayIcon = new NotifyIcon
        {
            Icon = File.Exists(ICON_PATH) ? new Icon(ICON_PATH) : SystemIcons.Application,
            Text = "MIConectaRMM - Verificando...",
            Visible = true,
            ContextMenuStrip = CriarMenu(),
        };

        _trayIcon.DoubleClick += (s, e) => AbrirPortal();

        // Timer para verificar status do serviço
        _statusTimer = new System.Windows.Forms.Timer { Interval = 5000 };
        _statusTimer.Tick += (s, e) => AtualizarStatus();
        _statusTimer.Start();

        AtualizarStatus();
        MostrarNotificacao("MIConectaRMM", "Agente ativo na bandeja do sistema.");
    }

    private ContextMenuStrip CriarMenu()
    {
        var menu = new ContextMenuStrip();

        var statusItem = new ToolStripMenuItem("Status: Verificando...")
        {
            Name = "status",
            Enabled = false,
        };
        menu.Items.Add(statusItem);
        menu.Items.Add(new ToolStripSeparator());

        var portalItem = new ToolStripMenuItem("Abrir Portal Web", null, (s, e) => AbrirPortal());
        menu.Items.Add(portalItem);

        var suporteItem = new ToolStripMenuItem("Solicitar Suporte", null, (s, e) => SolicitarSuporte());
        menu.Items.Add(suporteItem);

        menu.Items.Add(new ToolStripSeparator());

        var logsItem = new ToolStripMenuItem("Ver Logs", null, (s, e) => AbrirLogs());
        menu.Items.Add(logsItem);

        var configItem = new ToolStripMenuItem("Informações do Agente", null, (s, e) => MostrarInfo());
        menu.Items.Add(configItem);

        menu.Items.Add(new ToolStripSeparator());

        var sobreItem = new ToolStripMenuItem("Sobre", null, (s, e) => MostrarSobre());
        menu.Items.Add(sobreItem);

        var sairItem = new ToolStripMenuItem("Fechar Tray", null, (s, e) => Sair());
        menu.Items.Add(sairItem);

        return menu;
    }

    private void AtualizarStatus()
    {
        try
        {
            using var sc = new ServiceController(SERVICE_NAME);
            _serviceRunning = sc.Status == ServiceControllerStatus.Running;

            var statusText = _serviceRunning ? "Online" : "Offline";
            _trayIcon.Text = $"MIConectaRMM - {statusText}";

            var statusItem = _trayIcon.ContextMenuStrip?.Items["status"] as ToolStripMenuItem;
            if (statusItem != null)
            {
                statusItem.Text = $"Status: {statusText}";
                statusItem.ForeColor = _serviceRunning ? Color.Green : Color.Red;
            }
        }
        catch
        {
            _trayIcon.Text = "MIConectaRMM - Serviço não encontrado";
        }
    }

    private void AbrirPortal()
    {
        try
        {
            Process.Start(new ProcessStartInfo(PORTAL_URL) { UseShellExecute = true });
        }
        catch { }
    }

    private void SolicitarSuporte()
    {
        try
        {
            Process.Start(new ProcessStartInfo($"{PORTAL_URL}/portal/tickets") { UseShellExecute = true });
        }
        catch { }
    }

    private void AbrirLogs()
    {
        try
        {
            if (Directory.Exists(LOG_DIR))
                Process.Start(new ProcessStartInfo("explorer.exe", LOG_DIR));
            else
                MessageBox.Show("Pasta de logs não encontrada.", "MIConectaRMM",
                    MessageBoxButtons.OK, MessageBoxIcon.Warning);
        }
        catch { }
    }

    private void MostrarInfo()
    {
        var info = "MIConectaRMM Agent v2.0.0\n\n";

        try
        {
            if (File.Exists(CONFIG_PATH))
            {
                foreach (var line in File.ReadAllLines(CONFIG_PATH))
                {
                    var parts = line.Split('=', 2);
                    if (parts.Length == 2 && !parts[0].Contains("Token", StringComparison.OrdinalIgnoreCase))
                        info += $"{parts[0]}: {parts[1]}\n";
                }
            }
            else
            {
                info += "Arquivo de configuração não encontrado.";
            }
        }
        catch
        {
            info += "Erro ao ler configuração.";
        }

        info += $"\nHostname: {Environment.MachineName}";
        info += $"\nUsuário: {Environment.UserName}";
        info += $"\nServiço: {(_serviceRunning ? "Rodando" : "Parado")}";

        MessageBox.Show(info, "Informações do Agente",
            MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void MostrarSobre()
    {
        MessageBox.Show(
            "MIConectaRMM Enterprise v2.0.0\n\n" +
            "Agente de monitoramento e gerenciamento remoto.\n\n" +
            "© 2026 Maginf Tecnologia\n" +
            "www.maginf.com.br",
            "Sobre MIConectaRMM",
            MessageBoxButtons.OK, MessageBoxIcon.Information);
    }

    private void MostrarNotificacao(string titulo, string mensagem)
    {
        _trayIcon.BalloonTipTitle = titulo;
        _trayIcon.BalloonTipText = mensagem;
        _trayIcon.BalloonTipIcon = ToolTipIcon.Info;
        _trayIcon.ShowBalloonTip(3000);
    }

    private void Sair()
    {
        _statusTimer.Stop();
        _trayIcon.Visible = false;
        _trayIcon.Dispose();
        Application.Exit();
    }
}
