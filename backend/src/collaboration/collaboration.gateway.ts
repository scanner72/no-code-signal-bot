import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: { origin: '*' } })
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('join-strategy')
  handleJoinStrategy(@ConnectedSocket() client: Socket, @MessageBody() data: { strategyId: string }) {
    const room = `strategy-${data.strategyId}`;
    client.join(room);
    console.log(`Client ${client.id} joined room ${room}`);
    return { event: 'joined', data: { room } };
  }

  @SubscribeMessage('leave-strategy')
  handleLeaveStrategy(@ConnectedSocket() client: Socket, @MessageBody() data: { strategyId: string }) {
    const room = `strategy-${data.strategyId}`;
    client.leave(room);
    console.log(`Client ${client.id} left room ${room}`);
  }

  @SubscribeMessage('node-change')
  handleNodeChange(@ConnectedSocket() client: Socket, @MessageBody() data: { strategyId: string; changes: any }) {
    const room = `strategy-${data.strategyId}`;
    client.to(room).emit('node-change', data.changes);
  }

  @SubscribeMessage('edge-change')
  handleEdgeChange(@ConnectedSocket() client: Socket, @MessageBody() data: { strategyId: string; changes: any }) {
    const room = `strategy-${data.strategyId}`;
    client.to(room).emit('edge-change', data.changes);
  }

  @SubscribeMessage('cursor-move')
  handleCursorMove(@ConnectedSocket() client: Socket, @MessageBody() data: { strategyId: string; position: { x: number; y: number }; user: any }) {
    const room = `strategy-${data.strategyId}`;
    client.to(room).emit('cursor-move', { clientId: client.id, position: data.position, user: data.user });
  }
}
