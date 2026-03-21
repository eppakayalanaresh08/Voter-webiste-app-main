'use client';

import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import TagRoundedIcon from '@mui/icons-material/TagRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/lib/offline-db';
import type { BoothOption, TeamAssignmentSummary } from '@/lib/team-assignments';
import type { FieldScopedUpload } from '@/lib/field-access';

type TeamManagerProps = {
  upload: FieldScopedUpload | null;
  initialBoothOptions?: BoothOption[];
  initialAssignments?: TeamAssignmentSummary[];
};

function formatBoothList(value: string[]) {
  return value.join(', ');
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return 'No activity yet';
  return new Date(value).toLocaleString('en-IN');
}

export default function TeamManager({ upload, initialBoothOptions = [], initialAssignments = [] }: TeamManagerProps) {
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [boothInput, setBoothInput] = useState('');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [boothOptions, setBoothOptions] = useState<BoothOption[]>(initialBoothOptions);
  const [assignments, setAssignments] = useState<TeamAssignmentSummary[]>(initialAssignments);
  const [isLoading, setIsLoading] = useState(!initialBoothOptions.length && !initialAssignments.length);

  useEffect(() => {
    if (!upload) return;

    const cacheKey = `${upload.tenant_id}-${upload.id}`;

    const load = async () => {
      // 1. Load from cache
      const cached = await db.teamCache.get(cacheKey);
      if (cached) {
        setBoothOptions(cached.boothOptions as BoothOption[]);
        setAssignments(cached.assignments as TeamAssignmentSummary[]);
        setIsLoading(false);
      }

      // 2. Fetch fresh data
      try {
        const res = await fetch('/api/team-data');
        if (!res.ok) throw new Error('Failed to fetch fresh team data');
        const fresh = await res.json();

        setBoothOptions(fresh.boothOptions);
        setAssignments(fresh.assignments);

        // 3. Update cache
        await db.teamCache.put({
          key: cacheKey,
          boothOptions: fresh.boothOptions,
          assignments: fresh.assignments,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('[TeamManager] Fetch error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [upload]);

  const boothHint = useMemo(
    () =>
      boothOptions
        .map((booth) => booth.boothNo)
        .slice(0, 20)
        .join(', '),
    [boothOptions]
  );
  const totalPeopleReached = assignments.reduce((sum, assignment) => sum + assignment.performance.peopleReached, 0);
  const activeMembers = assignments.filter((assignment) => assignment.isActive).length;

  const startEdit = (assignment: TeamAssignmentSummary) => {
    setPhone(assignment.phone);
    setFullName(assignment.fullName ?? '');
    setBoothInput(formatBoothList(assignment.boothNos));
    setStatus('');
    setIsError(false);
  };

  const resetForm = () => {
    setPhone('');
    setFullName('');
    setBoothInput('');
    setStatus('');
    setIsError(false);
  };

  const submit = async () => {
    setStatus('');
    setIsError(false);
    setIsSaving(true);

    try {
      const res = await fetch('/api/team-assignments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          phone,
          fullName,
          boothInput
        })
      });

      const json = (await res.json().catch(() => null)) as { error?: string; ok?: boolean } | null;
      if (!res.ok) {
        throw new Error(json?.error ?? 'Failed to save booth assignment');
      }

      setStatus('Sub user saved. OTP login on this phone will open only the assigned booths.');
      resetForm();
      window.location.reload();
    } catch (error) {
      setIsError(true);
      setStatus(error instanceof Error ? error.message : 'Failed to save booth assignment');
    } finally {
      setIsSaving(false);
    }
  };

  if (!upload) {
    return (
      <Alert severity="warning">
        No upload is assigned to this aspirant yet. Ask Super Admin to assign and confirm an upload first.
      </Alert>
    );
  }

  return (
    <Stack spacing={2}>
      <Card sx={{ borderRadius: '24px' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1}>
            <Typography variant="overline" color="text.secondary">
              Current Upload
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              {upload.location ?? 'Assigned cluster'}
            </Typography>
            <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
              <Chip size="small" label={`Status: ${upload.status ?? 'IMPORTED'}`} />
              <Chip size="small" label={`${boothOptions.length} booth${boothOptions.length === 1 ? '' : 's'} available`} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Chip label={isLoading ? 'Loading...' : `${formatNumber(assignments.length)} team member${assignments.length === 1 ? '' : 's'}`} />
        <Chip label={isLoading ? 'Loading...' : `${formatNumber(activeMembers)} OTP active`} />
        <Chip label={isLoading ? 'Loading...' : `${formatNumber(totalPeopleReached)} people reached`} />
      </Stack>

      <Card sx={{ borderRadius: '24px' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Assign Sub User
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add a phone number, name, and booth numbers. On OTP login, that phone is linked automatically.
              </Typography>
            </Stack>

            <TextField
              label="Phone Number"
              placeholder="+919866959371"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              fullWidth
            />

            <TextField
              label="Name"
              placeholder="Field volunteer name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              fullWidth
            />

            <TextField
              label="Booth Numbers"
              placeholder="198001, 198002"
              value={boothInput}
              onChange={(event) => setBoothInput(event.target.value)}
              helperText={
                isLoading 
                  ? 'Loading available booths...'
                  : boothHint
                    ? `Enter booth numbers separated by comma or new line. Available booths: ${boothHint}${boothOptions.length > 20 ? ' ...' : ''}`
                    : 'Enter booth numbers separated by comma or new line.'
              }
              multiline
              minRows={3}
              fullWidth
            />

            {status && <Alert severity={isError ? 'error' : 'success'}>{status}</Alert>}

            <Stack direction="row" spacing={1}>
              <Button variant="contained" onClick={() => void submit()} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Booth Assignment'}
              </Button>
              <Button variant="outlined" onClick={resetForm} disabled={isSaving}>
                Clear
              </Button>
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ borderRadius: '24px' }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Current Team
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Edit any sub user to replace their booth list for the current upload.
              </Typography>
            </Stack>

            {isLoading && assignments.length === 0 && (
              <Box sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="text.secondary">Loading team list...</Typography>
              </Box>
            )}

            {!isLoading && assignments.length === 0 && (
              <Alert severity="info">No sub-user booth assignments yet.</Alert>
            )}

            {assignments.map((assignment) => (
              <Card key={assignment.phone} variant="outlined" sx={{ borderRadius: '20px' }}>
                <CardContent sx={{ p: 1.75 }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
                      <Box>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {assignment.fullName ?? 'Unnamed sub user'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                          {assignment.phone}
                        </Typography>
                      </Box>
                      <Chip
                        size="small"
                        label={assignment.isActive ? 'OTP Active' : 'Invite Pending'}
                        color={assignment.isActive ? 'success' : 'default'}
                      />
                    </Stack>

                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      <Chip size="small" icon={<PhoneRoundedIcon />} label={assignment.phone} />
                      <Chip
                        size="small"
                        icon={<GroupRoundedIcon />}
                        label={`${assignment.boothNos.length} booth${assignment.boothNos.length === 1 ? '' : 's'}`}
                      />
                    </Stack>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Performance
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                        <Chip size="small" label={`People ${formatNumber(assignment.performance.peopleReached)}`} />
                        <Chip size="small" label={`Print ${formatNumber(assignment.performance.prints)}`} />
                        <Chip size="small" label={`SMS ${formatNumber(assignment.performance.messages)}`} />
                        <Chip size="small" label={`WhatsApp ${formatNumber(assignment.performance.whatsapp)}`} />
                        <Chip size="small" label={`Share ${formatNumber(assignment.performance.shares)}`} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                        Last activity: {formatDateTime(assignment.performance.lastActivity)}
                      </Typography>
                    </Box>

                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Booth Numbers
                      </Typography>
                      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mt: 0.75 }}>
                        {assignment.boothNos.map((boothNo) => (
                          <Chip key={`${assignment.phone}-${boothNo}`} size="small" icon={<TagRoundedIcon />} label={boothNo} />
                        ))}
                      </Stack>
                    </Box>

                    {assignment.boothNames.length > 0 && (
                      <>
                        <Divider />
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Booth Names
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                            {assignment.boothNames.join(', ')}
                          </Typography>
                        </Box>
                      </>
                    )}

                    <Button
                      variant="outlined"
                      startIcon={<EditRoundedIcon />}
                      onClick={() => startEdit(assignment)}
                    >
                      Edit Assignment
                    </Button>
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
