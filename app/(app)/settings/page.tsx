import { redirect } from 'next/navigation';
import { Card, CardContent, Divider, Stack, Typography } from '@mui/material';
import { getProfile } from '@/lib/auth';
import SignOutButton from '@/components/auth/sign-out-button';
import FieldContentSettings from './field-content-settings';
import NativePrinterSettings from './native-printer-settings';
import { getTenantFieldContent } from '@/lib/field-content';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Stack spacing={0.4}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Stack>
  );
}

export default async function SettingsPage() {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  const content = profile.tenant_id ? await getTenantFieldContent(profile.tenant_id) : { banners: [], templates: [] };

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.5}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Settings
        </Typography>
        <Typography color="text.secondary">Manage session and account access.</Typography>
      </Stack>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <DetailRow label="Name" value={profile.full_name ?? 'Not available'} />
            <Divider />
            <DetailRow label="Phone Number" value={profile.phone ?? 'Not available'} />
            <Divider />
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Use this option when switching accounts on shared devices.
          </Typography>
          <Stack sx={{ mt: 2.5 }}>
            <SignOutButton />
          </Stack>
        </CardContent>
      </Card>

      <NativePrinterSettings />

      {profile.tenant_id && (
        <FieldContentSettings
          canEdit={profile.role === 'ASPIRANT'}
          initialBanners={content.banners}
          initialTemplates={content.templates}
        />
      )}
    </Stack>
  );
}
