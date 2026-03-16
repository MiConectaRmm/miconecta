import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('file_attachments')
@Index(['tenantId', 'entidadeTipo', 'entidadeId'])
export class FileAttachment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'entidade_tipo', length: 50 })
  entidadeTipo: string;

  @Column({ name: 'entidade_id' })
  entidadeId: string;

  @Column({ name: 'nome_original', length: 500 })
  nomeOriginal: string;

  @Column({ name: 'nome_storage', length: 500 })
  nomeStorage: string;

  @Column({ name: 'mime_type', length: 100 })
  mimeType: string;

  @Column({ name: 'tamanho_bytes', type: 'bigint' })
  tamanhoBytes: number;

  @Column({ name: 's3_bucket', length: 255 })
  s3Bucket: string;

  @Column({ name: 's3_key', length: 1000 })
  s3Key: string;

  @Column({ name: 'uploaded_por_tipo', length: 50 })
  uploadedPorTipo: string;

  @Column({ name: 'uploaded_por_id', nullable: true })
  uploadedPorId: string;

  @Column({ name: 'uploaded_por_nome', length: 255, nullable: true })
  uploadedPorNome: string;

  @CreateDateColumn({ name: 'criado_em' })
  criadoEm: Date;
}
