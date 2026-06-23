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

export async function GET(req: Request) {
  const admin = await verifyAdminToken(req as any);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json({ error: 'La exportación local de base de datos no está disponible en la nube.' }, { status: 400 });
  }

  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const Database = requireFunc('better-sqlite3');
  const path = requireFunc('path');
  const XLSX = requireFunc('xlsx');
  const dbPath = path.join(process['cwd'](), 'src', 'data', 'database.sqlite');

  try {
    const db = new Database(dbPath, { readonly: true });
    const workbook = XLSX.utils.book_new();

    for (const table of TABLES) {
      let rows: any[] = [];
      try {
        rows = db.prepare(`SELECT * FROM ${table.name}`).all();
      } catch {
        rows = [];
      }
      const ws = rows.length > 0
        ? XLSX.utils.json_to_sheet(rows)
        : XLSX.utils.json_to_sheet([{ info: `Tabla ${table.name} vacía o no existe` }]);
      XLSX.utils.book_append_sheet(workbook, ws, table.label);
    }

    // Add metadata sheet
    const meta = [{
      campo: 'Exportado',     valor: new Date().toISOString() },
    { campo: 'Version_App',   valor: '1.0.0' },
    { campo: 'Motor_BD',      valor: 'SQLite / better-sqlite3' },
    { campo: 'Tablas',        valor: TABLES.map(t => t.name).join(', ') },
    ];
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(meta), 'Metadata');

    db.close();

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `rexermi-backup-${new Date().toISOString().slice(0, 10)}.xlsx`;

    // Update last backup time in settings
    const dbw = new Database(dbPath);
    try {
      dbw.prepare(`INSERT OR REPLACE INTO settings (\`key\`, value, \`group\`, label) VALUES ('last_backup_at', ?, 'backup', 'Último respaldo')`).run(new Date().toISOString());
    } catch { /* ignore */ } finally { dbw.close(); }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (err: any) {
    console.error('[backup/export]', err);
    return NextResponse.json({ error: err.message || 'Error al exportar' }, { status: 500 });
  }
}
