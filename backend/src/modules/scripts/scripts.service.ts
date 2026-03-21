import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Script } from '../../database/entities/script.entity';
import { ScriptExecution, ExecutionStatus } from '../../database/entities/script-execution.entity';
import { Device } from '../../database/entities/device.entity';
import { RmmGateway } from '../gateway/rmm.gateway';

@Injectable()
export class ScriptsService {
  constructor(
    @InjectRepository(Script)
    private readonly scriptRepo: Repository<Script>,
    @InjectRepository(ScriptExecution)
    private readonly execRepo: Repository<ScriptExecution>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    private readonly rmmGateway: RmmGateway,
  ) {}

  async criarScript(dados: Partial<Script>) {
    const script = this.scriptRepo.create(dados);
    return this.scriptRepo.save(script);
  }

  async listarScripts(tenantId: string) {
    return this.scriptRepo.find({
      where: [{ tenantId }, { global: true }],
      order: { nome: 'ASC' },
    });
  }

  async buscarScript(id: string) {
    const script = await this.scriptRepo.findOne({ where: { id } });
    if (!script) throw new NotFoundException('Script não encontrado');
    return script;
  }

  async atualizarScript(id: string, dados: Partial<Script>) {
    await this.buscarScript(id);
    await this.scriptRepo.update(id, dados);
    return this.buscarScript(id);
  }

  async removerScript(id: string) {
    await this.buscarScript(id);
    await this.scriptRepo.delete(id);
    return { mensagem: 'Script removido com sucesso' };
  }

  // Executar script em um ou múltiplos dispositivos
  async executarScript(scriptId: string, deviceIds: string[], executadoPor: string) {
    const script = await this.buscarScript(scriptId);
    const devices = await this.deviceRepo.find({ where: { id: In(deviceIds) } });

    const execucoes = devices.map((device) =>
      this.execRepo.create({
        scriptId: script.id,
        deviceId: device.id,
        executadoPor,
        status: ExecutionStatus.PENDENTE,
      }),
    );

    const saved = await this.execRepo.save(execucoes);

    for (const exec of saved) {
      const dispatched = this.rmmGateway.emitToAgent(exec.deviceId, 'script.dispatch', {
        executionId: exec.id,
        deviceId: exec.deviceId,
        linguagem: script.tipo,
        conteudo: script.conteudo,
        timeoutSegundos: script.timeoutSegundos || 300,
      });

      if (dispatched) {
        await this.execRepo.update(exec.id, {
          status: ExecutionStatus.EXECUTANDO,
          iniciadoEm: new Date(),
        });
      }
    }

    return this.execRepo.find({
      where: { id: In(saved.map((e) => e.id)) },
      relations: ['script', 'device'],
      order: { criadoEm: 'ASC' },
    });
  }

  // Obter comandos pendentes para um dispositivo (usado pelo agente)
  async obterComandosPendentes(deviceId: string) {
    return this.execRepo.find({
      where: { deviceId, status: ExecutionStatus.PENDENTE },
      relations: ['script'],
      order: { criadoEm: 'ASC' },
    });
  }

  // Atualizar resultado da execução (usado pelo agente)
  async atualizarExecucao(execId: string, resultado: Partial<ScriptExecution>) {
    await this.execRepo.update(execId, {
      ...resultado,
      finalizadoEm: new Date(),
    });
    return this.execRepo.findOne({ where: { id: execId } });
  }

  // Histórico de execuções
  async historicoExecucoes(tenantId: string, filtros?: any) {
    const query = this.execRepo.createQueryBuilder('exec')
      .leftJoinAndSelect('exec.script', 'script')
      .leftJoinAndSelect('exec.device', 'device')
      .where('device.tenantId = :tenantId', { tenantId });

    if (filtros?.deviceId) {
      query.andWhere('exec.deviceId = :deviceId', { deviceId: filtros.deviceId });
    }

    return query.orderBy('exec.criadoEm', 'DESC').take(100).getMany();
  }
}
