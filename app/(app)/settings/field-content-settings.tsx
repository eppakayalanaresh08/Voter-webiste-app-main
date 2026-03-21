'use client';

import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import {
  FIELD_TEMPLATE_TOKENS,
  TEMPLATE_TYPES,
  type FieldContentBanner,
  type FieldContentTemplate,
  type TemplateType
} from '@/lib/field-content-shared';
import { appendImageToMessage, renderMessageTemplate } from '@/lib/message-templates';
import type { OfflineVoter } from '@/lib/offline-db';

type BannerDraft = FieldContentBanner & {
  localKey: string;
};

type FieldContentSettingsProps = {
  canEdit: boolean;
  initialBanners: FieldContentBanner[];
  initialTemplates: FieldContentTemplate[];
};

const SAMPLE_VOTER: OfflineVoter = {
  id: 'preview-voter',
  ward_no: '198',
  booth_no: '24',
  serial_no: '118',
  voter_name: 'Ravi Kumar',
  voter_name_tamil: 'రవి కుమార్',
  relation_name: 'Suresh Kumar',
  relation_name_tamil: 'సురేష్ కుమార్',
  epic_id: 'ABC1234567',
  sex: 'Male',
  age: 41,
  dob: '1985-03-04',
  house_no: '12-4-118',
  booth_name: 'Bansilalpet Community Hall',
  booth_address: 'Ward 198, Bansilalpet',
  mobile_no: '+919876543210',
  caste: null,
  religion: null,
  aadhar_card_no: null,
  education: null,
  profession: null,
  local_issue: null,
  interested_party: null,
  notes: null,
  updated_at: new Date(0).toISOString()
};

function templateLabel(type: TemplateType) {
  return 'WhatsApp';
}

export default function FieldContentSettings({
  canEdit,
  initialBanners,
  initialTemplates
}: FieldContentSettingsProps) {
  const [banners, setBanners] = useState<BannerDraft[]>(
    [...initialBanners].sort((left, right) => left.sortOrder - right.sortOrder).map((banner, index) => ({
      ...banner,
      localKey: banner.id ?? `initial-${index}`
    }))
  );
  const [templates, setTemplates] = useState<FieldContentTemplate[]>(initialTemplates);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busyKey, setBusyKey] = useState('');

  const sortedTemplates = useMemo(
    () => TEMPLATE_TYPES.map((type) => templates.find((template) => template.type === type)!).filter(Boolean),
    [templates]
  );

  const getPreviewText = (template: FieldContentTemplate) => {
    const rendered = renderMessageTemplate(template.body, SAMPLE_VOTER);
    return appendImageToMessage(rendered, template.imageUrl);
  };

  const replaceBanners = (nextBanners: FieldContentBanner[], options?: { discardLocalKeys?: string[] }) => {
    setBanners((current) => {
      const drafts = current
        .filter((entry) => !entry.id && !options?.discardLocalKeys?.includes(entry.localKey))
        .sort((left, right) => left.sortOrder - right.sortOrder);

      const saved = [...nextBanners]
        .sort((left, right) => left.sortOrder - right.sortOrder)
        .map((entry, index) => ({
          ...entry,
          localKey: entry.id ?? `saved-${index}`
        }));

      const preservedDrafts = drafts.map((entry, index) => ({
        ...entry,
        sortOrder: saved.length + index
      }));

      return [...saved, ...preservedDrafts];
    });
  };

  const setBannerField = (localKey: string, patch: Partial<BannerDraft>) => {
    setBanners((current) => current.map((banner) => (banner.localKey === localKey ? { ...banner, ...patch } : banner)));
  };

  const setTemplateField = (type: TemplateType, patch: Partial<FieldContentTemplate>) => {
    setTemplates((current) => current.map((template) => (template.type === type ? { ...template, ...patch } : template)));
  };

  const uploadImage = async (file: File, kind: 'banner' | 'template', templateType?: TemplateType) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (templateType) form.append('templateType', templateType);

    const res = await fetch('/api/field-content/media', { method: 'POST', body: form });
    const json = (await res.json().catch(() => null)) as { error?: string; imagePath?: string; imageUrl?: string } | null;

    if (!res.ok || !json?.imagePath) {
      throw new Error(json?.error ?? 'Image upload failed');
    }

    return { imagePath: json.imagePath, imageUrl: json.imageUrl ?? null };
  };

  const saveBanner = async (banner: BannerDraft) => {
    setBusyKey(`banner:${banner.localKey}`);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/field-content/banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: banner.id ?? undefined,
          title: banner.title,
          subtitle: banner.subtitle,
          enabled: banner.enabled,
          sortOrder: banner.sortOrder,
          imagePath: banner.imagePath
        })
      });

      const json = (await res.json().catch(() => null)) as { error?: string; banners?: FieldContentBanner[] } | null;
      if (!res.ok || !json?.banners) {
        throw new Error(json?.error ?? 'Unable to save banner');
      }

      replaceBanners(json.banners, { discardLocalKeys: banner.id ? [] : [banner.localKey] });
      setNotice('Banner updated.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save banner');
    } finally {
      setBusyKey('');
    }
  };

  const saveTemplate = async (template: FieldContentTemplate) => {
    setBusyKey(`template:${template.type}`);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/field-content/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: template.type,
          name: template.name,
          body: template.body,
          enabled: template.enabled,
          imagePath: template.imagePath
        })
      });

      const json = (await res.json().catch(() => null)) as { error?: string; templates?: FieldContentTemplate[] } | null;
      if (!res.ok || !json?.templates) {
        throw new Error(json?.error ?? 'Unable to save template');
      }

      setTemplates(json.templates);
      setNotice(`${templateLabel(template.type)} template updated.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save template');
    } finally {
      setBusyKey('');
    }
  };

  const addBanner = () => {
    setBanners((current) => [
      ...current,
      {
        id: null,
        localKey: `new-${Date.now()}`,
        title: '',
        subtitle: '',
        imagePath: null,
        imageUrl: null,
        enabled: true,
        sortOrder: current.length,
        updatedAt: null
      }
    ]);
  };

  const persistBannerOrder = async (orderedBanners: BannerDraft[]) => {
    const items = orderedBanners
      .filter((banner) => Boolean(banner.id))
      .map((banner, index) => ({
        id: banner.id!,
        sortOrder: index
      }));

    if (!items.length) return;

    const res = await fetch('/api/field-content/banners', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    const json = (await res.json().catch(() => null)) as { error?: string; banners?: FieldContentBanner[] } | null;

    if (!res.ok || !json?.banners) {
      throw new Error(json?.error ?? 'Unable to update banner order');
    }

    replaceBanners(json.banners);
  };

  const moveBanner = async (localKey: string, direction: -1 | 1) => {
    const index = banners.findIndex((banner) => banner.localKey === localKey);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= banners.length) return;

    const reordered = [...banners];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const normalized = reordered.map((banner, nextIndex) => ({ ...banner, sortOrder: nextIndex }));
    setBanners(normalized);

    const hasPersistedBanner = normalized.some((banner) => Boolean(banner.id));
    if (!hasPersistedBanner) return;

    setBusyKey(`banner-order:${localKey}`);
    setNotice('');
    setError('');

    try {
      await persistBannerOrder(normalized);
      setNotice('Banner order updated.');
    } catch (orderError) {
      setError(orderError instanceof Error ? orderError.message : 'Unable to update banner order');
    } finally {
      setBusyKey('');
    }
  };

  const deleteBanner = async (banner: BannerDraft) => {
    if (!banner.id) {
      setBanners((current) =>
        current
          .filter((entry) => entry.localKey !== banner.localKey)
          .map((entry, index) => ({ ...entry, sortOrder: index }))
      );
      setNotice('Draft banner removed.');
      return;
    }

    setBusyKey(`banner-delete:${banner.localKey}`);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/field-content/banners', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: banner.id })
      });
      const json = (await res.json().catch(() => null)) as { error?: string; banners?: FieldContentBanner[] } | null;

      if (!res.ok || !json?.banners) {
        throw new Error(json?.error ?? 'Unable to delete banner');
      }

      replaceBanners(json.banners);
      setNotice('Banner removed.');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete banner');
    } finally {
      setBusyKey('');
    }
  };

  return (
    <Stack spacing={2.25}>
      {error && <Alert severity="error">{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {!canEdit && (
        <Alert severity="info">Campaign banners and message templates are managed by the aspirant for this workspace.</Alert>
      )}

      <Card>
        <CardContent>
          <Stack spacing={1.75}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Home & Onboarding Banners
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  These images power the user onboarding slideshow and the home banner card.
                </Typography>
              </Box>
              {canEdit && (
                <Button variant="outlined" onClick={addBanner}>
                  Add Banner
                </Button>
              )}
            </Stack>

            <Stack spacing={1.5}>
              {banners.map((banner, index) => (
                <Card key={banner.localKey} variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      {banner.imageUrl && (
                        <Box
                          component="img"
                          src={banner.imageUrl}
                          alt={banner.title || 'Banner preview'}
                          sx={{
                            width: '100%',
                            height: 160,
                            objectFit: 'cover',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider'
                          }}
                        />
                      )}

                      <TextField
                        label="Title"
                        value={banner.title}
                        onChange={(event) => setBannerField(banner.localKey, { title: event.target.value })}
                        disabled={!canEdit}
                        fullWidth
                      />
                      <TextField
                        label="Subtitle"
                        value={banner.subtitle}
                        onChange={(event) => setBannerField(banner.localKey, { subtitle: event.target.value })}
                        disabled={!canEdit}
                        multiline
                        minRows={3}
                        fullWidth
                      />

                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="space-between">
                        <FormControlLabel
                          control={
                            <Switch
                              checked={banner.enabled}
                              onChange={(event) => setBannerField(banner.localKey, { enabled: event.target.checked })}
                              disabled={!canEdit}
                            />
                          }
                          label={banner.enabled ? 'Enabled' : 'Disabled'}
                        />

                        {canEdit && (
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button
                              variant="text"
                              startIcon={<ArrowUpwardRoundedIcon />}
                              onClick={() => void moveBanner(banner.localKey, -1)}
                              disabled={index === 0 || busyKey.startsWith('banner-order:')}
                            >
                              Up
                            </Button>
                            <Button
                              variant="text"
                              startIcon={<ArrowDownwardRoundedIcon />}
                              onClick={() => void moveBanner(banner.localKey, 1)}
                              disabled={index === banners.length - 1 || busyKey.startsWith('banner-order:')}
                            >
                              Down
                            </Button>
                            <Button
                              component="label"
                              variant="outlined"
                              startIcon={<AddPhotoAlternateRoundedIcon />}
                              disabled={busyKey === `banner:${banner.localKey}` || busyKey === `banner-delete:${banner.localKey}`}
                            >
                              Upload Image
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;

                                  setBusyKey(`banner:${banner.localKey}`);
                                  setNotice('');
                                  setError('');

                                  try {
                                    const image = await uploadImage(file, 'banner');
                                    setBannerField(banner.localKey, image);
                                    setNotice('Banner image uploaded. Save banner to publish it.');
                                  } catch (uploadError) {
                                    setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
                                  } finally {
                                    setBusyKey('');
                                    event.target.value = '';
                                  }
                                }}
                              />
                            </Button>
                            <Button
                              variant="contained"
                              startIcon={<SaveRoundedIcon />}
                              onClick={() => void saveBanner(banner)}
                              disabled={busyKey === `banner:${banner.localKey}` || busyKey === `banner-delete:${banner.localKey}`}
                            >
                              {busyKey === `banner:${banner.localKey}` ? 'Saving...' : 'Save Banner'}
                            </Button>
                            <Button
                              variant="text"
                              color="error"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              onClick={() => void deleteBanner(banner)}
                              disabled={busyKey === `banner:${banner.localKey}` || busyKey === `banner-delete:${banner.localKey}`}
                            >
                              {busyKey === `banner-delete:${banner.localKey}` ? 'Removing...' : 'Delete'}
                            </Button>
                          </Stack>
                        )}
                      </Stack>
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1.75}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Dynamic Communication Templates
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Use voter fields inside the message body.
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {FIELD_TEMPLATE_TOKENS.map((token) => (
                <Chip key={token} label={token} size="small" />
              ))}
            </Stack>

            <Stack spacing={1.5}>
              {sortedTemplates.map((template) => (
                <Card key={template.type} variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {templateLabel(template.type)}
                        </Typography>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={template.enabled}
                              onChange={(event) => setTemplateField(template.type, { enabled: event.target.checked })}
                              disabled={!canEdit}
                            />
                          }
                          label={template.enabled ? 'Enabled' : 'Disabled'}
                        />
                      </Stack>

                      <TextField
                        label="Template Name"
                        value={template.name}
                        onChange={(event) => setTemplateField(template.type, { name: event.target.value })}
                        disabled={!canEdit}
                        fullWidth
                      />
                      <TextField
                        label="Template Body"
                        value={template.body}
                        onChange={(event) => setTemplateField(template.type, { body: event.target.value })}
                        disabled={!canEdit}
                        multiline
                        minRows={5}
                        fullWidth
                      />

                      <Box
                        sx={{
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 3,
                          backgroundColor: template.type === 'WHATSAPP' ? '#edf4ff' : 'background.paper'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Live Preview
                        </Typography>
                        {template.type === 'WHATSAPP' && template.imageUrl && (
                          <Box
                            component="img"
                            src={template.imageUrl}
                            alt={`${templateLabel(template.type)} asset`}
                            sx={{
                              mt: 1,
                              width: '100%',
                              maxWidth: 240,
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 3,
                              border: '1px solid',
                              borderColor: 'divider'
                            }}
                          />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            mt: 1,
                            whiteSpace: 'pre-wrap',
                            lineHeight: 1.6,
                            fontFamily: 'inherit'
                          }}
                        >
                          {getPreviewText(template)}
                        </Typography>
                      </Box>

                      {template.type === 'WHATSAPP' && (
                        <Stack spacing={1.25}>
                          {template.imageUrl && (
                            <Box
                              component="img"
                              src={template.imageUrl}
                              alt={`${templateLabel(template.type)} preview`}
                              sx={{
                                width: '100%',
                                maxWidth: 240,
                                height: 120,
                                objectFit: 'cover',
                                borderRadius: 3,
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            />
                          )}
                          {canEdit && (
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Button
                                component="label"
                                variant="outlined"
                                startIcon={<AddPhotoAlternateRoundedIcon />}
                                disabled={busyKey === `template:${template.type}`}
                              >
                                Upload Image
                                <input
                                  hidden
                                  type="file"
                                  accept="image/*"
                                  onChange={async (event) => {
                                    const file = event.target.files?.[0];
                                    if (!file) return;

                                    setBusyKey(`template:${template.type}`);
                                    setNotice('');
                                    setError('');

                                    try {
                                      const image = await uploadImage(file, 'template', template.type);
                                      setTemplateField(template.type, image);
                                      setNotice(`${templateLabel(template.type)} image uploaded. Save template to publish it.`);
                                    } catch (uploadError) {
                                      setError(uploadError instanceof Error ? uploadError.message : 'Image upload failed');
                                    } finally {
                                      setBusyKey('');
                                      event.target.value = '';
                                    }
                                  }}
                                />
                              </Button>
                              <Button
                                variant="text"
                                onClick={() => setTemplateField(template.type, { imagePath: null, imageUrl: null })}
                                disabled={busyKey === `template:${template.type}`}
                              >
                                Clear Image
                              </Button>
                            </Stack>
                          )}
                        </Stack>
                      )}

                      {canEdit && (
                        <Stack direction="row" justifyContent="flex-end">
                          <Button
                            variant="contained"
                            startIcon={<SaveRoundedIcon />}
                            onClick={() => void saveTemplate(template)}
                            disabled={busyKey === `template:${template.type}`}
                          >
                            {busyKey === `template:${template.type}` ? 'Saving...' : 'Save Template'}
                          </Button>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
