import { dbQuery } from '@/lib/db';
import AdminCouponActions from './AdminCouponActions';

export const metadata = { title: 'Cupones — Admin Rexermi' };
export const dynamic = 'force-dynamic';

interface Coupon {
  id: number; code: string; discount_type: string; discount_value: number;
  min_order: number; uses_left: number | null; is_active: number;
  expires_at: string | null; created_at: string;
}

export default async function AdminCouponsPage() {
  const coupons = await dbQuery<Coupon[]>('SELECT * FROM coupons ORDER BY created_at DESC');

  return (
    <>
      <div className="admin-topbar">
        <h1>🎫 Gestión de Cupones</h1>
      </div>
      <AdminCouponActions coupons={coupons} />
    </>
  );
}
