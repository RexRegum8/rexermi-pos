import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { getSetting } from '@/lib/settings';

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  try {
    const commissionRateStr = await getSetting('commission_rate', '5.0');
    const commissionRate = parseFloat(commissionRateStr) || 5.0;

    // 1. Calculate sales and commissions per vendor
    const vendorSales = await dbQuery<any[]>(
      `SELECT 
         u.id as vendor_id,
         u.full_name as vendor_name,
         u.email as vendor_email,
         COUNT(o.id) as total_orders,
         SUM(o.total) as total_sales,
         SUM(CASE 
                WHEN o.payment_method = 'Efectivo' THEN o.total 
                WHEN o.payment_method = 'Mixto' THEN COALESCE(CAST(json_extract(o.payment_ref, '$.breakdown.Efectivo') AS REAL), 0.0)
                ELSE 0.0 
              END) as cash_sales,
         (SUM(o.total) * ? / 100.0) as commission_amount
       FROM orders o
       JOIN cash_closures cc ON o.cash_closure_id = cc.id
       JOIN users u ON cc.user_id = u.id
       GROUP BY u.id, u.full_name, u.email`,
      [commissionRate]
    );

    // 2. Fetch cash closures list
    const closures = await dbQuery<any[]>(
      `SELECT 
         cc.*,
         u.full_name as cashier_name
       FROM cash_closures cc
       JOIN users u ON cc.user_id = u.id
       ORDER BY cc.opened_at DESC`
    );

    // 3. Fetch supplier statistics (desempeño de proveedores)
    const supplierStats = await dbQuery<any[]>(
      `SELECT 
         s.id AS supplier_id,
         s.name AS supplier_name,
         s.phone AS supplier_phone,
         COUNT(CASE WHEN po.status = 'received' THEN po.id END) AS total_orders,
         SUM(CASE WHEN po.status = 'received' THEN po.total_cost ELSE 0 END) AS total_cost,
         AVG(CASE WHEN po.status = 'received' AND po.received_at IS NOT NULL THEN (JulianDay(po.received_at) - JulianDay(po.created_at)) END) AS avg_lead_time_days
       FROM suppliers s
       LEFT JOIN purchase_orders po ON po.supplier_id = s.id
       GROUP BY s.id, s.name, s.phone`
    );

    return NextResponse.json({
      success: true,
      commissionRate,
      vendorSales,
      closures,
      supplierStats
    });
  } catch (error) {
    console.error('Error fetching sales summary report:', error);
    return NextResponse.json({ error: 'Error al obtener el reporte de ventas.' }, { status: 500 });
  }
}
