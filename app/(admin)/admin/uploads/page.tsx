import { Alert, Card, CardContent, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { getProfile } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import UploadXlsxForm from './upload-form';

type AspirantInviteRow = { id: string; full_name: string | null; phone: string | null; role: string | null };
type UploadRow = {
  id: string;
  aspirant_name: string | null;
  location: string | null;
  original_filename: string | null;
  row_count: number | null;
  created_at: string;
};

export default async function UploadsPage() {
  const me = await getProfile();
  if (!me?.tenant_id) {
    return <Alert severity="error">Missing tenant context.</Alert>;
  }

  const supabase = await supabaseServer();

  const { data: aspirantsRaw } = await supabase
    .from('phone_invites')
    .select('id, full_name, phone, role')
    .eq('tenant_id', me.tenant_id)
    .eq('role', 'ASPIRANT')
    .order('created_at', { ascending: false });

  const { data: uploadsRaw } = await supabase
    .from('uploads')
    .select('id, aspirant_name, location, original_filename, row_count, created_at')
    .eq('tenant_id', me.tenant_id)
    .order('created_at', { ascending: false })
    .limit(20);

  const aspirants = (aspirantsRaw ?? []) as unknown as AspirantInviteRow[];
  const uploads = (uploadsRaw ?? []) as unknown as UploadRow[];

  return (
    <>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>Upload Excel</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Uploads are linked to one aspirant dataset.
      </Typography>

      <UploadXlsxForm aspirants={aspirants} />

      <Card sx={{ mt: 2 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1.5 }}>Recent uploads</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Aspirant</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>File</TableCell>
                <TableCell>Rows</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {uploads.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.aspirant_name ?? '-'}</TableCell>
                  <TableCell>{u.location ?? '-'}</TableCell>
                  <TableCell>{u.original_filename ?? '-'}</TableCell>
                  <TableCell>{u.row_count ?? '-'}</TableCell>
                  <TableCell>{new Date(u.created_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
