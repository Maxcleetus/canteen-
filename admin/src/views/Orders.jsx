import React, { useState, useEffect } from 'react';
import { ChefHat, CheckSquare, Clock, ArrowRight, Printer } from 'lucide-react';
import { fetchOrders, updateOrderStatus } from '../api';
import { io } from 'socket.io-client';
import { REALTIME_ENABLED, SOCKET_URL } from '../config';

const ACTIONABLE_STATUSES = ['PENDING', 'PAID'];

const OrdersView = () => {
  const [activeTab, setActiveTab] = useState('All');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOrders = async () => {
    try {
      const data = await fetchOrders();
      setOrders(data);
    } catch (error) {
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();

    if (!REALTIME_ENABLED) {
      const intervalId = window.setInterval(loadOrders, 10000);
      return () => window.clearInterval(intervalId);
    }

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });
    socket.on('new-order', (order) => {
      setOrders(prev => {
        const existing = prev.find(o => o.id === order.id);
        if (existing) {
          return prev.map(o => o.id === order.id ? order : o);
        }
        return [...prev, order];
      });
    });
    socket.on('order-updated', (updatedOrder) => {
      setOrders(prev => {
        const existing = prev.find(o => o.id === updatedOrder.id);
        if (existing) {
          return prev.map(o => o.id === updatedOrder.id ? updatedOrder : o);
        }
        return [...prev, updatedOrder];
      });
    });

    return () => socket.disconnect();
  }, []);

  const handleStatusChange = async (id, newStatus) => {
    try {
      const updatedOrder = await updateOrderStatus(id, newStatus);
      setOrders(prev => prev.map(o => o.id === id ? updatedOrder : o));
    } catch (e) {
      console.error(e);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'NEW': return 'bg-orange-50 border-orange-200';
      case 'PENDING': return 'bg-orange-50 border-orange-200';
      case 'PAID': return 'bg-emerald-50 border-emerald-200';
      case 'PREPARING': return 'bg-blue-50 border-blue-200';
      case 'READY': return 'bg-green-50 border-green-200';
      default: return 'bg-slate-50 border-slate-200';
    }
  };

  const getStatusHeaderColor = (status) => {
    switch (status) {
      case 'NEW': return 'text-orange-700 bg-orange-100';
      case 'PENDING': return 'text-orange-700 bg-orange-100';
      case 'PAID': return 'text-emerald-700 bg-emerald-100';
      case 'PREPARING': return 'text-blue-700 bg-blue-100';
      case 'READY': return 'text-green-700 bg-green-100';
      default: return 'text-slate-700 bg-slate-100';
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-500">Loading active orders from kitchen...</div>;

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center">
            Kitchen Display
            <span className="ml-3 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full flex items-center">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1.5 animate-pulse"></span>
              {REALTIME_ENABLED ? 'Live Feed' : 'Auto Refresh'}
            </span>
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            {REALTIME_ENABLED ? 'Real-time active order management board via WebSockets.' : 'Serverless-friendly order board refreshed every 10 seconds.'}
          </p>
        </div>
        
        <div className="flex bg-slate-200 p-1 rounded-lg">
          {['All', 'NEW', 'PREPARING', 'READY'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded shadow-none transition-all ${
                activeTab === tab ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'All' ? 'All' : tab === 'NEW' ? 'Needs Action' : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden min-h-[500px]">
        {/* Needs Action */}
        {(activeTab === 'All' || activeTab === 'NEW') && (
          <div className="flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden h-full shadow-sm">
            <div className={`px-4 py-3 flex justify-between items-center ${getStatusHeaderColor('NEW')}`}>
              <div className="flex items-center font-bold">
                <Clock className="w-4 h-4 mr-2" />
                New Orders
              </div>
              <span className="bg-white/50 text-orange-900 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {orders.filter(o => ACTIONABLE_STATUSES.includes(o.status)).length}
              </span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {orders.filter(o => ACTIONABLE_STATUSES.includes(o.status)).map(order => (
                <OrderCard key={order.id} order={order} colorClass={getStatusColor(order.status)} nextAction="Start Preparing" nextStatus="PREPARING" nextIcon={ChefHat} nextColor="bg-blue-600 hover:bg-blue-700" onAction={handleStatusChange} />
              ))}
            </div>
          </div>
        )}

        {/* Preparing */}
        {(activeTab === 'All' || activeTab === 'PREPARING') && (
          <div className="flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden h-full shadow-sm">
            <div className={`px-4 py-3 flex justify-between items-center ${getStatusHeaderColor('PREPARING')}`}>
              <div className="flex items-center font-bold">
                <ChefHat className="w-4 h-4 mr-2" />
                In Kitchen
              </div>
              <span className="bg-white/50 text-blue-900 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {orders.filter(o => o.status === 'PREPARING').length}
              </span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {orders.filter(o => o.status === 'PREPARING').map(order => (
                <OrderCard key={order.id} order={order} colorClass={getStatusColor('PREPARING')} nextAction="Mark Ready" nextStatus="READY" nextIcon={CheckSquare} nextColor="bg-green-600 hover:bg-green-700" onAction={handleStatusChange} />
              ))}
            </div>
          </div>
        )}

        {/* Ready */}
        {(activeTab === 'All' || activeTab === 'READY') && (
          <div className="flex flex-col rounded-2xl bg-white border border-slate-200 overflow-hidden h-full shadow-sm">
            <div className={`px-4 py-3 flex justify-between items-center ${getStatusHeaderColor('READY')}`}>
              <div className="flex items-center font-bold">
                <CheckSquare className="w-4 h-4 mr-2" />
                Ready to Serve
              </div>
              <span className="bg-white/50 text-green-900 px-2.5 py-0.5 rounded-full text-xs font-bold">
                {orders.filter(o => o.status === 'READY').length}
              </span>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4 bg-slate-50/50">
              {orders.filter(o => o.status === 'READY').map(order => (
                <OrderCard key={order.id} order={order} colorClass={getStatusColor('READY')} nextAction="Deliver Order" nextStatus="DELIVERED" nextIcon={ArrowRight} nextColor="bg-slate-800 hover:bg-slate-900" onAction={handleStatusChange} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const OrderCard = ({ order, colorClass, nextAction, nextStatus, nextIcon: NextIcon, nextColor, onAction }) => {
  const elapsed = Math.round((new Date() - new Date(order.createdAt)) / 60000);
  const timeStr = new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const statusTone = order.status === 'PAID'
    ? 'bg-emerald-100 text-emerald-700'
    : order.status === 'PENDING'
      ? 'bg-orange-100 text-orange-700'
      : 'bg-slate-100 text-slate-700';

  return (
    <div className={`p-4 rounded-xl border ${colorClass} bg-white shadow-sm flex flex-col group`}>
      <div className="flex justify-between items-start mb-3 border-b border-black/5 pb-3">
        <div>
          <h4 className="font-bold text-slate-800 text-lg">{order.orderNo}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium text-slate-500">{order.type} {order.tableNo ? `• ${order.tableNo}` : ''}</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusTone}`}>
              {order.status}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className={`text-sm font-bold ${elapsed > 15 ? 'text-red-500 animate-pulse' : 'text-slate-700'}`}>
            {elapsed}m
          </div>
          <span className="text-[10px] text-slate-400">{timeStr}</span>
        </div>
      </div>
      
      <div className="flex-1 mb-4">
        <ul className="space-y-1.5">
          {order.items?.map((item, i) => (
            <li key={i} className="text-sm text-slate-700 font-medium flex items-start">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-300 mt-1.5 mr-2 shrink-0"></span>
              {item.quantity}x {item.menuItem?.name || 'Unknown Item'}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2 mt-auto">
        <button className="p-2 border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 rounded-lg transition-colors focus:ring-2 focus:ring-slate-200 outline-none">
          <Printer className="w-4 h-4" />
        </button>
        <button 
          onClick={() => onAction(order.id, nextStatus)}
          className={`flex-1 flex justify-center items-center py-2 px-3 text-white text-sm font-bold rounded-lg transition-colors ${nextColor} shadow-sm focus:ring-2 focus:ring-offset-1 focus:ring-offset-slate-50 outline-none w-full`}
        >
          {nextAction}
          <NextIcon className="w-4 h-4 ml-2" />
        </button>
      </div>
    </div>
  );
};

export default OrdersView;
