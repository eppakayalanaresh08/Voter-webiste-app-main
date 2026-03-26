'use client';

import NextLink from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { type ConfirmationResult, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { Alert, Box, Button, Card, CardContent, Link, Stack, TextField, Typography } from '@mui/material';
import { firebaseAuth, shouldDisableAppVerificationForTesting } from '@/lib/firebase-client';

type AuthMode = 'login' | 'signup';

type PhoneAuthCardProps = {
  mode: AuthMode;
};

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D+/g, '')}`;

  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Something went wrong. Please try again.';
}

export default function PhoneAuthCard({ mode }: PhoneAuthCardProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'PHONE' | 'OTP'>('PHONE');
  const [status, setStatus] = useState('');
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const confirmRef = useRef<ConfirmationResult | null>(null);
  const testSessionInfoRef = useRef<string | null>(null);

  const isSignup = mode === 'signup';
  const isBrowser = typeof window !== 'undefined';
  const hostname = isBrowser ? window.location.hostname : '';
  const isDevOrEmulatorHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '10.0.2.2';

  const resetRecaptcha = () => {
    if (recaptchaRef.current) {
      try {
        recaptchaRef.current.clear();
      } catch {
        // Ignore stale widget cleanup errors during refresh/retry.
      }
      recaptchaRef.current = null;
    }

    const container = document.getElementById('recaptcha-container');
    if (container) container.innerHTML = '';
  };

  useEffect(() => resetRecaptcha, []);

  const getVerifier = async () => {
    if (!recaptchaRef.current) {
      recaptchaRef.current = new RecaptchaVerifier(firebaseAuth, 'recaptcha-container', {
        size: 'invisible'
      });
      await recaptchaRef.current.render();
    }

    return recaptchaRef.current;
  };

  const checkPhoneAccess = async (normalizedPhone: string) => {
    const res = await fetch('/api/auth/check-phone', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone })
    });

    const json = (await res.json().catch(() => null)) as
      | { allowed?: boolean; message?: string; error?: string }
      | null;

    if (!res.ok) {
      throw new Error(json?.error ?? 'Unable to verify phone access.');
    }

    return {
      allowed: Boolean(json?.allowed),
      message: json?.message
    };
  };

  const sendTestOtpFromServer = async (normalizedPhone: string) => {
    const response = await fetch('/api/auth/firebase-test/send-otp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone: normalizedPhone })
    });
    const json = (await response.json().catch(() => null)) as
      | { sessionInfo?: string; phone?: string; error?: string }
      | null;

    if (!response.ok || !json?.sessionInfo) {
      throw new Error(json?.error ?? 'Unable to send test OTP.');
    }

    testSessionInfoRef.current = json.sessionInfo;
    setPhone(json.phone ?? normalizedPhone);
    setStep('OTP');
    setStatus('Enter the OTP');
  };

  const sendOtp = async () => {
    if (isSubmitting) return;

    setStatus('');
    setIsError(false);

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      setIsError(true);
      return setStatus('Enter a valid phone number');
    }

    setIsSubmitting(true);
    try {
      const access = await checkPhoneAccess(normalizedPhone);
      if (!access.allowed) {
        setIsError(true);
        return setStatus(access.message ?? 'This phone number is not invited yet.');
      }

      if (shouldDisableAppVerificationForTesting || isDevOrEmulatorHost) {
        await sendTestOtpFromServer(normalizedPhone);
      } else {
        try {
          const verifier = await getVerifier();
          confirmRef.current = await signInWithPhoneNumber(firebaseAuth, normalizedPhone, verifier);
          setPhone(normalizedPhone);
          setStep('OTP');
          setStatus('OTP sent. Check your SMS.');
        } catch (firebaseError) {
          const message = formatError(firebaseError);
          const isFirebaseNetworkError =
            message.includes('auth/network-request-failed') || message.includes('auth/internal-error');

          if (isFirebaseNetworkError) {
            await sendTestOtpFromServer(normalizedPhone);
          } else {
            throw firebaseError;
          }
        }
      }
    } catch (error) {
      console.error('[PhoneAuth] sendOtp failed:', error);
      resetRecaptcha();
      setIsError(true);
      const message = formatError(error);
      if (shouldDisableAppVerificationForTesting) {
        setStatus(
          `${message} Emulator/dev mode is using Firebase test verification. Use a phone number configured in Firebase Auth > Phone test numbers.`,
        );
      } else {
        setStatus(`${message} If this is a Firebase test number, use the configured test OTP (SMS is not sent).`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const verifyOtp = async () => {
    if (isSubmitting) return;

    setStatus('');
    setIsError(false);

    if (!confirmRef.current && !shouldDisableAppVerificationForTesting) {
      setIsError(true);
      return setStatus('Request OTP first.');
    }

    setIsSubmitting(true);
    try {
      let idToken = '';
      if (shouldDisableAppVerificationForTesting) {
        if (!testSessionInfoRef.current) {
          setIsError(true);
          return setStatus('Request OTP first.');
        }

        const response = await fetch('/api/auth/firebase-test/verify-otp', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            sessionInfo: testSessionInfoRef.current,
            code: otp
          })
        });
        const json = (await response.json().catch(() => null)) as { idToken?: string; error?: string } | null;
        if (!response.ok || !json?.idToken) {
          setIsError(true);
          return setStatus(json?.error ?? 'Invalid OTP.');
        }
        idToken = json.idToken;
      } else {
        const credential = await confirmRef.current!.confirm(otp);
        idToken = await credential.user.getIdToken(true);
      }

      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ idToken })
      });

      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setIsError(true);
        if (res.status === 403) {
          return setStatus('This phone number is not invited yet or its profile is missing. Ask an admin to check invites.');
        }
        return setStatus(json?.error ?? 'Login failed');
      }

      setStatus('Verified. Redirecting...');
      window.location.href = '/home';
    } catch (error) {
      setIsError(true);
      setStatus(formatError(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card sx={{ width: '100%', maxWidth: 420 }}>
      <CardContent sx={{ p: { xs: 2.5, sm: 3 } }}>
        <Box
          sx={{
            display: 'inline-flex',
            px: 1.25,
            py: 0.5,
            borderRadius: 999,
            backgroundColor: 'primary.light',
            color: 'primary.main'
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 700 }}>
            {isSignup ? 'Mobile Sign Up' : 'Mobile Login'}
          </Typography>
        </Box>
        <Typography variant="h5" sx={{ mt: 1.25, fontWeight: 700 }}>
          {isSignup ? 'Create Account' : 'Welcome Back'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
          {isSignup ? 'Sign up with your phone number.' : 'Log in with your phone number.'}
        </Typography>

        <Stack spacing={1.5} sx={{ mt: 2.5 }}>
          {/* {shouldDisableAppVerificationForTesting && (
            <Alert severity="info">
              Emulator/dev phone auth mode is active. Use only Firebase configured test phone numbers + OTP.
            </Alert>
          )} */}

          <TextField
            label="Phone"
            placeholder="+91XXXXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            disabled={isSubmitting}
            InputProps={{ readOnly: step === 'OTP' || isSubmitting }}
            helperText="Use +91XXXXXXXXXX or 10-digit number"
            fullWidth
          />

          {step === 'OTP' && (
            <TextField
              label="OTP"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              disabled={isSubmitting}
              inputProps={{ inputMode: 'numeric', autoComplete: 'one-time-code' }}
              fullWidth
            />
          )}

          {status && <Alert severity={isError ? 'error' : 'success'}>{status}</Alert>}

          {step === 'PHONE' ? (
            <Button variant="contained" onClick={sendOtp} disabled={isSubmitting}>
              {isSubmitting ? 'Sending...' : 'Send OTP'}
            </Button>
          ) : (
            <Button variant="contained" onClick={verifyOtp} disabled={isSubmitting}>
              {isSubmitting ? 'Verifying...' : 'Verify OTP'}
            </Button>
          )}
        </Stack>

        <Box id="recaptcha-container" sx={{ width: 0, height: 0, overflow: 'hidden', opacity: 0 }} />

        <Typography align="center" variant="body2" color="text.secondary" sx={{ mt: 2.5 }}>
          {isSignup ? 'Already have an account?' : 'New here?'}{' '}
          <Link component={NextLink} href={isSignup ? '/login' : '/signup'} underline="hover" fontWeight={600}>
            {isSignup ? 'Log in' : 'Sign up'}
          </Link>
        </Typography>
      </CardContent>
    </Card>
  );
}
