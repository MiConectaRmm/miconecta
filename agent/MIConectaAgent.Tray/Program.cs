using System.Diagnostics;

namespace MIConectaAgent.Tray;

static class Program
{
    private const string PORTAL_URL = "https://app.maginf.com.br";
    private const string CONFIG_PATH = @"C:\Program Files\MIConecta\agent.config";

    [STAThread]
    static void Main(string[] args)
    {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);

        var openChatOnStart = args.Length > 0 && args[0] == "--chat";

        // Uma instância: sempre com ícone na bandeja; --chat só abre a janela ao iniciar
        using var mutex = new Mutex(true, "MIConectaRMM_Tray", out bool isNew);
        if (!isNew)
        {
            MessageBox.Show(
                openChatOnStart
                    ? "O MIConecta já está em execução.\n\nProcure o ícone na bandeja do sistema (seta ^ ao lado do relógio no Windows 11).\nDuplo clique no ícone para abrir o chat."
                    : "MIConecta Tray já está em execução.",
                "MIConecta",
                MessageBoxButtons.OK,
                MessageBoxIcon.Information);
            return;
        }

        Application.Run(new TrayApplicationContext(openChatOnStart));
    }

    private static Dictionary<string, string> LerConfig()
    {
        var config = new Dictionary<string, string>();
        try
        {
            if (!File.Exists(CONFIG_PATH)) return config;
            foreach (var line in File.ReadAllLines(CONFIG_PATH))
            {
                var parts = line.Split('=', 2);
                if (parts.Length == 2)
                    config[parts[0].Trim()] = parts[1].Trim();
            }
        }
        catch { }
        return config;
    }
}
