export const dynamic = 'force-dynamic';

import NextLink from 'next/link';

import Image from 'next/image';
import { redirect } from 'next/navigation';
import { Alert, AppBar, Box, Button, Container, IconButton, Paper, Stack, Toolbar, Typography } from '@mui/material';
import { 
  HomeRounded as HomeIcon, 
  SearchRounded as SearchIcon, 
  GroupsRounded as TeamIcon, 
  HistoryRounded as LogsIcon, 
  SettingsRounded as SettingsIcon,
  AccountCircleRounded as ProfileIcon
} from '@mui/icons-material';
import { getProfile, isSupabaseTimeoutError } from '@/lib/auth';
import SyncTrigger from '@/components/sync-trigger';


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  let profile = null;

  try {
    profile = await getProfile();
  } catch (error) {
    if (isSupabaseTimeoutError(error) || (error instanceof Error && error.message.includes('timed out'))) {
      return (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, backgroundColor: 'background.default' }}>
          <Container maxWidth="sm">
            <Paper sx={{ p: 3, borderRadius: 3 }}>
              <Stack spacing={2}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Temporary connection problem
                </Typography>
                <Alert severity="warning">
                  Supabase did not respond in time while loading your workspace. Please check internet or Supabase status, then refresh.
                </Alert>
              </Stack>
            </Paper>
          </Container>
        </Box>
      );
    }

    throw error;
  }

  if (!profile) redirect('/login');
  if (profile.role === 'SUPER_ADMIN') redirect('/admin');

  return (
    <Box sx={{ minHeight: '100vh', overflowX: 'hidden', pb: 10, backgroundColor: 'background.default' }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{
          borderBottom: '1px solid',
          borderColor: 'divider',
          pt: 'env(safe-area-inset-top, 0px)'
        }}
      >
        <Toolbar sx={{ minHeight: { xs: 60, sm: 72 }, px: 0 }}>
          <Container
            maxWidth="sm"
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              px: { xs: 1.25, sm: 2 }
            }}
          >
            <Stack direction="row" spacing={{ xs: 1, sm: 1.5 }} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
              <Image 
                src="/icons/Clickvote.png" 
                alt="Clickvote Logo" 
                width={32} 
                height={32} 
                style={{ objectFit: 'contain' }}
              />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{
                    display: 'block',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    lineHeight: 1.1
                  }}
                >
                  {profile.role}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    lineHeight: 1.1,
                    fontWeight: 800,
                    fontSize: { xs: '1rem', sm: '1.25rem' },
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                >
                  {profile.full_name ?? 'User'}
                </Typography>
              </Box>
            </Stack>
            
            <IconButton 
              component={NextLink} 
              href="/settings" 
              color="inherit" 
              sx={{ 
                flexShrink: 0,
                width: { xs: 42, sm: 48 },
                height: { xs: 42, sm: 48 },
                bgcolor: 'grey.100',
                '&:hover': { bgcolor: 'grey.200' }
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Container>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 2.5, px: { xs: 1.25, sm: 2 } }}>
        {children}
      </Container>

      <Paper
        elevation={0}
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          borderRadius: 0,
          backgroundColor: 'background.paper',
          pb: 'env(safe-area-inset-bottom, 0px)'
        }}
      >
        <Container maxWidth="sm" sx={{ py: 1, px: { xs: 1, sm: 2 } }}>
          <Stack direction="row" spacing={0.5} justifyContent="space-between">
            <Button 
              component={NextLink} 
              href="/home" 
              fullWidth 
              size="small"
              sx={{ 
                flexDirection: 'column',
                gap: 0.5,
                py: 1,
                fontSize: '0.65rem',
                textTransform: 'none',
                minWidth: 0,
                color: 'text.secondary'
              }}
            >
              <HomeIcon sx={{ fontSize: 24 }} />
              Home
            </Button>
            <Button 
              component={NextLink} 
              href="/search" 
              fullWidth 
              size="small"
              sx={{ 
                flexDirection: 'column',
                gap: 0.5,
                py: 1,
                fontSize: '0.65rem',
                textTransform: 'none',
                minWidth: 0,
                color: 'text.secondary'
              }}
            >
              <SearchIcon sx={{ fontSize: 24 }} />
              Search
            </Button>
            {profile.role === 'ASPIRANT' && (
              <Button 
                component={NextLink} 
                href="/team" 
                fullWidth 
                size="small"
                sx={{ 
                  flexDirection: 'column',
                  gap: 0.5,
                  py: 1,
                  fontSize: '0.65rem',
                  textTransform: 'none',
                  minWidth: 0,
                  color: 'text.secondary'
                }}
              >
                <TeamIcon sx={{ fontSize: 24 }} />
                Team
              </Button>
            )}
            <Button 
              component={NextLink} 
              href="/logs" 
              fullWidth 
              size="small"
              sx={{ 
                flexDirection: 'column',
                gap: 0.5,
                py: 1,
                fontSize: '0.65rem',
                textTransform: 'none',
                minWidth: 0,
                color: 'text.secondary'
              }}
            >
              <LogsIcon sx={{ fontSize: 24 }} />
              Logs
            </Button>
            <Button 
              component={NextLink} 
              href="/settings" 
              fullWidth 
              size="small"
              sx={{ 
                flexDirection: 'column',
                gap: 0.5,
                py: 1,
                fontSize: '0.65rem',
                textTransform: 'none',
                minWidth: 0,
                color: 'text.secondary'
              }}
            >
              <SettingsIcon sx={{ fontSize: 24 }} />
              Settings
            </Button>
          </Stack>
        </Container>
      </Paper>
      <SyncTrigger />
    </Box>
  );
}
