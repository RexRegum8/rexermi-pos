import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { dbQuery } from '@/lib/db';
import Link from 'next/link';

interface OrderItem { product_name: string; quantity: number; price: number; subtotal: number; }

const getReceiptUrl = (proof: string) => {
  if (!proof) return '';
  if (proof.startsWith('http')) return proof;
  const filename = proof.includes('/') ? proof.split('/').pop() : proof;
  return `/api/receipts/${filename}`;
};

interface OrderDetail {
  id: number; order_number: string; status: string; subtotal: number;
  total: number; payment_method: string; payment_ref: string | null;
  payment_proof: string | null; customer_message: string | null;
  shipping_address: string | null; shipping_city: string | null;
  admin_notes: string | null; created_at: string;
  shipping_method: string | null; shipping_cost: number | null;
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending: { label: '⏳ Pendiente', class: 'status-pending' },
  paid: { label: '✅ Pagado', class: 'status-paid' },
  processing: { label: '⚙️ En proceso', class: 'status-processing' },
  shipped: { label: '🚚 Enviado', class: 'status-shipped' },
  delivered: { label: '📦 Entregado', class: 'status-delivered' },
  cancelled: { label: '❌ Cancelado', class: 'status-cancelled' },
};

export const metadata = { title: 'Detalle de Pedido — Rexermi Marketplace' };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect('/login?redirect=/my-orders');

  const { id } = await params;
  const numericId = parseInt(id, 10);
  if (isNaN(numericId)) redirect('/my-orders');

  const orders = await dbQuery<OrderDetail[]>(
    'SELECT * FROM orders WHERE id = ? AND user_id = ?', [numericId, session.id]
  );
  if (!orders.length) redirect('/my-orders');

  const order = orders[0];
  const items = await dbQuery<OrderItem[]>(
    'SELECT * FROM order_items WHERE order_id = ?', [order.id]
  );
  const status = STATUS_LABELS[order.status] || { label: order.status, class: '' };
  const isPickup = !!(order.shipping_method?.toLowerCase().includes('retiro'));

  return (
    <section className="section">
      <div className="section-inner" style={{ maxWidth: '760px', margin: '0 auto', padding: '1rem' }}>
        <div style={{ paddingTop: '5rem', marginBottom: '2rem' }}>
          <Link href="/my-orders" style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textDecoration: 'none' }}>
            ← Volver a Mis Pedidos
          </Link>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
              Pedido {order.order_number}
            </h1>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.3rem 0 0' }}>
              Realizado el {new Date(order.created_at).toLocaleDateString('es-VE')}
            </p>
          </div>
          <span className={`status-badge ${status.class}`}>{status.label}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Products Table Card */}
          <div className="table-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>🛒 Productos Comprados</h3>
            <div className="desktop-only">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 'auto' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', paddingBottom: '0.8rem' }}>Producto</th>
                    <th style={{ textAlign: 'center', paddingBottom: '0.8rem' }}>Cantidad</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.8rem' }}>Precio</th>
                    <th style={{ textAlign: 'right', paddingBottom: '0.8rem' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.8rem 0', fontWeight: 500 }}>{item.product_name}</td>
                      <td style={{ padding: '0.8rem 0', textAlign: 'center' }}>{item.quantity}</td>
                      <td style={{ padding: '0.8rem 0', textAlign: 'right' }}>${Number(item.price).toFixed(2)}</td>
                      <td style={{ padding: '0.8rem 0', textAlign: 'right', fontWeight: 600 }}>${Number(item.subtotal).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-only" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
              {items.map((item, idx) => (
                <div key={idx} style={{ padding: '0.8rem 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{item.product_name}</strong>
                    <strong style={{ fontSize: '0.9rem', color: 'var(--gold)', marginLeft: '0.5rem' }}>${Number(item.subtotal).toFixed(2)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Cantidad: {item.quantity}</span>
                    <span>Precio: ${Number(item.price).toFixed(2)} c/u</span>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', fontSize: '0.85rem' }}>
                <span>Subtotal</span><span>${Number(order.subtotal).toFixed(2)}</span>
              </div>
              {order.shipping_method && (
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', fontSize: '0.85rem' }}>
                  <span>Envío ({order.shipping_method})</span>
                  <span>{Number(order.shipping_cost || 0) > 0 ? `$${Number(order.shipping_cost).toFixed(2)}` : 'Gratis'}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '250px', fontSize: '1.05rem', marginTop: '0.8rem', color: 'var(--gold)', fontWeight: 700 }}>
                <span>Total</span><span>${Number(order.total).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Shipping Address */}
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
            {isPickup ? (
              <>
                <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>🏪 Retiro en Tienda</h3>
                <p style={{ fontSize: '0.85rem', marginBottom: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                  Método: {order.shipping_method} (Gratis)
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  Has seleccionado retirar tu compra directamente en nuestra tienda física. Por favor contáctanos por soporte técnico interno o WhatsApp para coordinar tu retiro.
                </p>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>📦 Envío</h3>
                {order.shipping_method && (
                  <p style={{ fontSize: '0.85rem', marginBottom: '0.8rem', color: 'var(--gold)', fontWeight: 600 }}>
                    Método: {order.shipping_method} {Number(order.shipping_cost || 0) > 0 ? `($${Number(order.shipping_cost).toFixed(2)})` : '(Gratis)'}
                  </p>
                )}
                <p style={{ fontSize: '0.85rem', marginBottom: '0.4rem' }}>{order.shipping_address || 'Sin dirección indicada'}</p>
                <p style={{ fontSize: '0.85rem' }}>{order.shipping_city || ''}</p>
              </>
            )}
            
            {order.customer_message && (
              <>
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '1rem 0' }} />
                <p style={{ fontSize: '0.8rem' }}>📝 <strong>Nota del cliente:</strong> {order.customer_message}</p>
              </>
            )}
          </div>

          {/* Receipt */}
          {order.payment_proof && (
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem', fontWeight: 600 }}>🧾 Comprobante de Pago</h3>
              <a href={getReceiptUrl(order.payment_proof)} target="_blank" rel="noopener noreferrer">
                <img src={getReceiptUrl(order.payment_proof)} alt="Comprobante" style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '8px', objectFit: 'contain' }} />
              </a>
            </div>
          )}

          {/* Admin notes */}
          {order.admin_notes && (
            <div className="alert alert-success" style={{ background: 'var(--success-bg)', border: '1px solid var(--success-border)', borderRadius: 'var(--radius)', padding: '1rem', color: 'var(--success-text)' }}>
              <strong>Nota del vendedor:</strong> {order.admin_notes}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
