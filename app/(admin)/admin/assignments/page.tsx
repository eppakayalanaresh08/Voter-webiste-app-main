import { Alert, Typography } from '@mui/material';
import { getProfile } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';
import AssignmentEditor from './assignment-editor';

type Aspirant = { id: string; full_name: string | null; phone: string | null };

type UploadRow = {
  id: string;
  aspirant_user_id: string | null;
  aspirant_name: string | null;
  location: string | null;
  original_filename: string | null;
  row_count: number | null;
  status: string | null;
  created_at: string;
};

export default async function AssignmentsPage() {
  const me = await getProfile();
  if (!me?.tenant_id) {
    return <Alert severity="error">Missing tenant context.</Alert>;
  }

  const supabase = await supabaseServer();

  const { data: aspirantsRaw } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .eq('tenant_id', me.tenant_id)
    .eq('role', 'ASPIRANT')
    .order('created_at', { ascending: false });

  const { data: uploadsRaw } = await supabase
    .from('uploads')
    .select('id, aspirant_user_id, aspirant_name, location, original_filename, row_count, status, created_at')
    .eq('tenant_id', me.tenant_id)
    .order('created_at', { ascending: false })
    .limit(50);

  const aspirants = (aspirantsRaw ?? []) as unknown as Aspirant[];
  const uploads = (uploadsRaw ?? []) as unknown as UploadRow[];

  return (
    <>
      <Typography variant="h4" sx={{ fontWeight: 700 }}>Assignments</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Re-link an upload (dataset) to an aspirant user, then Save and Confirm.
      </Typography>

      <AssignmentEditor aspirants={aspirants} uploads={uploads} />
    </>
  );
}
