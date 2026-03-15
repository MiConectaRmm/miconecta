using MIConectaAgent;
using MIConectaAgent.Services;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

var builder = Host.CreateApplicationBuilder(args);

// Configurar como Windows Service
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "MIConectaRMM Agent";
});

// Registrar serviços
builder.Services.AddSingleton<AgentConfig>();
builder.Services.AddSingleton<SystemInfoCollector>();
builder.Services.AddSingleton<MetricsCollector>();
builder.Services.AddSingleton<SoftwareInventoryCollector>();
builder.Services.AddSingleton<WindowsUpdateChecker>();
builder.Services.AddSingleton<ScriptExecutor>();
builder.Services.AddSingleton<ApiClient>();
builder.Services.AddHostedService<HeartbeatService>();
builder.Services.AddHostedService<CommandPollingService>();

builder.Logging.AddConsole();
builder.Logging.AddEventLog();

var host = builder.Build();
host.Run();
