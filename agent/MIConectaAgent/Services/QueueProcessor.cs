using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace MIConectaAgent.Services;

/// <summary>
/// BackgroundService que processa a fila local periodicamente.
/// Quando o servidor está disponível, drena itens pendentes e os envia.
/// Implementa backoff exponencial para falhas consecutivas.
/// </summary>
public class QueueProcessor : BackgroundService
{
    private readonly ILogger<QueueProcessor> _logger;
    private readonly LocalQueue _queue;
    private readonly ApiClient _apiClient;

    private int _intervaloSegundos = 30;

    public QueueProcessor(ILogger<QueueProcessor> logger, LocalQueue queue, ApiClient apiClient)
    {
        _logger = logger;
        _queue = queue;
        _apiClient = apiClient;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("QueueProcessor iniciado");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var pendentes = _queue.ObterPendentes(20);
                if (pendentes.Count > 0)
                {
                    _logger.LogInformation("Processando {Count} itens da fila local", pendentes.Count);

                    var sucesso = 0;
                    foreach (var item in pendentes)
                    {
                        try
                        {
                            var enviado = await _apiClient.EnviarPayloadGenerico(item.Endpoint, item.Payload);
                            if (enviado)
                            {
                                _queue.Remover(item.Id);
                                sucesso++;
                            }
                            else
                            {
                                _queue.IncrementarTentativa(item.Id);
                            }
                        }
                        catch
                        {
                            _queue.IncrementarTentativa(item.Id);
                        }
                    }

                    _logger.LogInformation("Fila: {Sucesso}/{Total} enviados com sucesso", sucesso, pendentes.Count);

                    // Se todos falharam, aumentar intervalo
                    if (sucesso == 0)
                        _intervaloSegundos = Math.Min(_intervaloSegundos * 2, 300);
                    else
                        _intervaloSegundos = 30;
                }

                // Limpar expirados a cada hora
                if (DateTime.UtcNow.Minute == 0)
                    _queue.LimparExpirados();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Erro no QueueProcessor");
            }

            await Task.Delay(TimeSpan.FromSeconds(_intervaloSegundos), stoppingToken);
        }
    }
}
