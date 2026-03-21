import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getProfile } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase-server';

export const runtime = 'nodejs';

const InviteSchema = z.object({
  phone: z.string().min(8),
  fullName: z.string().min(1),
  role: z.enum(['ASPIRANT', 'SUB_USER']),
  aspirantUserId: z.string().uuid().optional().nullable()
});

function normalizePhoneE164(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('+')) {
    return `+${trimmed.slice(1).replace(/\D+/g, '')}`;
  }

  const digits = trimmed.replace(/\D+/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile || profile.role !== 'SUPER_ADMIN' || !profile.tenant_id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
  }

  if (parsed.data.role === 'SUB_USER' && !parsed.data.aspirantUserId) {
    return NextResponse.json({ error: 'Select aspirant for SUB_USER' }, { status: 400 });
  }

  const normalizedPhone = normalizePhoneE164(parsed.data.phone);

  const supabase = await supabaseServer();
  let parentUserId: string | null = null;

  if (parsed.data.role === 'SUB_USER' && parsed.data.aspirantUserId) {
    const { data: aspirant } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', parsed.data.aspirantUserId)
      .eq('tenant_id', profile.tenant_id)
      .eq('role', 'ASPIRANT')
      .maybeSingle();

    if (!aspirant) {
      return NextResponse.json({ error: 'Invalid aspirant selected' }, { status: 400 });
    }

    parentUserId = aspirant.id as string;
  }

  const { error } = await supabase.from('phone_invites').upsert({
    tenant_id: profile.tenant_id,
    phone: normalizedPhone,
    role: parsed.data.role,
    full_name: parsed.data.fullName,
    parent_user_id: parentUserId
  }, {
    onConflict: 'tenant_id,phone'
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
