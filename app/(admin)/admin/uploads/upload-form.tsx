'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Card, CardContent, Grid, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';

type AspirantInvite = { id: string; full_name: string | null; phone: string | null; role: string | null };

export default function UploadXlsxForm({ aspirants }: { aspirants: AspirantInvite[] }) {
  const [aspirantInviteId, setAspirantInviteId] = useState(aspirants[0]?.id ?? '');
  const [location, setLocation] = useState('');
  const [uploaderName, setUploaderName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  const selected = useMemo(() => aspirants.find((a) => a.id === aspirantInviteId), [aspirants, aspirantInviteId]);

  const uploadWithProgress = (fd: FormData) =>
    new Promise<{ ok: boolean; status: number; json: unknown }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload-xlsx');
      xhr.responseType = 'json';

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(Math.max(0, Math.min(100, percent)));
      };

      xhr.onload = () => {
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          json: xhr.response ?? {}
        });
      };

      xhr.onerror = () => reject(new Error('Network error while uploading'));
      xhr.send(fd);
    });

  const submit = async () => {
    setStatus('');
    setIsError(false);

    if (!file) {
      setIsError(true);
      return setStatus('Select an .xlsx file');
    }
    if (!aspirantInviteId) {
      setIsError(true);
      return setStatus('Select an aspirant');
    }
    if (!location || !uploaderName) {
      setIsError(true);
      return setStatus('Fill all required fields');
    }

    const fd = new FormData();
    fd.append('aspirantInviteId', aspirantInviteId);
    fd.append('location', location);
    fd.append('uploaderName', uploaderName);
    fd.append('file', file);

    setIsUploading(true);
    setUploadProgress(0);
    setStatus('Uploading file...');
    try {
      const res = await uploadWithProgress(fd);
      const json =
        typeof res.json === 'object' && res.json !== null ? (res.json as Record<string, unknown>) : {};

      if (!res.ok) {
        setIsError(true);
        return setStatus((json.error as string | undefined) ?? 'Failed');
      }

      setUploadProgress(100);
      setStatus(`Imported. UploadId: ${json.uploadId as string}. Rows: ${json.rows as number}.`);
      window.location.reload();
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField
              select
              label="Aspirant"
              value={aspirantInviteId}
              onChange={(e) => setAspirantInviteId(e.target.value)}
              fullWidth
            >
              {aspirants.map((a) => (
                <MenuItem key={a.id} value={a.id}>
                  {(a.full_name ?? 'Unnamed') + (a.phone ? ` (${a.phone})` : '')}
                </MenuItem>
              ))}
            </TextField>
            {selected && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                Selected: {selected.full_name ?? 'Unnamed'}{selected.phone ? ` (${selected.phone})` : ''}
              </Typography>
            )}
          </Grid>

          <Grid item xs={12} md={6}>
            <Alert severity="info" sx={{ height: '100%', display: 'flex', alignItems: 'center' }}>
              Aspirant name is auto-filled from invite selection.
            </Alert>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Location"
              placeholder="e.g., Siddipet / Ward-12"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              label="Uploader name"
              placeholder="e.g., Admin Team"
              value={uploaderName}
              onChange={(e) => setUploaderName(e.target.value)}
              fullWidth
            />
          </Grid>

          <Grid item xs={12}>
            <Button variant="outlined" component="label">
              Choose Excel (.xlsx)
              <input
                type="file"
                accept=".xlsx"
                hidden
                disabled={isUploading}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </Button>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {file ? file.name : 'No file selected'}
            </Typography>
          </Grid>
        </Grid>

        <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={submit} disabled={isUploading}>
            {isUploading ? 'Uploading...' : 'Upload & Import'}
          </Button>
          {status && <Alert severity={isError ? 'error' : 'success'} sx={{ py: 0 }}>{status}</Alert>}
        </Stack>
        {isUploading && (
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            <LinearProgress variant="determinate" value={uploadProgress} />
            <Typography variant="caption" color="text.secondary">
              Upload progress: {uploadProgress}%
            </Typography>
          </Stack>
        )}

        {aspirants.length === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            No aspirants found. Add aspirants in Users first.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
