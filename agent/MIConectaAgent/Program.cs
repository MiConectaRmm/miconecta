using MIConectaAgent;
using MIConectaAgent.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

// ── Serilog ──
var logPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
    "MIConectaRMM", "logs", "agent-.log"
);

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .WriteTo.File(logPath,
        rollingInterval: RollingInterval.Day,
        retainedFileCountLimit: 30,
        fileSizeLimitBytes: 10 * 1024 * 1024,
        outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff} [{Level:u3}] {Message:lj}{NewLine}{Exception}")
    .WriteTo.EventLog("MIConectaRMM Agent", manageEventSource: false)
    .Enrich.WithProperty("Agent", "MIConectaRMM")
    .CreateLogger();

try
{
    Log.Information("MIConectaRMM Agent v2.0.0 iniciando...");

    var builder = Host.CreateApplicationBuilder(args);
    builder.Services.AddSerilog();

    // Windows Service
    builder.Services.AddWindowsService(options =>
    {
        options.ServiceName = "MIConectaRMM Agent";
    });

    // ── Core Services ──
    builder.Services.AddSingleton<AgentConfig>();
    builder.Services.AddSingleton<ApiClient>();
    builder.Services.AddSingleton<LocalQueue>();

    // ── Collectors ──
    builder.Services.AddSingleton<SystemInfoCollector>();
    builder.Services.AddSingleton<MetricsCollector>();
    builder.Services.AddSingleton<SoftwareInventoryCollector>();
    builder.Services.AddSingleton<WindowsUpdateChecker>();

    // ── Executors ──
    builder.Services.AddSingleton<ScriptExecutor>();

    // ── v2 Services ──
    builder.Services.AddSingleton<ConsentManager>();
    builder.Services.AddSingleton<ChatService>();
    builder.Services.AddSingleton<AutoUpdater>();

    // ── Background Services ──
    builder.Services.AddHostedService<HeartbeatService>();
    builder.Services.AddHostedService<CommandPollingService>();
    builder.Services.AddHostedService<QueueProcessor>();

    var host = builder.Build();
    host.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "MIConectaRMM Agent falhou ao iniciar");
}
finally
{
    Log.CloseAndFlush();
}
