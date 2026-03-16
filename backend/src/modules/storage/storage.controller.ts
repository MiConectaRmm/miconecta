import {
  Controller, Get, Post, Delete, Param, Query,
  UseGuards, UseInterceptors, UploadedFile, Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StorageService } from './storage.service';

@ApiTags('Storage')
@Controller('storage')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload de arquivo' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @Req() req: any,
    @UploadedFile() file: any,
    @Query('entidadeTipo') entidadeTipo: string,
    @Query('entidadeId') entidadeId: string,
  ) {
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

  @Get(':id/url')
  @ApiOperation({ summary: 'Obter URL assinada para download' })
  async getUrl(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    const url = await this.storageService.getPresignedUrl(id, tenantId);
    return { url };
  }

  @Get('entidade/:tipo/:id')
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
  @ApiOperation({ summary: 'Excluir arquivo' })
  async delete(@Req() req: any, @Param('id') id: string) {
    const tenantId = req.tenantId || req.user.tenantId;
    await this.storageService.delete(id, tenantId);
    return { message: 'Arquivo excluído' };
  }
}
