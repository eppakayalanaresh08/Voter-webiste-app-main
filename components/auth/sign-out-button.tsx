// 'use client';

// import { signOut } from 'firebase/auth';
// import { useRouter } from 'next/navigation';
// import Button from '@mui/material/Button';
// import { firebaseAuth } from '@/lib/firebase-client';

// export default function SignOutButton() {
//   const router = useRouter();

//   const onSignOut = async () => {
//     // Best effort Firebase client signout; session cookie is cleared by server route.
//     await signOut(firebaseAuth).catch(() => undefined);
//     await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined);
//     router.replace('/onboarding');
//     router.refresh();
//   };

//   return (
//     <Button
//       type="button"
//       variant="outlined"
//       size="small"
//       color="primary"
//       onClick={onSignOut}
//     >
//       Sign out
//     </Button>
//   );
// }

'use client';

import { signOut } from 'firebase/auth';

import Button from '@mui/material/Button';
import { firebaseAuth } from '@/lib/firebase-client';
import { db } from '@/lib/offline-db';

export default function SignOutButton() {
  const clearClientSessionState = async () => {
    await Promise.allSettled([
      db.voters.clear(),
      db.meta.clear(),
      db.pendingEdits.clear(),
      db.pendingLogs.clear(),
      db.teamCache.clear(),
      db.homeCache.clear()
    ]);

    try {
      window.localStorage.clear();
    } catch {}

    try {
      window.sessionStorage.clear();
    } catch {}

    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.allSettled(keys.map((key) => caches.delete(key)));
      } catch {}
    }
  };

  const onSignOut = async () => {
    await Promise.allSettled([signOut(firebaseAuth), fetch('/api/auth/logout', { method: 'POST' })]);
    await clearClientSessionState();
    window.location.href = '/onboarding';
  };

  return (
    <Button
      type="button"
      variant="outlined"
      size="small"
      color="primary"
      onClick={onSignOut}
    >
      Sign out
    </Button>
  );
}