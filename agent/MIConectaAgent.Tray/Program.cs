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

        // --chat: abre direto a janela de chat nativa
        if (args.Length > 0 && args[0] == "--chat")
        {
            var config = LerConfig();
            var serverUrl = config.GetValueOrDefault("ServerUrl", "");
            var deviceId = config.GetValueOrDefault("DeviceId", "");
            var deviceToken = config.GetValueOrDefault("DeviceToken", "");

            if (string.IsNullOrEmpty(serverUrl) || string.IsNullOrEmpty(deviceToken))
            {
                MessageBox.Show(
                    "O agente ainda não está registrado.\nAguarde alguns minutos e tente novamente.",
                    "MIConecta Chat", MessageBoxButtons.OK, MessageBoxIcon.Information);
                return;
            }

            using var api = new ChatApiClient(serverUrl, deviceId, deviceToken);
            var chatForm = new ChatForm(api, Environment.MachineName);
            chatForm.ShowChat();
            Application.Run(chatForm);
            return;
        }

        // Garantir instância única
        using var mutex = new Mutex(true, "MIConectaRMM_Tray", out bool isNew);
        if (!isNew)
        {
            MessageBox.Show("MIConecta Tray já está em execução.", "MIConecta",
                MessageBoxButtons.OK, MessageBoxIcon.Information);
            return;
        }

        Application.Run(new TrayApplicationContext());
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
