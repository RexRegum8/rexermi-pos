'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useToast } from '@/context/ToastContext';

export interface CartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  type: 'product' | 'service';
  stock: number;
  price_type?: string;
  price_max?: number | null;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>, qty?: number) => void;
  removeFromCart: (id: number) => void;
  updateQuantity: (id: number, quantity: number) => void;
  clearCart: () => void;
  refreshCartPrices: () => Promise<void>;
  cartTotal: number;
  cartCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { showToast } = useToast();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    const storedCart = localStorage.getItem('rexermi_cart');
    if (storedCart) {
      try {
        setCart(JSON.parse(storedCart));
      } catch (e) {
        console.error('Failed to parse cart data', e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Sync cart to localStorage
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('rexermi_cart', JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const addToCart = (product: Omit<CartItem, 'quantity'>, qty: number = 1) => {
    setCart((prevCart) => {
      const existingItem = prevCart.find((item) => item.id === product.id);
      if (existingItem) {
        // If it's a product (not a service) check stock limits
        const newQty = existingItem.quantity + qty;
        if (product.type === 'product' && newQty > product.stock) {
          showToast(`Lo sentimos, solo quedan ${product.stock} unidades en stock.`, 'error');
          return prevCart.map((item) =>
            item.id === product.id ? { ...item, quantity: product.stock } : item
          );
        }
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prevCart, { ...product, quantity: qty }];
    });
  };

  const removeFromCart = (id: number) => {
    setCart((prevCart) => prevCart.filter((item) => item.id !== id));
  };

  const updateQuantity = (id: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prevCart) =>
      prevCart.map((item) => {
        if (item.id === id) {
          if (item.type === 'product' && quantity > item.stock) {
            showToast(`Lo sentimos, solo quedan ${item.stock} unidades en stock.`, 'error');
            return { ...item, quantity: item.stock };
          }
          return { ...item, quantity };
        }
        return item;
      })
    );
  };

  const clearCart = () => {
    setCart([]);
  };

  const refreshCartPrices = async () => {
    if (cart.length === 0) return;
    try {
      const ids = cart.map(item => item.id).join(',');
      const res = await fetch(`/api/products?ids=${ids}`);
      const data = (await res.json()) as any;
      if (data.success && data.products) {
        setCart(prevCart =>
          prevCart.map(item => {
            const dbProd = data.products.find((p: any) => p.id === item.id);
            if (dbProd) {
              return {
                ...item,
                price: parseFloat(dbProd.price),
                stock: dbProd.stock,
                name: dbProd.name,
                image: dbProd.image || item.image,
                price_type: dbProd.price_type,
                price_max: dbProd.price_max ? parseFloat(dbProd.price_max) : null
              };
            }
            return item;
          })
        );
      }
    } catch (e) {
      console.error('Failed to refresh cart prices:', e);
    }
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const cartCount = cart.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        refreshCartPrices,
        cartTotal,
        cartCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
