import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase-server';

export async function GET() {
  const supabase = await supabaseServer();
  
  try {
    const { data: bData, error: bError } = await supabase.from('banners').select('*').limit(1);
    const { data: wData, error: wError } = await supabase.from('whatsapp_templates').select('*').limit(1);
    const { data: tpData, error: tpError } = await supabase.from('thermal_print_templates').select('*').limit(1);

    return NextResponse.json({
      banners: {
        success: !bError,
        error: bError?.message,
        columns: bData && bData.length > 0 ? Object.keys(bData[0]) : 'No data to show columns',
        count: bData?.length
      },
      whatsapp_templates: {
        success: !wError,
        error: wError?.message,
        columns: wData && wData.length > 0 ? Object.keys(wData[0]) : 'No data to show columns',
        count: wData?.length
      },
      thermal_print_templates: {
        success: !tpError,
        error: tpError?.message,
        columns: tpData && tpData.length > 0 ? Object.keys(tpData[0]) : 'No data to show columns',
        count: tpData?.length
      }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
