import type React from 'react';
import { createContext, useContext } from 'react';

import type { BrandConfig, BrandId } from '../utils/branding/brand-config';
import { DEFAULT_BRAND_ID, getBrand } from '../utils/branding/brand-config';

type BrandProviderValue = BrandConfig;

interface BrandProviderProps {
  children: React.ReactNode;
  brandId: BrandId;
}

// Defaults to the Intelliverse brand so components used outside a provider
// (e.g. server-side PDF certificate rendering) never crash.
const BrandContext = createContext<BrandProviderValue>(getBrand(DEFAULT_BRAND_ID));

export const useBrand = (): BrandProviderValue => useContext(BrandContext);

export const BrandProvider = ({ children, brandId }: BrandProviderProps) => {
  return <BrandContext.Provider value={getBrand(brandId)}>{children}</BrandContext.Provider>;
};
