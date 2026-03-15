using System.Text.Json;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MIConectaAgent.Services;

public class CommandPollingService : BackgroundService
{
    private readonly ILogger<CommandPollingService> _logger;
    private readonly AgentConfig _config;
    private readonly ApiClient _apiClient;
    private readonly ScriptExecutor _scriptExecutor;

    public CommandPollingService(
        ILogger<CommandPollingService> logger,
        AgentConfig config,
        ApiClient apiClient,
        ScriptExecutor scriptExecutor)
    {
        _logger = logger;
        _config = config;
        _apiClient = apiClient;
        _scriptExecutor = scriptExecutor;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Aguardar registro inicial
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        _logger.LogInformation("Serviço de polling de comandos iniciado");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (!string.IsNullOrEmpty(_config.DeviceId))
                {
                    // Verificar comandos de script pendentes
                    var comandos = await _apiClient.ObterComandosPendentes();
                    foreach (var comando in comandos)
                    {
                        await ProcessarComando(comando);
                    }

                    // Verificar deploys pendentes
                    var deploys = await _apiClient.ObterDeploysPendentes();
                    foreach (var deploy in deploys)
                    {
                        await ProcessarDeploy(deploy);
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no polling de comandos");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.CommandPollIntervalSeconds), stoppingToken);
        }
    }

    private async Task ProcessarComando(JsonElement comando)
    {
        try
        {
            var execId = comando.GetProperty("id").GetString()!;
            var script = comando.GetProperty("script");
            var tipo = script.GetProperty("tipo").GetString() ?? "powershell";
            var conteudo = script.GetProperty("conteudo").GetString() ?? "";
            var timeout = 300;
            if (script.TryGetProperty("timeoutSegundos", out var t))
                timeout = t.GetInt32();

            _logger.LogInformation("Executando script {ExecId} - Tipo: {Tipo}", execId, tipo);

            var resultado = await _scriptExecutor.ExecutarAsync(tipo, conteudo, timeout);
            await _apiClient.ReportarResultadoExecucao(execId, resultado);

            _logger.LogInformation("Script {ExecId} finalizado com status: {Status}", execId, resultado.Status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar comando");
        }
    }

    private async Task ProcessarDeploy(JsonElement deploy)
    {
        try
        {
            var deployId = deploy.GetProperty("id").GetString()!;
            var package = deploy.GetProperty("softwarePackage");
            var arquivoUrl = package.GetProperty("arquivoPath").GetString() ?? "";
            var parametros = "";

            if (package.TryGetProperty("parametrosSilenciosa", out var p))
                parametros = p.GetString() ?? "";

            _logger.LogInformation("Processando deploy {DeployId}", deployId);

            // Baixar arquivo
            var tempDir = Path.Combine(Path.GetTempPath(), "MIConectaRMM");
            Directory.CreateDirectory(tempDir);
            var fileName = package.GetProperty("arquivoNome").GetString() ?? "installer.exe";
            var localPath = Path.Combine(tempDir, fileName);

            using var http = new HttpClient();
            var fileBytes = await http.GetByteArrayAsync(
                $"{_config.ServerUrl.TrimEnd('/')}/{arquivoUrl}"
            );
            await File.WriteAllBytesAsync(localPath, fileBytes);

            // Instalar
            var resultado = await _scriptExecutor.InstalarSoftwareAsync(localPath, parametros);

            // Limpar
            try { File.Delete(localPath); } catch { }

            // Reportar resultado
            await _apiClient.ReportarResultadoExecucao(deployId, resultado);

            _logger.LogInformation("Deploy {DeployId} finalizado: {Status}", deployId, resultado.Status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar deploy");
        }
    }
}
