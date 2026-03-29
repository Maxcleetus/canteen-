import { Router } from 'express';
import { authenticate, requireAdmin, AuthRequest } from '../middlewares/auth';
import { emitRealtime } from '../lib/realtime';
import { prisma } from '../lib/prisma';

import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const router = Router();
const ACTIVE_ORDER_STATUSES = ['PENDING', 'PAID', 'PREPARING', 'READY'];
const REVENUE_ORDER_STATUSES = ['PAID', 'PREPARING', 'READY', 'DELIVERED'];
const HOURLY_REVENUE_HOURS = [9, 10, 11, 12, 13, 14, 15];
const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const toIstDate = (date: Date) => new Date(date.getTime() + IST_OFFSET_MS);

const getIstDayRange = (baseDate = new Date()) => {
  const istDate = toIstDate(baseDate);
  const startMs =
    Date.UTC(istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate()) -
    IST_OFFSET_MS;

  return {
    start: new Date(startMs),
    end: new Date(startMs + DAY_MS)
  };
};

const isActiveOrderStatus = (status: string) => ACTIVE_ORDER_STATUSES.includes(status);
const isRevenueOrderStatus = (status: string) => REVENUE_ORDER_STATUSES.includes(status);

const formatHourLabel = (hour: number) => {
  if (hour === 0) return '12am';
  if (hour === 12) return '12pm';
  return hour > 12 ? `${hour - 12}pm` : `${hour}am`;
};

const calculateTrend = (current: number, previous: number) => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Math.round(((current - previous) / previous) * 100);
};

const formatDateTimeIst = (date: Date) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);

const formatDateIst = (date: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .format(date)
    .replace(/\//g, '-');

const formatDayLabelIst = (date: Date) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric'
  }).format(date);

const escapeCsvValue = (value: string | number | null | undefined) => {
  const normalized = value == null ? '' : String(value);
  return `"${normalized.replace(/"/g, '""')}"`;
};

const buildStatusCounts = (orders: Array<{ status: string }>) => ({
  pending: orders.filter((order) => order.status === 'PENDING').length,
  paid: orders.filter((order) => order.status === 'PAID').length,
  preparing: orders.filter((order) => order.status === 'PREPARING').length,
  ready: orders.filter((order) => order.status === 'READY').length
});

const buildHourlyRevenue = (
  orders: Array<{ status: string; total: number; createdAt: Date }>
) => {
  const buckets = new Map<number, number>();
  HOURLY_REVENUE_HOURS.forEach((hour) => buckets.set(hour, 0));

  orders.forEach((order) => {
    if (!isRevenueOrderStatus(order.status)) return;

    const orderHour = toIstDate(new Date(order.createdAt)).getUTCHours();
    if (!buckets.has(orderHour)) return;

    buckets.set(orderHour, (buckets.get(orderHour) ?? 0) + order.total);
  });

  const maxRevenue = Math.max(...Array.from(buckets.values()), 1);

  return HOURLY_REVENUE_HOURS.map((hour) => {
    const value = buckets.get(hour) ?? 0;

    return {
      label: formatHourLabel(hour),
      value,
      height: Math.round((value / maxRevenue) * 100)
    };
  });
};

const buildDailyRevenueComparison = (
  orders: Array<{ status: string; total: number; createdAt: Date }>,
  dayStarts: Date[]
) => {
  const revenueByDay = new Map<string, { value: number; orderCount: number }>();

  dayStarts.forEach((dayStart) => {
    revenueByDay.set(formatDateIst(dayStart), { value: 0, orderCount: 0 });
  });

  orders.forEach((order) => {
    if (!isRevenueOrderStatus(order.status)) return;

    const dayKey = formatDateIst(order.createdAt);
    if (!revenueByDay.has(dayKey)) return;

    const existing = revenueByDay.get(dayKey);
    if (!existing) return;

    existing.value += order.total;
    existing.orderCount += 1;
  });

  const maxRevenue = Math.max(
    ...Array.from(revenueByDay.values()).map((entry) => entry.value),
    1
  );
  const todayKey = formatDateIst(new Date());

  return dayStarts.map((dayStart) => {
    const dayKey = formatDateIst(dayStart);
    const dayData = revenueByDay.get(dayKey) ?? { value: 0, orderCount: 0 };

    return {
      key: dayKey,
      label: formatDayLabelIst(dayStart),
      value: dayData.value,
      orderCount: dayData.orderCount,
      isToday: dayKey === todayKey,
      height: dayData.value === 0 ? 0 : Math.max(12, Math.round((dayData.value / maxRevenue) * 100))
    };
  });
};

const buildTopItems = (
  orders: Array<{
    items: Array<{
      quantity: number;
      price: number;
      menuItem?: {
        name: string;
      } | null;
    }>;
  }>
) => {
  const itemMap = new Map<
    string,
    { name: string; quantity: number; revenue: number }
  >();

  orders.forEach((order) => {
    order.items.forEach((item) => {
      const name = item.menuItem?.name ?? 'Item';
      const existing = itemMap.get(name) ?? { name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += item.quantity * item.price;
      itemMap.set(name, existing);
    });
  });

  return Array.from(itemMap.values()).sort((left, right) => {
    if (right.quantity !== left.quantity) {
      return right.quantity - left.quantity;
    }

    return right.revenue - left.revenue;
  });
};

const buildItemSummary = (
  items: Array<{
    quantity: number;
    menuItem?: {
      name: string;
    } | null;
  }>
) => items.map((item) => `${item.quantity}x ${item.menuItem?.name || 'Item'}`).join(', ');

// Get order history for a student, or all active orders for Admin
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    if (req.user?.role === 'ADMIN') {
      const orders = await prisma.order.findMany({
        where: {
          status: { notIn: ['DELIVERED', 'CANCELED'] }
        },
        include: { items: { include: { menuItem: true } }, user: true },
        orderBy: { createdAt: 'asc' }
      });
      return res.json(orders);
    } else {
      const orders = await prisma.order.findMany({
        where: { userId: req.user!.id },
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: 'desc' }
      });
      return res.json(orders);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// Admin Analytics Dashboard Payload
router.get('/dashboard-stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const todayRange = getIstDayRange();
    const yesterdayRange = {
      start: new Date(todayRange.start.getTime() - DAY_MS),
      end: todayRange.start
    };
    const comparisonDayStarts = Array.from({ length: 7 }, (_item, index) => {
      const offsetFromToday = 6 - index;
      return new Date(todayRange.start.getTime() - offsetFromToday * DAY_MS);
    });
    const comparisonStart = comparisonDayStarts[0];

    const [todayOrders, yesterdayOrders, openOrders, recentOrders, comparisonOrders] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: todayRange.start, lt: todayRange.end } },
        include: { items: { include: { menuItem: true } } }
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: yesterdayRange.start, lt: yesterdayRange.end } }
      }),
      prisma.order.findMany({
        where: { status: { in: ACTIVE_ORDER_STATUSES } },
        include: { items: { include: { menuItem: true } } },
        orderBy: { createdAt: 'asc' }
      }),
      prisma.order.findMany({
        take: 6,
        orderBy: { createdAt: 'desc' },
        include: { items: { include: { menuItem: true } } }
      }),
      prisma.order.findMany({
        where: { createdAt: { gte: comparisonStart, lt: todayRange.end } },
        select: {
          status: true,
          total: true,
          createdAt: true
        }
      })
    ]);

    const todaysRevenue = todayOrders
      .filter((order) => isRevenueOrderStatus(order.status))
      .reduce((sum, o) => sum + o.total, 0);
    const yesterdayRevenue = yesterdayOrders
      .filter((order) => isRevenueOrderStatus(order.status))
      .reduce((sum, order) => sum + order.total, 0);

    const activeCustomers = new Set(todayOrders.map((order) => order.userId)).size;
    const previousActiveCustomers = new Set(yesterdayOrders.map((order) => order.userId)).size;
    const averageOrderValue = todayOrders.length
      ? Math.round((todaysRevenue / todayOrders.length) * 100) / 100
      : 0;
    const completedOrders = todayOrders.filter((order) =>
      ['READY', 'DELIVERED'].includes(order.status)
    ).length;
    const hourlyRevenue = buildHourlyRevenue(todayOrders);
    const dailyRevenueComparison = buildDailyRevenueComparison(
      comparisonOrders,
      comparisonDayStarts
    );
    const topItems = buildTopItems(todayOrders).slice(0, 5);
    const statusCounts = buildStatusCounts(openOrders);

    res.json({
      revenue: todaysRevenue,
      totalOrders: todayOrders.length,
      openOrders: openOrders.length,
      activeCustomers,
      averageOrderValue,
      completedOrders,
      statusCounts,
      chartHeights: hourlyRevenue.map((point) => point.height),
      hourlyRevenue,
      dailyRevenueComparison,
      topItems,
      trends: {
        revenue: calculateTrend(todaysRevenue, yesterdayRevenue),
        orders: calculateTrend(todayOrders.length, yesterdayOrders.length),
        customers: calculateTrend(activeCustomers, previousActiveCustomers)
      },
      recentOrders: recentOrders.map((o) => ({
        id: o.orderNo,
        items: buildItemSummary(o.items),
        total: `₹${o.total}`,
        status: o.status,
        time: o.createdAt
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

router.get('/report', authenticate, requireAdmin, async (req, res) => {
  try {
    const todayRange = getIstDayRange();
    const orders = await prisma.order.findMany({
      where: { createdAt: { gte: todayRange.start, lt: todayRange.end } },
      include: { items: { include: { menuItem: true } }, user: true },
      orderBy: { createdAt: 'asc' }
    });

    const revenue = orders
      .filter((order) => isRevenueOrderStatus(order.status))
      .reduce((sum, order) => sum + order.total, 0);
    const openOrders = orders.filter((order) => isActiveOrderStatus(order.status)).length;
    const activeCustomers = new Set(orders.map((order) => order.userId)).size;

    const rows = [
      ['Report Generated At (IST)', formatDateTimeIst(new Date())],
      ['Reporting Date (IST)', formatDateTimeIst(todayRange.start)],
      ['Today Revenue', `₹${revenue.toFixed(2)}`],
      ['Total Orders', orders.length],
      ['Open Orders', openOrders],
      ['Active Customers', activeCustomers],
      [],
      ['Order No', 'Status', 'Customer', 'Type', 'Table No', 'Total', 'Created At (IST)', 'Items'],
      ...orders.map((order) => [
        order.orderNo,
        order.status,
        order.user?.name ?? 'Unknown',
        order.type,
        order.tableNo ?? '',
        order.total.toFixed(2),
        formatDateTimeIst(order.createdAt),
        buildItemSummary(order.items)
      ])
    ];

    const csv = rows
      .map((row) => row.map((value) => escapeCsvValue(value)).join(','))
      .join('\n');
    const filename = `canteen-report-${formatDateIst(new Date())}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error('Failed to generate order report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

router.get('/canteen-overview', authenticate, async (_req, res) => {
  try {
    const activeOrders = await prisma.order.findMany({
      where: { status: { in: ACTIVE_ORDER_STATUSES } },
      include: { items: { include: { menuItem: true } } },
      orderBy: { createdAt: 'asc' }
    });

    const totalItemsInQueue = activeOrders.reduce(
      (sum, order) =>
        sum + order.items.reduce((quantitySum, item) => quantitySum + item.quantity, 0),
      0
    );
    const averageWaitMinutes = activeOrders.length
      ? Math.round(
          activeOrders.reduce((sum, order) => {
            const diffInMinutes = Math.max(
              0,
              Math.round((Date.now() - new Date(order.createdAt).getTime()) / 60000)
            );
            return sum + diffInMinutes;
          }, 0) / activeOrders.length
        )
      : 0;

    res.json({
      activeOrdersCount: activeOrders.length,
      totalItemsInQueue,
      averageWaitMinutes,
      statusCounts: buildStatusCounts(activeOrders),
      activeOrders: activeOrders.map((order) => ({
        id: order.id,
        orderNo: order.orderNo,
        status: order.status,
        type: order.type,
        tableNo: order.tableNo,
        createdAt: order.createdAt,
        quantityTotal: order.items.reduce((sum, item) => sum + item.quantity, 0),
        items: order.items.map((item) => `${item.quantity}x ${item.menuItem?.name || 'Item'}`)
      }))
    });
  } catch (error) {
    console.error('Failed to fetch canteen overview:', error);
    res.status(500).json({ error: 'Failed to fetch canteen overview' });
  }
});

// Create new order
router.post('/', authenticate, async (req: AuthRequest, res) => {
  const { items, type, tableNo, paymentIntentId } = req.body; // items: [{menuItemId, quantity}]
  
  try {
    let orderStatus: any = 'PENDING';
    
    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status === 'succeeded') {
        orderStatus = 'PAID';
      } else {
        return res.status(400).json({ error: 'Payment not successful' });
      }
    }

    // Generate Order No
    const count = await prisma.order.count();
    const orderNo = `#ORD-${String(count + 1).padStart(3, '0')}`;

    // Calculate total and fetch prices
    let total = 0;
    const orderItemsData = [];
    
    for (const item of items) {
      const menuItem = await prisma.menuItem.findUnique({ where: { id: item.menuItemId } });
      if (!menuItem) return res.status(404).json({ error: `Item not found: ${item.menuItemId}` });
      
      const itemTotal = menuItem.price * item.quantity;
      total += itemTotal;
      
      orderItemsData.push({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        price: menuItem.price
      });
    }
    const finalTotal = total + Math.round(total * 0.05);

    const order = await prisma.order.create({
      data: {
        orderNo,
        userId: req.user!.id,
        total: finalTotal,
        status: orderStatus,
        type: type || 'TAKEAWAY',
        tableNo,
        items: {
          create: orderItemsData
        }
      },
      include: { items: { include: { menuItem: true } }, user: true }
    });

    // Emit socket event to Admins (Kitchen screen)
    emitRealtime('new-order', order);

    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// Update order status
router.patch('/:id/status', authenticate, requireAdmin, async (req, res) => {
  const { status } = req.body;
  
  try {
    const order = await prisma.order.update({
      where: { id: req.params.id as string },
      data: { status },
      include: { items: { include: { menuItem: true } }, user: true }
    });

    // Emit socket event for this specific order so the student is notified
    emitRealtime(`order-status-${order.id}`, order);
    emitRealtime('order-updated', order);

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
