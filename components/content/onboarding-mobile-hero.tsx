'use client';

import NextLink from 'next/link';
import { useEffect, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import type { FieldContentBanner } from '@/lib/field-content-shared';

type OnboardingMobileHeroProps = {
  banners: FieldContentBanner[];
};

export default function OnboardingMobileHero({ banners }: OnboardingMobileHeroProps) {
  const enabledBanners = banners.filter((banner) => banner.enabled);
  const slides = enabledBanners.length ? enabledBanners : banners;
  const [activeIndex, setActiveIndex] = useState(0);
  const slide = slides[activeIndex] ?? slides[0];

  useEffect(() => {
    setActiveIndex(0);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length <= 1) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [slides.length]);

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
        src="/icons/vote-app.jpeg"
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
          
            Click Vote 
        </Typography>

        <Typography variant="h3" sx={{ mt: 0.75, fontSize: '2.2rem', fontWeight: 700, lineHeight: 1.1, color: '#ffffff' }}>
         Manage voter data in one place
        </Typography>

        <Typography sx={{ mt: 0.75, fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.84)' }}>
        Organize booths, and manage field teams.
        </Typography>

        {slides.length > 1 && (
          <Stack direction="row" spacing={0.8} sx={{ mt: 2 }}>
            {slides.map((item, index) => (
              <Box
                key={item.id ?? `${item.sortOrder}-${index}`}
                sx={{
                  width: index === activeIndex ? 28 : 8,
                  height: 8,
                  borderRadius: 999,
                  backgroundColor: index === activeIndex ? '#ffffff' : 'rgba(255,255,255,0.36)',
                  transition: 'all 180ms ease'
                }}
              />
            ))}
          </Stack>
        )}

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
            Sign In
          </Button>
          {/* <Button
            component={NextLink}
            href="/signup"
            variant="text"
            fullWidth
            sx={{ color: '#ffffff', '&:hover': { backgroundColor: 'rgba(255,255,255,0.08)' } }}
          >
            Create account
          </Button> */}
        </Stack>
      </Box>
    </Box>
  );
}
