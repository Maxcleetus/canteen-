import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence, useMotionValue, useMotionTemplate } from 'framer-motion';
import { Coffee, ShoppingCart, User, Search, Clock, Plus, Minus, ChevronRight, Mic, Flame, Sparkles, ArrowLeft, History, Loader2 } from 'lucide-react';
import { fetchMenu, fetchMyOrders, fetchCanteenOverview, createPaymentIntent, fetchPaymentConfig } from '../api';
import { io } from 'socket.io-client';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import CheckoutForm from './CheckoutForm';
import { REALTIME_ENABLED, SOCKET_URL } from '../config';
import { useToast } from './ToastProvider';

const NeonCard = ({ children, className, ...props }) => {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleMouseMove = ({ currentTarget, clientX, clientY }) => {
    const { left, top } = currentTarget.getBoundingClientRect();
    mouseX.set(clientX - left);
    mouseY.set(clientY - top);
  };

  return (
    <motion.div
      className={`relative group overflow-hidden ${className}`}
      onMouseMove={handleMouseMove}
      {...props}
    >
      <motion.div
        className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition duration-300 group-hover:opacity-100 mix-blend-screen"
        style={{
          background: useMotionTemplate`
            radial-gradient(
              400px circle at ${mouseX}px ${mouseY}px,
              rgba(34, 197, 94, 0.4),
              transparent 80%
            )
          `,
        }}
      />
      {children}
    </motion.div>
  );
};

const getCalories = (id) => {
  const hash = String(id).split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a }, 0);
  return Math.abs(hash) % 400 + 150;
};

const EMPTY_CANTEEN_OVERVIEW = {
  activeOrdersCount: 0,
  totalItemsInQueue: 0,
  averageWaitMinutes: 0,
  statusCounts: {
    pending: 0,
    paid: 0,
    preparing: 0,
    ready: 0
  },
  activeOrders: []
};

const getErrorMessage = (error, fallbackMessage) =>
  error?.response?.data?.error || error?.message || fallbackMessage;

const StudentPortal = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('menu');
  const [ordersSubTab, setOrdersSubTab] = useState('active');
  const [menuItems, setMenuItems] = useState([]);
  const [cart, setCart] = useState({});
  const [myOrders, setMyOrders] = useState([]);
  const [canteenOverview, setCanteenOverview] = useState(EMPTY_CANTEEN_OVERVIEW);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isListening, setIsListening] = useState(false);

  // New states for PaymentElement integration
  const [checkoutState, setCheckoutState] = useState({ clientSecret: null, order: null });
  const [isInitializingCheckout, setIsInitializingCheckout] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);
  const [isLoadingStripeConfig, setIsLoadingStripeConfig] = useState(false);
  const toast = useToast();

  const loadStripeClient = async ({ notifyOnFailure = false } = {}) => {
    if (stripePromise) {
      return stripePromise;
    }

    if (isLoadingStripeConfig) {
      return null;
    }

    setIsLoadingStripeConfig(true);

    try {
      const { publishableKey } = await fetchPaymentConfig();

      if (!publishableKey) {
        throw new Error('Secure checkout is not configured yet.');
      }

      const nextStripePromise = loadStripe(publishableKey);
      setStripePromise(nextStripePromise);
      return nextStripePromise;
    } catch (error) {
      console.error('Failed to load Stripe config:', error);

      if (notifyOnFailure) {
        toast.error(
          'Checkout unavailable',
          getErrorMessage(error, 'Secure checkout is not available right now.')
        );
      }

      return null;
    } finally {
      setIsLoadingStripeConfig(false);
    }
  };

  const loadCanteenOverview = async () => {
    try {
      const overview = await fetchCanteenOverview();
      setCanteenOverview(overview);
    } catch (err) {
      console.error('Failed to fetch canteen overview:', err);
    }
  };

  const loadPortalData = async (showLoader = false) => {
    if (showLoader) {
      setIsLoading(true);
    }

    try {
      const [menuData, ordersData, overview] = await Promise.all([
        fetchMenu(),
        fetchMyOrders(),
        fetchCanteenOverview()
      ]);
      const enhancedMenu = menuData.map(item => ({ ...item, calories: getCalories(item.id) }));
      setMenuItems(enhancedMenu);
      setMyOrders(ordersData);
      setCanteenOverview(overview);
    } catch (err) {
      console.error('Failed to load portal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPortalData(true);

    if (!REALTIME_ENABLED) {
      const intervalId = window.setInterval(() => {
        loadPortalData();
      }, 15000);

      return () => window.clearInterval(intervalId);
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    socket.on('new-order', () => {
      loadCanteenOverview();
    });
    socket.on('order-updated', (updatedOrder) => {
      loadCanteenOverview();
      if (updatedOrder.userId === user.id) {
        setMyOrders(prev => {
          const exists = prev.find(o => o.id === updatedOrder.id);
          if (exists) return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
          return [updatedOrder, ...prev];
        });
      }
    });

    return () => socket.disconnect();
  }, [user.id]);

  const updateCart = (item, delta) => {
    setCart(prev => {
      const current = prev[item.id]?.quantity || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [item.id]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [item.id]: { item, quantity: next } };
    });
  };

  const handleVoiceSearch = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.info('Voice search unavailable', 'This browser does not support speech recognition.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
    };

    recognition.start();
  };

  const cartItemsArray = Object.values(cart);
  const cartTotal = cartItemsArray.reduce((acc, curr) => acc + (curr.item.price * curr.quantity), 0);
  const cartCalories = cartItemsArray.reduce((acc, curr) => acc + (curr.item.calories * curr.quantity), 0);
  const CALORIE_GOAL = 2000;
  const caloriePercentage = Math.min((cartCalories / CALORIE_GOAL) * 100, 100);

  const handleProceedToCheckout = async () => {
    if (cartItemsArray.length === 0) return;
    setIsInitializingCheckout(true);
    
    try {
      const resolvedStripePromise = stripePromise || await loadStripeClient({ notifyOnFailure: true });
      if (!resolvedStripePromise) {
        return;
      }

      const itemsPayload = cartItemsArray.map(c => ({ menuItemId: c.item.id, quantity: c.quantity }));
      
      const { clientSecret } = await createPaymentIntent(itemsPayload);
      
      const orderPayload = {
        type: 'TAKEAWAY',
        total: cartTotal,
        items: itemsPayload
      };
      
      setStripePromise(resolvedStripePromise);
      setCheckoutState({ clientSecret, order: orderPayload });
      setActiveTab('checkout');
    } catch (err) {
      console.error(err);
      toast.error(
        'Checkout failed to start',
        getErrorMessage(err, 'Failed to initialize secure checkout. Please try again.')
      );
    } finally {
      setIsInitializingCheckout(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING': return 'text-orange-400 bg-orange-400/10 border-orange-400/20 shadow-[0_0_10px_rgba(251,146,60,0.5)]';
      case 'PREPARING': return 'text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-[0_0_10px_rgba(96,165,250,0.5)]';
      case 'READY': return 'text-green-400 bg-green-400/10 border-green-400/20 shadow-[0_0_10px_rgba(74,222,128,0.5)]';
      case 'PAID': return 'text-purple-400 bg-purple-400/10 border-purple-400/20 shadow-[0_0_10px_rgba(168,85,247,0.5)]';
      case 'DELIVERED': return 'text-slate-400 bg-slate-800/80 border-slate-700/50';
      case 'CANCELED': return 'text-red-400 bg-red-900/40 border-red-500/50';
      default: return 'text-slate-400 bg-slate-800 border-slate-700';
    }
  };

  const getQueueStatusBadge = (status) => {
    switch (status) {
      case 'PENDING': return 'bg-orange-400/10 text-orange-300 border-orange-400/30';
      case 'PAID': return 'bg-purple-400/10 text-purple-300 border-purple-400/30';
      case 'PREPARING': return 'bg-blue-400/10 text-blue-300 border-blue-400/30';
      case 'READY': return 'bg-green-400/10 text-green-300 border-green-400/30';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const activeOrders = myOrders.filter(o => !['DELIVERED', 'CANCELED'].includes(o.status));
  const pastOrders = myOrders.filter(o => ['DELIVERED', 'CANCELED'].includes(o.status));
  const displayedOrders = ordersSubTab === 'active' ? activeOrders : pastOrders;

  const hour = new Date().getHours();
  const isMorning = hour < 11;
  const isLunch = hour >= 11 && hour < 15;
  
  const recommendedItems = menuItems.filter(item => {
    const isBeverage = item.category?.name?.toLowerCase().includes('beverage') || item.name.toLowerCase().includes('coffee');
    const isMeal = item.category?.name?.toLowerCase().includes('meal') || item.price > 100;
    
    if (isMorning) return isBeverage || item.price < 100;
    if (isLunch) return isMeal;
    return true;
  }).slice(0, 3);

  const filteredItems = menuItems.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()) || (item.category?.name && item.category.name.toLowerCase().includes(searchQuery.toLowerCase())));

  return (
    <div className="h-screen flex flex-col pt-4 px-4 sm:px-6 md:px-8 pb-20 md:pb-8 overflow-hidden bg-slate-950 relative">
      
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-green-500/10 rounded-full blur-[140px] -z-10 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-blue-600/10 rounded-full blur-[140px] -z-10 pointer-events-none" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] bg-purple-500/10 rounded-full blur-[120px] -z-10 pointer-events-none mix-blend-screen" />

      <header className="flex justify-between items-center py-4 mb-6 shrink-0 relative z-10 glass px-6 rounded-2xl border border-white/5 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center shadow-[0_0_20px_rgba(74,222,128,0.4)]">
            <Coffee className="w-5 h-5 text-white" />
            <div className="absolute inset-0 rounded-xl border border-white/20"></div>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white hidden sm:block">RIT<span className="text-green-400 text-shadow-glow">Eats</span></h1>
        </div>
        
        <div className="hidden md:flex items-center gap-2 bg-slate-900/50 p-1.5 rounded-xl border border-slate-800/80 shadow-inner">
          <button onClick={() => setActiveTab('menu')} className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'menu' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
            <Coffee className="w-4 h-4" /> Menu
          </button>
          <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-lg transition-colors ${activeTab === 'orders' ? 'bg-slate-700 text-white shadow-md' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
            <History className="w-4 h-4" /> Orders
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-slate-900/80 border border-slate-700/80 shadow-inner hidden lg:flex">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_10px_rgba(74,222,128,0.8)]"></div>
            <span className="text-sm font-medium text-slate-300">{user.name}</span>
          </div>
          <button onClick={onLogout} className="text-sm font-bold text-slate-400 hover:text-red-400 transition-colors">Logout</button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative z-10 w-full max-w-7xl mx-auto flex gap-6">
        
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex gap-2 p-1 bg-slate-900/60 rounded-xl mb-6 shrink-0 md:hidden border border-slate-800 backdrop-blur-md">
            <button onClick={() => setActiveTab('menu')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'menu' ? 'bg-slate-800 text-green-400 shadow-sm' : 'text-slate-400'}`}>Menu</button>
            <button onClick={() => setActiveTab('cart')} className={`flex-1 flex justify-center items-center py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'cart' ? 'bg-slate-800 text-green-400 shadow-sm' : 'text-slate-400'}`}>
              Cart {cartItemsArray.length > 0 && <span className="ml-1.5 w-5 h-5 bg-green-500 text-white rounded-full flex items-center justify-center text-[10px] shadow-[0_0_10px_rgba(34,197,94,0.5)]">{cartItemsArray.length}</span>}
            </button>
            <button onClick={() => setActiveTab('orders')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'orders' ? 'bg-slate-800 text-green-400 shadow-sm' : 'text-slate-400'}`}>Orders</button>
          </div>

          <AnimatePresence mode="wait">
            {(activeTab === 'menu' || (!['cart','orders','checkout'].includes(activeTab))) && (
              <motion.div 
                key="menu"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.4 }}
                className="flex-1 overflow-y-auto pr-2 pb-20 md:pb-0 custom-scrollbar"
              >
                <div className="mb-6 sticky top-0 z-20 pt-1">
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-green-400 transition-colors" />
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="What are you craving? (Or tap mic)" 
                      className="w-full bg-slate-900/80 backdrop-blur-xl border border-slate-700/80 rounded-2xl pl-12 pr-12 py-4 text-white focus:ring-2 focus:ring-green-500/50 focus:border-green-500/50 outline-none shadow-2xl transition-all" 
                    />
                    <button 
                      onClick={handleVoiceSearch}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full transition-all ${isListening ? 'bg-red-500/20 text-red-500 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-slate-800 text-slate-400 hover:text-green-400 hover:bg-slate-700'}`}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {isLoading ? (
                  <div className="flex justify-center items-center h-40"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div></div>
                ) : (
                  <>
                    <div className="mb-8">
                      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 mb-4">
                        <div>
                          <h2 className="text-lg font-bold text-white">Live Canteen Queue</h2>
                          <p className="text-sm text-slate-400 mt-1">Students can see the current active orders and how busy the canteen is right now.</p>
                        </div>
                        <div className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900/70 border border-slate-800 text-sm text-slate-300">
                          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>
                          {canteenOverview.activeOrdersCount} live orders
                        </div>
                      </div>

                      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                        <div className="glass-dark rounded-2xl border border-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-bold">Orders In Queue</p>
                          <p className="text-3xl font-black text-white mt-3">{canteenOverview.activeOrdersCount}</p>
                        </div>
                        <div className="glass-dark rounded-2xl border border-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-bold">Items Being Prepared</p>
                          <p className="text-3xl font-black text-white mt-3">{canteenOverview.totalItemsInQueue}</p>
                        </div>
                        <div className="glass-dark rounded-2xl border border-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-bold">Preparing Now</p>
                          <p className="text-3xl font-black text-blue-300 mt-3">{canteenOverview.statusCounts.preparing}</p>
                        </div>
                        <div className="glass-dark rounded-2xl border border-white/5 p-4">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-bold">Average Wait</p>
                          <p className="text-3xl font-black text-green-300 mt-3">{canteenOverview.averageWaitMinutes}m</p>
                        </div>
                      </div>

                      {canteenOverview.activeOrders.length === 0 ? (
                        <div className="glass-dark rounded-3xl border border-dashed border-white/10 px-6 py-10 text-center text-slate-400">
                          No active orders in the canteen right now.
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                          {canteenOverview.activeOrders.map((order) => (
                            <div key={order.id} className="glass-dark rounded-3xl border border-white/5 p-5">
                              <div className="flex justify-between items-start gap-4 mb-4">
                                <div>
                                  <h3 className="text-lg font-bold text-white">{order.orderNo}</h3>
                                  <p className="text-xs text-slate-500 mt-1">
                                    {order.type} {order.tableNo ? `• ${order.tableNo}` : ''}
                                  </p>
                                </div>
                                <span className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border ${getQueueStatusBadge(order.status)}`}>
                                  {order.status}
                                </span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
                                <span>{order.quantityTotal} items</span>
                                <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <div className="space-y-2">
                                {order.items.map((item) => (
                                  <div key={`${order.id}-${item}`} className="rounded-xl bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-300">
                                    {item}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {searchQuery === '' && recommendedItems.length > 0 && (
                      <div className="mb-8">
                        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-purple-400" />
                          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-green-400">
                            AI-Curated {isMorning ? 'Breakfast' : isLunch ? 'Lunch' : 'Evening'} Picks
                          </span>
                        </h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                          {recommendedItems.map(item => (
                            <NeonCard key={`rec-${item.id}`} className="glass-dark rounded-2xl border border-purple-500/20 shadow-[0_4px_20px_rgba(168,85,247,0.1)]">
                              <div className="h-32 relative overflow-hidden bg-slate-800">
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded border border-purple-500/30 text-xs font-bold text-white shadow-lg">
                                  ₹{item.price}
                                </div>
                                <div className="absolute top-2 right-2 px-2 py-1 bg-slate-900/80 backdrop-blur border border-orange-500/30 rounded text-[10px] font-bold text-orange-400 flex items-center">
                                  <Flame className="w-3 h-3 mr-1" /> {item.calories} kcal
                                </div>
                              </div>
                              <div className="p-4 flex flex-col flex-1">
                                <h3 className="font-bold text-base text-white mb-2 group-hover:text-purple-400 transition-colors">{item.name}</h3>
                                <div className="mt-auto flex justify-end">
                                  <button onClick={() => updateCart(item, 1)} className="px-4 py-2 bg-gradient-to-r from-purple-500/20 to-green-500/20 hover:from-purple-500/40 hover:to-green-500/40 border border-white/10 text-white text-xs font-bold rounded-lg transition-all flex items-center">
                                    Quick Add <Plus className="w-3 h-3 ml-1" />
                                  </button>
                                </div>
                              </div>
                            </NeonCard>
                          ))}
                        </div>
                      </div>
                    )}

                    <h2 className="text-lg font-bold text-slate-300 mb-4 flex items-center gap-2">
                      Full Menu
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                      {filteredItems.map(item => (
                        <NeonCard 
                          key={item.id} 
                          className="glass-dark rounded-2xl flex flex-col border border-white/5"
                        >
                          <div className="h-40 relative overflow-hidden bg-slate-800">
                            <img src={item.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80'} alt={item.name} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700" />
                            <div className="absolute top-3 left-3 px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-xs font-bold text-white shadow-lg">
                              ₹{item.price}
                            </div>
                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg border border-orange-500/20 text-xs font-medium text-orange-300 flex items-center">
                              <Flame className="w-3 h-3 mr-1" /> {item.calories}
                            </div>
                            {item.status === 'LOW_STOCK' && (
                              <div className="absolute top-3 right-3 px-2 py-1 bg-orange-500/80 backdrop-blur-md rounded text-[10px] font-bold text-white shadow-[0_0_10px_rgba(249,115,22,0.5)]">LOW STOCK</div>
                            )}
                          </div>
                          <div className="p-4 flex flex-col flex-1 z-10">
                            <h3 className="font-bold text-lg text-white mb-1 group-hover:text-green-400 transition-colors">{item.name}</h3>
                            <p className="text-slate-400 text-sm flex-1">{item.description || item.category?.name}</p>
                            
                            <div className="mt-4 flex items-center justify-between">
                              <span className="text-xs text-slate-500 flex items-center"><Clock className="w-3 h-3 mr-1"/> 10-15m</span>
                              
                              {cart[item.id] ? (
                                <div className="flex items-center gap-3 bg-slate-800/80 backdrop-blur border border-slate-700 rounded-lg p-1 shadow-inner">
                                  <button onClick={() => updateCart(item, -1)} className="w-7 h-7 flex items-center justify-center bg-slate-700 hover:bg-slate-600 rounded-md text-white transition-colors"><Minus className="w-4 h-4" /></button>
                                  <span className="font-bold text-sm min-w-[1ch] text-center text-green-400">{cart[item.id].quantity}</span>
                                  <button onClick={() => updateCart(item, 1)} className="w-7 h-7 flex items-center justify-center bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-md transition-colors"><Plus className="w-4 h-4" /></button>
                                </div>
                              ) : (
                                <button 
                                  onClick={() => updateCart(item, 1)}
                                  className="px-4 py-2 bg-slate-800/50 hover:bg-green-500/20 hover:text-green-400 border border-slate-700 hover:border-green-500/50 text-white text-sm font-medium rounded-lg transition-all flex items-center group-hover:shadow-[0_0_15px_rgba(34,197,94,0.2)]"
                                >
                                  Add <Plus className="w-4 h-4 ml-1 opacity-50 group-hover:opacity-100" />
                                </button>
                              )}
                            </div>
                          </div>
                        </NeonCard>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}

            {activeTab === 'orders' && (
              <motion.div 
                key="orders"
                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.4 }}
                className="flex-1 overflow-y-auto pr-2 pb-20 md:pb-0 custom-scrollbar"
              >
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                  <div className="flex items-center gap-3">
                     <button onClick={() => setActiveTab('menu')} className="p-2 bg-slate-800/80 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors shadow-lg shadow-black/20 border border-slate-700/50">
                       <ArrowLeft className="w-5 h-5" />
                     </button>
                     <h2 className="text-2xl font-bold text-white">Your Orders</h2>
                  </div>
                  <div className="flex bg-slate-900/60 p-1 rounded-xl border border-slate-800 w-full sm:w-auto">
                    <button onClick={() => setOrdersSubTab('active')} className={`flex-1 sm:flex-none py-2 px-6 text-sm font-bold rounded-lg transition-colors ${ordersSubTab === 'active' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}>Active</button>
                    <button onClick={() => setOrdersSubTab('history')} className={`flex-1 sm:flex-none py-2 px-6 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${ordersSubTab === 'history' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'}`}><History className="w-4 h-4"/> History</button>
                  </div>
                </div>

                <div className="space-y-4">
                  {displayedOrders.length === 0 ? (
                    <div className="text-center py-20 bg-slate-900/30 rounded-3xl border border-slate-800/50 border-dashed backdrop-blur-sm">
                      <Clock className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-400">No {ordersSubTab} orders.</p>
                      <button onClick={() => setActiveTab('menu')} className="mt-4 text-green-400 hover:text-green-300 hover:shadow-[0_0_10px_rgba(74,222,128,0.3)] transition-all font-medium py-2 px-4 rounded-xl border border-green-500/20 bg-green-500/10">Browse Menu</button>
                    </div>
                  ) : (
                    displayedOrders.map(order => (
                      <motion.div layout key={order.id} className={`glass-dark p-6 rounded-3xl group transition-all border relative overflow-hidden ${order.status === 'DELIVERED' ? 'border-slate-800 opacity-80' : 'border-white/5 hover:border-white/10'}`}>
                        {order.status === 'PREPARING' && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 bg-[length:200%_auto] animate-gradient" />}
                        {order.status === 'READY' && <div className="absolute inset-0 bg-green-500/5 animate-pulse rounded-3xl pointer-events-none" />}
                        {order.status === 'DELIVERED' && <div className="absolute top-0 left-0 w-full h-1 bg-slate-700" />}
                        
                        <div className="flex justify-between items-start mb-4 relative z-10">
                          <div>
                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border mb-2 ${getStatusColor(order.status)}`}>
                              {order.status === 'PREPARING' && <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-1.5 animate-pulse inline-block shadow-[0_0_5px_rgba(96,165,250,1)]"></span>}
                              {order.status === 'READY' && <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse inline-block shadow-[0_0_5px_rgba(74,222,128,1)]"></span>}
                              {order.status}
                            </span>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              {order.orderNo}
                            </h3>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-400">₹{order.total}</p>
                            <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleDateString()} {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>
                        </div>
                        
                        <div className="space-y-2 mb-4 relative z-10">
                          {order.items?.map((item, i) => (
                            <div key={i} className="flex justify-between text-sm bg-slate-900/40 p-2 rounded-lg">
                              <span className="text-slate-300"><span className="text-green-500 mr-2 font-bold">{item.quantity}x</span>{item.menuItem?.name || 'Item'}</span>
                              <span className="text-slate-400">₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                        </div>

                        {ordersSubTab === 'active' && (
                          <div className="mt-6 pt-4 border-t border-slate-700/50 relative z-10">
                            <div className="flex justify-between text-xs font-medium text-slate-500 mb-2">
                              <span className={['PENDING','PAID','PREPARING','READY'].includes(order.status) ? 'text-white' : ''}>Received</span>
                              <span className={['PREPARING','READY'].includes(order.status) ? 'text-white' : ''}>Preparing</span>
                              <span className={['READY'].includes(order.status) ? 'text-white' : ''}>Ready</span>
                            </div>
                            <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner relative">
                              <motion.div 
                                className="absolute top-0 left-0 h-full bg-gradient-to-r from-purple-500 via-blue-500 to-green-500 shadow-[0_0_10px_rgba(74,222,128,0.8)]"
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: ['PENDING','PAID'].includes(order.status) ? '33%' : 
                                         order.status === 'PREPARING' ? '66%' : 
                                         order.status === 'READY' ? '100%' : '0%' 
                                }}
                                transition={{ duration: 1.5, ease: 'easeOut', type: "spring" }}
                              />
                            </div>
                          </div>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              </motion.div>
            )}

            {/* Checkout Form View */}
            {activeTab === 'checkout' && checkoutState.clientSecret && stripePromise && (
              <motion.div 
                 key="checkout"
                 initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                 className="flex-1 overflow-y-auto pb-20 custom-scrollbar"
              >
                <div className="max-w-xl mx-auto mt-4">
                  <button onClick={() => setActiveTab('cart')} className="mb-6 flex items-center text-slate-400 hover:text-white hover:bg-slate-800 px-4 py-2 rounded-xl transition-colors border border-transparent hover:border-slate-700">
                    <ArrowLeft className="w-5 h-5 mr-2" /> Back to Cart
                  </button>
                  <div className="glass-dark p-8 rounded-3xl border border-slate-700 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[50px] pointer-events-none" />
                    <h2 className="text-2xl font-bold text-white mb-2 relative z-10">Secure Checkout</h2>
                    <p className="text-slate-400 mb-6 text-sm relative z-10">Select your preferred payment method below</p>
                    
                    <div className="relative z-10">
                      <Elements stripe={stripePromise} options={{ 
                        clientSecret: checkoutState.clientSecret,
                        appearance: { theme: 'night', variables: { colorPrimary: '#22c55e', colorBackground: '#0f172a', colorDanger: '#ef4444' } }
                      }}>
                        <CheckoutForm 
                          order={checkoutState.order}
                          onSuccess={(orderResponse) => {
                            setCart({});
                            setCheckoutState({ clientSecret: null, order: null });
                            setMyOrders(prev => [orderResponse, ...prev]);
                            loadCanteenOverview();
                            setActiveTab('orders');
                          }} 
                        />
                      </Elements>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
            
            {activeTab === 'cart' && (
              <motion.div 
                key="cartm"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex-1 overflow-y-auto pb-20 md:hidden"
              >
                <button onClick={() => setActiveTab('menu')} className="m-4 mb-2 flex items-center text-slate-400 hover:text-white px-2 py-2 rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5 mr-2" /> Back to Menu
                </button>
                <MobileCart cartItemsArray={cartItemsArray} cartTotal={cartTotal} updateCart={updateCart} onCheckout={handleProceedToCheckout} isInitializingCheckout={isInitializingCheckout} cartCalories={cartCalories} caloriePercentage={caloriePercentage} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden md:flex w-80 lg:w-[360px] shrink-0 flex-col gap-6">
          <div className="glass-dark rounded-3xl p-6 flex flex-col h-full sticky top-0 max-h-[calc(100vh-140px)] border border-white/10 shadow-2xl relative overflow-hidden">
            <div className="absolute -top-20 -right-20 w-40 h-40 bg-green-500/20 rounded-full blur-[60px] pointer-events-none" />
            
            <h2 className="text-xl font-bold text-white mb-6 flex items-center relative z-10">
              <ShoppingCart className="w-5 h-5 mr-3 text-green-400" />
              Current Tray
            </h2>

            {cartItemsArray.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 relative z-10">
                <div className="w-16 h-16 rounded-full bg-slate-800/50 flex items-center justify-center mb-4 border border-slate-700/50 shadow-inner">
                  <ShoppingCart className="w-6 h-6 text-slate-600" />
                </div>
                <p>Your tray is empty</p>
                <p className="text-xs mt-1">Add some delicious items</p>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar relative z-10">
                  <AnimatePresence>
                    {cartItemsArray.map((c) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, x: 20 }}
                        animate={{ opacity: 1, scale: 1, x: 0 }}
                        exit={{ opacity: 0, scale: 0.8, x: 20 }}
                        transition={{ duration: 0.3 }}
                        key={c.item.id} 
                        className="flex gap-4 items-center bg-slate-900/60 p-3 rounded-2xl border border-slate-700/50 hover:border-green-500/30 transition-colors group"
                      >
                        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-800 relative">
                          <img src={c.item.image} alt={c.item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-bold text-slate-200 truncate">{c.item.name}</h4>
                          <p className="text-green-400 text-sm font-bold mt-0.5">₹{c.item.price * c.quantity}</p>
                        </div>
                        <div className="flex flex-col items-center gap-1.5 bg-slate-800/80 rounded-lg p-1 shrink-0 border border-slate-700 backdrop-blur-sm shadow-inner group-hover:border-green-500/30 transition-colors">
                          <button onClick={() => updateCart(c.item, 1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-green-400 transition-colors"><Plus className="w-3 h-3" /></button>
                          <span className="text-xs font-bold text-white w-6 text-center">{c.quantity}</span>
                          <button onClick={() => updateCart(c.item, -1)} className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-400 transition-colors"><Minus className="w-3 h-3" /></button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                <div className="mt-4 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 relative z-10 flex items-center gap-4 group hover:border-orange-500/30 transition-colors">
                  <div className="relative w-12 h-12 flex items-center justify-center shrink-0">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
                      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                        strokeDasharray={125.6} strokeDashoffset={125.6 - (125.6 * caloriePercentage) / 100}
                        className={`${caloriePercentage > 100 ? 'text-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'text-orange-500'} transition-all duration-1000`} 
                        style={{ filter: "drop-shadow(0px 0px 4px rgba(249,115,22,0.6))" }}
                      />
                    </svg>
                    <Flame className={`absolute w-4 h-4 ${cartCalories > CALORIE_GOAL ? 'text-red-500' : 'text-orange-400'} group-hover:scale-110 transition-transform`} />
                  </div>
                  <div>
                    <h5 className="text-xs text-slate-400 font-bold uppercase tracking-wider">Nutritional Insights</h5>
                    <p className={`text-sm font-bold ${cartCalories > CALORIE_GOAL ? 'text-red-400' : 'text-white'}`}>
                      {cartCalories} <span className="text-xs text-slate-500">/ {CALORIE_GOAL} kcal</span>
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-slate-800 shrink-0 relative z-10">
                  <div className="flex justify-between items-center mb-2 text-sm text-slate-400">
                    <span>Subtotal</span>
                    <span className="text-white">₹{cartTotal}</span>
                  </div>
                  <div className="flex justify-between items-center mb-6 text-sm text-slate-400">
                    <span>Tax (5%)</span>
                    <span className="text-white">₹{Math.round(cartTotal * 0.05)}</span>
                  </div>
                  
                  <div className="flex justify-between items-center mb-6">
                    <span className="text-lg text-slate-200 font-bold">Total</span>
                    <span className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-emerald-200">
                      ₹{cartTotal + Math.round(cartTotal * 0.05)}
                    </span>
                  </div>

                  <button 
                    onClick={handleProceedToCheckout}
                    disabled={isInitializingCheckout}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white font-bold py-4 rounded-xl flex items-center justify-center transition-all shadow-[0_0_20px_rgba(34,197,94,0.3)] hover:shadow-[0_0_30px_rgba(34,197,94,0.5)] group overflow-hidden relative disabled:opacity-50"
                  >
                    <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"></div>
                    <span className="relative z-10 flex items-center">
                      {isInitializingCheckout ? (
                        <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Preparing...</>
                      ) : (
                        <>Finalize Checkout <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform" /></>
                      )}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <nav className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 p-2 rounded-2xl flex gap-2 shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-50">
        <button onClick={() => setActiveTab('menu')} className={`flex items-center p-3 rounded-xl transition-all ${activeTab === 'menu' ? 'bg-green-500/20 text-green-400 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
          <Coffee className="w-6 h-6" />
        </button>
        <button onClick={() => setActiveTab('cart')} className={`flex items-center p-3 rounded-xl transition-all relative ${activeTab === 'cart' ? 'bg-green-500/20 text-green-400 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
          <ShoppingCart className="w-6 h-6" />
          {cartItemsArray.length > 0 && <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-slate-900 text-[10px] font-bold text-white flex items-center justify-center shadow-[0_0_10px_rgba(34,197,94,0.8)]">{cartItemsArray.length}</span>}
        </button>
        <button onClick={() => setActiveTab('orders')} className={`flex items-center p-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-green-500/20 text-green-400 shadow-inner' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}`}>
          <Clock className="w-6 h-6" />
        </button>
      </nav>
    </div>
  );
};

const MobileCart = ({ cartItemsArray, cartTotal, updateCart, onCheckout, isInitializingCheckout, cartCalories, caloriePercentage }) => {
  if (cartItemsArray.length === 0) return (
    <div className="h-full flex flex-col items-center justify-center py-20 text-slate-500 glass-dark rounded-3xl mx-2 border border-white/5">
      <ShoppingCart className="w-12 h-12 mb-4 opacity-50" />
      <p>Your tray is empty.</p>
    </div>
  );
  
  return (
    <div className="glass-dark rounded-3xl p-5 mx-2 min-h-full flex flex-col border border-white/5">
      <h2 className="text-xl font-bold text-white mb-6">Your Tray</h2>
      
      <div className="mb-6 p-4 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center gap-4">
        <div className="relative w-10 h-10 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-800" />
            <circle cx="20" cy="20" r="16" stroke="currentColor" strokeWidth="4" fill="transparent" 
              strokeDasharray={100.5} strokeDashoffset={100.5 - (100.5 * caloriePercentage) / 100}
              className="text-orange-500 transition-all duration-1000" 
            />
          </svg>
          <Flame className="absolute w-3 h-3 text-orange-400" />
        </div>
        <div>
          <h5 className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Calories</h5>
          <p className="text-sm font-bold text-white">
            {cartCalories} <span className="text-[10px] text-slate-500">/ 2000 kcal</span>
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        {cartItemsArray.map(c => (
          <div key={c.item.id} className="flex gap-4 items-center bg-slate-900/60 p-3 rounded-2xl border border-slate-700/50 hover:border-green-500/30">
            <img src={c.item.image} alt={c.item.name} className="w-16 h-16 rounded-xl object-cover bg-slate-800" />
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-slate-200 truncate">{c.item.name}</h4>
              <p className="text-green-400 font-bold mt-1">₹{c.item.price * c.quantity}</p>
            </div>
            <div className="flex items-center gap-3 bg-slate-800 rounded-lg p-1 px-2 border border-slate-700 shadow-inner">
              <button onClick={() => updateCart(c.item, -1)} className="text-slate-400 p-1 hover:text-red-400"><Minus className="w-4 h-4" /></button>
              <span className="text-sm font-bold text-white min-w-[1.5ch] text-center">{c.quantity}</span>
              <button onClick={() => updateCart(c.item, 1)} className="text-slate-400 p-1 hover:text-green-400"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-8 pt-6 border-t border-slate-800 relative">
        <div className="flex justify-between items-end mb-6">
          <span className="text-slate-400 font-medium">Total (Inc. Taxes)</span>
          <span className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-green-200">
            ₹{cartTotal + Math.round(cartTotal * 0.05)}
          </span>
        </div>
        <button onClick={onCheckout} disabled={isInitializingCheckout} className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 rounded-xl text-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] flex justify-center items-center disabled:opacity-50">
          {isInitializingCheckout ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Preparing...</>
          ) : (
            <>Checkout Now <ChevronRight className="w-5 h-5 ml-2" /></>
          )}
        </button>
      </div>
    </div>
  );
};

export default StudentPortal;
