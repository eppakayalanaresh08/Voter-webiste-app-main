export const TEMPLATE_TYPES = ['WHATSAPP'] as const;

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

export function getDefaultFieldBanners(): FieldContentBanner[] {
  return [
    {
      id: null,
      title: 'Home',
      subtitle: 'Manage voter data in one place with a simple workflow.',
      imagePath: '/icons/icon-512.png',
      imageUrl: '/icons/icon-512.png',
      enabled: true,
      sortOrder: 0,
      updatedAt: null
    },
    {
      id: null,
      title: 'Onboarding',
      subtitle: 'Keep booth operations structured with clean access and faster execution.',
      imagePath: '/icons/icon-512.png',
      imageUrl: '/icons/icon-512.png',
      enabled: true,
      sortOrder: 1,
      updatedAt: null
    }
  ];
}

export function getDefaultFieldTemplates(): FieldContentTemplate[] {
  return [
    {
      id: null,
      type: 'WHATSAPP',
      name: 'WhatsApp Message',
      body:
        'Hello {{voter_name}},\nBooth {{booth_no}} - {{booth_name}}\nSerial: {{serial_no}}\nEPIC: {{epic_id}}\nHouse: {{house_no}}',
      enabled: true,
      imagePath: null,
      imageUrl: null,
      updatedAt: null
    }
  ];
}

export function mergeTemplatesWithDefaults(input: Partial<FieldContentTemplate>[]): FieldContentTemplate[] {
  const defaults = new Map(getDefaultFieldTemplates().map((template) => [template.type, template]));

  for (const partial of input) {
    if (!partial.type || !defaults.has(partial.type)) continue;
    const current = defaults.get(partial.type)!;
    defaults.set(partial.type, {
      ...current,
      ...partial
    });
  }

  return TEMPLATE_TYPES.map((type) => defaults.get(type)!);
}

export function templateByType(templates: FieldContentTemplate[], type: TemplateType): FieldContentTemplate {
  return mergeTemplatesWithDefaults(templates).find((template) => template.type === type)!;
}
