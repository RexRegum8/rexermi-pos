export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TABLES = [
  { name: 'users',                label: 'Usuarios' },
  { name: 'categories',           label: 'Categorias' },
  { name: 'products',             label: 'Productos' },
  { name: 'orders',               label: 'Pedidos' },
  { name: 'order_items',          label: 'Items_Pedidos' },
  { name: 'coupons',              label: 'Cupones' },
  { name: 'inventory_movements',  label: 'Movimientos_Inventario' },
  { name: 'settings',             label: 'Configuracion' },
];

function createBackupFile(requireFunc: any): string {
  const path = requireFunc('path');
  const fs = requireFunc('fs');
  const Database = requireFunc('better-sqlite3');
  const XLSX = requireFunc('xlsx');

  const dbPath = path.join(process['cwd'](), 'src', 'data', 'database.sqlite');
  const BACKUP_DIR = path.join(process['cwd'](), 'src', 'data', 'backups');

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  
  const db = new Database(dbPath, { readonly: true });
  const workbook = XLSX.utils.book_new();
  
  for (const table of TABLES) {
    let rows: any[] = [];
    try { rows = db.prepare(`SELECT * FROM ${table.name}`).all(); } catch { rows = []; }
    const ws = rows.length > 0
      ? XLSX.utils.json_to_sheet(rows)
      : XLSX.utils.json_to_sheet([{ info: `Tabla ${table.name} vacía` }]);
    XLSX.utils.book_append_sheet(workbook, ws, table.label);
  }
  
  const meta = [
    { campo: 'Exportado',   valor: new Date().toISOString() },
    { campo: 'Tipo',        valor: 'Automático' },
    { campo: 'Motor_BD',    valor: 'SQLite' },
  ];
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(meta), 'Metadata');
  db.close();

  const filename = `auto-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;
  const filePath = path.join(BACKUP_DIR, filename);
  XLSX.writeFile(workbook, filePath);
  
  // Keep only last 30 backups
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((f: string) => f.endsWith('.xlsx'))
    .sort()
    .reverse();
  if (files.length > 30) {
    files.slice(30).forEach((f: string) => {
      try { fs.unlinkSync(path.join(BACKUP_DIR, f)); } catch {}
    });
  }
  
  return filename;
}

export async function GET(req: Request) {
  const admin = await verifyAdminToken(req as any);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json({ triggered: false, message: 'Respaldos automáticos no disponibles en la nube (Cloudflare).' });
  }

  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const Database = requireFunc('better-sqlite3');
  const path = requireFunc('path');
  const dbPath = path.join(process['cwd'](), 'src', 'data', 'database.sqlite');
  const dbw = new Database(dbPath);

  try {
    // Read schedule settings
    const scheduleRow = dbw.prepare(`SELECT value FROM settings WHERE key = 'backup_schedule'`).get() as any;
    const lastBackupRow = dbw.prepare(`SELECT value FROM settings WHERE key = 'last_backup_at'`).get() as any;
    const schedule = scheduleRow?.value ?? 'daily';
    const lastBackup = lastBackupRow?.value ? new Date(lastBackupRow.value) : null;
    const now = new Date();

    let shouldBackup = false;
    if (!lastBackup) {
      shouldBackup = true;
    } else {
      const diffMs = now.getTime() - lastBackup.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      if (schedule === 'hourly'  && diffHours >= 1)   shouldBackup = true;
      if (schedule === 'daily'   && diffHours >= 24)  shouldBackup = true;
      if (schedule === 'weekly'  && diffHours >= 168) shouldBackup = true;
    }

    if (!shouldBackup) {
      return NextResponse.json({ triggered: false, schedule, lastBackup: lastBackup?.toISOString() ?? null });
    }

    const filename = createBackupFile(requireFunc);
    dbw.prepare(`INSERT OR REPLACE INTO settings (\`key\`, value, \`group\`, label) VALUES ('last_backup_at', ?, 'backup', 'Último respaldo')`).run(now.toISOString());

    return NextResponse.json({ triggered: true, filename, schedule, lastBackup: now.toISOString() });
  } catch (err: any) {
    console.error('[backup/auto-check]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  } finally {
    dbw.close();
  }
}

// Update schedule
export async function POST(req: Request) {
  const admin = await verifyAdminToken(req as any);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { schedule } = (await req.json()) as any;
  const valid = ['hourly', 'daily', 'weekly', 'manual'];
  if (!valid.includes(schedule)) return NextResponse.json({ error: 'Frecuencia inválida' }, { status: 400 });

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json({ success: false, error: 'Configuración de respaldo no disponible en la nube.' }, { status: 400 });
  }

  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const Database = requireFunc('better-sqlite3');
  const path = requireFunc('path');
  const dbPath = path.join(process['cwd'](), 'src', 'data', 'database.sqlite');
  const db = new Database(dbPath);

  try {
    db.prepare(`INSERT OR REPLACE INTO settings (\`key\`, value, \`group\`, label) VALUES ('backup_schedule', ?, 'backup', 'Frecuencia de respaldo')`).run(schedule);
    return NextResponse.json({ success: true, schedule });
  } finally {
    db.close();
  }
}

// List recent backups
export async function PUT(req: Request) {
  const admin = await verifyAdminToken(req as any);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json({ files: [] });
  }

  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const path = requireFunc('path');
  const fs = requireFunc('fs');
  const BACKUP_DIR = path.join(process['cwd'](), 'src', 'data', 'backups');

  try {
    if (!fs.existsSync(BACKUP_DIR)) return NextResponse.json({ files: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter((f: string) => f.endsWith('.xlsx'))
      .sort()
      .reverse()
      .slice(0, 20)
      .map((f: string) => {
        const stats = fs.statSync(path.join(BACKUP_DIR, f));
        return { name: f, size: stats.size, created: stats.birthtime.toISOString() };
      });
    return NextResponse.json({ files });
  } catch (err: any) {
    return NextResponse.json({ files: [], error: err.message });
  }
}
