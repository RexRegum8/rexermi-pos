import { dbQuery } from '@/lib/db';
import PurchasesClient from './PurchasesClient';

export const metadata = { title: 'Compras y Reposición — Admin Rexermi' };
export const dynamic = 'force-dynamic';

export default async function PurchasesPage() {
  const categories = await dbQuery<any[]>('SELECT id, name FROM categories ORDER BY name');
  return <PurchasesClient categories={categories} />;
}
