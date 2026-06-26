import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import Redis from 'ioredis';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: 'signals',
})
export class SignalsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;
  private logger: Logger = new Logger('SignalsGateway');
  private subscriber: Redis;

  afterInit(server: Server) {
    this.logger.log('Signals WebSocket Gateway initialized');

    this.subscriber = new Redis({
      host: process.env.REDIS_HOST || 'redis',
      port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    });

    this.subscriber.subscribe('backtest:progress');
    this.subscriber.on('message', (channel, message) => {
      if (channel === 'backtest:progress' && this.server) {
        try {
          const data = JSON.parse(message);
          this.server.emit('BACKTEST_PROGRESS', data);
        } catch {}
      }
    });
  }

  handleConnection(client: Socket, ...args: any[]) {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  broadcastSignal(signal: any) {
    if (this.server) {
      this.server.emit('NEW_SIGNAL', signal);
    }
  }

  broadcastBacktestProgress(strategyId: number, progress: number, stage: string) {
    if (this.server) {
      this.server.emit('BACKTEST_PROGRESS', { strategyId, progress, stage });
    }
  }

  @OnEvent('liquidation.detected')
  handleLiquidationEvent(payload: any) {
    if (this.server) {
      this.server.emit('LIQUIDATION', payload);
    }
  }
}
