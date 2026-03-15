import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Headers, UseGuards, Req,
  UseInterceptors, UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SoftwareService } from './software.service';
import { diskStorage } from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { extname } from 'path';

const uploadConfig = {
  storage: diskStorage({
    destination: './uploads/packages',
    filename: (_req: any, file: any, cb: any) => {
      const nome = `${uuidv4()}${extname(file.originalname)}`;
      cb(null, nome);
    },
  }),
  limits: { fileSize: 524288000 }, // 500MB
};

@ApiTags('software')
@Controller('software')
export class SoftwareController {
  constructor(private readonly service: SoftwareService) {}

  // === Pacotes ===

  @Post('packages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('arquivo', uploadConfig))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload de pacote de software' })
  async uploadPacote(
    @UploadedFile() arquivo: any,
    @Body() dados: any,
    @Req() req: any,
  ) {
    return this.service.criarPacote({
      ...dados,
      tenantId: req.user.tenantId,
      arquivoPath: arquivo.path,
      arquivoNome: arquivo.originalname,
      arquivoTamanho: arquivo.size,
    });
  }

  @Get('packages')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar pacotes de software' })
  listarPacotes(@Req() req: any) {
    return this.service.listarPacotes(req.user.tenantId);
  }

  @Get('packages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Buscar pacote por ID' })
  buscarPacote(@Param('id') id: string) {
    return this.service.buscarPacote(id);
  }

  @Delete('packages/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Remover pacote' })
  removerPacote(@Param('id') id: string) {
    return this.service.removerPacote(id);
  }

  // === Deploys ===

  @Post('deploy')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Criar deploy de software' })
  criarDeploy(
    @Body() body: { packageId: string; deviceIds: string[] },
    @Req() req: any,
  ) {
    return this.service.criarDeploy(body.packageId, body.deviceIds, req.user.nome);
  }

  @Get('deploys')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar deploys' })
  listarDeploys(@Req() req: any) {
    return this.service.listarDeploys(req.user.tenantId);
  }

  // === Endpoints do agente ===

  @Get('agent/pendentes')
  @ApiOperation({ summary: 'Obter deploys pendentes (agente)' })
  pendentes(@Headers('x-device-id') deviceId: string) {
    return this.service.deploysPendentes(deviceId);
  }

  @Post('agent/resultado/:deployId')
  @ApiOperation({ summary: 'Reportar resultado do deploy (agente)' })
  resultado(@Param('deployId') deployId: string, @Body() resultado: any) {
    return this.service.atualizarDeploy(deployId, resultado);
  }
}
