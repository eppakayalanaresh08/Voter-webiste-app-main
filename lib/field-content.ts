import { supabaseServer } from './supabase-server';
import {
  mergeTemplatesWithDefaults,
  type FieldContentBanner,
  type FieldContentTemplate
} from './field-content-shared';

type BannerRow = {
  id: string;
  title: string | null;
  subtitle: string | null;
  image_url: string | null;
  enabled: boolean;
  updated_at: string;
};

type TemplateStorageRow = {
  id: string;
  name: string;
  body: string;
  enabled: boolean;
  image_url: string | null;
  updated_at: string | null;
};

function isMissingTableError(message: string | undefined) {
  const lower = message?.toLowerCase() ?? '';
  return (
    (lower.includes('relation') && lower.includes('does not exist')) ||
    (lower.includes('could not find') && lower.includes('table')) ||
    (lower.includes('schema cache') && lower.includes('table'))
  );
}

export function getFieldAssetBucket() {
  return process.env.SUPABASE_STORAGE_BUCKET ?? 'upload';
}

export async function ensureFieldAssetBucket() {
  const admin = await supabaseServer();
  const bucket = getFieldAssetBucket();
  const { data: buckets, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    throw new Error(`Unable to list buckets: ${listError.message}`);
  }

  const exists = (buckets ?? []).some((candidate) => candidate.id === bucket || candidate.name === bucket);
  if (exists) return bucket;

  const { error: createError } = await admin.storage.createBucket(bucket, { public: false });
  if (createError && !createError.message.toLowerCase().includes('already')) {
    throw new Error(`Unable to create bucket "${bucket}": ${createError.message}`);
  }

  return bucket;
}

async function resolveAssetUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) return path;

  const admin = await supabaseServer();
  const bucket = getFieldAssetBucket();
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, 60 * 60 * 12);

  if (error) return null;
  return data.signedUrl;
}

function mapBannerRow(row: BannerRow, imageUrl: string | null): FieldContentBanner {
  return {
    id: row.id,
    title: row.title ?? '',
    subtitle: row.subtitle ?? '',
    imagePath: row.image_url ?? null,
    imageUrl,
    enabled: row.enabled,
    sortOrder: 0,
    updatedAt: row.updated_at
  };
}

function mapTemplateRow(
  row: TemplateStorageRow,
  type: FieldContentTemplate['type'],
  imageUrl: string | null
): FieldContentTemplate {
  return {
    id: row.id,
    type,
    name: row.name,
    body: row.body,
    enabled: row.enabled,
    imagePath: row.image_url ?? null,
    imageUrl,
    updatedAt: row.updated_at
  };
}

export async function getTenantFieldContent(tenantId: string, options?: { enabledBannersOnly?: boolean }) {
  const admin = await supabaseServer();
  let bannerQuery = admin
    .from('banners')
    .select('id, title, subtitle, image_url, enabled, updated_at')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: true })
    .order('id', { ascending: true });

  if (options?.enabledBannersOnly) {
    bannerQuery = bannerQuery.eq('enabled', true);
  }

  const [bannerResult, whatsappTemplateResult, thermalTemplateResult] = await Promise.all([
    bannerQuery,
    admin
      .from('whatsapp_templates')
      .select('id, name, body, enabled, image_url, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true }),
    admin
      .from('thermal_print_templates')
      .select('id, name, body, enabled, image_url, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
  ]);

  const bannerRows = (bannerResult.data ?? []) as BannerRow[];
  if (whatsappTemplateResult.error && !isMissingTableError(whatsappTemplateResult.error.message)) {
    throw new Error(whatsappTemplateResult.error.message);
  }

  if (thermalTemplateResult.error && !isMissingTableError(thermalTemplateResult.error.message)) {
    throw new Error(thermalTemplateResult.error.message);
  }

  const whatsappTemplateRows = isMissingTableError(whatsappTemplateResult.error?.message)
    ? []
    : ((whatsappTemplateResult.data ?? []) as TemplateStorageRow[]);
  const thermalTemplateRows = isMissingTableError(thermalTemplateResult.error?.message)
    ? []
    : ((thermalTemplateResult.data ?? []) as TemplateStorageRow[]);

  // 1. Collect all paths needing signed URLs (exclude full URLs and local assets starting with /)
  const paths: string[] = [];
  const nonStorageMap = new Map<string, string>();
  
  [...bannerRows, ...whatsappTemplateRows, ...thermalTemplateRows].forEach(r => {
    const path = r.image_url;
    if (!path) return;
    
    if (/^(https?:)?\/\//i.test(path) || path.startsWith('/')) {
      nonStorageMap.set(path, path);
    } else {
      paths.push(path);
    }
  });

  // 2. Batch resolve signed URLs for storage paths
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const bucket = getFieldAssetBucket();
    const { data: signedResults, error: batchError } = await admin.storage
      .from(bucket)
      .createSignedUrls(paths, 60 * 60 * 12);
    
    if (batchError) {
      console.error(`[field-content] Batch sign URLs failed for bucket "${bucket}":`, batchError.message);
    }

    signedResults?.forEach((res, index) => {
      const requestedPath = paths[index];
      if (res.signedUrl) {
        urlMap.set(requestedPath, res.signedUrl);
      } else {
        // If there's an error for a specific path, it will be in res.error (or just null signedUrl)
        console.warn(`[field-content] Failed to sign URL for path "${requestedPath}":`, (res as any).error || 'No signed URL returned');
      }
    });
  }

  // 3. Map rows with resolved URLs (either signed storage URL or original non-storage URL)
  const getUrl = (path: string | null) => {
    if (!path) return null;
    return nonStorageMap.get(path) ?? urlMap.get(path) ?? null;
  };

  const banners = bannerRows.map((row, index) => ({
    ...mapBannerRow(row, getUrl(row.image_url)),
    sortOrder: index
  }));

  const templates = mergeTemplatesWithDefaults(
    [
      ...whatsappTemplateRows.map((row) => mapTemplateRow(row, 'WHATSAPP', getUrl(row.image_url))),
      ...thermalTemplateRows.map((row) => mapTemplateRow(row, 'THERMAL_PRINT', getUrl(row.image_url)))
    ]
  );

  return {
    banners,
    templates
  };
}

export async function getPublicFieldContent() {
  const admin = await supabaseServer();
  const { data: latestBanner } = await admin
    .from('banners')
    .select('tenant_id')
    .eq('enabled', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const tenantId = (latestBanner?.tenant_id as string | undefined) ?? null;
  if (!tenantId) {
    return {
      banners: [],
      templates: mergeTemplatesWithDefaults([])
    };
  }

  return getTenantFieldContent(tenantId, { enabledBannersOnly: true });
}
