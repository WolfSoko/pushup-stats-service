import { Logger } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Server } from 'socket.io';

@WebSocketGateway({
  // must match the client option: { path: '/socket.io' }
  path: '/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class PushupLiveGateway {
  private readonly logger = new Logger(PushupLiveGateway.name);

  @WebSocketServer()
  server!: Server;

  emitPushupsChanged() {
    this.logger.debug('emit pushups:changed');
    this.server.emit('pushups:changed');
  }
}
