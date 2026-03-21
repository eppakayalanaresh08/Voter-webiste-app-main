'use client';

import { useState } from 'react';
import { Alert, Button, Card, CardContent, Chip, MenuItem, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField } from '@mui/material';

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

export default function AssignmentEditor({ aspirants, uploads }: { aspirants: Aspirant[]; uploads: UploadRow[] }) {
  const [selectedByUploadId, setSelectedByUploadId] = useState<Record<string, string>>(
    Object.fromEntries(uploads.map((u) => [u.id, u.aspirant_user_id ?? '']))
  );
  const [savingUploadId, setSavingUploadId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  const update = async (uploadId: string, action: 'SAVE' | 'CONFIRM') => {
    setStatus('');
    setIsError(false);
    setSavingUploadId(uploadId);

    const aspirantUserId = selectedByUploadId[uploadId];
    if (!aspirantUserId) {
      setIsError(true);
      setSavingUploadId(null);
      return setStatus('Select aspirant before saving');
    }

    const res = await fetch('/api/admin/assignments', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ uploadId, aspirantUserId, action })
    });

    const json = await res.json();
    if (!res.ok) {
      setIsError(true);
      setSavingUploadId(null);
      return setStatus(json.error ?? 'Failed to update assignment');
    }

    setStatus(action === 'CONFIRM' ? 'Assignment confirmed.' : 'Assignment saved.');
    window.location.reload();
  };

  const getStatusColor = (value: string | null): 'default' | 'success' | 'warning' => {
    if (value === 'CONFIRMED') return 'success';
    if (value === 'ASSIGNED') return 'warning';
    return 'default';
  };

  return (
    <Card>
      <CardContent>
        {status && <Alert severity={isError ? 'error' : 'success'} sx={{ mb: 2 }}>{status}</Alert>}

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>File</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Rows</TableCell>
              <TableCell>Assigned aspirant</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {uploads.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.original_filename ?? '-'}</TableCell>
                <TableCell>{u.location ?? '-'}</TableCell>
                <TableCell>{u.row_count ?? '-'}</TableCell>
                <TableCell>
                  <TextField
                    select
                    size="small"
                    value={selectedByUploadId[u.id] ?? ''}
                    onChange={(e) =>
                      setSelectedByUploadId((prev) => ({
                        ...prev,
                        [u.id]: e.target.value
                      }))
                    }
                    sx={{ minWidth: 240 }}
                  >
                    <MenuItem value="" disabled>Select aspirant</MenuItem>
                    {aspirants.map((a) => (
                      <MenuItem key={a.id} value={a.id}>
                        {(a.full_name ?? 'Unnamed') + (a.phone ? ` (${a.phone})` : '')}
                      </MenuItem>
                    ))}
                  </TextField>
                </TableCell>
                <TableCell>
                  <Chip size="small" label={u.status ?? 'IMPORTED'} color={getStatusColor(u.status)} />
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={1} justifyContent="flex-end">
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={savingUploadId === u.id}
                      onClick={() => update(u.id, 'SAVE')}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      disabled={savingUploadId === u.id}
                      onClick={() => update(u.id, 'CONFIRM')}
                    >
                      Confirm
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
