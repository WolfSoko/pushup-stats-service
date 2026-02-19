import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Socket, Server } from 'socket.io';
import { PushupDbService } from '../pushups/pushup-db.service';

@WebSocketGateway({
  // must match the client option: { path: '/socket.io' }
  path: '/socket.io',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class PushupLiveGateway implements OnGatewayConnection {
  private readonly logger = new Logger(PushupLiveGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly db: PushupDbService) {}

  async handleConnection(client: Socket) {
    this.logger.debug(`client connected: ${client.id}`);
    const rows = await this.db.findAll();
    client.emit('pushups:initial', rows);
  }

  async emitPushupsChanged() {
    this.logger.debug('emit pushups:changed');
    const rows = await this.db.findAll();
    this.server.emit('pushups:changed', rows);
  }
}
