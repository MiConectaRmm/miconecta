import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upload de arquivo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
  ) {
    if (!file?.buffer) {
      throw new BadRequestException(
        'Arquivo ausente ou inválido. Envie o campo multipart "file" (Content-Type com boundary).',
      );
    }
    if (!entidadeTipo || !entidadeId) {
      throw new BadRequestException('entidadeTipo e entidadeId são obrigatórios');
    }
    const tenantId = req.tenantId || req.user.tenantId;
    return this.storageService.upload({
      tenantId,
      entidadeTipo,
      entidadeId,
      nomeOriginal: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
      uploadedPorTipo: req.user.userType || 'technician',
      uploadedPorId: req.user.sub,
      uploadedPorNome: req.user.nome,
    });
  }

  /** Leitura via token JWT na query (avatars em img sem Bearer). */
  @Get('public/stream')
  @ApiOperation({ summary: 'Download de arquivo local via token (avatar, etc.)' })
  async streamPublic(@Query('token') token: string, @Res() res: Response) {
    if (!token) {
      throw new BadRequestException('token é obrigatório');
    }
    const { file, absolutePath } = await this.storageService.resolveStreamFromToken(token);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    const stream = this.storageService.createReadStreamForPath(absolutePath);
    stream.pipe(res);
  }

  @Get(':id/url')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter URL assinada para download' })
  async getUrl(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const url = await this.storageService.getPresignedUrl(id, tenantId);
    return { url };
  }

  @Get('entidade/:tipo/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar arquivos de uma entidade' })
  async listarPorEntidade(
    @Req() req: any,
    @Param('tipo') tipo: string,
    @Param('id') id: string,
  ) {
    const tenantId = req.tenantId || req.user.tenantId;
    return this.storageService.listarPorEntidade(tenantId, tipo, id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Excluir arquivo' })
  async delete(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    await this.storageService.delete(id, tenantId);
    return { message: 'Arquivo excluído' };
  }
}
