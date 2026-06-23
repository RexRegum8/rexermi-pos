'use client';
 
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ProductCard, { Product } from '@/components/ProductCard';
import { useDebounce } from '@/lib/useDebounce';
 
interface Category {
  id: number;
  name: string;
  slug: string;
  icon: string | null;
}
 
interface CatalogClientProps {
  initialProducts: Product[];
  categories: Category[];
  currencySymbol: string;
}
 
export default function CatalogClient({
  initialProducts,
  categories,
  currencySymbol,
}: CatalogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
 
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [visibleCount, setVisibleCount] = useState<number>(16);

  
  // Custom hook to debounce the search query (300ms)
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  
  // Track if initial sync has occurred to prevent extra router replaces on load
  const isInitialSync = useRef(true);

  // Sync initialProducts if they change externally
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  // Real-time stock updates listener
  useEffect(() => {
    const eventSource = new EventSource('/api/stock-sse');
    
    const onStockUpdate = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        const { productId, stock } = data;
        setProducts((prevProducts) =>
          prevProducts.map((p) => (p.id === productId ? { ...p, stock } : p))
        );
      } catch (err) {
        console.error('Error parsing stock update event:', err);
      }
    };

    eventSource.addEventListener('stock_update', onStockUpdate);

    eventSource.onerror = (err) => {
      console.error('EventSource connection error on CatalogClient:', err);
    };

    return () => {
      eventSource.removeEventListener('stock_update', onStockUpdate);
      eventSource.close();
    };
  }, []);

  // Reset visible count when category or search changes
  useEffect(() => {
    setVisibleCount(16);
  }, [selectedCat, debouncedSearchQuery]);
 
  // Sync state with URL params on load
  useEffect(() => {
    const cat = searchParams.get('cat') || 'all';
    const q = searchParams.get('q') || '';
    setSelectedCat(cat);
    setSearchQuery(q);
  }, [searchParams]);
 
  // Update URL params
  const updateUrl = (cat: string, query: string) => {
    const params = new URLSearchParams();
    if (cat !== 'all') params.set('cat', cat);
    if (query.trim() !== '') params.set('q', query.trim());
    
    const newPath = params.toString() ? `/?${params.toString()}` : '/';
    router.replace(newPath, { scroll: false });
  };
 
  // Synchronize state changes to URL with debounce
  useEffect(() => {
    if (isInitialSync.current) {
      isInitialSync.current = false;
      return;
    }
    updateUrl(selectedCat, debouncedSearchQuery);
  }, [selectedCat, debouncedSearchQuery]);
 
  const handleCategorySelect = (catSlug: string) => {
    setSelectedCat(catSlug);
  };
 
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  // Filter products locally for instant UX
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const matchCategory = selectedCat === 'all' || product.cat_slug === selectedCat;
      
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        query === '' ||
        product.name.toLowerCase().includes(query) ||
        product.short_desc.toLowerCase().includes(query);

      return matchCategory && matchSearch;
    });
  }, [products, selectedCat, searchQuery]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCat === 'all') return 'Todos los Productos';
    return categories.find((c) => c.slug === selectedCat)?.name || 'Productos';
  }, [selectedCat, categories]);

  const visibleProducts = useMemo(() => {
    return filteredProducts.slice(0, visibleCount);
  }, [filteredProducts, visibleCount]);

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        {/* Search bar */}
        <div className="search-bar" style={{ margin: '0 auto', maxWidth: '480px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Buscar productos..."
            autoComplete="off"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Categories Tabs */}
      <div className="cat-tabs">
        <button
          onClick={() => handleCategorySelect('all')}
          className={`cat-tab ${selectedCat === 'all' ? 'active' : ''}`}
        >
          🏪 Todos
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleCategorySelect(cat.slug)}
            className={`cat-tab ${selectedCat === cat.slug ? 'active' : ''}`}
          >
            <span>{cat.icon || '📦'}</span> {cat.name}
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="products-grid">
        {visibleProducts.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem 1rem' }}>
            <div className="empty-icon" style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔍</div>
            <h3>Sin resultados</h3>
            <p>No encontramos productos para tu búsqueda.</p>
            <button
              onClick={() => {
                setSelectedCat('all');
                setSearchQuery('');
                router.replace('/');
              }}
              className="btn-primary"
              style={{ marginTop: '1rem' }}
            >
              Ver todo el catálogo
            </button>
          </div>
        ) : (
          visibleProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              currencySymbol={currencySymbol}
            />
          ))
        )}
      </div>

      {visibleCount < filteredProducts.length && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2.5rem', marginBottom: '2.5rem' }}>
          <button
            onClick={() => setVisibleCount((prev) => prev + 16)}
            className="btn-primary"
            style={{ padding: '0.65rem 2.5rem', fontSize: '0.9rem', borderRadius: '20px' }}
          >
            👇 Cargar más productos
          </button>
        </div>
      )}
    </>
  );
}
