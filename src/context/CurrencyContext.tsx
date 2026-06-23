'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type CurrencyType = 'USD' | 'VES';

interface CurrencyContextProps {
  currency: CurrencyType;
  setCurrency: (c: CurrencyType) => void;
  dollarRate: number;
  formatPriceLocal: (priceUsd: number) => string;
  formatProductPrice: (priceUsd: number | string, priceType?: string, priceMaxUsd?: number | string | null) => string;
}

const CurrencyContext = createContext<CurrencyContextProps | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyType>('USD');
  const [dollarRate, setDollarRate] = useState<number>(40.0);

  useEffect(() => {
    const saved = localStorage.getItem('rexermi_display_currency');
    if (saved === 'VES') {
      setCurrencyState('VES');
    }

    fetch('/api/settings')
      .then(res => res.json() as any)
      .then(data => {
        if (data.success && data.settings) {
          const rate = parseFloat(data.settings['dollar_rate']);
          if (rate > 0) setDollarRate(rate);
        }
      })
      .catch(err => console.error('Failed to load dollar rate for switcher:', err));
  }, []);

  const setCurrency = (c: CurrencyType) => {
    setCurrencyState(c);
    localStorage.setItem('rexermi_display_currency', c);
  };

  const formatPriceLocal = (priceUsd: number) => {
    if (currency === 'VES') {
      const priceBs = priceUsd * dollarRate;
      return `${priceBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Bs.`;
    }
    return `$${priceUsd.toFixed(2)}`;
  };

  const formatProductPrice = (
    price: number | string,
    priceType: string = 'fixed',
    priceMax?: number | string | null
  ) => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : Number(price);
    const numericPriceMax = priceMax ? (typeof priceMax === 'string' ? parseFloat(priceMax) : Number(priceMax)) : null;

    if (numericPrice === 0 || priceType === 'contact') {
      return 'Acordar con el vendedor';
    }

    if (priceType === 'base') {
      return `Desde ${formatPriceLocal(numericPrice)}`;
    }

    if (priceType === 'range' && numericPriceMax !== null) {
      return `${formatPriceLocal(numericPrice)} - ${formatPriceLocal(numericPriceMax)}`;
    }

    return formatPriceLocal(numericPrice);
  };

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, dollarRate, formatPriceLocal, formatProductPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (context === undefined) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
}
