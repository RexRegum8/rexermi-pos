import React from 'react';
import { dbQuery } from '@/lib/db';
import ReviewsClient from './ReviewsClient';

export const metadata = { title: 'Moderación de Calificaciones — Admin Rexermi' };
export const dynamic = 'force-dynamic';

export default async function AdminReviewsPage() {
  const reviews = await dbQuery<any[]>(
    `SELECT r.id, r.user_id, r.product_id, r.order_id, r.rating, r.comment, r.status, r.created_at,
            p.name as product_name, p.slug as product_slug, p.image as product_image,
            COALESCE(u.full_name, 'Cliente de Rexermi') as user_name, u.email as user_email,
            o.order_number
     FROM product_reviews r
     JOIN products p ON r.product_id = p.id
     LEFT JOIN users u ON r.user_id = u.id
     JOIN orders o ON r.order_id = o.id
     ORDER BY r.created_at DESC`
  );

  return (
    <>
      <div className="admin-topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', marginTop: '1rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700 }}>⭐ Moderación de Calificaciones</h1>
      </div>
      <ReviewsClient initialReviews={reviews} />
    </>
  );
}
