import { Box } from '@mui/material';
import PhoneAuthCard from '@/components/auth/phone-auth-card';

export default function LoginPage() {
  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', px: 2, py: 4, backgroundColor: 'background.default' }}>
      <PhoneAuthCard mode="login" />
    </Box>
  );
}
