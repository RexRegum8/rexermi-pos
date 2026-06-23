'use client';

import React, { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const [isLight, setIsLight] = useState(false);

  useEffect(() => {
    setIsLight(document.documentElement.classList.contains('light-theme'));
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const nextLight = html.classList.toggle('light-theme');
    setIsLight(nextLight);
    localStorage.setItem('rexermi_theme', nextLight ? 'light' : 'dark');
  };

  return (
    <button
      onClick={toggleTheme}
      className="theme-toggle"
      title={isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro'}
      aria-label="Cambiar tema de color"
    >
      {isLight ? '🌙' : '☀️'}
    </button>
  );
}
