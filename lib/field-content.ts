import { supabaseServer } from './supabase-server';
import {
  getDefaultFieldBanners,
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
  sort_order: number | null;
  updated_at: string;
};

type TemplateRow = {
  id: string;
  type: string;
  name: string;
  body: string;
  enabled: boolean;
  image_url: string | null;
  updated_at: string | null;
};

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
    sortOrder: row.sort_order ?? 0,
    updatedAt: row.updated_at
  };
}

function mapTemplateRow(row: TemplateRow, imageUrl: string | null): FieldContentTemplate | null {
  if (row.type !== 'WHATSAPP') {
    return null;
  }

  return {
    id: row.id,
    type: row.type as FieldContentTemplate['type'],
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
    .select('id, title, subtitle, image_url, enabled, sort_order, updated_at')
    .eq('tenant_id', tenantId)
    .order('sort_order', { ascending: true })
    .order('updated_at', { ascending: false });

  if (options?.enabledBannersOnly) {
    bannerQuery = bannerQuery.eq('enabled', true);
  }

  const [bannerResult, templateResult] = await Promise.all([
    bannerQuery,
    admin
      .from('templates')
      .select('id, type, name, body, enabled, image_url, updated_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
  ]);

  const bannerRows = (bannerResult.data ?? []) as BannerRow[];
  const templateRows = (templateResult.data ?? []) as TemplateRow[];

  // 1. Collect all paths needing signed URLs
  const paths: string[] = [];
  bannerRows.forEach(r => { if (r.image_url) paths.push(r.image_url); });
  templateRows.forEach(r => { if (r.image_url) paths.push(r.image_url); });

  // 2. Batch resolve signed URLs
  const urlMap = new Map<string, string>();
  if (paths.length > 0) {
    const bucket = getFieldAssetBucket();
    const { data: signedResults } = await admin.storage
      .from(bucket)
      .createSignedUrls(paths, 60 * 60 * 12);
    
    signedResults?.forEach(res => {
      if (res.signedUrl && res.path) urlMap.set(res.path, res.signedUrl);
    });
  }

  // 3. Map rows with resolved URLs
  const banners = bannerRows.map(row => 
    mapBannerRow(row, row.image_url ? urlMap.get(row.image_url) ?? null : null)
  );

  const templates = mergeTemplatesWithDefaults(
    templateRows
      .map(row => mapTemplateRow(row, row.image_url ? urlMap.get(row.image_url) ?? null : null))
      .filter((t): t is FieldContentTemplate => Boolean(t))
  );

  return {
    banners: banners.length ? banners : getDefaultFieldBanners(),
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
      banners: getDefaultFieldBanners(),
      templates: mergeTemplatesWithDefaults([])
    };
  }

  return getTenantFieldContent(tenantId, { enabledBannersOnly: true });
}
