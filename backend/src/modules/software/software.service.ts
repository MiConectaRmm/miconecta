import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SoftwarePackage } from '../../database/entities/software-package.entity';
import { SoftwareDeployment, DeploymentStatus } from '../../database/entities/software-deployment.entity';
import { Device } from '../../database/entities/device.entity';

@Injectable()
export class SoftwareService {
  constructor(
    @InjectRepository(SoftwarePackage)
    private readonly packageRepo: Repository<SoftwarePackage>,
    @InjectRepository(SoftwareDeployment)
    private readonly deployRepo: Repository<SoftwareDeployment>,
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
  ) {}

  // === Pacotes ===

  async criarPacote(dados: Partial<SoftwarePackage>) {
    const pacote = this.packageRepo.create(dados);
    return this.packageRepo.save(pacote);
  }

  async listarPacotes(tenantId: string) {
    return this.packageRepo.find({
      where: [{ tenantId }, { tenantId: null as any }],
      order: { nome: 'ASC' },
    });
  }

  async buscarPacote(id: string) {
    const pacote = await this.packageRepo.findOne({ where: { id } });
    if (!pacote) throw new NotFoundException('Pacote não encontrado');
    return pacote;
  }

  async atualizarPacote(id: string, dados: Partial<SoftwarePackage>) {
    await this.buscarPacote(id);
    await this.packageRepo.update(id, dados);
    return this.buscarPacote(id);
  }

  async removerPacote(id: string) {
    await this.buscarPacote(id);
    await this.packageRepo.delete(id);
    return { mensagem: 'Pacote removido com sucesso' };
  }

  // === Deploy ===

  async criarDeploy(packageId: string, deviceIds: string[], solicitadoPor: string) {
    const pacote = await this.buscarPacote(packageId);
    const devices = await this.deviceRepo.find({ where: { id: In(deviceIds) } });

    const deployments = devices.map((device) =>
      this.deployRepo.create({
        packageId: pacote.id,
        deviceId: device.id,
        solicitadoPor,
        status: DeploymentStatus.PENDENTE,
      }),
    );

    return this.deployRepo.save(deployments);
  }

  async listarDeploys(tenantId: string) {
    return this.deployRepo
      .createQueryBuilder('deploy')
      .leftJoinAndSelect('deploy.softwarePackage', 'package')
      .leftJoinAndSelect('deploy.device', 'device')
      .where('device.tenantId = :tenantId', { tenantId })
      .orderBy('deploy.criadoEm', 'DESC')
      .take(100)
      .getMany();
  }

  // Endpoint para agente obter deploys pendentes
  async deploysPendentes(deviceId: string) {
    return this.deployRepo.find({
      where: { deviceId, status: DeploymentStatus.PENDENTE },
      relations: ['softwarePackage'],
      order: { criadoEm: 'ASC' },
    });
  }

  // Agente reporta resultado do deploy
  async atualizarDeploy(deployId: string, resultado: Partial<SoftwareDeployment>) {
    await this.deployRepo.update(deployId, {
      ...resultado,
      finalizadoEm: new Date(),
    });
    return this.deployRepo.findOne({ where: { id: deployId } });
  }
}
