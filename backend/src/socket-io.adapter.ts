import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

/**
 * Timeouts e CORS alinhados ao HTTP — proxies (Fly, CDN) costumam cortar WS
 * se o ping for curto ou se o upgrade falhar antes do fallback.
 */
function mergedCorsOrigins(): string[] | true {
  const isProd = process.env.NODE_ENV === 'production';
  const defaults = [
    'https://app.maginf.com.br',
    'https://www.app.maginf.com.br',
    'https://miconecta-frontend.fly.dev',
  ];
  const fromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
  if (!isProd && !fromEnv.length) return true;
  return [...new Set([...defaults, ...fromEnv, ...(isProd ? [] : ['http://localhost:3000'])])];
}

export class AppSocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    const originOpt = mergedCorsOrigins();
    const merged = {
      ...(options || {}),
      path: options?.path ?? '/socket.io',
      cors: {
        origin: originOpt === true ? true : originOpt,
        methods: ['GET', 'POST', 'OPTIONS'],
        credentials: true,
      },
      connectTimeout: 60_000,
      pingTimeout: 120_000,
      pingInterval: 20_000,
      maxHttpBufferSize: 1e7,
      perMessageDeflate: false,
      transports: ['polling', 'websocket'],
    } as ServerOptions;

    return super.createIOServer(port, merged);
  }
}
