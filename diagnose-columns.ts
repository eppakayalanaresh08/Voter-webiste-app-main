import { supabaseServer } from './lib/supabase-server';

async function diagnose() {
  const supabase = await supabaseServer();
  
  console.log('--- Columns in templates ---');
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .limit(1);
  
  if (error) console.error('Error:', error);
  else if (data && data.length > 0) {
    console.log('Found columns:', Object.keys(data[0]));
  } else {
    console.log('No templates found.');
  }
}

diagnose();
