export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const RESTORABLE_TABLES = ['categories', 'products', 'users', 'coupons', 'orders', 'order_items', 'inventory_movements', 'settings'];

const CORRECT_MAP: Record<string, string> = {
  'Categorias':             'categories',
  'Productos':              'products',
  'Usuarios':               'users',
  'Pedidos':                'orders',
  'Items_Pedidos':          'order_items',
  'Cupones':                'coupons',
  'Movimientos_Inventario': 'inventory_movements',
  'Configuracion':          'settings',
};

export async function POST(req: Request) {
  const admin = await verifyAdminToken(req as any);
  if (!admin) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  if (typeof EdgeRuntime === 'string') {
    return NextResponse.json({ error: 'La importación local de base de datos no está disponible en la nube.' }, { status: 400 });
  }

  const requireFunc = typeof __webpack_require__ === "function" ? __non_webpack_require__ : require;
  const Database = requireFunc('better-sqlite3');
  const path = requireFunc('path');
  const XLSX = requireFunc('xlsx');
  const dbPath = path.join(process['cwd'](), 'src', 'data', 'database.sqlite');

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se recibió archivo.' }, { status: 400 });

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls'].includes(ext ?? '')) {
      return NextResponse.json({ error: 'Solo se aceptan archivos .xlsx o .xls' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    const db = new Database(dbPath);
    const results: string[] = [];
    let totalRows = 0;

    const importAll = db.transaction(() => {
      for (const sheetName of workbook.SheetNames) {
        const tableName = CORRECT_MAP[sheetName];
        if (!tableName || !RESTORABLE_TABLES.includes(tableName)) continue;

        const ws = workbook.Sheets[sheetName];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
        if (!rows.length) { results.push(`${sheetName}: vacío, saltado`); continue; }

        const pragmaRows = db.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
        const validCols = pragmaRows.map(c => c.name);

        const allCols = Object.keys(rows[0]).filter(c => validCols.includes(c));
        if (!allCols.length) continue;

        if (tableName === 'settings') {
          for (const row of rows) {
            if (!row.key) continue;
            db.prepare(`INSERT OR REPLACE INTO settings (\`key\`, value, \`group\`, label) VALUES (?, ?, ?, ?)`).run(
              row.key, row.value ?? '', row.group ?? 'general', row.label ?? row.key
            );
          }
          results.push(`${sheetName}: ${rows.length} ajustes restaurados (MERGE)`);
          totalRows += rows.length;
        } else {
          db.prepare(`DELETE FROM ${tableName}`).run();
          const placeholders = allCols.map(() => '?').join(', ');
          const insertStmt = db.prepare(`INSERT OR REPLACE INTO ${tableName} (${allCols.join(', ')}) VALUES (${placeholders})`);
          for (const row of rows) {
            insertStmt.run(...allCols.map(c => row[c]));
          }
          results.push(`${sheetName} → ${tableName}: ${rows.length} filas restauradas`);
          totalRows += rows.length;
        }
      }
    });

    importAll();
    db.close();

    return NextResponse.json({
      success: true,
      message: `Importación completada. ${totalRows} filas restauradas en ${results.length} tablas.`,
      details: results,
    });
  } catch (err: any) {
    console.error('[backup/import]', err);
    return NextResponse.json({ error: err.message || 'Error al importar' }, { status: 500 });
  }
}
