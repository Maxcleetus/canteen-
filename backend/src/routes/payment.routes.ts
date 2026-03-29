import { Router } from 'express';
import { authenticate, AuthRequest } from '../middlewares/auth';
import Stripe from 'stripe';
import { prisma } from '../lib/prisma';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

router.get('/config', (_req, res) => {
  if (!process.env.STRIPE_PUBLISHABLE_KEY) {
    return res.status(503).json({
      error: 'Stripe checkout is not configured on the server.'
    });
  }

  return res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
});

router.post('/create-payment-intent', authenticate, async (req: AuthRequest, res) => {
  const { items } = req.body;

  try {
    // Calculate total securely on backend
    let total = 0;
    for (const item of items) {
      const dbItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
      if (dbItem) total += dbItem.price * item.quantity;
    }
    const finalTotal = total + Math.round(total * 0.05);

    // Create payment intent
    const stripeAmount = Math.max(Math.round(finalTotal * 100), 5000); // 5000 paise = 50 INR minimum for Stripe API
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmount, // Convert to cents
      currency: 'inr',
      automatic_payment_methods: { enabled: true },
      description: `Canteen Checkout`,
      shipping: {
        name: 'Student',
        address: {
          line1: 'RIT Campus',
          city: 'Kottayam',
          state: 'KL',
          country: 'IN',
          postal_code: '686501'
        }
      },
      metadata: {
        userId: req.user!.id
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id
    });
  } catch (error) {
    console.error('Payment intent creation failed:', error);
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
});

router.post('/confirm-payment', authenticate, async (req: AuthRequest, res) => {
  const { paymentIntentId, orderId } = req.body;

  try {
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      // Update order status to paid
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAID' }
      });

      res.json({ success: true, message: 'Payment confirmed' });
    } else {
      res.status(400).json({ error: 'Payment not completed' });
    }
  } catch (error) {
    console.error('Payment confirmation failed:', error);
    res.status(500).json({ error: 'Failed to confirm payment' });
  }
});

export default router;
