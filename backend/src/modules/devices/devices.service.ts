import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Device, DeviceStatus } from '../../database/entities/device.entity';
import { DeviceInventory } from '../../database/entities/device-inventory.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class DevicesService {
  constructor(
    @InjectRepository(Device)
    private readonly deviceRepo: Repository<Device>,
    @InjectRepository(DeviceInventory)
    private readonly inventoryRepo: Repository<DeviceInventory>,
  ) {}

  async registrarDispositivo(dados: Partial<Device>) {
    // Verificar se já existe pelo hostname + tenantId
    let device = await this.deviceRepo.findOne({
      where: { hostname: dados.hostname, tenantId: dados.tenantId },
    });

    if (device) {
      // Atualizar dados existentes
      await this.deviceRepo.update(device.id, {
        ...dados,
        status: DeviceStatus.ONLINE,
        lastSeen: new Date(),
      });
      return this.deviceRepo.findOne({ where: { id: device.id } });
    }

    // Criar novo dispositivo
    device = this.deviceRepo.create({
      ...dados,
      deviceToken: uuidv4(),
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
    });

    return this.deviceRepo.save(device);
  }

  async heartbeat(deviceId: string, metricas?: any) {
    const device = await this.deviceRepo.findOne({ where: { id: deviceId } });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');

    await this.deviceRepo.update(deviceId, {
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
      ...(metricas || {}),
    });

    return { status: 'ok', timestamp: new Date() };
  }

  async listarDispositivos(tenantId: string, filtros?: any) {
    const query = this.deviceRepo.createQueryBuilder('device')
      .leftJoinAndSelect('device.organization', 'organization')
      .where('device.tenant_id = :tenantId', { tenantId });

    if (filtros?.status) {
      query.andWhere('device.status = :status', { status: filtros.status });
    }

    if (filtros?.organizationId) {
      query.andWhere('device.organization_id = :orgId', { orgId: filtros.organizationId });
    }

    if (filtros?.busca) {
      query.andWhere('(device.hostname ILIKE :busca OR device.ip_local ILIKE :busca)', {
        busca: `%${filtros.busca}%`,
      });
    }

    return query.orderBy('device.hostname', 'ASC').getMany();
  }

  async buscarDispositivo(id: string) {
    const device = await this.deviceRepo.findOne({
      where: { id },
      relations: ['organization', 'metricas', 'alertas'],
    });
    if (!device) throw new NotFoundException('Dispositivo não encontrado');
    return device;
  }

  async atualizarDispositivo(id: string, dados: Partial<Device>) {
    await this.buscarDispositivo(id);
    await this.deviceRepo.update(id, dados);
    return this.buscarDispositivo(id);
  }

  async removerDispositivo(id: string) {
    await this.buscarDispositivo(id);
    await this.deviceRepo.delete(id);
    return { mensagem: 'Dispositivo removido com sucesso' };
  }

  // Inventário de Software
  async atualizarInventario(deviceId: string, softwares: Partial<DeviceInventory>[]) {
    // Remover inventário antigo
    await this.inventoryRepo.delete({ deviceId });

    // Inserir novo inventário
    const itens = softwares.map((sw) =>
      this.inventoryRepo.create({ ...sw, deviceId }),
    );

    return this.inventoryRepo.save(itens);
  }

  async listarInventario(deviceId: string) {
    return this.inventoryRepo.find({
      where: { deviceId },
      order: { nome: 'ASC' },
    });
  }

  // Resumo para dashboard
  async resumo(tenantId: string) {
    const total = await this.deviceRepo.count({ where: { tenantId } });
    const online = await this.deviceRepo.count({
      where: { tenantId, status: DeviceStatus.ONLINE },
    });
    const offline = await this.deviceRepo.count({
      where: { tenantId, status: DeviceStatus.OFFLINE },
    });
    const alerta = await this.deviceRepo.count({
      where: { tenantId, status: DeviceStatus.ALERTA },
    });

    return { total, online, offline, alerta };
  }

  // Verificação de dispositivos offline (roda a cada 2 minutos)
  @Cron(CronExpression.EVERY_MINUTE)
  async verificarOffline() {
    const limite = new Date(Date.now() - 3 * 60 * 1000); // 3 minutos sem heartbeat
    await this.deviceRepo.update(
      {
        status: DeviceStatus.ONLINE,
        lastSeen: LessThan(limite),
      },
      { status: DeviceStatus.OFFLINE },
    );
  }
}
