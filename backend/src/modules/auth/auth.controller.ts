import { Controller, Post, Body, Req, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Request } from 'express';

@ApiTags('autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Autenticar técnico' })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    const ip = req.ip || req.headers['x-forwarded-for']?.toString();
    return this.authService.login(dto, ip);
  }

  @Post('register')
  @ApiOperation({ summary: 'Registrar novo técnico' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('bootstrap')
  @ApiOperation({ summary: 'Criar tenant + admin inicial (remover após uso)' })
  async bootstrap() {
    return this.authService.bootstrap();
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obter dados do técnico autenticado' })
  async me(@Req() req: any) {
    return req.user;
  }
}
