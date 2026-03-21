import type { OfflineVoter } from './offline-db';

const TOKEN_RESOLVERS: Record<string, (voter: OfflineVoter) => string> = {
  voter_name: (voter) => voter.voter_name ?? '',
  voter_name_telugu: (voter) => voter.voter_name_tamil ?? '',
  relation_name: (voter) => voter.relation_name ?? '',
  relation_name_telugu: (voter) => voter.relation_name_tamil ?? '',
  booth_no: (voter) => voter.booth_no ?? '',
  booth_name: (voter) => voter.booth_name ?? '',
  serial_no: (voter) => voter.serial_no ?? '',
  house_no: (voter) => voter.house_no ?? '',
  epic_id: (voter) => voter.epic_id ?? '',
  mobile_no: (voter) => voter.mobile_no ?? '',
  age: (voter) => (voter.age ?? '') === '' ? '' : String(voter.age ?? ''),
  sex: (voter) => voter.sex ?? ''
};

export function renderMessageTemplate(template: string, voter: OfflineVoter) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const resolver = TOKEN_RESOLVERS[key];
    if (!resolver) return '';
    return resolver(voter);
  });
}

export function appendImageToMessage(message: string, imageUrl?: string | null) {
  if (!imageUrl) return message;
  return `${message}\n\n${imageUrl}`;
}
