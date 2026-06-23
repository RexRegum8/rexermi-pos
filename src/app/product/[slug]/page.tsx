import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { dbQuery } from '@/lib/db';
import { getSettings } from '@/lib/settings';
import { formatPrice } from '@/lib/helpers';
import ProductDetailClient from './ProductDetailClient';

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 0; // Always serve live DB updates

export async function generateMetadata({ params }: ProductPageProps) {
  const { slug } = await params;
  const products = await dbQuery<any[]>(
    'SELECT name, short_desc, image FROM products WHERE slug = ? AND is_active = 1',
    [slug]
  );
  const product = products[0];
  if (!product) return { title: 'Producto no encontrado | Rexermi' };

  return {
    title: `${product.name} | Rexermi`,
    description: product.short_desc || `Compra ${product.name} en Rexermi Marketplace`,
    openGraph: {
      title: product.name,
      description: product.short_desc || undefined,
      images: product.image ? [{ url: `/api/assets/uploads/${product.image}` }] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;

  // 1. Fetch settings
  const settings = await getSettings();
  const currencySymbol = settings['currency_symbol'] || '$';
  const contactPhone = settings['contact_phone'] || '';

  // 2. Fetch product details by slug
  const products = await dbQuery<any[]>(
    `SELECT p.*, c.name as cat_name, c.slug as cat_slug,
            parent.stock AS parent_stock, parent.name AS parent_name
     FROM products p 
     LEFT JOIN categories c ON p.category_id = c.id 
     LEFT JOIN products parent ON p.id_producto_padre = parent.id
     WHERE p.slug = ? AND p.is_active = 1`,
    [slug]
  );

  const product = products[0];
  if (!product) {
    notFound();
  }

  if (product.type === 'product' && product.es_subproducto === 1 && product.id_producto_padre !== null && product.unidades_por_padre > 0) {
    const parentStock = product.parent_stock !== null ? product.parent_stock : 0;
    product.stock = product.stock + (parentStock * product.unidades_por_padre);
  }

  // 3. Fetch secondary images
  const secImages = await dbQuery<any[]>(
    'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC, id ASC',
    [product.id]
  );

  // 4. Fetch related products
  const rawRelated = await dbQuery<any[]>(
    `SELECT p.*, c.name as cat_name, parent.stock AS parent_stock
     FROM products p 
     LEFT JOIN categories c ON p.category_id = c.id 
     LEFT JOIN products parent ON p.id_producto_padre = parent.id
     WHERE p.category_id = ? AND p.is_active = 1 AND p.id != ? 
     ORDER BY RANDOM() LIMIT 4`,
    [product.category_id, product.id]
  );

  const related = rawRelated.map(p => {
    let virtualStock = p.stock;
    if (p.type === 'product' && p.es_subproducto === 1 && p.id_producto_padre !== null && p.unidades_por_padre > 0) {
      const parentStock = p.parent_stock !== null ? p.parent_stock : 0;
      virtualStock = p.stock + (parentStock * p.unidades_por_padre);
    }
    return {
      ...p,
      stock: virtualStock
    };
  });

  // Fetch reviews for this product
  const reviews = await dbQuery<any[]>(
    `SELECT r.id, r.rating, r.comment, r.created_at,
            COALESCE(u.full_name, 'Cliente de Rexermi') as user_name
     FROM product_reviews r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.product_id = ? AND r.status = 'approved'
     ORDER BY r.created_at DESC`,
    [product.id]
  );

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
    : 0;

  return (
    <section className="section" style={{ paddingTop: '2rem' }}>
      <div className="section-inner">
        {/* Breadcrumb */}
        <nav className="breadcrumb" aria-label="Breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          <Link href="/" style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
            Inicio
          </Link>
          <span className="breadcrumb-sep" style={{ color: 'var(--border)' }}>&rsaquo;</span>
          {product.cat_slug && (
            <>
              <Link href={`/?cat=${product.cat_slug}`} style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
                {product.cat_name}
              </Link>
              <span className="breadcrumb-sep" style={{ color: 'var(--border)' }}>&rsaquo;</span>
            </>
          )}
          <span style={{ color: 'var(--text)' }}>{product.name}</span>
        </nav>

        {/* Client Interactive Area */}
        <ProductDetailClient
          product={product}
          secImages={secImages}
          currencySymbol={currencySymbol}
          contactPhone={contactPhone}
          reviews={reviews}
          averageRating={averageRating}
          totalReviews={totalReviews}
        />

        {/* Detailed Description */}
        {product.description && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', marginTop: '2.5rem' }}>
            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.2rem' }}>
              📋 Descripción Completa
            </h2>
            <div
              style={{ fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text)' }}
              dangerouslySetInnerHTML={{
                __html: product.description
                  .replace(/&/g, '&amp;')
                  .replace(/</g, '&lt;')
                  .replace(/>/g, '&gt;')
                  .replace(/"/g, '&quot;')
                  .replace(/'/g, '&#039;')
                  .replace(/\n/g, '<br/>')
              }}
            />
          </div>
        )}

        {/* Related Products */}
        {related.length > 0 && (
          <div style={{ marginTop: '3rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.3rem' }}>
              También te puede interesar
            </h2>
            <div style={{ width: '60px', height: '3px', background: 'linear-gradient(90deg, var(--gold), transparent)', marginBottom: '1.2rem' }}></div>
            <div className="related-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1.2rem', marginTop: '1.5rem' }}>
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/product/${item.slug}`}
                  style={{
                    textDecoration: 'none',
                    display: 'block',
                    background: 'var(--bg2)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    overflow: 'hidden',
                    transition: 'all 0.2s ease',
                  }}
                  className="related-item-card"
                >
                  <div style={{ height: '140px', overflow: 'hidden', background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.image ? (
                      <img
                        src={`/api/assets/uploads/${item.image}`}
                        alt={item.name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <span style={{ fontSize: '2.5rem' }}>{item.type === 'service' ? '🛠️' : '📦'}</span>
                    )}
                  </div>
                  <div style={{ padding: '0.8rem 1rem' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)', marginBottom: '0.3rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.name}
                    </div>
                    <div style={{ fontWeight: 800, color: 'var(--gold)', fontSize: '1rem' }}>
                      {formatPrice(item.price, currencySymbol)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
