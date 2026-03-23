export const TEMPLATE_TYPES = ['WHATSAPP', 'THERMAL_PRINT'] as const;

export type TemplateType = (typeof TEMPLATE_TYPES)[number];

export type FieldContentBanner = {
  id: string | null;
  title: string;
  subtitle: string;
  imagePath: string | null;
  imageUrl: string | null;
  enabled: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

export type FieldContentTemplate = {
  id: string | null;
  type: TemplateType;
  name: string;
  body: string;
  enabled: boolean;
  imagePath: string | null;
  imageUrl: string | null;
  updatedAt: string | null;
};

export const FIELD_TEMPLATE_TOKENS = [
  '{{voter_name}}',
  '{{voter_name_telugu}}',
  '{{relation_name}}',
  '{{relation_name_telugu}}',
  '{{booth_no}}',
  '{{booth_name}}',
  '{{serial_no}}',
  '{{house_no}}',
  '{{epic_id}}',
  '{{mobile_no}}',
  '{{age}}',
  '{{sex}}'
] as const;

export type BannerDisplayContent = {
  home: FieldContentBanner | null;
  onboarding: FieldContentBanner[];
};

export function getDefaultFieldBanners(): FieldContentBanner[] {
  return [];
}

export function splitBannersForDisplay(input: FieldContentBanner[]): BannerDisplayContent {
  const banners = [...input].sort((left, right) => left.sortOrder - right.sortOrder);
  const home = banners[0] ?? null;
  const onboarding = banners.slice(1);

  return {
    home,
    onboarding
  };
}

export function getDefaultFieldTemplates(): FieldContentTemplate[] {
  return [];
}

export function mergeTemplatesWithDefaults(input: Partial<FieldContentTemplate>[]): FieldContentTemplate[] {
  return input.filter(
    (template): template is FieldContentTemplate =>
      Boolean(
        template.type &&
          (template.type === 'WHATSAPP' || template.type === 'THERMAL_PRINT') &&
          typeof template.name === 'string' &&
          typeof template.body === 'string' &&
          typeof template.enabled === 'boolean'
      )
  );
}

export function templateByType(templates: FieldContentTemplate[], type: TemplateType): FieldContentTemplate | null {
  return mergeTemplatesWithDefaults(templates).find((template) => template.type === type) ?? null;
}
