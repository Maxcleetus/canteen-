import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, ShoppingBag, DollarSign, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { fetchDashboardStats, downloadDashboardReport } from '../api';
import { io } from 'socket.io-client';
import { REALTIME_ENABLED, SOCKET_URL } from '../config';
import { useToast } from '../components/ToastProvider';

const DashboardView = () => {
  const [statsData, setStatsData] = useState(null);
  const [isDownloadingReport, setIsDownloadingReport] = useState(false);
  const toast = useToast();

  const createFallbackComparison = () => {
    const formatter = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric'
    });

    return Array.from({ length: 7 }, (_item, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));

      return {
        key: `${index}`,
        label: formatter.format(date),
        value: 0,
        orderCount: 0,
        isToday: index === 6,
        height: 0
      };
    });
  };

  const loadStats = async () => {
    try {
      const data = await fetchDashboardStats();
      setStatsData(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    loadStats();

    if (!REALTIME_ENABLED) {
      const intervalId = window.setInterval(loadStats, 15000);
      return () => window.clearInterval(intervalId);
    }

    const socket = io(SOCKET_URL, {
      transports: ['polling', 'websocket']
    });
    socket.on('new-order', loadStats);
    socket.on('order-updated', loadStats);

    return () => socket.disconnect();
  }, []);

  const getFileNameFromDisposition = (headerValue) => {
    if (!headerValue) return null;

    const match = headerValue.match(/filename="?([^"]+)"?/i);
    return match?.[1] || null;
  };

  const handleGenerateReport = async () => {
    setIsDownloadingReport(true);

    try {
      const response = await downloadDashboardReport();
      const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: 'text/csv' }));
      const link = document.createElement('a');
      const filename =
        getFileNameFromDisposition(response.headers['content-disposition']) ||
        'canteen-report.csv';

      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
      toast.success('Report ready', `${filename} has been downloaded.`);
    } catch (error) {
      console.error('Failed to download report:', error);
      toast.error('Report generation failed', 'Please try again in a moment.');
    } finally {
      setIsDownloadingReport(false);
    }
  };

  const getRelativeTime = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff > 60) return `${Math.floor(diff / 60)} hrs ago`;
    return `${diff} mins ago`;
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('en-IN', {
      maximumFractionDigits: 0
    }).format(value || 0);

  const formatTrend = (value) => {
    if (typeof value !== 'number') return null;
    if (value === 0) return '0%';
    return `${value > 0 ? '+' : ''}${value}%`;
  };

  const stats = [
    {
      label: "Today's Revenue",
      value: `₹${formatCurrency(statsData?.revenue)}`,
      trend: statsData?.trends?.revenue,
      icon: DollarSign,
      color: 'text-green-600',
      bg: 'bg-green-100'
    },
    {
      label: 'Total Orders',
      value: statsData?.totalOrders || 0,
      trend: statsData?.trends?.orders,
      icon: ShoppingBag,
      color: 'text-blue-600',
      bg: 'bg-blue-100'
    },
    {
      label: 'Open Orders',
      value: statsData?.openOrders || 0,
      trend: null,
      liveLabel: 'Live',
      icon: Clock,
      color: 'text-orange-600',
      bg: 'bg-orange-100'
    },
    {
      label: 'Active Customers',
      value: statsData?.activeCustomers || 0,
      trend: statsData?.trends?.customers,
      icon: Users,
      color: 'text-purple-600',
      bg: 'bg-purple-100'
    }
  ];

  const recentOrders = statsData?.recentOrders || [];
  const dailyRevenueComparison =
    statsData?.dailyRevenueComparison?.length > 0
      ? statsData.dailyRevenueComparison
      : createFallbackComparison();
  const topItems = statsData?.topItems || [];
  const totalComparisonRevenue = dailyRevenueComparison.reduce(
    (sum, point) => sum + point.value,
    0
  );
  const statusCounts = statsData?.statusCounts || {
    pending: 0,
    paid: 0,
    preparing: 0,
    ready: 0
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'READY': return 'bg-green-100 text-green-700 border-green-200';
      case 'PREPARING': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'PENDING': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'PAID': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'DELIVERED': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Canteen Overview</h2>
          <p className="text-slate-500 text-sm mt-1">
            {REALTIME_ENABLED ? 'Real-time live operational performance' : 'Auto-refreshing operational performance for serverless deployment'}
          </p>
        </div>
        <button
          onClick={handleGenerateReport}
          disabled={isDownloadingReport}
          className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 shadow-sm shadow-green-600/20 transition-all flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <TrendingUp className="w-4 h-4 mr-2" />
          {isDownloadingReport ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          const trendText = formatTrend(stat.trend);
          const isPositive = typeof stat.trend === 'number' ? stat.trend >= 0 : null;
          return (
            <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col hover:border-green-100 transition-colors group">
              <div className="flex justify-between items-start">
                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} mb-4 group-hover:scale-110 transition-transform`}>
                  <Icon className="w-6 h-6" />
                </div>
                {stat.liveLabel ? (
                  <div className="flex items-center text-xs font-medium px-2 py-1 rounded-full bg-orange-50 text-orange-600">
                    {stat.liveLabel}
                  </div>
                ) : trendText ? (
                  <div className={`flex items-center text-xs font-medium px-2 py-1 rounded-full ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                    {isPositive ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                    {trendText}
                  </div>
                ) : null}
              </div>
              <p className="text-slate-500 font-medium text-sm">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight mt-1">
                {statsData ? stat.value : '...'}</h3>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Completed Today</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">{statsData?.completedOrders ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Order</p>
          <p className="text-2xl font-bold text-slate-800 mt-2">₹{formatCurrency(statsData?.averageOrderValue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Preparing</p>
          <p className="text-2xl font-bold text-blue-600 mt-2">{statusCounts.preparing}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Ready To Serve</p>
          <p className="text-2xl font-bold text-green-600 mt-2">{statusCounts.ready}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Area */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-bold text-slate-800">Revenue Comparison</h3>
              <p className="text-sm text-slate-500 mt-1">Last 7 days in IST</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">7-Day Revenue</p>
              <p className="text-lg font-bold text-slate-800">₹{formatCurrency(totalComparisonRevenue)}</p>
            </div>
          </div>
          <div className="relative pt-6">
            <div className="absolute inset-x-0 top-6 bottom-10 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed border-slate-200 w-full h-0"></div>
              <div className="border-b border-dashed border-slate-200 w-full h-0"></div>
              <div className="border-b border-dashed border-slate-200 w-full h-0"></div>
              <div className="border-b border-dashed border-slate-200 w-full h-0"></div>
            </div>

            <div className="grid grid-cols-7 gap-3 h-72">
              {dailyRevenueComparison.map((point) => (
                <div key={point.key} className="flex flex-col items-center relative z-10 min-w-0">
                  <span className={`text-[11px] font-semibold mb-2 ${point.isToday ? 'text-green-600' : 'text-slate-400'}`}>
                    ₹{formatCurrency(point.value)}
                  </span>
                  <div className="flex-1 w-full flex items-end">
                    <div className="w-full h-full bg-slate-100 rounded-xl relative overflow-hidden border border-slate-200 flex items-end transition-colors hover:bg-slate-200">
                      <div
                        className={`w-full transition-all duration-500 rounded-xl shadow-sm ${
                          point.isToday
                            ? 'bg-gradient-to-t from-green-600 to-emerald-400'
                            : 'bg-gradient-to-t from-slate-500 to-slate-300'
                        }`}
                        style={{ height: `${point.height}%`, minHeight: point.value > 0 ? '18px' : '0px' }}
                      ></div>
                    </div>
                  </div>
                  <p className={`text-xs mt-3 font-medium text-center ${point.isToday ? 'text-green-700' : 'text-slate-500'}`}>
                    {point.label}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1 text-center">
                    {point.orderCount} order{point.orderCount === 1 ? '' : 's'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Orders List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[350px]">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
            <h3 className="font-bold text-slate-800">Recent Transactions</h3>
            <button className="text-sm text-green-600 font-medium hover:text-green-700">
              {REALTIME_ENABLED ? 'Live' : 'Polling'}
            </button>
          </div>
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {recentOrders.length === 0 && <div className="text-slate-400 text-center mt-10 text-sm">No recent active orders</div>}
              {recentOrders.map((order, i) => (
                <div key={i} className="flex justify-between items-start p-3 hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 text-sm">{order.id}</span>
                      <span className="text-xs text-slate-400 font-medium">{getRelativeTime(order.time)}</span>
                    </div>
                    <p className="text-sm text-slate-600 truncate w-40">{order.items}</p>
                  </div>
                  <div className="text-right space-y-2">
                    <p className="font-semibold text-slate-800 text-sm">{order.total}</p>
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="font-bold text-slate-800">Top Items Today</h3>
          <span className="text-sm text-slate-500">Based on quantity sold</span>
        </div>
        {topItems.length === 0 ? (
          <p className="text-slate-400 text-sm">No completed sales data for today yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
            {topItems.map((item) => (
              <div key={item.name} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="font-semibold text-slate-800">{item.name}</p>
                <p className="text-sm text-slate-500 mt-1">{item.quantity} portions sold</p>
                <p className="text-sm font-semibold text-green-600 mt-3">₹{formatCurrency(item.revenue)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardView;
