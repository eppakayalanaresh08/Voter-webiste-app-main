export const dynamic = 'force-dynamic';

import NextLink from 'next/link';

import { redirect } from 'next/navigation';
import { AppBar, Box, Button, Container, Stack, Toolbar, Typography } from '@mui/material';
import { getProfile } from '@/lib/auth';
import SignOutButton from '@/components/auth/sign-out-button';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await getProfile();

  if (!profile) redirect('/login');
  if (profile.role !== 'SUPER_ADMIN') redirect('/home');

  return (
    <Box sx={{ minHeight: '100vh', backgroundColor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" elevation={0}>
        <Toolbar>
          <Container
            maxWidth="md"
            sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, px: { xs: 1.5, sm: 2 } }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary">
                Super Admin
              </Typography>
              <Typography variant="h6" sx={{ lineHeight: 1.15, fontWeight: 700 }}>
                Voter Admin
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ overflowX: 'auto', whiteSpace: 'nowrap', pb: 0.25 }}>
              <Button component={NextLink} href="/admin" color="inherit" size="small">Dashboard</Button>
              <Button component={NextLink} href="/admin/uploads" color="inherit" size="small">Uploads</Button>
              <Button component={NextLink} href="/admin/users" color="inherit" size="small">Users</Button>
              <Button component={NextLink} href="/admin/assignments" color="inherit" size="small">Assignments</Button>
              <SignOutButton />
            </Stack>
          </Container>
        </Toolbar>
      </AppBar>
      <Container maxWidth="md" sx={{ py: 2.5, px: { xs: 1.5, sm: 2 } }}>
        {children}
      </Container>
    </Box>
  );
}
