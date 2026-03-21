import NextLink from 'next/link';
import {
  Alert,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import { getProfile } from '@/lib/auth';
import { getAdminOpsCounts, getCampaignOverview } from '@/lib/campaign-overview';

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-IN').format(value);
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function MetricCard({ label, value, caption }: { label: string; value: string; caption: string }) {
  return (
    <Card>
      <CardContent>
        <Typography variant="overline" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="h5" sx={{ mt: 0.5, fontWeight: 700 }}>
          {value}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {caption}
        </Typography>
      </CardContent>
    </Card>
  );
}

function CoverageRow({ label, value, total }: { label: string; value: number; total: number }) {
  const percent = total ? (value / total) * 100 : 0;

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" justifyContent="space-between" spacing={2}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" color="text.secondary">
          {formatNumber(value)} / {formatNumber(total)}
        </Typography>
      </Stack>
      <LinearProgress variant="determinate" value={percent} />
    </Stack>
  );
}

export default async function AdminDashboard() {
  const me = await getProfile();
  if (!me?.tenant_id) {
    return <Alert severity="error">Missing tenant context.</Alert>;
  }

  const [ops, overview] = await Promise.all([
    getAdminOpsCounts(me.tenant_id),
    getCampaignOverview({ tenantId: me.tenant_id })
  ]);

  const totalVoters = overview?.totals.voters ?? 0;

  return (
    <Stack spacing={2.5}>
      <Stack spacing={0.75}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Campaign Operations Dashboard
        </Typography>
        <Typography color="text.secondary">
          The presentations position ClickVote as a war-room system with booth intelligence, communication, and field
          operations. This dashboard now surfaces the active voter-base counts behind that story.
        </Typography>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Aspirants"
            value={formatNumber(ops.aspirants)}
            caption="Active field leaders mapped in profiles."
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Sub Users"
            value={formatNumber(ops.subUsers)}
            caption="Additional booth or support users under aspirants."
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Invites"
            value={formatNumber(ops.invites)}
            caption="Phone-based onboarding records configured for OTP login."
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricCard
            label="Uploads"
            value={formatNumber(ops.uploads)}
            caption={`${formatNumber(ops.confirmedUploads)} confirmed dataset(s) ready for operations.`}
          />
        </Grid>
      </Grid>

      {!overview ? (
        <Alert severity="warning">
          No voter upload is available yet. Import an Excel file and confirm an assignment to unlock campaign counts.
        </Alert>
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                label="Total Voters"
                value={formatNumber(overview.totals.voters)}
                caption="Base electoral roll available in the active dataset."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                label="Reachable Mobiles"
                value={formatNumber(overview.totals.mobile)}
                caption={`${formatPercent(overview.totals.mobilePct)} of voters can be targeted directly.`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                label="Households"
                value={formatNumber(overview.totals.households)}
                caption="Unique house numbers available for family-level campaigning."
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <MetricCard
                label="Potential Duplicates"
                value={formatNumber(overview.totals.potentialDuplicates)}
                caption="Flagged using EPIC repetition and name + relation + house matches."
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Voter Composition
                  </Typography>
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid item xs={4}>
                      <MetricCard
                        label="Male"
                        value={formatNumber(overview.totals.male)}
                        caption="Male voter records in active file."
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <MetricCard
                        label="Female"
                        value={formatNumber(overview.totals.female)}
                        caption="Female voter records in active file."
                      />
                    </Grid>
                    <Grid item xs={4}>
                      <MetricCard
                        label="Other"
                        value={formatNumber(overview.totals.other)}
                        caption="Other or unclear gender records."
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Data Enrichment Readiness
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                    The PPT positions caste, religion, issues, and political preference as field intelligence modules.
                    This section shows how much is already present in the uploaded base.
                  </Typography>
                  <Stack spacing={1.5}>
                    <CoverageRow label="DOB filled" value={overview.totals.dob} total={totalVoters} />
                    <CoverageRow label="Age filled" value={overview.totals.age} total={totalVoters} />
                    <CoverageRow label="Caste filled" value={overview.totals.caste} total={totalVoters} />
                    <CoverageRow label="Religion filled" value={overview.totals.religion} total={totalVoters} />
                    <CoverageRow label="Aadhaar filled" value={overview.totals.aadhaar} total={totalVoters} />
                    <CoverageRow label="Local issue tagged" value={overview.totals.issues} total={totalVoters} />
                    <CoverageRow label="Interested party tagged" value={overview.totals.interests} total={totalVoters} />
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Age Distribution
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Useful for deciding where the campaign can lean on digital outreach versus traditional field operations.
              </Typography>
              <Grid container spacing={2}>
                {overview.ageBands.map((band) => (
                  <Grid item xs={6} sm={4} md={2} key={band.label}>
                    <MetricCard
                      label={band.label}
                      value={formatNumber(band.count)}
                      caption={`${formatPercent(totalVoters ? (band.count / totalVoters) * 100 : 0)} of active voters`}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Booth Intelligence
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
                Highest-volume booths in the active dataset with voter count, mobile reach, and issue capture.
              </Typography>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Booth</TableCell>
                    <TableCell align="right">Voters</TableCell>
                    <TableCell align="right">Male</TableCell>
                    <TableCell align="right">Female</TableCell>
                    <TableCell align="right">Mobiles</TableCell>
                    <TableCell align="right">Issues</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {overview.topBooths.map((booth) => (
                    <TableRow key={booth.key}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {booth.boothNo ? `Booth ${booth.boothNo}` : 'Booth N/A'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {booth.boothName ?? 'Name not available'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">{formatNumber(booth.voters)}</TableCell>
                      <TableCell align="right">{formatNumber(booth.male)}</TableCell>
                      <TableCell align="right">{formatNumber(booth.female)}</TableCell>
                      <TableCell align="right">{formatNumber(booth.mobile)}</TableCell>
                      <TableCell align="right">{formatNumber(booth.issues)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardActionArea component={NextLink} href="/admin/users">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Users
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  Hierarchy and access
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardActionArea component={NextLink} href="/admin/uploads">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Uploads
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  Import and dataset control
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardActionArea component={NextLink} href="/admin/assignments">
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Assignments
                </Typography>
                <Typography variant="h6" sx={{ mt: 0.5 }}>
                  Confirm aspirant mapping
                </Typography>
              </CardContent>
            </CardActionArea>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
