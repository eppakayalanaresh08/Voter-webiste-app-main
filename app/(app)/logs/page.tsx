'use client';

import {
  Box,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
  Chip,
  Paper,
  Button,
  CircularProgress
} from '@mui/material';
import { useEffect, useState, useCallback } from 'react';
import { db, type PendingLog } from '@/lib/offline-db';
import { syncPending } from '@/lib/offline-sync';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SmsIcon from '@mui/icons-material/Sms';
import PrintIcon from '@mui/icons-material/Print';
import ShareIcon from '@mui/icons-material/Share';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import { TextField } from '@mui/material';

type LogGroup = {
  date: string;
  items: any[];
};

export default function LogsPage() {
  const [logGroups, setLogGroups] = useState<LogGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [counts, setCounts] = useState({
    whatsapp: 0,
    sms: 0,
    print: 0,
    share: 0
  });

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = selectedDate ? `/api/logs?date=${selectedDate}` : '/api/logs';
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch logs');
      const json = await res.json();
      const allLogs = json.logs || [];

      const newCounts = {
        whatsapp: 0,
        sms: 0,
        print: 0,
        share: 0
      };

      const groups: Record<string, any[]> = {};

      allLogs.forEach((log: any) => {
        const type = log.actionType;
        if (type === 'WHATSAPP_SENT') newCounts.whatsapp++;
        else if (type === 'SMS_OPENED' || type === 'MESSAGE_COPIED') newCounts.sms++;
        else if (type === 'THERMAL_PRINTED') newCounts.print++;
        else if (type === 'SHARED') newCounts.share++;

        const date = new Date(log.createdAt).toLocaleDateString([], {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        if (!groups[date]) groups[date] = [];
        groups[date].push(log);
      });

      const groupedArray = Object.entries(groups).map(([date, items]) => ({
        date,
        items
      }));

      setLogGroups(groupedArray);
      setCounts(newCounts);
    } catch (error) {
      console.error('[fetchLogs] failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const StatCard = ({
    title,
    count,
    icon: Icon,
    color
  }: {
    title: string;
    count: number;
    icon: any;
    color: string;
  }) => (
    <Card sx={{ height: '100%', borderRadius: '12px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', bgcolor: 'background.paper' }}>
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Stack spacing={1} alignItems="center" textAlign="center">
          <Box
            sx={{
              p: 1,
              borderRadius: '10px',
              bgcolor: `${color}10`,
              color: color,
              display: 'flex'
            }}
          >
            <Icon sx={{ fontSize: 20 }} />
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block' }}>
              {title}
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 800, mt: -0.5 }}>
              {count}
            </Typography>
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );

  return (
    <Stack spacing={2.5} sx={{ p: 1 }}>
      <Stack spacing={0.5}>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>
          Logs
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Track outreach performance.
        </Typography>
      </Stack>

      <Grid container spacing={1.5}>
        <Grid item xs={3}>
          <StatCard title="WhatsApp" count={counts.whatsapp} icon={WhatsAppIcon} color="#25D366" />
        </Grid>
        <Grid item xs={3}>
          <StatCard title="SMS" count={counts.sms} icon={SmsIcon} color="#3b82f6" />
        </Grid>
        <Grid item xs={3}>
          <StatCard title="Print" count={counts.print} icon={PrintIcon} color="#6b7280" />
        </Grid>
        <Grid item xs={3}>
          <StatCard title="Share" count={counts.share} icon={ShareIcon} color="#8b5cf6" />
        </Grid>
      </Grid>

      <Stack spacing={2.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 0.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Recent Activity
          </Typography>
          <TextField
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            size="small"
            InputLabelProps={{ shrink: true }}
            InputProps={{
              startAdornment: <CalendarMonthIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 18 }} />,
            }}
            sx={{
              width: '160px',
              '& .MuiOutlinedInput-root': {
                borderRadius: '10px',
                bgcolor: 'background.paper',
                fontSize: '0.75rem',
                height: '36px'
              },
              '& .MuiOutlinedInput-input': {
                py: 1,
                paddingLeft: 0
              }
            }}
          />
        </Stack>

        {logGroups.length > 0 ? (
          <Stack spacing={3}>
            {logGroups.map((group) => (
              <Stack key={group.date} spacing={1.5}>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', px: 0.5, fontSize: '0.7rem', textTransform: 'uppercase' }}>
                  {group.date}
                </Typography>
                <Stack spacing={1}>
                  {group.items.map((log) => (
                    <Paper
                      key={log.id}
                      variant="outlined"
                      sx={{ 
                        p: 1.25, 
                        borderRadius: '12px', 
                        backgroundColor: 'background.paper',
                        border: '1px solid',
                        borderColor: 'divider',
                        boxShadow: 'none'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            {log.actionType.replace(/_/g, ' ')}
                          </Typography>
                          {log.actionType === 'WHATSAPP_SENT' && (
                            <Chip label="SUCCESS" size="small" color="success" sx={{ height: 16, fontSize: '9px', fontWeight: 800 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontWeight: 600 }}>
                          {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              </Stack>
            ))}
          </Stack>
        ) : (
          <Paper variant="outlined" sx={{ borderRadius: '12px', borderStyle: 'dashed', textAlign: 'center', py: 4, bgcolor: 'transparent' }}>
            <Typography variant="body2" color="text.secondary">
              No activity logs yet.
            </Typography>
          </Paper>
        )}
      </Stack>
    </Stack>
  );
}

