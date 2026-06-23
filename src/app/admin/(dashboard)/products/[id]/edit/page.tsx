import { dbQuery } from '@/lib/db';
import { redirect } from 'next/navigation';
import ProductForm from '../../ProductForm';

export const metadata = { title: 'Editar Producto — Admin Rexermi' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [products, categories, allProducts, suppliers] = await Promise.all([
    dbQuery<any[]>('SELECT * FROM products WHERE id = ?', [id]),
    dbQuery<{ id: number; name: string }[]>('SELECT id, name FROM categories WHERE is_active=1 ORDER BY name'),
    dbQuery<{ id: number; name: string }[]>("SELECT id, name FROM products WHERE is_active=1 AND type='product' ORDER BY name"),
    dbQuery<{ id: number; name: string }[]>('SELECT id, name FROM suppliers ORDER BY name'),
  ]);

  if (!products.length) redirect('/admin/products');
  const p = products[0];

  return (
    <>
      <div className="admin-topbar">
        <h1>✏️ Editar: {p.name}</h1>
      </div>
      <ProductForm
        productId={p.id}
        categories={categories}
        products={allProducts}
        suppliers={suppliers}
        initialData={{
          name: p.name, slug: p.slug,
          category_id: String(p.category_id || ''),
          short_desc: p.short_desc || '', description: p.description || '',
          price: String(p.price), stock: String(p.stock),
          type: p.type, is_featured: !!p.is_featured, is_active: !!p.is_active,
          es_subproducto: !!p.es_subproducto,
          id_producto_padre: p.id_producto_padre ? String(p.id_producto_padre) : '',
          unidades_por_padre: p.unidades_por_padre ? String(p.unidades_por_padre) : '',
          supplier_id: p.supplier_id ? String(p.supplier_id) : '',
          purchase_url: p.purchase_url || '',
          min_stock_alert: p.min_stock_alert !== undefined && p.min_stock_alert !== null ? String(p.min_stock_alert) : '3',
          barcode: p.barcode || '',
          price_type: p.price_type || 'fixed',
          price_max: p.price_max ? String(p.price_max) : '',
          image: p.image || '',
          image2: p.image2 || '',
          image3: p.image3 || '',
        }}
      />
    </>
  );
}
