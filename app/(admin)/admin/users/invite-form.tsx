'use client';

import { useState } from 'react';
import { Alert, Button, Card, CardContent, Grid, MenuItem, Stack, TextField } from '@mui/material';

type AspirantOption = {
  id: string;
  full_name: string | null;
  phone: string | null;
};

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D+/g, '')}`;

  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export default function InviteForm({ aspirants }: { aspirants: AspirantOption[] }) {
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'ASPIRANT' | 'SUB_USER'>('ASPIRANT');
  const [aspirantUserId, setAspirantUserId] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);

  const submit = async () => {
    setStatus('');
    setIsError(false);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      setIsError(true);
      return setStatus('Enter a valid phone number');
    }
    if (!fullName) {
      setIsError(true);
      return setStatus('Enter name');
    }
    if (role === 'SUB_USER' && !aspirantUserId) {
      setIsError(true);
      return setStatus('Select aspirant');
    }

    const res = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phone: normalizedPhone,
        fullName,
        role,
        aspirantUserId: role === 'SUB_USER' ? aspirantUserId : null
      })
    });

    const json = await res.json();
    if (!res.ok) {
      setIsError(true);
      return setStatus(json.error ?? 'Failed to save invite');
    }

    setStatus('Invite saved. User can now login via OTP.');
    window.location.reload();
  };

  return (
    <Card>
      <CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={role === 'SUB_USER' ? 3 : 4}>
            <TextField
              label="Phone"
              placeholder="+91XXXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              helperText="Enter +91XXXXXXXXXX or 10-digit number"
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={role === 'SUB_USER' ? 3 : 4}>
            <TextField
              label="Name"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12} md={role === 'SUB_USER' ? 3 : 4}>
            <TextField
              select
              label="Role"
              value={role}
              onChange={(e) => {
                const nextRole = e.target.value as 'ASPIRANT' | 'SUB_USER';
                setRole(nextRole);
                if (nextRole === 'ASPIRANT') setAspirantUserId('');
              }}
              fullWidth
            >
              <MenuItem value="ASPIRANT">ASPIRANT</MenuItem>
              <MenuItem value="SUB_USER">SUB_USER</MenuItem>
            </TextField>
          </Grid>

          {role === 'SUB_USER' && (
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Aspirant (required)"
                value={aspirantUserId}
                onChange={(e) => setAspirantUserId(e.target.value)}
                fullWidth
              >
                <MenuItem value="" disabled>Select aspirant</MenuItem>
                {aspirants.map((a) => (
                  <MenuItem key={a.id} value={a.id}>
                    {(a.full_name ?? 'Unnamed') + (a.phone ? ` (${a.phone})` : '')}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          )}
        </Grid>

        <Stack direction="row" spacing={1.5} sx={{ mt: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={submit}>Save Invite</Button>
          {status && <Alert severity={isError ? 'error' : 'success'} sx={{ py: 0 }}>{status}</Alert>}
        </Stack>

        {role === 'SUB_USER' && aspirants.length === 0 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Create an aspirant first, then create sub users under that aspirant.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
