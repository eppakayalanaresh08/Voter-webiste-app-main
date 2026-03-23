import { renderMessageTemplate } from './message-templates';
import type { OfflineVoter } from './offline-db';
import { type FieldContentTemplate, templateByType } from './field-content-shared';

export type ThermalPrintTemplateConfig = {
  headerLine1: string;
  headerLine2: string;
  headerLine3: string;
  relationLabel: string;
  epicLabel: string;
  boothLabel: string;
  serialLabel: string;
  pollBoothLabel: string;
  voteOnLabel: string;
  printedOnLabel: string;
  cutLineText: string;
  appealLine1: string;
  appealLine2: string;
  appealLineTamil: string;
  candidateLine1: string;
  candidateLine2: string;
  candidateLine3: string;
  candidateLine4: string;
};

export const DEFAULT_THERMAL_PRINT_TEMPLATE: ThermalPrintTemplateConfig = {
  headerLine1: 'TAMILNADU STATE',
  headerLine2: 'ELECTIONS-2026',
  headerLine3: 'VOTER-SLIP',
  relationLabel: 'Father',
  epicLabel: 'EPIC ID',
  boothLabel: 'Booth#',
  serialLabel: 'Sl#',
  pollBoothLabel: 'Poll Booth:',
  voteOnLabel: 'Vote On:',
  printedOnLabel: 'Printed On',
  cutLineText: '****** Please cut here ******',
  appealLine1: 'Kindly do Cast Your Valuable',
  appealLine2: 'Vote for CONGRESS',
  appealLineTamil: 'தயவுசெய்து உங்கள் மதிப்புமிக்க வாக்கை காங்கிரசுக்கு அளிக்கவும்',
  candidateLine1: 'NAVEEN KUMAR V',
  candidateLine2: 'SL NO 43',
  candidateLine3: 'CONGRESS',
  candidateLine4: 'CANDIDATE'
};

function normalizeString(value: unknown, fallback: string) {
  return typeof value === 'string' ? value : fallback;
}

export function parseThermalPrintTemplateConfig(body: string | null | undefined): ThermalPrintTemplateConfig {
  if (!body?.trim()) {
    return { ...DEFAULT_THERMAL_PRINT_TEMPLATE };
  }

  try {
    const parsed = JSON.parse(body) as Partial<ThermalPrintTemplateConfig>;
    return {
      headerLine1: normalizeString(parsed.headerLine1, DEFAULT_THERMAL_PRINT_TEMPLATE.headerLine1),
      headerLine2: normalizeString(parsed.headerLine2, DEFAULT_THERMAL_PRINT_TEMPLATE.headerLine2),
      headerLine3: normalizeString(parsed.headerLine3, DEFAULT_THERMAL_PRINT_TEMPLATE.headerLine3),
      relationLabel: normalizeString(parsed.relationLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.relationLabel),
      epicLabel: normalizeString(parsed.epicLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.epicLabel),
      boothLabel: normalizeString(parsed.boothLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.boothLabel),
      serialLabel: normalizeString(parsed.serialLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.serialLabel),
      pollBoothLabel: normalizeString(parsed.pollBoothLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.pollBoothLabel),
      voteOnLabel: normalizeString(parsed.voteOnLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.voteOnLabel),
      printedOnLabel: normalizeString(parsed.printedOnLabel, DEFAULT_THERMAL_PRINT_TEMPLATE.printedOnLabel),
      cutLineText: normalizeString(parsed.cutLineText, DEFAULT_THERMAL_PRINT_TEMPLATE.cutLineText),
      appealLine1: normalizeString(parsed.appealLine1, DEFAULT_THERMAL_PRINT_TEMPLATE.appealLine1),
      appealLine2: normalizeString(parsed.appealLine2, DEFAULT_THERMAL_PRINT_TEMPLATE.appealLine2),
      appealLineTamil: normalizeString(parsed.appealLineTamil, DEFAULT_THERMAL_PRINT_TEMPLATE.appealLineTamil),
      candidateLine1: normalizeString(parsed.candidateLine1, DEFAULT_THERMAL_PRINT_TEMPLATE.candidateLine1),
      candidateLine2: normalizeString(parsed.candidateLine2, DEFAULT_THERMAL_PRINT_TEMPLATE.candidateLine2),
      candidateLine3: normalizeString(parsed.candidateLine3, DEFAULT_THERMAL_PRINT_TEMPLATE.candidateLine3),
      candidateLine4: normalizeString(parsed.candidateLine4, DEFAULT_THERMAL_PRINT_TEMPLATE.candidateLine4)
    };
  } catch {
    return { ...DEFAULT_THERMAL_PRINT_TEMPLATE };
  }
}

export function stringifyThermalPrintTemplateConfig(config: ThermalPrintTemplateConfig) {
  return JSON.stringify(config, null, 2);
}

export function resolveThermalPrintTemplate(templates: FieldContentTemplate[]) {
  return templateByType(templates, 'THERMAL_PRINT');
}

export function renderThermalPrintField(value: string, voter: OfflineVoter) {
  return renderMessageTemplate(value, voter).trim();
}

export function buildThermalPrintPreview(config: ThermalPrintTemplateConfig, voter: OfflineVoter) {
  const line = (value: string) => renderThermalPrintField(value, voter);
  const boothName = [voter.booth_name, voter.booth_address].filter(Boolean).join(', ');

  return [
    line(config.headerLine1),
    line(config.headerLine2),
    line(config.headerLine3),
    '',
    `Name: ${voter.voter_name ?? '-'}`,
    `${line(config.relationLabel)}: ${voter.relation_name ?? '-'}`,
    `${line(config.epicLabel)}: ${voter.epic_id ?? '-'}`,
    `${line(config.boothLabel)}: ${voter.booth_no ?? '-'}   ${line(config.serialLabel)}: ${voter.serial_no ?? '-'}`,
    `${line(config.pollBoothLabel)} ${boothName || '-'}`,
    line(config.voteOnLabel),
    `${line(config.printedOnLabel)} ...`,
    line(config.cutLineText),
    '',
    line(config.appealLine1),
    line(config.appealLine2),
    line(config.appealLineTamil),
    '',
    line(config.candidateLine1),
    line(config.candidateLine2),
    line(config.candidateLine3),
    line(config.candidateLine4)
  ].join('\n');
}
