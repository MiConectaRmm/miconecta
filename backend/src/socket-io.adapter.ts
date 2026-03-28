import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';

/**
 * Timeouts e CORS alinhados ao HTTP — proxies (Fly, CDN) costumam cortar WS
 * se o ping for curto ou se o upgrade falhar antes do fallback.
 */
export class AppSocketIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    const corsRaw = process.env.CORS_ORIGIN || '';
    const origins = corsRaw.split(',').map((o) => o.trim()).filter(Boolean);
    const merged = {
      ...(options || {}),
      path: options?.path ?? '/socket.io',
      cors: {
        origin: origins.length ? origins : true,
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
