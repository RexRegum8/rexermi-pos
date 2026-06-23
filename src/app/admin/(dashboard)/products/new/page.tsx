import { dbQuery } from '@/lib/db';
import ProductForm from '../ProductForm';

export const metadata = { title: 'Nuevo Producto — Admin Rexermi' };

export default async function NewProductPage() {
  const [categories, products, suppliers] = await Promise.all([
    dbQuery<{ id: number; name: string }[]>('SELECT id, name FROM categories WHERE is_active=1 ORDER BY name'),
    dbQuery<{ id: number; name: string }[]>("SELECT id, name FROM products WHERE is_active=1 AND type='product' ORDER BY name"),
    dbQuery<{ id: number; name: string }[]>('SELECT id, name FROM suppliers ORDER BY name'),
  ]);

  return (
    <>
      <div className="admin-topbar">
        <h1>➕ Nuevo Producto</h1>
      </div>
      <ProductForm categories={categories} products={products} suppliers={suppliers} />
    </>
  );
}
