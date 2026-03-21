'use client';

import { signOut } from 'firebase/auth';
import Button from '@mui/material/Button';
import { firebaseAuth } from '@/lib/firebase-client';

export default function SignOutButton() {
  const onSignOut = () => {
    // Best effort Firebase client signout; session cookie is cleared by server route.
    void signOut(firebaseAuth).catch(() => undefined);
  };

  return (
    <Button
      type="button"
      variant="outlined"
      size="small"
      color="primary"
      component="a"
      href="/api/auth/logout?redirect=/onboarding"
      onClick={onSignOut}
    >
      Sign out
    </Button>
  );
}
