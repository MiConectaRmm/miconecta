namespace MIConectaAgent;

public class AgentConfig
{
    public string ServerUrl { get; set; } = "http://localhost:3000/api/v1";
    public string TenantId { get; set; } = "";
    public string OrganizationId { get; set; } = "";
    public string DeviceId { get; set; } = "";
    public string DeviceToken { get; set; } = "";
    public string RustDeskServer { get; set; } = "136.248.114.218";
    public string RustDeskKey { get; set; } = "ev3ic04E+VsgunfupaellTSWgSzmHiQL2H5ywzBE+yI=";
    public int HeartbeatIntervalSeconds { get; set; } = 60;
    public int CommandPollIntervalSeconds { get; set; } = 30;

    private readonly string _configPath;

    public AgentConfig()
    {
        var appData = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
            "MIConectaRMM"
        );
        Directory.CreateDirectory(appData);
        _configPath = Path.Combine(appData, "agent.config");
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
                    if (int.TryParse(valor, out var hb)) HeartbeatIntervalSeconds = hb;
                    break;
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
            $"HeartbeatIntervalSeconds={HeartbeatIntervalSeconds}"
        };
        File.WriteAllLines(_configPath, linhas);
    }
}
