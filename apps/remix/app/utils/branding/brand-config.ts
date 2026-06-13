/**
 * Hostname-aware shell branding for the Intelliverse + Toba Tech deployment.
 *
 * A single Documenso instance serves two branded hostnames:
 *   - contracts.intelli-verse-x.ai -> Intelliverse (default brand)
 *   - contracts.toba-tech.ai       -> Toba Tech
 *
 * This module is intentionally free of React/JSX and any server-only imports so
 * it can be used in both the SSR loader and the browser bundle. Logo SVGs live
 * in the logo components, which switch on `BrandId` from the brand context.
 *
 * Colors are stored as HSL triplets ("H S% L%") to match the CSS custom
 * properties defined in packages/ui/styles/theme.css.
 */

export type BrandId = 'intelliverse' | 'toba';

export type BrandThemeColors = {
  /** Primary action color (buttons, links, focus rings). */
  primary: string;
  /** Foreground used on top of `primary` (e.g. button label). */
  primaryForeground: string;
  /** Focus ring color; usually equal to `primary`. */
  ring: string;
};

export type BrandConfig = {
  id: BrandId;
  /** Wordmark / product name shown in titles and copy. */
  name: string;
  /** Legal company name used in footers/meta. */
  companyName: string;
  /** Support / contact email surfaced in copy. */
  supportEmail: string;
  /** Marketing website for the brand. */
  websiteUrl: string;
  /** SVG favicon served from apps/remix/public. */
  faviconHref: string;
  /** Open Graph image (absolute path under public). */
  ogImageHref: string;
  /** Short meta description. */
  description: string;
  /** Theme color overrides injected as CSS vars in <head>. */
  theme: BrandThemeColors;
};

export const DEFAULT_BRAND_ID: BrandId = 'intelliverse';

export const BRANDS: Record<BrandId, BrandConfig> = {
  intelliverse: {
    id: 'intelliverse',
    name: 'Intelliverse Contracts',
    companyName: 'Intelliverse',
    supportEmail: 'contracts@intelli-verse-x.ai',
    websiteUrl: 'https://intelli-verse-x.ai',
    faviconHref: '/brand/intelliverse-favicon.svg',
    ogImageHref: '/brand/intelliverse-og.svg',
    description: 'Send, sign, and manage contracts securely with Intelliverse.',
    theme: {
      primary: '246 89% 67%',
      primaryForeground: '0 0% 100%',
      ring: '246 89% 67%',
    },
  },
  toba: {
    id: 'toba',
    name: 'Toba Tech Contracts',
    companyName: 'Toba Tech',
    supportEmail: 'contracts@toba-tech.ai',
    websiteUrl: 'https://toba-tech.ai',
    faviconHref: '/brand/toba-favicon.svg',
    ogImageHref: '/brand/toba-og.svg',
    description: 'Send, sign, and manage contracts securely with Toba Tech.',
    theme: {
      primary: '175 84% 32%',
      primaryForeground: '0 0% 100%',
      ring: '175 84% 32%',
    },
  },
};

/**
 * Resolve a brand from a request Host header (or window.location.host).
 * Pure + safe: strips port, lowercases, defaults to Intelliverse.
 */
export const resolveBrandId = (host?: string | null): BrandId => {
  if (!host) {
    return DEFAULT_BRAND_ID;
  }

  const hostname = host.toLowerCase().split(':')[0];

  if (hostname.includes('toba-tech') || hostname.includes('toba.')) {
    return 'toba';
  }

  return DEFAULT_BRAND_ID;
};

export const getBrand = (brandId: BrandId): BrandConfig => BRANDS[brandId] ?? BRANDS[DEFAULT_BRAND_ID];

/**
 * Build the inline CSS that overrides the default theme color with the brand's
 * primary color. Injected into <head> (with a CSP nonce) so it applies before
 * first paint on both the app shell and recipient/signing pages.
 */
export const buildBrandThemeCss = (brandId: BrandId): string => {
  const { theme } = getBrand(brandId);

  const vars = [
    `--primary: ${theme.primary};`,
    `--primary-foreground: ${theme.primaryForeground};`,
    `--ring: ${theme.ring};`,
  ].join(' ');

  // Apply to both light and dark roots so brand color is consistent.
  return `:root { ${vars} } .dark { ${vars} }`;
};
