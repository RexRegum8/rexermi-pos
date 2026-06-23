import { Suspense } from 'react';
import { dbQuery } from '@/lib/db';
import Link from 'next/link';
import ProductsTable from './ProductsTable';
import { getAdminPermissions } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'Productos — Admin Rexermi' };
export const dynamic = 'force-dynamic';

interface Product {
  id: number; name: string; slug: string; price: number;
  stock: number; type: string; is_active: number; is_featured: number;
  cat_name: string | null; image: string | null; views: number;
  es_subproducto?: number; id_producto_padre?: number | null;
  unidades_por_padre?: number | null; parent_name?: string | null;
  parent_stock?: number | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  purchase_url?: string | null;
  barcode?: string | null;
}

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; category?: string; filter?: string }>;
}) {
  const permissions = await getAdminPermissions();
  if (!permissions || !permissions.edit_products) {
    redirect('/admin');
  }

  const resolvedParams = await searchParams;
  const page = parseInt(resolvedParams.page || '1', 10);
  const search = resolvedParams.search || '';
  const category = resolvedParams.category || '';
  const filter = resolvedParams.filter || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  let conditions: string[] = [];
  let params: any[] = [];

  if (search) {
    conditions.push("(p.name LIKE ? OR p.slug LIKE ? OR p.id LIKE ? OR p.barcode LIKE ?)");
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (category) {
    if (category === 'Sin categoría') {
      conditions.push("p.category_id IS NULL");
    } else {
      conditions.push("c.name = ?");
      params.push(category);
    }
  }

  if (filter === 'low-stock') {
    conditions.push("p.type = 'product' AND p.stock <= COALESCE(p.min_stock_alert, 3)");
  } else if (filter === 'active') {
    conditions.push("p.is_active = 1");
  } else if (filter === 'inactive') {
    conditions.push("p.is_active = 0");
  } else if (filter === 'pending') {
    conditions.push("p.is_active = 2");
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countQuery = `
    SELECT COUNT(p.id) AS total
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${whereClause}
  `;
  const countResult = await dbQuery<{ total: number }[]>(countQuery, params);
  const totalItems = countResult[0]?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / limit));

  // Get paginated products
  const productsQuery = `
    SELECT p.*, c.name AS cat_name,
           parent.name AS parent_name, parent.stock AS parent_stock,
           s.name AS supplier_name
    FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    LEFT JOIN products parent ON parent.id = p.id_producto_padre
    LEFT JOIN suppliers s ON s.id = p.supplier_id
    ${whereClause}
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;
  const productsParams = [...params, limit, offset];
  const products = await dbQuery<Product[]>(productsQuery, productsParams);

  // Get all categories for filter dropdown
  const catRows = await dbQuery<{ name: string }[]>('SELECT name FROM categories ORDER BY name ASC');
  const categoriesList = catRows.map(r => r.name);

  return (
    <>
      <div className="admin-topbar">
        <h1>🛍️ Gestión de Productos</h1>
        <Link href="/admin/products/new" className="btn-primary" style={{ fontSize: '0.85rem', padding: '0.6rem 1.2rem' }}>
          + Nuevo Producto
        </Link>
      </div>

      <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando tabla de productos...</div>}>
        <ProductsTable 
          initialProducts={products} 
          categoriesList={categoriesList}
          totalPages={totalPages}
          currentPage={page}
          totalItems={totalItems}
        />
      </Suspense>
    </>
  );
}
