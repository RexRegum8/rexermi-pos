'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { formatPrice, renderProductPriceText } from '@/lib/helpers';

interface Product {
  id: number;
  name: string;
  short_desc: string;
  price: number | string;
  stock: number;
  type: 'product' | 'service';
  image: string | null;
  image2?: string | null;
  image3?: string | null;
  cat_name: string | null;
  is_featured: number;
  price_type?: 'fixed' | 'base' | 'range' | 'contact';
  price_max?: number | string | null;
}

import { useCurrency } from '@/context/CurrencyContext';

interface SecImage {
  id: number;
  image_url: string;
}

interface Review {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  user_name: string;
}

interface ProductDetailClientProps {
  product: Product;
  secImages: SecImage[];
  currencySymbol: string;
  contactPhone: string;
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
}

export default function ProductDetailClient({
  product,
  secImages,
  currencySymbol,
  contactPhone,
  reviews = [],
  averageRating = 0,
  totalReviews = 0,
}: ProductDetailClientProps) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { formatProductPrice } = useCurrency();

  const [qty, setQty] = useState(1);
  const [addedText, setAddedText] = useState('🛒 Agregar al Carrito');
  const [isAdded, setIsAdded] = useState(false);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // Compile all images for the gallery
  const galleryImages = useMemo(() => {
    const list: string[] = [];
    if (product.image) list.push(`/api/assets/uploads/${product.image}`);
    if (product.image2) list.push(`/api/assets/uploads/${product.image2}`);
    if (product.image3) list.push(`/api/assets/uploads/${product.image3}`);
    
    secImages.forEach((img) => {
      list.push(img.image_url);
    });
    
    return list;
  }, [product, secImages]);

  const [activeImage, setActiveImage] = useState<string>(galleryImages[0] || '');
  const [fade, setFade] = useState(true);

  const handleThumbnailClick = (imgUrl: string) => {
    if (imgUrl === activeImage) return;
    setFade(false);
    setTimeout(() => {
      setActiveImage(imgUrl);
      setFade(true);
    }, 180);
  };

  const maxStock = product.type === 'service' ? 99 : product.stock;
  const outOfStock = product.type === 'product' && product.stock === 0;
  const isLowStock = product.type === 'product' && product.stock > 0 && product.stock <= 3;

  const changeQty = (delta: number) => {
    setQty((prev) => Math.max(1, Math.min(maxStock || 99, prev + delta)));
  };

  const handleAddToCart = () => {
    addToCart(
      {
        id: product.id,
        name: product.name,
        price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
        image: product.image || '',
        type: product.type,
        stock: product.stock,
        price_type: product.price_type || 'fixed',
        price_max: product.price_max ? (typeof product.price_max === 'string' ? parseFloat(product.price_max) : product.price_max) : null,
      },
      qty
    );

    setIsAdded(true);
    setAddedText('✅ ¡Agregado!');
    showToast('Producto agregado al carrito ✓', 'success');

    setTimeout(() => {
      setAddedText('🛒 Agregar al Carrito');
      setIsAdded(false);
    }, 1500);
  };

  const numericPrice = typeof product.price === 'string' ? parseFloat(product.price) : product.price;

  return (
    <>
    <div className="product-detail-layout">
      {/* IMAGES COLUMN */}
      <div>
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius)' }}>
          {activeImage ? (
            <Image
              src={activeImage}
              alt={product.name}
              className="product-main-img"
              width={600}
              height={460}
              style={{
                width: '100%',
                maxHeight: '460px',
                objectFit: 'cover',
                opacity: fade ? 1 : 0,
                transition: 'opacity 0.18s ease-in-out',
                display: 'block'
              }}
              priority
            />
          ) : (
            <div className="product-main-img-placeholder">
              {product.type === 'service' ? '🛠️' : '📦'}
            </div>
          )}
        </div>

        {galleryImages.length > 1 && (
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
            {galleryImages.map((imgUrl, index) => {
              const isSelected = imgUrl === activeImage;
              return (
                <Image
                  key={index}
                  src={imgUrl}
                  alt={`${product.name} gallery ${index}`}
                  className="gallery-thumb"
                  width={72}
                  height={72}
                  style={{
                    width: '72px',
                    height: '72px',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: isSelected ? '2px solid var(--gold)' : '2px solid var(--border)',
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.65,
                    transition: 'all 0.2s ease',
                  }}
                  onClick={() => handleThumbnailClick(imgUrl)}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* PURCHASE COLUMN */}
      <div className="product-detail-sticky">
        <div style={{ marginBottom: '0.8rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {product.cat_name && <span className="product-badge">{product.cat_name}</span>}
          {product.is_featured === 1 && <span className="product-badge">⭐ Destacado</span>}
          {product.type === 'service' && (
            <span
              className="product-badge"
              style={{ borderColor: '#3B82F6', color: '#3B82F6', background: 'rgba(59,130,246,.08)' }}
            >
              🛠️ Servicio
            </span>
          )}
        </div>
        
        <h1 style={{ fontSize: '1.6rem', fontWeight: 800, margin: '0.5rem 0 0.8rem', lineHeight: 1.25 }}>
          {product.name}
        </h1>

        {totalReviews > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '1.2rem', fontSize: '0.88rem' }}>
            <span style={{ color: 'var(--gold)', fontSize: '1.1rem', letterSpacing: '2px' }}>
              {'★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating))}
            </span>
            <strong style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>
              {averageRating.toFixed(1)} / 5
            </strong>
            <span style={{ color: 'var(--text-muted)' }}>
              ({totalReviews} valoración{totalReviews !== 1 ? 'es' : ''})
            </span>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ color: 'var(--border)' }}>☆☆☆☆☆</span>
            <span>Sin valoraciones aún</span>
          </div>
        )}

        <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
          {product.short_desc}
        </p>
        <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--gold)', marginBottom: '0.4rem' }}>
          {mounted
            ? formatProductPrice(product.price, product.price_type || 'fixed', product.price_max)
            : renderProductPriceText(product.price, product.price_type || 'fixed', product.price_max, currencySymbol)}
        </div>

        {/* Informative message about variable price */}
        {(product.price_type === 'base' || product.price_type === 'range') && (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1.2rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>ℹ️</span>
            <span>
              {product.price_type === 'base' 
                ? 'Este es un precio inicial sugerido y puede variar según los requerimientos.' 
                : 'El precio final se acordará con el vendedor dentro de este rango.'
              }
            </span>
          </div>
        )}

        {product.type === 'product' && (
          <div style={{ marginBottom: '1.2rem', fontSize: '0.85rem' }}>
            {outOfStock ? (
              <span style={{ color: '#E74C3C', fontWeight: 700 }}>❌ Sin stock disponible</span>
            ) : isLowStock ? (
              <span style={{ color: '#F1C40F', fontWeight: 700 }}>⚡ ¡Solo {product.stock} unidad(es) disponible(s)!</span>
            ) : (
              <span style={{ color: '#2ECC71', fontWeight: 600 }}>✅ En stock ({product.stock} disponibles)</span>
            )}
          </div>
        )}

        {product.price_type === 'contact' || Number(product.price) === 0 ? (
          <>
            <div style={{ 
              background: 'rgba(212, 175, 55, 0.08)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '1rem', 
              marginBottom: '1.2rem',
              fontSize: '0.88rem',
              lineHeight: 1.5,
              color: 'var(--text-muted)'
            }}>
              🤝 Este producto o servicio requiere acordar el precio y los detalles directamente con el vendedor. Haz clic abajo para consultar por WhatsApp.
            </div>
            {contactPhone && (
              <a
                href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}?text=Hola%2C%20me%20interesa%20acordar%20el%20precio%20del%20servicio%2Fproducto%3A%20${encodeURIComponent(product.name)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  background: '#25D366',
                  color: '#fff',
                  padding: '0.9rem',
                  borderRadius: 'var(--radius)',
                  fontWeight: 700,
                  fontSize: '1rem',
                  textDecoration: 'none',
                  boxShadow: '0 4px 12px rgba(37,211,102,0.2)'
                }}
              >
                💬 Acordar por WhatsApp
              </a>
            )}
          </>
        ) : !outOfStock ? (
          <>
            <div style={{ marginBottom: '1.2rem' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
                Cantidad:
              </label>
              <div className="qty-control-lg">
                <button 
                  onClick={() => changeQty(-1)} 
                  disabled={qty <= 1}
                  className="qty-btn-lg" 
                  aria-label="Disminuir cantidad"
                >
                  −
                </button>
                <span className="qty-val-lg">{qty}</span>
                <button 
                  onClick={() => changeQty(1)} 
                  disabled={qty >= maxStock}
                  className="qty-btn-lg" 
                  aria-label="Aumentar cantidad"
                >
                  +
                </button>
              </div>
            </div>
            
            <button
              onClick={handleAddToCart}
              className="btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1rem',
                padding: '0.9rem',
                backgroundColor: isAdded ? '#2ECC71' : undefined,
                borderColor: isAdded ? '#2ECC71' : undefined,
              }}
            >
              {addedText}
            </button>
            <Link
              href="/cart"
              className="btn-outline"
              style={{ width: '100%', justifyContent: 'center', marginTop: '0.7rem', display: 'flex' }}
            >
              Ver Carrito →
            </Link>
          </>
        ) : (
          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.9rem', opacity: 0.4, cursor: 'not-allowed' }} disabled>
            Sin stock
          </button>
        )}

        {contactPhone && product.price_type !== 'contact' && Number(product.price) > 0 && (
          <a
            href={`https://wa.me/${contactPhone.replace(/[^0-9]/g, '')}?text=Hola%2C%20me%20interesa%20el%20producto%3A%20${encodeURIComponent(product.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: '100%',
              justifyContent: 'center',
              marginTop: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: '#25D366',
              color: '#fff',
              padding: '0.7rem',
              borderRadius: 'var(--radius)',
              fontWeight: 600,
              fontSize: '0.9rem',
              textDecoration: 'none',
            }}
          >
            💬 Consultar por WhatsApp
          </a>
        )}
      </div>
    </div>

    {/* CUSTOMER REVIEWS SECTION */}
    <div style={{ marginTop: '2.5rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '1.5rem' }}>
        ⭐ Opiniones de Clientes
      </h2>

      {reviews.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Summary & Distribution */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', paddingBottom: '1.5rem', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            {/* Big Number */}
            <div style={{ textAlign: 'center', minWidth: '120px' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>
                {averageRating.toFixed(1)}
              </div>
              <div style={{ color: 'var(--gold)', fontSize: '1.2rem', margin: '0.3rem 0' }}>
                {'★'.repeat(Math.round(averageRating)) + '☆'.repeat(5 - Math.round(averageRating))}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Promedio de {totalReviews} opinión{totalReviews !== 1 ? 'es' : ''}
              </div>
            </div>

            {/* Distribution Bars */}
            <div style={{ flex: 1, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviews.filter(r => r.rating === star).length;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.82rem' }}>
                    <span style={{ minWidth: '70px', color: 'var(--text-muted)', textAlign: 'right' }}>
                      {star} estrella{star !== 1 ? 's' : ''}
                    </span>
                    <div style={{ flex: 1, height: '8px', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${percentage}%`, background: 'var(--gold)', borderRadius: '4px' }}></div>
                    </div>
                    <span style={{ minWidth: '30px', color: 'var(--text-muted)' }}>
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Individual Reviews List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            {reviews.map((rev) => (
              <div 
                key={rev.id} 
                style={{ 
                  padding: '1.2rem', 
                  background: 'var(--bg3)', 
                  borderRadius: 'var(--radius)', 
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <div>
                    <strong style={{ color: 'var(--text)', fontSize: '0.92rem' }}>{rev.user_name}</strong>
                    <div style={{ color: 'var(--gold)', fontSize: '0.85rem', marginTop: '0.1rem' }}>
                      {'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}
                    </div>
                  </div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {new Date(rev.created_at).toLocaleDateString('es-VE', {
                      year: 'numeric', month: 'short', day: 'numeric'
                    })}
                  </span>
                </div>
                {rev.comment ? (
                  <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                    {rev.comment}
                  </p>
                ) : (
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Sin comentario escrito.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.8rem' }}>💬</div>
          <h4 style={{ margin: '0 0 0.4rem 0', color: 'var(--text)' }}>Sin valoraciones aún</h4>
          <p style={{ margin: 0, fontSize: '0.85rem' }}>
            ¿Compraste este producto? Puedes calificarlo desde tu sección de historial de pedidos una vez entregado.
          </p>
        </div>
      )}
    </div>
  </>
  );
}
