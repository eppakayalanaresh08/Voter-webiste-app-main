'use client';

import NextLink from 'next/link';
import BadgeRoundedIcon from '@mui/icons-material/BadgeRounded';
import CallRoundedIcon from '@mui/icons-material/CallRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import PinDropRoundedIcon from '@mui/icons-material/PinDropRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  MenuItem,
  Skeleton,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { db, enrich, type OfflineVoter } from '@/lib/offline-db';

type SearchResponse = {
  error?: string;
  voters?: OfflineVoter[];
  booths?: Array<{ boothNo: string | null; boothName: string | null }>;
};

type FilterKey = 'age' | 'voterName' | 'houseNo' | 'epicId' | 'boothName' | 'phoneNumber';

type SearchFilters = Record<Exclude<FilterKey, 'age'>, string> & {
  age: string;
};

const EMPTY_FILTERS: SearchFilters = {
  age: '',
  voterName: '',
  houseNo: '',
  epicId: '',
  boothName: '',
  phoneNumber: ''
};

const AGE_RANGES = [
  { label: '18-24', min: 18, max: 24 },
  { label: '25-34', min: 25, max: 34 },
  { label: '35-44', min: 35, max: 44 },
  { label: '45-59', min: 45, max: 59 },
  { label: '60-74', min: 60, max: 74 },
  { label: '75+', min: 75, max: 150 }
];

/** How many results to show per page */
const PAGE_SIZE = 20;

/** Debounce delay in ms */
const DEBOUNCE_MS = 350;

const FILTER_ITEMS: Array<{
  key: FilterKey;
  label: string;
  placeholder: string;
  helper: string;
  icon: React.ReactNode;
}> = [
  {
    key: 'age',
    label: 'Age',
    placeholder: 'Select age range',
    helper: 'Filter voters by age group.',
    icon: <CalendarMonthRoundedIcon fontSize="small" />
  },
  {
    key: 'voterName',
    label: 'Voter Name',
    placeholder: 'Enter voter name',
    helper: 'Matches English voter name and Telugu voter name.',
    icon: <SearchRoundedIcon fontSize="small" />
  },
  {
    key: 'houseNo',
    label: 'House No',
    placeholder: 'Enter house number',
    helper: 'Useful for family-wise lookup and same-house mapping.',
    icon: <HomeRoundedIcon fontSize="small" />
  },
  {
    key: 'epicId',
    label: 'EPIC ID',
    placeholder: 'Enter EPIC ID',
    helper: 'Direct lookup using the electoral ID.',
    icon: <BadgeRoundedIcon fontSize="small" />
  },
  {
    key: 'boothName',
    label: 'Booth Name',
    placeholder: 'Select booth name',
    helper: 'Booth-name-wise filter from the assigned upload.',
    icon: <PinDropRoundedIcon fontSize="small" />
  },
  {
    key: 'phoneNumber',
    label: 'Phone Number',
    placeholder: 'Enter phone number',
    helper: 'Search using the voter mobile field.',
    icon: <CallRoundedIcon fontSize="small" />
  }
];

function normalizeText(value: string | null | undefined) {
  return (value ?? '').trim().toLowerCase();
}

function digitsOnly(value: string | null | undefined) {
  return (value ?? '').replace(/\D+/g, '');
}

function hasActiveFilters(filters: SearchFilters) {
  return Object.values(filters).some((value) => value.trim() !== '');
}

function matchesOfflineFilters(voter: OfflineVoter, filters: SearchFilters) {
  if (filters.age) {
    const range = AGE_RANGES.find(r => r.label === filters.age);
    if (range) {
      const age = voter.age ?? 0;
      if (age < range.min || age > range.max) return false;
    }
  }
  if (
    filters.voterName &&
    !normalizeText(voter.voter_name).includes(normalizeText(filters.voterName)) &&
    !normalizeText(voter.voter_name_tamil).includes(normalizeText(filters.voterName))
  ) return false;
  if (filters.houseNo && !normalizeText(voter.house_no).includes(normalizeText(filters.houseNo))) return false;
  if (filters.epicId && !normalizeText(voter.epic_id).includes(normalizeText(filters.epicId))) return false;
  if (filters.boothName && !normalizeText(voter.booth_name).includes(normalizeText(filters.boothName))) return false;
  if (filters.phoneNumber && !digitsOnly(voter.mobile_no).includes(digitsOnly(filters.phoneNumber))) return false;
  return true;
}

/** Voter card – memoised so it doesn't re-render when only page changes */
function VoterCard({ voter }: { voter: OfflineVoter }) {
  return (
    <Card>
      <CardActionArea component={NextLink} href={`/search/${voter.id}`}>
        <CardContent sx={{ p: 1.75 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1.5} alignItems="flex-start">
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {voter.voter_name ?? 'Unnamed voter'}
              </Typography>
              {voter.voter_name_tamil && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                  {voter.voter_name_tamil}
                </Typography>
              )}
            </Box>
            <Chip label={voter.booth_no ? `Booth ${voter.booth_no}` : 'Booth -'} />
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            House: {voter.house_no ?? '-'} · EPIC: {voter.epic_id ?? '-'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Booth Name: {voter.booth_name ?? '-'} · Phone: {voter.mobile_no ?? '-'}
          </Typography>
        </CardContent>
      </CardActionArea>
    </Card>
  );
}

/** Skeleton placeholders shown while the first network fetch is in-flight */
function ResultsSkeleton() {
  return (
    <Stack spacing={1.25}>
      {[...Array(5)].map((_, i) => (
        <Card key={i}>
          <CardContent sx={{ p: 1.75 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Box sx={{ flex: 1 }}>
                <Skeleton variant="text" width="55%" height={22} />
                <Skeleton variant="text" width="35%" height={16} sx={{ mt: 0.25 }} />
              </Box>
              <Skeleton variant="rounded" width={72} height={28} sx={{ borderRadius: '14px' }} />
            </Stack>
            <Skeleton variant="text" width="80%" height={16} sx={{ mt: 1 }} />
            <Skeleton variant="text" width="70%" height={16} sx={{ mt: 0.5 }} />
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}

export default function SearchPage() {
  const [activeFilter, setActiveFilter] = useState<FilterKey>('voterName');
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [allResults, setAllResults] = useState<OfflineVoter[]>([]);
  const [page, setPage] = useState(1);
  const [booths, setBooths] = useState<Array<{ boothNo: string | null; boothName: string | null }>>([]);
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  /** Track if we've done any network fetch yet (drives skeleton vs results rendering) */
  const hasFetched = useRef(false);

  /** AbortController ref so we can cancel in-flight requests */
  const abortRef = useRef<AbortController | null>(null);

  const currentFilter = FILTER_ITEMS.find((item) => item.key === activeFilter)!;

  // Visible slice for paginated display
  const visibleResults = allResults.slice(0, page * PAGE_SIZE);
  const hasMore = visibleResults.length < allResults.length;

  // ─── Offline-first query ──────────────────────────────────────────────────
  const queryOffline = useCallback(async (f: SearchFilters): Promise<OfflineVoter[]> => {
    const localSource = await db.voters.toArray();
    return hasActiveFilters(f)
      ? localSource.filter((v) => matchesOfflineFilters(v, f))
      : localSource;
  }, []);

  // ─── Main search ──────────────────────────────────────────────────────────
  const runSearch = useCallback(
    async (nextFilters: SearchFilters, signal?: AbortSignal) => {
      setStatus('');
      setIsError(false);
      setIsLoading(true);
      setPage(1);

      // Show offline data instantly while the network request is in-flight
      const offlineResults = await queryOffline(nextFilters);
      if (offlineResults.length > 0) {
        setAllResults(offlineResults);
        setStatus(
          hasActiveFilters(nextFilters)
            ? `${offlineResults.length} offline result(s) — refreshing…`
            : `Showing ${offlineResults.length} cached voter(s) — refreshing…`
        );
      }

      try {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(nextFilters)) {
          if (key === 'age' && value) {
            const range = AGE_RANGES.find(r => r.label === value);
            if (range) {
              params.set('ageMin', range.min.toString());
              params.set('ageMax', range.max.toString());
            }
          } else if (value.trim()) {
            params.set(key, value.trim());
          }
        }

        const res = await fetch(`/api/voters/search?${params.toString()}`, { signal });
        if (signal?.aborted) return;

        const json = (await res.json().catch(() => null)) as SearchResponse | null;
        if (!res.ok) throw new Error(json?.error ?? 'Search failed');

        const voters = (json?.voters ?? []).map(enrich);
        // Cache locally for future offline use
        void db.voters.bulkPut(voters);

        if (!signal?.aborted) {
          setAllResults(voters);
          setStatus(
            hasActiveFilters(nextFilters)
              ? voters.length
                ? `${voters.length} voter(s) found.`
                : 'No voters matched the selected filter.'
              : voters.length
                ? `Showing ${voters.length} assigned voter(s).`
                : 'No voters assigned yet.'
          );
        }
      } catch (error) {
        if (signal?.aborted) return;
        // On network failure keep the offline results already shown
        if (allResults.length === 0) {
          setAllResults([]);
          setIsError(true);
          setStatus(error instanceof Error ? error.message : 'Search failed');
        } else {
          setStatus(
            hasActiveFilters(nextFilters)
              ? `${allResults.length} offline result(s) — network unavailable.`
              : `${allResults.length} cached voter(s) — network unavailable.`
          );
        }
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
          hasFetched.current = true;
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queryOffline]
  );

  // ─── Debounced auto-search on filter change ───────────────────────────────
  useEffect(() => {
    // Cancel any pending request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const timer = setTimeout(() => {
      void runSearch(filters, controller.signal);
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // ─── Load booths list once ────────────────────────────────────────────────
  useEffect(() => {
    const loadBooths = async () => {
      try {
        const res = await fetch('/api/voters/search?mode=booths');
        const json = (await res.json().catch(() => null)) as SearchResponse | null;
        if (res.ok) setBooths(json?.booths ?? []);
      } catch {
        // Leave booth filter as free-text if the request fails.
      }
    };
    void loadBooths();
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSearch = () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    void runSearch(filters, controller.signal);
  };

  const handleClear = () => {
    setFilters(EMPTY_FILTERS);
    // The debounce useEffect will fire automatically.
  };

  return (
    <Stack spacing={2}>
      <Stack spacing={0.5}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Search
        </Typography>
        <Typography color="text.secondary">
          Search voters by Booth No, Voter Name, House No, EPIC ID, Booth Name, or Phone Number.
        </Typography>
      </Stack>

      <Card>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            <Grid container spacing={1.25}>
              {FILTER_ITEMS.map((item) => {
                const isActive = activeFilter === item.key;

                return (
                  <Grid item xs={6} key={item.key}>
                    <Card
                      sx={{
                        borderColor: isActive ? 'primary.main' : 'divider',
                        backgroundColor: isActive ? 'primary.light' : 'background.paper'
                      }}
                    >
                      <CardActionArea onClick={() => setActiveFilter(item.key)}>
                        <CardContent sx={{ p: 1.5 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Box
                              sx={{
                                width: 36,
                                height: 36,
                                display: 'grid',
                                placeItems: 'center',
                                borderRadius: '12px',
                                backgroundColor: isActive ? '#ffffff' : 'primary.light',
                                color: 'primary.main'
                              }}
                            >
                              {item.icon}
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {item.label}
                            </Typography>
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            <Card sx={{ backgroundColor: 'background.default' }}>
              <CardContent sx={{ p: 1.5 }}>
                <Stack spacing={1.25}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Stack spacing={0.25}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {currentFilter.label}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {currentFilter.helper}
                      </Typography>
                    </Stack>
                    {isLoading ? (
                      <CircularProgress size={20} thickness={4} />
                    ) : (
                      <ExpandMoreRoundedIcon color="primary" />
                    )}
                  </Stack>

                  {activeFilter === 'age' ? (
                    <TextField
                      select
                      fullWidth
                      value={filters.age}
                      onChange={(e) => setFilters((prev) => ({ ...prev, age: e.target.value }))}
                    >
                      <MenuItem value="">Select age range</MenuItem>
                      {AGE_RANGES.map((range) => (
                        <MenuItem key={range.label} value={range.label}>
                          {range.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : activeFilter === 'boothName' ? (
                    <TextField
                      select
                      fullWidth
                      value={filters.boothName}
                      onChange={(e) => setFilters((prev) => ({ ...prev, boothName: e.target.value }))}
                    >
                      <MenuItem value="">Select booth name</MenuItem>
                      {booths.map((booth) => (
                        <MenuItem
                          key={`${booth.boothNo ?? ''}-${booth.boothName ?? ''}`}
                          value={booth.boothName ?? ''}
                        >
                          {booth.boothNo ? `Booth ${booth.boothNo} · ` : ''}
                          {booth.boothName ?? 'Unnamed booth'}
                        </MenuItem>
                      ))}
                    </TextField>
                  ) : (
                    <TextField
                      fullWidth
                      placeholder={currentFilter.placeholder}
                      value={filters[activeFilter]}
                      onChange={(e) => setFilters((prev) => ({ ...prev, [activeFilter]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleManualSearch();
                        }
                      }}
                    />
                  )}

                  <Stack direction="row" spacing={1}>
                    <Button variant="contained" fullWidth onClick={handleManualSearch} disabled={isLoading}>
                      {isLoading ? 'Searching…' : hasActiveFilters(filters) ? 'Apply Filter' : 'Show Assigned Voters'}
                    </Button>
                    <Button variant="outlined" fullWidth onClick={handleClear} disabled={isLoading}>
                      Clear
                    </Button>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {isError ? (
              <Alert severity="error">{status}</Alert>
            ) : (
              <TextField
                fullWidth
                label="Search"
                placeholder="Search..."
                value={filters.voterName}
                onChange={(e) => setFilters((prev) => ({ ...prev, voterName: e.target.value }))}
                InputProps={{
                  startAdornment: (
                    <Box sx={{ mr: 1, display: 'flex', alignItems: 'center', opacity: 0.5 }}>
                      <SearchRoundedIcon fontSize="small" />
                    </Box>
                  ),
                }}
              />
            )}

          </Stack>
        </CardContent>
      </Card>

      {/* Results area */}
      {!hasFetched.current && isLoading ? (
        <ResultsSkeleton />
      ) : (
        <>
          <Stack spacing={1.25}>
            {visibleResults.map((voter) => (
              <VoterCard key={voter.id} voter={voter} />
            ))}
          </Stack>

          {/* Load-more pagination */}
          {hasMore && (
            <Button
              variant="outlined"
              onClick={() => setPage((p) => p + 1)}
              sx={{ borderRadius: '14px' }}
            >
              Load more ({allResults.length - visibleResults.length} remaining)
            </Button>
          )}
        </>
      )}
    </Stack>
  );
}
