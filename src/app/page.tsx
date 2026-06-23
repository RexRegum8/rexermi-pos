import React, { Suspense } from 'react';
import { dbQuery } from '@/lib/db';
import { getSettings, isStoreOpen } from '@/lib/settings';
import CatalogClient from './CatalogClient';
import SocialProofNotification from '@/components/SocialProofNotification';

export const revalidate = 60; // ISR: regenerate every 60 seconds for performance (R-15)

export default async function HomePage() {
  const settings = await getSettings();
  const currencySymbol = settings['currency_symbol'] || '$';
  const siteName = settings['site_name'] || 'Rexermi Marketplace';
  const siteTagline = settings['site_tagline'] || 'Tu tienda de confianza';

  const storeOpen = isStoreOpen(settings);

  // 1. Fetch categories that are active and contain at least one active product
  const categories = await dbQuery<any[]>(
    `SELECT c.id, c.name, c.slug, c.icon 
     FROM categories c 
     WHERE c.is_active = 1 
       AND EXISTS (
         SELECT 1 FROM products p 
         WHERE p.category_id = c.id AND p.is_active = 1
       )
     ORDER BY c.sort_order, c.name`
  );

  // 2. Fetch products
  const rawProducts = await dbQuery<any[]>(
    `SELECT p.id, p.name, p.slug, p.short_desc, p.price, p.stock, p.type, p.image, p.is_featured,
            p.es_subproducto, p.id_producto_padre, p.unidades_por_padre,
            p.price_type, p.price_max,
            parent.stock AS parent_stock,
            c.name as cat_name, c.slug as cat_slug 
     FROM products p 
     LEFT JOIN categories c ON p.category_id = c.id 
     LEFT JOIN products parent ON p.id_producto_padre = parent.id
     WHERE p.is_active = 1 AND (c.is_active = 1 OR p.category_id IS NULL)
     ORDER BY p.is_featured DESC, p.created_at DESC`
  );

  const products = rawProducts.map(p => {
    let virtualStock = p.stock;
    if (p.type === 'product' && p.es_subproducto === 1 && p.id_producto_padre !== null && p.unidades_por_padre > 0) {
      const parentStock = p.parent_stock !== null ? p.parent_stock : 0;
      virtualStock = p.stock + (parentStock * p.unidades_por_padre);
    }
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      short_desc: p.short_desc,
      price: p.price,
      stock: virtualStock,
      type: p.type,
      image: p.image,
      is_featured: p.is_featured,
      cat_name: p.cat_name,
      cat_slug: p.cat_slug,
      price_type: p.price_type || 'fixed',
      price_max: p.price_max
    };
  });

  // 3. Stats
  const totalProductsResult = await dbQuery<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM products WHERE is_active = 1'
  );
  const totalUsersResult = await dbQuery<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM users'
  );

  const totalProducts = totalProductsResult[0]?.count || 0;
  const totalUsers = totalUsersResult[0]?.count || 0;

  return (
    <div style={{ animation: 'fadeInUp 0.45s ease both' }}>
      {!storeOpen && (
        <div className="section-inner" style={{ marginTop: '1rem', marginBottom: '1rem' }}>
          <div style={{
            padding: '1.2rem',
            borderRadius: 'var(--radius)',
            background: 'rgba(231, 76, 60, 0.1)',
            border: '1px solid #e74c3c',
            color: '#e74c3c',
            textAlign: 'center',
            fontSize: '0.92rem',
            fontWeight: 500,
            boxShadow: '0 4px 15px rgba(231, 76, 60, 0.05)',
          }}>
            ⚠️ <strong>Aviso Importante:</strong> La tienda se encuentra temporalmente cerrada para mantenimiento. Puedes navegar por nuestro catálogo de productos, pero la confirmación de nuevos pedidos está inhabilitada en este momento.
          </div>
        </div>
      )}

      {/* CATALOG SECTION */}
      <section className="section" style={{ padding: '1rem 1rem 2rem 1rem' }}>
        <div className="section-inner">
          <Suspense fallback={<div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>Cargando catálogo...</div>}>
            <CatalogClient
              initialProducts={products}
              categories={categories}
              currencySymbol={currencySymbol}
            />
          </Suspense>
        </div>
      </section>

      {/* HERO / STATS SECTION (MOVED TO BOTTOM) */}
      <div className="page-hero" style={{ textAlign: 'center', padding: '3rem 1rem', marginTop: '2rem', borderTop: '1px solid var(--border)', background: 'var(--bg2)' }}>
        <h2>{siteName}</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{siteTagline}</p>
        <div className="hero-stats" style={{ display: 'flex', gap: '3rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          <div className="hero-stat" style={{ textAlign: 'center' }}>
            <div className="hero-stat-val" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold)' }}>{totalProducts}+</div>
            <div className="hero-stat-lbl" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Productos</div>
          </div>
          <div className="hero-stat" style={{ textAlign: 'center' }}>
            <div className="hero-stat-val" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold)' }}>{totalUsers}+</div>
            <div className="hero-stat-lbl" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Clientes</div>
          </div>
          <div className="hero-stat" style={{ textAlign: 'center' }}>
            <div className="hero-stat-val" style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold)' }}>✓</div>
            <div className="hero-stat-lbl" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pago Seguro</div>
          </div>
        </div>
      </div>
      <SocialProofNotification />
    </div>
  );
}
