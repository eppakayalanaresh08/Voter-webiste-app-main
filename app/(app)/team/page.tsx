import { redirect } from 'next/navigation';
import { Alert, Stack, Typography } from '@mui/material';
import { getProfile } from '@/lib/auth';
import { findLatestAspirantUpload } from '@/lib/field-access';
import TeamManager from './team-manager';

export default async function TeamPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  if (profile.role === 'SUPER_ADMIN') redirect('/admin');

  if (profile.role !== 'ASPIRANT' || !profile.tenant_id) {
    return <Alert severity="warning">Only aspirants can manage booth assignments.</Alert>;
  }

  const upload = await findLatestAspirantUpload(profile.tenant_id, profile.id);

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Team
        </Typography>
        <Typography color="text.secondary">
          Add sub users under your account and assign booth numbers to their phone login.
        </Typography>
      </Stack>

      <TeamManager upload={upload} />
    </Stack>
  );
}
