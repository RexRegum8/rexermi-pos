'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { useCurrency } from '@/context/CurrencyContext';
import { formatPrice, renderProductPriceText } from '@/lib/helpers';

export interface Product {
  id: number;
  name: string;
  slug: string;
  short_desc: string;
  price: number | string;
  stock: number;
  type: 'product' | 'service';
  image: string | null;
  is_featured: number;
  cat_name: string | null;
  cat_slug?: string | null;
  price_type?: 'fixed' | 'base' | 'range' | 'contact';
  price_max?: number | string | null;
}

interface ProductCardProps {
  product: Product;
  currencySymbol: string;
}

export default function ProductCard({ product, currencySymbol }: ProductCardProps) {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { formatPriceLocal, formatProductPrice } = useCurrency();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart({
      id: product.id,
      name: product.name,
      price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
      image: product.image || '',
      type: product.type,
      stock: product.stock,
      price_type: product.price_type || 'fixed',
      price_max: product.price_max ? (typeof product.price_max === 'string' ? parseFloat(product.price_max) : product.price_max) : null,
    });
    showToast('Producto agregado al carrito 🛒', 'success');
  };

  const isOutOfStock = product.type === 'product' && product.stock === 0;
  const isLowStock = product.type === 'product' && product.stock > 0 && product.stock <= 3;

  return (
    <div className="product-card">
      <Link href={`/product/${product.slug}`} className="product-card-link">
        <div className="product-img" style={{ position: 'relative' }}>
          {product.image ? (
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              <Image
                src={`/api/assets/uploads/${product.image}`}
                alt={product.name}
                fill
                sizes="(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 300px"
                style={{ objectFit: 'cover' }}
                loading="lazy"
              />
            </div>
          ) : (
            <div style={{ fontSize: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
              {product.type === 'service' ? '🛠️' : '📦'}
            </div>
          )}
          {product.is_featured === 1 && (
            <div className="badge-featured" style={{ position: 'absolute', top: '.6rem', left: '.6rem', zIndex: 10 }}>
              ⭐ Destacado
            </div>
          )}
        </div>
      </Link>
      <div className="product-body">
        <div className="product-cat">
          {product.cat_name || 'General'}
          {product.type === 'service' && <span className="badge-service" style={{ marginLeft: '6px' }}>Servicio</span>}
          {isLowStock && <span className="badge-stock-low" style={{ marginLeft: '6px' }}>⚡ Pocas</span>}
          {isOutOfStock && <span className="badge-stock-out" style={{ marginLeft: '6px' }}>❌ Agotado</span>}
        </div>
        <Link href={`/product/${product.slug}`} className="product-card-link">
          <div className="product-name" style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}>{product.name}</div>
        </Link>
        <div className="product-desc">{product.short_desc}</div>
        <div className="product-footer">
          <span className="product-price" style={{ fontSize: product.price_type === 'contact' || Number(product.price) === 0 ? '0.78rem' : undefined, whiteSpace: 'nowrap' }}>
            {mounted
              ? formatProductPrice(
                  product.price,
                  product.price_type || 'fixed',
                  product.price_max
                )
              : renderProductPriceText(
                  product.price,
                  product.price_type || 'fixed',
                  product.price_max,
                  currencySymbol
                )}
          </span>
          {product.price_type === 'contact' || Number(product.price) === 0 ? (
            <Link 
              href={`/product/${product.slug}`} 
              className="btn-cart"
              style={{ background: '#25D366', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              Consultar
            </Link>
          ) : isOutOfStock ? (
            <button className="btn-cart" disabled style={{ opacity: 0.45, cursor: 'not-allowed' }}>
              Sin stock
            </button>
          ) : (
            <button className="btn-cart" onClick={handleAddToCart}>
              + Agregar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
