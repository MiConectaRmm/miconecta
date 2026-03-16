using Microsoft.Extensions.Logging;
using System.Diagnostics;
using System.Reflection;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// Serviço de atualização automática OTA (Over-The-Air).
/// Verifica periodicamente se há nova versão no servidor,
/// baixa o pacote, valida integridade e aplica a atualização
/// reiniciando o serviço.
/// </summary>
public class AutoUpdater
{
    private readonly ILogger<AutoUpdater> _logger;
    private readonly ApiClient _apiClient;
    private readonly AgentConfig _config;

    public string VersaoAtual => Assembly.GetExecutingAssembly()
        .GetName().Version?.ToString() ?? "2.0.0";

    public AutoUpdater(ILogger<AutoUpdater> logger, ApiClient apiClient, AgentConfig config)
    {
        _logger = logger;
        _apiClient = apiClient;
        _config = config;
    }

    /// <summary>
    /// Verifica se há atualização disponível no servidor.
    /// </summary>
    public async Task<UpdateInfo?> VerificarAtualizacao()
    {
        try
        {
            var info = await _apiClient.VerificarAtualizacaoAgente(VersaoAtual);
            if (info == null) return null;

            var novaVersao = info.Value.TryGetProperty("versao", out var v) ? v.GetString() : null;
            var downloadUrl = info.Value.TryGetProperty("downloadUrl", out var d) ? d.GetString() : null;
            var checksum = info.Value.TryGetProperty("checksum", out var c) ? c.GetString() : null;
            var obrigatoria = info.Value.TryGetProperty("obrigatoria", out var o) && o.GetBoolean();

            if (string.IsNullOrEmpty(novaVersao) || novaVersao == VersaoAtual)
                return null;

            _logger.LogInformation("Atualização disponível: {Atual} → {Nova} (obrigatória: {Obrigatoria})",
                VersaoAtual, novaVersao, obrigatoria);

            return new UpdateInfo
            {
                VersaoNova = novaVersao,
                DownloadUrl = downloadUrl ?? "",
                Checksum = checksum ?? "",
                Obrigatoria = obrigatoria,
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao verificar atualização");
            return null;
        }
    }

    /// <summary>
    /// Baixa e aplica a atualização.
    /// Processo:
    /// 1. Baixa ZIP para pasta temp
    /// 2. Valida checksum SHA256
    /// 3. Extrai para pasta de staging
    /// 4. Executa updater.exe que para o serviço, copia arquivos e reinicia
    /// </summary>
    public async Task<bool> AplicarAtualizacao(UpdateInfo update)
    {
        var tempDir = Path.Combine(Path.GetTempPath(), "MIConectaUpdate");
        var zipPath = Path.Combine(tempDir, "update.zip");

        try
        {
            Directory.CreateDirectory(tempDir);

            _logger.LogInformation("Baixando atualização v{Versao}...", update.VersaoNova);
            var sucesso = await _apiClient.BaixarArquivo(update.DownloadUrl, zipPath);
            if (!sucesso)
            {
                _logger.LogError("Falha ao baixar atualização");
                return false;
            }

            // Validar checksum
            if (!string.IsNullOrEmpty(update.Checksum))
            {
                var hash = CalcularSHA256(zipPath);
                if (!hash.Equals(update.Checksum, StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogError("Checksum inválido! Esperado: {Esperado}, Obtido: {Obtido}",
                        update.Checksum, hash);
                    return false;
                }
                _logger.LogInformation("Checksum validado: {Hash}", hash);
            }

            // Extrair para staging
            var stagingDir = Path.Combine(tempDir, "staging");
            if (Directory.Exists(stagingDir)) Directory.Delete(stagingDir, true);
            System.IO.Compression.ZipFile.ExtractToDirectory(zipPath, stagingDir);

            // Criar script de atualização
            var installDir = AppDomain.CurrentDomain.BaseDirectory;
            var scriptPath = Path.Combine(tempDir, "update.cmd");
            var scriptContent = $@"
@echo off
echo Parando servico MIConectaRMM Agent...
net stop ""MIConectaRMM Agent""
timeout /t 3 /nobreak
echo Copiando novos arquivos...
xcopy /s /y ""{stagingDir}\*"" ""{installDir}""
echo Iniciando servico...
net start ""MIConectaRMM Agent""
echo Limpando temporarios...
rmdir /s /q ""{tempDir}""
echo Atualizacao concluida!
";
            File.WriteAllText(scriptPath, scriptContent);

            _logger.LogInformation("Executando script de atualização...");
            Process.Start(new ProcessStartInfo
            {
                FileName = "cmd.exe",
                Arguments = $"/c \"{scriptPath}\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                Verb = "runas",
            });

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Erro ao aplicar atualização");
            return false;
        }
    }

    private string CalcularSHA256(string filePath)
    {
        using var sha = System.Security.Cryptography.SHA256.Create();
        using var stream = File.OpenRead(filePath);
        var hash = sha.ComputeHash(stream);
        return BitConverter.ToString(hash).Replace("-", "").ToLowerInvariant();
    }
}

public class UpdateInfo
{
    public string VersaoNova { get; set; } = "";
    public string DownloadUrl { get; set; } = "";
    public string Checksum { get; set; } = "";
    public bool Obrigatoria { get; set; }
}
