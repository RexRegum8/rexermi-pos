import { dbQuery } from '@/lib/db';
import Link from 'next/link';
import AdminChartsClient from './AdminChartsClient';

export const metadata = { title: 'Dashboard — Admin Rexermi' };
export const dynamic = 'force-dynamic';

type Period = 'today' | '7d' | '30d' | '365d';

const PERIOD_SQL: Record<Period, { days: number; groupBy: string; label: string }> = {
  today:  { days: 0,   groupBy: "strftime('%H', created_at)", label: 'Hoy' },
  '7d':   { days: 6,   groupBy: 'DATE(created_at)',            label: 'Últimos 7 días' },
  '30d':  { days: 29,  groupBy: 'DATE(created_at)',            label: 'Últimos 30 días' },
  '365d': { days: 364, groupBy: "strftime('%Y-%m', created_at)", label: 'Este año' },
};

interface Stats {
  total_orders: number;
  pending_orders: number;
  total_revenue: number;
  total_users: number;
  total_products: number;
  low_stock: number;
}

interface PeriodStats {
  new_orders: number;
  period_revenue: number;
  new_users: number;
}

interface RecentOrder {
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  user_name: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'status-pending', paid: 'status-paid', processing: 'status-processing',
  shipped: 'status-shipped', delivered: 'status-delivered', cancelled: 'status-cancelled',
};

function buildDateFilter(period: Period, offset = 0): string {
  const { days } = PERIOD_SQL[period];
  if (period === 'today') {
    if (offset === 0) return `DATE(created_at,'localtime') = DATE('now','localtime')`;
    return `DATE(created_at,'localtime') = DATE('now','localtime','-1 day')`;
  }
  const start = days + 1 + offset * (days + 1);
  const end   = offset * (days + 1);
  if (end === 0) {
    return `DATE(created_at,'localtime') >= DATE('now','localtime','-${start - 1} days')`;
  }
  return `DATE(created_at,'localtime') BETWEEN DATE('now','localtime','-${start - 1} days') AND DATE('now','localtime','-${end} days')`;
}

async function getDashboardData(period: Period) {
  const dateFilter     = buildDateFilter(period, 0);
  const prevDateFilter = buildDateFilter(period, 1);

  const [statsRows, periodCurrent, periodPrev, recentOrders, salesRaw, statusData, topProducts] = await Promise.all([
    // All-time global stats
    dbQuery<any[]>(`
      SELECT
        (SELECT COUNT(*) FROM orders) AS total_orders,
        (SELECT COUNT(*) FROM orders WHERE status='pending') AS pending_orders,
        (SELECT COALESCE(SUM(total),0) FROM orders WHERE status NOT IN ('cancelled')) AS total_revenue,
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM products WHERE is_active=1) AS total_products,
        (SELECT COUNT(*) FROM products WHERE stock <= COALESCE(min_stock_alert, 3) AND is_active=1 AND type='product') AS low_stock
    `),
    // Current period stats
    dbQuery<any[]>(`
      SELECT
        COUNT(*) AS new_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS period_revenue,
        (SELECT COUNT(*) FROM users u WHERE ${dateFilter.replace(/created_at/g, 'u.created_at')}) AS new_users
      FROM orders WHERE ${dateFilter}
    `),
    // Previous period stats (for trend calculation)
    dbQuery<any[]>(`
      SELECT
        COUNT(*) AS new_orders,
        COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END), 0) AS period_revenue,
        (SELECT COUNT(*) FROM users u WHERE ${prevDateFilter.replace(/created_at/g, 'u.created_at')}) AS new_users
      FROM orders WHERE ${prevDateFilter}
    `),
    // Recent orders (current period)
    dbQuery<RecentOrder[]>(`
      SELECT o.order_number, o.status, o.total, o.created_at, u.full_name AS user_name
      FROM orders o JOIN users u ON u.id = o.user_id
      WHERE ${dateFilter.replace(/created_at/g, 'o.created_at')}
      ORDER BY o.created_at DESC LIMIT 10
    `),
    // Chart data
    dbQuery<{ date: string; amount: number }[]>(`
      SELECT ${PERIOD_SQL[period].groupBy} as date, COALESCE(SUM(total), 0) as amount
      FROM orders WHERE status != 'cancelled' AND ${dateFilter}
      GROUP BY date ORDER BY date ASC
    `),
    dbQuery<{ status: string; count: number }[]>(`
      SELECT status, COUNT(*) as count FROM orders WHERE ${dateFilter} GROUP BY status
    `),
    dbQuery<{ name: string; quantity: number }[]>(`
      SELECT COALESCE(p.name, oi.product_name) as name, SUM(oi.quantity) as quantity
      FROM order_items oi LEFT JOIN products p ON oi.product_id = p.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.status != 'cancelled' AND ${dateFilter.replace(/created_at/g, 'o.created_at')}
      GROUP BY oi.product_id ORDER BY quantity DESC LIMIT 5
    `),
  ]);

  return { statsRows, periodCurrent: periodCurrent[0] as PeriodStats, periodPrev: periodPrev[0] as PeriodStats, recentOrders, salesRaw, statusData, topProducts };
}

function calcTrend(curr: number, prev: number): { pct: number; dir: 'up' | 'down' | 'same' } {
  if (prev === 0 && curr === 0) return { pct: 0, dir: 'same' };
  if (prev === 0) return { pct: 100, dir: 'up' };
  const pct = Math.round(((curr - prev) / prev) * 100);
  return { pct: Math.abs(pct), dir: pct > 0 ? 'up' : pct < 0 ? 'down' : 'same' };
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const sp = await searchParams;
  const period: Period = (['today', '7d', '30d', '365d'].includes(sp.period ?? '') ? sp.period : '7d') as Period;
  const { statsRows, periodCurrent, periodPrev, recentOrders, salesRaw, statusData, topProducts } = await getDashboardData(period);

  const stats: Stats = statsRows[0];

  const trends = {
    orders:  calcTrend(periodCurrent.new_orders,     periodPrev.new_orders),
    revenue: calcTrend(periodCurrent.period_revenue, periodPrev.period_revenue),
    users:   calcTrend(periodCurrent.new_users,      periodPrev.new_users),
  };

  // Build complete salesData array
  let salesData: { date: string; amount: number }[];
  if (period === 'today') {
    salesData = Array.from({ length: 24 }, (_, h) => {
      const hourStr = String(h).padStart(2, '0');
      const match = salesRaw.find(r => r.date === hourStr);
      return { date: `${hourStr}:00`, amount: match?.amount ?? 0 };
    });
  } else if (period === '365d') {
    const now = new Date();
    salesData = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const match = salesRaw.find(r => r.date === key);
      return { date: key, amount: match?.amount ?? 0 };
    });
  } else {
    const numDays = PERIOD_SQL[period].days + 1;
    salesData = Array.from({ length: numDays }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (numDays - 1 - i));
      const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const match = salesRaw.find(r => r.date === dateStr);
      return { date: dateStr, amount: match?.amount ?? 0 };
    });
  }

  type TrendInfo = { pct: number; dir: 'up' | 'down' | 'same' } | null;
  const STAT_CARDS: { icon: string; value: string | number; label: string; color: string; link: string; sub?: string; trend?: TrendInfo }[] = [
    {
      icon: '📦', value: stats.total_orders, label: 'Pedidos Totales', color: '#3498DB',
      link: '/admin/orders?showCompleted=true',
      sub: `+${periodCurrent.new_orders} este período`,
      trend: trends.orders,
    },
    {
      icon: '⏳', value: stats.pending_orders, label: 'Pendientes', color: '#F1C40F',
      link: '/admin/orders?status=pending',
    },
    {
      icon: '💰', value: `$${Number(stats.total_revenue).toFixed(2)}`, label: 'Ingresos Totales', color: '#2ECC71',
      link: '/admin/orders?showCompleted=true',
      sub: `$${Number(periodCurrent.period_revenue).toFixed(2)} este período`,
      trend: trends.revenue,
    },
    {
      icon: '👥', value: stats.total_users, label: 'Usuarios', color: '#9B59B6',
      link: '/admin/users',
      sub: `+${periodCurrent.new_users} nuevos`,
      trend: trends.users,
    },
    {
      icon: '🛍️', value: stats.total_products, label: 'Productos Activos', color: '#D4AF37',
      link: '/admin/products',
    },
    {
      icon: '⚠️', value: stats.low_stock, label: 'Stock Crítico', color: '#E74C3C',
      link: '/admin/products?filter=low-stock',
    },
  ];

  return (
    <>
      <div className="admin-topbar">
        <h1>📊 Dashboard</h1>
        <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <Link href="/admin/products/new" className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}>+ Nuevo Producto</Link>
        </div>
      </div>

      <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {STAT_CARDS.map(card => (
          <Link key={card.label} href={card.link} className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', position: 'relative', paddingBottom: card.sub ? '2.8rem' : undefined }}>
            <div className="stat-icon">{card.icon}</div>
            <div className="stat-value" style={{ color: card.color }}>{card.value}</div>
            <div className="stat-label">{card.label}</div>
            {card.sub && (
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.2 }}>
                {card.sub}
              </div>
            )}
            {card.trend && card.trend.dir !== 'same' && (
              <div style={{
                position: 'absolute', bottom: '0.7rem', right: '0.8rem',
                fontSize: '0.72rem', fontWeight: 700,
                color: card.trend.dir === 'up' ? '#2ecc71' : '#e74c3c',
                display: 'flex', alignItems: 'center', gap: '2px',
              }}>
                {card.trend.dir === 'up' ? '▲' : '▼'} {card.trend.pct}%
              </div>
            )}
          </Link>
        ))}
      </div>

      <AdminChartsClient salesData={salesData} statusData={statusData} topProducts={topProducts} period={period} periodLabel={PERIOD_SQL[period].label} />

      <div className="desktop-only table-card">
        <div style={{ padding: '1rem 1.2rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.95rem' }}>Pedidos Recientes</h3>
          <Link href="/admin/orders" style={{ fontSize: '0.8rem', color: 'var(--gold)' }}>Ver todos →</Link>
        </div>
        <table>
          <thead>
            <tr>
              <th>Orden</th><th>Cliente</th><th>Estado</th><th>Total</th><th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {recentOrders.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Sin pedidos en este período.</td></tr>
            ) : recentOrders.map(order => (
              <tr key={order.order_number}>
                <td>
                  <Link href={`/admin/orders?search=${order.order_number}&showCompleted=true`} style={{ textDecoration: 'none' }}>
                    <span style={{ color: 'var(--gold)', fontWeight: 600, textDecoration: 'underline' }}>{order.order_number}</span>
                  </Link>
                </td>
                <td>{order.user_name}</td>
                <td><span className={`status-badge ${STATUS_CLASS[order.status] || ''}`}>{order.status}</span></td>
                <td style={{ fontWeight: 600 }}>${Number(order.total).toFixed(2)}</td>
                <td style={{ color: 'var(--text-muted)' }}>{new Date(order.created_at).toLocaleDateString('es-VE')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mobile-only" style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.95rem', margin: 0 }}>Pedidos Recientes</h3>
          <Link href="/admin/orders" style={{ fontSize: '0.8rem', color: 'var(--gold)' }}>Ver todos →</Link>
        </div>
        <div className="mobile-card-grid">
          {recentOrders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin pedidos en este período.</div>
          ) : recentOrders.map(order => (
            <Link key={order.order_number} href={`/admin/orders?search=${order.order_number}&showCompleted=true`} style={{ textDecoration: 'none', color: 'inherit' }} className="mobile-data-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'monospace' }}>{order.order_number}</span>
                <span className={`status-badge ${STATUS_CLASS[order.status] || ''}`} style={{ transform: 'scale(0.85)', transformOrigin: 'right center' }}>{order.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.8rem', fontSize: '0.82rem' }}>
                <span style={{ color: 'var(--text)' }}>{order.user_name}</span>
                <strong style={{ color: 'var(--gold)' }}>${Number(order.total).toFixed(2)}</strong>
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.4rem', textAlign: 'right' }}>
                {new Date(order.created_at).toLocaleDateString('es-VE')}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
