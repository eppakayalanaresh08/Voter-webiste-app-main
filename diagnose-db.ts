import { supabaseServer } from './lib/supabase-server';

async function diagnose() {
  const supabase = await supabaseServer();
  
  console.log('--- Templates in Database ---');
  const { data: templates, error: tErr } = await supabase
    .from('templates')
    .select('id, tenant_id, type, name, image_url');
  
  if (tErr) console.error('Templates fetch error:', tErr);
  else console.table(templates);

  console.log('--- Banners in Database ---');
  const { data: banners, error: bErr } = await supabase
    .from('banners')
    .select('id, tenant_id, title, image_url');
  
  if (bErr) console.error('Banners fetch error:', bErr);
  else console.table(banners);
}

diagnose();
