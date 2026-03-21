export const dynamic = 'force-dynamic';

import NextLink from 'next/link';

import Image from 'next/image';
import { redirect } from 'next/navigation';
import { AppBar, Box, Button, Container, IconButton, Paper, Stack, Toolbar, Typography } from '@mui/material';
import { 
  HomeRounded as HomeIcon, 
  SearchRounded as SearchIcon, 
  GroupsRounded as TeamIcon, 
  HistoryRounded as LogsIcon, 
  SettingsRounded as SettingsIcon,
  AccountCircleRounded as ProfileIcon
} from '@mui/icons-material';
import { getProfile } from '@/lib/auth';
import SyncTrigger from '@/components/sync-trigger';


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (!profile) redirect('/login');
  if (profile.role === 'SUPER_ADMIN') redirect('/admin');

  return (
    <Box sx={{ minHeight: '100vh', pb: 10, backgroundColor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <Toolbar sx={{ minHeight: { xs: 64, sm: 72 } }}>
          <Container maxWidth="sm" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 1.5, sm: 2 } }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Image 
                src="/icons/Clickvote.png" 
                alt="Clickvote Logo" 
                width={36} 
                height={36} 
                style={{ objectFit: 'contain' }}
              />
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {profile.role}
                </Typography>
                <Typography variant="h6" sx={{ lineHeight: 1.2, fontWeight: 800 }}>
                  {profile.full_name ?? 'User'}
                </Typography>
              </Box>
            </Stack>
            
            <IconButton 
              component={NextLink} 
              href="/settings" 
              color="inherit" 
              sx={{ 
                bgcolor: 'grey.100',
                '&:hover': { bgcolor: 'grey.200' }
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Container>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 2.5, px: { xs: 1.5, sm: 2 } }}>
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
          backgroundColor: 'background.paper'
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
