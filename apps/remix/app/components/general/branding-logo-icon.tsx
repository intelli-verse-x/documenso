import type { SVGAttributes } from 'react';

import { useBrand } from '../../providers/brand';

export type LogoProps = SVGAttributes<SVGSVGElement>;

/**
 * Hostname-aware icon-only mark (square viewBox). Renders the Intelliverse or
 * Toba Tech glyph based on the active brand. Uses `currentColor`.
 */
export const BrandingLogoIcon = ({ ...props }: LogoProps) => {
  const brand = useBrand();

  if (brand.id === 'toba') {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" fill="none" {...props}>
        <path
          d="M42 6 L70 22 L70 62 L42 78 L14 62 L14 22 Z"
          stroke="currentColor"
          strokeWidth="5"
          fill="none"
          opacity="0.5"
        />
        <path d="M42 24 L58 33 L58 51 L42 60 L26 51 L26 33 Z" fill="currentColor" />
      </svg>
    );
  }

  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 84 84" fill="none" {...props}>
      <circle cx="42" cy="42" r="13" fill="currentColor" />
      <circle cx="42" cy="42" r="30" stroke="currentColor" strokeWidth="5" fill="none" opacity="0.45" />
      <circle cx="69" cy="24" r="6" fill="currentColor" />
    </svg>
  );
};
