import { Alert, Card, CardContent, Grid, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { getProfile } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import InviteForm from './invite-form';

type InviteRow = {
  id: string;
  phone: string | null;
  role: string | null;
  full_name: string | null;
  parent_user_id: string | null;
};

type AspirantRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

type ProfileRow = {
  id: string;
  role: string | null;
  full_name: string | null;
  phone: string | null;
};

export default async function UsersPage() {
  const me = await getProfile();
  if (!me?.tenant_id) {
    return <Alert severity="error">Missing tenant context.</Alert>;
  }

  const supabase = await supabaseServer();

  const { data: invitesRaw } = await supabase
    .from('phone_invites')
    .select('id, phone, role, full_name, parent_user_id, created_at')
    .eq('tenant_id', me.tenant_id)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: aspirantsRaw } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('tenant_id', me.tenant_id)
    .eq('role', 'ASPIRANT')
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, role, full_name, phone, created_at')
    .eq('tenant_id', me.tenant_id)
    .order('created_at', { ascending: false })
    .limit(50);

  const invites = (invitesRaw ?? []) as unknown as InviteRow[];
  const aspirants = (aspirantsRaw ?? []) as unknown as AspirantRow[];
  const profiles = (profilesRaw ?? []) as unknown as ProfileRow[];

  const aspirantNameById = new Map(
    aspirants.map((a) => [a.id, a.full_name ?? 'Unnamed'])
  );

  return (
    <>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>Users</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Add phones to whitelist (invites). Users login via OTP and profile is auto-created from invite.
      </Typography>

      <InviteForm aspirants={aspirants} />

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Invites</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Phone</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Parent Aspirant</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {invites.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.phone ?? '-'}</TableCell>
                      <TableCell>{i.role ?? '-'}</TableCell>
                      <TableCell>{i.full_name ?? '-'}</TableCell>
                      <TableCell>
                        {i.role === 'SUB_USER'
                          ? aspirantNameById.get(i.parent_user_id ?? '') ?? '-'
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1.5 }}>Active Profiles</Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Phone</TableCell>
                    <TableCell>Role</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.full_name ?? '-'}</TableCell>
                      <TableCell>{p.phone ?? '-'}</TableCell>
                      <TableCell>{p.role ?? '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </>
  );
}
