import { NextRequest, NextResponse } from 'next/server';
import { restoreFromSafeLocation, initNewDatabaseSchema, reinitializeDatabase } from '@/lib/db';
import Database from 'better-sqlite3';
import path from 'path';
import * as XLSX from 'xlsx';

const dbPath = path.join(process.cwd(), 'src', 'data', 'database.sqlite');

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

export async function POST(req: NextRequest) {
  try {
    // Check if recovery mode is active
    if (!(globalThis as any).isDbRecoveryMode) {
      return NextResponse.json({ success: false, error: 'El panel de recuperación solo está disponible cuando la base de datos no existe.' }, { status: 403 });
    }

    // Determine contentType
    const contentType = req.headers.get('content-type') || '';
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const action = formData.get('action') as string;
      const file = formData.get('file') as File | null;

      if (action === 'import_excel') {
        if (!file) {
          return NextResponse.json({ success: false, error: 'No se recibió ningún archivo Excel.' }, { status: 400 });
        }

        // 1. Initialize new empty database first
        const initSuccess = initNewDatabaseSchema();
        if (!initSuccess) {
          return NextResponse.json({ success: false, error: 'No se pudo inicializar la base de datos limpia antes de la importación.' }, { status: 500 });
        }

        // 2. Parse excel file and import tables
        const buffer = Buffer.from(await file.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        const dbConn = new Database(dbPath);
        let totalRows = 0;
        const results: string[] = [];

        const importAll = dbConn.transaction(() => {
          for (const sheetName of workbook.SheetNames) {
            const tableName = CORRECT_MAP[sheetName];
            if (!tableName || !RESTORABLE_TABLES.includes(tableName)) continue;

            const ws = workbook.Sheets[sheetName];
            const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: null });
            if (!rows.length) continue;

            const pragmaRows = dbConn.prepare(`PRAGMA table_info(${tableName})`).all() as { name: string }[];
            const validCols = pragmaRows.map(c => c.name);

            const allCols = Object.keys(rows[0]).filter(c => validCols.includes(c));
            if (!allCols.length) continue;

            if (tableName === 'settings') {
              for (const row of rows) {
                if (!row.key) continue;
                dbConn.prepare(`INSERT OR REPLACE INTO settings (\`key\`, value, \`group\`, label) VALUES (?, ?, ?, ?)`).run(
                  row.key, row.value ?? '', row.group ?? 'general', row.label ?? row.key
                );
              }
              totalRows += rows.length;
              results.push(`${sheetName}: ${rows.length} configuraciones`);
            } else {
              dbConn.prepare(`DELETE FROM ${tableName}`).run();
              const placeholders = allCols.map(() => '?').join(', ');
              const insertStmt = dbConn.prepare(`INSERT OR REPLACE INTO ${tableName} (${allCols.join(', ')}) VALUES (${placeholders})`);
              for (const row of rows) {
                insertStmt.run(...allCols.map(c => row[c]));
              }
              totalRows += rows.length;
              results.push(`${sheetName}: ${rows.length} filas`);
            }
          }
        });

        importAll();
        dbConn.close();

        // Reinitialize the global connection
        reinitializeDatabase();

        return NextResponse.json({
          success: true,
          message: `Base de datos reconstruida con éxito. Se importaron ${totalRows} registros en ${results.length} tablas desde el archivo Excel.`,
          details: results
        });
      }
    }

    // JSON action requests
    const body = (await req.json()) as any;
    const { action } = body;

    if (action === 'restore') {
      const success = restoreFromSafeLocation();
      if (success) {
        reinitializeDatabase();
        return NextResponse.json({ success: true, message: 'Base de datos restaurada con éxito desde la ubicación segura del sistema.' });
      } else {
        return NextResponse.json({ success: false, error: 'No se pudo restaurar el archivo. Es posible que no exista el respaldo seguro.' }, { status: 400 });
      }
    } else if (action === 'initialize') {
      const success = initNewDatabaseSchema();
      if (success) {
        reinitializeDatabase();
        return NextResponse.json({ success: true, message: 'Nueva base de datos inicializada correctamente con esquemas limpios.' });
      } else {
        return NextResponse.json({ success: false, error: 'Ocurrió un error al inicializar el esquema de la base de datos.' }, { status: 500 });
      }
    } else {
      return NextResponse.json({ success: false, error: 'Acción no válida.' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in recovery API route:', error);
    return NextResponse.json({ success: false, error: error.message || 'Error del servidor.' }, { status: 500 });
  }
}
