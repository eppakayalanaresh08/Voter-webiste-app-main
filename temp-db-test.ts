import { supabaseServer } from './lib/supabase-server';

async function test() {
  const supabase = await supabaseServer();
  
  console.log('--- Testing banner insert ---');
  const { data, error } = await supabase
    .from('banners')
    .insert({
      tenant_id: 'test-tenant',
      title: 'Test Banner',
      enabled: true,
      sort_order: 0
    })
    .select();
  
  if (error) {
    console.error('Insert Error:', error.message);
    console.error('Error Code:', error.code);
    console.error('Error Details:', error.details);
  } else {
    console.log('Insert Success:', data);
  }
}

test();
