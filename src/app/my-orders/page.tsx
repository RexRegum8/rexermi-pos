import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { dbQuery } from '@/lib/db';
import Link from 'next/link';
import MyOrdersClient from './MyOrdersClient';

interface Order {
  id: number;
  order_number: string;
  status: string;
  total: number;
  payment_method: string;
  created_at: string;
  item_count: number;
  is_reviewed: number;
}

export const metadata = { title: 'Mis Pedidos — Rexermi Marketplace' };

export default async function MyOrdersPage() {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/my-orders');

  // 1. Fetch user orders and check if they have reviews
  const orders = await dbQuery<Order[]>(
    `SELECT o.*, COUNT(oi.id) AS item_count,
            (SELECT COUNT(*) FROM product_reviews pr WHERE pr.order_id = o.id) > 0 AS is_reviewed
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.user_id = ?
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    [session.id]
  );

  // 2. Fetch all products/items in these orders to display in the rating modal
  const orderItems = await dbQuery<any[]>(
    `SELECT oi.order_id, oi.product_id, oi.product_name, oi.price, oi.quantity,
            p.image, p.slug
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     LEFT JOIN products p ON oi.product_id = p.id
     WHERE o.user_id = ?`,
    [session.id]
  );

  // 3. Merge products into their respective orders
  const ordersWithItems = orders.map(order => ({
    ...order,
    items: orderItems.filter(item => item.order_id === order.id)
  }));

  return (
    <section className="section">
      <div className="section-inner">
        <div className="page-hero" style={{ background: 'none', padding: '5rem 0 2rem' }}>
          <span className="section-tag">Historial</span>
          <h1>📦 Mis Pedidos</h1>
          <p>Revisa el estado de todas tus compras y califica tus entregas</p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1.2rem', marginBottom: '1.5rem' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.88rem' }}>
            ¿Necesitas actualizar tus datos de entrega predeterminados, Cédula o número de teléfono?
          </p>
          <Link href="/profile" className="btn-outline" style={{ display: 'inline-flex', fontSize: '0.85rem', padding: '0.55rem 1rem', alignItems: 'center', minHeight: 'auto' }}>
            👤 Editar Mi Perfil
          </Link>
        </div>

        {ordersWithItems.length === 0 ? (
          <div className="empty-state" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <div className="empty-icon">📭</div>
            <h3>Sin pedidos aún</h3>
            <p style={{ marginBottom: '1.5rem' }}>Aún no has realizado ninguna compra.</p>
            <Link href="/" className="btn-primary">🛍️ Ir a la Tienda</Link>
          </div>
        ) : (
          <MyOrdersClient initialOrders={ordersWithItems} />
        )}
      </div>
    </section>
  );
}
