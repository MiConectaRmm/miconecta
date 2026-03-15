import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { SoftwareDeployment } from './software-deployment.entity';

export enum PackageType {
  MSI = 'msi',
  EXE = 'exe',
  POWERSHELL = 'powershell',
}

@Entity('software_packages')
export class SoftwarePackage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id', nullable: true })
  tenantId: string;

  @Column({ length: 255 })
  nome: string;

  @Column({ length: 100, nullable: true })
  versao: string;

  @Column({ type: 'text', nullable: true })
  descricao: string;

  @Column({ type: 'enum', enum: PackageType })
  tipo: PackageType;

  @Column({ type: 'text', name: 'arquivo_path' })
  arquivoPath: string;

  @Column({ length: 255, name: 'arquivo_nome' })
  arquivoNome: string;

  @Column({ type: 'bigint', name: 'arquivo_tamanho' })
  arquivoTamanho: number;

  @Column({ type: 'text', name: 'parametros_instalacao', nullable: true })
  parametrosInstalacao: string;

  @Column({ type: 'text', name: 'parametros_silenciosa', nullable: true })
  parametrosSilenciosa: string;

  @Column({ default: true })
  ativo: boolean;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;

  @UpdateDateColumn({ name: 'atualizado_em' })
  atualizadoEm: Date;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @OneToMany(() => SoftwareDeployment, (deploy) => deploy.softwarePackage)
  deployments: SoftwareDeployment[];
}
