import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createReadStream, existsSync } from 'fs';
import { FileAttachment } from '../../database/entities/file-attachment.entity';

const LOCAL_BUCKET = 'local';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3: S3Client | null;
  private bucket: string;
  private readonly localRoot: string;

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    @InjectRepository(FileAttachment)
    private readonly fileRepo: Repository<FileAttachment>,
  ) {
    const endpoint = String(this.config.get('S3_ENDPOINT') ?? '').trim();
    const region = String(this.config.get('S3_REGION') ?? 'auto').trim() || 'auto';
    const accessKeyId = String(this.config.get('S3_ACCESS_KEY_ID') ?? '').trim();
    const secretAccessKey = String(this.config.get('S3_SECRET_ACCESS_KEY') ?? '').trim();
    this.bucket = String(this.config.get('S3_BUCKET') ?? 'miconecta').trim() || 'miconecta';
    this.localRoot = path.resolve(this.config.get('UPLOAD_DIR') || path.join(process.cwd(), 'uploads'));

    const s3Ready = Boolean(endpoint && accessKeyId && secretAccessKey);
    if (s3Ready) {
      this.s3 = new S3Client({
        endpoint,
        region,
        credentials: { accessKeyId, secretAccessKey },
        forcePathStyle: true,
      });
      this.logger.log(`Armazenamento R2/S3 ativo — endpoint=${endpoint} bucket=${this.bucket}`);
    } else {
      this.s3 = null;
      this.logger.warn(
        'S3/R2 inativo (falta S3_ENDPOINT, S3_ACCESS_KEY_ID ou S3_SECRET_ACCESS_KEY) — usando apenas disco uploads/',
      );
      if (this.config.get('NODE_ENV') === 'production') {
        this.logger.error(
          'PRODUÇÃO: ficheiros NÃO sobem para Cloudflare R2; ficam no disco efémero e somem no redeploy. ' +
            'Defina as Fly secrets: S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET.',
        );
      }
    }
  }

  private getPublicApiBase(): string {
    const base = (this.config.get('PUBLIC_API_URL') || this.config.get('API_PUBLIC_URL') || '').replace(/\/$/, '');
    return base || 'https://api.maginf.com.br';
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
  }): Promise<FileAttachment & { url: string }> {
    if (!dados.tenantId) {
      throw new BadRequestException('tenantId é obrigatório para upload');
    }

    const ext = dados.nomeOriginal.split('.').pop() || 'bin';
    const nomeStorage = `${uuidv4()}.${ext}`;

    let saved: FileAttachment;

    if (this.s3) {
      const s3Key = `${dados.tenantId}/${dados.entidadeTipo}/${dados.entidadeId}/${nomeStorage}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: s3Key,
          Body: dados.buffer,
          ContentType: dados.mimeType,
        }),
      );

      saved = await this.fileRepo.save(
        this.fileRepo.create({
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
        }),
      );
    } else {
      const relKey = path.join(dados.tenantId, dados.entidadeTipo, dados.entidadeId, nomeStorage).replace(/\\/g, '/');
      const dir = path.join(this.localRoot, dados.tenantId, dados.entidadeTipo, dados.entidadeId);
      await fs.mkdir(dir, { recursive: true });
      const fullPath = path.join(dir, nomeStorage);
      await fs.writeFile(fullPath, dados.buffer);

      saved = await this.fileRepo.save(
        this.fileRepo.create({
          tenantId: dados.tenantId,
          entidadeTipo: dados.entidadeTipo,
          entidadeId: dados.entidadeId,
          nomeOriginal: dados.nomeOriginal,
          nomeStorage,
          mimeType: dados.mimeType,
          tamanhoBytes: dados.buffer.length,
          s3Bucket: LOCAL_BUCKET,
          s3Key: relKey,
          uploadedPorTipo: dados.uploadedPorTipo,
          uploadedPorId: dados.uploadedPorId,
          uploadedPorNome: dados.uploadedPorNome,
        }),
      );
    }

    const url = await this.buildReadUrl(saved);
    return Object.assign(saved, { url });
  }

  private async buildReadUrl(file: FileAttachment): Promise<string> {
    if (file.s3Bucket === LOCAL_BUCKET) {
      const token = await this.jwtService.signAsync(
        { typ: 'storage_file', sub: file.id, tid: file.tenantId },
        { expiresIn: '90d' },
      );
      const base = this.getPublicApiBase();
      return `${base}/api/v1/storage/public/stream?token=${encodeURIComponent(token)}`;
    }
    if (!this.s3) {
      throw new BadRequestException('Storage indisponível');
    }
    const command = new GetObjectCommand({
      Bucket: file.s3Bucket,
      Key: file.s3Key,
    });
    return getSignedUrl(this.s3, command, { expiresIn: 3600 });
  }

  async resolveStreamFromToken(token: string): Promise<{ file: FileAttachment; absolutePath: string }> {
    let payload: { typ?: string; sub?: string; tid?: string };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token de arquivo inválido ou expirado');
    }
    if (payload.typ !== 'storage_file' || !payload.sub || !payload.tid) {
      throw new UnauthorizedException('Token de arquivo inválido');
    }
    const file = await this.fileRepo.findOne({ where: { id: payload.sub, tenantId: payload.tid } });
    if (!file || file.s3Bucket !== LOCAL_BUCKET) {
      throw new NotFoundException('Arquivo não encontrado');
    }
    const absolutePath = path.join(this.localRoot, file.s3Key);
    if (!existsSync(absolutePath)) {
      throw new NotFoundException('Arquivo não encontrado no disco');
    }
    return { file, absolutePath };
  }

  createReadStreamForPath(absolutePath: string) {
    return createReadStream(absolutePath);
  }

  async getPresignedUrl(fileId: string, tenantId: string, expiresIn = 3600): Promise<string> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, tenantId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');
    if (file.s3Bucket === LOCAL_BUCKET) {
      return this.buildReadUrl(file);
    }
    if (!this.s3) throw new BadRequestException('Storage S3 não configurado');
    const command = new GetObjectCommand({
      Bucket: file.s3Bucket,
      Key: file.s3Key,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }

  async delete(fileId: string, tenantId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId, tenantId } });
    if (!file) throw new NotFoundException('Arquivo não encontrado');

    if (file.s3Bucket === LOCAL_BUCKET) {
      const fullPath = path.join(this.localRoot, file.s3Key);
      try {
        await fs.unlink(fullPath);
      } catch {
        this.logger.warn(`Falha ao remover arquivo local: ${fullPath}`);
      }
    } else if (this.s3) {
      await this.s3.send(
        new DeleteObjectCommand({
          Bucket: file.s3Bucket,
          Key: file.s3Key,
        }),
      );
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
