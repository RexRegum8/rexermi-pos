import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { getSetting } from '@/lib/settings';

export const runtime = 'edge';

let XLSX: any = null;

if (typeof EdgeRuntime !== 'string') {
  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  XLSX = requireFunc('xlsx');
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json(
      { error: 'La generación de reportes en Excel no está soportada en entornos serverless (Cloudflare Pages).' },
      { status: 501 }
    );
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
         SUM(CASE WHEN o.payment_method = 'Efectivo' THEN o.total ELSE 0 END) as cash_sales,
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
         cc.id,
         u.full_name as cashier_name,
         cc.opened_at,
         cc.closed_at,
         cc.opening_amount,
         cc.expected_amount,
         cc.actual_amount,
         cc.notes,
         cc.status
       FROM cash_closures cc
       JOIN users u ON cc.user_id = u.id
       ORDER BY cc.opened_at DESC`
    );

    // Map to user-friendly Excel objects
    const vendorSheetData = vendorSales.map(v => ({
      'ID Vendedor': v.vendor_id,
      'Nombre Vendedor': v.vendor_name,
      'Correo': v.vendor_email,
      'Pedidos Procesados': v.total_orders,
      'Ventas Totales ($)': v.total_sales,
      'Ventas en Efectivo ($)': v.cash_sales,
      'Porcentaje Comisión (%)': commissionRate,
      'Monto Comisión ($)': v.commission_amount
    }));

    const closureSheetData = closures.map(c => {
      const discrepancy = c.status === 'closed' ? (c.actual_amount - c.expected_amount) : 0;
      return {
        'ID Cierre': c.id,
        'Cajero': c.cashier_name,
        'Fecha Apertura': c.opened_at ? new Date(c.opened_at).toLocaleString() : '',
        'Fecha Cierre': c.closed_at ? new Date(c.closed_at).toLocaleString() : 'Abierta',
        'Monto Apertura ($)': c.opening_amount,
        'Monto Esperado ($)': c.expected_amount,
        'Monto Real Contado ($)': c.actual_amount !== null ? c.actual_amount : '',
        'Diferencia/Discrepancia ($)': c.actual_amount !== null ? discrepancy : '',
        'Notas': c.notes || '',
        'Estado': c.status === 'open' ? 'Abierta' : 'Cerrada'
      };
    });

    const wb = XLSX.utils.book_new();
    const wsVendors = XLSX.utils.json_to_sheet(vendorSheetData);
    const wsClosures = XLSX.utils.json_to_sheet(closureSheetData);

    XLSX.utils.book_append_sheet(wb, wsVendors, 'Comisiones de Vendedores');
    XLSX.utils.book_append_sheet(wb, wsClosures, 'Cierres de Caja');

    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new Response(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="reporte_ventas_cierres.xlsx"'
      }
    });
  } catch (error) {
    console.error('Error generating Excel report:', error);
    return NextResponse.json({ error: 'Error al generar el reporte Excel.' }, { status: 500 });
  }
}
