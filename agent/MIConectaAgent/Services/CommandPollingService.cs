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
    private readonly RealtimeClient _realtimeClient;

    public CommandPollingService(
        ILogger<CommandPollingService> logger,
        AgentConfig config,
        ApiClient apiClient,
        ScriptExecutor scriptExecutor,
        RealtimeClient realtimeClient)
    {
        _logger = logger;
        _config = config;
        _apiClient = apiClient;
        _scriptExecutor = scriptExecutor;
        _realtimeClient = realtimeClient;

        // Wire WebSocket script dispatch → execução local
        _realtimeClient.OnScriptDispatch += ExecutarViaWebSocket;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Aguardar registro inicial
        await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken);

        _logger.LogInformation("Serviço de polling de comandos iniciado (WebSocket + HTTP fallback)");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                // Polling HTTP apenas quando WebSocket NÃO está conectado
                // Quando WS conectado, comandos chegam via evento OnScriptDispatch
                if (!string.IsNullOrEmpty(_config.DeviceId) && !_realtimeClient.Conectado)
                {
                    _logger.LogDebug("WS offline — usando HTTP polling de comandos");

                    var comandos = await _apiClient.ObterComandosPendentes();
                    foreach (var comando in comandos)
                        await ProcessarComandoHttp(comando);

                    var deploys = await _apiClient.ObterDeploysPendentes();
                    foreach (var deploy in deploys)
                        await ProcessarDeploy(deploy);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no polling de comandos");
            }

            await Task.Delay(TimeSpan.FromSeconds(_config.CommandPollIntervalSeconds), stoppingToken);
        }
    }

    // ── Handler WebSocket: script.dispatch ──
    private async Task ExecutarViaWebSocket(ScriptDispatchPayload payload)
    {
        try
        {
            _logger.LogInformation("WS: executando script {ExecId} ({Lang})", payload.ExecutionId, payload.Linguagem);

            var resultado = await _scriptExecutor.ExecutarAsync(
                payload.Linguagem,
                payload.Conteudo,
                payload.TimeoutSegundos);

            var sucesso = resultado.Status == "sucesso";
            var saida = resultado.Saida + (string.IsNullOrEmpty(resultado.SaidaErro) ? "" : $"\n[STDERR]\n{resultado.SaidaErro}");

            // Enviar resultado via WebSocket
            await _realtimeClient.EnviarScriptResultado(payload.ExecutionId, saida, sucesso, resultado.CodigoSaida);

            // Também registrar via HTTP para persistência no backend
            await _apiClient.ReportarResultadoExecucao(payload.ExecutionId, resultado);

            _logger.LogInformation("WS: script {ExecId} concluído — sucesso={Ok}", payload.ExecutionId, sucesso);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao executar script via WebSocket: {ExecId}", payload.ExecutionId);
            try { await _realtimeClient.EnviarScriptResultado(payload.ExecutionId, ex.Message, false, -1); }
            catch { /* silencioso */ }
        }
    }

    // ── Handler HTTP polling (fallback) ──
    private async Task ProcessarComandoHttp(JsonElement comando)
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

            _logger.LogInformation("HTTP: executando script {ExecId} - Tipo: {Tipo}", execId, tipo);

            var resultado = await _scriptExecutor.ExecutarAsync(tipo, conteudo, timeout);
            await _apiClient.ReportarResultadoExecucao(execId, resultado);

            _logger.LogInformation("HTTP: script {ExecId} finalizado — {Status}", execId, resultado.Status);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao processar comando via HTTP");
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
