using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace MIConectaAgent.Services;

public class ScriptExecutor
{
    private readonly ILogger<ScriptExecutor> _logger;

    public ScriptExecutor(ILogger<ScriptExecutor> logger)
    {
        _logger = logger;
    }

    public async Task<ScriptResult> ExecutarAsync(string tipo, string conteudo, int timeoutSegundos = 300)
    {
        var resultado = new ScriptResult();
        var tempFile = "";

        try
        {
            string programa;
            string argumentos;

            switch (tipo.ToLower())
            {
                case "powershell":
                    tempFile = Path.Combine(Path.GetTempPath(), $"miconecta_{Guid.NewGuid()}.ps1");
                    File.WriteAllText(tempFile, conteudo);
                    programa = "powershell.exe";
                    argumentos = $"-NoProfile -ExecutionPolicy Bypass -File \"{tempFile}\"";
                    break;

                case "cmd":
                    tempFile = Path.Combine(Path.GetTempPath(), $"miconecta_{Guid.NewGuid()}.cmd");
                    File.WriteAllText(tempFile, conteudo);
                    programa = "cmd.exe";
                    argumentos = $"/c \"{tempFile}\"";
                    break;

                case "batch":
                    tempFile = Path.Combine(Path.GetTempPath(), $"miconecta_{Guid.NewGuid()}.bat");
                    File.WriteAllText(tempFile, conteudo);
                    programa = "cmd.exe";
                    argumentos = $"/c \"{tempFile}\"";
                    break;

                default:
                    resultado.Status = "erro";
                    resultado.SaidaErro = $"Tipo de script não suportado: {tipo}";
                    return resultado;
            }

            _logger.LogInformation("Executando script {Tipo}: {Programa} {Argumentos}", tipo, programa, argumentos);

            using var processo = new Process();
            processo.StartInfo = new ProcessStartInfo
            {
                FileName = programa,
                Arguments = argumentos,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetTempPath(),
            };

            resultado.IniciadoEm = DateTime.UtcNow;
            processo.Start();

            using var cts = new CancellationTokenSource(TimeSpan.FromSeconds(timeoutSegundos));

            var outputTask = processo.StandardOutput.ReadToEndAsync();
            var errorTask = processo.StandardError.ReadToEndAsync();

            try
            {
                await processo.WaitForExitAsync(cts.Token);
                resultado.Saida = await outputTask;
                resultado.SaidaErro = await errorTask;
                resultado.CodigoSaida = processo.ExitCode;
                resultado.Status = processo.ExitCode == 0 ? "sucesso" : "erro";
            }
            catch (OperationCanceledException)
            {
                try { processo.Kill(true); } catch { }
                resultado.Status = "timeout";
                resultado.SaidaErro = $"Script excedeu o timeout de {timeoutSegundos} segundos";
            }

            resultado.FinalizadoEm = DateTime.UtcNow;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao executar script");
            resultado.Status = "erro";
            resultado.SaidaErro = ex.Message;
            resultado.FinalizadoEm = DateTime.UtcNow;
        }
        finally
        {
            if (!string.IsNullOrEmpty(tempFile) && File.Exists(tempFile))
            {
                try { File.Delete(tempFile); } catch { }
            }
        }

        return resultado;
    }

    public async Task<ScriptResult> InstalarSoftwareAsync(string caminhoArquivo, string? parametros = null)
    {
        var ext = Path.GetExtension(caminhoArquivo).ToLower();

        string programa;
        string argumentos;

        switch (ext)
        {
            case ".msi":
                programa = "msiexec.exe";
                argumentos = $"/i \"{caminhoArquivo}\" /qn /norestart {parametros ?? ""}";
                break;

            case ".exe":
                programa = caminhoArquivo;
                argumentos = parametros ?? "/S";
                break;

            default:
                return new ScriptResult
                {
                    Status = "erro",
                    SaidaErro = $"Tipo de arquivo não suportado: {ext}"
                };
        }

        var resultado = new ScriptResult { IniciadoEm = DateTime.UtcNow };

        try
        {
            using var processo = new Process();
            processo.StartInfo = new ProcessStartInfo
            {
                FileName = programa,
                Arguments = argumentos,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            };

            processo.Start();
            await processo.WaitForExitAsync();

            resultado.Saida = await processo.StandardOutput.ReadToEndAsync();
            resultado.SaidaErro = await processo.StandardError.ReadToEndAsync();
            resultado.CodigoSaida = processo.ExitCode;
            resultado.Status = processo.ExitCode == 0 ? "sucesso" : "erro";
        }
        catch (Exception ex)
        {
            resultado.Status = "erro";
            resultado.SaidaErro = ex.Message;
        }

        resultado.FinalizadoEm = DateTime.UtcNow;
        return resultado;
    }
}

public class ScriptResult
{
    public string Status { get; set; } = "pendente";
    public string? Saida { get; set; }
    public string? SaidaErro { get; set; }
    public int? CodigoSaida { get; set; }
    public DateTime? IniciadoEm { get; set; }
    public DateTime? FinalizadoEm { get; set; }
}
