import type { SVGAttributes } from 'react';

import { useBrand } from '../../providers/brand';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * Hostname-aware wordmark. Renders the Intelliverse or Toba Tech wordmark based
 * on the active brand (see BrandProvider). Uses `currentColor` so it inherits
 * the surrounding text color and adapts to light/dark themes.
 */
export const BrandingLogo = ({ ...props }: LogoProps) => {
  const brand = useBrand();

  if (brand.id === 'toba') {
    return <TobaWordmark {...props} />;
  }

  return <IntelliverseWordmark {...props} />;
};

const IntelliverseWordmark = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 232 40" fill="none" {...props}>
      {/* Orbit mark */}
      <circle cx="20" cy="20" r="6" fill="currentColor" />
      <circle cx="20" cy="20" r="14" stroke="currentColor" strokeWidth="2.5" fill="none" opacity="0.45" />
      <circle cx="33" cy="11" r="2.6" fill="currentColor" />
      <text
        x="48"
        y="28"
        fill="currentColor"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        Intelliverse
      </text>
    </svg>
  );
};

const TobaWordmark = ({ ...props }: LogoProps) => {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 196 40" fill="none" {...props}>
      {/* Hexagon mark */}
      <path
        d="M20 4 L33 11.5 L33 28.5 L20 36 L7 28.5 L7 11.5 Z"
        stroke="currentColor"
        strokeWidth="2.5"
        fill="none"
        opacity="0.5"
      />
      <path d="M20 12 L26 15.5 L26 24.5 L20 28 L14 24.5 L14 15.5 Z" fill="currentColor" />
      <text
        x="48"
        y="28"
        fill="currentColor"
        fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
        fontSize="26"
        fontWeight="700"
        letterSpacing="-0.5"
      >
        Toba Tech
      </text>
    </svg>
  );
};
