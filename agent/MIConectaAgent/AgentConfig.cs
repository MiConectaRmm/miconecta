namespace MIConectaAgent;

public class AgentConfig
{
    // ── Conexão ──
    public string ServerUrl { get; set; } = "http://localhost:3000/api/v1";
    public string TenantId { get; set; } = "";
    public string OrganizationId { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string DeviceToken { get; set; } = "";

    // ── RustDesk ──
    public string RustDeskServer { get; set; } = "136.248.114.218";
    public string RustDeskKey { get; set; } = "ev3ic04E+VsgunfupaellTSWgSzmHiQL2H5ywzBE+yI=";

    // ── Intervalos (segundos) ──
    public int HeartbeatIntervalSeconds { get; set; } = 60;
    public int CommandPollIntervalSeconds { get; set; } = 30;
    public int ChatPollIntervalSeconds { get; set; } = 15;
    public int UpdateCheckIntervalHours { get; set; } = 6;
    public int ConsentPollIntervalSeconds { get; set; } = 10;

    // ── Funcionalidades ──
    public bool QueueEnabled { get; set; } = true;
    public bool AutoUpdateEnabled { get; set; } = true;
    public bool ChatEnabled { get; set; } = true;
    public bool ConsentEnabled { get; set; } = true;

    // ── Metadata ──
    public string AgentVersion { get; set; } = "2.0.0";

    // ── Paths ──
    public string AppDir { get; private set; }
    public string LogDir { get; private set; }

    private readonly string _configPath;

    public AgentConfig()
    {
        AppDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "MIConectaRMM"
        );
        LogDir = Path.Combine(AppDir, "logs");
        Directory.CreateDirectory(AppDir);
        Directory.CreateDirectory(LogDir);
        _configPath = Path.Combine(AppDir, "agent.config");
        Carregar();
    }

    public void Carregar()
    {
        if (!File.Exists(_configPath)) return;

        foreach (var linha in File.ReadAllLines(_configPath))
        {
            var partes = linha.Split('=', 2);
            if (partes.Length != 2) continue;

            var chave = partes[0].Trim();
            var valor = partes[1].Trim();

            switch (chave)
            {
                case "ServerUrl": ServerUrl = valor; break;
                case "TenantId": TenantId = valor; break;
                case "OrganizationId": OrganizationId = valor; break;
                case "DeviceId": DeviceId = valor; break;
                case "DeviceToken": DeviceToken = valor; break;
                case "RustDeskServer": RustDeskServer = valor; break;
                case "RustDeskKey": RustDeskKey = valor; break;
                case "HeartbeatIntervalSeconds":
                    if (int.TryParse(valor, out var hb)) HeartbeatIntervalSeconds = hb; break;
                case "CommandPollIntervalSeconds":
                    if (int.TryParse(valor, out var cp)) CommandPollIntervalSeconds = cp; break;
                case "ChatPollIntervalSeconds":
                    if (int.TryParse(valor, out var ch)) ChatPollIntervalSeconds = ch; break;
                case "UpdateCheckIntervalHours":
                    if (int.TryParse(valor, out var uc)) UpdateCheckIntervalHours = uc; break;
                case "QueueEnabled":
                    if (bool.TryParse(valor, out var qe)) QueueEnabled = qe; break;
                case "AutoUpdateEnabled":
                    if (bool.TryParse(valor, out var au)) AutoUpdateEnabled = au; break;
                case "ChatEnabled":
                    if (bool.TryParse(valor, out var ce)) ChatEnabled = ce; break;
                case "ConsentEnabled":
                    if (bool.TryParse(valor, out var co)) ConsentEnabled = co; break;
            }
        }
    }

    public void Salvar()
    {
        var linhas = new[]
        {
            $"ServerUrl={ServerUrl}",
            $"TenantId={TenantId}",
            $"OrganizationId={OrganizationId}",
            $"DeviceId={DeviceId}",
            $"DeviceToken={DeviceToken}",
            $"RustDeskServer={RustDeskServer}",
            $"RustDeskKey={RustDeskKey}",
            $"HeartbeatIntervalSeconds={HeartbeatIntervalSeconds}",
            $"CommandPollIntervalSeconds={CommandPollIntervalSeconds}",
            $"ChatPollIntervalSeconds={ChatPollIntervalSeconds}",
            $"UpdateCheckIntervalHours={UpdateCheckIntervalHours}",
            $"QueueEnabled={QueueEnabled}",
            $"AutoUpdateEnabled={AutoUpdateEnabled}",
            $"ChatEnabled={ChatEnabled}",
            $"ConsentEnabled={ConsentEnabled}",
        };
        File.WriteAllLines(_configPath, linhas);
    }

    public bool IsRegistered => !string.IsNullOrEmpty(DeviceId) && !string.IsNullOrEmpty(DeviceToken);
}
