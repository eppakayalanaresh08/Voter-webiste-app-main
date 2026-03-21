'use client';

import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { FieldContentBanner } from '@/lib/field-content-shared';

type OnboardingMobileHeroProps = {
  banners: FieldContentBanner[];
};

export default function OnboardingMobileHero({ banners }: OnboardingMobileHeroProps) {
  const slide = banners.find((b) => b.enabled) ?? banners[0];

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'flex-end',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#08152b'
      }}
    >
      <Box
        component="img"
        src={slide?.imageUrl ?? '/icons/icon-512.png'}
        alt={slide?.title || 'ClickVote banner'}
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
          background: 'linear-gradient(to top, rgba(2, 9, 23, 0.88) 0%, rgba(2, 9, 23, 0.44) 50%, rgba(2, 9, 23, 0.08) 100%)'
        }}
      />

      <Box
        sx={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 420,
          px: 3,
          pb: 6,
          color: '#ffffff'
        }}
      >
        <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.72)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Campaign Banner
        </Typography>

        <Typography variant="h3" sx={{ mt: 0.75, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1, color: '#ffffff' }}>
          {slide?.title || 'Manage voter data in one place'}
        </Typography>

        <Typography sx={{ mt: 0.75, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.84)' }}>
          {slide?.subtitle || 'Upload voter records, organize booths, and manage field teams with a simple workflow.'}
        </Typography>

        <Stack spacing={1.25} sx={{ mt: 4 }}>
          <Button
            component={NextLink}
            href="/login"
            variant="contained"
            fullWidth
            sx={{
              height: 48,
              borderRadius: 999,
              backgroundColor: '#ffffff',
              color: '#08152b',
              '&:hover': { backgroundColor: 'rgba(255,255,255,0.92)' }
            }}
          >
            I have an account
          </Button>
          <Button
            component={NextLink}
            href="/signup"
            variant="text"
            fullWidth
            sx={{ color: '#ffffff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}
          >
            Create account
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}
