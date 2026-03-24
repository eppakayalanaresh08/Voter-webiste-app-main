'use client';

import AddPhotoAlternateRoundedIcon from '@mui/icons-material/AddPhotoAlternateRounded';
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
import type { OfflineVoter } from '@/lib/offline-db';
import {
  buildThermalPrintPreview,
  parseThermalPrintTemplateConfig,
  stringifyThermalPrintTemplateConfig,
  type ThermalPrintTemplateConfig
} from '@/lib/thermal-print-template';
import {
  buildWhatsAppPreview,
  parseWhatsAppTemplateConfig,
  stringifyWhatsAppTemplateConfig,
  type WhatsAppTemplateConfig
} from '@/lib/whatsapp-template';

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
  voter_name_tamil: 'ரவி குமார்',
  relation_name: 'Suresh Kumar',
  relation_name_tamil: 'சுரேஷ் குமார்',
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

const THERMAL_TEXT_FIELDS: Array<{
  key: keyof ThermalPrintTemplateConfig;
  label: string;
  rows?: number;
}> = [
  { key: 'headerLine1', label: 'Header Line 1' },
  { key: 'headerLine2', label: 'Header Line 2' },
  { key: 'headerLine3', label: 'Header Line 3' },
  { key: 'relationLabel', label: 'Relation Label' },
  { key: 'epicLabel', label: 'EPIC Label' },
  { key: 'boothLabel', label: 'Booth Label' },
  { key: 'serialLabel', label: 'Serial Label' },
  { key: 'pollBoothLabel', label: 'Poll Booth Label' },
  { key: 'voteOnLabel', label: 'Vote On Label' },
  { key: 'printedOnLabel', label: 'Printed On Label' },
  { key: 'cutLineText', label: 'Cut Line Text' },
  { key: 'appealLine1', label: 'Footer Appeal Line 1' },
  { key: 'appealLine2', label: 'Footer Appeal Line 2' },
  { key: 'appealLineTamil', label: 'Footer Tamil Text', rows: 3 },
  { key: 'candidateLine1', label: 'Candidate Line 1' },
  { key: 'candidateLine2', label: 'Candidate Line 2' },
  { key: 'candidateLine3', label: 'Candidate Line 3' },
  { key: 'candidateLine4', label: 'Candidate Line 4' }
];

const WHATSAPP_TEXT_FIELDS: Array<{
  key: keyof WhatsAppTemplateConfig;
  label: string;
  rows?: number;
}> = [
  { key: 'templateName', label: 'Meta Template Name' },
  { key: 'languageCode', label: 'Language Code' },
  { key: 'electionState', label: 'Election State' },
  { key: 'electionYear', label: 'Election Year' },
  { key: 'assembly', label: 'Assembly' },
  { key: 'votingDate', label: 'Voting Date' },
  { key: 'votingTime', label: 'Voting Time' },
  { key: 'line12', label: 'Footer Line 12', rows: 2 },
  { key: 'line13', label: 'Footer Line 13', rows: 2 },
  { key: 'line14', label: 'Footer Line 14', rows: 2 },
  { key: 'line15', label: 'Footer Line 15', rows: 2 },
  { key: 'line16', label: 'Footer Line 16', rows: 2 },
  { key: 'line17', label: 'Footer Line 17', rows: 2 }
];

function templateLabel(type: TemplateType) {
  return type === 'THERMAL_PRINT' ? 'Thermal Print' : 'WhatsApp';
}

function templateImageLabel(type: TemplateType) {
  return type === 'THERMAL_PRINT' ? 'Print Image' : 'Template Image';
}

function templateImageHelp(type: TemplateType) {
  return type === 'THERMAL_PRINT'
    ? 'Only one print image is stored for this template. Uploading a new image replaces the old one and prints in the footer area of the thermal slip.'
    : 'Only one image is stored for this template. Uploading a new image replaces the old one and is used in message sharing.';
}

function createEmptyTemplate(type: TemplateType): FieldContentTemplate {
  return {
    id: null,
    type,
    name: type === 'THERMAL_PRINT' ? 'Thermal Print Template' : 'WhatsApp Template',
    body:
      type === 'THERMAL_PRINT'
        ? stringifyThermalPrintTemplateConfig(parseThermalPrintTemplateConfig(undefined))
        : stringifyWhatsAppTemplateConfig(parseWhatsAppTemplateConfig(undefined)),
    enabled: true,
    imagePath: null,
    imageUrl: null,
    updatedAt: null
  };
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
  const whatsappTemplate = templates.find((template) => template.type === 'WHATSAPP') ?? null;
  const thermalTemplate = templates.find((template) => template.type === 'THERMAL_PRINT') ?? null;

  const getPreviewText = (template: FieldContentTemplate) => {
    if (template.type === 'THERMAL_PRINT') {
      return buildThermalPrintPreview(parseThermalPrintTemplateConfig(template.body), SAMPLE_VOTER);
    }

    return buildWhatsAppPreview(parseWhatsAppTemplateConfig(template.body), SAMPLE_VOTER);
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

  const addTemplate = (type: TemplateType) => {
    setTemplates((current) => {
      if (current.some((template) => template.type === type)) {
        return current;
      }

      return [...current, createEmptyTemplate(type)];
    });
    setNotice(`${templateLabel(type)} template added. Fill the fields and save.`);
    setError('');
  };

  const setThermalTemplateField = (
    templateType: TemplateType,
    key: keyof ThermalPrintTemplateConfig,
    value: string
  ) => {
    setTemplates((current) =>
      current.map((template) => {
        if (template.type !== templateType || template.type !== 'THERMAL_PRINT') {
          return template;
        }

        const config = parseThermalPrintTemplateConfig(template.body);
        return {
          ...template,
          body: stringifyThermalPrintTemplateConfig({
            ...config,
            [key]: value
          })
        };
      })
    );
  };

  const setWhatsAppTemplateField = (
    key: keyof WhatsAppTemplateConfig,
    value: string
  ) => {
    setTemplates((current) =>
      current.map((template) => {
        if (template.type !== 'WHATSAPP') {
          return template;
        }

        const config = parseWhatsAppTemplateConfig(template.body);
        return {
          ...template,
          body: stringifyWhatsAppTemplateConfig({
            ...config,
            [key]: value
          })
        };
      })
    );
  };

  const uploadImage = async (file: File, kind: 'banner' | 'template', options?: { templateType?: TemplateType; existingPath?: string | null }) => {
    const form = new FormData();
    form.append('file', file);
    form.append('kind', kind);
    if (options?.templateType) form.append('templateType', options.templateType);
    if (options?.existingPath) form.append('existingPath', options.existingPath);

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

  const saveTemplate = async (templateType: TemplateType, templateOverride?: FieldContentTemplate) => {
    const template = templateOverride ?? templates.find((entry) => entry.type === templateType);
    if (!template) {
      setError('Unable to find template to save');
      return;
    }

    if (!template.name.trim()) {
      setError(`${templateLabel(templateType)} template name is required.`);
      return;
    }

    if (!template.body.trim()) {
      setError(`${templateLabel(templateType)} template body is required.`);
      return;
    }

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

  const deleteTemplate = async (templateType: TemplateType) => {
    setBusyKey(`template-delete:${templateType}`);
    setNotice('');
    setError('');

    try {
      const res = await fetch('/api/field-content/templates', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: templateType })
      });

      const json = (await res.json().catch(() => null)) as { error?: string; templates?: FieldContentTemplate[] } | null;
      if (!res.ok || !json?.templates) {
        throw new Error(json?.error ?? 'Unable to delete template');
      }

      setTemplates(json.templates);
      setNotice(`${templateLabel(templateType)} template deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete template');
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
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Manual up and down ordering is disabled for the current banner table.
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
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                          {index === 0 ? 'Home Banner' : `Onboarding Banner ${index}`}
                        </Typography>
                        <Chip
                          size="small"
                          label={index === 0 ? 'Shown on Home' : 'Shown in Onboarding'}
                          color={index === 0 ? 'primary' : 'default'}
                          variant={index === 0 ? 'filled' : 'outlined'}
                        />
                      </Stack>

                      <Box
                        sx={{
                          position: 'relative',
                          width: '100%',
                          height: 160,
                          borderRadius: 3,
                          overflow: 'hidden',
                          border: '1px solid',
                          borderColor: 'divider',
                          backgroundColor: 'action.hover',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {banner.imageUrl ? (
                          <Box
                            component="img"
                            src={banner.imageUrl}
                            alt={banner.title || 'Banner preview'}
                            sx={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                        ) : (
                          <Stack alignItems="center" spacing={1} sx={{ color: 'text.disabled' }}>
                            <AddPhotoAlternateRoundedIcon sx={{ fontSize: 40 }} />
                            <Typography variant="caption">No image uploaded</Typography>
                          </Stack>
                        )}

                        {busyKey === `banner:${banner.localKey}` && (
                          <Box
                            sx={{
                              position: 'absolute',
                              inset: 0,
                              backgroundColor: 'rgba(255, 255, 255, 0.7)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              zIndex: 1
                            }}
                          >
                            <Typography variant="button" color="primary" sx={{ fontWeight: 700 }}>
                              Uploading...
                            </Typography>
                          </Box>
                        )}
                      </Box>

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
                                    const image = await uploadImage(file, 'banner', { existingPath: banner.imagePath });
                                    const updatedBanner = { ...banner, ...image };
                                    setBannerField(banner.localKey, image);
                                    setNotice('Banner image uploaded. Saving...');
                                    
                                    // Auto-save the banner to make it truly dynamic
                                    await saveBanner(updatedBanner);
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
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Dynamic Communication Templates
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Use voter fields inside the message body and thermal print labels.
                </Typography>
              </Box>
              {canEdit && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  {!templates.some((template) => template.type === 'WHATSAPP') && (
                    <Button variant="outlined" onClick={() => addTemplate('WHATSAPP')}>
                      Add WhatsApp
                    </Button>
                  )}
                  {!templates.some((template) => template.type === 'THERMAL_PRINT') && (
                    <Button variant="outlined" onClick={() => addTemplate('THERMAL_PRINT')}>
                      Add Thermal
                    </Button>
                  )}
                </Stack>
              )}
            </Stack>

            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {FIELD_TEMPLATE_TOKENS.map((token) => (
                <Chip key={token} label={token} size="small" />
              ))}
            </Stack>

            <Stack spacing={1.5}>
              {!sortedTemplates.length && (
                <Alert severity="info">
                  No templates created yet. Use Add WhatsApp or Add Thermal to create the first template.
                </Alert>
              )}
              {whatsappTemplate ? (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            WhatsApp Template
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Separate storage for message text and share image.
                          </Typography>
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={whatsappTemplate.enabled}
                              onChange={(event) => setTemplateField('WHATSAPP', { enabled: event.target.checked })}
                              disabled={!canEdit}
                            />
                          }
                          label={whatsappTemplate.enabled ? 'Enabled' : 'Disabled'}
                        />
                      </Stack>

                      <TextField
                        label="WhatsApp Template Name"
                        value={whatsappTemplate.name}
                        onChange={(event) => setTemplateField('WHATSAPP', { name: event.target.value })}
                        disabled={!canEdit}
                        fullWidth
                      />

                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Configure the Meta payload fields used by WhatsApp share. These values map directly to
                          {' {{1}} to {{17}} '}in your approved template.
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gap: 1.25,
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }
                          }}
                        >
                          {WHATSAPP_TEXT_FIELDS.map((field) => (
                            <TextField
                              key={field.key}
                              label={field.label}
                              value={parseWhatsAppTemplateConfig(whatsappTemplate.body)[field.key] ?? ''}
                              onChange={(event) => setWhatsAppTemplateField(field.key, event.target.value)}
                              disabled={!canEdit}
                              multiline={Boolean(field.rows)}
                              minRows={field.rows}
                              fullWidth
                            />
                          ))}
                        </Box>
                      </Stack>

                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          WhatsApp Template Image
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {templateImageHelp('WHATSAPP')}
                        </Typography>
                      </Box>

                      {whatsappTemplate.imageUrl && (
                        <Box
                          component="img"
                          src={whatsappTemplate.imageUrl}
                          alt="WhatsApp template preview"
                          sx={{
                            width: '100%',
                            height: 160,
                            objectFit: 'cover',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: '#fff'
                          }}
                        />
                      )}

                      <Box
                        sx={{
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 3,
                          backgroundColor: '#edf4ff'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          WhatsApp Preview
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                          {getPreviewText(whatsappTemplate)}
                        </Typography>
                      </Box>

                      {canEdit && (
                        <Stack spacing={1.25}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button
                              component="label"
                              variant="outlined"
                              startIcon={<AddPhotoAlternateRoundedIcon />}
                              disabled={busyKey === 'template:WHATSAPP' || busyKey === 'template-delete:WHATSAPP'}
                            >
                              Upload WhatsApp Image
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;

                                  setBusyKey('template:WHATSAPP');
                                  setNotice('');
                                  setError('');

                                  try {
                                    const image = await uploadImage(file, 'template', {
                                      templateType: 'WHATSAPP',
                                      existingPath: whatsappTemplate.imagePath
                                    });
                                    const updatedTemplate = { ...whatsappTemplate, ...image };
                                    setTemplateField('WHATSAPP', image);
                                    setNotice('WhatsApp image uploaded. Saving...');
                                    setTemplates((current) =>
                                      current.map((template) =>
                                        template.type === 'WHATSAPP' ? updatedTemplate : template
                                      )
                                    );
                                    await saveTemplate('WHATSAPP', updatedTemplate);
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
                              onClick={() => setTemplateField('WHATSAPP', { imagePath: null, imageUrl: null })}
                              disabled={busyKey === 'template:WHATSAPP' || busyKey === 'template-delete:WHATSAPP'}
                            >
                              Clear WhatsApp Image
                            </Button>
                            <Button
                              variant="text"
                              color="error"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              onClick={() => void deleteTemplate('WHATSAPP')}
                              disabled={busyKey === 'template:WHATSAPP' || busyKey === 'template-delete:WHATSAPP'}
                            >
                              {busyKey === 'template-delete:WHATSAPP' ? 'Deleting...' : 'Delete WhatsApp Template'}
                            </Button>
                          </Stack>
                          <Stack direction="row" justifyContent="flex-end">
                            <Button
                              variant="contained"
                              startIcon={<SaveRoundedIcon />}
                              onClick={() => void saveTemplate('WHATSAPP')}
                              disabled={busyKey === 'template:WHATSAPP' || busyKey === 'template-delete:WHATSAPP'}
                            >
                              {busyKey === 'template:WHATSAPP' ? 'Saving...' : 'Save WhatsApp Template'}
                            </Button>
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}

              {thermalTemplate ? (
                <Card variant="outlined">
                  <CardContent>
                    <Stack spacing={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                            Thermal Print Template
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Separate storage for print layout labels and print image.
                          </Typography>
                        </Box>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={thermalTemplate.enabled}
                              onChange={(event) => setTemplateField('THERMAL_PRINT', { enabled: event.target.checked })}
                              disabled={!canEdit}
                            />
                          }
                          label={thermalTemplate.enabled ? 'Enabled' : 'Disabled'}
                        />
                      </Stack>

                      <TextField
                        label="Thermal Template Name"
                        value={thermalTemplate.name}
                        onChange={(event) => setTemplateField('THERMAL_PRINT', { name: event.target.value })}
                        disabled={!canEdit}
                        fullWidth
                      />

                      <Stack spacing={1.25}>
                        <Typography variant="body2" color="text.secondary">
                          Build the print slip in sections: header, voter details, cut line, print image, and footer text.
                        </Typography>
                        <Box
                          sx={{
                            display: 'grid',
                            gap: 1.25,
                            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }
                          }}
                        >
                          {THERMAL_TEXT_FIELDS.map((field) => (
                            <TextField
                              key={field.key}
                              label={field.label}
                              value={parseThermalPrintTemplateConfig(thermalTemplate.body)[field.key] ?? ''}
                              onChange={(event) =>
                                setThermalTemplateField('THERMAL_PRINT', field.key, event.target.value)
                              }
                              disabled={!canEdit}
                              multiline={Boolean(field.rows)}
                              minRows={field.rows}
                              fullWidth
                            />
                          ))}
                        </Box>
                      </Stack>

                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          Thermal Print Image
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.4 }}>
                          {templateImageHelp('THERMAL_PRINT')}
                        </Typography>
                      </Box>

                      {thermalTemplate.imageUrl && (
                        <Box
                          component="img"
                          src={thermalTemplate.imageUrl}
                          alt="Thermal print image preview"
                          sx={{
                            width: '100%',
                            height: 160,
                            objectFit: 'contain',
                            borderRadius: 3,
                            border: '1px solid',
                            borderColor: 'divider',
                            backgroundColor: '#fff'
                          }}
                        />
                      )}

                      <Box
                        sx={{
                          p: 1.5,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 3,
                          backgroundColor: '#f7f7f7'
                        }}
                      >
                        <Typography variant="caption" color="text.secondary">
                          Thermal Print Preview
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ mt: 1, whiteSpace: 'pre-wrap', lineHeight: 1.6, fontFamily: 'monospace' }}
                        >
                          {getPreviewText(thermalTemplate)}
                        </Typography>
                      </Box>

                      {canEdit && (
                        <Stack spacing={1.25}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <Button
                              component="label"
                              variant="outlined"
                              startIcon={<AddPhotoAlternateRoundedIcon />}
                              disabled={busyKey === 'template:THERMAL_PRINT' || busyKey === 'template-delete:THERMAL_PRINT'}
                            >
                              Upload Thermal Image
                              <input
                                hidden
                                type="file"
                                accept="image/*"
                                onChange={async (event) => {
                                  const file = event.target.files?.[0];
                                  if (!file) return;

                                  setBusyKey('template:THERMAL_PRINT');
                                  setNotice('');
                                  setError('');

                                  try {
                                    const image = await uploadImage(file, 'template', {
                                      templateType: 'THERMAL_PRINT',
                                      existingPath: thermalTemplate.imagePath
                                    });
                                    const updatedTemplate = { ...thermalTemplate, ...image };
                                    setTemplateField('THERMAL_PRINT', image);
                                    setNotice('Thermal image uploaded. Saving...');
                                    setTemplates((current) =>
                                      current.map((template) =>
                                        template.type === 'THERMAL_PRINT' ? updatedTemplate : template
                                      )
                                    );
                                    await saveTemplate('THERMAL_PRINT', updatedTemplate);
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
                              onClick={() => setTemplateField('THERMAL_PRINT', { imagePath: null, imageUrl: null })}
                              disabled={busyKey === 'template:THERMAL_PRINT' || busyKey === 'template-delete:THERMAL_PRINT'}
                            >
                              Clear Thermal Image
                            </Button>
                            <Button
                              variant="text"
                              color="error"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              onClick={() => void deleteTemplate('THERMAL_PRINT')}
                              disabled={busyKey === 'template:THERMAL_PRINT' || busyKey === 'template-delete:THERMAL_PRINT'}
                            >
                              {busyKey === 'template-delete:THERMAL_PRINT' ? 'Deleting...' : 'Delete Thermal Template'}
                            </Button>
                          </Stack>
                          <Stack direction="row" justifyContent="flex-end">
                            <Button
                              variant="contained"
                              startIcon={<SaveRoundedIcon />}
                              onClick={() => void saveTemplate('THERMAL_PRINT')}
                              disabled={busyKey === 'template:THERMAL_PRINT' || busyKey === 'template-delete:THERMAL_PRINT'}
                            >
                              {busyKey === 'template:THERMAL_PRINT' ? 'Saving...' : 'Save Thermal Template'}
                            </Button>
                          </Stack>
                        </Stack>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              ) : null}
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
