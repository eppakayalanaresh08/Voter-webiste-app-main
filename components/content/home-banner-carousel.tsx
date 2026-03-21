'use client';

import { Box } from '@mui/material';
import type { FieldContentBanner } from '@/lib/field-content-shared';

export default function HomeBannerCarousel({ banners }: { banners: FieldContentBanner[] }) {
  const slide = banners.find((b) => b.enabled) ?? banners[0];

  if (!slide) return null;

  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '24px',
        minHeight: 180,
        backgroundColor: '#0b57d0'
      }}
    >
      <Box
        component="img"
        src={slide.imageUrl ?? '/icons/icon-512.png'}
        alt={slide.title || 'Banner'}
        sx={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(11,87,208,0.12) 0%, rgba(8,21,43,0.78) 100%)'
        }}
      />

    </Box>
  );
}
