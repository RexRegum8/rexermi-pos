import { NextRequest, NextResponse } from 'next/server';

import { dbQuery } from '@/lib/db';
import { verifyAdminToken } from '@/lib/auth';

// Helper to calculate CPU usage over a short sampling interval (100ms)
function getCpuAverage() {
  const isEdge = typeof EdgeRuntime === 'string';
  if (isEdge) return { idle: 0, total: 0 };
  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const os = requireFunc('os');
  const cpus = os.cpus();
  let idleMs = 0;
  let totalMs = 0;
  for (const cpu of cpus) {
    for (const type in cpu.times) {
      totalMs += (cpu.times as any)[type];
    }
    idleMs += cpu.times.idle;
  }
  return {
    idle: idleMs / (cpus.length || 1),
    total: totalMs / (cpus.length || 1)
  };
}

async function getCpuUsage(delay = 100): Promise<number> {
  const isEdge = typeof EdgeRuntime === 'string';
  if (isEdge) return 0;
  const start = getCpuAverage();
  await new Promise((resolve) => setTimeout(resolve, delay));
  const end = getCpuAverage();
  const idleDifference = end.idle - start.idle;
  const totalDifference = end.total - start.total;
  if (totalDifference === 0) return 0;
  return Math.min(100, Math.max(0, 100 - Math.floor((100 * idleDifference) / totalDifference)));
}

export async function GET(req: NextRequest) {
  const admin = await verifyAdminToken(req);
  console.log('--- SERVER STATUS API CALL ---');
  console.log('Authorization Header:', req.headers.get('authorization'));
  console.log('Admin Session Verified:', !!admin);
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado.' }, { status: 401 });
  }

  try {
    // 1. Hardware Status
    const isEdge = typeof EdgeRuntime === 'string';
    let cpuUsage = 0;
    let totalMem = 0;
    let freeMem = 0;
    let uptime = 0;
    let platform = 'edge';
    
    if (!isEdge) {
      const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
      const os = requireFunc('os');
      cpuUsage = await getCpuUsage(100);
      totalMem = os.totalmem();
      freeMem = os.freemem();
      uptime = os.uptime();
      platform = process.platform;
    }
    const usedMem = totalMem - freeMem;

    // 2. Database Status
    let dbOk = false;
    let dbMode = 'unknown';
    try {
      // Test settings query
      const testQuery = await dbQuery('SELECT 1 FROM settings LIMIT 1');
      if (testQuery && testQuery.length > 0) {
        dbOk = true;
      }
      // Check journal mode if not on D1 (D1 doesn't need WAL checking)
      if (!isEdge) {
        const pragmaRows = await dbQuery('PRAGMA journal_mode');
        const pragmaRow = pragmaRows[0];
        if (pragmaRow) {
          dbMode = pragmaRow.journal_mode.toUpperCase();
        }
      } else {
        dbMode = 'D1';
      }
    } catch (dbErr: any) {
      console.error('Error verifying database status:', dbErr);
    }

    // 3. Pending Notifications / Action Counters
    let pendingOrders = 0;
    let lowStockProducts = 0;
    try {
      const ordersRows = await dbQuery<{ count: number }[]>("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'");
      const ordersRow = ordersRows[0];
      if (ordersRow) {
        pendingOrders = ordersRow.count;
      }

      const productsRows = await dbQuery<{ count: number }[]>("SELECT COUNT(*) as count FROM products WHERE stock <= COALESCE(min_stock_alert, 3) AND is_active = 1 AND type = 'product'");
      const productsRow = productsRows[0];
      if (productsRow) {
        lowStockProducts = productsRow.count;
      }
    } catch (notifErr: any) {
      console.error('Error fetching admin notification counts:', notifErr);
    }

    return NextResponse.json({
      success: true,
      hardware: {
        cpu: cpuUsage,
        memory: {
          total: totalMem,
          free: freeMem,
          used: usedMem,
          usagePercentage: Math.round((usedMem / totalMem) * 100)
        },
        platform,
        uptime
      },
      database: {
        connected: dbOk,
        mode: dbMode,
        isWal: dbMode === 'WAL'
      },
      notifications: {
        pendingOrders,
        lowStockAlerts: lowStockProducts,
        totalAlerts: pendingOrders + lowStockProducts
      }
    });

  } catch (error: any) {
    console.error('Server Control GET Status Error:', error);
    return NextResponse.json({
      error: 'Error al consultar el estado del servidor.'
    }, { status: 500 });
  }
}
