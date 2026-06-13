import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { i18n, type MessageDescriptor } from '@lingui/core';

import type { BrandId } from './branding/brand-config';
import { DEFAULT_BRAND_ID, getBrand } from './branding/brand-config';

export const appMetaTags = (title?: MessageDescriptor, brandId: BrandId = DEFAULT_BRAND_ID) => {
  const brand = getBrand(brandId);
  const description = brand.description;
  const ogImage = `${NEXT_PUBLIC_WEBAPP_URL()}${brand.ogImageHref}`;

  return [
    {
      title: title ? `${i18n._(title)} - ${brand.name}` : brand.name,
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content: `${brand.companyName}, contracts, document signing, e-signature, agreements, templates`,
    },
    {
      name: 'author',
      content: brand.companyName,
    },
    {
      name: 'robots',
      content: 'noindex, nofollow',
    },
    {
      property: 'og:title',
      content: brand.name,
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: ogImage,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: ogImage,
    },
  ];
};
