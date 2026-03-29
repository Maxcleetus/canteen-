import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes';
import menuRoutes from './routes/menu.routes';
import ordersRoutes from './routes/orders.routes';
import paymentRoutes from './routes/payment.routes';

const app = express();

app.use(cors());
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
