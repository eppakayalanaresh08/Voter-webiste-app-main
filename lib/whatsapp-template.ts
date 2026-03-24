import { renderMessageTemplate } from './message-templates';
import type { OfflineVoter } from './offline-db';
import { type FieldContentTemplate, templateByType } from './field-content-shared';

export type WhatsAppTemplateConfig = {
  templateName: string;
  languageCode: string;
  electionState: string;
  electionYear: string;
  assembly: string;
  votingDate: string;
  votingTime: string;
  line12: string;
  line13: string;
  line14: string;
  line15: string;
  line16: string;
  line17: string;
};

export const DEFAULT_WHATSAPP_TEMPLATE: WhatsAppTemplateConfig = {
  templateName: 'voter_app',
  languageCode: 'en',
  electionState: 'TAMILNADU',
  electionYear: '2026',
  assembly: '{{booth_name}}',
  votingDate: '**',
  votingTime: '**',
  line12: 'Kindly do Cast Your Valuable Vote for CONGRESS',
  line13:
    'தயவுசெய்து உங்கள் மதிப்புமிக்க வாக்கை காங்கிரசுக்கு அளிக்கவும்',
  line14: '',
  line15: 'NAVEEN KUMAR V',
  line16: 'SL NO 43',
  line17: 'CONGRESS CANDIDATE'
};

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

export function parseWhatsAppTemplateConfig(body: string | null | undefined): WhatsAppTemplateConfig {
  if (!body?.trim()) {
    return { ...DEFAULT_WHATSAPP_TEMPLATE };
  }

  try {
    const parsed = JSON.parse(body) as Partial<WhatsAppTemplateConfig>;
    return {
      templateName: normalizeString(parsed.templateName, DEFAULT_WHATSAPP_TEMPLATE.templateName),
      languageCode: normalizeString(parsed.languageCode, DEFAULT_WHATSAPP_TEMPLATE.languageCode),
      electionState: normalizeString(parsed.electionState, DEFAULT_WHATSAPP_TEMPLATE.electionState),
      electionYear: normalizeString(parsed.electionYear, DEFAULT_WHATSAPP_TEMPLATE.electionYear),
      assembly: normalizeString(parsed.assembly, DEFAULT_WHATSAPP_TEMPLATE.assembly),
      votingDate: normalizeString(parsed.votingDate, DEFAULT_WHATSAPP_TEMPLATE.votingDate),
      votingTime: normalizeString(parsed.votingTime, DEFAULT_WHATSAPP_TEMPLATE.votingTime),
      line12: normalizeString(parsed.line12, DEFAULT_WHATSAPP_TEMPLATE.line12),
      line13: normalizeString(parsed.line13, DEFAULT_WHATSAPP_TEMPLATE.line13),
      line14: normalizeString(parsed.line14, DEFAULT_WHATSAPP_TEMPLATE.line14),
      line15: normalizeString(parsed.line15, DEFAULT_WHATSAPP_TEMPLATE.line15),
      line16: normalizeString(parsed.line16, DEFAULT_WHATSAPP_TEMPLATE.line16),
      line17: normalizeString(parsed.line17, DEFAULT_WHATSAPP_TEMPLATE.line17)
    };
  } catch {
    return {
      ...DEFAULT_WHATSAPP_TEMPLATE,
      line12: body.trim()
    };
  }
}

export function stringifyWhatsAppTemplateConfig(config: WhatsAppTemplateConfig) {
  return JSON.stringify(config, null, 2);
}

export function resolveWhatsAppTemplate(templates: FieldContentTemplate[]) {
  return templateByType(templates, 'WHATSAPP');
}

export function renderWhatsAppField(value: string, voter: OfflineVoter) {
  return renderMessageTemplate(value, voter).trim();
}

export function buildWhatsAppPreview(config: WhatsAppTemplateConfig, voter: OfflineVoter) {
  const line = (value: string) => renderWhatsAppField(value, voter);

  return [
    'Greetings,',
    '',
    `${line(config.electionState)} State Elections - ${line(config.electionYear)}`,
    '',
    `Assembly : ${line(config.assembly) || '-'}`,
    '--------------------------------',
    `Name: ${voter.voter_name ?? '-'}`,
    `Father : ${voter.relation_name ?? '-'}`,
    `EPIC ID: ${voter.epic_id ?? '-'}`,
    `Booth : ${voter.booth_no ?? '-'}`,
    `Serial : ${voter.serial_no ?? '-'}`,
    '--------------------------------',
    'Booth Address:',
    voter.booth_address ?? '-',
    `Voting Date: ${line(config.votingDate) || '-'}`,
    `Voting Time: ${line(config.votingTime) || '-'}`,
    '',
    '--------------------------------',
    line(config.line12),
    line(config.line13),
    line(config.line14),
    line(config.line15),
    line(config.line16),
    '',
    line(config.line17),
    '--------------------------------',
    '',
    'Please review your voter details carefully and carry valid ID proof while visiting the polling booth.'
  ]
    .filter((entry, index, source) => entry !== '' || source[index - 1] !== '')
    .join('\n');
}
