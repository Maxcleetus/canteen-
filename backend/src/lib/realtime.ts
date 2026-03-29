import type { Server } from 'socket.io';

let realtimeServer: Server | null = null;

export const setRealtimeServer = (server: Server) => {
  realtimeServer = server;
};

export const emitRealtime = (event: string, payload: unknown) => {
  realtimeServer?.emit(event, payload);
};

export const hasRealtimeServer = () => realtimeServer !== null;
