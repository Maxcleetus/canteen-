import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import ordersRoutes from './routes/orders.routes';
import paymentRoutes from './routes/payment.routes';
import { applyCorsHeaders, isAllowedOrigin } from './lib/cors';

const app = express();

app.use((req, res, next) => {
  applyCorsHeaders(req.headers.origin, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({
    name: 'canteen-management-api',
    status: 'ok'
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    runtime: process.env.VERCEL ? 'vercel' : 'node'
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/payment', paymentRoutes);

export default app;
