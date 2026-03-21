import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/auth';

export const dynamic = 'force-dynamic';


export default async function Page() {
  const profile = await getProfile();
  if (!profile) redirect('/onboarding');
  if (profile.role === 'SUPER_ADMIN') redirect('/admin');
  redirect('/home');
}
