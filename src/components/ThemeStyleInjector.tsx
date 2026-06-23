import { getSettings } from '@/lib/settings';
import { deriveThemeStyles } from '@/lib/helpers';

export default async function ThemeStyleInjector() {
  const settings = await getSettings();
  const t = deriveThemeStyles(settings);

  return (
    <style
      id="rexermi-theme"
      dangerouslySetInnerHTML={{
        __html: `
          /* ── Dark mode (default :root) ────────────────────────── */
          html:root {
            --gold:       ${t.accentDark};
            --gold-light: ${t.accentDarkLight};
            --gold-dark:  ${t.accentDarkDark};
            --border:     ${t.borderDark};
            --glass:      ${t.glassDark};
            --glass-blur: ${t.blur}px;
            --text:       ${t.textDark};
            --text-muted: ${t.textDark}99;
            --bg:         ${t.bgDark};
            --bg2:        ${t.bgDark}E6;
            --bg3:        ${t.bgDark}CC;
            --bg4:        ${t.bgDark}B3;
            --navbar-bg:  ${t.bgDark}F2;
            --navbar-blur:${t.bgDark}E0;
            --navlinks-bg: ${t.bgDark}FA;
            --navlinks-blur: ${t.bgDark}EB;
          }

          /* ── Light mode overrides ─────────────────────────────── */
          html.light-theme {
            --gold:       ${t.accentLight};
            --gold-light: ${t.accentLightLight};
            --gold-dark:  ${t.accentLightDark};
            --border:     ${t.borderLight};
            --glass:      ${t.glassLight};
            --text:       ${t.textLight};
            --text-muted: ${t.textLight}99;
            --bg:         ${t.bgLight};
            --bg2:        ${t.bgLight}E6;
            --bg3:        ${t.bgLight}CC;
            --bg4:        ${t.bgLight}B3;
            --navbar-bg:  ${t.bgLight}F2;
            --navbar-blur:${t.bgLight}E0;
            --navlinks-bg: ${t.bgLight}FA;
            --navlinks-blur: ${t.bgLight}EB;
          }

          @supports (backdrop-filter: blur(1px)) {
            .navbar { backdrop-filter: blur(var(--glass-blur)); -webkit-backdrop-filter: blur(var(--glass-blur)); }
            .nav-links { backdrop-filter: blur(calc(var(--glass-blur) + 4px)); -webkit-backdrop-filter: blur(calc(var(--glass-blur) + 4px)); }
          }
        `,
      }}
    />
  );
}
