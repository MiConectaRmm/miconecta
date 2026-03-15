import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const tecnico = await this.authService.validarToken(payload);
    if (!tecnico) {
      throw new UnauthorizedException();
    }
    return {
      id: tecnico.id,
      email: tecnico.email,
      nome: tecnico.nome,
      funcao: tecnico.funcao,
      tenantId: tecnico.tenantId,
    };
  }
}
