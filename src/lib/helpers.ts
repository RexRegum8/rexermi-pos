export function formatPrice(amount: number | string | null | undefined, symbol: string = '$'): string {
  if (amount === null || amount === undefined || amount === '') {
    return `${symbol}0.00`;
  }
  const numericVal = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  if (isNaN(numericVal)) return `${symbol}0.00`;
  return `${symbol}${numericVal.toFixed(2)}`;
}

export function renderProductPriceText(
  price: number | string | null | undefined,
  priceType: string = 'fixed',
  priceMax: number | string | null | undefined = null,
  symbol: string = '$'
): string {
  const numericPrice = parseFloat(String(price || 0));
  const numericPriceMax = priceMax ? parseFloat(String(priceMax)) : null;

  if (numericPrice === 0 || priceType === 'contact') {
    return 'Acordar con el vendedor';
  }

  if (priceType === 'base') {
    return `Desde ${formatPrice(numericPrice, symbol)}`;
  }

  if (priceType === 'range' && numericPriceMax !== null) {
    return `${formatPrice(numericPrice, symbol)} - ${formatPrice(numericPriceMax, symbol)}`;
  }

  return formatPrice(numericPrice, symbol);
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}

export function generateOrderNumber(prefix: string = 'REX'): string {
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${rand}`;
}

export function hexToRgb(hex: string): [number, number, number] {
  let cleanedHex = hex.replace('#', '');
  if (cleanedHex.length === 3) {
    cleanedHex = cleanedHex[0] + cleanedHex[0] + cleanedHex[1] + cleanedHex[1] + cleanedHex[2] + cleanedHex[2];
  }
  const num = parseInt(cleanedHex, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function adjustColor(hex: string, factor: number): string {
  const [r, g, b] = hexToRgb(hex);
  const adjust = (val: number) => Math.min(255, Math.max(0, Math.round(val * factor)));
  const nr = adjust(r);
  const ng = adjust(g);
  const nb = adjust(b);
  return `#${((1 << 24) + (nr << 16) + (ng << 8) + nb).toString(16).slice(1).toUpperCase()}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Validates that a value is a proper hex color. Falls back to defaultVal if not. */
function safeHex(val: string | undefined, defaultVal: string): string {
  if (val && /^#[0-9A-Fa-f]{3,6}$/.test(val.trim())) return val.trim();
  return defaultVal;
}

export interface ThemeStyles {
  // Accent (brand gold) — same concept, but can differ per theme
  accentDark: string;
  accentDarkLight: string;
  accentDarkDark: string;

  accentLight: string;
  accentLightLight: string;
  accentLightDark: string;

  // Per-theme text & background
  textDark: string;
  textLight: string;
  bgDark: string;
  bgLight: string;

  // Glass / border
  blur: number;
  borderDark: string;
  borderLight: string;
  glassDark: string;
  glassLight: string;
}

export function deriveThemeStyles(settings: Record<string, string>): ThemeStyles {
  // ── Dark mode accent ──────────────────────────────────────────
  const accentDark = safeHex(
    settings['accent_dark'] || settings['primary_color'],
    '#D4AF37'
  );
  const accentDarkLight = adjustColor(accentDark, 1.25);
  const accentDarkDark  = adjustColor(accentDark, 0.75);

  // ── Light mode accent ─────────────────────────────────────────
  const accentLight = safeHex(
    settings['accent_light'],
    adjustColor(accentDark, 0.8)
  );
  const accentLightLight = adjustColor(accentLight, 1.2);
  const accentLightDark  = adjustColor(accentLight, 0.75);

  // ── Per-theme text & background ───────────────────────────────
  const textDark  = safeHex(settings['text_color_dark'],  '#F0EFE8');
  const textLight = safeHex(settings['text_color_light'], '#1A1A22');
  const bgDark    = safeHex(settings['bg_color_dark'],    '#0A0A0F');
  const bgLight   = safeHex(settings['bg_color_light'],   '#F5F4EF');

  // ── Glass / blur ──────────────────────────────────────────────
  let blur = parseInt(settings['glass_blur'] || '16', 10);
  if (isNaN(blur) || blur < 0 || blur > 40) blur = 16;

  const borderDark  = hexToRgba(accentDark,  0.15);
  const borderLight = hexToRgba(accentLight, 0.25);
  const glassDark   = hexToRgba(accentDark,  0.05);
  const glassLight  = hexToRgba(accentLight, 0.08);

  return {
    accentDark, accentDarkLight, accentDarkDark,
    accentLight, accentLightLight, accentLightDark,
    textDark, textLight, bgDark, bgLight,
    blur,
    borderDark, borderLight, glassDark, glassLight,
  };
}

export function isValidImageOrPdfBuffer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }
  
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer.length >= 8 &&
      buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
    return true;
  }

  // WebP: RIFF .... WEBP
  if (buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
    return true;
  }

  // PDF: 25 50 44 46 (%PDF)
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) {
    return true;
  }

  return false;
}

export function triggerHaptic(type: 'light' | 'medium' | 'success' | 'warning'): void {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    try {
      if (type === 'light') {
        window.navigator.vibrate(35);
      } else if (type === 'medium') {
        window.navigator.vibrate(60);
      } else if (type === 'success') {
        window.navigator.vibrate([80, 40, 80]);
      } else if (type === 'warning') {
        window.navigator.vibrate([100, 60, 100]);
      }
    } catch (e) {
      console.warn('Haptic feedback not allowed or failed:', e);
    }
  }
}
