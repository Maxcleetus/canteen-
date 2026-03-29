import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app';
import { setRealtimeServer } from './lib/realtime';

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

setRealtimeServer(io);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
