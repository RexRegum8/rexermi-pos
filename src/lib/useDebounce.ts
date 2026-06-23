import { useState, useEffect } from 'react';

/**
 * Hook para retrasar la actualización de un valor por un tiempo específico.
 * @param value Valor de entrada (ej. texto de búsqueda)
 * @param delay Retraso en milisegundos (por defecto 300ms)
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Limpieza del temporizador si el valor de entrada cambia antes del retraso
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
