'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/context/ToastContext';
import BarcodeScannerModal from '@/components/BarcodeScannerModal';

interface Category { id: number; name: string; }
interface Product { id: number; name: string; }
interface ProductFormData {
  name: string; slug: string; category_id: string; short_desc: string;
  description: string; price: string; stock: string; type: 'product' | 'service';
  is_featured: boolean; is_active: boolean;
  es_subproducto: boolean;
  id_producto_padre: string;
  unidades_por_padre: string;
  supplier_id: string;
  purchase_url: string;
  min_stock_alert: string;
  barcode: string;
  price_type: 'fixed' | 'base' | 'range' | 'contact';
  price_max: string;
  image?: string;
  image2?: string;
  image3?: string;
}

function slugify(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ImageInput({ 
  label, 
  onChange, 
  previewUrl 
}: { 
  label: string; 
  onChange: (f: File | null) => void; 
  previewUrl: string | null;
}) {
  return (
    <div className="form-group" style={{ marginBottom: '1.2rem' }}>
      <label style={{ display: 'block', marginBottom: '0.4rem' }}>{label}</label>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        {previewUrl && (
          <div style={{ position: 'relative', width: '60px', height: '60px', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
            <img 
              src={previewUrl} 
              alt="Vista previa" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
            />
          </div>
        )}
        <input 
          type="file" 
          accept="image/*" 
          onChange={e => onChange(e.target.files?.[0] || null)}
          style={{ 
            background: 'var(--bg3)', 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            padding: '0.5rem', 
            color: 'var(--text)', 
            flex: 1, 
            minWidth: '200px' 
          }} 
        />
      </div>
    </div>
  );
}

export default function ProductForm({ productId, initialData, categories, products = [], suppliers = [] }: {
  productId?: number;
  initialData?: Partial<ProductFormData>;
  categories: Category[];
  products?: Product[];
  suppliers?: { id: number; name: string }[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [image2File, setImage2File] = useState<File | null>(null);
  const [image3File, setImage3File] = useState<File | null>(null);
  const [localCategories, setLocalCategories] = useState<Category[]>(categories);

  // Previews
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [image2Preview, setImage2Preview] = useState<string | null>(null);
  const [image3Preview, setImage3Preview] = useState<string | null>(null);

  // Category Modal
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categoryModalError, setCategoryModalError] = useState('');

  // Form errors for inline visual validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [lookupLoading, setLookupLoading] = useState(false);

  // Bulk Mode (+MASIVO) States
  const [isBulkMode, setIsBulkMode] = useState(false);
  const [bulkBarcode, setBulkBarcode] = useState('');
  const [bulkName, setBulkName] = useState('');
  const [bulkRelation, setBulkRelation] = useState<'madre' | 'hijo'>('madre');
  const [bulkStock, setBulkStock] = useState('0');
  const [sessionProducts, setSessionProducts] = useState<any[]>([]);
  const bulkBarcodeRef = React.useRef<HTMLInputElement>(null);

  // Camera Barcode Scanner States
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'classic' | 'bulk'>('classic');

  const handleCameraScanSuccess = async (code: string) => {
    setIsScannerOpen(false);
    if (scannerTarget === 'classic') {
      setForm(f => ({ ...f, barcode: code }));
      
      // Auto-trigger lookup for classic
      setLookupLoading(true);
      try {
        const res = await fetch(`/api/admin/products/lookup?barcode=${encodeURIComponent(code)}`);
        const data = (await res.json()) as any;
        if (res.ok && data.success) {
          showToast('✨ Información del producto autocompletada.', 'success');
          setForm(f => ({
            ...f,
            name: data.name || f.name,
            short_desc: data.brand ? `Marca: ${data.brand}` : f.short_desc,
            description: data.description || f.description,
          }));
        }
      } catch (err) {
        console.error(err);
        showToast('Error al buscar el código de barras por internet.', 'error');
      } finally {
        setLookupLoading(false);
      }
    } else {
      setBulkBarcode(code);
      setLookupLoading(true);
      try {
        const res = await fetch(`/api/admin/products/lookup?barcode=${encodeURIComponent(code)}`);
        const data = (await res.json()) as any;
        if (res.ok && data.success) {
          showToast('✨ Producto encontrado en internet.', 'success');
          setBulkName(data.name || '');
          setTimeout(() => {
            document.getElementById('bulk-stock')?.focus();
          }, 100);
        } else {
          setTimeout(() => {
            document.getElementById('bulk-name')?.focus();
          }, 100);
        }
      } catch (err) {
        console.error(err);
        setTimeout(() => {
          document.getElementById('bulk-name')?.focus();
        }, 100);
      } finally {
        setLookupLoading(false);
      }
    }
  };

  // Autofocus on bulk scanner when bulk mode is enabled
  useEffect(() => {
    if (isBulkMode) {
      setTimeout(() => {
        bulkBarcodeRef.current?.focus();
      }, 100);
    }
  }, [isBulkMode]);

  const handleBarcodeLookup = async () => {
    const code = form.barcode.trim();
    if (!code) return;
    setLookupLoading(true);
    try {
      const res = await fetch(`/api/admin/products/lookup?barcode=${encodeURIComponent(code)}`);
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast('✨ Información del producto autocompletada.', 'success');
        setForm(f => ({
          ...f,
          name: data.name || f.name,
          short_desc: data.brand ? `Marca: ${data.brand}` : f.short_desc,
          description: data.description || f.description,
        }));
      } else {
        showToast('No se encontró información en internet para este código.', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Error al buscar el código de barras por internet.', 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  // Bulk Barcode Lookup Handler
  const handleBulkBarcodeKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = bulkBarcode.trim();
      if (!code) return;

      setLookupLoading(true);
      try {
        const res = await fetch(`/api/admin/products/lookup?barcode=${encodeURIComponent(code)}`);
        const data = (await res.json()) as any;
        if (res.ok && data.success) {
          showToast('✨ Producto encontrado en internet.', 'success');
          setBulkName(data.name || '');
          // Move focus to stock or name
          setTimeout(() => {
            document.getElementById('bulk-stock')?.focus();
          }, 50);
        } else {
          // Focus name input so user can type it
          setTimeout(() => {
            document.getElementById('bulk-name')?.focus();
          }, 50);
        }
      } catch (err) {
        console.error(err);
        setTimeout(() => {
          document.getElementById('bulk-name')?.focus();
        }, 50);
      } finally {
        setLookupLoading(false);
      }
    }
  };

  // Bulk Mode - Save and Next
  const handleSaveBulkNext = async () => {
    if (!bulkName.trim()) {
      showToast('El nombre del producto es obligatorio.', 'error');
      document.getElementById('bulk-name')?.focus();
      return;
    }
    const stockVal = parseInt(bulkStock, 10);
    if (isNaN(stockVal) || stockVal < 0) {
      showToast('El stock debe ser un número entero mayor o igual a 0.', 'error');
      document.getElementById('bulk-stock')?.focus();
      return;
    }

    setLoading(true);
    const barcodeVal = bulkBarcode.trim() || null;
    const prodSlug = slugify(bulkName) + (barcodeVal ? `-${barcodeVal}` : `-${Date.now()}`);

    const fd = new FormData();
    fd.append('name', bulkName.trim());
    fd.append('slug', prodSlug);
    fd.append('stock', String(stockVal));
    fd.append('price', '0');
    fd.append('type', 'product');
    fd.append('is_active', '2'); // Pending completion status
    fd.append('es_subproducto', bulkRelation === 'hijo' ? 'true' : 'false');
    if (barcodeVal) {
      fd.append('barcode', barcodeVal);
    }

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        body: fd
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast('✅ Producto pre-registrado en la lista de espera.', 'success');
        setSessionProducts(prev => [
          {
            barcode: barcodeVal || '—',
            name: bulkName.trim(),
            es_subproducto: bulkRelation === 'hijo' ? 1 : 0,
            stock: stockVal
          },
          ...prev
        ]);
        // Reset inputs
        setBulkBarcode('');
        setBulkName('');
        setBulkStock('0');
        // Refocus barcode input
        setTimeout(() => {
          bulkBarcodeRef.current?.focus();
        }, 50);
      } else {
        showToast(data.error || 'Error al guardar el producto.', 'error');
      }
    } catch {
      showToast('Error de red al intentar guardar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Bulk Mode - Finish and edit in normal form
  const handleFinishBulkForm = () => {
    if (!bulkName.trim()) {
      showToast('Por favor introduce al menos el nombre del producto.', 'error');
      document.getElementById('bulk-name')?.focus();
      return;
    }
    const stockVal = parseInt(bulkStock, 10);
    if (isNaN(stockVal) || stockVal < 0) {
      showToast('El stock debe ser un número entero mayor o igual a 0.', 'error');
      document.getElementById('bulk-stock')?.focus();
      return;
    }

    // Populate regular form fields
    setForm(f => ({
      ...f,
      name: bulkName.trim(),
      slug: slugify(bulkName.trim()),
      stock: String(stockVal),
      barcode: bulkBarcode.trim(),
      es_subproducto: bulkRelation === 'hijo',
      is_active: true
    }));

    setIsBulkMode(false);
    showToast('Formulario cargado. Completa el precio/detalles y guarda.', 'info');
  };

  const [form, setForm] = useState<ProductFormData>({
    name: initialData?.name || '',
    slug: initialData?.slug || '',
    category_id: initialData?.category_id || '',
    short_desc: initialData?.short_desc || '',
    description: initialData?.description || '',
    price: initialData?.price || '',
    stock: initialData?.stock || '0',
    type: initialData?.type || 'product',
    is_featured: initialData?.is_featured ?? false,
    is_active: initialData?.is_active ?? true,
    es_subproducto: initialData?.es_subproducto ?? false,
    id_producto_padre: initialData?.id_producto_padre || '',
    unidades_por_padre: initialData?.unidades_por_padre || '',
    supplier_id: initialData?.supplier_id || '',
    purchase_url: initialData?.purchase_url || '',
    min_stock_alert: initialData?.min_stock_alert || '3',
    barcode: initialData?.barcode || '',
    price_type: initialData?.price_type || 'fixed',
    price_max: initialData?.price_max || '',
  });

  // Load initial image previews
  useEffect(() => {
    if (initialData?.image) {
      setImagePreview(initialData.image.startsWith('http') ? initialData.image : `/${initialData.image}`);
    }
    if (initialData?.image2) {
      setImage2Preview(initialData.image2.startsWith('http') ? initialData.image2 : `/${initialData.image2}`);
    }
    if (initialData?.image3) {
      setImage3Preview(initialData.image3.startsWith('http') ? initialData.image3 : `/${initialData.image3}`);
    }
  }, [initialData]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === 'new_category') {
      // Revert select value to previous so it doesn't get stuck on "new_category" if canceled
      e.target.value = form.category_id;
      setNewCategoryName('');
      setCategoryModalError('');
      setIsCategoryModalOpen(true);
    } else {
      setForm(f => ({ ...f, category_id: value }));
      if (errors.category_id) setErrors(prev => ({ ...prev, category_id: '' }));
    }
  };

  const handleCreateCategorySubmit = async () => {
    if (!newCategoryName.trim()) {
      setCategoryModalError('El nombre de la categoría es obligatorio.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/admin/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      });
      const data = (await res.json()) as any;
      if (res.ok && data.success) {
        showToast('Categoría creada correctamente.', 'success');
        const newCat = data.category;
        setLocalCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
        setForm(f => ({ ...f, category_id: String(newCat.id) }));
        setIsCategoryModalOpen(false);
        setNewCategoryName('');
        setCategoryModalError('');
      } else {
        setCategoryModalError(data.error || 'Error al crear la categoría.');
      }
    } catch (err) {
      console.error(err);
      setCategoryModalError('Error de red al crear la categoría.');
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm(f => ({ ...f, name, slug: !productId ? slugify(name) : f.slug }));
    if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
    if (!productId && errors.slug) setErrors(prev => ({ ...prev, slug: '' }));
  };

  const handleFileChange = (file: File | null, setFile: (f: File | null) => void, setPreview: (p: string | null) => void) => {
    setFile(file);
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) {
      newErrors.name = 'El nombre es obligatorio.';
    }

    if (!form.slug.trim()) {
      newErrors.slug = 'El slug de URL es obligatorio.';
    } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      newErrors.slug = 'Formato inválido. Usar solo minúsculas, números y guiones (-)';
    }

    if (form.price_type !== 'contact') {
      if (!form.price.trim()) {
        newErrors.price = 'El precio es obligatorio.';
      } else {
        const priceVal = Number(form.price);
        if (isNaN(priceVal) || priceVal < 0) {
          newErrors.price = 'El precio debe ser un número mayor o igual a 0.';
        }
      }
    }

    if (form.price_type === 'range') {
      if (!form.price_max.trim()) {
        newErrors.price_max = 'El precio máximo es obligatorio.';
      } else {
        const priceMaxVal = Number(form.price_max);
        const priceMinVal = Number(form.price);
        if (isNaN(priceMaxVal) || priceMaxVal < 0) {
          newErrors.price_max = 'El precio máximo debe ser un número mayor o igual a 0.';
        } else if (!isNaN(priceMinVal) && priceMaxVal <= priceMinVal) {
          newErrors.price_max = 'El precio máximo debe ser mayor al precio mínimo.';
        }
      }
    }

    if (form.type === 'product') {
      if (!form.stock.trim()) {
        newErrors.stock = 'El stock es obligatorio para productos físicos.';
      } else {
        const stockVal = Number(form.stock);
        if (isNaN(stockVal) || stockVal < 0 || !Number.isInteger(stockVal)) {
          newErrors.stock = 'El stock debe ser un número entero mayor o igual a 0.';
        }
      }

      if (!form.min_stock_alert.trim()) {
        newErrors.min_stock_alert = 'La alerta de stock crítico es obligatoria.';
      } else {
        const alertVal = Number(form.min_stock_alert);
        if (isNaN(alertVal) || alertVal < 0 || !Number.isInteger(alertVal)) {
          newErrors.min_stock_alert = 'La alerta de stock crítico debe ser un número entero mayor o igual a 0.';
        }
      }
    }

    if (form.type === 'product' && form.es_subproducto) {
      if (!form.id_producto_padre) {
        newErrors.id_producto_padre = 'Debe seleccionar un producto padre para la relación.';
      }
      if (!form.unidades_por_padre.trim()) {
        newErrors.unidades_por_padre = 'Las unidades por producto padre son obligatorias.';
      } else {
        const unitsVal = Number(form.unidades_por_padre);
        if (isNaN(unitsVal) || unitsVal < 1 || !Number.isInteger(unitsVal)) {
          newErrors.unidades_por_padre = 'Debe ser un número entero mayor o igual a 1.';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showToast('Por favor, corrija los errores en el formulario.', 'error');
      // Scroll to the first error
      const firstErrorKey = Object.keys(errors)[0];
      if (firstErrorKey) {
        const element = document.getElementsByName(firstErrorKey)[0];
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          element.focus();
        }
      }
      return;
    }

    setLoading(true);

    const fd = new FormData();
    const sanitizedForm = { ...form };
    if (sanitizedForm.price_type === 'contact') {
      sanitizedForm.price = '0';
    }
    if (sanitizedForm.price_type !== 'range') {
      sanitizedForm.price_max = '';
    }

    Object.entries(sanitizedForm).forEach(([k, v]) => {
      if (k === 'id_producto_padre' || k === 'unidades_por_padre') {
        if (!form.es_subproducto || v === '') {
          fd.append(k, '');
          return;
        }
      }
      fd.append(k, String(v));
    });
    if (imageFile) fd.append('image', imageFile);
    if (image2File) fd.append('image2', image2File);
    if (image3File) fd.append('image3', image3File);

    const url = productId ? `/api/admin/products/${productId}` : '/api/admin/products';
    const method = productId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, body: fd });
      const data = (await res.json()) as any;
      if (res.ok) {
        showToast(productId ? '✅ Producto actualizado correctamente.' : '✅ Producto creado correctamente.', 'success');
        router.push('/admin/products');
        router.refresh();
      } else {
        showToast(data.error || 'Error al guardar el producto.', 'error');
      }
    } catch {
      showToast('Error de red al intentar guardar.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {!productId && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem' }}>
          <button
            type="button"
            onClick={() => setIsBulkMode(false)}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: !isBulkMode ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: !isBulkMode ? 'rgba(212,175,55,0.1)' : 'transparent',
              color: !isBulkMode ? 'var(--gold)' : 'var(--text-muted)',
              fontWeight: !isBulkMode ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            📝 Formulario Clásico
          </button>
          <button
            type="button"
            onClick={() => setIsBulkMode(true)}
            style={{
              padding: '0.6rem 1.2rem',
              borderRadius: '8px',
              border: isBulkMode ? '1px solid var(--gold)' : '1px solid var(--border)',
              background: isBulkMode ? 'rgba(212,175,55,0.1)' : 'transparent',
              color: isBulkMode ? 'var(--gold)' : 'var(--text-muted)',
              fontWeight: isBulkMode ? 'bold' : 'normal',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'all 0.2s'
            }}
          >
            ⚡ Modo Registro Masivo (+MASIVO)
          </button>
        </div>
      )}

      {isBulkMode ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '1.8rem' }}>⚡</span>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--gold)' }}>Modo Registro Masivo con Lector</h2>
              <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Escanea el código de barras y registra rápidamente los productos en lote en la lista de espera "Por completar".
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem', marginTop: '2rem' }}>
            
            {/* Barcode input */}
            <div className="form-group">
              <label htmlFor="bulk-barcode" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>📊 Código de Barras (Escanea aquí)</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  id="bulk-barcode"
                  ref={bulkBarcodeRef}
                  type="text"
                  placeholder="Escanea el código de barras o usa la cámara..."
                  value={bulkBarcode}
                  onChange={e => setBulkBarcode(e.target.value)}
                  onKeyDown={handleBulkBarcodeKeyDown}
                  style={{
                    flex: 1,
                    padding: '0.8rem 1rem',
                    fontSize: '1rem',
                    fontFamily: 'monospace',
                    letterSpacing: '0.05em',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    setScannerTarget('bulk');
                    setIsScannerOpen(true);
                  }}
                  style={{
                    background: 'rgba(212,175,55,0.1)',
                    color: 'var(--gold)',
                    border: '1px solid var(--gold)',
                    borderRadius: '8px',
                    padding: '0 1rem',
                    fontSize: '1.2rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  title="Escanear con Cámara"
                >
                  📷
                </button>
              </div>
              <small style={{ color: 'var(--text-muted)', fontSize: '0.72rem', display: 'block', marginTop: '0.3rem' }}>
                * Al escanear o presionar <strong>Enter</strong> se buscará automáticamente en internet la descripción del producto.
              </small>
            </div>

            {/* Product name */}
            <div className="form-group">
              <label htmlFor="bulk-name" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Nombre del Producto *</label>
              <input
                id="bulk-name"
                type="text"
                placeholder="Nombre del producto..."
                value={bulkName}
                onChange={e => setBulkName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('bulk-stock')?.focus();
                  }
                }}
                style={{
                  width: '100%',
                  padding: '0.8rem 1rem',
                  fontSize: '1rem',
                  background: 'var(--bg3)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text)',
                  outline: 'none'
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {/* Type Relation */}
              <div className="form-group">
                <label style={{ fontWeight: 600, display: 'block', marginBottom: '0.5rem' }}>Relación de Inventario</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.8rem',
                    border: bulkRelation === 'madre' ? '2px solid var(--gold)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    background: bulkRelation === 'madre' ? 'rgba(212,175,55,0.05)' : 'var(--bg3)',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: bulkRelation === 'madre' ? 'var(--gold)' : 'inherit',
                    textAlign: 'center'
                  }}>
                    <input type="radio" checked={bulkRelation === 'madre'} onChange={() => setBulkRelation('madre')} style={{ display: 'none' }} />
                    📦 Madre (Caja/Padre)
                  </label>
                  <label style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    padding: '0.8rem',
                    border: bulkRelation === 'hijo' ? '2px solid var(--gold)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    background: bulkRelation === 'hijo' ? 'rgba(212,175,55,0.05)' : 'var(--bg3)',
                    cursor: 'pointer',
                    fontSize: '0.88rem',
                    fontWeight: 600,
                    color: bulkRelation === 'hijo' ? 'var(--gold)' : 'inherit',
                    textAlign: 'center'
                  }}>
                    <input type="radio" checked={bulkRelation === 'hijo'} onChange={() => setBulkRelation('hijo')} style={{ display: 'none' }} />
                    🍬 Hijo (Unidad Suelta)
                  </label>
                </div>
              </div>

              {/* Quantity (Stock) */}
              <div className="form-group">
                <label htmlFor="bulk-stock" style={{ fontWeight: 600, display: 'block', marginBottom: '0.4rem' }}>Cantidad en Stock *</label>
                <input
                  id="bulk-stock"
                  type="number"
                  min="0"
                  value={bulkStock}
                  onChange={e => setBulkStock(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSaveBulkNext();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '0.8rem 1rem',
                    fontSize: '1rem',
                    background: 'var(--bg3)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* Bulk actions buttons */}
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleFinishBulkForm}
                disabled={loading}
                className="btn-outline"
                style={{
                  borderColor: 'var(--gold)',
                  color: 'var(--gold)',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer'
                }}
              >
                🏁 Terminar Formulario y Completar
              </button>
              <button
                type="button"
                onClick={handleSaveBulkNext}
                disabled={loading}
                className="btn-primary"
                style={{
                  background: 'var(--gold)',
                  color: '#000',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  padding: '0.75rem 2rem',
                  boxShadow: '0 4px 12px rgba(212,175,55,0.2)',
                  cursor: 'pointer'
                }}
              >
                {loading ? '⏳ Registrando...' : '➕ Continuar con el Siguiente (Enter)'}
              </button>
            </div>

            {/* Session Products List */}
            {sessionProducts.length > 0 && (
              <div style={{ marginTop: '2.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>📋 Productos pre-registrados en esta sesión</span>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(212,175,55,0.15)', color: 'var(--gold)', padding: '0.2rem 0.6rem', borderRadius: '4px' }}>
                    {sessionProducts.length} productos
                  </span>
                </h3>
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg3)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border)' }}>
                        <th style={{ padding: '0.6rem 1rem' }}>Código</th>
                        <th style={{ padding: '0.6rem 1rem' }}>Nombre</th>
                        <th style={{ padding: '0.6rem 1rem' }}>Relación</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'right' }}>Cantidad</th>
                        <th style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sessionProducts.map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: idx < sessionProducts.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td style={{ padding: '0.6rem 1rem', fontFamily: 'monospace' }}>{p.barcode}</td>
                          <td style={{ padding: '0.6rem 1rem', fontWeight: 600 }}>{p.name}</td>
                          <td style={{ padding: '0.6rem 1rem' }}>
                            <span className={p.es_subproducto ? 'badge-featured' : 'badge-service'} style={{ fontSize: '0.72rem', padding: '2px 6px', borderRadius: '4px' }}>
                              {p.es_subproducto ? 'Hijo' : 'Madre'}
                            </span>
                          </td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'right', fontWeight: 700 }}>{p.stock}</td>
                          <td style={{ padding: '0.6rem 1rem', textAlign: 'center' }}>
                            <span className="status-badge status-pending" style={{ padding: '0.15rem 0.4rem', fontSize: '0.72rem' }}>
                              Por completar
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {/* Basic Info */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
              <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem' }}>📝 Información Básica</h3>
              
              <div className="form-group">
                <label htmlFor="prod-name">Nombre del producto *</label>
                <input 
                  id="prod-name"
                  name="name"
                  type="text" 
                  value={form.name} 
                  onChange={handleNameChange} 
                  style={{ borderColor: errors.name ? 'var(--error)' : undefined }}
                />
                {errors.name && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.name}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="prod-slug">Slug (URL) *</label>
                <input 
                  id="prod-slug"
                  name="slug"
                  type="text" 
                  value={form.slug} 
                  onChange={e => {
                    setForm(f => ({ ...f, slug: e.target.value }));
                    if (errors.slug) setErrors(prev => ({ ...prev, slug: '' }));
                  }} 
                  style={{ borderColor: errors.slug ? 'var(--error)' : undefined }}
                />
                {errors.slug && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.slug}</p>}
              </div>

              <div className="form-group">
                <label htmlFor="prod-category">Categoría</label>
                <select id="prod-category" value={form.category_id} onChange={handleCategoryChange}>
                  <option value="">Sin categoría</option>
                  {localCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  <option value="new_category">➕ Crear nueva categoría...</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="prod-supplier">Proveedor Habitual</label>
                <select id="prod-supplier" value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}>
                  <option value="">Sin proveedor habitual</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="prod-purchase-url">Enlace de Compra (URL del Proveedor)</label>
                <input
                  id="prod-purchase-url"
                  type="url"
                  placeholder="https://articulo.mercadolibre.com.ve/..."
                  value={form.purchase_url}
                  onChange={e => setForm(f => ({ ...f, purchase_url: e.target.value }))}
                  style={{
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--bg-input, var(--bg3))',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="prod-short-desc">Descripción corta</label>
                <textarea id="prod-short-desc" value={form.short_desc} onChange={e => setForm(f => ({ ...f, short_desc: e.target.value }))} rows={2} style={{ resize: 'vertical' }} />
              </div>

              <div className="form-group">
                <label htmlFor="prod-desc">Descripción completa</label>
                <textarea id="prod-desc" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={5} style={{ resize: 'vertical' }} />
              </div>
            </div>

            {/* Price, Stock, Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem' }}>💰 Precio y Stock</h3>
                
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="prod-price-type">Tipo de Precio</label>
                  <select
                    id="prod-price-type"
                    name="price_type"
                    value={form.price_type}
                    onChange={e => {
                      const typeVal = e.target.value as any;
                      setForm(f => ({
                        ...f,
                        price_type: typeVal,
                        price: typeVal === 'contact' ? '0' : f.price
                      }));
                      if (errors.price) setErrors(prev => ({ ...prev, price: '' }));
                      if (errors.price_max) setErrors(prev => ({ ...prev, price_max: '' }));
                    }}
                    style={{ width: '100%', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '8px', padding: '0.75rem', color: 'var(--text)', fontSize: '0.88rem', outline: 'none' }}
                  >
                    <option value="fixed">💵 Precio Fijo</option>
                    <option value="base">📈 Precio Base (Desde...)</option>
                    <option value="range">↔️ Rango de Precios</option>
                    <option value="contact">🤝 Acordar con el vendedor</option>
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                  {form.price_type !== 'contact' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="prod-price">
                        {form.price_type === 'range' ? 'Precio Mínimo (USD) *' : form.price_type === 'base' ? 'Precio Base (USD) *' : 'Precio (USD) *'}
                      </label>
                      <input 
                        id="prod-price"
                        name="price"
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={form.price} 
                        onChange={e => {
                          setForm(f => ({ ...f, price: e.target.value }));
                          if (errors.price) setErrors(prev => ({ ...prev, price: '' }));
                        }}
                        style={{ borderColor: errors.price ? 'var(--error)' : undefined }}
                      />
                      {errors.price && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.price}</p>}
                    </div>
                  )}

                  {form.price_type === 'range' && (
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label htmlFor="prod-price-max">Precio Máximo (USD) *</label>
                      <input 
                        id="prod-price-max"
                        name="price_max"
                        type="number" 
                        min="0" 
                        step="0.01" 
                        value={form.price_max} 
                        onChange={e => {
                          setForm(f => ({ ...f, price_max: e.target.value }));
                          if (errors.price_max) setErrors(prev => ({ ...prev, price_max: '' }));
                        }}
                        style={{ borderColor: errors.price_max ? 'var(--error)' : undefined }}
                      />
                      {errors.price_max && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.price_max}</p>}
                    </div>
                  )}

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="prod-stock">Stock *</label>
                    <input 
                      id="prod-stock"
                      name="stock"
                      type="number" 
                      min="0" 
                      value={form.stock} 
                      onChange={e => {
                        setForm(f => ({ ...f, stock: e.target.value }));
                        if (errors.stock) setErrors(prev => ({ ...prev, stock: '' }));
                      }} 
                      disabled={form.type === 'service'} 
                      style={{ borderColor: errors.stock ? 'var(--error)' : undefined }}
                    />
                    {errors.stock && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.stock}</p>}
                  </div>
                </div>

                {form.type === 'product' && (
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label htmlFor="prod-min-stock-alert">Alerta de Stock Crítico *</label>
                    <input 
                      id="prod-min-stock-alert"
                      name="min_stock_alert"
                      type="number" 
                      min="0" 
                      value={form.min_stock_alert} 
                      onChange={e => {
                        setForm(f => ({ ...f, min_stock_alert: e.target.value }));
                        if (errors.min_stock_alert) setErrors(prev => ({ ...prev, min_stock_alert: '' }));
                      }} 
                      style={{ borderColor: errors.min_stock_alert ? 'var(--error)' : undefined }}
                    />
                    {errors.min_stock_alert && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.min_stock_alert}</p>}
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.3rem' }}>
                      Nivel mínimo antes de marcar el producto con alerta visual de inventario bajo.
                    </small>
                  </div>
                )}

                {form.type === 'product' && (
                  <div className="form-group" style={{ marginTop: '1rem' }}>
                    <label htmlFor="prod-barcode">📊 Código de Barras</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        id="prod-barcode"
                        name="barcode"
                        type="text" 
                        placeholder="Escanee con el lector o escriba manualmente"
                        value={form.barcode}
                        onChange={e => {
                          setForm(f => ({ ...f, barcode: e.target.value }));
                        }}
                        style={{
                          flex: 1,
                          padding: '0.6rem 0.8rem',
                          background: 'var(--bg-input, var(--bg3))',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          color: 'var(--text)',
                          outline: 'none',
                          fontSize: '0.88rem',
                          fontFamily: 'monospace',
                          letterSpacing: '0.05em'
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setScannerTarget('classic');
                          setIsScannerOpen(true);
                        }}
                        style={{
                          background: 'rgba(212,175,55,0.1)',
                          color: 'var(--gold)',
                          border: '1px solid var(--gold)',
                          borderRadius: '8px',
                          padding: '0 0.8rem',
                          fontSize: '1rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          minHeight: '38px'
                        }}
                        title="Escanear con Cámara"
                      >
                        📷
                      </button>
                      {form.barcode && (
                        <button
                          type="button"
                          onClick={handleBarcodeLookup}
                          disabled={lookupLoading}
                          style={{
                            background: 'rgba(212,175,55,0.1)',
                            color: 'var(--gold)',
                            border: '1px solid var(--gold)',
                            borderRadius: '8px',
                            padding: '0 0.8rem',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: lookupLoading ? 'not-allowed' : 'pointer',
                            minHeight: '38px'
                          }}
                        >
                          {lookupLoading ? '🔍...' : '⚡ Llenar'}
                        </button>
                      )}
                    </div>
                    <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', display: 'block', marginTop: '0.3rem' }}>
                      Se usa para venta rápida en POS. Escanee el producto con el lector o escriba el código (EAN-13, UPC, etc.).
                    </small>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="prod-type">Tipo</label>
                  <select 
                    id="prod-type" 
                    value={form.type} 
                    onChange={e => {
                      const isService = e.target.value === 'service';
                      setForm(f => ({ 
                        ...f, 
                        type: e.target.value as 'product' | 'service', 
                        stock: isService ? '0' : f.stock 
                      }));
                      if (isService) {
                        setErrors(prev => ({ ...prev, stock: '' }));
                      }
                    }}
                  >
                    <option value="product">🛍️ Producto físico</option>
                    <option value="service">🔧 Servicio</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input type="checkbox" checked={form.is_featured} onChange={e => setForm(f => ({ ...f, is_featured: e.target.checked }))} style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }} />
                    ⭐ Destacado
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem' }}>
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }} />
                    👁️ Activo (visible en tienda)
                  </label>
                </div>
              </div>

              {/* Relation of Inventory (Auto-desglose) */}
              {form.type === 'product' && (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                  <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem' }}>📦 Relación de Inventario (Auto-Desglose)</h3>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.88rem', marginBottom: form.es_subproducto ? '1rem' : '0' }}>
                    <input 
                      type="checkbox" 
                      checked={form.es_subproducto} 
                      onChange={e => {
                        const esSub = e.target.checked;
                        setForm(f => ({ ...f, es_subproducto: esSub }));
                        if (!esSub) {
                          setErrors(prev => ({ ...prev, id_producto_padre: '', unidades_por_padre: '' }));
                        }
                      }} 
                      style={{ accentColor: 'var(--gold)', width: '16px', height: '16px' }} 
                    />
                    ¿Es un subproducto (unidad suelta)?
                  </label>

                  {form.es_subproducto && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.8rem', paddingLeft: '1rem', borderLeft: '2px solid var(--gold)' }}>
                      <div className="form-group">
                        <label htmlFor="prod-parent">Producto Padre (Caja/Paquete) *</label>
                        <select 
                          id="prod-parent"
                          name="id_producto_padre"
                          value={form.id_producto_padre} 
                          onChange={e => {
                            setForm(f => ({ ...f, id_producto_padre: e.target.value }));
                            if (errors.id_producto_padre) setErrors(prev => ({ ...prev, id_producto_padre: '' }));
                          }}
                          style={{ borderColor: errors.id_producto_padre ? 'var(--error)' : undefined }}
                        >
                          <option value="">-- Seleccionar producto padre --</option>
                          {products
                            .filter(p => p.id !== productId)
                            .map(p => <option key={p.id} value={p.id}>{p.name} (ID: {p.id})</option>)
                          }
                        </select>
                        {errors.id_producto_padre && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.id_producto_padre}</p>}
                      </div>

                      <div className="form-group">
                        <label htmlFor="prod-yield">Unidades por Padre (Rendimiento) *</label>
                        <input 
                          id="prod-yield"
                          name="unidades_por_padre"
                          type="number" 
                          min="1" 
                          placeholder="Ej: 12"
                          value={form.unidades_por_padre} 
                          onChange={e => {
                            setForm(f => ({ ...f, unidades_por_padre: e.target.value }));
                            if (errors.unidades_por_padre) setErrors(prev => ({ ...prev, unidades_por_padre: '' }));
                          }} 
                          style={{ borderColor: errors.unidades_por_padre ? 'var(--error)' : undefined }}
                        />
                        {errors.unidades_por_padre && <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>{errors.unidades_por_padre}</p>}
                        <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
                          Cuántas unidades sueltas rinde una caja del producto padre (se descontará 1 caja del padre y se sumarán estas unidades al hijo automáticamente al vender sin stock).
                        </small>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Images */}
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem' }}>
                <h3 style={{ marginBottom: '1.2rem', fontSize: '0.95rem' }}>🖼️ Imágenes</h3>
                <ImageInput 
                  label="Imagen principal" 
                  onChange={f => handleFileChange(f, setImageFile, setImagePreview)} 
                  previewUrl={imagePreview} 
                />
                <ImageInput 
                  label="Imagen secundaria" 
                  onChange={f => handleFileChange(f, setImage2File, setImage2Preview)} 
                  previewUrl={image2Preview} 
                />
                <ImageInput 
                  label="Imagen adicional" 
                  onChange={f => handleFileChange(f, setImage3File, setImage3Preview)} 
                  previewUrl={image3Preview} 
                />
                {productId && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>* Deja vacío para conservar imágenes actuales.</p>}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => router.back()} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? '⏳ Guardando...' : (productId ? '💾 Actualizar' : '✅ Crear Producto')}
            </button>
          </div>
        </form>
      )}

      {/* Styled Modal for new category */}
      {isCategoryModalOpen && (
        <div className="modal-overlay open">
          <div className="modal" style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>➕ Crear nueva categoría</h3>
              <button 
                type="button" 
                onClick={() => setIsCategoryModalOpen(false)} 
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.25rem', cursor: 'pointer', outline: 'none' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label htmlFor="new-category-name" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.88rem' }}>
                  Nombre de la categoría *
                </label>
                <input
                  id="new-category-name"
                  type="text"
                  value={newCategoryName}
                  onChange={e => {
                    setNewCategoryName(e.target.value);
                    setCategoryModalError('');
                  }}
                  placeholder="Ej: Accesorios"
                  style={{ 
                    width: '100%',
                    padding: '0.6rem 0.8rem',
                    background: 'var(--bg-input, var(--bg3))',
                    border: categoryModalError ? '1px solid var(--error)' : '1px solid var(--border)',
                    borderRadius: '8px',
                    color: 'var(--text)',
                    outline: 'none'
                  }}
                  autoFocus
                />
                {categoryModalError && (
                  <p style={{ color: 'var(--error)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {categoryModalError}
                  </p>
                )}
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: '0.8rem', justifyContent: 'flex-end', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '0.8rem' }}>
              <button type="button" className="btn-outline" onClick={() => setIsCategoryModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary" onClick={handleCreateCategorySubmit} disabled={loading}>
                {loading ? 'Guardando...' : 'Crear'}
              </button>
            </div>
          </div>
        </div>
      )}
      {isScannerOpen && (
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScanSuccess={handleCameraScanSuccess}
        />
      )}
    </>
  );
}
