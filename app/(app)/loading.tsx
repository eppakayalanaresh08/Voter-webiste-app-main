import { Box, Card, CardContent, Container, Skeleton, Stack } from '@mui/material';

export default function Loading() {
  return (
    <Container maxWidth="sm" sx={{ py: 2.5, px: { xs: 1.5, sm: 2 } }}>
      <Stack spacing={2.25}>
        {/* Banner carousel skeleton */}
        <Skeleton variant="rounded" width="100%" height={140} sx={{ borderRadius: '20px' }} />

        {/* Hero card skeleton */}
        <Card sx={{ borderRadius: '24px', backgroundColor: 'primary.main', border: 'none' }}>
          <CardContent sx={{ p: { xs: 2, sm: 2.25 } }}>
            <Skeleton
              variant="text"
              width={90}
              height={18}
              sx={{ bgcolor: 'rgba(255,255,255,0.25)', borderRadius: 1 }}
            />
            <Skeleton
              variant="text"
              width={200}
              height={34}
              sx={{ mt: 0.5, bgcolor: 'rgba(255,255,255,0.25)', borderRadius: 1 }}
            />
            <Skeleton
              variant="text"
              width={250}
              height={20}
              sx={{ mt: 0.75, bgcolor: 'rgba(255,255,255,0.25)', borderRadius: 1 }}
            />
            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              {[80, 110, 130].map((w) => (
                <Skeleton
                  key={w}
                  variant="rounded"
                  width={w}
                  height={28}
                  sx={{ bgcolor: 'rgba(255,255,255,0.2)', borderRadius: '14px' }}
                />
              ))}
            </Stack>
          </CardContent>
        </Card>

        {/* Action grid skeleton — 2×2 cards */}
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={1.5}>
          {[...Array(4)].map((_, i) => (
            <Card key={i} sx={{ borderRadius: '20px' }}>
              <CardContent sx={{ p: { xs: 1.75, sm: 2 } }}>
                <Stack spacing={1.25}>
                  <Skeleton variant="rounded" width={40} height={40} sx={{ borderRadius: '14px' }} />
                  <Box>
                    <Skeleton variant="text" width="60%" height={20} />
                    <Skeleton variant="text" width="80%" height={16} sx={{ mt: 0.25 }} />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Stat cards skeleton — 2×2 */}
        <Box display="grid" gridTemplateColumns={{ xs: '1fr', sm: '1fr 1fr' }} gap={1.5}>
          {[...Array(4)].map((_, i) => (
            <Card key={i} sx={{ borderRadius: '20px' }}>
              <CardContent sx={{ p: { xs: 1.75, sm: 2 } }}>
                <Skeleton variant="text" width="50%" height={14} />
                <Skeleton variant="text" width="70%" height={32} sx={{ mt: 0.5 }} />
                <Skeleton variant="text" width="90%" height={14} sx={{ mt: 0.75 }} />
              </CardContent>
            </Card>
          ))}
        </Box>

        {/* Accordion skeleton */}
        <Card sx={{ borderRadius: '22px', overflow: 'hidden' }}>
          <CardContent sx={{ p: 2 }}>
            <Skeleton variant="text" width="40%" height={22} />
            <Skeleton variant="text" width="65%" height={16} sx={{ mt: 0.5 }} />
            <Stack spacing={1.5} sx={{ mt: 2 }}>
              {[...Array(3)].map((_, i) => (
                <Box key={i}>
                  <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                    <Skeleton variant="text" width="35%" height={16} />
                    <Skeleton variant="text" width="25%" height={16} />
                  </Stack>
                  <Skeleton variant="rounded" width="100%" height={6} sx={{ borderRadius: 4 }} />
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
