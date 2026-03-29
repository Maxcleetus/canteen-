import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { prisma } from '../lib/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-canteen-jwt-key';

router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;
  
  try {
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'STUDENT'
      }
    });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    // Highly secured Environment Admin check
    if (
      process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL && 
      process.env.ADMIN_PASSWORD && password === process.env.ADMIN_PASSWORD
    ) {
      const token = jwt.sign({ id: 'admin-env-id', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '7d' });
      return res.json({ token, user: { id: 'admin-env-id', email: process.env.ADMIN_EMAIL, name: 'System Admin', role: 'ADMIN' } });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user!.id === 'admin-env-id' && req.user!.role === 'ADMIN') {
      return res.json({ user: { id: 'admin-env-id', email: process.env.ADMIN_EMAIL, name: 'System Admin', role: 'ADMIN' } });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

export default router;
