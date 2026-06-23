export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export async function GET() {
  try {
    // Fetch the last 10 successful storefront orders
    const recentOrders = await dbQuery<any[]>(`
      SELECT o.id, o.created_at, o.shipping_city, u.full_name as customer_name,
             (SELECT p.name FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id LIMIT 1) as product_name,
             (SELECT p.price FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id LIMIT 1) as product_price,
             (SELECT p.image FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = o.id LIMIT 1) as product_image
      FROM orders o
      JOIN users u ON o.user_id = u.id
      WHERE o.status != 'cancelled'
      ORDER BY o.created_at DESC
      LIMIT 10
    `);

    const sales = recentOrders
      .filter(o => o.product_name && o.customer_name)
      .map(o => {
        // Obfuscate last name for privacy
        const nameParts = o.customer_name.trim().split(/\s+/);
        const firstName = nameParts[0];
        const initial = nameParts[1] ? nameParts[1][0] + '.' : '';
        const nameDisplay = initial ? `${firstName} ${initial}` : firstName;

        return {
          id: o.id,
          name: nameDisplay,
          city: o.shipping_city || 'Caracas',
          productName: o.product_name,
          price: parseFloat(o.product_price || '0'),
          image: o.product_image,
          createdAt: o.created_at
        };
      });

    return NextResponse.json({ success: true, sales });
  } catch (error) {
    console.error('Error fetching recent sales:', error);
    return NextResponse.json({ success: false, sales: [] });
  }
}
