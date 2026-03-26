'use client';

import { useEffect, useState } from 'react';
import NextLink from 'next/link';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  Stack,
  Typography,
  Skeleton
} from '@mui/material';
import { db } from '@/lib/offline-db';
import HomeBannerCarousel from '@/components/content/home-banner-carousel';
import { splitBannersForDisplay, type FieldContentBanner } from '@/lib/field-content-shared';
import { type AppProfile } from '@/lib/auth';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function StatCard({ label, value, caption, isLoading }: { label: string; value: string; caption: string; isLoading?: boolean }) {
  return (
    <Card
      sx={{
        width: '100%',
        borderRadius: { xs: '18px', sm: '20px' },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <CardContent sx={{ p: { xs: 1.5, sm: 2 }, height: '100%' }}>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        {isLoading ? (
          <Skeleton variant="text" sx={{ fontSize: '1.5rem', mt: 0.5, width: '60%' }} />
        ) : (
          <Typography
            variant="h5"
            sx={{
              mt: 0.5,
              fontWeight: 800,
              fontSize: { xs: '1.7rem', sm: '2.4rem' },
              lineHeight: 1.1,
              wordBreak: 'break-word'
            }}
          >
            {value}
          </Typography>
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mt: 0.75,
            minHeight: '2.5em',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}
        >
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

function ActionCard({
  href,
  title,
  caption,
  icon
}: {
  href: string;
  title: string;
  caption: string;
  icon: React.ReactNode;
}) {
  return (
    <Card sx={{ borderRadius: '20px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardActionArea component={NextLink} href={href} sx={{ height: '100%' }}>
        <CardContent sx={{ p: { xs: 1.75, sm: 2 }, height: '100%' }}>
          <Stack spacing={1.25}>
            <Box
              sx={{
                width: 40,
                height: 40,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '14px',
                backgroundColor: 'primary.light',
                color: 'primary.main'
              }}
            >
              {icon}
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {title}
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  mt: 0.25,
                  minHeight: '2.5em',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden'
                }}
              >
                {caption}
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

function CoverageBar({ label, value, total, isLoading }: { label: string; value: number; total: number; isLoading?: boolean }) {
  if (isLoading) {
    return (
      <Stack spacing={0.75}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="rectangular" height={4} sx={{ borderRadius: 1 }} />
      </Stack>
    );
  }
  const percent = total ? (value / total) * 100 : 0;

  return (
    <Stack spacing={0.75}>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        spacing={0.5}
      >
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatNumber(value)} · {formatPercent(percent)}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} />
    </Stack>
  );
}

function SectionAccordion({
  title,
  subtitle,
  defaultExpanded = false,
  children
}: {
  title: string;
  subtitle: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Accordion
      defaultExpanded={defaultExpanded}
      disableGutters
      sx={{
        '&:before': { display: 'none' },
        borderRadius: '22px',
        overflow: 'hidden'
      }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreRoundedIcon color="primary" />}
        sx={{
          px: { xs: 1.5, sm: 2 },
          '& .MuiAccordionSummary-content': {
            my: 1.75
          }
        }}
      >
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1.5, sm: 2 }, pt: 0.25, pb: 2.25 }}>{children}</AccordionDetails>
    </Accordion>
  );
}

export default function HomeManager({ profile }: { profile: AppProfile }) {
  const [data, setData] = useState<{
    banners: FieldContentBanner[];
    overview: {
      totals: {
        voters: number;
        booths: number;
        households: number;
        mobile: number;
        mobilePct: number;
        issues: number;
        interests: number;
        dob: number;
        male: number;
        female: number;
        other: number;
        potentialDuplicates: number;
      };
      upload: { location: string; status: string };
      ageBands: { label: string; count: number }[];
      topBooths: {
        key: string;
        boothNo: string;
        boothName: string;
        voters: number;
        mobile: number;
        issues: number;
        female: number;
      }[];
    };
    scope: unknown;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const cacheKey = `home-${profile.tenant_id ?? 'default'}-${profile.id}`;
      const cached = await db.homeCache.get(cacheKey);
      if (cached) {
        setData({
          banners: cached.banners as FieldContentBanner[],
          overview: cached.overview as never,
          scope: null
        });
        setIsLoading(false);
      }

      try {
        const res = await fetch('/api/home-data');
        if (!res.ok) throw new Error('Failed to fetch home data');
        const fresh = await res.json();

        setData(fresh);

        if (fresh.overview) {
          await db.homeCache.put({
            key: cacheKey,
            banners: fresh.banners,
            overview: fresh.overview,
            updatedAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('[HomeManager] Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [profile.tenant_id]);

  const homeBanner = splitBannersForDisplay(data?.banners ?? []).home;
  const overview = data?.overview;
  const isAspirant = profile.role === 'ASPIRANT';
  const actionCards = [
    { href: '/search', title: 'Search', caption: isAspirant ? 'Find voters' : 'Voters', icon: <SearchRoundedIcon /> },
    ...(isAspirant
      ? [{ href: '/team', title: 'Team', caption: 'Assign booths', icon: <GroupRoundedIcon /> }]
      : []),
    { href: '/logs', title: 'Logs', caption: isAspirant ? 'Track work' : 'Activity', icon: <ListAltRoundedIcon /> },
    { href: '/settings', title: 'Settings', caption: isAspirant ? 'Profile' : 'Account', icon: <SettingsRoundedIcon /> }
  ];

  if (!overview && !isLoading) {
    return (
      <Stack spacing={2.25} alignItems="stretch">
        {homeBanner ? <HomeBannerCarousel banners={[homeBanner]} /> : null}
        <Card
          sx={{
            borderRadius: '24px',
            backgroundColor: 'primary.main',
            borderColor: 'primary.main',
            color: '#ffffff'
          }}
        >
          <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
            <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.72)' }}>
              Field Dashboard
            </Typography>
            <Typography variant="h5" sx={{ mt: 0.75, fontWeight: 800 }}>
              No assigned dataset yet
            </Typography>
            <Typography variant="body2" sx={{ mt: 1.25, color: 'rgba(255,255,255,0.84)' }}>
              {isAspirant
                ? 'Once Super Admin confirms an upload for you, this page becomes your mobile booth dashboard.'
                : 'Once your aspirant assigns booth numbers to your phone, this page becomes your booth dashboard.'}
            </Typography>
          </CardContent>
        </Card>

        <Grid container spacing={1.5}>
          {actionCards.map((card) => (
            <Grid item xs={12} sm={actionCards.length === 4 ? 6 : 4} key={card.href}>
              <ActionCard href={card.href} title={card.title} caption={card.caption} icon={card.icon} />
            </Grid>
          ))}
        </Grid>

        <Alert severity="warning">
          {isAspirant
            ? 'No confirmed voter dataset is assigned to this aspirant yet. Confirm an upload first.'
            : 'No booth assignment is linked to this phone number yet. Ask your aspirant to assign booth numbers.'}
        </Alert>
      </Stack>
    );
  }

  const totalVoters = overview?.totals.voters ?? 0;

  return (
    <Stack spacing={2.25} alignItems="stretch">
      {homeBanner ? <HomeBannerCarousel banners={[homeBanner]} /> : null}
      <Card
        sx={{
          width: '100%',
          borderRadius: '24px',
          backgroundColor: 'primary.main',
          borderColor: 'primary.main',
          color: '#ffffff',
          minHeight: 180
        }}
      >
        <CardContent sx={{ p: { xs: 1.75, sm: 2.25 } }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems="flex-start"
            spacing={1.5}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="overline" sx={{ color: 'rgba(255,255,255,0.72)' }}>
                Mobile Dashboard
              </Typography>
              <Typography
                variant="h5"
                sx={{
                  mt: 0.75,
                  fontWeight: 800,
                  fontSize: { xs: '1.25rem', sm: '2rem' },
                  lineHeight: 1.1,
                  wordBreak: 'break-word'
                }}
              >
                {profile.full_name ?? 'Field User'}
              </Typography>
              {isLoading && !overview ? (
                <Skeleton variant="text" sx={{ mt: 0.75, width: '80%', bgcolor: 'rgba(255,255,255,0.2)' }} />
              ) : (
                <Typography
                  variant="body2"
                  sx={{
                    mt: 0.75,
                    color: 'rgba(255,255,255,0.84)',
                    overflowWrap: 'anywhere'
                  }}
                >
                  {overview?.upload.location ?? 'Assigned booth cluster'} · {formatNumber(totalVoters)} voters
                </Typography>
              )}
            </Box>
            {!isLoading || overview ? (
              <Chip
                label={overview?.upload.status ?? 'IMPORTED'}
                sx={{
                  backgroundColor: '#ffffff',
                  color: 'primary.main',
                  fontWeight: 700,
                  maxWidth: '100%'
                }}
              />
            ) : null}
          </Stack>

          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 2, maxWidth: '100%' }}>
            {isLoading && !overview ? (
              <>
                <Skeleton variant="rectangular" width={80} height={24} sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.2)' }} />
                <Skeleton variant="rectangular" width={100} height={24} sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.2)' }} />
                <Skeleton variant="rectangular" width={120} height={24} sx={{ borderRadius: '12px', bgcolor: 'rgba(255,255,255,0.2)' }} />
              </>
            ) : (
              <>
                <Chip
                  label={`${formatNumber(overview?.totals.booths ?? 0)} booths`}
                  sx={{ backgroundColor: 'rgba(255,255,255,0.16)', color: '#ffffff' }}
                />
                <Chip
                  label={`${formatNumber(overview?.totals.households ?? 0)} households`}
                  sx={{ backgroundColor: 'rgba(255,255,255,0.16)', color: '#ffffff' }}
                />
                <Chip
                  label={`${formatPercent(overview?.totals.mobilePct ?? 0)} mobile reach`}
                  sx={{ backgroundColor: 'rgba(255,255,255,0.16)', color: '#ffffff' }}
                />
              </>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* <Grid container spacing={1.5}>
        {actionCards.map((card) => (
          <Grid item xs={actionCards.length === 4 ? 6 : 4} key={card.href}>
            <ActionCard href={card.href} title={card.title} caption={card.caption} icon={card.icon} />
          </Grid>
        ))}
      </Grid> */}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.5,
          width: '100%'
        }}
      >
        <StatCard
          label="Assigned Voters"
          value={formatNumber(totalVoters)}
          caption="Search, update, and reach from the field."
          isLoading={isLoading && !overview}
        />
        <StatCard
          label="Reachable Mobiles"
          value={formatNumber(overview?.totals.mobile ?? 0)}
          caption="Direct phone or WhatsApp outreach base."
          isLoading={isLoading && !overview}
        />
        <StatCard
          label="Issues Tagged"
          value={formatNumber(overview?.totals.issues ?? 0)}
          caption="Local issue follow-ups already identified."
          isLoading={isLoading && !overview}
        />
        <StatCard
          label="Duplicate Checks"
          value={formatNumber(overview?.totals.potentialDuplicates ?? 0)}
          caption="Records worth checking on the ground."
          isLoading={isLoading && !overview}
        />
      </Box>

      <SectionAccordion
        title="Outreach & Readiness"
        subtitle="Communication coverage and enrichment readiness"
        defaultExpanded
      >
        <Stack spacing={2}>
          <CoverageBar label="Mobile coverage" value={overview?.totals.mobile ?? 0} total={totalVoters} isLoading={isLoading && !overview} />
          <CoverageBar label="Local issue tags" value={overview?.totals.issues ?? 0} total={totalVoters} isLoading={isLoading && !overview} />
          <CoverageBar label="Interested party tags" value={overview?.totals.interests ?? 0} total={totalVoters} isLoading={isLoading && !overview} />
          <CoverageBar label="DOB filled" value={overview?.totals.dob ?? 0} total={totalVoters} isLoading={isLoading && !overview} />

          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6}>
              <StatCard
                label="Booths"
                value={formatNumber(overview?.totals.booths ?? 0)}
                caption="Booth clusters in your assignment."
                isLoading={isLoading && !overview}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StatCard
                label="Households"
                value={formatNumber(overview?.totals.households ?? 0)}
                caption="Family-level engagement pockets."
                isLoading={isLoading && !overview}
              />
            </Grid>
          </Grid>
        </Stack>
      </SectionAccordion>

      <SectionAccordion
        title="Demographics"
        subtitle="Gender split and age-band view"
      >
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={4}>
              <StatCard label="Male" value={formatNumber(overview?.totals.male ?? 0)} caption="Male voters" isLoading={isLoading && !overview} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard label="Female" value={formatNumber(overview?.totals.female ?? 0)} caption="Female voters" isLoading={isLoading && !overview} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard label="Other" value={formatNumber(overview?.totals.other ?? 0)} caption="Other or unclear" isLoading={isLoading && !overview} />
            </Grid>
          </Grid>

          <Stack spacing={1.25}>
            {isLoading && !overview ? (
              [1, 2, 3, 4, 5].map(i => (
                <Stack key={i} spacing={0.5}>
                  <Skeleton variant="text" width="30%" />
                  <Skeleton variant="rectangular" height={4} sx={{ borderRadius: 1 }} />
                </Stack>
              ))
            ) : (
              overview?.ageBands.map((band) => {
                const percent = totalVoters ? (band.count / totalVoters) * 100 : 0;
                return (
                  <Stack key={band.label} spacing={0.5}>
                    <Stack direction="row" justifyContent="space-between" spacing={1.5}>
                      <Typography variant="body2">{band.label}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {formatNumber(band.count)} · {formatPercent(percent)}
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={percent} />
                  </Stack>
                );
              })
            )}
          </Stack>
        </Stack>
      </SectionAccordion>

      <SectionAccordion
        title="Booth Snapshot"
        subtitle="Top booths by voter count, mobile reach, and issue density"
      >
        <Stack spacing={1.25}>
          {isLoading && !overview ? (
            [1, 2, 3].map(i => (
              <Box key={i} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: '18px' }}>
                <Skeleton variant="rectangular" height={60} sx={{ borderRadius: '12px' }} />
              </Box>
            ))
          ) : (
            overview?.topBooths.map((booth) => (
              <Box
                key={booth.key}
                sx={{
                  p: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '18px',
                  backgroundColor: 'background.paper'
                }}
              >
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  justifyContent="space-between"
                  spacing={1}
                  alignItems="flex-start"
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {booth.boothNo ? `Booth ${booth.boothNo}` : 'Booth N/A'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {booth.boothName ?? 'Name not available'}
                    </Typography>
                  </Box>
                  <Chip label={`${formatNumber(booth.voters)} voters`} />
                </Stack>

                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">
                      Mobiles
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatNumber(booth.mobile)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">
                      Issues
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatNumber(booth.issues)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Typography variant="caption" color="text.secondary">
                      Female
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {formatNumber(booth.female)}
                    </Typography>
                  </Grid>
                </Grid>
              </Box>
            ))
          )}
        </Stack>
      </SectionAccordion>

    </Stack>
  );
}
