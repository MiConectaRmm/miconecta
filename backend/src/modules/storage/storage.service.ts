import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { FileAttachment } from '../../database/entities/file-attachment.entity';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client;
  private bucket: string;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(FileAttachment)
    private readonly fileRepo: Repository<FileAttachment>,
  ) {
    const endpoint = this.config.get('S3_ENDPOINT');
    const region = this.config.get('S3_REGION', 'auto');
    const accessKeyId = this.config.get('S3_ACCESS_KEY_ID', '');
    const secretAccessKey = this.config.get('S3_SECRET_ACCESS_KEY', '');
    this.bucket = this.config.get('S3_BUCKET', 'miconecta');

    if (endpoint && accessKeyId) {
      this.s3 = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      this.logger.log(`S3 configurado: ${endpoint}/${this.bucket}`);
    } else {
      this.logger.warn('S3 NÃO configurado — uploads desabilitados');
    }
  }

  async upload(dados: {
    tenantId: string;
    entidadeTipo: string;
    entidadeId: string;
    nomeOriginal: string;
    mimeType: string;
    buffer: Buffer;
    uploadedPorTipo: string;
    uploadedPorId?: string;
    uploadedPorNome?: string;
  }): Promise<FileAttachment> {
    if (!this.s3) {
      throw new Error('Storage S3 não configurado');
    }

    const ext = dados.nomeOriginal.split('.').pop() || 'bin';
    const nomeStorage = `${uuidv4()}.${ext}`;
    const s3Key = `${dados.tenantId}/${dados.entidadeTipo}/${dados.entidadeId}/${nomeStorage}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: dados.buffer,
      ContentType: dados.mimeType,
    }));

    const attachment = this.fileRepo.create({
      tenantId: dados.tenantId,
      entidadeTipo: dados.entidadeTipo,
      entidadeId: dados.entidadeId,
      nomeOriginal: dados.nomeOriginal,
      nomeStorage,
      mimeType: dados.mimeType,
      tamanhoBytes: dados.buffer.length,
      s3Bucket: this.bucket,
      s3Key,
      uploadedPorTipo: dados.uploadedPorTipo,
      uploadedPorId: dados.uploadedPorId,
      uploadedPorNome: dados.uploadedPorNome,
    });

    return this.fileRepo.save(attachment);
  }

  async getPresignedUrl(fileId: string, tenantId: string, expiresIn = 3600): Promise<string> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, tenantId } });
    if (!file) throw new Error('Arquivo não encontrado');
    if (!this.s3) throw new Error('Storage S3 não configurado');

    const command = new GetObjectCommand({
      Bucket: file.s3Bucket,
      Key: file.s3Key,
    });

    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(fileId: string, tenantId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, tenantId } });
    if (!file) throw new Error('Arquivo não encontrado');

    if (this.s3) {
      await this.s3.send(new DeleteObjectCommand({
        Bucket: file.s3Bucket,
        Key: file.s3Key,
      }));
    }

    await this.fileRepo.delete(fileId);
  }

  async listarPorEntidade(tenantId: string, entidadeTipo: string, entidadeId: string) {
    return this.fileRepo.find({
      where: { tenantId, entidadeTipo, entidadeId },
      order: { criadoEm: 'DESC' },
    });
  }
}
