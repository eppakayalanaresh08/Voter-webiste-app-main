import { supabaseServer } from './lib/supabase-server';

async function diagnose() {
  const supabase = await supabaseServer();
  
  console.log('--- Columns in banners ---');
  const { data, error } = await supabase
    .from('banners')
    .select('*')
    .limit(1);
  
  if (error) console.error('Error:', error);
  else if (data && data.length > 0) {
    console.log('Found columns:', Object.keys(data[0]));
  } else {
    console.log('No banners found.');
  }
}

diagnose();
