import React, { useState } from 'react';
import { useStripe, useElements, PaymentElement } from '@stripe/react-stripe-js';
import { placeOrder } from '../api';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from './ToastProvider';

const CheckoutForm = ({ order, onSuccess }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState(null);
  const [processing, setProcessing] = useState(false);
  const toast = useToast();

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) return;

    setProcessing(true);
    setError(null);

    try {
      // confirmPayment method from Stripe triggers the PaymentElement flow
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message);
        setProcessing(false);
        return;
      }

      const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: window.location.href,
        },
        redirect: 'if_required'
      });

      if (stripeError) {
        setError(stripeError.message);
        setProcessing(false);
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        const fullPayload = { ...order, paymentIntentId: paymentIntent.id };
        const finalOrder = await placeOrder(fullPayload);
        toast.success('Payment successful', `Order #${finalOrder.orderNo} has been placed.`);
        onSuccess(finalOrder);
      }
    } catch (err) {
      console.error(err);
      setError('An error occurred during checkout.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-6">
      <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50">
        <div className="mb-4 flex items-center justify-between text-slate-300 font-bold">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-green-400" />
            Payment Information
          </div>
        </div>
        
        {/* PaymentElement natively handles GPay, Apple Pay, UPI, Cards based on config */}
        <PaymentElement options={{ layout: 'tabs' }} />
        
        {error && <div className="text-red-400 text-sm mt-4 bg-red-500/10 p-2 rounded-lg">{error}</div>}
      </div>

      <button 
        type="submit" 
        disabled={!stripe || processing}
        className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(34,197,94,0.3)]"
      >
        {processing ? (
          <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processing Payment...</>
        ) : (
          `Pay ₹${order.total + Math.round(order.total * 0.05)}`
        )}
      </button>
    </form>
  );
};

export default CheckoutForm;
