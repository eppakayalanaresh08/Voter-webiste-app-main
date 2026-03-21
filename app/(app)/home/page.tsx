import { Alert, Stack } from '@mui/material';
import { getProfile } from '@/lib/auth';
import HomeManager from './home-manager';

export default async function HomePage() {
  const profile = await getProfile();
  if (!profile?.tenant_id) {
    return <Alert severity="error">Missing tenant context.</Alert>;
  }

  return (
    <Stack spacing={2.25}>
      <HomeManager profile={profile} />
    </Stack>
  );
}
